// The neck (#/practice): the permanent place to practice.
//
//   #/practice          the neck: levels of frets (lessons) and inlays (level checks)
//   #/practice/<step>   one lesson
//
// A chord lesson listens to one string at a time with the same pitch reading the
// tuner uses, and lights a lamp when that string rings clean. A switch lesson
// plays a thin hi-hat beat, shows two chords taking turns, and listens for a strum on
// the first beat of each bar. It hears WHEN you play, not which chord. The beat sits
// far above the guitar and the mic listens below 1.5 kHz; what still leaks in is
// measured in the count-in bar, moment by moment after each tick, and the strum line
// rises only there. Where listening can't help
// (no microphone, a loud room, headphones), "I can't hear it, I got it" lets you
// say so. Strumming, picking and fingerstyle are on the neck as "coming".
import { HEAR, Tabs, VERSION, bleedProfile, buzzRms, chordTargets, detectPitch, nearestNote, pitchRms, strumDetector, strumLine, trackFloor, gradeSwitches, journalTime, judgeTarget, stringRange, skillDone, skillState, TUNINGS } from "./core.js";
import { app, esc, icon, onLeave, sound, toast } from "./ui.js";
import { beatTrack, chordSVG, data, go, playSong } from "./app.js";
import { louie } from "./louie.js";

const $ = id => document.getElementById(id);
const strName = (i, tuning) => { const n = (TUNINGS[tuning] || TUNINGS.standard).notes[i].replace(/\d/, ""); return i === 0 ? `low ${n}` : i === 5 ? `high ${n}` : n; };
const find = id => { for (const lv of skillState(data).levels) for (const st of lv.steps) if (st.id === id) return { st, lv }; return null; };
const lessonName = st => st.kind === "chord" ? `${st.chord} chord` : st.kind === "switch" ? `${st.a} to ${st.b}` : "Level check";

let live = null; /* the lesson running now: stopped when you leave */
function stopLive() {
  if (!live) return;
  clearInterval(live.timer); live.track?.stop(); live.timeouts?.forEach(clearTimeout);
  live.stream?.getTracks().forEach(t => t.stop()); live.src?.disconnect?.();
  live = null;
}
onLeave(stopLive);

/* ---------- the neck ---------- */
export function renderNeck() {
  stopLive();
  const { levels, next } = skillState(data);
  const fret = (st, i) => {
    const cls = st.kind === "check" ? "inlay" : "fret";
    return `<button class="pk-${cls} ${st.state}" data-id="${esc(st.id)}" data-state="${st.state}" aria-label="${esc(lessonName(st))}, ${st.state === "done" ? "done" : st.state === "now" ? "up next" : "locked"}">${st.kind === "check" ? "" : `<b>${esc(st.name)}</b><small>${st.state === "done" ? (st.n ? st.n + "×" : "known") : st.state === "now" ? "next" : ""}</small>`}</button>`;
  };
  const done = lv => lv.steps.filter(s => s.state === "done").length;
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back to Tonight">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">The neck</h1>
    <p class="pf-since">Frets are lessons. The inlays are level checks: play a real song through.</p>
    ${levels.map(lv => `<section class="pf-card pk-level${lv.soon ? " soon" : ""}" aria-label="${esc(lv.name)}">
      <h2>${esc(lv.name)}${lv.soon ? "" : `<span class="pk-count">${done(lv)} of ${lv.steps.length}</span>`}</h2>
      <p class="pf-line">${lv.soon ? "Coming. " : ""}${esc(lv.note)}</p>
      ${lv.soon ? "" : `<div class="pk-board">${lv.steps.map(fret).join("")}</div>`}
    </section>`).join("")}
    <button class="pf-card pk-hearcard" id="pk-hear">${icon("fork")}<span><b>What I hear</b><span class="pf-line">Check the microphone with your guitar: level, pitch and strums, live.</span></span>${icon("chev", "chev")}</button>
    ${next ? `<div class="s-dock"><button class="btn primary" id="pk-go">${icon("play")}${next.kind === "check" ? "Level check" : "Next: " + esc(lessonName(next))}</button></div>` : ""}`;
  $("back").onclick = () => go("#/");
  const open = st => {
    if (st.state === "locked") return toast("Finish the lesson before it first.");
    if (st.kind === "check") {
      if (st.song) return playSong(st.song);
      return toast(`Add a song that uses only ${st.chords.join(", ")}, then play it through.`);
    }
    go("#/practice/" + encodeURIComponent(st.id));
  };
  const all = levels.flatMap(l => l.steps);
  app.querySelectorAll("[data-id]").forEach(b => b.onclick = () => open(all.find(s => s.id === b.dataset.id)));
  $("pk-go")?.addEventListener("click", () => open(next));
  $("pk-hear").onclick = () => go("#/practice/hear");
}

/* ---------- one lesson ---------- */
export function renderSession(id) {
  stopLive();
  if (id === "hear") return whatIHear();
  const hit = find(id);
  if (!hit || hit.st.state === "locked" || hit.st.kind === "check") return go("#/practice");
  hit.st.kind === "chord" ? chordLesson(hit.st) : switchLesson(hit.st);
}

const head = (title, sub) => `<div class="head"><button class="ib glass" id="back" aria-label="Back to the neck">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">${esc(title)}</h1><p class="pf-since">${esc(sub)}</p>`;

/* The guitar's strum, without the beat: two low-pass filters keep what is under 1.5 kHz (the body of a
   strum) and drop the hi-hat, which sits near 7 kHz. */
function guitarBand(ctx, src) {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = "lowpass"; f.frequency.value = 1500; f.Q.value = 0.7; }
  src.connect(a); a.connect(b);
  return b;
}
function mic() {
  if (!navigator.mediaDevices?.getUserMedia) return Promise.reject(new Error("none"));
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
}

