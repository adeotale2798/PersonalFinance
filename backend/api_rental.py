"""Rental income: properties, units, tenants, rent collection."""
from collections import defaultdict
from datetime import date
from calendar import monthrange
from fastapi import APIRouter, Depends
from core import db, serialize, oid, now_utc, require_admin, round2, normalize_date, validate_balance_sheet_asset_link
from pymongo.errors import DuplicateKeyError

router = APIRouter(tags=["rental"])


def _month_cursor(start: date, end: date):
    """Yield first-of-month dates from start through end, inclusive."""
    current = date(start.year, start.month, 1)
    while current <= end:
        yield current
        current = date(current.year + (current.month == 12), (current.month % 12) + 1, 1)


def _escalated_rent(unit: dict, period: date) -> float:
    """Calculate rent for a month, applying the configured annual increment."""
    base = round2(unit.get("monthly_rent", 0))
    start_raw = unit.get("rent_start_date") or f"{period.year}-01-01"
    try:
        start = date.fromisoformat(start_raw[:10])
    except ValueError:
        start = period
    increase = max(round2(unit.get("annual_increase_percent", 0)), 0)
    anniversaries = max(0, (period.year - start.year) - (1 if period.month < start.month else 0))
    return round2(base * ((1 + increase / 100) ** anniversaries))


async def ensure_recurring_rent_payments():
    """Create missing monthly dues for recurring occupied units up to this month."""
    today = now_utc().date()
    props = await db.rental_properties.find({"deleted_at": {"$exists": False}}).to_list(1000)
    for prop in props:
        prop_id = str(prop["_id"])
        for index, unit in enumerate(prop.get("units", []) or []):
            # Existing units predate this setting; treat their monthly rent as recurring by default.
            if unit.get("recurring_enabled") is False or (unit.get("status") or "OCCUPIED") != "OCCUPIED":
                continue
            try:
                start = date.fromisoformat((unit.get("rent_start_date") or today.isoformat())[:10])
            except ValueError:
                start = today
            unit_key = str(unit.get("id") or unit.get("name") or index + 1)
            for period in _month_cursor(start, today):
                period_key = period.strftime("%Y-%m")
                exists = await db.rent_payments.find_one({
                    "property_id": prop_id, "unit_key": unit_key, "period": period_key,
                })
                if exists:
                    continue
                due_day = min(max(int(unit.get("rent_due_day", 1) or 1), 1), monthrange(period.year, period.month)[1])
                payment = {
                    "property_id": prop_id, "property_name": prop.get("name", ""),
                    "unit": unit.get("name") or f"Unit {index + 1}", "unit_key": unit_key,
                    "tenant": unit.get("tenant", ""), "period": period_key,
                    "due_date": date(period.year, period.month, due_day).isoformat(),
                    "amount_due": _escalated_rent(unit, period), "amount_received": 0,
                    "status": "PENDING", "recurring_generated": True, "created_at": now_utc(),
                }
                try:
                    await db.rent_payments.insert_one(payment)
                except DuplicateKeyError:
                    if not await db.rent_payments.find_one({
                        "property_id": prop_id,
                        "unit_key": unit_key,
                        "period": period_key,
                        "recurring_generated": True,
                    }):
                        raise


@router.get("/rental/properties")
async def list_properties(user: dict = Depends(require_admin)):
    docs = await db.rental_properties.find({"deleted_at": {"$exists": False}}).sort([("created_at", -1)]).to_list(1000)
    return [serialize(d) for d in docs]


@router.post("/rental/properties")
async def create_property(payload: dict, user: dict = Depends(require_admin)):
    if "balance_sheet_asset_id" in payload:
        payload["balance_sheet_asset_id"] = await validate_balance_sheet_asset_link(payload["balance_sheet_asset_id"])
    if payload.get("valuation_date"):
        payload["valuation_date"] = normalize_date(payload["valuation_date"])
    payload.setdefault("units", [])
    payload["created_at"] = now_utc()
    res = await db.rental_properties.insert_one(payload)
    return serialize(await db.rental_properties.find_one({"_id": res.inserted_id}))


@router.put("/rental/properties/{item_id}")
async def update_property(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    if "balance_sheet_asset_id" in payload:
        payload["balance_sheet_asset_id"] = await validate_balance_sheet_asset_link(payload["balance_sheet_asset_id"])
    if payload.get("valuation_date"):
        payload["valuation_date"] = normalize_date(payload["valuation_date"])
    payload["updated_at"] = now_utc()
    await db.rental_properties.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.rental_properties.find_one({"_id": oid(item_id)}))


@router.delete("/rental/properties/{item_id}")
async def delete_property(item_id: str, user: dict = Depends(require_admin)):
    await db.rental_properties.update_one({"_id": oid(item_id)}, {"$set": {"deleted_at": now_utc()}})
    return {"status": "deleted"}


@router.get("/rental/payments")
async def list_payments(property_id: str = None, status: str = None, user: dict = Depends(require_admin)):
    await ensure_recurring_rent_payments()
    q = {"deleted_at": {"$exists": False}}
    if property_id:
        q["property_id"] = property_id
    if status:
        q["status"] = status
    docs = await db.rent_payments.find(q).sort([("period", -1)]).to_list(5000)
    return [serialize(d) for d in docs]


