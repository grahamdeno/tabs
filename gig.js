// The Gig (4.1.0): a song played as a show. It sits over the song page while the song plays
// as it always does underneath (auto-scroll, the recording or the band), and reads where the song is from the page.
//
//   top       the section you're in (in its colour) and your run: changes played since the last pause
//   crowd     the crowd as a row of 12 fans that gets on its feet as the song goes
//   lines     the song page itself (4.51.0): the Gig is see-through in the middle, and stage.js draws the band
//             and the chords on the real sheet, so you read, scroll and drag the song itself. A small shape for
//             the next chord you haven't learned.
//   bottom    Pause, in thumb reach
// Paused (4.52.0), the show steps aside and the song page is back as it always is: Tools and Play (reading
// Resume) in thumb reach, a quiet band on the line you stopped on, and Louie's line above Play when there is
// one to say. Play picks the show up again; the page's Back, or Tools for anything but the switches, ends it.
// 4.91.0: the show no longer listens. A chord change counts when the song carries it past the reading line while
// playing (not dragged past, not paused); see gigStart in core/game.js and docs/NO-CATCH-PLAN.md.
// At the end: Show complete, under the backdrop you wear (4.66.0, Change picks another you own), with the bonus fans,
// tips, the crowd, the song's stars, the song you played and Encore (play it again for double bonus fans).
import { COMBO_STEPS, KNOW_PLAYS, STAR_NAMES, roadNote, gigStart, showPlayed, showPaused, showWhole, catchTargets, catchStart, catchAt, catchClose, gigCrowd, knownChords, gigDone, questsSettle, bandParts, bandMeet, streakOf, playSongs, playableSongs, merchTip, Tabs } from "./core.js";
import { backdropBanner, backdropsOwned, wearBackdrop } from "./merch.js";
import { esc, icon, onLeave } from "./ui.js";
import { showCallout, data, diag, scroll, viewing, startScroll, stopScroll, loopFactor, gigHooks, go, chordSVG, homeHooks, redraw } from "./app.js";
import { louie } from "./louie.js";
import { friend, FRIENDS } from "./friends.js";
import { where, sections, stageStart, stageClear, stageTick } from "./stage.js";
import { gigDoneHere, gigFrame, gigOpen, gigPaused, gigResumed, hideStrip } from "./opening.js";

let gig = null; /* the show on stage, or null */
const $ = id => document.getElementById(id);

/* ---- the screen ---- */

function shell(song) {
  const el = document.createElement("div");
  el.id = "gig"; el.className = "gig"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `Gig: ${song.title}`);
  /* 4.66.0: no X and no backdrop: the show is the song page itself, left with the page's own Back */
  el.innerHTML = `
    <div class="gg-top">
      <span class="gg-sec" id="gg-sec">Get ready</span>
      <span class="gg-combo" id="gg-combo"></span>
    </div>
    <div class="gg-status"><span class="gg-fans" id="gg-fans" role="img" aria-label="Crowd"></span></div>
    <div class="gg-shape" id="gg-shape" hidden></div>
    <p class="sr-only" id="gg-live" role="status" aria-live="polite"></p>
    <div class="gg-bottom">
      <button class="gg-pause" id="gg-pause" aria-label="Pause">${icon("pause")}</button>
    </div>
`;
  document.body.appendChild(el);
  return el;
}

