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
import { fretLayout, guitarFor, neckStops, FRET_BODY, VERSION, ROAD, roadPlace } from "./core.js";
import PICS from "./art/guitars/pics.js";
import { buildPic } from "./buildart.js";

const W = 390, CX = 195;
const STR = [-90, -54, -18, 18, 54, 90]; /* string x from the middle of the board, low E to high e */

const rect = (x, y, w, h, fill, rx = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;

/* The bodies, our own flat shapes, compressed. Local y: 0 is the last fret, the body runs to FRET_BODY (230).
   `shape` is drawn under the board, `parts` over it, `bridge` is where the strings end. */
/* ---- the bodies (4.83.1, drawn again in 4.84.0): our own shapes with a nod to the classics ----
   Each body is a smooth line through points (Catmull-Rom), sharp only where a guitar is (a horn tip, where a cutaway
   meets the board). Flat colour in the house style: a darker lip under it like the buttons, a light rim along the
   top-left edge where the lacquer catches the light, and a burst in hard steps. Local x is the screen (0 to 390, the
   board 85 to 305); y 0 is the last fret, the board runs on to y 62, the body to about 312. */
const shade = (hex, f) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("");
const mix = (hex, to, f) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f) + parseInt(to.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
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
const shift = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy, p[2]]);
/* a shape pulled toward a centre: the steps of a burst */
const inset = (pts, k, cx = CX, cy = 170) => pts.map(p => [+(cx + (p[0] - cx) * k).toFixed(1), +(cy + (p[1] - cy) * k).toFixed(1), p[2]]);

/* -- the hardware kit: one hand for every guitar -- */
const CHROME = "#cdd2da", CHROME_HI = "#f1f3f6", CHROME_LO = "#8e949e";
const chrome = (x, y, w, h, rx = 3) => `${rect(x, y + 2, w, h, CHROME_LO, rx)}${rect(x, y, w, h, CHROME, rx)}${rect(x + rx, y + 1, w - 2 * rx, Math.max(1.5, h * .22), CHROME_HI, 1)}`;
const screw = (x, y, c = CHROME_LO) => `<circle cx="${x}" cy="${y}" r="2.2" fill="${c}"/>`;
/* a top-hat knob: lip, cap, a lighter top and the pointer */
const knob = (x, y, c, a = -40) => `<circle cx="${x}" cy="${y + 3}" r="10" fill="${shade(c, .6)}"/><circle cx="${x}" cy="${y}" r="10" fill="${c}"/><circle cx="${x}" cy="${y - 1}" r="6.5" fill="${mix(c, "#ffffff", .35)}"/><line x1="${x}" y1="${y - 1}" x2="${(x + 6 * Math.cos(a * Math.PI / 180)).toFixed(1)}" y2="${(y - 1 + 6 * Math.sin(a * Math.PI / 180)).toFixed(1)}" stroke="${shade(c, .45)}" stroke-width="2" stroke-linecap="round"/>`;
const knobs = (pts, c) => pts.map(([x, y], i) => knob(x, y, c, -60 + i * 35)).join("");
const strapButton = y => `<circle cx="${CX}" cy="${y + 2}" r="6" fill="${CHROME_LO}"/><circle cx="${CX}" cy="${y}" r="6" fill="${CHROME}"/><circle cx="${CX - 1.5}" cy="${y - 1.5}" r="2" fill="${CHROME_HI}"/>`;
const poles = (y, c, r = 2.6) => STR.map(dx => `<circle cx="${CX + dx}" cy="${y}" r="${r}" fill="${c}"/>`).join("");
/* a single coil: a cover with round ends and its six poles */
const singleCoil = (y, c, slant = 0) => `<g transform="rotate(${slant} ${CX} ${y})">${rect(88, y - 9, 214, 20, shade(c, .7), 10)}${rect(88, y - 10, 214, 19, c, 9.5)}${rect(98, y - 8, 194, 3, mix(c, "#ffffff", .6), 1.5)}${poles(y, "#8e949e")}</g>`;
/* a humbucker: a ring, two bobbins (or a chrome cover), two rows of poles */
function humbucker(y, ring, cover) {
  const body = cover === "chrome" ? chrome(98, y - 12, 194, 24, 3) + poles(y - 5, CHROME_LO, 2.2) + poles(y + 5, CHROME_LO, 2.2)
    : `${rect(98, y - 12, 194, 11, cover, 3)}${rect(98, y + 1, 194, 11, cover, 3)}${rect(102, y - 11, 186, 2.5, mix(cover, "#ffffff", .45), 1)}${poles(y - 6.5, CHROME, 2.4)}${poles(y + 6.5, CHROME_LO, 2.4)}`;
  return `${rect(90, y - 16, 210, 34, shade(ring, .7), 6)}${rect(90, y - 17, 210, 33, ring, 6)}${screw(95, y - 12, mix(ring, "#ffffff", .4))}${screw(295, y - 12, mix(ring, "#ffffff", .4))}${screw(95, y + 11, mix(ring, "#ffffff", .4))}${screw(295, y + 11, mix(ring, "#ffffff", .4))}${body}`;
}
/* a bridge you can set the strings on, and the tailpiece behind it */
const tuneomatic = y => `${chrome(112, y - 6, 166, 12, 5)}${STR.map(dx => `${rect(CX + dx - 5, y - 4, 10, 8, CHROME_LO, 2)}${rect(CX + dx - 4, y - 4, 8, 3, CHROME_HI, 1)}`).join("")}`;
const stopbar = y => `${chrome(118, y - 7, 154, 14, 7)}<circle cx="118" cy="${y}" r="7" fill="${CHROME}"/><circle cx="272" cy="${y}" r="7" fill="${CHROME}"/>${screw(118, y)}${screw(272, y)}`;
/* the offset guitar's bridge: a plate, six bent saddles, the arm */
const tremolo = y => `${chrome(94, y - 4, 202, 30, 5)}${STR.map(dx => `${rect(CX + dx - 7, y - 1, 14, 14, CHROME_LO, 3)}${rect(CX + dx - 6, y - 1, 12, 4, CHROME_HI, 1)}`).join("")}`;
/* acoustic: a pin bridge with wings, its bone saddle and pins */
const pinBridge = (y, c) => {
  const d = `M80 ${y + 4}C80 ${y - 8} 102 ${y - 12} 124 ${y - 10}C150 ${y - 8} 240 ${y - 8} 266 ${y - 10}C288 ${y - 12} 310 ${y - 8} 310 ${y + 4}C310 ${y + 16} 290 ${y + 20} 266 ${y + 18}C240 ${y + 16} 150 ${y + 16} 124 ${y + 18}C100 ${y + 20} 80 ${y + 16} 80 ${y + 4}Z`;
  return `<path d="${d}" fill="${shade(c, .6)}" transform="translate(0 3)"/><path d="${d}" fill="${c}"/>${rect(100, y - 6, 190, 5, "#f1e8d2", 2.5)}${STR.map(dx => `<circle cx="${CX + dx}" cy="${y + 7}" r="4" fill="#f1e8d2"/><circle cx="${CX + dx}" cy="${y + 7}" r="1.6" fill="${shade(c, .5)}"/>`).join("")}`;
};
/* a soundhole: the rosette rings (a mosaic ring is a dashed one on its own colour), the hole, the edge of the top
   catching light inside it */
