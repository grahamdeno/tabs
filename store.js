// Tabs storage care: the safety copy in IndexedDB and recovery from it, the
// storage-full warning, asking to keep storage permanently, backups, and the
// problems log behind Settings > Copy diagnostics.
import { Tabs, VERSION, migrate } from "./core.js";
import { showToCopy, toast } from "./ui.js";
import { coverCache } from "./sets.js";
import { aiKey, applyTheme, data, render, setData } from "./app.js";

// Saves are batched (see core.js). Write right away when the app goes to the
// background or closes, and say so if the phone won't store the library.
let saveWarned = 0;
Tabs.onSaveError = () => {
  if (Date.now() - saveWarned < 60e3) return;
  saveWarned = Date.now();
  toast("Couldn't save: the phone's storage for Tabs is full. Back up, then remove songs or cover photos you don't need.", null, { label: "Back up", fn: () => backupNow() });
};
// Safety copy: every save is also written to IndexedDB, which has far more room
// than the main save. At start, if the main save is missing or unreadable, or
// its last write failed (storage full), the library comes back from the copy.
const safeDB = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-library", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("copy");
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function safeTx(mode, fn) {
  const db = await safeDB();
  return new Promise((ok, bad) => { const tx = db.transaction("copy", mode); const out = fn(tx.objectStore("copy")); tx.oncomplete = () => ok(out?.result); tx.onerror = () => bad(tx.error); });
}
let safeCopy = null;   /* true once a copy is written, false if the phone refused */
let safeHeld = false;  /* the latest save, held until the start-up check is done; null after */
const writeSafe = c => safeTx("readwrite", st => st.put(c, "lib")).then(() => { safeCopy = true; }, () => { safeCopy = false; });
Tabs.onFlush = (json, lsOk) => {
  const c = { json, lsOk, at: new Date().toISOString() };
  if (safeHeld !== null) safeHeld = c; else writeSafe(c);
};
async function recoverLibrary() {
  let copy = null;
  try { copy = await safeTx("readonly", st => st.get("lib")); } catch { /* no IndexedDB */ }
  const held = safeHeld; safeHeld = null;
  let restored = false;
  if (copy?.json && (Tabs.loaded !== "ok" || copy.lsOk === false)) {
    try {
      const lib = migrate(JSON.parse(copy.json));
      if (lib.songs.length) { setData(lib); restored = true; }
    } catch { /* the copy is unreadable too */ }
  }
  if (restored) {
    Tabs.save(data); Tabs.flush();
    applyTheme(); render();
    toast("Your library was restored from its safety copy.");
  } else writeSafe(held || { json: JSON.stringify(data), lsOk: Tabs.loaded === "ok", at: new Date().toISOString() });
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
    `Storage: ${est ? `${mb(est.usage)} of ${mb(est.quota)}` : "unknown"}; kept permanently: ${storageKept ? "yes" : storageKept === false ? "no" : "unknown"}; AI key: ${aiKey() ? "set" : "none"}`,
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

export { ago, backupNow, copyDiagnostics, needsBackup, noteError, problems, recoverLibrary, safeCopy, storageKept };
