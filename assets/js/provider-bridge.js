/* Secure frontend bridge to the free Groq-backed Cloudflare Worker.
 * Only the public Worker URL and Turnstile sitekey belong in runtime-config.js.
 * Turnstile is executed only when the user sends a message. With the widget set
 * to Invisible (or Non-Interactive + interaction-only appearance), no CAPTCHA
 * is shown during normal use. Server-side Siteverify remains mandatory.
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

  if (!configured) return; // Keep deterministic local parsing active until setup is complete.

  let widgetId = null;
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
      throw new Error("Cloudflare Turnstile did not load. Check access to challenges.cloudflare.com, then refresh.");
    }
  };

  const initializeWidget = () => {
    if (widgetId !== null) return Promise.resolve(widgetId);
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      await waitForTurnstileApi();
      if (widgetId !== null) return widgetId;

      widgetId = window.turnstile.render("#turnstile-holder", {
        sitekey,
        action: "smart_ledger_chat",
        execution: "execute",
        appearance: "interaction-only",
        retry: "auto",
        "retry-interval": 8000,
        "refresh-expired": "auto",
        callback: token => {
          if (typeof token !== "string" || !token) {
            failTokenWait("Cloudflare returned an empty security token. Please try again.");
            return;
          }
          if (typeof resolveToken === "function") {
            const resolve = resolveToken;
            clearTokenWait();
            resolve(token);
          }
        },
        "error-callback": errorCode => {
          const code = String(errorCode || "unknown");
          const message = "Cloudflare Turnstile error " + code + ". Check the widget hostname, sitekey, and access to challenges.cloudflare.com.";
          setStatus("Security verification failed", message);
          failTokenWait(message);
        },
        "expired-callback": () => {
          const message = "The security token expired before it could be used. Please send your message again.";
          setStatus("Security token expired", message);
          failTokenWait(message);
        },
        "timeout-callback": () => {
          const message = "Cloudflare did not finish its background security check. Please retry; no CAPTCHA should be needed in normal use.";
          setStatus("Background verification timed out", message);
          failTokenWait(message);
        },
        "unsupported-callback": () => {
          const message = "This browser cannot complete the invisible security check. Try a current browser or another network.";
          setStatus("Security verification unavailable", message);
          failTokenWait(message);
        }
      });

      if (typeof widgetId !== "string" && typeof widgetId !== "number") {
        widgetId = null;
        throw new Error("Cloudflare could not initialise the background security check. Refresh the page and try again.");
      }
      return widgetId;
    })().catch(error => {
      initializationPromise = null;
      throw error;
    });
    return initializationPromise;
  };

  const getTurnstileToken = async () => {
    await initializeWidget();
    if (resolveToken) {
      throw new Error("A security check is already running. Please wait for it to finish.");
    }

    setStatus("Verifying in background", "Cloudflare is checking this request without displaying a CAPTCHA.");
    const tokenPromise = new Promise((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
      tokenTimer = setTimeout(() => {
        const message = "Cloudflare's background security check timed out. Check browser privacy settings or try another network.";
        setStatus("Background verification timed out", message);
        failTokenWait(message);
      }, 45000);
    });

    try {
      window.turnstile.execute(widgetId);
    } catch (error) {
      failTokenWait("Could not start the background security check. Please refresh and try again.");
    }
    return tokenPromise;
  };

  const resetWidget = () => {
    if (widgetId !== null && window.turnstile) {
      try {
        window.turnstile.reset(widgetId);
      } catch {
        setStatus("Security check needs refresh", "Reload the page to restart background verification.");
      }
    }
  };

  window.SmartLedgerLanguageProvider = Object.freeze({
    async interpret(request) {
      let token;
      try {
        token = await getTurnstileToken();
        const history = Array.isArray(window.SmartLedgerConversationHistory)
          ? window.SmartLedgerConversationHistory
              .filter(item => item && item.role === "user" && typeof item.content === "string")
              .slice(-6) : [];

        setStatus("Connecting to Smart Ledger AI", "Background verification passed; sending your message to the free AI service.");
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
        setStatus("Free AI bridge connected", "Background security verification and the AI request both succeeded.");
        return payload;
      } finally {
        // Turnstile tokens are single-use. Reset after each attempt to request a fresh token.
        resetWidget();
      }
    }
  });
})();