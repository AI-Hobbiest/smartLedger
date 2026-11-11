# Smart Ledger — free conversational AI bridge

## Zero-cost design

This bridge is intentionally configured for free tiers only:

- **Inference:** Groq Free API using the explicit model ID `openai/gpt-oss-20b`. The Worker does not select paid models or silently fall back to a paid provider. When the free quota is exhausted, the API returns a rate-limit response and the chat explains that it will wait rather than spend money.
- **Backend:** Cloudflare Workers Free. The Worker keeps the Groq key server-side and provides CORS, input limits and per-IP rate limiting.
- **Bot protection:** Cloudflare Turnstile Free. A managed challenge normally runs in the background and may ask for an interaction when needed.
- **No database:** The Worker does not persist chat messages, transactions or model responses. The ledger remains in browser local storage in this prototype.

Free-tier limits and availability can change. This configuration never opts into a paid tier automatically.

## Data boundary

The browser sends the current message, up to six recent user-authored messages, the structured report filter context, timezone and a one-use Turnstile token. It does **not** send saved transaction rows, balances, ledger report output, or the form-entry local-storage contents to the model.

The Worker does not log request bodies or store conversation data. Groq states that inference inputs and outputs are not retained by default, but may be temporarily logged to troubleshoot reliability problems or investigate suspected abuse; its current documentation says those logs may be retained for up to 30 days unless disabled in Data Controls. Review Groq's current policy before using real personal financial text.

## One-time account setup

### 1. Groq free API key

1. Create/sign in to a Groq developer account at https://console.groq.com.
2. Create an API key at https://console.groq.com/keys.
3. Keep the account on the Free plan. Do not add paid billing or purchase credits.
4. Store the key as the GitHub repository Actions secret `GROQ_API_KEY`. Never put it in `runtime-config.js`, HTML, or any file committed to Git.

The Worker is pinned to `openai/gpt-oss-20b`. It does not use an automatic model router.

### 2. Cloudflare free account and Worker token

1. Create/sign in to a Cloudflare account at https://dash.cloudflare.com.
2. Find the Account ID in the account overview.
3. Create an API token with the Cloudflare Workers Scripts Edit permission for this account.
4. Add these GitHub Actions repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `GROQ_API_KEY`
   - `TURNSTILE_SECRET_KEY` (after step 3)

The deployment workflow uses these secrets to publish the Worker and upload the two private runtime secrets to Cloudflare.

### 3. Cloudflare Turnstile Free widget

1. In Cloudflare, open **Turnstile** and add a widget.
2. Set the hostname to `ai-hobbiest.github.io`.
3. Choose **Managed** mode; this is designed to avoid interrupting normal visitors unless Cloudflare needs an interaction.
4. Copy the public **Sitekey** and private **Secret key**.
5. Add the private secret as the GitHub Actions repository secret `TURNSTILE_SECRET_KEY`.

The sitekey is public and will be placed in `assets/js/runtime-config.js`; the secret stays in Cloudflare.

### 4. Deploy the Worker

1. Open the repository's **Actions** tab.
2. Select **Deploy Smart Ledger free AI bridge**.
3. Choose **Run workflow** on `main`.
4. After it succeeds, open Cloudflare **Workers & Pages** and find `smart-ledger-finance-ai`.
5. Copy its `workers.dev` URL. It has the form `https://smart-ledger-finance-ai.<your-account-subdomain>.workers.dev`.

### 5. Point the Pages app to the Worker

Edit `assets/js/runtime-config.js`:

- `conversationApiUrl`: paste the Worker URL and append `/api/interpret`.
- `turnstileSiteKey`: paste the public Turnstile sitekey.

Commit the file to `main`. GitHub Pages will publish the updated static app.

Do not send API keys, Cloudflare secrets, passwords or tokens in chat. If configuration help is needed, share only the Worker URL and the public Turnstile sitekey.

## Free-tier safeguards

- The model ID is fixed to `openai/gpt-oss-20b`.
- A rate-limit response is shown as a free-tier limit, not retried against a paid model.
- Worker rate limiting is 10 requests per minute per client IP.
- Request bodies are limited to 18 KB; user messages to 1,500 characters.
- The Worker validates the Turnstile token and expected hostname/action before calling Groq.
- The Worker validates the model's structured output before returning it to the browser.
- Model output can only propose transaction drafts or report filters. Ledger calculations, review and saving remain app-controlled.

## Current limitation

The public GitHub Pages page is not connected to OneDrive. The AI bridge only interprets the conversation and proposes structured intents; it cannot read your saved ledger. Report totals continue to be calculated locally from the browser's test ledger until a separate data connection is built.
