// Tabs sketch: sing a song idea line by line and get chords that fit the
// melody, placed over the words. Hold the pad to sing a line (or tap once to
// sing hands-free); let go to keep it, slide left to redo, slide up to make
// the song. A key wheel shows the key appearing as you sing and the chords it
// offers. Everything happens on this phone. Loads on first use.
import { detectPitch, melodyNotes, detectKey, harmonize, chordLine, chordWords, chordFit, keyConfidence, keyFamily, pitchShares, lineHint, packNotes, sungLines, unpackNotes, syllables, strumChords, riffNotes, cleanNotes, chordToneNotes, html, raw } from "./core.js";
import { $, app, icon, toast, onLeave, ask } from "./ui.js";
import { data, go, markUsed, newSong, tick } from "./app.js";
import { Tabs } from "./core.js";
import { noteError } from "./store.js";

const MAX_LINE = 30; /* seconds: a line stops itself */
// Strum it (2.9): how a line is heard. "sing": your voice, chords that fit the
// melody (as before). "strum": your guitar, the chords you played (Basic Pitch,
// strum.js, loaded on first use). "both": both, and where they disagree the
// line offers You played / Melody fits. The choice is remembered.
const MODES = [["sing", "Sing it"], ["strum", "Strum it"], ["both", "Both"]];
const mode = () => (MODES.some(m => m[0] === data.settings.sketchMode) ? data.settings.sketchMode : "sing");
const hears = () => mode() !== "sing";
let ear = null; /* strum.js, once loaded */
let earState = ""; /* "", "loading", "ready", "failed" */
function loadEar() {
  if (ear || earState === "loading") return;
  earState = "loading"; paint();
  import("./strum.js").then(async m => { if (!(await m.ready())) throw new Error("model"); ear = m; earState = "ready"; paint(); })
    .catch(() => { earState = "failed"; paint(); });
}
// The line's recording, heard for chords (or a riff). One at a time.
let hearQueue = Promise.resolve();
export async function listenTo(blob) {
  const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = buf.length, x = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels; }
  ear ||= await import("./strum.js");
  const notes = await ear.hear(x, buf.sampleRate);
  return readPlaying(notes);
}
// Chords if you strummed (three or more notes at once, much of the time);
// otherwise the single notes of a riff. Also a melody line for the key.
export function readPlaying(notes) {
  const ns = cleanNotes(notes);
  const span = ns.length ? Math.max(...ns.map(n => n.start + n.dur)) - Math.min(...ns.map(n => n.start)) : 0;
  const poly = span ? ns.reduce((a, n) => a + n.dur, 0) / span : 0;
  const chords = poly >= 1.8 ? strumChords(notes) : [];
  const riff = chords.length ? [] : riffNotes(notes);
  /* The top voice stands in for a melody: the key and the chord places use it. */
  const top = [];
  for (const n of [...ns].sort((a, b) => a.start - b.start)) { const p = top[top.length - 1]; if (p && n.start < p.start + p.dur - 0.05) { if (n.midi > p.midi) Object.assign(p, { midi: n.midi }); } else top.push({ midi: n.midi, start: n.start, dur: n.dur }); }
  return { chords, riff, melody: top };
}
// The sketch in progress stays while the app is open, so a look elsewhere
// doesn't lose it. Each line: { words, notes, dur, url, blob, custom (chords
// you chose over the suggestion) }. `again` is a line being sung again.
const sk = { lines: [], rec: null, again: -1, editing: -1 };
let mic = null; /* { stream, ctx, an, buf } once allowed */
let ui = 0;     /* live redraw timer while singing */

onLeave(r => { if (r.name !== "sketch") { stopLine("drop-quiet"); closeMic(); } });

function closeMic() {
  if (!mic) return;
  mic.stream.getTracks().forEach(t => t.stop());
  try { mic.src.disconnect(); } catch { /* already */ }
  mic = null;
}
// iPhone only lets audio run when it's started inside a touch: the audio
// context is made (or woken) right in the pad's touch, before the microphone
// is asked for; made later, it can stay asleep and hear only silence.
let audioCtx = null;
function primeAudio() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== "running") audioCtx.resume?.().catch?.(() => {});
  } catch { /* no Web Audio */ }
}
async function openMic() {
  primeAudio();
  if (mic && mic.stream.getAudioTracks().some(t => t.readyState === "live")) { await mic.ctx.resume?.(); return mic; }
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no mic"), { name: "NotSupportedError" });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = audioCtx;
  await ctx.resume?.();
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  const src = ctx.createMediaStreamSource(stream);
  src.connect(an);
  mic = { stream, ctx, an, src, buf: new Float32Array(an.fftSize) };
  return mic;
}
const micTrouble = e => toast(e?.name === "NotAllowedError" || e?.name === "SecurityError"
  ? "The microphone is off for Tabs. Open your iPhone's Settings, then Apps > Safari > Microphone, and choose Ask."
  : "The microphone isn't available here.", null, { label: "OK", fn: () => {} });

