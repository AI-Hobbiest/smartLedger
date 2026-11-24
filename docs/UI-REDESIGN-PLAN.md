# Smart Ledger — UI Redesign Direction

**Status:** UI-1, UI-2 and UI-3 merged; automated UI regression suite passed. UI-4 manual visual / device acceptance remains.  
**Reference review date:** 24 November 2026.

## 1. Product direction

Ganathe Finance / Smart Ledger is being refreshed as a **premium, expressive personal and family finance workspace**. The experience should feel like a contemporary fintech product, not a spreadsheet wrapper or a traditional expense register.

This is a distinct visual identity, not a clone of the three App Store references. Borrow the proven interaction ideas—fast capture, high information clarity, usable calendars, strong category insight and shared ledgers—while retaining Smart Ledger's conversational entry, household permissions and trip-scoped workflows.

The UI must work on iPhone, iPad and desktop. Mobile is the primary interaction target; tablet and desktop should use their additional space for richer information density and side-by-side analysis.

## 2. Reference synthesis

### Money Manager Expense & Budget — Realbyte
The App Store listing highlights fast daily entry, configurable categories, multiple accounts and currencies, weekly / monthly / annual statistics, calendar, budget comparisons, card management, payment profiles and backup / restore. It demonstrates the value of a broad, mature ledger toolkit and detailed review surfaces.

### Spending Tracker — Budget App — InnerGrow
The listing highlights budget cards, category and subcategory budgets, recurring transactions, subscription management, shared budgeting / ledger, AI-assisted import / voice / receipt capture, widgets, shortcuts, calendar and charts. Its more colourful category presentation demonstrates how visual coding can improve scanability.

### Expense Manager — Budget App — Pavans Group Techsoft
The supplied App Store ID currently resolves to Expense Manager - Budget App (also presented as Budget Buddy in the URL). Its listing highlights manual / voice / receipt entry, personal / business / travel accounts, shared accounts, recurring entries, offline and privacy options, and PDF / Excel exports. The App Store result shows only a few ratings; treat its listed feature concepts as inspiration, not proof of broad market adoption.

