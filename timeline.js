// Chord timeline (5.11.0): how songs show since 5.12.0 (Graham, 2026-11-26), and the only way since 5.17.2 (the other
// two views and the Settings and Tools switcher were removed, Graham 2026-11-27): every line of the song page gets a thin
// bar split by how long each chord lasts, with the chord's name in each part; the chord letters over the words are
// hidden (kept for VoiceOver and for timing). While a song plays the bars on the line you're on and the next are lit,
// lines fade out above and in below.
// How long a chord lasts is worked out from the sheet: its share of the line's words (a chord over more words lasts
// longer), with a line taking at least two bars.
import { data } from "./app.js";
import { esc } from "./core.js";

/* The tests that read the letters over the words set `plainChords` (tests only, like plainPlay), which leaves the bars off. */
export const tlView = () => data.settings?.plainChords ? "" : "lines";

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
  sheet?.querySelectorAll(".tlb").forEach(b => b.remove());
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

const lit = { lineOn: null };

/* Each frame while a song plays: w is the stage's "where" ({ b, idx, from, ... }) and seq the page's chord labels. */
export function tlTick(w, seq) {
  const sheet = document.getElementById("sheet");
  if (!tlView() || !w || !sheet) return;
  const on = seq?.[w.from]?.el;
  fadeLines(sheet);
  const line = on?.closest(".pr, .crow");
  if (line && lit.lineOn !== on) {
    lit.lineOn = on;
    sheet.querySelectorAll(".tls.on, .tls.past").forEach(s => s.classList.remove("on", "past"));
    const k = [...line.querySelectorAll(".c[data-ch]")].indexOf(on);
    [...line.querySelectorAll(".tls")].forEach((s, i) => { s.classList.toggle("past", i < k); s.classList.toggle("on", i === k); });
  }
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
/* The song stops or the page goes: the lines come back to full and nothing stays lit. */
export function tlStop() {
  document.querySelectorAll("#sheet > [style*='opacity']").forEach(el => el.style.removeProperty("opacity"));
  lit.lineOn = null;
  document.querySelectorAll("#sheet .tls.on, #sheet .tls.past").forEach(s => s.classList.remove("on", "past"));
}
