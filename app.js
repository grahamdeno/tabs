// Tabs app: screens and interaction. core.js holds the logic that has unit tests.
import { MAX_LENGTH, wordTimes, practicing, practiceRate, keyGap, journalPractice, addSync, mergeSyncs, syncSeconds, syncWhere, playCredited, playSongs, soundOffset, germanBlocks, sungText, deSource, DE_LEVELS, Tabs, SPEEDS, playsThisWeek, playCount, sortSongs, TUNINGS, detectTuning, parseBlocks, wrapTab, guessKey, transposeKey, prefersFlats, detectPaste, chordShape, appleTrackId, VERSION, restyle, firstLyric, bodyCapo, journalTime, journalGot, streakMoment, knownChords, gelOf, questsSettle, bandMeet, merchWorn, bandParts } from "./core.js";
import { openDial } from "./dial.js";
import { setupFold, teardownFold } from "./fold.js";
import { $, app, esc, icon, layer, leaveHooks, oneHandMQ, onLeave, onScroll, toast, sound } from "./ui.js";
import { addToSet, coverCache, coverDel, coverLoadAll, nextLine, nextUp, renderSet, setCtx, setRun, setSongs, setSetCtx } from "./sets.js";
import { copyDiagnostics, loadLibrary, noteError } from "./store.js";
import { chordTapped, coach, coachTip, demoLine, demoMap, demoNN, demoPause, demoTap, markSeen, markUsed, renderGestures, songCoach, takeDemo, tick, tipDue, tipsSeen, used } from "./coach.js";
import { duetSheet, moreBtn, renderImport, shareSet, shareSong } from "./share.js";
import { appleSearchURL, hasMusic, onFeel, recordingSheet, timeLines, listenSheet, musicClock, openLink, pauseMusic, prepareMusic, rateWorks, recordingLength, seekMusic, setMusicRate, startMusic } from "./listen.js";
import { STATUS, bindShelf, chipsHTML, filter, homeHooks, leaveSearch, query, refreshLibrary, renderLibrary, renderList, searching, setFilter, setsShelf, showPasteCard, todayKey } from "./library.js";
import { AI, BPM_STORE, aiError, aiKey, aiLastStop, askClaude, bpmKey, busy, cleanSheet, parseJSON, readPhoto } from "./aihelp.js";
import { bassOn, bassPreview, beatTrack, clickAt, drum, drumJobs, drumsFor, grooveFor, metro, metroDrums, metroOn, metroPace, metroPreview, recLength, riffPreview, startMetronome, stopMetronome, tempoFor } from "./audio.js";


// ---------- State ----------
let data = await loadLibrary(); /* see store.js */
/* Replacing the whole library (a restored backup or the safety copy) goes through here. */
const setData = d => { data = d; };
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Tabs.flush(); });
window.addEventListener("pagehide", () => Tabs.flush());

// The phone's own text size (iPhone: Settings > Display & Brightness > Text Size)
// scales the lyrics, so a larger system size means larger songs too.
let sysText = 1;
function readSysText() {
  if (!window.CSS?.supports?.("font", "-apple-system-body")) return 1;
  const el = document.createElement("span");
  el.style.cssText = "font: -apple-system-body; position: absolute; visibility: hidden";
  document.body.appendChild(el);
  const px = parseFloat(getComputedStyle(el).fontSize) || 17;
  el.remove();
  return Math.min(1.6, Math.max(0.85, px / 17));
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const t = readSysText();
  if (t !== sysText) { sysText = t; if (route().name === "song") redraw?.(); }
});
// Theme: Automatic (the default) follows the phone's light or dark appearance.
const phoneLight = () => !!window.matchMedia?.("(prefers-color-scheme: light)").matches;
window.matchMedia?.("(prefers-color-scheme: light)").addEventListener?.("change", () => { if (data.settings.theme !== "dark" && data.settings.theme !== "light") applyTheme(); });
function applyTheme() {
  sysText = readSysText();
  const t = data.settings.theme;
  const green = t === "green", light = green || t === "light" || (t !== "dark" && phoneLight());
  document.documentElement.dataset.theme = light ? "light" : "dark";
  /* 4.0.0: Light is Festival Poster, Dark is Neon Midnight, Green is Green Room (a light look) */
  document.documentElement.dataset.look = green ? "green" : light ? "festival" : "neon";
  /* 4.14.0: the finish Louie wears, bought at the Merch table */
  const wear = merchWorn(data);
  if (wear === "stock") delete document.body.dataset.wear; else document.body.dataset.wear = wear;
  document.querySelector('meta[name="theme-color"]').content = green ? "#e6efe7" : light ? "#eaf3ff" : "#1d1640";
}


const go = h => { location.hash = h; };
/* From Tonight: open a song and start it playing; open the Library with search ready. */
let playNext = null, searchNext = false, lastHome = "library"; /* where a song's Back goes: Tonight or the Library */
const playSong = id => { playNext = id; go("#/song/" + encodeURIComponent(id)); };
/* The Gig (4.1.0): open the song and play it as a scored show. gigHooks are set by gig.js while a show is on. */
const gigHooks = { on: false, credited: null, stopped: null, resume: null, leave: null, band: null };
/* Play opens the Gig (4.2.0). How much game you see is Lines in a gig: 4, 5, 6 or Full (4.4.0: the whole
   sheet under a thin strip). Practicing a section or slower, a tab and Play together play the plain sheet.
   plainPlay (tests only, never set by the app) keeps Play plain. */
const canGig = song => song.format !== "tab" && !(practicing(song) && (song.loop || practiceRate(song) < 1)) && !scroll.duet && data.settings.plainPlay !== true;
const gigsOn = song => canGig(song);
/* 4.20.0: the face says what plays with you: the recording or the band (nothing when neither will) */
const playWith = song => !song ? "" : usesMusic(song) ? "ALONG WITH THE RECORDING" : (data.settings.metronome || data.settings.bass || bandParts(data).drums || bandParts(data).bass) ? "WITH THE BAND" : "";
const playFace = (on, song) => `${icon(on ? "pause" : "play")}<span>${on ? "PAUSE" : "PLAY"}${!on && playWith(song) ? `<small class="pw-with">${playWith(song)}</small>` : ""}</span>`;
const playLabel = (song, on) => on ? "Pause auto-scroll" : gigsOn(song) ? "Play as a gig" : "Start auto-scroll";
/* Play's label, after Practice changes */
function refreshPlay(song) {
  const pb = $("play");
  if (!pb || viewing !== song || scroll.on) return;
  pb.setAttribute("aria-label", playLabel(song, false));
  pb.innerHTML = playFace(false, song);
}
/* Your band (4.7.0): a play that brings in a new friend says so */
function bandToast() {
  const fresh = bandMeet(data);
  if (!fresh.length) return;
  Tabs.save(data);
  const names = fresh.map(f => FRIEND_NAMES[f.id] || f.id);
  setTimeout(() => toast(`${names.join(" and ")} joined your band!`, null, { label: "Meet", fn: () => go("#/band") }), 2500);
}
const FRIEND_NAMES = { lola: "Lola", tilly: "Tilly", beat: "Beat", metro: "Metro", bex: "Bex", jax: "Jax", milo: "Milo", pip: "Pip", key: "Key", strap: "Strap", slide: "Slide", shaker: "Shaker", pickup: "Pickup", humb: "Humb", reverb: "Reverb", triangle: "Triangle", whammy: "Whammy", looper: "Looper" };
/* Tour quests (4.5.0): a play that finishes a goal says so */
function questToast() {
  const got = questsSettle(data);
  if (!got.length) return;
  Tabs.save(data);
  toast(got.map(x => `${x.label}: +${x.fans} fans`).join(" · "));
}
let songSpeed = null; /* the song page's speed dial, for the Tools sheet */
let gigNext = null;
const playGig = (id, opts = {}) => { gigNext = { id, ...opts }; if (route().name === "song" && route().id === id) return openGigNow(); go("#/song/" + encodeURIComponent(id)); };
function openGigNow() { const g = gigNext; gigNext = null; if (g && viewing?.id === g.id) lazy("gig.js").then(m => { if (viewing?.id === g.id && route().name === "song" && $("sheet")) m.openGig(viewing, g); }); }
const openSearch = () => { searchNext = true; go("#/library"); };
/* The Neck's Learning list opens a song on the section you last practiced (3.24.2). */
let sectionNext = null;
const openAtSection = id => { sectionNext = id; go("#/song/" + encodeURIComponent(id)); };
const route = () => {
  const [, name = "", id = ""] = location.hash.split("/");
  return { name: name || "road", id: decodeURIComponent(id) };
};
const keyOf = s => s.format === "tab" ? "TAB" : (s.key || guessKey(s.body || ""));


// ---------- Song view ----------
let scroll = { on: false, raf: 0, last: 0, carry: 0, lock: null };

