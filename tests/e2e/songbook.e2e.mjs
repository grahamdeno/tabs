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

/* The agreed Songbook (r10-05): art tiles, chord chips, Add in the header, search under the title. Sets is a filter. */
for (const theme of ["dark", "light", "green", "headliner"]) test(`agreed Songbook (${theme}): art tiles, chord chips, Add in the header, search under the title`, { skip: skip() }, async t => {
  const page = await songbook(t, theme, theme === "green" ? { colorScheme: "light" } : theme === "headliner" ? { colorScheme: "dark" } : {});
  const got = await page.evaluate(() => ({
    title: document.querySelector("#app .head .title")?.textContent, tuner: !!document.querySelector(".head #tunerbtn"),
    add: !!document.querySelector(".head #add.rr-sb-add"), back: !!document.getElementById("libback"),
    tiles: document.querySelectorAll("#list .row.rr-row .rr-tile").length, rows: document.querySelectorAll("#list .row").length,
    chips: !!document.querySelector("#chips.rr-chips #setsbtn"),
    k: document.querySelector('#list .row[data-id="k"]')?.innerText.replace(/\s+/g, " "),
    needs: document.querySelector('#list .row[data-id="b"] .rr-needs')?.textContent,
    chords: document.querySelector('#list .row[data-id="k"] .rr-cc')?.innerText.replace(/\s+/g, " ")
  }));
  assert.equal(got.title, "Songbook");
  assert.equal(got.tuner, true); assert.equal(got.add, true); assert.equal(got.back, false);
  assert.equal(got.tiles, got.rows); assert.ok(got.tiles >= 1);
  assert.equal(got.chips, true, "Sets is a filter chip");
  assert.match(got.k, /Kettle Hums\s+June and the Kettles/);
  assert.match(got.chords, /G/);
  assert.equal(got.needs, "needs F");
  const pressed = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#chips .chip")].map(c => [c.dataset.f, c.getAttribute("aria-pressed")])));
  assert.equal((await pressed()).all, "true");
  assert.equal((await pressed()).sets, "false");
  await page.click('#chips [data-f="learn"]'); await page.waitForSelector('#chips [data-f="learn"].on');
  assert.equal((await pressed()).learn, "true");
  assert.equal((await pressed()).all, "false");
  /* the order down the page: header, card strip (when there is one), filters, then the list */
  const order = await page.$$eval("#app > *", els => els.map(e => e.id || e.className.split(" ")[0]).filter(x => ["head", "today", "chips", "list"].includes(x)));
  assert.deepEqual(order.filter(x => x !== "today"), ["head", "chips", "list"]);
  if (order.includes("today")) assert.ok(order.indexOf("chips") < order.indexOf("today"), "the filters sit above the hint");
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
  assert.ok(m.rows.every(h => h >= 72), `rows: ${m.rows}`);
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
