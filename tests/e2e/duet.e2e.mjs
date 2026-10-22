// Play together (4.29.0): pick your part, Send song shares the song without a start time, and one clap
// heard by the microphone starts the count-in. No server.
import test from "node:test";
import assert from "node:assert/strict";
import { base, chromium, skip, LIB, FAKE_MIC, phone, useBrowser, tool } from "./harness.mjs";
useBrowser();

test("Play together: parts, Send song without a start time, and a clap starts the count-in", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addInitScript(FAKE_MIC);
  await ctx.addInitScript(json => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } }, JSON.stringify({ ...LIB, settings: { ...LIB.settings, countIn: true } }));
  const me = await ctx.newPage();
  const errors = []; me.on("pageerror", e => errors.push(String(e)));
  await me.goto(base + "#/song/a"); await me.waitForSelector("#more");
  await tool(me, "duet"); await me.waitForSelector("#pt-listen");
  const sheet = await me.innerText("[aria-label='Play together']");
  assert.match(sheet, /Your part[\s\S]*Chords[\s\S]*Bass line/i);
  assert.doesNotMatch(sheet, /Melody/, "no sung melody, no Melody part");
  assert.doesNotMatch(sheet, /In 1 min|start time/i, "the start-time picker is gone");
  await me.click("[data-part='bass']");
  assert.equal(await me.getAttribute("[data-part='bass']", "aria-pressed"), "true");
  assert.match(await me.innerText("#pt-pnote"), /Bex plays the bass line/);
  /* Send song: the song, its tempo and length, and no start time */
  await me.click("#pt-send");
  await me.waitForFunction(async () => /#\/import\//.test(await navigator.clipboard.readText().catch(() => "")));
  const url = await me.evaluate(() => navigator.clipboard.readText());
  const got = await me.evaluate(async u => (await import("./core.js")).unpackShare(u.split("#/import/")[1]), url);
  assert.equal(got.song.title, "River Road"); assert.equal(got.song.duration, 30);
  assert.ok(got.duet && got.duet.at === undefined, "marked as Play together, with no start time");
  /* Listen for clap: one sharp onset starts the count-in */
  await me.click("[data-part='chords']");
  await me.click("#pt-listen");
  await me.waitForFunction(() => /Listening/.test(document.getElementById("pt-listen")?.textContent || ""));
  assert.equal(await me.evaluate(() => document.body.classList.contains("playing")), false, "nothing before the clap");
  await me.waitForTimeout(500); /* real timer: past the quiet moment after the tap */
  await me.evaluate(() => { window.__gain = 0.9; window.__hz = 220; });
  await me.waitForFunction(() => document.body.classList.contains("playing"), null, { timeout: 5000 });
  await me.evaluate(() => { window.__hz = 0; });
  assert.equal(await me.locator(".countin").count(), 1, "the one-bar count-in");
  assert.equal(await me.locator("[aria-label='Play together']").count(), 0, "the sheet goes");
  assert.deepEqual(errors, []);
});

test("Play together: a link, even an old one with a start time, opens the song and Play together", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [] });
  const code = await page.evaluate(async s => (await import("./core.js")).packShare({ song: s, duet: { at: Date.now() - 60000, bpm: 90 } }), { title: "Late Song", body: "G C\nla" });
  await page.goto(base + "#/import/" + code); await page.reload();
  await page.waitForSelector("#pj-yes", { timeout: 8000 });
  assert.match(await page.innerText("[aria-label='Play together']"), /Late Song/);
  await page.click("#pj-yes");
  await page.waitForSelector("#pt-listen", { timeout: 8000 });
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.length === 1); /* the song was added */
});
