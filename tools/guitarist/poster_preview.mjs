// The Gig poster guitarist's reference compositor and preview tool. posterSVG(me, opts) puts the ink layers of
// art/guitarist-poster.js together the way art/guitarist-poster/README.md describes; the app's renderer should match it.
// Preview: node tools/guitarist/poster_preview.mjs sheet out.html   (then screenshot the page, e.g. with headless Chrome)
//          node tools/guitarist/poster_preview.mjs all out.html     (every part and every combination check)
import ART from "../../art/guitarist-poster.js";
import fs from "fs";

// the saved values (core/game.js) and their colours (guitarist.js), copied so this tool runs on its own
export const SKIN = ["#FDE1CB", "#F3C6A0", "#DDA57A", "#BF8358", "#93603E", "#63402A"];
export const HAIR_COL = { black: "#1f1a1c", brown: "#5a3622", blonde: "#e8c06a", red: "#c4502a", grey: "#b8b4ae", purple: "#8A47F5", blue: "#3A86FF", pink: "#ff5fa8", green: "#3fcf8e" };
export const OUTFIT_COL = { red: "#e8336e", teal: "#20b8a4", yellow: "#f5c542", white: "#f4f1ea", black: "#26282e", green: "#2f8f5b", blue: "#3a6fd8", orange: "#ff7a1a" };
export const ME_HAIR = ["shag", "curly", "buzz", "mohawk", "braids", "bob", "bun", "swoop", "long", "locs", "pixie", "ponytail", "longhawk"];

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, f) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - f) + y[i] * f)); };
const luma = h => { const [r, g, b] = rgb(h); return .299 * r + .587 * g + .114 * b; };
const INK = ART.inks;
/* an ink's shade (tone 1, printed as halftone dots) and deep shade (tone 2, solid). A dark ink shades toward the paper
   instead (a sheen), so its shading still shows. */
export const shadeOf = c => luma(c) < 70 ? mix(c, INK.paper, .3) : luma(c) > 200 ? mix(c, "#7a6a58", .34) : mix(c, INK.line, .42);
export const deepOf = c => luma(c) < 70 ? mix(c, "#000000", .35) : luma(c) > 200 ? mix(c, "#7a6a58", .22) : mix(c, INK.line, .26);

let N = 0;
/* opts: mood (happy cheer proud sleepy worried), pose (play rest hornsUp), crop (full bust), look (tee flannel vest leather
   stage), size (px wide), flat (no halftone, no misregistration, heavier line; default size <= 48), card (the cream
   poster behind a full figure), spot (override the look's spot ink), guitar (href of the painted guitar for pose play),
   artBase (path to art/ for the grain tile). */
