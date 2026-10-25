// The Gig (4.1.0): a song played as a scored show. It sits over the song page while the song plays
// as it always does underneath (auto-scroll, the recording or the band), and reads where the song is from the page.
//
//   top       the section you're in (in its colour) and your run of chords caught (4.66.0: no Close; the
//             page's own Back leaves, as everywhere else)
//   crowd     the crowd as a row of 12 fans that fills up
//   lines     the song page itself (4.51.0): the Gig is see-through in the middle, and stage.js draws the band
//             and the chords on the real sheet, so you read, scroll and drag the song itself. A chord you
//             played turns green and stays green (Chord Catch, 4.54.0). A small shape for the next chord
//             you haven't learned.
//   bottom    Hearing you (tap to stop or start listening for this show) and Pause, in thumb reach
// Paused (4.52.0), the show steps aside and the song page is back as it always is: Tools and Play (reading
// Resume) in thumb reach, a quiet band on the line you stopped on, and Louie's line above Play when there is
// one to say. Play picks the show up again; the page's Back, or Tools for anything but the switches, ends it.
// The microphone hears the room every 50 ms; the chord you're on and the next one are caught when two readings
// in a row fit them (catchHear in core.js). When you played it doesn't matter. Without the microphone the show
// still plays; nothing is scored.
// At the end: Show complete, under the backdrop you wear (4.66.0, Change picks another you own), with the bonus fans, the crowd, the song you played (green for caught) and Encore
// (play it again for double bonus fans).
import { COMBO_STEPS, VERSION, gigStart, catchScore, catchTargets, catchStart, catchAt, catchHear, catchClose, chordNotes, chromaOf, gigCrowd, knownChords, gigDone, questsSettle, bandParts, bandMeet, rehearseMisses, streakOf, playSongs, playableSongs, merchTip, liningDue, Tabs } from "./core.js";
import { backdropBanner, backdropsOwned, wearBackdrop } from "./merch.js";
import { esc, icon, sound, onLeave } from "./ui.js";
import { data, diag, scroll, viewing, startScroll, stopScroll, waitOn, holdScroll, gigHooks, go, chordSVG, homeHooks, redraw } from "./app.js";
import { louie } from "./louie.js";
import { callout } from "./callout.js";
import { friend, FRIENDS } from "./friends.js";
import { where, sections, stageStart, stageClear, stageTick, stageCatch, stageMiss, stageWait } from "./stage.js";
import { gigDoneHere, gigFrame, gigOpen, gigPaused, gigResumed, hideStrip } from "./opening.js";

let gig = null; /* the show on stage, or null */
const $ = id => document.getElementById(id);

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
  /* Chord Catch (4.54.0): the room is read every 50 ms while something is sounding, and the chord you're on
     and the next are caught when two readings in a row fit them. Silence clears the pair. */
  const sp = ctx.createAnalyser(); sp.fftSize = 16384; sp.smoothingTimeConstant = 0;
  guitarBand(ctx, g.src).connect(sp);
  const spec = new Float32Array(sp.frequencyBinCount);
  const buf = new Float32Array(an.fftSize);
  let floor = 0.002, last = 0;
  g.timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
    g.level = rms;
    /* the room's quietest level, creeping up only slowly, so a chord that rings on is never taken for the room */
    if (rms > 0.00002) floor = Math.min(rms, floor * 1.0002, 0.006);
    const now = g.clock();
    if (now - last < 0.05 || !g.catch) return;
    last = now;
    let hit = -1;
    if (rms > Math.max(0.004, floor * 3)) { sp.getFloatFrequencyData(spec); hit = catchHear(g.catch, chromaOf(spec, ctx.sampleRate, sp.fftSize)); }
    else catchHear(g.catch, null);
    if (hit >= 0 && scoring(g)) caught(g, hit);
  }, 10);
  paintMic();
}

