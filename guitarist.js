// Your guitarist (painted only, 2026-11-23): one of 24 finished paintings, a man and a woman for each of 12 genres.
// The player picks one (data.me = { genre, who, lefty }, see cleanMe in core/game.js); a computer rival gets one from its name.
// The old drawn character (parts, hair, faces, hats, patches, selfie and portrait) is gone.
import { ME_GENRE, meMood, meOf, stageLook, stageLookOf } from "./core.js";
// you(data, o) and rival(name, tier, o) return an <svg> string the screens already size. crop: "full", "bust" (head and
// shoulders in a disc) or "face" (closer in). card: a stage backdrop with room for a headline. lefty mirrors the painting.
let N = 0;

/* the stage behind the card and the small disc, by venue look: [back, beam, glow] */
const STAGE = { tee: ["#241914", "#3B2316", "#FF9A3C"], flannel: ["#14211B", "#1E362B", "#E89B3C"], vest: ["#131A29", "#1E2C47", "#3898EC"], leather: ["#261419", "#3D1C26", "#E0486B"], stage: ["#1C1410", "#33220F", "#FFB547"] };

/* The finished paintings. One man and one woman for each genre. The player's picture is data.me.genre and data.me.who.
   A rival's picture comes from the name already used for that rival. */
export const GENRE_IDS = ME_GENRE;
const GENRE_V2 = {
  "classical-w": "classical-w-v2", "country-m": "country-m-v2", "country-w": "country-w-v2",
  "funk-m": "funk-m-v2", "funk-w": "funk-w-v2", "jazz-w": "jazz-w-v2", "metal-m": "metal-m-v2",
  "pop-w": "pop-w-v2", "punk-w": "punk-w-v3", "reggae-m": "reggae-m-v2", "rock-w": "rock-w-v2"
};
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
    const title = headline ? `<text x="400" y="72" text-anchor="middle" font-family="'Sora', Impact, sans-serif" font-weight="700" font-size="44" letter-spacing="3" fill="#F6EEE0">${String(headline).replace(/[<&]/g, "")}</text>` : "";
    return `<svg viewBox="0 0 800 900" width="${size}" height="${Math.round(size * 900 / 800)}" ${open}><rect width="800" height="900" rx="28" fill="${bk}"/>${title}<g transform="translate(0 88)">${img}</g></svg>`;
  }
  return `<svg viewBox="30 10 740 780" width="${size}" height="${size}" ${open}>${img}</svg>`;
}
export function genreIdOf(me) {
  const id = `${GENRE_IDS.includes(me?.genre) ? me.genre : "rock"}-${me?.who === "w" ? "w" : "m"}`;
  return genreCast().includes(id) ? id : GENRE_DEFAULT;
}
/* you, as the app means you. The picture is the genre and the man or woman you picked, mirrored if you play left-handed.
   o overrides mood, crop, size, label, look, card, headline and lefty. */
export function you(data, o = {}) {
  const me = o.me || meOf(data || {});
  return painted(genreIdOf(me), { mood: meMood(data || {}), look: stageLook(data || {}), ...o, lefty: o.lefty ?? me.lefty });
}
/* a computer rival. The picture is one of the 24, chosen from the name. Decorative (the name is beside it). */
export function rival(name, tier, o = {}) {
  return painted(genreForName(name), { look: stageLookOf(tier), crop: "bust", ...o, label: name }).replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
}
