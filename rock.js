// The streak's four icons (4.16.0), drawn flat in the version 4 style, and the phone's taps that go with them.
// Each one has its own job:
//   guitarIcon(on)        the stat bar: a guitar tipped back mid-song; grey and upright before you've played tonight
//   stageLight()          the streak moment: a stage light that switches on when tonight's play counts
//   hornsIcon()           the streak moment on a milestone night (7, 30, 100 and 365 nights): the horns pop up
//   knobIcon(n, goal)     Your profile: an amp knob whose ring fills toward the next streak goal
//   buzz(name)            a short pattern of taps: Android vibrates; on an iPhone (iOS 18 and later) a hidden
//                         switch gives one tap per beat while it's answering your touch, and nothing otherwise
// The motion is CSS (the "Rock icons" section of styles.css) and stops with Reduce Motion.

/* one straight guitar, drawn upright on x = 16 and tilted as a whole: headstock, neck, upper and lower bout, pickup, bridge */
const GUITAR_BODY = `<g class="ri-g"><rect class="ri-hd" x="13.6" y="0.5" width="4.8" height="4.5" rx="1.6"/><rect class="ri-neck" x="14.7" y="3.5" width="2.6" height="12" rx="1"/>`
  + `<circle class="ri-lip" cx="16.6" cy="24.6" r="6.8"/><circle class="ri-lip" cx="16.6" cy="17.4" r="4.8"/>`
  + `<circle class="ri-bd" cx="16" cy="24" r="6.8"/><circle class="ri-bd" cx="16" cy="16.8" r="4.8"/>`
  + `<rect class="ri-ink" x="13" y="18.6" width="6" height="2.2" rx="1.1"/><rect class="ri-ink" x="13.6" y="25.2" width="4.8" height="1.8" rx=".9"/><circle class="ri-dot" cx="19.8" cy="27" r="1.1"/></g>`;

export const guitarIcon = (on, size = 28) => `<svg class="ri ri-guitar${on ? " on" : ""}" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">`
  + `<g class="ri-tilt">${GUITAR_BODY}</g><g class="ri-waves"><path d="M26 6q3 3 0 6"/><path d="M28.5 4q4 5 0 10"/></g></svg>`;

export const stageLight = (size = 200) => `<svg class="ri ri-light" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">`
  + `<path class="ri-beam" d="M14 14 L2 32 H30 L20 14z"/>`
  + `<rect class="ri-can-lip" x="11.5" y="3.5" width="10" height="12" rx="3"/><rect class="ri-can" x="11" y="3" width="10" height="11" rx="3"/>`
  + `<rect class="ri-lens" x="12.5" y="12" width="7" height="3.5" rx="1.5"/><rect class="ri-can" x="15" y="0" width="2" height="4" rx="1"/></svg>`;

export const hornsIcon = (size = 120) => `<svg class="ri ri-horns" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">`
  + `<rect class="ri-hand" x="8" y="2" width="5" height="16" rx="2.5"/><rect class="ri-hand" x="19" y="4" width="5" height="14" rx="2.5"/>`
  + `<rect class="ri-hand-lip" x="7" y="14" width="18" height="15" rx="7"/><rect class="ri-hand" x="7" y="13" width="18" height="14" rx="7"/>`
  + `<rect class="ri-hand-lip" x="11" y="16" width="10" height="4" rx="2"/></svg>`;

/* the ring runs 270 degrees, from bottom left round to bottom right; the knob's line points at the level */
export function knobIcon(n, goal, size = 64) {
  const k = Math.max(0, Math.min(1, goal ? n / goal : 0)), len = 56.5, a = -135 + 270 * k;
  return `<svg class="ri ri-knob" width="${size}" height="${size}" viewBox="0 0 32 32" style="--k:${k.toFixed(3)};--a:${a.toFixed(1)}deg" aria-hidden="true">`
    + `<path class="ri-track" d="M7.5 24.5 A12 12 0 1 1 24.5 24.5"/>`
    + `<path class="ri-fill" d="M7.5 24.5 A12 12 0 1 1 24.5 24.5" stroke-dasharray="${len}" stroke-dashoffset="${(len * (1 - k)).toFixed(2)}"/>`
    + `<circle class="ri-cap-lip" cx="16.5" cy="17.5" r="8"/><circle class="ri-cap" cx="16" cy="17" r="8"/>`
    + `<g class="ri-dial"><rect class="ri-ink" x="14.9" y="10" width="2.2" height="6" rx="1.1"/></g></svg>`;
}

// ---- taps ----
const PATTERNS = {
  rock: [0, 110, 220],                /* da-da-dum: tapping the streak */
  light: [0, 70, 140, 420],           /* the light flickers on */
  horns: [0, 90, 180, 270, 520, 610]  /* a milestone: a drum fill and two hits */
};
let sw = null;
function iosSwitch() {
  if (sw?.isConnected) return sw;
  sw = document.createElement("label");
  sw.setAttribute("aria-hidden", "true");
  sw.style.cssText = "position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  sw.innerHTML = '<input type="checkbox" switch tabindex="-1">';
  document.body.appendChild(sw);
  return sw;
}
export function buzz(name) {
  const p = PATTERNS[name];
  if (!p) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(p.flatMap((t, i) => i ? [Math.max(10, t - p[i - 1] - 25), 25] : [25])); return; }
    const s = iosSwitch();
    p.forEach(t => t ? setTimeout(() => s.click(), t) : s.click());
  } catch { /* no taps on this phone */ }
}
