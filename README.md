# PersonalFinance / Nivara

This project is a full-stack personal finance and project portfolio app.

- Backend: FastAPI + MongoDB (Motor)
- Frontend: React + CRA + Tailwind
- Default admin login is created automatically when the backend starts

## Project structure

- backend/: FastAPI app, MongoDB access, auth, routes, and seed data
- frontend/: React app for the dashboard UI
- memory/: product notes and sample credentials

## Prerequisites

Install these before running locally:

- Python 3.11+
- Node.js 18+
- npm
- MongoDB Community Edition locally, or a MongoDB Atlas cluster
- Git

## 1) Start MongoDB

If you are running MongoDB locally, make sure it is started.

Typical local MongoDB URL:

```bash
mongodb://localhost:27017
```

If you use MongoDB Atlas, replace the URL with your Atlas connection string.

## 2) Configure backend environment

From the repository root, open the backend folder:

```bash
cd backend
```

Create a file named `.env` in the `backend` directory with the following content:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=nivara
JWT_SECRET=replace-this-with-a-long-random-secret
CORS_ORIGINS=http://localhost:3000
ADMIN_EMAIL=admin@nivara.app
ADMIN_PASSWORD=Nivara@2026
ADMIN_NAME=Nivara Admin

# Optional but recommended for docs/uploads features:
# EMERGENT_LLM_KEY=your_key_here
```

Notes:

- The backend reads these values on startup.
- `MONGO_URL` and `JWT_SECRET` are required.
- `CORS_ORIGINS` must include the frontend URL you will run locally.
- The values above are for local development only. Do not reuse them in a deployed environment.

### Production configuration

Set `APP_ENV=production` in the deployment environment. Startup then rejects a short/default JWT signing secret, a missing or weak administrator password, wildcard or non-HTTPS CORS origins, and MongoDB connections without TLS. Use a unique JWT secret of at least 32 bytes, an administrator password of at least 16 characters, exact HTTPS frontend origins, and a TLS-enabled MongoDB connection. Store secrets in the deployment platform's secret manager rather than in source control.

## 3) Install backend dependencies

Create and activate a virtual environment:

PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
```

Install Python packages:

```bash
pip install -r requirements.txt
```

## 4) Run the backend

From the `backend` directory:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The API should become available at:

```text
http://localhost:8000
```

