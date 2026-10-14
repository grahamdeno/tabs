// Tabs ring controls (2.2): the song page's controls for one hand.
//
// On a phone held upright, the song bar becomes a small island in the lower
// right: the speed (hold it for the speed dial), "4 of 9" in a set (hold it
// for the set dial) and Play. Hold Play for a ring of controls around it:
// Back, Favorite, Key (the transpose dial), More and, in a set, Set. Slide to
// one and let go; or let go first and tap one. A tap on Play plays and pauses.
//
// Play follows your hand: while the phone is in your hand it rises from the
// corner to where the thumb rests, on the speed dial's track; after 5 seconds
// still it settles back into the corner and the track fades. "Hand" uses the
// motion sensors (asked for once); without them, a touch on the screen counts.
// Play never moves under a finger or just after a touch.
import { icon, oneHandMQ } from "./ui.js";
import { sweepGain } from "./core.js";

/* Press this long on Play for the ring: iPhone's own long-press time, and a
   little longer while a song plays, so a firm tap to pause stays a pause. */
const HOLD_MS = 500, HOLD_PLAYING_MS = 650;
const REST_MS = 5000;     /* still this long: Play settles into the corner */
const CALM_MS = 500;      /* no moving within this long of a touch */
const SLOTS = [180, 202.5, 225, 247.5, 270];   /* ring angles: left to straight up */
let st = null;            /* the current song page's ring */

// ---- Where Play sits ----
// Lifted: about two-thirds across and a fifth up, where a right thumb rests.
// (Matches body.ring-up #play in the styles: right 34vw, bottom 21vh.)
function spots() {
  const W = innerWidth, H = innerHeight;
  return { W, H, r: Math.hypot(W * 0.34, H * 0.21) };
}

export const ringActive = settings => oneHandMQ.matches && settings.controls !== "bar";

/**
 * setupRing(o) on the song page.
 *  o.settings, o.items: [{ id, label, icon, run(anchor), slot }],
 *  o.grab() / o.letGo(): auto-scroll holds still while the track is swept,
 *  o.where(): the section at the reading point (shown while sweeping),
 *  o.playing(): bool, o.followMode(): "hand" | "touch" | "corner"
 */
export function setupRing(o) {
  teardownRing();
  const app = document.getElementById("app");
  const rc = document.createElement("div");
  rc.className = "rc";
  rc.id = "rc";
  rc.innerHTML = `<svg class="rc-track" aria-hidden="true"><path class="rc-t0"/><path class="rc-t1"/><path class="rc-hit"/></svg>
    <div class="rc-where glow" aria-hidden="true"></div>
    <div class="rc-isl" id="rc-isl"></div>
    <div class="sr-only" role="group" aria-label="Song controls">${o.items.map(it => `<button data-ri="${it.id}">${it.label}</button>`).join("")}</div>`;
  app.appendChild(rc);
  st = { o, rc, up: false, want: false, touching: false, lastTouch: 0, lastActive: 0, timer: 0, home: new Map(), cleanup: [] };
  rc.querySelectorAll("[data-ri]").forEach(b => b.onclick = () => o.items.find(x => x.id === b.dataset.ri)?.run(document.getElementById("play")));

  const place = () => apply(true);
  const mq = () => place();
  oneHandMQ.addEventListener?.("change", mq);
  addEventListener("resize", place);
  st.cleanup.push(() => { oneHandMQ.removeEventListener?.("change", mq); removeEventListener("resize", place); });
  apply(true);
  bindHold();
  bindTrack();
  bindFollow();
  return { refresh: () => paintTrack(), lift: () => wake() };
}

export function teardownRing() {
  if (!st) return;
  clearInterval(st.timer);
  st.cleanup.forEach(f => f());
  closeRing();
  restore();
  st.rc.remove();
  document.body.classList.remove("ring", "ring-up");
  st = null;
}