// ---- Recording one line ----
async function startLine() {
  if (sk.rec) return;
  const i = sk.again >= 0 ? sk.again : sk.lines.length;
  sk.editing = -1;
  sk.rec = { i, frames: [], t0: 0, timer: 0, chunks: [], recorder: null, latched: false, live: [] };
  paint();
  let m;
  try { m = await openMic(); }
  catch (e) { sk.rec = null; sk.again = -1; paint(); return micTrouble(e); }
  const rec = sk.rec;
  if (!rec) return;
  rec.t0 = m.ctx.currentTime;
  try {
    /* The recording takes its own copy of the microphone, so it can't starve the listening. */
    rec.recorder = new MediaRecorder(new MediaStream(m.stream.getAudioTracks().map(t => t.clone())));
    rec.recorder.ondataavailable = e => e.data.size && rec.chunks.push(e.data);
    rec.recorder.start();
  } catch { rec.recorder = null; /* hearing it back is a nicety */ }
  rec.timer = setInterval(() => {
    m.an.getFloatTimeDomainData(m.buf);
    const t = m.ctx.currentTime - rec.t0;
    let e = 0; for (let k = 0; k < m.buf.length; k++) e += m.buf[k] * m.buf[k];
    const level = Math.sqrt(e / m.buf.length);
    rec.peak = Math.max(rec.peak || 0, level); rec.level = level;
    rec.frames.push({ t, hz: detectPitch(m.buf, m.ctx.sampleRate, 0.0025) });
    if (t > MAX_LINE) stopLine("keep");
  }, 25);
  let n = 0;
  clearInterval(ui);
  ui = setInterval(() => {
    drawRibbon();
    /* The rings swell with your voice: proof the phone is hearing you. */
    const p = $("sk-pad"); if (p) p.style.setProperty("--lv", Math.min(1, (rec.level || 0) * 12).toFixed(2));
    if (++n % 3 === 0) { rec.live = melodyNotes(rec.frames); drawKey(); drawLiveChords(); }
  }, 110);
  tick();
}
// how: "keep" (let go), "drop" (slide left: this take goes), "drop-quiet" (leaving).
function stopLine(how = "keep") {
  const rec = sk.rec;
  if (!rec) return;
  clearInterval(rec.timer); clearInterval(ui);
  sk.rec = null; sk.again = -1;
  const notes = melodyNotes(rec.frames);
  const strumOnly = mode() === "strum";
  const keep = how === "keep" && (notes.length > 0 || (strumOnly && !!rec.recorder && (rec.frames.at(-1)?.t || 0) > 0.6));
  let ln = sk.lines[rec.i];
  if (keep) {
    if (!ln) { ln = { words: "", notes: [], dur: 0 }; sk.lines.push(ln); }
    ln.notes = notes; ln.dur = rec.frames.at(-1)?.t || 0; delete ln.custom; delete ln.played; delete ln.riff; delete ln.melodyPick;
    ln.via = mode();
    if (hears()) ln.hearing = true;
  }
  if (rec.recorder && rec.recorder.state !== "inactive") {
    let done; const ready = new Promise(r => { done = r; });
    if (keep) ln.ready = ready;
    rec.recorder.onstop = () => {
      done();
      if (!keep || !rec.chunks.length) return;
      if (ln.url) URL.revokeObjectURL(ln.url);
      ln.blob = new Blob(rec.chunks, { type: rec.recorder.mimeType });
      ln.url = URL.createObjectURL(ln.blob);
      const b = document.querySelector(`[data-play="${sk.lines.indexOf(ln)}"]`);
      if (b) b.hidden = false;
      if (ln.hearing) hearLine(ln);
    };
    rec.recorder.stop();
  }
  if (how === "drop-quiet") return;
  if (keep && ln.hearing && !rec.recorder) { ln.hearing = false; toast("This phone can't record the line, so Tabs can't hear the guitar. Sing it still works."); }
  if (how === "keep" && !keep) {
    paint();
    const pitched = rec.frames.filter(f => f.hz > 0).length, secs = rec.frames.at(-1)?.t || 0;
    noteError(new Error(`Sketch heard no notes: ${rec.frames.length} frames over ${secs.toFixed(1)}s, ${pitched} with pitch, peak level ${(rec.peak || 0).toFixed(4)}, audio ${mic?.ctx.state || "none"} at ${mic?.ctx.sampleRate || 0} Hz, track ${mic?.stream.getAudioTracks()[0]?.readyState || "none"}${mic?.stream.getAudioTracks()[0]?.muted ? " (muted)" : ""}`), { quiet: true, where: "sketch" });
    return toast(secs < 0.6 ? "That was too short to hear. Hold the pad while you sing the whole line."
      : !(rec.peak > 0.0005) ? "The microphone sent only silence. Settings > Copy diagnostics, and send them to me."
      : "No steady notes were heard. Sing the line (not speak it), a little closer to the phone.");
  }
  if (!keep) { paint(); return toast(rec.i < sk.lines.length ? `Line ${rec.i + 1} kept as it was` : "That take is gone. Hold to sing it again."); }
  tick(); markUsed("sketch"); if (hears()) markUsed("strum");
  /* Words next: the line opens for typing in the same tap, so the keyboard
     (and its microphone, for dictation) is ready. */
  sk.editing = ln.words ? -1 : rec.i;
  paint();
  if (sk.editing >= 0) $("sk-words")?.focus();
}

