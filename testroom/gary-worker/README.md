# gary-chat-proxy

Cloudflare Worker that proxies the testroom Gary chat UI to the Anthropic
Messages API. The API key never leaves the Worker.

## One-time setup (Wyatt)

1. Install wrangler if you don't already have it:
   ```sh
   npm install -g wrangler
   ```

2. Log in to Cloudflare (opens a browser):
   ```sh
   wrangler login
   ```

3. `cd` into this directory:
   ```sh
   cd ~/DrBango/testroom/gary-worker
   ```

4. Set the Anthropic API key as a secret (you'll be prompted to paste it):
   ```sh
   wrangler secret put ANTHROPIC_API_KEY
   ```
   The key will NOT appear in wrangler.toml or git. It lives only on Cloudflare.

5. Deploy:
   ```sh
   wrangler deploy
   ```
   Wrangler prints a URL like `https://gary-chat-proxy.<your-subdomain>.workers.dev`.
   Copy that URL.

6. Paste the URL into the testroom chat config:
   - Open `~/DrBango/testroom/gary-chat.js`
   - Near the top, change `GARY_WORKER_URL = ""` to your Worker URL
   - Commit + push — Gary is live.

## Testing locally

```sh
wrangler dev
```
This runs the Worker at `http://localhost:8787`. The testroom will accept
responses from localhost origins, so you can point `GARY_WORKER_URL` at the
local instance during development.

## Endpoints

- `GET /health` — simple liveness probe, returns `{ok:true}`
- `POST /chat` — forwards JSON `{messages, system, model, max_tokens}` to
  `https://api.anthropic.com/v1/messages` and returns the response verbatim.
  Only allowed models: `claude-sonnet-4-6`, `claude-haiku-4-5`.

## Security posture

- CORS is restricted to `https://drbango.com` and localhost.
- Per-IP rate limit of 20 requests per 5 minutes (per Worker isolate — good
  enough for v1, a few users).
- `ANTHROPIC_API_KEY` is a Cloudflare secret, not in this repo.
- Request bodies are capped at `max_tokens: 2048`.

## Rotating the key

```sh
wrangler secret put ANTHROPIC_API_KEY
```
Paste the new key. Cloudflare hot-swaps it on the next request.
