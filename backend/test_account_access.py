import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

import account_permissions
import api_admin
import api_finance
from starlette.requests import Request


def matches(document, query):
    for key, expected in query.items():
        if key == "$or":
            if not any(matches(document, branch) for branch in expected):
                return False
        elif key == "$and":
            if not all(matches(document, branch) for branch in expected):
                return False
        elif isinstance(expected, dict) and "$in" in expected:
            if document.get(key) not in expected["$in"]:
                return False
        elif isinstance(expected, dict) and "$exists" in expected:
            if (key in document) != expected["$exists"]:
                return False
        elif isinstance(expected, dict) and "$ne" in expected:
            if document.get(key) == expected["$ne"]:
                return False
        elif document.get(key) != expected:
            return False
    return True


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = [dict(document) for document in documents]

    async def find_one(self, query):
        return next((document for document in self.documents if matches(document, query)), None)

    def find(self, query):
        return FakeCursor([document for document in self.documents if matches(document, query)])

    async def insert_one(self, document):
        item = dict(document)
        item.setdefault("_id", ObjectId())
        self.documents.append(item)
        return SimpleNamespace(inserted_id=item["_id"])

    async def update_one(self, query, update, upsert=False):
        document = await self.find_one(query)
        if document:
            document.update(update.get("$set", {}))
            return SimpleNamespace(modified_count=1)
        if upsert:
            document = {key: value for key, value in query.items() if not key.startswith("$")}
            document.update(update.get("$set", {}))
            self.documents.append(document)
        return SimpleNamespace(modified_count=0)


class FakeCursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, *_args):
        return self

    async def to_list(self, _limit):
        return self.documents


@pytest.fixture
def sharing_setup(monkeypatch):
    owner_id, collaborator_id, account_id = ObjectId(), ObjectId(), ObjectId()
    owner = {"_id": owner_id, "role": "PROJECT_ADMIN", "email": "owner@example.test"}
    collaborator = {
        "_id": collaborator_id,
        "role": "HOUSEHOLD_USER",
        "email": "collaborator@example.test",
    }
    accounts = FakeCollection([{"_id": account_id, "name": "Private checking"}])
    users = FakeCollection([owner, collaborator])
    grants = FakeCollection()
    audits = []
    fake_db = SimpleNamespace(
        accounts=accounts,
        users=users,
        account_access_grants=grants,
        transactions=FakeCollection(),
        settings=FakeCollection(),
    )
    monkeypatch.setattr(account_permissions, "db", fake_db)
    monkeypatch.setattr(api_finance, "db", fake_db)

    async def record_audit(actor, action, entity, entity_id=None, meta=None):
        audits.append((action, entity_id, meta))

    monkeypatch.setattr(api_finance, "log_audit", record_audit)
    return owner, collaborator, str(account_id), grants, audits


def test_collaborators_have_no_accounts_without_an_explicit_grant(sharing_setup):
    _, collaborator, account_id, _, _ = sharing_setup

    with pytest.raises(HTTPException) as error:
        asyncio.run(account_permissions.require_account_access(collaborator, account_id))

    assert error.value.status_code == 404


def test_grant_and_revocation_are_audited_without_elevating_the_collaborator(sharing_setup):
    owner, collaborator, account_id, grants, audits = sharing_setup

    granted = asyncio.run(api_finance.grant_account_access(
        account_id,
        {"user_id": str(collaborator["_id"]), "access": "use"},
        owner,
    ))

    assert granted["access"] == "use"
    assert collaborator["role"] == "HOUSEHOLD_USER"
    assert asyncio.run(account_permissions.granted_account_ids(collaborator, "use")) == {account_id}
    asyncio.run(api_finance.revoke_account_access(account_id, str(collaborator["_id"]), owner))

    assert asyncio.run(account_permissions.granted_account_ids(collaborator, "read")) == set()
    assert [event[0] for event in audits] == ["grant_account_access", "revoke_account_access"]
    assert grants.documents[0]["active"] is False


def test_read_grant_cannot_be_used_to_write_to_an_account(sharing_setup):
    _, collaborator, account_id, grants, _ = sharing_setup
    grants.documents.append({
        "account_id": account_id,
        "user_id": str(collaborator["_id"]),
        "access": "read",
        "active": True,
    })

    with pytest.raises(HTTPException) as error:
        asyncio.run(account_permissions.require_transaction_accounts(
            {"type": "EXPENSE", "account_id": account_id, "amount": 10},
            collaborator,
        ))

    assert error.value.status_code == 404


def test_collaborator_cannot_link_a_transaction_to_an_ungranted_account(sharing_setup):
    _, collaborator, account_id, grants, _ = sharing_setup
    grants.documents.append({
        "account_id": account_id,
        "user_id": str(collaborator["_id"]),
        "access": "use",
        "active": True,
    })

    with pytest.raises(HTTPException) as error:
        asyncio.run(account_permissions.require_transaction_accounts(
            {
                "type": "TRANSFER",
                "account_id": account_id,
                "to_account_id": str(ObjectId()),
                "amount": 10,
            },
            collaborator,
        ))

    assert error.value.status_code == 404


