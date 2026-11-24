# Smart Ledger — Ganathe Finance

A lightweight, family-focused expense and money management Progressive Web App (PWA).

## Project principles
- Browser-first: HTML, CSS and vanilla JavaScript.
- PWA installability and responsive mobile/desktop UI.
- Family expense tracking, shared trips, budgets and reports.
- OneDrive personal Excel workbook is the Phase 1 data-store candidate.
- Keep storage behind a repository interface so a future database can replace Excel without rewriting business logic.
- AI is optional and must never be required for core financial calculations.

## Current status
**RBAC and trip workflow prototype.** The logical schema is at version 1.2. The preview includes a local-only Demo Admin / Demo Member identity switcher, explicit trip membership, trip-scoped roles, schema v1-to-v2 migration, a three-step Admin trip wizard and an Admin-only trip close action.

**Important:** the preview still stores data in this browser's localStorage. Its identity switcher and client-side permission checks are for functional testing only; they are not secure authentication or multi-user access. Do not enter real financial records. Persistent device sessions and production authorization require a trusted identity and data-access layer.

Before shared production storage, validate Microsoft personal OneDrive file download/upload, version conflict detection and concurrent edits. Microsoft Graph Excel workbook table APIs must not be assumed to work with consumer OneDrive.

## Repository layout
- `src/app` — app shell and routing
- `src/auth` — Microsoft sign-in
- `src/data` — storage interfaces and adapters
- `src/modules` — transactions, trips, budgets and reports
- `assets` — CSS, JavaScript and images
- `docs` — architecture, schema and test plan
- `database` — blank Excel database template

## Security
This repository contains application source and a blank schema template only. Never commit live financial data, passwords, OAuth secrets, access tokens or personal workbook copies. A public GitHub Pages deployment is publicly accessible; client-side role checks are not a security boundary.

## Local preview
Open `index.html` in a browser or serve the repository root with any static HTTP server.

## Deployment
GitHub Pages should publish from `main` / root after it is enabled under **Settings → Pages**. The app is not yet connected to OneDrive and must not be used for real financial records.
