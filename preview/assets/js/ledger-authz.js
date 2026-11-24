(function (root) {
  "use strict";
  const ACTIVE = "Active";
  const CLOSED = new Set(["Closed", "Cancelled"]);
  function isActiveUser(user) { return !!user && (user.status || ACTIVE) === ACTIVE; }
  function isAdmin(user) {
    return isActiveUser(user) && ["HouseholdAdmin", "Admin"].includes(user.householdRole || user.role);
  }
  function getMembership(user, trip, memberships) {
    if (!user || !trip) return null;
    return (memberships || []).find(item =>
      item.tripId === trip.id && item.userId === user.id &&
      (item.membershipStatus || ACTIVE) === ACTIVE
    ) || null;
  }
  function isTripOpen(trip) { return !!trip && !CLOSED.has(trip.status || "Planned"); }
  function canCreateTrip(user) { return isAdmin(user); }
  function canViewTrip(user, trip, memberships) { return isAdmin(user) || !!getMembership(user, trip, memberships); }
  function canEditTripDetails(user, trip, memberships) {
    if (!isTripOpen(trip)) return false;
    if (isAdmin(user)) return true;
    const membership = getMembership(user, trip, memberships);
    return !!membership && membership.tripRole === "Organizer";
  }
  function canManageTripMembers(user, trip) { return isAdmin(user) && isTripOpen(trip); }
  function canCloseTrip(user, trip) { return isAdmin(user) && isTripOpen(trip); }
  function canViewTransaction(user, transaction, trips, memberships) {
    if (!user || !transaction || !isActiveUser(user)) return false;
    if (transaction.tripId) {
      const trip = (trips || []).find(item => item.id === transaction.tripId);
      return canViewTrip(user, trip, memberships);
    }
    return isAdmin(user) || transaction.spentByUserId === user.id;
  }
  function canCreateTransaction(user, transaction, trips, memberships) {
    if (!user || !isActiveUser(user) || !transaction) return false;
    if (!transaction.tripId) return isAdmin(user) || transaction.spentByUserId === user.id;
    const trip = (trips || []).find(item => item.id === transaction.tripId);
    if (!isTripOpen(trip)) return false;
    if (isAdmin(user)) return true;
    if (!getMembership(user, trip, memberships)) return false;
    return !transaction.spentByUserId ||
      !!getMembership({ id: transaction.spentByUserId }, trip, memberships);
  }
  function canEditTransaction(user, transaction, trips, memberships) {
    if (!canViewTransaction(user, transaction, trips, memberships)) return false;
    if (!transaction.tripId) {
      return isAdmin(user) ||
        (transaction.spentByUserId === user.id && transaction.recordedByUserId === user.id);
    }
    const trip = (trips || []).find(item => item.id === transaction.tripId);
    if (!isTripOpen(trip)) return false;
    if (isAdmin(user)) return true;
    const membership = getMembership(user, trip, memberships);
    return !!membership && (membership.tripRole === "Organizer" || transaction.recordedByUserId === user.id);
  }
  function canDeleteTransaction(user, transaction, trips, memberships) {
    return canEditTransaction(user, transaction, trips, memberships);
  }
  function visibleTrips(trips, user, memberships) {
    return (trips || []).filter(trip => canViewTrip(user, trip, memberships));
  }
  function visibleTransactions(transactions, user, trips, memberships) {
    return (transactions || []).filter(row => canViewTransaction(user, row, trips, memberships));
  }
  root.GanatheLedgerAuthz = {
    isActiveUser, isAdmin, getMembership, isTripOpen, canCreateTrip, canViewTrip,
    canEditTripDetails, canManageTripMembers, canCloseTrip, canViewTransaction,
    canCreateTransaction, canEditTransaction, canDeleteTransaction, visibleTrips, visibleTransactions
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.GanatheLedgerAuthz;
})(typeof window !== "undefined" ? window : globalThis);