Health check:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{"status":"ok","service":"nivara-api","version":"0.1.0"}
```

## 5) Configure frontend environment

Open a second terminal and go to the frontend folder:

```bash
cd frontend
```

Create a `.env` file in the `frontend` folder:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

## 6) Install frontend dependencies

```bash
npm install
```

## 7) Run the frontend

```bash
npm start
```

The app should open at:

```text
http://localhost:3000
```

## Public walkthrough demo

Share `/sitewalkthrough` to let visitors explore a public, no-login product tour. From there, **Explore the live demo** opens the full application with illustrative sample data across its pages.

Visitors can try adding, editing, and deleting records. Demo API requests are handled in the browser and never sent to the database; sample data and any changes reset when the page is refreshed. The in-app demo banner makes this temporary mode visible and provides an exit back to the walkthrough.

The platform administrator can enable or disable the public walkthrough from **Access Control → Public site walkthrough**. When disabled, the public route shows a message asking visitors to contact their administrator.

## Budgets and balance reconciliation

The **Budgets & spending plans** screen stores one plan per category and month. Monthly plans track posted personal expenses; project expenses are excluded. Pending expenses are displayed separately and do not change account balances or posted budget totals. Sinking-fund plans may carry forward a prior month's positive remainder when rollover is enabled in both months. Saving a budget does not create or modify transactions.

Accounts show their recorded balance source and last ledger activity. Use **Reconcile** to compare the ledger balance with a statement balance for a chosen date. Comparisons are saved to the account audit history; a variance never changes the ledger automatically. Record any correction as a separately reviewed transaction.

## CGAS construction demands

Construction and renovation projects include a **CGAS** tab. Set the Type A bank/account reference, cumulative amount deposited into CGAS, and dates, then add only the stage names and demands you need. Update the deposited total whenever you make additional deposits. A demand can include multiple contractor bill details and related uploads such as invoices, CA/architect certificates, bank paperwork and payment/re-deposit proof. Update its bank status and record the actual withdrawal, utilized amount and any re-deposit; the screen calculates the amount still to account for and a 60-day utilization date guide.

This is a paperwork and utilization tracker: it does not send withdrawal instructions, create bank transfers, change account balances or post project expenses. Record paid construction costs separately under the project's **Finance** tab so the existing transaction ledger remains authoritative. CGAS forms and bank supporting-document requirements are not generated or asserted as universal by the app; submit using your bank's current requirements and confirm tax deadlines with your CA.

For Type A, paragraph 9(1) of the [Capital Gains Account Scheme, 1988](https://incometaxindia.gov.in/communications/notification/notification-161-2025.pdf) provides for Form C; paragraph 9(3) provides Form D details concerning utilization of the previous withdrawal when applying for a subsequent withdrawal. Bank instructions can add process-specific requirements; for example, [Bank of Baroda's CGAS page](https://bankofbaroda.bank.in/accounts/term-deposit/capital-gain-account-scheme) describes a 60-day utilization period. The app's date is a reminder guide, not tax or legal advice. The relevant tax provision and construction deadline depend on the transfer and applicable law.

## Household account sharing

Household collaborators use the separate `HOUSEHOLD_USER` role; it is not an admin role and does not grant access to other workspaces. Create or manage one from **Access Control**, then grant accounts from **Accounts & Cash → Manage access**. New household collaborators have no account access until explicitly granted. The API equivalents are `POST /api/users`, `POST /api/accounts/{account_id}/access` with `{"user_id":"...","access":"read"}` or `"use"`, `GET /api/accounts/{account_id}/access`, and `DELETE /api/accounts/{account_id}/access/{user_id}`. Grants and revocations are retained in workspace audit events. Existing `SUPER_ADMIN` and `PROJECT_ADMIN` account access is unchanged.

Accounts are private to collaborators by default: a `HOUSEHOLD_USER` sees no accounts until explicitly granted access. `read` permits account, linked transaction, reconciliation-history, and income/expense summary reads. `use` includes those reads and permits manual personal income, expense, transfer, and reconciliation writes, provided every linked account is granted `use`. The household UI is intentionally limited to granted accounts, daily spending, income, and expenses; projects, documents, imports, dashboards, and administration APIs remain unavailable to this role. Collaborators cannot permanently delete ledger entries; a permitted transaction can instead be marked void.

Limitations: grants are account-level, not field-level, and transaction edits/deletes apply to transactions associated with granted accounts. Transfers are visible only when both accounts are granted. Account names, balances, and approved transaction fields remain visible to collaborators with a grant. Grant/revocation audit events are scoped to the acting workspace; account-level revocation does not invalidate an already issued authentication token, but subsequent requests re-check current grants.

## 8) Log in

Default admin credentials created by the backend startup script:

- Email: `admin@nivara.app`
- Password: `Nivara@2026`

You can also use the demo party users seeded by the app if needed.

- Architect: `architect@nivara.app` / `Architect@2026`
- Contractor A: `contractor.a@nivara.app` / `Contractor@2026`

## 9) Useful notes

- The backend auto-seeds admin and demo data when the database is empty.
- The frontend stores the JWT in local storage and sends it as a bearer token.
- If you need to run the frontend against another backend, change `REACT_APP_BACKEND_URL` only.
- If you are using a different MongoDB database name, update `DB_NAME` in the backend `.env` file.

## Troubleshooting

### Backend fails with missing environment variables

Make sure your `.env` file is inside the `backend` folder and you are starting `uvicorn` from that folder.

### Frontend cannot reach the API

Check that:

- backend is running on port `8000`
- `REACT_APP_BACKEND_URL` is exactly `http://localhost:8000`
- CORS is enabled for `http://localhost:3000`

### MongoDB connection errors

Check that MongoDB is running and that your `MONGO_URL` is valid.

### Login fails

Confirm the database is reachable and the backend has started successfully. The admin user is created automatically on startup.

## Common run order

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate  
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

In a second terminal:

```bash
cd frontend
npm install
npm start
```

## Stop the app

- Stop the backend with `Ctrl + C` in the backend terminal.
- Stop the frontend with `Ctrl + C` in the frontend terminal.

If you want, I can also add a ready-to-use `.env.example` file for both the backend and frontend so setup is even easier.
