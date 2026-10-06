"""Date-based financial calendar backed by the transaction ledger."""
from calendar import monthrange
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException

from core import db, now_utc, require_admin, round2, serialize
from api_recurring import advance_due_date

router = APIRouter(tags=["calendar"])


def _valid_period(year: int, month: int | None, day: str | None):
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=422, detail="Year must be between 2000 and 2100")
    if month is not None and not 1 <= month <= 12:
        raise HTTPException(status_code=422, detail="Month must be between 1 and 12")
    if day:
        try:
            selected = date.fromisoformat(day)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Date must use YYYY-MM-DD") from exc
        if selected.year != year or (month is not None and selected.month != month):
            raise HTTPException(status_code=422, detail="Date must match the selected year and month")
        return selected
    return None


def _months_between(first: date, last: date):
    year, month = first.year, first.month
    while (year, month) <= (last.year, last.month):
        yield year, month
        month += 1
        if month == 13:
            year += 1
            month = 1


def _monthly_loan_dates(due: date, end: date):
    """Project monthly EMI dates without accumulating month-end date drift."""
    anchor_day = due.day
    for year, month in _months_between(due, end):
        occurrence = date(year, month, min(anchor_day, monthrange(year, month)[1]))
        if due <= occurrence <= end:
            yield occurrence


def _commitment(title, on_date, amount, kind, path, detail, source_id):
    return {
        "id": f"{kind}:{source_id}:{on_date}",
        "title": title,
        "date": on_date,
        "amount": round2(amount),
        "kind": kind,
        "path": path,
        "detail": detail,
        "source_id": source_id,
        "status": "SCHEDULED",
    }


async def _commitments(start: date, end: date):
    start_s, end_s = start.isoformat(), end.isoformat()
    events = []
    settings = await db.settings.find_one({"$or": [{"settings_key": "app"}, {"_id": "app"}]}) or {}
    timezone_name = settings.get("timezone") or "Asia/Kolkata"
    try:
        today = now_utc().astimezone(ZoneInfo(timezone_name)).date()
    except ZoneInfoNotFoundError:
        today = now_utc().date()

    loans = await db.loans.find({
        "deleted_at": {"$exists": False},
        "status": {"$ne": "Closed"},
        "$or": [
            {"next_due_date": {"$lte": end_s}},
            {"next_due_date": {"$exists": False}, "due_date": {"$lte": end_s}},
        ],
    }).to_list(500)
    for loan in loans:
        due_value = loan.get("next_due_date") or loan.get("due_date")
        try:
            due = date.fromisoformat(due_value[:10])
        except (TypeError, ValueError):
            continue
        if due < today:
            continue
        outstanding = round2(loan.get("outstanding", 0))
        emi = round2(loan.get("emi", 0))
        if emi <= 0 or outstanding <= 0:
            continue
        monthly_rate = max(0.0, round2(loan.get("interest_rate", 0))) / 1200
        remaining_balance = outstanding
        final_due = end
        if loan.get("maturity_date"):
            try:
                final_due = min(final_due, date.fromisoformat(loan["maturity_date"][:10]))
            except (TypeError, ValueError):
                pass
        for occurrence in _monthly_loan_dates(due, final_due):
            accrued_interest = round2(remaining_balance * monthly_rate)
            payment = min(emi, round2(remaining_balance + accrued_interest))
            events.append(_commitment(
                "Loan EMI", occurrence.isoformat(), payment, "LOAN_EMI",
                "/loans", loan.get("name") or loan.get("lender") or "Loan", str(loan["_id"]),
            ))
            remaining_balance = max(0, round2(remaining_balance + accrued_interest - payment))
            if remaining_balance <= 0:
                break

    source_specs = (
        ("insurance", "renewal_date", "Insurance renewal", "INSURANCE", "/insurance", "policy_name", "premium", {"status": {"$ne": "Lapsed"}}),
        ("goals", "target_date", "Goal target", "GOAL", "/goals", "name", "target_amount", {}),
        ("pf_ppf", "next_contribution_date", "Contribution", "CONTRIBUTION", "/pf-ppf", "institution", "expected_contribution", {}),
        ("notifications", "due_date", "Reminder", "REMINDER", "/notifications", "title", "amount", {"kind": "CUSTOM_REMINDER", "status": "OPEN"}),
    )
    for collection, date_field, title, kind, path, label_field, amount_field, extra in source_specs:
        records = await db[collection].find({
            **extra,
            "deleted_at": {"$exists": False},
            date_field: {"$gte": start_s, "$lte": end_s},
        }).to_list(2000)
        for item in records:
            if collection == "goals":
                amount = max(round2(item.get("target_amount", 0)) - round2(item.get("current_amount", 0)), 0)
            else:
                amount = round2(item.get(amount_field, 0))
            if amount:
                events.append(_commitment(
                    title, item[date_field][:10], amount, kind, path,
                    item.get(label_field) or item.get("policy_name") or "Scheduled item", str(item["_id"]),
                ))

    for collection, title, kind, path, label in (
        ("rent_payments", "Rent collection", "RENT_COLLECTION", "/rental", "property_name"),
        ("farm_rent_payments", "Farm rent collection", "RENT_COLLECTION", "/farms", "farm_name"),
    ):
        records = await db[collection].find({
            "deleted_at": {"$exists": False},
            "status": {"$in": ["PENDING", "PARTIAL"]},
            "due_date": {"$gte": start_s, "$lte": end_s},
        }).to_list(2000)
        for item in records:
            amount = max(round2(item.get("amount_due", 0)) - round2(item.get("amount_received", 0)), 0)
            if amount:
                events.append(_commitment(
                    title, item["due_date"][:10], amount, kind, path,
                    item.get(label) or item.get("tenant") or "Collection", str(item["_id"]),
                ))

    for item in await db.lendings.find({
        "deleted_at": {"$exists": False},
        "due_date": {"$gte": start_s, "$lte": end_s},
    }).to_list(2000):
        paid = sum(round2(row.get("amount", 0)) for row in item.get("repayments", []) or [])
        remaining = max(round2(item.get("amount", 0)) - paid, 0)
        if remaining:
            borrowed = item.get("direction") == "BORROWED"
            events.append(_commitment(
                "Borrowing repayment" if borrowed else "Lending recovery",
                item["due_date"][:10], remaining, "BORROWING" if borrowed else "LENDING",
                "/lending", item.get("counterparty") or "Counterparty", str(item["_id"]),
            ))

    schedules = await db.recurring_schedules.find({
        "deleted_at": {"$exists": False},
        "status": "active",
    }).to_list(2000)
    for schedule in schedules:
        try:
            due = date.fromisoformat(schedule["next_due_date"])
            cadence = schedule["cadence"]
            anchor_day = due.day
        except (KeyError, TypeError, ValueError):
            continue
        if due > end:
            continue
        threshold = max(start, today)
        for _ in range(2400):
            if due >= threshold:
                break
            try:
                due = advance_due_date(due, cadence, anchor_day)
            except ValueError:
                due = end + date.resolution
                break
        if due < threshold:
            continue
        while due <= end:
            events.append(_commitment(
                schedule.get("name") or "Recurring bill", due.isoformat(),
                schedule.get("amount", 0), "RECURRING_BILL", "/recurring",
                schedule.get("category") or "Subscription", str(schedule["_id"]),
            ))
            try:
                due = advance_due_date(due, cadence, anchor_day)
            except ValueError:
                break

    return sorted(events, key=lambda event: (event["date"], event["kind"], event["title"]))


