# Smart Ledger V2 — feature-first architecture

## Product decision
Complete the personal finance application before integrating production storage. GitHub stores source code and automated tests only. Do not commit live transactions, credentials, tokens, encryption keys or real financial backups.

## Development storage
The current feature build uses a deliberately named local-development repository backed by browser localStorage. It requires no app login, no Microsoft tenant and no cloud connection. Data is scoped to the browser profile and device. This is suitable only for synthetic/test data and UI/functional development; it is not cross-device, synchronised, encrypted or suitable for real financial records.

The application consumes a repository contract (readSnapshot, transaction CRUD, trip CRUD, budget upsert/delete, backup import). Domain logic and UI must not read/write localStorage directly. Future providers will implement the same contract:
- Encrypted OneDrive flat-file vault (planned personal-release provider)
- Authenticated SaaS database/API (planned SaaS provider)

## Planned encrypted OneDrive vault
The intended personal-release vault is one encrypted JSON document in the user's OneDrive App Folder. Encryption is performed client-side before upload (AES-256-GCM with a passphrase-derived key); the application never stores the master passphrase in the vault or source repository. The file format must be versioned and portable so the same decrypted domain snapshot can later be imported into a SaaS database.

OneDrive authentication is intentionally deferred. Do not require users to create a personal Entra directory or add payment details for development. When the provider is implemented, evaluate the supported Microsoft OAuth/app-registration routes and least-privilege permissions; do not claim that encryption removes the need for cloud authorisation.

## Finance domain
- Transactions are positive amounts; type distinguishes Expense and Income.
- Currency is retained per transaction. Do not add unlike currencies together without an explicit FX conversion rate.
- Trips are first-class records; a transaction links to a trip by trip ID, not trip name.
- Budgets are monthly category-and-currency limits.
- Reports preserve currency separation and can filter by date range or trip.
- A future database migration should map the same versioned snapshot to normalised transaction, trip and budget tables.

## Feature MVP in progress
1. Dashboard: monthly expense, income, balance by currency and active trips.
2. Transactions: conversational draft/review, form create/edit, search, filters and delete.
3. Trips: create/edit/status, link spending, trip summary.
4. Budgets: monthly category/currency limit and usage tracking.
5. Reports: today, week, month, quarter, year, trip and custom date range; CSV export.
6. Backup: versioned JSON export/import for development/test data.

## Security and release gates
- The current browser repository is not secure storage. It is not an authenticated cloud database.
- Do not enter real financial information until the encrypted OneDrive vault or another audited production storage provider is deployed and tested.
- Before production: encryption round-trip tests, wrong-passphrase rejection, vault corruption recovery, multi-device conflict handling, backups/version history, import/export validation, browser compatibility and security review.
- Before SaaS: server-side authentication, tenant isolation, database access controls, audit logs, backups, retention/deletion policy and operational monitoring.
