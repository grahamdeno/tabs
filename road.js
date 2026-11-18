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
import { KNOW_PLAYS, chordPlays, songsWith, VERSION, boxesSeed, guitarNew, openBox, venueNow, fansNow, tipsOf, lifetimePlays, openingAdvance, openingSkip, openingStep, openingView, pickNudge, playSongs, playableSongs, roadPath, skillState, streakOf, FANS, OPENING, Tabs } from "./core.js";
import { app, ask, esc, haptic, icon, layer, toast } from "./ui.js";
import { micSheet, songFor } from "./opening.js";
import { makerSheet } from "./maker.js";
import { applyTheme, chordNames, data, go, homeHooks, nextSongs, openSearch, playGig, route, showCallout } from "./app.js";
import { aiKey } from "./aihelp.js";
import { louie } from "./louie.js";
import { guitarSVG, guitarPic, inlaySVG, neckHTML, rrStopArt } from "./fretboard.js";
import { statBar, bindStatBar, settleStats, statNotices } from "./hud.js";

const DAY = 86400000;
const nf = x => x.toLocaleString("en-US");
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
window.addEventListener("resize", () => { if (document.body.classList.contains("is-home")) screenHeight(); });

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
/* the songs a headline show can be played with: only that leg's chords, the last played first */
const fitsFor = stop => (stop.chords ? data.songs.filter(sg => { const c = chordNames(sg.body || ""); return c.length >= 2 && c.every(n => stop.chords.includes(n)); })
  .sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0)) : []);
const stopTitle = s => s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.kind === "chord" ? `The ${s.name} chord` : s.name;
const ZIG = [0, 46, 72, 46, 0, -46, -72, -46];
const tagOf = s => s.kind === "headline" ? "Headline show" : s.kind === "box" ? (s.state === "now" ? "Tap to open" : "Merch box") : s.kind === "chord" ? `${s.name} chord` : s.name;
/* A pick's card, opened by a tap (4.35.0, like the old card but only on a tap): the next stop's is in the
   streak colour with Start (or, at a headline, Play and the song that fits); any other pick's is a quiet one */
