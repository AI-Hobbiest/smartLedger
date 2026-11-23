const test = require("node:test");
const assert = require("node:assert/strict");
const repositoryModule = require("../assets/js/ledger-repository.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

test("starts with an empty development-only snapshot", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  const data = await repo.readSnapshot();
  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.transactions, []);
  assert.deepEqual(data.trips, []);
  assert.deepEqual(data.budgets, []);
  assert.equal(repo.getInfo().realDataAllowed, false);
});

test("creates, updates and deletes transactions", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  const row = { id: "TX-1", date: "2026-11-23", type: "Expense", amount: 50, currency: "AED" };
  await repo.createTransaction(row);
  await repo.updateTransaction({ ...row, amount: 55 });
  assert.equal((await repo.readSnapshot()).transactions[0].amount, 55);
  await repo.deleteTransaction("TX-1");
  assert.deepEqual((await repo.readSnapshot()).transactions, []);
});

test("trip deletion detaches linked transactions", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  await repo.createTrip({ id: "TR-1", name: "Test trip" });
  await repo.createTransaction({ id: "TX-1", tripId: "TR-1", type: "Expense" });
  await repo.deleteTrip("TR-1");
  const snapshot = await repo.readSnapshot();
  assert.equal(snapshot.trips.length, 0);
  assert.equal(snapshot.transactions[0].tripId, "");
});

test("upserts one budget per category and currency", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  await repo.upsertBudget({ id: "B-1", category: "Grocery", currency: "AED", amount: 500 });
  await repo.upsertBudget({ id: "B-2", category: "Grocery", currency: "AED", amount: 700 });
  const data = await repo.readSnapshot();
  assert.equal(data.budgets.length, 1);
  assert.equal(data.budgets[0].amount, 700);
});

test("imports supported backup data by merging unique record IDs", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  await repo.createTransaction({ id: "TX-1", amount: 10 });
  await repo.importSnapshot({ schemaVersion: 1, transactions: [{ id: "TX-2", amount: 20 }], trips: [{ id: "TR-1", name: "Imported trip" }], budgets: [] });
  const data = await repo.readSnapshot();
  assert.deepEqual(data.transactions.map(row => row.id).sort(), ["TX-1", "TX-2"]);
  assert.equal(data.trips.length, 1);
});

test("rejects invalid backup files without changing existing data", async () => {
  const repo = repositoryModule.create({ storage: memoryStorage(), key: "test" });
  await repo.createTransaction({ id: "TX-1", amount: 10 });
  await assert.rejects(() => repo.importSnapshot({ schemaVersion: 2, transactions: [], trips: [], budgets: [] }));
  assert.equal((await repo.readSnapshot()).transactions.length, 1);
});

test("does not silently overwrite corrupt saved data", async () => {
  const storage = memoryStorage();
  storage.setItem("test", "not json");
  const repo = repositoryModule.create({ storage, key: "test" });
  assert.throws(() => repo.readAll(), /damaged/);
});