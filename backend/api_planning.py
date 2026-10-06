"""Action-led household planning: calendar, cash outlook and health signals."""
from datetime import timedelta
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException
from core import db, now_utc, require_admin, round2, serialize, oid, normalize_date
from api_finance import compute_account_balances

router = APIRouter(tags=["planning"])

def _event(title, due_date, amount=0, kind="REMINDER", path="/notifications", detail="", source_collection="", source_id=""):
    fingerprint = f"{kind}:{source_collection}:{source_id}:{due_date or ''}:{title}"
    return {"id": fingerprint, "title": title, "due_date": due_date, "amount": round2(amount), "kind": kind, "path": path, "detail": detail, "source_collection": source_collection, "source_id": source_id}


OUTGOING_KINDS = {"BORROWING", "LOAN", "INSURANCE", "CONTRIBUTION", "TAX", "SIP", "PPF"}
INCOMING_KINDS = {"LENDING", "RECEIVABLE"}


async def _all_events(days=30):
    """Build one normalised commitments stream. This is deliberately derived from
    source records so the action centre never becomes a second ledger."""
    today = now_utc().date()
    horizon = (today + timedelta(days=days)).isoformat()
    events = []
    lendings = await db.lendings.find({"deleted_at": {"$exists": False}}).to_list(2000)
    for item in lendings:
        paid = sum(round2(r.get("amount", 0)) for r in item.get("repayments", []) or [])
        outstanding = round2(max(item.get("amount", 0) - paid, 0)); due = item.get("due_date")
        if outstanding and due and due <= horizon:
            borrowed = item.get("direction") == "BORROWED"
            events.append(_event("Repay borrowing" if borrowed else "Recover lending", due, outstanding, "BORROWING" if borrowed else "LENDING", "/lending", item.get("counterparty") or "Counterparty", "lendings", str(item["_id"])))
    for item in await db.loans.find({"deleted_at": {"$exists": False}, "status": {"$ne": "Closed"}}).to_list(500):
        due = item.get("next_due_date") or item.get("due_date")
        if due and due <= horizon:
            events.append(_event("Loan EMI", due, item.get("emi", 0), "LOAN", "/loans", item.get("name") or item.get("lender") or "Loan", "loans", str(item["_id"])))
    for item in await db.insurance.find({"deleted_at": {"$exists": False}, "status": {"$ne": "Lapsed"}}).to_list(500):
        due = item.get("renewal_date")
        if due and due <= horizon:
            events.append(_event("Renew insurance", due, item.get("premium", 0), "INSURANCE", "/insurance", item.get("policy_name") or "Policy", "insurance", str(item["_id"])))
    for collection, title, path, label in (("rent_payments", "Collect rent", "/rental", "property_name"), ("farm_rent_payments", "Collect farm lease", "/farms", "farm_name")):
        for item in await db[collection].find({"deleted_at": {"$exists": False}, "status": {"$in": ["PENDING", "PARTIAL"]}}).to_list(2000):
            due = item.get("due_date"); outstanding = round2(max(item.get("amount_due", 0) - item.get("amount_received", 0), 0))
            if due and outstanding and due <= horizon:
                events.append(_event(title, due, outstanding, "RECEIVABLE", path, item.get(label) or item.get("tenant") or "Collection", collection, str(item["_id"])))
    for item in await db.goals.find({"deleted_at": {"$exists": False}}).to_list(500):
        due = item.get("target_date"); remaining = round2(max(item.get("target_amount", 0) - item.get("current_amount", 0), 0))
        if due and remaining and due <= horizon:
            events.append(_event("Fund goal", due, remaining, "GOAL", "/goals", item.get("name") or "Goal", "goals", str(item["_id"])))
    for item in await db.pf_ppf.find({"deleted_at": {"$exists": False}}).to_list(500):
        due = item.get("next_contribution_date") or item.get("contribution_due_date")
        if due and due <= horizon:
            kind = (item.get("kind") or "fund").upper()
            events.append(_event(f"Contribute to {kind}", due, item.get("expected_contribution", 0), kind if kind in ("PPF", "SIP") else "CONTRIBUTION", "/pf-ppf", item.get("institution") or "Fund", "pf_ppf", str(item["_id"])))
    for item in await db.notifications.find({"deleted_at": {"$exists": False}, "kind": "CUSTOM_REMINDER", "status": "OPEN"}).to_list(500):
        due = item.get("due_date")
        if due and due <= horizon:
            events.append(_event(item.get("title") or "Reminder", due, item.get("amount", 0), item.get("commitment_kind") or "REMINDER", "/notifications", item.get("message") or "", "notifications", str(item["_id"])))
    return sorted(events, key=lambda item: item["due_date"])

