// Louie, the mascot: a black 1x12 combo amp with a silver grille (Road Ready; docs/road-ready/louie-design-spec.md, section 9).
// Since 10a he is black by default: Grok's painted art in art/louie/v3 (a light and a dark picture per pose; the page's CSS
// shows the one for the look). The blue Louie he wore first is the Blue finish on the Merch table, which shows art/louie/v2.
// The code drawing below is kept in the same SVG as a fallback: it shows when he wears a colour finish from the Merch
// table, and in pictures made from the SVG alone (the share card), which can't load the art.
// The code drawing: black Tolex with a darker right side, nickel corner caps, a brown leather handle, a yellow control
// panel for a face (two eyes, one mouth, a row of four cream knobs), a plain silver-grey grille, hands and two short legs.
// The hard rule: exactly one mouth (class lv-mouth), always on the yellow panel between the eyes and the knobs.
// The grille is plain cloth: never a mouth, a smile line or any feature on it, in any mood, pose or size.
// Hands have fingers, black Tolex like his arms (Graham, 2026-11-17), and no hand ever shows one finger standing straight up
// from the middle: it reads as the middle finger (4.39.1). No cheeks, no blush, no lamp.
// His colours are locked: the --lv-* variables on .louie in styles.css, and the same values written on each
// shape, so a picture made from the SVG alone shows the same Louie.
// louie(mood, { pose, size }) returns an <svg> string.
//   moods: happy, cheer, sleepy, worried (drawn as nervous, never sad), proud, listen (a hand to his ear, for when the app is listening)
//   poses: rest, hornsUp, thumb, point, wave, peace (no arms when absent)

/* The guitarist's hands (guitarist.js draws them through mittenOf). These are the shapes Louie had before Road Ready,
   kept exactly as they were so your guitarist doesn't change. Louie's own mittens are HANDS, below.
   Hands are drawn with the wrist at 0,0 and the fingers pointing up (negative y).
   4.86.0: each hand is one mitten: the fingers grow out of the palm, creases instead of stuck-on knuckles, a shade copy
   under the lit one like his body, and a cuff at the wrist. */
const guitaristMitt = (shape, creases = "", over = "") => `<g class="lv-fs" transform="translate(1.25 1.9)">${shape}${over}</g><g class="lv-f">${shape}</g>`
  + `<g class="lv-fl" fill="none" stroke-width="1.9" stroke-linecap="round">${creases}</g>${over ? `<g class="lv-fs" transform="translate(0 1.6)">${over}</g><g class="lv-f">${over}</g>` : ""}`
  + `<rect class="lv-cuff" x="-9.5" y="-3.2" width="19" height="6.4" rx="3.2"/>`;
