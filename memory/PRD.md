# Nivara — Personal Financial Operating System & Project Command Center

## Original Problem
Full-fledged personal finance app (admin-first) with great UI/UX, highly interactive, mobile-ready.
Version control + env-based admin credentials + config. Admin grants granular access to parties
(architect, contractor A/B) per project/department. Separate finance views (e.g. Lending has its
own dashboard). Admin creates projects (construction, warehouse) and manages them. Personal lending,
savings/cash-in-hand, PF/PPF, family-member finances, rental revenue, and visual monitoring of money
in/out. Reference: `Nivara_Master_Product_Development_Prompt.md` (155 sections). Screenshots are
reference only. Credit-efficient: no unnecessary testing.

## Stack
- Frontend: React 18 (CRA + react-scripts), Tailwind, Recharts, lucide-react, react-router, axios
- Backend: FastAPI (modular routers) + Motor (MongoDB async)
- Auth: JWT (Bearer, localStorage) + bcrypt; admin seeded from backend .env; brute-force lockout
- Storage: Emergent object storage for document uploads
- Currency INR, timezone Asia/Kolkata

## Admin
- admin@nivara.app / Nivara@2026 (SUPER_ADMIN) — see /app/memory/test_credentials.md

## Implemented (2026-06)
- **Auth**: login/logout/me, JWT, admin bootstrap, brute-force protection
- **Overview dashboard**: net worth, cash+bank, monthly income/expense, lending/borrowing, savings,
  investments — all drill-down KPIs; cash-flow area chart; wealth allocation donut; income/expense
  breakdown; Attention Required (overdue lending, unpaid rent, borrowings, budget overrun); recent activity
- **Cash Flow**: monthly/quarterly/yearly money-in vs out
- **Accounts & Cash**: bank + cash accounts with live computed balances (from transactions)
- **Income / Expenses**: transactions by source/category, trends, full CRUD, project linking
- **Lending & Borrowing**: dedicated dashboard, per-person outstanding, recovery trend, repayments
- **Savings & Investments**: savings products (SAVINGS/FD/RD/CASH), investments w/ gain-loss
- **PF & PPF**: balances, contribution trend
- **Rental Income**: properties/units/tenants, rent collection, collection rate, trend by property
- **Net Worth**: assets vs liabilities, allocation donut, breakdown, assets/liabilities CRUD
- **Projects**: create/manage; per-project workspace (Overview/Finance/Parties/Documents) with
  budget vs spent, cost by category/party, monthly in/out, parties w/ paid+outstanding
- **Family Members**: CRUD
- **Access Control**: create users (PARTY_USER/PROJECT_ADMIN), granular per-project per-module
  permission matrix (none→view→edit→approve) for architect/contractor A/B etc.
- **Documents**: upload/list/download/delete via object storage (global + per-project)
- **Settings**: currency, timezone, configurable income/expense/project categories, payment methods
- Demo seed data (idempotent, only when empty) for instant visualizations
- Mobile-first: bottom nav + FAB quick-add (income/expense/lend/borrow), hamburger drawer

## Backend API (prefix /api)
auth, accounts, transactions, income/expenses summary, settings, lending (+repayment, summary),
savings/assets/liabilities/investments/pf-ppf (+summaries, networth), rental (properties/payments/summary),
projects (+finance), parties, family, users (+access-meta), audit, dashboard (overview/cashflow),
documents (upload/download).

## Notes
- Money stored as rounded floats (personal-scale); all aggregation is backend-authoritative.
- All API endpoints currently enforce admin-only. Party-user portals (login-scoped views honoring
  the stored permission grants) are a deferred slice.

## Wealth integrity and collaboration
- Net-worth totals are based on recorded balance-sheet positions and each position's ownership
  percentage. A negative bank/cash ledger is classified as a liability; a zero ownership share is
  respected. Ownership summaries and exported balance-sheet detail use the same positions.
- Manual values can record valuation source and date. Missing valuation provenance stays explicitly
  missing; record creation or edit dates are not presented as valuation dates.
- Rental properties, farms and projects may link to one canonical asset record. Their operating
  values are not added as a second balance-sheet position, and linked assets cannot be deleted until
  those links are removed.
- Investment activity supports dated contributions, sales, distributions and fees, plus a separate
  dated valuation history. The existing value-minus-recorded-cost figure is labeled an unrealized
  change, not an annualized or time-weighted return. No IRR/TWR is reported without complete,
  validated cash-flow and valuation data.
- Planning uses one normalized dated-commitment stream. Overdue commitments are treated as due
  today in forward projections, while posted transactions remain separate from forecasts.
- Household collaborators can view documents only when a workspace admin explicitly shares them.
  That access is read-only, auditable and revoked when the collaborator is deactivated, removed or
  changed to another role; unshared documents remain private.
- Transaction reconciliation records statement differences without silently changing ledger
  balances. Internal transfers remain transfers and do not count as income or expenses.

## Backlog / Next
- P1: Party-user login portals that enforce the permission grants (scoped project views)
- P1: Recurring transactions automation; budgets vs actual alerts
- P2: Bank statement import + reconciliation; contracts & work items; obligations/payment lifecycle
- P2: Reports & exports (CSV/PDF); notifications
- P3: AI intelligence; dashboard widget customization