@router.get("/planning/overview")
async def planning_overview(user: dict = Depends(require_admin)):
    today = now_utc().date()
    horizon = (today + timedelta(days=30)).isoformat()
    events = []

    # Kept in one helper so planner, inbox and exports always agree.
    events = await _all_events(30)
    """legacy event construction below is intentionally bypassed"""
    lendings = []
    for item in lendings:
        paid = sum(round2(r.get("amount", 0)) for r in item.get("repayments", []) or [])
        outstanding = round2(max(item.get("amount", 0) - paid, 0))
        due = item.get("due_date")
        if outstanding and due and due <= horizon:
            label = "Repay borrowing" if item.get("direction") == "BORROWED" else "Recover lending"
            events.append(_event(label, due, outstanding, "BORROWING" if item.get("direction") == "BORROWED" else "LENDING", "/lending", item.get("counterparty") or "Counterparty", "lendings", str(item["_id"])))

    loans = []
    for item in loans:
        due = item.get("next_due_date") or item.get("due_date")
        if due and due <= horizon:
            events.append(_event("Loan EMI", due, item.get("emi", 0), "LOAN", "/loans", item.get("name") or item.get("lender") or "Loan", "loans", str(item["_id"])))

    policies = await db.insurance.find({"deleted_at": {"$exists": False}, "status": {"$ne": "Lapsed"}}).to_list(500)
    for item in ():
        due = item.get("renewal_date")
        if due and due <= horizon:
            events.append(_event("Renew insurance", due, item.get("premium", 0), "INSURANCE", "/insurance", item.get("policy_name") or "Policy", "insurance", str(item["_id"])))

    for collection, title, path, label in ():
        payments = await db[collection].find({"deleted_at": {"$exists": False}, "status": {"$in": ["PENDING", "PARTIAL"]}}).to_list(1000)
        for item in payments:
            due = item.get("due_date")
            outstanding = round2(max(item.get("amount_due", 0) - item.get("amount_received", 0), 0))
            if due and outstanding and due <= horizon:
                events.append(_event(title, due, outstanding, "RECEIVABLE", path, item.get(label) or item.get("tenant") or "Collection", collection, str(item["_id"])))

    goals = []
    for item in goals:
        due = item.get("target_date")
        remaining = round2(max(item.get("target_amount", 0) - item.get("current_amount", 0), 0))
        if due and remaining and due <= horizon:
            events.append(_event("Fund goal", due, remaining, "GOAL", "/goals", item.get("name") or "Goal", "goals", str(item["_id"])))

    funds = []
    for item in funds:
        due = item.get("next_contribution_date") or item.get("contribution_due_date")
        if due and due <= horizon:
            events.append(_event(f"Contribute to {item.get('kind') or 'fund'}", due, item.get("expected_contribution", 0), "CONTRIBUTION", "/pf-ppf", item.get("institution") or "Fund", "pf_ppf", str(item["_id"])))

    reminders = []
    for item in reminders:
        due = item.get("due_date")
        if due and due <= horizon:
            events.append(_event(item.get("title") or "Reminder", due, item.get("amount", 0), "REMINDER", "/notifications", item.get("message") or "", "notifications", str(item["_id"])))

    events.sort(key=lambda item: item["due_date"])
    overdue = [item for item in events if item["due_date"] < today.isoformat()]
    due_soon = [item for item in events if today.isoformat() <= item["due_date"] <= horizon]

    balances, _ = await compute_account_balances()
    cash_on_hand = round2(sum(balances.values()))
    month = today.strftime("%Y-%m")
    transactions = await db.transactions.find({
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
        "date": {"$gte": f"{month}-01", "$lte": horizon},
    }).to_list(10000)
    actual_income = round2(sum(t.get("amount", 0) for t in transactions if t.get("type") == "INCOME"))
    actual_expense = round2(sum(t.get("amount", 0) for t in transactions if t.get("type") == "EXPENSE"))
    scheduled_out = round2(sum(item["amount"] for item in due_soon if item["kind"] in OUTGOING_KINDS))
    scheduled_in = round2(sum(item["amount"] for item in due_soon if item["kind"] in INCOMING_KINDS))
    running_balance = cash_on_hand
    minimum_balance = cash_on_hand
    minimum_balance_date = today.isoformat()
    daily_projection = []
    for event in due_soon:
        if event["kind"] in INCOMING_KINDS:
            running_balance += event["amount"]
        elif event["kind"] in OUTGOING_KINDS:
            running_balance -= event["amount"]
        running_balance = round2(running_balance)
        if running_balance < minimum_balance:
            minimum_balance, minimum_balance_date = running_balance, event["due_date"]
        daily_projection.append({"date": event["due_date"], "balance": running_balance, "event": event["title"]})
    projected = running_balance

    liquid_months = round(cash_on_hand / actual_expense, 1) if actual_expense > 0 else None
    insurance_count = len(policies)
    month_start = (today - timedelta(days=90)).isoformat()
    income_90 = round2(sum(t.get("amount", 0) for t in await db.transactions.find({
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
        "type": "INCOME",
        "date": {"$gte": month_start},
    }).to_list(10000)))
    monthly_income = round2(income_90 / 3) if income_90 else 0
    loans_total = round2(sum(x.get("outstanding", 0) for x in await db.loans.find({"deleted_at": {"$exists": False}, "status": {"$ne": "Closed"}}).to_list(500)))
    other_debt = round2(sum(x.get("outstanding", 0) for x in await db.liabilities.find({"deleted_at": {"$exists": False}}).to_list(2000)))
    borrowed = await db.lendings.find({"deleted_at": {"$exists": False}, "direction": "BORROWED"}).to_list(2000)
    borrow_total = round2(sum(max(x.get("amount", 0) - sum(r.get("amount", 0) for r in x.get("repayments", []) or []), 0) for x in borrowed))
    debt_to_income = round2((loans_total + other_debt + borrow_total) / (monthly_income * 12) * 100) if monthly_income else None
    emi_total = round2(sum(x.get("emi", 0) for x in await db.loans.find({"deleted_at": {"$exists": False}, "status": {"$ne": "Closed"}}).to_list(500)))
    emi_ratio = round2(emi_total / monthly_income * 100) if monthly_income else None
    ppf_due = [x for x in await db.pf_ppf.find({"deleted_at": {"$exists": False}}).to_list(500) if (x.get("next_contribution_date") or x.get("contribution_due_date"))]
    tax_docs = await db.documents.find({"deleted_at": {"$exists": False}, "category": {"$in": ["ITR", "Income Tax", "Form 16", "Tax Challan"]}}).to_list(20)
    score_parts = [25, 20 if not overdue else max(0, 20 - min(20, len(overdue) * 7)), 20 if liquid_months is None or liquid_months >= 3 else max(0, round(liquid_months / 3 * 20)), 15 if insurance_count else 4, 10 if debt_to_income is None or debt_to_income <= 40 else max(0, 10 - round((debt_to_income - 40) / 8)), 10 if not ppf_due or all(x.get("expected_contribution", 0) > 0 for x in ppf_due) else 4]
    health_score = int(min(100, sum(score_parts)))
    health = {
        "score": health_score,
        "liquid_months": liquid_months,
        "signals": [
            {"label": "No overdue commitments" if not overdue else f"{len(overdue)} overdue commitment{'s' if len(overdue) != 1 else ''}", "good": not overdue},
            {"label": "Emergency reserve is at least 3 months" if liquid_months is None or liquid_months >= 3 else f"Emergency reserve covers {liquid_months} months", "good": liquid_months is None or liquid_months >= 3},
            {"label": "Insurance records are in place" if insurance_count else "Add insurance records to complete your protection view", "good": bool(insurance_count)},
            {"label": "Debt load is within 40% of annual income" if debt_to_income is not None and debt_to_income <= 40 else ("Add income records to assess debt burden" if debt_to_income is None else f"Debt is {debt_to_income}% of annualised income"), "good": debt_to_income is None or debt_to_income <= 40},
            {"label": "EMIs are within 35% of monthly income" if emi_ratio is not None and emi_ratio <= 35 else ("Add income records to assess EMI risk" if emi_ratio is None else f"EMIs use {emi_ratio}% of monthly income"), "good": emi_ratio is None or emi_ratio <= 35},
            {"label": "Tax documents are on file" if tax_docs else "Add ITR, Form 16 or tax challans before filing season", "good": bool(tax_docs)},
        ],
        "metrics": {"debt_to_income": debt_to_income, "emi_ratio": emi_ratio, "tax_documents": len(tax_docs), "scheduled_contributions": len(ppf_due)},
    }
    recent = [serialize(item) for item in await db.transactions.find({"deleted_at": {"$exists": False}}).sort([("date", -1), ("created_at", -1)]).to_list(8)]
    action_state = {item["fingerprint"]: item for item in await db.planning_actions.find({}).to_list(2000)}
    active_events = []
    for event in overdue + due_soon:
        state = action_state.get(event["id"], {})
        if state.get("status") == "RESOLVED" or (state.get("snoozed_until") and state["snoozed_until"] >= today.isoformat()):
            continue
        event["status"] = state.get("status", "OPEN")
        active_events.append(event)
    tight_dates = [x for x in daily_projection if x["balance"] < 0]
    return {"actions": active_events[:30], "calendar": events[:60], "timeline": recent, "forecast": {"cash_on_hand": cash_on_hand, "recorded_income": actual_income, "recorded_expense": actual_expense, "scheduled_out": scheduled_out, "scheduled_in": scheduled_in, "projected_balance": projected, "minimum_balance": minimum_balance, "minimum_balance_date": minimum_balance_date, "tight_dates": tight_dates, "daily_projection": daily_projection}, "health": health}