const guitaristFinger = (x, len, r) => `<rect x="${x - 4.6}" y="${-22 - len}" width="9.2" height="${len + 6}" rx="4.6" transform="rotate(${r} ${x} -20)"/>`;
const G_PALM = `<path d="M-13 -4C-15.5 -11 -15.5 -20 -12.5 -25C-8 -28 8 -28 12.5 -25C15.5 -20 15.5 -11 13 -4C8 1 -8 1 -13 -4Z"/>`;
const G_ROLLS = "C16.5 -26.5 16 -23.5 13.5 -21.5C16.5 -19 16 -15.5 13.5 -13.5C16.5 -11 16 -7 13 -5C12 0 6 1 0 1C-6 1 -10 1 -11 -1Z";
const G_THUMB_ACROSS = `<path d="M-12.5 -15C-6 -18.5 4 -18.5 8.5 -15C10.5 -13 9.5 -10 7.5 -9.5C1 -8 -6 -8.5 -12 -10Z"/>`;
/* each hand as [shape, creases, over]: the guitarist draws them in skin, Louie (since 03b) in black Tolex like his arms */
const HAND_PARTS = {
  fist: [`<path d="M-13 -3C-16 -9 -16 -20 -12 -25Q-9 -29 -5.5 -26.5Q-2 -29.5 1.5 -26.5Q5 -29.5 8.5 -26.5Q12.5 -28 14 -23C16 -17 15.5 -9 13 -3C8 1 -8 1 -13 -3Z"/>`,
    `<path d="M-5.5 -26V-21M1.5 -26V-21M8.5 -26V-21"/>`, G_THUMB_ACROSS],
  horns: [`<path d="M-13 -3C-15.5 -9 -15.5 -17 -13.5 -22L-14.5 -38C-14.8 -43.5 -5 -44.5 -4.6 -38.5L-4 -26.5C-1.5 -28.5 2 -28.5 4.6 -26.5L5.4 -34.5C5.8 -40.5 15 -40 14.4 -34L13.4 -20C15.4 -14 15 -8 12.5 -3C8 1 -8.5 1 -13 -3Z"/>`,
    `<path d="M-4 -24Q0 -21.5 4.6 -24"/>`, G_THUMB_ACROSS],
  /* a thumbs up like the emoji: the fingers curled on the front edge, a short thumb up from the back of the fist.
     Never one finger standing straight up from the middle (that reads as the middle finger). */
  thumb: [`<path d="M-11 -1C-13 -8 -14 -18 -13 -27C-14 -35 -15 -42 -12 -46C-9 -50 -3 -49 -2 -44C-1.5 -40 -1.5 -36 -1 -32C4 -33.5 11 -33 13.5 -29.5${G_ROLLS}"/>`,
    `<path d="M2 -21.5Q8 -20.5 13.5 -21.5M2 -13.5Q8 -12.5 13.5 -13.5M3 -5.5Q8 -4.8 13 -5M-1 -32Q-5 -30 -9 -31"/>`, ""],
  /* pointing: the index finger out from the front of the fist and the thumb tucked; the pose turns it toward the
     speech bubble, so it never stands straight up */
  point: [`<path d="M-11 -1C-13 -8 -14 -18 -13 -26C-12.5 -31 -8 -33 -3 -33L3 -33L3.5 -49C3.7 -55 13.3 -55 13.5 -49L13.6 -30${G_ROLLS}"/>`,
    `<path d="M3 -30.5Q8 -29.5 13.5 -30M2 -21.5Q8 -20.5 13.5 -21.5M2 -13.5Q8 -12.5 13.5 -13.5M-12 -20Q-5 -17 2 -20"/>`, ""],
  wave: [`${G_PALM}${guitaristFinger(-9, 17, -14)}${guitaristFinger(-3, 23, -5)}${guitaristFinger(3.5, 24, 4)}${guitaristFinger(9.5, 20, 13)}<rect x="-21" y="-19" width="9.2" height="18" rx="4.6" transform="rotate(-38 -12 -8)"/>`,
    `<path d="M-6 -24.5V-21M0.3 -25V-21.5M6.6 -24.5V-21"/>`, ""],
  peace: [`${G_PALM}${guitaristFinger(-4.5, 24, -12)}${guitaristFinger(4.5, 25, 12)}`, `<path d="M-1 -10Q0 -16 1 -22"/>`, G_THUMB_ACROSS]
};
const GUITARIST_HANDS = Object.fromEntries(Object.entries(HAND_PARTS).map(([name, parts]) => [name, () => guitaristMitt(...parts)]));
/* 4.86.0: the guitarist's hands in a skin tone: `sh` is the shade, `ln` the creases, `cuff` the sleeve */
export function mittenOf(name, skin, sh, ln, cuff) {
  return GUITARIST_HANDS[name]().replace(/class="lv-fs"/g, `fill="${sh}"`).replace(/class="lv-f"/g, `fill="${skin}"`)
    .replace(/class="lv-fl"/g, `stroke="${ln}"`).replace(/class="lv-cuff"/g, `fill="${cuff}"`);
}

/* Louie's hands (03b): the same fingered shapes as the guitarist's, in black Tolex like his arms: an ink outline behind, the
   Tolex shadow under the lit Tolex, ink creases, and a Tolex-shadow cuff. The wrist is at 0,0, the fingers point up. */
