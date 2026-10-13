// Tabs coach: one-time tips shown in place, the demos behind Show me, and the
// Tips & gestures page. Loaded with the app; app.js calls in when a tip is due.
import { Tabs, tipPaced } from "./core.js";
import { $, app, esc, icon, layer, onLeave, onScroll, toast } from "./ui.js";
import { READ_AT, aiKey, applyPaused, calm, card, chordEdit, data, diag, go, map, openTuner, paintMap, route, scroll, searching, setCurrent, setOpenEdit, showChordPop, viewing } from "./app.js";

// ---------- Coach: one-time help, in place and never in the way ----------
// "Try it" on the first song (tap a chord, then Play); everything else is shown
// once, at the moment it's most useful: a brief spotlight, a callout, and the
// feature itself doing its thing. Callouts never block a tap and any tap
// dismisses them. A feature you already use never gets its tip. Tips are paced
// (30 seconds apart) unless one leads naturally into the next, and nothing shows
// while a song plays except how to pause. Settings > Tips & gestures replays them.
const tipsSeen = () => (data.settings.tipsSeen && typeof data.settings.tipsSeen === "object" ? data.settings.tipsSeen : {});
const used = k => !!(data.settings.used && data.settings.used[k]);
const tipDue = k => !tipsSeen()[k] && !used(k);
function markSeen(k) { data.settings.tipsSeen = { ...tipsSeen(), [k]: true }; Tabs.save(data); }
function markUsed(k) {
  if (used(k)) return;
  data.settings.used = { ...(data.settings.used || {}), [k]: true };
  Tabs.save(data);
  document.querySelectorAll(`[data-new="${k}"]`).forEach(el => el.remove());
}
let lastCoach = { key: "", at: 0 };
// Claim a one-time tip: due, and not crowding the last one.
function coachTip(key) {
  if (!tipDue(key)) return false;
  if (!tipPaced(key, lastCoach, Date.now())) return false;
  markSeen(key);
  lastCoach = { key, at: Date.now() };
  return true;
}

// A light tick you can feel. Android vibrates; on iPhone (iOS 18 and later) a
// switch control ticks when it toggles, so a hidden one is toggled. Where neither
// works, nothing happens.
let hapticEl = null;
function tick() {
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
    if (!hapticEl) {
      hapticEl = document.createElement("label");
      hapticEl.className = "haptic";
      hapticEl.setAttribute("aria-hidden", "true");
      hapticEl.innerHTML = `<input type="checkbox" switch tabindex="-1">`;
      hapticEl.addEventListener("click", e => e.stopPropagation());
      document.body.appendChild(hapticEl);
    }
    hapticEl.click();
  } catch {}
}

