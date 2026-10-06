import asyncio
from datetime import date, timedelta

import pytest
from bson import ObjectId
from pydantic import ValidationError

import api_recurring


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, fields):
        for key, direction in reversed(fields):
            self.documents.sort(key=lambda document: document.get(key, ""), reverse=direction < 0)
        return self

    async def to_list(self, length):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=()):
        self.documents = list(documents)
        self.inserted = []

    @staticmethod
    def _matches(document, query):
        for key, expected in query.items():
            if isinstance(expected, dict) and "$exists" in expected:
                if (key in document) != expected["$exists"]:
                    return False
            elif document.get(key) != expected:
                return False
        return True

    async def find_one(self, query):
        return next((document for document in self.documents if self._matches(document, query)), None)

    def find(self, query):
        return FakeCursor(document for document in self.documents if self._matches(document, query))

    async def insert_one(self, document):
        stored = dict(document, _id=ObjectId())
        self.documents.append(stored)
        self.inserted.append(stored)
        return type("InsertResult", (), {"inserted_id": stored["_id"]})()

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if document:
            document.update(update["$set"])


class FakeDatabase:
    def __init__(self, **collections):
        self.collections = collections

    def __getattr__(self, name):
        return self.collections[name]


def test_recurring_input_rejects_invalid_financial_and_date_values():
    account_id = str(ObjectId())
    base = {
        "name": "Stream",
        "cadence": "monthly",
        "amount": 15.99,
        "category": "Entertainment",
        "account_id": account_id,
        "next_due_date": "2026-10-25",
    }
    assert api_recurring.RecurringInput(**base).cadence == "MONTHLY"
    with pytest.raises(ValidationError):
        api_recurring.RecurringInput(**{**base, "amount": True})
    with pytest.raises(ValidationError):
        api_recurring.RecurringInput(**{**base, "next_due_date": "25-10-2026"})
    with pytest.raises(ValidationError):
        api_recurring.RecurringInput(**{**base, "status": "deleted"})


def test_monthly_projection_clamps_month_end_and_never_projects_paused_items():
    schedule = {
        "status": "active",
        "cadence": "MONTHLY",
        "amount": 12.5,
        "next_due_date": "2024-01-31",
    }
    projected = api_recurring.project_occurrences(schedule, date(2024, 1, 1), 120)
    assert [item["due_date"] for item in projected] == ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]
    assert all(item["projected"] for item in projected)
    assert api_recurring.project_occurrences({**schedule, "status": "paused"}, date(2024, 1, 1)) == []


def test_usage_signal_uses_only_explicit_dated_posted_evidence():
    today = date(2026, 10, 6)
    schedule = {"status": "active", "last_used_date": None}
    assert not api_recurring.usage_signal(schedule, [], today)["possibly_unused"]
    assert not api_recurring.usage_signal(schedule, [
        {"transaction_status": "PENDING", "date": (today - timedelta(days=200)).isoformat()},
        {"transaction_status": "POSTED", "date": "not-a-date"},
    ], today)["possibly_unused"]
    signal = api_recurring.usage_signal(schedule, [
        {"transaction_status": "POSTED", "date": (today - timedelta(days=91)).isoformat()},
    ], today)
    assert signal["possibly_unused"] is True
    assert signal["threshold_days"] == 90
    assert signal["source"] == "posted_transaction"