// Hear a kept line's recording: the played chords (or riff) arrive a few
// seconds after you let go. In Strum it they become the line's chords; in Both
// they lead too, and the melody's own chords stay one tap away.
function hearLine(ln) {
  hearQueue = hearQueue.then(async () => {
    if (!sk.lines.includes(ln) || !ln.blob) return;
    try {
      const r = await listenTo(ln.blob);
      if (!r.melody.length && !ln.notes.length) { ln.hearing = false; paint(); return toast("Nothing clear was heard. Hold the phone nearer the guitar and try the line again."); }
      /* Strum it: the chords played stand in for the melody (key, chord places). */
      if (ln.via === "strum") ln.notes = r.chords.length ? chordToneNotes(r.chords) : r.melody.length ? r.melody : ln.notes;
      else if (!ln.notes.length) ln.notes = r.melody;
      ln.played = r.chords.map(c => ({ chord: c.chord, at: c.at }));
      ln.riff = r.riff.length >= 3 ? r.riff.map(n => n.name) : null;
      if (ln.played.length) ln.custom = ln.played;
    } catch { toast("Couldn't hear the guitar in that line. The melody's chords stand in."); }
    ln.hearing = false; paint();
  });
}

// ---- The song so far: the key, each line's chords, and nudges ----
const allNotes = () => [...sk.lines.flatMap(l => l.notes), ...(sk.rec?.live || [])];
function plan() {
  const lines = sk.lines.filter(l => l.notes.length);
  const key = detectKey(lines.flatMap(l => l.notes));
  const harm = key ? harmonize(lines, key) : lines.map(() => []);
  sk.lines.forEach(l => { l.melodyChords = harm[lines.indexOf(l)] || []; l.changes = l.custom || l.melodyChords; });
  return key;
}

// ---- The key wheel ----
// Keys around the circle in fifths (neighbours sound related). The notes you
// sing land as dots on the inner ring, bigger the longer you hold them; the key
// lights as it becomes clear, with its six chords. Tap a chord to hear it.
const FIFTHS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const MINORS = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "Bbm", "Fm", "Cm", "Gm", "Dm"];
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const pretty = n => n.replace("#", "♯").replace(/([A-G])b/, "$1♭");
function wheelSVG(size, conf, shares) {
  const R = size / 2 - 4, c = size / 2, k = size / 300, key = conf.key, sure = conf.bars / 5;
  const fam = new Set(keyFamily(key).map(n => n.replace(/^Gb/, "F#").replace(/^C#(?!m)/, "Db")));
  const arc = (i, r1, r2) => {
    const a0 = (i * 30 - 105) * Math.PI / 180, a1 = (i * 30 - 75) * Math.PI / 180, p = (r, a) => `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
    return `M${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r2, a1)} A${r2},${r2} 0 0 0 ${p(r2, a0)} Z`;
  };
  const at = (r, i, dy = 0) => { const a = (i * 30 - 90) * Math.PI / 180; return { x: (c + r * Math.cos(a)).toFixed(1), y: (c + r * Math.sin(a) + dy).toFixed(1) }; };
  const parts = [];
  FIFTHS.forEach((n, i) => {
    const on = key && key.name === n, lit = key && fam.has(n), p = at(R - 22 * k, i, 5 * k);
    parts.push(`<g class="skw ${on ? "on" : lit ? "lit" : ""}" data-chord="${n}" style="--s:${sure.toFixed(2)}"><path d="${arc(i, R, R - 44 * k)}"/><text x="${p.x}" y="${p.y}" style="font-size:${(15 * k).toFixed(1)}px">${pretty(n)}</text></g>`);
    const m = MINORS[i], mlit = key && (fam.has(m) || (key.minor && key.name === m)), q = at(R - 62 * k, i, 4 * k);
    parts.push(`<g class="skw m ${key && key.name === m ? "on" : mlit ? "lit" : ""}" data-chord="${m}" style="--s:${sure.toFixed(2)}"><path d="${arc(i, R - 46 * k, R - 78 * k)}"/>${size >= 200 ? `<text x="${q.x}" y="${q.y}" style="font-size:${(11 * k).toFixed(1)}px">${pretty(m)}</text>` : ""}</g>`);
  });
  const rin = R - 92 * k;
  parts.push(`<circle cx="${c}" cy="${c}" r="${(rin + 6 * k).toFixed(1)}" class="skw-ring"/>`);
  FIFTHS.forEach((n, i) => {
    const w = shares[PC[n]] || 0, p = at(rin, i);
    if (w > 0.15) parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${((6 + 16 * w) * k).toFixed(1)}" class="skw-glow"/>`);
    parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${((2 + 10 * w) * k).toFixed(1)}" class="skw-dot ${w ? "on" : ""}" style="opacity:${w ? Math.min(1, 0.35 + w * 2).toFixed(2) : 0.6}"/>`);
  });
  const mid = key ? pretty(key.name) + (conf.bars < 4 ? "?" : "") : "?";
  parts.push(`<text x="${c}" y="${(c + (size >= 200 ? 4 : 7) * k).toFixed(1)}" class="skw-c" style="font-size:${(24 * k).toFixed(1)}px">${mid}</text>`);
  if (size >= 200) parts.push(`<text x="${c}" y="${(c + 20 * k).toFixed(1)}" class="skw-s" style="font-size:${(10 * k).toFixed(1)}px">${!key ? "listening" : conf.bars >= 4 ? "your key" : "maybe"}</text>`);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${parts.join("")}</svg>`;
}
const meterHTML = conf => html`<span class="skm-k">${conf.key ? `${pretty(conf.key.name.replace(/m$/, ""))} ${conf.key.minor ? "minor" : "major"}` : "Key"}</span>
  <span class="skm-bars" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => raw(`<i class="${i < conf.bars ? "on" : ""}"></i>`))}</span><span>${conf.key ? conf.state : "listening for it"}</span>`;
function drawKey() {
  const conf = keyConfidence(allNotes()), box = $("sk-wheel");
  const m = $("sk-meter"); if (m) m.innerHTML = meterHTML(conf).toString();
  if (box) box.innerHTML = wheelSVG(+box.dataset.size, conf, pitchShares(allNotes()));
  return conf;
}
// While singing: the chords that fit the last couple of seconds.
function drawLiveChords() {
  const el = $("sk-live"), rec = sk.rec;
  if (!el || !rec) return;
  const key = keyConfidence(allNotes()).key, recent = rec.live.filter(n => n.start >= (rec.frames.at(-1)?.t || 0) - 2.5);
  const fits = key && recent.length ? chordFit(recent, key).slice(0, 4) : [];
  el.innerHTML = fits.length ? html`${fits.map((f, i) => html`<span class="skc ${i ? "" : "on"}">${pretty(f.chord)}</span>`)}<small>fit what you're singing</small>`.toString() : "";
}

