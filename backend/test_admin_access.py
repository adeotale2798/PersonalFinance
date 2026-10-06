import asyncio
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException

import api_admin


class FakeUsers:
    def __init__(self, user):
        self.user = user
        self.updates = []

    async def find_one(self, query):
        return self.user if query.get("_id") == self.user["_id"] else None

    async def update_one(self, query, update):
        self.updates.append((query, update))
        self.user.update(update["$set"])


def test_workspace_admin_cannot_promote_user_to_workspace_owner(monkeypatch):
    user_id = ObjectId()
    users = FakeUsers({"_id": user_id, "name": "Project member", "role": "PARTY_USER"})
    monkeypatch.setattr(api_admin, "db", SimpleNamespace(users=users))

    with pytest.raises(HTTPException) as error:
        asyncio.run(api_admin.update_user(
            str(user_id),
            {"role": "SUPER_ADMIN"},
            {"_id": ObjectId(), "role": "PROJECT_ADMIN"},
        ))

    assert error.value.status_code == 403
    assert users.updates == []
    assert users.user["role"] == "PARTY_USER"


def test_workspace_admin_cannot_create_workspace_owner():
    with pytest.raises(HTTPException) as error:
        asyncio.run(api_admin.create_user(
            {"name": "New owner", "role": "SUPER_ADMIN"},
            {"_id": ObjectId(), "role": "PROJECT_ADMIN"},
        ))

    assert error.value.status_code == 403


def test_create_user_rejects_unknown_roles_before_database_access():
    with pytest.raises(HTTPException) as error:
        asyncio.run(api_admin.create_user(
            {"name": "New user", "role": "ROOT"},
            {"_id": ObjectId(), "is_platform_admin": True},
        ))

    assert error.value.status_code == 400


@pytest.mark.parametrize("role", ["OWNER", "ADMIN", "", None])
def test_update_user_rejects_unknown_roles_before_database_access(role):
    with pytest.raises(HTTPException) as error:
        asyncio.run(api_admin.update_user(
            str(ObjectId()),
            {"role": role},
            {"_id": ObjectId(), "is_platform_admin": True},
        ))

    assert error.value.status_code == 400
