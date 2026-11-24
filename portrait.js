/* global createImageBitmap */
// Make my portrait (4.99.0, Gig poster portraits story 2): a gig poster portrait drawn from a selfie by xAI's image model (Grok
// Imagine, 4.99.1), with the player's own xAI key (kept on this phone like the Anthropic key, sent
// only to xAI). Opt in, behind a consent sheet. The photo is sent once, straight from the phone to xAI, and Louie keeps none of it: only the finished picture is
// kept, on this phone (its own small database, "tabs-portrait"), never in the library, a backup or anywhere else. Removing it
// deletes it. The game's poses and moods keep the drawn guitarist; the portrait is the player card, the share card and the
// round portrait.
import { faceFinder, pickPhoto } from "./selfie.js";

export const IMG_STORE = "tabs.xaikey.v1";
export const IMG_MODEL = "grok-imagine-image-2.0";
export const IMG_URL = "https://api.x.ai/v1/images/edits";
export function imgKey() { try { return localStorage.getItem(IMG_STORE) || ""; } catch { return ""; } }

/* what the model is asked for: Grok's gig poster style, the person kept recognisable, no words or logos in the picture */
export const PORTRAIT_PROMPT = "Turn the person in this photo into a screen-printed gig poster illustration. Three-quarter length portrait, " +
  "facing the viewer, holding an electric guitar as if playing it. Keep their face, skin tone, hair, facial hair, glasses and age " +
  "recognisable and true to the photo. Style: hand-inked black linework, halftone shading, slight print misregistration, paper grain, " +
  "on a cream paper background, with amber and teal ink splashes and one amber starburst behind them. Leave the top fifth of the " +
  "picture as plain cream paper for a headline. No text, no letters, no logos, no brand names on the guitar.";

const DB = "tabs-portrait";
const open = () => new Promise((ok, bad) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("p"); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); });
async function tx(mode, fn) {
  const db = await open();
  try { return await new Promise((ok, bad) => { const t = db.transaction("p", mode), q = fn(t.objectStore("p")); t.oncomplete = () => ok(q?.result); t.onerror = () => bad(t.error); }); }
  finally { db.close(); }
}

/* the portrait in memory: { url (a data: URL), face: [cx, cy, r] as fractions of the picture's width and height, at } or null */
let now = null;
export const portraitNow = () => now;
/* read at start, without making the database for someone who never made a portrait */
export async function loadPortrait() {
  try {
    if (indexedDB.databases && !(await indexedDB.databases()).some(d => d.name === DB)) return null;
    const p = await tx("readonly", s => s.get("me"));
    now = p && typeof p.url === "string" && p.url.startsWith("data:image/") ? p : null;
  } catch { now = null; }
  return now;
}
export async function removePortrait() {
  now = null;
  try { await new Promise(ok => { const r = indexedDB.deleteDatabase(DB); r.onsuccess = r.onerror = r.onblocked = () => ok(); }); } catch { /* gone or blocked */ }
}

/* the photo, made small enough to send (1024 on the long side), as a JPEG data URL (xAI takes the image inside the JSON) */
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  try {
    const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", .9);
    c.width = 0;
    return url;
  } finally { bmp.close?.(); }
}

/* where the face is in the finished portrait, for the round crop; a fixed spot if the finder can't say */
async function faceIn(url) {
  const fallback = [0.5, 0.36, 0.13];
  try {
    const img = new Image(); img.src = url; await img.decode();
    const det = await faceFinder(), c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
    const found = det.detect(c)?.detections || []; c.width = 0;
    if (!found.length) return fallback;
    const b = found.reduce((a, d) => d.boundingBox.width > a.boundingBox.width ? d : a).boundingBox;
    return [(b.originX + b.width / 2) / img.naturalWidth, (b.originY + b.height / 2) / img.naturalHeight, b.width / 2 / img.naturalWidth];
  } catch { return fallback; }
}

