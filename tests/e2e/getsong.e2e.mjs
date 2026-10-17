// Get the song (2.7): one tap from a search miss gathers the AI chart, the
// words (LRCLIB) and the tempo (GetSongBPM), and saves one playable song.
// The song and its words are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const CHART = { found: true, title: "Harbor Lights", artist: "The Cape Fear", album: "Northern Coast", duration: 222, key: "G", capo: 0, tuning: "standard", bpm: 90, strum: "D DU UDU",
  sections: [{ name: "Verse", chords: "G D Em C", repeat: 1 }, { name: "Chorus", chords: "C G D", repeat: 1 }], confidence: "high" };
const V = (id, albumName, duration, plain) => ({ id, trackName: "Harbor Lights", artistName: "The Cape Fear", albumName, duration, instrumental: false, plainLyrics: plain, syncedLyrics: "[00:01.00] x" });
const VERSIONS = [V(2, "Live at the Pier", 260, "pier words one\npier words two\n\npier chorus line"), V(1, "Northern Coast", 221, "grey boats lean on the harbor wall\nwaiting on a tide to call\n\nbring the lights home\nbring the long way round"), V(3, "Karaoke Hits", 221, "k one\n\nk two")];
const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "retry-after" };

async function setup(t, { bpm = true } = {}) {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } });
  await page.evaluate(k => { localStorage.setItem("tabs.apikey.v1", "sk-ant-test"); if (k) localStorage.setItem("tabs.bpmkey.v1", "bpm-test"); }, bpm);
  const calls = { lrc: 0, bpm: [], ai: 0 };
  await page.route(/api\.anthropic\.com/, async r => { calls.ai++; if (process.env.SHOT) await new Promise(ok => setTimeout(ok, 2500)); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(CHART) }], stop_reason: "end_turn" }) }); });
  await page.route(/lrclib\.net\/api\/search/, r => { calls.lrc++; calls.lrc === 1 ? r.fulfill({ status: 429, headers: { ...cors, "retry-after": "0.2" }, body: "{}" }) : r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(VERSIONS) }); });
  await page.route(/api\.getsong\.co/, r => { calls.bpm.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ search: [{ id: "x", title: "Harbor Lights", tempo: "92", time_sig: "3/4", artist: { name: "The Cape Fear" } }] }) }); });
  await page.reload(); await page.waitForTimeout(300);
  return { page, calls };
}
const search = async (page, q) => {
  await page.click("#q").catch(() => {});
  await page.fill("#q", q); await page.dispatchEvent("#q", "input"); await page.waitForTimeout(400);
};

test("Get the song: one tap gathers chords, words and tempo, and saves a playable song", { skip: skip() }, async t => {
  const { page, calls } = await setup(t);
  await search(page, "harbor lights");
  assert.match(await page.innerText("#fc-ai"), /Get the song/);
  await page.click("#fc-ai");
  if (process.env.SHOT) { await page.waitForTimeout(1200); await page.screenshot({ path: process.env.SHOT + "/gs-work.png" }); }
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  assert.ok(calls.lrc >= 2, "a busy LRCLIB is asked again");
  assert.match(calls.bpm[0], /api_key=bpm-test/, "the key goes in the address (no preflight)");
  const meta = await page.innerText(".cs-meta");
  assert.match(meta, /Key G/); assert.match(meta, /92 BPM/, "measured tempo"); assert.match(meta, /3\/4/);
  assert.ok(await page.locator(".cs-meta .agree").count(), "chart and measured tempo agree");
  assert.match(await page.innerText("#gs-pick"), /Northern Coast · 3:41/, "the album cut, by length");
  const sheet = await page.innerText(".gs-chart");
  assert.match(sheet, /grey boats lean on the harbor wall/); assert.match(sheet, /G\s+D/);
  assert.match(await page.innerText(".cs-src"), /GetSongBPM\.com/, "credit shown");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/gs-review.png" });
  // Another recording: the words re-fit under the same chords
  await page.click("#gs-pick");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/gs-ver.png" });
  await page.click(".gs-ver:has-text('Live at the Pier')");
  assert.match(await page.innerText(".gs-chart"), /pier words one/);
  assert.match(await page.innerText("#gs-pick"), /Live at the Pier · 4:20/);
  await page.click("#gs-add");
  await page.waitForTimeout(500);
  const s = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(x => x.title === "Harbor Lights");
  assert.equal(s.bpm, 92); assert.equal(s.beats, 3); assert.equal(s.duration, 260); assert.deepEqual(s.words, { src: "lrclib", id: 2 }); assert.equal(s.key, "G");
  assert.match(s.body, /\[Verse\]\nG\s+D\s*\npier words one/);
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
});

test("Get the song: no GetSongBPM key and no words still adds the chords", { skip: skip() }, async t => {
  const { page, calls } = await setup(t, { bpm: false });
  await page.unroute(/lrclib\.net\/api\/search/);
  await page.route(/lrclib\.net\/api/, r => r.fulfill({ status: r.request().url().includes("/get") ? 404 : 200, contentType: "application/json", headers: cors, body: r.request().url().includes("/get") ? "{}" : "[]" }));
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  assert.equal(calls.bpm.length, 0, "no key: GetSongBPM isn't asked");
  assert.match(await page.innerText(".gs-pick"), /No lyrics found/);
  assert.match(await page.innerText(".cs-meta"), /90 BPM/, "the chart's tempo");
  assert.match(await page.innerText("#gs-edit"), /Paste the words/);
  await page.click("#gs-add"); await page.waitForTimeout(400);
  const s = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(x => x.title === "Harbor Lights");
  assert.equal(s.bpm, 90); assert.equal(s.words, undefined); assert.equal(s.beats, undefined);
});
