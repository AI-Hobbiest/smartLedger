# Test Plan — Initial

## Repository and PWA
- [ ] GitHub Pages serves the app over HTTPS.
- [ ] App shell loads on desktop and mobile widths.
- [ ] Manifest is valid and install prompt is available where supported.
- [ ] Service worker installs, updates and serves cached shell.
- [ ] Offline state is clearly distinguished from synced state.

## Data and calculations
- [ ] Base-currency transaction uses FX rate 1.
- [ ] Foreign-currency transaction stores an immutable FX snapshot.
- [ ] BaseAmount calculation and rounding are tested.
- [ ] Income and expense totals are separated correctly.
- [ ] Budget period, scope and category calculations are correct.

## Family and trip workflows
- [ ] Self-entry attributes both user IDs to the same member.
- [ ] Proxy entry records spender and recorder separately.
- [ ] Trip member access is restricted to permitted records.
- [ ] Family-head visibility is tested independently from member visibility.

## OneDrive proof of concept (release gate)
- [ ] Microsoft personal account sign-in works.
- [ ] Workbook can be located and downloaded.
- [ ] Workbook can be edited and uploaded without corrupting formatting or validation.
- [ ] eTag/version check detects a concurrent change.
- [ ] Stale update is rejected and user can reload/retry.
- [ ] Two-user concurrent edit test produces no lost updates.
- [ ] Interrupted upload and recovery are tested.
- [ ] No workbook data or tokens are written to GitHub.

## Reports
- [ ] Daily, weekly, monthly and quarterly totals reconcile to transactions.
- [ ] Trip report reconciles to trip-linked transactions.
- [ ] Export output matches on-screen totals.
