# Smart Ledger — Low-Level Design (Initial)

## 1. Product scope
Ganathe Finance is a responsive, installable PWA for family expense tracking. Initial modules are Dashboard, Transactions, Trips, Budgets, Reports and Settings.

## 2. Architecture
- Presentation: semantic HTML, responsive CSS and vanilla JavaScript.
- Application: module-level use cases and validation.
- Domain: transaction, trip, budget and reporting rules; independent of storage and AI.
- Data access: repository interfaces with replaceable adapters.
- Authentication: Microsoft identity via browser-safe OAuth PKCE.
- Hosting: GitHub Pages static hosting.
- Phase 1 storage candidate: a blank Excel workbook in the user's personal OneDrive, accessed through file download/edit/upload only if concurrency and recovery tests pass.

## 3. Core modules
1. Dashboard — income, expense, category totals, budgets and recent activity.
2. Transactions — expense/income entry, edit, delete, search and filters.
3. Trips — create trips, members, shared trip costs and proxy entry.
4. Budgets — monthly family/member/category budgets and variance.
5. Reports — daily, weekly, monthly and quarterly views; trip reports; export.
6. Settings — categories, payment types, currencies, base currency and backup.

## 4. Domain rules
- Transaction amount is positive; Type determines expense or income.
- Base currency defaults to AED and is configurable.
- Base-currency transactions use FXRateToBase = 1.
- Foreign-currency transactions store the conversion rate snapshot used at entry; BaseAmount = Amount × FXRateToBase.
- Historical base amounts do not change when exchange rates later move.
- Self-entry uses the same SpentByUserID and RecordedByUserID; proxy entry stores them separately.
- Budgets are expressed in workbook base currency.
- A family head may view family transactions; members see their own and explicitly permitted shared-trip data.

## 5. Storage decision gate
Microsoft Graph Excel workbook APIs are not assumed compatible with consumer OneDrive. Validate download, edit, upload, eTag/version conflict detection, simultaneous writes and recovery before implementing the adapter. Reject stale writes rather than silently overwriting newer data. If reliability is insufficient, revisit the storage choice before building dependent UI.

## 6. Security and privacy
- Never commit live financial records, credentials, access tokens or real workbook copies.
- A public GitHub Pages app is public. Repository visibility does not make a deployed site private.
- Client-side role checks are not a security boundary.
- Do not store long-lived secrets in JavaScript or GitHub Pages.
- AI is optional and must not own core calculations or transaction persistence.

## 7. Delivery phases
A. Repository foundation and documentation.
B. OneDrive personal-account proof of concept.
C. Freeze storage adapter contract.
D. Build core modules and responsive PWA.
E. Family access, reports, regression and security testing.
