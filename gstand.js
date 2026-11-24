// The guitar stand (Road Ready Dark and Light): one hero guitar in an A-frame cradle, the
// previous and next guitars peeking at the sides, and a dot pager under the feet. Me and the
// new-guitar sheet share this. Green Room and Headliner never call it.
import { VERSION, GUITARS, roadGuitars, roadPath, shopState } from "./core.js";
import { guitarPic } from "./fretboard.js";
import { buildPic } from "./buildart.js";
import { esc } from "./ui.js";
import PICS from "./art/guitars/pics.js";

const STAND = `art/case/guitar-stand`;

/* The crisp full guitar: the painted -road.webp when that body has one, else the small picture. */
export function standPic(body) {
  const small = guitarPic(body);
  if (!small) return "";
  const slug = small.match(/art\/guitars\/([^/?]+)-small\.webp/)?.[1];
  if (slug && PICS[slug]?.road) return `art/guitars/${slug}-road.webp?v=${VERSION}`;
  return small;
}

/* Guitars you own, in road order then shop order. extraId is the one just earned, so the sheet can
   put it in the row before that leg is marked done. A road id kept in guitars.seen is shown too. */
export function collectionOf(data, extraId) {
  const legs = roadPath(data).legs;
  /* roadGuitars: each headlined leg's guitar plus the next leg's (2026-11-23), labelled with the leg that earned it */
  const owned = roadGuitars(data), earned = new Set(owned.map(g => g.id)), wonOn = Object.fromEntries(owned.map(g => [g.id, g.li]));
  const seen = new Set(Array.isArray(data.guitars?.seen) ? data.guitars.seen : []);
  if (extraId && GUITARS[extraId]) seen.add(extraId);
  const items = [];
  for (const id of Object.keys(GUITARS)) {
    if (!earned.has(id) && !seen.has(id)) continue;
    const g = GUITARS[id], li = wonOn[id] ?? legs.findIndex(l => l.id === id), lg = li >= 0 ? legs[li] : null;
    const painted = standPic(g.body);
    const bp = data.builds?.[id] ? buildPic(id, data.builds[id], painted) : { src: painted, attr: "" };
    const got = earned.has(id) && lg;
    items.push({
      id, name: g.name, src: bp.src || painted, attr: bp.attr || "",
      label: got ? `${g.name}, earned on Leg ${li + 1}, ${lg.name}` : g.name,
      status: got ? `Earned on Leg ${li + 1}` : (extraId === id ? "New" : "Yours"),
      on: false, road: true
    });
  }
  const shop = shopState(data);
  for (const r of shop.rows) {
    if (!r.owned) continue;
    const on = r.id === shop.chosen;
    items.push({
      id: r.id, name: r.name, src: standPic(r.id), attr: "",
      label: `${r.name}, from the Guitar shop${on ? ", the one you play" : ""}`,
      status: on ? "The one you play" : "From the Guitar shop",
      on, road: false
    });
  }
  return items;
}

/* Where the row opens: the guitar you play, else the one asked for, else the newest road guitar. */
export function standIndex(items, prefer) {
  if (!items.length) return 0;
  if (prefer) { const i = items.findIndex(g => g.id === prefer); if (i >= 0) return i; }
  const on = items.findIndex(g => g.on);
  if (on >= 0) return on;
  let last = 0;
  items.forEach((g, i) => { if (g.road) last = i; });
  return last;
}

/* A short run of dots around the current guitar, so 23 still sit on one line. */
function pagerHTML(n, i) {
  if (n < 1) return "";
  const side = 3;
  let start = Math.max(0, i - side), end = Math.min(n - 1, i + side);
  while (end - start + 1 < Math.min(n, side * 2 + 1) && (start > 0 || end < n - 1)) {
    if (end < n - 1 && (end - i <= i - start)) end++;
    else if (start > 0) start--;
    else end++;
  }
  let left = "", right = "";
  for (let k = start; k <= i; k++) left += `<i class="${k === i ? "on" : ""}${k === start && start > 0 ? " far" : ""}"></i>`;
  for (let k = i + 1; k <= end; k++) right += `<i class="${k === end && end < n - 1 ? "far" : ""}"></i>`;
  return `<div class="gs-pager"><span class="gs-dots">${left}</span><span class="gs-count">${i + 1} of ${n}</span><span class="gs-dots">${right}</span></div>`;
}

