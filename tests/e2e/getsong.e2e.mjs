// Get the song: one tap from a search miss gathers the AI chart, the
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

const TRACK = { trackName: "Harbor Lights", artistName: "The Cape Fear", collectionName: "Northern Coast", trackViewUrl: "https://music.apple.com/us/album/a/1?i=5", trackTimeMillis: 221000, artworkUrl100: "https://is1-ssl.mzstatic.com/hl/100x100bb.jpg" };
async function setup(t, { bpm = true, extra = {}, placed = { found: false }, results = null, aiDelay = 0 } = {}) {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false }, ...extra });
  await page.evaluate(k => { localStorage.setItem("tabs.apikey.v1", "sk-ant-test"); if (k) localStorage.setItem("tabs.bpmkey.v1", "bpm-test"); }, bpm);
  const calls = { lrc: 0, bpm: [], ai: 0 };
  await page.route(/api\.anthropic\.com/, async r => { calls.ai++; if (process.env.SHOT || aiDelay) await new Promise(ok => setTimeout(ok, aiDelay || 2500));
    const placing = /You place a song's chords/.test(JSON.parse(r.request().postData() || "{}").system || ""); /* 4.41.0: the second call */
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(placing ? placed : CHART) }], stop_reason: "end_turn" }) }); });
  await page.route(/lrclib\.net\/api\/search/, r => { calls.lrc++; calls.lrc === 1 ? r.fulfill({ status: 429, headers: { ...cors, "retry-after": "0.2" }, body: "{}" }) : r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(VERSIONS) }); });
  await page.route(/api\.getsong\.co/, r => { calls.bpm.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ search: [{ id: "x", title: "Harbor Lights", tempo: "92", time_sig: "3/4", artist: { name: "The Cape Fear" } }] }) }); });
  await page.route(/itunes\.apple\.com\/search/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: results || [{ ...TRACK, trackTimeMillis: undefined }] }) }));
  await page.route(/mzstatic\.com/, r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") }));
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
  assert.match(await page.innerText("#fc-ai"), /Get the chords/); /* 4.48.0: the row says what it does */
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
  await page.waitForSelector(".cover-head img");
  assert.match(await page.innerText(".cover-head"), /Harbor Lights\s*The Cape Fear/, "the cover header, with Apple's art");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/gs-review.png" });
  // Another recording: the words re-fit under the same chords
  await page.click("#gs-pick");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/gs-ver.png" });
  await page.click(".gs-ver:has-text('Live at the Pier')"); await page.click("#gs-use");
  assert.match(await page.evaluate(() => document.querySelector(".gs-chart").textContent), /pier words one/);
  assert.match(await page.innerText("#gs-pick"), /Live at the Pier · 4:20/);
  await page.click("#gs-add");
  await page.waitForTimeout(500);
  const s = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(x => x.title === "Harbor Lights");
  assert.equal(s.art, "https://is1-ssl.mzstatic.com/hl/600x600bb.jpg", "the cover is kept");
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

test("Get the song: pick how hard (Easy, My level, As recorded); the pick is kept and sent with your chords", { skip: skip() }, async t => {
  const { page } = await setup(t);
  const asked = [];
  page.on("request", r => { if (/api\.anthropic\.com/.test(r.url())) asked.push(JSON.parse(r.postData() || "{}")); });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  assert.equal(await page.getAttribute("#gs-level [data-lv='mine']", "aria-pressed"), "true", "My level by default");
  assert.match(asked[0].system, /Level: the player's own/);
  assert.match(asked[0].messages[0].content, /Chords I play: /, "your chords go with it");
  await page.click("#gs-level [data-lv='rec']");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  assert.equal(await page.getAttribute("#gs-level [data-lv='rec']", "aria-pressed"), "true");
  const chart = asked.filter(a => /Level:/.test(a.system)).at(-1); /* 4.41.0: the chart call, not the placing one */
  assert.match(chart.system, /Level: as recorded/);
  assert.doesNotMatch(chart.messages[0].content, /Chords I play/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.chartLevel, "rec", "kept for next time");
});

const F = { n: 5, first: "2026-01-01" };
const JOURNAL = { v: 1, since: "2026-01-01", seeded: "2026-01-01", secs: 0, changes: {}, keys: {}, months: {}, week: Array(168).fill(0), best: 0, firsts: [], tune: { n: 0, checked: Array(6).fill(0), drift: Array(6).fill(0) }, chords: { G: F, D: F, Em: F } };
test("4.27.0 Get the song keeps what it found: a tap outside puts it aside, its bar brings it back, a reload keeps it, Not this one lets go", { skip: skip() }, async t => {
  const { page } = await setup(t, { extra: { journal: JOURNAL } });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  /* the review: whether you can play it, Add at the bottom, the recording as one row */
  assert.match(await page.innerText(".gs-can"), /1 new chord: C[\s\S]*G · D · Em · C/);
  assert.equal(await page.innerText("#gs-add"), "Add to my songs");
  const addBox = await page.locator("#gs-add").boundingBox();
  assert.ok(addBox.y > 700, "Add is in thumb reach at the bottom");
  assert.equal(await page.locator("#gs-x").count(), 0, "no Cancel");
  /* Which recording: cards, the closest length first and marked */
  await page.click("#gs-pick"); await page.waitForSelector(".gs-ver");
  assert.match(await page.innerText(".gs-ver >> nth=0"), /Northern Coast[\s\S]*Best match/i);
  await page.click(".gs-ver:has-text('Live at the Pier')");
  assert.match(await page.innerText(".gs-ver.on"), /Live at the Pier/);
  await page.click("#gs-use"); await page.waitForSelector("#gs-add");
  assert.match(await page.innerText("#gs-pick"), /Live at the Pier/);
  await page.click("#gs-level [data-lv='mine']"); /* the same level: nothing changes */
  /* a tap outside puts it aside (a swipe down goes through the same tap) */
  await page.evaluate(() => document.getElementById("gs-scrim").click());
  await page.waitForSelector("#gs-kept");
  assert.equal(await page.locator(".panel").count(), 0);
  assert.match(await page.innerText("#gs-kept"), /Harbor Lights is ready\s*Not added yet/);
  assert.ok(await page.evaluate(() => !!sessionStorage.getItem("tabs.gs.kept.v1")));
  /* its bar brings it back exactly as it was */
  await page.click("#gs-kept-open"); await page.waitForSelector("#gs-add");
  assert.match(await page.innerText("#gs-pick"), /Live at the Pier/, "the same recording");
  assert.equal(await page.getAttribute("#gs-level [data-lv='mine']", "aria-pressed"), "true", "the same level");
  assert.equal(await page.locator("#gs-kept").count(), 0, "the bar goes while the sheet is open");
  /* the arrow puts it aside too, and a reload keeps it */
  await page.click("#gs-aside"); await page.waitForSelector("#gs-kept");
  await page.reload(); await page.waitForSelector("#gs-kept");
  assert.match(await page.innerText("#gs-kept"), /Harbor Lights is ready/);
  await page.click("#gs-kept-add");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(x => x.title === "Harbor Lights" && x.words));
  const s = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(x => x.title === "Harbor Lights" && x.words);
  assert.deepEqual(s.words, { src: "lrclib", id: 2 }, "added with the recording chosen before the reload");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("tabs.gs.kept.v1")), null);
  /* Not this one lets it go */
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#q");
  await search(page, "harbor lights two");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  await page.click("#gs-no");
  await page.waitForFunction(() => !document.querySelector(".panel"));
  await page.waitForTimeout(500); /* real timer: the bar would show after the route settles */
  assert.equal(await page.locator("#gs-kept").count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("tabs.gs.kept.v1")), null);
});