// ---- The melody ribbon while singing ----
function drawRibbon() {
  const svg = $("sk-rib"), rec = sk.rec;
  if (!svg || !rec) return;
  const W = 346, H = 86;
  const pts = rec.frames.filter(f => f.hz > 0).map(f => ({ t: f.t, m: 69 + 12 * Math.log2(f.hz / 440) }));
  if (!pts.length) { svg.innerHTML = `<text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" class="sk-empty">Listening…</text>`; return; }
  const span = Math.max(6, rec.frames.at(-1).t), lo = Math.min(...pts.map(p => p.m)) - 2, hi = Math.max(...pts.map(p => p.m)) + 2, rng = Math.max(12, hi - lo);
  const x = t => 4 + (t / span) * (W - 8), y = m => H - 6 - ((m - lo) / rng) * (H - 14);
  /* Gaps (breaths, consonants) break the line. */
  let d = "", fill = "", run = [];
  const flush = () => { if (run.length > 1) { const s = run.map((p, k) => `${k ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.m).toFixed(1)}`).join(""); d += s; fill += `${s}L${x(run.at(-1).t).toFixed(1)},${H}L${x(run[0].t).toFixed(1)},${H}Z`; } run = []; };
  pts.forEach((p, k) => { if (k && p.t - pts[k - 1].t > 0.12) flush(); run.push(p); });
  flush();
  svg.innerHTML = `<defs><linearGradient id="skg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" class="skg-a"/><stop offset="1" class="skg-b"/></linearGradient></defs><path d="${fill}" fill="url(#skg)"/><path d="${d}" class="sk-line"/>`;
}

