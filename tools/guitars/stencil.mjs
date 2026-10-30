// The shape guide for Nano round 3: a flat grey stencil of the cutaway at the Road proportions. node tools/guitars/stencil.mjs out.svg
import fs from "fs";
const t = fs.readFileSync(new URL("../../art/guitars/cutaway.js", import.meta.url), "utf8");
const art = JSON.parse(t.slice(t.indexOf("export default ") + 15).replace(/;\s*$/, ""));
const n = art.nums;
const lum = h => { const [r, g, b] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); return .3 * r + .59 * g + .11 * b; };
const map = { "#753b1c": "#b9b9b9", "#623217": "#9d9d9d", "#e7d7b2": "#ececec", "#3d2319": "#4a4a4a", "#4c2314": "#7a7a7a" };
const recolor = (s, f) => s.replace(/fill="(#\w+)"/g, (m, c) => { const v = f(c); return v ? `fill="${v}"` : 'fill="none"'; });
const CX = 270, nutY = 250, endY = 428, s = 1.59, hs = 1.6, hsx = 2.43;
const head = recolor(art.head, c => lum(c) > 150 ? "#e4e4e4" : "#7d7d7d");
const body = recolor(art.body, c => map[c.toLowerCase()] || null);
const nw0 = 184, nw1 = 212;
const neck = `<polygon points="${CX - nw0 / 2 - 5},${nutY - 8} ${CX + nw0 / 2 + 5},${nutY - 8} ${CX + nw1 / 2 + 5},${endY} ${CX - nw1 / 2 - 5},${endY}" fill="#ececec"/><polygon points="${CX - nw0 / 2},${nutY} ${CX + nw0 / 2},${nutY} ${CX + nw1 / 2},${endY} ${CX - nw1 / 2},${endY}" fill="#6b6b6b"/><rect x="${CX - nw0 / 2 - 5}" y="${nutY - 10}" width="${nw0 + 10}" height="10" fill="#ececec"/>`;
const yb = 633;
const bridge = `<rect x="${CX - 108}" y="${yb - 18}" width="216" height="38" rx="14" fill="#4a4a4a"/><rect x="${CX - 80}" y="${yb - 12}" width="160" height="7" rx="3" fill="#ececec"/>` + [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${CX - 62.5 + i * 25}" cy="${yb + 8}" r="5" fill="#ececec"/>`).join("");
const fix = `<rect x="${CX - 112}" y="${yb - 22}" width="112" height="60" fill="#b9b9b9"/><rect x="${CX}" y="${yb - 22}" width="112" height="60" fill="#9d9d9d"/>`;
const hole = `<circle cx="${CX}" cy="487" r="58" fill="#ececec"/><circle cx="${CX}" cy="487" r="50" fill="#4a4a4a"/>`;
const strap = `<circle cx="${CX}" cy="872" r="8" fill="#4a4a4a"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" width="1080" height="1920"><rect width="540" height="960" fill="#fff"/>
<g transform="translate(${CX - n.cx * s} ${endY - n.end * s}) scale(${s})">${body}</g>
<g transform="translate(${CX - (n.l0 + n.r0) / 2 * hsx} ${nutY - n.nut * hs}) scale(${hsx} ${hs})">${head}</g>${hole}${neck}${fix}${bridge}${strap}</svg>`;
fs.writeFileSync(process.argv[2], svg);
