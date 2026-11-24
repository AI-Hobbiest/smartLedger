const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "preview/index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "preview/assets/js/app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "preview/assets/css/app.css"), "utf8");

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


test("the signature overview hero is data-backed and reports activity counts rather than mixing currencies", () => {
  for (const id of ["heroNetBalance", "heroTransactionPulse", "heroPulseBars", "heroActiveDays"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(app, /function renderDashboardPulse/);
  assert.match(app, /byDay\[day\] = \(byDay\[day\] \|\| 0\) \+ 1/);
  assert.match(app, /formatTotals\(balance\)/);
});

test("transaction history is grouped by date while retaining permission-aware row actions", () => {
  assert.match(app, /function dateHeading/);
  assert.match(app, /const grouped = new Map\(\)/);
  assert.match(app, /authz\.canEditTransaction/);
  assert.match(app, /authz\.canDeleteTransaction/);
  for (const id of ["transactionVisibleCount", "transactionExpenseTotal", "transactionIncomeTotal"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

test("budget cards show remaining amounts and near/over-limit states", () => {
  assert.match(app, /const remaining = limit - spent/);
  assert.match(app, /percent >= 100 \? "over" : percent >= 80 \? "near" : "safe"/);
  assert.match(app, /budget-ring/);
  assert.match(html, /id="budgetOverview"/);
});

test("trip cards remain role-aware and include participant context", () => {
  assert.match(app, /authz\.canEditTripDetails/);
  assert.match(app, /authz\.canCloseTrip/);
  assert.match(app, /authz\.getMembership\(currentUser, trip, data\.tripMembers\)/);
  assert.match(app, /tripMembers\.length/);
  assert.match(html, /id="tripOverview"/);
});

test("reports render separate income and expense series for each currency", () => {
  assert.match(app, /function buildReportVisuals/);
  assert.match(app, /const currencies = \[\.\.\.new Set\(rows\.map\(txCurrency\)\)\]/);
  assert.match(app, /class="expense-bar"/);
  assert.match(app, /class="income-bar"/);
  assert.match(app, /report-currency-group/);
});

test("the refreshed brand uses the plum theme in browser and installed PWA metadata", () => {
  assert.match(html, /theme-color" content="#252137"/);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "preview/manifest.json"), "utf8"));
  assert.equal(manifest.theme_color, "#252137");
  assert.equal(manifest.background_color, "#f3eee8");
  const css = fs.readFileSync(path.join(root, "preview/assets/css/app.css"), "utf8");
  assert.match(css, /--coral:#f0785d/);
  assert.match(css, /--lilac:#9b8be8/);
  assert.match(css, /--plum:#252137/);
});


test("trip cards open a permission-checked trip workspace with members and recent activity", () => {
  assert.match(html, /id="tripDetailDialog"/);
  assert.match(html, /id="tripDetailBody"/);
  assert.match(app, /function openTripDetail\(tripId\)/);
  assert.match(app, /authz\.canViewTrip\(currentUser, trip, data\.tripMembers\)/);
  assert.match(app, /data-tripdetail-all/);
  assert.match(app, /data-tripdetail-report/);
});

test("budget and report category drilldowns navigate to filtered ledger activity", () => {
  assert.match(app, /data-budget-activity/);
  assert.match(app, /data-report-category/);
  assert.match(app, /setActivePage\("transactions"\)/);
  assert.match(app, /transactionCategoryFilter/);
});

test("mobile sheet styling respects safe areas and reduced-motion preferences", () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.app-dialog\[open\]/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /id="toastRegion"/);
});