def test_create_audits_schedule_and_overview_keeps_projections_off_ledger(monkeypatch):
    account_id = ObjectId()
    schedule_id = ObjectId()
    today = date(2026, 10, 6)
    schedule = {
        "_id": schedule_id,
        "name": "Music",
        "cadence": "MONTHLY",
        "amount": 9.99,
        "category": "Entertainment",
        "account_id": str(account_id),
        "next_due_date": (today + timedelta(days=8)).isoformat(),
        "status": "active",
        "last_used_date": (today - timedelta(days=100)).isoformat(),
        "price_history": [{"from_amount": 8.99, "to_amount": 9.99, "change_type": "increase", "changed_on": today.isoformat()}],
    }
    accounts = FakeCollection([{"_id": account_id, "name": "Checking"}])
    schedules = FakeCollection([schedule])
    transactions = FakeCollection([{
        "recurring_id": str(schedule_id),
        "type": "EXPENSE",
        "transaction_status": "POSTED",
        "date": (today - timedelta(days=100)).isoformat(),
    }])
    monkeypatch.setattr(api_recurring, "db", FakeDatabase(
        accounts=accounts, recurring_schedules=schedules, transactions=transactions,
    ))
    audits = []

    async def capture_audit(*args, **kwargs):
        audits.append((args, kwargs))

    monkeypatch.setattr(api_recurring, "log_audit", capture_audit)
    payload = api_recurring.RecurringInput(
        name="Cloud storage", cadence="monthly", amount=2.99, category="Utilities",
        account_id=str(account_id), next_due_date="2026-11-01",
    )
    user = {"_id": ObjectId(), "email": "owner@example.test"}
    created = asyncio.run(api_recurring.create_recurring(payload, user))
    assert created["name"] == "Cloud storage"
    assert audits and audits[0][0][1] == "create_recurring_schedule"
    assert len(schedules.inserted) == 1
    assert transactions.inserted == []
    revised = api_recurring.RecurringInput(
        name="Cloud storage", cadence="monthly", amount=3.99, category="Utilities",
        account_id=str(account_id), next_due_date="2026-11-01",
    )
    updated = asyncio.run(api_recurring.update_recurring(created["id"], revised, user))
    assert updated["price_history"] == [{
        "from_amount": 2.99,
        "to_amount": 3.99,
        "change_type": "increase",
        "changed_on": today.isoformat(),
    }]
    assert audits[1][0][1] == "update_recurring_schedule"

    overview = asyncio.run(api_recurring.recurring_overview(today))
    item = overview["items"][0]
    assert item["usage_signal"]["possibly_unused"]
    assert item["price_signal"]["change_type"] == "increase"
    assert overview["renewal_alerts"][0]["days_until_due"] == 8
    assert item["projected_occurrences"][0]["projected"]
    assert transactions.inserted == []


def test_record_payment_creates_posted_ledger_row_and_advances_schedule(monkeypatch):
    account_id = ObjectId()
    schedule_id = ObjectId()
    schedule = {
        "_id": schedule_id,
        "name": "Internet",
        "cadence": "MONTHLY",
        "amount": 80,
        "category": "Utilities",
        "account_id": str(account_id),
        "next_due_date": "2026-10-01",
        "status": "active",
        "last_used_date": None,
    }
    schedules = FakeCollection([schedule])
    transactions = FakeCollection()
    monkeypatch.setattr(api_recurring, "db", FakeDatabase(
        accounts=FakeCollection([{"_id": account_id, "name": "Checking"}]),
        recurring_schedules=schedules,
        transactions=transactions,
    ))
    audits = []

    async def capture_audit(*args, **kwargs):
        audits.append((args, kwargs))

    monkeypatch.setattr(api_recurring, "log_audit", capture_audit)
    payload = api_recurring.RecurringPaymentInput(date="2026-10-06", amount=82)
    user = {"_id": ObjectId(), "email": "owner@example.test"}
    result = asyncio.run(api_recurring.record_recurring_payment(str(schedule_id), payload, user))

    assert result["transaction"]["type"] == "EXPENSE"
    assert result["transaction"]["transaction_status"] == "POSTED"
    assert result["transaction"]["amount"] == 82
    assert result["transaction"]["recurring_id"] == str(schedule_id)
    assert result["schedule"]["next_due_date"] == "2026-11-01"
    assert result["schedule"]["last_used_date"] == "2026-10-06"
    assert len(transactions.inserted) == 1
    assert audits and audits[0][0][1] == "record_recurring_payment"