/* Stop listening for the rest of this show (Hearing you, tapped). Changes already heard still count. */
function deafen(g) {
  g.off = true;
  clearInterval(g.timer); g.timer = 0;
  try { g.src?.disconnect(); } catch {}
  g.stream?.getTracks().forEach(t => t.stop());
  g.stream = null; g.level = null;
  paintMic(); paintScore();
}

/* ---- the screen ---- */

function shell(song) {
  const el = document.createElement("div");
  el.id = "gig"; el.className = "gig"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `Gig: ${song.title}`);
  /* 4.66.0: no X and no backdrop: the show is the song page itself, left with the page's own Back */
  el.innerHTML = `
    <div class="gg-top">
      <span class="gg-sec" id="gg-sec">Get ready</span>
      <span class="gg-wpill" id="gg-wpill" hidden>WAIT FOR ME</span>
      <span class="gg-combo" id="gg-combo"></span>
    </div>
    <div class="gg-status"><span class="gg-fans" id="gg-fans" role="img" aria-label="Crowd"></span></div>
    <div class="gg-shape" id="gg-shape" hidden></div>
    <div class="gg-wait" id="gg-wait" hidden></div>
    <p class="sr-only" id="gg-live" role="status" aria-live="polite"></p>
    <div class="gg-bottom">
      <button class="gg-skip" id="gg-skip" hidden>Skip this chord</button>
      <button class="gg-mic" id="gg-mic" aria-label="Microphone"></button>
      <button class="gg-pause" id="gg-pause" aria-label="Pause">${icon("pause")}</button>
    </div>
`;
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

/* a small shape for a chord you haven't learned yet, beside the lines */
function paintShape() {
  const g = gig, el = $("gg-shape");
  if (!g || !el || !g.catch) return;
  /* the chord you're on if you haven't caught it and haven't learned it, else the next one you haven't learned */
  const c = g.catch, now = c.targets[c.cur], next = c.targets[c.cur + 1];
  const pick = [[now, "NOW"], [next, "NEXT"]].find(([t]) => t && !g.known.has(t.name) && !c.caught[c.targets.indexOf(t)] && chordSVG(t.name, 1));
  if (!pick) { el.hidden = true; return; }
  const [t, label] = pick;
  if (el.dataset.ch !== label + t.name) { el.dataset.ch = label + t.name; el.innerHTML = `<small>${label}</small><b>${esc(t.name)}</b>${chordSVG(t.name, 1)}`; }
  el.hidden = false;
}
/* a fan: head, shoulders, and arms that only show when they're up; the order fans stand in, spread along the row */
const FAN = '<svg viewBox="0 0 20 28" aria-hidden="true"><path class="arms" d="M5 18 L1.5 6 M15 18 L18.5 6"/><circle cx="10" cy="9" r="5"/><path d="M1 28 C1 19 5 16 10 16 C15 16 19 19 19 28 Z"/></svg>';
const CROWD_ORDER = [5, 2, 9, 0, 7, 11, 3, 6, 10, 1, 8, 4];
function paintScore() {
  const g = gig;
  if (!g) return;
  const crowd = g.stream ? gigCrowd(g.score) : 0;
  const fans = $("gg-fans");
  /* 4.49.10: the crowd as 12 fans; the ones on their feet stand up and throw their hands up */
  if (!fans.children.length) fans.innerHTML = Array.from({ length: 12 }, () => `<i>${FAN}</i>`).join("");
  const on = new Set(CROWD_ORDER.slice(0, crowd));
  [...fans.children].forEach((e, i) => { e.className = g.stream && on.has(i) ? "on c" + (i % 4) : ""; });
  fans.setAttribute("aria-label", !g.stream ? "Crowd: listening is off" : `Crowd: ${crowd} of 12 on their feet`);
  const waiting = waitOn(g.song) && !!g.stream;
  if (waiting) { const n = g.score.hits + g.score.misses + (g.holding ? 1 : 0); $("gg-combo").innerHTML = n ? `${icon("check")}${g.score.hits} of ${n}` : ""; }
  else $("gg-combo").innerHTML = g.score.combo >= 2 ? `${icon("check")}${g.score.combo} in a row` : "";
}

