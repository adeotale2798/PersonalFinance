"""Finance: accounts, transactions (income/expense/transfer), settings."""
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field, field_validator
from core import db, serialize, oid, now_utc, require_admin, round2, log_audit, normalize_date, validate_financial_payload
from account_permissions import (
    HOUSEHOLD_ROLE,
    account_object_ids,
    granted_account_ids,
    require_account_access,
    require_account_user,
    require_transaction_accounts,
)

router = APIRouter(tags=["finance"])


class ReconciliationInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    statement_balance: float = Field(allow_inf_nan=False)
    as_of_date: str
    note: str = Field(default="", max_length=500)

    @field_validator("statement_balance", mode="before")
    @classmethod
    def reject_boolean_balance(cls, value):
        if isinstance(value, bool):
            raise ValueError("Statement balance must be a number")
        return value


# ---------------- helpers ----------------
async def compute_account_balances(as_of_date=None, account_ids: set[str] | None = None):
    account_query = {"deleted_at": {"$exists": False}}
    if account_ids is not None:
        if not account_ids:
            return {}, []
        account_query["_id"] = {"$in": account_object_ids(account_ids)}
    accts = await db.accounts.find(account_query).to_list(1000)
    balances = {str(a["_id"]): round2(a.get("opening_balance", 0)) for a in accts}
    query = {"deleted_at": {"$exists": False}}
    if account_ids is not None:
        query["$or"] = [
            {"account_id": {"$in": list(account_ids)}},
            {"to_account_id": {"$in": list(account_ids)}},
        ]
    if as_of_date:
        query["date"] = {"$lte": as_of_date}
    txns = await db.transactions.find(query).to_list(50000)
    for t in txns:
        amt = round2(t.get("amount", 0))
        typ = t.get("type")
        acc = t.get("account_id")
        to_acc = t.get("to_account_id")
        if t.get("transaction_status") in ("PENDING", "VOID"):
            continue
        if account_ids is not None and typ == "TRANSFER" and not ({acc, to_acc} <= account_ids):
            continue
        if typ == "INCOME" and acc in balances:
            balances[acc] += amt
        elif typ == "EXPENSE" and acc in balances:
            balances[acc] -= amt
        elif typ == "TRANSFER":
            if acc in balances:
                balances[acc] -= amt
            if to_acc in balances:
                balances[to_acc] += amt
    return balances, accts


# ---------------- accounts ----------------
@router.get("/accounts")
async def list_accounts(user: dict = Depends(require_account_user)):
    account_ids = await granted_account_ids(user) if user.get("role") == HOUSEHOLD_ROLE else None
    balances, accts = await compute_account_balances(account_ids=account_ids)
    access_levels = {}
    if account_ids is not None and account_ids:
        for grant in await db.account_access_grants.find({
            "user_id": str(user["_id"]),
            "active": True,
            "account_id": {"$in": list(account_ids)},
        }).to_list(1000):
            access_levels[grant["account_id"]] = grant.get("access", "read")
    activity_query = {"deleted_at": {"$exists": False}}
    if account_ids is not None:
        if not account_ids:
            return []
        activity_query["$or"] = [
            {"account_id": {"$in": list(account_ids)}},
            {"to_account_id": {"$in": list(account_ids)}},
        ]
    transactions = await db.transactions.find(activity_query).sort([("created_at", -1)]).to_list(50000)
    activity = {}
    for transaction in transactions:
        if transaction.get("transaction_status") in ("PENDING", "VOID"):
            continue
        if account_ids is not None and transaction.get("type") == "TRANSFER" and not (
            {transaction.get("account_id"), transaction.get("to_account_id")} <= account_ids
        ):
            continue
        for account_id in (transaction.get("account_id"), transaction.get("to_account_id")):
            if account_id and account_id not in activity:
                activity[account_id] = transaction
    out = []
    for a in accts:
        d = serialize(a)
        account_id = str(a["_id"])
        latest = activity.get(account_id)
        d["current_balance"] = balances.get(account_id, round2(a.get("opening_balance", 0)))
        d["balance_source"] = (latest or {}).get("record_source") or a.get("balance_source") or "MANUAL"
        d["balance_updated_at"] = serialize({"updated_at": (latest or {}).get("created_at") or a.get("updated_at") or a.get("created_at")}).get("updated_at")
        d["last_reconciled_at"] = a.get("last_reconciled_at")
        d["reconciliation_status"] = a.get("reconciliation_status", "NOT_RECONCILED")
        if account_ids is not None:
            d["access_level"] = access_levels.get(account_id, "read")
        out.append(d)
    return out


