// Tabs corner dial: a value you sweep with the thumb, drawn as an arc of
// ticks around the bottom-right corner of the screen. It grows out of the
// corner while you hold, and the value glows as it changes.
//
// Hold a dial button and sweep along the arc: the change is relative to where
// you started, so pressing never jumps the value. A tap without sweeping
// leaves the dial open; sweep anywhere on it, and tap it again to close. A tap
// never changes the value, even one that slips a little.
// Used for the song's speed and, in a set, for picking a song.

const SPAN = 82;          /* degrees of arc the full range covers */
const A0 = 184;           /* arc start in screen degrees (180 = left, 270 = up) */
let open = null;

const svgNS = "http://www.w3.org/2000/svg";
const fmt = n => n.toFixed(1);

// The angle of a point seen from the bottom-right corner: 0 = left, 90 = up.
function angleOf(x, y) {
  return Math.atan2(innerHeight - y, innerWidth - x) * 180 / Math.PI;
}

/**
 * openDial(o)
 *  o.min, o.max, o.step   range of the value (labels: indexes 0..labels.length-1)
 *  o.value                starting value
 *  o.labels               optional names for each step (a set's songs)
 *  o.read(v)              { big, small } text for the middle of the dial
 *  o.input(v)             called as the value changes
 *  o.done(v, changed)     called when the dial closes
 *  o.label                accessible name
 *  o.marks                optional values to label on the scale
 *  o.event                the pointerdown that opened it (to sweep straight away)
 */
