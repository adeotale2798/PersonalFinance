const monthKey = (offset = 0) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - offset);
  return date.toISOString().slice(0, 7);
};
const dateInMonth = (offset, day) => `${monthKey(offset)}-${String(day).padStart(2, "0")}`;
const accounts = [
  { id: "account-hdfc", name: "HDFC Salary Account", type: "BANK", bank_name: "HDFC Bank", masked_number: "••4821", opening_balance: 250000, current_balance: 468500, owner: "Self", currency: "INR", status: "ACTIVE" },
  { id: "account-icici", name: "ICICI Savings", type: "BANK", bank_name: "ICICI Bank", masked_number: "••7734", opening_balance: 480000, current_balance: 542000, owner: "Self", currency: "INR", status: "ACTIVE" },
  { id: "account-cash", name: "Cash in Hand", type: "CASH", opening_balance: 65000, current_balance: 61200, owner: "Self", currency: "INR", status: "ACTIVE" },
  { id: "account-project", name: "SBI Project Account", type: "BANK", bank_name: "State Bank of India", masked_number: "••1290", opening_balance: 1500000, current_balance: 2240000, owner: "Self", currency: "INR", status: "ACTIVE" },
];
const family = [
  { id: "family-self", name: "Self", relation: "Self", notes: "Primary account holder" },
  { id: "family-priya", name: "Priya", relation: "Spouse", notes: "Family member" },
  { id: "family-aarav", name: "Aarav", relation: "Child", notes: "Family member" },
];

const projects = [
  { id: "project-skyline", name: "Skyline Heights Residence", type: "Construction", description: "A modern family home taking shape in Whitefield.", location: "Whitefield, Bangalore", start_date: dateInMonth(5, 1), target_completion_date: dateInMonth(-7, 1), budget: 8500000, currency: "INR", status: "ACTIVE", progress: 68, image_url: "" },
  { id: "project-orchard", name: "Orchard Renewal", type: "Agriculture", description: "A phased upgrade to the family orchard.", location: "Junnar, Pune", start_date: dateInMonth(2, 1), target_completion_date: dateInMonth(9, 1), budget: 1250000, currency: "INR", status: "ACTIVE", progress: 34, image_url: "" },
];

const parties = [
  { id: "party-architect", project_id: projects[0].id, name: "Arjun Design Studio", party_type: "Architect", scope: "Design & Drawings", contact: "arjun@example.com", contract_value: 600000 },
  { id: "party-civil", project_id: projects[0].id, name: "BuildRight Civil", party_type: "Civil Contractor", scope: "Civil & Structural", contact: "hello@example.com", contract_value: 4200000 },
  { id: "party-plumbing", project_id: projects[0].id, name: "FlowTech Plumbing", party_type: "Plumber", scope: "Plumbing", contact: "flowtech@example.com", contract_value: 480000 },
  { id: "party-electrical", project_id: projects[0].id, name: "Voltas Electricals", party_type: "Electrician", scope: "Electrical", contact: "voltas@example.com", contract_value: 520000 },
  { id: "party-orchard", project_id: projects[1].id, name: "Junnar Farm Services", party_type: "Contractor", scope: "Irrigation and orchard improvements", contact: "projects@example.com", contract_value: 600000 },
];

const transactions = [];
for (let m = 0; m < 8; m += 1) {
  transactions.push(
    { id: `income-salary-${m}`, type: "INCOME", date: dateInMonth(m, 2), amount: 185000, account_id: accounts[0].id, source: "Salary", scope: "PERSONAL", payment_mode: "Bank Transfer", description: "Monthly salary" },
    { id: `income-rent-${m}`, type: "INCOME", date: dateInMonth(m, 10), amount: 42000, account_id: accounts[1].id, source: "Rental", scope: "PERSONAL", payment_mode: "UPI", description: "Rent received" },
    { id: `income-investment-${m}`, type: "INCOME", date: dateInMonth(m, 15), amount: 18500, account_id: accounts[1].id, source: "Dividend", scope: "PERSONAL", description: "Investment payout" },
    { id: `expense-home-${m}`, type: "EXPENSE", date: dateInMonth(m, 5), amount: 32000, account_id: accounts[0].id, category: "Household", scope: "PERSONAL", payment_mode: "UPI", description: "Household essentials" },
    { id: `expense-food-${m}`, type: "EXPENSE", date: dateInMonth(m, 12), amount: 21000, account_id: accounts[0].id, category: "Food", scope: "PERSONAL", payment_mode: "UPI", description: "Groceries & dining" },
    { id: `expense-emi-${m}`, type: "EXPENSE", date: dateInMonth(m, 3), amount: 45500, account_id: accounts[0].id, category: "EMI", scope: "PERSONAL", payment_mode: "Bank Transfer", description: "Monthly home loan EMI" },
    { id: `expense-travel-${m}`, type: "EXPENSE", date: dateInMonth(m, 18), amount: 12000 + (m % 2) * 8000, account_id: accounts[0].id, category: "Travel", scope: "PERSONAL", payment_mode: "UPI", description: "Travel & transport" },
    { id: `project-expense-civil-${m}`, type: "EXPENSE", date: dateInMonth(m, 8), amount: 420000, account_id: accounts[3].id, category: "Civil", party: "BuildRight Civil", party_id: parties[1].id, scope: "PROJECT", project_id: projects[0].id, payment_mode: "Bank Transfer", payment_status: "RECORDED", description: "Construction milestone" },
  );
}
for (let m = 0; m < 4; m += 1) {
  transactions.push({
    id: `project-expense-orchard-${m}`, type: "EXPENSE", date: dateInMonth(m, 14), amount: 85000,
    account_id: accounts[3].id, category: ["Irrigation", "Equipment", "Materials", "Labour"][m],
    party: "Junnar Farm Services", party_id: "party-orchard", scope: "PROJECT",
    project_id: projects[1].id, payment_mode: "Bank Transfer", payment_status: "RECORDED",
    description: "Orchard improvement milestone",
  });
}

const lending = [
  { id: "lending-rahul", direction: "LENT", counterparty: "Rahul Sharma", amount: 200000, date: dateInMonth(4, 4), purpose: "Business support", interest_rate: 0, due_date: dateInMonth(-1, 15), repayments: [{ date: dateInMonth(2, 5), amount: 50000, note: "Installment received" }], notes: "On track" },
  { id: "lending-meena", direction: "LENT", counterparty: "Meena Patel", amount: 75000, date: dateInMonth(6, 9), purpose: "Personal loan", interest_rate: 0, due_date: dateInMonth(0, 24), repayments: [], notes: "Follow-up scheduled" },
  { id: "lending-kiran", direction: "LENT", counterparty: "Kiran Rao", amount: 120000, date: dateInMonth(3, 14), purpose: "Home renovation", interest_rate: 0, due_date: dateInMonth(2, 10), repayments: [{ date: dateInMonth(1, 15), amount: 120000, note: "Settled" }], notes: "" },
  { id: "lending-axis", direction: "BORROWED", counterparty: "Axis Bank Personal Loan", amount: 800000, date: dateInMonth(11, 2), purpose: "Property improvement", interest_rate: 10.5, due_date: dateInMonth(1, 5), repayments: [{ date: dateInMonth(2, 5), amount: 150000 }, { date: dateInMonth(1, 5), amount: 150000 }], notes: "Monthly EMI" },
];

const savings = [
  { id: "saving-emergency", name: "Emergency Fund", type: "SAVINGS", institution: "ICICI Bank", owner: "Self", current_value: 350000, interest_rate: 6.5, contributions: [{ date: dateInMonth(2, 10), amount: 50000 }, { date: dateInMonth(0, 10), amount: 50000 }] },
  { id: "saving-fd", name: "HDFC Fixed Deposit", type: "FD", institution: "HDFC Bank", owner: "Self", current_value: 500000, interest_rate: 7.1, start_date: dateInMonth(6, 1), maturity_date: dateInMonth(-5, 1), contributions: [] },
  { id: "saving-rd", name: "Family Recurring Deposit", type: "RD", institution: "SBI", owner: "Priya", current_value: 120000, interest_rate: 6.8, contributions: [{ date: dateInMonth(1, 10), amount: 10000 }, { date: dateInMonth(0, 10), amount: 10000 }] },
];

const pfPpf = [
  { id: "retirement-epf", kind: "PF", institution: "EPFO", account_number: "••••3421", owner: "Self", opening_balance: 850000, current_balance: 985000, contributions: [{ date: dateInMonth(1, 2), amount: 22000, type: "EMPLOYEE" }, { date: dateInMonth(0, 2), amount: 22000, type: "EMPLOYEE" }] },
  { id: "retirement-ppf", kind: "PPF", institution: "SBI", account_number: "••••9902", owner: "Self", opening_balance: 620000, current_balance: 705000, maturity_date: dateInMonth(-40, 1), contributions: [{ date: dateInMonth(1, 15), amount: 50000, type: "SELF" }] },
];

const investments = [
  { id: "investment-mf", type: "Mutual Fund", name: "Nippon India Growth", cost: 300000, current_value: 412000, owner: "Self" },
  { id: "investment-equity", type: "Stocks", name: "Equity Portfolio", cost: 500000, current_value: 638000, owner: "Self" },
  { id: "investment-index", type: "Index Fund", name: "Nifty 50 Index Fund", cost: 225000, current_value: 264500, owner: "Priya" },
];

const assets = [
  { id: "asset-plot", type: "Property", name: "Residential Plot · Whitefield", purchase_value: 3500000, current_value: 5200000, owner: "Self" },
  { id: "asset-car", type: "Vehicle", name: "Hyundai Creta", purchase_value: 1600000, current_value: 1250000, owner: "Self" },
  { id: "asset-bike", type: "Vehicle", name: "TVS Apache RTR", purchase_value: 145000, current_value: 95000, owner: "Self" },
];

const liabilities = [
  { id: "liability-home", type: "Loan", name: "Home Loan · HDFC", principal: 4000000, outstanding: 2850000, interest_rate: 8.4, due_date: dateInMonth(-180, 1) },
];

const loans = [
  { id: "loan-woodsville", name: "Godrej Woodsville Home Loan", lender: "ICICI Bank", branch: "Pune", type: "Home Loan", account_name: "Family", property: "Godrej Woodsville Township", sanctioned: 7000000, disbursed: 6890624, emi: 54570, interest_rate: 7.3, outstanding: 4984251, start_date: "2023-06-04", next_due_date: dateInMonth(0, 4), maturity_date: "2038-11-04", tenure_months: 174, status: "Open", notes: "EMI scheduled monthly." },
];

const insurance = [
  { id: "insurance-car", type: "Car", policy_name: "Creta Motor Insurance", provider: "ICICI Lombard", insured: "Self", asset_ref: "MH12TN6513", premium: 28000, frequency: "Yearly", sum_insured: 1250000, renewal_date: dateInMonth(1, 15), status: "Active", payments: [{ date: dateInMonth(-12, 12), amount: 26500, note: "Previous renewal" }] },
  { id: "insurance-bike", type: "Bike", policy_name: "Apache Two-Wheeler Cover", provider: "Bajaj Allianz", insured: "Self", asset_ref: "Apache RTR", premium: 4200, frequency: "Yearly", sum_insured: 95000, renewal_date: dateInMonth(4, 15), status: "Active", payments: [] },
  { id: "insurance-health", type: "Health", policy_name: "Family Health Floater", provider: "Star Health", insured: "Family", premium: 32000, frequency: "Yearly", sum_insured: 1000000, renewal_date: dateInMonth(6, 10), status: "Active", payments: [{ date: dateInMonth(-7, 8), amount: 32000, note: "Annual premium" }] },
];