/* a small shape for a chord you haven't learned yet, beside the lines */
function paintShape() {
  const g = gig, el = $("gg-shape");
  if (!g || !el || !g.catch) return;
  /* the chord you're on if you haven't learned it, else the next one you haven't learned */
  const c = g.catch, now = c.targets[c.cur], next = c.targets[c.cur + 1];
  const pick = [[now, "NOW"], [next, "NEXT"]].find(([t]) => t && !g.known.has(t.name) && chordSVG(t.name, 1));
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
  const crowd = gigCrowd(g.score);
  const fans = $("gg-fans");
  /* 4.49.10: the crowd as 12 fans; the ones on their feet stand up and throw their hands up */
  if (!fans.children.length) fans.innerHTML = Array.from({ length: 12 }, () => `<i>${FAN}</i>`).join("");
  const on = new Set(CROWD_ORDER.slice(0, crowd));
  [...fans.children].forEach((e, i) => { e.className = on.has(i) ? "on c" + (i % 4) : ""; });
  fans.setAttribute("aria-label", `Crowd: ${crowd} of 12 on their feet`);
  $("gg-combo").innerHTML = g.score.run >= 2 ? `${icon("check")}${g.score.run} in a row` : "";
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
  /* the chord changes of the song (once the sheet is laid out) */
  const seq = diag.seq || [];
  if (!g.catch && seq.length) { g.catch = catchStart(catchTargets(seq)); g.seqLen = seq.length; }
  if (!g.catch) return;
  if (seq.length !== g.seqLen) { g.catch = catchStart(catchTargets(seq)); g.seqLen = seq.length; g.score = gigStart(); g.idx = -1; g.played.clear(); } /* the sheet was edited: start the count again */
  if (w.idx >= 0 && w.idx !== g.idx) {
    const start = g.idx < 0;
    g.idx = w.idx;
    catchAt(g.catch, w.idx);
    if (start) { const above = catchClose(g.catch).missed.length; g.score.total = Math.max(0, g.catch.targets.length - above); } /* the chords above the reading line when the song starts aren't counted */
    paintShape();
  }
  /* the chords that went by while playing count as played */
  const gone = catchClose(g.catch).missed;
  if (gone.length) passed(g, gone, !counting && playing(g));
}

/* Is the show counting right now? Playing, past the count-in and not being dragged */
function playing(g) {
  return scroll.on && !document.querySelector(".countin") && performance.now() > g.dragUntil && !g.paused;
}
function passed(g, gone, on) {
  if (!on) return;
  for (const i of gone) g.played.add(i);
  showPlayed(g.score, gone.length);
  afterScore(g);
}
function afterScore(g) {
  paintScore();
  const flashEl = $("gg-combo"); if (flashEl) { flashEl.classList.remove("hit"); void flashEl.offsetWidth; flashEl.classList.add("hit"); }
  /* 4.44.0 (#78): a run of 10, 25, 50 or 100 bursts over the show, once each per show */
  const r = g.score.run, step = COMBO_STEPS.filter(x => x <= r).pop();
  if (step && step > (g.comboShown || 0)) { g.comboShown = step; showCallout({ kind: "combo", word: "IN A ROW", big: `x${step}` }); }
}

/* A finger moves the song (4.2.2): the page itself scrolls under the see-through show (4.51.0). Changes
   passed while dragging aren't counted. */
function bindDrag(g) {
  const drag = () => { g.dragUntil = performance.now() + 700; };
  addEventListener("touchmove", drag, { passive: true });
  addEventListener("wheel", drag, { passive: true });
  document.addEventListener("stage-jump", drag); /* the rail's jump (4.54.0): the chords it skips aren't counted */
  g.unbind = () => { removeEventListener("touchmove", drag); removeEventListener("wheel", drag); document.removeEventListener("stage-jump", drag); };
}

