# OneDrive setup for Smart Ledger

This is a browser-only public client. Never create or place a client secret in GitHub Pages.

## 1. Register the application
1. Open Microsoft Entra admin center: https://entra.microsoft.com/
2. Go to App registrations → New registration.
3. Name: `Ganathe Smart Ledger`.
4. Supported account types: **Personal Microsoft accounts only** (or accounts in any organizational directory and personal Microsoft accounts if you later need work accounts).
5. Register the application.

## 2. Configure the SPA redirect
1. Open Authentication → Add a platform → Single-page application.
2. Add the exact GitHub Pages URL, for example:
   `https://ai-hobbiest.github.io/smartLedger/`
3. Do not enable implicit grant. MSAL uses authorization code flow with PKCE.
4. Copy the Application (client) ID.

## 3. Add delegated permissions
In API permissions, add Microsoft Graph delegated permissions:
- `User.Read`
- `Files.ReadWrite`

Do not create a client secret. The browser app uses delegated user sign-in.

## 4. Configure the application
Edit `assets/js/config.js` and set `microsoftClientId` to the Application (client) ID. This is a public identifier, not a secret. Keep authority set to `https://login.microsoftonline.com/consumers` for personal Microsoft accounts.

## 5. First connection test
1. Open the GitHub Pages app.
2. Select Connect OneDrive and sign in with the personal Microsoft account that owns the workbook.
3. If `GanatheFinance.xlsx` is not present in the OneDrive root, the app creates it with two simple sheets: Transactions and Trips.
4. Add a test transaction, reload the app, and verify that it remains.
5. Do not enter real family finances until this test and the concurrent-write checks pass.

## Data and concurrency notes
- The browser app reads file metadata and downloads the workbook's binary content.
- SheetJS processes the workbook; the Graph Excel workbook API is not used.
- Existing-file saves use a Graph upload session with the last observed eTag supplied as `If-Match`.
- A 412 response means another edit won the race; the app reloads and retries the transaction append.
- This is not yet a proven multi-writer transaction system for a shared personal OneDrive workbook. Run two-device tests before treating simultaneous writes as production-ready.
