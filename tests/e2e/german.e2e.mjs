// German practice: translate a song once, pick a level, tap a word.
// The song and its translation are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled, showTool, tool } from "./harness.mjs";
/* 4.20.0: German lives in Tools (the chip under the title is gone); its tile shows where it stands */
const deTile = async page => { await showTool(page, "de"); const t = await page.innerText(".menu [data-m='de']"); await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" }); return t; };
const deOpen = async page => { await tool(page, "de"); };
useBrowser();

const BODY = "[Verse]\nG               D\nGrey boats lean on the harbor wall\nC        G\nBring the lights home";
const REPLY = { lines: [
  { i: 0, de: "Graue Boote lehnen an der Hafenmauer", s: [
    { w: 1, n: 1, l: 1, de: "Boote", g: "das", lemma: "das Boot", en: "boats", pl: "die Boote", built: "", note: "Plural of das Boot." },
    { w: 0, n: 1, l: 2, de: "Graue", g: "", lemma: "grau", en: "grey", pl: "", built: "", note: "Adjective ending -e before a plural noun." },
    { w: 5, n: 2, l: 2, de: "Hafenmauer", g: "die", lemma: "die Hafenmauer", en: "the harbor wall", pl: "die Hafenmauern", built: "Hafen (harbor) + Mauer (wall)", note: "an + dative: an der Hafenmauer." },
    { w: 0, n: 7, l: 3, de: "Graue Boote lehnen an der Hafenmauer", g: "", lemma: "", en: "grey boats lean on the harbor wall", pl: "", built: "", note: "" }] },
  { i: 1, de: "Bring die Lichter heim", s: [{ w: 2, n: 1, l: 1, de: "Lichter", g: "das", lemma: "das Licht", en: "lights", pl: "die Lichter", built: "", note: "" }] }
] };
const cors = { "access-control-allow-origin": "*" };
/* The sheet's words, line by line, without chord names (English underneath kept apart). */
const words = page => page.evaluate(() => [...document.querySelectorAll(".sheet .pr, .sheet .ly")].map(el => {
  const c = el.cloneNode(true); c.querySelectorAll(".c, .de-en").forEach(x => x.remove());
  return c.textContent.replace(/\s+/g, " ").trim();
}).join(" | "));

test("German practice: translate once, pick a level, tap a word; nothing leaves the phone", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, lang: "de" }, songs: [{ id: "h", title: "Harbor Lights", artist: "The Cape Fear", key: "G", format: "chords", body: BODY }, ...LIB.songs] });
  let asked = 0, sent = "";
  /* The reply streams (server-sent events), in small pieces as it's written. */
  await page.route(/api\.anthropic\.com/, r => {
    asked++; sent = r.request().postData();
    assert.equal(JSON.parse(sent).stream, true, "streamed");
    const text = JSON.stringify(REPLY), parts = text.match(/[\s\S]{1,40}/g);
    const ev = (type, o) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`;
    const body = ev("message_start", { message: {} }) + ev("content_block_start", { index: 0, content_block: { type: "text", text: "" } }) + parts.map(t => ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: t } })).join("") + ev("message_stop", {});
    r.fulfill({ status: 200, contentType: "text/event-stream", headers: cors, body });
  });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  await page.goto(page.url().replace(/#.*$/, "") + "#/song/h"); await page.waitForSelector("#more"); await settled(page);
  assert.match(await deTile(page), /German/, "Tools is the way in");
  await deOpen(page); await page.waitForSelector("#de-go");
  await page.click("#de-go");
  assert.equal(await page.locator(".de-sheet").count(), 0, "the sheet gets out of the way");
  await page.waitForFunction(() => document.querySelectorAll(".sheet .de").length > 0, null, { timeout: 8000 });
  assert.equal(asked, 1);
  assert.match(sent, /Grey boats lean on the harbor wall/, "only this song's lines are sent");
  assert.doesNotMatch(sent, /River Road|Walking down/, "no other song is sent");
  // New songs start at Basic.
  assert.match(await words(page), /Grey Boote lean on the harbor wall \| Bring the Lichter home/);
  assert.equal(await page.locator(".sheet .de.g-das").count(), 2, "Boote and Lichter, neuter");
  assert.match(await deTile(page), /German\s*BASIC/i);
  await deOpen(page); await page.waitForSelector(".de-lv");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/de-sheet.png" });
  // Common, then Intermediate, then Fluent with English underneath.
  await page.click(".de-lv[data-lv='2']");
  assert.match(await words(page), /Graue Boote lean on the Hafenmauer/);
  await page.click(".de-lv[data-lv='3']");
  assert.match(await words(page), /^Graue Boote lehnen an der Hafenmauer \| Bring the Lichter home$/);
  await page.click(".de-lv[data-lv='4']"); await page.click("[data-en='on']");
  assert.match(await words(page), /^Graue Boote lehnen an der Hafenmauer \| Bring die Lichter heim$/);
  assert.match(await page.innerText(".sheet"), /Bring the lights home/, "English underneath");
  assert.ok(await page.locator(".sheet .c[data-ch='G']").count(), "the chords stay");
  // Tap a word for its card.
  await page.click("[data-en='off']"); await page.click(".de-lv[data-lv='2']"); await page.click("#de-x"); await page.waitForSelector(".de-sheet", { state: "detached" });
  await page.click(".sheet .de.g-die"); await page.waitForSelector(".decard");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/de-card.png" });
  const card = await page.innerText(".decard");
  assert.match(card, /die\s+Hafenmauer/); assert.match(card, /Hafen \(harbor\) \+ Mauer \(wall\)/); assert.match(card, /die Hafenmauern/);
  // Never in a backup or a shared song.
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "h");
  assert.ok(saved.de, "kept on the phone");
  const out = await page.evaluate(async () => { const C = await import("./core.js"); const d = JSON.parse(localStorage.getItem("tabs-v1")); return { backup: C.Tabs.export(d), share: JSON.stringify(C.shareable(d.songs.find(s => s.id === "h"))) }; });
  assert.doesNotMatch(out.backup, /Hafenmauer/); assert.doesNotMatch(out.share, /Hafenmauer/);
});

const sse = obj => { const ev = (type, o) => `event: ${type}\ndata: ${JSON.stringify({ type, ...o })}\n\n`; return ev("message_start", { message: {} }) + ev("content_block_delta", { index: 0, delta: { type: "text_delta", text: JSON.stringify(obj) } }) + ev("message_stop", {}); };
const LONG = "[Verse]\n" + Array.from({ length: 8 }, (_, i) => `G   C\nline number ${i} of the harbor`).join("\n");
const reply = req => { const lines = JSON.parse(JSON.parse(req.postData()).messages[0].content.replace(/\n[\s\S]*$/, "")); return { lines: lines.map(l => ({ i: l.i, de: `Zeile ${l.line.split(" ")[2]}`, s: [{ w: 4, n: 1, l: 1, de: "Hafen", g: "der", lemma: "der Hafen", en: "harbor", pl: "die Häfen", built: "", note: "" }] })) }; };

test("German practice in the background: batches land as they come; a dropped connection keeps what's done and resumes", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, lang: "de" }, songs: [{ id: "l", title: "Long Song", artist: "X", format: "chords", body: LONG }, ...LIB.songs] });
  let calls = 0, fail = true;
  await page.route(/api\.anthropic\.com/, async r => {
    calls++;
    const first = JSON.parse(r.request().postData()).messages[0].content.includes("line number 0");
    if (!first && fail) return r.abort("connectionreset");             /* the second batch can't get through */
    if (!first) await new Promise(ok => setTimeout(ok, 600));
    r.fulfill({ status: 200, contentType: "text/event-stream", headers: { "access-control-allow-origin": "*" }, body: sse(reply(r.request())) });
  });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  await page.goto(page.url().replace(/#.*$/, "") + "#/song/l"); await page.waitForSelector("#more"); await settled(page);
  await deOpen(page); await page.click("#de-go");
  await page.waitForFunction(() => /German stopped at 6 of 8/.test(document.getElementById("toast")?.textContent || ""), null, { timeout: 8000 });
  assert.equal((await page.innerText(".sheet")).match(/Hafen/g)?.length, 6, "the first six lines are German already");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "l").de?.lines?.filter(Boolean).length === 6, null, { timeout: 5000 });  /* and kept */
  // Resume from the sheet, then leave the song while it finishes.
  fail = false;
  await deOpen(page); await page.waitForSelector(".de-sheet");
  assert.match(await page.innerText(".de-sheet"), /2 of 8 lines still need translating/);
  await page.click("#de-go");
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForFunction(() => /German ready: Long Song/.test(document.getElementById("toast")?.textContent || ""), null, { timeout: 8000 });
  await page.click("#toast button"); await page.waitForFunction(() => /#\/song\/l/.test(location.hash));
  assert.match(await page.evaluate(() => location.hash), /#\/song\/l/, "Open goes to the song");
  assert.equal((await page.innerText(".sheet")).match(/Hafen/g)?.length, 8, "every line");
  await page.waitForFunction(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "l").de; return d && !d.partial && d.lines.every(Boolean); }, null, { timeout: 5000 });
});

test("German opens from Tools, and its sheet closes with a swipe down", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, lang: "de" }, sets: [{ id: "s", name: "Gig", songIds: ["a", "b"] }] }, { isMobile: true });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  await page.goto(page.url().replace(/#.*$/, "") + "#/set/s"); await page.waitForSelector("[data-open='0']");
  await page.click("[data-open='0']"); await page.waitForSelector("#more"); await settled(page);
  // Swipe the German sheet down from its handle: it closes.
  await deOpen(page); await page.waitForSelector(".de-sheet");
  const g = await page.evaluate(() => { const r = document.querySelector(".de-sheet .grab").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: y == null ? [] : [{ x: g.x, y }] });
  await touch("touchStart", g.y); for (let k = 1; k <= 8; k++) { await touch("touchMove", g.y + k * 25); await page.waitForTimeout(16) /* real timer */; } await touch("touchEnd");
  await page.waitForSelector(".de-sheet", { state: "detached" });
  assert.equal(await page.locator(".de-sheet").count(), 0, "swiped away");
  // A short pull springs back.
  await deOpen(page); await page.waitForSelector(".de-sheet");
  await touch("touchStart", g.y + 40); await touch("touchMove", g.y + 70); await touch("touchEnd"); await page.waitForTimeout(400) /* real timer: the spring back settles */;
  assert.equal(await page.locator(".de-sheet").count(), 1, "a short pull keeps it");
});

/* 4.36.0: one language for every song. The lines and their translations are invented. */
const RU = { lines: [
  { i: 0, de: "Се́рые ло́дки у стены́ прича́ла", tr: "Sérye lódki u stený prichála", s: [
    { w: 1, n: 1, l: 1, de: "ло́дки", tr: "lódki", g: "f", lemma: "ло́дка", en: "boats", pl: "ло́дки", built: "", note: "Plural." }] },
  { i: 1, de: "Неси́ огни́ домо́й", tr: "Nesí ogní domóy", s: [{ w: 2, n: 1, l: 1, de: "огни́", tr: "ogní", g: "m", lemma: "ого́нь", en: "lights", pl: "огни́", built: "", note: "" }] }
] };
test("4.36.0 languages: pick one the first time, Russian with its sound in Latin letters, switching asks first", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [{ id: "h", title: "Harbor Lights", artist: "The Cape Fear", key: "G", format: "chords", body: BODY }, ...LIB.songs] });
  let sys = "";
  await page.route(/api\.anthropic\.com/, r => { sys = JSON.stringify(JSON.parse(r.request().postData()).system); r.fulfill({ status: 200, contentType: "text/event-stream", headers: cors, body: sse(RU) }); });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  await page.goto(page.url().replace(/#.*$/, "") + "#/song/h"); await page.waitForSelector("#more"); await settled(page);
  assert.match(await deTile(page), /Learn a language/, "nothing picked yet");
  await deOpen(page); await page.waitForSelector(".lp [data-lang='ru']");
  assert.deepEqual(await page.$$eval(".lp [data-lang]", b => b.map(x => x.dataset.lang)), ["de", "es", "ru"]);
  await page.click(".lp [data-lang='ru']"); assert.match(await page.innerText("#lp-go"), /Use Russian/);
  await page.click("#lp-go"); await page.waitForSelector("#de-go");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.lang === "ru");
  assert.match(await page.innerText(".de-sheet h2"), /Russian practice/);
  await page.click("#de-go");
  await page.waitForFunction(() => document.querySelectorAll(".sheet .de").length > 0, null, { timeout: 8000 });
  assert.match(sys, /learn Russian/); assert.match(sys, /stress/);
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "h").de);
  await page.waitForFunction(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "h").de; return d && !d.partial; });
  const de = await saved();
  assert.equal(de.lang, "ru"); assert.equal(de.lines[0].tr, "Sérye lódki u stený prichála", "the sound is kept");
  assert.equal(await page.locator(".sheet .de.g-f").count(), 1, "ло́дки, feminine");
  /* Fluent: the Russian line with its sound under it */
  await deOpen(page); await page.waitForSelector(".de-lv"); await page.click(".de-lv[data-lv='4']"); await page.click("#de-x");
  assert.match(await page.innerText(".sheet"), /Sérye lódki u stený prichála/);
  /* switching asks, and says how many songs lose their translation */
  await page.evaluate(() => { location.hash = "#/settings/lang"; }); await page.waitForSelector(".s-lp [data-lang='es']");
  assert.equal(await page.getAttribute(".s-lp [data-lang='ru']", "aria-checked"), "true");
  await page.click(".s-lp [data-lang='es']"); await page.waitForSelector(".ls-ask");
  assert.match(await page.innerText(".ls-ask"), /Switch to Spanish\?[\s\S]*Russian in your 1 translated song is deleted/);
  await page.click("#ls-keep"); await page.waitForSelector(".ls-ask", { state: "detached" });
  assert.ok(await saved(), "kept");
  await page.click(".s-lp [data-lang='es']"); await page.click("#ls-go");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.lang === "es");
  assert.equal(await saved(), undefined, "the Russian is gone");
});
