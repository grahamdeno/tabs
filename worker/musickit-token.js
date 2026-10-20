/*
 * Tabs MusicKit token: a Cloudflare Worker with one job.
 *
 *   GET /token    { token, expires } : a MusicKit developer token (ES256 JWT)
 *   GET /preview?u=<Apple preview URL> : that 30-second preview, readable by the app (3.18.0).
 *                 Only Apple's preview hosts are fetched; anything else is refused.
 *
 * Apple Music in The Road is optional and off unless you turn it on in
 * Settings > Keys. MusicKit JS needs a developer token signed with the
 * MusicKit private key, and that key can't live in the app or in this repo.
 * It lives only in this Worker's MUSICKIT_KEY secret. The token is limited to
 * the app's address (its origin claim) and lasts DAYS days; a fresh one is
 * signed when less than a day is left.
 * Only the app's own address may call it. Deploy: see worker/README.md.
 */

export const ALLOWED_ORIGINS = ["https://grahamdeno.github.io"];
const DEFAULT_TEAM_ID = "7MHDTK68M2";
const DEFAULT_KEY_ID = "KABHU54QBS";
export const DAYS = 30;

export const allowed = origin => ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": allowed(origin) ? origin : ALLOWED_ORIGINS[0],
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json", "cache-control": "no-store" } });
const fail = (status, message, headers) => json(status, { error: { message } }, headers);

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = s => b64url(new TextEncoder().encode(s));

// The .p8 file Apple gives you is a PKCS#8 PEM. Only the secret holds it.
async function importKey(pem) {
  const body = String(pem || "").replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  if (!body) throw new Error("MUSICKIT_KEY is not set");
  const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

// ES256: WebCrypto's ECDSA signature is already the raw r||s form JWTs use.
export async function signToken(env, now = Math.floor(Date.now() / 1000)) {
  const key = await importKey(env.MUSICKIT_KEY);
  const header = { alg: "ES256", kid: env.KEY_ID || DEFAULT_KEY_ID };
  const payload = { iss: env.TEAM_ID || DEFAULT_TEAM_ID, iat: now, exp: now + DAYS * 86400, origin: ALLOWED_ORIGINS };
  const input = `${b64urlText(JSON.stringify(header))}.${b64urlText(JSON.stringify(payload))}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(input));
  return { token: `${input}.${b64url(sig)}`, expires: payload.exp };
}

let cached = null; /* { token, expires } kept while this Worker instance lives */
export async function handle(request, env, now = Math.floor(Date.now() / 1000)) {
  const origin = request.headers.get("origin") || "";
  const headers = corsHeaders(origin);
  if (!allowed(origin)) return fail(403, "Not allowed", headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  const { pathname, searchParams } = new URL(request.url);
  if (request.method === "GET" && pathname === "/preview") return preview(searchParams.get("u"), headers);
  if (request.method !== "GET" || pathname !== "/token") return fail(404, "Not found", headers);
  try {
    if (!cached || cached.expires - now < 86400) cached = await signToken(env, now);
    return json(200, cached, headers);
  } catch {
    return fail(500, "The token couldn't be made", headers);
  }
}
export const resetCache = () => { cached = null; };
/* Apple's preview files may not say a web page can read them; this passes one along with the app's
   CORS headers so The Road can measure its tempo, swing and key. Apple's preview hosts only. */
export const previewAllowed = u => { try { const x = new URL(u); return x.protocol === "https:" && /(^|\.)(itunes\.apple\.com|mzstatic\.com)$/.test(x.hostname); } catch { return false; } };
async function preview(u, headers) {
  if (!previewAllowed(u)) return fail(400, "Not an Apple preview", headers);
  const r = await fetch(u);
  if (!r.ok) return fail(502, "The preview couldn't be fetched", headers);
  return new Response(r.body, { status: 200, headers: { ...headers, "content-type": r.headers.get("content-type") || "audio/mp4", "cache-control": "public, max-age=86400" } });
}

export default { fetch: (request, env) => handle(request, env) };
