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
  { id: "b", title: "Borrowed Tune", artist: "Mara Vale", format: "chords", key: "C", body: "[Verse]\nC G Am F" },
  { id: "q", title: "Quiet Hours", artist: "Mara Vale", format: "chords", key: "G", body: "[Verse]\nG C" } /* 5.7.0: five songs bring the filter row */
];
const KNOWN = { done: Object.fromEntries(["c:G", "c:C", "c:D", "c:Em", "c:Am", "c:E", "c:A"].map(id => [id, { n: 3, best: 90, at: Date.now() - 1000 }])), last: Date.now() };
const songbook = async (t, theme, opts = {}, extra = {}) => {
  const page = await phone(t, libWith(theme, { songs: SONGS, skills: KNOWN, ...extra }), opts);
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#list .row"); await settled(page);
  return page;
};

/* 4.113.0 (Graham, 2026-11-20): every look draws the earlier Songbook again: the title with Sets and the tuner, the card strip,
   the filter switch, one-line rows with the status pill and the key, and + in the search bar */
for (const theme of ["dark", "light", "green", "headliner"]) test(`4.113.0 (${theme}): the earlier Songbook layout, with Sets and the tuner in the header and + in the search bar`, { skip: skip() }, async t => {
  const page = await songbook(t, theme);
  const got = await page.evaluate(() => ({
    title: document.querySelector("#app .head .title")?.textContent, sets: !!document.querySelector("#chips [data-f='sets']") && !document.querySelector(".head #setsbtn"), tuner: !!document.querySelector(".head #tunerbtn"),
    add: !!document.querySelector(".dock .cmd #add.cmd-add"), back: !!document.getElementById("libback"),
    oldRows: document.querySelectorAll("#app .rr-row, #app .rr-tile, #app .rr-sb-head, #app .rr-cc").length,
    agreed: [document.querySelectorAll("#list .row.rr-line").length === document.querySelectorAll("#list .row").length, !!document.querySelector("#chips.rr-chips")],
    k: document.querySelector('#list .row[data-id="k"]')?.innerText.replace(/\s+/g, " "), l: document.querySelector('#list .row[data-id="l"] .vh')?.textContent,
    b: document.querySelector('#list .row[data-id="b"] .vh')?.textContent, key: document.querySelector('#list .row[data-id="k"] .k')?.textContent
  }));
  const rr = true; /* a saved Green Room or Headliner is read as Light or Dark, so the Songbook is that layout */
  assert.deepEqual({ ...got, k: undefined }, { title: "Songbook", sets: true, tuner: true, add: true, back: !rr, oldRows: 0, agreed: [rr, rr], k: undefined, l: ", Learning, needs B7", b: ", New, needs F", key: "G" }, "the Songbook is the Road Ready layout, including when a retired look is what was saved");
  assert.match(got.k, /Kettle Hums.*June and the Kettles/, "5.8.0: title and artist");
  assert.equal(await page.innerText('#list .row[data-id="k"] .vh'), ", Nailed it, can play", "the level is said");
  /* the chosen filter is said, not only filled; Almost (4.105.0) is there when a song is one chord away */
  const pressed = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#chips .chip")].map(c => [c.dataset.f, c.getAttribute("aria-pressed")])));
  assert.deepEqual(await pressed(), { all: "true", can: "false", near: "false", sets: "false" }, "5.7.0: All, Can play, Almost and Sets");
  if (rr) assert.equal(await page.evaluate(() => { const c = document.getElementById("chips"); return c.scrollWidth <= c.clientWidth + 1; }), true, "4.113.1: the filters fit on one row");
  await page.click('#chips [data-f="can"]'); await page.waitForSelector('#chips [data-f="can"].on');
  assert.deepEqual(await pressed(), { all: "false", can: "true", near: "false", sets: "false" });
  await page.click('#chips [data-f="all"]'); await page.waitForSelector('#chips [data-f="all"].on');
  /* the order down the page: header, card strip (when there is one), filters, then the list */
  const order = await page.$$eval("#app > *", els => els.map(e => e.id || e.className.split(" ")[0]).filter(x => ["head", "today", "chips", "list"].includes(x)));
  assert.deepEqual(order.filter(x => x !== "today"), ["head", "chips", "list"]);
  if (order.includes("today")) assert.ok(order.indexOf("today") < order.indexOf("chips"), "the card strip sits above the filters");
  await page.click("#tunerbtn"); await page.waitForSelector("#tn-say", { state: "attached" });
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
  /* Borrowed Tune needs F and Porch Light Blues needs B7 */
  assert.deepEqual((await page.$$eval("#list .row", rs => rs.map(r => r.dataset.id))).sort(), ["b", "l"]);
  await page.click("#chips [data-f='sets']"); await page.waitForSelector("#libback");
  assert.equal(await page.innerText("#app .head .title"), "Sets"); await page.click("#libback"); await page.waitForFunction(() => !document.getElementById("libback"));
  assert.equal(await page.innerText("#app .head .title"), "Songbook");
});

test("4.113.0: an empty Songbook still draws (the ways to add), with Sets in the header (5.7.0: until the filter row comes)", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark", { songs: [] }));
  await page.evaluate(() => { location.hash = "#/library"; });
  await page.waitForSelector("#list .empty"); await settled(page);
  await page.click("#setsbtn");
  await page.waitForSelector("#setsbtn.on[aria-pressed='true']");
});
