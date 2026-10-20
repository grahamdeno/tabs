// The song bar on a phone held upright (3.19.0).
//
// While the song is paused the whole bar is out, so every control is in sight.
// Play folds it into Play's corner while the song plays: the bar slides away and
// Play stays alone in the corner, to pause. Pausing unfolds the bar again.
// Paused at the top of a song, pull the page down to go back.
// (This replaced the ring controls: hold Play for a ring, the arc and the island.)
import { oneHandMQ } from "./ui.js";

let st = null; /* { o, el, cleanup } for the song page on screen */

export const foldActive = () => oneHandMQ.matches;

/**
 * setupFold(o) on the song page.
 *  o.playing(): bool, o.back: { label, run }
 */
export function setupFold(o) {
  teardownFold();
  const app = document.getElementById("app");
  const el = document.createElement("div");
  el.className = "fp";
  el.id = "fp";
  el.innerHTML = `<div class="fp-pull" aria-hidden="true">↓ <span></span></div>`;
  app.appendChild(el);
  st = { o, el, home: null, cleanup: [] };
  const place = () => apply(true);
  oneHandMQ.addEventListener?.("change", place);
  addEventListener("resize", place);
  st.cleanup.push(() => { oneHandMQ.removeEventListener?.("change", place); removeEventListener("resize", place); });
  apply(true);
  bindPull();
  return { mode: () => apply() };
}

export function teardownFold() {
  if (!st) return;
  st.cleanup.forEach(f => f());
  restore();
  st.el.remove();
  document.body.classList.remove("fold", "one");
  st = null;
}

// Fold the bar into Play's corner (playing) or bring it back (paused).
function apply(force) {
  if (!st) return;
  const one = foldActive();
  document.body.classList.toggle("one", one);
  const on = one && st.o.playing();
  const was = document.body.classList.contains("fold");
  const motion = !force && on !== was && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const before = motion ? foldStart(on) : null;
  document.body.classList.toggle("fold", on);
  const p = document.getElementById("play");
  if (on && p && p.parentElement !== st.el) { st.home = { parent: p.parentElement, next: p.nextSibling }; st.el.appendChild(p); }
  else if (!on) restore();
  if (before) foldEnd(on, before);
}
function restore() {
  const p = document.getElementById("play"), h = st?.home;
  if (p && h?.parent.isConnected) h.parent.insertBefore(p, h.next && h.next.parentElement === h.parent ? h.next : null);
  if (st) st.home = null;
}
/* The motion: going to the corner, a copy of the bar shrinks into Play; coming back, the bar grows out
   of Play. Play itself glides between its two places. */
const barPart = () => {
  const dock = document.querySelector(".app.viewer .dock");
  if (!dock) return null;
  const rows = document.body.classList.contains("nn-on") || document.body.classList.contains("loop-on");
  return rows ? dock.querySelector(".player") : dock.querySelector(".pw");
};
function foldStart(toCorner) {
  const p = document.getElementById("play");
  const out = { play: p?.getBoundingClientRect() };
  const part = barPart();
  if (toCorner && part && p) {
    const r = part.getBoundingClientRect();
    if (r.width) {
      const ghost = part.cloneNode(true);
      ghost.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
      ghost.removeAttribute("id");
      ghost.classList.add("fold-ghost");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: 0, zIndex: 19, pointerEvents: "none",
        transformOrigin: `${out.play.left + out.play.width / 2 - r.left}px ${out.play.top + out.play.height / 2 - r.top}px` });
      document.body.appendChild(ghost);
      const a = ghost.animate([{ scale: "1", opacity: 1 }, { scale: ".12", opacity: 0 }], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)" });
      a.onfinish = a.oncancel = () => ghost.remove();
    }
  }
  return out;
}
function foldEnd(toCorner, before) {
  const p = document.getElementById("play");
  if (p && before.play?.width) {
    const now = p.getBoundingClientRect(), dx = before.play.left - now.left, dy = before.play.top - now.top;
    if (Math.abs(dx) + Math.abs(dy) > 1) p.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0 0" }], { duration: 300, easing: "cubic-bezier(.4,0,.2,1)" });
  }
  if (toCorner) return;
  const part = barPart(), pr = p?.getBoundingClientRect();
  if (!part || !pr) return;
  const r = part.getBoundingClientRect();
  part.style.transformOrigin = `${pr.left + pr.width / 2 - r.left}px ${pr.top + pr.height / 2 - r.top}px`;
  part.animate([{ scale: ".12", opacity: 0 }, { scale: "1", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,0,0,1)" });
}

// ---- Pull down at the top to go back ----
// At the top of a paused song, keep pulling the page down: a glowing "Release for Library" (or the
// set's name) appears; let go past it to go back. Pull less and it springs back.
const PULL = 90;
function bindPull() {
  const tip = st.el.querySelector(".fp-pull"), label = tip.querySelector("span");
  label.textContent = `Release for ${(st.o.back?.label || "Back").replace(/^Back to /, "").replace(/^library$/i, "Library")}`;
  let y0 = null, dy = 0;
  const reset = () => { y0 = null; dy = 0; tip.style.opacity = ""; tip.classList.remove("go"); document.getElementById("app").style.removeProperty("--pull"); };
  const start = e => {
    if (!document.body.classList.contains("one") || st.o.playing() || scrollY > 0 || e.touches.length !== 1) return;
    if (e.target.closest?.(".fp, .dial, .smap, .menu, #layer *")) return;
    y0 = e.touches[0].clientY; dy = 0;
  };
  const move = e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || scrollY > 0) { if (dy < -4) reset(); return; }
    e.preventDefault();
    const pull = Math.min(dy, PULL * 1.6) * 0.5;   /* the page follows at half the finger's pace */
    document.getElementById("app").style.setProperty("--pull", pull + "px");
    tip.style.opacity = Math.min(1, dy / PULL);
    tip.classList.toggle("go", dy >= PULL);
  };
  const end = () => { if (y0 == null) return; const go = dy >= PULL; reset(); if (go) st.o.back?.run(); };
  addEventListener("touchstart", start, { passive: true });
  addEventListener("touchmove", move, { passive: false });
  addEventListener("touchend", end);
  addEventListener("touchcancel", reset);
  st.cleanup.push(() => { removeEventListener("touchstart", start); removeEventListener("touchmove", move); removeEventListener("touchend", end); removeEventListener("touchcancel", reset); document.getElementById("app")?.style.removeProperty("--pull"); });
}
