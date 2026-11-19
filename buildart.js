// The guitar builder's picture (Road Ready 9b): puts a build together from Grok's layers (art/guitars/builder/,
// docs/guitars/BUILDER-ART.md, and tools/guitars/builder_preview.py, which this follows step by step), once per build,
// and keeps the result keyed by the build. The same picture is used in the builder's case, on the Road neck (in place of
// the -road.webp, the same size, so every stop still lines up), on Me and on Show complete.
// A guitar with no saved build is its painting, nothing is composed. Until a picture is ready the painting is shown, and
// it is swapped in (every element carrying data-bk) when it is.
import { buildShown, buildKey, BUILD_STOCK, BUILD_TAKES, VERSION } from "./core.js";

const DIR = "art/guitars/builder/";
const url = p => `${p}?v=${VERSION}`;
let manP = null;
export const manifest = () => manP || (manP = fetch(url(DIR + "manifest.json")).then(r => { if (!r.ok) throw new Error("manifest"); return r.json(); }));

const imgs = new Map();
const load = src => {
  if (!imgs.has(src)) imgs.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { imgs.delete(src); rej(new Error(src)); }; i.src = src; }));
  return imgs.get(src);
};
const canvasOf = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
/* an image's pixels at w by h (smoothing on when it is drawn scaled), as 0 to 1 floats */
function pixels(im, w, h) {
  const c = canvasOf(w, h), x = c.getContext("2d", { willReadFrequently: true });
  x.imageSmoothingEnabled = true; x.drawImage(im, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
}
const hexc = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const overlay = (b, s) => b <= .5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
const clip01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* the choices as the manifest names them */
export const asManifest = b => ({ paint: b.paint || BUILD_STOCK.paint, top: b.top || BUILD_STOCK.top, guard: b.guard || BUILD_STOCK.guard, wear: b.wear || BUILD_STOCK.wear, metal: b.metal || BUILD_STOCK.metal, strings: !!b.long });

/* The picture of a build: { canvas } the size of the guitar's -road.webp. legId is the leg's guitar id (open, switch ...). */
export async function composeBuild(legId, build, slug) {
  const man = await manifest(), g = man.guitars[slug];
  const b = asManifest(build), d = man.dir.replace("{slug}", slug), T = man.tex;
  const base = await load(url(man.base.replace("{slug}", slug)));
  const W = base.naturalWidth, H = base.naturalHeight, N = W * H;
  const bp = pixels(base, W, H);
  const out = new Float32Array(N * 3), alpha = new Float32Array(N);
  for (let i = 0; i < N; i++) { out[i * 3] = bp[i * 4] / 255; out[i * 3 + 1] = bp[i * 4 + 1] / 255; out[i * 3 + 2] = bp[i * 4 + 2] / 255; alpha[i] = bp[i * 4 + 3] / 255; }
  const layer = async k => pixels(await load(url(d + g.files[k])), W, H);
  const opt = g.options, wear = man.wear[b.wear];
  const paint = opt.paint ? b.paint : "original";
  const top = opt.top.includes(b.top) && g.top_is_original !== b.top ? b.top : "none";
  /* a layer's texture at 1:1 with its centre on the anchor, repeated if it is smaller than the picture */
  const texAt = async (name, anchor) => {
    const im = await load(url(T + name)), tw = im.naturalWidth, th = im.naturalHeight, t = pixels(im, tw, th), o = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) { const ty = ((y - anchor[1] + (th >> 1)) % th + th) % th; for (let x = 0; x < W; x++) { const tx = ((x - anchor[0] + (tw >> 1)) % tw + tw) % tw, k = (ty * tw + tx) * 4, i = (y * W + x) * 3; o[i] = t[k] / 255; o[i + 1] = t[k + 1] / 255; o[i + 2] = t[k + 2] / 255; } }
    return o;
  };
  if (paint !== "original" || top !== "none") {
    const pl = await layer("paint"), gr = await layer("grain"), sp = await layer("light");
    const bq = pixels(await load(url(d + g.files.burst)), W, H); /* quarter size, drawn scaled up with smoothing */
    const F = new Float32Array(N * 3), mask = new Float32Array(N);
    for (let i = 0; i < N; i++) { F[i * 3] = out[i * 3]; F[i * 3 + 1] = out[i * 3 + 1]; F[i * 3 + 2] = out[i * 3 + 2]; }
    let gop = .5, lit = 1, flake = 0;
    if (paint !== "original") {
      const p = man.paints[paint]; gop = p.grain ?? .2; lit = p.light ?? 1; flake = p.flake ?? 0;
      const edge = p.edge && hexc(p.edge);
      if (p.kind === "burst") {
        const c0 = hexc(p.centre), m1 = hexc(p.mid || p.edge), e = hexc(p.edge);
        for (let i = 0; i < N; i++) { const t = bq[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) { let v = c0[c] + (m1[c] - c0[c]) * t; if (p.mid) v += (e[c] - v) * t * t; F[i * 3 + c] = v; } }
      } else {
        const col = hexc(p.colour);
        for (let i = 0; i < N; i++) { const t = bq[i * 4 + 3] / 255; for (let c = 0; c < 3; c++) F[i * 3 + c] = edge ? col[c] + (edge[c] - col[c]) * t : col[c]; }
      }
      for (let i = 0; i < N; i++) mask[i] = pl[i * 4 + 3] / 255;
    }
    if (top !== "none") {
      const t = man.tops[top], Tm = await layer("top"), tx = await texAt(t.texture, g.texture_anchor.top), rim = hexc(t.rim), e = hexc(t.edge);
      const flame = t.texture === "flame.webp", c0 = flame && hexc(t.centre), m1 = flame && hexc(t.mid || t.edge), es = t.edge_strength ?? .5;
      for (let i = 0; i < N; i++) {
        const P = pl[i * 4 + 3] / 255, tm = Tm[i * 4 + 3] / 255, bt = bq[i * 4 + 3] / 255;
        for (let c = 0; c < 3; c++) {
          let f = F[i * 3 + c];
          let ft;
          if (flame) { ft = c0[c] + (m1[c] - c0[c]) * bt; if (t.mid) ft += (e[c] - ft) * bt * bt; ft *= tx[i * 3 + c]; }
          else ft = tx[i * 3 + c] + (e[c] - tx[i * 3 + c]) * (bt * es);
          if (paint === "original" && clip01(P - tm) > 0) f = rim[c];
          F[i * 3 + c] = f + (ft - f) * tm;
        }
        mask[i] = P;
      }
      if (paint === "original") { gop = .45; lit = 1; }
    }
    const fl = flake ? pixels(await load(url(T + "flake.webp")), 256, 256) : null;
    for (let i = 0; i < N; i++) {
      const gv = gr[i * 4] / 255, sh = pl[i * 4] / 255, spec = sp[i * 4 + 3] / 255, x = i % W, y = (i - x) / W;
      const fa = fl ? fl[(((y % 256) * 256) + (x % 256)) * 4 + 3] / 255 * flake * clip01(sh * 1.6) : 0;
      for (let c = 0; c < 3; c++) {
        let f = F[i * 3 + c];
        f += (overlay(f, gv) - f) * gop;
        f = overlay(f, sh);
        if (fa) f += (1 - f) * fa;
        f += (1 - f) * (spec * lit * wear.light);
        const m = mask[i];
        out[i * 3 + c] += (clip01(f) - out[i * 3 + c]) * m;
      }
    }
  }
  if (wear.overlay) {
    const w = await layer(b.wear === "worn" ? "worn" : "played");
    for (let i = 0; i < N; i++) { const a = w[i * 4 + 3] / 255; if (a) for (let c = 0; c < 3; c++) out[i * 3 + c] += (w[i * 4 + c] / 255 - out[i * 3 + c]) * a; }
  }
  if (opt.guard && g.files.guard) {
    const gl = await layer("guard"), sp = await layer("light");
    let gname = b.guard;
    if (opt.guard_kind === "added" && gname === "original") gname = "none";
    const age = wear.guard_age && { c: hexc(wear.guard_age.colour), a: wear.guard_age.alpha };
    if (gname !== "original" && gname !== "none") {
      const q = man.guards[gname], tx = q.texture ? await texAt(q.texture, g.texture_anchor.guard) : null, col = q.colour && hexc(q.colour);
      for (let i = 0; i < N; i++) {
        const G = gl[i * 4 + 3] / 255; if (!G) continue;
        const gs = gl[i * 4] / 255, spec = sp[i * 4 + 3] / 255 * (q.light ?? 1) * wear.light;
        for (let c = 0; c < 3; c++) {
          let f = overlay(tx ? tx[i * 3 + c] : col[c], gs);
          f += (1 - f) * spec;
          if (age) f += (f * age.c[c] - f) * age.a;
          out[i * 3 + c] += (clip01(f) - out[i * 3 + c]) * G;
        }
      }
    } else if (gname === "original" && age) {
      for (let i = 0; i < N; i++) { const G = gl[i * 4 + 3] / 255; if (G) for (let c = 0; c < 3; c++) out[i * 3 + c] += (out[i * 3 + c] * age.c[c] - out[i * 3 + c]) * G * age.a; }
    }
  }
  const m = man.metal[b.metal];
  if (!m.original || wear.metal === "dull") {
    const Mk = await layer("metal"), col = m.colour && hexc(m.colour);
    for (let i = 0; i < N; i++) {
      const k = Mk[i * 4 + 3] / 255; if (!k) continue;
      const grey = .2126 * out[i * 3] + .7152 * out[i * 3 + 1] + .0722 * out[i * 3 + 2];
      for (let c = 0; c < 3; c++) {
        let tint = m.original ? out[i * 3 + c] : overlay(grey, col[c]);
        if (m.dull) tint = tint * .82 * (1 - m.dull) + tint * m.dull;
        if (wear.metal === "dull") tint += (tint * .9 + .03 - tint) * .6;
        out[i * 3 + c] += (clip01(tint) - out[i * 3 + c]) * k;
      }
    }
  }
  if (b.strings) {
    const s = await layer("strings");
    for (let i = 0; i < N; i++) {
      const sa = s[i * 4 + 3] / 255; if (!sa) continue;
      const a = alpha[i] * (1 - sa) + sa;
      for (let c = 0; c < 3; c++) out[i * 3 + c] = (out[i * 3 + c] * alpha[i] * (1 - sa) + s[i * 4 + c] / 255 * sa) / Math.max(a, 1e-4);
      alpha[i] = a;
    }
  }
  const cv = canvasOf(W, H), x = cv.getContext("2d"), id = x.createImageData(W, H);
  for (let i = 0; i < N; i++) { id.data[i * 4] = Math.round(clip01(out[i * 3]) * 255); id.data[i * 4 + 1] = Math.round(clip01(out[i * 3 + 1]) * 255); id.data[i * 4 + 2] = Math.round(clip01(out[i * 3 + 2]) * 255); id.data[i * 4 + 3] = Math.round(clip01(alpha[i]) * 255); }
  x.putImageData(id, 0, 0);
  return { canvas: cv, w: W, h: H };
}

