// Your guitarist: the player drawn in Louie's style (flat colour, a darker right side, round eyes with a glint,
// mitten hands, the same moods), built from parts. The big looks come from the Road: the top follows the venue
// (tee, vest, leather, stage jacket), the guitar is the Road guitar you're on, the patches are what you've done.
import { guitarFor, meMood, meOf, patchesOf, rivalMe, roadPath, stageLook, stageLookOf } from "./core.js";
import { nanoSmall } from "./fretboard.js";
import { mittenOf } from "./louie.js";
import ART from "./art/guitarist.js";
// guitarist(me, { mood, pose, crop, size, look, patches, guitar, label }) returns an <svg> string.
//   me: data.me (see meOf in core.js). mood: happy, cheer, worried, sleepy, proud. pose: play, hornsUp, rest.
//   crop: "full" or "bust". look: tee, vest, leather, stage. patches: [{ kind, color, top }] (patchesOf).
//   guitar: an entry of GUITARS. Drawn from docs/guitarist/mock-guitarist.mjs.
const shade = (hex, f) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("");
const mix = (hex, to, f) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f) + parseInt(to.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
let N = 0;

export const SKIN = ["#FDE1CB", "#F3C6A0", "#DDA57A", "#BF8358", "#93603E", "#63402A"];
export const HAIR_COL = { black: "#1f1a1c", brown: "#5a3622", blonde: "#e8c06a", red: "#c4502a", grey: "#b8b4ae", purple: "#8A47F5", blue: "#3A86FF", pink: "#ff5fa8", green: "#3fcf8e" };
export const OUTFIT_COL = { red: "#e8336e", teal: "#20b8a4", yellow: "#f5c542", white: "#f4f1ea", black: "#26282e", green: "#2f8f5b", blue: "#3a6fd8", orange: "#ff7a1a" };

/* 4.86.0: the head and the hair are traced from Gemini's pictures (art/guitarist.js, tools/guitarist). Hair is three parts:
   behind the head, falling over the body, and over the head; each is the hair colour with its darker tones laid on it. */
const tone = (c, t) => t === 0 ? c : shade(c, t === 1 ? .84 : .66);
const parts = (list, c) => (list || []).map(([t, d]) => `<path d="${d}" fill="${tone(c, t)}" fill-rule="evenodd"/>`).join("");
const hairOf = (name, c) => { const h = ART.hair[name] || ART.hair.shag; return [parts(h[0], c), parts(h[1], c), parts(h[2], c)]; };
/* extras over the head */
const EXTRA = {
  none: () => "",
  glasses: () => `<g fill="rgba(255,255,255,.12)" stroke="#1c1d22" stroke-width="5"><circle cx="81" cy="88" r="15"/><circle cx="119" cy="88" r="15"/></g><path d="M96 86h8" stroke="#1c1d22" stroke-width="5"/>`,
  beanie: c => `<path d="M48 72C48 30 74 16 100 16C126 16 152 30 152 72Z" fill="${c}"/><path d="M100 16C126 16 152 30 152 72H120C122 44 114 24 100 16Z" fill="${shade(c, .82)}"/><rect x="44" y="60" width="112" height="18" rx="9" fill="${shade(c, .75)}"/>${[56, 68, 80, 92, 104, 116, 128, 140].map(x => `<rect x="${x}" y="63" width="4" height="12" rx="2" fill="${shade(c, .6)}"/>`).join("")}<circle cx="100" cy="14" r="10" fill="${mix(c, "#ffffff", .5)}"/>`,
  bandana: c => `<path d="M50 62Q100 44 150 62V74Q100 56 50 74Z" fill="${c}"/><path d="M146 64L166 54L162 72Z" fill="${shade(c, .8)}"/><path d="M146 68L168 78L156 84Z" fill="${shade(c, .8)}"/>${[70, 90, 110, 130].map(x => `<circle cx="${x}" cy="${60 - Math.abs(x - 100) * -.06}" r="2.2" fill="#fff" opacity=".8"/>`).join("")}`,
  cap: c => `<path d="M52 66C52 32 76 20 100 20C124 20 148 32 148 66Z" fill="${c}"/><path d="M100 20C124 20 148 32 148 66H118C120 40 112 26 100 20Z" fill="${shade(c, .82)}"/><rect x="84" y="56" width="32" height="10" rx="4" fill="${shade(c, .6)}"/><circle cx="100" cy="21" r="4" fill="${shade(c, .7)}"/>`
};
/* the top: [torso, sleeve colour] */
function outfit(o, c, skin, id) {
  const torso = "M34 252C34 178 60 150 100 150C140 150 166 178 166 252Z";
  const clip = `<clipPath id="t${id}"><path d="${torso}"/></clipPath>`;
  const right = `<path d="M128 150C150 160 166 184 166 252H138Z" fill="#000" opacity=".14" clip-path="url(#t${id})"/>`;
  /* the arena look: a black stage jacket, gold trim, studs on the shoulders */
  if (o === "stage") return { sleeve: "#1c1d22", svg: `${clip}<path d="${torso}" fill="#1c1d22"/><path d="M86 150L100 252L114 150Z" fill="${c}"/><path d="M78 152L98 196L88 252H70L76 186L64 166Z" fill="#2a2d33"/><path d="M122 152L102 196L112 252H130L124 186L136 166Z" fill="#16171B"/><path d="M78 152L98 196L88 252M122 152L102 196L112 252" fill="none" stroke="#F5C542" stroke-width="3"/>${[[50, 172], [58, 164], [66, 158], [134, 158], [142, 164], [150, 172]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#cdd2da"/>`).join("")}${right}` };
  if (o === "tee" || o === "flannel_unused") return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/>${right}<path d="M84 150Q100 170 116 150Z" fill="${skin}"/>` };
  if (o === "flannel") return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/><g clip-path="url(#t${id})" opacity=".55">${[40, 66, 92, 118, 144].map(x => `<rect x="${x}" y="150" width="10" height="102" fill="${shade(c, .6)}"/>`).join("")}${[164, 190, 216, 242].map(y => `<rect x="30" y="${y}" width="140" height="9" fill="${shade(c, .6)}"/>`).join("")}${[52, 104, 156].map(x => `<rect x="${x}" y="150" width="3" height="102" fill="#fff" opacity=".5"/>`).join("")}</g>${right}<path d="M84 150L100 176L116 150Z" fill="#26282e"/><path d="M80 150L94 176L100 162Z M120 150L106 176L100 162Z" fill="${shade(c, .75)}"/>` };
  if (o === "leather") return { sleeve: "#26282e", svg: `${clip}<path d="${torso}" fill="#26282e"/><path d="M86 150L100 252L114 150Z" fill="${c}"/><path d="M78 152L98 196L88 252H70L76 186L64 166Z" fill="#33363d"/><path d="M122 152L102 196L112 252H130L124 186L136 166Z" fill="#1c1d22"/>${right}<rect x="60" y="200" width="16" height="3" rx="1.5" fill="#cdd2da"/><circle cx="124" cy="174" r="3" fill="#cdd2da"/>` };
  return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/><path d="M34 252C34 178 60 150 88 152L92 252Z" fill="#3a6fd8"/><path d="M166 252C166 178 140 150 112 152L108 252Z" fill="#2f5bb8"/>${right}<path d="M88 152L92 252M112 152L108 252" stroke="#f5c542" stroke-width="2" stroke-dasharray="4 3"/><circle cx="70" cy="190" r="6" fill="#f5c542"/><circle cx="70" cy="190" r="3" fill="#ff5fa8"/>` };
}
/* the Road guitar in your hands, small: its finish and shape family (acoustic with a soundhole, classical, solid-body,
   hollow with f-holes, single cut, the headliner with a gold edge) */