@router.get("/planning/ownership")
async def ownership_summary(user: dict = Depends(require_admin)):
    buckets = {}
    balances, accounts = await compute_account_balances()
    for item in accounts:
        owner = item.get("owner") or "Self"
        share = round2(balances.get(str(item["_id"]), 0) * (float(item.get("ownership_percent", 100) or 100) / 100))
        buckets[owner] = round2(buckets.get(owner, 0) + share)
    for collection, field, multiplier in (("savings", "current_value", 1), ("investments", "current_value", 1), ("assets", "current_value", 1), ("pf_ppf", "current_balance", 1), ("liabilities", "outstanding", -1), ("loans", "outstanding", -1)):
        for item in await db[collection].find({"deleted_at": {"$exists": False}}).to_list(2000):
            owner = item.get("owner") or "Self"
            share = round2(multiplier * item.get(field, 0) * (float(item.get("ownership_percent", 100) or 100) / 100))
            buckets[owner] = round2(buckets.get(owner, 0) + share)
    # Real-life entities commonly live outside the investment ledger. Their
    # estimated value belongs in the ownership view without pretending that an
    # insurance cover amount is an owned asset.
    entity_buckets = defaultdict(float)
    for collection, field in (("rental_properties", "current_value"), ("farms", "estimated_value"), ("projects", "asset_value")):
        for item in await db[collection].find({"deleted_at": {"$exists": False}}).to_list(2000):
            owner = item.get("owner") or ("Farm / business" if collection in ("farms", "projects") else "Self")
            share = round2(item.get(field, 0) * (float(item.get("ownership_percent", 100) or 100) / 100))
            buckets[owner] = round2(buckets.get(owner, 0) + share)
            entity_buckets[owner] += share
    groups = {"mine": 0, "family": 0, "farm_business": 0, "consolidated": 0}
    family_names = {x.get("name") for x in await db.family_members.find({"deleted_at": {"$exists": False}}).to_list(500)}
    for owner, value in buckets.items():
        groups["consolidated"] += value
        if owner == "Self": groups["mine"] += value
        elif owner in family_names or owner == "Family": groups["family"] += value
        else: groups["farm_business"] += value
    return {"owners": [{"name": owner, "value": value} for owner, value in sorted(buckets.items(), key=lambda row: -row[1])], "views": {key: round2(value) for key, value in groups.items()}}


