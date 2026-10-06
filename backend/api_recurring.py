"""Recurring bill and subscription schedules; projected dates never post ledger entries."""
from calendar import monthrange
from datetime import date, timedelta
from math import isfinite

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core import db, log_audit, now_utc, oid, require_admin, round2, serialize

router = APIRouter(tags=["recurring"])

CADENCES = {"WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"}
STATUSES = {"active", "paused", "cancelled"}
UNUSED_AFTER_DAYS = 90
RENEWAL_ALERT_DAYS = 30
PROJECTION_DAYS = 90


class RecurringInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    cadence: str
    amount: float = Field(gt=0, allow_inf_nan=False)
    category: str = Field(min_length=1, max_length=120)
    account_id: str = Field(min_length=1, max_length=64)
    next_due_date: str
    status: str = "active"
    last_used_date: str | None = None
    notes: str = Field(default="", max_length=500)

    @field_validator("name", "category")
    @classmethod
    def clean_required_text(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("cadence")
    @classmethod
    def validate_cadence(cls, value):
        value = value.strip().upper()
        if value not in CADENCES:
            raise ValueError("Cadence must be WEEKLY, MONTHLY, QUARTERLY or YEARLY")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        value = value.strip().lower()
        if value not in STATUSES:
            raise ValueError("Status must be active, paused or cancelled")
        return value

    @field_validator("amount", mode="before")
    @classmethod
    def reject_boolean_amount(cls, value):
        if isinstance(value, bool):
            raise ValueError("Amount must be a number")
        return value

    @field_validator("next_due_date", "last_used_date")
    @classmethod
    def validate_iso_date(cls, value):
        if value is None:
            return value
        try:
            parsed = date.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError("Date must use YYYY-MM-DD format")
        if parsed.isoformat() != value:
            raise ValueError("Date must use YYYY-MM-DD format")
        return value

    @field_validator("account_id")
    @classmethod
    def validate_account_id(cls, value):
        value = value.strip()
        if not ObjectId.is_valid(value):
            raise ValueError("Choose a valid account")
        return value


class RecurringStatusInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value):
        value = value.strip().lower()
        if value not in STATUSES:
            raise ValueError("Status must be active, paused or cancelled")
        return value


class RecurringPaymentInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str
    amount: float | None = Field(default=None, gt=0, allow_inf_nan=False)

    @field_validator("date")
    @classmethod
    def validate_payment_date(cls, value):
        try:
            parsed = date.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError("Date must use YYYY-MM-DD format")
        if parsed.isoformat() != value:
            raise ValueError("Date must use YYYY-MM-DD format")
        if parsed > now_utc().date():
            raise ValueError("A payment date cannot be in the future")
        return value


def advance_due_date(due_date: date, cadence: str, anchor_day: int | None = None) -> date:
    """Advance a due date once, clamping month-end dates (e.g. Jan 31 to Feb 28)."""
    cadence = cadence.upper()
    if cadence == "WEEKLY":
        return due_date + timedelta(days=7)
    months = {"MONTHLY": 1, "QUARTERLY": 3, "YEARLY": 12}.get(cadence)
    if months is None:
        raise ValueError(f"Unsupported cadence: {cadence}")
    month_index = due_date.year * 12 + due_date.month - 1 + months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    return date(year, month, min(anchor_day or due_date.day, monthrange(year, month)[1]))


def project_occurrences(schedule: dict, today: date, horizon_days: int = PROJECTION_DAYS) -> list[dict]:
    """Return display-only occurrences; this function never writes to transactions."""
    if schedule.get("status") != "active":
        return []
    due = date.fromisoformat(schedule["next_due_date"])
    anchor_day = due.day
    limit = today + timedelta(days=horizon_days)
    occurrences = []
    while due < today:
        due = advance_due_date(due, schedule["cadence"], anchor_day)
    while due <= limit:
        occurrences.append({"due_date": due.isoformat(), "amount": round2(schedule["amount"]), "projected": True})
        due = advance_due_date(due, schedule["cadence"], anchor_day)
    return occurrences


def _explicit_paid_transaction_date(transaction: dict, today: date) -> date | None:
    """Only POSTED, linked ledger records with a valid explicit date count as paid use."""
    if transaction.get("transaction_status") != "POSTED" or transaction.get("deleted_at"):
        return None
    raw_date = transaction.get("date")
    if not isinstance(raw_date, str):
        return None
    try:
        parsed = date.fromisoformat(raw_date)
    except ValueError:
        return None
    if parsed.isoformat() != raw_date or parsed > today:
        return None
    return parsed


