// Tabs — core logic
// Personal chord sheet and tab library. All data stays in localStorage.
// Topics live in core/ (4.15.1); everything is re-exported here, so the rest of the app imports from core.js.
import { addSync, bodyKey, cleanFeel, cleanSyncs, cleanTimed, feelOf, keyGap, keyOfChroma, keyParts, matchLines, mergeSyncs, parseLrc, syncSeconds, syncWhere, wordTimes } from "./core/recording.js";
import { SECTION_RE, buildWords, chordShape, detectPaste, guessKey, isChord, isChordLine, isTabLine, looksLikeTab, parseBlocks, parseSheet, prefersFlats, secName, transposeChord, transposeKey, wrapTab } from "./core/chords.js";
import { beatsOf, chordFit, chordLine, chordName, chordWords, detectKey, harmonize, keyConfidence, keyFamily, lineHint, lineOptions, lyricStanzas, melodyNotes, mergeWords, midiOfHz, notesUnder, packNotes, pickVersions, pitchShares, restyle, richName, setSungLine, sketchKey, sketchSong, sungLines, syllables, tempoPick, unpackNotes } from "./core/sketch.js";
import { PASSPORT, PRACTICE_PLAY, STREAK_GOALS, isBarre, journalGot, journalOf, journalPlay, journalPractice, journalTime, journalTune, profileOf, streakMoment } from "./core/playing.js";
import { BASS_STYLES, DRUM_BEATS, DRUM_PARTS, DRUM_SWING, GROOVE, RIFF_STEPS, barHits, bassHits, bassStyle, bassWhere, chordBass, cleanDrums, cleanGroove, drumBeatName, drumHits, drumLevelBar, drumStyle, grooveOf, grooveText, partOf, soundOffset, validRiff } from "./core/groove.js";
import { GUITAR_SHARE, HEX_KM2, HEX_M, HOLD_DAYS, PRACTICE_MEDIAN, PRACTICE_SPREAD, VENUES, cellsOutline, claimCells, cleanTour, coarseSpot, densityAt, edgePressure, hexNeighbours, hexSpiral, lifetimePlays, localBar, percentileOf, playsForCells, rng, sceneMap, seedOf, simulateRivals, takeoverPlan, territory, tourDay, userAvg7, venueName, venueOf, zOf, cornersSettle } from "./core/turf.js";
import { HEAR, SCALES, SKILL_LEVELS, bleedProfile, buzzRms, chordTargets, cleanSkills, gradeSwitches, judgeTarget, pitchRms, practiceRate, practicing, scaleTargets, skillDone, skillState, stringRange, strumDetector, strumLine, trackFloor } from "./core/neck.js";
import { CHANGES_DAYS, changesToWork, LESSON_PASSES, LESSON_XP, lessonDone, lessonKeep, lessonOfDay, lessonPartOf, BAND, BOX_EVERY, CHART_DEMOTE, CHART_PROMOTE, COVER_MULT, FANS, FRIEND_QUEST, GIG_STRINGS, GIG_WINDOW, MERCH, QUEST, SOUNDCHECK_XP, XP, addXP, bandMeet, bandParts, bandState, battleFor, chartRivals, chartState, chartsSettle, cleanBand, cleanCharts, cleanDuelLink, cleanDuels, cleanGig, cleanMerch, cleanQuests, cleanRehearse, cleanXP, coverState, duelRecord, duelWon, fansOf, fansToSpend, friendQuest, friendQuestPick, friendQuestSettle, friendsOf, gelOf, gigChange, gigCrowd, gigDone, gigFans, gigPct, gigStart, gigTiming, knownChords, merchBuy, merchState, merchTip, merchWear, merchWorn, missedChanges, noteHeard, playableSongs, questState, questsSettle, rainSettle, rehearseMisses, requestSong, roadPath, secondTake, sheetChords, soundcheck, soundcheckDone, startBattle, startDuel, takeDuel, weekOf, weekXP, badgesOf, levelOf, levelStart, xpTotal } from "./core/game.js";

// Release version: MAJOR.MINOR.PATCH. Must match the service worker cache name.
export const VERSION = "4.39.1";

const STORAGE_KEY = "tabs-v1";
export const DAY = 86400000;
export const TRASH_DAYS = 30;

export const SPEEDS = { slow: 20, medium: 45, fast: 75 };

