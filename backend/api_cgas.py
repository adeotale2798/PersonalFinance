"""Project-scoped CGAS construction demands and utilization records."""
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core import db, log_audit, normalize_date, now_utc, oid, round2, serialize
from core import require_admin

router = APIRouter(tags=["construction-cgas"])

DEMAND_STATUSES = {
    "DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "PARTIALLY_RELEASED",
    "RELEASED", "COMPLETED",
}


def clean_optional_date(value: str | None) -> str | None:
    if value in (None, ""):
        return None
    try:
        normalized = normalize_date(value)
        if normalized is None:
            raise ValueError("Date must be a valid date")
        date.fromisoformat(normalized)
        return normalized
    except (TypeError, ValueError, HTTPException) as exc:
        raise ValueError("Date must be a valid date") from exc


class CgasConfiguration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bank_name: str = Field(default="", max_length=120)
    account_id: str | None = Field(default=None, max_length=64)
    deposit_date: str | None = None
    total_deposited_amount: float = Field(default=0, ge=0, allow_inf_nan=False)
    construction_deadline: str | None = None
    notes: str = Field(default="", max_length=1000)

    @field_validator("deposit_date", "construction_deadline")
    @classmethod
    def validate_dates(cls, value: str | None) -> str | None:
        return clean_optional_date(value)


class DemandBill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contractor: str = Field(default="", max_length=160)
    bill_number: str = Field(default="", max_length=100)
    bill_date: str | None = None
    amount: float = Field(ge=0, allow_inf_nan=False)

    @field_validator("bill_date")
    @classmethod
    def validate_bill_date(cls, value: str | None) -> str | None:
        return clean_optional_date(value)


class CgasDemandInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage_name: str = Field(min_length=1, max_length=120)
    requested_amount: float = Field(ge=0, allow_inf_nan=False)
    requested_date: str | None = None
    bank_reference: str = Field(default="", max_length=120)
    status: Literal[
        "DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "PARTIALLY_RELEASED",
        "RELEASED", "COMPLETED",
    ] = "DRAFT"
    bills: list[DemandBill] = Field(default_factory=list, max_length=50)
    withdrawn_amount: float = Field(default=0, ge=0, allow_inf_nan=False)
    withdrawal_date: str | None = None
    utilized_amount: float = Field(default=0, ge=0, allow_inf_nan=False)
    redeposited_amount: float = Field(default=0, ge=0, allow_inf_nan=False)
    notes: str = Field(default="", max_length=2000)

    @field_validator("requested_date", "withdrawal_date")
    @classmethod
    def validate_dates(cls, value: str | None) -> str | None:
        return clean_optional_date(value)

    @field_validator("stage_name")
    @classmethod
    def strip_stage_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Stage name is required")
        return value


async def _construction_project(project_id: str) -> dict:
    project = await db.projects.find_one({
        "_id": oid(project_id),
        "deleted_at": {"$exists": False},
    })
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if (project.get("type") or "").strip().lower() not in ("construction", "renovation"):
        raise HTTPException(status_code=422, detail="CGAS tracking is available for construction projects")
    return project


def _demand_output(document: dict) -> dict:
    result = serialize(document)
    withdrawal_date = result.get("withdrawal_date")
    if withdrawal_date:
        result["utilization_due_date"] = (
            date.fromisoformat(withdrawal_date) + timedelta(days=60)
        ).isoformat()
    else:
        result["utilization_due_date"] = None
    result["unaccounted_amount"] = round2(max(
        0,
        round2(result.get("withdrawn_amount", 0))
        - round2(result.get("utilized_amount", 0))
        - round2(result.get("redeposited_amount", 0)),
    ))
    result["bill_total"] = round2(sum(
        round2(bill.get("amount", 0)) for bill in result.get("bills", [])
    ))
    return result


@router.get("/projects/{project_id}/cgas", dependencies=[Depends(require_admin)])
async def get_cgas_project(project_id: str):
    await _construction_project(project_id)
    configuration = await db.cgas_projects.find_one({"project_id": project_id})
    demands = await db.cgas_demands.find({
        "project_id": project_id,
        "deleted_at": {"$exists": False},
    }).sort([("created_at", -1)]).to_list(1000)
    return {
        "configuration": serialize(configuration) if configuration else None,
        "demands": [_demand_output(demand) for demand in demands],
    }


@router.put("/projects/{project_id}/cgas")
async def update_cgas_project(
    project_id: str,
    payload: CgasConfiguration,
    user: dict = Depends(require_admin),
):
    await _construction_project(project_id)
    values = payload.model_dump()
    values["total_deposited_amount"] = round2(values["total_deposited_amount"])
    account_id = values.get("account_id")
    if account_id:
        account = await db.accounts.find_one({
            "_id": oid(account_id),
            "deleted_at": {"$exists": False},
        })
        if not account:
            raise HTTPException(status_code=422, detail="Choose an active account in this workspace")
        values["account_name"] = account.get("name", "")
    else:
        values["account_name"] = ""
    values.update({"project_id": project_id, "updated_at": now_utc()})
    await db.cgas_projects.update_one(
        {"project_id": project_id},
        {"$set": values, "$setOnInsert": {"created_at": now_utc()}},
        upsert=True,
    )
    await log_audit(user, "update_cgas_project", "projects", project_id, {
        "bank_name": values.get("bank_name"),
        "account_id": account_id,
        "construction_deadline": values.get("construction_deadline"),
    })
    saved = await db.cgas_projects.find_one({"project_id": project_id})
    return serialize(saved)


