// Your profile (4.16.0; Your playing before): the profile page, opened from your fans and streak in the Road's header.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
useBrowser();

test("a saved Green Room opens the Road Ready Me page and keeps the saved look", { skip: skip() }, async t => {
  const songs = LIB.songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: Date.now() - (i === 0 ? 1 : 40) * 86400e3, days: {} } }));
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, v: 6, theme: "green" } }, { home: true });
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector(".rr-me");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green");
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.look), "green");
});

test("Your profile: an empty library says how it fills in, with no share button", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })) });
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".pf-empty");
  assert.equal(await page.locator("#pf-share").count(), 0);
});

test("Streak moment: once a day after the first song played through; tap to close; a switch turns it off", { skip: skip() }, async t => {
  /* short songs, so a real run is quick; a play only counts when most of it was played */
  const songs = LIB.songs.map(s => ({ ...s, duration: 10 }));
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, countIn: false, controls: "bar", streakMoment: true } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForSelector(".sk", { timeout: 15000 });
  assert.match(await page.innerText(".sk-say"), /Day one\.|days in a row/);
  assert.equal(await page.getAttribute(".sk", "role"), "dialog");
  assert.equal(await page.locator(".sk .ri-light").count(), 1, "4.16.0: the stage light, not a flame");
  await page.waitForTimeout(2600);
  assert.match(await page.innerText(".sk-num"), /^\d+$/);
  await page.click(".sk-art"); await page.waitForSelector(".sk", { state: "detached" });
  await page.click("#play"); await page.waitForTimeout(400); await page.click("#play"); await page.waitForTimeout(2200);
  assert.equal(await page.locator(".sk").count(), 0, "not again today");
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-streak");
  assert.equal(await page.getAttribute("#s-streak", "aria-checked"), "true");
  await page.click("#s-streak");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.streakMoment === false);
});

test("4.19.0: a song tried once and left three weeks ago shows in the Songbook as Worth another try", { skip: skip() }, async t => {
  const old = Date.now() - 30 * 864e5;
  const songs = [...LIB.songs.map(s => ({ ...s, playLog: { total: 5, last: Date.now(), days: {} } })), { id: "w", title: "Wagon Wheel", artist: "Old Crow", format: "chords", body: "[Verse]\nG D Em C\nla", playLog: { total: 1, last: old, days: {} } },
    { id: "w2", title: "Rock Me", artist: "Old Crow", format: "chords", body: "[Verse]\nG D Em C\nla", playLog: { total: 1, last: old - 864e5, days: {} } }] /* two, in case tonight's request takes one */;
  const page = await phone(t, { ...LIB, songs });
  await page.waitForSelector(".upn-c.again");
  assert.match(await page.innerText(".upn-c.again"), /WORTH ANOTHER TRY\s*(Wagon Wheel|Rock Me)\s*You left it 4 weeks ago/);
});

/* ---- Road Ready 08: Me and the guitar case (spec 5.8, r10-06) ---- */
import { roadPath } from "../../core.js";
const AT8 = Date.now();
/* the first n legs done, headline shows too: n guitars earned */
const legsDone = n => {
  const done = {}, data = { ...JSON.parse(JSON.stringify(LIB)), skills: { done, last: AT8 } };
  for (let i = 0; i < n; i++) { const leg = roadPath(data).legs.find(l => !l.done); for (const st of leg.stops) if (st.kind !== "box") done[st.id] = { n: 3, best: 90, at: AT8 - 1000 + i }; }
  return { done, last: AT8 };
};
const PLAYED8 = songs => songs.map((s, i) => ({ ...s, playLog: { total: i === 0 ? 6 : 1, last: Date.now() - (i === 0 ? 1 : 40) * 86400e3, days: {} } }));
const meLib = (theme, extra = {}) => ({ ...LIB, songs: PLAYED8(LIB.songs), skills: legsDone(3), merch: { tconv: 1, lconv: 1, hlseen: 1 }, guitars: { seen: ["open", "switch", "scales"] }, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const openMe = async (t, theme, extra) => {
  const page = await phone(t, meLib(theme, extra), { home: true });
  await page.waitForSelector("#h-fans"); await settled(page);
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
  return page;
};
const frame = page => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));

