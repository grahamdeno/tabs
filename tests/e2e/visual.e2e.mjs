// Visual snapshots of the main screens, dark and light, phone and iPad.
//   VISUAL=update node --test tests/e2e/visual.e2e.mjs   saves new baselines
//   VISUAL=compare node --test tests/e2e/visual.e2e.mjs  fails on screens that changed
// Baselines are in tests/visual/ (made on a Mac or this workspace), or the folder
// in VISUAL_DIR: CI compares against tests/visual/ci/, made on GitHub's own
// machines by the "update screenshots" workflow, since fonts differ between
// computers. Screens are always saved to test-results/visual/ (a CI artifact).
// The clock is fixed so dates and "days ago" don't change the pictures.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { base, phone, skip, LIB, useBrowser } from "./harness.mjs";

useBrowser();
const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.VISUAL_DIR ? path.resolve(process.env.VISUAL_DIR) : path.join(here, "..", "visual"), OUT = path.join(here, "..", "..", "test-results", "visual");
const mode = process.env.VISUAL || "";

const TIPS = Object.fromEntries("library song edit add map pause pauseStage chord play line tap paste menu strobe searchInvite search nn tuner".split(" ").map(k => [k, true]));
const lib = theme => ({
  ...LIB,
  songs: [...LIB.songs, { id: "c", title: "Tab Song", artist: "X", format: "tab", body: "e|---0---2---|\nB|---1---3---|\nG|---0---2---|\nD|---2---0---|" }],
  sets: [{ id: "s", name: "Friday Gig", songIds: ["a", "b"], when: "2030-01-04T20:00", runs: [{ at: 1790000000000, secs: 1120, songs: 2 }], note: "Ran long" }],
  settings: { v: 6, theme, controls: "bar", streakMoment: false, tipsSeen: TIPS, micExplained: true, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", countIn: false, lastTuned: 9e15 }
});
const SHOTS = [
  ["library", "#/library"], ["sketch", "#/sketch"], ["song", "#/song/a"], ["tab", "#/song/c"], ["set", "#/set/s"], ["settings", "#/settings"], ["gestures", "#/gestures"],
  ["menu", "#/song/a", p => p.click("button.more:visible")],
  ["edit", "#/song/a", async p => { await p.click("button.more:visible"); await p.click(".menu [data-m='edit']"); }],
  ["search", "#/library", async p => { await p.click("#q"); await p.keyboard.type("willow"); }],
  ["ask", "#/song/a", async p => { await p.click("button.more:visible"); await p.click(".menu [data-m='edit']"); await p.waitForTimeout(300); await p.click("[data-sec]"); }]
];

// Pixels that differ by more than a little, counted in the page itself.
async function differs(page, a, b) {
  return page.evaluate(async ([a, b]) => {
    const load = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [x, y] = await Promise.all([load(a), load(b)]);
    if (x.width !== y.width || x.height !== y.height) return Infinity;
    const px = img => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const p = px(x), q = px(y); let n = 0;
    for (let i = 0; i < p.length; i += 4) if (Math.max(Math.abs(p[i] - q[i]), Math.abs(p[i + 1] - q[i + 1]), Math.abs(p[i + 2] - q[i + 2])) > 24) n++;
    return n;
  }, [a, b]);
}

for (const [device, viewport] of [["phone", { width: 390, height: 844 }], ["ipad", { width: 1180, height: 820 }]]) {
  for (const theme of ["dark", "light"]) {
    test(`screens look the same: ${device}, ${theme}`, { skip: skip() }, async t => {
      const page = await phone(t, lib(theme), { viewport, colorScheme: theme, reducedMotion: "reduce", fixedTime: "2026-10-13T12:00:00" });
      fs.mkdirSync(OUT, { recursive: true });
      if (mode === "update") fs.mkdirSync(BASE, { recursive: true });
      const changed = [];
      for (const [name, hash, act] of device === "ipad" ? SHOTS.filter(s => ["library", "song", "edit"].includes(s[0])) : SHOTS) {
        await page.goto(base + hash); await page.reload(); await page.waitForTimeout(450);
        if (act) { await act(page); await page.waitForTimeout(400); }
        await page.mouse.move(0, 0);
        /* The version changes every release; keep it out of the comparison. */
        await page.evaluate(() => { document.activeElement?.blur?.(); document.getElementById("toast")?.classList.remove("show"); document.querySelectorAll(".s-ver").forEach(el => { el.textContent = "Tabs"; }); });
        await page.waitForTimeout(150);
        const file = `${device}_${theme}_${name}.png`, shot = await page.screenshot();
        fs.writeFileSync(path.join(OUT, file), shot);
        if (mode === "update") fs.writeFileSync(path.join(BASE, file), shot);
        if (mode === "compare") {
          const was = path.join(BASE, file);
          if (!fs.existsSync(was)) { changed.push(`${file} (no baseline)`); continue; }
          const n = await differs(page, "data:image/png;base64," + fs.readFileSync(was).toString("base64"), "data:image/png;base64," + shot.toString("base64"));
          if (n > 40) changed.push(`${file} (${n} pixels)`);
        }
      }
      for (const c of changed) console.log(`PROBLEM screen changed: ${c}`);
      assert.deepEqual(changed, [], "screens changed; look at test-results/visual, then VISUAL=update if intended");
    });
  }
}
