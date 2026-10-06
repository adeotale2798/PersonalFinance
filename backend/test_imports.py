import asyncio
from types import SimpleNamespace

from bson import ObjectId

from api_imports import classify_row, detect_provider, parse_rows
import api_imports


def test_classifies_holding_without_inventing_pnl():
    row = classify_row({"Symbol": "TATAMOTORS", "ISIN": "INE155A01022", "Quantity": 120, "Market Value": "12500"})
    assert row["kind"] == "HOLDING"
    assert row["name"] == "TATAMOTORS"
    assert row["quantity"] == 120


def test_classifies_pnl_as_historical_not_current_holding():
    row = classify_row({"Symbol": "TATAMOTORS", "Realized P&L": "-1250"})
    assert row["kind"] == "HISTORICAL_PNL"
    assert row["amount"] == -1250


def test_classifies_realized_pnl_as_historical_without_inventing_a_holding():
    row = classify_row({"Symbol": "TATAMOTORS", "Realized P&L": "-1250"})
    assert row == {
        "kind": "HISTORICAL_PNL",
        "confidence": 0.91,
        "name": "TATAMOTORS",
        "isin": "",
        "amount": -1250.0,
        "reason": "Recognised a realised P&L field; it will not be treated as a current holding.",
    }


def test_detects_zerodha_from_financial_headers():
    assert detect_provider("statement.csv", ["tradingsymbol", "isin"])[0] == "ZERODHA"


def test_parses_csv_rows():
    rows = parse_rows("holdings.csv", b"Symbol,Quantity\nTATAMOTORS,120\n")
    assert rows == [{"Symbol": "TATAMOTORS", "Quantity": "120"}]


def test_preview_reports_invalid_amount_and_date_without_allowing_apply():
    candidate = api_imports._preview_candidate(
        {"Symbol": "TATAMOTORS", "Realized P&L": "not-money", "Trade Date": "31/02/2025"},
        classify_row({"Symbol": "TATAMOTORS", "Realized P&L": "not-money"}),
    )

    assert candidate["errors"] == [
        "P&L amount is not a valid number.",
        "Transaction date is invalid; use YYYY-MM-DD or DD/MM/YYYY.",
    ]
    assert candidate["can_apply"] is False
    assert candidate["planned_change"] == "Add a posted historical Investment P&L transaction"


def test_preview_normalizes_common_import_dates():
    candidate = api_imports._preview_candidate(
        {"Symbol": "TATAMOTORS", "Realized P&L": "-1250", "Trade Date": "06/10/2026"},
        classify_row({"Symbol": "TATAMOTORS", "Realized P&L": "-1250"}),
    )

    assert candidate["occurred_on"] == "2026-10-06"
    assert candidate["errors"] == []
    assert candidate["can_apply"] is True


def test_pnl_duplicate_fingerprint_distinguishes_transaction_dates():
    first = {"name": "TATAMOTORS", "kind": "HISTORICAL_PNL", "amount": -1250, "occurred_on": "2026-10-01"}
    second = {**first, "occurred_on": "2026-10-02"}

    assert api_imports._candidate_fingerprint("ZERODHA", first) != api_imports._candidate_fingerprint("ZERODHA", second)
    assert api_imports._candidate_fingerprint("ZERODHA", first) == api_imports._candidate_fingerprint("ZERODHA", first)


def test_likely_duplicate_uses_signed_type_amount_and_date(monkeypatch):
    class Transactions:
        query = None

        async def find_one(self, query):
            self.query = query
            return {"_id": "existing"}

    transactions = Transactions()
    monkeypatch.setattr(api_imports, "db", SimpleNamespace(transactions=transactions))

    match = asyncio.run(api_imports._likely_existing_transaction({
        "kind": "HISTORICAL_PNL",
        "name": "TATAMOTORS",
        "amount": -1250,
        "occurred_on": "2026-10-06",
    }))

    assert match["_id"] == "existing"
    assert transactions.query["type"] == "EXPENSE"
    assert transactions.query["amount"] == {"$gte": 1249.99, "$lte": 1250.01}
    assert transactions.query["date"] == "2026-10-06"
    assert transactions.query["title"] == {"$regex": "^TATAMOTORS$", "$options": "i"}


def test_undo_restores_only_records_that_still_match_import_snapshot(monkeypatch):
    record_id = ObjectId("64b000000000000000000001")
    before = {"_id": record_id, "amount": 10}
    after = {"_id": record_id, "amount": 20}

    class Collection:
        def __init__(self, current):
            self.current = current
            self.replacements = []

        async def find_one(self, query, session=None):
            return self.current

        async def replace_one(self, query, replacement, session=None):
            self.replacements.append(replacement)
            self.current = replacement

    collection = Collection(after)
    monkeypatch.setattr(api_imports, "db", SimpleNamespace(investments=collection))
    entry = {"collection": "investments", "id": record_id, "before": before, "after": after}

    asyncio.run(api_imports._undo_document(entry))
    assert collection.current == before
    assert collection.replacements == [before]


def test_undo_refuses_to_overwrite_records_changed_after_import(monkeypatch):
    record_id = ObjectId("64b000000000000000000002")
    current = {"_id": record_id, "amount": 30}

    class Collection:
        async def find_one(self, query, session=None):
            return current

        async def replace_one(self, query, replacement, session=None):
            raise AssertionError("Changed records must not be overwritten")

    monkeypatch.setattr(api_imports, "db", SimpleNamespace(investments=Collection()))
    entry = {
        "collection": "investments",
        "id": record_id,
        "before": {"_id": record_id, "amount": 10},
        "after": {"_id": record_id, "amount": 20},
    }

    try:
        asyncio.run(api_imports._undo_document(entry))
    except ValueError as exc:
        assert "changed after import" in str(exc)
    else:
        raise AssertionError("Undo should refuse to overwrite a post-import change")
