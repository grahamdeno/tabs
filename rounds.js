// Play-along rounds (5.10.0): the screen of a song tour round and of its headline.
//
// The chords of one part of a real song (the whole song, at the headline) scroll toward a teal line on a horizontal
// rosewood neck, one strum on each beat of the bars with your chords; every other bar is a rest, and the music plays on.
// Louie listens at each marked strum for the chord, never for the timing (Graham, 2026-11-26): outside song tour rounds and
// chord lessons nothing listens. With no microphone a round counts when it is played through.
//   the music  the recording at the part's lined-up times when it is lined up (Apple Music or YouTube) and the speed is
//              100%; otherwise Louie's band at the song's tempo, scaled by the speed
//   listening  the same strum detector and chord check as the chord lessons (core/neck.js); a strum near a marked one
//              (from half a beat before to one beat after) is checked once, for the chord marked
//   passing    Louie heard at least 3 in 4 of the strums
import { CHORD_FIT, FANS, Tabs, journalRound, VERSION, chordSpots, chromaOf, nearStrum, parseBlocks, roundNext, roundPassed, roundPlan, roundSay, slotTimes, songPart, strumDetector, strumFit, songTourStops, tourPlayed, wholeSong, DEFAULT_BPM } from "./core.js";
import { esc, getMic, icon, onLeave, sound, toast } from "./ui.js";
import { drum, tempoFor } from "./audio.js";
import { musicClock, musicLead, pauseMusic, startMusic } from "./listen.js";
import { chordSVG, data, mmss, usesMusic } from "./app.js";
import { chordColor } from "./timeline.js";

/* 5.10.1: the strums spread out (34 px a beat was crowded) */
const PX_BEAT = 56, SPEEDS = [0.6, 0.8, 1];
let R = null; // the round on screen

const guitarBand = (ctx, src) => {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = "lowpass"; f.frequency.value = 1500; f.Q.value = 0.7; }
  src.connect(a); a.connect(b);
  return b;
};
const kicker = s => s.kind === "headline" ? "SONG TOUR · HEADLINE" : `SONG TOUR · ROUND ${s.n} OF ${s.of}`;

/* Open a round. `stop` is a song tour stop (kind "round" or "headline"); `onClose` runs when the screen closes. Call it from the
   tap that starts the round, so the phone lets the microphone and the sound start. */
export function openRound(stop, { onClose } = {}) {
  closeRound();
  const t = data.songTour?.legs?.[stop.tour], song = (data.songs || []).find(s => s.id === t?.song);
  if (!song) return toast("Get the song first");
  /* the tap: ask for the microphone and wake the sound before anything is awaited */
  let micP = null;
  try { sound({ mic: true }); micP = getMic(micOptions(song, stop.state === "done" ? 1 : 0.6)).catch(() => null); } catch { micP = Promise.resolve(null); }
  const el = document.createElement("div");
  el.className = "rnd"; el.id = "round"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", `${kicker(stop).replace("SONG TOUR · ", "").toLowerCase()}, ${stop.sub || ""}`);
  document.body.appendChild(el);
  document.getElementById("app")?.setAttribute("inert", "");
  R = { stop, song, el, onClose, speed: stop.state === "done" ? 1 : 0.6, micP, gen: 0 };
  begin();
}

/* With the recording playing (100% and a lined-up recording) the speaker is loud, so the phone cancels the echo; Louie's band
   keeps the plain settings. Decided from the speed and the song, so it can be asked for from the tap. */
