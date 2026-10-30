// The rough colour input for Nano round 3b: one electric guitar at the Road proportions, our hardware drawn at the
// width of the strings over the traced body. node tools/guitars/input.mjs <leg> out.svg   (single, solid, hollow)
import fs from "fs";
const [leg, out] = process.argv.slice(2);
const t = fs.readFileSync(new URL(`../../art/guitars/${leg}.js`, import.meta.url), "utf8");
const art = JSON.parse(t.slice(t.indexOf("export default ") + 15).replace(/;\s*$/, ""));
const n = art.nums, CX = 270, nutY = 250, endY = 428, W = 430;
const s = W / (n.br - n.bl), hs = 230 / (n.nut + 2), hsx = 258 / (n.hr - n.hl);
const COL = { single: ["#852026", "#6c1b20", "#1c1d22"], hollow: ["#a8431f", "#8a3718", "#1c1d22"], solid: ["#5FC4B0", "#4aa593", "#dcb87e"] }[leg];
const yb = endY + (n.bridge - n.end) * s, zone0 = n.end, zone1 = n.bridge + 45;
const rim = `<path d="${art.sil}" fill="none" stroke="#f1d5a8" stroke-width="10" clip-path="url(#sil)"/>`; /* the binding, drawn again over the cover so the edge stays whole */
const body = `<clipPath id="sil"><path d="${art.sil}"/></clipPath>${art.body}<g clip-path="url(#sil)"><rect x="0" y="${zone0}" width="${n.cx}" height="${zone1 - zone0}" fill="${COL[0]}"/><rect x="${n.cx}" y="${zone0}" width="400" height="${zone1 - zone0}" fill="${COL[1]}"/></g>${rim}`;
const chrome = (x, y, w, h, r) => `<rect x="${x}" y="${y + 2}" width="${w}" height="${h}" rx="${r}" fill="#8e949e"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#cdd2da"/><rect x="${x + r}" y="${y + 1}" width="${w - 2 * r}" height="3" rx="1.5" fill="#f1f3f6"/>`;
const hum = y => `<rect x="${CX - 118}" y="${y - 20}" width="236" height="42" rx="9" fill="#1c1d22"/><rect x="${CX - 108}" y="${y - 14}" width="216" height="13" rx="4" fill="#efe4c8"/><rect x="${CX - 108}" y="${y + 1}" width="216" height="13" rx="4" fill="#efe4c8"/>` + [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${CX - 80 + i * 32}" cy="${y - 7}" r="3.5" fill="#8e949e"/><circle cx="${CX - 80 + i * 32}" cy="${y + 7}" r="3.5" fill="#8e949e"/>`).join("");
const knob = (x, y) => `<circle cx="${x}" cy="${y + 4}" r="17" fill="#b9ab8a"/><circle cx="${x}" cy="${y}" r="17" fill="#efe4c8"/><circle cx="${x}" cy="${y - 1}" r="11" fill="#f8f1de"/>`;
const hw = hum(yb - 110) + hum(yb - 52) + chrome(CX - 100, yb - 8, 200, 16, 6) + chrome(CX - 90, yb + 24, 180, 16, 8)
  + knob(CX + 150, yb - 20) + knob(CX + 178, yb + 24) + knob(CX + 130, yb + 62) + knob(CX + 160, yb + 100);
const neck = `<polygon points="${CX - 97},${nutY - 8} ${CX + 97},${nutY - 8} ${CX + 111},${endY} ${CX - 111},${endY}" fill="#e9dcbc"/><polygon points="${CX - 92},${nutY} ${CX + 92},${nutY} ${CX + 106},${endY} ${CX - 106},${endY}" fill="#241f1d"/><polygon points="${CX},${nutY} ${CX + 92},${nutY} ${CX + 106},${endY} ${CX},${endY}" fill="#000" opacity=".14"/><rect x="${CX - 97}" y="${nutY - 10}" width="194" height="10" fill="#e9dcbc"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" width="1080" height="1920"><rect width="540" height="960" fill="#fff"/>
<g transform="translate(${CX - n.cx * s} ${endY - n.end * s}) scale(${s})">${body}</g>
<g transform="translate(${CX - (n.l0 + n.r0) / 2 * hsx} ${nutY - n.nut * hs}) scale(${hsx} ${hs})">${art.head}</g>${neck}${hw}<circle cx="${CX}" cy="905" r="9" fill="#cdd2da"/></svg>`;
fs.writeFileSync(out, svg);
