// Road Ready, step 07: the Songbook in the Road Ready looks, and the three mastery levels.
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
const KNOWN = { done: Object.fromEntries(["c:G", "c:C", "c:D", "c:Em", "c:Am", "c:E", "c:A"].map(id => [id, { n: 3, best: 90, at: 1 }])) };
const songbook = async (t, theme, opts = {}) => {
  const page = await phone(t, libWith(theme, { songs: SONGS, skills: KNOWN }), opts);
  await page.waitForSelector("#list .row"); await settled(page);
  return page;
};
const rowOf = (page, id) => page.evaluate(i => {
  const r = document.querySelector(`#list .row[data-id="${i}"]`);
  return { label: r.getAttribute("aria-label"), dots: r.querySelectorAll(".rr-dots i.on").length, all: r.querySelectorAll(".rr-dots i").length, hidden: r.querySelector(".rr-side")?.getAttribute("aria-hidden"), text: r.innerText };
}, id);

for (const theme of ["dark", "light"]) test(`Road Ready 07 (${theme}): each row reads title, artist and level in words, with one, two or three dots hidden from screen readers`, { skip: skip() }, async t => {
  const page = await songbook(t, theme);
  const k = await rowOf(page, "k"), p = await rowOf(page, "p"), l = await rowOf(page, "l"), b = await rowOf(page, "b");
  assert.match(k.label, /^Kettle Hums, June and the Kettles, Nailed it, Favorite, Can play/);
  assert.match(p.label, /^Paper Moon Waltz, The Lamplighters, Solid, Can play/);
  assert.match(l.label, /^Porch Light Blues, Porchlight Trio, Learning, needs B7/);
  assert.match(b.label, /^Borrowed Tune, Mara Vale, needs F/);
  assert.doesNotMatch(b.label, /Learning|Solid|Nailed it/, "no level, no level word");
  assert.deepEqual([k.dots, p.dots, l.dots, b.dots], [3, 2, 1, 0]);
  assert.deepEqual([k.all, p.all, l.all, b.all], [3, 3, 3, 0]);
  for (const r of [k, p, l, b]) assert.equal(r.hidden, "true", "the dots and key are hidden from screen readers");
  assert.match(b.text, /needs F/, "the one missing chord shows as a tag");
  /* the chosen filter is said, not only filled */
  const pressed = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#chips .chip")].map(c => [c.dataset.f || c.id, c.getAttribute("aria-pressed")])));
  assert.deepEqual(await pressed(), { all: "true", can: "false", near: "false", learn: "false", fav: "false", setsbtn: "false" }); /* 4.105.0: Almost, songs one chord away */
  await page.click('#chips [data-f="learn"]'); await page.waitForSelector('#chips [data-f="learn"].on');
  assert.deepEqual(await pressed(), { all: "false", can: "false", near: "false", learn: "true", fav: "false", setsbtn: "false" });
});

test("Road Ready 07: Green Room and Headliner keep the earlier Songbook (no Road Ready markup, Sets in the header, + in the search bar)", { skip: skip() }, async t => {
  for (const theme of ["green", "headliner"]) {
    const page = await songbook(t, theme);
    const got = await page.evaluate(() => ({ rr: document.querySelectorAll("#app [class*='rr-']").length, sets: !!document.querySelector(".head #setsbtn.sets-btn"), add: !!document.querySelector(".dock .cmd #add.cmd-add"), badge: !!document.querySelector(".rr-badge"), tuner: !!document.querySelector(".head #tunerbtn"), st: document.querySelector('#list .row[data-id="k"] .st')?.textContent }));
    assert.deepEqual(got, { rr: 0, sets: true, add: true, badge: false, tuner: true, st: "Nailed it" }, theme);
    /* and its Tuner button still opens the tuner */
    await page.click("#tunerbtn"); await page.waitForSelector("#tn-say", { state: "attached" });
  }
});