@router.post("/accounts")
async def create_account(payload: dict, user: dict = Depends(require_admin)):
    payload = validate_financial_payload(payload)
    if payload.get("balance_source", "MANUAL") not in ("MANUAL", "IMPORT"):
        raise HTTPException(status_code=422, detail="Balance source must be MANUAL or IMPORT")
    payload["opening_balance"] = round2(payload.get("opening_balance", 0))
    payload.setdefault("balance_source", "MANUAL")
    payload.setdefault("status", "ACTIVE")
    payload.setdefault("currency", "INR")
    payload["created_at"] = now_utc()
    res = await db.accounts.insert_one(payload)
    return serialize(await db.accounts.find_one({"_id": res.inserted_id}))


@router.put("/accounts/{item_id}")
async def update_account(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload = validate_financial_payload(payload)
    payload.pop("id", None); payload.pop("_id", None); payload.pop("current_balance", None)
    if "balance_source" in payload and payload["balance_source"] not in ("MANUAL", "IMPORT"):
        raise HTTPException(status_code=422, detail="Balance source must be MANUAL or IMPORT")
    if "opening_balance" in payload:
        payload["opening_balance"] = round2(payload["opening_balance"])
    payload["updated_at"] = now_utc()
    await db.accounts.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.accounts.find_one({"_id": oid(item_id)}))


@router.delete("/accounts/{item_id}")
async def delete_account(item_id: str, user: dict = Depends(require_admin)):
    await db.accounts.delete_one({"_id": oid(item_id)})
    return {"status": "deleted"}


@router.get("/accounts/reconciliations")
async def list_reconciliations(account_id: str | None = None, user: dict = Depends(require_account_user)):
    query = {}
    if account_id:
        await require_account_access(user, account_id)
        query["account_id"] = account_id
    elif user.get("role") == HOUSEHOLD_ROLE:
        account_ids = await granted_account_ids(user)
        if not account_ids:
            return []
        query["account_id"] = {"$in": list(account_ids)}
    docs = await db.account_reconciliations.find(query).sort([("as_of_date", -1), ("created_at", -1)]).to_list(500)
    return [serialize(doc) for doc in docs]

@router.post("/accounts/{item_id}/reconcile")
async def reconcile_account(item_id: str, payload: ReconciliationInput, user: dict = Depends(require_account_user)):
    await require_account_access(user, item_id, "use")
    account_object_id = oid(item_id)
    account = await db.accounts.find_one({"_id": account_object_id, "deleted_at": {"$exists": False}})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    as_of_date = normalize_date(payload.as_of_date)
    balances, _ = await compute_account_balances(
        as_of_date,
        await granted_account_ids(user) if user.get("role") == HOUSEHOLD_ROLE else None,
    )
    app_balance = round2(balances.get(item_id, 0))
    statement_balance = round2(payload.statement_balance)
    difference = round2(statement_balance - app_balance)
    record = {
        "account_id": item_id,
        "account_name": account.get("name", "Account"),
        "as_of_date": as_of_date,
        "statement_balance": statement_balance,
        "app_balance": app_balance,
        "difference": difference,
        "status": "MATCHED" if abs(difference) < 0.01 else "VARIANCE",
        "note": payload.note,
        "recorded_by": user.get("email"),
        "created_at": now_utc(),
    }
    result = await db.account_reconciliations.insert_one(record)
    await db.accounts.update_one(
        {"_id": account_object_id},
        {"$set": {
            "last_reconciled_at": record["created_at"],
            "reconciliation_status": record["status"],
            "updated_at": record["created_at"],
        }},
    )
    await log_audit(user, "reconcile_account", "accounts", item_id, {
        "as_of_date": as_of_date,
        "status": record["status"],
        "difference": difference,
    })
    return serialize({**record, "_id": result.inserted_id})


@router.get("/accounts/{item_id}/reconciliations")
async def account_reconciliations(item_id: str, user: dict = Depends(require_account_user)):
    await require_account_access(user, item_id)
    account_id = oid(item_id)
    if not await db.accounts.find_one({"_id": account_id, "deleted_at": {"$exists": False}}):
        raise HTTPException(status_code=404, detail="Account not found")
    docs = await db.account_reconciliations.find({"account_id": item_id}).sort(
        [("as_of_date", -1), ("created_at", -1)]
    ).to_list(100)
    return [serialize(doc) for doc in docs]


