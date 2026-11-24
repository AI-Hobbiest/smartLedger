# Test Plan — Smart Ledger

## PWA and device experience
- [ ] GitHub Pages serves the app over HTTPS.
- [ ] App shell loads at desktop and mobile widths.
- [ ] Installable PWA shell and offline state are clear.
- [ ] Persistent device sign-in renews silently in supported production identity flow.
- [ ] Sign-out, revocation and account switching are tested.
- [ ] Biometrics/passkeys are optional and never requested per transaction.

## Schema and data
- [x] Schema v1 to v2 migration preserves transactions and converts legacy trip participant names to trip-only memberships.
- [ ] Base-currency transaction uses FX rate 1.
- [ ] Foreign-currency transaction stores immutable FX snapshot.
- [ ] Historical base amounts do not change when exchange rates move.
- [ ] Transaction spender and recorder remain distinct.

## Household and trip authorization
- [x] Only Household Admin can create and close trips.
- [x] Household Member cannot view an unrelated trip.
- [x] Household Member sees only own personal transactions plus active joined-trip transactions.
- [x] Organizer can edit all transactions in their open trip.
- [x] Member can edit/delete only transactions they recorded.
- [x] Closed trips are read-only, including for Admin.
- [x] Trip-only participant does not gain app access, even when linked to an active trip membership.
- [x] Trip expense attribution is restricted to current trip participants.
- [x] Transaction scope moves are re-authorized against the destination trip.
- [x] Revocation history is retained when the roster is edited repeatedly.
- [ ] Admin trip wizard maps existing users and adds trip-only participants.
- [ ] Membership revocation removes trip visibility.
- [ ] Reports, search, chat and exports apply the same visible-row filter.
- [ ] Every server operation enforces the policy; browser checks are not relied upon for security.

## Reports
- [ ] Daily, weekly, monthly and quarterly totals reconcile to transactions.
- [ ] Trip report reconciles to permitted trip-linked transactions.
- [ ] CSV/export output matches the permitted on-screen rows.

## OneDrive proof of concept (release gate)
- [ ] Personal account sign-in works.
- [ ] Workbook download/edit/upload preserve formatting and validation.
- [ ] eTag/version detects concurrent change.
- [ ] Stale updates rejected with reload/retry.
- [ ] Two-user concurrent edit creates no lost updates.
- [ ] Interrupted upload and recovery tested.
- [ ] No workbook data or tokens written to GitHub.