// ---- Hear a chord (tap it on the wheel) ----
let synth = null;
function strum(name) {
  const m = /^([A-G][#b]?)(m?)/.exec(name);
  if (!m) return;
  synth ||= mic?.ctx || new (window.AudioContext || window.webkitAudioContext)();
  synth.resume?.();
  const root = 48 + PC[m[1]], third = m[2] ? 3 : 4, now = synth.currentTime;
  [0, 7, 12, 12 + third, 19].forEach((s, i) => {
    const f = 440 * 2 ** ((root + s - 69) / 12), o = synth.createOscillator(), g = synth.createGain(), lp = synth.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 1800;
    const t = now + i * 0.028;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    o.connect(lp).connect(g).connect(synth.destination); o.start(t); o.stop(t + 1.9);
  });
  tick();
}

// ---- The screen ----
function rowHTML(l, i, key) {
  const ws = l.words.trim().split(/\s+/).filter(Boolean), at = l.changes?.length ? chordWords(l.words, l.notes, l.changes) : [];
  const over = new Map(); at.forEach((w, j) => over.set(w, (over.get(w) ? over.get(w) + " " : "") + pretty(l.changes[j].chord)));
  const extra = at.map((w, j) => (w >= ws.length ? pretty(l.changes[j].chord) : "")).filter(Boolean).join(" ");
  /* One nudge at a time: on the line just sung, if it has one. */
  const hint = i === sk.lines.length - 1 && !l.custom && !l.via?.match(/strum|both/) && key && lineHint(l.words, l.notes, l.changes || [], key);
  /* Both: when the guitar and the melody disagree, either is one tap away. */
  const melody = l.via === "both" && l.played?.length ? (l.melodyChords || []).map(c => c.chord).join(" ") : "";
  const played = l.played?.map(c => c.chord).join(" ") || "";
  const cmp = melody && played && melody !== played;
  const editing = sk.editing === i;
  return html`<div class="sknb-row" data-row="${i}"><b class="sknb-n">${i + 1}</b>
    <div class="sknb-txt">${editing
      ? html`<input id="sk-words" class="sknb-in" value="${l.words}" placeholder="Say or type the words" autocapitalize="sentences" enterkeyhint="done" aria-label="Words for line ${i + 1}">`
      : html`<button class="sknb-line" data-edit="${i}" aria-label="Line ${i + 1}: ${l.words || "no words yet"}. Tap to change the words">${ws.length ? ws.map((w, k) => html`<span class="sknb-w">${over.has(k) && html`<b>${over.get(k)}</b>`}${w}</span> `) : html`<span class="sknb-none">${over.get(0) && html`<span class="sknb-w"><b>${over.get(0)}</b>&nbsp;</span>`}Tap to add the words</span>`}${extra && html`<span class="sknb-w"><b>${extra}</b>&nbsp;</span>`}</button>`}
    ${l.hearing && html`<span class="sknb-hear"><i class="spin"></i>Hearing your chords…</span>`}
    ${l.riff && !l.hearing && html`<span class="sknb-riff">Riff: ${l.riff.join(" ")}</span>`}
    ${cmp && !editing && html`<div class="skcmp" role="group" aria-label="Chords for line ${i + 1}"><button data-pick="${i}" data-src="played" class="${l.melodyPick ? "" : "on"}" aria-pressed="${!l.melodyPick}">You played<b>${played}</b></button><button data-pick="${i}" data-src="melody" class="${l.melodyPick ? "on" : ""}" aria-pressed="${!!l.melodyPick}">Melody fits<b>${melody}</b></button></div>`}
    ${hint && !editing && html`<button class="sknb-hint" data-hint="${i}" data-j="${hint.j}" data-chord="${hint.chord}">${hint.words ? `“${hint.words}” — ` : ""}try ${pretty(hint.chord)} here${hint.minor ? ", it sounds like you leaned minor" : hint.major ? ", it sounds brighter there" : ""} <span aria-hidden="true">↗</span></button>`}</div>
    <div class="sknb-acts"><button class="sb" data-play="${i}" aria-label="Hear line ${i + 1}" ${l.url ? "" : raw("hidden")}>${icon("play")}</button>
      <button class="sb" data-again="${i}" aria-label="Sing line ${i + 1} again">${icon("loop")}</button>
      <button class="sb" data-del="${i}" aria-label="Remove line ${i + 1}">${icon("x")}</button></div></div>`;
}
let repainting = false; /* the old words box blurs as it's replaced: not a "done typing" */
function paint() {
  /* Keep the pad the finger is on: iPhone stops sending a touch whose element is replaced. */
  const held = gest ? $("sk-pad") : null;
  /* Chords can arrive while you type a line's words: keep the box, its text and the cursor. */
  const w = document.activeElement?.id === "sk-words" ? document.activeElement : null;
  const typing = w && { value: w.value, a: w.selectionStart, b: w.selectionEnd };
  repainting = true;
  try { paintAll(); } finally { repainting = false; }
  if (typing) { const n = $("sk-words"); if (n) { n.value = typing.value; n.focus({ preventScroll: true }); try { n.setSelectionRange(typing.a, typing.b); } catch { /* not a text box */ } } }
  if (held) {
    const fresh = $("sk-pad");
    held.className = fresh.className; held.innerHTML = fresh.innerHTML; held.setAttribute("aria-label", fresh.getAttribute("aria-label"));
    fresh.replaceWith(held);
  }
}
function paintAll() {
  const rec = sk.rec, n = sk.lines.length, key = plan();
  const conf = keyConfidence(allNotes()), next = sk.again >= 0 ? sk.again : n;
  const big = !!rec || !n;
  const fam = keyFamily(conf.key);
  app.innerHTML = html`
    <div class="head"><button class="btn sm glass" id="sk-cancel">${n ? "Discard" : "Cancel"}</button>
      <button class="btn sm primary" id="sk-done" ${n && !rec ? "" : raw("disabled")}>Make chords</button></div>
    <div class="skh"><h1 class="title">New sketch</h1><div class="skdots" role="img" aria-label="${n} line${n === 1 ? "" : "s"}">${[...Array(n)].map(() => raw('<i class="on"></i>'))}${raw("<i></i>")}</div></div>
    <div class="seg skmode" role="group" aria-label="How Tabs listens">${MODES.map(([k, n]) => html`<button data-mode="${k}" class="${mode() === k ? "on" : ""}" aria-pressed="${mode() === k}" ${rec ? raw("disabled") : ""}>${n}</button>`)}</div>
    ${hears() && earState !== "ready" ? html`<div class="skear">${earState === "failed" ? html`Couldn't load the chord listener. Check the connection, then switch again.` : html`<i class="spin"></i>Getting the chord listener ready (about 2 MB, once)`}</div>` : ""}
    <div class="skmeter" id="sk-meter" aria-live="polite">${meterHTML(conf)}</div>
    ${big
      ? html`<div class="skwheel big" id="sk-wheel" data-size="240"></div>`
      : html`<div class="skwheel-row"><div class="skwheel small" id="sk-wheel" data-size="116"></div><div class="skfam">${fam.length ? html`<span>${mode() === "strum" ? "Chords in your key" : "Your melody can use"}</span><div>${fam.map(c => html`<button class="skfam-c" data-chord="${c}" aria-label="Hear ${c}">${pretty(c)}</button>`)}</div><small>Tap a chord to hear it</small>` : html`<span>Sing a few more notes to find the key</span>`}</div></div>`}
    ${rec
      ? html`<div class="sklive"><div class="sk-lab on">Line ${rec.i + 1} · ${hears() ? "listening to your guitar" : "listening"}</div><svg id="sk-rib" viewBox="0 0 346 86" preserveAspectRatio="none" role="img" aria-label="Your melody"></svg>
          <div class="skwords">${sk.lines[rec.i]?.words || "Say the words after you let go"}</div><div class="skchips" id="sk-live"></div></div>`
      : n
        ? html`<div class="sknb">${sk.lines.map((l, i) => rowHTML(l, i, key))}<div class="sknb-next">${sk.again >= 0 ? `${mode() === "strum" ? "play" : "sing"} line ${sk.again + 1} again…` : `${mode() === "strum" ? "play" : "sing"} the next line…`}</div></div>`
        : html`<p class="skintro">${mode() === "strum" ? "Hold the pad and strum a line; let go to keep it. Tabs names the chords you played (or the notes of a riff), then you add the words." : mode() === "both" ? "Hold the pad, then sing and strum a line together; let go to keep it. The chords you played lead, and the melody's choice is one tap away." : "Hold the pad and sing a line; let go to keep it. Then say or type its words. The wheel shows your key as it appears."}</p>`}
    <div class="skpad ${rec ? "on" : ""} ${big ? "" : "small"}" id="sk-pad" role="button" tabindex="0" aria-label="${rec ? `Stop line ${rec.i + 1} and keep it` : `Sing line ${next + 1}`}">
      <i class="skpad-ring"></i><i class="skpad-ring r2"></i><i class="skpad-dot"></i>
      <b id="sk-pad-t">${rec ? (rec.latched ? "Tap to keep the line" : "Release to keep the line") : `Hold to ${mode() === "strum" ? "play" : mode() === "both" ? "sing and play" : "sing"} line ${next + 1}${sk.again >= 0 ? " again" : ""}`}</b>
      <span id="sk-pad-s">${rec ? "Slide left to redo · up to finish" : n ? "Swipe up to make the song" : `Or tap once to ${mode() === "strum" ? "play" : "sing"} hands-free`}</span></div>`.toString();
  drawKey(); drawRibbon(); drawLiveChords();
  bind();
}
function bind() {
  $("sk-cancel").onclick = () => {
    if (!sk.lines.length) { stopLine("drop-quiet"); return go("#/"); }
    ask({ title: "Discard this sketch?", text: "The lines you sang and their words go.", ok: "Discard", keep: "Keep singing", danger: true }, () => { stopLine("drop-quiet"); reset(); go("#/"); });
  };
  $("sk-done").onclick = finish;
  const w = $("sk-words");
  if (w) {
    const i = sk.editing;
    w.oninput = () => { sk.lines[i].words = w.value; };
    w.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); w.blur(); } };
    w.onblur = () => { if (!repainting && sk.editing === i && !sk.rec) { sk.editing = -1; paint(); } };
  }
  app.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { sk.editing = +b.dataset.edit; paint(); $("sk-words")?.focus(); });
  app.querySelectorAll("[data-hint]").forEach(b => b.onclick = () => {
    const l = sk.lines[+b.dataset.hint], j = +b.dataset.j;
    l.custom = l.changes.map((c, k) => (k === j ? { ...c, chord: b.dataset.chord } : c));
    paint(); strum(b.dataset.chord);
    toast(`${pretty(b.dataset.chord)} it is`, null, { label: "Undo", fn: () => { delete l.custom; paint(); } });
  });
  app.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
    const l = sk.lines[+b.dataset.pick];
    if (b.dataset.src === "melody") { l.melodyPick = true; delete l.custom; } else { l.melodyPick = false; l.custom = l.played; }
    paint(); tick();
  });
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
    if (sk.rec) return;
    data.settings.sketchMode = b.dataset.mode; Tabs.save(data);
    if (hears()) loadEar();
    paint();
  });
  app.querySelectorAll("[data-play]").forEach(b => b.onclick = () => { const u = sk.lines[+b.dataset.play]?.url; if (u) new Audio(u).play().catch(() => {}); });
  app.querySelectorAll("[data-again]").forEach(b => b.onclick = () => { sk.again = +b.dataset.again; sk.editing = -1; paint(); toast(`Hold the pad to sing line ${sk.again + 1} again`); });
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const i = +b.dataset.del, l = sk.lines.splice(i, 1)[0];
    paint();
    toast(`Line ${i + 1} removed`, null, { label: "Undo", fn: () => { sk.lines.splice(i, 0, l); paint(); } });
  });
  /* The wheel is redrawn as you sing, so it listens once for any chord tapped. */
  $("sk-wheel").onclick = e => { const g = e.target.closest?.("[data-chord]"); if (g) { strum(g.dataset.chord); g.classList.add("tap"); setTimeout(() => g.classList.remove("tap"), 400); } };
  app.querySelectorAll(".skfam-c").forEach(b => b.onclick = () => strum(b.dataset.chord));
  bindPad();
}

