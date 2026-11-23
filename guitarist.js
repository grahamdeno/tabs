// Your guitarist (2026-11-20, Graham's pick B): flat cartoon parts with a dark ink outline, like the line around Louie.
// Drawn in code on one 400 x 400 grid, back to front: stage, back hair, body, top, strap, guitar, arms, head, face, beard,
// front hair, glasses, hat, patches. The parts follow Graham's avatar kit (docs/guitarist-ink/PLAN.md). The big looks still
// come from the Road: the top follows the venue, the guitar is the Road guitar you're on (its painted picture), the
// patches are what you've done.
import { ME_GENRE, meMood, meOf, stageLook, stageLookOf } from "./core.js";
import { guitarPic } from "./fretboard.js";
import { portraitNow, portraitSVG } from "./portrait.js";
// guitarist(me, { mood, pose, crop, size, look, patches, guitar, label, card, headline }) returns an <svg> string.
//   me: data.me (see meOf in core.js). mood: happy, cheer, worried, sleepy, proud. pose: play, hornsUp, rest.
//   crop: "full", "three" (the maker's card, room for a headline), "bust" (head and shoulders in a disc, for small
//   sizes) or "face" (the bust, closer in). look: tee, flannel, vest, leather, stage. patches: [{ kind, color, top }] (patchesOf). guitar: an entry of
//   GUITARS. card: the stage backdrop behind a full figure. flat and grain are accepted and ignored (the Gig poster had them).
let N = 0;

/* skin, in the order the maker shows them (lightest to deepest); the stored number is the index here, and 0-5 are the
   six tones from before 2026-11-20, so a saved guitarist keeps its tone */
export const SKIN = ["#FDE1CB", "#F3C6A0", "#DDA57A", "#BF8358", "#93603E", "#63402A", "#4E301F", "#3B2216", "#A8714A"];
export const SKIN_ORDER = [0, 1, 2, 3, 8, 4, 5, 6, 7];
export const HAIR_COL = { black: "#1f1a1c", brown: "#5a3622", blonde: "#e8c06a", red: "#c4502a", grey: "#b8b4ae", purple: "#8A47F5", blue: "#3A86FF", pink: "#ff5fa8", green: "#3fcf8e" };
export const OUTFIT_COL = { red: "#e8336e", teal: "#20b8a4", yellow: "#f5c542", white: "#f4f1ea", black: "#26282e", green: "#2f8f5b", blue: "#3a6fd8", orange: "#ff7a1a" };
export const EYE_COL = { brown: "#4A2E1B", hazel: "#6E5D28", blue: "#2B6CB0", green: "#277A58", grey: "#6C757D", amber: "#B87314" };
const LINE = "#24160E", WHITE = "#FFFFFF", DARK = "#18120E";
/* the stage behind the card and the small disc, by venue look: [back, beam, glow] */
const STAGE = { tee: ["#241914", "#3B2316", "#FF9A3C"], flannel: ["#14211B", "#1E362B", "#E89B3C"], vest: ["#131A29", "#1E2C47", "#3898EC"], leather: ["#261419", "#3D1C26", "#E0486B"], stage: ["#1C1410", "#33220F", "#FFB547"] };
const SPOT = { tee: "#FFB547", flannel: "#FFB547", vest: "#46689E", leather: "#2A2522", stage: "#1E1A18" };

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, f) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v * (1 - f) + y[i] * f)); };
const luma = h => { const [r, g, b] = rgb(h); return .299 * r + .587 * g + .114 * b; };
/* one shade per ink: darker for most, toward the paper for very dark inks */
export const shadeOf = c => luma(c) < 50 ? mix(c, "#FFFFFF", .12) : mix(c, "#2a1408", .26);
export const lightOf = c => mix(c, "#FFFFFF", luma(c) > 200 ? .5 : .22);

