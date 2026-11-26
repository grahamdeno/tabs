// 5.2.0: the text size goes down to 50% and new songs start there; the Pause word is gone and Play sits in the middle of the bar.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const BODY = "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home\nE        A\nLay me down";
const song = (id, size) => ({ id, title: "Short Road " + id, artist: "Me", key: "A", format: "chords", duration: 16, body: BODY, ...(size === undefined ? {} : { size }) });
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
const open = async (page, id) => { await page.evaluate(id => { location.hash = "#/song/" + id; }, id); await page.waitForSelector("#play"); await settled(page); };
const GIG = { ...LIB.settings, plainPlay: false }, PLAIN = { ...LIB.settings, plainPlay: true };

test("5.2.0 the minus button stops at 50%, and the plus button still goes to 160%", { skip: skip() }, async t => {
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

test("5.2.0 a new song starts at 50%", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a")], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].size === 0.5);
});

test("5.2.0 the one-time move: a size of exactly 1 becomes 0.5, 1.3 stays, and it never runs again", { skip: skip() }, async t => {
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

test("5.2.0 the lyrics at 50% are smaller than at 100%", { skip: skip() }, async t => {
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

test("5.2.0 no Pause word under the button, and Play is in the middle of the bar, playing and paused, in a gig", { skip: skip() }, async t => {
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

test("5.2.0 Play is in the middle of the bar on the song page while paused (a song played in place folds Play into the corner, as before)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  const p0 = await centre(page, "#play"); assert.ok(Math.abs(p0 - 390 / 2) <= 2, `paused: Play at ${p0}, middle ${390 / 2}`);
  assert.ok(Math.abs((await centre(page, ".player")) - p0) <= 2, "and it is the middle of the bar");
});

/* 5.2.0 (Fable's review): at 320 px the centred Play met Loop. No two buttons in either bar overlap, and each stays 44 px. */
const noOverlap = async (page, ids) => {
  const r = await page.evaluate(ids => ids.map(id => { const e = document.getElementById(id); if (!e || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return { id, l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; }).filter(Boolean), ids);
  for (const a of r) assert.ok(a.w >= 44 && a.h >= 44, `${a.id} is ${a.w}×${a.h}, at least 44 px`);
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
    const a = r[i], c = r[j], x = Math.min(a.r, c.r) - Math.max(a.l, c.l), y = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    assert.ok(x <= 0.5 || y <= 0.5, `${a.id} and ${c.id} overlap by ${x.toFixed(1)} px`);
  }
  return r.length;
};
test("5.2.0 at 320 px no two bar buttons overlap, on the paused song page and in the Gig", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: GIG }, { home: true, size50: true, viewport: { width: 320, height: 640 } });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  assert.equal(await noOverlap(page, ["pw-speed", "play", "pw-loop", "more"]), 4, "the song page bar has all four buttons");
  await page.click("#play"); await page.waitForSelector("#gg-pause"); await settled(page);
  assert.equal(await noOverlap(page, ["gg-speed", "gg-pause", "gg-loop", "gg-tools"]), 4, "the Gig bar has all four buttons");
});

test("5.3.1 no section rail; a long line runs to 12 px from the right edge; Play is centred top to bottom in the bar", { skip: skip() }, async t => {
  const LONG = "[Verse]\nG\nWhere all good men are trampled down and more words here too, and more\n[Chorus]\nC\nla la";
  const page = await phone(t, { ...LIB, songs: [{ ...song("a", 1), body: LONG }], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  assert.equal(await page.locator(".smap").count(), 0, "no rail");
  const right = await page.evaluate(() => document.getElementById("sheet").getBoundingClientRect().right);
  assert.ok(Math.abs(right - (390 - 12)) <= 1, `the song's lines may run to 12 px from the edge (${right})`);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#sheet > .pr, #sheet > .ly")).marginRight), "0px", "no right margin kept for a rail");
  const r = await page.evaluate(() => { const b = document.querySelector(".player").getBoundingClientRect(), p = document.getElementById("play").getBoundingClientRect(); return { bar: b.top + b.height / 2, play: p.top + p.height / 2 }; });
  assert.ok(Math.abs(r.bar - r.play) <= 1.5, `Play's middle ${r.play} is the bar's middle ${r.bar}`);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "Play keeps its spoken name");
});

test("5.7.0 lyrics run close to the right edge: on the song page a long line fills at least 85% of the width before it wraps", { skip: skip() }, async t => {
  const LONG = "[Verse]\nG\nWhere all good men are trampled down and the long line keeps on going past the edge of the page";
  const page = await phone(t, { ...LIB, songs: [{ ...song("a", 1), body: LONG }], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  const r = await page.evaluate(() => { const sh = document.getElementById("sheet").getBoundingClientRect(); const ws = [...document.querySelectorAll("#sheet > .pr .w")].map(w => w.getBoundingClientRect());
    const firstRowBottom = Math.min(...ws.map(w => w.bottom)); const row1 = ws.filter(w => Math.abs(w.bottom - firstRowBottom) < 4);
    return { fill: (Math.max(...row1.map(w => w.right)) - sh.left) / sh.width, rows: new Set(ws.map(w => Math.round(w.bottom))).size, inside: ws.every(w => w.right <= sh.right + 1) }; });
  assert.ok(r.rows >= 2, "the line wraps"); assert.ok(r.inside, "no word passes the edge");
  assert.ok(r.fill >= 0.85, `the first row fills ${(r.fill * 100).toFixed(0)}% of the width (it was about 75% when lines were laid out at 34)`);
});
