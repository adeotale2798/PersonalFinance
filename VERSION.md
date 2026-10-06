# Nivara Finance release history

The application version source of truth is [backend/version_history.json](backend/version_history.json). The in-app **What's new** panel reads this same file through the API.

## 1.5.3 — 2026-10-06

- Workspace admins cannot promote users to finance owners; production startup validates secrets, CORS origins, and MongoDB TLS.

## 1.5.2 — 2026-09-20

- Immediate cache invalidation and background data revalidation; party deletion now removes its linked portal data.

## 1.5.1 — 2026-09-20

- New party and user login IDs automatically use last name, with numbered collision handling.

## 1.5.0 — 2026-09-20

- Private party portal, per-party documents, payment acknowledgement, and automatic party credentials.
- Collapsible sidebar and navigation groups; polished in-app party creation and payment entry.

## 1.4.0 — 2026-09-20

- Premium wealth-command-center UI/UX redesign, including the interactive net-worth canvas and financial detail drawers.
- Command-style global search and upgraded responsive table interactions.

## 1.3.0 — 2026-09-20

- Canonical financial records, traceable import runs and idempotent holding consolidation.
- Import Center review flow, cross-module search and recorded net-worth history.

## 1.2.0 — 2026-09-20

- Action Center workflows, Review Inbox, enhanced cash-risk and health checks.
- Household ownership views and exportable financial snapshot.
- Retirement, rental yield, SIP step-up and lending recovery calculators.
- Server-side financial-input validation.

## 1.1.0 — 2026-09-19

- Planner foundations: recurring commitments, ownership tags, document categories and basic calculators.
