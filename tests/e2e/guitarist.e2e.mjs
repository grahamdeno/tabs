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
  assert.match(await page.innerText(".gm"), /I picked you a guitarist/, "Louie says so");
  await page.click('.gm [data-k="genre"][data-v="punk"]');
  await page.click("#gm-ok");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).me?.genre === "punk");
  await page.waitForSelector("#rd-bubble, .rr-stats");
  assert.equal(await page.locator(".gm").count(), 0, "the sheet closes");
  assert.ok(await page.locator(".rd-peek").count() === 0 && await page.locator("#rd-bubble, .rr-say").count() === 0, "no Louie and no message on the Road (Road Ready 10b; one-row header)");
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats"); await settled(page);
  assert.equal(await page.locator(".gm").count(), 0, "asked once");
});

test("4.85.0 Skip keeps the default and doesn't ask again", { skip: skip() }, async t => {
  const page = await phone(t, { ...NOME, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector(".gm");
  await page.click("#gm-skip");
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("tabs-v1")).me);
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats"); await settled(page);
  assert.equal(await page.locator(".gm").count(), 0);
});

test("painted-only: the maker offers 12 genres, man or woman and left-handed; each choice saves as you tap and shows its painting", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs), me: { genre: "blues", who: "w" } }, { home: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await hash(page, "#/you"); await page.waitForSelector(".rr-me");
  assert.equal(await page.locator('.rr-avatar svg[aria-label="Your guitarist"]').count(), 1);
  await page.click("#pf-me"); await page.waitForSelector(".gm");
  assert.equal(await page.locator('.gm [data-k="genre"]').count(), 12, "12 genres");
  assert.equal(await page.locator('.gm [data-k="who"]').count(), 2, "man or woman");
  assert.equal(await page.locator('.gm [data-k="lefty"]').count(), 1, "left-handed");
  assert.equal(await page.locator(".gm button[aria-pressed]").count(), 15, "12 + 2 + 1 choices, and nothing else");
  assert.equal(await page.locator("#gm-t-hair, #gm-t-fit, .gm-selfie, .gm-port, .gm-starts").count(), 0, "no face, hair or fit tabs, selfie or portrait");
  assert.match(await page.getAttribute(".gm .gm-hero", "src"), /blues-w/, "the preview is the saved painting");
  for (const g of ["rock", "punk", "metal", "blues", "country", "folk", "jazz", "classical", "indie", "funk", "reggae", "pop"]) for (const w of ["m", "w"]) {
    await page.click(`.gm [data-k="genre"][data-v="${g}"]`); await page.click(`.gm [data-k="who"][data-v="${w}"]`);
    assert.match(await page.getAttribute(".gm .gm-hero", "src"), new RegExp(`/${g}-${w}`), `${g} ${w}`);
  }
  await page.click('.gm [data-k="lefty"]');
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem("tabs-v1")).me; return m?.genre === "pop" && m.who === "w" && m.lefty === true; });
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).me);
  assert.deepEqual(Object.keys(me).sort(), ["genre", "lefty", "who"], "only three fields are kept");
  await page.click("#gm-ok"); await page.waitForSelector(".rr-me");
  assert.equal(await page.locator(".gm").count(), 0);
});

test("4.85.0 the chart's rows and the rival battle show guitarists, you and the computer players", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await hash(page, "#/charts"); await page.waitForSelector(".ch-row");
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
  /* the face for the mood: worried after a loss */
  assert.equal(await page.getAttribute('.du-av.me svg[aria-label="Your guitarist"]', "data-mood"), "worried", "the worried face after a loss");
});

test("painted-only: no hat is on the Merch table, a hat can't be bought, and a hat already bought stays", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, merch: { tips: 400, has: ["wear-cap"] }, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector("#rd-bubble, .rr-stats"); await hash(page, "#/merch/looks"); await page.waitForSelector(".mc");
  assert.equal(await page.locator("[data-id^='wear-'], .mc-fin[aria-label$='for your guitarist']").count(), 0, "no hat is offered");
  const r = await page.evaluate(async () => { const C = await import("/core.js"), app = await import("/app.js"); const out = C.merchBuy(app.data, "wear-beanie"); return { out, has: app.data.merch.has, spent: app.data.merch.tspent || 0 }; });
  assert.equal(r.out.why, "retired"); assert.equal(r.spent, 0, "nothing is charged");
  assert.ok(r.has.includes("wear-cap"), "a hat bought earlier stays saved");
});

