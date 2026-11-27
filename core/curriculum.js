// The curriculum (5.17.0, Release A): 19 tours and their stops, in three routes. The main line (Tours 1 to 13) is
// chords and rhythm; the lead route (14 to 16) opens after Tour 3; the fingerstyle route (17 and 18) opens after
// Tour 4; Tour 19 is held. Every stop is a piece of a real song and a tour ends with the whole song, but Release A
// only draws the map: a stop that already has something playable (an Opening night step, a chord or switch lesson,
// a song tour) opens it, and every other stop says "Coming soon" and plays nothing.
// Today's progress is never rewritten: the old fields stay as they are (skills, opening, songTour, boxes, journal)
// and are mapped onto these stops. data.curriculum = { v, done: { stopId: time } } only remembers what was mapped.
// Re-exported from core.js. Topic files must not read other files' values while loading (only inside functions).
import { isObj } from "../core.js";
import { OPENING, openingView, openingStep } from "./game.js";
import { KNOW_PLAYS } from "./neck.js";

export const CURRICULUM_V = 1;
export const ROUTES = {
  main: { id: "main", name: "Main line", opens: null },
  lead: { id: "lead", name: "Lead route", opens: "t3" },
  fingerstyle: { id: "fingerstyle", name: "Fingerstyle route", opens: "t4" },
  held: { id: "held", name: "Held for later", opens: null }
};
const T = (n, name, route, opens = null) => ({ id: `t${n}`, number: n, name, route, opens });
export const TOURS = [
  T(1, "Opening Night", "main"),
  T(2, "Open Mic", "main", "t1"), T(3, "Coffeehouse", "main", "t2"), T(4, "Street Corner", "main", "t3"),
  T(5, "The Van", "main", "t4"), T(6, "Roadhouse", "main", "t5"), T(7, "Garage", "main", "t6"),
  T(8, "Club Night", "main", "t7"), T(9, "Dance Hall", "main", "t8"), T(10, "Mountain Pass", "main", "t9"),
  T(11, "Long Haul", "main", "t10"), T(12, "Theater", "main", "t11"), T(13, "Arena", "main", "t12"),
  T(14, "Studio Session", "lead", "t3"), T(15, "Spotlight", "lead", "t14"), T(16, "Last Call", "lead", "t15"),
  T(17, "Unplugged", "fingerstyle", "t4"), T(18, "Listening Room", "fingerstyle", "t17"),
  T(19, "Encore", "held")
];
const TOUR_BY = Object.fromEntries(TOURS.map(t => [t.id, t]));
export const routeOf = tourId => TOUR_BY[tourId]?.route || null;

/* The easy set Tour 1's songs are fitted to (audit 4: a small hand-checked pool, two easy shapes). */
const EASY = ["Em", "Em7", "Asus2", "A7", "Cmaj7", "D6/9"];

/* One stop: tour number, place in the tour, short title, the skill, the chords it adds, the pass type ("heard": Louie
   listens for the chord or note; "played": Louie can't judge it, so it counts when played through), what plays today
   (play), and the rules for the songs that fit it (rules: strum level, most new chords, headline or not).
   play: { opening: [ids] } | { lessons: [ids] } | null (Coming soon). A stop with one lesson keeps that lesson's id, so the
   Road's taps and the old tests find it; any other stop is "k<tour>.<n>". */
