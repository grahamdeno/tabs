// Sing it: sing a song idea and get chords that fit the melody, placed over the words. 4.74.0: tap the mic and
// sing the whole idea (tap again to stop), and it is split into lines at your breaths; hold the mic for one line.
// Redo and Done are buttons. The key is a pill and a card of its chords. Your song plays your voice back with
// the chords strummed under it, then saves to the Songbook. Everything happens on this phone. Loads on first use.
import { VERSION, detectPitch, melodyNotes, detectKey, harmonize, chordLine, chordWords, chordFit, keyConfidence, keyFamily, lineHint, packNotes, sungLines, unpackNotes, syllables, strumChords, riffNotes, cleanNotes, chordToneNotes, html, raw } from "./core.js";
import { $, app, icon, layer, toast, onLeave, ask, sound } from "./ui.js";
import { data, go, markUsed, showCallout, tick } from "./app.js";
import { Tabs, splitTake, takeLines, lineOptions } from "./core.js";
import { louie } from "./louie.js";
import { noteError } from "./store.js";

const MAX_LINE = 180; /* seconds: a take stops itself (4.74.0: a whole idea, not one line) */
// Strum it: how a line is heard. "sing": your voice, chords that fit the
// melody (as before). "strum": your guitar, the chords you played (Basic Pitch,
// strum.js, loaded on first use). "both": both, and where they disagree the
// line offers You played / Melody fits. The choice is remembered.
/* 4.74.0: Voice, Guitar and Both (the page itself is Sing it) */
const MODES = [["sing", "Voice"], ["strum", "Guitar"], ["both", "Both"]];
const mode = () => (MODES.some(m => m[0] === data.settings.sketchMode) ? data.settings.sketchMode : "sing");
const hears = () => mode() !== "sing";
let ear = null; /* strum.js, once loaded */
let earState = ""; /* "", "loading", "ready", "failed" */
function loadEar() {
  if (ear || earState === "loading") return;
  earState = "loading"; paint();
  import(`./strum.js?v=${VERSION}`).then(async m => { if (!(await m.ready())) throw new Error("model"); ear = m; earState = "ready"; paint(); })
    .catch(() => { earState = "failed"; paint(); });
}
// The line's recording, heard for chords (or a riff). One at a time.
let hearQueue = Promise.resolve();
export async function listenTo(blob) {
  const ctx = sound();
  const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  const n = buf.length, x = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels; }
  ear ||= await import(`./strum.js?v=${VERSION}`);
  const notes = await ear.hear(x, buf.sampleRate);
  return readPlaying(notes);
}
// Chords if you strummed (notes starting together);
// otherwise the single notes of a riff. Also a melody line for the key.
export function readPlaying(notes) {
  const ns = cleanNotes(notes);
  /* A strum starts several strings together; a riff starts one note at a time.
     So: chords when a good share of notes (30%; stray notes in the quiet
     before and after a line lower it) begin within 60 ms of another note. */
  const together = ns.filter(n => ns.some(o => o !== n && Math.abs(o.start - n.start) < 0.06)).length;
  const strummed = ns.length >= 3 && together / ns.length >= 0.3;
  const chords = strummed ? strumChords(notes) : [];
  const riff = chords.length ? [] : riffNotes(notes);
  /* The top voice stands in for a melody: the key and the chord places use it. */
  const top = [];
  for (const n of [...ns].sort((a, b) => a.start - b.start)) { const p = top[top.length - 1]; if (p && n.start < p.start + p.dur - 0.05) { if (n.midi > p.midi) Object.assign(p, { midi: n.midi }); } else top.push({ midi: n.midi, start: n.start, dur: n.dur }); }
  return { chords, riff, melody: top };
}
// The sketch in progress stays while the app is open, so a look elsewhere
// doesn't lose it. Each line: { words, notes, dur, url, blob, custom (chords
// you chose over the suggestion) }. `again` is a line being sung again.
/* 4.74.0: a take is one recording, split into lines at your breaths: { notes, dur, cuts, blob, url }; each of its
   lines keeps { take, from, to }. view: "lines" or "song" (Your song); title and feel are for Your song. */
