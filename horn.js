// Trumpet (4.81.0): the song page for a B♭ trumpet. Louie asks once what you play; on trumpet the page reads a
// whole step up, each chord carries the note to play (Long notes and Hits) or the lines carry the tune (Melody),
// the chord row becomes the notes with their valves, a recording in a hard key says so with what to do, and a
// guitar playing along can put a capo on to make the key easy. The numbers are in core/trumpet.js.
import { capoFor, chordTones, guessKey, isTrumpet, keyHard, keyLoad, partNotes, TP_LEVELS, TP_PARTS, tpKey, tpLevel, tpName, tpPart, tpPretty, tpShift, transposeKey, valvesOf, valvesSay, Tabs } from "./core.js";
import { $, esc, icon, layer, toast, onLeave } from "./ui.js";
import { data, diag, lazy, redraw } from "./app.js";
import { louie } from "./louie.js";
import { duetSheet } from "./share.js";

export const tpOn = () => isTrumpet(data);
/* the capo a guitar playing along has on, for this song only and only until you leave it (a recording never has one) */
let capo = { id: "", n: 0 };
export const hornCapo = song => (song && capo.id === song.id ? capo.n : 0);
export const setHornCapo = (song, n) => { capo = { id: n ? song.id : "", n: n || 0 }; };
onLeave(() => { capo = { id: "", n: 0 }; });
/* how far the page moves the chords for the trumpet */
export const hornSteps = song => tpOn() ? tpShift(song, hornCapo(song)) : 0;
/* the key the song sounds in, as the page plays it */
export const soundKey = song => { const k = song.key || guessKey(song.body || ""); return k ? transposeKey(k, song.transpose || 0) : ""; };
export const hasMelody = song => !!(song?.tpMel?.lines || song?.sketch?.lines)?.some(l => l?.n?.length);
const melodyLines = song => song?.tpMel?.lines?.some(l => l?.n?.length) ? song.tpMel.lines : song?.sketch?.lines || [];
export function hornPart(song) {
  const p = data.settings.tpPart;
  return p === "melody" && !hasMelody(song) ? "long" : TP_PARTS.some(x => x[0] === p) ? p : "long";
}

/* three valves, the ones down filled in */
export function valvesHTML(m, cls = "") {
  const v = valvesOf(m);
  if (v == null) return "";
  return `<span class="tp-v${cls ? " " + cls : ""}" role="img" aria-label="${valvesSay(m)}">${[1, 2, 3].map(k => `<i class="${v.includes(String(k)) ? "on" : ""}"></i>`).join("")}</span>`;
}

/* The sheet on trumpet: each chord gets its note (Long notes, Hits), or each line the tune's notes (Melody).
   Runs right after the sheet is drawn, before it is measured. */
export function paintHorn(sheet, song, flats) {
  sheet.classList.add("tp");
  const part = hornPart(song);
  if (part === "melody") {
    const shift = hornSteps(song), lines = melodyLines(song);
    [...sheet.querySelectorAll(":scope > .ly, :scope > .pr, :scope > .crow")].forEach((el, k) => {
      const n = lines[k]?.n;
      if (!n?.length) return;
      el.insertAdjacentHTML("beforeend", `<span class="tp-mel" role="list" aria-label="Melody">${n.map(([m]) => { const w = m + shift; return `<span class="tp-mn" role="listitem"><b>${tpName(w, flats)}</b>${valvesHTML(w, "sm")}</span>`; }).join("")}</span>`);
    });
    return;
  }
  const els = [...sheet.querySelectorAll(".c[data-ch]")];
  const notes = tpPart(els.map(e => e.dataset.ch), tpLevel(data), flats);
  els.forEach((el, i) => {
    const p = notes[i];
    if (!p) return;
    el.dataset.tp = p.m;
    el.insertAdjacentHTML("beforeend", `<b class="tp-n" aria-label="play ${esc(p.name)}">${esc(p.name)}</b>`);
  });
}

