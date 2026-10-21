// The Road (#/): home, since 4.0.0. The neck's ladder laid out as a path you travel, stop by stop.
//
//   stat bar    your venue, gig streak and fans (hud.js)
//   leg banner  the leg you're on and the venue you've reached; the book opens the neck
//   songs chip  how many of your songs you can play, and how many the next chord opens
//   the path    every stop of every leg: lessons, merch boxes and the headline show at the end
//               (a level check: play a real song through). Done stops are lit, the current stop
//               is ringed with its card open (Start), later ones are locked. Tap any stop for its card.
//   Louie       beside the path, with one line that fits the moment and tonight's song to play
//   Songbook    a bar along the bottom (4.9.0): the Songbook page, and search, a tap away
//   tab bar     Road, Tour, Charts, Band, Rehearse, More (hud.js)
// The screen itself never scrolls; the path scrolls inside it.
import { lifetimePlays, pickNudge, playSongs, playableSongs, roadPath, skillState, streakOf, venueOf, FANS } from "./core.js";
import { app, esc, icon, toast } from "./ui.js";
import { chordNames, data, go, homeHooks, openSearch, playGig, route } from "./app.js";
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
  lock: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg>`
};
const ZIG = [0, 46, 72, 46, 0, -46, -72, -46];

function stopCard(stop) {
  const song = stop.song && data.songs.find(s => s.id === stop.song);
  const title = stop.kind === "headline" ? "Headline show" : stop.kind === "box" ? "Merch box" : stop.kind === "chord" ? `The ${stop.name} chord` : stop.name;
  const line = stop.kind === "chord" ? "Ring every string clean, one at a time."
    : stop.kind === "switch" ? "Land the change on the beat."
    : stop.kind === "scale" ? "Up and back down, one note at a time."
    : stop.kind === "box" ? (stop.state === "done" ? `Opened: +${FANS.box} fans.` : `Opens when you reach it: +${FANS.box} fans.`)
    : song ? `Play ${song.title} through, start to finish.` : "Play a song that uses only these chords, start to finish.";
  const go1 = stop.state === "locked" ? "" : stop.kind === "box" ? ""
    : stop.kind === "headline" ? `<button class="btn primary rd-start" data-go="${esc(stop.id)}">${song ? `PLAY +${FANS.play} FANS` : "FIND A SONG"}</button>`
    : `<button class="btn primary rd-start" data-go="${esc(stop.id)}">${stop.state === "done" ? "PRACTICE AGAIN" : `START +${FANS.lesson} FANS`}</button>`;
  return `<div class="rd-pop ${stop.state}" role="dialog" aria-label="${esc(title)}"><b>${esc(title)}</b><p>${esc(stop.state === "locked" && stop.kind !== "box" ? "Finish the stops before this one to open it." : line)}</p>${go1}</div>`;
}

export function renderRoad() {
  screenHeight(); window.scrollTo(0, 0);
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
      const ic = s.state === "locked" && s.kind !== "box" ? ICONS.lock : ICONS[s.kind] || ICONS.chord;
      const label = `${s.kind === "headline" ? "Headline show" : s.kind === "box" ? "Merch box" : s.name}, ${s.state === "now" ? "your next stop" : s.state === "done" ? "done" : s.state === "open" ? "open" : "locked"}`;
      return `<div class="rd-stop" style="--x:${x}px"><button class="rd-node ${s.kind} ${s.state}${big ? " big" : ""}" data-stop="${esc(s.id)}" aria-label="${esc(label)}">${ic}</button>${s === cur ? stopCard(s) : ""}</div>`;
    }).join("")}`).join("");
  const coming = road.coming.length ? `<div class="rd-coming"><svg viewBox="0 0 32 32" aria-hidden="true"><rect class="rd-lk" x="8" y="14" width="16" height="13" rx="4"/><path class="rd-lks" d="M11 14v-3a5 5 0 0 1 10 0v3" fill="none" stroke-width="3.4"/></svg><span>Coming to the Road: ${esc(road.coming.join(", "))}</span></div>` : "";

  app.innerHTML = `
    <div class="rd-top">${statBar()}</div>
    ${leg ? `<section class="rd-banner" aria-label="The leg you're on">
      <div><small>LEG ${leg.n} · ${esc(v.name.toUpperCase())}</small><b>${esc(leg.name)}</b></div>
      <button class="rd-book" id="rd-book" aria-label="Open the neck: every lesson">${icon("fretboard")}</button>
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
  $("rd-book")?.addEventListener("click", () => go("#/practice/neck"));
  $("rd-tonight")?.addEventListener("click", () => playGig(song.id, { from: "road" })); /* 4.1.0: tonight's song is a gig */
  $("rd-search").onclick = () => openSearch();

  /* a stop: tap it for its card (the current stop's is open already); Start opens the lesson or the song */
  const path = $("rd-path"), all = road.legs.flatMap(l => l.stops);
  const start = id => {
    const s = all.find(x => x.id === id);
    if (!s) return;
    if (s.kind === "headline") return s.song ? playGig(s.song, { from: "road" }) : (toast("Add a song that uses only these chords, then play it through"), go("#/practice/neck"));
    go("#/practice/" + encodeURIComponent(s.id));
  };
  path.addEventListener("click", e => {
    const goBtn = e.target.closest("[data-go]");
    if (goBtn) return start(goBtn.dataset.go);
    const node = e.target.closest("[data-stop]");
    if (!node) return;
    const s = all.find(x => x.id === node.dataset.stop), wrap = node.parentElement;
    const open = wrap.querySelector(".rd-pop");
    path.querySelectorAll(".rd-pop").forEach(p => p.remove());
    if (!open && s) { wrap.insertAdjacentHTML("beforeend", stopCard(s)); wrap.querySelector(".rd-pop").scrollIntoView?.({ block: "nearest", behavior: "smooth" }); }
  });
  /* the current stop sits a third of the way down the path */
  const curNode = cur && path.querySelector(`[data-stop="${CSS.escape(cur.id)}"]`);
  if (curNode) path.scrollTop = Math.max(0, curNode.parentElement.offsetTop - path.clientHeight / 3);
  if (plays) fillScene(st);
}


/* The scene loads a moment later: when someone is pushing on your edge, Louie says so. */
async function fillScene(st) {
  let sc;
  try { const m = await import("./scene.js"); sc = await m.sceneFor((await import("./playmap.js")).getSpot()); } catch { return; }
  if (route().name !== "road") return;
  if (sc.below > 0 && !st.today) {
    const say = document.getElementById("rd-bubble");
    if (say) say.textContent = `${sc.pusher ? sc.pusher.name : "The local scene"} is pushing on your edge (${sc.below} of 7 days). About ${Math.ceil(sc.pressure.bar)} minutes a day holds it.`;
  }
}
