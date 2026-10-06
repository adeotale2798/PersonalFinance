from copy import deepcopy
import asyncio
from datetime import date

import pytest
from pydantic import ValidationError

import api_debt_payoff
from api_debt_payoff import DebtPlanRequest, MAX_MONTHS, calculate_debt_payoff


START = date(2026, 1, 31)


def test_zero_interest_loan_has_predictable_payoff_date_and_cost():
    result = calculate_debt_payoff(
        [{"id": "zero", "name": "Zero rate", "outstanding": 120, "interest_rate": 0, "emi": 30}],
        extra_monthly=10,
        start_date=START,
    )

    for strategy in ("avalanche", "snowball"):
        plan = result[strategy]
        assert plan["status"] == "complete"
        assert plan["months"] == 3
        assert plan["payoff_date"] == "2026-03-31"
        assert plan["total_interest"] == 0
        assert plan["debts"][0]["interest_paid"] == 0


def test_negative_rates_and_extra_payments_are_rejected():
    with pytest.raises(ValueError, match="interest_rate"):
        calculate_debt_payoff(
            [{"outstanding": 100, "interest_rate": -1, "emi": 20}],
            start_date=START,
        )
    with pytest.raises(ValidationError):
        DebtPlanRequest(extra_monthly=-1)


def test_extra_payment_reduces_interest_and_shortens_payoff():
    loans = [{"id": "loan", "name": "Loan", "outstanding": 10000, "interest_rate": 12, "emi": 500}]
    without_extra = calculate_debt_payoff(loans, start_date=START)
    with_extra = calculate_debt_payoff(loans, extra_monthly=500, start_date=START)

    for strategy in ("avalanche", "snowball"):
        assert with_extra[strategy]["months"] < without_extra[strategy]["months"]
        assert with_extra[strategy]["total_interest"] < without_extra[strategy]["total_interest"]


def test_avalanche_and_snowball_respect_rate_and_balance_priority():
    loans = [
        {"id": "small-low", "name": "Small low rate", "outstanding": 200, "interest_rate": 2, "emi": 20},
        {"id": "large-high", "name": "Large high rate", "outstanding": 1000, "interest_rate": 20, "emi": 50},
    ]
    snapshot = deepcopy(loans)
    result = calculate_debt_payoff(loans, extra_monthly=100, start_date=START)

    assert result["avalanche"]["payoff_order"][0] == "large-high"
    assert result["snowball"]["payoff_order"][0] == "small-low"
    assert loans == snapshot
    assert result["minimum_only"]["months"] >= result["avalanche"]["months"]


def test_no_payment_is_impossible_without_iterating_the_horizon():
    plan = calculate_debt_payoff(
        [{"id": "stalled", "outstanding": 500, "interest_rate": 8, "emi": 0}],
        start_date=START,
    )["avalanche"]

    assert plan["status"] == "impossible"
    assert plan["months"] == 0
    assert plan["payoff_date"] is None


def test_payment_below_monthly_interest_is_impossible():
    result = calculate_debt_payoff(
        [{"id": "negative-amortization", "outstanding": 500, "interest_rate": 100, "emi": 1}],
        start_date=START,
    )

    assert result["avalanche"]["status"] == "impossible"
    assert result["snowball"]["status"] == "impossible"
    assert result["minimum_only"]["status"] == "impossible"


def test_very_long_payoff_is_bounded_and_reported_as_horizon_exceeded():
    result = calculate_debt_payoff(
        [{"id": "long", "outstanding": 1_000_000, "interest_rate": 0, "emi": 1}],
        start_date=START,
    )

    assert result["avalanche"]["status"] == "horizon_exceeded"
    assert result["avalanche"]["months"] == MAX_MONTHS
    assert result["avalanche"]["debts"][0]["payoff_date"] is None


def test_api_reads_open_loans_and_does_not_write_to_loan_collection(monkeypatch):
    loans = [
        {"id": "open", "name": "Open loan", "outstanding": 500, "interest_rate": 0, "emi": 100},
        {"id": "closed", "name": "Closed loan", "outstanding": 1000, "interest_rate": 0, "emi": 100, "status": "Closed"},
    ]

    class Cursor:
        async def to_list(self, limit):
            assert limit == 500
            return deepcopy(loans)

    class ReadOnlyCollection:
        def find(self, query):
            assert query == {"deleted_at": {"$exists": False}}
            return Cursor()

        def __getattr__(self, name):
            raise AssertionError(f"unexpected loan ledger operation: {name}")

    monkeypatch.setattr(api_debt_payoff, "loan_coll", ReadOnlyCollection())
    response = asyncio.run(api_debt_payoff.debt_payoff_plan(
        DebtPlanRequest(extra_monthly=50, start_date=START),
    ))

    assert response["avalanche"]["debts"][0]["id"] == "open"
    assert loans[0]["outstanding"] == 500
    assert loans[1]["outstanding"] == 1000