// Move Play and the island's buttons in (ring) or back to the bar.
function apply(force) {
  if (!st) return;
  const on = ringActive(st.o.settings);
  document.body.classList.toggle("ring", on);
  const isl = st.rc.querySelector(".rc-isl");
  const parts = ["dialbtn", "setdial", "play"].map(id => document.getElementById(id)).filter(Boolean);
  if (on) {
    for (const el of parts) if (el.parentElement !== isl && el.parentElement !== st.rc) {
      st.home.set(el, { parent: el.parentElement, next: el.nextSibling });
      (el.id === "play" ? st.rc : isl).appendChild(el);
    }
    position(force);
  } else restore();
}
function restore() {
  for (const [el, h] of st.home) if (h.parent.isConnected) h.parent.insertBefore(el, h.next && h.next.parentElement === h.parent ? h.next : null);
  st.home.clear();
}

// Put Play in the corner or lifted (the places are in the styles), and draw
// the track through the lifted spot.
function position() {
  if (!document.body.classList.contains("ring")) return;
  document.body.classList.toggle("ring-up", st.up);
  paintTrack();
}

// The track: an arc around the corner through Play's lifted spot. Its lit
// part shows your place in the song (bottom end the start, top end the end).
// The arc stops short of the bottom edge, where iPhone's home bar swipe lives
// (the safe area plus a margin), and of the right edge.
let safeB = null;
function safeBottom() {
  if (safeB == null) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:1px;visibility:hidden";
    document.body.appendChild(probe); safeB = probe.offsetHeight || 0; probe.remove();
  }
  return safeB;
}
function arcRange() {
  const { r } = spots();
  const a0 = 180 + Math.asin(Math.min(0.9, (safeBottom() + 30) / r)) * 180 / Math.PI;
  return { a0, a1: 264, span: 264 - a0 };
}
const place = () => { const max = document.documentElement.scrollHeight - innerHeight; return max > 0 ? scrollY / max : 0; };
function paintTrack() {
  if (!st) return;
  const { W, H, r } = spots();
  const svg = st.rc.querySelector(".rc-track");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  const pt = a => `${(W + r * Math.cos(a * Math.PI / 180)).toFixed(1)} ${(H + r * Math.sin(a * Math.PI / 180)).toFixed(1)}`;
  const f = Math.min(1, Math.max(0, place()));
  const { a0, a1, span } = arcRange();
  const arc = `M ${pt(a0)} A ${r} ${r} 0 0 1 ${pt(a1)}`;
  svg.querySelector(".rc-t0").setAttribute("d", arc);
  svg.querySelector(".rc-hit").setAttribute("d", arc);
  svg.querySelector(".rc-t1").setAttribute("d", `M ${pt(a0)} A ${r} ${r} 0 0 1 ${pt(a0 + span * Math.max(f, 0.004))}`);
}

