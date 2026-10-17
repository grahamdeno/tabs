// Quick check while working: the unit tests, plus the browser tests that cover
// the files changed since origin/main (committed or not). The full run
// (node --test tests/*.test.mjs tests/e2e/*.e2e.mjs) still goes before a push.
//
//   node tests/quick.mjs            changed files only
//   node tests/quick.mjs app.js     as if these files had changed
import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";

const COVER = {
  "app.js": ["app", "regress", "today", "changes", "duet", "ringhint"],
  "core.js": ["today", "changes", "duet"],
  "ui.js": ["app", "regress"],
  "styles.css": ["regress", "visual", "a11y"],
  "index.html": ["app", "regress"],
  "sw.js": ["app"],
  "settings.js": ["settings", "today", "regress"],
  "coach.js": ["tips", "ringhint"],
  "ring.js": ["ringhint", "tips"],
  "dial.js": ["app"],
  "findai.js": ["playnext", "getsong"],
  "tuner.js": ["app"],
  "heads.js": ["app"],
  "german.js": ["german"],
  "aitools.js": ["app"],
  "sketch.js": ["strum"],
  "strum.js": ["strum"],
  "sets.js": ["app", "duet"],
  "editor.js": ["app", "regress"],
  "store.js": ["app"],
  "crop.js": ["app"]
};

const sh = c => { try { return execSync(c, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const changed = process.argv.slice(2).length ? process.argv.slice(2)
  : [...new Set((sh("git diff --name-only origin/main") + sh("git diff --name-only") + sh("git ls-files --others --exclude-standard")).split("\n").filter(Boolean))];

const files = new Set();
for (const f of changed) {
  const base = f.split("/").pop();
  if (/^tests\/e2e\/.+\.e2e\.mjs$/.test(f) && fs.existsSync(f)) files.add(f);
  for (const name of COVER[base] || []) for (const n of name === "app" ? ["app", "app2", "app3"] : [name]) files.add(`tests/e2e/${n}.e2e.mjs`);
}
const run = ["tests/core.test.mjs", ...[...files].filter(f => fs.existsSync(f)).sort()];
console.log(`Changed: ${changed.join(", ") || "nothing"}\nRunning: ${run.join(" ")}\n`);
const r = spawnSync(process.execPath, ["--test", "--test-concurrency=3", ...run], { stdio: "inherit" });
process.exit(r.status ?? 1);
