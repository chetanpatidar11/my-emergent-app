# LotNeeti — Cross-UPI Multi-User IPO Apply & Fund Tracking Tool

## Original Problem Statement
"ipo apply tool for cross-upi multiple users". User has an existing product (LotNeeti, a private Django + Next.js + Postgres monorepo at github.com/chetanpatidar11/lotneeti-beta, branch codex/autopilot). That stack cannot run on this platform (locked to Vite React + FastAPI + MongoDB via supervisor), so the core flow was re-implemented in the native stack using the repo as the functional spec.

## Core Concept
Plan and track IPO applications across many family/friend demat accounts. Each UPI handle can fund max 5 applications and max ₹5,00,000 per IPO mandate. The planner auto-allocates one application per investor per IPO across available UPIs (prefers own UPI, else cross-funds from another investor's UPI with capacity), respecting bank balances. Users export an Excel to bulk-upload into their separate "IPO Premium" app to actually apply; fund tracking stays here.

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (motor), JWT auth in httpOnly cookie (+ Bearer fallback), bcrypt. Collections: users, investors, banks (embedded upis), ipos (seeded on startup), applications, plans.
- Frontend: Vite + React 19 + Tailwind v4, dark "tactical fintech" theme (Outfit/Inter/JetBrains Mono). Pages: Login, Dashboard, Investors, Banks & UPI, IPOs, Planner, Applications, Funds.
- Excel export via openpyxl, columns match repo's generic_csv/ExportRow template.

## User Personas
- Operator managing IPO applications for a family/friends pool of demat accounts.

## Implemented (2026-06)
- JWT register/login/logout/me; seeded admin (admin@lotneeti.com / admin123).
- Investors CRUD with primary demat (CDSL/NSDL, DP ID, Client ID), priority, category.
- Banks CRUD with balance adjust (ADD/REMOVE/SET) and multiple UPI handles per bank, each with a holder investor.
- 8 seeded IPOs (Open/Upcoming/Closed) with price band, lot size, GMP, dates.
- Cross-UPI planner: preview + commit; enforces 5-app/₹5L per UPI and bank available balance; cross-fund indicator; capacity/fund warnings; one application per investor per IPO (dedupe).
- Applications tracker with editable mandate/allotment status, delete, and Excel export (.xlsx) for IPO Premium bulk upload.
- Dashboard KPIs + Funds monitor with per-UPI usage gauges.
- Data isolated per user.

## Backlog / Remaining (P1/P2)
- P1: Import investors/banks from the AccountImportTemplate.xlsx (bulk upload).
- P1: Match the exact IPO Premium bulk-upload column template (awaiting user's sample).
- P2: Live IPO/GMP feed; multiple demat accounts per investor in UI; plan history view; allotment cost auto-deduction from balance.
- P2: Password reset, brute-force lockout, refresh tokens (auth hardening).

## Next Tasks
- Get the IPO Premium bulk-upload sample to finalize export columns.
- Add Excel import for accounts.
