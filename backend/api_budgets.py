"""Monthly category budgets, derived from the posted transaction ledger."""
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pymongo.errors import DuplicateKeyError

from core import db, now_utc, require_admin, round2, serialize, oid, log_audit

router = APIRouter(tags=["budgets"])
MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


class BudgetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    month: str
    category: str = Field(min_length=1, max_length=120)
    amount: float = Field(ge=0, allow_inf_nan=False)
    budget_type: str = "MONTHLY"
    rollover: bool = False
    notes: str = Field(default="", max_length=500)

    @field_validator("month")
    @classmethod
    def validate_month(cls, value):
        if not MONTH_PATTERN.fullmatch(value):
            raise ValueError("Month must use YYYY-MM format")
        return value

    @field_validator("category")
    @classmethod
    def clean_category(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Category is required")
        return value

    @field_validator("amount", mode="before")
    @classmethod
    def reject_boolean_amount(cls, value):
        if isinstance(value, bool):
            raise ValueError("Budget amount must be a number")
        return value

    @field_validator("budget_type")
    @classmethod
    def validate_type(cls, value):
        value = value.strip().upper()
        if value not in {"MONTHLY", "SINKING"}:
            raise ValueError("Budget type must be MONTHLY or SINKING")
        return value


async def budget_overview(month: str):
    """Combine saved plan amounts with posted and pending expense records."""
    if not MONTH_PATTERN.fullmatch(month):
        raise HTTPException(status_code=422, detail="Month must use YYYY-MM format")

    start = f"{month}-01"
    year, month_number = map(int, month.split("-"))
    if month_number == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month_number + 1:02d}-01"

    plans = await db.budgets.find({"month": month}).sort([("category", 1)]).to_list(1000)
    transactions = await db.transactions.find({
        "type": "EXPENSE",
        "scope": {"$ne": "PROJECT"},
        "project_id": {"$in": [None, ""]},
        "date": {"$gte": start, "$lt": end},
        "deleted_at": {"$exists": False},
    }).to_list(20000)

    saved = {}
    for plan in plans:
        key = plan.get("category", "").strip().casefold()
        if key in saved:
            raise HTTPException(status_code=409, detail=f"Duplicate budget category for {month}: {plan.get('category')}")
        saved[key] = plan

    actual = {}
    pending = {}
    labels = {}
    previous_month = f"{year - 1}-12" if month_number == 1 else f"{year}-{month_number - 1:02d}"
    previous_plans = await db.budgets.find({"month": previous_month, "rollover": True}).to_list(1000)
    previous_categories = {item.get("category", "").strip().casefold(): item for item in previous_plans}
    previous_actual = {}
    if previous_categories:
        previous_start = f"{previous_month}-01"
        previous_end = f"{month}-01"
        for transaction in await db.transactions.find({
            "type": "EXPENSE",
            "scope": {"$ne": "PROJECT"},
            "project_id": {"$in": [None, ""]},
            "date": {"$gte": previous_start, "$lt": previous_end},
            "deleted_at": {"$exists": False},
            "transaction_status": {"$nin": ["PENDING", "VOID"]},
        }).to_list(20000):
            category_key = (transaction.get("category") or "Uncategorized").strip().casefold()
            previous_actual[category_key] = round2(previous_actual.get(category_key, 0) + round2(transaction.get("amount", 0)))

    for transaction in transactions:
        category = (transaction.get("category") or "Uncategorized").strip()
        key = category.casefold()
        amount = round2(transaction.get("amount", 0))
        labels.setdefault(key, category)
        if transaction.get("transaction_status") == "PENDING":
            pending[key] = round2(pending.get(key, 0) + amount)
        elif transaction.get("transaction_status") != "VOID":
            actual[key] = round2(actual.get(key, 0) + amount)

    keys = set(saved) | set(actual) | set(pending)
    items = []
    for key in sorted(keys, key=lambda item: labels.get(item, saved.get(item, {}).get("category", item)).casefold()):
        plan = saved.get(key, {})
        planned = round2(plan.get("amount", 0))
        prior_plan = previous_categories.get(key, {})
        carryover = round2(max(round2(prior_plan.get("amount", 0)) - previous_actual.get(key, 0), 0)) if plan.get("rollover") and prior_plan else 0
        available = round2(planned + carryover)
        spent = round2(actual.get(key, 0))
        pending_amount = round2(pending.get(key, 0))
        items.append({
            **(serialize(plan) if plan else {}),
            "category": plan.get("category") or labels.get(key, "Uncategorized"),
            "month": month,
            "amount": planned,
            "carryover": carryover,
            "available": available,
            "actual": spent,
            "pending": pending_amount,
            "remaining": round2(available - spent),
            "percent_used": round2(spent / available * 100) if available else None,
            "unplanned": key not in saved,
            "budget_type": plan.get("budget_type", "MONTHLY"),
            "rollover": bool(plan.get("rollover", False)),
        })

    planned_total = round2(sum(item["amount"] for item in items))
    available_total = round2(sum(item["available"] for item in items))
    actual_total = round2(sum(item["actual"] for item in items))
    pending_total = round2(sum(item["pending"] for item in items))
    return {
        "month": month,
        "items": items,
        "planned_total": planned_total,
        "available_total": available_total,
        "actual_total": actual_total,
        "pending_total": pending_total,
        "remaining_total": round2(available_total - actual_total),
        "unplanned_total": round2(sum(item["actual"] for item in items if item["unplanned"])),
    }


@router.get("/budgets")
async def get_budgets(month: str | None = None, user: dict = Depends(require_admin)):
    requested_month = month or now_utc().strftime("%Y-%m")
    return await budget_overview(requested_month)


@router.post("/budgets")
async def save_budget(payload: BudgetInput, user: dict = Depends(require_admin)):
    canonical_key = {"month": payload.month, "category_key": payload.category.casefold()}
    now = now_utc()
    values = payload.model_dump()
    values["amount"] = round2(values["amount"])
    values["category_key"] = payload.category.casefold()
    values["updated_at"] = now
    values["updated_by"] = user.get("email")
    existing = await db.budgets.find_one(canonical_key)
    if existing:
        await db.budgets.update_one({"_id": existing["_id"]}, {"$set": values})
        budget_id = existing["_id"]
        action = "update"
    else:
        values.update({"created_at": now, "created_by": user.get("email")})
        try:
            result = await db.budgets.insert_one(values)
            budget_id = result.inserted_id
            action = "create"
        except DuplicateKeyError:
            raise HTTPException(status_code=409, detail="This category already has a budget for the selected month")

    await log_audit(user, f"{action}_budget", "budgets", str(budget_id), {"month": payload.month, "category": payload.category})
    return await budget_overview(payload.month)


@router.delete("/budgets/{budget_id}")
async def delete_budget(budget_id: str, user: dict = Depends(require_admin)):
    existing = await db.budgets.find_one({"_id": oid(budget_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Budget not found")
    await db.budgets.delete_one({"_id": existing["_id"]})
    await log_audit(user, "delete_budget", "budgets", budget_id, {"month": existing.get("month"), "category": existing.get("category")})
    return {"status": "deleted", "id": budget_id, "month": existing.get("month")}
