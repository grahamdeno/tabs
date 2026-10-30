// Your guitarist (4.85.0): made once, drawn where the app means you, and Louie stays the mascot elsewhere.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const { me: _me, ...NOME } = LIB;
const PLAYED = songs => songs.map(s => ({ ...s, playLog: { days: { "2026-10-28": 12, "2026-10-29": 12 } } }));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
const hash = (page, h) => page.evaluate(h => { location.hash = h; }, h);

test("4.85.0 a player who never made a guitarist is asked once on the Road, and Louie stays the Road's mascot", { skip: skip() }, async t => {
  const page = await phone(t, { ...NOME, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector(".gm");
  assert.match(await page.innerText(".gm"), /Who's playing tonight\?/);
  assert.match(await page.innerText(".gm"), /I drew you a guitarist/, "Louie asks");
  await page.click('.gm [data-k="starter"][data-v="4"]');
  await page.click("#gm-ok");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).me?.hair === "braids");
  await page.waitForSelector(".rd-bubble");
  assert.equal(await page.locator(".gm").count(), 0, "the sheet closes");
  assert.ok(await page.locator(".rd-say .louie").count() >= 1, "Louie still talks on the Road");
  await page.reload(); await page.waitForSelector(".rd-bubble"); await settled(page);
  assert.equal(await page.locator(".gm").count(), 0, "asked once");
});

test("4.85.0 Skip keeps the default and doesn't ask again", { skip: skip() }, async t => {
  const page = await phone(t, { ...NOME, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector(".gm");
  await page.click("#gm-skip");
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("tabs-v1")).me);
  await page.reload(); await page.waitForSelector(".rd-bubble"); await settled(page);
  assert.equal(await page.locator(".gm").count(), 0);
});

test("4.85.0 your profile card shows your guitarist; the maker changes it and saves as you tap", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs), me: { skin: 4, hair: "locs", hairCol: "purple", top: "teal" } }, { home: true });
  await page.waitForSelector(".rd-bubble"); await hash(page, "#/you"); await page.waitForSelector(".pf-player");
  assert.equal(await page.locator('.pf-pc-lou svg[aria-label="Your guitarist"]').count(), 1);
  await page.click("#pf-me"); await page.waitForSelector(".gm");
  assert.equal(await page.locator(".gm button[aria-pressed]").count() > 20, true, "every choice is a pressed-state button");
  await page.click('.gm [data-k="hair"][data-v="pixie"]');
  await page.click('.gm [data-k="glasses"][data-v="true"]');
  await page.click('.gm [data-k="lefty"][data-v="true"]');
  await page.click('.gm [data-k="beard"][data-v="stubble"]');
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem("tabs-v1")).me; return m?.hair === "pixie" && m.glasses && m.lefty && m.beard === "stubble"; });
  assert.equal(await page.locator(".gm .gm-prev svg").getAttribute("aria-label"), "Your guitarist");
  assert.equal(await page.locator('.gm .gm-c.lock[disabled]').count(), 3, "the three hats are locked until bought");
  await page.click("#gm-ok"); await page.waitForSelector(".pf-player");
  assert.equal(await page.locator(".gm").count(), 0);
});

test("4.85.0 the chart's rows and the rival battle show guitarists, you and the computer players", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector(".rd-bubble"); await hash(page, "#/charts"); await page.waitForSelector(".ch-row");
  assert.equal(await page.locator('.ch-row.you svg[aria-label="Your guitarist"]').count(), 1, "your row");
  assert.ok(await page.locator(".ch-row:not(.you) .ch-av svg").count() >= 5, "the rivals have faces too");
  assert.equal(await page.locator(".ch-av .louie").count(), 0, "Louie isn't a player on the chart");
});

test("4.85.0 a duel shows your guitarist, worried when you lost", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs), settings: { ...LIB.settings, plainPlay: false } });
  const id = await page.evaluate(async () => {
    const C = await import("/core.js"), app = await import("/app.js"), d = C.startDuel(app.data, app.data.songs[0], { pct: 70, combo: 5, crowd: 8 }); C.Tabs.save(app.data);
    const code = await C.packShare({ song: C.shareable(app.data.songs[0]), duel: { id: d.id, from: "Sarah", pct: 82, combo: 9, crowd: 10, reply: true } });
    location.hash = "#/import/" + code; return d.id;
  });
  await page.waitForFunction(id => location.hash === "#/duel/" + id, id);
  await page.waitForSelector(".du-av.me");
  assert.equal(await page.locator('.du-av.me svg[aria-label="Your guitarist"]').count(), 1);
  assert.match(await page.innerHTML(".du-av.me"), /M\d+ 70l20 5/, "worried brows after a loss");
});

test("4.85.0 a hat bought on the Merch table goes on your guitarist and shows in the maker", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, merch: { tips: 400 }, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector(".rd-bubble"); await hash(page, "#/merch"); await page.waitForSelector(".mc");
  assert.equal(await page.locator(".mc-fin[aria-label$='for your guitarist']").count(), 3, "three hats");
  await page.click('[data-id="wear-beanie"]'); await page.waitForSelector(".mt");
  assert.match(await page.innerText(".mt"), /TRY IT ON YOUR GUITARIST[\s\S]*Beanie[\s\S]*BUY FOR \$150/);
  await page.click("#mt-buy");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).me?.extra === "beanie");
  const s = await stored(page);
  assert.equal(s.merch.tspent, 150, "paid in tips");
  await hash(page, "#/you"); await page.waitForSelector("#pf-me"); await page.click("#pf-me"); await page.waitForSelector(".gm");
  assert.equal(await page.locator('.gm [data-k="extra"][data-v="beanie"][aria-pressed="true"]').count(), 1, "wearing it");
  assert.equal(await page.locator('.gm .gm-c.lock[disabled]').count(), 2, "cap and bandana still locked");
});