test("painted-only: every place that draws a player draws a painting", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs), me: { genre: "jazz", who: "w", lefty: true } }, { home: true });
  await page.waitForSelector("#rd-bubble, .rr-stats");
  const svgs = await page.evaluate(async () => { const g = await import("./guitarist.js"); return [g.you(JSON.parse(localStorage.getItem("tabs-v1")), { size: 120 }), g.you(JSON.parse(localStorage.getItem("tabs-v1")), { crop: "bust" }), g.rival("Sarah", "Opener")]; });
  for (const v of svgs) assert.match(v, /art\/guitarist-painted\/genres\/[a-z0-9-]+\.webp/);
  assert.match(svgs[0], /jazz-w/); assert.match(svgs[0], /scale\(-1 1\)/, "mirrored for a left-handed player");
  await hash(page, "#/charts"); await page.waitForSelector(".ch-row");
  assert.ok(await page.locator(".ch-row image[href*='guitarist-painted']").count() >= 6, "the chart rows are paintings");
  await hash(page, "#/you"); await page.waitForSelector(".rr-me");
  assert.ok(await page.locator(".rr-avatar image[href*='guitarist-painted']").count() >= 1, "the profile is a painting");
});

test("painted-only: the portrait database and the xAI key are deleted once on first start", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs) }, { home: true });
  await page.waitForSelector("#rd-bubble, .rr-stats");
  await page.waitForFunction(() => localStorage.getItem("tabs.portraitgone.v1") === "1");
  /* put the leftovers back as an older version would have left them, and clear the once-flag */
  await page.evaluate(async () => {
    localStorage.setItem("tabs.xaikey.v1", "xai-test-not-a-real-key"); localStorage.removeItem("tabs.portraitgone.v1");
    await new Promise((ok, no) => { const r = indexedDB.open("tabs-portrait", 1); r.onupgradeneeded = () => r.result.createObjectStore("p"); r.onsuccess = () => { r.result.close(); ok(); }; r.onerror = no; });
  });
  assert.ok((await page.evaluate(() => indexedDB.databases())).some(d => d.name === "tabs-portrait"), "the old database exists");
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats");
  await page.waitForFunction(() => localStorage.getItem("tabs.portraitgone.v1") === "1");
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.xaikey.v1")), null, "the key is gone");
  assert.ok(!(await page.evaluate(() => indexedDB.databases())).some(d => d.name === "tabs-portrait"), "the database is gone");
  /* once: a later start leaves a key alone (it is not read or used by anything, so this only proves the flag) */
  await page.evaluate(() => localStorage.setItem("tabs.xaikey.v1", "again"));
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats");
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.xaikey.v1")), "again", "it runs once");
  /* Settings has no xAI section and the CSP no longer names xAI */
  assert.ok(!(await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)).includes("x.ai"));
});

test("painted-only: a player with an old guitarist (no genre) gets Who's playing tonight? once", { skip: skip() }, async t => {
  const page = await phone(t, { ...NOME, songs: PLAYED(LIB.songs), me: { skin: 4, hair: "locs", hairCol: "purple", top: "teal" } }, { home: true });
  await page.waitForSelector(".gm");
  assert.match(await page.innerText(".gm"), /Who's playing tonight\?/);
  await page.click('.gm [data-k="genre"][data-v="folk"]');
  await page.click("#gm-ok");
  await page.waitForFunction(() => { const m = JSON.parse(localStorage.getItem("tabs-v1")).me; return m?.genre === "folk" && !("skin" in m); });
  await page.reload(); await page.waitForSelector("#rd-bubble, .rr-stats"); await settled(page);
  assert.equal(await page.locator(".gm").count(), 0, "asked once");
});

test("painted-only: the profile share card mirrors the painting for a left-handed player and not for a right-handed one", { skip: skip() }, async t => {
  for (const lefty of [false, true]) {
    const page = await phone(t, { ...LIB, songs: LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: Date.now() - (i === 0 ? 1 : 40) * 86400e3, days: {} } })), me: { genre: "rock", who: "m", lefty } }, { home: true });
    await page.waitForSelector("#rd-bubble, .rr-stats"); await hash(page, "#/you"); await page.waitForSelector("#pf-share", { state: "attached" });
    await page.evaluate(() => {
      window.__mirror = 0; window.__img = 0;
      const sc = CanvasRenderingContext2D.prototype.scale; CanvasRenderingContext2D.prototype.scale = function (x, y) { if (x === -1 && y === 1) window.__mirror++; return sc.call(this, x, y); };
      const di = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (im, ...r) { if (im instanceof HTMLCanvasElement) window.__img++; return di.call(this, im, ...r); };
      Object.defineProperty(navigator, "canShare", { value: () => false, configurable: true });
    });
    await page.click("#pf-share");
    await page.waitForFunction(() => /Saved the picture/.test(document.body.innerText));
    const r = await page.evaluate(() => ({ mirror: window.__mirror, img: window.__img }));
    assert.equal(r.mirror, lefty ? 1 : 0, lefty ? "mirrored on the canvas" : "not mirrored");
    assert.equal(r.img, lefty ? 1 : 0, "the mirrored copy is the one drawn on the card");
  }
});
