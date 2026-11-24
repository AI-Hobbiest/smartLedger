# Smart Ledger — Low-Level Design

## 1. Product scope

Ganathe Finance is a responsive, installable PWA for personal and family expense tracking. Modules include Dashboard, Transactions, Trips, Budgets, Reports and Settings. The main interaction is chat-first transaction capture with an explicit review before saving.

## 2. Architecture

- Presentation: semantic HTML, responsive CSS and vanilla JavaScript.
- Application: module-level use cases, validation and authorization checks.
- Domain: transaction, trip, membership, budget and reporting rules independent of storage and AI.
- Data access: repository interfaces with replaceable adapters.
- Authentication: Microsoft identity or another selected identity provider using browser-safe OAuth authorization-code flow with PKCE.
- Hosting: GitHub Pages static hosting for the public application shell only.
- Development storage: device-scoped localStorage prototype.
- Future shared storage: trusted API/data layer. OneDrive Excel remains a proof-of-concept option only until concurrency and recovery tests pass.

## 3. Core entities

- Transaction: records amount, currency, FX snapshot, spender, recorder and optional trip.
- User: household identity, household role and status; trip-only users are attribution-only records.
- Trip: destination, dates, default currency, creator, lifecycle and closure audit.
- TripMember: explicit user-to-trip membership, trip role and active/invited/revoked state.

## 4. RBAC model

### Household roles

- HouseholdAdmin: can view all household data, create and close trips, manage users/memberships and settings.
- HouseholdMember: can view their own personal transactions and only trips where they hold an active membership.

### Trip roles

- Organizer: can view a trip, edit trip details and view/edit/delete all trip transactions while the trip is open. Cannot create/close trips or manage trip membership.
- Member: can view shared trip activity, add trip transactions and edit/delete only transactions they recorded.

A user may be Organizer in one trip and Member in another. Trip membership is always scoped to one trip. A trip-only participant can be selected for expense attribution but does not receive a login or app access.

### Lifecycle

- Only Household Admin can create a trip.
- Only Household Admin can close a trip.
- Closing a trip sets it to Closed; the trip and its transactions remain available for permitted read-only reporting.
- Trips are not deleted as an ordinary lifecycle action.
- The trip default currency is used to prefill new entries; original transaction currency and FX snapshots remain unchanged.

## 5. Authorization enforcement

The preview contains a centralized permission module and identity switcher for functional demonstrations and automated tests. These browser checks are not a security boundary. Production must enforce the same policy in a trusted API/repository layer for every read, write, report and export. Do not ship shared household data in public JSON or static files.

## 6. Device session and native-app experience

- Sign in once per device; subsequent usage should use a persistent, revocable session.
- Renew sessions silently where supported by the provider and policy.
- Never save passwords or hand-roll long-lived browser tokens.
- Require authentication again after explicit sign-out, provider revocation/expiry or a security event.
- Account switching is explicit.
- Optional passkey/WebAuthn or platform biometric unlock may be used for re-authentication/app lock, not for every transaction.
- Exact token cache, refresh and session duration policies depend on the selected provider and must be security-reviewed.

## 7. Storage decision gate

Microsoft Graph Excel workbook APIs are not assumed compatible with consumer OneDrive. Validate file download, edit, upload, eTag/version conflict detection, simultaneous writes and recovery before implementing an adapter. Reject stale writes rather than silently overwriting newer data.

## 8. Delivery phases

A. Schema v1.2, migration, centralized authorization module and regression tests.
B. Admin-only trip wizard, user mapping, trip-only participants, currency and close lifecycle.
C. Apply authorization to all transaction/report/export surfaces.
D. Identity provider and persistent device sessions.
E. Trusted shared data layer and production security tests.
