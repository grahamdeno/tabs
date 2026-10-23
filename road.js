// The Road (#/): home, since 4.0.0. The neck's ladder laid out as a path you travel, stop by stop.
//
//   stat bar    your venue, gig streak and fans (hud.js)
//   leg banner  the leg you're on and the venue you've reached; the book opens the neck
//   songs chip  how many of your songs you can play, and how many the next chord opens
//   the path    every stop of every leg as a guitar pick (4.34.0): lessons, merch boxes and the headline
//               show at the end (a level check: play a real song through). Done picks carry a check, the
//               next one is bigger, its halo pulses and it wiggles now and then (4.35.0); later ones are
//               locked. Nothing is open on arrival: tap a pick for its card (Start on the next one); at a
//               headline the card names a song that fits, with the others a tap away.
//   Louie       beside the path, with one line that fits the moment and tonight's song to play
//   Songbook    a bar along the bottom (4.9.0): the Songbook page, and search, a tap away
//   tab bar     Road, Tour, Charts, Band, Rehearse, More (hud.js)
// The screen itself never scrolls; the path scrolls inside it.
import { VERSION, lifetimePlays, openingSkip, openingStep, openingView, pickNudge, playSongs, playableSongs, roadPath, skillState, streakOf, venueOf, FANS, OPENING, Tabs } from "./core.js";
import { app, ask, esc, haptic, icon, layer, toast } from "./ui.js";
import { micSheet, songFor } from "./opening.js";
import { chordNames, data, go, homeHooks, nextSongs, openSearch, playGig, route } from "./app.js";
import { aiKey } from "./aihelp.js";
import { louie } from "./louie.js";
import { statBar, bindStatBar } from "./hud.js";

const DAY = 86400000;

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
  box: `<svg viewBox="0 0 34 30" aria-hidden="true"><path class="rd-bx" d="M4 14h26v11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path class="rd-bx" d="M4 12a8 8 0 0 1 8-8h10a8 8 0 0 1 8 8v1H4z"/><rect class="rd-bxk" x="13" y="11" width="8" height="8" rx="2"/><path class="rd-bxs" d="M4 13h26" stroke-width="2.4"/></svg>`,
  headline: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="10" r="7" fill="#fff"/><rect x="13.5" y="16" width="5" height="10" rx="2.5" fill="#fff"/><rect x="9" y="26" width="14" height="4" rx="2" fill="#fff"/></svg>`,
  lock: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg>`,
  check: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17l6 6 12-13" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3l4 8.3 9 1.3-6.5 6.3 1.6 9L16 23.6 7.9 27.9l1.6-9L3 12.6l9-1.3z" fill="currentColor"/></svg>`
};
/* 4.34.0: each stop is a rounded guitar pick (flat colour on a darker lip, a shine), point down */
const PICK = "M0 42 C-14 42 -46 14 -46 -12 C-46 -36 -26 -46 0 -46 C26 -46 46 -36 46 -12 C46 14 14 42 0 42 Z";
const pickSVG = now => `<svg class="rd-pk" viewBox="-60 -60 120 120" aria-hidden="true">${now ? `<path class="rd-halo" d="${PICK}" transform="scale(1.3)"/>` : ""}<path class="rd-lip" d="${PICK}" transform="translate(0 7)"/><path class="rd-body" d="${PICK}"/><path class="rd-shine" d="M-30 -30 C-20 -38 -4 -40 10 -40"/></svg>`;
const iconOf = s => s.state === "locked" && s.kind !== "box" ? ICONS.lock : s.kind === "headline" ? ICONS.star : s.kind === "box" ? ICONS.box : s.state === "done" ? ICONS.check : ICONS[s.kind] || ICONS.chord;
/* the songs a headline show can be played with: only that leg's chords, the last played first */
const fitsFor = stop => (stop.chords ? data.songs.filter(sg => { const c = chordNames(sg.body || ""); return c.length >= 2 && c.every(n => stop.chords.includes(n)); })
  .sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0)) : []);
const stopTitle = s => s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.kind === "chord" ? `The ${s.name} chord` : s.name;
const ZIG = [0, 46, 72, 46, 0, -46, -72, -46];
/* A pick's card, opened by a tap (4.35.0, like the old card but only on a tap): the next stop's is in the
   streak colour with Start (or, at a headline, Play and the song that fits); any other pick's is a quiet one */
function stopCard(stop) {
  const title = stopTitle(stop), now = stop.state === "now" || stop.state === "open";
  if (stop.kind === "headline" && stop.state !== "locked") {
    const fits = fitsFor(stop), song = data.songs.find(x => x.id === stop.song) || fits[0];
    const line = song ? `Play ${song.title} start to finish. It uses only this leg's chords.` : `Play a song that uses only ${stop.chords.join(", ")}, start to finish.`;
    return `<div class="rd-pop ${stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(line)}</p>
      <button class="btn primary rd-start" data-go="${esc(stop.id)}">${song ? `${stop.state === "done" ? "PLAY AGAIN" : `PLAY ${esc(song.title.toUpperCase())}`} · +${FANS.play} FANS` : "FIND A SONG THAT FITS"}</button>
      ${fits.length > 1 ? `<button class="rd-other" id="rd-other">Other songs that fit (${fits.length - 1})</button>` : ""}</div>`;
  }
  const line = stop.kind === "chord" ? "Ring every string clean, one at a time."
    : stop.kind === "switch" ? "Land the change on the beat."
    : stop.kind === "scale" ? "Up and back down, one note at a time."
    : stop.kind === "box" ? (stop.state === "done" ? `Opened: +${FANS.box} fans.` : `Opens when you reach it: +${FANS.box} fans.`) : "";
  const act = stop.kind === "box" || stop.state === "locked" ? ""
    : `<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" ? "PLAY AGAIN" : `START · +${FANS.lesson} FANS`}</button>`;
  return `<div class="rd-pop ${now ? "now" : stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(stop.state === "locked" && stop.kind !== "box" ? "Finish the stops before this one to open it." : line)}</p>${act}</div>`;
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
const OSAY = ["Hi, I'm Louie. Tap the glowing pick and I'll show you around. Five steps, then your first show.",
  "Now a chord. Tap the glowing pick.", "Time to play. Just the first verse.",
  "Next: pausing, and picking up where you left off.", "Last one: your first show, start to finish."];