/* Controls that hide (4.60.0, Graham, 2026-10-24): while the song plays, the X and Pause fade after
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
    const ok = scroll.on && !g.paused && !g.credited && !g.ended && !g.el.classList.contains("done") && !document.querySelector(".countin, .menu, .st-open");
    if (!ok) g.el.classList.remove("idle");
    else if (performance.now() - g.touch > 3000) g.el.classList.add("idle");
  }, 400);
  g.unbindIdle = () => { clearInterval(g.idleT); document.removeEventListener("click", eat, true); evs.forEach(ev => removeEventListener(ev, wake, { capture: true })); };
}

/* ---- open, pause, close ---- */
export function openGig(song, opts = {}) {
  closeGig(true);
  const g = gig = {
    song, encore: !!opts.encore, from: opts.from || "song", score: gigStart(), catch: null, seqLen: 0, played: new Set(), b: -1, idx: -1, gel: "", mood: "", dragUntil: 0,
    ended: false, paused: false, slowed: false
  };
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
  bindDrag(g);
  bindIdle(g);
  g.known = knownChords(data);
  paintScore();
  /* Opening night (4.40.0): the first verse waits for Count me in */
  const waits = gigOpen(g, g.el, () => { if (gig === g && !scroll.on) startScroll(song); });
  g.raf = requestAnimationFrame(frame);
  g.speedT = setInterval(() => { if (gig === g && scroll.on && loopFactor(song) < 0.999) g.slowed = true; }, 500); /* full speed, for stars and battles */
  if (!scroll.on && !waits) startScroll(song);
}
function paused(on) {
  const g = gig;
  if (!g) return;
  if (on && !g.paused && g.idx >= 0 && !g.ended) { showPaused(g.score); g.comboShown = 0; paintScore(); } /* a pause ends the run */
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
  clearInterval(g.speedT);
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
/* The song you played (4.54.0): every chord of the song by section, filled for the changes you played through */
function songPlayed(g) {
  if (!g.catch) return "";
  const secs = sections(), seq = diag.seq || [], groups = [];
  g.catch.targets.forEach((t, i) => {
    const y = seq[t.first]?.y ?? 0; let sec = null;
    for (const x of secs) if (x.y <= y + 1) sec = x;
    const key = sec ? sec.y : -1, last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(i); else groups.push({ key, name: sec?.name || "", gel: sec?.gel || "verse", items: [i] });
  });
  const chip = i => { const name = g.catch.targets[i].name, got = g.played.has(i); return `<li class="gc-ch ${got ? "got" : "skip"}" aria-label="${esc(name)}, ${got ? "played" : "not played"}">${esc(name)}</li>`; };
  return `<section class="gc-song"><h3>The song you played</h3>${groups.map(x => `<div class="gc-sec"><b class="gl-${x.gel}">${esc(x.name || "SONG").toUpperCase()}</b><ul>${x.items.map(chip).join("")}</ul></div>`).join("")}</section>`;
}
const starRow = n => `<span class="gc-stars" role="img" aria-label="${n} of 4 stars, ${STAR_NAMES[n]}">${[1, 2, 3, 4].map(k => `<i class="${k <= n ? "on" : ""}">★</i>`).join("")}</span>`;

function showComplete() {
  const g = gig;
  if (!g || g.ended) return;
  g.ended = true;
  cancelAnimationFrame(g.raf);
  clearInterval(g.speedT);
  /* the chords still below the reading line when the song ended were played too, unless it was paused */
  if (g.catch) { g.catch.cur = g.catch.targets.length; const rest = catchClose(g.catch).missed; if (rest.length && !g.paused) { for (const i of rest) g.played.add(i); showPlayed(g.score, rest.length); } }
  const full = !g.slowed;
  const { fans, tips, stretch, stars, starFans, request, battle, cover, doubled } = gigDone(data, g.song.id, g.score, g.encore, Date.now(), { song: g.song, full });
  const earned = questsSettle(data); /* Tour quests: tonight's setlist and the month's tour */
  const joined = bandMeet(data); /* Your band: who joined with this show */
  const tip = merchTip(data); /* the Merch table (4.14.0): something you can now afford, said once */
  const opened = gigDoneHere(); /* Opening night's last step */
  if (opened) g.from = "road";
  Tabs.save(data);
  const st = streakOf(playSongs(data)), ps = playableSongs(data);
  /* 4.83.0: what this song did on the Road: the chord stops it counts toward, and any it finished */
  const road = g.credited ? roadNote(data, g.song) : [];
  const crowd = gigCrowd(g.score), whole = showWhole(g.score);
  const tile = (lab, val, cls) => `<div class="gc-tile ${cls}"><small>${lab}</small><b>${val}</b></div>`;
  const played = songPlayed(g);
  const why = [stretch.speed && "full speed", stretch.newChord && "a chord you're still learning", stretch.debut && "your first time through"].filter(Boolean);
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
    <p class="gc-s">${esc(g.song.title)}, start to finish.${whole ? " The crowd wants more." : ""}</p>
    <div class="gc-tiles">${tile("FANS", `+${fans + 10 + earned.reduce((n, x) => n + x.fans, 0)}`, "fans")}${tile("TIPS", `$${tips}`, "tips")}${tile("CROWD", `${crowd}/12`, "crowd")}${tile("STARS", starRow(stars.after), "beat")}</div>
    ${played}
    <div class="gc-list">
      ${stars.after > stars.before && stars.after >= 3 ? `<p><b>New star: ${STAR_NAMES[stars.after]}!</b> ${stars.after === 4 ? "Gig-ready on three different days." : "The whole song at full speed, no pausing."} <b>+${starFans} fans</b></p>` : stars.after === 2 && stars.before < 3 && !full ? `<p>Play it at full speed without pausing to make it <b>Gig-ready</b>.</p>` : stars.after === 2 && stars.before < 3 ? `<p>Play it through without pausing to make it <b>Gig-ready</b>.</p>` : ""}
      <p>Played <b>${g.score.played}</b> chord change${g.score.played === 1 ? "" : "s"}${g.score.best >= 3 ? `, best run <b>${g.score.best}</b>` : ""}${whole ? ", <b>no pausing</b>" : ""}</p>
      ${why.length ? `<p>Stretch pay: ${why.join(", ")}. <b>${stretch.k}x</b> bonus fans</p>` : ""}
      ${battle ? `<p>${battle.result === "won" ? `Rival battle: you played it start to finish and passed <b>${esc(battle.rival)}</b>. <b>+30 XP, +40 fans</b>` : `Rival battle: ${esc(battle.rival)} held on. Play it start to finish at full speed without pausing to pass them`}</p>` : ""}
      ${joined.map(f => { const n = FRIENDS.find(x => x.id === f.id)?.name || f.id; return `<p><b>${esc(n)} joined your band!</b></p>`; /* 4.69.0: Beat joins, but isn't playing for now */ }).join("")}
      ${doubled !== undefined ? `<p>Double set: <b>2x XP</b> on this show. ${doubled ? `${doubled} more to go.` : "That was the last one."}</p>` : ""}
      ${cover ? `<p>Cover quest done: you learned a song you love. <b>3x bonus fans</b></p>` : ""}
      ${request ? `<p>Request line: a fan asked for this one. <b>2x bonus fans</b></p>` : ""}
      ${opened ? `<p><b>Opening night: done!</b> Your streak starts tonight.</p>` : ""}
      ${earned.map(x => `<p>${esc(x.label)}: <b>+${x.fans} fans</b></p>`).join("")}
      ${road.length ? `<p>The Road: ${road.map(r => r.done ? `<b>${esc(r.chord)} chord done</b>` : `${esc(r.chord)} chord, <b>${r.n} of ${KNOW_PLAYS}</b> songs`).join(", ")}</p>` : ""}
      ${ps.of ? `<p>You can play <b>${ps.now} of your ${ps.of}</b> songs</p>` : ""}
      ${st.days ? `<p>Gig streak: <b>${st.days} night${st.days === 1 ? "" : "s"}</b></p>` : ""}
    </div>
    ${tip ? `<button class="gc-merch" id="gc-merch">${tip.kind === "louie" ? `<span class="fin fin-${tip.id}">${louie("happy", { size: 46 })}</span>` : `<span class="gc-merch-ic" aria-hidden="true">${icon("shirt")}</span>`}<span><b>You can get ${esc(tip.kind === "louie" ? `${tip.name} Louie` : `the ${tip.name} backdrop`)}</b><small>$${tip.price.toLocaleString("en-US")} in tips at the merch table</small></span>${icon("chev", "chev")}</button>` : ""}
    <div class="gc-acts">
      ${g.encore ? "" : `<button class="btn primary" id="gc-encore">ENCORE · 2x BONUS FANS</button>`}
      <button class="btn" id="gc-go">CONTINUE</button>
    </div></div>`;
  /* 4.66.0: Continue stays on the song page; its Back goes to where the show was started from */
  $("gc-go").onclick = () => { closeGig(true); if (opened) { homeHooks.openDrawer = false; go("#/"); } else redraw?.(); }; /* Opening night's end goes on to the Road */
  /* 4.71.0: what the show paid bursts in, POW, one at a time: fans, tips, a band member, the streak. Through the
     app's callout, so they queue with the new-chord one instead of landing on top of it */
  const totalFans = fans + 10 + earned.reduce((n, x) => n + x.fans, 0);
  setTimeout(() => {
    if (gig !== g) return;
    showCallout({ kind: "earn", pow: "POW!", word: "FANS", big: `+${totalFans}` });
    showCallout({ kind: "earn", pow: "KA-CHING!", word: "TIPS", big: `+$${tips}` });
    if (joined[0]) showCallout({ kind: "join", word: "JOINED YOUR BAND", big: FRIENDS.find(x => x.id === joined[0].id)?.name || joined[0].id, who: joined[0].id });
    else if (st.days >= 2) showCallout({ kind: "earn", pow: "ROCK ON!", word: "GIG STREAK", big: `${st.days} nights` });
  }, 500);
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
  $("gc-encore")?.addEventListener("click", () => {
    const song = g.song, from = g.from;
    closeGig(true);
    window.scrollTo(0, 0);
    setTimeout(() => { if (viewing?.id === song.id) openGig(song, { encore: true, from }); }, 120);
  });
}
