"""Projects & Parties + project finance."""
from collections import defaultdict
import re
from fastapi import APIRouter, Depends, HTTPException
from core import db, serialize, oid, now_utc, require_admin, get_current_user, round2, hash_password, log_audit, validate_balance_sheet_asset_link

router = APIRouter(tags=["projects"])


@router.get("/projects")
async def list_projects(user: dict = Depends(require_admin)):
    docs = await db.projects.find({"deleted_at": {"$exists": False}}).sort([("created_at", -1)]).to_list(500)
    out = []
    for p in docs:
        pid = str(p["_id"])
        txns = await db.transactions.find({"project_id": pid, "deleted_at": {"$exists": False}}).to_list(20000)
        spent = round2(sum(round2(t.get("amount", 0)) for t in txns if t.get("type") == "EXPENSE"))
        received = round2(sum(round2(t.get("amount", 0)) for t in txns if t.get("type") == "INCOME"))
        d = serialize(p)
        d["spent"] = spent
        d["received"] = received
        d["remaining"] = round2(round2(d.get("budget", 0)) - spent)
        out.append(d)
    return out


@router.post("/projects")
async def create_project(payload: dict, user: dict = Depends(require_admin)):
    if "balance_sheet_asset_id" in payload:
        payload["balance_sheet_asset_id"] = await validate_balance_sheet_asset_link(payload["balance_sheet_asset_id"])
    payload["budget"] = round2(payload.get("budget", 0))
    payload.setdefault("status", "PLANNING")
    payload.setdefault("currency", "INR")
    payload.setdefault("progress", 0)
    payload["created_at"] = now_utc()
    res = await db.projects.insert_one(payload)
    return serialize(await db.projects.find_one({"_id": res.inserted_id}))


@router.get("/projects/{item_id}")
async def get_project(item_id: str, user: dict = Depends(require_admin)):
    p = await db.projects.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize(p)


@router.put("/projects/{item_id}")
async def update_project(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    payload.pop("spent", None); payload.pop("received", None); payload.pop("remaining", None)
    if "balance_sheet_asset_id" in payload:
        payload["balance_sheet_asset_id"] = await validate_balance_sheet_asset_link(payload["balance_sheet_asset_id"])
    if "budget" in payload:
        payload["budget"] = round2(payload["budget"])
    payload["updated_at"] = now_utc()
    await db.projects.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.projects.find_one({"_id": oid(item_id)}))


@router.delete("/projects/{item_id}")
async def delete_project(item_id: str, user: dict = Depends(require_admin)):
    project = await db.projects.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    now = now_utc()
    parties = await db.parties.find(
        {"project_id": item_id, "deleted_at": {"$exists": False}}
    ).to_list(1000)
    party_ids = [str(party["_id"]) for party in parties]
    await db.projects.update_one({"_id": project["_id"]}, {"$set": {"deleted_at": now}})
    await db.parties.update_many(
        {"project_id": item_id, "deleted_at": {"$exists": False}},
        {"$set": {"deleted_at": now}},
    )
    offboarded_users = await db.users.update_many(
        {
            "role": "PARTY_USER",
            "$or": [
                {"project_id": item_id},
                {"party_id": {"$in": party_ids}},
            ],
        },
        {"$set": {"active": False, "offboarded_at": now}},
    )
    await log_audit(user, "delete_project", "projects", item_id, {
        "offboarded_party_users": offboarded_users.modified_count,
    })
    return {"status": "deleted", "id": item_id}