function soundhole(y, r, rosette, top) {
  const rings = rosette.map(([dr, c, w, dash, under]) => `${under ? `<circle cx="${CX}" cy="${y}" r="${r + dr}" fill="none" stroke="${under}" stroke-width="${w}"/>` : ""}<circle cx="${CX}" cy="${y}" r="${r + dr}" fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`).join("");
  return `${rings}<circle cx="${CX}" cy="${y}" r="${r}" fill="#120c09"/><path d="M${CX - r + 4} ${y + 4}A${r - 4} ${r - 4} 0 0 0 ${CX + r - 4} ${y + 4}" fill="none" stroke="${shade(top, .7)}" stroke-width="3" stroke-linecap="round"/>`;
}
/* an f-hole: two round ends joined by a slot that bends like an s, and the two nicks */
function fhole(x, y, flip, c) {
  const s = flip ? -1 : 1, X = v => (x + s * v).toFixed(1);
  return `<path d="M${X(8)} ${y - 44}C${X(-6)} ${y - 30} ${X(10)} ${y - 10} ${X(0)} ${y + 8}C${X(-8)} ${y + 22} ${X(6)} ${y + 36} ${X(-4)} ${y + 46}" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><circle cx="${X(9)}" cy="${y - 46}" r="5.5" fill="${c}"/><circle cx="${X(-5)}" cy="${y + 48}" r="5.5" fill="${c}"/>${rect(+X(-6) - 4, y - 2, 12, 3, c, 1.5)}`;
}
/* a pickguard: its lip, the guard, the screws */
const guard = (pts, c, screws = []) => `<path d="${spline(pts)}" fill="${shade(c, .72)}" transform="translate(0 3)"/><path d="${spline(pts)}" fill="${c}"/>${screws.map(([x, y]) => screw(x, y, shade(c, .6))).join("")}`;
/* tortoiseshell: a dark guard with lighter flecks */
const tortoise = (pts, flecks) => `<path d="${spline(pts)}" fill="#1a0f0a" transform="translate(0 3)"/><path d="${spline(pts)}" fill="#3a1d10"/>${flecks.map(([x, y, rx, ry, a]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#7a3a16" opacity=".8" transform="rotate(${a} ${x} ${y})"/>`).join("")}`;

const BODIES = {
  /* The beater: a parlor, small and round, the top worn pale where the pick has been */
  parlor: g => ({
    pts: mirror([[195, -10], [124, -9], [76, 6], [56, 42], [62, 86], [82, 124], [76, 156], [48, 196], [36, 242], [54, 284], [112, 304], [195, 308]]),
    parts: `<path d="${spline([[234, 168], [262, 158], [290, 172], [298, 200], [286, 222], [258, 226], [238, 210], [228, 188]])}" fill="${mix(g.finish, "#e8d6b0", .35)}"/>${soundhole(126, 32, [[14, "#5a3d28", 2], [9, "#efe4c8", 5, "3 3", "#5a3d28"], [4, "#5a3d28", 2]], g.finish)}<path d="${spline([[70, 262], [96, 252], [118, 262], [104, 276], [78, 278]])}" fill="${mix(g.finish, "#ffffff", .18)}"/>${pinBridge(232, "#2a1a12")}${strapButton(300)}`,
    bridge: 239
  }),
  /* The cutaway: a dreadnought's square shoulders, a round cut on the treble side, a tortoise guard */
  cutaway: g => {
    const left = [[195, -12, 1], [118, -12], [54, -2], [28, 34], [30, 86], [52, 128], [44, 166], [20, 212], [14, 258], [42, 294], [118, 310], [195, 312]];
    const right = left.slice(1, -1).reverse().map(p => [W - p[0], p[1]]).filter(p => p[1] > 120);
    return {
      pts: [...left, ...right, [352, 98], [362, 64], [354, 36], [336, 26], [320, 34], [310, 52], [305, 70, 1], [305, -12, 1]],
      edge: g.binding,
      parts: `${tortoise([[236, 160], [272, 150], [306, 162], [318, 192], [306, 226], [276, 242], [248, 236], [232, 210], [228, 180]], [[262, 178, 8, 4, 30], [288, 200, 10, 4, -20], [258, 222, 7, 3, 10], [296, 176, 5, 3, 60]])}${soundhole(128, 33, [[16, g.binding, 2], [11, "#F5C542", 5, "4 2", "#2a1a12"], [5, g.binding, 2]], g.finish)}${pinBridge(236, "#2a1a12")}${strapButton(304)}`,
      bridge: 243
    };
  },
  /* The solid-body: an offset double cut (the bass horn the longer), a white guard, three single coils, a vibrato */
  solid: g => ({
    pts: [[85, 34, 1], [80, 10], [74, -30], [64, -72], [46, -98], [26, -100], [12, -80], [10, -46], [16, -8], [30, 30], [44, 64], [48, 104], [30, 150], [14, 200], [20, 252], [56, 292], [136, 310], [240, 308], [318, 290], [362, 256], [374, 212], [360, 170], [344, 136], [344, 100], [352, 62], [362, 26], [368, -10], [360, -44], [342, -58], [324, -48], [314, -16], [308, 14], [305, 44, 1]],
    under: guard([[85, 38, 1], [70, 60], [64, 100], [70, 140], [66, 176], [84, 206], [134, 224], [204, 232], [254, 238], [290, 254], [314, 284], [344, 294], [360, 274], [354, 240], [340, 198], [326, 152], [312, 108], [305, 90, 1]], "#f6f2e8", [[76, 78], [72, 152], [108, 212], [200, 228], [340, 282], [320, 146]]),
    parts: `${singleCoil(96, "#fbf8f0")}${singleCoil(138, "#fbf8f0")}${singleCoil(180, "#fbf8f0", -7)}${tremolo(216)}${knobs([[312, 228], [326, 252], [336, 274]], "#fbf8f0")}<path d="M316 184l18 -8" stroke="#2a2d33" stroke-width="5" stroke-linecap="round"/><ellipse cx="250" cy="296" rx="14" ry="9" fill="${CHROME_LO}"/><ellipse cx="250" cy="294" rx="14" ry="9" fill="${CHROME}"/><circle cx="250" cy="294" r="4" fill="#2a2d33"/>`,
    bridge: 222
  }),
  /* The hollow-body: two round horns, f-holes, two chrome humbuckers, a burst to the edge, binding */
  hollow: g => ({
    pts: mirror([[85, 30, 1], [78, 10], [66, -14], [48, -30], [28, -24], [18, 0], [20, 36], [28, 72], [40, 110], [38, 150], [18, 196], [12, 244], [40, 288], [116, 310], [195, 314]]),
    burst: [shade(g.finish, .42), shade(g.finish, .7)],
    edge: g.binding,
    parts: `${fhole(58, 146, false, "#1a0c06")}${fhole(332, 146, true, "#1a0c06")}${humbucker(100, "#1c1d22", "chrome")}${humbucker(150, "#1c1d22", "chrome")}${tuneomatic(196)}${stopbar(226)}${knobs([[298, 248], [328, 260], [294, 276], [324, 288]], "#F5C542")}<circle cx="334" cy="58" r="11" fill="#efe4c8"/><circle cx="334" cy="58" r="7" fill="${CHROME}"/><path d="M334 58l-8 -14" stroke="${CHROME_LO}" stroke-width="4" stroke-linecap="round"/><circle cx="326" cy="44" r="3.5" fill="#efe4c8"/>${strapButton(306)}`,
    bridge: 198
  }),
  /* The single-cut: a round bass bout, one horn on the treble side, a cherry burst, cream binding, a raised guard */
  single: g => ({
    pts: [[85, 6, 1], [58, 2], [34, 16], [20, 50], [22, 90], [36, 122], [28, 152], [12, 198], [14, 248], [48, 290], [124, 308], [266, 308], [342, 290], [376, 248], [378, 198], [362, 152], [352, 116], [354, 82], [362, 50], [356, 22], [340, 10], [324, 16], [314, 36], [305, 60, 1]],
    burst: [shade(g.finish, .5), mix(g.finish, "#e0602a", .25)],
    edge: g.binding,
    parts: `<path d="M305 72C338 78 358 116 352 156C348 186 326 200 312 190C304 182 303 120 305 72Z" fill="#efe4c8"/><path d="M307 80C336 86 350 118 345 154C342 180 324 190 314 182C308 174 306 120 307 80Z" fill="#1c1d22"/>${humbucker(100, "#1c1d22", "#efe4c8")}${humbucker(150, "#1c1d22", "#efe4c8")}${tuneomatic(196)}${stopbar(226)}${knobs([[296, 250], [326, 258], [292, 280], [322, 288]], "#F5C542")}<circle cx="56" cy="60" r="12" fill="#efe4c8"/><circle cx="56" cy="60" r="8" fill="${CHROME}"/><path d="M56 60l10 -14" stroke="${CHROME_LO}" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="46" r="3.5" fill="#efe4c8"/>${strapButton(306)}`,
    bridge: 198
  }),
  /* The classical: wide and round, a wide mosaic rosette, a tie block with the strings tied round it */
  classical: g => ({
    pts: mirror([[195, -12], [118, -11], [62, 4], [42, 42], [46, 88], [68, 128], [62, 162], [32, 206], [24, 252], [50, 290], [120, 308], [195, 312]]),
    parts: `${soundhole(128, 32, [[22, "#2a1a12", 2], [16, "#1f8f8a", 8, "3 2", "#b8402a"], [10, "#efe4c8", 2], [6, "#2a1a12", 2]], g.finish)}${rect(78, 230, 234, 28, shade("#2a1a12", .6), 6)}${rect(78, 228, 234, 28, "#2a1a12", 6)}${rect(92, 234, 206, 6, "#f1e8d2", 3)}${rect(120, 246, 150, 8, "#4a2c1a", 3)}${STR.map(dx => `<path d="M${CX + dx - 4} 244q4 8 8 0" fill="none" stroke="#f1e8d2" stroke-width="2"/>`).join("")}${strapButton(306)}`,
    bridge: 236
  }),
  /* The headliner: our own, flared horns beside the neck, sharp lower points, a swallowtail, a gold bolt */
  swallow: g => ({
    pts: mirror([[85, 26, 1], [72, -12], [54, -52], [16, -96, 1], [20, -60], [28, -20], [38, 40], [36, 100], [22, 160], [12, 214, 1], [52, 252], [118, 312, 1], [158, 288], [195, 262, 1]]),
    edge: g.binding,
    parts: `<path d="M40 176L84 216L64 222L104 280L50 230L70 224Z" fill="${shade(g.binding, .7)}" transform="translate(0 3)"/><path d="M40 176L84 216L64 222L104 280L50 230L70 224Z" fill="${g.binding}"/>${humbucker(100, "#F5C542", "#16171B")}${humbucker(150, "#F5C542", "#16171B")}${tuneomatic(196)}${stopbar(224)}${knobs([[300, 238], [322, 258]], "#F5C542")}`,
    bridge: 198
  })
};
let clipN = 0;
/* the body: its lip, the finish (a burst in hard steps), the light rim, the binding, what sits under the board */
function bodySVG(g, b) {
  const id = `rdb${++clipN}`, d = spline(b.pts);
  const fill = b.burst ? `<path d="${d}" fill="${b.burst[0]}"/><path d="${spline(inset(b.pts, .93))}" fill="${b.burst[1]}"/><path d="${spline(inset(b.pts, .82))}" fill="${g.finish}"/>` : `<path d="${d}" fill="${g.finish}"/>`;
  const rim = `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d} ${spline(shift(b.pts, 6, 8))}" fill-rule="evenodd" fill="#ffffff" opacity=".18" clip-path="url(#${id})"/>`;
  return `<path d="${d}" fill="${shade(g.finish, .55)}" transform="translate(0 9)"/>${fill}${rim}`
    + (b.edge ? `<path d="${d}" fill="none" stroke="${b.edge}" stroke-width="4"/>` : "") + (b.under || "");
}