function openingCard(i, step) {
  const o = OPENING[i], state = i < step ? "done" : i === step ? "now" : "locked";
  const line = state === "locked" ? "Finish the steps before this one." : state === "done" ? "Done." : [
    "I'll say why I listen, then your phone asks for the microphone.", "Open the song and tap a chord to see its shape.",
    "Play the first verse. Strum once on each chord change.", "Play, tap anywhere to pause, then Resume.", "Play a song start to finish."][i];
  const btn = state === "now" ? `<button class="btn primary rd-start" data-ostart="${i}">${o.id === "show" ? `PLAY · +${FANS.play} FANS` : `START · +${FANS.lesson} FANS`}</button>` : "";
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

export function renderRoad() {
  screenHeight(); window.scrollTo(0, 0);
  const ov = openingView(data);
  if (ov) { homeHooks.openDrawer = false; return renderOpening(ov); }
  const wantDrawer = homeHooks.openDrawer; homeHooks.openDrawer = false;
  const plays = lifetimePlays(data), st = streakOf(playSongs(data)), v = venueOf(plays);
  const road = roadPath(data), cur = road.current, leg = road.leg;
  const song = upNext(), say = louieLine(st, plays);
  const trip = song && plays && !st.today ? tripFor(song) : null;
  if (trip && say.mood !== "sleepy") say.text = `${trip.a} to ${trip.b} is the switch to warm up for ${song.title}.`;
  const ps = playableSongs(data, cur?.kind === "chord" ? cur.chord : "");
  const chip = !data.songs.length ? "" : ps.more > 0 ? `The ${esc(cur.chord)} chord opens <b>${ps.more} more</b> of your ${ps.of} songs`
    : `You can play <b>${ps.now} of your ${ps.of}</b> song${ps.of === 1 ? "" : "s"}`;

  /* the path: one column of stops per leg, zigzagging, with a label where each new leg starts */
  let i = 0;
  const legsHTML = road.legs.map(l => `
    <div class="rd-legmark${l === leg ? " cur" : ""}"><span>Leg ${l.n} · ${esc(l.name)}</span></div>
    ${l.stops.map(s => {
      const x = ZIG[i++ % ZIG.length], big = s.kind === "headline";
      const ic = iconOf(s);
      const label = `${s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.name}, ${s.state === "now" ? "your next stop" : s.state === "done" ? "done" : s.state === "open" ? "open" : "locked"}`;
      return `<div class="rd-stop${s === cur ? " cur" : ""}" style="--x:${x}px"><button class="rd-node ${s.kind} ${s.state}${big ? " big" : ""}" data-stop="${esc(s.id)}" aria-label="${esc(label)}">${pickSVG(s.state === "now")}<span class="rd-ic">${ic}</span></button></div>`;
    }).join("")}`).join("");
  const coming = road.coming.length ? `<div class="rd-coming"><svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg><span>Coming to the Road: ${esc(road.coming.join(", "))}</span></div>` : "";

  app.innerHTML = `
    <div class="rd-top">${statBar()}</div>
    ${leg ? `<section class="rd-banner" aria-label="The leg you're on">
      <div><small>LEG ${leg.n} · ${esc(v.name.toUpperCase())}</small><b>${esc(leg.name)}</b></div>
      <button class="rd-book" id="rd-book" aria-label="Open Rehearse: today's lesson">${icon("fretboard")}</button>
    </section>` : ""}
    ${chip ? `<div class="rd-chip">${chip}</div>` : ""}
    <div class="rd-path" id="rd-path">
      <div class="rd-say"><div class="rd-sayt"><p class="rd-bubble" id="rd-bubble">${esc(say.text)}</p>${song ? `<button class="rd-tonight" id="rd-tonight">${icon("play")}<span>Gig: ${esc(song.title)}</span></button>` : ""}</div>${louie(say.mood, { pose: say.pose, size: 112 })}</div>
      ${legsHTML}${coming}
    </div>
    <div class="rd-sbk">
      <button class="rd-sbk-go" id="rd-songbook" aria-label="Open the Songbook">
        <span class="rd-sbk-ic" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="M7 3v10a3.5 3.5 0 1 1-2-3.2V1l10 2v4L7 5z"/></svg></span>
        <span class="rd-sbk-t"><b>Songbook</b><small>${data.songs.length ? `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}${ps.of ? ` · ${ps.now} you can play` : ""}` : "Add your first song"}</small></span>
      </button>
      <button class="rd-sbk-q" id="rd-search" aria-label="Search, or paste a song">${icon("search")}</button>
    </div>`;
  const $ = id => document.getElementById(id);
  bindStatBar();
  homeHooks.refresh = null;
  if (wantDrawer) return go("#/library"); /* asked for the songs (4.9.0: the Songbook page, not a drawer) */
  $("rd-songbook").onclick = () => go("#/library");
  $("rd-book")?.addEventListener("click", () => go("#/practice"));
  $("rd-tonight")?.addEventListener("click", () => playGig(song.id, { from: "road" })); /* 4.1.0: tonight's song is a gig */
  $("rd-search").onclick = () => openSearch();

  /* a stop: tap it for its card (the current stop's is open already); Start opens the lesson or the song */
  const path = $("rd-path"), all = road.legs.flatMap(l => l.stops);
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
    const node = e.target.closest("[data-stop]");
    if (!node) return closePop(); /* a tap anywhere else closes the bubble */
    const s = all.find(x => x.id === node.dataset.stop), wrap = node.parentElement;
    const open = wrap.querySelector(".rd-pop");
    closePop();
    if (!open && s) { wrap.insertAdjacentHTML("beforeend", stopCard(s)); path.classList.add("has-pop"); haptic(1); revealPop(path, wrap.querySelector(".rd-pop")); }
  });
  /* the current stop sits a third of the way down the path */
  const curNode = cur && path.querySelector(`[data-stop="${CSS.escape(cur.id)}"]`);
  if (curNode) path.scrollTop = Math.max(0, curNode.parentElement.offsetTop - path.clientHeight / 3);
  if (plays) fillScene(st);
}


/* 4.45.2: a tapped stop's card can open below the visible path (under the tab bar); scroll the path so all of it shows, button included */
function revealPop(path, pop) {
  requestAnimationFrame(() => {
    const p = path.getBoundingClientRect(), r = pop.getBoundingClientRect();
    const tabs = document.getElementById("tabs"), floor = Math.min(p.bottom, tabs && tabs.offsetParent !== null ? tabs.getBoundingClientRect().top : p.bottom) - 14;
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