// ---- Sweep the track to move through the song ----
// Up the arc moves forward, down it moves back. Auto-scroll holds still under
// the thumb and carries on from the new place when you let go.
//
// Whole song (the default): one full sweep, end to end, covers the whole
// song, so a long song is one sweep from top to bottom. To keep long songs
// easy to land in, the arc is speed-sensitive, like a trackpad: a slow sweep
// moves finely (about a screen per arc), a quick one covers ground. And a
// sweep that runs from one end of the arc to the other always lands on the
// song's end or start. While sweeping, the section you're in glows by Play.
// One screen (the 2.3 behavior): the whole arc is about one screen.
const angleOf = (x, y) => 180 + Math.atan2(innerHeight - y, innerWidth - x) * 180 / Math.PI;  /* 180 left, 270 up */
function bindTrack() {
  const hit = st.rc.querySelector(".rc-hit");
  const where = st.rc.querySelector(".rc-where");
  let from = null, last = 0, lastT = 0, y = 0, frame = 0;
  hit.addEventListener("touchstart", e => e.preventDefault(), { passive: false });  /* the page doesn't scroll too */
  hit.addEventListener("pointerdown", e => {
    e.preventDefault();
    from = last = angleOf(e.clientX, e.clientY); lastT = e.timeStamp || performance.now(); y = scrollY;
    document.body.classList.add("ring-sweep");
    st.o.grab?.();
    showWhere();
  });
  const showWhere = () => { if (where) where.textContent = st.o.where?.() || ""; };
  const move = e => {
    if (from == null) return;
    e.preventDefault();
    const a = angleOf(e.clientX, e.clientY), t = e.timeStamp || performance.now();
    const { a0, span } = arcRange(), max = document.documentElement.scrollHeight - innerHeight;
    const d = a - last, dt = Math.max(1, t - lastT);
    last = a; lastT = t;
    const whole = st.o.settings.arcSweep !== "screen";
    const fine = innerHeight / span;
    const gain = whole ? sweepGain({ speed: Math.abs(d) / dt, fine, coarse: max / span }) : fine;
    y = Math.min(max, Math.max(0, y + d * gain));
    /* End to end in one sweep: all the way. */
    if (whole) {
      const f0 = (from - a0) / span, f = (a - a0) / span;
      if (f0 <= 0.2 && f >= 0.92) y = max;
      if (f0 >= 0.8 && f <= 0.08) y = 0;
    }
    window.scrollTo(0, y);
    showWhere();
    wake();
  };
  const up = () => {
    if (from == null) return;
    from = null;
    document.body.classList.remove("ring-sweep");
    st.o.letGo?.();
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; paintTrack(); }); };
  addEventListener("pointermove", move, { passive: false });
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  addEventListener("scroll", onScroll, { passive: true });
  st.cleanup.push(() => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); removeEventListener("scroll", onScroll); });
}

// ---- Hold Play for the ring ----
let ringEl = null;
function bindHold() {
  const p = document.getElementById("play");
  if (!p) return;
  let timer = 0, startX = 0, startY = 0, opened = false;
  const down = e => {
    if (!document.body.classList.contains("ring")) return;
    opened = false; startX = e.clientX; startY = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => { opened = true; openRing(p, true); }, st.o.playing() ? HOLD_PLAYING_MS : HOLD_MS);
  };
  const move = e => {
    if (!ringEl) { if (Math.hypot(e.clientX - startX, e.clientY - startY) > 12) clearTimeout(timer); return; }
    if (ringEl.dataset.live === "1") pick(e.clientX, e.clientY);
  };
  const up = () => {
    clearTimeout(timer);
    if (!ringEl || ringEl.dataset.live !== "1") return;
    ringEl.dataset.live = "0";
    const sel = ringEl.querySelector(".ri.on");
    if (sel) { const it = st.o.items.find(x => x.id === sel.dataset.r); closeRing(); it?.run(p); }
    /* Let go without choosing: the ring stays open to tap. */
  };
  /* After a hold, the click that follows isn't a play/pause. */
  const click = e => { if (opened) { e.stopImmediatePropagation(); e.preventDefault(); opened = false; } };
  p.addEventListener("pointerdown", down);
  p.addEventListener("click", click, true);
  p.addEventListener("contextmenu", e => { if (document.body.classList.contains("ring")) e.preventDefault(); });
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  st.cleanup.push(() => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up); });
}

