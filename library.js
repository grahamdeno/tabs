// The Road: the Songbook (search, filters, the song list, swipes) and the paste card. Split from app.js (4.15.1); app.js re-exports what other files use.
import { coachTip, demoSearch, dismissCoach, markUsed, searchOpened, tick, tipDue, tipsSeen, used } from "./coach.js";
import { Tabs, artistSortName, detectPaste, gigCountdown, guessKey, indexLetter, knownChords, lastPlayed, nextSet, parseSheet, pickNudge, playCount, playsThisWeek, requestSong, searchSongs, sheetChords, sortSongs, untilLabel, weatherMood } from "./core.js";
import { recentApple } from "./listen.js";
import { guitarIcon } from "./rock.js";
import { fullWhen, keyColor, newSet, playSet, setCover, setKeys, setLength, setSetCtx, setSongs, whenText } from "./sets.js";
import { renderImport } from "./share.js";
import { ago, backupNow, needsBackup } from "./store.js";
import { $, I, app, esc, followKeyboard, icon, layer, onLeave, toast } from "./ui.js";
import { aiError, aiKey, busy, cleanSheet } from "./aihelp.js";
import { bindFind, data, findCard, go, keyOf, lastOpened, newSong, nextSongs, openTuner, playGig, route, tunedRecently } from "./app.js";

export let query = "";
export let filter = "all";
export const setFilter = f => { filter = f; };
// Search mode: tapping the bar moves it to the top and folds the library away, so
// results sit between the bar and the keyboard. (iPhone doesn't resize the page
// for the keyboard; it pushes the page up instead, which hid results at the top.)
export let searching = false;
let keepSearch = false; /* back from a song opened from results: show the results again */
onLeave(r => { if (r.name !== "library" && searching) { searching = false; document.body.classList.remove("searching"); } });

