# Smart Ledger — Ganathe Finance

A lightweight personal finance PWA with a first-party conversational interface.

## Product principles
- One general personal-finance application. Trip mode is a core module, not a separate edition.
- One personal Microsoft account owns the data workbook.
- Conversation is a first-party interface; forms and clickable actions always remain available.
- Core financial calculations and commands do not depend on a hosted AI provider.
- Keep data access behind a repository boundary so a future database can replace Excel without rewriting business logic.
- Phase 1 data store: one personal OneDrive workbook, `GanatheFinance.xlsx`, with two simple sheets: `Transactions` and `Trips`.

## Current development
The `foundation-v2` branch introduces:
- Responsive dashboard and conversational UI.
- Deterministic local intent parser for basic expense entry and report shortcuts.
- Transaction and trip forms with confirmation before saving.
- OneDrive file adapter using MSAL and Microsoft Graph driveItem file-content operations.
- A single-owner workbook model that locates the file in the signed-in account's own OneDrive.
- A simple two-sheet workbook model and initial regression tests.

**OneDrive is not yet configured or end-to-end tested.** Add the Microsoft Entra SPA Client ID in `assets/js/config.js` and complete the proof-of-concept tests in `docs/ONEDRIVE-SETUP.md`. Until connected, the app clearly labels browser-only preview data as not synced. Do not use preview mode as the authoritative ledger.

## Workbook and multi-device writes
The app edits the XLSX file itself using SheetJS; it does not rely on Graph Excel workbook/range APIs. Existing-file mutations request an upload session using the last observed eTag and retry on a 412 conflict. This is optimistic conflict handling, not a proven transactional database. Sequential and near-simultaneous writes across two devices using the same account must pass explicit tests before the OneDrive mode is considered ready.

## Repository layout
- `assets/js` — app, provider-independent command helpers and storage adapter
- `assets/css` — responsive UI
- `docs` — architecture and setup/test guidance
- `tests` — regression tests
- `cloudflare` — legacy hosted-AI experiment; not required by V2

## Security
Never commit live financial records, passwords, OAuth secrets, access tokens or personal workbook copies. The Microsoft client ID is a public SPA identifier, not a secret. A public GitHub Pages deployment is publicly accessible. Delegated `Files.ReadWrite` grants broad access to the signed-in account's OneDrive files even though the app's logic targets one workbook.

## Local preview
Serve the repository root with any static HTTP server or GitHub Pages. Preview transactions remain in this browser's local storage until OneDrive is connected.
