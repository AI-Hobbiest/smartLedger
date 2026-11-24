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

  function renderTransactions() {
    const host = $("transactionList"), rows = filterTransactions();
    $("transactionCount").textContent = rows.length + " visible of " + visibleTransactions().length + " transactions";
    if (!rows.length) { host.innerHTML = '<div class="empty-state">No transactions available for this identity. Try another filter or add an entry.</div>'; return; }
    host.innerHTML = rows.slice(0, 100).map(row => {
      const isIncome = row.type === "Income";
      const trip = row.tripId ? " · " + safe(tripName(row.tripId) || "Trip") : "";
      const mayEdit = authz.canEditTransaction(currentUser, row, data.trips, data.tripMembers);
      const mayDelete = authz.canDeleteTransaction(currentUser, row, data.trips, data.tripMembers);
      const actions = (mayEdit ? '<button type="button" data-edit-tx="' + safe(row.id) + '">Edit</button>' : '') +
        (mayDelete ? '<button type="button" data-delete-tx="' + safe(row.id) + '">Delete</button>' : '');
      return '<article class="transaction-item managed-transaction"><div class="item-main"><span class="item-icon">' + (isIncome ? "↗" : "↘") + '</span><div class="item-copy"><strong>' + safe(row.description) + '</strong><small>' + safe(row.category) + ' · ' + safe(row.date) + trip + '</small><small>' + safe(row.paymentType || "Other") + ' · ' + safe(row.paidBy || userName(row.spentByUserId)) + '</small></div></div><div class="transaction-side"><span class="item-amount ' + (isIncome ? "income" : "") + '">' + (isIncome ? "+" : "−") + safe(money(row.amount, row.currency)) + '</span><div class="row-actions">' + actions + '</div></div></article>';
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
    if (!trips.length) { host.innerHTML = '<div class="empty-state">No trips are assigned to this identity.</div>'; return; }
    host.innerHTML = trips.slice().sort((a,b) => String(b.startDate || "").localeCompare(String(a.startDate || ""))).map(trip => {
      const linked = visibleTransactions().filter(row => row.tripId === trip.id && row.type === "Expense");
      const mayEdit = authz.canEditTripDetails(currentUser, trip, data.tripMembers);
      const mayClose = authz.canCloseTrip(currentUser, trip);
      const actions = (mayEdit ? '<button type="button" data-edit-trip="' + safe(trip.id) + '">Edit details</button>' : '') +
        (mayClose ? '<button type="button" data-close-trip="' + safe(trip.id) + '">Close trip</button>' : '') +
        '<button type="button" data-trip-report="' + safe(trip.id) + '">Report</button>';
      return '<article class="trip-item"><div><strong>' + safe(trip.name) + '</strong><small>' + safe(trip.destination || "Destination not set") + (trip.startDate ? " · " + safe(trip.startDate) : "") + '</small><small>' + linked.length + ' expense entries · ' + safe(formatTotals(totals(linked))) + '</small><small>Default currency: ' + safe(trip.currency || "AED") + '</small></div><div class="trip-actions"><span class="trip-badge">' + safe(trip.status || "Planned") + '</span>' + actions + '</div></article>';
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
    if (!data.budgets.length) { host.innerHTML = '<div class="empty-state">No monthly budgets set.</div>'; return; }
    host.innerHTML = data.budgets.slice().sort((a,b) => a.category.localeCompare(b.category)).map(budget => {
      const spent = currentMonthBudgetSpent(budget), limit = Number(budget.amount || 0), percent = limit > 0 ? spent / limit * 100 : 0;
      const width = Math.min(100, Math.max(0, percent)), state = percent >= 100 ? "over" : percent >= 80 ? "near" : "safe";
      return '<article class="budget-item"><div class="budget-heading"><strong>' + safe(budget.category) + '</strong><span>' + safe(money(spent, budget.currency)) + ' / ' + safe(money(limit, budget.currency)) + '</span></div><div class="budget-track"><span class="' + state + '" style="width:' + width.toFixed(1) + '%"></span></div><div class="budget-foot"><small>' + Math.round(percent) + '% used</small><span class="row-actions"><button type="button" data-edit-budget="' + safe(budget.id) + '">Edit</button><button type="button" data-delete-budget="' + safe(budget.id) + '">Delete</button></span></div></article>';
    }).join("");
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
        const transaction = { ...currentDraft, id: core.makeId("TX"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
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

  function openTransactionForm(row) {
    const form = $("transactionForm"); form.reset();
    $("txId").value = row && row.id || "";
    $("txType").value = row && row.type || "Expense";
    $("txDate").value = row && row.date || today();
    $("txDescription").value = row && row.description || "";
    $("txAmount").value = row && row.amount || "";
    $("txCurrency").value = row && row.currency || "AED";
    const categoryOptions = $("txType").value === "Income" ? core.INCOME_CATEGORIES : core.CATEGORIES;
    $("txCategory").innerHTML = categoryOptions.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join("");
    $("txCategory").value = row && row.category || (categoryOptions[0] || "Misc / Others");
    $("txPayment").value = row && row.paymentType || "Other";
    $("txPaidBy").value = row && row.paidBy || "Me";
    $("txTrip").value = row && row.tripId || "";
    $("txNotes").value = row && row.notes || "";
    $("transactionDialogTitle").textContent = row && row.id ? "Edit transaction" : $("txType").value === "Income" ? "Add income" : "Add expense";
    $("transactionDialog").showModal();
  }

  function openTripForm(row) {
    $("tripForm").reset(); $("tripId").value = row && row.id || "";
    $("tripName").value = row && row.name || ""; $("tripDestination").value = row && row.destination || "";
    $("tripStart").value = row && row.startDate || ""; $("tripEnd").value = row && row.endDate || "";
    $("tripMembers").value = row && row.members || ""; $("tripStatus").value = row && row.status || "Planned";
    $("tripDialogTitle").textContent = row && row.id ? "Edit trip" : "Create a trip";
    $("tripDialog").showModal();
  }

  function openBudgetForm(row) {
    $("budgetForm").reset(); $("budgetId").value = row && row.id || "";
    $("budgetCategory").value = row && row.category || core.CATEGORIES[0];
    $("budgetAmount").value = row && row.amount || ""; $("budgetCurrency").value = row && row.currency || "AED";
    $("budgetDialogTitle").textContent = row && row.id ? "Edit budget" : "Set a budget";
    $("budgetDialog").showModal();
  }

  function runReport(period, selectedTripId) {
    let start = "", end = "", rows = [];
    if (period === "custom") {
      start = $("reportFrom").value; end = $("reportTo").value;
      if (!start || !end || start > end) { addChat("Choose a valid report start and end date.", "assistant"); return; }
      rows = data.transactions.filter(row => row.date >= start && row.date <= end);
    } else if (period === "trip") {
      rows = data.transactions.filter(row => row.tripId && (!selectedTripId || row.tripId === selectedTripId));
      const trip = selectedTripId ? data.trips.find(item => item.id === selectedTripId) : null;
      start = trip && trip.startDate || ""; end = trip && trip.endDate || "";
    } else {
      const bounds = core.periodBounds(period); start = bounds.start; end = bounds.end;
      rows = data.transactions.filter(row => row.date >= start && row.date <= end);
    }
    reportRows = rows.slice().sort(compareDateDesc);
    const expenses = totals(reportRows, "Expense"), income = totals(reportRows, "Income");
    const countExpenses = reportRows.filter(row => row.type === "Expense").length, countIncome = reportRows.filter(row => row.type === "Income").length;
    const lines = [
      '<div class="report-summary-grid"><div><small>Expenses</small><strong>' + safe(formatTotals(expenses)) + '</strong><span>' + countExpenses + ' entries</span></div><div><small>Income</small><strong>' + safe(formatTotals(income)) + '</strong><span>' + countIncome + ' entries</span></div></div>'
    ];
    const categoryTotals = {};
    reportRows.filter(row => row.type === "Expense").forEach(row => {
      const key = row.category + "||" + txCurrency(row);
      categoryTotals[key] = (categoryTotals[key] || 0) + Number(row.amount || 0);
    });
    const categories = Object.entries(categoryTotals).sort((a,b) => b[1] - a[1]);
    if (categories.length) lines.push('<h3>Expense breakdown</h3><div class="report-breakdown">' + categories.map(([key,amount]) => {
      const parts = key.split("||");
      return '<div><span>' + safe(parts[0]) + '</span><strong>' + safe(money(amount,parts[1])) + '</strong></div>';
    }).join("") + '</div>');
    else lines.push('<p class="empty-report">No expense entries in this period.</p>');
    lines.unshift('<p class="report-period">' + (period === "trip" && selectedTripId ? "Trip: " + safe(tripName(selectedTripId)) : safe(start || "All dates") + (end ? " to " + safe(end) : "")) + '</p>');
    $("reportResult").innerHTML = lines.join(""); $("reportResult").hidden = false;
    addChat("Report ready. " + countExpenses + " expense entries and " + countIncome + " income entries.", "assistant");
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime }), url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }

  async function exportBackup() {
    const snapshot = await repository.readSnapshot();
    const payload = { application: "Ganathe Finance / Smart Ledger", schemaVersion: 1, exportedAt: new Date().toISOString(), ...snapshot };
    downloadFile("GanatheFinance-DEV-backup-" + today() + ".json", JSON.stringify(payload, null, 2), "application/json");
    addChat("Development backup exported. It is not encrypted; keep it as test data only.", "assistant");
  }

  async function importBackup(file) {
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
    $("txDate").value = today(); $("reportFrom").value = core.periodBounds("month").start; $("reportTo").value = today();
    setStatus("Development data · this browser", "local");
    try { await loadData(); } catch (error) { showError(error); }

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
          notes:$("txNotes").value.trim(), createdAt:existing && existing.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
        };
        if (!row.date || !row.description || !row.paidBy) throw new Error("Complete the date, description and paid-by fields.");
        if (existing) await repository.updateTransaction(row); else await repository.createTransaction(row);
        $("transactionDialog").close(); await loadData(); addChat(existing ? "Transaction updated." : "Transaction saved to the development ledger.", "assistant");
      } catch (error) { showError(error); }
    });

    $("tripForm").addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const id = $("tripId").value || core.makeId("TR"), existing = data.trips.find(row => row.id === id);
        const startDate = $("tripStart").value, endDate = $("tripEnd").value;
        if (startDate && endDate && startDate > endDate) throw new Error("Trip end date must be on or after the start date.");
        const row = {
          id, name:$("tripName").value.trim(), destination:$("tripDestination").value.trim(), startDate,endDate,
          members:$("tripMembers").value.split(",").map(value=>value.trim()).filter(Boolean).join(" | "),
          status:$("tripStatus").value, createdAt:existing && existing.createdAt || new Date().toISOString(), updatedAt:new Date().toISOString()
        };
        if (!row.name) throw new Error("Enter a trip name.");
        if (existing) await repository.updateTrip(row); else await repository.createTrip(row);
        $("tripDialog").close(); await loadData(); addChat(existing ? "Trip updated." : "Trip created. Attach expenses to it when recording them.", "assistant");
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