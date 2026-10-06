"""Wealth: savings, PF/PPF, assets, liabilities, investments, net worth."""
from collections import defaultdict
from fastapi import APIRouter, Depends
from core import db, serialize, oid, now_utc, require_admin, round2
from api_finance import compute_account_balances
from crud import make_crud_router
from financial_services import net_worth_history, snapshot_net_worth

router = APIRouter(tags=["wealth"])

savings_router, savings_coll = make_crud_router("savings", "savings")
assets_router, assets_coll = make_crud_router("assets", "assets")
liabilities_router, liab_coll = make_crud_router("liabilities", "liabilities")
investments_router, inv_coll = make_crud_router("investments", "investments")
pf_router, pf_coll = make_crud_router("pf-ppf", "pf_ppf")


def _sum(docs, field):
    return round2(sum(round2(d.get(field, 0)) for d in docs))


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
    bank = round2(sum(v for k, v in balances.items()
                      for a in [next((x for x in accts if str(x["_id"]) == k), None)]
                      if a and a.get("type") != "CASH"))
    cash = round2(sum(v for k, v in balances.items()
                      for a in [next((x for x in accts if str(x["_id"]) == k), None)]
                      if a and a.get("type") == "CASH"))
    savings = _sum([serialize(d) for d in await savings_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)], "current_value")
    pf_docs = [serialize(d) for d in await pf_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)]
    pf = _sum(pf_docs, "current_balance")
    investments = _sum([serialize(d) for d in await inv_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)], "current_value")
    asset_docs = [serialize(d) for d in await assets_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)]
    property_assets = _sum(asset_docs, "current_value")
    liab_docs = [serialize(d) for d in await liab_coll.find({"deleted_at": {"$exists": False}}).to_list(2000)]
    liabilities = _sum(liab_docs, "outstanding")
    loan_docs = [serialize(d) for d in await db.loans.find({"deleted_at": {"$exists": False}}).to_list(500)]
    loans_out = _sum(loan_docs, "outstanding")
    # borrowing outstanding
    borrow = [d for d in await db.lendings.find({"direction": "BORROWED", "deleted_at": {"$exists": False}}).to_list(2000)]
    borrow_out = 0.0
    for b in borrow:
        principal = round2(b.get("amount", 0))
        paid = round2(sum(round2(r.get("amount", 0)) for r in b.get("repayments", []) or []))
        borrow_out += max(principal - paid, 0)
    borrow_out = round2(borrow_out)
    # lending outstanding is a receivable (asset)
    lent = [d for d in await db.lendings.find({"direction": "LENT", "deleted_at": {"$exists": False}}).to_list(2000)]
    lend_out = 0.0
    for l in lent:
        principal = round2(l.get("amount", 0))
        paid = round2(sum(round2(r.get("amount", 0)) for r in l.get("repayments", []) or []))
        lend_out += max(principal - paid, 0)
    lend_out = round2(lend_out)

    total_assets = round2(bank + cash + savings + pf + investments + property_assets + lend_out)
    total_liabilities = round2(liabilities + borrow_out + loans_out)
    return {
        "net_worth": round2(total_assets - total_liabilities),
        "total_assets": total_assets,
        "total_liabilities": total_liabilities,
        "breakdown": {
            "bank": bank, "cash": cash, "savings": savings, "pf_ppf": pf,
            "investments": investments, "property": property_assets, "receivables": lend_out,
        },
        "liability_breakdown": {"loans": round2(liabilities + loans_out), "borrowings": borrow_out},
        "allocation": [
            {"name": "Bank", "value": bank}, {"name": "Cash", "value": cash},
            {"name": "Savings", "value": savings}, {"name": "PF/PPF", "value": pf},
            {"name": "Investments", "value": investments}, {"name": "Property", "value": property_assets},
            {"name": "Receivables", "value": lend_out},
        ],
    }


router.include_router(savings_router)
router.include_router(assets_router)
router.include_router(liabilities_router)
router.include_router(investments_router)
router.include_router(pf_router)
