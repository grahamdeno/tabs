// Mockup: a player's guitarist, drawn in Louie's style. Flat colour, a darker right side, round eyes with a
// highlight, chunky mitten hands, the same moods. Built from parts so anyone can make their own.
const shade = (hex, f) => "#" + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, "0")).join("");
const mix = (hex, to, f) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f) + parseInt(to.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
let N = 0;

export const SKIN = ["#FDE1CB", "#F3C6A0", "#DDA57A", "#BF8358", "#93603E", "#63402A"];
export const HAIR_COL = { black: "#1f1a1c", brown: "#5a3622", blonde: "#e8c06a", red: "#c4502a", grey: "#b8b4ae", purple: "#8A47F5", blue: "#3A86FF", pink: "#ff5fa8", green: "#3fcf8e" };
export const OUTFIT_COL = { red: "#e8336e", teal: "#20b8a4", yellow: "#f5c542", white: "#f4f1ea", black: "#26282e", green: "#2f8f5b", blue: "#3a6fd8", orange: "#ff7a1a" };

/* hair: [behind the head, over the head] */
const HAIR = {
  shag: c => [`<path d="M46 84C44 40 70 24 100 24C130 24 156 40 154 84L160 150C144 162 128 154 126 138H74C72 154 56 162 40 150Z" fill="${c}"/>`,
    `<path d="M50 80C52 44 76 30 100 30C126 30 150 44 150 80C138 64 122 58 106 62C92 50 66 58 50 80Z" fill="${c}"/><path d="M112 34C130 40 146 54 150 80C140 66 128 60 116 60Z" fill="${shade(c, .8)}"/>`],
  curly: c => [Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (0.92 + i * 1.16 / 12), x = 100 + 56 * Math.cos(a), y = 84 + 54 * Math.sin(a); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i % 2 ? 19 : 22}" fill="${c}"/>`; }).join("") + `<circle cx="100" cy="52" r="46" fill="${c}"/>`,
    `<circle cx="74" cy="46" r="16" fill="${c}"/><circle cx="100" cy="38" r="17" fill="${c}"/><circle cx="126" cy="46" r="16" fill="${c}"/><circle cx="58" cy="62" r="12" fill="${c}"/><circle cx="142" cy="62" r="12" fill="${shade(c, .82)}"/><circle cx="126" cy="46" r="10" fill="${shade(c, .82)}" opacity=".6"/>`],
  buzz: c => ["", `<path d="M54 74C54 42 76 32 100 32C124 32 146 42 146 74C134 60 118 54 100 54C82 54 66 60 54 74Z" fill="${c}"/>`],
  mohawk: c => ["", `<path d="M56 72C58 46 78 38 100 38C122 38 142 46 144 72C132 62 116 58 100 58C84 58 68 62 56 72Z" fill="${c}" opacity=".35"/><path d="M88 60L80 18L94 30L100 6L106 30L120 18L112 60Z" fill="${c}"/><path d="M100 6L106 30L120 18L112 60H100Z" fill="${shade(c, .8)}"/>`],
  braids: c => [`<rect x="40" y="70" width="18" height="104" rx="9" fill="${c}"/><rect x="142" y="70" width="18" height="104" rx="9" fill="${shade(c, .82)}"/>${[90, 108, 126, 144, 162].map(y => `<path d="M42 ${y}h14M144 ${y}h14" stroke="${shade(c, .6)}" stroke-width="3" stroke-linecap="round"/>`).join("")}<circle cx="49" cy="176" r="7" fill="#f5c542"/><circle cx="151" cy="176" r="7" fill="#f5c542"/>`,
    `<path d="M50 78C52 42 76 30 100 30C124 30 148 42 150 78C142 58 120 50 100 50C80 50 58 58 50 78Z" fill="${c}"/><path d="M100 30C124 30 148 42 150 78C142 58 120 50 100 50Z" fill="${shade(c, .82)}"/><path d="M100 31V50" stroke="${shade(c, .55)}" stroke-width="3"/>`],
  bob: c => [`<path d="M46 86C44 42 70 26 100 26C130 26 156 42 154 86L156 124C142 130 132 124 130 112H70C68 124 58 130 44 124Z" fill="${c}"/>`,
    `<path d="M50 74C52 44 76 30 100 30C124 30 148 44 150 74C130 62 70 62 50 74Z" fill="${c}"/><path d="M100 30C124 30 148 44 150 74C136 66 118 64 100 64Z" fill="${shade(c, .82)}"/>`],
  bun: c => [`<circle cx="100" cy="24" r="20" fill="${c}"/><circle cx="106" cy="22" r="12" fill="${shade(c, .82)}"/>`,
    `<path d="M52 76C54 44 76 32 100 32C124 32 146 44 148 76C138 58 120 50 100 50C80 50 62 58 52 76Z" fill="${c}"/><path d="M100 32C124 32 146 44 148 76C138 58 120 50 100 50Z" fill="${shade(c, .82)}"/>`],
  swoop: c => ["", `<path d="M52 76C48 40 78 22 110 26C140 30 154 50 148 76C140 58 122 48 98 52C80 54 64 62 52 76Z" fill="${c}"/><path d="M52 76C46 50 60 30 84 26C70 38 64 54 66 66Z" fill="${shade(c, .8)}"/>`]
};
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
  if (o === "tee") return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/>${right}<path d="M84 150Q100 170 116 150Z" fill="${skin}"/>` };
  if (o === "flannel") return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/><g clip-path="url(#t${id})" opacity=".55">${[40, 66, 92, 118, 144].map(x => `<rect x="${x}" y="150" width="10" height="102" fill="${shade(c, .6)}"/>`).join("")}${[164, 190, 216, 242].map(y => `<rect x="30" y="${y}" width="140" height="9" fill="${shade(c, .6)}"/>`).join("")}${[52, 104, 156].map(x => `<rect x="${x}" y="150" width="3" height="102" fill="#fff" opacity=".5"/>`).join("")}</g>${right}<path d="M84 150L100 176L116 150Z" fill="#26282e"/><path d="M80 150L94 176L100 162Z M120 150L106 176L100 162Z" fill="${shade(c, .75)}"/>` };
  if (o === "leather") return { sleeve: "#26282e", svg: `${clip}<path d="${torso}" fill="#26282e"/><path d="M86 150L100 252L114 150Z" fill="${c}"/><path d="M78 152L98 196L88 252H70L76 186L64 166Z" fill="#33363d"/><path d="M122 152L102 196L112 252H130L124 186L136 166Z" fill="#1c1d22"/>${right}<rect x="60" y="200" width="16" height="3" rx="1.5" fill="#cdd2da"/><circle cx="124" cy="174" r="3" fill="#cdd2da"/>` };
  return { sleeve: c, svg: `${clip}<path d="${torso}" fill="${c}"/><path d="M34 252C34 178 60 150 88 152L92 252Z" fill="#3a6fd8"/><path d="M166 252C166 178 140 150 112 152L108 252Z" fill="#2f5bb8"/>${right}<path d="M88 152L92 252M112 152L108 252" stroke="#f5c542" stroke-width="2" stroke-dasharray="4 3"/><circle cx="70" cy="190" r="6" fill="#f5c542"/><circle cx="70" cy="190" r="3" fill="#ff5fa8"/>` };
}
/* a little guitar slung across the body, in the colours of the one you earned */
function guitar(g) {
  return `<g transform="translate(6 -14) rotate(48 84 196)"><rect x="79" y="88" width="10" height="100" rx="3" fill="${g.board}"/>${[104, 120, 136, 152].map(y => `<rect x="79" y="${y}" width="10" height="2" fill="#cdd2da"/>`).join("")}<path d="M76 82h16l2 -18h-20z" fill="${g.head}"/>
    <ellipse cx="84" cy="212" rx="31" ry="26" fill="${shade(g.body, .6)}" transform="translate(0 4)"/><ellipse cx="84" cy="186" rx="23" ry="21" fill="${g.body}"${g.edge ? ` stroke="${g.edge}" stroke-width="2.5"` : ""}/><ellipse cx="84" cy="212" rx="31" ry="26" fill="${g.body}"${g.edge ? ` stroke="${g.edge}" stroke-width="2.5"` : ""}/><ellipse cx="84" cy="186" rx="21.5" ry="19.5" fill="${g.body}"/>
    ${g.acoustic ? `<circle cx="84" cy="194" r="9" fill="#120c09"/><rect x="70" y="214" width="28" height="5" rx="2" fill="#2a1a12"/>` : `<rect x="72" y="196" width="24" height="7" rx="2" fill="#efe4c8"/><rect x="72" y="208" width="24" height="7" rx="2" fill="#efe4c8"/><circle cx="104" cy="222" r="3.5" fill="#f5c542"/>`}
    <path d="M84 188V218" stroke="#e9e3d6" stroke-width="1.2"/></g>`;
}
const hand = (x, y, skin) => `<circle cx="${x}" cy="${y + 2}" r="11" fill="${shade(skin, .78)}"/><circle cx="${x}" cy="${y}" r="11" fill="${skin}"/>`;
const horns = (x, y, r, skin) => `<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-11" y="-34" width="8" height="26" rx="4" fill="${skin}"/><rect x="3" y="-30" width="8" height="22" rx="4" fill="${skin}"/><circle cx="0" cy="-6" r="11" fill="${skin}"/><rect x="-12" y="-12" width="15" height="8" rx="4" fill="${shade(skin, .82)}"/></g>`;

