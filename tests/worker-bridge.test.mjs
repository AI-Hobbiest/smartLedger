import test from "node:test";
import assert from "node:assert/strict";
import worker, {
  sanitizeHistory,
  sanitizeContext,
  validateIntentResult
} from "../cloudflare/worker/src/index.mjs";

const TODAY = "2026-11-11";
const ENV = {
  ALLOWED_ORIGIN: "https://ai-hobbiest.github.io",
  ALLOWED_HOSTNAME: "ai-hobbiest.github.io",
  GROQ_API_KEY: "test-secret",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  GROQ_MODEL: "openai/gpt-oss-20b",
  CHAT_LIMITER: { limit: async () => ({ success: true }) }
};
const baseIntent = {
  intent: "transaction.create",
  transactions: [{
    type: "Expense", amount: 25, currency: "AED", date: TODAY,
    category: "Food/EatOut", description: "Lunch", payment: "Cash", notes: ""
  }],
  question: "",
  reply: "I have prepared the transaction for you to review.",
  period: { kind: "today", from: TODAY, to: TODAY },
  filters: { type: null, category: null, payment: null, groupBy: null }
};
const requestBody = {
  message: "I spent 25 AED on lunch",
  context: null,
  history: [{ role: "user", content: "Earlier I said I paid 10 AED for a taxi." }],
  timeZone: "Asia/Dubai",
  turnstileToken: "valid-turnstile-token"
};
const makeRequest = (body=requestBody, origin=ENV.ALLOWED_ORIGIN, method="POST") => new Request("https://worker.test/api/interpret", {
  method,
  headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.10" },
  body: method === "POST" ? JSON.stringify(body) : undefined
});

test("only user-authored history is forwarded; assistant report outputs are excluded", () => {
  const history = sanitizeHistory([
    { role: "user", content: "I spent 15 AED on lunch" },
    { role: "assistant", content: "Your saved ledger total is AED 1,234.50" },
    { role: "user", content: "What about yesterday?" }
  ], "What about yesterday?");
  assert.deepEqual(JSON.parse(JSON.stringify(history)), [
    { role: "user", content: "I spent 15 AED on lunch" }
  ]);
});

test("only supported prior report context is forwarded", () => {
  const context = sanitizeContext({
    report: {
      period: { kind: "month", from: "2026-11-01", to: "2026-11-30" },
      filters: { type: "Expense", category: "Grocery", payment: "Cash", groupBy: "category" }
    },
    lastTransaction: "should-not-be-forwarded"
  });
  assert.deepEqual(JSON.parse(JSON.stringify(context)), {
    report: {
      period: { kind: "month", from: "2026-11-01", to: "2026-11-30" },
      filters: { type: "Expense", category: "Grocery", payment: "Cash", groupBy: "category" }
    }
  });
});

test("model intent validation rejects invalid currencies and negative amounts", () => {
  assert.throws(() => validateIntentResult({
    ...baseIntent,
    transactions: [{ ...baseIntent.transactions[0], amount: -1 }]
  }, TODAY));
  assert.throws(() => validateIntentResult({
    ...baseIntent,
    transactions: [{ ...baseIntent.transactions[0], currency: "BTC" }]
  }, TODAY));
});

test("worker rejects requests from origins outside the configured Pages site", async () => {
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return new Response("{}"); };
  try {
    const response = await worker.fetch(makeRequest(requestBody, "https://evil.example"), ENV);
    assert.equal(response.status, 403);
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker enforces its per-IP free-tier request limiter before provider calls", async () => {
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { called = true; return new Response("{}"); };
  try {
    const env = { ...ENV, CHAT_LIMITER: { limit: async () => ({ success: false }) } };
    const response = await worker.fetch(makeRequest(), env);
    assert.equal(response.status, 429);
    assert.equal(called, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker rejects invalid Turnstile tokens without calling Groq", async () => {
  let groqCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("siteverify")) return new Response(JSON.stringify({ success: false }));
    groqCalled = true;
    return new Response("{}");
  };
  try {
    const response = await worker.fetch(makeRequest(), ENV);
    assert.equal(response.status, 403);
    assert.equal(groqCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker validates Turnstile then returns only a schema-validated Groq intent", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options={}) => {
    calls.push(String(url));
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({
        success: true, hostname: ENV.ALLOWED_HOSTNAME, action: "smart_ledger_chat"
      }));
    }
    const body = JSON.parse(options.body);
    assert.equal(body.model, "openai/gpt-oss-20b");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.messages.some(m => m.content.includes("Your saved ledger total")), false);
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(baseIntent) } }]
    }));
  };
  try {
    const response = await worker.fetch(makeRequest(), { ...ENV, GROQ_MODEL: "a-paid-model-must-not-be-used" });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.intent, "transaction.create");
    assert.equal(data.transactions[0].amount, 25);
    assert.equal(data.reply, "I have prepared the transaction for you to review.");
    assert.deepEqual(calls, [
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      "https://api.groq.com/openai/v1/chat/completions"
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker refuses operation when any required secret is missing", async () => {
  const { GROQ_API_KEY, ...env } = ENV;
  const response = await worker.fetch(makeRequest(), env);
  assert.equal(response.status, 503);
});

test("worker returns a no-cost rate-limit message if Groq free quota is exhausted", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({
        success: true, hostname: ENV.ALLOWED_HOSTNAME, action: "smart_ledger_chat"
      }));
    }
    return new Response("{}", { status: 429 });
  };
  try {
    const response = await worker.fetch(makeRequest(), ENV);
    const data = await response.json();
    assert.equal(response.status, 429);
    assert.match(data.error, /will not switch to a paid service/i);
  } finally { globalThis.fetch = originalFetch; }
});


test("worker rejects a valid Turnstile token carrying the wrong action", async () => {
  let groqCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({
        success: true, hostname: ENV.ALLOWED_HOSTNAME, action: "another_form"
      }));
    }
    groqCalled = true;
    return new Response("{}");
  };
  try {
    const response = await worker.fetch(makeRequest(), ENV);
    assert.equal(response.status, 403);
    assert.equal(groqCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker rejects oversized messages before external verification", async () => {
  let externalCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { externalCalled = true; return new Response("{}"); };
  try {
    const response = await worker.fetch(makeRequest({ ...requestBody, message: "x".repeat(19000) }), ENV);
    assert.equal(response.status, 413);
    assert.equal(externalCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});

test("worker rejects messages over the conversational input limit", async () => {
  let externalCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { externalCalled = true; return new Response("{}"); };
  try {
    const response = await worker.fetch(makeRequest({ ...requestBody, message: "x".repeat(1501) }), ENV);
    assert.equal(response.status, 400);
    assert.equal(externalCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});


test("worker rejects oversized Content-Length headers before reading the message", async () => {
  let externalCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { externalCalled = true; return new Response("{}"); };
  try {
    const req = new Request("https://worker.test/api/interpret", {
      method: "POST",
      headers: {
        Origin: ENV.ALLOWED_ORIGIN,
        "Content-Type": "application/json",
        "Content-Length": "20000",
        "CF-Connecting-IP": "192.0.2.10"
      },
      body: JSON.stringify(requestBody)
    });
    const response = await worker.fetch(req, ENV);
    assert.equal(response.status, 413);
    assert.equal(externalCalled, false);
  } finally { globalThis.fetch = originalFetch; }
});