@router.post("/planning/actions/{action_id}")
async def update_action(action_id: str, payload: dict, user: dict = Depends(require_admin)):
    """Resolve, review or defer an action, with payment recording routed to the
    original ledger. No status here ever mutates a financial balance by itself."""
    action = payload.get("action", "resolve").lower()
    source = payload.get("source_collection", "")
    source_id = payload.get("source_id", "")
    if not source or not source_id:
        raise HTTPException(status_code=400, detail="This action is missing its source record")
    if action == "record_payment":
        amount = round2(payload.get("amount", 0))
        if amount <= 0:
            raise HTTPException(status_code=400, detail="Enter a payment amount greater than zero")
        when = normalize_date(payload.get("date") or now_utc().date().isoformat())
        note = payload.get("note", "Recorded from Action Center")
        if source == "lendings":
            row = await db.lendings.find_one({"_id": oid(source_id), "deleted_at": {"$exists": False}})
            if not row: raise HTTPException(status_code=404, detail="Lending record not found")
            remaining = round2(max(row.get("amount", 0) - sum(x.get("amount", 0) for x in row.get("repayments", []) or []), 0))
            if amount > remaining + .009: raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding balance of {remaining:.2f}")
            await db.lendings.update_one({"_id": row["_id"]}, {"$push": {"repayments": {"date": when, "amount": amount, "note": note}}})
        elif source == "loans":
            row = await db.loans.find_one({"_id": oid(source_id), "deleted_at": {"$exists": False}})
            if not row: raise HTTPException(status_code=404, detail="Loan not found")
            remaining = round2(row.get("outstanding", 0))
            if amount > remaining + .009: raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding balance of {remaining:.2f}")
            await db.loans.update_one({"_id": row["_id"]}, {"$set": {"outstanding": round2(remaining - amount), "last_payment_date": when, "updated_at": now_utc()}, "$push": {"payments": {"date": when, "amount": amount, "note": note}}})
        elif source in ("rent_payments", "farm_rent_payments"):
            row = await db[source].find_one({"_id": oid(source_id), "deleted_at": {"$exists": False}})
            if not row: raise HTTPException(status_code=404, detail="Collection record not found")
            remaining = round2(max(row.get("amount_due", 0) - row.get("amount_received", 0), 0))
            if amount > remaining + .009: raise HTTPException(status_code=400, detail=f"Amount exceeds outstanding balance of {remaining:.2f}")
            received = round2(row.get("amount_received", 0) + amount)
            await db[source].update_one({"_id": row["_id"]}, {"$set": {"amount_received": received, "status": "COLLECTED" if received >= row.get("amount_due", 0) else "PARTIAL", "updated_at": now_utc()}, "$push": {"receipts": {"date": when, "amount": amount, "note": note}}})
        elif source == "insurance":
            row = await db.insurance.find_one({"_id": oid(source_id), "deleted_at": {"$exists": False}})
            if not row: raise HTTPException(status_code=404, detail="Insurance policy not found")
            await db.insurance.update_one({"_id": row["_id"]}, {"$push": {"payments": {"date": when, "amount": amount, "note": note}}, "$set": {"last_payment_date": when, "updated_at": now_utc()}})
        else:
            raise HTTPException(status_code=400, detail="This item cannot be paid from Action Center")
        action = "resolve"
    state = {"fingerprint": action_id, "source_collection": source, "source_id": source_id, "status": "RESOLVED" if action == "resolve" else "REVIEWED" if action == "review" else "OPEN", "updated_at": now_utc(), "updated_by": user["email"]}
    if action == "postpone":
        until = normalize_date(payload.get("snoozed_until"))
        if not until: raise HTTPException(status_code=400, detail="Choose a date to postpone until")
        state.update({"status": "SNOOZED", "snoozed_until": until})
    await db.planning_actions.update_one({"fingerprint": action_id}, {"$set": state}, upsert=True)
    return {"status": state["status"]}


