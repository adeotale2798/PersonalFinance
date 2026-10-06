"""Idempotent demo data seed for a great first impression. Runs only when empty."""
from datetime import datetime, timezone, timedelta
from core import db, now_utc, hash_password


def d(days_ago):
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).date().isoformat()


def month_ago(m):
    dt = datetime.now(timezone.utc)
    y, mo = dt.year, dt.month - m
    while mo <= 0:
        mo += 12; y -= 1
    return f"{y:04d}-{mo:02d}"


async def seed_demo():
    if await db.accounts.count_documents({}) > 0:
        return

    # ---- accounts ----
    accounts = [
        {"name": "HDFC Salary Account", "type": "BANK", "bank_name": "HDFC Bank", "masked_number": "••4821", "opening_balance": 250000, "owner": "Self", "currency": "INR", "status": "ACTIVE"},
        {"name": "ICICI Savings", "type": "BANK", "bank_name": "ICICI Bank", "masked_number": "••7734", "opening_balance": 480000, "owner": "Self", "currency": "INR", "status": "ACTIVE"},
        {"name": "Cash in Hand", "type": "CASH", "opening_balance": 65000, "owner": "Self", "currency": "INR", "status": "ACTIVE"},
        {"name": "SBI Project Account", "type": "BANK", "bank_name": "State Bank of India", "masked_number": "••1290", "opening_balance": 1500000, "owner": "Self", "currency": "INR", "status": "ACTIVE"},
    ]
    res = await db.accounts.insert_many([{**a, "created_at": now_utc()} for a in accounts])
    acc_ids = [str(i) for i in res.inserted_ids]
    salary_acc, icici_acc, cash_acc, project_acc = acc_ids

    # ---- family ----
    fam = [
        {"name": "Self", "relation": "Self", "notes": "Primary account holder"},
        {"name": "Priya", "relation": "Spouse"},
        {"name": "Aarav", "relation": "Child"},
    ]
    await db.family_members.insert_many([{**f, "created_at": now_utc()} for f in fam])

    # ---- transactions: 6 months of income & expenses ----
    txns = []
    for m in range(6):
        mk = month_ago(m)
        txns.append({"type": "INCOME", "date": f"{mk}-02", "amount": 185000, "account_id": salary_acc, "source": "Salary", "scope": "PERSONAL", "payment_mode": "Bank Transfer", "description": "Monthly salary"})
        txns.append({"type": "INCOME", "date": f"{mk}-10", "amount": 42000, "account_id": icici_acc, "source": "Rental", "scope": "PERSONAL", "payment_mode": "UPI", "description": "Rent received"})
        txns.append({"type": "INCOME", "date": f"{mk}-15", "amount": 18500, "account_id": icici_acc, "source": "Dividend", "scope": "PERSONAL", "description": "Mutual fund payout"})
        # expenses
        for cat, amt, day in [("Household", 32000, 5), ("Utilities", 8500, 7), ("Food", 21000, 12),
                              ("Travel", 12000, 18), ("EMI", 45000, 3), ("Subscriptions", 3200, 20),
                              ("Medical", 6500, 22), ("Shopping", 15000, 25)]:
            txns.append({"type": "EXPENSE", "date": f"{mk}-{day:02d}", "amount": amt, "account_id": salary_acc,
                         "category": cat, "scope": "PERSONAL", "payment_mode": "UPI", "description": f"{cat} expense"})
    for t in txns:
        t["created_at"] = now_utc(); t["created_by"] = "seed"
    await db.transactions.insert_many(txns)
    current_month = month_ago(0)
    starter_budgets = [
        ("Household", 40000), ("Utilities", 10000), ("Food", 25000),
        ("Travel", 10000), ("EMI", 50000), ("Subscriptions", 4000),
        ("Medical", 8000), ("Shopping", 16000),
    ]
    await db.budgets.insert_many([
        {
            "month": current_month, "category": category, "category_key": category.casefold(),
            "amount": amount, "budget_type": "MONTHLY", "rollover": False,
            "notes": "Starter plan — adjust to your household", "created_at": now_utc(),
            "created_by": "seed", "updated_at": now_utc(), "updated_by": "seed",
        }
        for category, amount in starter_budgets
    ])

    # ---- lending ----
    lendings = [
        {"direction": "LENT", "counterparty": "Rahul Sharma", "amount": 200000, "date": d(120), "purpose": "Business support", "interest_rate": 0, "due_date": d(-30),
         "repayments": [{"date": d(60), "amount": 50000, "note": "1st installment"}], "notes": "Friend"},
        {"direction": "LENT", "counterparty": "Meena Patel", "amount": 75000, "date": d(200), "purpose": "Medical emergency", "due_date": d(20),
         "repayments": [], "notes": "Overdue - follow up"},
        {"direction": "LENT", "counterparty": "Kiran Rao", "amount": 120000, "date": d(90), "purpose": "Home renovation", "due_date": d(60),
         "repayments": [{"date": d(30), "amount": 120000, "note": "Full repayment"}], "notes": ""},
        {"direction": "BORROWED", "counterparty": "Axis Bank Personal Loan", "amount": 800000, "date": d(365), "purpose": "Land purchase", "interest_rate": 10.5, "due_date": d(400),
         "repayments": [{"date": d(90), "amount": 150000}, {"date": d(30), "amount": 150000}], "notes": "EMI ongoing"},
    ]
    await db.lendings.insert_many([{**l, "created_at": now_utc()} for l in lendings])

    # ---- savings ----
    savings = [
        {"name": "Emergency Fund", "type": "SAVINGS", "institution": "ICICI", "owner": "Self", "current_value": 350000, "interest_rate": 6.5, "contributions": [{"date": d(90), "amount": 50000}, {"date": d(30), "amount": 50000}]},
        {"name": "HDFC Fixed Deposit", "type": "FD", "institution": "HDFC", "owner": "Self", "current_value": 500000, "interest_rate": 7.1, "start_date": d(200), "maturity_date": d(-165), "contributions": []},
        {"name": "Recurring Deposit", "type": "RD", "institution": "SBI", "owner": "Priya", "current_value": 120000, "interest_rate": 6.8, "contributions": [{"date": d(60), "amount": 10000}, {"date": d(30), "amount": 10000}]},
    ]
    await db.savings.insert_many([{**s, "created_at": now_utc()} for s in savings])

    # ---- pf / ppf ----
    pf = [
        {"kind": "PF", "institution": "EPFO", "account_number": "••••3421", "owner": "Self", "opening_balance": 850000, "current_balance": 985000, "contributions": [{"date": d(60), "amount": 22000, "type": "EMPLOYEE"}, {"date": d(30), "amount": 22000, "type": "EMPLOYEE"}]},
        {"kind": "PPF", "institution": "SBI", "account_number": "••••9902", "owner": "Self", "opening_balance": 620000, "current_balance": 705000, "maturity_date": d(-1200), "contributions": [{"date": d(45), "amount": 50000, "type": "SELF"}]},
    ]
    await db.pf_ppf.insert_many([{**p, "created_at": now_utc()} for p in pf])

    # ---- investments & assets & liabilities ----
    await db.investments.insert_many([
        {"type": "Mutual Fund", "name": "Nippon India Growth", "cost": 300000, "current_value": 412000, "owner": "Self", "created_at": now_utc()},
        {"type": "Stocks", "name": "Equity Portfolio", "cost": 500000, "current_value": 638000, "owner": "Self", "created_at": now_utc()},
    ])
    await db.assets.insert_many([
        {"type": "Property", "name": "Residential Plot - Whitefield", "purchase_value": 3500000, "current_value": 5200000, "owner": "Self", "created_at": now_utc()},
        {"type": "Vehicle", "name": "Toyota Fortuner", "purchase_value": 3800000, "current_value": 2900000, "owner": "Self", "created_at": now_utc()},
    ])
    await db.liabilities.insert_many([
        {"type": "Loan", "name": "Home Loan - HDFC", "principal": 4000000, "outstanding": 2850000, "interest_rate": 8.4, "due_date": d(-2000), "created_at": now_utc()},
    ])

    # ---- rental ----
    prop = await db.rental_properties.insert_one({
        "name": "Oakridge Villa", "address": "12, Green Terraces, Bangalore",
        "image_url": "https://images.unsplash.com/photo-1722421492323-eaf9c401befe?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "units": [
            {"name": "Ground Floor", "tenant": "Suresh Kumar", "monthly_rent": 28000, "deposit": 150000, "status": "OCCUPIED"},
            {"name": "First Floor", "tenant": "Anita Desai", "monthly_rent": 24000, "deposit": 120000, "status": "OCCUPIED"},
        ],
        "created_at": now_utc(),
    })
    pid = str(prop.inserted_id)
    rent_payments = []
    for m in range(5):
        mk = month_ago(m)
        received_g = 28000 if m > 0 else 0
        rent_payments.append({"property_id": pid, "property_name": "Oakridge Villa", "unit": "Ground Floor", "tenant": "Suresh Kumar",
                              "period": mk, "due_date": f"{mk}-05", "amount_due": 28000, "amount_received": received_g,
                              "status": "COLLECTED" if received_g else "PENDING", "created_at": now_utc()})
        rent_payments.append({"property_id": pid, "property_name": "Oakridge Villa", "unit": "First Floor", "tenant": "Anita Desai",
                              "period": mk, "due_date": f"{mk}-05", "amount_due": 24000, "amount_received": 24000,
                              "status": "COLLECTED", "created_at": now_utc()})
    await db.rent_payments.insert_many(rent_payments)

    # ---- project ----
    proj = await db.projects.insert_one({
        "name": "Skyline Heights Residence", "type": "Construction",
        "description": "3-storey family residence construction at Whitefield.",
        "location": "Whitefield, Bangalore", "start_date": d(180), "target_completion_date": d(-200),
        "budget": 8500000, "currency": "INR", "status": "ACTIVE", "progress": 45,
        "image_url": "https://images.unsplash.com/photo-1789603390646-fa0d023ed76a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "created_at": now_utc(),
    })
    proj_id = str(proj.inserted_id)
    parties = [
        {"project_id": proj_id, "name": "Arjun Design Studio", "party_type": "Architect", "scope": "Design & Drawings", "contact": "arjun@studio.com", "contract_value": 600000},
        {"project_id": proj_id, "name": "BuildRight Civil", "party_type": "Civil Contractor", "scope": "Civil & Structural", "contact": "info@buildright.com", "contract_value": 4200000},
        {"project_id": proj_id, "name": "FlowTech Plumbing", "party_type": "Plumber", "scope": "Plumbing", "contact": "flowtech@mail.com", "contract_value": 480000},
        {"project_id": proj_id, "name": "Voltas Electricals", "party_type": "Electrician", "scope": "Electrical", "contact": "voltas@mail.com", "contract_value": 520000},
    ]
    party_result = await db.parties.insert_many([{**p, "created_at": now_utc()} for p in parties])
    party_ids = [str(party_id) for party_id in party_result.inserted_ids]
    party_ids_by_name = {party["name"]: party_ids[index] for index, party in enumerate(parties)}
    proj_txns = []
    for m in range(5):
        mk = month_ago(m)
        proj_txns.append({"type": "INCOME", "date": f"{mk}-01", "amount": 1500000 if m == 4 else 0, "account_id": project_acc, "source": "Owner Contribution", "scope": "PROJECT", "project_id": proj_id, "description": "Fund transfer"})
        proj_txns.append({"type": "EXPENSE", "date": f"{mk}-08", "amount": 420000, "account_id": project_acc, "category": "Civil", "party": "BuildRight Civil", "scope": "PROJECT", "project_id": proj_id, "description": "Civil work payment"})
        proj_txns.append({"type": "EXPENSE", "date": f"{mk}-14", "amount": 85000, "account_id": project_acc, "category": "Materials", "party": "BuildRight Civil", "scope": "PROJECT", "project_id": proj_id, "description": "Cement & steel"})
        if m % 2 == 0:
            proj_txns.append({"type": "EXPENSE", "date": f"{mk}-20", "amount": 120000, "account_id": project_acc, "category": "Electrical", "party": "Voltas Electricals", "scope": "PROJECT", "project_id": proj_id, "description": "Wiring"})
        if m == 0:
            proj_txns.append({"type": "EXPENSE", "date": f"{mk}-24", "amount": 200000, "account_id": project_acc, "category": "Professional Fees", "party": "Arjun Design Studio", "scope": "PROJECT", "project_id": proj_id, "description": "Architect design milestone"})
    proj_txns = [t for t in proj_txns if t["amount"] > 0]
    for t in proj_txns:
        if t.get("party") in party_ids_by_name:
            t["party_id"] = party_ids_by_name[t["party"]]
            t["payment_mode"] = "Bank Transfer"
            t["payment_status"] = "RECORDED"
        t["created_at"] = now_utc(); t["created_by"] = "seed"
    await db.transactions.insert_many(proj_txns)

    # ---- party users with granular access ----
    await db.users.insert_many([
        {"email": "architect@nivara.app", "name": "Arjun (Architect)", "role": "PARTY_USER", "party_type": "Architect",
         "party_id": party_ids[0], "project_id": proj_id,
         "password_hash": hash_password("Architect@2026"), "active": True,
         "permissions": [{"project_id": proj_id, "project_name": "Skyline Heights Residence", "modules": {"work": "edit", "documents": "edit", "payments": "view", "overview": "view"}}], "created_at": now_utc()},
        {"email": "contractor.a@nivara.app", "name": "BuildRight (Contractor A)", "role": "PARTY_USER", "party_type": "Civil Contractor",
         "party_id": party_ids[1], "project_id": proj_id,
         "password_hash": hash_password("Contractor@2026"), "active": True,
         "permissions": [{"project_id": proj_id, "project_name": "Skyline Heights Residence", "modules": {"work": "edit", "documents": "edit", "requests": "edit", "payments": "view"}}], "created_at": now_utc()},
    ])