/* A chord, one string at a time: the lowest string not yet lit is the one listened for (tap a lamp
   to pick another). Its lamp glows warm while it waits. Three readings in a row decide. */
function stringGuide(targets, box) {
  const order = targets.filter(t => t.hz), lit = new Set();
  let k = 0, streak = { say: "", n: 0 };
  const lamp = i => box.querySelector(`.pk-str[data-i="${i}"]`);
  const paint = () => order.forEach((t, j) => { const e = lamp(t.i); e?.classList.toggle("cur", j === k && !lit.has(t.i)); e?.querySelector(".gs-lamp")?.classList.toggle("warm", j === k && !lit.has(t.i)); });
  const next = () => { for (let n = 1; n <= order.length; n++) { const j = (k + n) % order.length; if (!lit.has(order[j].i)) { k = j; break; } } streak = { say: "", n: 0 }; paint(); };
  order.forEach((t, j) => { const e = lamp(t.i); if (e) e.onclick = () => { if (!lit.has(t.i)) { k = j; streak = { say: "", n: 0 }; paint(); } }; });
  paint();
  return {
    cur: () => lit.size < order.length ? order[k] : null,
    done: () => lit.size >= order.length,
    count: () => lit.size,
    /* a buffer in: what happened, if anything ({ t, say }) */
    hear(buf, rate, floor) {
      const t = order[k];
      if (!t || lit.has(t.i)) return null;
      const hz = detectPitch(buf, rate, pitchRms(floor), 0.6, stringRange(t));
      const say = judgeTarget(hz, t);
      if (!say) { streak = { say: "", n: 0 }; return hz > 0 ? null : { t, say: "" }; }
      streak = streak.say === say ? { say, n: streak.n + 1 } : { say, n: 1 };
      if (streak.n !== 3) return null;
      if (say === "ring") { lit.add(t.i); lamp(t.i)?.querySelector(".gs-lamp")?.classList.add("on"); next(); }
      return { t, say };
    }
  };
}
const fretText = t => t.fret > 0 ? `, fret ${t.fret}` : ", open";

