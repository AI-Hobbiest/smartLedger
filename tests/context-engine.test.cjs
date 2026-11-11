const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/js/context-engine.js", "utf8");
const windowStub = {};
vm.runInNewContext(source, { window: windowStub });
const engineApi = windowStub.SmartLedgerContext;
const fixedNow = () => new Date("2026-11-11T10:30:00");

test("named month report resolves a full calendar month and expense intent", () => {
  const context = engineApi.create({ now: fixedNow });
  const result = context.route("What's our expnse for Nov'26?");
  assert.equal(result.intent, "report");
  assert.deepEqual(JSON.parse(JSON.stringify(result.report.period)), {
    kind: "month", from: "2026-11-01", to: "2026-11-30"
  });
  assert.equal(result.report.filters.type, "Expense");
});

test("date follow-up changes only the period and preserves report filters", () => {
  const context = engineApi.create({ now: fixedNow });
  context.route("What's our expense for Nov'26?");
  const result = context.route("Just today?");
  assert.equal(result.intent, "report");
  assert.equal(result.isFollowUp, true);
  assert.equal(result.report.period.from, "2026-11-11");
  assert.equal(result.report.period.to, "2026-11-11");
  assert.equal(result.report.filters.type, "Expense");
});

test("category and payment follow-ups merge without losing prior context", () => {
  const context = engineApi.create({ now: fixedNow });
  context.route("How much did I spend last month?");
  context.route("What about groceries?");
  const result = context.route("And cash?");
  assert.equal(result.report.period.from, "2026-10-01");
  assert.equal(result.report.period.to, "2026-10-31");
  assert.equal(result.report.filters.type, "Expense");
  assert.equal(result.report.filters.category, "Grocery");
  assert.equal(result.report.filters.payment, "Cash");
});

test("group-by follow-up is retained when the date changes", () => {
  const context = engineApi.create({ now: fixedNow });
  context.route("Give me an expense summary for this month");
  context.route("Break it down by category");
  const result = context.route("No, yesterday instead");
  assert.equal(result.report.period.from, "2026-11-10");
  assert.equal(result.report.filters.type, "Expense");
  assert.equal(result.report.filters.groupBy, "category");
});

test("greetings do not erase an active report context", () => {
  const context = engineApi.create({ now: fixedNow });
  context.route("Show expenses this month");
  assert.equal(context.route("Hi").intent, "greeting");
  const result = context.route("What about yesterday?");
  assert.equal(result.report.period.from, "2026-11-10");
  assert.equal(result.report.filters.type, "Expense");
});

test("a new transaction ends the active report context", () => {
  const context = engineApi.create({ now: fixedNow });
  context.route("Show expenses this month");
  const result = context.route("I spent 20 AED on dinner yesterday");
  assert.equal(result.intent, "transaction");
  assert.equal(context.getReport(), null);
});

test("numeric dates are interpreted as one day, not an entire month", () => {
  const period = engineApi.extractPeriod("expenses on 10/11/2026", fixedNow());
  assert.equal(period.from, "2026-11-10");
  assert.equal(period.to, "2026-11-10");
});
