(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = "ganathe.smartledger.preview.v1";
  const core = window.SmartLedgerCore;
  let transactions = [];
  let trips = [];
  let oneDrive = null;
  let currentDraft = null;

  const money = (amount, currency) => (currency || "AED") + " " + Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const safe = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  const today = () => new Date().toISOString().slice(0, 10);

  function setStatus(state, label) {
    $("syncStatus").dataset.state = state;
    $("syncText").textContent = label;
  }
  function persistPreview() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions, trips })); } catch (error) { console.warn("Preview storage unavailable", error); }
  }
  function loadPreview() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      transactions = Array.isArray(saved.transactions) ? saved.transactions : [];
      trips = Array.isArray(saved.trips) ? saved.trips : [];
    } catch (_) { transactions = []; trips = []; }
  }
  function normalizeTransaction(row) {
    return {
      id: row.ID || row.TransactionID || row.id,
      date: row.Date || row.date,
      type: row.Type || row.type || "Expense",
      description: row.Description || row.description || "",
      category: row.Category || row.category || "Misc / Others",
      amount: Number(row.Amount || row.amount || 0),
      currency: row.Currency || row.currency || "AED",
      paymentType: row["Payment Method"] || row.PaymentType || row.paymentType || "Other",
      paidBy: row["Paid By"] || row.PaidBy || row.paidBy || "Me",
      tripId: row.Trip || row.TripID || row.tripId || "",
      splitMode: row.SplitMode || row.splitMode || "Equal",
      splitMembers: row["Shared With"] || row.SplitMembers || row.splitMembers || "",
      notes: row.Notes || row.notes || ""
    };
  }
  function normalizeTrip(row) {
    return { id: row.ID || row.TripID || row.id, name: row.Trip || row.TripName || row.name || "", destination: row.Destination || row.destination || "", startDate: row["Start Date"] || row.StartDate || row.startDate || "", endDate: row["End Date"] || row.EndDate || row.endDate || "", status: row.Status || row.status || "Active", members: row.Participants || row.Members || row.members || "" };
  }
  function refreshFromRows(data) {
    transactions = (data.transactions || []).map(normalizeTransaction);
    trips = (data.trips || []).map(normalizeTrip);
    render();
  }
  function currentMonthRows(type) {
    const prefix = today().slice(0, 7);
    return transactions.filter(row => String(row.date || "").slice(0, 7) === prefix && (!type || String(row.type).toLowerCase() === type.toLowerCase()));
  }
  function groupTotals(rows) {
    return rows.reduce((acc, row) => { const c = row.currency || "AED"; acc[c] = (acc[c] || 0) + Number(row.amount || 0); return acc; }, {});
  }
  function formatTotals(totals) {
    const keys = Object.keys(totals);
    if (!keys.length) return "AED 0.00";
    return keys.slice(0, 2).map(c => money(totals[c], c)).join(" · ");
  }
  function render() {
    const expenses = groupTotals(currentMonthRows("Expense"));
    const income = groupTotals(currentMonthRows("Income"));
    $("monthSpend").textContent = formatTotals(expenses);
    $("monthIncome").textContent = formatTotals(income);
    $("monthSpendHint").textContent = currentMonthRows("Expense").length + " expense entries";
    $("activeTrips").textContent = trips.filter(t => (t.status || "Active").toLowerCase() === "active").length;
    renderTransactions();
    renderTrips();
    populateTripSelect();
  }
  function renderTransactions() {
    const host = $("transactionList");
    const recent = transactions.slice().sort((a,b) => String(b.date).localeCompare(String(a.date))).slice(0, 7);
    if (!recent.length) { host.innerHTML = '<div class="empty-state">No transactions yet. Add your first expense to get started.</div>'; return; }
    host.innerHTML = recent.map(row => '<div class="transaction-item"><div class="item-main"><span class="item-icon">' + (row.type === "Income" ? "↗" : "↘") + '</span><div class="item-copy"><strong>' + safe(row.description) + '</strong><small>' + safe(row.category) + ' · ' + safe(row.date) + (row.tripId ? ' · Trip' : '') + '</small></div></div><span class="item-amount ' + (row.type === "Income" ? "income" : "") + '">' + (row.type === "Income" ? "+" : "−") + safe(money(row.amount, row.currency)) + '</span></div>').join("");
  }
  function renderTrips() {
    const host = $("tripList");
    if (!trips.length) { host.innerHTML = '<div class="empty-state">Your trips will appear here.</div>'; return; }
    host.innerHTML = trips.slice().sort((a,b) => String(b.startDate).localeCompare(String(a.startDate))).slice(0, 5).map(t => '<div class="trip-item"><div><strong>' + safe(t.name) + '</strong><small>' + safe(t.destination || "Destination not set") + (t.startDate ? ' · ' + safe(t.startDate) : '') + '</small></div><span class="trip-badge">' + safe(t.status || "Active") + '</span></div>').join("");
  }
  function populateTripSelect() {
    const select = $("txTrip");
    const selected = select.value;
    select.innerHTML = '<option value="">Personal / non-trip</option>' + trips.map(t => '<option value="' + safe(t.name) + '">' + safe(t.name) + '</option>').join("");
    if (trips.some(t => t.name === selected)) select.value = selected;
  }
  function addChat(text, who) {
    const wrapper = document.createElement("div");
    wrapper.className = "chat-message " + (who === "user" ? "user" : "assistant");
    if (who !== "user") {
      const avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = "GL"; wrapper.appendChild(avatar);
    }
    const body = document.createElement("div"); body.className = "message-body"; body.textContent = text; wrapper.appendChild(body);
    $("chatStream").appendChild(wrapper);
    $("chatStream").scrollTop = $("chatStream").scrollHeight;
  }
  function showDraft(draft) {
    currentDraft = draft;
    const row = draft.transaction;
    const wrap = document.createElement("div");
    wrap.className = "chat-message assistant";
    const avatar = document.createElement("span"); avatar.className = "avatar"; avatar.textContent = "GL";
    const body = document.createElement("div"); body.className = "message-body";
    body.innerHTML = '<p><strong>Please review this transaction.</strong></p><p>' + safe(row.type) + ' · ' + safe(money(row.amount,row.currency)) + '</p><p>' + safe(row.description) + ' · ' + safe(row.category) + '</p><p>' + safe(row.date) + ' · Paid by ' + safe(row.paidBy) + '</p>';
    const actions = document.createElement("div"); actions.className = "draft-actions";
    const confirm = document.createElement("button"); confirm.type = "button"; confirm.className = "button button-primary button-small"; confirm.textContent = "Confirm & save";
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "button button-outline button-small"; edit.textContent = "Edit";
    confirm.addEventListener("click", async () => { await saveTransaction(row); currentDraft = null; addChat("Saved. Your ledger has been updated.", "assistant"); });
    edit.addEventListener("click", () => { openTransactionForm(row); currentDraft = null; });
    actions.append(confirm, edit); body.appendChild(actions); wrap.append(avatar, body); $("chatStream").appendChild(wrap); $("chatStream").scrollTop = $("chatStream").scrollHeight;
  }
  function runReport(period) {
    let rows = transactions;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "today") start.setHours(0,0,0,0);
    else if (period === "yesterday") { start.setDate(start.getDate()-1); start.setHours(0,0,0,0); }
    else if (period === "week") { start.setDate(start.getDate()-((start.getDay()+6)%7)); start.setHours(0,0,0,0); }
    const end = new Date(now); end.setHours(23,59,59,999);
    if (period === "yesterday") end.setTime(start.getTime()+86399999);
    rows = rows.filter(t => {
      const d = new Date(String(t.date || "") + "T12:00:00");
      return d >= start && d <= end && String(t.type).toLowerCase() !== "income" && (!Number.isNaN(d.getTime()));
    });
    if (period === "trip") rows = transactions.filter(t => t.tripId);
    const totals = groupTotals(rows);
    const count = rows.length;
    const headline = period === "trip" ? "Trip expenses" : period === "today" ? "Today's expenses" : period === "yesterday" ? "Yesterday's expenses" : period === "week" ? "This week's expenses" : "This month's expenses";
    const summary = headline + ": " + formatTotals(totals) + " across " + count + " transaction" + (count === 1 ? "" : "s") + ".";
    $("reportResult").hidden = false;
    $("reportResult").textContent = summary;
    addChat(summary, "assistant");
  }
  function openTransactionForm(row) {
    const form = $("transactionForm"); form.reset();
    $("txType").value = row && row.type || "Expense";
    $("txDate").value = row && row.date || today();
    $("txDescription").value = row && row.description || "";
    $("txAmount").value = row && row.amount || "";
    $("txCurrency").value = row && row.currency || "AED";
    $("txCategory").value = row && row.category || "Misc / Others";
    $("txPayment").value = row && row.paymentType || "Other";
    $("txPaidBy").value = row && row.paidBy || "Me";
    $("txTrip").value = row && row.tripId || "";
    $("txNotes").value = row && row.notes || "";
    $("transactionDialogTitle").textContent = $("txType").value === "Income" ? "Add income" : "Add expense";
    $("transactionDialog").showModal();
  }
  async function saveTransaction(row) {
    const transaction = { ...row, id: row.id || core.makeId("TX"), createdAt: new Date().toISOString() };
    try {
      if (oneDrive) {
        await oneDrive.addTransaction(transaction);
        const data = await oneDrive.readAll(); refreshFromRows(data);
        setStatus("connected", "OneDrive · saved");
      } else {
        transactions.unshift(transaction); persistPreview(); render();
      }
    } catch (error) {
      setStatus("error", "Save failed");
      addChat(error.message || "The transaction could not be saved.", "assistant");
      throw error;
    }
  }
  async function saveTrip(row) {
    const trip = { ...row, id: core.makeId("TR"), status: "Active" };
    try {
      if (oneDrive) {
        await oneDrive.addTrip(trip);
        const data = await oneDrive.readAll(); refreshFromRows(data);
        setStatus("connected", "OneDrive · saved");
      } else {
        trips.unshift(trip); persistPreview(); render();
      }
      addChat("Trip created: " + trip.name + ". You can now attach expenses to it.", "assistant");
    } catch (error) {
      setStatus("error", "Save failed");
      addChat(error.message || "The trip could not be saved.", "assistant");
    }
  }
  async function connectOneDrive() {
    try {
      if (!window.GanatheOneDrive) throw new Error("OneDrive components did not load. Refresh the page and try again.");
      const candidate = new window.GanatheOneDrive();
      if (!candidate.isConfigured()) throw new Error("OneDrive sign-in needs a Microsoft app registration Client ID. See docs/ONEDRIVE-SETUP.md.");
      setStatus("local", "Connecting…");
      const profile = await candidate.signIn();
      const data = await candidate.ensureWorkbook();
      oneDrive = candidate;
      refreshFromRows(data);
      setStatus("connected", "OneDrive · " + (profile.name || "connected"));
      addChat("Connected to OneDrive. Your workbook is ready.", "assistant");
    } catch (error) {
      setStatus("error", "OneDrive not connected");
      addChat(error.message || "Could not connect to OneDrive.", "assistant");
      alert(error.message || "Could not connect to OneDrive.");
    }
  }
  async function handleCommand(text) {
    addChat(text, "user");
    const parsed = core.parseCommand(text, { currency: "AED", paidBy: "Me" });
    if (parsed.kind === "transaction_draft") { showDraft(parsed); return; }
    if (parsed.kind === "report" || parsed.kind === "trip_report") { runReport(parsed.period); return; }
    if (parsed.kind === "open_form") { openTransactionForm({ type: parsed.form === "income" ? "Income" : "Expense" }); return; }
    addChat("I couldn't confidently interpret that. You can use Add expense, Add income, Reports or the Trip form below.", "assistant");
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("todayLabel").textContent = new Date().toLocaleDateString(undefined, { weekday:"short", day:"numeric", month:"short", year:"numeric" });
    $("txDate").value = today();
    $("txCategory").innerHTML = core.CATEGORIES.map(c => '<option>' + safe(c) + '</option>').join("");
    loadPreview(); render();
    document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.action;
      if (action === "expense") openTransactionForm({ type:"Expense" });
      if (action === "income") openTransactionForm({ type:"Income" });
      if (action === "trip") $("tripDialog").showModal();
      if (action === "reports") $("reportsPanel").scrollIntoView({ behavior:"smooth", block:"center" });
    }));
    document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => $(button.dataset.close).close()));
    $("addExpenseLink").addEventListener("click", () => openTransactionForm({ type:"Expense" }));
    $("addTripLink").addEventListener("click", () => $("tripDialog").showModal());
    $("connectButton").addEventListener("click", connectOneDrive);
    $("connectCardButton").addEventListener("click", connectOneDrive);
    document.querySelectorAll("[data-report]").forEach(button => button.addEventListener("click", () => runReport(button.dataset.report)));
    document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => handleCommand(button.dataset.prompt)));
    $("chatForm").addEventListener("submit", event => { event.preventDefault(); const value = $("chatInput").value.trim(); if (value) { $("chatInput").value = ""; handleCommand(value); } });
    $("transactionForm").addEventListener("submit", async event => {
      event.preventDefault();
      const row = { type:$("txType").value, date:$("txDate").value, description:$("txDescription").value.trim(), amount:core.normalizeAmount($("txAmount").value), currency:$("txCurrency").value, category:$("txCategory").value, paymentType:$("txPayment").value, paidBy:$("txPaidBy").value.trim(), tripId:$("txTrip").value, splitMode:"Equal", splitMembers:"", notes:$("txNotes").value.trim() };
      try { await saveTransaction(row); $("transactionDialog").close(); } catch (_) {}
    });
    $("tripForm").addEventListener("submit", async event => {
      event.preventDefault();
      const row = { name:$("tripName").value.trim(), destination:$("tripDestination").value.trim(), startDate:$("tripStart").value, endDate:$("tripEnd").value, members:$("tripMembers").value.split(",").map(x=>x.trim()).filter(Boolean).join(" | ") };
      await saveTrip(row); $("tripDialog").close(); $("tripForm").reset();
    });
  });
})();
