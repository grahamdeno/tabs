// Tabs sketch: sing a song idea line by line, say or type each line's words,
// and get chords that fit the melody, placed over the words. Everything happens
// on this phone: the voice is never saved or sent. Loads on first use.
import { detectPitch, melodyNotes, detectKey, sketchSong, sungLines, unpackNotes, syllables, html, raw } from "./core.js";
import { $, app, icon, toast, onLeave, ask } from "./ui.js";
import { data, go, markUsed, newSong, tick } from "./app.js";

const MAX_LINE = 30; /* seconds: a line stops itself */
// The sketch in progress stays while the app is open, so a look elsewhere
// doesn't lose it. Each line: { words, frames, notes, dur, url (to hear it) }.
const sk = { lines: [], at: -1, rec: null };
let mic = null; /* { stream, ctx, an, buf } once allowed */

onLeave(r => { if (r.name !== "sketch") { stopLine(true); closeMic(); } });

function closeMic() {
  if (!mic) return;
  mic.stream.getTracks().forEach(t => t.stop());
  mic.ctx.close?.().catch?.(() => {});
  mic = null;
}
async function openMic() {
  if (mic) { await mic.ctx.resume?.(); return mic; }
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no mic"), { name: "NotSupportedError" });
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume?.();
  const an = ctx.createAnalyser();
  an.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(an);
  mic = { stream, ctx, an, buf: new Float32Array(an.fftSize) };
  return mic;
}
const micTrouble = e => toast(e?.name === "NotAllowedError" || e?.name === "SecurityError"
  ? "The microphone is off for Tabs. Open your iPhone's Settings, then Apps > Safari > Microphone, and choose Ask."
  : "The microphone isn't available here.", null, { label: "OK", fn: () => {} });