@router.post("/projects/{project_id}/cgas/demands")
async def create_cgas_demand(
    project_id: str,
    payload: CgasDemandInput,
    user: dict = Depends(require_admin),
):
    await _construction_project(project_id)
    configuration = await db.cgas_projects.find_one({"project_id": project_id})
    if not configuration:
        raise HTTPException(status_code=409, detail="Set up the project's CGAS details before adding a demand")
    values = payload.model_dump()
    if values["status"] != "DRAFT" and not values["bills"]:
        raise HTTPException(status_code=422, detail="Add at least one contractor bill before submitting a demand")
    withdrawn = round2(values["withdrawn_amount"])
    utilized = round2(values["utilized_amount"])
    redeposited = round2(values["redeposited_amount"])
    if utilized + redeposited > withdrawn:
        raise HTTPException(status_code=422, detail="Utilized and redeposited amounts cannot exceed the withdrawal")
    if withdrawn and not values.get("withdrawal_date"):
        raise HTTPException(status_code=422, detail="Enter the date of the actual withdrawal")
    values.update({
        "project_id": project_id,
        "requested_amount": round2(values["requested_amount"]),
        "withdrawn_amount": withdrawn,
        "utilized_amount": utilized,
        "redeposited_amount": redeposited,
        "created_at": now_utc(),
        "created_by": user.get("email"),
    })
    result = await db.cgas_demands.insert_one(values)
    await log_audit(user, "create_cgas_demand", "cgas_demands", str(result.inserted_id), {
        "project_id": project_id,
        "stage_name": values["stage_name"],
        "requested_amount": values["requested_amount"],
    })
    return _demand_output(await db.cgas_demands.find_one({"_id": result.inserted_id}))


@router.put("/projects/{project_id}/cgas/demands/{demand_id}")
async def update_cgas_demand(
    project_id: str,
    demand_id: str,
    payload: CgasDemandInput,
    user: dict = Depends(require_admin),
):
    await _construction_project(project_id)
    existing = await db.cgas_demands.find_one({
        "_id": oid(demand_id),
        "project_id": project_id,
        "deleted_at": {"$exists": False},
    })
    if not existing:
        raise HTTPException(status_code=404, detail="CGAS demand not found")
    values = payload.model_dump()
    if round2(existing.get("withdrawn_amount", 0)) > 0 and round2(values["withdrawn_amount"]) <= 0:
        raise HTTPException(status_code=409, detail="An actual withdrawal cannot be cleared from its demand history")
    if values["status"] != "DRAFT" and not values["bills"]:
        raise HTTPException(status_code=422, detail="Add at least one contractor bill before submitting a demand")
    withdrawn = round2(values["withdrawn_amount"])
    utilized = round2(values["utilized_amount"])
    redeposited = round2(values["redeposited_amount"])
    if utilized + redeposited > withdrawn:
        raise HTTPException(status_code=422, detail="Utilized and redeposited amounts cannot exceed the withdrawal")
    if withdrawn and not values.get("withdrawal_date"):
        raise HTTPException(status_code=422, detail="Enter the date of the actual withdrawal")
    values.update({
        "requested_amount": round2(values["requested_amount"]),
        "withdrawn_amount": withdrawn,
        "utilized_amount": utilized,
        "redeposited_amount": redeposited,
        "updated_at": now_utc(),
        "updated_by": user.get("email"),
    })
    await db.cgas_demands.update_one({"_id": existing["_id"]}, {"$set": values})
    await log_audit(user, "update_cgas_demand", "cgas_demands", demand_id, {
        "project_id": project_id,
        "status": values["status"],
        "withdrawn_amount": withdrawn,
        "utilized_amount": utilized,
        "redeposited_amount": redeposited,
    })
    return _demand_output(await db.cgas_demands.find_one({"_id": existing["_id"]}))


@router.delete("/projects/{project_id}/cgas/demands/{demand_id}")
async def delete_cgas_demand(
    project_id: str,
    demand_id: str,
    user: dict = Depends(require_admin),
):
    await _construction_project(project_id)
    demand = await db.cgas_demands.find_one({
        "_id": oid(demand_id),
        "project_id": project_id,
        "deleted_at": {"$exists": False},
    })
    if not demand:
        raise HTTPException(status_code=404, detail="CGAS demand not found")
    if round2(demand.get("withdrawn_amount", 0)) > 0:
        raise HTTPException(status_code=409, detail="A demand with an actual withdrawal cannot be deleted")
    await db.cgas_demands.update_one(
        {"_id": demand["_id"]},
        {"$set": {"deleted_at": now_utc(), "deleted_by": user.get("email")}},
    )
    await db.documents.update_many(
        {
            "related_entity_type": "cgas_demand",
            "related_entity_id": demand_id,
            "deleted_at": {"$exists": False},
        },
        {"$set": {"deleted_at": now_utc()}},
    )
    await log_audit(user, "delete_cgas_demand", "cgas_demands", demand_id, {
        "project_id": project_id,
        "stage_name": demand.get("stage_name"),
    })
    return {"status": "deleted", "id": demand_id}