function renderViewer(id) {
  const song = data.songs.find(s => s.id === id);
  if (!song) return go("#/");
  const isChords = song.format !== "tab";
  prepareMusic(song);
  onFeel(s2 => { if (s2 === song) paintListenChip(song); });
  /* once the sheet is drawn: time its lines from the lyrics (3.17.0) */
  setTimeout(() => { if (viewing === song) timeLines(song, lyricLines); }, 700);
  if (song.transpose === undefined) song.transpose = data.settings.transpose || 0;
  if (song.speed === undefined) song.speed = data.settings.startSpeed || SPEEDS.medium; // then each song keeps its own
  if (song.size === undefined) song.size = 1;
  song.opened = Date.now();
  Tabs.save(data);

  app.classList.add("viewer");
  /* Back goes where the song was opened from: its set, when played from one. */
  const fromSet = (() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); return x && setSongs(x)[setCtx.idx]?.id === song.id ? x : null; })();
  const back = fromSet ? { to: "#/set/" + encodeURIComponent(fromSet.id), label: `Back to ${fromSet.name}` } : lastHome === "road" ? { to: "#/", label: "Back to the Road" } : { to: "#/library", label: "Back to the Songbook" };
  diag.armed = false; diag.rowKey = null; diag.pinned = null; diag.scrolling = false; diag.block = null;
  /* One song screen (4.2.0): the song at the top (back, title, favorite), its chips, the song map,
     the chords, the sheet, and at the bottom Tools and Play. Play opens the Gig. */
  app.innerHTML = `
    <div class="head ehead"></div>
    <div class="shead">
      <button class="sh-btn sh-back" data-go="${back.to}" aria-label="${esc(back.label)}">${icon("back")}</button>
      <div class="sh-t"><h1 class="song-title" style="view-transition-name: song-title">${esc(song.title)}</h1><div class="meta" id="meta"></div></div>
      <button class="sh-btn fav ${song.favorite ? "on" : ""}" aria-label="Favorite" aria-pressed="${!!song.favorite}">${icon("heart")}</button>
    </div>
    ${(() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); const list = x ? setSongs(x) : [];
      if (!x || list[setCtx.idx]?.id !== song.id) { setSetCtx(null); return ""; }
      return `<div class="setbar"><button class="sb" id="sprev" aria-label="Previous song" ${setCtx.idx === 0 ? "disabled" : ""}>${icon("back")}</button>
        <button class="setname" data-go="#/set/${encodeURIComponent(x.id)}">${esc(x.name)} · ${setCtx.idx + 1} of ${list.length}</button>
        <button class="sb" id="snext" aria-label="Next song" ${setCtx.idx === list.length - 1 ? "disabled" : ""}>${icon("chev")}</button></div>`; })()}
    <div class="metarow"><span class="keyslot" id="keyslot"></span><button class="stat" id="stat" aria-label="Learning status"></button>${songTuning(song) !== "standard" ? `<button class="stat tunechip" id="tunechip" aria-label="Tuning: ${TUNINGS[songTuning(song)].name}. Open the tuner">${icon("fork")}${TUNINGS[songTuning(song)].name}</button>` : ""}</div>
    ${song.sketch?.lines?.length ? `<div class="skrow" id="skrow"><button class="stat sk-hear" id="sk-hear" hidden>${icon("play")}<span>Your recording</span></button>
      <div class="seg mini sk-style" role="group" aria-label="Chord style">${["simple", "rich"].map(st => `<button data-st="${st}" class="${(song.sketch.style || "simple") === st ? "on" : ""}" aria-pressed="${(song.sketch.style || "simple") === st}">${st === "simple" ? "Simple" : "Rich"}</button>`).join("")}</div></div>` : ""}
    <nav class="secbar" id="secbar" aria-label="Song sections"></nav>
    <div id="strip"></div>
    <header class="chead" id="chead" aria-hidden="true">
      <div class="in">
        <button class="ib glass" data-go="${back.to}" aria-label="${esc(back.label)}" tabindex="-1">${icon("back")}</button>
        <button class="ctitle" id="ctitle" aria-label="Back to top of song" tabindex="-1">
          <div class="ct">${esc(song.title)}</div>
          <div class="cs" id="csub"></div>
        </button>
        <button class="ib glass fav ${song.favorite ? "on" : ""}" aria-label="Favorite" aria-pressed="${!!song.favorite}" tabindex="-1">${icon("heart")}</button>
        <button class="ib glass more" aria-label="More for this song" aria-haspopup="menu" tabindex="-1">${icon("dots")}</button>
      </div>
    </header>
    <div class="sheet" id="sheet"></div>
    <aside class="rail" id="rail" aria-label="Chords"></aside>
    <nav class="side" id="side" aria-label="Songs"></nav>
    <div class="dock-fade"></div>
    <div class="dock">
      <div class="pw glass float">
      <div class="nn" id="nn"></div>
      <div class="looprow" id="looprow"></div>
      <div class="player">
        <button class="tl more" id="more" aria-label="Tools" aria-haspopup="menu">${icon("dots")}${menuHasNew() ? '<i class="newdot"></i>' : ""}</button>
        ${listenChip(song)}
        ${(() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); const list = x ? setSongs(x) : [];
          return x && list[setCtx.idx]?.id === song.id ? `<button class="tl dialbtn setdial" id="setdial" aria-label="${esc(x.name)}, song ${setCtx.idx + 1} of ${list.length}. Hold and sweep to pick a song">${icon("listplus")}<span>${setCtx.idx + 1} of ${list.length}</span></button>` : ""; })()}
        <div class="speed" hidden>
          ${byLength()
            ? `<input type="range" id="speed" min="${540 - MAX_LENGTH}" max="480" step="1" value="${540 - songLength(song)}" aria-label="Song length">`
            : `<input type="range" id="speed" min="4.5" max="99" step="4.5" value="${song.speed}" aria-label="Scroll speed for this song">`}
          <span id="sv"></span>
        </div>
        <button class="play" id="play" aria-label="${playLabel(song, false)}">${playFace(false, song)}</button>
      </div>
      </div>
    </div>`;
  placeWide(); paintSide(song);
  bindSketchRow(song);
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  app.querySelectorAll(".fav").forEach(b => b.onclick = () => {
    Tabs.toggleFavorite(data, song.id);
    app.querySelectorAll(".fav").forEach(x => {
      x.classList.toggle("on", !!song.favorite);
      x.setAttribute("aria-pressed", !!song.favorite);
    });
  });
  // One menu for everything about this song: text size, sets, edit, AI help, share, practice.
  app.querySelectorAll(".more").forEach(btn => btn.onclick = e => { e.stopPropagation(); songMenu(song, btn, draw); });
  // Learning status: tap to cycle none → Learning → Got it.
  const paintStat = () => {
    const st = $("stat");
    const wk = playsThisWeek(song);
    st.className = "stat " + (song.status || "none");
    st.innerHTML = (STATUS[song.status] || "Mark as learning") + (wk ? `<span class="pl">· ${wk}× this week</span>` : "");
  };
  paintStat();
  $("tunechip")?.addEventListener("click", () => openTuner(songTuning(song)));
  $("listen").onclick = () => hasMusic(song) ? openRecording(song) : listenSheet(song);
  $("stat").onclick = () => {
    song.status = !song.status ? "learning" : song.status === "learning" ? "got" : undefined;
    if (!song.status) delete song.status;
    if (song.status === "got") journalGot(data, song);
    Tabs.save(data); paintStat(); paintLoop(song);
    toast(song.status === "learning" ? "Learning" : song.status === "got" ? "Got it" : "Status cleared", $("stat"));
  };
  curPaintStat = paintStat;
  const step2 = d => { const x = data.sets.find(z => z.id === setCtx.id), list = setSongs(x), n = list[setCtx.idx + d]; if (!n) return; setSetCtx({ id: x.id, idx: setCtx.idx + d }); go("#/song/" + encodeURIComponent(n.id)); };
  $("sprev")?.addEventListener("click", () => step2(-1));
  $("snext")?.addEventListener("click", () => step2(1));
  $("ctitle").onclick = () => {
    hold.active = true; releaseSoon(900); // let the jump finish before auto-scroll resumes
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const draw = () => {
    const steps = song.transpose || 0;
    const easy = isChords && song.easier?.on ? song.easier : null;
    const capo = easy ? easy.capo || 0 : 0;
    const baseKey = isChords ? (song.key || guessKey(song.body || "")) : "";
    const key = transposeKey(baseKey, steps); // the key it sounds in
    const capoTxt = capo ? `Capo <b>${capo}</b>` : "";
    const best = data.gig?.best?.[song.id];
    $("meta").innerHTML = [
      song.artist && `<span>${esc(song.artist)}</span>`,
      best != null && `<span>Best show ${best}%</span>`,
      capoTxt && `<span>${capoTxt}</span>`,
      !isChords && `<span>Tab</span>`
    ].filter(Boolean).join('<span class="dot"></span>');
    $("keyslot").innerHTML = key ? `<button class="keybtn" id="keybtn" aria-label="Key ${esc(key)}. Change the key"><span>Key <b>${esc(key)}</b></span>${icon("chev", "kchev")}</button>` : "";
    $("csub").innerHTML = [song.artist && esc(song.artist), key && `Key <b>${esc(key)}</b>`, capoTxt, !isChords && "Tab"]
      .filter(Boolean).join(" · ");
    SUBS = easy ? easy.subs || {} : {};
    const sheet = $("sheet");
    sheet.style.setProperty("--tab-size", (14 * song.size).toFixed(1) + "px");
    sheet.style.setProperty("--lyric-size", (17 * song.size * sysText).toFixed(1) + "px");
    // With a capo the shapes sit lower than the sound: shift the chords down by the capo.
    // A chart's own capo, taken off: the shapes go up to the key it sounds in.
    const off = isChords && song.capoOff ? bodyCapo(song.body) : 0;
    const body = off ? (song.body || "").replace(/\[?capo\s*(\d{1,2})\]?/i, "No capo (Capo $1 taken off)") : song.body || "";
    let blocks = parseBlocks(body, isChords ? steps - capo + off : 0, isChords && prefersFlats(baseKey, steps - capo));
    /* German practice: only while the translation matches the words on screen. */
    const lvl = song.deLevel || 0, fresh = song.de && song.de.src === deSource(sungText(blocks));
    if (lvl && fresh) blocks = germanBlocks(blocks, song.de, lvl, { english: data.settings.deEnglish === true });
    paintDeChip(song, fresh, lvl);
    renderBlocks(sheet, blocks);
    renderStrip(sheet, isChords, song);
    layoutDiagrams(sheet, isChords);
    paintSecbar();
  };
  draw();
  redraw = () => { draw(); paintLoop(song); buildMap(); };
  viewing = song;
  paintLoop(song);
  setTimeout(buildMap, 50);
  if (setCtx?.autoplay) { setCtx.autoplay = false; setTimeout(() => { if (viewing === song && !scroll.on) startScroll(song); }, 400); }
  else setTimeout(() => songCoach(song), 600);

  const speed = $("speed");
  // Song length style: the slider sets how long the song takes (right = shorter = faster).
  const showSpeed = () => {
    if (byLength()) {
      speed.style.setProperty("--fill", ((speed.value - 60) / 420 * 100) + "%");
      $("sv").textContent = mmss(songLength(song)); /* exact, though the slider moves in 5 s steps */
    } else {
      speed.style.setProperty("--fill", ((speed.value - 4.5) / 94.5 * 100) + "%");
      $("sv").textContent = (speed.value / SPEEDS.medium).toFixed(1) + "x";
    }
    const db = $("dialbtn")?.querySelector("span");
    if (db) db.textContent = $("sv").textContent;
  };
  showSpeed();
  speed.oninput = () => {
    if (byLength()) { song.duration = 540 - speed.value; song.durationSet = true; } else song.speed = +speed.value;
    showSpeed(); Tabs.save(data);
  };
  /* One hand: the speed is a dial in the corner (dial.js). Hold the time in
     the bar and sweep; a tap opens it to sweep anywhere. Arrow keys step it. */
  /* A change can be undone right away (in case a thumb moved it by mistake). */
  /* The length is kept to the second (a recording's own length, 3.13.1); a thumb moves it 5 s at a time. */
  const dialStep = () => byLength() ? 5 : +speed.step;
  const speedDial = e => { const was = { v: speed.value, d: song.duration, set: song.durationSet, sp: song.speed };
    openDial({ min: +speed.min, max: +speed.max, step: dialStep(), value: +speed.value, label: "Song speed", event: e,
      marks: byLength() ? [2, 3, 4, 5, 6, 8, 10, 15].map(m => 540 - m * 60) : null,
      read: v => byLength() ? { big: mmss(540 - v), small: "SONG LENGTH" } : { big: (v / SPEEDS.medium).toFixed(1) + "x", small: "SPEED" },
      input: v => { speed.value = v; speed.oninput(); },
      done: (v, changed) => { if (changed) toast(byLength() ? `Length ${mmss(songLength(song))}` : `Speed ${$("sv").textContent}`, null, { label: "Undo", fn: () => {
        speed.value = was.v; song.duration = was.d; song.durationSet = was.set; song.speed = was.sp;
        if (was.d === undefined) delete song.duration; if (was.set === undefined) delete song.durationSet;
        Tabs.save(data); refreshSpeed(); toast(byLength() ? `Length back to ${mmss(songLength(song))}` : "Speed restored"); } }); } }); };
  const dialBtn = $("dialbtn");
  if (dialBtn) {
    dialBtn.addEventListener("pointerdown", e => { e.preventDefault(); speedDial(e); });
    dialBtn.addEventListener("click", e => { if (e.detail === 0) speedDial(null); });
    dialBtn.addEventListener("keydown", e => {
      const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      speed.value = Math.min(+speed.max, Math.max(+speed.min, +speed.value + d * dialStep())); speed.oninput();
    });
  }
  /* In a set: hold "4 of 9" and sweep through the set's songs; let go to open one. */
  const setDial = e => {
    const x = data.sets.find(z => z.id === setCtx?.id);
    if (!x) return;
    const list = setSongs(x), here = setCtx.idx;
    const short = t => t.length > 20 ? t.slice(0, 19) + "…" : t;
    openDial({ labels: list.map(z => z.title), value: here, label: `Songs in ${x.name}`, event: e, cls: "set",
      read: i => ({ big: short(list[i].title), small: `${i + 1} of ${list.length}${keyOf(list[i]) ? ` · Key ${keyOf(list[i])}` : ""} · ${mmss(songLength(list[i]))}` }),
      done: i => { if (i !== here) { setSetCtx({ id: x.id, idx: i }); go("#/song/" + encodeURIComponent(list[i].id)); } } });
  };
  $("setdial")?.addEventListener("pointerdown", e => { e.preventDefault(); setDial(e); });
  $("setdial")?.addEventListener("click", e => { if (e.detail === 0) setDial(null); });
  /* German practice (4.20.0: from Tools only): the sheet, with the levels once the song is translated, else a way to translate it. */
  songDeOpen = () => germanSheet(song, () => draw());
  /* One hand (3.19.0): the bar is out while paused and folds into Play's corner while playing (fold.js). */
  /* Folded, Play keeps one partner: in a set the next song, otherwise the Library. */
  const foldNav = () => {
    const x = fromSet, list = x ? setSongs(x) : [], nx = x && list[setCtx?.idx + 1];
    if (nx) return { html: `<span class="fn-t">${esc(nx.title)}</span><small>${setCtx.idx + 2} of ${list.length}</small>${icon("chev")}`, label: `Next song: ${nx.title}`, run: () => { stopScroll(); $("snext")?.click(); } };
    return { html: `${icon("back")}<span class="fn-t">Songbook</span>`, label: "Back to the Songbook", run: () => { stopScroll(); go("#/library"); } };
  };
  foldApi = setupFold({ back: { label: back.label, run: () => go(back.to) }, playing: () => scroll.on, nav: foldNav });
  refreshSpeed = () => { if (viewing !== song || !speed.isConnected) return; if (byLength()) speed.value = 540 - songLength(song); showSpeed(); };
  /* A linked Apple Music song without its recording length yet: look it up once. */
  if (song.listen && song.listen.length === undefined && appleTrackId(song.listen.url)) recordingLength(song, song.listen.url, { quiet: true });

  /* Key (3.20.0): tap "Key A" under the title for a dial of the keys around the song's own. */
  const keyDial = () => {
    const base = song.key || guessKey(song.body || ""), steps = Array.from({ length: 12 }, (_, i) => i - 5), was = song.transpose || 0;
    openDial({ labels: steps.map(n => base ? transposeKey(base, n) : `${n > 0 ? "+" : ""}${n}`), value: (song.transpose || 0) + 5, label: "Key", cls: "key",
      tick: i => base ? transposeKey(base, steps[i]) : String(steps[i]),
      read: i => ({ big: steps[i] ? `${steps[i] > 0 ? "+" : ""}${steps[i]}` : "0", small: base ? `KEY ${transposeKey(base, steps[i])}` : "TRANSPOSE" }),
      input: i => { song.transpose = steps[i]; Tabs.save(data); draw(); },
      done: (i, changed) => { if (changed) toast(`Key ${base ? transposeKey(base, steps[i]) : steps[i]}`, null, { label: "Undo", fn: () => { song.transpose = was; Tabs.save(data); draw(); } }); } });
  };
  $("keyslot").addEventListener("click", e => { if (e.target.closest("#keybtn")) keyDial(); });
  /* Play: the Gig, or plain auto-scroll while practicing, for a tab, or with Play as a gig off (Settings > Playing). */
  $("play").onclick = () => {
    if (scroll.on) return stopScroll();
    if (gigHooks.resume) return gigHooks.resume();
    if (gigsOn(song)) return playGig(song.id);
    startScroll(song);
  };
  songSpeed = () => speedDial(null);
  window.scrollTo(0, 0);
  fab.lastY = 0; fab.reveal = 1;
}

// Render display blocks. Chord/lyric pairs wrap between words with chords riding
// on their word; tab systems are re-wrapped by measure to the screen width.
let redraw = null;
let refreshSpeed = () => {}; /* the song page's speed slider, after the length changes */
let foldApi = null;
onLeave(() => { teardownFold(); foldApi = null; });
// Substitutions from Make it easier for the song on screen: shape name → easier chord.
let SUBS = {};
function chordLabel(text) {
  let name = String(text).split(/\s+/)[0].replace(/^\(|\)$/g, "");
  if (SUBS[name]) { text = String(text).replace(name, SUBS[name]); name = SUBS[name]; }
  return chordShape(name) ? `<span class="c" data-ch="${esc(name)}"><span class="ct">${esc(text)}</span></span>` : `<span class="c">${esc(text)}</span>`;
}
function renderBlocks(sheet, blocks) {
  /* German practice: a German word carries its card's key and its noun gender. */
  const txt = p => p.de ? `<span class="de${p.de.g ? " g-" + p.de.g : ""}" data-de="${esc(p.de.k)}">${esc(p.text)}</span>` : esc(p.text);
  const word = w => w.space ? " " : `<span class="w">${w.parts.map(p => p.chord
    ? `<span class="sg${p.free ? " free" : ""}">${chordLabel(p.chord)}<span class="l">${txt(p)}</span></span>`
    : txt(p)).join("")}</span>`;
  const under = b => b.en ? `<span class="de-en">${esc(b.en)}</span>` : "";
  sheet.innerHTML = blocks.map((b, i) => {
    if (b.kind === "section") return `<div class="sec">${esc(b.text)}</div>`;
    if (b.kind === "blank") return `<div class="gap"></div>`;
    if (b.kind === "lyric") return `<div class="ly">${b.segs ? b.segs.map(txt).join(" ") : esc(b.text)}${under(b)}</div>`;
    if (b.kind === "chords") return `<div class="crow">${b.items.map(chordLabel).join("")}</div>`;
    if (b.kind === "pair") return `<div class="pr">${b.words.map(word).join("")}${under(b)}</div>`;
    return `<div class="tabsys" data-i="${i}"></div>`;
  }).join("");

  const systems = sheet.querySelectorAll(".tabsys");
  if (!systems.length) return;
  // Measure one monospace character at the current tab size.
  const probe = document.createElement("span");
  probe.className = "tab";
  probe.style.cssText = "position:absolute;visibility:hidden;margin:0";
  probe.textContent = "0".repeat(40);
  sheet.appendChild(probe);
  const cols = Math.max(12, Math.floor(sheet.clientWidth / (probe.getBoundingClientRect().width / 40)));
  probe.remove();
  systems.forEach(el => {
    el.innerHTML = wrapTab(blocks[+el.dataset.i].lines, cols)
      .map(rows => `<div class="tab">${rows.map(esc).join("\n")}</div>`).join("");
  });
}
// ---------- Chord diagrams ----------
// Paused: tap any chord for its fingering. Playing: a fixed Now and Next panel in
// the dock shows the chord at the reading line and the ones coming up, and the
// current line stays bright while the others dim. Nothing moves over the lyrics.
const CARD_W = 54, CARD_H = 78;
const READ_AT = 0.4; // reading line, as a share of screen height
let diag = { seq: [], blocks: [], idx: null, block: null, nn: true, focus: true };

