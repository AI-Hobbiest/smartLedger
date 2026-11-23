(function (root) {
  "use strict";
  const CATEGORIES = ["Food / Eat out", "Grocery", "Travel", "Apparel", "Devotional", "Spiritual", "Investments", "Misc / Others"];
  const INCOME_CATEGORIES = ["Salary", "Other income", "Refund", "Misc / Others"];
  const CURRENCY_CODES = ["AED", "INR", "USD", "OMR", "SGD", "EUR", "GBP"];
  const PAYMENT_TYPES = ["Cash", "Debit Card", "Credit Card", "Bank Transfer", "Digital Wallet", "Other"];

  function makeId(prefix) {
    const random = (root.crypto && root.crypto.randomUUID)
      ? root.crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return (prefix || "SL") + "-" + random;
  }

  function normalizeAmount(value) {
    const amount = Number(String(value).replace(/[, ]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter an amount greater than zero.");
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function localDateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function parseDate(text, now) {
    const base = now ? new Date(now) : new Date();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    const lower = String(text || "").toLowerCase();
    if (/\bday before yesterday\b/.test(lower)) d.setDate(d.getDate() - 2);
    else if (/\byesterday\b/.test(lower)) d.setDate(d.getDate() - 1);
    else if (/\btomorrow\b/.test(lower)) d.setDate(d.getDate() + 1);
    else {
      const match = lower.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
      if (match) {
        let year = match[3] ? Number(match[3]) : d.getFullYear();
        if (year < 100) year += 2000;
        const parsed = new Date(year, Number(match[2]) - 1, Number(match[1]));
        if (parsed.getFullYear() === year && parsed.getMonth() === Number(match[2]) - 1 && parsed.getDate() === Number(match[1])) return localDateISO(parsed);
      }
    }
    return localDateISO(d);
  }

  function inferCategory(text, type) {
    const value = String(text || "").toLowerCase();
    if (type === "Income") {
      if (/salary|payroll/.test(value)) return "Salary";
      if (/refund|reimburs/.test(value)) return "Refund";
      return "Other income";
    }
    const rules = [
      [/grocery|supermarket|carrefour|lulu|spinneys|vegetable|fruit|hypermarket|milk/, "Grocery"],
      [/restaurant|dinner|lunch|breakfast|coffee|food|eat|meal|snack/, "Food / Eat out"],
      [/flight|hotel|taxi|uber|careem|metro|travel|petrol|fuel|bus|train/, "Travel"],
      [/shirt|shoe|clothes|apparel|dress/, "Apparel"],
      [/temple|hundi|donation|devotional|offering/, "Spiritual"],
      [/investment|stock|mutual fund|sip/, "Investments"]
    ];
    for (const [pattern, category] of rules) if (pattern.test(value)) return category;
    return "Misc / Others";
  }

  function parseCommand(input, defaults) {
    const text = String(input || "").trim();
    if (!text) return { kind: "unknown", reason: "empty" };
    const lower = text.toLowerCase();
    const reportWords = /\b(report|summary|total|how much|show|list|spending|expenses)\b/.test(lower);
    if (reportWords && /\b(today|yesterday|this week|week|this month|month|quarter|year|annual|trip|expenses|spending)\b/.test(lower) &&
        !/\b(spent|paid|bought|purchase|expense of)\s+(?:aed|inr|usd|omr|sgd|eur|gbp)?\s*\d/i.test(lower)) {
      const period = /\btoday\b/.test(lower) ? "today" :
        /\byesterday\b/.test(lower) ? "yesterday" :
        /\b(this week|week)\b/.test(lower) ? "week" :
        /\b(quarter|this quarter)\b/.test(lower) ? "quarter" :
        /\b(year|annual|this year)\b/.test(lower) ? "year" :
        /\btrip\b/.test(lower) ? "trip" : "month";
      return { kind: period === "trip" ? "trip_report" : "report", period, sourceText: text };
    }

    const amountPattern = /(?:\b(AED|DHS?|DIRHAMS?|INR|RS\.?|RUPEES?|USD|OMR|SGD|EUR|GBP)\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)(?:\s*(AED|DHS?|DIRHAMS?|INR|RS\.?|RUPEES?|USD|OMR|SGD|EUR|GBP))?/i;
    const amountMatch = text.match(amountPattern);
    const income = /\b(received|salary|income|earned|credited|reimbursement|refund)\b/i.test(text);
    const type = income ? "Income" : "Expense";

    if (amountMatch && /\b(spent|paid|bought|purchase|received|salary|earned|credited|reimbursement|refund|income|expense)\b/i.test(text)) {
      const amount = normalizeAmount(amountMatch[2]);
      const code = String(amountMatch[1] || amountMatch[3] || (defaults && defaults.currency) || "AED").toUpperCase();
      const currency = /^(INR|RS\.?|RUPEES?)$/.test(code) ? "INR" :
        /^(DHS?|DIRHAMS?)$/.test(code) ? "AED" : CURRENCY_CODES.includes(code) ? code : "AED";
      const cleaned = text.replace(amountMatch[0], " ")
        .replace(/\b(i|we|my|our|spent|paid|bought|purchase|received|salary|income|earned|credited|reimbursement|refund|expense|of|for|on|at|in|using|with|today|yesterday|tomorrow|day before yesterday|this)\b/gi, " ")
        .replace(/\b(aed|dhs?|dirhams?|inr|rs\.?|rupees?|usd|omr|sgd|eur|gbp)\b|\$/gi, " ")
        .replace(/\b(cash|credit card|debit card|bank transfer|digital wallet|wallet|cc|dc)\b/gi, " ")
        .replace(/\s+/g, " ").replace(/^[\s,.-]+|[\s,.-]+$/g, "").trim();
      const description = cleaned || (income ? "Income" : "Expense");
      const paymentType = /credit card|\bcc\b/i.test(text) ? "Credit Card" :
        /debit card|\bdc\b/i.test(text) ? "Debit Card" :
        /bank transfer|transferred/i.test(text) ? "Bank Transfer" :
        /wallet|apple pay|google pay/i.test(text) ? "Digital Wallet" :
        /\bcash\b/i.test(text) ? "Cash" : "Other";
      return {
        kind: "transaction_draft",
        transaction: {
          id: makeId("TX"),
          date: parseDate(text, defaults && defaults.now),
          type, amount, currency,
          description: description.charAt(0).toUpperCase() + description.slice(1),
          category: inferCategory(text + " " + description, type),
          paidBy: (defaults && defaults.paidBy) || "Me",
          paymentType,
          tripId: (defaults && defaults.tripId) || "",
          notes: "",
          sourceText: text
        }
      };
    }

    if (/\b(add|record|new)\b/.test(lower) && /\b(income|salary|received)\b/.test(lower)) return { kind: "open_form", form: "income" };
    if (/\b(add|record|new)\b/.test(lower) && /\b(expense|transaction)\b/.test(lower)) return { kind: "open_form", form: "expense" };
    if (/\bbudget\b/.test(lower)) return { kind: "open_form", form: "budget" };
    if (/\btrip\b/.test(lower) && /\b(create|add|new)\b/.test(lower)) return { kind: "open_form", form: "trip" };
    return { kind: "unknown", reason: "not_understood", sourceText: text };
  }

  function periodBounds(period, nowValue) {
    const now = nowValue ? new Date(nowValue) : new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === "today") start.setDate(now.getDate());
    else if (period === "yesterday") start.setDate(start.getDate() - 1);
    else if (period === "week") start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    else if (period === "quarter") start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
    else if (period === "year") start.setMonth(0, 1);
    const end = period === "yesterday"
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: localDateISO(start), end: localDateISO(end) };
  }

  function summarize(transactions, period, now) {
    const bounds = periodBounds(period, now);
    const rows = (transactions || []).filter(t => String(t.date || "") >= bounds.start && String(t.date || "") <= bounds.end && String(t.type).toLowerCase() !== "income");
    const totalByCurrency = {};
    rows.forEach(row => { const code = row.currency || "AED"; totalByCurrency[code] = (totalByCurrency[code] || 0) + Number(row.amount || 0); });
    return { count: rows.length, totalByCurrency, bounds, rows };
  }

  root.SmartLedgerCore = { CATEGORIES, INCOME_CATEGORIES, CURRENCY_CODES, PAYMENT_TYPES, makeId, normalizeAmount, localDateISO, parseDate, inferCategory, parseCommand, periodBounds, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SmartLedgerCore;
})(typeof window !== "undefined" ? window : globalThis);