/* 4.41.0: the AI reads the numbered words and the chord sites and answers with positions only */
const PLACED = { found: true, confidence: "high", sheet: [{ section: "Intro", chords: "G D" }, { section: "Verse", stanza: 1 }, { section: "Chorus", stanza: 2 }],
  lines: [{ n: 1, c: [[1, "G"], [6, "D"]] }, { n: 2, c: [[3, "Em"]] }, { n: 3, c: [[2, "C"]] }, { n: 4, c: [[4, "G"], [6, "D"]] }] };
test("4.41.0 Get the song puts each chord over the word the chord sites have it on, from positions the AI sends back", { skip: skip() }, async t => {
  const { page } = await setup(t, { placed: PLACED });
  const asked = [];
  page.on("request", r => { if (/api\.anthropic\.com/.test(r.url())) asked.push(JSON.parse(r.postData() || "{}")); });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  const place = asked.find(a => /You place a song's chords/.test(a.system));
  assert.ok(place, "a second call places the chords");
  assert.match(place.system, /Don't write any of the lyrics in your reply/);
  assert.match(place.messages[0].content, /1\| \[1\]grey \[2\]boats/, "the words go numbered");
  assert.match(await page.evaluate(() => document.querySelector(".gs-chart").textContent), /\[Intro\]\nG {3}D[\s\S]*G {22}D\ngrey boats lean on the harbor wall/, "D over harbor");
  assert.match(await page.innerText(".gs .foot"), /the word the chord sites have it on/);
  await page.click("#gs-add");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.spots === "placed"));
});

