// Strum it: Basic Pitch (vendor/basic-pitch) hears synthesized guitar
// strums and riffs, and strumChords / riffNotes name them. Synthetic plucked
// strings (Karplus-Strong) with a little room noise stand in for a phone mic;
// real recordings go in tests/audio/chords (see its README).
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, base, chromium } from "./harness.mjs";
useBrowser();

export const PROG = [["G", "C", "D", "Em"], ["Am", "F", "C", "G"], ["E", "A", "D", "A7"]];
async function run(page, plan) {
  return page.evaluate(async plan => {
    const C = await import("./core.js");
    const S = await import("./strum.js");
    const sr = 22050;
    const V = { G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64], D: [50, 57, 62, 66], Em: [40, 47, 52, 55, 59, 64], Am: [45, 52, 57, 60, 64], F: [41, 48, 53, 57, 60, 65], A7: [45, 52, 55, 61, 64], E: [40, 47, 52, 56, 59, 64], A: [45, 52, 57, 61, 64] };
    let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const out = new Float32Array(Math.ceil(sr * (plan.length * 4 * 0.7 + 1.5)));
    /* A plucked string that rings until the next strum mutes it (the fretting hand lifts). */
    const pluck = (midi, at, amp, until) => {
      const f = 440 * 2 ** ((midi - 69) / 12), N = Math.round(sr / f), buf = new Float32Array(N);
      for (let i = 0; i < N; i++) buf[i] = rnd() * 2 - 1;
      const start = Math.round(at * sr), len = Math.round(sr * Math.min(1.6, until - at + 0.03)), rel = Math.round(sr * 0.03);
      for (let i = 0, j = 0; i < len && start + i < out.length; i++, j = (j + 1) % N) {
        const v = buf[j]; buf[j] = 0.4985 * (v + buf[(j + 1) % N]);
        out[start + i] += v * amp * Math.min(1, (len - i) / rel);
      }
    };
    let t = 0.3;
    for (const step of plan) {
      if (step.riff) { step.riff.forEach(m => { pluck(m, t, 0.5, t + 0.32); t += 0.32; }); continue; }
      for (let k = 0; k < 4; k++) { V[step].forEach((m, i) => pluck(m, t + i * 0.014, 0.28 + rnd() * 0.1, t + 0.7)); t += 0.7; }
    }
    for (let i = 0; i < out.length; i++) out[i] = out[i] * 0.5 + (rnd() * 2 - 1) * 0.004;
    const t0 = performance.now();
    const notes = await S.hear(out, sr);
    const K = await import("./sketch.js"); const rp = K.readPlaying(notes);
    return { rp: [rp.chords.map(c => c.chord), rp.riff.map(n => n.midi)], ms: Math.round(performance.now() - t0), chords: C.strumChords(notes).map(c => c.chord), riff: C.riffNotes(notes).map(n => n.midi), n: notes.length, raw: plan[0].riff ? notes.slice(0, 40).map(n => [n.midi, +n.start.toFixed(2), +n.dur.toFixed(2), +n.amp.toFixed(2)]) : [] };
  }, plan);
}

test("Strum it hears synthesized strums: chords in order", { skip: skip(), timeout: 240000 }, async t => {
  const page = await phone(t, LIB);
  for (const prog of PROG) {
    if (process.env.ONE && prog[0] !== process.env.ONE) continue;
    const r = await run(page, prog);
    console.log("# ", prog.join(" "), "→", r.chords.join(" "), `(${r.n} notes, ${r.ms} ms)`);
    if (process.env.RAW) console.log("# raw", JSON.stringify(r.raw));
    assert.deepEqual(r.chords, prog);
    assert.deepEqual(r.rp[0], prog, "read as chords, not a riff");
  }
});

test("Strum it hears a riff: single notes in order", { skip: skip(), timeout: 120000 }, async t => {
  const page = await phone(t, LIB);
  const riff = [55, 59, 62, 64, 62, 59, 57, 55];
  const r = await run(page, [{ riff }]);
  console.log("# riff", riff.join(" "), "→", r.riff.join(" "));
  if (process.env.RAW) console.log("# raw", JSON.stringify(r.raw));
  assert.deepEqual(r.riff, riff);
  assert.deepEqual(r.rp, [[], riff], "read as a riff, not chords");
});

