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
    assert.deepEqual(tiles.map(x => x.l), ["songs you can play", "chords", "plays"], "three tiles");
    assert.equal(tiles[0].n, `${n.now} of ${n.of}`); assert.equal(tiles[1].n, fmt(n.chords)); assert.equal(tiles[2].n, fmt(n.plays));
    assert.ok(n.plays >= 1 && n.chords >= 1, "the fixture has something to count");
    /* the stand: the guitars of the legs you finished, upright, each with a spoken name and where it was earned */
    assert.equal(await page.innerText(".rr-case-card .rr-card-h"), "Guitar case\n3 guitars");
    const gs = await page.$$eval(".rr-gtr", els => els.map(li => { const im = li.querySelector("img"), r = im.getBoundingClientRect(); const tf = getComputedStyle(im).transform; return { label: li.getAttribute("aria-label"), h: Math.round(r.height), w: r.width, nw: im.naturalWidth, nh: im.naturalHeight, tf, hidden: im.getAttribute("aria-hidden"), on: li.classList.contains("is-on") }; }));
    assert.equal(gs.length, 3);
    assert.deepEqual(gs.map(g => g.label), ["Porch, earned on Leg 1, Open chords", "Cornerstone, earned on Leg 2, Chord switches", "Club Slab, earned on Leg 3, Scales"]);
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
    assert.equal(await page.getAttribute("#pf-r-support img.rr-badge", "src"), "art/louie/v4/louie-face-badge.webp", "the face badge");
    assert.equal(await page.locator(".rr-me >> text=SUPPORT THE APP").count(), 1);
    /* the order: header, tiles, case (Merch inside), Milestones, rows, Support the app last */
    const order = await page.$$eval(".rr-me > *", els => els.map(e => ["rr-me-head", "rr-me-tiles", "rr-case-card", "rr-miles", "rr-support-h", "rr-support", "rr-rows"].find(c => e.classList.contains(c)) || "").filter(Boolean));
    assert.deepEqual([order[0], order[1], order[2], order[3], order[4], order.at(-2), order.at(-1)], ["rr-me-head", "rr-me-tiles", "rr-case-card", "rr-miles", "rr-rows", "rr-support-h", "rr-support"]);
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
    assert.deepEqual(rows.map(r => r.id), ["pf-r-band", "pf-r-charts", "pf-r-tune", "pf-share", "pf-r-help", "pf-r-support"]);
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
  const paid = await openMe(t, "light", { merch: { ...base, tips: 12 } });
  assert.equal((await paid.innerText("#pf-r-merch")).trim(), "Merch: spend $12 tips on new looks");
  assert.equal(await paid.getAttribute("#pf-r-merch", "aria-label"), "Merch: spend $12 tips on new looks");
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

test("Road Ready 08: with no guitar earned the case says how to earn one; a library with no plays has no share row and no Milestones gap", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })), settings: { ...LIB.settings, v: 6, theme: "dark" } }, { home: true });
  await page.waitForSelector("#h-fans"); await settled(page);
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me"); await settled(page);
  assert.match(await page.innerText(".rr-case-card"), /0 guitars[\s\S]*Headline a leg to earn your first guitar\./);
  assert.equal(await page.locator("#pf-share").count(), 0, "no share row until there is something to share");
  assert.equal(await page.locator("#pf-r-support").count(), 1, "Support the app is still there");
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
