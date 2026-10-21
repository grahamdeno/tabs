// The Road: core logic, Your playing (the profile numbers) and the streak moment.
// Re-exported from core.js, so other files import it from there.
import { DAY, chordsUsed, dayKey, playCount, playDays, pruneDays, shapeSteps, songChanges, streakOf } from "../core.js";
import { guessKey, transposeChord, transposeKey } from "./chords.js";

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
export const playedSecs = song => song.duration || 210;
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