for (const width of [320, 390]) test(`Road Ready 07 at ${width} px: rows at least 56 px, every control at least 44 by 44, and the title clear of the header buttons`, { skip: skip() }, async t => {
  const page = await songbook(t, "dark", { viewport: { width, height: 844 } });
  const m = await page.evaluate(() => {
    const r = e => e.getBoundingClientRect();
    const ctl = [...document.querySelectorAll("#app .head button, #chips button, #list .row, .rr-hint button.tdy-i, .rr-hint .tdy-dot")].map(e => ({ n: e.id || e.className, w: r(e).width, h: r(e).height }));
    if (document.querySelector("#tunerbtn")) return { small: [{ n: "the Road Ready Songbook has no tuner (Graham, step 04: you tune on the song screen and Me)" }] };
    const title = r(document.querySelector(".rr-sb-head .title")), btns = r(document.querySelector(".rr-sb-head .row-btns"));
    const sameRow = btns.top < title.bottom;
    return { small: ctl.filter(c => c.w < 44 || c.h < 44), rows: [...document.querySelectorAll("#list .row")].map(e => r(e).height), clear: !sameRow || title.right <= btns.left - 4, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.deepEqual(m.small, [], "every control is at least 44 by 44");
  assert.ok(m.rows.every(h => h >= 56), `rows: ${m.rows}`);
  assert.ok(m.clear, "the title and the Add button don't touch (Surprise 73)");
  assert.equal(m.overflow, false, "nothing runs off the side");
});

test("Road Ready 07: Louie appears only as the face badge in the slim hint strip (34 px since 4.105.0), hidden from screen readers", { skip: skip() }, async t => {
  const page = await songbook(t, "dark");
  const b = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("#app img")].filter(i => /louie/.test(i.src));
    const one = imgs[0], r = one?.getBoundingClientRect();
    return { n: imgs.length, inHint: !!one?.closest(".rr-hint"), hidden: one?.getAttribute("aria-hidden"), alt: one?.getAttribute("alt"), w: r?.width, h: r?.height, inRows: document.querySelectorAll("#list .louie, #list img[src*='louie']").length, loaded: one?.complete && one?.naturalWidth > 0 };
  });
  assert.deepEqual(b, { n: 1, inHint: true, hidden: "true", alt: "", w: 34, h: 34, inRows: 0, loaded: true });
});

test("Road Ready 07: at large text the dots and key move under the title, and a long title wraps to two lines with the full title in the label", { skip: skip() }, async t => {
  const long = { id: "z", title: "The Very Long Song About a Kettle That Hummed All Night Long by the Window", artist: "Mara Vale", format: "chords", body: "[Verse]\nG C", status: "solid" };
  const page = await phone(t, libWith("dark", { songs: [...SONGS, long], skills: KNOWN }));
  await page.waitForSelector("#list .row"); await settled(page);
  await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "33px"); document.documentElement.dataset.ax = "1"; });
  await settled(page);
  const m = await page.evaluate(() => {
    const row = document.querySelector('#list .row[data-id="z"]'), t = row.querySelector(".t"), side = row.querySelector(".rr-side"), lh = parseFloat(getComputedStyle(t).lineHeight);
    return { below: side.getBoundingClientRect().top >= t.getBoundingClientRect().bottom - 1, lines: Math.round(t.getBoundingClientRect().height / lh), label: row.getAttribute("aria-label"), wide: document.documentElement.scrollWidth > innerWidth };
  });
  assert.ok(m.below, "the dots sit under the title");
  assert.equal(m.lines, 2, "the title wraps to two lines");
  assert.match(m.label, /^The Very Long Song About a Kettle That Hummed All Night Long by the Window, Mara Vale, Solid/);
  assert.equal(m.wide, false);
});

/* WCAG contrast of an element's text against the colour behind it */
const contrast = (page, sel, bgSel) => page.evaluate(([s, b]) => {
  const rgb = c => c.match(/[\d.]+/g).slice(0, 3).map(Number);
  const lum = c => { const [r, g, bl] = rgb(c).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * bl; };
  const fg = getComputedStyle(document.querySelector(s)).color;
  const bgEl = b ? document.querySelector(b) : null;
  const bg = bgEl ? getComputedStyle(bgEl).backgroundColor : getComputedStyle(document.documentElement).getPropertyValue("--rr-base").trim().replace(/^#(..)(..)(..)$/, (_, r, g, x) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(x, 16)})`);
  const [a, c] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + .05) / (c + .05);
}, [sel, bgSel]);