function guitar(g) {
  const sm = nanoSmall(g.body);
  if (sm) return nanoGuitar(g, sm);
  const body = g.finish, dk = shade(body, .6), bind = g.binding || "#e9dcbc", fam = g.body;
  const neck = `<rect x="79" y="88" width="10" height="100" rx="3" fill="${g.board}"/>${[104, 120, 136, 152].map(y => `<rect x="79" y="${y}" width="10" height="2" fill="#cdd2da"/>`).join("")}<path d="M76 82h16l2 -18h-20z" fill="${g.headc}"/><circle cx="77" cy="70" r="2" fill="${g.tuner}"/><circle cx="91" cy="70" r="2" fill="${g.tuner}"/>`;
  const round = (stroke) => `<ellipse cx="84" cy="216" rx="31" ry="26" fill="${dk}"/><ellipse cx="84" cy="190" rx="23" ry="21" fill="${dk}"/><ellipse cx="84" cy="212" rx="31" ry="26" fill="${body}"${stroke}/><ellipse cx="84" cy="186" rx="23" ry="21" fill="${body}"${stroke}/><ellipse cx="84" cy="186" rx="21.5" ry="19.5" fill="${body}"/>`;
  const cut = "M62 192C62 176 70 168 75 172C78 158 90 158 93 172C98 168 106 176 106 192C112 202 108 220 98 228C92 238 76 238 70 228C60 220 56 202 62 192Z";
  let shape;
  if (fam === "solid" || fam === "single") shape = `<path d="${cut}" transform="translate(0 4)" fill="${dk}"/><path d="${cut}" fill="${body}"/><path d="M62 192C62 176 70 168 75 172" fill="none" stroke="${bind}" stroke-width="1.6"/><rect x="72" y="194" width="24" height="7" rx="2" fill="${fam === "single" ? "#F5C542" : "#efe4c8"}"/><rect x="72" y="207" width="24" height="7" rx="2" fill="${fam === "single" ? "#F5C542" : "#efe4c8"}"/><circle cx="102" cy="224" r="3.5" fill="#cdd2da"/>`;
  else if (fam === "swallow") shape = `<path d="M62 186C64 174 76 168 84 172C92 168 104 174 106 186C110 204 104 224 96 242L84 230L72 242C64 224 58 204 62 186Z" transform="translate(0 4)" fill="${dk}"/><path d="M62 186C64 174 76 168 84 172C92 168 104 174 106 186C110 204 104 224 96 242L84 230L72 242C64 224 58 204 62 186Z" fill="${body}" stroke="${bind}" stroke-width="2.5"/><rect x="72" y="194" width="24" height="7" rx="2" fill="#F5C542"/><rect x="72" y="207" width="24" height="7" rx="2" fill="#F5C542"/>`;
  else if (fam === "hollow") shape = `${round(` stroke="${bind}" stroke-width="2.5"`)}<path d="M68 198q-3 12 2 20M100 198q3 12 -2 20" fill="none" stroke="#120c09" stroke-width="3.4" stroke-linecap="round"/><rect x="72" y="224" width="24" height="5" rx="2" fill="#2a1a12"/>`;
  else if (fam === "classical") shape = `${round("")}<circle cx="84" cy="196" r="9" fill="#120c09"/><circle cx="84" cy="196" r="11.5" fill="none" stroke="${shade(body, .7)}" stroke-width="2.2"/><rect x="72" y="218" width="24" height="5" rx="2" fill="#2a1a12"/>`;
  else shape = `${round("")}<circle cx="84" cy="196" r="9" fill="#120c09"/><rect x="70" y="216" width="28" height="5" rx="2" fill="#2a1a12"/>${fam === "cutaway" ? `<path d="M96 172Q104 176 106 184" fill="none" stroke="${bind}" stroke-width="2"/>` : ""}`;
  return `<g transform="translate(6 -14) rotate(48 84 196)">${neck}${shape}<path d="M84 188V222" stroke="#e9e3d6" stroke-width="1.2"/></g>`;
}
/* 4.86.0: the Nano art in miniature: the traced head and body from art/guitars with a plain neck between, held the same way */
function nanoGuitar({ board, body: fam }, { art, n }) {
  const k = 176 / n.h, bw = (n.br - n.bl) * .22, pk = y => `<rect x="${n.cx - bw / 2}" y="${y}" width="${bw}" height="${(16).toFixed(0)}" rx="5" fill="#1c1d22"/>`;
  const parts = fam === "solid" ? pk(n.bridge - 150) + pk(n.bridge - 100) : fam === "swallow" ? pk(n.bridge - 120) + pk(n.bridge - 70) : fam === "hollow" || fam === "single" ? pk(n.bridge - 110) + pk(n.bridge - 60) : "";
  return `<g transform="translate(6 -14) rotate(48 84 196)"><g transform="translate(${(84 - n.cx * k).toFixed(2)} 64) scale(${k.toFixed(4)})">${art.head}<rect x="${n.l0}" y="${n.nut - 4}" width="${n.r0 - n.l0}" height="${n.end - n.nut + 12}" fill="${board}"/>${art.body}${parts}</g></g>`;
}
const mit = (name, x, y, r, skin, sleeve) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(.8)">${mittenOf(name, skin, shade(skin, .78), shade(skin, .6), sleeve)}</g>`;
const hand = (x, y, skin, sleeve) => mit("fist", x, y + 10, 0, skin, sleeve);
const horns = (x, y, r, skin, sleeve) => mit("horns", x, y + 4, r, skin, sleeve);

