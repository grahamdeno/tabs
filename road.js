// The Road (#/): home, since 4.0.0. The neck's ladder laid out as a path you travel, stop by stop.
//
//   stat bar    your venue, gig streak and fans (hud.js)
//   leg banner  the leg you're on and the venue you've reached; the book opens the neck
//   songs chip  how many of your songs you can play, and how many the next chord opens
//   the path    every leg is a guitar neck (4.82.0, fretboard.js): lessons are finger dots, merch boxes are
//               inlays and the headline show (a level check: play a real song through) is the double inlay
//               at the end of the neck. Done dots carry a check, the next one is bigger and its halo
//               pulses; later ones are locked. Each leg has its own guitar, earned by headlining the leg
//               before. Nothing is open on arrival: tap a stop for its card (Start on the next one); at a
//               headline the card names a song that fits, with the others a tap away.
//   Louie       beside the path, with one line that fits the moment and tonight's song to play
//   Songbook    a bar along the bottom (4.9.0): the Songbook page, and search, a tap away
//   tab bar     Road, Songbook, Rehearse, Tour, Me (hud.js)
// The screen itself never scrolls; the path scrolls inside it.
//
// Road Ready (step 02, the Dark and Light looks only; Green Room and Headliner keep the layout above):
//   header strip  two rows: the venue plate (show N of the leg, a pip per stop, the next venue: the Tour Map) and
//                 your tips (the Merch table); Tonight and its play button, and your fans and streak (your profile).
//                 No tuner here (Graham, 2026-11-17): you tune where you play, from the song screen, or from the Tuner row on Me.
//   Louie's line  a cream bubble under the strip
//   the path      the same necks, the stops drawn as pearl inlays, an amber line from done stop to done stop up to
//                 the current one, and a callout beside the current one
//   Louie         peeking in from the left edge, a picture (art/louie), not a button
import { piecePays, roadTour, TOUR_LEG, allowedChords, capoAnswer, songbookFor, tour1Song, tourPicked, tourSetSong, tourSwap, cleanMe, ME_DEFAULT, guitarShown, roadHit, KNOW_PLAYS, chordPlays, songsWith, VERSION, boxesSeed, guitarNew, openBox, venueNow, lifetimePlays, openingAdvance, openingSkip, openingStep, openingView, pickNudge, playSongs, playableSongs, roadPath, skillState, streakOf, FANS, OPENING, Tabs } from "./core.js";
import { curriculumRoad, curriculumSeed, playNext, rewardsOn, tourData } from "./core.js";
import { app, ask, esc, haptic, icon, layer, toast } from "./ui.js";
import { holdSheet, micSheet, notesSheet, songFor, stringsSheet } from "./opening.js";
import { makerSheet } from "./maker.js";
import { chordNames, data, go, homeHooks, openSearch, playGig, route, showCallout, tourGet, curriculumPick } from "./app.js";
import { aiKey } from "./aihelp.js";
import { louie } from "./louie.js";
import { openRound, passSpeed, speedName } from "./rounds.js";
import { guitarSVG, inlaySVG, neckHTML, rrStopArt, bareNeckHTML } from "./fretboard.js";
import { bindStand, collectionOf, standHTML, standIndex } from "./gstand.js";
import { statBar, rrStats, bindStatBar, settleStats } from "./hud.js";

const DAY = 86400000;
/* Road Ready is the Dark and Light looks (data-look neon and festival); Green Room and Headliner keep the old Road */
const rrLook = () => ["neon", "festival"].includes(document.documentElement.dataset.look);
/* the current stop when the Road was last drawn: when a show moves it on, the connector's newest step draws itself on */
let lastCur = null;

/* The full screen height. A Home Screen app on iPhone reports a viewport that stops short of the
   bottom edge (it leaves room for Safari's toolbar), so there the screen itself is measured. */
const standalone = () => navigator.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
function screenHeight() {
  const portrait = innerHeight >= innerWidth, s = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width);
  const h = standalone() ? Math.max(innerHeight, s) : innerHeight;
  document.body.style.setProperty("--screen-h", h + "px");
}
window.addEventListener("resize", () => { if (document.body.classList.contains("is-home")) { screenHeight(); fitRoadText(); } });

/* The Road never scrolls as a page: a drag outside the path and the Library drawer moves nothing. */
document.addEventListener("touchmove", e => {
  if (!document.body.classList.contains("is-home") || document.querySelector("#layer > *")) return;
  if (e.target instanceof Element && e.target.closest("#rd-drawer, #rd-path")) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false });

/* the song for tonight: today's pick, else the last one played, else the first */
function upNext() {
  const n = pickNudge({ songs: data.songs, mood: "", gigToday: false });
  const byId = id => data.songs.find(s => s.id === id);
  return (n && byId(n.songId)) || [...data.songs].sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0))[0];
}

/* the switch in tonight's song that's still to learn, for Louie to name */
function tripFor(song) {
  const sk = skillState(data), names = chordNames(song?.body || "");
  return sk.levels.flatMap(l => l.steps).find(x => x.kind === "switch" && x.state !== "done" && names.includes(x.a) && names.includes(x.b)) || null;
}

/* what Louie says, and how he looks saying it */
function louieLine(st, plays) {
  const last = Math.max(0, ...playSongs(data).map(s => s.playLog?.last || 0));
  const away = last ? Math.floor((Date.now() - last) / DAY) : 0, hour = new Date().getHours();
  if (!plays) return { mood: "happy", pose: "wave", text: "Let's play your first song. Play it through and your tour starts in the Garage." };
  if (st.today) return { mood: "cheer", pose: "thumb", text: st.days > 1 ? `Played today. Your ${st.days}-day streak is safe.` : "Played today. Come back tomorrow and start a streak." };
  if (away >= 3) return { mood: "sleepy", pose: "rest", text: "Missed you. An easy one to warm back up?" };
  if (hour >= 18 && st.days >= 1) return { mood: "worried", pose: "rest", text: `Evening. One song keeps your ${st.days}-day streak alive.` };
  return { mood: "happy", pose: "wave", text: "Ready to rock?" };
}

/* ---- the stops ---- */
const ICONS = {
  chord: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="4" width="22" height="24" rx="3" fill="none" stroke="#fff" stroke-width="3.4"/><path d="M5 12h22M5 20h22M12.3 4v24M19.6 4v24" stroke="#fff" stroke-width="2"/><circle cx="12.3" cy="16" r="3.2" fill="#fff"/><circle cx="19.6" cy="8" r="3.2" fill="#fff"/></svg>`,
  switch: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 11h22l-6-6M28 21H6l6 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  scale: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="7" cy="24" r="3.6" fill="#fff"/><circle cx="16" cy="16" r="3.6" fill="#fff"/><circle cx="25" cy="8" r="3.6" fill="#fff"/><path d="M7 24l9-8 9-8" stroke="#fff" stroke-width="2.4" stroke-dasharray="2 3"/></svg>`,
  check: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17l6 6 12-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l4 8.3 9 1.3-6.5 6.3 1.6 9L16 23.6 7.9 27.9l1.6-9L3 12.6l9-1.3z" fill="currentColor"/></svg>`
};
/* 4.34.0: each stop is a rounded guitar pick (flat colour on a darker lip, a shine), point down */
const PICK = "M0 42 C-14 42 -46 14 -46 -12 C-46 -36 -26 -46 0 -46 C26 -46 46 -36 46 -12 C46 14 14 42 0 42 Z";
const pickSVG = now => `<svg class="rd-pk" viewBox="-60 -60 120 120" aria-hidden="true">${now ? `<path class="rd-halo" d="${PICK}" transform="scale(1.3)"/>` : ""}<path class="rd-lip" d="${PICK}" transform="translate(0 7)"/><path class="rd-body" d="${PICK}"/><path class="rd-shine" d="M-30 -30 C-20 -38 -4 -40 10 -40"/></svg>`;
const dotIcon = s => s.state === "done" ? ICONS.check : ICONS[s.kind] || ICONS.chord;
const stopTitle = s => s.cs && s.kind !== "box" && !s.chord ? s.name : s.kind === "headline" ? "Headline show" : s.kind === "round" ? s.name : s.kind === "box" ? "Merch box" : s.kind === "chord" ? `The ${s.name} chord` : s.name;
const ZIG = [0, 46, 72, 46, 0, -46, -72, -46];
const tagOf = s => s.cs && s.kind !== "box" && !s.chord && !s.a ? s.name : s.kind === "headline" ? "Headline show" : s.kind === "box" ? (s.state === "now" ? "Tap to open" : "Merch box") : s.kind === "chord" ? `${s.name} chord` : s.name;
/* A pick's card, opened by a tap (4.35.0, like the old card but only on a tap): the next stop's is in the
   streak colour with Start (or, at a headline, Play and the song that fits); any other pick's is a quiet one */
