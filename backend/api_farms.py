"""Farms & farming ledger (per-farm income/expense and annual leases)."""
from collections import defaultdict
from datetime import date
from calendar import monthrange
from fastapi import APIRouter, Depends
from core import db, serialize, oid, now_utc, require_admin, round2, validate_balance_sheet_asset_link
from crud import make_crud_router
from pymongo.errors import DuplicateKeyError

router = APIRouter(tags=["farms"])


async def _prepare_farm(payload, _existing):
    if "balance_sheet_asset_id" in payload:
        payload["balance_sheet_asset_id"] = await validate_balance_sheet_asset_link(payload["balance_sheet_asset_id"])
    return payload


crud, coll = make_crud_router("farms", "farms", pre_save=_prepare_farm)


def _annual_rent(farm: dict, due_year: int) -> float:
    base = round2(farm.get("annual_rent", 0))
    try:
        start = date.fromisoformat((farm.get("lease_start_date") or f"{due_year}-01-01")[:10])
    except ValueError:
        start = date(due_year, 1, 1)
    increases = max(0, due_year - start.year)
    return round2(base * ((1 + max(round2(farm.get("annual_increase_percent", 0)), 0) / 100) ** increases))


async def ensure_annual_farm_rent_payments():
    """Create one pending rent due each year for every enabled farm lease."""
    today = now_utc().date()
    farms = await coll.find({"deleted_at": {"$exists": False}}).to_list(500)
    for farm in farms:
        if farm.get("annual_rent_enabled") not in (True, "true", "TRUE", 1):
            continue
        try:
            start = date.fromisoformat((farm.get("lease_start_date") or today.isoformat())[:10])
        except ValueError:
            start = today
        for year in range(start.year, today.year + 1):
            period = str(year)
            exists = await db.farm_rent_payments.find_one({"farm_id": str(farm["_id"]), "period": period})
            if exists:
                continue
            due_raw = farm.get("annual_rent_due_date") or f"{year}-{start.month:02d}-{start.day:02d}"
            try:
                template = date.fromisoformat(due_raw[:10])
                due = date(year, template.month, min(template.day, monthrange(year, template.month)[1]))
            except ValueError:
                due = date(year, start.month, min(start.day, monthrange(year, start.month)[1]))
            payment = {
                "farm_id": str(farm["_id"]), "farm_name": farm.get("name", ""), "tenant": farm.get("tenant", ""),
                "period": period, "due_date": due.isoformat(), "amount_due": _annual_rent(farm, year),
                "amount_received": 0, "status": "PENDING", "recurring_generated": True, "created_at": now_utc(),
            }
            try:
                await db.farm_rent_payments.insert_one(payment)
            except DuplicateKeyError:
                if not await db.farm_rent_payments.find_one({
                    "farm_id": str(farm["_id"]),
                    "period": period,
                    "recurring_generated": True,
                }):
                    raise


@router.get("/farms/rent-payments")
async def list_farm_rent_payments(user: dict = Depends(require_admin)):
    await ensure_annual_farm_rent_payments()
    docs = await db.farm_rent_payments.find({"deleted_at": {"$exists": False}}).sort([("period", -1)]).to_list(2000)
    return [serialize(d) for d in docs]


@router.post("/farms/rent-payments/{item_id}/receive")
async def receive_farm_rent(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payment = await db.farm_rent_payments.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not payment:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Farm rent payment not found")
    received = round2(payload.get("amount_received", payload.get("amount", 0)))
    if received <= 0:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Received amount must be greater than zero")
    total = round2(payment.get("amount_received", 0) + received)
    due = round2(payment.get("amount_due", 0))
    if total > due + 0.009:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding rent of {round2(due - payment.get('amount_received', 0)):.2f}")
    status = "COLLECTED" if total >= due else "PARTIAL" if total > 0 else "PENDING"
    await db.farm_rent_payments.update_one({"_id": payment["_id"]}, {"$set": {"amount_received": total, "status": status, "updated_at": now_utc()}})
    return serialize(await db.farm_rent_payments.find_one({"_id": payment["_id"]}))


@router.get("/farms/summary")
async def farms_summary(user: dict = Depends(require_admin)):
    await ensure_annual_farm_rent_payments()
    farms = [serialize(d) for d in await coll.find({"deleted_at": {"$exists": False}}).to_list(500)]
    txns = await db.transactions.find({"scope": "FARM", "deleted_at": {"$exists": False}}).to_list(20000)
    inc_by_farm = defaultdict(float)
    exp_by_farm = defaultdict(float)
    monthly = defaultdict(lambda: {"in": 0.0, "out": 0.0})
    total_in = total_out = 0.0
    for t in txns:
        amt = round2(t.get("amount", 0))
        fid = t.get("farm_id")
        mk = (t.get("date") or "")[:7]
        if t.get("type") == "INCOME":
            inc_by_farm[fid] += amt; total_in += amt
            if mk: monthly[mk]["in"] += amt
        elif t.get("type") == "EXPENSE":
            exp_by_farm[fid] += amt; total_out += amt
            if mk: monthly[mk]["out"] += amt
    per_farm = []
    for f in farms:
        inc = round2(inc_by_farm.get(f["id"], 0))
        exp = round2(exp_by_farm.get(f["id"], 0))
        per_farm.append({**f, "income": inc, "expense": exp, "net": round2(inc - exp)})
    annual_payments = await db.farm_rent_payments.find({"deleted_at": {"$exists": False}, "period": str(now_utc().year)}).to_list(500)
    return {
        "total_income": round2(total_in),
        "total_expense": round2(total_out),
        "net": round2(total_in - total_out),
        "count": len(farms),
        "per_farm": per_farm,
        "monthly": [{"month": k, "in": round2(v["in"]), "out": round2(v["out"])} for k, v in sorted(monthly.items())],
        "annual_rent_due": round2(sum(p.get("amount_due", 0) for p in annual_payments)),
        "annual_rent_received": round2(sum(p.get("amount_received", 0) for p in annual_payments)),
    }


router.include_router(crud)
