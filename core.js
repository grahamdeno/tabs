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
