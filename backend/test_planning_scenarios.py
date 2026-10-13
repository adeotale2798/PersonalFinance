import asyncio
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

import api_planning


def test_scenario_is_hypothetical_and_models_delayed_rent(monkeypatch):
    monkeypatch.setattr(
        api_planning,
        "compute_account_balances",
        lambda: asyncio.sleep(0, result=({"cash": 100_000}, [])),
    )
    payload = api_planning.ScenarioInput(
        purchase_price=500_000,
        down_payment=200_000,
        loan_amount=300_000,
        annual_interest_rate=0,
        loan_term_months=100,
        monthly_rent=10_000,
        rent_delay_months=2,
        monthly_net_surplus=5_000,
    )

    result = asyncio.run(api_planning.planning_scenario(payload, {}))

    assert result["status"] == "HYPOTHETICAL"
    assert result["starting_cash"] == 100_000
    assert result["immediate_cash_required"] == 200_000
    assert result["estimated_monthly_payment"] == 3_000
    assert result["baseline"][1]["balance"] == 105_000
    assert result["scenario"][0]["balance"] == -100_000
    assert result["scenario"][1]["balance"] == -98_000
    assert result["scenario"][2]["balance"] == -96_000
    assert result["scenario"][3]["balance"] == -84_000
    assert "No ledger, asset or liability records were created or changed." in result["assumptions"]


def test_scenario_rejects_financing_above_purchase_price():
    with pytest.raises(ValidationError):
        api_planning.ScenarioInput(
            purchase_price=100_000,
            down_payment=60_000,
            loan_amount=50_000,
        )
