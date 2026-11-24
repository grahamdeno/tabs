// Louie, the mascot (Graham, 2026-11-19): a tweed combo amp. His face is on the grille cloth, a gold control plate
// with two knobs sits under it, and he has cream gloves and brown boots. He is always a picture, never a drawing:
// art/louie/v5/louie-<pose>.webp, the clean cut-outs (the first cut-outs stay in art/louie/v4).
// Every earlier Louie (the black one, the blue one and the code drawing) is gone.
// Ten poses, each with its own picture: cheer, horns, idle, listen, nervous, point, proud, sleepy, thumb, wave.
// A coloured cabinet is art/louie/colours/<finish>/, the tweed only. The face, grille, panel and limbs stay.
// louie(mood, { pose, size }) returns an <svg> string that shows the picture.
//   moods: happy, cheer, sleepy, worried, proud, listen (a hand to his ear, for when the app is listening)
//   poses: rest, hornsUp, thumb, point, wave, peace

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

/* Which picture: mood first, then the pose. */
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
/* Every pose has its own picture now, including nervous. */
export const LOUIE_STAND_IN = {};
const FINISHES = new Set(["pink", "teal", "black", "mint", "gold"]);
export const louiePic = (art, finish = "") => {
  const pose = LOUIE_STAND_IN[art] || art;
  let fin = finish;
  if (!fin && typeof document !== "undefined") fin = document.body?.dataset.wear || "";
  if (FINISHES.has(fin)) return `art/louie/front/${fin}/louie-${pose}.webp`;
  return `art/louie/v5/louie-${pose}.webp`;
};

const ARMS = new Set(["rest", "hornsUp", "thumb", "point", "wave", "peace"]);
export function louie(mood = "happy", { pose, size = 120, label = "Louie", finish = "" } = {}) {
  /* the frame is the one the earlier Louies had, so every place that shows him keeps its size: wider when a pose has arms */
  const vb = ARMS.has(pose) ? "-34 -30 268 236" : "18 0 164 200";
  const [vx, vy, vw, vh] = vb.split(" ").map(Number);
  return `<svg class="louie ${mood}${pose ? " " + pose : ""}" width="${size}" height="${Math.round(size * vh / vw)}" viewBox="${vb}" role="img" aria-label="${label}">
  <g class="lv-art-wrap"><image class="lv-art" href="${louiePic(louieArt(mood, pose, size), finish)}" x="${vx}" y="${vy}" width="${vw}" height="${vh}" preserveAspectRatio="xMidYMax meet"/></g>
</svg>`;
}
