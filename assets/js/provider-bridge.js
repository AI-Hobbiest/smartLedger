/* Secure frontend bridge to the free Groq-backed Cloudflare Worker.
 * Only the public Worker URL and public Turnstile sitekey belong in runtime-config.js.
 */
(() => {
  "use strict";
  const cfg = window.SMART_LEDGER_RUNTIME || {};
  const endpoint = String(cfg.conversationApiUrl || "");
  const sitekey = String(cfg.turnstileSiteKey || "");
  const configured = /^https:\/\/smart-ledger-finance-ai\.[a-z0-9-]+\.workers\.dev\/api\/interpret$/i.test(endpoint)
    && !endpoint.includes("SET_CLOUDFLARE")
    && /^[A-Za-z0-9_-]{10,}$/.test(sitekey)
    && !sitekey.startsWith("SET_");

  if (!configured) return; // Keep the deterministic local adapter active until setup is complete.

  let widgetId = null;
  let resolvingToken = null;
  let tokenTimer = null;

  const waitForTurnstile = async () => {
    const end = Date.now() + 15000;
    while (!window.turnstile && Date.now() < end) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!window.turnstile) throw new Error("Security verification did not load. Please refresh and try again.");
    if (widgetId === null) {
      widgetId = window.turnstile.render("#turnstile-holder", {
        sitekey,
        action: "smart_ledger_chat",
        execution: "execute",
        appearance: "interaction-only",
        callback: token => {
          if (!resolvingToken) return;
          const resolve = resolvingToken;
          resolvingToken = null;
          clearTimeout(tokenTimer);
          tokenTimer = null;
          resolve(token);
          try { window.turnstile.reset(widgetId); } catch { /* Token is already captured. */ }
        },
        "error-callback": () => {
          if (!resolvingToken) return;
          const reject = resolvingToken;
          resolvingToken = null;
          clearTimeout(tokenTimer);
          tokenTimer = null;
          reject(new Error("Security verification failed. Please try again."));
        },
        "expired-callback": () => {
          if (!resolvingToken) return;
          const reject = resolvingToken;
          resolvingToken = null;
          clearTimeout(tokenTimer);
          tokenTimer = null;
          reject(new Error("Security verification expired. Please send the message again."));
        }
      });
    }
  };

  const getTurnstileToken = async () => {
    await waitForTurnstile();
    if (resolvingToken) throw new Error("A security check is already in progress. Please wait a moment.");
    const tokenPromise = new Promise((resolve, reject) => {
      resolvingToken = resolve;
      tokenTimer = setTimeout(() => {
        resolvingToken = null;
        tokenTimer = null;
        try { window.turnstile.reset(widgetId); } catch { /* Ignore reset errors. */ }
        reject(new Error("Security verification timed out. Please try again."));
      }, 45000);
    });
    try {
      window.turnstile.execute(widgetId);
    } catch (error) {
      const reject = resolvingToken;
      resolvingToken = null;
      clearTimeout(tokenTimer);
      tokenTimer = null;
      if (reject) reject(error);
    }
    return tokenPromise;
  };

  window.SmartLedgerLanguageProvider = Object.freeze({
    async interpret(request) {
      const token = await getTurnstileToken();
      const history = Array.isArray(window.SmartLedgerConversationHistory)
        ? window.SmartLedgerConversationHistory.slice(-12) : [];
      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          credentials: "omit",
          body: JSON.stringify({
            message: String(request.message || ""),
            context: request.context || null,
            history,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            turnstileToken: token
          })
        });
      } catch {
        throw new Error("The free AI bridge could not be reached. Your message was not saved.");
      }
      let payload;
      try { payload = await response.json(); }
      catch { throw new Error("The free AI bridge returned an unreadable response."); }
      if (!response.ok) throw new Error(payload.error || "The free AI bridge could not process the message.");
      return payload;
    }
  });
})();
