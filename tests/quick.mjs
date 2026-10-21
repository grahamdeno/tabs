// Quick check while working: the unit tests, plus the browser tests that cover
// the files changed since origin/main (committed or not). Run the full suite
// before pushing. Usage: node tests/quick.mjs [--all-e2e]
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const sh = c => { try { return execSync(c, { encoding: "utf8" }); } catch { return ""; } };
const changed = new Set([
  ...sh("git diff --name-only origin/main...HEAD").split("\n"),
  ...sh("git diff --name-only HEAD").split("\n"),
  ...sh("git ls-files --others --exclude-standard").split("\n")
].filter(Boolean));

// Which browser test files cover which app files.
const COVERS = {
  "app.js": ["app", "regress", "duet", "changes", "today", "swipe"],
  "core.js": ["app", "changes", "today", "profile"],
  "ui.js": ["app", "regress"],
  "settings.js": ["settings", "today"],
  "findai.js": ["playnext", "getsong"],
  "aitools.js": ["app"],
  "tuner.js": ["app"],
  "heads.js": ["app"],
  "fold.js": ["tips", "app", "settings"],
  "coach.js": ["tips"],
  "german.js": ["german"],
  "sets.js": ["app", "regress"],
  "editor.js": ["app", "regress", "strum"],
  "sketch.js": ["strum"], "strum.js": ["strum"],
  "store.js": ["app"],
  "styles.css": ["regress", "a11y"],
  "index.html": ["app", "a11y"],
  "sw.js": ["app"],
  "profile.js": ["profile"],
  "practice.js": ["practice"],
  "gig.js": ["app"], "tour.js": ["app"], "charts.js": ["app"], "band.js": ["app"], "friends.js": ["app"], "merch.js": ["app"], "hud.js": ["app"],
  "road.js": ["app"], "duel.js": ["app"], "share.js": ["app", "duet"], "listen.js": ["app", "getsong"], "playmap.js": ["app"],
  "scene.js": ["app"], "drawer.js": ["app"], "dial.js": ["app"], "crop.js": ["app"], "louie.js": ["regress"]
};
const files = new Set();
for (const f of changed) {
  const m = /^tests\/e2e\/([\w-]+)\.e2e\.mjs$/.exec(f);
  if (m && !m[1].startsWith("zz_")) files.add(m[1]);
  /* The big feature suite is split in three files: app, app2, app3. */
  for (const name of COVERS[f] || []) for (const n of name === "app" ? ["app", "app2", "app3"] : [name]) files.add(n);
}
const all = process.argv.includes("--all-e2e");
const e2e = (all ? fs.readdirSync("tests/e2e").filter(f => f.endsWith(".e2e.mjs") && !f.startsWith("zz_")) : [...files].map(n => `${n}.e2e.mjs`))
  .map(f => `tests/e2e/${f}`).filter(f => fs.existsSync(f));

console.log(`Changed: ${[...changed].join(", ") || "nothing"}`);
console.log(`Browser tests: ${e2e.map(f => f.replace(/.*\//, "")).join(", ") || "none"}`);
const r = spawnSync(process.execPath, ["--test", "--test-concurrency=4", "tests/core.test.mjs", ...e2e], { stdio: "inherit" });
process.exit(r.status ?? 1);
