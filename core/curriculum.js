// The curriculum (5.17.0, Release A): 19 tours and their stops, in three routes. The main line (Tours 1 to 13) is
// chords and rhythm; the lead route (14 to 16) and the fingerstyle route (17 and 18) both open after
// Tour 4 (Graham, decision 16); Tour 19 is held. Every stop is a piece of a real song and a tour ends with the whole song, but Release A
// only draws the map: a stop that already has something playable (an Opening night step, a chord or switch lesson,
// a song tour) opens it, and every other stop says "Coming soon" and plays nothing.
// Today's progress is never rewritten: the old fields stay as they are (skills, opening, songTour, boxes, journal)
// and are mapped onto these stops. data.curriculum = { v, done: { stopId: time } } only remembers what was mapped.
// Re-exported from core.js. Topic files must not read other files' values while loading (only inside functions).
import { isObj } from "../core.js";
import { OPENING, openingView, openingStep, sheetChords } from "./game.js";
import { KNOW_PLAYS } from "./neck.js";
import { fitTour } from "./fit.js";

export const CURRICULUM_V = 1;
export const ROUTES = {
  main: { id: "main", name: "Main line", opens: null },
  lead: { id: "lead", name: "Lead route", opens: "t4" },
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
  T(14, "Studio Session", "lead", "t4"), T(15, "Spotlight", "lead", "t14"), T(16, "Last Call", "lead", "t15"),
  T(17, "Unplugged", "fingerstyle", "t4"), T(18, "Listening Room", "fingerstyle", "t17"),
  T(19, "Encore", "held")
];
const TOUR_BY = Object.fromEntries(TOURS.map(t => [t.id, t]));
export const routeOf = tourId => TOUR_BY[tourId]?.route || null;

/* 5.18.0 (B1): the capo answer. data.settings.capo is true, false, or missing (not asked yet). */
export const capoAnswer = data => data?.settings?.capo === true ? true : data?.settings?.capo === false ? false : null;
/* The songs Tour 1 can start with, hand-checked for the easy set (audit 4, decision 12). They are only names and chords: the words
   come from the Songbook or Get the song, never from here. `note` says what to play differently from the recording. */
export const TOUR1_SONGS = [
  { title: "Eleanor Rigby", artist: "The Beatles", chords: ["Em", "Cmaj7"], note: "Play the C as Cmaj7: one finger less." },
  { title: "Drunken Sailor", artist: "Traditional", chords: ["Em", "D6/9"], note: "Play the D as D6/9. This one is in the public domain." }
];
/* The song for Tour 1: a Songbook song with only easy-set chords (at least two, no tab), else the first hand-checked song not skipped. */
export function tour1Song(data, skipped = []) {
  const skip = new Set(skipped);
  for (const sg of data.songs || []) {
    if (sg.format === "tab" || skip.has(`${sg.title}|${sg.artist || ""}`.toLowerCase())) continue;
    const ch = [...new Set(sheetChords(sg.body || ""))];
    if (ch.length >= 2 && ch.length <= 3 && ch.includes("Em") && ch.every(c => EASY.includes(c))) return { from: "songbook", song: sg, chords: ch };
  }
  const pick = TOUR1_SONGS.find(x => !skip.has(`${x.title}|${x.artist}`.toLowerCase()));
  return pick ? { from: "list", ...pick } : null;
}
/* The easy set Tour 1's songs are fitted to (audit 4: a small hand-checked pool, two easy shapes). */
export const EASY = ["Em", "Em7", "Asus2", "A7", "Cmaj7", "D6/9"];

/* One stop: tour number, place in the tour, short title, the skill, the chords it adds, the pass type ("heard": Louie
   listens for the chord or note; "played": Louie can't judge it, so it counts when played through), what plays today
   (play), and the rules for the songs that fit it (rules: strum level, most new chords, headline or not).
   play: { opening: [ids] } | { lessons: [ids] } | null (Coming soon). A stop with one lesson keeps that lesson's id, so the
   Road's taps and the old tests find it; any other stop is "k<tour>.<n>". */
