// Tabs — core logic
// Personal chord sheet and tab library. All data stays in localStorage.

// Release version: MAJOR.MINOR.PATCH. Must match the service worker cache name.
export const VERSION = "4.0.0";

const STORAGE_KEY = "tabs-v1";
const DAY = 86400000;
export const TRASH_DAYS = 30;

export const SPEEDS = { slow: 20, medium: 45, fast: 75 };

const DEFAULT_SETTINGS = {
  theme: "auto", transpose: 0, /* theme: "auto" follows the phone, or "dark" / "light" / "green" (Green Room, 4.0.0) */ diagrams: false, focus: "always", pauseDiagrams: true,
  speedMode: "length",   // "length" (song length, mm:ss) or "multiplier" (1x style)
  startSpeed: 45,        // 1x-style starting speed for new songs
  startLength: 210,      // song-length starting value, seconds (3:30)
  countIn: true,         // one bar of clicks before scrolling starts
  tunerMode: "acoustic", // tuner: "acoustic", "electric" or "chromatic"
  tunerGuided: true,     // guitar tuner walks the strings low to high
  a4: 440,               // pitch reference for the tuner, Hz
  micExplained: false,   // the tuner has said why it needs the microphone
  songMap: true,          // the section rail on the right edge of a song
  nudge: true,            // the library's Today line: practice streak and a song for today
  arcSweep: "song",      // ring: a full sweep of the arc covers the whole "song" (speed-sensitive) or one "screen"
  lastBackup: null, backupSnooze: null, tipsSeen: false,
  v: 6
};

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function blank() {
  return { songs: [], sets: [], trash: [], settings: { ...DEFAULT_SETTINGS } };
}

// Bring older saves up to the current shape.
export function migrate(data) {
  if (!data || !Array.isArray(data.songs)) return blank();
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const v = data.settings?.v || 1;
  // v2: Now and Next starts off. Older saves had it on only because it was the default.
  if (v < 2) settings.diagrams = false;
  // v3: focus became Always / While playing / Off, defaulting to Always.
  if (v < 3) settings.focus = "always";
  // v4: speed by song length is the default style; count-in on.
  if (v < 4) { settings.speedMode = "length"; settings.countIn = true; }
  // v6: Automatic theme (follow the phone) is the default; the old default, dark, becomes automatic.
  if (v < 6 && settings.theme !== "light") settings.theme = "auto";
  settings.v = 6;
  delete settings.scrollSpeed;
  const songs = data.songs.map(s => {
    const song = { ...s };
    if (song.body === undefined) {
      song.body = song.tab || "";
      delete song.tab;
    }
    if (!song.format) song.format = song.body && looksLikeTab(song.body) ? "tab" : "chords";
    if (song.key === undefined) song.key = "";
    // v5: play history is kept as counts per day instead of one timestamp per play.
    if (Array.isArray(song.plays)) { song.playLog = compactPlays(song.plays, song.playLog); delete song.plays; }
    return song;
  });
  const ids = new Set(songs.map(s => s.id));
  const sets = (Array.isArray(data.sets) ? data.sets : []).map(x => ({ ...x, songIds: (x.songIds || []).filter(id => ids.has(id) || true) }));
  // Recently deleted: keep 30 days.
  const cutoff = Date.now() - TRASH_DAYS * DAY;
  const all = Array.isArray(data.trash) ? data.trash : [];
  const trash = all.filter(t => t && t.item && Date.parse(t.deletedAt) > cutoff);
  const kept = keepPlays(data.kept, all.filter(t => t && t.item && !(Date.parse(t.deletedAt) > cutoff))); /* a song that expires from Recently deleted leaves its plays behind */
  return { songs, sets, trash, settings, ...(data.journal && typeof data.journal === "object" ? { journal: data.journal } : {}), ...(kept ? { kept } : {}), ...(cleanTour(data.tour) ? { tour: cleanTour(data.tour) } : {}), ...(cleanSkills(data.skills) ? { skills: cleanSkills(data.skills) } : {}) };
}

const SAVE_DELAY = 150;
let pending = null, saveTimer = 0;
// ---------- Choosing the library at start ----------
// The library lives in the phone's database (IndexedDB) as { json, at }, with a
// copy in localStorage that carries its own save time (_savedAt). The newer
// readable one wins. A copy without a time was written by an older Tabs (when
// localStorage was the main store) or straight in, so it counts as newest,
// unless the database copy says the last localStorage write failed (lsOk: false).
export function pickLibrary(main, copyJson) {
  const read = json => { try { const d = JSON.parse(json); return d && Array.isArray(d.songs) ? d : null; } catch { return null; } };
  const m = main?.json ? read(main.json) : null, c = copyJson ? read(copyJson) : null;
  const mAt = Date.parse(main?.at) || 0;
  const cAt = c ? (c._savedAt ? Date.parse(c._savedAt) || 0 : main?.lsOk === false ? -1 : Infinity) : -Infinity;
  const from = m && (!c || mAt >= cAt) ? "main" : c ? "copy" : "none";
  const lib = from === "main" ? m : from === "copy" ? c : null;
  if (lib) delete lib._savedAt;
  return { lib: lib ? migrate(lib) : blank(), from, mainBroken: !!main?.json && !m };
}
// The localStorage copy: the library's JSON with its save time added.
export const withSavedAt = (json, at) => json.replace(/}\s*$/, `,"_savedAt":${JSON.stringify(at)}}`);

// ---------- Tip pacing ----------
// One-time tips are spaced at least 30 seconds apart, except a tip that leads
// naturally into the next (tap a chord, then Play, then how to pause...).
export const COACH_GAP = 30e3;
export const TIP_CHAIN = { chord: "play", play: "pause", pause: "line", searchInvite: "search" };
export const tipPaced = (key, last, now) => !last?.at || now - last.at >= COACH_GAP || TIP_CHAIN[last.key] === key;

// ---------- Markup ----------
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Safe markup: html`<b>${title}</b>` escapes every value, unless the value is
// itself safe markup (another html``, an icon, or raw() for markup built and
// checked elsewhere). Arrays are joined; null, undefined and false print
// nothing. The result works anywhere a string does (innerHTML, `${}`).
class SafeHTML { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new SafeHTML(String(s ?? ""));
const part = v => v instanceof SafeHTML ? v.s : Array.isArray(v) ? v.map(part).join("") : v == null || v === false ? "" : esc(v);
export const html = (strings, ...vals) => new SafeHTML(strings.reduce((out, s, i) => out + s + (i < vals.length ? part(vals[i]) : ""), ""));

export const Tabs = {
  // Without the app's store (tests, or a phone without IndexedDB) the library
  // lives in localStorage. `loaded` says how that went: "ok", "empty" or "broken".
  loaded: "empty",
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.loaded = raw ? "ok" : "empty";
      return raw ? migrate(JSON.parse(raw)) : blank();
    } catch {
      this.loaded = "broken";
      return blank();
    }
  },

  // Saving writes the whole library, so changes made close together are written
  // once, a moment later (and right away when the app goes to the background).
  // The app's store (`write`) takes the JSON when it has one; otherwise it goes to
  // localStorage, and if the phone refuses (storage full) onSaveError is told.
  save(data) {
    pending = data;
    if (!saveTimer) saveTimer = setTimeout(() => this.flush(), SAVE_DELAY);
  },
  flush() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!pending) return true;
    const d = pending; pending = null;
    const json = JSON.stringify(d);
    if (this.write) return this.write(json);
    try { localStorage.setItem(STORAGE_KEY, json); return true; }
    catch (e) { this.onSaveError?.(e); return false; }
  },
  onSaveError: null,
  write: null, // (json) => true: the app's store

  addSong(data, song) {
    const s = {
      id: newId(),
      created: new Date().toISOString(),
      favorite: false,
      format: "chords",
      key: "",
      speed: data.settings?.startSpeed || SPEEDS.medium,     // 1x style
      duration: data.settings?.startLength || 210,           // song length style, seconds
      ...song
    };
    data.songs.unshift(s);
    this.save(data);
    return s;
  },

  updateSong(data, id, updates) {
    const song = data.songs.find(s => s.id === id);
    if (song) Object.assign(song, updates);
    this.save(data);
    return song;
  },

  // Deleting moves to Recently deleted, remembering which sets held the song.
  deleteSong(data, id) {
    const song = data.songs.find(s => s.id === id);
    if (!song) return null;
    const inSets = data.sets.filter(x => x.songIds.includes(id)).map(x => ({ id: x.id, at: x.songIds.indexOf(id) }));
    data.songs = data.songs.filter(s => s.id !== id);
    data.sets.forEach(x => { x.songIds = x.songIds.filter(sid => sid !== id); });
    const entry = { type: "song", item: song, inSets, deletedAt: new Date().toISOString() };
    data.trash.unshift(entry);
    this.save(data);
    return entry;
  },

  deleteSet(data, id) {
    const set = data.sets.find(x => x.id === id);
    if (!set) return null;
    data.sets = data.sets.filter(x => x.id !== id);
    const entry = { type: "set", item: set, deletedAt: new Date().toISOString() };
    data.trash.unshift(entry);
    this.save(data);
    return entry;
  },

  restore(data, entry) {
    data.trash = data.trash.filter(t => t !== entry);
    if (entry.type === "song") {
      if (!data.songs.some(s => s.id === entry.item.id)) data.songs.unshift(entry.item);
      for (const ref of entry.inSets || []) {
        const set = data.sets.find(x => x.id === ref.id);
        if (set && !set.songIds.includes(entry.item.id)) set.songIds.splice(Math.min(ref.at, set.songIds.length), 0, entry.item.id);
      }
    } else if (entry.type === "set" && !data.sets.some(x => x.id === entry.item.id)) {
      entry.item.songIds = entry.item.songIds.filter(id => data.songs.some(s => s.id === id));
      data.sets.unshift(entry.item);
    }
    this.save(data);
  },

  forget(data, entry) {
    data.trash = data.trash.filter(t => t !== entry);
    data.kept = keepPlays(data.kept, [entry]) || data.kept;
    this.save(data);
  },
  forgetAll(data) {
    data.kept = keepPlays(data.kept, data.trash) || data.kept;
    data.trash = [];
    this.save(data);
  },

  addSet(data, name) {
    const set = { id: newId(), name: name || "New set", songIds: [], created: new Date().toISOString() };
    data.sets.unshift(set);
    this.save(data);
    return set;
  },

  toggleFavorite(data, id) {
    const song = data.songs.find(s => s.id === id);
    if (song) song.favorite = !song.favorite;
    this.save(data);
    return song;
  },

  // A play counts when a song is played through (kept as counts per day; see Play history).
  logPlay(data, song, now = Date.now()) {
    recordPlay(song, now);
    journalPlay(data, song, now);
    this.save(data);
  },

  export(data) {
    return JSON.stringify(withoutGerman(data), null, 2);
  },

  // A backup file: checked and cleaned (see docs/DATA.md), then saved.
  // Returns { data, covers, skipped } or null when the file isn't a Tabs backup.
  import(json) {
    let parsed;
    try { parsed = JSON.parse(json); } catch { return null; }
    const clean = cleanImport(parsed);
    if (!clean) return null;
    this.save(clean.data);
    return clean;
  }
};

