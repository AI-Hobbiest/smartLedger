# OneDrive setup for Smart Ledger

The browser application is a public SPA. Never create or place a client secret in GitHub Pages.

## Register the application
1. Open https://entra.microsoft.com/ → App registrations → New registration.
2. Name it `Ganathe Smart Ledger`.
3. Choose personal Microsoft accounts only (or include work/school accounts if required).
4. Under Authentication → Add a platform → Single-page application, register the exact GitHub Pages URL: `https://ai-hobbiest.github.io/smartLedger/`.
5. Copy the Application (client) ID into `assets/js/config.js`. Do not create a client secret.
6. Add Microsoft Graph delegated permissions `User.Read` and `Files.ReadWrite`.

## Single shared workbook
1. The workbook name is `GanatheFinance.xlsx`.
2. The first owner account creates it in the root of its personal OneDrive (the app creates it if missing).
3. The owner shares that same workbook with family members, granting edit access only to intended participants.
4. After the owner first connects, retrieve the shared workbook reference with `smartLedgerWorkbookReference()` in the browser developer console. It returns the non-secret `driveId` and `itemId`.
5. Put those values in `workbookDriveId` and `workbookItemId` in `assets/js/config.js`, then deploy the updated public config. Each family member signs in with their own Microsoft account and accesses the same shared workbook by those IDs.

All members with edit permission can see the workbook's data. The app does not enforce private rows per member.

## First connection test
1. Sign in with the personal Microsoft account that owns the workbook.
2. Confirm the two simple sheets exist: Transactions and Trips.
3. Add a clearly marked test transaction, reload the app, and verify it persists.
4. Remove the test row from the app or workbook after the test.
5. Repeat using a second family Microsoft account after sharing the workbook.

## Concurrency test / limitation
Existing-file writes start a Graph upload session with the last observed eTag in `If-Match`. A 412 conflict triggers reload-and-retry for supported append operations. This is optimistic conflict handling, not a proven transactional multi-writer database. Test two devices saving near-simultaneously and inspect the final file/version history before using the shared workbook as the live trip ledger.

Until Microsoft sign-in and the read/write/concurrency tests pass, browser preview mode is local-only and is not the authoritative ledger.
