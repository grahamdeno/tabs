// Road Ready, step 01: the tokens, fonts, tolex and plate button on Dark and Light,
// and proof that Green Room and Headliner are untouched.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, browser, base, tool } from "./harness.mjs";

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
    const fam = await page.evaluate(() => { const c = getComputedStyle(document.body); const h = document.createElement("h2"); document.body.appendChild(h); const d = getComputedStyle(h).fontFamily; h.remove(); return [c.fontFamily, d, getComputedStyle(document.documentElement).getPropertyValue("--mono")]; });
    assert.match(fam[0], /^Inter\b|^"Inter"/, "text is Inter"); assert.match(fam[1], /Space Grotesk/, "titles are Space Grotesk"); assert.match(fam[2], /IBM Plex Mono/, "tuner and tempo numbers are IBM Plex Mono");

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