/* chord lesson: one lamp per string */
function chordLesson(st) {
  const tuning = "standard", targets = chordTargets(st.chord, tuning);
  const t0 = Date.now();
  app.innerHTML = `${head(`${st.chord} chord`, "Ring every string clean, one at a time.")}
    <section class="pf-card pk-lesson">
      <div class="pk-chord">${chordSVG(st.chord, 2.2)}</div>
      <div class="pk-strings" role="group" aria-label="Strings">${targets.map(t => `<span class="pk-str${t.hz ? "" : " skip"}" data-i="${t.i}"><i class="gs-lamp"></i><small>${t.hz ? esc(strName(t.i, tuning)) : "skip"}</small></span>`).join("")}</div>
      <div class="rd-say pk-say">${louie("happy", { pose: "point", size: 84 })}<p class="rd-bubble" id="pk-say" aria-live="polite">Finger the chord. I'll ask for one string at a time; pluck it and let it ring.</p></div>
    </section>
    <div class="s-dock"><button class="btn primary" id="pk-start">${icon("fork")}Start listening</button><button class="tb" id="pk-self">I can't hear it, I got it</button></div>`;
  $("back").onclick = () => go("#/practice");
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const finish = (heard = true) => {
    stopLive();
    skillDone(data, st.id, 0);
    const secs = (Date.now() - t0) / 1000; journalTime(data, secs); Tabs.save(data);
    done(st, { secs, line: heard ? `Every string rang clean.` : "Marked as got." });
  };
  $("pk-self").onclick = () => finish(false);
  $("pk-start").onclick = () => {
    $("pk-start").disabled = true; say("Starting the microphone…");
    mic().then(stream => {
      const ctx = sound();
      if (!ctx) throw new Error("none");
      const an = ctx.createAnalyser(); an.fftSize = 4096;
      const src = ctx.createMediaStreamSource(stream); src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let loud = 0, told = 0, floor = null;
      const guide = stringGuide(targets, app.querySelector(".pk-strings"));
      const ask = () => { const t = guide.cur(); if (t) say(`Pluck the ${strName(t.i, tuning)} string${fretText(t)}.`); };
      live = { stream, src, timer: setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        floor = trackFloor(floor, rms);
        const ev = guide.hear(buf, ctx.sampleRate, floor);
        if (ev?.say) {
          loud = 0;
          const nm = strName(ev.t.i, tuning);
          if (ev.say === "ring") { if (guide.done()) return finish(); say(`${nm}: clean.`); setTimeout(ask, 700); }
          else if (Date.now() - told > 1500) {
            told = Date.now();
            say(ev.say === "open" ? `The ${nm} string is ringing open. Press it just behind fret ${ev.t.fret}.` : `The ${nm} string sounds a fret ${ev.say}. Check which fret that finger is on.`);
          }
        } else if (ev && rms > buzzRms(floor)) { loud++; if (loud === 14 && Date.now() - told > 1500) { told = Date.now(); say(`The ${strName(ev.t.i, tuning)} string sounds buzzy or muted. Press closer to the fret and keep other fingers off it.`); } }
        else loud = 0;
      }, 45) };
      ask();
      $("pk-start").hidden = true;
    }).catch(() => fail());
    const fail = () => { $("pk-start").hidden = true; say("I can't use the microphone here. Play the chord, then tap \"I can't hear it, I got it\"."); };
  };
}

