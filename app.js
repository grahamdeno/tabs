// Tabs app: screens and interaction. core.js holds the logic that has unit tests.
import { Tabs, SPEEDS, playsThisWeek, playCount, packShare, unpackShare, shareable, findSame, searchSongs, sortSongs, lastPlayed, TUNINGS, detectTuning, rankTracks, linkService, nextSet, untilLabel, parseSheet, parseBlocks, wrapTab, guessKey, transposeKey, prefersFlats, detectPaste, chordShape, indexLetter, appleTrackId, artistSortName, lengthChoice, fitLength, VERSION, restyle, firstLyric } from "./core.js";
import { $, I, app, ask, esc, followKeyboard, icon, layer, leaveHooks, onLeave, onScroll, showToCopy, toast } from "./ui.js";
import { addToSet, itunes, coverCache, coverDel, coverLoadAll, fullWhen, keyColor, newSet, nextLine, nextUp, playSet, renderSet, setCover, setCtx, setKeys, setLength, setRun, setSongs, whenText, setSetCtx } from "./sets.js";
import { ago, backupNow, copyDiagnostics, loadLibrary, needsBackup, noteError } from "./store.js";
import { chordTapped, coach, coachTip, demoLine, demoMap, demoNN, demoPause, demoSearch, demoTap, dismissCoach, markSeen, markUsed, renderGestures, searchOpened, songCoach, takeDemo, tick, tipDue, tipsSeen, used } from "./coach.js";


// ---------- State ----------
let data = await loadLibrary(); /* see store.js */
/* Replacing the whole library (a restored backup or the safety copy) goes through here. */
const setData = d => { data = d; };
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Tabs.flush(); });
window.addEventListener("pagehide", () => Tabs.flush());
let query = "";
let filter = "all";
const setFilter = f => { filter = f; };
let keyFilter = "", tuneFilter = ""; /* narrow a big library by key or tuning */
// Search mode: tapping the bar moves it to the top and folds the library away, so
// results sit between the bar and the keyboard. (iPhone doesn't resize the page
// for the keyboard; it pushes the page up instead, which hid results at the top.)
let searching = false;
let keepSearch = false; /* back from a song opened from results: show the results again */
onLeave(r => { if (r.name !== "library" && searching) { searching = false; document.body.classList.remove("searching"); } });

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
  const light = t === "light" || (t !== "dark" && phoneLight());
  document.body.classList.toggle("stage", !!data.settings.stage);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = light ? "#f3f0eb" : "#0c0d0f";
}


const go = h => { location.hash = h; };
const route = () => {
  const [, name = "", id = ""] = location.hash.split("/");
  return { name: name || "library", id: decodeURIComponent(id) };
};
const keyOf = s => s.format === "tab" ? "TAB" : (s.key || guessKey(s.body || ""));


// ---------- Library ----------
function renderLibrary() {
  const hasFav = data.songs.some(s => s.favorite);
  const hasTab = data.songs.some(s => s.format === "tab");
  const hasLearn = data.songs.some(s => s.status === "learning");
  if ((filter === "fav" && !hasFav) || (filter === "tab" && !hasTab) || (filter === "learn" && !hasLearn)) filter = "all";
  const week = data.songs.map(s => playsThisWeek(s)), weekTotal = week.reduce((a, b) => a + b, 0), weekSongs = week.filter(Boolean).length;
  app.innerHTML = `
    <div class="head">
      <h1 class="title">Library</h1>
      <div class="row-btns">
        <button class="ib glass" id="tunerbtn" aria-label="${tunedRecently() ? "Tuner" : "Tuner. Not tuned in the last few hours"}">${icon("fork")}${tunedRecently() ? "" : '<i class="dotmark"></i>'}</button>
        <button class="ib glass" id="settings" aria-label="Settings">${icon("gear")}</button>
      </div>
    </div>
    ${weekTotal ? `<div class="weekly">This week: ${weekTotal} play${weekTotal === 1 ? "" : "s"} across ${weekSongs} song${weekSongs === 1 ? "" : "s"}</div>` : ""}
    ${data.songs.length ? `<div class="chips" id="chips">
      <button class="chip ${filter === "all" ? "on" : ""}" data-f="all">All</button>
      <button class="chip ${filter === "sets" ? "on" : ""}" data-f="sets">Sets</button>
      ${hasFav ? `<button class="chip ${filter === "fav" ? "on" : ""}" data-f="fav">Favorites</button>` : ""}
      ${hasLearn ? `<button class="chip ${filter === "learn" ? "on" : ""}" data-f="learn">Learning</button>` : ""}
      ${hasTab ? `<button class="chip ${filter === "tab" ? "on" : ""}" data-f="tab">Tabs</button>` : ""}
      ${moreFilters()}
    </div>` : ""}
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
      <button class="add" id="add" aria-label="Add song">${icon("plus")}</button>
      <button class="qcancel" id="qcancel">Cancel</button>
    </div>`;
  $("settings").onclick = () => go("#/settings");
  $("tunerbtn").onclick = () => openTuner("standard", () => route().name === "library" && renderLibrary());
  $("bk-later")?.addEventListener("click", () => { data.settings.backupSnooze = Date.now() + 2 * 86400000; Tabs.save(data); $("bk").remove(); });
  $("bk-go")?.addEventListener("click", async () => { if (await backupNow()) { $("bk")?.remove(); toast("Backed up"); } });
  $("add").onclick = () => newSong();
  app.querySelectorAll("[data-f]").forEach(b => b.onclick = () => { filter = b.dataset.f; renderLibrary(); });
  $("f-key")?.addEventListener("change", e => { keyFilter = e.target.value; if (filter === "sets") filter = "all"; renderLibrary(); });
  $("f-tune")?.addEventListener("change", e => { tuneFilter = e.target.value; if (filter === "sets") filter = "all"; renderLibrary(); });
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
function setsShelf() {
  if (!data.sets.length) return "";
  const up = nextSet(data.sets);
  const rest = data.sets.filter(x => x !== up)
    .sort((a, b) => (a.when && b.when ? Date.parse(a.when) - Date.parse(b.when) : a.when ? -1 : b.when ? 1 : 0));
  const len = x => { const n = setSongs(x).length; return `${n} song${n === 1 ? "" : "s"}${n ? ` · ${Math.round(setLength(x) / 60)} min` : ""}`; };
  return `
    ${up ? `<div class="upnext" id="upnext" role="button" tabindex="0" aria-label="Up next: ${esc(up.name)}, ${esc(fullWhen(up.when))}" style="--tint:${keyColor(setKeys(up)[0], up.name, 0.22)}">
      <div class="un-cv">${setCover(up, { small: true, notext: true })}</div>
      <div class="un-t"><div class="lab">Up next · ${esc(whenText(up.when))}</div><b>${esc(up.name)}</b><span>${len(up)} · ${esc(untilLabel(up.when))}${up.where ? ` · ${esc(up.where)}` : ""}</span></div>
      ${setSongs(up).length ? `<button class="un-play" id="un-play" aria-label="Play ${esc(up.name)}">${icon("play")}</button>` : ""}
    </div>` : ""}
    <div class="label lrow shelf-h"><span>Your sets</span><button class="linkbtn sh-all" id="sh-all">See all</button></div>
    <div class="shelf" id="shelf">
      ${rest.map(x => `<button class="sh-it" data-sh="${esc(x.id)}" aria-label="${esc(x.name)}"><div class="sh-cv">${setCover(x, { fs: 14, small: true })}</div><div class="sh-t">${esc(x.name)}</div><div class="sh-s">${x.when ? esc(whenText(x.when)) : len(x)}</div></button>`).join("")}
      <button class="sh-it sh-new" id="sh-new" aria-label="New set"><div class="sh-cv">${icon("plus")}</div><div class="sh-t">New set</div></button>
    </div>`;
}
function bindShelf() {
  const up = nextSet(data.sets);
  $("upnext")?.addEventListener("click", e => { if (!e.target.closest("#un-play")) go("#/set/" + encodeURIComponent(up.id)); });
  $("un-play")?.addEventListener("click", () => playSet(up));
  $("sh-all")?.addEventListener("click", () => { filter = "sets"; renderLibrary(); });
  $("sh-new")?.addEventListener("click", () => newSet());
  app.querySelectorAll("[data-sh]").forEach(b => b.onclick = () => go("#/set/" + encodeURIComponent(b.dataset.sh)));
}

const STATUS = { learning: "Learning", got: "Got it" };
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
    : [esc(s.artist || "Unknown artist"), STATUS[s.status] && `<span class="st ${s.status}">${STATUS[s.status]}</span>`, stat].filter(Boolean).join(" · ");
  return `<button class="row" data-id="${esc(s.id)}"${s.id === lastOpened ? ' style="view-transition-name: song-title"' : ""}>
    <div class="txt"><div class="t">${esc(s.title)}</div><div class="a">${sub}</div></div>
    ${s.favorite ? `<svg class="heart" viewBox="0 0 24 24" aria-label="Favorite" role="img">${I.heart}</svg>` : ""}
    <span class="k">${esc(keyOf(s))}</span>
  </button>`;
}