export function posterSVG(me, o = {}) {
  const { mood = "happy", pose: pose0 = "play", crop = "full", look = "tee", size = 160, card = true, guitar = null, artBase = "art/" } = o;
  const id = "gp" + (++N);
  const bust = crop === "bust";
  const pose = bust ? "rest" : pose0;
  const flat = o.flat ?? size <= 48;
  const ink = {
    paper: INK.paper, line: INK.line, amber: INK.amber,
    skin: SKIN[me.skin] ?? SKIN[2], hair: HAIR_COL[me.hairCol] ?? HAIR_COL.brown, top: OUTFIT_COL[me.top] ?? OUTFIT_COL.red,
    hat: OUTFIT_COL[me.extraCol] ?? HAIR_COL[me.extraCol] ?? "#26282e",
    spot: o.spot ?? ART.spot[look] ?? INK.line
  };
  const sleeveInk = ART.sleeveInk[look];
  const reg = flat ? "" : ` transform="translate(${ART.print.misregister.join(" ")})"`;
  const heavy = flat ? ` stroke="${INK.line}" stroke-width="${ART.bust.flatStroke}" stroke-linejoin="round"` : "";
  const layer = ([k, t, d]) => {
    const c = ink[k === "sleeve" ? sleeveInk : k];
    if (k === "line") return `<path d="${d}" fill="${c}" fill-rule="evenodd"${heavy}/>`;
    if (t === 3) return flat ? `<path d="${d}" fill="${c}" fill-opacity=".4" fill-rule="evenodd"/>` : `<path d="${d}" fill="${c}" fill-opacity="${ART.print.stipple.opacity}" fill-rule="evenodd" mask="url(#${id}s)"${reg}/>`;
    if (t === 1) {
      if (flat) return k === "paper" ? "" : `<path d="${d}" fill="${mix(c, shadeOf(c), .55)}" fill-rule="evenodd"${reg}/>`;
      return `<path d="${d}" fill="${k === "paper" ? c : shadeOf(c)}" fill-rule="evenodd" mask="url(#${id}h)"${reg}/>`;
    }
    return `<path d="${d}" fill="${t === 2 ? deepOf(c) : c}" fill-rule="evenodd"${reg}/>`;
  };
  const draw = list => (list || []).map(layer).join("");
  const hair = ART.hair[me.hair] || ART.hair.shag;
  const hatOn = me.extra && me.extra !== "none" && ART.hats[me.extra];
  const hairMask = hatOn ? ` mask="url(#${id}k)"` : "";
  const wear = flat ? "" : ` mask="url(#${id}w)"`;
  const W = s => s ? `<g${wear}>${s}</g>` : "";
  const figure = [
    W(`<g${hairMask}>${draw(hair.back)}</g>${draw(ART.neck)}${draw(ART.looks[look] || ART.looks.tee)}`),
    pose === "play" && guitar ? `<g transform="${ART.guitar.transform}"><image href="${guitar}" ${ART.guitar.box} preserveAspectRatio="xMidYMax meet"/></g>` : "",
    W(draw(ART.arms[pose]) + draw((ART.sleeves[pose] || {})[look]) + draw(ART.head) + draw(ART.faces[mood] || ART.faces.happy) +
      (me.beard && me.beard !== "none" ? draw(ART.beards[me.beard]) : "") + (me.glasses ? draw(ART.glasses) : "") +
      `<g${hairMask}>${draw(hair.front)}</g>` + (hatOn ? draw(ART.hats[me.extra].layers) : ""))
  ].join("");
  const mirror = me.lefty ? ` transform="translate(200 0) scale(-1 1)"` : "";
  const defs = `<defs>
    <pattern id="${id}p" width="${ART.print.halftone.cell}" height="${ART.print.halftone.cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ART.print.halftone.angle})"><rect width="9" height="9" fill="#000"/><circle cx="${ART.print.halftone.cell / 2}" cy="${ART.print.halftone.cell / 2}" r="${ART.print.halftone.dot}" fill="#fff"/></pattern>
    <mask id="${id}h" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"><rect x="-20" y="-20" width="240" height="300" fill="url(#${id}p)"/></mask>
    <pattern id="${id}q" width="${ART.print.stipple.cell}" height="${ART.print.stipple.cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ART.print.stipple.angle})"><rect width="9" height="9" fill="#000"/><circle cx="${ART.print.stipple.cell / 2}" cy="${ART.print.stipple.cell / 2}" r="${ART.print.stipple.dot}" fill="#fff"/></pattern>
    <mask id="${id}s" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"><rect x="-20" y="-20" width="240" height="300" fill="url(#${id}q)"/></mask>
    <pattern id="${id}g" width="${ART.print.grain.tile}" height="${ART.print.grain.tile}" patternUnits="userSpaceOnUse"><image href="${artBase}${ART.print.grain.file}" width="${ART.print.grain.tile}" height="${ART.print.grain.tile}"/></pattern>
    <mask id="${id}w" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"><rect x="-20" y="-20" width="240" height="300" fill="url(#${id}g)"/></mask>
    ${hatOn ? `<mask id="${id}k" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"><rect x="-20" y="-20" width="240" height="300" fill="#fff"/><path d="${ART.hats[me.extra].hides}" fill="#000"/></mask>` : ""}
    ${bust ? `<clipPath id="${id}c"><circle cx="${ART.bust.disc[0]}" cy="${ART.bust.disc[1]}" r="${ART.bust.disc[2]}"/><rect x="30" y="14" width="140" height="${ART.bust.disc[1] - 14}"/></clipPath>` : ""}
  </defs>`;
  let body, vb;
  if (bust) {
    vb = ART.frame.bust;
    const [cx, cy, r] = ART.bust.disc;
    body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK.paper}"/><g clip-path="url(#${id}c)"><g transform="${ART.bust.transform}"><g${mirror}>${figure}</g></g></g><circle cx="${cx}" cy="${cy}" r="${r - .5}" fill="none" stroke="${INK.line}" stroke-opacity=".3" stroke-width="1"/>`;
  } else {
    vb = ART.frame[pose === "hornsUp" ? "hornsUp" : "full"];
    const [x, y, w, h] = vb.split(" ").map(Number);
    const paper = card ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7" fill="${INK.paper}"/><path d="${ART.card.burst}" fill="${ink.spot === INK.line || luma(ink.spot) < 70 ? INK.amber : ink.spot}" opacity=".9"${me.lefty ? ` transform="translate(200 0) scale(-1 1)"` : ""}/><rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7" fill="url(#${id}g)" opacity=".55" style="mix-blend-mode:multiply"/><rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="6.5" fill="none" stroke="${INK.line}" stroke-opacity=".22"/>` : "";
    body = `${paper}<g${mirror}>${figure}</g>`;
  }
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${Math.round(size * vh / vw)}" role="img" aria-label="${o.label || "Your guitarist"}">${defs}${body}</svg>`;
}