/* switch lesson: two chords take turns on the beat */
function switchLesson(st) {
  const best = data.skills?.done?.[st.id]?.best || 0;
  let bpm = Math.max(50, Math.min(st.to - 10, best ? best : 50)), round = 0;
  const t0 = Date.now();
  const bars = 8;
  const shell = () => {
    app.innerHTML = `${head(`${st.a} to ${st.b}`, `Switch on the first beat. Round ${round + 1} at ${bpm} BPM.`)}
      <section class="pf-card pk-lesson">
        <div class="pk-pair"><div class="pk-now" id="pk-now"><b id="pk-name">${esc(st.a)}</b><small id="pk-then">then ${esc(st.b)}</small></div><div class="pk-diag" id="pk-diag">${chordSVG(st.b, 1.4)}</div></div>
        <div class="pk-beats" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="rd-say pk-say">${louie("happy", { pose: "point", size: 84 })}<p class="rd-bubble" id="pk-say" aria-live="polite">Hold the phone near the guitar. The first bar is a count-in: stay quiet so I can hear the beat.</p></div>
      </section>
      <div class="s-dock"><button class="btn primary" id="pk-start">${icon("play")}Start round</button><button class="tb" id="pk-self">I can't hear it, I got it</button></div>`;
    $("back").onclick = () => go("#/practice");
    $("pk-self").onclick = () => finish(bpm, "Marked as got.");
    $("pk-start").onclick = start;
  };
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const finish = (at, line) => {
    stopLive();
    skillDone(data, st.id, at);
    const secs = (Date.now() - t0) / 1000; journalTime(data, secs); Tabs.save(data);
    done(st, { secs, line, bpm: at });
  };
  const show = k => { /* chord for bar k (k < 0: the count-in shows the first) */
    const cur = k % 2 === 1 ? st.b : st.a, nxt = cur === st.a ? st.b : st.a;
    if ($("pk-name")) { $("pk-name").textContent = cur; $("pk-then").textContent = k < 0 ? `Count in, then ${st.a}` : `then ${nxt}`; $("pk-diag").innerHTML = chordSVG(nxt, 1.4); }
  };
  const start = async () => {
    $("pk-start").disabled = true;
    let stream = null;
    try { stream = await mic(); } catch { say("I can't use the microphone, so I'll play the beat and you tell me how it went."); }
    const audio = sound();
    live = { stream, timeouts: [] };
    const beatAt = [];
    const track = beatTrack(bpm, (i, t) => {
      beatAt.push(t);
      live?.timeouts.push(setTimeout(() => {
        const beat = i % 4, bar = Math.floor(i / 4) - 1;
        document.querySelectorAll(".pk-beats i").forEach((e, n) => e.classList.toggle("on", n === beat));
        if (beat === 0) show(bar);
        if (i === 0) say("Count in. Stay quiet for one bar.");
        if (i === 4) say(`Go: ${st.a} on the 1.`);
      }, Math.max(0, (t - audio.currentTime) * 1000)));
    }, { hats: true });
    if (!track) { stopLive(); say("The phone won't play sound here."); $("pk-start").disabled = false; return; }
    live.track = track;
    const onsets = [], strum = strumDetector(), bleed = bleedProfile();
    /* the last beat before now: how long ago, and whether it was a 1 */
    const lastBeat = now => { for (let k = beatAt.length - 1; k >= 0; k--) if (beatAt[k] <= now) return { since: now - beatAt[k], one: k % 4 === 0 }; return null; };
    if (stream) {
      const an = audio.createAnalyser(); an.fftSize = 1024;
      live.src = audio.createMediaStreamSource(stream); guitarBand(audio, live.src).connect(an);
      const buf = new Float32Array(an.fftSize);
      live.timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        const now = audio.currentTime;
        const lb = lastBeat(now);
        if (now < track.t0 + 4 * track.spb) { if (lb) bleed.add(lb.since, lb.one, rms); strum(rms, now, 1); } /* the count-in: only the beat */
        else if (strum(rms, now, lb ? bleed.at(lb.since, lb.one) : 0)) onsets.push(now);
      }, 10);
    }
    const spb = track.spb, dues = Array.from({ length: bars }, (_, k) => track.t0 + (4 + 4 * k) * spb + track.lag);
    live.timeouts.push(setTimeout(() => {
      const grade = stream ? gradeSwitches(dues, onsets, spb) : null;
      stopLive();
      result(grade);
    }, (track.t0 + (4 + 4 * bars) * spb + 0.5 - audio.currentTime) * 1000));
  };
  const result = grade => {
    const b = $("pk-start");
    if (!b) return;
    b.disabled = false;
    if (!grade) { /* no microphone: ask */
      say("How did the switches go?");
      b.textContent = "I landed them";
      b.onclick = () => bpm >= st.to ? finish(bpm, "Landed on the beat at your target tempo.") : (bpm += 10, round++, shell());
      return;
    }
    $("pk-name").textContent = `${grade.on} of ${bars}`;
    $("pk-then").textContent = "on the beat";
    $("pk-diag").innerHTML = "";
    const parts = [grade.late ? `${grade.late} late` : "", grade.early ? `${grade.early} early` : "", grade.miss ? `${grade.miss} not heard` : ""].filter(Boolean).join(", ");
    if (grade.clean && bpm >= st.to) return finish(bpm, `${grade.on} of ${bars} on the beat at ${bpm} BPM.`);
    if (grade.clean) { say(`Clean round${parts ? ` (${parts})` : ""}. Next round is ${bpm + 10} BPM.`); bpm += 10; }
    else if (grade.miss >= bars / 2) {
      say("I heard very little. Hold the phone closer to the guitar and strum firmly on the 1. Or tap \"I can't hear it, I got it\".");
      if (!$("pk-check")) { b.parentElement.insertAdjacentHTML("beforeend", '<button class="tb" id="pk-check">Check the microphone</button>'); $("pk-check").onclick = () => go("#/practice/hear"); }
    }
    else say(`${parts || "Close"}. Stay at ${bpm} BPM and get your fingers there a beat early.`);
    round++;
    b.textContent = "Next round";
    b.onclick = shell;
  };
  shell();
}

