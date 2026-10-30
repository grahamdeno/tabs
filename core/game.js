// The Road: core logic, Version 4's game: the Road, Tour quests, Charts, Your band, Rehearse, song duels, the Gig and the Merch table.
// Re-exported from core.js, so other files import it from there.
import { DAY, chordModel, dayKey, heardMatch, isObj, norm, playDays, playSongs, playsThisWeek, shapeSteps, songChanges } from "../core.js";
import { chordShape, isChord, parseBlocks, transposeChord } from "./chords.js";
import { CHORD_FIT, chordNotes, strumFit, skillState } from "./neck.js";
import { VENUES, lifetimePlays, venueName, venueOf } from "./turf.js";

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
      if (st.kind !== "check" && since === BOX_EVERY) {
        /* 4.76.0: a box you've reached stays shut until you tap it open; it's then the next stop. With no
           data.boxes (a save from before 4.76.0), every box you've reached counts as opened, as it did. */
        const id = `b:${lv.id}-${stops.length}`, opened = !data.boxes || data.boxes.opened.includes(id);
        const state = !allDone ? "locked" : opened ? "done" : current ? "open" : "now";
        const box = { id, kind: "box", name: "Merch box", state };
        if (state === "now") current = box;
        stops.push(box); since = 0;
      }
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

// ---------- Opening night (4.40.0) ----------
// A short leg before Leg 1 that teaches by doing, on the sample song: the microphone (with the reason
// first), tap a chord, play a verse (strum on the changes), pause and pick up, then the first show
// through. data.opening = { step, fans, micOff, done, seen, skipped, replay }. A player with any play or
// lesson before it started never sees it; Settings > Help > Tips & gestures can replay it (no fans again).
export const OPENING = [
  { id: "mic", name: "Let me hear you", sub: "the microphone" },
  { id: "chord", name: "Tap a chord", sub: "see how it's played" },
  { id: "verse", name: "Play a verse", sub: "strum on the changes" },
  { id: "pause", name: "Pause and pick up", sub: "tap, then Resume" },
  { id: "show", name: "Your first show", sub: "a song, start to finish" }
];
/* "leg" while it's on, "done" once right after the show, else null */
export function openingView(data) {
  const o = data.opening;
  if (o && typeof o === "object") {
    if (o.skipped) return null;
    if (o.done) return o.seen ? null : "done";
    return "leg";
  }
  const lessons = Object.keys(data.skills?.done || {}).length;
  return lifetimePlays(data) === 0 && !lessons ? "leg" : null;
}
export const openingOn = data => openingView(data) === "leg";
export const openingStep = data => Math.min(Math.max(0, data.opening?.step || 0), OPENING.length);
/* Finish a step, only when it's the one you're on. Steps before the show give lesson fans (once). */
export function openingAdvance(data, id, now = Date.now()) {
  if (!openingOn(data)) return false;
  const o = data.opening && typeof data.opening === "object" ? data.opening : (data.opening = { step: 0, fans: 0, started: now });
  if (OPENING[o.step]?.id !== id) return false;
  o.step++;
  if (!o.replay && id !== "show") o.fans = (o.fans || 0) + FANS.lesson;
  if (o.step >= OPENING.length) o.done = now;
  return true;
}
/* The fretboard Road (4.82.0): each leg is its own guitar, earned by headlining the leg before it.
   Drawn in fretboard.js; the woods and finishes keep their own colours in every look. `inlay` is the
   shape of the single inlays (merch boxes) and of the headline's double. Legs not built yet (strum,
   pick, finger) and the Encore guitar are data only until their legs exist. */
export const GUITARS = {
  open: { name: "The beater", kind: "acoustic", body: "parlor", head: "plain", headc: "#5a3d28", board: "#4a3328", binding: "#efe4c8", finish: "#8a6a4a", tuner: "#efe4c8", inlay: "small" },
  switch: { name: "The cutaway", kind: "acoustic", body: "cutaway", head: "plain", headc: "#3a2a22", board: "#4a3328", binding: "#e9dcbc", finish: "#6b3b20", tuner: "#F5C542", inlay: "dot" },
  scales: { name: "The solid-body", kind: "electric", body: "solid", head: "plain", headc: "#1c1d22", board: "#2b2420", binding: "#e9dcbc", finish: "#1c1d22", tuner: "#F5C542", inlay: "block" },
  strum: { name: "The hollow-body", kind: "electric", body: "hollow", head: "book", headc: "#1c1d22", board: "#241f1d", binding: "#e9dcbc", finish: "#a8431f", tuner: "#F5C542", inlay: "split" },
  pick: { name: "The single-cut", kind: "electric", body: "single", head: "book", headc: "#1c1d22", board: "#241f1d", binding: "#e9dcbc", finish: "#8b1e2b", tuner: "#c4c8d0", inlay: "trap" },
  finger: { name: "The classical", kind: "classical", body: "classical", head: "slot", headc: "#3a2418", board: "#4a3328", binding: "#efe4c8", finish: "#c98a4a", tuner: "#efe4c8", inlay: "abalone" },
  encore: { name: "The headliner", kind: "electric", body: "swallow", head: "point", headc: "#8A47F5", board: "#1c1a1f", binding: "#F5C542", finish: "#8A47F5", tuner: "#F5C542", inlay: "star" }
};
export const guitarFor = legId => GUITARS[legId] || GUITARS.open;
/* The fret spaces of a leg's neck, top to bottom: one per stop. Spacing narrows like a real neck (66, 62,
   59, 56, 53, 50) and stops at 48 so every stop stays a tap target. Lessons are dots on string 1 then 4
   (0-based from the low E, alternating), a merch box is a single inlay, the headline the double inlay.
   y is the centre of a space from the nut. The headstock sits above the nut (HEAD), the body below the
   last space (BODY). */
export const FRET_STEPS = [66, 62, 59, 56, 53, 50];
export const FRET_MIN = 48;
export const FRET_HEAD = 100;
export const FRET_BODY = 230;
export function fretLayout(stops) {
  let y = 0, dots = 0;
  const spaces = stops.map((stop, i) => {
    const h = FRET_STEPS[i] ?? FRET_MIN, kind = stop.kind === "headline" ? "double" : stop.kind === "box" ? "inlay" : "dot";
    const sp = { stop, y: y + h / 2, h, kind, string: kind === "dot" ? (dots++ % 2 ? 4 : 1) : -1 };
    y += h;
    return sp;
  });
  return { spaces, neck: y, head: FRET_HEAD, body: FRET_BODY, height: FRET_HEAD + y + FRET_BODY };
}
/* The guitars you've earned: every leg whose headline show is done, in order, plus the first. Shown once each. */
export const guitarsEarned = (data, now = Date.now()) => roadPath(data, now).legs.filter(l => l.done).map(l => l.id);
export function cleanGuitars(raw) {
  if (!isObj(raw)) return null;
  return { seen: [...new Set((Array.isArray(raw.seen) ? raw.seen : []).filter(x => typeof x === "string" && /^[\w-]{1,40}$/.test(x)))].slice(0, 20) };
}
/* The next guitar to announce: the first done leg you haven't been told about. */
export function guitarNew(data, now = Date.now()) {
  const seen = data.guitars?.seen || [];
  const id = guitarsEarned(data, now).find(x => !seen.includes(x));
  if (!id) return null;
  const legs = roadPath(data, now).legs, next = legs[legs.findIndex(l => l.id === id) + 1];
  return next ? { leg: id, next: next.id, guitar: guitarFor(next.id) } : null;
}
/* Merch boxes (4.76.0): the ids of the boxes you've opened on the Road. */
export function cleanBoxes(raw) {
  if (!isObj(raw)) return null;
  const opened = [...new Set((Array.isArray(raw.opened) ? raw.opened : []).filter(x => typeof x === "string" && /^b:[\w-]{1,40}$/.test(x)))].slice(0, 300);
  return { opened };
}
/* The first time 4.76.0 shows the Road, the boxes you'd already reached are kept as opened, so no fans go missing. */
export function boxesSeed(data, now = Date.now()) {
  if (data.boxes) return false;
  data.boxes = { opened: roadPath(data, now).legs.flatMap(l => l.stops).filter(s => s.kind === "box" && s.state === "done").map(s => s.id) };
  return true;
}
/* Open a box: only the one that's your next stop. True when it opened (+FANS.box, counted by fansOf). */
export function openBox(data, id, now = Date.now()) {
  const cur = roadPath(data, now).current;
  if (!cur || cur.kind !== "box" || cur.id !== id) return false;
  data.boxes = { opened: [...(data.boxes?.opened || []), id] };
  return true;
}
export function cleanOpening(raw) {
  if (!isObj(raw)) return null;
  const out = { step: Math.max(0, Math.min(OPENING.length, Math.floor(+raw.step || 0))) };
  const fans = Math.max(0, Math.min(OPENING.length * FANS.lesson, Math.floor(+raw.fans || 0))); if (fans) out.fans = fans;
  for (const k of ["done", "seen", "skipped", "started"]) { const t = +raw[k]; if (t > 0) out[k] = t; }
  for (const k of ["micOff", "replay"]) if (raw[k] === true) out[k] = true;
  return out;
}
export function openingSkip(data, now = Date.now()) { data.opening = { ...(isObj(data.opening) ? data.opening : { step: 0, fans: 0 }), skipped: now }; }
export function openingReplay(data, now = Date.now()) { data.opening = { step: 0, fans: data.opening?.fans || 0, replay: true, started: now }; }
export function fansOf(data, now = Date.now()) {
  const lessons = Object.values(data.skills?.done || {}).reduce((n, x) => n + (x.n || 0), 0);
  const boxes = roadPath(data, now).legs.reduce((n, l) => n + l.stops.filter(s => s.kind === "box" && s.state === "done").length, 0);
  return lifetimePlays(data) * FANS.play + lessons * FANS.lesson + boxes * FANS.box + (data.gig?.fans || 0) + (data.quests?.fans || 0) + (data.charts?.fans || 0) + (data.opening?.fans || 0);
}

