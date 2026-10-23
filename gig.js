// The Gig (4.1.0): a song played as a scored show. It sits over the song page while the song plays
// as it always does underneath (auto-scroll, the recording or the band, a play counted at the end),
// and reads where the song is from the page.
//
//   top       Close, the song map lit by section (Stage Gels, also the progress bar), the combo (a word
//             flashes beside it when a change lands early or late), your strings
//   status    the section you're in, in its colour, and the crowd as a row of 12 that fills up
//   lines     words first (4.43.0): the song's lines fill the screen, the one you're on brightest. The chord
//             you're on lights up over its word; the next one is yellow, counted in by a dot a beat on its
//             left (4.49.7). The line you're on sits on a band with a sweep that reaches each chord as it
//             comes. A chord played again in a row shows once. A small shape for a chord you haven't learned.
//             With no words (an intro, a solo), the big Now and Next cards show instead.
//   moments   Louie and the crowd pop in for a combo milestone or a full crowd, then go
//   bottom    Hearing you (tap to stop or start listening for this show) and Pause, in thumb reach
// Paused, the show dims in place: the line you stopped on, Louie, and in thumb reach Back a line,
// Tools, Sheet (leave the show for the song page) and a big Resume (4.2.0).
// The microphone hears your strums; each chord change is landed by a strum near it (gigChange in
// core.js). Without the microphone the show still plays and counts; nothing is graded.
// At the end: Show complete, with the bonus fans, the crowd and how many changes landed, and Encore
// (play it again for double bonus fans).
import { COMBO_STEPS, VERSION, gigStart, COUNT_DOTS, countLit, onBeat, lineFrac, gigChord, GIG_LATE, chromaOf, gigCrowd, knownChords, gigDone, gelOf, questsSettle, bandParts, bandMeet, rehearseMisses, GIG_WINDOW, GIG_STRINGS, strumDetector, streakOf, playSongs, playableSongs, merchWorn, merchTip, liningDue, Tabs } from "./core.js";
import { backdropArt } from "./merch.js";
import { metro } from "./audio.js";
import { esc, icon, sound, onLeave } from "./ui.js";
import { data, diag, scroll, viewing, READ_AT, startScroll, stopScroll, musicClock, usesMusic, chordTimes, pxPerSecond, isLine, beatSecs, gigHooks, go, chordSVG, homeHooks, openTools, redraw } from "./app.js";
import { louie } from "./louie.js";
import { callout } from "./callout.js";
import { friend, FRIENDS } from "./friends.js";
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
  /* 4.46.0: what the strum sounded like, read a moment after it (once the chord rings) */
  const sp = ctx.createAnalyser(); sp.fftSize = 16384; sp.smoothingTimeConstant = 0;
  guitarBand(ctx, g.src).connect(sp);
  const spec = new Float32Array(sp.frequencyBinCount);
  const buf = new Float32Array(an.fftSize), hear = strumDetector();
  g.timer = setInterval(() => {
    an.getFloatTimeDomainData(buf);
    let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
    g.level = rms;
    const now = g.clock();
    if (hear(rms, now, 0)) {
      g.strums.push(now); while (g.strums.length && now - g.strums[0] > 6) g.strums.shift();
      const h = { t: now, chroma: null }; g.heard.push(h); while (g.heard.length && now - g.heard[0].t > 8) g.heard.shift();
      setTimeout(() => { if (gig !== g || !g.stream) return; sp.getFloatFrequencyData(spec); h.chroma = chromaOf(spec, ctx.sampleRate, sp.fftSize); }, 140);
    }
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
  /* how far through the line you're on: the page's chords come along a line by how far across they sit (chordYs) */
  let nb = b + 1; while (nb < diag.blocks.length && !isLine(diag.blocks[nb].el)) nb++;
  const frac = lineFrac(line - top, diag.blocks[b].y, diag.blocks[nb]?.y ?? diag.blocks[b].y + 40);
  return { b, sec, idx, next, until, frac, progress: Math.max(0, Math.min(1, (line - top) / end)) };
}

/* ---- the screen ---- */
const PLUG = `<svg width="22" height="24" viewBox="0 0 30 32" aria-hidden="true"><rect x="6" y="6" width="18" height="22" rx="6" fill="var(--strings-deep)"/><rect x="5" y="4" width="18" height="22" rx="6" fill="var(--strings)"/><rect x="10" y="0" width="3" height="6" rx="1.5" fill="var(--muted)"/><rect x="15" y="0" width="3" height="6" rx="1.5" fill="var(--muted)"/></svg>`;

function shell(song) {
  const el = document.createElement("div");
  el.id = "gig"; el.className = "gig"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `Gig: ${song.title}`);
  el.innerHTML = `${backdropArt(merchWorn(data, "backdrop"))}<div class="gg-light" aria-hidden="true"></div>
    <div class="gg-top">
      <button class="gg-x" id="gg-x" aria-label="Leave the gig">${icon("x")}</button>
      <div class="gg-map" id="gg-map" aria-hidden="true"></div>
      <span class="gg-combo" id="gg-combo"></span><b class="gg-tw" id="gg-tw" aria-live="polite"></b>
      <span class="gg-str" id="gg-str" aria-label="Strings">${PLUG}<b>${GIG_STRINGS}</b></span>
    </div>
    <div class="gg-status"><span class="gg-sec" id="gg-sec">Get ready</span><span class="gg-cap">CROWD</span><span class="gg-fans" id="gg-fans" role="img" aria-label="Crowd"></span></div>
    <div class="gg-chords" aria-hidden="true">
      <div class="gg-now" id="gg-now"><small>NOW</small><b id="gg-nowname"></b><div id="gg-nowdg"></div></div>
      <div class="gg-next"><small>NEXT</small><b id="gg-nextname"></b>${dots(dotsN(song), "gg-beats", "gg-beats")}</div>
    </div>
    <div class="gg-lines sheet" id="gg-lines"></div>
    <div class="gg-shape" id="gg-shape" hidden></div>
    <div class="gg-moment" id="gg-moment" hidden></div>
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

/* Words first (4.43.0): the lines from two back to as many as fit, the one you're on brightest. Each clone
   keeps its chords in order, so the chord you're on and the next one can be lit in place. */
/* the count-in: a dot a beat, as many as the bar has (up to four), on the chord's left so you read into it */
const dotsN = song => Math.min(COUNT_DOTS, Math.max(2, song.beats || COUNT_DOTS));
const dots = (n, cls, id = "") => `<span class="${cls}"${id ? ` id="${id}"` : ""} aria-hidden="true">${"<i></i>".repeat(n)}</span>`;
function paintLines(w) {
  const box = $("gg-lines"), g = gig;
  if (!box || !g) return;
  const seq = diag.seq || [], at = new Map(seq.map((c, i) => [c.el, i]));
  const lines = [];
  for (let i = 0; i < diag.blocks.length; i++) if (isLine(diag.blocks[i].el)) lines.push(i);
  const here = Math.max(0, lines.findIndex(i => i >= w.b));
  g.lineMap = new Map();
  const out = lines.slice(Math.max(0, here - 2), here + 12).map(i => {
    const el = diag.blocks[i].el, c = el.cloneNode(true);
    c.classList.remove("cur", "cur2", "focus");
    c.querySelectorAll(".now, .sel").forEach(x => x.classList.remove("now", "sel"));
    c.removeAttribute("id");
    c.classList.add(...(i < w.b ? ["gl-past"] : i === lines[here] ? ["gl-now"] : i === lines[here + 1] ? ["gl-soon", "gl-next"] : ["gl-soon"]));
    if (i === lines[here]) c.insertAdjacentHTML("beforeend", '<span class="gl-sweep" aria-hidden="true"></span>');
    /* a chord played again in a row shows once */
    const oc = [...el.querySelectorAll(".c[data-ch]")], cc = [...c.querySelectorAll(".c[data-ch]")];
    oc.forEach((o, k) => { const n = at.get(o); if (n > 0 && seq[n - 1].name === seq[n].name) cc[k]?.classList.add("gc-rep"); });
    g.lineMap.set(el, { clone: c, oc, cc });
    return c;
  });
  box.replaceChildren(...out);
  if (!out.length) box.innerHTML = '<p class="gg-end">That\'s the end of the song.</p>';
  /* the lines step up into place rather than jump */
  if (g.stepped) { box.classList.remove("step"); void box.offsetWidth; box.classList.add("step"); }
  g.stepped = true;
  g.sweep = box.querySelector(".gl-sweep"); g.frac = -1;
  g.lit = -2; g.lnext = -2;
}
/* light the chord you're on and the next one, in the lines on screen */
function cloneOf(seqIdx) {
  const g = gig, c = diag.seq?.[seqIdx];
  if (!g?.lineMap || !c) return null;
  for (const v of g.lineMap.values()) { const k = v.oc.indexOf(c.el); if (k >= 0) return v.cc[k] || null; }
  return null;
}
function paintLit(w) {
  const g = gig, box = $("gg-lines");
  if (!g || !box || (w.idx === g.lit && w.next === g.lnext)) return;
  g.lit = w.idx; g.lnext = w.next;
  /* with no words to read (an intro, a solo: a row of chords alone), the big Now and Next show */
  g.el.classList.toggle("bigc", !!diag.seq?.[w.idx]?.el?.closest(".crow"));
  box.querySelectorAll(".gc-lit, .gc-next").forEach(e => e.classList.remove("gc-lit", "gc-next"));
  box.querySelectorAll(".gc-dots").forEach(e => e.remove());
  box.querySelectorAll(".gc-tight").forEach(e => e.classList.remove("gc-tight"));
  /* a chord played again in a row shows once, so the one lit is where the run began */
  let from = w.idx; const q = diag.seq || [];
  while (from > 0 && q[from - 1].name === q[from].name) from--;
  cloneOf(from)?.classList.add("gc-lit");
  const nx = cloneOf(w.next);
  if (nx) {
    nx.classList.add("gc-next"); nx.insertAdjacentHTML("afterbegin", dots(g.dotsN, "gc-dots"));
    /* no room on the left (a chord just before it on the line): the count sits over the chord instead */
    const d = nx.querySelector(".gc-dots").getBoundingClientRect(), top = nx.getBoundingClientRect().top;
    const crowd = [...(nx.closest(".pr, .crow")?.querySelectorAll(".c:not(.gc-rep)") || [])]
      .filter(c => c !== nx && c.compareDocumentPosition(nx) & 4 /* nx follows c */)
      .map(c => c.querySelector(".ct")?.getBoundingClientRect()).filter(r => r && Math.abs(r.top - top) < 6);
    if (crowd.some(r => r.right + 6 > d.left) || d.left < box.getBoundingClientRect().left) nx.classList.add("gc-tight");
  }
  g.beats = -1;
}
/* a small shape for a chord you haven't learned yet, beside the lines */
function paintShape(name) {
  const g = gig, el = $("gg-shape");
  if (!g || !el) return;
  const show = name && !g.known.has(name) && chordSVG(name, 1) && !g.el.classList.contains("bigc");
  if (!show) { el.hidden = true; return; }
  if (el.dataset.ch !== name) { el.dataset.ch = name; el.innerHTML = `<small>NEW CHORD</small><b>${esc(name)}</b>${chordSVG(name, 1)}`; }
  el.hidden = false;
}
/* Louie and the crowd show up for a moment, then go */
const MILESTONES = [5, 10, 15, 20, 30, 40, 50, 75, 100];
function moment(text, sub) {
  const el = $("gg-moment");
  if (!el || !gig) return;
  el.innerHTML = `${louie("cheer", { pose: "hornsUp", size: 54 })}<span><b>${esc(text)}</b>${sub ? esc(sub) : ""}</span>`;
  el.hidden = false; el.classList.remove("go"); void el.offsetWidth; el.classList.add("go");
  clearTimeout(gig.momentT); gig.momentT = setTimeout(() => { el.hidden = true; }, 2600);
}

function paintScore() {
  const g = gig;
  if (!g) return;
  const crowd = g.stream ? gigCrowd(g.score) : 0;
  const fans = $("gg-fans");
  fans.innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${g.stream && i < crowd ? "on c" + (i % 4) : ""}" style="height:${12 + (i * 7) % 10}px"></i>`).join("");
  fans.setAttribute("aria-label", !g.stream ? "Crowd: listening is off" : `Crowd: ${crowd} of 12 on their feet`);
  $("gg-combo").textContent = g.score.combo >= 2 ? `x${g.score.combo}` : "";
  $("gg-str").querySelector("b").textContent = g.score.strings;
  $("gg-str").setAttribute("aria-label", `Strings ${g.score.strings} of ${GIG_STRINGS}`);
  if (g.stream && MILESTONES.includes(g.score.combo) && g.said !== g.score.combo) { g.said = g.score.combo; moment(`${g.score.combo} in a row!`, crowd >= 12 ? "The whole crowd is up." : "Keep it going."); }
  else if (g.stream && crowd >= 12 && !g.fullSaid) { g.fullSaid = true; moment("The whole crowd is up!", ""); }
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
  gigFrame(g, w.sec, scroll.on && !counting);
  /* the lines */
  if (w.b !== g.b) { g.b = w.b; paintLines(w); if (g.paused) paintHold(); }
  paintLit(w);
  /* chords */
  const seq = diag.seq || [];
  if (w.idx >= 0 && w.idx !== g.idx) {
    const name = seq[w.idx].name, prev = g.idx >= 0 ? seq[g.idx]?.name : null;
    g.idx = w.idx;
    $("gg-nowname").textContent = name;
    $("gg-nowdg").innerHTML = chordSVG(name, 1.35);
    paintShape(name);
    /* a change on stage: graded once its window has passed */
    if (scroll.on && !counting && prev && prev !== name && g.stream && performance.now() > g.dragUntil) g.due.push({ t: g.clock(), name, pair: `${prev}>${name}` });
  }
  $("gg-nextname").textContent = w.next >= 0 ? seq[w.next].name : seq.length ? "End" : "";
  /* the count-in, on the band's clicks when the band is playing, otherwise on the song's beat */
  const band = metro.timer && metro.spb > 0, spb = band ? metro.spb : beatSecs(song);
  const until = w.until == null ? null : band ? onBeat(g.clock() + w.until, metro.next, spb) - g.clock() : w.until;
  const lit = counting ? 0 : countLit(until, spb, g.dotsN);
  if (lit !== g.beats) {
    const up = lit > g.beats && g.beats >= 0;
    g.beats = lit;
    for (const box of document.querySelectorAll("#gg-beats, #gg-lines .gc-dots")) [...box.children].forEach((e, i) => { e.classList.toggle("on", i < lit); e.classList.toggle("pop", up && i === lit - 1); });
  }
  /* the sweep across the line you're on */
  if (g.sweep && Math.abs(w.frac - g.frac) > 0.002) { g.frac = w.frac; g.sweep.style.transform = `scaleX(${w.frac.toFixed(3)})`; }
  /* grade the changes whose window has passed */
  const now = g.clock();
  const graded = gradeDue(g, now);
  if (graded) paintScore();
  /* 4.44.0 (#78): a combo of 10, 25, 50 or 100 bursts over the show, once each per show */
  if (graded && COMBO_STEPS.includes(g.score.combo) && g.comboShown !== g.score.combo) { g.comboShown = g.score.combo; callout(data, { kind: "combo", word: "COMBO", big: `x${g.score.combo}` }); }
  /* the mic's level */
  if (g.stream && g.level != null) {
    const bars = $("gg-mic")?.querySelectorAll(".gg-lv i") || [];
    const lv = Math.min(1, g.level * 40);
    bars.forEach((b, i) => b.style.height = `${Math.round(5 + lv * 16 * (0.6 + 0.4 * Math.sin(i * 1.7 + now * 9)))}px`);
  }
}

