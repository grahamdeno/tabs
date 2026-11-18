// Road Ready, step 01: the tokens, fonts, tolex and plate button on Dark and Light,
// and proof that Green Room and Headliner are untouched.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, browser, base, tool, settled } from "./harness.mjs";

useBrowser();

/* a look already in use stays owned (4.78.0), so the saved theme is enough for Green Room and Headliner too */
const libWith = (theme, extra = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const prop = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

const TYPE = "display title title2 headline body callout subhead footnote caption lyric-now lyric-next lyric-sung chord mono".split(" ");
const RR = "base card mesh hairline text text-2 lyric-now lyric-next lyric-sung chord amber amber-text on-amber plate-top plate-bottom plate-edge plate-text tab-off outline pearl-done pearl-now pearl-locked engrave engrave-locked glow glow-core louie-rim".split(" ");

/* A throwaway button of each kind, put on the page so its computed style can be read. */
async function probe(page) {
  return page.evaluate(() => {
    const host = document.createElement("div"); host.id = "rr-probe"; host.style.cssText = "position:fixed;left:0;top:0;width:300px;z-index:9";
    host.innerHTML = '<button class="btn primary" id="p1">Save</button><button class="btn" id="p2">Cancel</button>';
    document.body.appendChild(host);
    const read = id => { const c = getComputedStyle(document.getElementById(id)); return { radius: c.borderTopLeftRadius, border: c.borderTopWidth, borderColor: c.borderTopColor, bg: c.backgroundColor, img: c.backgroundImage, color: c.color, font: c.fontFamily, weight: c.fontWeight, height: parseFloat(c.height), shadow: c.boxShadow, trans: c.transitionProperty }; };
    return { primary: read("p1"), secondary: read("p2") };
  });
}

/* Average colour of what the phone shows, read from a screenshot. */
async function meanColour(page) {
  const png = (await page.screenshot({ clip: { x: 0, y: 300, width: 390, height: 200 } })).toString("base64");
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const s = [0, 0, 0]; const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) for (let j = 0; j < 3; j++) s[j] += d[i + j];
    return s.map(v => v / n);
  }, png);
}