// ---- Recording one line ----
async function startLine(i) {
  if (sk.rec) return;
  /* Make the line now, inside the tap, so the screen answers at once. */
  if (i >= sk.lines.length) sk.lines.push({ words: "", frames: [], notes: [], dur: 0 });
  sk.at = i;
  sk.rec = { i, frames: [], t0: 0, timer: 0, clock: 0, chunks: [], recorder: null, starting: true };
  paint();
  let m;
  try { m = await openMic(); }
  catch (e) { sk.rec = null; if (!sk.lines[i].frames.length) sk.lines.splice(i, 1); sk.at = -1; paint(); return micTrouble(e); }
  const rec = sk.rec;
  if (!rec) return;
  rec.starting = false;
  rec.t0 = m.ctx.currentTime;
  try {
    rec.recorder = new MediaRecorder(m.stream);
    rec.recorder.ondataavailable = e => e.data.size && rec.chunks.push(e.data);
    rec.recorder.start();
  } catch { rec.recorder = null; /* hearing it back is a nicety */ }
  rec.timer = setInterval(() => {
    m.an.getFloatTimeDomainData(m.buf);
    const t = m.ctx.currentTime - rec.t0;
    rec.frames.push({ t, hz: detectPitch(m.buf, m.ctx.sampleRate) });
    if (t > MAX_LINE) stopLine();
  }, 25);
  rec.clock = setInterval(() => { const t = $("sk-t"); if (t) t.textContent = mmss(m.ctx.currentTime - rec.t0); drawTrace(); }, 100);
  tick(); paint();
}
function stopLine(quiet) {
  const rec = sk.rec;
  if (!rec) return;
  clearInterval(rec.timer); clearInterval(rec.clock);
  sk.rec = null;
  const ln = sk.lines[rec.i];
  if (!ln) return;
  const notes = melodyNotes(rec.frames);
  if (rec.recorder && rec.recorder.state !== "inactive") {
    let done; ln.ready = new Promise(r => { done = r; });
    rec.recorder.onstop = () => {
      done();
      if (!rec.chunks.length || !notes.length) return;
      if (ln.url) URL.revokeObjectURL(ln.url);
      ln.blob = new Blob(rec.chunks, { type: rec.recorder.mimeType });
      ln.url = URL.createObjectURL(ln.blob);
      /* Add its play button without redrawing, so typing in the words isn't interrupted. */
      const i = sk.lines.indexOf(ln), row = document.querySelector(`.sk-w[data-i="${i}"]`)?.parentElement;
      if (row && !row.querySelector("[data-play]")) {
        row.querySelector(".sk-w").insertAdjacentHTML("afterend", html`<button class="sb" data-play="${i}" aria-label="Hear line ${i + 1}">${icon("play")}</button>`.toString());
        row.querySelector("[data-play]").onclick = () => hear(i);
      }
    };
    rec.recorder.stop();
  }
  if (!notes.length && !ln.notes.length) {
    sk.lines.splice(rec.i, 1);
    sk.at = -1;
    if (!quiet) { paint(); toast("Nothing sung was heard. Sing a little louder, close to the phone."); }
    return;
  }
  if (notes.length) { ln.frames = rec.frames; ln.notes = notes; ln.dur = rec.frames.length ? rec.frames[rec.frames.length - 1].t : 0; }
  if (quiet) return;
  tick(); markUsed("sketch");
  paint();
  /* Words next: focusing in the same tap opens the keyboard, with its microphone for dictation. */
  const w = document.querySelector(`.sk-w[data-i="${rec.i}"]`);
  if (w && !w.value) w.focus();
}
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---- The melody trace: the line being sung, or every line so far ----
function drawTrace() {
  const svg = $("sk-trace");
  if (!svg) return;
  const W = 340, H = 120;
  const live = sk.rec, lines = live ? [{ frames: live.frames, notes: [] }] : sk.lines;
  const pts = lines.flatMap((l, li) => (live ? l.frames.filter(f => f.hz > 0).map(f => ({ t: f.t, m: 69 + 12 * Math.log2(f.hz / 440), li }))
    : l.notes.flatMap(n => [{ t: n.start, m: n.midi, li }, { t: n.start + n.dur, m: n.midi, li, end: true }])));
  if (!pts.length) { svg.innerHTML = html`<text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle" class="sk-empty">${live ? "Listening…" : "Your melody shows here as you sing"}</text>`.toString(); return; }
  /* Lines sit one after another; a small gap between them. */
  const offs = []; let acc = 0;
  lines.forEach(l => { offs.push(acc); acc += (live ? l.frames.at(-1)?.t || 0 : l.dur) + 0.4; });
  const span = Math.max(live ? 6 : 1, acc);
  const lo = Math.min(...pts.map(p => p.m)) - 2, hi = Math.max(...pts.map(p => p.m)) + 2, rng = Math.max(10, hi - lo);
  const x = p => 6 + ((p.t + offs[p.li]) / span) * (W - 12), y = m => H - 10 - ((m - lo) / rng) * (H - 20);
  let d = "";
  if (live) d = pts.map((p, k) => `${k ? "L" : "M"}${x(p).toFixed(1)},${y(p.m).toFixed(1)}`).join("");
  else for (let k = 0; k < pts.length; k += 2) d += `M${x(pts[k]).toFixed(1)},${y(pts[k].m).toFixed(1)}H${x(pts[k + 1]).toFixed(1)}`;
  const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const grid = [];
  for (let m = Math.ceil(lo); m <= hi; m++) if ([0, 4, 7].includes(((m % 12) + 12) % 12) || m === Math.ceil(lo)) grid.push(m);
  svg.innerHTML = html`${grid.map(m => html`<line x1="0" x2="${W}" y1="${y(m).toFixed(1)}" y2="${y(m).toFixed(1)}" class="sk-grid"/><text x="${W - 2}" y="${(y(m) - 3).toFixed(1)}" text-anchor="end" class="sk-gl">${names[((m % 12) + 12) % 12]}</text>`)}
    <path d="${d}" class="sk-line ${live ? "live" : ""}"/>`.toString();
}

