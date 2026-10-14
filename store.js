// Tabs storage care: where the library lives (IndexedDB, with a copy in
// localStorage), the storage-full warning, asking to keep storage permanently, backups, and the
// problems log behind Settings > Copy diagnostics.
import { Tabs, VERSION, pickLibrary, withSavedAt } from "./core.js";
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
  toast("Couldn't save: the phone's storage for Tabs is full. Back up, then remove songs or cover photos you don't need.", null, { label: "Back up", fn: () => backupNow() });
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
  return true;
}

async function loadLibrary() {
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
  return lib;
}
// ---------- Problems ----------
// Errors are kept on this phone (the last 20) so Settings > Copy diagnostics
// can report them. The first one in a session shows a short note with a way to
// copy the details; nothing is ever sent anywhere.
const ERR_KEY = "tabs.errors.v1";
const problems = (() => { try { return JSON.parse(localStorage.getItem(ERR_KEY)) || []; } catch { return []; } })();
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
    `Tabs ${VERSION}, ${new Date().toISOString()}`,
    navigator.userAgent,
    `Home Screen app: ${matchMedia("(display-mode: standalone)").matches || navigator.standalone ? "yes" : "no"}; screen ${innerWidth}x${innerHeight}; offline copy: ${navigator.serviceWorker?.controller ? "yes" : "no"}`,
    `Library: ${data.songs.length} songs, ${data.sets.length} sets, ${data.trash.length} recently deleted`,
    `Storage: ${where.db ? "database" : "localStorage only"}, copy ${where.copy === false ? "too big" : where.copy ? "ok" : "not yet"}, library ${mb(where.size || JSON.stringify(data).length)}; ${est ? `${mb(est.usage)} of ${mb(est.quota)}` : "unknown"} used; kept permanently: ${storageKept ? "yes" : storageKept === false ? "no" : "unknown"}; AI key: ${aiKey() ? "set" : "none"}`,
    `Settings: ${JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !hidden.includes(k))))}`,
    `Problems (${problems.length}):`,
    ...(problems.length ? problems.slice().reverse().map(p => `- ${p.at} v${p.v} ${p.where}: ${p.msg}${p.stack ? "\n  " + p.stack.replace(/\n/g, "\n  ") : ""}`) : ["- none"])
  ].join("\n");
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

export { ago, backupNow, copyDiagnostics, loadLibrary, needsBackup, noteError, problems, storageKept, where };
