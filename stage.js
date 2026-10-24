// The stage (4.51.0): the show drawn on the song page itself, not on a copy of it. The line you're on sits on
// a band in the section's colour, edge to edge; lines ahead stay readable and lines behind fade. The chord
// you're on lights up over its word (the next one stays plain until the dots reach it, 4.49.11), with a dot
// for each beat it lasts between it and the next chord (4.49.10). A chord played again in a row shows once.
// Behind the words, a quiet stage light in the section's colour that fades out above the band.
// The Gig (gig.js) adds the score, the crowd and its controls on top. A song played unscored (practicing, a
// tab, Play together) gets the same stage with nothing on top (4.52.0): stagePlay and stageStop, from app.js.
import { RUN_MAX, beatsBetween, gelOf, runDot, onBeat } from "./core.js";
import { diag, READ_AT, jumpToSection, musicClock, usesMusic, chordTimes, pxPerSecond, isLine, beatSecs } from "./app.js";
import { metro } from "./audio.js";
import { sound } from "./ui.js";

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
  let idx = -1, next = -1, from = -1, until = null, span = 0;
  const seq = diag.seq || [];
  if (seq.length) {
    const clock = usesMusic(song) ? musicClock(song) : null, ct = clock !== null ? chordTimes(song) : null;
    idx = 0;
    if (ct) { for (let i = 0; i < ct.length; i++) if (ct[i] != null && ct[i] <= clock) idx = i; }
    else { const ys = chordYs(); for (let i = 0; i < seq.length; i++) if (top + ys[i] <= line) idx = i; }
    for (let i = idx + 1; i < seq.length; i++) if (seq[i].name !== seq[idx].name) { next = i; break; }
    /* a chord played again in a row shows once, so the one you're on starts where its run began */
    from = idx; while (from > 0 && seq[from - 1].name === seq[from].name) from--;
    if (next >= 0) {
      until = ct && ct[next] != null ? ct[next] - clock : (top + chordYs()[next] - line) / Math.max(1, pxPerSecond(song));
      span = ct ? (ct[next] != null && ct[from] != null ? ct[next] - ct[from] : 0) : (chordYs()[next] - chordYs()[from]) / Math.max(1, pxPerSecond(song));
    }
  }
  const end = Math.max(1, diag.blocks[diag.blocks.length - 1].y);
  return { b, sec, idx, next, from, until, span, progress: Math.max(0, Math.min(1, (line - top) / end)) };
}

/* ---- the song map (4.53.0) ----
   While a song plays, the sections are a thin bar at the top: each in its colour, as long as it is in the song,
   with a mark at your place. Tap one to go there. The jump isn't graded: stage.js says so with "stage-jump". */
export function stageMapHTML() {
  const secs = sections();
  return (secs.length ? secs : [{ gel: "verse", share: 1, name: "" }]).map((s, i) =>
    `<button class="gl-${s.gel}" data-i="${i}" style="flex:${s.share.toFixed(3)}" aria-label="${s.name ? "Go to " + s.name.replace(/[<>&"]/g, "") : "Song"}"></button>`).join("") + '<em id="gg-mark"></em>';
}
export function stageMapTap(e) {
  const b = e.target.closest?.("button[data-i]"), s = b && sections()[+b.dataset.i];
  if (!s?.el) return;
  e.stopPropagation();
  document.dispatchEvent(new Event("stage-jump"));
  jumpToSection(s.el);
}
export function stageMark(w) {
  const mark = $("gg-mark");
  if (mark) mark.style.left = (w.progress * 100).toFixed(2) + "%";
}

/* ---- drawing on the sheet ---- */
const st = { b: -2, lit: -2, lnext: -2, run: null, k: -2, seq: null };
const MARKS = ["st-past", "st-now", "st-next", "st-lit", "st-rep"];

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
  sheet?.querySelectorAll(".gc-run").forEach(e => e.remove());
  $("st-bg")?.remove();
  document.body.classList.remove("staged");
  delete document.body.dataset.gel;
  Object.assign(st, { b: -2, lit: -2, lnext: -2, run: null, k: -2, seq: null });
}
/* the section's colour, for the band, the chords and the light */
export function stageGel(gel) { if (document.body.dataset.gel !== gel) document.body.dataset.gel = gel; }