Reference links:
- [Money Manager Expense & Budget](https://apps.apple.com/in/app/money-manager-expense-budget/id560481810)
- [Spending Tracker - Budget App](https://apps.apple.com/in/app/spending-tracker-budget-app/id1525179720)
- [Expense Manager - Budget App](https://apps.apple.com/in/app/expense-manager-budget-app/id6744145641)

## 3. Smart Ledger differentiators to protect

1. Conversational transaction entry with explicit review before saving.
2. Household-level visibility plus trip-specific Organizer / Member permissions.
3. Distinguish who incurred a cost from who recorded it.
4. Trips as first-class shared workspaces with participant attribution and destination currency.
5. Personal finance must remain the everyday centre of the product; trip management should be powerful without overwhelming everyday use.
6. Currency integrity: until FX snapshots and conversion are implemented, never sum different currencies into a synthetic total or chart.

## 4. Signature visual identity

The first UI foundation was deliberately conservative, but the final direction is more distinctive:

- **Core mood:** editorial fintech, confident and warm, with a dramatic midnight-plum anchor.
- **Canvas:** warm parchment / stone (#F3EEE8) rather than stark white.
- **Primary ink:** deep aubergine (#252137, #262333).
- **Action accent:** ember coral (#F0785D) for add / action / expense focus.
- **Secondary palette:** lilac (#9B8BE8), amber (#E9B85B) and sky (#77A9CB) for categories, income and data series.
- **Surfaces:** warm near-white with subtle warm borders and restrained elevation.
- **Signature motif:** layered gradients and soft orbit / arc geometry, used sparingly around the monthly flow hero.
- **Navigation:** deep-plum desktop sidebar; matching deep-plum mobile bottom bar with a floating coral add action.
- **Typography:** system / Inter-style sans serif, with strong numeric hierarchy and editorial headlines.
- **Tone:** purposeful and optimistic, never childish or overly decorative.

No plain white-and-green palette as the product's primary identity. Green may appear only when semantically useful, not as the dominant brand colour.

## 5. Design principles

- **Clarity before decoration:** visual personality must not compete with amounts, dates, categories or permissions.
- **Progressive disclosure:** overview answers what happened, where it went and what needs attention. Detailed analysis lives in its own screen.
- **Fast capture:** chat-first entry remains prominent with quick add and a reliable manual alternative.
- **Currency integrity:** summaries and charts are grouped by currency. No fake conversion.
- **Role-aware UI:** preserve the central authorization checks and only render permitted edit / close actions.
- **Responsive hierarchy:** tap targets and one-column flows on phone; richer grids and persistent navigation on larger screens.
- **Accessible states:** contrast, visible keyboard focus, semantic labels and reduced-motion support.
- **Honest data state:** development-only / local-storage notice remains visible until trusted sign-in and shared storage are implemented.

## 6. Screen specifications and implementation

### Overview
- Four compact KPIs: monthly expense, income, net balance (kept separate by currency) and active trips.
- Signature dark monthly-flow hero with daily transaction-count pulse for the last 14 days.
- Conversational assistant and direct quick actions.
- Category breakdown grouped by currency.
- Recent transactions with clear routes to the full ledger.

### Transactions
- Filterable ledger with search, type, category and trip filters.
- Date-grouped rows, day-level totals and explicit income / expense styling.
- Visible totals and entry counts honour the selected identity and filters.
- Preserve row-level edit / delete permissions.
- Future interaction enhancement: calendar / list toggle, saved filters and full transaction detail sheet.

### Budgets
- Category cards with progress, spent, remaining / over-limit amount and clear threshold styling.
- Currency always visible.
- Summary counts for on-track, near-limit and over-limit budgets.
- Future enhancement: weekly / monthly / custom budget periods, combined category budgets and safe-to-spend.

### Trips
- Trip cards show dates, destination, currency, expense count, spend totals, active-member count and current user's trip role.
- Preserve Admin creation / closure controls and Organizer / Member permissions.
- Future enhancement: trip details workspace with participant balances, shared activity, settlement and export.

### Reports
- Daily / weekly / monthly / quarterly / annual / trip / custom periods.
- Summary totals by currency.
- Expense / income trend series drawn separately per currency.
- Category mix bars grouped by currency.
- CSV export remains scoped to the transactions visible to the current identity.
- Future enhancement: comparison periods, monthly recurring patterns, downloadable PDF / Excel reports.

## 7. Delivery phases

1. **UI-1 — Foundation (merged):** new app shell, responsive navigation, design tokens, separate destinations and initial overview.
2. **UI-2 — Screen refinement (implemented):** signature visual identity, data-rich overview, date-grouped transactions, budget cards, trip cards and report visualisation.
3. **UI-3 — Interaction polish (implemented):** mobile bottom-sheet forms, trip details, budget / report category drill-down, contextual success / error toasts, accessible focus and reduced-motion support. Calendar / period toggles and optional dark mode remain future enhancements.
4. **UI-4 — Quality and acceptance:** automated CI passed with 72 tests (including 14 UI-specific checks). Remaining manual sign-off: desktop, iPhone, iPad and Android rendering; VoiceOver / keyboard accessibility; PWA install and offline smoke tests.

## 8. Guardrails and deferred work

- This redesign does not change schema, business rules, authentication or data storage.
- Browser localStorage and the demo identity selector are not secure multi-user access. Do not enter real financial records.
- The current budget data model does not yet define personal vs household budget scope. This visual phase does not change that policy.
- FX rate capture / conversion is still deferred. Charts remain currency-specific until that work is implemented and verified.
- No full browser automation or live iPhone / iPad device test has been executed yet. CI tests protect the static UI structure and JavaScript workflows; visual acceptance still needs a human smoke test on deployed Pages.
