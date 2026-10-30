/* 4.86.1: the Nano guitars drawn by hand as clean shapes, in the same frame as the traced art (nums.js), so the
   Road's layout doesn't move. Run: node tools/guitars/draw.mjs [name ...]. Writes art/guitars/<name>.js.
   Every outline is a smooth closed curve through a few points (Catmull-Rom turned into cubic Beziers), or a
   polygon with rounded corners where the guitar has points. Only M, C, L and Z are used (a test checks). */
import fs from "node:fs";
const NUMS = (await import("../../art/guitars/nums.js")).default;
const f = v => +(+v).toFixed(1);

/* a smooth closed curve through the points; `k` is how round (1 = Catmull-Rom) */
function smooth(pts, k = 1) {
  const n = pts.length, P = i => pts[(i + n) % n];
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)];
    d += `C${f(p1[0] + k * (p2[0] - p0[0]) / 6)} ${f(p1[1] + k * (p2[1] - p0[1]) / 6)} ${f(p2[0] - k * (p3[0] - p1[0]) / 6)} ${f(p2[1] - k * (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}
/* the right half (top centre to bottom centre, clockwise) and its mirror back up the left */
const both = (cx, right) => [...right, ...right.slice(1, -1).reverse().map(([x, y]) => [2 * cx - x, y])];
/* a polygon whose corners are rounded by r (a corner's own r if the point has a third number) */
function roundPoly(pts, r = 6) {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n], rr = b[2] ?? r;
    const la = Math.hypot(a[0] - b[0], a[1] - b[1]), lc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    const ta = Math.min(rr, la / 2) / la, tc = Math.min(rr, lc / 2) / lc;
    const p = [b[0] + (a[0] - b[0]) * ta, b[1] + (a[1] - b[1]) * ta], q = [b[0] + (c[0] - b[0]) * tc, b[1] + (c[1] - b[1]) * tc];
    d += `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}C${f((p[0] + 2 * b[0]) / 3)} ${f((p[1] + 2 * b[1]) / 3)} ${f((q[0] + 2 * b[0]) / 3)} ${f((q[1] + 2 * b[1]) / 3)} ${f(q[0])} ${f(q[1])}`;
  }
  return d + "Z";
}
const circ = (x, y, r, fill, extra = "") => `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="${fill}"${extra}/>`;
const rr = (x, y, w, h, r, fill) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${r}" fill="${fill}"/>`;
const shade = (hex, k) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("");
let uid = 0;
/* lit on the left, the shade colour on the right of x: the look of Louie and the Road */
function halves(d, cx, lit, sh, h = 700) {
  const id = `r${++uid}`;
  return `<clipPath id="${id}"><rect x="${f(cx)}" y="-10" width="500" height="${h}"/></clipPath><path d="${d}" fill="${lit}"/><path d="${d}" fill="${sh}" clip-path="url(#${id})"/>`;
}
/* a body: the top in two halves and the binding inside the edge (the app clips the body to its outline) */
function body(d, cx, c, h) {
  const id = `r${++uid}`;
  return halves(d, cx, c.top, shade(c.top, .86), h) + `<clipPath id="${id}"><rect x="${f(cx)}" y="-10" width="500" height="${h}"/></clipPath>`
    + `<path d="${d}" fill="none" stroke="${c.bind}" stroke-width="${c.bw || 12}"/><path d="${d}" fill="none" stroke="${shade(c.bind, .88)}" stroke-width="${c.bw || 12}" clip-path="url(#${id})"/>`;
}
/* three-a-side tuners: a post on the face, a shaft out the side and a rounded button with a shine */
function tuners(cx, xs, ys, edge, c, w = 22, h = 17) {
  let s = "";
  for (const y of ys) for (const side of [-1, 1]) {
    const e = cx + side * edge, bx = e + side * 9, lit = side < 0 ? c.metal : shade(c.metal, .86);
    s += rr(Math.min(e, bx) - 1, y - 3.5, 11, 7, 2, shade(c.metal, .78));
    s += rr(side < 0 ? bx - w : bx, y - h / 2, w, h, h / 2.2, lit) + rr(side < 0 ? bx - w + 4 : bx + 4, y - h / 2 + 3, w - 8, 3, 1.5, "#ffffff80");
    s += circ(cx + side * xs, y + 1, 8.5, shade(c.metal, .7)) + circ(cx + side * xs, y, 8, lit) + circ(cx + side * xs, y, 3, c.post || shade(c.metal, .55));
  }
  return s;
}
/* a soundhole with its rosette rings and the edge of the top catching light inside */
function hole(cx, y, r, c, mosaic) {
  return circ(cx, y, r + 14, c.bind) + circ(cx, y, r + 10, c.ring)
    + (mosaic ? `<circle cx="${cx}" cy="${y}" r="${r + 10}" fill="none" stroke="${c.bind}" stroke-width="3" stroke-dasharray="4 4"/>` : "")
    + circ(cx, y, r + 5, c.bind) + circ(cx, y, r + 2, c.ring) + circ(cx, y, r, "#1d120c")
    + `<path d="M${f(cx)} ${f(y - r)}C${f(cx + r * .55)} ${f(y - r)} ${f(cx + r)} ${f(y - r * .55)} ${f(cx + r)} ${f(y)}C${f(cx + r)} ${f(y + r * .55)} ${f(cx + r * .55)} ${f(y + r)} ${f(cx)} ${f(y + r)}Z" fill="#140c08"/>`;
}
/* an f-hole: a slot bent like an s with a round end at each tip */
function fhole(x, y, s, c) {
  const X = v => f(x + s * v);
  return `<path d="M${X(10)} ${y - 46}C${X(-8)} ${y - 30} ${X(12)} ${y - 8} ${X(0)} ${y + 10}C${X(-10)} ${y + 26} ${X(8)} ${y + 38} ${X(-6)} ${y + 48}" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`
    + circ(x + s * 11, y - 48, 6, c) + circ(x - s * 7, y + 50, 6, c) + rr(x - 7, y + 4, 14, 3, 1.5, c);
}