for (const [label, theme, scheme, lookId, baseHex, rgb] of [
  ["Dark", "dark", "light", "neon", "#141210", [20, 18, 16]],
  ["Light", "light", "dark", "festival", "#F6EFE2", [246, 239, 226]]
]) {
  test(`Road Ready ${label.toLowerCase()}: all tokens, the tolex ground and the plate button (Settings: ${label})`, { skip: skip() }, async t => {
    /* the phone says the opposite of the setting, to show the setting wins */
    const page = await phone(t, libWith(theme), { colorScheme: scheme });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), lookId, "the setting picks the look");

    for (const n of RR) assert.notEqual(await prop(page, "--rr-" + n), "", `--rr-${n} is set`);
    for (const n of TYPE) assert.notEqual(await prop(page, "--type-" + n), "", `--type-${n} is set`);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(await prop(page, "--sp-" + n), [4, 8, 12, 16, 20, 24, 32, 40][n - 1] + "px");
    for (const [n, v] of Object.entries({ chip: "999px", control: "10px", card: "16px", strip: "18px", sheet: "24px", plate: "12px" })) assert.equal(await prop(page, "--r-" + n), v, `--r-${n}`);
    assert.equal(await prop(page, "--r"), "16px"); assert.equal(await prop(page, "--r-bar"), "18px"); assert.equal(await prop(page, "--margin"), "16px");
    assert.equal((await prop(page, "--rr-base")).toUpperCase(), baseHex);
    assert.equal((await prop(page, "--rr-amber-text")).toUpperCase(), label === "Light" ? "#763A00" : "#FFB547");

    /* the type tokens work as font sizes and follow --sys-px */
    const sizes = () => page.evaluate(names => names.map(n => { const e = document.createElement("i"); e.style.fontSize = `var(--type-${n})`; document.body.appendChild(e); const v = parseFloat(getComputedStyle(e).fontSize); e.remove(); return Math.round(v * 10) / 10; }), TYPE);
    assert.deepEqual(await sizes(), [34, 28, 22, 17, 17, 16, 15, 13, 12, 34, 26, 22, 17, 20], "sizes at the default 17 px");
    await page.evaluate(() => document.documentElement.style.setProperty("--sys-px", "33px"));
    assert.equal((await sizes())[0], 66, "the sizes follow --sys-px");
    await page.evaluate(() => document.documentElement.style.removeProperty("--sys-px"));

    /* fonts */
    const fam = await page.evaluate(() => { const c = getComputedStyle(document.body); const h = document.createElement("h2"); document.body.appendChild(h); const d = getComputedStyle(h).fontFamily; h.remove(); return [c.fontFamily, d, getComputedStyle(document.documentElement).getPropertyValue("--readout")]; });
    assert.match(fam[0], /^Inter\b|^"Inter"/, "text is Inter"); assert.match(fam[1], /Space Grotesk/, "titles are Space Grotesk"); assert.match(fam[2], /IBM Plex Mono/, "--readout (tuner and tempo numbers) is IBM Plex Mono");
    const tabFam = await page.evaluate(() => { const s = document.createElement("div"); s.className = "sheet"; const e = document.createElement("div"); e.className = "tab"; e.textContent = "e|--0--"; s.appendChild(e); document.body.appendChild(s); const f = getComputedStyle(e).fontFamily; s.remove(); return f; });
    assert.doesNotMatch(tabFam, /IBM Plex Mono/, "tab blocks keep the system monospace");

    /* tolex ground: the grain is there, and the average stays the base colour */
    const bg = await page.evaluate(() => { const c = getComputedStyle(document.body); return { img: c.backgroundImage, col: c.backgroundColor }; });
    assert.match(bg.img, /data:image\/svg\+xml/, "the tolex grain is on the body");
    assert.equal(bg.col, `rgb(${rgb.join(", ")})`, "under the grain is the base colour");
    const mean = await meanColour(page);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(mean[i] - rgb[i]) <= (label === "Dark" ? 4 : 5), `average ${["red", "green", "blue"][i]} ${mean[i].toFixed(1)} should stay near ${rgb[i]}`);

    /* the plate button (primary) and the capsule (secondary) */
    const b = await probe(page);
    assert.equal(b.primary.radius, "12px"); assert.equal(b.primary.border, "2px"); assert.equal(b.primary.borderColor, "rgb(140, 120, 88)", "plate edge");
    assert.equal(b.primary.color, "rgb(40, 30, 20)", "plate text"); assert.match(b.primary.font, /Space Grotesk/); assert.equal(b.primary.weight, "700");
    assert.equal((b.primary.img.match(/radial-gradient/g) || []).length, 4, "four screws"); assert.match(b.primary.img, /linear-gradient/);
    assert.ok(b.primary.height >= 44, `primary is ${b.primary.height} px tall`);
    assert.equal(b.secondary.radius.replace("px", "") >= 100 || b.secondary.radius === "999px", true, "capsule"); assert.ok(parseFloat(b.secondary.border) >= 1 && parseFloat(b.secondary.border) <= 1.5, "a hairline border (1.5 px, which a 1x screen draws as 1)"); assert.equal(b.secondary.borderColor, "rgb(140, 132, 122)", "outline colour");
    assert.equal(b.secondary.bg, "rgba(0, 0, 0, 0)"); assert.ok(b.secondary.height >= 44, `secondary is ${b.secondary.height} px tall`);
    assert.equal(b.secondary.trans, "none", "no bounce"); assert.equal(b.primary.trans, "none");
  });
}

test("Road Ready: Auto follows the phone between Road Ready dark and light", { skip: skip() }, async t => {
  for (const [scheme, lookId, baseHex] of [["dark", "neon", "#141210"], ["light", "festival", "#F6EFE2"]]) {
    const page = await phone(t, libWith("auto"), { colorScheme: scheme });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), lookId, `Auto on a ${scheme} phone`);
    assert.equal((await prop(page, "--rr-base")).toUpperCase(), baseHex);
    assert.equal((await page.evaluate(() => document.querySelector('meta[name="theme-color"]').content)).toLowerCase(), baseHex.toLowerCase(), "status bar colour");
  }
});