def usage_signal(schedule: dict, paid_transactions: list[dict], today: date) -> dict:
    """Be intentionally conservative: no dated evidence means usage is unknown, not unused."""
    candidates = []
    manual_date = schedule.get("last_used_date")
    if manual_date:
        try:
            parsed = date.fromisoformat(manual_date)
            if parsed.isoformat() == manual_date and parsed <= today:
                candidates.append((parsed, "last_used_date"))
        except (TypeError, ValueError):
            pass
    for transaction in paid_transactions:
        paid_date = _explicit_paid_transaction_date(transaction, today)
        if paid_date:
            candidates.append((paid_date, "posted_transaction"))
    if not candidates:
        return {
            "possibly_unused": False,
            "last_used_date": None,
            "days_since_use": None,
            "threshold_days": UNUSED_AFTER_DAYS,
            "explanation": "Unknown: no explicitly dated last-used entry or linked posted payment is recorded.",
        }
    last_used, source = max(candidates, key=lambda candidate: candidate[0])
    elapsed = (today - last_used).days
    flagged = schedule.get("status") == "active" and elapsed >= UNUSED_AFTER_DAYS
    return {
        "possibly_unused": flagged,
        "last_used_date": last_used.isoformat(),
        "days_since_use": elapsed,
        "source": source,
        "threshold_days": UNUSED_AFTER_DAYS,
        "explanation": (
            f"No recorded use in {elapsed} days (threshold: {UNUSED_AFTER_DAYS} days); review before the next renewal."
            if flagged
            else f"Last recorded use was {elapsed} days ago; the review threshold is {UNUSED_AFTER_DAYS} days."
        ),
    }


async def _account_for_schedule(account_id: str):
    account = await db.accounts.find_one({"_id": oid(account_id), "deleted_at": {"$exists": False}})
    if not account:
        raise HTTPException(status_code=422, detail="Choose an active account in this workspace")
    return account


async def recurring_overview(today: date | None = None) -> dict:
    """Assemble active projections and signals from dated, linked ledger evidence."""
    today = today or now_utc().date()
    docs = await db.recurring_schedules.find({}).sort([("next_due_date", 1), ("name", 1)]).to_list(2000)
    items, alerts = [], []
    cutoff = today + timedelta(days=RENEWAL_ALERT_DAYS)
    for doc in docs:
        item = serialize(doc)
        linked_transactions = await db.transactions.find({
            "recurring_id": item["id"],
            "type": "EXPENSE",
            "deleted_at": {"$exists": False},
        }).to_list(5000)
        item["usage_signal"] = usage_signal(doc, linked_transactions, today)
        item["projected_occurrences"] = project_occurrences(doc, today)
        amount_history = doc.get("price_history", [])
        item["price_signal"] = None
        if amount_history and amount_history[-1].get("change_type") == "increase":
            latest = amount_history[-1]
            item["price_signal"] = {
                "change_type": "increase",
                "from_amount": latest["from_amount"],
                "to_amount": latest["to_amount"],
                "changed_on": latest["changed_on"],
                "explanation": "The saved amount increased; confirm the new price before renewal.",
            }
        if doc.get("status") == "active":
            next_due = date.fromisoformat(doc["next_due_date"])
            if next_due <= cutoff:
                days_until = (next_due - today).days
                alerts.append({
                    "schedule_id": item["id"],
                    "name": doc["name"],
                    "due_date": next_due.isoformat(),
                    "amount": round2(doc["amount"]),
                    "days_until_due": days_until,
                    "message": "Overdue" if days_until < 0 else ("Due today" if days_until == 0 else f"Renews in {days_until} days"),
                })
        items.append(item)
    alerts.sort(key=lambda alert: alert["due_date"])
    return {
        "items": items,
        "renewal_alerts": alerts,
        "projection_horizon_days": PROJECTION_DAYS,
        "unused_threshold_days": UNUSED_AFTER_DAYS,
    }


@router.get("/recurring", dependencies=[Depends(require_admin)])
async def list_recurring():
    return await recurring_overview()


@router.post("/recurring")
async def create_recurring(payload: RecurringInput, user: dict = Depends(require_admin)):
    values = payload.model_dump()
    await _account_for_schedule(values["account_id"])
    if values["last_used_date"] and date.fromisoformat(values["last_used_date"]) > now_utc().date():
        raise HTTPException(status_code=422, detail="Last-used date cannot be in the future")
    if not isfinite(values["amount"]):
        raise HTTPException(status_code=422, detail="Amount must be finite")
    now = now_utc()
    values.update({
        "amount": round2(values["amount"]),
        "price_history": [],
        "created_at": now,
        "created_by": user.get("email"),
        "updated_at": now,
        "updated_by": user.get("email"),
    })
    result = await db.recurring_schedules.insert_one(values)
    await log_audit(user, "create_recurring_schedule", "recurring_schedules", str(result.inserted_id), {
        "name": values["name"], "amount": values["amount"], "cadence": values["cadence"],
    })
    return serialize(await db.recurring_schedules.find_one({"_id": result.inserted_id}))