/* a stop from the curriculum that is not a plain chord or switch lesson: Coming soon, a locked row, an Opening night step,
   a stop with two lessons, or a box while Unlock all tours is on */
const csPass = s => s.pass === "played" ? "Louie can't judge this one. You're the judge." : "Louie listens for it.";
function csCard(stop) {
  const title = stopTitle(stop), locked = stop.state === "locked", off = !rewardsOn(data);
  let body, act = "", cls = stop.state;
  if (stop.row) body = `${stop.routeOpen ? "Coming soon." : `Opens after Tour ${stop.after}.`} ${stop.skill}.`;
  else if (stop.kind === "box") body = "Boxes stay shut while Unlock all tours is on, so nothing is paid.";
  else if (stop.soon) { cls = "soon"; body = `Coming soon. ${stop.skill}. ${csPass(stop)}`; }
  else if (locked) body = "Finish the stop before it first.";
  else {
    body = `${stop.skill}. ${csPass(stop)}${off ? " Unlock all tours is on: nothing is paid or saved." : ""}`;
    act = `${!off && stop.state !== "done" ? `<div class="rd-earn"><span>+${FANS.lesson} fans</span></div>` : ""}<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" && !off ? "PLAY AGAIN" : "START"}</button>`;
  }
  return `<div class="rd-pop ${cls}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(body)}</p>${act}</div>`;
}
function stopCard(stop) {
  if (stop.cs && (stop.soon || stop.row || stop.play?.opening || stop.play?.lessons?.length > 1 || (stop.kind === "box" && !rewardsOn(data)))) return csCard(stop);
  if (stop.piece && stop.state !== "locked") return pieceCard(stop);
  const title = stopTitle(stop), now = stop.state === "now" || stop.state === "open";
  const line = stop.kind === "chord" ? "Ring every string clean, one at a time."
    : stop.kind === "switch" ? "Land the change on the beat."
    : stop.kind === "scale" ? "Up and back down, one note at a time."
    : stop.kind === "box" ? (stop.state === "done" ? `Opened: +${FANS.box} fans.` : `Reach it, then tap it open: +${FANS.box} fans.`) : "";
  /* 4.83.0: a chord's stop is also done by playing it in KNOW_PLAYS songs to the end; the card says how far along you are */
  let alt = "";
  if (stop.kind === "chord" && stop.state !== "done" && rewardsOn(data)) {
    const n = Math.min(chordPlays(data, stop.chord), KNOW_PLAYS - 1), left = KNOW_PLAYS - n, songs = songsWith(data, stop.chord);
    alt = `<p class="rd-alt">${stop.state === "locked" ? "Songs count already: play" : "Or play"} ${esc(stop.chord)} in ${left} more song${left === 1 ? "" : "s"}, start to finish (${n} of ${KNOW_PLAYS}).${songs.length ? "" : ` None of your songs have ${esc(stop.chord)} yet.`}</p>`
      + (songs.length ? `<button class="rd-other" data-song="${esc(songs[0].id)}">Play ${esc(songs[0].title)}${songs.length > 1 ? ` (or ${songs.length - 1} more with ${esc(stop.chord)})` : ""}</button>` : "");
  }
  const act = stop.kind === "box" || stop.state === "locked" ? ""
    : `${stop.state === "done" || !rewardsOn(data) ? "" : `<div class="rd-earn"><span>+${FANS.lesson} fans</span></div>`}<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" ? "PLAY AGAIN" : "START"}</button>`;
  return `<div class="rd-pop ${now ? "now" : stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(stop.state === "locked" && stop.kind !== "box" ? (stop.kind === "chord" ? "Its lesson opens when you get here." : "Finish the stops before this one to open it.") : line)}</p>${act}${alt}</div>`;
}
/* ---- A piece of the tour's song (5.18.0, B2): the card, the song choice, the capo question ---- */
const tourBusy = new Set(), tourErr = new Map();
const tourNo = stop => +String(stop.tourId).replace(/^t/, "");
const songOfTour = stop => { const t = tourData(data).songTour?.legs?.[stop.tourId], sg = t?.song && data.songs.find(x => x.id === t.song); return sg ? { t, sg } : null; };
function pieceCard(stop) {
  const title = stop.headline ? "Headline show" : stop.name, off = !rewardsOn(data), id = esc(stop.tourId);
  const tv = tourData(data), own = songOfTour(stop), t = tv.songTour?.legs?.[stop.tourId], sb = own ? null : songbookFor(tv, stop.tourId);
  const wait = !own && Object.entries(tv.curriculum?.waiting || {}).find(([sid, n]) => n === tourNo(stop) && data.songs.some(x => x.id === sid));
  let line, acts = "";
  if (own) {
    const { sg } = own, capo = own.t.capo || 0, band = capo > 0 && capoAnswer(data) !== true;
    line = `${stop.headline ? `Play the whole of ${sg.title}. Pass at ${speedName(passSpeed({ ...sg, bandOnly: band }))}. 1.0x makes it Solid.` : `Play a piece of ${sg.title}. Louie marks the strums with your chords; the rest are rests.`}`
      + `${own.t.simplified ? " This is the simplified version." : ""}${capo > 0 ? (band ? ` It needs a capo at fret ${capo}, so Louie's band plays it.` : ` Capo at fret ${capo}.`) : ""} ${csPass(stop)}${off ? " Unlock all tours is on: nothing is paid or saved." : ""}`;
    acts = `${!off && piecePays(data, stop.id) ? `<div class="rd-earn"><span>+${FANS.lesson} fans</span></div>` : ""}<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" && !off ? "PLAY AGAIN" : "PLAY"}</button>`
      + (own.t.simplified || capo > 0 ? `<button class="rd-other" data-chart="${esc(sg.id)}">See the real chart</button>` : "")
      + `<button class="rd-other" data-tswap="${id}">Use another song</button>`;
  } else if (sb) {
    line = `Every stop in this tour is a piece of one song. ${sb.song.title} fits${sb.fit.simplified ? ", simplified" : ""}${sb.fit.capo ? `, with a capo at fret ${sb.fit.capo}` : ""}.`;
    acts = `<button class="btn primary rd-start" data-tsong="${id}">USE ${esc(sb.song.title.toUpperCase())}</button>`;
  } else if (wait) {
    const sg = data.songs.find(x => x.id === wait[0]);
    line = `${sg.title} was waiting for this tour. Use it now.`;
    acts = `<button class="btn primary rd-start" data-twait="${id}" data-song-id="${esc(sg.id)}">USE ${esc(sg.title.toUpperCase())}</button>`;
  } else if (t?.pick) {
    line = `Louie picked ${t.pick.title}${t.pick.artist ? `, ${t.pick.artist}` : ""}. Get it, then play it a piece at a time.`;
    acts = `<button class="btn primary rd-start" data-tget="${id}">GET IT</button>${tourErr.has(stop.tourId) ? `<p class="rd-alt">${esc(tourErr.get(stop.tourId))}</p>` : ""}`;
  } else {
    const l1 = stop.tourId === "t1" ? tour1Song(data, []) : null;
    line = "Every stop in this tour is a piece of one song. Pick the song for the tour.";
    acts = (l1 && l1.from === "list" ? `<button class="btn primary rd-start" data-tfirst="${id}">USE ${esc(l1.title.toUpperCase())}</button>` : "")
      + (aiKey() ? `<button class="btn${l1 ? "" : " primary"} rd-start" data-tpick="${id}">${tourBusy.has(stop.tourId) ? "Picking a song" : "LOUIE PICKS A SONG"}</button>` : "")
      + `<button class="rd-other" data-tchoose="${id}">Choose my own song</button>`;
    if (tourErr.has(stop.tourId)) acts += `<p class="rd-alt">${esc(tourErr.get(stop.tourId))}</p>`;
  }
  /* asked once, on Tour 1: a song that needs a capo plays with Louie's band when there is none */
  const ask = stop.tourId === "t1" && capoAnswer(data) === null ? `<p class="rd-alt">Do you have a capo?</p><div class="rd-pair"><button class="btn" data-capo="1">Yes</button><button class="btn" data-capo="0">No</button></div>` : "";
  return `<div class="rd-pop ${stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(line)}</p>${acts}${ask}</div>`;
}
/* the player's own song: a sheet of the Songbook; a song that does not fit says when it opens, and waits there */
function chooseSong(tourId) {
  const n = +tourId.slice(1), songs = (data.songs || []).filter(x => x.format !== "tab");
  layer.innerHTML = `<div class="scrim" id="ro-scrim"></div><div class="panel de-sheet rd-others" role="dialog" aria-label="Choose a song for Tour ${n}"><div class="grab"></div>
    <div class="ph"><button class="tb" id="ro-x">Close</button><h2>Your song</h2><span style="width:56px"></span></div>
    <div class="pbody"><p class="easy-note">A song with a few harder chords is simplified, and the real chart stays one tap away.</p>
    <div class="list glass">${songs.length ? songs.map(sg => `<button class="row" data-pick="${esc(sg.id)}"><div class="txt"><div class="t">${esc(sg.title)}</div><div class="a">${esc(sg.artist || "")}</div></div></button>`).join("") : `<p class="easy-note">Your Songbook is empty. Add a song first.</p>`}</div></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("ro-scrim").onclick = close; document.getElementById("ro-x").onclick = close;
  layer.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
    const sg = data.songs.find(x => x.id === b.dataset.pick), tv = tourData(data), r = tourSetSong(tv, tourId, sg);
    close();
    if (r.ok) { Tabs.save(data); toast(`${sg.title} is this tour's song${r.simplified ? ", simplified" : ""}`); return renderRoad(); }
    if (r.opens) { tv.curriculum = { v: 1, done: {}, ...(tv.curriculum || {}) }; tv.curriculum.waiting = { ...(tv.curriculum.waiting || {}), [sg.id]: r.opens }; Tabs.save(data); }
    toast(r.opens ? `Not yet: this opens at Tour ${r.opens}. It waits there` : "This song needs chords the early tours don't teach");
  });
}
const askPick = id => {
  if (tourBusy.has(id)) return;
  tourBusy.add(id); tourErr.delete(id);
  const done = () => { tourBusy.delete(id); if (document.getElementById("rd-path")) renderRoad(); };
  curriculumPick(id).then(done, e => { tourErr.set(id, e?.message || "Picking a song needs a connection."); done(); });
};