/* plain words for what went wrong */
export function portraitError(e) {
  const s = e?.status;
  if (s === 401 || s === 403) return "xAI didn't accept that key. Check it in Settings > Keys.";
  if (s === 429) return "xAI says the key is out of credit or busy. Try again later.";
  if (s === 400) return "xAI wouldn't draw that photo. Try another one, face on and well lit.";
  if (e?.name === "AbortError") return "That took too long. Try again.";
  return "Couldn't reach xAI. Check your connection and try again.";
}

/* the flow after consent: pick a photo, send it, keep only the picture. Returns { cancelled } or the portrait; throws on failure. */
export async function makePortrait({ onBusy } = {}) {
  const key = imgKey();
  if (!key) throw Object.assign(new Error("no key"), { status: 401 });
  const file = await pickPhoto();
  if (!file) return { cancelled: true };
  onBusy?.(true);
  try {
    const photo = await shrink(file);
    const body = JSON.stringify({ model: IMG_MODEL, prompt: PORTRAIT_PROMPT, image: { url: photo }, aspect_ratio: "2:3", resolution: "1k", response_format: "b64_json", n: 1 });
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 180e3);
    let res;
    try { res = await fetch(IMG_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: ctl.signal }); }
    finally { clearTimeout(timer); }
    if (!res.ok) throw Object.assign(new Error("xAI " + res.status), { status: res.status });
    const out = (await res.json())?.data?.[0] || {}, b64 = out.b64_json;
    if (typeof b64 !== "string" || !/^[A-Za-z0-9+/=]+$/.test(b64.slice(0, 200))) throw new Error("no picture");
    const mime = /^image\/(jpeg|png|webp)$/.test(out.mime_type || "") ? out.mime_type : b64.startsWith("iVBOR") ? "image/png" : b64.startsWith("UklGR") ? "image/webp" : "image/jpeg";
    const url = `data:${mime};base64,` + b64;
    const p = { url, face: await faceIn(url), at: Date.now() };
    await tx("readwrite", s => s.put(p, "me"));
    now = p;
    return p;
  } finally { onBusy?.(false); }
}

/* the portrait as an SVG the size of the guitarist it stands in for: the round portrait (crop "bust", the same frame and disc as the
   guitarist's), or the poster card (the full or three-quarter frame) */
export function portraitSVG(p, { crop = "full", size = 160, label = "Your portrait", headline = "" } = {}) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const id = "pp" + Math.random().toString(36).slice(2, 8);
  if (crop === "bust") {
    /* the disc of the guitarist's bust (frame 30 14 140 150, disc 100 89 r70); the face fills about half of it */
    const [fx, fy, fr] = p.face || [0.5, 0.36, 0.13], W = 30 / Math.max(0.05, fr), H = W * 1.5;
    const x = 100 - fx * W, y = 84 - fy * H;
    return `<svg viewBox="30 14 140 150" width="${size}" height="${Math.round(size * 150 / 140)}" role="img" aria-label="${esc(label)}"><defs><clipPath id="${id}"><circle cx="100" cy="89" r="70"/></clipPath></defs><circle cx="100" cy="89" r="70" fill="#F6EEE0"/><image href="${p.url}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/><circle cx="100" cy="89" r="69.5" fill="none" stroke="#1B1714" stroke-opacity=".3"/></svg>`;
  }
  /* the poster: the picture is 2:3, the card is 2:3 (the guitarist's full frame is 168 by 252) */
  const head = headline ? `<text x="84" y="40" text-anchor="middle" font-family="'Sora', Impact, sans-serif" font-weight="700" font-size="32" letter-spacing="1.5" fill="#1B1714">${esc(headline)}</text>` : "";
  return `<svg viewBox="0 0 168 252" width="${size}" height="${Math.round(size * 1.5)}" role="img" aria-label="${esc(label)}"><defs><clipPath id="${id}"><rect x="1" y="1" width="166" height="250" rx="7"/></clipPath></defs><rect x="1" y="1" width="166" height="250" rx="7" fill="#F6EEE0"/><image href="${p.url}" width="168" height="252" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>${head}<rect x="1.5" y="1.5" width="165" height="249" rx="6.5" fill="none" stroke="#1B1714" stroke-opacity=".22"/></svg>`;
}
