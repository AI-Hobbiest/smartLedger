# Data layer

The app must depend on repository interfaces, not directly on Excel or Microsoft Graph.

Planned contracts:
- transactionRepository
- tripRepository
- budgetRepository
- userRepository
- settingsRepository

The Phase 1 OneDrive adapter is not implemented until the personal-account proof of concept passes. Do not assume Graph Excel workbook endpoints support consumer OneDrive.