test("Green Room and Headliner get no Road Ready tokens and keep their own colours, fonts and buttons", { skip: skip() }, async t => {
  const want = {
    green: { bg: "#E6EFE7", accent: "#FF5A4E", sans: /Nunito/, display: /Fredoka/ },
    headliner: { bg: "#16171B", accent: "#8A47F5", sans: /Nunito/, display: /Fredoka/ }
  };
  for (const [look, w] of Object.entries(want)) {
    const page = await phone(t, libWith(look));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), look);
    assert.equal(await prop(page, "--rr-base"), "", `${look}: --rr-base is empty`);
    for (const n of RR) assert.equal(await prop(page, "--rr-" + n), "", `${look}: --rr-${n} is empty`);
    for (const n of ["--type-body", "--type-display", "--sp-1", "--r-plate", "--margin", "--mesh", "--chrome-pipe"]) assert.equal(await prop(page, n), "", `${look}: ${n} is empty`);
    assert.equal((await prop(page, "--bg")).toUpperCase(), w.bg, `${look}: --bg`);
    assert.equal((await prop(page, "--accent")).toUpperCase(), w.accent, `${look}: --accent`);
    assert.match(await prop(page, "--sans"), w.sans, `${look}: --sans`); assert.match(await prop(page, "--display"), w.display, `${look}: --display`);
    assert.equal(await prop(page, "--r"), "14px", `${look}: --r`); assert.match(await prop(page, "--mono"), /^ui-monospace/, `${look}: --mono`);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    assert.equal(bg, "none", `${look}: no tolex on the body`);
    const b = await probe(page);
    assert.equal(b.primary.radius, "16px", `${look}: the chunky primary button`); assert.equal(b.primary.img, "none"); assert.equal(b.secondary.radius, "16px");
    assert.match(b.primary.font, /Fredoka/);
  }
});

test("Road Ready: the Merch table and Settings use the new names, and no screen has the old ones", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  await page.evaluate(() => { location.hash = "#/merch"; });
  await page.waitForSelector(".mc-look");
  const text = await page.innerText("body");
  assert.match(text, /Road Ready light/); assert.match(text, /Road Ready dark/);
  assert.doesNotMatch(text, /Festival Poster|Neon Midnight/);
  assert.equal(await page.locator(".mc-look b", { hasText: "Road Ready dark" }).count(), 1);
  const first = id => page.evaluate(i => getComputedStyle(document.querySelector(`.mc-look[data-id="${i}"] .mc-sw i`)).backgroundColor, id);
  assert.equal(await first("festival"), "rgb(246, 239, 226)", "the light swatch starts with #F6EFE2");
  assert.equal(await first("neon"), "rgb(20, 18, 16)", "the dark swatch starts with #141210");
  await page.click('.mc-look[data-id="festival"]'); /* Try it on opens the sheet; its line describes the look */
  await page.waitForFunction(() => document.documentElement.dataset.look === "festival");
  assert.match(await page.innerText("body"), /cream tolex, chrome piping and warm amber/);
  assert.doesNotMatch(await page.innerText("body"), /Festival Poster|Neon Midnight/);
});

test("Road Ready: the iPhone text size sets --sys-px and data-ax, and the lyrics scale as before", { skip: skip() }, async t => {
  /* Chromium can't report an iPhone text size, so a stand-in answers the one question readSysText() asks. */
  /* a song with one short line, so the lyric size is set by the ceiling (22 px times the text scale) and not by the width of the screen */
  const short = { id: "s", title: "Short", artist: "Me", key: "G", format: "chords", body: "[Verse]\nG   C\nHi", duration: 30 };
  const page = await phone(t, libWith("dark", { songs: [short], settings: { ...LIB.settings, v: 6, theme: "dark", plainPlay: true } }));
  await page.addInitScript(() => {
    window.__sysPx = 17;
    const sup = CSS.supports.bind(CSS); CSS.supports = (...a) => (a[0] === "font" && a[1] === "-apple-system-body") ? true : sup(...a);
    const gcs = window.getComputedStyle.bind(window);
    /* the probe is the hidden absolute span readSysText() adds (Chromium drops the font it sets, so it is found by those two styles) */
    window.getComputedStyle = (el, ...a) => (el?.tagName === "SPAN" && el.style.position === "absolute" && el.style.visibility === "hidden" && !el.textContent) ? { fontSize: window.__sysPx + "px" } : gcs(el, ...a);
  });
  await page.goto(base + "#/song/s"); await page.reload(); await page.waitForSelector(".sheet");
  /* the phone's text size changes while the app is open; coming back to the app reads it again */
  const at = async px => {
    await page.evaluate(v => { window.__sysPx = v; document.dispatchEvent(new Event("visibilitychange")); }, px);
    await page.waitForFunction(v => document.documentElement.style.getPropertyValue("--sys-px") === v + "px", px);
    return page.evaluate(() => [document.documentElement.dataset.ax ?? "", document.querySelector(".sheet")?.style.getPropertyValue("--lyric-size")]);
  };
  const base17 = await at(17);
  assert.equal(base17[0], "", "default size: no large-text layout");
  assert.equal((await at(27))[0], "", "just under AX1");
  const at33 = await at(33), at45 = await at(45);
  assert.equal(at33[0], "1", "about AX2"); assert.equal(at45[0], "3", "AX3 and up");
  /* the lyrics still use readSysText()'s clamped scale (ceiling 1.6, reached by 28 px): bigger than the default, and the same at 33 and 45 px */
  assert.equal(base17[1], "22.0px", "17 px: the ceiling of 22 px"); assert.equal(at33[1], "35.2px", "33 px: 22 px times the 1.6 ceiling");
  assert.equal(at45[1], "35.2px", "45 px: the scale stops at its ceiling");
  const back = await at(17);
  assert.deepEqual(back, base17, "back to the default clears data-ax and returns the lyric size");
});

