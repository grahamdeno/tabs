// Rehearse (#/practice, 4.8.0) and the neck: the permanent place to practice.
//
//   #/practice          Rehearse, one page (4.33.0): today's lesson, Your changes (with the soundcheck and
//                       the changes you dropped in gigs), your skills in three bars, more ways to practice
//   #/practice/neck     the same page (the neck was its own page before 4.33.0)
//   #/practice/skills   All lessons: levels of frets (lessons) and inlays (level checks), and Learning
//   #/practice/<step>   one lesson (any switch, s:A-B, even one that isn't on the neck)
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
import { HEAR, Tabs, VERSION, bleedProfile, buzzRms, chordTargets, detectPitch, nearestNote, pitchRms, strumDetector, strumLine, trackFloor, gradeSwitches, journalPractice, judgeTarget, stringRange, skillDone, skillState, soundcheck, soundcheckDone, missedChanges, SOUNDCHECK_XP, TUNINGS, SCALES, scaleTargets, playCount, practiceRate, lessonOfDay, lessonDone, lessonKeep, lessonPartOf, LESSON_PASSES, changesToWork } from "./core.js";
import { app, esc, icon, onLeave, sound, toast } from "./ui.js";
import { beatTrack, chordSVG, data, go, loopHooks, openAtSection, openLessonSong, openTuner, playSong, tunedRecently } from "./app.js";
import { statBar, bindStatBar } from "./hud.js";
import { louie } from "./louie.js";

const $ = id => document.getElementById(id);
const strName = (i, tuning) => { const n = (TUNINGS[tuning] || TUNINGS.standard).notes[i].replace(/\d/, ""); return i === 0 ? `low ${n}` : i === 5 ? `high ${n}` : n; };
const find = id => { for (const lv of skillState(data).levels) for (const st of lv.steps) if (st.id === id) return { st, lv }; return null; };
const lessonName = st => st.kind === "chord" ? `${st.chord} chord` : st.kind === "switch" ? `${st.a} to ${st.b}` : st.kind === "scale" ? SCALES[st.scale]?.name || "Scale" : "Level check";

let live = null; /* the lesson running now: stopped when you leave */
let drillQueue = []; /* 4.23.0: "Drill all three" in Rehearse: the switch lessons still to do, in order */
let backTo = "#/practice"; /* where a lesson's Back goes: Rehearse, or All lessons when it was opened there */
function stopLive() {
  if (!live) return;
  /* time with the mic or the beat running is practice: it counts on the Tour Map (3.19.0) */
  if (live.at) { journalPractice(data, (Date.now() - live.at) / 1000); Tabs.save(data); }
  clearInterval(live.timer); live.track?.stop(); live.timeouts?.forEach(clearTimeout);
  live.stream?.getTracks().forEach(t => t.stop()); live.src?.disconnect?.();
  live = null;
}
onLeave(stopLive);

/* ---------- the neck ---------- */
/* 4.21.0: the lesson of the day first (warm up, the change your songs need, then that song's section at
   70%), one Start in thumb reach, and your skills as three bars; every lesson is a tap away. */
