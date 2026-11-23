// The Songbook in every look (the earlier layout again since 4.113.0), and the three mastery levels.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const libWith = (theme, extra = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "a").status ?? null);

test("Road Ready 07: the song page steps through none, Learning, Solid, Nailed it and back to none, and Nailed it is a milestone", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  await page.evaluate(() => { location.hash = "#/song/a"; });
  await page.waitForSelector("#stat"); await settled(page);
  assert.match(await page.innerText("#stat"), /Mark as learning/);
  for (const [label, stored] of [["Learning", "learning"], ["Solid", "solid"], ["Nailed it", "got"]]) {
    await page.click("#stat");
    await page.waitForFunction(s => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").status === s, stored);
    assert.equal((await page.innerText("#stat")).trim(), label, `the button says ${label}`);
    assert.match(await page.getAttribute("#stat", "class"), new RegExp(`\\b${stored}\\b`));
    await page.waitForFunction(l => [...document.querySelectorAll(".toast")].some(x => x.textContent.includes(l)), label);
  }
  const firsts = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).journal?.firsts || []);
  assert.ok(firsts.some(f => f.kind === "got" && f.name === "River Road"), "reaching Nailed it records the milestone");
  await page.click("#stat");
  await page.waitForFunction(() => !("status" in JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a")));
  assert.equal(await saved(page), null, "a fourth tap clears it");
  assert.match(await page.innerText("#stat"), /Mark as learning/);
});

/* made-up songs: one at each level, one with no level, one that needs one chord, one that is a favourite */
const SONGS = [
  { id: "k", title: "Kettle Hums", artist: "June and the Kettles", format: "chords", key: "G", body: "[Verse]\nG C D Em", status: "got", favorite: true },
  { id: "p", title: "Paper Moon Waltz", artist: "The Lamplighters", format: "chords", key: "G", body: "[Verse]\nG C D", status: "solid" },
  { id: "l", title: "Porch Light Blues", artist: "Porchlight Trio", format: "chords", key: "E", body: "[Verse]\nE A B7", status: "learning" },
  { id: "b", title: "Borrowed Tune", artist: "Mara Vale", format: "chords", key: "C", body: "[Verse]\nC G Am F" }
];
const KNOWN = { done: Object.fromEntries(["c:G", "c:C", "c:D", "c:Em", "c:Am", "c:E", "c:A"].map(id => [id, { n: 3, best: 90, at: Date.now() - 1000 }])), last: Date.now() };
const songbook = async (t, theme, opts = {}, extra = {}) => {
  const page = await phone(t, libWith(theme, { songs: SONGS, skills: KNOWN, ...extra }), opts);
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#list .row"); await settled(page);
  return page;
};

/* 4.113.1: the earlier Songbook in the new parts. Sets and the tuner in the title, capsule filters, a card per song, search at the bottom. */
for (const theme of ["dark", "light"]) test(`4.113.1 (${theme}): Sets and the tuner in the header, a card per song, search at the bottom`, { skip: skip() }, async t => {
  const page = await songbook(t, theme);
  const got = await page.evaluate(() => ({
    title: document.querySelector("#app .head .title")?.textContent, sets: !!document.querySelector(".head #setsbtn.sets-btn"), tuner: !!document.querySelector(".head #tunerbtn"),
    add: !!document.querySelector(".dock.kb .cmd #add.cmd-add"), back: !!document.getElementById("libback"),
    topSearch: !!document.querySelector(".dock.rr-find, .head #add"),
    tiles: document.querySelectorAll("#list .rr-tile, #list .rr-row").length,
    cards: document.querySelectorAll("#list .row.rr-line").length, rows: document.querySelectorAll("#list .row").length,
    k: document.querySelector('#list .row[data-id="k"]')?.innerText.replace(/\s+/g, " "),
    l: document.querySelector('#list .row[data-id="l"] .fit')?.textContent,
    b: document.querySelector('#list .row[data-id="b"] .fit')?.textContent,
    key: document.querySelector('#list .row[data-id="k"] .k')?.textContent,
    searchTop: document.querySelector(".dock.kb")?.getBoundingClientRect().top
  }));
  assert.equal(got.title, "Songbook");
  assert.equal(got.sets, true); assert.equal(got.tuner, true); assert.equal(got.add, true); assert.equal(got.back, false);
  assert.equal(got.topSearch, false, "search is not a bar under the title, and Add is not in the header");
  assert.equal(got.tiles, 0, "no art tiles");
  assert.equal(got.cards, got.rows);
  assert.match(got.k, /Kettle Hums/);
  assert.equal(got.l, "LEARNING"); assert.equal(got.b, "+ F"); assert.equal(got.key, "G");
  assert.ok(got.searchTop > 600, "search rests at the bottom");
  const pressed = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#chips .chip")].map(c => [c.dataset.f, c.getAttribute("aria-pressed")])));
  assert.equal((await pressed()).all, "true");
  assert.equal((await pressed()).sets, undefined, "Sets is a header button, not a filter");
  await page.click('#chips [data-f="learn"]'); await page.waitForSelector('#chips [data-f="learn"].on');
  assert.equal((await pressed()).learn, "true");
  const order = await page.$$eval("#app > *", els => els.map(e => e.id || e.className.split(" ")[0]).filter(x => ["head", "today", "chips", "list"].includes(x)));
  assert.deepEqual(order.filter(x => x !== "today"), ["head", "chips", "list"]);
  if (order.includes("today")) assert.ok(order.indexOf("today") < order.indexOf("chips"), "the hint sits above the filters");
});