const sk = { lines: [], rec: null, again: -1, editing: -1, take: null, view: "lines", title: "", feel: "folk" };
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
const primeAudio = () => sound(); /* the app's one audio engine */
let stuckAudio = false;
async function openMic() {
  primeAudio();
  /* after a take where the audio clock stood still, wake the audio engine and take a fresh microphone */
  if (stuckAudio && mic) { stuckAudio = false; mic.stream.getTracks().forEach(t => t.stop()); try { mic.src.disconnect(); await mic.ctx.suspend?.(); } catch { /* best effort */ } mic = null; }
  if (mic && mic.stream.getAudioTracks().some(t => t.readyState === "live")) { await mic.ctx.resume?.(); return mic; }
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no mic"), { name: "NotSupportedError" });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = sound();
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
  /* 4.42.7 (#76): a take is timed by the real clock. On an iPhone the audio clock can stand still while the
     microphone sends only silence, which made a 5 second hold read as 0 seconds and "too short". */
  rec.t0 = performance.now(); rec.a0 = m.ctx.currentTime;
  try {
    /* The recording takes its own copy of the microphone, so it can't starve the listening. */
    rec.recorder = new MediaRecorder(new MediaStream(m.stream.getAudioTracks().map(t => t.clone())));
    rec.recorder.ondataavailable = e => e.data.size && rec.chunks.push(e.data);
    rec.recorder.start();
  } catch { rec.recorder = null; /* hearing it back is a nicety */ }
  rec.timer = setInterval(() => {
    m.an.getFloatTimeDomainData(m.buf);
    const t = (performance.now() - rec.t0) / 1000;
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
    const tm = $("sk-time"); if (tm) tm.textContent = mmss((performance.now() - rec.t0) / 1000);
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
  const dur = rec.frames.at(-1)?.t || 0, again = rec.i < sk.lines.length;
  /* 4.74.0: a take with your voice is split into lines at your breaths; singing a line again, or a guitar take, stays one line */
  let made = [], take = null;
  if (keep) {
    const split = !again && mode() === "sing" && notes.length > 1;
    const cuts = split ? splitTake(notes, dur) : [];
    take = { notes, dur, cuts };
    made = takeLines(notes, dur, cuts).map(p => ({ words: "", notes: p.notes, dur: p.to - p.from, from: p.from, to: p.to, take, via: mode() }));
    if (again) { made[0].words = sk.lines[rec.i].words; sk.lines[rec.i] = made[0]; }
    else sk.lines.push(...made);
    if (cuts.length) sk.take = take;
    if (hears()) made.forEach(l => { l.hearing = true; });
  }
  const ln = made[0];
  if (rec.recorder && rec.recorder.state !== "inactive") {
    let done; const ready = new Promise(r => { done = r; });
    made.forEach(l => { l.ready = ready; });
    rec.recorder.onstop = () => {
      done();
      if (!keep || !rec.chunks.length) return;
      take.blob = new Blob(rec.chunks, { type: rec.recorder.mimeType });
      take.url = URL.createObjectURL(take.blob);
      /* one line, one recording: the guitar is heard from it */
      if (made.length === 1) { ln.blob = take.blob; ln.url = take.url; }
      paint();
      if (ln?.hearing && made.length === 1) hearLine(ln);
      else made.forEach(l => { l.hearing = false; });
    };
    rec.recorder.stop();
  }
  if (how === "drop-quiet") return;
  if (keep && ln.hearing && !rec.recorder) { made.forEach(l => { l.hearing = false; }); toast("This phone can't record the take, so The Road can't hear the guitar. Your voice still works."); }
  if (how === "keep" && !keep) {
    paint();
    const pitched = rec.frames.filter(f => f.hz > 0).length, secs = rec.frames.at(-1)?.t || 0;
    const audioSecs = mic ? mic.ctx.currentTime - (rec.a0 || 0) : 0, stuck = secs > 1 && audioSecs < 0.05;
    if (stuck) stuckAudio = true;
    noteError(new Error(`Sketch heard no notes: ${rec.frames.length} frames over ${secs.toFixed(1)}s (audio clock ${audioSecs.toFixed(1)}s${stuck ? ", stuck" : ""}), ${pitched} with pitch, peak level ${(rec.peak || 0).toFixed(4)}, audio ${mic?.ctx.state || "none"} at ${mic?.ctx.sampleRate || 0} Hz, track ${mic?.stream.getAudioTracks()[0]?.readyState || "none"}${mic?.stream.getAudioTracks()[0]?.muted ? " (muted)" : ""}`), { quiet: true, where: "sketch" });
    return toast(!(rec.peak > 0.0005) && secs >= 0.6 ? "The microphone sent only silence. Try again; if it keeps happening, Settings > Help > Copy diagnostics, and send them to me."
      : secs < 0.6 ? "That was too short to hear. Tap the mic, sing, then tap it again."
      : !(rec.peak > 0.0005) ? "The microphone sent only silence. Settings > Help > Copy diagnostics, and send them to me."
      : "No steady notes were heard. Sing the line (not speak it), a little closer to the phone.");
  }
  if (!keep) { paint(); return toast(rec.i < sk.lines.length ? `Line ${rec.i + 1} kept as it was` : "That take is gone. Tap the mic to sing it again."); }
  tick(); markUsed("sketch"); if (hears()) markUsed("strum");
  /* Words next: the first new line opens for typing in the same tap, so the keyboard
     (and its microphone, for dictation) is ready. Return moves on to the next line with no words. */
  sk.editing = ln.words ? -1 : sk.lines.indexOf(ln);
  paint();
  if (made.length > 1) toast(`Split at your breaths: ${made.length} lines. Drag a marker to move a split.`);
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

// ---- The key (4.74.0: a pill at the top and a card of its chords; the wheel is gone) ----
const PC = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const pretty = n => n.replace("#", "♯").replace(/([A-G])b/, "$1♭");
const keyName = k => `${pretty(k.name.replace(/m$/, ""))} ${k.minor ? "minor" : "major"}`;
const keyPill = conf => !conf.key ? "KEY · LISTENING" : conf.bars >= 4 ? keyName(conf.key).toUpperCase() : `KEY · ${pretty(conf.key.name)}, MAYBE`;
function drawKey() {
  const conf = keyConfidence(allNotes()), el = $("sk-key");
  if (el) el.textContent = keyPill(conf);
  return conf;
}
// While singing: the chords that fit the last couple of seconds.
function drawLiveChords() {
  const el = $("sk-live"), rec = sk.rec;
  if (!el || !rec) return;
  const key = keyConfidence(allNotes()).key, recent = rec.live.filter(n => n.start >= (rec.frames.at(-1)?.t || 0) - 2.5);
  const fits = key && recent.length ? chordFit(recent, key).slice(0, 4) : [];
  el.innerHTML = fits.length ? html`<small>CHORDS THAT FIT SO FAR</small><div>${fits.slice(0, 3).map(f => html`<span class="skc">${pretty(f.chord)}</span>`)}</div>`.toString() : "";
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

// ---- Hear a chord (tap it in the key card; Your song strums them under your voice) ----
let synth = null;
/* at: when (audio clock, default now); up: an upstroke (high strings first); spread: seconds between strings
   (larger for a picked ballad); vol: how loud */
function strum(name, { at = null, up = false, spread = 0.028, vol = 0.12, ring = 1.8 } = {}) {
  const m = /^([A-G][#b]?)(m?)/.exec(name);
  if (!m) return;
  synth = sound();
  if (!synth) return;
  const root = 48 + PC[m[1]], third = m[2] ? 3 : 4, now = at ?? synth.currentTime;
  const steps = [0, 7, 12, 12 + third, 19];
  (up ? [...steps].reverse().slice(0, 3) : steps).forEach((s, i) => {
    const f = 440 * 2 ** ((root + s - 69) / 12), o = synth.createOscillator(), g = synth.createGain(), lp = synth.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 1800;
    const t = now + i * spread;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    o.connect(lp).connect(g).connect(synth.destination); o.start(t); o.stop(t + ring + 0.1);
  });
  if (at == null) tick();
}

// ---- The screen ----
// ---- The screen (4.74.0): Louie and a mic to start; one take split into lines; the lines as on the song page;
// a line's options in a sheet; and Your song, where your voice plays back with the chords strummed under it.
const MIC = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" class="skm-f"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`;
const DOTS = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>`;
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
const lineOfTake = (take) => sk.lines.filter(l => l.take === take);
function lineHTML(l, i, key) {
  const ws = l.words.trim().split(/\s+/).filter(Boolean), at = l.changes?.length ? chordWords(l.words, l.notes, l.changes) : [];
  const over = new Map(); at.forEach((w, j) => over.set(w, (over.get(w) ? over.get(w) + " " : "") + pretty(l.changes[j].chord)));
  const extra = at.map((w, j) => (w >= ws.length ? pretty(l.changes[j].chord) : "")).filter(Boolean).join(" ");
  /* One nudge at a time: on the last line, if it has one. */
  const hint = i === sk.lines.length - 1 && !l.custom && !l.via?.match(/strum|both/) && key && lineHint(l.words, l.notes, l.changes || [], key);
  const melody = l.via === "both" && l.played?.length ? (l.melodyChords || []).map(c => c.chord).join(" ") : "";
  const played = l.played?.map(c => c.chord).join(" ") || "";
  const cmp = melody && played && melody !== played;
  const editing = sk.editing === i, last = i === sk.lines.length - 1;
  return html`<div class="skl${last ? " last" : ""}${editing ? " edit" : ""}" data-row="${i}"><div class="skl-top"><b class="skl-n">${i + 1}</b>
    <div class="sknb-txt">${editing
      ? html`<input id="sk-words" data-i="${i}" class="sknb-in" value="${l.words}" placeholder="Say or type the words" autocapitalize="sentences" enterkeyhint="next" aria-label="Words for line ${i + 1}">`
      : html`<button class="sknb-line" data-edit="${i}" aria-label="Line ${i + 1}: ${l.words || "no words yet"}. Tap to change the words">${ws.length ? ws.map((w, k) => html`<span class="sknb-w">${over.has(k) && html`<b>${over.get(k)}</b>`}${w}</span> `) : html`<span class="sknb-none">${over.get(0) && html`<span class="sknb-w"><b>${over.get(0)}</b>&nbsp;</span>`}Tap to add the words</span>`}${extra && html`<span class="sknb-w"><b>${extra}</b>&nbsp;</span>`}</button>`}
    ${l.hearing && html`<span class="sknb-hear"><i class="spin"></i>Hearing your chords…</span>`}
    ${l.riff && !l.hearing && html`<span class="sknb-riff">Riff: ${l.riff.join(" ")}</span>`}
    ${cmp && !editing && html`<div class="skcmp" role="group" aria-label="Chords for line ${i + 1}"><button data-pick="${i}" data-src="played" class="${l.melodyPick ? "" : "on"}" aria-pressed="${!l.melodyPick}">You played<b>${played}</b></button><button data-pick="${i}" data-src="melody" class="${l.melodyPick ? "on" : ""}" aria-pressed="${!!l.melodyPick}">Melody fits<b>${melody}</b></button></div>`}</div>
    <button class="skl-opt" data-opts="${i}" aria-label="Options for line ${i + 1}">${raw(DOTS)}</button></div>
    ${hint && !editing && html`<button class="skl-hint" data-hint="${i}" data-j="${hint.j}" data-chord="${hint.chord}">${raw(icon("wand"))}<span>Try ${pretty(hint.chord)}${hint.words ? ` on “${hint.words}”` : " here"}${hint.minor ? ": you leaned minor" : hint.major ? ": it sounds brighter" : ""}</span></button>`}</div>`;
}
/* The take you just sang: its melody as bars, coloured by line, with a marker between lines to drag */
function takeHTML(take) {
  const ls = lineOfTake(take);
  if (ls.length < 2 || !take.dur) return "";
  const W = 318, H = 76, ms = take.notes.map(n => n.midi), lo = Math.min(...ms) - 1, hi = Math.max(...ms) + 1, rng = Math.max(6, hi - lo);
  const x = t => (t / take.dur) * W, y = m => H - 12 - ((m - lo) / rng) * (H - 24);
  const lineAt = t => take.cuts.filter(c => c <= t).length;
  const bars = take.notes.map(n => `<rect x="${x(n.start).toFixed(1)}" y="${(y(n.midi) - 4).toFixed(1)}" width="${Math.max(4, x(n.dur) - 2).toFixed(1)}" height="8" rx="4" class="${lineAt(n.start + n.dur / 2) % 2 ? "b" : "a"}"/>`).join("");
  return html`<section class="sk-take" aria-labelledby="sk-take-h"><div class="sk-take-top">
      <button class="sk-tplay" id="sk-tplay" aria-label="Hear your take" ${take.url ? "" : raw("disabled")}>${raw(icon("play"))}</button>
      <div><h2 id="sk-take-h">Your take · ${mmss(take.dur)}</h2><span>Split at your breaths: ${ls.length} lines</span></div></div>
    <div class="sk-strip" id="sk-strip"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Your melody, split into ${ls.length} lines">${raw(bars)}</svg>
      ${take.cuts.map((c, k) => html`<button class="sk-cut" data-cut="${k}" style="left:${(100 * c / take.dur).toFixed(2)}%" aria-label="Split between lines ${k + 1} and ${k + 2}, at ${c.toFixed(1)} seconds. Arrow keys move it, Delete joins the lines"><i></i></button>`)}</div>
    <small>Drag a marker to move a split, or tap the melody to split it there.</small></section>`;
}
function introHTML() {
  const say = mode() === "strum" ? "Strum a line or two. I'll name the chords you play." : mode() === "both" ? "Sing and strum together. Your chords lead, and the melody's are one tap away." : "Sing or hum your idea. I'll find chords that fit your melody.";
  const steps = mode() === "sing" ? ["Tap the mic and sing the whole idea", "Tap again. I split it into lines at your breaths", "Add the words, then hear it as a song"] : ["Tap the mic and play one line", "Tap again to keep it, then add its words", "Two lines or more, then hear it as a song"];
  return html`<div class="sk-intro"><div class="sk2-lou">${raw(louie("happy", { pose: "wave", size: 120 }))}<p class="sk2-say">${say}</p></div>
    <ol class="sk-steps">${steps.map((t, i) => html`<li><b>${i + 1}</b>${t}</li>`)}</ol></div>`;
}
function keyCardHTML(conf) {
  const fam = keyFamily(conf.key);
  if (!conf.key) return html`<section class="sk-keyc" aria-label="Your key"><b>Finding your key</b><small>Sing a few more notes and it shows up here.</small></section>`;
  return html`<section class="sk-keyc" aria-label="Your key"><div><b>${keyName(conf.key)}</b><span>${conf.bars >= 4 ? "SURE" : "MAYBE"}</span></div>
    <div class="sk-keych">${fam.map(c => html`<button class="skfam-c" data-chord="${c}" aria-label="Hear ${c}">${pretty(c)}</button>`)}</div>
    <small>${mode() === "strum" ? "The chords in your key." : "Your melody can use these."} Tap one to hear it.</small></section>`;
}
let repainting = false; /* the old words box blurs as it's replaced: not a "done typing" */
function paint() {
  /* Keep the pad the finger is on: iPhone stops sending a touch whose element is replaced. */
  const held = gest ? $("sk-pad") : null;
  const w = document.activeElement?.id === "sk-words" ? document.activeElement : null;
  const typing = w && { i: w.dataset.i, value: w.value, a: w.selectionStart, b: w.selectionEnd };
  repainting = true;
  try { (sk.view === "song" ? paintSong : paintAll)(); } finally { repainting = false; }
  if (typing) { const n = $("sk-words"); if (n && n.dataset.i === typing.i) { /* the same line's box: keep what was typed */ n.value = typing.value; n.focus({ preventScroll: true }); try { n.setSelectionRange(typing.a, typing.b); } catch { /* not a text box */ } } }
  if (held) {
    const fresh = $("sk-pad");
    if (fresh) { held.className = fresh.className; held.innerHTML = fresh.innerHTML; held.setAttribute("aria-label", fresh.getAttribute("aria-label")); fresh.replaceWith(held); }
  }
}
function paintAll() {
  const rec = sk.rec, n = sk.lines.length, key = plan();
  const conf = keyConfidence(allNotes()), next = sk.again >= 0 ? sk.again : n;
  const verb = mode() === "strum" ? "play" : mode() === "both" ? "sing and play" : "sing";
  const take = sk.take && lineOfTake(sk.take).length > 1 ? sk.take : null;
  app.innerHTML = html`<div class="sk2">
    <div class="sk-head"><button class="sk-x" id="sk-cancel" aria-label="${n ? "Discard this sketch" : "Close Sing it"}">${raw(icon("x"))}</button>
      <h1 class="title">Sing it</h1><span class="sk-key" id="sk-key">${keyPill(conf)}</span></div>
    ${!rec && html`<div class="seg sk-mode" role="group" aria-label="What The Road listens for">${MODES.map(([k, nm]) => html`<button data-mode="${k}" class="${mode() === k ? "on" : ""}" aria-pressed="${mode() === k}">${nm}</button>`)}</div>`}
    ${hears() && earState !== "ready" ? html`<div class="skear">${earState === "failed" ? html`Couldn't load the chord listener. Check the connection, then switch again.` : html`<i class="spin"></i>Getting the chord listener ready (about 2 MB, once)`}</div>` : ""}
    ${rec
      ? html`<div class="sk-rec"><div class="sk-reclab"><i aria-hidden="true"></i><b>${rec.i < n ? `LINE ${rec.i + 1} AGAIN` : hears() ? "LISTENING TO YOUR GUITAR" : "LISTENING"}</b><span id="sk-time">0:00</span></div>
          <div class="sk-recard"><svg id="sk-rib" viewBox="0 0 346 86" preserveAspectRatio="none" role="img" aria-label="Your melody"></svg><p>${sk.lines[rec.i]?.words || "Add the words after you stop."}</p></div>
          <div class="sk-fits" id="sk-live" aria-live="polite"></div></div>`
      : !n ? introHTML()
      : html`${keyCardHTML(conf)}${take && takeHTML(take)}<div class="sk-lines">${sk.lines.map((l, i) => lineHTML(l, i, key))}</div>`}
    <div class="sk-space"></div>
    ${rec
      ? html`<div class="sk-recbar"><div class="sk-side"><button class="sk-round" id="sk-redo" aria-label="Redo this take">${raw(icon("loop"))}</button><span>Redo</span></div>
          <div class="sk-mid"><div class="skpad on${rec.latched ? " latched" : ""}" id="sk-pad" role="button" tabindex="0" aria-label="${rec.latched ? "Stop and keep the take" : "Let go to keep the take"}"><i class="skpad-ring"></i><i class="skpad-ring r2"></i><i class="skpad-stop"></i></div>
            <b id="sk-pad-t">${rec.latched ? "TAP TO STOP" : "LET GO TO KEEP"}</b></div>
          <div class="sk-side"><button class="sk-round" id="sk-fin" aria-label="Stop and hear it as a song" ${n || rec.i >= 0 ? "" : raw("disabled")}>${raw(icon("check"))}</button><span>Done</span></div></div>`
      : !n
        ? html`<div class="sk-start"><div class="skpad big" id="sk-pad" role="button" tabindex="0" aria-label="Tap to ${verb}, or hold for one line">${raw(MIC)}</div>
            <b id="sk-pad-t">TAP TO ${verb.toUpperCase()}</b><span id="sk-pad-s">Tap again to stop · or hold for one line</span></div>`
        : html`<div class="sk-dock"><div class="skpad" id="sk-pad" role="button" tabindex="0" aria-label="${sk.again >= 0 ? `Sing line ${next + 1} again` : `Tap to ${verb} line ${next + 1}, or hold`}">${raw(MIC)}</div>
            <div class="sk-dockt"><b id="sk-pad-t">${sk.again >= 0 ? `Line ${next + 1} again` : `Line ${next + 1}`}</b><span id="sk-pad-s">Tap to ${verb}, or hold</span></div>
            <button class="btn primary sk-done" id="sk-done">HEAR THE SONG</button></div>`}
  </div>`.toString();
  drawRibbon(); drawLiveChords();
  bind();
}
function bind() {
  $("sk-cancel").onclick = () => {
    if (!sk.lines.length) { stopLine("drop-quiet"); return go("#/"); }
    ask({ title: "Discard this sketch?", text: "The lines you sang and their words go.", ok: "Discard", keep: "Keep singing", danger: true }, () => { stopLine("drop-quiet"); reset(); go("#/"); });
  };
  $("sk-done")?.addEventListener("click", showSong);
  $("sk-redo")?.addEventListener("click", () => stopLine("drop"));
  $("sk-fin")?.addEventListener("click", () => { stopLine("keep"); if (sk.lines.length) showSong(); });
  const w = $("sk-words");
  if (w) {
    const i = sk.editing;
    w.oninput = () => { sk.lines[i].words = w.value; };
    /* Return: on to the next line with no words, else done */
    w.onkeydown = e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const nx = sk.lines.findIndex((l, k) => k > i && !l.words.trim());
      if (nx >= 0) { sk.editing = nx; paint(); $("sk-words")?.focus(); } else w.blur();
    };
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
  app.querySelectorAll("[data-opts]").forEach(b => b.onclick = () => lineSheet(+b.dataset.opts));
  app.querySelectorAll(".skfam-c").forEach(b => b.onclick = () => strum(b.dataset.chord));
  $("sk-tplay")?.addEventListener("click", () => { if (sk.take?.url) clipPlay(sk.take.url, 0, sk.take.dur); });
  bindTake();
  bindPad();
}
/* Hear a stretch of a recording */
let clipAudio = null;
function clipPlay(url, from = 0, to = 0) {
  clipAudio?.pause();
  const a = clipAudio = new Audio(url);
  a.addEventListener("loadedmetadata", () => { if (from) a.currentTime = from; }, { once: true });
  if (to) a.ontimeupdate = () => { if (a.currentTime >= to) a.pause(); };
  a.play().catch(() => {});
  return a;
}
const lineUrl = l => l.take?.url || l.url;
/* A take's lines at new cuts: the words follow the line they were sung in (joined lines join their words) */
function recut(take, cuts) {
  const old = lineOfTake(take), at = sk.lines.indexOf(old[0]);
  if (at < 0) return;
  cuts = [...new Set(cuts.map(c => Math.round(c * 100) / 100))].filter(c => c > 0.3 && c < take.dur - 0.3).sort((a, b) => a - b);
  const parts = takeLines(take.notes, take.dur, cuts), words = parts.map(() => []);
  old.forEach(l => { const mid = ((l.from || 0) + (l.to || 0)) / 2, k = parts.findIndex(p => mid >= p.from && mid < p.to); if (l.words.trim()) words[k < 0 ? parts.length - 1 : k].push(l.words.trim()); });
  const fresh = parts.map((p, k) => ({ words: words[k].join(" "), notes: p.notes, dur: p.to - p.from, from: p.from, to: p.to, take, via: old[0].via }));
  sk.lines.splice(at, old.length, ...fresh);
  take.cuts = cuts; sk.editing = -1;
  paint(); tick();
}
function bindTake() {
  const strip = $("sk-strip"), take = sk.take;
  if (!strip || !take) return;
  const tAt = x => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(take.dur, ((x - r.left) / r.width) * take.dur)); };
  strip.querySelectorAll(".sk-cut").forEach(b => {
    const k = +b.dataset.cut;
    b.addEventListener("pointerdown", e => {
      e.preventDefault(); e.stopPropagation();
      b.setPointerCapture?.(e.pointerId);
      const lo = (take.cuts[k - 1] ?? 0) + 0.4, hi = (take.cuts[k + 1] ?? take.dur) - 0.4;
      let t = take.cuts[k];
      const move = ev => { t = Math.max(lo, Math.min(hi, tAt(ev.clientX))); b.style.left = `${(100 * t / take.dur).toFixed(2)}%`; };
      const up = () => { b.removeEventListener("pointermove", move); b.removeEventListener("pointerup", up); b.removeEventListener("pointercancel", up); recut(take, take.cuts.map((c, j) => (j === k ? t : c))); };
      b.addEventListener("pointermove", move); b.addEventListener("pointerup", up); b.addEventListener("pointercancel", up);
    });
    b.onkeydown = e => {
      const d = e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
      if (d) { e.preventDefault(); recut(take, take.cuts.map((c, j) => (j === k ? c + d : c))); $("sk-strip")?.querySelector(`[data-cut="${k}"]`)?.focus(); }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); recut(take, take.cuts.filter((_, j) => j !== k)); }
    };
  });
  /* a tap on the melody splits it there (not too close to a split) */
  strip.addEventListener("click", e => {
    if (e.target.closest(".sk-cut")) return;
    const t = tAt(e.clientX);
    if ([0, ...take.cuts, take.dur].some(c => Math.abs(c - t) < 0.6)) return;
    recut(take, [...take.cuts, t]);
    toast("Split there", null, { label: "Undo", fn: () => recut(take, take.cuts.filter(c => Math.abs(c - Math.round(t * 100) / 100) > 0.01)) });
  });
}
/* A line's options: other ways to play it, hear it, sing it again, its words, join it with the next, remove it */
function lineSheet(i) {
  const l = sk.lines[i];
  if (!l) return;
  const key = plan(), opts = key && l.notes.length ? lineOptions(l.notes, key) : [], now = (l.changes || []).map(c => c.chord).join(" · ");
  const nx = sk.lines[i + 1], joins = l.take && nx?.take === l.take;
  layer.innerHTML = html`<div class="scrim" id="ls-scrim"></div>
    <div class="panel card sk-sheet" role="dialog" aria-labelledby="ls-h"><div class="grab" aria-hidden="true"></div>
      <div><small class="sk-k">LINE ${i + 1}</small><h2 id="ls-h">${l.words.trim() || "No words yet"}</h2></div>
      ${opts.length > 1 && html`<div><small class="sk-k">OTHER WAYS TO PLAY IT</small><div class="sk-opts">${opts.map((o, j) => html`<button data-opt="${j}" class="${o.label === now ? "on" : ""}" aria-pressed="${o.label === now}">${o.changes.map(c => pretty(c.chord)).join(" · ")}<small>${o.label === now ? "NOW" : j === 0 ? "best fit" : ""}</small></button>`)}</div></div>`}
      <div class="sk-acts">
        <button id="ls-play" ${lineUrl(l) ? "" : raw("disabled")}>${raw(icon("play"))}Hear it</button>
        <button id="ls-again">${raw(MIC)}Sing again</button>
        <button id="ls-words">${raw(icon("edit"))}Words</button>
      </div>
      ${joins && html`<button class="btn sk-join" id="ls-join">Join with line ${i + 2}</button>`}
      <button class="sk-rm" id="ls-rm">Remove line ${i + 1}</button>
    </div>`.toString();
  const close = () => { layer.innerHTML = ""; };
  $("ls-scrim").onclick = close;
  layer.querySelectorAll("[data-opt]").forEach(b => b.onclick = () => { const o = opts[+b.dataset.opt]; l.custom = o.changes; close(); paint(); strum(o.changes[0].chord); });
  $("ls-play").onclick = () => { const u = lineUrl(l); if (u) clipPlay(u, l.take ? l.from : 0, l.take ? l.to : 0); };
  $("ls-again").onclick = () => { close(); sk.again = i; sk.editing = -1; paint(); toast(`Tap the mic to sing line ${i + 1} again`); };
  $("ls-words").onclick = () => { close(); sk.editing = i; paint(); $("sk-words")?.focus(); };
  $("ls-join")?.addEventListener("click", () => { close(); recut(l.take, l.take.cuts.filter(c => Math.abs(c - nx.from) > 0.01)); });
  $("ls-rm").onclick = () => {
    close();
    const gone = sk.lines.splice(i, 1)[0];
    paint();
    toast(`Line ${i + 1} removed`, null, { label: "Undo", fn: () => { sk.lines.splice(i, 0, gone); paint(); } });
  };
}

// The pad: a tap sings hands-free until the next tap; a hold sings while held (one line). Space or Return work too.
let gest = null;
const padLabel = t => { const a = $("sk-pad-t"); if (a) a.textContent = t; };
function gestEnd(e) {
  const d = gest;
  if (!d) return;
  gest = null;
  window.removeEventListener("pointerup", gestEnd); window.removeEventListener("pointercancel", gestEnd);
  /* A cancelled touch (iPhone's microphone question, a call): keep singing hands-free. */
  if (e.type === "pointercancel") { if (sk.rec) { sk.rec.latched = true; padLabel("TAP TO STOP"); } return; }
  if (!sk.rec) return;
  if (d.was) return stopLine("keep");                                  /* a tap while hands-free: keep */
  if (Date.now() - d.at < 320) { sk.rec.latched = true; $("sk-pad")?.classList.add("latched"); $("sk-pad")?.setAttribute("aria-label", "Stop and keep the take"); padLabel("TAP TO STOP"); return; }
  stopLine("keep");
}
function bindPad() {
  const pad = $("sk-pad");
  if (!pad || pad.dataset.bound) return;
  pad.dataset.bound = "1";
  pad.addEventListener("pointerdown", e => {
    primeAudio();
    e.preventDefault();
    if (gest) return;
    gest = { at: Date.now(), was: !!sk.rec };
    window.addEventListener("pointerup", gestEnd); window.addEventListener("pointercancel", gestEnd);
    if (!sk.rec) startLine(); /* at once: with no swipes any more there's nothing to wait for, and a quick tap counts */
  });
  pad.addEventListener("keydown", e => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault(); primeAudio();
    if (sk.rec) stopLine("keep"); else { startLine().then(() => { if (sk.rec) { sk.rec.latched = true; padLabel("PRESS AGAIN TO STOP"); } }); }
  });
}
function reset() {
  const urls = new Set([...sk.lines.map(lineUrl)].filter(Boolean));
  urls.forEach(u => URL.revokeObjectURL(u));
  sk.lines = []; sk.again = -1; sk.editing = -1; sk.take = null; sk.view = "lines"; sk.title = "";
}

// ---- Your song: your voice back with the chords strummed under it, a strum feel, a name, and Save ----
const FEELS = [["simple", "Simple"], ["folk", "Folk"], ["ballad", "Ballad"]];
let songPlay = null;
function stopSongPlay() {
  const p = songPlay;
  if (!p) return;
  songPlay = null;
  p.audio?.pause(); clearTimeout(p.timer); cancelAnimationFrame(p.raf);
  document.querySelectorAll(".sks-l.on").forEach(el => el.classList.remove("on"));
  const b = $("sk-play"); if (b) { b.innerHTML = icon("play"); b.setAttribute("aria-label", "Play your song"); }
}
onLeave(() => stopSongPlay());
async function showSong() {
  stopLine("drop-quiet");
  if (!sk.lines.length) return;
  await Promise.race([Promise.all(sk.lines.map(l => l.ready)), new Promise(r => setTimeout(r, 1500))]);
  if (sk.lines.some(l => l.hearing)) { toast("Still hearing your chords. One moment…"); await Promise.race([hearQueue, new Promise(r => setTimeout(r, 30000))]); }
  if (!sk.lines.some(l => l.notes.length)) return;
  sk.view = "song"; sk.editing = -1;
  paint(); window.scrollTo(0, 0);
}
function paintSong() {
  const key = plan(), kept = sk.lines.filter(l => l.notes.length), first = !data.songs.some(x => x.sketch);
  app.innerHTML = html`<div class="sk2 sks">
    <div class="sk-head"><button class="sk-x" id="sk-back" aria-label="Back to your lines">${raw(icon("back"))}</button><small class="sk-k">YOUR SONG</small></div>
    <label class="sks-name"><span class="sr-only">Song title</span><input id="sk-title" value="${sk.title}" placeholder="Name your song" autocapitalize="words" enterkeyhint="done"></label>
    <section class="sks-player" aria-label="Your song">
      <div class="sks-top"><button class="sks-play" id="sk-play" aria-label="Play your song">${raw(icon("play"))}</button>
        <div class="sks-t"><b>Your voice and the chords</b><div class="sks-bar" aria-hidden="true"><i id="sk-prog"></i></div></div></div>
      <div class="sks-lines">${kept.map((l, i) => html`<div class="sks-l" data-i="${i}"><div class="sks-c">${(l.changes || []).map(c => pretty(c.chord)).join("   ")}</div><div class="sks-w">${l.words.trim() || html`<i>Line ${i + 1}, no words yet</i>`}</div></div>`)}</div>
    </section>
    <div><small class="sk-k">HOW THE CHORDS PLAY</small>
      <div class="seg sk-feel" role="group" aria-label="How the chords play">${FEELS.map(([k, n]) => html`<button data-feel="${k}" class="${sk.feel === k ? "on" : ""}" aria-pressed="${sk.feel === k}">${n}</button>`)}</div></div>
    ${first && html`<div class="sks-win"><span class="sks-badge" aria-hidden="true">${raw(icon("note"))}</span><div><b>Songwriter!</b><span>Your first song: +${WRITER_FANS} fans when you save it</span></div></div>`}
    <div class="sk-space"></div>
    <div class="sk-dock sks-dock"><button class="btn sks-edit" id="sk-edit">Edit lines</button><button class="btn primary sk-done" id="sk-save">SAVE TO SONGBOOK</button></div>
  </div>`.toString();
  $("sk-back").onclick = $("sk-edit").onclick = () => { stopSongPlay(); sk.view = "lines"; paint(); };
  const t = $("sk-title"); t.oninput = () => { sk.title = t.value; }; t.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); t.blur(); } };
  app.querySelectorAll("[data-feel]").forEach(b => b.onclick = () => { sk.feel = b.dataset.feel; const was = !!songPlay; stopSongPlay(); paint(); if (was) playSong(); });
  $("sk-play").onclick = () => (songPlay ? stopSongPlay() : playSong());
  $("sk-save").onclick = save;
  void key;
}
/* The strums for one line: at each chord change, then by feel (folk keeps strumming down and up; ballad picks) */
function strumLine(l, t0) {
  const ch = l.changes || [], dur = l.dur || 0, beat = 0.5;
  ch.forEach((c, j) => {
    const a = Math.max(0, c.at || 0), b = j + 1 < ch.length ? ch[j + 1].at : dur;
    if (sk.feel === "ballad") { strum(c.chord, { at: t0 + a, spread: 0.11, vol: 0.09, ring: 2.6 }); return; }
    strum(c.chord, { at: t0 + a, vol: 0.1 });
    if (sk.feel !== "folk") return;
    for (let k = 1, x = a + beat; x < b - 0.15; k++, x += beat) strum(c.chord, { at: t0 + x, up: k % 2 === 1, vol: k % 2 ? 0.05 : 0.08, ring: 0.6 });
  });
}
async function playSong() {
  stopSongPlay();
  const kept = sk.lines.filter(l => l.notes.length), total = kept.reduce((n, l) => n + (l.dur || 0), 0) || 1;
  const p = songPlay = { audio: null, timer: 0, raf: 0 };
  const b = $("sk-play"); if (b) { b.innerHTML = icon("pause"); b.setAttribute("aria-label", "Pause"); }
  const ctx = sound();
  let done = 0;
  for (let i = 0; i < kept.length && songPlay === p; i++) {
    const l = kept[i], url = lineUrl(l);
    document.querySelectorAll(".sks-l").forEach(el => el.classList.toggle("on", +el.dataset.i === i));
    const t0 = (ctx?.currentTime || 0) + 0.06, start = performance.now();
    if (ctx) strumLine(l, t0);
    const prog = () => { const el = $("sk-prog"); if (el) el.style.width = `${Math.min(100, 100 * (done + (performance.now() - start) / 1000) / total)}%`; p.raf = requestAnimationFrame(prog); };
    p.raf = requestAnimationFrame(prog);
    await new Promise(res => {
      if (url) { const a = p.audio = clipPlay(url, l.take ? l.from : 0, l.take ? l.to : 0); a.onended = res; a.onpause = res; a.onerror = res; }
      p.timer = setTimeout(res, (l.dur || 1) * 1000 + 300);
    });
    clearTimeout(p.timer); cancelAnimationFrame(p.raf);
    done += l.dur || 0;
  }
  if (songPlay === p) stopSongPlay();
}
// Save: the chords as shown (with any you picked) over the words, as a song in the Songbook, with the melody and the
// recordings on this phone. The first song you write is worth fans (and the Songwriter badge).
const WRITER_FANS = 50;
async function save() {
  stopSongPlay();
  const kept = sk.lines.filter(l => l.notes.length);
  if (!kept.length) return;
  const key = plan(), first = !data.songs.some(x => x.sketch);
  const body = kept.map(l => l.riff && !l.played?.length ? `Riff: ${l.riff.join(" ")}${l.words.trim() ? `\n${l.words.trim()}` : ""}` : chordLine(l.words.trim(), l.notes, l.changes || [])).join("\n");
  const name = key ? key.name : "";
  const sketch = { v: 1, key: name, style: "simple", feel: sk.feel, lines: kept.map(l => ({ n: packNotes(l.notes) })) };
  const clips = kept.map(l => (l.take?.blob ? { blob: l.take.blob, from: l.from || 0, to: l.to || l.dur } : l.blob || null)); /* 4.74.0: a line is a stretch of its take */
  const title = sk.title.trim() || `New song ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  const song = Tabs.addSong(data, { title, body, key: key?.sure ? name : "", format: "chords", sketch });
  if (clips.some(Boolean)) saveClips(song.id, clips).catch(() => {});
  if (first) { const q = data.quests || (data.quests = { fans: 0 }); q.fans = (q.fans || 0) + WRITER_FANS; Tabs.save(data); }
  reset(); closeMic();
  go("#/song/" + encodeURIComponent(song.id));
  if (first) setTimeout(() => showCallout({ kind: "earn", pow: "WROTE IT!", word: "SONGWRITER", big: `+${WRITER_FANS} fans` }), 700);
  setTimeout(() => toast(`Saved${name ? `, in ${pretty(name)}` : ""}. Tap any chord to change it.`), first ? 2600 : 700);
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
    const clip = clips[k], blob = clip instanceof Blob ? clip : clip.blob, from = clip.from || 0, to = clip.to || 0; /* 4.74.0: a stretch of a take */
    const url = URL.createObjectURL(blob); p.urls.push(url);
    const audio = p.audio = new Audio(url);
    if (from) audio.addEventListener("loadedmetadata", () => { audio.currentTime = from; }, { once: true });
    if (to) audio.addEventListener("timeupdate", () => { if (audio.currentTime >= to) { audio.pause(); audio.onended?.(); } });
    document.querySelectorAll(".skcur, .skc").forEach(el => el.classList.remove("skcur", "skc"));
    const block = blocks()[k];
    if (block) {
      block.classList.add("skcur");
      window.scrollTo({ top: Math.max(0, block.getBoundingClientRect().top + scrollY - innerHeight * 0.4), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    const segs = block ? [...block.querySelectorAll(".sg")] : [];
    const follow = () => {
      const t = audio.currentTime - from;
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