function stopCard(stop) {
  const title = stopTitle(stop), now = stop.state === "now" || stop.state === "open";
  if (stop.kind === "headline" && stop.state !== "locked") {
    const fits = fitsFor(stop), song = data.songs.find(x => x.id === stop.song) || fits[0];
    const line = song ? `Play ${song.title} start to finish. It uses only this leg's chords.` : `Play a song that uses only ${stop.chords.join(", ")}, start to finish.`;
    return `<div class="rd-pop ${stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(line)}</p>
      ${song ? `<div class="rd-earn"><span>+${FANS.play} fans</span></div>` : ""}<button class="btn primary rd-start" data-go="${esc(stop.id)}">${song ? (stop.state === "done" ? "PLAY AGAIN" : `PLAY ${esc(song.title.toUpperCase())}`) : "FIND A SONG THAT FITS"}</button>
      ${fits.length > 1 ? `<button class="rd-other" id="rd-other">Other songs that fit (${fits.length - 1})</button>` : ""}</div>`;
  }
  const line = stop.kind === "chord" ? "Ring every string clean, one at a time."
    : stop.kind === "switch" ? "Land the change on the beat."
    : stop.kind === "scale" ? "Up and back down, one note at a time."
    : stop.kind === "box" ? (stop.state === "done" ? `Opened: +${FANS.box} fans.` : `Reach it, then tap it open: +${FANS.box} fans.`) : "";
  /* 4.83.0: a chord's stop is also done by playing it in KNOW_PLAYS songs to the end; the card says how far along you are */
  let alt = "";
  if (stop.kind === "chord" && stop.state !== "done") {
    const n = Math.min(chordPlays(data, stop.chord), KNOW_PLAYS - 1), left = KNOW_PLAYS - n, songs = songsWith(data, stop.chord);
    alt = `<p class="rd-alt">${stop.state === "locked" ? "Songs count already: play" : "Or play"} ${esc(stop.chord)} in ${left} more song${left === 1 ? "" : "s"}, start to finish (${n} of ${KNOW_PLAYS}).${songs.length ? "" : ` None of your songs have ${esc(stop.chord)} yet.`}</p>`
      + (songs.length ? `<button class="rd-other" data-song="${esc(songs[0].id)}">Play ${esc(songs[0].title)}${songs.length > 1 ? ` (or ${songs.length - 1} more with ${esc(stop.chord)})` : ""}</button>` : "");
  }
  const act = stop.kind === "box" || stop.state === "locked" ? ""
    : `${stop.state === "done" ? "" : `<div class="rd-earn"><span>+${FANS.lesson} fans</span></div>`}<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" ? "PLAY AGAIN" : "START"}</button>`;
  return `<div class="rd-pop ${now ? "now" : stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(stop.state === "locked" && stop.kind !== "box" ? (stop.kind === "chord" ? "Its lesson opens when you get here." : "Finish the stops before this one to open it.") : line)}</p>${act}${alt}</div>`;
}
/* Other songs for a headline show: a short list, any of them starts the gig */
function otherSongs(stop) {
  const fits = fitsFor(stop);
  layer.innerHTML = `<div class="scrim" id="ro-scrim"></div><div class="panel de-sheet rd-others" role="dialog" aria-label="Songs for the headline show"><div class="grab"></div>
    <div class="ph"><button class="tb" id="ro-x">Close</button><h2>Headline show</h2><span style="width:56px"></span></div>
    <div class="pbody"><p class="easy-note">These use only ${esc(stop.chords.join(", "))}. Play one start to finish.</p>
    <div class="list glass">${fits.map(sg => `<button class="row" data-play="${esc(sg.id)}"><div class="txt"><div class="t">${esc(sg.title)}</div><div class="a">${esc(sg.artist || "")}</div></div></button>`).join("")}</div></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("ro-scrim").onclick = close; document.getElementById("ro-x").onclick = close;
  layer.querySelectorAll("[data-play]").forEach(b => b.onclick = () => { close(); playGig(b.dataset.play, { from: "road" }); });
}

/* ---- Opening night (4.40.0): the first leg teaches the app by doing it ---- */
const OIC = {
  mic: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="11" y="3" width="10" height="17" rx="5" fill="#fff"/><path d="M6.5 14a9.5 9.5 0 0 0 19 0M16 24v5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/></svg>`,
  chord: ICONS.chord,
  verse: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 5l17 11-17 11z" fill="#fff"/></svg>`,
  pause: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="5" width="7" height="22" rx="2.5" fill="#fff"/><rect x="18" y="5" width="7" height="22" rx="2.5" fill="#fff"/></svg>`,
  show: ICONS.star
};
const OSAY = ["Hi, I'm Louie. Tap the glowing pick and make your guitarist. Then I'll show you around: six steps, ending with your first show.",
  "Now I'll ask for the microphone. Tap the glowing pick.",
  "Now a chord. Tap the glowing pick.", "Time to play. Just the first verse.",
  "Next: pausing, and picking up where you left off.", "Last one: your first show, start to finish."];
function openingCard(i, step) {
  const o = OPENING[i], state = i < step ? "done" : i === step ? "now" : "locked";
  const line = state === "locked" ? "Finish the steps before this one." : state === "done" ? "Done." : [
    "Pick a starter, a skin tone and a hair colour. It's you on your card and the chart.", "I'll say why I listen, then your phone asks for the microphone.", "Open the song and tap a chord to see its shape.",
    "Play the first verse. Play each chord as it comes.", "Play, tap anywhere to pause, then Resume.", "Play a song start to finish."][i];
  const btn = state === "now" ? `<button class="btn primary rd-start" data-ostart="${i}">${o.id === "show" ? `PLAY · +${FANS.play} FANS` : o.id === "who" ? "PICK YOURS" : `START · +${FANS.lesson} FANS`}</button>` : "";
  return `<div class="rd-pop ${state}" role="dialog" aria-label="${esc(o.name)}"><b>${esc(o.name)}</b><p>${esc(line)}</p>${btn}</div>`;
}
function renderOpening(view) {
  const done = view === "done", step = done ? OPENING.length : openingStep(data);
  if (done && !data.opening.seen) { data.opening.seen = Date.now(); Tabs.save(data); }
  const stops = OPENING.map((o, i) => {
    const state = i < step ? "done" : i === step ? "now" : "locked", x = ZIG[i % ZIG.length], big = o.id === "show";
    return `<div class="rd-stop on-stop" style="--x:${x}px"><button class="rd-node ${big ? "headline big" : "chord"} ${state}" data-ostep="${i}" aria-label="${esc(`${o.name}, ${state === "now" ? "your next step" : state}`)}">${pickSVG(state === "now")}<span class="rd-ic">${state === "done" ? ICONS.check : OIC[o.id]}</span></button><span class="on-lab ${x > 0 ? "l" : "r"}${state === "locked" ? " dim" : ""}"><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></span></div>`;
  }).join("");
  app.innerHTML = `
    <div class="rd-top${done ? "" : ""}">${statBar()}</div>
    <section class="rd-banner on-night" aria-label="Opening night">
      <div><small>OPENING NIGHT${done ? " · DONE" : ` · ${OPENING.length} STEPS`}</small><b>${done ? "Your first night" : "Learn the stage"}</b></div>
      ${done ? `<button class="on-skip" id="on-next">On to Leg 1</button>` : `<button class="on-skip" id="on-skip">Skip</button>`}
    </section>
    <div class="rd-path on-path" id="rd-path">
      <div class="rd-say"><div class="rd-sayt"><p class="rd-bubble" id="rd-bubble">${esc(done ? "That's your opening night! Your streak starts now. Tap it up top to see your player card." : OSAY[step])}</p></div>${louie(done ? "cheer" : "happy", { pose: done ? "thumb" : "wave", size: 112 })}</div>
      ${stops}
    </div>`;
  const $ = id => document.getElementById(id);
  bindStatBar();
  homeHooks.refresh = null;
  $("on-next")?.addEventListener("click", () => renderRoad());
  $("on-skip")?.addEventListener("click", () => ask({ title: "Skip opening night?", text: "You can replay it any time from Settings > Help > Tips & gestures.", ok: "Skip it", keep: "Keep going" },
    () => { openingSkip(data); Tabs.save(data); renderRoad(); }));
  const path = $("rd-path");
  const closePop = () => { path.querySelectorAll(".rd-pop").forEach(p => p.remove()); };
  path.addEventListener("click", e => {
    const st = e.target.closest("[data-ostart]");
    if (st) {
      const id = OPENING[+st.dataset.ostart].id;
      if (id === "who") return makerSheet({ mode: "start", done: () => { openingAdvance(data, "who"); Tabs.save(data); renderRoad(); } });
      if (id === "mic") return micSheet(() => renderRoad());
      const song = songFor();
      if (!song) { toast("Add a song with chords first; then it's your stage"); return go("#/library"); }
      return id === "chord" ? go("#/song/" + encodeURIComponent(song.id)) : playGig(song.id, { from: "road" });
    }
    const node = e.target.closest("[data-ostep]");
    const open = node?.parentElement.querySelector(".rd-pop");
    closePop();
    if (node && !open) { node.parentElement.insertAdjacentHTML("beforeend", openingCard(+node.dataset.ostep, step)); haptic(1); revealPop(path, node.parentElement.querySelector(".rd-pop")); }
  });
}

/* ---- Road Ready: the header strip ---- */
const TICKET_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M15 7v10" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 2"/></svg>`;
const COIN_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" class="rr-coin"/><circle cx="12" cy="12" r="7.4" fill="none" class="rr-coin-ring"/><path d="M14.6 9.2c-.6-.8-1.5-1.1-2.6-1.1-1.5 0-2.5.7-2.5 1.8 0 2.6 5.2 1.3 5.2 4.1 0 1.2-1.1 1.9-2.7 1.9-1.2 0-2.2-.4-2.8-1.3M12 6.6v1.5M12 15.9v1.5" fill="none" class="rr-coin-ink" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const PLAY_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13l10-6.5z" fill="currentColor"/></svg>`;
function rrHeader({ v, leg, cur, song, st }) {
  const stops = leg ? leg.stops : [], at = cur ? stops.indexOf(cur) : -1;
  const n = at >= 0 ? at + 1 : stops.filter(s => s.state === "done").length, of = stops.length;
  const pips = stops.map(s => `<i class="${s === cur ? "now" : s.state === "done" ? "done" : ""}"></i>`).join("");
  const fans = fansNow(data), tips = tipsOf(data), days = st.days || 0;
  const show = of ? `Show ${n} of ${of}` : "", next = v.next ? `${v.next} next` : "";
  const plate = [v.name, show && show.toLowerCase(), next].filter(Boolean).join(", ");
  return `<header class="rr-hdr" aria-label="Your tour">
    <button class="rr-plate" id="h-venue" aria-label="${esc(plate)}. Open the Tour Map">
      <span class="rr-pl-main"><b class="rr-venue">${esc(v.name)}</b>${show ? `<small>${esc(show)}</small>` : ""}</span>
      <span class="rr-pl-side" aria-hidden="true">${of ? `<span class="rr-pips">${pips}</span>` : ""}${next ? `<small>${esc(next)}</small>` : ""}</span>
    </button>
    <button class="rr-pill rr-fans" id="h-fans" aria-label="${nf(fans)} fans${days ? `, ${days}-day gig streak` : ""}. Open your profile"><span class="rr-pv">${TICKET_IC}<b>${nf(fans)}</b></span><small>${days ? `${days}-day streak` : "Fans"}</small></button>
    <button class="rr-pill rr-tips" id="h-tips" aria-label="${nf(tips)} dollars in tips. Open the Merch table"><span class="rr-pv">${COIN_IC}<b>$${nf(tips)}</b></span><small>Tips</small></button>
    <button class="rr-tonight" id="rd-tonight" aria-label="${song ? esc(`Tonight: ${song.title}. Play`) : "Add a song to play tonight"}">
      <span class="rr-tn-t"><small>TONIGHT</small><b>${song ? esc(song.title) : "Add a song to play tonight"}</b></span>
      <span class="rr-play" aria-hidden="true">${song ? PLAY_IC : icon("search")}</span>
    </button>
  </header>`;
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

export function renderRoad() {
  screenHeight(); window.scrollTo(0, 0);
  const ov = openingView(data);
  if (ov) { homeHooks.openDrawer = false; return renderOpening(ov); }
  const wantDrawer = homeHooks.openDrawer; homeHooks.openDrawer = false;
  const rr = rrLook();
  if (rr) settleStats(); /* Rain checks and fading fans first, so the streak and fans shown are the settled ones */
  const plays = lifetimePlays(data), st = streakOf(playSongs(data)), v = venueNow(data);
  if (boxesSeed(data)) Tabs.save(data); /* 4.76.0: boxes already reached stay opened */
  const road = roadPath(data), cur = road.current, leg = road.leg;
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
  const rrLabel = s => {
    if (s.kind === "headline" || s.kind === "box") return esc(`${s.kind === "headline" ? "Headline show" : "Merch box"}, ${said(s)}`);
    const l = road.legs.find(x => x.stops.includes(s)), state = s.state === "now" ? "current" : s.state === "done" ? "done" : s.state === "open" ? "open" : "locked";
    return esc(`Show ${numOf(s)} of ${l ? l.stops.length : 0}, ${stopTitle(s)}, ${state}`);
  };
  const labelOf = rr ? rrLabel : s => esc(`${s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.name}, ${said(s)}`);
  /* 4.84.0: how many of your songs each lesson's chord would open (with the chords you know) */
  const opens = s => s.kind === "chord" && s.chord ? playableSongs(data, s.chord).more : 0;
  const fresh = rr && lastCur && cur && lastCur !== cur.id ? cur.id : null;
  lastCur = cur?.id || null;
  const gx = { cur, id: s => esc(s.id), icon: dotIcon, label: labelOf, tag: s => esc(rr ? rrTag(s, all) : tagOf(s)), songs: opens, rr, num: numOf, fresh };
  const legsHTML = road.legs.map((l, n) => `
    <div class="rd-legmark${l === leg ? " cur" : ""}"><span>${rr ? `Leg ${l.n}, ${esc(l.name)}` : `Leg ${l.n} · ${esc(l.name)}`}</span></div>
    ${road.legs[n - 1]?.done ? `<span class="rd-newg">New guitar earned</span>` : ""}
    ${neckHTML(l, gx)}`).join("");
  const coming = road.coming.length ? `<div class="rd-coming"><svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg><span>Coming to the Road: ${esc(road.coming.join(", "))}</span></div>` : "";

  const songbookBar = `
    <div class="rd-sbk">
      <button class="rd-sbk-go" id="rd-songbook" aria-label="Open the Songbook">
        <span class="rd-sbk-ic" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 3v10a3.5 3.5 0 1 1-2-3.2V1l10 2v4L7 5z"/></svg></span>
        <span class="rd-sbk-t"><b>Songbook</b><small>${data.songs.length ? `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}` : "Empty"}</small></span>
      </button>
      <button class="rd-sbk-q" id="rd-search">${icon("search")}<span>Search or add a song</span></button>
    </div>`;
  if (rr) {
    app.innerHTML = `
    ${rrHeader({ v, leg, cur, song, st })}
    <p class="rr-say" id="rd-bubble">${esc(say.text)}</p>
    <div class="rr-stage">
      <div class="rd-path rr" id="rd-path">${legsHTML}${coming}</div>
      <span class="rd-peek" aria-hidden="true"></span>
    </div>${songbookBar}`;
  } else app.innerHTML = `
    <div class="rd-top">${statBar()}</div>
    ${leg ? `<section class="rd-banner" aria-label="The leg you're on">
      <div><small>LEG ${leg.n} · ${esc(v.name.toUpperCase())}</small><b>${esc(leg.name)}</b></div>
      <button class="rd-book" id="rd-book" aria-label="Open Rehearse: today's lesson">${icon("fretboard")}</button>
    </section>` : ""}
    ${chip ? `<div class="rd-chip">${chip}</div>` : ""}
    <div class="rd-path" id="rd-path">
      <div class="rd-say"><div class="rd-sayt"><p class="rd-bubble" id="rd-bubble">${esc(say.text)}</p>${song ? `<button class="rd-tonight" id="rd-tonight">${icon("play")}<span>Gig: ${esc(song.title)}</span></button>` : ""}</div>${louie(say.mood, { pose: say.pose, size: 112 })}</div>
      ${legsHTML}${coming}
    </div>${songbookBar}`;
  const $ = id => document.getElementById(id);
  if (rr) {
    $("h-venue").onclick = () => go("#/playmap");
    $("h-fans").onclick = () => go("#/you");
    $("h-tips").onclick = () => go("#/merch");
    statNotices();
  } else bindStatBar();
  homeHooks.refresh = null;
  if (wantDrawer) return go("#/library"); /* asked for the songs (4.9.0: the Songbook page, not a drawer) */
  $("rd-songbook").onclick = () => go("#/library");
  $("rd-book")?.addEventListener("click", () => go("#/practice"));
  $("rd-tonight")?.addEventListener("click", () => song ? playGig(song.id, { from: "road" }) : openSearch("road")); /* 4.1.0: tonight's song is a gig */
  $("rd-search").onclick = () => openSearch("road"); /* 4.48.0: opens with "Open your Songbook" on top */

  /* a stop: tap it for its card (the current stop's is open already); Start opens the lesson or the song */
  const path = $("rd-path");
  const start = id => {
    const s = all.find(x => x.id === id);
    if (!s) return;
    if (s.kind === "headline") {
      const sg = s.song || fitsFor(s)[0]?.id;
      if (sg) return playGig(sg, { from: "road" });
      if (aiKey()) return nextSongs(); /* songs from the chords you play */
      toast(`Add a song that uses only ${s.chords.join(", ")}, then play it through`); return go("#/library");
    }
    go("#/practice/" + encodeURIComponent(s.id));
  };
  const closePop = () => { path.querySelectorAll(".rd-pop").forEach(p => p.remove()); path.classList.remove("has-pop"); };
  path.addEventListener("click", e => {
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) return start(goBtn.dataset.go);
    if (e.target.closest("#rd-other")) return otherSongs(cur);
    const songBtn = e.target.closest("[data-song]");
    if (songBtn) return playGig(songBtn.dataset.song, { from: "road" });
    const node = e.target.closest("[data-stop]");
    if (!node) return closePop(); /* a tap anywhere else closes the bubble */
    const s = all.find(x => x.id === node.dataset.stop), wrap = node.parentElement;
    if (s?.kind === "box" && s.state === "now") return openCase(node, s);
    const open = wrap.querySelector(".rd-pop");
    closePop();
    if (!open && s) { wrap.insertAdjacentHTML("beforeend", stopCard(s)); path.classList.add("has-pop"); haptic(1); revealPop(path, wrap.querySelector(".rd-pop")); }
  });
  /* 4.76.0: tap the next box: it opens, the fans burst in, then the road moves on. 4.82.0: the pearl drops into the inlay. */
  const openCase = (node, s) => {
    if (node.classList.contains("opening") || !openBox(data, s.id)) return;
    Tabs.save(data); haptic(2);
    node.parentElement.querySelector(".rd-tag")?.remove();
    node.classList.add("opening", "done"); node.classList.remove("now");
    node.innerHTML = rr ? rrStopArt(node.dataset.kind, "done", +node.dataset.n) : inlaySVG(node.dataset.inlay, "set", false, node.dataset.mat);
    showCallout({ kind: "earn", pow: "POW!", word: "MERCH BOX", big: `+${FANS.box} fans` });
    setTimeout(() => { if (document.contains(node)) renderRoad(); }, 1400);
  };
  /* the current stop sits a third of the way down the path */
  const curNode = cur && path.querySelector(`[data-stop="${CSS.escape(cur.id)}"]`);
  if (curNode) {
    const pr = path.getBoundingClientRect(), nr = curNode.getBoundingClientRect(), neck = curNode.closest(".rd-neck");
    let to = path.scrollTop + nr.top - pr.top - path.clientHeight / 3;
    /* 4.82.1: near the nut, show the headstock and its name rather than centring on the stop */
    if (neck) { const nt = path.scrollTop + neck.getBoundingClientRect().top - pr.top; if (nr.top - neck.getBoundingClientRect().top < 400) to = Math.min(to, nt - 8); }
    path.scrollTop = Math.max(0, to);
  }
  if (plays) fillScene(st);
  headlinerEarned(road);
  guitarEarned(road);
  guitaristAsk();
}

/* 4.85.0: a player who never made a guitarist (past Opening night) meets the picker once, after the other sheets. Skip keeps the default. */
function guitaristAsk() {
  if (data.me || layer.innerHTML || openingView(data)) return;
  makerSheet({ mode: "once", done: () => renderRoad() });
}

/* 4.78.0: the first time a leg's headline show is done, Headliner is yours. Said once, on the Road. */
function headlinerEarned(road) {
  if (data.merch?.hlseen || layer.innerHTML || !road.legs.some(l => l.stops.some(s => s.kind === "headline" && s.state === "done"))) return;
  (data.merch || (data.merch = {})).hlseen = 1; Tabs.save(data);
  const on = data.settings.theme === "headliner";
  layer.innerHTML = `<div class="scrim" id="hl-scrim"></div><div class="panel de-sheet rd-hl" role="dialog" aria-label="Headliner is yours"><div class="grab"></div>
    <div class="pbody"><div class="rd-hl-lou">${louie("cheer", { size: 120, pose: "hornsUp" })}</div>
    <h2>You headlined</h2><p>Headliner is yours: black, gold and chrome under a blacklight. ${on ? "You're already wearing it." : "Put it on now, or any time in Settings or at the Merch table."}</p>
    <div class="rd-hl-acts">${on ? "" : `<button class="btn primary" id="hl-on">PUT IT ON</button>`}<button class="mt-not" id="hl-x">${on ? "Rock on" : "Not now"}</button></div></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("hl-scrim").onclick = close; document.getElementById("hl-x").onclick = close;
  document.getElementById("hl-on")?.addEventListener("click", () => { data.settings.theme = "headliner"; Tabs.save(data); applyTheme(); close(); toast("Headliner is on"); });
  haptic(2);
}


