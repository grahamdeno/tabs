// Chord timeline (5.11.0): ways to see the chords while you play, picked in Settings, Playing, "Chords while playing".
// Since 5.12.0 Timeline over each line is how songs show unless you pick another (Graham, 2026-11-26); "Over the
// words" puts the song page as it was before 5.11.0.
//   lines: every line of the song page gets a thin bar split by how long each chord lasts, with the chord's
//          name in each part; the chord letters over the words are hidden (kept for VoiceOver and for timing).
//   strip: while a song plays, a panel at the top shows the whole song as a thin strip and the chords coming up as
//          big blocks, each as wide as it lasts, sliding past a playhead; the words stay below without letters.
// How long a chord lasts is worked out from the sheet: its share of the line's words (a chord over more words lasts
// longer), with a line taking at least two bars. To take it out of the app: delete this file, its SHELL line in
// sw.js, the calls marked "timeline" in app.js, stage.js and settings.js, and its CSS block.
import { data } from "./app.js";
import { esc } from "./core.js";

export const TL_VIEWS = ["lines", "strip"];
/* what each is called, in Settings and Tools ("" is Over the words, stored as "words") */
export const TL_NAMES = { lines: "Timeline over each line", strip: "Chord timeline", "": "Over the words" };
export const tlView = () => { const v = data.settings?.playView; return v === "words" ? "" : TL_VIEWS.includes(v) ? v : "lines"; };
/* store a pick: Timeline over each line is the default, so it needs nothing stored */
export function tlPick(v) { if (v === "lines") delete data.settings.playView; else data.settings.playView = v || "words"; }

/* One colour per chord, by its root: the same chord is the same colour everywhere. Minor chords are a shade deeper.
   Text on each is white or espresso, whichever reads (both pass 4.5:1 on these). */
