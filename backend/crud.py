"""Generic CRUD router factory for admin-owned collections."""
import inspect
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from core import db, serialize, oid, now_utc, require_admin, log_audit, normalize_date, validate_financial_payload


def make_crud_router(name: str, collection: str, pre_save=None, list_sort=None, before_delete=None):
    """Build a standard CRUD APIRouter for a collection.

    pre_save(payload, existing) -> payload  (optional transform / computed fields)
    """
    router = APIRouter(prefix=f"/{name}", tags=[name])
    coll = db[collection]

    def normalize_dates(payload):
        for key, value in list(payload.items()):
            if key == "date" or key.endswith("_date"):
                payload[key] = normalize_date(value)
        return payload

    @router.get("")
    async def list_items(request: Request, user: dict = Depends(require_admin)):
        query = {"deleted_at": {"$exists": False}}
        for k, v in request.query_params.items():
            if k in ("limit", "skip"):
                continue
            query[k] = v
        sort = list_sort or [("created_at", -1)]
        docs = await coll.find(query).sort(sort).to_list(2000)
        return [serialize(d) for d in docs]

    @router.post("")
    async def create_item(payload: dict, user: dict = Depends(require_admin)):
        payload = validate_financial_payload(payload)
        payload = normalize_dates(payload)
        if pre_save:
            transformed = pre_save(payload, None)
            payload = await transformed if inspect.isawaitable(transformed) else transformed
        payload["created_at"] = now_utc()
        payload["updated_at"] = now_utc()
        payload["created_by"] = user["email"]
        res = await coll.insert_one(payload)
        doc = await coll.find_one({"_id": res.inserted_id})
        await log_audit(user, "create", collection, str(res.inserted_id))
        return serialize(doc)

    @router.get("/{item_id}")
    async def get_item(item_id: str, user: dict = Depends(require_admin)):
        doc = await coll.find_one({"_id": oid(item_id)})
        if not doc:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        return serialize(doc)

    @router.put("/{item_id}")
    async def update_item(item_id: str, payload: dict, user: dict = Depends(require_admin)):
        existing = await coll.find_one({"_id": oid(item_id)})
        if not existing:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        payload = normalize_dates(validate_financial_payload(payload))
        if pre_save:
            transformed = pre_save(payload, existing)
            payload = await transformed if inspect.isawaitable(transformed) else transformed
        payload.pop("id", None)
        payload.pop("_id", None)
        payload["updated_at"] = now_utc()
        await coll.update_one({"_id": oid(item_id)}, {"$set": payload})
        doc = await coll.find_one({"_id": oid(item_id)})
        await log_audit(user, "update", collection, item_id)
        return serialize(doc)

    @router.delete("/{item_id}")
    async def delete_item(item_id: str, user: dict = Depends(require_admin)):
        existing = await coll.find_one({"_id": oid(item_id)})
        if not existing:
            raise HTTPException(status_code=404, detail=f"{name} not found")
        if before_delete:
            result = before_delete(item_id, existing)
            if inspect.isawaitable(result):
                await result
        await coll.delete_one({"_id": oid(item_id)})
        await log_audit(user, "delete", collection, item_id)
        return {"status": "deleted", "id": item_id}

    return router, coll