for (const theme of ["dark", "light"]) test(`Road Ready 07 (${theme}): the Songbook's text meets AA`, { skip: skip() }, async t => {
  const page = await songbook(t, theme);
  const checks = [
    ["row title", '#list .row[data-id="k"] .t', '#list .row[data-id="k"]'],
    ["artist", '#list .row[data-id="k"] .a', '#list .row[data-id="k"]'],
    ["key", '#list .row[data-id="k"] .k', '#list .row[data-id="k"]'],
    ["chord chip", '#list .row[data-id="k"] .rr-cc i', '#list .row[data-id="k"] .rr-cc i'],
    ["needs tag", '#list .row[data-id="b"] .rr-needs', '#list .row[data-id="b"] .rr-needs'],
    ["chosen filter", "#chips .chip.on", "#chips .chip.on"],
    ["other filter", "#chips .chip:not(.on)", null],
    ["title", ".rr-sb-head .title", null],
    ["search text", "#q", ".rr-sb-dock .cmd"]
  ];
  for (const [name, sel, bg] of checks) {
    const r = await contrast(page, sel, bg);
    assert.ok(r >= 4.5, `${name}: ${r.toFixed(2)} to 1`);
  }
  const tile = await page.evaluate(() => getComputedStyle(document.querySelector('#list .row[data-id="b"] .rr-tile')).getPropertyValue("--tile"));
  assert.match(tile, /^#[0-9A-F]{6}$/i, "a row with no art gets its initials on a colour");
});

test("Road Ready 07: a row shows its album art over the initials, and the initials when the art can't load", { skip: skip() }, async t => {
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const art = n => `https://is1-ssl.mzstatic.com/image/thumb/made-up/${n}.png`;
  const songs = [{ ...SONGS[0], art: art("ok") }, { ...SONGS[1], art: art("gone") }];
  const ctxPage = await phone(t, libWith("dark", { songs, skills: KNOWN }));
  await ctxPage.context().route("https://is1-ssl.mzstatic.com/**", r => r.request().url().includes("gone") ? r.abort() : r.fulfill({ contentType: "image/png", body: PNG }));
  /* draw the Songbook again, so both pictures are asked for with the made-up answers in place */
  await ctxPage.evaluate(() => { location.hash = "#/you"; }); await ctxPage.waitForSelector("#pf-r-tune");
  await ctxPage.evaluate(() => { location.hash = "#/library"; }); await ctxPage.waitForSelector("#list .row"); await settled(ctxPage);
  await ctxPage.waitForFunction(() => [...document.querySelectorAll("#list .rr-tile img")].every(i => i.complete));
  const tile = id => ctxPage.evaluate(i => {
    const t = document.querySelector(`#list .row[data-id="${i}"] .rr-tile`), img = t.querySelector("img"), b = t.querySelector("b"), r = b.getBoundingClientRect();
    return { loaded: img.naturalWidth > 0, initials: b.textContent, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.tagName };
  }, id);
  assert.deepEqual(await tile("k"), { loaded: true, initials: "KH", top: "IMG" }, "the art covers the initials");
  assert.equal((await tile("p")).loaded, false);
  assert.equal((await tile("p")).initials, "PM", "art that can't load leaves the initials on the tile");
});

test("Road Ready 07: an empty Songbook still draws (the ways to add), and Sets is there when sets exist with no songs", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark", { songs: [] }));
  await page.waitForSelector("#list .empty"); await settled(page);
  assert.equal(await page.$("#setsbtn"), null, "no songs and no sets: no Sets chip");
  const withSet = await phone(t, libWith("dark", { songs: [], sets: [{ id: "s1", name: "Friday", songIds: [] }] }));
  await withSet.waitForSelector("#setsbtn"); await settled(withSet);
  await withSet.click("#setsbtn");
  await withSet.waitForSelector("#setsbtn.on[aria-pressed='true']"); /* with no songs the list still asks for one, as in the earlier Songbook */
});

test("4.105.0 Songbook (agreed screen): no Back button on the tab, the filters then the hint, and Almost lists the songs one chord away", { skip: skip() }, async t => {
  const songs = [...LIB.songs, { id: "z", title: "Borrowed Tune", artist: "Mara Vale", format: "chords", body: "[Verse]\nC G Am F\nla" }];
  const skills = { done: Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A"].map((c, i) => ["c:" + c, { n: 3, best: 90, at: Date.now() - 1000 + i }])), last: Date.now() };
  const page = await phone(t, { ...LIB, songs, skills, settings: { ...LIB.settings, v: 6, theme: "dark" } });
  await page.waitForSelector("#chips.rr-chips");
  assert.equal(await page.locator("#libback").count(), 0, "Songbook is a tab, so no Back button");
  const order = await page.$$eval("#app > *", els => els.map(e => e.id || e.className.split(" ")[0]).filter(x => ["chips", "today"].includes(x)));
  assert.deepEqual(order.slice(0, 1), ["chips"], "the filters come first");
  const near = page.locator("[data-f=near]");
  assert.equal(await near.count(), 1); assert.match(await near.getAttribute("aria-label"), /^Almost, \d+ songs? one chord away$/);
  await near.click(); await page.waitForFunction(() => document.querySelector("[data-f=near]")?.getAttribute("aria-pressed") === "true");
  const titles = await page.$$eval("#list .row", rs => rs.map(r => r.getAttribute("aria-label") || r.innerText));
  assert.ok(titles.length >= 1 && titles.every(x => /needs [A-G]/.test(x)), `every song listed needs one chord: ${titles.join(" / ")}`);
  await page.click("#setsbtn"); await page.waitForSelector("#libback");
  assert.equal(await page.innerText(".rr-sb-head .title"), "Sets"); await page.click("#libback"); await page.waitForFunction(() => !document.getElementById("libback"));
});
