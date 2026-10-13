// Tabs app: screens and interaction. core.js holds the logic that has unit tests.
import { Tabs, SPEEDS, TRASH_DAYS, playsThisWeek, playCount, packShare, unpackShare, shareable, findSame, searchSongs, sortSongs, lastPlayed, TUNINGS, detectTuning, rankTracks, linkService, firstLyric, chordModel, setChordAt, chordsUsed, setLineText, renameSection, insertLines, nextSet, untilLabel, logSetRun, parseSheet, parseBlocks, wrapTab, guessKey, transposeKey, prefersFlats, detectPaste, chordShape, looksLikeTab } from "./core.js";

// ---------- Icons ----------
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  gauge: '<path d="M4.5 17a9 9 0 1 1 15 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13" r="1.2"/>',
  note: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v5h16v-5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 14v5h16v-5"/>',
  focus: '<path d="M4 7h16"/><path d="M4 12h16" stroke-width="2.4"/><path d="M4 17h16"/>',
  wand: '<path d="M4 20 14.5 9.5"/><path d="m13 8 3 3"/><path d="M17 3.5v3M15.5 5h3M20 9v2M19 10h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.4 4.4 0 0 0 7 18z"/><path d="M12 15V10M9.8 12 12 9.8l2.2 2.2"/>',
  trash: '<path d="M4 7h16M10 7V4.5h4V7M6 7l1 13h10l1-13"/>',
  metro: '<path d="M8 21h8l-2.5-17h-3z"/><path d="M12 16l5-9"/>',
  listplus: '<path d="M4 7h11M4 12h11M4 17h7M18 14v6M15 17h6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  fork: '<path d="M9 3v7a3 3 0 0 0 6 0V3"/><path d="M12 13v8"/>',
  stage: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  pick: '<path d="M12 3c4 0 7 2 7 6 0 5-4 10-7 12-3-2-7-7-7-12 0-4 3-6 7-6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  image: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20.5 15l-5-5L5 20.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  amp: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="13" r="3"/><path d="M15 10h3M15 13h3M15 16h3M6 8h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  dots: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M6 11H5v9h14v-9h-1"/>',
  loop: '<path d="M17 4l3 3-3 3"/><path d="M4 12V9a2 2 0 0 1 2-2h14"/><path d="M7 20l-3-3 3-3"/><path d="M20 12v3a2 2 0 0 1-2 2H4"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  fretboard: '<path d="M6 4h12M6 4v16M10 4v16M14 4v16M18 4v16M6 9h12M6 14h12"/><circle cx="10" cy="11.5" r="1.4" fill="currentColor"/><circle cx="14" cy="16.5" r="1.4" fill="currentColor"/>',
  clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/>'
};
const icon = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = id => document.getElementById(id);

// ---------- State ----------
let data = Tabs.load();
// Saves are batched (see core.js). Write right away when the app goes to the
// background or closes, and say so if the phone won't store the library.
let saveWarned = 0;
Tabs.onSaveError = () => {
  if (Date.now() - saveWarned < 60e3) return;
  saveWarned = Date.now();
  toast("Couldn't save: the phone's storage for Tabs is full. Back up, then remove songs or cover photos you don't need.", null, { label: "Back up", fn: () => backupNow() });
};
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") Tabs.flush(); });
window.addEventListener("pagehide", () => Tabs.flush());
let query = "";
let filter = "all";
// Search mode: tapping the bar moves it to the top and folds the library away, so
// results sit between the bar and the keyboard. (iPhone doesn't resize the page
// for the keyboard; it pushes the page up instead, which hid results at the top.)
let searching = false;
let keepSearch = false; /* back from a song opened from results: show the results again */
// Leaving a screen: each feature registers its own tidy-up next to its code,
// and render() runs them all before drawing the next screen.
const leaveHooks = [];
const onLeave = fn => leaveHooks.push(fn);
// Scrolling: one listener for the whole app, at most once per frame. Features
// register what they do on scroll with onScroll.
const scrollHooks = [];
const onScroll = fn => scrollHooks.push(fn);
let scrollFrame = 0;
window.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; scrollHooks.forEach(fn => fn()); });
}, { passive: true });
onLeave(r => { if (r.name !== "library" && searching) { searching = false; document.body.classList.remove("searching"); } });
const app = $("app");
const layer = $("layer");

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
function applyTheme() {
  sysText = readSysText();
  const light = data.settings.theme === "light";
  document.body.classList.toggle("stage", !!data.settings.stage);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]').content = light ? "#f3f0eb" : "#0c0d0f";
}

// A short message. With `near`, it appears just above that control, where the eye already is.
function toast(msg, near, action) {
  const t = $("toast");
  clearTimeout(toast.timer);
  t.classList.remove("show", "near");
  t.style.left = t.style.top = "";
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.className = "tact";
    b.textContent = action.label;
    b.onclick = () => { clearTimeout(toast.timer); t.classList.remove("show"); action.fn(); };
    t.appendChild(b);
  }
  if (near) {
    const r = near.getBoundingClientRect();
    const above = (near.closest(".pw") || near).getBoundingClientRect().top;
    t.classList.add("near");
    const w = t.offsetWidth;
    const x = Math.min(window.innerWidth - w / 2 - 12, Math.max(w / 2 + 12, r.left + r.width / 2));
    t.style.left = x + "px";
    /* Near a header button there's no room above, so show it just below instead. */
    const top = above - t.offsetHeight - 10;
    t.style.top = (top < 12 ? r.bottom + 10 : top) + "px";
  }
  void t.offsetWidth; // restart the transition
  t.classList.add("show");
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 6000 : near ? 1400 : 2000);
}

const go = h => { location.hash = h; };
const route = () => {
  const [, name = "", id = ""] = location.hash.split("/");
  return { name: name || "library", id: decodeURIComponent(id) };
};
const keyOf = s => s.format === "tab" ? "TAB" : (s.key || guessKey(s.body || ""));

// Keep bottom bars above the iOS keyboard.
function followKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  if (searching) { document.querySelectorAll(".kb").forEach(el => { el.style.transform = ""; }); return; }
  const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.querySelectorAll(".kb").forEach(el => {
    el.style.transform = `translate(-50%, ${-off}px)`;
  });
}
window.visualViewport?.addEventListener("resize", followKeyboard);
window.visualViewport?.addEventListener("scroll", followKeyboard);

// ---------- Keeping the library safe ----------
// Ask the browser to keep this site's storage permanently (it may still decide).
let storageKept = null;
navigator.storage?.persist?.().then(ok => { storageKept = ok; }).catch(() => {});
navigator.storage?.persisted?.().then(ok => { if (storageKept === null) storageKept = ok; }).catch(() => {});