function frame() {
  const g = gig;
  if (!g) return;
  g.raf = requestAnimationFrame(frame);
  const song = g.song;
  const w = where(song);
  if (!w) return;
  /* section and Stage Gel */
  const counting = !!document.querySelector(".countin");
  $("gg-sec").textContent = counting ? "COUNT IN" : (w.sec || "Verse").toUpperCase();
  gigFrame(g, w.sec, scroll.on && !counting);
  /* the lines: the band on the line you're on, on the sheet itself */
  g.b = w.b;
  stageTick(song, w);
  /* Chord Catch: the chords of the song are the targets (once the sheet is laid out) */
  const seq = diag.seq || [];
  if (!g.catch && seq.length) { g.catch = catchStart(catchTargets(seq)); g.seqLen = seq.length; }
  if (!g.catch) return;
  if (seq.length !== g.seqLen) { g.catch = catchStart(catchTargets(seq)); g.seqLen = seq.length; g.score = gigStart(); } /* the sheet was edited: start the count again */
  if (w.idx >= 0 && w.idx !== g.idx) {
    const start = g.idx < 0;
    g.idx = w.idx;
    catchAt(g.catch, w.idx);
    if (start) catchClose(g.catch); /* the chords above the reading line when the song starts aren't counted */
    paintShape();
  }
  holdFrame(g, counting);
  /* settle the chords that went by */
  const gone = catchClose(g.catch);
  if (gone.missed.length || gone.got.length) settle(g, gone, !counting && scoring(g));
  /* the mic's level */
  if (g.stream && g.level != null) {
    const bars = $("gg-mic")?.querySelectorAll(".gg-lv i") || [];
    const lv = Math.min(1, g.level * 40);
    bars.forEach((b, i) => b.style.height = `${Math.round(5 + lv * 16 * (0.6 + 0.4 * Math.sin(i * 1.7 + g.clock() * 9)))}px`);
  }
}

/* Wait for me (4.54.0): the song holds on the chord at the reading line until you play it (or skip it) */
function holdFrame(g, counting) {
  const c = g.catch, t = c.targets[c.cur];
  const want = waitOn(g.song) && !!g.stream && scroll.on && !counting && !g.paused && g.idx >= 0 && performance.now() > g.dragUntil
    && t && !!chordNotes(t.name) && !c.caught[c.cur] && g.skip !== c.cur;
  const pill = waitOn(g.song) && !!g.stream;
  if (want && !g.holding) {
    g.holding = true; g.waited = true;
    holdScroll(true, g.song);
    stageWait(t.first);
    const card = $("gg-wait");
    card.innerHTML = `<span class="gw-t"><b>Waiting for ${esc(t.name)}</b><small>The song moves on when you play it.</small></span>${chordSVG(t.name, 1) ? `<span class="gw-s" role="img" aria-label="${esc(t.name)} chord shape">${chordSVG(t.name, 1)}</span>` : ""}`;
    card.hidden = false; $("gg-skip").hidden = false; $("gg-shape").hidden = true;
    $("gg-live").textContent = `Waiting for ${t.name}`;
    paintScore();
  } else if (!want && g.holding) {
    g.holding = false;
    holdScroll(false, g.song);
    stageWait(-1);
    $("gg-wait").hidden = true; $("gg-skip").hidden = true; $("gg-live").textContent = "";
    paintScore(); paintShape();
  }
  $("gg-wpill").hidden = !pill;
}

