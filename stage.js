// The stage (4.51.0): the show drawn on the song page itself, not on a copy of it. The line you're on sits on
// a band in the section's colour, edge to edge; lines ahead stay readable and lines behind fade. The chord
// you're on is the one you are asked to play. Chord Catch (4.54.0): a chord you played turns green and stays
// green (stageCatch); one that went by unplayed stays plain. A chord played again in a row shows once.
// Behind the words, a quiet stage light in the section's colour that fades out above the band.
// The Gig (gig.js) adds the score, the crowd and its controls on top. A song played unscored (practicing, a
// tab, Play together) gets the same stage with nothing on top (4.52.0): stagePlay and stageStop, from app.js.
import { gelOf } from "./core.js";
import { diag, READ_AT, musicClock, usesMusic, chordTimes, isLine } from "./app.js";

const $ = id => document.getElementById(id);

/* the sections of the song, top to bottom, with where each starts on the page */
export function sections() {
  const out = [];
  for (const b of diag.blocks || []) {
    if (b.el.classList.contains("sec")) out.push({ name: b.el.textContent.trim(), gel: gelOf(b.el.textContent), y: b.y, el: b.el });
    else if (!out.length && isLine(b.el)) out.push({ name: "", gel: "verse", y: b.y, el: b.el });
  }
  const end = Math.max(1, ...(diag.blocks || []).map(b => b.y));
  return out.map((s, i) => ({ ...s, to: out[i + 1]?.y ?? end })).map(s => ({ ...s, share: Math.max(0.02, (s.to - s.y) / end) }));
}

/* When each chord comes, as a place on the page. Chords on one line share its height, so each is moved
   down by how far along the line it sits: the line's chords are spread over the time the line takes. */
let along = { seq: null, y: [] };
function chordYs() {
  const seq = diag.seq || [], sheet = $("sheet");
  if (along.seq === seq || !sheet) return along.y;
  const box = sheet.getBoundingClientRect(), w = Math.max(1, box.width);
  const ys = [...new Set(seq.map(c => c.y))].sort((a, b) => a - b);
  const lastY = Math.max(0, ...(diag.blocks || []).map(b => b.y));
  along = { seq, y: seq.map(c => {
    const nx = ys.find(y => y > c.y + 2) ?? Math.max(c.y + 40, lastY);
    const x = Math.max(0, Math.min(0.95, (c.el.getBoundingClientRect().left - box.left) / w));
    return c.y + x * (nx - c.y);
  }) };
  return along.y;
}

/* where the song is: the current line, the current chord, the section, and how far along */
export function where(song) {
  const sheet = $("sheet");
  if (!sheet || !diag.blocks?.length) return null;
  const top = sheet.getBoundingClientRect().top, line = innerHeight * READ_AT;
  let b = 0;
  for (let i = 0; i < diag.blocks.length; i++) if (top + diag.blocks[i].y <= line) b = i;
  while (b < diag.blocks.length - 1 && !isLine(diag.blocks[b].el)) b++;
  let sec = null;
  for (let i = b; i >= 0; i--) if (diag.blocks[i].el.classList.contains("sec")) { sec = diag.blocks[i].el.textContent.trim(); break; }
  let idx = -1, next = -1, from = -1;
  const seq = diag.seq || [];
  if (seq.length) {
    const clock = usesMusic(song) ? musicClock(song) : null, ct = clock !== null ? chordTimes(song) : null;
    idx = 0;
    if (ct) { for (let i = 0; i < ct.length; i++) if (ct[i] != null && ct[i] <= clock) idx = i; }
    else { const ys = chordYs(); for (let i = 0; i < seq.length; i++) if (top + ys[i] <= line) idx = i; }
    for (let i = idx + 1; i < seq.length; i++) if (seq[i].name !== seq[idx].name) { next = i; break; }
    /* a chord played again in a row shows once, so the one you're on starts where its run began */
    from = idx; while (from > 0 && seq[from - 1].name === seq[from].name) from--;
  }
  const end = Math.max(1, diag.blocks[diag.blocks.length - 1].y);
  return { b, sec, idx, next, from, progress: Math.max(0, Math.min(1, (line - top) / end)) };
}

/* ---- drawing on the sheet ---- */
const st = { b: -2, on: -1, seq: null, got: new Set(), miss: new Set(), wait: -1 };
const MARKS = ["st-past", "st-now", "st-next", "st-rep", "st-got", "st-pop", "st-miss", "st-wait", "st-on"];

