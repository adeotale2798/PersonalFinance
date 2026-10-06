"""Dashboard aggregation: overview & cash flow."""
from collections import defaultdict
from fastapi import APIRouter, Depends
from core import db, serialize, now_utc, require_admin, round2
from api_wealth import networth_data
from financial_services import search_financial_records, snapshot_net_worth

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/overview")
async def overview(user: dict = Depends(require_admin)):
    nw = await networth_data()
    await snapshot_net_worth(nw["net_worth"], nw["total_assets"], nw["total_liabilities"])
    now = now_utc()
    this_month = now.strftime("%Y-%m")

    txns = await db.transactions.find({
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
    }).to_list(50000)
    month_income = month_expense = 0.0
    income_by_cat = defaultdict(float)
    expense_by_cat = defaultdict(float)
    monthly = defaultdict(lambda: {"in": 0.0, "out": 0.0})
    project_spend = 0.0
    for t in txns:
        amt = round2(t.get("amount", 0))
        mk = (t.get("date") or "")[:7]
        if t.get("type") == "INCOME":
            if mk:
                monthly[mk]["in"] += amt
            if mk == this_month:
                month_income += amt
            income_by_cat[t.get("source") or "Other"] += amt
        elif t.get("type") == "EXPENSE":
            if mk:
                monthly[mk]["out"] += amt
            if mk == this_month:
                month_expense += amt
            expense_by_cat[t.get("category") or "Other"] += amt
            if t.get("project_id"):
                project_spend += amt

    # lending / borrowing outstanding
    def outstanding(direction):
        total = 0.0
        return total
    lends = await db.lendings.find({"deleted_at": {"$exists": False}}).to_list(2000)
    lend_out = borrow_out = 0.0
    overdue_lend = 0.0
    today = now.date().isoformat()
    for l in lends:
        principal = round2(l.get("amount", 0))
        paid = round2(sum(round2(r.get("amount", 0)) for r in l.get("repayments", []) or []))
        out = max(principal - paid, 0)
        if l.get("direction") == "LENT":
            lend_out += out
            if out > 0 and l.get("due_date") and l.get("due_date") < today:
                overdue_lend += out
        else:
            borrow_out += out

    # rental outstanding
    rent_payments = await db.rent_payments.find({"deleted_at": {"$exists": False}}).to_list(5000)
    unpaid_rent = round2(sum(max(round2(p.get("amount_due", 0)) - round2(p.get("amount_received", 0)), 0)
                             for p in rent_payments if p.get("status") != "COLLECTED"))
    month_rent_collected = round2(sum(round2(p.get("amount_received", 0)) for p in rent_payments if p.get("period") == this_month))

    # projects
    projects = await db.projects.find({"deleted_at": {"$exists": False}}).to_list(500)
    active_projects = len([p for p in projects if p.get("status") == "ACTIVE"])
    total_budget = round2(sum(round2(p.get("budget", 0)) for p in projects))

    # attention items
    attention = []
    if overdue_lend > 0:
        attention.append({"type": "overdue_lending", "label": "Overdue money lent", "value": round2(overdue_lend), "path": "/lending"})
    if unpaid_rent > 0:
        attention.append({"type": "unpaid_rent", "label": "Outstanding rent to collect", "value": unpaid_rent, "path": "/rental"})
    if borrow_out > 0:
        attention.append({"type": "borrowing", "label": "Outstanding borrowings", "value": round2(borrow_out), "path": "/lending?tab=BORROWED"})
    for p in projects:
        spent = round2(sum(round2(t.get("amount", 0)) for t in txns if t.get("project_id") == str(p["_id"]) and t.get("type") == "EXPENSE"))
        if p.get("budget", 0) and spent > round2(p.get("budget", 0)):
            attention.append({"type": "budget_overrun", "label": f"Budget overrun: {p.get('name')}", "value": round2(spent - p.get("budget", 0)), "path": "/projects"})

    # recent activity
    audits = await db.audit_events.find({}).sort([("timestamp", -1)]).to_list(12)
    recent = [serialize(a) for a in audits]

    from datetime import date as _date
    ins = await db.insurance.find({"deleted_at": {"$exists": False}}).to_list(500)
    for pol in ins:
        rd = pol.get("renewal_date")
        if rd:
            try:
                y, m, dd = [int(x) for x in rd[:10].split("-")]
                days = (_date(y, m, dd) - now.date()).days
                if 0 <= days <= 60:
                    attention.append({"type": "insurance_renewal", "label": f"{pol.get('policy_name')} renewal in {days}d", "value": round2(pol.get("premium", 0)), "path": "/insurance"})
            except Exception:
                pass

    from api_budgets import budget_overview
    budget_data = await budget_overview(this_month)
    next_actions = []
    for item in budget_data["items"]:
        if item["unplanned"]:
            if item["actual"] > 0:
                next_actions.append({
                    "id": f"budget-unplanned:{item['category']}",
                    "label": f"Plan {item['category']} spending",
                    "detail": f"{round2(item['actual'])} posted spending has no category plan yet",
                    "value": item["actual"],
                    "path": "/budgets",
                    "severity": "warning",
                })
            continue
        if item["remaining"] < 0:
            next_actions.append({
                "id": f"budget-over:{item.get('id', item['category'])}",
                "label": f"{item['category']} is over plan",
                "detail": f"Posted spend exceeds available plan by {round2(-item['remaining'])}",
                "value": round2(-item["remaining"]),
                "path": "/budgets",
                "severity": "critical",
            })
        elif item["available"] > 0 and item["percent_used"] is not None and item["percent_used"] >= 80:
            next_actions.append({
                "id": f"budget-near:{item.get('id', item['category'])}",
                "label": f"{item['category']} is nearing its plan",
                "detail": f"{round2(item['percent_used'])}% used · {round2(item['remaining'])} remains",
                "value": item["remaining"],
                "path": "/budgets",
                "severity": "warning",
            })

    pending_transactions = await db.transactions.find({
        "type": "EXPENSE",
        "transaction_status": "PENDING",
        "deleted_at": {"$exists": False},
        "scope": {"$ne": "PROJECT"},
        "project_id": {"$in": [None, ""]},
    }).to_list(20000)
    if pending_transactions:
        pending_total = round2(sum(round2(item.get("amount", 0)) for item in pending_transactions))
        next_actions.append({
            "id": "pending-expenses",
            "label": "Review pending expenses",
            "detail": f"{len(pending_transactions)} expense record(s) are pending and excluded from posted totals",
            "value": pending_total,
            "path": "/expenses",
            "severity": "info",
        })

    from api_planning import _all_events, INCOMING_KINDS, OUTGOING_KINDS
    from datetime import timedelta
    events = await _all_events(90)
    due_horizon = (now.date() + timedelta(days=30)).isoformat()
    current_day = now.date().isoformat()
    available_cash = round2(nw["breakdown"]["bank"] + nw["breakdown"]["cash"])
    daily_cash_change = defaultdict(float)
    for event in events:
        if event["due_date"] > due_horizon:
            continue
        if event["kind"] in INCOMING_KINDS:
            daily_cash_change[event["due_date"]] += event["amount"]
        elif event["kind"] in OUTGOING_KINDS:
            daily_cash_change[event["due_date"]] -= event["amount"]
        if event["kind"] == "GOAL" and event["due_date"] <= due_horizon:
            next_actions.append({
                "id": f"goal-due:{event['id']}",
                "label": f"Review goal: {event['detail']}",
                "detail": f"Target date {event['due_date']} · {round2(event['amount'])} still to fund",
                "value": round2(event["amount"]),
                "path": "/goals",
                "severity": "warning" if event["due_date"] < current_day else "info",
                "due_date": event["due_date"],
            })
        elif event["due_date"] <= due_horizon and event["kind"] not in INCOMING_KINDS:
            next_actions.append({
                "id": f"commitment:{event['id']}",
                "label": event["title"],
                "detail": f"{event['detail']} · due {event['due_date']}",
                "value": round2(event["amount"]),
                "path": event["path"],
                "severity": "critical" if event["due_date"] < current_day else "warning",
                "due_date": event["due_date"],
            })
    projected_cash = available_cash
    minimum_projected_cash = available_cash
    first_negative_date = None
    for due_date, change in sorted(daily_cash_change.items()):
        projected_cash = round2(projected_cash + change)
        minimum_projected_cash = min(minimum_projected_cash, projected_cash)
        if projected_cash < 0 and not first_negative_date:
            first_negative_date = due_date
    if first_negative_date:
        next_actions.append({
            "id": "cash-shortfall",
            "label": "Projected cash may fall below zero",
            "detail": f"The dated 30-day outlook first turns negative on {first_negative_date}; this is a forecast, not a posted balance.",
            "value": minimum_projected_cash,
            "path": "/planner",
            "severity": "critical",
            "due_date": first_negative_date,
        })
    severity_rank = {"critical": 0, "warning": 1, "info": 2}
    next_actions.sort(key=lambda item: (severity_rank.get(item["severity"], 3), item.get("due_date", "9999-99-99"), item["label"]))
    budget_alerts = [
        item for item in next_actions
        if item["id"].startswith(("budget-over:", "budget-near:", "budget-unplanned:"))
    ]
    pending_actions = [item for item in next_actions if item["id"] == "pending-expenses"]
    other_actions = [item for item in next_actions if item not in budget_alerts and item not in pending_actions]
    next_actions = (budget_alerts[:3] + pending_actions[:1] + other_actions)[:8]

    return {
        "net_worth": nw["net_worth"],
        "total_assets": nw["total_assets"],
        "total_liabilities": nw["total_liabilities"],
        "cash": nw["breakdown"]["cash"],
        "bank": nw["breakdown"]["bank"],
        "savings": nw["breakdown"]["savings"],
        "pf_ppf": nw["breakdown"]["pf_ppf"],
        "investments": nw["breakdown"]["investments"],
        "lending_outstanding": round2(lend_out),
        "borrowing_outstanding": round2(borrow_out),
        "month_income": round2(month_income),
        "month_expense": round2(month_expense),
        "month_savings": round2(month_income - month_expense),
        "month_rent_collected": month_rent_collected,
        "project_spend": round2(project_spend),
        "active_projects": active_projects,
        "total_projects": len(projects),
        "total_budget": total_budget,
        "cash_flow": [{"month": k, "in": round2(v["in"]), "out": round2(v["out"]),
                       "net": round2(v["in"] - v["out"])} for k, v in sorted(monthly.items())][-12:],
        "income_breakdown": [{"name": k, "value": round2(v)} for k, v in sorted(income_by_cat.items(), key=lambda x: -x[1])[:8]],
        "expense_breakdown": [{"name": k, "value": round2(v)} for k, v in sorted(expense_by_cat.items(), key=lambda x: -x[1])[:8]],
        "allocation": nw["allocation"],
        "attention": attention,
        "budget_alerts": budget_alerts[:6],
        "next_actions": next_actions[:8],
        "recent_activity": recent,
        "cash_position": {
            "available_now": round2(nw["breakdown"]["bank"] + nw["breakdown"]["cash"]),
            "expected_receivables": round2(lend_out + unpaid_rent),
            "upcoming_obligations": round2(borrow_out),
        },
        "liability_allocation": [
            {"name": "Loans", "value": nw["liability_breakdown"]["loans"]},
            {"name": "Borrowings", "value": nw["liability_breakdown"]["borrowings"]},
        ],
    }