/* p: { skin, hair, hairCol, beard, extra, extraCol, outfit, outfitCol, guitar } */
export function guitarist(p, { mood = "happy", pose = "play", crop = "full", size = 160 } = {}) {
  const id = ++N, skin = SKIN[p.skin], hc = HAIR_COL[p.hairCol], [hBack, hFront] = HAIR[p.hair](hc), dark = shade(skin, .88);
  const top = outfit(p.outfit, OUTFIT_COL[p.outfitCol], skin, id);
  const cheer = mood === "cheer", worried = mood === "worried", sleepy = mood === "sleepy";
  const eye = x => sleepy ? `<ellipse cx="${x}" cy="88" rx="10" ry="12" fill="#fff"/><circle cx="${x + 1}" cy="93" r="5.5" fill="#1c1d22"/><path d="M${x - 11} 89A11 13 0 0 1 ${x + 11} 89Z" fill="${shade(skin, .92)}"/><path d="M${x - 10} 89Q${x} 93 ${x + 10} 89" fill="none" stroke="#1c1d22" stroke-width="2.4" stroke-linecap="round"/>` : cheer ? `<path d="M${x - 9} 90Q${x} 76 ${x + 9} 90Q${x} 84 ${x - 9} 90Z" fill="#1c1d22"/>`
    : `<ellipse cx="${x}" cy="88" rx="10" ry="12" fill="#fff"/><circle cx="${x + (worried ? -1 : 2)}" cy="${worried ? 91 : 90}" r="6" fill="#1c1d22"/><circle cx="${x + (worried ? 1 : 4)}" cy="${worried ? 88 : 87}" r="2.2" fill="#fff"/>`;
  const brows = cheer ? "" : worried ? `<path d="M70 70l20 5" stroke="${shade(hc, .9)}" stroke-width="5" stroke-linecap="round"/><path d="M130 70l-20 5" stroke="${shade(hc, .9)}" stroke-width="5" stroke-linecap="round"/>`
    : `<rect x="70" y="70" width="20" height="5" rx="2.5" fill="${shade(hc, .9)}" transform="rotate(-5 80 72)"/><rect x="110" y="70" width="20" height="5" rx="2.5" fill="${shade(hc, .9)}" transform="rotate(5 120 72)"/>`;
  const mouth = sleepy ? `<path d="M90 112Q100 116 110 112" fill="none" stroke="#7a1f2e" stroke-width="4" stroke-linecap="round"/><text x="150" y="44" font-family="system-ui" font-weight="900" font-size="22" fill="#9fb4ff">z</text><text x="164" y="28" font-family="system-ui" font-weight="900" font-size="15" fill="#9fb4ff">z</text>` : cheer ? `<path d="M84 106Q100 132 116 106Z" fill="#7a1f2e"/><ellipse cx="100" cy="119" rx="8" ry="4" fill="#ff7a8a"/>`
    : worried ? `<path d="M88 116Q100 106 112 116Q100 112 88 116Z" fill="#7a1f2e"/>`
      : `<path d="M86 108Q100 124 114 108Z" fill="#7a1f2e"/><path d="M93 116Q100 120 107 116Q100 113 93 116Z" fill="#ff7a8a"/>`;
  const beard = p.beard ? `<path d="M56 96C58 128 78 140 100 140C122 140 142 128 144 96C134 112 124 120 100 120C76 120 66 112 56 96Z" fill="${hc}"/><path d="M84 104Q100 98 116 104Q100 108 84 104Z" fill="${hc}"/>` : "";
  const head = `<clipPath id="h${id}"><circle cx="100" cy="88" r="48"/></clipPath><circle cx="52" cy="94" r="10" fill="${dark}"/><circle cx="148" cy="94" r="10" fill="${shade(skin, .8)}"/>
    <circle cx="100" cy="88" r="48" fill="${dark}"/><circle cx="96" cy="87" r="45" fill="${skin}" clip-path="url(#h${id})"/>
    <ellipse cx="70" cy="104" rx="7" ry="4" fill="#ff7a7a" opacity=".35"/><ellipse cx="130" cy="104" rx="7" ry="4" fill="#ff7a7a" opacity=".3"/>`;
  const g = { board: "#2b2420", head: "#1c1d22", body: "#8a6a4a", acoustic: true, ...p.guitar };
  const sleeve = top.sleeve;
  let arms = "";
  if (pose === "play") arms = `<path d="M54 178Q62 200 94 198" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(96, 196, skin)}<path d="M150 176Q166 160 160 142" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${hand(158, 138, skin)}`;
  else if (pose === "hornsUp") arms = `<path d="M50 172Q22 140 22 104" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${horns(22, 100, -18, skin)}<path d="M150 172Q178 140 178 104" stroke="${sleeve}" stroke-width="18" fill="none" stroke-linecap="round"/>${horns(178, 100, 18, skin)}`;
  /* patches for what you've done: a leg headlined (its guitar), a rival beaten (a star), a streak pin (its nights) */
  const PATCH = {
    leg: (x, y, c) => `<circle cx="${x}" cy="${y + 1.5}" r="11" fill="#00000055"/><circle cx="${x}" cy="${y}" r="11" fill="${c}"/><circle cx="${x}" cy="${y}" r="11" fill="none" stroke="#F5C542" stroke-width="2" stroke-dasharray="2 1.6"/><path d="M${x - 1.5} ${y - 7}h3v7h-3z M${x} ${y + 3}m-5 0a5 4.5 0 1 0 10 0a5 4.5 0 1 0 -10 0" fill="#F5C542"/>`,
    star: (x, y) => `<path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="#00000055" transform="translate(0 1.5)"/><path d="M${x} ${y - 11}l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5 -3.4 -6.5 3.4 1.3 -7.2 -5.3 -5.1 7.3 -1z" fill="#ff5fa8"/>`,
    pin: (x, y, n) => `<rect x="${x - 10}" y="${y - 7}" width="20" height="14" rx="7" fill="#F5C542"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="10" fill="#3D2A00">${n}</text>`
  };
  const SPOTS = [[124, 178], [140, 198], [120, 202], [146, 222], [124, 228]];
  const patches = (p.patches || []).map((pt, i) => { const [x, y] = SPOTS[i]; return pt[0] === "leg" ? PATCH.leg(x, y, pt[1]) : pt[0] === "star" ? PATCH.star(x, y) : PATCH.pin(x, y, pt[1]); }).join("");
  const body = `<rect x="88" y="128" width="24" height="28" fill="${dark}"/>${top.svg}${patches}${guitar(g)}${arms}`;
  const vb = crop === "bust" ? "34 12 132 132" : pose === "hornsUp" ? "-4 0 208 252" : "16 0 168 252";
  const [, , vw, vh] = vb.split(" ").map(Number);
  return `<svg viewBox="${vb}" width="${size}" height="${(size * vh / vw).toFixed(0)}" role="img" aria-label="Your guitarist" style="overflow:hidden">${crop === "bust" ? "" : ""}${hBack}${crop === "bust" ? `<rect x="88" y="128" width="24" height="28" fill="${dark}"/>${top.svg}` : body}${head}${beard}${eye(81)}${eye(119)}${brows}${mouth}${hFront}${p.extra && p.extra !== "none" ? EXTRA[p.extra](HAIR_COL[p.extraCol] || OUTFIT_COL[p.extraCol] || "#26282e") : ""}</svg>`;
}

