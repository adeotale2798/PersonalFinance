"""Account-scoped permissions for invited household collaborators."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException

from core import db, get_current_user, oid

ADMIN_ROLES = {"SUPER_ADMIN", "PROJECT_ADMIN"}
HOUSEHOLD_ROLE = "HOUSEHOLD_USER"


async def require_account_user(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") not in ADMIN_ROLES | {HOUSEHOLD_ROLE}:
        raise HTTPException(status_code=403, detail="Account access required")
    return user


async def granted_account_ids(user: dict, access: str = "read") -> set[str] | None:
    """Return the collaborator's granted account ids, or None for existing admins."""
    if user.get("role") in ADMIN_ROLES:
        return None
    if user.get("role") != HOUSEHOLD_ROLE:
        raise HTTPException(status_code=403, detail="Account access required")

    grants = await db.account_access_grants.find({
        "user_id": str(user["_id"]),
        "active": True,
    }).to_list(1000)
    return {
        grant["account_id"]
        for grant in grants
        if grant.get("access") == "use" or (access == "read" and grant.get("access") == "read")
    }


async def require_account_access(user: dict, account_id: str, access: str = "read") -> dict:
    """Verify an account belongs to this workspace and is granted at the needed level."""
    if access not in ("read", "use"):
        raise HTTPException(status_code=400, detail="Invalid account access level")
    account = await db.accounts.find_one({
        "_id": oid(account_id),
        "deleted_at": {"$exists": False},
    })
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if user.get("role") in ADMIN_ROLES:
        return account
    if user.get("role") != HOUSEHOLD_ROLE:
        raise HTTPException(status_code=403, detail="Account access required")

    grant = await db.account_access_grants.find_one({
        "account_id": account_id,
        "user_id": str(user["_id"]),
        "active": True,
    })
    if not grant or (access == "use" and grant.get("access") != "use"):
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def require_transaction_accounts(payload: dict, user: dict, existing: dict | None = None):
    """Enforce account links on collaborator transaction writes."""
    if user.get("role") in ADMIN_ROLES:
        return
    if user.get("role") != HOUSEHOLD_ROLE:
        raise HTTPException(status_code=403, detail="Account access required")

    allowed_fields = {
        "type", "amount", "date", "account_id", "to_account_id", "category",
        "source", "description", "note", "payment_mode", "transaction_status",
        "scope", "record_source",
    }
    if set(payload) - allowed_fields:
        raise HTTPException(status_code=403, detail="Household collaborators can only use granted accounts")
    if payload.get("scope", (existing or {}).get("scope", "PERSONAL")) != "PERSONAL":
        raise HTTPException(status_code=403, detail="Household collaborators can only record personal transactions")
    if payload.get("record_source", "MANUAL") != "MANUAL":
        raise HTTPException(status_code=403, detail="Household collaborators cannot import transactions")

    merged = {**(existing or {}), **payload}
    txn_type = merged.get("type")
    account_id = merged.get("account_id")
    to_account_id = merged.get("to_account_id")
    if txn_type in ("INCOME", "EXPENSE"):
        account_ids = [account_id] if account_id else []
        if not account_ids:
            raise HTTPException(status_code=422, detail="Income and expense transactions require an account")
        if to_account_id:
            raise HTTPException(status_code=422, detail="Income and expense transactions use one account")
    elif txn_type == "TRANSFER":
        account_ids = [account_id, to_account_id] if account_id and to_account_id else []
        if not account_ids:
            raise HTTPException(status_code=422, detail="Transfers require two accounts")
    else:
        raise HTTPException(status_code=422, detail="Unsupported transaction type")

    if len(set(account_ids)) != len(account_ids):
        raise HTTPException(status_code=422, detail="A transfer must use two different accounts")
    for linked_account_id in account_ids:
        await require_account_access(user, linked_account_id, "use")


def account_object_ids(account_ids: set[str]) -> list[ObjectId]:
    """Convert grant ids while ignoring stale or malformed historical entries."""
    result = []
    for account_id in account_ids:
        try:
            result.append(ObjectId(account_id))
        except (InvalidId, TypeError):
            continue
    return result