const L = (...lessons) => ({ lessons });
const O = (...opening) => ({ opening });
const S = (t, n, title, skill, chords, pass, play, o = {}) => {
  const lesson = play?.lessons?.length === 1 ? play.lessons[0] : "";
  const kind = o.kind || (lesson.startsWith("s:") ? "switch" : "chord");
  return { id: lesson || `k${t}.${n}`, tour: `t${t}`, n, title, skill, chords, pass, play, kind, strum: o.strum || "down", maxNew: o.maxNew ?? Math.max(1, chords.length), allow: o.allow || null, headline: !!o.headline, held: !!o.held };
};
const H = (t, n, title, skill, pass = "heard", o = {}) => S(t, n, title, skill, [], pass, null, { ...o, kind: "headline", headline: true });
export const STOPS = [
  // Tour 1: Opening Night
  S(1, 1, "Soundcheck", "Tune up and mic check", [], "heard", O("who", "hold", "strings", "mic"), { allow: EASY }),
  S(1, 2, "First notes", "Two open strings, then a chord's shape", [], "played", O("notes", "chord"), { allow: EASY }),
  S(1, 3, "Em", "The Em chord", ["Em"], "heard", L("c:Em"), { allow: EASY }),
  S(1, 4, "Second shape", "One easy shape beside Em", ["Asus2"], "heard", null, { allow: EASY }),
  S(1, 5, "First changes", "Strum on the changes", [], "played", O("verse", "pause"), { allow: EASY }),
  { ...H(1, 6, "Your first show", "A whole two-shape song"), play: { opening: ["show"] }, allow: EASY },
  // Tour 2: Open Mic (A, D, E, down-ups)
  S(2, 1, "A", "The A chord", ["A"], "heard", L("c:A")),
  S(2, 2, "D", "The D chord", ["D"], "heard", L("c:D")),
  S(2, 3, "E", "The E chord", ["E"], "heard", L("c:E")),
  S(2, 4, "D to A and A to E", "The two changes", [], "heard", L("s:D-A", "s:A-E"), { kind: "switch" }),
  S(2, 5, "Down-ups", "Down-up strumming in eighths", [], "played", null, { strum: "eighths" }),
  H(2, 6, "Headline show", "A whole A, D, E song", "heard", { strum: "eighths" }),
  // Tour 3: Coffeehouse (G, C)
  S(3, 1, "G", "The G chord", ["G"], "heard", L("c:G"), { strum: "eighths" }),
  S(3, 2, "C", "The C chord", ["C"], "heard", L("c:C"), { strum: "eighths" }),
  S(3, 3, "G to C", "The change", [], "heard", L("s:G-C"), { strum: "eighths" }),
  S(3, 4, "C to D and G to D", "The two changes", [], "heard", L("s:C-D", "s:G-D"), { strum: "eighths", kind: "switch" }),
  H(3, 5, "Headline show", "A whole G, C, D song", "heard", { strum: "eighths" }),
  // Tour 4: Street Corner (Am, Dm, the folk pattern)
  S(4, 1, "Am", "The Am chord", ["Am"], "heard", L("c:Am"), { strum: "folk" }),
  S(4, 2, "Dm", "The Dm chord", ["Dm"], "heard", null, { strum: "folk" }),
  S(4, 3, "Em to Am and Am to C", "The two changes", [], "heard", L("s:Em-Am", "s:Am-C"), { strum: "folk", kind: "switch" }),
  S(4, 4, "The folk pattern", "Down, down-up, up-down-up", [], "played", null, { strum: "folk" }),
  S(4, 5, "Keep the hand moving", "Strumming through the changes", [], "played", null, { strum: "folk" }),
  H(4, 6, "Headline show", "A whole four-chord song", "heard", { strum: "folk" }),
  // Tour 5: The Van (the capo)
  S(5, 1, "The capo", "A known song in a new key", [], "heard", null, { strum: "folk" }),
  S(5, 2, "Your own song", "The chorus of a song you picked, fitted", [], "heard", null, { strum: "folk" }),
  H(5, 3, "Headline show", "Your own song, whole", "heard", { strum: "folk" }),
  // Tour 6: Roadhouse (sevenths, the blues)
  S(6, 1, "A7 and D7", "Bars 1 to 8 of a blues in A", ["A7", "D7"], "heard", null, { strum: "shuffle", maxNew: 3 }),
  S(6, 2, "E7", "The last four bars", ["E7"], "heard", null, { strum: "shuffle" }),
  S(6, 3, "The shuffle", "The shuffle strum", [], "played", null, { strum: "shuffle" }),
  S(6, 4, "B7", "A blues in E", ["B7"], "heard", null, { strum: "shuffle" }),
  H(6, 5, "Headline show", "A whole 12-bar blues", "heard", { strum: "shuffle" }),
  // Tour 7: Garage (power chords)
  S(7, 1, "E5 and A5", "The two power chord shapes", ["E5", "A5"], "heard", null, { strum: "down", maxNew: 2 }),
  S(7, 2, "Moving them", "One shape up and down the neck", ["D5", "G5"], "heard", null, { strum: "down", maxNew: 2 }),
  S(7, 3, "Palm muting", "Rest the heel of your hand on the strings", [], "played", null, { strum: "palm" }),
  H(7, 4, "Headline show", "A whole power-chord rock song", "heard", { strum: "palm" }),
  // Tour 8: Club Night (colour chords, syncopation)
  S(8, 1, "Colour chords", "Em7, Cadd9 and Dsus4", ["Em7", "Cadd9", "Dsus4"], "heard", null, { strum: "eighths", maxNew: 3 }),
  S(8, 2, "Sus chords in changes", "Asus4, Dsus2 and A7sus4", ["Asus4", "Dsus2", "A7sus4"], "heard", null, { strum: "eighths", maxNew: 3 }),
  S(8, 3, "Syncopation", "Strum off the beat", [], "played", null, { strum: "syncopated" }),
  S(8, 4, "The chuck", "Mute on the backbeat", [], "played", null, { strum: "chuck" }),
  H(8, 5, "Headline show", "A whole song with colour chords", "heard", { strum: "syncopated" }),
  // Tour 9: Dance Hall (3/4 and 6/8)
  S(9, 1, "Three beats", "Counting in 3/4", [], "played", null, { strum: "three" }),
  S(9, 2, "Six beats", "Counting in 6/8", [], "played", null, { strum: "six" }),
  S(9, 3, "G7 and C7", "Two sevenths common in these songs", ["G7", "C7"], "heard", null, { strum: "three", maxNew: 2 }),
  H(9, 4, "Headline show", "A whole song in 3/4 or 6/8", "heard", { strum: "three" }),
  // Tour 10: Mountain Pass (small F)
  S(10, 1, "Fmaj7", "The easy way into F", ["Fmaj7"], "heard", null, { strum: "folk" }),
  S(10, 2, "F, four strings", "The small F", ["F"], "heard", null, { strum: "folk" }),
  S(10, 3, "C to F and F to G", "The two changes", [], "heard", null, { strum: "folk", kind: "switch" }),
  H(10, 4, "Headline show", "A whole C, F, G, Am song", "heard", { strum: "folk" }),
  // Tour 11: Long Haul (Bm)
  S(11, 1, "Bm7, three strings", "The easy way into Bm", ["Bm7"], "heard", null, { strum: "folk" }),
  S(11, 2, "Bm, five strings", "The barre at fret 2", ["Bm"], "heard", null, { strum: "folk" }),
  S(11, 3, "Bm in changes", "Bm beside G, D and Em", [], "heard", null, { strum: "folk", kind: "switch" }),
  H(11, 4, "Headline show", "A whole song with Bm", "heard", { strum: "folk" }),
  // Tour 12: Theater (E-shape barre)
  S(12, 1, "Full F", "The six-string F", [], "played", null, { strum: "folk" }),
  S(12, 2, "Moving the E shape", "G at fret 3, A at fret 5", [], "heard", null, { strum: "folk" }),
  S(12, 3, "Its minor", "F#m and Gm", ["F#m", "Gm"], "heard", null, { strum: "folk", maxNew: 2 }),
  S(12, 4, "Open to barre", "Changes between open and barre chords", [], "heard", null, { strum: "folk", kind: "switch" }),
  H(12, 5, "Headline show", "A whole song with an E-shape barre", "heard", { strum: "folk" }),
  // Tour 13: Arena (A-shape barre)
  S(13, 1, "A-shape minors", "Cm and C#m", ["Cm", "C#m"], "heard", null, { strum: "folk", maxNew: 2 }),
  S(13, 2, "A-shape majors", "Bb and B", ["Bb", "B"], "heard", null, { strum: "folk", maxNew: 2 }),
  S(13, 3, "Between the shapes", "Changes between the two barre shapes", [], "heard", null, { strum: "folk", kind: "switch" }),
  H(13, 4, "Headline show", "A whole song in barre chords", "heard", { strum: "folk" }),
  // Tour 14: Studio Session (lead route)
  S(14, 1, "Bass notes", "The bass note of each chord, one a bar", [], "heard", null, { strum: "pick" }),
  S(14, 2, "Alternate picking", "Down-up on one string", [], "played", null, { strum: "pick" }),
  S(14, 3, "Across the strings", "Two and three strings", [], "heard", null, { strum: "pick" }),
  S(14, 4, "Chord tones", "Picked notes of each chord", [], "heard", null, { strum: "pick" }),
  H(14, 5, "Headline show", "A whole song, picked", "heard", { strum: "pick" }),
  // Tour 15: Spotlight
  S(15, 1, "A melody", "A song's melody on one or two strings", [], "heard", null, { strum: "pick" }),
  S(15, 2, "Minor pentatonic", "Box one at the 5th fret", [], "heard", null, { strum: "pick" }),
  S(15, 3, "Hammer-ons and pull-offs", "Legato", [], "played", null, { strum: "pick" }),
  S(15, 4, "Slides", "Slide into a note", [], "played", null, { strum: "pick" }),
  H(15, 5, "Headline show", "A whole short solo over the recording", "played", { strum: "pick" }),
  // Tour 16: Last Call
  S(16, 1, "Bends", "Push a string up to pitch", [], "played", null, { strum: "pick" }),
  S(16, 2, "Vibrato", "Shake the note", [], "played", null, { strum: "pick" }),
  S(16, 3, "Major pentatonic", "The sweet sound", [], "heard", null, { strum: "pick" }),
  S(16, 4, "The blues scale", "The blue note", [], "heard", null, { strum: "pick" }),
  H(16, 5, "Headline show", "A whole 12-bar solo over a blues", "played", { strum: "pick" }),
  // Tour 17: Unplugged (fingerstyle route)
  S(17, 1, "Thumb on the bass", "The thumb alone", [], "heard", null, { strum: "arpeggio" }),
  S(17, 2, "Thumb and fingers", "A pinch on beat one", [], "heard", null, { strum: "arpeggio" }),
  S(17, 3, "P-I-M-A arpeggios", "Thumb and three fingers", [], "heard", null, { strum: "arpeggio" }),
  H(17, 4, "Headline show", "A whole arpeggio song", "heard", { strum: "arpeggio" }),
  // Tour 18: Listening Room
  S(18, 1, "Alternating thumb", "The thumb alone", [], "heard", null, { strum: "travis" }),
  S(18, 2, "Add one finger", "The thumb and one finger", [], "heard", null, { strum: "travis" }),
  S(18, 3, "The Travis pattern", "The full pattern", [], "heard", null, { strum: "travis" }),
  H(18, 4, "Headline show", "A whole Travis-picked song", "heard", { strum: "travis" }),
  // Tour 19: Encore (held: topics, not stops yet)
  S(19, 1, "Walking bass and slash chords", "Held for later", ["D/F#", "G/B", "C/G"], "heard", null, { held: true, maxNew: 3 }),
  S(19, 2, "Triads and CAGED", "Held for later", [], "heard", null, { held: true })
];
const STOP_BY = Object.fromEntries(STOPS.map(s => [s.id, s]));
export const stopById = id => STOP_BY[id] || null;
export const stopsOf = tourId => STOPS.filter(s => s.tour === tourId);
/* Does the stop have something to play today? Anything else is Coming soon. */
export const playable = s => !!(s.play && (s.play.opening?.length || s.play.lessons?.length));