const ROOTS = { C: [218, 52, 48], D: [36, 72, 56], E: [350, 55, 52], F: [150, 45, 33], G: [172, 52, 32], A: [270, 40, 50], B: [200, 60, 40] };
/* relative luminance of an hsl colour, for picking the text that reads on it */
function lumOf(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  const lin = c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}
const ESPRESSO = 0.0108; /* luminance of #1E1914 */
export function chordColor(name) {
  const m = /^([A-G])(#|b)?(m(?!aj))?/.exec(String(name || ""));
  if (!m) return { bg: "#5E5850", fg: "#FFFFFF" };
  let [h, s, l] = ROOTS[m[1]];
  if (m[2]) h = (h + (m[2] === "#" ? 14 : -14) + 360) % 360;
  if (m[3]) l -= 8;
  /* the text that reads better; if neither reaches 4.6 to 1, the fill goes a step darker (white) until it does */
  for (;;) {
    const L = lumOf(h, s, l), white = 1.05 / (L + 0.05), esp = (L + 0.05) / (ESPRESSO + 0.05);
    if (esp >= 4.6 && esp > white) return { bg: `hsl(${h} ${s}% ${l}%)`, fg: "#1E1914" };
    if (white >= 4.6 || l <= 10) return { bg: `hsl(${h} ${s}% ${l}%)`, fg: "#FFFFFF" };
    l -= 2;
  }
}

/* The chords of one line of the page and how long each lasts, as weights that add up to the line's bars. */
export function lineWeights(lineEl) {
  const chords = [...lineEl.querySelectorAll(".c[data-ch]")];
  if (!chords.length) return [];
  const chars = chords.map(() => 0);
  if (lineEl.classList.contains("pr")) {
    let i = -1;
    const walk = document.createTreeWalker(lineEl, 5) /* elements and text */;
    for (let n = walk.currentNode; n; n = walk.nextNode()) {
      if (n.nodeType === 1) { if (n.matches(".c[data-ch]")) i++; continue; }
      if (n.parentElement?.closest(".c, .de-tr, .de-en, .tlb")) continue;
      chars[Math.max(0, i)] += n.textContent.replace(/\s+/g, " ").length;
    }
  }
  const total = chars.reduce((a, b) => a + b, 0);
  const share = total ? chars.map(c => Math.max(c, total * 0.08) ) : chars.map(() => 1);
  const sum = share.reduce((a, b) => a + b, 0), bars = Math.max(2, chords.length);
  return chords.map((el, k) => ({ el, name: el.dataset.ch, w: share[k] / sum * bars }));
}

/* lines: a bar over every line that has chords. Called after the sheet is drawn. */
export function tlDecorate(sheet) {
  document.body.classList.toggle("tl-lines", tlView() === "lines");
  document.body.classList.toggle("tl-strip", tlView() === "strip");
  sheet?.querySelectorAll(".tlb").forEach(b => b.remove());
  strip.key = null;
  if (!sheet || tlView() !== "lines") return;
  sheet.querySelectorAll(":scope > .pr, :scope > .crow").forEach(line => {
    const ws = lineWeights(line);
    if (!ws.length) return;
    const bar = document.createElement("div");
    bar.className = "tlb";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = ws.map(x => { const c = chordColor(x.name); return `<span class="tls" style="flex-grow:${x.w.toFixed(3)};--tl-bg:${c.bg};--tl-fg:${c.fg}">${esc(x.name)}</span>`; }).join("");
    line.prepend(bar);
  });
}

/* ---- strip: the panel while a song plays ---- */
const PX_BAR = 76; /* a bar's width in the big blocks */
const strip = { key: null, spots: [], el: null, at: -1 };
/* every chord of the page in order: t and w in bars for the whole-song strip, x and px (pixels, never narrower than a
   name needs) for the big blocks */
function spotsOf(sheet) {
  const out = [];
  let t = 0, x = 0;
  sheet.querySelectorAll(":scope > .pr, :scope > .crow").forEach(line => {
    for (const c of lineWeights(line)) {
      const px = Math.max(58, c.w * PX_BAR);
      out.push({ el: c.el, name: c.name, t, w: c.w, x, px }); t += c.w; x += px;
    }
  });
  return { spots: out, total: t, width: x };
}
function stripBuild(sheet) {
  const { spots, total, width } = spotsOf(sheet);
  strip.spots = spots; strip.total = total; strip.at = -1;
  strip.el?.remove();
  if (!spots.length) { strip.el = null; return; }
  const el = document.createElement("div");
  el.className = "tlp"; el.id = "tlp";
  el.setAttribute("aria-hidden", "true"); /* the words and chords below say the same for VoiceOver */
  const mini = spots.map(s => { const c = chordColor(s.name); return `<i style="flex-grow:${s.w.toFixed(3)};background:${c.bg}"></i>`; }).join("");
  const blocks = spots.map((s, i) => { const c = chordColor(s.name); return `<span class="tlk" data-i="${i}" style="left:${s.x.toFixed(1)}px;width:${(s.px - 4).toFixed(1)}px;--tl-bg:${c.bg};--tl-fg:${c.fg}"><b>${esc(s.name)}</b></span>`; }).join("");
  el.innerHTML = `<div class="tlp-mini">${mini}<i class="tlp-you"></i></div><div class="tlp-lane"><div class="tlp-track" style="width:${(width + 400).toFixed(0)}px">${blocks}</div><i class="tlp-head"></i></div>`;
  document.body.appendChild(el);
  strip.el = el;
}

/* Each frame while a song plays: w is the stage's "where" ({ b, idx, from, ... }) and seq the page's chord labels. */
export function tlTick(w, seq) {
  const view = tlView(), sheet = document.getElementById("sheet");
  if (!view || !w || !sheet) return;
  const on = seq?.[w.from]?.el;
  if (view === "lines") {
    fadeLines(sheet);
    const line = on?.closest(".pr, .crow");
    if (line && strip.lineOn !== on) {
      strip.lineOn = on;
      sheet.querySelectorAll(".tls.on, .tls.past").forEach(s => s.classList.remove("on", "past"));
      const k = [...line.querySelectorAll(".c[data-ch]")].indexOf(on);
      [...line.querySelectorAll(".tls")].forEach((s, i) => { s.classList.toggle("past", i < k); s.classList.toggle("on", i === k); });
    }
    return;
  }
  if (strip.key !== seq) { strip.key = seq; stripBuild(sheet); }
  if (!strip.el) return;
  const i = Math.max(0, strip.spots.findIndex(s => s.el === on));
  if (i === strip.at) return;
  strip.at = i;
  const s = strip.spots[i];
  strip.el.querySelector(".tlp-track").style.transform = `translateX(${(-s.x).toFixed(1)}px)`;
  strip.el.querySelector(".tlp-you").style.left = `${(s.t / strip.total * 100).toFixed(2)}%`;
  strip.el.querySelectorAll(".tlk").forEach((k, n) => { k.classList.toggle("past", n < i); k.classList.toggle("on", n === i); });
}
/* 5.12.0: a line fades out as it rises past the one you're on, and the lines further down fade in as they come up,
   fully there by two lines after the one you're on. Set on each line every frame from where it sits on the screen. */
const isRow = el => el.matches(".pr, .ly, .crow, .sec");
function fadeLines(sheet) {
  const now = sheet.querySelector(":scope > .st-now");
  if (!now) return;
  let full = now, n = 0;
  for (let el = now.nextElementSibling; el && n < 2; el = el.nextElementSibling) if (el.matches(".pr, .ly, .crow")) { full = el; n++; }
  const top = now.getBoundingClientRect().top, fullTop = full.getBoundingClientRect().top, H = innerHeight;
  const roof = Math.min(top - 1, Math.max(40, top * 0.25)); /* gone by here */
  for (const el of sheet.children) {
    if (!isRow(el)) continue;
    const y = el.getBoundingClientRect().top;
    if (y > H + 40 || y < -200) { el.style.removeProperty("opacity"); continue; }
    let o = 1;
    if (y < top - 1) o = Math.max(0, Math.min(1, (y - roof) / (top - roof))) * 0.85;
    else if (y > fullTop + 1) o = Math.max(0.12, 1 - (y - fullTop) / Math.max(80, H - fullTop));
    /* important: the stage holds every line at full opacity with an important rule of its own */
    if (o >= 0.995) el.style.removeProperty("opacity"); else el.style.setProperty("opacity", o.toFixed(3), "important");
  }
}
/* The song stops or the page goes: the panel goes too. */
export function tlStop() {
  document.querySelectorAll("#sheet > [style*='opacity']").forEach(el => el.style.removeProperty("opacity"));
  strip.el?.remove();
  Object.assign(strip, { el: null, key: null, at: -1, lineOn: null });
  document.querySelectorAll("#sheet .tls.on, #sheet .tls.past").forEach(s => s.classList.remove("on", "past"));
}
