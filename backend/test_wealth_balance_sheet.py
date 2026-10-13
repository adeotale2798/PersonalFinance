import asyncio
from types import SimpleNamespace

import api_wealth


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


def test_networth_uses_owned_shares_and_classifies_overdrafts(monkeypatch):
    monkeypatch.setattr(
        api_wealth,
        "compute_account_balances",
        lambda: asyncio.sleep(0, result=(
            {"bank-1": 100, "cash-1": -20},
            [
                {"_id": "bank-1", "name": "Joint bank", "type": "BANK", "owner": "Alex", "ownership_percent": 50, "balance_source": "IMPORT", "last_reconciled_at": "2025-01-31"},
                {"_id": "cash-1", "name": "Cash", "type": "CASH", "owner": "Self", "ownership_percent": 100},
            ],
        )),
    )
    monkeypatch.setattr(api_wealth, "savings_coll", Collection([{
        "_id": "savings-1", "name": "Shared deposit", "current_value": 200,
        "owner": "Alex", "ownership_percent": 25,
        "valuation_source": "Statement", "valuation_date": "2025-02-01",
    }]))
    monkeypatch.setattr(api_wealth, "pf_coll", Collection([{
        "_id": "pf-1", "institution": "PF", "current_balance": 300,
        "owner": "Alex", "ownership_percent": 0,
    }]))
    monkeypatch.setattr(api_wealth, "inv_coll", Collection([{
        "_id": "inv-1", "name": "Fund", "current_value": 1000,
        "owner": "Self",
    }]))
    monkeypatch.setattr(api_wealth, "assets_coll", Collection([{
        "_id": "asset-1", "name": "Home", "current_value": 500,
        "owner": "Alex", "ownership_percent": 50,
    }]))
    monkeypatch.setattr(api_wealth, "liab_coll", Collection([{
        "_id": "liability-1", "name": "Shared debt", "outstanding": 100,
        "owner": "Alex", "ownership_percent": 50,
    }]))
    monkeypatch.setattr(api_wealth, "db", SimpleNamespace(
        transactions=Collection([]),
        loans=Collection([{
            "_id": "loan-1", "name": "Loan", "outstanding": 200,
            "owner": "Self", "ownership_percent": 25,
        }]),
        lendings=Collection([
            {
                "_id": "lent-1", "direction": "LENT", "counterparty": "Borrower",
                "amount": 300, "repayments": [{"amount": 100}],
                "owner": "Alex", "ownership_percent": 50,
            },
            {
                "_id": "borrowed-1", "direction": "BORROWED", "amount": 500,
                "repayments": [{"amount": 100}], "owner": "Self",
                "ownership_percent": 50,
            },
        ]),
    ))

    data = asyncio.run(api_wealth.networth_data())

    assert data["breakdown"] == {
        "bank": 50, "cash": 0, "savings": 50, "pf_ppf": 0,
        "investments": 1000, "property": 250, "receivables": 100,
    }
    assert data["total_assets"] == 1450
    assert data["liability_breakdown"] == {
        "loans": 100, "borrowings": 200, "account_overdrafts": 20,
    }
    assert data["total_liabilities"] == 320
    assert data["net_worth"] == 1130
    assert sum(data["breakdown"].values()) == data["total_assets"]
    assert data["positions"][0]["source"] == "IMPORT"
    assert data["positions"][0]["as_of"] == "2025-01-31"
    assert next(row for row in data["positions"] if row["id"] == "pf-1")["owned_value"] == 0
    assert next(row for row in data["positions"] if row["id"] == "cash-1")["side"] == "liability"
