/* Secure frontend bridge to the free Groq-backed Cloudflare Worker.
 * Public Worker URL and Turnstile sitekey only; never put secrets here.
 *
 * Turnstile runs on page load (execution: render), so the token is ready when the
 * user sends a message. The visible widget and detailed callbacks make failures
 * diagnosable instead of silently waiting for an invisible execute() callback.
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
  let currentToken = null;
  let resolveToken = null;
  let rejectToken = null;
  let tokenTimer = null;
  let initializationPromise = null;

  const setStatus = (headline, detail) => {
    const title = document.getElementById("ai-status");
    const description = document.getElementById("ai-status-detail");
    if (title && headline) title.textContent = headline;
    if (description && detail) description.textContent = detail;
  };

  const clearTokenWait = () => {
    if (tokenTimer !== null) clearTimeout(tokenTimer);
    tokenTimer = null;
    resolveToken = null;
    rejectToken = null;
  };

  const failTokenWait = message => {
    if (typeof rejectToken !== "function") return;
    const reject = rejectToken;
    clearTokenWait();
    reject(new Error(message));
  };

  const waitForTurnstileApi = async () => {
    const end = Date.now() + 20000;
    while (!window.turnstile && Date.now() < end) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!window.turnstile) {
      throw new Error("Cloudflare Turnstile did not load. Check that challenges.cloudflare.com is not blocked, then refresh.");
    }
  };

  const initializeWidget = async () => {
    await waitForTurnstileApi();
    if (widgetId !== null) return widgetId;

    setStatus("Loading security verification", "Cloudflare Turnstile is starting. The check should complete automatically.");
    widgetId = window.turnstile.render("#turnstile-holder", {
      sitekey,
      action: "smart_ledger_chat",
      execution: "render",
      appearance: "always",
      size: "normal",
      retry: "auto",
      "retry-interval": 8000,
      "refresh-expired": "auto",
      callback: token => {
        if (typeof token !== "string" || !token) {
          failTokenWait("Cloudflare returned an empty security token. Please refresh and try again.");
          return;
        }
        currentToken = token;
        setStatus("Security verified", "Cloudflare verification is ready for your next message.");
        if (typeof resolveToken === "function") {
          const resolve = resolveToken;
          clearTokenWait();
          resolve(token);
          currentToken = null;
        }
      },
      "error-callback": errorCode => {
        const code = String(errorCode || "unknown");
        const message = "Cloudflare Turnstile error " + code + ". Check the widget hostname, sitekey, and access to challenges.cloudflare.com.";
        setStatus("Security verification needs attention", message);
        failTokenWait(message);
        return false; // Keep Cloudflare's automatic retry enabled.
      },
      "expired-callback": () => {
        currentToken = null;
        setStatus("Refreshing security verification", "The previous token expired; Cloudflare is obtaining a fresh one.");
      },
      "timeout-callback": () => {
        currentToken = null;
        const message = "The Turnstile challenge timed out. Complete the visible security check and send your message again.";
        setStatus("Security check timed out", message);
        failTokenWait(message);
      },
      "before-interactive-callback": () => {
        setStatus("Security check required", "Please complete the Cloudflare check shown below the message box.");
      },
      "after-interactive-callback": () => {
        setStatus("Finishing security check", "Cloudflare is validating the challenge.");
      },
      "unsupported-callback": () => {
        const message = "This browser cannot complete Cloudflare Turnstile. Try a current browser with content blockers disabled for this site.";
        setStatus("Security verification unavailable", message);
        failTokenWait(message);
      }
    });

    if (typeof widgetId !== "string" && typeof widgetId !== "number") {
      widgetId = null;
      throw new Error("Cloudflare could not create the security widget. Refresh the page and try again.");
    }
    return widgetId;
  };

  const waitForToken = async () => {
    await initializeWidget();
    if (currentToken) {
      const token = currentToken;
      currentToken = null;
      return token;
    }
    if (resolveToken) {
      throw new Error("A security check is already running. Please wait for it to finish.");
    }

    setStatus("Verifying request", "Waiting for Cloudflare to complete the visible security check.");
    return new Promise((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
      tokenTimer = setTimeout(() => {
        const message = "Cloudflare did not complete verification within 90 seconds. Check the visible widget or try another network/browser.";
        setStatus("Security verification timed out", message);
        failTokenWait(message);
      }, 90000);
    });
  };

  const resetWidget = () => {
    currentToken = null;
    if (widgetId !== null && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
        setStatus("Refreshing security verification", "Cloudflare is preparing a fresh one-time token.");
      } catch {
        setStatus("Security check needs a refresh", "Reload this page to restart Cloudflare verification.");
      }
    }
  };

  window.SmartLedgerLanguageProvider = Object.freeze({
    async interpret(request) {
      const token = await waitForToken();
      const history = Array.isArray(window.SmartLedgerConversationHistory)
        ? window.SmartLedgerConversationHistory
            .filter(item => item && item.role === "user" && typeof item.content === "string")
            .slice(-6) : [];
      try {
        setStatus("Connecting to Smart Ledger AI", "Security passed; sending your message to the free AI service.");
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
        setStatus("Free AI bridge connected", "Cloudflare verification and the AI request both succeeded.");
        return payload;
      } finally {
        // Siteverify tokens are single-use. Start a fresh challenge for the next message.
        resetWidget();
      }
    }
  });

  // Start verification when the page opens rather than waiting for the first send.
  initializationPromise = initializeWidget();
  initializationPromise.catch(error => {
    setStatus("Security verification unavailable", String(error && error.message || error));
  });
})();