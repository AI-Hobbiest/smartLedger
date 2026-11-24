# Database Schema — v1.2

This is the current logical schema proposal for Smart Ledger. The local preview repository uses the same logical entities in JSON. It is a development-only adapter; it is not a secure shared database.

## Sheets / entities

### Transactions
TransactionID, Date, Type, Amount, Currency, FXRateToBase, BaseAmount, Category, Description, PaymentType, SpentByUserID, RecordedByUserID, TripID, Notes, CreatedAt, UpdatedAt

- SpentByUserID: household user or trip-only participant who incurred the expense / received the money.
- RecordedByUserID: authenticated user who entered the transaction.
- TripID: empty for personal transactions; otherwise references a trip.
- Trip transactions retain their original transaction currency and FX snapshot. A trip's default currency is a convenience for new entries and summaries, not an instruction to rewrite historical rows.

### Users
UserID, Name, Email, HouseholdRole, Status, IsTripOnly, CreatedAt, UpdatedAt

- Household roles: HouseholdAdmin, HouseholdMember.
- Trip-only participants have IsTripOnly = true and do not receive sign-in credentials or household-wide access.
- Status: Active, Suspended.

### Trips
TripID, TripName, Destination, StartDate, EndDate, Currency, CreatedByUserID, Status, ClosedByUserID, ClosedAt, CreatedAt, UpdatedAt

- Status: Planned, Active, Closed, Cancelled.
- Only Household Admin can create or close a trip.
- Closed/cancelled trips are read-only; they are retained for history and reporting. Trips are not deleted as a normal lifecycle operation.

### TripMembers
TripMemberID, TripID, UserID, TripRole, MembershipStatus, InvitedByUserID, JoinedAt, AddedAt

- Unique key: (TripID, UserID).
- Trip roles: Organizer, Member.
- Membership status: Invited, Active, Revoked.
- Organizer can edit trip details and manage all open-trip transactions, but cannot create/close trips or manage membership.
- Member can view shared trip activity, add transactions, and edit/delete only transactions they recorded.
- Revoked/invited memberships do not grant trip access.

### Budgets
BudgetID, Month, Scope, UserID, Category, BudgetAmount, CreatedAt, UpdatedAt

### Settings
SettingKey, SettingValue, Description

### Lists
Editable lookup lists for Categories, PaymentTypes, TransactionTypes, Currencies, HouseholdRoles, UserStatuses, TripStatuses, TripRoles and MembershipStatuses.

## Access rules

- Household Admin can view all household personal transactions and all trips.
- Household Member can view only personal transactions attributed to them and trips with an active membership.
- A trip-only participant is only an attribution identity; without a sign-in account and active membership it cannot access the app.
- A Trip Organizer can view the trip and edit all trip transactions while it is open.
- A Trip Member can view the trip and edit/delete only transactions they recorded.
- Household Admin alone creates/closes trips and manages trip membership.
- A user can hold different trip roles on different trips.

## Defaults and FX

- Household base currency: AED (configurable).
- Initial currencies: AED, INR, USD, OMR, SGD, EUR, GBP.
- Initial payment types: Cash, Debit Card, Credit Card, Bank Transfer, Digital Wallet, Other.
- Store a transaction-time FX snapshot. For base currency, rate is 1 and BaseAmount equals Amount. For foreign currency, BaseAmount equals Amount multiplied by FXRateToBase. Historical rows are not recalculated when market rates change.