@router.post("/rental/payments")
async def create_payment(payload: dict, user: dict = Depends(require_admin)):
    payload["amount_due"] = round2(payload.get("amount_due", 0))
    payload["amount_received"] = round2(payload.get("amount_received", 0))
    if payload.get("due_date"):
        payload["due_date"] = normalize_date(payload["due_date"])
    if payload["amount_received"] >= payload["amount_due"] and payload["amount_due"] > 0:
        payload.setdefault("status", "COLLECTED")
    elif payload["amount_received"] > 0:
        payload.setdefault("status", "PARTIAL")
    else:
        payload.setdefault("status", "PENDING")
    payload["created_at"] = now_utc()
    res = await db.rent_payments.insert_one(payload)
    return serialize(await db.rent_payments.find_one({"_id": res.inserted_id}))


@router.put("/rental/payments/{item_id}")
async def update_payment(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    if "amount_received" in payload:
        payload["amount_received"] = round2(payload["amount_received"])
    if "amount_due" in payload:
        payload["amount_due"] = round2(payload["amount_due"])
    if payload.get("due_date"):
        payload["due_date"] = normalize_date(payload["due_date"])
    if "amount_received" in payload or "amount_due" in payload:
        existing = await db.rent_payments.find_one({"_id": oid(item_id)})
        due = payload.get("amount_due", existing.get("amount_due", 0) if existing else 0)
        received = payload.get("amount_received", existing.get("amount_received", 0) if existing else 0)
        payload["status"] = "COLLECTED" if received >= due and due > 0 else "PARTIAL" if received > 0 else "PENDING"
    payload["updated_at"] = now_utc()
    await db.rent_payments.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.rent_payments.find_one({"_id": oid(item_id)}))


@router.post("/rental/payments/{item_id}/acknowledge")
async def acknowledge_rent_received(item_id: str, payload: dict = None, user: dict = Depends(require_admin)):
    """User acknowledgement is required before a recurring rent due becomes collected."""
    payment = await db.rent_payments.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not payment:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rent payment not found")
    payload = payload or {}
    remaining = max(round2(payment.get("amount_due", 0)) - round2(payment.get("amount_received", 0)), 0)
    amount = round2(payload.get("amount", remaining))
    if amount <= 0 or amount > remaining + 0.009:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Enter an amount up to the remaining rent of {remaining:.2f}")
    received = round2(payment.get("amount_received", 0) + amount)
    due = round2(payment.get("amount_due", 0))
    status = "COLLECTED" if received >= due else "PARTIAL"
    await db.rent_payments.update_one({"_id": payment["_id"]}, {"$set": {
        "amount_received": received, "status": status, "acknowledged_at": now_utc(),
        "acknowledged_by": user.get("email"), "updated_at": now_utc(),
    }})
    return serialize(await db.rent_payments.find_one({"_id": payment["_id"]}))


@router.delete("/rental/payments/{item_id}")
async def delete_payment(item_id: str, user: dict = Depends(require_admin)):
    await db.rent_payments.update_one({"_id": oid(item_id)}, {"$set": {"deleted_at": now_utc()}})
    return {"status": "deleted"}


@router.get("/rental/summary")
async def rental_summary(user: dict = Depends(require_admin)):
    await ensure_recurring_rent_payments()
    props = [serialize(d) for d in await db.rental_properties.find({"deleted_at": {"$exists": False}}).to_list(1000)]
    monthly_rent = 0.0
    for p in props:
        for u in p.get("units", []) or []:
            if (u.get("status") or "OCCUPIED") == "OCCUPIED":
                monthly_rent += _escalated_rent(u, now_utc().date())
    payments = [serialize(d) for d in await db.rent_payments.find({"deleted_at": {"$exists": False}}).to_list(5000)]
    this_month = now_utc().strftime("%Y-%m")
    collected = round2(sum(p.get("amount_received", 0) for p in payments if p.get("period") == this_month))
    expected = round2(sum(p.get("amount_due", 0) for p in payments if p.get("period") == this_month))
    outstanding = round2(sum(max(p.get("amount_due", 0) - p.get("amount_received", 0), 0) for p in payments))
    today = now_utc().date().isoformat()
    overdue = round2(sum(max(p.get("amount_due", 0) - p.get("amount_received", 0), 0)
                         for p in payments if p.get("due_date") and p.get("due_date") < today
                         and p.get("status") != "COLLECTED"))
    collection_rate = round2((collected / expected * 100) if expected > 0 else 0)
    trend = defaultdict(float)
    for p in payments:
        mk = p.get("period")
        if mk:
            trend[mk] += round2(p.get("amount_received", 0))
    by_property = defaultdict(float)
    for p in payments:
        by_property[p.get("property_name") or "Unknown"] += round2(p.get("amount_received", 0))
    return {
        "monthly_rent": round2(monthly_rent),
        "collected": collected,
        "expected": expected,
        "outstanding": outstanding,
        "overdue": overdue,
        "collection_rate": collection_rate,
        "properties": len(props),
        "income_trend": [{"month": k, "value": round2(v)} for k, v in sorted(trend.items())],
        "by_property": [{"name": k, "value": round2(v)} for k, v in by_property.items() if v > 0],
    }