// Key and Tuning chips: only for a library big enough to need them, and only
// when there's more than one to choose from.
function moreFilters() {
  if (data.songs.length < 12) { keyFilter = tuneFilter = ""; return ""; }
  const keys = [...new Set(data.songs.filter(s => s.format !== "tab").map(keyOf).filter(Boolean))].sort();
  const tunes = [...new Set(data.songs.map(songTuning))];
  if (!keys.includes(keyFilter)) keyFilter = "";
  if (!tunes.includes(tuneFilter)) tuneFilter = "";
  const chip = (id, label, value, opts) => `<label class="chip sel ${value ? "on" : ""}">${value ? esc(opts.find(o => o[0] === value)[1]) : label}${icon("chev", "chev")}<select id="${id}" aria-label="${label}"><option value="">Any ${label.toLowerCase()}</option>${opts.map(([v, n]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>`;
  return (keys.length > 1 ? chip("f-key", "Key", keyFilter, keys.map(k => [k, `Key of ${k}`])) : "")
    + (tunes.length > 1 ? chip("f-tune", "Tuning", tuneFilter, tunes.map(t => [t, TUNINGS[t].name])) : "");
}
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
function renderList() {
  const list = $("list");
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
      <div class="label">${recentSongs.length ? "Recently played" : "All songs"}</div><div class="list glass">${shown.map(s => songRow(s)).join("")}</div>`;
    bindRows(list);
    $("nextidea")?.addEventListener("click", () => nextSongs());
    return;
  }
  const pool = searching ? data.songs : data.songs.filter(s =>
    (filter !== "fav" || s.favorite) && (filter !== "tab" || s.format === "tab") && (filter !== "learn" || s.status === "learning")
    && (!keyFilter || (s.format !== "tab" && keyOf(s) === keyFilter)) && (!tuneFilter || songTuning(s) === tuneFilter));
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
    ${q ? "" : `<div class="label lrow"><span>${filter === "fav" ? "Favorites" : filter === "tab" ? "Tabs" : filter === "learn" ? "Learning" : "All songs"}${keyFilter ? ` · ${esc(keyFilter)}` : ""}${tuneFilter ? ` · ${esc(TUNINGS[tuneFilter].name)}` : ""}${keyFilter || tuneFilter ? ` · ${sorted.length}` : ""}</span>
      <label class="sortby">${esc(SORTS[sort])}${icon("chev", "chev")}<select id="sort" aria-label="Sort songs">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sort ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>`}
    ${sorted.length ? `<div class="list glass" style="${q ? "margin-top:18px" : ""}">${sorted.map(s => songRow(s, hits.get(s.id))).join("")}</div>` : findCard(query)}`;
  $("sort")?.addEventListener("change", e => { data.settings.sort = e.target.value; Tabs.save(data); renderList(); });
  bindRows(list);
  bindFind(list);
  bindIndex(list, sorted, q ? "" : sort);
}
function bindRows(list) {
  list.querySelectorAll("[data-id]").forEach(el => el.onclick = () => {
    setSetCtx(null);
    if (searching) { keepSearch = !!query.trim(); searching = false; document.body.classList.remove("searching"); }
    // Name this row's title so it glides into the song header.
    list.querySelectorAll("[data-id], .t").forEach(t => t.style.viewTransitionName = "");
    el.querySelector(".t").style.viewTransitionName = "song-title";
    go("#/song/" + encodeURIComponent(el.dataset.id));
  });
}

// ---------- AI help (optional, your own Anthropic key) ----------
// No server: the key stays in this browser's storage and is sent only to
// api.anthropic.com, using Anthropic's header for direct browser access.
// Without a key the app works as usual and the AI options don't appear.
const AI = { store: "tabs.apikey.v1", fast: "claude-haiku-5-5", vision: "claude-sonnet-5-5" };
function aiKey() { try { return localStorage.getItem(AI.store) || ""; } catch { return ""; } }

async function askClaude({ model = AI.fast, system, content, maxTokens = 8000, key = aiKey() }) {
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }] })
    });
  } catch { throw Object.assign(new Error("network"), { status: 0, model }); }
  if (!r.ok) {
    // Read Anthropic's error body so the real reason can be explained.
    const j = await r.json().catch(() => ({}));
    throw Object.assign(new Error(j?.error?.message || "HTTP " + r.status), { status: r.status, model });
  }
  const j = await r.json();
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
}

// Plain-English reasons, mapped from Anthropic's status codes.
function aiError(e) {
  const m = e?.message || "", st = e?.status;
  if (st === 400 && /web search/i.test(m)) return "Web search is turned off for this key's organization. An admin can turn it on in the Anthropic Console under Settings > Capabilities.";
  if (st === -1) return "Couldn't make sense of that. Try again, or keep the original.";
  if (!st) return "Could not reach Anthropic. Check the connection, and turn off any content blocker or VPN filtering for this site.";
  if (st === 401) return "Key not recognized. Copy it again from the Anthropic Console (it starts with sk-ant-).";
  if (st === 403) return "Key is valid but not allowed to do this. Check the key's workspace permissions in the Console.";
  if (st === 400 && /credit|balance|billing/i.test(m)) return "The account has no credit. Add credit under Billing in the Console.";
  if (st === 404) return `Model not found (${e.model}). The model name may need updating.`;
  if (st === 413 || /too large|exceeds/i.test(m)) return "That photo is too large. Try a closer, simpler shot of the page.";
  if (st === 429) return "Rate or spend limit reached. Check Limits in the Console, or wait a minute.";
  if (st >= 500) return "Anthropic is busy or down. Try again in a few minutes.";
  return `Request failed (HTTP ${st}).`;
}