@router.get("/planning/inbox")
async def planning_inbox(q: str = "", state: str = "ALL", user: dict = Depends(require_admin)):
    """A searchable cross-module review queue. Review state is independent from
    accounting data, so importing or correcting a transaction stays safe."""
    rows = []
    reviews = {f"{x.get('source')}:{x.get('source_id')}": x for x in await db.planning_reviews.find({}).to_list(10000)}
    for tx in await db.transactions.find({"deleted_at": {"$exists": False}}).sort([("date", -1)]).to_list(3000):
        item = serialize(tx); key = f"transactions:{item['id']}"; review = reviews.get(key, {})
        rows.append({"id": key, "source": "transactions", "source_id": item["id"], "title": item.get("title") or item.get("category") or item.get("source") or item.get("type"), "detail": item.get("description", ""), "date": item.get("date"), "amount": round2(item.get("amount", 0)), "kind": item.get("type"), "state": review.get("state", "NEEDS_REVIEW" if not item.get("reviewed_at") else "REVIEWED"), "path": "/cash-flow"})
    for event in await _all_events(90):
        key = f"events:{event['id']}"; review = reviews.get(key, {})
        rows.append({"id": key, "source": "events", "source_id": event["id"], "title": event["title"], "detail": event["detail"], "date": event["due_date"], "amount": event["amount"], "kind": event["kind"], "state": review.get("state", "NEEDS_REVIEW"), "path": event["path"]})
    needle = q.strip().lower()
    if needle: rows = [x for x in rows if needle in " ".join(str(x.get(k, "")) for k in ("title", "detail", "kind", "date")).lower()]
    if state != "ALL": rows = [x for x in rows if x["state"] == state]
    return sorted(rows, key=lambda x: (x["state"] == "REVIEWED", x.get("date") or "9999-99-99"))[:1000]


@router.post("/planning/inbox/{source}/{source_id}/review")
async def review_inbox_item(source: str, source_id: str, payload: dict, user: dict = Depends(require_admin)):
    new_state = payload.get("state", "REVIEWED")
    if new_state not in ("NEEDS_REVIEW", "REVIEWED"):
        raise HTTPException(status_code=400, detail="Invalid review state")
    await db.planning_reviews.update_one({"source": source, "source_id": source_id}, {"$set": {"source": source, "source_id": source_id, "state": new_state, "updated_at": now_utc(), "updated_by": user["email"]}}, upsert=True)
    return {"state": new_state}
