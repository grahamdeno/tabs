// Louie, The Road's mascot: a little combo amp. Version 4 draws him flat, with no outlines: a
// darker right side for depth, a soft highlight stripe, a two-tone panel for a face, round eyes,
// a strip of four knobs, the speaker for a mouth, chrome corner bumpers, a blank plate (4.86.0, from a Gemini redesign)
// and mitten hands that can throw the horns. His colours come from the
// palette (the --lv-* variables in styles.css), so he matches Light, Dark and Green Room.
// louie(mood, { pose, size }) returns an <svg> string.
//   moods: happy, cheer, sleepy, worried, proud
//   poses: rest, hornsUp, thumb, point, wave, peace (no arms when absent)
//   No hand ever shows one finger standing straight up: it reads as the middle finger (Graham, 4.39.1).

/* hands are drawn with the wrist at 0,0 and the fingers pointing up (negative y).
   4.86.0: each hand is one mitten: the fingers grow out of the palm, creases instead of stuck-on knuckles, a shade copy
   under the lit one like his body, and a cuff at the wrist. */
const mitt = (shape, creases = "", over = "") => `<g class="lv-fs" transform="translate(1.25 1.9)">${shape}${over}</g><g class="lv-f">${shape}</g>`
  + `<g class="lv-fl" fill="none" stroke-width="1.9" stroke-linecap="round">${creases}</g>${over ? `<g class="lv-fs" transform="translate(0 1.6)">${over}</g><g class="lv-f">${over}</g>` : ""}`
  + `<rect class="lv-cuff" x="-9.5" y="-3.2" width="19" height="6.4" rx="3.2"/>`;
const finger = (x, len, r) => `<rect x="${x - 4.6}" y="${-22 - len}" width="9.2" height="${len + 6}" rx="4.6" transform="rotate(${r} ${x} -20)"/>`;
const PALM = `<path d="M-13 -4C-15.5 -11 -15.5 -20 -12.5 -25C-8 -28 8 -28 12.5 -25C15.5 -20 15.5 -11 13 -4C8 1 -8 1 -13 -4Z"/>`;
const ROLLS = "C16.5 -26.5 16 -23.5 13.5 -21.5C16.5 -19 16 -15.5 13.5 -13.5C16.5 -11 16 -7 13 -5C12 0 6 1 0 1C-6 1 -10 1 -11 -1Z";
const THUMB_ACROSS = `<path d="M-12.5 -15C-6 -18.5 4 -18.5 8.5 -15C10.5 -13 9.5 -10 7.5 -9.5C1 -8 -6 -8.5 -12 -10Z"/>`;
const HANDS = {
  fist: () => mitt(`<path d="M-13 -3C-16 -9 -16 -20 -12 -25Q-9 -29 -5.5 -26.5Q-2 -29.5 1.5 -26.5Q5 -29.5 8.5 -26.5Q12.5 -28 14 -23C16 -17 15.5 -9 13 -3C8 1 -8 1 -13 -3Z"/>`,
    `<path d="M-5.5 -26V-21M1.5 -26V-21M8.5 -26V-21"/>`, THUMB_ACROSS),
  horns: () => mitt(`<path d="M-13 -3C-15.5 -9 -15.5 -17 -13.5 -22L-14.5 -38C-14.8 -43.5 -5 -44.5 -4.6 -38.5L-4 -26.5C-1.5 -28.5 2 -28.5 4.6 -26.5L5.4 -34.5C5.8 -40.5 15 -40 14.4 -34L13.4 -20C15.4 -14 15 -8 12.5 -3C8 1 -8.5 1 -13 -3Z"/>`,
    `<path d="M-4 -24Q0 -21.5 4.6 -24"/>`, THUMB_ACROSS),
  /* a thumbs up like the emoji: the fingers curled on the front edge, a short thumb up from the back of the fist.
     Never one finger standing straight up from the middle (that reads as the middle finger). */
  thumb: () => mitt(`<path d="M-11 -1C-13 -8 -14 -18 -13 -27C-14 -35 -15 -42 -12 -46C-9 -50 -3 -49 -2 -44C-1.5 -40 -1.5 -36 -1 -32C4 -33.5 11 -33 13.5 -29.5${ROLLS}"/>`,
    `<path d="M2 -21.5Q8 -20.5 13.5 -21.5M2 -13.5Q8 -12.5 13.5 -13.5M3 -5.5Q8 -4.8 13 -5M-1 -32Q-5 -30 -9 -31"/>`),
  /* pointing: the index finger out from the front of the fist and the thumb tucked; the pose turns it toward the
     speech bubble, so it never stands straight up */
  point: () => mitt(`<path d="M-11 -1C-13 -8 -14 -18 -13 -26C-12.5 -31 -8 -33 -3 -33L3 -33L3.5 -49C3.7 -55 13.3 -55 13.5 -49L13.6 -30${ROLLS}"/>`,
    `<path d="M3 -30.5Q8 -29.5 13.5 -30M2 -21.5Q8 -20.5 13.5 -21.5M2 -13.5Q8 -12.5 13.5 -13.5M-12 -20Q-5 -17 2 -20"/>`),
  wave: () => mitt(`${PALM}${finger(-9, 17, -14)}${finger(-3, 23, -5)}${finger(3.5, 24, 4)}${finger(9.5, 20, 13)}<rect x="-21" y="-19" width="9.2" height="18" rx="4.6" transform="rotate(-38 -12 -8)"/>`,
    `<path d="M-6 -24.5V-21M0.3 -25V-21.5M6.6 -24.5V-21"/>`),
  peace: () => mitt(`${PALM}${finger(-4.5, 24, -12)}${finger(4.5, 25, 12)}`, `<path d="M-1 -10Q0 -16 1 -22"/>`, THUMB_ACROSS)
};
/* shoulder x,y → wrist x,y, the hand's turn, and the sign */
const POSES = {
  rest: [[38, 128, 22, 160, 200, "fist"], [162, 128, 178, 160, 160, "fist"]],
  hornsUp: [[40, 118, 6, 54, -22, "horns"], [160, 118, 194, 54, 22, "horns"]],
  thumb: [[38, 128, 22, 160, 200, "fist"], [160, 118, 198, 92, 14, "thumb"]],
  point: [[38, 128, 22, 160, 200, "fist"], [160, 122, 180, 108, 40, "point"]],
  wave: [[38, 128, 22, 160, 200, "fist"], [160, 116, 196, 50, 18, "wave"]],
  peace: [[38, 128, 22, 160, 200, "fist"], [160, 116, 194, 52, 16, "peace"]]
};

