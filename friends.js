// Louie's friends (for Your band): the players who join you, drawn the way Louie is. Flat colour and no
// outlines, a darker side for depth, a soft highlight stripe, round white eyes with a glint, cheeks and a
// small smile. Each is drawn in a 200 x 200 box, standing on a shadow.
// friend(id, { size, mood }) returns an <svg> string; FRIENDS lists them in the order they join.
//   moods: happy, cheer, cool (Jax and Slide wear their attitude whatever the mood)

const C = {
  ink: "#14213D", inkSoft: "#2A3A63", white: "#FFFFFF", cheek: "#FF7AA8",
  pink: "#FF3D7F", pinkD: "#C91F5C", pinkL: "#FF8FB5",
  orange: "#FF8A00", orangeD: "#C96A00", orangeL: "#FFB255",
  yellow: "#FFD23F", yellowD: "#E0A800", yellowL: "#FFE58A",
  blue: "#3A86FF", blueD: "#2C6FE0", blueL: "#8DB8FF",
  teal: "#0FB5A6", tealD: "#0B8C80",
  purple: "#7B4DFF", purpleD: "#5A32D6", purpleL: "#A98BFF",
  red: "#FF4D4D", redD: "#D63333",
  silver: "#C9D3E3", silverD: "#94A3BC", silverL: "#EEF2F8",
  wood: "#C77A3A", woodD: "#9A5524", woodL: "#E3A46A",
  tan: "#E8B878", tanD: "#C08E4C",
  green: "#3CC46B", greenD: "#259A4E",
  black: "#2B2D42", blackD: "#16172A"
};

