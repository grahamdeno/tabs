// The Gig (4.1.0): a song played as a scored show. It sits over the song page while the song plays
// as it always does underneath (auto-scroll, the recording or the band, a play counted at the end),
// and reads where the song is from the page.
//
//   top       Close, the song map lit by section (Stage Gels, also the progress bar), your strings
//   status    the section you're in, in its colour, and the combo
//   crowd     12 fans: how many of your last 12 chord changes landed
//   chords    Now (with its shape) and Next, with the beats until the change; Louie reacts
//   timing    a bass string: still when your changes land on time, a wobble when early or late
//   lines     4, 5 or 6 lines of the song (Lines in a gig, in Tools), the current one biggest; or Full
//             (4.4.0): the whole song page under a thin strip (the map, the section, Now and Next, the combo)
//   bottom    Hearing you (tap to stop or start listening for this show) and Pause, in thumb reach
// Paused, the show dims in place: the line you stopped on, Louie, and in thumb reach Back a line,
// Tools, Sheet (leave the show for the song page) and a big Resume (4.2.0).
// The microphone hears your strums; each chord change is landed by a strum near it (gigChange in
// core.js). Without the microphone the show still plays and counts; nothing is graded.
// At the end: Show complete, with the bonus fans, the crowd and how many changes landed, and Encore
// (play it again for double bonus fans).
import { gigStart, gigChange, gigCrowd, gigTiming, gigDone, gelOf, questsSettle, bandParts, bandMeet, rehearseMisses, GIG_WINDOW, GIG_STRINGS, strumDetector, streakOf, playSongs, playableSongs, Tabs } from "./core.js";
import { esc, icon, sound, onLeave } from "./ui.js";
import { data, diag, scroll, viewing, READ_AT, startScroll, stopScroll, musicClock, usesMusic, chordTimes, pxPerSecond, isLine, gigHooks, go, chordSVG, homeHooks, openTools, redraw } from "./app.js";
import { louie } from "./louie.js";
import { friend, FRIENDS } from "./friends.js";

let gig = null; /* the show on stage, or null */
export const gigNow = () => gig;
const $ = id => document.getElementById(id);
const LINES = [4, 5, 6, "full"];
const linesWanted = () => LINES.includes(data.settings.gigLines) ? data.settings.gigLines : 5;

/* the guitar's strum without the beat: keep what is under 1.5 kHz (as the neck's lessons do) */
function guitarBand(ctx, src) {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = "lowpass"; f.frequency.value = 1500; f.Q.value = 0.7; }
  src.connect(a); a.connect(b);
  return b;
}
async function listen(g) {
  g.off = false; g.asking = true; paintMic();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("none");
    g.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch { g.stream = null; g.asking = false; g.denied = true; paintMic(); return; }
  g.asking = false;
  if (gig !== g || g.off) { g.stream.getTracks().forEach(t => t.stop()); g.stream = null; paintMic(); return; }
  const ctx = g.audio;
  if (!ctx) return;
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  g.src = ctx.createMediaStreamSource(g.stream); guitarBand(ctx, g.src).connect(an);
  const buf = new Float32Array(an.fftSize), hear = strumDetector();
  g.timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
    g.level = rms;
    const now = g.clock();
    if (hear(rms, now, 0)) { g.strums.push(now); while (g.strums.length && now - g.strums[0] > 6) g.strums.shift(); }
  }, 10);
  paintMic();
}

/* Stop listening for the rest of this show (Hearing you, tapped). Changes already heard still count. */
function deafen(g) {
  g.off = true;
  clearInterval(g.timer); g.timer = 0;
  try { g.src?.disconnect(); } catch {}
  g.stream?.getTracks().forEach(t => t.stop());
  g.stream = null; g.due = []; g.level = null;
  paintMic(); paintScore();
}

/* the sections of the song, top to bottom, with where each starts on the page */
function sections() {
  const out = [];
  for (const b of diag.blocks || []) {
    if (b.el.classList.contains("sec")) out.push({ name: b.el.textContent.trim(), gel: gelOf(b.el.textContent), y: b.y });
    else if (!out.length && isLine(b.el)) out.push({ name: "", gel: "verse", y: b.y });
  }
  const end = Math.max(1, ...(diag.blocks || []).map(b => b.y));
  return out.map((s, i) => ({ ...s, to: out[i + 1]?.y ?? end })).map(s => ({ ...s, share: Math.max(0.02, (s.to - s.y) / end) }));
}