/* The headstock above the nut: its shape, six tuners and the guitar's name. */
function headstock(g) {
  const shapes = {
    plain: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    slot: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    book: "M92 90L84 26C84 14 94 8 108 12L195 22L282 12C296 8 306 14 306 26L298 90Z",
    point: "M92 90L80 30L195 4L310 30L298 90Z",
    inline: "M92 90L84 90C66 88 52 76 52 58C52 32 62 14 96 10C150 4 236 2 270 10C294 16 306 32 302 56L298 90Z"
  };
  /* 4.84.0: six in line on the bass side, the headstock painted to match the body */
  if (g.head === "inline") {
    const ys = [18, 31, 44, 57, 70, 83];
    return ys.map(y => `<rect x="30" y="${y - 2}" width="30" height="5" rx="2" fill="${CHROME_LO}"/><rect x="22" y="${y - 4}" width="16" height="10" rx="4" fill="#00000055"/><rect x="22" y="${y - 6}" width="16" height="10" rx="4" fill="${g.tuner}"/>`).join("")
      + `<path d="${shapes.inline}" fill="${shade(g.headc, .6)}" transform="translate(0 4)"/><path d="${shapes.inline}" fill="${g.headc}"/>`
      + ys.map(y => `<circle cx="72" cy="${y - 1}" r="4.5" fill="${CHROME}"/><circle cx="72" cy="${y - 1}" r="1.8" fill="${CHROME_LO}"/>`).join("")
      + `<text x="${CX + 14}" y="54" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" font-weight="600" fill="${g.ink}">${g.name}</text>`;
  }
  const tuners = [28, 52, 76].map(y => `<rect x="70" y="${y - 2}" width="30" height="5" rx="2" fill="${g.tuner}" opacity=".7"/><rect x="290" y="${y - 2}" width="30" height="5" rx="2" fill="${g.tuner}" opacity=".7"/><circle cx="68" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="68" cy="${y}" r="9" fill="${g.tuner}"/><circle cx="322" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="322" cy="${y}" r="9" fill="${g.tuner}"/>`).join("");
  const slots = g.head === "slot" ? `${rect(120, 24, 22, 50, "#16171B", 10)}${rect(248, 24, 22, 50, "#16171B", 10)}` : "";
  return `${tuners}<path d="${shapes[g.head] || shapes.plain}" fill="${g.headc}" stroke="${g.binding}" stroke-width="2"/>${slots}<text x="${CX}" y="${g.head === "point" ? 56 : g.head === "book" ? 62 : 54}" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" font-weight="600" fill="${g.ink}">${g.name}</text>`;
}