// ---------- Recording sync (3.13.0) ----------
// A song's marks tie places on the sheet to times in its recording: [[where, seconds]], where
// "where" is how far down the sheet (0 to 1). With no marks the whole sheet crosses in the
// recording's length; each mark bends that line, and the ends stay fixed. Both directions
// interpolate between neighbours, so marks must rise together.
const num01 = v => Number.isFinite(v);
export function cleanSyncs(list, cap = 12) {
  const out = [];
  for (const m of (Array.isArray(list) ? list : []).slice(0, Math.max(40, cap))) {
    if (!Array.isArray(m) || !num01(m[0]) || !num01(m[1]) || m[0] <= 0 || m[0] >= 1 || m[1] <= 0) continue;
    out.push([Math.round(m[0] * 1e4) / 1e4, Math.round(m[1] * 10) / 10]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.filter((m, i) => i === 0 || m[1] > out[i - 1][1]).slice(0, cap);
}
const syncLine = (marks, len) => [[0, 0], ...cleanSyncs(marks, 400).filter(m => m[1] < len), [1, len]];
function along(pts, v, from, to) {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    if (v <= b[from] || i === pts.length - 1) {
      const span = b[from] - a[from];
      return span > 0 ? a[to] + (Math.min(Math.max(v, a[from]), b[from]) - a[from]) / span * (b[to] - a[to]) : a[to];
    }
  }
  return 0;
}
/* seconds into the recording for a place on the sheet, and back */
export const syncSeconds = (marks, where, len) => along(syncLine(marks, len), Math.min(1, Math.max(0, where)), 0, 1);
export const syncWhere = (marks, sec, len) => along(syncLine(marks, len), Math.min(len, Math.max(0, sec)), 1, 0);
/* a new mark replaces any close to it, and drops the ones that would cross it */
export function addSync(marks, where, sec, len) {
  if (!(len > 0) || where <= 0.01 || where >= 0.99 || sec <= 1 || sec >= len - 1) return cleanSyncs(marks);
  const keep = cleanSyncs(marks).filter(m => Math.abs(m[0] - where) > 0.02 && Math.abs(m[1] - sec) > 3 && (m[0] < where) === (m[1] < sec));
  return cleanSyncs([...keep, [where, sec]]);
}
/* The lines' own times (from the lyrics, 3.17.0) with your nudges on top: a nudge wins over the line
   times near it and any it would cross. */
export function mergeSyncs(auto, mine) {
  const you = cleanSyncs(mine);
  const keep = cleanSyncs(auto, 400).filter(a => you.every(m => Math.abs(m[0] - a[0]) > 0.015 && Math.abs(m[1] - a[1]) > 2 && (a[0] < m[0]) === (a[1] < m[1])));
  return cleanSyncs([...keep, ...you], 400);
}

// ---------- Line timing from synced lyrics (3.17.0) ----------
// LRCLIB's synced lyrics give each line's time in a recording. Only the times are kept: each sheet
// line that matches a timed line in order gets [line index, seconds]; the words themselves are
// compared here and dropped.
export function parseLrc(text) {
  const out = [];
  for (const row of String(text || "").split(/\r?\n/)) {
    const tags = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    /* enhanced LRC (3.22.0): <mm:ss.xx> before a word gives that word's own time */
    const wt = [...row.matchAll(/<(\d+):(\d+(?:\.\d+)?)>/g)].map(m => +m[1] * 60 + +m[2]);
    const words = row.replace(/\[[^\]]*\]/g, "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (!words) continue;
    for (const t of tags) out.push(wt.length >= 2 ? [+t[1] * 60 + +t[2], words, wt] : [+t[1] * 60 + +t[2], words]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
/* When each word of a line starts (3.22.0): the line's own word times when the lyrics have them,
   otherwise the line's time shared out by syllables (the singing fills about 85% of the gap to the
   next line). With a tempo, each time lands on the nearest beat counted from the line's start, since
   chords change on the beat. */
export function wordTimes(words, start, end, { bpm = 0, given = null } = {}) {
  const n = words.length;
  if (!n) return [];
  let t;
  if (given?.length >= 2) t = words.map((_, k) => given[Math.min(given.length - 1, Math.round(k * (given.length - 1) / Math.max(1, n - 1)))]);
  else {
    const syl = words.map(w => Math.max(1, syllables(w))), all = syl.reduce((a, b) => a + b, 0), span = Math.max(0.5, (end - start) * 0.85);
    let acc = 0;
    t = syl.map(x => { const at = start + acc / all * span; acc += x; return at; });
  }
  if (bpm > 0) {
    const spb = 60 / bpm;
    t = t.map(x => Math.round((start + Math.round((x - start) / spb) * spb) * 100) / 100);
  }
  return t;
}
const lrcWords = t => String(t || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
function lineLike(a, b) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  let hit = 0;
  for (const w of new Set(a)) if (B.has(w)) hit++;
  return 2 * hit / (new Set(a).size + B.size);
}
/* sheet: [{ i, text }] in order; timed: [[seconds, text]]. The best in-order pairing (repeated
   choruses land on their own repeats), keeping pairs that share most of their words. */
export function matchLines(sheet, timed, min = 0.5) {
  const A = sheet.map(x => lrcWords(x.text)), B = timed.map(x => lrcWords(x[1]));
  const n = A.length, m = B.length;
  if (!n || !m) return [];
  const S = A.map(a => B.map(b => lineLike(a, b)));
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const s = S[i - 1][j - 1];
    D[i][j] = Math.max(D[i - 1][j], D[i][j - 1], s >= min ? D[i - 1][j - 1] + s : -1);
  }
  const out = [];
  for (let i = n, j = m; i > 0 && j > 0;) {
    const s = S[i - 1][j - 1];
    if (s >= min && D[i][j] === D[i - 1][j - 1] + s) { out.push([sheet[i - 1].i, Math.round(timed[j - 1][0] * 10) / 10, j - 1]); i--; j--; }
    else if (D[i][j] === D[i - 1][j]) i--;
    else j--;
  }
  return out.reverse();
}
/* A short fingerprint of a sheet's words, so line times are looked up again after an edit. */
export function bodyKey(body) {
  let h = 5381;
  for (const ch of String(body || "")) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}
export function cleanTimed(t) {
  if (!isObj(t) || typeof t.h !== "string") return null;
  const out = { h: t.h.slice(0, 16) };
  if (t.none) { out.none = 1; return out; }
  if (Number.isInteger(t.id)) out.id = t.id;
  const at = [];
  for (const x of (Array.isArray(t.at) ? t.at : []).slice(0, 400)) {
    if (!Array.isArray(x) || !Number.isInteger(x[0]) || x[0] < 0 || !Number.isFinite(x[1]) || x[1] <= 0) continue;
    if (at.length && (x[0] <= at[at.length - 1][0] || x[1] <= at[at.length - 1][1])) continue;
    at.push([x[0], Math.round(x[1] * 10) / 10]);
  }
  if (!at.length) return null;
  out.at = at;
  /* word times for lines whose lyrics carry them: { "line": [seconds, ...] } */
  if (isObj(t.w)) {
    const w = {};
    for (const [k, v] of Object.entries(t.w).slice(0, 400)) {
      if (!/^\d{1,4}$/.test(k) || !Array.isArray(v)) continue;
      const ok = v.slice(0, 40).filter(Number.isFinite).map(x => Math.round(x * 100) / 100);
      if (ok.length >= 2 && ok.every((x, i) => !i || x >= ok[i - 1])) w[k] = ok;
    }
    if (Object.keys(w).length) out.w = w;
  }
  return out;
}

// ---------- Listening to the recording's preview (3.18.0) ----------
// Apple's 30-second preview isn't copy protected, so it can be measured: the tempo (how often the
// music's attacks repeat), the swing (where the off-beat eighth lands) and the key (which notes ring
// most). feelOf(samples, rate) -> { bpm, swing, key, sure } or null.
function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/* MAJOR_PROFILE and MINOR_PROFILE (Krumhansl) are defined with the key finder further down */
const PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
function pearson(a, b) {
  const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da && db ? n / Math.sqrt(da * db) : 0;
}
/* the key that best fits twelve note strengths: { key: "E" | "F#m", fit } */
export function keyOfChroma(ch) {
  let best = { key: "", fit: -2 };
  for (let k = 0; k < 12; k++) {
    const rot = Array.from({ length: 12 }, (_, i) => ch[(i + k) % 12]);
    const ma = pearson(rot, MAJOR_PROFILE), mi = pearson(rot, MINOR_PROFILE);
    if (ma > best.fit) best = { key: PC_NAMES[k], fit: ma };
    if (mi > best.fit) best = { key: PC_NAMES[k] + "m", fit: mi };
  }
  return best;
}
export function feelOf(samples, rate) {
  const step = Math.max(1, Math.round(rate / 11025)), sr = rate / step;
  const n = Math.floor(samples.length / step);
  if (n < sr * 6) return null;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < step; k++) v += samples[i * step + k] || 0; x[i] = v / step; }
  const N = 2048, hop = 256, bins = N / 2, win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const pcOf = new Int8Array(bins).fill(-1);
  for (let b = 1; b < bins; b++) { const f = b * sr / N; if (f >= 60 && f <= 2000) pcOf[b] = ((Math.round(12 * Math.log2(f / 261.6256)) % 12) + 12) % 12; }
  const chroma = new Array(12).fill(0), flux = [];
  let prev = null;
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let at = 0; at + N <= n; at += hop) {
    for (let i = 0; i < N; i++) { re[i] = x[at + i] * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    const mag = new Float32Array(bins);
    let f = 0;
    for (let b = 1; b < bins; b++) {
      mag[b] = Math.log1p(1000 * Math.hypot(re[b], im[b]));
      if (prev) f += Math.max(0, mag[b] - prev[b]);
      if (pcOf[b] >= 0) chroma[pcOf[b]] += Math.hypot(re[b], im[b]);
    }
    if (prev) flux.push(f);
    prev = mag;
  }
  /* tempo: the onset curve's strongest repeat between 60 and 180 BPM, leaning toward 110 */
  const fr = sr / hop, mean = flux.reduce((a, b) => a + b, 0) / flux.length;
  const on = flux.map(v => Math.max(0, v - mean));
  const ac = lag => { let s = 0; for (let i = lag; i < on.length; i++) s += on[i] * on[i - lag]; return s / (on.length - lag); };
  const zero = ac(0) || 1;
  let best = { lag: 0, score: 0, raw: 0 };
  for (let lag = Math.floor(fr * 60 / 180); lag <= Math.ceil(fr * 60 / 60); lag++) {
    const raw = ac(lag), bpm = 60 * fr / lag, prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.9) ** 2);
    if (raw * prior > best.score) best = { lag, score: raw * prior, raw };
  }
  if (!best.lag) return null;
  const a = ac(best.lag - 1), b = ac(best.lag), c = ac(best.lag + 1), d = a - 2 * b + c;
  const lag = best.lag + (d < 0 ? 0.5 * (a - c) / d : 0);
  const bpm = Math.round(60 * fr / lag);
  /* swing: fold the onsets onto one beat; the downbeat is the strongest spot, and the off-beat
     eighth is the strongest spot in the middle stretch of the beat */
  const B = 24, fold = new Array(B).fill(0);
  on.forEach((v, i) => { fold[Math.floor(((i % lag) / lag) * B) % B] += v; });
  const down = fold.indexOf(Math.max(...fold));
  let off = 0, offV = -1;
  for (let k = Math.round(B * 0.4); k <= Math.round(B * 0.75); k++) { const v = fold[(down + k) % B]; if (v > offV) { offV = v; off = k; } }
  const r = off / B, swing = r < 0.56 ? "straight" : r < 0.635 ? "light" : "full";
  const k = keyOfChroma(chroma);
  return { bpm, swing, key: k.key, sure: Math.round(Math.max(0, Math.min(1, best.raw / zero)) * 100) / 100, keySure: Math.round(k.fit * 100) / 100 };
}
/* "F#m" -> { pc: 6, minor: true } */
export function keyParts(key) {
  const m = String(key || "").match(/^([A-G])([#b]?)(m?)$/);
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  return { pc: (base + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12, minor: !!m[3] };
}
/* How many semitones the sheet's sounding key is from the recording's: 0 when they match (a key and its
   relative major or minor count as a match), else the shortest move, -5 to +6. null when unknown. */
export function keyGap(sheetKey, recKey) {
  const s = keyParts(sheetKey), r = keyParts(recKey);
  if (!s || !r) return null;
  const tonic = k => k.minor ? (k.pc + 3) % 12 : k.pc; /* compare as the major of the same notes */
  let d = ((tonic(r) - tonic(s)) % 12 + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}
export function cleanFeel(f) {
  if (!isObj(f)) return null;
  const out = {};
  if (Number.isFinite(f.bpm) && f.bpm >= 40 && f.bpm <= 240) out.bpm = Math.round(f.bpm);
  if (["straight", "light", "full"].includes(f.swing)) out.swing = f.swing;
  if (keyParts(f.key)) out.key = f.key;
  for (const k of ["sure", "keySure"]) if (Number.isFinite(f[k])) out[k] = Math.round(Math.max(-1, Math.min(1, f[k])) * 100) / 100;
  if (f.none) out.none = 1;
  return Object.keys(out).length ? out : null;
}

// ---------- Checking a backup before it replaces the library ----------
// Files can be hand-edited or come from somewhere else, so every field the app
// relies on is checked: wrong types are dropped (the app falls back to its
// defaults), songs without words or an id are skipped, and only https links and
// image data survive. Unknown fields are kept for newer versions of the app.
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const SONG_TYPES = {
  title: "string", artist: "string", key: "string", body: "string", format: "string", tuning: "string", backing: "string", recRate: "number", practice: "object", drums: "object", created: "string", gotAt: "string",
  transpose: "number", size: "number", speed: "number", duration: "number", recLength: "number", bpm: "number",
  favorite: "boolean", capoOff: "boolean", easier: "object", groove: "object", loop: "object", listen: "object", playLog: "object", tone: "object", syncs: "array", timed: "object"
};
const fit = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function cleanSong(raw) {
  if (!isObj(raw)) return null;
  const s = { ...raw };
  if (typeof s.id === "number") s.id = String(s.id);
  if (typeof s.id !== "string" || !s.id) return null;
  if (s.body === undefined && typeof s.tab === "string") { s.body = s.tab; delete s.tab; }
  for (const [k, type] of Object.entries(SONG_TYPES)) {
    if (s[k] === undefined) continue;
    const ok = type === "array" ? Array.isArray(s[k]) : type === "object" ? isObj(s[k]) : typeof s[k] === type && (type !== "number" || Number.isFinite(s[k]));
    if (!ok) delete s[k];
  }
  if (typeof s.body !== "string") return null;
  if (!s.title?.trim()) s.title = "Untitled";
  if (s.format !== "chords" && s.format !== "tab") delete s.format;
  if (s.tuning && !TUNINGS[s.tuning]) delete s.tuning;
  if (s.backing !== undefined && s.backing !== "band") delete s.backing;
  /* Practice mode (3.21.0): { on?, rate? }. The recording's own speed (3.14.0) became the practice speed. */
  if (s.recRate !== undefined) { if (!(s.practice?.rate > 0)) s.practice = { ...(s.practice || {}), rate: s.recRate }; delete s.recRate; }
  if (s.practice) {
    const pr = {};
    if (typeof s.practice.on === "boolean") pr.on = s.practice.on;
    if (Number.isFinite(s.practice.rate) && s.practice.rate < 1) pr.rate = Math.round(fit(s.practice.rate, 0.5, 1) * 100) / 100;
    if (Object.keys(pr).length) s.practice = pr; else delete s.practice;
  }
  if (s.syncs) { s.syncs = cleanSyncs(s.syncs); if (!s.syncs.length) delete s.syncs; }
  if (s.timed) { s.timed = cleanTimed(s.timed); if (!s.timed) delete s.timed; }
  if (s.drums) { s.drums = cleanDrums(s.drums); if (!s.drums) delete s.drums; }
  if (s.transpose !== undefined) s.transpose = fit(Math.round(s.transpose), -5, 6);
  if (s.size !== undefined) s.size = fit(s.size, 0.6, 1.6);
  if (s.duration !== undefined) s.duration = fit(s.duration, 10, 3600);
  if (s.speed !== undefined) s.speed = fit(s.speed, 1, 200);
  if (s.bpm !== undefined) s.bpm = fit(Math.round(s.bpm), 30, 260);
  if (s.listen) {
    if (!/^https:\/\//.test(s.listen.url || "")) delete s.listen;
    else if (s.listen.art !== undefined && !/^https:\/\//.test(String(s.listen.art))) { s.listen = { ...s.listen }; delete s.listen.art; }
    if (s.listen) {
      const l = s.listen = { ...s.listen };
      if (typeof l.genre !== "string") delete l.genre; else l.genre = l.genre.slice(0, 40);
      if (typeof l.composer !== "string") delete l.composer; else l.composer = l.composer.slice(0, 80);
      if (!Number.isInteger(l.year) || l.year < 1900 || l.year > 2100) delete l.year;
      if (!/^[0-9a-f]{6}$/i.test(String(l.tint || ""))) delete l.tint;
      if (l.feel !== undefined) { const f = cleanFeel(l.feel); if (f) l.feel = f; else delete l.feel; }
    }
  }
  if (s.art !== undefined && !/^https:\/\//.test(String(s.art))) delete s.art; /* album art for set covers: https only */
  if (s.loop && !(Number.isInteger(s.loop.a) && Number.isInteger(s.loop.b))) delete s.loop;
  if (s.groove) s.groove = cleanGroove(s.groove);
  return s;
}
export function cleanSet(raw) {
  if (!isObj(raw)) return null;
  const x = { ...raw };
  if (typeof x.id === "number") x.id = String(x.id);
  if (typeof x.id !== "string" || !x.id) return null;
  if (typeof x.name !== "string" || !x.name.trim()) x.name = "Set";
  x.songIds = (Array.isArray(x.songIds) ? x.songIds : []).map(id => typeof id === "number" ? String(id) : id).filter(id => typeof id === "string");
  if (x.cover !== undefined && !(isObj(x.cover) && ["songs", "art", "photo"].includes(x.cover.type))) delete x.cover;
  return x;
}
const COVER_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const COVER_MAX = 4e6; // characters, about 3 MB of photo
export function cleanImport(parsed) {
  if (!isObj(parsed) || !Array.isArray(parsed.songs)) return null;
  let skipped = 0;
  const seen = new Set();
  const once = (item, clean) => {
    const c = clean(item);
    if (!c || seen.has(c.id)) { skipped++; return null; }
    seen.add(c.id);
    return c;
  };
  const songs = parsed.songs.map(x => once(x, cleanSong)).filter(Boolean);
  seen.clear();
  const sets = (Array.isArray(parsed.sets) ? parsed.sets : []).map(x => once(x, cleanSet)).filter(Boolean);
  const trash = (Array.isArray(parsed.trash) ? parsed.trash : []).map(t => {
    if (!isObj(t) || !["song", "set"].includes(t.type)) return null;
    const item = t.type === "song" ? cleanSong(t.item) : cleanSet(t.item);
    return item ? { ...t, item } : null;
  }).filter(Boolean);
  const settings = {};
  for (const [k, v] of Object.entries(isObj(parsed.settings) ? parsed.settings : {})) {
    const d = DEFAULT_SETTINGS[k];
    if (d === undefined || d === null || typeof d === typeof v) settings[k] = v;
  }
  if (!["auto", "dark", "light", "green"].includes(settings.theme)) delete settings.theme;
  const data = migrate({ songs, sets, trash, settings, ...(isObj(parsed.journal) && parsed.journal.v === 1 ? { journal: parsed.journal } : {}), ...(cleanKept(parsed.kept) ? { kept: cleanKept(parsed.kept) } : {}), ...(cleanTour(parsed.tour) ? { tour: cleanTour(parsed.tour) } : {}), ...(cleanSkills(parsed.skills) ? { skills: cleanSkills(parsed.skills) } : {}) });
  const setIds = new Set(data.sets.map(x => x.id));
  const covers = {};
  for (const [id, url] of Object.entries(isObj(parsed.covers) ? parsed.covers : {})) {
    if (setIds.has(id) && typeof url === "string" && url.length <= COVER_MAX && COVER_RE.test(url)) covers[id] = url;
  }
  return { data, covers, skipped };
}

// ---------- Play history ----------
// { total, last, days: { "2026-10-13": 2, ... } }, keeping the last 60 days of counts.
// (Older saves had plays: [timestamps]; the helpers read both.)
const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const KEEP_DAYS = 60;
function pruneDays(days, now) {
  const cut = dayKey(now - KEEP_DAYS * DAY);
  for (const k of Object.keys(days)) if (k < cut) delete days[k];
  return days;
}
export function compactPlays(plays, log = { total: 0, last: 0, days: {} }, now = Date.now()) {
  const out = { total: log.total || 0, last: log.last || 0, days: { ...(log.days || {}) } };
  for (const t of plays) { if (typeof t !== "number") continue; out.total++; out.last = Math.max(out.last, t); const k = dayKey(t); out.days[k] = (out.days[k] || 0) + 1; }
  pruneDays(out.days, now);
  return out;
}
export function recordPlay(song, now = Date.now()) {
  const log = Array.isArray(song.plays) ? compactPlays(song.plays, song.playLog, now) : { total: 0, last: 0, days: {}, ...(song.playLog || {}) };
  delete song.plays;
  log.days = { ...log.days };
  log.total++; log.last = now;
  const k = dayKey(now); log.days[k] = (log.days[k] || 0) + 1;
  pruneDays(log.days, now);
  song.playLog = log;
}
export const playCount = song => song.playLog?.total ?? (song.plays || []).length;
// Plays in the last 7 days (today and the 6 days before).
export function playsThisWeek(song, now = Date.now()) {
  if (Array.isArray(song.plays)) return song.plays.filter(t => t > now - 7 * DAY).length;
  const from = dayKey(now - 6 * DAY);
  return Object.entries(song.playLog?.days || {}).reduce((n, [k, c]) => n + (k >= from ? c : 0), 0);
}

// ---------- Strum it: chords from played notes ----------
// Notes come from Basic Pitch ({ midi, start, dur, amp }), many at once. A strum
// is a burst of note starts; between strums, the notes still sounding are
// weighed by pitch class (louder and longer count more, the lowest note a
// little extra as the bass) and matched to chord shapes. Repeats merge.
const STRUM_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const SHAPES = [["", [0, 4, 7], 0], ["m", [0, 3, 7], 0], ["7", [0, 4, 7, 10], 0.06], ["m7", [0, 3, 7, 10], 0.06], ["maj7", [0, 4, 7, 11], 0.08], ["sus4", [0, 5, 7], 0.08], ["sus2", [0, 2, 7], 0.08], ["5", [0, 7], 0.12]];
export function nameChord(w, bass = -1) {
  const total = w.reduce((a, b) => a + b, 0);
  if (!total) return null;
  let best = null, second = -Infinity;
  for (let r = 0; r < 12; r++) for (const [suf, iv, cost] of SHAPES) {
    const tones = iv.map(i => (r + i) % 12);
    /* A 7th, sus or added note has to be clearly there, not a ring-over. */
    if (iv.length > 3 && w[tones[3]] < total * 0.1) continue;
    let inside = 0;
    tones.forEach(t => { inside += w[t]; });
    const missing = tones.filter(t => w[t] < total * 0.04).length;
    const score = (inside - (total - inside) * 1.2) / total - missing * 0.35 - cost + (bass === r ? 0.12 : 0);
    if (!best || score > best.score) { if (best) second = Math.max(second, best.score); best = { chord: STRUM_NAMES[r] + suf, root: r, score }; }
    else second = Math.max(second, score);
  }
  return best && { chord: best.chord, root: best.root, sure: Math.max(0, Math.min(1, (best.score - second) * 4 + best.score * 0.5)) };
}
// What the model hears beyond the played notes: overtones (an octave, a 12th,
// two octaves... above a louder note starting with it), quiet ghosts, and
// pitches off the guitar's range. Repeated starts of one held note join up.
const OVERTONES = [12, 19, 24, 28, 31];
export function cleanNotes(notes, { rel = 0.3 } = {}) {
  const ns = (notes || []).filter(n => n.midi >= 40 && n.midi <= 88 && n.dur > 0.04);
  const top = Math.max(0, ...ns.map(n => n.amp || 0));
  return ns.filter(n => (n.amp || 0) >= top * rel && !ns.some(o => o !== n && OVERTONES.includes(n.midi - o.midi) && Math.abs(o.start - n.start) < 0.08 && (o.amp || 0) > (n.amp || 0)));
}
export function strumChords(notes, { hop = 0.25, min = 0.45 } = {}) {
  /* The model hears a held note as many short ones, so strums can't be found
     from note starts. Instead: name the chord in each quarter second from
     everything sounding in it (the strings mute at a change), then fold runs
     shorter than min into the chord before them (or after, at the start). */
  const ns = cleanNotes(notes);
  if (!ns.length) return [];
  const t0 = Math.min(...ns.map(n => n.start)), t1 = Math.max(...ns.map(n => n.start + n.dur));
  const runs = [];
  for (let a = t0; a < t1; a += hop) {
    const b = a + hop, w = new Array(12).fill(0);
    let bass = 999, sounding = 0;
    for (const n of ns) {
      const lap = Math.min(b, n.start + n.dur) - Math.max(a, n.start);
      if (lap <= 0) continue;
      w[n.midi % 12] += (n.amp || 0.5) * lap; sounding += lap;
      bass = Math.min(bass, n.midi);
    }
    if (sounding < hop * 0.5) continue;   /* a gap: little or nothing ringing */
    const c = nameChord(w, bass < 999 ? bass % 12 : -1);
    if (!c) continue;
    const p = runs[runs.length - 1];
    if (p && p.chord === c.chord && a - (p.at + p.dur) < hop * 1.5) { p.dur = b - p.at; p.sure = Math.max(p.sure, c.sure); }
    else runs.push({ chord: c.chord, at: a, dur: hop, sure: c.sure });
  }
  /* A chord left to ring loses its quieter strings first, until only the root
     and fifth are heard: a "5" reading among real chords is that tail (or a
     half-heard strum), not a power chord. Played alone, power chords stay. */
  const fades = runs.some(r => !/5$/.test(r.chord));
  const isFade = r => fades && /5$/.test(r.chord);
  for (let i = runs.findIndex(isFade); i >= 0 && runs.length > 1; i = runs.findIndex(isFade)) {
    const r = runs[i], into = i > 0 ? runs[i - 1] : runs[1];
    if (i > 0) into.dur = r.at + r.dur - into.at; else { into.dur = into.at + into.dur - r.at; into.at = r.at; }
    runs.splice(i, 1);
  }
  for (let j = runs.length - 1; j > 0; j--) if (runs[j].chord === runs[j - 1].chord) { runs[j - 1].dur = runs[j].at + runs[j].dur - runs[j - 1].at; runs.splice(j, 1); }
  for (let i = runs.findIndex(r => r.dur < min); i >= 0 && runs.length > 1; i = runs.findIndex(r => r.dur < min)) {
    const r = runs[i], into = i > 0 ? runs[i - 1] : runs[1];
    if (i > 0) into.dur = r.at + r.dur - into.at; else { into.dur = into.at + into.dur - r.at; into.at = r.at; }
    runs.splice(i, 1);
    for (let j = runs.length - 1; j > 0; j--) if (runs[j].chord === runs[j - 1].chord) { runs[j - 1].dur = runs[j].at + runs[j].dur - runs[j - 1].at; runs.splice(j, 1); }
  }
  return runs.map(r => ({ chord: r.chord, at: +r.at.toFixed(2), dur: +r.dur.toFixed(2), sure: +r.sure.toFixed(2) }));
}
// Played chords as notes (their tones, for their time), so the key and the
// chord places can be worked out as they are for a sung melody.
export function chordToneNotes(chords) {
  const out = [];
  for (const c of chords || []) {
    const m = /^([A-G][#b]?)(.*)$/.exec(c.chord || "");
    if (!m) continue;
    const root = STRUM_NAMES.indexOf(m[1]) >= 0 ? STRUM_NAMES.indexOf(m[1]) : { Db: 1, "D#": 3, Gb: 6, "G#": 8, "A#": 10 }[m[1]];
    const shape = SHAPES.find(x => x[0] === m[2]) || SHAPES[m[2].startsWith("m") ? 1 : 0];
    shape[1].forEach(iv => out.push({ midi: 60 + ((root + iv) % 12), start: c.at, dur: Math.max(0.2, c.dur || 1) }));
  }
  return out.sort((a, b) => a.start - b.start);
}
// Single notes of a riff (no strum): the notes in order, as names with octave.
// A note started again right where it was still sounding is the same note.
export function riffNotes(notes) {
  const out = [];
  for (const n of cleanNotes(notes, { rel: 0.45 }).sort((a, b) => a.start - b.start)) {
    const p = out[out.length - 1];
    if (p && p.midi === n.midi && n.start - (p.at + p.dur) < 0.06) { p.dur = n.start + n.dur - p.at; continue; }
    if (p && n.start - p.at < 0.07) { if ((n.amp || 0) > p.amp) Object.assign(p, { midi: n.midi, amp: n.amp || 0 }); continue; }
    out.push({ midi: n.midi, at: n.start, dur: n.dur, amp: n.amp || 0 });
  }
  return out.map(n => ({ midi: n.midi, name: STRUM_NAMES[n.midi % 12] + (Math.floor(n.midi / 12) - 1), at: n.at, dur: n.dur }));
}

// ---------- German practice ----------
// A song's sung lines, translated once (german.js, with your Anthropic key) and
// kept with the song as song.de: per line the whole line in German ("de") and
// swaps ("s") that replace English words in place, each at a level: 1 Basic
// (very common nouns), 2 Common (everyday nouns, adjectives), 3 Intermediate
// (phrases, verbs, real grammar). Level 4 (Fluent) sings the whole line.
// Translations never travel: SHARE_FIELDS leaves them out, and so do backups.
export const DE_LEVELS = ["Off", "Basic", "Common", "Intermediate", "Fluent"];
const deWords = w => w.parts.map(p => p.text).join("");
// The sung lines, in order, as the AI sees them (words split by spaces).
export function sungText(blocks) {
  const out = [];
  (blocks || []).forEach((b, bi) => {
    const tokens = b.kind === "pair" ? b.words.filter(w => !w.space).map(deWords).filter(t => t.trim()) : b.kind === "lyric" ? String(b.text).trim().split(/\s+/).filter(Boolean) : [];
    if (tokens.length) out.push({ bi, tokens, text: tokens.join(" ") });
  });
  return out;
}
export function deSource(lines) {
  let h = 2166136261;
  for (const c of lines.map(l => l.text).join("\n")) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
// The AI's reply, checked: swaps inside the line, levels 1-3, short strings.
export function cleanGerman(j, lines) {
  const str = (v, n = 120) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
  const byI = new Map((Array.isArray(j?.lines) ? j.lines : []).map(l => [+l?.i, l]));
  return lines.map((ln, i) => {
    const l = byI.get(i) || {};
    const s = (Array.isArray(l.s) ? l.s : []).map(x => ({
      w: Math.floor(+x?.w), n: Math.max(1, Math.floor(+x?.n || 1)), l: Math.floor(+x?.l), de: str(x?.de, 80).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
      g: ["der", "die", "das"].includes(x?.g) ? x.g : "", lemma: str(x?.lemma, 60), en: str(x?.en, 60), pl: str(x?.pl, 60), built: str(x?.built, 120), note: str(x?.note, 200)
    })).filter(x => x.de && x.w >= 0 && x.l >= 1 && x.l <= 3 && x.w + x.n <= ln.tokens.length);
    return { de: str(l.de, 300), s };
  });
}
// Which swaps show at a level: Intermediate phrases first (longest first),
// then the single words of the lower levels where nothing covers them yet.
export function deSpans(swaps, level) {
  const chosen = [], free = (w, n) => !chosen.some(c => w < c.w + c.n && c.w < w + n);
  const pick = list => list.forEach(x => { if (free(x.w, x.n)) chosen.push(x); });
  if (level >= 3) pick(swaps.filter(x => x.l === 3).sort((a, b) => b.n - a.n));
  /* Common is a small step up from Basic: at most two more words a
     line, nouns before adjectives and adverbs, single words before pairs.
     Intermediate takes them all. */
  const common = swaps.filter(x => x.l === 2).sort((a, b) => (!!b.g - !!a.g) || a.n - b.n || a.w - b.w);
  pick(swaps.filter(x => x.l === 1));
  if (level >= 3) pick(common);
  else if (level === 2) common.forEach(x => { if (chosen.filter(c => c.l === 2).length < 2 && free(x.w, x.n)) chosen.push(x); });
  return chosen.sort((a, b) => a.w - b.w);
}
const edge = t => { const m = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u.exec(t); return { lead: m[1], trail: m[3] }; };
// The song's display blocks with German put in at a level. Chords stay on
// their word (a swap keeps the first word's chords; the words it covers keep
// theirs, without text). Fluent spreads the German line under the chords by
// position. Each German part carries { k: "line.swap", g } for its card.
export function germanBlocks(blocks, de, level, { english = false } = {}) {
  if (!de?.lines || !level) return blocks;
  const lines = sungText(blocks), at = new Map(lines.map((l, i) => [l.bi, i]));
  return blocks.map((b, bi) => {
    const i = at.get(bi), t = i == null ? null : de.lines[i];
    if (!t) return b;
    const en = english ? lines[i].text : "";
    if (level >= 4 && t.de) return fluentBlock(b, t.de, i, en);
    const spans = deSpans(t.s || [], level);
    if (!spans.length) return b;
    if (b.kind === "lyric") {
      const tok = lines[i].tokens, segs = [];
      for (let w = 0; w < tok.length; w++) {
        const sp = spans.find(x => x.w === w);
        if (sp) { const a = edge(tok[w]), z = edge(tok[w + sp.n - 1]); segs.push({ text: a.lead + sp.de + z.trail, de: { k: `${i}.${t.s.indexOf(sp)}`, g: sp.g } }); w += sp.n - 1; }
        else segs.push({ text: tok[w] });
      }
      return { ...b, segs, en };
    }
    let wi = -1;
    const out = [];
    const words = b.words;
    for (let k = 0; k < words.length; k++) {
      const w = words[k];
      if (w.space) { out.push(w); continue; }
      if (!deWords(w).trim()) { out.push(w); continue; }
      wi++;
      const sp = spans.find(x => x.w === wi), inside = spans.find(x => wi > x.w && wi < x.w + x.n);
      if (sp) {
        const lastTok = lines[i].tokens[sp.w + sp.n - 1], a = edge(deWords(w)), z = edge(lastTok);
        out.push({ parts: w.parts.map((p, pi) => pi === 0 ? { ...p, text: a.lead + sp.de + z.trail, de: { k: `${i}.${t.s.indexOf(sp)}`, g: sp.g } } : { ...p, text: "" }) });
      } else if (inside) {
        const chords = w.parts.filter(p => p.chord).map(p => ({ ...p, text: "" }));
        if (out.length && out[out.length - 1].space) out.pop();   /* no gap inside a phrase */
        if (chords.length) { out.push({ space: true }); out.push({ parts: chords }); }
      } else out.push(w);
    }
    return { ...b, words: out, en };
  });
}
function fluentBlock(b, line, i, en) {
  const dw = line.split(/\s+/).filter(Boolean);
  if (b.kind === "lyric") return { ...b, segs: [{ text: line, de: { k: `${i}.f`, g: "" } }], en };
  const real = b.words.filter(w => !w.space && deWords(w).trim());
  const enN = Math.max(1, real.length), chordsAt = new Map();
  real.forEach((w, j) => w.parts.forEach(p => { if (p.chord) { const k = Math.min(dw.length - 1, Math.round(j * dw.length / enN)); (chordsAt.get(k) || chordsAt.set(k, []).get(k)).push(p); } }));
  /* Chords in the line that sit on no word (a chord row inside the pair) ride along at the end. */
  const loose = b.words.filter(w => !w.space && !deWords(w).trim()).flatMap(w => w.parts.filter(p => p.chord));
  const words = [];
  dw.forEach((d, k) => {
    if (k) words.push({ space: true });
    const cs = chordsAt.get(k) || [];
    words.push({ parts: cs.length ? [...cs.slice(0, -1).map(p => ({ ...p, text: "" })), { ...cs[cs.length - 1], text: d, de: { k: `${i}.f`, g: "" } }] : [{ text: d, de: { k: `${i}.f`, g: "" } }] });
  });
  if (loose.length) { words.push({ space: true }); words.push({ parts: loose.map(p => ({ ...p, text: "" })) }); }
  return { ...b, words, en };
}
// Without the translations: what a backup file holds.
export const withoutGerman = data => ({ ...data, songs: (data.songs || []).map(s => { if (!s.de) return s; const { de: _de, ...rest } = s; return rest; }) });

// ---------- Today: practice streak and a nudge ----------
// A day counts when any song was played to its end (the play log). The streak
// runs back from today, or from yesterday while today has no play yet.
const playDays = songs => {
  const set = new Set();
  for (const s of songs || []) {
    if (Array.isArray(s.plays)) s.plays.forEach(t => typeof t === "number" && set.add(dayKey(t)));
    Object.entries(s.playLog?.days || {}).forEach(([k, n]) => n > 0 && set.add(k));
  }
  return set;
};
export function streakOf(songs, now = Date.now()) {
  const days = playDays(songs);
  const at = i => dayKey(now - i * DAY);
  const today = days.has(at(0));
  let n = 0;
  for (let i = today ? 0 : 1; days.has(at(i)); i++) n++;
  return { days: n, today, week: Array.from({ length: 7 }, (_, i) => days.has(at(6 - i))) };
}
// Daily weather to the few moods the nudge knows (WMO weather codes).
export function weatherMood(code, tmax) {
  code = +code; tmax = +tmax;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86 || (!isNaN(tmax) && tmax <= 4)) return "cold";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return "rain";
  if (!isNaN(tmax) && tmax >= 32) return "hot";
  if (code <= 1 && tmax >= 15) return "clear";
  return "";
}
// One suggestion for today, or null. Nothing on a gig day (Up next has it) or
// once you've played today. In the evening a streak worth keeping comes first;
// then the weather; then a change you barely play; then a learning
// song or a favorite left too long. Picks are
// steady through the day (the same song each time you look).
export function pickNudge({ songs = [], now = Date.now(), mood = "", gigToday = false } = {}) {
  if (gigToday || !songs.length) return null;
  const st = streakOf(songs, now);
  if (st.today) return null;
  const d = new Date(now), day = dayKey(now);
  const seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pick = list => list.length ? list[seed % list.length] : null;
  const last = s => lastPlayed(s) || 0;
  const idle = (s, days) => now - last(s) > days * DAY;
  const out = (kind, text, s) => s ? { kind, text, songId: s.id, title: s.title } : null;
  const byPlays = (a, b) => playsThisWeek(b, now) - playsThisWeek(a, now) || last(b) - last(a);
  if (d.getHours() >= 18 && st.days >= 2) {
    const s = [...songs].filter(x => last(x)).sort(byPlays)[0];
    const r = out("streak", `One song keeps your ${st.days}-day streak`, s);
    if (r) return r;
  }
  if (mood === "rain") {
    const slow = songs.filter(s => idle(s, 14)).sort((a, b) => (a.bpm || 999) - (b.bpm || 999));
    const r = out("rain", "Rainy day, perfect for a slow song", slow[0] && (slow[0].bpm ? slow[0] : pick(slow)));
    if (r) return r;
  }
  if (mood === "cold") {
    const fav = [...songs].sort((a, b) => playCount(b) - playCount(a))[0];
    const r = out("cold", "Cold out. Warm up your hands with an old favorite", playCount(fav) ? fav : null);
    if (r) return r;
  }
  if (mood === "clear" && (d.getDay() === 0 || d.getDay() === 6)) {
    const r = out("clear", "Nice out. Take one to the porch", pick(songs.filter(s => s.favorite)) || pick(songs.filter(s => playCount(s))));
    if (r) return r;
  }
  if (mood === "hot") {
    const r = out("hot", "Too hot to go out. Good day to learn something new", pick(songs.filter(s => s.status === "learning")));
    if (r) return r;
  }
  // A change your songs have that you've barely played this week.
  const ch = changesOf(songs, now);
  const w = ch.played && ch.work.find(c => c.best.n >= 2);
  if (w) {
    const r = out("change", `Work on ${w.a} to ${w.b}. This one has it ${w.best.n} times`, songs.find(s => s.id === w.best.id));
    if (r) return r;
  }
  const learn = pick(songs.filter(s => s.status === "learning" && idle(s, 3)));
  if (learn) return out("learn", "Keep at it, still on your learning list", learn);
  return out("idle", "It's been a while", pick(songs.filter(s => s.favorite && last(s) && idle(s, 21))));
}

// ---------- Chords ----------

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11
};
// Keys conventionally written with flats (majors, then relative minors).
const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm"]);

const CHORD_RE =
  /^([A-G][#b]?)((?:maj|min|m|M|dim|aug|sus|add|°|ø|\+|-)?(?:\d{1,2})?(?:(?:sus|add|maj|b|#|\+|-)?\d{1,2}|sus)*(?:\([^)\s]*\))?)(?:\/([A-G][#b]?))?$/;

// Tokens that may sit on a chord line without making it a lyric line.
const FILLER_RE = /^(\||\|\||[x×]\d+|\d+[x×]|N\.?C\.?|\(|\)|[-–—]+|\/|%|\.+)$/i;

export function isChord(token) {
  return CHORD_RE.test(token);
}

export function isChordLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return false;
  let chords = 0;
  for (const t of tokens) {
    const bare = t.replace(/^\(|\)$/g, "");
    if (isChord(bare)) chords++;
    else if (!FILLER_RE.test(t) && !FILLER_RE.test(bare)) return false; /* "(x2)" counts as filler too */
  }
  return chords > 0;
}

const TAB_LINE_RE = /^\s*[A-Ga-g][#b]?\s*\|?[-0-9hpbr\/\\~x|().\s]{6,}$/;

export function looksLikeTab(text) {
  const lines = text.split("\n").filter(l => l.trim());
  if (!lines.length) return false;
  const tabLines = lines.filter(l => TAB_LINE_RE.test(l) && (l.match(/-/g) || []).length >= 6);
  return tabLines.length >= 4 && tabLines.length / lines.length > 0.4;
}

function shiftNote(note, steps, flats) {
  const i = NOTE_INDEX[note];
  if (i === undefined) return note;
  const n = (((i + steps) % 12) + 12) % 12;
  return (flats ? FLATS : SHARPS)[n];
}

export function transposeChord(chord, steps, flats = false) {
  if (!steps) return chord;
  const m = chord.match(CHORD_RE);
  if (!m) return chord;
  const [, root, quality, bass] = m;
  return shiftNote(root, steps, flats) + quality + (bass ? "/" + shiftNote(bass, steps, flats) : "");
}

// Decide sharps vs flats from where the song ends up after transposing.
export function prefersFlats(key, steps) {
  if (!key) return false;
  const m = key.match(/^([A-G][#b]?)(m|min)?/);
  if (!m) return false;
  const root = shiftNote(m[1], steps, true);
  return FLAT_KEYS.has(root + (m[2] ? "m" : ""));
}

// First chord in a sheet, used as a key guess when none is set.
export function guessKey(text) {
  for (const line of text.split("\n")) {
    const inline = line.match(/\[([^\]\s]+)\]/);
    if (inline && isChord(inline[1])) return simpleKey(inline[1]);
    if (isChordLine(line)) {
      const first = line.trim().split(/\s+/).map(t => t.replace(/^\(|\)$/g, "")).find(isChord);
      if (first) return simpleKey(first);
    }
  }
  return "";
}

function simpleKey(chord) {
  const m = chord.match(/^([A-G][#b]?)(m(?!aj))?/);
  return m ? m[1] + (m[2] ? "m" : "") : "";
}

export function transposeKey(key, steps) {
  if (!key || !steps) return key;
  const m = key.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return key;
  return shiftNote(m[1], steps, prefersFlats(key, steps)) + m[2];
}

// Rewrite a chord line, keeping each chord at its original column where possible.
function transposeChordLine(line, steps, flats) {
  let out = "";
  const re = /\S+/g;
  let m;
  while ((m = re.exec(line))) {
    const tok = m[0];
    const lead = tok.startsWith("(") ? "(" : "";
    const trail = tok.endsWith(")") && tok.length > 1 ? ")" : "";
    const bare = tok.slice(lead.length, tok.length - trail.length);
    const next = isChord(bare) ? lead + transposeChord(bare, steps, flats) + trail : tok;
    const pad = m.index - out.length;
    out += (pad > 0 ? " ".repeat(pad) : out.length ? " " : "") + next;
  }
  return out;
}

// Turn "[G]Blackbird [C]singing" into a chord line over a lyric line.
function expandInline(line) {
  let chords = "";
  let lyric = "";
  let i = 0;
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(line))) {
    lyric += line.slice(i, m.index);
    i = m.index + m[0].length;
    const col = Math.max(lyric.length, chords.length ? chords.length + 1 : 0);
    if (col > lyric.length) lyric += " ".repeat(col - lyric.length);
    chords += " ".repeat(col - chords.length) + m[1];
  }
  lyric += line.slice(i);
  return { chords, lyric };
}

// A section label, optionally with a repeat mark: "[Chorus]", "Verse 2:", "[Chorus] (x2)", "Chorus x2".
const SECTION_RE = /^\s*(?:\[([^\]]+)\]|((?:intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|instrumental|tag|refrain|coda|ending|break|hook)(?:\s*\d+)?)\s*:?)\s*(?:[(\[]?\s*[x×]\s*(\d+)\s*[)\]]?)?\s*$/i;
const secName = m => (m[1] || m[2]).trim() + (m[3] ? ` ×${m[3]}` : "");

// Read a pasted block: format, key, section count, and a title/artist header if present.
export function detectPaste(text) {
  let lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length && !lines[0].trim()) lines.shift();
  let title = "", artist = "";
  const first = (lines[0] || "").trim();
  const isHeader = first && !isChordLine(first) && !SECTION_RE.test(first) && !TAB_LINE_RE.test(first) &&
    !/\[[^\]]+\]/.test(first) && first.length <= 80;
  const next = (lines[1] || "").trim();
  if (isHeader && (!next || isChordLine(next) || SECTION_RE.test(next) || /^(artist|by)\b/i.test(next))) {
    const by = first.match(/^(.*?)\s+(?:chords|tabs?|lyrics)?\s*by\s+(.+)$/i);
    const dash = first.match(/^(.+?)\s+[-–]\s+(.+)$/);
    if (by) { title = by[1].trim(); artist = by[2].trim(); }
    else if (dash) { artist = dash[1].trim(); title = dash[2].trim(); }
    else title = first;
    lines.shift();
    const a = (lines[0] || "").trim().match(/^(?:artist:|by)\s*(.+)$/i);
    if (a) { artist = a[1].trim(); lines.shift(); }
    while (lines.length && !lines[0].trim()) lines.shift();
  }
  const body = lines.join("\n").replace(/\s+$/, "");
  const format = looksLikeTab(body) ? "tab" : "chords";
  const sections = body.split("\n").filter(l => SECTION_RE.test(l) && !isChord((l.match(/\[([^\]]+)\]/) || [])[1] || "")).length;
  return { title, artist, body, format, key: format === "chords" ? guessKey(body) : "", sections };
}

// ---------- Wrapping layout ----------

const isTabLine = l => TAB_LINE_RE.test(l) && (l.match(/-/g) || []).length >= 6;

function xposeToken(tok, steps, flats) {
  const lead = tok.startsWith("(") ? "(" : "";
  const trail = tok.endsWith(")") && tok.length > 1 ? ")" : "";
  const bare = tok.slice(lead.length, tok.length - trail.length);
  return isChord(bare) ? lead + transposeChord(bare, steps, flats) + trail : tok;
}

// Split a lyric into words, attaching each chord to the character it sits over.
// Returns items: { space: true } or { parts: [{ chord, text }] }.
// A word is never split, so a line can only wrap between words.
export function buildWords(lyric, chordsAt) {
  const positions = [...chordsAt.keys()].sort((a, b) => a - b);
  const last = positions.length ? positions[positions.length - 1] : -1;
  let text = lyric;
  if (text.length <= last) text += " ".repeat(last + 1 - text.length);
  const items = [];
  const re = /\S+|\s+/g;
  const NBSP = " ";
  let pending = ""; // chord written over the gap before a word rides on that word
  let pendingPos = -1;
  // A chord may hang past its syllable when the next chord is far enough away.
  const free = (pos, chord, from = pos) => {
    const next = positions.find(q => q > pos);
    return next === undefined || next - from > chord.length + 1;
  };
  let m;
  while ((m = re.exec(text))) {
    const s = m.index, e = s + m[0].length;
    const inside = positions.filter(p => p >= s && p < e);
    if (!m[0].trim()) {
      // Chords over a gap: all but the last stand alone; the last waits for the next word.
      if (pending) items.push({ parts: [{ chord: pending, text: NBSP }] });
      for (const p of inside.slice(0, -1)) items.push({ parts: [{ chord: chordsAt.get(p), text: NBSP }] }, { space: true });
      pending = inside.length ? chordsAt.get(inside[inside.length - 1]) : "";
      pendingPos = inside.length ? inside[inside.length - 1] : -1;
      items.push({ space: true });
      continue;
    }
    const cuts = [s, ...inside.filter(p => p > s), e];
    const parts = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const chord = chordsAt.get(cuts[i]) || "";
      parts.push({ chord, text: text.slice(cuts[i], cuts[i + 1]), free: !!chord && free(cuts[i], chord) });
    }
    if (pending) {
      if (parts[0].chord) items.push({ parts: [{ chord: pending, text: NBSP }] }, { space: true });
      else { parts[0].chord = pending; parts[0].free = free(pendingPos, pending, s); }
      pending = "";
    }
    items.push({ parts });
  }
  if (pending) items.push({ parts: [{ chord: pending, text: NBSP }] });
  // Tidy runs of spaces left by chords over gaps.
  return items.filter((it, i) => !(it.space && (i === 0 || items[i - 1].space)));
}

// Display blocks for the song view. Unlike parseSheet, these are built to wrap:
//   { kind: "section" | "blank" | "lyric" | "chords" | "pair" | "tab", ... }
export function parseBlocks(text, steps = 0, flats = false) {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n").map(l => l.replace(/\s+$/, ""));
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out.push({ kind: "blank" }); continue; }

    if (isTabLine(line) && isTabLine(lines[i + 1] || "")) {
      const sys = [];
      while (i < lines.length && isTabLine(lines[i])) sys.push(lines[i++]);
      i--;
      out.push({ kind: "tab", lines: sys });
      continue;
    }

    const sec = line.match(SECTION_RE);
    if (sec && !(sec[1] && isChord(sec[1]))) { out.push({ kind: "section", text: secName(sec) }); continue; }

    const inline = [...line.matchAll(/\[([^\]]+)\]/g)];
    if (inline.length && inline.every(x => isChord(x[1]))) {
      const chordsAt = new Map();
      let lyric = "", idx = 0;
      for (const x of inline) {
        lyric += line.slice(idx, x.index);
        const label = transposeChord(x[1], steps, flats);
        chordsAt.set(lyric.length, chordsAt.has(lyric.length) ? chordsAt.get(lyric.length) + " " + label : label);
        idx = x.index + x[0].length;
      }
      lyric += line.slice(idx);
      out.push(lyric.trim() ? { kind: "pair", words: buildWords(lyric, chordsAt) }
                            : { kind: "chords", items: [...chordsAt.values()] });
      continue;
    }

    if (isChordLine(line)) {
      const chordsAt = new Map();
      const re = /\S+/g;
      let m;
      while ((m = re.exec(line))) chordsAt.set(m.index, xposeToken(m[0], steps, flats));
      const next = lines[i + 1];
      const nextIsLyric = next && next.trim() && !isChordLine(next) && !SECTION_RE.test(next) && !isTabLine(next) &&
        !(/\[[^\]]+\]/.test(next) && [...next.matchAll(/\[([^\]]+)\]/g)].every(x => isChord(x[1])));
      if (nextIsLyric) {
        out.push({ kind: "pair", words: buildWords(next, chordsAt) });
        i++;
      } else out.push({ kind: "chords", items: [...chordsAt.values()] });
      continue;
    }

    out.push({ kind: "lyric", text: line });
  }
  // Collapse repeated blanks.
  return out.filter((b, i) => !(b.kind === "blank" && (i === 0 || out[i - 1].kind === "blank")));
}

// Wrap a tab system (all strings together) to `cols` characters, breaking at
// bar lines shared by every string and repeating the string names on each row.
export function wrapTab(lines, cols) {
  const width = Math.max(...lines.map(l => l.length));
  const ls = lines.map(l => l.padEnd(width, " "));
  if (width <= cols) return [ls];
  const bars = [];
  for (let p = 0; p < width; p++) if (ls.every(l => l[p] === "|")) bars.push(p);
  const labelEnd = bars.length && bars[0] <= 4 ? bars[0] + 1 : 0;
  const label = ls.map(l => l.slice(0, labelEnd));
  const room = Math.max(8, cols - labelEnd);

  // Measures: label end → each shared bar (inclusive), then any tail.
  const cuts = [labelEnd, ...bars.filter(b => b >= labelEnd).map(b => b + 1)];
  if (cuts[cuts.length - 1] < width) cuts.push(width);
  const measures = [];
  for (let k = 0; k < cuts.length - 1; k++) {
    let a = cuts[k];
    const b = cuts[k + 1];
    while (b - a > room) { measures.push([a, a + room]); a += room; } // over-long measure: hard split
    if (b > a) measures.push([a, b]);
  }

  const rows = [];
  let cur = null, len = 0;
  for (const [a, b] of measures) {
    if (cur && len + (b - a) > room) { rows.push(cur); cur = null; }
    if (!cur) { cur = label.slice(); len = 0; }
    cur = cur.map((r, j) => r + ls[j].slice(a, b));
    len += b - a;
  }
  if (cur) rows.push(cur);
  return rows.map(r => r.map(l => l.replace(/\s+$/, "")));
}

// Parse a chord sheet into display lines.
// Each line: { kind: "chords" | "lyric" | "section" | "blank", text }
export function parseSheet(text, steps = 0, flats = false) {
  const out = [];
  for (const raw of text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { out.push({ kind: "blank", text: "" }); continue; }

    const sec = line.match(SECTION_RE);
    if (sec && !(sec[1] && isChord(sec[1]))) {
      out.push({ kind: "section", text: secName(sec) });
      continue;
    }

    const inline = [...line.matchAll(/\[([^\]]+)\]/g)];
    if (inline.length && inline.every(x => isChord(x[1]))) {
      const { chords, lyric } = expandInline(line);
      out.push({ kind: "chords", text: transposeChordLine(chords, steps, flats) });
      if (lyric.trim()) out.push({ kind: "lyric", text: lyric });
      continue;
    }

    if (isChordLine(line)) out.push({ kind: "chords", text: transposeChordLine(line, steps, flats) });
    else out.push({ kind: "lyric", text: line });
  }
  return out;
}

// ---------- Chord fingerings ----------
// Strings run low E → high e. Frets: -1 muted, 0 open, n fretted. Fingers: 0 none, 1-4.

const OPEN = {
  "C": ["x32010", "032010"], "C7": ["x32310", "032410"], "Cmaj7": ["x32000", "032000"], "Cadd9": ["x32030", "021030"],
  "Csus4": ["x33011", "034011"],
  "D": ["xx0232", "000132"], "Dm": ["xx0231", "000231"], "D7": ["xx0212", "000213"], "Dm7": ["xx0211", "000211"],
  "Dmaj7": ["xx0222", "000111"], "Dsus2": ["xx0230", "000130"], "Dsus4": ["xx0233", "000134"], "D6": ["xx0202", "000102"],
  "E": ["022100", "023100"], "Em": ["022000", "023000"], "E7": ["020100", "020100"], "Em7": ["020000", "020000"],
  "Emaj7": ["021100", "031200"], "Esus4": ["022200", "023400"], "E5": ["022xxx", "012000"],
  "G": ["320003", "210003"], "G7": ["320001", "320001"], "Gmaj7": ["320002", "320001"], "G6": ["320000", "210000"],
  "Gsus4": ["330013", "230014"], "Gadd9": ["300203", "200103"],
  "A": ["x02220", "001230"], "Am": ["x02210", "002310"], "A7": ["x02020", "002030"], "Am7": ["x02010", "002010"],
  "Amaj7": ["x02120", "002130"], "Asus2": ["x02200", "001200"], "Asus4": ["x02230", "001230"], "A5": ["x022xx", "001200"],
  "B7": ["x21202", "021304"], "Bm7": ["x20202", "010203"], "Fmaj7": ["xx3210", "003210"]
};

// Movable shapes as fret offsets from the root fret (null = muted) with fingers.
const E_SHAPE = {
  "":     [[0, 2, 2, 1, 0, 0], [1, 3, 4, 2, 1, 1], true],
  "m":    [[0, 2, 2, 0, 0, 0], [1, 3, 4, 1, 1, 1], true],
  "7":    [[0, 2, 0, 1, 0, 0], [1, 3, 1, 2, 1, 1], true],
  "m7":   [[0, 2, 0, 0, 0, 0], [1, 3, 1, 1, 1, 1], true],
  "maj7": [[0, null, 1, 1, 0, null], [1, 0, 3, 4, 2, 0], false],
  "sus4": [[0, 2, 2, 2, 0, 0], [1, 2, 3, 4, 1, 1], true],
  "7sus4": [[0, 2, 0, 2, 0, 0], [1, 3, 1, 4, 1, 1], true],
  "5":    [[0, 2, 2, null, null, null], [1, 3, 4, 0, 0, 0], false]
};
const A_SHAPE = {
  "":     [[null, 0, 2, 2, 2, 0], [0, 1, 2, 3, 4, 1], true],
  "m":    [[null, 0, 2, 2, 1, 0], [0, 1, 3, 4, 2, 1], true],
  "7":    [[null, 0, 2, 0, 2, 0], [0, 1, 3, 1, 4, 1], true],
  "m7":   [[null, 0, 2, 0, 1, 0], [0, 1, 3, 1, 2, 1], true],
  "maj7": [[null, 0, 2, 1, 2, 0], [0, 1, 3, 2, 4, 1], true],
  "sus2": [[null, 0, 2, 2, 0, 0], [0, 1, 3, 4, 1, 1], true],
  "sus4": [[null, 0, 2, 2, 3, 0], [0, 1, 2, 3, 4, 1], true],
  "7sus4": [[null, 0, 2, 0, 3, 0], [0, 1, 3, 1, 4, 1], true],
  "dim":  [[null, 0, 1, 2, 1, null], [0, 1, 2, 4, 3, 0], false],
  "m7b5": [[null, 0, 1, 0, 1, null], [0, 1, 3, 2, 4, 0], false],
  "6":    [[null, 0, 2, 2, 2, 2], [0, 1, 3, 3, 3, 3], false],
  "5":    [[null, 0, 2, 2, null, null], [0, 1, 3, 4, 0, 0], false]
};

// Reduce a chord's quality to one of the shapes above.
function quality(q) {
  q = q.replace(/\(([^)]*)\)/g, "$1");
  if (/^(m7b5|ø7?|min7b5|-7b5)/.test(q)) return "m7b5";
  if (/^(dim|°)/.test(q)) return "dim";
  if (/^(maj7|M7|maj9|Δ)/.test(q)) return "maj7";
  if (/^(m7|min7|-7|m9|m11)/.test(q)) return "m7";
  if (/^(m6|min6)/.test(q)) return "m";
  if (/^(m|min|-)(?!aj)/.test(q)) return "m";
  if (/^(7sus4|7sus)/.test(q)) return "7sus4";
  if (/^(sus2)/.test(q)) return "sus2";
  if (/^(sus4|sus)/.test(q)) return "sus4";
  if (/^(7|9|11|13)/.test(q)) return "7";
  if (/^6/.test(q)) return "6";
  if (/^5$/.test(q)) return "5";
  if (/^add9|^add2/.test(q)) return "add9";
  return "";
}

const ROOTS = { C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11 };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function fromStrings(frets, fingers) {
  return { frets: [...frets].map(c => c === "x" ? -1 : +c), fingers: [...fingers].map(Number) };
}

function finish(shape) {
  const played = shape.frets.filter(f => f > 0);
  const max = played.length ? Math.max(...played) : 0;
  const min = played.length ? Math.min(...played) : 0;
  // A barre is the index finger on every string at the lowest fret.
  if (!shape.barre) {
    const idx = shape.fingers.map((f, i) => f === 1 && shape.frets[i] === min ? i : -1).filter(i => i >= 0);
    if (idx.length >= 3) shape.barre = { fret: min, from: idx[0], to: idx[idx.length - 1] };
  }
  // Barre chords up the neck show their fret number; open shapes show the nut.
  shape.base = max <= 4 && !(shape.barre && min > 1) ? 1 : min;
  return shape;
}

// Fingering for a chord name such as "F#m", "Bb7", "D/F#". Returns null if unknown.
export function chordShape(name) {
  const m = String(name).match(/^([A-G][#b]?)([^/]*)(?:\/.*)?$/);
  if (!m || ROOTS[m[1]] === undefined) return null;
  const root = ROOTS[m[1]];
  let q = quality(m[2]);
  const sharpRoot = SHARP_NAMES[root];
  const flatRoot = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"][root];
  const qName = { "": "", m: "m", "7": "7", m7: "m7", maj7: "maj7", sus2: "sus2", sus4: "sus4", "7sus4": "7sus4", dim: "dim", m7b5: "m7b5", "6": "6", "5": "5", add9: "add9" }[q];
  for (const r of [sharpRoot, flatRoot, m[1]]) {
    const hit = OPEN[r + qName];
    if (hit) return finish(fromStrings(hit[0], hit[1]));
  }
  if (q === "add9") q = "";
  if (q === "sus2" && !A_SHAPE.sus2) q = "";
  const options = [];
  const eFret = ((root - 4) + 12) % 12 || 12;
  const aFret = ((root - 9) + 12) % 12 || 12;
  if (E_SHAPE[q]) options.push([E_SHAPE[q], eFret]);
  if (A_SHAPE[q]) options.push([A_SHAPE[q], aFret]);
  if (!options.length) options.push([E_SHAPE[q.startsWith("m") ? "m" : ""], eFret]);
  options.sort((a, b) => a[1] - b[1]);
  const [[offs, fingers, barre], r] = options[0];
  const frets = offs.map(o => o === null ? -1 : o + r);
  const shape = { frets, fingers: fingers.slice() };
  if (barre) {
    const strings = offs.map((o, i) => o === 0 ? i : -1).filter(i => i >= 0);
    shape.barre = { fret: r, from: strings[0], to: 5 };
  }
  return finish(shape);
}

// ---------- Sharing ----------
// A shared song or set travels inside the link itself (no server): the fields
// worth sharing, as JSON, compressed where the browser can, in base64url.
const SHARE_FIELDS = ["title", "artist", "key", "format", "body", "duration", "speed", "bpm", "transpose", "tuning", "listen"];
export function shareable(song) {
  const o = {};
  for (const k of SHARE_FIELDS) if (song[k] !== undefined && song[k] !== "" && song[k] !== 0) o[k] = song[k];
  /* Only a plain https link travels, never anything that could run as code. */
  if (o.listen) o.listen = /^https:\/\//.test(o.listen.url || "") ? { url: String(o.listen.url), service: linkService(o.listen.url) } : undefined;
  if (!o.listen) delete o.listen;
  if (o.tuning && !TUNINGS[o.tuning]) delete o.tuning;
  return o;
}
const b64url = bytes => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = str => {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}
// payload: { song } or { set: { name, songs: [...] } }
export async function packShare(payload) {
  const raw = new TextEncoder().encode(JSON.stringify({ v: 1, ...payload }));
  if (typeof CompressionStream === "function") {
    try { return "z" + b64url(await pipe(raw, new CompressionStream("deflate-raw"))); } catch {}
  }
  return "j" + b64url(raw);
}
export async function unpackShare(code) {
  try {
    let bytes = unb64url(code.slice(1));
    if (code[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    else if (code[0] !== "j") return null;
    const p = JSON.parse(new TextDecoder().decode(bytes));
    const ok = s => s && typeof s.title === "string" && typeof s.body === "string";
    // Play together: a start time and tempo ride along with the song.
    const duet = p.duet && Number.isFinite(p.duet.at) && p.duet.at > 1.6e12 && p.duet.at < 4e12
      ? { at: Math.round(p.duet.at), bpm: Math.min(300, Math.max(30, +p.duet.bpm || 90)) } : null;
    if (p.song && ok(p.song)) return duet ? { song: shareable(p.song), duet } : { song: shareable(p.song) };
    if (p.set && Array.isArray(p.set.songs) && p.set.songs.every(ok))
      return { set: { name: String(p.set.name || "Shared set"), songs: p.set.songs.map(shareable) } };
  } catch {}
  return null;
}
// Same song already in the library? (title and artist, ignoring case and spaces)
const sameKey = s => `${(s.title || "").trim().toLowerCase()}|${(s.artist || "").trim().toLowerCase()}`;
export const findSame = (data, song) => data.songs.find(s => sameKey(s) === sameKey(song));

// ---------- Library search and sort ----------
// Lyric lines only: no chord lines, section labels, tab staves or inline [G] chords.
// Remembered per song body, so searching as you type doesn't re-read every sheet.
const lyricCache = new Map();
function lyricLines(body) {
  body = String(body || "");
  let lines = lyricCache.get(body);
  if (!lines) {
    lines = body.split("\n")
      .map(l => l.replace(/\[[^\]]*\]/g, "").trim())
      .filter(l => l && !isChordLine(l) && !/^[eBGDAE]\|/.test(l));
    lines.lower = lines.map(l => l.toLowerCase().replace(/\s+/g, " "));
    if (lyricCache.size > 2000) lyricCache.clear();
    lyricCache.set(body, lines);
  }
  return lines;
}
// Matches title and artist first, then words in the lyrics.
// Returns [{ song, line }] where line is the lyric that matched (or null).
export function searchSongs(songs, query) {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return songs.map(song => ({ song, line: null }));
  const named = [], sung = [];
  for (const song of songs) {
    if (`${song.title} ${song.artist || ""}`.toLowerCase().includes(q)) { named.push({ song, line: null }); continue; }
    if (q.length < 3) continue;
    const lines = lyricLines(song.body), at = lines.lower.findIndex(l => l.includes(q));
    const line = at >= 0 ? lines[at] : null;
    if (line) sung.push({ song, line });
  }
  return [...named, ...sung];
}
export const lastPlayed = s => Math.max(s.opened || 0, s.playLog?.last || 0, ...(s.plays || []));
// mode: "title" | "artist" | "recent" | "most". By artist ignores a leading
// "The" (The Wanderers files under W) and puts songs with no artist last.
export const artistSortName = s => String(s.artist || "").replace(/^the\s+/i, "").trim();
// The letter a title files under in the A–Z index: accents dropped, digits and
// symbols under "#".
export function indexLetter(title) {
  const c = String(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}
export function sortSongs(songs, mode) {
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const byArtist = (a, b) => { const x = artistSortName(a), y = artistSortName(b); return (!x - !y) || x.localeCompare(y) || byTitle(a, b); };
  const cmp = {
    recent: (a, b) => lastPlayed(b) - lastPlayed(a) || byTitle(a, b),
    most: (a, b) => playCount(b) - playCount(a) || byTitle(a, b),
    artist: byArtist
  }[mode] || byTitle;
  return [...songs].sort(cmp);
}

// ---------- Tuner ----------
// Strings low to high, as note names with octave.
export const TUNINGS = {
  standard: { name: "Standard", notes: ["E2", "A2", "D3", "G3", "B3", "E4"] },
  dropd: { name: "Drop D", notes: ["D2", "A2", "D3", "G3", "B3", "E4"] },
  halfdown: { name: "Half step down", notes: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"] },
  wholedown: { name: "Whole step down", notes: ["D2", "G2", "C3", "F3", "A3", "D4"] },
  dadgad: { name: "DADGAD", notes: ["D2", "A2", "D3", "G3", "A3", "D4"] },
  openg: { name: "Open G", notes: ["D2", "G2", "D3", "G3", "B3", "D4"] },
  opend: { name: "Open D", notes: ["D2", "A2", "D3", "F#3", "A3", "D4"] }
};
const SEMI = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const midiOf = n => { const m = /^([A-G][#b]?)(-?\d)$/.exec(n); return m ? (+m[2] + 1) * 12 + SEMI[m[1]] : NaN; };
export const noteFreq = (n, a4 = 440) => a4 * 2 ** ((midiOf(n) - 69) / 12);
// Nearest note to a frequency: { name, octave, cents } (cents from -50 to +50).
export function nearestNote(freq, a4 = 440) {
  const midi = 69 + 12 * Math.log2(freq / a4), r = Math.round(midi);
  return { name: NAMES[((r % 12) + 12) % 12], octave: Math.floor(r / 12) - 1, cents: Math.round((midi - r) * 100) };
}
// Which string of the tuning a frequency is closest to, and how far off in cents.
export function nearestString(freq, tuning = "standard", a4 = 440) {
  const notes = (TUNINGS[tuning] || TUNINGS.standard).notes;
  let best = 0, bestC = Infinity;
  notes.forEach((n, i) => { const c = 1200 * Math.log2(freq / noteFreq(n, a4)); if (Math.abs(c) < Math.abs(bestC)) { best = i; bestC = c; } });
  return { index: best, note: notes[best], cents: Math.round(bestC) };
}
// A reading an octave off (a plucked low E heard as E3, or a high one as its
// lower octave) folded back to the string meant. With a target string,
// fold toward it; without one, only when the reading itself is near no string.
export function octaveFix(freq, tuning = "standard", a4 = 440, idx = -1) {
  const notes = (TUNINGS[tuning] || TUNINGS.standard).notes;
  const off = (f, i) => Math.abs(1200 * Math.log2(f / noteFreq(notes[i], a4)));
  const near = f => idx >= 0 ? off(f, idx) : Math.min(...notes.map((_, i) => off(f, i)));
  if (near(freq) <= 60) return freq;
  for (const f of [freq / 2, freq * 2]) if (near(f) <= 60) return f;
  return freq;
}
// The most natural German voice the phone has: Premium, then
// Enhanced (downloaded in iPhone Settings > Accessibility > Spoken Content),
// then a neural or natural voice in other browsers; Germany's German first.
// The playful novelty voices are left for last. null when there's none.
const NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Good News|Bad News|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox|Albert|Fred|Junior|Kathy|Ralph)\b/i;
export function bestGermanVoice(voices = []) {
  const score = v => (/premium/i.test(v.name) ? 40 : 0) + (/enhanced|erweitert|verbessert/i.test(v.name) ? 25 : 0)
    + (/neural|natural|online/i.test(v.name) ? 15 : 0) + (/^de[-_]DE/i.test(v.lang) ? 3 : 0) + (v.default ? 1 : 0)
    - (NOVELTY.test(v.name) ? 50 : 0);
  const de = voices.filter(v => /^de/i.test(v.lang || ""));
  return de.length ? de.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
}
// ---------- Tuner guidance ----------
// In tune within 3 cents; a reading has to drift past 5 before a string that
// was in tune stops counting, so one shaky reading doesn't start the hold over.
// Past 50 you're on the wrong note (or far off), so the words say so.
export const TUNE = { good: 3, slack: 5, far: 50, hold: 800 };
export const centsOff = (freq, note, a4 = 440) => 1200 * Math.log2(freq / noteFreq(note, a4));
// What to tell the player for a string that's `cents` away (negative = flat).
export function tuneAdvice(cents) {
  const a = Math.abs(cents), flat = cents < 0;
  if (a <= TUNE.good) return { say: "In tune", tone: "good" };
  if (a > TUNE.far) return { say: flat ? "Way low: tighten" : "Way high: loosen", tone: "far" };
  if (a <= 12) return { say: flat ? "Almost · tighten slowly" : "Almost · loosen slowly", tone: "close" };
  return { say: flat ? "Tighten" : "Loosen", tone: "off" };
}
// Guided mode works low to high: the first string not yet in tune (-1 when done).
export const guidedTarget = ok => { for (let i = 0; i < 6; i++) if (!ok[i]) return i; return -1; };
// A string counts once it has stayed in tune long enough.
export const heldInTune = (since, now) => !!since && now - since >= TUNE.hold;
// Where the tuner's marker sits, as a percent across the meter. The middle is
// stretched, so a cent or two still moves it visibly near the note, while
// 50 cents off reaches the end.
export const meterPos = cents => 50 + Math.sign(cents) * (Math.min(Math.abs(cents), 50) / 50) ** 0.6 * 45;

// A song's tuning from a line like "Tuning: Drop D" or "Tuning: D A D G B E".
export function detectTuning(body) {
  const m = /^\s*(?:tuning|tuned)\s*[:\-]?\s*(.+)$/im.exec(String(body || ""));
  if (!m) return "";
  const t = m[1].toLowerCase().replace(/[()]/g, "").trim();
  const letters = t.replace(/[^a-g#b ]/g, "").replace(/\s+/g, "");
  if (/drop\s*d/.test(t) || letters === "dadgbe") return "dropd";
  if (/dadgad/.test(t.replace(/\s+/g, ""))) return "dadgad";
  if (/half|e\s*flat|eb|1\/2/.test(t)) return "halfdown";
  if (/whole|full|d standard/.test(t) || letters === "dgcfad") return "wholedown";
  if (/open\s*g/.test(t) || letters === "dgdgbd") return "openg";
  if (/open\s*d/.test(t) || letters === "dadf#ad") return "opend";
  if (/standard|eadgbe/.test(t.replace(/\s+/g, ""))) return "standard";
  return "";
}
// Pitch of a mono buffer (the YIN method); -1 when it's too quiet or unclear.
// Searches 60 to 1000 Hz, which covers a guitar in any of the tunings above.
// minRms: below this level it's silence (a voice at arm's length is quieter
// than a guitar at the phone, so the sketch passes a lower one).
// clarity: how deep the clearest dip must be when there's no obvious one
// (lower is stricter). The tuner loosens it while a note it already caught
// is fading, so a decaying string keeps reading.
// range: [low, high] Hz to search instead, when the string is known. Only
// periods near that string are considered, so a weak fundamental can't be
// mistaken for its louder overtone, and a clearer dip isn't needed.
export function detectPitch(buf, sampleRate, minRms = 0.01, clarity = 0.35, range = null) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < minRms) return -1;
  const minLag = Math.max(2, Math.floor(sampleRate / (range ? range[1] : 1000))), maxLag = Math.min(Math.ceil(sampleRate / (range ? range[0] : 60)), (n >> 1) - 2);
  const W = n - maxLag - 2;
  const d = new Float32Array(maxLag + 2);
  for (let lag = 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const x = buf[i] - buf[i + lag]; s += x * x; }
    d[lag] = s;
  }
  /* Cumulative mean normalized difference: dips near 0 at the period. */
  const cm = new Float32Array(maxLag + 2);
  cm[0] = 1;
  let run = 0;
  for (let lag = 1; lag <= maxLag + 1; lag++) { run += d[lag]; cm[lag] = run ? d[lag] * lag / run : 1; }
  let tau = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (cm[lag] < 0.12) { while (lag + 1 <= maxLag && cm[lag + 1] < cm[lag]) lag++; tau = lag; break; }
  }
  if (tau < 0) {
    /* No clear dip: take the deepest one if it's reasonably clear. */
    let best = 1;
    for (let lag = minLag; lag <= maxLag; lag++) if (cm[lag] < best) { best = cm[lag]; tau = lag; }
    if (best > clarity) return -1;
  }
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1], den = a - 2 * b + c;
  const shift = den ? (a - c) / (2 * den) : 0;
  return sampleRate / (tau + shift);
}

// ---------- Listening links ----------
// Rank Apple Music search results against a song's title and artist.
const norm = s => String(s || "").toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, " ")                 /* (Remastered 2011), [Live] */
  .replace(/\s+-\s+.*$/, " ")                        /* " - Single Version" */
  .replace(/&/g, " and ").replace(/^the\s+/, "")
  .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
export function rankTracks(results, title, artist) {
  const t = norm(title), a = norm(artist);
  const score = r => {
    const rt = norm(r.trackName), ra = norm(r.artistName);
    let s = rt === t ? 3 : rt.startsWith(t) || t.startsWith(rt) ? 1.5 : 0;
    if (a) s += ra === a ? 3 : ra.includes(a) || a.includes(ra) ? 1.5 : 0;
    if (/live|karaoke|tribute|cover|instrumental/i.test(`${r.trackName} ${r.collectionName} ${r.artistName}`)) s -= 1;
    return s;
  };
  return results.filter(r => r.trackViewUrl).map(r => ({ r, s: score(r) })).sort((x, y) => y.s - x.s).map(x => ({ ...x.r, score: x.s }));
}
// Just heard it (3.24.0): the newest song in Apple Music's recently played, offered on Tonight for 3 hours
// from when the app first sees it, until you act on it or close it. seen is { k, at, done? } from last time.
// Returns { seen, offer } where offer is { track, song } (song: the library song it matches, or null).
export const HEARD_FOR = 3 * 3600000;
export function heardMatch(songs, track) {
  const t = norm(track?.title), a = norm(track?.artist);
  if (!t) return null;
  const same = s => norm(s.title) === t && (!a || !s.artist || norm(s.artist) === a || norm(s.artist).includes(a) || a.includes(norm(s.artist)));
  return (songs || []).find(same) || null;
}
export function heardOffer(songs, latest, seen, now = Date.now()) {
  if (!latest?.title) return { seen, offer: null };
  const k = `${norm(latest.title)}|${norm(latest.artist)}`;
  if (seen?.k !== k) seen = { k, at: now };
  if (seen.done || now - seen.at > HEARD_FOR) return { seen, offer: null };
  return { seen, offer: { track: latest, song: heardMatch(songs, latest) } };
}
// A link someone pasted: which service is it?
// ---------- Song length from the recording ----------
// The Apple Music track number from a link: .../album/name/123?i=456 or .../song/name/456.
export function appleTrackId(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)(music|itunes)\.apple\.com$/.test(u.hostname)) return "";
    const i = u.searchParams.get("i");
    if (/^\d+$/.test(i || "")) return i;
    const m = u.pathname.match(/\/song\/(?:[^/]+\/)?(\d+)\/?$/);
    return m ? m[1] : "";
  } catch { return ""; }
}
// What to do with a recording's length: "set" when the song's length was never
// chosen (so the recording is the best guess), "offer" when you set your own and
// it differs, "none" when they already match. Lengths are kept to 1:00 to 8:00,
// the slider's range.
/* A song's length runs from 1:00 to 15:00 (3.19.0; it was 8:00, which cut long live takes short). */
export const MAX_LENGTH = 900;
export const fitLength = sec => Math.min(MAX_LENGTH, Math.max(60, Math.round(sec)));
export function lengthChoice(song, seconds, settings = {}) {
  if (!(seconds > 0)) return "none";
  const rec = fitLength(seconds);
  const unset = !song.durationSet && (song.duration === undefined || song.duration === (settings.startLength || 210));
  if (unset) return song.duration === rec ? "none" : "set";
  return Math.abs((song.duration || 0) - rec) > 5 ? "offer" : "none";
}

// ---------- Tap tempo ----------
// Beats per minute from tap times (ms). Only the latest run counts: a pause of
// over 2 seconds starts again. The median gap ignores one stray tap.
export function tapTempo(times) {
  let run = [];
  for (const t of times) { if (run.length && t - run[run.length - 1] > 2000) run = []; run.push(t); }
  run = run.slice(-9);
  if (run.length < 2) return 0;
  const gaps = run.slice(1).map((t, i) => t - run[i]).sort((a, b) => a - b);
  const mid = gaps[gaps.length >> 1];
  return Math.min(260, Math.max(30, Math.round(60000 / mid)));
}

export function linkService(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    if (/music\.apple\.com|itunes\.apple\.com/.test(h)) return "Apple Music";
    if (/spotify\.com/.test(h)) return "Spotify";
    if (/youtube\.com|youtu\.be/.test(h)) return /music\./.test(h) ? "YouTube Music" : "YouTube";
    if (/soundcloud\.com/.test(h)) return "SoundCloud";
    return h;
  } catch { return ""; }
}
// The first sung line of a song (for the "next up" preview on stage).
export const firstLyric = body => lyricLines(body).find(l => !/^tuning\b/i.test(l) && !/^capo\b/i.test(l)) || "";

// ---------- Chord editor ----------
// The sheet as editable lines. Each lyric line knows where its chords are
// (character positions in the lyric) and how they're written: on a chord line
// above (most sheets) or inline like [G]word.
//   { kind: "lyric", i, chordLine, inline, text, chords: [{ pos, chord }] }
//   { kind: "section" | "chords" | "tab" | "blank" | "other", i, text }
const isInlineLine = l => { const m = [...l.matchAll(/\[([^\]]+)\]/g)]; return m.length > 0 && m.every(x => isChord(x[1])); };
export function chordModel(body) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { out.push({ kind: "blank", i, text: "" }); continue; }
    if (isTabLine(line)) { out.push({ kind: "tab", i, text: line }); continue; }
    const sec = line.match(SECTION_RE);
    if (sec && !(sec[1] && isChord(sec[1]))) { out.push({ kind: "section", i, text: secName(sec) }); continue; }
    if (isInlineLine(line)) {
      const chords = []; let text = "", idx = 0;
      for (const x of line.matchAll(/\[([^\]]+)\]/g)) { text += line.slice(idx, x.index); chords.push({ pos: text.length, chord: x[1] }); idx = x.index + x[0].length; }
      text += line.slice(idx);
      out.push(text.trim() ? { kind: "lyric", i, chordLine: -1, inline: true, text, chords } : { kind: "chords", i, text: line });
      continue;
    }
    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next && next.trim() && !isChordLine(next) && !SECTION_RE.test(next) && !isTabLine(next) && !isInlineLine(next)) {
        const chords = [...line.matchAll(/\S+/g)].map(m => ({ pos: m.index, chord: m[0] }));
        out.push({ kind: "lyric", i: i + 1, chordLine: i, inline: false, text: next, chords });
        i++;
      } else out.push({ kind: "chords", i, text: line });
      continue;
    }
    out.push({ kind: "lyric", i, chordLine: -1, inline: false, text: line, chords: [] });
  }
  return out;
}
// Set (or with chord = null, remove) the chord at a position in a lyric line.
// `i` is the lyric's line number in the body. Returns the new body.
export function setChordAt(body, i, pos, chord) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const ln = chordModel(body).find(l => l.kind === "lyric" && l.i === i);
  if (!ln) return body;
  const chords = ln.chords.filter(c => c.pos !== pos);
  if (chord) chords.push({ pos, chord });
  chords.sort((a, b) => a.pos - b.pos);
  if (ln.inline) {
    let s = "", idx = 0;
    for (const c of chords) { s += ln.text.slice(idx, c.pos) + `[${c.chord}]`; idx = c.pos; }
    lines[i] = s + ln.text.slice(idx);
    return lines.join("\n");
  }
  /* Chord line above: each chord at its position, nudged right only if it would touch the one before. */
  let row = "";
  for (const c of chords) {
    const at = Math.max(c.pos, row.length ? row.length + 1 : 0);
    row = row.padEnd(at, " ") + c.chord;
  }
  if (ln.chordLine >= 0) {
    if (row) lines[ln.chordLine] = row; else lines.splice(ln.chordLine, 1);
  } else if (row) lines.splice(i, 0, row);
  return lines.join("\n");
}
// Chords used in a sheet, in order of first use.
export function chordsUsed(body) {
  const seen = [];
  /* Chords over words, and lines of chords alone (a chart without its words yet). */
  for (const l of chordModel(body)) {
    const cs = l.kind === "lyric" ? (l.chords || []).map(c => c.chord) : l.kind === "chords" ? String(l.text || "").split(/\s+/).map(t => t.replace(/^\(|\)$/g, "")) : (l.chords || []).map(c => c.chord);
    for (const c of cs) if (c && isChord(c) && !seen.includes(c)) seen.push(c);
  }
  return seen;
}