const rentalProperties = [{
  id: "rental-oakridge", name: "Oakridge Villa", address: "12 Green Terraces, Bangalore", current_value: 7800000,
  units: [
    { name: "Ground Floor", tenant: "Suresh Kumar", monthly_rent: 28000, deposit: 150000, status: "OCCUPIED" },
    { name: "First Floor", tenant: "Anita Desai", monthly_rent: 24000, deposit: 120000, status: "OCCUPIED" },
  ],
}];
const rentalPayments = Array.from({ length: 8 }, (_, m) => [
  { id: `rent-ground-${m}`, property_id: rentalProperties[0].id, property_name: "Oakridge Villa", unit: "Ground Floor", tenant: "Suresh Kumar", period: monthKey(m), due_date: dateInMonth(m, 5), amount_due: 28000, amount_received: m === 0 ? 0 : 28000, status: m === 0 ? "PENDING" : "COLLECTED" },
  { id: `rent-first-${m}`, property_id: rentalProperties[0].id, property_name: "Oakridge Villa", unit: "First Floor", tenant: "Anita Desai", period: monthKey(m), due_date: dateInMonth(m, 5), amount_due: 24000, amount_received: 24000, status: "COLLECTED" },
]).flat();

const farms = [
  { id: "farm-block-a", name: "Guava Farm · Block A", number: "GF-001", area: 4.5, area_unit: "acre", crop: "Guava · Allahabad Safeda", location: "Junnar, Pune", notes: "260 trees" },
  { id: "farm-block-b", name: "Guava Farm · Block B", number: "GF-002", area: 3, area_unit: "acre", crop: "Guava · Taiwan Pink", location: "Junnar, Pune", notes: "180 trees" },
];
const farmRentPayments = [
  { id: "farm-rent-a", farm_id: farms[0].id, farm_name: farms[0].name, tenant: "Green Valley Produce", period: String(new Date().getFullYear()), due_date: dateInMonth(0, 10), amount_due: 80000, amount_received: 40000, status: "PARTIAL" },
  { id: "farm-rent-b", farm_id: farms[1].id, farm_name: farms[1].name, tenant: "Junnar Fresh Co-op", period: String(new Date().getFullYear()), due_date: dateInMonth(0, 18), amount_due: 40000, amount_received: 20000, status: "PARTIAL" },
];
for (let m = 0; m < 6; m += 1) {
  farms.forEach((farm, index) => {
    transactions.push(
      { id: `farm-income-${index}-${m}`, type: "INCOME", date: dateInMonth(m, 12), amount: 85000 - index * 20000, scope: "FARM", farm_id: farm.id, source: "Guava Sale", category: "Guava Sale", description: "Fresh produce sale" },
      { id: `farm-expense-${index}-${m}`, type: "EXPENSE", date: dateInMonth(m, 8), amount: 44000 - index * 3000, scope: "FARM", farm_id: farm.id, category: "Farm operations", description: "Seasonal farm operations" },
    );
  });
}

const documents = [
  { id: "document-home", filename: "Home-loan statement.pdf", category: "Loan", owner: "Self", project_id: "", created_at: dateInMonth(0, 4), size: 347000, official: true },
  { id: "document-build", filename: "Construction estimate.pdf", category: "Project", owner: "Self", project_id: projects[0].id, created_at: dateInMonth(1, 16), size: 512000, official: true },
  { id: "document-insurance", filename: "Family health policy.pdf", category: "Insurance", owner: "Family", project_id: "", created_at: dateInMonth(2, 8), size: 218000, official: true },
];

const diary = [
  { id: "diary-1", date: dateInMonth(0, 3), title: "Quarterly money review", body: "Reviewed cash flow, upcoming renewals and project milestones.", tags: ["review", "planning"], mood: "Focused" },
  { id: "diary-2", date: dateInMonth(0, 1), title: "Construction milestone", body: "First-floor work is progressing well; next payment is scheduled after inspection.", tags: ["project"], mood: "Positive" },
];

const goals = [
  { id: "goal-home", name: "Complete family home", target_amount: 8500000, current_amount: 5780000, target_date: dateInMonth(-10, 1), status: "ACTIVE", category: "Property" },
  { id: "goal-education", name: "Aarav education fund", target_amount: 2500000, current_amount: 740000, target_date: dateInMonth(-60, 1), status: "ACTIVE", category: "Education" },
  { id: "goal-emergency", name: "6-month emergency fund", target_amount: 900000, current_amount: 350000, target_date: dateInMonth(-8, 1), status: "ACTIVE", category: "Savings" },
];

const notifications = [
  { id: "notification-renewal", title: "Insurance renewal coming up", message: "Creta Motor Insurance renews soon.", kind: "INSURANCE_RENEWAL", severity: "warning", status: "OPEN", due_date: dateInMonth(0, 15), amount: 28000, action: { label: "Review policy", path: "/insurance" }, created_at: dateInMonth(0, 1) },
  { id: "notification-budget", title: "Project milestone updated", message: "Skyline Heights has reached 68% completion.", kind: "PROJECT_UPDATE", severity: "info", status: "OPEN", due_date: dateInMonth(0, 20), amount: 0, action: { label: "Open project", path: `/projects/${projects[0].id}` }, created_at: dateInMonth(0, 2) },
  { id: "notification-rent", title: "Rent payment pending", message: "Ground Floor rent is awaiting collection.", kind: "RENT_DUE", severity: "critical", status: "ACKNOWLEDGED", due_date: dateInMonth(0, 5), amount: 28000, action: { label: "Record collection", path: "/rental" }, acknowledged_at: dateInMonth(0, 6), created_at: dateInMonth(0, 3) },
];

const workLogs = [
  { id: "work-foundation", project_id: projects[0].id, date: dateInMonth(5, 12), title: "Site excavation & foundation", party: "BuildRight Civil", status: "COMPLETED", progress: 100, description: "Excavation and foundation complete.", photos: [] },
  { id: "work-slab", project_id: projects[0].id, date: dateInMonth(3, 18), title: "Ground floor slab casting", party: "BuildRight Civil", status: "COMPLETED", progress: 100, description: "Slab cast and cured.", photos: [] },
  { id: "work-brickwork", project_id: projects[0].id, date: dateInMonth(0, 2), title: "First floor brickwork", party: "BuildRight Civil", status: "IN_PROGRESS", progress: 72, description: "Brickwork and lintels in progress.", photos: [] },
];

const data = {
  accounts, family, projects, parties, transactions, lending, savings, pfPpf, investments, assets, liabilities, loans, insurance,
  rentalProperties, rentalPayments, farms, documents, diary, goals, notifications, workLogs,
  farmRentPayments,
  users: [
    { id: "user-admin", name: "Nivara Demo Admin", email: "demo.admin@nivara.app", role: "ADMIN", active: true },
    { id: "user-architect", name: "Arjun (Architect)", email: "architect@example.com", role: "PARTY_USER", active: true, party_type: "Architect" },
    { id: "user-contractor", name: "BuildRight (Contractor)", email: "contractor@example.com", role: "PARTY_USER", active: true, party_type: "Civil Contractor" },
  ],
  losses: [
    { id: "loss-market", date: dateInMonth(2, 20), group: "Stock Market", category: "Equity", kind: "REALIZED", title: "Illustrative market fluctuation", amount: 18500 },
    { id: "loss-repair", date: dateInMonth(4, 11), group: "Other", category: "Property", kind: "REALIZED", title: "Property maintenance", amount: 12500 },
  ],
  necessities: [
    { id: "necessity-car", name: "Car maintenance", category: "Vehicle", amount: 8500, frequency: "Monthly", owner: "Self" },
    { id: "necessity-school", name: "School fees", category: "Education", amount: 18000, frequency: "Monthly", owner: "Aarav" },
  ],
};

const initialDemoFinancials = {
  bank: accounts.filter((item) => item.type !== "CASH").reduce((sum, item) => sum + Number(item.current_balance || 0), 0),
  cash: accounts.filter((item) => item.type === "CASH").reduce((sum, item) => sum + Number(item.current_balance || 0), 0),
  savings: savings.reduce((sum, item) => sum + Number(item.current_value || 0), 0),
  pfPpf: pfPpf.reduce((sum, item) => sum + Number(item.current_balance || 0), 0),
  investments: investments.reduce((sum, item) => sum + Number(item.current_value || 0), 0),
  assets: assets.reduce((sum, item) => sum + Number(item.current_value || 0), 0),
  liabilities: liabilities.reduce((sum, item) => sum + Number(item.outstanding || 0), 0),
  loans: loans.reduce((sum, item) => sum + Number(item.outstanding || 0), 0),
  lending: lending.reduce((sum, item) => {
    const outstanding = Number(item.amount || 0) - (item.repayments || []).reduce((paid, payment) => paid + Number(payment.amount || 0), 0);
    return sum + (item.direction === "LENT" ? Math.max(outstanding, 0) : 0);
  }, 0),
  borrowings: lending.reduce((sum, item) => {
    const outstanding = Number(item.amount || 0) - (item.repayments || []).reduce((paid, payment) => paid + Number(payment.amount || 0), 0);
    return sum + (item.direction === "BORROWED" ? Math.max(outstanding, 0) : 0);
  }, 0),
};

const allMonths = Array.from({ length: 12 }, (_, index) => monthKey(11 - index));
const trend = (key, base, growth) => allMonths.map((month, index) => ({ [key]: month, value: Math.round(base + index * growth) }));
const cashFlowSeries = allMonths.map((month, index) => ({ period: month, in: 245000 + index * 3200, out: 168000 + index * 2100, net: 77000 + index * 1100 }));
const overview = {
  net_worth: 9271450, total_assets: 15633201, total_liabilities: 6361751,
  cash: 61200, bank: 3250500, savings: 970000, pf_ppf: 1690000, investments: 1314500,
  lending_outstanding: 225000, borrowing_outstanding: 500000,
  month_income: 245000, month_expense: 168000, month_savings: 77000, month_rent_collected: 52000,
  project_spend: 3700000, active_projects: 2, total_projects: 2, total_budget: 9750000,
  cash_flow: cashFlowSeries,
  income_breakdown: [{ name: "Salary", value: 1480000 }, { name: "Rental", value: 336000 }, { name: "Dividend", value: 148000 }],
  expense_breakdown: [{ name: "Construction", value: 2100000 }, { name: "Household", value: 256000 }, { name: "EMI", value: 364000 }, { name: "Food", value: 168000 }],
  allocation: [{ name: "Bank", value: 3250500 }, { name: "Cash", value: 61200 }, { name: "Savings", value: 970000 }, { name: "PF/PPF", value: 1690000 }, { name: "Investments", value: 1314500 }, { name: "Property", value: 6545000 }, { name: "Receivables", value: 225000 }],
  attention: [{ type: "insurance_renewal", label: "Creta Motor Insurance renewal coming up", value: 28000, path: "/insurance" }, { type: "unpaid_rent", label: "Outstanding rent to collect", value: 28000, path: "/rental" }],
  budget_alerts: [{ id: "budget-near:demo-budget-food", label: "Food is nearing its plan", detail: "86% used · ₹3,920 remains", value: 3920, path: "/budgets", severity: "warning" }],
  next_actions: [{ id: "commitment:home-loan-emi", label: "Home loan EMI", detail: "Godrej Woodsville · due this month", value: 54570, due_date: dateInMonth(0, 4), path: "/loans", severity: "critical", source_collection: "loans", source_id: "loan-home" }],
  recent_activity: [],
  cash_position: { available_now: 3311700, expected_receivables: 253000, upcoming_obligations: 500000 },
  liability_allocation: [{ name: "Loans", value: 5861751 }, { name: "Borrowings", value: 500000 }],
};