/* The chords a stop's songs may use: the chords every stop up to and including it adds on its route (for the lead route the
   main line up to Tour 3 too, for fingerstyle up to Tour 4), or the easy set in Tour 1. */
export function allowedChords(stopId) {
  const stop = STOP_BY[stopId];
  if (!stop) return [];
  if (stop.allow) return stop.allow.slice();
  const tour = TOUR_BY[stop.tour], out = new Set();
  const upTo = (list, id) => { for (const s of list) { s.chords.forEach(c => out.add(c)); if (s.id === id) break; } };
  const main = STOPS.filter(s => TOUR_BY[s.tour].route === "main");
  if (tour.route === "main") upTo(main, stopId);
  else {
    const base = tour.route === "lead" ? 3 : 4;
    main.filter(s => TOUR_BY[s.tour].number <= base).forEach(s => s.chords.forEach(c => out.add(c)));
    upTo(STOPS.filter(s => TOUR_BY[s.tour].route === tour.route), stopId);
  }
  return [...out];
}
/* Every chord the 19 tours name, in the order they first appear (the chords a stop adds). */
export const curriculumChords = () => [...new Set(STOPS.flatMap(s => s.chords))];

// ---------- Rewards on or off (Unlock all tours) ----------
/* Reward code asks this one function. Unlock all tours (data.settings.unlockAll) plays everything and pays nothing. */
export const rewardsOn = data => !data?.settings?.unlockAll;

