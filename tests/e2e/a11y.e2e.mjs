// Accessibility: every control has a name on every main screen, and (when
// axe-core is installed, as in CI) axe finds no serious or critical problems.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";

useBrowser();
const require = createRequire(import.meta.url);
let axePath = null;
try { axePath = require.resolve("axe-core/axe.min.js"); }
catch { try { axePath = require.resolve(path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")); } catch { /* not installed */ } }

const TIPS = Object.fromEntries("library song edit add map pause pauseStage chord play line tap paste menu strobe searchInvite search nn tuner".split(" ").map(k => [k, true]));
const lib = theme => ({ ...LIB, sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }],
  trash: [{ type: "song", item: { id: "z", title: "Old Song", body: "G" }, deletedAt: new Date().toISOString() }],
  settings: { v: 6, theme, tipsSeen: TIPS, micExplained: true, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false } });
const SCREENS = [
  ["library", "#/"], ["song", "#/song/a"], ["set", "#/set/s"], ["settings", "#/settings"], ["trash", "#/trash"], ["gestures", "#/gestures"],
  ["menu", "#/song/a", p => p.click("#more")],
  ["editor", "#/song/a", async p => { await p.click("#more"); await p.click(".menu [data-m='edit']"); }],
  ["question", "#/trash", p => p.click("[data-forget]")],
  ["tuner", "#/", p => p.click("#tunerbtn")]
];

const unnamed = () => {
  const shown = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && !el.closest("[aria-hidden=true],[hidden],[inert]"); };
  const name = el => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") || "").split(" ").map(i => document.getElementById(i)?.textContent || "").join("") ||
    el.textContent || el.title || el.getAttribute("placeholder") || [...(el.labels || [])].map(l => l.textContent).join("")).trim();
  return [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch]")]
    .filter(el => shown(el) && !name(el)).map(el => el.outerHTML.slice(0, 120));
};

for (const theme of ["dark", "light"]) {
  test(`every control has a name, and axe finds nothing serious (${theme})`, { skip: skip() }, async t => {
    const page = await phone(t, lib(theme), { colorScheme: theme, reducedMotion: "reduce" });
    const problems = [];
    for (const [screen, hash, act] of SCREENS) {
      await page.goto(base + hash); await page.reload(); await page.waitForTimeout(400);
      if (act) { await act(page); await page.waitForTimeout(400); }
      for (const html of await page.evaluate(unnamed)) problems.push(`${screen}: no name: ${html}`);
      if (axePath) {
        await page.addScriptTag({ path: axePath });
        const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"], resultTypes: ["violations"] }))
          .violations.filter(v => v.impact === "serious" || v.impact === "critical")
          .map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`));
        for (const f of found) problems.push(`${screen}: ${f}`);
      }
    }
    for (const p of problems) console.log(`PROBLEM ${theme} ${p}`);
    assert.deepEqual(problems, []);
  });
}