function chordSVG(name, scale = 1) {
  const c = chordShape(name);
  if (!c) return "";
  const sx = i => 9 + i * 7.2, top = 30, fh = 10, base = c.base || 1;
  const rowY = f => top + (f - base + 0.5) * fh;
  let g = `<text x="26" y="13" text-anchor="middle" class="dn">${esc(name)}</text>`;
  c.frets.forEach((f, i) => {
    if (f < 0) g += `<path class="dx" d="M${sx(i) - 2.4} 21.5L${sx(i) + 2.4} 26.5M${sx(i) + 2.4} 21.5L${sx(i) - 2.4} 26.5"/>`;
    else if (f === 0) g += `<circle class="do" cx="${sx(i)}" cy="24" r="2.4"/>`;
  });
  if (base === 1) g += `<rect class="dnut" x="8" y="28.5" width="37.5" height="2.2" rx=".6"/>`;
  for (let k = 0; k <= 4; k++) g += `<line class="df" x1="9" y1="${top + k * fh}" x2="45" y2="${top + k * fh}"/>`;
  for (let i = 0; i < 6; i++) g += `<line class="ds" x1="${sx(i)}" y1="30" x2="${sx(i)}" y2="70"/>`;
  const b = c.barre;
  if (b) g += `<rect class="dd" x="${sx(b.from) - 3.5}" y="${rowY(b.fret) - 3.5}" width="${sx(b.to) - sx(b.from) + 7}" height="7" rx="3.5"/>`;
  c.frets.forEach((f, i) => {
    if (f <= 0 || (b && f === b.fret && i >= b.from && i <= b.to && c.fingers[i] === 1)) return;
    g += `<circle class="dd" cx="${sx(i)}" cy="${rowY(f)}" r="3.7"/>`;
    if (c.fingers[i]) g += `<text class="dk" x="${sx(i)}" y="${rowY(f) + 1.9}" text-anchor="middle">${c.fingers[i]}</text>`;
  });
  if (base > 1) g += `<text class="db" x="48" y="${rowY(base) + 2.4}">${base}</text>`;
  return `<svg width="${52 * scale}" height="${76 * scale}" viewBox="0 0 52 76" role="img" aria-label="${esc(name)} chord fingering">${g}</svg>`;
}

// Record every chord label and every line, top to bottom, for the reading line.
function layoutDiagrams(sheet, isChords) {
  sheet.querySelectorAll(".dpop, .prow").forEach(el => el.remove());
  const top = sheet.getBoundingClientRect().top;
  diag.seq = isChords ? [...sheet.querySelectorAll(".c[data-ch]")].map(el => ({
    el, name: el.dataset.ch, y: el.getBoundingClientRect().top - top
  })) : [];
  /* For the bass: the chord rows (a chord-only row has a bar per chord). */
  diag.brows = [];
  diag.seq.forEach((it, i) => {
    const el = it.el.closest(".crow, .pr") || it.el, last = diag.brows[diag.brows.length - 1];
    if (last?.el === el) last.hi = i;
    else { const r = el.getBoundingClientRect(); diag.brows.push({ el, lo: i, hi: i, kind: el.classList.contains("crow") ? "bar" : "line", r0: r.top - top, r1: r.bottom - top }); }
  });
  // Screen rows of chords, for the paused diagrams.
  const left0 = sheet.getBoundingClientRect().left;
  diag.rows = [];
  for (const it of diag.seq) {
    const r = it.el.getBoundingClientRect();
    let row = diag.rows.find(x => Math.abs(x.top - it.y) < 6);
    if (!row) diag.rows.push(row = { top: it.y, items: [] });
    if (!row.items.some(x => x.name === it.name)) row.items.push({ name: it.name, x: r.left - left0 + Math.min(r.width, 40) / 2 });
  }
  diag.blocks = [...sheet.children].filter(el => !el.classList.contains("dpop") && !el.classList.contains("prow"))
    .map(el => ({ el, y: el.getBoundingClientRect().top - top }));
  diag.nn = isChords && data.settings.diagrams === true && diag.seq.length > 0;
  diag.focus = ["always", "playing", "off"].includes(data.settings.focus) ? data.settings.focus : "always";
  diag.idx = null; diag.block = null; diag.rowKey = null;
  updateDiagrams();
  showPausedRow();
}

function card(name, scale, opacity = 1) {
  return `<div class="card" style="width:${(CARD_W * scale).toFixed(1)}px;height:${(CARD_H * scale).toFixed(1)}px;opacity:${opacity}">${chordSVG(name, scale)}</div>`;
}

/* Chord timing (3.22.0): each chord on a timed line gets the time of the word it sits on (the line's
   time shared out by syllables, or the lyrics' own word times) on the beat of the measured tempo.
   Chords between timed lines are placed in between. null when nothing is timed. */
const chordTimeCache = { key: "", times: null };
function chordTimes(song) {
  const at = song.timed?.at;
  if (!at?.length || !diag.seq.length) return null;
  const bpm = song.listen?.feel?.bpm || 0;
  const key = `${song.id}|${at.length}|${diag.seq.length}|${bpm}|${Math.round(diag.seq[diag.seq.length - 1].y)}`;
  if (key === chordTimeCache.key) return chordTimeCache.times;
  const lines = sheetLines(), when = new Map(at), order = at.map(x => x[0]), per = new Map();
  const times = diag.seq.map(it => {
    const row = it.el.closest(".pr"), li = row ? lines.indexOf(row) : -1;
    if (!when.has(li)) return null;
    let pl = per.get(li);
    if (!pl) {
      const ws = [...row.querySelectorAll(".w")], start = when.get(li), nx = order.find(i => i > li);
      const end = Math.min(nx !== undefined ? when.get(nx) : start + 8, start + 12);
      const words = ws.map(w => { const c = w.cloneNode(true); c.querySelectorAll(".c").forEach(x => x.remove()); return c.textContent.trim(); });
      pl = { ws, t: wordTimes(words, start, end, { bpm, given: song.timed.w?.[li] }) };
      per.set(li, pl);
    }
    const k = pl.ws.indexOf(it.el.closest(".w"));
    return k >= 0 ? pl.t[k] : null;
  });
  /* chords on untimed rows (an intro of chords, a line the lyrics didn't match): in between */
  const known = times.map((t, i) => t != null ? i : -1).filter(i => i >= 0);
  if (!known.length) { chordTimeCache.key = key; chordTimeCache.times = null; return null; }
  for (let n = 0; n + 1 < known.length; n++) {
    const p = known[n], q = known[n + 1];
    for (let i = p + 1; i < q; i++) times[i] = times[p] + (times[q] - times[p]) * (i - p) / (q - p);
  }
  chordTimeCache.key = key; chordTimeCache.times = times;
  return times;
}
function updateDiagrams() {
  const sheet = $("sheet");
  const playing = scroll.on && !!sheet;
  document.body.classList.toggle("nn-on", playing && diag.nn);
  if (!sheet) return;
  if (!playing) {
    sheet.querySelectorAll(".c.now").forEach(el => el.classList.remove("now"));
    diag.idx = null;
    if (!diag.scrolling) applyPaused();
    return;
  }
  sheet.classList.toggle("focus", diag.focus !== "off");
  const sheetTop = sheet.getBoundingClientRect().top;
  const line = window.innerHeight * READ_AT;

  // Current line: the last line whose top has reached the reading line. A
  // section name or a gap is never the current line: the line about to be
  // played (the section's first) takes the focus as soon as its name arrives.
  let b = 0;
  for (let i = 0; i < diag.blocks.length; i++) if (sheetTop + diag.blocks[i].y <= line) b = i;
  while (b < diag.blocks.length - 1 && !isLine(diag.blocks[b].el)) b++;
  setCurrent(diag.blocks[b]?.el);

  if (!diag.nn) return;
  // Current chord: the last chord that has reached the reading line. With the recording playing and
  // its lines timed (3.22.0), the last chord whose time has come instead, so Now changes on the beat.
  let idx = 0;
  const clock = viewing && usesMusic(viewing) ? musicClock(viewing) : null, ct = clock !== null ? chordTimes(viewing) : null;
  if (ct) { for (let i = 0; i < ct.length; i++) if (ct[i] != null && ct[i] <= clock) idx = i; }
  else for (let i = 0; i < diag.seq.length; i++) if (sheetTop + diag.seq[i].y <= line) idx = i;
  if (idx === diag.idx) return;
  diag.seq[diag.idx]?.el.classList.remove("now");
  diag.idx = idx;
  const now = diag.seq[idx];
  now.el.classList.add("now");
  // Next: the following chords, skipping repeats of the one before.
  const next = [];
  let last = now.name;
  for (let i = idx + 1; i < diag.seq.length && next.length < 3; i++) {
    if (diag.seq[i].name !== last) { next.push(diag.seq[i].name); last = diag.seq[i].name; }
  }
  const fade = [0.85, 0.5, 0.28];
  $("nn").innerHTML = `
    <div class="nowcol"><div class="lab">NOW</div><div class="swap">${card(now.name, 1.26)}</div></div>
    <div class="vs"></div>
    <div style="min-width:0"><div class="lab">NEXT</div>
      <div class="cards swap">${next.length ? next.map((n, i) => card(n, 1, fade[i])).join("") : `<div class="none">End of song</div>`}</div>
    </div>`;
}

// Tap a chord: show its card above it until the next tap.
// ---------- Current line when paused ----------
// The same line gets focus and diagrams: a tapped line, else the first line at the
// top of the song, else the line at the reading point.
// Focus covers two lines: the current one and the one after it (section names
// and gaps skipped), so a speed that is slightly off still leaves room to read
// ahead or catch up.
function nextLineOf(block) {
  let el = block?.nextElementSibling;
  while (el && !el.matches(".pr, .ly")) el = el.nextElementSibling;
  return el;
}
function setCurrent(block) {
  if (block === diag.block) return;
  diag.block?.classList.remove("cur");
  diag.block2?.classList.remove("cur", "cur2");
  block?.classList.add("cur");
  diag.block2 = nextLineOf(block);
  diag.block2?.classList.add("cur", "cur2");
  diag.block = block;
}
const isLine = el => el && !el.classList.contains("sec") && !el.classList.contains("gap");
function pausedBlock() {
  if (diag.pinned?.isConnected) return diag.pinned;
  if (window.scrollY < 40) return diag.blocks.find(b => isLine(b.el))?.el;
  const sheet = $("sheet");
  const top = sheet.getBoundingClientRect().top, line = window.innerHeight * READ_AT;
  let i = -1;
  diag.blocks.forEach((x, j) => { if (top + x.y <= line) i = j; });
  /* On a section name or a gap, the line about to be played is the next one. */
  const next = diag.blocks.slice(Math.max(0, i)).find(x => isLine(x.el));
  return (i >= 0 && isLine(diag.blocks[i].el) ? diag.blocks[i].el : next?.el) || diag.blocks.find(x => isLine(x.el))?.el;
}
function applyPaused() {
  const sheet = $("sheet");
  if (!sheet || scroll.on) return;
  const block = pausedBlock();
  const on = diag.focus === "always";
  sheet.classList.toggle("focus", on);
  setCurrent(on ? block : null);
  showPausedRow(block);
}

// Paused: the line at the reading point gets its diagrams, each over its chord.
// Shown after pausing; follows to a new line once a paused scroll comes to rest.
const FOCUS_SCALE = 1.05; /* matches .sheet.focus > .cur in the styles */
function showPausedRow(block = pausedBlock()) {
  const sheet = $("sheet");
  if (!sheet || chordEdit) return;
  const want = diag.armed && !scroll.on && diag.rows?.length && block;
  const old = sheet.querySelector(".prow");
  if (!want) { old?.remove(); diag.rowKey = null; return; }
  // Chord rows inside the current line (a long line may wrap onto several rows).
  const inside = diag.rows.filter(r => r.top >= block.offsetTop - 2 && r.top < block.offsetTop + block.offsetHeight);
  if (!inside.length) { old?.remove(); diag.rowKey = null; return; }
  // One set of cards above the line's first row: its chords in place, then any
  // chords that only appear where the line wraps.
  /* The focused line is drawn 5% larger from its left edge, so move the cards to match. */
  const S = sheet.classList.contains("focus") && block.classList.contains("cur") && block.matches(".pr, .ly") ? FOCUS_SCALE : 1;
  const cy = block.offsetTop + block.offsetHeight / 2;
  const items = inside[0].items.map(it => ({ ...it, x: it.x * S }));
  for (const r of inside.slice(1)) for (const it of r.items) if (!items.some(x => x.name === it.name)) items.push({ ...it, x: it.x * S });
  const row = { top: cy + (inside[0].top - cy) * S, items };
  if (old && diag.rowKey === row.top) return;
  old?.remove();
  diag.rowKey = row.top;
  const width = sheet.clientWidth, n = row.items.length, GAP = 4;
  const scale = Math.min(1, Math.max(0.7, (width + GAP) / (n * (CARD_W + GAP))));
  const w = CARD_W * scale, h = CARD_H * scale;
  // Center over each chord, push right to clear overlaps, pull back inside the edge.
  const lefts = row.items.map(it => it.x - w / 2);
  for (let i = 0; i < n; i++) lefts[i] = i === 0 ? Math.max(0, lefts[i]) : Math.max(lefts[i], lefts[i - 1] + w + GAP);
  if (lefts[n - 1] + w > width) for (let i = n - 1; i >= 0; i--) lefts[i] = Math.min(lefts[i], i === n - 1 ? width - w : lefts[i + 1] - w - GAP);
  /* over the first line the cards would cover "Chords in this song"
     above the sheet, so there they hang below the line instead. */
  /* Compared on screen, against the sheet's top and the chord boxes themselves. */
  const cardsTop = block.getBoundingClientRect().top + (row.top - h - 9 - block.offsetTop);
  const strip = $("strip")?.querySelector(".strip"), sr = strip?.offsetParent ? strip.getBoundingClientRect() : null, shr = sheet.getBoundingClientRect();
  const stripBottom = sr && sr.left < shr.right && sr.right > shr.left && sr.bottom <= block.getBoundingClientRect().top ? sr.bottom : -Infinity; /* only when it's above the song (iPad keeps it in the side rail) */
  const below = cardsTop < Math.max(shr.top, stripBottom + 4);
  const el = document.createElement("div");
  el.className = "prow" + (below ? " below" : "");
  el.style.top = (below ? block.offsetTop + block.offsetHeight + 9 : row.top - h - 9) + "px";
  el.innerHTML = row.items.map((it, i) =>
    `<div class="pcard" style="left:${lefts[i].toFixed(1)}px;width:${w}px;height:${h}px">${chordSVG(it.name, scale)}<i class="dptr" style="left:${Math.min(w - 8, Math.max(8, it.x - lefts[i])).toFixed(1)}px"></i></div>`).join("");
  sheet.appendChild(el);
}
let pausedTimer = 0;
onScroll(() => {
  const sheet = $("sheet");
  if (scroll.on || !sheet || route().name !== "song") return;
  if (!diag.scrolling) { diag.scrolling = true; diag.scrollFrom = window.scrollY; }
  // Focus stays on while scrolling and follows the reading point; a small
  // nudge keeps a tapped line. Diagrams move once the scroll comes to rest.
  if (diag.pinned && Math.abs(window.scrollY - diag.scrollFrom) > 40) diag.pinned = null;
  if (diag.focus === "always") { sheet.classList.add("focus"); setCurrent(pausedBlock()); }
  clearTimeout(pausedTimer);
  pausedTimer = setTimeout(() => {
    diag.scrolling = false;
    // A real scroll moves on from a tapped line; a nudge keeps it.
    if (Math.abs(window.scrollY - diag.scrollFrom) > 40) diag.pinned = null;
    applyPaused();
  }, 220);
});

// ---------- Make it easier ----------
// Claude suggests a capo and a few simpler substitutes. Only chord names are sent:
// this song's chords and the chords used most across the library. The original
// sheet is never changed; the suggestion is stored with the song and can be
// switched off.
let viewing = null; // the song on screen
let curPaintStat = null; // refreshes the status button after a play is logged

