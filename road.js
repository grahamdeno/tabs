// Tonight (#/): home. One clear next step, the streak, Louie, and the Tour Map.
//
//   header      Tonight, with the neck, Your playing, Tuner and Settings
//   streak      the week of lamps and the streak (tap: your changes this week)
//   Louie       one line that fits the moment (played today, evening with the
//               streak at risk, back after a few days, or just ready)
//   Tonight's run  one song, three lamps (Tune, Soundcheck, Play); Soundcheck is the next lesson on the neck
//               (#/practice), and the button follows the day: Start soundcheck, then Play
//   Tour Map    a small picture of your turf, the venue, plays to the next one
//   Library     a sheet along the bottom edge, under the search bar: tap it or
//               swipe it up and the Library slides up over Tonight (swipe down
//               there to come back)
//   dock        the same search bar and add button as the Library
// A library with no plays yet gets the first-run version: Louie waves and the
// first song is ready to play.
import { hexOutline, hexSpiral, lifetimePlays, pickNudge, playSongs, skillState, streakOf, territory, venueOf } from "./core.js";
import { app, esc, icon } from "./ui.js";
import { bindShelf, chipsHTML, chordNames, data, filter, go, homeHooks, keyOf, mmss, openSearch, openTuner, playSong, renderList, route, setFilter, setsShelf, songLength, tunedRecently, newSong } from "./app.js";
import { louie } from "./louie.js";
import { makeDrawer } from "./drawer.js";

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

/* Tonight never scrolls: a drag outside the Library drawer moves nothing. */
document.addEventListener("touchmove", e => {
  if (!document.body.classList.contains("is-home") || document.querySelector("#layer > *")) return;
  if (e.target instanceof Element && e.target.closest("#rd-drawer")) return;
  if (e.cancelable) e.preventDefault();
}, { passive: false });

/* the song for Up next: today's pick, else the last one played, else the first */
function upNext() {
  const n = pickNudge({ songs: data.songs, mood: "", gigToday: false });
  const byId = id => data.songs.find(s => s.id === id);
  return (n && byId(n.songId)) || [...data.songs].sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0))[0];
}

/* the lesson Tonight offers: the next one on the neck. Louie names the switch that trips you up in the song. */
function lessonFor(song) {
  const sk = skillState(data), next = sk.next;
  if (!next || next.kind === "check") return { sk, next: next || null, trip: null };
  const names = chordNames(song?.body || "");
  const switches = sk.levels.flatMap(l => l.steps).filter(x => x.kind === "switch" && x.state !== "done" && names.includes(x.a) && names.includes(x.b));
  return { sk, next, trip: switches[0] || null };
}

/* a small picture of the turf: the lit cells glow inside a piped outline */
function miniTurf(cells, ring) {
  const S = 9, R3 = Math.sqrt(3), all = hexSpiral(Math.max(1, 1 + 3 * (ring + 1) * (ring + 2)));
  const span = (ring + 2) * 1.6 * S + S, scale = 40 / span;
  const hex = ([q, r], k = 1) => "M" + [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (60 * i - 30); return `${(R3 * S * (q + r / 2) + S * k * Math.cos(a)).toFixed(1)} ${(1.5 * S * r + S * k * Math.sin(a)).toFixed(1)}`; }).join("L") + "Z";
  const lit = all.slice(0, cells), next = all.slice(cells);
  const outline = hexOutline(cells).map(([a, b]) => `M${(a[0] * S).toFixed(1)} ${(a[1] * S).toFixed(1)}L${(b[0] * S).toFixed(1)} ${(b[1] * S).toFixed(1)}`).join("");
  return `<svg class="rd-turf" viewBox="-42 -42 84 84" aria-hidden="true"><g transform="scale(${scale.toFixed(3)})">
    <path d="${next.map(c => hex(c, .86)).join("")}" fill="none" stroke="#b8935a" stroke-opacity=".45" stroke-width="1.2" stroke-dasharray="2 3"/>
    <path d="${lit.map(c => hex(c)).join("")}" fill="#ffb24a" fill-opacity=".22"/>
    <path d="${outline}" stroke="#ffc27a" stroke-width="2" stroke-linecap="round"/>
    ${lit.length ? `<circle cx="${(R3 * S * (lit.at(-1)[0] + lit.at(-1)[1] / 2)).toFixed(1)}" cy="${(1.5 * S * lit.at(-1)[1]).toFixed(1)}" r="3.4" fill="#ffb24a"/>` : ""}
  </g></svg>`;
}

/* what Louie says, and how he looks saying it */
function louieLine(st, plays) {
  const last = Math.max(0, ...playSongs(data).map(s => s.playLog?.last || 0));
  const away = last ? Math.floor((Date.now() - last) / DAY) : 0, hour = new Date().getHours();
  if (st.today) return { mood: "happy", pose: "thumb", text: st.days > 1 ? `Played today. Your ${st.days}-day streak is safe.` : "Played today. Come back tomorrow and start a streak." };
  if (away >= 3) return { mood: "sleepy", pose: "rest", text: "Missed you. An easy one to warm back up?" };
  if (hour >= 18 && st.days >= 1) return { mood: "worried", pose: "rest", text: `Evening. One song keeps your ${st.days}-day streak alive.` };
  return { mood: "happy", pose: "wave", text: plays ? "Ready when you are." : "" };
}