const lessonTitle = l => `${l.learn.a} to ${l.learn.b}, then ${l.play.secName ? `the ${l.play.secName}` : "the song"}`;
function startPart(l, i) {
  lessonKeep(data); Tabs.save(data);
  if (i === 0 || i === 1) {
    const p = i === 0 ? l.warm : l.learn;
    if (!chordSVG(p.a) || !chordSVG(p.b)) return toast("I don't have a shape for one of those chords yet.");
    return go("#/practice/" + encodeURIComponent(p.id));
  }
  if (!data.songs.some(s => s.id === l.play.songId)) return toast("That song isn't in your Songbook any more. A new lesson comes tomorrow.");
  const need = l.play.sec >= 0 ? LESSON_PASSES : 1;
  loopHooks.pass = (song, pass) => {
    if (song.id !== l.play.songId || pass < need) return;
    loopHooks.pass = null;
    const r = lessonDone(data, 2); Tabs.save(data);
    toast(r?.finished ? `Lesson of the day done: +${r.xp} XP` : r ? "That part of today's lesson is done" : "Nice");
  };
  openLessonSong(l.play.songId, l.play.sec, l.play.rate);
}
function lessonCard(l) {
  if (!l) return `<section class="pf-card ls-card"><div class="ls-top"><div><small class="ls-cap">Today's lesson</small><b class="ls-t">Add a song to start</b><p class="pf-line">Each day's lesson is built from your songs: the change they need most, then a real section to play.</p></div>${louie("happy", { pose: "point", size: 70 })}</div></section>`;
  const stepRow = (i, t, sub, mins) => { const st = l.done[i] ? "done" : l.now === i ? "now" : "next";
    return `<button class="ls-step ${st}" data-part="${i}" aria-label="${esc(t)}${st === "done" ? ", done" : st === "now" ? ", up now" : ""}"><span class="ls-n">${st === "done" ? icon("check") : i + 1}</span><span class="ls-tx"><b>${esc(t)}</b><small>${esc(sub)}</small></span><span class="ls-min">${mins}</span></button>`; };
  const where = l.play.secName ? `the ${l.play.secName}` : "it through";
  return `<section class="pf-card ls-card${l.finished ? " finished" : ""}" aria-label="Today's lesson">
    <div class="ls-top"><div><small class="ls-cap">${l.finished ? "Done for today" : "Today's lesson · 4 min"}</small><b class="ls-t">${esc(lessonTitle(l))}</b>
      <p class="pf-line">Built from ${esc(l.learn.song)}. It has ${esc(l.learn.a)} to ${esc(l.learn.b)} ${l.learn.times} time${l.learn.times === 1 ? "" : "s"}.</p></div>
      ${louie(l.finished ? "cheer" : "happy", { pose: l.finished ? "thumb" : "point", size: 70 })}</div>
    <div class="ls-steps">
      ${stepRow(0, `Warm up: ${l.warm.a} to ${l.warm.b}`, l.warm.why, "1 min")}
      ${stepRow(1, `Learn ${l.learn.a} to ${l.learn.b}`, "Slow, then on the click. The mic checks each landing", "2 min")}
      ${stepRow(2, `Play ${where} at ${Math.round(l.play.rate * 100)}%`, `${l.play.title}, looped in Practice mode. ${l.play.sec >= 0 ? (LESSON_PASSES === 2 ? "Twice through" : `${LESSON_PASSES} times through`) : "Once through"} counts`, "1 min")}
    </div>
    <div class="ls-tags"><span class="ls-xp">${l.finished ? "Earned" : "+"}${l.xp} XP</span>${l.learn.inSongs > l.learn.times ? `<span class="ls-more">In more of your songs: ${l.learn.inSongs} times in all</span>` : ""}</div>
  </section>`;
}
function skillsCard(levels) {
  const bar = (lv, c) => { const n = lv.steps.filter(s => s.state === "done").length, m = lv.steps.length;
    return `<div class="ls-bar"><small>${esc(lv.name === "Chord switches" ? "Switches" : lv.name)}</small><span><i style="width:${Math.round(n / Math.max(1, m) * 100)}%;background:${c}"></i></span><b>${n} of ${m}</b></div>`; };
  const pick = id => levels.find(l => l.id === id);
  return `<button class="pf-card ls-skills" id="ls-all" aria-label="Your skills. All lessons"><span class="ls-sk-h"><small class="ls-cap">Your skills</small><span class="ls-all">All lessons${icon("chev", "chev")}</span></span>
    <span class="ls-bars">${bar(pick("open"), "var(--accent)")}${bar(pick("switch"), "var(--good)")}${bar(pick("scales"), "var(--strings, var(--accent))")}</span></button>`;
}
/* 4.33.0: the neck is part of Rehearse now; its old address opens Rehearse at today's lesson */
export function renderNeck() { renderRehearse(); }
/* Today's lesson on Rehearse: what it is, three parts as a bar (each opens its part), and one button */
function todayCard(l) {
  if (!l) return lessonCard(l);
  const seg = i => { const st = l.done[i] ? "done" : l.now === i && !l.finished ? "now" : "next";
    const name = [`Warm up: ${l.warm.a} to ${l.warm.b}`, `Learn ${l.learn.a} to ${l.learn.b}`, `Play ${l.play.secName ? `the ${l.play.secName}` : "it through"}`][i];
    return `<button class="ls-step rh-seg ${st}" data-part="${i}" aria-label="Part ${i + 1}: ${esc(name)}${st === "done" ? ", done" : st === "now" ? ", up now" : ""}"><i></i></button>`; };
  const where = l.play.secName ? `the ${l.play.secName}` : "it through";
  return `<section class="pf-card ls-card rh-lesson${l.finished ? " finished" : ""}" id="rh-lesson" aria-label="Today's lesson">
    <div class="ls-top"><div><small class="ls-cap">${l.finished ? `Done for today · earned ${l.xp} XP` : "Today's lesson · 4 min"}</small><b class="ls-t">${esc(lessonTitle(l))}</b>
      <p class="pf-line">Warm up · Learn ${esc(l.learn.a)} to ${esc(l.learn.b)} · Play ${esc(where)} at ${Math.round(l.play.rate * 100)}%</p></div>
      ${louie(l.finished ? "cheer" : "happy", { pose: l.finished ? "thumb" : "point", size: 64 })}</div>
    <div class="rh-segs">${seg(0)}${seg(1)}${seg(2)}</div>
    <button class="${l.finished ? "btn" : "btn primary"} rh-lgo" id="ls-go">${l.finished ? `${icon("fretboard")}All lessons` : `${icon("play")}${l.done.some(Boolean) ? `Go on: part ${l.now + 1}` : "Start lesson"} · +${l.xp} XP`}</button>
  </section>`;
}
/* every lesson on the neck (before 4.21.0 this was the neck page itself) */
function renderSkills() {
  stopLive();
  backTo = "#/practice/skills";
  const { levels, next } = skillState(data);
  const fret = st => {
    const cls = st.kind === "check" ? "inlay" : "fret";
    return `<button class="pk-${cls} ${st.state}" data-id="${esc(st.id)}" data-state="${st.state}" aria-label="${esc(lessonName(st))}, ${st.state === "done" ? "done" : st.state === "now" ? "up next" : "locked"}">${st.kind === "check" ? "" : `<b>${esc(st.name)}</b><small>${st.state === "done" ? (st.n ? `${st.n}×` : "known") : st.state === "now" ? "next" : ""}</small>`}</button>`;
  };
  const done = lv => lv.steps.filter(s => s.state === "done").length;
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back to Rehearse">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">All lessons</h1>
    <p class="pf-since pk-skills-note">Frets are lessons. The inlays are level checks: play a real song through.</p>
    ${levels.map(lv => `<section class="pf-card pk-level${lv.soon ? " soon" : ""}" aria-label="${esc(lv.name)}">
      <h2>${esc(lv.name)}${lv.soon ? "" : `<span class="pk-count">${done(lv)} of ${lv.steps.length}</span>`}</h2>
      <p class="pf-line">${lv.soon ? "Coming. " : ""}${esc(lv.note)}</p>
      ${lv.soon ? "" : `<div class="pk-board">${lv.steps.map(fret).join("")}</div>`}
    </section>`).join("")}
    ${learningCard()}
    <button class="pf-card pk-hearcard" id="pk-hear">${icon("fork")}<span><b>What I hear</b><span class="pf-line">Check the microphone with your guitar: level, pitch and strums, live.</span></span>${icon("chev", "chev")}</button>
    ${next ? `<div class="s-dock"><button class="btn primary" id="pk-go">${icon("play")}${next.kind === "check" ? "Level check" : "Next: " + esc(lessonName(next))}</button></div>` : ""}`;
  $("back").onclick = () => go("#/practice");
  app.querySelectorAll("[data-song]").forEach(b => b.onclick = () => openAtSection(b.dataset.song));
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
/* Rehearse (4.33.0, one page): today's lesson (it was on the neck), Your changes (it takes in the soundcheck
   and the changes you dropped in gigs), your skills, and three more ways to practice. */
export function renderRehearse() {
  stopLive();
  backTo = "#/practice";
  const sc = soundcheck(data), missed = missedChanges(data), yc = changesToWork(data), l = lessonOfDay(data), { levels } = skillState(data);
  const learn = data.songs.filter(x => x.status === "learning" && x.format !== "tab").sort((a, b) => (b.opened || 0) - (a.opened || 0))[0]
    || data.songs.filter(x => x.format !== "tab").sort((a, b) => (b.opened || 0) - (a.opened || 0))[0];
  /* Your changes: today's soundcheck pairs first (while it's on), then the three your songs need most */
  const key = (a, b) => [a, b].sort().join(">"), byKey = new Map(yc.work.map(c => [key(c.a, c.b), c]));
  const scOn = sc.pairs.length && !sc.done;
  const rows = [];
  if (scOn) for (const p of sc.pairs) {
    const c = byKey.get(key(p.a, p.b));
    rows.push({ ...(c || { a: p.a, b: p.b, tried: false, rate: 0 }), id: p.id, sc: true, done: p.done,
      why: p.n ? `Dropped ${p.n}× in your gigs this week` : c?.why || "Today's warm-up" });
  }
  for (const c of yc.work) if (rows.length < 3 && !rows.some(r => key(r.a, r.b) === key(c.a, c.b))) rows.push(c);
  const shown = new Set(rows.map(r => key(r.a, r.b))), moreMissed = missed.filter(p => !shown.has(key(p.a, p.b))).slice(0, 8);
  const count = ["one", "two", "three"][rows.length - 1] || rows.length;
  const changes = rows.length ? `<section class="rh-yc" aria-label="Your changes">
      <div class="rh-yct"><div><b>Your changes</b><small>${scOn ? `Soundcheck: drill ${sc.pairs.length === 1 ? "the one marked" : "both marked"} for +${SOUNDCHECK_XP} XP` : sc.done ? "Soundcheck done for today" : "The ones your songs need most and you land least"}</small></div></div>
      ${rows.map(c => `<div class="rh-ycr${c.sc ? " sc" : ""}${c.done ? " ok" : ""}"><div class="rh-ycx"><b>${esc(c.a)} <i>→</i> ${esc(c.b)}${c.sc ? `<em class="rh-scb">${c.done ? "Done" : "Soundcheck"}</em>` : ""}</b><small>${esc(c.why)}</small>
          <span class="rh-ycm"><span><i style="width:${Math.max(4, Math.round((c.rate || 0) * 100))}%"></i></span><em>${c.tried ? `Landed ${c.landed} of ${c.of}` : "Not tried yet"}</em></span></div>
        <button class="btn sm rh-ycd" data-drill="${esc(c.id)}" aria-label="Drill ${esc(c.a)} to ${esc(c.b)}">Drill</button></div>`).join("")}
      ${yc.solid && !shown.has(key(yc.solid.a, yc.solid.b)) ? `<p class="rh-ycs"><span class="ls-n">${icon("check")}</span>${esc(yc.solid.a)} to ${esc(yc.solid.b)} is solid: landed ${yc.solid.landed} of ${yc.solid.of} this week</p>` : ""}
      ${moreMissed.length ? `<button class="rh-more" id="rh-missed">Other changes you dropped<span class="rh-n">${moreMissed.length}</span>${icon("chev", "chev")}</button>
      <div class="rh-pairs" id="rh-pairs" hidden>${moreMissed.map(p => `<button class="rh-pair" data-id="${esc(p.id)}"><b>${esc(p.a)} to ${esc(p.b)}</b><small>missed ${p.n}×</small></button>`).join("")}</div>` : ""}
      <button class="btn primary rh-ycall" id="rh-ycall">${icon("play")}Drill all ${count} · ${rows.length} min${scOn ? ` · +${SOUNDCHECK_XP} XP` : ""}</button>
    </section>` : `<section class="rh-yc rh-yc-none" aria-label="Your changes"><div class="rh-yct"><div><b>Your changes</b><small>Add songs with chords and the changes they need show up here, with how often you land them in gigs.</small></div></div></section>`;
  const tile = (id, ic, t) => `<button class="rh-tile" id="${id}"><span class="rh-ic">${icon(ic)}</span><b>${t}</b></button>`;
  app.innerHTML = `<div class="rh">
    <div class="tq-top">${statBar()}</div>
    <h1 class="rh-h1">Rehearse</h1>
    ${todayCard(l)}
    ${changes}
    ${skillsCard(levels)}
    <h2 class="tq-h"><span>MORE WAYS TO PRACTICE</span></h2>
    <div class="rh-tiles">
      ${tile("rh-band", "metro", "Sit in with the band")}
      ${tile("rh-tuner", "fork", "Tuner")}
      ${tile("rh-hear", "mic", "What I hear")}
    </div>
  </div>`;
  bindStatBar();
  $("ls-go")?.addEventListener("click", () => l.finished ? go("#/practice/skills") : startPart(l, l.now));
  app.querySelectorAll(".ls-step").forEach(b => b.onclick = () => startPart(l, +b.dataset.part));
  $("ls-all").onclick = () => go("#/practice/skills");
  $("rh-missed")?.addEventListener("click", () => { $("rh-pairs").hidden = !$("rh-pairs").hidden; });
  app.querySelectorAll(".rh-pair").forEach(b => b.onclick = () => { drillQueue = []; go("#/practice/" + encodeURIComponent(b.dataset.id)); });
  app.querySelectorAll(".rh-ycd").forEach(b => b.onclick = () => { drillQueue = []; go("#/practice/" + encodeURIComponent(b.dataset.drill)); });
  $("rh-ycall")?.addEventListener("click", () => { const todo = rows.filter(r => !r.done); const list = (todo.length ? todo : rows).map(c => c.id); drillQueue = list.slice(1); go("#/practice/" + encodeURIComponent(list[0])); });
  $("rh-band").onclick = () => learn ? openAtSection(learn.id) : toast("Add a song with chords to sit in with the band.");
  $("rh-tuner").onclick = () => openTuner();
  $("rh-hear").onclick = () => go("#/practice/hear");
}

/* Learning (3.21.0): the songs you're learning, each with the one thing to do next and how far along
   it is (plays toward five). A tap opens the song, already in Practice mode. */
const GOAL_PLAYS = 5;
function learningCard() {
  const songs = data.songs.filter(s => s.status === "learning").sort((a, b) => (b.opened || 0) - (a.opened || 0)).slice(0, 8);
  if (!songs.length) return `<section class="pf-card pk-learn"><h2>Learning</h2><p class="pf-line">Mark a song as Learning (the chip under its title) and it shows up here, with what to work on next.</p></section>`;
  const nextFor = s => {
    const rate = practiceRate({ ...s, practice: { on: true, ...(s.practice || {}) } });
    if (s.loop?.name) return `<b>${esc(s.loop.name)}${rate < 1 ? ` at ${Math.round(rate * 100)}%` : ""}</b>`;
    if (rate < 1) return `<b>Bring it up from ${Math.round(rate * 100)}%</b>`;
    return playCount(s) ? "<b>Play it through again</b>" : "<b>Play it through once</b>";
  };
  const cover = s => /^https:\/\//.test(s.listen?.art || s.art || "") ? `<img src="${esc(s.listen?.art || s.art)}" alt="">` : `<span>${esc((s.title || "?").slice(0, 1))}</span>`;
  return `<section class="pf-card pk-learn"><h2>Learning<span class="pk-count">${songs.length} song${songs.length === 1 ? "" : "s"}</span></h2>
    ${songs.map(s => { const n = Math.min(GOAL_PLAYS, playCount(s)); return `<button class="pk-song" data-song="${esc(s.id)}">
      <i class="pk-cover">${cover(s)}</i><span class="pk-tx"><span class="pk-t">${esc(s.title)}</span><span class="pk-s">Next: ${nextFor(s)} · ${n} of ${GOAL_PLAYS} plays</span>
      <span class="pk-meter"><i style="width:${Math.round(n / GOAL_PLAYS * 100)}%"></i></span></span>${icon("chev", "chev")}</button>`; }).join("")}
  </section>`;
}

/* ---------- one lesson ---------- */
export function renderSession(id) {
  stopLive();
  if (id === "hear") return whatIHear();
  if (id === "skills") return renderSkills();
  const hit = find(id);
  if (id === "neck") return renderNeck();
  /* a switch that isn't on the neck (a change you dropped in a gig) */
  const m = !hit && /^s:([^-]+)-(.+)$/.exec(id);
  if (m && chordSVG(m[1]) && chordSVG(m[2])) return switchLesson({ id, kind: "switch", a: m[1], b: m[2], to: 80, state: "now" });
  /* 4.19.0: a chord that isn't on the neck (Learn it from the chord passport) */
  const mc = !hit && /^c:(.+)$/.exec(id);
  if (mc && chordSVG(mc[1]) && chordTargets(mc[1], "standard").some(t => t.hz)) return chordLesson({ id, kind: "chord", chord: mc[1], state: "now" });
  /* a chord lesson opens even before its fret on the neck (Learn it from the chord passport, 4.19.0) */
  if (!hit || (hit.st.state === "locked" && hit.st.kind !== "chord" && hit.st.kind !== "switch") || hit.st.kind === "check") return go("#/practice");
  hit.st.kind === "chord" ? chordLesson(hit.st) : hit.st.kind === "scale" ? scaleLesson(hit.st) : switchLesson(hit.st);
}

/* 4.24.0: the tuner from inside the neck, so practice doesn't mean going all the way out to tune */
const tuneBtn = () => `<button class="ib chunky-tune pk-tune" id="pk-tune" aria-label="${tunedRecently() ? "Tuner" : "Tuner. Not tuned in the last few hours"}">${icon("fork")}${tunedRecently() ? "" : '<i class="dotmark"></i>'}</button>`;
function bindTune() {
  const b = $("pk-tune"); if (!b) return;
  b.onclick = () => {
    live?.idle ? live.idle("Tune up, then tap Start listening.") : stopLive(); /* one thing uses the mic at a time */
    openTuner("standard", () => { const d = $("pk-tune"); if (d && tunedRecently()) { d.querySelector(".dotmark")?.remove(); d.setAttribute("aria-label", "Tuner"); } });
  };
}
const head = (title, sub) => `<div class="head"><button class="ib glass" id="back" aria-label="${backTo === "#/practice/skills" ? "Back to All lessons" : "Back to Rehearse"}">${icon("back")}</button>${tuneBtn()}</div>
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

/* 4.23.1: while the mic is on, Start listening reads "Listening · tap to stop". It comes back by itself
   when the mic stops (the screen locks, a call, the app goes away, another app takes the mic), so a
   lesson never sits on a dead button. */
function listening(say) {
  const b = $("pk-start"); if (!b || !live) return;
  b.disabled = false; b.classList.add("on"); b.innerHTML = `<i class="pk-rec" aria-hidden="true"></i>Listening · tap to stop`;
  const idle = msg => {
    stopLive();
    const e = $("pk-start"); if (!e) return;
    e.classList.remove("on"); e.disabled = false; e.innerHTML = `${icon("fork")}Start listening`;
    if (msg) say(msg);
  };
  live.idle = idle;
  live.stream?.getTracks().forEach(t => t.addEventListener("ended", () => live?.idle === idle && idle("The microphone stopped. Tap Start listening to go on.")));
}
document.addEventListener("visibilitychange", () => { if (document.hidden && live?.idle) live.idle("Paused while the app was away. Tap Start listening to go on."); });

/* A chord, one string at a time: the lowest string not yet lit is the one listened for (tap a lamp
   to pick another). Its lamp glows warm while it waits. Three readings in a row decide. */
function stringGuide(targets, box) {
  const order = targets.filter(t => t.hz), lit = new Set();
  let k = 0, streak = { say: "", n: 0 }, dull = 0, toldAt = 0;
  /* for the readings: what was heard while each string was awaited */
  const log = new Map(order.map(t => [t.i, { reads: 0, loud: 0, near: 0, dull: 0, other: {} }]));
  const lamp = i => box.querySelector(`.pk-str[data-i="${i}"]`);
  const paint = () => order.forEach((t, j) => { const e = lamp(t.i); e?.classList.toggle("cur", j === k && !lit.has(t.i)); e?.querySelector(".gs-lamp")?.classList.toggle("warm", j === k && !lit.has(t.i)); });
  const reset = () => { streak = { say: "", n: 0 }; dull = 0; };
  const next = () => { for (let n = 1; n <= order.length; n++) { const j = (k + n) % order.length; if (!lit.has(order[j].i)) { k = j; break; } } reset(); paint(); };
  order.forEach((t, j) => { const e = lamp(t.i); if (e) e.onclick = () => { if (!lit.has(t.i)) { k = j; reset(); paint(); } }; });
  paint();
  return {
    cur: () => lit.size < order.length ? order[k] : null,
    done: () => lit.size >= order.length,
    count: () => lit.size,
    /* one line per string not lit: how long it was awaited and what came instead */
    report: () => order.filter(t => !lit.has(t.i) && log.get(t.i).reads).map(t => {
      const g = log.get(t.i), pc = n => Math.round(n / g.reads * 100) + "%";
      const other = Object.entries(g.other).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} ×${c}`).join(", ");
      return `${t.note}${nearestNote(t.hz).octave} on the ${strName(t.i, "standard")} string: ${(g.reads * 0.05).toFixed(0)} s, sounding ${pc(g.loud)}, near its note ${pc(g.near)}, no clear pitch ${pc(g.dull)}${other ? `, other notes ${other}` : ""}`;
    }),
    /* a buffer in: what happened, if anything ({ t, say }). say: ring, open, low, high, muted, or wrong (with note) */
    hear(buf, rate, floor, rms) {
      const t = order[k];
      if (!t || lit.has(t.i)) return null;
      const g = log.get(t.i); g.reads++;
      const sounding = rms > pitchRms(floor) * 2;
      if (sounding) g.loud++;
      const hz = detectPitch(buf, rate, pitchRms(floor), 0.6, stringRange(t));
      const say = judgeTarget(hz, t);
      if (say) g.near++;
      else if (hz > 0) { const nn = nearestNote(hz); g.other[nn.name + nn.octave] = (g.other[nn.name + nn.octave] || 0) + 1; }
      else if (sounding) g.dull++;
      /* a string that sounds but has no clear pitch for half a second: muted or buzzing (3.9.1) */
      dull = !say && hz <= 0 && rms > buzzRms(floor) * 0.5 ? dull + 1 : 0;
      if (dull === 9 && Date.now() - toldAt > 2000) { toldAt = Date.now(); return { t, say: "muted" }; }
      if (!say) {
        if (hz > 0) { const nn = nearestNote(hz); streak = streak.say === "wrong" && streak.note === nn.name + nn.octave ? { ...streak, n: streak.n + 1 } : { say: "wrong", note: nn.name + nn.octave, n: 1 }; if (streak.n === 4 && Date.now() - toldAt > 2000) { toldAt = Date.now(); return { t, say: "wrong", note: streak.note }; } }
        else streak = { say: "", n: 0 };
        return null;
      }
      streak = streak.say === say ? { say, n: streak.n + 1 } : { say, n: 1 };
      if (streak.n !== 3) return null;
      if (say === "ring") { lit.add(t.i); lamp(t.i)?.querySelector(".gs-lamp")?.classList.add("on"); next(); }
      return { t, say };
    }
  };
}
/* what to tell the player about one string */
const stringAdvice = (ev, nm) => ({
  open: `The ${nm} string is ringing open. Press it just behind fret ${ev.t.fret}.`,
  low: `The ${nm} string sounds a fret low. Check which fret that finger is on.`,
  high: `The ${nm} string sounds a fret high. Check which fret that finger is on.`,
  muted: `The ${nm} string sounds muted. A finger may be resting on it: arch your fingers and press with the tips.`,
  wrong: `That sounds like ${ev.note}, not the ${nm} string's ${ev.t.note}. Pluck only the ${nm} string.`
})[ev.say] || "";
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
  $("back").onclick = () => go(backTo); bindTune();
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const finish = (heard = true) => {
    stopLive();
    skillDone(data, st.id, 0);
    const secs = (Date.now() - t0) / 1000; Tabs.save(data);
    done(st, { secs, line: heard ? `Every string rang clean.` : "Marked as got." });
  };
  $("pk-self").onclick = () => finish(false);
  $("pk-start").onclick = () => {
    if (live?.idle) return live.idle("Stopped. Tap Start listening when you're ready.");
    $("pk-start").disabled = true; say("Starting the microphone…");
    mic().then(stream => {
      const ctx = sound();
      if (!ctx) throw new Error("none");
      const an = ctx.createAnalyser(); an.fftSize = 4096;
      const src = ctx.createMediaStreamSource(stream); src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let told = 0, floor = null;
      const guide = stringGuide(targets, app.querySelector(".pk-strings"));
      const ask = () => { const t = guide.cur(); if (t) say(`Pluck the ${strName(t.i, tuning)} string${fretText(t)}.`); };
      live = { at: Date.now(), stream, src, timer: setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        floor = trackFloor(floor, rms);
        const ev = guide.hear(buf, ctx.sampleRate, floor, rms);
        if (ev?.say === "ring") { if (guide.done()) return finish(); say(`${strName(ev.t.i, tuning)}: clean.`); setTimeout(ask, 700); }
        else if (ev?.say && Date.now() - told > 1500) { told = Date.now(); say(stringAdvice(ev, strName(ev.t.i, tuning))); }
      }, 45) };
      ask();
      listening(say);
    }).catch(() => fail());
    const fail = () => { $("pk-start").hidden = true; say("I can't use the microphone here. Play the chord, then tap \"I can't hear it, I got it\"."); };
  };
}