function chordNames(body, steps, flats) {
  const out = [];
  for (const b of parseBlocks(body || "", steps, flats)) {
    const raw = b.kind === "pair" ? b.words.flatMap(w => w.parts || []).map(p => p.chord).filter(Boolean)
      : b.kind === "chords" ? b.items : [];
    for (const r of raw) {
      const n = String(r).split(/\s+/)[0].replace(/^\(|\)$/g, "");
      if (chordShape(n) && !out.includes(n)) out.push(n);
    }
  }
  return out;
}
const songKey = s => s.key || guessKey(s.body || "");
// ---------- Practice a section ----------
// Pick a section (first and last line, or a section label for the whole section).
// While playing, the section repeats; Build up starts at 80% speed and adds 5% a pass.
let loopPick = null;   // { song, a } while choosing
onLeave(() => { if (loopPick) { loopPick = null; document.querySelector(".loopbanner")?.remove(); } });
let loopRun = { pass: 0 };
const sheetLines = () => [...($("sheet")?.children || [])].filter(el => !el.classList.contains("prow") && !el.classList.contains("dpop"));
function startLoopPick(song) {
  stopScroll();
  loopPick = { song, a: null };
  document.querySelector(".loopbanner")?.remove();
  const b = document.createElement("div");
  b.className = "loopbanner glass float";
  b.innerHTML = `<span id="lb-t">Tap the first line of the section, or a section name like Chorus.</span><button class="tb go" id="lb-x">Cancel</button>`;
  document.body.appendChild(b);
  $("lb-x").onclick = () => { loopPick = null; b.remove(); paintLoop(song); };
}
function pickLoopLine(el) {
  const lines = sheetLines(), i = lines.indexOf(el), song = loopPick.song;
  if (i < 0) return;
  if (loopPick.a === null && el.classList.contains("sec")) {
    let j = i + 1;
    while (j < lines.length && !lines[j].classList.contains("sec")) j++;
    while (j - 1 > i && lines[j - 1].classList.contains("gap")) j--;
    return finishLoop(song, i, j - 1);
  }
  if (loopPick.a === null) {
    loopPick.a = i;
    el.classList.add("loopa");
    $("lb-t").textContent = "Now tap the last line of the section.";
    return;
  }
  finishLoop(song, Math.min(loopPick.a, i), Math.max(loopPick.a, i));
}
function finishLoop(song, a, b) {
  loopPick = null;
  document.querySelector(".loopbanner")?.remove();
  song.loop = { a, b, build: song.loop?.build ?? false };
  song.loop.name = loopName(song); /* for the neck's Learning list (3.21.0) */
  Tabs.save(data);
  loopRun = { pass: 0 };
  if (!practicing(song)) setPracticing(song, true);
  paintLoop(song);
  toast("Section set. Press play to practice it", $("play"));
}
function loopName(song) {
  const lines = sheetLines();
  for (let k = song.loop.a; k >= 0; k--) if (lines[k]?.classList.contains("sec")) return lines[k].textContent.trim();
  return `Lines ${song.loop.a + 1}–${song.loop.b + 1}`;
}
/* Practice mode (3.21.0): the Practice chip under the title turns it on (a song you're learning starts
   with it on). It brings one Practice row to the bar: the section to loop, the speed, Build up, and
   off. Practice time counts on the Tour Map; off, the song plays straight through. */
const activeLoop = song => practicing(song) && song.loop ? song.loop : null;
function setPracticing(song, on) {
  const def = song.status === "learning";
  song.practice = { ...(song.practice || {}) };
  if (on === def) delete song.practice.on; else song.practice.on = on;
  if (!Object.keys(song.practice).length) delete song.practice;
  Tabs.save(data);
  loopRun = { pass: 0 };
  paintLoop(song);
}
const PRACTICE_SPEEDS = [1, 0.9, 0.8, 0.7, 0.6, 0.5];
const DRUM_LEVELS = { "-1": "simpler", 0: "as written", 1: "busier" };
export function paintLoop(song) {
  refreshPlay(song);
  const lines = sheetLines(), on = practicing(song), lp = activeLoop(song);
  lines.forEach(el => el.classList.remove("inloop", "loopa", "loopfirst", "looplast"));
  const row = $("looprow");
  document.body.classList.toggle("loop-on", on);
  if (!on) { if (row) row.innerHTML = ""; row?.classList.remove("on"); return; }
  if (lp && lines[lp.b]) {
    for (let k = lp.a; k <= lp.b; k++) lines[k].classList.add("inloop");
    lines[lp.a].classList.add("loopfirst"); lines[lp.b].classList.add("looplast");
  }
  if (!row) return;
  row.classList.add("on");
  const rate = practiceRate(song), has = lp && lines[lp.b];
  const withRec = usesMusic(song) ? `<span class="lp-rec" aria-label="with the recording">${/^https:\/\//.test(song.listen?.art || "") ? `<img src="${esc(song.listen.art)}" alt="">` : icon("note")}</span>` : "";
  row.innerHTML = `<span class="lp-lbl">PRACTICE</span>
    <button class="chip lp-sec${has ? " on" : ""}" id="lp-sec">${icon("loop")}${has ? `${esc(loopName(song))}${loopRun.pass ? ` · ${loopRun.pass + 1}` : ""}` : "Pick a section"}${has ? withRec : ""}</button>
    <button class="chip${rate < 1 ? " on" : ""}" id="lp-speed" aria-label="Practice speed ${Math.round(rate * 100)}%">${Math.round(rate * 100)}%</button>
    ${has ? `<button class="chip ${lp.build ? "on" : ""}" id="lp-build" aria-pressed="${!!lp.build}">Build up</button>` : ""}
    ${(() => {
      if (!data.settings.metronome || !metroDrums() || usesMusic(song) || (song.beats || 4) !== 4) return "";
      if (song.drums) return `<button class="chip${song.drums.level ? " on" : ""}" id="lp-drums" aria-label="Drums: ${DRUM_LEVELS[song.drums.level || 0]}">Drums: ${DRUM_LEVELS[song.drums.level || 0]}</button>`;
      return aiKey() ? `<button class="chip" id="lp-drums-new" aria-label="Write drums for this song">${drumJobs.has(song.id) ? "Writing drums…" : "Write drums"}</button>` : "";
    })()}
    <button class="sb" id="lp-x" aria-label="Practice mode off">${icon("x")}</button>`;
  $("lp-sec").onclick = () => startLoopPick(song);
  $("lp-speed").onclick = () => {
    const i = PRACTICE_SPEEDS.findIndex(v => Math.abs(v - rate) < 0.01), next = PRACTICE_SPEEDS[(i + 1) % PRACTICE_SPEEDS.length];
    song.practice = { ...(song.practice || {}) };
    if (next >= 1) delete song.practice.rate; else song.practice.rate = next;
    Tabs.save(data);
    if (scroll.on && usesMusic(song)) setMusicRate(recRate(song));
    paintLoop(song);
    toast(usesMusic(song) && next < 1 && !rateWorks() ? "Apple Music can't change the speed here. The recording stays at full speed." : `Practice at ${Math.round(next * 100)}%`, $("lp-speed"));
  };
  $("lp-build")?.addEventListener("click", () => { lp.build = !lp.build; Tabs.save(data); paintLoop(song); });
  $("lp-drums-new")?.addEventListener("click", () => { const j = drumsFor(song, true); toast("Writing drums for this song…", $("lp-drums-new")); if (j) paintLoop(song); });
  $("lp-drums")?.addEventListener("click", () => {
    const lv = ((song.drums.level || 0) + 2) % 3 - 1; /* as written, busier, simpler */
    if (lv) song.drums.level = lv; else delete song.drums.level;
    metro.bar = null; Tabs.save(data); paintLoop(song);
    toast(`Drums: ${DRUM_LEVELS[lv]}`, $("lp-drums"));
  });
  $("lp-x").onclick = () => { setPracticing(song, false); toast("Practice mode off. The section is kept for next time"); };
}
// Speed factor for the current pass.
/* How fast the recording plays: the song's own setting, slowed further on a Build up pass. */
const recRate = song => Math.max(0.5, loopFactor(song));
/* Where in the recording Play begins: the loop's first line when the page is away from the section, else the page's place. */
function playFromSec(song) {
  const lp = activeLoop(song);
  if (lp) {
    const lines = sheetLines(), first = lines[lp.a], last = lines[lp.b], line = innerHeight * READ_AT;
    if (first && last && (first.getBoundingClientRect().top > line + 4 || last.getBoundingClientRect().bottom < line)) return musicSec(song, Math.max(0, scrollY + first.getBoundingClientRect().top - line));
  }
  return musicSec(song, scrollY);
}
export const loopFactor = song => practiceRate(song) * (activeLoop(song)?.build ? Math.min(1, 0.8 + 0.05 * loopRun.pass) : 1);
// Called each frame while playing: when the section's last line passes the reading
// point, glide back to its first line and count a pass.
function loopCheck(song) {
  const lp = activeLoop(song);
  if (!lp) return false;
  const lines = sheetLines(), first = lines[lp.a], last = lines[lp.b];
  if (!first || !last) return false;
  const line = innerHeight * READ_AT;
  /* A section at the end of the song can't reach the reading line; give it a few seconds at the bottom instead. */
  const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 2;
  if (!atEnd) loopRun.endSince = 0; else loopRun.endSince ||= performance.now();
  const endDone = atEnd && performance.now() - loopRun.endSince > 3000;
  if (last.getBoundingClientRect().bottom > line - 4 && !endDone) return false;
  loopRun.endSince = 0;
  loopRun.pass++;
  hold.active = true; releaseSoon(900);
  const back = Math.max(0, scrollY + first.getBoundingClientRect().top - line);
  /* The recording goes back with the page, at this pass's speed. */
  if (usesMusic(song) && musicClock(song) !== null) {
    const sec = musicSec(song, back);
    musicSync.target = sec; musicSync.until = performance.now() + 3000; musicSync.clock = -1;
    seekMusic(song, sec); setMusicRate(recRate(song));
  }
  window.scrollTo({ top: back, behavior: calm() ? "auto" : "smooth" });
  paintLoop(song);
  return true;
}

// ---- A song made with Sing it: hear the recording, and Simple or Rich chords ----
// Rich adds the 7ths and 9ths the melody sings (and a V7); both keep the
// words as they are now, with Undo.
function bindSketchRow(song) {
  const row = $("skrow");
  if (!row) return;
  const hear = $("sk-hear");
  lazy("sketch.js").then(m => m.hasRecording(song).then(has => {
    if (!has || !hear.isConnected) return;
    hear.hidden = false;
    hear.onclick = () => {
      if (hear.classList.contains("on")) return m.stopHearing();
      stopScroll();
      hear.classList.add("on"); hear.querySelector("span").textContent = "Stop";
      m.hearSketch(song, () => { if (hear.isConnected) { hear.classList.remove("on"); hear.querySelector("span").textContent = "Your recording"; } });
    };
  }));
  row.querySelectorAll("[data-st]").forEach(b => b.onclick = () => {
    const st = b.dataset.st, was = { body: song.body, style: song.sketch.style || "simple" };
    if (st === was.style) return;
    song.body = restyle(song.body, song.sketch, st);
    song.sketch.style = st;
    Tabs.save(data); render();
    toast(st === "rich" ? "Richer chords: 7ths and 9ths you sang" : "Simple chords", null, { label: "Undo", fn: () => { song.body = was.body; song.sketch.style = was.style; Tabs.save(data); render(); } });
  });
}

// ---------- Wide screens (iPad) ----------
// From 1000px wide, a rail on the right holds Now and Next and the chords in
// this song, so the song itself gets the middle and larger text. From 1150px,
// a list of songs on the left (or the set being played) switches songs without
// going back. Rotating, or resizing in Split View, moves things back.
const wideMQ = matchMedia("(min-width: 1000px)"), sideMQ = matchMedia("(min-width: 1150px)");
function placeWide() {
  const rail = $("rail"), strip = $("strip"), nn = $("nn");
  document.body.classList.toggle("wide", wideMQ.matches && !!rail);
  if (!rail || !strip || !nn) return;
  if (wideMQ.matches) { if (strip.parentElement !== rail) rail.append(nn, strip); }
  else if (strip.parentElement === rail) { app.querySelector(".metarow").after(strip); $("looprow").before(nn); }
}
function paintSide(song) {
  const side = $("side");
  if (!side) return;
  if (!sideMQ.matches) { side.innerHTML = ""; return; }
  const x = setCtx && data.sets.find(z => z.id === setCtx.id);
  const list = x ? setSongs(x) : sortSongs(data.songs, data.settings.sort || "title");
  side.innerHTML = `<div class="side-h">${x ? esc(x.name) : "Songs"}</div>` + list.map((s, i) =>
    `<button class="side-r ${s.id === song.id ? "on" : ""}" data-id="${esc(s.id)}" data-i="${i}" ${s.id === song.id ? 'aria-current="page"' : ""}><b>${esc(s.title)}</b><span>${esc(s.artist || "")}</span></button>`).join("");
  side.onclick = e => {
    const b = e.target.closest(".side-r");
    if (!b || b.classList.contains("on")) return;
    if (x) setCtx.idx = +b.dataset.i;
    go("#/song/" + encodeURIComponent(b.dataset.id));
  };
  side.querySelector(".on")?.scrollIntoView({ block: "nearest" });
}
[wideMQ, sideMQ].forEach(mq => mq.addEventListener?.("change", () => {
  if (route().name !== "song" || !viewing || chordEdit) return document.body.classList.remove("wide");
  placeWide(); paintSide(viewing); redraw?.();
}));
onLeave(r => { if (r.name !== "song") document.body.classList.remove("wide"); });

// ---------- Pedals and keyboards ----------
// A Bluetooth page-turner pedal pairs with the phone as a keyboard, so the song
// view answers keys. Left pedal (Page Up, ← or ↑) or Space plays and pauses.
// Right pedal (Page Down, → or ↓) goes to the next section; held, back one.
const PEDAL_NEXT = ["PageDown", "ArrowRight", "ArrowDown"], PEDAL_PLAY = ["PageUp", "ArrowLeft", "ArrowUp", " "];
const pedal = { timer: 0, long: false };
function stepSection(dir) {
  const sheet = $("sheet");
  if (!sheet) return;
  const now = scrollY, page = innerHeight * 0.7;
  const tops = [...sheet.querySelectorAll(":scope > .sec")].map(el => Math.max(0, Math.round(el.getBoundingClientRect().top + scrollY - innerHeight * READ_AT)));
  let to = dir > 0 ? tops.find(y => y > now + 8) : tops.slice().reverse().find(y => y < now - 8);
  if (to === undefined) to = dir > 0 ? now + page : (tops.length ? 0 : now - page);
  hold.active = true; releaseSoon(900);
  window.scrollTo({ top: Math.min(Math.max(0, to), mapMax()), behavior: calm() ? "auto" : "smooth" });
  diag.pinned = null;
  tick();
}
const pedalOff = e => route().name !== "song" || chordEdit || e.metaKey || e.ctrlKey || e.altKey || layer.innerHTML || document.querySelector(".ask, .menu") ||
  e.target.closest?.("input, textarea, select, [contenteditable]") || (e.key === " " && e.target.closest?.("button, a"));