let coachEl = null, coachDim = null, coachTimer = 0;
// A callout by `target` (or near the bottom with no target), with a brief
// spotlight around the target. `html` allows a short list.
function coach(target, text, { ms = 3600, place = "auto", pulse = false, fixed = false, spot = true, html = "" } = {}) {
  dismissCoach(true);
  document.querySelectorAll(".coach, .coach-dim").forEach(el => el.remove()); /* one at a time, even mid fade */
  if (target && !target.isConnected) return null;
  const el = document.createElement("div");
  el.className = "coach";
  el.setAttribute("role", "status");
  if (html) el.innerHTML = html; else el.textContent = text;
  document.body.appendChild(el);
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!target) el.classList.add("free");
  else {
    const r = target.getBoundingClientRect();
    if (spot) {
      const d = document.createElement("div");
      d.className = "coach-dim";
      d.style.cssText = `--cx:${r.left + r.width / 2}px;--cy:${r.top + r.height / 2}px;--rx:${Math.max(70, r.width * 0.72)}px;--ry:${Math.max(40, r.height * 1.1)}px`;
      document.body.insertBefore(d, el);
      coachDim = d;
    }
    if (place === "left") {
      el.style.left = Math.max(12, r.left - w - 12) + "px";
      el.style.top = Math.max(12, r.top + r.height / 2 - h / 2) + "px";
      el.classList.add("left");
    } else {
      const above = place === "above" || (place === "auto" && r.top > h + 90);
      const cx = r.left + Math.min(r.width, 160) / 2;
      const left = Math.max(12, Math.min(innerWidth - w - 12, cx - w / 2));
      el.style.left = left + "px";
      el.style.top = (above ? r.top - h - 12 : r.bottom + 12) + "px";
      el.style.setProperty("--ax", Math.max(14, Math.min(w - 14, cx - left)) + "px");
      el.classList.add(above ? "above" : "below");
    }
    if (pulse) target.classList.add("coach-pulse");
  }
  el._target = target; el._fixed = fixed || !target;
  coachEl = el;
  if (ms) coachTimer = setTimeout(() => dismissCoach(), ms);
  return el;
}
function dismissCoach(now = false) {
  clearTimeout(coachTimer);
  const el = coachEl, d = coachDim;
  coachEl = null; coachDim = null;
  if (!el) return;
  el._target?.classList.remove("coach-pulse");
  if (now === true) { el.remove(); d?.remove(); return; }
  el.classList.add("out"); d?.classList.add("out");
  setTimeout(() => { el.remove(); d?.remove(); }, 260);
}
document.addEventListener("pointerdown", () => dismissCoach(), true);
onScroll(() => { if (coachEl && !coachEl._fixed) dismissCoach(); });
onLeave(() => { dismissCoach(true); clearTimeout(coachFlow?.timer); coachFlow = null; });

// ---- The demos (also replayed by Show me) ----
const songReady = song => viewing === song && !scroll.on && !chordEdit && route().name === "song" && !layer.innerHTML;
const midOf = els => els.find(el => { const r = el.getBoundingClientRect(); return r.top > innerHeight * 0.38 && r.bottom < innerHeight * 0.72; })
  || els.find(el => { const r = el.getBoundingClientRect(); return r.top > 150 && r.bottom < innerHeight - 170; });