test("Road Ready: the fonts come from vendor/fonts only, and are kept for offline use", { skip: skip() }, async t => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  t.after(() => ctx.close());
  await ctx.addInitScript(json => { try { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); localStorage.setItem("tabs-v1", json); } } catch { /* blocked */ } }, JSON.stringify(libWith("dark")));
  const page = await ctx.newPage();
  const urls = []; page.on("request", r => urls.push(r.url()));
  await page.goto(base + "#/library");
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => false), null, { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await page.waitForFunction(() => document.getElementById("app")?.childElementCount > 0);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  /* use all three families once (the tuner and tempo numbers use the mono one) */
  await page.evaluate(() => Promise.all(['500 20px "Space Grotesk"', '450 17px "Inter"', '600 20px "IBM Plex Mono"'].map(f => document.fonts.load(f, "A1"))));
  const fontUrls = urls.filter(u => /\.(woff2?|ttf|otf)(\?|$)/.test(u));
  for (const f of ["spacegrotesk.woff2", "inter.woff2", "ibmplexmono-600.woff2"]) assert.ok(fontUrls.some(u => u.endsWith("/vendor/fonts/" + f)), `${f} was requested from vendor/fonts`);
  assert.ok(fontUrls.every(u => u.startsWith(base + "vendor/fonts/")), `every font comes from this app: ${fontUrls.join(", ")}`);
  assert.ok(urls.filter(u => !u.startsWith("data:") && !u.startsWith("blob:")).every(u => u.startsWith(base)), "no request leaves the app");
  /* the service worker keeps them */
  const kept = await page.evaluate(async () => (await (await caches.open("tabs-vendor")).keys()).map(r => new URL(r.url).pathname));
  for (const f of ["spacegrotesk.woff2", "inter.woff2", "ibmplexmono-600.woff2"]) assert.ok(kept.some(p => p.endsWith("/vendor/fonts/" + f)), `${f} is in the tabs-vendor cache (${kept.join(", ")})`);
  const loaded = await page.evaluate(() => ["Space Grotesk", "Inter", "IBM Plex Mono"].map(f => document.fonts.check(`16px "${f}"`)));
  assert.deepEqual(loaded, [true, true, true]);
});

test("Road Ready: nothing new animates with Reduce Motion on, and the plate press is instant", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"), { reducedMotion: "reduce" });
  const b = await probe(page);
  assert.equal(b.primary.trans, "none"); assert.equal(b.secondary.trans, "none");
  const pressed = await page.evaluate(() => {
    const e = document.getElementById("p1"); const c = getComputedStyle(e);
    return [c.transitionDuration, c.animationName];
  });
  assert.deepEqual(pressed, ["0s", "none"]);
  const box = await page.locator("#p1").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  const down = await page.evaluate(() => { const c = getComputedStyle(document.getElementById("p1")); return [c.transform, c.filter]; });
  await page.mouse.up();
  assert.match(down[0], /matrix\(1, 0, 0, 1, 0, 1\)/, "1 px down"); assert.match(down[1], /brightness\(0\.94\)/, "6 percent darker");
});

test("the Tap tempo chip stays put while its label grows, so a thumb can keep tapping", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  await page.goto(base + "#/song/b"); await page.waitForSelector(".metarow");
  await tool(page, "edit");
  await page.waitForSelector("#ed-tap");
  const before = await page.locator("#ed-tap").boundingBox();
  await page.mouse.click(before.x + before.width / 2, before.y + before.height / 2);
  await page.waitForFunction(() => /more/.test(document.getElementById("ed-tap").textContent));
  const after = await page.locator("#ed-tap").boundingBox();
  assert.deepEqual([after.x, after.y, after.width], [before.x, before.y, before.width]);
});