// ---------- What is done: today's progress mapped onto the stops ----------
/* A finished Opening night step, or the whole of it for a player who skipped it, finished it, replays it or had played before it. */
function openingDone(data) {
  const v = openingView(data);
  if (v !== "leg" || data.opening?.replay) return () => true;
  const step = openingStep(data), ids = OPENING.map(o => o.id);
  return id => ids.indexOf(id) >= 0 && ids.indexOf(id) < step;
}
/* A lesson is done by its own finish, or (a chord) by playing it in KNOW_PLAYS songs to the end. */
const lessonDone = (data, id) => !!data.skills?.done?.[id] || (id.startsWith("c:") && (data.journal?.chords?.[id.slice(2)]?.n || 0) >= KNOW_PLAYS);
/* The stops done by what is already kept (read only). */
export function mappedDone(data) {
  const op = openingDone(data), out = new Set();
  for (const s of STOPS) {
    if (s.held || !playable(s)) continue;
    const ok = s.play.opening ? s.play.opening.every(op) : s.play.lessons.every(id => lessonDone(data, id));
    if (ok) out.add(s.id);
  }
  return out;
}
/* data.curriculum is only what was mapped: it keeps a stop done once it was, so replaying or clearing an old field loses nothing. */
export function cleanCurriculum(raw) {
  if (!isObj(raw)) return null;
  const done = {};
  for (const [id, at] of Object.entries(isObj(raw.done) ? raw.done : {})) if (STOP_BY[id] && +at > 0) done[id] = Math.floor(+at);
  const settled = [...new Set((Array.isArray(raw.settled) ? raw.settled : []).filter(isCurriculumBox))];
  return settled.length ? { v: CURRICULUM_V, done, settled } : { v: CURRICULUM_V, done };
}
/* Unlock mode writes nothing. Otherwise the stops done by the old fields are remembered (once each). True when something was added. */
export function curriculumSeed(data, now = Date.now()) {
  if (!rewardsOn(data)) return false;
  const cur = data.curriculum && isObj(data.curriculum) ? data.curriculum : null, have = cur?.done || {};
  const add = [...mappedDone(data)].filter(id => !have[id]);
  if (cur && !add.length) return false;
  if (!cur && !add.length && !data.skills && !data.opening && !data.songTour) { data.curriculum = { v: CURRICULUM_V, done: {} }; return true; }
  /* The first time only: a new box behind where the player stands shows as opened and pays nothing (`settled`); boxes ahead pay. */
  const settled = cur ? cur.settled : curriculumState(data).tours.filter(t => t.route === "main" && t.stops.length > BOX_AFTER && boxState(data, t, new Set()) === "now").map(t => boxId(t.number));
  data.curriculum = { v: CURRICULUM_V, done: { ...have, ...Object.fromEntries(add.map(id => [id, now])) }, ...(settled?.length ? { settled } : {}) };
  return true;
}
const doneSet = data => new Set([...mappedDone(data), ...Object.keys(data.curriculum?.done || {}).filter(id => STOP_BY[id])]);

