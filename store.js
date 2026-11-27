// Tabs storage care: where the library lives (IndexedDB, with a copy in
// localStorage), the storage-full warning, asking to keep storage permanently, backups, and the
// problems log behind Settings > Help > Copy diagnostics.
import { Tabs, VERSION, backupOf, pickLibrary, withSavedAt } from "./core.js";
import { showToCopy, toast } from "./ui.js";
import { coverCache } from "./sets.js";
import { aiKey, data } from "./app.js";

// ---------- Where the library lives ----------
// The library is kept in the phone's database (IndexedDB, plenty of room), with
// a copy in localStorage written with each save (it's instant, and a database
// write may not finish if the phone closes the app right then).
// At start the newer readable one is used (pickLibrary in core.js); a library
// from an older Tabs moves across once. Without IndexedDB, localStorage is used.
const STORE_KEY = "tabs-v1";
const libDB = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-library", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("copy");
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function libTx(mode, fn) {
  const db = await libDB();
  return new Promise((ok, bad) => { const tx = db.transaction("copy", mode); const out = fn(tx.objectStore("copy")); tx.oncomplete = () => ok(out?.result); tx.onerror = () => bad(tx.error); tx.onabort = () => bad(tx.error); });
}
const where = { db: false, copy: null, size: 0 }; /* db: saving to IndexedDB; copy: true, or false when it didn't fit */
let copyNext = null;
function writeCopy() {
  if (!copyNext) return;
  const { json, at } = copyNext; copyNext = null;
  try { localStorage.setItem(STORE_KEY, withSavedAt(json, at)); where.copy = true; }
  catch { where.copy = false; /* too big for localStorage: the database still has it */ }
}
let saveWarned = 0;
function saveFailed() {
  if (Date.now() - saveWarned < 60e3) return;
  saveWarned = Date.now();
  toast("Couldn't save: the phone's storage for Louie is full. Back up, then remove songs or cover photos you don't need.", null, { label: "Back up", fn: () => backupNow() });
}
Tabs.onSaveError = saveFailed;
function writeMain(json) {
  const at = new Date().toISOString();
  where.size = json.length;
  libTx("readwrite", st => st.put({ json, at, lsOk: true }, "lib")).catch(() => {
    /* The database refused: keep the copy current instead, and say so if that fails too. */
    copyNext = { json, at }; writeCopy();
    if (where.copy === false) saveFailed();
  });
  copyNext = { json, at }; writeCopy();
  dailyCopy();
  return true;
}