export const STARTERS = [
  { name: "Ace", skin: 2, hair: "shag", hairCol: "brown", outfit: "leather", outfitCol: "red", extra: "none", guitar: { body: "#1c1d22", acoustic: false } },
  { name: "Jules", skin: 4, hair: "curly", hairCol: "black", outfit: "flannel", outfitCol: "green", extra: "glasses", guitar: { body: "#a8431f", acoustic: false } },
  { name: "Remy", skin: 0, hair: "bob", hairCol: "purple", outfit: "denim", outfitCol: "white", extra: "none", guitar: { body: "#5FC4B0", acoustic: false } },
  { name: "Dez", skin: 3, hair: "mohawk", hairCol: "blue", outfit: "leather", outfitCol: "white", extra: "none", guitar: { body: "#8b1e2b", acoustic: false } },
  { name: "Mae", skin: 5, hair: "braids", hairCol: "black", outfit: "tee", outfitCol: "yellow", extra: "bandana", extraCol: "red", guitar: { body: "#c98a4a", acoustic: true } },
  { name: "Kit", skin: 1, hair: "buzz", hairCol: "brown", beard: true, outfit: "flannel", outfitCol: "red", extra: "beanie", extraCol: "black", guitar: { body: "#6b3b20", acoustic: true } },
  { name: "Nova", skin: 2, hair: "bun", hairCol: "pink", outfit: "tee", outfitCol: "teal", extra: "none", guitar: { body: "#8A47F5", acoustic: false } },
  { name: "Sol", skin: 1, hair: "swoop", hairCol: "black", outfit: "tee", outfitCol: "white", extra: "cap", extraCol: "orange", guitar: { body: "#8a6a4a", acoustic: true } }
];