// ---------- Library ----------
// ---- Today: the practice streak and one song for today ----
// The quiet stat line under the title grows into a Today line: seven dots for
// the last week (today dashed until you play), the streak, and at most one
// nudge that opens a song. The nudge waits on a gig day (Up next has the
// floor) and goes once you've played today. Weather comes from Open-Meteo for
// a city chosen in Settings, fetched once a day; no location access.
const WX = "tabs.wx.v1";
const NUDGE_ICON = { change: "fretboard", streak: "note", rain: "rain", cold: "snow", clear: "sun", hot: "sun", learn: "note", idle: "heart" };
export const todayKey = () => new Date().toDateString();
function wxMood() {
  const p = data.settings.place;
  if (!p) return "";
  let c = null;
  try { c = JSON.parse(localStorage.getItem(WX) || "null"); } catch {}
  if (c && c.day === todayKey() && c.lat === p.lat && c.lon === p.lon) return weatherMood(c.code, c.tmax);
  fetchWeather(p);
  return "";
}
let wxAsked = "";
async function fetchWeather(p) {
  const ask = todayKey() + p.lat + p.lon;
  if (wxAsked === ask) return;
  wxAsked = ask;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&daily=weather_code,temperature_2m_max&timezone=auto&forecast_days=1`);
    if (!r.ok) return;
    const j = await r.json();
    const code = j?.daily?.weather_code?.[0], tmax = j?.daily?.temperature_2m_max?.[0];
    if (code == null) return;
    try { localStorage.setItem(WX, JSON.stringify({ day: todayKey(), lat: p.lat, lon: p.lon, code, tmax })); } catch {}
    const el = $("today");
    if (el && route().name === "library" && !searching) { el.outerHTML = todayHTMLOrSpot(); bindToday(); }
  } catch { /* offline: no weather today */ }
}
/* 4.20.0: no streak line here (the stat bar and Your profile have it): just the one nudge, as a card */
function todayHTML() {
  if (data.settings.nudge === false) return "";
  const n = pickNudge({ songs: data.songs, mood: wxMood(), gigToday: data.sets.some(x => gigCountdown(x.when)) });
  if (!n) return "";
  return `<div class="today" id="today"><button class="nudge k-${esc(n.kind || "learn")}" id="nudge" data-song="${esc(n.songId)}"><span class="ng-ic">${n.kind === "streak" ? guitarIcon(true, 30) : icon(NUDGE_ICON[n.kind] || "note")}</span><span><small>${esc(n.text)}</small><b>${esc(n.title)}</b></span>${icon("chev", "chev")}</button></div>`;
}
// An empty, hidden #today keeps a place for the line when there's nothing to
// show yet, so a forecast that arrives after the library is drawn can still
// fill it in (with no plays this week the weather never appeared).
const todayHTMLOrSpot = (...a) => todayHTML(...a) || `<div id="today" hidden></div>`;
function bindToday() {
  $("nudge")?.addEventListener("click", e => go("#/song/" + encodeURIComponent(e.currentTarget.dataset.song)));
}
/* The filter chips, on the Library page and in Tonight's drawer. */
export function chipsHTML() {
  if (!data.songs.length) return "";
  const hasFav = data.songs.some(s => s.favorite), hasTab = data.songs.some(s => s.format === "tab"), hasLearn = data.songs.some(s => s.status === "learning");
  const can = canPlayCount();
  if ((filter === "fav" && !hasFav) || (filter === "tab" && !hasTab) || (filter === "learn" && !hasLearn) || (filter === "can" && !can)) filter = "all";
  const chip = (f, label) => `<button class="chip ${filter === f ? "on" : ""}" data-f="${f}">${label}</button>`;
  return `<div class="chips" id="chips">${chip("all", "All")}${can ? chip("can", `Can play · ${can}`) : ""}${chip("sets", "Sets")}${hasFav ? chip("fav", "Favorites") : ""}${hasLearn ? chip("learn", "Learning") : ""}${hasTab ? chip("tab", "Tabs") : ""}</div>`;
}
/* Tonight's drawer holds the same Library; it registers how to repaint itself here. */
export const homeHooks = { refresh: null, openDrawer: false }; /* openDrawer: Tonight opens with the Library up (3.24.2) */
export const refreshLibrary = () => route().name === "road" ? homeHooks.refresh?.() : renderLibrary();

export function renderLibrary() {
  chipsHTML(); /* settles a filter that no longer has songs */
  const tunerBtn = cls => `<button class="${cls}" id="tunerbtn" aria-label="${tunedRecently() ? "Tuner" : "Tuner. Not tuned in the last few hours"}">${icon("fork")}${tunedRecently() ? "" : '<i class="dotmark"></i>'}</button>`;
  app.innerHTML = `
    <div class="head">
      <div class="head-l"><button class="sh-btn" id="libback" aria-label="Back to the Road">${icon("back")}</button><h1 class="title script">Songbook</h1></div>
      <div class="row-btns">
        ${tunerBtn("ib chunky-tune")}
      </div>
    </div>
    ${todayHTMLOrSpot()}
    ${chipsHTML()}
    ${filter === "all" ? upNextHTML() : ""}
    ${filter === "all" && data.songs.length ? setsShelf() : ""}
    ${needsBackup() ? `<div class="bk glass" id="bk">
      <span class="tile">${icon("cloud")}</span>
      <div class="bk-t"><b>Back up your library</b><span>${data.settings.lastBackup ? `Last backup ${ago(data.settings.lastBackup)}` : "Not backed up yet"}. Save it to iCloud Drive.</span></div>
      <div class="bk-b"><button class="btn sm" id="bk-later">Later</button><button class="btn sm primary" id="bk-go">Back up</button></div>
    </div>` : ""}
    <div id="list"></div>
    <div class="dock-fade"></div>
    <div class="dock kb">
      <label class="cmd glass float">
        ${icon("search")}
        <input id="q" type="text" inputmode="search" enterkeyhint="go" placeholder="Search, or paste a song" value="${esc(query)}" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Search or paste a song">
        <button class="clear" id="clear" aria-label="Clear search" ${query ? "" : "hidden"}>${icon("x")}</button>
      </label>
      <button class="add" id="add" aria-label="Add song"><svg class="add-note" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="add-silver" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset=".5" stop-color="#c9cacf"/><stop offset="1" stop-color="#9a9ba1"/></linearGradient></defs><g fill="url(#add-silver)" stroke="#6d6e74" stroke-width=".35"><path d="M8.2 6.4 19 4v12.3h-1.8V6.3L10 7.9v10.3H8.2z"/><ellipse cx="6.4" cy="18.1" rx="2.6" ry="2.1" transform="rotate(-20 6.4 18.1)"/><ellipse cx="15.6" cy="16.2" rx="2.6" ry="2.1" transform="rotate(-20 15.6 16.2)"/></g></svg><i class="add-bdg" aria-hidden="true">+</i></button>
      <button class="qcancel" id="qcancel">Cancel</button>
    </div>`;
  bindToday();
  $("libback").onclick = () => go("#/");
  app.querySelectorAll(".upn-c[data-id]").forEach(b => b.onclick = () => go("#/song/" + encodeURIComponent(b.dataset.id)));
  app.querySelectorAll(".upn-c[data-gig]").forEach(b => b.onclick = () => playGig(b.dataset.gig));
  $("tunerbtn").onclick = () => openTuner("standard", () => route().name === "library" && renderLibrary());
  $("bk-later")?.addEventListener("click", () => { data.settings.backupSnooze = Date.now() + 2 * 86400000; Tabs.save(data); $("bk").remove(); });
  $("bk-go")?.addEventListener("click", async () => { if (await backupNow()) { $("bk")?.remove(); toast("Backed up"); } });
  $("add").onclick = () => newSong();
  app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderLibrary(); });
  bindShelf();
  const q = $("q");
  const enterSearch = () => {
    if (searching) return;
    searching = true;
    document.body.classList.add("searching");
    window.scrollTo(0, 0);
    renderList();
    searchOpened();
  };
  const exitSearch = () => {
    searching = false;
    query = ""; q.value = ""; $("clear").hidden = true;
    document.body.classList.remove("searching");
    q.blur();
    dismissCoach(true);
    renderLibrary();
  };
  /* Move the bar before the keyboard opens, so iPhone has nothing to push up. */
  q.addEventListener("pointerdown", e => {
    if (searching) return;
    e.preventDefault();
    enterSearch();
    q.focus({ preventScroll: true });
  });
  q.addEventListener("focus", () => { enterSearch(); window.scrollTo(0, 0); });
  /* Closing the keyboard (its checkmark doesn't tap the page) also closes a search tip. */
  q.addEventListener("blur", () => dismissCoach());
  q.addEventListener("blur", () => setTimeout(() => { if (searching && !query.trim() && document.activeElement !== q && route().name === "library" && !layer.innerHTML) exitSearch(); }, 200));
  $("qcancel").onclick = e => { e.preventDefault(); exitSearch(); };
  if (keepSearch && query.trim()) searching = true;
  keepSearch = false;
  if (searching) document.body.classList.add("searching");
  /* Search a beat after typing pauses, not on every key. */
  let typing = 0;
  q.oninput = () => { query = q.value; $("clear").hidden = !query; clearTimeout(typing); typing = setTimeout(renderList, query.length > 2 ? 90 : 0); };
  q.onkeydown = e => {
    if (e.key !== "Enter") return;
    clearTimeout(typing); renderList();
    const first = app.querySelector("#list .row");
    if (first) first.click();
  };
  q.addEventListener("paste", e => {
    const text = e.clipboardData?.getData("text") || "";
    /* A pasted share link opens the same "Shared with you" sheet as tapping it. */
    const link = text.match(/#\/import\/([zj][A-Za-z0-9_-]+)/);
    if (link) { e.preventDefault(); q.blur(); return renderImport(link[1]); }
    if (text.trim().split("\n").filter(l => l.trim()).length < 2) return;
    e.preventDefault();
    q.blur();
    showPasteCard(detectPaste(text));
  });
  $("clear").onclick = e => { e.preventDefault(); query = ""; q.value = ""; $("clear").hidden = true; renderList(); q.focus(); };
  renderList();
  followKeyboard();
  /* After the first song: invite a tap on search, which does more than find. */
  if ((used("chord") || tipsSeen().play) && tipDue("searchInvite") && !searching) setTimeout(() => {
    if (route().name !== "library" || layer.innerHTML || searching || document.activeElement === q || !coachTip("searchInvite")) return;
    demoSearch();
  }, 900);
}

// ---- Up next and the sets shelf (library, All view) ----
export function setsShelf() {
  if (!data.sets.length) return "";
  const up = nextSet(data.sets);
  const rest = data.sets.filter(x => x !== up)
    .sort((a, b) => (a.when && b.when ? Date.parse(a.when) - Date.parse(b.when) : a.when ? -1 : b.when ? 1 : 0));
  const len = x => { const n = setSongs(x).length; return `${n} song${n === 1 ? "" : "s"}${n ? ` · ${Math.round(setLength(x) / 60)} min` : ""}`; };
  return `
    ${up ? `<div class="upnext" id="upnext" role="button" tabindex="0" aria-label="Up next: ${esc(up.name)}, ${esc(fullWhen(up.when))}" style="--tint:${keyColor(setKeys(up)[0], up.name, 0.22)}">
      <div class="un-cv">${setCover(up, { small: true, notext: true })}</div>
      <div class="un-t"><div class="lab">Up next · ${gigCountdown(up.when) ? "Today" : esc(whenText(up.when))}</div><b>${esc(up.name)}</b>
        ${gigCountdown(up.when) ? `<div class="un-cd glow" id="un-cd" aria-hidden="true">${gigCountdown(up.when)}</div>` : ""}
        <span>${gigCountdown(up.when) ? `until ${esc(whenText(up.when, false))} · ${len(up)}` : `${len(up)} · ${esc(untilLabel(up.when))}`}${up.where ? ` · ${esc(up.where)}` : ""}</span></div>
      ${setSongs(up).length ? `<button class="un-play" id="un-play" aria-label="Play ${esc(up.name)}">${icon("play")}</button>` : ""}
    </div>` : ""}
    <div class="label lrow shelf-h"><span>Your sets</span><button class="linkbtn sh-all" id="sh-all">See all</button></div>
    <div class="shelf" id="shelf">
      ${rest.map(x => `<button class="sh-it" data-sh="${esc(x.id)}" aria-label="${esc(x.name)}"><div class="sh-cv">${setCover(x, { fs: 14, small: true })}</div><div class="sh-t">${esc(x.name)}</div><div class="sh-s">${x.when ? esc(whenText(x.when)) : len(x)}</div></button>`).join("")}
      <button class="sh-it sh-new" id="sh-new" aria-label="New set"><div class="sh-cv">${icon("plus")}</div><div class="sh-t">New set</div></button>
    </div>`;
}
let gigTimer = 0;
onLeave(() => clearInterval(gigTimer));
export function bindShelf() {
  const up = nextSet(data.sets);
  /* Gig day: the countdown ticks every second while the library is open. */
  clearInterval(gigTimer);
  if ($("un-cd")) gigTimer = setInterval(() => { const el = $("un-cd"), t = el && gigCountdown(up.when); if (!el) return clearInterval(gigTimer); if (t) el.textContent = t; else { clearInterval(gigTimer); refreshLibrary(); } }, 1000);
  $("upnext")?.addEventListener("click", e => { if (!e.target.closest("#un-play")) go("#/set/" + encodeURIComponent(up.id)); });
  $("un-play")?.addEventListener("click", () => playSet(up));
  $("sh-all")?.addEventListener("click", () => { filter = "sets"; refreshLibrary(); });
  $("sh-new")?.addEventListener("click", () => newSet());
  app.querySelectorAll("[data-sh]").forEach(b => b.onclick = () => go("#/set/" + encodeURIComponent(b.dataset.sh)));
}

export const STATUS = { learning: "Learning", got: "Got it" };
const SORTS = { title: "A–Z", artist: "Artist", recent: "Recently played", most: "Most played" };
// A lyric that matched the search, with the matching words marked.
function lyricHit(line, q) {
  const i = line.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0) return `“${esc(line)}”`;
  const n = q.trim().length;
  let from = Math.max(0, i - 24);
  if (from) { const sp = line.indexOf(" ", from); from = sp >= 0 && sp < i ? sp + 1 : from; } /* start on a whole word */
  return `“${from ? "…" : ""}${esc(line.slice(from, i))}<mark>${esc(line.slice(i, i + n))}</mark>${esc(line.slice(i + n))}”`;
}
function songRow(s, hit) {
  const wk = playsThisWeek(s), sort = data.settings.sort, n = playCount(s);
  const when = sort === "recent" && lastPlayed(s) ? ago(new Date(lastPlayed(s)).toISOString()) : "";
  const stat = sort === "most" && n ? `${n} play${n === 1 ? "" : "s"}` : when ? `Played ${when}` : wk && `Played ${wk}× this week`;
  const sub = hit ? `<span class="hit">${hit}</span>`
    : [esc(s.artist || "Unknown artist"), s.status !== "learning" && STATUS[s.status] && `<span class="st ${s.status}">${STATUS[s.status]}</span>`, stat].filter(Boolean).join(" · ");
  return `<button class="row" data-id="${esc(s.id)}"${s.id === lastOpened ? ' style="view-transition-name: song-title"' : ""}>
    <div class="txt"><div class="t">${esc(s.title)}</div><div class="a">${sub}</div></div>
    ${s.favorite ? `<svg class="heart" viewBox="0 0 24 24" aria-label="Favorite" role="img">${I.heart}</svg>` : ""}
    ${(() => { const f = fitOf(s); return s.status === "learning" ? `<span class="fit learn">LEARNING</span>` : f.can ? `<span class="fit can">CAN PLAY</span>` : f.missing.length === 1 ? `<span class="fit one">+ ${esc(f.missing[0])}</span>` : ""; })()}
    <span class="k">${esc(keyOf(s))}</span>
  </button>`;
}
/* The Songbook (4.9.0): which songs use only chords you know, and which need just one more. */
let fitCache = { at: 0, known: null, map: new Map() };
function fitOf(s) {
  if (Date.now() - fitCache.at > 3000) fitCache = { at: Date.now(), known: knownChords(data), map: new Map() };
  if (s.format === "tab") return { can: false, missing: [] };
  const hit = fitCache.map.get(s);
  if (hit && hit.body === s.body) return hit;
  const ch = sheetChords(s.body), known = fitCache.known;
  const missing = known.size ? ch.filter(c => !known.has(c)) : ch;
  const out = { body: s.body, can: known.size > 0 && ch.length > 0 && !missing.length, missing: known.size ? missing : [] };
  fitCache.map.set(s, out);
  return out;
}
const canPlayCount = () => data.songs.filter(s => fitOf(s).can).length;
/* Up next for you: the song one new chord opens, tonight's request, and (4.19.0, from Your profile's old
   Comfort zone card) a song you tried once or twice and left three weeks ago, when there's room for it */
function upNextHTML() {
  if (data.songs.length < 3 || searching) return "";
  const one = data.songs.filter(s => fitOf(s).missing.length === 1).sort((a, b) => (b.status === "learning") - (a.status === "learning") || (b.opened || 0) - (a.opened || 0))[0];
  const req = requestSong(data);
  const again = one && req ? null : data.songs.filter(s => { const n = playCount(s); return n >= 1 && n <= 2 && s.status !== "got" && Date.now() - (s.playLog?.last || 0) > 21 * 864e5 && s !== one && s !== req; })
    .sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0))[0];
  if (!one && !req && !again) return "";
  return `<div class="label">Up next for you</div><div class="upn">
    ${one ? `<button class="upn-c one" data-id="${esc(one.id)}"><small>ONE NEW CHORD</small><b>${esc(one.title)}</b><span>Learn ${esc(fitOf(one).missing[0])} and it's yours</span></button>` : ""}
    ${req ? `<button class="upn-c req" data-gig="${esc(req.id)}"><small>${data.quests?.heard?.id === req.id ? "FROM YOUR LISTENING" : "REQUESTED"}</small><b>${esc(req.title)}</b><span>2x bonus fans tonight</span></button>` : ""}
    ${again ? `<button class="upn-c again" data-id="${esc(again.id)}"><small>WORTH ANOTHER TRY</small><b>${esc(again.title)}</b><span>You left it ${Math.round((Date.now() - again.playLog.last) / 864e5 / 7)} weeks ago</span></button>` : ""}
  </div>`;
}

const sortBy = sort => `<label class="sortby">${esc(SORTS[sort])}${icon("chev", "chev")}<select id="sort" aria-label="Sort songs">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sort ? "selected" : ""}>${v}</option>`).join("")}</select></label>`;
// A–Z index on the right edge of a long list: touch or drag to jump to a letter.
function bindIndex(list, sorted, sort) {
  document.querySelector(".azx")?.remove();
  document.body.classList.remove("has-azx");
  if (!["title", "artist"].includes(sort) || sorted.length < 25 || searching) return;
  const firsts = new Map();
  list.querySelectorAll(".list [data-id]").forEach(row => {
    const song = sorted.find(x => x.id === row.dataset.id);
    const L = song ? indexLetter(sort === "artist" ? artistSortName(song) || "#" : song.title) : "#";
    if (!firsts.has(L)) firsts.set(L, row);
  });
  const letters = [..."#ABCDEFGHIJKLMNOPQRSTUVWXYZ"].filter(L => firsts.has(L));
  if (letters.length < 4) return;
  const x = document.createElement("div");
  x.className = "azx";
  x.setAttribute("aria-label", "Jump to letter");
  x.innerHTML = letters.map(L => `<button data-l="${L}" tabindex="-1" aria-label="${L === "#" ? "Numbers" : L}">${L}</button>`).join("") + `<b class="azx-pop" hidden></b>`;
  document.body.appendChild(x);
  document.body.classList.add("has-azx");
  const pop = x.querySelector(".azx-pop");
  let cur = "";
  const jump = (clientY, final) => {
    const btns = [...x.querySelectorAll("[data-l]")];
    const hit = btns.reduce((a, b) => Math.abs(b.getBoundingClientRect().top + b.offsetHeight / 2 - clientY) < Math.abs(a.getBoundingClientRect().top + a.offsetHeight / 2 - clientY) ? b : a);
    const L = hit.dataset.l;
    if (L !== cur) {
      cur = L; tick();
      const row = firsts.get(L);
      window.scrollTo({ top: row.getBoundingClientRect().top + scrollY - 120 });
      pop.textContent = L; pop.hidden = false;
      pop.style.top = (hit.getBoundingClientRect().top + hit.offsetHeight / 2 - x.getBoundingClientRect().top) + "px";
    }
    if (final) setTimeout(() => { pop.hidden = true; cur = ""; }, 500);
  };
  x.addEventListener("pointerdown", e => { e.preventDefault(); x.setPointerCapture?.(e.pointerId); x.classList.add("on"); jump(e.clientY); markUsed("index"); });
  x.addEventListener("pointermove", e => { if (x.classList.contains("on")) jump(e.clientY); });
  const end = e => { if (!x.classList.contains("on")) return; x.classList.remove("on"); jump(e.clientY, true); };
  x.addEventListener("pointerup", end); x.addEventListener("pointercancel", end);
}
onLeave(() => { document.querySelector(".azx")?.remove(); document.body.classList.remove("has-azx"); });
export function renderList() {
  const list = $("list"), drawer = route().name === "road";
  document.querySelector(".azx")?.remove(); document.body.classList.remove("has-azx");
  if (!data.songs.length) {
    list.innerHTML = `<div class="empty">No songs yet.<br>Paste a chord sheet into the bar below,<br>or tap + to write one.</div>`;
    return;
  }
  const q = query.trim().toLowerCase();
  if (filter === "sets" && !searching) {
    const sets = data.sets.filter(x => !q || x.name.toLowerCase().includes(q));
    list.innerHTML = `
      <div class="label">Sets</div>
      ${!data.sets.length ? `<p class="empty-hint">A set is a list of songs in playing order, for a gig or a practice session. Play it and each song leads into the next.</p>` : ""}
      <div class="list glass">
        ${sets.map(x => { const n = setSongs(x).length; return `<button class="row" data-set="${esc(x.id)}">
          <div class="row-cv">${setCover(x, { small: true, notext: true })}</div>
          <div class="txt"><div class="t">${esc(x.name)}</div><div class="a">${x.when ? `${esc(fullWhen(x.when))} · ` : ""}${n} song${n === 1 ? "" : "s"}${n ? ` · about ${Math.round(setLength(x) / 60)} min` : ""}</div></div>
          ${icon("chev", "chev")}</button>`; }).join("")}
        <button class="row newset" id="newset"><div class="txt"><div class="t">${icon("plus")} New set</div></div></button>
      </div>`;
    list.querySelectorAll("[data-set]").forEach(el => el.onclick = () => go("#/set/" + encodeURIComponent(el.dataset.set)));
    $("newset").onclick = () => newSet();
    return;
  }
  if (searching && !q) {
    /* Before typing: recently played songs, ready to tap. */
    const recentSongs = sortSongs(data.songs.filter(s => lastPlayed(s)), "recent").slice(0, 8);
    const shown = recentSongs.length ? recentSongs : sortSongs(data.songs, "title");
    list.innerHTML = `<p class="empty-hint" style="margin:4px 0 12px">Search titles, artists or a line from the lyrics. Paste a chord sheet here to add it.</p>
      ${aiKey() && data.songs.length ? `<button class="nextidea glass" id="nextidea">${icon("wand")}<span><b>What can I play next?</b>Songs that use the chords you already know</span>${icon("chev", "chev")}</button>` : ""}
      <div class="label">${recentSongs.length ? "Recently played" : "All songs"}</div><div class="list glass">${shown.map(s => songRow(s)).join("")}</div>
      <div id="amrecent"></div>`;
    bindRows(list);
    /* Apple Music (only when it is turned on): what you played there lately. A tap fills the search with it. */
    if (data.settings.appleMusic) recentApple().then(rows => {
      const box = $("amrecent");
      if (!box?.isConnected || !rows.length || !searching || query) return;
      box.innerHTML = `<div class="label">Recently on Apple Music</div><div class="list glass">${rows.map((r, n) => `<button class="row" data-amr="${n}"><div class="txt"><div class="t">${esc(r.title)}</div><div class="a">${esc(r.artist)}</div></div>${icon("chev", "chev")}</button>`).join("")}</div>`;
      box.querySelectorAll("[data-amr]").forEach(b => b.onclick = () => { const r = rows[+b.dataset.amr]; query = `${r.title} ${r.artist}`.trim(); const qi = $("q"); if (qi) qi.value = query; $("clear").hidden = false; renderList(); });
    });
    $("nextidea")?.addEventListener("click", () => nextSongs());
    return;
  }
  const pool = searching ? data.songs : data.songs.filter(s =>
    (filter !== "fav" || s.favorite) && (filter !== "tab" || s.format === "tab") && (filter !== "learn" || s.status === "learning") && (filter !== "can" || fitOf(s).can));
  /* Searching: title and artist matches first, then songs whose lyrics have the words. */
  const found = q ? searchSongs(pool, q) : null;
  const sort = SORTS[data.settings.sort] ? data.settings.sort : "title";
  const recent = !q && filter === "all" && sort !== "recent" && data.songs.length >= 4 && !data.sets.length
    ? data.songs.filter(s => s.opened).sort((a, b) => b.opened - a.opened).slice(0, 2) : [];
  const sorted = found ? found.map(x => x.song) : sortSongs(pool, sort);
  const hits = new Map((found || []).filter(x => x.line).map(x => [x.song.id, lyricHit(x.line, q)]));

  list.innerHTML = `
    ${recent.length ? `<div class="label">Recent</div><div class="recent">${recent.map(s => `
      <button class="rc glass" data-id="${esc(s.id)}">
        <div class="t">${esc(s.title)}</div>
        <div class="a">${esc(s.artist || "Unknown artist")}</div>
      </button>`).join("")}</div>` : ""}
    ${q ? "" : `<div class="label lrow"><span>${filter === "fav" ? "Favorites" : filter === "tab" ? "Tabs" : filter === "learn" ? "Learning" : "All songs"}</span>
      ${sortBy(sort)}</div>`}
    ${sorted.length ? `<div class="list glass" style="${q ? "margin-top:18px" : ""}">${sorted.map(s => songRow(s, hits.get(s.id))).join("")}</div>${q ? findCard(query, true) : ""}` : findCard(query)}`;
  $("sort")?.addEventListener("change", e => { data.settings.sort = e.target.value; Tabs.save(data); renderList(); });
  bindRows(list);
  bindFind(list);
  if (!drawer) bindIndex(list, sorted, q ? "" : sort);
}
// swipe a song in the list. Left shows Delete (a long swipe deletes
// at once; Undo brings it back, and it stays in Recently deleted for 30
// days). Right toggles Favorite. Only on the plain list, never the cards.
let swOpen = null;
function closeSwipe() { if (!swOpen) return; const r = swOpen; swOpen = null; r.style.transform = ""; r.parentNode.querySelectorAll(".sw-act").forEach(a => a.style.width = ""); setTimeout(() => r.parentNode?.classList.remove("swiping"), 200); }
function swipeDelete(id) {
  const song = data.songs.find(x => x.id === id);
  if (!song) return;
  swOpen = null;
  const entry = Tabs.deleteSong(data, id);
  refreshLibrary();
  toast(`Deleted "${song.title}"`, null, { label: "Undo", fn: () => { Tabs.restore(data, entry); refreshLibrary(); toast("Restored"); } });
}
function bindSwipe(list) {
  list.querySelectorAll(".list .row[data-id]").forEach(row => {
    const wrap = document.createElement("div");
    wrap.className = "sw";
    row.before(wrap);
    wrap.innerHTML = `<button class="sw-act sw-fav" tabindex="-1" aria-hidden="true">${icon("heart")}</button><button class="sw-act sw-del" tabindex="-1" aria-label="Delete">${icon("trash")}</button>`;
    wrap.appendChild(row);
    const del = wrap.querySelector(".sw-del"), fav = wrap.querySelector(".sw-fav");
    del.onclick = e => { e.stopPropagation(); swipeDelete(row.dataset.id); };
    let x0 = 0, y0 = 0, dx = 0, on = false, dead = false, base = 0;
    const paint = d => {
      row.style.transform = d ? `translateX(${d}px)` : "";
      del.style.width = Math.max(0, -d) + "px"; fav.style.width = Math.max(0, d) + "px";
      del.classList.toggle("go", -d > row.offsetWidth * 0.6); fav.classList.toggle("go", d > 72);
    };
    row.addEventListener("pointerdown", e => { if (e.pointerType === "mouse" && e.button) return; x0 = e.clientX; y0 = e.clientY; dx = 0; on = false; dead = false; base = swOpen === row ? -84 : 0; if (swOpen && swOpen !== row) closeSwipe(); });
    row.addEventListener("pointermove", e => {
      if (dead || (!x0 && !y0)) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!on) { if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { dead = true; return; } if (Math.abs(mx) < 12) return; on = true; wrap.classList.add("swiping"); try { row.setPointerCapture(e.pointerId); } catch {} }
      dx = base + mx; paint(dx);
    });
    const end = () => {
      if (!on) { x0 = y0 = 0; return; }
      on = false; x0 = y0 = 0; row.dataset.swiped = "1"; setTimeout(() => delete row.dataset.swiped, 400);
      if (-dx > row.offsetWidth * 0.6) { paint(-row.offsetWidth); setTimeout(() => swipeDelete(row.dataset.id), 160); return; }
      if (dx > 72) {
        const song = data.songs.find(x => x.id === row.dataset.id);
        if (song) { song.favorite = !song.favorite; Tabs.save(data); tick(); toast(song.favorite ? "Added to Favorites" : "Removed from Favorites"); }
        paint(0); setTimeout(refreshLibrary, 220); return;
      }
      if (-dx > 50) { paint(-84); swOpen = row; return; }
      paint(0); if (swOpen === row) swOpen = null; setTimeout(() => wrap.classList.remove("swiping"), 200);
    };
    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", end);
  });
  /* The first time, one row slides a little to show the trash, then settles. */
  const first = list.querySelector(".list .sw .row");
  if (first && !searching && data.songs.length > 2 && coachTip("swipe")) {
    const w = first.parentNode, d = w.querySelector(".sw-del");
    setTimeout(() => { w.classList.add("swiping", "hint"); first.style.transform = "translateX(-72px)"; d.style.width = "72px";
      setTimeout(() => { first.style.transform = ""; d.style.width = ""; setTimeout(() => w.classList.remove("swiping", "hint"), 400); }, 1100); }, 900);
  }
}
document.addEventListener("pointerdown", e => { if (swOpen && !e.target.closest(".sw")) closeSwipe(); }, true);
function bindRows(list) {
  bindSwipe(list);
  list.querySelectorAll("[data-id]").forEach(el => el.onclick = () => {
    if (el.dataset.swiped) { delete el.dataset.swiped; return; }
    setSetCtx(null);
    if (searching) { keepSearch = !!query.trim(); searching = false; document.body.classList.remove("searching"); }
    // Name this row's title so it glides into the song header.
    list.querySelectorAll("[data-id], .t").forEach(t => t.style.viewTransitionName = "");
    el.querySelector(".t").style.viewTransitionName = "song-title";
    go("#/song/" + encodeURIComponent(el.dataset.id));
  });
}