document.addEventListener("keydown", e => {
  if (pedalOff(e)) return;
  if (PEDAL_PLAY.includes(e.key)) { e.preventDefault(); if (!e.repeat) { markUsed("pedal"); $("play")?.click(); } }
  else if (PEDAL_NEXT.includes(e.key)) {
    e.preventDefault();
    if (e.repeat || pedal.timer) return;
    markUsed("pedal"); pedal.long = false;
    pedal.timer = setTimeout(() => { pedal.long = true; stepSection(-1); }, 600);
  }
});
document.addEventListener("keyup", e => {
  if (!PEDAL_NEXT.includes(e.key) || !pedal.timer) return;
  clearTimeout(pedal.timer); pedal.timer = 0;
  if (!pedal.long && !pedalOff(e)) { e.preventDefault(); stepSection(1); }
});

// ---------- Song map ----------
// A thin rail on the right edge with a dot for each section. Quiet while you play;
// touch it and the section names appear, slide to a section and let go to jump.
const map = { secs: [], el: null, dragging: false, hideTimer: 0 };
onLeave(() => { document.querySelector(".smap")?.remove(); map.el = null; });
const mapMax = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
function buildMap() {
  document.querySelector(".smap")?.remove();
  map.el = null;
  const sheet = $("sheet");
  if (!sheet || route().name !== "song") return;
  const secs = [...sheet.querySelectorAll(":scope > .sec")];
  if (secs.length < 2) return;
  /* Dots sit where each section is in the song; jumping puts its label at the reading line. */
  const H = document.documentElement.scrollHeight;
  map.secs = secs.map(el => { const top = el.getBoundingClientRect().top + scrollY; return { el, name: el.textContent.trim(), y: top / H, to: Math.max(0, top - innerHeight * READ_AT) }; });
  const m = document.createElement("div");
  m.className = "smap";
  m.setAttribute("role", "navigation");
  m.setAttribute("aria-label", "Song sections");
  m.innerHTML = `<i class="sm-track"></i><i class="sm-fill"></i>${map.secs.map((x, i) =>
    `<button class="sm-m" data-i="${i}" style="top:${(x.y * 100).toFixed(2)}%" aria-label="Go to ${esc(x.name)}" tabindex="-1"><b>${esc(x.name)}</b><i></i></button>`).join("")}`;
  document.body.appendChild(m);
  map.el = m;
  const pick = e => {
    const r = m.getBoundingClientRect(), f = (e.clientY - r.top) / r.height;
    let best = 0;
    map.secs.forEach((x, i) => { if (Math.abs(x.y - f) < Math.abs(map.secs[best].y - f)) best = i; });
    return best;
  };
  const jump = (i, smooth) => {
    const top = Math.min(map.secs[i].to, mapMax());
    hold.active = true; releaseSoon(smooth ? 900 : 300);
    window.scrollTo({ top, behavior: smooth && !calm() ? "smooth" : "auto" });
    diag.pinned = null;
  };
  m.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    map.dragging = true; m.setPointerCapture?.(e.pointerId); markUsed("map");
    clearTimeout(map.hideTimer); m.classList.add("active");
    map.target = pick(e); paintMap(map.target);
  });
  m.addEventListener("pointermove", e => {
    if (!map.dragging) return;
    const i = pick(e);
    if (i !== map.target) { map.target = i; paintMap(i); jump(i, false); }
  });
  const end = () => {
    if (!map.dragging) return;
    map.dragging = false;
    jump(map.target, true);
    map.hideTimer = setTimeout(() => { m.classList.remove("active"); paintMap(); }, 900);
  };
  m.addEventListener("pointerup", end);
  m.addEventListener("pointercancel", end);
  m.addEventListener("click", e => e.stopPropagation());
  paintMap();
}
function paintMap(target) {
  const m = map.el;
  if (!m || !m.isConnected) return;
  /* Out of the way at the top of the song, where the title and chord cards are. */
  const away = !map.dragging && ($("sheet")?.getBoundingClientRect().top ?? 0) > innerHeight * 0.25;
  m.classList.toggle("away", away);
  if (!away && !scroll.on && !chordEdit && tipDue("map") && !map.coaching) {
    map.coaching = true;
    setTimeout(() => {
      map.coaching = false;
      if (map.el !== m || m.classList.contains("away") || scroll.on || !coachTip("map")) return;
      demoMap();
    }, 700);
  }
  const f = Math.min(1, (scrollY + innerHeight * READ_AT) / document.documentElement.scrollHeight);
  m.querySelector(".sm-fill").style.height = (f * 100) + "%";
  let cur = 0;
  /* At the very end the page can't scroll further, so count sections in view. */
  const line = scrollY >= mapMax() - 2 ? innerHeight * 0.7 : innerHeight * READ_AT + 4;
  map.secs.forEach((x, i) => { if (x.el.getBoundingClientRect().top <= line) cur = i; });
  m.querySelectorAll(".sm-m").forEach((b, i) => { b.classList.toggle("on", i === (target ?? cur)); b.classList.toggle("past", i < cur); });
}
onScroll(() => { if (map.el) paintMap(map.dragging ? map.target : undefined); });

let openEdit = null;            /* { id, view } to open the editor once the song page draws */
const setOpenEdit = v => { openEdit = v; };
// ---- Edit and Settings load when first opened (editor.js, settings.js) ----
// The first screen doesn't need them, so the app opens faster; they're fetched
// quietly a few seconds after it does. The editor's open song lives here, since
// the song page and the coach check it.
let chordEdit = null;
const setChordEdit = s => { chordEdit = s; };
// A new song left half-added when the app closed: keep it if it has words.
function settleNew(song) {
  delete song.isNew;
  if (!String(song.body || "").trim() && !song.title.trim()) data.songs.splice(data.songs.indexOf(song), 1);
  else if (!song.title.trim()) song.title = "Untitled";
  Tabs.save(data);
}
const editorMod = () => lazy("editor.js"), settingsMod = () => lazy("settings.js");
const newSong = (...a) => editorMod().then(m => m.newSong(...a));
const songEditor = (...a) => editorMod().then(m => m.songEditor(...a));
const prefetch = () => ["editor.js", "settings.js"].forEach(n => import(`./${n}?v=${VERSION}`).catch(() => {}));

// Feature modules load on first use. Each request names this release
// (?v=1.2.3) so the service worker answers from the same release as the app
// that's running, even if a newer one was saved in the background meanwhile.
// If a module still can't load, a reload brings everything onto one release.
const lazy = name => import(`./${name}?v=${VERSION}`).catch(err => {
  noteError(err, { quiet: true, where: name });
  toast("The Road was updated. Reload to use this.", null, { label: "Reload", fn: () => location.reload() });
  return new Promise(() => {}); /* the feature just doesn't open */
});

// Make it easier and Spark tone load on first use (aitools.js).
const aiTools = () => lazy("aitools.js");
function easierSheet(song) { aiTools().then(m => m.easierSheet(song)); }
function toneSheet(song) { aiTools().then(m => m.toneSheet(song)); }

// ---------- Song menu ----------
// Menu items you haven't tried yet carry a small dot until you do.
const NEW_IN_MENU = { loop: "practice", metro: "metronome", tuner: "tuner", share: "share", easy: "easier", tone: "tone" };
const newDot = k => used(k) ? "" : `<i class="newdot" data-new="${k}" aria-label="New"></i>`;
const menuHasNew = () => !tipsSeen().menu && Object.values(NEW_IN_MENU).some(k => !used(k));
/* What Play starts: the Apple Music recording alone, or the band (drums, click, bass) alone.
   A song with a linked recording defaults to the recording; "band" is remembered per song. */
const usesMusic = song => hasMusic(song) && song.backing !== "band";
function setBacking(song, mode, near, quiet) {
  if (mode === "band") song.backing = "band"; else delete song.backing;
  Tabs.save(data);
  if (scroll.on) { if (usesMusic(song)) { stopMetronome(); startMusic(song); } else { pauseMusic(); startMetronome(song); } }
  paintListenChip(song);
  if (quiet) return;
  const band = data.settings.metronome || data.settings.bass;
  toast(mode === "band" ? (band ? "Band: drums and bass, no recording" : "Band: turn on the metronome or bass in More") : "Recording: no drums or bass", near);
}
/* 4.20.0: the recording button beside Play (it was a chip under the title). With Apple Music on and a linked
   track it shows the cover, lit when Play starts the recording, and opens the Recording sheet; otherwise a note
   that finds a recording. The words stay for screen readers. */
function listenChip(song) {
  if (!hasMusic(song)) return `<button class="tl listen" id="listen" aria-label="${song.listen ? `Listen on ${esc(song.listen.service)}` : "Find a recording to listen to"}">${icon("note")}<span class="vh">${song.listen ? esc(song.listen.service) : "Listen"}</span></button>`;
  const rec = usesMusic(song), art = /^https:\/\//.test(song.listen.art || "") ? `<img src="${esc(song.listen.art)}" alt="">` : icon("note");
  const n = recordingNotes(song), look = !!(n.key || n.bpm);
  return `<button class="tl listen rec${rec ? " on" : ""}" id="listen" aria-label="${rec ? "Play starts the recording" : "Play starts the band"}.${look ? " The recording doesn't match the sheet." : ""} Open the recording">
    <span class="rc-art">${art}</span>${look ? '<i class="rc-look"></i>' : ""}<span class="vh">${rec ? "Recording" : "Band"}</span></button>`;
}
/* How the sheet differs from the measured recording (3.18.0): key, in half steps (the shortest move),
   and tempo when it's more than 6% off and not just half or double time. */
function recordingNotes(song) {
  const f = song.listen?.feel;
  if (!f || f.none || !hasMusic(song)) return {};
  const base = song.format === "tab" ? "" : (song.key || guessKey(song.body || ""));
  const gap = f.key && (f.keySure || 0) >= 0.5 && base ? keyGap(transposeKey(base, (song.transpose || 0) + soundOffset(song)), f.key) : 0;
  const r = song.bpm && f.bpm ? song.bpm / f.bpm : 1;
  const off = Math.min(Math.abs(r - 1), Math.abs(r - 2), Math.abs(r - 0.5)) > 0.06 && (f.sure || 0) >= 0.1;
  return { key: gap || 0, bpm: off };
}
function paintListenChip(song) {
  const el = $("listen");
  if (!el || viewing !== song) return;
  el.outerHTML = listenChip(song);
  $("listen").onclick = () => hasMusic(song) ? openRecording(song) : listenSheet(song);
}
function openRecording(song) {
  recordingSheet(song, {
    mode: () => usesMusic(song) ? "music" : "band",
    setMode: m => setBacking(song, m, null, true),
    reset: () => { delete song.syncs; Tabs.save(data); toast(song.timed?.at ? "Your fixes are cleared. The line timing stays" : "The page will start learning this song again"); },
    changed: () => { paintListenChip(song); paintLoop(song); },
    notes: () => recordingNotes(song),
    matchKey: () => { const g = recordingNotes(song).key; if (!g) return; song.transpose = Math.max(-5, Math.min(6, (song.transpose || 0) + g)); Tabs.save(data); if (viewing === song) { render(); paintListenChip(song); } toast(`Moved ${g > 0 ? "up" : "down"} ${Math.abs(g)} half step${Math.abs(g) === 1 ? "" : "s"} to match the recording`); },
    matchBpm: () => { const b = song.listen?.feel?.bpm; if (!b) return; song.bpm = b; Tabs.save(data); paintListenChip(song); toast(`Tempo ${b}, from the recording`); },
    spots: () => { songMarks(song); return { auto: marksCache.auto.map(m => m[0]), mine: (song.syncs || []).map(m => m[0]) }; }
  });
}
function toggleMetronome(song, near) {
  if (usesMusic(song) && !data.settings.metronome) { data.settings.metronome = true; return setBacking(song, "band", near); }
  data.settings.metronome = !data.settings.metronome; Tabs.save(data);
  if (scroll.on) data.settings.metronome || data.settings.bass ? startMetronome(song) : stopMetronome();
  toast(data.settings.metronome ? `Metronome on${song.bpm ? ` · ${song.bpm} BPM` : scroll.on ? "" : ". The tempo is looked up when you play"}` : "Metronome off", near);
}
function toggleBass(song, near) {
  if (usesMusic(song) && !data.settings.bass) { data.settings.bass = true; return setBacking(song, "band", near); }
  const on = data.settings.bass = !data.settings.bass; Tabs.save(data);
  if (scroll.on) on || data.settings.metronome ? startMetronome(song) : stopMetronome();
  toast(!on ? "Bass off" : song.format === "tab" ? "Bass on. It plays under songs with chords" : `Bass on${song.bpm ? ` · ${song.bpm} BPM` : scroll.on ? "" : ". The tempo is looked up when you play"}`, near);
}
/* The Tools sheet (4.2.0): everything for the song in one sheet that rises from the bottom, from the
   paused song and from a paused gig. Text size and the Gig's lines at the top, then Play along and The song. */