// ---------- State ----------
/* Each tour and stop as done, now, open or locked, and each route as open or not.
   A stop with something to play is "now" when it is the first one not done on its route, "locked" after it. A Coming soon
   stop never holds anything back: it is "open" once the stops before it are done. A tour is cleared when every stop in it
   that can be played is done; that opens the next tour on its route, and a route opens when its tour is cleared.
   Unlock all tours: every tour and stop is "open". */
export function curriculumState(data) {
  const done = doneSet(data), all = !rewardsOn(data), cleared = {}, routes = {}, tours = [], nowOn = {};
  for (const t of TOURS) cleared[t.id] = stopsOf(t.id).every(s => s.held || done.has(s.id) || !playable(s));
  for (const r of Object.keys(ROUTES)) routes[r] = { ...ROUTES[r], open: all || (r !== "held" && (ROUTES[r].opens === null || cleared[ROUTES[r].opens])) };
  for (const t of TOURS) {
    const held = t.route === "held", open = all || (!held && (t.opens === null || cleared[t.opens]));
    let reached = open;
    const stops = stopsOf(t.id).map(s => {
      let state;
      if (all) state = "open";
      else if (done.has(s.id)) state = "done";
      else if (!reached) state = "locked";
      else if (!playable(s)) state = "open";
      else if (!nowOn[t.route]) { state = "now"; nowOn[t.route] = s.id; reached = false; }
      else { state = "locked"; reached = false; }
      return { ...s, state };
    });
    const isDone = !all && !held && stops.every(s => s.state === "done");
    const state = all ? "open" : held || !open ? "locked" : isDone ? "done" : stops.some(s => s.state === "now") ? "now" : "open";
    tours.push({ ...t, state, stops, cleared: cleared[t.id] });
  }
  return { tours, routes, unlocked: all };
}
/* The stop to play next on a route: its first "now" stop, or null when what is left is Coming soon. */
export function nextStop(data, route = "main") {
  const st = curriculumState(data);
  if (!st.routes[route]?.open && !st.unlocked) return null;
  for (const t of st.tours) if (t.route === route) { const s = t.stops.find(x => x.state === "now"); if (s) return s; }
  return null;
}

