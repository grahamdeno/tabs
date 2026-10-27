// Accessibility: every control has a name on every main screen, and (when
// axe-core is installed, as in CI) axe finds no serious or critical problems.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { base, phone, skip, LIB, useBrowser, tool } from "./harness.mjs";

useBrowser();
const require = createRequire(import.meta.url);
let axePath = null;
try { axePath = require.resolve("axe-core/axe.min.js"); }
catch { try { axePath = require.resolve(path.join(process.cwd(), "node_modules", "axe-core", "axe.min.js")); } catch { /* not installed */ } }

const TIPS = Object.fromEntries("library song edit add map pause pauseStage chord play line tap paste menu strobe searchInvite search nn tuner".split(" ").map(k => [k, true]));
const lib = theme => ({ ...LIB, sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }],
  trash: [{ type: "song", item: { id: "z", title: "Old Song", body: "G" }, deletedAt: new Date().toISOString() }],
  settings: { instrument: "guitar", v: 6, theme, controls: "bar", streakMoment: false, tipsSeen: TIPS, micExplained: true, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false } });
const SCREENS = [
  ["tonight", "#/"], ["library", "#/library"], ["song", "#/song/a"], ["set", "#/set/s"], ["settings", "#/settings"], ["trash", "#/trash"], ["gestures", "#/gestures"],
  ["menu", "#/song/a", p => p.click("#more")],
  ["editor", "#/song/a", async p => { await tool(p, "edit"); }],
  ["question", "#/trash", p => p.click("[data-forget]")],
  ["tuner", "#/library", p => p.click("#tunerbtn")],
  ["sketch", "#/sketch"]
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
    const page = await phone(t, lib(theme), { colorScheme: theme === "light" ? "light" : "dark", reducedMotion: "reduce" });
    const problems = [];
    for (const [screen, hash, act] of SCREENS) {
      await page.goto(base + hash); await page.reload(); await page.waitForTimeout(400);
      if (act) { await act(page); await page.waitForTimeout(400); }
      for (const html of await page.evaluate(unnamed)) problems.push(`${screen}: no name: ${html}`);
      if (axePath) {
        /* Evaluated rather than added as a script tag: the app's CSP allows only its own files. */
        await page.evaluate(fs.readFileSync(axePath, "utf8"));
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

/* 4.54.0: the show, the song it waits on, and Show complete (Chord Catch) have names and pass axe in each palette */
import { FAKE_MIC, settled } from "./harness.mjs";
for (const [theme, look] of [["dark", "neon"], ["light", "festival"], ["light", "green"], ["headliner", "headliner"]]) {
  test(`the Gig, Wait for me and Show complete pass axe (${look})`, { skip: skip() }, async t => {
    const song = { id: "w", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 12, waitForMe: true, bpm: 120,
      body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand" };
    const page = await phone(t, { ...lib(theme), songs: [song], settings: { ...lib(theme).settings, look, plainPlay: false } }, { colorScheme: theme === "light" ? "light" : "dark", reducedMotion: "reduce" });
    await page.context().addInitScript(FAKE_MIC);
    await page.goto(base + "#/song/w"); await page.reload(); await page.waitForSelector("#play");
    const problems = [];
    const check = async screen => {
      for (const html of await page.evaluate(unnamed)) problems.push(`${screen}: no name: ${html}`);
      if (!axePath) return;
      await page.evaluate(fs.readFileSync(axePath, "utf8"));
      const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"], resultTypes: ["violations"] }))
        .violations.filter(v => v.impact === "serious" || v.impact === "critical").map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`));
      for (const f of found) problems.push(`${screen}: ${f}`);
    };
    await check("paused song with shape tiles");
    await page.click("#play"); await page.waitForSelector("#gg-wait:not([hidden])", { timeout: 20000 });
    await check("waiting for a chord");
    await page.waitForFunction(() => { const b = document.getElementById("gg-skip"); if (b && !b.hidden) b.click(); return !!document.querySelector(".gc"); }, null, { timeout: 60000, polling: 300 }); /* skip each chord it waits on until the show ends */
    await check("show complete");
    for (const p of problems) console.log(`PROBLEM ${look} ${p}`);
    assert.deepEqual(problems, []);
  });
}

/* 4.59.0: the show over a white album cover (the hardest case) has names and passes axe in each palette */
const WHITE_PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");
for (const [theme, look] of [["dark", "neon"], ["light", "festival"], ["light", "green"], ["headliner", "headliner"]]) {
  test(`the Gig over an album cover passes axe (${look})`, { skip: skip() }, async t => {
    const song = { id: "c", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 30, bpm: 120,
      listen: { url: "https://music.apple.com/us/album/x/1?i=2", art: "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg" },
      body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand\n\n[Chorus]\nD        A\nCarry me home" };
    const page = await phone(t, { ...lib(theme), songs: [song], settings: { ...lib(theme).settings, look, plainPlay: false } }, { colorScheme: theme === "light" ? "light" : "dark", reducedMotion: "reduce" });
    await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: WHITE_PNG }));
    await page.goto(base + "#/song/c"); await page.reload(); await page.waitForSelector("#play");
    await page.waitForSelector("body.covered #gg-cover.in");
    const problems = [];
    const sweep = async screen => {
      for (const html of await page.evaluate(unnamed)) problems.push(`${screen}: no name: ${html}`);
      if (!axePath) return;
      await page.evaluate(fs.readFileSync(axePath, "utf8"));
      const found = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"], resultTypes: ["violations"] }))
        .violations.filter(v => v.impact === "serious" || v.impact === "critical").map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`));
      problems.push(...found.map(f => `${screen}: ${f}`));
    };
    await sweep("song page, before Play");
    await page.click("#play"); await page.waitForSelector("#gig #gg-pause");
    await sweep("playing");
    /* 4.60.1: paused, the page and the Tools sheet are dark too (they were white on white in the light palettes) */
    await page.click("#gg-pause"); await page.waitForSelector("body.held"); await settled(page);
    await sweep("paused");
    await page.click("#more"); await page.waitForSelector(".menu.tools"); await settled(page);
    await sweep("Tools open");
    for (const p of problems) console.log(`PROBLEM covered ${look} ${p}`);
    assert.deepEqual(problems, []);
  });
}