const INK = "#0B0F14";
const TOLEX = 'fill="#292929"', TOLEX_SH = 'fill="#1B1B1B"';
const louieHand = (shape, creases = "", over = "") => `<g class="lv-mit-o" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round">${shape}${over}</g>`
  + `<g class="lv-mit-s" ${TOLEX_SH} transform="translate(1.25 1.9)">${shape}${over}</g><g class="lv-mit" ${TOLEX}>${shape}</g>`
  + `<g class="lv-mit-l" fill="none" stroke="${INK}" stroke-opacity=".55" stroke-width="1.9" stroke-linecap="round">${creases}</g>`
  + (over ? `<g class="lv-mit-s" ${TOLEX_SH} transform="translate(0 1.6)">${over}</g><g class="lv-mit" ${TOLEX}>${over}</g>` : "")
  + `<rect class="lv-cuff" ${TOLEX_SH} x="-9.5" y="-3.4" width="19" height="6.8" rx="3.4" stroke="${INK}" stroke-width="1.6"/>`;
const HANDS = Object.fromEntries(Object.entries(HAND_PARTS).map(([name, parts]) => [name, () => louieHand(...parts)]));
/* the outline of a hand alone, for the warm rim */
const handShape = name => HAND_PARTS[name][0] + HAND_PARTS[name][2];

/* The painted art (03b): one picture per mood or pose, light and dark. Mood first, then the pose. */
const ART_POSE = { hornsUp: "horns", thumb: "thumb", point: "point", wave: "wave", peace: "wave" };
/* The thumbs-up hand is too small to read below THUMB_MIN px, so a smaller Louie cheers instead (no size given: full size). */
const THUMB_MIN = 100;
export function louieArt(mood = "happy", pose, size = Infinity) {
  if (mood === "sleepy") return "sleepy";
  if (mood === "worried") return "nervous";
  if (mood === "proud") return "proud";
  if (mood === "listen") return "listen"; /* while the app is listening: a hand to his ear */
  if (pose === "thumb" && size < THUMB_MIN) return "cheer";
  return ART_POSE[pose] || (mood === "cheer" ? "cheer" : "idle");
}

/* shoulder x,y (on the cabinet's side), wrist x,y, the hand's turn, and the mitten. The arms come out of the sides. */
const POSES = {
  rest: [[50, 78, 36, 112, 184, "fist"], [150, 78, 164, 112, 176, "fist"]],
  hornsUp: [[50, 80, 22, 50, -16, "horns"], [150, 80, 178, 50, 16, "horns"]],
  thumb: [[50, 78, 36, 112, 184, "fist"], [150, 80, 182, 80, 12, "thumb"]],
  point: [[50, 78, 36, 112, 184, "fist"], [150, 84, 180, 108, 40, "point"]],
  wave: [[50, 78, 36, 112, 184, "fist"], [150, 78, 184, 48, 16, "wave"]],
  peace: [[50, 78, 36, 112, 184, "fist"], [150, 78, 183, 50, 14, "peace"]]
};

/* The cabinet: taller than wide. The panel is the top of the front, the grille the rest. */
const CAB = { x: 48, y: 20, w: 104, h: 128 }, P = { x: 57, y: 29, w: 86, h: 51 }, G = { x: 57, y: 86, w: 86, h: 54 };
/* The grille: plain silver-grey cloth with a fine weave and a faint speaker circle. Nothing else is ever drawn on it. */
const WEAVE = (() => {
  let d = "";
  for (let k = -G.h + 3; k < G.w; k += 5.5) {
    const x = Math.max(k, 0), y = G.y + Math.max(-k, 0), n = Math.min(G.w - x, G.y + G.h - y);
    d += `M${G.x + x} ${y}l${n} ${n}M${G.x + G.w - x} ${y}l${-n} ${n}`;
  }
  return d;
})();
const KNOBS = [[68, -32], [89.3, 12], [110.7, -12], [132, 34]];
const CAPS = [[45, 17], [139, 17], [45, 135], [139, 135]];
const r1 = n => Math.round(n * 10) / 10;
let seq = 0; /* gradient and pattern ids, unique on the page */

