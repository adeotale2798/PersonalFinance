from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from api_cgas import CgasConfiguration, CgasDemandInput, DemandBill, _demand_output


def test_cgas_configuration_accepts_normalized_dates():
    configuration = CgasConfiguration(
        bank_name="Example Bank",
        deposit_date="06-10-2026",
        total_deposited_amount=1250000.50,
        construction_deadline="06/10/2029",
    )

    assert configuration.deposit_date == "2026-10-06"
    assert configuration.total_deposited_amount == 1250000.50
    assert configuration.construction_deadline == "2029-10-06"


def test_cgas_demand_rejects_invalid_or_non_finite_amounts():
    with pytest.raises(ValidationError):
        CgasDemandInput(stage_name="Foundation", requested_amount=float("inf"))

    with pytest.raises(ValidationError):
        DemandBill(amount=-1)


def test_demand_output_summarizes_bills_and_sixty_day_utilization_window():
    result = _demand_output({
        "_id": "example",
        "stage_name": "Foundation",
        "withdrawal_date": "2026-10-06",
        "withdrawn_amount": 1000,
        "utilized_amount": 600,
        "redeposited_amount": 100,
        "bills": [{"amount": 250}, {"amount": 300}],
    })

    assert result["utilization_due_date"] == (date(2026, 10, 6) + timedelta(days=60)).isoformat()
    assert result["bill_total"] == 550
    assert result["unaccounted_amount"] == 300
