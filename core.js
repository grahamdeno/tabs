// Tabs — core logic
// Personal chord sheet and tab library. All data stays in localStorage.

const STORAGE_KEY = "tabs-v1";

export const SPEEDS = { slow: 20, medium: 45, fast: 75 };

const DEFAULT_SETTINGS = { theme: "dark", scrollSpeed: "medium", transpose: 0 };

function blank() {
  return { songs: [], settings: { ...DEFAULT_SETTINGS } };
}

// Bring older saves (tab-only, numeric scroll speed) up to the current shape.
export function migrate(data) {
  if (!data || !Array.isArray(data.songs)) return blank();
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  if (typeof settings.scrollSpeed === "number") {
    const n = settings.scrollSpeed;
    settings.scrollSpeed = n < 33 ? "slow" : n < 60 ? "medium" : "fast";
  }
  if (!SPEEDS[settings.scrollSpeed]) settings.scrollSpeed = "medium";
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
  return { songs, settings };
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
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      created: new Date().toISOString(),
      favorite: false,
      format: "chords",
      key: "",
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

  deleteSong(data, id) {
    data.songs = data.songs.filter(s => s.id !== id);
    this.save(data);
  },

  toggleFavorite(data, id) {
    const song = data.songs.find(s => s.id === id);
    if (song) song.favorite = !song.favorite;
    this.save(data);
    return song;
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