// ---------- Merch boxes on the new tour ----------
/* A box after a tour's third stop, when the tour has a fourth (the old rule, BOX_EVERY). Ids are b:t<n>. */
export const BOX_AFTER = 3;
export const boxId = tourNumber => `b:t${tourNumber}`;
export const isCurriculumBox = id => /^b:t\d{1,2}$/.test(String(id));
const boxState = (data, tour, opened) => {
  const id = boxId(tour.number);
  if (opened.has(id) || (data.curriculum?.settled || []).includes(id)) return "done";
  const before = tour.stops.slice(0, BOX_AFTER);
  if (tour.state === "locked" || tour.route !== "main") return "locked";
  return before.every(s => s.state === "done") ? "now" : "locked";
};
/* Open a box on the new tour: only when it is reachable (every stop before it done). True when it opened (+FANS.box, counted by fansOf). */
export function curriculumBoxOpen(data, id, now = Date.now()) {
  if (!rewardsOn(data) || !isCurriculumBox(id)) return false;
  const tour = curriculumState(data).tours.find(t => boxId(t.number) === id);
  const opened = new Set(data.boxes?.opened || []);
  if (!tour || tour.stops.length <= BOX_AFTER || boxState(data, tour, opened) !== "now") return false;
  data.boxes = { opened: [...opened, id] };
  return true;
}
/* How many of the new boxes are opened (fansOf counts them; the old boxes are counted from roadPath). */
export const curriculumBoxesOpened = data => (data.boxes?.opened || []).filter(isCurriculumBox).length;

