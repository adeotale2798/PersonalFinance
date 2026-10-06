"""Read-only debt payoff projections using registered loan accounts."""
from calendar import monthrange
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core import db, require_admin

router = APIRouter(tags=["debt-payoff"])
loan_coll = db["loans"]
MAX_MONTHS = 1200
CENT = Decimal("0.01")


class DebtPlanRequest(BaseModel):
    extra_monthly: float = Field(default=0, ge=0, le=100_000_000)
    start_date: date | None = None


def _money(value, field, *, allow_zero=True):
    try:
        amount = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"{field} must be a valid number") from None
    if not amount.is_finite() or amount < 0 or (not allow_zero and amount == 0):
        raise ValueError(f"{field} must be {'positive' if not allow_zero else 'non-negative'}")
    return amount.quantize(CENT, rounding=ROUND_HALF_UP)


def _rate(value):
    try:
        rate = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError("interest_rate must be a valid number") from None
    if not rate.is_finite() or rate < 0 or rate > 100:
        raise ValueError("interest_rate must be between 0 and 100")
    return rate


def _add_months(day, months):
    month_index = day.month - 1 + months
    year = day.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(day.day, monthrange(year, month)[1]))


def _normalise_debts(debts):
    normalised = []
    seen_ids = set()
    for index, debt in enumerate(debts):
        balance = _money(debt.get("outstanding"), "outstanding")
        rate = _rate(debt.get("interest_rate"))
        payment = _money(debt.get("emi"), "emi")
        debt_id = str(debt.get("id") or debt.get("_id") or index)
        if debt_id in seen_ids:
            debt_id = f"{debt_id}-{index}"
        seen_ids.add(debt_id)
        if balance == 0:
            continue
        normalised.append({
            "id": debt_id,
            "name": str(debt.get("name") or "Loan"),
            "balance": balance,
            "rate": rate,
            "emi": payment,
            "input_order": index,
        })
    return normalised


def _simulate(debts, extra_monthly, start_date, strategy):
    accounts = [
        {**debt, "interest_paid": Decimal("0"), "payoff_month": None}
        for debt in debts
    ]
    extra = _money(extra_monthly, "extra_monthly")
    total_interest = Decimal("0")
    if not accounts:
        return {
            "strategy": strategy,
            "status": "complete",
            "months": 0,
            "payoff_date": start_date.isoformat(),
            "total_interest": 0,
            "total_paid": 0,
            "debts": [],
            "payoff_order": [],
        }

    minimum_only = sum((account["emi"] for account in accounts), Decimal("0"))
    if minimum_only + extra == 0:
        return _simulation_result(accounts, strategy, "impossible", 0, start_date, total_interest)

    for month in range(1, MAX_MONTHS + 1):
        balances_before_payment = [account["balance"] for account in accounts]
        # Interest is accrued monthly and rounded to cents to make every
        # displayed amount agree with the payoff schedule.
        for account in accounts:
            if account["balance"] <= 0:
                continue
            interest = (account["balance"] * account["rate"] / Decimal("1200")).quantize(
                CENT, rounding=ROUND_HALF_UP
            )
            account["balance"] += interest
            account["interest_paid"] += interest
            total_interest += interest

        capacity = (
            extra + sum((account["emi"] for account in accounts), Decimal("0"))
            if strategy != "minimum_only"
            else Decimal("0")
        )
        for account in accounts:
            if account["balance"] <= 0:
                continue
            due = account["balance"]
            payment = min(account["emi"], due)
            account["balance"] -= payment
            if strategy != "minimum_only":
                capacity -= payment

        candidates = [account for account in accounts if account["balance"] > 0]
        if strategy == "avalanche":
            candidates.sort(key=lambda item: (-item["rate"], item["input_order"]))
        elif strategy == "snowball":
            candidates.sort(key=lambda item: (item["balance"], item["input_order"]))

        if strategy != "minimum_only":
            for account in candidates:
                if capacity <= 0:
                    break
                payment = min(account["balance"], capacity)
                account["balance"] -= payment
                capacity -= payment

        for account in accounts:
            if account["balance"] <= 0 and account["payoff_month"] is None:
                account["balance"] = Decimal("0")
                account["payoff_month"] = month

        if all(account["balance"] == 0 for account in accounts):
            return _simulation_result(accounts, strategy, "complete", month, start_date, total_interest)

        if len(accounts) == 1 and accounts[0]["balance"] >= balances_before_payment[0]:
            return _simulation_result(accounts, strategy, "impossible", month, start_date, total_interest)

        if not any(account["payoff_month"] == month for account in accounts) and capacity == extra and all(
            account["emi"] == 0 for account in accounts
        ):
            return _simulation_result(accounts, strategy, "impossible", month, start_date, total_interest)

    return _simulation_result(accounts, strategy, "horizon_exceeded", MAX_MONTHS, start_date, total_interest)


def _simulation_result(accounts, strategy, status, months, start_date, total_interest):
    debt_results = []
    for account in accounts:
        payoff_month = account["payoff_month"]
        debt_results.append({
            "id": account["id"],
            "name": account["name"],
            "starting_balance": float(account["starting_balance"]),
            "interest_paid": float(account["interest_paid"]),
            "months": payoff_month,
            "payoff_date": _add_months(start_date, payoff_month - 1).isoformat() if payoff_month else None,
            "status": "paid_off" if payoff_month else "not_paid_within_horizon",
            "remaining_balance": float(account["balance"]),
        })

    payoff_order = [
        item["id"] for item in sorted(
            (item for item in debt_results if item["months"] is not None),
            key=lambda item: (item["months"], item["id"]),
        )
    ]
    return {
        "strategy": strategy,
        "status": status,
        "months": months,
        "payoff_date": _add_months(start_date, months - 1).isoformat() if status == "complete" else None,
        "total_interest": float(total_interest),
        "total_paid": float(
            sum((account["starting_balance"] for account in accounts), Decimal("0"))
            + total_interest
            - sum((account["balance"] for account in accounts), Decimal("0"))
        ),
        "debts": debt_results,
        "payoff_order": payoff_order,
    }


def calculate_debt_payoff(debts, extra_monthly: float = 0.0, start_date: date | None = None):
    """Return minimum-only, avalanche, and snowball estimates without mutating debts."""
    start_date = start_date or date.today()
    normalised = _normalise_debts(debts)
    # Keep the opening balance immutable for response totals.
    for account in normalised:
        account["starting_balance"] = account["balance"]
    return {
        "extra_monthly": float(_money(extra_monthly, "extra_monthly")),
        "currency": "INR",
        "max_months": MAX_MONTHS,
        "minimum_only": _simulate(normalised, 0, start_date, "minimum_only"),
        "avalanche": _simulate(normalised, extra_monthly, start_date, "avalanche"),
        "snowball": _simulate(normalised, extra_monthly, start_date, "snowball"),
    }


@router.post("/debt-payoff/plan", dependencies=[Depends(require_admin)])
async def debt_payoff_plan(
    request: DebtPlanRequest,
):
    """Calculate projections from open loan records; the loan ledger is read-only."""
    try:
        documents = await loan_coll.find({"deleted_at": {"$exists": False}}).to_list(500)
        loans = [
            loan for loan in documents
            if str(loan.get("status") or "Open").strip().lower() not in {"closed", "paid", "paid off", "paid_off"}
        ]
        result = calculate_debt_payoff(
            loans,
            extra_monthly=request.extra_monthly,
            start_date=request.start_date or date.today(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result
