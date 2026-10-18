// Louie, the Tabs mascot: a little combo amp. Flat, chunky shapes in the app's
// colours: a tolex body with a bronze rim, a gold control panel for a face,
// amber lamp eyes, the speaker grille for a mouth, and mitten hands that can
// throw the horns. louie(mood, { pose, size }) returns an <svg> string.
//   moods: happy, cheer, sleepy, worried, proud
//   poses: rest, hornsUp, thumb, point, wave, peace (no arms when absent)
const C = { body: "#2f2d34", edge: "#4a4751", rim: "#c9a15f", gold: "#f0c97c", goldDk: "#d9ac5e", grille: "#463b31", stripe: "#544739", mouth: "#1d1410", tongue: "#ff7f5e", cheek: "#ff8a5c", iris: "#ffad33", pupil: "#241306" };

const cap = (x, y, w, h, fill = C.gold) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${fill}"/>`;
/* hands are drawn with the wrist at 0,0 and the fingers pointing up (negative y) */
const HANDS = {
  fist: () => `<circle cx="0" cy="-9" r="12" fill="${C.gold}"/>${cap(-13, -13, 9, 12, C.goldDk)}`,
  horns: () => cap(-12, -40, 10, 30) + cap(3, -36, 9, 26) + `<circle cx="0" cy="-10" r="13" fill="${C.gold}"/>` + cap(-15, -15, 18, 9, C.goldDk),
  thumb: () => cap(-6, -42, 11, 28) + `<rect x="-14" y="-24" width="28" height="22" rx="11" fill="${C.gold}"/>` + cap(-10, -17, 20, 4, C.goldDk),
  point: () => cap(-5, -44, 10, 30) + `<rect x="-13" y="-22" width="26" height="22" rx="11" fill="${C.gold}"/>` + cap(-16, -16, 12, 9, C.goldDk),
  wave: () => [[-12, -12], [-5, -4], [3, 4], [10, 14]].map(([x, r]) => `<g transform="rotate(${r} ${x + 4} -12)">${cap(x, -36, 8, 26)}</g>`).join("") + `<circle cx="0" cy="-10" r="13" fill="${C.gold}"/>` + `<g transform="rotate(-55 -12 -6)">${cap(-16, -20, 9, 18, C.goldDk)}</g>`,
  peace: () => `<g transform="rotate(-12 -5 -12)">${cap(-10, -42, 10, 32)}</g><g transform="rotate(12 5 -12)">${cap(0, -42, 10, 32)}</g><circle cx="0" cy="-10" r="13" fill="${C.gold}"/>` + cap(-15, -15, 18, 9, C.goldDk)
};
/* shoulder x,y → wrist x,y, the hand's turn, and the sign */
const POSES = {
  rest: [[38, 128, 22, 160, 200, "fist"], [162, 128, 178, 160, 160, "fist"]],
  hornsUp: [[40, 118, 6, 54, -22, "horns"], [160, 118, 194, 54, 22, "horns"]],
  thumb: [[38, 128, 22, 160, 200, "fist"], [160, 118, 198, 92, 14, "thumb"]],
  point: [[38, 128, 22, 160, 200, "fist"], [160, 124, 200, 120, 90, "point"]],
  wave: [[38, 128, 22, 160, 200, "fist"], [160, 116, 196, 50, 18, "wave"]],
  peace: [[38, 128, 22, 160, 200, "fist"], [160, 116, 194, 52, 16, "peace"]]
};

