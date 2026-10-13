"""Explainable data-quality checks with actionable source-record links."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from core import db, require_admin, serialize, now_utc

router = APIRouter(tags=["data quality"])
STALE_IMPORT_DAYS = 30
RECONCILIATION_DAYS = 90
FINDING_LIMIT = 100
VALUATION_STALE_DAYS = 365


def _as_datetime(value):
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _age_days(value, now):
    timestamp = _as_datetime(value)
    if not timestamp:
        return None
    return max(0, (now - timestamp.astimezone(timezone.utc)).days)


@router.get("/data-quality")
async def data_quality_summary(user: dict = Depends(require_admin)):
    now = now_utc()
    accounts = await db.accounts.find({"deleted_at": {"$exists": False}}).to_list(1000)
    account_names = {str(item["_id"]): item.get("name") or "Account" for item in accounts}
    transactions = await db.transactions.find({"deleted_at": {"$exists": False}}).sort(
        [("created_at", -1)]
    ).to_list(20000)
    latest_activity = {}
    for txn in transactions:
        if txn.get("transaction_status") in ("PENDING", "VOID"):
            continue
        for account_id in (txn.get("account_id"), txn.get("to_account_id")):
            if account_id and account_id not in latest_activity:
                latest_activity[account_id] = txn.get("created_at")

    findings = []
    counts = {
        "stale_imported_balances": 0,
        "reconciliation_due": 0,
        "reconciliation_variances": 0,
        "uncategorized_transactions": 0,
        "unassigned_transactions": 0,
        "positions_missing_valuation_details": 0,
        "estimated_valuations": 0,
        "stale_valuations": 0,
    }
    for account in accounts:
        account_id = str(account["_id"])
        if account.get("reconciliation_status") == "VARIANCE":
            counts["reconciliation_variances"] += 1
            findings.append({
                "id": f"variance:{account_id}",
                "kind": "RECONCILIATION_VARIANCE",
                "severity": "HIGH",
                "title": f"Statement difference · {account.get('name') or 'Account'}",
                "detail": "The most recent statement comparison did not match the ledger. Review the comparison; no balance was changed automatically.",
                "path": "/accounts",
                "record_id": account_id,
            })
        reconciled_at = account.get("last_reconciled_at")
        age = _age_days(reconciled_at, now)
        created_age = _age_days(account.get("created_at"), now)
        if age is None and created_age is not None and created_age >= RECONCILIATION_DAYS:
            age = created_age
        if age is not None and age >= RECONCILIATION_DAYS:
            counts["reconciliation_due"] += 1
            findings.append({
                "id": f"reconcile:{account_id}",
                "kind": "RECONCILIATION_DUE",
                "severity": "MEDIUM",
                "title": f"Statement check due · {account.get('name') or 'Account'}",
                "detail": "This manually maintained balance has no recent statement comparison. Reconcile it to confirm its accuracy.",
                "path": "/accounts",
                "record_id": account_id,
                "age_days": age,
            })
        if (account.get("balance_source") or "").upper() == "IMPORT":
            source_updated = latest_activity.get(account_id) or account.get("updated_at") or account.get("created_at")
            source_age = _age_days(source_updated, now)
            if source_age is None or source_age >= STALE_IMPORT_DAYS:
                counts["stale_imported_balances"] += 1
                findings.append({
                    "id": f"stale-import:{account_id}",
                    "kind": "STALE_IMPORTED_BALANCE",
                    "severity": "MEDIUM",
                    "title": f"Imported balance may be stale · {account.get('name') or 'Account'}",
                    "detail": f"The most recent imported ledger activity is {source_age if source_age is not None else 'unknown'} days old. Refresh the source or compare a current statement.",
                    "path": "/accounts",
                    "record_id": account_id,
                    "age_days": source_age,
                })

    position_sources = (
        (db.savings, "current_value", "/savings", "savings"),
        (db.pf_ppf, "current_balance", "/pf-ppf", "retirement"),
        (db.investments, "current_value", "/savings", "investment"),
        (db.assets, "current_value", "/net-worth", "asset"),
        (db.liabilities, "outstanding", "/net-worth", "liability"),
        (db.loans, "outstanding", "/loans", "loan"),
    )
    for collection, value_key, path, label in position_sources:
        records = await collection.find({"deleted_at": {"$exists": False}}).to_list(2000)
        for record in records:
            source = (
                record.get("valuation_source")
                or record.get("balance_source")
                or record.get("record_source")
                or ("IMPORT" if record.get("source_document") or record.get("source_import_id") else None)
            )
            as_of = record.get("valuation_date")
            record_id = str(record.get("_id", ""))
            name = record.get("name") or record.get("institution") or record.get("policy_name") or label.title()
            age = _age_days(as_of, now)
            if not source or age is None:
                counts["positions_missing_valuation_details"] += 1
                missing = "source and date" if not source and age is None else "source" if not source else "valuation date"
                findings.append({
                    "id": f"valuation-details:{label}:{record_id}",
                    "kind": "MISSING_VALUATION_DETAILS",
                    "severity": "MEDIUM",
                    "title": f"Missing {missing} · {name}",
                    "detail": f"This {label} value needs a valuation source and date so its reliability and freshness are clear.",
                    "path": path,
                    "record_id": record_id,
                })
            if str(source or "").strip().lower() in {"manual", "manual estimate", "estimate"}:
                counts["estimated_valuations"] += 1
                findings.append({
                    "id": f"estimated-valuation:{label}:{record_id}",
                    "kind": "ESTIMATED_VALUATION",
                    "severity": "LOW",
                    "title": f"Estimated value · {name}",
                    "detail": "This value is marked as a manual estimate, not a statement, market quote, or professional valuation.",
                    "path": path,
                    "record_id": record_id,
                    "amount": record.get(value_key, 0),
                })
            if age is not None and age >= VALUATION_STALE_DAYS:
                counts["stale_valuations"] += 1
                findings.append({
                    "id": f"stale-valuation:{label}:{record_id}",
                    "kind": "STALE_VALUATION",
                    "severity": "MEDIUM",
                    "title": f"Value may be out of date · {name}",
                    "detail": f"The recorded valuation is {age} days old. Review it before relying on current totals.",
                    "path": path,
                    "record_id": record_id,
                    "age_days": age,
                    "amount": record.get(value_key, 0),
                })

    for txn in transactions:
        if txn.get("type") not in ("INCOME", "EXPENSE") or txn.get("transaction_status") == "VOID":
            continue
        classification = txn.get("category") if txn["type"] == "EXPENSE" else txn.get("source")
        is_uncategorized = not classification or str(classification).strip().lower() in {
            "uncategorized", "imported statement",
        }
        if is_uncategorized:
            counts["uncategorized_transactions"] += 1
            findings.append({
                "id": f"uncategorized:{txn.get('_id')}",
                "kind": "UNCATEGORIZED_TRANSACTION",
                "severity": "LOW",
                "title": f"Uncategorized {txn['type'].lower()}",
                "detail": f"{txn.get('date') or 'Undated'} · {txn.get('description') or 'Add a category/source so reports and budgets are accurate.'}",
                "path": "/expenses" if txn["type"] == "EXPENSE" else "/income",
                "record_id": str(txn.get("_id")),
                "amount": txn.get("amount", 0),
            })
        account_id = txn.get("account_id")
        if not account_id or account_id not in account_names:
            counts["unassigned_transactions"] += 1
            findings.append({
                "id": f"unassigned:{txn.get('_id')}",
                "kind": "UNASSIGNED_TRANSACTION",
                "severity": "LOW",
                "title": "Transaction has no active account",
                "detail": f"{txn.get('date') or 'Undated'} · {txn.get('description') or txn.get('category') or txn.get('source') or 'Assign an account to improve balance accuracy.'}",
                "path": "/expenses" if txn["type"] == "EXPENSE" else "/income",
                "record_id": str(txn.get("_id")),
                "amount": txn.get("amount", 0),
            })

    priority = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    findings.sort(key=lambda item: (priority[item["severity"]], item["kind"], item["title"]))
    total_issues = sum(counts.values())
    return {
        "generated_at": serialize({"at": now})["at"],
        "thresholds": {
            "imported_balance_stale_days": STALE_IMPORT_DAYS,
            "reconciliation_due_days": RECONCILIATION_DAYS,
            "valuation_stale_days": VALUATION_STALE_DAYS,
        },
        "counts": counts,
        "total_issues": total_issues,
        "findings": findings[:FINDING_LIMIT],
        "truncated": total_issues > FINDING_LIMIT,
    }