const micOptions = (song, rate) => rate === 1 && usesMusic(song)
  ? { echoCancellation: true, noiseSuppression: false, autoGainControl: false }
  : { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
export function closeRound(done = false) {
  const r = R;
  if (!r) return;
  stopAll();
  R = null;
  r.el.remove();
  document.getElementById("app")?.removeAttribute("inert");
  r.onClose?.(done);
}
onLeave(() => closeRound());

function stopAll() {
  const r = R;
  if (!r) return;
  r.gen++;
  cancelAnimationFrame(r.raf); clearInterval(r.timer); clearTimeout(r.musicTimer);
  r.beat?.stop(); r.beat = null;
  if (r.recording) pauseMusic();
  r.stream?.getTracks().forEach(x => { try { x.stop(); } catch { /* already stopped */ } });
  r.stream = null;
  try { r.ctx?.state === "suspended" && r.ctx.resume(); } catch { /* closed */ }
}

/* (Re)start the round: lay it out, count in, run. */
async function begin() {
  const r = R;
  if (!r) return;
  stopAll();
  if (!r.micP) { try { sound({ mic: true }); r.micP = getMic(micOptions(r.song, r.speed)).catch(() => null); } catch { r.micP = Promise.resolve(null); } }
  const gen = ++r.gen, { stop, song } = r;
  const bpm = song.bpm || song.listen?.feel?.bpm || await Promise.race([tempoFor(song).then(() => song.bpm || 0), new Promise(ok => setTimeout(() => ok(0), 2500))]) || DEFAULT_BPM;
  if (R !== r || r.gen !== gen) return;
  const beats = song.beats || 4, rate = r.speed;
  const part = stop.kind === "headline" ? wholeSong(song.body, { bpm, beats }) : songPart(song.body, { bpm, beats });
  if (!part) { closeRound(); return toast("This song has no chords to play along with"); }
  const lined = rate === 1 && usesMusic(song) ? slotTimes(song, chordSpots(parseBlocks(song.body))) : null;
  const plan = roundPlan(part.bars, stop.chords, { bpm, beats, rate, times: lined });
  r.plan = plan; r.part = part; r.heard = new Set(); r.taken = new Set(); r.pending = []; r.paused = false; r.at = 0; r.bar = -1; r.finished = false;
  r.recording = plan.recorded && usesMusic(song);
  paint();
  /* the microphone: ready by now, or not allowed (then a round counts when it is played through) */
  const stream = await r.micP;
  if (R !== r || r.gen !== gen) { stream?.getTracks().forEach(x => x.stop()); return; }
  r.micP = null;
  const ctx = sound();
  r.ctx = ctx; r.stream = null; r.mic = false;
  if (ctx && stream) {
    try {
      const src = ctx.createMediaStreamSource(stream);
      const fast = ctx.createAnalyser(), spec = ctx.createAnalyser();
      fast.fftSize = 1024; spec.fftSize = 16384; spec.smoothingTimeConstant = 0;
      guitarBand(ctx, src).connect(fast); guitarBand(ctx, src).connect(spec);
      r.fast = fast; r.spec = spec; r.stream = stream; r.mic = true; r.hear = strumDetector();
      r.fb = new Float32Array(fast.fftSize); r.db = new Float32Array(spec.frequencyBinCount);
    } catch { stream.getTracks().forEach(x => x.stop()); }
  } else stream?.getTracks().forEach(x => x.stop());
  mark();
  if (!ctx) return;
  /* the count in, then the music */
  const spb = 60 / (bpm * rate), t0 = ctx.currentTime + 0.4;
  r.startAt = t0 + beats * spb; r.spb = spb; r.lag = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
  for (let i = 0; i < beats; i++) drum("tick", t0 + i * spb, i === 0 ? 1 : 0.6);
  if (r.recording) r.musicTimer = setTimeout(() => { if (R === r && r.gen === gen) { r.musicOn = true; startMusic(song, plan.start, 1); } }, Math.max(0, (r.startAt - ctx.currentTime) * 1000 - musicLead()));
  else {
    /* Louie's band: hi-hat ticks when the microphone is on (a drum would leak into it), the drums otherwise */
    let i = 0, t = r.startAt;
    const tick = () => { while (t < ctx.currentTime + 0.35 && t < r.startAt + plan.secs + 0.5) { if (r.mic) drum("tick", t, i % beats === 0 ? 1 : 0.6); else drum(i % beats === 0 ? "kick" : i % 2 ? "hat" : "snare", t, 0.7); i++; t += spb; } };
    tick(); const id = setInterval(tick, 40); r.beat = { stop: () => clearInterval(id) };
  }
  r.timer = setInterval(() => listen(r), 10);
  r.raf = requestAnimationFrame(function loop() { if (R !== r || r.gen !== gen) return; frame(r); r.raf = requestAnimationFrame(loop); });
}

/* where the round is, in seconds from its first bar (negative during the count in) */
function where(r) {
  const ctx = r.ctx;
  if (r.paused) return r.at;
  if (r.recording && r.musicOn) {
    const c = musicClock(r.song);
    if (c != null && c >= r.plan.start - 3) return c - r.plan.start;
    return Math.min(0, ctx.currentTime - r.startAt);
  }
  return ctx.currentTime - r.startAt - (r.recording ? 0 : r.lag);
}

/* the microphone, every 10 ms: a strum near a marked one is checked for its chord over the next moments */
function listen(r) {
  if (!r.mic || r.paused || !r.fast) return;
  const ctx = r.ctx, now = ctx.currentTime, h = where(r);
  r.fast.getFloatTimeDomainData(r.fb);
  let rms = 0; for (const v of r.fb) rms += v * v; rms = Math.sqrt(rms / r.fb.length);
  r.level = Math.max(rms, (r.level || 0) * 0.92); /* 5.15.0: the meter in the score pill */
  if (r.hear(rms, now, 0) && h > -r.plan.spb) {
    const id = nearStrum(r.plan.strums, h, r.plan.spb, r.taken);
    if (id >= 0) { r.taken.add(id); r.pending.push({ id, until: now + 0.4, best: 0 }); }
  }
  if (!r.pending.length) return;
  const open = rms > Math.max(0.004, (r.hear.floor() || 0) * 3);
  if (open) {
    r.spec.getFloatFrequencyData(r.db);
    const cr = chromaOf(r.db, ctx.sampleRate, r.spec.fftSize);
    if (cr) for (const p of r.pending) { const f = strumFit(cr, r.plan.strums[p.id].chord); if (f != null && f > p.best) p.best = f; }
  }
  r.pending = r.pending.filter(p => {
    if (now < p.until) return true;
    if (p.best >= CHORD_FIT) { r.heard.add(p.id); mark(); }
    return false;
  });
}

/* the highway, every frame */
function frame(r) {
  const h = where(r), plan = r.plan, ex = r.el;
  r.at = h;
  const track = ex.querySelector(".rnd-track");
  if (track) track.style.transform = `translateX(${(-h * PX_BEAT / plan.spb).toFixed(1)}px)`;
  const bi = h < 0 ? 0 : Math.max(0, plan.bars.findIndex((b, i) => h >= b.t && (i + 1 === plan.bars.length || h < plan.bars[i + 1].t)));
  const bar = plan.bars[bi];
  const ci = ex.querySelector(".rnd-ci");
  if (ci) ci.textContent = h < 0 ? String(Math.min(plan.beats, Math.ceil(-h / plan.spb))) : "";
  const prog = ex.querySelector(".rnd-prog i"); if (prog) prog.style.width = `${Math.max(0, Math.min(100, h / plan.secs * 100)).toFixed(1)}%`;
  ex.querySelectorAll(".rnd-blk, .rnd-nm").forEach(b => { const s = plan.strums[+b.dataset.s]; b.classList.toggle("past", h > s.t + 0.15); b.classList.toggle("now", Math.abs(h - s.t) < plan.spb * 0.35); });
  if (r.mic) { const lv = Math.min(4, Math.round(Math.sqrt((r.level || 0) / 0.08) * 4)); ex.querySelectorAll(".rnd-lv i").forEach((b, i) => b.classList.toggle("on", i < lv)); }
  if (bar && bi !== r.bar && h >= 0) {
    r.bar = bi;
    ex.querySelector(".rnd-say").textContent = roundSay(plan.bars, bi, plan.beats);
    const mineNow = plan.bars.slice(bi).find(b => b.mine) || bar;
    const shown = bar.mine ? bar.chord : mineNow.chord;
    ex.querySelector(".rnd-now").textContent = bar.mine ? bar.chord : "Rest";
    ex.querySelector(".rnd-shape").innerHTML = chordSVG(shown, 1.7, { named: false });
    ex.querySelector(".rnd-shape").setAttribute("aria-label", `${shown} chord shape`);
  }
  if (bar && h >= 0) {
    const beat = Math.min(plan.beats - 1, Math.floor((h - bar.t) / (bar.dur / plan.beats)));
    ex.querySelector(".rnd-next").textContent = roundNext(plan.bars, bi, beat, plan.beats);
  }
  if (h >= plan.secs && !r.finished) finish(r);
}

function mark() {
  const r = R;
  if (!r?.plan) return;
  const pill = r.el.querySelector(".rnd-heard");
  if (!pill) return;
  const n = r.heard.size, total = r.plan.strums.length;
  pill.querySelector("b").textContent = r.mic ? `${n}/${total}` : "";
  pill.hidden = !r.mic;
  pill.setAttribute("aria-label", `Louie heard ${n} of ${total} strums`);
  r.el.querySelectorAll(".rnd-blk").forEach(b => b.classList.toggle("heard", r.heard.has(+b.dataset.s)));
}

function finish(r) {
  r.finished = true;
  clearInterval(r.timer); r.beat?.stop(); r.beat = null; clearTimeout(r.musicTimer);
  if (r.recording) pauseMusic();
  /* a strum still being checked gets its answer */
  for (const p of r.pending) if (p.best >= CHORD_FIT) r.heard.add(p.id);
  r.pending = [];
  const n = r.heard.size, total = r.plan.strums.length, listened = r.mic;
  const passed = listened ? roundPassed(n, total) : true;
  let result = null;
  if (passed) {
    result = tourPlayed(data, r.stop);
    journalRound(data, r.plan.secs, Date.now(), !!result);
    if (result) result.fans = FANS.lesson;
    Tabs.save(data);
  }
  r.stream?.getTracks().forEach(x => { try { x.stop(); } catch { /* already stopped */ } }); r.stream = null;
  card(r, { n, total, listened, passed, result });
}

function card(r, { n, total, listened, passed, result }) {
  const nextStop = passed ? songTourStops(data, r.stop.tour).find(x => x.state === "now") || null : null;
  r.next = nextStop;
  const title = listened ? `Louie heard ${n} of ${total}` : "Louie wasn't listening";
  const sub = !listened ? "The microphone is off, so this round counts when you play it through."
    : passed ? (r.stop.kind === "headline" ? `${r.part && data.songTour.legs[r.stop.tour].pick?.title || "The song"} is Solid now and its chords count as yours.` : "That counts. Each round adds a chord.")
    : "Louie needs 3 in 4 to count a round. Nothing is lost.";
  const el = r.el.querySelector(".rnd-card");
  el.hidden = false;
  el.innerHTML = `<b role="status">${esc(title)}</b><p>${esc(sub)}</p>${result?.fans ? `<div class="rd-earn"><span>+${result.fans} fans</span></div>` : ""}
    ${passed ? `<button class="btn primary" data-rnd="next">${nextStop ? "Next" : "Back to the Tour"}</button>` : ""}
    <button class="btn${passed ? "" : " primary"}" data-rnd="again">Play it again</button>${passed ? "" : `<button class="btn" data-rnd="back">Back to the Tour</button>`}`;
  el.querySelector("button")?.focus();
}
function paint() {
  const r = R;
  const { stop, song, plan, part } = r;
  const rest = plan.bars.filter(b => !b.mine).length;
  const wood = `<div class="rnd-wood" aria-hidden="true"></div>`;
  const strings = Array.from({ length: 6 }, (_, i) => `<i class="rnd-str s${i}" style="top:${(18 + i * 13.2).toFixed(1)}%"></i>`).join("");
  const frets = plan.bars.map(b => `<img class="rnd-fret" src="art/road-neck/fret-gold.webp?v=${VERSION}" alt="" draggable="false" style="--x:${(b.t * PX_BEAT / plan.spb - PX_BEAT / 2).toFixed(1)}">`).join("");
  const rests = plan.bars.filter(b => !b.mine).map(b => `<div class="rnd-rest" style="left:${(b.t * PX_BEAT / plan.spb - PX_BEAT / 2 + 8).toFixed(1)}px;width:${(b.dur * PX_BEAT / plan.spb - 16).toFixed(1)}px"><span>Rest, listen<b>${esc(b.chord)}</b></span></div>`).join("");
  const blocks = plan.strums.map(s => `<i class="rnd-blk" data-s="${s.id}" style="left:${(s.t * PX_BEAT / plan.spb - 8).toFixed(1)}px"></i><span class="rnd-arr" aria-hidden="true" style="left:${(s.t * PX_BEAT / plan.spb - 14).toFixed(1)}px">↓</span>`).join("");
  /* 5.15.0: every strum names its chord, in the chord's colour (timeline.js, contrast-checked) */
  const names = plan.strums.map(s => { const c = chordColor(s.chord); return `<span class="rnd-nm" data-s="${s.id}" aria-hidden="true" style="left:${(s.t * PX_BEAT / plan.spb + 1).toFixed(1)}px;--nm-bg:${c.bg};--nm-fg:${c.fg}">${esc(s.chord)}</span>`; }).join("");
  const art = /^https:\/\//.test(song.listen?.art || "") ? `<img src="${esc(song.listen.art)}" alt="" width="44" height="44">` : esc((song.title || "?")[0].toUpperCase());
  r.el.innerHTML = `
    <div class="rnd-top">
      <button class="rnd-x" aria-label="Close" data-rnd="close">${icon("x")}</button>
      <div class="rnd-ti"><small>${esc(kicker(stop))}</small><h2>${esc(stop.kind === "headline" ? "The whole song" : stop.sub)}</h2></div>
      <div class="rnd-heard" role="img" aria-label="Louie heard 0 of ${plan.strums.length} strums" hidden>${icon("mic")}<span class="rnd-lv" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>0/${plan.strums.length}</b></div>
    </div>
    <div class="rnd-song"><span class="rnd-art" aria-hidden="true">${art}</span><div><b>${esc(song.title)}</b><small>${esc(`${part.name}, ${mmss(Math.round(plan.secs))}${rest ? "" : ""}`)}</small></div></div>
    <div class="rnd-prog" aria-hidden="true"><i></i></div>
    <div class="rnd-hw" aria-label="The chords coming at you">${wood}${strings}<div class="rnd-track" style="--w:${(plan.secs * PX_BEAT / plan.spb + 400).toFixed(0)}px">${frets}${rests}${blocks}${names}</div><i class="rnd-line" aria-hidden="true"></i><span class="rnd-ci" aria-hidden="true"></span></div>
    <div class="rnd-foot">
      <div class="rnd-below"><div class="rnd-info"><small>NOW</small><div class="rnd-now" aria-hidden="true">Count in</div></div><div class="rnd-shape" role="img" aria-label="Chord shape"></div></div>
      <div class="rnd-nx"><small>NEXT</small><p class="rnd-next"></p></div>
      <div class="rnd-bar">
        <div class="rnd-ctl"><button class="rnd-speed" data-speed="${r.speed}" aria-label="Speed, ${r.speed.toFixed(1)}x">${r.speed.toFixed(1)}x</button><span aria-hidden="true">Speed</span></div>
        <div class="rnd-ctl"><button class="rnd-pause" aria-label="Pause" data-rnd="pause">${icon("pause")}</button><span aria-hidden="true" class="rnd-pl">Pause</span></div>
        <div class="rnd-ctl"><button class="rnd-again" data-rnd="restart" aria-label="Restart">${icon("restart")}</button><span aria-hidden="true">Restart</span></div>
      </div>
    </div>
    <div class="sr-only rnd-say" aria-live="polite"></div>
    <div class="rnd-card" hidden></div>`;
  r.el.onclick = e => {
    const b = e.target.closest("[data-rnd],[data-speed]");
    if (!b || R !== r) return;
    if (b.dataset.speed) { r.speed = SPEEDS[(SPEEDS.indexOf(r.speed) + 1) % SPEEDS.length] || SPEEDS[0]; return begin(); } /* 5.15.0: one button, 0.6x, 0.8x, 1.0x, then 0.6x again */
    const k = b.dataset.rnd;
    if (k === "close" || k === "back") return closeRound();
    if (k === "restart" || k === "again") return begin();
    if (k === "pause") return pause(r, b);
    if (k === "next") { const ns = r.next, close = r.onClose; closeRound(true); if (ns && (ns.kind === "round" || ns.kind === "headline")) openRound(ns, { onClose: close }); else if (ns?.kind === "chord") location.hash = `#/practice/${encodeURIComponent(ns.id)}`; return; }
  };
  r.el.onkeydown = e => { if (e.key === "Escape") closeRound(); };
  r.el.querySelector(".rnd-x")?.focus();
}

function pause(r, btn) {
  if (!r.ctx || r.finished) return;
  const to = !r.paused;
  if (to) { r.at = where(r); r.paused = true; r.ctx.suspend?.(); if (r.recording && r.musicOn) pauseMusic(); }
  else { r.paused = false; r.ctx.resume?.(); if (r.recording && r.musicOn) startMusic(r.song, r.plan.start + Math.max(0, r.at), 1); }
  btn.setAttribute("aria-label", to ? "Play" : "Pause");
  btn.innerHTML = icon(to ? "play" : "pause");
  const pl = btn.parentElement?.querySelector(".rnd-pl"); if (pl) pl.textContent = to ? "Play" : "Pause";
}