@router.put("/recurring/{schedule_id}")
async def update_recurring(schedule_id: str, payload: RecurringInput, user: dict = Depends(require_admin)):
    schedule_oid = oid(schedule_id)
    existing = await db.recurring_schedules.find_one({"_id": schedule_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")
    values = payload.model_dump()
    await _account_for_schedule(values["account_id"])
    if values["last_used_date"] and date.fromisoformat(values["last_used_date"]) > now_utc().date():
        raise HTTPException(status_code=422, detail="Last-used date cannot be in the future")
    if not isfinite(values["amount"]):
        raise HTTPException(status_code=422, detail="Amount must be finite")
    history = list(existing.get("price_history", []))
    new_amount = round2(values["amount"])
    old_amount = round2(existing.get("amount", 0))
    if new_amount != old_amount:
        history.append({
            "from_amount": old_amount,
            "to_amount": new_amount,
            "change_type": "increase" if new_amount > old_amount else "decrease",
            "changed_on": now_utc().date().isoformat(),
        })
    values.update({
        "amount": new_amount,
        "price_history": history,
        "updated_at": now_utc(),
        "updated_by": user.get("email"),
    })
    await db.recurring_schedules.update_one({"_id": schedule_oid}, {"$set": values})
    await log_audit(user, "update_recurring_schedule", "recurring_schedules", schedule_id, {
        "price_changed": new_amount != old_amount, "status": values["status"],
    })
    return serialize(await db.recurring_schedules.find_one({"_id": schedule_oid}))


@router.patch("/recurring/{schedule_id}/status")
async def set_recurring_status(schedule_id: str, payload: RecurringStatusInput, user: dict = Depends(require_admin)):
    schedule_oid = oid(schedule_id)
    existing = await db.recurring_schedules.find_one({"_id": schedule_oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")
    await db.recurring_schedules.update_one({"_id": schedule_oid}, {"$set": {
        "status": payload.status,
        "updated_at": now_utc(),
        "updated_by": user.get("email"),
    }})
    await log_audit(user, f"{payload.status}_recurring_schedule", "recurring_schedules", schedule_id, {
        "previous_status": existing.get("status"), "status": payload.status,
    })
    return serialize(await db.recurring_schedules.find_one({"_id": schedule_oid}))


@router.post("/recurring/{schedule_id}/record-payment")
async def record_recurring_payment(schedule_id: str, payload: RecurringPaymentInput, user: dict = Depends(require_admin)):
    schedule_oid = oid(schedule_id)
    schedule = await db.recurring_schedules.find_one({"_id": schedule_oid})
    if not schedule:
        raise HTTPException(status_code=404, detail="Recurring schedule not found")
    if schedule.get("status") != "active":
        raise HTTPException(status_code=409, detail="Resume this recurring item before recording a payment")
    account_id = schedule.get("account_id")
    await _account_for_schedule(account_id)
    amount = round2(payload.amount if payload.amount is not None else schedule.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=422, detail="Payment amount must be greater than zero")
    payment_date = date.fromisoformat(payload.date)
    try:
        next_due = date.fromisoformat(schedule["next_due_date"])
        anchor_day = next_due.day
        cadence = schedule["cadence"]
        while next_due <= payment_date:
            next_due = advance_due_date(next_due, cadence, anchor_day)
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail="Recurring schedule has an invalid cadence or next due date") from exc

    now = now_utc()
    transaction = {
        "type": "EXPENSE",
        "date": payload.date,
        "amount": amount,
        "category": schedule["category"],
        "account_id": account_id,
        "payment_mode": schedule.get("payment_mode"),
        "description": f"{schedule['name']} recurring payment",
        "scope": "PERSONAL",
        "transaction_status": "POSTED",
        "record_source": "MANUAL",
        "recurring_id": schedule_id,
        "created_at": now,
        "created_by": user.get("email"),
    }
    result = await db.transactions.insert_one(transaction)
    last_used = max(filter(None, [schedule.get("last_used_date"), payload.date]))
    await db.recurring_schedules.update_one({"_id": schedule_oid}, {"$set": {
        "last_used_date": last_used,
        "next_due_date": next_due.isoformat(),
        "updated_at": now,
        "updated_by": user.get("email"),
    }})
    await log_audit(user, "record_recurring_payment", "transactions", str(result.inserted_id), {
        "schedule_id": schedule_id, "amount": amount, "date": payload.date,
    })
    return {
        "transaction": serialize(await db.transactions.find_one({"_id": result.inserted_id})),
        "schedule": serialize(await db.recurring_schedules.find_one({"_id": schedule_oid})),
    }