function parseJSON(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  try { return JSON.parse(m[0]); } catch { throw Object.assign(new Error("bad json"), { status: -1 }); }
}

const CLEAN_SYSTEM = `You format guitar chord sheets for a phone app. The input is one song, pasted from a website or photographed from a page.
Reply with JSON only, no other text: {"title": string, "artist": string, "key": string, "format": "chords" or "tab", "sheet": string}
Rules for "sheet":
- Chords go on their own line directly above the lyric line, each chord starting at the column of the syllable where it changes.
- Section labels go on their own line in square brackets, like [Intro], [Verse 1], [Chorus], [Bridge]. One blank line between sections.
- Lines of only chords (intros, instrumentals) stay as chord lines. ASCII tab lines are kept exactly as written.
- If the source states a capo, put [Capo N] as the first line.
- Keep the song's words and chords exactly as given. Do not add, complete, translate or correct lyrics, do not invent chords, and do not transpose.
- Use standard chord spellings: G, Am, F#m7, Bb, Dsus4, D/F#.
- Remove everything that is not the song: ads, ratings, comments, site menus, credits, strumming legends, chord diagram text.
"title", "artist": from the source if present, else "". "key": the key if stated or clear from the chords (like G or Em), else "". "format": "tab" only if the song is mainly ASCII tab.`;

// Clean up pasted text, or read a photographed page, into the app's chord sheet format.
async function cleanSheet({ text, image }) {
  const content = image
    ? [{ type: "image", source: { type: "base64", media_type: image.type, data: image.data } },
       { type: "text", text: "Transcribe the chord sheet on this page." }]
    : [{ type: "text", text: "Clean up this pasted song:\n\n" + text }];
  const out = parseJSON(await askClaude({ model: image ? AI.vision : AI.fast, system: CLEAN_SYSTEM, content }));
  const sheet = String(out.sheet || "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (!sheet.trim()) throw Object.assign(new Error("empty"), { status: -1 });
  const d = detectPaste(sheet);
  return {
    title: String(out.title || d.title || "").trim(),
    artist: String(out.artist || d.artist || "").trim(),
    key: String(out.key || "").trim().slice(0, 4),
    format: out.format === "tab" || d.format === "tab" ? "tab" : "chords",
    body: d.title ? d.body : sheet,
    sections: d.sections
  };
}

// Shrink a photo to a size the API accepts quickly, as JPEG base64.
async function readPhoto(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
  } finally { URL.revokeObjectURL(url); }
}

const busy = label => `<span class="spin" aria-hidden="true"></span>${label}`;

// ---------- Paste card ----------
function showPasteCard(original) {
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
        <button class="btn primary" id="p-save">Save to Library</button>
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

// ---------- Song view ----------
let scroll = { on: false, raf: 0, last: 0, carry: 0, lock: null };

function renderViewer(id) {
  const song = data.songs.find(s => s.id === id);
  if (!song) return go("#/");
  const isChords = song.format !== "tab";
  if (song.transpose === undefined) song.transpose = data.settings.transpose || 0;
  if (song.speed === undefined) song.speed = data.settings.startSpeed || SPEEDS.medium; // then each song keeps its own
  if (song.size === undefined) song.size = 1;
  song.opened = Date.now();
  Tabs.save(data);

  app.classList.add("viewer");
  /* Back goes where the song was opened from: its set, when played from one. */
  const fromSet = (() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); return x && setSongs(x)[setCtx.idx]?.id === song.id ? x : null; })();
  const back = fromSet ? { to: "#/set/" + encodeURIComponent(fromSet.id), label: `Back to ${fromSet.name}` } : { to: "#/", label: "Back to library" };
  diag.armed = false; diag.rowKey = null; diag.pinned = null; diag.scrolling = false; diag.block = null;
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" data-go="${back.to}" aria-label="${esc(back.label)}">${icon("back")}</button>
      <div class="row-btns">
        <button class="ib glass fav ${song.favorite ? "on" : ""}" aria-label="Favorite" aria-pressed="${!!song.favorite}">${icon("heart")}</button>
        <button class="ib glass more" id="more" aria-label="More for this song" aria-haspopup="menu">${icon("dots")}${menuHasNew() ? '<i class="newdot"></i>' : ""}</button>
      </div>
    </div>
    ${(() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); const list = x ? setSongs(x) : [];
      if (!x || list[setCtx.idx]?.id !== song.id) { setSetCtx(null); return ""; }
      return `<div class="setbar"><button class="sb" id="sprev" aria-label="Previous song" ${setCtx.idx === 0 ? "disabled" : ""}>${icon("back")}</button>
        <button class="setname" data-go="#/set/${encodeURIComponent(x.id)}">${esc(x.name)} · ${setCtx.idx + 1} of ${list.length}</button>
        <button class="sb" id="snext" aria-label="Next song" ${setCtx.idx === list.length - 1 ? "disabled" : ""}>${icon("chev")}</button></div>`; })()}
    <h1 class="song-title" style="view-transition-name: song-title">${esc(song.title)}</h1>
    <div class="metarow"><div class="meta" id="meta"></div><button class="stat" id="stat" aria-label="Learning status"></button><button class="stat listen" id="listen" aria-label="${song.listen ? `Listen on ${esc(song.listen.service)}` : "Find a recording to listen to"}">${icon("note")}${song.listen ? esc(song.listen.service) : "Listen"}</button>${songTuning(song) !== "standard" ? `<button class="stat tunechip" id="tunechip" aria-label="Tuning: ${TUNINGS[songTuning(song)].name}. Open the tuner">${icon("fork")}${TUNINGS[songTuning(song)].name}</button>` : ""}</div>
    ${song.sketch?.lines?.length ? `<div class="skrow" id="skrow"><button class="stat sk-hear" id="sk-hear" hidden>${icon("play")}<span>Your recording</span></button>
      <div class="seg mini sk-style" role="group" aria-label="Chord style">${["simple", "rich"].map(st => `<button data-st="${st}" class="${(song.sketch.style || "simple") === st ? "on" : ""}" aria-pressed="${(song.sketch.style || "simple") === st}">${st === "simple" ? "Simple" : "Rich"}</button>`).join("")}</div></div>` : ""}
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
        <button class="play" id="play" aria-label="Start auto-scroll">${icon("play")}</button>
        <div class="speed">
          ${byLength()
            ? `<input type="range" id="speed" min="60" max="480" step="5" value="${540 - songLength(song)}" aria-label="Song length">`
            : `<input type="range" id="speed" min="4.5" max="99" step="4.5" value="${song.speed}" aria-label="Scroll speed for this song">`}
          <span id="sv"></span>
        </div>
        ${isChords ? `<button class="sb nnbtn ${data.settings.diagrams === true ? "on" : ""}" id="nnbtn" aria-label="Now and Next chords" aria-pressed="${data.settings.diagrams === true}">${icon("fretboard")}</button>` : ""}
        <div class="vsep"></div>
        <div class="step" aria-label="${isChords ? "Transpose" : "Text size"}">
          <button class="sb" id="down" aria-label="${isChords ? "Transpose down" : "Smaller text"}">${icon("minus")}</button>
          <span class="v" id="val"></span>
          <button class="sb" id="up" aria-label="${isChords ? "Transpose up" : "Larger text"}">${icon("plus")}</button>
        </div>
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
  $("listen").onclick = () => listenSheet(song);
  $("stat").onclick = () => {
    song.status = !song.status ? "learning" : song.status === "learning" ? "got" : undefined;
    if (!song.status) delete song.status;
    Tabs.save(data); paintStat();
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
    $("meta").innerHTML = [
      song.artist && `<span>${esc(song.artist)}</span>`,
      key && `<span>Key <b>${esc(key)}</b></span>`,
      capoTxt && `<span>${capoTxt}</span>`,
      !isChords && `<span>Tab</span>`
    ].filter(Boolean).join('<span class="dot"></span>');
    $("csub").innerHTML = [song.artist && esc(song.artist), key && `Key <b>${esc(key)}</b>`, capoTxt, !isChords && "Tab"]
      .filter(Boolean).join(" · ");
    SUBS = easy ? easy.subs || {} : {};
    const sheet = $("sheet");
    const val = $("val");
    sheet.style.setProperty("--tab-size", (14 * song.size).toFixed(1) + "px");
    sheet.style.setProperty("--lyric-size", (17 * song.size * sysText * (data.settings.stage ? 1.2 : 1)).toFixed(1) + "px");
    // With a capo the shapes sit lower than the sound: shift the chords down by the capo.
    renderBlocks(sheet, parseBlocks(song.body || "", isChords ? steps - capo : 0, isChords && prefersFlats(baseKey, steps - capo)));
    renderStrip(sheet, isChords, song);
    layoutDiagrams(sheet, isChords);
    if (isChords) {
      val.textContent = steps ? (steps > 0 ? "+" : "") + steps : "0";
      val.classList.toggle("zero", !steps);
    } else {
      val.textContent = Math.round(song.size * 100) + "%";
      val.classList.toggle("zero", song.size === 1);
    }
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
  };
  showSpeed();
  speed.oninput = () => {
    if (byLength()) { song.duration = 540 - speed.value; song.durationSet = true; } else song.speed = +speed.value;
    showSpeed(); Tabs.save(data);
  };
  refreshSpeed = () => { if (viewing !== song || !speed.isConnected) return; if (byLength()) speed.value = 540 - songLength(song); showSpeed(); };
  /* A linked Apple Music song without its recording length yet: look it up once. */
  if (song.listen && song.listen.length === undefined && appleTrackId(song.listen.url)) recordingLength(song, song.listen.url, { quiet: true });

  const step = dir => {
    if (isChords) song.transpose = ((((song.transpose || 0) + dir) + 17) % 12) - 5; // -5..+6
    else song.size = Math.min(1.6, Math.max(0.6, +(song.size + dir * 0.1).toFixed(2)));
    Tabs.save(data);
    /* Quick repeated taps draw once, on the next frame. */
    if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; if (viewing === song) draw(); });
  };
  let drawFrame = 0;
  $("down").onclick = () => step(-1);
  $("up").onclick = () => step(1);
  $("play").onclick = () => scroll.on ? stopScroll() : startScroll(song);
  $("nnbtn")?.addEventListener("click", () => {
    const on = data.settings.diagrams !== true;
    data.settings.diagrams = on;
    Tabs.save(data);
    $("nnbtn").classList.toggle("on", on);
    $("nnbtn").setAttribute("aria-pressed", on);
    diag.nn = on && diag.seq.length > 0;
    diag.idx = null;
    updateDiagrams();
    toast(on ? "Now and Next on" : "Now and Next off", $("nnbtn"));
  });
  window.scrollTo(0, 0);
  fab.lastY = 0; fab.reveal = 1;
}

