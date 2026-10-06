from datetime import date

import pytest
from fastapi import HTTPException

from api_calendar import _monthly_loan_dates, _transaction_totals, _valid_period


def test_calendar_period_validation_and_leap_day():
    assert _valid_period(2024, 2, "2024-02-29") == date(2024, 2, 29)
    with pytest.raises(HTTPException):
        _valid_period(2023, 2, "2023-02-29")
    with pytest.raises(HTTPException):
        _valid_period(2024, 13, None)
    with pytest.raises(HTTPException):
        _valid_period(2024, 2, "2024-03-01")
    with pytest.raises(HTTPException):
        _valid_period(1999, None, None)


def test_monthly_emi_projection_keeps_anchor_day_and_clamps_month_ends():
    occurrences = list(_monthly_loan_dates(date(2024, 1, 31), date(2024, 4, 30)))
    assert occurrences == [
        date(2024, 1, 31),
        date(2024, 2, 29),
        date(2024, 3, 31),
        date(2024, 4, 30),
    ]


def test_calendar_totals_separate_pending_and_ignore_void_and_transfers():
    totals = _transaction_totals([
        {"type": "INCOME", "amount": 200, "transaction_status": "POSTED"},
        {"type": "EXPENSE", "amount": 50},
        {"type": "EXPENSE", "amount": 10, "transaction_status": "PENDING"},
        {"type": "INCOME", "amount": 12, "transaction_status": "VOID"},
        {"type": "TRANSFER", "amount": 25, "transaction_status": "POSTED"},
    ])
    assert totals == {
        "income": 200,
        "expense": 50,
        "pending_income": 0,
        "pending_expense": 10,
        "transaction_count": 2,
        "pending_count": 1,
        "net": 150,
    }
