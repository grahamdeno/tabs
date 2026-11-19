// Your guitarist (Gig poster, 2026-11-19): the player drawn like a screenprinted show poster. Cream paper, black ink
// line, amber ink, one spot ink, halftone shade, a little misregistration and paper grain. The parts are Grok's ink
// layers in art/guitarist-poster.js (how they go together: art/guitarist-poster/README.md); this renderer follows its
// reference compositor, posterSVG in tools/guitarist/poster_preview.mjs. The big looks still come from the Road: the
// top follows the venue, the guitar is the Road guitar you're on (its painted picture), the patches are what you've done.
import { guitarShown, meMood, meOf, patchesOf, rivalMe, roadPath, stageLook, stageLookOf } from "./core.js";
import { guitarPic } from "./fretboard.js";
import ART from "./art/guitarist-poster.js";
import { portraitNow, portraitSVG } from "./portrait.js";
// guitarist(me, { mood, pose, crop, size, look, patches, guitar, label, card, flat, grain }) returns an <svg> string.
//   me: data.me (see meOf in core.js). mood: happy, cheer, worried, sleepy, proud. pose: play, hornsUp, rest.
//   crop: "full" or "bust". look: tee, flannel, vest, leather, stage. patches: [{ kind, color, top }] (patchesOf).
//   guitar: an entry of GUITARS. card: the cream poster behind a full figure. flat: the small print (no halftone, no
//   grain, a heavier line; on by default at 48 px and under). grain: false leaves the paper grain out (a picture drawn
//   into a canvas can't load the grain tile).
let N = 0;

export const SKIN = ["#FDE1CB", "#F3C6A0", "#DDA57A", "#BF8358", "#93603E", "#63402A"];
export const HAIR_COL = { black: "#1f1a1c", brown: "#5a3622", blonde: "#e8c06a", red: "#c4502a", grey: "#b8b4ae", purple: "#8A47F5", blue: "#3A86FF", pink: "#ff5fa8", green: "#3fcf8e" };
export const OUTFIT_COL = { red: "#e8336e", teal: "#20b8a4", yellow: "#f5c542", white: "#f4f1ea", black: "#26282e", green: "#2f8f5b", blue: "#3a6fd8", orange: "#ff7a1a" };

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, f) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - f) + y[i] * f)); };
const luma = h => { const [r, g, b] = rgb(h); return .299 * r + .587 * g + .114 * b; };
const INK = ART.inks;
/* an ink's shade (tone 1, printed as halftone dots) and deep shade (tone 2, solid); a dark ink shades toward the paper */
export const shadeOf = c => luma(c) < 70 ? mix(c, INK.paper, .3) : luma(c) > 200 ? mix(c, "#7a6a58", .34) : mix(c, INK.line, .42);
export const deepOf = c => luma(c) < 70 ? mix(c, "#000000", .35) : luma(c) > 200 ? mix(c, "#7a6a58", .22) : mix(c, INK.line, .26);
const ART_BASE = new URL("./art/", import.meta.url).href;

