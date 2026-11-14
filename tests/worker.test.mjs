// Tests for the MusicKit token Worker (worker/musickit-token.js), with a
// throwaway P-256 key made here. Run with: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { handle, resetCache, DAYS } from "../worker/musickit-token.js";

const ORIGIN = "https://grahamdeno.github.io";
const req = (path, origin = ORIGIN, method = "GET") => new Request("https://token.test" + path, { method, headers: origin ? { origin } : {} });
const fromB64url = s => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

async function testKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", pair.privateKey)).toString("base64");
  return { pem: `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`, publicKey: pair.publicKey };
}

test("only the app's origin is served", async () => {
  resetCache();
  assert.equal((await handle(req("/token", "https://evil.example"), {})).status, 403);
  assert.equal((await handle(req("/token", ""), {})).status, 403);
  const pre = await handle(req("/token", ORIGIN, "OPTIONS"), {});
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await handle(req("/nope", "http://localhost:8765"), {})).status, 404);
});

test("a developer token: ES256, Team ID, Key ID, origin, and a signature that checks", async () => {
  resetCache();
  const { pem, publicKey } = await testKey();
  const now = 1_800_000_000;
  const r = await handle(req("/token"), { MUSICKIT_KEY: pem }, now);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const { token, expires } = await r.json();
  const [h, p, s] = token.split(".");
  assert.deepEqual(JSON.parse(fromB64url(h)), { alg: "ES256", kid: "KABHU54QBS" });
  assert.deepEqual(JSON.parse(fromB64url(p)), { iss: "7MHDTK68M2", iat: now, exp: now + DAYS * 86400, origin: [ORIGIN] });
  assert.equal(expires, now + DAYS * 86400);
  const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, fromB64url(s), new TextEncoder().encode(`${h}.${p}`));
  assert.ok(ok, "the signature verifies with the matching public key");
  assert.ok(!JSON.stringify(await (await handle(req("/token"), { MUSICKIT_KEY: pem }, now)).json()).includes("PRIVATE"), "the key is never in a reply");
});

test("the same token is reused until it has less than a day left", async () => {
  resetCache();
  const { pem } = await testKey();
  const now = 1_800_000_000;
  const a = (await (await handle(req("/token"), { MUSICKIT_KEY: pem }, now)).json()).token;
  const b = (await (await handle(req("/token"), { MUSICKIT_KEY: pem }, now + 3600)).json()).token;
  const c = (await (await handle(req("/token"), { MUSICKIT_KEY: pem }, now + (DAYS - 0.5) * 86400)).json()).token;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("no key set: a plain error, nothing leaked", async () => {
  resetCache();
  const r = await handle(req("/token"), {});
  assert.equal(r.status, 500);
  assert.deepEqual(await r.json(), { error: { message: "The token couldn't be made" } });
});

test("the preview route passes along Apple's previews only", async () => {
  const W = await import("../worker/musickit-token.js");
  assert.equal(W.previewAllowed("https://audio-ssl.itunes.apple.com/itunes-assets/x.m4a"), true);
  assert.equal(W.previewAllowed("https://is1-ssl.mzstatic.com/a.m4a"), true);
  assert.equal(W.previewAllowed("https://evil.example/itunes.apple.com"), false);
  assert.equal(W.previewAllowed("http://audio-ssl.itunes.apple.com/x.m4a"), false);
  const r = await W.handle(new Request("https://w.example/preview?u=" + encodeURIComponent("https://evil.example/x"), { headers: { origin: "https://grahamdeno.github.io" } }), {});
  assert.equal(r.status, 400);
});

/* ---- the Listening booth's upload server (worker/booth.js, 4.95.0) ---- */
const booth = await import("../worker/booth.js");
const wavOf = (rate = 22050, n = 100) => { const b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); return b; };
const ENV = { GITHUB_KEY: "github_pat_server", BOOTH_CODE: "wagon wheel" };
const take = (over = {}) => ({ code: "wagon wheel", path: "booth/2026-11-14/C-ab12cd", wav: wavOf().toString("base64"), label: { kind: "chord", chords: ["C"], player: "Mike" }, ...over });
const post = (body, origin = ORIGIN) => new Request("https://booth.test/take", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

test("the booth server: only the app, only with the code, only booth recordings", async t => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o = {}) => { calls.push({ u: String(u), m: o.method || "GET", auth: o.headers?.authorization, body: o.body ? JSON.parse(o.body) : null }); return new Response(JSON.stringify({ object: { sha: "s1" } }), { status: String(u).endsWith("/git/ref/heads/booth") && !calls.some(c => c.m === "POST") ? 404 : o.method === "PUT" || o.method === "POST" ? 201 : 200 }); };
  t.after(() => { globalThis.fetch = realFetch; });
  assert.equal((await booth.handle(post(take(), "https://evil.example"), ENV)).status, 403, "another site");
  assert.equal((await booth.handle(post(take()), {})).status, 503, "not set up yet");
  assert.equal((await booth.handle(post(take({ code: "wagon whee" })), ENV)).status, 401, "wrong code");
  assert.equal((await booth.handle(post(take({ path: "app.js" })), ENV)).status, 400, "only booth/ names");
  assert.equal((await booth.handle(post(take({ path: "booth/2026-11-14/../app-ab12cd" })), ENV)).status, 400);
  assert.equal((await booth.handle(post(take({ wav: Buffer.from("<script>").toString("base64") })), ENV)).status, 400, "only WAVs");
  assert.equal((await booth.handle(post(take({ wav: wavOf(96000).toString("base64") })), ENV)).status, 400, "only booth-like WAVs");
  assert.equal(calls.length, 0, "nothing reached GitHub");
  const pre = await booth.handle(new Request("https://booth.test/take", { method: "OPTIONS", headers: { origin: ORIGIN } }), ENV);
  assert.equal(pre.status, 204); assert.equal(pre.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal((await booth.handle(new Request("https://booth.test/ping?code=wagon%20wheel", { headers: { origin: ORIGIN } }), ENV)).status, 200);
  assert.equal((await booth.handle(new Request("https://booth.test/ping?code=nope", { headers: { origin: ORIGIN } }), ENV)).status, 401);
  const ok = await booth.handle(post(take()), ENV);
  assert.equal(ok.status, 201);
  assert.deepEqual(calls.map(c => `${c.m} ${c.u.replace("https://api.github.com/repos/grahamdeno/tabs", "")}`), ["GET /git/ref/heads/booth", "GET /git/ref/heads/main", "POST /git/refs", "PUT /contents/booth/2026-11-14/C-ab12cd.wav", "PUT /contents/booth/2026-11-14/C-ab12cd.json"]);
  assert.ok(calls.every(c => c.auth === "Bearer github_pat_server"), "the server's own key");
  assert.ok(calls.filter(c => c.m === "PUT").every(c => c.body.branch === "booth"));
  assert.match(calls[3].body.message, /C by Mike/);
  assert.deepEqual(JSON.parse(Buffer.from(calls[4].body.content, "base64")), { kind: "chord", chords: ["C"], player: "Mike" });
  assert.equal(booth.sameCode("a", "a"), true); assert.equal(booth.sameCode("a", "ab"), false); assert.equal(booth.sameCode("", ""), false, "no code set means no way in");
});