/* lesson done */
function done(st, { secs, line, bpm = 0 }) {
  const { levels } = skillState(data), lv = levels.find(l => l.steps.some(s => s.id === st.id));
  const have = lv.steps.filter(s => s.state === "done").length, total = lv.steps.length;
  const chords = st.kind === "chord" ? [st.chord] : [st.a, st.b];
  const sg = data.songs.find(s => chords.every(c => new RegExp("\\[" + c.replace("#", "\\#") + "(?![#b\\w])").test(s.body || ""))) || data.songs.find(s => new RegExp("\\[" + chords[0] + "(?![#b\\w])").test(s.body || ""));
  const nxt = skillState(data).next;
  const m = Math.floor(secs / 60), s = Math.round(secs % 60);
  app.innerHTML = `${head(lessonName(st), "Done")}
    <div class="rd-first">${louie("happy", { pose: "thumb", size: 170 })}<p class="rd-first-t">${esc(line)}</p></div>
    <div class="pf-plate" role="group" aria-label="Lesson numbers">
      <div class="pf-read"><b>${m}:${String(s).padStart(2, "0")}</b><span>this lesson</span></div>
      <div class="pf-read"><b>${bpm || (data.skills?.done?.[st.id]?.n || 1) + "×"}</b><span>${bpm ? "BPM" : "practiced"}</span></div>
      <div class="pf-read"><b>${have}/${total}</b><span>${esc(lv.name.toLowerCase())}</span></div>
    </div>
    <div class="s-dock">${sg ? `<button class="btn primary" id="pk-song">${icon("play")}Play ${esc(sg.title)}</button>` : ""}<button class="${sg ? "tb" : "btn primary"}" id="pk-next">${nxt && nxt.kind !== "check" ? "Next: " + esc(lessonName(nxt)) : "Back to the neck"}</button></div>`;
  $("back").onclick = () => go("#/practice");
  $("pk-song")?.addEventListener("click", () => playSong(sg.id));
  $("pk-next").onclick = () => nxt && nxt.kind !== "check" ? go("#/practice/" + encodeURIComponent(nxt.id)) : go("#/practice");
}

/* ---------- What I hear ----------
   The microphone, live: the level (with the line a strum has to cross), the pitch and
   which string of a chord it would light, and each strum caught. The level is the
   strum band (under 1.5 kHz), as a switch lesson hears it. "Strum with the beat" plays
   one quiet bar to learn how the beat leaks into the mic (the count-in a switch lesson
   uses), then four bars to strum on the 1, graded as a lesson would. "Copy readings" puts a short plain summary on the clipboard to
   paste into a message; nothing is recorded, kept or sent by the app. */