/* When each chord comes, as a place on the page. Chords on one line share its height, so each is moved
   down by how far along the line it sits: the line's chords are spread over the time the line takes. */
let along = { seq: null, y: [] };
function chordYs() {
  const seq = diag.seq || [], sheet = $("sheet");
  if (along.seq === seq || !sheet) return along.y;
  const box = sheet.getBoundingClientRect(), w = Math.max(1, box.width);
  const ys = [...new Set(seq.map(c => c.y))].sort((a, b) => a - b);
  const lastY = Math.max(0, ...(diag.blocks || []).map(b => b.y));
  along = { seq, y: seq.map(c => {
    const nx = ys.find(y => y > c.y + 2) ?? Math.max(c.y + 40, lastY);
    const x = Math.max(0, Math.min(0.95, (c.el.getBoundingClientRect().left - box.left) / w));
    return c.y + x * (nx - c.y);
  }) };
  return along.y;
}

/* where the song is: the current line, the current chord, the section, and how far along */
function where(song) {
  const sheet = $("sheet");
  if (!sheet || !diag.blocks?.length) return null;
  const top = sheet.getBoundingClientRect().top, line = innerHeight * READ_AT;
  let b = 0;
  for (let i = 0; i < diag.blocks.length; i++) if (top + diag.blocks[i].y <= line) b = i;
  while (b < diag.blocks.length - 1 && !isLine(diag.blocks[b].el)) b++;
  let sec = null;
  for (let i = b; i >= 0; i--) if (diag.blocks[i].el.classList.contains("sec")) { sec = diag.blocks[i].el.textContent.trim(); break; }
  let idx = -1, next = -1, until = null;
  const seq = diag.seq || [];
  if (seq.length) {
    const clock = usesMusic(song) ? musicClock(song) : null, ct = clock !== null ? chordTimes(song) : null;
    idx = 0;
    if (ct) { for (let i = 0; i < ct.length; i++) if (ct[i] != null && ct[i] <= clock) idx = i; }
    else { const ys = chordYs(); for (let i = 0; i < seq.length; i++) if (top + ys[i] <= line) idx = i; }
    for (let i = idx + 1; i < seq.length; i++) if (seq[i].name !== seq[idx].name) { next = i; break; }
    if (next >= 0) until = ct && ct[next] != null ? ct[next] - clock : (top + chordYs()[next] - line) / Math.max(1, pxPerSecond(song));
  }
  const end = Math.max(1, diag.blocks[diag.blocks.length - 1].y);
  return { b, sec, idx, next, until, progress: Math.max(0, Math.min(1, (line - top) / end)) };
}

/* ---- the screen ---- */
const FAN = (on, i) => {
  const col = ["var(--g-chorus)", "var(--g-verse)", "var(--fans)", "var(--g-solo)"][i % 4];
  return `<svg class="gg-fan${on ? " on" : ""}" viewBox="0 0 26 40" aria-hidden="true"><circle cx="13" cy="${on ? 13 : 16}" r="8" fill="${on ? col : "var(--locked)"}"/><rect x="3" y="${on ? 23 : 26}" width="20" height="15" rx="8" fill="${on ? col : "var(--locked)"}"/>${on ? `<path d="M4 25 L-1 10 M22 25 L27 10" stroke="${col}" stroke-width="4" stroke-linecap="round"/>` : ""}</svg>`;
};
const PLUG = `<svg width="22" height="24" viewBox="0 0 30 32" aria-hidden="true"><rect x="6" y="6" width="18" height="22" rx="6" fill="var(--strings-deep)"/><rect x="5" y="4" width="18" height="22" rx="6" fill="var(--strings)"/><rect x="10" y="0" width="3" height="6" rx="1.5" fill="var(--muted)"/><rect x="15" y="0" width="3" height="6" rx="1.5" fill="var(--muted)"/></svg>`;