const WEEK = 7 * 86400000;
function needsBackup() {
  if (!data.songs.length) return false;
  const s = data.settings, now = Date.now();
  if (s.backupSnooze && now < s.backupSnooze) return false;
  return !s.lastBackup || now - Date.parse(s.lastBackup) > WEEK;
}
function ago(iso) {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}
// Share sheet first (Save to Files → iCloud Drive on iPhone); download otherwise.
async function backupNow() {
  const name = `tabs-backup-${new Date().toISOString().slice(0, 10)}.json`;
  /* Cover photos ride along in the backup (they live outside the main save). */
  const covers = Object.fromEntries(data.sets.filter(x => x.cover?.type === "photo" && coverCache[x.id]).map(x => [x.id, coverCache[x.id]]));
  const file = new File([Object.keys(covers).length ? JSON.stringify({ ...data, covers }, null, 2) : Tabs.export(data)], name, { type: "application/json" });
  let done = false;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Tabs backup" }); done = true; }
    catch (e) { if (e.name === "AbortError") return false; }
  }
  if (!done) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  data.settings.lastBackup = new Date().toISOString();
  data.settings.backupSnooze = null;
  Tabs.save(data);
  return true;
}

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
  bindShelf();
  const q = $("q");
  const enterSearch = () => {
    if (searching) return;
    searching = true;
    document.body.classList.add("searching");
    window.scrollTo(0, 0);
    renderList();
  };
  const exitSearch = () => {
    searching = false;
    query = ""; q.value = ""; $("clear").hidden = true;
    document.body.classList.remove("searching");
    q.blur();
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
  setTimeout(() => { if (route().name === "library" && !layer.innerHTML) showTips("library"); }, 400);
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
const SORTS = { title: "A–Z", recent: "Recently played", most: "Most played", key: "Key" };
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

function renderList() {
  const list = $("list");
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
    list.innerHTML = `<div class="label">${recentSongs.length ? "Recently played" : "All songs"}</div><div class="list glass">${shown.map(s => songRow(s)).join("")}</div>
      <p class="empty-hint" style="margin-top:12px">Search titles, artists or a line from the lyrics. Paste a chord sheet here to add it.</p>
      ${aiKey() && data.songs.length ? `<button class="nextidea glass" id="nextidea">${icon("wand")}<span><b>What can I play next?</b>Songs that use the chords you already know</span>${icon("chev", "chev")}</button>` : ""}`;
    bindRows(list);
    $("nextidea")?.addEventListener("click", () => nextSongs());
    return;
  }
  const pool = searching ? data.songs : data.songs.filter(s =>
    (filter !== "fav" || s.favorite) && (filter !== "tab" || s.format === "tab") && (filter !== "learn" || s.status === "learning"));
  /* Searching: title and artist matches first, then songs whose lyrics have the words. */
  const found = q ? searchSongs(pool, q) : null;
  const sort = SORTS[data.settings.sort] ? data.settings.sort : "title";
  const recent = !q && filter === "all" && sort !== "recent" && data.songs.length >= 4 && !data.sets.length
    ? data.songs.filter(s => s.opened).sort((a, b) => b.opened - a.opened).slice(0, 2) : [];
  const sorted = found ? found.map(x => x.song) : sortSongs(pool, sort, keyOf);
  const hits = new Map((found || []).filter(x => x.line).map(x => [x.song.id, lyricHit(x.line, q)]));

  list.innerHTML = `
    ${recent.length ? `<div class="label">Recent</div><div class="recent">${recent.map(s => `
      <button class="rc glass" data-id="${esc(s.id)}">
        <div class="t">${esc(s.title)}</div>
        <div class="a">${esc(s.artist || "Unknown artist")}</div>
      </button>`).join("")}</div>` : ""}
    ${q ? "" : `<div class="label lrow"><span>${filter === "fav" ? "Favorites" : filter === "tab" ? "Tabs" : filter === "learn" ? "Learning" : "All songs"}</span>
      <label class="sortby">${esc(SORTS[sort])}${icon("chev", "chev")}<select id="sort" aria-label="Sort songs">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${k === sort ? "selected" : ""}>${v}</option>`).join("")}</select></label></div>`}
    ${sorted.length ? `<div class="list glass" style="${q ? "margin-top:18px" : ""}">${sorted.map(s => songRow(s, hits.get(s.id))).join("")}</div>` : findCard(query)}`;
  $("sort")?.addEventListener("change", e => { data.settings.sort = e.target.value; Tabs.save(data); renderList(); });
  bindRows(list);
  bindFind(list);
}
function bindRows(list) {
  list.querySelectorAll("[data-id]").forEach(el => el.onclick = () => {
    setCtx = null;
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
  diag.armed = false; diag.rowKey = null; diag.pinned = null; diag.scrolling = false; diag.block = null;
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" data-go="#/" aria-label="Back to library">${icon("back")}</button>
      <div class="row-btns">
        <button class="ib glass fav ${song.favorite ? "on" : ""}" aria-label="Favorite" aria-pressed="${!!song.favorite}">${icon("heart")}</button>
        <button class="ib glass more" id="more" aria-label="More for this song" aria-haspopup="menu">${icon("dots")}</button>
      </div>
    </div>
    ${(() => { const x = setCtx && data.sets.find(z => z.id === setCtx.id); const list = x ? setSongs(x) : [];
      if (!x || list[setCtx.idx]?.id !== song.id) { setCtx = null; return ""; }
      return `<div class="setbar"><button class="sb" id="sprev" aria-label="Previous song" ${setCtx.idx === 0 ? "disabled" : ""}>${icon("back")}</button>
        <button class="setname" data-go="#/set/${encodeURIComponent(x.id)}">${esc(x.name)} · ${setCtx.idx + 1} of ${list.length}</button>
        <button class="sb" id="snext" aria-label="Next song" ${setCtx.idx === list.length - 1 ? "disabled" : ""}>${icon("chev")}</button></div>`; })()}
    <h1 class="song-title" style="view-transition-name: song-title">${esc(song.title)}</h1>
    <div class="metarow"><div class="meta" id="meta"></div><button class="stat" id="stat" aria-label="Learning status"></button><button class="stat listen" id="listen" aria-label="${song.listen ? `Listen on ${esc(song.listen.service)}` : "Find a recording to listen to"}">${icon("note")}${song.listen ? esc(song.listen.service) : "Listen"}</button>${songTuning(song) !== "standard" ? `<button class="stat tunechip" id="tunechip" aria-label="Tuning: ${TUNINGS[songTuning(song)].name}. Open the tuner">${icon("fork")}${TUNINGS[songTuning(song)].name}</button>` : ""}</div>
    <div id="strip"></div>
    <header class="chead" id="chead" aria-hidden="true">
      <div class="in">
        <button class="ib glass" data-go="#/" aria-label="Back to library" tabindex="-1">${icon("back")}</button>
        <button class="ctitle" id="ctitle" aria-label="Back to top of song" tabindex="-1">
          <div class="ct">${esc(song.title)}</div>
          <div class="cs" id="csub"></div>
        </button>
        <button class="ib glass fav ${song.favorite ? "on" : ""}" aria-label="Favorite" aria-pressed="${!!song.favorite}" tabindex="-1">${icon("heart")}</button>
        <button class="ib glass more" aria-label="More for this song" aria-haspopup="menu" tabindex="-1">${icon("dots")}</button>
      </div>
    </header>
    <div class="sheet" id="sheet"></div>
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
  const step2 = d => { const x = data.sets.find(z => z.id === setCtx.id), list = setSongs(x), n = list[setCtx.idx + d]; if (!n) return; setCtx = { id: x.id, idx: setCtx.idx + d }; go("#/song/" + encodeURIComponent(n.id)); };
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
  else setTimeout(() => { if (viewing === song && !scroll.on && !chordEdit && route().name === "song") showTips("song"); }, 500);

  const speed = $("speed");
  // Song length style: the slider sets how long the song takes (right = shorter = faster).
  const showSpeed = () => {
    if (byLength()) {
      speed.style.setProperty("--fill", ((speed.value - 60) / 420 * 100) + "%");
      $("sv").textContent = mmss(540 - speed.value);
    } else {
      speed.style.setProperty("--fill", ((speed.value - 4.5) / 94.5 * 100) + "%");
      $("sv").textContent = (speed.value / SPEEDS.medium).toFixed(1) + "x";
    }
  };
  showSpeed();
  speed.oninput = () => {
    if (byLength()) song.duration = 540 - speed.value; else song.speed = +speed.value;
    showSpeed(); Tabs.save(data);
  };

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

  // Current line: the last line whose top has reached the reading line.
  let b = 0;
  for (let i = 0; i < diag.blocks.length; i++) if (sheetTop + diag.blocks[i].y <= line) b = i;
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
  let b = null;
  for (const x of diag.blocks) if (top + x.y <= line) b = x.el;
  return b || diag.blocks.find(x => isLine(x.el))?.el;
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
  catch { prompt("Copy this link", url); }
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
  $("im-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(full); toast("Link copied"); } catch { prompt("Copy this link", full); } });
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
    map.dragging = true; m.setPointerCapture?.(e.pointerId);
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
  m.classList.toggle("away", !map.dragging && ($("sheet")?.getBoundingClientRect().top ?? 0) > innerHeight * 0.25);
  const f = Math.min(1, (scrollY + innerHeight * READ_AT) / document.documentElement.scrollHeight);
  m.querySelector(".sm-fill").style.height = (f * 100) + "%";
  let cur = 0;
  /* At the very end the page can't scroll further, so count sections in view. */
  const line = scrollY >= mapMax() - 2 ? innerHeight * 0.7 : innerHeight * READ_AT + 4;
  map.secs.forEach((x, i) => { if (x.el.getBoundingClientRect().top <= line) cur = i; });
  m.querySelectorAll(".sm-m").forEach((b, i) => { b.classList.toggle("on", i === (target ?? cur)); b.classList.toggle("past", i < cur); });
}
onScroll(() => { if (map.el) paintMap(map.dragging ? map.target : undefined); });

// ---------- Edit (in place) ----------
// Edit turns the song page itself into the editor: title and artist are typed in
// place; key, tuning and tempo are chips; tap a word for its chord; the pencil
// retypes a line; section names rename; + adds a line or a section. Text flips to
// the plain-text editor for big jobs. Every change saves at once, with Undo.
let chordEdit = null;
let edView = "sheet";          /* "sheet" or "text" */
let textSnap = null, textTimer = 0;
let openEdit = null;            /* { id, view } to open the editor once the song page draws */
onLeave(() => {
  if (!chordEdit) return;
  if (edView === "text") flushText(chordEdit);
  if (chordEdit.isNew) settleNew(chordEdit);
  chordEdit = null; edView = "sheet"; textSnap = null;
  document.body.classList.remove("cedit");
  document.querySelector(".cebar")?.remove();
  $("ed-details")?.remove();
});
const ROOTS = ["A", "B", "C", "D", "E", "F", "G"], QUALS = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "add9", "dim"];
const KEY_LIST = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const EDIT_FIELDS = ["title", "artist", "key", "tuning", "bpm", "body"];
const snapshot = song => Object.fromEntries(EDIT_FIELDS.map(k => [k, song[k]]));
function restoreSnap(song, snap) { for (const k of EDIT_FIELDS) { if (snap[k] === undefined) delete song[k]; else song[k] = snap[k]; } }
// Apply one change with Undo. `label` is the toast; empty for quiet changes.
function editChange(song, label, fn) {
  const before = snapshot(song);
  fn();
  if (song.body !== before.body) delete song.loop;
  Tabs.save(data);
  paintEdit(song);
  if (label) toast(label, null, { label: "Undo", fn: () => { restoreSnap(song, before); Tabs.save(data); paintEdit(song); } });
}
// ---- Adding a song: a blank song opened in the editor, Text view first ----
// It lives in the library flagged isNew while you work on it (so every change
// saves, as in Edit). Save keeps it; Cancel removes it. If the app closes first,
// a song with words is kept and an empty one is dropped.
function newSong(fields = {}) {
  const s = Tabs.addSong(data, { title: "", artist: "", ...fields, isNew: true });
  if (!fields.format && s.body) s.format = looksLikeTab(s.body) ? "tab" : "chords";
  openEdit = { id: s.id, view: "text" };
  go("#/song/" + encodeURIComponent(s.id));
}
function settleNew(song) {
  delete song.isNew;
  if (!String(song.body || "").trim() && !song.title.trim()) data.songs.splice(data.songs.indexOf(song), 1);
  else if (!song.title.trim()) song.title = "Untitled";
  Tabs.save(data);
}
function endEdit() {
  chordEdit = null; edView = "sheet"; textSnap = null;
  document.body.classList.remove("cedit");
  document.querySelector(".cebar")?.remove();
}
function songEditor(song, view = "sheet") {
  stopScroll();
  chordEdit = song;
  document.body.classList.add("cedit");
  document.querySelector(".smap")?.remove();
  document.querySelector(".cebar")?.remove();
  const bar = document.createElement("div");
  bar.className = "cebar glass";
  edView = song.format === "tab" ? "text" : view;
  const text = edView === "text";
  bar.innerHTML = `<div class="seg slide ${text ? "right" : ""}" id="ed-seg" role="tablist" aria-label="Edit view"><button class="${text ? "" : "on"}" role="tab" aria-selected="${!text}" data-v="sheet">Sheet</button><button class="${text ? "on" : ""}" role="tab" aria-selected="${text}" data-v="text">Text</button></div>
    <button class="btn sm primary" id="ce-done">${song.isNew ? "Save" : "Done"}</button>`;
  document.body.appendChild(bar);
  $("ce-done").onclick = () => {
    if (song.isNew) {
      const t = $("ed-title")?.value.trim() || song.title.trim();
      if (!t) { toast("Add a title first"); $("ed-title")?.focus(); return; }
      flushText(song);
      song.title = t; delete song.isNew; textSnap = null;
      Tabs.save(data);
    } else leaveText(song);
    endEdit(); render(); toast("Saved");
  };
  bar.querySelectorAll("[data-v]").forEach(b => b.onclick = () => switchView(song, b.dataset.v));
  if (song.isNew) {
    /* Cancel where Back usually is; nothing else up top while adding. */
    const head = app.querySelector(".head");
    if (head) {
      head.innerHTML = `<button class="btn sm glass" id="ce-cancel">Cancel</button>`;
      $("ce-cancel").onclick = () => {
        flushText(song);
        const typed = String(song.body || "").trim() || $("ed-title")?.value.trim() || song.artist;
        if (typed && !confirm("Discard this song?")) return;
        data.songs.splice(data.songs.indexOf(song), 1);
        Tabs.save(data);
        endEdit();
        history.length > 1 ? history.back() : go("#/");
      };
    }
  }
  window.scrollTo(0, 0);
  paintEdit(song);
  if (song.isNew && !song.title) setTimeout(() => $("ed-title")?.focus({ preventScroll: true }), 300);
}
function paintEdit(song) {
  const sheet = $("sheet");
  if (!sheet || chordEdit !== song) return;
  /* Title and details, typed in place. */
  const h = app.querySelector(".song-title");
  if (h && !h.querySelector("input")) {
    h.innerHTML = `<input class="ed-title" id="ed-title" value="${esc(song.title)}" placeholder="Song title" aria-label="Title" autocomplete="off">`;
    $("ed-title").onchange = e => { const v = e.target.value.trim(); if (v && v !== song.title) editChange(song, "", () => { song.title = v; }); else if (!song.isNew) e.target.value = song.title; };
  } else if (h && document.activeElement !== $("ed-title") && song.title) $("ed-title").value = song.title;
  paintDetails(song);
  if (edView === "text") return paintText(song);
  paintSheet(song, sheet);
}
// Artist and the Key, Tuning, Tempo (and Format, for tab) chips. Redrawn as you
// type in the Text view, so the detected key and format stay current.
function paintDetails(song) {
  const h = app.querySelector(".song-title");
  $("ed-details")?.remove();
  const isTab = song.format === "tab";
  const showFormat = isTab || looksLikeTab(song.body || "");
  const guess = isTab ? "" : guessKey(song.body || "");
  const tun = song.tuning || detectTuning(song.body) || "standard";
  const d = document.createElement("div");
  d.className = "ed-details";
  d.id = "ed-details";
  d.innerHTML = `
    <input class="ed-artist" id="ed-artist" value="${esc(song.artist || "")}" placeholder="Artist" aria-label="Artist" autocomplete="off">
    <div class="ed-chips">
      ${showFormat ? `<label class="ed-chip"><span>Format</span><b>${isTab ? "Tab" : "Chords"}</b>
        <select id="ed-format" aria-label="Format"><option value="chords" ${isTab ? "" : "selected"}>Chords</option><option value="tab" ${isTab ? "selected" : ""}>Tab</option></select></label>` : ""}
      ${isTab ? "" : `<label class="ed-chip"><span>Key</span><b>${esc(song.key || (guess ? guess + " (auto)" : "Auto"))}</b>
        <select id="ed-key" aria-label="Key"><option value="">Auto${guess ? ` (${esc(guess)})` : ""}</option>${KEY_LIST.flatMap(k => [k, k + "m"]).map(k => `<option ${k === song.key ? "selected" : ""}>${k}</option>`).join("")}</select></label>`}
      <label class="ed-chip"><span>Tuning</span><b>${esc(TUNINGS[tun].name)}</b>
        <select id="ed-tuning" aria-label="Tuning">${Object.entries(TUNINGS).map(([k, v]) => `<option value="${k}" ${k === tun ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
      <label class="ed-chip"><span>Tempo</span><input id="ed-bpm" type="number" inputmode="numeric" min="30" max="260" value="${song.bpm || ""}" placeholder="90" aria-label="Tempo in beats per minute"><span>BPM</span></label>
    </div>`;
  h?.after(d);
  $("ed-artist").onchange = e => editChange(song, "", () => { song.artist = e.target.value.trim(); });
  $("ed-format")?.addEventListener("change", e => {
    const f = e.target.value;
    if (edView === "text") flushText(song);
    editChange(song, f === "tab" ? "Format: Tab" : "Format: Chords", () => { song.format = f; song.formatSet = true; });
    if (f === "tab" && edView === "sheet") switchView(song, "text");
  });
  $("ed-seg") && ($("ed-seg").hidden = isTab);
  if ($("ed-txhint")) $("ed-txhint").textContent = textHint(song);
  $("ed-key")?.addEventListener("change", e => editChange(song, `Key: ${e.target.value || "Auto"}`, () => { song.key = e.target.value; }));
  $("ed-tuning").onchange = e => editChange(song, `Tuning: ${TUNINGS[e.target.value].name}`, () => { if (e.target.value === "standard") delete song.tuning; else song.tuning = e.target.value; });
  $("ed-bpm").onchange = e => editChange(song, "", () => { const n = Math.min(260, Math.max(30, parseInt(e.target.value, 10))); if (n) song.bpm = n; else delete song.bpm; });
}
function paintSheet(song, sheet) {
  /* The sheet: words for chords, a pencil per line, renamable sections, + to add. */
  const model = chordModel(song.body);
  const pencil = icon("edit");
  const parts = [`<p class="ed-hint">Tap a word for its chord. ${pencil} retypes a line.</p>`];
  const addBtn = after => `<button class="ce-add" data-after="${after}">${icon("plus")}Line</button>`;
  let last = -1, inSection = false;
  model.forEach((l, k) => {
    if (l.kind === "section") {
      if (inSection) parts.push(addBtn(last));
      inSection = true;
      parts.push(`<button class="sec ce-sec" data-sec="${l.i}" aria-label="Rename section ${esc(l.text)}">${esc(l.text)}${pencil}</button>`);
      last = l.i;
      return;
    }
    if (l.kind === "blank") { parts.push(`<div class="gap"></div>`); return; }
    last = l.i;
    if (l.kind !== "lyric") { parts.push(`<div class="ce-other">${esc(l.text)}</div>`); return; }
    const words = [...l.text.matchAll(/\S+/g)];
    let prevEnd = 0;
    const html = words.map(w => {
      const start = w.index, end = start + w[0].length;
      /* Chords over this word, or over the gap just before it. */
      const on = l.chords.filter(c => c.pos >= prevEnd && c.pos < end);
      prevEnd = end;
      const pos = on.length ? on[on.length - 1].pos : start;
      return `<button class="ce-w ${on.length ? "has" : ""}" data-i="${l.i}" data-pos="${pos}" data-word="${esc(w[0])}"><span class="ce-c">${on.length ? esc(on.map(c => c.chord).join(" ")) : "+"}</span><span class="ce-t">${esc(w[0])}</span></button>`;
    }).join(" ");
    parts.push(`<div class="ce-line" data-line="${l.i}">${html}<button class="ce-pen" data-edit="${l.i}" aria-label="Retype this line">${pencil}</button></div>`);
  });
  parts.push(addBtn(last));
  parts.push(`<div class="ed-end"><button class="ce-add" id="ed-sec">${icon("plus")}Section</button></div>
    <button class="danger" id="ed-delete" style="display:block;margin:28px auto 0">Delete Song</button>`);
  sheet.classList.remove("focus");
  sheet.innerHTML = parts.join("");

  /* One handler for the whole sheet instead of one per word and button. */
  sheet.onclick = e => {
    if (chordEdit !== song || edView !== "sheet") return;
    const b = e.target.closest?.(".ce-w, [data-edit], [data-sec], [data-after]");
    if (!b || !sheet.contains(b)) return;
    if (b.classList.contains("ce-w")) {
      sheet.querySelectorAll(".ce-w.sel").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      pickChord(song, +b.dataset.i, +b.dataset.pos, b.dataset.word, b.classList.contains("has") ? b.querySelector(".ce-c").textContent : "");
    } else if (b.dataset.edit !== undefined) {
      const i = +b.dataset.edit, ln = model.find(l => l.kind === "lyric" && l.i === i);
      lineInput(b.closest(".ce-line"), ln.text, text => {
        if (text === ln.text) return paintEdit(song);
        editChange(song, text.trim() ? "Line updated" : "Line removed", () => { song.body = setLineText(song.body, i, text); });
      });
    } else if (b.dataset.sec !== undefined) {
      const i = +b.dataset.sec, cur = model.find(l => l.i === i).text;
      const name = prompt("Section name (leave empty to remove the label)", cur);
      if (name === null || name.trim() === cur) return;
      editChange(song, name.trim() ? `Renamed to ${name.trim()}` : "Label removed", () => { song.body = renameSection(song.body, i, name); });
    } else {
      const after = +b.dataset.after;
      const row = document.createElement("div");
      row.className = "ce-line";
      b.before(row);
      lineInput(row, "", text => {
        if (!text.trim()) return paintEdit(song);
        editChange(song, "Line added", () => { song.body = insertLines(song.body, after, [text]).body; });
      });
    }
  };
  $("ed-sec").onclick = () => {
    const name = (prompt("New section name", "Chorus") || "").trim();
    if (!name) return;
    const lines = String(song.body || "").split("\n");
    editChange(song, `Added ${name}`, () => { song.body = insertLines(song.body, lines.length - 1, lines.length && lines[lines.length - 1].trim() ? ["", `[${name}]`] : [`[${name}]`]).body; });
    /* Start typing the new section's first line right away. */
    sheet.querySelectorAll("[data-after]")[sheet.querySelectorAll("[data-after]").length - 1]?.click();
  };
  $("ed-delete").onclick = () => deleteFromEdit(song);
}
// ---- Text view: the same page, the sheet as plain text ----
// Same title, details and bar; only the song area changes. Chord lines show in
// copper behind the text, and switching keeps the line you were on in place.
function switchView(song, v) {
  if (v === edView) return;
  /* Remember which line sits at the reading point, and where. */
  const line = innerHeight * READ_AT;
  const pick = sel => {
    let best = null;
    document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (!best || Math.abs(r.top - line) < Math.abs(best.top - line)) best = { el, top: r.top }; });
    return best;
  };
  let anchor = null;
  if (edView === "sheet") { const b = pick("#sheet [data-line], #sheet [data-sec]"); if (b) anchor = { i: +(b.el.dataset.line ?? b.el.dataset.sec), top: b.top }; }
  else { const b = pick(".ed-hl [data-l]"); if (b) anchor = { i: +b.el.dataset.l, top: b.top }; leaveText(song); }
  edView = v;
  document.querySelectorAll("#ed-seg [data-v]").forEach(b => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  $("ed-seg")?.classList.toggle("right", v === "text");
  paintEdit(song);
  $("sheet")?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: calm() ? 0 : 160, easing: "ease-out" });
  if (!anchor) return;
  let el = null;
  if (v === "text") el = document.querySelector(`.ed-hl [data-l="${anchor.i}"]`);
  else {
    /* The first line at or after it (a chord line belongs to the lyric below). */
    let bestI = Infinity;
    document.querySelectorAll("#sheet [data-line], #sheet [data-sec]").forEach(x => { const i = +(x.dataset.line ?? x.dataset.sec); if (i >= anchor.i && i < bestI) { bestI = i; el = x; } });
  }
  if (el) window.scrollBy(0, el.getBoundingClientRect().top - anchor.top);
}
function hlText(text) {
  const model = chordModel(text), chordLines = new Set(), secs = new Set();
  for (const l of model) { if (l.kind === "section") secs.add(l.i); if (l.kind === "chords") chordLines.add(l.i); if (l.kind === "lyric" && l.chordLine >= 0) chordLines.add(l.chordLine); }
  return text.split("\n").map((ln, i) => {
    const body = secs.has(i) || chordLines.has(i) ? esc(ln) : esc(ln).replace(/\[([A-G][#b]?[^\]\s]{0,10})\]/g, '<span class="hc">[$1]</span>');
    return `<div data-l="${i}" class="${chordLines.has(i) ? "hc" : secs.has(i) ? "hs" : ""}">${body || " "}</div>`;
  }).join("");
}
const textHint = song => song.format === "tab" ? "Tab as plain text, one line per string. Section names in brackets, like [Intro]." : "Chords go on their own line above the words, or inline like [G]word. Sections in brackets, like [Chorus].";
const TEXT_HINT = "Paste or type chords and lyrics, or tab\n\n[Verse]\nG                C         G\nWalking down the river road tonight\n\nor inline:  [G]Walking [C]down";
function paintText(song) {
  const sheet = $("sheet");
  textSnap ||= snapshot(song);
  sheet.innerHTML = `
    ${aiKey() ? `<div class="ed-tools"><button class="chip ai" id="ed-clean">${icon("wand")}Clean up</button><button class="chip ai" id="ed-scan">${icon("camera")}Scan a page</button><input type="file" id="ed-photo" accept="image/*" hidden></div>` : ""}
    <div class="ed-tx"><div class="ed-tx-in"><pre class="ed-hl" id="ed-hl" aria-hidden="true">${hlText(song.body || "")}</pre>
      <textarea id="ed-body" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-label="Song text" placeholder="${esc(TEXT_HINT)}">${esc(song.body || "")}</textarea></div></div>
    <p class="ed-hint" id="ed-txhint">${textHint(song)}</p>
    ${song.isNew ? "" : `<button class="danger" id="ed-delete" style="display:block;margin:28px auto 0">Delete Song</button>`}`;
  const ta = $("ed-body");
  ta.oninput = () => {
    $("ed-hl").innerHTML = hlText(ta.value);
    clearTimeout(textTimer);
    textTimer = setTimeout(() => flushText(song), 300);
  };
  const run = async (btn, label, job) => {
    if (btn.disabled) return;
    const html = btn.innerHTML;
    sheet.querySelectorAll(".chip.ai").forEach(b => b.disabled = true);
    btn.innerHTML = busy(label);
    try {
      flushText(song);
      const r = await job();
      editChange(song, r.label, () => {
        song.body = r.body;
        if (!song.title.trim() && r.title) song.title = r.title;
        if (!song.artist && r.artist) song.artist = r.artist;
        if (!song.key && r.key) song.key = r.key;
        if (r.format && !song.formatSet) song.format = r.format;
      });
    } catch (e) { toast(aiError(e)); btn.innerHTML = html; sheet.querySelectorAll(".chip.ai").forEach(b => b.disabled = false); }
  };
  $("ed-clean")?.addEventListener("click", () => {
    if (!ta.value.trim()) return toast("Paste a song first");
    run($("ed-clean"), "Cleaning", async () => ({ ...(await cleanSheet({ text: ta.value })), label: "Cleaned up" }));
  });
  $("ed-scan")?.addEventListener("click", () => $("ed-photo").click());
  $("ed-photo")?.addEventListener("change", e => {
    const file = e.target.files[0]; e.target.value = "";
    if (file) run($("ed-scan"), "Reading page", async () => ({ ...(await cleanSheet({ image: await readPhoto(file) })), label: "Read from photo" }));
  });
  $("ed-delete")?.addEventListener("click", () => deleteFromEdit(song));
}
function flushText(song) {
  clearTimeout(textTimer);
  const ta = $("ed-body");
  if (!ta || ta.value === song.body) return;
  song.body = ta.value;
  delete song.loop;
  if (song.isNew && !song.formatSet) song.format = looksLikeTab(song.body) ? "tab" : "chords";
  Tabs.save(data);
  if (chordEdit === song) paintDetails(song);
}
// Leaving the text view: save, and offer one Undo for everything typed there.
function leaveText(song) {
  if (edView !== "text") return;
  flushText(song);
  const before = textSnap;
  textSnap = null;
  if (before && before.body !== song.body) toast("Text changes saved", null, { label: "Undo", fn: () => { restoreSnap(song, before); Tabs.save(data); paintEdit(song); } });
}
function deleteFromEdit(song) {
  chordEdit = null; edView = "sheet"; textSnap = null; document.body.classList.remove("cedit"); document.querySelector(".cebar")?.remove();
  const entry = Tabs.deleteSong(data, song.id);
  history.replaceState(null, "", "#/");
  render();
  toast(`Deleted "${song.title}"`, null, { label: "Undo", fn: () => { Tabs.restore(data, entry); render(); toast("Restored"); } });
}

// Swap a line for a text field; Return or leaving the field saves, Escape cancels.
function lineInput(row, text, done) {
  row.innerHTML = `<input class="ce-input" value="${esc(text)}" placeholder="Type the line" aria-label="Line text" autocomplete="off" autocapitalize="sentences">`;
  const inp = row.querySelector("input");
  let finished = false;
  const finish = v => { if (finished) return; finished = true; done(v); };
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); finish(inp.value); } if (e.key === "Escape") { finished = true; paintEdit(chordEdit); } };
  inp.onblur = () => finish(inp.value);
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}
function pickChord(song, i, pos, word, current) {
  const parsed = /^([A-G])([#b]?)(.*)$/.exec(current || "") || [];
  const st = { root: parsed[1] || "", acc: parsed[2] || "", qual: QUALS.includes(parsed[3]) ? parsed[3] : "" };
  const name = () => st.root ? st.root + st.acc + st.qual : "";
  const used = chordsUsed(song.body);
  const paint = () => {
    const p = $("ce-panel");
    p.innerHTML = `
      <div class="pc-head">${icon("pick")}<span>Chord over <b class="ce-word">${esc(word)}</b></span></div>
      ${used.length ? `<div class="label ce-lab">In this song</div><div class="ce-chips">${used.map(c => `<button class="ce-chip ${c === name() ? "on" : ""}" data-u="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
      <div class="label ce-lab">Any chord</div>
      <div class="ce-chips">${ROOTS.map(r => `<button class="ce-chip ${r === st.root ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}
        <button class="ce-chip ${st.acc === "#" ? "on" : ""}" data-a="#" aria-label="Sharp">♯</button><button class="ce-chip ${st.acc === "b" ? "on" : ""}" data-a="b" aria-label="Flat">♭</button></div>
      <div class="ce-chips q">${QUALS.map(q => `<button class="ce-chip ${q === st.qual ? "on" : ""}" data-q="${q}">${q || "major"}</button>`).join("")}<button class="ce-chip" id="ce-other">Other…</button></div>
      <div class="actions" style="margin-top:14px">
        ${current ? `<button class="btn" id="ce-rm">Remove</button>` : `<button class="btn" id="ce-cancel">Cancel</button>`}
        <button class="btn primary" id="ce-place" ${name() ? "" : "disabled"}>${name() ? `Place ${esc(name())}` : "Pick a chord"}</button>
      </div>`;
    p.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { const m = /^([A-G])([#b]?)(.*)$/.exec(b.dataset.u); st.root = m[1]; st.acc = m[2]; st.qual = m[3]; apply(b.dataset.u); });
    p.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { st.root = b.dataset.r; paint(); });
    p.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { st.acc = st.acc === b.dataset.a ? "" : b.dataset.a; paint(); });
    p.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { st.qual = b.dataset.q; paint(); });
    $("ce-other").onclick = () => { const c = (prompt("Chord name, like Cadd9 or D/F#", name()) || "").trim(); if (c) apply(c); };
    $("ce-place").onclick = () => name() && apply(name());
    $("ce-rm")?.addEventListener("click", () => apply(null));
    $("ce-cancel")?.addEventListener("click", close);
  };
  const close = () => { layer.innerHTML = ""; document.querySelectorAll(".ce-w.sel").forEach(x => x.classList.remove("sel")); };
  const apply = chord => {
    close();
    editChange(song, chord ? `${chord} over “${word}”` : `Removed from “${word}”`, () => { song.body = setChordAt(song.body, i, pos, chord); });
  };
  layer.innerHTML = `<div class="scrim" id="ce-scrim"></div><div class="panel card" id="ce-panel" role="dialog" aria-label="Choose a chord"></div>`;
  $("ce-scrim").onclick = close;
  paint();
}

// Make it easier and Spark tone load on first use (aitools.js).
const aiTools = () => import("./aitools.js");
function easierSheet(song) { aiTools().then(m => m.easierSheet(song)); }
function toneSheet(song) { aiTools().then(m => m.toneSheet(song)); }

// ---------- Song menu ----------
function songMenu(song, anchor, redrawSong) {
  const old = document.querySelector(".menu");
  if (old) { old.remove(); return; }
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
    (aiKey() || song.tone) && { id: "tone", icon: "amp", label: "Spark tone", hint: song.tone ? "Saved" : "" }
  ].filter(Boolean);
  const m = document.createElement("div");
  m.className = "menu glass float";
  m.setAttribute("role", "menu");
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 8) + "px";
  m.style.right = Math.max(12, innerWidth - r.right) + "px";
  const paint = () => {
    m.innerHTML = items.map(it => it.id === "size"
      ? `<div class="mrow size"><span class="mi">${icon("text")}</span><span class="ml">Text size</span>
          <button class="sb" data-d="-1" aria-label="Smaller text">${icon("minus")}</button><span class="v">${Math.round(song.size * 100)}%</span><button class="sb" data-d="1" aria-label="Larger text">${icon("plus")}</button></div>`
      : `<button class="mrow" role="menuitem" data-m="${it.id}"><span class="mi">${icon(it.icon)}</span><span class="ml">${it.label}</span>${it.hint ? `<span class="mh">${esc(it.hint)}</span>` : ""}</button>`).join("");
  };
  paint();
  document.body.appendChild(m);
  const close = () => { m.remove(); document.removeEventListener("click", outside, true); window.removeEventListener("scroll", close); };
  const outside = ev => { if (!m.contains(ev.target)) close(); };
  setTimeout(() => { document.addEventListener("click", outside, true); window.addEventListener("scroll", close, { passive: true }); });
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
    close();
    ({ set: () => addToSet(song), edit: () => songEditor(song),
       easy: () => aiKey() ? easierSheet(song) : (ez.on = !ez.on, Tabs.save(data), redrawSong()),
       tone: () => toneSheet(song), share: () => shareSong(song), loop: () => startLoopPick(song), tuner: () => openTuner(songTuning(song)),
       listen: () => listenSheet(song, true),
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

// Chord charts and "What can I play next?" load on first use (findai.js).
const findAI = () => import("./findai.js");
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
async function findTracks(song) {
  const term = encodeURIComponent(`${song.title} ${song.artist || ""}`.trim());
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=12`, { signal: ctl.signal });
    if (!r.ok) throw new Error(r.status);
    return rankTracks((await r.json()).results || [], song.title, song.artist);
  } finally { clearTimeout(t); }
}
function saveListen(song, url, extra = {}) {
  song.listen = { url, service: linkService(url), ...extra };
  Tabs.save(data);
  const chip = $("listen");
  if (chip) chip.innerHTML = `${icon("note")}${esc(song.listen.service)}`;
}
function listenSheet(song, force) {
  if (song.listen && !force) return openLink(song.listen.url);
  let state = { busy: true, tracks: [], error: false };
  const paint = () => {
    const p = $("ls-panel");
    if (!p) return;
    const best = state.tracks[0], sure = best && best.score >= 5;
    const row = (x, i) => `<button class="row pick ls-row" data-t="${i}">
        ${x.artworkUrl100 ? `<img src="${esc(x.artworkUrl100)}" alt="" width="44" height="44" loading="lazy">` : `<span class="ls-art">${icon("note")}</span>`}
        <div class="txt"><div class="t">${esc(x.trackName)}</div><div class="a">${esc(x.artistName)}${x.collectionName ? ` · ${esc(x.collectionName)}` : ""}</div></div>
        ${icon("chev", "chev")}</button>`;
    p.innerHTML = `
      <div class="pc-head">${icon("note")}<span>Listen · ${esc(song.title)}</span></div>
      ${state.busy ? `<div class="easy-wait">${busy("Looking in Apple Music")}</div>`
        : state.tracks.length ? `<p class="easy-note">${sure ? "Found it on Apple Music. Is this the one?" : "Pick the right recording:"}</p>
          <div class="list glass ls-list">${(sure ? state.tracks.slice(0, 1) : state.tracks.slice(0, 5)).map(row).join("")}</div>
          ${sure && state.tracks.length > 1 ? `<button class="linkbtn ls-more" id="ls-more">Not this one? Show others</button>` : ""}`
        : `<p class="easy-note">${state.error ? "Couldn't reach Apple Music's catalog just now." : "No match in Apple Music."} Search there, copy the song's link (Share > Copy Link), then tap Paste a link.</p>`}
      ${song.listen ? `<p class="foot" style="margin:10px 2px 0">Saved: ${esc(song.listen.service)}${song.listen.title ? ` · ${esc(song.listen.title)}` : ""}</p>` : ""}
      <div class="actions ls-actions">
        <button class="btn" id="ls-search">Search Apple Music</button>
        <button class="btn" id="ls-paste">Paste a link</button>
      </div>
      ${song.listen ? `<button class="danger" id="ls-clear" style="display:block;margin:12px auto 0">Remove link</button>` : ""}`;
    p.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
      const x = state.tracks[+b.dataset.t];
      saveListen(song, x.trackViewUrl, { title: x.trackName, artist: x.artistName, ...(x.artworkUrl100 ? { art: x.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb") } : {}) });
      layer.innerHTML = "";
      openLink(x.trackViewUrl);
    });
    $("ls-more")?.addEventListener("click", () => { state.tracks = state.tracks.map(x => ({ ...x, score: 0 })); paint(); });
    $("ls-search").onclick = () => openLink(appleSearchURL(song));
    $("ls-paste").onclick = async () => {
      let text = "";
      try { text = await navigator.clipboard.readText(); } catch {}
      if (!/^https?:\/\//.test(text.trim())) text = prompt("Paste the song's link (Apple Music, Spotify or YouTube)") || "";
      const url = (text.match(/https:\/\/\S+/) || [])[0];
      if (!url) return toast("That doesn't look like a link");
      saveListen(song, url);
      layer.innerHTML = "";
      toast(`Saved the ${linkService(url)} link`);
    };
    $("ls-clear")?.addEventListener("click", () => { delete song.listen; Tabs.save(data); layer.innerHTML = ""; const c = $("listen"); if (c) c.innerHTML = `${icon("note")}Listen`; toast("Link removed"); });
  };
  layer.innerHTML = `<div class="scrim" id="ls-scrim"></div><div class="panel card" id="ls-panel" role="dialog" aria-label="Listen"></div>`;
  $("ls-scrim").onclick = () => { layer.innerHTML = ""; };
  paint();
  findTracks(song).then(t => { state = { busy: false, tracks: t, error: false }; paint(); })
    .catch(() => { state = { busy: false, tracks: [], error: true }; paint(); });
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
const loadTuner = async () => (tunerMod ||= await import("./tuner.js"));
function openTuner(...args) { loadTuner().then(m => m.openTuner(...args)); }
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
    return;
  }
  if (!(e.target instanceof Element && e.target.closest(".dpop"))) showChordPop(null);
  // Tap a line while paused: it becomes the current line, and play starts from it.
  const block = e.target instanceof Element && e.target.closest(".sheet > *");
  if (block && !scroll.on && isLine(block) && !block.classList.contains("prow") && !block.classList.contains("dpop") && diag.focus === "always") {
    diag.pinned = block;
    diag.armed = true;
    applyPaused();
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

async function startScroll(song) {
  document.querySelector(".endnote")?.remove();
  /* Count in only when starting from the top: the song's first line is on screen. */
  const first = $("sheet")?.querySelector(":scope > .pr, :scope > .ly, :scope > .tab, :scope > .crow");
  const fr = first?.getBoundingClientRect();
  const atTop = !fr || (fr.bottom > 0 && fr.top < innerHeight);
  scroll.on = true; scroll.last = 0; scroll.carry = 0; scroll.bottomSince = 0; scroll.logged = false;
  document.body.classList.add("playing");
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
}

// ---------- Settings ----------
let settingsDefaultsOpen = false;
function renderSettings() {
  const s = data.settings;
  const t = s.transpose || 0;
  const semis = n => n === 0 ? "None" : `${n > 0 ? "+" : ""}${n} semitone${Math.abs(n) === 1 ? "" : "s"}`;
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" id="back" aria-label="Back to library">${icon("back")}</button>
    </div>
    <h1 class="title" style="margin:14px 2px 10px">Settings</h1>
    <div class="label">Playing</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Speed style</span><span class="val">${s.speedMode === "multiplier" ? "1x style" : "Song length"}</span>${icon("chev", "chev")}
        <select id="s-mode" aria-label="Speed style">
          <option value="length" ${s.speedMode !== "multiplier" ? "selected" : ""}>Song length</option>
          <option value="multiplier" ${s.speedMode === "multiplier" ? "selected" : ""}>1x style</option>
        </select>
      </div>
      <div class="set">
        <span class="tile">${icon("metro")}</span><span class="name">Count-in</span>
        <button class="toggle ${s.countIn !== false ? "on" : ""}" id="s-count" role="switch" aria-checked="${s.countIn !== false}" aria-label="Count-in"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("stage")}</span><span class="name">Stage mode</span>
        <button class="toggle ${s.stage ? "on" : ""}" id="s-stage" role="switch" aria-checked="${!!s.stage}" aria-label="Stage mode"></button>
      </div>
    </div>
    <p class="foot">Song length fits the scroll to how long a song takes; 1x style is a fixed speed. Each song keeps its own. Count-in plays one bar at the song's tempo. Stage mode is for playing live: larger, higher-contrast text, no chord cards, and while a song plays, stray touches are ignored (tap twice to pause).</p>
    <div class="label">Chord diagrams</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("fretboard")}</span><span class="name">Now and Next while playing</span>
        <button class="toggle ${s.diagrams === true ? "on" : ""}" id="s-diagrams" role="switch" aria-checked="${s.diagrams === true}" aria-label="Now and Next chords"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("pause")}</span><span class="name">Diagrams when paused</span>
        <button class="toggle ${s.pauseDiagrams !== false ? "on" : ""}" id="s-pause" role="switch" aria-checked="${s.pauseDiagrams !== false}" aria-label="Diagrams when paused"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("focus")}</span><span class="name">Focus current line</span><span class="val">${{ always: "Always", playing: "While playing", off: "Off" }[s.focus] || "Always"}</span>${icon("chev", "chev")}
        <select id="s-focus" aria-label="Focus current line">
          ${[["always", "Always"], ["playing", "While playing"], ["off", "Off"]].map(([v, t]) => `<option value="${v}" ${v === (s.focus || "always") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
    </div>
    <p class="foot">Tap a chord for its fingering, or a line to start from it.</p>
    <div class="set-group glass" style="margin-top:22px">
      <button class="set" id="s-defaults" aria-expanded="${!!settingsDefaultsOpen}"><span class="tile">${icon("sliders")}</span><span class="name">Defaults for new songs</span>${icon(settingsDefaultsOpen ? "down" : "chev", "chev")}</button>
      ${settingsDefaultsOpen ? `${s.speedMode === "multiplier" ? `<div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Starting speed</span><span class="val">${((s.startSpeed || SPEEDS.medium) / SPEEDS.medium).toFixed(1)}x</span>${icon("chev", "chev")}
        <select id="s-speed" aria-label="Starting speed for new songs">
          ${Array.from({ length: 16 }, (_, i) => (i + 5) / 10).map(m => `<option value="${(m * SPEEDS.medium).toFixed(1)}" ${Math.abs(m * SPEEDS.medium - (s.startSpeed || SPEEDS.medium)) < 0.01 ? "selected" : ""}>${m.toFixed(1)}x</option>`).join("")}
        </select>
      </div>` : `<div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Starting length</span><span class="val">${mmss(s.startLength || 210)}</span>${icon("chev", "chev")}
        <select id="s-length" aria-label="Starting length for new songs">
          ${Array.from({ length: 17 }, (_, i) => 120 + i * 15).map(v => `<option value="${v}" ${v === (s.startLength || 210) ? "selected" : ""}>${mmss(v)}</option>`).join("")}
        </select>
      </div>`}
      <div class="set">
        <span class="tile">${icon("note")}</span><span class="name">Transpose</span><span class="val">${semis(t)}</span>${icon("chev", "chev")}
        <select id="s-transpose" aria-label="Default transpose">
          ${Array.from({ length: 12 }, (_, i) => i - 5).map(n => `<option value="${n}" ${n === t ? "selected" : ""}>${semis(n)}</option>`).join("")}
        </select>
      </div>` : ""}
    </div>
    <div class="label">Appearance</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("moon")}</span><span class="name">Dark mode</span>
        <button class="toggle ${s.theme !== "light" ? "on" : ""}" id="s-theme" role="switch" aria-checked="${s.theme !== "light"}" aria-label="Dark mode"></button>
      </div>
    </div>
    <div class="label">AI help</div>
    <div class="set-group glass">
      <label class="fld" style="min-height:52px"><span class="tile" style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--card-2);border:1px solid var(--rim);color:var(--fg-2)">${icon("wand")}</span>
        <input id="s-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Anthropic API key (sk-ant-...)" value="${esc(aiKey())}" aria-label="Anthropic API key"></label>
      <div class="key-row">
        <span class="ai-status"><i class="dot ${aiKey() ? "on" : ""}"></i>${aiKey() ? "On" : "Off"}</span>
        <button class="btn sm" id="s-test">Test</button>
        ${aiKey() ? `<button class="btn sm" id="s-remove">Remove</button>` : ""}
        <button class="btn sm primary" id="s-savekey">Save key</button>
      </div>
    </div>
    <p class="foot" id="s-keymsg">Adds Clean up and Scan a page when adding songs, and Make it easier and Spark tone in a song's ••• menu. The key stays on this phone and is sent only to Anthropic. Cleanup and scans send the pasted text or photo; Make it easier and Spark tone send only the song's title, artist and chord names. Use a key made just for Tabs, with a low monthly spend limit.</p>
    <div class="label">Library</div>
    <div class="set-group glass">
      <button class="set" id="s-export"><span class="tile">${icon("cloud")}</span><span class="name">Back up now</span><span class="val muted">${ago(s.lastBackup)}</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-import"><span class="tile">${icon("download")}</span><span class="name">Import backup</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-tips"><span class="tile">${icon("info")}</span><span class="name">Show tips again</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-trash"><span class="tile">${icon("trash")}</span><span class="name">Recently deleted</span><span class="val muted">${data.trash.length || ""}</span>${icon("chev", "chev")}</button>
    </div>
    <input type="file" id="file" accept=".json,application/json" hidden>
    <p class="foot">${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, stored only on this device${storageKept ? " and kept permanently" : storageKept === false ? ". The browser may clear it if Tabs isn't added to your Home Screen" : ""}. Back up weekly to iCloud Drive: tap Back up now, then Save to Files. Add Tabs to your Home Screen from the Share menu to use it offline.</p>`;
  $("back").onclick = () => go("#/");
  $("s-speed")?.addEventListener("change", e => { s.startSpeed = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-length")?.addEventListener("change", e => { s.startLength = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-mode").onchange = e => { s.speedMode = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-count").onclick = () => { s.countIn = s.countIn === false; Tabs.save(data); renderSettings(); };
  $("s-stage").onclick = () => { s.stage = !s.stage; Tabs.save(data); applyTheme(); renderSettings(); };
  $("s-transpose")?.addEventListener("change", e => { s.transpose = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-defaults").onclick = () => { settingsDefaultsOpen = !settingsDefaultsOpen; renderSettings(); };
  $("s-diagrams").onclick = () => { s.diagrams = s.diagrams !== true; Tabs.save(data); renderSettings(); };
  $("s-pause").onclick = () => { s.pauseDiagrams = s.pauseDiagrams === false; Tabs.save(data); renderSettings(); };
  $("s-focus").onchange = e => { s.focus = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-theme").onclick = () => { s.theme = s.theme === "light" ? "dark" : "light"; Tabs.save(data); applyTheme(); renderSettings(); };
  $("s-savekey").onclick = () => {
    const k = $("s-key").value.trim();
    if (!k) { toast("Paste a key first"); return; }
    try { localStorage.setItem(AI.store, k); } catch {}
    renderSettings(); toast("Key saved");
  };
  $("s-remove")?.addEventListener("click", () => {
    try { localStorage.removeItem(AI.store); } catch {}
    renderSettings(); toast("Key removed from this phone");
  });
  $("s-test").onclick = async () => {
    const k = $("s-key").value.trim() || aiKey();
    const out = $("s-keymsg");
    if (!k) { out.textContent = "No key entered."; return; }
    $("s-test").innerHTML = busy("Testing");
    try {
      await askClaude({ key: k, content: "Reply with the word OK.", maxTokens: 1024 });
      out.textContent = "Key works.";
    } catch (e) { out.textContent = aiError(e); }
    $("s-test").textContent = "Test";
  };
  $("s-export").onclick = async () => { if (await backupNow()) { renderSettings(); toast("Backed up"); } };
  $("s-trash").onclick = () => go("#/trash");
  $("s-tips").onclick = () => { data.settings.tipsSeen = {}; Tabs.save(data); toast("Tips will show again"); go("#/"); };
  $("s-import").onclick = () => $("file").click();
  $("file").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = Tabs.import(reader.result);
      if (!imported) return toast("That file isn't a Tabs backup");
      data = imported.data;
      Object.entries(imported.covers).forEach(([id, url]) => coverPut(id, url));
      applyTheme();
      const n = data.songs.length, bad = imported.skipped;
      toast(`Imported ${n} song${n === 1 ? "" : "s"}${bad ? `. Skipped ${bad} that couldn't be read.` : ""}`);
      go("#/");
    };
    reader.readAsText(f);
  };
}

// ---------- Sets ----------
onLeave(() => document.querySelectorAll(".nextup, .nextline").forEach(el => { clearInterval(+el.dataset.timer); el.remove(); }));
let setCtx = null; // { id, idx } while playing through a set
const setSongs = x => x.songIds.map(id => data.songs.find(s => s.id === id)).filter(Boolean);
const setLength = x => setSongs(x).reduce((a, s) => a + songLength(s), 0);
let setEditing = false;

// The photo framing screen loads on first use (crop.js).
function cropPhoto(file, done) { import("./crop.js").then(m => m.cropPhoto(file, done)); }

// ---- Cover choices on the set page ----
function paintCoverOpts(set, redraw) {
  const o = $("cvopts"), cur = set.cover?.type || "songs", art = setArt(set);
  o.innerHTML = `
    <button class="cvo ${cur === "songs" ? "on" : ""}" data-cv="songs"><i>${coverSVG(setKeys(set), { name: set.name, small: true, notext: true })}</i>From songs</button>
    <button class="cvo ${cur === "art" ? "on" : ""}" data-cv="art" ${art.length ? "" : "aria-disabled=\"true\""}><i>${art.length ? `<img src="${esc(art[0])}" alt="">` : icon("note")}</i>Album art</button>
    <button class="cvo ${cur === "photo" ? "on" : ""}" data-cv="photo"><i>${coverCache[set.id] ? `<img src="${coverCache[set.id]}" alt="">` : icon("image")}</i>Photo</button>
    <button class="cvo" data-cv="camera"><i>${icon("camera")}</i>Camera</button>
    <input type="file" id="cv-file" accept="image/*" hidden><input type="file" id="cv-cam" accept="image/*" capture="environment" hidden>`;
  const pickFile = input => { input.value = ""; input.onchange = () => { const f = input.files[0]; if (f) cropPhoto(f, async (url, tint) => { await coverPut(set.id, url); set.cover = { type: "photo", tint }; Tabs.save(data); redraw(); toast("Cover updated"); }); }; input.click(); };
  o.querySelectorAll("[data-cv]").forEach(b => b.onclick = () => {
    const v = b.dataset.cv;
    if (v === "songs") { set.cover = { type: "songs" }; Tabs.save(data); redraw(); }
    else if (v === "art") {
      if (!art.length) return toast("Use Listen on songs in this set to find their recordings; their album art can then be the cover");
      set.cover = { type: "art" }; Tabs.save(data); redraw();
    }
    else if (v === "photo") { if (coverCache[set.id] && cur !== "photo") { set.cover = { ...set.cover, type: "photo" }; Tabs.save(data); return redraw(); } pickFile($("cv-file")); }
    else pickFile($("cv-cam"));
  });
}
function renderSet(id) {
  const set = data.sets.find(x => x.id === id);
  if (!set) return go("#/");
  const songs = setSongs(set);
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" id="back" aria-label="Back to sets">${icon("back")}</button>
      <div class="row-btns">
        ${songs.length && !setEditing ? `<button class="ib glass" id="s-tune" aria-label="Tuner">${icon("fork")}</button><button class="ib glass" id="s-share" aria-label="Share set">${icon("share")}</button>` : ""}
        ${songs.length ? `<button class="tb ${setEditing ? "go" : ""}" id="s-edit">${setEditing ? "Done" : "Edit"}</button>` : ""}
      </div>
    </div>
    <div class="set-hero" style="--tint:${setTint(set, 0.45)}">
      <div class="sh-big"><button class="sh-cover" id="s-cover" aria-label="Change cover">${setCover(set, { fs: 28, kicker: set.when ? fullWhen(set.when).split(" · ")[0] : "" })}${set.runs?.length ? `<span class="stamp">Played</span>` : ""}</button>
        </div><button class="sh-edc" id="s-edc">${icon("image")}Change cover</button>
      <div class="cvopts" id="cvopts" hidden></div>
      <button class="settitle" id="rename" aria-label="Set details: name, date and place"><h1 class="title">${esc(set.name)}</h1></button>
      <div class="meta">${songs.length} song${songs.length === 1 ? "" : "s"}${songs.length ? ` · about ${Math.round(setLength(set) / 60)} min` : ""}</div>
      ${set.runs?.length ? `<div class="set-played">Last played through ${esc(playedOn(set.runs[set.runs.length - 1].at))}${set.where ? ` · ${esc(set.where)}` : ""}</div>` : ""}
      ${(set.when && !(set.runs?.length && Date.parse(set.when) < Date.now())) || (set.where && !set.runs?.length) ? `<div class="set-when">${icon("calendar")}${esc([set.when && fullWhen(set.when), set.where].filter(Boolean).join(" · "))}${set.when && untilLabel(set.when) ? ` <span>· ${esc(untilLabel(set.when))}</span>` : ""}</div>` : ""}
    </div>
    ${set.runs?.length && !setEditing ? (() => { const last = set.runs[set.runs.length - 1]; return `<div class="hist">
      <div><b>${set.runs.length}</b><span>time${set.runs.length === 1 ? "" : "s"} played</span></div>
      <div><b>${mmss(last.secs)}</b><span>last run time</span></div>
      <div><b>${last.songs}/${songs.length}</b><span>songs played</span></div></div>`; })() : ""}
    ${!setEditing ? `<label class="set-note"><span class="sr">Note for this set</span><textarea id="s-note" rows="1" placeholder="${set.runs?.length ? "What did you learn this time?" : "A note for this set (optional)"}">${esc(set.note || "")}</textarea></label>` : ""}
    ${songs.length && !setEditing ? `<button class="btn primary cta" id="playset">${icon("play")}${set.runs?.length ? "Play again" : "Play set"}</button>
      <button class="stagechip ${data.settings.stage ? "on" : ""}" id="s-stagechip" role="switch" aria-checked="${!!data.settings.stage}">${icon("stage")}Stage mode <b>${data.settings.stage ? "On" : "Off"}</b></button>` : ""}
    <div class="list glass" style="margin-top:16px">
      ${songs.map((s, i) => `<div class="row setrow" data-i="${i}">
        <span class="num">${i + 1}</span>
        <button class="txt open" data-open="${i}"><div class="t">${esc(s.title)}</div><div class="a">${esc(s.artist || "Unknown artist")} · ${mmss(songLength(s))}${songTuning(s) !== "standard" ? ` · ${TUNINGS[songTuning(s)].name}` : ""}</div></button>
        ${setEditing ? `<button class="sb" data-up="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>${icon("up")}</button>
          <button class="sb" data-down="${i}" aria-label="Move down" ${i === songs.length - 1 ? "disabled" : ""}>${icon("down")}</button>
          <button class="sb" data-rm="${i}" aria-label="Remove from set">${icon("x")}</button>` : ""}
      </div>`).join("")}
      <button class="row newset" id="addsongs"><div class="txt"><div class="t">${icon("plus")} Add songs</div></div></button>
    </div>
    ${songs.length ? "" : `<p class="empty-hint" style="margin-top:14px">Add songs in the order you'll play them. You can reorder them anytime with Edit.</p>`}
    <button class="danger" id="delset" style="display:block;margin:22px auto 0">Delete set</button>`;
  const ids = () => setSongs(set).map(s => s.id);
  $("back").onclick = () => { setEditing = false; filter = "sets"; go("#/"); };
  $("rename").onclick = () => setSheet(set, () => renderSet(id));
  const toggleCovers = () => { const o = $("cvopts"); if (o.hidden) { paintCoverOpts(set, () => renderSet(id)); o.hidden = false; } else o.hidden = true; };
  $("s-cover").onclick = toggleCovers; $("s-edc").onclick = toggleCovers;
  $("s-edit")?.addEventListener("click", () => { setEditing = !setEditing; renderSet(id); });
  $("s-share")?.addEventListener("click", () => shareSet(set));
  $("s-stagechip")?.addEventListener("click", () => { data.settings.stage = !data.settings.stage; Tabs.save(data); applyTheme(); renderSet(id); });
  $("s-tune")?.addEventListener("click", () => openTuner(songTuning(songs[0])));
  $("playset")?.addEventListener("click", () => playSet(set));
  const note = $("s-note");
  if (note) {
    const fit = () => { note.style.height = "auto"; note.style.height = note.scrollHeight + "px"; };
    fit();
    note.oninput = () => { fit(); clearTimeout(note.t); note.t = setTimeout(() => { const v = note.value.trim(); if (v) set.note = v; else delete set.note; Tabs.save(data); }, 400); };
    note.onblur = () => { clearTimeout(note.t); const v = note.value.trim(); if (v) set.note = v; else delete set.note; Tabs.save(data); };
  }
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { if (setEditing) return; setCtx = { id, idx: +b.dataset.open }; go("#/song/" + encodeURIComponent(songs[+b.dataset.open].id)); });
  const move = (i, j) => { const a = ids(); [a[i], a[j]] = [a[j], a[i]]; set.songIds = a; Tabs.save(data); renderSet(id); };
  app.querySelectorAll("[data-up]").forEach(b => b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
  app.querySelectorAll("[data-down]").forEach(b => b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
  app.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const a = ids(); a.splice(+b.dataset.rm, 1); set.songIds = a; Tabs.save(data); renderSet(id); });
  $("addsongs").onclick = () => pickSongs(set, () => renderSet(id));
  $("delset").onclick = () => {
    const entry = Tabs.deleteSet(data, id);
    setEditing = false; filter = "sets"; go("#/");
    toast(`Deleted "${set.name}"`, null, { label: "Undo", fn: () => { Tabs.restore(data, entry); render(); toast("Restored"); } });
  };
}

// Choose songs to add to a set.
// Add songs to a set. The cover at the top grows a ring for each song you pick
// (in that song's key color), and the length adds up as you go. Songs go in
// the order you tap them; tap again to take one out.
function pickSongs(set, done) {
  const pool = [...data.songs].sort((a, b) => a.title.localeCompare(b.title));
  const chosen = [];
  layer.innerHTML = `
    <div class="scrim" id="pk-scrim"></div>
    <div class="panel full pk" role="dialog" aria-label="Add songs">
      <div class="grab"></div>
      <div class="ph"><button class="tb" id="pk-cancel">Back</button><h2>Add songs</h2><button class="tb go" id="pk-add">Done</button></div>
      <div class="pbody">
        <div class="pk-top"><div class="pk-cv" id="pk-cv"></div><div class="pk-tt"><b>${esc(set.name)}</b><span id="pk-len"></span><small>Each song adds a ring in the color of its key.</small></div></div>
        <label class="cmd glass" style="height:44px;margin-bottom:12px">${icon("search")}<input id="pk-q" placeholder="Search your songs" autocomplete="off"></label>
        <div class="list glass" id="pk-list"></div>
      </div>
    </div>`;
  const all = () => [...setSongs(set), ...chosen.map(i => data.songs.find(s => s.id === i))];
  const top = () => {
    const songs = all();
    $("pk-cv").innerHTML = coverSVG(songs.map(s => s.format === "tab" ? "" : keyOf(s)), { name: set.name, small: true, notext: true });
    const secs = songs.reduce((t, s) => t + songLength(s), 0);
    $("pk-len").textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}${songs.length ? ` · about ${Math.round(secs / 60)} min` : ""}`;
    $("pk-add").textContent = chosen.length ? `Add ${chosen.length}` : "Done";
  };
  const paint = () => {
    const q = $("pk-q").value.trim().toLowerCase();
    $("pk-list").innerHTML = pool.filter(s => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q)).map(s => {
      const inSet = set.songIds.includes(s.id), n = chosen.indexOf(s.id) + 1, k = s.format === "tab" ? "" : keyOf(s);
      return `<button class="row pick ${n ? "on" : ""}" data-pick="${esc(s.id)}" ${inSet ? "disabled" : ""}>
        <span class="pk-dot" style="background:${keyColor(k, s.title)}"></span>
        <div class="txt"><div class="t">${esc(s.title)}</div><div class="a">${inSet ? "Already in this set" : `${esc(s.artist || "Unknown artist")}${k ? ` · ${esc(k)}` : ""}`}</div></div>
        ${n ? `<span class="pk-n">${n}</span>` : ""}<span class="check">${n || inSet ? icon("check") : ""}</span></button>`;
    }).join("");
    $("pk-list").querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
      const i = b.dataset.pick, at = chosen.indexOf(i);
      at >= 0 ? chosen.splice(at, 1) : chosen.push(i);
      paint(); top();
    });
  };
  paint(); top();
  $("pk-q").oninput = paint;
  const close = () => { layer.innerHTML = ""; };
  $("pk-scrim").onclick = close; $("pk-cancel").onclick = close;
  $("pk-add").onclick = () => { set.songIds.push(...chosen); Tabs.save(data); close(); done(); if (chosen.length) toast(`Added ${chosen.length} song${chosen.length === 1 ? "" : "s"}`); };
}

// From a song: put it in one or more sets, or start a new one.
function addToSet(song) {
  layer.innerHTML = `
    <div class="scrim" id="as-scrim"></div>
    <div class="panel card" role="dialog" aria-label="Add to set">
      <div class="pc-head">${icon("listplus")}<span>Add "${esc(song.title)}" to a set</span></div>
      <div class="list glass" style="margin-bottom:12px">
        ${data.sets.map(x => `<button class="row pick ${x.songIds.includes(song.id) ? "on" : ""}" data-as="${esc(x.id)}">
          <div class="txt"><div class="t">${esc(x.name)}</div><div class="a">${setSongs(x).length} songs</div></div>
          <span class="check">${x.songIds.includes(song.id) ? icon("check") : ""}</span></button>`).join("")}
        <button class="row newset" id="as-new"><div class="txt"><div class="t">${icon("plus")} New set</div></div></button>
      </div>
      <div class="actions"><button class="btn primary" id="as-done">Done</button></div>
    </div>`;
  const close = () => { layer.innerHTML = ""; };
  $("as-scrim").onclick = close; $("as-done").onclick = close;
  layer.querySelectorAll("[data-as]").forEach(b => b.onclick = () => {
    const x = data.sets.find(z => z.id === b.dataset.as);
    x.songIds = x.songIds.includes(song.id) ? x.songIds.filter(i => i !== song.id) : [...x.songIds, song.id];
    Tabs.save(data); addToSet(song);
  });
  $("as-new").onclick = () => newSet(x => { if (!x.songIds.includes(song.id)) x.songIds.push(song.id); Tabs.save(data); addToSet(song); });
}

// End of a song in a set: offer the next one, playing it after 5 seconds.
function nextUp() {
  const set = setCtx && data.sets.find(x => x.id === setCtx.id);
  if (!set) return;
  const songs = setSongs(set);
  const next = songs[setCtx.idx + 1];
  document.querySelector(".nextup")?.remove();
  if (!next) {
    if (setRun?.id === set.id && setRun.played.size) {
      const run = logSetRun(set, setRun.startedAt, setRun.played.size);
      Tabs.save(data);
      setRun = null;
      toast(`Set played through · ${mmss(run.secs)}`, null, { label: "See set", fn: () => go("#/set/" + encodeURIComponent(set.id)) });
    } else toast(`End of "${set.name}"`);
    return;
  }
  const card = document.createElement("div");
  card.className = "nextup glass float";
  let left = 5;
  /* A different tuning next: don't start on its own; offer the tuner instead. */
  const retune = songTuning(next) !== songTuning(songs[setCtx.idx]) ? TUNINGS[songTuning(next)].name : "";
  card.innerHTML = `<div class="nu-t"><span class="lab">NEXT UP · ${setCtx.idx + 2} of ${songs.length}${retune ? ` · ${esc(retune.toUpperCase())}` : ""}</span><b>${esc(next.title)}</b><span>${retune ? `Retune to ${esc(retune)} first` : esc(next.artist || "")}</span></div>
    ${retune ? `<button class="btn sm" id="nu-tune">${icon("fork")}Tune</button><button class="btn sm primary" id="nu-go">Play</button>`
      : `<button class="btn sm" id="nu-stop">Stop</button><button class="btn sm primary" id="nu-go">Play <span id="nu-n">${left}</span></button>`}`;
  document.body.appendChild(card);
  const go2 = () => { clearInterval(timer); card.remove(); setCtx = { id: set.id, idx: setCtx.idx + 1, autoplay: true }; go("#/song/" + encodeURIComponent(next.id)); };
  const timer = retune ? 0 : setInterval(() => { left--; const n = $("nu-n"); if (n) n.textContent = left; if (left <= 0) go2(); }, 1000);
  $("nu-go").onclick = go2;
  $("nu-stop")?.addEventListener("click", () => { clearInterval(timer); card.remove(); });
  $("nu-tune")?.addEventListener("click", () => openTuner(songTuning(next)));
  card.dataset.timer = timer;
}

// Near the end of a song in a set, a quiet line shows how the next song starts.
function nextLine() {
  const set = setCtx && data.sets.find(x => x.id === setCtx.id);
  const next = set && setSongs(set)[setCtx.idx + 1];
  const left = document.documentElement.scrollHeight - innerHeight - scrollY;
  let el = document.querySelector(".nextline");
  if (!next || left > innerHeight * 0.5 || document.querySelector(".nextup")) { el?.remove(); return; }
  if (el) return;
  el = document.createElement("div");
  el.className = "nextline";
  const first = firstLyric(next.body);
  el.innerHTML = `<span class="lab">Next</span><b>${esc(next.title)}</b>${first ? `<span class="fl">${esc(first)}</span>` : ""}${songTuning(next) !== songTuning(viewing) ? `<span class="tn">${esc(TUNINGS[songTuning(next)].name)}</span>` : ""}`;
  document.body.appendChild(el);
}

// ---------- Set covers ----------
// Every set gets a cover drawn from what's in it: one ring per song, in a color
// for that song's key (a warm palette that sits with the copper theme), around a
// glow in the first song's color. The name sits in the title font at the bottom.
const PAL = [[20, 75, 68], [38, 70, 66], [8, 60, 62], [345, 45, 66], [280, 32, 70], [200, 38, 64], [160, 30, 62], [45, 35, 78], [28, 55, 58], [330, 35, 60], [215, 30, 70], [12, 45, 72]];
const FIFTHS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const ENHARM = { "C#": "Db", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb", Cb: "B", "E#": "F", Fb: "E", "B#": "C" };
const hashOf = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function keyColor(k, fallback = "", a = 1) {
  const root = (/^[A-G][#b]?/.exec(k || "") || [])[0];
  const i = root ? FIFTHS.indexOf(ENHARM[root] || root) : -1;
  const [h, sat, l] = PAL[i >= 0 ? (i + 9) % 12 : hashOf(fallback) % 12];
  return `hsl(${h} ${sat}% ${l}% / ${a})`;
}
let coverSeq = 0;
// keys: the songs' keys in order. opts: { name, kicker, fs (title size in px), small }
function coverSVG(keys, opts = {}) {
  const id = "cg" + (++coverSeq), name = opts.name || "";
  const base = keyColor(keys[0], name);
  const cx = 148, cy = 58;
  const rings = keys.slice(0, 9).map((k, i) => {
    const r = 22 + i * 17, len = 2 * Math.PI * r, gap = len * (0.18 + ((hashOf(name + i) % 30) / 100));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${keyColor(k, name + i)}" stroke-opacity="${(0.88 - i * 0.06).toFixed(2)}" stroke-width="${opts.small ? 2.4 : 3.2}" stroke-linecap="round" stroke-dasharray="${(len - gap).toFixed(1)} ${gap.toFixed(1)}" transform="rotate(${(i * 47 + hashOf(name) % 90) - 90} ${cx} ${cy})"/>`;
  }).join("");
  return `<div class="cover" aria-hidden="true"><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="${id}" cx="74%" cy="29%" r="70%"><stop offset="0" stop-color="${base}" stop-opacity=".5"/><stop offset=".6" stop-color="${base}" stop-opacity=".08"/><stop offset="1" stop-color="#0d0d0f" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="200" fill="#121214"/><rect width="200" height="200" fill="url(#${id})"/>${rings}<circle cx="${cx}" cy="${cy}" r="4" fill="${base}"/></svg>
    ${opts.kicker ? `<div class="cv-k">${esc(opts.kicker)}</div>` : ""}${name && !opts.notext ? `<div class="cv-t" style="font-size:${opts.fs || 22}px">${esc(name)}</div>` : ""}</div>`;
}
const setKeys = set => setSongs(set).map(s => s.format === "tab" ? "" : keyOf(s));
// A set's cover: drawn from its songs (the default), its songs' album art, or a photo.
const setArt = set => setSongs(set).map(s => s.listen?.art).filter(a => /^https:\/\//.test(a || ""));
function setCover(set, opts = {}) {
  const type = set.cover?.type;
  if (type === "photo" && coverCache[set.id]) return `<div class="cover"><img src="${coverCache[set.id]}" alt=""></div>`;
  if (type === "art") {
    const art = setArt(set);
    if (art.length >= 4) return `<div class="cover mosaic">${art.slice(0, 4).map(a => `<img src="${esc(a)}" alt="" loading="lazy">`).join("")}</div>`;
    if (art.length) return `<div class="cover"><img src="${esc(art[0])}" alt="" loading="lazy"></div>`;
  }
  return coverSVG(setKeys(set), { name: set.name, ...opts });
}
// The page tint for a set: the photo's own color, or its first song's key color.
const setTint = (set, a = 0.5) => set.cover?.type === "photo" && set.cover.tint ? `hsl(${set.cover.tint} / ${a})` : keyColor(setKeys(set)[0], set.name, a);

// Cover photos live in IndexedDB (they're too big for the main save), keyed by set id,
// and are loaded into memory at start so covers draw without waiting.
const coverCache = {};
const coverDB = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-covers", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("covers");
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function coverTx(mode, fn) {
  const db = await coverDB();
  return new Promise((ok, bad) => { const tx = db.transaction("covers", mode); const out = fn(tx.objectStore("covers")); tx.oncomplete = () => ok(out?.result ?? out); tx.onerror = () => bad(tx.error); });
}
const coverPut = (id, url) => { coverCache[id] = url; return coverTx("readwrite", st => st.put(url, id)).catch(() => {}); };
const coverDel = id => { delete coverCache[id]; return coverTx("readwrite", st => st.delete(id)).catch(() => {}); };
async function coverLoadAll() {
  try {
    const db = await coverDB();
    await new Promise(ok => { const st = db.transaction("covers").objectStore("covers"); const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return ok(); coverCache[cur.key] = cur.value; cur.continue(); }; c.onerror = ok; });
  } catch {}
}
// "Fri 8:00 PM" within the week, "Oct 17 · 8:00 PM" further out.
function whenText(when, withDay = true) {
  const d = new Date(when);
  if (isNaN(d)) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const soon = Math.abs(d - Date.now()) < 6 * 864e5;
  const day = soon ? d.toLocaleDateString([], { weekday: "short" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return withDay ? `${day} ${time}` : time;
}
const playedOn = t => new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const fullWhen = when => { const d = new Date(when); return isNaN(d) ? "" : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; };
// Playing a whole set: a short title card first (the cover, the name, what's first),
// then the first song starts. Tap to skip it. The run is timed for the set's history.
let setRun = null; /* { id, startedAt, played: Set of song ids } */
function playSet(set) {
  const songs = setSongs(set);
  if (!songs.length) return go("#/set/" + encodeURIComponent(set.id));
  setRun = { id: set.id, startedAt: Date.now(), played: new Set() };
  const start = () => { setCtx = { id: set.id, idx: 0, autoplay: true }; go("#/song/" + encodeURIComponent(songs[0].id)); };
  const when = set.when && Date.parse(set.when);
  const today = when && new Date(when).toDateString() === new Date().toDateString();
  const kicker = today ? (new Date().getHours() >= 17 ? "Tonight's set" : "Today's set") : set.runs?.length ? "Playing again" : "Your set";
  const first = songs[0], fk = first.format === "tab" ? "" : keyOf(first);
  const card = document.createElement("div");
  card.className = "titlecard";
  card.style.setProperty("--tint", setTint(set, 0.55));
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", `${set.name}. First up: ${first.title}`);
  card.innerHTML = `<div class="tc-cv">${setCover(set, { fs: 30 })}</div>
    <div class="tc-k">${esc(kicker)}</div><h2>${esc(set.name)}</h2>
    <div class="tc-m">${songs.length} song${songs.length === 1 ? "" : "s"} · about ${Math.round(setLength(set) / 60)} min${set.where ? ` · ${esc(set.where)}` : ""}</div>
    <div class="tc-first">First up: <b>${esc(first.title)}</b>${fk ? ` · Key of ${esc(fk)}` : ""}</div>
    <div class="tc-bar"><i></i></div><div class="tc-skip">Tap to start now</div>`;
  document.body.appendChild(card);
  const ms = calm() ? 1200 : 2600;
  card.querySelector(".tc-bar i").style.animationDuration = ms + "ms";
  let gone = false;
  const go3 = () => { if (gone) return; gone = true; clearTimeout(t); card.classList.add("out"); setTimeout(() => card.remove(), 300); start(); };
  const t = setTimeout(go3, ms);
  card.onclick = go3;
}

// ---------- New set (and set details) ----------
// One calm sheet: the cover takes shape as you type the name. When and Where are
// optional; a date makes the set show up as "Up next" on the library. "Start from"
// fills the set from a group of songs you already have.
function setSheet(existing, done) {
  const starts = [
    ["empty", "Empty set", []],
    ["fav", "Favorites", data.songs.filter(s => s.favorite)],
    ["learn", "Learning", data.songs.filter(s => s.status === "learning")],
    ["week", "Played this week", data.songs.filter(s => playsThisWeek(s))]
  ].filter(x => x[0] === "empty" || x[2].length);
  let start = "empty";
  layer.innerHTML = `
    <div class="scrim" id="ns-scrim"></div>
    <div class="panel full ns" role="dialog" aria-label="${existing ? "Set details" : "New set"}">
      <div class="grab"></div>
      <div class="ns-head"><button class="tb" id="ns-cancel">Cancel</button><b>${existing ? "Set details" : "New set"}</b><button class="tb go" id="ns-ok">${existing ? "Save" : "Next"}</button></div>
      <div class="ns-body">
        <div class="ns-cover" id="ns-cover"></div>
        <p class="ns-cap">${existing ? "The cover is drawn from the name and the songs in the set." : "Your cover starts with the name. Songs add to it."}</p>
        <label class="ns-f"><input id="ns-name" value="${esc(existing?.name || "")}" placeholder="Name this set" autocomplete="off" aria-label="Set name"></label>
        <label class="ns-f"><span>When</span><input id="ns-when" type="datetime-local" value="${esc(existing?.when || "")}" aria-label="When"><button class="ns-x" id="ns-noday" ${existing?.when ? "" : "hidden"} aria-label="Clear date">${icon("x")}</button></label>
        <label class="ns-f"><span>Where</span><input id="ns-where" value="${esc(existing?.where || "")}" placeholder="Optional" autocomplete="off" aria-label="Where"></label>
        ${existing ? "" : `<div class="ns-lab">Start from</div><div class="ns-chips">${starts.map(([k, l, list]) => `<button class="chip ${k === start ? "on" : ""}" data-st="${k}">${l}${list.length ? ` <span class="n">${list.length}</span>` : ""}</button>`).join("")}</div>`}
      </div>
    </div>`;
  const keysNow = () => existing ? setKeys(existing) : (starts.find(x => x[0] === start)[2]).map(s => keyOf(s));
  const paint = () => {
    const name = $("ns-name").value.trim() || "New set";
    const w = $("ns-when").value;
    $("ns-cover").innerHTML = coverSVG(keysNow(), { name, fs: 26, kicker: w ? fullWhen(w).split(" · ")[0] : "" });
    $("ns-noday").hidden = !w;
  };
  const close = () => { layer.innerHTML = ""; };
  $("ns-scrim").onclick = close; $("ns-cancel").onclick = close;
  $("ns-name").oninput = paint; $("ns-when").oninput = paint; $("ns-when").onchange = paint;
  $("ns-noday").onclick = e => { e.preventDefault(); $("ns-when").value = ""; paint(); };
  layer.querySelectorAll("[data-st]").forEach(b => b.onclick = () => {
    start = b.dataset.st;
    layer.querySelectorAll("[data-st]").forEach(x => x.classList.toggle("on", x === b));
    paint();
  });
  $("ns-ok").onclick = () => {
    const name = $("ns-name").value.trim();
    if (!name) { toast("Give the set a name"); $("ns-name").focus(); return; }
    const when = $("ns-when").value, where = $("ns-where").value.trim();
    const set = existing || Tabs.addSet(data, name);
    set.name = name;
    if (when) set.when = when; else delete set.when;
    if (where) set.where = where; else delete set.where;
    if (!existing) set.songIds = (starts.find(x => x[0] === start)[2]).map(s => s.id);
    Tabs.save(data);
    close();
    done?.(set, !existing && !set.songIds.length);
  };
  paint();
  if (!existing) setTimeout(() => $("ns-name")?.focus(), 350);
}
// New set from anywhere: create it, open it, and go straight to adding songs if it's empty.
function newSet(after) {
  setSheet(null, (set, empty) => {
    if (after) return after(set);
    go("#/set/" + encodeURIComponent(set.id));
    if (empty) setTimeout(() => pickSongs(set, () => renderSet(set.id)), 450);
  });
}

// ---------- Recently deleted ----------
function renderTrash() {
  const left = t => Math.max(1, TRASH_DAYS - Math.floor((Date.now() - Date.parse(t.deletedAt)) / 86400000));
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back to settings">${icon("back")}</button>
      ${data.trash.length ? `<button class="tb" id="t-empty" style="color:#e07a6c">Delete all</button>` : ""}</div>
    <h1 class="title" style="margin:14px 2px 18px">Recently deleted</h1>
    ${data.trash.length ? `<div class="list glass">${data.trash.map((t, i) => `
      <div class="row">
        <div class="txt"><div class="t">${esc(t.type === "set" ? t.item.name : t.item.title)}</div>
          <div class="a">${t.type === "set" ? "Set" : esc(t.item.artist || "Song")} · ${left(t)} day${left(t) === 1 ? "" : "s"} left</div></div>
        <button class="btn sm" data-forget="${i}">Delete</button>
        <button class="btn sm primary" data-restore="${i}">Restore</button>
      </div>`).join("")}</div>`
      : `<div class="empty">Nothing here. Deleted songs and sets stay for ${TRASH_DAYS} days.</div>`}
    <p class="foot">Items are removed for good after ${TRASH_DAYS} days.</p>`;
  $("back").onclick = () => go("#/settings");
  app.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => {
    const t = data.trash[+b.dataset.restore];
    Tabs.restore(data, t); renderTrash();
    toast(`Restored "${t.type === "set" ? t.item.name : t.item.title}"`);
  });
  app.querySelectorAll("[data-forget]").forEach(b => b.onclick = () => {
    const t = data.trash[+b.dataset.forget];
    if (!confirm("Delete for good? This can't be undone.")) return;
    Tabs.forget(data, t); renderTrash();
  });
  $("t-empty")?.addEventListener("click", () => {
    if (!confirm(`Delete all ${data.trash.length} for good? This can't be undone.`)) return;
    data.trash = []; Tabs.save(data); renderTrash();
  });
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

const TIPS = {
  library: [
    { at: "#list .row", text: "Start with the sample song. Tap it to open." },
    { at: ".cmd", text: "Search titles, artists or a line you remember from the lyrics. To add a song, paste a chord sheet here, or tap + to write one." }
  ],
  song: [
    { at: ".sheet .c[data-ch] .ct", text: "Tap a chord to see how to play it." },
    { at: ".sheet > .pr", text: "Tap a line to start from it. Press play and that line glides to your reading point." },
    { at: "#play", text: "Play scrolls the song. The slider sets how long the song takes, and a count-in clicks you in." },
    { at: "#more", text: "Text size, sets, practice a section, metronome, tuner, Edit and more live in this menu." },
    { at: "#listen", text: "Listen finds this song on Apple Music and keeps the link." },
    { at: "#stat", text: "Mark songs you're learning. A play counts when you play a song through." },
    { at: "#nnbtn", text: "Turn on Now and Next to see the chord you're on and what's coming while you play." },
    { at: "#more", text: "With your API key, Make it easier and Spark tone are in this menu too.", needsKey: true }
  ]
};
function showTips(name) {
  const seen = data.settings.tipsSeen && typeof data.settings.tipsSeen === "object" ? data.settings.tipsSeen : {};
  if (seen[name] || document.querySelector(".tipwrap")) return;
  const steps = TIPS[name].filter(t => document.querySelector(t.at) && (!t.needsKey || aiKey()));
  if (!steps.length) return;
  const done = () => {
    wrap.remove();
    data.settings.tipsSeen = { ...seen, [name]: true };
    Tabs.save(data);
  };
  const wrap = document.createElement("div");
  wrap.className = "tipwrap";
  wrap.innerHTML = `<div class="tipring"></div><div class="tipcard glass float" role="dialog" aria-live="polite">
    <p class="tiptext"></p><div class="tipbar"><span class="tipn"></span><button class="tb" id="tip-skip">Skip tips</button><button class="btn sm primary" id="tip-next">Next</button></div></div>`;
  document.body.appendChild(wrap);
  let i = 0;
  const place = () => {
    const step = steps[i];
    const el = document.querySelector(step.at);
    if (!el) { i++; return i < steps.length ? place() : done(); }
    const r0 = el.getBoundingClientRect();
    if (r0.top < 70 || r0.bottom > innerHeight - 160) el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect(), pad = 6;
    const ring = wrap.querySelector(".tipring");
    ring.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px`;
    const card = wrap.querySelector(".tipcard");
    wrap.querySelector(".tiptext").textContent = step.text;
    wrap.querySelector(".tipn").textContent = `${i + 1} of ${steps.length}`;
    $("tip-next").textContent = i === steps.length - 1 ? "Done" : "Next";
    const below = r.bottom + 14 + 130 < innerHeight;
    card.style.top = below ? `${r.bottom + 14}px` : "";
    card.style.bottom = below ? "" : `${innerHeight - r.top + 14}px`;
  };
  $("tip-next").onclick = () => { i++; i < steps.length ? place() : done(); };
  $("tip-skip").onclick = done;
  place();
}

// ---------- Router ----------
function render() {
  const r = route();
  leaveHooks.forEach(fn => fn(r));
  app.classList.remove("viewer");
  layer.innerHTML = "";
  /* Old links: #/add and #/edit/<id> open the editor. */
  if (r.name === "add") { history.replaceState(null, "", "#/"); return newSong(); }
  if (r.name === "edit") { openEdit = { id: r.id, view: "text" }; history.replaceState(null, "", "#/song/" + encodeURIComponent(r.id)); return render(); }
  if (r.name === "song") {
    renderViewer(r.id);
    const want = openEdit;
    openEdit = null;
    const song = viewing?.id === r.id && want?.id === r.id ? viewing : null;
    if (song) songEditor(song, want.view);
  }
  else if (r.name === "settings") { renderSettings(); window.scrollTo(0, 0); }
  else if (r.name === "trash") { renderTrash(); window.scrollTo(0, 0); }
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
export { $, data, icon, layer, esc, toast, go, busy, AI, aiKey, askClaude, aiError, parseJSON, openLink, appleSearchURL, leaveSearch, chordNames, chordSVG, songKey, redraw };