// The whole path on the Sing it screen: Strum it, hold the pad while a guitar
// plays into the (fake) microphone, let go, and the played chords land over
// the words in the new song.
const GUITAR_MIC = `
window.__strum = null;
navigator.mediaDevices.getUserMedia = async () => {
  const ctx = new AudioContext(), dest = ctx.createMediaStreamDestination();
  const sr = ctx.sampleRate, V = { G: [43, 47, 50, 55, 59, 67], C: [48, 52, 55, 60, 64] };
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  setInterval(() => {
    if (!window.__strum) return;
    const plan = window.__strum; window.__strum = null;
    const len = plan.length * 4 * 0.7 + 0.5, buf = ctx.createBuffer(1, Math.ceil(sr * len), sr), out = buf.getChannelData(0);
    const pluck = (midi, at, amp, until) => {
      const f = 440 * 2 ** ((midi - 69) / 12), N = Math.round(sr / f), b = new Float32Array(N);
      for (let i = 0; i < N; i++) b[i] = rnd() * 2 - 1;
      const st = Math.round(at * sr), L = Math.round(sr * (until - at + 0.03)), rel = Math.round(sr * 0.03);
      for (let i = 0, j = 0; i < L && st + i < out.length; i++, j = (j + 1) % N) { const v = b[j]; b[j] = 0.4985 * (v + b[(j + 1) % N]); out[st + i] += v * amp * 0.5 * Math.min(1, (L - i) / rel); }
    };
    let t = 0.1;
    for (const c of plan) for (let k = 0; k < 4; k++) { V[c].forEach((m, i) => pluck(m, t + i * 0.014, 0.3, t + 0.7)); t += 0.7; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(dest); src.start();
  }, 20);
  return dest.stream;
};`;

test("Strum it on the Sing it screen: play a line, and the chords you played go over its words", { skip: skip(), timeout: 240000 }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(GUITAR_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  if (process.env.DBG) { page.on("console", m => console.log("# con", m.text())); page.on("pageerror", e => console.log("# perr", String(e))); }
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); /* 4.9.0: Add is in the Songbook */
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.reload(); await page.waitForSelector("#add");
  await page.click("#add"); await page.waitForSelector("#sr-write"); await page.click("#sr-write"); /* 4.45.0: "What song?" first */ await page.waitForSelector("#ed-sing");
  await page.click("#ed-sing"); await page.waitForSelector("[data-mode='sing']");
  assert.equal(await page.getAttribute("[data-mode='sing']", "aria-pressed"), "true", "Voice stays the default");
  await page.click("[data-mode='strum']");
  assert.match(await page.innerText("#sk-pad-t"), /TAP TO PLAY/);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/strum-1.png" });
  await page.waitForFunction(() => !document.querySelector(".skear"), null, { timeout: 60000 });
  const pad = await page.locator("#sk-pad").boundingBox(), px = pad.x + pad.width / 2, py = pad.y + pad.height - 60;
  await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(500) /* real timer: the hold */;
  await page.evaluate(() => { window.__strum = ["G", "C"]; });
  await page.waitForTimeout(6200) /* real timer: a line takes this long to play */;
  await page.mouse.up(); await page.waitForFunction(() => /INPUT|TEXTAREA/.test(document.activeElement?.tagName || ""));
  /* The line shows "Hearing your chords…" until they arrive (quickly here). */
  await page.keyboard.type("Lantern hung by the kitchen door");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForFunction(() => !document.querySelector(".sknb-hear"), null, { timeout: 120000 });
  const row = await page.innerText(".skl");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/strum-2.png" });
  assert.match(row, /G[\s\S]*C/, "the played chords sit over the words");
  await page.click("#sk-done"); await page.waitForSelector("#sk-save"); await page.click("#sk-save"); /* 4.74.0: Your song, then Save */
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.sketch));
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.sketch);
  assert.ok(song, "a new song was made");
  assert.match(song.body, /^G\s+C\s*\nLantern hung by the kitchen door$/);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.sketchMode, "strum", "the choice is remembered");
  assert.deepEqual(errors, []);
});

// Real recordings (tests/audio/chords/*.wav, named after the chord: G.wav,
// Am_phone-on-stand.wav): each must be heard as that chord. Riffs
// (riff_55-59-62.wav, MIDI notes in the name) must give those notes in order.
import fs from "node:fs";
import path from "node:path";
const DIR = process.env.STRUM_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), "..", "audio", "chords");
const REAL = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => /\.wav$/i.test(f)) : [];
test("Strum it hears the real recordings in tests/audio/chords", { skip: skip() || (!REAL.length && "no recordings yet"), timeout: 600000 }, async t => {
  const page = await phone(t, LIB);
  const bad = [];
  for (const f of REAL) {
    const bytes = [...fs.readFileSync(path.join(DIR, f))];
    const r = await page.evaluate(async bytes => {
      const S = await import("./sketch.js");
      return S.listenTo(new Blob([new Uint8Array(bytes)], { type: "audio/wav" })).then(r => ({ chords: r.chords.map(c => c.chord), riff: r.riff.map(n => n.midi) }));
    }, bytes);
    const want = f.replace(/\.wav$/i, "").split("_");
    const ok = want[0] === "riff" ? r.riff.join("-") === want[1] : r.chords.length === 1 && r.chords[0] === want[0];
    console.log(`# ${ok ? "ok " : "MISS"} ${f} → ${want[0] === "riff" ? r.riff.join("-") : r.chords.join(" ")}`);
    if (!ok) bad.push(f);
  }
  assert.deepEqual(bad, [], "every recording heard right");
});