const FALLBACK_GUITAR = { body: "parlor", finish: "#8a6a4a", board: "#4a3328", headc: "#3a2a22", binding: "#efe4c8", tuner: "#efe4c8" };
const BEARD = {
  stubble: (c, a) => `<path d="M58 98C60 128 78 140 100 140C122 140 140 128 142 98C132 114 122 124 100 124C78 124 68 114 58 98Z" fill="${c}" opacity=".32"/>`,
  moustache: c => `<path d="M80 104Q90 96 100 102Q110 96 120 104Q110 109 100 106Q90 109 80 104Z" fill="${c}"/>`,
  beard: c => `<path d="M56 96C58 128 78 140 100 140C122 140 142 128 144 96C134 112 124 120 100 120C76 120 66 112 56 96Z" fill="${c}"/><path d="M84 104Q100 98 116 104Q100 108 84 104Z" fill="${c}"/>`
};
/* patches for what you've done: a leg headlined (its guitar), a chart win (a star), the rest a pin with its number or word */
const SPOTS = [[124, 178], [140, 198], [120, 202], [146, 222], [124, 228]];
function patchSVG(pt, x, y) {
  if (pt.kind === "leg") return `<circle cx="${x}" cy="${y + 1.5}" r="11" fill="#00000055"/><circle cx="${x}" cy="${y}" r="11" fill="${pt.color}"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#F5C542" stroke-width="2" stroke-dasharray="2 1.6"/><path d="M${x - 1.5} ${y - 7}h3v7h-3z M${x} ${y + 3}m-5 0a5 4.5 0 1 0 10 0a5 4.5 0 1 0 -10 0" fill="#F5C542"/>`;
  if (pt.kind === "chart") return `<path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="#00000055" transform="translate(0 1.5)"/><path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="${pt.color}"/>`;
  const t = String(pt.top || "").slice(0, 5), w = Math.max(20, 9 + t.length * 6.4);
  return `<rect x="${x - w / 2}" y="${y - 6.5}" width="${w}" height="14" rx="7" fill="#00000055"/><rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="14" rx="7" fill="${pt.color}"/><text x="${x}" y="${y + 2.4}" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="9.5" fill="#1c1d22">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
}

export function guitarist(me, { mood = "happy", pose = "play", crop = "full", size = 160, look = "tee", patches = [], guitar: gi = null, label = "Your guitarist" } = {}) {
  const id = ++N, skin = SKIN[me.skin] || SKIN[2], hc = HAIR_COL[me.hairCol] || HAIR_COL.brown, [hBack, hFall, hFront] = hairOf(me.hair, hc), dark = shade(skin, .88);
  const top = outfit(look === "vest" ? "denim" : look, OUTFIT_COL[me.top] || OUTFIT_COL.red, skin, id);
  const cheer = mood === "cheer" || mood === "proud", worried = mood === "worried", sleepy = mood === "sleepy";
  const eye = x => sleepy ? `<ellipse cx="${x}" cy="88" rx="10" ry="12" fill="#fff"/><circle cx="${x + 1}" cy="93" r="5.5" fill="#1c1d22"/><path d="M${x - 11} 89A11 13 0 0 1 ${x + 11} 89Z" fill="${shade(skin, .92)}"/><path d="M${x - 10} 89Q${x} 93 ${x + 10} 89" fill="none" stroke="#1c1d22" stroke-width="2.4" stroke-linecap="round"/>` : cheer ? `<path d="M${x - 9} 90Q${x} 76 ${x + 9} 90Q${x} 84 ${x - 9} 90Z" fill="#1c1d22"/>`
    : `<ellipse cx="${x}" cy="88" rx="10" ry="12" fill="#fff"/><circle cx="${x + (worried ? -1 : 2)}" cy="${worried ? 91 : 90}" r="6" fill="#1c1d22"/><circle cx="${x + (worried ? 1 : 4)}" cy="${worried ? 88 : 87}" r="2.2" fill="#fff"/>`;
  const brows = cheer ? "" : worried ? `<path d="M70 70l20 5" stroke="${shade(hc, .9)}" stroke-width="5" stroke-linecap="round"/><path d="M130 70l-20 5" stroke="${shade(hc, .9)}" stroke-width="5" stroke-linecap="round"/>`
    : `<rect x="70" y="70" width="20" height="5" rx="2.5" fill="${shade(hc, .9)}" transform="rotate(-5 80 72)"/><rect x="110" y="70" width="20" height="5" rx="2.5" fill="${shade(hc, .9)}" transform="rotate(5 120 72)"/>`;
  const mouth = sleepy ? `<path d="M90 112Q100 116 110 112" fill="none" stroke="#7a1f2e" stroke-width="4" stroke-linecap="round"/><text x="150" y="44" font-family="system-ui" font-weight="900" font-size="22" fill="#9fb4ff">z</text><text x="164" y="28" font-family="system-ui" font-weight="900" font-size="15" fill="#9fb4ff">z</text>` : cheer ? `<path d="M84 106Q100 132 116 106Z" fill="#7a1f2e"/><ellipse cx="100" cy="119" rx="8" ry="4" fill="#ff7a8a"/>`
    : worried ? `<path d="M88 116Q100 106 112 116Q100 112 88 116Z" fill="#7a1f2e"/>`
      : `<path d="M86 108Q100 124 114 108Z" fill="#7a1f2e"/><path d="M93 116Q100 120 107 116Q100 113 93 116Z" fill="#ff7a8a"/>`;
  const beard = BEARD[me.beard] ? BEARD[me.beard](hc) : "";
  const head = `<path d="${ART.head.sil}" fill="${dark}"/><path d="${ART.head.lit}" fill="${skin}"/><path d="${ART.head.line}" fill="${shade(skin, .76)}"/>
    <ellipse cx="70" cy="104" rx="7" ry="4" fill="#ff7a7a" opacity=".35"/><ellipse cx="130" cy="104" rx="7" ry="4" fill="#ff7a7a" opacity=".3"/>`;
  const g = gi || FALLBACK_GUITAR;
  const sleeve = top.sleeve;
  const mirror = me.lefty ? ` transform="translate(200 0) scale(-1 1)"` : "";
  let arms = "";
  if (pose === "play") arms = `<path d="M54 178Q62 200 94 198" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(96, 196, skin, sleeve)}<path d="M150 176Q166 160 160 142" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(158, 138, skin, sleeve)}`;
  else if (pose === "hornsUp") arms = `<path d="M50 172Q22 140 22 104" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${horns(22, 100, -18, skin, sleeve)}<path d="M150 172Q178 140 178 104" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${horns(178, 100, 18, skin, sleeve)}`;
  else arms = `<path d="M54 178Q50 210 58 236" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(58, 240, skin, sleeve)}<path d="M146 178Q150 210 142 236" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(142, 240, skin, sleeve)}`;
  const wear = (patches || []).slice(0, pose === "play" ? SPOTS.length : 0).map((pt, i) => { const [x, y] = SPOTS[i]; return patchSVG(pt, me.lefty ? 200 - x : x, y); }).join("");
  const figure = `<g${mirror}><rect x="88" y="128" width="24" height="28" fill="${dark}"/>${top.svg}${pose === "play" ? guitar(g) : ""}${arms}</g>${wear}`;
  const bust = (patches || [])[0] ? patchSVG(patches[0], me.lefty ? 78 : 122, 142) : "";
  const vb = crop === "bust" ? "30 14 140 150" : pose === "hornsUp" ? "-4 0 208 252" : "16 0 168 252";
  const [, , vw, vh] = vb.split(" ").map(Number);
  const hat = me.extra && me.extra !== "none" && EXTRA[me.extra] ? EXTRA[me.extra](OUTFIT_COL[me.extraCol] || HAIR_COL[me.extraCol] || "#26282e") : "";
  const specs = me.glasses ? EXTRA.glasses() : "";
  return `<svg viewBox="${vb}" width="${size}" height="${(size * vh / vw).toFixed(0)}" role="img" aria-label="${label.replace(/"/g, "&quot;")}" style="overflow:hidden">${hBack}${crop === "bust" ? `<rect x="88" y="128" width="24" height="28" fill="${dark}"/><g${mirror}>${top.svg}</g>${bust}` : figure}${head}${hFall}${beard}${eye(81)}${eye(119)}${brows}${mouth}${specs}${hFront}${hat}</svg>`;
}

/* you, as the app means you: your parts, the look of your venue, the patches you've earned, the Road guitar you're on and
   your mood tonight. o overrides any of the options (mood, pose, crop, size, label). */
export function you(data, o = {}) {
  const leg = o.crop === "bust" ? null : roadPath(data).leg;
  return guitarist(o.me || meOf(data), { mood: meMood(data), look: stageLook(data), patches: patchesOf(data), guitar: guitarFor(leg?.id), ...o, me: undefined });
}
/* a computer rival, seeded by name, at the look of its tier; decorative (the name is beside it) */
export function rival(name, tier, o = {}) {
  const r = rivalMe(name, tier);
  return guitarist(r, { look: stageLookOf(tier), crop: "bust", ...o, label: name }).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
}