def _transaction_totals(transactions):
    totals = {
        "income": 0.0, "expense": 0.0, "pending_income": 0.0,
        "pending_expense": 0.0, "transaction_count": 0, "pending_count": 0,
    }
    for item in transactions:
        kind = item.get("type")
        if kind not in ("INCOME", "EXPENSE") or item.get("transaction_status") == "VOID":
            continue
        amount = round2(item.get("amount", 0))
        status = item.get("transaction_status", "POSTED")
        key = ("pending_" if status == "PENDING" else "") + kind.lower()
        totals[key] = round2(totals[key] + amount)
        totals["pending_count" if status == "PENDING" else "transaction_count"] += 1
    totals["net"] = round2(totals["income"] - totals["expense"])
    return totals


@router.get("/calendar")
async def financial_calendar(
    year: int,
    month: int | None = None,
    day: str | None = None,
    user: dict = Depends(require_admin),
):
    selected_day = _valid_period(year, month, day)
    if selected_day:
        start, end, view = selected_day, selected_day, "day"
    elif month:
        start = date(year, month, 1)
        end = date(year, month, monthrange(year, month)[1])
        view = "month"
    else:
        start, end, view = date(year, 1, 1), date(year, 12, 31), "year"

    transactions = await db.transactions.find({
        "deleted_at": {"$exists": False},
        "type": {"$in": ["INCOME", "EXPENSE"]},
        "date": {"$gte": start.isoformat(), "$lte": end.isoformat()},
    }).sort([("date", 1), ("created_at", 1)]).to_list(100000)
    commitments = await _commitments(start, end)
    by_date = {}
    by_month = {}
    commitments_by_date = {}
    commitments_by_month = {}
    for event in commitments:
        commitments_by_date.setdefault(event["date"], []).append(event)
        commitments_by_month.setdefault(event["date"][:7], []).append(event)
    for txn in transactions:
        txn_date = (txn.get("date") or "")[:10]
        if len(txn_date) != 10:
            continue
        by_date.setdefault(txn_date, []).append(txn)
        by_month.setdefault(txn_date[:7], []).append(txn)

    monthly_rows = []
    for m in range(1, 13):
        month_key = f"{year:04d}-{m:02d}"
        txns = by_month.get(month_key, [])
        monthly_rows.append({
            "month": month_key,
            **_transaction_totals(txns),
            "scheduled_total": round2(sum(item["amount"] for item in commitments_by_month.get(month_key, []))),
            "scheduled_count": len(commitments_by_month.get(month_key, [])),
            "days_with_activity": len({
                (item.get("date") or "")[:10] for item in txns
                if item.get("transaction_status") not in ("PENDING", "VOID")
            }),
        })

    all_totals = _transaction_totals(transactions)
    result = {
        "view": view,
        "year": year,
        "totals": all_totals,
        "months": monthly_rows,
        "scheduled_total": round2(sum(item["amount"] for item in commitments)),
        "scheduled_count": len(commitments),
    }
    if view in ("month", "day"):
        month_start = selected_day.replace(day=1) if selected_day else start
        days_in_month = monthrange(month_start.year, month_start.month)[1]
        result["month"] = f"{month_start.year:04d}-{month_start.month:02d}"
        result["days"] = [
            {
                "date": date(month_start.year, month_start.month, d).isoformat(),
                **_transaction_totals(by_date.get(date(month_start.year, month_start.month, d).isoformat(), [])),
                "commitments": commitments_by_date.get(date(month_start.year, month_start.month, d).isoformat(), []),
            }
            for d in range(1, days_in_month + 1)
        ]
    if view == "day":
        result["date"] = start.isoformat()
        result["transactions"] = [serialize(item) for item in by_date.get(start.isoformat(), [])]
        result["commitments"] = commitments_by_date.get(start.isoformat(), [])
    elif view == "month":
        result["commitments"] = commitments
    return result
