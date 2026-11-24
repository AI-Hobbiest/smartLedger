const test = require("node:test");
const assert = require("node:assert/strict");
const authz = require("../preview/assets/js/ledger-authz.js");
const repositoryModule = require("../preview/assets/js/ledger-repository.js");

const admin = { id: "A", householdRole: "HouseholdAdmin", status: "Active" };
const member = { id: "M", householdRole: "HouseholdMember", status: "Active" };
const outsider = { id: "O", householdRole: "HouseholdMember", status: "Active" };
const trips = [{ id: "T1", status: "Active" }, { id: "T2", status: "Active" }];
const memberships = [
  { id: "1", tripId: "T1", userId: "M", tripRole: "Member", membershipStatus: "Active" },
  { id: "2", tripId: "T1", userId: "O", tripRole: "Organizer", membershipStatus: "Active" }
];

test("only household admin can create and close trips", () => {
  assert.equal(authz.canCreateTrip(admin), true);
  assert.equal(authz.canCreateTrip(member), false);
  assert.equal(authz.canCloseTrip(admin, trips[0]), true);
  assert.equal(authz.canCloseTrip(member, trips[0]), false);
});

test("trip visibility is isolated by active membership", () => {
  assert.deepEqual(authz.visibleTrips(trips, member, memberships).map(item => item.id), ["T1"]);
  assert.deepEqual(authz.visibleTrips(trips, outsider, memberships).map(item => item.id), ["T1"]);
  assert.deepEqual(authz.visibleTrips(trips, admin, memberships).map(item => item.id), ["T1", "T2"]);
});

test("members see only their personal transactions and joined-trip transactions", () => {
  const rows = [
    { id: "P1", spentByUserId: "M", recordedByUserId: "M" },
    { id: "P2", spentByUserId: "O", recordedByUserId: "O" },
    { id: "T1-1", tripId: "T1", recordedByUserId: "O" },
    { id: "T2-1", tripId: "T2", recordedByUserId: "O" }
  ];
  assert.deepEqual(authz.visibleTransactions(rows, member, trips, memberships).map(item => item.id), ["P1", "T1-1"]);
  assert.equal(authz.canViewTransaction(admin, rows[3], trips, memberships), true);
});

test("organizer can edit all trip entries while member can edit only entries they recorded", () => {
  const memberEntry = { id: "E1", tripId: "T1", spentByUserId: "M", recordedByUserId: "M" };
  const otherEntry = { id: "E2", tripId: "T1", spentByUserId: "O", recordedByUserId: "O" };
  assert.equal(authz.canEditTransaction(member, memberEntry, trips, memberships), true);
  assert.equal(authz.canEditTransaction(member, otherEntry, trips, memberships), false);
  assert.equal(authz.canEditTransaction(outsider, otherEntry, trips, memberships), true);
  assert.equal(authz.canDeleteTransaction(member, otherEntry, trips, memberships), false);
});

test("closed trips are read-only, including for Admin", () => {
  const closed = { id: "T1", status: "Closed" };
  const row = { id: "E1", tripId: "T1", spentByUserId: "M", recordedByUserId: "M" };
  assert.equal(authz.canCloseTrip(admin, closed), false);
  assert.equal(authz.canCreateTransaction(admin, { tripId: "T1" }, [closed], memberships), false);
  assert.equal(authz.canEditTransaction(admin, row, [closed], memberships), false);
});

test("trip-only participants do not gain access without active trip membership", () => {
  const guest = { id: "G", householdRole: "TripOnly", status: "Active", isTripOnly: true };
  assert.equal(authz.canViewTrip(guest, trips[0], []), false);
  assert.equal(authz.canViewTransaction(guest, { tripId: "T1" }, trips, []), false);
});

test("schema v1 migration preserves rows and converts old names into trip-only memberships", async () => {
  const memory = new Map();
  const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
  memory.set("test-ledger", JSON.stringify({
    schemaVersion: 1,
    transactions: [{ id: "TX-1", date: "2026-01-01", amount: 25, type: "Expense" }],
    trips: [{ id: "TR-1", name: "Legacy trip", members: "Asha | Ravi" }],
    budgets: []
  }));
  const repo = repositoryModule.create({ key: "test-ledger", storage });
  const migrated = await repo.readSnapshot();
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.transactions.length, 1);
  assert.equal(migrated.transactions[0].recordedByUserId, "DEMO-ADMIN");
  assert.equal(migrated.trips[0].currency, "AED");
  assert.equal(migrated.tripMembers.length, 2);
  assert.equal(migrated.users.filter(user => user.isTripOnly).length, 2);
});
