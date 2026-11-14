// Measures the chord engine on the single-chord memos (tests/audio/chords): node tools/hearing/measure.mjs
import fs from "node:fs";
import * as C from "../../core/neck.js";
const dir = new URL("../../tests/audio/chords/", import.meta.url).pathname;
function wav(p) {
  const b = fs.readFileSync(p); let o = 12, fmt, data;
  while (o < b.length) { const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4); if (id === "fmt ") fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) }; if (id === "data") data = b.subarray(o + 8, o + 8 + n); o += 8 + n + (n & 1); }
  const s = fmt.bits / 8, n = data.length / s / fmt.ch, x = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < fmt.ch; c++) v += s === 2 ? data.readInt16LE((i * fmt.ch + c) * 2) / 32768 : data.readFloatLE((i * fmt.ch + c) * 4); x[i] = v / fmt.ch; }
  return { x, sr: fmt.sr };
}
function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
const N = 16384;
function frames(x, sr) {
  const out = [], hop = Math.round(sr * 0.05); let peak = 0;
  for (let i = 0; i + N <= x.length; i += hop) { let r = 0; for (let k = i + N - 1024; k < i + N; k++) r += x[k] * x[k]; r = Math.sqrt(r / 1024); peak = Math.max(peak, r); out.push({ i, r }); }
  return out.filter(f => f.r > Math.max(0.004, peak * 0.1)).map(f => {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let k = 0; k < N; k++) { const w = 0.42 - 0.5 * Math.cos(2 * Math.PI * k / N) + 0.08 * Math.cos(4 * Math.PI * k / N); re[k] = x[f.i + k] * w; }
    fft(re, im); const db = new Float32Array(N / 2); for (let k = 0; k < N / 2; k++) db[k] = 20 * Math.log10(Math.hypot(re[k], im[k]) / N + 1e-12);
    return C.chromaOf(db, sr, N);
  }).filter(Boolean);
}
const names = ["Am", "C", "D", "Em", "F", "G"], memos = {};
for (const f of fs.readdirSync(dir)) { const n = f.split("_")[0]; const { x, sr } = wav(dir + f); (memos[n] ||= []).push(...frames(x, sr)); }
console.log("SINGLE CHORD (is it this chord?)  frames  own-fit%  falsely-accepted-as-another%");
for (const n of names) { const fr = memos[n]; const own = fr.filter(c => C.strumFit(c, n) >= C.CHORD_FIT && C.chordLeadOver(c, n, names).lead > 0).length; const fa = fr.filter(c => names.some(m => m !== n && C.strumFit(c, m) >= C.CHORD_FIT && C.chordLeadOver(c, m, [n]).lead > 0)).length; const loose = fr.filter(c => C.strumFit(c, n) >= C.CHORD_FIT).length;
  console.log(n.padEnd(4), String(fr.length).padStart(5), `fit alone ${Math.round(100*loose/fr.length)}%`.padStart(16), `fit+tell-apart ${Math.round(100*own/fr.length)}%`.padStart(20), `wrong ${Math.round(100*fa/fr.length)}%`.padStart(11)); }
console.log("\nPAIRS (two chords taking turns): share of frames called correctly, A frames / B frames");
for (let a = 0; a < names.length; a++) for (let b = a + 1; b < names.length; b++) { const A = names[a], B = names[b];
  const call = (c, me, ot) => { const f1 = C.strumFit(c, me) ?? 0, f2 = C.strumFit(c, ot) ?? 0; if (Math.max(f1, f2) < C.CHORD_FIT) return null; const l = C.chordLead(c, me, ot); return l === null ? f1 >= f2 : l > 0; };
  const ra = memos[A].filter(c => call(c, A, B) === true).length / memos[A].length, rb = memos[B].filter(c => call(c, B, A) === true).length / memos[B].length;
  console.log(`${A}-${B}`.padEnd(6), `${Math.round(100 * ra)}% / ${Math.round(100 * rb)}%`); }
