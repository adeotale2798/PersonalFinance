"""Wealth: savings, PF/PPF, assets, liabilities, investments, net worth."""
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from core import db, serialize, oid, now_utc, require_admin, round2, normalize_date, validate_financial_payload, log_audit
from api_finance import compute_account_balances
from crud import make_crud_router
from financial_services import net_worth_history, snapshot_net_worth

router = APIRouter(tags=["wealth"])

savings_router, savings_coll = make_crud_router("savings", "savings")


async def _protect_linked_asset_delete(item_id, _existing):
    for collection, label in (
        (db.rental_properties, "rental properties"),
        (db.farms, "farms"),
        (db.projects, "projects"),
    ):
        if await collection.find_one({
            "balance_sheet_asset_id": item_id,
            "deleted_at": {"$exists": False},
        }):
            raise HTTPException(
                status_code=409,
                detail=f"Unlink this asset from its {label} record before deleting it",
            )


assets_router, assets_coll = make_crud_router(
    "assets", "assets", before_delete=_protect_linked_asset_delete
)
liabilities_router, liab_coll = make_crud_router("liabilities", "liabilities")
investments_router, inv_coll = make_crud_router("investments", "investments")
pf_router, pf_coll = make_crud_router("pf-ppf", "pf_ppf")


def _sum(docs, field):
    return round2(sum(round2(d.get(field, 0)) for d in docs))


def _position(
    record,
    *,
    category,
    value,
    side="asset",
    owner_default="Self",
    source_default=None,
):
    ownership = record.get("ownership_percent")
    ownership = 100 if ownership is None else round2(ownership)
    gross_value = round2(value)
    return {
        "id": str(record.get("id") or record.get("_id") or ""),
        "name": record.get("name") or record.get("institution") or record.get("policy_name") or record.get("counterparty") or category,
        "category": category,
        "side": side,
        "owner": record.get("owner") or owner_default,
        "ownership_percent": ownership,
        "gross_value": abs(gross_value),
        "owned_value": round2(abs(gross_value) * ownership / 100),
        "source": record.get("valuation_source") or record.get("balance_source") or record.get("record_source") or source_default or "Not recorded",
        "as_of": str(record.get("valuation_date") or record.get("last_reconciled_at") or "")[:10] or None,
    }


@router.get("/savings/summary")
async def savings_summary(user: dict = Depends(require_admin)):
    docs = await savings_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)
    docs = [serialize(d) for d in docs]
    total = _sum(docs, "current_value")
    by_type = defaultdict(float)
    for d in docs:
        by_type[d.get("type") or "Other"] += round2(d.get("current_value", 0))
    # contribution trend
    trend = defaultdict(float)
    for d in docs:
        for c in d.get("contributions", []) or []:
            mk = (c.get("date") or "")[:7]
            if mk:
                trend[mk] += round2(c.get("amount", 0))
    return {
        "total": total,
        "count": len(docs),
        "by_type": [{"name": k, "value": round2(v)} for k, v in by_type.items()],
        "contribution_trend": [{"month": k, "value": round2(v)} for k, v in sorted(trend.items())],
    }


@router.get("/pf-ppf/summary")
async def pf_summary(user: dict = Depends(require_admin)):
    docs = [serialize(d) for d in await pf_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)]
    total = _sum(docs, "current_balance")
    pf = _sum([d for d in docs if d.get("kind") == "PF"], "current_balance")
    ppf = _sum([d for d in docs if d.get("kind") == "PPF"], "current_balance")
    trend = defaultdict(float)
    for d in docs:
        for c in d.get("contributions", []) or []:
            mk = (c.get("date") or "")[:7]
            if mk:
                trend[mk] += round2(c.get("amount", 0))
    return {
        "total": total, "pf": pf, "ppf": ppf, "count": len(docs),
        "contribution_trend": [{"month": k, "value": round2(v)} for k, v in sorted(trend.items())],
    }