const DEFAULT_SETTINGS = {
  theme: "auto", transpose: 0, /* theme: "auto" follows the phone, or "dark" / "light" / "green" (Green Room, 4.0.0) */ diagrams: false, focus: "always",
  speedMode: "length",   // "length" (song length, mm:ss) or "multiplier" (1x style)
  startSpeed: 45,        // 1x-style starting speed for new songs
  startLength: 210,      // song-length starting value, seconds (3:30)
  countIn: true,         // one bar of clicks before scrolling starts
  tunerMode: "acoustic", // tuner: "acoustic", "electric" or "chromatic"
  tunerGuided: true,     // guitar tuner walks the strings low to high
  a4: 440,               // pitch reference for the tuner, Hz
  micExplained: false,   // the tuner has said why it needs the microphone
  nudge: true,            // the library's Today line: practice streak and a song for today
  gigLines: 5,           // the Gig (4.1.0): how many lines of the song show at once (4, 5 or 6), or "full" (4.4.0)
  gigScore: true,        // a gig starts listening for your chord changes (4.2.0)
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
  delete settings.arcSweep; /* the ring is gone (3.19.0) */
  delete settings.stage; delete settings.songMap; delete settings.pauseDiagrams; /* retired in 4.15.0: the Gig is the stage; the rail and paused diagrams are always on */
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
  return { songs, sets, trash, settings, ...(data.journal && typeof data.journal === "object" ? { journal: data.journal } : {}), ...(kept ? { kept } : {}), ...(cleanTour(data.tour) ? { tour: cleanTour(data.tour) } : {}), ...(cleanSkills(data.skills) ? { skills: cleanSkills(data.skills) } : {}), ...(cleanGig(data.gig) ? { gig: cleanGig(data.gig) } : {}), ...(cleanQuests(data.quests) ? { quests: cleanQuests(data.quests) } : {}), ...(cleanCharts(data.charts) ? { charts: cleanCharts(data.charts) } : {}), ...(cleanXP(data.xp) ? { xp: cleanXP(data.xp) } : {}), ...(cleanBand(data.band) ? { band: cleanBand(data.band) } : {}), ...(cleanRehearse(data.rehearse) ? { rehearse: cleanRehearse(data.rehearse) } : {}), ...(cleanDuels(data.duels) ? { duels: cleanDuels(data.duels) } : {}), ...(cleanMerch(data.merch) ? { merch: cleanMerch(data.merch) } : {}) };
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

// ---------- Checking a backup before it replaces the library ----------
// Files can be hand-edited or come from somewhere else, so every field the app
// relies on is checked: wrong types are dropped (the app falls back to its
// defaults), songs without words or an id are skipped, and only https links and
// image data survive. Unknown fields are kept for newer versions of the app.
export const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
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
  delete s.playAs; /* Gig or Sheet per song (4.3.0) gave way to Full in the Gig (4.4.0) */
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
  const data = migrate({ songs, sets, trash, settings, ...(isObj(parsed.journal) && parsed.journal.v === 1 ? { journal: parsed.journal } : {}), ...(cleanKept(parsed.kept) ? { kept: cleanKept(parsed.kept) } : {}), ...(cleanTour(parsed.tour) ? { tour: cleanTour(parsed.tour) } : {}), ...(cleanSkills(parsed.skills) ? { skills: cleanSkills(parsed.skills) } : {}), ...(cleanGig(parsed.gig) ? { gig: cleanGig(parsed.gig) } : {}), ...(cleanQuests(parsed.quests) ? { quests: cleanQuests(parsed.quests) } : {}), ...(cleanCharts(parsed.charts) ? { charts: cleanCharts(parsed.charts) } : {}), ...(cleanXP(parsed.xp) ? { xp: cleanXP(parsed.xp) } : {}), ...(cleanBand(parsed.band) ? { band: cleanBand(parsed.band) } : {}), ...(cleanRehearse(parsed.rehearse) ? { rehearse: cleanRehearse(parsed.rehearse) } : {}), ...(cleanDuels(parsed.duels) ? { duels: cleanDuels(parsed.duels) } : {}), ...(cleanMerch(parsed.merch) ? { merch: cleanMerch(parsed.merch) } : {}) });
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
export const dayKey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const KEEP_DAYS = 60;
export function pruneDays(days, now) {
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
// One language for every song (4.36.0): German, Spanish or Russian, in settings.lang (German when
// missing, so a German library is unchanged). song.de keeps its name for whichever language is on and
// carries a lang tag. Nouns carry their gender: the article for German and Spanish, m/f/n for Russian.
// Russian lines are written with stress marks and come with the sound in Latin letters ("tr").
export const LANGS = {
  de: { name: "German", own: "Deutsch", short: "DE", speech: "de-DE", genders: ["der", "die", "das"], sample: "Der Fluss, the river" },
  es: { name: "Spanish", own: "Español", short: "ES", speech: "es-ES", genders: ["el", "la"], sample: "El río, the river" },
  ru: { name: "Russian", own: "Русский", short: "RU", speech: "ru-RU", genders: ["m", "f", "n"], sample: "Река́, the river" }
};
export const langOf = data => LANGS[data?.settings?.lang] ? data.settings.lang : "de";
/* picked, or already in use (a library translated before 4.36.0 is German) */
export const langChosen = data => !!LANGS[data?.settings?.lang] || (data?.songs || []).some(s => s.de);
/* a song's translation is in the language that's on */
export const deLangOk = (song, data) => !!song?.de && (song.de.lang || "de") === langOf(data);
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
export function cleanGerman(j, lines, lang = "de") {
  const str = (v, n = 120) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, n);
  const genders = (LANGS[lang] || LANGS.de).genders, ru = lang === "ru";
  const byI = new Map((Array.isArray(j?.lines) ? j.lines : []).map(l => [+l?.i, l]));
  return lines.map((ln, i) => {
    const l = byI.get(i) || {};
    const s = (Array.isArray(l.s) ? l.s : []).map(x => ({
      w: Math.floor(+x?.w), n: Math.max(1, Math.floor(+x?.n || 1)), l: Math.floor(+x?.l), de: str(x?.de, 80).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
      g: genders.includes(x?.g) ? x.g : "", lemma: str(x?.lemma, 60), en: str(x?.en, 60), pl: str(x?.pl, 60), built: str(x?.built, 120), note: str(x?.note, 200),
      ...(ru ? { tr: str(x?.tr, 80) } : {})
    })).filter(x => x.de && x.w >= 0 && x.l >= 1 && x.l <= 3 && x.w + x.n <= ln.tokens.length);
    return { de: str(l.de, 300), s, ...(ru ? { tr: str(l.tr, 300) } : {}) };
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
export function germanBlocks(blocks, de, level, { english = false, translit = false } = {}) {
  if (!de?.lines || !level) return blocks;
  const lines = sungText(blocks), at = new Map(lines.map((l, i) => [l.bi, i]));
  return blocks.map((b, bi) => {
    const i = at.get(bi), t = i == null ? null : de.lines[i];
    if (!t) return b;
    const en = english ? lines[i].text : "";
    if (level >= 4 && t.de) return { ...fluentBlock(b, t.de, i, en), tr: translit && t.tr ? t.tr : "" };
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
export const playDays = songs => {
  const set = new Set();
  for (const s of songs || []) {
    if (Array.isArray(s.plays)) s.plays.forEach(t => typeof t === "number" && set.add(dayKey(t)));
    Object.entries(s.playLog?.days || {}).forEach(([k, n]) => n > 0 && set.add(k));
    if (Array.isArray(s.rainDays)) s.rainDays.forEach(k => set.add(k)); /* nights a rain check covered (4.14.0) */
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
    /* Play together: 4.29.0 links carry only the tempo (a clap starts both phones); an older link's start time is dropped */
    const duet = p.duet && typeof p.duet === "object" ? { bpm: Math.min(300, Math.max(30, +p.duet.bpm || 90)) } : null;
    const duel = cleanDuelLink(p.duel);
    if (p.song && ok(p.song)) return duet ? { song: shareable(p.song), duet } : duel ? { song: shareable(p.song), duel } : { song: shareable(p.song) };
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
export function bestVoice(voices = [], lang = "de") {
  const region = (LANGS[lang] || LANGS.de).speech.replace("-", "[-_]");
  const score = v => (/premium/i.test(v.name) ? 40 : 0) + (/enhanced|erweitert|verbessert|mejorad|улучш/i.test(v.name) ? 25 : 0)
    + (/neural|natural|online/i.test(v.name) ? 15 : 0) + (new RegExp("^" + region, "i").test(v.lang) ? 3 : 0) + (v.default ? 1 : 0)
    - (NOVELTY.test(v.name) ? 50 : 0);
  const mine = voices.filter(v => new RegExp("^" + lang, "i").test(v.lang || ""));
  return mine.length ? mine.reduce((a, b) => (score(b) > score(a) ? b : a)) : null;
}
export const bestGermanVoice = (voices = []) => bestVoice(voices, "de");
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
export const norm = s => String(s || "").toLowerCase()
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
export function heardMatch(songs, track) {
  const t = norm(track?.title), a = norm(track?.artist);
  if (!t) return null;
  const same = s => norm(s.title) === t && (!a || !s.artist || norm(s.artist) === a || norm(s.artist).includes(a) || a.includes(norm(s.artist)));
  return (songs || []).find(same) || null;
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
    return { key: c.key, a, b, week: c.week, inSongs: c.inSongs, songCount: c.songs.length, best: c.songs[0] };
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
  if (data.merch?.rainDays?.length) out.push({ rainDays: data.merch.rainDays }); /* counts for the streak only, never as plays */
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

// ---------- Re-exported topics (core/) ----------
export { addSync, bodyKey, cleanFeel, cleanSyncs, cleanTimed, feelOf, keyGap, keyOfChroma, keyParts, matchLines, mergeSyncs, parseLrc, syncSeconds, syncWhere, wordTimes };
export { buildWords, chordShape, detectPaste, guessKey, isChord, isChordLine, looksLikeTab, parseBlocks, parseSheet, prefersFlats, transposeChord, transposeKey, wrapTab };
export { beatsOf, chordFit, chordLine, chordName, chordWords, detectKey, harmonize, keyConfidence, keyFamily, lineHint, lineOptions, lyricStanzas, melodyNotes, mergeWords, midiOfHz, notesUnder, packNotes, pickVersions, pitchShares, restyle, richName, setSungLine, sketchKey, sketchSong, sungLines, syllables, tempoPick, unpackNotes };
export { PASSPORT, PRACTICE_PLAY, STREAK_GOALS, isBarre, journalGot, journalOf, journalPlay, journalPractice, journalTime, journalTune, profileOf, streakMoment };
export { BASS_STYLES, DRUM_BEATS, DRUM_PARTS, DRUM_SWING, GROOVE, RIFF_STEPS, barHits, bassHits, bassStyle, bassWhere, chordBass, cleanDrums, cleanGroove, drumBeatName, drumHits, drumLevelBar, drumStyle, grooveOf, grooveText, partOf, soundOffset, validRiff };
export { GUITAR_SHARE, HEX_KM2, HEX_M, HOLD_DAYS, PRACTICE_MEDIAN, PRACTICE_SPREAD, VENUES, cellsOutline, claimCells, cleanTour, coarseSpot, densityAt, edgePressure, hexNeighbours, hexSpiral, lifetimePlays, localBar, percentileOf, playsForCells, rng, sceneMap, seedOf, simulateRivals, takeoverPlan, territory, tourDay, userAvg7, venueName, venueOf, zOf, cornersSettle };
export { HEAR, SCALES, SKILL_LEVELS, bleedProfile, buzzRms, chordTargets, cleanSkills, gradeSwitches, judgeTarget, pitchRms, practiceRate, practicing, scaleTargets, skillDone, skillState, stringRange, strumDetector, strumLine, trackFloor };
export { CHANGES_DAYS, changesToWork, LESSON_PASSES, LESSON_XP, lessonDone, lessonKeep, lessonOfDay, lessonPartOf, BAND, BOX_EVERY, CHART_DEMOTE, CHART_PROMOTE, COVER_MULT, FANS, FRIEND_QUEST, GIG_STRINGS, GIG_WINDOW, MERCH, QUEST, SOUNDCHECK_XP, XP, addXP, bandMeet, bandParts, bandState, battleFor, chartRivals, chartState, chartsSettle, cleanBand, cleanCharts, cleanDuelLink, cleanDuels, cleanGig, cleanMerch, cleanQuests, cleanRehearse, cleanXP, coverState, duelRecord, duelWon, fansOf, fansToSpend, friendQuest, friendQuestPick, friendQuestSettle, friendsOf, gelOf, gigChange, gigCrowd, gigDone, gigFans, gigPct, gigStart, gigTiming, knownChords, merchBuy, merchState, merchTip, merchWear, merchWorn, missedChanges, noteHeard, playableSongs, questState, questsSettle, rainSettle, rehearseMisses, requestSong, roadPath, secondTake, sheetChords, soundcheck, soundcheckDone, startBattle, startDuel, takeDuel, weekOf, weekXP, badgesOf, levelOf, levelStart, xpTotal };