// ---- The screen ----
function keyChip() {
  const k = detectKey(sk.lines.flatMap(l => l.notes));
  return k && sk.lines.flatMap(l => l.notes).length >= 6 ? `Sounds like ${k.name}${k.sure ? "" : "?"}` : "";
}
function paint() {
  const rec = sk.rec, n = sk.lines.length, next = rec ? rec.i : n;
  const ready = sk.lines.some(l => l.notes.length);
  const status = rec ? `Recording line ${rec.i + 1}` : n ? `${n} line${n === 1 ? "" : "s"}` : "Ready";
  app.innerHTML = html`
    <div class="head"><button class="btn sm glass" id="sk-cancel">${n ? "Discard" : "Cancel"}</button>
      <button class="btn sm primary" id="sk-done" ${ready && !rec ? "" : raw("disabled")}>Make chords</button></div>
    <h1 class="title sk-h">New sketch</h1>
    <p class="sk-sub">Sing a line, then say or type its words. One line at a time. Your voice stays on this phone.</p>
    <div class="sk-chips"><span class="sk-pill ${rec ? "on" : ""}">${rec && raw('<i class="sk-dot"></i>')}${status}</span>${keyChip() && html`<span class="chip sk-key">${keyChip()}</span>`}</div>
    <div class="sk-card"><div class="sk-lab">${rec ? "Your melody, this line" : "Your melody"}</div><svg id="sk-trace" viewBox="0 0 340 120" role="img" aria-label="Melody trace"></svg></div>
    ${n > 0 && html`<div class="sk-card"><div class="sk-lab">Lines</div>${sk.lines.map((l, i) => html`
      <div class="sk-row ${rec?.i === i ? "now" : ""}"><span class="sk-n">${i + 1}</span>
        <input class="sk-w" data-i="${i}" value="${l.words}" placeholder="${rec?.i === i ? "Singing…" : "Words for this line"}" autocapitalize="sentences" enterkeyhint="done" aria-label="Words for line ${i + 1}">
        ${l.url && html`<button class="sb" data-play="${i}" aria-label="Hear line ${i + 1}">${icon("play")}</button>`}
        <button class="sb" data-redo="${i}" aria-label="Sing line ${i + 1} again" ${rec ? raw("disabled") : ""}>${icon("loop")}</button>
        <button class="sb" data-del="${i}" aria-label="Remove line ${i + 1}" ${rec ? raw("disabled") : ""}>${icon("x")}</button></div>`)}</div>`}
    <div class="sk-bar"><div class="sk-time"><b id="sk-t">0:00</b><span>${rec ? "this line" : `line ${next + 1}`}</span></div>
      <button class="sk-rec ${rec ? "on" : ""}" id="sk-rec" aria-label="${rec ? `Stop line ${rec.i + 1}` : `Sing line ${next + 1}`}"><i></i></button>
      <div class="sk-tip">${rec ? "Tap to stop" : n ? "Next line" : "Tap to sing"}</div></div>`.toString();
  drawTrace();
  $("sk-rec").onclick = () => (sk.rec ? stopLine() : startLine(sk.lines.length));
  $("sk-cancel").onclick = () => {
    if (!sk.lines.length) return go("#/");
    ask({ title: "Discard this sketch?", text: "The lines you sang and their words go.", ok: "Discard", keep: "Keep singing", danger: true }, () => { reset(); go("#/"); });
  };
  $("sk-done").onclick = finish;
  app.querySelectorAll(".sk-w").forEach(w => { w.oninput = () => { sk.lines[+w.dataset.i].words = w.value; }; w.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); w.blur(); } }; });
  app.querySelectorAll("[data-redo]").forEach(b => b.onclick = () => startLine(+b.dataset.redo));
  app.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { const l = sk.lines.splice(+b.dataset.del, 1)[0]; if (l?.url) URL.revokeObjectURL(l.url); paint(); });
  app.querySelectorAll("[data-play]").forEach(b => b.onclick = () => hear(+b.dataset.play));
}
const hear = i => { const u = sk.lines[i]?.url; if (u) new Audio(u).play().catch(() => {}); };
function reset() { sk.lines.forEach(l => l.url && URL.revokeObjectURL(l.url)); sk.lines = []; sk.at = -1; }

// Make the song: chords from the melody over the words, opened in the editor
// (Sheet view) to name it and change any chord with a tap. The melody's notes
// stay with the song, and the recordings on this phone, for restyling,
// swapping chords and hearing it back.
async function finish() {
  stopLine(true);
  const kept = sk.lines.filter(l => l.notes.length);
  if (!kept.length) return;
  $("sk-done").disabled = true;
  await Promise.race([Promise.all(kept.map(l => l.ready)), new Promise(r => setTimeout(r, 1500))]);
  const s = sketchSong(kept.map(l => ({ words: l.words.trim(), notes: l.notes })));
  const clips = kept.map(l => l.blob || null);
  reset(); closeMic();
  const song = await newSong({ title: "", body: s.body, key: s.sure ? s.key : "", format: "chords", sketch: s.sketch }, "sheet");
  if (song && clips.some(Boolean)) saveClips(song.id, clips).catch(() => {});
  setTimeout(() => toast(`Chords from your melody${s.key ? `, in ${s.key}` : ""}. Tap any chord to change it.`), 700);
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
  sheet?.classList.remove("focus"); sheet?.querySelectorAll(":scope > .cur").forEach(el => el.classList.remove("cur"));
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
  paint();
  window.scrollTo(0, 0);
}
