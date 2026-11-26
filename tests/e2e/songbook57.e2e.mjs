// 5.7.0 Songbook (Graham, 2026-11-26), Dark and Light: a plain segmented filter row (All, Can play, Almost, Sets) that waits for five
// songs or a set, rows with a cover tile, chords, the key and three dots, Songs you can play next from the last Play next answer (or
// one row that opens it, and nothing without an AI key), and one quiet backup line.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
useBrowser();
const S = (id, title, body, extra = {}) => ({ id, title, artist: "A", key: "G", format: "chords", body, ...extra });
const FIVE = [S("a", "Anchor", "[V]\nG C D\nla", { status: "got", favorite: true }), S("b", "Bell", "[V]\nG C\nla", { status: "solid" }), S("c", "Cedar", "[V]\nA D E\nla", { status: "learning" }), S("d", "Dune", "[V]\nG D\nla"), S("e", "Ember", "[V]\nC F\nla")];
const KNOWN = { done: Object.fromEntries(["G", "C", "D", "A", "E"].map(c => ["c:" + c, { n: 3, best: 90, at: 1 }])), last: 1 };
const NEXT = { at: 1, list: [{ title: "Wagon Wheel", artist: "Old Crow", chords: ["G", "D", "Em", "C"], new: ["Em"], why: "" }, { title: "Bell", artist: "A", chords: ["G", "C"], new: [], why: "" }] };
const open = async (t, lib, { key = true, saved = true, theme = "dark" } = {}) => {
  const page = await phone(t, { ...LIB, skills: KNOWN, ...lib, settings: { ...LIB.settings, v: 6, theme, ...(lib.settings || {}) } }, { prepare: p => p.addInitScript(([k, n]) => { if (k) localStorage.setItem("tabs.apikey.v1", "sk-test"); if (n) localStorage.setItem("tabs.nx.songbook.v1", n); }, [key, saved ? JSON.stringify(NEXT) : ""]) });
  await page.waitForSelector("#list"); await settled(page);
  return page;
};

for (const theme of ["dark", "light"]) test(`5.7.0 Songbook (${theme}): the segmented row, the rows, Songs you can play next and the backup line`, { skip: skip() }, async t => {
  const page = await open(t, { songs: FIVE, settings: { lastBackup: "2020-01-01T00:00:00Z" } }, { theme });
  /* header: the title and a 44 px tuner, no Sets button and no dot */
  assert.equal(await page.locator("#setsbtn").count(), 0, "Sets moved to the filter row");
  assert.equal(await page.locator("#tunerbtn .dotmark").count(), 0, "no dot on the tuner");
  const tb = await page.locator("#tunerbtn").boundingBox(); assert.ok(tb.width >= 44 && tb.height >= 44);
  /* the segmented row */
  assert.deepEqual(await page.$$eval("#chips.sb-seg [data-f]", bs => bs.map(b => b.dataset.f)), ["all", "can", "near", "sets"]);
  assert.match(await page.innerText("#chips"), /All\s*5[\s\S]*Can play\s*\d[\s\S]*Almost\s*\d[\s\S]*Sets/);
  assert.equal(await page.getAttribute("#chips [data-f='all']", "aria-pressed"), "true");
  for (const b of await page.$$("#chips [data-f]")) { const r = await b.boundingBox(); assert.ok(r.height >= 40, "each segment is a real target"); }
  /* rows: a tile, chords (a chord you don't play is marked), the key and three dots that say how well you know it */
  const rows = await page.$$eval(".sb-row", rs => rs.map(r => ({ tile: r.querySelector(".sb-cv")?.textContent, ch: r.querySelector(".sb-ch")?.textContent, miss: [...r.querySelectorAll(".miss")].map(m => m.textContent), on: r.querySelectorAll(".sb-dots i.on").length, say: r.querySelector(".sb-dots").getAttribute("aria-label"), k: r.querySelector(".k").textContent })));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { tile: "A", ch: "G C D", miss: [], on: 3, say: "Nailed it, can play", k: "G" });
  assert.equal(rows[1].on, 2); assert.equal(rows[2].on, 1); assert.equal(rows[3].say, "New, can play");
  assert.deepEqual(rows[4].miss, ["F"], "Ember needs F");
  /* Songs you can play next: the saved answer, minus a song already in the Songbook, with Add; More ideas opens Play next */
  assert.match(await page.innerText(".sb-next"), /Songs you can play next[\s\S]*Wagon Wheel/);
  assert.doesNotMatch(await page.innerText(".sb-next"), /Bell/, "a song you have isn't suggested");
  const add = await page.locator(".sb-add").boundingBox(); assert.ok(add.height >= 44);
  assert.equal(await page.locator("#sb-nmore").count(), 1);
  /* one quiet backup line, no card */
  assert.equal(await page.locator(".bk.glass").count(), 0);
  assert.match(await page.innerText("#bk"), /Not backed up this week\.\s*Back up/);
  /* Learning only and Favorites only are in the sort menu */
  assert.deepEqual(await page.$$eval("#sort option", os => os.map(o => o.value)).then(v => v.filter(x => ["learn", "fav"].includes(x))), ["learn", "fav"]);
  await page.selectOption("#sort", "learn"); await page.waitForFunction(() => document.querySelectorAll(".sb-row").length === 1);
  assert.match(await page.innerText(".sb-row"), /Cedar/);
  /* Sets from the row */
  await page.click("#chips [data-f='all']"); await settled(page); await page.click("#chips [data-f='sets']"); await page.waitForSelector("#newset");
});

test("5.7.0 Songbook: under five songs there is no filter row; no AI key, no Songs you can play next; before Play next has answered, one row opens it", { skip: skip() }, async t => {
  const few = await open(t, { songs: FIVE.slice(0, 3) }, { saved: false });
  assert.equal(await few.locator("#chips").count(), 0, "three songs: no filter row");
  assert.match(await few.innerText(".sb-next"), /Find songs you can play next/, "one row before the first answer");
  assert.equal(await few.locator(".sb-add").count(), 0);
  const nokey = await open(t, { songs: FIVE }, { key: false });
  assert.equal(await nokey.locator(".sb-next").count(), 0, "no AI key: no section");
  assert.equal(await nokey.locator("#bk").count(), 0, "backed up recently: no line");
});
