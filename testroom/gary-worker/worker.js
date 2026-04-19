/**
 * gary-chat-proxy
 * Cloudflare Worker that proxies the testroom chat UI to the Anthropic Messages API.
 *
 * Why this exists:
 *   The Anthropic API key MUST NOT ship in browser code. This Worker holds
 *   the key as an environment secret and forwards requests from approved origins.
 *
 * Expected request:
 *   POST /chat
 *   Origin:      https://drbango.com  (or http://localhost*)
 *   Content-Type: application/json
 *   Body: { messages: [...], system: "...", model: "claude-sonnet-4-6", max_tokens: 1024 }
 *
 * Set the secret before deploying:
 *   wrangler secret put ANTHROPIC_API_KEY
 */

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
]);

// Per-isolate rate limiting. Not cluster-wide — good enough for v1.
// { ip: [timestampMs, timestampMs, ...] }
const rateBuckets = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT = 20;

function originAllowed(origin) {
  if (!origin) return false;
  if (origin === "https://drbango.com") return true;
  if (origin === "https://www.drbango.com") return true;
  if (origin.startsWith("http://localhost")) return true;
  if (origin.startsWith("http://127.0.0.1")) return true;
  return false;
}

function corsHeaders(origin) {
  const allowed = originAllowed(origin) ? origin : "https://drbango.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function rateLimited(ip) {
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT) {
    rateBuckets.set(ip, bucket);
    return true;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return jsonResponse({ ok: true, service: "gary-chat-proxy" }, 200, origin);
    }

    if (url.pathname !== "/chat") {
      return jsonResponse({ error: "not_found" }, 404, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "method_not_allowed" }, 405, origin);
    }

    if (!originAllowed(origin)) {
      return jsonResponse({ error: "forbidden_origin", origin }, 403, origin);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "missing_api_key_on_worker" }, 500, origin);
    }

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (rateLimited(ip)) {
      return jsonResponse({ error: "rate_limited", retry_after_seconds: 300 }, 429, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return jsonResponse({ error: "bad_json" }, 400, origin);
    }

    const model = payload.model || "claude-sonnet-4-6";
    if (!ALLOWED_MODELS.has(model)) {
      return jsonResponse({ error: "model_not_allowed", model }, 400, origin);
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : null;
    if (!messages || messages.length === 0) {
      return jsonResponse({ error: "messages_required" }, 400, origin);
    }

    const body = {
      model,
      max_tokens: Math.min(Number(payload.max_tokens) || 1024, 2048),
      messages,
    };
    if (typeof payload.system === "string" && payload.system.length > 0) {
      body.system = payload.system;
    }

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return jsonResponse({ error: "upstream_unreachable", detail: String(e) }, 502, origin);
    }

    const respText = await upstream.text();
    return new Response(respText, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(origin),
      },
    });
  },
};