/* ---------- Road Ready, step 02: the Road ---------- */
const AT = Date.now();
const doneOf = ids => ({ done: Object.fromEntries(ids.map((id, i) => [id, { n: 3, best: 90, at: AT - 1000 + i }])), last: AT });
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"].map(c => "c:" + c);
/* part of the first leg done: G, C, D (a merch box after them, opened on arrival) and Em; Am is the current stop */
const MID = doneOf(OPEN.slice(0, 4));
/* the whole first leg done, its headline show too: the second leg starts fresh */
const LEG1 = doneOf([...OPEN, "k:open"]);
const roadLib = (theme, skills, extra = {}) => ({ ...LIB, ...(skills ? { skills } : {}), ...extra, settings: { ...LIB.settings, v: 6, theme } });
async function road(t, theme, skills, opts = {}, extra) {
  const page = await phone(t, roadLib(theme, skills, extra), { home: true, ...opts });
  await page.waitForSelector(".rr-hdr .rr-plate"); await settled(page);
  return page;
}
/* the end of each connector step, and the centre of each stop's button, both in screen pixels */
const connectorEnds = page => page.evaluate(() => [...document.querySelectorAll(".rd-neck")].map(neck => {
  const ends = [...neck.querySelectorAll(".rd-conn .rr-cc")].map(p => { const m = p.getScreenCTM(), q = p.getPointAtLength(p.getTotalLength()); return [q.x * m.a + m.e, q.y * m.d + m.f]; });
  const stops = [...neck.querySelectorAll(".rd-node")].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.stop, state: [...b.classList].find(c => ["done", "now", "open", "locked"].includes(c)), x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  return { ends, stops };
}));

