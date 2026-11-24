(function (root) {
  "use strict";
  const SCHEMA_VERSION = 2;
  const DEFAULT_KEY = "ganathe.smartledger.dev.v1";
  const clone = value => JSON.parse(JSON.stringify(value));
  const makeId = prefix => (prefix || "SL") + "-" +
    ((root.crypto && root.crypto.randomUUID) ? root.crypto.randomUUID() :
      Date.now().toString(36) + Math.random().toString(36).slice(2));
  function demoUsers() {
    return [
      { id: "DEMO-ADMIN", name: "Demo Admin", email: "", householdRole: "HouseholdAdmin", status: "Active", isTripOnly: false },
      { id: "DEMO-MEMBER", name: "Demo Household Member", email: "", householdRole: "HouseholdMember", status: "Active", isTripOnly: false }
    ];
  }
  function emptyData() {
    return { schemaVersion: SCHEMA_VERSION, transactions: [], trips: [], tripMembers: [], users: demoUsers(), budgets: [], updatedAt: new Date().toISOString() };
  }
  function normalizeTripMembers(trip, users, memberships) {
    const raw = String(trip.members || trip.legacyMembers || "");
    raw.split(/[|,\n]/).map(value => value.trim()).filter(Boolean).forEach(name => {
      let user = users.find(item => item.name.toLowerCase() === name.toLowerCase());
      if (!user) {
        user = { id: makeId("TRIP-ONLY"), name, email: "", householdRole: "TripOnly", status: "Active", isTripOnly: true };
        users.push(user);
      }
      if (!memberships.some(item => item.tripId === trip.id && item.userId === user.id)) {
        memberships.push({
          id: makeId("TM"), tripId: trip.id, userId: user.id, tripRole: "Member",
          membershipStatus: "Active", invitedByUserId: "DEMO-ADMIN", joinedAt: null, addedAt: new Date().toISOString()
        });
      }
    });
  }
  function migrateV1(data) {
    const users = demoUsers(), tripMembers = [];
    const trips = (data.trips || []).map(item => {
      const trip = { ...item, currency: item.currency || "AED" };
      normalizeTripMembers(trip, users, tripMembers);
      delete trip.members;
      return trip;
    });
    const transactions = (data.transactions || []).map(row => ({
      ...row, spentByUserId: row.spentByUserId || "DEMO-ADMIN", recordedByUserId: row.recordedByUserId || "DEMO-ADMIN"
    }));
    return {
      ...data, schemaVersion: SCHEMA_VERSION, transactions, trips, tripMembers, users,
      budgets: Array.isArray(data.budgets) ? data.budgets : [], updatedAt: new Date().toISOString()
    };
  }
  function normalizeV2(data) {
    const next = clone(data);
    next.schemaVersion = SCHEMA_VERSION;
    next.users = Array.isArray(next.users) ? next.users : demoUsers();
    next.tripMembers = Array.isArray(next.tripMembers) ? next.tripMembers : [];
    next.trips = (next.trips || []).map(trip => ({ ...trip, currency: trip.currency || "AED" }));
    next.transactions = (next.transactions || []).map(row => ({
      ...row, spentByUserId: row.spentByUserId || "DEMO-ADMIN", recordedByUserId: row.recordedByUserId || "DEMO-ADMIN"
    }));
    next.budgets = Array.isArray(next.budgets) ? next.budgets : [];
    if (!next.users.some(item => item.id === "DEMO-ADMIN")) next.users.unshift(demoUsers()[0]);
    if (!next.users.some(item => item.id === "DEMO-MEMBER")) next.users.push(demoUsers()[1]);
    next.updatedAt = next.updatedAt || new Date().toISOString();
    return next;
  }
  class LocalDevelopmentRepository {
    constructor(options) {
      const opts = options || {};
      this.key = opts.key || DEFAULT_KEY;
      this.storage = opts.storage || root.localStorage;
      if (!this.storage || typeof this.storage.getItem !== "function" || typeof this.storage.setItem !== "function") {
        throw new Error("Development storage is unavailable in this browser.");
      }
    }
    readAll() {
      let raw;
      try { raw = this.storage.getItem(this.key); }
      catch (error) { throw new Error("Could not read development data: " + error.message); }
      if (!raw) return emptyData();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { throw new Error("Saved development data is damaged. It has not been overwritten."); }
      if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.trips) || !Array.isArray(data.budgets)) {
        throw new Error("Saved development data has an unsupported format. It has not been overwritten.");
      }
      if (data.schemaVersion === 1) return this.write(migrateV1(data));
      if (data.schemaVersion !== SCHEMA_VERSION) throw new Error("Saved development data has an unsupported format. It has not been overwritten.");
      return normalizeV2(data);
    }
    write(data) {
      const next = normalizeV2({ ...data, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() });
      try { this.storage.setItem(this.key, JSON.stringify(next)); }
      catch (error) { throw new Error("Could not save development data. Browser storage may be full: " + error.message); }
      return clone(next);
    }
    async readSnapshot() { return clone(this.readAll()); }
    async createTransaction(row) {
      const data = this.readAll();
      if (data.transactions.some(item => item.id === row.id)) throw new Error("That transaction ID already exists.");
      data.transactions.push(clone(row));
      return this.write(data);
    }
    async updateTransaction(row) {
      const data = this.readAll();
      const index = data.transactions.findIndex(item => item.id === row.id);
      if (index < 0) throw new Error("Transaction not found. Refresh and try again.");
      data.transactions[index] = clone(row);
      return this.write(data);
    }
    async deleteTransaction(id) {
      const data = this.readAll();
      data.transactions = data.transactions.filter(item => item.id !== id);
      return this.write(data);
    }
    async createTrip(row, memberships, newUsers) {
      const data = this.readAll();
      if (data.trips.some(item => item.id === row.id)) throw new Error("That trip ID already exists.");
      (newUsers || []).forEach(user => { if (!data.users.some(item => item.id === user.id)) data.users.push(clone(user)); });
      data.trips.push(clone({ ...row, currency: row.currency || "AED" }));
      (memberships || []).forEach(member => {
        if (data.tripMembers.some(item => item.tripId === row.id && item.userId === member.userId)) throw new Error("A participant has been assigned to this trip more than once.");
        data.tripMembers.push(clone({ ...member, tripId: row.id }));
      });
      return this.write(data);
    }
    async updateTrip(row, memberships, newUsers) {
      const data = this.readAll();
      const index = data.trips.findIndex(item => item.id === row.id);
      if (index < 0) throw new Error("Trip not found. Refresh and try again.");
      data.trips[index] = clone({ ...row, currency: row.currency || "AED" });
      if (memberships !== undefined) {
        (newUsers || []).forEach(user => { if (!data.users.some(item => item.id === user.id)) data.users.push(clone(user)); });
        const selected = new Map(memberships.map(member => [member.userId, member]));
        const now = new Date().toISOString();
        const retained = [];
        data.tripMembers.forEach(existing => {
          if (existing.tripId !== row.id) { retained.push(existing); return; }
          const replacement = selected.get(existing.userId);
          if (replacement) {
            retained.push({ ...existing, ...clone(replacement), id: existing.id, membershipStatus: "Active", tripId: row.id });
            selected.delete(existing.userId);
          } else {
            retained.push({
              ...existing, membershipStatus: "Revoked", revokedAt: now,
              revokedByUserId: row.updatedByUserId || row.createdByUserId || ""
            });
          }
        });
        selected.forEach(member => retained.push(clone({ ...member, tripId: row.id })));
        const activeIds = new Set();
        retained.filter(item => item.tripId === row.id && item.membershipStatus === "Active").forEach(item => {
          if (activeIds.has(item.userId)) throw new Error("A participant has been assigned to this trip more than once.");
          activeIds.add(item.userId);
        });
        data.tripMembers = retained;
      }
      return this.write(data);
    }
    async deleteTrip() {
      throw new Error("Trips cannot be deleted. Close the trip instead so its history remains intact.");
    }
    async upsertBudget(row) {
      const data = this.readAll();
      const index = data.budgets.findIndex(item => item.id === row.id || (item.category === row.category && item.currency === row.currency));
      if (index < 0) data.budgets.push(clone(row));
      else data.budgets[index] = { ...data.budgets[index], ...clone(row), id: data.budgets[index].id };
      return this.write(data);
    }
    async deleteBudget(id) {
      const data = this.readAll();
      data.budgets = data.budgets.filter(item => item.id !== id);
      return this.write(data);
    }
    async importSnapshot(snapshot) {
      if (!snapshot || ![1, SCHEMA_VERSION].includes(snapshot.schemaVersion) ||
          !Array.isArray(snapshot.transactions) || !Array.isArray(snapshot.trips) || !Array.isArray(snapshot.budgets)) {
        throw new Error("This backup is not a supported Smart Ledger development backup.");
      }
      const current = this.readAll();
      const incoming = snapshot.schemaVersion === 1 ? migrateV1(snapshot) : normalizeV2(snapshot);
      const merge = (existing, rows) => {
        const map = new Map(existing.map(item => [item.id, item]));
        rows.forEach(item => {
          if (!item || typeof item.id !== "string" || !item.id) throw new Error("Backup contains a record without an ID.");
          map.set(item.id, clone(item));
        });
        return Array.from(map.values());
      };
      const memberships = new Map(current.tripMembers.map(item => [item.id, item]));
      incoming.tripMembers.forEach(item => memberships.set(item.id, clone(item)));
      return this.write({
        schemaVersion: SCHEMA_VERSION,
        transactions: merge(current.transactions, incoming.transactions),
        trips: merge(current.trips, incoming.trips),
        tripMembers: Array.from(memberships.values()),
        users: merge(current.users, incoming.users),
        budgets: merge(current.budgets, incoming.budgets)
      });
    }
    getInfo() { return { provider: "local-development", key: this.key, deviceScoped: true, realDataAllowed: false, schemaVersion: SCHEMA_VERSION }; }
  }
  root.GanatheLedgerRepository = {
    SCHEMA_VERSION, DEFAULT_KEY, demoUsers,
    create: options => new LocalDevelopmentRepository(options),
    LocalDevelopmentRepository
  };
  if (typeof module !== "undefined" && module.exports) module.exports = root.GanatheLedgerRepository;
})(typeof window !== "undefined" ? window : globalThis);
