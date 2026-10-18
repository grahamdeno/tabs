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
import { Tabs, chordTargets, detectPitch, gradeSwitches, journalTime, judgeString, skillDone, skillState, TUNINGS } from "./core.js";
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
}

/* ---------- one lesson ---------- */
export function renderSession(id) {
  stopLive();
  const hit = find(id);
  if (!hit || hit.st.state === "locked" || hit.st.kind === "check") return go("#/practice");
  hit.st.kind === "chord" ? chordLesson(hit.st) : switchLesson(hit.st);
}

const head = (title, sub) => `<div class="head"><button class="ib glass" id="back" aria-label="Back to the neck">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">${esc(title)}</h1><p class="pf-since">${esc(sub)}</p>`;

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
      let streak = { i: -1, say: "", n: 0 }, loud = 0, told = 0;
      live = { stream, src, timer: setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        const hz = detectPitch(buf, ctx.sampleRate, 0.015, 0.3, [70, 700]);
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
          if (rms > 0.04) { loud++; if (loud === 14 && Date.now() - told > 1500) { told = Date.now(); say("That one sounds buzzy or muted. Press closer to the fret and keep other fingers off the string."); } } else loud = 0;
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
        <div class="rd-say pk-say">${louie("happy", { pose: "point", size: 84 })}<p class="rd-bubble" id="pk-say" aria-live="polite">Hold the phone near the guitar. The first bar is a count-in: stay quiet so I can hear the drums.</p></div>
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
    });
    if (!track) { stopLive(); say("The phone won't play sound here."); $("pk-start").disabled = false; return; }
    live.track = track;
    const onsets = []; let bleed = 0, prev = 0, lastOn = -1;
    if (stream) {
      const an = audio.createAnalyser(); an.fftSize = 1024;
      live.src = audio.createMediaStreamSource(stream); live.src.connect(an);
      const buf = new Float32Array(an.fftSize);
      live.timer = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        const now = audio.currentTime;
        if (now < track.t0 + 4 * track.spb) bleed = Math.max(bleed, rms); /* the count-in: only drums */
        else if (rms > Math.max(0.03, bleed * 2.2) && rms > prev * 1.4 && now - lastOn > 0.18) { onsets.push(now); lastOn = now; }
        prev = rms;
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
    else if (grade.miss >= bars / 2) say("I heard very little. Hold the phone closer to the guitar and strum firmly on the 1. Or tap \"I can't hear it, I got it\".");
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
