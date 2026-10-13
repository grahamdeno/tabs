// Tabs — core logic
// Personal chord sheet and tab library. All data stays in localStorage.

// Release version: MAJOR.MINOR.PATCH. Must match the service worker cache name.
export const VERSION = "1.35.18";

const STORAGE_KEY = "tabs-v1";
const DAY = 86400000;
export const TRASH_DAYS = 30;

export const SPEEDS = { slow: 20, medium: 45, fast: 75 };

const DEFAULT_SETTINGS = {
  theme: "auto", transpose: 0, /* theme: "auto" follows the phone, or "dark" / "light" */ diagrams: false, focus: "always", pauseDiagrams: true,
  speedMode: "length",   // "length" (song length, mm:ss) or "multiplier" (1x style)
  startSpeed: 45,        // 1x-style starting speed for new songs
  startLength: 210,      // song-length starting value, seconds (3:30)
  countIn: true,         // one bar of clicks before scrolling starts
  tunerMode: "acoustic", // tuner: "acoustic", "electric" or "chromatic"
  tunerGuided: true,     // guitar tuner walks the strings low to high
  a4: 440,               // pitch reference for the tuner, Hz
  micExplained: false,   // the tuner has said why it needs the microphone
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
  const trash = (Array.isArray(data.trash) ? data.trash : []).filter(t => t && t.item && Date.parse(t.deletedAt) > cutoff);
  return { songs, sets, trash, settings };
}

const SAVE_DELAY = 150;
let pending = null, saveTimer = 0;
export const Tabs = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrate(JSON.parse(raw)) : blank();
    } catch {
      return blank();
    }
  },

  // Saving writes the whole library, so changes made close together are written
  // once, a moment later (and right away when the app goes to the background).
  // If the phone refuses (storage full), onSaveError is told, so nothing is lost silently.
  save(data) {
    pending = data;
    if (!saveTimer) saveTimer = setTimeout(() => this.flush(), SAVE_DELAY);
  },
  flush() {
    clearTimeout(saveTimer); saveTimer = 0;
    if (!pending) return true;
    const d = pending; pending = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); return true; }
    catch (e) { this.onSaveError?.(e); return false; }
  },
  onSaveError: null,

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
    this.save(data);
  },

  export(data) {
    return JSON.stringify(data, null, 2);
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

// ---------- Checking a backup before it replaces the library ----------
// Files can be hand-edited or come from somewhere else, so every field the app
// relies on is checked: wrong types are dropped (the app falls back to its
// defaults), songs without words or an id are skipped, and only https links and
// image data survive. Unknown fields are kept for newer versions of the app.
const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
const SONG_TYPES = {
  title: "string", artist: "string", key: "string", body: "string", format: "string", tuning: "string", created: "string",
  transpose: "number", size: "number", speed: "number", duration: "number", bpm: "number",
  favorite: "boolean", easier: "object", loop: "object", listen: "object", playLog: "object", tone: "object"
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
    const ok = type === "object" ? isObj(s[k]) : typeof s[k] === type && (type !== "number" || Number.isFinite(s[k]));
    if (!ok) delete s[k];
  }
  if (typeof s.body !== "string") return null;
  if (!s.title?.trim()) s.title = "Untitled";
  if (s.format !== "chords" && s.format !== "tab") delete s.format;
  if (s.tuning && !TUNINGS[s.tuning]) delete s.tuning;
  if (s.transpose !== undefined) s.transpose = fit(Math.round(s.transpose), -5, 6);
  if (s.size !== undefined) s.size = fit(s.size, 0.6, 1.6);
  if (s.duration !== undefined) s.duration = fit(s.duration, 10, 3600);
  if (s.speed !== undefined) s.speed = fit(s.speed, 1, 200);
  if (s.bpm !== undefined) s.bpm = fit(Math.round(s.bpm), 30, 260);
  if (s.listen) {
    if (!/^https:\/\//.test(s.listen.url || "")) delete s.listen;
    else if (s.listen.art !== undefined && !/^https:\/\//.test(String(s.listen.art))) { s.listen = { ...s.listen }; delete s.listen.art; }
  }
  if (s.loop && !(Number.isInteger(s.loop.a) && Number.isInteger(s.loop.b))) delete s.loop;
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
  if (!["auto", "dark", "light"].includes(settings.theme)) delete settings.theme;
  const data = migrate({ songs, sets, trash, settings });
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
    if (p.song && ok(p.song)) return { song: shareable(p.song) };
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
const KEY_ORDER = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
const keyRank = k => {
  const m = /^([A-G][#b]?)(m?)/.exec(k || "");
  return m ? KEY_ORDER.indexOf(m[1]) * 2 + (m[2] ? 1 : 0) : 999;
};
// mode: "title" | "recent" | "most" | "key". keyOf gives a song's key.
// The letter a title files under in the A–Z index: accents dropped, digits and
// symbols under "#".
export function indexLetter(title) {
  const c = String(title || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}
export function sortSongs(songs, mode, keyOf = s => s.key) {
  const byTitle = (a, b) => a.title.localeCompare(b.title);
  const cmp = {
    recent: (a, b) => lastPlayed(b) - lastPlayed(a) || byTitle(a, b),
    most: (a, b) => playCount(b) - playCount(a) || byTitle(a, b),
    key: (a, b) => keyRank(keyOf(a)) - keyRank(keyOf(b)) || byTitle(a, b)
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
// ---------- Tuner guidance ----------
// In tune within 3 cents; the strobe takes over within 5; past 50 you're on the
// wrong note (or far off), so the words say so.
export const TUNE = { good: 3, strobe: 5, far: 50, hold: 1000 };
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
// Strobe drift in pixels per second: still when in tune, faster the further off.
export const strobeSpeed = cents => Math.abs(cents) <= TUNE.good ? 0 : Math.max(-60, Math.min(60, cents * 6));

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
export function detectPitch(buf, sampleRate) {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / n) < 0.01) return -1;
  const minLag = Math.max(2, Math.floor(sampleRate / 1000)), maxLag = Math.min(Math.floor(sampleRate / 60), (n >> 1) - 2);
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
    if (best > 0.35) return -1;
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
export const fitLength = sec => Math.min(480, Math.max(60, Math.round(sec)));
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
  for (const l of chordModel(body)) for (const c of l.chords || []) if (isChord(c.chord) && !seen.includes(c.chord)) seen.push(c.chord);
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
  const strum = String(ai.strum || "").replace(/[^DUdu\-\s]/g, "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 24);
  const head = [capo && `Capo ${capo}`, strum && `Strum: ${strum}`].filter(Boolean).join(" · ");
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
// Known chords across a library, most used first.
export function chordCounts(songs) {
  const n = new Map();
  for (const s of songs) for (const c of chordsUsed(s.body || "")) n.set(c, (n.get(c) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
}
