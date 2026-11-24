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

test("5.2.0 the song and the Gig share one amp bar: the Pause word is the centre knob, and there is no second bar", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: GIG }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  await page.click("#play"); await page.waitForFunction(() => document.getElementById("play").getAttribute("aria-label") === "Pause"); await settled(page);
  assert.equal(await page.locator("#gg-pause, .gg-bar").count(), 0, "the Gig does not add a second bar");
  assert.equal((await page.innerText("#play")).trim(), "Pause", "the centre knob says Pause");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause", "the name stays for VoiceOver");
  const view = 390 / 2;
  const mid = await page.evaluate(() => { const r = document.getElementById("amp-bar").getBoundingClientRect(); return r.x + r.width / 2; });
  assert.ok(Math.abs(mid - view) <= 8, `the amp bar is centred, middle ${mid}`);
  await page.click("#play"); await page.waitForSelector("body.held"); await settled(page);
  assert.equal((await page.innerText("#play")).trim(), "Play", "pausing puts Play back on the same knob");
  assert.equal(await page.locator("#amp-bar").count(), 1);
});

test("5.2.0 Play is the centre knob of the amp bar on the song page", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [song("a", 1.3)], settings: PLAIN }, { home: true, size50: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await open(page, "a");
  const place = await page.evaluate(() => {
    const slots = [...document.querySelectorAll("#amp-bar .amp-slot")].map(b => b.id);
    const play = document.getElementById("play").getBoundingClientRect();
    const bar = document.getElementById("amp-bar").getBoundingClientRect();
    return { slots, play: play.x + play.width / 2, left: bar.x, width: bar.width };
  });
  assert.deepEqual(place.slots, ["pw-speed", "play", "pw-loop", "more"]);
  assert.ok(place.play > place.left + place.width * 0.2 && place.play < place.left + place.width * 0.55, `Play is the centre knob (${place.play})`);
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
  await page.click("#play"); await page.waitForFunction(() => document.getElementById("play").getAttribute("aria-label") === "Pause"); await settled(page);
  assert.equal(await noOverlap(page, ["pw-speed", "play", "pw-loop", "more"]), 4, "the same amp bar stays during the Gig, with no overlap");
});