async def ensure_demo_party_links():
    """Repair party references for demo users created before portal linking existed."""
    for email, party_name in (
        ("architect@nivara.app", "Arjun Design Studio"),
        ("contractor.a@nivara.app", "BuildRight Civil"),
    ):
        user = await db.users.find_one({
            "email": email,
            "role": "PARTY_USER",
        })
        if not user:
            continue
        project_id = next(
            (grant.get("project_id") for grant in user.get("permissions", [])
             if grant.get("project_name") == "Skyline Heights Residence"),
            None,
        )
        project_id = user.get("project_id") or project_id
        if not project_id:
            continue
        party = await db.parties.find_one({
            "project_id": project_id,
            "name": party_name,
            "deleted_at": {"$exists": False},
        })
        if party:
            party_id = str(party["_id"])
            if user.get("party_id") != party_id:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"party_id": party_id, "project_id": project_id}},
                )
            await db.transactions.update_many(
                {
                    "project_id": project_id,
                    "party": party_name,
                    "party_id": {"$exists": False},
                },
                {"$set": {"party_id": party_id, "payment_mode": "Bank Transfer", "payment_status": "RECORDED"}},
            )


async def seed_v2():
    """Idempotent additive seed for loans, insurance, vehicles, farms, work logs."""
    # ---- home loan (real data) ----
    if await db.loans.count_documents({}) == 0:
        await db.loans.insert_one({
            "name": "Godrej Woodsville Home Loan",
            "lender": "ICICI Bank", "branch": "Pimple Saudagar, Pune",
            "type": "Home Loan", "account_name": "ANIKE",
            "property": "Plot (Galt), Godrej Woodsville Township, Hinjewadi, Pune",
            "sanctioned": 7000000, "disbursed": 6890624,
            "emi": 54570, "interest_rate": 7.30,
            "outstanding": 4984251,
            "start_date": "2023-06-04", "next_due_date": "2026-10-04",
            "maturity_date": "2038-11-04", "tenure_months": 174,
            "status": "Open", "notes": "EMI auto-debit. Prepayments made — outstanding as per bank statement 04/09/2026.",
            "created_at": now_utc(),
        })

    # ---- vehicles as assets ----
    if not await db.assets.find_one({"name": {"$regex": "Creta"}}):
        await db.assets.insert_many([
            {"type": "Vehicle", "name": "Hyundai Creta (MH12TN6513)", "reg_no": "MH12TN6513",
             "purchase_value": 1600000, "current_value": 1250000, "owner": "Self",
             "purchase_date": "2022-10-01", "notes": "Bought Oct 2022", "created_at": now_utc()},
            {"type": "Vehicle", "name": "TVS Apache RTR 200 4V", "reg_no": "",
             "purchase_value": 145000, "current_value": 95000, "owner": "Self",
             "purchase_date": "2021-01-01", "notes": "Bought 2021", "created_at": now_utc()},
        ])

    # ---- insurance ----
    if await db.insurance.count_documents({}) == 0:
        await db.insurance.insert_many([
            {"type": "Car", "policy_name": "Creta Motor Insurance", "provider": "ICICI Lombard",
             "policy_number": "", "insured": "Self", "asset_ref": "MH12TN6513",
             "premium": 28000, "frequency": "Yearly", "sum_insured": 1250000,
             "renewal_date": "2026-09-26", "status": "Active",
             "payments": [{"date": "2025-09-24", "amount": 26500, "note": "2025 renewal"}],
             "notes": "Creta comprehensive", "created_at": now_utc()},
            {"type": "Bike", "policy_name": "Apache 200 4V Insurance", "provider": "Bajaj Allianz",
             "insured": "Self", "asset_ref": "Apache 200 4V", "premium": 4200,
             "frequency": "Yearly", "sum_insured": 95000, "renewal_date": "2026-11-15",
             "status": "Active", "payments": [], "created_at": now_utc()},
            {"type": "Health", "policy_name": "Family Health Floater", "provider": "Star Health",
             "insured": "Family", "premium": 32000, "frequency": "Yearly", "sum_insured": 1000000,
             "renewal_date": "2027-03-10", "status": "Active",
             "payments": [{"date": "2026-03-08", "amount": 32000, "note": "FY26 premium"}],
             "notes": "Covers Self, Priya, Aarav", "created_at": now_utc()},
        ])

    # ---- farms (guava) + ledger ----
    if await db.farms.count_documents({}) == 0:
        f1 = await db.farms.insert_one({"name": "Guava Farm - Block A", "number": "GF-001", "area": 4.5,
                                        "area_unit": "acre", "crop": "Guava (Allahabad Safeda)", "location": "Junnar, Pune",
                                        "notes": "260 trees", "created_at": now_utc()})
        f2 = await db.farms.insert_one({"name": "Guava Farm - Block B", "number": "GF-002", "area": 3.0,
                                        "area_unit": "acre", "crop": "Guava (Taiwan Pink)", "location": "Junnar, Pune",
                                        "notes": "180 trees", "created_at": now_utc()})
        fids = [str(f1.inserted_id), str(f2.inserted_id)]
        ftx = []
        for i, fid in enumerate(fids):
            for m in range(4):
                mk = month_ago(m)
                ftx.append({"type": "INCOME", "date": f"{mk}-12", "amount": 85000 - i * 20000, "scope": "FARM",
                            "farm_id": fid, "source": "Guava Sale", "description": "Mandi sale", "created_at": now_utc(), "created_by": "seed"})
                for cat, amt, day in [("Fertilizer", 12000, 4), ("Labour", 18000, 8), ("Irrigation", 6000, 15), ("Pesticide", 8000, 20)]:
                    ftx.append({"type": "EXPENSE", "date": f"{mk}-{day:02d}", "amount": amt - i * 1000, "scope": "FARM",
                                "farm_id": fid, "category": cat, "description": f"{cat}", "created_at": now_utc(), "created_by": "seed"})
        await db.transactions.insert_many(ftx)

    # ---- project work logs + official/unofficial gov charges ----
    if await db.work_logs.count_documents({}) == 0:
        proj = await db.projects.find_one({"name": "Skyline Heights Residence"})
        if proj:
            pid = str(proj["_id"])
            await db.work_logs.insert_many([
                {"project_id": pid, "date": d(150), "title": "Site excavation & foundation", "party": "BuildRight Civil",
                 "status": "COMPLETED", "progress": 100, "description": "Excavation and PCC done.", "photos": [], "created_at": now_utc()},
                {"project_id": pid, "date": d(90), "title": "Ground floor slab casting", "party": "BuildRight Civil",
                 "status": "COMPLETED", "progress": 100, "description": "GF slab cast and cured.", "photos": [], "created_at": now_utc()},
                {"project_id": pid, "date": d(30), "title": "First floor brickwork", "party": "BuildRight Civil",
                 "status": "IN_PROGRESS", "progress": 60, "description": "Brickwork ongoing.", "photos": [], "created_at": now_utc()},
                {"project_id": pid, "date": d(5), "title": "Electrical conduiting", "party": "Voltas Electricals",
                 "status": "IN_PROGRESS", "progress": 40, "description": "Conduits being laid.", "photos": [], "created_at": now_utc()},
            ])
            await db.transactions.insert_many([
                {"type": "EXPENSE", "date": d(120), "amount": 320000, "scope": "PROJECT", "project_id": pid,
                 "category": "Government", "party": "Municipal Corporation", "official": True, "payment_class": "OFFICIAL",
                 "description": "Building plan sanction fees (receipt)", "created_at": now_utc(), "created_by": "seed"},
                {"type": "EXPENSE", "date": d(118), "amount": 90000, "scope": "PROJECT", "project_id": pid,
                 "category": "Government", "party": "Facilitation", "official": False, "payment_class": "UNOFFICIAL",
                 "description": "Approval facilitation (cash)", "created_at": now_utc(), "created_by": "seed"},
            ])
