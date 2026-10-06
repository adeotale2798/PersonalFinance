"""Admin: users, family members, access control, audit."""
import re
from fastapi import APIRouter, Depends, HTTPException
from core import db, raw_db, serialize, oid, now_utc, require_admin, hash_password, log_audit
from account_permissions import HOUSEHOLD_ROLE

router = APIRouter(tags=["admin"])

MODULES = ["overview", "finance", "budget", "costs", "payments", "parties",
           "contracts", "work", "documents", "requests", "reports"]
LEVELS = ["none", "view", "edit", "approve"]
ROLES = {"SUPER_ADMIN", "PROJECT_ADMIN", "PARTY_USER", HOUSEHOLD_ROLE}


def is_platform_admin(user: dict) -> bool:
    return bool(user.get("is_platform_admin"))


async def available_login_id(name: str) -> str:
    """Create lastname@nivara.com, adding a number only when it is taken."""
    last_name = (name or "user").strip().split()[-1]
    base = re.sub(r"[^a-z0-9]+", "", last_name.lower()) or "user"
    number = 0
    while True:
        suffix = "" if number == 0 else str(number)
        email = f"{base}{suffix}@nivara.com"
        if not await raw_db.users.find_one({"email": email}):
            return email
        number += 1


@router.get("/sitewalkthrough/status")
async def get_sitewalkthrough_status():
    setting = await raw_db.platform_settings.find_one({"_id": "sitewalkthrough"})
    return {"enabled": setting.get("enabled", True) if setting else True}


@router.put("/sitewalkthrough/status")
async def update_sitewalkthrough_status(payload: dict, user: dict = Depends(require_admin)):
    if not is_platform_admin(user):
        raise HTTPException(status_code=403, detail="Only the platform administrator can manage the public walkthrough")
    enabled = payload.get("enabled")
    if not isinstance(enabled, bool):
        raise HTTPException(status_code=400, detail="Enabled must be a boolean")

    await raw_db.platform_settings.update_one(
        {"_id": "sitewalkthrough"},
        {"$set": {"enabled": enabled, "updated_at": now_utc(), "updated_by": str(user["_id"])}},
        upsert=True,
    )
    await log_audit(user, "update_sitewalkthrough", "platform_settings", "sitewalkthrough", {"enabled": enabled})
    return {"enabled": enabled}


# ---------------- family members ----------------
@router.get("/family")
async def list_family(user: dict = Depends(require_admin)):
    docs = await db.family_members.find({"deleted_at": {"$exists": False}}).sort([("created_at", 1)]).to_list(200)
    return [serialize(d) for d in docs]


@router.post("/family")
async def create_family(payload: dict, user: dict = Depends(require_admin)):
    payload["created_at"] = now_utc()
    res = await db.family_members.insert_one(payload)
    return serialize(await db.family_members.find_one({"_id": res.inserted_id}))


@router.put("/family/{item_id}")
async def update_family(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    await db.family_members.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.family_members.find_one({"_id": oid(item_id)}))


@router.delete("/family/{item_id}")
async def delete_family(item_id: str, user: dict = Depends(require_admin)):
    await db.family_members.delete_one({"_id": oid(item_id)})
    return {"status": "deleted"}


# ---------------- users / access control ----------------
@router.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    # The platform administrator sees every workspace owner and user. Other
    # owners remain limited to the people in their own private workspace.
    collection = raw_db.users if is_platform_admin(user) else db.users
    docs = await collection.find({}).sort([("created_at", 1)]).to_list(500)
    if not is_platform_admin(user):
        return [serialize(d) for d in docs]
    workspace_names = {str(x["_id"]): x.get("name", "Finance workspace") for x in await raw_db.workspaces.find({}).to_list(500)}
    result = []
    for item in docs:
        row = serialize(item)
        row["workspace_name"] = workspace_names.get(item.get("workspace_id"), "Platform")
        result.append(row)
    return result


