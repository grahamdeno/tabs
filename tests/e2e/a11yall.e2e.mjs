// 4.73.0 (Graham, 2026-10-24): an accessibility pass over every page and sheet in all three palettes. Every
// control has a name, and (with axe-core, as in CI) axe finds no serious or critical problem. Each palette is its
// own test, and the failure message lists every problem found, so CI's annotation shows them all at once.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { base, phone, skip, LIB, useBrowser, tool, settled } from "./harness.mjs";

useBrowser();
const require = createRequire(import.meta.url);
let axePath = null;
try { axePath = require.resolve("axe-core/axe.min.js"); }
catch { try { axePath = require.resolve(path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")); } catch { /* not installed */ } }

const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 8, body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand" };
const lib = theme => ({ ...LIB, songs: [...LIB.songs, SHORT], sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }],
  merch: { has: ["brick"], backdrop: "brick", tips: 500, tconv: 1 },
  settings: { ...LIB.settings, v: 6, theme, plainPlay: false, gigScore: false, place: { name: "Wilmington", lat: 34.2, lon: -77.9 }, playAir: { hum: 30, temp: 80, unit: "F", day: "2026-10-20" } } });
const back = p => p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
/* [name, hash, what to do there first] */
const SCREENS = [
  ["road", "#/"], ["songbook", "#/library"], ["search", "#/library", p => p.click("#add")],
  ["song", "#/song/a"], ["tune up", "#/song/a", p => p.waitForSelector("#tuneup", { timeout: 5000 }).catch(() => {})],
  ["tools: play", "#/song/a", async p => { await p.click("#more"); await p.click(".menu [data-tab=play]"); }],
  ["tools: practice", "#/song/a", async p => { await p.click("#more"); await p.click(".menu [data-tab=practice]"); }],
  ["tools: song", "#/song/a", async p => { await p.click("#more"); await p.click(".menu [data-tab=song]"); }],
  ["edit", "#/song/a", p => tool(p, "edit")],
  ["get the chords", "#/library", p => p.evaluate(() => import("/findai.js").then(m => m.chartLinkSheet({ title: "Lantern", artist: "Me" })))],
  ["paste back", "#/library", async p => { await p.evaluate(() => import("/app.js").then(m => m.expectPaste({ q: "Lantern", title: "Lantern" }))); await back(p); }],
  ["merch", "#/merch"], ["merch item", "#/merch", p => p.click(".mc-fin[data-id=tweed]")],
  ["charts", "#/charts"], ["tour", "#/tour"], ["band", "#/band"], ["profile", "#/you"], ["map", "#/playmap"],
  ["practice", "#/practice"], ["settings", "#/settings"], ["settings: playing", "#/settings/playing"], ["settings: look", "#/settings/look"],
  ["more", "#/", p => p.click("#tabs [data-tab=more]")],
  ["set", "#/set/s"], ["trash", "#/trash"], ["gestures", "#/gestures"],
  /* 4.81.0: trumpet */
  ["trumpet: ask", "#/song/b", p => p.evaluate(() => import("/horn.js").then(m => m.askInstrument()).then(() => document.querySelector("[data-in=trumpet]").click()))],
  ["trumpet: song", "#/song/b", p => p.evaluate(() => import("/app.js").then(m => { m.data.settings.instrument = "trumpet"; m.redraw(); }))],
  ["trumpet: hard key", "#/song/a", p => p.evaluate(() => import("/app.js").then(async m => { m.data.settings.instrument = "trumpet"; m.redraw(); (await import("/horn.js")).hardKeySheet(m.viewing); }))],
  ["trumpet: play together", "#/song/a", p => p.evaluate(() => import("/app.js").then(async m => { m.data.settings.instrument = "trumpet"; m.redraw(); (await import("/share.js")).duetSheet(m.viewing); }))],
  ["show complete", "#/song/g", async p => { await p.click("#play"); await p.waitForSelector(".gc", { timeout: 40000 }); await p.waitForFunction(() => !document.querySelector(".co"), null, { timeout: 15000 }).catch(() => {}); }]
];

const unnamed = () => {
  const shown = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[aria-hidden=true],[hidden],[inert]"); };
  const name = el => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") || "").split(" ").map(i => document.getElementById(i)?.textContent || "").join("") ||
    el.textContent || el.title || el.getAttribute("placeholder") || [...(el.labels || [])].map(l => l.textContent).join("")).trim();
  return [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch]")]
    .filter(el => shown(el) && !name(el)).map(el => el.outerHTML.slice(0, 120));
};

/* one test per palette and screen, so CI lists each problem on its own line */
for (const theme of ["dark", "light", "green", "headliner"]) for (const [screen, hash, act] of SCREENS) {
  test(`4.73.0 ${screen}: names, and axe finds nothing serious (${theme})`, { skip: skip(), timeout: 120000 }, async t => {
    const page = await phone(t, lib(theme), { colorScheme: ["dark", "headliner"].includes(theme) ? "dark" : "light", reducedMotion: "reduce", locale: "en-US", permissions: ["clipboard-read", "clipboard-write"] });
    await page.route("https://api.open-meteo.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ current: { relative_humidity_2m: 85, temperature_2m: 60 } }) }));
    await page.goto(base + hash); await page.reload(); await page.waitForTimeout(500); await settled(page);
    if (act) { await act(page); await page.waitForTimeout(500); }
    const problems = (await page.evaluate(unnamed)).map(h => `no name: ${h}`);
    if (axePath) {
      await page.evaluate(fs.readFileSync(axePath, "utf8"));
      problems.push(...await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"], resultTypes: ["violations"] }))
        .violations.filter(v => v.impact === "serious" || v.impact === "critical")
        .flatMap(v => v.nodes.slice(0, 6).map(n => `${v.id}: ${n.target.join(" ")}${n.any?.[0]?.data?.contrastRatio ? ` ${n.any[0].data.contrastRatio}:1 ${n.any[0].data.fgColor} on ${n.any[0].data.bgColor}` : ""}`))));
    }
    assert.equal(problems.length, 0, `${screen} (${theme}): ${problems.join(" || ")}`);
  });
}