export function louie(mood = "happy", { pose, size = 120, label = "Louie" } = {}) {
  const arms = pose && POSES[pose];
  const sleepy = mood === "sleepy", proud = mood === "proud", worried = mood === "worried", cheer = mood === "cheer";
  const dx = worried ? -2 : 3, py = worried ? 78 : 76;
  const eye = x => cheer ? `<path class="lv-p" d="M${x - 15} 80 Q${x} 60 ${x + 15} 80 Q${x} 70 ${x - 15} 80Z"/>`
    : sleepy ? `<ellipse cx="${x}" cy="74" rx="17" ry="19" fill="#fff"/><circle class="lv-p" cx="${x + 2}" cy="80" r="8"/><path class="lv-fs" d="M${x - 18} 74 A18 19 0 0 1 ${x + 18} 74 Z"/><path class="lv-ps" d="M${x - 14} 75 Q${x} 81 ${x + 14} 75" fill="none" stroke-width="3.4" stroke-linecap="round"/>`
    : `<g class="lv-eye"><ellipse cx="${x}" cy="74" rx="17" ry="19" fill="#fff"/><circle class="lv-p" cx="${x + dx}" cy="${py}" r="9.5"/><circle cx="${x + dx + 3}" cy="${py - 4}" r="3.4" fill="#fff"/></g>`;
  const brows = worried ? `<path class="lv-p" d="M64 50 L88 56 L86 60 L62 54Z"/><path class="lv-p" d="M136 50 L112 56 L114 60 L138 54Z"/>`
    : cheer || sleepy || proud ? "" : `<rect class="lv-p" x="64" y="46" width="24" height="6" rx="3" transform="rotate(-6 76 49)"/><rect class="lv-p" x="112" y="46" width="24" height="6" rx="3" transform="rotate(6 124 49)"/>`;
  const shades = proud ? `<path class="lv-p" d="M56 62 h40 v8 q0 18 -20 18 q-20 0 -20 -18z"/><path class="lv-p" d="M104 62 h40 v8 q0 18 -20 18 q-20 0 -20 -18z"/><rect class="lv-p" x="94" y="64" width="12" height="5" rx="2.5"/><path d="M64 68 l10 -3 M112 68 l10 -3" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>` : "";
  const mouth = {
    happy: `<path class="lv-m" d="M80 124 Q100 146 120 124Z"/><path class="lv-t" d="M90 135 Q100 141 110 135 Q100 131 90 135Z"/>`,
    cheer: `<path class="lv-m" d="M74 120 Q100 160 126 120Z"/><ellipse class="lv-t" cx="100" cy="141" rx="12" ry="6"/>`,
    sleepy: `<path class="lv-ms" d="M88 134 Q100 139 112 134" fill="none" stroke-width="5" stroke-linecap="round"/>`,
    worried: `<path class="lv-m" d="M84 138 Q100 124 116 138 Q100 132 84 138Z"/>`,
    proud: `<path class="lv-ms" d="M80 128 Q104 146 124 124" fill="none" stroke-width="6" stroke-linecap="round"/>`
  }[mood] || "";
  const tilt = cheer ? "rotate(-5 100 110)" : proud ? "rotate(4 100 110)" : "";
  const limbs = layer => !arms ? "" : arms.map(([sx, sy, wx, wy, rot, sign]) => {
    const mx = (sx + wx) / 2 + (wx < sx ? -10 : 10), my = Math.min(sy, wy) + (wy < sy ? 8 : 14);
    return layer === "arm" ? `<path class="lv-l" d="M${sx} ${sy} Q${mx} ${my} ${wx} ${wy}" fill="none" stroke-width="15" stroke-linecap="round"/>`
      : `<g transform="translate(${wx} ${wy}) rotate(${rot}) scale(0.97 1.17)">${HANDS[sign]()}</g>`;
  }).join("");
  const vb = arms ? "-34 -30 268 236" : "18 0 164 200";
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg class="louie ${mood}${pose ? " " + pose : ""}" width="${size}" height="${Math.round(size * vh / vw)}" viewBox="${vb}" role="img" aria-label="${label}">
  ${sleepy ? `<text class="lv-z" x="160" y="24" font-family="Fredoka,system-ui,sans-serif" font-size="22" font-weight="700">z</text><text class="lv-z" x="176" y="8" font-family="Fredoka,system-ui,sans-serif" font-size="15" font-weight="700" opacity=".7">z</text>` : ""}
  <ellipse class="lv-shadow" cx="100" cy="190" rx="54" ry="6"/>
  <g class="lv-body" transform="${tilt}">
    ${limbs("arm")}
    <rect class="lv-s" x="62" y="166" width="30" height="20" rx="10"/><rect class="lv-s" x="108" y="166" width="30" height="20" rx="10"/>
    <path class="lv-ss" d="M73 34 Q73 10 100 10 Q127 10 127 34" fill="none" stroke-width="12" stroke-linecap="round"/>
    <rect class="lv-s" x="30" y="28" width="140" height="148" rx="38"/>
    <rect class="lv-b" x="30" y="28" width="128" height="148" rx="38"/>
    <rect class="lv-hi" x="44" y="36" width="54" height="9" rx="4.5"/>
    <g class="lv-cn" fill="none" stroke-width="9" stroke-linecap="round"><path d="M34.5 56 A33.5 33.5 0 0 1 58 32.5"/><path d="M142 32.5 A33.5 33.5 0 0 1 165.5 56"/><path d="M34.5 148 A33.5 33.5 0 0 0 58 171.5"/><path d="M142 171.5 A33.5 33.5 0 0 0 165.5 148"/></g><g class="lv-cnh" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M37 55 A31 31 0 0 1 57 35"/><path d="M143 35 A31 31 0 0 1 163 55"/></g>
    <rect class="lv-fs" x="46" y="48" width="108" height="58" rx="20"/>
    <rect class="lv-f" x="46" y="48" width="108" height="50" rx="20"/>
    <ellipse class="lv-c" cx="60" cy="96" rx="8" ry="5"/><ellipse class="lv-c" cx="140" cy="96" rx="8" ry="5"/>
    ${proud ? "" : eye(77) + eye(123)}${brows}${shades}
    <rect class="lv-s" x="48" y="109" width="104" height="17" rx="8.5"/>
    <rect class="lv-g" x="48" y="128" width="104" height="34" rx="12"/>${[70, 90, 110, 130].map(x => `<circle class="lv-gs" cx="${x}" cy="118.6" r="5.6"/><circle class="lv-k" cx="${x}" cy="117.4" r="5"/><rect class="lv-gs" x="${x - .9}" y="112.6" width="1.8" height="4.4" rx=".9"/>`).join("")}
    ${[135, 141.5, 148, 154.5].map(y => `<rect class="lv-gs" x="58" y="${y}" width="${y > 150 ? 74 : 84}" height="3.6" rx="1.8"/>`).join("")}
    <g transform="translate(0 6)">${mouth}</g>
    <rect class="lv-k" x="86" y="165" width="28" height="8" rx="2"/><circle class="lv-gs" cx="89" cy="169" r="1.1"/><circle class="lv-gs" cx="111" cy="169" r="1.1"/>
    <circle class="lv-lamp" cx="142" cy="153" r="4"/>
    ${limbs("hand")}
  </g>
</svg>`;
}