test("the Songbook hint and a requested row use the tweed Louie picture", { skip: skip() }, async t => {
  const page = await songbook(t, "dark");
  const srcs = await page.evaluate(() => [...document.querySelectorAll(".rr-learn img, .rr-hint .rr-badge, .req .rr-lou")].map(img => img.getAttribute("src")));
  assert.ok(srcs.length >= 1, "a Louie picture is on the hint");
  assert.ok(srcs.every(s => s === "art/louie/v4/louie-face-badge.webp"), "the tweed Louie, " + srcs.join(" "));
  assert.ok(await page.locator(".req").count() >= 1, "a requested row is in the hint");
});

for (const width of [320, 390]) test(`4.113.0 at ${width} px: rows at least 56 px, the header buttons at least 44 by 44, and nothing runs off the side`, { skip: skip() }, async t => {
  const page = await songbook(t, "dark", { viewport: { width, height: 844 } });
  const m = await page.evaluate(() => {
    const r = e => e.getBoundingClientRect();
    const title = r(document.querySelector("#app .head .title")), btns = r(document.querySelector("#app .head .row-btns"));
    /* the 40 px header plates reach 48 px through their ::after tap area (inset -4px) */
    const pad = e => { const a = getComputedStyle(e, "::after"); return a.content !== "none" && a.position === "absolute" ? -2 * (parseFloat(a.top) || 0) : 0; };
    return { small: [...document.querySelectorAll("#app .head button, #list .row")].map(e => ({ n: e.id || e.className, w: r(e).width + pad(e), h: r(e).height + pad(e) })).filter(c => c.w < 44 || c.h < 44),
      rows: [...document.querySelectorAll("#list .row")].map(e => r(e).height), clear: btns.top >= title.bottom || title.right <= btns.left - 4, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(m.small, [], "every header button (with its tap area) and row is at least 44 by 44");
  assert.ok(m.rows.every(h => h >= 56), `rows: ${m.rows}`);
  assert.ok(m.clear, "the title and the header buttons don't touch");
  assert.equal(m.overflow, false, "nothing runs off the side");
});

test("4.113.0: Almost lists the songs one chord away, and Sets opens with its own title and a way back", { skip: skip() }, async t => {
  const page = await songbook(t, "dark");
  const near = page.locator("[data-f=near]");
  assert.equal(await near.count(), 1); assert.match(await near.getAttribute("aria-label"), /^Almost, \d+ songs? one chord away$/);
  await near.click(); await page.waitForFunction(() => document.querySelector("[data-f=near]")?.getAttribute("aria-pressed") === "true");
  /* Borrowed Tune needs F and Porch Light Blues needs B7 (it shows its LEARNING pill, as Learning comes first) */
  assert.deepEqual((await page.$$eval("#list .row", rs => rs.map(r => r.dataset.id))).sort(), ["b", "l"]);
  await page.click("#setsbtn"); await page.waitForSelector("#libback");
  assert.equal(await page.innerText("#app .head .title"), "Sets"); await page.click("#libback"); await page.waitForFunction(() => !document.getElementById("libback"));
  assert.equal(await page.innerText("#app .head .title"), "Songbook");
});

test("4.113.0: an empty Songbook still draws (the ways to add), with Sets in the header", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark", { songs: [] }));
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#list .empty"); await settled(page);
  await page.click("#setsbtn");
  await page.waitForSelector("#setsbtn.on[aria-pressed='true']");
});