@router.get("/projects/{item_id}/finance")
async def project_finance(item_id: str, user: dict = Depends(require_admin)):
    p = await db.projects.find_one({"_id": oid(item_id), "deleted_at": {"$exists": False}})
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    budget = round2(p.get("budget", 0))
    txns = await db.transactions.find({"project_id": item_id, "deleted_at": {"$exists": False}}).to_list(20000)
    spent = round2(sum(round2(t.get("amount", 0)) for t in txns if t.get("type") == "EXPENSE"))
    received = round2(sum(round2(t.get("amount", 0)) for t in txns if t.get("type") == "INCOME"))
    parties = await db.parties.find({"project_id": item_id, "deleted_at": {"$exists": False}}).to_list(500)
    committed = round2(sum(round2(pt.get("contract_value", 0)) for pt in parties))
    by_category = defaultdict(float)
    by_party = defaultdict(float)
    monthly = defaultdict(lambda: {"in": 0.0, "out": 0.0})
    for t in txns:
        amt = round2(t.get("amount", 0))
        mk = (t.get("date") or "")[:7]
        if t.get("type") == "EXPENSE":
            by_category[t.get("category") or "Miscellaneous"] += amt
            by_party[t.get("party") or "Direct"] += amt
            if mk:
                monthly[mk]["out"] += amt
        elif t.get("type") == "INCOME" and mk:
            monthly[mk]["in"] += amt
    return {
        "budget": budget,
        "received": received,
        "spent": spent,
        "committed": committed,
        "outstanding": round2(committed - spent) if committed > spent else 0,
        "available": round2(received - spent),
        "remaining_budget": round2(budget - spent),
        "variance": round2(budget - spent),
        "utilization": round2((spent / budget * 100) if budget > 0 else 0),
        "cost_by_category": [{"name": k, "value": round2(v)} for k, v in sorted(by_category.items(), key=lambda x: -x[1])],
        "cost_by_party": [{"name": k, "value": round2(v)} for k, v in sorted(by_party.items(), key=lambda x: -x[1])],
        "monthly": [{"month": k, "in": round2(v["in"]), "out": round2(v["out"])} for k, v in sorted(monthly.items())],
    }


# ---------------- parties ----------------
@router.get("/parties")
async def list_parties(project_id: str = None, user: dict = Depends(require_admin)):
    q = {"deleted_at": {"$exists": False}}
    if project_id:
        q["project_id"] = project_id
    docs = await db.parties.find(q).sort([("created_at", -1)]).to_list(1000)
    out = []
    for pt in docs:
        d = serialize(pt)
        txns = await db.transactions.find({"party": d.get("name"), "project_id": d.get("project_id"), "type": "EXPENSE", "deleted_at": {"$exists": False}}).to_list(5000)
        d["paid"] = round2(sum(round2(t.get("amount", 0)) for t in txns))
        d["outstanding"] = round2(round2(d.get("contract_value", 0)) - d["paid"])
        out.append(d)
    return out