/* headstocks: a plate in two halves from its top shape down into the neck at the nut */
function plate(cx, nut, half, neckHalf, topPts, c) {
  const pts = [...topPts, [cx + half, 36, 8], [cx + neckHalf + 6, nut - 26, 18], [cx + neckHalf, nut + 4, 0], [cx - neckHalf, nut + 4, 0], [cx - neckHalf - 6, nut - 26, 18], [cx - half, 36, 8]];
  return halves(roundPoly(pts, 10), cx, c.head, shade(c.head, .8), nut + 10);
}
const TOPS = {
  crown: (cx, h) => [[cx - h + 4, 14, 10], [cx, 2, 8], [cx + h - 4, 14, 10]],
  book: (cx, h) => [[cx - h, 12, 10], [cx - h * .45, 4, 14], [cx, 14, 6], [cx + h * .45, 4, 14], [cx + h, 12, 10]],
  crest: (cx, h) => [[cx - h, 16, 12], [cx - h * .5, 6, 20], [cx, 2, 20], [cx + h * .5, 6, 20], [cx + h, 16, 12]],
  point: (cx, h) => [[cx - h - 4, 2, 4], [cx, 22, 6], [cx + h + 4, 2, 4]]
};
function head3(name, kind, c, o = {}) {
  const n = NUMS[name], hc = (n.l0 + n.r0) / 2, span = (n.hr - n.hl) / 2, half = span - 32, neckHalf = Math.max(30, (n.r0 - n.l0) / 2 - 2);
  const ys = o.ys || [42, 80, 118];
  let s = plate(hc, n.nut, half, neckHalf, TOPS[kind](hc, half), c);
  if (o.slots) { /* a slotted head: two long windows with the rollers across them */
    for (const side of [-1, 1]) {
      const x = hc + side * half * .42;
      s += rr(x - 10, 26, 20, 112, 10, "#1a100b");
      for (const y of ys) s += rr(x - 12, y - 4, 24, 8, 4, c.roller) + rr(x - 12, y - 4, 24, 3, 1.5, "#ffffff70");
    }
    for (const y of ys) for (const side of [-1, 1]) {
      const e = hc + side * half, bx = e + side * 9;
      s += rr(Math.min(e, bx) - 1, y - 3.5, 11, 7, 2, shade(c.metal, .7));
      s += rr(side < 0 ? bx - 20 : bx, y - 9, 20, 18, 7, side < 0 ? c.metal : shade(c.metal, .86)) + rr(side < 0 ? bx - 16 : bx + 4, y - 6, 12, 3, 1.5, "#ffffff90");
    }
    return s;
  }
  return s + tuners(hc, half * .52, ys, half, c);
}
/* six-in-line: a paddle that leans to the bass side with all six buttons out of its left edge */
function headInline(name, c) {
  const n = NUMS.solid, hc = (n.l0 + n.r0) / 2, nh = (n.r0 - n.l0) / 2 - 2, L = n.hl + 30;
  const pts = [[L, 22, 16], [L + 34, 4, 22], [hc + 40, 2, 20], [hc + 58, 18, 18], [hc + 52, 44, 16], [hc + nh + 6, n.nut - 30, 18], [hc + nh, n.nut + 4, 0], [hc - nh, n.nut + 4, 0], [hc - nh - 4, n.nut - 22, 14], [L, n.nut - 30, 18]];
  let s = halves(roundPoly(pts), hc, c.head, shade(c.head, .82), n.nut + 10);
  for (let i = 0; i < 6; i++) {
    const y = 28 + i * 19, x = L + 20 + i * 2;
    s += rr(L - 9, y - 3.5, 12, 7, 2, shade(c.metal, .7)) + rr(L - 30, y - 7.5, 22, 15, 6.5, c.metal) + rr(L - 26, y - 5, 14, 3, 1.5, "#ffffff90");
    s += circ(x, y + 1, 7, shade(c.metal, .65)) + circ(x, y, 6.5, c.metal) + circ(x, y, 2.4, shade(c.metal, .5));
  }
  return s;
}