// Retype a lyric line, keeping its chords where they were (clamped to the new
// length). An empty line removes the lyric and its chord line. Returns the new body.
export function setLineText(body, i, text) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const ln = chordModel(body).find(l => l.kind === "lyric" && l.i === i);
  if (!ln) return body;
  text = String(text).replace(/\s+$/, "");
  if (!text.trim()) {
    const from = ln.chordLine >= 0 ? ln.chordLine : i;
    lines.splice(from, i - from + 1);
    return lines.join("\n");
  }
  if (ln.inline) {
    let s = "", idx = 0;
    for (const c of ln.chords) { const p = Math.min(c.pos, text.length); s += text.slice(idx, p) + `[${c.chord}]`; idx = p; }
    lines[i] = s + text.slice(idx);
    return lines.join("\n");
  }
  lines[i] = text;
  return lines.join("\n");
}
// Rename a section label (written as [Name]).
export function renameSection(body, i, name) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  if (!name.trim()) lines.splice(i, 1); else lines[i] = `[${name.trim()}]`;
  return lines.join("\n");
}
// Insert lines after line i (-1 for the very start). Returns { body, at } where
// `at` is the index of the first inserted line.
export function insertLines(body, i, newLines) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  if (lines.length === 1 && lines[0] === "") lines.length = 0;
  lines.splice(i + 1, 0, ...newLines);
  return { body: lines.join("\n"), at: i + 1 };
}