/* ---- Opening night (4.40.0): the first leg teaches the app by doing it ---- */
const OIC = {
  who: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="6" fill="#fff"/><path d="M5 28c0-7 5-11 11-11s11 4 11 11z" fill="#fff"/></svg>`,
  hold: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M19 3v11c4 1.2 7 5 7 9.5a8.5 8.5 0 0 1-17 0c0-4.5 3-8.3 7-9.5V3z" fill="#fff"/></svg>`,
  strings: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 7h20M6 11h20M6 15h20M6 19h20M6 23h20M6 27h20" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  mic: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="11" y="3" width="10" height="17" rx="5" fill="#fff"/><path d="M6.5 14a9.5 9.5 0 0 0 19 0M16 24v5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  notes: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="24" r="5" fill="#fff"/><path d="M16 24V8h9v5h-9" fill="#fff"/></svg>`,
  chord: ICONS.chord,
  verse: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5l17 11-17 11z" fill="#fff"/></svg>`,
  pause: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="5" width="7" height="22" rx="2.5" fill="#fff"/><rect x="18" y="5" width="7" height="22" rx="2.5" fill="#fff"/></svg>`,
  show: ICONS.star
};
const OSAY = {
  who: "Hi, I'm Louie. Tap the glowing stop and make your guitarist. Then I'll show you around, ending with your first show.",
  hold: "First, how to hold the guitar. Tap the glowing stop.",
  strings: "Next, the six open strings. Tap the glowing stop.",
  mic: "Now I'll ask for the microphone. Tap the glowing stop.",
  notes: "Time to play your first notes. Tap the glowing stop.",
  chord: "Now a chord. Tap the glowing stop.",
  verse: "Time to play. Just the first verse.",
  pause: "Next: pausing, and picking up where you left off.",
  show: "Last one: your first show, start to finish."
};
const OLINE = {
  who: "Pick a starter, a skin tone and a hair colour. It's you on your card and the chart.",
  hold: "Sit up, rest the guitar on your leg, neck pointing up and away.",
  strings: "Six strings, thick to thin: E, A, D, G, B, E.",
  mic: "I'll say why I listen, then your phone asks for the microphone.",
  notes: "Play the thickest string, then the next one. Those are your first notes.",
  chord: "Open the song and tap a chord to see its shape.",
  verse: "Play the first verse. Play each chord as it comes.",
  pause: "Play, tap anywhere to pause, then Resume.",
  show: "Play a song start to finish."
};
function openingCard(i, step) {
  const o = OPENING[i], state = i < step ? "done" : i === step ? "now" : "locked";
  const line = state === "locked" ? "Finish the steps before this one." : state === "done" ? "Done." : OLINE[o.id];
  const btn = state === "now" ? `<button class="btn primary rd-start" data-ostart="${i}">${o.id === "show" ? `PLAY · +${FANS.play} FANS` : o.id === "who" ? "PICK YOURS" : `START · +${FANS.lesson} FANS`}</button>` : "";
  return `<div class="rd-pop ${state}" role="dialog" aria-label="${esc(o.name)}"><b>${esc(o.name)}</b><p>${esc(line)}</p>${btn}</div>`;
}
function renderOpening(view) {
  clearFit();
  const done = view === "done", step = done ? OPENING.length : openingStep(data);
  if (done && !data.opening.seen) { data.opening.seen = Date.now(); Tabs.save(data); }
  if (rrLook()) return rrOpening(done, step);
  const stops = OPENING.map((o, i) => {
    const state = i < step ? "done" : i === step ? "now" : "locked", x = ZIG[i % ZIG.length], big = o.id === "show";
    return `<div class="rd-stop on-stop" style="--x:${x}px"><button class="rd-node ${big ? "headline big" : "chord"} ${state}" data-ostep="${i}" aria-label="${esc(`${o.name}, ${state === "now" ? "your next step" : state}`)}">${pickSVG(state === "now")}<span class="rd-ic">${state === "done" ? ICONS.check : OIC[o.id] || ""}</span></button><span class="on-lab ${x > 0 ? "l" : "r"}${state === "locked" ? " dim" : ""}"><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></span></div>`;
  }).join("");
  app.innerHTML = `
    <div class="rd-top${done ? "" : ""}">${statBar()}</div>
    <section class="rd-banner on-night" aria-label="Opening night">
      <div><small>OPENING NIGHT${done ? " · DONE" : ` · ${OPENING.length} STEPS`}</small><b>${done ? "Your first night" : "Learn the stage"}</b></div>
      ${done ? `<button class="on-skip" id="on-next">On to Tour 1</button>` : `<button class="on-skip" id="on-skip">Skip</button>`}
    </section>
    <div class="rd-path on-path" id="rd-path">
      <div class="rd-say"><div class="rd-sayt"><p class="rd-bubble" id="rd-bubble">${esc(done ? "That's your opening night! Your streak starts now. Tap it up top to see your player card." : OSAY[OPENING[step]?.id] || "")}</p></div></div>
      ${stops}
    </div>`;
  const $ = id => document.getElementById(id);
  bindStatBar();
  $("rd-sign")?.addEventListener("click", () => go("#/playmap"));
  homeHooks.refresh = null;
  $("on-next")?.addEventListener("click", () => renderRoad());
  $("on-skip")?.addEventListener("click", () => ask({ title: "Skip opening night?", text: "You can replay it any time from Settings > Help > Tips & gestures.", ok: "Skip it", keep: "Keep going" },
    () => { openingSkip(data); if (!data.me) data.me = cleanMe(ME_DEFAULT); /* 4.99.0: skipping means no sheets; change it on Your profile */ Tabs.save(data); renderRoad(); }));
  const path = $("rd-path");
  const closePop = () => { path.querySelectorAll(".rd-pop").forEach(p => p.remove()); };
  path.addEventListener("click", e => {
    const st = e.target.closest("[data-ostart]");
    if (st) return openingStart(+st.dataset.ostart);
    const node = e.target.closest("[data-ostep]");
    const open = node?.parentElement.querySelector(".rd-pop");
    closePop();
    if (node && !open) { node.parentElement.insertAdjacentHTML("beforeend", openingCard(+node.dataset.ostep, step)); haptic(1); revealPop(path, node.parentElement.querySelector(".rd-pop")); }
  });
}

/* The leg row and the now plate stay on one line. Text starts at its own size and shrinks until it fits, never below 12 px. */
let fitWatch = [];
function clearFit() { fitWatch.forEach(stop => stop()); fitWatch = []; }
function fitLine(el) {
  if (!el || !el.isConnected) return;
  el.style.fontSize = "";
  let size = parseFloat(getComputedStyle(el).fontSize);
  if (!size) return;
  while (size > 12 && el.scrollWidth > el.clientWidth + 1) {
    const next = Math.round((size - 0.5) * 10) / 10;
    if (next < 12) break;
    size = next;
    el.style.fontSize = size + "px";
  }
}
function fitRoadText() {
  const bar = document.querySelector(".rn-legbar");
  const line = document.getElementById("rn-legline");
  const skip = bar?.querySelector(".rn-skip:not([hidden])");
  const tx = document.querySelector(".rn-now-tx");
  if (skip) skip.style.fontSize = "";
  fitLine(line);
  fitLine(tx);
  if (line && skip) {
    let size = parseFloat(getComputedStyle(skip).fontSize);
    while (size > 12 && line.scrollWidth > line.clientWidth + 1) {
      const next = Math.round((size - 0.5) * 10) / 10;
      if (next < 12) break;
      size = next;
      skip.style.fontSize = size + "px";
      fitLine(line);
    }
  }
}
function armFit() {
  clearFit();
  const mo = new MutationObserver(() => fitRoadText());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "data-ax"] });
  document.fonts?.ready?.then(() => { if (document.getElementById("rn-legline")) fitRoadText(); });
  fitWatch.push(() => mo.disconnect());
  fitRoadText();
}
/* One full-width line under the stats: "Leg 1 · Open chords", with Skip on the right during Opening night. */
function legBar(leg, skipHTML = "") {
  return `<div class="rn-legbar rd-legmark${leg.cls ? " " + leg.cls : ""}" id="rn-legbar" role="group" aria-label="${esc(leg.aria || leg.title)}"><p class="rn-legline" id="rn-legline"><b>${esc(leg.title)}</b><span class="rn-sep" aria-hidden="true"> · </span><small>${esc(leg.sub)}</small></p>${skipHTML}</div>`;
}
/* The current stop, pinned above the tab bar. The name opens its card. Start does what the card's Start does. */
function nowPlate(name) {
  if (!name) return "";
  return `<div class="rn-now" id="rn-now"><button type="button" class="rn-now-name" id="rn-now-open" aria-label="${esc(`${name}, open this stop`)}"><span class="rn-now-tx">${esc(name)}</span></button><button type="button" class="btn primary rn-now-go" id="rn-now-start" aria-label="${esc(`Start ${name}`)}">Start</button></div>`;
}
/* The row under the stats names the leg whose start has reached the top, so the rosewood neck stays one piece. */
function pinLeg(path) {
  const bar = document.getElementById("rn-legbar");
  const line = document.getElementById("rn-legline");
  const marks = [...path.querySelectorAll(".rn-lat")];
  if (!bar || !line || !marks.length) return;
  const paint = i => {
    const m = marks[i];
    if (!m || bar.dataset.on === String(i)) return;
    bar.dataset.on = String(i);
    const title = m.dataset.title || "", sub = m.dataset.sub || "";
    bar.setAttribute("aria-label", m.dataset.aria || title);
    bar.classList.toggle("on-night", m.dataset.cls === "on-night");
    const b = document.createElement("b"); b.textContent = title;
    const sep = document.createElement("span"); sep.className = "rn-sep"; sep.setAttribute("aria-hidden", "true"); sep.textContent = " · ";
    const small = document.createElement("small"); small.textContent = sub;
    line.replaceChildren(b, sep, small);
    const skip = bar.querySelector(".rn-skip");
    if (skip) skip.hidden = m.dataset.cls !== "on-night";
    fitRoadText();
  };
  const sync = () => {
    const top = path.getBoundingClientRect().top + 12;
    let i = 0;
    marks.forEach((m, n) => { if (m.getBoundingClientRect().top <= top) i = n; });
    /* 5.17.0: at the very end the short locked rows can never reach the top: name the last one in view */
    if (path.scrollTop + path.clientHeight >= path.scrollHeight - 2) { const bottom = path.getBoundingClientRect().bottom - 60; marks.forEach((m, n) => { if (n > i && m.getBoundingClientRect().top < bottom) i = n; }); }
    paint(i);
  };
  path.addEventListener("scroll", () => { sync(); requestAnimationFrame(sync); }, { passive: true });
  sync();
}
/* Road Ready: Opening night is the Road too. Its steps are stops on the first guitar neck, under the same stats row.
   The leg name and Skip are one line between the stats and the nut. The current step's name and Start sit on a plate
   above the tab bar. The steps, their cards and what they start are as before. */
function rrOpening(done, step) {
  const stops = OPENING.map((o, i) => ({ id: "o:" + i, kind: o.id === "show" ? "headline" : "chord", state: i < step ? "done" : i === step ? "now" : "locked", name: o.name, sub: o.sub }));
  const cur = stops[step] || null;
  const said = s => s.state === "now" ? "your next step" : s.state;
  const btn = done ? `<button type="button" class="rn-skip" id="on-next">On to Tour 1</button>` : `<button type="button" class="rn-skip" id="on-skip" aria-label="Skip opening night">Skip</button>`;
  const leg1 = roadPath(data).legs[0];
  const legs = [{ title: "Opening night", sub: "First steps", cls: "on-night", aria: "Opening night", stops }];
  if (leg1?.stops?.length) legs.push({ title: "Tour 1", sub: leg1.name, aria: `Tour 1, ${leg1.name}`, upcoming: true, stops: leg1.stops });
  const stopName = s => s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.name;
  const neck = bareNeckHTML(legs, {
    cur,
    id: s => esc(s.id),
    num: s => {
      const i = stops.indexOf(s);
      if (i >= 0) return i + 1;
      const j = leg1 ? leg1.stops.findIndex(x => x.id === s.id) : -1;
      return j >= 0 ? j + 1 : 0;
    },
    label: s => {
      const i = stops.indexOf(s);
      if (i >= 0) return esc(`Step ${i + 1} of ${stops.length}, ${s.name}, ${said(s)}`);
      return esc(`${stopName(s)}, locked`);
    }
  });
  app.innerHTML = `
    ${rrRow()}
    ${legBar({ title: "Opening night", sub: "First steps", cls: "on-night", aria: "Opening night" }, btn)}
    <div class="rr-stage rn-stage">
      <div class="rd-path rr rn on-path" id="rd-path">${neck}</div>
    </div>
    ${nowPlate(cur?.name || "")}`;
  const $ = id => document.getElementById(id);
  bindStatBar();
  $("rd-sign")?.addEventListener("click", () => go("#/playmap"));
  homeHooks.refresh = null;
  $("on-next")?.addEventListener("click", () => renderRoad());
  $("on-skip")?.addEventListener("click", () => ask({ title: "Skip opening night?", text: "You can replay it any time from Settings > Help > Tips & gestures.", ok: "Skip it", keep: "Keep going" },
    () => { openingSkip(data); if (!data.me) data.me = cleanMe(ME_DEFAULT); /* 4.99.0: skipping means no sheets; change it on Your profile */ Tabs.save(data); renderRoad(); }));
  const path = $("rd-path");
  armDrag(path);
  const closePop = () => { path.querySelectorAll(".rd-pop").forEach(p => p.remove()); path.classList.remove("has-pop"); };
  const openStepCard = (node, fromKey) => {
    if (!String(node.dataset.stop || "").startsWith("o:")) return;
    const wrap = node.parentElement, open = wrap.querySelector(".rd-pop");
    closePop();
    if (!open) { wrap.insertAdjacentHTML("beforeend", openingCard(+node.dataset.stop.slice(2), step)); path.classList.add("has-pop"); haptic(1); revealPop(path, wrap.querySelector(".rd-pop")); if (fromKey) wrap.querySelector(".rd-start")?.focus(); }
  };
  path.addEventListener("click", e => {
    if (tookDrag(path)) return;
    const st = e.target.closest("[data-ostart]");
    if (st) return openingStart(+st.dataset.ostart);
    const node = e.target.closest("[data-stop]");
    if (!node) return closePop();
    /* Leg 1 under Opening night is locked. A tap says so, and does not start the lesson. */
    if (node.closest(".rn-dim")) {
      const wrap = node.parentElement, open = wrap.querySelector(".rd-pop");
      closePop();
      if (!open) {
        const s = leg1?.stops.find(x => x.id === node.dataset.stop);
        wrap.insertAdjacentHTML("beforeend", `<div class="rd-pop locked" role="dialog" aria-label="Locked"><b>${esc(s ? stopName(s) : "Tour 1")}</b><p>This opens after Opening night.</p></div>`);
        path.classList.add("has-pop"); haptic(1); revealPop(path, wrap.querySelector(".rd-pop"));
      }
      return;
    }
    openStepCard(node, !e.detail);
  });
  $("rn-now-open")?.addEventListener("click", e => { const node = path.querySelector(".rd-node.cur"); if (node) openStepCard(node, !e.detail); });
  $("rn-now-start")?.addEventListener("click", () => { if (cur) openingStart(stops.indexOf(cur)); });
  pinNeck(path);
  pinLeg(path);
  armFit();
}
/* A drag on the neck or the gutter scrolls. A short tap is the only thing that opens a stop. */
function armDrag(path) {
  let x = 0, y = 0, moved = false;
  path.addEventListener("pointerdown", e => { moved = false; x = e.clientX; y = e.clientY; });
  path.addEventListener("pointermove", e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 8) moved = true; });
  const end = () => { path._moved = moved; };
  path.addEventListener("pointerup", end);
  path.addEventListener("pointercancel", end);
}
function tookDrag(path) {
  const moved = !!path._moved;
  path._moved = false;
  return moved;
}
/* The current stop sits a little above the middle of the neck, clear of the header, the now plate and the tab bar.
   A stop near the nut stays pinned to the top so the nut stays in view. */
function pinNeck(path) {
  const go = () => {
    if (!document.contains(path)) return;
    const node = path.querySelector(".rd-node.cur");
    if (!node) return;
    const nut = path.querySelector(".rn-nut");
    const plate = document.getElementById("rn-now");
    const pr = path.getBoundingClientRect(), nr = node.getBoundingClientRect();
    if (!nr.height) return;
    const cover = plate ? Math.max(0, pr.bottom - plate.getBoundingClientRect().top) : 0;
    const mid = path.scrollTop + (nr.top - pr.top) + nr.height / 2;
    const nutBottom = nut ? path.scrollTop + (nut.getBoundingClientRect().bottom - pr.top) : 0;
    const view = Math.max(1, (path.clientHeight || 1) - cover);
    path.scrollTop = mid - nutBottom < view * 0.55 ? 0 : Math.max(0, mid - view * 0.42);
  };
  go();
  requestAnimationFrame(go);
}
/* the venue's name as a small sign at the start of the leg you're on (one-row Road) */
/* what an Opening night step's button starts */
function openingStart(i) {
  const id = OPENING[i].id;
  if (id === "who") return makerSheet({ mode: "start", done: () => { openingAdvance(data, "who"); Tabs.save(data); renderRoad(); } });
  if (id === "hold") return holdSheet(() => renderRoad());
  if (id === "strings") return stringsSheet(() => renderRoad());
  if (id === "notes") return notesSheet(() => renderRoad());
  if (id === "mic") return micSheet(() => renderRoad());
  const song = songFor();
  if (!song) { toast("Add a song with chords first; then it's your stage"); return go("#/library"); }
  return id === "chord" ? go("#/song/" + encodeURIComponent(song.id)) : playGig(song.id, { from: "road" });
}

/* ---- One-row Road header (2026-11-19): four stats, icon then number, no labels, cards or outlines, 44 pt tall; each opens
   what it opened before (the stat bar's own buttons and bindings) ---- */
function rrRow() {
  return `<header class="rr-head">${rrStats()}</header>`;
}
/* the callout beside the current stop: a chord says the chord you know that leads into it and what it opens */
function rrTag(s, all) {
  if (s.kind === "box") return "Tap to open";
  if (s.kind === "headline") return "Headline show";
  if (s.kind === "chord" && s.chord) {
    const more = playableSongs(data, s.chord).more;
    if (more > 0) {
      const before = all.slice(0, all.indexOf(s)).reverse().find(x => x.kind === "chord" && x.state === "done" && x.chord);
      return `${before ? `${before.chord} to ${s.chord}` : `${s.chord} chord`}, opens ${more} song${more === 1 ? "" : "s"}`;
    }
  }
  return tagOf(s);
}

/* Escape closes an open stop card even when focus has moved off the Road's own buttons. renderRoad sets escapeCard; a sheet or dialog
   that is open takes the Escape first. */
let escapeCard = null;
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || e.defaultPrevented || !escapeCard || document.querySelector("[role=dialog]:not(.rd-pop), .sheet, .modal")) return;
  if (escapeCard()) e.preventDefault();
});
export function renderRoad() {
  screenHeight(); window.scrollTo(0, 0);
  clearFit();
  const ov = rewardsOn(data) ? openingView(data) : null; /* Unlock all tours skips Opening night's own screen */
  if (ov) { homeHooks.openDrawer = false; return renderOpening(ov); }
  const wantDrawer = homeHooks.openDrawer; homeHooks.openDrawer = false;
  const rr = rrLook();
  if (rr) settleStats(); /* Rain checks and fading fans first, so the streak and fans shown are the settled ones */
  const plays = lifetimePlays(data), st = streakOf(playSongs(data)), v = venueNow(data);
  if (boxesSeed(data)) Tabs.save(data); /* 4.76.0: boxes already reached stay opened */
  if (curriculumSeed(data)) Tabs.save(data); /* 5.17.0: today's progress mapped onto the new stops, kept in data.curriculum */
  const oldRoad = roadTour(data, roadPath(data));
  const road = rr ? curriculumRoad(data) : oldRoad, cur = road.current, leg = road.leg;
  const song = upNext(), say = louieLine(st, plays);
  const trip = song && plays && !st.today ? tripFor(song) : null;
  if (trip && say.mood !== "sleepy") say.text = `${trip.a} to ${trip.b} is the switch to warm up for ${song.title}.`;
  /* 4.70.0: a venue at risk, or one to win back, comes first */
  if (v.warn) say.text = `Your crowd is thinning at the ${v.name}. Play a song tonight to keep it.`;
  else if (v.down) say.text = `We're back at the ${v.name}. ${v.back} more show${v.back === 1 ? "" : "s"} and we win the ${v.next} back.`;
  const ps = playableSongs(data, cur?.kind === "chord" ? cur.chord : "");
  const chip = !data.songs.length ? "" : ps.more > 0 ? `The ${esc(cur.chord)} chord opens <b>${ps.more} more</b> of your ${ps.of} songs`
    : `You can play <b>${ps.now} of your ${ps.of}</b> song${ps.of === 1 ? "" : "s"}`;

  /* the path: one neck per leg (fretboard.js), with a label where each new leg starts */
  const all = road.legs.flatMap(l => l.stops);
  const said = s => s.state === "now" ? "your next stop" : s.state === "done" ? "done" : s.state === "open" ? "open" : "locked";
  /* Road Ready: each stop's number in its leg, and a label that says it ("Show 4 of 6, The D chord, current") */
  const numOf = s => { const l = road.legs.find(x => x.stops.includes(s)); return l ? l.stops.indexOf(s) + 1 : 0; };
  /* 5.9.0: a song tour in progress never holds the next skill tour back: it is drawn open beside the song tour */
  let curAt = road.legs.indexOf(leg);
  if (!rr && leg?.song && road.legs[curAt + 1] && !road.legs[curAt + 1].song) curAt++;
  const nxt = rr ? null : curAt >= 0 ? road.legs[curAt + 1] : null; /* 5.17.0: the Tour draws the whole main line, not only the next leg */
  const ahead = new Set(nxt ? nxt.stops.map(s => s.id) : []);
  const rrLabel = s => {
    if (s.kind === "headline" || s.kind === "box") return esc(`${s.kind === "headline" ? "Headline show" : "Merch box"}, ${ahead.has(s.id) ? "locked" : said(s)}`);
    const l = road.legs.find(x => x.stops.includes(s)), state = ahead.has(s.id) ? "locked" : s.state === "now" ? "current" : s.state === "done" ? "done" : s.state === "open" ? "open" : "locked";
    return esc(`Show ${numOf(s)} of ${l ? l.stops.length : 0}, ${stopTitle(s)}, ${state}`);
  };
  const labelOf = rr ? rrLabel : s => esc(`${s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.name}, ${said(s)}`);
  /* 4.84.0: how many of your songs each lesson's chord would open (with the chords you know) */
  const opens = s => s.kind === "chord" && s.chord ? playableSongs(data, s.chord).more : 0;
  const fresh = rr && lastCur && cur && lastCur !== cur.id ? cur.id : null;
  lastCur = cur?.id || null;
  const gx = { cur, id: s => esc(s.id), icon: dotIcon, label: labelOf, tag: s => esc(rr ? rrTag(s, all) : tagOf(s)), songs: opens, rr, num: numOf, fresh, tonight: rr && song ? esc(song.title) : "", tonightAdd: rr && !song };
  const shown = rr ? road.legs : road.legs.slice(0, curAt >= 0 ? curAt + 1 : road.legs.length);
  /* The legs already reached, then the next one in full, flagged so it draws gray and locked. Nothing past that. */
  const legTitle = l => l.song ? { title: "Song tour", sub: l.note, aria: `Song tour, ${l.note}` } : l.row ? { title: l.name, sub: l.note, aria: `${l.name}, ${l.note}, locked` } : { title: `Tour ${l.n}`, sub: l.name, aria: `Tour ${l.n}, ${l.name}` };
  const bareLegs = shown.filter(l => l.stops.length).map(l => ({ ...legTitle(l), stops: l.stops, ...(l.row ? { row: true } : {}) }));
  /* the lead and fingerstyle rows are drawn gray and locked until their release */
  const rowAt = bareLegs.findIndex(l => l.row && l.stops[0]?.state === "locked");
  if (rowAt > 0) bareLegs[rowAt].upcoming = true;
  if (nxt?.stops.length) bareLegs.push({ ...legTitle(nxt), upcoming: true, stops: nxt.stops });
  const bare = rr ? bareNeckHTML(bareLegs, {
    cur, id: s => esc(s.id), label: labelOf, num: numOf, songs: opens
  }) : "";
  const legsHTML = rr ? "" : road.legs.map((l, n) => `
    <div class="rd-legmark${l === leg ? " cur" : ""}"><span>Tour ${l.n} · ${esc(l.name)}</span></div>
    ${road.legs[n - 1]?.done ? `<span class="rd-newg">New guitar earned</span>` : ""}
    ${neckHTML(l, l === leg ? { ...gx, shown: guitarShown(data, l.id), build: data.builds?.[l.id] } : { ...gx, build: data.builds?.[l.id] })}`).join("");
  const coming = road.coming.length ? `<div class="rd-coming"><svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg><span>Coming soon: ${esc(road.coming.join(", "))}</span></div>` : "";

  const songbookBar = `
    <div class="rd-sbk">
      <button class="rd-sbk-go" id="rd-songbook" aria-label="Open the Songbook">
        <span class="rd-sbk-ic" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 3v10a3.5 3.5 0 1 1-2-3.2V1l10 2v4L7 5z"/></svg></span>
        <span class="rd-sbk-t"><b>Songbook</b><small>${data.songs.length ? `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}` : "Empty"}</small></span>
      </button>
      <button class="rd-sbk-q" id="rd-search">${icon("search")}<span>Search or add a song</span></button>
    </div>`;
  const nowName = cur ? (cur.name || (cur.kind === "headline" ? "Headline show" : cur.kind === "box" ? "Merch box" : "Stop")) : "";
  const headLeg = shown[0];
  if (rr) {
    app.innerHTML = `
    ${rrRow()}
    ${headLeg ? legBar({ title: `Tour ${headLeg.n}`, sub: headLeg.name, aria: `Tour ${headLeg.n}, ${headLeg.name}` }) : ""}
    <div class="rr-stage rn-stage">
      <div class="rd-path rr rn" id="rd-path">${bare}${!nxt && coming ? coming : ""}</div>
    </div>
    ${nowPlate(nowName)}`;
  } else app.innerHTML = `
    <div class="rd-top">${statBar()}</div>
    ${leg ? `<section class="rd-banner" aria-label="The tour you're on">
      <div><small>TOUR ${leg.n} · ${esc(v.name.toUpperCase())}</small><b>${esc(leg.name)}</b></div>
      <button class="rd-book" id="rd-book" aria-label="Open Rehearse: today's lesson">${icon("fretboard")}</button>
    </section>` : ""}
    ${chip ? `<div class="rd-chip">${chip}</div>` : ""}
    <div class="rd-path" id="rd-path">
      <div class="rd-say"><div class="rd-sayt"><p class="rd-bubble" id="rd-bubble">${esc(say.text)}</p>${song ? `<button class="rd-tonight" id="rd-tonight">${icon("play")}<span>Gig: ${esc(song.title)}</span></button>` : ""}</div></div>
      ${legsHTML}${coming}
    </div>${songbookBar}`;
  const $ = id => document.getElementById(id);
  bindStatBar();
  $("rd-sign")?.addEventListener("click", () => go("#/playmap"));
  homeHooks.refresh = null;
  if (wantDrawer) return go("#/library"); /* asked for the songs (4.9.0: the Songbook page, not a drawer) */
  $("rd-songbook")?.addEventListener("click", () => go("#/library"));
  $("rd-book")?.addEventListener("click", () => go("#/practice"));
  $("rd-tonight")?.addEventListener("click", () => song ? playGig(song.id, { from: "road" }) : openSearch("road")); /* 4.1.0: tonight's song is a gig */
  $("rd-search")?.addEventListener("click", () => openSearch("road")); /* 4.48.0: opens with "Open your Songbook" on top */

  /* a stop: tap it for its card (the current stop's is open already); Start opens the lesson or the song */
  const path = $("rd-path");
  const start = id => {
    const s = all.find(x => x.id === id);
    if (!s) return;
    if (s.piece) return pieceStart(s);
    if (s.cs) { /* a stop of the new Tour: its Opening night step or its first lesson not done */
      const nx = playNext(data, s);
      if (!nx) return;
      return nx.lesson ? go("#/practice/" + encodeURIComponent(nx.lesson)) : openingStart(OPENING.findIndex(o => o.id === nx.opening));
    }
    go("#/practice/" + encodeURIComponent(s.id));
  };
  /* a piece of the tour's song: the round opens from the tap itself, so the phone lets the microphone start */
  const pieceStart = s => {
    if (!songOfTour(s)) return toast("Pick this tour's song first");
    openRound({ id: s.id, tour: s.tourId, kind: s.headline ? "headline" : "round", name: s.name, sub: s.name, piece: true, chords: allowedChords(s.id), state: s.state }, { onClose: () => { if (document.getElementById("rd-path")) renderRoad(); } });
  };
  path.addEventListener("click", e => {
    const q = sel => e.target.closest(sel);
    const take = (tid, sg) => { const r = tourSetSong(tourData(data), tid, sg); Tabs.save(data); return r; };
    let b;
    if ((b = q("[data-tsong]"))) { const tid = b.dataset.tsong, sb = songbookFor(tourData(data), tid); if (sb) { take(tid, sb.song); renderRoad(); } return; }
    if ((b = q("[data-twait]"))) { const tid = b.dataset.twait, sg = data.songs.find(x => x.id === b.dataset.songId); if (sg) { take(tid, sg); delete tourData(data).curriculum?.waiting?.[sg.id]; Tabs.save(data); renderRoad(); } return; }
    if ((b = q("[data-tfirst]"))) { const tid = b.dataset.tfirst, l1 = tour1Song(data, []); if (l1?.from === "list") { tourPicked(tourData(data), tid, { title: l1.title, artist: l1.artist, chords: l1.chords, new: [] }); Tabs.save(data); if (aiKey()) tourGet(tid); else toast("Add your own key in Settings to get this song, or choose one from your Songbook"); renderRoad(); } return; }
    if ((b = q("[data-tget]"))) { if (aiKey()) tourGet(b.dataset.tget); else toast("Add your own key in Settings to get this song, or choose one from your Songbook"); return; }
    if ((b = q("[data-tpick]"))) { askPick(b.dataset.tpick); renderRoad(); return; }
    if ((b = q("[data-tchoose]"))) return chooseSong(b.dataset.tchoose);
    if ((b = q("[data-tswap]"))) { tourSwap(tourData(data), b.dataset.tswap); Tabs.save(data); tourErr.delete(b.dataset.tswap); return renderRoad(); }
    if ((b = q("[data-capo]"))) { data.settings = { ...data.settings, capo: b.dataset.capo === "1" }; Tabs.save(data); return renderRoad(); }
    if ((b = q("[data-chart]"))) return go("#/song/" + encodeURIComponent(b.dataset.chart));
  });
  const closePop = () => { path.querySelectorAll(".rd-pop").forEach(p => p.remove()); path.classList.remove("has-pop"); };
  const openStopCard = (node, s, fromKey) => {
    const wrap = node.parentElement, open = wrap.querySelector(".rd-pop");
    closePop();
    if (!open && s) {
      wrap.insertAdjacentHTML("beforeend", stopCard(s)); path.classList.add("has-pop"); haptic(1); revealPop(path, wrap.querySelector(".rd-pop"));
      if (fromKey) wrap.querySelector(".rd-start")?.focus(); /* from the keyboard: on to the card's button */
    }
  };
  if (path.querySelector(".rn-neck")) armDrag(path);
  path.addEventListener("click", e => {
    if (path.querySelector(".rn-neck") && tookDrag(path)) return; /* a drag scrolls; it does not open a stop */
    if (e.target.closest("[data-tonight]")) return; /* Tonight, on the current stop: #rd-tonight has its own handler above */
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) return start(goBtn.dataset.go);
    const songBtn = e.target.closest("[data-song]");
    if (songBtn) return playGig(songBtn.dataset.song, { from: "road" });
    let node = e.target.closest("[data-stop]");
    /* Road Ready 9a: on a painted neck a pointer tap goes through one hit layer (roadHit): the current stop has a zone 32 units above
       and below its row across the whole Road, anything else goes to the nearest stop. A keyboard or VoiceOver activation (detail 0)
       is the stop's own button. The neck-only Road keeps the hit on the inlay itself. */
    const pn = path.querySelector(".rn-neck") ? null : e.target.closest(".rd-neck.road");
    const painted = pn && pn.querySelector("[data-hx]");
    if (painted && e.detail > 0 && !e.target.closest(".rd-pop")) node = (node || e.target.closest(".rr-hit")) ? roadTapNode(pn, e) : null;
    if (!node) return closePop(); /* a tap anywhere else closes the bubble */
    /* The next leg is on the neck, grayed out. A tap shows the locked card and does not open the lesson. */
    if (node.closest(".rn-dim")) {
      const locked = all.find(x => x.id === node.dataset.stop);
      return openStopCard(node, locked ? { ...locked, state: "locked" } : null, !e.detail);
    }
    const s = all.find(x => x.id === node.dataset.stop);
    if (s?.kind === "box" && s.state === "now") return openCase(node, s);
    openStopCard(node, s, !e.detail);
  });
  /* the stop a pointer tap on a painted neck selects */
  const roadTapNode = (neck, e) => {
    const r = neck.getBoundingClientRect(), lh = +neck.dataset.lh || 1, vx = +neck.dataset.vx || 0, vw = +neck.dataset.vw || 390, tap = { x: vx + (e.clientX - r.left) / r.width * vw, y: (e.clientY - r.top) / r.height * lh };
    const btns = [...neck.querySelectorAll("[data-stop][data-hx]")];
    const pts = btns.map(b => { const art = b.querySelector(".rr-art"); return { x: +b.dataset.hx, y: +b.dataset.hy, w: +art?.getAttribute("width") || 0, h: +art?.getAttribute("height") || 0, done: b.classList.contains("done"), badge: b.dataset.kind === "double" }; });
    const at = roadHit(pts, tap, cur ? btns.findIndex(b => b.dataset.stop === cur.id) : -1);
    return btns[at] || null;
  };
  /* Escape closes the card and puts focus back on its stop, wherever focus is (one listener for the page, see escapeCard) */
  escapeCard = () => {
    const pop = document.contains(path) && path.querySelector(".rd-pop");
    if (!pop) return false;
    const stop = pop.parentElement.querySelector("[data-stop]");
    closePop(); stop?.focus();
    return true;
  };
  /* 4.76.0: tap the next box: it opens, the fans burst in, then the road moves on. 4.82.0: the pearl drops into the inlay. */
  const openCase = (node, s) => {
    if (node.classList.contains("opening") || !openBox(data, s.id)) return;
    Tabs.save(data); haptic(2);
    node.parentElement.querySelector(".rd-tag")?.remove();
    node.classList.add("opening", "done"); node.classList.remove("now", "cur");
    if (node.classList.contains("rn-stop")) {
      node.querySelector(".rr-glow")?.remove();
      node.querySelector(".rn-lock")?.remove();
      const neck = node.closest(".rn-neck");
      const slot = node.closest(".rn-slot");
      neck?.querySelector(`.rn-lock[data-for="${CSS.escape(node.dataset.stop)}"]`)?.remove();
      if (neck && slot && !neck.querySelector(`.rn-check[data-for="${CSS.escape(node.dataset.stop)}"]`)) {
        neck.insertAdjacentHTML("beforeend", `<img class="rn-mark rn-check" data-for="${node.dataset.stop}" style="top:${slot.style.top};left:${slot.style.left}" src="art/road-neck/check-v2.webp?v=${VERSION}" alt="" draggable="false">`);
      }
    } else node.innerHTML = rr ? rrStopArt(node.dataset.kind, "done", +node.dataset.n) : inlaySVG(node.dataset.inlay, "set", false, node.dataset.mat);
    showCallout({ kind: "earn", pow: "POW!", word: "MERCH BOX", big: `+${FANS.box} fans` });
    setTimeout(() => { if (document.contains(node)) renderRoad(); }, 1400);
  };
  $("rn-now-open")?.addEventListener("click", e => {
    const node = cur && path.querySelector(".rd-node.cur");
    if (node && cur) openStopCard(node, cur, !e.detail);
  });
  $("rn-now-start")?.addEventListener("click", () => {
    if (!cur) return;
    if (cur.kind === "box" && cur.state === "now") {
      const node = path.querySelector(".rd-node.cur");
      if (node) openCase(node, cur);
      return;
    }
    start(cur.id);
  });
  /* the current stop sits a third of the way down the path */
  const curNode = cur && path.querySelector(`[data-stop="${CSS.escape(cur.id)}"]`);
  if (path.querySelector(".rn-neck")) { pinNeck(path); pinLeg(path); armFit(); }
  else if (curNode) {
    const pr = path.getBoundingClientRect(), nr = curNode.getBoundingClientRect(), neck = curNode.closest(".rd-neck");
    let to = path.scrollTop + nr.top - pr.top - path.clientHeight / 3;
    /* 4.82.1: near the nut, show the headstock and its name rather than centring on the stop */
    if (neck) { const nt = path.scrollTop + neck.getBoundingClientRect().top - pr.top; if (nr.top - neck.getBoundingClientRect().top < 400) to = Math.min(to, nt - 8); }
    path.scrollTop = Math.max(0, to);
  }
  if (plays) fillScene(st);
  headlinerEarned(oldRoad);
  guitarEarned(oldRoad);
  guitaristAsk();
}