for (const [label, theme, file] of [["dark", "dark", "louie-peek-dark.webp"], ["light", "light", "louie-peek-light.webp"]]) {
  test(`Road Ready 02 (${label}): header strip, pearl inlays, the connector up to the current stop, the callout and Louie peeking`, { skip: skip() }, async t => {
    const page = await road(t, theme, MID);
    /* the header: plate, tips, Tonight, fans; nothing of the old Road */
    for (const sel of ["#h-venue.rr-plate", "#h-tips.rr-pill", "#h-fans.rr-pill", "#rd-tonight.rr-tonight", "#rd-bubble.rr-say"]) assert.equal(await page.locator(sel).count(), 1, sel);
    for (const sel of [".hud", ".rd-banner", "#rd-book", ".rd-chip", ".rd-say", "#rd-tune", "#h-streak"]) assert.equal(await page.locator(sel).count(), 0, `${sel} is gone from the Road`);
    assert.match(await page.innerText("#h-venue"), /GARAGE[\s\S]*Show 6 of 10[\s\S]*Open mic next/i);
    assert.equal(await page.locator("#h-venue .rr-pips i").count(), 10, "a pip per stop in the leg");
    assert.equal(await page.locator("#h-venue .rr-pips i.done").count(), 5, "five done (four lessons and the box)");
    assert.equal(await page.locator("#h-venue .rr-pips i.now").count(), 1);
    assert.equal(await page.getAttribute("#h-venue", "aria-label"), "Garage, show 6 of 10, Open mic next. Open the Tour Map");
    assert.match(await page.innerText("#h-tips"), /\$\d[\s\S]*Tips/); assert.match(await page.innerText("#h-fans"), /\d[\s\S]*Fans/);
    assert.match(await page.getAttribute("#rd-tonight", "aria-label"), /^Tonight: .+\. Play$/);
    /* the strip is tolex inside chrome piping, 8 px from the screen edges */
    const strip = await page.evaluate(() => { const h = document.querySelector(".rr-hdr"), r = h.getBoundingClientRect(), c = getComputedStyle(h), p = getComputedStyle(h, "::before"); return { l: r.left, r: innerWidth - r.right, bg: c.backgroundImage, radius: c.borderTopLeftRadius, pipe: p.backgroundImage }; });
    assert.equal(Math.round(strip.l), 8); assert.equal(Math.round(strip.r), 8); assert.equal(strip.radius, "18px");
    assert.match(strip.bg, /data:image\/svg\+xml/, "tolex"); assert.match(strip.pipe, /linear-gradient/, "chrome piping");

    /* the stops: done ones carry a check, the current one is the trapezoid with its number, the ones ahead are numbered */
    const cur = await page.evaluate(() => { const b = document.querySelector(".rd-node.cur"), a = b.querySelector(".rr-art").getBoundingClientRect(); return { n: b.querySelector(".rr-eng text")?.textContent, w: a.width, h: a.height, glow: !!b.querySelector(".rr-glow"), fill: getComputedStyle(b.querySelector(".rr-pearl")).fill }; });
    assert.deepEqual([cur.n, Math.round(cur.w), Math.round(cur.h), cur.glow], ["6", 52, 38, true], "the current stop: show 6, a 52 by 38 trapezoid, lit");
    assert.equal(cur.fill, "rgb(255, 214, 140)", "#FFD68C pearl");
    const done = await page.$$eval(".rd-neck >> nth=0 >> .rd-node.rr.done:not(.box)", bs => bs.map(b => ({ check: !!b.querySelector(".rr-eng path"), w: b.querySelector(".rr-art").getBoundingClientRect().width, halo: !!b.querySelector(".rr-halo") })));
    assert.equal(done.length, 4); assert.ok(done.every(d => d.check && Math.round(d.w) === 26 && d.halo), "done: 26 px with a check and a faint halo");
    const ahead = await page.$$eval(".rd-node.rr.locked:not(.box, .headline)", bs => bs.slice(0, 3).map(b => b.querySelector(".rr-eng text")?.textContent));
    assert.deepEqual(ahead, ["7", "9", "1"], "numbered ahead (8 is a merch box; the next leg starts at 1)");
    assert.equal(await page.locator(".rd-neck >> nth=0 >> .rd-node.headline .rr-art").count(), 1, "the leg ends in the double inlay");
    assert.equal(await page.getAttribute(".rd-node.cur", "aria-label"), "Show 6 of 10, The Am chord, current. Double tap to open.");

    /* the connector: one step per pair from the first stop to the current one, each ending on its stop; nothing ahead */
    const [n1, n2] = await connectorEnds(page);
    const curAt = n1.stops.findIndex(s => s.state === "now");
    assert.equal(n1.ends.length, curAt, `${curAt} steps up to the current stop`);
    n1.ends.forEach(([x, y], i) => { const s = n1.stops[i + 1]; assert.ok(Math.abs(x - s.x) < 1.5 && Math.abs(y - s.y) < 1.5, `step ${i + 1} ends on stop ${i + 2} (${x},${y} vs ${s.x},${s.y})`); });
    assert.equal(n2.ends.length, 0, "no line on the leg ahead");
    const glow = await page.evaluate(() => { const g = document.querySelector(".rr-cg"), c = document.querySelector(".rr-cc"), f = document.querySelector(".rd-conn feGaussianBlur"); return { gw: getComputedStyle(g).strokeWidth, cw: getComputedStyle(c).strokeWidth, blur: f?.getAttribute("stdDeviation") }; });
    assert.deepEqual(glow, { gw: "12px", cw: "2.2px", blur: "7" }, "a 12 px glow blurred 7, a 2.2 px core");

    /* the callout beside the current stop, inside the screen and clear of the stop */
    const tag = await page.evaluate(() => { const t = document.querySelector(".rd-stop.cur .rr-callout"), b = document.querySelector(".rd-node.cur"), r = t.getBoundingClientRect(), s = b.getBoundingClientRect(); return { text: t.textContent, hidden: t.getAttribute("aria-hidden"), left: r.left, right: r.right, stopRight: s.right }; });
    assert.equal(tag.hidden, "true"); assert.ok(tag.left > tag.stopRight && tag.right <= 390, `the callout sits right of the stop, on the screen (${tag.left}-${tag.right})`);
    assert.match(tag.text, /Am/);

    /* Louie peeks in: the picture for this look, partly past the left edge, hidden from screen readers, not a button */
    const peek = await page.evaluate(() => { const p = document.querySelector(".rd-peek"), r = p.getBoundingClientRect(), c = getComputedStyle(p); return { img: c.backgroundImage, left: r.left, h: r.height, hidden: p.getAttribute("aria-hidden"), pe: c.pointerEvents, disp: c.display }; });
    assert.ok(peek.img.includes(file), peek.img); assert.ok(peek.left < 0, "partly past the left edge"); assert.equal(Math.round(peek.h), 150);
    assert.deepEqual([peek.hidden, peek.pe, peek.disp], ["true", "none", "block"]);
    if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/rr02-${label}.png` });
  });
}

test("Road Ready 02: a fresh leg has no connector; a finished leg's runs to its double inlay", { skip: skip() }, async t => {
  const page = await road(t, "dark", LEG1, {}, { merch: { tconv: 1, lconv: 1, hlseen: 1 }, guitars: { seen: ["open"] } }); /* the headline and new-guitar sheets already seen */
  const [n1, n2] = await connectorEnds(page);
  assert.equal(n1.ends.length, n1.stops.length - 1, "the whole first leg is joined up");
  const last = n1.ends.at(-1), dbl = await page.evaluate(() => { const r = document.querySelector('.rd-neck .rd-node[data-kind="double"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  assert.ok(Math.abs(last[0] - dbl[0]) < 1.5 && Math.abs(last[1] - dbl[1]) < 1.5, "ending at the double inlay");
  assert.equal(await page.locator('.rd-neck >> nth=0 >> .rd-node[data-kind="double"].done .rr-eng path').count(), 2, "both dots done, each with a check");
  assert.equal(n2.ends.length, 0, "the new leg's first stop is current: no line yet");
  assert.match(await page.innerText("#h-venue"), /Show 1 of 11/);
});

test("Road Ready 02: every stop and header control does what it did, and each is at least 44 by 44", { skip: skip() }, async t => {
  const page = await road(t, "dark", MID);
  const small = await page.evaluate(() => [...document.querySelectorAll("#app button")].map(b => { const r = b.getBoundingClientRect(); return { id: b.id || b.dataset.stop || b.className, w: r.width, h: r.height }; }).filter(r => r.w < 44 || r.h < 44));
  assert.deepEqual(small, [], "every control on the Road is at least 44 by 44");
  const back = async () => { await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector(".rr-hdr .rr-plate"); await settled(page); };
  await page.click("#h-venue"); await page.waitForFunction(() => location.hash === "#/playmap"); await back();
  await page.click("#h-tips"); await page.waitForFunction(() => location.hash === "#/merch"); await back();
  await page.click("#h-fans"); await page.waitForFunction(() => location.hash === "#/you"); await back();
  await page.click(".rd-node.cur"); await page.waitForSelector(".rd-pop.now");
  assert.match(await page.innerText(".rd-pop.now"), /The Am chord[\s\S]*START/, "the stop card, as before");
  assert.equal(await page.locator(".rd-stop.cur .rr-callout").isVisible(), false, "the callout steps aside for the card");
  await page.click(".rd-node.cur"); await page.waitForSelector(".rd-pop", { state: "detached" });
  await page.click("#rd-tonight"); await page.waitForSelector("#gig");
});

test("Road Ready 02: with no song, Tonight asks for one and opens search; with no streak, Fans shows no streak at all", { skip: skip() }, async t => {
  const page = await road(t, "dark", MID, {}, { songs: [], opening: { skipped: true } });
  assert.match(await page.innerText("#rd-tonight"), /TONIGHT\s*Add a song to play tonight/);
  assert.equal(await page.getAttribute("#rd-tonight", "aria-label"), "Add a song to play tonight");
  assert.equal((await page.innerText("#h-fans small")).trim(), "Fans", "no streak: the label is Fans, never a 0");
  assert.doesNotMatch(await page.getAttribute("#h-fans", "aria-label"), /streak/i, "and a screen reader hears no streak");
  await page.click("#rd-tonight");
  await page.waitForFunction(() => location.hash === "#/library" && document.body.classList.contains("searching"));
});

test("Road Ready 02: a screen reader meets the plate, fans, tips, Tonight, Louie's line, then the leg and its stops", { skip: skip() }, async t => {
  const page = await road(t, "light", MID);
  const order = await page.evaluate(() => {
    const els = [...document.querySelectorAll("#app button, #app #rd-bubble, #app .rd-legmark, #app .rd-peek")];
    return els.filter(e => !e.closest("[aria-hidden=true]") && !e.closest(".rd-sbk")).map(e => e.id || (e.classList.contains("rd-legmark") ? "leg" : e.classList.contains("rd-node") ? "stop" : e.className)).slice(0, 8);
  });
  assert.deepEqual(order, ["h-venue", "h-fans", "h-tips", "rd-tonight", "rd-bubble", "leg", "stop", "stop"]);
  assert.equal(await page.getAttribute(".rd-peek", "aria-hidden"), "true", "Louie's picture is hidden from screen readers");
  assert.match(await page.innerText(".rd-legmark >> nth=0"), /Leg 1, Open chords/i);
});

test("Road Ready 02: large text stacks the header with nothing cut off; the largest sizes hide Louie and the pips", { skip: skip() }, async t => {
  const page = await road(t, "dark", MID);
  await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "33px"); document.documentElement.dataset.ax = "1"; });
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".rr-hdr")).gridTemplateAreas.includes("fans tips"));
  const box = await page.evaluate(() => {
    const r = id => document.getElementById(id).getBoundingClientRect();
    const cut = [...document.querySelectorAll(".rr-hdr *, .rr-say")].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map(e => e.className);
    const over = [...document.querySelectorAll(".rr-hdr b, .rr-hdr small, .rr-say")].filter(e => { const p = e.getBoundingClientRect(), h = e.closest("button, p").getBoundingClientRect(); return p.right > h.right + 1 || p.left < h.left - 1; }).map(e => e.textContent);
    return { plate: r("h-venue"), tonight: r("rd-tonight"), fans: r("h-fans"), tips: r("h-tips"), cut, over };
  });
  assert.ok(box.tonight.top >= box.plate.bottom, "Tonight under the plate");
  assert.ok(box.fans.top >= box.tonight.bottom && Math.abs(box.fans.top - box.tips.top) < 1 && box.tips.left >= box.fans.right, "fans and tips side by side under Tonight");
  assert.ok(box.plate.width > 340, "the plate takes the full width");
  assert.deepEqual(box.cut, [], "nothing truncates"); assert.deepEqual(box.over, [], "no text runs out of its control");
  await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "40px"); document.documentElement.dataset.ax = "3"; });
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".rd-peek")).display === "none");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".rr-pips")).display), "none", "the pips go; the plate says the same in words");
});

test("Road Ready 02: the current stop breathes and a new step of the line draws itself on; with Reduce Motion nothing moves", { skip: skip() }, async t => {
  const BOX = doneOf(OPEN.slice(0, 3));
  for (const reduce of [false, true]) {
    const page = await road(t, "dark", BOX, { reducedMotion: reduce ? "reduce" : "no-preference" }, { boxes: { opened: [] } });
    await page.waitForSelector(".rd-node.box.now");
    await page.click(".rd-node.box.now");
    await page.waitForSelector(".rd-node.cur:not(.box) .rr-glow", { timeout: 6000 }); /* the Road is drawn again with the next stop current */
    const m = await page.evaluate(() => ({ glow: getComputedStyle(document.querySelector(".rd-node.cur .rr-glow")).animationName, draw: [...document.querySelectorAll(".rr-draw")].map(p => getComputedStyle(p).animationName), off: [...document.querySelectorAll(".rr-cc.rr-draw")].map(p => getComputedStyle(p).strokeDashoffset) }));
    assert.equal(m.draw.length, 2, "the newest step (glow and core) is the one that draws");
    if (reduce) { assert.equal(m.glow, "none"); assert.deepEqual(m.draw, ["none", "none"]); assert.deepEqual(m.off, ["0px"], "the line is there at once"); }
    else { assert.equal(m.glow, "rr-breathe"); assert.deepEqual(m.draw, ["rr-draw", "rr-draw"]); }
  }
});

test("Road Ready 02: text on the Road meets AA contrast in both looks", { skip: skip() }, async t => {
  for (const theme of ["dark", "light"]) {
    const page = await road(t, theme, MID);
    const pairs = await page.evaluate(() => {
      const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p); return (x + .05) / (y + .05); };
      const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const hex = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
      const col = sel => getComputedStyle(document.querySelector(sel)).color;
      return {
        callout: ratio(col(".rr-callout"), getComputedStyle(document.querySelector(".rr-callout")).backgroundColor),
        plate: ratio(col(".rr-venue"), hex(v("--rr-plate-bottom"))),
        tonight: ratio(col(".rr-tn-t b"), getComputedStyle(document.querySelector(".rr-tonight")).backgroundColor),
        tonightLabel: ratio(col(".rr-tn-t small"), getComputedStyle(document.querySelector(".rr-tonight")).backgroundColor),
        leg: ratio(col(".rd-legmark"), hex(v("--rr-base"))),
        say: ratio(col(".rr-say"), getComputedStyle(document.querySelector(".rr-say")).backgroundColor),
        numNow: ratio(getComputedStyle(document.querySelector(".rd-node.cur .rr-eng")).fill, hex(v("--rr-pearl-now"))),
        numAhead: ratio(getComputedStyle(document.querySelector(".rd-node.locked:not(.box, .headline) .rr-eng")).fill, hex(v("--rr-pearl-locked"))),
        check: ratio(getComputedStyle(document.querySelector(".rd-node.done:not(.box) .rr-eng")).stroke, hex(v("--rr-pearl-done")))
      };
    });
    for (const [k, r] of Object.entries(pairs)) assert.ok(r >= 4.5, `${theme}: ${k} is ${r.toFixed(2)}:1`);
  }
});

test("Road Ready 02: Green Room and Headliner keep the old Road (stat bar, leg banner, finger dots, Louie beside the path)", { skip: skip() }, async t => {
  for (const look of ["green", "headliner"]) {
    const page = await phone(t, roadLib(look, MID), { home: true });
    await page.waitForSelector(".rd-path"); await settled(page);
    assert.equal(await page.locator(".rr-hdr, .rd-peek, .rr-say, .rd-conn, .rd-node.rr").count(), 0, `${look}: none of Road Ready`);
    for (const sel of [".hud #h-streak", ".rd-banner #rd-book", ".rd-say svg.louie", ".rd-node .rd-dot"]) assert.ok(await page.locator(sel).count() >= 1, `${look}: ${sel}`);
  }
});
