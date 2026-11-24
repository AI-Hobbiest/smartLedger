# Data layer

The app must depend on repository interfaces, not directly on Excel or Microsoft Graph.

Planned contracts:
- transactionRepository
- tripRepository
- budgetRepository
- userRepository
- settingsRepository

## Schema v1.2 additions

- users stores household accounts and trip-only participant records.
- tripMembers explicitly maps users to trips and carries trip-scoped roles and membership status.
- Trips carry a default currency, creator and closure audit fields.
- Transactions carry spentByUserId and recordedByUserId separately so ownership and data entry are not conflated.

The local preview repository migrates schema v1 records additively to v2 and retains transaction history. Legacy comma/pipe-separated participant names become trip-only user records linked to the corresponding trip. Legacy rows are attributed to the development Admin identity so they remain visible in the preview.

## Production gate

The current localStorage adapter is device-scoped and not multi-user storage. Client-side authorization is only a workflow demonstration. Before real shared data:
- implement identity-backed API/data access,
- enforce authorization server-side for every operation,
- test concurrent writes and conflict recovery,
- never expose household data through a public static data file.

The Phase 1 OneDrive adapter is not implemented until the personal-account proof of concept passes. Do not assume Graph Excel workbook endpoints support consumer OneDrive.