/* patches for what you've done: a leg headlined (its guitar), a chart win (a star), the rest a pin with its number or word */
/* on the chest of the full-length figure (Grok's second pass, 2026-11-19), drawn at 0.6 so five fit */
const SPOTS = [[113, 97], [122, 110], [111, 112], [127, 125], [113, 128]], PATCH_SCALE = .6;
function patchSVG(pt, x, y) {
  if (pt.kind === "leg") return `<circle cx="${x}" cy="${y + 1.5}" r="11" fill="#00000055"/><circle cx="${x}" cy="${y}" r="11" fill="${pt.color}"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#F5C542" stroke-width="2" stroke-dasharray="2 1.6"/><path d="M${x - 1.5} ${y - 7}h3v7h-3z M${x} ${y + 3}m-5 0a5 4.5 0 1 0 10 0a5 4.5 0 1 0 -10 0" fill="#F5C542"/>`;
  if (pt.kind === "chart") return `<path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="#00000055" transform="translate(0 1.5)"/><path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="${pt.color}"/>`;
  const t = String(pt.top || "").slice(0, 5), w = Math.max(20, 9 + t.length * 6.4);
  return `<rect x="${x - w / 2}" y="${y - 6.5}" width="${w}" height="14" rx="7" fill="#00000055"/><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="14" rx="7" fill="${pt.color}"/><text x="${x}" y="${y + 2.4}" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="9.5" fill="#1c1d22">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
}

export function guitarist(me, { mood = "happy", pose: pose0 = "play", crop = "full", size = 160, look: look0 = "tee", patches = [], guitar: gi = null, label = "Your guitarist", card = false, flat: flat0, grain = true, spot: spot0, headline = "" } = {}) {
  const id = "gp" + (++N), bust = crop === "bust", pose = bust ? "rest" : (ART.arms[pose0] ? pose0 : "play");
  const look = ART.looks[look0] ? look0 : look0 === "denim" ? "vest" : "tee";
  const flat = flat0 ?? size <= 48, useGrain = grain && !flat;
  const ink = {
    paper: INK.paper, line: INK.line, amber: INK.amber,
    skin: SKIN[me.skin] ?? SKIN[2], hair: HAIR_COL[me.hairCol] ?? HAIR_COL.brown, top: OUTFIT_COL[me.top] ?? OUTFIT_COL.red,
    beard: HAIR_COL[me.beardCol] ?? HAIR_COL[me.hairCol] ?? HAIR_COL.brown, /* the beard's own ink (4.98.1); the hair colour unless chosen */
    hat: OUTFIT_COL[me.extraCol] ?? HAIR_COL[me.extraCol] ?? "#26282e", spot: spot0 ?? ART.spot[look] ?? INK.line
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
  const W = s => s ? (useGrain ? `<g mask="url(#${id}w)">${s}</g>` : s) : "";
  const pic = pose === "play" ? guitarPic((gi || {}).body) : null;
  const figure = [
    W(`<g${hairMask}>${draw(hair.back)}</g>${draw(ART.neck)}${draw(ART.looks[look])}`),
    pic ? `<g transform="${ART.guitar.transform}"><image href="${pic}" ${ART.guitar.box} preserveAspectRatio="xMidYMax meet"/></g>` : "",
    W(draw(ART.arms[pose]) + draw((ART.sleeves[pose] || {})[look]) + draw(ART.head) + draw(ART.faces[mood] || ART.faces.happy) +
      (me.beard && me.beard !== "none" && ART.beards[me.beard] ? draw(ART.beards[me.beard]) : "") + (me.glasses ? draw(ART.glasses) : "") +
      `<g${hairMask}>${draw(hair.front)}</g>` + (hatOn ? draw(ART.hats[me.extra].layers) : ""))
  ].join("");
  const mirror = me.lefty ? ` transform="translate(200 0) scale(-1 1)"` : "";
  const box = `maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="300"`, all = `x="-20" y="-20" width="240" height="300"`;
  const { halftone: ht, stipple: st, grain: gr } = ART.print;
  /* the bust is the figure zoomed in, so its dots are scaled back down to keep one dot size on screen (4.98.1) */
  const zoom = bust ? +(/scale\(([\d.]+)\)/.exec(ART.bust.transform)?.[1] || 1) : 1, unzoom = zoom !== 1 ? ` scale(${(1 / zoom).toFixed(4)})` : "";
  /* the grain mask starts white, so the figure shows even before the grain tile has loaded */
  const defs = `<defs>${flat ? "" : `<pattern id="${id}p" width="${ht.cell}" height="${ht.cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(${ht.angle})${unzoom}"><rect width="9" height="9" fill="#000"/><circle cx="${ht.cell / 2}" cy="${ht.cell / 2}" r="${ht.dot}" fill="#fff"/></pattern><mask id="${id}h" ${box}><rect ${all} fill="url(#${id}p)"/></mask><pattern id="${id}q" width="${st.cell}" height="${st.cell}" patternUnits="userSpaceOnUse" patternTransform="rotate(${st.angle})${unzoom}"><rect width="9" height="9" fill="#000"/><circle cx="${st.cell / 2}" cy="${st.cell / 2}" r="${st.dot}" fill="#fff"/></pattern><mask id="${id}s" ${box}><rect ${all} fill="url(#${id}q)"/></mask>`}${useGrain ? `<pattern id="${id}g" width="${gr.tile}" height="${gr.tile}" patternUnits="userSpaceOnUse"><image href="${ART_BASE}${gr.file}" width="${gr.tile}" height="${gr.tile}"/></pattern><mask id="${id}w" ${box}><rect ${all} fill="#fff"/><rect ${all} fill="url(#${id}g)"/></mask>` : ""}${hatOn ? `<mask id="${id}k" ${box}><rect ${all} fill="#fff"/><path d="${ART.hats[me.extra].hides}" fill="#000"/></mask>` : ""}${bust ? `<clipPath id="${id}c"><circle cx="${ART.bust.disc[0]}" cy="${ART.bust.disc[1]}" r="${ART.bust.disc[2]}"/><rect x="30" y="14" width="140" height="${ART.bust.disc[1] - 14}"/></clipPath>` : ""}</defs>`;
  let body, vb;
  if (bust) {
    vb = ART.frame.bust;
    const [cx, cy, r] = ART.bust.disc;
    const pin = (patches || [])[0] ? patchSVG(patches[0], me.lefty ? 78 : 122, 142) : "";
    body = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK.paper}"/><g clip-path="url(#${id}c)"><g transform="${ART.bust.transform}"><g${mirror}>${figure}</g></g></g><circle cx="${cx}" cy="${cy}" r="${r - .5}" fill="none" stroke="${INK.line}" stroke-opacity=".3" stroke-width="1"/>${flat ? "" : pin}`;
  } else {
    /* three (4.99.0): the poster crop, head to mid-thigh with room for a headline, so the face reads big on the maker's card */
    vb = crop === "three" ? "24 -34 152 210" : ART.frame[pose === "hornsUp" ? "hornsUp" : "full"];
    const [x, y, w, h] = vb.split(" ").map(Number);
    const burst = ink.spot === INK.line || luma(ink.spot) < 70 ? INK.amber : ink.spot;
    const paper = card ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7" fill="${INK.paper}"/><path d="${ART.card.burst}" fill="${burst}" opacity=".9"${mirror}/>${useGrain ? `<rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7" fill="url(#${id}g)" opacity=".55" style="mix-blend-mode:multiply"/>` : ""}<rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="6.5" fill="none" stroke="${INK.line}" stroke-opacity=".22"/>` : "";
    const wear = (patches || []).slice(0, pose === "play" ? SPOTS.length : 0).map((pt, i) => { const [px, py] = SPOTS[i]; const x = me.lefty ? 200 - px : px; return `<g transform="translate(${x} ${py}) scale(${PATCH_SCALE}) translate(${-x} ${-py})">${patchSVG(pt, x, py)}</g>`; }).join("");
    const head = card && headline ? `<text x="100" y="-6" text-anchor="middle" font-family="'Space Grotesk', Impact, sans-serif" font-weight="700" font-size="29" letter-spacing="1.5" fill="${INK.line}">${headline.replace(/[<&]/g, "")}</text>` : "";
    const clip = crop === "three" ? `<clipPath id="${id}v"><rect x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="7"/></clipPath>` : "";
    body = crop === "three" ? `${clip}${paper}${head}<g clip-path="url(#${id}v)"><g${mirror}>${figure}</g>${wear}</g>` : `${paper}${head}<g${mirror}>${figure}</g>${wear}`;
  }
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg viewBox="${vb}" width="${size}" height="${Math.round(size * vh / vw)}" role="img" aria-label="${label.replace(/"/g, "&quot;")}" style="overflow:hidden">${defs}${body}</svg>`;
}

/* you, as the app means you: your parts, the look of your venue, the patches you've earned, the Road guitar you're on and
   your mood tonight. o overrides any of the options (mood, pose, crop, size, label). */
export function you(data, o = {}) {
  /* 4.99.0: a portrait made from your selfie stands in for the round portrait and the poster card; the game's poses keep the drawing */
  const p = !o.me && !o.drawn && portraitNow();
  if (p && (o.crop === "bust" || o.portrait)) return portraitSVG(p, { crop: o.crop === "bust" ? "bust" : "full", size: o.size, label: o.label || "Your portrait", headline: o.headline });
  const leg = o.crop === "bust" ? null : roadPath(data).leg;
  return guitarist(o.me || meOf(data), { mood: meMood(data), look: stageLook(data), patches: patchesOf(data), guitar: guitarShown(data, leg?.id), ...o, me: undefined });
}
/* a computer rival, seeded by name, at the look of its tier; decorative (the name is beside it) */
export function rival(name, tier, o = {}) {
  const r = rivalMe(name, tier);
  return guitarist(r, { look: stageLookOf(tier), crop: "bust", ...o, label: name }).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
}