/* ---------- the parts ---------- */
const HEAD = {
  oval: s => `<path d="M144 122C144 76 256 76 256 122L254 162C254 198 226 216 200 216C174 216 146 198 146 162Z" fill="${s}"/>`,
  square: s => `<path d="M143 120C143 76 257 76 257 120L256 176C256 190 236 212 218 213L182 213C164 212 144 190 144 176Z" fill="${s}"/>`,
  round: s => `<rect x="141" y="82" width="118" height="132" rx="59" fill="${s}"/>`,
  heart: s => `<path d="M142 122C142 76 258 76 258 122C258 158 232 206 200 216C168 206 142 158 142 122Z" fill="${s}"/>`
};
const ears = (s, sh) => `<rect x="131" y="138" width="18" height="32" rx="9" fill="${s}"/><rect x="136" y="144" width="8" height="20" rx="4" fill="${sh}"/><rect x="251" y="138" width="18" height="32" rx="9" fill="${s}"/><rect x="256" y="144" width="8" height="20" rx="4" fill="${sh}"/>`;
/* eyes: the picked shape, which the mood can close (cheer, sleepy) or lid (proud) */
function eyes(style, iris, mood, skin) {
  if (mood === "cheer") return `<path d="M165 149Q176 136 187 149L184 152Q176 143 168 152Z" fill="${DARK}"/><path d="M213 149Q224 136 235 149L232 152Q224 143 216 152Z" fill="${DARK}"/>`;
  if (mood === "sleepy") return `<path d="M165 148Q176 156 187 148L187 151Q176 159 165 151Z" fill="${DARK}"/><path d="M213 148Q224 156 235 148L235 151Q224 159 213 151Z" fill="${DARK}"/>`;
  const one = (x, lid) => {
    const [rx, ry, r] = style === "wide" ? [10.5, 10, 6] : style === "narrow" ? [11, 6, 4.6] : [11, 8, 5.4];
    return `<ellipse cx="${x}" cy="146" rx="${rx}" ry="${ry}" fill="${WHITE}"/><circle cx="${x}" cy="146.5" r="${r}" fill="${iris}"/><circle cx="${x}" cy="146.5" r="${(r * .48).toFixed(1)}" fill="#121212"/><circle cx="${x + 2}" cy="144" r="1.6" fill="${WHITE}"/>${lid ? `<rect x="${x - 13}" y="${146 - ry - 1}" width="26" height="${ry * .85 + 1}" fill="${skin}"/><path d="M${x - 12} ${146 - ry * .15}L${x + 12} ${146 - ry * .15}" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>` : `<path d="M${x - 11} ${146 - ry * .55}Q${x} ${146 - ry * 1.35} ${x + 11} ${146 - ry * .55}" fill="none" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`}`;
  };
  return one(176, mood === "proud") + one(224, mood === "proud");
}
/* brows: the picked shape, tilted by the mood (worried lifts the inner ends, proud lifts both) */
function brows(style, col, mood) {
  const t = mood === "worried" ? -12 : mood === "cheer" ? 0 : 3, up = mood === "proud" || mood === "cheer" ? -5 : mood === "worried" ? -2 : 0;
  const shape = {
    natural: `<rect x="-12" y="-2.3" width="24" height="4.6" rx="2.3"/>`,
    thick: `<rect x="-13" y="-3.4" width="26" height="6.8" rx="3.2"/>`,
    arched: `<path d="M-13 3Q0 -8 13 1L11 4Q0 -3 -11 5Z"/>`,
    straight: `<rect x="-12.5" y="-1.6" width="25" height="3.2" rx="1.6"/>`
  }[style] || `<rect x="-12" y="-2.3" width="24" height="4.6" rx="2.3"/>`;
  return `<g fill="${col}"><g transform="translate(175 ${131 + up}) rotate(${-t})">${shape}</g><g transform="translate(225 ${131 + up}) matrix(-1 0 0 1 0 0) rotate(${-t})">${shape}</g></g>`;
}
const NOSE = {
  wedge: sh => `<polygon points="200,145 193,167 206,167" fill="${sh}"/>`,
  button: sh => `<ellipse cx="200" cy="164" rx="7.5" ry="5" fill="${sh}"/>`,
  bridge: sh => `<path d="M197 144L203 144L206 168L194 168Z" fill="${sh}"/>`,
  broad: sh => `<path d="M196 148L204 148L210 167Q200 172 190 167Z" fill="${sh}"/>`
};
/* the mouth is the mood's, not picked */
const MOUTH = {
  happy: () => `<path d="M185 182Q200 197 215 182Q200 189 185 182Z" fill="${DARK}"/>`,
  cheer: () => `<path d="M182 178L218 178C218 200 182 200 182 178Z" fill="#3B1219"/><path d="M185 179L215 179L213 184L187 184Z" fill="${WHITE}"/><ellipse cx="200" cy="192" rx="8" ry="4" fill="#D9536F"/>`,
  proud: () => `<path d="M186 186Q204 192 217 180Q204 186 186 186Z" fill="${DARK}"/>`,
  sleepy: () => `<rect x="191" y="184" width="18" height="3.6" rx="1.8" fill="${DARK}"/>`,
  worried: () => `<path d="M188 189Q200 181 212 189Q200 185 188 189Z" fill="${DARK}"/>`
};
const freckles = sh => [[166, 162], [172, 166], [178, 162], [222, 162], [228, 166], [234, 162]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="${sh}"/>`).join("");
const BEARD = {
  stubble: (c, s) => `<path d="M148 164C148 198 174 216 200 216C226 216 252 198 252 164L245 164C245 190 222 204 200 204C178 204 155 190 155 164Z" fill="${c}" opacity=".32"/><path d="M183 176Q200 172 217 176L216 180Q200 177 184 180Z" fill="${c}" opacity=".32"/>`,
  moustache: c => `<path d="M174 179C182 170 196 172 200 176C204 172 218 170 226 179C220 184 208 181 200 180C192 181 180 184 174 179Z" fill="${c}"/>`,
  beard: (c, s) => `<path d="M145 156C144 204 170 228 200 228C230 228 256 204 255 156L245 156C244 176 226 175 200 175C174 175 156 176 155 156Z" fill="${c}"/><rect x="184" y="178" width="32" height="15" rx="7.5" fill="${s}"/>`
};
const SPECS = {
  round: () => `<g fill="none" stroke="#C9A43A" stroke-width="3.6"><circle cx="176" cy="146" r="16"/><circle cx="224" cy="146" r="16"/><path d="M192 145Q200 140 208 145M160 144L146 140M240 144L254 140"/></g><circle cx="176" cy="146" r="14" fill="#FFFFFF" opacity=".1"/><circle cx="224" cy="146" r="14" fill="#FFFFFF" opacity=".1"/>`,
  square: () => `<g fill="none" stroke="${DARK}" stroke-width="4"><rect x="158" y="133" width="36" height="27" rx="6"/><rect x="206" y="133" width="36" height="27" rx="6"/><path d="M194 144L206 144M158 142L146 139M242 142L254 139"/></g>`,
  shades: () => `<polygon points="154,135 195,137 192,158 158,158" fill="#141418"/><polygon points="205,137 246,135 242,158 208,158" fill="#141418"/><rect x="193" y="137" width="14" height="5" fill="#141418"/><polygon points="163,139 171,139 166,154 159,154" fill="#FFFFFF" opacity=".22"/><polygon points="213,139 221,139 216,154 209,154" fill="#FFFFFF" opacity=".22"/>`
};
/* hair: [back, front]; each the picked style, in the hair colour with a highlight */
const HAIR = {
  shag: (c, hi) => [`<path d="M132 120C124 160 126 205 140 226L160 214L162 140ZM268 120C276 160 274 205 260 226L240 214L238 140Z" fill="${c}"/>`,
    `<path d="M140 140C134 88 166 66 202 66C238 66 268 90 260 140C252 120 246 112 236 106L232 122L220 104L208 120L196 102L184 120L172 104L162 124L156 110C148 118 144 128 140 140Z" fill="${c}"/><path d="M172 76Q200 68 228 76L222 84Q200 78 178 84Z" fill="${hi}"/>`],
  curly: (c, hi) => [`<circle cx="142" cy="150" r="20" fill="${c}"/><circle cx="258" cy="150" r="20" fill="${c}"/>`,
    `<circle cx="150" cy="112" r="26" fill="${c}"/><circle cx="250" cy="112" r="26" fill="${c}"/><circle cx="172" cy="84" r="28" fill="${c}"/><circle cx="228" cy="84" r="28" fill="${c}"/><circle cx="200" cy="74" r="30" fill="${c}"/><circle cx="194" cy="68" r="12" fill="${hi}"/><circle cx="164" cy="80" r="8" fill="${hi}"/>`],
  buzz: c => ["", `<path d="M144 128C144 80 256 80 256 128C252 104 232 97 200 97C168 97 148 104 144 128Z" fill="${c}"/>`],
  mohawk: (c, hi) => ["", `<path d="M146 126C146 98 160 90 170 88L172 100C160 104 152 112 146 126ZM254 126C254 98 240 90 230 88L228 100C240 104 248 112 254 126Z" fill="${c}" opacity=".45"/><polygon points="182,108 184,40 200,30 216,40 218,108" fill="${c}"/><polygon points="196,34 208,40 208,100 196,100" fill="${hi}"/>`],
  braids: (c, hi) => [`<g fill="${c}">${[0, 1, 2, 3, 4].map(i => `<ellipse cx="146" cy="${196 + i * 22}" rx="10" ry="13"/><ellipse cx="254" cy="${196 + i * 22}" rx="10" ry="13"/>`).join("")}</g><path d="M134 130C130 160 134 186 146 196L160 150ZM266 130C270 160 266 186 254 196L240 150Z" fill="${c}"/>`,
    `<path d="M141 140C138 86 170 68 200 70C230 68 262 86 259 140C252 112 230 102 200 96C170 102 148 112 141 140Z" fill="${c}"/><path d="M199 72L201 96" stroke="${hi}" stroke-width="3"/>`],
  bob: (c, hi) => [`<path d="M128 124C122 170 126 206 138 218L170 214L164 130ZM272 124C278 170 274 206 262 218L230 214L236 130Z" fill="${c}"/>`,
    `<path d="M138 146C132 86 168 66 200 66C232 66 268 86 262 146C258 128 250 118 240 114L238 128L160 128L160 114C150 118 142 128 138 146Z" fill="${c}"/><path d="M170 78Q200 70 230 78L226 86Q200 80 174 86Z" fill="${hi}"/>`],
  bun: (c, hi) => [`<circle cx="200" cy="58" r="26" fill="${c}"/><circle cx="194" cy="52" r="9" fill="${hi}"/>`,
    `<path d="M142 134C140 88 166 72 200 72C234 72 260 88 258 134C252 110 232 102 200 102C168 102 148 110 142 134Z" fill="${c}"/><path d="M170 82Q200 76 230 82L224 90Q200 86 176 90Z" fill="${hi}"/>`],
  swoop: (c, hi) => ["", `<path d="M140 138C138 82 174 64 212 66C248 68 264 96 258 140C246 118 214 112 164 140Z" fill="${c}"/><polygon points="172,76 228,84 206,98 162,92" fill="${hi}"/>`],
  long: (c, hi) => [`<path d="M126 128C114 175 112 250 124 300C132 320 152 320 160 300L240 300C248 320 268 320 276 300C288 250 286 175 274 128Z" fill="${shadeOf(c)}"/><path d="M132 133C124 180 122 245 134 288L266 288C278 245 276 180 268 133Z" fill="${c}"/>`,
    `<path d="M140 144C138 84 172 68 200 72C228 68 262 84 260 144C248 112 224 102 200 94C176 102 152 112 140 144Z" fill="${c}"/><path d="M199 74L201 94" stroke="${hi}" stroke-width="3"/>`],
  locs: (c, hi) => [`<g fill="${c}"><rect x="122" y="132" width="18" height="160" rx="9"/><rect x="142" y="140" width="16" height="168" rx="8"/><rect x="242" y="140" width="16" height="168" rx="8"/><rect x="260" y="132" width="18" height="160" rx="9"/></g>`,
    `<path d="M140 138C138 86 170 68 200 70C230 68 262 86 260 138C252 116 232 104 214 108L200 96L186 108C168 104 148 116 140 138Z" fill="${c}"/><g fill="${hi}"><rect x="166" y="80" width="8" height="26" rx="4"/><rect x="226" y="80" width="8" height="26" rx="4"/></g>`],
  pixie: (c, hi) => ["", `<path d="M142 136C138 88 168 70 204 70C238 70 262 92 258 130C246 112 232 106 214 106C196 118 176 124 152 126C148 128 144 132 142 136Z" fill="${c}"/><path d="M180 80Q206 74 232 84L222 92Q204 84 184 88Z" fill="${hi}"/>`],
  ponytail: (c, hi) => [`<path d="M250 112C286 120 294 176 282 236C278 252 266 254 264 238C270 190 266 150 246 132Z" fill="${c}"/>`,
    `<path d="M142 134C140 88 166 70 200 70C234 70 260 88 258 134C252 110 232 101 200 101C168 101 148 110 142 134Z" fill="${c}"/><path d="M170 80Q200 74 230 80L224 88Q200 84 176 88Z" fill="${hi}"/>`],
  longhawk: (c, hi) => [`<rect x="186" y="100" width="28" height="170" rx="14" fill="${shadeOf(c)}"/>`,
    `<path d="M146 126C146 98 160 90 170 88L172 100C160 104 152 112 146 126ZM254 126C254 98 240 90 230 88L228 100C240 104 248 112 254 126Z" fill="${c}" opacity=".45"/><path d="M182 110C178 70 186 40 200 26C214 40 222 70 218 110Z" fill="${c}"/><path d="M196 34C206 52 208 80 206 104L198 104Z" fill="${hi}"/>`]
};
/* hats: the hat, and the line above which the front hair hides */
const HATS = {
  beanie: c => ({ cut: 112, svg: `<path d="M138 118C138 58 262 58 262 118Z" fill="${c}"/><rect x="136" y="102" width="128" height="22" rx="10" fill="${shadeOf(c)}"/><g fill="${shadeOf(shadeOf(c))}"><rect x="166" y="102" width="4" height="22"/><rect x="198" y="102" width="4" height="22"/><rect x="230" y="102" width="4" height="22"/></g><circle cx="200" cy="58" r="10" fill="${lightOf(c)}"/>` }),
  cap: c => ({ cut: 108, svg: `<path d="M142 112C142 64 258 64 258 112Z" fill="${c}"/><path d="M200 66L200 112" stroke="${shadeOf(c)}" stroke-width="3"/><circle cx="200" cy="66" r="5" fill="${shadeOf(c)}"/><path d="M196 104L282 104Q292 106 286 116L196 116Z" fill="${shadeOf(c)}"/>` }),
  bandana: c => ({ cut: 0, svg: `<path d="M142 110C150 92 250 92 258 110L256 124C240 114 160 114 144 124Z" fill="${c}"/><g fill="${lightOf(c)}"><circle cx="172" cy="110" r="2.6"/><circle cx="200" cy="106" r="2.6"/><circle cx="228" cy="110" r="2.6"/></g><path d="M254 116L276 128L268 136L250 124Z" fill="${shadeOf(c)}"/>` })
};
/* the top, by venue look; c is the top colour, sp the look's spot colour */
const TOP = {
  tee: (c, sp) => `<path d="M112 282C114 250 152 240 174 240Q200 264 226 240C248 240 286 250 288 282L300 400L100 400Z" fill="${c}"/><path d="M170 240Q200 268 230 240L225 247Q200 274 175 247Z" fill="${shadeOf(c)}"/>`,
  flannel: (c, sp) => `<path d="M164 242Q200 262 236 242L240 400L160 400Z" fill="#EAE6DF"/><path d="M110 282C112 250 150 240 174 240L184 400L98 400Z" fill="${c}"/><path d="M290 282C288 250 250 240 226 240L216 400L302 400Z" fill="${c}"/><g fill="${shadeOf(c)}" opacity=".7"><rect x="112" y="300" width="70" height="12"/><rect x="218" y="300" width="70" height="12"/><rect x="112" y="350" width="72" height="12"/><rect x="216" y="350" width="72" height="12"/><rect x="140" y="244" width="12" height="156"/><rect x="248" y="244" width="12" height="156"/></g><polygon points="172,240 186,268 160,276" fill="${shadeOf(c)}"/><polygon points="228,240 214,268 240,276" fill="${shadeOf(c)}"/>`,
  vest: (c, sp) => `<path d="M112 282C114 250 152 240 174 240Q200 264 226 240C248 240 286 250 288 282L300 400L100 400Z" fill="${c}"/><path d="M128 266C140 248 160 242 174 242L186 400L120 400Z" fill="${sp}"/><path d="M272 266C260 248 240 242 226 242L214 400L280 400Z" fill="${sp}"/><g fill="${shadeOf(sp)}"><rect x="140" y="250" width="4" height="150"/><rect x="256" y="250" width="4" height="150"/><polygon points="146,290 176,290 173,304 149,304"/><polygon points="224,290 254,290 251,304 227,304"/></g><circle cx="160" cy="330" r="8" fill="#E3A842"/><rect x="230" y="322" width="26" height="14" rx="2" fill="#D93829"/>`,
  leather: (c, sp) => `<path d="M166 242Q200 262 234 242L236 400L164 400Z" fill="${c}"/><path d="M108 282C110 248 150 238 174 238L184 400L96 400Z" fill="#26221F"/><path d="M292 282C290 248 250 238 226 238L216 400L304 400Z" fill="#26221F"/><polygon points="172,238 186,286 148,274" fill="#3A3430"/><polygon points="228,238 214,286 252,274" fill="#3A3430"/><circle cx="156" cy="268" r="3" fill="#D4D6D8"/><circle cx="244" cy="268" r="3" fill="#D4D6D8"/><rect x="221" y="296" width="4" height="96" fill="#D4D6D8"/>`,
  stage: (c, sp) => `<path d="M166 242Q200 262 234 242L236 400L164 400Z" fill="${c}"/><path d="M108 282C110 248 150 238 174 238L184 400L96 400Z" fill="#1E1A18"/><path d="M292 282C290 248 250 238 226 238L216 400L304 400Z" fill="#1E1A18"/><polygon points="172,238 188,300 150,276" fill="#FFB547"/><polygon points="228,238 212,300 250,276" fill="#FFB547"/><g fill="#FFD27A">${[[128, 330], [144, 370], [262, 340], [276, 378], [120, 290], [282, 300]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join("")}</g>`
};
/* sleeves by look: [upper arm colour, forearm colour or null for bare skin] */
const sleeves = (look, c) => ({ tee: [c, null], vest: [c, null], flannel: [c, c], leather: ["#26221F", "#26221F"], stage: ["#1E1A18", "#1E1A18"] })[look] || [c, null];
/* arms by pose: [upper, forearm, hand] for the viewer's left and right arm; hand is [x, y, angle, kind] */
const ARMS = {
  play: [[`M130 286Q104 336 116 376`, `M116 376L200 320`, [203, 317, -30, "strum"]], [`M270 286Q306 330 334 352`, `M334 352L326 262`, [325, 250, -84, "fret"]]],
  hornsUp: [[`M130 286Q110 340 118 400`, ``, null], [`M270 286Q322 268 334 224`, `M334 224L336 162`, [336, 150, 0, "horns"]]],
  rest: [[`M130 286Q110 340 118 400`, ``, null], [`M270 286Q290 340 282 400`, ``, null]]
};
function hand([x, y, a, kind], s, sh) {
  const fist = `<ellipse cx="0" cy="0" rx="15" ry="12" fill="${s}"/>`;
  const k = {
    strum: `${fist}<path d="M-6 -9Q2 -12 9 -7" fill="none" stroke="${sh}" stroke-width="2.4" stroke-linecap="round"/><rect x="4" y="-4" width="10" height="7" rx="2" fill="#F5C542" transform="rotate(30)"/>`,
    fret: `<g fill="${s}"><rect x="-6" y="-24" width="9" height="18" rx="4.5"/><rect x="3" y="-22" width="9" height="16" rx="4.5"/><rect x="-14" y="-18" width="9" height="14" rx="4.5"/></g>${fist}`,
    horns: `<g fill="${s}"><rect x="-14" y="-38" width="9" height="30" rx="4.5"/><rect x="6" y="-38" width="9" height="30" rx="4.5"/></g>${fist}<path d="M-4 -6Q0 0 6 -4" fill="none" stroke="${sh}" stroke-width="2.4" stroke-linecap="round"/>`
  }[kind];
  return `<g transform="translate(${x} ${y}) rotate(${a})">${k}</g>`;
}
function arms(pose, look, top, s, sh) {
  const [up, fore] = sleeves(look, top);
  /* a bare forearm goes under the sleeve, so the sleeve's edge sits over the elbow; a long sleeve runs on to the cuff */
  const one = ([u, f, h]) => {
    const fa = f ? `<path d="${f}" fill="none" stroke="${fore || s}" stroke-width="${fore ? 27 : 23}" stroke-linecap="round"/>` : "";
    const ua = fore ? `<path d="${u}" fill="none" stroke="${up}" stroke-width="30" stroke-linecap="round"/>`
      : `<path d="${u}" fill="none" stroke="${s}" stroke-width="25" stroke-linecap="round"/><path d="${u}" pathLength="100" stroke-dasharray="42 200" fill="none" stroke="${up}" stroke-width="32" stroke-linecap="round"/>`;
    return (fore ? ua + fa : fa + ua) + (h ? hand(h, s, sh) : "");
  };
  return ARMS[pose].map(one).join("");
}
/* patches for what you've done, sewn low on the top, clear of the guitar and the fretting arm */
const SPOTS = [[250, 384], [276, 388], [302, 384], [263, 362], [289, 364]];
function patchSVG(pt, x, y) {
  if (pt.kind === "leg") return `<circle cx="${x}" cy="${y}" r="11" fill="${pt.color}"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#F5C542" stroke-width="2" stroke-dasharray="2 1.6"/><path d="M${x - 1.5} ${y - 7}h3v7h-3z M${x} ${y + 3}m-5 0a5 4.5 0 1 0 10 0a5 4.5 0 1 0 -10 0" fill="#F5C542"/>`;
  if (pt.kind === "chart") return `<path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="${pt.color}"/>`;
  const t = String(pt.top || "").slice(0, 5), w = Math.max(20, 9 + t.length * 6.4);
  return `<rect x="${x - w / 2}" y="${y - 8}" width="${w}" height="14" rx="7" fill="${pt.color}"/><text x="${x}" y="${y + 2.4}" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="9.5" fill="#1c1d22">${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
}
/* the Road guitar's painted picture, slung across the body (never stretched) */
const GUITAR_AT = `translate(172 334) rotate(60) translate(-62 -290)`;

export function guitarist(me, { mood: mood0 = "happy", pose: pose0 = "play", crop = "full", size = 160, look: look0 = "tee", patches = [], guitar: gi = null, label = "Your guitarist", card = false, headline = "" } = {}) {
  const id = "gt" + (++N), bust = crop === "bust" || crop === "face", pose = bust ? "rest" : (ARMS[pose0] ? pose0 : "play");
  const mood = MOUTH[mood0] ? mood0 : "happy";
  const look = TOP[look0] ? look0 : look0 === "denim" ? "vest" : "tee";
  const skin = SKIN[me.skin] ?? SKIN[2], sk2 = shadeOf(skin);
  const hairC = HAIR_COL[me.hairCol] ?? HAIR_COL.brown, hairHi = lightOf(hairC);
  const beardC = HAIR_COL[me.beardCol] ?? hairC;
  const top = OUTFIT_COL[me.top] ?? OUTFIT_COL.red, sp = SPOT[look];
  const hatC = OUTFIT_COL[me.extraCol] ?? HAIR_COL[me.extraCol] ?? "#26282e";
  const hair = (HAIR[me.hair] || HAIR.shag)(hairC, hairHi);
  const hat = me.extra && me.extra !== "none" && HATS[me.extra] ? HATS[me.extra](hatC) : null;
  const ink = `filter="url(#${id}o)"`;
  const pic = pose === "play" ? guitarPic((gi || {}).body) : null;
  const strap = pose === "play" ? `<path d="M262 248L146 366" stroke="#2A1F1A" stroke-width="13" stroke-linecap="round"/><path d="M262 248L146 366" stroke="${look === "stage" ? "#FFB547" : "#5A3A26"}" stroke-width="7" stroke-linecap="round"/>` : "";
  const neck = `<path d="M114 282C114 252 152 240 200 240C248 240 286 252 286 282L298 400L102 400Z" fill="${skin}"/><rect x="176" y="190" width="48" height="62" rx="16" fill="${skin}"/><path d="M176 204Q200 226 224 204L224 224Q200 238 176 224Z" fill="${sk2}"/>`;
  const face = [eyes(me.eyes, EYE_COL[me.eyeCol] ?? EYE_COL.brown, mood, skin), brows(me.brows, shadeOf(hairC), mood), (NOSE[me.nose] || NOSE.wedge)(sk2), me.freckles ? freckles(sk2) : "", MOUTH[mood]()].join("");
  const frontHair = hat && hat.cut ? `<g clip-path="url(#${id}k)">${hair[1]}</g>` : hair[1];
  const figure = [
    `<g ${ink}>${hair[0]}${neck}${TOP[look](top, sp)}${strap}</g>`,
    pic ? `<g transform="${GUITAR_AT}"><image href="${pic}" width="124" height="353" preserveAspectRatio="xMidYMid meet"/></g>` : "",
    `<g ${ink}>${arms(pose, look, top, skin, sk2)}${ears(skin, sk2)}${(HEAD[me.face] || HEAD.oval)(skin)}</g>`,
    face,
    me.beard && BEARD[me.beard] ? `<g ${me.beard === "stubble" ? "" : ink}>${BEARD[me.beard](beardC, skin)}</g>` : "",
    `<g ${ink}>${frontHair}${hat ? hat.svg : ""}</g>`,
    me.glasses ? (SPECS[me.specs] || SPECS.round)() : ""
  ].join("");
  const mirror = me.lefty ? ` transform="translate(400 0) scale(-1 1)"` : "";
  const [bk, beam, glow] = STAGE[look];
  const defs = `<defs><filter id="${id}o" x="-15%" y="-15%" width="130%" height="130%"><feMorphology in="SourceAlpha" operator="dilate" radius="${bust ? 4 : 3.4}" result="d"/><feFlood flood-color="${LINE}"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>${hat && hat.cut ? `<clipPath id="${id}k"><rect x="0" y="${hat.cut}" width="400" height="300"/></clipPath>` : ""}${bust ? `<clipPath id="${id}c"><circle cx="200" cy="150" r="96"/></clipPath>` : ""}</defs>`;
  let body, vb;
  if (bust) {
    /* face: the same disc, closer in, for the maker's face-part buttons */
    vb = crop === "face" ? "132 92 136 136" : "100 50 200 200";
    const pin = (patches || [])[0] ? `<g transform="translate(${me.lefty ? 158 : 242} 232)">${patchSVG(patches[0], 0, 0)}</g>` : "";
    body = `<circle cx="200" cy="150" r="96" fill="${bk}"/><circle cx="200" cy="168" r="70" fill="${glow}" opacity=".16"/><g clip-path="url(#${id}c)"><g${mirror}>${figure}</g></g><circle cx="200" cy="150" r="95" fill="none" stroke="${LINE}" stroke-opacity=".5" stroke-width="2"/>${size > 48 ? pin : ""}`;
  } else {
    /* even about the middle (x 200), so a lefty's mirrored guitar fits too */
    vb = crop === "three" ? "-20 -50 440 470" : pose === "hornsUp" ? "30 10 340 390" : "-20 20 440 380";
    const [x, y, w, h] = vb.split(" ").map(Number);
    const stage = card ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${bk}"/><polygon points="140,${y} 260,${y} ${x + w - 20},${y + h} ${x + 20},${y + h}" fill="${beam}"/><circle cx="200" cy="200" r="130" fill="${glow}" opacity=".13"/><ellipse cx="200" cy="${y + h - 14}" rx="150" ry="20" fill="${glow}" opacity=".2"/>` : "";
    const wear = (patches || []).slice(0, pose === "play" ? SPOTS.length : 0).map((pt, i) => { const [px, py] = SPOTS[i]; return patchSVG(pt, me.lefty ? 400 - px : px, py); }).join("");
    const head = card && headline ? `<text x="200" y="${y + 40}" text-anchor="middle" font-family="'Space Grotesk', Impact, sans-serif" font-weight="700" font-size="40" letter-spacing="3" fill="#F6EEE0">${headline.replace(/[<&]/g, "")}</text>` : "";
    const clip = `<clipPath id="${id}v"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18"/></clipPath>`;
    body = `${clip}<g clip-path="url(#${id}v)">${stage}${head}<g${mirror}>${figure}</g>${wear}</g>`;
  }
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg viewBox="${vb}" width="${size}" height="${Math.round(size * vh / vw)}" role="img" aria-label="${label.replace(/"/g, "&quot;")}" data-mood="${mood}" style="overflow:hidden">${defs}${body}</svg>`;
}