// ---------- Tour quests (4.5.0) ----------
// The month's tour (20 shows), tonight's setlist (three small goals a day) and the request line (a fan asks
// for one of your songs each day; played as a gig, its bonus fans double). Fans from quests are kept in
// data.quests.fans; what's earned is settled once (questsSettle), so nothing is counted twice.
export const QUEST = { tourShows: 20, tourFans: 100, goalFans: 10, setFans: 25 };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function hashDay(key) { let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
/* the song a fan asks for today: a chord song not played in the last week (any, if all were), the ones
   you can already play first; the same one all day */
export function requestSong(data, now = Date.now()) {
  const songs = (data.songs || []).filter(s => s.format !== "tab" && /\S/.test(s.body || "") && !s.isNew);
  if (!songs.length) return null;
  /* 4.10.0: the song you just played in Apple Music is today's request */
  const heard = data.quests?.heard;
  if (heard?.day === dayKey(now)) { const h = songs.find(s => s.id === heard.id); if (h) return h; }
  const week = new Set(Array.from({ length: 7 }, (_, i) => dayKey(now - i * DAY)));
  const fresh = songs.filter(s => !Object.entries(s.playLog?.days || {}).some(([k, n]) => n > 0 && week.has(k)));
  const known = knownChords(data, now), can = s => sheetChords(s.body).every(c => known.has(c));
  const pool = (fresh.length ? fresh : songs).slice().sort((a, b) => (can(b) - can(a)) || String(a.id).localeCompare(String(b.id)));
  const ok = pool.filter(can), from = ok.length ? ok : pool;
  return from[hashDay(dayKey(now)) % from.length];
}
export function questState(data, now = Date.now()) {
  const d = new Date(now), today = dayKey(now), month = today.slice(0, 7), q = data.quests || {};
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let shows = 0, todayPlays = 0;
  for (const s of playSongs(data)) for (const [k, n] of Object.entries(s.playLog?.days || {})) { if (k.startsWith(month)) shows += n || 0; if (k === today) todayPlays += n || 0; }
  const mins = Math.floor((data.journal?.days?.[today] || 0) / 60), crowd = q.crowd?.day === today ? q.crowd.n : 0;
  const got = q.day === today ? q.got || [] : [];
  const goals = [
    { id: "two", label: "Play 2 songs through", have: Math.min(2, todayPlays), need: 2 },
    { id: "crowd", label: "Get the crowd to 10 of 12 in a gig", have: Math.min(10, crowd), need: 10 },
    { id: "mins", label: "Play for 5 minutes", have: Math.min(5, mins), need: 5 }
  ].map(g => ({ ...g, done: g.have >= g.need, claimed: got.includes(g.id) }));
  const req = requestSong(data, now);
  return {
    today, month, monthName: MONTHS[d.getMonth()], daysLeft: last - d.getDate(),
    tour: { shows: Math.min(QUEST.tourShows, shows), need: QUEST.tourShows, done: shows >= QUEST.tourShows, claimed: q.month === month && !!q.tour },
    goals, setDone: goals.every(g => g.done), setClaimed: got.includes("set"),
    request: req && { song: req, done: q.req?.day === today && q.req.id === req.id && !!q.req.done }
  };
}
/* Credit what's newly done: fans for each goal, the full setlist and the month's tour. Returns what was earned. */
export function questsSettle(data, now = Date.now()) {
  const st = questState(data, now), q = data.quests || (data.quests = { fans: 0 });
  if (q.day !== st.today) { q.day = st.today; q.got = []; }
  const out = [];
  for (const g of st.goals) if (g.done && !q.got.includes(g.id)) { q.got.push(g.id); out.push({ label: g.label, fans: QUEST.goalFans }); }
  if (st.setDone && !q.got.includes("set")) { q.got.push("set"); out.push({ label: "Tonight's setlist", fans: QUEST.setFans }); }
  if (q.month !== st.month) { q.month = st.month; q.tour = false; }
  if (st.tour.done && !q.tour) { q.tour = true; out.push({ label: `${st.monthName} Tour`, fans: QUEST.tourFans }); }
  q.fans = (q.fans || 0) + out.reduce((n, x) => n + x.fans, 0);
  addXP(data, out.length * XP.goal, now); /* Charts (4.6.0) */
  return out;
}
/* Cover requests (4.10.0): what you listen to in Apple Music. A song in your Songbook becomes today's
   request; one you don't have becomes a cover quest (get the song, learn its chords, play it as a gig for
   3x bonus fans). noteHeard takes the latest track; returns true when something changed. */
export const COVER_MULT = 3;
export function noteHeard(data, track, now = Date.now()) {
  if (!track?.title) return false;
  const q = data.quests || (data.quests = { fans: 0 }), today = dayKey(now), song = heardMatch(data.songs || [], track);
  if (song && song.format !== "tab") {
    if (q.heard?.day === today && q.heard.id === song.id) return false;
    if (q.req?.day === today && q.req.done) return false; /* today's request is already played */
    q.heard = { day: today, id: song.id };
    return true;
  }
  if (song) return false;
  const c = q.cover, same = c && norm(c.title) === norm(track.title) && norm(c.artist || "") === norm(track.artist || "");
  if (same || (c && !c.done && now - c.at < 7 * DAY)) return false;
  q.cover = { title: track.title, artist: track.artist || "", ...(track.url ? { url: track.url } : {}), ...(track.art ? { art: track.art } : {}), at: now };
  return true;
}
/* the cover quest now: the song once it's in your Songbook, and the chords it still needs */
export function coverState(data, now = Date.now()) {
  const c = data.quests?.cover;
  if (!c || c.done || now - c.at > 14 * DAY) return null;
  const song = (c.id && data.songs.find(s => s.id === c.id)) || heardMatch(data.songs || [], c) || null;
  if (song && c.id !== song.id) c.id = song.id;
  const known = knownChords(data, now), missing = song ? sheetChords(song.body).filter(x => !known.has(x)) : [];
  return { ...c, song, missing, step: !song ? 1 : missing.length ? 2 : 3 };
}
/* a gig finished: the crowd it reached today, and the request line (its bonus fans double, once a day) */
function questsShow(data, songId, crowd, fans, now) {
  const q = data.quests || (data.quests = { fans: 0 }), today = dayKey(now);
  if (crowd != null) q.crowd = { day: today, n: Math.max(q.crowd?.day === today ? q.crowd.n : 0, crowd) };
  /* the cover quest: your first gig of the song you went and learned pays 3x */
  const cv = coverState(data, now);
  if (cv?.song?.id === songId) { q.cover.done = true; q.cover.id = songId; const extra = fans * (COVER_MULT - 1); q.fans = (q.fans || 0) + extra; return extra; }
  const req = requestSong(data, now);
  if (!req || req.id !== songId || (q.req?.day === today && q.req.done)) return 0;
  q.req = { day: today, id: songId, done: true };
  q.fans = (q.fans || 0) + fans;
  return fans;
}
export function cleanQuests(raw) {
  if (!isObj(raw)) return null;
  const day = /^\d{4}-\d\d-\d\d$/, out = { fans: Math.max(0, Math.min(1e7, Math.floor(+raw.fans || 0))) };
  if (day.test(raw.day)) { out.day = raw.day; out.got = (Array.isArray(raw.got) ? raw.got : []).filter(x => ["two", "crowd", "mins", "set"].includes(x)); }
  if (/^\d{4}-\d\d$/.test(raw.month)) { out.month = raw.month; out.tour = raw.tour === true; }
  if (isObj(raw.crowd) && day.test(raw.crowd.day)) out.crowd = { day: raw.crowd.day, n: Math.max(0, Math.min(12, Math.round(+raw.crowd.n || 0))) };
  if (isObj(raw.req) && day.test(raw.req.day) && typeof raw.req.id === "string") out.req = { day: raw.req.day, id: raw.req.id.slice(0, 40), done: raw.req.done === true };
  if (isObj(raw.heard) && day.test(raw.heard.day) && typeof raw.heard.id === "string") out.heard = { day: raw.heard.day, id: raw.heard.id.slice(0, 40) };
  if (isObj(raw.fq) && day.test(raw.fq.wk) && typeof raw.fq.with === "string") out.fq = { wk: raw.fq.wk, with: raw.fq.with.slice(0, 30), ...(raw.fq.claimed === true ? { claimed: true } : {}) };
  const c = raw.cover;
  if (isObj(c) && typeof c.title === "string" && c.title.trim() && c.at > 0) out.cover = { title: c.title.slice(0, 100), artist: String(c.artist || "").slice(0, 100), ...(/^https:\/\/music\.apple\.com\//.test(c.url || "") ? { url: c.url } : {}), ...(/^https:\/\//.test(c.art || "") ? { art: c.art } : {}), at: Math.floor(c.at), ...(typeof c.id === "string" ? { id: c.id.slice(0, 40) } : {}), ...(c.done === true ? { done: true } : {}) };
  return out.fans || out.day || out.month || out.crowd || out.req || out.heard || out.cover || out.fq ? out : null;
}

// ---------- Charts (4.6.0): XP, the weekly chart, records and rival battles ----------
// XP is earned this week: 10 for every song played through (from the play log), and what's kept in
// data.xp.days: 1 for each chord change landed in a gig, 10 for a crowd of 10 or more, 5 for each setlist
// goal, 30 for a battle won. Each week you're on a chart with nine simulated players at your tier (the
// venues, Garage up); the top 5 move up a tier and earn its record, and the bottom 3 move down (4.11.0;
// never below the Garage). The players behave like people: steady ones, weekend players who surge on
// Saturday and Sunday, streakers who play every day, faders who start hot and stop, skippers who miss
// days, and one shadow who stays just ahead of you as long as they can keep up.
export const XP = { play: 10, landed: 1, crowd: 10, goal: 5, battle: 30, battleFans: 40 };
export const CHART_PROMOTE = 5;
export const CHART_DEMOTE = 3;
const RIVAL_KINDS = ["steady", "weekend", "streaker", "fader", "skipper", "skipper", "steady", "weekend", "streaker"];
const RIVAL_NAMES = ["Neon Jen", "Basement Ray", "Capo Kid", "Sixstring Sal", "Open-tuning Ollie", "Fret Fiona", "Barre Chord Bo", "Strummin' Stu", "Pickslide Pia", "Drop-D Dee", "Hammer-on Hal", "Feedback Flo", "Tremolo Tess", "Slide Sam", "Busker Bea", "Riff Rico", "Power Chord Pat", "Fingerpick Finn", "Chorus Cora", "Amp Stack Max"];
/* Monday of the week a time falls in, as YYYY-MM-DD */
export function weekOf(now = Date.now()) {
  const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return dayKey(d.getTime());
}
const weekStart = wk => { const [y, m, d] = wk.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
export function addXP(data, n, now = Date.now()) {
  if (!(n > 0)) return;
  const x = data.xp || (data.xp = { days: {} }), k = dayKey(now);
  /* 4.17.0: a lifetime total too (days only keeps 60), started from what days still holds */
  if (!(x.life >= 0)) x.life = Object.values(x.days).reduce((a, b) => a + (b || 0), 0);
  x.life += Math.round(n);
  x.days[k] = (x.days[k] || 0) + Math.round(n);
  const keep = dayKey(now - 60 * DAY);
  for (const d of Object.keys(x.days)) if (d < keep) delete x.days[d];
}
/* XP in the week that starts on wk */
export function weekXP(data, wk = weekOf(), upTo = null) {
  const t0 = weekStart(wk), last = upTo == null ? null : dayKey(upTo);
  const days = new Set(Array.from({ length: 7 }, (_, i) => dayKey(t0 + i * DAY + 12 * 3600e3)).filter(k => !last || k <= last));
  let n = 0;
  for (const s of playSongs(data)) for (const [k, c] of Object.entries(s.playLog?.days || {})) if (days.has(k)) n += (c || 0) * XP.play;
  for (const [k, c] of Object.entries(data.xp?.days || {})) if (days.has(k)) n += c || 0;
  return n;
}
/* the nine players on your chart this week: the same all week, their XP growing as it goes */
function rand(seed) { let h = seed >>> 0; return () => { h = (h + 0x6D2B79F5) >>> 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function chartRivals(wk, tier, at = 1, you = 0) {
  const r = rand(hashDay(`${wk}:${tier}`)), names = RIVAL_NAMES.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const base = 90 + tier * 55, f = Math.max(0, Math.min(1, at)), kinds = RIVAL_KINDS.slice();
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
  const shadow = Math.floor(r() * 9); /* one of them keeps just ahead of you */
  const t = f * 7, day = Math.min(6, Math.floor(t)), part = t - day; /* Monday is day 0 */
  return names.slice(0, 9).map((name, i) => {
    const kind = i === shadow ? "shadow" : kinds[i], target = Math.round(base * (0.35 + 1.3 * r()));
    /* a share of the week's XP for each day, by the kind of player */
    const w = Array.from({ length: 7 }, (_, d) => {
      const coin = r();
      if (kind === "weekend") return d >= 5 ? 3 + coin : coin < 0.3 ? 0.4 : 0;
      if (kind === "streaker") return 0.8 + 0.4 * coin;
      if (kind === "fader") return d < 3 ? 2 + coin : coin < 0.15 ? 0.3 : 0;
      if (kind === "skipper") return coin < 0.45 ? 0 : 0.6 + coin;
      return 0.6 + 0.8 * coin;
    });
    const sum = w.reduce((a, b) => a + b, 0) || 1, per = w.map(x => target * x / sum);
    const by = d => per.slice(0, d).reduce((a, b) => a + b, 0);
    let xp = Math.round(by(day) + per[day] * part), yday = Math.round(by(Math.max(0, day)));
    const lead = 6 + Math.floor(r() * 18), cap = Math.round(base * 1.7 * Math.min(1, 0.25 + f));
    if (kind === "shadow") { xp = Math.min(cap, Math.max(xp, you + lead)); yday = Math.min(xp, yday); }
    const quiet = per.slice(Math.max(0, day - 1), day + 1).every(x => x < 1) && day > 0;
    return { id: "r" + i, name, xp, target, kind, today: xp - yday, quiet };
  });
}
/* the chart now: you and the rivals in order, the days left, the battle on offer */
export function chartState(data, now = Date.now()) {
  const c = data.charts || {}, wk = weekOf(now), tier = Math.max(0, Math.min(VENUES.length - 1, c.tier || 0));
  const at = (now - weekStart(wk)) / (7 * DAY), you = weekXP(data, wk);
  const rows = [...chartRivals(wk, tier, at, you), { id: "you", name: "You", xp: you, you: true, today: weekXP(data, wk) - weekXP(data, wk, now - DAY) }]
    .sort((a, b) => b.xp - a.xp || (a.you ? -1 : b.you ? 1 : 0)).map((x, i) => ({ ...x, rank: i + 1 }));
  const me = rows.find(x => x.you), above = me.rank > 1 ? rows[me.rank - 2] : rows[1]; /* at the top, the one chasing you */
  const today = dayKey(now), b = c.battle?.day === today ? c.battle : null;
  return {
    week: wk, tier, name: venueName(tier), next: tier < VENUES.length - 1 ? venueName(tier + 1) : null,
    daysLeft: Math.max(0, Math.ceil((weekStart(wk) + 7 * DAY - now) / DAY)), rows, you: me, rival: above,
    battle: b, records: c.records || [], last: c.last && !c.last.seen ? c.last : null
  };
}
/* today's rival battle: the player just above you, on a song you can play, with the score to beat */
export function battleFor(data, now = Date.now()) {
  const st = chartState(data, now);
  if (st.battle) return st.battle;
  if (!st.rival) return null;
  const songs = (data.songs || []).filter(s => s.format !== "tab" && /\S/.test(s.body || "") && sheetChords(s.body).length);
  if (!songs.length) return null;
  const best = data.gig?.best || {}, r = rand(hashDay(`${dayKey(now)}:${st.rival.name}`));
  const pool = songs.slice().sort((a, b) => (best[b.id] ?? -1) - (best[a.id] ?? -1) || String(a.id).localeCompare(String(b.id))).slice(0, 5);
  const song = pool[Math.floor(r() * pool.length)];
  return { day: dayKey(now), rival: st.rival.name, songId: song.id, target: Math.min(95, 55 + st.tier * 4 + Math.floor(r() * 18)) };
}
export function startBattle(data, now = Date.now()) {
  const b = battleFor(data, now);
  if (!b) return null;
  (data.charts || (data.charts = { tier: 0 })).battle = b;
  return b;
}
/* A new week: last week's place, a move up for the top 5 and that tier's record */
export function chartsSettle(data, now = Date.now()) {
  const c = data.charts || (data.charts = { tier: 0 }), wk = weekOf(now);
  if (!c.week) { c.week = wk; return null; }
  if (c.week === wk) return null;
  const prev = c.week, tier = c.tier || 0, you = weekXP(data, prev);
  const rows = [...chartRivals(prev, tier, 1, you), { you: true, xp: you }].sort((a, b) => b.xp - a.xp || (a.you ? -1 : b.you ? 1 : 0));
  const rank = rows.findIndex(x => x.you) + 1, up = you > 0 && rank <= CHART_PROMOTE && tier < VENUES.length - 1;
  const down = !up && rank > rows.length - CHART_DEMOTE && tier > 0;
  if (you > 0 && rank <= CHART_PROMOTE) (c.records || (c.records = [])).push({ tier, week: prev, rank });
  c.last = { week: prev, tier, rank, xp: you, up, ...(down ? { down: true } : {}) };
  if (up) c.tier = tier + 1;
  if (down) c.tier = tier - 1;
  c.week = wk;
  return c.last;
}
/* a gig finished: XP for it, and the battle if it was today's battle song */
function chartsShow(data, songId, g, pct, now, mult = 1) {
  addXP(data, mult * (g.hits * XP.landed + (g.last.length >= 6 && gigCrowd(g) >= 10 ? XP.crowd : 0)), now);
  const b = data.charts?.battle;
  if (!b || b.day !== dayKey(now) || b.songId !== songId || b.result || pct === null) return null;
  b.result = pct >= b.target ? "won" : "lost"; b.pct = pct;
  if (b.result === "won") { addXP(data, mult * XP.battle, now); data.charts.fans = (data.charts.fans || 0) + XP.battleFans; }
  return { ...b };
}
export function cleanCharts(raw) {
  if (!isObj(raw)) return null;
  const day = /^\d{4}-\d\d-\d\d$/, out = { tier: Math.max(0, Math.min(VENUES.length - 1, Math.floor(+raw.tier || 0))) };
  if (day.test(raw.week)) out.week = raw.week;
  const fans = Math.max(0, Math.min(1e7, Math.floor(+raw.fans || 0))); if (fans) out.fans = fans;
  const recs = (Array.isArray(raw.records) ? raw.records : []).filter(r => isObj(r) && day.test(r.week) && r.rank >= 1 && r.rank <= 10).slice(-100).map(r => ({ tier: Math.max(0, Math.min(VENUES.length - 1, Math.floor(+r.tier || 0))), week: r.week, rank: Math.floor(r.rank) }));
  if (recs.length) out.records = recs;
  if (isObj(raw.last) && day.test(raw.last.week)) out.last = { week: raw.last.week, tier: Math.floor(+raw.last.tier || 0), rank: Math.floor(+raw.last.rank || 0), xp: Math.max(0, Math.floor(+raw.last.xp || 0)), up: raw.last.up === true, ...(raw.last.down === true ? { down: true } : {}), ...(raw.last.seen === true ? { seen: true } : {}) };
  const b = raw.battle;
  if (isObj(b) && day.test(b.day) && typeof b.songId === "string" && typeof b.rival === "string") out.battle = { day: b.day, rival: b.rival.slice(0, 40), songId: b.songId.slice(0, 40), target: Math.max(0, Math.min(100, Math.round(+b.target || 0))), ...(b.result === "won" || b.result === "lost" ? { result: b.result, pct: Math.max(0, Math.min(100, Math.round(+b.pct || 0))) } : {}) };
  return out.tier || out.week || out.records || out.fans || out.battle ? out : null;
}
export function cleanXP(raw) {
  if (!isObj(raw) || !isObj(raw.days)) return null;
  const days = {};
  for (const [k, v] of Object.entries(raw.days).slice(-90)) if (/^\d{4}-\d\d-\d\d$/.test(k) && v > 0) days[k] = Math.min(1e5, Math.round(v));
  const life = raw.life >= 0 ? Math.min(1e8, Math.round(raw.life)) : null;
  return Object.keys(days).length || life ? { days, ...(life != null ? { life } : {}) } : null;
}

// ---------- Levels and badges (4.17.0): the player card on Your profile ----------
// Your level comes from all the XP you've earned: 10 a play (lifetime plays, from the journal) plus the
// gig and quest XP in data.xp.life. Level L starts at 50 x (L-1) x L XP: 100 for level 2, 300 for 3,
// 600 for 4, so each level takes a little longer. Badges are worked out from what's already saved.
export const levelStart = L => 50 * (L - 1) * L;
export function xpTotal(data) {
  const x = data.xp, bonus = x?.life >= 0 ? x.life : Object.values(x?.days || {}).reduce((a, b) => a + (b || 0), 0);
  return lifetimePlays(data) * XP.play + bonus;
}
export function levelOf(data) {
  const xp = xpTotal(data);
  let level = 1;
  while (xp >= levelStart(level + 1)) level++;
  const from = levelStart(level), to = levelStart(level + 1);
  return { level, xp, from, to, into: xp - from, need: to - from };
}
/* ---- Achievement callouts (4.44.0, #77) ----
   achSettle(data, p, had) after a play: what to celebrate now. A level or badge is celebrated once
   (data.ach keeps what was seen); the first time it runs, everything you already have counts as seen.
   had: the chords journaled before the play, so a new one gets its own callout. */
export const COMBO_STEPS = [10, 25, 50, 100];
export function achSettle(data, p, had = null) {
  const lv = levelOf(data).level, got = badgesOf(data, p).got;
  const seen = isObj(data.ach) ? data.ach : null, out = [];
  if (had) for (const c of p.chords) if (!had.has(c.name)) out.push({ kind: "chord", word: "NEW CHORD", big: c.name });
  if (seen) {
    if (lv > (seen.level || 1)) out.push({ kind: "level", word: "LEVEL UP", big: String(lv) });
    for (const b of got) if (!(seen.badges || []).includes(b.id)) out.push({ kind: "badge", word: b.lab, big: b.top });
  }
  data.ach = { level: Math.max(lv, seen?.level || 1), badges: [...new Set([...(seen?.badges || []), ...got.map(b => b.id)])] };
  return out.slice(0, 3); /* a big night caps at three callouts; the rest are on Your profile */
}
/* Variations (#79): each kind has a few looks; the next one is never the one just shown. */
export const CALLOUT_LOOKS = { earn: ["pow"], combo: ["bolt", "rays", "burst"], chord: ["stamp", "burst"], level: ["light", "rays"], badge: ["flip", "burst", "rays"], join: ["burst", "light"], lesson: ["rays", "burst"] };
export function pickLook(kind, last, r = Math.random()) {
  const looks = CALLOUT_LOOKS[kind] || ["burst"], pool = looks.length > 1 ? looks.filter(x => x !== last) : looks;
  return pool[Math.floor(r * pool.length) % pool.length];
}
/* Your band celebrates (#80): only friends who've joined; some kinds have their own (Beat for combos,
   Lola for chords, Metro for levels, Tilly for lessons); otherwise one of the band, not the last one shown. */
const CALLOUT_CAST = { combo: "beat", chord: "lola", level: "metro", lesson: "tilly" };
export function castFor(data, kind, last, r = Math.random(), who = null) {
  const joined = bandState(data).joined.map(b => b.id);
  if (who && joined.includes(who)) return who;
  const own = CALLOUT_CAST[kind];
  if (own && joined.includes(own) && own !== last) return own;
  const pool = joined.length > 1 ? joined.filter(x => x !== last) : joined;
  return pool.length ? pool[Math.floor(r * pool.length) % pool.length] : null;
}
/* p is profileOf(data): the journal's numbers (chords, best streak, songs got, tune-ups) */
export function badgesOf(data, p) {
  const shows = data.gig?.shows || 0, ring = venueOf(lifetimePlays(data)).ring, band = bandState(data);
  const won = (data.duels?.list || []).some(d => duelWon(d) === true), promoted = (data.charts?.records || []).length > 0;
  const b = (id, top, lab, kind, got) => ({ id, top, lab, kind, got: !!got });
  const all = [
    b("song1", "1st", "SONG PLAYED", "song", p.songsPlayed >= 1), b("song10", "10", "SONGS PLAYED", "song", p.songsPlayed >= 10), b("song25", "25", "SONGS PLAYED", "song", p.songsPlayed >= 25),
    b("show1", "1st", "GIG", "show", shows >= 1), b("show10", "10", "GIGS", "show", shows >= 10), b("show50", "50", "GIGS", "show", shows >= 50), b("show100", "100", "GIGS", "show", shows >= 100),
    b("streak7", "7", "NIGHT STREAK", "streak", p.best >= 7), b("streak30", "30", "NIGHT STREAK", "streak", p.best >= 30), b("streak100", "100", "NIGHT STREAK", "streak", p.best >= 100),
    b("chords5", "5", "CHORDS", "chord", p.chords.length >= 5), b("chords10", "10", "CHORDS", "chord", p.chords.length >= 10), b("chords20", "20", "CHORDS", "chord", p.chords.length >= 20), b("barre", "1st", "BARRE CHORD", "chord", p.barres >= 1),
    b("writer", "1st", "SONG WRITTEN", "song", (data.songs || []).some(x => x.sketch)), /* 4.74.0: Sing it */
    b("got1", "1st", "SONG GOT", "song", p.got >= 1), b("got10", "10", "SONGS GOT", "song", p.got >= 10),
    b("openmic", VENUES[1].toUpperCase(), "REACHED", "venue", ring >= 1), b("coffee", "CAFE", VENUES[2].toUpperCase(), "venue", ring >= 2), b("club", VENUES[3].toUpperCase(), "REACHED", "venue", ring >= 3),
    b("band1", "1st", "BAND MEMBER", "band", band.joined.length >= 1), b("drums", "BEAT", "ON DRUMS", "band", band.joined.some(x => x.id === "beat")), b("band18", "ALL", "FULL BAND", "band", band.joined.length >= BAND.length),
    b("promoted", "UP", "PROMOTED", "chart", promoted), b("duel", "WIN", "SONG DUEL", "chart", won), b("tune10", "10", "TUNE-UPS", "streak", p.tune.sessions >= 10)
  ];
  return { all, got: all.filter(x => x.got) };
}

// ---------- Your band (4.7.0): Louie's friends join as you play ----------
// Each friend joins after a number of songs played through (lifetime plays). Beat (drums) plays behind
// you in gigs once he's joined, unless Settings or the Band tab turn that off (Bex's bass went in 4.42.0).
export const BAND = [
  ["lola", 1], ["tilly", 3], ["beat", 6, "drums"], ["metro", 10], ["bex", 15], ["jax", 20], ["milo", 26], ["pip", 32], ["key", 40],
  ["strap", 48], ["slide", 56], ["shaker", 65], ["pickup", 75], ["humb", 85], ["reverb", 95], ["triangle", 110], ["whammy", 125], ["looper", 140],
  ["clip", 160], ["vial", 180], ["bottle", 200], /* 4.37.0: Graham's art, 2026-10-22 */
  ["gigbag", 225], ["kazo", 250], ["tuk", 275], ["capo", 300], ["spool", 330], ["peg", 360] /* 4.38.0 */
].map(([id, at, plays]) => ({ id, at, ...(plays ? { plays } : {}) }));
export function bandState(data) {
  const plays = lifetimePlays(data), seen = new Set(data.band?.seen || []);
  const members = BAND.map(b => ({ ...b, joined: plays >= b.at, fresh: plays >= b.at && !seen.has(b.id) }));
  const next = members.find(b => !b.joined) || null;
  return { plays, members, joined: members.filter(b => b.joined), next: next && { ...next, more: next.at - plays } };
}
/* who has joined since you last looked; marks them met */
export function bandMeet(data) {
  const st = bandState(data), fresh = st.members.filter(b => b.fresh);
  if (fresh.length) { const b = data.band || (data.band = { seen: [] }); b.seen = [...new Set([...(b.seen || []), ...fresh.map(x => x.id)])]; }
  return fresh;
}
/* the parts your band plays in a gig: drums once Beat has joined */
export function bandParts(data) {
  if (data.settings?.bandPlays === false) return {};
  const st = bandState(data), has = id => st.joined.some(b => b.id === id);
  return { drums: has("beat") };
}
export function cleanBand(raw) {
  if (!isObj(raw)) return null;
  const seen = (Array.isArray(raw.seen) ? raw.seen : []).filter(id => BAND.some(b => b.id === id));
  return seen.length ? { seen } : null;
}

// ---------- Rehearse (4.8.0): the soundcheck and the changes you dropped ----------
// A gig keeps the chord changes you missed (from > to, the last 14 days). Today's soundcheck is built from
// the two you missed most in the last week: drill both (switch lessons) and it's done, worth 20 XP once a day.
// With nothing missed yet, it's the next switch on the neck.
export const SOUNDCHECK_XP = 20;
export function rehearseMisses(data, missed = {}, now = Date.now(), landed = {}) {
  const keep = dayKey(now - 14 * DAY), today = dayKey(now);
  const add = (field, src) => {
    const pairs = Object.entries(src).filter(([k, n]) => n > 0 && /^[^>]+>[^>]+$/.test(k));
    if (!pairs.length) return;
    const r = data.rehearse || (data.rehearse = {}), m = r[field] || (r[field] = {});
    for (const [k, n] of pairs) { const x = m[k] || (m[k] = { n: 0, days: {} }); x.days[today] = (x.days[today] || 0) + n; }
    for (const [k, x] of Object.entries(m)) { for (const d of Object.keys(x.days)) if (d < keep) delete x.days[d]; x.n = Object.values(x.days).reduce((a, b) => a + b, 0); if (!x.n) delete m[k]; }
  };
  add("misses", missed);
  add("lands", landed); /* 4.23.0: the changes you landed, for Your changes */
}
/* the changes you dropped, most first: [{ a, b, n }] over the last `days` days */
export function missedChanges(data, now = Date.now(), days = 14) {
  const from = dayKey(now - (days - 1) * DAY);
  return Object.entries(data.rehearse?.misses || {}).map(([k, x]) => {
    const [a, b] = k.split(">"), n = Object.entries(x.days || {}).reduce((t, [d, c]) => d >= from ? t + c : t, 0);
    return { a, b, id: `s:${a}-${b}`, n };
  }).filter(x => x.n > 0).sort((p, q) => q.n - p.n || p.id.localeCompare(q.id));
}
export function soundcheck(data, now = Date.now()) {
  const today = dayKey(now), sc = data.rehearse?.sc?.day === today ? data.rehearse.sc : { day: today, got: [] };
  let pairs = missedChanges(data, now, 7).slice(0, 2);
  const fromMisses = pairs.length > 0;
  if (!pairs.length) {
    const sw = skillState(data, now).levels.flatMap(l => l.steps).find(s => s.kind === "switch" && s.state === "now")
      || skillState(data, now).levels.flatMap(l => l.steps).filter(s => s.kind === "switch" && s.state === "done").sort((a, b) => (a.best || 0) - (b.best || 0))[0];
    if (sw) pairs = [{ a: sw.a, b: sw.b, id: sw.id, n: 0 }];
  }
  if (sc.pairs) pairs = sc.pairs.map(id => { const [a, b] = id.slice(2).split(/-(.+)/); return { a, b, id, n: pairs.find(p => p.id === id)?.n || 0 }; });
  return { day: today, pairs: pairs.map(p => ({ ...p, done: (sc.got || []).includes(p.id) })), fromMisses, done: !!sc.done };
}
/* a switch lesson finished: if it's in today's soundcheck, tick it; the last one done earns the XP */
export function soundcheckDone(data, id, now = Date.now()) {
  const st = soundcheck(data, now);
  if (!st.pairs.some(p => p.id === id)) return null;
  const r = data.rehearse || (data.rehearse = {});
  const sc = r.sc?.day === st.day ? r.sc : (r.sc = { day: st.day, got: [], pairs: st.pairs.map(p => p.id) });
  if (!sc.pairs) sc.pairs = st.pairs.map(p => p.id);
  if (!sc.got.includes(id)) sc.got.push(id);
  if (sc.done || !sc.pairs.every(p => sc.got.includes(p))) return { done: false, left: sc.pairs.length - sc.got.length };
  sc.done = true; addXP(data, SOUNDCHECK_XP, now);
  return { done: true, xp: SOUNDCHECK_XP };
}
export function cleanRehearse(raw) {
  if (!isObj(raw)) return null;
  const day = /^\d{4}-\d\d-\d\d$/, out = {}, misses = {};
  for (const [k, x] of Object.entries(isObj(raw.misses) ? raw.misses : {}).slice(0, 200)) {
    if (!/^[^>]{1,12}>[^>]{1,12}$/.test(k) || !isObj(x?.days)) continue;
    const days = {}; for (const [d, n] of Object.entries(x.days)) if (day.test(d) && n > 0) days[d] = Math.min(9999, Math.round(n));
    const n = Object.values(days).reduce((a, b) => a + b, 0); if (n) misses[k] = { n, days };
  }
  if (Object.keys(misses).length) out.misses = misses;
  const lands = {};
  for (const [k, x] of Object.entries(isObj(raw.lands) ? raw.lands : {}).slice(0, 200)) {
    if (!/^[^>]{1,12}>[^>]{1,12}$/.test(k) || !isObj(x?.days)) continue;
    const days = {}; for (const [d, n] of Object.entries(x.days)) if (day.test(d) && n > 0) days[d] = Math.min(9999, Math.round(n));
    const n = Object.values(days).reduce((a, b) => a + b, 0); if (n) lands[k] = { n, days };
  }
  if (Object.keys(lands).length) out.lands = lands;
  const sc = raw.sc;
  if (isObj(sc) && day.test(sc.day)) out.sc = { day: sc.day, got: (Array.isArray(sc.got) ? sc.got : []).filter(x => typeof x === "string").slice(0, 4), ...(Array.isArray(sc.pairs) ? { pairs: sc.pairs.filter(x => typeof x === "string").slice(0, 4) } : {}), ...(sc.done === true ? { done: true } : {}) };
  const lesson = cleanLesson(raw.lesson);
  if (lesson) out.lesson = lesson;
  return out.misses || out.lands || out.sc || out.lesson ? out : null;
}

// ---------- Your changes (4.23.0): in Rehearse, the three your songs need most that you land least ----------
// A change is a pair, either direction ("C to Dm" and "Dm to C" are one). How often you landed it in gigs
// over the last 7 days comes from data.rehearse.lands and .misses; a change you haven't tried is "not tried
// yet" and ranks first among equals. One more is "solid": the one you land best (90% or more, five tries or more).
export const CHANGES_DAYS = 7;
export function changesToWork(data, now = Date.now()) {
  const from = dayKey(now - (CHANGES_DAYS - 1) * DAY);
  const sum = (field, a, b) => [`${a}>${b}`, `${b}>${a}`].reduce((t, k) => t + Object.entries(data.rehearse?.[field]?.[k]?.days || {}).reduce((n, [d, c]) => d >= from ? n + c : n, 0), 0);
  const songs = (data.songs || []).filter(s => s.format !== "tab");
  const full = changesOfAll(songs);
  const rows = full.filter(c => chordShape(c.a) && chordShape(c.b)).map(c => {
    const landed = sum("lands", c.a, c.b), missed = sum("misses", c.a, c.b), of = landed + missed;
    return { a: c.a, b: c.b, id: `s:${c.a}-${c.b}`, landed, of, rate: of ? landed / of : 0, tried: of > 0, times: c.best?.n || 0, inSongs: c.inSongs, songCount: c.songCount, song: c.best?.title || "" };
  });
  const solid = rows.filter(r => r.of >= 5 && r.rate >= 0.9).sort((x, y) => y.landed - x.landed || (x.id < y.id ? -1 : 1))[0] || null;
  const work = rows.filter(r => r !== solid && !(r.of >= 5 && r.rate >= 0.9))
    .sort((x, y) => x.rate - y.rate || y.inSongs - x.inSongs || (x.id < y.id ? -1 : 1)).slice(0, 3)
    .map(r => ({ ...r, why: r.songCount <= 1 ? `In ${r.song}, ${r.inSongs} time${r.inSongs === 1 ? "" : "s"}` : `In ${r.songCount} of your songs, ${r.inSongs} times` }));
  return { work, solid };
}
/* every change in the songs, with the song that has it most: the ranking above needs all of them */
function changesOfAll(songs) {
  const map = new Map();
  for (const s of songs) for (const [k, x] of songChanges(s)) {
    const c = map.get(k) || { key: k, inSongs: 0, dir: {}, songs: [] };
    c.inSongs += x.n; c.songs.push({ id: s.id, title: s.title, n: x.n });
    for (const [d, n] of Object.entries(x.dir)) c.dir[d] = (c.dir[d] || 0) + n;
    map.set(k, c);
  }
  return [...map.values()].map(c => {
    const [d] = Object.entries(c.dir).sort((x, y) => y[1] - x[1])[0], [a, b] = d.split(">");
    c.songs.sort((x, y) => y.n - x.n || (x.title < y.title ? -1 : 1));
    return { key: c.key, a, b, inSongs: c.inSongs, songCount: c.songs.length, best: c.songs[0] };
  });
}

// ---------- Lesson of the day (4.21.0) ----------
// About four minutes, built from his own songs, the same all day:
//   1. warm up on a change he already has (a switch lesson he passed, else the change he plays most)
//   2. learn the change his songs need most that he hasn't learned (a learning song's first),
//      with the song it comes from and how many times it's in it
//   3. play the section of that song holding the change at 70%, looped: two passes count
// Kept in data.rehearse.lesson = { day, plan, done: [0..2], xp? }. All three done: LESSON_XP once.
export const LESSON_XP = 40;
export const LESSON_PASSES = 2;
const pairId = (a, b) => `s:${a}-${b}`;
/* the section (its order among the song's section labels) holding a change most, with its name */
function sectionOf(song, a, b) {
  const steps = shapeSteps(song), counts = new Map();
  let sec = -1, name = "", prev = null;
  for (const l of chordModel(song.body || "")) {
    if (l.kind === "section") { sec++; name = l.text; prev = null; continue; }
    const cs = l.kind === "lyric" ? l.chords.map(c => c.chord) : l.kind === "chords" ? l.text.split(/\s+/).map(t => t.replace(/^\(|\)$/g, "")) : [];
    for (const c of cs) {
      if (!c || !isChord(c)) continue;
      const x = transposeChord(c, steps, /^[A-G]b/.test(c));
      if (prev && prev !== x && ((prev === a && x === b) || (prev === b && x === a)) && sec >= 0) { const k = counts.get(sec) || { sec, name, n: 0 }; k.n++; counts.set(sec, k); }
      prev = x;
    }
  }
  return [...counts.values()].sort((p, q) => q.n - p.n || p.sec - q.sec)[0] || null;
}
function planLesson(data, now) {
  const songs = (data.songs || []).filter(s => s.format !== "tab" && s.body);
  if (!songs.length) return null;
  const learned = new Set(Object.keys(data.skills?.done || {}).filter(id => id.startsWith("s:")).flatMap(id => { const [a, b] = id.slice(2).split(/-(.+)/); return [a + "|" + b, b + "|" + a]; }));
  const all = new Map();
  for (const s of songs) for (const [k, x] of songChanges(s)) {
    const c = all.get(k) || { key: k, inSongs: 0, week: 0, learning: false, dir: {}, best: null };
    c.inSongs += x.n; c.week += playsThisWeek(s, now) * x.n;
    if (s.status === "learning") c.learning = true;
    for (const [d, n] of Object.entries(x.dir)) c.dir[d] = (c.dir[d] || 0) + n;
    const mine = { id: s.id, title: s.title, n: x.n, learning: s.status === "learning" };
    if (!c.best || (mine.learning && !c.best.learning) || (mine.learning === c.best.learning && mine.n > c.best.n)) c.best = mine;
    all.set(k, c);
  }
  const dirOf = c => Object.entries(c.dir).sort((x, y) => y[1] - x[1])[0][0].split(">");
  const fresh = [...all.values()].filter(c => !learned.has(c.key) && c.key.split("|").every(n => chordShape(n)))
    .sort((x, y) => (y.learning - x.learning) || y.inSongs - x.inSongs || (x.key < y.key ? -1 : 1));
  if (!fresh.length) return null;
  /* the same all day; among changes nearly as needed as the top one (up to three), a different one each day */
  const close = fresh.filter(c => c.learning === fresh[0].learning && c.inSongs * 2 >= fresh[0].inSongs).slice(0, 3);
  const dayN = Math.floor(new Date(dayKey(now) + "T12:00:00").getTime() / DAY);
  const pick = close[dayN % close.length];
  const [na, nb] = dirOf(pick), song = (data.songs || []).find(s => s.id === pick.best.id);
  const sec = song ? sectionOf(song, na, nb) : null;
  /* the warm-up: the passed switch with the best tempo, else the change he plays most, else G to C */
  const passed = Object.entries(data.skills?.done || {}).filter(([id]) => id.startsWith("s:") && id !== pairId(na, nb))
    .sort((p, q) => (q[1].best || 0) - (p[1].best || 0) || (q[1].n || 0) - (p[1].n || 0) || (p[0] < q[0] ? -1 : 1))[0];
  let warm;
  if (passed) { const [a, b] = passed[0].slice(2).split(/-(.+)/); warm = { a, b, why: "A change you already have" }; }
  else {
    const most = [...all.values()].filter(c => c.week > 0 && c.key !== pick.key && c.key.split("|").every(n => chordShape(n))).sort((x, y) => y.week - x.week || (x.key < y.key ? -1 : 1))[0];
    if (most) { const [a, b] = dirOf(most); warm = { a, b, why: "The change you play most" }; }
    else warm = pick.key === "C|G" ? { a: "Em", b: "C", why: "To get your hands going" } : { a: "G", b: "C", why: "To get your hands going" };
  }
  return {
    warm: { id: pairId(warm.a, warm.b), a: warm.a, b: warm.b, why: warm.why },
    learn: { id: pairId(na, nb), a: na, b: nb, song: pick.best.title, times: pick.best.n, inSongs: pick.inSongs },
    play: { songId: pick.best.id, title: pick.best.title, sec: sec ? sec.sec : -1, secName: sec ? sec.name : "", rate: 0.7 }
  };
}
export function lessonOfDay(data, now = Date.now()) {
  const day = dayKey(now), saved = data.rehearse?.lesson?.day === day ? data.rehearse.lesson : null;
  const plan = saved?.plan || planLesson(data, now);
  if (!plan) return null;
  const done = saved?.done || [];
  return { day, ...plan, done: [0, 1, 2].map(i => done.includes(i)), now: [0, 1, 2].find(i => !done.includes(i)) ?? -1, finished: !!saved?.xp, xp: LESSON_XP };
}
/* keep today's plan, so finishing a part (which marks a switch learned) doesn't change the lesson under it */
export function lessonKeep(data, now = Date.now()) {
  const st = lessonOfDay(data, now);
  if (!st) return null;
  const r = data.rehearse || (data.rehearse = {});
  return r.lesson?.day === st.day ? r.lesson : (r.lesson = { day: st.day, plan: { warm: st.warm, learn: st.learn, play: st.play }, done: [] });
}
/* a part finished (0 warm up, 1 the new change, 2 the song): kept with the day's plan; all three earn the XP once */
export function lessonDone(data, part, now = Date.now()) {
  if (![0, 1, 2].includes(part)) return null;
  const l = lessonKeep(data, now);
  if (!l) return null;
  if (!l.done.includes(part)) l.done.push(part);
  if (l.xp || l.done.length < 3) return { finished: false, left: 3 - l.done.length };
  l.xp = true; addXP(data, LESSON_XP, now);
  return { finished: true, xp: LESSON_XP };
}
/* which part a finished switch lesson is, in today's lesson (-1: neither) */
export function lessonPartOf(data, id, now = Date.now()) {
  const st = lessonOfDay(data, now);
  return !st ? -1 : st.warm.id === id ? 0 : st.learn.id === id ? 1 : -1;
}
const cleanPair = p => isObj(p) && typeof p.a === "string" && typeof p.b === "string" && p.a.length <= 12 && p.b.length <= 12 ? { id: pairId(p.a, p.b), a: p.a, b: p.b } : null;
function cleanLesson(l) {
  if (!isObj(l) || !/^\d{4}-\d\d-\d\d$/.test(l.day) || !isObj(l.plan)) return null;
  const w = cleanPair(l.plan.warm), n = cleanPair(l.plan.learn), p = l.plan.play;
  if (!w || !n || !isObj(p) || typeof p.songId !== "string") return null;
  const str = (x, k) => String(x || "").slice(0, k);
  return { day: l.day, plan: {
    warm: { ...w, why: str(l.plan.warm.why, 40) },
    learn: { ...n, song: str(l.plan.learn.song, 120), times: Math.max(0, Math.min(999, Math.round(+l.plan.learn.times || 0))), inSongs: Math.max(0, Math.min(9999, Math.round(+l.plan.learn.inSongs || 0))) },
    play: { songId: str(p.songId, 64), title: str(p.title, 120), sec: Math.max(-1, Math.min(99, Math.round(+p.sec))), secName: str(p.secName, 40), rate: 0.7 }
  }, done: (Array.isArray(l.done) ? l.done : []).filter(x => [0, 1, 2].includes(x)).filter((x, i, a) => a.indexOf(x) === i), ...(l.xp === true ? { xp: true } : {}) };
}

// ---------- Song duels (4.12.0): beat a friend's score on a song, by link ----------
// After a scored gig you send "I hit 88% on River Road. Beat it." The link carries the song and your score.
// Your friend plays it as a gig and sends their score back the same way. No server: each phone keeps its own
// list of duels in data.duels, { name, list: [{ id, title, artist, songId, opp, mine, theirs, started, at }] }.
const score = x => isObj(x) && x.pct >= 0 && x.pct <= 100 ? { pct: Math.round(x.pct), combo: Math.max(0, Math.min(9999, Math.round(+x.combo || 0))), crowd: Math.max(0, Math.min(12, Math.round(+x.crowd || 0))) } : null;
export function cleanDuelLink(d) {
  if (!isObj(d) || typeof d.id !== "string" || !/^[a-z0-9]{6,24}$/.test(d.id) || typeof d.from !== "string") return null;
  const sc = score(d);
  if (!sc) return null;
  const wk = typeof d.wk === "string" && /^\d{4}-\d\d-\d\d$/.test(d.wk) && d.xp >= 0 ? { xp: Math.min(1e5, Math.round(d.xp)), wk: d.wk } : {};
  return { id: d.id, from: d.from.trim().slice(0, 30) || "A friend", ...sc, ...wk, ...(d.reply === true ? { reply: true } : {}) };
}
const duelsOf = data => data.duels || (data.duels = { list: [] });
/* you challenge a friend: the duel starts with your score */
export function startDuel(data, song, mine, now = Date.now()) {
  const id = (now.toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 14);
  const d = { id, title: song.title, artist: song.artist || "", songId: song.id, opp: "", mine: score(mine), theirs: null, started: "me", at: now };
  const ds = duelsOf(data); ds.list.unshift(d); ds.list = ds.list.slice(0, 100);
  return d;
}
/* a link comes in: a challenge to answer, or the answer to yours. It also brings that friend's XP this week. */
export function takeDuel(data, link, song, now = Date.now()) {
  const ds = duelsOf(data), sc = score(link);
  if (link.wk) { const f = ds.friends || (ds.friends = {}); f[link.from] = { xp: link.xp, wk: link.wk, at: now }; }
  let d = ds.list.find(x => x.id === link.id);
  if (link.reply) {
    if (!d) return null;
    d.theirs = sc; d.opp = link.from; d.at = now;
    return d;
  }
  if (d) return d; /* the same challenge opened twice */
  d = { id: link.id, title: song.title, artist: song.artist || "", songId: song.id, opp: link.from, mine: null, theirs: sc, started: "them", at: now };
  ds.list.unshift(d); ds.list = ds.list.slice(0, 100);
  return d;
}
/* a scored gig answers the oldest open challenge on that song */
function duelsShow(data, songId, sc) {
  if (!sc || !data.duels?.list) return null;
  const d = data.duels.list.filter(x => x.songId === songId && x.started === "them" && !x.mine && x.theirs).pop();
  if (!d) return null;
  d.mine = sc;
  return { ...d };
}
export const duelWon = d => d?.mine && d?.theirs ? (d.mine.pct > d.theirs.pct ? true : d.mine.pct < d.theirs.pct ? false : null) : undefined;
/* Friends (4.13.0): everyone you've dueled, with your record and their XP this week (as of their last link) */
export function friendsOf(data, now = Date.now()) {
  const wk = weekOf(now), names = [...new Set((data.duels?.list || []).map(d => d.opp).filter(Boolean))];
  return names.map(name => {
    const f = data.duels?.friends?.[name], rec = duelRecord(data, name), last = data.duels.list.find(d => d.opp === name);
    return { name, ...rec, xp: f?.wk === wk ? f.xp : 0, seen: f?.at || last?.at || 0, last };
  }).sort((a, b) => b.xp - a.xp || b.seen - a.seen);
}
/* Friend quest (4.13.0): this week, you and one friend earn XP toward one goal (their XP arrives with their links) */
export const FRIEND_QUEST = { goal: 300, fans: 50 };
export function friendQuest(data, now = Date.now()) {
  const fr = friendsOf(data, now);
  if (!fr.length) return null;
  const wk = weekOf(now), q = data.quests?.fq?.wk === wk ? data.quests.fq : null;
  const pal = fr.find(f => f.name === q?.with) || fr.slice().sort((a, b) => b.seen - a.seen)[0];
  const mine = weekXP(data, wk, now), theirs = pal.xp;
  return { with: pal.name, goal: FRIEND_QUEST.goal, mine, theirs, seen: pal.seen, done: mine + theirs >= FRIEND_QUEST.goal, claimed: !!q?.claimed, friends: fr.map(f => f.name) };
}
export function friendQuestPick(data, name, now = Date.now()) {
  const q = data.quests || (data.quests = { fans: 0 }), wk = weekOf(now);
  q.fq = { wk, with: name, ...(q.fq?.wk === wk && q.fq.claimed ? { claimed: true } : {}) };
}
export function friendQuestSettle(data, now = Date.now()) {
  const fq = friendQuest(data, now);
  if (!fq?.done || fq.claimed) return 0;
  const q = data.quests || (data.quests = { fans: 0 });
  q.fq = { wk: weekOf(now), with: fq.with, claimed: true };
  q.fans = (q.fans || 0) + FRIEND_QUEST.fans;
  return FRIEND_QUEST.fans;
}
/* your record against one friend: wins, losses, and the last few results (newest first) */
export function duelRecord(data, opp) {
  const done = (data.duels?.list || []).filter(d => d.opp === opp && duelWon(d) !== undefined);
  return { w: done.filter(d => duelWon(d) === true).length, l: done.filter(d => duelWon(d) === false).length, last: done.slice(0, 5).map(d => duelWon(d)) };
}
export function cleanDuels(raw) {
  if (!isObj(raw)) return null;
  const out = {};
  if (typeof raw.name === "string" && raw.name.trim()) out.name = raw.name.trim().slice(0, 30);
  const list = (Array.isArray(raw.list) ? raw.list : []).filter(d => isObj(d) && typeof d.id === "string" && /^[a-z0-9]{6,24}$/.test(d.id) && typeof d.title === "string").slice(0, 100)
    .map(d => ({ id: d.id, title: d.title.slice(0, 100), artist: String(d.artist || "").slice(0, 100), songId: String(d.songId || "").slice(0, 40), opp: String(d.opp || "").slice(0, 30), mine: score(d.mine), theirs: score(d.theirs), started: d.started === "them" ? "them" : "me", at: Math.max(0, Math.floor(+d.at || 0)) }));
  if (list.length) out.list = list;
  const fr = {};
  for (const [k, v] of Object.entries(isObj(raw.friends) ? raw.friends : {}).slice(0, 100)) if (k && k.length <= 30 && isObj(v) && /^\d{4}-\d\d-\d\d$/.test(v.wk)) fr[k] = { xp: Math.max(0, Math.min(1e5, Math.round(+v.xp || 0))), wk: v.wk, at: Math.max(0, Math.floor(+v.at || 0)) };
  if (Object.keys(fr).length) out.friends = fr;
  return out.name || out.list || out.friends ? out : null;
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

// ---------- The Gig (4.1.0): a song played as a scored show ----------
// Chord Catch (4.54.0): the show asks one question, did you play the chord? Not when. The chords of the song are
// the targets, one for each run of the same chord. The phone listens for the one you are on and the one after
// it (a yes or no against one or two shapes), and a target is caught when two readings in a row fit it.
// A caught chord stays caught. Nothing snaps and nothing fails; a chord that went by is simply plain.
export function gigStart() { return { hits: 0, misses: 0, combo: 0, best: 0, last: [] }; }
/* one chord scored: the bookkeeping the show and the crowd share */
export function catchScore(g, hit) {
  if (hit) { g.hits++; g.combo++; g.best = Math.max(g.best, g.combo); }
  else { g.misses++; g.combo = 0; }
  g.last.push(!!hit); if (g.last.length > 12) g.last.shift();
  return !!hit;
}
/* how many of the 12 in the crowd are cheering: your last 12 chords (half the crowd before any) */
export const gigCrowd = g => g.last.length ? Math.round(12 * g.last.filter(Boolean).length / g.last.length) : 6;
/* the share of chords caught, 0 to 100 (null with nothing scored) */
export const gigPct = g => g.hits + g.misses ? Math.round(100 * g.hits / (g.hits + g.misses)) : null;
/* the show's bonus fans, on top of the play's own: 1 for every chord caught, 5 for every 10 in the best run,
   and 10 for a crowd of 10 or more at the end. An encore doubles it. */
export function gigFans(g, encore = false) {
  const n = g.hits + 5 * Math.floor(g.best / 10) + (g.last.length >= 6 && gigCrowd(g) >= 10 ? 10 : 0);
  return encore ? n * 2 : n;
}
/* The targets: one for each run of the same chord in the song's order (a chord played again in a row shows once),
   with the first and last place in `seq` it covers. `seq` is the song's chords, each with a name. */
export function catchTargets(seq) {
  const out = [];
  (seq || []).forEach((c, i) => { const t = out[out.length - 1]; if (t && t.name === c.name) t.last = i; else out.push({ name: c.name, first: i, last: i }); });
  return out;
}
/* which target the chord at `idx` in the song belongs to (-1: none) */
export const targetAt = (targets, idx) => targets.findIndex(t => idx >= t.first && idx <= t.last);
/* the chord that shares two notes with this one: a major's relative minor and a minor's relative major (C and Am) */
const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FLATS = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };
export function relativeOf(name) {
  const m = /^([A-G][#b]?)(m(?!aj))?/.exec(String(name || ""));
  if (!m) return "";
  const root = SHARP.indexOf(FLATS[m[1]] || m[1]);
  if (root < 0) return "";
  return m[2] ? SHARP[(root + 3) % 12] : SHARP[(root + 9) % 12] + "m";
}
/* A catch in progress. The phone only asks about the chord you are on and the next one, so a chord still ringing
   from the last change can't be mistaken for the one two on. */
export function catchStart(targets) {
  return { targets, cur: 0, caught: targets.map(() => false), closed: targets.map(() => false), heard: targets.map(() => false), cand: -1, n: 0, hold: null };
}
/* the chord you are on moved to song place `idx` */
export function catchAt(st, idx) { const t = targetAt(st.targets, idx); if (t >= 0) st.cur = t; return st.cur; }
/* targets that can be caught now: the next one you haven't played (from the one you are on), then the one after it,
   up to CATCH_AHEAD past the reading line. 4.79.0: you can play ahead of the song, in order (Graham). */
export const CATCH_AHEAD = 4, CATCH_AFTER = 0.8, CATCH_CLEAR = 0.2;
export function catchOpen(st) {
  let nx = st.cur;
  while (nx < st.targets.length && (st.caught[nx] || st.closed[nx])) nx++;
  return [nx, nx + 1].filter(i => i < st.targets.length && i <= st.cur + CATCH_AHEAD && !st.caught[i] && !st.closed[i]);
}
/* One reading of the room (a chroma from `chromaOf`, or null for silence). Two readings in a row that fit the same
   open target catch it, or one with a fit of `opt.strong` and up (4.78.1; `opt.need` changes the two). Returns the target caught, or -1. A chord just caught can't be caught again until the room
   stops sounding like it (a ringing chord), so A to B to A counts the second A only when you play it again. */
export function catchHear(st, chroma, opt = {}) {
  const need = opt.need ?? 2, strong = opt.strong ?? 2;
  /* 4.80.1: one strum, one catch. With strums counted (opt.on, the strum's number, and opt.since, seconds since it),
     a chord is caught only in the moment after a strum it hasn't already been caught from, so the ring of a chord
     can't catch a later chord that shares its notes (Em's ring catching G; strumming C again catching the next Em). */
  const fresh = opt.on == null || (opt.on !== st.lastOn && opt.since <= CATCH_AFTER);
  if (!chroma) { st.cand = -1; st.n = 0; st.hold = null; return -1; }
  for (const i of [st.cur, st.cur + 1]) if (i < st.targets.length) st.heard[i] = true;
  if (st.hold && (strumFit(chroma, st.hold) ?? 0) < CHORD_FIT) st.hold = null;
  let best = -1, fit = CHORD_FIT, margin = 0;
  for (const i of catchOpen(st)) {
    const name = st.targets[i].name;
    if (name === st.hold) continue;
    const f = strumFit(chroma, name);
    if (f === null || f < fit) continue;
    /* 4.80.2: no other chord of the song, nor this chord's relative, may fit as well (it could fit up to 0.08 better:
       C and Em heard as G, which shares two notes with each, in Graham's Zombie) */
    let other = strumFit(chroma, relativeOf(name)) ?? 0;
    for (const t of st.targets) if (t.name !== name) other = Math.max(other, strumFit(chroma, t.name) ?? 0);
    if (other < f) { best = i; fit = f; margin = f - other; }
  }
  if (best < 0 || !fresh) { st.cand = -1; st.n = 0; return -1; }
  st.n = best === st.cand ? st.n + 1 : 1; st.cand = best;
  /* one reading is enough only when it is clear and well ahead of every other chord; else two in a row */
  if (st.n < need && (fit < strong || margin < CATCH_CLEAR)) return -1;
  st.caught[best] = true; st.hold = st.targets[best].name; st.cand = -1; st.n = 0; st.lastOn = opt.on;
  return best;
}
/* Follow my tempo (4.80.0): the page and the band follow the player. Between two chords caught in a row, `expected`
   is how long the page would take from one to the other at its pace now, `actual` how long you took. The pace
   moves toward yours by half the gap, at most 3% a change, and stays within a quarter of the song's own; a gap
   too far off (a missed or late catch) is not a tempo and is left out. `k` is the pace, 1 for the song's own. */
export const FOLLOW = { min: 0.75, max: 1.25, step: 0.03, blend: 0.5 };
export function tempoStep(k, expected, actual) {
  if (!(expected > 0.4) || !(actual > 0.4)) return k;
  const r = expected / actual;
  if (r < 0.6 || r > 1.6) return k;
  const want = Math.min(FOLLOW.max, Math.max(FOLLOW.min, k * r));
  return +(k + Math.max(-FOLLOW.step, Math.min(FOLLOW.step, (want - k) * FOLLOW.blend))).toFixed(4);
}
/* you are two or more chords ahead of the page: one step faster (4.80.1) */
export const followAhead = k => +Math.min(FOLLOW.max, k + FOLLOW.step).toFixed(4);
/* Targets whose time has gone by, settled once each: `missed` for the ones you didn't play, `got` for a chord with
   no shape to listen for that something was heard through (a quiet room never costs a chord). A target is gone by
   once the chord after it has begun, or a later one was caught. */
export function catchClose(st) {
  const limit = Math.max(st.cur, st.caught.lastIndexOf(true)), out = { missed: [], got: [] };
  for (let i = 0; i < limit; i++) {
    if (st.caught[i] || st.closed[i]) continue;
    st.closed[i] = true;
    if (!chordNotes(st.targets[i].name) && st.heard[i]) { st.caught[i] = true; out.got.push(i); } else out.missed.push(i);
  }
  return out;
}
/* how many beats a stalled scheduler has fallen behind; they are skipped, not played in a burst */
export const beatsLate = (late, spb) => late > 0.04 && spb > 0 ? Math.ceil(late / spb) : 0;
/* Stage Gels: the colour family of a section, from its name */
export function gelOf(name) {
  const n = String(name || "").toLowerCase();
  if (/chorus|refrain|hook/.test(n) && !/pre/.test(n)) return "chorus";
  if (/bridge|pre|middle/.test(n)) return "bridge";
  if (/solo|instrumental|interlude|riff|break/.test(n)) return "solo";
  return "verse";
}
/* a show finished: keep the count, the bonus fans and each song's best */
/* practice (Wait for me, 4.54.0): fans and the request line count; Charts XP, rival battles, duels and the best score do not */
export function gigDone(data, songId, g, encore = false, now = Date.now(), practice = false) {
  const fans = gigFans(g, encore), pct = gigPct(g), tips = gigTips(g, encore);
  const mt = data.merch || (data.merch = {}); mt.tips = (mt.tips || 0) + tips; /* the once-only change of fans to tips adds to this, never replaces it */
  const gs = data.gig || (data.gig = { shows: 0, fans: 0, best: {} });
  gs.shows++; gs.fans += fans;
  if (pct !== null && !practice) gs.best[songId] = Math.max(gs.best[songId] || 0, pct);
  /* Tour quests (4.5.0): the crowd it reached, and the request line doubles its bonus fans */
  const cover = coverState(data, now)?.song?.id === songId;
  const request = questsShow(data, songId, g.hits + g.misses > 0 ? gigCrowd(g) : null, fans, now);
  /* Charts (4.6.0): XP for the show, and today's rival battle; a Double set doubles a scored show's XP (4.14.0) */
  const own = data.merch?.own, doubled = pct !== null && !practice && own?.double > 0;
  if (doubled) own.double--;
  const battle = practice ? null : chartsShow(data, songId, g, pct, now, doubled ? 2 : 1);
  /* Song duels (4.12.0): a scored show answers a friend's challenge on this song */
  const duel = pct === null || practice ? null : duelsShow(data, songId, { pct, combo: g.best, crowd: g.last.length ? gigCrowd(g) : 0 });
  return { ...(duel ? { duel } : {}), fans: fans + request, tips, pct, request: (!cover && request > 0) || null, ...(cover ? { cover: true } : {}), ...(battle ? { battle } : {}), ...(doubled ? { doubled: own.double } : {}) };
}
export function cleanGig(raw) {
  if (!isObj(raw)) return null;
  const best = {};
  for (const [id, v] of Object.entries(isObj(raw.best) ? raw.best : {}).slice(0, 2000)) if (typeof id === "string" && id.length <= 40 && v >= 0 && v <= 100) best[id] = Math.round(v);
  const shows = Math.max(0, Math.min(1e6, Math.floor(+raw.shows || 0))), fans = Math.max(0, Math.min(1e7, Math.floor(+raw.fans || 0)));
  return shows || fans || Object.keys(best).length ? { shows, fans, best } : null;
}

// ---------- The Merch table (4.14.0) ----------
// Fans are what you spend. The fans you've earned stay worked out from what you've played (fansOf);
// data.merch.spent is taken off to give what you have to spend, so buying never touches XP or the chart.
// Gear is used up: a Rain check covers a night you didn't play (used on its own, up to 2 held), a Double
// set doubles the XP of your next 3 scored gigs, a Second take gives today's lost rival battle another go.
// Louie's finishes and stage backdrops are kept once bought, and you pick which one is on.
export const MERCH = [
  { id: "rain", kind: "gear", name: "Rain check", line: "Covers a night you miss", price: 200, max: 2 },
  { id: "double", kind: "gear", name: "Double set", line: "2x XP on your next 3 gigs", price: 150, max: 9, adds: 3 },
  { id: "take", kind: "gear", name: "Second take", line: "Another go at today's rival", price: 100, max: 3 },
  { id: "stock", kind: "louie", name: "Stock", price: 0, line: "Louie as he comes, in the colours of your look." },
  { id: "tweed", kind: "louie", name: "Tweed", price: 600, line: "A fifties cabinet with a cream grille." },
  { id: "pink", kind: "louie", name: "Pink", price: 0, line: "Hot pink, free to wear." },
  { id: "teal", kind: "louie", name: "Teal", price: 0, line: "Deep teal, free to wear." },
  { id: "black", kind: "louie", name: "Studio black", price: 800, line: "Black tolex and a silver face, the studio classic." },
  { id: "mint", kind: "louie", name: "Mint", price: 1000, line: "Surf green with a cream face." },
  { id: "gold", kind: "louie", name: "Gold top", price: 1500, line: "Gold all over, for the headliner." },
  { id: "basement", kind: "backdrop", name: "Basement", price: 0, line: "The plain stage you started on." },
  { id: "brick", kind: "backdrop", name: "Brick wall", price: 300, line: "A club wall under one warm light." },
  { id: "stars", kind: "backdrop", name: "Starlight", price: 400, line: "An open-air night sky." },
  { id: "sunset", kind: "backdrop", name: "Sunset fest", price: 500, line: "A festival field at golden hour." },
  /* 4.78.0: the looks. Light and Dark are everyone's, Green Room is bought, Headliner is earned by headlining a show. */
  { id: "festival", kind: "look", theme: "light", name: "Festival Poster", price: 0, line: "The light look: sky blue, hot pink and sunshine." },
  { id: "neon", kind: "look", theme: "dark", name: "Neon Midnight", price: 0, line: "The dark look: indigo, lime and hot pink." },
  { id: "green", kind: "look", theme: "green", name: "Green Room", price: 400, line: "Sage, coral and mustard, calm as a dressing room." },
  { id: "headliner", kind: "look", theme: "headliner", name: "Headliner", price: 0, earn: "headline", line: "Black, gold and chrome under a blacklight." }
];
const merchItem = id => MERCH.find(x => x.id === id);
/* free to have: no price and nothing to earn (gear is never "had") */
const freeItem = x => !x.price && !x.earn && x.kind !== "gear";
/* 4.78.0: you've headlined once any leg's headline show is done */
export const headlined = (data, now = Date.now()) => roadPath(data, now).legs.some(l => l.stops.some(s => s.kind === "headline" && s.state === "done"));
/* Once: a look you were already using before looks went on the Merch table stays yours */
function looksMigrate(data) {
  const m = data.merch || (data.merch = {});
  if (m.lconv) return;
  m.lconv = 1;
  const it = MERCH.find(x => x.kind === "look" && x.theme === data.settings?.theme && !freeItem(x));
  if (it && !(m.has || []).includes(it.id)) (m.has || (m.has = [])).push(it.id);
}
/* the looks you can use, by the settings.theme they set ("auto" is always there) */
export function looksOwned(data, now = Date.now()) {
  const st = merchState(data, now);
  return new Set(["auto", ...MERCH.filter(x => x.kind === "look" && st.has.has(x.id)).map(x => x.theme)]);
}
export const lookOfTheme = theme => MERCH.find(x => x.kind === "look" && x.theme === theme) || null;
/* data.merch.test: fans added from Settings > Help to try the Merch table (4.16.0); they never count toward XP or the chart */
// ---------- Fans and tips (4.70.0, Graham 2026-10-24) ----------
// Fans are your reputation: practice and shows earn them, and they are never spent. They fade when you neither
// practice nor play: nothing for FADE.grace days, then FADE.rate of them a day (a Rain check covers a day).
// Fall below FADE.hold of the most fans you had at a venue and the Road warns you; still below the next day and
// you're back at the venue before. FADE.back shows there win it back (quicker than earning it the first time).
// Tips are money: only shows earn them, more with a bigger crowd and a longer run, and the Merch table costs tips.
// The first time this runs, the fans you had to spend become tips, so nothing saved is lost.
export const FADE = { grace: 2, rate: 0.01, hold: 0.75, back: 3, days: 120 };
export const fansNow = (data, now = Date.now()) => Math.max(0, fansOf(data, now) - (data.fame?.lost || 0));
function activeDays(data) {
  const s = new Set(playDays(playSongs(data)));
  for (const [d, secs] of Object.entries(data.journal?.days || {})) if (secs >= 60) s.add(d);
  return s;
}
const dayStart = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); };
/* the old fans to spend, once, as tips */
export function tipsMigrate(data, now = Date.now()) {
  const m = data.merch || (data.merch = {});
  if (m.tconv) return 0;
  const was = Math.max(0, fansOf(data, now) - (m.spent || 0));
  m.tconv = 1; m.tips = (m.tips || 0) + was;
  return was;
}
export const tipsOf = data => { const m = data.merch || {}; return Math.max(0, (m.tips || 0) + (m.test || 0) - (m.tspent || 0)); };
/* tips for a show: 5 unscored; scored, 10 plus 3 for each fan on their feet and 1 for every two chords in your best run */
export function gigTips(g, encore = false) {
  const graded = g.hits + g.misses > 0, t = graded ? 10 + 3 * gigCrowd(g) + Math.floor(g.best / 2) : 5;
  return encore ? t * 2 : t;
}
/* Once a day (and after plays): fans fade for the idle days since, and the venue is held, warned, lost or won
   back. Returns what happened, for the Road to say: { kind: "fade", lost } | { kind: "warn" | "down" | "up", venue }. */
export function fameSettle(data, now = Date.now()) {
  tipsMigrate(data, now);
  const f = data.fame || (data.fame = {}), today = dayKey(now), out = [];
  if (!f.day) { f.day = today; f.base = fansNow(data, now); return out; }
  const act = activeDays(data), rain = new Set(data.merch?.rainDays || []);
  let lost = 0, n = 0;
  for (let t = dayStart(f.day) + DAY; dayKey(t) < today && n < FADE.days; t += DAY, n++) {
    const k = dayKey(t);
    if (act.has(k) || rain.has(k)) { f.idle = 0; continue; }
    f.idle = (f.idle || 0) + 1;
    if (f.idle <= FADE.grace) continue;
    const have = fansNow(data, now), loss = have > 0 ? Math.min(have, Math.max(1, Math.round(have * FADE.rate))) : 0;
    f.lost = (f.lost || 0) + loss; lost += loss;
  }
  if (act.has(today)) f.idle = 0;
  f.day = today;
  if (lost) out.push({ kind: "fade", lost });
  const plays = lifetimePlays(data), earned = venueOf(plays).ring, fans = fansNow(data, now);
  f.down = Math.min(f.down || 0, earned);
  if (f.down > 0 && plays - (f.back || 0) >= FADE.back) { f.down--; f.back = plays; f.base = fans; delete f.warn; out.push({ kind: "up", venue: venueName(earned - f.down) }); }
  const ring = earned - f.down;
  if (ring > 0 && f.base > 0 && fans < f.base * FADE.hold) {
    if (!f.warn) { f.warn = today; out.push({ kind: "warn", venue: venueName(ring) }); }
    else if (f.warn < today) { f.down++; f.back = plays; f.base = fans; delete f.warn; out.push({ kind: "down", from: venueName(ring), venue: venueName(ring - 1) }); }
  } else if (f.warn) delete f.warn;
  if (!(f.base >= fans)) f.base = fans; /* the most fans you've had at this venue */
  return out;
}
/* the venue you're at: the one your plays earned, less the ones lost to fading fans */
export function venueNow(data) {
  const plays = lifetimePlays(data), v = venueOf(plays), down = Math.min(data.fame?.down || 0, v.ring);
  if (!down) return { ...v, warn: !!data.fame?.warn };
  const ring = v.ring - down;
  return { ...v, ring, name: venueName(ring), next: venueName(ring + 1), down, back: Math.max(1, FADE.back - (plays - (data.fame.back || 0))), warn: !!data.fame?.warn };
}
export function cleanFame(raw) {
  if (!isObj(raw)) return null;
  const out = {}, day = /^\d{4}-\d\d-\d\d$/, int = (v, max) => Math.max(0, Math.min(max, Math.floor(+v || 0)));
  if (day.test(raw.day)) out.day = raw.day;
  if (day.test(raw.warn)) out.warn = raw.warn;
  for (const [k, max] of [["lost", 1e7], ["base", 1e7], ["down", 50], ["back", 1e6], ["idle", 1e4]]) { const v = int(raw[k], max); if (v) out[k] = v; }
  return Object.keys(out).length ? out : null;
}
export const fansToSpend = data => tipsOf(data); /* 4.70.0: what you spend is tips */
export function merchState(data, now = Date.now()) {
  tipsMigrate(data, now); looksMigrate(data);
  const m = data.merch || {}, has = new Set([...MERCH.filter(freeItem).map(x => x.id), ...(m.has || [])]);
  /* 4.78.0: earned looks are yours once you've done the thing (worked out, so a backup keeps them) */
  const earned = MERCH.filter(x => x.earn === "headline" && !has.has(x.id));
  if (earned.length && headlined(data, now)) for (const x of earned) has.add(x.id);
  const look = lookOfTheme(data.settings?.theme)?.id || null; /* null: Auto */
  return { tips: tipsOf(data), fans: tipsOf(data), own: { rain: 0, double: 0, take: 0, ...(m.own || {}) }, has, louie: has.has(m.louie) ? m.louie : "stock", backdrop: has.has(m.backdrop) ? m.backdrop : "basement", look };
}
/* what's on, without working out fans (cheap enough for every screen) */
export function merchWorn(data, kind = "louie") {
  const m = data.merch || {};
  return (m.has || []).includes(m[kind]) || MERCH.some(x => x.id === m[kind] && x.kind === kind && freeItem(x)) ? m[kind] : kind === "louie" ? "stock" : "basement";
}
/* buy one: { ok } or { why: "fans" | "max" | "have" } */
export function merchBuy(data, id, now = Date.now()) {
  const it = merchItem(id);
  if (!it) return { why: "none" };
  const st = merchState(data, now), m = data.merch || (data.merch = {});
  if (it.kind === "gear" ? st.own[id] + (it.adds || 1) > it.max : st.has.has(id)) return { why: it.kind === "gear" ? "max" : "have" };
  if (it.earn) return { why: "earn" }; /* 4.78.0: earned, never bought */
  if (st.tips < it.price) return { why: "tips" };
  m.tspent = (m.tspent || 0) + it.price;
  if (it.kind === "gear") (m.own || (m.own = {}))[id] = st.own[id] + (it.adds || 1);
  else { (m.has || (m.has = [])).push(id); if (it.kind === "look") data.settings.theme = it.theme; else m[it.kind] = id; }
  return { ok: true };
}
export function merchWear(data, id) {
  const it = merchItem(id), st = merchState(data);
  if (!it || it.kind === "gear" || !st.has.has(id)) return false;
  if (it.kind === "look") { data.settings.theme = it.theme; return true; }
  (data.merch || (data.merch = {}))[it.kind] = id;
  return true;
}
/* Rain checks: the nights missed since your last play, covered when you hold enough checks for all of them */
export function rainSettle(data, now = Date.now()) {
  const m = data.merch;
  if (!(m?.own?.rain > 0)) return [];
  const days = playDays(playSongs(data));
  if (!days.size) return [];
  let k = 0;
  while (k < 30 && !days.has(dayKey(now - (k + 1) * DAY))) k++;
  if (!k || k >= 30 || k > m.own.rain) return [];
  const used = Array.from({ length: k }, (_, i) => dayKey(now - (k - i) * DAY));
  m.own.rain -= k;
  m.rainDays = [...(m.rainDays || []), ...used].slice(-60);
  return used;
}
/* Second take: today's lost battle can be played again */
export function secondTake(data, now = Date.now()) {
  const b = data.charts?.battle, own = data.merch?.own;
  if (!b || b.day !== dayKey(now) || b.result !== "lost" || !(own?.take > 0)) return false;
  own.take--;
  delete b.result; delete b.pct;
  return true;
}
/* Show complete: the cheapest finish or backdrop you can now afford, said once */
export function merchTip(data, now = Date.now()) {
  const st = merchState(data, now), m = data.merch || {};
  const told = new Set(m.told || []);
  const it = MERCH.filter(x => x.kind !== "gear" && x.price && !x.earn && !st.has.has(x.id) && x.price <= st.tips && !told.has(x.id)).sort((a, b) => a.price - b.price)[0];
  if (!it) return null;
  const mm = data.merch || (data.merch = {});
  (mm.told || (mm.told = [])).push(it.id);
  return it;
}
export function cleanMerch(raw) {
  if (!isObj(raw)) return null;
  const out = {}, day = /^\d{4}-\d\d-\d\d$/, ids = new Set(MERCH.map(x => x.id));
  const spent = Math.max(0, Math.min(1e7, Math.floor(+raw.spent || 0))); if (spent) out.spent = spent;
  /* 4.70.0: tips earned, spent, and the once-only change of fans to tips */
  for (const k of ["tips", "tspent"]) { const v = Math.max(0, Math.min(1e7, Math.floor(+raw[k] || 0))); if (v) out[k] = v; }
  if (raw.tconv) out.tconv = 1;
  if (raw.lconv) out.lconv = 1; /* 4.78.0: the look you used before is kept; the Headliner moment was shown */
  if (raw.hlseen) out.hlseen = 1;
  const test = Math.max(0, Math.min(1e6, Math.floor(+raw.test || 0))); if (test) out.test = test;
  const own = {};
  for (const g of MERCH.filter(x => x.kind === "gear")) { const n = Math.max(0, Math.min(g.max, Math.floor(+raw.own?.[g.id] || 0))); if (n) own[g.id] = n; }
  if (Object.keys(own).length) out.own = own;
  const has = [...new Set((Array.isArray(raw.has) ? raw.has : []).filter(id => ids.has(id) && merchItem(id).kind !== "gear"))];
  if (has.length) out.has = has;
  const free = id => MERCH.some(x => x.id === id && freeItem(x));
  if (has.includes(raw.louie) || free(raw.louie)) out.louie = raw.louie;
  if (has.includes(raw.backdrop) || free(raw.backdrop)) out.backdrop = raw.backdrop;
  const rain = (Array.isArray(raw.rainDays) ? raw.rainDays : []).filter(d => day.test(d)).slice(-60);
  if (rain.length) out.rainDays = rain;
  const told = [...new Set((Array.isArray(raw.told) ? raw.told : []).filter(id => ids.has(id)))];
  if (told.length) out.told = told;
  return Object.keys(out).length ? out : null;
}