@router.post("/parties")
async def create_party(payload: dict, user: dict = Depends(require_admin)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Party name is required")
    if not payload.get("project_id"):
        raise HTTPException(status_code=422, detail="A project is required for a party")
    payload["name"] = name
    payload["contract_value"] = round2(payload.get("contract_value", 0))
    payload["created_at"] = now_utc()
    res = await db.parties.insert_one(payload)
    party = await db.parties.find_one({"_id": res.inserted_id})
    # Every party has an isolated login.  Use a valid email-safe rendering of the
    # supplied full name while retaining the requested predictable first password.
    local = re.sub(r"[^a-z0-9]+", "", name.split()[-1].lower()) or "party"
    email = f"{local}@nivara.com"
    suffix = 2
    while await db.users.find_one({"email": email}):
        email = f"{local}{suffix}@nivara.com"; suffix += 1
    # Password is intentionally derived from the party's last name as requested.
    # It is never stored or returned from a user record after this creation event.
    initial_password = f"{name.split()[-1]}@123"
    user_res = await db.users.insert_one({
        "email": email, "name": name, "role": "PARTY_USER", "party_id": str(res.inserted_id),
        "project_id": payload["project_id"], "party_type": payload.get("party_type"),
        "permissions": [], "password_hash": hash_password(initial_password), "active": True,
        "initial_password_replaced": False,
        "created_at": now_utc(),
    })
    await db.parties.update_one({"_id": res.inserted_id}, {"$set": {"user_id": str(user_res.inserted_id), "login_email": email}})
    await log_audit(user, "create_party_login", "parties", str(res.inserted_id), {"email": email})
    result = serialize(await db.parties.find_one({"_id": res.inserted_id}))
    result["initial_login"] = {"email": email, "password": initial_password}
    return result


@router.put("/parties/{item_id}")
async def update_party(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    payload.pop("paid", None); payload.pop("outstanding", None)
    if "contract_value" in payload:
        payload["contract_value"] = round2(payload["contract_value"])
    payload["updated_at"] = now_utc()
    await db.parties.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.parties.find_one({"_id": oid(item_id)}))


@router.delete("/parties/{item_id}")
async def delete_party(item_id: str, user: dict = Depends(require_admin)):
    party = await db.parties.find_one({"_id": oid(item_id)})
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    # A removed party must not remain selectable or retain a usable portal login.
    await db.parties.delete_one({"_id": party["_id"]})
    # Include legacy party users created before party_id was introduced.
    await db.users.delete_many({"$or": [
        {"party_id": item_id},
        {"role": "PARTY_USER", "name": party.get("name"), "permissions.project_id": party.get("project_id")},
    ]})
    await db.documents.delete_many({"party_id": item_id})
    await log_audit(user, "delete_party", "parties", item_id, {"cascade": ["users", "documents"]})
    return {"status": "deleted", "id": item_id}


# ---------------- party portal ----------------
def _party_user(user: dict) -> str:
    party_id = user.get("party_id")
    if user.get("role") != "PARTY_USER" or not party_id:
        raise HTTPException(status_code=403, detail="Party portal access required")
    return party_id


@router.get("/party-portal")
async def party_portal(user: dict = Depends(get_current_user)):
    party_id = _party_user(user)
    party = await db.parties.find_one({"_id": oid(party_id), "deleted_at": {"$exists": False}})
    if not party:
        raise HTTPException(status_code=404, detail="Party profile not found")
    transactions = await db.transactions.find({"party_id": party_id, "deleted_at": {"$exists": False}}).sort([("date", -1)]).to_list(2000)
    documents = await db.documents.find({"party_id": party_id, "deleted_at": {"$exists": False}}).sort([("created_at", -1)]).to_list(1000)
    return {"party": serialize(party), "payments": [serialize(x) for x in transactions], "documents": [serialize(x) for x in documents]}


@router.post("/party-portal/payments/{transaction_id}/acknowledge")
async def acknowledge_payment(transaction_id: str, user: dict = Depends(get_current_user)):
    party_id = _party_user(user)
    txn = await db.transactions.find_one({"_id": oid(transaction_id), "party_id": party_id, "deleted_at": {"$exists": False}})
    if not txn:
        raise HTTPException(status_code=404, detail="Payment not found")
    if txn.get("payment_mode") not in ("Cash", "UPI"):
        raise HTTPException(status_code=422, detail="Only cash and UPI payments require party acknowledgement")
    await db.transactions.update_one({"_id": txn["_id"]}, {"$set": {"party_acknowledged_at": now_utc(), "payment_status": "PARTY_ACKNOWLEDGED"}})
    await log_audit(user, "acknowledge_payment", "transaction", transaction_id)
    return {"status": "acknowledged"}


# ---------------- work logs ----------------
@router.get("/work-logs")
async def list_work_logs(project_id: str = None, user: dict = Depends(require_admin)):
    q = {"deleted_at": {"$exists": False}}
    if project_id:
        q["project_id"] = project_id
    docs = await db.work_logs.find(q).sort([("date", -1)]).to_list(2000)
    return [serialize(d) for d in docs]


@router.post("/work-logs")
async def create_work_log(payload: dict, user: dict = Depends(require_admin)):
    payload.setdefault("status", "IN_PROGRESS")
    payload.setdefault("photos", [])
    payload.setdefault("date", now_utc().date().isoformat())
    payload["created_at"] = now_utc()
    res = await db.work_logs.insert_one(payload)
    return serialize(await db.work_logs.find_one({"_id": res.inserted_id}))


@router.put("/work-logs/{item_id}")
async def update_work_log(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    payload.pop("id", None); payload.pop("_id", None)
    payload["updated_at"] = now_utc()
    await db.work_logs.update_one({"_id": oid(item_id)}, {"$set": payload})
    return serialize(await db.work_logs.find_one({"_id": oid(item_id)}))


@router.delete("/work-logs/{item_id}")
async def delete_work_log(item_id: str, user: dict = Depends(require_admin)):
    await db.work_logs.delete_one({"_id": oid(item_id)})
    return {"status": "deleted"}