// ------------------------------------------------------------------ preview pages
const BG = { dark: "#141210", light: "#F6EFE2" };
export const SIX = [
  { me: { skin: 5, hair: "braids", hairCol: "black", beard: "none", glasses: false, extra: "none", extraCol: "black", top: "teal", lefty: false }, mood: "happy", look: "leather", guitar: "porch" },
  { me: { skin: 1, hair: "mohawk", hairCol: "pink", beard: "stubble", glasses: false, extra: "none", extraCol: "black", top: "black", lefty: false }, mood: "cheer", look: "stage", guitar: "comet" },
  { me: { skin: 2, hair: "curly", hairCol: "brown", beard: "none", glasses: true, extra: "none", extraCol: "black", top: "yellow", lefty: true }, mood: "proud", look: "flannel", guitar: "hollowhill" },
  { me: { skin: 3, hair: "buzz", hairCol: "black", beard: "beard", glasses: false, extra: "cap", extraCol: "red", top: "white", lefty: false }, mood: "worried", look: "vest", guitar: "clubslab" },
  { me: { skin: 0, hair: "long", hairCol: "red", beard: "none", glasses: false, extra: "none", extraCol: "black", top: "blue", lefty: false }, mood: "sleepy", look: "tee", guitar: "swing" },
  { me: { skin: 4, hair: "locs", hairCol: "grey", beard: "moustache", glasses: false, extra: "beanie", extraCol: "orange", top: "green", lefty: false }, mood: "happy", look: "tee", guitar: "koaarc" },
];

