// The song bar on a phone held upright (3.19.0).
//
// 5.14.0 (Graham, 2026-11-27): one bar that never moves. It used to fold into Play's corner while a song played;
// now it stays where it is, playing or paused, in a Gig or not, and only Play's face changes. What's left here:
// paused at the top of a song, pull the page down to go back.
// (The fold replaced the ring controls in 3.19.0: hold Play for a ring, the arc and the island.)
import { oneHandMQ } from "./ui.js";

let st = null; /* { o, el, cleanup } for the song page on screen */

export const foldActive = () => oneHandMQ.matches;

/**
 * setupFold(o) on the song page.
 *  o.playing(): bool, o.back: { label, run },
 *  o.nav(): { html, label, run }: the one button beside Play while folded (3.20.0)
 */
export function setupFold(o) {
  teardownFold();
  const app = document.getElementById("app");
  const el = document.createElement("div");
  el.className = "fp";
  el.id = "fp";
  el.innerHTML = `<div class="fp-pull" aria-hidden="true">↓ <span></span></div><button class="fp-nav" id="fp-nav"></button>${o.band ? `<button class="fp-band" id="fp-band" aria-label="The beat: Off, Bass drum or Metronome, and how loud" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/></svg></button>` : ""}`;
  el.querySelector(".fp-nav").onclick = () => o.nav?.().run();
  el.querySelector(".fp-band")?.addEventListener("click", () => o.band()); /* 4.43.0: the band while the song plays */
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

// 5.14.0: no fold. The bar stays out; only the one-hand layout class is kept.
function apply() {
  if (!st) return;
  const one = foldActive();
  document.body.classList.toggle("one", one);
  document.body.classList.remove("fold");
  restore();
  /* while a song plays on a phone (a Gig covers these): the next song in a set (3.20.0) and the beat (4.43.0), above the bar */
  const live = one && st.o.playing();
  const nav = st.el.querySelector(".fp-nav"), n = live && st.o.nav?.();
  if (nav) { nav.hidden = !n; if (n) { nav.innerHTML = n.html; nav.setAttribute("aria-label", n.label); } }
  const band = st.el.querySelector(".fp-band");
  if (band) band.hidden = !live;
}
function restore() {
  const p = document.getElementById("play"), h = st?.home;
  if (p && h?.parent.isConnected) h.parent.insertBefore(p, h.next && h.next.parentElement === h.parent ? h.next : null);
  if (st) st.home = null;
}

// ---- Pull down at the top to go back ----
// At the top of a paused song, keep pulling the page down: a glowing "Release for Library" (or the
// set's name) appears; let go past it to go back. Pull less and it springs back.
const PULL = 90;
function bindPull() {
  const tip = st.el.querySelector(".fp-pull"), label = tip.querySelector("span");
  label.textContent = `Release for ${(st.o.back?.label || "Back").replace(/^Back to /, "").replace(/^the /, "")}`;
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