/* ---- keyed by the build: one picture each, redrawn only when a choice changes ---- */
const ready = new Map(), pending = new Map();
function blobOf(cv) { return new Promise(res => cv.toBlob(res, "image/png")); }
/* the picture's address for this build once it is ready (a blob URL), else null; starts it if it is not under way */
export function builtURL(legId, build) {
  const sh = buildShown(legId, build);
  if (!Object.keys(sh).length || !BUILD_TAKES[legId]) return null;
  const key = buildKey(legId, build);
  if (ready.has(key)) return ready.get(key);
  if (!pending.has(key)) {
    pending.set(key, composeBuild(legId, sh, BUILD_TAKES[legId].slug).then(r => blobOf(r.canvas)).then(blob => {
      const u = URL.createObjectURL(blob); ready.set(key, u); pending.delete(key); trim();
      for (const el of document.querySelectorAll("[data-bk]")) if (el.dataset.bk === key) put(el, u);
      return u;
    }).catch(() => { pending.delete(key); return null; }));
  }
  return null;
}
/* trying parts in the builder makes a picture per try; keep the newest KEEP and let go of older ones no picture on the page
   is showing, so a long session doesn't hold them all in memory (each is a full-size PNG) */
const KEEP = 12;
function trim() {
  if (ready.size <= KEEP) return;
  const shown = new Set([...document.querySelectorAll("[data-bk]")].map(el => el.dataset.bk));
  for (const [key, u] of ready) {
    if (ready.size <= KEEP) break;
    if (shown.has(key)) continue;
    ready.delete(key); URL.revokeObjectURL(u);
  }
}
export const builtCount = () => ready.size;
const put = (el, u) => { if (el.tagName.toLowerCase() === "img") el.src = u; else el.setAttribute("href", u); };
/* what a template writes for a guitar picture: the address (the build if it is ready, else the painting) and the marker
   that swaps the build in when it is done */
export function buildPic(legId, build, painted) {
  const u = builtURL(legId, build);
  return { src: u || painted, attr: Object.keys(buildShown(legId, build)).length ? ` data-bk="${buildKey(legId, build).replace(/&/g, "&amp;").replace(/"/g, "&quot;")}"` : "" };
}
export const builtReady = (legId, build) => ready.has(buildKey(legId, build));
export const builtWait = (legId, build) => { builtURL(legId, build); return pending.get(buildKey(legId, build)) || Promise.resolve(ready.get(buildKey(legId, build)) || null); };
