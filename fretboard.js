// The fretboard Road (4.82.0): each leg of the Road drawn as a guitar neck, the nut at the top and one fret
// space per stop, then the guitar's body. The layout and the guitars are in core/game.js (`fretLayout`,
// `GUITARS`); road.js decides what each stop says and does.
//
//   base layer     headstock with the guitar's name, board, binding, frets, the body (an SVG)
//   stops          real buttons placed over it: lessons are finger dots, merch boxes single inlays, the
//                  headline show the double inlay (inlays sit under the strings, dots above them)
//   string layer   the strings and their shadows, drawn over the inlays and under the dots
//
// Woods and finishes keep the guitar's own colours in every look; only dots, rings, halos and tags take the
// look's colours (styles.css, "The fretboard Road").
import { FRET_HEAD, fretLayout, guitarFor } from "./core.js";

const W = 390, CX = 195;
const STR = [-90, -54, -18, 18, 54, 90]; /* string x from the middle of the board, low E to high e */

const rect = (x, y, w, h, fill, rx = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const knob = (x, y, c) => `<circle cx="${x}" cy="${y + 2}" r="7" fill="#A87F0C"/><circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;

/* The bodies, our own flat shapes, compressed. Local y: 0 is the last fret, the body runs to FRET_BODY (230).
   `shape` is drawn under the board, `parts` over it, `bridge` is where the strings end. */
/* ---- the bodies (4.83.1): our own shapes with a nod to the classics, flat colour on a darker lip ----
   Each body is a smooth line through points (Catmull-Rom), with sharp corners only where a guitar has them (a horn
   tip, where a cutaway meets the board). Local x is the screen (0 to 390, the board 85 to 305); y 0 is the last
   fret, the board runs on to y 62, the body to about 310. Horns rise above y 0, beside the last frets. */
const shade = (hex, f) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("");
/* points [x, y] or [x, y, 1] for a corner; a closed smooth path through them */
function spline(pts) {
  const n = pts.length, P = i => pts[(i + n) % n];
  let d = `M${P(0)[0]} ${P(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), t = 1 / 6;
    const c1 = p1[2] ? p1 : [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t];
    const c2 = p2[2] ? p2 : [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d + "Z";
}
/* a left half (from the top to the bottom middle) and its mirror */
const mirror = left => [...left, ...left.slice(0, -1).reverse().filter(p => p[0] !== CX).map(p => [W - p[0], p[1], p[2]])];
const pins = y => STR.map(dx => `<circle cx="${CX + dx}" cy="${y}" r="3.4" fill="#efe4c8"/>`).join("");
const hole = (y, r, rings) => rings.map(([dr, c, w]) => `<circle cx="${CX}" cy="${y}" r="${r + dr}" fill="none" stroke="${c}" stroke-width="${w}"/>`).join("") + `<circle cx="${CX}" cy="${y}" r="${r}" fill="#120c09"/>`;
/* a pin bridge with rounded wings, the saddle and the pins */
const pinBridge = (y, c) => `<path d="M84 ${y + 4}C84 ${y - 8} 104 ${y - 10} 122 ${y - 10}H268C286 ${y - 10} 306 ${y - 8} 306 ${y + 4}C306 ${y + 14} 290 ${y + 16} 268 ${y + 16}H122C100 ${y + 16} 84 ${y + 14} 84 ${y + 4}Z" fill="${c}"/>${rect(104, y - 6, 182, 4, "#efe4c8", 2)}${pins(y + 6)}`;
const single = (y, c, pole, slant = 0) => `<g transform="rotate(${slant} ${CX} ${y})">${rect(90, y - 10, 210, 20, shade(c, .72), 10)}${rect(93, y - 7, 204, 14, c, 7)}${STR.map(dx => `<circle cx="${CX + dx}" cy="${y}" r="2.6" fill="${pole}"/>`).join("")}</g>`;
const humbucker = (y, c, frame, pole) => `${rect(92, y - 15, 206, 30, frame, 5)}${rect(100, y - 11, 190, 22, c, 3)}${STR.map(dx => `<circle cx="${CX + dx}" cy="${y - 5}" r="2.4" fill="${pole}"/><circle cx="${CX + dx}" cy="${y + 5}" r="2.4" fill="${pole}"/>`).join("")}`;
const tuneomatic = (y, c) => `${rect(110, y - 5, 170, 10, c, 4)}${STR.map(dx => rect(CX + dx - 4, y - 3, 8, 6, shade(c, .75), 1)).join("")}`;
const knobs = (pts, c) => pts.map(([x, y]) => knob(x, y, c)).join("");
const BODIES = {
  /* The beater: a parlor, small and round, worn through by the pick */
  parlor: g => ({
    d: spline(mirror([[195, -10], [124, -9], [76, 6], [56, 42], [62, 86], [82, 124], [76, 156], [48, 196], [36, 242], [54, 284], [112, 304], [195, 308]])),
    parts: `${hole(126, 32, [[12, g.binding, 3], [7, "#5a3d28", 2]])}<path d="M246 168C276 160 300 176 298 204C296 226 268 232 250 222C232 212 222 176 246 168Z" fill="${shade(g.finish, .8)}"/><ellipse cx="96" cy="270" rx="22" ry="9" fill="${shade(g.finish, 1.18)}" transform="rotate(-18 96 270)"/>${pinBridge(232, "#2a1a12")}`,
    bridge: 238
  }),
  /* The cutaway: a dreadnought's square shoulders, a round cut on the treble side, a pickguard */
  cutaway: g => {
    const left = [[195, -12, 1], [118, -12], [54, -2], [28, 34], [30, 86], [52, 128], [44, 166], [20, 212], [14, 258], [42, 294], [118, 310], [195, 312]];
    const right = left.slice(1, -1).reverse().map(p => [W - p[0], p[1]]).filter(p => p[1] > 120);
    return {
      d: spline([...left, ...right, [352, 98], [362, 64], [354, 36], [336, 26], [320, 34], [310, 52], [305, 70, 1], [305, -12, 1]]),
      edge: g.binding,
      parts: `${hole(128, 33, [[13, "#F5C542", 3], [8, g.binding, 3]])}<path d="M244 156C278 150 312 166 314 196C316 226 290 246 262 240C238 234 228 204 232 180C234 166 238 158 244 156Z" fill="#2a1a12"/>${pinBridge(236, "#2a1a12")}`,
      bridge: 242
    };
  },
  /* The solid-body: an offset double cut, the bass horn the longer, a white guard, three single coils */
  solid: g => ({
    d: spline([[85, 34, 1], [78, 4], [70, -36], [58, -78], [40, -102], [20, -96], [12, -66], [14, -24], [26, 18], [44, 62], [50, 102], [34, 148], [16, 198], [18, 250], [52, 290], [132, 308], [236, 306], [314, 288], [362, 252], [376, 206], [364, 160], [346, 126], [344, 90], [356, 50], [370, 10], [374, -30], [362, -58], [340, -66], [322, -50], [314, -16], [308, 18], [305, 44, 1]]),
    under: `<path d="${spline([[85, 36, 1], [70, 58], [64, 96], [70, 138], [64, 170], [84, 200], [140, 218], [214, 222], [276, 210], [312, 186], [326, 152], [316, 116], [305, 90, 1]])}" fill="#f3efe6" transform="translate(0 3)" opacity=".5"/><path d="${spline([[85, 36, 1], [70, 58], [64, 96], [70, 138], [64, 170], [84, 200], [140, 218], [214, 222], [276, 210], [312, 186], [326, 152], [316, 116], [305, 90, 1]])}" fill="#f6f2e8"/>`,
    parts: `${single(96, "#fbf8f0", "#8a8678")}${single(136, "#fbf8f0", "#8a8678")}${single(178, "#fbf8f0", "#8a8678", -8)}${rect(96, 214, 198, 24, "#c4c8d0", 4)}${STR.map(dx => rect(CX + dx - 6, 218, 12, 10, "#9aa0aa", 2)).join("")}${knobs([[322, 230], [338, 256], [330, 282]], "#f6f2e8")}${rect(300, 196, 22, 6, "#2a2d33", 3, `transform="rotate(-30 311 199)"`)}`,
    bridge: 224
  }),
  /* The hollow-body: two round horns, f-holes, two humbuckers, a burst to the edge */
  hollow: g => ({
    d: spline(mirror([[85, 30, 1], [74, -4], [60, -30], [40, -38], [24, -22], [18, 12], [22, 62], [32, 106], [26, 146], [12, 196], [14, 246], [48, 288], [120, 308], [195, 312]])),
    burst: shade(g.finish, .55),
    edge: g.binding,
    parts: `<path d="M58 96C44 116 70 128 58 150C50 166 66 174 62 196M332 96C346 116 320 128 332 150C340 166 324 174 328 196" fill="none" stroke="#1a0c06" stroke-width="6" stroke-linecap="round"/><circle cx="58" cy="94" r="5" fill="#1a0c06"/><circle cx="62" cy="198" r="5" fill="#1a0c06"/><circle cx="332" cy="94" r="5" fill="#1a0c06"/><circle cx="328" cy="198" r="5" fill="#1a0c06"/>${humbucker(100, "#d9dce2", "#2a2d33", "#8d929c")}${humbucker(150, "#d9dce2", "#2a2d33", "#8d929c")}${tuneomatic(196, "#c4c8d0")}${rect(118, 222, 154, 12, "#c4c8d0", 6)}${knobs([[300, 246], [328, 258], [296, 274], [324, 286]], "#F5C542")}`,
    bridge: 198
  }),
  /* The single-cut: a round bass bout, one horn on the treble side, a carved top, a raised guard */
  single: g => ({
    d: spline([[85, 6, 1], [58, 2], [34, 16], [20, 50], [22, 90], [36, 122], [28, 152], [12, 198], [14, 248], [48, 290], [124, 308], [266, 308], [342, 290], [376, 248], [378, 198], [362, 152], [352, 116], [354, 82], [362, 50], [356, 22], [340, 10], [324, 16], [314, 36], [305, 60, 1]]),
    burst: shade(g.finish, .7),
    edge: g.binding,
    parts: `<path d="M305 70C336 74 356 112 350 152C346 182 326 196 312 186C304 178 304 120 305 70Z" fill="#efe4c8"/><path d="M308 78C334 84 348 116 343 150C340 176 324 186 314 178C308 170 307 120 308 78Z" fill="#2a1a12"/>${humbucker(100, "#efe4c8", "#14100d", "#b8ad90")}${humbucker(150, "#efe4c8", "#14100d", "#b8ad90")}${tuneomatic(196, "#c4c8d0")}${rect(112, 222, 166, 12, "#c4c8d0", 6)}${knobs([[296, 248], [326, 256], [292, 278], [322, 286]], "#F5C542")}<circle cx="54" cy="58" r="11" fill="#efe4c8"/><circle cx="54" cy="58" r="4" fill="#c4c8d0"/>`,
    bridge: 198
  }),
  /* The classical: wide and round, a mosaic rosette, a tie block */
  classical: g => ({
    d: spline(mirror([[195, -12], [118, -11], [62, 4], [42, 42], [46, 88], [68, 128], [62, 162], [32, 206], [24, 252], [50, 290], [120, 308], [195, 312]])),
    parts: `${hole(128, 32, [[15, "#1f8f8a", 5], [10, "#b8402a", 3], [6, "#efe4c8", 2]])}${rect(80, 228, 230, 26, "#2a1a12", 6)}${rect(92, 236, 206, 6, "#efe4c8", 2)}${STR.map(dx => rect(CX + dx - 3, 246, 6, 8, "#efe4c8", 1)).join("")}`,
    bridge: 238
  }),
  /* The headliner: our own, two sharp horns beside the neck, a sharp lower point each side, a swallowtail */
  swallow: g => ({
    d: spline(mirror([[85, 26, 1], [72, -12], [54, -52], [16, -96, 1], [20, -60], [28, -20], [38, 40], [36, 100], [22, 160], [12, 214, 1], [52, 252], [118, 312, 1], [158, 288], [195, 262, 1]])),
    edge: g.binding,
    parts: `${humbucker(100, "#16171B", "#F5C542", "#F5C542")}${humbucker(150, "#16171B", "#F5C542", "#F5C542")}${tuneomatic(196, "#F5C542")}${rect(116, 218, 158, 12, "#F5C542", 6)}${knobs([[300, 236], [322, 256]], "#F5C542")}`,
    bridge: 198
  })
};
let clipN = 0;
/* the body: its lip, the finish, a burst to the edge, the binding, and what sits under the board */
function bodySVG(g, b) {
  const id = `rdb${++clipN}`;
  return `<path d="${b.d}" fill="${shade(g.finish, .62)}" transform="translate(0 8)"/><path d="${b.d}" fill="${g.finish}"/>`
    + (b.burst ? `<clipPath id="${id}"><path d="${b.d}"/></clipPath><path d="${b.d}" fill="none" stroke="${b.burst}" stroke-width="34" stroke-opacity=".55" clip-path="url(#${id})"/><path d="${b.d}" fill="none" stroke="${b.burst}" stroke-width="16" clip-path="url(#${id})"/>` : "")
    + (b.edge ? `<path d="${b.d}" fill="none" stroke="${b.edge}" stroke-width="4"/>` : "") + (b.under || "");
}

/* The headstock above the nut: its shape, six tuners and the guitar's name. */
function headstock(g) {
  const shapes = {
    plain: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    slot: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    book: "M92 90L84 26C84 14 94 8 108 12L195 22L282 12C296 8 306 14 306 26L298 90Z",
    point: "M92 90L80 30L195 4L310 30L298 90Z"
  };
  const tuners = [28, 52, 76].map(y => `<rect x="70" y="${y - 2}" width="30" height="5" rx="2" fill="${g.tuner}" opacity=".7"/><rect x="290" y="${y - 2}" width="30" height="5" rx="2" fill="${g.tuner}" opacity=".7"/><circle cx="68" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="68" cy="${y}" r="9" fill="${g.tuner}"/><circle cx="322" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="322" cy="${y}" r="9" fill="${g.tuner}"/>`).join("");
  const slots = g.head === "slot" ? `${rect(120, 24, 22, 50, "#16171B", 10)}${rect(248, 24, 22, 50, "#16171B", 10)}` : "";
  return `${tuners}<path d="${shapes[g.head] || shapes.plain}" fill="${g.headc}" stroke="${g.binding}" stroke-width="2"/>${slots}<text x="${CX}" y="${g.head === "point" ? 56 : g.head === "book" ? 62 : 54}" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" font-weight="600" fill="${g.ink}">${g.name}</text>`;
}

/* head, body, board, binding, nut, frets and the side dots at the inlays: everything under the stops */
function baseLayer(g, lay) {
  const top = FRET_HEAD, endY = top + lay.neck, y0 = endY;
  const body = (BODIES[g.body] || BODIES.parlor)(g);
  let frets = "", y = top;
  for (const sp of lay.spaces) {
    y += sp.h;
    frets += `${rect(89, y - 3, 212, 6, "#c4c8d0")}${rect(89, y - 3, 212, 2, "#f2f4f7")}${rect(89, y + 1, 212, 2, "#7d828c")}`;
  }
  const dots = lay.spaces.filter(sp => sp.kind !== "dot").map(sp => `<circle cx="303" cy="${top + sp.y}" r="2.6" fill="${sp.stop.state === "done" ? "#2b1d16" : "#9b8f78"}"/>`).join("");
  return `${headstock(g)}<g transform="translate(0 ${y0})">${bodySVG(g, body)}</g>`
    + rect(89, top, 212, lay.neck + 62, g.board) + rect(85, top - 8, 4, lay.neck + 70, g.binding) + rect(301, top - 8, 4, lay.neck + 70, g.binding)
    + rect(85, top - 10, 220, 10, g.binding) + rect(85, top, 220, 3, "#c9b98f")
    + frets + dots + `<g transform="translate(0 ${y0})">${body.parts}</g>`;
}

/* the strings and their shadows, from the nut to the bridge */
function stringLayer(g, lay) {
  const top = FRET_HEAD, bot = top + lay.neck + (BODIES[g.body] || BODIES.parlor)(g).bridge - 4;
  const wd = g.kind === "classical" ? [3.2, 2.8, 2.4, 2, 1.8, 1.6] : g.kind === "electric" ? [3.2, 2.8, 2.4, 2, 1.6, 1.2] : [3.5, 3, 2.5, 2, 1.6, 1.2];
  const col = i => g.kind === "classical" ? (i < 3 ? "#c4c8d0" : "#f3ecdc") : g.kind === "electric" ? "#c4c8d0" : i < 4 ? "#c9a96e" : "#dfe2e8";
  return STR.map((dx, i) => `<line x1="${CX + dx + 3}" y1="${top}" x2="${CX + dx + 3}" y2="${bot}" stroke="#14100d" stroke-opacity=".55" stroke-width="${wd[i]}"/>`).join("")
    + STR.map((dx, i) => `<line x1="${CX + dx}" y1="${top}" x2="${CX + dx}" y2="${bot}" stroke="${col(i)}" stroke-width="${wd[i]}"/>`).join("");
}

/* ---- inlays: one shape, drawn as an empty pocket, set in pearl, or set and lit ---- */
const STAR = c => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 6.5 : 15, a = -Math.PI / 2 + i * Math.PI / 5; return `${(c + r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(" ");
function shape(t, c, cls) {
  const a = `class="${cls}"`;
  if (t === "small") return `<circle ${a} cx="${c}" r="10"/>`;
  if (t === "dot" || t === "abalone") return `<circle ${a} cx="${c}" r="13"/>`;
  if (t === "block") return `<rect ${a} x="${c - 17}" y="-11" width="34" height="22" rx="3"/>`;
  if (t === "split") return `<path ${a} d="M${c - 16} 10H${c - 2}V-6L${c - 16} -10ZM${c + 2} 10H${c + 16}V-10L${c + 2} -6Z"/>`;
  if (t === "trap") return `<path ${a} d="M${c - 16} 11H${c + 16}L${c + 12} -11H${c - 12}Z"/>`;
  return `<polygon ${a} points="${STAR(c)}"/>`;
}
/* state: "pocket" (not reached), "ring" (a merch box you can open), "set" (pearl in), "lit" (the headline show is next) */
export function inlaySVG(type, state, double) {
  const cs = double ? [-34, 34] : [0], vb = double ? "-56 -24 112 48" : "-30 -24 60 48";
  const body = cs.map(c => {
    if (state === "pocket" || state === "ring") return shape(type, c, "rd-pit") + (state === "ring" ? `<circle class="rd-ring dash" cx="${c}" r="25"/>` : "");
    const sheen = `<ellipse class="rd-sheen" cx="${c - 4}" cy="-5" rx="5" ry="2.4" transform="rotate(-30 ${c - 4} -5)"/><ellipse class="rd-sheen2" cx="${c + 5}" cy="5" rx="5.5" ry="2" transform="rotate(-30 ${c + 5} 5)"/>`;
    return `${state === "lit" ? `<circle class="rd-halo" cx="${c}" r="26"/>` : ""}${shape(type, c, "rd-rec")}${shape(type, c, `rd-pearl ${type}`)}${sheen}${state === "lit" ? `<circle class="rd-ring" cx="${c}" r="23"/>` : ""}`;
  }).join("");
  return `<svg class="rd-inlay" viewBox="${vb}" aria-hidden="true">${state === "ring" ? `<circle class="rd-halo" r="30"/>` : ""}${body}</svg>`;
}

/* a lesson: a finger dot on its string */
function dotSVG(state, icon) {
  return `<svg class="rd-dot" viewBox="-30 -30 60 60" aria-hidden="true">${state === "now" ? `<circle class="rd-halo" r="29"/>` : ""}<circle class="rd-lip" cy="6" r="22"/><circle class="rd-body" r="22"/><ellipse class="rd-shine" cx="-7" cy="-11" rx="9" ry="4" transform="rotate(-25 -7 -11)"/></svg><span class="rd-ic">${state === "locked" ? `<i class="rd-pin"></i>` : icon}</span>`;
}

/* One stop, placed over the neck. `o`: cur (the current stop), icon(stop), label(stop), tag(stop). */
function stopHTML(sp, g, lay, o) {
  const s = sp.stop, x = CX + (sp.string >= 0 ? STR[sp.string] : 0), y = FRET_HEAD + sp.y, cur = s === o.cur;
  const left = sp.kind === "inlay" || (sp.kind === "dot" && sp.string < 3);
  const tag = cur ? `<span class="rd-tag ${left ? "l" : "r"}" style="${left ? `right:${((1 - 79 / W) * 100).toFixed(2)}%` : `left:${(311 / W * 100).toFixed(2)}%`}" aria-hidden="true">${o.tag(s)}</span>` : "";
  const inner = sp.kind === "dot" ? dotSVG(s.state, o.icon(s))
    : inlaySVG(g.inlay, s.state === "done" ? "set" : s.state === "now" ? (sp.kind === "inlay" ? "ring" : "lit") : "pocket", sp.kind === "double");
  const cls = `rd-node ${s.kind} ${s.state}${sp.kind === "double" ? " big" : ""}`;
  return `<div class="rd-stop k-${sp.kind}${cur ? " cur" : ""}" style="--x:${x - CX}px;top:${(y / lay.height * 100).toFixed(3)}%">${tag}<button class="${cls}" data-stop="${o.id(s)}" data-inlay="${g.inlay}" style="left:${(x / W * 100).toFixed(3)}%" aria-label="${o.label(s)}">${inner}</button></div>`;
}

/* A leg's neck: base layer, stops, strings. The wrapper keeps the drawing's proportions, so a narrower
   phone scales the whole guitar and the stops stay where they belong. */
export function neckHTML(leg, o) {
  const g = guitarFor(leg.id), lay = fretLayout(leg.stops);
  return `<div class="rd-neck" data-guitar="${leg.id}" style="aspect-ratio:${W}/${lay.height}" role="group" aria-label="${g.name}">
    <svg class="rd-base" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${baseLayer(g, lay)}</svg>
    ${lay.spaces.map(sp => stopHTML(sp, g, lay, o)).join("")}
    <svg class="rd-strings" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${stringLayer(g, lay)}</svg>
    ${leg.done ? `<span class="rd-earned">${g.name} · headlined</span>` : ""}</div>`;
}

/* a guitar on its own (the new-guitar sheet): the headstock, a short neck and the body */
export function guitarSVG(id) {
  const g = guitarFor(id), lay = fretLayout([{ kind: "chord", state: "locked" }, { kind: "chord", state: "locked" }]);
  return `<svg class="rd-gsvg" viewBox="0 0 ${W} ${lay.height}" role="img" aria-label="${g.name}">${baseLayer(g, lay)}${stringLayer(g, lay)}</svg>`;
}
