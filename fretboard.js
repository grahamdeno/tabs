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
import { fretLayout, guitarFor } from "./core.js";

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
function baseLayer(g, lay) {
  if (lay.nano) return nanoBase(g, lay);
  const top = lay.head, endY = top + lay.neck, y0 = endY;
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


/* ---- the Nano art (4.86.0): the traced head and body from art/guitars, the neck still drawn here ----
   The art is in its own units (a neck about 36 wide); the Road's neck is 212 wide so the dots are thumb-sized.
   `o`: body "A" (the whole body on the screen), "B" (about 1.6 screens wide, the bouts bleed off), "C" (true scale);
   head "H1" (100 tall like before), "H2" (taller, same shape), "H3" (taller and stretched to the neck); name (print it). */
export function nanoLayout(stops, art, o) {
  const n = art.nums, bw = n.br - n.bl, P = o.body === "P";
  /* P: the proportion test. P1 head: true shape, 300 wide. P2 head: 250 tall, widened to about 280. */
  let hs, hsx, hh;
  if (o.head === "P1") { hsx = hs = 300 / (n.hr - n.hl); hh = Math.round(n.nut * hs + 10); }
  else if (o.head === "P2") { hs = 244 / (n.nut + 2); hsx = 280 / (n.hr - n.hl); hh = 250; }
  else { hh = o.head === "H1" ? 100 : 230; hs = (hh - 6) / (n.nut + 2); hsx = o.head === "H3" ? hs * Math.min(1.7, 200 / (hs * 70)) : hs; }
  const s = P ? 1.2 * W / bw : o.body === "C" ? 212 / (n.r1 - n.l1) : o.body === "B" ? 1.6 * W / bw : (W - 10) / bw;
  /* the body's top sits at the last fret; the board runs on to the art's end, but no more than 70 past it */
  const endOff = Math.min((n.end - n.top) * s, 70), tail = o.body === "A" || P ? n.h - n.end + 6 : n.bridge - n.end + 80;
  const lay = fretLayout(stops, hh, Math.round(endOff + tail * s));
  lay.nano = { art, o, s, endOff, hs, hsx };
  lay.bridge = endOff + (n.bridge - n.end) * s - 4;
  if (P) lay.fan = y => (100 + 15 * (y - hh) / (lay.neck + endOff)) / 106; /* the board widens toward the body: half width 100 to about 115 */
  return lay;
}
function nanoBase(g, lay) {
  const { art, o, s, endOff, hs, hsx } = lay.nano, n = art.nums, top = lay.head, endY = top + lay.neck;
  const hc = (n.l0 + n.r0) / 2;
  const half = y => lay.fan ? 106 * lay.fan(y) : 106, bEnd = endY + endOff;
  let frets = "", y = top;
  for (const sp of lay.spaces) {
    y += sp.h;
    const hw = half(y); frets += `${rect(CX - hw, y - 3, hw * 2, 6, "#c4c8d0")}${rect(CX - hw, y - 3, hw * 2, 2, "#f2f4f7")}${rect(CX - hw, y + 1, hw * 2, 2, "#7d828c")}`;
  }
  const dots = lay.spaces.filter(sp => sp.kind !== "dot").map(sp => `<circle cx="${CX + half(top + sp.y) + 2}" cy="${top + sp.y}" r="2.6" fill="${sp.stop.state === "done" ? "#2b1d16" : "#9b8f78"}"/>`).join("");
  const bt = `translate(${(CX - n.cx * s).toFixed(1)} ${(bEnd - n.end * s).toFixed(1)}) scale(${s.toFixed(4)})`;
  const ht = `translate(${(CX - hc * hsx).toFixed(1)} ${(top - n.nut * hs).toFixed(1)}) scale(${hsx.toFixed(4)} ${hs.toFixed(4)})`;
  const poly = (d, y0, y1) => `${CX - half(y0) - d},${y0} ${CX + half(y0) + d},${y0} ${CX + half(y1) + d},${y1} ${CX - half(y1) - d},${y1}`;
  const board = lay.fan ? `<polygon points="${poly(4, top - 8, bEnd)}" fill="${g.binding}"/><polygon points="${poly(0, top, bEnd)}" fill="${g.board}"/>` : rect(89, top, 212, bEnd - top, g.board) + rect(85, top - 8, 4, bEnd - top + 8, g.binding) + rect(301, top - 8, 4, bEnd - top + 8, g.binding);
  /* P: the traced hardware is covered and our own is drawn at the width of the strings */
  let hw = "";
  if (lay.fan) {
    const yb = bEnd + (n.bridge - n.end) * s, [cl, cr] = o.cover || [g.finish, shade(g.finish, .84)], ac = g.kind !== "electric";
    const y0 = ac ? yb - 24 : bEnd, y1 = ac ? yb + 26 : yb + 52;
    hw = rect(CX - 175, y0, 175, y1 - y0, cl) + rect(CX, y0, 175, y1 - y0, cr)
      + (ac ? pinBridge(yb + 3, "#3a2a22") : `${humbucker(yb - 96, "#1c1d22", "#efe4c8")}${humbucker(yb - 46, "#1c1d22", "#efe4c8")}${tuneomatic(yb)}${stopbar(yb + 30)}`);
  }
  return `<g transform="${ht}">${art.head}</g><g transform="${bt}">${art.body}</g>${board}${frets}${dots}${hw}`
    + (o.name ? `<text x="${CX}" y="${top / 2 + 6}" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="16" font-weight="600" fill="${g.ink}">${g.name}</text>` : "");
}

/* the strings and their shadows, from the nut to the bridge */
function stringLayer(g, lay) {
  const top = lay.head, bot = lay.bridge ? top + lay.neck + lay.bridge : top + lay.neck + (BODIES[g.body] || BODIES.parlor)(g).bridge - 4;
  const wd = g.kind === "classical" ? [3.2, 2.8, 2.4, 2, 1.8, 1.6] : g.kind === "electric" ? [3.2, 2.8, 2.4, 2, 1.6, 1.2] : [3.5, 3, 2.5, 2, 1.6, 1.2];
  const col = i => g.kind === "classical" ? (i < 3 ? "#c4c8d0" : "#f3ecdc") : g.kind === "electric" ? "#c4c8d0" : i < 4 ? "#c9a96e" : "#dfe2e8";
  const f0 = lay.fan ? lay.fan(top) : 1, f1 = lay.fan ? lay.fan(bot) : 1;
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

/* One stop, placed over the neck. `o`: cur (the current stop), icon(stop), label(stop), tag(stop). */
function stopHTML(sp, g, lay, o) {
  const s = sp.stop, y = lay.head + sp.y, x = CX + (sp.string >= 0 ? STR[sp.string] * (lay.fan ? lay.fan(y) : 1) : 0), cur = s === o.cur;
  const left = sp.kind === "inlay" || (sp.kind === "dot" && sp.string < 3);
  const tag = cur ? `<span class="rd-tag ${left ? "l" : "r"}" style="${left ? `right:${((1 - 79 / W) * 100).toFixed(2)}%` : `left:${(311 / W * 100).toFixed(2)}%`}" aria-hidden="true">${o.tag(s)}</span>` : "";
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
export function neckHTML(leg, o) {
  const g = guitarFor(leg.id), lay = o.nano ? nanoLayout(leg.stops, o.nano.art, o.nano) : fretLayout(leg.stops);
  return `<div class="rd-neck" data-guitar="${leg.id}" style="aspect-ratio:${W}/${lay.height}" role="group" aria-label="${g.name}">
    <svg class="rd-base${lay.nano ? " nano" : ""}" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${baseLayer(g, lay)}</svg>
    ${lay.spaces.map(sp => stopHTML(sp, g, lay, o)).join("")}
    <svg class="rd-strings" viewBox="0 0 ${W} ${lay.height}" aria-hidden="true">${stringLayer(g, lay)}</svg>
    ${leg.done ? `<span class="rd-earned">${g.name} · headlined</span>` : ""}</div>`;
}

/* a guitar on its own (the new-guitar sheet): the headstock, a short neck and the body */
export function guitarSVG(id) {
  const g = guitarFor(id), lay = fretLayout([{ kind: "chord", state: "locked" }, { kind: "chord", state: "locked" }]);
  return `<svg class="rd-gsvg" viewBox="0 0 ${W} ${lay.height}" role="img" aria-label="${g.name}">${baseLayer(g, lay)}${stringLayer(g, lay)}</svg>`;
}
