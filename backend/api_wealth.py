"""Wealth: savings, PF/PPF, assets, liabilities, investments, net worth."""
from collections import defaultdict
from datetime import date
import math
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
    source = record.get("valuation_source") or record.get("balance_source") or record.get("record_source") or (
        "IMPORT" if record.get("source_document") or record.get("source_import_id") else None
    ) or source_default or "Not recorded"
    as_of = str(record.get("valuation_date") or record.get("last_reconciled_at") or "")[:10] or None
    try:
        age_days = (now_utc().date() - date.fromisoformat(as_of)).days if as_of else None
    except ValueError:
        age_days = None
    confidence = (
        "ESTIMATE" if str(source).strip().lower() in {"manual", "manual estimate", "estimate"}
        else "INCOMPLETE" if source == "Not recorded" or age_days is None
        else "RECORDED"
    )
    return {
        "id": str(record.get("id") or record.get("_id") or ""),
        "name": record.get("name") or record.get("institution") or record.get("policy_name") or record.get("counterparty") or category,
        "category": category,
        "side": side,
        "owner": record.get("owner") or owner_default,
        "ownership_percent": ownership,
        "gross_value": abs(gross_value),
        "owned_value": round2(abs(gross_value) * ownership / 100),
        "source": source,
        "as_of": as_of,
        "age_days": age_days,
        "confidence": confidence,
        "last_updated": record.get("updated_at") or record.get("created_at"),
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


def _xnpv(rate, cashflows, start_date):
    total = 0.0
    log_base = math.log1p(rate)
    for flow_date, amount in cashflows:
        exponent = ((flow_date - start_date).days / 365.0) * log_base
        if exponent > 700:
            continue
        if exponent < -700:
            return math.copysign(math.inf, amount)
        total += amount / math.exp(exponent)
    return total


def _xirr(cashflows):
    cashflows = sorted(cashflows, key=lambda item: item[0])
    if len({flow_date for flow_date, _ in cashflows}) < 2:
        return None, "Dated cash flows on at least two different dates are required."
    if not any(amount < 0 for _, amount in cashflows) or not any(amount > 0 for _, amount in cashflows):
        return None, "Both invested cash and proceeds or a current valuation are required."
    signs = [1 if amount > 0 else -1 for _, amount in cashflows if amount]
    if sum(left != right for left, right in zip(signs, signs[1:])) > 1:
        return None, "The cash-flow sequence changes direction multiple times; no single XIRR is reported."

    start_date = cashflows[0][0]
    # Search a bounded, logarithmically spaced rate range; multiple roots are
    # reported as ambiguous rather than presenting an arbitrary annual return.
    rates = [-0.9999]
    rates.extend((10 ** (index / 20) - 1) for index in range(-40, 61))
    brackets = []
    previous_rate = rates[0]
    previous_value = _xnpv(previous_rate, cashflows, start_date)
    for rate in rates[1:]:
        value = _xnpv(rate, cashflows, start_date)
        if math.isfinite(value) and abs(value) < 0.000001:
            return rate, None
        if math.isfinite(value) and math.isfinite(previous_value) and value * previous_value < 0:
            brackets.append((previous_rate, rate))
        previous_rate, previous_value = rate, value
    if not brackets:
        return None, "The recorded cash flows do not produce a stable annualized return."
    if len(brackets) > 1:
        return None, "The recorded cash flows have multiple possible returns; no single XIRR is reported."
    low, high = brackets[0]
    low_value = _xnpv(low, cashflows, start_date)
    for _ in range(160):
        mid = (low + high) / 2
        mid_value = _xnpv(mid, cashflows, start_date)
        if abs(mid_value) < 0.000001:
            return mid, None
        if low_value * mid_value <= 0:
            high = mid
        else:
            low, low_value = mid, mid_value
    return (low + high) / 2, None


@router.get("/investments/{item_id}/performance")
async def investment_performance(item_id: str, user: dict = Depends(require_admin)):
    investment = await inv_coll.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    activities = await db.investment_activities.find({"investment_id": item_id}).to_list(2000)
    valuations = await db.investment_valuations.find({"investment_id": item_id}).sort(
        [("date", -1), ("created_at", -1)]
    ).to_list(2000)
    latest = valuations[0] if valuations else None
    valuation_date = (latest or {}).get("date") or investment.get("valuation_date")
    current_value = (latest or {}).get("current_value", investment.get("current_value"))
    if not valuation_date or current_value is None:
        return {
            "status": "UNAVAILABLE",
            "xirr": None,
            "reason": "A dated current valuation is required before investment return can be calculated.",
            "cash_flow_count": len(activities),
        }
    try:
        terminal_date = date.fromisoformat(valuation_date)
    except ValueError:
        return {"status": "UNAVAILABLE", "xirr": None, "reason": "The current valuation date is invalid.", "cash_flow_count": len(activities)}

    cashflows = []
    for activity in activities:
        try:
            activity_date = date.fromisoformat(str(activity.get("date") or ""))
        except ValueError:
            continue
        if activity_date > terminal_date:
            return {
                "status": "UNAVAILABLE",
                "xirr": None,
                "reason": "The current valuation predates recorded investment activity; enter a valuation dated on or after the latest activity.",
                "cash_flow_count": len(activities),
                "valuation_date": terminal_date.isoformat(),
            }
        amount = abs(round2(activity.get("amount", 0)))
        activity_type = activity.get("type")
        signed_amount = -amount if activity_type in {"CONTRIBUTION", "FEE"} else amount
        cashflows.append((activity_date, signed_amount))
    cashflows.append((terminal_date, abs(round2(current_value))))
    value, reason = _xirr(cashflows)
    if reason:
        return {
            "status": "UNAVAILABLE",
            "xirr": None,
            "reason": reason,
            "cash_flow_count": len(cashflows) - 1,
            "valuation_date": terminal_date.isoformat(),
            "valuation_source": (latest or {}).get("source") or investment.get("valuation_source") or "Not recorded",
        }
    return {
        "status": "AVAILABLE",
        "method": "XIRR",
        "xirr": round(value * 100, 4),
        "annualized": True,
        "cash_flow_count": len(cashflows) - 1,
        "valuation_date": terminal_date.isoformat(),
        "valuation_source": (latest or {}).get("source") or investment.get("valuation_source") or "Not recorded",
        "assumptions": "Contributions and fees are investor outflows; sale proceeds, distributions, and the latest recorded market value are inflows. Uses actual calendar days/365.",
    }


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
    activity_rows = await db.transactions.find({
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
    }).sort([("date", -1)]).to_list(50000)
    latest_account_activity = {}
    for transaction in activity_rows:
        for account_id in (transaction.get("account_id"), transaction.get("to_account_id")):
            if account_id and account_id not in latest_account_activity:
                latest_account_activity[account_id] = transaction.get("date")
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
        position["as_of"] = str(
            account.get("last_reconciled_at")
            or latest_account_activity.get(account_id)
            or account.get("updated_at")
            or account.get("created_at")
            or ""
        )[:10] or None
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
