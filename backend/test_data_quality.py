import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace

import api_data_quality


class Cursor:
    def __init__(self, rows):
        self.rows = rows

    def sort(self, _fields):
        return self

    async def to_list(self, _limit):
        return self.rows


class Collection:
    def __init__(self, rows):
        self.rows = rows

    def find(self, _query=None):
        return Cursor(self.rows)


def test_data_quality_flags_estimated_and_stale_valuations(monkeypatch):
    now = datetime(2026, 10, 13, tzinfo=timezone.utc)
    monkeypatch.setattr(api_data_quality, "now_utc", lambda: now)
    monkeypatch.setattr(api_data_quality, "db", SimpleNamespace(
        accounts=Collection([]),
        transactions=Collection([]),
        savings=Collection([]),
        pf_ppf=Collection([]),
        investments=Collection([{
            "_id": "investment-1",
            "name": "Old estimated holding",
            "current_value": 1000,
            "valuation_source": "Manual estimate",
            "valuation_date": "2025-01-01",
        }]),
        assets=Collection([{
            "_id": "asset-invalid-date",
            "name": "Asset with invalid valuation date",
            "current_value": 500,
            "valuation_source": "Statement",
            "valuation_date": "not-a-date",
        }]),
        liabilities=Collection([]),
        loans=Collection([]),
    ))

    result = asyncio.run(api_data_quality.data_quality_summary({}))

    assert result["counts"]["estimated_valuations"] == 1
    assert result["counts"]["stale_valuations"] == 1
    assert result["counts"]["positions_missing_valuation_details"] == 1
    assert {item["kind"] for item in result["findings"]} >= {"ESTIMATED_VALUATION", "STALE_VALUATION"}
