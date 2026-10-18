// A pull-up drawer for Tonight's Library. It follows the finger, springs to the
// nearer end (or the way a flick points), and hands over to the list inside:
// the list scrolls when the drawer is open, and a pull down from the top of the
// list brings the drawer down with it.
//   makeDrawer({ root, head, body, sizer, scrim, onState }) -> { open, close, isOpen, remeasure }
//   root   the fixed element that moves; sizer: an element as tall as the closed peek
//   head   the handle and title strip (always draggable); body: the scrolling list
export function makeDrawer({ root, head, body, sizer, scrim, onState = () => {} }) {
  let closedY = 0, y = 0, openState = false, drag = null, anim = 0;
  const calm = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const measure = () => { closedY = Math.max(0, root.offsetHeight - sizer.offsetHeight); };
  const paint = (v, ease) => {
    y = v;
    root.style.transition = ease && !calm() ? "transform .32s cubic-bezier(.2,.8,.2,1)" : "none";
    root.style.transform = `translate3d(-50%, ${v}px, 0)`;
    const f = closedY ? 1 - v / closedY : 0, p = Math.max(0, Math.min(1, f));
    /* the contents stay hidden while shut and rise into view as the drawer opens */
    body.style.transition = ease && !calm() ? "opacity .32s ease, transform .32s cubic-bezier(.2,.8,.2,1)" : "none";
    body.style.opacity = String(Math.max(0, Math.min(1, (p - 0.12) / 0.55)));
    body.style.transform = `translate3d(0, ${Math.round((1 - p) * 28)}px, 0)`;
    body.style.pointerEvents = p > 0.5 ? "" : "none";
    body.inert = p < 0.02;
    if (scrim) { scrim.style.transition = root.style.transition.replace("transform", "opacity"); scrim.style.opacity = String(Math.max(0, Math.min(1, f)) * 0.55); scrim.style.pointerEvents = f > 0.02 ? "auto" : "none"; }
  };
  const settle = open => {
    openState = open; measure(); paint(open ? 0 : closedY, true);
    root.dataset.state = open ? "open" : "closed";
    if (!open) body.scrollTop = 0;
    body.style.overflowY = open ? "auto" : "hidden";
    onState(open);
  };
  const rubber = (v) => v < 0 ? v / 4 : v > closedY ? closedY + (v - closedY) / 4 : v;
  const start = (e, fromHead) => {
    const t = e.touches[0];
    /* a swipe up from the very bottom edge is the phone's (home, app switcher): the drawer stays put */
    const bottom = Math.max(innerHeight, document.body.getBoundingClientRect().height);
    if (t.clientY > bottom - 36) { drag = { dead: true }; return; }
    drag = { y0: t.clientY, startY: y, last: t.clientY, t: performance.now(), v: 0, on: false, dead: false, fromHead, top: body.scrollTop <= 0 };
  };
  const move = e => {
    if (!drag || drag.dead) return;
    const t = e.touches[0], dy = t.clientY - drag.y0;
    if (!drag.on) {
      if (Math.abs(dy) < 6) return;
      /* closed: any vertical drag is the drawer's. open: a pull down from the top of the list, or from the head. */
      const mine = !openState || drag.fromHead || (drag.top && dy > 0);
      if (!mine) { drag.dead = true; return; }
      drag.on = true; drag.y0 = t.clientY; drag.startY = y; cancelAnimationFrame(anim);
    }
    const now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.v = 0.8 * drag.v + 0.2 * ((t.clientY - drag.last) / dt);
    drag.last = t.clientY; drag.t = now;
    paint(rubber(drag.startY + (t.clientY - drag.y0)));
    if (e.cancelable) e.preventDefault();
  };
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.on) return;
    if (Math.abs(d.v) > 0.4) settle(d.v < 0);
    else settle(y < closedY / 2);
  };
  root.addEventListener("touchstart", e => { if (e.target instanceof Element && e.target.closest(".dock")) return; start(e, !!e.target.closest?.("[data-grab]")); }, { passive: true });
  root.addEventListener("touchmove", move, { passive: false });
  root.addEventListener("touchend", end, { passive: true });
  /* the system took the touch (app switcher, call, notification): go back to where the drawer was */
  const abort = () => { if (!drag) return; const was = drag.on; drag = null; if (was) settle(openState); };
  root.addEventListener("touchcancel", abort, { passive: true });
  document.addEventListener("visibilitychange", abort);
  window.addEventListener("pagehide", abort);
  /* taps: the handle toggles; a tap on the closed peek opens it */
  root.addEventListener("click", e => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest("[data-grab]")) return settle(!openState);
    if (!openState && !e.target.closest("a,button,input")) settle(true);
  });
  scrim?.addEventListener("click", () => settle(false));
  const key = e => { if (e.key === "Escape" && openState) settle(false); };
  document.addEventListener("keydown", key);
  const resize = () => { measure(); paint(openState ? 0 : closedY); };
  window.addEventListener("resize", resize);
  const off = new MutationObserver(() => { if (!document.contains(root)) { document.removeEventListener("keydown", key); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", abort); window.removeEventListener("pagehide", abort); off.disconnect(); } });
  off.observe(document.body, { childList: true, subtree: true });
  measure(); settle(false);
  return { open: () => settle(true), close: () => settle(false), isOpen: () => openState, remeasure: resize };
}