/* Is the show counting chords right now? On with the mic, playing, past the count-in and not being dragged */
function scoring(g) {
  return !!g.stream && scroll.on && !document.querySelector(".countin") && performance.now() > g.dragUntil && !g.paused;
}
const placesOf = (g, i) => { const t = g.catch.targets[i], out = []; for (let k = t.first; k <= t.last; k++) out.push(k); return out; };
const pairOf = (g, i) => i > 0 ? `${g.catch.targets[i - 1].name}>${g.catch.targets[i].name}` : null;
/* a chord caught: it turns green and stays green */
function caught(g, i) {
  catchScore(g.score, true);
  const pair = pairOf(g, i); if (pair) g.landed[pair] = (g.landed[pair] || 0) + 1; /* Your changes (4.23.0) */
  g.got.add(i);
  stageCatch(placesOf(g, i));
  afterScore(g);
}
/* chords that went by: the ones with no shape that something was heard through are caught; the rest are missed
   (never on a sheet whose chords are a guess, and not while dragging or without the mic) */
function settle(g, gone, on) {
  for (const i of gone.got) if (on) caught(g, i);
  if (!on) return;
  for (const i of gone.missed) {
    if (g.got.has(i)) continue;
    if (g.guess) continue;
    catchScore(g.score, false);
    const pair = pairOf(g, i); if (pair) g.missed[pair] = (g.missed[pair] || 0) + 1; /* for Rehearse's soundcheck (4.8.0) */
    g.miss.add(i);
    stageMiss(placesOf(g, i));
  }
  if (gone.missed.length) afterScore(g);
}
function afterScore(g) {
  paintScore();
  const flashEl = $("gg-combo"); if (flashEl) { flashEl.classList.remove("hit"); void flashEl.offsetWidth; flashEl.classList.add("hit"); }
  /* 4.44.0 (#78): a combo of 10, 25, 50 or 100 bursts over the show, once each per show */
  if (COMBO_STEPS.includes(g.score.combo) && g.comboShown !== g.score.combo) { g.comboShown = g.score.combo; callout(data, { kind: "combo", word: "COMBO", big: `x${g.score.combo}` }); }
}

/* A finger moves the song (4.2.2): the page itself scrolls under the see-through show (4.51.0). Changes
   passed while dragging aren't graded. */
function bindDrag(g) {
  const drag = () => { g.dragUntil = performance.now() + 700; };
  addEventListener("touchmove", drag, { passive: true });
  addEventListener("wheel", drag, { passive: true });
  document.addEventListener("stage-jump", drag); /* the rail's jump (4.54.0): the chords it skips aren't counted */
  g.unbind = () => { removeEventListener("touchmove", drag); removeEventListener("wheel", drag); document.removeEventListener("stage-jump", drag); };
}

/* Controls that hide (4.60.0, Graham, 2026-10-24): while the song plays, the X, the mic button and Pause fade after
   3 seconds without a touch, as in Apple Music. A touch brings them back; that first touch only wakes them, it never
   presses one. Paused, counting in, waiting for a chord, a sheet open, or the end card: always shown. */
function bindIdle(g) {
  g.touch = performance.now();
  const wake = e => {
    if (!g.el?.classList.contains("idle")) { g.touch = performance.now(); return; }
    g.touch = performance.now();
    g.el.classList.remove("idle");
    if (e.type === "pointerdown") g.swallow = performance.now() + 600; /* the tap that wakes is not a pause or a press */
  };
  const evs = ["touchstart", "pointerdown", "wheel", "keydown", "focusin"];
  evs.forEach(ev => addEventListener(ev, wake, { passive: true, capture: true }));
  const eat = e => { if (g.swallow && performance.now() < g.swallow) { g.swallow = 0; e.stopImmediatePropagation(); e.preventDefault(); } };
  document.addEventListener("click", eat, true);
  g.idleT = setInterval(() => {
    if (gig !== g) return;
    const ok = scroll.on && !g.paused && !g.holding && !g.credited && !g.ended && !g.el.classList.contains("done") && !document.querySelector(".countin, .menu, .st-open");
    if (!ok) g.el.classList.remove("idle");
    else if (performance.now() - g.touch > 3000) g.el.classList.add("idle");
  }, 400);
  g.unbindIdle = () => { clearInterval(g.idleT); document.removeEventListener("click", eat, true); evs.forEach(ev => removeEventListener(ev, wake, { capture: true })); };
}

