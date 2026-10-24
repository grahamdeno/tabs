// Opening night (4.40.0): the first leg of the Road teaches the app by doing it, on the sample song.
//   1 Let me hear you    Louie gives the reason, then the phone asks for the microphone
//   2 Tap a chord        in the song, a strip above Play says which one
//   3 Play a verse       the Gig waits for Count me in and says to play each chord
//   4 Pause and pick up  tap anywhere, then Resume
//   5 Your first show    the song through; the Road then shows the leg done and the stat bar's doors
// The steps and fans live in core (`openingAdvance` and friends); this file is what you see.
// Gig.js calls the gig* hooks; the song page calls onSong and onChord; the Road calls micSheet and songFor.
import { OPENING, Tabs, openingAdvance, openingOn, openingStep } from "./core.js";
import { esc, haptic, layer, onLeave, toast } from "./ui.js";
import { chordNames, data } from "./app.js";
import { louie } from "./louie.js";

/* the song the steps use: the sample, else the song you opened last that has chords */
export function songFor() {
  const ok = s => s.format !== "tab" && chordNames(s.body || "").length >= 2;
  return data.songs.find(s => s.sample && ok(s)) || [...data.songs].filter(ok).sort((a, b) => (b.opened || 0) - (a.opened || 0))[0] || null;
}
const firstChord = song => chordNames(song?.body || "")[0] || "chord";

/* ---- the strip above the bar: Louie, which step, what to do ---- */
let stripTimer = 0;
export function strip(text, i = openingStep(data), ms = 0) {
  clearTimeout(stripTimer);
  let el = document.getElementById("on-strip");
  if (!el) { el = document.createElement("div"); el.id = "on-strip"; el.className = "on-strip"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.innerHTML = `<span class="on-lv">${louie("happy", { size: 46 })}</span><span class="on-tx"><small>STEP ${Math.min(i + 1, OPENING.length)} OF ${OPENING.length}</small>${esc(text)}</span>
    <span class="on-pips" aria-hidden="true">${OPENING.map((_, k) => `<i class="${k < i ? "done" : k === i ? "on" : ""}"></i>`).join("")}</span>`;
  if (ms) stripTimer = setTimeout(hideStrip, ms);
}
export function hideStrip() { clearTimeout(stripTimer); document.getElementById("on-strip")?.remove(); }
onLeave(hideStrip);

const advance = id => { const ok = openingAdvance(data, id); if (ok) { Tabs.save(data); haptic(1); } return ok; };

/* ---- 1 Let me hear you: the reason before the phone's own question ---- */
export function micSheet(done) {
  layer.innerHTML = `<div class="scrim" id="on-scrim"></div><div class="panel de-sheet on-mic" role="dialog" aria-label="Let me hear you"><div class="grab"></div>
    <div class="on-mic-lv">${louie("happy", { pose: "wave", size: 120 })}</div>
    <div class="on-pips c" aria-hidden="true">${OPENING.map((_, k) => `<i class="${k === 0 ? "on" : ""}"></i>`).join("")}</div>
    <h2>Let me hear you</h2>
    <p>I listen for your strums to score your shows, tune your guitar and check your chords. Nothing is recorded or sent anywhere.</p>
    <button class="btn primary" id="on-allow">Turn on the microphone</button>
    <button class="tb on-not" id="on-not">Not now (play without scoring)</button></div>`;
  const close = () => { layer.innerHTML = ""; done?.(); };
  const finish = off => {
    advance("mic");
    if (data.opening) { if (off) data.opening.micOff = true; else delete data.opening.micOff; Tabs.save(data); }
    close();
  };
  document.getElementById("on-scrim").onclick = () => { layer.innerHTML = ""; };
  document.getElementById("on-not").onclick = () => { finish(true); toast("No problem. Shows aren't scored until you turn the microphone on."); };
  document.getElementById("on-allow").onclick = async e => {
    e.currentTarget.disabled = true;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("none");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach(t => t.stop());
      data.settings.micExplained = true;
      finish(false); toast("Thanks. I can hear you.");
    } catch {
      finish(true); toast("The microphone is off. Shows aren't scored until it's on (Settings on your phone).");
    }
  };
}