/* The finished paintings. One man and one woman for each genre. The player's picture is data.me.genre and data.me.who.
   A rival's picture comes from the name already used for that rival. */
export const GENRE_IDS = ME_GENRE;
const GENRE_V2 = { "punk-w": "punk-w-v2", "country-m": "country-m-v2", "country-w": "country-w-v2" };
export const GENRE_DEFAULT = "rock-m";
export const genreCast = () => GENRE_IDS.flatMap(g => [`${g}-m`, `${g}-w`]);
export function genreFile(id) {
  return `art/guitarist-painted/genres/${GENRE_V2[id] || id}.webp`;
}
export function genreForName(name) {
  const cast = genreCast();
  let h = 7;
  for (const c of String(name || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return cast[h % cast.length];
}
/* a finished painting, in the same svg the screens already size. A bust is the head, clipped to a disc. */
function painted(id, { crop = "full", size = 160, label = "Your guitarist", card = false, headline = "", mood = "happy", lefty = false, look = "tee" } = {}) {
  const file = genreFile(id);
  const gid = `gp${++N}`;
  const safe = String(label).replace(/"/g, "&quot;");
  const [bk] = STAGE[look] || STAGE.tee;
  const mirror = lefty ? ` transform="translate(800 0) scale(-1 1)"` : "";
  const img = `<g${mirror}><image href="${file}" width="800" height="800"/></g>`;
  const open = `role="img" aria-label="${safe}" data-mood="${mood}" data-genre="${id}" style="overflow:hidden"`;
  if (crop === "bust" || crop === "face") {
    const face = crop === "face";
    const cx = 390, cy = face ? 200 : 240, r = face ? 140 : 200;
    return `<svg viewBox="${cx - r} ${cy - r} ${r * 2} ${r * 2}" width="${size}" height="${size}" ${open}><defs><clipPath id="${gid}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="${bk}"/><g clip-path="url(#${gid})">${img}</g></svg>`;
  }
  if (card) {
    const title = headline ? `<text x="400" y="72" text-anchor="middle" font-family="'Space Grotesk', Impact, sans-serif" font-weight="700" font-size="44" letter-spacing="3" fill="#F6EEE0">${String(headline).replace(/[<&]/g, "")}</text>` : "";
    return `<svg viewBox="0 0 800 900" width="${size}" height="${Math.round(size * 900 / 800)}" ${open}><rect width="800" height="900" rx="28" fill="${bk}"/>${title}<g transform="translate(0 88)">${img}</g></svg>`;
  }
  return `<svg viewBox="30 10 740 780" width="${size}" height="${size}" ${open}>${img}</svg>`;
}
export function genreIdOf(me) {
  const id = `${GENRE_IDS.includes(me?.genre) ? me.genre : "rock"}-${me?.who === "w" ? "w" : "m"}`;
  return genreCast().includes(id) ? id : GENRE_DEFAULT;
}
/* you, as the app means you. The picture is the genre and the man or woman you picked. A portrait still stands in
   for the round portrait and the share card. o overrides mood, crop, size, label, look and lefty. */
export function you(data, o = {}) {
  const p = !o.me && !o.drawn && portraitNow();
  if (p && (o.crop === "bust" || o.portrait)) return portraitSVG(p, { crop: o.crop === "bust" ? "bust" : "full", size: o.size, label: o.label || "Your portrait", headline: o.headline });
  const me = o.me || meOf(data || {});
  return painted(genreIdOf(me), { mood: meMood(data || {}), look: stageLook(data || {}), ...o, lefty: o.lefty ?? me.lefty });
}
/* a computer rival. The picture is one of the 24, chosen from the name. Decorative (the name is beside it). */
export function rival(name, tier, o = {}) {
  return painted(genreForName(name), { look: stageLookOf(tier), crop: "bust", ...o, label: name }).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
}
