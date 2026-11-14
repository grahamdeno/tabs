// The Listening booth's upload server (4.95.0): takes a booth recording and its label from the app and puts
// them on the repo's `booth` branch, using a GitHub key that lives only here, as a secret. So friends can send
// takes without a key on their phone; they need the booth code instead (a shared word, in the invite link).
//
//   POST /take   { code, path, wav (base64), label (JSON object) }   -> 201, or an error with a plain reason
//   GET  /ping?code=...                                              -> 200 when the code is right
//
// Only the app's address may call it. Only booth recordings and labels are written, only under booth/, only to the
// booth branch, at most 2 MB a recording. Nothing is kept here. Secrets: GITHUB_KEY, BOOTH_CODE. See worker/README.md.

export const ALLOWED_ORIGINS = ["https://grahamdeno.github.io"];
export const allowed = origin => ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
export const REPO = "grahamdeno/tabs", BRANCH = "booth", MAX_WAV = 2 * 1024 * 1024, MAX_LABEL = 8 * 1024;
export const PATH_RE = /^booth\/\d{4}-\d\d-\d\d\/[A-Za-z0-9-]{1,100}-[a-z0-9]{6}$/;

const cors = origin => ({
  "access-control-allow-origin": allowed(origin) ? origin : ALLOWED_ORIGINS[0],
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
  vary: "origin"
});
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });

/* the same length every time, so the code can't be guessed a letter at a time */
export function sameCode(a, b) {
  const x = new TextEncoder().encode(String(a || "")), y = new TextEncoder().encode(String(b || ""));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0 && y.length > 0;
}

/* a booth recording: 16-bit mono PCM WAV, 8 to 48 kHz */
export function isBoothWav(bytes) {
  if (bytes.length < 44 || bytes.length > MAX_WAV) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), tag = o => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE" || tag(12) !== "fmt ") return false;
  const fmt = v.getUint16(20, true), ch = v.getUint16(22, true), rate = v.getUint32(24, true), bits = v.getUint16(34, true);
  return fmt === 1 && ch === 1 && bits === 16 && rate >= 8000 && rate <= 48000;
}
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const toB64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

async function gh(env, path, opt = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, { ...opt, headers: { authorization: `Bearer ${env.GITHUB_KEY}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "tabs-booth", ...(opt.body ? { "content-type": "application/json" } : {}) } });
}
async function reason(r) { try { return (await r.json()).message || ""; } catch { return ""; } }
/* the booth branch, made from main the first time */
async function ensureBranch(env) {
  const r = await gh(env, `/git/ref/heads/${BRANCH}`);
  if (r.ok) return null;
  if (r.status !== 404) return `GitHub said ${r.status}${await reason(r) ? `: ${await reason(r)}` : ""} (looking for the booth branch)`;
  const main = await gh(env, "/git/ref/heads/main");
  if (!main.ok) return `GitHub said ${main.status} (reading main)`;
  const sha = (await main.json()).object.sha;
  const made = await gh(env, "/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
  return made.ok || made.status === 422 ? null : `GitHub said ${made.status} (making the booth branch)`;
}
async function put(env, path, bytes, message) {
  const r = await gh(env, `/contents/${path}`, { method: "PUT", body: JSON.stringify({ message, content: toB64(bytes), branch: BRANCH }) });
  if (r.ok || r.status === 422) return null; /* 422: already there (a take sent twice) */
  return `GitHub said ${r.status}${await reason(r) ? `: ${await reason(r)}` : ""} (writing ${path.split("/").pop()})`;
}

export async function handle(request, env) {
  const origin = request.headers.get("origin"), headers = cors(origin), url = new URL(request.url);
  if (!allowed(origin)) return json({ error: "This server only answers the app." }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (!env.GITHUB_KEY || !env.BOOTH_CODE) return json({ error: "The booth server isn't set up yet (no key or code)." }, 503, headers);
  if (url.pathname === "/ping" && request.method === "GET") {
    return sameCode(url.searchParams.get("code"), env.BOOTH_CODE) ? json({ ok: true }, 200, headers) : json({ error: "That booth code isn't right." }, 401, headers);
  }
  if (url.pathname !== "/take" || request.method !== "POST") return json({ error: "Not here." }, 404, headers);
  const size = +(request.headers.get("content-length") || 0);
  if (size > MAX_WAV * 1.4 + MAX_LABEL + 4096) return json({ error: "That recording is too big." }, 413, headers);
  let body;
  try { body = await request.json(); } catch { return json({ error: "That wasn't a take." }, 400, headers); }
  if (!sameCode(body?.code, env.BOOTH_CODE)) return json({ error: "That booth code isn't right." }, 401, headers);
  if (!PATH_RE.test(body.path || "")) return json({ error: "That take's name isn't one the booth makes." }, 400, headers);
  let wav;
  try { wav = fromB64(body.wav || ""); } catch { return json({ error: "That recording couldn't be read." }, 400, headers); }
  if (!isBoothWav(wav)) return json({ error: "That isn't a booth recording." }, 400, headers);
  const label = new TextEncoder().encode(JSON.stringify(body.label ?? null, null, 1));
  if (!body.label || typeof body.label !== "object" || label.length > MAX_LABEL) return json({ error: "That take's label couldn't be read." }, 400, headers);
  const what = Array.isArray(body.label.chords) ? body.label.chords.slice(0, 2).map(c => String(c).slice(0, 12)).join(" to ") : "a take";
  const who = String(body.label.player || "").slice(0, 30);
  const err = await ensureBranch(env)
    || await put(env, `${body.path}.wav`, wav, `Booth: ${what}${who ? ` by ${who}` : ""} (recording)`)
    || await put(env, `${body.path}.json`, label, `Booth: ${what}${who ? ` by ${who}` : ""} (label)`);
  return err ? json({ error: err }, 502, headers) : json({ ok: true }, 201, headers);
}

export default { fetch: (request, env) => handle(request, env) };
