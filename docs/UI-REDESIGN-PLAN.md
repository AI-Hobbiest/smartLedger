# Smart Ledger — UI Redesign Direction

**Status:** Foundation implementation in progress  
**Reference reviewed:** Money Manager Expense & Budget by Realbyte Inc. (iOS App Store listing and published screenshots), reviewed 24 November 2026.

## Product direction

Refresh Ganathe Finance / Smart Ledger into a modern, mobile-first personal and family finance workspace. The design should feel at home on iPhone and iPad while remaining efficient on desktop. This is a product redesign, not a rebrand: preserve the Ganathe Finance / Smart Ledger identity, chat-first transaction capture, family visibility rules, trip-scoped roles and existing financial workflows.

## Benchmark observations

The Money Manager reference demonstrates several useful interaction patterns:

- High-visibility income, expense and balance summaries.
- Clear daily / calendar / monthly / summary navigation for transaction history.
- Visual category breakdowns rather than relying only on tables.
- Budget planning with progress against limits.
- Multiple currencies, with totals calculated in a selected currency.
- Quick entry and reusable payment profiles.

Reference links:
- Apple App Store (Malaysia): https://apps.apple.com/my/app/money-manager-expense-budget/id560481810
- Realbyte product site: https://realbyteapps.com/
- Realbyte iOS transaction-view update notes: https://help.realbyteapps.com/hc/en-us/articles/14603760564121-iOS-2-9-0-x-Update-February-2023

We should borrow the interaction clarity, not copy its visual identity or dense legacy layouts.

## Smart Ledger differentiators to preserve

1. Conversational transaction entry with explicit review before saving.
2. Family / household roles and trip-specific Organizer / Member access.
3. One record of who incurred an expense and who recorded it.
4. Trip-centric shared expenses and destination currency.
5. Personal finance remains usable outside trips; trip functionality must not dominate the everyday ledger.

## Design principles

- **Mobile first:** thumb-friendly controls, safe-area-aware bottom navigation, readable summaries and minimal typing.
- **Progressive disclosure:** overview stays calm; detailed filters, edits and exports live in their own views.
- **One visual language:** consistent spacing, rounded surfaces, typography, icon weight, status and amount styles.
- **Numbers first:** amounts remain readable and correctly separated by currency; never add mixed-currency values into a misleading total.
- **Fast capture:** keep chat-first entry prominent, with a direct quick-add action and manual form as a reliable alternative.
- **Role-aware:** do not reveal actions a role cannot perform; continue to use the central authorization layer.
- **Honest data state:** development/local-only status must remain visible until real authentication and shared storage exist.
- **Accessible motion and contrast:** keyboard-visible focus, semantic navigation, readable text and reduced-motion support.

## Navigation model

Desktop:
- Persistent left navigation: Overview, Transactions, Budgets, Trips, Reports.
- Sticky top bar: product identity, quick add, preview identity, data-state indicator and development backup actions.
- Content area changes by destination instead of presenting every module as one long dashboard.

Mobile:
- Fixed bottom navigation: Home, Activity, Add, Budgets, Trips, Reports.
- Sticky compact top bar with product mark and preview identity.
- Forms remain dialogs / sheets initially; a later pass can optimize them into native-feeling full-screen mobile flows.

## Screen architecture

### Overview
- Four compact KPIs: month expenses, month income, monthly net balance and active trips.
- Prominent conversational assistant.
- Quick actions for expense, income, trip and budget.
- Category breakdown grouped by currency.
- Recent activity with a clear route to the full ledger.

### Transactions
- Search and filters for type, category and trip.
- Clear income / expense distinction.
- Permission-aware edit and delete actions.
- Future enhancement: calendar and day-grouped views.

### Budgets
- Separate destination with visual progress indicators.
- Keep budget currency visible; avoid mixed-currency aggregates.

### Trips
- Separate destination with trip cards, status, currency and expense summary.
- Preserve the Admin trip wizard and role-based edit / close behavior.
- Future enhancement: trip detail workspace with member roster, balances and settlement.

### Reports
- Time-period shortcuts, custom date range, trip report and CSV export.
- Future enhancement: chart-first monthly trends, category drilldowns and printable reports.

## Visual system — initial tokens

- Canvas: soft neutral green-grey (#F5F7F5).
- Surfaces: white, subtle border and low-elevation shadow.
- Primary ink: deep forest (#182B25).
- Primary accent: finance green (#187B68).
- Secondary data colours: restrained blue, violet and warm amber; reserve red for warnings / overspend.
- Cards: 20px desktop radius, 15–17px on narrow mobile.
- Typography: native system / Inter-style sans-serif stack; strong numeric hierarchy.
- Use line icons and concise labels rather than emoji-only navigation.

## Delivery stages

1. **UI-1 — Foundation:** new app shell, responsive navigation, design tokens, overview dashboard, category breakdown and recent activity. Preserve existing data and action IDs.
2. **UI-2 — Screen refinement:** transactions, budgets, trips and reports layouts; dedicated details / empty states; role-specific states.
3. **UI-3 — Interaction polish:** mobile transaction sheet, trip details, calendar / period navigation, chart drill-down, loading / error / success feedback.
4. **UI-4 — Quality:** desktop, iPhone, iPad and Android responsive review; keyboard / accessibility; regression tests across all RBAC roles.

## Guardrails

- Do not alter schema, transaction calculations, RBAC semantics or storage in the visual foundation PR.
- No real financial data: this preview continues to use device-local storage and a demo identity selector.
- Visual changes must not weaken or bypass role checks.
- FX conversion is separate from chart styling; do not visually imply conversion where no FX snapshot exists.
