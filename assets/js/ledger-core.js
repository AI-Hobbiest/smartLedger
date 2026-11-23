/* Pure business helpers. Kept provider- and storage-independent. */
(function (root) {
  "use strict";

  const CATEGORIES = ["Food / Eat out", "Grocery", "Travel", "Apparel", "Devotional", "Spiritual", "Investments", "Misc / Others"];
  const CURRENCY_CODES = ["AED", "INR", "USD", "OMR", "SGD", "EUR", "GBP"];

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

  function inferCategory(text) {
    const s = String(text || "").toLowerCase();
    const rules = [
      [/grocery|supermarket|carrefour|lulu|spinneys|vegetable|fruit/, "Grocery"],
      [/restaurant|dinner|lunch|breakfast|coffee|food|eat|meal/, "Food / Eat out"],
      [/flight|hotel|taxi|uber|careem|metro|travel|petrol|fuel/, "Travel"],
      [/shirt|shoe|clothes|apparel|dress/, "Apparel"],
      [/temple|hundi|donation|devotional/, "Devotional"],
      [/investment|stock|mutual fund|sip/, "Investments"]
    ];
    for (const [pattern, category] of rules) if (pattern.test(s)) return category;
    return "Misc / Others";
  }

  function parseCommand(input, defaults) {
    const text = String(input || "").trim();
    if (!text) return { kind: "unknown", reason: "empty" };
    const lower = text.toLowerCase();
    if (/\b(report|summary|total|how much|show|list|spent|expense)\b/.test(lower) &&
        /\b(today|yesterday|this week|this month|month|trip|expenses|spending)\b/.test(lower) &&
        !/\b(spent|paid|bought|purchase|expense of)\s+(?:aed|inr|usd|omr|sgd|eur|gbp)?\s*\d/.test(lower)) {
      const period = /\btoday\b/.test(lower) ? "today" :
        /\byesterday\b/.test(lower) ? "yesterday" :
        /\bthis week\b/.test(lower) ? "week" :
        /\btrip\b/.test(lower) ? "trip" : "month";
      return { kind: period === "trip" ? "trip_report" : "report", period, sourceText: text };
    }
    const expensePattern = /(?:spent|paid|bought|expense(?: of)?)\s+(?:(AED|INR|USD|OMR|SGD|EUR|GBP)\s*)?([0-9][0-9,]*(?:\.\d{1,2})?)(?:\s*(AED|INR|USD|OMR|SGD|EUR|GBP))?(?:\s+(?:at|on|for|in)\s+(.+))?/i;
    const match = text.match(expensePattern);
    if (match) {
      const currency = String(match[1] || match[3] || (defaults && defaults.currency) || "AED").toUpperCase();
      const description = String(match[4] || "").replace(/[.!?]+$/, "").trim() || "Expense";
      return {
        kind: "transaction_draft",
        transaction: {
          id: makeId("TX"), date: (defaults && defaults.date) || new Date().toISOString().slice(0, 10),
          type: "Expense", amount: normalizeAmount(match[2]), currency,
          description, category: inferCategory(description),
          paidBy: (defaults && defaults.paidBy) || "Me",
          paymentType: "Other", tripId: (defaults && defaults.tripId) || "",
          splitMode: "Equal", splitMembers: "", notes: ""
        }
      };
    }
    if (/\b(add|record|new)\b/.test(lower) && /\b(income|salary|received)\b/.test(lower)) {
      return { kind: "open_form", form: "income" };
    }
    if (/\b(add|record|new)\b/.test(lower) && /\b(expense|transaction)\b/.test(lower)) {
      return { kind: "open_form", form: "expense" };
    }
    return { kind: "unknown", reason: "not_understood", sourceText: text };
  }

  function summarize(transactions, period, now) {
    const today = now ? new Date(now) : new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    if (period === "today") start.setHours(0, 0, 0, 0);
    else if (period === "yesterday") { start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); }
    else if (period === "week") { start.setDate(today.getDate() - ((today.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0); }
    const end = new Date(today); end.setHours(23, 59, 59, 999);
    if (period === "yesterday") end.setTime(start.getTime() + 86399999);
    const rows = (transactions || []).filter(t => {
      const d = new Date((t.date || "") + "T12:00:00");
      return !Number.isNaN(d.getTime()) && d >= start && d <= end && String(t.type).toLowerCase() !== "income";
    });
    const total = rows.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return { count: rows.length, total: Math.round(total * 100) / 100, currency: rows[0] ? rows[0].currency || "AED" : "AED", rows };
  }

  root.SmartLedgerCore = { CATEGORIES, CURRENCY_CODES, makeId, normalizeAmount, inferCategory, parseCommand, summarize };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SmartLedgerCore;
})(typeof window !== "undefined" ? window : globalThis);