const tunerIcon = () => `${icon("fork")}${tunedRecently() ? "" : '<i class="dotmark"></i>'}`;

export function renderRoad() {
  screenHeight(); window.scrollTo(0, 0);
  const plays = lifetimePlays(data), st = streakOf(playSongs(data)), t = territory(plays), v = venueOf(plays);
  const song = upNext(), first = !plays;
  const les = song && !first ? lessonFor(song) : null;
  const say = louieLine(st, plays);
  if (les?.trip && !st.today && !les.sk.today && say.mood !== "sleepy") say.text = `${les.trip.a} to ${les.trip.b} is the switch to warm up for ${song.title}. Soundcheck first?`;
  const lamps = `<span class="t-dots" aria-hidden="true">${st.week.map((on, i) => `<i class="${on ? "on" : i === 6 ? "now" : ""}"></i>`).join("")}</span>`;
  const weekPlays = playSongs(data).reduce((n, s) => n + Object.entries(s.playLog?.days || {}).filter(([d]) => Date.parse(d) > Date.now() - 7 * DAY).reduce((a, [, c]) => a + c, 0), 0);
  const stat = st.days >= 2 ? `<b>${st.days}-day streak</b> · ${weekPlays} play${weekPlays === 1 ? "" : "s"} this week` : weekPlays ? `${weekPlays} play${weekPlays === 1 ? "" : "s"} this week` : "";
  const tunedNow = tunedRecently(), soundDone = les?.sk.today, checkNow = les?.next?.kind === "check";
  const card = song ? `<section class="pf-card rd-next" aria-label="${first ? "Your first song" : "Tonight's run"}">
      <h2>${first ? "Your first song" : `Tonight's run${les?.next && !soundDone ? " · about 6 min" : ""}`}</h2>
      <button class="rd-song" id="rd-song" data-id="${esc(song.id)}"><b>${esc(song.title)}</b><span class="k">${esc(keyOf(song) || "")}</span></button>
      <p class="rd-meta">${esc([song.artist, mmss(songLength(song)), chordNames(song.body || "").slice(0, 4).join(" ")].filter(Boolean).join(" · "))}</p>
      ${first ? "" : `<div class="rd-steps" role="group" aria-label="Tonight's run">
        <button id="rd-tune" class="${tunedNow ? "on" : ""}"><i class="gs-lamp ${tunedNow ? "on" : ""}"></i>Tune</button>
        ${les?.next ? `<button id="rd-sound" class="${soundDone ? "on" : tunedNow ? "cur" : ""}"><i class="gs-lamp ${soundDone ? "on" : tunedNow ? "warm" : ""}"></i>Soundcheck</button>` : ""}
        <button id="rd-play" class="${st.today ? "on" : soundDone || !les?.next ? "cur" : ""}"><i class="gs-lamp ${st.today ? "on" : soundDone || !les?.next ? "warm" : ""}"></i>Play</button>
      </div>`}
      ${!first && les?.next && !soundDone && !checkNow ? `<button class="btn primary rd-go" id="rd-go">${icon("fretboard")}Start soundcheck</button><button class="rd-skip" id="rd-skip">Skip to the song</button>`
        : !first && checkNow && !st.today ? `<button class="btn primary rd-go" id="rd-go">${icon("play")}Level check: play ${esc(song.title)} through</button>`
        : `<button class="btn primary rd-go" id="rd-go">${icon("play")}Play ${first ? "" : esc(song.title)}</button>${!first && les?.next && st.today ? '<button class="rd-skip" id="rd-more">Practice more</button>' : ""}`}
    </section>` : `<section class="pf-card rd-next"><h2>Your first song</h2><p class="pf-line">Add a song you know, or paste one, and it shows up here ready to play.</p></section>`;
  app.innerHTML = `
    <div class="head">
      <h1 class="title script">Tonight</h1>
      <div class="row-btns">
        <button class="ib glass" id="neckbtn" aria-label="The neck: practice lessons">${icon("fretboard")}</button>
        <button class="ib glass" id="youbtn" aria-label="Your playing">${icon("pick")}</button>
        <button class="ib glass" id="tunerbtn" aria-label="${tunedRecently() ? "Tuner" : "Tuner. Not tuned in the last few hours"}">${tunerIcon()}</button>
        <button class="ib glass" id="settings" aria-label="Settings">${icon("gear")}</button>
      </div>
    </div>
    ${first ? `<div class="rd-first">${louie("happy", { pose: "wave", size: 200 })}<p class="rd-first-t">Let's play your first song</p><p class="pf-line">The words scroll on their own. Play it through and your tour starts in the Garage.</p></div>`
      : `${stat ? `<div class="today"><button class="weekly t-stat" id="rd-stat">${st.days >= 2 ? lamps : ""}<span>${stat}</span>${icon("chev", "chev")}</button></div>` : ""}
    <div class="rd-say">${louie(say.mood, { pose: say.pose, size: 96 })}<p class="rd-bubble">${esc(say.text)}</p></div>`}
    ${card}
    ${first ? "" : `<button class="pf-card rd-map" id="rd-map">${miniTurf(t.cells, t.rings)}<span class="rd-map-t"><h2>Tour Map</h2><span class="pf-line" id="rd-map-line"><b>${esc(v.name)}.</b> ${v.toNext} play${v.toNext === 1 ? "" : "s"} to the ${esc(v.next)}.</span></span>${icon("chev", "chev")}</button>`}
    ${data.songs.length ? `<div class="rd-scrim" id="rd-scrim"></div>
    <section class="rd-drawer" id="rd-drawer" aria-label="Library">
      <div class="rd-sizer"></div>
      <button class="rd-dh" id="rd-dh" data-grab aria-label="Library, ${data.songs.length} song${data.songs.length === 1 ? "" : "s"}. Open or close"><i class="rd-grab" aria-hidden="true"></i><span class="rd-dt"><b>Library</b><span id="rd-count"></span></span></button>
      <div class="rd-dbody" id="rd-dbody"></div>
    </section>` : ""}
    <div class="dock-fade"></div>
    <div class="dock kb">
      <button class="cmd glass float rd-search" id="rd-search" aria-label="Search or paste a song">${icon("search")}<span>Search, or paste a song</span></button>
      <button class="add" id="add" aria-label="Add song"><svg class="add-note" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="add-silver" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset=".5" stop-color="#c9cacf"/><stop offset="1" stop-color="#9a9ba1"/></linearGradient></defs><g fill="url(#add-silver)" stroke="#6d6e74" stroke-width=".35"><path d="M8.2 6.4 19 4v12.3h-1.8V6.3L10 7.9v10.3H8.2z"/><ellipse cx="6.4" cy="18.1" rx="2.6" ry="2.1" transform="rotate(-20 6.4 18.1)"/><ellipse cx="15.6" cy="16.2" rx="2.6" ry="2.1" transform="rotate(-20 15.6 16.2)"/></g></svg><i class="add-bdg" aria-hidden="true">+</i></button>
    </div>`;
  const $ = id => document.getElementById(id);
  if ($("rd-drawer")) {
    const body = $("rd-dbody");
    const fill = () => {
      body.innerHTML = `${chipsHTML()}${filter === "all" ? setsShelf() : ""}<div id="list"></div>`;
      body.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { setFilter(b.dataset.f); fill(); });
      bindShelf();
      renderList();
      $("rd-count").textContent = `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}`;
    };
    homeHooks.refresh = fill; fill();
    makeDrawer({ root: $("rd-drawer"), head: $("rd-dh"), body, sizer: $("rd-drawer").querySelector(".rd-sizer"), scrim: $("rd-scrim") });
  }
  $("neckbtn").onclick = () => go("#/practice");
  $("youbtn").onclick = () => go("#/you");
  $("settings").onclick = () => go("#/settings");
  $("tunerbtn").onclick = () => openTuner("standard", () => route().name === "road" && renderRoad());
  $("rd-tune")?.addEventListener("click", () => $("tunerbtn").click());
  $("rd-stat")?.addEventListener("click", () => go("#/you"));
  $("rd-map")?.addEventListener("click", () => go("#/playmap"));
  $("rd-song")?.addEventListener("click", e => go("#/song/" + encodeURIComponent(e.currentTarget.dataset.id)));
  const play = () => song && playSong(song.id);
  const lesson = () => les?.next && les.next.kind !== "check" ? go("#/practice/" + encodeURIComponent((les.trip || les.next).id)) : go("#/practice");
  $("rd-go")?.addEventListener("click", !first && les?.next && !soundDone && !checkNow ? lesson : play);
  $("rd-skip")?.addEventListener("click", play);
  $("rd-more")?.addEventListener("click", () => go("#/practice"));
  $("rd-sound")?.addEventListener("click", lesson);
  $("rd-play")?.addEventListener("click", play);
  $("rd-search").onclick = () => openSearch();
  $("add").onclick = () => newSong();
  if (!first) fillScene(st);
}

/* The scene loads a moment later: your place in it, and who is pushing on your edge. */
async function fillScene(st) {
  let sc;
  try { const m = await import("./scene.js"); sc = await m.sceneFor((await import("./playmap.js")).getSpot()); } catch { return; }
  if (route().name !== "road") return;
  const line = document.getElementById("rd-map-line");
  if (line) line.innerHTML = `<b>${esc(sc.venue.name)}.</b> #${sc.rank} of ${sc.players} in your scene · ${sc.venue.toNext} play${sc.venue.toNext === 1 ? "" : "s"} to the ${esc(sc.venue.next)}.`;
  if (sc.below > 0 && !st.today) {
    const say = document.querySelector(".rd-bubble");
    if (say) say.textContent = `${sc.pusher ? sc.pusher.name : "The local scene"} is pushing on your edge (${sc.below} of 7 days). About ${Math.ceil(sc.pressure.bar)} minutes a day holds it.`;
  }
}