// The gesture lives outside the pad element: the screen redraws as a line
// starts, and the finger keeps going on the new pad.
let gest = null;
const padLabel = (t, s) => { const a = $("sk-pad-t"), b = $("sk-pad-s"); if (a) a.textContent = t; if (s !== undefined && b) b.textContent = s; };
function padClass(intent) { const pad = $("sk-pad"); pad?.classList.toggle("redo", intent === "redo"); pad?.classList.toggle("up", intent === "finish"); }
function gestMove(e) {
  const d = gest;
  if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y;
  const intent = dy < -60 && Math.abs(dy) > Math.abs(dx) ? "finish" : dx < -70 && sk.rec ? "redo" : "";
  if (intent === d.intent) return;
  d.intent = intent; padClass(intent);
  if (intent === "redo") padLabel("Let go to redo this line", "");
  else if (intent === "finish") padLabel(sk.lines.length || sk.rec ? "Let go to make the song" : "Sing a line first", "");
  else if (sk.rec) padLabel("Release to keep the line", "Slide left to redo · up to finish");
}
function gestEnd(e) {
  const d = gest;
  if (!d) return;
  gest = null; clearTimeout(d.timer);
  window.removeEventListener("pointermove", gestMove); window.removeEventListener("pointerup", gestEnd); window.removeEventListener("pointercancel", gestEnd);
  padClass("");
  /* A cancelled touch (iPhone's microphone question, a call): keep singing hands-free. */
  if (e.type === "pointercancel") { if (sk.rec) { sk.rec.latched = true; padLabel("Tap to keep the line", "Slide left to redo · up to finish"); } return; }
  if (d.intent === "finish") { if (sk.rec) stopLine("keep"); if (sk.lines.length) finish(); else paint(); return; }
  if (d.intent === "redo") return stopLine("drop");
  if (!sk.rec) return;
  if (d.was) return stopLine("keep");                                  /* a tap while hands-free: keep */
  if (Date.now() - d.at < 320) { sk.rec.latched = true; $("sk-pad")?.classList.add("latched"); padLabel("Tap to keep the line", "Slide left to redo · up to finish"); return; }
  stopLine("keep");
}
// ---- The pad: hold to sing, let go to keep; slide left to redo, up to finish.
// A quick tap sings hands-free until the next tap. Space or Return work too.
function bindPad() {
  const pad = $("sk-pad");
  if (pad.dataset.bound) return;
  pad.dataset.bound = "1";
  pad.addEventListener("pointerdown", e => {
    primeAudio();
    e.preventDefault();
    if (gest) return;
    gest = { x: e.clientX, y: e.clientY, at: Date.now(), was: !!sk.rec, intent: "" };
    window.addEventListener("pointermove", gestMove); window.addEventListener("pointerup", gestEnd); window.addEventListener("pointercancel", gestEnd);
    if (sk.rec) return;
    /* Start a beat later, so a swipe up (make the song) doesn't start a line. */
    const d = gest;
    d.timer = setTimeout(() => { if (gest === d && !d.intent) startLine(); }, 120);
  });
  pad.addEventListener("keydown", e => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault(); primeAudio();
    if (sk.rec) stopLine("keep"); else { startLine().then(() => { if (sk.rec) { sk.rec.latched = true; padLabel("Press again to keep the line"); } }); }
  });
}
function reset() { sk.lines.forEach(l => l.url && URL.revokeObjectURL(l.url)); sk.lines = []; sk.again = -1; sk.editing = -1; }