// ---------- Sets as events ----------
// A set can have a date ("when", local time like 2026-10-17T20:00) and a place.
// The next one is the soonest still ahead, or that started in the last 6 hours.
export function nextSet(sets, now = Date.now()) {
  return (sets || []).filter(s => s.when && Date.parse(s.when) > now - 6 * 3600e3)
    .sort((a, b) => Date.parse(a.when) - Date.parse(b.when))[0] || null;
}
// "today", "tomorrow", "in 3 days", "in 2 weeks", or "now" for a set under way.
// Gig day: the time left until a set starts, as h:mm:ss, on its own calendar
// day and only before it starts. Anything else: "" (no countdown).
// The ring's arc: where a sweep puts the song. The pace comes from how
// far the thumb has swept, not how fast, so it's steady: near where the thumb
// landed it's fine (about a screen per arc), and it picks up smoothly so that
// reaching the end of the arc reaches the end of the song (or the start, going
// down). Moving back retraces the same path. A sweep that starts close to an
// end of the arc gets at least a third of the arc's room, so the rest of the
// song is never squeezed into a few degrees.
// a, from: angles (180 left, 270 up); a0, a1: the arc's ends; y0: the scroll
// position when the sweep began; max: the furthest scroll; fine: px per degree.
export function arcMap({ a, from, a0, a1, y0, max, fine, whole = true }) {
  const clamp = y => Math.min(max, Math.max(0, y));
  if (!whole) return clamp(y0 + (a - from) * fine);
  const span = a1 - a0, up = a >= from;
  /* Within 2 degrees of an end counts as the end (a thumb rarely hits it exactly). */
  const room = Math.max((up ? a1 - from : from - a0) - 2, span / 3);
  const dist = up ? max - y0 : y0;
  if (dist <= 0) return clamp(y0);
  const u = Math.min(1, Math.abs(a - from) / room);
  const c = Math.min(1, fine * room / dist);           /* the starting pace, as a share of the straight line */
  const g = c * u + (1 - c) * u * u;                   /* fine at first, then picks up evenly; g(1) = 1 */
  return clamp(up ? y0 + dist * g : y0 - dist * g);
}
export function gigCountdown(when, now = Date.now()) {
  const t = Date.parse(when);
  if (isNaN(t) || t <= now) return "";
  const a = new Date(t), b = new Date(now);
  if (a.toDateString() !== b.toDateString()) return "";
  const s = Math.floor((t - now) / 1000), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
export function untilLabel(when, now = Date.now()) {
  const t = Date.parse(when);
  if (isNaN(t)) return "";
  if (t <= now) return now - t < 6 * 3600e3 ? "now" : "";
  const day = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const days = Math.round((day(t) - day(now)) / 864e5);
  if (days === 0) { const h = Math.round((t - now) / 3600e3); return h <= 1 ? "within the hour" : `in ${h} hours`; }
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

// A set played through: when, how long it took, and how many of its songs were played.
export function logSetRun(set, startedAt, played, now = Date.now()) {
  set.runs = [...(set.runs || []), { at: now, secs: Math.round((now - startedAt) / 1000), songs: played }].slice(-50);
  return set.runs[set.runs.length - 1];
}

// ---------- AI chord charts ----------
// Turns the AI's answer into a sheet made only of section names and chords.
// Every token is checked with isChord, so no words from the song can get in:
// the chart is chords and structure only, never lyrics.
const SECTION_NAME = /^(intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|instrumental|tag|refrain|coda|ending|break|hook|riff)(\s*\d+)?$/i;
export function buildChart(ai) {
  const lines = [];
  const capo = Math.max(0, Math.min(9, parseInt(ai.capo, 10) || 0));
  /* A strum in D (down), U (up), x (muted) and - (held), or a few words for a
     fingerpicked song. */
  const raw = String(ai.strum || "").trim();
  const strum = /^finger/i.test(raw) ? raw.replace(/[^A-Za-z0-9 ,:'-]/g, "").replace(/\s+/g, " ").slice(0, 60)
    : raw.replace(/[^DUdux\-\s]/g, "").replace(/\s+/g, " ").trim().replace(/[du]/g, c => c.toUpperCase()).slice(0, 32);
  const head = [capo && `Capo ${capo}`, strum && (/^finger/i.test(strum) ? strum : `Strum: ${strum}`)].filter(Boolean).join(" · ");
  if (head) lines.push(head, "");
  for (const sec of Array.isArray(ai.sections) ? ai.sections : []) {
    const name = String(sec.name || "").trim();
    const chords = String(sec.chords || "").split(/[\s|,]+/).map(t => t.trim()).filter(t => isChord(t));
    if (!chords.length) continue;
    const reps = Math.max(1, Math.min(8, parseInt(sec.repeat, 10) || 1));
    lines.push(`[${SECTION_NAME.test(name) ? name.replace(/\b\w/g, c => c.toUpperCase()) : "Part"}]${reps > 1 ? ` (x${reps})` : ""}`);
    for (let i = 0; i < chords.length; i += 8) lines.push(chords.slice(i, i + 8).join("   "));
    lines.push("");
  }
  return lines.join("\n").trim();
}
// ---------- Changes: the moves between chords you play ----------
// A song's chord changes in the shapes your hands make (its transpose
// applied), as unordered pairs: G to C and C to G are one change. Counted from
// plays already logged, so nothing new is stored. A pair is "a|b", sorted.
const changeCache = new Map();
export function songChanges(song) {
  if (!song || song.format === "tab") return new Map();
  const steps = shapeSteps(song), key = steps + "\n" + (song.body || "");
  if (changeCache.has(key)) return changeCache.get(key);
  const seq = [];
  for (const l of chordModel(song.body || "")) {
    const cs = l.kind === "lyric" ? l.chords.map(c => c.chord) : l.kind === "chords" ? l.text.split(/\s+/).map(t => t.replace(/^\(|\)$/g, "")) : [];
    for (const c of cs) if (c && isChord(c)) seq.push(transposeChord(c, steps, /^[A-G]b/.test(c)));
  }
  const out = new Map();
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1], b = seq[i];
    if (a === b) continue;
    const k = a < b ? a + "|" + b : b + "|" + a, x = out.get(k) || { n: 0, dir: {} };
    x.n++; x.dir[a + ">" + b] = (x.dir[a + ">" + b] || 0) + 1;
    out.set(k, x);
  }
  if (changeCache.size > 500) changeCache.clear();
  changeCache.set(key, out);
  return out;
}
// Every change in the library: how often you played it in the last 7 days
// (plays of a song to its end, times how often the change is in it), and how
// often it appears across your songs. "most": the ones you play most.
// "work": changes your songs have (twice or more) that you play least, each
// with the song that has it most.
export function changesOf(songs, now = Date.now()) {
  const all = new Map();
  for (const s of songs) {
    const w = playsThisWeek(s, now);
    for (const [k, x] of songChanges(s)) {
      const c = all.get(k) || { key: k, week: 0, inSongs: 0, dir: {}, songs: [] };
      c.week += w * x.n; c.inSongs += x.n; c.songs.push({ id: s.id, title: s.title, n: x.n });
      for (const [d, n] of Object.entries(x.dir)) c.dir[d] = (c.dir[d] || 0) + n;
      all.set(k, c);
    }
  }
  const list = [...all.values()].map(c => {
    const [d] = Object.entries(c.dir).sort((x, y) => y[1] - x[1])[0]; // a tie: the way it first comes up
    const [a, b] = d.split(">");
    c.songs.sort((x, y) => y.n - x.n || (x.title < y.title ? -1 : 1));
    return { key: c.key, a, b, week: c.week, inSongs: c.inSongs, best: c.songs[0] };
  });
  const most = list.filter(c => c.week > 0).sort((x, y) => y.week - x.week || y.inSongs - x.inSongs).slice(0, 4);
  const top = most[0]?.week || 0;
  const work = list.filter(c => c.inSongs >= 2 && !most.includes(c) && c.week <= Math.max(2, top / 10))
    .sort((x, y) => x.week - y.week || y.inSongs - x.inSongs || (x.key < y.key ? -1 : 1)).slice(0, 2);
  return { most, work, played: list.some(c => c.week > 0) };
}

// Known chords across a library, most used first.
// The capo a chart asks for on its first lines ("Capo 2 · Strum: ..." or
// "[Capo 2]"), or 0.
export function bodyCapo(body) {
  const m = /^\s*\[?capo\s*(\d{1,2})\b/im.exec(String(body || "").split("\n").slice(0, 3).join("\n"));
  return m ? Math.min(11, +m[1]) : 0;
}
// How far a song's shapes move from what's written: Transpose, plus the
// chart's capo when you've taken it off (the shapes go up to the sounding key).
export const shapeSteps = song => (song?.transpose || 0) + (song?.capoOff ? bodyCapo(song.body) : 0);
// What the AI is told about the player for "My level": chords from songs
// you've got (or every song, if none is marked), chords from songs you're
// learning, and the changes you're working on.
export function playerLevel(songs, now = Date.now()) {
  const got = songs.filter(s => s.status === "got");
  const plays = chordCounts(got.length ? got : songs).slice(0, 24);
  const learning = chordCounts(songs.filter(s => s.status === "learning")).filter(c => !plays.includes(c)).slice(0, 12);
  const work = changesOf(songs, now).work.map(c => `${c.a} to ${c.b}`).slice(0, 8);
  return { plays, learning, work };
}
export function chordCounts(songs) {
  const n = new Map();
  for (const s of songs) for (const c of chordsUsed(s.body || "")) n.set(c, (n.get(c) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

// ---------- Song sketch: from a sung melody to chords ----------
// Sing a line, give its words; the melody's notes give the key, chords that
// hold those notes, and where each chord falls in the words. A first draft to
// adjust, not the one right answer: a melody fits more than one set of chords.
const NOTE_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const median = xs => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
export const midiOfHz = hz => 69 + 12 * Math.log2(hz / 440);

// Pitch frames ({ t: seconds, hz, -1 when nothing was heard }) into notes: a
// steady pitch held at least minDur, vibrato and scoops smoothed out.
export function melodyNotes(frames, { minDur = 0.09, tol = 0.7 } = {}) {
  if (!frames.length) return [];
  const step = median(frames.slice(1).map((f, i) => f.t - frames[i].t)) || 0.02;
  const v = frames.map(f => (f.hz > 0 ? midiOfHz(f.hz) : null));
  const sm = v.map((x, i) => {
    if (x === null) return null;
    return median(v.slice(Math.max(0, i - 2), i + 3).filter(y => y !== null));
  });
  const notes = [];
  let cur = null;
  const close = () => {
    if (cur && cur.end - cur.start + step >= minDur) notes.push({ midi: Math.round(median(cur.vals)), start: cur.start, dur: cur.end - cur.start + step });
    cur = null;
  };
  frames.forEach((f, i) => {
    const m = sm[i];
    if (m === null) return close();
    if (cur && Math.abs(m - median(cur.vals)) <= tol) { cur.vals.push(m); cur.end = f.t; }
    else { close(); cur = { start: f.t, end: f.t, vals: [m] }; }
  });
  close();
  return notes;
}

// The key that best fits the notes (Krumhansl-Kessler key profiles, weighted by
// how long each note is held; the last note leans toward home).
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const MAJOR_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINOR_NAMES = ["Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
export function detectKey(notes) {
  const h = new Array(12).fill(0);
  notes.forEach(n => { h[((n.midi % 12) + 12) % 12] += n.dur; });
  const last = notes[notes.length - 1];
  if (!notes.length || !h.some(Boolean)) return null;
  const corr = (p, t) => {
    const r = i => p[(i - t + 12) % 12], mx = h.reduce((a, b) => a + b) / 12, mp = p.reduce((a, b) => a + b) / 12;
    let num = 0, dx = 0, dp = 0;
    for (let i = 0; i < 12; i++) { num += (h[i] - mx) * (r(i) - mp); dx += (h[i] - mx) ** 2; dp += (r(i) - mp) ** 2; }
    return dx && dp ? num / Math.sqrt(dx * dp) : 0;
  };
  const all = [];
  for (let t = 0; t < 12; t++) {
    const home = last && ((last.midi % 12) + 12) % 12 === t ? 0.08 : 0;
    all.push({ tonic: t, minor: false, name: MAJOR_NAMES[t], score: corr(MAJOR_PROFILE, t) + home });
    all.push({ tonic: t, minor: true, name: MINOR_NAMES[t], score: corr(MINOR_PROFILE, t) + home - 0.02 });
  }
  all.sort((a, b) => b.score - a.score);
  const margin = all[0].score - all[1].score;
  return { ...all[0], margin, sure: margin > 0.05 && all[0].score > 0.5 };
}

// Chords in the key: [semitones above the tonic, minor?]. Minor keys use a
// major V (it pulls home). The order follows how often songs use them.
const MAJOR_CHORDS = [[0, false], [5, false], [7, false], [9, true], [2, true], [4, true]];
const MINOR_CHORDS = [[0, true], [8, false], [3, false], [10, false], [7, false], [5, true]];
// How naturally one chord follows another (by degree in the lists above).
const MOVE = { "0>1": 0.3, "0>2": 0.3, "0>3": 0.25, "1>2": 0.3, "1>0": 0.25, "2>0": 0.4, "2>3": 0.2, "3>1": 0.3, "3>4": 0.2, "4>2": 0.35, "5>3": 0.2, "3>2": 0.1, "1>3": 0.1, "0>4": 0.1 };
export function chordName(pc, minor, flats) { return (flats ? NOTE_FLAT : NOTE_SHARP)[((pc % 12) + 12) % 12] + (minor ? "m" : ""); }

// The chords of a key, each with its tones (pitch classes).
function keyChords(key) {
  const flats = FLAT_KEYS.has(key.name);
  return (key.minor ? MINOR_CHORDS : MAJOR_CHORDS).map(([s, m], deg) => {
    const root = (key.tonic + s) % 12;
    return { deg, root, minor: m, tones: [root, (root + (m ? 3 : 4)) % 12, (root + 7) % 12], name: chordName(root, m, flats) };
  });
}
// How much of the sung time in a stretch is spent on each pitch class; a note
// starting the stretch counts a little extra (it's where the ear lands).
function weightsIn(ns, a, b) {
  const w = new Array(12).fill(0);
  ns.forEach((n, i) => {
    const over = Math.min(b, n.start + n.dur) - Math.max(a, n.start);
    if (over > 0) w[((n.midi % 12) + 12) % 12] += over + (n.start >= a - 0.01 && (i === 0 || ns[i - 1].start < a) ? 0.15 : 0);
  });
  return w;
}
// How well a chord holds the notes: chord tones count, others count against.
function fitOf(c, w) {
  const tot = w.reduce((x, y) => x + y, 0);
  if (!tot) return 0;
  let sc = 0;
  w.forEach((x, pc) => { if (x) sc += (c.tones.includes(pc) ? 1 : -0.6) * x + (pc === c.root ? 0.2 * x : 0); });
  return sc / tot;
}
// A line cut into 1 to 4 equal parts by length.
function slotsOf(ns) {
  if (!ns.length) return [{ at: 0, w: null }];
  const t0 = ns[0].start, t1 = ns[ns.length - 1].start + ns[ns.length - 1].dur;
  const k = Math.max(1, Math.min(4, Math.round((t1 - t0) / 2)));
  return Array.from({ length: k }, (_, j) => {
    const a = t0 + (t1 - t0) * j / k, b = t0 + (t1 - t0) * (j + 1) / k;
    return { at: a, end: b, w: weightsIn(ns, a, b), lineEnd: j === k - 1 };
  });
}
const moveScore = (p, c, sameLine) => (p.deg === c.deg ? (sameLine ? 0.05 : 0.15) : MOVE[`${p.deg}>${c.deg}`] || 0);

// Rich style: a chord gains a 7th or 9th the melody sings, and the V chord
// becomes a V7 (it leads home more strongly).
const SHARE = 0.15;
export function richName(c, w, key) {
  const tot = (w || []).reduce((x, y) => x + y, 0) || 1, has = s => (w ? w[(c.root + s) % 12] / tot : 0) >= SHARE;
  const isV = c.deg === (key.minor ? 4 : 2);
  if (c.minor) return c.name + (has(10) ? "7" : "");
  if (has(11) && !isV) return c.name + "maj7";
  if (has(10) || isV) return c.name + "7";
  if (has(2)) return c.name + "add9";
  return c.name;
}

// lines: [{ notes }] (note times from the start of that line). Each part of a
// line gets the chord whose notes it holds best, with smooth moves between
// chords preferred (a Viterbi path over the whole song). style: "simple" (the
// three-note chords) or "rich". Returns, per line, [{ chord, at }] in seconds.
export function harmonize(lines, key, { style = "simple" } = {}) {
  if (!key) return lines.map(() => []);
  const cands = keyChords(key);
  const slots = lines.flatMap((ln, li) => slotsOf(ln.notes || []).map(s => ({ ...s, li })));
  const N = slots.length, C = cands.length;
  const best = slots.map(() => new Array(C).fill(-Infinity)), from = slots.map(() => new Array(C).fill(0));
  slots.forEach((s, i) => cands.forEach((c, ci) => {
    let e = (s.w ? fitOf(c, s.w) : 0) - c.deg * 0.02;
    if (i === 0 && c.deg === 0) e += 0.4;
    if (i === N - 1 && c.deg === 0) e += 0.5;
    if (s.lineEnd && (c.deg === 0 || c.deg === 2)) e += 0.1;
    if (i === 0) { best[0][ci] = e; return; }
    cands.forEach((p, pi) => {
      const v = best[i - 1][pi] + e + moveScore(p, c, s.li === slots[i - 1].li);
      if (v > best[i][ci]) { best[i][ci] = v; from[i][ci] = pi; }
    });
  }));
  let ci = best[N - 1].indexOf(Math.max(...best[N - 1]));
  const path = new Array(N);
  for (let i = N - 1; i >= 0; i--) { path[i] = ci; ci = from[i][ci]; }
  const out = lines.map(() => []);
  slots.forEach((s, i) => {
    const c = cands[path[i]], name = style === "rich" ? richName(c, s.w, key) : c.name, row = out[s.li];
    if (!row.length || row[row.length - 1].chord !== name) row.push({ chord: name, at: s.at });
  });
  return out;
}

// Chords for a stretch of melody, best fit first: how well each holds the
// notes (0 to 1) and which of its notes were sung, longest first.
export function chordFit(notes, key) {
  if (!key || !notes.length) return [];
  const a = notes[0].start, b = notes[notes.length - 1].start + notes[notes.length - 1].dur;
  const w = weightsIn(notes, a, b), flats = FLAT_KEYS.has(key.name);
  return keyChords(key).map(c => ({
    chord: c.name,
    fit: Math.max(0, Math.min(1, (fitOf(c, w) + 0.2) / 1.4)),
    holds: c.tones.filter(t => w[t] > 0).sort((x, y) => w[y] - w[x]).map(t => (flats ? NOTE_FLAT : NOTE_SHARP)[t])
  })).sort((x, y) => y.fit - x.fit);
}

// Other ways to play one line: the best few chord paths through its parts
// (each part trying its three best-fitting chords), most natural first.
export function lineOptions(notes, key, { count = 3, style = "simple" } = {}) {
  if (!key || !notes.length) return [];
  const cands = keyChords(key), slots = slotsOf(notes);
  const tops = slots.map(s => cands.map(c => ({ c, e: fitOf(c, s.w) - c.deg * 0.02 + (s.lineEnd && (c.deg === 0 || c.deg === 2) ? 0.1 : 0) })).sort((x, y) => y.e - x.e).slice(0, 3));
  let paths = [{ list: [], score: 0 }];
  tops.forEach(opts => {
    paths = paths.flatMap(p => opts.map(o => ({ list: [...p.list, o.c], score: p.score + o.e + (p.list.length ? moveScore(p.list[p.list.length - 1], o.c, true) : 0) })));
  });
  const seen = new Set(), out = [];
  for (const p of paths.sort((x, y) => y.score - x.score)) {
    const changes = [];
    p.list.forEach((c, j) => { const name = style === "rich" ? richName(c, slots[j].w, key) : c.name; if (!changes.length || changes[changes.length - 1].chord !== name) changes.push({ chord: name, at: slots[j].at }); });
    const label = changes.map(x => x.chord).join(" · ");
    if (seen.has(label)) continue;
    seen.add(label); out.push({ changes, label });
    if (out.length === count) break;
  }
  return out;
}

// Rough syllables in a word (vowel groups, a silent final e dropped).
export function syllables(word) {
  const w = String(word).toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const n = (w.replace(/e$/, "").match(/[aeiouy]+/g) || []).length;
  return Math.max(1, n);
}

// One line as a chord line over its words. Sung notes stand in for syllables:
// a chord that changes at the k-th note of n goes over the word holding the
// matching share of the line's syllables.
// Which word each chord change falls on (an index; past the last word when
// there are more chords than words).
export function chordWords(words, notes, changes) {
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  const syl = ws.map(syllables), total = syl.reduce((a, b) => a + b, 0) || ws.length;
  const wordAtSyl = s => { let acc = 0; for (let i = 0; i < ws.length; i++) { acc += syl[i] || 1; if (s < acc) return i; } return ws.length - 1; };
  const at = changes.map((c, i) => {
    if (i === 0) return 0;
    let k = notes.findIndex(n => n.start >= c.at - 0.05);
    if (k < 0) k = notes.length - 1;
    return wordAtSyl(Math.floor(k * total / Math.max(1, notes.length)));
  });
  for (let i = 1; i < at.length; i++) if (at[i] <= at[i - 1]) at[i] = at[i - 1] + 1;
  return at;
}
export function chordLine(words, notes, changes) {
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  if (!changes.length) return ws.join(" ");
  if (!ws.length) return changes.map(c => c.chord).join("   ");
  const at = chordWords(words, notes, changes);
  const lyric = ws.join(" ");
  const starts = []; let pos = 0;
  ws.forEach(w => { starts.push(pos); pos += w.length + 1; });
  let line = "";
  changes.forEach((c, i) => {
    if (at[i] >= ws.length) { line += (line ? " " : "") + c.chord; return; } /* more chords than words: they follow */
    const col = Math.max(starts[at[i]], line.length ? line.length + 1 : 0);
    line = line.padEnd(col, " ") + c.chord;
  });
  return line + "\n" + lyric;
}

// The whole sketch as a chord sheet, its key, and the sketch itself kept with
// the song (notes as [midi, start, length], to a hundredth of a second) so its
// chords can be restyled and swapped later.
const r2 = x => Math.round(x * 100) / 100;
export const packNotes = notes => notes.map(n => [n.midi, r2(n.start), r2(n.dur)]);
export const unpackNotes = packed => (packed || []).map(([midi, start, dur]) => ({ midi, start, dur }));
export function sketchSong(lines, { style = "simple" } = {}) {
  const all = lines.flatMap(l => l.notes || []);
  const key = detectKey(all);
  const changes = harmonize(lines, key, { style });
  const body = lines.map((l, i) => chordLine(l.words, l.notes || [], changes[i])).join("\n");
  return { key: key ? key.name : "", sure: !!key?.sure, body, sketch: { v: 1, key: key ? key.name : "", style, lines: lines.map(l => ({ n: packNotes(l.notes || []) })) } };
}
// The key object for a sketch's saved key name.
export function sketchKey(name) {
  const m = /^([A-G][#b]?)(m?)$/.exec(name || "");
  if (!m) return null;
  const tonic = (m[2] ? MINOR_NAMES : MAJOR_NAMES).indexOf(name);
  const pc = tonic >= 0 ? tonic : NOTE_SHARP.indexOf(m[1]) >= 0 ? NOTE_SHARP.indexOf(m[1]) : NOTE_FLAT.indexOf(m[1]);
  return { tonic: pc, minor: !!m[2], name };
}
// The song's lines that were sung, in order (with or without words), from its
// current text, so edits to the words are kept.
export function sungLines(body, count) {
  return chordModel(body).filter(l => l.kind === "lyric" || l.kind === "chords").slice(0, count);
}
// Replace sung line k's chords (and keep its words) in the body.
export function setSungLine(body, k, chordsText) {
  const lines = String(body || "").replace(/\r\n?/g, "\n").split("\n");
  const ln = sungLines(body, k + 1)[k];
  if (!ln) return body;
  const from = ln.kind === "lyric" && ln.chordLine >= 0 ? ln.chordLine : ln.i;
  lines.splice(from, ln.i - from + 1, ...chordsText.split("\n"));
  return lines.join("\n");
}
const lineWords = ln => (ln.kind === "lyric" ? ln.text : "");
// Every sung line re-chorded in a style, keeping the current words.
export function restyle(body, sketch, style) {
  const key = sketchKey(sketch?.key);
  if (!key) return body;
  const lines = sketch.lines.map(l => ({ notes: unpackNotes(l.n) }));
  const sung = sungLines(body, lines.length);
  const changes = harmonize(lines, key, { style });
  let out = body;
  for (let k = Math.min(sung.length, lines.length) - 1; k >= 0; k--) out = setSungLine(out, k, chordLine(lineWords(sung[k]), lines[k].notes, changes[k]));
  return out;
}
// The melody under one word of sung line k: from that word to the next chord
// change (or the line's end), by the same syllable estimate used to place chords.
export function notesUnder(body, sketch, k, pos) {
  const ln = sungLines(body, k + 1)[k], notes = unpackNotes(sketch?.lines?.[k]?.n);
  if (!ln || !notes.length) return notes;
  const ws = [...String(ln.text || "").matchAll(/\S+/g)];
  if (!ws.length) return notes;
  const syl = ws.map(m => syllables(m[0]) || 1), total = syl.reduce((a, b) => a + b, 0);
  const wordAt = p => { let w = 0; ws.forEach((m, i) => { if (m.index <= p) w = i; }); return w; };
  const sylBefore = w => syl.slice(0, w).reduce((a, b) => a + b, 0);
  const w0 = wordAt(pos), nextChord = (ln.chords || []).map(c => c.pos).filter(p => p > ws[w0].index).sort((a, b) => a - b)[0];
  const w1 = nextChord === undefined ? ws.length : Math.max(w0 + 1, wordAt(nextChord));
  const i0 = Math.floor(sylBefore(w0) * notes.length / total), i1 = Math.max(i0 + 1, Math.floor(sylBefore(w1) * notes.length / total));
  return notes.slice(i0, i1);
}

// ---- While sketching: how sure the key is, its chords, and a nudge per line ----
// Key confidence as 0 to 5 bars: how far the best key leads the next one, held
// back until enough has been sung.
export function keyConfidence(notes) {
  if (notes.length < 3) return { key: null, bars: 0, state: "listening" };
  const key = detectKey(notes);
  if (!key) return { key: null, bars: 0, state: "listening" };
  let bars = Math.max(1, Math.min(5, Math.round(key.margin / 0.03) + 1));
  if (notes.length < 8) bars = Math.min(bars, 3);
  if (notes.length < 5) bars = Math.min(bars, 2);
  return { key, bars, state: bars >= 5 ? "sure" : bars >= 2 ? "getting surer" : "listening" };
}
// The key's six chords: the three major (or minor) ones first, then their partners.
export const keyFamily = key => (key ? keyChords(key).map(c => c.name) : []);
// How much of the singing is on each pitch class (shares of the total time).
export function pitchShares(notes) {
  const w = new Array(12).fill(0);
  notes.forEach(n => { w[((n.midi % 12) + 12) % 12] += n.dur; });
  const tot = w.reduce((a, b) => a + b, 0) || 1;
  return w.map(x => x / tot);
}
// A nudge for one line: where a different chord holds the melody clearly better
// than the chosen one (the chosen path also weighs smooth moves, so they can
// differ). At most one per line: the clearest.
export function lineHint(words, notes, changes, key) {
  if (!key || !notes.length || !changes.length) return null;
  const ws = String(words || "").trim().split(/\s+/).filter(Boolean);
  const at = chordWords(words, notes, changes);
  let best = null;
  changes.forEach((c, j) => {
    const end = changes[j + 1]?.at ?? Infinity, seg = notes.filter(n => n.start >= c.at - 0.01 && n.start < end);
    if (seg.length < 2) return;
    const fits = chordFit(seg, key), top = fits[0], cur = fits.find(f => f.chord === c.chord.replace(/(maj7|7|add9)$/, ""));
    const gain = top.fit - (cur ? cur.fit : 0);
    if (top.chord !== c.chord && gain >= 0.12 && (!best || gain > best.gain)) {
      const w = at[j] < ws.length ? ws.slice(at[j], at[j] + 2).join(" ") : "";
      best = { j, chord: top.chord, gain, words: w, minor: /m$/.test(top.chord) && !/m$/.test(c.chord), major: !/m$/.test(top.chord) && /m$/.test(c.chord) };
    }
  });
  return best;
}

// ---------- Add the words: a chord chart's chords over lyrics you paste ----------
// A chart (from Chord chart) has sections of chords and no words. Your pasted
// lyrics come in stanzas (blank lines between them), with or without names
// like [Chorus] or "Verse 2:". Walking the chart in order, each sung section
// takes the next stanza (one of its kind, when the stanza is named); the
// section's chords run through its lines, two to a line, looping as the song
// does. Intros, solos and outros stay as chord lines. Stanzas left over go at
// the end with their kind's chords.
const KINDS = { verse: "verse", "pre-chorus": "pre", prechorus: "pre", chorus: "chorus", refrain: "chorus", hook: "chorus", bridge: "bridge", tag: "chorus", coda: "outro", outro: "outro", ending: "outro", intro: "intro", solo: "solo", interlude: "solo", instrumental: "solo", break: "solo", riff: "intro" };
const kindOf = name => KINDS[String(name || "").toLowerCase().replace(/\s*\d+$/, "").replace(/\s+/g, "-").replace(/^pre-?chorus$/, "pre-chorus")] || "";
const SUNG = new Set(["verse", "pre", "chorus", "bridge"]);
function chartSections(body) {
  const head = [], secs = [];
  let cur = null;
  for (const line of String(body || "").split("\n")) {
    const sec = line.match(SECTION_RE);
    if (sec) { const name = (sec[1] || sec[2] || "").replace(/\s*\(x\d+\)\s*$/i, "").trim(); cur = { name, kind: kindOf(name), chords: [] }; secs.push(cur); continue; }
    if (!line.trim()) continue;
    if (cur && isChordLine(line)) cur.chords.push(...line.trim().split(/\s+/).filter(isChord));
    else if (!cur) head.push(line);
  }
  return { head, secs: secs.filter(s => s.chords.length) };
}
export function lyricStanzas(text) {
  const out = [];
  let cur = null;
  for (let raw of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { cur = null; continue; }
    const named = line.match(/^\[([^\]]+)\]$/) || line.match(/^\(?((?:intro|verse|pre-?chorus|chorus|bridge|outro|refrain|hook|tag)(?:\s*\d+)?)\)?\s*:?$/i);
    if (named) { cur = { name: named[1].replace(/\s*[x×]\s*\d+$/i, "").trim(), kind: kindOf(named[1].replace(/\s*[x×]\s*\d+$/i, "").replace(/\s*:\s*.*$/, "")), lines: [] }; out.push(cur); continue; }
    if (!cur) { cur = { name: "", kind: "", lines: [] }; out.push(cur); }
    cur.lines.push(line);
  }
  return out.filter(s => s.lines.length);
}
// One stanza under a progression: two chords a line (or one, for a one-chord
// progression), the second over the middle of the line, looping.
function stanzaLines(lines, chords) {
  const out = [];
  let at = 0;
  const per = chords.length === 1 ? 1 : 2;
  for (const line of lines) {
    const words = [...line.matchAll(/\S+/g)];
    const take = Array.from({ length: per }, () => chords[at++ % chords.length]);
    const cols = per === 1 || words.length < 2 ? [0] : [0, words[Math.floor(words.length / 2)].index];
    let row = "";
    take.slice(0, cols.length).forEach((c, i) => { row = row.padEnd(i ? Math.max(cols[i], row.length + 1) : 0, " ") + c; });
    if (cols.length < take.length) row += " " + take.slice(cols.length).join(" ");
    out.push(row, line);
  }
  return out;
}
export function mergeWords(chartBody, lyricsText) {
  const { head, secs } = chartSections(chartBody);
  const stanzas = lyricStanzas(lyricsText);
  if (!secs.length || !stanzas.length) return null;
  const out = [...head];
  if (head.length) out.push("");
  const byKind = k => secs.find(s => s.kind === k) || secs.find(s => SUNG.has(s.kind)) || secs[0];
  const left = [...stanzas];
  const emit = (name, lines) => { out.push(`[${name}]`, ...lines, ""); };
  for (const sec of secs) {
    if (!SUNG.has(sec.kind) && sec.kind) { emit(sec.name, [sec.chords.join("   ")]); continue; }
    const i = left.findIndex(st => !st.kind || st.kind === sec.kind);
    if (i < 0) continue;
    /* An unnamed stanza takes the next sung section; a named one waits for its kind. */
    if (left[i].kind === "" || i === 0 || left.slice(0, i).every(st => st.kind && st.kind !== sec.kind)) {
      const st = left.splice(i, 1)[0];
      emit(st.name || sec.name, stanzaLines(st.lines, sec.chords));
    }
  }
  for (const st of left) { const sec = byKind(st.kind); emit(st.name || sec.name, stanzaLines(st.lines, sec.chords)); }
  return out.join("\n").trim();
}

// ---- Get the song ----
// LRCLIB returns many recordings of a song (album, live, covers, karaoke).
// pickVersions ranks the ones that have words: the title and artist must match;
// then the one closest to the length the chart found (within 4 seconds); with
// no length, the length most versions share (the album cut is copied most);
// studio before live, covers or karaoke unless the title asks for them; timed
// words before plain. Duplicates (same album and length) are dropped.
const normT = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)|\[.*?\]/g, " ").replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
const ODD = /\b(live|karaoke|cover|tribute|remix|instrumental|drumless|backing|acapella|a cappella|sped up|slowed|demo|8 ?bit|lullaby|piano version|re ?recorded)\b/;
export function pickVersions(list, { title = "", artist = "", duration = 0 } = {}) {
  const t = normT(title), a = normT(artist);
  const ok = (list || []).filter(x => x && !x.instrumental && (x.plainLyrics || "").trim()
    && (!t || normT(x.trackName).includes(t) || t.includes(normT(x.trackName)))
    && (!a || normT(x.artistName).includes(a) || a.includes(normT(x.artistName))));
  const seen = new Set(), uniq = [];
  for (const x of ok) { const k = normT(x.albumName) + "|" + Math.round(x.duration || 0); if (!seen.has(k)) { seen.add(k); uniq.push(x); } }
  const counts = {};
  ok.forEach(x => { const d = Math.round(x.duration || 0); for (let k = d - 2; k <= d + 2; k++) counts[k] = (counts[k] || 0) + 1; });
  const common = +Object.keys(counts).sort((p, q) => counts[q] - counts[p] || p - q)[0] || 0;
  const want = duration > 0 ? duration : common;
  const low = v => String(v || "").toLowerCase();
  const odd = x => !ODD.test(low(title)) && ODD.test(low(x.albumName + " " + x.trackName));
  const score = x => (Math.abs((x.duration || 0) - want) <= 4 ? 0 : 1000 + Math.abs((x.duration || 0) - want)) + (odd(x) ? 500 : 0) + (x.syncedLyrics ? 0 : 5);
  return uniq.sort((p, q) => score(p) - score(q));
}
// The chart's tempo (from chord sites) against a measured one (GetSongBPM).
// They agree within 4%, or when one counts double time. The measured tempo
// wins when they disagree; in double time the chart's count stands.
export function tempoPick(chart, measured) {
  chart = +chart || 0; measured = +measured || 0;
  const near = (p, q) => Math.abs(p - q) <= q * 0.04;
  if (!measured) return { bpm: Math.round(chart), agree: false, measured: 0, chart };
  if (!chart) return { bpm: Math.round(measured), agree: false, measured, chart };
  if (near(chart, measured)) return { bpm: Math.round(measured), agree: true, measured, chart };
  if (near(chart, measured * 2) || near(chart, measured / 2)) return { bpm: Math.round(chart), agree: true, measured, chart };
  return { bpm: Math.round(measured), agree: false, measured, chart };
}
// Beats in a bar from a time signature like "3/4" (2 to 12; 4 otherwise).
export function beatsOf(sig) {
  const n = parseInt(String(sig || "").split("/")[0], 10);
  return n >= 2 && n <= 12 ? n : 4;
}

// ---------- Your playing: the journal behind the profile page ----------
// The play log keeps only 60 days, so the profile has its own small, lifetime
// journal (data.journal), updated as you play. It holds counts, never a list
// of every play, so it stays small however long you use the app:
//   since     the first day it covers
//   secs      seconds of playing (scrolling a song, finished or not)
//   chords    { G: { n, first } }: plays that used the chord, and the day of the first
//   changes   { "C|G": n }: switches made between two chords
//   keys      { G: n }: plays by the key the song sounds in
//   months    { "2026-10": { plays, secs, bpm, bpmN } }
//   week      168 counts, one per hour of the week (Sunday midnight first)
//   best      the longest streak in days
//   firsts    the latest milestones: [{ kind: "chord" | "got", name, at }]
//   tune      { n, checked: [6], drift: [6] }: tuner sessions, and per string how
//             often it was checked and how often it had drifted more than 5 cents
//   seeded    the day it was first worked out from the songs already played;
//             numbers from before then are estimates
const monthKey = t => dayKey(t).slice(0, 7);
// The chords a song puts under your fingers, in the shapes you play.
const shapesOf = song => {
  const steps = shapeSteps(song);
  return chordsUsed(song.body || "").map(c => transposeChord(c, steps, /^[A-G]b/.test(c)));
};
const soundingKey = song => transposeKey(song.key || guessKey(song.body || ""), song.transpose || 0);
const playedSecs = song => song.duration || 210;
export function journalOf(data, now = Date.now()) {
  if (data.journal && typeof data.journal === "object" && data.journal.v === 1) {
    /* From a backup it may be hand-edited: put back anything missing or the wrong shape. */
    const j = data.journal, obj = v => v && typeof v === "object" && !Array.isArray(v), six = v => Array.isArray(v) && v.length === 6 ? v.map(x => +x || 0) : Array(6).fill(0);
    for (const k of ["chords", "changes", "keys", "months"]) if (!obj(j[k])) j[k] = {};
    if (!Array.isArray(j.week) || j.week.length !== 168) j.week = Array(168).fill(0);
    if (!Array.isArray(j.firsts)) j.firsts = [];
    if (!obj(j.tune)) j.tune = {};
    j.tune = { n: +j.tune.n || 0, checked: six(j.tune.checked), drift: six(j.tune.drift) };
    j.secs = +j.secs || 0; j.best = +j.best || 0;
    if (typeof j.since !== "string") j.since = dayKey(now);
    return j;
  }
  const j = { v: 1, since: dayKey(now), seeded: dayKey(now), secs: 0, chords: {}, changes: {}, keys: {}, months: {}, week: Array(168).fill(0), best: 0, firsts: [], tune: { n: 0, checked: Array(6).fill(0), drift: Array(6).fill(0) } };
  /* Worked out once from what's already in the library: total plays per song,
     the days still in the play log, and when each song was added. */
  for (const s of data.songs || []) {
    const n = playCount(s);
    const days = Object.keys(s.playLog?.days || {}).sort();
    const start = [s.created && s.created.slice(0, 10), days[0]].filter(Boolean).sort()[0];
    if (start && start < j.since) j.since = start;
    if (!n || s.format === "tab") continue;
    j.secs += n * playedSecs(s);
    for (const c of shapesOf(s)) {
      const x = j.chords[c] || (j.chords[c] = { n: 0, first: start || j.seeded });
      x.n += n; if (start && start < x.first) x.first = start;
    }
    for (const [k, x] of songChanges(s)) j.changes[k] = (j.changes[k] || 0) + x.n * n;
    const key = soundingKey(s); if (key) j.keys[key] = (j.keys[key] || 0) + n;
    for (const [d, c] of Object.entries(s.playLog?.days || {})) {
      const m = j.months[d.slice(0, 7)] || (j.months[d.slice(0, 7)] = { plays: 0, secs: 0, bpm: 0, bpmN: 0 });
      m.plays += c; m.secs += c * playedSecs(s);
      if (s.bpm) { m.bpm += s.bpm * c; m.bpmN += c; }
    }
  }
  j.best = streakOf(data.songs || [], now).days;
  data.journal = j;
  return j;
}
// A song played to its end: its chords, changes, key, tempo, and when.
export function journalPlay(data, song, now = Date.now()) {
  const j = journalOf(data, now), day = dayKey(now), d = new Date(now);
  const m = j.months[monthKey(now)] || (j.months[monthKey(now)] = { plays: 0, secs: 0, bpm: 0, bpmN: 0 });
  m.plays++;
  if (song.bpm) { m.bpm += song.bpm; m.bpmN++; }
  j.week[d.getDay() * 24 + d.getHours()]++;
  if (song.format !== "tab") {
    for (const c of new Set(shapesOf(song))) {
      if (!j.chords[c]) { j.chords[c] = { n: 0, first: day }; j.firsts.unshift({ kind: "chord", name: c, at: day }); }
      j.chords[c].n++;
    }
    for (const [k, x] of songChanges(song)) j.changes[k] = (j.changes[k] || 0) + x.n;
    const key = soundingKey(song); if (key) j.keys[key] = (j.keys[key] || 0) + 1;
  }
  j.best = Math.max(j.best || 0, streakOf(data.songs, now).days);
  j.firsts = j.firsts.slice(0, 40);
}
// Time spent playing: the seconds a song scrolled, whether or not it finished.
export function journalTime(data, secs, now = Date.now()) {
  if (!(secs > 1)) return;
  const j = journalOf(data, now), m = j.months[monthKey(now)] || (j.months[monthKey(now)] = { plays: 0, secs: 0, bpm: 0, bpmN: 0 });
  const s = Math.min(secs, 3600);
  j.secs += s; m.secs += s;
  /* per day too, for the last 60 days: your daily average on the Tour Map */
  const days = j.days && typeof j.days === "object" ? j.days : (j.days = {});
  if (!j.daysFrom) j.daysFrom = dayKey(now);
  days[dayKey(now)] = (days[dayKey(now)] || 0) + s;
  pruneDays(days, now);
}
/* Practice (3.19.0): lessons, drills and What I hear in the Neck, and looping a section on a song.
   It counts as time on guitar, and every PRACTICE_PLAY seconds of it counts as a play on the Tour Map. */
export const PRACTICE_PLAY = 240;
export function journalPractice(data, secs, now = Date.now()) {
  if (!(secs > 1)) return;
  journalTime(data, secs, now);
  const m = journalOf(data, now).months[monthKey(now)];
  m.psecs = (m.psecs || 0) + Math.min(secs, 3600);
}
// A tuner session: for each string checked, how far off it was when first heard.
export function journalTune(data, firstCents, now = Date.now()) {
  const j = journalOf(data, now);
  if (!firstCents.some(c => typeof c === "number")) return;
  j.tune.n++;
  firstCents.forEach((c, i) => { if (typeof c !== "number" || i > 5) return; j.tune.checked[i]++; if (Math.abs(c) > 5) j.tune.drift[i]++; });
}
// A song marked "Got it" is a milestone, and counts toward your repertoire.
export function journalGot(data, song, now = Date.now()) {
  const j = journalOf(data, now);
  song.gotAt = song.gotAt || new Date(now).toISOString();
  j.firsts.unshift({ kind: "got", name: song.title, at: dayKey(now) });
  j.firsts = j.firsts.slice(0, 40);
}
// The chords that tend to come next for a player, easiest first; the
// passport suggests the first one you haven't played.
const NEXT_STAMPS = ["G", "C", "D", "Em", "Am", "E", "A", "Dm", "Cadd9", "Dsus4", "E7", "A7", "D7", "G7", "B7", "Asus2", "Fmaj7", "F", "Bm", "F#m", "Bb", "C#m", "Gm", "Cm"];
const BARRES = new Set(["F", "Bm", "F#m", "Bb", "B", "C#m", "Gm", "Cm", "G#m", "Fm", "Ab", "Eb", "Db"]);
export const isBarre = c => BARRES.has(String(c).replace(/\/.*$/, ""));
// Everything the profile page shows, worked out from the library and journal.
export function profileOf(data, now = Date.now()) {
  const j = journalOf(data, now), songs = data.songs || [];
  const played = songs.filter(s => playCount(s) > 0);
  const chords = Object.entries(j.chords).map(([name, x]) => ({ name, n: x.n, first: x.first, barre: isBarre(name) })).sort((a, b) => a.first < b.first ? -1 : a.first > b.first ? 1 : b.n - a.n);
  const nextStamp = NEXT_STAMPS.find(c => !j.chords[c]) || "";
  const changes = Object.entries(j.changes).map(([k, n]) => ({ a: k.split("|")[0], b: k.split("|")[1], n })).sort((x, y) => y.n - x.n);
  const keys = Object.entries(j.keys).map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n);
  const months = Object.keys(j.months).sort();
  const tempo = months.filter(m => j.months[m].bpmN).map(m => ({ m, bpm: j.months[m].bpm / j.months[m].bpmN, n: j.months[m].bpmN }));
  const avg = xs => { const n = xs.reduce((a, x) => a + x.n, 0); return n ? xs.reduce((a, x) => a + x.bpm * x.n, 0) / n : 0; };
  const recent = tempo.slice(-3), earlier = tempo.slice(0, -3);
  /* When you play: four parts of the day for each weekday. */
  const parts = [[5, 12, "mornings"], [12, 17, "afternoons"], [17, 22, "evenings"], [22, 29, "late nights"]];
  const grid = Array.from({ length: 7 }, (_, d) => parts.map(([a, b]) => { let n = 0; for (let h = a; h < b; h++) n += j.week[d * 24 + (h % 24)] || 0; return n; }));
  let top = null;
  grid.forEach((row, d) => row.forEach((n, p) => { if (n && (!top || n > top.n)) top = { d, p, n }; }));
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestMonth = months.reduce((b, m) => !b || j.months[m].plays > j.months[b].plays ? m : b, "");
  /* Repertoire: songs you've got, month by month for the last year. */
  const gotAt = s => s.status === "got" ? (s.gotAt || s.created || "").slice(0, 7) : "";
  const now0 = new Date(now), ym = i => { const d = new Date(now0.getFullYear(), now0.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  const repertoire = Array.from({ length: 13 }, (_, i) => { const m = ym(12 - i); return { m, n: songs.filter(s => gotAt(s) && gotAt(s) <= m).length }; });
  /* Comfort zone: what you play most. Dropped: tried once or twice, not in three weeks. */
  const comfort = played.filter(s => playCount(s) >= 3).sort((a, b) => playCount(b) - playCount(a)).slice(0, 3).map(s => ({ id: s.id, title: s.title, n: playCount(s) }));
  const dropped = played.filter(s => playCount(s) <= 2 && s.status !== "got" && now - (s.playLog?.last || 0) > 21 * DAY).sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0)).slice(0, 3).map(s => ({ id: s.id, title: s.title, n: playCount(s) }));
  /* Sets: the one played through most, and songs that sit next to each other in more than one set. */
  const sets = (data.sets || []).map(x => ({ id: x.id, name: x.name || "Set", runs: (x.runs || []).length })).sort((a, b) => b.runs - a.runs);
  const pairs = new Map(), title = id => songs.find(s => s.id === id)?.title;
  for (const x of data.sets || []) for (let i = 1; i < (x.songIds || []).length; i++) {
    const a = x.songIds[i - 1], b = x.songIds[i]; if (!title(a) || !title(b)) continue;
    const k = [a, b].sort().join("|"); pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  const together = [...pairs].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, n]) => ({ a: title(k.split("|")[0]), b: title(k.split("|")[1]), n }));
  const names = ["low E", "A", "D", "G", "B", "high e"];
  const drift = j.tune.checked.map((c, i) => ({ string: names[i], checked: c, rate: c ? j.tune.drift[i] / c : 0 }));
  const worst = drift.filter(x => x.checked >= 3).sort((a, b) => b.rate - a.rate)[0] || null;
  return {
    since: j.since, seeded: j.seeded,
    hours: j.secs / 3600, practiceSecs: Object.values(j.months || {}).reduce((a, m) => a + (m.psecs || 0), 0), plays: played.reduce((a, s) => a + playCount(s), 0), songsPlayed: played.length,
    got: songs.filter(s => s.status === "got").length,
    streak: streakOf(songs, now).days, best: Math.max(j.best || 0, streakOf(songs, now).days),
    chords, nextStamp, barres: chords.filter(c => c.barre).length, firsts: j.firsts.slice(0, 6),
    changes: changes.slice(0, 5),
    keys: keys.slice(0, 5), tempo: { avg: avg(tempo), recent: avg(recent), earlier: avg(earlier), months: tempo.slice(-12) },
    rhythm: { grid, top: top && `${DAYS[top.d]} ${parts[top.p][2]}`, bestMonth: bestMonth && { m: bestMonth, plays: j.months[bestMonth].plays } },
    repertoire, yearAgo: repertoire[0].n,
    comfort, dropped, sets: sets.filter(x => x.runs).slice(0, 1)[0] || null, together,
    tune: { sessions: j.tune.n, worst, drift }
  };
}

// ---------- The streak moment ----------
// Once a day, after the first song you finish, a full-screen celebration of the
// streak. This works out what it says: the count, the next milestone, a row of
// seven days (up to three before today, today, and the days ahead, with the
// milestone's day marked when it falls in the row), and how big the flame is.
export const STREAK_GOALS = [7, 30, 100, 365];
const DAY_ABBR = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
export function streakMoment(songs, now = Date.now(), best = 0) {
  const days = playDays(songs), n = streakOf(songs, now).days;
  const goal = STREAK_GOALS.find(g => g > n) || Math.ceil((n + 1) / 365) * 365;
  const hit = STREAK_GOALS.includes(n) || (n > 365 && n % 365 === 0);
  const before = Math.min(Math.max(n - 1, 0), 3);
  const slots = Array.from({ length: 7 }, (_, i) => {
    const t = now + (i - before) * DAY, d = new Date(t);
    return { label: DAY_ABBR[d.getDay()], on: i <= before && days.has(dayKey(t)), today: i === before, goal: i - before === goal - n ? goal : hit && i === before ? n : 0 };
  });
  const tier = n >= 30 ? 3 : n >= 7 ? 2 : n >= 3 ? 1 : 0;
  const plural = (k, w) => `${k} ${w}${k === 1 ? "" : "s"}`;
  const lead = n === 1 ? "Day one." : n === 7 ? "A full week in a row." : `${n} days in a row.`;
  const goalName = goal === 7 ? "a full week" : `${goal} days`;
  const next = n === 1 ? "Play tomorrow to start a streak." : hit ? `Next up: ${goalName}.` : `${plural(goal - n, "more day")} to ${goalName}.`;
  return { n, goal, hit, slots, tier, lead, next, best: Math.max(best || 0, n) };
}

// ---------- Drum beats ----------
// The metronome's drum patterns. A pattern is a rule for what hits on each
// pulse (a beat; an eighth note in 6/8), so the audio code only plays hits.
export const DRUM_BEATS = [["auto", "Auto"], ["rock", "Rock"], ["half", "Half time"], ["ballad", "Ballad"], ["four", "Four on the floor"]];
export const DRUM_SWING = { straight: 0.5, light: 0.58, full: 0.667 };
export const drumBeatName = style => ({ six8: "6/8", waltz: "Waltz" }[style] || DRUM_BEATS.find(([k]) => k === style)?.[1] || "Rock");
/* Which pattern plays. 6 and 12 beats are compound time and 3, 5, 7 and 9 are
   odd, and those keep their own patterns whatever is picked. Auto goes by the
   song: fingerpicked and slow gets the ballad, slow gets half time, fast gets
   four on the floor. Half time and the ballad need four beats. */
export function drumStyle(pick, { bpm = 90, beats = 4, body = "" } = {}) {
  if (beats === 6 || beats === 12) return "six8";
  if (beats % 2) return "waltz";
  let s = DRUM_BEATS.some(([k]) => k === pick && k !== "auto") ? pick : "auto";
  if (s === "auto") {
    const finger = /finger/i.test(String(body).slice(0, 200));
    s = finger && bpm < 110 ? "ballad" : bpm < 80 ? "half" : bpm >= 125 ? "four" : "rock";
  }
  return (s === "half" || s === "ballad") && beats !== 4 ? "rock" : s;
}
/* The hits on pulse b of a bar: { k: kind, at: where in the pulse (0 to 1),
   v: how hard }. swing is where the off-beat eighth lands (0.5 is straight). */
export function drumHits(style, b, beats = 4, swing = 0.5) {
  const hits = [], hit = (k, at, v) => hits.push({ k, at, v });
  if (style === "six8") {
    if (b % 3 === 0) hit((b / 3) % 2 === 0 ? "kick" : "snare", 0, (b / 3) % 2 === 0 ? 1 : 0.9);
    hit("hat", 0, b % 3 === 0 ? 0.9 : 0.5);
  } else if (style === "ballad") {
    if (b === 0) hit("kick", 0, 0.8);
    else if (b % 2 === 1) hit("stick", 0, 0.8);
    hit("hat", 0, 0.45);
  } else if (style === "four") {
    hit("kick", 0, b === 0 ? 1 : 0.85);
    if (beats === 4 && b % 2 === 1) hit("snare", 0, 0.55);
    hit("open", swing, 0.7);
  } else {
    const even = beats % 2 === 0;
    if (style === "half") { if (b === 0) hit("kick", 0, 1); else if (b === 2) hit("snare", 0, 1); }
    else if (b === 0 || (even && b === beats / 2)) hit("kick", 0, b === 0 ? 1 : 0.85);
    else hit("snare", 0, even ? 1 : 0.7);
    hit("hat", 0, b === 0 ? 1 : 0.8);
    hit("hat", swing, 0.55);
  }
  return hits;
}

// ---------- Drums that fit the song (3.23.0) ----------
// The AI writes one bar of 4/4 per kind of section (intro, verse, pre-chorus, chorus, bridge, solo,
// outro) and a fill, each part 16 sixteenth notes: "." rest, "x" hit, "X" accent, "o" soft (a ghost
// note), and on the hi-hat "O" for an open hat. The section on screen picks the bar; the bar before a
// new section plays the fill. Busier and Simpler change the bar, kept per song.
export const DRUM_PARTS = ["intro", "verse", "prechorus", "chorus", "bridge", "solo", "outro"];
export function partOf(name) {
  const n = String(name || "").toLowerCase();
  if (/pre.?chorus|build/.test(n)) return "prechorus";
  if (/chorus|refrain|hook/.test(n)) return "chorus";
  if (/bridge|middle/.test(n)) return "bridge";
  if (/solo|instrumental|interlude|break/.test(n)) return "solo";
  if (/intro/.test(n)) return "intro";
  if (/outro|ending|coda|tag/.test(n)) return "outro";
  return "verse";
}
const DRUM_ROW = { kick: /^[.xXo]{16}$/, snare: /^[.xXo]{16}$/, hat: /^[.xXoO]{16}$/ };
export function cleanDrums(raw) {
  if (!isObj(raw)) return null;
  const out = {};
  for (const part of [...DRUM_PARTS, "fill"]) {
    const p = raw[part];
    if (!isObj(p)) continue;
    const bar = {};
    for (const [k, re] of Object.entries(DRUM_ROW)) bar[k] = re.test(String(p[k] || "")) ? String(p[k]) : ".".repeat(16);
    if (Object.values(bar).some(r => /[^.]/.test(r))) out[part] = bar;
  }
  if (!out.verse && !out.chorus) return null;
  if (raw.level === -1 || raw.level === 1) out.level = raw.level;
  out.src = "ai";
  return out;
}
/* Simpler (-1): quarter-note hat, no ghost notes, the kick only where it is strong. Busier (+1): the
   hat fills to sixteenths (softly) and a ghost snare leads into beats 2 and 4. */
export function drumLevelBar(bar, level = 0) {
  if (!bar || !level) return bar;
  const map = (row, f) => [...row].map(f).join("");
  if (level < 0) return {
    kick: map(bar.kick, (c, i) => c === "X" || (c !== "." && i % 8 === 0) ? "x" : "."),
    snare: map(bar.snare, c => c === "o" ? "." : c),
    hat: map(bar.hat, (c, i) => i % 4 === 0 ? (c === "." ? "x" : c === "O" ? "x" : c) : ".")
  };
  return {
    kick: bar.kick,
    snare: map(bar.snare, (c, i) => c === "." && (i === 3 || i === 11) ? "o" : c),
    hat: map(bar.hat, c => c === "." ? "o" : c)
  };
}
/* The hits on pulse b (a quarter note) of a bar: { k, at (0 to 1 of the pulse), v }. The off-beat
   eighth moves with swing; the sixteenths around it follow. */
export function barHits(bar, b, swing = 0.5) {
  const hits = [], at = [0, swing / 2, swing, swing + (1 - swing) / 2];
  const vel = { x: 0.8, X: 1, o: 0.35, O: 0.7 };
  for (let j = 0; j < 4; j++) {
    const i = b * 4 + j;
    for (const k of ["kick", "snare", "hat"]) {
      const c = bar?.[k]?.[i];
      if (!c || c === ".") continue;
      hits.push({ k: k === "hat" && c === "O" ? "open" : k, at: at[j], v: k === "hat" ? vel[c] * 0.75 : vel[c] });
    }
  }
  return hits;
}

// ---------- Bass line ----------
// A bass that plays the root of each chord under the song. Everything here is
// pure: the app asks which chord the bass is on and what to play on each pulse.
export const BASS_STYLES = [["auto", "Auto"], ["root", "Root"], ["fifth", "Root and fifth"], ["pulse", "Pulse"], ["walk", "Walking"]];
/* How many semitones the sheet's chords sit below what you hear: the chart's
   capo while it is on, plus the capo from Make it easier. */
export const soundOffset = song => (song?.easier?.on ? song.easier.capo || 0 : 0) + (song?.capoOff ? 0 : bodyCapo(song?.body));
const BASS_LO = 38; /* D2: the bass sits between D2 and C#3, with room above for fifths */
const bassPitch = (pc, lo = BASS_LO) => lo + ((((pc - lo) % 12) + 12) % 12);
/* A chord's bass facts as pitch classes (0 to 11): the root, the note the bass
   plays (a slash chord names its own), and the third, fifth and sixth as
   semitones above the root. offset moves the shape to the sound. */
export function chordBass(name, offset = 0) {
  const m = String(name || "").match(CHORD_RE);
  if (!m) return null;
  const [, root, q, slash] = m;
  const r = ((NOTE_INDEX[root] + offset) % 12 + 12) % 12;
  const b = slash ? ((NOTE_INDEX[slash] + offset) % 12 + 12) % 12 : r;
  const minor = /^(m(?!aj)|min|-|dim|°|ø)/.test(q);
  const third = /^sus/.test(q) || q === "5" ? null : minor ? 3 : 4;
  const fifth = /^(dim|°|ø)|b5/.test(q) ? 6 : /^(aug|\+)|#5/.test(q) ? 8 : 7;
  const sixth = minor || (/7/.test(q) && !/maj7|M7/.test(q)) ? 10 : 9;
  return { root: r, bass: b, third, fifth, sixth };
}
/* Which pattern plays. A pick wins; Auto follows the drum beat, and a full
   swing walks. Walking needs four beats. */
export function bassStyle(pick, drum, beats = 4, swing = "straight", riff = "") {
  if (pick === "riff") return beats === 4 ? (validRiff(riff) ? "riff" : "pulse") : "fifth"; /* a riff is a bar of four beats */
  let s = BASS_STYLES.some(([k]) => k === pick && k !== "auto") ? pick : "auto";
  if (s === "auto") s = swing === "full" && beats === 4 ? "walk" : drum === "ballad" || drum === "half" ? "root" : drum === "six8" || drum === "waltz" ? "fifth" : "pulse";
  return s === "walk" && beats !== 4 ? "fifth" : s;
}
/* The notes on pulse b of a bar: { m: midi note, at: where in the pulse (0 to 1),
   len: how long, in pulses, v: how hard }. cur and next come from chordBass;
   next is the chord after this one (for the walk's approach note). */
export function bassHits(style, cur, next, b, beats = 4, swing = 0.5, riff = "") {
  if (!cur) return [];
  const hits = [], hit = (m, at, len, v) => hits.push({ m, at, len, v });
  const low = bassPitch(cur.bass), rootP = bassPitch(cur.root), fifthP = rootP + cur.fifth > 52 ? rootP + cur.fifth - 12 : rootP + cur.fifth;
  const compound = beats >= 6 && beats % 3 === 0, even = beats % 2 === 0 && !compound;
  if (style === "riff" && validRiff(riff) && beats === 4) {
    /* Each character is a sixteenth. The eighth-note off-beat moves with swing,
       and a note rings until the next one. */
    const pitch = { 1: low, 3: rootP + (cur.third ?? cur.fifth), 5: rootP + cur.fifth, 7: rootP + 10, 8: rootP + 12 };
    const at = i => (i < 2 ? i * swing / 2 : swing + (i - 2) * (1 - swing) / 2);
    for (let i = 0; i < 4; i++) {
      const k = b * 4 + i, c = riff[k];
      if (c === ".") continue;
      let n = k + 1;
      while (n < 16 && riff[n] === ".") n++;
      hit(pitch[c], at(i), Math.max(0.15, (n - k) / 4 * 0.9), i === 0 ? (b === 0 ? 1 : 0.9) : i === 2 ? 0.8 : 0.65);
    }
    return hits;
  }
  if (style === "walk") {
    if (b === 0) hit(low, 0, 0.9, 1);
    else if (b === 1) hit(rootP + (cur.third ?? cur.fifth), 0, 0.9, 0.75);
    else if (b === 2) hit(rootP + cur.fifth, 0, 0.9, 0.8);
    else if (b === 3) {
      if (!next || next.bass === cur.bass) hit(rootP + cur.sixth, 0, 0.9, 0.75);
      else {
        const prev = rootP + cur.fifth;
        let tgt = bassPitch(next.bass);
        for (let p = tgt; p <= 57; p += 12) if (Math.abs(p - prev) < Math.abs(tgt - prev)) tgt = p;
        const from = [tgt - 1, tgt + 1].sort((x, y) => Math.abs(x - prev) - Math.abs(y - prev) || x - y)[0];
        hit(from, 0, 0.9, 0.75);
      }
    }
  } else if (style === "pulse") {
    if (even) {
      hit(low, 0, 0.45, b === 0 ? 1 : 0.75);
      hit(low, swing, 0.4, 0.55);
    } else hit(low, 0, 0.5, b === 0 ? 1 : compound && b % 3 === 0 ? 0.8 : 0.6);
  } else if (style === "fifth") {
    if (compound) { if (b % 3 === 0) hit(b % 6 === 0 ? low : fifthP, 0, 2.7, b % 6 === 0 ? 1 : 0.8); }
    else if (even) { if (b === 0) hit(low, 0, beats / 2 * 0.9, 1); else if (b === beats / 2) hit(fifthP, 0, beats / 2 * 0.9, 0.8); }
    else hit(b === 0 ? low : fifthP, 0, 0.9, b === 0 ? 1 : 0.75);
  } else { /* root */
    if (b === 0) hit(low, 0, beats * 0.9, 1);
    else if (even && beats >= 4 && b === beats / 2) hit(low, 0, beats / 2 * 0.9, 0.6);
  }
  return hits;
}
/* Which chord the bass is on. rows are the sheet's chord rows, top to bottom:
   { lo, hi: their first and last chord, kind, r0, r1: where they sit on the
   page }, and L is the reading line on the same scale. Over lyrics ("line")
   the bass goes by how far the page has moved through the row, so a row's
   chords take turns. On a chord-only row ("bar") each chord gets a bar and
   the bass moves on by itself; the page only brings it back when it has drifted
   more than a row away, as after a loop or a scroll back. */
export function bassWhere(idx, rows, L, onBar) {
  if (!rows.length) return null;
  let at = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].r0 <= L) at = i;
  const row = rows[at];
  if (row.kind === "line") {
    const span = Math.max(1, (rows[at + 1] ? rows[at + 1].r0 : row.r1) - row.r0);
    return row.lo + Math.floor(Math.max(0, Math.min(0.999, (L - row.r0) / span)) * (row.hi - row.lo + 1));
  }
  if (idx == null || idx < (rows[at - 1] || row).lo || idx > (rows[at + 1] || row).hi) return row.lo;
  return onBar ? Math.min(idx + 1, rows[rows.length - 1].hi) : idx;
}

// ---------- A song's groove ----------
// What the drums and bass do for one song, found by the AI (or set in Edit) and
// kept on the song as song.groove = { beat, swing, bass, src }. Each part is
// optional: a part a song doesn't have comes from Settings. src is "ai" for
// what was found and "you" once you have changed it (a groove with only src
// "you" means: keep the defaults, don't look it up again).
export const GROOVE = { beat: ["rock", "half", "ballad", "four"], swing: ["straight", "light", "full"], bass: ["root", "fifth", "pulse", "walk", "riff"] };
/* A riff is one bar of a bass part in sixteenth notes, 16 characters, in
   degrees of whatever chord it is played on: "." no new note, 1 root, 3 third,
   5 fifth, 7 flat seventh, 8 root an octave up. */
export const RIFF_STEPS = [".", "1", "3", "5", "7", "8"];
export const validRiff = r => typeof r === "string" && /^[.13578]{16}$/.test(r) && /[13578]/.test(r);
export function cleanGroove(raw, src = raw?.src) {
  if (!isObj(raw)) return null;
  const g = { src: src === "ai" ? "ai" : "you" };
  for (const k of Object.keys(GROOVE)) if (GROOVE[k].includes(raw[k])) g[k] = raw[k];
  if (validRiff(raw.riff)) g.riff = raw.riff;
  if (g.bass === "riff" && !g.riff) delete g.bass; /* a riff style needs a riff */
  return g;
}
/* The settings a song plays with: its own groove first, then Settings. */
export function grooveOf(song, settings = {}) {
  const g = song?.groove || {};
  return { beat: g.beat || settings.metroBeat || "auto", swing: g.swing || song?.listen?.feel?.swing || settings.metroSwing || "straight", bass: g.bass || settings.bassStyle || "auto", riff: g.riff || "" };
}
const BASS_WORDS = { root: "root bass", fifth: "root and fifth bass", pulse: "pulse bass", walk: "walking bass", riff: "a bass riff" };
/* "Half time, light swing, walking bass": what a groove says, for a toast. */
export function grooveText(g) {
  return [g?.beat && drumBeatName(g.beat), (g?.swing === "light" || g?.swing === "full") && `${g.swing} swing`, g?.bass && BASS_WORDS[g.bass]].filter(Boolean).join(", ") || "the defaults";
}

// ---------- Plays that outlive a song ----------
// A song's plays are kept on the song. When a song leaves Recently deleted for
// good (or expires from it), its plays move into data.kept as counts per day,
// so the weekly total and the streak don't change when you tidy the library:
//   data.kept = { days: { "2026-10-17": 2 } }   (the last 60 days, like a song's own log)
// Only counts are kept: no title, artist or chords.
export function keepPlays(kept, entries, now = Date.now()) {
  const days = { ...(kept?.days || {}) };
  let any = !!kept;
  for (const t of entries || []) {
    if (t?.type !== "song") continue;
    for (const [k, n] of Object.entries(t.item?.playLog?.days || {})) if (n > 0) { days[k] = (days[k] || 0) + n; any = true; }
  }
  if (!any) return null;
  pruneDays(days, now);
  return { days };
}
export function cleanKept(raw) {
  if (!isObj(raw) || !isObj(raw.days)) return null;
  const days = {};
  for (const [k, n] of Object.entries(raw.days)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Number.isFinite(n) && n > 0) days[k] = Math.floor(n);
  return Object.keys(days).length ? { days } : null;
}
/* The songs whose plays count toward the library's totals: the live ones, the
   ones in Recently deleted, and the plays kept from songs gone for good. */
export function playSongs(data) {
  const out = [...(data.songs || []), ...(data.trash || []).filter(t => t?.type === "song" && t.item).map(t => t.item)];
  if (data.kept?.days) out.push({ playLog: { total: 0, last: 0, days: data.kept.days } });
  return out;
}

// ---------- A play that counts ----------
// A run counts as a play when auto-scroll carried the page most of the way to
// the song's end and ran for a fair share of the time that takes. Scrolling by
// hand, jumping with the song map, or pressing Play at the bottom doesn't.
//   end         how far the page scrolls before the last line reaches the reading line (px)
//   cover       how far auto-scroll itself moved the page during the run (px)
//   ms          how long auto-scroll ran during the run
//   expectedMs  how long the song takes at the current speed
export const PLAY_COVER = 0.6, PLAY_TIME = 0.5;
export function playCredited({ end = 0, cover = 0, ms = 0, expectedMs = 0 } = {}) {
  if (!(expectedMs > 0) || ms < PLAY_TIME * expectedMs) return false;
  return end < 40 ? true : cover >= PLAY_COVER * end; /* a sheet that fits one screen has only the time to go by */
}

// ---------- Play map ----------
// Credited plays grow a territory of hexagons around your practice spot. The
// rings grow with the square root of your plays (ring k arrives at 4 k squared
// plays), and the next ring fills in a cell at a time, so every play shows.
export function territory(plays) {
  plays = Math.max(0, Math.floor(+plays || 0));
  const k = Math.floor(Math.sqrt(plays) / 2), lo = 4 * k * k, hi = 4 * (k + 1) * (k + 1);
  const extra = Math.floor((plays - lo) / (hi - lo) * 6 * (k + 1));
  return { plays, rings: k, cells: plays ? 1 + 3 * k * (k + 1) + extra : 0, nextAt: hi, toNext: hi - plays };
}
/* The first n cells of the territory as axial hex coordinates: the centre, then
   ring after ring, each starting on the same side. */
export function hexSpiral(n) {
  const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], out = [[0, 0]];
  for (let k = 1; out.length < n; k++) {
    let q = -k, r = k;
    for (let i = 0; i < 6; i++) for (let j = 0; j < k; j++) { out.push([q, r]); q += dirs[i][0]; r += dirs[i][1]; }
  }
  return out.slice(0, Math.max(0, n));
}
/* A practice spot, kept no finer than about a kilometre. */
export function coarseSpot(lat, lon) {
  lat = +lat; lon = +lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}
