(function (root) {
  "use strict";
  const SCHEMA_VERSION = 1;
  const DEFAULT_KEY = "ganathe.smartledger.dev.v1";
  const emptyData = () => ({ schemaVersion: SCHEMA_VERSION, transactions: [], trips: [], budgets: [], updatedAt: new Date().toISOString() });
  const clone = value => JSON.parse(JSON.stringify(value));

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
      if (!data || data.schemaVersion !== SCHEMA_VERSION ||
          !Array.isArray(data.transactions) || !Array.isArray(data.trips) || !Array.isArray(data.budgets)) {
        throw new Error("Saved development data has an unsupported format. It has not been overwritten.");
      }
      return clone(data);
    }

    write(data) {
      const next = { ...data, schemaVersion: SCHEMA_VERSION, updatedAt: new Date().toISOString() };
      try { this.storage.setItem(this.key, JSON.stringify(next)); }
      catch (error) { throw new Error("Could not save development data. Browser storage may be full: " + error.message); }
      return clone(next);
    }

    async readSnapshot() { return this.readAll(); }

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

    async createTrip(row) {
      const data = this.readAll();
      if (data.trips.some(item => item.id === row.id)) throw new Error("That trip ID already exists.");
      data.trips.push(clone(row));
      return this.write(data);
    }

    async updateTrip(row) {
      const data = this.readAll();
      const index = data.trips.findIndex(item => item.id === row.id);
      if (index < 0) throw new Error("Trip not found. Refresh and try again.");
      data.trips[index] = clone(row);
      return this.write(data);
    }

    async deleteTrip(id) {
      const data = this.readAll();
      data.trips = data.trips.filter(item => item.id !== id);
      data.transactions = data.transactions.map(item => item.tripId === id ? { ...item, tripId: "" } : item);
      return this.write(data);
    }

    async upsertBudget(row) {
      const data = this.readAll();
      const index = data.budgets.findIndex(item => item.id === row.id ||
        (item.category === row.category && item.currency === row.currency));
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
      if (!snapshot || snapshot.schemaVersion !== SCHEMA_VERSION ||
          !Array.isArray(snapshot.transactions) || !Array.isArray(snapshot.trips) || !Array.isArray(snapshot.budgets)) {
        throw new Error("This backup is not a supported Smart Ledger development backup.");
      }
      const current = this.readAll();
      const merge = (existing, incoming) => {
        const map = new Map(existing.map(item => [item.id, item]));
        incoming.forEach(item => {
          if (!item || typeof item.id !== "string" || !item.id) throw new Error("Backup contains a record without an ID.");
          map.set(item.id, clone(item));
        });
        return Array.from(map.values());
      };
      return this.write({
        schemaVersion: SCHEMA_VERSION,
        transactions: merge(current.transactions, snapshot.transactions),
        trips: merge(current.trips, snapshot.trips),
        budgets: merge(current.budgets, snapshot.budgets)
      });
    }

    getInfo() { return { provider: "local-development", key: this.key, deviceScoped: true, realDataAllowed: false }; }
  }

  root.GanatheLedgerRepository = { SCHEMA_VERSION, DEFAULT_KEY, create: options => new LocalDevelopmentRepository(options), LocalDevelopmentRepository };
  if (typeof module !== "undefined" && module.exports) module.exports = root.GanatheLedgerRepository;
})(typeof window !== "undefined" ? window : globalThis);