// ---------- Daily copies (5.13.0, Graham 2026-11-26) ----------
// The first save of each day also keeps a copy of the whole library, as a backup file would be, in the database under
// "day-YYYY-MM-DD" (the phone's own date). The newest 7 are kept, so Settings, Songbook and backups, Daily copies can
// put back the library as it was on any of the last 7 days. They stay on this phone: a backup to Files is still how a
// library survives a lost phone, so the weekly reminder stays. Cover photos aren't in them (they live outside the save).
export const DAY_KEEP = 7;
const dayKey = d => `day-${d}`;
const today = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
let dayDone = null;
async function dailyCopy() {
  const d = today();
  if (dayDone === d) return;
  let lib;
  try { lib = data; } catch { return; /* very early in the start: the app hasn't its library yet */ }
  if (!lib?.songs?.length) return;
  dayDone = d;
  try {
    const keys = (await libTx("readonly", st => st.getAllKeys())).map(String);
    if (!keys.includes(dayKey(d))) await libTx("readwrite", st => st.put({ json: Tabs.export(lib), at: new Date().toISOString(), songs: lib.songs.length }, dayKey(d)));
    const days = [...new Set([...keys, dayKey(d)])].filter(k => /^day-\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse();
    const gone = days.slice(DAY_KEEP);
    if (gone.length) await libTx("readwrite", st => gone.forEach(k => st.delete(k)));
  } catch { dayDone = null; /* the database refused: try again on the next save */ }
}
/* The daily copies kept, newest first: [{ day, at, songs }] */
export async function dailyCopies() {
  try {
    const keys = (await libTx("readonly", st => st.getAllKeys())).map(String).filter(k => /^day-\d{4}-\d{2}-\d{2}$/.test(k)).sort().reverse();
    const out = [];
    for (const k of keys) { const v = await libTx("readonly", st => st.get(k)); if (v?.json) out.push({ day: k.slice(4), at: v.at, songs: v.songs || 0 }); }
    return out;
  } catch { return []; }
}
/* Put back the library from one day's copy: checked and cleaned like an imported backup (Tabs.import). null if it can't be read. */
export async function restoreDay(day) {
  try { const v = await libTx("readonly", st => st.get(dayKey(day))); return v?.json ? Tabs.import(v.json) : null; }
  catch { return null; }
}

/* 5.2.0 (Graham, 2026-11-23): the text size now goes down to 50% and new songs start there. Once, a song still at the old
   default (size exactly 1) moves to 0.5; any other size stays. The flag keeps it from running again, so a song you set back to 100% later stays. */
const SIZE50_FLAG = "tabs.size50.v1";
function size50(lib) {
  try {
    if (localStorage.getItem(SIZE50_FLAG)) return lib;
    let moved = 0;
    for (const s of lib?.songs || []) if (s.size === 1) { s.size = 0.5; moved++; }
    /* save first; the flag only after the save worked, so a failed save tries again on the next start */
    if (moved) { Tabs.save(lib); if (Tabs.flush() === false) return lib; }
    localStorage.setItem(SIZE50_FLAG, "1");
  } catch { /* storage blocked: leave sizes as they are */ }
  return lib;
}
async function loadLibrary() { return size50(await loadLibrary0()); }
async function loadLibrary0() {
  let main = null;
  try { main = await libTx("readonly", st => st.get("lib")); where.db = true; }
  catch { where.db = false; }
  if (!where.db) return Tabs.load();
  let copy = null;
  try { copy = localStorage.getItem(STORE_KEY); } catch { /* blocked */ }
  const { lib, from, mainBroken } = pickLibrary(main, copy);
  Tabs.write = writeMain;
  /* Moving across from an older Tabs, or the copy was newer: bring the database up to date. */
  if (from === "copy") { Tabs.save(lib); Tabs.flush(); }
  if (from === "copy" && mainBroken) setTimeout(() => toast("Your library was restored from its safety copy."), 600);
  setTimeout(dailyCopy, 4000); /* 5.13.0: today's copy, even on a day with no edits */
  return lib;
}
// ---------- Problems ----------
// Errors are kept on this phone (the last 20) so Settings > Help > Copy diagnostics
// can report them. The first one in a session shows a short note with a way to
// copy the details; nothing is ever sent anywhere.
const ERR_KEY = "tabs.errors.v1";
/* 4.42.7 (#76): problems from an older version are marked in Copy diagnostics, and drop off after 30 days */
const OLD_DAYS = 30;
const problems = (() => { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch { return []; } })()
  .filter(p => p.v === VERSION || Date.now() - Date.parse(p.at) < OLD_DAYS * 864e5);
let problemNoted = false;
function noteError(e, { quiet = false, where = "" } = {}) {
  const err = e?.reason ?? e?.error ?? e;
  const msg = String(err?.message || e?.message || err || "Unknown error").slice(0, 300);
  if (/ResizeObserver loop|^Script error\.?$/.test(msg)) return;
  problems.push({ at: new Date().toISOString(), v: VERSION, where: where || location.hash || "#/", msg,
    stack: String(err?.stack || "").split("\n").slice(0, 6).join("\n").slice(0, 800) });
  problems.splice(0, problems.length - 20);
  try { localStorage.setItem(ERR_KEY, JSON.stringify(problems)); } catch { /* storage full */ }
  if (quiet || problemNoted) return;
  problemNoted = true;
  toast("Something went wrong. Your songs are safe.", null, { label: "Copy details", fn: copyDiagnostics });
}
window.addEventListener("error", e => noteError(e));
window.addEventListener("unhandledrejection", e => noteError(e));
// Anything the page's security policy blocks (a request to a site Tabs doesn't
// allow) is noted too, so Copy diagnostics names the address.
document.addEventListener("securitypolicyviolation", e => noteError(new Error(`Blocked by policy (${e.effectiveDirective || e.violatedDirective}): ${String(e.blockedURI).slice(0, 120)}`), { quiet: true, where: "policy" }));

// Everything useful for fixing a problem, and nothing private: no song words,
// titles or API key.
async function diagnostics() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const mb = n => (n / 1048576).toFixed(1) + " MB";
  const s = data.settings, hidden = ["tipsSeen", "used"];
  return [
    `Louie: Learn Guitar ${VERSION}, ${new Date().toISOString()}`,
    navigator.userAgent,
    `Home Screen app: ${matchMedia("(display-mode: standalone)").matches || navigator.standalone ? "yes" : "no"}; screen ${innerWidth}x${innerHeight}; offline copy: ${navigator.serviceWorker?.controller ? "yes" : "no"}`,
    `Library: ${data.songs.length} songs, ${data.sets.length} sets, ${data.trash.length} recently deleted`,
    `Storage: ${where.db ? "database" : "localStorage only"}, copy ${where.copy === false ? "too big" : where.copy ? "ok" : "not yet"}, library ${mb(where.size || JSON.stringify(data).length)}; ${est ? `${mb(est.usage)} of ${mb(est.quota)}` : "unknown"} used; kept permanently: ${storageKept ? "yes" : storageKept === false ? "no" : "unknown"}; AI key: ${aiKey() ? "set" : "none"}`,
    `Settings: ${JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !hidden.includes(k))))}`,
    ...problemLines()
  ].join("\n");
}
function problemLines() {
  const line = p => `- ${p.at} v${p.v} ${p.where}: ${p.msg}${p.stack ? "\n  " + p.stack.replace(/\n/g, "\n  ") : ""}`;
  const now = problems.filter(p => p.v === VERSION).reverse(), old = problems.filter(p => p.v !== VERSION).reverse();
  return [`Problems in ${VERSION} (${now.length}):`, ...(now.length ? now.map(line) : ["- none"]),
    ...(old.length ? [`Before ${VERSION} (${old.length}, may already be fixed; they drop off after ${OLD_DAYS} days):`, ...old.map(line)] : [])];
}
/* 5.13.0: Settings, Help, Clear problems empties the log (they still drop off by themselves after 30 days). */
export function clearProblems() {
  problems.splice(0);
  try { localStorage.removeItem(ERR_KEY); } catch { /* blocked */ }
}
async function copyDiagnostics() {
  const text = await diagnostics();
  try { await navigator.clipboard.writeText(text); toast("Diagnostics copied. Paste them into a message."); }
  catch { showToCopy("Copy these diagnostics", text); }
}