for (const [label, theme] of [["dark", "dark"], ["light", "light"]]) {
  test(`Road Ready 08 (${label}): Me has the player header, three tiles, the guitar case with the Merch row, Milestones and the rows; every number is the one it was`, { skip: skip() }, async t => {
    const page = await openMe(t, theme);
    const n = await page.evaluate(async () => { const m = await import("./core.js"), d = JSON.parse(localStorage.getItem("tabs-v1")), p = m.profileOf(d), c = m.playableSongs(d);
      return { now: c.now, of: c.of, chords: p.chords.length, plays: p.plays, fans: m.fansNow(d), tips: m.fansToSpend(d), venue: m.venueOf(m.lifetimePlays(d)).name, lvl: m.levelOf(d).level }; });
    const fmt = x => x.toLocaleString("en-US");
    /* criterion 2: the numbers are the ones profileOf, playableSongs, fansNow and fansToSpend give */
    /* 4.103.0: your name is the title; with none it asks for one, and a tap sets it */
    assert.equal(await page.innerText(".rr-me-name"), "Add your name");
    await page.click("#pf-name"); await page.waitForSelector(".nm-card #nm-in");
    await page.fill("#nm-in", "  Graham <b>\n"); await page.click("#nm-ok"); await page.waitForSelector(".rr-me #pf-name:not(.empty)");
    assert.equal(await page.innerText(".rr-me-name"), "Graham b");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.playerName === "Graham b");
    assert.equal(await page.getAttribute("#pf-name", "aria-label"), "Graham b. Change your name");
    assert.equal((await page.innerText(".rr-me-venue")).trim(), `${n.venue} · ${fmt(n.fans)} fans`);
    assert.match(await page.innerText(".rr-me-level"), new RegExp(`Level ${n.lvl} ·`));
    const tiles = await page.$$eval(".rr-tile", ts => ts.map(x => ({ n: x.querySelector("b").textContent.replace(/\s+/g, " ").trim(), l: x.querySelector("small").textContent.trim() })));
    assert.deepEqual(tiles.map(x => x.l), ["Songs", "Chords", "Plays"], "three tiles on one line each");
    assert.equal(tiles[0].n, `${n.now} of ${n.of}`); assert.equal(tiles[1].n, fmt(n.chords)); assert.equal(tiles[2].n, fmt(n.plays));
    assert.ok(n.plays >= 1 && n.chords >= 1, "the fixture has something to count");
    /* the stand: the guitars of the legs you finished, upright, each with a spoken name and where it was earned */
    assert.equal(await page.innerText(".rr-case-card .rr-card-h"), "Guitars\n3 guitars");
    const gs = await page.$$eval(".rr-gtr", els => els.map(li => { const im = li.querySelector("img"), r = im.getBoundingClientRect(); const tf = getComputedStyle(im).transform; return { label: li.getAttribute("aria-label"), h: Math.round(r.height), w: r.width, nw: im.naturalWidth, nh: im.naturalHeight, tf, hidden: im.getAttribute("aria-hidden"), on: li.classList.contains("is-on") }; }));
    assert.equal(gs.length, 3);
    assert.deepEqual(gs.map(g => g.label), ["Porch, your first guitar", "Cornerstone, earned on Tour 1, Opening Night", "Club Slab, earned on Tour 2, Open Mic"], "2026-11-23: headlining a leg earns the next leg's guitar");
    for (const g of gs) { assert.ok(g.nh > g.nw, `${g.label}: the picture is upright (headstock up)`); assert.ok(!/matrix\(/.test(g.tf) || /matrix\([^,]+, 0, 0,/.test(g.tf), `${g.label}: not turned`); assert.equal(g.hidden, "true"); assert.ok(Math.abs(g.w / g.h - g.nw / g.nh) < 0.05, `${g.label}: natural shape`); }
    assert.equal(gs.filter(g => g.on).length, 1, "one guitar in the cradle");
    /* criterion 3: game money and real money are apart */
    const merch = page.locator("#pf-r-merch");
    assert.equal(await merch.getAttribute("href"), "#/merch");
    const merchLine = n.tips > 0 ? `Merch: spend $${fmt(n.tips)} tips on new looks` : "Merch table: earn tips at your shows";
    assert.equal(await merch.getAttribute("aria-label"), merchLine);
    assert.equal((await merch.innerText()).trim(), merchLine);
    assert.equal(n.tips > 0, (await merch.innerText()).includes("spend"), "the row names the amount only when there is something to spend");
    assert.equal(await page.locator("#pf-r-merch .rr-coin").count(), 1, "the coin is on the Merch row");
    assert.equal(await page.locator(".rr-me .rr-coin").count(), 1, "and nowhere else on Me");
    const dollars = await page.evaluate(() => [...document.querySelectorAll(".rr-me *")].filter(e => [...e.childNodes].some(c => c.nodeType === 3 && /\$/.test(c.textContent)) || /\$/.test(e.getAttribute("aria-label") || "")).map(e => e.closest("#pf-r-merch") ? "merch" : e.tagName + "." + e.className));
    if (n.tips > 0) assert.ok(dollars.length >= 1 && dollars.every(d => d === "merch"), `a $ amount only on the Merch row (${dollars.join(", ")})`);
    else assert.deepEqual(dollars, [], "with $0 tips the page does not print a dollar amount");
    const sup = page.locator("#pf-r-support");
    assert.equal(await sup.getAttribute("href"), "#/support");
    assert.equal((await sup.innerText()).trim(), "Support Louie on Ko-fi (real money, optional)");
    const supText = (await page.innerText(".rr-support-h")) + " " + (await page.locator(".rr-support").evaluate(el => el.innerText + " " + [...el.querySelectorAll("[aria-label],[title],img")].map(e => (e.getAttribute("aria-label") || "") + (e.getAttribute("title") || "") + (e.getAttribute("alt") || "")).join(" ")));
    assert.doesNotMatch(supText, /tips?\b/i, "the word tips is never on the real-money section"); assert.doesNotMatch(supText, /\$|\d/, "no amount");
    assert.equal(await page.locator("#pf-r-support svg:not(.chev)").count(), 1, "a heart"); assert.equal(await page.locator("#pf-r-support .rr-coin").count(), 0, "no coin");
    assert.equal(await page.getAttribute("#pf-r-support img.rr-badge", "src"), "art/louie/v5/louie-face-badge.webp", "the face badge");
    assert.equal(await page.locator(".rr-me >> text=SUPPORT THE APP").count(), 1);
    /* the order: header, tiles, guitars, Merch, one card for Milestones and the two rows, then the rest.
       Chords and Your stats sit after those rows and before Support. */
    const order = await page.$$eval(".rr-me > *", els => els.map(e => ["rr-me-head", "rr-me-tiles", "rr-case-card", "rr-merch", "rr-places", "pf-jumps", "rr-support-h", "rr-support", "rr-rows"].find(c => e.classList.contains(c)) || "").filter(Boolean));
    assert.deepEqual(order, ["rr-me-head", "rr-me-tiles", "rr-case-card", "rr-merch", "rr-places", "rr-rows", "pf-jumps", "rr-support-h", "rr-support"]);
    /* Milestones as plates; the same badges as before */
    /* 4.103.0 (agreed r10-06): Milestones is one row; the badges open in a sheet */
    assert.match(await page.innerText("#pf-miles"), /Milestones\s*\d+ of 26/);
    assert.ok((await page.locator("#pf-miles").boundingBox()).height >= 52);
    await page.click("#pf-miles"); await page.waitForSelector(".ms-card");
    assert.equal(await page.locator(".ms-card .pf-badge").count(), 26); assert.ok(await page.locator(".ms-card .pf-badge:not(.locked)").count() >= 1);
    await page.click("#ms-x"); await page.waitForSelector(".ms-card", { state: "detached" });
    /* the rows and their destinations, each 52 px or taller, with a name; no streak or "you missed" copy */
    for (const [id, href] of [["#pf-r-band", "#/band"], ["#pf-r-charts", "#/charts"], ["#pf-r-help", "#/settings/help"], ["#pf-r-support", "#/support"]]) assert.equal(await page.getAttribute(id, "href"), href, id);
    const rows = await page.$$eval(".rr-me .rr-row", rs => rs.map(r => ({ id: r.id, h: r.getBoundingClientRect().height, name: (r.getAttribute("aria-label") || r.innerText).trim(), chev: !!r.querySelector(".chev"), ic: !!r.querySelector(".more-ic svg") })));
    assert.deepEqual(rows.map(r => r.id), ["pf-miles", "pf-r-band", "pf-r-charts", "pf-r-tune", "pf-share", "pf-r-help", "pf-r-support"]);
    assert.match(await page.innerText("#pf-r-charts"), /^Charts and duels/);
    for (const r of rows) { assert.ok(r.h >= 52, `${r.id} is ${r.h} tall`); assert.ok(r.name && r.chev && r.ic, `${r.id}: a name, an icon and a chevron`); }
    assert.doesNotMatch(await page.innerText(".rr-me"), /you missed|missed a day|lost your streak|streak (lost|broken)/i);
    /* criterion 5: every control is a 44 px target (the gear, your name, the avatar, the venue, the Merch row, the case). 4.103.0: Me is a tab, so no Back button */
    assert.equal(await page.locator(".rr-me-top #back, #back").count(), 0);
    for (const sel of ["#pf-name", "#pf-set", "#pf-me", "#pf-map", "#pf-r-merch", ".gs-item"]) { const b = await page.locator(sel).first().boundingBox(); assert.ok(b.width >= 44 && b.height >= 44, `${sel} is ${Math.round(b.width)} by ${Math.round(b.height)}`); }
    assert.equal(await page.getAttribute("#pf-set", "aria-label"), "Settings");
    /* the destinations work: Help opens Settings > Help */
    await page.click("#pf-r-help"); await page.waitForFunction(() => location.hash === "#/settings/help");
  });
}

test("Me: $0 tips says to earn them at shows, and a balance keeps the spend line", { skip: skip() }, async t => {
  const base = { tconv: 1, lconv: 1, hlseen: 1 };
  const zero = await openMe(t, "dark", { merch: { ...base, tips: 0 } });
  assert.equal((await zero.innerText("#pf-r-merch")).trim(), "Merch table: earn tips at your shows");
  assert.equal(await zero.getAttribute("#pf-r-merch", "aria-label"), "Merch table: earn tips at your shows");
  assert.equal(await zero.locator("#pf-r-merch.lit").count(), 0, "$0 stays on the quiet card");
  const paid = await openMe(t, "light", { merch: { ...base, tips: 12 } });
  assert.equal((await paid.innerText("#pf-r-merch")).trim(), "Merch: spend $12 tips on new looks");
  assert.equal(await paid.getAttribute("#pf-r-merch", "aria-label"), "Merch: spend $12 tips on new looks");
  assert.equal(await paid.locator("#pf-r-merch.lit").count(), 0, "$12 cannot buy an item yet, so the row stays quiet");
  const rich = await openMe(t, "dark", { merch: { ...base, tips: 240 } });
  assert.equal(await rich.locator("#pf-r-merch.lit").count(), 1, "tips that can buy something light the row");
});

test("Me: tips that could only buy a retired hat do not light the Merch row", { skip: skip() }, async t => {
  const page = await phone(t, {
    ...LIB,
    songs: LIB.songs.map(s => ({ ...s, playLog: undefined })),
    settings: { ...LIB.settings, v: 6, theme: "dark" },
    merch: { tconv: 1, lconv: 1, hlseen: 1, tips: 150, own: { rain: 2, double: 9, take: 3 } }
  }, { home: true });
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector("#pf-r-merch"); await settled(page);
  assert.equal(await page.locator("#pf-r-merch.lit").count(), 0, "a hat is not for sale, so the row stays quiet");
  assert.match(await page.innerText("#pf-r-merch"), /\$150/);
});

test("Me polish: one stat bar, one places card, and the XP track lines up with the cards", { skip: skip() }, async t => {
  const page = await openMe(t, "dark");
  const lay = await page.evaluate(() => {
    const tiles = document.querySelector(".rr-me-tiles");
    const cols = getComputedStyle(tiles).gridTemplateColumns.split(" ").length;
    const labels = [...tiles.querySelectorAll("small")].map(el => ({ t: el.textContent.trim(), lines: el.getClientRects().length, over: el.scrollWidth > el.clientWidth + 1 }));
    const bar = document.querySelector(".rr-me-level i").getBoundingClientRect();
    const card = tiles.getBoundingClientRect();
    const places = [...document.querySelectorAll(".rr-places .rr-row")].map(el => el.id);
    return { cols, labels, edge: Math.abs(bar.right - card.right), places, dots: document.querySelectorAll(".rr-mdots").length, medal: !!document.querySelector("#pf-miles .more-ic svg") };
  });
  assert.equal(lay.cols, 3, "one row of three");
  assert.deepEqual(lay.labels.map(l => l.t), ["Songs", "Chords", "Plays"]);
  for (const l of lay.labels) assert.ok(l.lines === 1 && !l.over, `${l.t} stays on one line`);
  assert.ok(lay.edge < 2, `XP track and the stat bar share a right edge (${lay.edge})`);
  assert.deepEqual(lay.places, ["pf-miles", "pf-r-band", "pf-r-charts"]);
  assert.equal(lay.dots, 0, "no hollow milestone dots");
  assert.equal(lay.medal, true);
});

test("Me at 320 wide: the stat words stay on one line and the page does not scroll sideways", { skip: skip() }, async t => {
  const page = await phone(t, meLib("dark"), { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, home: true });
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector(".rr-me"); await settled(page);
  const m = await page.evaluate(() => ({
    labels: [...document.querySelectorAll(".rr-me-tiles small, .rr-me-tiles b")].map(el => el.getClientRects().length === 1 && el.scrollWidth <= el.clientWidth + 1),
    side: document.scrollingElement.scrollWidth <= innerWidth + 1,
    stage: document.querySelector(".rr-case-card .gs-stage").getBoundingClientRect().height / innerHeight
  }));
  assert.ok(m.labels.every(Boolean), "nothing in the stat bar wraps");
  assert.equal(m.side, true, "no sideways scroll");
  assert.ok(m.stage >= 0.4 && m.stage <= 0.5, `the stand still fits a short phone (${(m.stage * 100).toFixed(1)}%)`);
});

test("Road Ready 08: at large text the tiles stack, the rows grow and the stand scrolls sideways with each guitar a 44 px target; nothing runs off the screen", { skip: skip() }, async t => {
  const page = await openMe(t, "dark");
  const cols = () => page.$eval(".rr-me-tiles", el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
  assert.equal(await cols(), 3);
  await page.evaluate(() => { const r = document.documentElement; r.style.setProperty("--sys-px", "33px"); r.dataset.ax = "1"; });
  await frame(page);
  assert.equal(await cols(), 1, "one column at large text");
  const m = await page.evaluate(() => ({ ox: getComputedStyle(document.querySelector(".gs-track")).overflowX, sw: document.scrollingElement.scrollWidth, iw: innerWidth,
    gs: [...document.querySelectorAll(".rr-gtr")].map(g => { const r = g.getBoundingClientRect(); return [r.width, r.height]; }),
    rows: [...document.querySelectorAll(".rr-me .rr-row")].map(r => [r.getBoundingClientRect().height, r.scrollWidth > r.clientWidth + 1]) }));
  assert.equal(m.ox, "auto", "the stand scrolls sideways");
  assert.ok(m.sw <= m.iw + 1, "the page doesn't scroll sideways");
  for (const [w, h] of m.gs) assert.ok(w >= 44 && h >= 44, "each guitar is at least 44 px");
  for (const [h, clip] of m.rows) assert.ok(h >= 52 && !clip, "a row is 52 tall or more and doesn't clip");
});

test("Road Ready 08 (5.5.0): before any show the stand holds Porch, your first guitar; a library with no plays has no share row and no Milestones gap", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })), settings: { ...LIB.settings, v: 6, theme: "dark" } }, { home: true });
  await page.waitForSelector("#h-fans"); await settled(page);
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
  assert.match(await page.innerText(".rr-case-card"), /1 guitar\b[\s\S]*Porch[\s\S]*Your first guitar/);
  assert.equal(await page.locator(".rr-case-note").count(), 0, "5.5.0: no 'earn your first guitar' line, you start with one");
  assert.equal(await page.locator("#pf-share").count(), 0, "no share row until there is something to share");
  assert.equal(await page.locator("#pf-r-support").count(), 1, "Support the app is still there");
});