/* head, body, board, binding, nut, frets and the side dots at the inlays: everything under the stops */
function baseLayer(g, lay, art) {
  if (lay.pic) return picBase(g, lay, art);
  const top = lay.head, endY = top + lay.neck, y0 = endY;
  const body = (BODIES[g.shape || g.body] || BODIES.parlor)(g);
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


/* ---- the guitar pictures (4.87.0): Gemini's headstock and body (art/guitars/<name>-head.webp, -body.webp), cut out
   and measured by tools/guitars/pics.py (numbers in art/guitars/pics.js); the neck between them is drawn here, one fret
   space per stop. The neck is narrow like a real one (NECK wide); the head is scaled so its neck meets it; the body is
   1.25 screens wide, so its bouts run off the sides of the Road. ---- */
const NECK = 84;
export function picLayout(stops, p) {
  const sh = NECK / p.head.nw, sb = 1.25 * W / p.body.w, hh = Math.round(p.head.h * sh) + 12;
  const lay = fretLayout(stops, hh, Math.round(p.body.h * sb + 8));
  /* the strings run a little wider toward the bridge; the hardware is drawn at their width there */
  const f0 = (NECK / 2 - 7) / 90, f1 = f0 * 1.5;
  lay.bridge = p.body.bridge * sb;
  const bot = hh + lay.neck + lay.bridge;
  lay.sfan = y => f0 + (f1 - f0) * Math.max(0, Math.min(1, (y - hh) / (bot - hh)));
  lay.fan = () => NECK / 2 / 106;
  lay.pic = { p, sh, sb, k: f1 };
  return lay;
}
/* the hardware the app draws over a guitar picture, at the width of the strings; yb is where the strings end */
function nanoHardware(g, yb, ac) {
  if (ac) return pinBridge(yb + 3, "#3a2a22");
  const gold = "#F5C542", k = c => knobs([[CX + 100, yb - 70], [CX + 132, yb - 36], [CX + 92, yb - 4], [CX + 124, yb + 30]], c);
  if (g.body === "solid") return `${singleCoil(yb - 132, "#efe4c8")}${singleCoil(yb - 88, "#efe4c8")}${singleCoil(yb - 40, "#efe4c8", -7)}${tremolo(yb - 6)}`;
  if (g.body === "hollow") return `${humbucker(yb - 150, "#1c1d22", "#e0b44a")}${humbucker(yb - 70, "#1c1d22", "#e0b44a")}${tuneomatic(yb)}${stopbar(yb + 34)}`;
  if (g.body === "swallow") return `${humbucker(yb - 110, "#1c1a1f", gold)}${humbucker(yb - 52, "#1c1a1f", gold)}${tuneomatic(yb)}${stopbar(yb + 34)}`;
  return `${humbucker(yb - 96, "#1c1d22", "#efe4c8")}${humbucker(yb - 46, "#1c1d22", "#efe4c8")}${tuneomatic(yb)}${stopbar(yb + 30)}${k("#efe4c8")}`;
}
function picBase(g, lay, f) {
  const { p, sh, sb, k } = lay.pic, top = lay.head, y0 = top + lay.neck, hw = NECK / 2, end = y0 + p.body.end * sb, yb = y0 + lay.bridge;
  const img = (part, x, y, w, h) => `<image href="art/guitars/${f}-${part}.webp?v=${VERSION}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
  let frets = "", y = top;
  for (const sp of lay.spaces) {
    y += sp.h;
    frets += `${rect(CX - hw, y - 2.5, NECK, 5, "#c4c8d0")}${rect(CX - hw, y - 2.5, NECK, 1.6, "#f2f4f7")}${rect(CX - hw, y + 1, NECK, 1.6, "#7d828c")}`;
  }
  const dots = lay.spaces.filter(sp => sp.kind !== "dot").map(sp => `<circle cx="${CX + hw - 5}" cy="${top + sp.y}" r="2.6" fill="${sp.stop.state === "done" ? "#2b1d16" : "#9b8f78"}"/>`).join("");
  /* the neck in the picture's own two colours, over the picture's neck from the nut to where it ends on the body */
  const board = rect(CX - hw, top - 1, hw + .5, end - top + 1, p.lit) + rect(CX, top - 1, hw, end - top + 1, p.shade);
  const hard = p.str ? "" : `<g transform="translate(${CX} ${yb.toFixed(1)}) scale(${k.toFixed(3)}) translate(${-CX} ${(-yb).toFixed(1)})">${nanoHardware(g, yb, g.kind !== "electric")}</g>`;
  return img("body", CX - p.body.cx * sb, y0, p.body.w * sb, p.body.h * sb) + board
    + img("head", CX - p.head.cx * sh, top - p.head.h * sh, p.head.w * sh, p.head.h * sh) + frets + dots + hard;
}


/* ---- Road Ready 9a, painted necks (docs/guitars/NECK-DESIGN.md): the whole painted guitar, at 1.2 times its painted size, with the
   stops in its own fret spaces on its own painted strings. The 23 new guitars carry `road` in pics.js; the 8 older pictures and the
   drawn guitars keep picLayout/picBase/fretLayout above. Which space and lane each stop takes is roadPlace in core/game.js. ---- */
export function roadLayout(stops, p) {
  const r = p.road, S = ROAD.scale, top = ROAD.margin, X = px => CX + S * (px - r.cx), Y = py => top + S * py;
  const neck = stops.filter(s => s.kind !== "headline"), head = stops.find(s => s.kind === "headline");
  const put = roadPlace(neck.map(s => s.kind === "box" ? "B" : "L"), r);
  if (!put.full) console.warn(`The Road: ${neck.length} stops do not fit this guitar's neck (most ${r.cap}); the first ones are placed`);
  /* the strings' x at a row (in the picture's pixels), between the fret rows; the box lane sits between strings 3 and 4 */
  const rows = r.f, strAt = (i, py) => {
    const at = k => rows[k][3 + i];
    if (py <= rows[0][0]) return at(0);
    for (let k = 1; k < rows.length; k++) if (py <= rows[k][0]) return at(k - 1) + (at(k) - at(k - 1)) * (py - rows[k - 1][0]) / (rows[k][0] - rows[k - 1][0]);
    return at(rows.length - 1);
  };
  const sx = (string, py) => string < 0 ? (strAt(2, py) + strAt(3, py)) / 2 : strAt(string, py);
  const spaces = put.spaces.map(c => {
    const st = neck[c.i], string = c.lane === "left" ? 1 : c.lane === "right" ? 4 : -1;
    return { stop: st, kind: st.kind === "box" ? "inlay" : "dot", string, y: Y(c.y), h: S * r.sp[c.space - 1][1], x: X(c.x), lane: c.lane, pair: c.pair, over: !c.clear, space: c.space, py: c.y, dx: S * (c.x - sx(string, c.y)) };
  });
  if (head) spaces.push({ stop: head, kind: "double", string: -1, y: Y(r.badge[1]), h: ROAD.badge[1], w: ROAD.badge[0], x: X(r.badge[0]), lane: "badge", pair: 0, over: false, space: 0, py: r.badge[1], dx: 0 });
  /* the board's left and right edge at a row, in units: between the fret rows, the nut's width above the nut */
  const edge = y => {
    const py = (y - top) / S; let k = 1;
    while (k < rows.length - 1 && py > rows[k][0]) k++;
    const a = rows[k - 1], b = rows[k], t = Math.max(0, Math.min(1, (py - a[0]) / (b[0] - a[0]))), c = a[1] + (b[1] - a[1]) * t, hw = a[2] + (b[2] - a[2]) * t;
    return { l: X(c - hw), r: X(c + hw) };
  };
  const ys = spaces.filter(sp => sp.kind !== "double").map(sp => sp.y);
  return { spaces, head: 0, neck: 0, body: 0, height: Math.round(top + S * r.h + ROAD.margin), road: { p, r, X, Y, S, sx: (string, y) => X(sx(string, (y - top) / S)), edge }, hit: ys.length ? [Math.min(...ys) - 40, Math.max(...ys) + 40] : [0, 0] };
}
/* the painted guitar, nothing else: the painting has the head, board, frets, inlays, strings and hardware */
function roadBase(g, lay, f, build, legId) {
  const { r, S, X, Y } = lay.road, painted = `art/guitars/${f}-road.webp?v=${VERSION}`;
  /* Road Ready 9b: a guitar you restyled is put together once (buildart.js) and drawn at the same size, so the stops line up;
     the painting shows until it is ready, and for a guitar with no build */
  const bp = build && legId ? buildPic(legId, build, painted) : { src: painted, attr: "" };
  return `<image href="${bp.src}"${bp.attr} x="${X(0).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${(r.w * S).toFixed(1)}" height="${(r.h * S).toFixed(1)}"/>`;
}

/* the strings and their shadows, from the nut to the bridge */
function stringLayer(g, lay) {
  /* Road Ready 9a: a picture with painted strings (lay.pic.p.str) keeps them below the neck; the drawn ones run only over the neck, from the nut to where the body picture starts */
  const top = lay.head, bot = lay.pic?.p.str ? top + lay.neck : lay.bridge ? top + lay.neck + lay.bridge : top + lay.neck + (BODIES[g.shape || g.body] || BODIES.parlor)(g).bridge - 4;
  const wd = g.kind === "classical" ? [3.2, 2.8, 2.4, 2, 1.8, 1.6] : g.kind === "electric" ? [3.2, 2.8, 2.4, 2, 1.6, 1.2] : [3.5, 3, 2.5, 2, 1.6, 1.2];
  const col = i => g.kind === "classical" ? (i < 3 ? "#c4c8d0" : "#f3ecdc") : g.kind === "electric" ? "#c4c8d0" : i < 4 ? "#c9a96e" : "#dfe2e8";
  const sf = lay.sfan || lay.fan, f0 = sf ? sf(top) : 1, f1 = sf ? sf(bot) : 1;
  return STR.map((dx, i) => `<line x1="${CX + dx * f0 + 3}" y1="${top}" x2="${CX + dx * f1 + 3}" y2="${bot}" stroke="#14100d" stroke-opacity=".55" stroke-width="${wd[i]}"/>`).join("")
    + STR.map((dx, i) => `<line x1="${CX + dx * f0}" y1="${top}" x2="${CX + dx * f1}" y2="${bot}" stroke="${col(i)}" stroke-width="${wd[i]}"/>`).join("");
}

/* ---- inlays: one shape, drawn as an empty pocket, set in pearl, or set and lit ---- */
const STAR = c => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 6.5 : 15, a = -Math.PI / 2 + i * Math.PI / 5; return `${(c + r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(" ");
function shape(t, c, cls) {
  const a = `class="${cls}"`;
  if (t === "crate") return `<rect ${a} x="${c - 16}" y="-12" width="32" height="24" rx="2.5"/>`;
  if (t === "small") return `<circle ${a} cx="${c}" r="10"/>`;
  if (t === "dot" || t === "abalone") return `<circle ${a} cx="${c}" r="13"/>`;
  if (t === "block") return `<rect ${a} x="${c - 17}" y="-11" width="34" height="22" rx="3"/>`;
  if (t === "split") return `<path ${a} d="M${c - 16} 10H${c - 2}V-6L${c - 16} -10ZM${c + 2} 10H${c + 16}V-10L${c + 2} -6Z"/>`;
  if (t === "trap") return `<path ${a} d="M${c - 16} 11H${c + 16}L${c + 12} -11H${c - 12}Z"/>`;
  return `<polygon ${a} points="${STAR(c)}"/>`;
}
/* state: "pocket" (not reached), "ring" (a merch box you can open), "set" (pearl in), "lit" (the headline show is next).
   4.84.0: the guitar decides the material (`mat`), the stop decides the shape: a merch box is a crate on every guitar,
   the headline show two of the guitar's own inlays. */
const crateLines = c => `<path class="rd-eng" d="M${c - 6} -11V11M${c + 5} -11V11M${c - 15} -1H${c + 15}"/>`;
export function inlaySVG(type, state, double, mat = "pearl") {
  const cs = double ? [-34, 34] : [0], vb = double ? "-56 -24 112 48" : "-30 -24 60 48";
  const body = cs.map(c => {
    if (state === "pocket" || state === "ring") return shape(type, c, "rd-pit") + (state === "ring" ? `<circle class="rd-ring dash" cx="${c}" r="25"/>` : "");
    const sheen = `<ellipse class="rd-sheen" cx="${c - 4}" cy="-5" rx="5" ry="2.4" transform="rotate(-30 ${c - 4} -5)"/><ellipse class="rd-sheen2" cx="${c + 5}" cy="5" rx="5.5" ry="2" transform="rotate(-30 ${c + 5} 5)"/>`;
    return `${state === "lit" ? `<circle class="rd-halo" cx="${c}" r="26"/>` : ""}${shape(type, c, "rd-rec")}${shape(type, c, `rd-pearl ${type} mat-${mat}`)}${type === "crate" ? crateLines(c) : ""}${sheen}${state === "lit" ? `<circle class="rd-ring" cx="${c}" r="23"/>` : ""}`;
  }).join("");
  return `<svg class="rd-inlay" viewBox="${vb}" aria-hidden="true">${state === "ring" ? `<circle class="rd-halo" r="30"/>` : ""}${body}</svg>`;
}

/* a lesson: a finger dot on its string */
function dotSVG(state, icon) {
  return `<svg class="rd-dot" viewBox="-30 -30 60 60" aria-hidden="true">${state === "now" ? `<circle class="rd-halo" r="29"/>` : ""}<circle class="rd-lip" cy="6" r="22"/><circle class="rd-body" r="22"/><ellipse class="rd-shine" cx="-7" cy="-11" rx="9" ry="4" transform="rotate(-25 -7 -11)"/></svg><span class="rd-ic">${state === "locked" ? `<i class="rd-pin"></i>` : icon}</span>`;
}

/* Where a stop sits on the neck, in the drawing's units (390 wide). The stops and the Road Ready connector both use
   this, so the line always ends on the stop. */
export function stopXY(sp, lay) {
  if (lay.road) return { x: sp.x, y: sp.y }; /* a painted neck: the stop's own x and y, already in the drawing's units */
  const y = lay.head + sp.y, f = lay.sfan || lay.fan;
  return { x: CX + (sp.string >= 0 ? STR[sp.string] * (f ? f(y) : 1) : 0), y };
}

/* ---- Road Ready (step 02): stops are pearl inlays set flush in the wood, in four states ----
   done: a 26 px amber pearl with an engraved check and a faint glow. now: a 52 by 38 trapezoid, lit from within, with
   the show number. ahead (open or locked): a 26 px matte pearl with the number. The headline show is two 24 px dots
   (the number and a lock), a merch box the crate. Every one sits in a 44 px button. Colours are the --rr-* tokens. */
/* nowPair (Graham's decision, 2026-11-19, Surprise 169): the current stop is drawn smaller while it shares a fret space with
   its partner, so the two never overlap */
const RR_SIZE = { dot: [26, 26], now: [52, 38], nowPair: [42, 31], box: [30, 22], double: [60, 24] };
const rrPhase = st => st === "done" ? "done" : st === "now" ? "now" : "ahead";
let rrN = 0;
/* an engraved mark: the mark, with a lighter copy 1 px below it where the cut catches the light */
const engrave = (svg, cls) => `<g class="rr-eng-hi" transform="translate(0 1)">${svg}</g><g class="rr-eng ${cls}">${svg}</g>`;
const ENG = {
  check: r => `<path d="M${-r * .42} ${r * .02}l${r * .3} ${r * .3} ${r * .56} ${-r * .62}" fill="none" stroke-width="${(r * .2).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`,
  num: (n, size) => `<text y="${(size * .36).toFixed(1)}" text-anchor="middle" font-size="${size}">${n}</text>`,
  lock: r => `<rect x="${-r * .4}" y="${-r * .06}" width="${r * .8}" height="${r * .6}" rx="${r * .12}"/><path d="M${-r * .24} ${-r * .06}v${-r * .16}a${r * .24} ${r * .24} 0 0 1 ${r * .48} 0v${r * .16}" fill="none" stroke-width="${(r * .14).toFixed(1)}"/>`,
  star: r => `<polygon points="${STAR(0).split(" ").map(p => p.split(",").map(v => (v * r / 15).toFixed(1)).join(",")).join(" ")}"/>`
};
/* one pearl: the cut edge, the pearl (a soft radial light), the inner top shadow, the shimmer, the mark */
function pearl(d, ph, mark, shimmer, w, h) {
  const id = `rrp${++rrN}`;
  const grad = `<radialGradient id="${id}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity="${ph === "ahead" ? .18 : .45}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  const clip = `<clipPath id="${id}c"><path d="${d}"/></clipPath>`;
  const shade = `<g clip-path="url(#${id}c)"><path d="${d}" fill="none" stroke="#000" stroke-opacity=".28" stroke-width="5" transform="translate(0 2.5)"/></g>`;
  const sheen = shimmer ? `<ellipse class="rr-sheen" cx="${(-w * .18).toFixed(1)}" cy="${(-h * .2).toFixed(1)}" rx="${(w * .16).toFixed(1)}" ry="${(h * .07).toFixed(1)}" transform="rotate(-25 ${(-w * .18).toFixed(1)} ${(-h * .2).toFixed(1)})"/><ellipse class="rr-sheen" cx="${(w * .2).toFixed(1)}" cy="${(h * .22).toFixed(1)}" rx="${(w * .1).toFixed(1)}" ry="${(h * .05).toFixed(1)}" transform="rotate(-25 ${(w * .2).toFixed(1)} ${(h * .22).toFixed(1)})"/>` : "";
  return `<defs>${grad}${clip}</defs><path class="rr-pearl ${ph}" d="${d}"/><path d="${d}" fill="url(#${id})"/>${shade}${sheen}${mark}<path class="rr-cut" d="${d}"/>`;
}
const circle = (cx, r) => `M${cx - r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
/* The headline show on a painted neck: a pill badge on the body, 150 by 42 units, in the usual states (locked matte, next lit
   with the glow, done amber with a check) */
function rrBadgeArt(ph, cur) {
  const [w, h] = ROAD.badge, d = `M-54 -21H54A21 21 0 0 1 54 21H-54A21 21 0 0 1 -54 -21Z`, lock = ph === "done" ? "done" : ph === "now" ? "" : "locked";
  const mark = `<g transform="translate(-48 0)">${ph === "done" ? ENG.check(12) : ph === "now" ? ENG.star(9) : ENG.lock(12)}</g><text x="12" y="5" text-anchor="middle" font-size="13" letter-spacing="1">HEADLINE</text>`;
  const glow = cur ? `<span class="rr-glow rr-glow-pill" aria-hidden="true"></span>` : ph === "done" ? `<span class="rr-halo" aria-hidden="true"></span>` : "";
  return `${glow}<svg class="rr-art" width="${w}" height="${h}" style="width:${w}px;height:${h}px" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" aria-hidden="true">${pearl(d, ph, engrave(mark, lock), ph !== "ahead", w, h)}</svg>`;
}
/* The art for one Road Ready stop. kind: the space's kind (dot, inlay = merch box, double = headline). n: the show number. */
export function rrStopArt(kind, state, n, pill = false, paired = false) {
  const ph = rrPhase(state), cur = ph === "now";
  if (kind === "double" && pill) return rrBadgeArt(ph, cur);
  const [w, h] = kind === "double" ? RR_SIZE.double : kind === "inlay" ? RR_SIZE.box : cur ? (paired ? RR_SIZE.nowPair : RR_SIZE.now) : RR_SIZE.dot;
  const lock = ph === "done" ? "done" : ph === "now" ? "" : "locked";
  let body;
  if (kind === "double") {
    body = [-18, 18].map((cx, i) => {
      const mark = ph === "done" ? ENG.check(12) : i === 0 ? ENG.num(n, 12) : ph === "now" ? ENG.star(9) : ENG.lock(12);
      return `<g transform="translate(${cx} 0)">${pearl(circle(0, 12), ph, engrave(mark, lock), ph !== "ahead", 24, 24)}</g>`;
    }).join("");
  } else if (kind === "inlay") {
    const d = `M-15 -11H15V11H-15Z`, lines = `<path d="M-6 -11V11M5 -11V11M-15 -1H15" fill="none" stroke-width="1.6"/>`;
    body = pearl(d, ph, engrave(lines, lock), ph !== "ahead", w, h);
  } else if (cur) {
    body = pearl(`M${-w / 2} ${h / 2}H${w / 2}L${w * .385} ${-h / 2}H${-w * .385}Z`, ph, engrave(ENG.num(n, Math.round(h * .53)), ""), true, w, h);
  } else {
    body = pearl(circle(0, 13), ph, engrave(ph === "done" ? ENG.check(13) : ENG.num(n, 13), lock), ph === "done", w, h);
  }
  const glow = cur ? `<span class="rr-glow" aria-hidden="true"></span>` : ph === "done" ? `<span class="rr-halo" aria-hidden="true"></span>` : "";
  return `${glow}<svg class="rr-art" width="${w}" height="${h}" style="width:${w}px;height:${h}px" viewBox="${-w / 2} ${-h / 2} ${w} ${h}" aria-hidden="true">${body}</svg>`;
}

/* The amber line from done stop to done stop, ending at the current one (or the headline show when the leg is done).
   Each step is a cubic curve with vertical tangents: it leaves along one string and bends onto the next. `o.fresh`
   is the id of a stop the line has only just reached: that last step draws itself on. */
export function connectorSVG(lay, spaces, o) {
  const segs = [];
  for (let i = 0; i + 1 < spaces.length; i++) {
    const a = spaces[i].stop, b = spaces[i + 1].stop;
    if (a.state !== "done" || !(b.state === "done" || b === o.cur)) break;
    const p = stopXY(spaces[i], lay), q = stopXY(spaces[i + 1], lay), ym = ((p.y + q.y) / 2).toFixed(1);
    const f = n => n.toFixed(1);
    let d = `M${f(p.x)} ${f(p.y)}C${f(p.x)} ${ym} ${f(q.x)} ${ym} ${f(q.x)} ${f(q.y)}`;
    if (lay.road) {
      /* a painted neck: along the stop's own painted string, then the same bend onto the next stop's string; the two stops of a pair
         are joined by a short straight line */
      const A = spaces[i], B = spaces[i + 1], sx = (sp, y) => lay.road.sx(sp.string, y) + sp.dx;
      if (A.space && A.space === B.space) d = `M${f(p.x)} ${f(p.y)}L${f(q.x)} ${f(q.y)}`;
      else if (B.kind === "double") { const y1 = p.y + 40; d = `M${f(p.x)} ${f(p.y)}L${f(sx(A, y1))} ${f(y1)}C${f(sx(A, y1))} ${f((y1 + q.y) / 2)} ${f(q.x)} ${f((y1 + q.y) / 2)} ${f(q.x)} ${f(q.y)}`; }
      else {
        const y1 = p.y + (q.y - p.y) * .3, y2 = p.y + (q.y - p.y) * .7, ya = sx(A, y1), yb = sx(B, y2), m = f((y1 + y2) / 2);
        d = `M${f(p.x)} ${f(p.y)}L${f(ya)} ${f(y1)}C${f(ya)} ${m} ${f(yb)} ${m} ${f(yb)} ${f(y2)}L${f(q.x)} ${f(q.y)}`;
      }
    }
    segs.push({ d, fresh: o.fresh && b.id === o.fresh });
  }
  if (!segs.length) return "";
  const id = `rrc${++rrN}`;
  const path = (s, cls) => `<path class="${cls}${s.fresh ? " rr-draw" : ""}" d="${s.d}"${s.fresh ? ` pathLength="1"` : ""}/>`;
  return `<svg class="rd-conn" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true"><defs><filter id="${id}" x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation="7"/></filter></defs>
    <g class="rr-conn-glow" filter="url(#${id})">${segs.map(s => path(s, "rr-cg")).join("")}</g>${segs.map(s => path(s, "rr-cc")).join("")}</svg>`;
}

/* A Road Ready stop: the pearl in its 44 px button, the callout beside the current one, the songs chip beside the
   ones ahead. The callout always sits on the right of the neck: the neck is narrow, so there is room on that side
   for every stop, and the left side is where Louie peeks in. */
function rrStopHTML(sp, g, lay, o) {
  const s = sp.stop, { x, y } = stopXY(sp, lay), cur = s === o.cur, ph = rrPhase(s.state), road = !!lay.road, pill = road && sp.kind === "double";
  const [w] = pill ? ROAD.badge : sp.kind === "double" ? RR_SIZE.double : sp.kind === "inlay" ? RR_SIZE.box : cur ? (sp.paired ? RR_SIZE.nowPair : RR_SIZE.now) : RR_SIZE.dot;
  const half = Math.max(22, w / 2), px = (x / W * 100).toFixed(3);
  /* on a painted neck the callout sits just off the right edge of the board at the stop's row (the badge: off its own end), the
     songs chip off the left edge, never over the strings */
  const e = road ? (pill ? { l: x - w / 2, r: x + w / 2 } : lay.road.edge(y)) : null;
  const tagAt = road ? `left:${((e.r + 10) / W * 100).toFixed(3)}%;max-width:calc(${(100 - (e.r + 10) / W * 100).toFixed(3)}% - 8px)` : `left:calc(${px}% + ${half + 8}px);max-width:calc(${(100 - x / W * 100).toFixed(3)}% - ${half + 16}px)`;
  const tag = cur ? `<span class="rd-tag rr-callout" style="${tagAt}" aria-hidden="true">${o.tag(s)}</span>` : "";
  /* the label says how many songs a lesson opens; the chip shows it only on the stops ahead (the callout says it on the current one) */
  const songs = sp.kind === "dot" && ph !== "done" && o.songs ? o.songs(s) : 0;
  const chipAt = road ? `right:${((W - (e.l - 4)) / W * 100).toFixed(3)}%` : `right:calc(${(100 - x / W * 100).toFixed(3)}% + ${half + 4}px)`;
  const badge = songs > 0 && ph === "ahead" ? `<span class="rd-songs rr-chip" style="${chipAt}" aria-hidden="true">${songs} song${songs === 1 ? "" : "s"}</span>` : "";
  const cls = `rd-node rr ${s.kind} ${s.state}${sp.kind === "double" ? " big" : ""}${cur ? " cur" : ""}${road && sp.over ? " rr-over" : ""}${pill ? " rr-pill" : ""}`;
  /* the badge's button is the badge plus 8 units all round */
  const size = pill ? `;width:${ROAD.badge[0] + 2 * ROAD.pad}px;height:${ROAD.badge[1] + 2 * ROAD.pad}px` : "";
  const at = road ? ` data-hx="${x.toFixed(1)}" data-hy="${y.toFixed(1)}"` : "";
  return `<div class="rd-stop rr k-${sp.kind}${cur ? " cur" : ""}" style="top:${(y / lay.height * 100).toFixed(3)}%">${tag}${badge}<button class="${cls}" data-stop="${o.id(s)}" data-kind="${sp.kind}" data-n="${o.num(s)}"${at} style="left:${px}%${size}" aria-label="${o.label(s)}${songs > 0 ? `, opens ${songs} of your songs` : ""}${cur ? ". Double tap to open." : ""}">${rrStopArt(sp.kind, s.state, o.num(s), pill, sp.paired)}</button></div>`;
}

/* One stop, placed over the neck. `o`: cur (the current stop), icon(stop), label(stop), tag(stop). */
function stopHTML(sp, g, lay, o) {
  if (o.rr) return rrStopHTML(sp, g, lay, o);
  const s = sp.stop, { x, y } = stopXY(sp, lay), cur = s === o.cur;
  const left = sp.kind === "inlay" || (sp.kind === "dot" && sp.string < 3);
  const tag = cur ? `<span class="rd-tag ${left ? "l" : "r"}" style="${left ? `right:${((1 - (lay.pic ? CX - NECK / 2 - 30 : 79) / W) * 100).toFixed(2)}%` : `left:${((lay.pic ? CX + NECK / 2 + 30 : 311) / W * 100).toFixed(2)}%`}" aria-hidden="true">${o.tag(s)}</span>` : "";
  const inner = sp.kind === "dot" ? dotSVG(s.state, o.icon(s))
    : inlaySVG(sp.kind === "inlay" ? "crate" : g.inlay, s.state === "done" ? "set" : s.state === "now" ? (sp.kind === "inlay" ? "ring" : "lit") : "pocket", sp.kind === "double", g.mat);
  /* 4.84.0: a lesson that opens songs you have says how many, so you can see which one is worth doing */
  const songs = sp.kind === "dot" && s.state !== "done" && o.songs ? o.songs(s) : 0;
  const badge = songs > 0 ? `<span class="rd-songs" aria-hidden="true"><svg viewBox="0 0 12 14"><path d="M5 1h6v3H7v7.2A2.8 2.8 0 1 1 5 8.6z"/></svg>${songs}</span>` : "";
  const cls = `rd-node ${s.kind} ${s.state}${sp.kind === "double" ? " big" : ""}`;
  return `<div class="rd-stop k-${sp.kind}${cur ? " cur" : ""}" style="--x:${x - CX}px;top:${(y / lay.height * 100).toFixed(3)}%">${tag}<button class="${cls}" data-stop="${o.id(s)}" data-inlay="${sp.kind === "inlay" ? "crate" : g.inlay}" data-mat="${g.mat}" style="left:${(x / W * 100).toFixed(3)}%" aria-label="${o.label(s)}${songs > 0 ? `, opens ${songs} of your songs` : ""}">${inner}${badge}</button></div>`;
}

/* A leg's neck: base layer, stops, strings. The wrapper keeps the drawing's proportions, so a narrower
   phone scales the whole guitar and the stops stay where they belong. */
/* 4.87.0: every leg's guitar is a picture; its numbers are in one small file, so the neck is laid out at once and the
   pictures load like any image */
/* Road Ready 9a: the seven Road guitars are Grok's pictures (Porch ... Comet), named by their GUITARS body; the older
   pictures (parlor ... headliner) are still built by tools/guitars/pics.py but no leg uses them */
export const NANO_FILE = { open: "porch", switch: "cornerstone", scales: "clubslab", strum: "hollowhill", pick: "swing", finger: "koaarc", encore: "comet" };
/* the small guitar in the guitarist's hands (guitarist.js): the whole picture, by body shape */
const BODY_FILE = { parlor: "parlor", cutaway: "cutaway-sunburst", solid: "solid", hollow: "hollow", single: "single", classical: "classical", swallow: "headliner", ...Object.fromEntries(Object.keys(PICS).map(k => [k, k])) };
export const guitarPic = body => BODY_FILE[body] ? `art/guitars/${BODY_FILE[body]}-small.webp?v=${VERSION}` : null;
/* the picture of a leg's guitar, or of the shop guitar you chose (o.shown is guitarShown(data, leg id) from core/game.js) */
const picOf = (id, o = {}) => { const f = o.shown?.body || NANO_FILE[id]; return o.nano === false || !PICS[f] ? null : { f, p: PICS[f] }; };
export function neckHTML(leg, o) {
  const g = o.shown || guitarFor(leg.id), pc = picOf(leg.id, o), lay = pc ? (pc.p.road ? roadLayout(leg.stops, pc.p) : picLayout(leg.stops, pc.p)) : fretLayout(leg.stops);
  const earned = leg.done ? `<span class="rd-earned">${g.name} · headlined</span>` : "";
  lay.spaces.forEach(sp => { sp.paired = !!sp.space && lay.spaces.filter(x => x.space === sp.space).length > 1; });
  if (lay.road) {
    /* Road Ready 9a: the painted guitar, no drawn strings; one invisible hit layer over the neck, and every stop's x and y in the
       drawing's units (data-hx, data-hy) so road.js can decide which stop a tap selects (roadHit in core/game.js) */
    const [h0, h1] = lay.hit;
    return `<div class="rd-neck road" data-guitar="${leg.id}" data-lh="${lay.height}" style="aspect-ratio:${W}/${lay.height}" role="group" aria-label="${g.name}">
    <svg class="rd-base nano road" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${roadBase(g, lay, pc.f, o.shown?.shop ? null : o.build, leg.id)}</svg>
    ${o.rr ? connectorSVG(lay, lay.spaces, o) : ""}
    <div class="rr-hit" aria-hidden="true" style="top:${(h0 / lay.height * 100).toFixed(3)}%;height:${((h1 - h0) / lay.height * 100).toFixed(3)}%"></div>
    ${lay.spaces.map(sp => stopHTML(sp, g, lay, o)).join("")}
    ${earned}</div>`;
  }
  return `<div class="rd-neck" data-guitar="${leg.id}" style="aspect-ratio:${W}/${lay.height}" role="group" aria-label="${g.name}">
    <svg class="rd-base${lay.pic ? " nano" : ""}" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${baseLayer(g, lay, pc?.f)}</svg>
    ${o.rr ? connectorSVG(lay, lay.spaces, o) : ""}
    ${lay.spaces.map(sp => stopHTML(sp, g, lay, o)).join("")}
    <svg class="rd-strings" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${stringLayer(g, lay)}</svg>
    ${earned}</div>`;
}

/* a guitar on its own (the new-guitar sheet): the headstock, a short neck and the body */
/* full (Road Ready 06): a neck in a real guitar's proportion, for a guitar shown on its own (neckStops in core/game.js);
   without it the neck is two spaces long, as the small picture on the earlier new-guitar sheet always was */
export function guitarSVG(id, { full = false } = {}) {
  const g = guitarFor(id), pc = picOf(id), spaces = n => Array.from({ length: n }, () => ({ kind: "chord", state: "locked" }));
  /* Road Ready 9a: a painted guitar is shown whole (its painted neck, nothing drawn), scaled to fit; full makes no difference */
  if (pc?.p.road) { const r = pc.p.road; return `<svg class="rd-gsvg road" viewBox="0 0 ${r.w} ${r.h}" role="img" aria-label="${g.name}"><image href="art/guitars/${pc.f}-road.webp?v=${VERSION}" width="${r.w}" height="${r.h}"/></svg>`; }
  if (!pc) { const lay = fretLayout(spaces(full ? neckStops(FRET_BODY) : 2)); return `<svg class="rd-gsvg" viewBox="0 0 ${W} ${lay.height}" role="img" aria-label="${g.name}">${baseLayer(g, lay)}${stringLayer(g, lay)}</svg>`; }
  /* the body is wider than the screen on the Road, so the whole guitar is drawn wider to show all of it */
  const lay = picLayout(spaces(full ? neckStops(picLayout(spaces(2), pc.p).body) : 2), pc.p), half = 1.25 * W / 2 + 6;
  return `<svg class="rd-gsvg" viewBox="${CX - half} 0 ${half * 2} ${lay.height}" role="img" aria-label="${g.name}">${baseLayer(g, lay, pc.f)}${stringLayer(g, lay)}</svg>`;
}