function shell(song) {
  const el = document.createElement("div");
  el.id = "gig"; el.className = "gig"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `Gig: ${song.title}`);
  el.innerHTML = `<div class="gg-light" aria-hidden="true"></div>
    <div class="gg-top">
      <button class="gg-x" id="gg-x" aria-label="Leave the gig">${icon("x")}</button>
      <div class="gg-map" id="gg-map" aria-hidden="true"></div>
      <span class="gg-str" id="gg-str" aria-label="Strings">${PLUG}<b>${GIG_STRINGS}</b></span>
    </div>
    <div class="gg-status"><span class="gg-sec" id="gg-sec">Get ready</span><span class="gg-mini" id="gg-mini" aria-live="off"></span><span class="gg-combo" id="gg-combo"></span></div>
    <section class="gg-crowd" aria-label="Crowd"><div class="gg-crowd-h"><span>CROWD</span><b id="gg-mood"></b></div><div class="gg-fans" id="gg-fans"></div></section>
    <div class="gg-chords">
      <div class="gg-now" id="gg-now"><small>NOW</small><b id="gg-nowname"></b><div id="gg-nowdg"></div></div>
      <div class="gg-side">
        <div class="gg-next"><small>NEXT</small><b id="gg-nextname"></b><span class="gg-beats" id="gg-beats" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div>
        <div class="gg-louie" id="gg-louie"></div>
      </div>
    </div>
    <div class="gg-timing" aria-label="Timing"><div class="gg-th"><span>TIMING</span><b id="gg-tw"></b></div>
      <svg viewBox="0 0 354 34" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="4" width="9" height="26" rx="4" class="gg-nut"/><rect x="345" y="4" width="9" height="26" rx="4" class="gg-nut"/><path id="gg-string" class="gg-string" d="M9 17 L345 17"/></svg></div>
    <div class="gg-lines sheet" id="gg-lines"></div>
    <div class="gg-bottom">
      <button class="gg-mic" id="gg-mic" aria-label="Microphone"></button>
      <button class="gg-pause" id="gg-pause" aria-label="Pause">${icon("pause")}</button>
    </div>
    <div class="gg-hold" id="gg-hold" hidden>
      <div class="gg-here"><small>YOU STOPPED HERE</small><div class="gg-hline sheet" id="gg-hline"></div>
        <div class="gg-say"><span id="gg-hlouie"></span><p id="gg-hsay"></p></div></div>
      <div class="gg-hacts">
        <div class="gg-hrow">
          <button class="btn gg-hb" id="gg-back">${icon("up")}Back a line</button>
          <button class="btn gg-hb" id="gg-tools" aria-haspopup="menu">${icon("dots")}Tools</button>
          <button class="btn gg-hb" id="gg-sheet">${icon("list")}Sheet</button>
        </div>
        <button class="btn primary gg-resume" id="gg-resume">${icon("play")}RESUME</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function paintMic() {
  const b = $("gg-mic");
  if (!b || !gig) return;
  const g = gig, on = !!g.stream;
  const [big, small, label] = on ? ["Hearing you", "TAP TO TURN OFF", "Hearing you: this show is scored. Tap to stop listening"]
    : g.asking ? ["Listening…", "ALLOW THE MICROPHONE", "Asking for the microphone"]
    : g.denied ? ["No microphone", "TAP TO TRY AGAIN", "No microphone: this show isn't scored. Tap to try again"]
    : ["Not listening", "TAP TO SCORE IT", "Not listening: this show isn't scored. Tap to listen"];
  b.classList.toggle("off", !on);
  b.innerHTML = `${icon("mic")}<span class="gg-lv" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="gg-mt">${big}<small>${small}</small></span>`;
  b.setAttribute("aria-label", label);
}

function paintMap() {
  const box = $("gg-map");
  if (!box) return;
  const secs = sections();
  box.innerHTML = (secs.length ? secs : [{ gel: "verse", share: 1 }]).map(s => `<i class="gl-${s.gel}" style="flex:${s.share.toFixed(3)}"></i>`).join("") + '<em id="gg-mark"></em>';
}

function paintLines(w) {
  const box = $("gg-lines");
  if (!box) return;
  const n = linesWanted(), out = [];
  for (let i = w.b; i < diag.blocks.length && out.length < n; i++) {
    const el = diag.blocks[i].el;
    if (!isLine(el)) continue;
    const c = el.cloneNode(true);
    c.classList.remove("cur", "cur2", "focus");
    c.querySelectorAll(".now, .sel").forEach(x => x.classList.remove("now", "sel"));
    c.removeAttribute("id");
    c.classList.add(out.length === 0 ? "gl-now" : out.length < 3 ? "gl-soon" : "gl-later");
    out.push(c);
  }
  box.replaceChildren(...out);
  if (!out.length) box.innerHTML = '<p class="gg-end">That\'s the end of the song.</p>';
}

function paintScore() {
  const g = gig;
  if (!g) return;
  const crowd = g.stream ? gigCrowd(g.score) : 0;
  $("gg-fans").innerHTML = Array.from({ length: 12 }, (_, i) => FAN(g.stream ? i < crowd : false, i)).join("");
  $("gg-mood").textContent = !g.stream ? "LISTENING IS OFF" : crowd >= 10 ? "ON THEIR FEET" : crowd >= 7 ? "THEY'RE INTO IT" : crowd >= 4 ? "WARMING UP" : "WIN THEM BACK";
  $("gg-combo").textContent = g.score.combo >= 2 ? `COMBO x${g.score.combo}` : "";
  $("gg-str").querySelector("b").textContent = g.score.strings;
  $("gg-str").setAttribute("aria-label", `Strings ${g.score.strings} of ${GIG_STRINGS}`);
  const mood = !g.stream ? "happy" : crowd >= 9 ? "cheer" : crowd <= 3 ? "worried" : "happy";
  if (mood !== g.mood) { g.mood = mood; $("gg-louie").innerHTML = louie(mood, { size: 74 }); }
  /* the bass string: still on time, a wobble when early or late (wider the further off) */
  const off = gigTiming(g.score), amt = Math.min(1, Math.abs(off) / GIG_WINDOW), s = $("gg-string");
  const amp = (amt * 11).toFixed(1);
  s.setAttribute("d", amt < 0.2 ? "M9 17 L345 17" : `M9 17 Q 51 ${17 - amp} 93 17 T 177 17 T 261 17 T 345 17`);
  s.classList.toggle("wob", amt >= 0.2);
  $("gg-tw").textContent = !g.stream ? "" : !g.score.offsets.length ? "" : amt < 0.2 ? "ON IT" : off < 0 ? "A LITTLE EARLY" : "A LITTLE LATE";
}

function frame() {
  const g = gig;
  if (!g) return;
  g.raf = requestAnimationFrame(frame);
  const song = g.song;
  const w = where(song);
  if (!w) return;
  /* the song map's marker */
  const mark = $("gg-mark");
  if (mark) mark.style.left = (w.progress * 100).toFixed(2) + "%";
  /* section and Stage Gel */
  const counting = !!document.querySelector(".countin");
  const gel = gelOf(w.sec || "verse");
  if (gel !== g.gel) { g.gel = gel; g.el.dataset.gel = gel; }
  $("gg-sec").textContent = counting ? "COUNT IN" : (w.sec || "Verse").toUpperCase();
  /* lines (Lines in a gig can change in Tools) */
  if (g.el.dataset.lines !== String(linesWanted())) { g.el.dataset.lines = linesWanted(); setFull(g); g.b = -1; }
  if (w.b !== g.b) { g.b = w.b; paintLines(w); if (g.paused) paintHold(); }
  /* chords */
  const seq = diag.seq || [];
  if (w.idx >= 0 && w.idx !== g.idx) {
    const name = seq[w.idx].name, prev = g.idx >= 0 ? seq[g.idx]?.name : null;
    g.idx = w.idx;
    $("gg-nowname").textContent = name;
    $("gg-nowdg").innerHTML = chordSVG(name, 1.35);
    /* a change on stage: graded once its window has passed */
    if (scroll.on && !counting && prev && prev !== name && g.stream && performance.now() > g.dragUntil) g.due.push({ t: g.clock(), pair: `${prev}>${name}` });
  }
  $("gg-nextname").textContent = w.next >= 0 ? seq[w.next].name : seq.length ? "End" : "";
  const mini = seq.length && w.idx >= 0 ? `${seq[w.idx].name} → ${w.next >= 0 ? seq[w.next].name : "End"}` : "";
  if (mini !== g.mini) { g.mini = mini; $("gg-mini").textContent = mini; }
  const bpm = song.bpm || 90, beats = w.until == null ? 0 : Math.max(0, Math.min(4, Math.ceil(w.until * bpm / 60)));
  if (beats !== g.beats) { g.beats = beats; $("gg-beats").querySelectorAll("i").forEach((e, i) => e.classList.toggle("on", i < beats)); }
  /* grade the changes whose window has passed */
  const now = g.clock();
  let graded = false;
  while (g.due.length && now - g.due[0].t > GIG_WINDOW) {
    const d = g.due.shift(), r = gigChange(g.score, d.t, g.strums);
    if (!r.hit) g.missed[d.pair] = (g.missed[d.pair] || 0) + 1; /* for Rehearse's soundcheck (4.8.0) */
    graded = true;
    flash(r.hit);
  }
  if (graded) paintScore();
  /* the mic's level */
  if (g.stream && g.level != null) {
    const bars = $("gg-mic")?.querySelectorAll(".gg-lv i") || [];
    const lv = Math.min(1, g.level * 40);
    bars.forEach((b, i) => b.style.height = `${Math.round(5 + lv * 16 * (0.6 + 0.4 * Math.sin(i * 1.7 + now * 9)))}px`);
  }
}

/* A finger moves the song (4.2.2): drag the lines, or the line you stopped on, and the page underneath
   moves with it; the show follows. Changes passed while dragging aren't graded. */
function bindDrag(g) {
  /* Full: the page scrolls under your finger as it always does */
  const pageMove = () => { if (g.el.dataset.lines === "full") g.dragUntil = performance.now() + 700; };
  addEventListener("touchmove", pageMove, { passive: true }); addEventListener("wheel", pageMove, { passive: true });
  g.unbind = () => { removeEventListener("touchmove", pageMove); removeEventListener("wheel", pageMove); };
  let last = null;
  const move = y => { if (last == null) return; window.scrollBy(0, (last - y) * 1.4); last = y; g.dragUntil = performance.now() + 700; };
  for (const el of [$("gg-lines"), $("gg-hold")]) {
    el.addEventListener("touchstart", e => { if (!e.target.closest("button")) last = e.touches[0].clientY; }, { passive: true });
    el.addEventListener("touchmove", e => { if (last == null) return; e.preventDefault(); move(e.touches[0].clientY); }, { passive: false });
    el.addEventListener("touchend", () => { last = null; }, { passive: true });
    el.addEventListener("touchcancel", () => { last = null; }, { passive: true });
  }
  g.el.addEventListener("wheel", e => { if (e.target.closest(".gc")) return; e.preventDefault(); window.scrollBy(0, e.deltaY); g.dragUntil = performance.now() + 700; }, { passive: false });
}

function flash(hit) {
  const el = $("gg-now");
  if (!el) return;
  el.classList.remove("hit", "miss"); void el.offsetWidth; el.classList.add(hit ? "hit" : "miss");
}

/* ---- open, pause, close ---- */
export function openGig(song, opts = {}) {
  closeGig(true);
  const audio = sound();
  const g = gig = {
    song, encore: !!opts.encore, from: opts.from || "song", score: gigStart(), strums: [], due: [], b: -1, idx: -1, beats: -1, gel: "", mood: "", dragUntil: 0, missed: {},
    audio, clock: () => audio ? audio.currentTime : performance.now() / 1000, stream: null, ended: false, paused: false
  };
  g.el = shell(song);
  document.body.classList.add("gigging");
  gigHooks.on = true;
  gigHooks.band = bandParts(data); /* Your band (4.7.0): drums and bass from the friends who've joined */
  gigHooks.credited = () => { if (gig === g) g.credited = true; };
  gigHooks.stopped = () => { if (gig !== g) return; if (g.credited) showComplete(); else if (!g.leaving) paused(true); };
  gigHooks.resume = () => { if (gig === g) resume(); };
  gigHooks.leave = () => { if (gig === g) leave(); };
  $("gg-x").onclick = () => leave();
  $("gg-pause").onclick = () => { if (scroll.on) stopScroll(); else resume(); };
  $("gg-mic").onclick = () => { if (g.stream) deafen(g); else if (!g.asking) listen(g); };
  $("gg-resume").onclick = () => resume();
  $("gg-sheet").onclick = () => leave();
  $("gg-tools").onclick = e => { e.stopPropagation(); openTools($("gg-tools")); };
  $("gg-back").onclick = () => backALine();
  bindDrag(g);
  g.el.dataset.lines = linesWanted();
  setFull(g);
  paintMap(); paintMic(); paintScore();
  /* Score my plays (Settings > Playing) decides whether a show starts listening. */
  if (data.settings.gigScore !== false) listen(g); else { g.off = true; paintMic(); }
  g.raf = requestAnimationFrame(frame);
  if (!scroll.on) startScroll(song);
}
function paused(on) {
  const g = gig;
  if (!g) return;
  g.paused = on;
  g.el.classList.toggle("paused", on);
  $("gg-hold").hidden = !on;
  $("gg-pause").setAttribute("aria-label", on ? "Play on" : "Pause");
  if (on) { paintHold(); $("gg-resume").focus({ preventScroll: true }); }
}
/* Full (4.4.0): the song page shows; the show is a strip at the top and Hearing you and Pause at the bottom */
function setFull(g) { document.body.classList.toggle("gig-full", g.el.dataset.lines === "full" && !g.ended); }
/* Paused: the line you stopped on, and Louie keeping the crowd */
function paintHold() {
  const g = gig, box = $("gg-hline");
  if (!g || !box) return;
  const now = $("gg-lines")?.querySelector(".gl-now");
  box.replaceChildren(...(now ? [now.cloneNode(true)] : []));
  $("gg-hlouie").innerHTML = louie("happy", { size: 64 });
  $("gg-hsay").textContent = g.score.combo >= 2 ? "Take a breath. The crowd's still with you, and your combo is held." : "Take a breath. The crowd's still here when you're ready.";
}
/* Back a line: the line before the one you stopped on comes to the reading line */
function backALine() {
  const g = gig, sheet = $("sheet");
  if (!g || !sheet || !diag.blocks?.length) return;
  let i = Math.max(0, g.b) - 1;
  while (i > 0 && !isLine(diag.blocks[i].el)) i--;
  const to = scrollY + sheet.getBoundingClientRect().top + diag.blocks[Math.max(0, i)].y - innerHeight * READ_AT + 1;
  window.scrollTo(0, Math.max(0, to));
  g.b = -1; g.idx = -1;
}
function resume() { const g = gig; if (!g) return; document.querySelector(".menu")?.remove(); paused(false); startScroll(g.song); }
/* Leave the show (X or Sheet): the song stays open, paused where it was */
function leave() {
  const g = gig;
  if (!g) return;
  g.leaving = true;
  if (scroll.on) stopScroll();
  closeGig(true);
}
export function closeGig(quiet = false) {
  const g = gig;
  if (!g) return;
  gig = null;
  cancelAnimationFrame(g.raf);
  clearInterval(g.timer);
  try { g.src?.disconnect(); } catch {}
  g.stream?.getTracks().forEach(t => t.stop());
  g.el?.remove();
  g.unbind?.();
  document.body.classList.remove("gigging", "gig-full");
  gigHooks.on = false; gigHooks.band = null; gigHooks.credited = null; gigHooks.stopped = null; gigHooks.resume = null; gigHooks.leave = null;
  document.querySelector(".menu.tools")?.remove();
  if (!quiet && g.from === "road") go("#/");
}
onLeave(() => closeGig(true));

/* ---- Show complete ---- */
function showComplete() {
  const g = gig;
  if (!g || g.ended) return;
  g.ended = true;
  cancelAnimationFrame(g.raf);
  clearInterval(g.timer);
  g.stream?.getTracks().forEach(t => t.stop());
  const graded = g.score.hits + g.score.misses > 0;
  const { fans, pct, request, battle, cover, duel } = gigDone(data, g.song.id, g.score, g.encore);
  rehearseMisses(data, g.missed); /* the changes you dropped: tomorrow's soundcheck */
  const earned = questsSettle(data); /* Tour quests: tonight's setlist and the month's tour */
  const joined = bandMeet(data); /* Your band: who joined with this show */
  Tabs.save(data);
  const st = streakOf(playSongs(data)), ps = playableSongs(data);
  const crowd = graded ? gigCrowd(g.score) : null;
  const tile = (lab, val, cls) => `<div class="gc-tile ${cls}"><small>${lab}</small><b>${val}</b></div>`;
  g.el.classList.remove("paused");
  g.el.classList.add("done");
  setFull(g);
  g.el.innerHTML = `<div class="gc">
    <div class="gc-conf" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    ${joined.length ? `<div class="gc-join">${joined.map(f => friend(f.id, { size: 120, mood: "cheer" })).join("")}${louie("cheer", { pose: "hornsUp", size: 120 })}</div>` : louie("cheer", { pose: "hornsUp", size: 170 })}
    <h2 class="gc-t">${g.encore ? "Encore complete!" : "Show complete!"}</h2>
    <p class="gc-s">${esc(g.song.title)}, start to finish.${crowd >= 10 ? " The crowd wants more." : ""}</p>
    <div class="gc-tiles">${tile("FANS", `+${fans + 10 + earned.reduce((n, x) => n + x.fans, 0)}`, "fans")}${tile("CROWD", crowd === null ? "–" : `${crowd}/12`, "crowd")}${tile("ON THE BEAT", pct === null ? "–" : `${pct}%`, "beat")}</div>
    <div class="gc-list">
      ${graded ? `<p><b>${g.score.hits}</b> of ${g.score.hits + g.score.misses} changes landed${g.score.best >= 3 ? `, best combo <b>${g.score.best}</b>` : ""}</p>` : `<p>The microphone was off, so this show wasn't scored. It still counts as a play.</p>`}
      ${battle ? `<p>${battle.result === "won" ? `Rival battle: you beat <b>${esc(battle.rival)}</b>, ${battle.pct}% to ${battle.target}%. <b>+30 XP, +40 fans</b>` : `Rival battle: ${esc(battle.rival)} held on, ${battle.target}% to your ${battle.pct}%`}</p>` : ""}
      ${joined.map(f => { const n = FRIENDS.find(x => x.id === f.id)?.name || f.id; return `<p><b>${esc(n)} joined your band!</b>${f.plays ? ` You'll hear ${f.plays === "drums" ? "drums" : "bass"} in your gigs.` : ""}</p>`; }).join("")}
      ${duel ? `<p>Song duel: ${duel.mine.pct > duel.theirs.pct ? `<b>you beat ${esc(duel.opp)}</b>` : duel.mine.pct < duel.theirs.pct ? `${esc(duel.opp)} wins this one` : "a tie"}, ${duel.mine.pct}% to ${duel.theirs.pct}%</p>` : ""}
      ${cover ? `<p>Cover quest done: you learned a song you love. <b>3x bonus fans</b></p>` : ""}
      ${request ? `<p>Request line: a fan asked for this one. <b>2x bonus fans</b></p>` : ""}
      ${earned.map(x => `<p>${esc(x.label)}: <b>+${x.fans} fans</b></p>`).join("")}
      ${ps.of ? `<p>You can play <b>${ps.now} of your ${ps.of}</b> songs</p>` : ""}
      ${st.days ? `<p>Gig streak: <b>${st.days} night${st.days === 1 ? "" : "s"}</b></p>` : ""}
    </div>
    ${duel ? `<section class="gc-duel"><small>SONG DUEL</small><b>Send ${esc(duel.opp)} your score</b><button class="btn primary" id="gc-reply">SEND YOUR SCORE BACK</button></section>`
      : pct !== null ? `<section class="gc-duel"><small>CHALLENGE A FRIEND</small><b>"I hit ${pct}% on ${esc(g.song.title)}. Beat it."</b><button class="btn primary" id="gc-duel">SEND THE CHALLENGE</button></section>` : ""}
    <div class="gc-acts">
      ${g.encore ? "" : `<button class="btn primary" id="gc-encore">ENCORE · 2x BONUS FANS</button>`}
      <button class="btn" id="gc-go">CONTINUE</button>
    </div></div>`;
  $("gc-go").onclick = () => { const from = g.from; closeGig(true); if (from === "road") { homeHooks.openDrawer = false; go("#/"); } else if (from === "tour" || from === "charts") go("#/" + from); else redraw?.(); };
  $("gc-duel")?.addEventListener("click", e => import("./duel.js").then(m => m.sendChallenge(g.song, { pct, combo: g.score.best, crowd: graded ? gigCrowd(g.score) : 0 }, e.currentTarget)));
  $("gc-reply")?.addEventListener("click", e => import("./duel.js").then(m => m.sendReply(duel, e.currentTarget)));
  $("gc-encore")?.addEventListener("click", () => {
    const song = g.song, from = g.from;
    closeGig(true);
    window.scrollTo(0, 0);
    setTimeout(() => { if (viewing?.id === song.id) openGig(song, { encore: true, from }); }, 120);
  });
}