// Render display blocks. Chord/lyric pairs wrap between words with chords riding
// on their word; tab systems are re-wrapped by measure to the screen width.
let redraw = null;
let refreshSpeed = () => {}; /* the song page's speed slider, after the length changes */
// Substitutions from Make it easier for the song on screen: shape name → easier chord.
let SUBS = {};
function chordLabel(text) {
  let name = String(text).split(/\s+/)[0].replace(/^\(|\)$/g, "");
  if (SUBS[name]) { text = String(text).replace(name, SUBS[name]); name = SUBS[name]; }
  return chordShape(name) ? `<span class="c" data-ch="${esc(name)}"><span class="ct">${esc(text)}</span></span>` : `<span class="c">${esc(text)}</span>`;
}
function renderBlocks(sheet, blocks) {
  const word = w => w.space ? " " : `<span class="w">${w.parts.map(p => p.chord
    ? `<span class="sg${p.free ? " free" : ""}">${chordLabel(p.chord)}<span class="l">${esc(p.text)}</span></span>`
    : esc(p.text)).join("")}</span>`;
  sheet.innerHTML = blocks.map((b, i) => {
    if (b.kind === "section") return `<div class="sec">${esc(b.text)}</div>`;
    if (b.kind === "blank") return `<div class="gap"></div>`;
    if (b.kind === "lyric") return `<div class="ly">${esc(b.text)}</div>`;
    if (b.kind === "chords") return `<div class="crow">${b.items.map(chordLabel).join("")}</div>`;
    if (b.kind === "pair") return `<div class="pr">${b.words.map(word).join("")}</div>`;
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
  // Current chord: the last chord that has reached the reading line.
  let idx = 0;
  for (let i = 0; i < diag.seq.length; i++) if (sheetTop + diag.seq[i].y <= line) idx = i;
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
function setCurrent(block) {
  if (block === diag.block) return;
  diag.block?.classList.remove("cur");
  block?.classList.add("cur");
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
  const want = diag.armed && !scroll.on && data.settings.pauseDiagrams !== false && diag.rows?.length && block;
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
  const el = document.createElement("div");
  el.className = "prow";
  el.style.top = (row.top - h - 9) + "px";
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
// ---------- Share ----------
// The song or set rides inside the link, so it works without a server or an account.
// Opening the link in Tabs offers to add it; nothing is added without a tap.
async function shareLink(payload, title, near) {
  const url = location.origin + location.pathname + "#/import/" + await packShare(payload);
  if (navigator.share) {
    try { await navigator.share({ title, text: title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied", near); }
  catch { showToCopy("Copy this link", url); }
}
const shareSong = song => shareLink({ song: shareable(song) }, `${song.title}${song.artist ? " · " + song.artist : ""} (Tabs)`, $("more"));
const shareSet = set => shareLink({ set: { name: set.name, songs: setSongs(set).map(shareable) } }, `${set.name} (Tabs set)`, $("s-share"));

async function renderImport(code) {
  const got = await unpackShare(code);
  const full = location.origin + location.pathname + "#/import/" + code;
  /* On iPhone, a link opens in Safari, which has a separate library from the Home Screen app. */
  const inBrowser = !(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
  history.replaceState(null, "", location.pathname + "#/");
  render();
  if (!got) return toast("That link didn't come through whole. Ask for it again");
  const songs = got.song ? [got.song] : got.set.songs;
  const have = songs.filter(x => findSame(data, x));
  const name = got.song ? `"${esc(got.song.title)}"${got.song.artist ? ` by ${esc(got.song.artist)}` : ""}` : `the set "${esc(got.set.name)}"`;
  layer.innerHTML = `
    <div class="scrim" id="im-scrim"></div>
    <div class="panel card" role="dialog" aria-label="Shared with you">
      <div class="pc-head">${icon("share")}<span>Shared with you</span></div>
      <p class="imp-t">Add ${name} to your library?</p>
      ${got.set ? `<div class="list glass imp-list">${songs.map(x => `<div class="row"><div class="txt"><div class="t">${esc(x.title)}</div><div class="a">${esc(x.artist || "Unknown artist")}${findSame(data, x) ? " · already in your library" : ""}</div></div></div>`).join("")}</div>` : ""}
      ${got.song && have.length ? `<p class="foot" style="margin:0 2px 12px">You already have a song with this name. Adding keeps both.</p>` : ""}
      ${inBrowser ? `<p class="foot" style="margin:0 2px 12px">Use Tabs from your Home Screen? It keeps its own library: <button class="linkbtn" id="im-copy">copy this link</button> and paste it into the search bar there.</p>` : ""}
      <div class="actions"><button class="btn" id="im-no">Not now</button><button class="btn primary" id="im-yes">${got.set ? "Add set" : "Add song"}</button></div>
    </div>`;
  const close = () => { layer.innerHTML = ""; };
  $("im-scrim").onclick = close; $("im-no").onclick = close;
  $("im-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(full); toast("Link copied"); } catch { showToCopy("Copy this link", full); } });
  $("im-yes").onclick = () => {
    close();
    if (got.song) { const s = Tabs.addSong(data, got.song); return go("#/song/" + encodeURIComponent(s.id)); }
    /* In a set, songs you already have are reused rather than copied. */
    const ids = [...songs].reverse().map(x => (findSame(data, x) || Tabs.addSong(data, x)).id).reverse();
    const set = Tabs.addSet(data, got.set.name);
    set.songIds = ids; Tabs.save(data);
    go("#/set/" + encodeURIComponent(set.id));
  };
}
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
  Tabs.save(data);
  loopRun = { pass: 0 };
  paintLoop(song);
  toast("Section set. Press play to practice it", $("play"));
}
function loopName(song) {
  const lines = sheetLines();
  for (let k = song.loop.a; k >= 0; k--) if (lines[k]?.classList.contains("sec")) return lines[k].textContent.trim();
  return `Lines ${song.loop.a + 1}–${song.loop.b + 1}`;
}
function paintLoop(song) {
  const lines = sheetLines();
  lines.forEach(el => el.classList.remove("inloop", "loopa", "loopfirst", "looplast"));
  const row = $("looprow");
  if (!song.loop || !lines[song.loop.b]) { if (row) row.innerHTML = ""; row?.classList.remove("on"); return; }
  for (let k = song.loop.a; k <= song.loop.b; k++) lines[k].classList.add("inloop");
  lines[song.loop.a].classList.add("loopfirst"); lines[song.loop.b].classList.add("looplast");
  if (!row) return;
  row.classList.add("on");
  row.innerHTML = `${icon("loop")}<span class="lt">Practicing <b>${esc(loopName(song))}</b>${loopRun.pass ? ` · pass ${loopRun.pass + 1}` : ""}</span>
    <button class="chip ${song.loop.build ? "on" : ""}" id="lp-build" aria-pressed="${!!song.loop.build}">Build up</button>
    <button class="sb" id="lp-x" aria-label="Stop practicing this section">${icon("x")}</button>`;
  $("lp-build").onclick = () => { song.loop.build = !song.loop.build; Tabs.save(data); paintLoop(song); };
  $("lp-x").onclick = () => { delete song.loop; Tabs.save(data); loopRun = { pass: 0 }; paintLoop(song); };
}
// Speed factor for the current pass.
const loopFactor = song => song.loop?.build ? Math.min(1, 0.8 + 0.05 * loopRun.pass) : 1;
// Called each frame while playing: when the section's last line passes the reading
// point, glide back to its first line and count a pass.
function loopCheck(song) {
  if (!song.loop) return false;
  const lines = sheetLines(), first = lines[song.loop.a], last = lines[song.loop.b];
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
  window.scrollTo({ top: Math.max(0, scrollY + first.getBoundingClientRect().top - line), behavior: calm() ? "auto" : "smooth" });
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
  toast("Tabs was updated. Reload to use this.", null, { label: "Reload", fn: () => location.reload() });
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
function songMenu(song, anchor, redrawSong) {
  const old = document.querySelector(".menu");
  if (old) { old.remove(); return; }
  markSeen("menu");
  document.querySelector("#more .newdot")?.remove();
  const ez = song.easier;
  const items = [
    { id: "size" },
    { id: "set", icon: "listplus", label: "Add to set" },
    { id: "loop", icon: "loop", label: "Practice a section" },
    { id: "metro", icon: "metro", label: "Metronome", hint: data.settings.metronome ? `On · ${song.bpm || 90}` : "Off" },
    { id: "listen", icon: "note", label: song.listen ? "Listening link" : "Find a recording", hint: song.listen ? song.listen.service : "" },
    { id: "tuner", icon: "fork", label: "Tuner", hint: songTuning(song) !== "standard" ? TUNINGS[songTuning(song)].name : "" },
    { id: "share", icon: "share", label: "Share song" },
    { id: "edit", icon: "edit", label: "Edit" },
    (aiKey() || ez) && { id: "easy", icon: "wand", label: "Make it easier", hint: ez ? (ez.on ? `On${ez.capo ? ` · Capo ${ez.capo}` : ""}` : "Off") : "" },
    (aiKey() || song.tone) && { id: "tone", icon: "amp", label: "Spark tone", hint: song.tone ? "Saved" : "" },
    song.ai === "chart" && !firstLyric(song.body) && { id: "words", icon: "edit", label: "Add the words" }
  ].filter(Boolean);
  const m = document.createElement("div");
  m.className = "menu glass float";
  m.setAttribute("role", "menu");
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 8) + "px";
  m.style.right = Math.max(12, innerWidth - r.right) + "px";
  const paint = () => {
    m.innerHTML = items.map(it => it.id === "size"
      ? `<div class="mrow size" role="group" aria-label="Text size"><span class="mi">${icon("text")}</span><span class="ml" aria-hidden="true">Text size</span>
          <button class="sb" role="menuitem" data-d="-1" aria-label="Smaller text">${icon("minus")}</button><span class="v">${Math.round(song.size * 100)}%</span><button class="sb" role="menuitem" data-d="1" aria-label="Larger text">${icon("plus")}</button></div>`
      : `<button class="mrow" role="menuitem" data-m="${it.id}"><span class="mi">${icon(it.icon)}</span><span class="ml">${it.label}${NEW_IN_MENU[it.id] ? newDot(NEW_IN_MENU[it.id]) : ""}</span>${it.hint ? `<span class="mh">${esc(it.hint)}</span>` : ""}</button>`).join("");
  };
  paint();
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener("click", outside, true); window.removeEventListener("scroll", close); };
  const outside = ev => { if (!m.contains(ev.target)) close(); };
  setTimeout(() => { document.addEventListener("click", outside, true); window.addEventListener("scroll", close, { passive: true }); });
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
    const b = ev.target.closest("[data-m]");
    if (!b) return;
    if (NEW_IN_MENU[b.dataset.m]) markUsed(NEW_IN_MENU[b.dataset.m]);
    close();
    ({ set: () => addToSet(song), edit: () => songEditor(song),
       easy: () => aiKey() ? easierSheet(song) : (ez.on = !ez.on, Tabs.save(data), redrawSong()),
       tone: () => toneSheet(song), share: () => shareSong(song), loop: () => startLoopPick(song), tuner: () => openTuner(songTuning(song)),
       listen: () => listenSheet(song, true),
       words: () => wordsFor(song),
       metro: () => { data.settings.metronome = !data.settings.metronome; Tabs.save(data);
         if (scroll.on) data.settings.metronome ? startMetronome(song) : stopMetronome();
         toast(data.settings.metronome ? `Metronome on · ${song.bpm || 90} BPM${song.bpm ? "" : " (set the tempo in Edit)"}` : "Metronome off", $("more")); } })[b.dataset.m]?.();
  };
}

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
function findCard(q) {
  return `<div class="findcard">
    <div class="fc-t">“${esc(q.trim())}” isn't in your library yet</div>
    <p class="fc-s">Find a chord sheet, copy it, and come back. Tabs will offer to add what you copied.</p>
    <div class="fc-b">${FIND_SITES.map(([k, l]) => `<button class="chip" data-find="${k}">${icon(k === "web" ? "search" : "link")}${l}</button>`).join("")}</div>
    ${aiKey() ? `<button class="fc-ai" id="fc-ai">${icon("wand")}<span><b>Chord chart with AI</b>Chords, key and structure from the web. No lyrics.</span>${icon("chev", "chev")}</button>` : ""}
  </div>`;
}
function bindFind(list) {
  list.querySelectorAll("[data-find]").forEach(b => b.onclick = () => {
    const site = FIND_SITES.find(x => x[0] === b.dataset.find);
    pendingFind = { q: query.trim(), at: Date.now() };
    window.open(site[2](query.trim()), "_blank", "noopener");
  });
  $("fc-ai")?.addEventListener("click", () => chartSheet(query.trim()));
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
// Chord charts and "What can I play next?" load on first use (findai.js).
const findAI = () => lazy("findai.js");
// Leave search mode (used when a song is added from a chart).
function leaveSearch() { if (searching) { searching = false; document.body.classList.remove("searching"); query = ""; } }
function chartSheet(...args) { findAI().then(m => m.chartSheet(...args)); }
function nextSongs() { findAI().then(m => m.nextSongs()); }

// ---------- Listen ----------
// A link to the recording, Apple Music first. Tabs looks the song up in Apple's
// public catalog search (no account or key), shows the best match to confirm,
// and saves it with the song. If the lookup can't run, it opens Apple Music's
// own search instead, or takes a pasted Apple Music, Spotify or YouTube link.
const appleSearchURL = song => `https://music.apple.com/search?term=${encodeURIComponent(`${song.title} ${song.artist || ""}`.trim())}`;
function openLink(url) { if (/^https:\/\//.test(url)) window.open(url, "_blank", "noopener"); }
async function findTracks(song, q) {
  const j = await itunes("search", { term: q || `${song.title} ${song.artist || ""}`.trim(), media: "music", entity: "song", limit: 12 });
  return rankTracks(j?.results || [], song.title, song.artist);
}
function saveListen(song, url, extra = {}) {
  song.listen = { url, service: linkService(url), ...extra };
  Tabs.save(data);
  const chip = $("listen");
  if (chip) chip.innerHTML = `${icon("note")}${esc(song.listen.service)}`;
}
// The recording's length becomes the song's length (for song length speed) when
// you haven't set one; if you have, it's offered instead of replacing yours.
function useRecordingLength(song, seconds, { quiet = false } = {}) {
  if (song.listen) song.listen.length = Math.round(seconds);
  const choice = lengthChoice(song, seconds, data.settings);
  const len = fitLength(seconds);
  if (choice === "set") {
    song.duration = len;
    Tabs.save(data); refreshSpeed();
    if (!quiet || viewing === song) { toast(`Length set from the recording: ${mmss(len)}`); return true; }
  } else {
    Tabs.save(data);
    if (choice === "offer" && !quiet && byLength()) { toast(`The recording is ${mmss(len)}. Yours is ${mmss(songLength(song))}.`, null, { label: `Use ${mmss(len)}`, fn: () => { song.duration = len; song.durationSet = true; Tabs.save(data); refreshSpeed(); toast(`Length ${mmss(len)}`); } }); return true; }
  }
  return false;
}
// A pasted Apple Music link: ask Apple's catalog for the track's length.
const lookedUp = new Set();
async function recordingLength(song, url, opts) {
  const id = appleTrackId(url);
  if (!id || lookedUp.has(song.id + id)) return;
  lookedUp.add(song.id + id);
  try {
    const hit = ((await itunes("lookup", { id, entity: "song" }))?.results || []).find(x => x.trackTimeMillis), ms = hit?.trackTimeMillis;
    /* A pasted link brings its album art too (for set covers). */
    if (hit?.artworkUrl100 && song.listen?.url === url && !song.listen.art) { song.listen = { ...song.listen, art: hit.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb") }; Tabs.save(data); }
    if (ms && song.listen?.url === url) useRecordingLength(song, ms / 1000, opts);
  } catch { /* noted for diagnostics */ }
}
// Listen: find the recording without leaving Tabs. Apple Music's catalog is
// searched here (title and artist to start; change the words to search again),
// each result can be previewed (30 seconds, from Apple), and a tap saves it,
// with its album art and length. Paste a link is for Spotify or YouTube.
let preview = null;
function stopPreview() { if (preview) { preview.audio.pause(); preview = null; document.querySelectorAll(".ls-pv.on").forEach(b => { b.classList.remove("on"); b.innerHTML = icon("play"); }); } }
onLeave(() => stopPreview());
function listenSheet(song, force) {
  if (song.listen && !force) return openLink(song.listen.url);
  const first = `${song.title} ${song.artist || ""}`.trim();
  let state = { busy: true, tracks: [], error: false, q: first, all: false };
  const close = () => { stopPreview(); layer.innerHTML = ""; };
  const row = (x, i) => `<div class="ls-item"><button class="row pick ls-row" data-t="${i}">
      ${x.artworkUrl100 ? `<img src="${esc(x.artworkUrl100)}" alt="" width="44" height="44" loading="lazy">` : `<span class="ls-art">${icon("note")}</span>`}
      <div class="txt"><div class="t">${esc(x.trackName)}</div><div class="a">${esc(x.artistName)}${x.collectionName ? ` · ${esc(x.collectionName)}` : ""}</div></div></button>
      ${x.previewUrl ? `<button class="sb ls-pv" data-pv="${i}" aria-label="Hear a preview of ${esc(x.trackName)}">${icon("play")}</button>` : ""}</div>`;
  const results = () => {
    const best = state.tracks[0], sure = state.q === first && best && best.score >= 5 && !state.all;
    if (state.busy) return `<div class="easy-wait">${busy("Looking in Apple Music")}</div>`;
    if (state.error) return `<p class="easy-note">Couldn't reach Apple Music's catalog just now.</p>
      <div class="ls-other"><button class="linkbtn" id="ls-retry">Try again</button><button class="linkbtn" id="ls-apple">Search in Apple Music</button></div>`;
    if (!state.tracks.length) return `<p class="easy-note">No match. Try fewer words, or the artist's name.</p>`;
    return `<p class="easy-note">${sure ? "Found it on Apple Music. Is this the one?" : "Tap the right recording:"}</p>
      <div class="list glass ls-list">${(sure ? state.tracks.slice(0, 1) : state.tracks.slice(0, 8)).map(row).join("")}</div>
      ${sure && state.tracks.length > 1 ? `<button class="linkbtn ls-more" id="ls-more">Not this one? Show others</button>` : ""}`;
  };
  const paintResults = () => {
    const box = $("ls-res");
    if (!box) return;
    stopPreview();
    box.innerHTML = results();
    box.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
      const x = state.tracks[+b.dataset.t];
      saveListen(song, x.trackViewUrl, { title: x.trackName, artist: x.artistName, ...(x.artworkUrl100 ? { art: x.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb") } : {}) });
      close();
      if (x.trackTimeMillis && useRecordingLength(song, x.trackTimeMillis / 1000)) return;
      toast(`Saved: ${x.trackName}`, null, { label: "Listen", fn: () => openLink(x.trackViewUrl) });
    });
    box.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => {
      const x = state.tracks[+b.dataset.pv], was = preview?.i;
      stopPreview();
      if (was === +b.dataset.pv) return;
      const audio = new Audio(x.previewUrl);
      preview = { audio, i: +b.dataset.pv };
      b.classList.add("on"); b.innerHTML = icon("pause");
      audio.onended = stopPreview;
      audio.play().catch(() => { stopPreview(); toast("The preview couldn't play"); });
    });
    $("ls-more")?.addEventListener("click", () => { state.all = true; paintResults(); });
    $("ls-retry")?.addEventListener("click", () => search(state.q || first));
    $("ls-apple")?.addEventListener("click", () => openLink(`https://music.apple.com/search?term=${encodeURIComponent(state.q || first)}`));
  };
  let seq = 0;
  const search = q => {
    const n = ++seq;
    state = { ...state, busy: true, q };
    paintResults();
    findTracks(song, q).then(t => { if (n === seq) { state = { ...state, busy: false, tracks: t, error: false }; paintResults(); } })
      .catch(() => { if (n === seq) { state = { ...state, busy: false, tracks: [], error: true }; paintResults(); } });
  };
  layer.innerHTML = `<div class="scrim" id="ls-scrim"></div><div class="panel card" id="ls-panel" role="dialog" aria-label="Listen">
    <div class="pc-head">${icon("note")}<span>Listen · ${esc(song.title)}</span></div>
    <form class="ls-q" id="ls-form" role="search"><span class="ls-qi">${icon("search")}</span>
      <input id="ls-q" type="search" value="${esc(first)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search Apple Music"></form>
    <div id="ls-res"></div>
    ${song.listen ? `<p class="foot" style="margin:10px 2px 0">Saved: ${esc(song.listen.service)}${song.listen.title ? ` · ${esc(song.listen.title)}` : ""}</p>` : ""}
    <div class="ls-other"><button class="linkbtn" id="ls-paste">Paste a Spotify or YouTube link</button>
      ${song.listen ? `<button class="danger" id="ls-clear">Remove link</button>` : ""}</div></div>`;
  $("ls-scrim").onclick = close;
  const q = $("ls-q");
  q.value = first;
  let typing = 0;
  q.oninput = () => { clearTimeout(typing); typing = setTimeout(() => { if (q.value.trim()) search(q.value.trim()); }, 600); };
  $("ls-form").onsubmit = e => { e.preventDefault(); clearTimeout(typing); q.blur(); if (q.value.trim()) search(q.value.trim()); };
  $("ls-paste").onclick = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { /* not allowed: ask below */ }
    const use = text => {
      const url = (text.match(/https:\/\/\S+/) || [])[0];
      if (!url) return toast("That doesn't look like a link");
      saveListen(song, url);
      close();
      toast(`Saved the ${linkService(url)} link`);
      if (appleTrackId(url)) recordingLength(song, url);
    };
    if (/^https?:\/\//.test(text.trim())) return use(text);
    ask({ title: "Paste the song's link", text: "From Spotify or YouTube: tap Share, then Copy Link.", placeholder: "https://…", caps: "none", ok: "Save link" }, use);
  };
  $("ls-clear")?.addEventListener("click", () => { delete song.listen; Tabs.save(data); close(); const c = $("listen"); if (c) c.innerHTML = `${icon("note")}Listen`; toast("Link removed"); });
  search(first);
}

// ---------- Metronome ----------
// A steady click at the song's tempo while it scrolls (on from the ••• menu).
// Beats are scheduled ahead on the audio clock, so they stay even.
const metro = { timer: 0, next: 0, beat: 0 };
function startMetronome(song) {
  stopMetronome();
  if (!data.settings.metronome) return;
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const spb = 60 / (song.bpm || 90);
  metro.next = audio.currentTime + 0.05; metro.beat = 0;
  metro.timer = setInterval(() => {
    while (metro.next < audio.currentTime + 0.12) {
      clickAt(metro.next, metro.beat % 4 === 0);
      metro.next += spb; metro.beat++;
    }
  }, 25);
}
function stopMetronome() { clearInterval(metro.timer); metro.timer = 0; }
function clickAt(t, accent) {
  const o = audio.createOscillator(), g = audio.createGain();
  o.frequency.value = accent ? 1320 : 880;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.12, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + 0.09);
}

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
  box.innerHTML = names.length ? `
    <div class="strip-h"><span>Chords in this song</span>${easyBtn}</div>
    <div class="strip" role="list">${names.map(n =>
      `<button class="scard" role="listitem" data-name="${esc(n)}" aria-label="${esc(n)}: show where it's played">${chordSVG(n)}</button>`).join("")}</div>` : "";
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
let stageTap = 0;
document.addEventListener("click", e => {
  if (route().name !== "song" || !$("sheet") || chordEdit) return;
  if (loopPick && e.target instanceof Element) {
    const el = e.target.closest(".sheet > *");
    if (el && !el.classList.contains("prow") && !el.classList.contains("dpop") && !el.classList.contains("gap")) { e.preventDefault(); pickLoopLine(el); }
    return;
  }
  /* While playing, a tap anywhere on the page pauses, so there's no button to aim for. */
  /* (A target no longer in the page was a button that redrew itself, like play.) */
  if (scroll.on && e.target instanceof Element && e.target.isConnected && !e.target.closest("button, a, input, select, label, .dock, .menu, .panel, .scrim, .nextup, .chead, .loopbanner")) {
    /* On stage a single stray touch shouldn't stop the song: tap twice to pause. */
    if (data.settings.stage && Date.now() - (stageTap || 0) > 1500) {
      stageTap = Date.now();
      document.querySelector(".tappause")?.remove();
      const h = document.createElement("div");
      h.className = "tappause hint";
      h.textContent = "Tap again to pause";
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1500);
      return;
    }
    stageTap = 0;
    document.querySelector(".tappause")?.remove();
    markUsed(data.settings.stage ? "pauseStage" : "pause");
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
  hold.timer = setTimeout(() => { if (!hold.touching) hold.active = false; }, ms);
}
window.addEventListener("touchstart", e => {
  if (e.target instanceof Element && e.target.closest(".dock")) return;
  hold.touching = true; hold.active = true; clearTimeout(hold.timer);
}, { passive: true });
window.addEventListener("touchend", () => { hold.touching = false; releaseSoon(180); }, { passive: true });
/* Stage mode: while a song plays, a brushing hand can't scroll the page. */
window.addEventListener("touchmove", e => {
  if (data.settings.stage && scroll.on && !(e.target instanceof Element && e.target.closest(".dock, .panel, .menu"))) e.preventDefault();
}, { passive: false });
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
function pxPerSecond(song) {
  if (!byLength()) return song.speed * 0.6;
  const lines = diag.blocks.filter(b => b.el.isConnected);
  const range = lines.length > 1 ? lines[lines.length - 1].y - lines[0].y : document.documentElement.scrollHeight - innerHeight;
  return Math.max(4, range / songLength(song));
}

// One bar of count-in before scrolling: four beats at the song's tempo (90 if unset),
// shown large and quiet over the reading point, with a soft click.
let audio = null;
function click(accent) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
    o.frequency.value = accent ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.15, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.1);
  } catch {}
}
function countIn(song) {
  return new Promise(resolve => {
    const beat = 60000 / (song.bpm || 90);
    const el = document.createElement("div");
    el.className = "countin";
    el.style.top = (innerHeight * READ_AT - 60) + "px";
    document.body.appendChild(el);
    let n = 4;
    const tick = () => {
      if (!scroll.on) { el.remove(); return resolve(false); }
      if (n === 0) { el.remove(); return resolve(true); }
      el.textContent = 5 - n;
      el.classList.remove("pulse"); void el.offsetWidth; el.classList.add("pulse");
      click(n === 4);
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

let playsHere = 0; /* plays since the app opened, for pacing tips */
async function startScroll(song) {
  document.querySelector(".endnote")?.remove();
  /* Count in only when starting from the top: the song's first line is on screen. */
  const first = $("sheet")?.querySelector(":scope > .pr, :scope > .ly, :scope > .tab, :scope > .crow");
  const fr = first?.getBoundingClientRect();
  const atTop = !fr || (fr.bottom > 0 && fr.top < innerHeight);
  scroll.on = true; scroll.last = 0; scroll.carry = 0; scroll.bottomSince = 0; scroll.logged = false;
  document.body.classList.add("playing");
  playsHere++;
  setTimeout(() => {
    const k = data.settings.stage ? "pauseStage" : "pause";
    if (scroll.on && viewing === song && coachTip(k)) demoPause();
  }, 2500);
  wakeControls();
  showChordPop(null);
  $("sheet")?.querySelectorAll(".prow").forEach(el => el.remove());
  diag.rowKey = null;
  if (song.loop) {
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
  btn.innerHTML = icon("pause");
  btn.setAttribute("aria-label", "Pause auto-scroll");
  try { scroll.lock = await navigator.wakeLock?.request("screen"); } catch {}
  if (data.settings.countIn !== false && atTop && !(await countIn(song))) return;
  startMetronome(song);
  const tick = t => {
    if (!scroll.on) return;
    if (scroll.last && !hold.active) {
      if (loopCheck(song)) { scroll.last = t; scroll.raf = requestAnimationFrame(tick); return; }
      scroll.carry += (t - scroll.last) / 1000 * pxPerSecond(song) * loopFactor(song);
      const px = Math.floor(scroll.carry);
      if (px) { window.scrollBy(0, px); scroll.carry -= px; nextLine(); }
      // At the end: wait a few seconds (the reader may scroll back up), then stop.
      if (!song.loop && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        if (!scroll.bottomSince && !scroll.logged) { scroll.logged = true; Tabs.logPlay(data, song); curPaintStat?.(); endMoment(song); if (setRun && setCtx?.id === setRun.id) setRun.played.add(song.id); if (setCtx) nextUp(); }
        scroll.bottomSince ||= t;
        if (t - scroll.bottomSince > 4000) return stopScroll();
      } else scroll.bottomSince = 0;
    }
    scroll.last = t;
    scroll.raf = requestAnimationFrame(tick);
  };
  scroll.raf = requestAnimationFrame(tick);
}

onLeave(() => stopScroll());
function stopScroll() {
  const was = scroll.on;
  scroll.on = false;
  stopMetronome();
  clearTimeout(scroll.countTimer);
  document.querySelectorAll(".countin").forEach(el => el.remove());
  document.body.classList.remove("playing");
  wakeControls();
  cancelAnimationFrame(scroll.raf);
  scroll.lock?.release?.().catch(() => {});
  scroll.lock = null;
  const btn = $("play");
  if (btn) { btn.innerHTML = icon("play"); btn.setAttribute("aria-label", "Start auto-scroll"); }
  updateDiagrams();
  if (btn) { diag.armed = true; showPausedRow(); }
  /* After playing: the first pause shows starting from a line; a later one, Now and Next. */
  if (was && btn && !chordEdit) setTimeout(() => {
    if (scroll.on || chordEdit || route().name !== "song" || layer.innerHTML) return;
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
      <div class="actions"><button class="btn" id="oops-copy">Copy details</button><button class="btn primary" id="oops-home">Library</button></div></div>`;
    $("oops-copy").onclick = copyDiagnostics;
    $("oops-home").onclick = () => { if (route().name === "library") location.reload(); else go("#/"); };
  }
}
function renderRoute() {
  const r = route();
  leaveHooks.forEach(fn => fn(r));
  app.classList.remove("viewer");
  layer.innerHTML = "";
  /* Old links: #/add and #/edit/<id> open the editor. */
  if (r.name === "add") { history.replaceState(null, "", "#/"); return newSong(); }
  if (r.name === "edit") { openEdit = { id: r.id, view: "text" }; history.replaceState(null, "", "#/song/" + encodeURIComponent(r.id)); return renderRoute(); }
  if (r.name === "song") {
    renderViewer(r.id);
    const want = openEdit;
    openEdit = null;
    const song = viewing?.id === r.id && want?.id === r.id ? viewing : null;
    if (song) songEditor(song, want.view);
  }
  else if (r.name === "settings" || r.name === "trash") settingsMod().then(m => { if (route().name !== r.name) return; (r.name === "settings" ? m.renderSettings : m.renderTrash)(); window.scrollTo(0, 0); });
  else if (r.name === "gestures") { renderGestures(); window.scrollTo(0, 0); }
  else if (r.name === "sketch") lazy("sketch.js").then(m => { if (route().name === "sketch") m.renderSketch(); });
  else if (r.name === "set") { renderSet(r.id); window.scrollTo(0, 0); }
  else if (r.name === "import") renderImport(r.id);
  else { renderLibrary(); }
}

// Screen changes animate with the browser's view transitions where supported:
// a short cross-fade, and the song title glides between the library row and the
// song header. Instant when Reduce Motion is on or the browser lacks support.
const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
let lastOpened = null; // id of the song whose title should glide back to its row
window.addEventListener("hashchange", () => {
  if (!document.startViewTransition || calm()) return render();
  const leaving = route().name !== "song" && viewing ? viewing.id : null;
  if (leaving) lastOpened = leaving;
  document.startViewTransition(() => render());
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
export { $, data, icon, layer, esc, coach, coachTip, markUsed, tick, toast, go, busy, AI, aiKey, askClaude, aiError, parseJSON, openLink, appleSearchURL, leaveSearch, chordNames, chordSVG, songKey, redraw, READ_AT, applyPaused, calm, card, chordEdit, diag, map, openEdit, openTuner, paintMap, route, scroll, searching, setCurrent, showChordPop, viewing, setOpenEdit, applyTheme, render, setData, mmss, filter, keyOf, lazy, shareSet, songLength, songTuning, setFilter, cleanSheet, demoTap, readPhoto, stopScroll, takeDemo, setChordEdit, settleNew, newSong };