/* The territory on a real map. Each hexagon is HEX_M metres from centre to corner,
   laid out from the practice spot; web-mercator pixels place it on map tiles. */
export const HEX_M = 250;
export function hexCentre(spot, [q, r], S = HEX_M) {
  const east = S * Math.sqrt(3) * (q + r / 2), south = S * 1.5 * r;
  return { lat: spot.lat - south / 111320, lon: spot.lon + east / (111320 * Math.cos(spot.lat * Math.PI / 180)) };
}
export function mercator(lat, lon, z) {
  const n = 256 * 2 ** z, s = Math.sin(Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180);
  return [(lon + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}
/* The closest zoom (9 to 16) at which every hexagon fits a w by h picture. */
export function fitZoom(lat, cells, w, h, S = HEX_M) {
  const ext = hexSpiral(cells).reduce((m, [q, r]) => Math.max(m, Math.abs(S * Math.sqrt(3) * (q + r / 2)) + S, Math.abs(S * 1.5 * r) + S), S);
  const mpp = 2 * ext * 1.08 / Math.max(1, Math.min(w, h));
  return Math.max(9, Math.min(16, Math.floor(Math.log2(156543.03 * Math.cos(lat * Math.PI / 180) / mpp))));
}
export const spotLabel = spot => spot ? `${Math.abs(spot.lat).toFixed(2)}° ${spot.lat >= 0 ? "N" : "S"}, ${Math.abs(spot.lon).toFixed(2)}° ${spot.lon >= 0 ? "E" : "W"}` : "";
/* Credited plays over all time: the journal counts one each time a song is played through. */
export const lifetimePlays = data => Object.values(journalOf(data).months).reduce((n, m) => n + (m.plays || 0) + Math.floor((m.psecs || 0) / PRACTICE_PLAY), 0);

// ---------- Venues ----------
// Each ring of the Tour Map is a bigger room. Ring k arrives at 4 k squared
// plays (territory above), so the venue is just the ring's name.
export const VENUES = ["Garage", "Open mic", "Coffeehouse", "Club", "Theater", "Arena", "Stadium", "Festival headliner"];
export const venueName = ring => VENUES[ring] || `World tour, leg ${ring - VENUES.length + 2}`;
export function venueOf(plays) {
  const t = territory(plays);
  return { ring: t.rings, name: venueName(t.rings), next: venueName(t.rings + 1), nextAt: t.nextAt, toNext: t.toNext };
}
/* The outline of the first n cells of the territory, as segments in units of
   one cell's corner radius (pointy-topped, centre of cell 0 at 0,0, y down).
   Edges two lit cells share are left out, so the territory reads as one shape. */
export const hexOutline = n => cellsOutline(hexSpiral(n));
/* the outline of any set of cells, in the same units */
export function cellsOutline(cells) {
  const R3 = Math.sqrt(3), seen = new Map();
  for (const [q, r] of cells) {
    const cx = R3 * (q + r / 2), cy = 1.5 * r;
    const pts = [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return [cx + Math.cos(a), cy + Math.sin(a)]; });
    for (let k = 0; k < 6; k++) {
      const a = pts[k], b = pts[(k + 1) % 6];
      const key = [a, b].map(p => p.map(v => Math.round(v * 1000)).join(",")).sort().join("|");
      seen.set(key, seen.has(key) ? null : [a, b]);
    }
  }
  return [...seen.values()].filter(Boolean);
}

// ---------- Your scene: the local guitarists and the rival players ----------
// Nobody else uses this app, so the competition is simulated, honestly and
// from real numbers where there are any:
//   people      a population estimate for each hexagon, from Natural Earth's
//               populated places: each place spreads its people in a bell around
//               its centre, on top of a thin rural floor.
//   guitarists  GUITAR_SHARE of those people (an assumption; YouGov 2022 found
//               about two in five who learned guitar still play).
//   minutes     how much local guitarists practise a day: a log-normal spread
//               around PRACTICE_MEDIAN minutes (an assumption).
//   rivals      a handful of simulated players seeded from your area, each with
//               a habit (daily, weekends, casual, new, lapsed, back again),
//               simulated day by day, with turf that grows like yours.
// A hexagon's local bar is the practice it takes to out-play most of the
// guitarists living in it; busy places take more. Your edge is held while your
// daily average keeps up with the strongest pressure on it (the local bar or a
// stronger rival next door); 7 days in a row below it and the edge is lost.
export const HEX_KM2 = 3 * Math.sqrt(3) / 2 * (HEX_M / 1000) ** 2;
export const PRACTICE_MEDIAN = 10;
export const GUITAR_SHARE = 0.06, PRACTICE_SPREAD = 0.9, HOLD_DAYS = 7;
const RURAL = 15; /* people per km² away from any listed place */
const DEFAULT_DENSITY = 300; /* plain ground, no spot: a typical suburb */
export function densityAt(lat, lon, places) {
  if (!Array.isArray(places) || !places.length || !Number.isFinite(lat)) return DEFAULT_DENSITY;
  const kx = 111.32 * Math.cos(lat * Math.PI / 180);
  let d = RURAL;
  for (const [plat, plon, pop] of places) {
    if (Math.abs(plat - lat) > 1.5) continue;
    const s = Math.min(40, Math.max(1.5, 0.02 * Math.sqrt(pop)));
    const dy = (plat - lat) * 111.32, dx = (plon - lon) * kx, r2 = dx * dx + dy * dy;
    if (r2 > 16 * s * s) continue;
    d += pop / (2 * Math.PI * s * s) * Math.exp(-r2 / (2 * s * s));
  }
  return d;
}
/* the inverse of the standard normal (Acklam's approximation) */
export function zOf(p) {
  p = Math.min(1 - 1e-9, Math.max(1e-9, p));
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(p, 1 - p), t = Math.sqrt(-2 * Math.log(q));
  const z = q < 0.02425 ? (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1)
    : (() => { const u = p - 0.5, r = u * u; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * u / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); })();
  return q < 0.02425 ? (p < 0.5 ? z : -z) : z;
}
const phi = z => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
/* minutes a day it takes to hold a hexagon with n guitarists in it */
export function localBar(n) {
  const p = Math.min(0.9, 0.5 + 0.1 * Math.log10(Math.max(0, n) + 1));
  return Math.round(PRACTICE_MEDIAN * Math.exp(PRACTICE_SPREAD * zOf(p)) * 10) / 10;
}
/* the share of local guitarists you out-practise at this daily average */
export const percentileOf = minutes => minutes > 0 ? phi(Math.log(minutes / PRACTICE_MEDIAN) / PRACTICE_SPREAD) : 0;