@router.post("/users")
async def create_user(payload: dict, admin: dict = Depends(require_admin)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    role = payload.get("role", "PARTY_USER")
    if role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid user role")
    if role == "SUPER_ADMIN" and not is_platform_admin(admin):
        raise HTTPException(status_code=403, detail="Only the platform administrator can grant the finance-owner role")
    email = (payload.get("email") or "").strip().lower() or await available_login_id(name)
    # Emails remain global even though normal user management is workspace scoped.
    if await raw_db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    password = payload.get("password") or f"{name.split()[-1]}@123"
    permissions = [] if role == HOUSEHOLD_ROLE else payload.get("permissions", [])
    doc = {
        "email": email,
        "name": name,
        "role": role,
        "party_type": payload.get("party_type"),
        "permissions": permissions,
        "password_hash": hash_password(password),
        "active": True,
        "initial_password_replaced": False,
        "created_at": now_utc(),
    }
    if role == "SUPER_ADMIN":
        # A super admin is an independent workspace owner, not an elevated
        # collaborator in the caller's household.  Their dashboard starts blank.
        res = await raw_db.users.insert_one(doc)
        workspace_id = str(res.inserted_id)
        await raw_db.users.update_one({"_id": res.inserted_id}, {"$set": {"workspace_id": workspace_id, "is_workspace_owner": True}})
        await raw_db.workspaces.insert_one({"_id": workspace_id, "owner_user_id": workspace_id, "name": payload.get("workspace_name") or f"{name}'s Finance", "created_at": now_utc()})
        created = await raw_db.users.find_one({"_id": res.inserted_id})
    else:
        res = await db.users.insert_one(doc)
        created = await db.users.find_one({"_id": res.inserted_id})
    await log_audit(admin, "create_user", "users", str(res.inserted_id), {"email": email})
    result = serialize(created)
    result["initial_login"] = {"email": email, "password": password}
    return result


@router.put("/users/{item_id}")
async def update_user(item_id: str, payload: dict, admin: dict = Depends(require_admin)):
    update = {}
    for k in ("name", "role", "party_type", "permissions", "active"):
        if k in payload:
            update[k] = payload[k]
    if "role" in update and update["role"] not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid user role")
    if update.get("role") == HOUSEHOLD_ROLE:
        update["permissions"] = []
    if update.get("role") == "SUPER_ADMIN" and not is_platform_admin(admin):
        raise HTTPException(status_code=403, detail="Only the platform administrator can grant the finance-owner role")
    if payload.get("password"):
        update["password_hash"] = hash_password(payload["password"])
        update["initial_password_replaced"] = True
    update["updated_at"] = now_utc()
    collection = raw_db.users if is_platform_admin(admin) else db.users
    target = await collection.find_one({"_id": oid(item_id)})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("role") == HOUSEHOLD_ROLE and update.get("role") in ("SUPER_ADMIN", "PROJECT_ADMIN"):
        raise HTTPException(status_code=403, detail="Household collaborators cannot be promoted to an admin role")
    # Workspace ownership is structural: it cannot be granted accidentally by
    # editing an ordinary collaborator.
    if target.get("role") == "SUPER_ADMIN" and not is_platform_admin(admin):
        raise HTTPException(status_code=403, detail="Only the platform administrator can manage workspace owners")
    await collection.update_one({"_id": oid(item_id)}, {"$set": update})
    await log_audit(admin, "update_user", "users", item_id)
    return serialize(await collection.find_one({"_id": oid(item_id)}))


@router.delete("/users/{item_id}")
async def delete_user(item_id: str, admin: dict = Depends(require_admin)):
    collection = raw_db.users if is_platform_admin(admin) else db.users
    target = await collection.find_one({"_id": oid(item_id)})
    if target and target.get("role") == "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Cannot delete the super admin")
    await collection.delete_one({"_id": oid(item_id)})
    await log_audit(admin, "delete_user", "users", item_id)
    return {"status": "deleted"}


@router.get("/access-meta")
async def access_meta(user: dict = Depends(require_admin)):
    return {"modules": MODULES, "levels": LEVELS,
            "roles": ["SUPER_ADMIN", "PROJECT_ADMIN", "PARTY_USER", "HOUSEHOLD_USER"],
            "party_types": ["Architect", "Civil Contractor", "Contractor A", "Contractor B",
                            "Plumber", "Electrician", "Structural Consultant", "Interior Contractor",
                            "Material Supplier", "Consultant", "Auditor", "Other"]}


@router.get("/audit")
async def audit_log(user: dict = Depends(require_admin)):
    docs = await db.audit_events.find({}).sort([("timestamp", -1)]).to_list(200)
    return [serialize(d) for d in docs]