/* eyes, cheeks and a mouth around (x, y); s scales them */
function face(x, y, s = 1, mood = "happy", { brows = "", shades = false, mouth = "smile" } = {}) {
  s *= 1.35; /* big eyes, like Louie's */
  const ex = 19 * s, er = 10 * s;
  const eye = cx => mood === "cheer"
    ? `<path d="M${cx - er} ${y + 3 * s} Q${cx} ${y - 11 * s} ${cx + er} ${y + 3 * s} Q${cx} ${y - 4 * s} ${cx - er} ${y + 3 * s}Z" fill="${C.ink}"/>`
    : `<ellipse cx="${cx}" cy="${y}" rx="${er}" ry="${er * 1.12}" fill="${C.white}"/><circle cx="${cx + 2 * s}" cy="${y + 1.5 * s}" r="${er * 0.56}" fill="${C.ink}"/><circle cx="${cx + 4 * s}" cy="${y - 1.5 * s}" r="${er * 0.2}" fill="${C.white}"/>`;
  const eyes = shades
    ? `<path d="M${x - ex - er - 2 * s} ${y - 6 * s} h${2 * er + 4 * s} v${4 * s} q0 ${10 * s} ${-(er + 2 * s)} ${10 * s} q${-(er + 2 * s)} 0 ${-(er + 2 * s)} ${-10 * s}z" fill="${C.ink}"/><path d="M${x + ex - er - 2 * s} ${y - 6 * s} h${2 * er + 4 * s} v${4 * s} q0 ${10 * s} ${-(er + 2 * s)} ${10 * s} q${-(er + 2 * s)} 0 ${-(er + 2 * s)} ${-10 * s}z" fill="${C.ink}"/><rect x="${x - ex + er}" y="${y - 5 * s}" width="${2 * (ex - er)}" height="${3 * s}" rx="${1.5 * s}" fill="${C.ink}"/><path d="M${x - ex - 6 * s} ${y - 2 * s} l${6 * s} -${2 * s} M${x + ex - 6 * s} ${y - 2 * s} l${6 * s} -${2 * s}" stroke="${C.white}" stroke-width="${2.4 * s}" stroke-linecap="round" opacity=".7"/>`
    : eye(x - ex) + eye(x + ex);
  const browsSvg = brows === "cross"
    ? `<path d="M${x - ex - er} ${y - 15 * s} L${x - ex + er} ${y - 10 * s} L${x - ex + er - 1} ${y - 7 * s} L${x - ex - er - 1} ${y - 12 * s}Z M${x + ex + er} ${y - 15 * s} L${x + ex - er} ${y - 10 * s} L${x + ex - er + 1} ${y - 7 * s} L${x + ex + er + 1} ${y - 12 * s}Z" fill="${C.ink}"/>`
    : "";
  const cheeks = `<ellipse cx="${x - ex - 4 * s}" cy="${y + 14 * s}" rx="${6 * s}" ry="${3.6 * s}" fill="${C.cheek}" opacity=".55"/><ellipse cx="${x + ex + 4 * s}" cy="${y + 14 * s}" rx="${6 * s}" ry="${3.6 * s}" fill="${C.cheek}" opacity=".55"/>`;
  const my = y + 16 * s;
  const m = mood === "cheer" || mouth === "open"
    ? `<path d="M${x - 11 * s} ${my - 2 * s} Q${x} ${my + 16 * s} ${x + 11 * s} ${my - 2 * s}Z" fill="${C.ink}"/><ellipse cx="${x}" cy="${my + 7 * s}" rx="${5 * s}" ry="${2.6 * s}" fill="${C.pink}"/>`
    : mouth === "flat" ? `<rect x="${x - 7 * s}" y="${my + 1 * s}" width="${14 * s}" height="${3.4 * s}" rx="${1.7 * s}" fill="${C.ink}"/>`
    : mouth === "smirk" ? `<path d="M${x - 8 * s} ${my + 2 * s} Q${x + 2 * s} ${my + 9 * s} ${x + 10 * s} ${my}" fill="none" stroke="${C.ink}" stroke-width="${3.4 * s}" stroke-linecap="round"/>`
    : `<path d="M${x - 9 * s} ${my} Q${x} ${my + 11 * s} ${x + 9 * s} ${my}Z" fill="${C.ink}"/>`;
  return cheeks + eyes + browsSvg + m;
}
/* a body with a darker side: the shape drawn twice, the shade nudged right and down */
const solid = (shape, fill, shade, dx = 8, dy = 6) => shape(shade, dx, dy) + shape(fill, 0, 0);
const hi = (x, y, w, h = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" opacity=".45"/>`;
const feet = (y, col, xs = [78, 122]) => xs.map(x => `<rect x="${x - 13}" y="${y}" width="26" height="16" rx="8" fill="${col}"/>`).join("");
const arm = (x1, y1, x2, y2, col) => `<path d="M${x1} ${y1} Q${(x1 + x2) / 2 + (x2 > x1 ? 6 : -6)} ${Math.min(y1, y2) + 10} ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="9" stroke-linecap="round"/><circle cx="${x2}" cy="${y2}" r="8" fill="${col}"/>`;

const DRAW = {
  lola: m => { /* acoustic guitar, warm tones, a flower crown */
    const body = (f, dx, dy) => `<path d="M${100 + dx} ${86 + dy} c-34 0 -48 20 -40 40 c4 10 0 14 -6 22 c-12 18 4 40 46 40 c42 0 58 -22 46 -40 c-6 -8 -10 -12 -6 -22 c8 -20 -6 -40 -40 -40z" fill="${f}"/>`;
    return `<rect x="92" y="14" width="16" height="80" rx="6" fill="${C.woodD}"/><rect x="90" y="12" width="14" height="80" rx="6" fill="${C.wood}"/>
      <rect x="86" y="4" width="26" height="22" rx="8" fill="${C.woodD}"/>
      ${[[90, 10], [104, 8], [97, 2]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="6" fill="${[C.pink, C.yellow, C.blue][i]}"/><circle cx="${x}" cy="${y}" r="2.4" fill="${C.white}"/>`).join("")}
      ${solid(body, C.orange, C.orangeD)}${hi(70, 100, 40)}
      <circle cx="100" cy="158" r="13" fill="${C.orangeD}"/><circle cx="100" cy="158" r="9" fill="${C.woodD}"/>
      <rect x="80" y="176" width="40" height="7" rx="3.5" fill="${C.woodD}"/>
      ${face(100, 118, 0.85, m)}${feet(184, C.orangeD)}`;
  },
  jax: m => { /* effects pedal, electric yellow, a little grumpy */
    const box = (f, dx, dy) => `<rect x="${40 + dx}" y="${50 + dy}" width="120" height="128" rx="26" fill="${f}"/>`;
    return `${solid(box, C.yellow, C.yellowD)}${hi(54, 58, 50)}
      <circle cx="74" cy="44" r="13" fill="${C.ink}"/><rect x="72" y="32" width="4" height="12" rx="2" fill="${C.white}"/>
      <circle cx="126" cy="44" r="13" fill="${C.ink}"/><rect x="132" y="38" width="4" height="12" rx="2" fill="${C.white}" transform="rotate(50 126 44)"/>
      <rect x="52" y="74" width="96" height="60" rx="18" fill="${C.yellowL}"/>
      ${face(100, 98, 1, m === "cheer" ? "happy" : m, { brows: "cross", mouth: m === "cheer" ? "smile" : "flat" })}
      <rect x="62" y="146" width="76" height="22" rx="11" fill="${C.inkSoft}"/><circle cx="100" cy="157" r="7" fill="${C.silver}"/>
      ${feet(178, C.yellowD)}`;
  },
  tilly: m => { /* clip-on tuner, cool blue, her screen says she's in tune */
    const head = (f, dx, dy) => `<rect x="${44 + dx}" y="${26 + dy}" width="112" height="112" rx="30" fill="${f}"/>`;
    return `<rect x="88" y="132" width="30" height="40" rx="8" fill="${C.blueD}"/><rect x="74" y="164" width="56" height="14" rx="7" fill="${C.ink}"/>
      ${solid(head, C.blue, C.blueD)}${hi(56, 34, 48)}
      <rect x="56" y="46" width="88" height="80" rx="20" fill="#D9F7EE"/>
      <path d="M68 62 a40 40 0 0 1 64 0" fill="none" stroke="${C.green}" stroke-width="5" stroke-linecap="round"/><rect x="98" y="50" width="4" height="16" rx="2" fill="${C.greenD}"/>
      ${face(100, 88, 0.9, m)}
      <rect x="60" y="180" width="80" height="0" />${feet(176, C.blueD, [86, 118])}`;
  },
  milo: m => { /* microphone: silver head, red body */
    const ball = (f, dx, dy) => `<circle cx="${100 + dx}" cy="${62 + dy}" r="48" fill="${f}"/>`;
    const handle = (f, dx, dy) => `<path d="M${66 + dx} ${104 + dy} h68 l-12 72 q-22 8 -44 0z" fill="${f}"/>`;
    return `${solid(handle, C.red, C.redD)}
      ${solid(ball, C.silver, C.silverD, 6, 4)}
      ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => { const x = 66 + c * 14 + (r % 2) * 7, y = 30 + r * 13; return Math.hypot(x - 100, y - 62) < 40 ? `<circle cx="${x}" cy="${y}" r="3" fill="${C.silverD}"/>` : ""; }).join("")).join("")}
      <path d="M66 50 a36 36 0 0 1 22 -24" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" opacity=".6"/>
      <rect x="62" y="100" width="76" height="14" rx="7" fill="${C.silverD}"/>
      ${face(100, 134, 0.85, m)}${feet(178, C.redD, [86, 114])}`;
  },
  bex: m => { /* bass amp, deep purple, one big speaker */
    const cab = (f, dx, dy) => `<rect x="${32 + dx}" y="${30 + dy}" width="136" height="150" rx="28" fill="${f}"/>`;
    return `<path d="M80 30 q0 -18 20 -18 q20 0 20 18" fill="none" stroke="${C.purpleD}" stroke-width="10" stroke-linecap="round"/>
      ${solid(cab, C.purple, C.purpleD)}${hi(46, 38, 56)}
      <rect x="46" y="48" width="108" height="44" rx="16" fill="${C.purpleL}"/>
      ${face(100, 66, 0.85, m)}
      <circle cx="100" cy="134" r="38" fill="${C.ink}"/><circle cx="100" cy="134" r="27" fill="${C.inkSoft}"/><circle cx="100" cy="134" r="11" fill="${C.ink}"/><circle cx="96" cy="130" r="3.5" fill="#fff" opacity=".35"/>
      ${feet(178, C.purpleD)}`;
  },
  pip: m => { /* a guitar pick: the classic shape, round shoulders and a soft point, sunny yellow with a grip and two small wings */
    /* a round-shouldered pick with a soft, blunt tip, wider than tall */
    const pick = (f, dx, dy) => `<path transform="translate(${dx} ${dy})" d="M100 174 C88 174 78 164 66 148 C50 126 34 102 34 76 C34 44 62 26 100 26 C138 26 166 44 166 76 C166 102 150 126 134 148 C122 164 112 174 100 174Z" fill="${f}"/>`;
    const wing = side => `<g transform="translate(${side < 0 ? 52 : 148} 80) scale(${-side} 1)"><path d="M6 6 C-14 -18 -36 -14 -40 0 C-50 6 -44 22 -32 20 C-36 32 -18 36 -2 24Z" fill="${C.blueD}"/><path d="M2 0 C-18 -24 -40 -20 -44 -6 C-54 0 -48 16 -36 14 C-40 26 -22 30 -6 18Z" fill="${C.blueL}"/><path d="M-12 2 C-24 -2 -32 4 -32 8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/></g>`;
    return `${wing(-1)}${wing(1)}${solid(pick, C.yellow, C.yellowD)}${hi(56, 34, 46)}
      ${[0, 1, 2].map(i => `<rect x="${84 + i * 12}" y="142" width="6" height="16" rx="3" fill="${C.yellowD}" opacity=".7"/>`).join("")}
      ${face(100, 84, 1, m)}${arm(52, 116, 34, 138, C.yellowD)}${arm(148, 116, 166, 138, C.yellowD)}`;
  },
  beat: m => { /* bass drum, a pink shell and a big drumhead for a face */
    const shell = (f, dx, dy) => `<ellipse cx="${100 + dx}" cy="${104 + dy}" rx="78" ry="74" fill="${f}"/>`;
    return `${solid(shell, C.pink, C.pinkD)}
      <ellipse cx="96" cy="104" rx="62" ry="60" fill="#FFE3EE"/><ellipse cx="96" cy="104" rx="62" ry="60" fill="none" stroke="${C.pinkL}" stroke-width="6"/>
      ${[0, 60, 120, 180, 240, 300].map(a => { const r = a * Math.PI / 180; return `<circle cx="${100 + 74 * Math.cos(r)}" cy="${104 + 70 * Math.sin(r)}" r="5" fill="${C.silver}"/>`; }).join("")}
      ${face(96, 100, 1.05, m)}${feet(176, C.pinkD, [62, 138])}`;
  },
  slide: m => { /* brass slide: a gold tube with shades on */
    const tube = (f, dx, dy) => `<rect x="${64 + dx}" y="${30 + dy}" width="72" height="146" rx="36" fill="${f}"/>`;
    return `${solid(tube, C.yellow, C.yellowD)}${hi(74, 46, 12, 70)}
      <rect x="64" y="150" width="72" height="10" rx="5" fill="${C.yellowD}"/>
      ${face(100, 88, 0.85, m, { shades: true, mouth: m === "cheer" ? "open" : "smirk" })}
      ${arm(64, 112, 40, 132, C.yellowD)}${arm(136, 112, 160, 96, C.yellowD)}`;
  },
  strap: m => { /* guitar strap: two woven strips, many colours, that meet at the top */
    const band = (x, rot) => `<g transform="rotate(${rot} ${x} 40)"><rect x="${x - 15}" y="40" width="30" height="140" rx="10" fill="${C.ink}"/>${Array.from({ length: 7 }, (_, i) => `<path d="M${x - 15} ${48 + i * 19} l15 9 l15 -9 v8 l-15 9 l-15 -9z" fill="${[C.pink, C.yellow, C.blue, C.green, C.orange, C.purple, C.teal][i]}"/>`).join("")}</g>`;
    return `${band(80, 14)}${band(120, -14)}
      <rect x="62" y="26" width="76" height="60" rx="22" fill="${C.wood}"/><rect x="70" y="26" width="68" height="54" rx="20" fill="${C.woodL}"/>
      ${face(102, 50, 0.75, m)}${feet(176, C.ink, [58, 142])}`;
  },
  key: m => { /* a keyboard key: white, with its two black neighbours */
    const k = (f, dx, dy) => `<rect x="${58 + dx}" y="${24 + dy}" width="84" height="152" rx="18" fill="${f}"/>`;
    return `${solid(k, "#FFFFFF", C.silverD)}
      <rect x="44" y="24" width="30" height="86" rx="10" fill="${C.ink}"/><rect x="126" y="24" width="30" height="86" rx="10" fill="${C.ink}"/>
      <rect x="49" y="30" width="8" height="40" rx="4" fill="#fff" opacity=".25"/>
      ${face(100, 128, 0.85, m)}${arm(58, 142, 36, 120, C.silverD)}${arm(142, 142, 164, 126, C.silverD)}`;
  },
  metro: m => { /* metronome: wooden, its pendulum keeping time */
    const body = (f, dx, dy) => `<path d="M${74 + dx} ${24 + dy} h52 l30 152 h-112z" fill="${f}"/>`;
    return `${solid(body, C.wood, C.woodD)}${hi(80, 34, 30)}
      <path d="M68 150 h64" stroke="${C.woodD}" stroke-width="8" stroke-linecap="round"/>
      <rect x="98" y="40" width="6" height="110" rx="3" fill="${C.ink}" transform="rotate(18 101 150)"/><rect x="100" y="70" width="18" height="12" rx="3" fill="${C.silver}" transform="rotate(18 101 150)"/>
      <rect x="62" y="96" width="76" height="44" rx="16" fill="${C.woodL}"/>
      ${face(100, 112, 0.8, m)}${feet(176, C.woodD)}`;
  },
  pickup: m => { /* a single-coil pickup: six pole pieces across the top */
    const p = (f, dx, dy) => `<rect x="${26 + dx}" y="${58 + dy}" width="148" height="92" rx="44" fill="${f}"/>`;
    return `${solid(p, C.silverL, C.silverD)}
      <rect x="40" y="68" width="120" height="70" rx="34" fill="${C.ink}"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${57 + i * 17.2}" cy="84" r="6" fill="${C.silver}"/>`).join("")}
      ${face(100, 112, 0.75, m)}${feet(150, C.silverD, [72, 128])}`;
  },
  shaker: m => { /* a maraca: a blue egg with a zigzag band on a wooden handle */
    const egg = (f, dx, dy) => `<ellipse cx="${100 + dx}" cy="${76 + dy}" rx="56" ry="62" fill="${f}"/>`;
    return `<rect x="92" y="126" width="18" height="58" rx="9" fill="${C.woodD}"/><rect x="90" y="126" width="16" height="58" rx="8" fill="${C.wood}"/>
      ${solid(egg, C.blue, C.blueD, 7, 5)}${hi(64, 28, 40)}
      <path d="M46 124 l12 -10 l12 10 l12 -10 l12 10 l12 -10 l12 10 l12 -10 l12 10 l8 -6" fill="none" stroke="${C.yellow}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
      ${[[56, 40], [140, 46], [60, 132]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="${C.blueL}"/>`).join("")}
      ${face(100, 66, 0.9, m)}`;
  },
  reverb: m => { /* a reverb tank: a chrome box with its golden springs across the top */
    const box = (f, dx, dy) => `<rect x="${24 + dx}" y="${30 + dy}" width="152" height="142" rx="24" fill="${f}"/>`;
    const spring = y => `<path d="M48 ${y} ${Array.from({ length: 13 }, () => "q4 -8 8 0").join(" ")}" fill="none" stroke="${C.yellow}" stroke-width="4.5" stroke-linecap="round"/><circle cx="46" cy="${y}" r="4" fill="${C.yellowD}"/><circle cx="154" cy="${y}" r="4" fill="${C.yellowD}"/>`;
    return `${solid(box, C.silver, C.silverD)}${hi(36, 36, 56)}
      <rect x="36" y="46" width="128" height="40" rx="12" fill="${C.ink}"/>${spring(60)}${spring(74)}
      <rect x="42" y="96" width="116" height="58" rx="18" fill="${C.silverL}"/>
      ${face(100, 118, 0.85, m)}
      <circle cx="44" cy="160" r="5" fill="${C.yellow}"/><circle cx="156" cy="160" r="5" fill="${C.yellow}"/>
      ${feet(172, C.silverD)}`;
  },
  triangle: m => { /* a triangle: a chunky silver frame, open at one corner, with its beater */
    return `<path d="M100 24 L170 156 H40 Z" fill="${C.silverL}" opacity=".7"/>
      <path d="M96 30 L32 160 H168 L112 52" fill="none" stroke="${C.silverD}" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" transform="translate(5 4)"/>
      <path d="M96 30 L32 160 H168 L112 52" fill="none" stroke="${C.silver}" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M90 42 L48 128" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".6"/>
      <path d="M96 30 q-6 -18 4 -22" fill="none" stroke="${C.red}" stroke-width="4" stroke-linecap="round"/>
      ${face(100, 116, 0.75, m)}
      <path d="M150 74 L186 34" stroke="${C.inkSoft}" stroke-width="7" stroke-linecap="round"/><circle cx="186" cy="34" r="6" fill="${C.ink}"/>
      ${feet(166, C.silverD, [64, 136])}`;
  },
  looper: m => { /* a looper pedal: red, a loop on its screen, one big footswitch */
    const box = (f, dx, dy) => `<rect x="${38 + dx}" y="${36 + dy}" width="124" height="144" rx="26" fill="${f}"/>`;
    return `${solid(box, C.red, C.redD)}${hi(50, 44, 50)}
      <circle cx="66" cy="34" r="11" fill="${C.ink}"/><rect x="64" y="24" width="4" height="10" rx="2" fill="#fff"/><circle cx="134" cy="34" r="11" fill="${C.ink}"/><rect x="138" y="28" width="4" height="10" rx="2" fill="#fff" transform="rotate(45 134 34)"/>
      <rect x="52" y="58" width="96" height="62" rx="18" fill="#FFD6D6"/>
      ${face(100, 82, 0.85, m)}
      <path d="M136 158 a9 9 0 1 1 6 -11" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M139 142 l3 6 l-6 1" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="100" cy="150" r="17" fill="${C.silverD}"/><circle cx="100" cy="148" r="15" fill="${C.silver}"/><circle cx="96" cy="144" r="4" fill="#fff" opacity=".6"/>
      ${feet(178, C.redD)}`;
  },
  humb: m => { /* a humbucker: two coils side by side, one black and one cream, twelve pole pieces */
    const base = (f, dx, dy) => `<rect x="${26 + dx}" y="${38 + dy}" width="148" height="132" rx="26" fill="${f}"/>`;
    return `${solid(base, C.silverL, C.silverD)}
      <rect x="36" y="48" width="128" height="40" rx="16" fill="${C.ink}"/><rect x="36" y="92" width="128" height="68" rx="20" fill="#F3E9D2"/>
      ${[0, 1, 2, 3, 4, 5].map(i => `<circle cx="${58 + i * 17}" cy="68" r="5.5" fill="${C.silver}"/><circle cx="${58 + i * 17}" cy="104" r="5" fill="#D8CBAE"/>`).join("")}
      ${face(100, 128, 0.8, m)}
      <rect x="12" y="92" width="18" height="20" rx="6" fill="${C.silverD}"/><rect x="170" y="92" width="18" height="20" rx="6" fill="${C.silverD}"/>
      ${feet(168, C.silverD, [72, 128])}`;
  },
  clip: m => { /* a pick holder: a black clip, wider at the top, a spare orange pick in it, an orange band */
    const body = (f, dx, dy) => `<path d="M${52 + dx} ${66 + dy} Q${52 + dx} ${56 + dy} ${62 + dx} ${56 + dy} H${138 + dx} Q${148 + dx} ${56 + dy} ${148 + dx} ${66 + dy} L${132 + dx} ${168 + dy} Q${130 + dx} ${178 + dy} ${120 + dx} ${178 + dy} H${80 + dx} Q${70 + dx} ${178 + dy} ${68 + dx} ${168 + dy}Z" fill="${f}"/>`;
    return `<path d="M100 74 C88 74 66 52 66 34 C66 18 82 12 100 12 C118 12 134 18 134 34 C134 52 112 74 100 74Z" fill="${C.orangeD}" transform="translate(5 4)"/>
      <path d="M100 74 C88 74 66 52 66 34 C66 18 82 12 100 12 C118 12 134 18 134 34 C134 52 112 74 100 74Z" fill="${C.orange}"/>${hi(80, 20, 26, 6)}
      ${solid(body, C.black, C.blackD)}${hi(64, 64, 40, 7)}
      <rect x="70" y="146" width="60" height="14" rx="7" fill="${C.orange}"/>
      ${face(100, 106, 0.8, m)}${feet(178, C.blackD, [84, 116])}`;
  },
  vial: m => { /* a vacuum tube: a glass bulb with warm filaments inside, on a silver base with pins */
    const glass = (f, dx, dy) => `<path d="M${58 + dx} ${150 + dy} V${70 + dy} Q${58 + dx} ${26 + dy} ${100 + dx} ${22 + dy} Q${142 + dx} ${26 + dy} ${142 + dx} ${70 + dy} V${150 + dy}Z" fill="${f}"/>`;
    return `${glass("#B9E4F5", 6, 4)}${glass("#E4F6FD", 0, 0)}
      <rect x="96" y="12" width="8" height="14" rx="4" fill="#B9E4F5"/>
      <path d="M70 142 V58 M130 142 V58 M70 58 H130" fill="none" stroke="${C.silverD}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="100" cy="66" rx="26" ry="12" fill="${C.orangeL}" opacity=".45"/>
      <path d="M82 72 q4 -14 9 0 q4 -14 9 0 q4 -14 9 0 q4 -14 9 0" fill="none" stroke="${C.orange}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${hi(62, 48, 6, 70)}
      ${face(100, 108, 0.72, m)}
      <rect x="54" y="148" width="98" height="22" rx="8" fill="${C.silverD}"/><rect x="50" y="146" width="98" height="22" rx="8" fill="${C.silver}"/>${hi(58, 150, 40, 5)}
      ${[72, 90, 108, 126].map(x => `<rect x="${x - 3}" y="168" width="6" height="18" rx="3" fill="${C.silverD}"/>`).join("")}`;
  },
  bottle: m => { /* a bottle slide: a clear glass tube, open at the top, a thicker ring of glass at the bottom */
    const tube = (f, dx, dy) => `<rect x="${62 + dx}" y="${26 + dy}" width="76" height="150" rx="22" fill="${f}"/>`;
    return `${solid(tube, "#DDF5F8", "#9FD9E2")}
      <ellipse cx="100" cy="30" rx="34" ry="9" fill="#9FD9E2"/><ellipse cx="100" cy="30" rx="26" ry="5" fill="#C5EDF2"/>
      <rect x="62" y="150" width="76" height="20" rx="10" fill="#B7E6EE"/>
      ${hi(72, 46, 10, 92)}${hi(122, 60, 5, 50)}
      ${face(102, 94, 0.82, m)}
      ${arm(62, 112, 38, 128, "#9FD9E2")}${arm(138, 112, 162, 96, "#9FD9E2")}
      ${feet(176, "#9FD9E2", [84, 116])}`;
  },
  gigbag: m => { /* a gig bag: urban grey, shaped like the guitar inside, a zipped pocket on the front */
    const g = "#8A8F9C", gD = "#666B78", gL = "#A9AEB9";
    const bag = (f, dx, dy) => `<path d="M${88 + dx} ${14 + dy} H${112 + dx} Q${124 + dx} ${14 + dy} ${124 + dx} ${28 + dy} V${70 + dy} Q${150 + dx} ${84 + dy} ${150 + dx} ${126 + dy} Q${150 + dx} ${178 + dy} ${100 + dx} ${178 + dy} Q${50 + dx} ${178 + dy} ${50 + dx} ${126 + dy} Q${50 + dx} ${84 + dy} ${76 + dx} ${70 + dy} V${28 + dy} Q${76 + dx} ${14 + dy} ${88 + dx} ${14 + dy}Z" fill="${f}"/>`;
    return `<path d="M58 100 q-20 10 -12 34" fill="none" stroke="${gD}" stroke-width="8" stroke-linecap="round"/>
      ${solid(bag, g, gD)}${hi(84, 24, 8, 40)}
      <path d="M118 22 V66" stroke="${gD}" stroke-width="3" stroke-dasharray="3 3"/>
      ${face(100, 98, 0.74, m)}
      <rect x="70" y="136" width="60" height="34" rx="12" fill="${gD}"/><rect x="70" y="133" width="60" height="32" rx="12" fill="${gL}"/>
      <path d="M76 140 H124" stroke="${gD}" stroke-width="3" stroke-linecap="round"/><rect x="116" y="136" width="9" height="6" rx="2" fill="${C.silver}"/>
      ${feet(176, gD, [84, 116])}`;
  },
  kazo: m => { /* a kazoo: candy-apple red, a tapered tube with a round cap on top */
    const tube = (f, dx, dy) => `<path d="M${70 + dx} ${40 + dy} H${130 + dx} Q${142 + dx} ${40 + dy} ${140 + dx} ${54 + dy} L${126 + dx} ${168 + dy} Q${124 + dx} ${178 + dy} ${114 + dx} ${178 + dy} H${86 + dx} Q${76 + dx} ${178 + dy} ${74 + dx} ${168 + dy} L${60 + dx} ${54 + dy} Q${58 + dx} ${40 + dy} ${70 + dx} ${40 + dy}Z" fill="${f}"/>`;
    return `${solid(tube, C.red, C.redD)}${hi(70, 52, 8, 60)}
      <ellipse cx="104" cy="44" rx="28" ry="12" fill="${C.redD}"/><ellipse cx="100" cy="38" rx="28" ry="12" fill="#FF7A7A"/><ellipse cx="100" cy="38" rx="17" ry="6" fill="${C.redD}"/>
      ${face(100, 104, 0.78, m)}
      <ellipse cx="100" cy="170" rx="14" ry="5" fill="${C.redD}"/>
      ${arm(64, 110, 40, 124, C.redD)}${arm(136, 110, 160, 94, C.redD)}`;
  },
  tuk: m => { /* a ukulele: golden acacia, small and round, four tuning pegs */
    const body = (f, dx, dy) => `<path d="M${100 + dx} ${92 + dy} c-26 0 -38 14 -32 30 c3 8 0 12 -4 18 c-10 16 4 34 36 34 c32 0 46 -18 36 -34 c-4 -6 -7 -10 -4 -18 c6 -16 -6 -30 -32 -30z" fill="${f}"/>`;
    return `<rect x="93" y="22" width="14" height="80" rx="5" fill="${C.woodD}"/><rect x="91" y="20" width="12" height="80" rx="5" fill="${C.woodL}"/>
      <rect x="86" y="6" width="26" height="24" rx="8" fill="${C.woodD}"/>
      ${[[82, 12], [82, 24], [116, 12], [116, 24]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="${C.silver}"/>`).join("")}
      ${solid(body, C.tan, C.tanD)}${hi(76, 104, 30)}
      <circle cx="100" cy="150" r="10" fill="${C.woodD}"/><rect x="84" y="166" width="32" height="6" rx="3" fill="${C.woodD}"/>
      ${face(100, 124, 0.72, m)}${feet(176, C.tanD, [82, 118])}`;
  },
  capo: m => { /* a trigger capo: polished chrome, a black pad under its arm, a lever below */
    const block = (f, dx, dy) => `<rect x="${52 + dx}" y="${58 + dy}" width="76" height="92" rx="26" fill="${f}"/>`;
    return `<path d="M60 66 Q60 30 104 30 H168 Q178 30 178 40 V46 Q178 54 168 54 H112 Q96 54 96 70" fill="${C.silverD}"/>
      <path d="M56 62 Q56 26 100 26 H164 Q174 26 174 36 V42 Q174 50 164 50 H108 Q92 50 92 66" fill="${C.silver}"/>
      <rect x="110" y="50" width="62" height="12" rx="6" fill="${C.ink}"/>
      ${solid(block, C.silver, C.silverD)}${hi(62, 68, 30, 7)}
      <path d="M70 146 Q60 176 34 182" fill="none" stroke="${C.silverD}" stroke-width="16" stroke-linecap="round"/>
      <path d="M66 142 Q56 172 30 178" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linecap="round"/>
      ${face(90, 100, 0.72, m)}${feet(166, C.silverD, [80, 112])}`;
  },
  spool: m => { /* a spool of string: bright copper, wound round and round, the loose ends for arms */
    const cu = "#D9773A", cuD = "#A8521F", cuL = "#F2A36B";
    return `<circle cx="106" cy="104" r="70" fill="${cuD}"/><circle cx="100" cy="98" r="70" fill="${cu}"/>
      ${[60, 48, 36].map((r, i) => `<circle cx="100" cy="98" r="${r}" fill="none" stroke="${i % 2 ? cuL : cuD}" stroke-width="3" opacity=".7"/>`).join("")}
      <circle cx="100" cy="98" r="28" fill="${cuL}" opacity=".5"/>${hi(60, 40, 30, 7)}
      ${face(100, 96, 0.78, m)}
      <path d="M32 100 q-14 -8 -8 -24 q6 -12 -6 -18" fill="none" stroke="${cuD}" stroke-width="4" stroke-linecap="round"/>
      <path d="M168 96 q16 4 12 20 q-4 14 10 18" fill="none" stroke="${cuD}" stroke-width="4" stroke-linecap="round"/>
      ${feet(166, cuD, [80, 120])}`;
  },
  peg: m => { /* a tuning peg: shiny nickel, a flat button for a head on a post with a nut */
    const head = (f, dx, dy) => `<rect x="${44 + dx}" y="${22 + dy}" width="112" height="84" rx="34" fill="${f}"/>`;
    return `<rect x="84" y="100" width="36" height="20" rx="6" fill="${C.silverD}"/><rect x="80" y="98" width="36" height="20" rx="6" fill="${C.silver}"/>
      <path d="M78 122 h44 l-6 18 h-32z" fill="${C.silverD}"/><path d="M74 120 h44 l-6 18 h-32z" fill="${C.silver}"/>
      <rect x="88" y="138" width="24" height="34" rx="8" fill="${C.silverD}"/><rect x="86" y="138" width="20" height="34" rx="8" fill="${C.silverL}"/>
      ${solid(head, C.silverL, C.silverD)}${hi(58, 30, 46, 8)}
      ${face(100, 62, 0.8, m)}${feet(172, C.silverD, [84, 116])}`;
  },
  whammy: m => { /* whammy bar: a silver rod that curls, with a round tip for a head */
    return `<path d="M60 176 Q60 120 96 112 Q140 104 142 70" fill="none" stroke="${C.silverD}" stroke-width="16" stroke-linecap="round"/>
      <path d="M58 172 Q56 118 94 108 Q136 100 138 68" fill="none" stroke="${C.silver}" stroke-width="12" stroke-linecap="round"/>
      <path d="M50 176 q-14 0 -14 -12 q0 -10 10 -10" fill="none" stroke="${C.silverD}" stroke-width="8" stroke-linecap="round"/>
      <circle cx="146" cy="52" r="34" fill="${C.silverD}"/><circle cx="140" cy="48" r="34" fill="${C.silver}"/>${hi(122, 24, 24, 7)}
      ${face(140, 48, 0.65, m)}`;
  }
};

export const FRIENDS = [
  ["lola", "Lola", "Acoustic guitar"], ["jax", "Jax", "Effects pedal"], ["tilly", "Tilly", "Tuner"], ["milo", "Milo", "Microphone"],
  ["bex", "Bex", "Bass amp"], ["pip", "Pip", "Pick"], ["beat", "Beat", "Bass drum"], ["slide", "Slide", "Brass slide"],
  ["strap", "Strap", "Guitar strap"], ["key", "Key", "Keyboard key"], ["metro", "Metro", "Metronome"], ["pickup", "Pickup", "Single-coil pickup"], ["whammy", "Whammy", "Whammy bar"],
  ["shaker", "Shaker", "Maraca"], ["reverb", "Reverb", "Reverb tank"], ["triangle", "Triangle", "Triangle"], ["looper", "Looper", "Looper pedal"], ["humb", "Humb", "Humbucker"],
  ["clip", "Pick-Clip", "Pick holder"], ["vial", "Vial", "Vacuum tube"], ["bottle", "Bottle-Slide", "Bottle slide"],
  ["gigbag", "Gig-Bag", "Gig bag"], ["kazo", "Kazo", "Kazoo"], ["tuk", "Tuk", "Ukulele"], ["capo", "Capo", "Capo"], ["spool", "Spool", "String spool"], ["peg", "Peg", "Tuning peg"]
].map(([id, name, what]) => ({ id, name, what }));

export function friend(id, { size = 120, mood = "happy" } = {}) {
  const f = FRIENDS.find(x => x.id === id), draw = DRAW[id];
  if (!f || !draw) return "";
  return `<svg class="friend ${id}" width="${size}" height="${size}" viewBox="0 0 200 200" role="img" aria-label="${f.name}, ${f.what}"><ellipse cx="100" cy="192" rx="58" ry="6" fill="#14213D" opacity=".16"/>${draw(mood)}</svg>`;
}