/* A small seeded random source, so the scene is the same every time it is drawn. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function seedOf(text) { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

const FIRST = ["Rusty", "Midnight", "Velvet", "Gravel", "Neon", "Lonesome", "Copper", "Southpaw", "Static", "Saltwater", "Back Porch", "Low E", "Whiskey", "Dusty", "Electric", "Sunday", "Broken String", "Barefoot", "Tin Roof", "Ramblin'"];
const LAST = ["Pick", "Strummer", "Drifter", "Capo", "Riff", "Kid", "Picker", "Slide", "Jangle", "Hollowbody", "Fretboard", "Troubadour", "Twang", "Busker", "Bender", "Rambler"];
/* habits: chance of playing on each weekday (Sun..Sat), and the minutes on a day played */
const HABITS = {
  daily: { days: [0.8, 0.85, 0.85, 0.85, 0.85, 0.8, 0.8], mins: 30, label: "plays most days" },
  weekend: { days: [0.85, 0.1, 0.1, 0.15, 0.2, 0.7, 0.9], mins: 45, label: "plays on weekends" },
  casual: { days: [0.4, 0.3, 0.3, 0.3, 0.3, 0.35, 0.4], mins: 15, label: "plays now and then" },
  newcomer: { days: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], mins: 18, label: "new, and keen" },
  lapsed: { days: [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6], mins: 25, label: "has gone quiet" },
  comeback: { days: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7], mins: 22, label: "back at it" }
};
const HABIT_MIX = ["daily", "weekend", "casual", "casual", "weekend", "newcomer", "lapsed", "daily", "comeback", "casual", "weekend", "newcomer"];
/* The rival players around a spot. Each is simulated a day at a time from
   `history` days ago to today; the same seed and day give the same result. */