export function louie(mood = "happy", { pose, size = 120, label = "Louie" } = {}) {
  const arms = pose && POSES[pose];
  const sleepy = mood === "sleepy", proud = mood === "proud", worried = mood === "worried", cheer = mood === "cheer";
  const vb = arms ? "-34 -30 268 236" : "18 0 164 200";
  const [vx, vy, vw, vh] = vb.split(" ").map(Number);
  const art = louieArt(mood, pose, size);
  const id = "lv" + (++seq).toString(36);
  /* how many drawing units one screen pixel covers: lines get heavier and eyes a little bigger when he is drawn small,
     so his eyes, mouth and knobs still read at 44 px */
  const u = vw / (size || 120);
  const line = r1(Math.max(3, 0.85 * u)), brow = r1(Math.max(2.6, 0.75 * u)), big = r1(Math.min(1.3, Math.max(1, u / 3)));
  const ol = r1(Math.max(1.8, 0.55 * u)); /* the ink outline round every part */
  const rim = r1(3 * u); /* the warm rim on dark looks is 3 px on screen */
  const stroke = w => `fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const edge = `stroke="${INK}" stroke-width="${ol}" stroke-linejoin="round"`;
  const sized = (x, inner) => `<g class="lv-eyes"${big > 1 ? ` transform="translate(${x} 47) scale(${big}) translate(${-x} -47)"` : ""}>${inner}</g>`;
  const eye = x => sized(x, cheer || proud ? `<path class="lv-inks" d="M${x - 7.5} 50 Q${x} 40 ${x + 7.5} 50" ${stroke(brow)}/>`
    : sleepy ? `<path class="lv-ink" fill="${INK}" d="M${x - 4.6} 48 A4.6 5 0 0 0 ${x + 4.6} 48Z"/><path class="lv-inks" d="M${x - 7} 47.5 Q${x} 46 ${x + 7} 47.5" ${stroke(r1(brow * 0.8))}/>`
    : `<g class="lv-eye"><ellipse class="lv-ink" fill="${INK}" cx="${x}" cy="47" rx="4.6" ry="5.9"/><circle cx="${x + 1.5}" cy="44.6" r="1.6" fill="#fff"/></g>`);
  const brows = cheer || sleepy ? ""
    : worried ? `<path class="lv-inks" d="M75 39.5 Q80 33.5 89 34" ${stroke(brow)}/><path class="lv-inks" d="M125 39.5 Q120 33.5 111 34" ${stroke(brow)}/>`
    : `<path class="lv-inks" d="M74 ${proud ? 36 : 37.5} Q81 ${proud ? 32 : 33.5} 88 ${proud ? 35.5 : 37}" ${stroke(brow)}/><path class="lv-inks" d="M126 ${proud ? 36 : 37.5} Q119 ${proud ? 32 : 33.5} 112 ${proud ? 35.5 : 37}" ${stroke(brow)}/>`;
  /* The one mouth. Every mood has exactly one lv-mouth, and it sits on the yellow panel between the eyes and the knobs. */
  const mouth = cheer ? `<path class="lv-mouth lv-ink lv-inks" d="M89 54.5 H111 Q111 64.5 100 64.5 Q89 64.5 89 54.5Z" fill="${INK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><ellipse class="lv-mouth-in" fill="#B9503A" cx="100" cy="61.6" rx="6" ry="2.6"/>`
    : `<path class="lv-mouth lv-inks" d="${sleepy ? "M93 58.5 Q100 61 107 58.5" : worried ? "M89 58.5 q2.75 -3 5.5 0 t5.5 0 t5.5 0 t5.5 0" : proud ? "M89 55 Q101 63.5 111 54.5" : "M90 55.5 Q100 63 110 55.5"}" ${stroke(line)}/>`;
  const tilt = cheer ? "rotate(-5 100 110)" : proud ? "rotate(4 100 110)" : "";
  const limbs = layer => !arms ? "" : arms.map(([sx, sy, wx, wy, rot, sign]) => {
    const mx = (sx + wx) / 2 + (wx < sx ? -8 : 8), my = Math.min(sy, wy) + (wy < sy ? 6 : 12);
    const arm = `d="M${sx} ${sy} Q${mx} ${my} ${wx} ${wy}" fill="none" stroke-linecap="round"`, at = `transform="translate(${wx} ${wy}) rotate(${rot}) scale(0.86 1.02)"`;
    return layer === "arm" ? `<path class="lv-arm-o" stroke="${INK}" stroke-width="${r1(15 + 2 * ol)}" ${arm}/><path class="lv-arm" stroke="#292929" stroke-width="15" ${arm}/><path stroke="#fff" stroke-opacity=".12" stroke-width="4" ${arm} transform="translate(-2 -2)"/>`
      : layer === "hand" ? `<g ${at}>${HANDS[sign]()}</g>`
      : `<path stroke-width="${r1(15 + 2 * rim)}" ${arm}/><g ${at}>${handShape(sign)}</g>`;
  }).join("");
  const HANDLE = `d="M78 19 C78 1 122 1 122 19" fill="none" stroke-linecap="round"`;
  const leg = x => `<rect x="${x}" y="144" width="18" height="30" rx="4"/>`;
  const boot = (x, f) => `<path d="M${x - 12 * f} 191 Q${x - 14 * f} 175 ${x - 2 * f} 170 H${x + 8 * f} Q${x + 19 * f} 173 ${x + 19 * f} 184 Q${x + 19 * f} 191 ${x + 12 * f} 191Z"/>`;
  const LEGS = leg(69) + leg(113), BOOTS = boot(80, -1) + boot(120, 1);
  const cap = ([x, y]) => `<rect x="${x}" y="${y}" width="16" height="16" rx="3.5"/>`;
  return `<svg class="louie ${mood}${pose ? " " + pose : ""}" width="${size}" height="${Math.round(size * vh / vw)}" viewBox="${vb}" role="img" aria-label="${label}">
  <g class="lv-art-wrap">${["v3", "v2"].flatMap(v => ["light", "dark"].map(k => { const pd = k === "dark" ? r1(vh * 0.02) : 0; /* the dark pictures carry the warm rim in a 12 px margin on a 600 px frame: draw them 2 percent bigger each side so Louie is the same size in both looks */
    return `<image class="lv-art lv-art-${k[0]} lv-${v}" href="art/louie/${v}/louie-${art}-${k}.webp" x="${r1(vx - pd)}" y="${r1(vy - pd)}" width="${r1(vw + 2 * pd)}" height="${r1(vh + 2 * pd)}" preserveAspectRatio="xMidYMax meet"/>`; })).join("")}</g>
  <g class="lv-code"><defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>
  <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  <radialGradient id="${id}k" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>
  <linearGradient id="${id}n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient>
  <pattern id="${id}t" width="2.6" height="2.6" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx=".7" cy=".7" r=".45" fill="#000" opacity=".18"/><circle cx="2" cy="1.9" r=".35" fill="#fff" opacity=".07"/></pattern></defs>
  ${sleepy ? `<text class="lv-z" fill="#8A8F98" x="160" y="22" font-family="system-ui,sans-serif" font-size="22" font-weight="700">z</text><text class="lv-z" fill="#8A8F98" x="176" y="7" font-family="system-ui,sans-serif" font-size="15" font-weight="700" opacity=".7">z</text>` : ""}
  <ellipse class="lv-shadow" fill="#000" opacity=".18" cx="100" cy="193" rx="50" ry="4.5"/>
  <g class="lv-body" transform="${tilt}">
    <g class="lv-rim" opacity="0" fill="#FFE2B4" stroke="#FFE2B4" stroke-width="${r1(2 * rim)}" stroke-linejoin="round">${limbs("rim")}<path stroke-width="${r1(8 + 2 * rim)}" ${HANDLE}/><rect x="${CAB.x}" y="${CAB.y}" width="${CAB.w}" height="${CAB.h}" rx="7"/>${CAPS.map(cap).join("")}${LEGS}${BOOTS}</g>
    ${limbs("arm")}
    <g class="lv-tolex" fill="#292929" ${edge}>${LEGS}</g><g fill="url(#${id}t)">${LEGS}</g>
    <g class="lv-side" fill="#1B1B1B" ${edge}>${BOOTS}</g><g fill="url(#${id}b)">${BOOTS}</g>
    <path stroke="${INK}" stroke-width="${r1(8 + 2 * ol)}" ${HANDLE}/><path class="lv-leather" stroke="#55331B" stroke-width="8" ${HANDLE}/><path stroke="#fff" stroke-opacity=".22" stroke-width="2" d="M81 15 C82 5 118 5 119 15" fill="none" stroke-linecap="round"/>
    <g class="lv-nickel" fill="#948573" ${edge}><rect x="71" y="14" width="13" height="8" rx="2"/><rect x="116" y="14" width="13" height="8" rx="2"/></g>
    <rect class="lv-side" fill="#1B1B1B" x="${CAB.x}" y="${CAB.y}" width="${CAB.w}" height="${CAB.h}" rx="7"/>
    <rect class="lv-tolex" fill="#292929" x="${CAB.x}" y="${CAB.y}" width="${CAB.w - 9}" height="${CAB.h}" rx="7"/>
    <rect fill="url(#${id}t)" x="${CAB.x}" y="${CAB.y}" width="${CAB.w}" height="${CAB.h}" rx="7"/><rect fill="url(#${id}b)" x="${CAB.x}" y="${CAB.y}" width="${CAB.w}" height="${CAB.h}" rx="7"/>
    <rect x="${CAB.x}" y="${CAB.y}" width="${CAB.w}" height="${CAB.h}" rx="7" fill="none" ${edge}/>
    <rect x="${P.x - 3}" y="${P.y - 3}" width="${P.w + 6}" height="${G.y + G.h - P.y + 6}" rx="5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <rect class="lv-panel-sh" fill="#D9982A" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="4"/>
    <rect class="lv-panel" fill="#F0B23A" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h - 4}" rx="4"/>
    <rect fill="url(#${id}s)" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="4"/>
    <rect class="lv-inks" x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="4" fill="none" stroke="${INK}" stroke-width="${ol}"/>
    ${eye(82)}${eye(118)}${brows}
    ${mouth}
    ${KNOBS.map(([x, a]) => `<circle fill="${INK}" opacity=".35" cx="${x + .6}" cy="72.8" r="6"/><circle class="lv-knob" fill="#E8D5B3" cx="${x}" cy="71.5" r="5.8"/><circle fill="url(#${id}k)" cx="${x}" cy="71.5" r="5.8" stroke="${INK}" stroke-width="${r1(ol * .75)}"/><path class="lv-inks" d="M${x} 71.5 V66.4" ${stroke(1.7)} transform="rotate(${a} ${x} 71.5)"/>`).join("")}
    <rect class="lv-cloth" fill="#767572" x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="3"/>
    <path class="lv-weave" d="${WEAVE}" fill="none" stroke="#5A5956" stroke-width=".9" opacity=".95"/><circle class="lv-weave" cx="100" cy="113" r="20" fill="none" stroke="#5A5956" stroke-width="1.3" opacity=".4"/>
    <rect class="lv-cloth-sh" x="${G.x + 1.5}" y="${G.y + 1.5}" width="${G.w - 3}" height="${G.h - 3}" rx="2" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="3"/>
    <rect class="lv-inks" x="${G.x}" y="${G.y}" width="${G.w}" height="${G.h}" rx="3" fill="none" stroke="${INK}" stroke-width="${ol}"/>
    <g class="lv-nickel" fill="#948573" ${edge}>${CAPS.map(cap).join("")}</g><g fill="url(#${id}n)">${CAPS.map(cap).join("")}</g><g fill="${INK}" opacity=".45">${CAPS.map(([x, y]) => `<circle cx="${x + 8}" cy="${y + 8}" r="1.5"/>`).join("")}</g>
    ${limbs("hand")}
  </g></g>
</svg>`;
}
