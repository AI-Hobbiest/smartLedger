/* Public frontend settings only. Never place API keys or Turnstile secret keys here. */
window.SMART_LEDGER_RUNTIME = Object.freeze({
  // After deploying cloudflare/wrangler.toml, replace this with the Worker URL
  // shown in Cloudflare Workers & Pages, ending in /api/interpret.
  conversationApiUrl: "SET_CLOUDFLARE_WORKER_URL",
  // Public Turnstile sitekey for the ai-hobbiest.github.io hostname.
  turnstileSiteKey: "SET_TURNSTILE_SITE_KEY"
});
