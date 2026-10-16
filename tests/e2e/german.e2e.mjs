// German practice (2.10): translate a song once, pick a level, tap a word.
// The song and its translation are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
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
  const page = await phone(t, { ...LIB, songs: [{ id: "h", title: "Harbor Lights", artist: "The Cape Fear", key: "G", format: "chords", body: BODY }, ...LIB.songs] });
  let asked = 0, sent = "";
  await page.route(/api\.anthropic\.com/, r => { asked++; sent = r.request().postData(); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(REPLY) }], stop_reason: "end_turn" }) }); });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  await page.goto(page.url().replace(/#.*$/, "") + "#/song/h"); await page.waitForTimeout(500);
  assert.ok(await page.locator("#dechip").isHidden(), "no German chip before a translation");
  await page.click("#more"); await page.click(".menu [data-m='de']"); await page.waitForTimeout(300);
  await page.click("#de-go");
  await page.waitForSelector(".de-lv", { timeout: 8000 });
  assert.equal(asked, 1);
  assert.match(sent, /Grey boats lean on the harbor wall/, "only this song's lines are sent");
  assert.doesNotMatch(sent, /River Road|Walking down/, "no other song is sent");
  // New songs start at Basic.
  assert.match(await words(page), /Grey Boote lean on the harbor wall \| Bring the Lichter home/);
  assert.equal(await page.locator(".sheet .de.g-das").count(), 2, "Boote and Lichter, neuter");
  assert.match(await page.innerText("#dechip"), /DE\s*Basic/);
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
  await page.click("[data-en='off']"); await page.click("#de-x"); await page.waitForTimeout(200);
  await page.click("#more"); await page.click(".menu [data-m='de']"); await page.click(".de-lv[data-lv='2']"); await page.click("#de-x"); await page.waitForTimeout(200);
  await page.click(".sheet .de.g-die"); await page.waitForTimeout(400);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/de-card.png" });
  const card = await page.innerText(".decard");
  assert.match(card, /die\s+Hafenmauer/); assert.match(card, /Hafen \(harbor\) \+ Mauer \(wall\)/); assert.match(card, /die Hafenmauern/);
  // Never in a backup or a shared song.
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "h");
  assert.ok(saved.de, "kept on the phone");
  const out = await page.evaluate(async () => { const C = await import("./core.js"); const d = JSON.parse(localStorage.getItem("tabs-v1")); return { backup: C.Tabs.export(d), share: JSON.stringify(C.shareable(d.songs.find(s => s.id === "h"))) }; });
  assert.doesNotMatch(out.backup, /Hafenmauer/); assert.doesNotMatch(out.share, /Hafenmauer/);
});
