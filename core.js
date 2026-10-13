// Tabs — core logic
// Personal chord sheet and tab library. All data stays in localStorage.

// Release version: MAJOR.MINOR.PATCH. Must match the service worker cache name.
export const VERSION = "1.21.0";

const STORAGE_KEY = "tabs-v1";
const DAY = 86400000;
export const TRASH_DAYS = 30;

export const SPEEDS = { slow: 20, medium: 45, fast: 75 };

const DEFAULT_SETTINGS = {
  theme: "dark", transpose: 0, diagrams: false, focus: "always", pauseDiagrams: true,
  speedMode: "length",   // "length" (song length, mm:ss) or "multiplier" (1x style)
  startSpeed: 45,        // 1x-style starting speed for new songs
  startLength: 210,      // song-length starting value, seconds (3:30)
  countIn: true,         // one bar of clicks before scrolling starts
  lastBackup: null, backupSnooze: null, tipsSeen: false,
  v: 4
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
  settings.v = 4;
  delete settings.scrollSpeed;
  const songs = data.songs.map(s => {
    const song = { ...s };
    if (song.body === undefined) {
      song.body = song.tab || "";
      delete song.tab;
    }
    if (!song.format) song.format = song.body && looksLikeTab(song.body) ? "tab" : "chords";
    if (song.key === undefined) song.key = "";
    return song;
  });
  const ids = new Set(songs.map(s => s.id));
  const sets = (Array.isArray(data.sets) ? data.sets : []).map(x => ({ ...x, songIds: (x.songIds || []).filter(id => ids.has(id) || true) }));
  // Recently deleted: keep 30 days.
  const cutoff = Date.now() - TRASH_DAYS * DAY;
  const trash = (Array.isArray(data.trash) ? data.trash : []).filter(t => t && t.item && Date.parse(t.deletedAt) > cutoff);
  return { songs, sets, trash, settings };
}

export const Tabs = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? migrate(JSON.parse(raw)) : blank();
    } catch {
      return blank();
    }
  },

  save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  },

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

  // A play counts when a song is played through. Keep the most recent 200.
  logPlay(data, song) {
    song.plays = [...(song.plays || []), Date.now()].slice(-200);
    this.save(data);
  },

  export(data) {
    return JSON.stringify(data, null, 2);
  },

  import(json) {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.songs || !Array.isArray(parsed.songs)) throw new Error("Invalid format");
      const data = migrate(parsed);
      this.save(data);
      return data;
    } catch {
      return null;
    }
  }
};

// Plays in the last 7 days.
export const playsThisWeek = song => (song.plays || []).filter(t => t > Date.now() - 7 * DAY).length;

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
const FILLER_RE = /^(\||\|\||x\d+|\d+x|N\.?C\.?|\(|\)|-+|\/|%|\.+)$/i;

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
    else if (!FILLER_RE.test(t)) return false;
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

const SECTION_RE = /^\s*(?:\[([^\]]+)\]|((?:intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|instrumental|tag|refrain|coda|ending|break|hook)(?:\s*\d+)?)\s*:?)\s*$/i;

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
    if (sec && !(sec[1] && isChord(sec[1]))) { out.push({ kind: "section", text: (sec[1] || sec[2]).trim() }); continue; }

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
      out.push({ kind: "section", text: (sec[1] || sec[2]).trim() });
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