@router.post("/pf-ppf/{item_id}/contribution")
async def add_pf_contribution(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    entry = {
        "date": payload.get("date") or now_utc().date().isoformat(),
        "amount": round2(payload.get("amount", 0)),
        "type": payload.get("type", "SELF"),
    }
    doc = await pf_coll.find_one({"_id": oid(item_id)})
    new_balance = round2(doc.get("current_balance", 0) + entry["amount"])
    await pf_coll.update_one({"_id": oid(item_id)}, {"$push": {"contributions": entry}, "$set": {"current_balance": new_balance}})
    return serialize(await pf_coll.find_one({"_id": oid(item_id)}))


@router.post("/savings/{item_id}/contribution")
async def add_savings_contribution(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    entry = {
        "date": payload.get("date") or now_utc().date().isoformat(),
        "amount": round2(payload.get("amount", 0)),
        "note": payload.get("note", ""),
    }
    doc = await savings_coll.find_one({"_id": oid(item_id)})
    new_val = round2(doc.get("current_value", 0) + entry["amount"])
    await savings_coll.update_one({"_id": oid(item_id)}, {"$push": {"contributions": entry}, "$set": {"current_value": new_val}})
    return serialize(await savings_coll.find_one({"_id": oid(item_id)}))


@router.get("/investments/{item_id}/activity")
async def list_investment_activity(item_id: str, user: dict = Depends(require_admin)):
    investment = await inv_coll.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    rows = await db.investment_activities.find({"investment_id": item_id}).sort(
        [("date", -1), ("created_at", -1)]
    ).to_list(2000)
    return [serialize(row) for row in rows]


@router.post("/investments/{item_id}/activity")
async def record_investment_activity(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    investment = await inv_coll.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    activity_type = payload.get("type")
    if activity_type not in {"CONTRIBUTION", "SALE", "DISTRIBUTION", "FEE"}:
        raise HTTPException(status_code=422, detail="Choose contribution, sale, distribution or fee")
    amount = validate_financial_payload({"amount": payload.get("amount")})["amount"]
    if amount is None or amount <= 0:
        raise HTTPException(status_code=422, detail="Activity amount must be greater than zero")
    date = normalize_date(payload.get("date"))
    if not date:
        raise HTTPException(status_code=422, detail="Activity date is required")
    if date > now_utc().date().isoformat():
        raise HTTPException(status_code=422, detail="Investment activity cannot be dated in the future")
    record = {
        "investment_id": item_id,
        "type": activity_type,
        "date": date,
        "amount": amount,
        "note": str(payload.get("note") or "").strip()[:500],
        "created_at": now_utc(),
        "created_by": user["email"],
    }
    result = await db.investment_activities.insert_one(record)
    await log_audit(user, "record_investment_activity", "investment_activities", str(result.inserted_id), {
        "investment_id": item_id,
        "type": activity_type,
        "amount": amount,
        "date": date,
    })
    return serialize({**record, "_id": result.inserted_id})


@router.get("/investments/{item_id}/valuations")
async def list_investment_valuations(item_id: str, user: dict = Depends(require_admin)):
    investment = await inv_coll.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    rows = await db.investment_valuations.find({"investment_id": item_id}).sort(
        [("date", -1), ("created_at", -1)]
    ).to_list(2000)
    return [serialize(row) for row in rows]


@router.post("/investments/{item_id}/valuations")
async def record_investment_valuation(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    investment = await inv_coll.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    source = str(payload.get("source") or "").strip()
    allowed_sources = {"Statement", "Market quote", "Professional valuation", "Manual estimate", "Other"}
    if source not in allowed_sources:
        raise HTTPException(status_code=422, detail="Choose a supported valuation source")
    current_value = validate_financial_payload({"current_value": payload.get("current_value")})["current_value"]
    if current_value is None:
        raise HTTPException(status_code=422, detail="Current value is required")
    date = normalize_date(payload.get("date"))
    if not date:
        raise HTTPException(status_code=422, detail="Valuation date is required")
    if date > now_utc().date().isoformat():
        raise HTTPException(status_code=422, detail="Valuation date cannot be in the future")
    record = {
        "investment_id": item_id,
        "current_value": current_value,
        "source": source,
        "date": date,
        "created_at": now_utc(),
        "created_by": user["email"],
    }
    result = await db.investment_valuations.insert_one(record)
    current_date = str(investment.get("valuation_date") or "")
    is_current = not current_date or date >= current_date
    if is_current:
        await inv_coll.update_one({"_id": investment["_id"]}, {"$set": {
            "current_value": current_value,
            "valuation_source": source,
            "valuation_date": date,
            "updated_at": now_utc(),
        }})
    await log_audit(user, "record_investment_valuation", "investment_valuations", str(result.inserted_id), {
        "investment_id": item_id,
        "source": source,
        "date": date,
        "current_value": current_value,
        "current_position_updated": is_current,
    })
    return {**serialize({**record, "_id": result.inserted_id}), "current_position_updated": is_current}


@router.get("/networth")
async def net_worth(user: dict = Depends(require_admin)):
    data = await networth_data()
    await snapshot_net_worth(data["net_worth"], data["total_assets"], data["total_liabilities"])
    return data


@router.get("/networth/history")
async def net_worth_history_endpoint(user: dict = Depends(require_admin)):
    return {"items": await net_worth_history(), "note": "Only recorded valuation snapshots are shown; no historical values are estimated."}


@router.post("/networth/snapshot")
async def record_net_worth_snapshot(user: dict = Depends(require_admin)):
    """Record the current ledger valuation for today without inventing a past value."""
    data = await networth_data()
    await snapshot_net_worth(
        data["net_worth"],
        data["total_assets"],
        data["total_liabilities"],
        source="manual",
        replace_today=True,
    )
    return {
        "date": now_utc().date().isoformat(),
        "net_worth": data["net_worth"],
        "total_assets": data["total_assets"],
        "total_liabilities": data["total_liabilities"],
        "source": "manual",
    }


async def networth_data():
    balances, accts = await compute_account_balances()
    positions = []
    account_by_id = {str(account["_id"]): account for account in accts}
    for account_id, balance in balances.items():
        account = account_by_id.get(account_id)
        if not account:
            continue
        category = "cash" if account.get("type") == "CASH" else "bank"
        position = _position(
            account,
            category=category,
            value=balance,
            side="liability" if balance < 0 else "asset",
            source_default="Live ledger",
        )
        position["as_of"] = str(account.get("last_reconciled_at") or "")[:10] or None
        positions.append(position)

    collections = (
        (savings_coll, "current_value", "savings", "asset", 2000),
        (pf_coll, "current_balance", "pf_ppf", "asset", 2000),
        (inv_coll, "current_value", "investments", "asset", 2000),
        (assets_coll, "current_value", "property", "asset", 2000),
        (liab_coll, "outstanding", "other_liabilities", "liability", 2000),
        (db.loans, "outstanding", "loans", "liability", 500),
    )
    for collection, field, category, side, limit in collections:
        records = await collection.find({"deleted_at": {"$exists": False}}).to_list(limit)
        positions.extend(
            _position(record, category=category, value=record.get(field, 0), side=side)
            for record in records
        )

    for item in await db.lendings.find({"deleted_at": {"$exists": False}}).to_list(2000):
        principal = round2(item.get("amount", 0))
        paid = round2(sum(round2(row.get("amount", 0)) for row in item.get("repayments", []) or []))
        outstanding = max(principal - paid, 0)
        borrowed = item.get("direction") == "BORROWED"
        positions.append(_position(
            item,
            category="borrowings" if borrowed else "receivables",
            value=outstanding,
            side="liability" if borrowed else "asset",
        ))

    breakdown = defaultdict(float)
    liability_breakdown = defaultdict(float)
    for position in positions:
        if position["side"] == "liability":
            liability_breakdown[position["category"]] += position["owned_value"]
        else:
            breakdown[position["category"]] += position["owned_value"]
    for category in ("bank", "cash", "savings", "pf_ppf", "investments", "property", "receivables"):
        breakdown.setdefault(category, 0)
    breakdown = {key: round2(value) for key, value in breakdown.items()}
    liability_breakdown = {
        "loans": round2(liability_breakdown.get("loans", 0) + liability_breakdown.get("other_liabilities", 0)),
        "borrowings": round2(liability_breakdown.get("borrowings", 0)),
        "account_overdrafts": round2(liability_breakdown.get("bank", 0) + liability_breakdown.get("cash", 0)),
    }
    total_assets = round2(sum(breakdown.values()))
    total_liabilities = round2(sum(liability_breakdown.values()))
    return {
        "net_worth": round2(total_assets - total_liabilities),
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "breakdown": breakdown,
        "liability_breakdown": liability_breakdown,
        "positions": positions,
        "allocation": [{"name": key.replace("_", " ").title(), "value": value} for key, value in breakdown.items()],
    }


router.include_router(savings_router)
router.include_router(assets_router)
router.include_router(liabilities_router)
router.include_router(investments_router)
router.include_router(pf_router)