/* ---------- Scale lesson (3.21.0) ----------
   The scale on a neck diagram, then up and back down one note at a time: the next note glows, and it
   lights when it is heard (three readings in a row, any octave). Hear it plays the scale first. */
function scaleSVG(targets, k, lit) {
  const up = targets.slice(0, Math.ceil(targets.length / 2) + 1), frets = up.map(t => t.fret);
  const lo = Math.max(0, Math.min(...frets) - (Math.min(...frets) > 0 ? 1 : 0)), hi = Math.max(...frets, lo + 4);
  const W = 320, H = 150, x0 = 26, x1 = W - 10, y0 = 18, y1 = H - 18, n = hi - lo + 1, fw = (x1 - x0) / n, sy = (y1 - y0) / 5;
  const yOf = i => y1 - i * sy, xOf = f => f === 0 ? x0 - 12 : x0 + (f - lo - 0.5) * fw;
  let g = "";
  for (let f = 0; f <= n; f++) g += `<line class="${f === 0 && lo === 0 ? "nut" : "fr"}" x1="${x0 + f * fw}" y1="${y0}" x2="${x0 + f * fw}" y2="${y1}"/>`;
  for (let i = 0; i < 6; i++) g += `<line class="st" x1="${x0}" y1="${yOf(i)}" x2="${x1}" y2="${yOf(i)}"/>`;
  for (let f = lo + 1; f <= hi; f++) if ([3, 5, 7, 9, 12].includes(f)) g += `<text class="fn" x="${xOf(f)}" y="${H - 2}">${f}</text>`;
  const cur = targets[k], seen = new Set();
  up.forEach((t, j) => {
    const key = t.i + ":" + t.fret;
    if (seen.has(key)) return; seen.add(key);
    const on = cur && cur.i === t.i && cur.fret === t.fret, done = targets.some((x, m) => lit.has(m) && x.i === t.i && x.fret === t.fret);
    g += `<g class="sn${on ? " cur" : ""}${done ? " lit" : ""}" data-j="${j}"><circle cx="${xOf(t.fret)}" cy="${yOf(t.i)}" r="10"/><text x="${xOf(t.fret)}" y="${yOf(t.i) + 4}">${esc(t.note)}</text></g>`;
  });
  return `<svg class="pk-scale" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale on the neck">${g}</svg>`;
}
function scaleLesson(st) {
  const sc = SCALES[st.scale], targets = scaleTargets(st.scale), t0 = Date.now();
  let k = 0;
  const lit = new Set();
  app.innerHTML = `${head(sc.name, sc.where)}
    <section class="pf-card pk-lesson">
      <div class="pk-scalebox" id="pk-board">${scaleSVG(targets, k, lit)}</div>
      <div class="pk-notes" id="pk-notes" aria-hidden="true">${targets.map((_, j) => `<i data-j="${j}"></i>`).join("")}</div>
      <div class="rd-say pk-say">${louie("happy", { pose: "point", size: 84 })}<p class="rd-bubble" id="pk-say" aria-live="polite">${esc(sc.tip)} Tap Hear it, then play it up and back down, one note at a time.</p></div>
    </section>
    <div class="s-dock"><button class="btn primary" id="pk-start">${icon("fork")}Start listening</button><button class="tb" id="pk-play">${icon("play")}Hear it</button><button class="tb" id="pk-self">I got it</button></div>`;
  $("back").onclick = () => go(backTo); bindTune();
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const paint = () => {
    const b = $("pk-board"); if (b) b.innerHTML = scaleSVG(targets, k, lit);
    app.querySelectorAll("#pk-notes i").forEach(e => { const j = +e.dataset.j; e.className = lit.has(j) ? "on" : j === k ? "cur" : ""; });
  };
  paint();
  const ask = () => { const t = targets[k]; if (t) say(`${t.note} on the ${strName(t.i, "standard")} string, ${t.fret ? `fret ${t.fret}` : "open"}${k >= targets.length / 2 ? ". On the way down" : ""}.`); };
  const finish = (heard = true) => {
    stopLive();
    skillDone(data, st.id, 0); Tabs.save(data);
    done(st, { secs: (Date.now() - t0) / 1000, line: heard ? `${sc.name}, up and back down.` : "Marked as got." });
  };
  $("pk-self").onclick = () => finish(false);
  /* Hear it: each note plucked in turn (a soft triangle tone), up and back down */
  $("pk-play").onclick = () => {
    if (live?.idle) live.idle(); else stopLive();
    const ctx = sound(); if (!ctx) return toast("The phone won't play sound here.");
    const at = ctx.currentTime + 0.05, gap = 0.34;
    /* the board follows the notes as they sound (3.24.1) */
    targets.forEach((_, j) => setTimeout(() => { if ($("pk-board")) { k = j; paint(); } }, 50 + j * gap * 1000));
    setTimeout(() => { if ($("pk-board") && !live) { k = 0; paint(); } }, 50 + targets.length * gap * 1000);
    targets.forEach((t, j) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), when = at + j * gap;
      o.type = "triangle"; o.frequency.value = t.hz;
      g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.35, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + gap * 1.6);
      o.connect(g); g.connect(ctx.destination); o.start(when); o.stop(when + gap * 1.7);
    });
    say("Listen to it go up and back down. Then press Start listening and play along.");
  };
  $("pk-start").onclick = () => {
    if (live?.idle) return live.idle("Stopped. Tap Start listening when you're ready.");
    $("pk-start").disabled = true; say("Starting the microphone…");
    mic().then(stream => {
      const ctx = sound();
      if (!ctx) throw new Error("none");
      const an = ctx.createAnalyser(); an.fftSize = 4096;
      const src = ctx.createMediaStreamSource(stream); src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let floor = null, streak = 0, wrong = { note: "", n: 0 }, told = 0;
      live = { at: Date.now(), stream, src, timer: setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
        floor = trackFloor(floor, rms);
        const t = targets[k]; if (!t) return;
        const hz = detectPitch(buf, ctx.sampleRate, pitchRms(floor), 0.6, [t.hz * 0.45, t.hz * 2.2]);
        if (judgeTarget(hz, t) === "ring") {
          wrong = { note: "", n: 0 };
          if (++streak < 3) return;
          streak = 0; lit.add(k); k++;
          paint();
          if (k >= targets.length) return finish();
          ask();
        } else {
          streak = 0;
          if (hz > 0) {
            const nn = nearestNote(hz).name;
            wrong = wrong.note === nn ? { note: nn, n: wrong.n + 1 } : { note: nn, n: 1 };
            if (wrong.n === 6 && Date.now() - told > 2000) { told = Date.now(); say(`That's ${nn}. Next is ${t.note} on the ${strName(t.i, "standard")} string, ${t.fret ? `fret ${t.fret}` : "open"}.`); }
          }
        }
      }, 45) };
      ask();
      listening(say);
    }).catch(() => { $("pk-start").hidden = true; say("I can't use the microphone here. Play it through, then tap \"I got it\"."); });
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
    $("back").onclick = () => go(backTo); bindTune();
    $("pk-self").onclick = () => finish(bpm, "Marked as got.");
    $("pk-start").onclick = start;
  };
  const say = t => { const e = $("pk-say"); if (e) e.textContent = t; };
  const finish = (at, line) => {
    stopLive();
    const part = lessonPartOf(data, st.id); /* 4.21.0: part of today's lesson? (before it counts as learned) */
    if (part >= 0) lessonKeep(data);
    skillDone(data, st.id, at);
    const sc = soundcheckDone(data, st.id); /* Rehearse (4.8.0): part of today's soundcheck? */
    const ls = part >= 0 ? lessonDone(data, part) : null;
    const secs = (Date.now() - t0) / 1000; Tabs.save(data);
    const more = ls?.finished ? ` Lesson of the day done: +${ls.xp} XP.` : ls ? ` Part ${part + 1} of today's lesson done.` : "";
    done(st, { secs, line: (sc?.done ? `${line} Soundcheck done: +${sc.xp} XP.` : sc ? `${line} One more change for today's soundcheck.` : line) + more, bpm: at, sc: sc || ls });
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
    live = { at: Date.now(), stream, timeouts: [] };
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
function done(st, { secs, line, bpm = 0, sc = null }) {
  const { levels } = skillState(data), lv = levels.find(l => l.steps.some(s => s.id === st.id)) || { name: "Soundcheck", steps: [] };
  const have = lv.steps.filter(s => s.state === "done").length, total = lv.steps.length;
  const chords = st.kind === "chord" ? [st.chord] : [st.a, st.b];
  const sg = st.kind === "scale" ? null : data.songs.find(s => chords.every(c => new RegExp("\\[" + c.replace("#", "\\#") + "(?![#b\\w])").test(s.body || ""))) || data.songs.find(s => new RegExp("\\[" + chords[0] + "(?![#b\\w])").test(s.body || ""));
  const nxt = skillState(data).next;
  const queued = drillQueue[0] || null, qm = queued && /^s:([^-]+)-(.+)$/.exec(queued);
  const m = Math.floor(secs / 60), s = Math.round(secs % 60);
  app.innerHTML = `${head(lessonName(st), "Done")}
    <div class="rd-first">${louie("happy", { pose: "thumb", size: 170 })}<p class="rd-first-t">${esc(line)}</p></div>
    <div class="pf-plate" role="group" aria-label="Lesson numbers">
      <div class="pf-read"><b>${m}:${String(s).padStart(2, "0")}</b><span>this lesson</span></div>
      <div class="pf-read"><b>${bpm || (data.skills?.done?.[st.id]?.n || 1) + "×"}</b><span>${bpm ? "BPM" : "practiced"}</span></div>
      ${total ? `<div class="pf-read"><b>${have}/${total}</b><span>${esc(lv.name.toLowerCase())}</span></div>` : ""}
    </div>
    <div class="s-dock">${sg ? `<button class="btn primary" id="pk-song">${icon("play")}Play ${esc(sg.title)}</button>` : ""}<button class="${sg && !qm ? "tb" : "btn primary"}" id="pk-next">${qm ? `Next: ${esc(qm[1])} to ${esc(qm[2])}` : nxt && nxt.kind !== "check" && !sc && backTo !== "#/practice" ? "Next: " + esc(lessonName(nxt)) : backTo === "#/practice" ? "Back to Rehearse" : "Back to All lessons"}</button></div>`;
  $("back").onclick = () => go(backTo); bindTune();
  $("pk-song")?.addEventListener("click", () => playSong(sg.id));
  $("pk-next").onclick = () => { if (qm) { drillQueue.shift(); return go("#/practice/" + encodeURIComponent(queued)); } nxt && nxt.kind !== "check" && !sc && backTo !== "#/practice" ? go("#/practice/" + encodeURIComponent(nxt.id)) : go(backTo); };
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
  const beatAt = [], alongLane = []; /* every beat played, audio time; the level while strumming with the beat */
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
  $("back").onclick = () => go(backTo); bindTune();
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
      live = { at: Date.now(), stream, src, ctx, timeouts: [], floor: strum.floor, timer: setInterval(() => {
        const now = ctx.currentTime;
        fast.getFloatTimeDomainData(fb);
        let rms = 0; for (const v of fb) rms += v * v; rms = Math.sqrt(rms / fb.length);
        lane.push([now, rms]); while (lane.length && now - lane[0][0] > 4.2) lane.shift();
        st.frames++; st.peak = Math.max(st.peak, rms);
        if (measuring) { const lb = lastBeat(now); if (lb) prof.add(lb.since, lb.one, rms); strum(rms, now, 1); return; }
        if (along) alongLane.push([now, rms, strumLine(strum.floor(), bleedNow(now))]);
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
        const ev = guide?.hear(sb, ctx.sampleRate, strum.floor(), rms);
        if (ev?.say) {
          const nm = strName(ev.t.i, "standard");
          if (ev.say === "ring") { st.lit[chord] = guide.count(); const nx = guide.cur(); say(nx ? `${nm} string: clean. Next, the ${strName(nx.i, "standard")} string${fretText(nx)}.` : `${nm} string: clean. Every string of ${chord} rang.`); }
          else say(stringAdvice(ev, nm));
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
    beatAt.length = 0; alongLane.length = 0; prof = bleedProfile(); along = null;
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
      /* each 1: was a strum there, and how loud against the line (so a miss says whether it was the playing or the listening) */
      st.bars = dues.map((d, k) => {
        const win = alongLane.filter(([t]) => t >= d - 0.6 * spb && t <= d + 1.2 * spb);
        const top = win.reduce((a, x) => x[1] > a[1] ? x : a, [d, 0, 0]);
        const caught = (along || []).filter(o => o >= d - 0.6 * spb && o <= d + 1.2 * spb).sort((a, b) => Math.abs(a - d) - Math.abs(b - d))[0];
        return `${k + 1}: ${caught !== undefined ? `strum at ${caught - d >= 0 ? "+" : ""}${((caught - d) * 1000).toFixed(0)} ms` : "none caught"}, loudest ${(top[1] * 100).toFixed(1)} at ${top[0] - d >= 0 ? "+" : ""}${((top[0] - d) * 1000).toFixed(0)} ms, line ${(top[2] * 100).toFixed(1)}`;
      });
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
      ...(st.bars ? ["Each 1: " + st.bars.join(" · ")] : []),
      ...(guide ? guide.report() : []),
      st.grade?.started ? "With the beat: not finished (it takes about 17 seconds)" : st.grade ? `With the beat: ${st.grade.on} of 4 on the 1, ${st.grade.late} late, ${st.grade.early} early, ${st.grade.miss} not heard` : "",
      `Strums caught ${st.strums} · pitch clear ${pct(st.pitched, reads)} of reads · buzzy ${pct(st.buzzy, reads)}`,
      `Notes heard: ${top || "none"}`,
      chord ? `${chord}: strings lit ${st.lit[chord] || 0} of ${chordTargets(chord).filter(t => t.hz).length}` : "",
      `Settings: ${Object.entries(HEAR).map(([k, v]) => `${k} ${v}`).join(", ")}`
    ].filter(Boolean).join("\n");
    navigator.clipboard?.writeText(text).then(() => toast("Readings copied. Paste them into a message."), () => toast("Couldn't copy here."));
  };
}