// Make the song: the chords as shown (with any nudges you took) over the words,
// opened in the editor (Sheet view) to name it and change any chord. The
// melody stays with the song, and the recordings on this phone.
async function finish() {
  stopLine("drop-quiet");
  if (!sk.lines.length) return;
  const d = $("sk-done"); if (d) d.disabled = true;
  await Promise.race([Promise.all(sk.lines.map(l => l.ready)), new Promise(r => setTimeout(r, 1500))]);
  if (sk.lines.some(l => l.hearing)) { toast("Still hearing your chords. One moment…"); await Promise.race([hearQueue, new Promise(r => setTimeout(r, 30000))]); }
  const kept = sk.lines.filter(l => l.notes.length);
  if (!kept.length) { if (d) d.disabled = false; return; }
  const key = plan();
  const body = kept.map(l => l.riff && !l.played?.length ? `Riff: ${l.riff.join(" ")}${l.words.trim() ? `\n${l.words.trim()}` : ""}` : chordLine(l.words.trim(), l.notes, l.changes || [])).join("\n");
  const name = key ? key.name : "";
  const sketch = { v: 1, key: name, style: "simple", lines: kept.map(l => ({ n: packNotes(l.notes) })) };
  const clips = kept.map(l => l.blob || null);
  reset(); closeMic();
  const song = await newSong({ title: "", body, key: key?.sure ? name : "", format: "chords", sketch }, "sheet");
  if (song && clips.some(Boolean)) saveClips(song.id, clips).catch(() => {});
  setTimeout(() => toast(`Chords from your melody${name ? `, in ${pretty(name)}` : ""}. Tap any chord to change it.`), 700);
}