@router.get("/search")
async def financial_search(q: str = "", user: dict = Depends(require_admin)):
    return {"items": await search_financial_records(q)}


@router.get("/dashboard/cashflow")
async def cashflow(period: str = "monthly", user: dict = Depends(require_admin)):
    txns = await db.transactions.find({
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
    }).to_list(50000)

    def bucket(date_str):
        if not date_str:
            return None
        if period == "yearly":
            return date_str[:4]
        if period == "quarterly":
            y = date_str[:4]
            m = int(date_str[5:7] or 1)
            return f"{y}-Q{(m - 1) // 3 + 1}"
        return date_str[:7]

    series = defaultdict(lambda: {"in": 0.0, "out": 0.0})
    total_in = total_out = 0.0
    for t in txns:
        b = bucket(t.get("date"))
        if not b:
            continue
        amt = round2(t.get("amount", 0))
        if t.get("type") == "INCOME":
            series[b]["in"] += amt
            total_in += amt
        elif t.get("type") == "EXPENSE":
            series[b]["out"] += amt
            total_out += amt
    return {
        "total_in": round2(total_in),
        "total_out": round2(total_out),
        "net": round2(total_in - total_out),
        "series": [{"period": k, "in": round2(v["in"]), "out": round2(v["out"]),
                    "net": round2(v["in"] - v["out"])} for k, v in sorted(series.items())],
    }