test("the maker saves a genre and man or woman, and Me shows that picture", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { colorScheme: "dark" });
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector("#pf-me");
  await settled(page);
  await page.click("#pf-me");
  await page.waitForSelector('.gm-c[data-k="genre"][data-v="blues"]');
  await page.click('.gm-c[data-k="genre"][data-v="blues"]');
  await page.click('.gm-c[data-k="who"][data-v="w"]');
  await page.waitForFunction(() => {
    const me = JSON.parse(localStorage.getItem("tabs-v1")).me;
    return me && me.genre === "blues" && me.who === "w";
  });
  assert.equal(await page.locator(".gm-prev .gm-hero").getAttribute("src"), "art/guitarist-painted/genres/blues-w.webp", "the card follows the pick");
  const hero = await page.locator(".gm-hero").evaluate(el => getComputedStyle(el).objectFit);
  assert.equal(hero, "contain", "the whole painting fits in the card");
  assert.equal(await page.locator(".gm-starts").count(), 0, "the old face chips are not on the maker");
  await page.click("#gm-ok");
  await page.waitForSelector(".gm", { state: "detached" });
  await settled(page);
  assert.equal(await page.locator(".rr-avatar image").getAttribute("href"), "art/guitarist-painted/genres/blues-w.webp", "Me shows the picture you picked");
});

