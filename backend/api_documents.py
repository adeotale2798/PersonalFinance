"""Documents: upload, list, download via Emergent object storage."""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, Query
from fastapi.responses import Response
from core import db, raw_db, serialize, oid, now_utc, require_admin, get_current_user, workspace_for, set_workspace
from storage import put_object, get_object

router = APIRouter(tags=["documents"])

ALLOWED = {"pdf", "png", "jpg", "jpeg", "webp", "gif", "doc", "docx",
           "xls", "xlsx", "csv", "txt", "ppt", "pptx", "heic"}
MAX_SIZE = 25 * 1024 * 1024


@router.get("/documents")
async def list_documents(category: str | None = None, related_entity_id: str | None = None, folder: str | None = None,
                         financial_year: str | None = None, family_member_id: str | None = None, project_id: str | None = None,
                         party_id: str | None = None, related_entity_type: str | None = None, user: dict = Depends(get_current_user)):
    is_party = user.get("role") == "PARTY_USER"
    if not is_party and user.get("role") not in ("SUPER_ADMIN", "PROJECT_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or party access required")
    q: dict[str, Any] = {"deleted_at": {"$exists": False}}
    if is_party:
        q["party_id"] = user.get("party_id")
    if category: q["category"] = category
    if related_entity_id: q["related_entity_id"] = related_entity_id
    if related_entity_type: q["related_entity_type"] = related_entity_type
    if folder: q["folder"] = folder
    if financial_year: q["financial_year"] = financial_year
    if family_member_id: q["family_member_id"] = family_member_id
    if project_id: q["project_id"] = project_id
    if party_id and not is_party: q["party_id"] = party_id
    docs = await db.documents.find(q).sort([("created_at", -1)]).to_list(1000)
    return [serialize(d) for d in docs]


@router.get("/documents/link-options")
async def document_link_options(user: dict = Depends(require_admin)):
    """Small, stable lookup list for attaching evidence to an exact record."""
    sources = (("loans", "loans", "name"), ("insurance", "insurance", "policy_name"), ("farms", "farms", "name"), ("rental_property", "rental_properties", "name"), ("lending", "lendings", "counterparty"), ("asset", "assets", "name"))
    options = []
    for entity_type, collection, label in sources:
        for row in await db[collection].find({"deleted_at": {"$exists": False}}).to_list(1000):
            options.append({"type": entity_type, "id": str(row["_id"]), "label": row.get(label) or entity_type.replace("_", " ").title()})
    return options


@router.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("Other"),
    folder: str = Form(None),
    official: str = Form(None),
    financial_year: str = Form(None),
    related_entity_type: str = Form(None),
    related_entity_id: str = Form(None),
    project_id: str = Form(None),
    family_member_id: str = Form(None),
    display_name: str = Form(None),
    notes: str = Form(""),
    party_id: str = Form(None),
    user: dict = Depends(get_current_user),
):
    is_party = user.get("role") == "PARTY_USER"
    if not is_party and user.get("role") not in ("SUPER_ADMIN", "PROJECT_ADMIN"):
        raise HTTPException(status_code=403, detail="Admin or party access required")
    if is_party:
        user_party_id = user.get("party_id")
        if not isinstance(user_party_id, str) or not user_party_id:
            raise HTTPException(status_code=403, detail="Party profile is not configured")
        party_id = user_party_id
        party = await db.parties.find_one({"_id": oid(party_id), "deleted_at": {"$exists": False}})
        if not party:
            raise HTTPException(status_code=404, detail="Party profile not found")
        project_id = party.get("project_id")
        related_entity_type, related_entity_id = "party", party_id
    # A linked document is intentionally explicit. A record ID without its type
    # is ambiguous across household ledgers and would make later integrations
    # unsafe to reconcile.
    if bool(related_entity_type) != bool(related_entity_id):
        raise HTTPException(status_code=422, detail="Choose both a related record type and record ID when linking a document")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else ""
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail=f"File type .{ext or '(none)'} not allowed")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 25MB)")
    path = f"nivara/uploads/parties/{party_id}/{uuid.uuid4().hex}.{ext}" if party_id else f"nivara/uploads/personal/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "application/octet-stream"
    result = put_object(path, content, content_type)
    base = display_name or file.filename
    if display_name and ext and not display_name.lower().endswith("." + ext):
        base = f"{display_name}.{ext}"
    doc = {
        "filename": base,
        "ext": ext,
        "content_type": content_type,
        "size": result.get("size", len(content)),
        "category": category,
        "folder": folder or (f"Party/{party_id}" if party_id else "Personal"),
        "official": (official == "true") if official is not None else None,
        "financial_year": financial_year,
        "related_entity_type": related_entity_type,
        "related_entity_id": related_entity_id,
        "project_id": project_id,
        "party_id": party_id,
        "family_member_id": family_member_id,
        "storage_path": result["path"],
        "notes": notes,
        "uploaded_by": user["email"],
        "created_at": now_utc(),
    }
    res = await db.documents.insert_one(doc)
    return serialize(await db.documents.find_one({"_id": res.inserted_id}))


@router.put("/documents/{item_id}")
async def rename_document(item_id: str, payload: dict, user: dict = Depends(require_admin)):
    doc = await db.documents.find_one({"_id": oid(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    update = {}
    if "filename" in payload and payload["filename"]:
        name = payload["filename"]
        ext = doc.get("ext")
        if ext and "." not in name:
            name = f"{name}.{ext}"
        elif ext and not name.lower().endswith("." + ext):
            name = f"{name.rsplit('.', 1)[0]}.{ext}"
        update["filename"] = name
    for k in ("category", "folder", "notes", "financial_year", "official"):
        if k in payload:
            update[k] = payload[k]
    update["updated_at"] = now_utc()
    await db.documents.update_one({"_id": oid(item_id)}, {"$set": update})
    return serialize(await db.documents.find_one({"_id": oid(item_id)}))


@router.get("/documents/{item_id}/download")
async def download_document(item_id: str, authorization: str = Header(None), auth: str = Query(None)):
    import jwt
    from core import get_jwt_secret, JWT_ALGORITHM
    token = auth or (authorization[7:] if authorization and authorization.startswith("Bearer ") else None)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await raw_db.users.find_one({"_id": oid(payload["sub"]), "active": {"$ne": False}})
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    if user.get("role") == "HOUSEHOLD_USER":
        raise HTTPException(status_code=403, detail="Document access is not included in household account sharing")
    set_workspace(workspace_for(user))
    doc = await db.documents.find_one({"_id": oid(item_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.get("role") == "PARTY_USER" and doc.get("party_id") != user.get("party_id"):
        raise HTTPException(status_code=403, detail="This document is not available to your party")
    data, content_type = get_object(doc["storage_path"])
    return Response(content=data, media_type=doc.get("content_type") or content_type)


@router.delete("/documents/{item_id}")
async def delete_document(item_id: str, user: dict = Depends(require_admin)):
    await db.documents.delete_one({"_id": oid(item_id)})
    return {"status": "deleted"}
