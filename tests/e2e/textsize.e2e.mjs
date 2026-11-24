// 4.121.0: the text size goes down to 50% and new songs start there; the Pause word is gone and Play sits in the middle of the bar.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const BODY = "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down";
const song = (id, size) => ({ id, title: "Short Road " + id, artist: "Me", key: "A", format: "chords", duration: 16, body: BODY, ...(size === undefined ? {} : { size }) });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
const open = async (page, id) => { await page.evaluate(id => { location.hash = "#/song/" + id; }, id); await page.waitForSelector("#play"); await settled(page); };
const GIG = { ...LIB.settings, plainPlay: false }, PLAIN = { ...LIB.settings, plainPlay: true };

test("4.121.0 the minus button stops at 50%, and the plus button still goes to 160%", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 0.8)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  await page.click("#more"); await page.waitForSelector('.mrow.size [data-d="-1"]');
  const press = d => page.click(`.mrow.size [data-d="${d}"]`);
  for (let i = 0; i < 6; i++) await press(-1);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].size === 0.5);
  await press(-1); await press(-1);
  assert.equal((await stored(page)).songs[0].size, 0.5, "more presses stay at 50%");
  for (let i = 0; i < 12; i++) await press(1);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].size === 1.6);
});

test("4.121.0 a new song starts at 50%", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a")], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].size === 0.5);
});

test("4.121.0 the one-time move: a size of exactly 1 becomes 0.5, 1.3 stays, and it never runs again", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1), song("b", 1.3), song("c", 0.8)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats");
  await page.waitForFunction(() => localStorage.getItem("tabs.size50.v1") === "1");
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("tabs-v1")).songs; return s.find(x => x.id === "a")?.size === 0.5; });
  const sizes = Object.fromEntries((await stored(page)).songs.map(s => [s.id, s.size]));
  assert.deepEqual(sizes, { a: 0.5, b: 1.3, c: 0.8 });
  /* set a song back to 100% yourself: a later start leaves it alone */
  await page.evaluate(async () => { const { Tabs } = await import("/core.js"), app = await import("/app.js"); app.data.songs[0].size = 1; Tabs.save(app.data); Tabs.flush(); });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].size === 1);
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats"); await settled(page);
  assert.equal((await stored(page)).songs[0].size, 1, "runs once");
});

test("4.121.0 the lyrics at 50% are smaller than at 100%", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 0.5), song("b", 1)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats");
  const sizeOf = async id => { await open(page, id); await page.waitForSelector("#sheet .ly, #sheet .pr"); return page.evaluate(() => parseFloat(getComputedStyle(document.getElementById("sheet")).getPropertyValue("--lyric-size"))); };
  const small = await sizeOf("a");
  /* b was 1, moved to 0.5 by the one-time move; put it back to 100% by hand */
  await page.evaluate(async () => { const { Tabs } = await import("/core.js"), app = await import("/app.js"); app.data.songs.find(s => s.id === "b").size = 1; Tabs.save(app.data); });
  const big = await sizeOf("b");
  assert.ok(small > 0 && small < big, `50% is ${small}px, 100% is ${big}px`);
  assert.ok(small <= big * 0.55, `about half: ${small} against ${big}`);
});

const centre = async (page, sel) => { const b = await page.locator(sel).boundingBox(); return b.x + b.width / 2; };

test("4.121.0 no Pause word under the button, and Play is in the middle of the bar, playing and paused, in a gig", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: GIG }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  await page.click("#play"); await page.waitForSelector("#gig"); await page.waitForSelector("#gg-pause"); await settled(page);
  assert.equal(await page.locator("#gg-pod small, .gg-bar #gg-pod small").count(), 0, "no small label under the button");
  assert.ok(!/Pause/.test(await page.innerText("#gg-pod")), "no Pause text under the button");
  assert.equal(await page.getAttribute("#gg-pause", "aria-label"), "Pause", "the name stays for VoiceOver");
  const view = 390 / 2;
  const mid = async () => { const bar = await page.locator(".gg-bar").count() ? await centre(page, ".gg-bar") : view; return [await centre(page, "#gg-pause"), bar]; };
  let [p, b] = await mid(); assert.ok(Math.abs(p - view) <= 2, `playing: Play at ${p}, middle ${view}`); assert.ok(Math.abs(p - b) <= 2, `playing: bar middle ${b}`);
  /* paused, the show steps aside and the song page's own bar is back (body.held) */
  await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
  /* the bar unfolds from the corner as the show steps aside: give it its second, then measure */
  await page.waitForFunction(() => { const r = document.getElementById("play").getBoundingClientRect(); return Math.abs(r.x + r.width / 2 - 195) <= 2; }, null, { timeout: 4000 }).catch(() => {});
  p = await centre(page, "#play"); b = await centre(page, ".player:visible >> nth=0");
  assert.ok(Math.abs(p - view) <= 2, `paused: Play at ${p}, middle ${view}`); assert.ok(Math.abs(p - b) <= 2, `paused: bar middle ${b}`);
});

test("4.121.0 Play is in the middle of the bar on the song page while paused (a song played in place folds Play into the corner, as before)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  const p0 = await centre(page, "#play"); assert.ok(Math.abs(p0 - 390 / 2) <= 2, `paused: Play at ${p0}, middle ${390 / 2}`);
  assert.ok(Math.abs((await centre(page, ".player")) - p0) <= 2, "and it is the middle of the bar");
});
