// The rough colour input for Nano round 3b: one guitar from its traced art, at the Road proportions (the body 430 of
// 540 wide, the head 230 tall and widened to about 258, a wide neck). Gemini cleans it; only the head and body are kept.
// node tools/guitars/input.mjs <art name> out.svg
import fs from "fs";
const [name, out] = process.argv.slice(2);
const t = fs.readFileSync(new URL(`../../art/guitars/${name}.js`, import.meta.url), "utf8");
const art = JSON.parse(t.slice(t.indexOf("export default ") + 15).replace(/;\s*$/, ""));
const NECKC = { parlor: ["#4a3328", "#efe4c8"], solid: ["#dcb87e", "#e9dcbc"], hollow: ["#241f1d", "#e9dcbc"], classical: ["#4a3328", "#efe4c8"], headliner: ["#1c1a1f", "#F5C542"] }[name];
const n = art.nums, CX = 270, nutY = 250, endY = 428;
const s = 430 / (n.br - n.bl), hs = 230 / (n.nut + 2), hsx = 258 / (n.hr - n.hl);
const neck = `<polygon points="${CX - 97},${nutY - 8} ${CX + 97},${nutY - 8} ${CX + 111},${endY} ${CX - 111},${endY}" fill="${NECKC[1]}"/><polygon points="${CX - 92},${nutY} ${CX + 92},${nutY} ${CX + 106},${endY} ${CX - 106},${endY}" fill="${NECKC[0]}"/><polygon points="${CX},${nutY} ${CX + 92},${nutY} ${CX + 106},${endY} ${CX},${endY}" fill="#000" opacity=".14"/><rect x="${CX - 97}" y="${nutY - 10}" width="194" height="10" fill="${NECKC[1]}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 960" width="1080" height="1920"><rect width="540" height="960" fill="#fff"/>
<g transform="translate(${CX - n.cx * s} ${endY - n.end * s}) scale(${s})">${art.body}</g>
<g transform="translate(${CX - (n.l0 + n.r0) / 2 * hsx} ${nutY - n.nut * hs}) scale(${hsx} ${hs})">${art.head}</g>${neck}</svg>`;
fs.writeFileSync(out, svg);