/* ---- the song page ---- */
const SONG_SAY = {
  chord: song => `Tap the ${firstChord(song)} to see how it's played. Every chord works that way.`,
  verse: () => "Press Play. Play each chord as it comes, just the first verse.",
  pause: () => "Press Play, then tap anywhere to pause.",
  show: () => "Press Play and play it through to the end. That's your first show."
};
/* a song opened: say what this step wants (true when it took over from the usual tips) */
export function onSong(song) {
  if (!openingOn(data) || !song || song.format === "tab") return false;
  if (document.body.classList.contains("gigging")) return true; /* the Gig says its own step */
  const id = OPENING[openingStep(data)]?.id;
  if (!SONG_SAY[id]) return false;
  strip(SONG_SAY[id](song));
  if (id === "chord") {
    const c = [...document.querySelectorAll(".sheet .c[data-ch]")].find(el => { const r = el.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 200; });
    c?.classList.add("on-pulse");
  }
  return true;
}
export function onChord() {
  if (!openingOn(data) || OPENING[openingStep(data)]?.id !== "chord") return;
  document.querySelectorAll(".on-pulse").forEach(el => el.classList.remove("on-pulse"));
  advance("chord");
  data.settings.tipsSeen = { ...(data.settings.tipsSeen || {}), chord: true, play: true }; Tabs.save(data);
  strip("That's how it's played. Now press Play and play each chord as it comes, just the first verse.");
}

/* ---- the Gig ---- */
const stepId = () => openingOn(data) ? OPENING[openingStep(data)]?.id : "";
/* a show is starting: true when it should wait for Count me in */
export function gigOpen(g, el, start) {
  const id = stepId();
  if (!["verse", "pause", "show"].includes(id)) return false;
  g.opening = true; g.from = "road";
  if (data.opening?.micOff) g.noMic = true;
  hideStrip();
  if (id !== "verse") { strip(id === "pause" ? "Tap anywhere to pause." : "Play it through to the end. That's your first show.", undefined, id === "show" ? 7000 : 0); return false; }
  const off = !!data.opening?.micOff;
  const card = document.createElement("div");
  card.className = "on-count";
  card.innerHTML = `<div class="on-count-in de-sheet"><div class="on-mic-lv">${louie("happy", { pose: "point", size: 104 })}</div>
    <div class="on-pips c" aria-hidden="true">${OPENING.map((_, k) => `<i class="${k < 2 ? "done" : k === 2 ? "on" : ""}"></i>`).join("")}</div>
    <h2>Play each chord</h2>
    <p>${off ? "The words scroll and the chords are in the song. Your microphone is off, so I won't score this one; the mic button at the bottom turns it on." : "Play the chord you see. Catch it and it turns green and the crowd gets up. Miss one and the song keeps going; nothing fails."} Just the first verse for now.</p>
    <button class="btn primary" id="on-go">Count me in</button></div>`;
  el.appendChild(card);
  card.querySelector("#on-go").onclick = () => { card.remove(); start(); };
  return true;
}
/* each frame: the first verse played through finishes step 3 */
export function gigFrame(g, sec, playing) {
  if (!g.opening || stepId() !== "verse" || !playing) return;
  g.t0 ||= performance.now();
  const inVerse = /verse/i.test(sec || "");
  if (inVerse) g.inVerse = true;
  if ((g.inVerse && !inVerse) || performance.now() - g.t0 > 45000) {
    advance("verse");
    strip("That's a verse. Now tap anywhere to pause.");
  }
}
/* paused: Louie's line says what's next; hands back the line to use */
export function gigPaused(g) {
  if (!g.opening || stepId() !== "pause") return "";
  hideStrip(); g.pausedHere = true;
  return "That's a pause. Tap Resume to pick up right where you stopped.";
}
export function gigResumed(g) {
  if (!g.opening || !g.pausedHere || stepId() !== "pause") return;
  advance("pause");
  strip("Now play it through to the end. That's your first show.", undefined, 7000);
}
/* the show is complete: true when it finished opening night (the screen says so). A show played
   through without stopping still finishes the verse and pause steps on the way. */
export function gigDoneHere() {
  hideStrip();
  if (!["verse", "pause", "show"].includes(stepId())) return false;
  for (const id of ["verse", "pause", "show"]) if (stepId() === id) advance(id);
  return !openingOn(data) && !!data.opening?.done;
}