const monthlySummary = (type, groupKey) => {
  const rows = transactions.filter((item) => item.type === type);
  const groups = {};
  rows.forEach((item) => { const key = item[groupKey] || "Other"; groups[key] = (groups[key] || 0) + item.amount; });
  const byMonth = {};
  rows.forEach((item) => {
    const month = (item.date || "").slice(0, 7);
    if (month) byMonth[month] = (byMonth[month] || 0) + item.amount;
  });
  const byGroup = Object.entries(groups).map(([name, value]) => ({ name, value }));
  return {
    total: rows.reduce((sum, item) => sum + item.amount, 0),
    this_month: type === "INCOME" ? overview.month_income : overview.month_expense,
    this_year: rows.filter((item) => item.date.startsWith(String(new Date().getFullYear()))).reduce((sum, item) => sum + item.amount, 0),
    by_group: byGroup,
    by_category: byGroup,
    by_month: allMonths.map((month, index) => ({ month, value: byMonth[month] || (type === "INCOME" ? 245000 : 168000) + index * (type === "INCOME" ? 3200 : 2100) })),
  };
};

const netWorth = {
  net_worth: overview.net_worth, total_assets: overview.total_assets, total_liabilities: overview.total_liabilities,
  breakdown: { bank: overview.bank, cash: overview.cash, savings: overview.savings, pf_ppf: overview.pf_ppf, investments: overview.investments, property: 6545000, receivables: overview.lending_outstanding },
  liability_breakdown: { loans: 5861751, borrowings: 500000 }, allocation: overview.allocation,
};
const netWorthHistory = { items: allMonths.map((month, index) => ({ date: `${month}-01`, net_worth: 8120000 + index * 104000 })), note: "Illustrative sample history for the public demo." };