function openRing(p, live) {
  closeRing();
  const r = p.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = 128;
  const el = document.createElement("div");
  el.className = "ringx";
  el.dataset.live = live ? "1" : "0";
  el.innerHTML = `<div class="ring-bg" style="left:${cx}px;top:${cy}px"></div>
    ${st.o.items.map(it => { const a = SLOTS[it.slot] * Math.PI / 180;
      return `<button class="ri" data-r="${it.id}" aria-label="${it.label}" style="left:${(cx + R * Math.cos(a)).toFixed(1)}px;top:${(cy + R * Math.sin(a)).toFixed(1)}px">${it.icon}</button>`; }).join("")}
    <div class="ring-name glow" style="left:${cx}px;top:${(cy - R - 46).toFixed(1)}px"></div>`;
  document.body.appendChild(el);
  ringEl = el;
  requestAnimationFrame(() => el.classList.add("on"));
  el.querySelectorAll(".ri").forEach(b => b.onclick = ev => { ev.stopPropagation(); const it = st.o.items.find(x => x.id === b.dataset.r); closeRing(); it?.run(p); });
  el.addEventListener("click", e => { if (e.target === el || e.target.classList.contains("ring-bg")) closeRing(); });
  el.dataset.cx = cx; el.dataset.cy = cy;
}
// The item in the direction of the thumb, once it's moved off Play.
function pick(x, y) {
  const cx = +ringEl.dataset.cx, cy = +ringEl.dataset.cy, d = Math.hypot(x - cx, y - cy);
  let best = null;
  if (d > 44) {
    let ang = Math.atan2(y - cy, x - cx) * 180 / Math.PI; if (ang < 0) ang += 360;
    let gap = 999;
    for (const it of st.o.items) { const g = Math.abs(SLOTS[it.slot] - ang); if (g < gap) { gap = g; best = it; } }
    if (gap > 30) best = null;
  }
  ringEl.querySelectorAll(".ri").forEach(b => b.classList.toggle("on", !!best && b.dataset.r === best.id));
  ringEl.querySelector(".ring-name").textContent = best ? best.label : "";
}
export function closeRing() {
  if (!ringEl) return;
  const el = ringEl;
  ringEl = null;
  el.classList.remove("on");
  setTimeout(() => el.remove(), 150);
}

// ---- Play follows your hand ----
function bindFollow() {
  const touchOn = () => { st.touching = true; st.lastTouch = Date.now(); if (st.o.followMode() !== "corner") wake(); };
  const touchOff = () => { st.touching = false; st.lastTouch = Date.now(); };
  addEventListener("pointerdown", touchOn, true);
  addEventListener("pointerup", touchOff, true);
  addEventListener("pointercancel", touchOff, true);
  const onScroll = () => { if (st.o.followMode() === "touch" && !st.o.playing()) wake(); };
  addEventListener("scroll", onScroll, { passive: true });
  /* Motion: a hand is never still; a stand is (strumming shakes it a little,
     so short jolts don't count, only a turn or a steady change in tilt). */
  let base = null, moving = 0;
  const onMotion = e => {
    if (st.o.followMode() !== "hand") return;
    const g = e.accelerationIncludingGravity, rr = e.rotationRate;
    if (!g || g.x == null) return;
    const v = [g.x, g.y, g.z];
    base = base ? base.map((b, i) => b * 0.95 + v[i] * 0.05) : v;
    const tilt = Math.hypot(v[0] - base[0], v[1] - base[1], v[2] - base[2]);
    const turn = rr ? Math.hypot(rr.alpha || 0, rr.beta || 0, rr.gamma || 0) : 0;
    const strong = st.o.playing();
    const active = strong ? (turn > 35 || tilt > 1.2) : (turn > 9 || tilt > 0.35);
    moving = active ? moving + 1 : Math.max(0, moving - 1);
    if (moving >= 3) { moving = 0; wake(); }
  };
  addEventListener("devicemotion", onMotion);
  st.cleanup.push(() => {
    removeEventListener("pointerdown", touchOn, true); removeEventListener("pointerup", touchOff, true); removeEventListener("pointercancel", touchOff, true);
    removeEventListener("scroll", onScroll); removeEventListener("devicemotion", onMotion);
  });
  st.timer = setInterval(tick, 250);
}
function wake() { if (!st) return; st.lastActive = Date.now(); }
function tick() {
  if (!st || !document.body.classList.contains("ring")) return;
  const now = Date.now(), mode = st.o.followMode();
  const want = mode !== "corner" && now - st.lastActive < REST_MS;
  if (want === st.up) return;
  /* Never move under a finger, or right after a touch, or with the ring open. */
  if (st.touching || now - st.lastTouch < CALM_MS || ringEl) return;
  st.up = want;
  position();
}

// Ask for the motion sensors (iPhone asks once, from a tap). Resolves true when allowed.
export async function askMotion() {
  const D = window.DeviceMotionEvent;
  if (!D) return false;
  if (typeof D.requestPermission !== "function") return true;
  try { return (await D.requestPermission()) === "granted"; } catch { return false; }
}
export const ringIcon = name => icon(name);