export function simulateRivals({ seed, guitarists = 0, now = Date.now(), history = 60, userRings = 1 }) {
  const r = rng(seed), count = Math.max(4, Math.min(12, 4 + Math.floor(2.5 * Math.log10(guitarists + 1))));
  const today = Math.floor(now / DAY), names = new Set(), homes = [];
  const out = [];
  for (let i = 0; i < count; i++) {
    let name; do { name = `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`; } while (names.has(name)); names.add(name);
    const habit = HABIT_MIX[i % HABIT_MIX.length], h = HABITS[habit];
    const skill = Math.exp((r() - 0.5) * 0.8); /* some practise longer than others with the same habit */
    const joined = today - (habit === "newcomer" ? 3 + Math.floor(r() * 18) : 14 + Math.floor(r() * 36));
    const a0 = r(), a1 = r(), spread = r();
    const stopped = habit === "lapsed" || habit === "comeback" ? today - 10 - Math.floor(r() * 30) : null;
    const resumed = habit === "comeback" ? today - 3 - Math.floor(r() * 8) : null;
    let plays = 0, last = null; const minutes = [];
    for (let day = Math.max(joined, today - history); day <= today; day++) {
      const dr = rng(seed ^ Math.imul(i + 1, 2654435761) ^ day);
      const off = stopped !== null && day >= stopped && !(resumed !== null && day >= resumed);
      const ramp = habit === "newcomer" ? Math.min(1, 0.4 + (day - joined) / 30) : 1;
      const dow = (day + 4) % 7; /* day 0 was a Thursday */
      let m = 0;
      if (!off && dr() < h.days[dow] * ramp) m = Math.round(h.mins * skill * Math.exp((dr() - 0.5) * 0.9));
      if (m) { plays += Math.max(1, Math.round(m / 6)); last = day; }
      if (day > today - 7) minutes.push(m);
    }
    const avg7 = Math.round(minutes.reduce((a, b) => a + b, 0) / 7 * 10) / 10;
    /* home: just beyond your patch and their own reach, so turf borders rather than swallows */
    const t = territory(plays), dist = (userRings + 1) + (t.rings + 1) + Math.floor(spread * 5);
    let home = null;
    for (let tries = 0; tries < 24 && !home; tries++) {
      const ang = (a0 + tries * 0.137) * Math.PI * 2, q = Math.round(dist * Math.cos(ang)), rr = Math.round(dist * Math.sin(ang) - q / 2);
      if (homes.every(([x, y, k]) => Math.max(Math.abs(x - q), Math.abs(y - rr), Math.abs(x + y - q - rr)) >= k + t.rings + 1)) home = [q, rr];
    }
    if (!home) home = [Math.round((dist + 4) * Math.cos(a1 * 6.283)), Math.round((dist + 4) * Math.sin(a1 * 6.283))];
    homes.push([...home, t.rings]);
    out.push({ id: "r" + i, name, habit, label: h.label, home, plays, avg7, cells: t.cells, lastPlayed: last === null ? null : (today - last) });
  }
  return out;
}
/* The cells a player claims: their own spiral, centred on their home cell. */
export const claimCells = (home, n) => hexSpiral(n).map(([q, r]) => [q + home[0], r + home[1]]);
const cellKey = ([q, r]) => q + "," + r;
export const hexNeighbours = ([q, r]) => [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([a, b]) => [q + a, r + b]);
/* Who holds what: your cells are yours; each rival keeps what nobody stronger has. */
export function sceneMap(userCells, rivals) {
  const owner = new Map(userCells.map(c => [cellKey(c), "you"]));
  const turf = {};
  for (const rv of [...rivals].sort((a, b) => b.avg7 - a.avg7)) {
    turf[rv.id] = claimCells(rv.home, rv.cells).filter(c => !owner.has(cellKey(c)));
    turf[rv.id].forEach(c => owner.set(cellKey(c), rv.id));
  }
  return { owner, turf };
}
/* The pressure on your outermost cell: the local bar there, or a stronger rival
   whose turf touches it. Returns { bar, by } (by = a rival's id, or "scene"). */