const L = (...lessons) => ({ lessons });
/* 5.18.0: a stop played as a piece of the tour's song (a round of the song with the chords learned so far; B2). */
const P = (...lessons) => ({ piece: true, ...(lessons.length ? { lessons } : {}) });
const O = (...opening) => ({ opening });
const S = (t, n, title, skill, chords, pass, play, o = {}) => {
  const lesson = play?.lessons?.length === 1 ? play.lessons[0] : "";
  const kind = o.kind || (lesson.startsWith("s:") ? "switch" : "chord");
  return { id: lesson || `k${t}.${n}`, tour: `t${t}`, n, title, skill, chords, pass, play, kind, strum: o.strum || "down", maxNew: o.maxNew ?? Math.max(1, chords.length), allow: o.allow || null, headline: !!o.headline, held: !!o.held, carry: o.carry || "" };
};
const H = (t, n, title, skill, pass = "heard", o = {}) => S(t, n, title, skill, [], pass, null, { ...o, kind: "headline", headline: true });
/* 5.18.0 (B4): the headline of Tours 2 to 4 is a piece too: the whole song, passed at 0.8x; 1.0x marks the song Solid. */
const HP = (t, n, skill, o = {}) => ({ ...H(t, n, "Headline show", skill, "heard", o), play: P() });
export const STOPS = [
  // Tour 1: Opening Night (5.18.0, B1): tune up, the first strum, Em, the second easy shape, the change, your first show
  S(1, 1, "Soundcheck", "Tune up and mic check", [], "heard", O("who", "hold", "strings", "mic"), { allow: EASY }),
  S(1, 2, "First strum", "Open strings on the beat, with the song's intro", [], "played", O("notes", "chord"), { allow: EASY }),
  S(1, 3, "Em", "The Em chord", ["Em"], "heard", L("c:Em"), { allow: EASY }),
  S(1, 4, "Second shape", "The easy shape the song uses beside Em", [], "heard", P(), { allow: EASY, carry: "show" }),
  S(1, 5, "The change", "Em to the second shape, strummed in time", [], "played", O("verse", "pause"), { allow: EASY }),
  { ...H(1, 6, "Your first show", "A whole two-shape song, your first Gig"), play: { opening: ["show"] }, allow: EASY },
  // Tour 2: Open Mic (A, D, E, down-ups)
  S(2, 1, "A", "The A chord", ["A"], "heard", L("c:A")),
  S(2, 2, "D", "The D chord", ["D"], "heard", L("c:D")),
  S(2, 3, "E", "The E chord", ["E"], "heard", L("c:E")),
  S(2, 4, "D to A and A to E", "The two changes", [], "heard", L("s:D-A", "s:A-E"), { kind: "switch" }),
  S(2, 5, "Down-ups", "Down-up strumming in eighths", [], "played", P(), { strum: "eighths" }),
  HP(2, 6, "A whole A, D, E song", { strum: "eighths" }),
  // Tour 3: Coffeehouse (G, C)
  S(3, 1, "G", "The G chord", ["G"], "heard", L("c:G"), { strum: "eighths" }),
  S(3, 2, "C", "The C chord", ["C"], "heard", L("c:C"), { strum: "eighths" }),
  S(3, 3, "G to C", "The change", [], "heard", L("s:G-C"), { strum: "eighths" }),
  S(3, 4, "C to D and G to D", "The two changes", [], "heard", L("s:C-D", "s:G-D"), { strum: "eighths", kind: "switch" }),
  HP(3, 5, "A whole G, C, D song", { strum: "eighths" }),
  // Tour 4: Street Corner (Am, Dm, the folk pattern)
  S(4, 1, "Am", "The Am chord", ["Am"], "heard", L("c:Am"), { strum: "folk" }),
  S(4, 2, "Dm", "The Dm chord", ["Dm"], "heard", L("c:Dm"), { strum: "folk" }),
  S(4, 3, "Em to Am and Am to C", "The two changes", [], "heard", L("s:Em-Am", "s:Am-C"), { strum: "folk", kind: "switch" }),
  S(4, 4, "The folk pattern", "Down, down-up, up-down-up", [], "played", P(), { strum: "folk" }),
  S(4, 5, "Keep the hand moving", "Strumming through the changes", [], "played", P(), { strum: "folk" }),
  HP(4, 6, "A whole four-chord song", { strum: "folk" }),
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
export const playable = s => !!(s.play && (s.play.opening?.length || s.play.lessons?.length || s.play.piece));

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

/* The Tour's song choices under Unlock all tours (5.18.1): held in memory for the visit, never in the library. `tourData(data)` is the
   library itself while rewards are on. While Unlock all tours is on it is a view of the library with its own copy of songTour and
   curriculum.waiting; read and change the Tour's song through it, and save the real `data` (which the view never touches). */
let visit = null;
export const tourVisitClear = () => { visit = null; };
export function tourData(data) {
  if (rewardsOn(data)) { visit = null; return data; }
  if (visit?.data !== data) {
    const view = Object.create(data), cur = isObj(data.curriculum) ? { ...data.curriculum } : { v: CURRICULUM_V, done: {} };
    if (cur.waiting) cur.waiting = { ...cur.waiting };
    view.songTour = data.songTour ? JSON.parse(JSON.stringify(data.songTour)) : null;
    view.curriculum = cur;
    visit = { data, view };
  }
  return visit.view;
}

// ---------- What is done: today's progress mapped onto the stops ----------
/* A finished Opening night step, or the whole of it for a player who skipped it, finished it, replays it or had played before it. */
function openingDone(data) {
  const v = openingView(data);
  if (v !== "leg" || data.opening?.replay) return () => true;
  const step = openingStep(data), ids = OPENING.map(o => o.id);
  return id => ids.indexOf(id) >= 0 && ids.indexOf(id) < step;
}
/* 5.18.0 (B1): a player past Opening night (finished, skipped, replaying it, or had played before it) has Tour 1 done. */
const pastOpening = data => openingView(data) !== "leg" || !!data.opening?.replay;
/* A lesson is done by its own finish, or (a chord) by playing it in KNOW_PLAYS songs to the end. */
const lessonDone = (data, id) => !!data.skills?.done?.[id] || (id.startsWith("c:") && (data.journal?.chords?.[id.slice(2)]?.n || 0) >= KNOW_PLAYS);
/* The stops done by what is already kept (read only). */
export function mappedDone(data) {
  const op = openingDone(data), out = new Set();
  const past = pastOpening(data);
  for (const s of STOPS) {
    if (s.held || !playable(s)) continue;
    if (s.tour === "t1" && past) { out.add(s.id); continue; } /* Opening night is behind you: Tour 1 is done, with no pay */
    let ok;
    if (s.play.opening) ok = s.play.opening.every(op);
    else if (s.play.lessons) ok = s.play.lessons.every(id => lessonDone(data, id));
    else ok = false; /* a piece-only stop is done when its round passes (data.curriculum.done), or by what it carries */
    if (!ok && s.carry && op(s.carry)) ok = true; /* Tour 1's second shape: the show is played, so it is done */
    if (ok) out.add(s.id);
  }
  /* 5.18.0 (B6): a finished old song tour (data.songTour.legs, read only) is the headline of the tour it became; rounds played
     in a half-done one are the first song stops of that tour */
  for (const id of oldSongStops(data)) out.add(id);
  return out;
}
/* What the old song tours (data.songTour.legs.open and .switch, read only) already did, as stops of the tour each became.
   The old fans for them are counted by fansOf already, so playing these stops again pays nothing more. */
const OLD_LEG_TOUR = { open: "t3", switch: "t4" };
export function oldSongStops(data) {
  const out = new Set();
  for (const [leg, tid] of Object.entries(OLD_LEG_TOUR)) {
    const o = data.songTour?.legs?.[leg];
    if (!o) continue;
    const rounds = (o.done || []).filter(x => /^r:/.test(x)).length;
    const pieces = STOPS.filter(s => s.tour === tid && s.play?.piece && !s.headline);
    for (const s of pieces.slice(0, rounds)) out.add(s.id);
    if (o.solid === true) out.add(OLD_SONG_TOUR[leg]);
  }
  return out;
}
/* Once per tour, add-only: a half-done old song tour (some rounds played, or a finished one) hands its song to the tour it became. */
export function carrySongTours(data) {
  let changed = false;
  for (const [leg, tid] of Object.entries(OLD_LEG_TOUR)) {
    const o = data.songTour?.legs?.[leg];
    if (!o?.song || !((o.done || []).length || o.solid)) continue;
    if (!(data.songs || []).some(x => x.id === o.song)) continue;
    const have = data.songTour.legs[tid];
    if (have?.song) continue;
    /* fitted like any song for that tour, so it plays with the capo it needs; a song that no longer fits is carried as it was */
    const song = data.songs.find(x => x.id === o.song), f = song ? fitTour(song.body, tid) : null;
    data.songTour.legs[tid] = { pick: o.pick ? { ...o.pick } : null, song: o.song, skipped: [], done: [], capo: f?.ok ? f.capo : 0, simplified: f?.ok ? !!f.simplified : false, ...(o.solid ? { solid: true } : {}) };
    changed = true;
  }
  return changed;
}
/* Does playing this piece pay? Once, and never for progress carried from the old song tours. */
export const piecePays = (data, stopId) => rewardsOn(data) && !data.curriculum?.paid?.[stopId] && !oldSongStops(data).has(stopId);
/* The old song tours became the tours' own song stops: Open chords' song tour is Tour 3's headline, Chord switches' is Tour 4's. */
const OLD_SONG_TOUR = { open: "k3.5", switch: "k4.6" };
const CHORD_SET = () => new Set(curriculumChords());
/* data.curriculum is only what was mapped: it keeps a stop done once it was, so replaying or clearing an old field loses nothing. */
export function cleanCurriculum(raw) {
  if (!isObj(raw)) return null;
  const done = {};
  for (const [id, at] of Object.entries(isObj(raw.done) ? raw.done : {})) if (STOP_BY[id] && +at > 0) done[id] = Math.floor(+at);
  const settled = [...new Set((Array.isArray(raw.settled) ? raw.settled : []).filter(isCurriculumBox))];
  const won = {};
  for (const [id, at] of Object.entries(isObj(raw.won) ? raw.won : {})) if (/^t\d{1,2}$/.test(id) && TOUR_BY[id] && +at > 0) won[id] = Math.floor(+at);
  const paid = {};
  for (const [id, at] of Object.entries(isObj(raw.paid) ? raw.paid : {})) if ((STOP_BY[id]?.play?.piece || STOP_BY[id]?.headline) && +at > 0) paid[id] = Math.floor(+at);
  /* 5.19.0 (Release C): what was tested out (a stop or tour id and when), the chords whose refresher was declined, the question asked, where Start here anyway began */
  const tested = {};
  for (const [id, at] of Object.entries(isObj(raw.tested) ? raw.tested : {})) if ((STOP_BY[id] || TOUR_BY[id]) && +at > 0) tested[id] = Math.floor(+at);
  const refresher = {};
  for (const [c, at] of Object.entries(isObj(raw.refresher) ? raw.refresher : {})) if (CHORD_SET().has(c) && +at > 0) refresher[c] = Math.floor(+at);
  const asked = +raw.asked > 0 ? Math.floor(+raw.asked) : 0;
  const start = TOUR_BY[raw.start]?.route === "main" && raw.start !== "t1" ? raw.start : "";
  const waiting = {};
  for (const [id, n] of Object.entries(isObj(raw.waiting) ? raw.waiting : {}).slice(0, 20)) if (/^[\w.-]{1,64}$/.test(id) && Number.isInteger(n) && n >= 1 && n <= 4) waiting[id] = n;
  return { v: CURRICULUM_V, done, ...(raw.box1 ? { box1: 1 } : {}), ...(settled.length ? { settled } : {}), ...(Object.keys(won).length ? { won } : {}), ...(Object.keys(waiting).length ? { waiting } : {}), ...(Object.keys(paid).length ? { paid } : {}), ...(Object.keys(tested).length ? { tested } : {}), ...(Object.keys(refresher).length ? { refresher } : {}), ...(asked ? { asked } : {}), ...(start ? { start } : {}) };
}
/* Unlock mode writes nothing. Otherwise the stops done by the old fields are remembered (once each). True when something was added. */
export function curriculumSeed(data, now = Date.now()) {
  const first = !(data.curriculum && isObj(data.curriculum) && data.curriculum.box1); /* only the first load of 5.18.0 on a library */
  const a = seedCore(data, now), b = first && backfillWon(data);
  return a || b;
}
/* Once: a player who played the Opening night show before 5.18.0 has Tour 1's headline, so Cornerstone is theirs (announced once, no fans). */
function backfillWon(data) {
  const o = data.opening;
  if (!rewardsOn(data) || !isObj(o) || !(+o.done > 0) || o.skipped) return false;
  const cur = data.curriculum && isObj(data.curriculum) ? data.curriculum : (data.curriculum = { v: CURRICULUM_V, done: {} });
  if (cur.won?.t1) return false;
  cur.won = { ...(cur.won || {}), t1: Math.floor(+o.done) };
  return true;
}
function seedCore(data, now) {
  if (!rewardsOn(data)) return false;
  const cur = data.curriculum && isObj(data.curriculum) ? data.curriculum : null, have = cur?.done || {};
  /* Once, for a library saved before 5.18.0: Tour 1 has a box now. A player already past the stops before it finds it opened, and it pays nothing. */
  let touched = false;
  if (cur && !cur.box1) {
    const t1 = curriculumState(data).tours.find(t => t.id === "t1");
    cur.box1 = 1; touched = true;
    if (t1 && t1.stops.length > BOX_AFTER && boxState(data, t1, new Set(data.boxes?.opened || [])) === "now") cur.settled = [...new Set([...(cur.settled || []), boxId(1)])];
  }
  if (carrySongTours(data)) touched = true;
  const add = [...mappedDone(data)].filter(id => !have[id]);
  if (cur && !add.length) return touched;
  if (!cur && !add.length && !data.skills && !data.opening && !data.songTour) { data.curriculum = { v: CURRICULUM_V, done: {} }; return true; }
  /* The first time only: a new box behind where the player stands shows as opened and pays nothing (`settled`); boxes ahead pay. */
  const settled = cur ? cur.settled : curriculumState(data).tours.filter(t => t.route === "main" && t.stops.length > BOX_AFTER && boxState(data, t, new Set()) === "now").map(t => boxId(t.number));
  data.curriculum = { ...(cur?.won ? { won: cur.won } : {}), ...(cur?.waiting ? { waiting: cur.waiting } : {}), ...(cur?.paid ? { paid: cur.paid } : {}), ...(cur?.tested ? { tested: cur.tested } : {}), ...(cur?.refresher ? { refresher: cur.refresher } : {}), ...(cur?.asked ? { asked: cur.asked } : {}), ...(cur?.start ? { start: cur.start } : {}), box1: 1, v: CURRICULUM_V, done: { ...have, ...Object.fromEntries(add.map(id => [id, now])) }, ...(settled?.length ? { settled } : {}) };
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
  const sn = all ? 0 : startNum(data); /* 5.19.0: Start here anyway opens the main tours before this one, marking nothing done */
  for (const t of TOURS) cleared[t.id] = (t.route === "main" && t.number < sn) || stopsOf(t.id).every(s => s.held || done.has(s.id) || !playable(s));
  for (const r of Object.keys(ROUTES)) routes[r] = { ...ROUTES[r], open: all || (r !== "held" && (ROUTES[r].opens === null || cleared[ROUTES[r].opens])) };
  for (const t of TOURS) {
    const held = t.route === "held", open = all || (!held && (t.opens === null || cleared[t.opens]));
    let reached = open;
    const stops = stopsOf(t.id).map(s => {
      let state;
      if (all) state = "open";
      else if (done.has(s.id)) state = "done";
      else if (t.route === "main" && t.number < sn) state = "open";
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


// ---------- Release C (5.19.0): test up, test out ----------
/* The levels a player who already plays can skip to by playing one song well: the check piece is the headline song of `tour`,
   played with Louie's band; passing it tests out every tour up to there and starts the player at `start`. */
export const TEST_LEVELS = [
  { id: "few", name: "A few chords", tour: "t1", start: "t2" },
  { id: "open", name: "Open chords and strumming", tour: "t4", start: "t5" }
];
export const testLevel = id => TEST_LEVELS.find(l => l.id === id) || null;
export const headlineOf = tourId => stopsOf(tourId).find(s => s.headline) || null;
export const tourNumber = tourId => TOUR_BY[tourId]?.number || 0;
const startNum = data => tourNumber(data.curriculum?.start);
/* A new player: nothing done on Tour 1 and no old Opening night progress. */
export function newPlayer(data) {
  const o = data.opening;
  if (isObj(o) && (o.skipped || o.done || o.replay || (o.step || 0) > 0)) return false;
  if (Object.keys(data.curriculum?.done || {}).some(id => STOP_BY[id]?.tour === "t1")) return false;
  return ![...mappedDone(data)].some(id => STOP_BY[id]?.tour === "t1");
}
/* "Have you played guitar before?" is asked once, to a new player (never under Unlock all tours, which writes nothing). */
export const levelAsk = data => rewardsOn(data) && !data.curriculum?.asked && newPlayer(data);
/* Test up is offered to everyone but a new player who has not been asked, until Tour 4 is done. */
export function testUpOn(data) {
  if (!rewardsOn(data) || (newPlayer(data) && !data.curriculum?.asked)) return false;
  return TEST_LEVELS.some(l => curriculumState(data).tours.find(t => t.id === l.tour)?.state !== "done");
}
export const levelsOpen = data => TEST_LEVELS.filter(l => curriculumState(data).tours.find(t => t.id === l.tour)?.state !== "done");
const curOf = data => data.curriculum && isObj(data.curriculum) ? data.curriculum : (data.curriculum = { v: CURRICULUM_V, done: {} });
/* The answer to the first-open question, kept once whatever it was. */
export function levelAnswered(data, now = Date.now()) {
  if (!rewardsOn(data)) return false;
  const cur = curOf(data);
  if (!cur.asked) cur.asked = now;
  return true;
}
/* Played the stop normally since it was tested out: a lesson done, or a piece paid. Tour 1's steps are never replayed. */
const playedNormally = (data, s) => {
  if (s.play?.piece) return !!data.curriculum?.paid?.[s.id] || oldSongStops(data).has(s.id);
  if (s.play?.lessons) return s.play.lessons.every(id => !!data.skills?.done?.[id]);
  return false;
};
/* Tested out and not played since: the label "Tested out" stands in for the check mark. */
export const testedOut = (data, id) => {
  const s = STOP_BY[id];
  if (s) return !!data.curriculum?.tested?.[id] && !playedNormally(data, s);
  return !!TOUR_BY[id] && !!data.curriculum?.tested?.[id] && stopsOf(id).some(x => testedOut(data, x.id));
};
/* Where "Start here anyway" begins: opens the main tours before `levelOrTour`, marks nothing done, pays nothing. */
export function startHere(data, levelId) {
  const lv = testLevel(levelId);
  if (!lv || !rewardsOn(data)) return false;
  const cur = curOf(data);
  if (tourNumber(lv.start) > startNum(data)) cur.start = lv.start;
  return true;
}
/* A check piece passed. `check` is { kind: "level", level } (every tour up to the level's), { kind: "tour", tour } or
   { kind: "stop", stop }. Every stop it covers is done and "tested out", except a headline that was played: the check tour's
   headline, which pays FANS.lesson once and earns the tour's guitar once (`won`). Tested stops pay nothing until played
   normally (a lesson pays from skills.done, a piece from `paid`), and the tours' boxes are settled, so testing out never pays
   more than playing the tour. Returns { tours, tour, pays, headline } or null. */
export function checkPassed(data, check, { rate = 1, now = Date.now() } = {}) {
  if (!rewardsOn(data) || !check) return null;
  const valid = check.kind === "stop" ? !!STOP_BY[check.stop] : check.kind === "level" ? !!testLevel(check.level) : check.kind === "tour" && TOUR_BY[check.tour]?.route === "main";
  if (!valid) return null;
  const cur = curOf(data), before = doneSet(data), tested = cur.tested || {};
  const opened = new Set(data.boxes?.opened || []);
  const readyAt = (t, set) => stopsOf(t.id).length > BOX_AFTER && !opened.has(boxId(t.number)) && stopsOf(t.id).slice(0, BOX_AFTER).every(x => set.has(x.id));
  const readyBefore = new Set(TOURS.filter(t => readyAt(t, before)).map(t => t.id));
  const mark = (s, test) => { if (before.has(s.id) || !playable(s) || s.held) return false; cur.done[s.id] = now; if (test) tested[s.id] = now; return true; };
  if (check.kind === "stop") {
    const s = STOP_BY[check.stop];
    if (!s || s.headline || !mark(s, true)) return null;
    cur.tested = tested;
    /* a box that became ready only because a stop was tested out pays nothing */
    const t = TOUR_BY[s.tour], after = doneSet(data);
    if (t && !readyBefore.has(t.id) && readyAt(t, after)) cur.settled = [...new Set([...(cur.settled || []), boxId(t.number)])];
    return { stop: s.id, tours: [], tour: s.tour, pays: false, headline: null };
  }
  const lv = check.kind === "level" ? testLevel(check.level) : null;
  const top = TOUR_BY[check.kind === "level" ? lv?.tour : check.tour];
  if (!top || top.route !== "main") return null;
  const tours = check.kind === "level" ? TOURS.filter(t => t.route === "main" && t.number <= top.number) : [top];
  const hl = headlineOf(top.id);
  if (!hl || !playable(hl) || (check.kind === "tour" && curriculumState(data).tours.find(x => x.id === top.id)?.state === "locked")) return null;
  const out = [], settled = new Set(cur.settled || []);
  for (const t of tours) {
    let any = false;
    for (const s of stopsOf(t.id)) if (s.id !== hl.id && mark(s, true)) any = true;
    if (any) { tested[t.id] = now; out.push(t.id); }
    /* a box already earned by playing stays openable and pays; any other box the check passes over is settled */
    if (stopsOf(t.id).length > BOX_AFTER && !opened.has(boxId(t.number)) && !readyBefore.has(t.id)) settled.add(boxId(t.number));
  }
  if (settled.size) cur.settled = [...settled];
  const pays = piecePays(data, hl.id) && !cur.won?.[top.id];
  if (!before.has(hl.id)) cur.done[hl.id] = now;
  if (pays) cur.paid = { ...(cur.paid || {}), [hl.id]: now };
  if (!cur.won?.[top.id]) cur.won = { ...(cur.won || {}), [top.id]: now };
  const t = data.songTour?.legs?.[top.id];
  if (rate >= 1 - 1e-9 && t?.song) { t.solid = true; const song = (data.songs || []).find(x => x.id === t.song); if (song && song.status !== "got") song.status = "solid"; }
  if (Object.keys(tested).length) cur.tested = tested;
  return { tours: out, tour: top.id, pays, headline: hl.id };
}
/* Two failed rounds on a chord from a tested-out stop earn an offer of a refresher; "No thanks" is kept so it is not offered again. */
export function refresherFor(data, chord) {
  if (!rewardsOn(data) || data.curriculum?.refresher?.[chord]) return null;
  const s = STOPS.find(x => x.chords.includes(chord) && testedOut(data, x.id));
  return s ? { chord, tour: TOUR_BY[s.tour].number, lesson: s.play?.lessons?.find(id => id === `c:${chord}`) || null } : null;
}
export function refresherDeclined(data, chord, now = Date.now()) {
  if (!rewardsOn(data) || !CHORD_SET().has(chord)) return false;
  const cur = curOf(data); cur.refresher = { ...(cur.refresher || {}), [chord]: now };
  return true;
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
function drawn(s, state, extra = {}) {
  const lesson = s.play?.lessons?.length === 1;
  const stop = { id: s.id, kind: s.kind, name: s.title, state, cs: true, tourId: s.tour, skill: s.skill, pass: s.pass, strum: s.strum, soon: !playable(s) };
  if (lesson && s.kind === "chord") stop.chord = s.play.lessons[0].slice(2);
  if (s.kind === "switch" && lesson) { const [a, b] = s.play.lessons[0].slice(2).split("-"); stop.a = a; stop.b = b; }
  if (s.play) stop.play = s.play;
  if (s.play?.piece) stop.piece = true;
  if (s.headline) stop.headline = true;
  return Object.assign(stop, extra);
}
/* The Tour as the Road draws it: legs of { id, n, name, note, stops, done }, the main line in full with a box after each
   tour's third stop, then one locked row each for the
   lead and fingerstyle routes (in full when Unlock all tours is on). The song tours are the tours' own song stops since 5.18.0. */
export function curriculumRoad(data) {
  const st = curriculumState(data), opened = new Set(data.boxes?.opened || []);
  const legs = [];
  const make = t => {
    const stops = t.stops.filter(s => !s.held).map(s => drawn(s, s.state, { tourOpen: t.state !== "locked", ...(testedOut(data, s.id) ? { tested: true } : {}) }));
    if (stops.length > BOX_AFTER) stops.splice(BOX_AFTER, 0, { id: boxId(t.number), kind: "box", name: "Merch box", state: st.unlocked ? "open" : boxState(data, t, opened), cs: true, tourId: t.id });
    return { id: t.id, n: t.number, name: t.name, note: t.stops[0]?.skill || "", route: t.route, stops, done: t.state === "done", state: t.state, ...(testedOut(data, t.id) ? { tested: true } : {}) };
  };
  for (const t of st.tours.filter(x => x.route === "main")) {
    legs.push(make(t));
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
  const ns = st.unlocked ? null : nextStop(data, "main");
  const current = box || (ns ? main.find(s => s.id === ns.id) : null) || null;
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

// ---------- A stop played as a piece of the tour's song (5.18.0, B2 and B4) ----------
/* The chords a piece round plays at a stop: the song's chords that the tour has taught by this stop (the rest are rests).
   Tour 1's pieces use the easy set, later tours everything allowed up to the stop. */
export const pieceChords = (stopId, songChords) => { const ok = new Set(allowedChords(stopId)); return songChords.filter(c => ok.has(c)); };
/* A piece round passed. Returns { id, headline, solid, tour, guitar } or null when it counts for nothing (Unlock all tours, a stop
   that is not the one you are on, a headline played below 0.8x). The headline at 1.0x marks the song Solid. Writes only
   data.curriculum.done and .won (add-only) and the song's own status. */
/* A headline passes at the song's middle speed: 0.75x with a recording, 0.8x with Louie's band (`need`, from `speedsFor` in rounds.js).
   Called without one it takes the lower of the two. */
export const HEADLINE_RATE = 0.75;
export function piecePlayed(data, stopId, { rate = 1, need = HEADLINE_RATE, now = Date.now() } = {}) {
  if (!rewardsOn(data)) return null;
  const s = STOP_BY[stopId];
  if (!s?.play?.piece) return null;
  if (s.headline && rate < need - 1e-9) return null;
  const at = curriculumState(data).tours.flatMap(t => t.stops).find(x => x.id === stopId);
  if (!at || (at.state !== "now" && at.state !== "done")) return null;
  const cur = data.curriculum && isObj(data.curriculum) ? data.curriculum : (data.curriculum = { v: CURRICULUM_V, done: {} });
  const first = !cur.done[stopId];
  if (first) cur.done[stopId] = now;
  /* A piece pays FANS.lesson once, the first time it is played (counted by fansOf from `paid`); progress carried from before pays nothing. */
  const pays = piecePays(data, stopId);
  if (pays) cur.paid = { ...(cur.paid || {}), [stopId]: now };
  const out = { id: stopId, headline: !!s.headline, solid: false, tour: s.tour, first, pays, guitar: null };
  if (s.headline) {
    if (!cur.won?.[s.tour]) cur.won = { ...(cur.won || {}), [s.tour]: now };
    const t = data.songTour?.legs?.[s.tour];
    if (rate >= 1 - 1e-9 && t) {
      t.solid = true; out.solid = true;
      const song = (data.songs || []).find(x => x.id === t.song);
      if (song && song.status !== "got") song.status = "solid";
    }
  }
  return out;
}
/* The tours whose headline was played (add-only), and the guitar each one earns: the old leg id whose "headlined" it stands for. */
export const TOUR_LEG = { t1: "open", t2: "switch", t3: "scales", t4: "strum" };
export const toursWon = data => Object.keys(data.curriculum?.won || {}).filter(id => TOUR_LEG[id]);
/* Opening night's show was played (not skipped): Tour 1's headline. Called from openingAdvance. */
export function curriculumWon(data, tourId, now = Date.now()) {
  if (!TOUR_LEG[tourId]) return;
  const cur = data.curriculum && isObj(data.curriculum) ? data.curriculum : (data.curriculum = { v: CURRICULUM_V, done: {} });
  if (!cur.won?.[tourId]) cur.won = { ...(cur.won || {}), [tourId]: now };
}