const GIG_KEEPS = ["metro", "bass", "speed"]; /* what can change without leaving a paused gig */
function songMenu(song, anchor, redrawSong) {
  const old = document.querySelector(".menu");
  if (old) { old.remove(); return; }
  /* Opening the sheet mid-song pauses it, so the scrolling doesn't close it. */
  if (scroll.on) stopScroll();
  markSeen("menu");
  document.querySelectorAll(".more .newdot").forEach(d => d.remove());
  const ez = song.easier, chords = song.format !== "tab", inGig = gigHooks.on;
  const lines = () => [4, 5, 6, "full"].includes(data.settings.gigLines) ? data.settings.gigLines : 5;
  const along = [
    { id: "speed", icon: "gauge", label: byLength() ? "Song length" : "Speed", hint: $("sv")?.textContent || "" },
    { id: "metro", icon: "metro", label: "Metronome", hint: data.settings.metronome ? `On · ${song.bpm || 90}` : "Off" },
    chords && { id: "bass", icon: "note", label: "Bass line", hint: data.settings.bass ? "On" : "Off" },
    { id: "duet", icon: "pick", label: "Play together" },
    { id: "tuner", icon: "fork", label: "Tuner", hint: songTuning(song) !== "standard" ? TUNINGS[songTuning(song)].name : "" },
    chords && bodyCapo(song.body) && { id: "capo", icon: "fretboard", label: song.capoOff ? "Capo back" : "Capo off", hint: song.capoOff ? `Was ${bodyCapo(song.body)}` : `Capo ${bodyCapo(song.body)}` },
    chords && (aiKey() || ez) && { id: "easy", icon: "wand", label: "Make it easier", hint: ez ? (ez.on ? `On${ez.capo ? ` · Capo ${ez.capo}` : ""}` : "Off") : "" },
    { id: "loop", icon: "loop", label: "Practice a section" },
    chords && !inGig && { id: "nn", icon: "fretboard", label: "Now and Next", hint: data.settings.diagrams === true ? "On" : "Off" }
  ].filter(Boolean);
  const theSong = [
    { id: "edit", icon: "edit", label: "Edit" },
    { id: "set", icon: "listplus", label: "Add to set" },
    { id: "share", icon: "share", label: "Share" },
    chords && (aiKey() || song.de) && { id: "de", icon: "chat", label: "German", hint: deHint.get(song.id) || "" },
    { id: "listen", icon: "note", label: song.listen ? "Listening link" : "Find a recording", hint: song.listen ? song.listen.service : "" },
    (aiKey() || song.tone) && { id: "tone", icon: "amp", label: "Spark tone", hint: song.tone ? "Saved" : "" },
    song.ai === "chart" && !firstLyric(song.body) && { id: "words", icon: "edit", label: "Add the words" }
  ].filter(Boolean);
  const m = document.createElement("div");
  m.setAttribute("role", "menu");
  m.setAttribute("aria-label", "Tools");
  const sheet = oneHandMQ.matches;
  m.className = "menu tools" + (sheet ? " msheet" : "");
  if (!sheet) {
    const r = anchor.getBoundingClientRect();
    m.style.bottom = Math.max(12, innerHeight - r.top + 10) + "px";
    m.style.right = Math.max(12, innerWidth - r.right) + "px";
  }
  const tile = it => `<button class="mrow tl" role="menuitem" data-m="${it.id}"${it.id === "speed" ? ' id="dialbtn"' : ""}><span class="mi">${icon(it.icon)}</span><span class="ml">${it.label}${NEW_IN_MENU[it.id] ? newDot(NEW_IN_MENU[it.id]) : ""}</span>${it.hint ? `<span class="mh">${esc(it.hint)}</span>` : ""}</button>`;
  const paint = () => {
    m.innerHTML = (sheet ? '<div class="grab" aria-hidden="true"></div>' : "") + `
      <div class="tl-head"><b>Tools</b>
        <div class="mrow size" role="group" aria-label="Text size"><span class="ml">Text size</span>
          <button class="sb" role="menuitem" data-d="-1" aria-label="Smaller text">${icon("minus")}</button><span class="v">${Math.round(song.size * 100)}%</span><button class="sb" role="menuitem" data-d="1" aria-label="Larger text">${icon("plus")}</button></div></div>
      ${chords ? `<div class="tl-lines" role="group" aria-label="Lines in a gig"><span class="ml">Lines in a gig</span><div class="seg mini">${[4, 5, 6, "full"].map(n => `<button role="menuitemradio" data-lines="${n}" class="${n === lines() ? "on" : ""}" aria-checked="${n === lines()}">${n === "full" ? "Full" : n}</button>`).join("")}</div></div>` : ""}
      ${inGig ? "" : `<div class="tl-prac"><span class="ml">Practice mode<small>${practicing(song) ? "Loop a section, slow it down" : "Off: plays straight through"}</small></span><button class="toggle ${practicing(song) ? "on" : ""}" role="switch" data-prac aria-checked="${practicing(song)}" aria-label="Practice mode"></button></div>`}
      <div class="tl-h">PLAY ALONG</div><div class="tl-grid">${along.map(tile).join("")}</div>
      ${inGig ? "" : `<div class="tl-h">THE SONG</div><div class="tl-grid">${theSong.map(tile).join("")}</div>`}`;
  };
  paint();
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener("click", outside, true); window.removeEventListener("scroll", close); };
  const outside = ev => { if (!m.contains(ev.target)) close(); };
  setTimeout(() => { document.addEventListener("click", outside, true); window.addEventListener("scroll", close, { passive: true }); });
  /* Swipe the sheet down to close it. */
  if (sheet) {
    let y0 = null;
    m.addEventListener("touchstart", ev => { y0 = m.scrollTop > 0 ? null : ev.touches[0].clientY; }, { passive: true }); /* scrolled down, a swipe scrolls the sheet */
    m.addEventListener("touchmove", ev => { if (y0 != null) m.style.transform = `translateY(${Math.max(0, ev.touches[0].clientY - y0)}px)`; }, { passive: true });
    m.addEventListener("touchend", ev => { const dy = y0 == null ? 0 : ev.changedTouches[0].clientY - y0; y0 = null; if (dy > 70) close(); else m.style.transform = ""; });
  }
  /* Keyboard: focus starts on the first item; arrows move, Escape closes. */
  m.addEventListener("keydown", ev => {
    const its = [...m.querySelectorAll("button")], i = its.indexOf(document.activeElement);
    if (ev.key === "Escape") { ev.preventDefault(); close(); anchor.focus(); }
    else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); its[(i + (ev.key === "ArrowDown" ? 1 : -1) + its.length) % its.length]?.focus(); }
    else return;
    ev.stopPropagation();
  });
  m.querySelector("[data-m]")?.focus({ preventScroll: true });
  m.onclick = ev => {
    ev.stopPropagation();
    const d = ev.target.closest("[data-d]");
    if (d) {
      song.size = Math.min(1.6, Math.max(0.7, +(song.size + (+d.dataset.d) * 0.1).toFixed(2)));
      Tabs.save(data); paint(); redrawSong();
      return;
    }
    if (ev.target.closest("[data-prac]")) { const on = !practicing(song); setPracticing(song, on); paint(); toast(on ? "Practice mode: pick a section, slow it down, build it up" : "Practice mode off", moreBtn()); return; }
    const ln = ev.target.closest("[data-lines]");
    if (ln) { data.settings.gigLines = ln.dataset.lines === "full" ? "full" : +ln.dataset.lines; Tabs.save(data); paint(); m.querySelector(`[data-lines="${ln.dataset.lines}"]`)?.focus({ preventScroll: true }); return; }
    const b = ev.target.closest("[data-m]");
    if (!b) return;
    const id = b.dataset.m;
    if (NEW_IN_MENU[id]) markUsed(NEW_IN_MENU[id]);
    close();
    if (gigHooks.on && !GIG_KEEPS.includes(id)) gigHooks.leave?.(); /* the rest happens on the song page */
    ({ set: () => addToSet(song), edit: () => songEditor(song),
       speed: () => songSpeed?.(),
       capo: () => { song.capoOff = !song.capoOff; if (!song.capoOff) delete song.capoOff; Tabs.save(data); redrawSong(); toast(song.capoOff ? "Capo off: the chords are in the key the song sounds in" : `Capo ${bodyCapo(song.body)} is back`); },
       easy: () => aiKey() ? easierSheet(song) : (ez.on = !ez.on, Tabs.save(data), redrawSong()),
       tone: () => toneSheet(song), share: () => shareSong(song), duet: () => duetSheet(song), gig: () => playGig(song.id), loop: () => { setPracticing(song, true); startLoopPick(song); }, tuner: () => openTuner(songTuning(song)),
       nn: () => toggleNN(),
       listen: () => listenSheet(song, true),
       words: () => wordsFor(song),
       de: () => songDeOpen?.(),
       bass: () => toggleBass(song, moreBtn()),
       metro: () => toggleMetronome(song, moreBtn()) })[id]?.();
  };
}
/* Now and Next: the chord you're on and the next one, in the bar while the song plays. */
function toggleNN() {
  const on = data.settings.diagrams !== true;
  data.settings.diagrams = on;
  Tabs.save(data);
  diag.nn = on && diag.seq.length > 0;
  diag.idx = null;
  updateDiagrams();
  toast(on ? "Now and Next on" : "Now and Next off", moreBtn());
}
/* Tools, from the paused gig. */
function openTools(anchor) { if (viewing) songMenu(viewing, anchor, () => redraw?.()); }