/* the band, the lines around it and the chord you're on; spb is a beat in seconds, for the dots */
export function stagePaint(w, spb) {
  const sheet = $("sheet");
  if (!sheet || !w) return;
  if (st.seq !== diag.seq) { /* a new layout (a redraw, a new key): mark the repeats again and repaint */
    st.seq = diag.seq; st.b = -2; st.lit = -2;
    const seq = diag.seq || [];
    seq.forEach((c, i) => c.el.classList.toggle("st-rep", i > 0 && seq[i - 1].name === c.name));
  }
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
  if (w.idx !== st.lit || w.next !== st.lnext) { st.lit = w.idx; st.lnext = w.next; paintLit(sheet, w, spb); }
}
function paintLit(sheet, w, spb) {
  sheet.querySelectorAll(".st-lit").forEach(e => e.classList.remove("st-lit"));
  sheet.querySelectorAll(".gc-run").forEach(e => e.remove());
  const seq = diag.seq || [], cur = seq[w.from]?.el, nx = w.next >= 0 ? seq[w.next]?.el : null;
  cur?.classList.add("st-lit");
  /* The beat dots: on the right of the chord you're on, one for each beat it lasts, spread over the gap to
     the next chord (or to the end of the line when the next one is further down). */
  const beats = w.next >= 0 ? Math.min(RUN_MAX, beatsBetween(w.span, spb)) : 0;
  st.run = { beats, el: null }; st.k = -2;
  const ct = cur?.querySelector(".ct"), row = cur?.closest("#sheet > *");
  if (!ct || !row || !beats) return;
  const a = ct.getBoundingClientRect(), L = row.getBoundingClientRect(), nt = nx?.querySelector(".ct")?.getBoundingClientRect();
  const same = nt && row.contains(nx) && Math.abs(nt.top - a.top) < 8 && nt.left > a.right;
  const x0 = a.right + 10 - L.left, x1 = (same ? nt.left - 10 : L.right - 14) - L.left;
  const shown = Math.min(beats, Math.floor((x1 - x0) / 16) + 1);
  if (shown < 1 || x1 <= x0) return;
  const y = a.top + a.height / 2 - L.top;
  const at = j => shown === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * j / (shown - 1);
  row.insertAdjacentHTML("beforeend", `<span class="gc-run" aria-hidden="true">${Array.from({ length: shown }, (_, j) => `<i style="left:${at(j).toFixed(1)}px;top:${y.toFixed(1)}px"></i>`).join("")}</span>`);
  st.run.el = row.querySelector(".gc-run");
}
/* the dots' run for this chord: how many beats it lasts */
export const stageRun = () => st.run;
/* light dot k of the run (-1: none). A run shorter than the chord's beats shows its last dots. */
export function stageDots(k) {
  if (k === st.k) return;
  st.k = k;
  const run = st.run?.el ? [...st.run.el.children] : [], d = k - ((st.run?.beats || 0) - run.length);
  run.forEach((e, i) => e.classList.toggle("on", i === d));
}

/* a beat, in seconds: the band's own when it's playing (so the dots move on its clicks), else the song's pace */
export const beatOf = song => metro.timer && metro.spb > 0 ? metro.spb : beatSecs(song);
/* One frame of the stage: the section's colour, the band and the chord you're on, and the dot for this beat.
   clock is in seconds on the audio clock when the band plays (its clicks are scheduled on it). */
export function stageTick(song, w, counting, clock) {
  if (!w) return;
  stageGel(gelOf(w.sec || "verse"));
  const spb = beatOf(song);
  stagePaint(w, spb);
  const band = metro.timer && metro.spb > 0;
  const until = w.until == null ? null : band ? onBeat(clock + w.until, metro.next, spb) - clock : w.until;
  stageDots(counting || !st.run ? -1 : runDot(until, spb, st.run.beats));
}
/* Unscored play on the stage (4.52.0): no score, no crowd, nothing on top; the folded Play is the pause */
let plain = 0;
export function stagePlay(song) {
  stageStop();
  stageStart();
  document.body.classList.add("staged-plain");
  const map = document.createElement("nav");
  map.className = "gg-map st-map"; map.id = "st-map"; map.setAttribute("aria-label", "Song sections");
  map.innerHTML = stageMapHTML();
  map.onclick = stageMapTap;
  document.body.appendChild(map);
  const loop = () => {
    plain = requestAnimationFrame(loop);
    const clock = metro.timer ? sound()?.currentTime ?? performance.now() / 1000 : performance.now() / 1000;
    const w = where(song);
    if (w) stageMark(w);
    stageTick(song, w, !!document.querySelector(".countin"), clock);
  };
  plain = requestAnimationFrame(loop);
}
export function stageStop() {
  if (!plain && !document.body.classList.contains("staged-plain")) return;
  cancelAnimationFrame(plain); plain = 0;
  $("st-map")?.remove();
  document.body.classList.remove("staged-plain");
  stageClear();
}
