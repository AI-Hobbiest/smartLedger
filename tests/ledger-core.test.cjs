const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/js/ledger-core.js");

test("normalizes positive monetary values to two decimals", () => {
  assert.equal(core.normalizeAmount("1,234.567"), 1234.57);
  assert.throws(() => core.normalizeAmount("0"));
});

test("parses a plain-language expense into a confirmation draft", () => {
  const parsed = core.parseCommand("Spent AED 48 at Carrefour for groceries", { paidBy: "Jai" });
  assert.equal(parsed.kind, "transaction_draft");
  assert.equal(parsed.transaction.amount, 48);
  assert.equal(parsed.transaction.currency, "AED");
  assert.equal(parsed.transaction.category, "Grocery");
  assert.equal(parsed.transaction.paidBy, "Jai");
});

test("parses report shortcuts without requiring AI", () => {
  assert.deepEqual(core.parseCommand("Show my spending this month").period, "month");
  assert.equal(core.parseCommand("Show trip expenses").kind, "trip_report");
});

test("summarizes month transactions and excludes income", () => {
  const result = core.summarize([
    { date: "2026-11-02", type: "Expense", amount: 20, currency: "AED" },
    { date: "2026-11-03", type: "Income", amount: 200, currency: "AED" }
  ], "month", "2026-11-23T12:00:00");
  assert.equal(result.total, 20);
  assert.equal(result.count, 1);
});
