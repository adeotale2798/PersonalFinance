import asyncio
from datetime import date
from types import SimpleNamespace

import api_wealth
from bson import ObjectId


def test_xirr_calculates_annualized_return_from_dated_flows():
    flows = [
        (date(2024, 1, 1), -1000),
        (date(2025, 1, 1), 1210),
    ]

    result, reason = api_wealth._xirr(flows)

    assert reason is None
    assert round(result * 100, 2) == 20.94


def test_xirr_declines_when_cash_flows_have_no_positive_return_side():
    result, reason = api_wealth._xirr([
        (date(2024, 1, 1), -100),
        (date(2025, 1, 1), -20),
    ])

    assert result is None
    assert "Both invested cash and proceeds" in reason


def test_xirr_declines_ambiguous_multiple_sign_changes():
    result, reason = api_wealth._xirr([
        (date(2024, 1, 1), -100),
        (date(2025, 1, 1), 230),
        (date(2026, 1, 1), -132),
    ])

    assert result is None
    assert "changes direction multiple times" in reason


def test_performance_requires_dated_valuation_and_cash_flows(monkeypatch):
    class InvestmentCollection:
        async def find_one(self, _query):
            return {"_id": ObjectId("64b000000000000000000003"), "current_value": 1200, "valuation_date": "2025-01-01"}

    class ActivityCollection:
        def find(self, _query):
            return SimpleNamespace(to_list=lambda _limit: asyncio.sleep(0, result=[
                {"date": "2024-01-01", "type": "CONTRIBUTION", "amount": 1000},
            ]))

    class ValuationCollection:
        def find(self, _query):
            return SimpleNamespace(sort=lambda *_args: SimpleNamespace(
                to_list=lambda _limit: asyncio.sleep(0, result=[]),
            ))

    monkeypatch.setattr(api_wealth, "inv_coll", InvestmentCollection())
    monkeypatch.setattr(api_wealth, "db", SimpleNamespace(
        investment_activities=ActivityCollection(),
        investment_valuations=ValuationCollection(),
    ))

    result = asyncio.run(api_wealth.investment_performance("64b000000000000000000003", {}))

    assert result["status"] == "AVAILABLE"
    assert result["method"] == "XIRR"
    assert result["xirr"] > 19
    assert result["annualized"] is True