/* ---- open, pause, close ---- */
export function openGig(song, opts = {}) {
  closeGig(true);
  const audio = sound();
  const g = gig = {
    song, encore: !!opts.encore, from: opts.from || "song", score: gigStart(), catch: null, seqLen: 0, got: new Set(), miss: new Set(), b: -1, idx: -1, gel: "", mood: "", dragUntil: 0, missed: {}, landed: {},
    audio, clock: () => audio ? audio.currentTime : performance.now() / 1000, stream: null, ended: false, paused: false
  };
  /* 4.41.0: chords spread over the lines as a guess are never counted as misses, only as hits */
  g.guess = liningDue(song) === "guess";
  g.el = shell(song);
  stageStart();
  document.body.classList.add("gigging");
  gigHooks.on = true;
  gigHooks.band = bandParts(data); /* Your band (4.7.0): drums once Beat has joined */
  gigHooks.credited = () => { if (gig === g) g.credited = true; };
  gigHooks.stopped = () => { if (gig !== g) return; if (g.credited) showComplete(); else if (!g.leaving) paused(true); };
  gigHooks.resume = () => { if (gig === g) resume(); };
  gigHooks.leave = () => { if (gig === g) leave(); };
  $("gg-pause").onclick = () => { if (scroll.on) stopScroll(); else resume(); };
  $("gg-skip").onclick = () => { if (g.catch && g.holding) g.skip = g.catch.cur; };
  $("gg-mic").onclick = () => { if (g.stream) deafen(g); else if (!g.asking) listen(g); };
  bindDrag(g);
  bindIdle(g);
  g.known = knownChords(data);
  paintMic(); paintScore();
  /* Score my plays (Settings > Playing) decides whether a show starts listening. */
  /* Opening night (4.40.0): the first verse waits for Count me in; Not now on the microphone plays unscored */
  const waits = gigOpen(g, g.el, () => { if (gig === g && !scroll.on) startScroll(song); });
  if (data.settings.gigScore !== false && !g.noMic) listen(g); else { g.off = true; paintMic(); }
  g.raf = requestAnimationFrame(frame);
  if (!scroll.on && !waits) startScroll(song);
}
function paused(on) {
  const g = gig;
  if (!g) return;
  g.paused = on;
  gigHooks.held = on;
  g.el.classList.toggle("paused", on);
  document.body.classList.toggle("held", on);
  document.body.classList.toggle("staged", !on);
  $("gg-pause").setAttribute("aria-label", on ? "Play on" : "Pause");
  g.holdSay = on ? gigPaused(g) : "";
  paintHold();
}
/* Louie's line on pause (Opening night's "Tap Resume"), just above Play; nothing when there's nothing to say */
function paintHold() {
  const g = gig;
  $("gg-say")?.remove();
  if (!g?.holdSay) return;
  const el = document.createElement("div");
  el.className = "held-say"; el.id = "gg-say";
  const dock = document.querySelector(".app.viewer .dock .pw, .app.viewer .dock"), top = dock?.getBoundingClientRect().top;
  el.style.bottom = (top > 0 ? innerHeight - top + 12 : 110) + "px";
  el.innerHTML = `<span id="gg-hlouie">${louie("happy", { size: 56 })}</span><p id="gg-hsay">${esc(g.holdSay)}</p>`;
  document.body.appendChild(el);
}
function resume() { const g = gig; if (!g) return; document.querySelector(".menu")?.remove(); paused(false); g.holdSay = ""; startScroll(g.song); gigResumed(g); }
/* Leave the show (X, or Tools for anything but its switches): the song stays open, paused where it was */
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
  g.unbind?.(); g.unbindIdle?.();
  stageClear();
  document.body.classList.remove("gigging");
  hideStrip();
  $("gg-say")?.remove(); document.body.classList.remove("held");
  gigHooks.on = false; gigHooks.held = false; gigHooks.band = null; gigHooks.credited = null; gigHooks.stopped = null; gigHooks.resume = null; gigHooks.leave = null;
  document.querySelector(".menu.tools")?.remove();
  if (!quiet && g.from === "road") go("#/");
}
onLeave(() => closeGig(true));