// ---------- Find songs you don't have yet ----------
// No match in the library: search the web for a chord sheet, then come back and
// paste it (Tabs offers to as soon as you return). Or, with an API key, get a
// chord chart from AI: chords and structure only, never lyrics.
let pendingFind = null; /* { q, at } after sending someone out to look */
const FIND_SITES = [
  ["web", "Search the web", q => `https://www.google.com/search?q=${encodeURIComponent(q + " chords")}`],
  ["ug", "Ultimate Guitar", q => `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`],
  ["chordify", "Chordify", q => `https://chordify.net/search/${encodeURIComponent(q)}`]
];
// With matches in the library it still shows, smaller, under them ("Find more").
export function findCard(q, more = false) {
  return `<div class="findcard${more ? " more" : ""}">
    <div class="fc-t">${more ? `Find “${esc(q.trim())}” elsewhere` : `“${esc(q.trim())}” isn't in your library yet`}</div>
    ${more ? "" : `<p class="fc-s">Find a chord sheet, copy it, and come back. The Road will offer to add what you copied.</p>`}
    <div class="fc-b">${FIND_SITES.map(([k, l]) => `<button class="chip" data-find="${k}">${icon(k === "web" ? "search" : "link")}${l}</button>`).join("")}</div>
    ${aiKey() ? `<button class="fc-ai" id="fc-ai">${icon("wand")}<span><b>Get the song</b>Chords, words and tempo in one go</span>${icon("chev", "chev")}</button>` : ""}
  </div>`;
}
export function bindFind(list) {
  list.querySelectorAll("[data-find]").forEach(b => b.onclick = () => {
    const site = FIND_SITES.find(x => x[0] === b.dataset.find);
    pendingFind = { q: query.trim(), at: Date.now() };
    window.open(site[2](query.trim()), "_blank", "noopener");
  });
  $("fc-ai")?.addEventListener("click", () => getSong(query.trim()));
}
// Back from looking: offer to paste what was copied (reading the clipboard needs a tap).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !pendingFind || Date.now() - pendingFind.at > 30 * 60e3) return;
  if (route().name !== "library" || document.querySelector(".backpaste")) return;
  const q = pendingFind.q;
  const b = document.createElement("div");
  b.className = "backpaste glass float";
  b.innerHTML = `<span>Copied the chords for “${esc(q)}”?</span><button class="btn sm primary" id="bp-go">Paste</button><button class="sb" id="bp-x" aria-label="Dismiss">${icon("x")}</button>`;
  document.body.appendChild(b);
  $("bp-x").onclick = () => { b.remove(); pendingFind = null; };
  $("bp-go").onclick = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch {}
    if (text.trim().split("\n").filter(l => l.trim()).length < 2) return toast("Nothing to paste yet. Copy the chord sheet first, or press and hold the search bar and tap Paste.");
    b.remove(); pendingFind = null;
    if (searching) document.querySelector("#qcancel")?.click();
    showPasteCard(detectPaste(text));
  };
});

// Add the words to a chord chart already in the library (see findai.js).
function wordsFor(song) {
  findAI().then(m => m.wordsSheet(song.body, { title: song.title, ok: "Save" }, merged => {
    const was = song.body;
    song.body = merged; delete song.loop; Tabs.save(data); render();
    toast("Words added. Check the chord spots by ear", null, { label: "Undo", fn: () => { song.body = was; Tabs.save(data); render(); } });
  }));
}
// German practice: songs with words, when there's a key or a translation.
// The chip under the title is its home in every layout; it shows progress
// while a translation runs in the background (german.js keeps deJobs).
const deJobs = new Map(), deHint = new Map();
let songDeOpen = null; /* the open song's German: the dial, or the sheet when it needs work (in More) */
const deEligible = song => !!firstLyric(song.body) && (!!aiKey() || !!song.de);
function paintDeChip(song, fresh, lvl) {
  const job = deJobs.get(song.id);
  /* 4.20.0: German lives in Tools; its tile shows where it stands */
  deHint.set(song.id, !deEligible(song) ? "" : job ? `${job.done} of ${job.total}` : !song.de ? "" : !fresh ? "Update" : song.de.lines?.some(l => !l) ? "Finish" : DE_LEVELS[lvl]);
  const dc = $("dechip");
  if (!dc) return;
  dc.hidden = !deEligible(song);
  dc.classList.toggle("on", !!(lvl && fresh) || !!job);
  dc.classList.toggle("busy", !!job);
  dc.style.setProperty("--p", job ? (job.done / Math.max(1, job.total)).toFixed(2) : 0);
  dc.innerHTML = `<b>DE</b>${job ? `${job.done} of ${job.total} lines` : !song.de ? "German" : !fresh ? "Update" : song.de.lines?.some(l => !l) ? "Finish" : DE_LEVELS[lvl]}`;
}
// A translation's progress: the chip now; the sheet once lines land (not
// mid-song: it waits for a pause so the scrolling doesn't jump).
let deWaiting = 0;
document.addEventListener("tabs:de-progress", e => {
  if (!viewing || viewing.id !== e.detail?.id || route().name !== "song") return;
  const blocks = parseBlocks(viewing.body || ""), fresh = viewing.de && viewing.de.src === deSource(sungText(blocks));
  paintDeChip(viewing, fresh, viewing.deLevel || 0);
  if (!e.detail.lines) return;
  if (!scroll.on) { redraw?.(); return; }
  clearInterval(deWaiting);
  deWaiting = setInterval(() => { if (!scroll.on) { clearInterval(deWaiting); if (viewing && route().name === "song") redraw?.(); } }, 800);
});
// German practice loads on first use (german.js). A line translated again
// (Report on a word card) asks the song to redraw.
document.addEventListener("tabs:redraw", () => { if (viewing && route().name === "song") redraw?.(); });
// German practice loads on first use (german.js).
function germanSheet(...args) { lazy("german.js").then(m => m.germanSheet(...args)); }
// Chord charts and "What can I play next?" load on first use (findai.js).
export const findAI = () => lazy("findai.js");
// Leave search mode (used when a song is added from a chart).
function getSong(...args) { findAI().then(m => m.getSong(...args)); }
export function nextSongs() { findAI().then(m => m.nextSongs()); }

// ---------- Tuner ----------
// Listens through the microphone and shows how far each string is from its note.
// It shows up where tuning happens: a button on the library (marked when you
// haven't tuned for a few hours), a chip on songs in another tuning, the set
// page, and the Next up card when the next song is in a different tuning.
const TUNED_FOR = 3 * 3600e3;
const songTuning = s => (s && (s.tuning || detectTuning(s.body))) || "standard";
const tunedRecently = () => Date.now() - (data.settings.lastTuned || 0) < TUNED_FOR;
// The tuner itself loads on first use (tuner.js).
onLeave(() => closeTuner());
let tunerMod = null;
const loadTuner = async () => (tunerMod ||= await lazy("tuner.js"));
function openTuner(...args) { markUsed("tuner"); loadTuner().then(m => m.openTuner(...args)); }
function closeTuner() { tunerMod?.closeTuner(); }

// "Chords in this song": each chord once, in order of first use, to learn before playing.
function renderStrip(sheet, isChords, song) {
  const box = $("strip");
  if (!box) return;
  const names = isChords ? [...new Set([...sheet.querySelectorAll(".c[data-ch]")].map(el => el.dataset.ch))] : [];
  const easyBtn = `<span class="n">${names.length}</span>`;
  /* A chord you haven't learned yet is marked NEW, once you know a few (4.2.0). */
  const known = knownChords(data), fresh = n => known.size > 0 && !known.has(n);
  box.innerHTML = names.length ? `
    <div class="strip-h"><span>Chords</span>${easyBtn}</div>
    <div class="strip" role="list">${names.map(n =>
      `<button class="scard${fresh(n) ? " new" : ""}" role="listitem" data-name="${esc(n)}" aria-label="${esc(n)}${fresh(n) ? ", new to you" : ""}: show where it's played"><b class="sc-n">${esc(n)}</b>${fresh(n) ? '<small class="sc-new">NEW</small>' : ""}${chordSVG(n)}</button>`).join("")}</div>` : "";
}

/* The song map under the chips (4.2.0): each section in its Stage Gel, as long as it is in the song.
   Tap one to go there; Play starts from where the page is. */
function paintSecbar() {
  const bar = $("secbar"), sheet = $("sheet");
  if (!bar || !sheet) return;
  const secs = [...sheet.querySelectorAll(":scope > .sec")];
  if (secs.length < 2) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  const tops = secs.map(el => el.offsetTop), end = Math.max(tops[tops.length - 1] + 1, sheet.scrollHeight);
  bar.innerHTML = secs.map((el, i) => {
    const name = el.textContent.trim(), w = Math.max(1, (tops[i + 1] ?? end) - tops[i]);
    return `<button class="sbar gl-${gelOf(name)}" data-i="${i}" style="flex:${w}" aria-label="Go to ${esc(name)}"><span>${esc(name)}</span></button>`;
  }).join("");
  bar.onclick = e => {
    const b = e.target.closest(".sbar"), el = b && secs[+b.dataset.i];
    if (!el?.isConnected) return;
    hold.active = true; releaseSoon(900);
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - innerHeight * READ_AT), behavior: calm() ? "auto" : "smooth" });
    diag.pinned = null;
  };
}

function clearSel() {
  document.querySelectorAll(".sheet .c.sel, .strip .scard.sel").forEach(el => el.classList.remove("sel"));
}

function showChordPop(target) {
  const sheet = $("sheet");
  sheet.querySelectorAll(".dpop").forEach(el => el.remove());
  clearSel();
  if (!target) return;
  document.querySelectorAll(".strip .scard").forEach(c => c.classList.toggle("sel", c.dataset.name === target.dataset.ch));
  const box = sheet.getBoundingClientRect(), r = target.getBoundingClientRect();
  const s = 1.45, w = CARD_W * s, h = CARD_H * s;
  const cx = r.left - box.left + Math.min(r.width, 40) / 2;
  const left = Math.max(0, Math.min(sheet.clientWidth - w, cx - w / 2));
  const pop = document.createElement("div");
  pop.className = "dpop";
  pop.style.cssText = `left:${left}px;top:${r.top - box.top - h - 10}px;width:${w}px;height:${h}px`;
  pop.innerHTML = chordSVG(target.dataset.ch, s) + `<i class="dptr" style="left:${Math.min(w - 10, Math.max(10, cx - left))}px"></i>`;
  sheet.appendChild(pop);
  target.classList.add("sel");
}
document.addEventListener("click", e => {
  if (route().name !== "song" || !$("sheet") || chordEdit) return;
  if (loopPick && e.target instanceof Element) {
    const el = e.target.closest(".sheet > *");
    if (el && !el.classList.contains("prow") && !el.classList.contains("dpop") && !el.classList.contains("gap")) { e.preventDefault(); pickLoopLine(el); }
    return;
  }
  /* While playing, a tap anywhere on the page pauses, so there's no button to aim for. */
  /* (A target no longer in the page was a button that redrew itself, like play.) */
  if (scroll.on && e.target instanceof Element && e.target.isConnected && !e.target.closest("button, a, input, select, label, .dock, .menu, .panel, .scrim, .nextup, .chead, .loopbanner, .rc, .ringx, .dial")) {
    document.querySelector(".tappause")?.remove();
    markUsed("pause");
    stopScroll();
    const g = document.createElement("div");
    g.className = "tappause";
    g.innerHTML = icon("pause");
    document.body.appendChild(g);
    setTimeout(() => g.remove(), 700);
    return;
  }
  // Strip card: outline it and mark every place that chord is played.
  const sc = e.target instanceof Element && e.target.closest(".strip .scard");
  if (sc) {
    const on = !sc.classList.contains("sel");
    showChordPop(null);
    if (on) {
      sc.classList.add("sel");
      document.querySelectorAll(".sheet .c[data-ch]").forEach(c => c.classList.toggle("sel", c.dataset.ch === sc.dataset.name));
    }
    return;
  }
  /* A German word: its card (meaning, gender, why this form). */
  const dw = e.target instanceof Element && e.target.closest(".sheet .de[data-de]");
  if (dw && !scroll.on && viewing) { showChordPop(null); lazy("german.js").then(m => m.wordCard(viewing, dw)); return; }
  const chord = e.target instanceof Element && e.target.closest(".sheet .c[data-ch]");
  if (chord && !scroll.on) {
    const same = chord.classList.contains("sel");
    showChordPop(same ? null : chord);
    if (!same) chordTapped(chord);
    return;
  }
  if (!(e.target instanceof Element && e.target.closest(".dpop"))) showChordPop(null);
  // Tap a line while paused: it becomes the current line, and play starts from it.
  const block = e.target instanceof Element && e.target.closest(".sheet > *");
  if (block && !scroll.on && isLine(block) && !block.classList.contains("prow") && !block.classList.contains("dpop") && diag.focus === "always") {
    diag.pinned = block;
    diag.armed = true;
    applyPaused();
    markUsed("line");
  }
});

let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (redraw && route().name === "song" && $("sheet")) redraw(); }, 120);
});

// Manual scrolling while auto-scroll plays: hold the auto-scroll while the finger
// (or momentum, or a wheel) is moving, then carry on from wherever the reader left it.
const hold = { active: false, touching: false, timer: 0 };
function releaseSoon(ms) {
  clearTimeout(hold.timer);
  hold.timer = setTimeout(() => {
    if (hold.touching) return;
    /* A hand moved the page while the recording played. A small move is a correction ("this line is
       what I hear"): the place and the recording's time are saved as a mark for the song. A big move is a
       jump: the recording goes to that place. */
    if (hold.active && scroll.on && viewing && usesMusic(viewing) && musicClock(viewing) !== null) {
      const song = viewing, clock = musicClock(song), len = recSecs(song), range = Math.max(1, sheetRange());
      if (Math.abs(scrollY - musicY(song, clock)) < innerHeight * 0.6) {
        const before = (song.syncs || []).length;
        song.syncs = addSync(song.syncs, scrollY / range, clock, len);
        if (!song.syncs.length) delete song.syncs;
        Tabs.save(data);
        toast(before ? "Synced here" : "Synced here. The page will follow this next time. Reset in More");
      } else {
        const sec = musicSec(song, scrollY);
        musicSync.target = sec; musicSync.until = performance.now() + 3000; musicSync.clock = -1;
        seekMusic(song, sec);
      }
    }
    hold.active = false;
  }, ms);
}
window.addEventListener("touchstart", e => {
  if (e.target instanceof Element && e.target.closest(".dock")) return;
  hold.touching = true; hold.active = true; clearTimeout(hold.timer);
}, { passive: true });
window.addEventListener("touchend", () => { hold.touching = false; releaseSoon(180); }, { passive: true });
window.addEventListener("touchcancel", () => { hold.touching = false; releaseSoon(180); }, { passive: true });
window.addEventListener("wheel", () => { hold.active = true; releaseSoon(250); }, { passive: true });

// Compact header fade: scrolling up reveals it gradually, scrolling down hides it.
// Near the top the full header is in view, so the compact one hands back to it.
const fab = { lastY: 0, reveal: 1 };
function updateHeader(d) {
  const bar = $("chead");
  if (!bar) return;
  const y = window.scrollY;
  const meta = $("meta");
  const handoff = meta ? meta.offsetTop + meta.offsetHeight - 56 : 120; // full header gone above this
  if (y < 60) fab.reveal = 1;
  else if (d < 0) fab.reveal = Math.min(1, fab.reveal - d / 140);
  else if (d > 0) fab.reveal = Math.max(0, fab.reveal - d / 60);
  const past = Math.min(1, Math.max(0, (y - handoff) / 40)); // soft cross-fade at the handoff
  const op = fab.reveal * past;
  bar.style.opacity = op.toFixed(3);
  const live = op > 0.15;
  bar.style.pointerEvents = live ? "auto" : "none";
  bar.setAttribute("aria-hidden", live ? "false" : "true");
  bar.querySelectorAll("button").forEach(b => b.tabIndex = live ? 0 : -1);
}
onScroll(() => {
  const y = window.scrollY;
  const d = y - fab.lastY;
  fab.lastY = y;
  if (hold.active && !hold.touching) releaseSoon(180); // momentum still moving
  updateHeader(d);
  updateDiagrams();
});

// ---------- Speed ----------
const byLength = () => data.settings.speedMode !== "multiplier";
const songLength = song => song.duration || data.settings.startLength || 210;
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
// Song length style: the whole song, first line to last, crosses the reading point
// in the song's length. 1x style: a fixed rate per song.
const sheetRange = () => { const lines = diag.blocks.filter(b => b.el.isConnected); return lines.length > 1 ? lines[lines.length - 1].y - lines[0].y : document.documentElement.scrollHeight - innerHeight; };
/* With the recording playing, the page is tied to its clock: the whole sheet crosses the reading line in the
   recording's length, so scroll position and time convert both ways. */
const recSecs = song => recLength(song) || songLength(song);
/* The sheet's lines as text, for matching to timed lyrics (chord names and translations left out). */
function lyricLines() {
  return sheetLines().map((el, i) => {
    if (!el.classList.contains("ly") && !el.classList.contains("pr")) return null;
    const c = el.cloneNode(true);
    c.querySelectorAll(".c, .de-en").forEach(x => x.remove());
    const text = c.textContent.replace(/\s+/g, " ").trim();
    return text ? { i, text } : null;
  }).filter(Boolean);
}
/* Where each timed line sits down the sheet (0 to 1): the place that puts it on the reading line. */
const lineWhere = (el, range) => Math.max(0, scrollY + el.getBoundingClientRect().top - innerHeight * READ_AT) / range;
const marksCache = { key: "", marks: [], auto: [] };
function songMarks(song) {
  const range = Math.max(1, sheetRange()), at = song.timed?.at || [];
  const key = `${song.id}|${Math.round(range)}|${at.length}|${JSON.stringify(song.syncs || [])}`;
  if (key !== marksCache.key) {
    const lines = sheetLines();
    const auto = at.map(([i, sec]) => lines[i] ? [lineWhere(lines[i], range), sec] : null).filter(Boolean);
    marksCache.key = key; marksCache.auto = auto; marksCache.marks = mergeSyncs(auto, song.syncs);
  }
  return marksCache.marks;
}
const musicY = (song, sec) => syncWhere(songMarks(song), sec, recSecs(song)) * sheetRange();
const musicSec = (song, y) => syncSeconds(songMarks(song), y / Math.max(1, sheetRange()), recSecs(song));
const musicSync = { at: 0, clock: -1, target: -1, until: 0 };
function pxPerSecond(song) {
  if (!byLength() && !scroll.duet) return song.speed * 0.6; /* together: both fit the song's length */
  const lines = diag.blocks.filter(b => b.el.isConnected);
  const range = lines.length > 1 ? lines[lines.length - 1].y - lines[0].y : document.documentElement.scrollHeight - innerHeight;
  return Math.max(4, range / songLength(song));
}

// One bar of count-in before scrolling: a bar of beats (four unless the song says) at the song's tempo (90 if unset),
// shown large and quiet over the reading point, in the metronome's sound.
/* The count-in uses the metronome's sound: with drums, the drummer counting
   off on the hi-hat; otherwise the click. */
function click(accent) {
  const audio = sound();
  if (!audio) return;
  if (metroDrums()) drum("hat", audio.currentTime + 0.01, accent ? 1.4 : 1);
  else clickAt(audio.currentTime + 0.01, accent);
}
function countIn(song) {
  return new Promise(resolve => {
    const beat = 60000 / ((song.bpm || 90) * loopFactor(song) * metroPace(song)); /* the same pace as the metronome */
    const el = document.createElement("div");
    el.className = "countin";
    el.style.top = (innerHeight * READ_AT - 60) + "px";
    document.body.appendChild(el);
    const beats = song.beats || 4;
    let n = beats;
    const tick = () => {
      if (!scroll.on) { el.remove(); return resolve(false); }
      if (n === 0) { el.remove(); return resolve(true); }
      el.textContent = beats + 1 - n;
      el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
      click(n === beats);
      n--;
      scroll.countTimer = setTimeout(tick, beat);
    };
    tick();
  });
}

// Wake the player controls on any touch; they fade again after 3 idle seconds.
let idleTimer = 0;
function wakeControls() {
  const player = document.querySelector(".player");
  player?.classList.remove("idle");
  clearTimeout(idleTimer);
  if (scroll.on) idleTimer = setTimeout(() => document.querySelector(".player")?.classList.add("idle"), 3000);
}
["touchstart", "pointerdown", "wheel", "keydown"].forEach(ev => window.addEventListener(ev, () => { if (scroll.on) wakeControls(); }, { passive: true, capture: true }));

// A quiet note at the end of the sheet when a song is played through. No badges or streaks.
const nth = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
function endMoment(song) {
  document.querySelector(".endnote")?.remove();
  const total = playCount(song), week = playsThisWeek(song);
  const when = total === 1 ? "for the first time" : week === 1 ? "· first time this week" : `· ${nth(week)} time this week`;
  const el = document.createElement("div");
  el.className = "endnote";
  el.innerHTML = `${icon("check")}<span>Played through ${when}</span>`;
  $("sheet")?.after(el);
}

/* The streak moment: once a day, after the first song played to its end.
   Not on stage, in Play together, or in the middle of a set. */
function streakSoon(song) {
  const st = data.settings, day = todayKey();
  if (st.streakMoment === false || scroll.duet || setCtx || gigHooks.on || st.streakShown === day) return;
  st.streakShown = day; Tabs.save(data);
  setTimeout(() => {
    if (viewing !== song || route().name !== "song") return;
    lazy("profile.js").then(m => m.showStreak(streakMoment(playSongs(data), Date.now(), data.journal?.best)));
  }, 1400);
}
let playsHere = 0; /* plays since the app opened, for pacing tips */
async function startScroll(song, opts = {}) {
  document.querySelector(".endnote")?.remove();
  /* Count in only when starting from the top: the song's first line is on screen. */
  const first = $("sheet")?.querySelector(":scope > .pr, :scope > .ly, :scope > .tab, :scope > .crow");
  const fr = first?.getBoundingClientRect();
  const atTop = !fr || (fr.bottom > 0 && fr.top < innerHeight);
  scroll.on = true; scroll.last = 0; scroll.carry = 0; scroll.bottomSince = 0; scroll.logged = false; scroll.duet = !!opts.duet;
  /* A play is judged over the run: pausing and playing on adds up, another song or a credited play starts it again. */
  if (scroll.runId !== song.id || scroll.credited) { scroll.cover = 0; scroll.runMs = 0; scroll.runId = song.id; scroll.credited = false; }
  document.body.classList.add("playing");
  foldApi?.mode?.(); /* the bar folds into Play's corner */
  playsHere++;
  setTimeout(() => {
    if (scroll.on && viewing === song && coachTip("pause")) demoPause();
  }, 2500);
  wakeControls();
  showChordPop(null);
  $("sheet")?.querySelectorAll(".prow").forEach(el => el.remove());
  diag.rowKey = null;
  if (activeLoop(song)) {
    const lines = sheetLines(), first = lines[song.loop.a], last = lines[song.loop.b], line = innerHeight * READ_AT;
    if (first && last && (first.getBoundingClientRect().top > line + 4 || last.getBoundingClientRect().bottom < line)) diag.pinned = first;
    loopRun = { pass: 0 }; paintLoop(song);
  }
  if (diag.pinned?.isConnected) {
    // Glide the tapped line to the reading point, then carry on from there.
    const target = window.scrollY + diag.pinned.getBoundingClientRect().top - window.innerHeight * READ_AT;
    hold.active = true; releaseSoon(800);
    window.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }
  diag.pinned = null; diag.scrolling = false;
  updateDiagrams();
  const btn = $("play");
  btn.innerHTML = playFace(true);
  btn.setAttribute("aria-label", "Pause auto-scroll");
  try { scroll.lock = await navigator.wakeLock?.request("screen"); } catch {}
  if (metroOn() || bassOn()) {
    if (!song.bpm) tempoFor(song); /* look it up during the count-in */
    grooveFor(song); /* and how it feels, which joins in when it arrives */
    if (metroOn() && metroDrums()) drumsFor(song); /* and drums written for it */
  }
  /* Play together always counts in, so both phones start scrolling on the same beat. */
  if ((scroll.duet || data.settings.countIn !== false) && atTop && !(await countIn(song))) return;
  if (usesMusic(song)) startMusic(song, playFromSec(song), recRate(song)); else startMetronome(song);
  const tick = t => {
    if (!scroll.on) return;
    if (scroll.last && !hold.active) {
      scroll.ms = (scroll.ms || 0) + Math.min(250, t - scroll.last); /* time on guitar, for Your playing */
      scroll.runMs = (scroll.runMs || 0) + Math.min(250, t - scroll.last);
      if (scroll.ms - (scroll.saved || 0) > 20000) { (practicing(song) ? journalPractice : journalTime)(data, (scroll.ms - (scroll.saved || 0)) / 1000); scroll.saved = scroll.ms; Tabs.save(data); } /* every 20 s, so closing the app mid-song loses nothing */
      if (loopCheck(song)) { scroll.last = t; scroll.raf = requestAnimationFrame(tick); return; }
      /* The recording is the clock while it plays: the page goes where its time says, so a pause, a stall
         or a seek in Apple Music moves the scroll with it. Otherwise the timer carries the page. */
      let clock = usesMusic(song) ? musicClock(song) : null;
      /* just seeked: wait for the recording to arrive before following it again */
      if (clock !== null && musicSync.target >= 0) { if (Math.abs(clock - musicSync.target) < 2 || t > musicSync.until) musicSync.target = -1; else clock = -1; }
      let px;
      if (clock === -1) { px = 0; clock = 0; } else if (clock !== null) {
        if (clock !== musicSync.clock) { musicSync.clock = clock; musicSync.at = t; } /* the clock moves in steps: fill in between */
        const want = musicY(song, clock + (t - musicSync.at) / 1000), diff = want - scrollY;
        px = Math.abs(diff) > innerHeight ? Math.round(diff) : Math.round(diff * 0.25);
        scroll.carry = 0;
      } else {
        scroll.carry += (t - scroll.last) / 1000 * pxPerSecond(song) * loopFactor(song);
        px = Math.floor(scroll.carry);
      }
      if (px) { window.scrollBy(0, px); if (clock === null) scroll.carry -= px; scroll.cover = (scroll.cover || 0) + px; nextLine(); }
      /* The end is the last line reaching the reading line. If the page runs out first, add room. */
      const end = endScroll();
      if (!activeLoop(song) && end >= 0 && scrollY < end - 2 && innerHeight + scrollY >= document.documentElement.scrollHeight - 2) endRoom(end - scrollY);
      // At the end: a play counts if auto-scroll carried the page most of the way (see playCredited).
      // Then wait a few seconds (the reader may scroll back up), then stop.
      if (!activeLoop(song) && end >= 0 && scrollY >= end - 2) {
        const expectedMs = (end < 40 ? songLength(song) : end / (pxPerSecond(song) * loopFactor(song))) * 1000;
        if (!scroll.logged && playCredited({ end, cover: scroll.cover, ms: scroll.runMs, expectedMs })) {
          scroll.logged = true; scroll.credited = true; Tabs.logPlay(data, song); curPaintStat?.(); endMoment(song); streakSoon(song); gigHooks.credited?.(song); if (!gigHooks.on) { questToast(); bandToast(); } if (setRun && setCtx?.id === setRun.id) setRun.played.add(song.id); if (setCtx) nextUp();
        }
        /* A sheet that fits the screen has only the clock to go by, so it plays on until it counts. */
        if (scroll.logged || end >= 40) {
          scroll.bottomSince ||= t;
          if (t - scroll.bottomSince > 4000) return stopScroll();
        }
      } else scroll.bottomSince = 0;
    }
    scroll.last = t;
    scroll.raf = requestAnimationFrame(tick);
  };
  scroll.raf = requestAnimationFrame(tick);
}

/* Where the page is scrolled when the song's last line reaches the reading line, or -1 with no lines. */
function endScroll() {
  const last = [...diag.blocks].reverse().find(b => b.el.isConnected && isLine(b.el));
  return last ? Math.max(0, Math.round(last.el.getBoundingClientRect().top + scrollY - innerHeight * READ_AT)) : -1;
}
/* Space under the sheet so the last line can scroll up to the reading line. Removed when playing stops. */
function endRoom(more) {
  let room = $("endroom");
  if (!room) { room = document.createElement("div"); room.id = "endroom"; room.setAttribute("aria-hidden", "true"); $("sheet")?.after(room); }
  room.style.height = ((parseFloat(room.style.height) || 0) + Math.ceil(more) + 4) + "px";
}
onLeave(() => stopScroll());
function stopScroll() {
  $("endroom")?.remove();
  const was = scroll.on;
  scroll.on = false; scroll.duet = false;
  if (scroll.ms - (scroll.saved || 0) > 1000) { (practicing(viewing) ? journalPractice : journalTime)(data, (scroll.ms - (scroll.saved || 0)) / 1000); Tabs.save(data); }
  scroll.ms = 0; scroll.saved = 0;
  stopMetronome();
  if (was) pauseMusic();
  clearTimeout(scroll.countTimer);
  document.querySelectorAll(".countin").forEach(el => el.remove());
  document.body.classList.remove("playing");
  if (was) gigHooks.stopped?.();
  foldApi?.mode?.(); /* and unfolds when the song stops */
  wakeControls();
  cancelAnimationFrame(scroll.raf);
  scroll.lock?.release?.().catch(() => {});
  scroll.lock = null;
  const btn = $("play");
  if (btn) { btn.innerHTML = playFace(false, viewing); btn.setAttribute("aria-label", playLabel(viewing || {}, false)); }
  updateDiagrams();
  if (btn) { diag.armed = true; showPausedRow(); }
  /* After playing: the first pause shows starting from a line; a later one, Now and Next. */
  if (was && btn && !chordEdit) setTimeout(() => {
    if (scroll.on || chordEdit || route().name !== "song" || layer.innerHTML || document.querySelector(".menu, .ringx, .dial")) return;
    if (tipDue("line")) { if (coachTip("line")) demoLine(); return; }
    if (playsHere >= 2 && !diag.nn && data.settings.diagrams !== true && coachTip("nn")) demoNN();
  }, 700);
}

// ---------- First-time guide ----------
// A sample song on first launch, and one-time hints placed on the real controls.
const SAMPLE = {
  title: "Harbor Lights", artist: "Sample song", format: "chords", key: "G", bpm: 96, duration: 150, sample: true,
  body: `[Intro]
G  D  Em  C

[Verse 1]
G              D              Em
Saw the harbor lights come on at six
C                  G              D
Gulls were arguing over old fish tricks
G              D              Em
You said meet me where the ferry turns
C                 G                 D
I said fine, I'll bring whatever burns

[Pre-Chorus]
Am              C          G
Nobody waits like you do
Am                 Bm         D
Watching the tide come through

[Chorus]
G          D          Em
Oh, the harbor lights never sleep
C              G               D
They keep the secrets that the sailors keep
G          D          Em
Hold the line, love, the night is deep
C          G          D       G
And the morning's only borrowed`
};
function firstLaunch() {
  if (data.settings.sampleAdded || data.songs.length) return;
  Tabs.addSong(data, { ...SAMPLE });
  data.settings.sampleAdded = true;
  Tabs.save(data);
}