function page(body, bg = "#222") {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:${bg};font:600 13px Inter,system-ui,sans-serif;color:#BEB4A4}
.row{display:flex;gap:18px;align-items:flex-end;padding:14px 18px}.cell{display:flex;flex-direction:column;align-items:center;gap:6px}
.band{padding:8px 0}.band h2{margin:0;padding:12px 18px 0;font:700 15px "Space Grotesk",Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase}</style></head><body>${body}</body></html>`;
}

if (process.argv[1] && process.argv[1].endsWith("poster_preview.mjs")) {
  const [, , what = "sheet", out = "poster-preview.html", root = process.cwd() + "/"] = process.argv;
  const g = name => `${root}art/guitars/${name}-small.webp`;
  let html = "";
  const opts = { artBase: root + "art/" };
  if (what === "sheet") {
    for (const look of ["dark", "light"]) {
      const fg = look === "dark" ? "#F6EEE0" : "#1E1914";
      html += `<div class="band" style="background:${BG[look]};color:${fg}"><h2>${look === "dark" ? "Dark look" : "Light look"}</h2><div class="row">`;
      html += SIX.map(s => `<div class="cell">${posterSVG(s.me, { ...opts, mood: s.mood, look: s.look, size: 200, guitar: g(s.guitar) })}<div style="font-size:11px;opacity:.8;text-align:center;line-height:1.35">skin ${s.me.skin + 1} · ${s.me.hair} ${s.me.hairCol}<br>${s.look} ${s.me.top} · ${s.mood}${s.me.lefty ? " · lefty" : ""}${s.me.beard !== "none" ? " · " + s.me.beard : ""}${s.me.glasses ? " · glasses" : ""}${s.me.extra !== "none" ? " · " + s.me.extra : ""}</div></div>`).join("");
      html += `</div><div class="row" style="padding-top:0">`;
      html += SIX.map(s => `<div class="cell" style="width:200px">${posterSVG(s.me, { ...opts, mood: s.mood, look: s.look, crop: "bust", size: 96 })}<div style="font-size:11px;opacity:.7">bust 96 · 44 · 32 px</div><div style="display:flex;gap:10px;align-items:center">${posterSVG(s.me, { ...opts, mood: s.mood, look: s.look, crop: "bust", size: 44 })}${posterSVG(s.me, { ...opts, mood: s.mood, look: s.look, crop: "bust", size: 32 })}</div></div>`).join("");
      html += `</div></div>`;
    }
  } else if (what === "all") {
    const base = SIX[0].me;
    const strip = (title, items) => `<div class="band" style="background:${BG.dark}"><h2>${title}</h2><div class="row" style="flex-wrap:wrap">${items.join("")}</div></div>`;
    html += strip("Hair (13), tee", ME_HAIR.map((h, i) => `<div class="cell">${posterSVG({ ...base, hair: h, skin: i % 6, hairCol: Object.keys(HAIR_COL)[i % 9] }, { ...opts, crop: "bust", size: 120 })}${h}</div>`));
    html += strip("Hair (13), full", ME_HAIR.map((h, i) => `<div class="cell">${posterSVG({ ...base, hair: h, skin: (i + 2) % 6, hairCol: Object.keys(HAIR_COL)[(i + 4) % 9] }, { ...opts, pose: "rest", size: 140 })}${h}</div>`));
    html += strip("Moods", ["happy", "cheer", "proud", "sleepy", "worried"].map(m => `<div class="cell">${posterSVG({ ...base, hair: "bob", skin: 2 }, { ...opts, mood: m, crop: "bust", size: 150 })}${m}</div>`));
    html += strip("Looks, play", ["tee", "flannel", "vest", "leather", "stage"].map((l, i) => `<div class="cell">${posterSVG({ ...base, hair: "shag", skin: i, top: Object.keys(OUTFIT_COL)[i] }, { ...opts, look: l, size: 170, guitar: g(["porch", "comet", "swing", "koaarc", "clubslab"][i]) })}${l}</div>`));
    html += strip("Poses", ["play", "rest", "hornsUp"].map(p => `<div class="cell">${posterSVG({ ...base, hair: "pixie", skin: 3, top: "orange" }, { ...opts, pose: p, size: 170, guitar: g("cornerstone") })}${p}</div>`));
    html += strip("Beards, glasses, hats", [["stubble", false, "none"], ["moustache", false, "none"], ["beard", false, "none"], ["none", true, "none"], ["none", false, "beanie"], ["none", false, "cap"], ["none", false, "bandana"]].map(([b, gl, x], i) => `<div class="cell">${posterSVG({ ...base, hair: ["shag", "swoop", "mohawk", "curly", "long", "ponytail", "locs"][i], beard: b, glasses: gl, extra: x, extraCol: "orange", skin: (i + 1) % 6, hairCol: ["brown", "black", "blonde", "red", "grey", "green", "purple"][i] }, { ...opts, crop: "bust", size: 130 })}${b !== "none" ? b : gl ? "glasses" : x}</div>`));
    html += strip("Skins x hair colours (bust 44 px and 32 px)", SKIN.flatMap((_, s) => Object.keys(HAIR_COL).slice(0, 9).filter((_, j) => (j + s) % 3 === 0).map(hc => `<div class="cell">${posterSVG({ ...base, skin: s, hairCol: hc, hair: ME_HAIR[(s * 3 + hc.length) % 13] }, { ...opts, crop: "bust", size: 44 })}${posterSVG({ ...base, skin: s, hairCol: hc, hair: ME_HAIR[(s * 3 + hc.length) % 13] }, { ...opts, crop: "bust", size: 32 })}</div>`)));
  } else if (what === "combos") {
    // every hair style under every hat, with a beard and glasses on some, and every look in every pose
    const base = { ...SIX[0].me };
    for (const x of ["none", "beanie", "cap", "bandana"]) {
      html += `<div class="row" style="background:${BG.dark};flex-wrap:wrap;gap:6px">` + ME_HAIR.map((h, i) => posterSVG({ ...base, hair: h, extra: x, extraCol: Object.keys(OUTFIT_COL)[i % 8], skin: i % 6, hairCol: Object.keys(HAIR_COL)[i % 9], beard: ["none", "stubble", "moustache", "beard"][i % 4], glasses: i % 3 === 0 }, { ...opts, crop: "bust", size: 100, mood: ["happy", "cheer", "proud", "sleepy", "worried"][i % 5] })).join("") + `</div>`;
    }
    for (const p of ["play", "rest", "hornsUp"]) {
      html += `<div class="row" style="background:${BG.light};flex-wrap:wrap;gap:6px">` + ["tee", "flannel", "vest", "leather", "stage"].map((l, i) => posterSVG({ ...base, hair: ME_HAIR[(i * 3 + p.length) % 13], top: Object.keys(OUTFIT_COL)[(i + 3) % 8], skin: (i + 2) % 6, lefty: i === 2 }, { ...opts, look: l, pose: p, size: 150, guitar: g(["porch", "comet", "swing", "koaarc", "clubslab"][i]) })).join("") + `</div>`;
    }
  } else if (what === "one") {
    html += `<div class="row">${posterSVG(SIX[0].me, { ...opts, size: 600, guitar: g("porch"), card: true })}</div>`;
  }
  fs.writeFileSync(out, page(html));
  console.log("wrote", out);
}
