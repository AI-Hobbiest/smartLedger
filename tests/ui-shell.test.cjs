const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "preview/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "preview/assets/js/app.js"), "utf8");

test("redesigned navigation has a matching destination for every workspace view", () => {
  const targets = [...html.matchAll(/data-nav-target="([^"]+)"/g)].map(match => match[1]);
  const pages = [...html.matchAll(/id="page-([^"]+)"/g)].map(match => match[1]);
  for (const page of ["overview", "transactions", "budgets", "trips", "reports"]) {
    assert.ok(targets.includes(page), "missing navigation target: " + page);
    assert.ok(pages.includes(page), "missing page destination: " + page);
  }
});

test("redesigned shell retains existing workflow hooks and dialogs", () => {
  for (const id of [
    "transactionDialog", "transactionForm", "tripDialog", "tripForm",
    "budgetDialog", "budgetForm", "chatForm", "chatStream", "transactionList",
    "budgetList", "tripList", "reportsPanel", "exportBackupButton", "importBackupButton"
  ]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(app, /authz\.canCreateTransaction/);
  assert.match(app, /authz\.canEditTransaction/);
  assert.match(app, /authz\.canDeleteTransaction/);
  assert.match(app, /authz\.canCreateTrip/);
});

test("dashboard category summaries explicitly group amounts by currency", () => {
  assert.match(app, /const byCurrency = \{\}/);
  assert.match(app, /const currency = txCurrency\(row\)/);
  assert.match(app, /Other categories/);
});

test("mobile and desktop navigation use the same page switching function", () => {
  assert.match(html, /class="sidebar"/);
  assert.match(html, /class="mobile-nav"/);
  assert.match(app, /document\.querySelectorAll\("\[data-nav-target\]"\)/);
  assert.match(app, /function setActivePage\(page\)/);
});

test("development-only data warning remains visible in the new app shell", () => {
  assert.match(html, /Development workspace/);
  assert.match(html, /do not enter real financial records yet/i);
});