const staticResponses = {
  "/dashboard/overview": overview,
  "/networth": netWorth,
  "/networth/history": netWorthHistory,
  "/income/summary": monthlySummary("INCOME", "source"),
  "/expenses/summary": monthlySummary("EXPENSE", "category"),
  "/savings/summary": { total: 970000, count: savings.length, by_type: [{ name: "SAVINGS", value: 350000 }, { name: "FD", value: 500000 }, { name: "RD", value: 120000 }], contribution_trend: trend("month", 18000, 2500) },
  "/pf-ppf/summary": { total: 1690000, pf: 985000, ppf: 705000, count: pfPpf.length, contribution_trend: trend("month", 22000, 4500) },
  "/loans/summary": { total_sanctioned: 7000000, total_outstanding: 4984251, total_paid: 1906373, monthly_emi: 54570, count: loans.length, upcoming: loans },
  "/insurance/summary": { total_annual_premium: 64200, total_cover: 2345000, count: insurance.length, upcoming_renewals: [{ ...insurance[0], days: 20 }], by_type: [{ name: "Car", value: 28000 }, { name: "Health", value: 32000 }, { name: "Bike", value: 4200 }] },
  "/rental/summary": { monthly_rent: 52000, collected: 52000, outstanding: 28000, overdue: 0, collection_rate: 65, income_trend: trend("month", 42000, 900), by_property: [{ name: "Oakridge Villa", value: 52000 }] },
  "/farms/summary": { total_income: 990000, total_expense: 492000, net: 498000, count: farms.length, per_farm: [{ ...farms[0], income: 510000, expense: 264000, net: 246000 }, { ...farms[1], income: 480000, expense: 228000, net: 252000 }], monthly: allMonths.map((month, index) => ({ month, in: 120000 + index * 3000, out: 82000 + index * 1400 })), annual_rent_due: 120000, annual_rent_received: 60000 },
  "/planning/overview": {
    actions: [{ id: "planner-rent", title: "Collect rent", due_date: dateInMonth(0, 5), amount: 28000, kind: "RECEIVABLE", path: "/rental", detail: "Oakridge Villa" }],
    calendar: [{ id: "calendar-emi", title: "Home loan EMI", due_date: dateInMonth(0, 4), amount: 54570, kind: "LOAN", path: "/loans", detail: "Godrej Woodsville" }],
    timeline: transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    forecast: { cash_on_hand: 3311700, recorded_income: 245000, recorded_expense: 168000, scheduled_out: 54570, scheduled_in: 28000, projected_balance: 3285158, minimum_balance: 3250000, minimum_balance_date: dateInMonth(0, 30), tight_dates: [], daily_projection: [] },
    health: { score: 82, signals: [{ label: "Emergency reserve is on track", good: true }, { label: "Insurance records are in place", good: true }, { label: "Monthly cash flow is positive", good: true }, { label: "Review the upcoming home-loan EMI", good: false }], metrics: { debt_to_income: 28, emi_ratio: 22, tax_documents: 1, scheduled_contributions: 2 } },
  },
  "/planning/ownership": { owners: [{ name: "Self", value: 10140000 }, { name: "Priya", value: 1470000 }, { name: "Farm / business", value: 252000 }], views: { mine: 10140000, family: 1470000, farm_business: 252000, consolidated: 11862000 } },
  "/planning/inbox": [
    { id: "review-expense", source: "transaction", source_id: "expense-home-0", title: "Household expense", detail: "Household · HDFC Salary Account", date: dateInMonth(0, 5), amount: 32000, state: "NEEDS_REVIEW", kind: "Expense" },
    { id: "review-rent", source: "rent_payment", source_id: "rent-ground-0", title: "Oakridge Villa rent", detail: "Ground Floor · Suresh Kumar", date: dateInMonth(0, 5), amount: 28000, state: "NEEDS_REVIEW", kind: "Collection" },
  ],
  "/settings": { date_format: "DD-MM-YYYY", currency: "INR", organization_name: "Nivara Family Office", require_review: false, version: "2.6.0", income_categories: ["Salary", "Rental", "Dividend", "Business", "Other"], expense_categories: ["Household", "Utilities", "Food", "Travel", "EMI", "Medical", "Other"], project_categories: ["Civil", "Architecture", "Structural", "Plumbing", "Electrical", "Government", "Materials", "Labour", "Interior", "Consultant", "Equipment", "Transport", "Miscellaneous"], payment_methods: ["UPI", "Cash", "Bank Transfer", "Card", "Cheque"] },
  "/version-history": { current: "2.6.0", releases: [{ version: "2.6.0", title: "A clearer financial picture", summary: "A unified workspace for household finances, projects and long-term goals.", date: "2026-10-01", changes: ["Portfolio dashboards", "Project cost tracking", "Financial planning"], internals: [] }, { version: "2.5.0", title: "Planning & protection", summary: "More insight into goals, loans and insurance.", date: "2026-08-15", changes: ["Goal tracking", "Insurance renewal calendar"], internals: [] }] },
  "/access-meta": { roles: ["ADMIN", "PARTY_USER"], modules: ["overview", "work", "documents", "payments", "requests"] },
  "/error-logs/unread-count": { count: 0 },
  "/error-logs?scope=all": [],
  "/error-logs?scope=unread": [],
  "/notifications": { items: notifications, count: notifications.length },
};
let demoWalkthroughEnabled = true;
let demoBudgets = [
  { id: "demo-budget-household", month: monthKey(), category: "Household", category_key: "household", amount: 40000, budget_type: "MONTHLY", rollover: false, notes: "" },
  { id: "demo-budget-food", month: monthKey(), category: "Food", category_key: "food", amount: 28000, budget_type: "MONTHLY", rollover: false, notes: "" },
  { id: "demo-budget-emi", month: monthKey(), category: "EMI", category_key: "emi", amount: 50000, budget_type: "MONTHLY", rollover: false, notes: "" },
  { id: "demo-budget-travel", month: monthKey(), category: "Travel", category_key: "travel", amount: 20000, budget_type: "MONTHLY", rollover: false, notes: "" },
  { id: "demo-budget-medical", month: monthKey(), category: "Medical", category_key: "medical", amount: 12000, budget_type: "SINKING", rollover: true, notes: "Illustrative health reserve" },
  { id: "demo-budget-medical-prior", month: monthKey(1), category: "Medical", category_key: "medical", amount: 12000, budget_type: "SINKING", rollover: true, notes: "" },
];
let demoReconciliations = [];
let demoRecurring = [];
const demoPlanningActionStates = new Map();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function recurringOverview() {
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);
  const items = demoRecurring.map((schedule) => {
    const due = new Date(`${schedule.next_due_date}T00:00:00`);
    const projected = [];
    const anchor = due.getDate();
    const cadenceMonths = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[schedule.cadence];
    for (let index = 0; schedule.status === "active" && due <= horizon && index < 100; index += 1) {
      if (due >= new Date(`${todayIso}T00:00:00`)) projected.push({ due_date: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`, amount: Number(schedule.amount), projected: true });
      if (schedule.cadence === "WEEKLY") due.setDate(due.getDate() + 7);
      else {
        const next = new Date(due.getFullYear(), due.getMonth() + cadenceMonths, 1);
        due.setTime(new Date(next.getFullYear(), next.getMonth(), Math.min(anchor, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())).getTime());
      }
    }
    const usage = schedule.last_used_date ? Math.max(0, Math.floor((new Date(`${todayIso}T00:00:00`) - new Date(`${schedule.last_used_date}T00:00:00`)) / 86400000)) : null;
    const latestPrice = schedule.price_history?.[schedule.price_history.length - 1];
    const nextDate = schedule.next_due_date;
    const daysToDue = Math.floor((new Date(`${nextDate}T00:00:00`) - new Date(`${todayIso}T00:00:00`)) / 86400000);
    return {
      ...schedule,
      usage_signal: { possibly_unused: schedule.status === "active" && usage !== null && usage >= 90, last_used_date: schedule.last_used_date || null, days_since_use: usage, threshold_days: 90, explanation: usage === null ? "Unknown: no explicitly dated last-used entry is recorded." : `Last recorded use was ${usage} days ago.` },
      price_signal: latestPrice?.change_type === "increase" ? { ...latestPrice, explanation: "The saved amount increased; confirm the new price before renewal." } : null,
      projected_occurrences: projected,
      days_to_due: daysToDue,
    };
  });
  const alerts = items.filter((item) => item.status === "active" && item.days_to_due <= 30).map((item) => ({
    schedule_id: item.id, name: item.name, due_date: item.next_due_date, amount: item.amount, days_until_due: item.days_to_due,
    message: item.days_to_due < 0 ? "Overdue" : item.days_to_due === 0 ? "Due today" : `Renews in ${item.days_to_due} days`,
  })).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return { items, renewal_alerts: alerts, projection_horizon_days: 90, unused_threshold_days: 90 };
}

function simulateDemoDebt(loans, extra, startDate, strategy) {
  const debts = loans.filter((loan) => Number(loan.outstanding) > 0).map((loan, index) => ({
    id: loan.id || String(index), name: loan.name || "Loan", balance: Number(loan.outstanding), starting_balance: Number(loan.outstanding),
    rate: Number(loan.interest_rate) || 0, emi: Number(loan.emi) || 0, interest_paid: 0, payoff_month: null, order: index,
  }));
  let totalInterest = 0;
  const totalEmi = debts.reduce((sum, debt) => sum + debt.emi, 0);
  let status = debts.length ? "horizon_exceeded" : "complete";
  let months = 0;
  for (let month = 1; debts.length && month <= 1200; month += 1) {
    let capacity = strategy === "minimum_only" ? 0 : totalEmi + extra;
    debts.forEach((debt) => {
      if (debt.balance <= 0) return;
      const interest = Math.round(debt.balance * debt.rate / 1200 * 100) / 100;
      debt.balance += interest;
      debt.interest_paid += interest;
      totalInterest += interest;
      const paid = Math.min(debt.emi, debt.balance);
      debt.balance -= paid;
      if (strategy !== "minimum_only") capacity -= paid;
    });
    const target = debts.filter((debt) => debt.balance > 0);
    target.sort((a, b) => strategy === "avalanche" ? b.rate - a.rate || a.order - b.order : a.balance - b.balance || a.order - b.order);
    if (strategy !== "minimum_only") target.forEach((debt) => {
      const paid = Math.min(debt.balance, Math.max(0, capacity));
      debt.balance -= paid;
      capacity -= paid;
    });
    debts.forEach((debt) => {
      if (debt.balance <= 0 && debt.payoff_month === null) {
        debt.balance = 0;
        debt.payoff_month = month;
      }
    });
    months = month;
    if (debts.every((debt) => debt.balance === 0)) { status = "complete"; break; }
    if (debts.some((debt) => debt.emi <= debt.balance * debt.rate / 1200) && debts.every((debt) => debt.emi === 0 || debt.emi <= debt.balance * debt.rate / 1200)) { status = "impossible"; break; }
  }
  const addMonths = (offset) => {
    const [year, month, day] = startDate.split("-").map(Number);
    const cursor = new Date(year, month - 1 + offset, 1);
    return `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(Math.min(day, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())).padStart(2, "0")}`;
  };
  const debtRows = debts.map((debt) => ({
    id: debt.id, name: debt.name, starting_balance: debt.starting_balance, interest_paid: debt.interest_paid,
    months: debt.payoff_month, payoff_date: debt.payoff_month ? addMonths(debt.payoff_month - 1) : null,
    status: debt.payoff_month ? "paid_off" : "not_paid_within_horizon", remaining_balance: debt.balance,
  }));
  return {
    strategy, status, months, payoff_date: status === "complete" ? addMonths(months - 1) : null,
    total_interest: Math.round(totalInterest * 100) / 100,
    total_paid: Math.round((debts.reduce((sum, debt) => sum + debt.starting_balance + debt.interest_paid - debt.balance, 0)) * 100) / 100,
    debts: debtRows, payoff_order: debtRows.filter((debt) => debt.months !== null).sort((a, b) => a.months - b.months).map((debt) => debt.id),
  };
}

function budgetOverview(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}`;
  const previousMonth = monthNumber === 1 ? `${year - 1}-12` : `${year}-${String(monthNumber - 1).padStart(2, "0")}`;
  const saved = new Map(demoBudgets.filter((plan) => plan.month === month).map((plan) => [plan.category_key, plan]));
  const previous = new Map(demoBudgets.filter((plan) => plan.month === previousMonth && plan.rollover).map((plan) => [plan.category_key, plan]));
  const actual = new Map();
  const pending = new Map();
  const labels = new Map();
  data.transactions.forEach((transaction) => {
    if (transaction.type !== "EXPENSE" || transaction.scope === "PROJECT" || transaction.project_id) return;
    if (transaction.date < `${month}-01` || transaction.date >= `${nextMonth}-01`) return;
    const category = (transaction.category || "Uncategorized").trim();
    const key = category.toLocaleLowerCase();
    labels.set(key, category);
    const target = transaction.transaction_status === "PENDING" ? pending : actual;
    if (transaction.transaction_status === "VOID") return;
    target.set(key, (target.get(key) || 0) + Number(transaction.amount || 0));
  });
  const priorSpent = new Map();
  data.transactions.forEach((transaction) => {
    if (transaction.type !== "EXPENSE" || transaction.scope === "PROJECT" || transaction.project_id || transaction.transaction_status === "PENDING" || transaction.transaction_status === "VOID") return;
    if (transaction.date < `${previousMonth}-01` || transaction.date >= `${month}-01`) return;
    const key = (transaction.category || "Uncategorized").trim().toLocaleLowerCase();
    priorSpent.set(key, (priorSpent.get(key) || 0) + Number(transaction.amount || 0));
  });
  const keys = new Set([...saved.keys(), ...actual.keys(), ...pending.keys()]);
  const items = Array.from(keys).sort().map((key) => {
    const plan = saved.get(key) || {};
    const previousPlan = previous.get(key);
    const amount = Number(plan.amount || 0);
    const carryover = plan.rollover && previousPlan ? Math.max(0, Number(previousPlan.amount || 0) - (priorSpent.get(key) || 0)) : 0;
    const spent = actual.get(key) || 0;
    const pendingAmount = pending.get(key) || 0;
    const available = amount + carryover;
    return {
      ...plan,
      category: plan.category || labels.get(key) || key,
      month,
      amount,
      carryover,
      available,
      actual: spent,
      pending: pendingAmount,
      remaining: available - spent,
      percent_used: available ? Math.round((spent / available) * 10000) / 100 : null,
      unplanned: !saved.has(key),
      budget_type: plan.budget_type || "MONTHLY",
      rollover: Boolean(plan.rollover),
    };
  });
  const sum = (key) => Math.round(items.reduce((total, item) => total + item[key], 0) * 100) / 100;
  return {
    month,
    items,
    planned_total: sum("amount"),
    available_total: sum("available"),
    actual_total: sum("actual"),
    pending_total: sum("pending"),
    remaining_total: sum("available") - sum("actual"),
    unplanned_total: items.filter((item) => item.unplanned).reduce((total, item) => total + item.actual, 0),
  };
}

function demoPlanningEvents() {
  const today = new Date().toISOString().slice(0, 10);
  const horizonDate = new Date(`${today}T00:00:00Z`);
  horizonDate.setUTCDate(horizonDate.getUTCDate() + 30);
  const horizon = horizonDate.toISOString().slice(0, 10);
  const events = [];
  const add = (title, dueDate, amount, kind, path, detail, sourceCollection, sourceId) => {
    if (!dueDate || dueDate > horizon) return;
    const id = `${kind}:${sourceCollection}:${sourceId}:${dueDate}:${title}`;
    events.push({ id, title, due_date: dueDate, amount: Number(amount) || 0, kind, path, detail, source_collection: sourceCollection, source_id: sourceId });
  };

  data.lending.forEach((item) => {
    const outstanding = Math.max(Number(item.amount || 0) - (item.repayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0);
    if (!outstanding) return;
    const borrowed = item.direction === "BORROWED";
    add(borrowed ? "Repay borrowing" : "Recover lending", item.due_date, outstanding, borrowed ? "BORROWING" : "LENDING", "/lending", item.counterparty || "Counterparty", "lendings", item.id);
  });
  data.loans.filter((item) => item.status !== "Closed").forEach((item) => {
    add("Loan EMI", item.next_due_date || item.due_date, item.emi, "LOAN", "/loans", item.name || item.lender || "Loan", "loans", item.id);
  });
  data.insurance.filter((item) => item.status !== "Lapsed").forEach((item) => {
    add("Renew insurance", item.renewal_date, item.premium, "INSURANCE", "/insurance", item.policy_name || "Policy", "insurance", item.id);
  });
  [
    [data.rentalPayments, "Collect rent", "/rental", "property_name", "rent_payments"],
    [data.farmRentPayments, "Collect farm lease", "/farms", "farm_name", "farm_rent_payments"],
  ].forEach(([payments, title, path, label, collection]) => {
    payments.filter((item) => ["PENDING", "PARTIAL"].includes(item.status)).forEach((item) => {
      const outstanding = Math.max(Number(item.amount_due || 0) - Number(item.amount_received || 0), 0);
      if (outstanding) add(title, item.due_date, outstanding, "RECEIVABLE", path, item[label] || item.tenant || "Collection", collection, item.id);
    });
  });
  data.goals.filter((item) => item.status !== "COMPLETED").forEach((item) => {
    const remaining = Math.max(Number(item.target_amount || 0) - Number(item.current_amount || 0), 0);
    if (remaining) add("Fund goal", item.target_date, remaining, "GOAL", "/goals", item.name || "Goal", "goals", item.id);
  });
  data.pfPpf.forEach((item) => {
    const dueDate = item.next_contribution_date || item.contribution_due_date;
    if (dueDate) {
      const kind = (item.kind || "fund").toUpperCase();
      add(`Contribute to ${kind}`, dueDate, item.expected_contribution, ["PPF", "SIP"].includes(kind) ? kind : "CONTRIBUTION", "/pf-ppf", item.institution || "Fund", "pf_ppf", item.id);
    }
  });
  data.notifications.filter((item) => item.kind === "CUSTOM_REMINDER" && item.status === "OPEN").forEach((item) => {
    add(item.title || "Reminder", item.due_date, item.amount, item.commitment_kind || "REMINDER", "/notifications", item.message || "", "notifications", item.id);
  });
  return events.sort((left, right) => left.due_date.localeCompare(right.due_date));
}

function isDemoActionVisible(item, today) {
  const state = demoPlanningActionStates.get(item.id);
  return state?.status !== "RESOLVED" && !(state?.status === "SNOOZED" && state.snoozed_until >= today);
}

function currentNetWorth() {
  const result = clone(netWorth);
  const total = (items, field) => items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  const bank = total(data.accounts.filter((item) => item.type !== "CASH"), "current_balance");
  const cash = total(data.accounts.filter((item) => item.type === "CASH"), "current_balance");
  const savingsValue = total(data.savings, "current_value");
  const pfPpfValue = total(data.pfPpf, "current_balance");
  const investmentValue = total(data.investments, "current_value");
  const assetValue = total(data.assets, "current_value");
  const lendingValue = data.lending.reduce((sum, item) => {
    const outstanding = Number(item.amount || 0) - (item.repayments || []).reduce((paid, payment) => paid + Number(payment.amount || 0), 0);
    return sum + (item.direction === "LENT" ? Math.max(outstanding, 0) : 0);
  }, 0);
  const borrowingValue = data.lending.reduce((sum, item) => {
    const outstanding = Number(item.amount || 0) - (item.repayments || []).reduce((paid, payment) => paid + Number(payment.amount || 0), 0);
    return sum + (item.direction === "BORROWED" ? Math.max(outstanding, 0) : 0);
  }, 0);
  const bankDelta = bank - initialDemoFinancials.bank;
  const cashDelta = cash - initialDemoFinancials.cash;
  const savingsDelta = savingsValue - initialDemoFinancials.savings;
  const pfPpfDelta = pfPpfValue - initialDemoFinancials.pfPpf;
  const investmentDelta = investmentValue - initialDemoFinancials.investments;
  const assetDelta = assetValue - initialDemoFinancials.assets;
  const lendingDelta = lendingValue - initialDemoFinancials.lending;
  const borrowingDelta = borrowingValue - initialDemoFinancials.borrowings;
  const loanDelta = total(data.loans, "outstanding") - initialDemoFinancials.loans;
  const otherLiabilityDelta = total(data.liabilities, "outstanding") - initialDemoFinancials.liabilities;
  const liabilityDelta = loanDelta + otherLiabilityDelta + borrowingDelta;
  const totalAssetDelta = bankDelta + cashDelta + savingsDelta + pfPpfDelta + investmentDelta + assetDelta + lendingDelta;

  result.total_assets += totalAssetDelta;
  result.total_liabilities += liabilityDelta;
  result.net_worth += totalAssetDelta - liabilityDelta;
  result.breakdown.bank += bankDelta;
  result.breakdown.cash += cashDelta;
  result.breakdown.savings += savingsDelta;
  result.breakdown.pf_ppf += pfPpfDelta;
  result.breakdown.investments += investmentDelta;
  result.breakdown.property += assetDelta;
  result.breakdown.receivables += lendingDelta;
  result.liability_breakdown.loans += loanDelta + otherLiabilityDelta;
  result.liability_breakdown.borrowings += borrowingDelta;
  result.allocation = result.allocation.map((item) => ({
    ...item,
    value: item.name === "Bank" ? item.value + bankDelta
      : item.name === "Cash" ? item.value + cashDelta
        : item.name === "Savings" ? item.value + savingsDelta
          : item.name === "PF/PPF" ? item.value + pfPpfDelta
            : item.name === "Investments" ? item.value + investmentDelta
              : item.name === "Property" ? item.value + assetDelta
                : item.name === "Receivables" ? item.value + lendingDelta
                  : item.value,
  }));
  return result;
}

function transactionSummary(type, groupField) {
  const rows = data.transactions.filter((item) =>
    item.type === type && !["PENDING", "VOID"].includes(item.transaction_status)
  );
  const grouped = new Map();
  const monthly = new Map();
  const year = new Date().getFullYear().toString();
  const month = monthKey();
  let yearTotal = 0;
  rows.forEach((item) => {
    const amount = Number(item.amount || 0);
    const group = item[groupField] || "Uncategorized";
    const key = item.date?.slice(0, 7);
    grouped.set(group, (grouped.get(group) || 0) + amount);
    if (key) monthly.set(key, (monthly.get(key) || 0) + amount);
    if (item.date?.slice(0, 4) === year) yearTotal += amount;
  });
  return {
    total: rows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    this_month: monthly.get(month) || 0,
    this_year: yearTotal,
    by_group: [...grouped].map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value),
    by_month: [...monthly].sort(([left], [right]) => left.localeCompare(right)).map(([monthKey, value]) => ({ month: monthKey, value })),
  };
}

function savingsSummary() {
  const byType = new Map();
  const contributions = new Map();
  data.savings.forEach((item) => {
    const type = item.type || "Other";
    byType.set(type, (byType.get(type) || 0) + Number(item.current_value || 0));
    (item.contributions || []).forEach((contribution) => {
      const month = contribution.date?.slice(0, 7);
      if (month) contributions.set(month, (contributions.get(month) || 0) + Number(contribution.amount || 0));
    });
  });
  return {
    total: data.savings.reduce((sum, item) => sum + Number(item.current_value || 0), 0),
    count: data.savings.length,
    by_type: [...byType].map(([name, value]) => ({ name, value })),
    contribution_trend: [...contributions].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({ month, value })),
  };
}

function pfPpfSummary() {
  const contributions = new Map();
  data.pfPpf.forEach((item) => (item.contributions || []).forEach((contribution) => {
    const month = contribution.date?.slice(0, 7);
    if (month) contributions.set(month, (contributions.get(month) || 0) + Number(contribution.amount || 0));
  }));
  const sum = (rows) => rows.reduce((total, item) => total + Number(item.current_balance || 0), 0);
  return {
    total: sum(data.pfPpf),
    pf: sum(data.pfPpf.filter((item) => item.kind === "PF")),
    ppf: sum(data.pfPpf.filter((item) => item.kind === "PPF")),
    count: data.pfPpf.length,
    contribution_trend: [...contributions].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({ month, value })),
  };
}

function loanSummary() {
  const total = (field) => data.loans.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  return {
    total_outstanding: total("outstanding"),
    total_sanctioned: total("sanctioned"),
    total_paid: data.loans.reduce((sum, item) => sum + Math.max(Number(item.disbursed || item.sanctioned || 0) - Number(item.outstanding || 0), 0), 0),
    monthly_emi: data.loans.reduce((sum, item) => sum + (item.status === "Closed" ? 0 : Number(item.emi || 0)), 0),
    count: data.loans.length,
  };
}

function insuranceSummary() {
  const annualMultiplier = { yearly: 1, "half-yearly": 2, quarterly: 4, monthly: 12 };
  const annualize = (item) => Number(item.premium || 0) * (annualMultiplier[String(item.frequency || "Yearly").toLowerCase()] || 1);
  const byType = new Map();
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const upcoming = [];
  data.insurance.forEach((item) => {
    const type = item.type || "Other";
    byType.set(type, (byType.get(type) || 0) + annualize(item));
    if (item.renewal_date) {
      const days = Math.floor((Date.parse(`${item.renewal_date.slice(0, 10)}T00:00:00Z`) - today.getTime()) / 86400000);
      if (Number.isFinite(days) && days <= 90) {
        upcoming.push({ id: item.id, policy_name: item.policy_name, type: item.type, renewal_date: item.renewal_date, days, premium: Number(item.premium || 0) });
      }
    }
  });
  return {
    total_annual_premium: data.insurance.reduce((sum, item) => sum + annualize(item), 0),
    total_cover: data.insurance.reduce((sum, item) => sum + Number(item.sum_insured || 0), 0),
    count: data.insurance.length,
    upcoming_renewals: upcoming.sort((left, right) => left.days - right.days),
    by_type: [...byType].map(([name, value]) => ({ name, value })),
  };
}

function rentalSummary() {
  const month = monthKey();
  const payments = data.rentalPayments;
  const currentMonth = payments.filter((item) => item.period === month);
  const collected = currentMonth.reduce((sum, item) => sum + Number(item.amount_received || 0), 0);
  const expected = currentMonth.reduce((sum, item) => sum + Number(item.amount_due || 0), 0);
  const trend = new Map();
  const byProperty = new Map();
  payments.forEach((item) => {
    const amount = Number(item.amount_received || 0);
    if (item.period) trend.set(item.period, (trend.get(item.period) || 0) + amount);
    if (amount > 0) {
      const property = item.property_name || "Unknown";
      byProperty.set(property, (byProperty.get(property) || 0) + amount);
    }
  });
  const outstanding = payments.reduce((sum, item) => sum + Math.max(Number(item.amount_due || 0) - Number(item.amount_received || 0), 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  return {
    monthly_rent: data.rentalProperties.reduce((sum, property) => sum + (property.units || []).filter((unit) => (unit.status || "OCCUPIED") === "OCCUPIED").reduce((units, unit) => units + Number(unit.monthly_rent || 0), 0), 0),
    collected,
    expected,
    outstanding,
    overdue: payments.filter((item) => item.due_date && item.due_date < today && item.status !== "COLLECTED")
      .reduce((sum, item) => sum + Math.max(Number(item.amount_due || 0) - Number(item.amount_received || 0), 0), 0),
    collection_rate: expected > 0 ? Math.round((collected / expected) * 10000) / 100 : 0,
    properties: data.rentalProperties.length,
    income_trend: [...trend].sort(([left], [right]) => left.localeCompare(right)).map(([month, value]) => ({ month, value })),
    by_property: [...byProperty].map(([name, value]) => ({ name, value })),
  };
}

function farmsSummary() {
  const transactions = data.transactions.filter((item) => item.scope === "FARM" && !["PENDING", "VOID"].includes(item.transaction_status));
  const perFarm = data.farms.map((farm) => {
    const rows = transactions.filter((item) => item.farm_id === farm.id);
    const income = rows.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const expense = rows.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { ...farm, income, expense, net: income - expense };
  });
  const monthly = new Map();
  transactions.forEach((item) => {
    const month = item.date?.slice(0, 7);
    if (!month) return;
    const row = monthly.get(month) || { month, in: 0, out: 0 };
    if (item.type === "INCOME") row.in += Number(item.amount || 0);
    if (item.type === "EXPENSE") row.out += Number(item.amount || 0);
    monthly.set(month, row);
  });
  const year = String(new Date().getFullYear());
  const annualPayments = data.farmRentPayments.filter((item) => item.period === year);
  const totalIncome = perFarm.reduce((sum, farm) => sum + farm.income, 0);
  const totalExpense = perFarm.reduce((sum, farm) => sum + farm.expense, 0);
  return {
    total_income: totalIncome,
    total_expense: totalExpense,
    net: totalIncome - totalExpense,
    count: data.farms.length,
    per_farm: perFarm,
    monthly: [...monthly].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value),
    annual_rent_due: annualPayments.reduce((sum, item) => sum + Number(item.amount_due || 0), 0),
    annual_rent_received: annualPayments.reduce((sum, item) => sum + Number(item.amount_received || 0), 0),
  };
}

function dashboardOverview() {
  const result = clone(staticResponses["/dashboard/overview"]);
  const wealth = currentNetWorth();
  Object.assign(result, {
    net_worth: wealth.net_worth,
    total_assets: wealth.total_assets,
    total_liabilities: wealth.total_liabilities,
    cash: wealth.breakdown.cash,
    bank: wealth.breakdown.bank,
    savings: wealth.breakdown.savings,
    pf_ppf: wealth.breakdown.pf_ppf,
    investments: wealth.breakdown.investments,
    allocation: wealth.allocation,
    lending_outstanding: wealth.breakdown.receivables,
    borrowing_outstanding: wealth.liability_breakdown.borrowings,
  });
  const rentalOutstanding = data.rentalPayments.reduce((sum, item) => sum + Math.max(Number(item.amount_due || 0) - Number(item.amount_received || 0), 0), 0);
  result.cash_position = {
    ...result.cash_position,
    available_now: wealth.breakdown.bank + wealth.breakdown.cash,
    expected_receivables: wealth.breakdown.receivables + rentalOutstanding,
    upcoming_obligations: wealth.liability_breakdown.borrowings,
  };
  const today = new Date().toISOString().slice(0, 10);
  const month = monthKey();
  const transactions = data.transactions.filter((item) => !["PENDING", "VOID"].includes(item.transaction_status));
  const thisMonth = transactions.filter((item) => item.date?.slice(0, 7) === month);
  result.month_income = thisMonth.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  result.month_expense = thisMonth.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  result.month_savings = result.month_income - result.month_expense;
  const monthly = new Map();
  transactions.forEach((item) => {
    const key = item.date?.slice(0, 7);
    if (!key) return;
    const row = monthly.get(key) || { month: key, in: 0, out: 0 };
    if (item.type === "INCOME") row.in += Number(item.amount || 0);
    if (item.type === "EXPENSE") row.out += Number(item.amount || 0);
    monthly.set(key, row);
  });
  result.cash_flow = allMonths.map((key) => {
    const row = monthly.get(key) || { in: 0, out: 0 };
    return { month: key, in: row.in, out: row.out, net: row.in - row.out };
  });
  const breakdown = (type, field) => {
    const grouped = new Map();
    thisMonth.filter((item) => item.type === type).forEach((item) => {
      const name = item[field] || "Other";
      grouped.set(name, (grouped.get(name) || 0) + Number(item.amount || 0));
    });
    return [...grouped].map(([name, value]) => ({ name, value })).sort((left, right) => right.value - left.value).slice(0, 8);
  };
  result.income_breakdown = breakdown("INCOME", "source");
  result.expense_breakdown = breakdown("EXPENSE", "category");
  result.recent_activity = data.transactions.slice().sort((left, right) => (right.date || "").localeCompare(left.date || "")).slice(0, 8);
  result.project_spend = transactions.filter((item) => item.type === "EXPENSE" && item.project_id)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  result.active_projects = data.projects.filter((item) => item.status === "ACTIVE").length;
  result.total_projects = data.projects.length;
  result.total_budget = data.projects.reduce((sum, item) => sum + Number(item.budget || 0), 0);
  const budgets = budgetOverview(monthKey()).items;
  const nextActions = [];

  budgets.forEach((item) => {
    if (item.unplanned) {
      if (item.actual > 0) nextActions.push({
        id: `budget-unplanned:${item.category}`,
        label: `Plan ${item.category} spending`,
        detail: `${item.actual} posted spending has no category plan yet`,
        value: item.actual,
        path: "/budgets",
        severity: "warning",
      });
    } else if (item.remaining < 0) {
      nextActions.push({
        id: `budget-over:${item.id || item.category}`,
        label: `${item.category} is over plan`,
        detail: `Posted spend exceeds available plan by ${Math.abs(item.remaining)}`,
        value: Math.abs(item.remaining),
        path: "/budgets",
        severity: "critical",
      });
    } else if (item.available > 0 && item.percent_used >= 80) {
      nextActions.push({
        id: `budget-near:${item.id || item.category}`,
        label: `${item.category} is nearing its plan`,
        detail: `${item.percent_used}% used · ${item.remaining} remains`,
        value: item.remaining,
        path: "/budgets",
        severity: "warning",
      });
    }
  });

  const pendingExpenses = data.transactions.filter((item) =>
    item.type === "EXPENSE" && item.transaction_status === "PENDING" && item.scope !== "PROJECT" && !item.project_id
  );
  if (pendingExpenses.length) nextActions.push({
    id: "pending-expenses",
    label: "Review pending expenses",
    detail: `${pendingExpenses.length} expense record(s) are pending and excluded from posted totals`,
    value: pendingExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    path: "/expenses",
    severity: "info",
  });

  const events = demoPlanningEvents();
  events.forEach((event) => {
    if (event.kind === "GOAL") {
      nextActions.push({
        id: `goal-due:${event.id}`,
        label: `Review goal: ${event.detail}`,
        detail: `Target date ${event.due_date} · ${event.amount} still to fund`,
        value: event.amount,
        path: "/goals",
        severity: event.due_date < today ? "warning" : "info",
        due_date: event.due_date,
        source_collection: event.source_collection,
        source_id: event.source_id,
      });
    } else if (!["LENDING", "RECEIVABLE"].includes(event.kind)) {
      nextActions.push({
        id: `commitment:${event.id}`,
        label: event.title,
        detail: `${event.detail} · due ${event.due_date}`,
        value: event.amount,
        path: event.path,
        severity: event.due_date < today ? "critical" : "warning",
        due_date: event.due_date,
        source_collection: event.source_collection,
        source_id: event.source_id,
      });
    }
  });

  const rank = { critical: 0, warning: 1, info: 2 };
  const cashOnHand = wealth.breakdown.bank + wealth.breakdown.cash;
  let projectedCash = cashOnHand;
  events.filter((event) => event.due_date >= today && ["BORROWING", "LOAN", "INSURANCE", "CONTRIBUTION", "TAX", "SIP", "PPF"].includes(event.kind))
    .forEach((event) => { projectedCash -= event.amount; });
  events.filter((event) => event.due_date >= today && ["LENDING", "RECEIVABLE"].includes(event.kind))
    .forEach((event) => { projectedCash += event.amount; });
  if (projectedCash < 0) nextActions.push({
    id: "cash-shortfall",
    label: "Projected cash may fall below zero",
    detail: "The dated 30-day outlook falls below zero; this is a forecast, not a posted balance.",
    value: projectedCash,
    path: "/planner",
    severity: "critical",
    due_date: events.find((event) => event.due_date >= today && event.amount > cashOnHand)?.due_date,
  });
  const visibleActions = nextActions
    .filter((item) => isDemoActionVisible(item, today))
    .sort((left, right) => rank[left.severity] - rank[right.severity]
      || (left.due_date || "9999-99-99").localeCompare(right.due_date || "9999-99-99")
      || left.label.localeCompare(right.label));
  const budgetAlerts = visibleActions.filter((item) => item.id.startsWith("budget-"));
  const pendingActions = visibleActions.filter((item) => item.id === "pending-expenses");
  const otherActions = visibleActions.filter((item) => !item.id.startsWith("budget-") && item.id !== "pending-expenses");
  result.budget_alerts = budgetAlerts.slice(0, 6);
  result.next_actions = [...budgetAlerts.slice(0, 3), ...pendingActions.slice(0, 1), ...otherActions].slice(0, 8);
  return result;
}

function planningOverview() {
  const result = clone(staticResponses["/planning/overview"]);
  const events = demoPlanningEvents();
  const today = new Date().toISOString().slice(0, 10);
  result.calendar = events;
  result.actions = events.filter((item) => isDemoActionVisible(item, today)).slice(0, 30);
  result.timeline = data.transactions.slice().sort((left, right) => right.date.localeCompare(left.date)).slice(0, 8);
  return result;
}

function pathAndQuery(config) {
  const raw = config.url || "/";
  const parsed = new URL(raw, "http://demo.local");
  return { path: parsed.pathname.replace(/^\/api/, ""), query: parsed.searchParams };
}

function listForPath(path) {
  if (path === "/accounts") return data.accounts;
  if (path === "/transactions") return data.transactions;
  if (path === "/family") return data.family;
  if (path === "/lending") return data.lending;
  if (path === "/savings") return data.savings;
  if (path === "/pf-ppf") return data.pfPpf;
  if (path === "/investments") return data.investments;
  if (path === "/assets") return data.assets;
  if (path === "/liabilities") return data.liabilities;
  if (path === "/loans") return data.loans.map(enrichLoan);
  if (path === "/insurance") return data.insurance;
  if (path === "/rental/properties") return data.rentalProperties;
  if (path === "/rental/payments" || path === "/rental/rent-payments") return data.rentalPayments;
  if (path === "/farms") return data.farms;
  if (path === "/farms/rent-payments") return data.farmRentPayments;
  if (path === "/projects") return data.projects;
  if (path === "/parties") return data.parties;
  if (path === "/documents") return data.documents;
  if (path === "/diary") return data.diary;
  if (path === "/goals") return data.goals;
  if (path === "/users") return data.users;
  if (path === "/notifications") return data.notifications;
  if (path === "/losses") return data.losses;
  if (path === "/necessities") return data.necessities;
  if (path === "/work-logs") return data.workLogs;
  return null;
}

function enrichLoan(loan) {
  const disbursed = Number(loan.disbursed || loan.sanctioned || 0);
  const principalPaid = Math.max(disbursed - Number(loan.outstanding || 0), 0);
  return { ...loan, principal_paid: principalPaid, progress: disbursed ? Math.round((principalPaid / disbursed) * 10000) / 100 : 0 };
}

function projectFinance(projectId) {
  const project = data.projects.find((item) => item.id === projectId);
  const rows = data.transactions.filter((item) => item.project_id === projectId);
  const spent = rows.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const received = rows.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const committed = data.parties.filter((item) => item.project_id === projectId).reduce((sum, item) => sum + Number(item.contract_value || 0), 0);
  const byCategory = {};
  const byParty = {};
  const byMonth = {};
  rows.forEach((item) => {
    const month = (item.date || "").slice(0, 7);
    if (item.type === "EXPENSE") {
      const amount = Number(item.amount || 0);
      const category = item.category || "Miscellaneous";
      const party = item.party || "Direct";
      byCategory[category] = (byCategory[category] || 0) + amount;
      byParty[party] = (byParty[party] || 0) + amount;
      if (month) {
        byMonth[month] = byMonth[month] || { month, in: 0, out: 0 };
        byMonth[month].out += amount;
      }
    } else if (item.type === "INCOME" && month) {
      byMonth[month] = byMonth[month] || { month, in: 0, out: 0 };
      byMonth[month].in += Number(item.amount || 0);
    }
  });
  const budget = Number(project?.budget || 0);
  return {
    budget,
    received,
    spent,
    committed,
    outstanding: Math.max(committed - spent, 0),
    available: received - spent,
    remaining_budget: budget - spent,
    variance: budget - spent,
    utilization: budget > 0 ? Math.round((spent / budget) * 10000) / 100 : 0,
    cost_by_category: Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    cost_by_party: Object.entries(byParty).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    monthly: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

function enrichProject(project) {
  const finance = projectFinance(project.id);
  return { ...project, spent: finance.spent, received: finance.received, remaining: finance.remaining_budget };
}

function enrichParty(party) {
  const paid = data.transactions
    .filter((item) => item.project_id === party.project_id && item.type === "EXPENSE" && item.party === party.name)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return { ...party, paid, outstanding: Number(party.contract_value || 0) - paid };
}

function responseForGet(path, query) {
  if (path === "/sitewalkthrough/status") return { enabled: demoWalkthroughEnabled };
  if (path === "/dashboard/overview") return dashboardOverview();
  if (path === "/networth") return currentNetWorth();
  if (path === "/planning/overview") return planningOverview();
  if (path === "/income/summary") return transactionSummary("INCOME", "source");
  if (path === "/expenses/summary") return transactionSummary("EXPENSE", "category");
  if (path === "/savings/summary") return savingsSummary();
  if (path === "/pf-ppf/summary") return pfPpfSummary();
  if (path === "/loans/summary") return loanSummary();
  if (path === "/insurance/summary") return insuranceSummary();
  if (path === "/rental/summary") return rentalSummary();
  if (path === "/farms/summary") return farmsSummary();
  if (path === "/networth/history") return clone(netWorthHistory);
  if (path === "/recurring") return clone(recurringOverview());
  if (path === "/calendar") {
    const year = Number(query.get("year")) || new Date().getFullYear();
    const month = Number(query.get("month"));
    const day = query.get("day");
    const start = day || `${year}-${String(month || 1).padStart(2, "0")}-01`;
    const end = day || (month
      ? `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`
      : `${year}-12-31`);
    const validRows = data.transactions.filter((item) =>
      ["INCOME", "EXPENSE"].includes(item.type) && item.date >= start && item.date <= end
    );
    const totals = (items) => {
      const result = { income: 0, expense: 0, pending_income: 0, pending_expense: 0, transaction_count: 0, pending_count: 0 };
      items.forEach((item) => {
        if (item.transaction_status === "VOID") return;
        const pending = item.transaction_status === "PENDING";
        const key = `${pending ? "pending_" : ""}${item.type.toLowerCase()}`;
        result[key] += Number(item.amount || 0);
        result[pending ? "pending_count" : "transaction_count"] += 1;
      });
      result.net = result.income - result.expense;
      return result;
    };
    const commitments = [];
    data.loans.forEach((loan) => {
      if (!loan.next_due_date || !loan.emi || Number(loan.outstanding) <= 0 || loan.status === "Closed") return;
      const due = new Date(`${loan.next_due_date}T00:00:00`);
      if (Number.isNaN(due.getTime())) return;
      const through = new Date(`${end}T00:00:00`);
      const anchorDay = due.getDate();
      for (let offset = 0; ; offset += 1) {
        const lastDay = new Date(due.getFullYear(), due.getMonth() + offset + 1, 0).getDate();
        const cursor = new Date(due.getFullYear(), due.getMonth() + offset, Math.min(anchorDay, lastDay));
        if (cursor > through) break;
        const occurrence = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (occurrence >= start && occurrence <= end && occurrence >= new Date().toISOString().slice(0, 10)) {
          commitments.push({ id: `LOAN_EMI:${loan.id}:${occurrence}`, title: "Loan EMI", date: occurrence, amount: Number(loan.emi), kind: "LOAN_EMI", path: "/loans", detail: loan.name || loan.lender, source_id: loan.id, status: "SCHEDULED" });
        }
      }
    });
    demoRecurring.filter((item) => item.status === "active").forEach((item) => {
      const due = new Date(`${item.next_due_date}T00:00:00`);
      if (Number.isNaN(due.getTime())) return;
      const through = new Date(`${end}T00:00:00`);
      const anchorDay = due.getDate();
      let cursor = new Date(due);
      for (let count = 0; count < 2400 && cursor <= through; count += 1) {
        const occurrence = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (occurrence >= start && occurrence >= new Date().toISOString().slice(0, 10)) commitments.push({ id: `RECURRING_BILL:${item.id}:${occurrence}`, title: item.name, date: occurrence, amount: Number(item.amount), kind: "RECURRING_BILL", path: "/recurring", detail: item.category, source_id: item.id, status: "SCHEDULED" });
        const cadenceMonths = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[item.cadence];
        if (item.cadence === "WEEKLY") cursor.setDate(cursor.getDate() + 7);
        else {
          const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + cadenceMonths, 1);
          cursor = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(anchorDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()));
        }
      }
    });
    const monthRows = Array.from({ length: 12 }, (_, index) => {
      const key = `${year}-${String(index + 1).padStart(2, "0")}`;
      const txns = validRows.filter((item) => item.date.startsWith(key));
      const scheduled = commitments.filter((item) => item.date.startsWith(key));
      return { month: key, ...totals(txns), scheduled_total: scheduled.reduce((sum, item) => sum + item.amount, 0), scheduled_count: scheduled.length, days_with_activity: new Set(txns.filter((item) => item.transaction_status !== "PENDING" && item.transaction_status !== "VOID").map((item) => item.date)).size };
    });
    const selectedCommitments = commitments.filter((item) => item.date >= start && item.date <= end);
    const response = { view: day ? "day" : month ? "month" : "year", year, totals: totals(validRows), months: monthRows, commitments: selectedCommitments, scheduled_total: selectedCommitments.reduce((sum, item) => sum + item.amount, 0), scheduled_count: selectedCommitments.length };
    if (month) {
      const days = new Date(year, month, 0).getDate();
      response.month = `${year}-${String(month).padStart(2, "0")}`;
      response.days = Array.from({ length: days }, (_, index) => {
        const iso = `${response.month}-${String(index + 1).padStart(2, "0")}`;
        return { date: iso, ...totals(validRows.filter((item) => item.date === iso)), commitments: commitments.filter((item) => item.date === iso) };
      });
      response.commitments = selectedCommitments;
    }
    if (day) {
      response.date = day;
      response.transactions = clone(validRows.filter((item) => item.date === day));
      response.commitments = selectedCommitments.filter((item) => item.date === day);
    }
    return response;
  }
  if (path === "/data-quality") {
    const uncategorized = data.transactions.filter((item) =>
      ["INCOME", "EXPENSE"].includes(item.type) && item.transaction_status !== "VOID"
      && !(item.type === "EXPENSE" ? item.category : item.source)
    );
    return { generated_at: new Date().toISOString(), thresholds: { imported_balance_stale_days: 30, reconciliation_due_days: 90 }, counts: { stale_imported_balances: 0, reconciliation_due: 0, reconciliation_variances: 0, uncategorized_transactions: uncategorized.length, unassigned_transactions: 0 }, total_issues: uncategorized.length, findings: uncategorized.slice(0, 100).map((item) => ({ id: `uncategorized:${item.id}`, kind: "UNCATEGORIZED_TRANSACTION", severity: "LOW", title: `Uncategorized ${item.type.toLowerCase()}`, detail: `${item.date} · ${item.description || "Add a category or source."}`, path: item.type === "EXPENSE" ? "/expenses" : "/income", record_id: item.id, amount: item.amount })), truncated: uncategorized.length > 100 };
  }
  if (path === "/budgets") return budgetOverview(query.get("month") || monthKey());
  const reconciliationHistory = path.match(/^\/accounts\/([^/]+)\/reconciliations$/);
  if (reconciliationHistory) return clone(demoReconciliations.filter((item) => item.account_id === reconciliationHistory[1]));
  if (path === "/income/summary") return monthlySummary("INCOME", "source");
  if (path === "/expenses/summary") return monthlySummary("EXPENSE", "category");
  if (path === "/notifications") {
    const status = query.get("status") || "OPEN";
    const items = status === "ALL" ? data.notifications : data.notifications.filter((item) => item.status === status);
    return { count: items.length, items: clone(items) };
  }
  if (path === "/error-logs") return [];
  if (path === "/documents/link-options") return clone([
    ...data.accounts.map((item) => ({ id: item.id, type: "account", label: item.name })),
    ...data.projects.map((item) => ({ id: item.id, type: "project", label: item.name })),
    ...data.loans.map((item) => ({ id: item.id, type: "loan", label: item.name })),
  ]);
  if (path === "/losses") {
    const year = query.get("year");
    return clone(year ? data.losses.filter((item) => item.date.startsWith(`${year}-`)) : data.losses);
  }
  if (path === "/losses/summary") {
    const year = query.get("year");
    const rows = year ? data.losses.filter((item) => item.date.startsWith(`${year}-`)) : data.losses;
    const grouped = (key) => Object.entries(rows.reduce((totals, row) => {
      const name = row[key] || (key === "group" ? "Other" : "Other Loss");
      totals[name] = (totals[name] || 0) + Number(row.amount || 0);
      return totals;
    }, {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const periodTotals = rows.reduce((totals, row) => {
      const period = row.date.slice(0, year ? 7 : 4);
      totals[period] = (totals[period] || 0) + Number(row.amount || 0);
      return totals;
    }, {});
    return { total: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), count: rows.length, by_group: grouped("group"), by_category: grouped("category"), trend: Object.entries(periodTotals).map(([period, value]) => ({ period, value })).sort((a, b) => a.period.localeCompare(b.period)) };
  }
  if (staticResponses[`${path}?${query.toString()}`]) return clone(staticResponses[`${path}?${query.toString()}`]);
  if (staticResponses[path]) return clone(staticResponses[path]);
  if (path === "/dashboard/cashflow") {
    const period = query.get("period") || "monthly";
    let series = cashFlowSeries;
    if (period === "quarterly") {
      const grouped = {};
      series.forEach((item) => {
        const [year, month] = item.period.split("-").map(Number);
        const key = `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
        grouped[key] = grouped[key] || { period: key, in: 0, out: 0, net: 0 };
        grouped[key].in += item.in; grouped[key].out += item.out; grouped[key].net += item.net;
      });
      series = Object.values(grouped);
    } else if (period === "yearly") {
      const currentYear = String(new Date().getFullYear());
      series = [{ period: currentYear, in: 2980000, out: 2020000, net: 960000 }];
    }
    return { total_in: 2980000, total_out: 2020000, net: 960000, series: clone(series) };
  }
  if (path === "/transactions") {
    let rows = data.transactions;
    ["type", "scope", "project_id", "category", "account_id", "source", "farm_id"].forEach((key) => {
      const value = query.get(key);
      if (value) rows = rows.filter((item) => item[key] === value);
    });
    if (query.get("from")) rows = rows.filter((item) => item.date >= query.get("from"));
    if (query.get("to")) rows = rows.filter((item) => item.date <= query.get("to"));
    return clone(rows.slice().sort((a, b) => b.date.localeCompare(a.date)));
  }
  if (path === "/lending/summary") {
    const direction = query.get("direction") || "LENT";
    const rows = data.lending.filter((item) => item.direction === direction);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const recovered = rows.reduce((sum, row) => sum + (row.repayments || []).reduce((sub, payment) => sub + payment.amount, 0), 0);
    return { total, recovered, outstanding: total - recovered, overdue: direction === "LENT" ? 75000 : 0, due_this_month: direction === "LENT" ? 75000 : 45570, by_person: rows.map((row) => ({ name: row.counterparty, value: Math.max(0, row.amount - (row.repayments || []).reduce((sum, payment) => sum + payment.amount, 0)) })), recovery_trend: trend("month", 15000, 2500) };
  }
  if (path === "/lending") {
    const direction = query.get("direction");
    return clone(direction ? data.lending.filter((row) => row.direction === direction) : data.lending);
  }
  if (path === "/projects") return clone(data.projects.map(enrichProject));
  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = data.projects.find((item) => item.id === projectMatch[1]);
    return project ? clone(project) : {};
  }
  const financeMatch = path.match(/^\/projects\/([^/]+)\/finance$/);
  if (financeMatch) return clone(projectFinance(financeMatch[1]));
  if (path === "/parties") {
    const projectId = query.get("project_id");
    return clone((projectId ? data.parties.filter((party) => party.project_id === projectId) : data.parties).map(enrichParty));
  }
  if (path === "/planning/actions") return { items: [{ id: "action-review", title: "Review upcoming insurance renewal", description: "Check the renewal options before the end of the month.", status: "OPEN", priority: "MEDIUM" }] };
  if (path === "/search") {
    const q = (query.get("q") || "").trim().toLowerCase();
    if (q.length < 2) return { items: [] };
    const searchable = [
      ...data.projects.map((item) => ({ item, group: "PROJECTS", path: `/projects/${item.id}`, fields: ["name", "location", "description"] })),
      ...data.accounts.map((item) => ({ item, group: "ACCOUNTS", path: "/accounts", fields: ["name", "bank_name", "masked_number"] })),
      ...data.transactions.map((item) => ({ item, group: "TRANSACTIONS", path: "/cash-flow", fields: ["title", "description", "category", "source", "party"] })),
      ...data.lending.map((item) => ({ item, group: "LENDING", path: "/lending", fields: ["counterparty", "purpose", "notes"] })),
      ...data.investments.map((item) => ({ item, group: "INVESTMENTS", path: "/savings", fields: ["name", "symbol", "type"] })),
      ...data.loans.map((item) => ({ item, group: "LOANS", path: "/loans", fields: ["name", "lender", "type"] })),
      ...data.insurance.map((item) => ({ item, group: "INSURANCE", path: "/insurance", fields: ["policy_name", "provider", "insurer"] })),
      ...data.goals.map((item) => ({ item, group: "GOALS", path: "/goals", fields: ["name", "description"] })),
      ...data.family.map((item) => ({ item, group: "PEOPLE", path: "/family", fields: ["name", "relation"] })),
      ...data.parties.map((item) => ({ item, group: "CONTRACTORS & PARTIES", path: "/projects", fields: ["name", "party_type", "scope"] })),
    ];
    const items = searchable.filter(({ item, fields }) => fields.some((field) => String(item[field] || "").toLowerCase().includes(q))).slice(0, 8).map(({ item, group, path }) => ({
      group,
      id: item.id,
      label: item.name || item.description || item.source || item.category || item.counterparty || item.policy_name || "Untitled",
      detail: item.type || item.category || item.party_type || item.date || "",
      path,
    }));
    return { items };
  }
  if (path === "/party-portal") return { project: projects[0], party: parties[1], work_logs: clone(workLogs), payments: [] };
  if (path === "/imports") return { items: [] };
  if (path === "/version-history") return clone(staticResponses["/version-history"]);
  if (path.startsWith("/error-logs")) return clone(staticResponses["/error-logs?scope=all"]);
  if (path === "/planning/inbox") return clone(staticResponses["/planning/inbox"]);
  if (path === "/planning/overview") return planningOverview();
  if (path === "/debt-payoff/plan") return { status: "not_found" };
  if (path === "/planning/ownership") return clone(staticResponses["/planning/ownership"]);
  if (path === "/networth/history") return clone(netWorthHistory);
  const list = listForPath(path);
  if (list) return clone(list);
  return {};
}

function transactionBalanceImpact(transaction) {
  if (!transaction || ["PENDING", "VOID"].includes(transaction.transaction_status)) return 0;
  const amount = Number(transaction.amount) || 0;
  if (transaction.type === "INCOME") return amount;
  if (transaction.type === "EXPENSE") return -amount;
  return 0;
}

function applyTransactionBalance(transaction, multiplier) {
  if (!transaction?.account_id) return;
  const account = data.accounts.find((item) => item.id === transaction.account_id);
  if (account) account.current_balance += transactionBalanceImpact(transaction) * multiplier;
}

function mutate(config, path, method) {
  const body = typeof config.data === "string" ? (() => { try { return JSON.parse(config.data); } catch (_) { return {}; } })() : (config.data || {});
  const planningAction = path.match(/^\/planning\/actions\/([^/]+)$/);
  if (method === "post" && planningAction) {
    const action = String(body.action || "resolve").toLowerCase();
    if (action === "record_payment") {
      const amount = Number(body.amount) || 0;
      const source = body.source_collection;
      const id = body.source_id;
      const collections = {
        lendings: data.lending,
        loans: data.loans,
        insurance: data.insurance,
        rent_payments: data.rentalPayments,
        farm_rent_payments: data.farmRentPayments,
      };
      const record = collections[source]?.find((item) => item.id === id);
      if (!record) throw new Error("Payment source record not found");
      let remaining;
      if (source === "lendings") {
        remaining = Math.max(Number(record.amount || 0) - (record.repayments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0), 0);
      } else if (source === "loans") {
        remaining = Number(record.outstanding || 0);
      } else if (source === "insurance") {
        remaining = Number(record.premium || 0);
      } else {
        remaining = Math.max(Number(record.amount_due || 0) - Number(record.amount_received || 0), 0);
      }
      if (amount <= 0) throw new Error("Enter a payment amount greater than zero");
      if (amount > remaining + 0.009) throw new Error(`Amount exceeds outstanding balance of ${remaining.toFixed(2)}`);
      const payment = { date: new Date().toISOString().slice(0, 10), amount, note: "Recorded from Action Center" };
      if (source === "lendings") record.repayments = [...(record.repayments || []), payment];
      else if (source === "loans") {
        record.outstanding = Math.max(0, Number(record.outstanding || 0) - amount);
        record.payments = [...(record.payments || []), payment];
        record.last_payment_date = payment.date;
      } else if (source === "insurance") {
        record.payments = [...(record.payments || []), payment];
        record.last_payment_date = payment.date;
      } else {
        record.amount_received = Number(record.amount_received || 0) + amount;
        record.status = record.amount_received >= Number(record.amount_due || 0) ? "COLLECTED" : "PARTIAL";
        record.receipts = [...(record.receipts || []), payment];
      }
    }
    const state = { status: action === "postpone" ? "SNOOZED" : "RESOLVED", snoozed_until: body.snoozed_until || null };
    demoPlanningActionStates.set(decodeURIComponent(planningAction[1]), state);
    return { status: state.status };
  }
  if (method === "post" && path === "/networth/snapshot") {
    const date = new Date().toISOString().slice(0, 10);
    const current = currentNetWorth();
    const snapshot = { date, net_worth: current.net_worth, assets: current.total_assets, liabilities: current.total_liabilities, source: "manual" };
    const existing = netWorthHistory.items.findIndex((item) => item.date === date);
    if (existing >= 0) netWorthHistory.items[existing] = snapshot;
    else netWorthHistory.items.push(snapshot);
    netWorthHistory.items.sort((left, right) => left.date.localeCompare(right.date));
    return { date, net_worth: snapshot.net_worth, total_assets: snapshot.assets, total_liabilities: snapshot.liabilities, source: snapshot.source };
  }
  if (method === "post" && path === "/debt-payoff/plan") {
    const loans = data.loans.filter((loan) => !["closed", "paid", "paid off", "paid_off"].includes(String(loan.status || "Open").trim().toLowerCase()));
    const startDate = body.start_date || new Date().toISOString().slice(0, 10);
    return {
      extra_monthly: Number(body.extra_monthly) || 0,
      currency: "INR",
      max_months: 1200,
      minimum_only: simulateDemoDebt(loans, 0, startDate, "minimum_only"),
      avalanche: simulateDemoDebt(loans, Number(body.extra_monthly) || 0, startDate, "avalanche"),
      snowball: simulateDemoDebt(loans, Number(body.extra_monthly) || 0, startDate, "snowball"),
    };
  }
  if (method === "post" && path === "/recurring") {
    const created = { id: `demo-recurring-${Date.now()}`, status: "active", last_used_date: null, price_history: [], ...body };
    demoRecurring.unshift(created);
    return clone(created);
  }
  const recurringPath = path.match(/^\/recurring\/([^/]+)(?:\/(status|record-payment))?$/);
  if (recurringPath && method === "put") {
    const schedule = demoRecurring.find((item) => item.id === recurringPath[1]);
    if (!schedule) return { status: "not_found" };
    if (Number(body.amount) !== Number(schedule.amount)) {
      schedule.price_history = [...(schedule.price_history || []), { from_amount: Number(schedule.amount), to_amount: Number(body.amount), change_type: Number(body.amount) > Number(schedule.amount) ? "increase" : "decrease", changed_on: new Date().toISOString().slice(0, 10) }];
    }
    Object.assign(schedule, body);
    return clone(schedule);
  }
  if (recurringPath && method === "patch" && recurringPath[2] === "status") {
    const schedule = demoRecurring.find((item) => item.id === recurringPath[1]);
    if (schedule) schedule.status = body.status;
    return clone(schedule || body);
  }
  if (recurringPath && method === "post" && recurringPath[2] === "record-payment") {
    const schedule = demoRecurring.find((item) => item.id === recurringPath[1]);
    if (!schedule) return { status: "not_found" };
    const transaction = { id: `demo-recurring-payment-${Date.now()}`, type: "EXPENSE", date: body.date, amount: Number(body.amount) || Number(schedule.amount), category: schedule.category, account_id: schedule.account_id, description: `${schedule.name} recurring payment`, transaction_status: "POSTED", record_source: "MANUAL", recurring_id: schedule.id, scope: "PERSONAL" };
    data.transactions.unshift(transaction);
    const account = data.accounts.find((item) => item.id === schedule.account_id);
    if (account) account.current_balance -= transaction.amount;
    schedule.last_used_date = body.date;
    const due = new Date(`${schedule.next_due_date}T00:00:00`);
    const anchor = due.getDate();
    const paid = new Date(`${body.date}T00:00:00`);
    for (let count = 0; due <= paid && count < 1200; count += 1) {
      if (schedule.cadence === "WEEKLY") due.setDate(due.getDate() + 7);
      else {
        const step = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 }[schedule.cadence] || 1;
        const next = new Date(due.getFullYear(), due.getMonth() + step, 1);
        due.setTime(new Date(next.getFullYear(), next.getMonth(), Math.min(anchor, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())).getTime());
      }
    }
    schedule.next_due_date = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
    return clone({ transaction, schedule });
  }
  if (method === "post" && path === "/budgets") {
    const category = String(body.category || "").trim();
    const categoryKey = category.toLocaleLowerCase();
    const index = demoBudgets.findIndex((item) => item.month === body.month && item.category_key === categoryKey);
    const plan = {
      ...(index >= 0 ? demoBudgets[index] : { id: `demo-budget-${Date.now()}` }),
      ...body,
      category,
      category_key: categoryKey,
      amount: Number(body.amount) || 0,
    };
    if (index >= 0) demoBudgets[index] = plan;
    else demoBudgets.push(plan);
    return budgetOverview(body.month);
  }
  const budgetMatch = path.match(/^\/budgets\/([^/]+)$/);
  if (method === "delete" && budgetMatch) {
    const index = demoBudgets.findIndex((item) => item.id === budgetMatch[1]);
    if (index < 0) return { status: "not_found" };
    demoBudgets.splice(index, 1);
    return { status: "deleted" };
  }
  const reconcileMatch = path.match(/^\/accounts\/([^/]+)\/reconcile$/);
  if (method === "post" && reconcileMatch) {
    const account = data.accounts.find((item) => item.id === reconcileMatch[1]);
    if (!account) return { status: "not_found" };
    const statementBalance = Number(body.statement_balance) || 0;
    const appBalance = Number(account.current_balance) || 0;
    const difference = Math.round((statementBalance - appBalance) * 100) / 100;
    const record = {
      id: `demo-reconciliation-${Date.now()}`,
      account_id: account.id,
      account_name: account.name,
      as_of_date: body.as_of_date,
      statement_balance: statementBalance,
      app_balance: appBalance,
      difference,
      status: Math.abs(difference) < 0.01 ? "MATCHED" : "VARIANCE",
      note: body.note || "",
      recorded_by: "demo.admin@nivara.app",
      created_at: new Date().toISOString(),
    };
    demoReconciliations.unshift(record);
    account.reconciliation_status = record.status;
    account.last_reconciled_at = record.created_at;
    return clone(record);
  }
  if (method === "put" && path === "/sitewalkthrough/status" && typeof body.enabled === "boolean") {
    demoWalkthroughEnabled = body.enabled;
    return { enabled: demoWalkthroughEnabled };
  }
  if (method === "post" && path === "/losses/unlock") return { token: "demo-loss-token", expires_in_hours: 8 };
  const subresource = path.match(/^\/lending\/([^/]+)\/repayment$/);
  if (method === "post" && subresource) {
    const entry = data.lending.find((item) => item.id === subresource[1]);
    if (entry) entry.repayments.push({ ...body, date: body.date || new Date().toISOString().slice(0, 10) });
    return clone(entry || body);
  }
  const pathWithoutId = path.replace(/\/[^/]+$/, "") || path;
  const routeToList = {
    "/rental/properties": data.rentalProperties, "/rental/payments": data.rentalPayments, "/rental/rent-payments": data.rentalPayments,
    "/farms/rent-payments": data.farmRentPayments, "/projects": data.projects, "/parties": data.parties,
    "/transactions": data.transactions, "/accounts": data.accounts, "/family": data.family, "/lending": data.lending,
    "/savings": data.savings, "/pf-ppf": data.pfPpf, "/investments": data.investments, "/assets": data.assets,
    "/liabilities": data.liabilities, "/loans": data.loans, "/insurance": data.insurance, "/farms": data.farms,
    "/documents": data.documents, "/diary": data.diary, "/goals": data.goals, "/losses": data.losses,
    "/necessities": data.necessities, "/users": data.users,
  };
  if (method === "post" && path === "/documents") {
    const created = { id: `demo-${Date.now()}`, ...body, filename: body.name || "Demo document.pdf", category: body.category || "Other", created_at: new Date().toISOString(), size: 0, official: true };
    data.documents.unshift(created);
    return clone(created);
  }
  if (method === "post" && path === "/diary") {
    const created = { id: `demo-${Date.now()}`, date: new Date().toISOString().slice(0, 10), ...body };
    data.diary.unshift(created);
    return clone(created);
  }
  if (method === "post" && path.endsWith("/acknowledge")) {
    const itemId = path.split("/")[2];
    const item = data.notifications.find((notification) => notification.id === itemId);
    if (item) { item.status = "ACKNOWLEDGED"; item.acknowledged_at = new Date().toISOString(); }
    return { status: "acknowledged" };
  }
  const farmRentMatch = path.match(/^\/farms\/rent-payments\/([^/]+)\/receive$/);
  if (method === "post" && farmRentMatch) {
    const payment = data.farmRentPayments.find((item) => item.id === farmRentMatch[1]);
    if (payment) {
      payment.amount_received = Math.min(payment.amount_due, payment.amount_received + (Number(body.amount) || 0));
      payment.status = payment.amount_received >= payment.amount_due ? "COLLECTED" : "PARTIAL";
    }
    return clone(payment || body);
  }
  if (method === "post" && path === "/notifications/reminders") {
    const reminder = { id: `demo-${Date.now()}`, kind: "CUSTOM_REMINDER", status: "OPEN", amount: Number(body.amount) || 0, action: { label: "Review reminder", path: "/notifications" }, created_at: new Date().toISOString(), ...body };
    data.notifications.unshift(reminder);
    return { status: "created" };
  }
  if (method === "post" && path.endsWith("/review")) return { status: "reviewed" };
  if (method === "post" && (path.startsWith("/imports/") || path === "/imports/analyze" || path === "/proofs/extract")) return { id: `demo-${Date.now()}`, status: "ready", rows: [], items: [] };
  const list = routeToList[path] || routeToList[pathWithoutId];
  if (!list) return { status: "ok" };
  if (method === "post") {
    const created = {
      id: `demo-${Date.now()}`,
      ...body,
      ...(path === "/accounts" ? { current_balance: Number(body.opening_balance) || 0 } : {}),
    };
    if (path === "/transactions") {
      created.transaction_status = created.transaction_status || "POSTED";
      created.record_source = created.record_source || "MANUAL";
      applyTransactionBalance(created, 1);
    }
    list.unshift(created);
    return clone(created);
  }
  const rowId = path.slice(path.lastIndexOf("/") + 1);
  const index = list.findIndex((item) => item.id === rowId);
  if (method === "put" && index >= 0) {
    const previous = list[index];
    list[index] = { ...previous, ...body, id: rowId };
    if (pathWithoutId === "/transactions") {
      applyTransactionBalance(previous, -1);
      applyTransactionBalance(list[index], 1);
    }
    return clone(list[index]);
  }
  if (method === "delete" && index >= 0) {
    if (pathWithoutId === "/transactions") applyTransactionBalance(list[index], -1);
    list.splice(index, 1);
    return { status: "deleted" };
  }
  return method === "put" ? clone(body) : { status: "ok" };
}

export function isDemoMode() {
  return window.sessionStorage.getItem("nivara_demo_mode") === "true";
}

export function demoUser() {
  return { id: "nivara-demo-admin", name: "Nivara Demo Admin", email: "demo.admin@nivara.app", role: "ADMIN", demo: true };
}

export function demoAdapter(config) {
  const method = (config.method || "get").toLowerCase();
  const { path, query } = pathAndQuery(config);
  const response = method === "get" ? responseForGet(path, query) : mutate(config, path, method);
  return Promise.resolve({
    data: clone(response),
    status: 200,
    statusText: "OK",
    headers: {},
    config,
    request: null,
  });
}

export function resetDemoData() {
  window.location.reload();
}