const HEAR_CHORDS = ["", "G", "C", "D", "Em", "Am", "E", "A"];
function whatIHear() {
  let chord = "", guide = null, running = false, measuring = false, ctxRef = null, floorRef = null, prof = null, along = null;
  const lane = [], strums = [], beats = []; /* last few seconds: [time, level] */
  const st = { t0: 0, frames: 0, quiet: [], peak: 0, pitched: 0, buzzy: 0, strums: 0, notes: {}, lit: {}, grade: null };
  const beatAt = []; /* every beat played, audio time */
  const lastBeat = now => { for (let k = beatAt.length - 1; k >= 0; k--) if (beatAt[k] <= now) return { since: now - beatAt[k], one: k % 4 === 0 }; return null; };
  const bleedNow = now => { const lb = prof && lastBeat(now); return lb ? prof.at(lb.since, lb.one) : 0; };
  app.innerHTML = `${head("What I hear", "Play anything for half a minute. Nothing is recorded or sent.")}
    <section class="pf-card pk-lesson">
      <div class="pf-plate" role="group" aria-label="What the microphone hears">
        <div class="pf-read"><b id="ph-lvl">–</b><span>level</span></div>
        <div class="pf-read"><b id="ph-note">–</b><span id="ph-hz">pitch</span></div>
        <div class="pf-read"><b id="ph-strums">0</b><span>strums</span></div>
      </div>
      <canvas class="ph-lane" id="ph-lane" aria-hidden="true"></canvas>
      <div class="pk-beats" id="ph-beats" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <p class="ph-key"><i class="ph-k lvl"></i>level <i class="ph-k thr"></i>strum line <i class="ph-k on"></i>strum <i class="ph-k beat"></i>beat</p>
      <h2 class="ph-h">Check against a chord</h2>
      <div class="ph-chords" role="group" aria-label="Chord">${HEAR_CHORDS.map(c => `<button data-c="${c}" class="${c ? "" : "on"}">${c || "Off"}</button>`).join("")}</div>
      <div class="pk-strings" id="ph-strings" hidden></div>
      <p class="rd-bubble ph-say" id="pk-say" aria-live="polite">Tap Start, then pluck single strings, strum a chord, and stay quiet for a moment.</p>
    </section>
    <div class="s-dock"><button class="btn primary" id="ph-go">${icon("fork")}Start listening</button><div class="ph-row"><button class="tb" id="ph-drums" disabled>Strum with the beat</button><button class="tb" id="ph-copy" disabled>Copy readings</button></div></div>`;
  $("back").onclick = () => go("#/practice");
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const strings = () => {
    const box = $("ph-strings");
    box.hidden = !chord;
    if (!chord) return;
    box.innerHTML = chordTargets(chord).map(t => `<span class="pk-str${t.hz ? "" : " skip"}" data-i="${t.i}"><i class="gs-lamp"></i><small>${t.hz ? esc(strName(t.i, "standard")) : "skip"}</small></span>`).join("");
  };
  app.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    chord = b.dataset.c; st.lit = {};
    app.querySelectorAll("[data-c]").forEach(x => x.classList.toggle("on", x === b));
    strings();
    guide = chord ? stringGuide(chordTargets(chord), $("ph-strings")) : null;
    const t = guide?.cur();
    if (t) say(`Finger ${chord}, then pluck the ${strName(t.i, "standard")} string${fretText(t)}. Tap a lamp to pick another.`);
  });
  const canvas = $("ph-lane"), g = canvas.getContext("2d");
  const y = (v, h) => h - 4 - Math.min(1, Math.sqrt(v / 0.5)) * (h - 8); /* square root, so quiet sounds still show */
  const draw = () => {
    if (!document.contains(canvas)) return;
    const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const now = live?.ctx?.currentTime || 0, span = 4, x = t => w - (now - t) / span * w;
    g.fillStyle = "rgba(255,255,255,.18)";
    for (const t of beats) if (now - t < span) g.fillRect(x(t) - 1, 0, 2, h);
    const thr = strumLine(live?.floor?.() ?? null);
    g.strokeStyle = "rgba(255,120,90,.8)"; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(0, y(thr, h)); g.lineTo(w, y(thr, h)); g.stroke(); g.setLineDash([]);
    g.strokeStyle = "#ffc27a"; g.lineWidth = 1.5; g.beginPath();
    lane.forEach(([t, v], i) => { const px = x(t), py = y(v, h); i ? g.lineTo(px, py) : g.moveTo(px, py); });
    g.stroke();
    g.fillStyle = "#ffb24a";
    for (const t of strums) if (now - t < span) { g.beginPath(); g.arc(x(t), 8, 4, 0, 7); g.fill(); }
    requestAnimationFrame(draw);
  };
  const start = () => {
    $("ph-go").disabled = true; say("Starting the microphone…");
    mic().then(stream => {
      const ctx = sound();
      if (!ctx) throw new Error("none");
      const fast = ctx.createAnalyser(), slow = ctx.createAnalyser();
      fast.fftSize = 1024; slow.fftSize = 4096;
      const src = ctx.createMediaStreamSource(stream); guitarBand(ctx, src).connect(fast); src.connect(slow);
      const fb = new Float32Array(fast.fftSize), sb = new Float32Array(slow.fftSize), strum = strumDetector();
      let n = 0, shown = 0;
      st.t0 = ctx.currentTime; ctxRef = ctx; floorRef = strum.floor;
      live = { stream, src, ctx, timeouts: [], floor: strum.floor, timer: setInterval(() => {
        const now = ctx.currentTime;
        fast.getFloatTimeDomainData(fb);
        let rms = 0; for (const v of fb) rms += v * v; rms = Math.sqrt(rms / fb.length);
        lane.push([now, rms]); while (lane.length && now - lane[0][0] > 4.2) lane.shift();
        st.frames++; st.peak = Math.max(st.peak, rms);
        if (measuring) { const lb = lastBeat(now); if (lb) prof.add(lb.since, lb.one, rms); strum(rms, now, 1); return; }
        if (strum(rms, now, bleedNow(now))) { strums.push(now); along?.push(now); st.strums++; $("ph-strums").textContent = st.strums; }
        while (strums.length && now - strums[0] > 4.2) strums.shift();
        if (++n % 5) return; /* the pitch every 50 ms */
        slow.getFloatTimeDomainData(sb);
        st.quiet.push(rms); if (st.quiet.length > 600) st.quiet.shift();
        const hz = detectPitch(sb, ctx.sampleRate, pitchRms(strum.floor()), HEAR.clarity, [70, 1000]);
        if (Date.now() - shown > 120) { shown = Date.now(); $("ph-lvl").textContent = rms < 0.001 ? "0" : (rms * 100).toFixed(rms < 0.1 ? 1 : 0); }
        if (hz > 0) {
          st.pitched++;
          const nn = nearestNote(hz), name = nn.name + nn.octave;
          st.notes[name] = (st.notes[name] || 0) + 1;
          $("ph-note").textContent = nn.name + nn.octave;
          $("ph-hz").textContent = `${hz.toFixed(1)} Hz · ${nn.cents > 0 ? "+" : ""}${nn.cents}¢`;
        } else if (rms > buzzRms(strum.floor())) { st.buzzy++; $("ph-note").textContent = "?"; $("ph-hz").textContent = "no clear pitch"; }
        const ev = guide?.hear(sb, ctx.sampleRate, strum.floor());
        if (ev?.say) {
          const nm = strName(ev.t.i, "standard");
          if (ev.say === "ring") { st.lit[chord] = guide.count(); const nx = guide.cur(); say(nx ? `${nm} string: clean. Next, the ${strName(nx.i, "standard")} string${fretText(nx)}.` : `${nm} string: clean. Every string of ${chord} rang.`); }
          else say(ev.say === "open" ? `${nm} string: ringing open.` : `${nm} string: a fret ${ev.say}.`);
        }
      }, 10) };
      running = true;
      $("ph-go").disabled = false; $("ph-go").innerHTML = `${icon("pause")}Stop`;
      $("ph-drums").disabled = false; $("ph-copy").disabled = false;
      say("Listening. Pluck a few single strings, strum a chord, then stay quiet for a moment.");
      requestAnimationFrame(draw);
    }).catch(() => { $("ph-go").disabled = false; say("I can't use the microphone here. On iPhone: Settings, Apps, Safari, Microphone, Ask. Then try again."); });
  };
  const stop = () => {
    stopLive(); running = false;
    $("ph-go").innerHTML = `${icon("fork")}Start listening`;
    $("ph-drums").disabled = true;
    say("Stopped. Copy readings to send them, or start again.");
  };
  $("ph-go").onclick = () => running ? stop() : start();
  /* one quiet bar to learn how the beat leaks into the mic, then four bars to strum on the 1 */
  $("ph-drums").onclick = () => {
    if (!live?.ctx) return;
    say("First bar: stay quiet. Then strum on each 1 for four bars.");
    $("ph-drums").disabled = true;
    beatAt.length = 0; prof = bleedProfile(); along = null;
    st.grade = { started: true };
    const tr = beatTrack(70, (i, t) => {
      beatAt.push(t); beats.push(t);
      if (i < 20) live?.timeouts.push(setTimeout(() => document.querySelectorAll("#ph-beats i").forEach((e, n) => e.classList.toggle("on", n === i % 4)), Math.max(0, (t - live.ctx.currentTime) * 1000)));
    }, { hats: true });
    if (!tr) return;
    const audio = live.ctx, spb = tr.spb;
    live.track = tr;
    const at = (sec, fn) => live.timeouts.push(setTimeout(fn, Math.max(0, (sec - audio.currentTime) * 1000)));
    at(tr.t0 - 0.05, () => { measuring = true; });
    at(tr.t0 + 4 * spb - 0.05, () => { measuring = false; along = []; say(`Strum on the 1. The beat leaks ${(prof.peak() * 100).toFixed(1)} into the mic, only for a moment after each tick.`); });
    at(tr.t0 + 20 * spb + 0.4, () => {
      tr.stop();
      if (live) live.track = null;
      const dues = [4, 8, 12, 16].map(k => tr.t0 + k * spb + tr.lag);
      st.grade = gradeSwitches(dues, along || [], spb);
      along = null; beats.length = 0;
      document.querySelectorAll("#ph-beats i").forEach(e => e.classList.remove("on"));
      if (!document.contains(canvas)) return;
      $("ph-drums").disabled = false;
      say(`On the 1: ${st.grade.on} of 4${st.grade.late ? `, ${st.grade.late} late` : ""}${st.grade.early ? `, ${st.grade.early} early` : ""}${st.grade.miss ? `, ${st.grade.miss} not heard` : ""}.`);
    });
  };
  $("ph-copy").onclick = () => {
    const q = [...st.quiet].sort((a, b) => a - b), floor = q.length ? q[Math.floor(q.length * 0.1)] : 0;
    const top = Object.entries(st.notes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(", ");
    const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "0%";
    const reads = Math.floor(st.frames / 5);
    const text = [
      `The Road ${VERSION}, What I hear`,
      `Listened ${Math.round((ctxRef?.currentTime || 0) - st.t0)} s · sample rate ${ctxRef?.sampleRate || "?"} · output delay ${Math.round(((ctxRef?.baseLatency || 0) + (ctxRef?.outputLatency || 0)) * 1000)} ms`,
      `Quiet floor ${(floor * 100).toFixed(3)} (tracked ${((floorRef?.() || 0) * 100).toFixed(3)}) · strum line ${(strumLine(floorRef?.() ?? null) * 100).toFixed(2)} · loudest ${(st.peak * 100).toFixed(1)} · beat in the mic ${prof ? (prof.peak() * 100).toFixed(2) : "not measured"}`,
      st.grade?.started ? "With the beat: not finished (it takes about 17 seconds)" : st.grade ? `With the beat: ${st.grade.on} of 4 on the 1, ${st.grade.late} late, ${st.grade.early} early, ${st.grade.miss} not heard` : "",
      `Strums caught ${st.strums} · pitch clear ${pct(st.pitched, reads)} of reads · buzzy ${pct(st.buzzy, reads)}`,
      `Notes heard: ${top || "none"}`,
      chord ? `${chord}: strings lit ${st.lit[chord] || 0} of ${chordTargets(chord).filter(t => t.hz).length}` : "",
      `Settings: ${Object.entries(HEAR).map(([k, v]) => `${k} ${v}`).join(", ")}`
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).then(() => toast("Readings copied. Paste them into a message."), () => toast("Couldn't copy here."));
  };
}