// First song: tap a chord (or watch its diagram appear), then Play.
let coachFlow = null;
function demoChord(song, force) {
  const c = midOf([...document.querySelectorAll(".sheet .c[data-ch]")]);
  if (!c) return false;
  const label = c.querySelector(".ct") || c;
  if (force) {
    showChordPop(c);
    coach(label, "Tap any chord to see how it's played", { ms: 3200, place: "below" });
    setTimeout(() => { if (!scroll.on && c.classList.contains("sel")) showChordPop(null); }, 3200);
    return true;
  }
  coach(label, "Tap a chord to see how to play it", { ms: 0, pulse: true, place: "below" });
  coachFlow = { song, timer: setTimeout(() => {
    if (viewing !== song || scroll.on || used("chord") || !c.isConnected) return;
    showChordPop(c);
    coach(label, "Tap any chord to see how it's played", { ms: 2800, place: "below" });
    coachFlow = { song, timer: setTimeout(() => { if (!scroll.on && c.classList.contains("sel")) showChordPop(null); coachFlow = null; playCoach(song); }, 3000) };
  }, 5000) };
  return true;
}
function songCoach(song) {
  if (!songReady(song)) return;
  if (pendingDemo) { const d = pendingDemo; pendingDemo = null; return runDemo(d, song); }
  if (tipDue("chord") && document.querySelector(".sheet .c[data-ch]")) { if (coachTip("chord")) demoChord(song); return; }
  playCoach(song);
}
function chordTapped(chord) {
  markUsed("chord");
  if (!coachFlow) return;
  clearTimeout(coachFlow.timer);
  const song = coachFlow.song;
  coachFlow = null;
  coach(chord.querySelector(".ct") || chord, "That's how it's played", { ms: 1800, place: "below", spot: false });
  setTimeout(() => playCoach(song), 2000);
}
function playCoach(song) {
  if (!songReady(song) || !$("play") || !coachTip("play")) return;
  coach($("play"), "Press play when you're ready", { ms: 5000, pulse: true, place: "above" });
}
// While playing: the pause badge fades in and out (without pausing).
function demoPause() {
  const stage = !!data.settings.stage;
  const g = document.createElement("div");
  g.className = "tappause ghost";
  g.innerHTML = icon("pause");
  document.body.appendChild(g);
  setTimeout(() => g.remove(), 1700);
  coach(null, stage ? "On stage, tap twice anywhere to pause" : "Tap anywhere to pause", { ms: 3200 });
}
// Paused: a line mid-screen gets the real focus look, the way play will start from it.
function demoLine() {
  const sheet = $("sheet");
  const line = midOf([...document.querySelectorAll(".sheet > .pr, .sheet > .ly")]);
  if (!sheet || !line) return false;
  const was = diag.block;
  sheet.classList.add("focus");
  setCurrent(line);
  coach(line, "Tap a line to start from it", { ms: 3400, place: "above", html: `<b>Tap a line to start from it</b><span>Play picks up right here.</span>` });
  setTimeout(() => { if (!scroll.on && diag.block === line && $("sheet") === sheet) { setCurrent(was); applyPaused(); } }, 3400);
  return true;
}
// Paused, with Now and Next off: show the real panel for a moment.
function demoNN() {
  const nn = $("nn");
  if (!nn || !diag.seq.length) return false;
  const top = $("sheet").getBoundingClientRect().top, line = innerHeight * READ_AT;
  let idx = 0;
  for (let i = 0; i < diag.seq.length; i++) if (top + diag.seq[i].y <= line) idx = i;
  const next = [];
  let last = diag.seq[idx].name;
  for (let i = idx + 1; i < diag.seq.length && next.length < 3; i++) if (diag.seq[i].name !== last) { next.push(diag.seq[i].name); last = diag.seq[i].name; }
  const fade = [0.85, 0.5, 0.28];
  nn.innerHTML = `<div class="nowcol"><div class="lab">NOW</div><div>${card(diag.seq[idx].name, 1.26)}</div></div><div class="vs"></div>
    <div style="min-width:0"><div class="lab">NEXT</div><div class="cards">${next.map((n, i) => card(n, 1, fade[i])).join("")}</div></div>`;
  document.body.classList.add("nn-demo");
  coach(nn, "", { ms: 3800, place: "above", fixed: true, html: `<b>Now and Next</b><span>The chord you're on, and what's coming, while you play. Turn it on with ${icon("fretboard")} below.</span>` });
  setTimeout(() => { document.body.classList.remove("nn-demo"); if (!scroll.on) nn.innerHTML = ""; }, 3800);
  return true;
}
// Song map: show the section names, the way they appear while dragging.
function demoMap() {
  const m = map.el;
  if (!m) return false;
  m.classList.remove("away");
  m.classList.add("active");
  setTimeout(() => { if (!map.dragging) { m.classList.remove("active"); paintMap(); } }, 2600);
  coach(m, "Drag to jump to a section", { ms: 2800, place: "left", fixed: true, spot: false });
  return true;
}
// Tap tempo: the chip taps out 92 BPM, four flashes you can feel, then shows the result.
function demoTap() {
  const tap = $("ed-tap");
  if (!tap) return false;
  const label = tap.querySelector("span"), beat = 60000 / 92;
  coach(tap, "", { ms: 4600, place: "below", html: `<b>Tap along with the beat</b><span>Four taps set the tempo.</span>` });
  if (calm()) { label.textContent = "92 BPM"; tick(); setTimeout(() => { label.textContent = "Tap"; }, 2400); return true; }
  [0, 1, 2, 3].forEach(i => setTimeout(() => {
    tap.classList.add("flash"); tick();
    label.textContent = i < 3 ? `Tap ${3 - i} more` : "92 BPM";
    setTimeout(() => tap.classList.remove("flash"), 140);
  }, 300 + i * beat));
  setTimeout(() => { if (label.isConnected) label.textContent = "Tap"; }, 300 + 3 * beat + 1600);
  return true;
}
// Search: invite a tap, then show what it can do.
const SEARCH_LIST = () => `<b>Search does more than find</b><ul>
  <li>Titles, artists, or a lyric you remember</li><li>Paste a chord sheet to add it</li><li>Paste a shared Tabs link to open it</li>
  <li>Not in your library? ${aiKey() ? "Find it online, or make a chord chart with AI" : "Find it online"}</li></ul>`;