const STATS_NOW = new Date(2026, 10, 24, 15).getTime();
const statsDay = off => { const d = new Date(STATS_NOW - off * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const statsLib = (theme, recent) => {
  const week = Array(168).fill(0);
  for (let h = 17; h < 22; h++) { week[h] = 4; week[24 + h] = 3; }
  const days = recent
    ? { [statsDay(0)]: 2000, [statsDay(1)]: 3200, [statsDay(2)]: 800, [statsDay(4)]: 1400, [statsDay(6)]: 600 }
    : { [statsDay(10)]: 3600, [statsDay(18)]: 1800 };
  const played = recent ? { [statsDay(0)]: 1, [statsDay(1)]: 1, [statsDay(2)]: 1 } : { [statsDay(30)]: 1 };
  return {
    ...LIB,
    songs: [{ id: "a", title: "River Road", artist: "The Wanderers", key: "G", format: "chords", body: "[Verse]\nC G\nla", duration: 180, playLog: { total: 6, last: STATS_NOW, days: played } }],
    gig: { shows: 4, fans: 0, best: {}, ready: {}, seeded: true },
    settings: { ...LIB.settings, v: 6, theme },
    journal: {
      v: 1, since: "2026-01-01", seeded: "2026-01-01", secs: 2.3 * 3600, best: recent ? 3 : 0, firsts: [], days, week,
      chords: { G: { n: 6, first: "2026-01-01" }, C: { n: 5, first: "2026-01-02" }, E7: { n: 3, first: "2026-02-01" }, A7: { n: 2, first: "2026-02-02" }, F: { n: 2, first: "2026-03-01" }, "F#m": { n: 1, first: "2026-03-02" }, Dm7: { n: 1, first: "2026-04-01" } },
      changes: { "C|G": 42, "G|D": 9 }, keys: { G: 8, C: 2 },
      months: { "2026-05": { plays: 2, secs: 400, bpm: 140, bpmN: 2 }, "2026-06": { plays: 2, secs: 400, bpm: 144, bpmN: 2 }, "2026-07": { plays: 2, secs: 400, bpm: 148, bpmN: 2 }, "2026-09": { plays: 2, secs: 400, bpm: 180, bpmN: 2 }, "2026-10": { plays: 2, secs: 400, bpm: 188, bpmN: 2 }, "2026-11": { plays: 2, secs: 400, bpm: 192, bpmN: 2 } },
      tune: { n: 0, checked: [0, 0, 0, 0, 0, 0], drift: [0, 0, 0, 0, 0, 0] }
    }
  };
};
const openStats = async (t, theme, recent) => {
  const page = await phone(t, statsLib(theme, recent), { home: true, fixedTime: STATS_NOW, colorScheme: theme === "light" ? "light" : "dark" });
  await page.evaluate(() => { location.hash = "#/you/stats"; });
  await page.waitForSelector(".pf-stats-page"); await settled(page);
  return page;
};

test("Your stats: the when-you-play line, seven days, and no speed or range the phone does not know", { skip: skip() }, async t => {
  const page = await openStats(t, "dark", true);
  const text = await page.innerText(".pf-stats-page");
  assert.match(text, /You play most on Sunday and Monday evenings/);
  assert.match(text, /C to G/);
  assert.match(text, /Played 42 times/);
  assert.match(text, /Drill it/);
  assert.match(text, /2\.3/);
  assert.match(text, /NIGHT 1[\s\S]*NIGHT 2[\s\S]*NIGHT 3/);
  assert.match(text, /Shows played:\s*4/);
  assert.match(text, /Your most played key[\s\S]*80% of plays|G[\s\S]*Your most played key/);
  assert.match(text, /You're speeding up/);
  assert.match(text, /bpm on average/);
  assert.doesNotMatch(text, /[→↔⇒←↑↓—]/);
  assert.doesNotMatch(text, /a minute|per minute|70 to 96|Your last 4 weeks|Play tonight to start a run/);
  assert.equal(await page.getAttribute(".pf-bars", "data-mode"), "days");
  assert.equal(await page.locator(".pf-bars > div").count(), 7);
  assert.equal(await page.locator(".pf-spark, .pf-range").count(), 0);
  const heights = await page.$$eval(".pf-track i", els => els.map(el => el.style.getPropertyValue("--h")));
  assert.ok(heights.some(h => h === "0%"), "a day with no time draws no bar");
  assert.ok(heights.some(h => h !== "0%"));
  await page.click(".pf-drill");
  await page.waitForFunction(() => location.hash.includes("practice"));
  assert.match(decodeURIComponent(await page.evaluate(() => location.hash)), /C-G/);
});

test("Your stats: an empty week uses the last 4 weeks, and a run of 0 waits on Night 1", { skip: skip() }, async t => {
  const page = await openStats(t, "dark", false);
  const text = await page.innerText(".pf-stats-page");
  assert.match(text, /Play tonight to start a run/);
  assert.match(text, /NIGHT 1/);
  assert.match(text, /Shows played:\s*4/);
  assert.match(text, /Your last 4 weeks/);
  assert.equal(await page.getAttribute(".pf-bars", "data-mode"), "weeks");
  assert.equal(await page.locator(".pf-bars > div").count(), 4);
  const heights = await page.$$eval(".pf-track i", els => els.map(el => el.style.getPropertyValue("--h")));
  assert.ok(heights.some(h => h === "0%") && heights.some(h => h !== "0%"), "the fallback is not a row of flat lines");
  assert.equal(await page.locator(".pf-stub.on").count(), 0);
  assert.equal(await page.locator(".pf-stub.wait").count(), 1);
});

test("Your stats: Back returns to Me, and a 40-night run shows its last 7 tickets with the count in words", { skip: skip() }, async t => {
  const lib = statsLib("dark", true), days = {};
  for (let k = 0; k < 40; k++) days[statsDay(k)] = 1;
  lib.songs = [{ ...lib.songs[0], playLog: { total: 40, last: STATS_NOW, days } }];
  const page = await phone(t, lib, { home: true, fixedTime: STATS_NOW, colorScheme: "dark", viewport: { width: 320, height: 640 } });
  await page.evaluate(() => { location.hash = "#/you/stats"; });
  await page.waitForSelector(".pf-stats-page"); await settled(page);
  assert.deepEqual(await page.locator(".pf-stub.on b").allInnerTexts().then(a => a.map(x => x.trim().toUpperCase())), [34, 35, 36, 37, 38, 39, 40].map(k => `NIGHT ${k}`), "the last seven nights, ending with the latest");
  assert.match(await page.innerText(".pf-stub.on:last-child"), /tonight/i, "tonight's ticket is shown");
  assert.ok(await page.evaluate(() => { const s = document.querySelector(".pf-stubs").getBoundingClientRect(), l = document.querySelector(".pf-stub.on:last-child").getBoundingClientRect(); return l.left >= s.left - 1 && l.right <= s.right + 1; }), "the latest ticket is in view without scrolling");
  assert.equal((await page.innerText("#pf-run-cap")).trim(), "40 nights in a row", "the full count is in words");
  assert.equal(await page.getAttribute(".pf-stubs", "aria-label"), "40 nights in a row");
  const box = await page.locator("#back").boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, "Back is a 44 px target");
  assert.equal(await page.getAttribute("#back", "aria-label"), "Back to Me");
  await page.click("#back");
  await page.waitForFunction(() => location.hash === "#/you");
  await page.waitForSelector("#pf-open-stats");
});

test("Chord cards: learned cards are teal buttons, locked cards keep a gray diagram, and the shelf peeks", { skip: skip() }, async t => {
  const page = await phone(t, statsLib("dark", true), { home: true, fixedTime: STATS_NOW, colorScheme: "dark" });
  await page.evaluate(() => { location.hash = "#/you"; });
  await page.waitForSelector("#pf-open-chords"); await settled(page);
  assert.match(await page.innerText("#pf-open-chords"), /Chords\s*7 of 25/);
  await page.click("#pf-open-chords");
  await page.waitForSelector(".pf-ccard.on"); await settled(page);
  assert.match(await page.innerText(".pf-ch-top"), /Chords[\s\S]*7 of 25/);
  assert.match(await page.innerText(".pf-fam"), /Open\/7th chords\s*4 of 13/);
  const learned = page.locator(".pf-ccard.on[data-stamp='G']");
  assert.equal(await learned.evaluate(el => el.tagName), "BUTTON");
  assert.match(await learned.locator("svg").innerHTML(), /class="do"/);
  assert.match(await learned.locator("svg").innerHTML(), /class="dd"/);
  const locked = page.locator(".pf-ccard.locked").filter({ has: page.locator("b", { hasText: /^D$/ }) }).first();
  assert.equal(await locked.evaluate(el => el.tagName), "DIV");
  assert.match(await locked.locator("svg").innerHTML(), /class="dx"/);
  assert.match(await locked.locator("svg").innerHTML(), /class="dd"/);
  const paint = await page.evaluate(() => {
    const on = getComputedStyle(document.querySelector(".pf-ccard.on"));
    const off = getComputedStyle(document.querySelector(".pf-ccard.locked .pf-dg"));
    return { edge: on.borderTopColor, glow: on.boxShadow, gray: off.filter, fade: off.opacity };
  });
  assert.notEqual(paint.edge, "rgba(0, 0, 0, 0)");
  assert.match(paint.glow, /0px/);
  assert.match(paint.gray, /grayscale/);
  assert.ok(Number(paint.fade) < 0.7, paint.fade);
  assert.match(await page.locator("[data-stamp='F'] svg").innerHTML(), /<rect class="dd"/, "a barre is a bar, from the stored shape");
  const shelf = await page.$eval(".pf-shelf", el => {
    const r = el.getBoundingClientRect();
    const cards = [...el.children].map(c => c.getBoundingClientRect());
    return { scrolls: el.scrollWidth > el.clientWidth + 8, cut: cards.some(c => c.left < r.right - 4 && c.right > r.right + 2), wide: document.scrollingElement.scrollWidth <= innerWidth + 1 };
  });
  assert.equal(shelf.scrolls, true);
  assert.equal(shelf.cut, true, "a card is cut off at the right edge");
  assert.equal(shelf.wide, true, "the page itself does not scroll sideways");
  await page.click("[data-stamp='G']");
  await page.waitForSelector(".pf-stampsheet");
  assert.match(await page.innerText(".pf-stampsheet"), /^G/);
  await page.click("#st-x");
  await page.waitForSelector(".pf-stampsheet", { state: "detached" });
  await page.click("#pf-learn");
  await page.waitForFunction(() => location.hash.includes("practice"));
  assert.match(decodeURIComponent(await page.evaluate(() => location.hash)), /c:D/);
});

test("Chord cards and Your stats use the light look too", { skip: skip() }, async t => {
  const page = await phone(t, statsLib("light", true), { home: true, fixedTime: STATS_NOW, colorScheme: "light" });
  await page.evaluate(() => { location.hash = "#/you/chords"; });
  await page.waitForSelector(".pf-ccard.on"); await settled(page);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "festival");
  assert.ok(await page.locator(".pf-ccard.locked").count() > 0);
  await page.evaluate(() => { location.hash = "#/you/stats"; });
  await page.waitForSelector(".pf-poster");
  assert.match(await page.innerText(".pf-when"), /You play most on Sunday and Monday evenings/);
});

for (const theme of ["green", "headliner"]) {
  test(`a saved ${theme} look shows the Road Ready Me page and keeps the saved look`, { skip: skip() }, async t => {
    const page = await phone(t, meLib(theme, { merch: { ...LIB.merch, has: [theme], tconv: 1, lconv: 1 } }), { home: true, colorScheme: "dark" });
    await settled(page);
    await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "neon");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), theme);
  });
}
