# OneDrive setup for Smart Ledger

Smart Ledger V2 uses one personal Microsoft account as the sole data owner. The workbook stays in that account's OneDrive root. Use the same Microsoft account on each device.

The browser application is a public SPA. Never create or place a client secret in GitHub Pages.

## Register the application
1. Open https://entra.microsoft.com/ and enter the Microsoft Entra tenant where you will register this app. A personal Outlook account may first need a one-time Entra directory/tenant created for app registration.
2. Go to App registrations → New registration.
3. Name it `Ganathe Smart Ledger`.
4. Under Supported account types, choose **Personal Microsoft accounts only**.
5. Under Authentication → Add a platform → Single-page application, register the exact GitHub Pages URL: `https://ai-hobbiest.github.io/smartLedger/`.
6. Copy the Application (client) ID into `assets/js/config.js`. Do not create a client secret.
7. Add Microsoft Graph delegated permission **Files.ReadWrite**. The app uses the MSAL account details for its display name and does not need the separate `User.Read` profile permission.

## Workbook behaviour
1. The workbook name is `GanatheFinance.xlsx`.
2. Sign in with the personal Microsoft account that owns the workbook.
3. The app looks for `GanatheFinance.xlsx` in that signed-in account's OneDrive root. It creates the workbook if it is not found.
4. Use that same Microsoft account on your iPhone, iPad and other devices. There is no shared-workbook configuration, family invitation or per-user access model in this release.

**Permission note:** delegated `Files.ReadWrite` allows the app to read, create, update and delete files in the signed-in account's OneDrive; it is not technically restricted to this one workbook. The app's code targets only `GanatheFinance.xlsx`, but the Microsoft permission itself is broader. Do not publish or reuse this app registration for unrelated users.

## First connection test
1. Sign in with the workbook-owning personal Microsoft account.
2. Confirm the two sheets exist: Transactions and Trips.
3. Add a clearly marked test transaction, reload the app and verify it persists.
4. Remove the test row from the app or workbook after the test.
5. Repeat the read/write test on a second device signed in to the same Microsoft account.

## Multi-device write limitation
The adapter uses an observed eTag when starting an upload session and retries supported append operations after a 412 version conflict. This is optimistic conflict handling, not a transactional database. Test sequential writes on two devices first, then test near-simultaneous writes and inspect the workbook/version history before relying on it for important records.

Until Microsoft sign-in and the read/write tests pass, browser preview mode is local-only and is not the authoritative ledger.