@router.get("/accounts/{item_id}/access")
async def list_account_access(item_id: str, user: dict = Depends(require_admin)):
    account = await db.accounts.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    grants = await db.account_access_grants.find({
        "account_id": item_id,
        "active": True,
    }).sort([("granted_at", -1)]).to_list(500)
    result = []
    for grant in grants:
        try:
            collaborator = await db.users.find_one({"_id": oid(grant["user_id"])})
        except (KeyError, HTTPException):
            collaborator = None
        if collaborator:
            result.append({
                "user_id": grant["user_id"],
                "name": collaborator.get("name"),
                "email": collaborator.get("email"),
                "access": grant.get("access"),
                "granted_at": serialize({"granted_at": grant.get("granted_at")})["granted_at"],
                "granted_by": grant.get("granted_by"),
            })
    return result


@router.post("/accounts/{item_id}/access")
async def grant_account_access(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    account_id = str(oid(item_id))
    account = await db.accounts.find_one({"_id": oid(account_id), "deleted_at": {"$exists": False}})
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    user_id = payload.get("user_id")
    access = payload.get("access", "read")
    if access not in ("read", "use"):
        raise HTTPException(status_code=422, detail="Access must be read or use")
    if not user_id:
        raise HTTPException(status_code=422, detail="User id is required")
    collaborator = await db.users.find_one({"_id": oid(user_id)})
    if not collaborator or collaborator.get("role") != HOUSEHOLD_ROLE or collaborator.get("active") is False:
        raise HTTPException(status_code=422, detail="Access can only be granted to a household collaborator")

    grant_filter = {"account_id": account_id, "user_id": str(collaborator["_id"])}
    granted_at = now_utc()
    await db.account_access_grants.update_one(
        grant_filter,
        {"$set": {
            "access": access,
            "active": True,
            "granted_at": granted_at,
            "granted_by": str(user["_id"]),
            "revoked_at": None,
            "revoked_by": None,
        }},
        upsert=True,
    )
    grant = await db.account_access_grants.find_one(grant_filter)
    await log_audit(user, "grant_account_access", "account_access_grants", account_id, {
        "user_id": str(collaborator["_id"]),
        "access": access,
    })
    return {
        "account_id": account_id,
        "user_id": str(collaborator["_id"]),
        "access": access,
        "active": True,
        "granted_at": serialize({"granted_at": grant.get("granted_at")})["granted_at"],
    }


@router.delete("/accounts/{item_id}/access/{user_id}")
async def revoke_account_access(item_id: str, user_id: str, user: dict = Depends(require_admin)):
    account_id = str(oid(item_id))
    if not await db.accounts.find_one({"_id": oid(account_id), "deleted_at": {"$exists": False}}):
        raise HTTPException(status_code=404, detail="Account not found")
    collaborator = await db.users.find_one({"_id": oid(user_id)})
    if not collaborator or collaborator.get("role") != HOUSEHOLD_ROLE:
        raise HTTPException(status_code=404, detail="Household collaborator not found")
    grant_filter = {"account_id": account_id, "user_id": str(collaborator["_id"]), "active": True}
    grant = await db.account_access_grants.find_one(grant_filter)
    if not grant:
        raise HTTPException(status_code=404, detail="Account access grant not found")
    revoked_at = now_utc()
    await db.account_access_grants.update_one(grant_filter, {"$set": {
        "active": False,
        "revoked_at": revoked_at,
        "revoked_by": str(user["_id"]),
    }})
    await log_audit(user, "revoke_account_access", "account_access_grants", account_id, {
        "user_id": str(collaborator["_id"]),
        "access": grant.get("access"),
    })
    return {"status": "revoked", "account_id": account_id, "user_id": str(collaborator["_id"])}


# ---------------- transactions ----------------
@router.get("/transactions")
async def list_transactions(request: Request, user: dict = Depends(require_account_user)):
    q = {"deleted_at": {"$exists": False}}
    params = dict(request.query_params)
    for key in ("type", "scope", "project_id", "category", "account_id", "family_member_id", "source", "farm_id", "party"):
        if params.get(key):
            q[key] = params[key]
    date_q = {}
    if params.get("from"):
        date_q["$gte"] = params["from"]
    if params.get("to"):
        date_q["$lte"] = params["to"]
    if date_q:
        q["date"] = date_q
    account_ids = await granted_account_ids(user) if user.get("role") == HOUSEHOLD_ROLE else None
    if account_ids is not None:
        if not account_ids:
            return []
        account_id_query = {"$in": list(account_ids)}
        q = {"$and": [
            q,
            {"$or": [
                    {"account_id": account_id_query, "type": {"$ne": "TRANSFER"}},
                    {"account_id": account_id_query, "to_account_id": account_id_query, "type": "TRANSFER"},
                ]},
            ]}
    docs = await db.transactions.find(q).sort([("date", -1), ("created_at", -1)]).to_list(5000)
    if account_ids is not None:
        safe_fields = {
            "_id", "type", "amount", "date", "account_id", "to_account_id",
            "category", "source", "description", "note", "payment_mode",
            "transaction_status", "record_source", "scope", "created_at",
        }
        result = []
        for doc in docs:
            safe_doc = {key: value for key, value in doc.items() if key in safe_fields}
            if doc.get("type") != "TRANSFER":
                safe_doc.pop("to_account_id", None)
            result.append(serialize(safe_doc))
        return result
    return [serialize(d) for d in docs]


@router.post("/transactions")
async def create_transaction(payload: dict, user: dict = Depends(require_account_user)):
    payload = validate_financial_payload(payload)
    await require_transaction_accounts(payload, user)
    payload.setdefault("transaction_status", "POSTED")
    if payload["transaction_status"] not in ("PENDING", "POSTED", "VOID"):
        raise HTTPException(status_code=422, detail="Transaction status must be PENDING, POSTED or VOID")
    payload.setdefault("record_source", "MANUAL")
    if payload["record_source"] not in ("MANUAL", "IMPORT"):
        raise HTTPException(status_code=422, detail="Record source must be MANUAL or IMPORT")
    if payload.get("type") == "EXPENSE" and payload.get("project_id") and payload.get("party"):
        party = await db.parties.find_one({"project_id": payload["project_id"], "name": payload["party"], "deleted_at": {"$exists": False}})
        if not party:
            raise HTTPException(status_code=422, detail="Choose a party belonging to this project")
        payload["party_id"] = str(party["_id"])
    if payload.get("payment_mode") != "UPI":
        payload.pop("utr_number", None)
    if payload.get("type") == "EXPENSE" and payload.get("party_id"):
        payload.setdefault("payment_status", "PENDING_PARTY_ACKNOWLEDGEMENT" if payload.get("payment_mode") in ("Cash", "UPI") else "RECORDED")
    payload["amount"] = round2(payload.get("amount", 0))
    payload.setdefault("scope", "PERSONAL")
    payload["date"] = normalize_date(payload.get("date") or now_utc().date().isoformat())
    payload["created_at"] = now_utc()
    payload["created_by"] = user["email"]
    res = await db.transactions.insert_one(payload)
    await log_audit(user, "create", "transaction", str(res.inserted_id), {"type": payload.get("type"), "amount": payload["amount"]})
    created = await db.transactions.find_one({"_id": res.inserted_id})
    return _serialize_transaction(created, user)


@router.put("/transactions/{item_id}")
async def update_transaction(item_id: str, payload: dict, user: dict = Depends(require_account_user)):
    payload = validate_financial_payload(payload)
    payload.pop("id", None); payload.pop("_id", None)
    if user.get("role") == HOUSEHOLD_ROLE:
        existing = await db.transactions.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
        if not existing:
            raise HTTPException(status_code=404, detail="Transaction not found")
        await require_transaction_accounts(payload, user, existing)
    if "transaction_status" in payload and payload["transaction_status"] not in ("PENDING", "POSTED", "VOID"):
        raise HTTPException(status_code=422, detail="Transaction status must be PENDING, POSTED or VOID")
    if "record_source" in payload and payload["record_source"] not in ("MANUAL", "IMPORT"):
        raise HTTPException(status_code=422, detail="Record source must be MANUAL or IMPORT")
    if "amount" in payload:
        payload["amount"] = round2(payload["amount"])
    if "date" in payload:
        payload["date"] = normalize_date(payload["date"])
    payload["updated_at"] = now_utc()
    await db.transactions.update_one({"_id": oid(item_id)}, {"$set": payload})
    updated = await db.transactions.find_one({"_id": oid(item_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await log_audit(user, "update_transaction", "transaction", item_id, {
        "type": updated.get("type"),
        "amount": updated.get("amount"),
        "transaction_status": updated.get("transaction_status"),
    })
    return _serialize_transaction(updated, user)


@router.delete("/transactions/{item_id}")
async def delete_transaction(item_id: str, user: dict = Depends(require_account_user)):
    if user.get("role") == HOUSEHOLD_ROLE:
        raise HTTPException(status_code=403, detail="Household collaborators cannot permanently delete ledger entries. Mark the transaction void instead.")
    await db.transactions.delete_one({"_id": oid(item_id)})
    return {"status": "deleted"}


def _serialize_transaction(transaction: dict, user: dict) -> dict:
    if user.get("role") != HOUSEHOLD_ROLE:
        return serialize(transaction)
    safe_fields = {
        "_id", "type", "amount", "date", "account_id", "to_account_id",
        "category", "source", "description", "note", "payment_mode",
        "transaction_status", "record_source", "scope", "created_at", "updated_at",
    }
    return serialize({key: value for key, value in transaction.items() if key in safe_fields})


# ---------------- income / expense summaries ----------------
def _month_key(date_str: str) -> str:
    return (date_str or "")[:7]


@router.get("/income/summary")
async def income_summary(user: dict = Depends(require_account_user)):
    account_ids = await granted_account_ids(user) if user.get("role") == HOUSEHOLD_ROLE else None
    return await _txn_summary("INCOME", "source", account_ids)


@router.get("/expenses/summary")
async def expense_summary(user: dict = Depends(require_account_user)):
    account_ids = await granted_account_ids(user) if user.get("role") == HOUSEHOLD_ROLE else None
    return await _txn_summary("EXPENSE", "category", account_ids)


async def _txn_summary(txn_type: str, group_field: str, account_ids: set[str] | None = None):
    query = {
        "type": txn_type,
        "deleted_at": {"$exists": False},
        "transaction_status": {"$nin": ["PENDING", "VOID"]},
    }
    if account_ids is not None:
        if not account_ids:
            docs = []
        else:
            query["account_id"] = {"$in": list(account_ids)}
            docs = await db.transactions.find(query).to_list(20000)
    else:
        docs = await db.transactions.find(query).to_list(20000)
    total = round2(sum(round2(d.get("amount", 0)) for d in docs))
    now = now_utc()
    this_month = now.strftime("%Y-%m")
    this_year = now.strftime("%Y")
    by_group = defaultdict(float)
    by_month = defaultdict(float)
    month_total = 0.0
    year_total = 0.0
    for d in docs:
        amt = round2(d.get("amount", 0))
        by_group[d.get(group_field) or "Uncategorized"] += amt
        mk = _month_key(d.get("date"))
        by_month[mk] += amt
        if mk == this_month:
            month_total += amt
        if (d.get("date") or "")[:4] == this_year:
            year_total += amt
    return {
        "total": total,
        "this_month": round2(month_total),
        "this_year": round2(year_total),
        "by_group": [{"name": k, "value": round2(v)} for k, v in sorted(by_group.items(), key=lambda x: -x[1])],
        "by_month": [{"month": k, "value": round2(v)} for k, v in sorted(by_month.items()) if k],
    }


# ---------------- settings ----------------
DEFAULT_SETTINGS = {
    "currency": "INR",
    "timezone": "Asia/Kolkata",
    "date_format": "DD-MM-YYYY",
    "income_categories": ["Salary", "Business", "Rental", "Interest", "Dividend", "Investment", "Freelance", "Other"],
    "expense_categories": ["Household", "Rent", "Utilities", "Food & Dining", "Groceries", "Transport & Fuel", "Travel", "Medical", "Education", "Insurance", "Taxes", "Construction", "Home Maintenance", "Subscriptions", "EMI", "Shopping", "Entertainment", "Gifts & Donations", "Personal Care", "Childcare", "Pets", "Other"],
    "project_categories": ["Civil", "Architecture", "Structural", "Plumbing", "Electrical", "Government", "Materials", "Labour", "Interior", "Consultant", "Equipment", "Transport", "Miscellaneous"],
    "payment_methods": ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "Net Banking"],
}

FLUSH_TARGETS = {
    "accounts": "accounts",
    "income": "transactions:INCOME",
    "expenses": "transactions:EXPENSE",
    "transfers": "transactions:TRANSFER",
    "transactions": "transactions",
    "loans": "loans",
    "projects": "projects",
    "farms": "farms",
    "insurance": "insurance",
    "pf_ppf": "pf_ppf",
    "savings": "savings",
    "assets": "assets",
    "liabilities": "liabilities",
    "lendings": "lendings",
    "investments": "investments",
    "family": "family_members",
    "parties": "parties",
    "work_logs": "work_logs",
    "losses": "losses",
    "rental_properties": "rental_properties",
    "rent_payments": "rent_payments",
    "farm_rent_payments": "farm_rent_payments",
    "diary_entries": "diary_entries",
}


def normalize_flush_selection(selection):
    if selection is None:
        return []
    values = []
    items = [str(v).strip().lower() for v in selection if str(v).strip()]
    if not items:
        return []
    if "all" in items or "select_all" in items or "all_data" in items:
        return ["all"]

    for item in items:
        normalized = item.replace(" ", "_").replace("-", "_")
        if normalized in {"income", "incomes"}:
            values.append("transactions:INCOME")
        elif normalized in {"expense", "expenses"}:
            values.append("transactions:EXPENSE")
        elif normalized in {"transfer", "transfers"}:
            values.append("transactions:TRANSFER")
        elif normalized in {"transactions", "all_transactions"}:
            values.append("transactions")
        else:
            mapped = FLUSH_TARGETS.get(normalized)
            if mapped:
                values.append(mapped)
    return list(dict.fromkeys(values))


async def _flush_collection_target(target: str):
    if ":" in target:
        collection, txn_type = target.split(":", 1)
        await db[collection].update_many(
            {"type": txn_type, "deleted_at": {"$exists": False}},
            {"$set": {"deleted_at": now_utc()}},
        )
        return

    if target == "transactions":
        await db.transactions.update_many(
            {"deleted_at": {"$exists": False}},
            {"$set": {"deleted_at": now_utc()}},
        )
        return

    # update_many is safe for a missing collection and avoids the old un-awaited
    # list_collection_names() check that prevented some selected streams flushing.
    await db[target].update_many(
        {"deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now_utc()}},
    )


@router.get("/settings")
async def get_settings(user: dict = Depends(require_account_user)):
    household_user = user.get("role") == HOUSEHOLD_ROLE
    # Earlier installations used the global `_id: app`; new workspaces use a
    # normal ObjectId plus a scoped settings key so each household is independent.
    doc = await db.settings.find_one({"$or": [{"settings_key": "app"}, {"_id": "app"}]})
    if not doc:
        doc = {"settings_key": "app", **DEFAULT_SETTINGS}
        if not household_user:
            result = await db.settings.insert_one(doc)
            doc["_id"] = result.inserted_id
    elif not household_user:
        # New standard categories should appear for existing installations too,
        # without removing any categories the user already configured.
        additions = {}
        for key in ("income_categories", "expense_categories", "project_categories", "payment_methods"):
            merged = list(dict.fromkeys((doc.get(key) or []) + DEFAULT_SETTINGS[key]))
            if merged != doc.get(key):
                additions[key] = merged
        if additions:
            await db.settings.update_one({"_id": doc["_id"]}, {"$set": additions})
            doc.update(additions)
    doc.pop("_id", None)
    if household_user:
        safe_settings = (
            "currency", "timezone", "date_format", "income_categories",
            "expense_categories", "payment_methods",
        )
        return {key: doc[key] for key in safe_settings if key in doc}
    return doc


@router.put("/settings")
async def update_settings(payload: dict, user: dict = Depends(require_admin)):
    payload.pop("_id", None)
    doc = await db.settings.find_one({"$or": [{"settings_key": "app"}, {"_id": "app"}]})
    if doc:
        await db.settings.update_one({"_id": doc["_id"]}, {"$set": payload})
    else:
        result = await db.settings.insert_one({"settings_key": "app", **DEFAULT_SETTINGS, **payload})
        doc = await db.settings.find_one({"_id": result.inserted_id})
    doc = await db.settings.find_one({"_id": doc["_id"]})
    doc.pop("_id", None)
    return doc


@router.post("/settings/flush")
async def flush_selected_data(payload: dict, user: dict = Depends(require_admin)):
    selection = payload.get("selection") or payload.get("selections") or payload.get("items") or []
    normalized = normalize_flush_selection(selection)
    if not normalized:
        raise HTTPException(status_code=400, detail="Select at least one stream or category to flush.")

    targets = list(FLUSH_TARGETS.values()) if "all" in normalized else normalized
    seen = set()
    for target in targets:
        if target in seen:
            continue
        seen.add(target)
        await _flush_collection_target(target)

    return {"status": "flushed", "selected": list(seen), "count": len(seen)}