function demoSearch(force) {
  const bar = document.querySelector(".cmd");
  if (!bar) return false;
  if (force) return !!coach(bar, "", { ms: 6000, place: "above", html: SEARCH_LIST() });
  return !!coach(bar, "", { ms: 5000, place: "above", pulse: true, html: `<b>Search does more than find</b><span>Tap to see what it can do.</span>` });
}
function searchOpened() {
  markUsed("searchInvite");
  if (!coachTip("search")) return;
  setTimeout(() => { const bar = document.querySelector(".cmd"); if (bar && searching) coach(bar, "", { ms: 7000, place: "below", fixed: true, html: SEARCH_LIST() }); }, 380);
}

// Settings > Tips & gestures: Show me replays a demo on a song (or the screen it belongs to).
let pendingDemo = null;
/* The editor asks whether a demo is waiting for it, and takes it. */
const takeDemo = name => { if (pendingDemo !== name) return false; pendingDemo = null; return true; };
function demoSong() {
  const chords = data.songs.filter(s => s.format !== "tab" && /\S/.test(s.body || ""));
  return chords.find(s => s.sample) || [...chords].sort((a, b) => (b.opened || 0) - (a.opened || 0))[0];
}
function showMe(name) {
  if (name === "search") { go("#/"); return setTimeout(() => demoSearch(true), 450); }
  if (name === "strobe") { go("#/"); return setTimeout(() => openTuner("standard", null, { demo: "strobe" }), 350); }
  const song = demoSong();
  if (!song) return toast("Add a chord sheet first");
  pendingDemo = name;
  if (name === "tap") setOpenEdit({ id: song.id, view: "sheet" });
  go("#/song/" + encodeURIComponent(song.id));
}
function runDemo(name, song) {
  if (name === "chord") return demoChord(song, true);
  if (name === "pause") return demoPause();
  if (name === "line") return demoLine();
  if (name === "nn") return demoNN();
  if (name === "map") {
    const sec = document.querySelectorAll(".sheet > .sec")[1];
    if (sec) window.scrollTo({ top: sec.getBoundingClientRect().top + scrollY - innerHeight * 0.3 });
    return setTimeout(demoMap, 450);
  }
}
const GESTURES = [
  ["On a song", [
    ["chord", "Tap a chord", "See how to play it", "fretboard"],
    ["line", "Tap a line", "Play starts from there", "play"],
    ["map", "Drag the section map", "Jump through the song", "sliders"],
    ["nn", "Now and Next", "The chord you're on, and what's coming", "fretboard"],
    ["", "Tap a chord card above the song", "Marks everywhere it's played", "fretboard"],
    ["", "Tap the title bar", "Back to the top", "up"],
    ["", "− and +", "Transpose (or resize, for tab)", "plus"],
    ["", "Tap the status chip", "Mark it Learning or Learned", "check"],
    ["", "Tap Listen, or the tuning chip", "Hear the recording, or open the tuner", "note"],
    ["", "Count-in", "Plays only when you start from the top", "metro"]]],
  ["While playing", [
    ["pause", "Tap anywhere", "Pause (tap twice on stage)", "pause"],
    ["", "Scroll by hand", "It carries on from where you leave it", "down"]]],
  ["Pedal or keyboard", [
    ["", "Left pedal, or Space", "Play and pause", "play"],
    ["", "Right pedal", "Next section; hold it to go back one", "down"],
    ["", "Any Bluetooth page-turner", "Pair it in the phone's Bluetooth settings; it works like a keyboard", "info"]]],
  ["Practice a section", [
    ["", "Tap the first and last line", "Loops that part; Build up adds a line each time", "loop"]]],
  ["Library and search", [
    ["search", "Search", "Titles, artists, a lyric; paste a sheet or a link", "search"],
    ["", "Return", "Opens the top match", "chev"],
    ["", "Back from a song you searched for", "Your results are still there", "back"]]],
  ["Editing", [
    ["tap", "Tap tempo", "Tap along to set the tempo", "pick"],
    ["", "Sing it, when adding a song", "Sing line by line and say the words; chords come from your melody", "mic"],
    ["", "On a sung song: Your recording, Simple or Rich", "Hear it back with the words following; Rich adds the 7ths and 9ths you sang", "play"],
    ["", "Tap a word on a sung song (in Edit)", "Chords that fit your melody there, and other ways to play the line", "pick"],
    ["", "Tap a word", "Place or change its chord", "edit"],
    ["", "The pencil, a section name, + Line or + Section", "Retype, rename, or add", "plus"],
    ["", "Sheet and Text", "Switch views; your place is kept. Every change has Undo", "edit"]]],
  ["Sets", [
    ["", "Tap the cover", "Change it", "image"],
    ["", "Arrows in Edit", "Reorder the songs", "up"],
    ["", "Next up", "Stop stays on this song; it waits if the next needs another tuning", "fork"]]],
  ["Tuner", [
    ["strobe", "Stripes near the note", "They stand still when it's right", "fork"],
    ["", "Tap a key", "Hear that string", "note"],
    ["", "Chromatic", "Any note, any instrument; set A4 at the bottom", "fork"]]],
  ["Deleting", [
    ["", "Undo", "Right after deleting a song or set", "back"],
    ["", "Recently deleted", "Keeps them for 30 days (Settings)", "trash"]]]
];
function renderGestures() {
  app.innerHTML = `
    <div class="head"><button class="ib glass" data-go="#/settings" aria-label="Back to settings">${icon("back")}</button></div>
    <h1 class="title">Tips &amp; gestures</h1>
    <p class="gs-intro">Things you can do with a tap or a drag that don't have a button. <b>Show me</b> plays the tip again where it happens.</p>
    ${GESTURES.map(([h, rows]) => `<div class="label">${h}</div><div class="list glass gs-list">${rows.map(([demo, t, s, ic]) => `
      <div class="gs-row"><span class="gs-ic">${icon(ic)}</span><div class="gs-t"><b>${esc(t)}</b><span>${esc(s)}</span></div>${demo ? `<button class="gs-show" data-demo="${demo}">Show me</button>` : ""}</div>`).join("")}</div>`).join("")}
    <button class="btn" id="gs-reset" style="display:block;margin:22px auto 6px">Reset tips</button>
    <p class="foot" style="text-align:center;margin:0 0 30px">Shows each tip again, once, when it's next useful.</p>`;
  app.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
  app.querySelectorAll("[data-demo]").forEach(b => b.onclick = () => showMe(b.dataset.demo));
  $("gs-reset").onclick = () => {
    data.settings.tipsSeen = {}; data.settings.used = {}; lastCoach = { key: "", at: 0 }; Tabs.save(data);
    window.scrollTo({ top: 0, behavior: calm() ? "auto" : "smooth" }); /* back to the top, where Back is */
    toast("Tips will show again");
  };
}

export { chordTapped, coach, coachTip, demoLine, demoMap, demoNN, demoPause, demoSearch, demoTap, dismissCoach, markSeen, markUsed, renderGestures, searchOpened, songCoach, takeDemo, tick, tipDue, tipsSeen, used };