// ---------- Keeping the library safe ----------
// Ask the browser to keep this site's storage permanently (it may still decide).
let storageKept = null;
navigator.storage?.persist?.().then(ok => { storageKept = ok; }).catch(() => {});
navigator.storage?.persisted?.().then(ok => { if (storageKept === null) storageKept = ok; }).catch(() => {});

const WEEK = 7 * 86400000;
/* ignoreSnooze: Settings shows the backup line whenever one is due, even after "Later" on the Songbook */
function needsBackup({ ignoreSnooze = false } = {}) {
  if (!data.songs.length) return false;
  const s = data.settings, now = Date.now();
  if (!ignoreSnooze && s.backupSnooze && now < s.backupSnooze) return false;
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
  const file = new File([Object.keys(covers).length ? JSON.stringify(backupOf(data, { covers }), null, 2) : Tabs.export(data)], name, { type: "application/json" });
  let done = false;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Louie backup" }); done = true; }
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

export { SIZE50_FLAG, ago, backupNow, copyDiagnostics, loadLibrary, needsBackup, noteError, problems, storageKept, where };

/* Painted guitarist (2026-11-23): the selfie portrait and the xAI key are gone. On the first start after that, once, delete the
   portrait database and the key this phone may still hold. Nothing here was ever in the library or a backup. */
export const GONE_FLAG = "tabs.portraitgone.v1";
export async function clearPortraitLeftovers() {
  try {
    if (localStorage.getItem(GONE_FLAG)) return false;
    localStorage.removeItem("tabs.xaikey.v1");
    try { await new Promise(ok => { const r = indexedDB.deleteDatabase("tabs-portrait"); r.onsuccess = r.onerror = r.onblocked = () => ok(); }); } catch { /* none to delete */ }
    localStorage.setItem(GONE_FLAG, "1");
    return true;
  } catch { return false; }
}