// ---- Recordings kept on this phone (IndexedDB "tabs-sketch"), one per sung line ----
// Not in backups (they're large); a song deleted for good loses its recording.
const clipDB = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-sketch", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("clips");
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function clipTx(mode, fn) {
  const db = await clipDB();
  return new Promise((ok, bad) => { const tx = db.transaction("clips", mode); const out = fn(tx.objectStore("clips")); tx.oncomplete = () => ok(out?.result); tx.onerror = () => bad(tx.error); });
}
const saveClips = (id, clips) => clipTx("readwrite", st => st.put(clips, id));
const loadClips = id => clipTx("readonly", st => st.get(id)).catch(() => null);
/* Forget recordings of songs that are gone for good. */
clipTx("readonly", st => st.getAllKeys()).then(keys => {
  const keep = new Set([...data.songs.map(s => s.id), ...data.trash.filter(t => t.type === "song").map(t => t.item.id)]);
  const gone = (keys || []).filter(k => !keep.has(k));
  if (gone.length) clipTx("readwrite", st => gone.forEach(k => st.delete(k)));
}).catch(() => {});
export async function hasRecording(song) { const c = await loadClips(song.id); return !!c?.some(Boolean); }

// ---- Hearing it back, with the words following ----
// Plays the sung lines in turn. The line being sung is lit, scrolled to the
// reading line, and within it the chord being sung, timed by the same
// syllable estimate that placed it.
let playing = null;
onLeave(() => stopHearing());
export function stopHearing() {
  if (!playing) return;
  const p = playing; playing = null;
  p.audio?.pause(); cancelAnimationFrame(p.raf);
  p.urls.forEach(u => URL.revokeObjectURL(u));
  document.getElementById("sheet")?.classList.remove("skplay");
  document.querySelectorAll(".skcur, .skc").forEach(el => el.classList.remove("skcur", "skc"));
  p.onEnd?.();
}
function chordTimes(ln, notes) {
  const ws = [...String(ln.text || "").matchAll(/\S+/g)];
  if (!ws.length || !notes.length) return (ln.chords || []).map((_, i) => (i ? notes[Math.min(notes.length - 1, i)]?.start || 0 : 0));
  const syl = ws.map(m => syllables(m[0]) || 1), total = syl.reduce((a, b) => a + b, 0);
  return [...(ln.chords || [])].sort((a, b) => a.pos - b.pos).map((c, i) => {
    if (!i) return 0;
    let w = ws.findIndex(m => m.index + m[0].length > c.pos); if (w < 0) w = ws.length - 1;
    const before = syl.slice(0, w).reduce((a, b) => a + b, 0);
    return notes[Math.min(notes.length - 1, Math.floor(before * notes.length / total))].start;
  });
}
export async function hearSketch(song, onEnd) {
  stopHearing();
  const clips = await loadClips(song.id);
  if (!clips?.some(Boolean)) { toast("This sketch's recording isn't on this phone."); onEnd?.(); return; }
  const lines = song.sketch.lines, sung = sungLines(song.body, lines.length);
  const p = playing = { urls: [], onEnd, audio: null, raf: 0 };
  const sheet = $("sheet");
  sheet?.classList.add("skplay");
  /* The recording leads now, not the paused focus line. */
  sheet?.classList.remove("focus"); sheet?.querySelectorAll(":scope > .cur").forEach(el => el.classList.remove("cur", "cur2"));
  const blocks = () => [...document.querySelectorAll("#sheet > .pr, #sheet > .ly, #sheet > .crow")];
  for (let k = 0; k < lines.length && playing === p; k++) {
    if (!clips[k]) continue;
    const notes = unpackNotes(lines[k].n), times = sung[k] ? chordTimes(sung[k], notes) : [];
    const url = URL.createObjectURL(clips[k]); p.urls.push(url);
    const audio = p.audio = new Audio(url);
    document.querySelectorAll(".skcur, .skc").forEach(el => el.classList.remove("skcur", "skc"));
    const block = blocks()[k];
    if (block) {
      block.classList.add("skcur");
      window.scrollTo({ top: Math.max(0, block.getBoundingClientRect().top + scrollY - innerHeight * 0.4), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    const segs = block ? [...block.querySelectorAll(".sg")] : [];
    const follow = () => {
      const t = audio.currentTime;
      let j = -1; times.forEach((x, i) => { if (t >= x) j = i; });
      segs.forEach((el, i) => el.classList.toggle("skc", i === j));
      p.raf = requestAnimationFrame(follow);
    };
    await new Promise(res => {
      audio.onended = audio.onerror = res;
      audio.play().then(() => { p.raf = requestAnimationFrame(follow); }).catch(res);
    });
    cancelAnimationFrame(p.raf);
  }
  if (playing === p) stopHearing();
}

export function renderSketch() {
  if (hears()) loadEar();
  paint();
  window.scrollTo(0, 0);
}