/* 4.82.0: the first Road shown after a leg's headline show is done tells you the next guitar is yours. Said once;
   if the Headliner sheet is up, it waits for the next Road. */
function guitarEarned(road) {
  if (layer.innerHTML) return;
  const gn = guitarNew(data);
  if (!gn) return;
  data.guitars = { seen: gn.done }; Tabs.save(data);
  const lg = road.legs.find(l => l.id === gn.next), was = road.legs.find(l => l.id === gn.leg);
  /* Road Ready 06 (spec 5.8, r10-03): the new guitar in Grok's painted open case (art/show), chrome L corners, the
     cheering Louie beside it; the leg you finished as the title and the next leg as the next stop */
  if (rrLook()) layer.innerHTML = `<div class="scrim" id="gt-scrim"></div><div class="panel de-sheet rd-hl rd-gt rr-case" role="dialog" aria-label="New guitar earned"><div class="grab"></div>
    <div class="pbody">
      <p class="sc-over">HEADLINE SHOW</p>
      <h2 class="sc-title">${was ? `${esc(was.name)}, all ${was.stops.length} shows` : "Leg done"}</h2>
      <p class="sc-new">New guitar earned</p>
      <div class="sc-show case" aria-hidden="true">
        <i class="sc-corner tl"></i><i class="sc-corner tr"></i><i class="sc-corner bl"></i><i class="sc-corner br"></i>
        <span class="sc-case"><span class="sc-guitar">${guitarPic(gn.guitar.body) ? `<img src="${guitarPic(gn.guitar.body)}" alt="">` : guitarSVG(gn.next, { full: true })}</span></span>
        <span class="sc-label">${esc(gn.guitar.name)}</span>
        <span class="sc-louie">${louie("cheer", { size: 96 })}</span>
      </div>
      <p class="sc-got">${esc(gn.guitar.name)} is yours.</p>
      ${lg ? `<p class="sc-next">Next stop: Leg ${lg.n}, ${esc(lg.name)}</p>` : ""}
      <div class="sc-acts"><button class="btn primary" id="gt-x">Rock on</button></div>
    </div></div>`;
  else layer.innerHTML = `<div class="scrim" id="gt-scrim"></div><div class="panel de-sheet rd-hl rd-gt" role="dialog" aria-label="New guitar"><div class="grab"></div>
    <div class="pbody"><div class="rd-gt-row">${louie("cheer", { size: 96, pose: "hornsUp" })}<div class="rd-gt-art">${guitarSVG(gn.next)}</div></div>
    <h2>New guitar</h2><p>${esc(gn.guitar.name)}${lg ? ` is yours for Leg ${lg.n}, ${esc(lg.name)}.` : " is yours."}</p>
    <div class="rd-hl-acts"><button class="btn primary" id="gt-x">ROCK ON</button></div></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("gt-scrim").onclick = close; document.getElementById("gt-x").onclick = close;
  haptic(2);
}

/* 4.45.2: a tapped stop's card can open below the visible path (under the tab bar); scroll the path so all of it shows, button included */
function revealPop(path, pop) {
  requestAnimationFrame(() => {
    const p = path.getBoundingClientRect(), r = pop.getBoundingClientRect();
    /* 4.83.0: clear of the Songbook bar too, which floats over the bottom of the path */
    const tabs = document.getElementById("tabs"), sbk = document.querySelector(".rd-sbk");
    const floor = Math.min(p.bottom, tabs && tabs.offsetParent !== null ? tabs.getBoundingClientRect().top : p.bottom, sbk && sbk.offsetParent !== null ? sbk.getBoundingClientRect().top : p.bottom) - 14;
    const over = r.bottom - floor;
    if (over > 0) path.scrollTo({ top: path.scrollTop + over, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });
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
