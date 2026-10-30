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

/* A symmetric body from its left half: start at the top middle, cubic segments down the left side to the
   bottom middle; the right side is the same segments mirrored and walked back up. */
function sym(start, segs) {
  let d = `M${start[0]} ${start[1]}`;
  const pts = [start];
  for (const s of segs) { d += `C${s.join(" ")}`; pts.push([s[4], s[5]]); }
  for (let i = segs.length - 1; i >= 0; i--) { const s = segs[i], p = pts[i]; d += `C${W - s[2]} ${s[3]} ${W - s[0]} ${s[1]} ${W - p[0]} ${p[1]}`; }
  return d + "Z";
}
const rect = (x, y, w, h, fill, rx = 0, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const knob = (x, y, c) => `<circle cx="${x}" cy="${y + 2}" r="7" fill="#A87F0C"/><circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;

/* The bodies, our own flat shapes, compressed. Local y: 0 is the last fret, the body runs to FRET_BODY (230).
   `shape` is drawn under the board, `parts` over it, `bridge` is where the strings end. */
const BODIES = {
  parlor: g => ({
    shape: `<path d="${sym([195, 30], [[150, 30, 104, 50, 102, 92], [100, 118, 116, 130, 116, 152], [118, 178, 78, 192, 78, 208], [78, 224, 128, 228, 195, 228]])}" fill="${g.finish}" stroke="#5a3d28" stroke-width="3"/>`,
    parts: `<ellipse cx="250" cy="176" rx="26" ry="11" fill="#a5845f" transform="rotate(-20 250 176)"/><ellipse cx="136" cy="150" rx="8" ry="5" fill="#a5845f"/><circle cx="195" cy="112" r="26" fill="none" stroke="${g.binding}" stroke-width="2"/><circle cx="195" cy="112" r="21" fill="#120c09"/>${rect(152, 176, 86, 10, "#2a1a12", 3)}`,
    bridge: 181
  }),
  cutaway: g => ({
    shape: `<path d="M150 30L240 30C246 52 252 74 270 90C284 100 280 130 276 152C272 178 370 182 370 208C370 224 290 228 195 228C100 228 20 224 20 208C20 182 118 178 114 152C110 132 108 112 106 92C104 52 140 30 150 30Z" fill="${g.finish}" stroke="${g.binding}" stroke-width="3"/>`,
    parts: `<circle cx="190" cy="124" r="30" fill="none" stroke="#F5C542" stroke-width="2"/><circle cx="190" cy="124" r="25" fill="none" stroke="${g.binding}" stroke-width="3"/><circle cx="190" cy="124" r="20" fill="#120c09"/>${rect(146, 178, 90, 12, "#2a1a12", 3)}`,
    bridge: 184
  }),
  solid: g => ({
    shape: `<path d="${sym([195, 52], [[170, 52, 152, 46, 138, 36], [118, 22, 92, 26, 86, 40], [80, 60, 92, 80, 92, 104], [94, 126, 52, 146, 52, 178], [52, 212, 110, 228, 195, 228]])}" fill="${g.finish}" stroke="${g.binding}" stroke-width="3"/>`,
    parts: `${rect(160, 84, 70, 14, "#efe4c8", 3)}${rect(160, 118, 70, 14, "#efe4c8", 3)}${rect(165, 166, 60, 9, "#c4c8d0", 2)}${knob(276, 176, "#F5C542")}${knob(296, 196, "#F5C542")}`,
    bridge: 170
  }),
  hollow: g => ({
    shape: `<path d="${sym([195, 32], [[150, 32, 110, 32, 84, 52], [64, 72, 92, 104, 80, 128], [68, 152, 14, 162, 14, 196], [14, 218, 100, 228, 195, 228]])}" fill="${g.finish}" stroke="${g.binding}" stroke-width="3"/>`,
    parts: `<path d="M112 110C104 124 120 136 112 152C108 162 116 168 114 176M278 110C286 124 270 136 278 152C282 162 274 168 276 176" fill="none" stroke="#1a0c06" stroke-width="4" stroke-linecap="round"/>${rect(165, 70, 60, 15, "#c4c8d0", 3)}${rect(165, 104, 60, 15, "#c4c8d0", 3)}${rect(168, 152, 54, 6, "#2a1a12", 2)}<path d="M170 184H220L210 222H180Z" fill="#F5C542"/>${knob(300, 176, "#F5C542")}${knob(318, 196, "#F5C542")}`,
    bridge: 188
  }),
  single: g => ({
    shape: `<path d="M150 40L240 40C252 54 256 74 276 92C290 104 290 126 292 150C296 176 336 186 336 208C336 224 280 228 195 228C110 228 54 224 54 208C54 186 94 176 98 150C102 120 98 92 100 72C102 48 130 40 150 40Z" fill="${g.finish}" stroke="${g.binding}" stroke-width="3"/>`,
    parts: `${rect(162, 88, 66, 18, "#16171B", 3, `stroke="#efe4c8" stroke-width="2"`)}${rect(162, 124, 66, 18, "#16171B", 3, `stroke="#efe4c8" stroke-width="2"`)}${rect(168, 166, 54, 7, "#c4c8d0", 2)}${rect(172, 178, 46, 7, "#c4c8d0", 2)}${knob(256, 192, "#F5C542")}${knob(280, 198, "#F5C542")}${knob(252, 212, "#F5C542")}${knob(276, 216, "#F5C542")}`,
    bridge: 172
  }),
  classical: g => ({
    shape: `<path d="${sym([195, 30], [[135, 30, 112, 50, 114, 92], [116, 116, 128, 128, 124, 150], [118, 178, 44, 188, 44, 208], [44, 224, 120, 228, 195, 228]])}" fill="${g.finish}" stroke="#3a2418" stroke-width="3"/>`,
    parts: `<circle cx="195" cy="112" r="32" fill="none" stroke="#1f8f8a" stroke-width="4"/><circle cx="195" cy="112" r="27" fill="none" stroke="#b8402a" stroke-width="2"/><circle cx="195" cy="112" r="22" fill="#120c09"/>${rect(140, 176, 110, 14, "#2a1a12", 3)}${rect(148, 181, 94, 5, "#efe4c8", 2)}`,
    bridge: 183
  }),
  swallow: g => ({
    shape: `<path d="${sym([195, 50], [[170, 50, 152, 42, 138, 32], [118, 14, 88, 18, 76, 36], [62, 56, 74, 84, 76, 110], [78, 134, 46, 152, 52, 182], [58, 204, 86, 222, 120, 228], [150, 226, 176, 214, 195, 204]])}" fill="${g.finish}" stroke="${g.binding}" stroke-width="4"/>`,
    parts: `${rect(162, 88, 66, 18, "#16171B", 3, `stroke="#F5C542" stroke-width="2"`)}${rect(162, 124, 66, 18, "#16171B", 3, `stroke="#F5C542" stroke-width="2"`)}${rect(168, 164, 54, 9, "#F5C542", 2)}${knob(254, 184, "#F5C542")}${knob(278, 172, "#F5C542")}`,
    bridge: 168
  })
};

/* The headstock above the nut: its shape, six tuners and the guitar's name. */
function headstock(g) {
  const shapes = {
    plain: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    slot: "M92 90L84 24C84 14 92 8 104 8L286 8C298 8 306 14 306 24L298 90Z",
    book: "M92 90L84 26C84 14 94 8 108 12L195 22L282 12C296 8 306 14 306 26L298 90Z",
    point: "M92 90L80 30L195 4L310 30L298 90Z"
  };
  const tuners = [28, 52, 76].map(y => `<circle cx="68" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="68" cy="${y}" r="9" fill="${g.tuner}"/><circle cx="322" cy="${y + 2}" r="9" fill="#00000055"/><circle cx="322" cy="${y}" r="9" fill="${g.tuner}"/>`).join("");
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
  return `${headstock(g)}<g transform="translate(0 ${y0})">${body.shape}</g>`
    + rect(89, top, 212, lay.neck + 62, g.board) + rect(85, top - 8, 4, lay.neck + 70, g.binding) + rect(301, top - 8, 4, lay.neck + 70, g.binding)
    + rect(85, top - 10, 220, 10, g.binding) + rect(85, top, 220, 3, "#c9b98f")
    + frets + dots + `<g transform="translate(0 ${y0})">${body.parts}</g>`;
}

/* the strings and their shadows, from the nut to the bridge */
function stringLayer(g, lay) {
  const top = FRET_HEAD, bot = top + lay.neck + (BODIES[g.body] || BODIES.parlor)(g).bridge;
  const wd = g.kind === "classical" ? [3.2, 2.8, 2.4, 2, 1.8, 1.6] : g.kind === "electric" ? [3.2, 2.8, 2.4, 2, 1.6, 1.2] : [3.5, 3, 2.5, 2, 1.6, 1.2];
  const col = i => g.kind === "classical" ? (i < 3 ? "#c4c8d0" : "#f3ecdc") : g.kind === "electric" ? "#c4c8d0" : i < 4 ? "#c9a96e" : "#dfe2e8";
  return STR.map((dx, i) => `<line x1="${CX + dx + 3}" y1="${top}" x2="${CX + dx + 3}" y2="${bot}" stroke="#14100d" stroke-opacity=".55" stroke-width="${wd[i]}"/>`).join("")
    + STR.map((dx, i) => `<line x1="${CX + dx}" y1="${top}" x2="${CX + dx}" y2="${bot}" stroke="${col(i)}" stroke-width="${wd[i]}"/>`).join("");
}

/* ---- inlays: one shape, drawn as an empty pocket, set in pearl, or set and lit ---- */
const STAR = c => Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 6.5 : 15, a = -Math.PI / 2 + i * Math.PI / 5; return `${(c + r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`; }).join(" ");
function shape(t, c, cls) {
  const a = `class="${cls}"`;
  if (t === "small") return `<circle ${a} cx="${c}" r="7"/>`;
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
