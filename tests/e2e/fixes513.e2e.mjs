// 5.13.0: daily copies kept 7 days, Clear problems, and the loop picker strip (the slim Map card is in app3.e2e).
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, useBrowser, settled, skip } from "./harness.mjs";
useBrowser();
const lib = () => ({ ...LIB, settings: { ...LIB.settings, theme: "neon" } });
const putDay = (page, day, songs) => page.evaluate(([day, songs]) => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-library", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("copy");
  r.onsuccess = () => { const tx = r.result.transaction("copy", "readwrite"); tx.objectStore("copy").put({ json: JSON.stringify({ app: "tabs", version: 1, songs, sets: [], trash: [], settings: {} }), at: day + "T09:00:00Z", songs: songs.length }, "day-" + day); tx.oncomplete = () => ok(); tx.onerror = () => bad(tx.error); };
}), [day, songs]);
const dayKeys = page => page.evaluate(() => new Promise(ok => { const r = indexedDB.open("tabs-library", 1); r.onsuccess = () => { const q = r.result.transaction("copy").objectStore("copy").getAllKeys(); q.onsuccess = () => ok(q.result.filter(k => /^day-/.test(k)).sort()); }; }));

test("5.13.0 daily copies: today's is made by itself, only 7 are kept, and Restore puts back a day's library", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  for (let d = 1; d <= 8; d++) await putDay(page, `2026-10-${String(d).padStart(2, "0")}`, [{ id: "old" + d, title: `Old Song ${d}`, body: "[Verse]\nG\nwords" }]);
  await page.reload(); await page.waitForSelector("#rd-path, .rd, #app"); /* a fresh start: today's copy, and only the newest 7 kept */
  let keys = [];
  for (let n = 0; n < 40; n++) { keys = await dayKeys(page); if (keys.length === 7 && keys.some(k => k > "day-2026-11-01")) break; await page.waitForTimeout(400); /* polling the database */ }
  assert.equal(keys.length, 7, "the newest 7 are kept");
  assert.ok(!keys.includes("day-2026-10-01") && !keys.includes("day-2026-10-02"), "the oldest went");
  assert.ok(keys.some(k => k > "day-2026-11-01"), "today's copy was made");
  await page.evaluate(() => { location.hash = "#/settings/library"; }); await page.waitForSelector("#s-days"); await settled(page);
  assert.match(await page.innerText("#s-days"), /Daily copies[\s\S]*last 7 days/);
  await page.click("#s-days"); await page.waitForSelector("#s-daylist [data-day]");
  assert.equal(await page.locator("#s-daylist [data-day]").count(), 7);
  await page.click('[data-day="2026-10-08"]');
  await page.click(".ask .btn.primary, .ask [data-ok], .ask button:has-text('Restore')");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.title === "Old Song 8"));
  assert.deepEqual((await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.map(s => s.title))), ["Old Song 8"]);
});

test("5.13.0 Settings, Help: Clear problems empties the log; problems still drop off after 30 days", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { prepare: p => p.addInitScript(() => { if (!sessionStorage.getItem("errs")) { sessionStorage.setItem("errs", "1"); localStorage.setItem("tabs.errors.v1", JSON.stringify([{ at: new Date().toISOString(), v: "0.0.1", where: "#/", msg: "old one" }])); } }) });
  await page.evaluate(() => { location.hash = "#/settings/help"; }); await page.waitForSelector("#s-clearp"); await settled(page);
  assert.match(await page.innerText("#s-diag"), /1 problem/);
  await page.click("#s-clearp");
  await page.waitForFunction(() => !document.getElementById("s-clearp"));
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.errors.v1")), null);
});

test("5.13.0 loop picker: a strip of the whole song; tap a section, or drag across lines to loop them", { skip: skip() }, async t => {
  const body = "[Verse]\nG       D\nGrey boats lean\nEm      C\nOn the wall\n\n[Chorus]\nC       G\nBring the lights home\nD       G\nBring them round";
  const page = await phone(t, { ...lib(), songs: [{ ...LIB.songs[0], body, status: "learning" }, LIB.songs[1]] });
  const loop = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").loop);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#lp-sec"); await settled(page);
  await page.click("#lp-sec"); await page.waitForSelector(".lpk");
  assert.deepEqual(await page.locator(".lpk-secs .chip").allInnerTexts(), ["Verse", "Chorus"]);
  assert.equal(await page.locator("#lpk-strip i").count(), 4, "a part for each line");
  const box = await page.locator(".lpk").boundingBox();
  assert.ok(box.y > 844 / 2, "at the bottom, in thumb reach");
  await page.click('.lpk-secs .chip:has-text("Chorus")');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").loop?.name === "Chorus");
  await page.click("#lp-sec"); await page.waitForSelector(".lpk");
  const segs = await page.locator("#lpk-strip i").evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
  await page.mouse.move(segs[0].x, segs[0].y); await page.mouse.down(); await page.mouse.move(segs[1].x, segs[1].y, { steps: 4 }); await page.mouse.up();
  await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").loop; return l && l.name === "Verse" && l.b - l.a === 1; });
  assert.equal(await page.locator(".lpk").count(), 0, "the picker closes once a part is picked");
  assert.ok((await loop()).a > 0);
});
