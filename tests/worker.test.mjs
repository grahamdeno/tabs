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