/* The row under the title on trumpet: your part, the key you read in, and the notes with their valves */
export function hornStrip(box, sheet, song) {
  const part = hornPart(song), parts = TP_PARTS.filter(([k]) => k !== "melody" || hasMelody(song));
  const key = soundKey(song), wk = tpKey(key, hornCapo(song)), load = keyLoad(wk), hard = key && keyHard(key, tpLevel(data), hornCapo(song));
  const say = part === "hits" ? "Short punches on beats 2 and 4." : part === "melody" ? "The tune, note by note." : "Hold each note through its chord.";
  const keyTxt = wk ? `You read in ${tpPretty(wk)}${load ? `: ${load} ${/b/.test(wk) ? "flat" : "sharp"}${load > 1 ? "s" : ""}` : ", no sharps or flats"}. ` : "";
  /* the notes: each one with the chords it sits over (Long notes, Hits), or the tune's notes (Melody) */
  let cards = [];
  if (part === "melody") {
    const shift = hornSteps(song), seen = new Map();
    melodyLines(song).forEach(l => (l?.n || []).forEach(([m]) => { const w = m + shift; if (!seen.has(w)) seen.set(w, { m: w, over: [] }); }));
    cards = [...seen.values()].sort((a, b) => a.m - b.m);
  } else {
    const by = new Map();
    sheet.querySelectorAll(".c[data-tp]").forEach(el => { const m = +el.dataset.tp, x = by.get(m) || { m, over: [] }; if (!x.over.includes(el.dataset.ch)) x.over.push(el.dataset.ch); by.set(m, x); });
    cards = [...by.values()].sort((a, b) => a.m - b.m);
  }
  const flats = /b/.test(wk);
  box.innerHTML = `
    <div class="strip-h"><span id="tp-parth">Your part</span></div>
    <div class="seg tp-parts${parts.length === 2 ? " two" : ""}" role="group" aria-labelledby="tp-parth">${parts.map(([k, n]) => `<button data-tpp="${k}" class="${k === part ? "on" : ""}" aria-pressed="${k === part}">${n}</button>`).join("")}</div>
    <p class="tp-say">${esc(keyTxt + say)}${hard ? ` <button class="linkbtn" id="tp-hard">This key is hard</button>` : ""}</p>
    ${cards.length ? `<div class="strip-h"><span>Notes</span><span class="n">${cards.length}</span></div>
    <div class="strip tp-strip" role="list" aria-label="Notes in your part, ${cards.length}">${cards.map(c => `<div class="scard tp-card" role="listitem" aria-label="${esc(tpName(c.m, flats))}${c.over.length ? `, over ${esc(c.over.map(tpPretty).join(", "))}` : ""}, ${valvesSay(c.m)}">${c.over.length ? `<small>over ${esc(c.over.slice(0, 2).map(tpPretty).join(" "))}${c.over.length > 2 ? "…" : ""}</small>` : ""}<b>${esc(tpName(c.m, flats))}</b>${valvesHTML(c.m)}</div>`).join("")}</div>` : ""}
    <button class="btn tp-ear" id="tp-ear">${icon("mic")}${hasMelody(song) ? "Find the tune again by ear" : "Find the tune by ear"}</button>`;
  box.querySelectorAll("[data-tpp]").forEach(b => b.onclick = () => { data.settings.tpPart = b.dataset.tpp; Tabs.save(data); redraw(); });
  $("tp-hard")?.addEventListener("click", () => hardKeySheet(song));
  $("tp-ear").onclick = () => {
    const words = [...sheet.querySelectorAll(":scope > .ly, :scope > .pr, :scope > .crow")].map(el => { const c = el.cloneNode(true); c.querySelectorAll(".c, .tp-mel, .de-tr, .de-en").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); });
    lazy("sketch.js").then(m => m.findTune(song, words));
  };
}

/* Louie asks once (4.81.0): what you play, and on trumpet how long. Settings > Instrument changes it later. */
export function askInstrument(then) {
  let pick = data.settings.instrument === "trumpet" ? "trumpet" : "guitar", lv = tpLevel(data);
  const paint = () => {
    layer.innerHTML = `<div class="scrim" id="in-scrim"></div><div class="panel card inst" role="dialog" aria-labelledby="in-h">
      <div class="in-head">${louie("happy", { pose: "wave", size: 64 })}<p id="in-h">What are you playing? I'll write every song for it.</p></div>
      <div class="in-pick" role="radiogroup" aria-label="Instrument">
        <button role="radio" data-in="guitar" class="${pick === "guitar" ? "on" : ""}" aria-checked="${pick === "guitar"}"><b>Guitar</b><small>Chords and strums</small></button>
        <button role="radio" data-in="trumpet" class="${pick === "trumpet" ? "on" : ""}" aria-checked="${pick === "trumpet"}"><b>Trumpet</b><small>B♭, one note at a time</small></button></div>
      ${pick === "trumpet" ? `<div class="pt-cap" id="in-lvh">How long have you played?</div>
      <div class="seg in-lv" role="group" aria-labelledby="in-lvh">${Object.entries(TP_LEVELS).map(([k, x]) => `<button data-lv="${k}" class="${k === lv ? "on" : ""}" aria-pressed="${k === lv}">${x.name}</button>`).join("")}</div>
      <p class="in-note">Parts stay from ${tpName(TP_LEVELS[lv].lo)} to ${tpName(TP_LEVELS[lv].hi)}${TP_LEVELS[lv].hi >= 77 ? " on the top line" : ""}. Chords and notes are written for B♭ trumpet: a G on the guitar shows as A for you.</p>` : ""}
      <button class="btn primary in-go" id="in-go">${pick === "trumpet" ? "PLAY TRUMPET" : "PLAY GUITAR"}</button></div>`;
    layer.querySelectorAll("[data-in]").forEach(b => b.onclick = () => { pick = b.dataset.in; paint(); });
    layer.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { lv = b.dataset.lv; paint(); });
    const done = () => {
      const was = data.settings.instrument;
      data.settings.instrument = pick;
      if (pick === "trumpet") data.settings.tpLevel = lv;
      Tabs.save(data); layer.innerHTML = "";
      if (was !== pick) redraw();
      then?.(pick);
    };
    $("in-go").onclick = done;
    $("in-scrim").onclick = done; /* asked once: a tap outside keeps what is picked */
  };
  paint();
}