/* Grade the changes whose time has passed: the right chord, any time up to GIG_LATE after the change (4.46.0);
   with Score the timing on, only a strum on the beat. `now` of Infinity grades what is left (the end of the show). */
function gradeDue(g, now) {
  const strict = !!data.settings.gigTime, wait = strict ? GIG_WINDOW : GIG_LATE;
  let any = false;
  while (g.due.length && now - g.due[0].t > wait) {
    const d = g.due.shift();
    if (g.guess && !g.heard.some(h => Math.abs(h.t - d.t) <= GIG_WINDOW)) continue;
    const r = gigChord(g.score, d.t, g.heard, d.name, strict);
    if (!r.hit) g.missed[d.pair] = (g.missed[d.pair] || 0) + 1; /* for Rehearse's soundcheck (4.8.0) */
    else g.landed[d.pair] = (g.landed[d.pair] || 0) + 1; /* and Your changes (4.23.0) */
    any = true;
    flash(r.hit, r.offset, r.star);
  }
  return any;
}

/* A finger moves the song (4.2.2): drag the lines, or the line you stopped on, and the page underneath
   moves with it; the show follows. Changes passed while dragging aren't graded. */
function bindDrag(g) {
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

/* 4.43.0: the timing bar folded into the combo: a word beside it when a change lands early or late */
function flash(hit, off = null, star = false) {
  for (const el of [$("gg-now"), $("gg-combo")]) { if (!el) continue; el.classList.remove("hit", "miss"); void el.offsetWidth; el.classList.add(hit ? "hit" : "miss"); }
  const tw = $("gg-tw");
  if (!tw || !gig) return;
  const word = !hit ? "" : star ? "\u2605" : off != null && off > 0 ? "LATE" : off != null && off < 0 ? "EARLY" : "";
  tw.textContent = word; tw.className = "gg-tw" + (word ? " on" : "");
  clearTimeout(gig.twT); if (word) gig.twT = setTimeout(() => { tw.textContent = ""; tw.className = "gg-tw"; }, 900);
}

/* ---- open, pause, close ---- */
export function openGig(song, opts = {}) {
  closeGig(true);
  const audio = sound();
  const g = gig = {
    song, encore: !!opts.encore, from: opts.from || "song", score: gigStart(), strums: [], heard: [], due: [], b: -1, idx: -1, beats: -1, gel: "", mood: "", dragUntil: 0, missed: {}, landed: {},
    audio, clock: () => audio ? audio.currentTime : performance.now() / 1000, stream: null, ended: false, paused: false
  };
  /* 4.41.0: chords spread over the lines as a guess are never counted as misses, only as hits */
  g.guess = liningDue(song) === "guess";
  g.dotsN = dotsN(song);
  g.el = shell(song);
  document.body.classList.add("gigging");
  gigHooks.on = true;
  gigHooks.band = bandParts(data); /* Your band (4.7.0): drums once Beat has joined */
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
  g.known = knownChords(data);
  paintMap(); paintMic(); paintScore();
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
  g.el.classList.toggle("paused", on);
  $("gg-hold").hidden = !on;
  $("gg-pause").setAttribute("aria-label", on ? "Play on" : "Pause");
  if (on) { g.holdSay = gigPaused(g); paintHold(); $("gg-resume").focus({ preventScroll: true }); }
}
/* Paused: the line you stopped on, and Louie keeping the crowd */
function paintHold() {
  const g = gig, box = $("gg-hline");
  if (!g || !box) return;
  const now = $("gg-lines")?.querySelector(".gl-now");
  const c = now?.cloneNode(true);
  c?.querySelectorAll(".gl-sweep, .gc-dots").forEach(e => e.remove());
  box.replaceChildren(...(c ? [c] : []));
  $("gg-hlouie").innerHTML = louie("happy", { size: 64 });
  $("gg-hsay").textContent = g.holdSay ? g.holdSay : g.score.combo >= 2 ? "Take a breath. The crowd's still with you, and your combo is held." : "Take a breath. The crowd's still here when you're ready.";
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
function resume() { const g = gig; if (!g) return; document.querySelector(".menu")?.remove(); paused(false); g.holdSay = ""; startScroll(g.song); gigResumed(g); }
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
  document.body.classList.remove("gigging");
  clearTimeout(g.momentT); clearTimeout(g.twT);
  hideStrip();
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
  gradeDue(g, Infinity); /* the changes still waiting to be judged */
  const graded = g.score.hits + g.score.misses > 0;
  const { fans, pct, request, battle, cover, duel, doubled } = gigDone(data, g.song.id, g.score, g.encore);
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
  g.el.classList.remove("paused");
  g.el.classList.add("done");
  g.el.innerHTML = `<div class="gc">
    <div class="gc-conf" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    ${joined.length ? `<div class="gc-join">${joined.map(f => friend(f.id, { size: 120, mood: "cheer" })).join("")}${louie("cheer", { pose: "hornsUp", size: 120 })}</div>` : louie("cheer", { pose: "hornsUp", size: 170 })}
    <h2 class="gc-t">${g.encore ? "Encore complete!" : "Show complete!"}</h2>
    <p class="gc-s">${esc(g.song.title)}, start to finish.${crowd >= 10 ? " The crowd wants more." : ""}</p>
    <div class="gc-tiles">${tile("FANS", `+${fans + 10 + earned.reduce((n, x) => n + x.fans, 0)}`, "fans")}${tile("CROWD", crowd === null ? "–" : `${crowd}/12`, "crowd")}${tile("RIGHT CHORDS", pct === null ? "–" : `${pct}%`, "beat")}</div>
    <div class="gc-list">
      ${graded ? `<p><b>${g.score.hits}</b> of ${g.score.hits + g.score.misses} changes landed${g.score.best >= 3 ? `, best combo <b>${g.score.best}</b>` : ""}</p>${g.score.stars ? `<p><b>${g.score.stars}</b> on the beat \u2605 (+${g.score.stars} fans)</p>` : ""}` : g.guess && !g.off ? `<p>The chords in this song are still a best guess, so a change you missed wasn't counted. It still counts as a play.</p>` : `<p>The microphone was off, so this show wasn't scored. It still counts as a play.</p>`}
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
  $("gc-go").onclick = () => { const from = g.from; closeGig(true); if (from === "road") { homeHooks.openDrawer = false; go("#/"); } else if (from === "tour" || from === "charts") go("#/" + from); else redraw?.(); };
  $("gc-merch")?.addEventListener("click", () => { closeGig(true); go("#/merch"); });
  $("gc-duel")?.addEventListener("click", e => import(`./duel.js?v=${VERSION}`).then(m => m.sendChallenge(g.song, { pct, combo: g.score.best, crowd: graded ? gigCrowd(g.score) : 0 }, e.currentTarget)));
  $("gc-reply")?.addEventListener("click", e => import(`./duel.js?v=${VERSION}`).then(m => m.sendReply(duel, e.currentTarget)));
  $("gc-encore")?.addEventListener("click", () => {
    const song = g.song, from = g.from;
    closeGig(true);
    window.scrollTo(0, 0);
    setTimeout(() => { if (viewing?.id === song.id) openGig(song, { encore: true, from }); }, 120);
  });
}