export function stageStart() {
  stageClear();
  document.body.classList.add("staged");
  const bg = document.createElement("div");
  bg.className = "st-bg"; bg.id = "st-bg"; bg.setAttribute("aria-hidden", "true");
  bg.innerHTML = '<i class="st-lamp"></i><i class="st-beam"></i>';
  document.body.prepend(bg);
}
export function stageClear() {
  const sheet = $("sheet");
  sheet?.querySelectorAll(MARKS.map(m => "." + m).join(",")).forEach(e => e.classList.remove(...MARKS));
  $("st-bg")?.remove();
  document.body.classList.remove("staged");
  delete document.body.dataset.gel;
  Object.assign(st, { b: -2, on: -1, seq: null, got: new Set(), miss: new Set(), wait: -1 });
}
/* the section's colour, for the band, the chords and the light */
export function stageGel(gel) { if (document.body.dataset.gel !== gel) document.body.dataset.gel = gel; }

/* Chord Catch (4.54.0): the song's chords you played stay green, the ones that went by unplayed go plain.
   `places` are seq indices (every chord of a run, the first one pops). They are kept, so a redraw paints them again. */
function paintMarks() {
  const seq = diag.seq || [];
  seq.forEach((c, i) => { c.el.classList.toggle("st-got", st.got.has(i)); c.el.classList.toggle("st-miss", st.miss.has(i) && !st.got.has(i)); });
}
export function stageCatch(places) {
  const seq = diag.seq || [];
  for (const i of places) { st.got.add(i); st.miss.delete(i); }
  paintMarks();
  const first = seq[places[0]]?.el;
  if (first) { first.classList.remove("st-pop"); void first.offsetWidth; first.classList.add("st-pop"); setTimeout(() => first.classList.remove("st-pop"), 700); }
}
export function stageMiss(places) { for (const i of places) if (!st.got.has(i)) st.miss.add(i); paintMarks(); }
/* Wait for me (4.54.0): the chord the song is holding on, with a soft ring (-1: none) */
export function stageWait(place) {
  const seq = diag.seq || [];
  if (st.wait >= 0) seq[st.wait]?.el.classList.remove("st-wait");
  st.wait = place;
  if (place >= 0) seq[place]?.el.classList.add("st-wait");
}

/* the band and the lines around it */
export function stagePaint(w) {
  const sheet = $("sheet");
  if (!sheet || !w) return;
  if (st.seq !== diag.seq) { /* a new layout (a redraw, a new key): mark the repeats and the chords again */
    st.seq = diag.seq; st.b = -2; st.on = -1;
    const seq = diag.seq || [];
    seq.forEach((c, i) => c.el.classList.toggle("st-rep", i > 0 && seq[i - 1].name === c.name));
    paintMarks();
    if (st.wait >= 0) seq[st.wait]?.el.classList.add("st-wait");
  }
  /* the chord you're on: not drawn, but marked, for the catch and for tests */
  if (w.from !== st.on) { const seq = diag.seq || []; seq[st.on]?.el.classList.remove("st-on"); st.on = w.from; seq[w.from]?.el.classList.add("st-on"); }
  if (w.b !== st.b) {
    st.b = w.b;
    let next = -1;
    for (let i = w.b + 1; i < diag.blocks.length; i++) if (isLine(diag.blocks[i].el)) { next = i; break; }
    diag.blocks.forEach((x, i) => {
      x.el.classList.toggle("st-past", i < w.b);
      x.el.classList.toggle("st-now", i === w.b);
      x.el.classList.toggle("st-next", i === next);
    });
  }
}

/* One frame of the stage: the section's colour and the band on the line you're on */
export function stageTick(song, w) {
  if (!w) return;
  stageGel(gelOf(w.sec || "verse"));
  stagePaint(w);
}
/* Unscored play on the stage (4.52.0): no score, no crowd, nothing on top; the folded Play is the pause */
let plain = 0;
export function stagePlay(song) {
  stageStop();
  stageStart();
  document.body.classList.add("staged-plain");
  const loop = () => {
    plain = requestAnimationFrame(loop);
    stageTick(song, where(song));
  };
  plain = requestAnimationFrame(loop);
}
export function stageStop() {
  if (!plain && !document.body.classList.contains("staged-plain")) return;
  cancelAnimationFrame(plain); plain = 0;
  document.body.classList.remove("staged-plain");
  stageClear();
}
