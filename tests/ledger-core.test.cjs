const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/js/ledger-core.js");

test("normalizes positive monetary values to two decimals", () => {
  assert.equal(core.normalizeAmount("1,234.567"), 1234.57);
  assert.throws(() => core.normalizeAmount("0"));
});

test("parses a plain-language expense into a review draft", () => {
  const parsed = core.parseCommand("I spent 48 AED at Carrefour for groceries using my credit card", { paidBy:"Me", now:"2026-11-23T10:00:00" });
  assert.equal(parsed.kind, "transaction_draft");
  assert.equal(parsed.transaction.amount, 48);
  assert.equal(parsed.transaction.currency, "AED");
  assert.equal(parsed.transaction.category, "Grocery");
  assert.equal(parsed.transaction.paymentType, "Credit Card");
  assert.match(parsed.transaction.description, /Carrefour/i);
});

test("parses income and relative dates", () => {
  const parsed = core.parseCommand("Received 5,000 AED salary yesterday", { now:"2026-11-23T10:00:00" });
  assert.equal(parsed.transaction.type, "Income");
  assert.equal(parsed.transaction.amount, 5000);
  assert.equal(parsed.transaction.category, "Salary");
  assert.equal(parsed.transaction.date, "2026-11-22");
});

test("recognizes report periods including quarter and year", () => {
  assert.equal(core.parseCommand("Show my spending this month").period, "month");
  assert.equal(core.parseCommand("Show trip expenses").kind, "trip_report");
  assert.equal(core.parseCommand("Show spending this quarter").period, "quarter");
  assert.equal(core.parseCommand("Show my annual expenses").period, "year");
});

test("calculates local calendar ranges and excludes income from spend summary", () => {
  const result = core.summarize([
    { date:"2026-11-02", type:"Expense", amount:20, currency:"AED" },
    { date:"2026-11-03", type:"Income", amount:200, currency:"AED" }
  ], "month", "2026-11-23T12:00:00");
  assert.equal(result.totalByCurrency.AED, 20);
  assert.equal(result.count, 1);
  assert.equal(result.bounds.start, "2026-11-01");
});

test("does not turn an unrelated number into a transaction", () => {
  assert.equal(core.parseCommand("My flight is at 7 pm").kind, "unknown");
});