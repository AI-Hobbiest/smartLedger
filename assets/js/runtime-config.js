/* Public frontend settings only. Never place API keys or Turnstile secret keys here. */
window.SMART_LEDGER_RUNTIME = Object.freeze({
  // Cloudflare Worker endpoint for finance-language interpretation.
  conversationApiUrl: "https://smart-ledger-finance-ai.jayaprakashganathe.workers.dev/api/interpret",
  // Public Turnstile sitekey for the ai-hobbiest.github.io hostname.
  turnstileSiteKey: "0x4AAAAAAF9OOTWSwGQv1aV3"
});