// ---------- Router ----------
// A screen that fails to draw shows a way back instead of a blank page.
function render() {
  try { renderRoute(); }
  catch (e) {
    noteError(e, { quiet: true });
    layer.innerHTML = "";
    app.innerHTML = `<div class="oops"><b>This screen didn't open</b><p>Your songs are safe. Going back usually fixes it. If it keeps happening, copy the details and send them along.</p>
      <div class="actions"><button class="btn" id="oops-copy">Copy details</button><button class="btn primary" id="oops-home">Songbook</button></div></div>`;
    $("oops-copy").onclick = copyDiagnostics;
    $("oops-home").onclick = () => { if (route().name === "library") location.reload(); else go("#/"); };
  }
}
function renderRoute() {
  const r = route();
  leaveHooks.forEach(fn => fn(r));
  if (r.name === "road" || r.name === "library") lastHome = r.name;
  document.body.classList.toggle("is-home", r.name === "road");
  /* 4.0.0: the tab bar along the bottom of the main pages (not a lesson, a song or Settings) */
  const tabbed = ["road", "tour", "charts", "band", "practice", "you", "merch"].includes(r.name) && !(r.name === "practice" && r.id);
  if (!tabbed) document.body.classList.remove("tabbed");
  else lazy("hud.js").then(m => { if (route().name === r.name) m.paintTabs(m.tabFor(r.name)); });
  app.classList.remove("viewer");
  layer.innerHTML = "";
  /* Old links: #/add and #/edit/<id> open the editor. */
  if (r.name === "add") { history.replaceState(null, "", "#/"); return newSong(); }
  if (r.name === "edit") { openEdit = { id: r.id, view: "text" }; history.replaceState(null, "", "#/song/" + encodeURIComponent(r.id)); return renderRoute(); }
  if (r.name === "song") {
    renderViewer(r.id);
    if (sectionNext === r.id) { sectionNext = null; setTimeout(() => { const s = viewing, first = s?.id === r.id && s.loop && sheetLines()[s.loop.a]; if (first && !scroll.on) window.scrollTo({ top: Math.max(0, scrollY + first.getBoundingClientRect().top - innerHeight * READ_AT), behavior: "auto" }); }, 200); }
    if (playNext === r.id) { playNext = null; setTimeout(() => { if (viewing?.id === r.id && !scroll.on) $("play")?.click(); }, 450); }
    if (gigNext?.id === r.id) setTimeout(openGigNow, 350);
    const want = openEdit;
    openEdit = null;
    const song = viewing?.id === r.id && want?.id === r.id ? viewing : null;
    if (song) songEditor(song, want.view);
  }
  else if (r.name === "settings" || r.name === "trash") settingsMod().then(m => { if (route().name !== r.name) return; (r.name === "settings" ? m.renderSettings : m.renderTrash)(); window.scrollTo(0, 0); });
  else if (r.name === "you") lazy("profile.js").then(m => { if (route().name === "you") { m.renderProfile(); window.scrollTo(0, 0); } });
  else if (r.name === "practice") lazy("practice.js").then(m => { if (route().name === "practice") { r.id ? m.renderSession(r.id) : m.renderRehearse(); window.scrollTo(0, 0); } });
  else if (r.name === "playmap") lazy("playmap.js").then(m => { if (route().name === "playmap") { m.renderPlayMap(); window.scrollTo(0, 0); } });
  else if (r.name === "gestures") { renderGestures(); window.scrollTo(0, 0); }
  else if (r.name === "sketch") lazy("sketch.js").then(m => { if (route().name === "sketch") m.renderSketch(); });
  else if (r.name === "set") { renderSet(r.id); window.scrollTo(0, 0); }
  else if (r.name === "import") renderImport(r.id);
  else if (r.name === "road") lazy("road.js").then(m => { if (route().name === "road") { m.renderRoad(); window.scrollTo(0, 0); } });
  else if (r.name === "tour") lazy("tour.js").then(m => { if (route().name === "tour") { m.renderTour(); window.scrollTo(0, 0); } });
  else if (r.name === "duel") lazy("duel.js").then(m => { if (route().name === "duel") { m.renderDuel(r.id); window.scrollTo(0, 0); } });
  else if (r.name === "charts") lazy("charts.js").then(m => { if (route().name === "charts") { m.renderCharts(); window.scrollTo(0, 0); } });
  else if (r.name === "merch") lazy("merch.js").then(m => { if (route().name === "merch") { m.renderMerch(); window.scrollTo(0, 0); } });
  else if (r.name === "band") lazy("band.js").then(m => { if (route().name === "band") { m.renderBand(); window.scrollTo(0, 0); } });
  else { renderLibrary(); window.scrollTo(0, 0); if (searchNext) { searchNext = false; setTimeout(() => $("q")?.focus(), 60); } } /* the library always opens at its top */
}

// Screen changes animate with the browser's view transitions where supported:
// a short cross-fade, and the song title glides between the library row and the
// song header. Instant when Reduce Motion is on or the browser lacks support.
const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export let lastOpened = null; // id of the song whose title should glide back to its row
window.addEventListener("hashchange", () => {
  if (!document.startViewTransition || calm()) return render();
  const leaving = route().name !== "song" && viewing ? viewing.id : null;
  if (leaving) lastOpened = leaving;
  const t = document.startViewTransition(() => render());
  t.finished.finally(() => { delete document.documentElement.dataset.vt; });
});
applyTheme();
firstLaunch();
data.songs.filter(s => s.isNew).forEach(settleNew); /* a song being added when the app closed */
setTimeout(() => (window.requestIdleCallback || (f => f()))(prefetch), 3000);
render();
coverLoadAll().then(() => {
  /* Forget cover photos of sets that are gone for good (not in the library or Recently deleted). */
  const keep = new Set([...data.sets.map(x => x.id), ...data.trash.filter(t => t.type === "set").map(t => t.item.id)]);
  Object.keys(coverCache).filter(id => !keep.has(id)).forEach(coverDel); if (data.sets.some(x => x.cover?.type === "photo") && ["library", "set"].includes(route().name) && !layer.innerHTML) render(); });

// The app opens from the saved copy (see sw.js). When a new release has been
// saved in the background, offer to switch to it now; otherwise it's used on the
// next launch. Coming back to the app also checks for a release, since an
// installed app that's only resumed never reloads the page.
if ("serviceWorker" in navigator) {
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadWorker) toast("Update ready", null, { label: "Reload", fn: () => location.reload() });
  });
  navigator.serviceWorker.register("./sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg?.update?.().catch(() => {});
    });
  }).catch(() => {});
}

// Shared with the feature modules that load on first use (tuner.js and others).
export { gigHooks, playGig, openTools, musicClock, usesMusic, chordTimes, pxPerSecond, sheetLines, tempoFor, isLine, beatTrack, playSong, openAtSection, openSearch, chipsHTML, renderList, refreshLibrary, bindShelf, setsShelf, homeHooks, aiLastStop, bassPreview, riffPreview, grooveFor, metroPreview, byLength, refreshSpeed, startScroll, deJobs, tunedRecently, $, data, icon, layer, esc, coach, coachTip, markUsed, tick, toast, go, busy, AI, aiKey, BPM_STORE, bpmKey, askClaude, aiError, parseJSON, openLink, appleSearchURL, leaveSearch, chordNames, chordSVG, songKey, redraw, READ_AT, applyPaused, calm, card, chordEdit, diag, map, openEdit, openTuner, paintMap, route, scroll, searching, setCurrent, showChordPop, viewing, setOpenEdit, applyTheme, render, setData, mmss, filter, keyOf, lazy, shareSet, songLength, songTuning, setFilter, cleanSheet, demoTap, readPhoto, stopScroll, takeDemo, setChordEdit, settleNew, newSong };
