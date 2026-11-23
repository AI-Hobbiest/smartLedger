# Smart Ledger — Ganathe Finance

A lightweight family finance PWA with a first-party conversational interface.

## Product principles
- One general application for personal/family finances. Trip mode is a core module, not a separate edition.
- Conversation is a first-party interface; forms and clickable actions always remain available.
- Core financial calculations and commands do not depend on hosted AI.
- Keep data access behind a repository boundary so a future database can replace Excel without rewriting business logic.
- Phase 1 data store: one personal OneDrive workbook, `GanatheFinance.xlsx`, with two simple sheets: `Transactions` and `Trips`.

## Current development
The `foundation-v2` branch introduces:
- Responsive dashboard and conversational UI.
- Deterministic local intent parser for basic expense entry and report shortcuts.
- Transaction and trip forms with confirmation before saving.
- OneDrive file adapter using MSAL and Microsoft Graph driveItem file-content operations.
- A simple two-sheet workbook model and initial regression tests.

**OneDrive is not yet configured.** Add the Microsoft Entra SPA Client ID in `assets/js/config.js` and complete the proof-of-concept tests in `docs/ONEDRIVE-SETUP.md`. Until connected, the app clearly labels browser-only preview data as not synced. Do not use preview mode as the authoritative family ledger.

## Workbook and concurrency
The app edits the XLSX file itself using SheetJS; it does not rely on Graph Excel workbook/range APIs. Existing-file mutations request an upload session using the last observed eTag and retry on a 412 conflict. This is optimistic conflict handling, not a proven transactional multi-device database. The shared-workbook path and real concurrent-write behaviour must pass explicit two-device tests before wider family use.

## Repository layout
- `assets/js` — app, provider-independent command helpers and storage adapter
- `assets/css` — responsive UI
- `docs` — architecture and setup/test guidance
- `tests` — regression tests
- `cloudflare` — legacy hosted-AI experiment; not required by V2

## Security
Never commit live financial records, passwords, OAuth secrets, access tokens or personal workbook copies. The Microsoft client ID is a public SPA identifier, not a secret. A public GitHub Pages deployment is publicly accessible; client-side role checks are not a security boundary.

## Local preview
Serve the repository root with any static HTTP server or GitHub Pages. Preview transactions remain in this browser's local storage until OneDrive is connected.