/* 4.85.0: a player who never made a guitarist (past Opening night) meets the picker once, after the other sheets. Skip keeps the default. */
function guitaristAsk() {
  if (data.me || layer.innerHTML || openingView(data)) return;
  makerSheet({ mode: "once", done: () => renderRoad() });
}

/* Headliner is retired. The Road does not offer it, and nothing here switches a player into it. */
function headlinerEarned() {}


/* 4.82.0: the first Road shown after a leg's headline show is done tells you the next guitar is yours. Said once;
   if the Headliner sheet is up, it waits for the next Road. */
function guitarEarned(road) {
  if (layer.innerHTML) return;
  const gn = guitarNew(data);
  if (!gn) return;
  data.guitars = { seen: gn.done }; Tabs.save(data);
  const was = road.legs.find(l => l.id === gn.leg) || road.legs.find(l => TOUR_LEG[l.id] === gn.leg), lg = road.legs.find(l => l.id === gn.next) || (was ? road.legs[road.legs.indexOf(was) + 1] : null);
  /* Road Ready: the new guitar in the stand, neighbours peeking, Louie and the name under it, then Rock on */
  if (rrLook()) {
    const owned = collectionOf(data, gn.next), at = standIndex(owned, gn.next);
    layer.innerHTML = `<div class="scrim" id="gt-scrim"></div><div class="panel de-sheet rd-hl rd-gt rr-case" role="dialog" aria-label="New guitar earned"><div class="grab"></div>
    <div class="pbody">
      <p class="sc-over">HEADLINE SHOW</p>
      <h2 class="sc-title">${was ? `${esc(was.name)}, all ${was.stops.length} shows` : "Tour done"}</h2>
      <p class="sc-new">New guitar earned</p>
      ${standHTML(owned, { active: at, variant: "sheet" })}
      <div class="sc-who"><span class="sc-louie">${louie("cheer", { size: 76 })}</span><span class="sc-label">${esc(gn.guitar.name)}</span></div>
      <p class="sc-got">${esc(gn.guitar.name)} is yours.</p>
      ${lg ? `<p class="sc-next">Next stop: Tour ${lg.n}, ${esc(lg.name)}</p>` : ""}
      <div class="sc-acts"><button class="btn primary" id="gt-x">Rock on</button></div>
    </div></div>`;
    bindStand(document.querySelector(".rd-gt .gs-stage"));
  }
  else layer.innerHTML = `<div class="scrim" id="gt-scrim"></div><div class="panel de-sheet rd-hl rd-gt" role="dialog" aria-label="New guitar"><div class="grab"></div>
    <div class="pbody"><div class="rd-gt-row">${louie("cheer", { size: 96, pose: "hornsUp" })}<div class="rd-gt-art">${guitarSVG(gn.next)}</div></div>
    <h2>New guitar</h2><p>${esc(gn.guitar.name)}${lg ? ` is yours for Tour ${lg.n}, ${esc(lg.name)}.` : " is yours."}</p>
    <div class="rd-hl-acts"><button class="btn primary" id="gt-x">ROCK ON</button></div></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("gt-scrim").onclick = close; document.getElementById("gt-x").onclick = close;
  haptic(2);
}

/* 4.45.2: a tapped stop's card can open below the visible path (under the tab bar); scroll the path so all of it shows, button included */
function revealPop(path, pop) {
  fitPop(pop);
  requestAnimationFrame(() => {
    const p = path.getBoundingClientRect(), r = pop.getBoundingClientRect();
    /* 4.83.0: clear of the Songbook bar too, which floats over the bottom of the path */
    const tabs = document.getElementById("tabs"), sbk = document.querySelector(".rd-sbk"), now = document.getElementById("rn-now");
    const floor = Math.min(p.bottom, tabs && tabs.offsetParent !== null ? tabs.getBoundingClientRect().top : p.bottom, sbk && sbk.offsetParent !== null ? sbk.getBoundingClientRect().top : p.bottom, now ? now.getBoundingClientRect().top : p.bottom) - 14;
    const over = r.bottom - floor;
    if (over > 0) path.scrollTo({ top: path.scrollTop + over, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
}

/* 5.17.2: on the neck the card is centred under its stop; near a screen edge it moves sideways just enough to stay 12 px clear, and its point
   moves the other way so it stays on the inlay (--dx in the .rn-neck .rd-pop rule) */
function fitPop(pop) {
  if (!pop?.closest(".rn-neck")) return;
  pop.style.setProperty("--dx", "0px");
  const r = pop.getBoundingClientRect(), w = document.documentElement.clientWidth, pad = 12;
  const dx = r.left < pad ? pad - r.left : r.right > w - pad ? w - pad - r.right : 0;
  pop.style.setProperty("--dx", `${Math.round(dx)}px`);
}

/* The scene loads a moment later: when someone is pushing on your edge, Louie says so. */
async function fillScene(st) {
  let sc;
  try { const m = await import(`./scene.js?v=${VERSION}`); sc = await m.sceneFor((await import(`./playmap.js?v=${VERSION}`)).getSpot()); } catch { return; }
  if (route().name !== "road") return;
  if (sc.below > 0 && !st.today) {
    const say = document.getElementById("rd-bubble");
    if (say) say.textContent = `${sc.pusher ? sc.pusher.name : "The local scene"} is pushing on your edge (${sc.below} of 7 days). About ${Math.ceil(sc.pressure.bar)} minutes a day holds it.`;
  }
}