export function openDial(o) {
  closeDial();
  const labels = o.labels || null;
  const min = labels ? 0 : o.min, max = labels ? labels.length - 1 : o.max, step = labels ? 1 : o.step;
  const snap = v => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  let value = snap(o.value), start = value, from = null, moved = false, changed = false;
  const W = innerWidth, H = innerHeight, R = Math.min(272, W * 0.72);
  const n = labels ? labels.length : 26;

  const layer = document.createElement("div");
  layer.className = "dial" + (o.cls ? " " + o.cls : "");
  layer.addEventListener("contextmenu", e => e.preventDefault());
  layer.setAttribute("role", "slider");
  layer.setAttribute("aria-label", o.label || "Dial");
  layer.setAttribute("aria-valuemin", min); layer.setAttribute("aria-valuemax", max);
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  /* drawn as a backlit amp meter: a cream face in the corner circle,
     a needle from the corner that swings as you sweep, and the reading and its name
     in a dark window above the face, clear of the thumb. */
  const bw = labels ? Math.min(W - 24, R + 10) : 150, bx = W - 12 - bw, by = H - R - 88;
  svg.innerHTML = `<defs><filter id="dial-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="dial-face" gradientUnits="userSpaceOnUse" cx="${W}" cy="${H}" r="${R}"><stop offset="0" stop-color="#ffecc0"/><stop offset=".6" stop-color="#f3d38f"/><stop offset="1" stop-color="#c99a4f"/></radialGradient></defs>
    <circle class="dial-rim" cx="${W}" cy="${H}" r="${R + 6}"/>
    <circle class="dial-bg" cx="${W}" cy="${H}" r="${R}"/>
    <g class="dial-ticks"></g><g class="dial-labels"></g>
    ${labels || o.marks ? "" : `<text class="dial-end" x="${fmt(W - R + 52)}" y="${H - 10}">SLOWER</text><text class="dial-end" x="${fmt(W - 14)}" y="${fmt(H - R + 62)}" text-anchor="end">FASTER</text>`}
    <line class="dial-needle" x1="${W}" y1="${H}" x2="${W}" y2="${H}"/>
    <circle class="dial-pivot" cx="${W}" cy="${H}" r="30"/>
    <rect class="dial-win" x="${fmt(bx)}" y="${fmt(by)}" width="${fmt(bw)}" height="66" rx="12"/>
    <text class="dial-big" x="${fmt(bx + bw / 2)}" y="${fmt(by + 37)}" text-anchor="middle" filter="url(#dial-glow)"></text>
    <text class="dial-small" x="${fmt(bx + bw / 2)}" y="${fmt(by + 55)}" text-anchor="middle"></text>`;
  layer.appendChild(svg);
  document.body.appendChild(layer);
  requestAnimationFrame(() => layer.classList.add("on"));

  const ticks = svg.querySelector(".dial-ticks"), names = svg.querySelector(".dial-labels");
  const big = svg.querySelector(".dial-big"), small = svg.querySelector(".dial-small");
  const at = (i, r) => { const a = (A0 + SPAN * i / (n - 1)) * Math.PI / 180; return [W + r * Math.cos(a), H + r * Math.sin(a)]; };
  const paint = () => {
    const f = (value - min) / (max - min || 1), lit = Math.round(f * (n - 1));
    let t = "", l = "";
    for (let i = 0; i < n; i++) {
      const major = !labels && !o.marks && i % 5 === 0, cur = i === lit, hot = !labels && i >= n - 4;
      const [x0, y0] = at(i, R - (major ? 44 : 34)), [x1, y1] = at(i, R - 14);
      t += `<line x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(x1)}" y2="${fmt(y1)}" class="${[cur ? "cur" : i < lit ? "lit" : "", major ? "mj" : "", hot ? "hot" : ""].join(" ").trim()}"/>`;
      if (labels) { const [lx, ly] = at(i, R - 58); l += `<text x="${fmt(lx)}" y="${fmt(ly + 4)}" text-anchor="middle" class="${cur ? "cur" : ""}">${o.tick ? o.tick(i) : i + 1}</text>`; }
    }
    /* Marked values (whole minutes for the song length) get a heavy tick and a label. */
    for (const v of o.marks || []) {
      const p = (v - min) / (max - min) * (n - 1), [x0, y0] = at(p, R - 44), [x1, y1] = at(p, R - 14), [lx, ly] = at(p, R - 60);
      t += `<line x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(x1)}" y2="${fmt(y1)}" class="mj"/>`;
      l += `<text x="${fmt(lx)}" y="${fmt(ly + 4)}" text-anchor="middle" class="sc">${o.read(v).big}</text>`;
    }
    /* The needle points at the value itself, between ticks when it falls there. */
    const [nx, ny] = at(f * (n - 1), R - 10), needle = svg.querySelector(".dial-needle");
    needle.setAttribute("x2", fmt(nx)); needle.setAttribute("y2", fmt(ny));
    ticks.innerHTML = t; names.innerHTML = l;
    const r = o.read(value);
    big.textContent = r.big; small.textContent = r.small || "";
    layer.setAttribute("aria-valuenow", value); layer.setAttribute("aria-valuetext", `${r.big}${r.small ? `, ${r.small}` : ""}`);
  };
  paint();

  const set = v => { v = snap(v); if (v === value) return; value = v; changed = true; paint(); o.input?.(value); };
  let x0 = 0, y0 = 0, t0 = 0, far = 0, wasChanged = false;
  const down = (x, y) => { from = angleOf(x, y); start = value; moved = false; x0 = x; y0 = y; t0 = Date.now(); far = 0; wasChanged = changed; };
  /* A press that wobbles a little doesn't change anything: the value only
     moves once the thumb has swept 6 degrees and travelled 12 pixels (near the corner a few pixels is many degrees, so angle alone let a tap
     read as a sweep), and then from where it is. */
  const DEAD = 6, DEAD_PX = 12;
  const move = (x, y) => {
    if (from == null) return;
    far = Math.max(far, Math.hypot(x - x0, y - y0));
    const d = angleOf(x, y) - from;
    if ((Math.abs(d) < DEAD || far < DEAD_PX) && !moved) return;
    moved = true;
    set(start + (d - Math.sign(d) * DEAD) / SPAN * (max - min));
  };
  const finish = () => { closeDial(); o.done?.(value, changed); };
  const onMove = e => { if (from != null) { e.preventDefault(); move(e.clientX, e.clientY); } };
  const onUp = () => {
    if (from == null) return;
    from = null;
    /* A quick touch that hardly moved is a tap, and a tap never changes the
       value: put back what it was when the touch began. */
    if (moved && Date.now() - t0 < 250 && far < 16) {
      moved = false;
      if (value !== start) { value = start; changed = wasChanged; paint(); o.input?.(o.value); }
    }
    if (moved || !o.event) finish();   /* swept: done. A tap that opened it: stay open */
    o.event = null;
  };
  /* A press on the open dial sweeps again; a tap on it without sweeping closes it. */
  layer.addEventListener("pointerdown", e => { e.preventDefault(); down(e.clientX, e.clientY); });
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  if (o.event) down(o.event.clientX, o.event.clientY);
  open = { layer, cleanup: () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); } };
  return { set, close: finish };
}

export function closeDial() {
  if (!open) return;
  open.cleanup();
  const el = open.layer;
  open = null;
  el.classList.remove("on");
  setTimeout(() => el.remove(), 160);
}
export const dialOpen = () => !!open;