def test_account_grants_cannot_be_assigned_to_admin_roles(sharing_setup):
    owner, _, account_id, _, _ = sharing_setup

    with pytest.raises(HTTPException) as error:
        asyncio.run(api_finance.grant_account_access(
            account_id,
            {"user_id": str(owner["_id"]), "access": "use"},
            owner,
        ))

    assert error.value.status_code == 422


def test_account_and_transaction_reads_are_limited_to_granted_accounts(sharing_setup):
    _, collaborator, account_id, grants, _ = sharing_setup
    hidden_account_id = str(ObjectId())
    api_finance.db.accounts.documents[0]["opening_balance"] = 125
    api_finance.db.accounts.documents.append({
        "_id": ObjectId(hidden_account_id),
        "name": "Private savings",
        "opening_balance": 5000,
    })
    grants.documents.append({
        "account_id": account_id,
        "user_id": str(collaborator["_id"]),
        "access": "read",
        "active": True,
    })
    api_finance.db.transactions.documents.extend([
        {
            "_id": ObjectId(),
            "type": "INCOME",
            "account_id": account_id,
            "amount": 25,
            "date": "2026-10-01",
            "project_id": "must-not-be-returned",
        },
        {
            "_id": ObjectId(),
            "type": "INCOME",
            "account_id": hidden_account_id,
            "amount": 9000,
            "date": "2026-10-02",
        },
        {
            "_id": ObjectId(),
            "type": "TRANSFER",
            "account_id": account_id,
            "to_account_id": hidden_account_id,
            "amount": 300,
            "date": "2026-10-03",
        },
    ])
    request = Request({
        "type": "http",
        "method": "GET",
        "path": "/api/transactions",
        "query_string": b"",
        "headers": [],
        "scheme": "http",
        "server": ("test", 80),
        "client": ("test", 1234),
        "http_version": "1.1",
    })

    accounts = asyncio.run(api_finance.list_accounts(collaborator))
    transactions = asyncio.run(api_finance.list_transactions(request, collaborator))

    assert [account["id"] for account in accounts] == [account_id]
    assert accounts[0]["current_balance"] == 150
    assert accounts[0]["access_level"] == "read"
    assert len(transactions) == 1
    assert transactions[0]["account_id"] == account_id
    assert "project_id" not in transactions[0]


def test_household_role_is_creatable_without_admin_privileges(monkeypatch):
    owner_id = ObjectId()
    owner = {"_id": owner_id, "role": "PROJECT_ADMIN", "email": "owner@example.test"}
    users = FakeCollection([owner])

    async def no_audit(*_args, **_kwargs):
        return None

    async def generated_email(_name):
        return "collaborator@example.test"

    monkeypatch.setattr(api_admin, "db", SimpleNamespace(users=users))
    monkeypatch.setattr(api_admin, "raw_db", SimpleNamespace(users=users))
    monkeypatch.setattr(api_admin, "log_audit", no_audit)
    monkeypatch.setattr(api_admin, "available_login_id", generated_email)

    created = asyncio.run(api_admin.create_user(
        {
            "name": "Household Collaborator",
            "role": "HOUSEHOLD_USER",
            "password": "test-password",
            "permissions": [{"project_id": "private-project"}],
        },
        owner,
    ))

    assert created["role"] == "HOUSEHOLD_USER"
    assert created["role"] not in ("SUPER_ADMIN", "PROJECT_ADMIN")
    assert created["permissions"] == []


def test_household_settings_are_a_safe_read_only_subset(sharing_setup):
    _, collaborator, _, _, _ = sharing_setup
    settings_collection = api_finance.db.settings
    settings_collection.documents.append({
        "_id": "app",
        "currency": "INR",
        "timezone": "Asia/Kolkata",
        "date_format": "DD-MM-YYYY",
        "income_categories": ["Salary"],
        "expense_categories": ["Food"],
        "payment_methods": ["UPI"],
        "organization_name": "Private household name",
        "secret": "must not be exposed",
    })

    result = asyncio.run(api_finance.get_settings(collaborator))

    assert result == {
        "currency": "INR",
        "timezone": "Asia/Kolkata",
        "date_format": "DD-MM-YYYY",
        "income_categories": ["Salary"],
        "expense_categories": ["Food"],
        "payment_methods": ["UPI"],
    }
    assert len(settings_collection.documents) == 1


def test_household_collaborators_cannot_permanently_delete_transactions(sharing_setup):
    _, collaborator, _, _, _ = sharing_setup

    with pytest.raises(HTTPException) as error:
        asyncio.run(api_finance.delete_transaction(str(ObjectId()), collaborator))

    assert error.value.status_code == 403


@pytest.mark.parametrize("role", ["SUPER_ADMIN", "PROJECT_ADMIN"])
def test_household_collaborator_cannot_be_promoted_to_admin(role, monkeypatch):
    platform_admin = {"_id": ObjectId(), "role": "SUPER_ADMIN", "is_platform_admin": True}
    collaborator = {"_id": ObjectId(), "role": "HOUSEHOLD_USER"}
    users = FakeCollection([platform_admin, collaborator])
    monkeypatch.setattr(api_admin, "raw_db", SimpleNamespace(users=users))

    with pytest.raises(HTTPException) as error:
        asyncio.run(api_admin.update_user(
            str(collaborator["_id"]),
            {"role": role},
            platform_admin,
        ))

    assert error.value.status_code == 403
    assert collaborator["role"] == "HOUSEHOLD_USER"