// ---------- What the Tour draws ----------
/* a stop as the Tour draws it (the same shape the old Road stops have, so its taps and cards keep working) */
function drawn(s, state) {
  const lesson = s.play?.lessons?.length === 1;
  const stop = { id: s.id, kind: s.kind, name: s.title, state, cs: true, tourId: s.tour, skill: s.skill, pass: s.pass, strum: s.strum, soon: !playable(s) };
  if (lesson && s.kind === "chord") stop.chord = s.play.lessons[0].slice(2);
  if (s.kind === "switch" && lesson) { const [a, b] = s.play.lessons[0].slice(2).split("-"); stop.a = a; stop.b = b; }
  if (s.play) stop.play = s.play;
  return stop;
}
/* The Tour as the Road draws it: legs of { id, n, name, note, stops, done }, the main line in full with a box after each
   tour's third stop, the song tours after Tour 4 (as they already are on the old Road), then one locked row each for the
   lead and fingerstyle routes (in full when Unlock all tours is on). `old` is roadTour's answer, which supplies the song tours. */
export function curriculumRoad(data, old = { legs: [] }) {
  const st = curriculumState(data), opened = new Set(data.boxes?.opened || []);
  const legs = [], songs = (old.legs || []).filter(l => l.song);
  const make = t => {
    const stops = t.stops.filter(s => !s.held).map(s => drawn(s, s.state));
    if (stops.length > BOX_AFTER) stops.splice(BOX_AFTER, 0, { id: boxId(t.number), kind: "box", name: "Merch box", state: st.unlocked ? "open" : boxState(data, t, opened), cs: true, tourId: t.id });
    return { id: t.id, n: t.number, name: t.name, note: t.stops[0]?.skill || "", route: t.route, stops, done: t.state === "done", state: t.state };
  };
  for (const t of st.tours.filter(x => x.route === "main")) {
    legs.push(make(t));
    if (t.id === "t4") for (const sl of songs) legs.push(st.unlocked ? { ...sl, stops: sl.stops.map(s => ({ ...s, state: "open" })) } : sl);
  }
  for (const r of ["lead", "fingerstyle"]) {
    const ts = st.tours.filter(x => x.route === r), open = st.routes[r]?.open;
    if (st.unlocked) { for (const t of ts) legs.push(make(t)); continue; }
    const first = ts[0], last = ts.at(-1);
    const after = +ROUTES[r].opens.slice(1);
    legs.push({ id: `route:${r}`, n: first.number, name: ROUTES[r].name, note: `Tours ${first.number} to ${last.number}`, route: r, done: false, state: "locked", row: true,
      stops: [{ id: `route:${r}`, kind: "chord", name: ROUTES[r].name, state: "locked", cs: true, soon: true, row: r, after, routeOpen: !!open, tourId: first.id, skill: `Tours ${first.number} to ${last.number}` }] });
  }
  /* current: a waiting box first, then the song tour's next stop, then the main line's next stop */
  const main = legs.filter(l => l.route === "main").flatMap(l => l.stops);
  const box = main.find(s => s.kind === "box" && s.state === "now" && !st.unlocked);
  const song = st.unlocked ? null : songs.flatMap(l => l.stops).find(s => s.state === "now");
  const ns = st.unlocked ? null : nextStop(data, "main");
  const current = box || song || (ns ? main.find(s => s.id === ns.id) : null) || null;
  const all = legs.flatMap(l => l.stops);
  const leg = legs.find(l => l.stops.some(s => s.id === current?.id)) || legs.find(l => l.route === "main" && !l.done) || legs[0] || null;
  return { legs, current: current ? all.find(s => s.id === current.id) || current : null, leg, coming: [] };
}
/* What a stop's button starts: the Opening night step it is on, or the first of its lessons not done. */
export function playNext(data, stop) {
  const s = STOP_BY[stop?.id];
  if (!s || !playable(s)) return null;
  if (s.play.opening) { const op = openingDone(data); return { opening: s.play.opening.find(i => !op(i)) || s.play.opening[0] }; }
  return { lesson: s.play.lessons.find(i => !lessonDone(data, i)) || s.play.lessons[0] };
}
