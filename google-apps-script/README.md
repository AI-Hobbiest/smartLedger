# Smart Ledger Google Apps Script setup

This folder contains the first central-storage backend for the Smart Ledger PWA.

## What this version provides
- Initialises the seven database tabs: Transactions, Users, Trips, TripMembers, Budgets, Settings and Lists.
- Uses a single owner-controlled Google Sheet.
- Provides login, expiring server-side sessions, snapshot reads, record upsert/delete and administrator-created household members.
- Keeps records as JSON payloads behind stable IDs so the PWA repository adapter can later move to PostgreSQL without changing the UI's domain model.
- Applies basic server-side access checks for personal transactions and active trip membership.

## Important status and limitations
This is an integration prototype, not a production financial system. Before real use, the API still needs a complete security review, stronger password hashing (PBKDF2 or equivalent), refresh/session revocation strategy, audit history, schema-level validation, backup/restore, concurrency and quota testing, and end-to-end tests. Apps Script Cache sessions can expire early. Do not put real financial records into this deployment yet.

The existing PWA still uses its local-development repository. This backend is not connected to the live UI until the remote repository adapter and sign-in screen are implemented and tested.

## One-time setup
1. Open the Google Sheet you created for Smart Ledger.
2. Choose **Extensions → Apps Script**.
3. Replace the contents of Code.gs with the contents of this repository's Code.gs file.
4. Save the project.
5. In the function selector, choose setupSmartLedger and click Run. Approve the requested Google Sheets permissions. This creates any missing tabs and stores the spreadsheet ID in Script Properties.
6. Choose setupInitialAdminPrompt and click Run. Enter your own username, a unique password of at least 12 characters, and display name in the prompts. Do not commit or share the password.
7. Deploy → New deployment → Web app:
   - Execute as: Me
   - Who has access: Anyone
8. Copy the /exec URL privately. Do not add it to GitHub or share it in chat.
9. For code changes later: Deploy → Manage deployments → Edit → New version → Deploy. Keep track of which deployment URL is configured in the app.

## API request format
All requests use POST JSON. Except login and health, send the session token returned by login.

- { "action": "login", "username": "...", "password": "..." }
- { "action": "health" }
- { "action": "snapshot", "token": "..." }
- { "action": "save", "token": "...", "collection": "Transactions", "record": { "id": "...", "...": "..." } }
- { "action": "delete", "token": "...", "collection": "Transactions", "id": "..." }
- { "action": "createUser", "token": "...", "user": { "username": "...", "password": "...", "name": "..." } }
- { "action": "logout", "token": "..." }

The response is JSON with success: true or success: false and an error message. Login sessions are currently held in Apps Script Cache for up to six hours and may expire sooner.

## Database layout
Each operational tab uses columns id, payload, updatedAt. The complete domain record is stored in the JSON payload. Settings and Lists use key, value, updatedAt. This keeps the backend schema flexible while preserving the existing PWA object model.