/* ---- Show complete ---- */
/* The song you played (4.54.0): every chord of the song by section, filled green if you caught it, outlined if it went by */
function songPlayed(g) {
  if (!g.catch) return "";
  const secs = sections(), seq = diag.seq || [], groups = [];
  g.catch.targets.forEach((t, i) => {
    const y = seq[t.first]?.y ?? 0; let sec = null;
    for (const x of secs) if (x.y <= y + 1) sec = x;
    const key = sec ? sec.y : -1, last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(i); else groups.push({ key, name: sec?.name || "", gel: sec?.gel || "verse", items: [i] });
  });
  const chip = i => { const name = g.catch.targets[i].name, got = g.got.has(i), miss = g.miss.has(i); return `<li class="gc-ch ${got ? "got" : miss ? "miss" : "skip"}" aria-label="${esc(name)}, ${got ? "caught" : miss ? "missed" : "not counted"}">${esc(name)}</li>`; };
  return `<section class="gc-song"><h3>The song you played</h3>${groups.map(x => `<div class="gc-sec"><b class="gl-${x.gel}">${esc(x.name || "SONG").toUpperCase()}</b><ul>${x.items.map(chip).join("")}</ul></div>`).join("")}</section>`;
}

function showComplete() {
  const g = gig;
  if (!g || g.ended) return;
  g.ended = true;
  cancelAnimationFrame(g.raf);
  clearInterval(g.timer);
  g.stream?.getTracks().forEach(t => t.stop());
  if (g.catch) { g.catch.cur = g.catch.targets.length; settle(g, catchClose(g.catch), !!g.stream); } /* the chords still waiting to be judged */
  const graded = g.score.hits + g.score.misses > 0;
  const { fans, pct, request, battle, cover, duel, doubled } = gigDone(data, g.song.id, g.score, g.encore, Date.now(), !!g.waited);
  rehearseMisses(data, g.missed, Date.now(), g.landed); /* the changes you dropped (tomorrow's soundcheck) and landed (Your changes) */
  const earned = questsSettle(data); /* Tour quests: tonight's setlist and the month's tour */
  const joined = bandMeet(data); /* Your band: who joined with this show */
  const tip = merchTip(data); /* the Merch table (4.14.0): something you can now afford, said once */
  const opened = gigDoneHere(); /* Opening night's last step */
  if (opened) g.from = "road";
  Tabs.save(data);
  const st = streakOf(playSongs(data)), ps = playableSongs(data);
  const crowd = graded ? gigCrowd(g.score) : null;
  const tile = (lab, val, cls) => `<div class="gc-tile ${cls}"><small>${lab}</small><b>${val}</b></div>`;
  const played = graded ? songPlayed(g) : "";
  const worst = Object.entries(g.missed).sort((a, b) => b[1] - a[1])[0], [wa, wb] = worst ? worst[0].split(">") : [];
  const drill = worst && chordSVG(wa, 1) && chordSVG(wb, 1);
  g.el.classList.remove("paused"); document.body.classList.remove("held"); gigHooks.held = false; $("gg-say")?.remove();
  g.el.classList.add("done");
  g.el.innerHTML = `<div class="gc">
    <div class="gc-hero" id="gc-hero">${backdropBanner(backdropsOwned().find(x => x.on)?.id)}
      <div class="gc-conf" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${joined.length ? `<div class="gc-join">${joined.map(f => friend(f.id, { size: 120, mood: "cheer" })).join("")}${louie("cheer", { pose: "hornsUp", size: 120 })}</div>` : louie("cheer", { pose: "hornsUp", size: 170 })}
      <button class="gc-bdc" id="gc-bdc" aria-haspopup="true">${icon("image")}<span>${esc(backdropsOwned().find(x => x.on)?.name || "Basement")} · Change</span></button>
    </div>
    <div class="gc-bds" id="gc-bds" role="group" aria-label="Backdrops you own" hidden></div>
    <h2 class="gc-t">${g.encore ? "Encore complete!" : "Show complete!"}</h2>
    <p class="gc-s">${esc(g.song.title)}, start to finish.${crowd >= 10 ? " The crowd wants more." : ""}</p>
    <div class="gc-tiles">${tile("FANS", `+${fans + 10 + earned.reduce((n, x) => n + x.fans, 0)}`, "fans")}${tile("CROWD", crowd === null ? "–" : `${crowd}/12`, "crowd")}${tile("CHORDS", graded ? `${g.score.hits} of ${g.score.hits + g.score.misses}` : "–", "beat")}</div>
    ${played}
    ${worst ? `<div class="gc-worst"><span><small>MISSED MOST</small><b>${esc(wa)} to ${esc(wb)}, ${worst[1]} time${worst[1] === 1 ? "" : "s"}</b></span>${drill ? `<button class="btn sm" id="gc-drill">Practice it</button>` : ""}</div>` : ""}
    <div class="gc-list">
      ${graded ? `<p><b>${g.score.hits}</b> of ${g.score.hits + g.score.misses} chords caught${g.score.best >= 3 ? `, best run <b>${g.score.best}</b>` : ""}</p>` : g.guess && !g.off ? `<p>The chords in this song are still a best guess, so a chord you missed wasn't counted. It still counts as a play.</p>` : `<p>The microphone was off, so this show wasn't scored. It still counts as a play.</p>`}
      ${g.waited ? `<p>Wait for me: a practice show. It gives fans, but no chart points, rival battle or duel.</p>` : ""}
      ${battle ? `<p>${battle.result === "won" ? `Rival battle: you beat <b>${esc(battle.rival)}</b>, ${battle.pct}% to ${battle.target}%. <b>+30 XP, +40 fans</b>` : `Rival battle: ${esc(battle.rival)} held on, ${battle.target}% to your ${battle.pct}%`}</p>` : ""}
      ${joined.map(f => { const n = FRIENDS.find(x => x.id === f.id)?.name || f.id; return `<p><b>${esc(n)} joined your band!</b>${f.plays ? ` You'll hear drums in your gigs.` : ""}</p>`; }).join("")}
      ${duel ? `<p>Song duel: ${duel.mine.pct > duel.theirs.pct ? `<b>you beat ${esc(duel.opp)}</b>` : duel.mine.pct < duel.theirs.pct ? `${esc(duel.opp)} wins this one` : "a tie"}, ${duel.mine.pct}% to ${duel.theirs.pct}%</p>` : ""}
      ${doubled !== undefined ? `<p>Double set: <b>2x XP</b> on this show. ${doubled ? `${doubled} more to go.` : "That was the last one."}</p>` : ""}
      ${cover ? `<p>Cover quest done: you learned a song you love. <b>3x bonus fans</b></p>` : ""}
      ${request ? `<p>Request line: a fan asked for this one. <b>2x bonus fans</b></p>` : ""}
      ${opened ? `<p><b>Opening night: done!</b> Your streak starts tonight.</p>` : ""}
      ${earned.map(x => `<p>${esc(x.label)}: <b>+${x.fans} fans</b></p>`).join("")}
      ${ps.of ? `<p>You can play <b>${ps.now} of your ${ps.of}</b> songs</p>` : ""}
      ${st.days ? `<p>Gig streak: <b>${st.days} night${st.days === 1 ? "" : "s"}</b></p>` : ""}
    </div>
    ${tip ? `<button class="gc-merch" id="gc-merch">${tip.kind === "louie" ? `<span class="fin fin-${tip.id}">${louie("happy", { size: 46 })}</span>` : `<span class="gc-merch-ic" aria-hidden="true">${icon("shirt")}</span>`}<span><b>You can get ${esc(tip.kind === "louie" ? `${tip.name} Louie` : `the ${tip.name} backdrop`)}</b><small>${tip.price.toLocaleString("en-US")} fans at the merch table</small></span>${icon("chev", "chev")}</button>` : ""}
    ${duel ? `<section class="gc-duel"><small>SONG DUEL</small><b>Send ${esc(duel.opp)} your score</b><button class="btn primary" id="gc-reply">SEND YOUR SCORE BACK</button></section>`
      : pct !== null ? `<section class="gc-duel"><small>CHALLENGE A FRIEND</small><b>"I hit ${pct}% on ${esc(g.song.title)}. Beat it."</b><button class="btn primary" id="gc-duel">SEND THE CHALLENGE</button></section>` : ""}
    <div class="gc-acts">
      ${g.encore ? "" : `<button class="btn primary" id="gc-encore">ENCORE · 2x BONUS FANS</button>`}
      <button class="btn" id="gc-go">CONTINUE</button>
    </div></div>`;
  /* 4.66.0: Continue stays on the song page; its Back goes to where the show was started from */
  $("gc-go").onclick = () => { closeGig(true); if (opened) { homeHooks.openDrawer = false; go("#/"); } else redraw?.(); }; /* Opening night's end goes on to the Road */
  $("gc-merch")?.addEventListener("click", () => { closeGig(true); go("#/merch"); });
  /* 4.66.0: the backdrop you wear is the banner; Change lists the ones you own, and the merch table */
  $("gc-bdc").onclick = () => {
    const box = $("gc-bds");
    if (!box.hidden) { box.hidden = true; return; }
    box.innerHTML = backdropsOwned().map(x => `<button class="chip${x.on ? " on" : ""}" data-bd="${x.id}" aria-pressed="${x.on}">${esc(x.name)}</button>`).join("") + `<button class="chip" data-bd="">More at the merch table</button>`;
    box.hidden = false;
    box.onclick = e => {
      const b = e.target.closest("[data-bd]");
      if (!b) return;
      if (!b.dataset.bd) { closeGig(true); go("#/merch"); return; }
      wearBackdrop(b.dataset.bd);
      const on = backdropsOwned().find(x => x.on);
      $("gc-hero").querySelector(".gc-bd").outerHTML = backdropBanner(on?.id);
      $("gc-bdc").querySelector("span").textContent = `${on?.name || "Basement"} · Change`;
      box.hidden = true;
    };
  };
  $("gc-drill")?.addEventListener("click", () => { closeGig(true); go("#/practice/" + encodeURIComponent(`s:${wa}-${wb}`)); });
  $("gc-duel")?.addEventListener("click", e => import(`./duel.js?v=${VERSION}`).then(m => m.sendChallenge(g.song, { pct, combo: g.score.best, crowd: graded ? gigCrowd(g.score) : 0 }, e.currentTarget)));
  $("gc-reply")?.addEventListener("click", e => import(`./duel.js?v=${VERSION}`).then(m => m.sendReply(duel, e.currentTarget)));
  $("gc-encore")?.addEventListener("click", () => {
    const song = g.song, from = g.from;
    closeGig(true);
    window.scrollTo(0, 0);
    setTimeout(() => { if (viewing?.id === song.id) openGig(song, { encore: true, from }); }, 120);
  });
}