export function louie(mood = "happy", { pose, size = 120, label = "Louie" } = {}) {
  const arms = pose && POSES[pose];
  const eyesOff = mood === "sleepy", proud = mood === "proud";
  const eye = (x) => proud ? "" : `<g class="lv-eye">
      <circle cx="${x}" cy="72" r="21" fill="#fff"/>
      <circle cx="${x + 1}" cy="${mood === "worried" ? 75 : 73}" r="${mood === "cheer" ? 12 : 13.5}" fill="${eyesOff ? "#c98a3a" : C.iris}"/>
      <circle cx="${x + 2}" cy="${mood === "worried" ? 76 : 74}" r="${mood === "cheer" ? 6 : 7.5}" fill="${C.pupil}"/>
      <circle cx="${x - 4}" cy="67" r="4.4" fill="#fff"/>
      ${eyesOff ? `<path d="M${x - 22} 72 A22 22 0 0 1 ${x + 22} 72 Z" fill="${C.goldDk}"/><path d="M${x - 16} 73 Q${x} 80 ${x + 16} 73" fill="none" stroke="${C.pupil}" stroke-width="3" stroke-linecap="round"/>` : ""}
    </g>`;
  const brows = mood === "worried" ? `<path d="M58 46 L90 40 M110 40 L142 46" stroke="${C.pupil}" stroke-width="5" stroke-linecap="round"/>`
    : mood === "cheer" ? `<path d="M60 44 Q77 34 94 44 M106 44 Q123 34 140 44" fill="none" stroke="${C.pupil}" stroke-width="5" stroke-linecap="round"/>` : "";
  const shades = proud ? `<path d="M56 60 h40 v8 q0 18 -20 18 q-20 0 -20 -18z" fill="#141216"/><path d="M104 60 h40 v8 q0 18 -20 18 q-20 0 -20 -18z" fill="#141216"/><rect x="94" y="62" width="12" height="5" rx="2.5" fill="#141216"/><path d="M64 66 l10 -3 M112 66 l10 -3" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>` : "";
  const mouth = {
    happy: `<path d="M74 122 Q100 150 126 122 Z" fill="${C.mouth}"/><path d="M88 136 Q100 144 112 136 Q100 131 88 136Z" fill="${C.tongue}"/>`,
    cheer: `<path d="M70 118 Q100 164 130 118 Z" fill="${C.mouth}"/><ellipse cx="100" cy="143" rx="15" ry="7" fill="${C.tongue}"/>`,
    sleepy: `<path d="M88 134 Q100 139 112 134" fill="none" stroke="${C.mouth}" stroke-width="5" stroke-linecap="round"/>`,
    worried: `<path d="M82 136 q9 -8 18 0 q9 8 18 0" fill="none" stroke="${C.mouth}" stroke-width="5" stroke-linecap="round"/>`,
    proud: `<path d="M76 126 Q104 148 128 122" fill="none" stroke="${C.mouth}" stroke-width="6" stroke-linecap="round"/>`
  }[mood] || "";
  const tilt = mood === "cheer" ? "rotate(-6 100 110)" : proud ? "rotate(4 100 110)" : "";
  const limbs = (layer) => !arms ? "" : arms.map(([sx, sy, wx, wy, rot, sign]) => {
    const mx = (sx + wx) / 2 + (wx < sx ? -10 : 10), my = Math.min(sy, wy) + (wy < sy ? 8 : 14);
    return layer === "arm" ? `<path d="M${sx} ${sy} Q${mx} ${my} ${wx} ${wy}" fill="none" stroke="#45424c" stroke-width="16" stroke-linecap="round"/>`
      : `<g transform="translate(${wx} ${wy}) rotate(${rot}) scale(1.3)">${HANDS[sign]()}</g>`;
  }).join("");
  const vb = arms ? "-34 -30 268 236" : "18 0 164 200";
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg class="louie ${mood}${pose ? " " + pose : ""}" width="${size}" height="${Math.round(size * vh / vw)}" viewBox="${vb}" role="img" aria-label="${label}">
  ${mood === "sleepy" ? `<text x="160" y="24" font-family="-apple-system,system-ui,sans-serif" font-size="22" font-weight="800" fill="#a99b80">z</text><text x="176" y="8" font-family="-apple-system,system-ui,sans-serif" font-size="15" font-weight="800" fill="#a99b80" opacity=".7">z</text>` : ""}
  <ellipse class="lv-shadow" cx="100" cy="188" rx="54" ry="6" fill="#000" opacity=".28"/>
  <g class="lv-body" transform="${tilt}">
    ${limbs("arm")}
    <rect x="62" y="166" width="28" height="16" rx="8" fill="${C.body}"/><rect x="110" y="166" width="28" height="16" rx="8" fill="${C.body}"/>
    <path d="M74 34 Q74 14 100 14 Q126 14 126 34" fill="none" stroke="${C.body}" stroke-width="11" stroke-linecap="round"/>
    <rect x="32" y="28" width="136" height="146" rx="36" fill="${C.body}" stroke="${C.edge}" stroke-width="3"/>
    <rect x="40" y="36" width="120" height="130" rx="29" fill="none" stroke="${C.rim}" stroke-width="5"/>
    <rect x="48" y="44" width="104" height="60" rx="18" fill="${C.goldDk}"/>
    <rect x="48" y="44" width="104" height="48" rx="18" fill="${C.gold}"/>
    <ellipse cx="62" cy="94" rx="8" ry="4.5" fill="${C.cheek}" opacity=".55"/><ellipse cx="138" cy="94" rx="8" ry="4.5" fill="${C.cheek}" opacity=".55"/>
    ${eye(77)}${eye(123)}${brows}${shades}
    <rect x="50" y="110" width="100" height="48" rx="15" fill="${C.grille}"/>
    <rect x="58" y="120" width="84" height="4" rx="2" fill="${C.stripe}"/><rect x="58" y="132" width="84" height="4" rx="2" fill="${C.stripe}"/><rect x="58" y="144" width="84" height="4" rx="2" fill="${C.stripe}"/>
    ${mouth}
    <circle cx="140" cy="150" r="3.5" fill="${C.iris}"/>
    ${limbs("hand")}
  </g>
</svg>`;
}
