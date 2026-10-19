// The neck (#/practice): the permanent place to practice.
//
//   #/practice          the neck: levels of frets (lessons) and inlays (level checks)
//   #/practice/<step>   one lesson
//
// A chord lesson listens to one string at a time with the same pitch reading the
// tuner uses, and lights a lamp when that string rings clean. A switch lesson
// plays the drums, shows two chords taking turns, and listens for a strum on the
// first beat of each bar. It hears WHEN you play, not which chord: the drums can
// bleed into the microphone, so the first bar is a count-in that measures how loud
// the drums are, and a strum has to be louder than that. Where listening can't help
// (no microphone, a loud room, headphones), "I can't hear it, I got it" lets you
// say so. Strumming, picking and fingerstyle are on the neck as "coming".
import { HEAR, Tabs, VERSION, buzzRms, chordTargets, detectPitch, nearestNote, pitchRms, strumDetector, strumLine, trackFloor, gradeSwitches, journalTime, judgeString, skillDone, skillState, TUNINGS } from "./core.js";
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

/* chord lesson: one lamp per string */
function chordLesson(st) {
  const tuning = "standard", targets = chordTargets(st.chord, tuning);
  const lit = new Set(targets.filter(t => !t.hz).map(t => t.i)); /* strings left out need nothing */
  const need = targets.filter(t => t.hz).length;
  const t0 = Date.now();
  app.innerHTML = `${head(`${st.chord} chord`, "Ring every string clean, one at a time.")}
    <section class="pf-card pk-lesson">
      <div class="pk-chord">${chordSVG(st.chord, 2.2)}</div>
      <div class="pk-strings" role="group" aria-label="Strings">${targets.map(t => `<span class="pk-str${t.hz ? "" : " skip"}" data-i="${t.i}"><i class="gs-lamp"></i><small>${t.hz ? esc(strName(t.i, tuning)) : "skip"}</small></span>`).join("")}</div>
      <div class="rd-say pk-say">${louie("happy", { pose: "point", size: 84 })}<p class="rd-bubble" id="pk-say" aria-live="polite">Finger the chord, then pluck each string on its own and let it ring.</p></div>
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
      let streak = { i: -1, say: "", n: 0 }, loud = 0, told = 0, floor = null;
      live = { stream, src, timer: setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        floor = trackFloor(floor, rms);
        const hz = detectPitch(buf, ctx.sampleRate, pitchRms(floor), HEAR.clarity, [70, 700]);
        let j = null;
        if (hz > 0) for (const m of [1, 2, 0.5]) { j = judgeString(hz * m, targets); if (j) break; }
        if (j) {
          loud = 0;
          streak = streak.i === j.i && streak.say === j.say ? { ...streak, n: streak.n + 1 } : { ...j, n: 1 };
          if (streak.n === 3) {
            const nm = strName(j.i, tuning);
            if (j.say === "ring") {
              if (!lit.has(j.i)) { lit.add(j.i); document.querySelector(`.pk-str[data-i="${j.i}"] .gs-lamp`)?.classList.add("on"); say(`${nm}: clean.`); }
            } else if (Date.now() - told > 1500) {
              told = Date.now();
              say(j.say === "open" ? `The ${nm} string is ringing open. Press it just behind the fret.` : `The ${nm} string sounds a fret ${j.say}. Check which fret that finger is on.`);
            }
            if (lit.size >= targets.length) finish();
          }
        } else {
          streak.n = 0;
          if (rms > buzzRms(floor)) { loud++; if (loud === 14 && Date.now() - told > 1500) { told = Date.now(); say("That one sounds buzzy or muted. Press closer to the fret and keep other fingers off the string."); } } else loud = 0;
        }
      }, 45) };
      $("pk-start").hidden = true;
      say(`Listening. ${need} string${need === 1 ? "" : "s"} to go.`);
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
    const track = beatTrack(bpm, (i, t) => {
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
    const onsets = [], strum = strumDetector(); let bleed = 0;
    if (stream) {
      const an = audio.createAnalyser(); an.fftSize = 1024;
      live.src = audio.createMediaStreamSource(stream); guitarBand(audio, live.src).connect(an);
      const buf = new Float32Array(an.fftSize);
      live.timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        const now = audio.currentTime;
        if (now < track.t0 + 4 * track.spb) bleed = Math.max(bleed, rms); /* the count-in: only the beat */
        else if (strum(rms, now, bleed)) onsets.push(now);
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
   strum band (under 1.5 kHz), as a switch lesson hears it. "Measure the beat" plays
   one bar of the hi-hat beat to see how much reaches the mic, the same count-in a
   switch lesson uses. "Copy readings" puts a short plain summary on the clipboard to
   paste into a message; nothing is recorded, kept or sent by the app. */
const HEAR_CHORDS = ["", "G", "C", "D", "Em", "Am", "E", "A"];
function whatIHear() {
  let chord = "", running = false, bleed = 0, measuring = false, ctxRef = null, floorRef = null;
  const lane = [], strums = [], beats = []; /* last few seconds: [time, level] */
  const st = { t0: 0, frames: 0, quiet: [], peak: 0, pitched: 0, buzzy: 0, strums: 0, notes: {}, lit: {}, bleedPeak: 0 };
  app.innerHTML = `${head("What I hear", "Play anything for half a minute. Nothing is recorded or sent.")}
    <section class="pf-card pk-lesson">
      <div class="pf-plate" role="group" aria-label="What the microphone hears">
        <div class="pf-read"><b id="ph-lvl">–</b><span>level</span></div>
        <div class="pf-read"><b id="ph-note">–</b><span id="ph-hz">pitch</span></div>
        <div class="pf-read"><b id="ph-strums">0</b><span>strums</span></div>
      </div>
      <canvas class="ph-lane" id="ph-lane" aria-hidden="true"></canvas>
      <p class="ph-key"><i class="ph-k lvl"></i>level <i class="ph-k thr"></i>strum line <i class="ph-k on"></i>strum <i class="ph-k beat"></i>beat</p>
      <h2 class="ph-h">Check against a chord</h2>
      <div class="ph-chords" role="group" aria-label="Chord">${HEAR_CHORDS.map(c => `<button data-c="${c}" class="${c ? "" : "on"}">${c || "Off"}</button>`).join("")}</div>
      <div class="pk-strings" id="ph-strings" hidden></div>
      <p class="rd-bubble ph-say" id="pk-say" aria-live="polite">Tap Start, then pluck single strings, strum a chord, and stay quiet for a moment.</p>
    </section>
    <div class="s-dock"><button class="btn primary" id="ph-go">${icon("fork")}Start listening</button><div class="ph-row"><button class="tb" id="ph-drums" disabled>Measure the beat</button><button class="tb" id="ph-copy" disabled>Copy readings</button></div></div>`;
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
    const thr = strumLine(live?.floor?.() ?? null, bleed);
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
      let n = 0, streak = { i: -1, n: 0 }, shown = 0;
      st.t0 = ctx.currentTime; ctxRef = ctx; floorRef = strum.floor;
      live = { stream, src, ctx, timeouts: [], floor: strum.floor, timer: setInterval(() => {
        const now = ctx.currentTime;
        fast.getFloatTimeDomainData(fb);
        let rms = 0; for (const v of fb) rms += v * v; rms = Math.sqrt(rms / fb.length);
        lane.push([now, rms]); while (lane.length && now - lane[0][0] > 4.2) lane.shift();
        st.frames++; st.peak = Math.max(st.peak, rms);
        if (measuring) { st.bleedPeak = Math.max(st.bleedPeak, rms); return; }
        if (strum(rms, now, bleed)) { strums.push(now); st.strums++; $("ph-strums").textContent = st.strums; }
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
          if (chord) {
            let j = null;
            for (const m of [1, 2, 0.5]) { j = judgeString(hz * m, chordTargets(chord)); if (j) break; }
            streak = j && j.i === streak.i && j.say === streak.say ? { ...streak, n: streak.n + 1 } : j ? { ...j, n: 1 } : { i: -1, n: 0 };
            if (streak.n === 3) {
              const nm = strName(j.i, "standard");
              if (j.say === "ring") { st.lit[chord + j.i] = 1; document.querySelector(`#ph-strings .pk-str[data-i="${j.i}"] .gs-lamp`)?.classList.add("on"); say(`${nm} string: clean.`); }
              else say(j.say === "open" ? `${nm} string: ringing open.` : `${nm} string: a fret ${j.say}.`);
            }
          }
        } else if (rms > buzzRms(strum.floor())) { st.buzzy++; $("ph-note").textContent = "?"; $("ph-hz").textContent = "no clear pitch"; }
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
  $("ph-drums").onclick = () => {
    if (!live?.ctx) return;
    say("Stay quiet: one bar of the beat.");
    $("ph-drums").disabled = true;
    const tr = beatTrack(70, (i, t) => { if (i < 4) beats.push(t); }, { hats: true });
    if (!tr) return;
    const audio = live.ctx;
    live.track = tr;
    live.timeouts.push(setTimeout(() => { measuring = true; st.bleedPeak = 0; }, Math.max(0, (tr.t0 - audio.currentTime) * 1000)));
    live.timeouts.push(setTimeout(() => {
      tr.stop(); measuring = false; bleed = st.bleedPeak;
      if (live) live.track = null;
      if (!document.contains(canvas)) return;
      $("ph-drums").disabled = false;
      say(`The beat reaches ${(bleed * 100).toFixed(1)} in the mic, so a strum has to pass ${(strumLine(live?.floor?.() ?? null, bleed) * 100).toFixed(1)}. Strum along to see if yours clear the line.`);
    }, Math.max(0, (tr.t0 + 4 * tr.spb + 0.3 - audio.currentTime) * 1000)));
  };
  $("ph-copy").onclick = () => {
    const q = [...st.quiet].sort((a, b) => a - b), floor = q.length ? q[Math.floor(q.length * 0.1)] : 0;
    const top = Object.entries(st.notes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v}`).join(", ");
    const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "0%";
    const reads = Math.floor(st.frames / 5);
    const text = [
      `The Road ${VERSION}, What I hear`,
      `Listened ${Math.round((ctxRef?.currentTime || 0) - st.t0)} s · sample rate ${ctxRef?.sampleRate || "?"} · output delay ${Math.round(((ctxRef?.baseLatency || 0) + (ctxRef?.outputLatency || 0)) * 1000)} ms`,
      `Quiet floor ${(floor * 100).toFixed(3)} (tracked ${((floorRef?.() || 0) * 100).toFixed(3)}) · strum line ${(strumLine(floorRef?.() ?? null, bleed) * 100).toFixed(2)} · loudest ${(st.peak * 100).toFixed(1)} · beat in the mic ${bleed ? (bleed * 100).toFixed(2) : "not measured"}`,
      `Strums caught ${st.strums} · pitch clear ${pct(st.pitched, reads)} of reads · buzzy ${pct(st.buzzy, reads)}`,
      `Notes heard: ${top || "none"}`,
      chord ? `${chord}: strings lit ${Object.keys(st.lit).filter(k => k.startsWith(chord)).length} of ${chordTargets(chord).filter(t => t.hz).length}` : "",
      `Settings: ${Object.entries(HEAR).map(([k, v]) => `${k} ${v}`).join(", ")}`
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).then(() => toast("Readings copied. Paste them into a message."), () => toast("Couldn't copy here."));
  };
}
