# Database Schema — v1.1

The blank workbook is stored at `database/SmartLedger_DB_Template_v1.1.xlsx`.

## Sheets

### Transactions
`TransactionID, Date, Type, Amount, Currency, FXRateToBase, BaseAmount, Category, Description, PaymentType, SpentByUserID, RecordedByUserID, TripID, Notes, CreatedAt, UpdatedAt`

### Users
`UserID, Name, Email, Role, Status`

### Trips
`TripID, TripName, Destination, StartDate, EndDate, CreatedByUserID, Status`

### TripMembers
`TripMemberID, TripID, UserID`

### Budgets
`BudgetID, Month, Scope, UserID, Category, BudgetAmount, CreatedAt, UpdatedAt`

### Settings
`SettingKey, SettingValue, Description`

### Lists
Editable lookup lists for Categories, PaymentTypes, TransactionTypes, Currencies, UserRoles, UserStatuses, TripStatuses and BudgetScopes.

## Defaults
- Base currency: AED (configurable).
- Categories: Food/EatOut, Grocery, Apparel, Devotional, Travel, Misc/Others, Spiritual, Investments; income categories include Salary, Other Income and Refund.
- Payment types: Cash, Debit Card, Credit Card, Bank Transfer, Digital Wallet, Other.
- Initial currencies: AED, INR, USD, OMR, SGD, EUR, GBP.

## FX handling
Store a transaction-time FX snapshot. For base currency, rate is 1 and BaseAmount equals Amount. For foreign currency, BaseAmount equals Amount multiplied by FXRateToBase. Historical rows are not recalculated when market rates change.

## Entry attribution
SpentByUserID identifies who incurred the expense. RecordedByUserID identifies who entered it. They are equal for self-entry and differ for proxy entry.