const DRAW = {
  parlor() {
    const n = NUMS.parlor, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#9a6334", bind: "#efe4c8", ring: "#5c3a1f", head: "#5e3b22", metal: "#efe4c8", post: "#8a7a5c" };
    const sil = smooth(both(cx, [[cx, T], [cx + 72, T + 6], [cx + 104, T + 54], [cx + 96, T + 118], [cx + 87, T + 156], [cx + 112, T + 220], [cx + 150, T + 290], [cx + 140, T + 366], [cx + 82, B - 6], [cx, B]]));
    return { head: head3("parlor", "crown", c), body: body(sil, cx, c, n.h) + hole(cx, n.end + 62, 40, c), sil };
  },
  cutaway() {
    const n = NUMS.cutaway, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#7a4424", bind: "#e9dcbc", ring: "#3a2214", head: "#3a2a22", metal: "#F5C542" };
    /* a round cutaway on the treble side: the horn curls up beside the neck */
    const sil = smooth([[cx, T], [cx + 60, T + 2], [cx + 76, T + 60], [cx + 82, n.end - 2], [cx + 92, T + 72], [cx + 112, T + 48], [cx + 130, T + 86], [cx + 114, T + 150], [cx + 110, T + 176], [cx + 140, T + 238], [cx + 152, T + 300], [cx + 128, B - 22], [cx, B],
      [cx - 128, B - 22], [cx - 152, T + 300], [cx - 140, T + 238], [cx - 108, T + 170], [cx - 112, T + 130], [cx - 124, T + 66], [cx - 92, T + 12], [cx - 40, T]]);
    const guard = smooth([[cx + 40, n.end + 74], [cx + 66, n.end + 30], [cx + 92, n.end + 66], [cx + 84, n.end + 112], [cx + 50, n.end + 104]]);
    return { head: head3("cutaway", "crown", c), body: body(sil, cx, c, n.h) + `<path d="${guard}" fill="#2a1710"/>` + hole(cx, n.end + 40, 34, c), sil };
  },
  solid() {
    const n = NUMS.solid, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#5FC4B0", bind: "#9fe0d3", bw: 8, head: "#5FC4B0", metal: "#cdd2da" };
    /* an offset double cut: the bass horn reaches higher, the waist sits low on the treble side */
    const sil = smooth([[cx, T + 10], [cx + 60, T + 10], [cx + 78, n.end + 4], [cx + 88, T + 10], [cx + 112, T + 2], [cx + 134, T + 50], [cx + 118, T + 150], [cx + 150, T + 240], [cx + 148, T + 322], [cx + 100, B - 6], [cx, B],
      [cx - 100, B - 8], [cx - 150, T + 320], [cx - 146, T + 230], [cx - 124, T + 150], [cx - 136, T + 40], [cx - 124, T - 16], [cx - 98, T - 22], [cx - 82, T + 14], [cx - 78, n.end + 4], [cx - 60, T + 10]]);
    const g = smooth([[cx - 70, n.end + 30], [cx + 70, n.end + 34], [cx + 90, n.end + 90], [cx + 70, n.bridge - 30], [cx + 30, n.bridge + 26], [cx - 54, n.bridge + 40], [cx - 100, n.bridge - 6], [cx - 104, n.end + 100]]);
    return { head: headInline("solid", c), body: body(sil, cx, c, n.h) + `<path d="${g}" fill="#c9d0d6" transform="translate(0 3)"/><path d="${g}" fill="#f4f1ea"/>`, sil };
  },
  hollow() {
    const n = NUMS.hollow, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#b8492a", bind: "#efe4c8", head: "#1c1d22", metal: "#F5C542" };
    /* a semi-hollow double cut: two round horns, a soft waist, f-holes */
    const sil = smooth(both(cx, [[cx, T + 10], [cx + 60, T + 10], [cx + 80, n.end - 2], [cx + 86, T + 30], [cx + 112, T + 2], [cx + 142, T + 30], [cx + 146, T + 100], [cx + 128, T + 170], [cx + 150, T + 256], [cx + 144, T + 344], [cx + 96, B - 8], [cx, B]]));
    return { head: head3("hollow", "book", c), body: body(sil, cx, c, n.h) + fhole(cx - 104, T + 236, 1, "#2a120a") + fhole(cx + 104, T + 236, -1, "#2a120a"), sil };
  },
  single() {
    const n = NUMS.single, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#8b1e2b", bind: "#f1d5a8", head: "#1c1d22", metal: "#dfe3ea" };
    /* a single cut: a round bass bout and a pointed horn on the treble side */
    const sil = smooth([[cx, T + 6], [cx + 50, T + 20], [cx + 80, n.end - 2], [cx + 88, T + 64], [cx + 110, T + 38], [cx + 134, T + 84], [cx + 124, T + 150], [cx + 142, T + 216], [cx + 152, T + 300], [cx + 132, B - 26], [cx, B],
      [cx - 132, B - 26], [cx - 152, T + 300], [cx - 138, T + 214], [cx - 128, T + 150], [cx - 138, T + 70], [cx - 100, T + 8], [cx - 40, T]]);
    return { head: head3("single", "book", c), body: body(sil, cx, c, n.h), sil };
  },
  classical() {
    const n = NUMS.classical, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#cf8f4c", bind: "#efe4c8", ring: "#7a4a22", head: "#3a2418", metal: "#efe4c8", roller: "#f4efe2" };
    const sil = smooth(both(cx, [[cx, T], [cx + 74, T + 4], [cx + 112, T + 60], [cx + 104, T + 124], [cx + 96, T + 164], [cx + 128, T + 232], [cx + 152, T + 300], [cx + 136, B - 30], [cx + 76, B - 2], [cx, B]]));
    return { head: head3("classical", "crest", c, { slots: true }), body: body(sil, cx, c, n.h) + hole(cx, n.end + 58, 38, c, true), sil };
  },
  headliner() {
    const n = NUMS.headliner, cx = n.cx, T = n.top, B = n.h - 4;
    const c = { top: "#8A47F5", bind: "#F5C542", bw: 9, head: "#8A47F5", metal: "#F5C542" };
    /* our own: flared horns up beside the neck, sides sweeping out to sharp lower points, a swallowtail between */
    const sil = roundPoly([[cx, T + 4, 10], [cx + 60, T + 4, 10], [cx + 80, n.end - 2, 18], [cx + 98, T - 34, 10], [cx + 140, T - 20, 14], [cx + 118, T + 130, 50], [cx + 155, B - 4, 6], [cx + 96, B - 34, 18], [cx, B - 96, 22],
      [cx - 96, B - 34, 18], [cx - 155, B - 4, 6], [cx - 118, T + 130, 50], [cx - 140, T - 20, 14], [cx - 98, T - 34, 10], [cx - 80, n.end - 2, 18], [cx - 60, T + 4, 10]], 12);
    return { head: head3("headliner", "point", c), body: body(sil, cx, c, n.h), sil };
  }
};

for (const name of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(DRAW)) {
  const n = { ...NUMS[name] }, a = DRAW[name]();
  delete n.own; delete n.pl; delete n.pr; /* the app draws the bridge at the width of the strings */
  const art = { head: a.head, body: a.body, over: "", sil: a.sil, clean: 1, hand: 1, nums: n, view: [n.w, n.h] };
  fs.writeFileSync(`art/guitars/${name}.js`, `/* Drawn by hand as clean shapes by tools/guitars/draw.mjs (4.86.1). Do not edit here; edit the drawing there. */\nexport default ${JSON.stringify(art)};\n`);
  console.log(name, fs.statSync(`art/guitars/${name}.js`).size);
}
/* nums.js too: the drawn guitars have no bridge of their own */
const all = { ...NUMS };
for (const k of Object.keys(DRAW)) { all[k] = { ...all[k] }; delete all[k].own; delete all[k].pl; delete all[k].pr; }
fs.writeFileSync("art/guitars/nums.js", `/* The numbers of each Nano guitar (the frame the drawings in tools/guitars/draw.mjs use). Do not edit by hand. */\nexport default ${JSON.stringify(all)};\n`);