// ---------- Paste card ----------
export function showPasteCard(original) {
  markUsed("paste");
  let cleaned = null, useCleaned = false, working = false;
  const cur = () => (useCleaned && cleaned) || original;
  layer.innerHTML = `
    <div class="scrim" id="scrim"></div>
    <div class="panel card kb" role="dialog" aria-label="Save pasted song">
      <div class="pc-head">${icon("clip")}<span id="p-what"></span><span style="flex:1"></span>
        <div class="seg mini" id="p-ver" hidden><button data-v="0">Original</button><button data-v="1">Cleaned</button></div>
      </div>
      <div class="preview" id="p-prev"></div>
      <div class="tags" id="p-tags"></div>
      <div class="ai-note" id="p-note" hidden></div>
      <div class="fields glass">
        <label class="fld"><span class="lab">Title</span><input id="p-title" value="${esc(original.title)}" placeholder="Song title" autocomplete="off"></label>
        <label class="fld"><span class="lab">Artist</span><input id="p-artist" value="${esc(original.artist)}" placeholder="Optional" autocomplete="off"></label>
      </div>
      <div class="actions">
        <button class="btn" id="p-edit">Review</button>
        ${aiKey() ? `<button class="btn" id="p-clean">${icon("wand")}Clean up</button>` : ""}
        <button class="btn primary" id="p-save">Save to Songbook</button>
      </div>
    </div>`;
  const show = () => {
    const d = cur();
    $("p-what").textContent = `${d.format === "tab" ? "Tab" : "Chord sheet"} ${useCleaned ? "cleaned up" : "detected"}`;
    $("p-prev").innerHTML = parseSheet(d.body).slice(0, 6).map(l =>
      l.kind === "chords" ? `<span class="ch">${esc(l.text)}</span>` : l.kind === "section" ? `[${esc(l.text)}]` : esc(l.text)).join("\n");
    const key = d.key || (d.format === "chords" ? guessKey(d.body) : "");
    const tags = [d.format === "tab" ? "Tab" : "Chords", key && `Key ${key}`, d.sections && `${d.sections} section${d.sections === 1 ? "" : "s"}`].filter(Boolean);
    $("p-tags").innerHTML = tags.map(t => `<span class="tag">${esc(t)}</span>`).join("");
    $("p-ver").hidden = !cleaned;
    layer.querySelectorAll("#p-ver button").forEach(b => b.classList.toggle("on", (b.dataset.v === "1") === useCleaned));
  };
  show();
  const close = () => { layer.innerHTML = ""; };
  $("scrim").onclick = () => { if (!working) close(); };
  layer.querySelectorAll("#p-ver button").forEach(b => b.onclick = () => { useCleaned = b.dataset.v === "1"; show(); });
  $("p-clean")?.addEventListener("click", async () => {
    if (working) return;
    if (cleaned) { useCleaned = true; show(); return; }
    working = true;
    const btn = $("p-clean");
    btn.disabled = true; btn.innerHTML = busy("Cleaning");
    $("p-note").hidden = true;
    try {
      cleaned = await cleanSheet({ text: original.body });
      useCleaned = true;
      // Fill in what the cleanup found, without overwriting anything typed.
      if (!$("p-title").value.trim() && cleaned.title) $("p-title").value = cleaned.title;
      if (!$("p-artist").value.trim() && cleaned.artist) $("p-artist").value = cleaned.artist;
      show();
      btn.innerHTML = `${icon("check")}Cleaned`;
    } catch (e) {
      $("p-note").textContent = aiError(e); $("p-note").hidden = false;
      btn.disabled = false; btn.innerHTML = `${icon("wand")}Clean up`;
    }
    working = false;
  });
  const fields = () => {
    const d = cur();
    return { title: $("p-title").value.trim(), artist: $("p-artist").value.trim(), format: d.format, key: useCleaned ? (d.key || "") : "", body: d.body };
  };
  $("p-save").onclick = () => {
    if (working) return;
    const f = fields();
    if (!f.title) { $("p-title").focus(); toast("Add a title first"); return; }
    const s = Tabs.addSong(data, f);
    close(); query = "";
    go("#/song/" + encodeURIComponent(s.id));
  };
  $("p-edit").onclick = () => { if (working) return; const f = fields(); close(); newSong(f); };
  if (!original.title) setTimeout(() => $("p-title")?.focus(), 250);
  followKeyboard();
}

export function leaveSearch() { if (searching) { searching = false; document.body.classList.remove("searching"); query = ""; } }