export function standHTML(items, o = {}) {
  const n = items.length, active = n ? Math.max(0, Math.min(n - 1, o.active ?? 0)) : 0;
  const sheet = o.variant === "sheet";
  const pics = items.map((g, k) => {
    const p = Math.min(1, Math.abs(k - active));
    return `<button type="button" class="gs-item rr-gtr${k === active ? " is-on" : ""}" style="--gs-p:${p}" data-name="${esc(g.name)}" data-status="${esc(g.status)}" aria-label="${esc(g.label)}" aria-pressed="${k === active}"><img src="${esc(g.src)}"${g.attr} alt="" aria-hidden="true"></button>`;
  }).join("");
  const cur = items[active];
  const v = `?v=${VERSION}`;
  return `<div class="gs-stage${sheet ? " gs-sheet" : ""}${n ? "" : " gs-empty"}">
    <div class="gs-hero">
      <div class="gs-glow" aria-hidden="true"></div>
      <div class="gs-floor" aria-hidden="true"></div>
      <img class="gs-back" src="${STAND}-back.webp${v}" alt="" aria-hidden="true">
      ${n ? `<div class="gs-track" role="group" aria-label="Your guitars, earned and bought">${pics}</div>` : ""}
    </div>
    ${n ? pagerHTML(n, active) : ""}
    ${n && !sheet ? `<p class="gs-cap"><b>${esc(cur.name)}</b>${cur.status ? `<small>${esc(cur.status)}</small>` : ""}</p>` : ""}
  </div>`;
}

/* Scroll, snap, tap and arrow keys. The stand and the glow stay put. The guitar in the middle
   is full size. The ones leaving it dim as they move. */
export function bindStand(root) {
  if (!root) return;
  const track = root.querySelector(".gs-track");
  const items = track ? [...track.querySelectorAll(".gs-item")] : [];
  if (!items.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = Math.max(0, items.findIndex(el => el.classList.contains("is-on")));
  let lock = 0;

  const paint = i => {
    active = i;
    const n = items.length;
    items.forEach((el, k) => el.setAttribute("aria-pressed", k === i ? "true" : "false"));
    items.forEach((el, k) => el.classList.toggle("is-on", k === i));
    const count = root.querySelector(".gs-count");
    if (count) count.textContent = `${i + 1} of ${n}`;
    const pager = root.querySelector(".gs-pager");
    if (pager) pager.outerHTML = pagerHTML(n, i);
    const cap = root.querySelector(".gs-cap");
    const b = cap?.querySelector("b"), sm = cap?.querySelector("small");
    if (b) b.textContent = items[i].dataset.name || "";
    if (sm) { sm.textContent = items[i].dataset.status || ""; sm.hidden = !items[i].dataset.status; }
  };

  const frame = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    const step = items[0].offsetWidth || 1;
    let best = 0, bestD = Infinity;
    items.forEach((el, k) => {
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(c - mid);
      el.style.setProperty("--gs-p", Math.min(1, d / step).toFixed(3));
      if (d < bestD) { bestD = d; best = k; }
    });
    if (best !== active && Date.now() > lock) paint(best);
  };

  const go = (i, smooth) => {
    i = Math.max(0, Math.min(items.length - 1, i));
    const el = items[i];
    lock = Date.now() + (smooth && !reduce ? 420 : 0);
    paint(i);
    const left = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduce ? "smooth" : "auto" });
    requestAnimationFrame(frame);
  };

  let x0 = 0, moved = false;
  track.addEventListener("pointerdown", e => { x0 = e.clientX; moved = false; });
  track.addEventListener("pointermove", e => { if (Math.abs(e.clientX - x0) > 8) moved = true; });
  track.addEventListener("click", e => {
    if (moved) return;
    const btn = e.target.closest(".gs-item");
    if (!btn) return;
    const i = items.indexOf(btn);
    if (i >= 0 && i !== active) go(i, true);
  });
  root.addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const i = active + (e.key === "ArrowRight" ? 1 : -1);
    go(i, true);
    items[Math.max(0, Math.min(items.length - 1, i))]?.focus();
  });
  track.addEventListener("scroll", () => requestAnimationFrame(frame), { passive: true });
  go(active, false);
}
