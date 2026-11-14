// Measures Listening booth takes (a .wav and .json each) through the real engine, by chord and switch.
// git fetch --depth=1 origin booth && git archive FETCH_HEAD booth | tar -x -C /tmp/takes && node tools/hearing/takes.mjs /tmp/takes/booth
import fs from "node:fs";
import path from "node:path";
const { wav, frames } = await import("./measure.mjs");
const C = await import("../../core.js");
const root = process.argv[2] || "booth"; /* a folder of booth takes: git archive FETCH_HEAD booth | tar -x */
const rows = [];
for (const day of fs.readdirSync(root)) for (const f of fs.readdirSync(path.join(root, day)).filter(f => f.endsWith(".json"))) {
  const L = JSON.parse(fs.readFileSync(path.join(root, day, f)));
  const { x, sr } = wav(path.join(root, day, f.replace(".json", ".wav")));
  const fr = frames(x, sr), calls = fr.map(c => C.boothCall(c, L.chords)), sum = C.boothSummary(calls, L.chords);
  rows.push({ f, L, sum, secs: x.length / sr });
}
rows.sort((a, b) => a.L.at.localeCompare(b.L.at));
const pc = (n, d) => d ? Math.round(100 * n / d) : 0;
console.log("CHORDS  (place strum | reads right% wrong% top-confusion | phone said right%)");
const agg = {};
for (const r of rows.filter(r => r.L.kind === "chord")) {
  const s = r.sum, top = Object.entries(s.by).sort((a, b) => b[1] - a[1])[0];
  const strum = r.L.strum || "";
  console.log(r.L.chords[0].padEnd(6), r.L.place.padEnd(6), strum.padEnd(6), String(s.reads).padStart(4), `${pc(s.right, s.reads)}%`.padStart(5), `${pc(s.wrong, s.reads)}%`.padStart(5), (top ? `${top[0]} ${pc(top[1], s.reads)}%` : "").padEnd(10), `| ${pc(r.L.heard?.right || 0, r.L.heard?.reads || 0)}%`);
  const k = r.L.chords[0]; (agg[k] ||= []).push(pc(s.right, s.reads));
}
console.log("\nSWITCHES");
for (const r of rows.filter(r => r.L.kind === "switch")) console.log(r.L.chords.join("-").padEnd(6), r.L.strum.padEnd(6), "switches", r.sum.switches, JSON.stringify(Object.fromEntries(Object.entries(r.sum.per).map(([k, v]) => [k, pc(v, r.sum.reads)]))), "| phone:", r.L.heard?.switches);
console.log("\nby chord, mean right%:", Object.entries(agg).map(([k, v]) => `${k} ${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}`).join("  "));
console.log("takes:", rows.length);
