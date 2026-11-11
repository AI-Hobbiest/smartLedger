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
3. Keep the account on the Free plan. Do not add a paid plan, add billing for inference, or purchase credits. If the free quota is reached, requests should stop with a rate-limit response rather than switch to paid usage.
4. Open **Data Controls** in GroqCloud and enable **Zero Data Retention (ZDR)** before using personal finance messages. Groq states this disables its temporary reliability/abuse-monitoring input/output logs for inference. Its usage metadata is still retained, but Groq says it does not contain prompt or response content.
5. Store the key as the GitHub repository Actions secret `GROQ_API_KEY`. Never put it in `runtime-config.js`, HTML, or any file committed to Git.

The Worker is pinned to `openai/gpt-oss-20b`. It does not use an automatic model router. Groq's published Free-plan table currently lists this model at 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day per organisation/model. These limits can change and the exact limits for your account are shown in the Groq console. If the quota returns HTTP 429, the app stops and waits; it never tries a paid model.

Groq documents Zero Data Retention as available in Data Controls. Enable it before using personal finance messages. Without ZDR, inference prompts and outputs are not retained by default, but may be logged for reliability or abuse investigations for up to 30 days.

### 2. Cloudflare free account and Worker token

1. Create/sign in to a Cloudflare account at https://dash.cloudflare.com. Keep Workers on the Free plan and enable the account's `workers.dev` subdomain if it is not already enabled.
2. Find the Account ID in the account overview.
3. Create an API token using Cloudflare's **Edit Cloudflare Workers** template, scoped to this account only.
4. Add these GitHub Actions repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `GROQ_API_KEY`
   - `TURNSTILE_SECRET_KEY` (after step 3)

The deployment workflow uses these secrets to publish the Worker and upload the two private runtime secrets to Cloudflare. It relies on the `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` environment variables as documented by Cloudflare for CI. The Worker stays on Cloudflare's default Free plan; do not upgrade the account to Workers Paid. Cloudflare currently lists 100,000 Worker requests/day on Free. The configured 10-per-minute rate limit is approximate and counted per Cloudflare location; it is an abuse-control guard, not a global hard cap.

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