test("4.41.0 a song whose chords were guessed is lined up once when opened, with Undo", { skip: skip() }, async t => {
  const guessed = "[Verse]\nG               D\ngrey boats lean on the harbor wall\nEm           C\nwaiting on a tide to call\nG            D\nwaiting on a tide to fall\nEm        C\nbring the long way round"; /* the old guess: the second chord over the middle word */
  const { page } = await setup(t, { placed: { ...PLACED, sheet: [{ section: "Verse", stanza: 1 }], lines: [{ n: 1, c: [[1, "G"], [6, "D"]] }, { n: 2, c: [[4, "Em"]] }, { n: 3, c: [[2, "C"]] }, { n: 4, c: [[1, "G"]] }] },
    extra: { songs: [...LIB.songs, { id: "g", title: "Harbor Lights", artist: "The Cape Fear", format: "chords", key: "G", ai: "chart", body: guessed }] } });
  await page.evaluate(() => { location.hash = "#/song/g"; });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "g").spots === "placed");
  await page.waitForSelector("#toast.show");
  assert.match(await page.innerText("#toast"), /Lined up the chords in Harbor Lights[\s\S]*Undo/);
  const body = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "g").body);
  assert.match(body, /G {22}D\ngrey boats lean on the harbor wall/);
  await page.click("#toast button");
  await page.waitForFunction(b => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "g").body === b, guessed);
});

const lib = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));

test("4.57.0 Get the song shows one progress bar and rows you can read at a glance", { skip: skip() }, async t => {
  const { page } = await setup(t, { aiDelay: 2500 });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-bar");
  assert.equal(await page.getAttribute("#gs-bar", "role"), "progressbar");
  const w1 = await page.evaluate(() => parseFloat(document.getElementById("gs-fill").style.width));
  await page.waitForTimeout(900); /* real timer: the bar moves while the chords are worked out */
  const w2 = await page.evaluate(() => parseFloat(document.getElementById("gs-fill").style.width));
  assert.ok(w2 > w1, `the bar moves (${w1} to ${w2})`);
  assert.match(await page.innerText("#gs-say"), /Working out the chords · /, "one line says what is happening and the time left");
  assert.ok(await page.locator(".gs-row.working .gs-st.ring").count() >= 1, "a working row has its band and a ring (the lyrics search starts with the chords)");
  assert.match(await page.locator(".gs-row.working").first().getAttribute("aria-label"), /^Working out the chords, working$/);
  const order = await page.locator(".gs-row .gs-lb").allInnerTexts();
  assert.deepEqual(order, ["Working out the chords", "Finding the lyrics", "Finding the tempo", "Finding the recording", "Lining the chords up with the lyrics"].slice(0, order.length), "rows in the order the job runs");
  await page.waitForSelector(".gs-row.ok .gs-st.chk", { timeout: 8000 }); /* a check, not only a colour */
  await page.waitForSelector("#gs-add", { timeout: 15000 });
  assert.ok((await lib(page)).settings.gsTimes?.chart?.length >= 1, "each step's time is kept for sizing the bar next time");
});

test("4.57.0 a clear match for the recording is saved with the song, with its cover and length", { skip: skip() }, async t => {
  const { page } = await setup(t, { results: [TRACK] });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 10000 });
  assert.match(await page.innerText(".gs-rec.ok"), /Apple Music recording found[\s\S]*3:41[\s\S]*saved with the song/);
  await page.click("#gs-add"); await page.waitForTimeout(500);
  const s = (await lib(page)).songs.find(x => x.title === "Harbor Lights");
  assert.equal(s.listen.url, TRACK.trackViewUrl); assert.equal(s.listen.service, "Apple Music");
  assert.equal(s.listen.art, "https://is1-ssl.mzstatic.com/hl/600x600bb.jpg");
});

test("4.57.0 a weaker match asks: Yes saves the recording, No leaves it out", { skip: skip() }, async t => {
  for (const answer of ["yes", "no"]) {
    const weak = { ...TRACK, trackName: "Harbor Lights (Live)", artistName: "The Cape Fear Band" };
    const { page } = await setup(t, { results: [weak] });
    await search(page, "harbor lights");
    await page.click("#fc-ai");
    await page.waitForSelector("#gs-add", { timeout: 10000 });
    assert.match(await page.innerText(".gs-rec.ask"), /Use this recording\?/);
    await page.click(answer === "yes" ? "#gs-rec-yes" : "#gs-rec-no");
    await page.click("#gs-add"); await page.waitForTimeout(500);
    const s = (await lib(page)).songs.find(x => x.title === "Harbor Lights");
    if (answer === "yes") assert.equal(s.listen?.url, weak.trackViewUrl); else assert.equal(s.listen, undefined, "No: nothing saved");
  }
});

test("4.57.0 no match says Not found and saves nothing", { skip: skip() }, async t => {
  const { page } = await setup(t, { results: [] });
  await search(page, "harbor lights");
  await page.click("#fc-ai");
  await page.waitForSelector("#gs-add", { timeout: 10000 });
  assert.equal(await page.locator(".gs-rec").count(), 0);
  await page.click("#gs-add"); await page.waitForTimeout(500);
  assert.equal((await lib(page)).songs.find(x => x.title === "Harbor Lights").listen, undefined);
});