export function edgePressure(edge, rivals, sceneTurf, guitaristsAt) {
  let bar = localBar(guitaristsAt(edge)), by = "scene";
  const near = new Set(hexNeighbours(edge).map(cellKey));
  for (const rv of rivals) {
    const touches = (sceneTurf[rv.id] || []).some(c => near.has(cellKey(c)) || cellKey(c) === cellKey(edge));
    if (touches && rv.avg7 > bar) { bar = rv.avg7; by = rv.id; }
  }
  return { bar, by };
}
/* Your daily average over the last 7 days. Each day counts the time recorded while a song
   scrolled, or, if more, the length of the songs played through that day (so plays from
   before time was recorded, and a song closed early, still count). */
export function userAvg7(data, now = Date.now()) {
  const days = journalOf(data, now).days || {};
  let s = 0;
  for (let i = 0; i < 7; i++) {
    const k = dayKey(now - i * DAY);
    let est = 0;
    for (const song of data.songs || []) est += (song.playLog?.days?.[k] || 0) * playedSecs(song);
    est += (data.kept?.days?.[k] || 0) * 210;
    s += Math.max(days[k] || 0, est);
  }
  return Math.round(s / 60 / 7 * 10) / 10;
}
/* Once a day: count the days your average sat below the pressure on your edge,
   and lose the edge cell after HOLD_DAYS in a row. data.tour = { lost, below, checked }. */
export function tourDay(data, pressureBar, earnedCells, now = Date.now()) {
  const t = data.tour && typeof data.tour === "object" ? data.tour : (data.tour = { lost: 0, below: 0, checked: "" });
  const today = dayKey(now);
  if (t.checked === today) return t;
  t.lost = Math.max(0, Math.min(+t.lost || 0, Math.max(0, earnedCells - 1)));
  const from = data.journal?.daysFrom; /* no edge is lost until a week of daily minutes is known */
  if (!from || from > dayKey(now - 6 * DAY)) { t.checked = today; t.below = 0; return t; }
  if (userAvg7(data, now) < pressureBar && earnedCells - t.lost > 1) {
    t.below = (+t.below || 0) + 1;
    if (t.below >= HOLD_DAYS) { t.lost++; t.below = 0; }
  } else t.below = 0;
  t.checked = today;
  return t;
}

/* The fewest credited plays that light n hexagons. */
export function playsForCells(n) {
  for (let p = n > 0 ? 1 : 0; p < 20000; p++) if (territory(p).cells >= n) return p;
  return Infinity;
}
/* The nearest rival hexagon your territory will grow into: how many more plays
   take it, whose it is, and where. null when no rival is within reach. */
export function takeoverPlan({ plays, held, lost = 0, owner, rivals }) {
  const reach = 1 + 3 * (territory(plays).rings + 5) * (territory(plays).rings + 6);
  const cells = hexSpiral(reach);
  for (let i = Math.max(0, held); i < cells.length; i++) {
    const who = owner.get(cellKey(cells[i]));
    const rival = who && who !== "you" && rivals.find(r => r.id === who);
    if (rival) return { rival, cell: cells[i], index: i, plays: Math.max(1, playsForCells(i + 1 + lost) - plays) };
  }
  return null;
}

export function cleanTour(raw) {
  if (!isObj(raw)) return null;
  return { lost: Math.max(0, Math.floor(+raw.lost || 0)), below: Math.max(0, Math.min(HOLD_DAYS, Math.floor(+raw.below || 0))), checked: /^\d{4}-\d{2}-\d{2}$/.test(raw.checked) ? raw.checked : "" };
}

// ---------- The neck: practice lessons (3.6.0) ----------
// A ladder of lessons. Each fret is one lesson: a chord to ring clean string by
// string, or a switch between two chords to land on the beat. The inlay after a
// group is a level check: play a real song from your library through.
// Strumming, picking and fingerstyle are on the ladder as "coming".
const SW = (a, b, to = 80) => ({ id: `s:${a}-${b}`, kind: "switch", a, b, to });
const CH = c => ({ id: `c:${c}`, kind: "chord", chord: c });
const SC = id => ({ id: `x:${id}`, kind: "scale", scale: id });
export const SKILL_LEVELS = [
  { id: "open", name: "Open chords", note: "Ring every string clean.", steps: ["G", "C", "D", "Em", "Am", "E", "A"].map(CH).concat([{ id: "k:open", kind: "check", chords: ["G", "C", "D", "Em", "Am", "E", "A"] }]) },
  { id: "switch", name: "Chord switches", note: "Land the change on the beat.", steps: [SW("G", "C"), SW("C", "D"), SW("G", "D"), SW("Em", "Am"), SW("Am", "C"), SW("D", "A"), SW("A", "E"), SW("Em", "C", 70), { id: "k:switch", kind: "check", chords: ["G", "C", "D", "Em", "Am", "E", "A"] }] },
  { id: "scales", name: "Scales", note: "Up and back down, one note at a time.", own: true, steps: ["Ampent", "Gpent", "Cmajor", "Aminor", "Ablues"].map(SC) },
  { id: "strum", name: "Strumming", note: "Down, up, and keeping time.", soon: true, steps: [] },
  { id: "pick", name: "Picking", note: "One string at a time.", soon: true, steps: [] },
  { id: "finger", name: "Fingerstyle and barre", note: "The big shapes.", soon: true, steps: [] }
];
/* Practice mode (3.21.0): on for a song you're learning unless you turned it off, or when you turned it on. */
export const practicing = song => song?.practice?.on ?? song?.status === "learning";
export const practiceRate = song => practicing(song) ? Math.min(1, Math.max(0.5, song.practice?.rate || 1)) : 1;

// ---------- Scales (3.21.0) ----------
// Five scales a guitarist uses most, in the order they pay off: the minor pentatonic box for lead
// and blues, the open major pentatonic, the open C major scale, the A natural minor, and the blues
// scale (the pentatonic plus the flat five). Each is [string, fret] pairs going up (string 0 is the
// low E). A lesson plays them up and back down; each note is heard before the next is asked for.
export const SCALES = {
  Ampent: { short: "Am pent", name: "A minor pentatonic", where: "Box one at the 5th fret", tip: "Index finger on fret 5, ring or pinky on 7 and 8.", notes: [[0, 5], [0, 8], [1, 5], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [4, 5], [4, 8], [5, 5], [5, 8]] },
  Gpent: { short: "G pent", name: "G major pentatonic", where: "Open position", tip: "Open strings and frets 2 and 3: the sound of country and folk.", notes: [[0, 0], [0, 3], [1, 0], [1, 2], [2, 0], [2, 2], [3, 0], [3, 2], [4, 0], [4, 3], [5, 0], [5, 3]] },
  Cmajor: { short: "C major", name: "C major scale", where: "Open position, one octave", tip: "Do re mi: the scale every melody is measured against.", notes: [[1, 3], [2, 0], [2, 2], [2, 3], [3, 0], [3, 2], [4, 0], [4, 1]] },
  Aminor: { short: "A minor", name: "A natural minor", where: "5th position, one octave", tip: "The sad sister of C major: same notes, starting on A.", notes: [[0, 5], [0, 7], [0, 8], [1, 5], [1, 7], [1, 8], [2, 5], [2, 7]] },
  Ablues: { short: "A blues", name: "A blues scale", where: "Box one at the 5th fret", tip: "The minor pentatonic plus the flat five, the blue note.", notes: [[0, 5], [0, 8], [1, 5], [1, 6], [1, 7], [2, 5], [2, 7], [3, 5], [3, 7], [3, 8], [4, 5], [4, 8], [5, 5], [5, 8]] }
};
/* A scale lesson's notes in playing order (up, then back down): { i, fret, hz, note, openHz }. */
export function scaleTargets(id, a4 = 440) {
  const sc = SCALES[id];
  if (!sc) return [];
  const open = TUNINGS.standard.notes;
  const up = sc.notes.map(([i, fret]) => {
    const openHz = noteFreq(open[i], a4), hz = openHz * 2 ** (fret / 12), nn = nearestNote(hz, a4);
    return { i, fret, hz, openHz, note: nn.name, octave: nn.octave };
  });
  return up.concat(up.slice(0, -1).reverse());
}

export const cleanSkills = raw => {
  if (!isObj(raw)) return null;
  const done = {};
  for (const [id, x] of Object.entries(isObj(raw.done) ? raw.done : {}).slice(0, 200)) {
    if (!/^[a-z]:[A-Za-z0-9#-]{1,12}$/.test(id) || !isObj(x)) continue;
    done[id] = { n: Math.max(1, Math.min(9999, Math.floor(+x.n || 1))), best: Math.max(0, Math.min(300, Math.floor(+x.best || 0))), at: Math.max(0, Math.floor(+x.at || 0)) };
  }
  const last = Math.max(0, Math.floor(+raw.last || 0));
  return Object.keys(done).length || last ? { done, last } : null;
};
/* Where every lesson stands. A chord you have already played in songs five times counts as known. */
export function skillState(data, now = Date.now()) {
  const done = data.skills?.done || {}, chords = data.journal?.chords || {};
  const known = st => st.kind === "chord" && (chords[st.chord]?.n || 0) >= 5;
  const songFor = st => (data.songs || []).filter(sg => { const c = songChordNames(sg.body); return c.length >= 2 && c.every(n => st.chords.includes(n)); }).sort((a, b) => (b.playLog?.last || 0) - (a.playLog?.last || 0))[0] || null;
  let cur = null, prevAt = 0;
  const levels = SKILL_LEVELS.map(lv => {
    /* Scales are their own track (3.21.0): open from the start, one after another. */
    if (lv.own) {
      let mine = null;
      return { ...lv, steps: lv.steps.map(st => {
        const state = done[st.id] ? "done" : mine ? "locked" : "now";
        if (state === "now") mine = st;
        return { ...st, state, name: SCALES[st.scale]?.short || st.scale, n: done[st.id]?.n || 0, best: 0 };
      }) };
    }
    return { ...lv, steps: lv.steps.map(st => {
    let state;
    if (st.kind === "check") {
      const sg = songFor(st), ok = done[st.id] || (sg && (sg.playLog?.last || 0) > prevAt && !cur);
      state = ok ? "done" : cur ? "locked" : "now";
      if (state === "now") cur = cur || { ...st, state, level: lv.id };
      return { ...st, state, song: sg ? sg.id : "", name: "Level check" };
    }
    state = done[st.id] ? "done" : known(st) ? "done" : cur ? "locked" : "now";
    if (state === "now") cur = { ...st, state, level: lv.id };
    if (state === "done") prevAt = Math.max(prevAt, done[st.id]?.at || 1);
    return { ...st, state, name: st.kind === "chord" ? st.chord : `${st.a} to ${st.b}`, n: done[st.id]?.n || 0, best: done[st.id]?.best || 0 };
  }) };
  });
  const last = data.skills?.last || 0, n = new Date(now), l = new Date(last);
  const today = !!last && n.getFullYear() === l.getFullYear() && n.getMonth() === l.getMonth() && n.getDate() === l.getDate();
  return { levels, next: cur, today };
}
const songChordNames = body => { const out = []; for (const m of String(body || "").matchAll(/\[([A-G][#b]?[^\]\s/]*)(?:\/[^\]\s]*)?\]/g)) if (!out.includes(m[1])) out.push(m[1]); return out; };
/* A lesson finished (or a clean round): keep the count and the best tempo. */
export function skillDone(data, id, best = 0, now = Date.now()) {
  const sk = data.skills || (data.skills = { done: {}, last: 0 }), x = sk.done[id] || (sk.done[id] = { n: 0, best: 0, at: 0 });
  x.n++; x.best = Math.max(x.best, Math.floor(best) || 0); x.at = now; sk.last = now;
}
/* What each string should sound like for a chord: a frequency, or null for a string left out. */
export function chordTargets(name, tuning = "standard", a4 = 440) {
  const sh = chordShape(name), notes = (TUNINGS[tuning] || TUNINGS.standard).notes;
  if (!sh) return null;
  return sh.frets.map((f, i) => {
    if (f < 0) return { i, hz: 0 };
    const hz = noteFreq(notes[i], a4) * 2 ** (f / 12);
    return { i, hz, fret: f, note: nearestNote(hz, a4).name, openHz: noteFreq(notes[i], a4) };
  });
}
/* Which string a heard pitch belongs to, with what happened: "ring" (right), "open" (the open string
   rang: the finger is not pressing), "low" or "high" (a fret off), or "" (not one of this chord's). */
export function judgeString(hz, targets) {
  if (!(hz > 0)) return null;
  const c = (a, b) => 1200 * Math.log2(a / b);
  for (const t of targets) if (t.hz && Math.abs(c(hz, t.hz)) <= 35) return { i: t.i, say: "ring" };
  for (const t of targets) {
    if (!t.hz) continue;
    if (t.fret > 0 && Math.abs(c(hz, t.openHz)) <= 35) return { i: t.i, say: "open" };
    if (Math.abs(c(hz, t.hz * 2 ** (-1 / 12))) <= 35) return { i: t.i, say: "low" };
    if (Math.abs(c(hz, t.hz * 2 ** (1 / 12))) <= 35) return { i: t.i, say: "high" };
  }
  return null;
}
/* How the neck listens. One set of numbers for the lessons and for What I hear, so a
   reading taken on What I hear says exactly what a lesson would do with it. Like the
   tuner, every line sits a little above the room's own noise (the floor), so a guitar
   at playing distance is heard on a phone whose microphone picks up very little
   (3.8.1: fixed lines missed nearly everything on Graham's iPhone).
   clarity    how clear a pitch must be (lower is stricter; the tuner's 0.4)
   pitchX     a pitch is tried on sounds this many times the floor (kept 0.0007 to 0.01)
   buzzX      a sound this many times the floor with no clear pitch is buzzy or muted
   strumX     a strum is this many times the floor at the least (and 0.004 at the least)
   overBleed  and this many times louder than the drums in the mic
   rise       and this many times louder than the quietest moment in the last 80 ms
   gap        seconds between two strums at the least */
export const HEAR = { clarity: 0.4, pitchX: 2, buzzX: 10, strumX: 6, overBleed: 1.5, rise: 1.6, gap: 0.18 };
/* The room's noise: drifts down quickly and up slowly, so a ringing string never counts as background (the tuner's rule).
   Moments of digital silence (an iPhone sends some) are skipped, or the floor sinks to nothing (3.8.3). */
export const trackFloor = (floor, lvl) => lvl < 0.00002 ? floor : floor == null ? Math.min(lvl, 0.004) : lvl < floor ? floor * 0.7 + lvl * 0.3 : floor * 0.995 + Math.min(lvl, floor * 3) * 0.005;
/* How the beat leaks into the microphone, moment by moment after each hit (10 ms steps, half a second),
   kept apart for the 1 and the other beats. Measured during a quiet bar; the strum line rises only
   where the beat is, so between hits a strum counts as it would with no beat at all (3.8.3). */
export function bleedProfile() {
  const bins = { one: new Float32Array(50), rest: new Float32Array(50) };
  const at = (since, one) => {
    if (!(since >= 0) || since >= 0.5) return 0;
    const b = bins[one ? "one" : "rest"], i = Math.floor(since / 0.01);
    return Math.max(b[i], b[i - 1] || 0, b[i + 1] || 0); /* a little slack for timing jitter */
  };
  return {
    add(since, one, rms) { if (since >= 0 && since < 0.5) { const b = bins[one ? "one" : "rest"], i = Math.floor(since / 0.01); b[i] = Math.max(b[i], rms); } },
    at,
    peak: () => Math.max(...bins.one, ...bins.rest)
  };
}
export const pitchRms = (floor, h = HEAR) => Math.min(0.01, Math.max(0.0007, (floor || 0) * h.pitchX));
export const buzzRms = (floor, h = HEAR) => Math.max(0.006, (floor || 0) * h.buzzX);
export const strumLine = (floor, bleed = 0, h = HEAR) => Math.max(0.004, (floor || 0) * h.strumX, bleed * h.overBleed);
/* A strum: the level jumps above the strum line. Feed it levels in order, every 10 ms or so. */
export function strumDetector(h = HEAR) {
  const recent = [];
  let last = -Infinity, floor = null;
  const hear = (rms, now, bleed = 0) => {
    floor = trackFloor(floor, rms);
    while (recent.length && now - recent[0][0] > 0.08) recent.shift();
    const low = recent.length ? Math.min(...recent.map(r => r[1])) : rms;
    recent.push([now, rms]);
    const hit = rms > strumLine(floor, bleed, h) && rms > low * h.rise && now - last > h.gap;
    if (hit) last = now;
    return hit;
  };
  hear.floor = () => floor;
  return hear;
}
/* One string at a time, the way the tuner works: the pitch is read only near the string expected
   (range), so a note heard an octave low can't be credited to another string (3.8.4). What a
   heard pitch means for that string: "ring", "open" (the finger isn't pressing), "low", "high", or null. */
export const stringRange = t => [t.hz * 0.7, t.hz * 1.42];
export function judgeTarget(hz, t) {
  if (!(hz > 0) || !t?.hz) return null;
  const c = f => 1200 * Math.log2(hz / f);
  for (const m of [1, 2, 0.5]) {
    const x = c(t.hz) + 1200 * Math.log2(m);
    if (Math.abs(x) <= 35) return "ring";
    if (t.fret > 0 && Math.abs(c(t.openHz) + 1200 * Math.log2(m)) <= 35) return "open";
    if (Math.abs(x + 100) <= 35) return "low";
    if (Math.abs(x - 100) <= 35) return "high";
  }
  return null;
}
/* Switch drill: when you played against when the chord was due. `due` and `onsets` are in seconds;
   `spb` is seconds per beat. Early or late by more than a quarter beat is not on the beat. */
export function gradeSwitches(due, onsets, spb) {
  let on = 0, late = 0, early = 0, miss = 0;
  for (const d of due) {
    /* the strum nearest the beat counts, so the strums of a pattern around it don't (3.8.4) */
    const near = onsets.filter(o => o >= d - 0.6 * spb && o <= d + 1.2 * spb);
    const hit = near.length ? near.reduce((a, o) => Math.abs(o - d) < Math.abs(a - d) ? o : a) : undefined;
    if (hit === undefined) { miss++; continue; }
    const dt = hit - d;
    if (Math.abs(dt) <= 0.25 * spb) on++; else if (dt > 0) late++; else early++;
  }
  return { on, late, early, miss, clean: on >= Math.ceil(due.length * 0.75) };
}

// ---------- The Road (4.0.0): the neck's ladder laid out as a path ----------
// Each leg is one track of the neck (Open chords, Chord switches, Scales). Its stops are the
// lessons in order, a merch box after every third lesson, and the level check at the end as the
// leg's headline show. Nothing new is stored: every stop's state comes from skillState, and a box
// is open once every stop before it is done. Only the first open stop on the whole road is the
// current one; later open stops (Scales are open from the start) can be played but aren't ringed.
export const BOX_EVERY = 3;
export function roadPath(data, now = Date.now()) {
  const sk = skillState(data, now);
  let current = null;
  const legs = sk.levels.filter(lv => !lv.soon && lv.steps.length).map((lv, li) => {
    const stops = [];
    let since = 0, allDone = true;
    for (const st of lv.steps) {
      if (st.kind !== "check" && since === BOX_EVERY) { stops.push({ id: `b:${lv.id}-${stops.length}`, kind: "box", name: "Merch box", state: allDone ? "done" : "locked" }); since = 0; }
      const state = st.state === "now" ? (current ? "open" : "now") : st.state;
      const stop = { ...st, kind: st.kind === "check" ? "headline" : st.kind, state, leg: lv.id };
      if (state === "now") current = stop;
      stops.push(stop);
      if (st.state !== "done") allDone = false;
      if (st.kind !== "check") since++;
    }
    return { id: lv.id, n: li + 1, name: lv.name, note: lv.note, stops, done: lv.steps.every(s => s.state === "done") };
  });
  const coming = sk.levels.filter(lv => lv.soon).map(lv => lv.name);
  const leg = legs.find(l => l.stops.includes(current)) || legs.find(l => !l.done) || legs.at(-1) || null;
  return { legs, current, leg, coming };
}

/* Fans (4.0.0): the score you earn by playing. 10 for every play (a song played through, or four
   minutes of practice), 5 for every lesson round finished, and 25 for every merch box opened on
   the Road. Worked out from what is already kept, so it needs no storage and survives a backup. */
export const FANS = { play: 10, lesson: 5, box: 25 };
export function fansOf(data, now = Date.now()) {
  const lessons = Object.values(data.skills?.done || {}).reduce((n, x) => n + (x.n || 0), 0);
  const boxes = roadPath(data, now).legs.reduce((n, l) => n + l.stops.filter(s => s.kind === "box" && s.state === "done").length, 0);
  return lifetimePlays(data) * FANS.play + lessons * FANS.lesson + boxes * FANS.box;
}

/* The chords you can play: every chord lesson done, and any chord played in songs five times. */
export function knownChords(data, now = Date.now()) {
  const sk = skillState(data, now), out = new Set();
  for (const lv of sk.levels) for (const st of lv.steps) if (st.kind === "chord" && st.state === "done") out.add(st.chord);
  for (const [c, x] of Object.entries(data.journal?.chords || {})) if ((x?.n || 0) >= 5) out.add(c);
  return out;
}
/* How many songs in the library use only chords you know, and how many more one new chord opens. */
export function playableSongs(data, extra = "", now = Date.now()) {
  const known = knownChords(data, now), songs = (data.songs || []).filter(s => s.format !== "tab");
  const ok = (s, set) => { const c = sheetChords(s.body); return c.length > 0 && c.every(n => set.has(n)); };
  const now1 = songs.filter(s => ok(s, known)).length;
  const more = extra && !known.has(extra) ? songs.filter(s => ok(s, new Set([...known, extra]))).length - now1 : 0;
  return { now: now1, of: songs.length, more };
}
/* The chords a sheet uses, in order, whatever its format (chords over words, inline, or chord lines). */
export function sheetChords(body) {
  const out = [];
  for (const b of parseBlocks(body || "")) {
    const raw = b.kind === "pair" ? b.words.flatMap(w => w.parts || []).map(p => p.chord).filter(Boolean) : b.kind === "chords" ? b.items : [];
    for (const r of raw) { const n = String(r).split(/\s+/)[0].replace(/^\(|\)$/g, ""); if (chordShape(n) && !out.includes(n)) out.push(n); }
  }
  return out;
}