const SHARP_ORDER = ["F♯", "C♯", "G♯", "D♯", "A♯", "E♯", "B♯"], FLAT_ORDER = ["B♭", "E♭", "A♭", "D♭", "G♭", "C♭", "F♭"];
/* A recording in a key too hard for how long you've played: Long notes keep to a few notes, a guitar with a capo
   makes it easy, or try it anyway. Shown once per song by itself; the part row's "This key is hard" opens it again. */
export function hardKeySheet(song) {
  const key = soundKey(song), wk = tpKey(key), load = keyLoad(wk) || 0, flats = /b/.test(wk), c = capoFor(key);
  const notes = partNotes([...document.querySelectorAll("#sheet .c[data-tp]")].map(el => ({ m: +el.dataset.tp })));
  const names = notes.map(n => tpName(n.m, flats));
  const few = names.length && names.length <= 4 ? `Only ${["", "one note", "two notes", "three notes", "four notes"][names.length]}: ${names.slice(0, -1).join(", ")}${names.length > 1 ? " and " : ""}${names.at(-1)}` : "Held notes, the easiest part";
  layer.innerHTML = `<div class="scrim" id="hk-scrim"></div><div class="panel card hk" role="dialog" aria-labelledby="hk-h">
    <div class="grab" aria-hidden="true"></div>
    <div class="hk-head">${louie("happy", { size: 56 })}<div><h2 id="hk-h">This one's in a hard key</h2><span>The recording is in ${esc(tpPretty(key))}, so you read in ${esc(tpPretty(wk))}: ${load} ${flats ? "flat" : "sharp"}${load === 1 ? "" : "s"}.</span></div></div>
    <div class="hk-acc" role="img" aria-label="The ${flats ? "flats" : "sharps"} in ${esc(tpPretty(wk))}">${(flats ? FLAT_ORDER : SHARP_ORDER).slice(0, load).map(x => `<span>${x}</span>`).join("")}</div>
    <button class="hk-opt primary" id="hk-long"><span><b>Play Long notes</b><small>${esc(few)}</small></span></button>
    <button class="hk-opt" id="hk-duet">${icon("share")}<span><b>Play together with a guitar</b><small>${c ? `A capo on ${c} puts you in ${esc(tpPretty(tpKey(key, c)))}${keyLoad(tpKey(key, c)) ? "" : ", no sharps or flats"}` : "Play it with a friend on the same song"}</small></span></button>
    <button class="linkbtn hk-any" id="hk-any">Try it in ${esc(tpPretty(wk))} anyway</button></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("hk-scrim").onclick = close; $("hk-any").onclick = close;
  $("hk-long").onclick = () => { close(); if (hornPart(song) !== "long") { data.settings.tpPart = "long"; Tabs.save(data); redraw(); } toast("Long notes it is"); };
  $("hk-duet").onclick = () => { close(); if (c) { setHornCapo(song, c); redraw(); } duetSheet(song); };
}
/* on opening a song on trumpet: the hard-key sheet once for a song that needs it */
export function hornOpen(song) {
  if (!tpOn() || song.tpHardSeen || hornCapo(song)) return false;
  const key = soundKey(song);
  if (!key || !keyHard(key, tpLevel(data))) return false;
  song.tpHardSeen = true; Tabs.save(data);
  hardKeySheet(song);
  return true;
}

/* The Gig on trumpet: the note to play for a target (a run of one chord), and the notes that count for it as they
   sound (the part's note; any chord tone for a Melody) */
export function targetNote(t) {
  const el = t && diag.seq?.[t.first]?.el, m = el ? +el.dataset.tp : NaN;
  return m > 0 ? { m, name: tpName(m, /b/.test(el.dataset.ch || "")), over: el.dataset.ch } : null;
}
export function tpOkFor(t, song) {
  if (!t) return null;
  if (t.tpOk) return t.tpOk;
  const shift = hornSteps(song), down = pc => ((pc - shift) % 12 + 12) % 12;
  const n = targetNote(t);
  t.tpOk = n && hornPart(song) !== "melody" ? [down(n.m % 12)] : (chordTones(t.name) || []).map(down);
  return t.tpOk;
}
/* the card in the corner of the show: the note, its valves and the chord it is over */
export function hornNowHTML(t, label, song) {
  const n = targetNote(t);
  if (!n) return "";
  return `<small>${label === "NOW" ? "PLAY" : label}</small><b>${esc(n.name)}</b>${valvesHTML(n.m)}<small>over ${esc(tpPretty(n.over))}${hornPart(song) === "hits" ? " · on 2 and 4" : ""}</small>`;
}
