(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const core = window.SmartLedgerCore;
  const repository = window.GanatheLedgerRepository.create();
  const authz = window.GanatheLedgerAuthz;
  let data = { transactions: [], trips: [], tripMembers: [], users: [], budgets: [] };
  let currentUser = null;
  let tripWizardStep = 1;
  let currentDraft = null;
  let conversationState = null;
  let reportRows = [];

  const today = () => core.localDateISO(new Date());
  const money = (amount, currency) => (currency || "AED") + " " + Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const safe = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const txCurrency = row => row.currency || "AED";
  const compareDateDesc = (a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  const tripName = id => (data.trips.find(item => item.id === id) || {}).name || "";
  const visibleTransactions = () => authz.visibleTransactions(data.transactions, currentUser, data.trips, data.tripMembers);
  const visibleTrips = () => authz.visibleTrips(data.trips, currentUser, data.tripMembers);
  const userName = id => (data.users.find(item => item.id === id) || {}).name || "Unknown user";
  function isAdminPreview() { return authz.isAdmin(currentUser); }
  const PAGE_META = {
    overview: { eyebrow: "YOUR MONEY, AT A GLANCE", title: "Overview", description: "A clear view of your spending, family activity and trips." },
    transactions: { eyebrow: "YOUR LEDGER", title: "Transactions", description: "Search, filter and manage the activity visible to this account." },
    budgets: { eyebrow: "PLAN WITH INTENTION", title: "Budgets", description: "Keep an eye on monthly category limits and progress." },
    trips: { eyebrow: "SHARED SPENDING", title: "Trips", description: "Manage trip workspaces, members and shared expenses." },
    reports: { eyebrow: "UNDERSTAND YOUR MONEY", title: "Reports", description: "Explore your activity by day, week, month, quarter or trip." }
  };

  function setActivePage(page) {
    const selected = PAGE_META[page] ? page : "overview";
    document.querySelectorAll(".page-view").forEach(view => {
      const active = view.id === "page-" + selected;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
    document.querySelectorAll("[data-nav-target]").forEach(button => {
      const active = button.dataset.navTarget === selected;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const meta = PAGE_META[selected];
    $("pageEyebrow").textContent = meta.eyebrow;
    $("pageTitle").textContent = meta.title;
    $("pageDescription").textContent = meta.description;
    if (selected === "transactions") renderTransactions();
    if (selected === "budgets") renderBudgets();
    if (selected === "trips") renderTrips();
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function updateAdminControls() {
    const admin = isAdminPreview();
    $("addTripLink").hidden = !admin;
    const quickTrip = document.querySelector('[data-action="trip"]');
    if (quickTrip) quickTrip.hidden = !admin;
    $("exportBackupButton").hidden = !admin;
    $("importBackupButton").hidden = !admin;
  }
  function renderIdentitySwitch() {
    const select = $("demoIdentitySelect");
    const available = data.users.filter(user => !user.isTripOnly && (user.status || "Active") === "Active");
    select.innerHTML = available.map(user => '<option value="' + safe(user.id) + '">' + safe(user.name) + (authz.isAdmin(user) ? " · Admin" : " · Member") + '</option>').join("");
    if (!available.some(user => currentUser && user.id === currentUser.id)) currentUser = available.find(user => user.id === "DEMO-ADMIN") || available[0] || null;
    if (currentUser) select.value = currentUser.id;
    select.onchange = () => {
      const next = data.users.find(user => user.id === select.value && !user.isTripOnly);
      if (!next) return;
      currentUser = next;
      try { localStorage.setItem("ganathe.smartledger.preview.identity", currentUser.id); } catch (_) {}
      render();
      addChat("Preview identity switched to " + currentUser.name + ". This selector is for development testing only.", "assistant");
    };
  }

  function setStatus(label, state) { $("syncText").textContent = label; $("syncStatus").dataset.state = state || "local"; }
  async function loadData() {
    const snapshot = await repository.readSnapshot();
    data = {
      transactions: snapshot.transactions,
      trips: snapshot.trips,
      tripMembers: snapshot.tripMembers || [],
      users: snapshot.users || [],
      budgets: snapshot.budgets
    };
    let storedIdentity = "";
    try { storedIdentity = localStorage.getItem("ganathe.smartledger.preview.identity") || ""; } catch (_) {}
    currentUser = data.users.find(user => user.id === storedIdentity && !user.isTripOnly) ||
      data.users.find(user => user.id === "DEMO-ADMIN") || data.users.find(user => !user.isTripOnly) || null;
    render();
  }

  function totals(rows, wantedType) {
    const result = {};
    rows.filter(row => !wantedType || row.type === wantedType).forEach(row => {
      const code = txCurrency(row);
      result[code] = (result[code] || 0) + Number(row.amount || 0);
    });
    return result;
  }
  function formatTotals(values) {
    const keys = Object.keys(values).sort();
    return keys.length ? keys.map(code => money(values[code], code)).join(" · ") : "—";
  }

  function renderDashboard() {
    const month = today().slice(0, 7);
    const rows = visibleTransactions().filter(row => String(row.date || "").slice(0, 7) === month);
    const expenses = totals(rows, "Expense"), income = totals(rows, "Income"), balance = {};
    new Set([...Object.keys(expenses), ...Object.keys(income)]).forEach(code => { balance[code] = (income[code] || 0) - (expenses[code] || 0); });
    $("monthSpend").textContent = formatTotals(expenses);
    $("monthIncome").textContent = formatTotals(income);
    $("monthBalance").textContent = formatTotals(balance);
    $("monthSpendHint").textContent = rows.filter(row => row.type === "Expense").length + " expense entries";
    $("monthIncomeHint").textContent = rows.filter(row => row.type === "Income").length + " income entries";
    $("activeTrips").textContent = visibleTrips().filter(item => ["Planned", "Active"].includes(item.status || "Active")).length;
    renderDashboardPanels(rows);
    renderDashboardPulse(rows, balance);
  }

function renderDashboardPulse(monthRows, balance) {
    const host = $("heroPulseBars");
    if (!host) return;
    $("heroNetBalance").textContent = formatTotals(balance);
    const recent = visibleTransactions().slice().sort(compareDateDesc).slice(0,14);
    const byDay = {};
    recent.forEach(row => { const day = row.date || ""; byDay[day] = (byDay[day] || 0) + 1; });
    const days = [];
    const cursor = new Date(); cursor.setHours(12,0,0,0);
    for (let i = 13; i >= 0; i--) {
      const date = new Date(cursor); date.setDate(cursor.getDate() - i);
      days.push(core.localDateISO(date));
    }
    const maxCount = Math.max(1, ...days.map(day => byDay[day] || 0));
    const activeDays = days.filter(day => byDay[day]).length;
    host.innerHTML = days.map(day => {
      const count = byDay[day] || 0;
      const height = count ? Math.max(13, count / maxCount * 76) : 5;
      const current = day === today();
      return '<span class="hero-pulse-bar' + (current ? ' is-today' : '') + '" style="--bar-height:' + height.toFixed(1) + 'px" title="' + safe(day) + ': ' + count + ' transaction' + (count === 1 ? '' : 's') + '"></span>';
    }).join("");
    $("heroTransactionPulse").textContent = monthRows.length + " entries this month · " + activeDays + " active days in the last 14";
    $("heroActiveDays").textContent = activeDays + " active days";
  }

    function renderDashboardPanels(monthRows) {
    const categoriesHost = $("dashboardCategoryBreakdown");
    const recentHost = $("dashboardRecentTransactions");
    if (!categoriesHost || !recentHost) return;

    const byCurrency = {};
    monthRows.filter(row => row.type === "Expense").forEach(row => {
      const currency = txCurrency(row), category = row.category || "Other";
      if (!byCurrency[currency]) byCurrency[currency] = {};
      byCurrency[currency][category] = (byCurrency[currency][category] || 0) + Number(row.amount || 0);
    });
    const currencyGroups = Object.entries(byCurrency);
    categoriesHost.innerHTML = currencyGroups.length ? currencyGroups.map(([currency, categoryTotals]) => {
      const entries = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1]);
      const total = entries.reduce((sum, item) => sum + item[1], 0);
      const shown = entries.slice(0,5);
      const remainder = entries.slice(5).reduce((sum, item) => sum + item[1], 0);
      if (remainder > 0) shown.push(["Other categories", remainder]);
      return '<div class="category-currency-group"><div class="category-currency-heading"><span>' + safe(currency) + ' spending</span><small>' + safe(money(total, currency)) + '</small></div>' +
        shown.map(([category, amount]) => '<div class="category-line"><div class="category-line-top"><span>' + safe(category) + '</span><strong>' + safe(money(amount, currency)) + '</strong></div><div class="category-line-track"><span style="width:' + (total > 0 ? (amount / total * 100) : 0).toFixed(1) + '%"></span></div></div>').join("") +
      '</div>';
    }).join("") : '<div class="empty-state">No expenses recorded this month yet.</div>';

    const recent = visibleTransactions().slice().sort(compareDateDesc).slice(0,5);
    recentHost.innerHTML = recent.length ? recent.map(row => {
      const income = row.type === "Income";
      const detail = [row.category, row.date, row.tripId ? tripName(row.tripId) : ""].filter(Boolean).join(" · ");
      return '<article class="dashboard-recent-item"><div class="dashboard-recent-main"><span class="dashboard-recent-icon ' + (income ? "income" : "") + '">' + (income ? "↗" : "↘") + '</span><div class="dashboard-recent-copy"><strong>' + safe(row.description) + '</strong><small>' + safe(detail) + '</small></div></div><span class="dashboard-recent-amount ' + (income ? "income" : "") + '">' + (income ? "+" : "−") + safe(money(row.amount, txCurrency(row))) + '</span></article>';
    }).join("") : '<div class="empty-state">No transactions yet. Add your first test entry.</div>';
  }

  function filterTransactions() {
    const search = $("transactionSearch").value.trim().toLowerCase();
    const type = $("transactionTypeFilter").value, category = $("transactionCategoryFilter").value, trip = $("transactionTripFilter").value;
    return visibleTransactions().filter(row => {
      const haystack = [row.description, row.category, row.notes, row.paidBy, tripName(row.tripId)].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && (!type || row.type === type) &&
        (!category || row.category === category) && (!trip || (trip === "__personal" ? !row.tripId : row.tripId === trip));
    }).sort(compareDateDesc);
  }

  function dateHeading(value) {
    if (!value) return "Date not recorded";
    if (value === today()) return "Today";
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (value === core.localDateISO(yesterday)) return "Yesterday";
    const parsed = new Date(value + "T12:00:00");
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { weekday:"long", day:"numeric", month:"short", year:"numeric" });
  }

  function renderTransactions() {
    const host = $("transactionList"), rows = filterTransactions();
    const expenses = totals(rows, "Expense"), income = totals(rows, "Income");
    $("transactionCount").textContent = rows.length + " visible of " + visibleTransactions().length + " transactions";
    if ($("transactionVisibleCount")) $("transactionVisibleCount").textContent = String(rows.length);
    if ($("transactionExpenseTotal")) $("transactionExpenseTotal").textContent = formatTotals(expenses);
    if ($("transactionIncomeTotal")) $("transactionIncomeTotal").textContent = formatTotals(income);
    if (!rows.length) {
      host.innerHTML = '<div class="empty-state">No transactions match this view. Try a different filter or add an entry.</div>';
      return;
    }
    const grouped = new Map();
    rows.slice(0,100).forEach(row => {
      const key = row.date || "";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    host.innerHTML = [...grouped.entries()].map(([day, dayRows]) => {
      const dayExpenses = totals(dayRows, "Expense"), dayIncome = totals(dayRows, "Income");
      const detail = [
        Object.keys(dayExpenses).length ? "Spent " + formatTotals(dayExpenses) : "",
        Object.keys(dayIncome).length ? "Received " + formatTotals(dayIncome) : ""
      ].filter(Boolean).join(" · ");
      const items = dayRows.map(row => {
        const isIncome = row.type === "Income";
        const trip = row.tripId ? " · " + safe(tripName(row.tripId) || "Trip") : "";
        const mayEdit = authz.canEditTransaction(currentUser, row, data.trips, data.tripMembers);
        const mayDelete = authz.canDeleteTransaction(currentUser, row, data.trips, data.tripMembers);
        const actions = (mayEdit ? '<button type="button" data-edit-tx="' + safe(row.id) + '">Edit</button>' : '') +
          (mayDelete ? '<button type="button" data-delete-tx="' + safe(row.id) + '">Delete</button>' : '');
        const glyph = isIncome ? "↗" : (row.category || "").toLowerCase().includes("food") ? "◒" :
          (row.category || "").toLowerCase().includes("travel") ? "✈" :
          (row.category || "").toLowerCase().includes("grocery") ? "▧" :
          (row.category || "").toLowerCase().includes("devotional") ? "✧" : "↘";
        return '<article class="transaction-item managed-transaction"><div class="item-main"><span class="item-icon">' + glyph + '</span><div class="item-copy"><strong>' + safe(row.description) + '</strong><small>' + safe(row.category) + ' · ' + safe(row.paymentType || "Other") + trip + '</small><small>' + safe(row.paidBy || userName(row.spentByUserId)) + ' · ' + safe(userName(row.recordedByUserId)) + ' recorded</small></div></div><div class="transaction-side"><span class="item-amount ' + (isIncome ? "income" : "") + '">' + (isIncome ? "+" : "−") + safe(money(row.amount, txCurrency(row))) + '</span><div class="row-actions">' + actions + '</div></div></article>';
      }).join("");
      return '<section class="transaction-day-group"><header class="transaction-day-heading"><strong>' + safe(dateHeading(day)) + '</strong><span>' + dayRows.length + ' entries' + (detail ? ' · ' + safe(detail) : '') + '</span></header>' + items + '</section>';
    }).join("");
    host.querySelectorAll("[data-edit-tx]").forEach(button => button.addEventListener("click", () => {
      const row = data.transactions.find(item => item.id === button.dataset.editTx);
      if (row) openTransactionForm(row);
    }));
    host.querySelectorAll("[data-delete-tx]").forEach(button => button.addEventListener("click", async () => {
      const row = data.transactions.find(item => item.id === button.dataset.deleteTx);
      if (!row || !authz.canDeleteTransaction(currentUser, row, data.trips, data.tripMembers)) return;
      if (!confirm("Delete this " + row.type.toLowerCase() + " entry: " + row.description + "?")) return;
      try { await repository.deleteTransaction(row.id); await loadData(); addChat("Transaction deleted.", "assistant"); }
      catch (error) { showError(error); }
    }));
  }



    function renderTrips() {
    const host = $("tripList"), trips = visibleTrips();
    const activeCount = trips.filter(trip => ["Planned","Active"].includes(trip.status || "Planned")).length;
    const memberCount = new Set(data.tripMembers.filter(item => trips.some(trip => trip.id === item.tripId) && (item.membershipStatus || "Active") === "Active").map(item => item.userId)).size;
    if ($("tripOverview")) $("tripOverview").innerHTML = '<div><strong>' + trips.length + ' trip' + (trips.length === 1 ? '' : 's') + '</strong><span> in your workspace</span></div><div><strong>' + activeCount + '</strong><span> planned or active</span></div><div><strong>' + memberCount + '</strong><span> people involved</span></div>';
    if (!trips.length) {
      host.innerHTML = '<div class="empty-state">No trips are assigned to this identity. A Household Admin can create a trip and add you.</div>';
      return;
    }
    host.innerHTML = trips.slice().sort((a,b) => String(b.startDate || "").localeCompare(String(a.startDate || ""))).map((trip,index) => {
      const linked = visibleTransactions().filter(row => row.tripId === trip.id && row.type === "Expense");
      const tripMembers = data.tripMembers.filter(item => item.tripId === trip.id && (item.membershipStatus || "Active") === "Active");
      const mayEdit = authz.canEditTripDetails(currentUser, trip, data.tripMembers);
      const mayClose = authz.canCloseTrip(currentUser, trip);
      const actions = (mayEdit ? '<button type="button" data-edit-trip="' + safe(trip.id) + '">Edit details</button>' : '') +
        (mayClose ? '<button type="button" data-close-trip="' + safe(trip.id) + '">Close trip</button>' : '') +
        '<button type="button" data-trip-report="' + safe(trip.id) + '">Report</button>';
      const dates = [trip.startDate, trip.endDate].filter(Boolean);
      const dateLabel = dates.length === 2 ? dates.join(" → ") : dates[0] || "Dates not set";
      const status = trip.status || "Planned";
      const role = authz.getMembership ? authz.getMembership(currentUser, trip, data.tripMembers) : null;
      return '<article class="trip-item trip-tone-' + (index % 4) + '"><div class="trip-card-top"><span class="trip-card-icon">✈</span><span class="trip-badge" data-status="' + safe(status) + '">' + safe(status) + '</span></div><div><strong>' + safe(trip.name) + '</strong><small>' + safe(trip.destination || "Destination not set") + '</small><small>' + safe(dateLabel) + ' · ' + safe(trip.currency || "AED") + '</small></div><div class="trip-card-metrics"><div><small>TRIP SPENDING</small><strong>' + safe(formatTotals(totals(linked))) + '</strong></div><div><small>EXPENSE ENTRIES</small><strong>' + linked.length + '</strong></div></div><div class="trip-card-footer"><span class="trip-participant-count">' + tripMembers.length + ' active member' + (tripMembers.length === 1 ? '' : 's') + (role && role.tripRole ? ' · You are ' + safe(role.tripRole) : '') + '</span><span class="trip-actions">' + actions + '</span></div></article>';
    }).join("");
    host.querySelectorAll("[data-edit-trip]").forEach(button => button.addEventListener("click", () => {
      const trip = data.trips.find(item => item.id === button.dataset.editTrip);
      if (trip) openTripForm(trip);
    }));
    host.querySelectorAll("[data-trip-report]").forEach(button => button.addEventListener("click", () => runReport("trip", button.dataset.tripReport)));
    host.querySelectorAll("[data-close-trip]").forEach(button => button.addEventListener("click", async () => {
      const trip = data.trips.find(item => item.id === button.dataset.closeTrip);
      if (!trip || !authz.canCloseTrip(currentUser, trip)) return;
      if (!confirm("Close " + trip.name + "? It will remain available for reports but become read-only.")) return;
      try {
        await repository.updateTrip({ ...trip, status: "Closed", closedByUserId: currentUser.id, closedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
        await loadData();
        addChat("Trip closed. Its history remains available for permitted read-only reports.", "assistant");
      } catch (error) { showError(error); }
    }));
  }



    function currentMonthBudgetSpent(budget) {
    const month = today().slice(0, 7);
    return visibleTransactions().filter(row => row.type === "Expense" && String(row.date || "").slice(0, 7) === month &&
      row.category === budget.category && txCurrency(row) === budget.currency).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function renderBudgets() {
    const host = $("budgetList");
    const budgets = data.budgets.slice().sort((a,b) => a.category.localeCompare(b.category));
    if (!budgets.length) {
      if ($("budgetOverview")) $("budgetOverview").innerHTML = '<span>No budgets yet. Set a limit for a category and Smart Ledger will track it here.</span>';
      host.innerHTML = '<div class="empty-state">No monthly budgets set. Create your first limit to start tracking progress.</div>';
      return;
    }
    let near = 0, over = 0, safeCount = 0;
    const cards = budgets.map((budget,index) => {
      const spent = currentMonthBudgetSpent(budget), limit = Number(budget.amount || 0), percent = limit > 0 ? spent / limit * 100 : 0;
      const width = Math.min(100, Math.max(0, percent)), state = percent >= 100 ? "over" : percent >= 80 ? "near" : "safe";
      if (state === "over") over++; else if (state === "near") near++; else safeCount++;
      const remaining = limit - spent;
      const glyph = (budget.category || "").toLowerCase().includes("food") ? "◒" :
        (budget.category || "").toLowerCase().includes("travel") ? "✈" :
        (budget.category || "").toLowerCase().includes("grocery") ? "▧" :
        (budget.category || "").toLowerCase().includes("apparel") ? "◇" :
        (budget.category || "").toLowerCase().includes("devotional") ? "✧" : "✦";
      return '<article class="budget-item is-' + state + '"><div class="budget-card-head"><span class="budget-category-icon">' + glyph + '</span><div class="budget-title"><strong>' + safe(budget.category) + '</strong><small>Monthly category limit · ' + safe(budget.currency) + '</small></div><div class="budget-ring" style="--budget-progress:' + width.toFixed(1) + '%"><span>' + Math.round(percent) + '%</span></div></div><div class="budget-amount-row"><div><small>SPENT SO FAR</small><strong>' + safe(money(spent,budget.currency)) + '</strong></div><div><small>' + (remaining >= 0 ? 'LEFT TO SPEND' : 'OVER BUDGET') + '</small><strong class="budget-remaining">' + safe(money(Math.abs(remaining),budget.currency)) + '</strong></div></div><div class="budget-track"><span class="' + state + '" style="width:' + width.toFixed(1) + '%"></span></div><div class="budget-foot"><small>' + safe(money(limit,budget.currency)) + ' monthly limit</small><span class="row-actions"><button type="button" data-edit-budget="' + safe(budget.id) + '">Edit</button><button type="button" data-delete-budget="' + safe(budget.id) + '">Delete</button></span></div></article>';
    });
    if ($("budgetOverview")) $("budgetOverview").innerHTML = '<div><strong>' + budgets.length + ' budgets</strong><span> being tracked</span></div><div><strong>' + safeCount + '</strong><span> on track</span></div><div><strong>' + near + '</strong><span> nearing limit</span></div><div><strong>' + over + '</strong><span> over limit</span></div>';
    host.innerHTML = cards.join("");
    host.querySelectorAll("[data-edit-budget]").forEach(button => button.addEventListener("click", () => {
      const budget = data.budgets.find(item => item.id === button.dataset.editBudget);
      if (budget) openBudgetForm(budget);
    }));
    host.querySelectorAll("[data-delete-budget]").forEach(button => button.addEventListener("click", async () => {
      if (!confirm("Delete this budget?")) return;
      try { await repository.deleteBudget(button.dataset.deleteBudget); await loadData(); }
      catch (error) { showError(error); }
    }));
  }



    function populateSelects() {
    const expenseOptions = core.CATEGORIES.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
    $("txCategory").innerHTML = ($("txType").value === "Income" ? core.INCOME_CATEGORIES : core.CATEGORIES)
      .map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
    $("budgetCategory").innerHTML = expenseOptions;
    const filterCategories = [...new Set([...core.CATEGORIES, ...core.INCOME_CATEGORIES])];
    $("transactionCategoryFilter").innerHTML = '<option value="">All categories</option>' +
      filterCategories.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
    const usableTrips = visibleTrips();
    const tripOptions = usableTrips.map(trip => '<option value="' + safe(trip.id) + '">' + safe(trip.name) + '</option>').join("");
    const currentTxTrip = $("txTrip").value, currentFilterTrip = $("transactionTripFilter").value;
    $("txTrip").innerHTML = '<option value="">Personal / non-trip</option>' +
      usableTrips.filter(trip => authz.isTripOpen(trip)).map(trip => '<option value="' + safe(trip.id) + '">' + safe(trip.name) + '</option>').join("");
    $("transactionTripFilter").innerHTML = '<option value="">All activity</option><option value="__personal">Personal only</option>' + tripOptions;
    if (usableTrips.some(item => item.id === currentTxTrip && authz.isTripOpen(item))) $("txTrip").value = currentTxTrip;
    if (usableTrips.some(item => item.id === currentFilterTrip)) $("transactionTripFilter").value = currentFilterTrip;
  }

  function render() {
    renderIdentitySwitch();
    updateAdminControls();
    populateSelects();
    renderDashboard();
    renderTransactions();
    renderTrips();
    renderBudgets();
    setStatus("Preview as " + (currentUser ? currentUser.name : "Unknown") + " · local only", "local");
  }

  function addChat(text, who) {
    const wrapper = document.createElement("div"); wrapper.className = "chat-message " + (who === "user" ? "user" : "assistant");
    if (who !== "user") { const avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = "GL"; wrapper.appendChild(avatar); }
    const body = document.createElement("div"); body.className = "message-body"; body.textContent = text; wrapper.appendChild(body);
    $("chatStream").appendChild(wrapper); $("chatStream").scrollTop = $("chatStream").scrollHeight;
  }

  function showDraft(draft) {
    currentDraft = draft.transaction;
    conversationState = null;
    const row = draft.transaction, wrap = document.createElement("div");
    wrap.className = "chat-message assistant";
    const avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = "GL";
    const body = document.createElement("div"); body.className = "message-body";
    const partyLabel = row.type === "Income" ? "Received from " : "Paid by ";
    body.innerHTML = '<p><strong>Review this transaction before saving.</strong></p><p>' + safe(row.type) + ' · ' + safe(money(row.amount,row.currency)) + '</p><p>' + safe(row.description) + ' · ' + safe(row.category) + '</p><p>' + safe(row.date) + ' · ' + safe(row.paymentType) + ' · ' + safe(partyLabel + (row.paidBy || "Me")) + '</p>' + (row.notes ? '<p>' + safe(row.notes) + '</p>' : '');
    const actions = document.createElement("div"); actions.className = "draft-actions";
    const confirmButton = document.createElement("button"); confirmButton.type = "button"; confirmButton.className = "button button-primary button-small"; confirmButton.textContent = "Confirm & save";
    const editButton = document.createElement("button"); editButton.type = "button"; editButton.className = "button button-outline button-small"; editButton.textContent = "Edit details";
    const cancelButton = document.createElement("button"); cancelButton.type = "button"; cancelButton.className = "button button-outline button-small"; cancelButton.textContent = "Cancel";
    confirmButton.addEventListener("click", async () => {
      if (!currentDraft) return;
      try {
        const transaction = { ...currentDraft, id: core.makeId("TX"), spentByUserId: currentDraft.spentByUserId || currentUser.id, recordedByUserId: currentUser.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (!authz.canCreateTransaction(currentUser, transaction, data.trips, data.tripMembers)) throw new Error("You do not have permission to add this transaction.");
        await repository.createTransaction(transaction); currentDraft = null; await loadData();
        addChat("Saved to the development ledger. This data is still only on this device.", "assistant");
      } catch (error) { showError(error); }
    });
    editButton.addEventListener("click", () => { openTransactionForm(currentDraft); currentDraft = null; });
    cancelButton.addEventListener("click", () => { currentDraft = null; addChat("Draft cancelled. Nothing was saved.", "assistant"); });
    actions.append(confirmButton, editButton, cancelButton); body.appendChild(actions); wrap.append(avatar, body);
    $("chatStream").appendChild(wrap); $("chatStream").scrollTop = $("chatStream").scrollHeight;
  }

  function askForNextTransactionDetail() {
    if (!conversationState) return;
    const state = conversationState;
    const row = state.transaction;
    if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) {
      state.stage = "amount";
      if (row.type === "Income" && row.paidBy && row.paidBy !== "Me") {
        addChat("How much did " + row.paidBy + " pay you? Include the currency if it wasn't AED.", "assistant");
      } else {
        addChat("How much was the " + row.type.toLowerCase() + "? Include the currency if it wasn't AED.", "assistant");
      }
      return;
    }
    if (state.needsDescription || !row.description) {
      state.stage = "description";
      addChat(row.type === "Income" ? "What was this income from?" : "What was the expense for?", "assistant");
      return;
    }
    if (state.needsPurpose && !row.notes) {
      state.stage = "purpose";
      addChat("What was this payment for — a repayment, gift, loan, or something else?", "assistant");
      return;
    }
    const completed = row;
    conversationState = null;
    showDraft({ transaction: completed });
  }

  function startTransactionConversation(parsed) {
    const row = parsed.transaction || {};
    conversationState = {
      transaction: { ...row },
      needsPurpose: !!parsed.needsPurpose,
      needsDescription: !!parsed.needsDescription,
      stage: ""
    };
    askForNextTransactionDetail();
  }

  function continueTransactionConversation(reply) {
    if (!conversationState) return;
    const value = String(reply || "").trim();
    const state = conversationState;
    const row = state.transaction;
    if (/^(cancel|stop|never mind|nevermind|forget it)$/i.test(value)) {
      conversationState = null;
      addChat("Okay, cancelled. Nothing was saved.", "assistant");
      return;
    }

    if (state.stage === "amount") {
      const moneyValue = core.extractMoney(value, row.currency || "AED");
      if (!moneyValue) {
        addChat("I still need the amount. You can enter it like “AED 120” or “120”.", "assistant");
        return;
      }
      row.amount = moneyValue.amount;
      row.currency = moneyValue.currency;
      const purpose = row.type === "Income" ? core.inferIncomePurpose(value) : "";
      if (purpose) row.notes = "Purpose: " + purpose;
      const paymentType = core.inferPaymentType(value);
      if (paymentType !== "Other") row.paymentType = paymentType;
      let remainder = value.replace(moneyValue.raw, " ")
        .replace(/\b(aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b|\$/gi, " ")
        .replace(/\b(cash|credit card|debit card|bank transfer|digital wallet|wallet|cc|dc|for|at|in|on|as)\b/gi, " ")
        .replace(/\s+/g, " ").trim();
      if (remainder && state.needsDescription) {
        row.description = remainder.charAt(0).toUpperCase() + remainder.slice(1);
        row.category = core.inferCategory(remainder, row.type);
        state.needsDescription = false;
      } else if (remainder && state.needsPurpose && !row.notes) {
        row.notes = "Purpose: " + remainder;
        state.needsPurpose = false;
      }
      askForNextTransactionDetail();
      return;
    }

    if (state.stage === "description") {
      if (!value) {
        addChat("Please tell me what the " + row.type.toLowerCase() + " was for.", "assistant");
        return;
      }
      row.description = value.charAt(0).toUpperCase() + value.slice(1);
      row.category = core.inferCategory(value, row.type);
      const purpose = row.type === "Income" ? core.inferIncomePurpose(value) : "";
      if (purpose) row.notes = "Purpose: " + purpose;
      state.needsDescription = false;
      askForNextTransactionDetail();
      return;
    }

    if (state.stage === "purpose") {
      if (!value) {
        addChat("Please describe the purpose of the payment, or say “something else”.", "assistant");
        return;
      }
      const purpose = core.inferIncomePurpose(value);
      row.notes = "Purpose: " + (purpose || value);
      if (purpose === "Refund") row.category = "Refund";
      else if (purpose === "Salary") row.category = "Salary";
      state.needsPurpose = false;
      askForNextTransactionDetail();
    }
  }

  function startQuickTransaction(type) {
    addChat(type === "Income" ? "Let's add money received." : "Let's add an expense.", "assistant");
    const parsed = core.parseCommand(type === "Income" ? "Add income" : "Add an expense", { currency: "AED", paidBy: "Me" });
    startTransactionConversation(parsed);
  }

  function showError(error) {
    setStatus("Development storage · error", "error");
    addChat(error && error.message ? error.message : "The action could not be completed.", "assistant");
  }

  function populateSpentBySelect(selectedUserId) {
    const tripId = $("txTrip").value;
    let available = [];
    if (tripId) {
      const memberIds = data.tripMembers
        .filter(item => item.tripId === tripId && (item.membershipStatus || "Active") === "Active")
        .map(item => item.userId);
      available = data.users.filter(user => memberIds.includes(user.id) && (user.status || "Active") === "Active");
      if (selectedUserId && !available.some(user => user.id === selectedUserId)) {
        const historicalUser = data.users.find(user => user.id === selectedUserId);
        if (historicalUser) available.unshift({ ...historicalUser, isHistoricalParticipant: true });
      }
    } else {
      available = isAdminPreview()
        ? data.users.filter(user => !user.isTripOnly && (user.status || "Active") === "Active")
        : (currentUser ? [currentUser] : []);
    }
    if (!tripId && currentUser && !available.some(user => user.id === currentUser.id)) available.unshift(currentUser);
    $("txSpentByUser").innerHTML = '<option value="">Choose participant</option>' +
      available.map(user => '<option value="' + safe(user.id) + '">' + safe(user.name) + (user.isTripOnly ? " · Trip-only" : user.isHistoricalParticipant ? " · Former participant" : "") + '</option>').join("");
    const fallback = currentUser && available.some(user => user.id === currentUser.id)
      ? currentUser.id
      : (available[0] ? available[0].id : "");
    $("txSpentByUser").value = available.some(user => user.id === selectedUserId) ? selectedUserId : fallback;
  }

  function openTransactionForm(row) {
    if (row && row.id && !authz.canEditTransaction(currentUser, row, data.trips, data.tripMembers)) {
      addChat("You do not have permission to edit that transaction.", "assistant");
      return;
    }
    const form = $("transactionForm"); form.reset();
    $("txId").value = row && row.id || "";
    $("txType").value = row && row.type || "Expense";
    $("txDate").value = row && row.date || today();
    $("txDescription").value = row && row.description || "";
    $("txAmount").value = row && row.amount || "";
    const selectedTrip = row && row.tripId ? data.trips.find(item => item.id === row.tripId) : null;
    $("txCurrency").value = row && row.currency || (selectedTrip && selectedTrip.currency) || "AED";
    const categoryOptions = $("txType").value === "Income" ? core.INCOME_CATEGORIES : core.CATEGORIES;
    $("txCategory").innerHTML = categoryOptions.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
    $("txCategory").value = row && row.category || (categoryOptions[0] || "Misc / Others");
    $("txPayment").value = row && row.paymentType || "Other";
    $("txPaidBy").value = row && row.paidBy || (currentUser && currentUser.name) || "Me";
    $("txTrip").value = row && row.tripId || "";
    populateSpentBySelect(row && row.spentByUserId || (currentUser && currentUser.id));
    $("txNotes").value = row && row.notes || "";
    $("transactionDialogTitle").textContent = row && row.id ? "Edit transaction" : $("txType").value === "Income" ? "Add income" : "Add expense";
    $("transactionDialog").showModal();
  }

  function renderTripHouseholdUsers(row) {
    const existing = row ? data.tripMembers.filter(item => item.tripId === row.id) : [];
    const scopedIds = new Set(existing.map(item => item.userId));
    const users = data.users.filter(user =>
      (!user.isTripOnly || scopedIds.has(user.id)) && (user.status || "Active") === "Active"
    );
    $("tripHouseholdUsers").innerHTML = users.map(user => {
      const membership = existing.find(item => item.userId === user.id && (item.membershipStatus || "Active") === "Active");
      const checked = !!membership || (!row && currentUser && currentUser.id === user.id);
      const historicalMembership = existing.find(item => item.userId === user.id);
      const role = membership && membership.tripRole || historicalMembership && historicalMembership.tripRole ||
        (currentUser && currentUser.id === user.id ? "Organizer" : "Member");
      const label = safe(user.name) + (user.isTripOnly ? " · Trip-only" : "");
      const roleOptions = user.isTripOnly
        ? '<option value="Member" selected>Trip Member</option>'
        : '<option value="Member"' + (role === "Member" ? " selected" : "") + '>Trip Member</option><option value="Organizer"' + (role === "Organizer" ? " selected" : "") + '>Trip Organizer</option>';
      const roleDisabled = !checked || user.isTripOnly;
      return '<label class="trip-household-choice"><span><input type="checkbox" data-trip-user="' + safe(user.id) + '"' + (checked ? " checked" : "") + '> ' + label + '</span><select data-trip-role="' + safe(user.id) + '"' + (roleDisabled ? " disabled" : "") + '>' + roleOptions + '</select></label>';
    }).join("") || '<p class="wizard-help">No household users are available yet.</p>';
    $("tripHouseholdUsers").querySelectorAll("[data-trip-user]").forEach(input => input.addEventListener("change", () => {
      const role = $("tripHouseholdUsers").querySelector('[data-trip-role="' + input.dataset.tripUser + '"]');
      if (role) role.disabled = !input.checked || input.parentElement.textContent.includes("Trip-only");
    }));
  }

  function selectedTripMembers(tripId) {
    const newUsers = [], members = [];
    $("tripHouseholdUsers").querySelectorAll("[data-trip-user]:checked").forEach(input => {
      const userId = input.dataset.tripUser;
      const role = $("tripHouseholdUsers").querySelector('[data-trip-role="' + userId + '"]').value;
      members.push({
        id: core.makeId("TM"), tripId, userId, tripRole: role, membershipStatus: "Active",
        invitedByUserId: currentUser.id, joinedAt: null, addedAt: new Date().toISOString()
      });
    });
    $("tripOnlyNames").value.split(/\n|,/).map(name => name.trim()).filter(Boolean).forEach(name => {
      const user = {
        id: core.makeId("GUEST"), name, email: "", householdRole: "TripOnly", status: "Active",
        isTripOnly: true, createdAt: new Date().toISOString()
      };
      newUsers.push(user);
      members.push({
        id: core.makeId("TM"), tripId, userId: user.id, tripRole: "Member", membershipStatus: "Active",
        invitedByUserId: currentUser.id, joinedAt: null, addedAt: new Date().toISOString()
      });
    });
    const unique = new Set();
    members.forEach(member => {
      if (unique.has(member.userId)) throw new Error("A participant has been selected more than once.");
      unique.add(member.userId);
    });
    return { members, newUsers };
  }

  function renderTripReview() {
    const participants = [];
    $("tripHouseholdUsers").querySelectorAll("[data-trip-user]:checked").forEach(input => {
      const id = input.dataset.tripUser;
      const role = $("tripHouseholdUsers").querySelector('[data-trip-role="' + id + '"]').value;
      participants.push(userName(id) + " — " + (role === "Organizer" ? "Organizer" : "Member"));
    });
    $("tripOnlyNames").value.split(/\n|,/).map(name => name.trim()).filter(Boolean).forEach(name => participants.push(name + " — Trip-only participant"));
    $("tripWizardReview").innerHTML =
      '<section><h3>Trip details</h3><p><strong>' + safe($("tripName").value.trim()) + '</strong></p><p>' + safe($("tripDestination").value.trim() || "Destination not set") + '</p><p>' + safe($("tripStart").value || "Start date not set") + ' to ' + safe($("tripEnd").value || "End date not set") + '</p><p>Default currency: ' + safe($("tripCurrency").value) + '</p></section>' +
      '<section><h3>Participants (' + participants.length + ')</h3>' + (participants.length ? participants.map(name => '<p>' + safe(name) + '</p>').join("") : '<p>No participants selected. You can still manage the trip as Household Admin.</p>') + '</section>';
  }

  function setTripWizardStep(step) {
    tripWizardStep = Math.max(1, Math.min(3, step));
    document.querySelectorAll("[data-trip-step]").forEach(page => { page.hidden = Number(page.dataset.tripStep) !== tripWizardStep; });
    $("tripWizardProgress").textContent = ["Step 1 of 3 · Trip details","Step 2 of 3 · Currency and people","Step 3 of 3 · Review"][tripWizardStep - 1];
    $("tripWizardProgressFill").style.width = (tripWizardStep * 100 / 3) + "%";
    $("tripWizardBack").hidden = tripWizardStep === 1;
    $("tripWizardNext").hidden = tripWizardStep === 3;
    $("tripWizardSave").hidden = tripWizardStep !== 3;
    $("tripWizardSave").textContent = $("tripId").value ? "Save changes" : "Create trip";
    if (tripWizardStep === 3) renderTripReview();
  }

  function openTripForm(row) {
    if (row && !authz.canEditTripDetails(currentUser, row, data.tripMembers)) {
      addChat("You do not have permission to edit this trip.", "assistant");
      return;
    }
    if (!row && !authz.canCreateTrip(currentUser)) {
      addChat("Only the Household Admin can create a trip.", "assistant");
      return;
    }
    $("tripForm").reset();
    $("tripId").value = row && row.id || "";
    $("tripName").value = row && row.name || "";
    $("tripDestination").value = row && row.destination || "";
    $("tripStart").value = row && row.startDate || "";
    $("tripEnd").value = row && row.endDate || "";
    $("tripCurrency").value = row && row.currency || "AED";
    $("tripOnlyNames").value = "";
    $("tripDialogTitle").textContent = row && row.id ? "Edit trip details" : "Create a trip";
    const canManageMembers = authz.canManageTripMembers(currentUser, row || { status: "Planned" });
    $("tripParticipantAdminArea").hidden = !canManageMembers;
    $("tripMembershipReadOnlyNote").hidden = canManageMembers;
    renderTripHouseholdUsers(row || null);
    setTripWizardStep(1);
    $("tripDialog").showModal();
  }

  function openBudgetForm(row) {
    $("budgetForm").reset(); $("budgetId").value = row && row.id || "";
    $("budgetCategory").value = row && row.category || core.CATEGORIES[0];
    $("budgetAmount").value = row && row.amount || ""; $("budgetCurrency").value = row && row.currency || "AED";
    $("budgetDialogTitle").textContent = row && row.id ? "Edit budget" : "Set a budget";
    $("budgetDialog").showModal();
  }

function reportBucket(dateValue, mode) {
    const date = new Date(dateValue + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return null;
    if (mode === "day") return { key: dateValue, label: String(date.getUTCDate()) };
    if (mode === "week") {
      const monday = new Date(date); monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
      const key = monday.toISOString().slice(0,10);
      return { key, label: "Wk " + String(key).slice(5,7) + "/" + String(key).slice(8,10) };
    }
    const key = dateValue.slice(0,7);
    return { key, label: date.toLocaleDateString(undefined,{month:"short",timeZone:"UTC"}) };
  }

  function buildReportVisuals(rows) {
    const currencies = [...new Set(rows.map(txCurrency))].sort();
    if (!currencies.length) return '<p class="empty-report">There is no activity to chart for this period.</p>';
    return currencies.map(currency => {
      const currencyRows = rows.filter(row => txCurrency(row) === currency && row.date);
      if (!currencyRows.length) return "";
      const dates = currencyRows.map(row => new Date(row.date + "T12:00:00Z").getTime()).filter(Number.isFinite);
      const span = dates.length ? Math.ceil((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1 : 1;
      const mode = span <= 16 ? "day" : span <= 105 ? "week" : "month";
      const bucketMap = new Map();
      currencyRows.forEach(row => {
        const bucket = reportBucket(row.date, mode);
        if (!bucket) return;
        if (!bucketMap.has(bucket.key)) bucketMap.set(bucket.key,{...bucket,expense:0,income:0});
        const entry=bucketMap.get(bucket.key);
        entry[row.type === "Income" ? "income" : "expense"] += Number(row.amount || 0);
      });
      const buckets=[...bucketMap.values()].sort((a,b)=>a.key.localeCompare(b.key)).slice(-16);
      const max=Math.max(1,...buckets.flatMap(item=>[item.expense,item.income]));
      const width=720,height=210,left=22,right=12,top=18,bottom=34,plotW=width-left-right,plotH=height-top-bottom,groupW=plotW/Math.max(1,buckets.length);
      const barW=Math.min(13,groupW*.25),gap=Math.min(4,groupW*.08);
      const grid=[.25,.5,.75,1].map(frac=>'<line class="grid-line" x1="'+left+'" y1="'+(top+plotH*(1-frac)).toFixed(1)+'" x2="'+(width-right)+'" y2="'+(top+plotH*(1-frac)).toFixed(1)+'"/>').join("");
      const bars=buckets.map((item,i)=>{
        const center=left+groupW*(i+.5);
        const expenseH=item.expense/max*plotH, incomeH=item.income/max*plotH;
        const exX=center-barW-gap/2, inX=center+gap/2;
        return '<rect class="expense-bar" x="'+exX.toFixed(1)+'" y="'+(top+plotH-expenseH).toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(0,expenseH).toFixed(1)+'" rx="3"><title>Expenses '+safe(currency)+' '+safe(item.expense.toFixed(2))+'</title></rect>'+
          '<rect class="income-bar" x="'+inX.toFixed(1)+'" y="'+(top+plotH-incomeH).toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+Math.max(0,incomeH).toFixed(1)+'" rx="3"><title>Income '+safe(currency)+' '+safe(item.income.toFixed(2))+'</title></rect>'+
          '<text x="'+center.toFixed(1)+'" y="'+(height-10)+'" text-anchor="middle">'+safe(item.label)+'</text>';
      }).join("");
      return '<section class="report-chart-panel"><div class="report-currency-head"><span>'+safe(currency)+' · '+(mode==="day"?"Daily":mode==="week"?"Weekly":"Monthly")+' cash flow</span><span>'+buckets.length+' periods</span></div><svg class="report-trend-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+safe(currency)+' income and expense trend">'+grid+bars+'</svg><div class="report-trend-legend"><span><i></i>Expenses</span><span><i></i>Income</span></div></section>';
    }).join("");
  }

function runReport(period, selectedTripId) {
    const permittedRows = visibleTransactions();
    let start = "", end = "", rows = [];
    if (period === "custom") {
      start = $("reportFrom").value; end = $("reportTo").value;
      if (!start || !end || start > end) { addChat("Choose a valid report start and end date.", "assistant"); return; }
      rows = permittedRows.filter(row => row.date >= start && row.date <= end);
    } else if (period === "trip") {
      rows = permittedRows.filter(row => row.tripId && (!selectedTripId || row.tripId === selectedTripId));
      const trip = selectedTripId ? data.trips.find(item => item.id === selectedTripId) : null;
      if (selectedTripId && !authz.canViewTrip(currentUser, trip, data.tripMembers)) {
        addChat("That trip is not available to this identity.", "assistant");
        return;
      }
      start = trip && trip.startDate || ""; end = trip && trip.endDate || "";
    } else {
      const bounds = core.periodBounds(period); start = bounds.start; end = bounds.end;
      rows = permittedRows.filter(row => row.date >= start && row.date <= end);
    }
    reportRows = rows.slice().sort(compareDateDesc);
    const expenses = totals(reportRows, "Expense"), income = totals(reportRows, "Income");
    const countExpenses = reportRows.filter(row => row.type === "Expense").length, countIncome = reportRows.filter(row => row.type === "Income").length;
    const categoryByCurrency = {};
    reportRows.filter(row => row.type === "Expense").forEach(row => {
      const currency = txCurrency(row), category = row.category || "Other";
      if (!categoryByCurrency[currency]) categoryByCurrency[currency] = {};
      categoryByCurrency[currency][category] = (categoryByCurrency[currency][category] || 0) + Number(row.amount || 0);
    });
    const categoryGroups = Object.entries(categoryByCurrency).map(([currency,values]) => {
      const entries=Object.entries(values).sort((a,b)=>b[1]-a[1]);
      const groupTotal=entries.reduce((sum,item)=>sum+item[1],0);
      return '<section class="report-currency-group"><div class="report-currency-head"><span>'+safe(currency)+' · Category mix</span><span>'+safe(money(groupTotal,currency))+'</span></div>'+
        entries.map(([category,amount])=>'<div class="report-category-row"><div class="report-category-top"><span>'+safe(category)+'</span><strong>'+safe(money(amount,currency))+'</strong></div><div class="report-category-track"><span style="width:'+(groupTotal>0?amount/groupTotal*100:0).toFixed(1)+'%"></span></div></div>').join("")+'</section>';
    });
    const label = period === "trip" && selectedTripId ? "Trip: " + safe(tripName(selectedTripId)) : safe(start || "All dates") + (end ? " to " + safe(end) : "");
    const lines = [
      '<p class="report-period">'+label+'</p>',
      '<div class="report-summary-grid"><div><small>Expenses</small><strong>'+safe(formatTotals(expenses))+'</strong><span>'+countExpenses+' entries</span></div><div><small>Income</small><strong>'+safe(formatTotals(income))+'</strong><span>'+countIncome+' entries</span></div></div>',
      '<h3>Cash flow over time</h3>',
      buildReportVisuals(reportRows),
      '<h3>Where the money went</h3>',
      categoryGroups.length ? categoryGroups.join("") : '<p class="empty-report">No expense entries in this period.</p>'
    ];
    $("reportResult").innerHTML = lines.join("");
    $("reportResult").hidden = false;
    addChat("Report ready. " + countExpenses + " expense entries and " + countIncome + " income entries.", "assistant");
  }

    function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime }), url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }

  async function exportBackup() {
    if (!isAdminPreview()) throw new Error("Only the Household Admin can export the complete development backup.");
    const snapshot = await repository.readSnapshot();
    const payload = { application: "Ganathe Finance / Smart Ledger", schemaVersion: 2, exportedAt: new Date().toISOString(), ...snapshot };
    downloadFile("GanatheFinance-DEV-backup-" + today() + ".json", JSON.stringify(payload, null, 2), "application/json");
    addChat("Development backup exported. It is not encrypted; keep it as test data only.", "assistant");
  }

  async function importBackup(file) {
    if (!isAdminPreview()) throw new Error("Only the Household Admin can import a development backup.");
    let snapshot;
    try { snapshot = JSON.parse(await file.text()); } catch (_) { throw new Error("The selected file is not valid JSON."); }
    await repository.importSnapshot(snapshot); await loadData();
    addChat("Backup imported and merged with existing development records.", "assistant");
  }

  function exportCsv() {
    const rows = filterTransactions();
    if (!rows.length) { addChat("There are no transactions to export.", "assistant"); return; }
    const headers = ["TransactionID","Date","Type","Description","Category","Amount","Currency","PaymentType","PaidBy","Trip","Notes"];
    const csvRows = rows.map(row => [row.id,row.date,row.type,row.description,row.category,row.amount,row.currency,row.paymentType,row.paidBy,tripName(row.tripId),row.notes]);
    const csv = [headers,...csvRows].map(row => row.map(value => '"' + String(value == null ? "" : value).replace(/"/g,'""') + '"').join(",")).join("\r\n");
    downloadFile("GanatheFinance-transactions-" + today() + ".csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  }

  async function handleCommand(text) {
    addChat(text, "user");
    if (conversationState) {
      continueTransactionConversation(text);
      return;
    }
    const parsed = core.parseCommand(text, { currency: "AED", paidBy: "Me" });
    if (parsed.kind === "transaction_draft" || parsed.kind === "transaction_intent") {
      startTransactionConversation(parsed);
      return;
    }
    if (parsed.kind === "report" || parsed.kind === "trip_report") { runReport(parsed.period); return; }
    if (parsed.kind === "open_form") {
      if (parsed.form === "budget") openBudgetForm();
      else if (parsed.form === "trip") openTripForm();
      return;
    }
    addChat("I didn't quite catch that. Try “Add an expense”, “I received money from my brother”, or ask me for a spending report. I'll ask for any missing transaction details here in chat.", "assistant");
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short", year:"numeric" });
    document.querySelectorAll("[data-nav-target]").forEach(button => button.addEventListener("click", () => setActivePage(button.dataset.navTarget)));
    setActivePage("overview");
    $("txDate").value = today(); $("reportFrom").value = core.periodBounds("month").start; $("reportTo").value = today();
    setStatus("Development data · this browser", "local");
    try { await loadData(); } catch (error) { showError(error); }

    $("tripWizardNext").addEventListener("click", () => {
      if (tripWizardStep === 1) {
        const start = $("tripStart").value, end = $("tripEnd").value;
        if (!$("tripName").value.trim()) { addChat("Enter a trip name before continuing.", "assistant"); $("tripName").focus(); return; }
        if (start && end && start > end) { addChat("Trip end date must be on or after the start date.", "assistant"); $("tripEnd").focus(); return; }
      }
      setTripWizardStep(tripWizardStep + 1);
    });
    $("tripWizardBack").addEventListener("click", () => setTripWizardStep(tripWizardStep - 1));
    $("txTrip").addEventListener("change", () => {
      const trip = data.trips.find(item => item.id === $("txTrip").value);
      if (!$("txId").value && trip) $("txCurrency").value = trip.currency || "AED";
      populateSpentBySelect($("txSpentByUser").value || (currentUser && currentUser.id));
    });

    document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "expense") startQuickTransaction("Expense");
      if (action === "income") startQuickTransaction("Income");
      if (action === "trip") openTripForm();
      if (action === "budget") openBudgetForm();
    }));
    document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
    $("addExpenseLink").addEventListener("click", () => startQuickTransaction("Expense"));
    $("manualTransactionEntry").addEventListener("click", () => openTransactionForm({ type:"Expense" }));
    $("addTripLink").addEventListener("click", () => openTripForm());
    $("addBudgetLink").addEventListener("click", () => openBudgetForm());
    document.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => runReport(button.dataset.report)));
    $("customReportButton").addEventListener("click", () => runReport("custom"));
    document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => handleCommand(button.dataset.prompt)));
    $("chatForm").addEventListener("submit", event => {
      event.preventDefault(); const value = $("chatInput").value.trim();
      if (value) { $("chatInput").value = ""; handleCommand(value); }
    });
    ["transactionSearch","transactionTypeFilter","transactionCategoryFilter","transactionTripFilter"].forEach(id => {
      $(id).addEventListener(id === "transactionSearch" ? "input" : "change", renderTransactions);
    });

    $("transactionForm").addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const id = $("txId").value || core.makeId("TX"), existing = data.transactions.find(row => row.id === id);
        const row = {
          id, date:$("txDate").value, type:$("txType").value, description:$("txDescription").value.trim(),
          amount:core.normalizeAmount($("txAmount").value), currency:$("txCurrency").value, category:$("txCategory").value,
          paymentType:$("txPayment").value, paidBy:$("txPaidBy").value.trim(), tripId:$("txTrip").value,
          spentByUserId:$("txSpentByUser").value, recordedByUserId:existing && existing.recordedByUserId || currentUser.id,
          notes:$("txNotes").value.trim(), createdAt:existing && existing.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
        };
        if (!row.date || !row.description || !row.paidBy || !row.spentByUserId) throw new Error("Complete the date, description, paid-by and spender fields.");
        if (existing) {
          if (!authz.canEditTransaction(currentUser, existing, data.trips, data.tripMembers)) throw new Error("You do not have permission to edit this transaction.");
          const scopeChanged = row.tripId !== (existing.tripId || "");
          const spenderChanged = row.spentByUserId !== existing.spentByUserId;
          if ((scopeChanged || spenderChanged) && !authz.canCreateTransaction(currentUser, row, data.trips, data.tripMembers)) {
            throw new Error("You do not have permission to move this transaction or change its trip participant.");
          }
        } else if (!authz.canCreateTransaction(currentUser, row, data.trips, data.tripMembers)) {
          throw new Error("You do not have permission to add a transaction to this scope.");
        }
        if (existing) await repository.updateTransaction(row); else await repository.createTransaction(row);
        $("transactionDialog").close(); await loadData(); addChat(existing ? "Transaction updated." : "Transaction saved to the development ledger.", "assistant");
      } catch (error) { showError(error); }
    });

    $("tripForm").addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const id = $("tripId").value || core.makeId("TR"), existing = data.trips.find(row => row.id === id);
        if (existing && !authz.canEditTripDetails(currentUser, existing, data.tripMembers)) throw new Error("You do not have permission to edit this trip.");
        if (!existing && !authz.canCreateTrip(currentUser)) throw new Error("Only the Household Admin can create a trip.");
        const startDate = $("tripStart").value, endDate = $("tripEnd").value;
        if (startDate && endDate && startDate > endDate) throw new Error("Trip end date must be on or after the start date.");
        const row = {
          id, name:$("tripName").value.trim(), destination:$("tripDestination").value.trim(), startDate, endDate,
          currency:$("tripCurrency").value || "AED", status:existing && existing.status || "Planned",
          createdByUserId:existing && existing.createdByUserId || currentUser.id, updatedByUserId:currentUser.id,
          closedByUserId:existing && existing.closedByUserId || "", closedAt:existing && existing.closedAt || "",
          createdAt:existing && existing.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
        };
        if (!row.name) throw new Error("Enter a trip name.");
        const canManageMembers = authz.canManageTripMembers(currentUser, existing || { status: "Planned" });
        if (canManageMembers) {
          const selection = selectedTripMembers(id);
          if (existing) await repository.updateTrip(row, selection.members, selection.newUsers);
          else await repository.createTrip(row, selection.members, selection.newUsers);
        } else {
          await repository.updateTrip(row);
        }
        $("tripDialog").close();
        await loadData();
        addChat(existing ? "Trip details updated." : "Trip created. Add expenses to it when recording trip spending.", "assistant");
      } catch (error) { showError(error); }
    });

    $("budgetForm").addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const id = $("budgetId").value || core.makeId("BUD");
        const row = { id, category:$("budgetCategory").value, amount:core.normalizeAmount($("budgetAmount").value),
          currency:$("budgetCurrency").value, period:"Monthly", updatedAt:new Date().toISOString() };
        await repository.upsertBudget(row); $("budgetDialog").close(); await loadData(); addChat("Monthly budget saved.", "assistant");
      } catch (error) { showError(error); }
    });

    $("exportBackupButton").addEventListener("click", () => exportBackup().catch(showError));
    $("importBackupButton").addEventListener("click", () => $("importBackupInput").click());
    $("importBackupInput").addEventListener("change", async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try { if (confirm("Import and merge this development backup with the records in this browser?")) await importBackup(file); }
      catch (error) { showError(error); }
      finally { event.target.value = ""; }
    });
    $("exportCsvButton").addEventListener("click", exportCsv);
    $("txType").addEventListener("change", () => {
      const values = $("txType").value === "Income" ? core.INCOME_CATEGORIES : core.CATEGORIES;
      const selected = $("txCategory").value;
      $("txCategory").innerHTML = values.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
      if (values.includes(selected)) $("txCategory").value = selected;
    });
    window.addEventListener("storage", event => {
      if (event.key === repository.getInfo().key) loadData().catch(showError);
    });
  });
})();