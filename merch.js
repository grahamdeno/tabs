// The Merch table (4.14.0): spend the fans you've earned. Gear is used up (Rain check, Double set,
// Second take); Louie's finishes and stage backdrops are kept and you pick which is on. Opened by
// tapping your fans in the stat bar, from More, and from Show complete when you can afford something.
// The numbers (prices, what you have, buying) are MERCH and friends in core.js.
//   renderMerch()        the page at #/merch
//   applyWear()          puts the worn finish on every Louie (body[data-wear])
//   backdropArt(id)      the drawing behind the top of a gig, or "" for the plain stage
import { MERCH, Tabs, merchBuy, merchState, merchWear, merchWorn } from "./core.js";
import { app, esc, layer, toast } from "./ui.js";
import { data, go } from "./app.js";
import { louie } from "./louie.js";

const n = x => x.toLocaleString("en-US");
const TK = `<svg class="mc-tkic" width="20" height="16" viewBox="0 0 34 28" aria-hidden="true"><path class="mc-tkd" d="M3 6h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/><path class="mc-tk" d="M3 4h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/></svg>`;
const GEAR = {
  rain: `<svg width="56" height="52" viewBox="0 0 70 64" aria-hidden="true"><path d="M18 40a11 11 0 0 1 3-21.6A15 15 0 0 1 49 20a10 10 0 0 1 3 20z" fill="#2C6FE0"/><path d="M18 36a11 11 0 0 1 3-21.6A15 15 0 0 1 49 16a10 10 0 0 1 3 20z" fill="#7FB3FF"/><path d="M26 20a9 9 0 0 1 9-5" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M24 46l-3 7M35 46l-3 7M46 46l-3 7" stroke="#3A86FF" stroke-width="4" stroke-linecap="round"/></svg>`,
  double: `<svg width="56" height="52" viewBox="0 0 70 64" aria-hidden="true"><circle cx="35" cy="34" r="25" fill="#0B1226"/><circle cx="35" cy="31" r="25" fill="#14213D"/><circle cx="35" cy="31" r="17" fill="none" stroke="#2A3A63" stroke-width="2"/><circle cx="35" cy="31" r="10" fill="#FF8A00"/><text x="35" y="37" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="15" fill="#14213D">2x</text></svg>`,
  take: `<svg width="56" height="52" viewBox="0 0 70 64" aria-hidden="true"><rect x="12" y="18" width="46" height="36" rx="6" fill="#C91F5C"/><rect x="12" y="14" width="46" height="36" rx="6" fill="#FF3D7F"/><path d="M12 14l8-10h10l-8 10M30 14l8-10h10l-8 10" fill="#14213D"/><path d="M27 32a8 8 0 1 0 3-6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M28 20v7h7" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};
/* backdrops, drawn 100 x 64 and stretched to fill */
const ART = {
  brick: () => `<rect width="100" height="64" fill="#8E3B2E"/>${[0, 1, 2, 3, 4, 5].map(r => [0, 1, 2, 3, 4, 5].map(c => `<rect x="${c * 20 - (r % 2) * 10 + 1}" y="${r * 10 + 1}" width="18" height="8" rx="1" fill="#A9483A"/>`).join("")).join("")}<ellipse cx="50" cy="0" rx="34" ry="40" fill="#FFF6C8" opacity=".2"/>`,
  stars: () => `<rect width="100" height="64" fill="#1D1640"/>${[[8, 8], [22, 20], [36, 6], [48, 26], [60, 10], [74, 22], [88, 8], [94, 30], [14, 36], [56, 40], [80, 44], [30, 46], [68, 52], [6, 54]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.5 : 0.9}" fill="${i % 4 ? "#FFF6C8" : "#3DE0FF"}"/>`).join("")}`,
  sunset: () => `<rect width="100" height="64" fill="#FF8A00"/><rect width="100" height="20" fill="#FF3D7F"/><circle cx="50" cy="40" r="17" fill="#FFD23F"/><path d="M0 46 L18 34 L34 44 L52 30 L72 44 L86 36 L100 44 V64 H0Z" fill="#14213D" opacity=".75"/>`,
  basement: () => `<rect width="100" height="64" fill="#2A3A63"/><ellipse cx="50" cy="0" rx="30" ry="44" fill="#FFF6C8" opacity=".14"/>`
};
const artSVG = (id, cls = "") => `<svg class="${cls}" viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${(ART[id] || ART.basement)()}</svg>`;
export const backdropArt = id => ART[id] && id !== "basement" ? `<div class="gg-bd" aria-hidden="true">${artSVG(id)}</div>` : "";
export function applyWear() {
  const w = merchWorn(data);
  if (w === "stock") delete document.body.dataset.wear; else document.body.dataset.wear = w;
}
const lou = (id, size, mood = "happy", pose) => `<span class="fin fin-${id}">${louie(mood, { size, pose })}</span>`;
const price = (it, st) => `<span class="mc-price${st.fans < it.price ? " short" : ""}">${TK}${n(it.price)}</span>`;
const tag = (it, st) => it.kind === "gear" ? price(it, st)
  : (it.kind === "louie" ? st.louie : st.backdrop) === it.id ? `<span class="mc-on">ON</span>`
  : st.has.has(it.id) ? `<span class="mc-on own">YOURS</span>` : price(it, st);

export function renderMerch() {
  const st = merchState(data);
  const of = k => MERCH.filter(x => x.kind === k);
  const gear = it => `<button class="mc-gear" data-id="${it.id}" aria-label="${esc(it.name)}: ${esc(it.line)}. ${it.price} fans${st.own[it.id] ? `. You have ${st.own[it.id]}` : ""}">
      ${st.own[it.id] ? `<span class="mc-have">x${st.own[it.id]}</span>` : ""}${GEAR[it.id]}<b>${esc(it.name)}</b><small>${esc(it.line)}</small>${tag(it, st)}</button>`;
  const fin = it => `<button class="mc-fin${st.louie === it.id ? " on" : ""}" data-id="${it.id}" aria-label="${esc(it.name)} Louie">${lou(it.id, 54)}<b>${esc(it.name)}</b>${tag(it, st)}</button>`;
  const drop = it => `<button class="mc-drop${st.backdrop === it.id ? " on" : ""}" data-id="${it.id}" aria-label="${esc(it.name)} backdrop">${artSVG(it.id, "mc-art")}<b>${esc(it.name)}</b>${tag(it, st)}</button>`;
  app.innerHTML = `<div class="mc">
    <div class="mc-head"><button class="mc-back" id="mc-back" aria-label="Back">&lsaquo;</button><h1>Merch table</h1><span class="mc-fans" aria-label="${n(st.fans)} fans to spend">${TK}${n(st.fans)}</span></div>
    <div class="mc-table" aria-hidden="true">
      <svg class="mc-line" viewBox="0 0 390 70" preserveAspectRatio="none"><path d="M10 10 Q195 50 380 10" fill="none" stroke="currentColor" stroke-width="2"/>${[[60, "#FF3D7F", -4], [130, "#FF8A00", -3], [262, "#3A86FF", 3], [332, "#0FB5A6", 4]].map(([x, c, r]) => { const y = 10 + 40 * (1 - ((x - 195) / 185) ** 2) / 1.2; return `<g transform="translate(${x} ${y - 2}) rotate(${r})"><path d="M-16 3l7-5h5a4 4 0 0 0 8 0h5l7 5-4 7-5-2v19h-22V8l-5 2z" fill="${c}"/></g>`; }).join("")}</svg>
      <div class="mc-lou">${lou(st.louie, 84, "happy", "wave")}</div>
      <div class="mc-cloth"><i></i></div>
      <p class="mc-say">${st.fans >= 100 ? "Sold out show, sold out shirts. What are we getting?" : "Play a few shows and come back. The fans pay for all of this."}</p>
    </div>
    <h2 class="mc-h"><span>Gear</span><small>used up when you use it</small></h2>
    <div class="mc-row three">${of("gear").map(gear).join("")}</div>
    <h2 class="mc-h"><span>Louie's finish</span><small>yours to keep</small></h2>
    <div class="mc-row scroll">${of("louie").map(fin).join("")}</div>
    <h2 class="mc-h"><span>Stage backdrops</span><small>behind every gig</small></h2>
    <div class="mc-row scroll">${of("backdrop").map(drop).join("")}</div>
    <p class="mc-note">Fans come from every play, lesson, gig and quest. Spending them doesn't touch your XP or your chart spot.</p>
  </div>`;
  document.getElementById("mc-back").onclick = () => history.length > 1 ? history.back() : go("#/");
  app.querySelectorAll(".mc [data-id]").forEach(b => b.onclick = () => tryOn(b.dataset.id));
}

/* Try it on: the item big on a stage, flip through its kind, buy or put it on at the bottom (thumb reach) */
function tryOn(id) {
  const it = MERCH.find(x => x.id === id);
  if (!it) return;
  const st = merchState(data), kin = MERCH.filter(x => x.kind === it.kind), i = kin.indexOf(it);
  const worn = it.kind === "louie" ? st.louie : it.kind === "backdrop" ? st.backdrop : null;
  const have = it.kind !== "gear" && st.has.has(it.id), full = it.kind === "gear" && st.own[it.id] + (it.adds || 1) > it.max;
  const short = it.price - st.fans;
  const stage = it.kind === "louie" ? lou(it.id, 190, "cheer", "wave")
    : it.kind === "backdrop" ? lou(st.louie, 150, "happy", "hornsUp")
    : `<div class="mt-gear">${GEAR[it.id]}</div>`;
  const act = it.kind !== "gear" && have
    ? worn === it.id ? `<button class="btn" disabled>ON NOW</button>` : `<button class="btn primary" id="mt-wear">PUT IT ON</button>`
    : full ? `<button class="btn" disabled>YOU HAVE THE MOST YOU CAN HOLD</button>`
    : short > 0 ? `<button class="btn" disabled>${n(short)} MORE FANS TO GO</button>`
    : `<button class="btn primary" id="mt-buy">BUY FOR ${n(it.price)} FANS</button>`;
  layer.innerHTML = `<div class="mt" role="dialog" aria-label="${esc(it.name)}">
    <div class="mt-stage" data-kind="${it.kind}">${artSVG(it.kind === "backdrop" ? it.id : st.backdrop === "basement" ? "stars" : st.backdrop, "mt-art")}
      <div class="mt-top"><button class="mt-x" id="mt-x" aria-label="Close">&times;</button><span class="mc-fans">${TK}${n(st.fans)}</span></div>
      <div class="mt-name"><small>${it.kind === "gear" ? "GEAR" : "TRY IT ON"}</small><b>${esc(it.name)}</b></div>
      <div class="mt-show">${kin.length > 1 ? `<button class="mt-arr" id="mt-prev" aria-label="Previous">&lsaquo;</button>` : ""}<div class="mt-it">${stage}</div>${kin.length > 1 ? `<button class="mt-arr" id="mt-next" aria-label="Next">&rsaquo;</button>` : ""}</div>
      <div class="mt-dots" aria-hidden="true">${kin.map((x, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div>
    </div>
    <div class="mt-sheet">
      <h2>${esc(it.kind === "louie" ? `${it.name} Louie` : it.name)}</h2>
      <p>${esc(it.line)}${it.kind === "louie" ? " He wears it on the Road, in every gig and on Show complete, in all three looks." : it.kind === "backdrop" ? " It hangs behind the top of every gig." : ""}${it.kind === "gear" && st.own[it.id] ? ` You have ${st.own[it.id]}.` : ""}</p>
      ${it.price && !have ? `<div class="mt-tiles"><div><small>COSTS</small><b>${TK}${n(it.price)}</b></div><div><small>YOU'LL HAVE</small><b>${TK}${n(Math.max(0, st.fans - it.price))}</b></div></div>` : ""}
      <div class="mt-acts">${act}<button class="mt-not" id="mt-not">Not now</button></div>
    </div></div>`;
  const close = () => { layer.innerHTML = ""; };
  const $ = x => document.getElementById(x);
  $("mt-x").onclick = close; $("mt-not").onclick = close;
  $("mt-prev")?.addEventListener("click", () => tryOn(kin[(i - 1 + kin.length) % kin.length].id));
  $("mt-next")?.addEventListener("click", () => tryOn(kin[(i + 1) % kin.length].id));
  $("mt-wear")?.addEventListener("click", () => { merchWear(data, it.id); Tabs.save(data); applyWear(); close(); renderMerch(); toast(it.kind === "louie" ? `Louie's in ${it.name} now` : `${it.name} is up behind your gigs`); });
  $("mt-buy")?.addEventListener("click", () => {
    const r = merchBuy(data, it.id);
    if (!r.ok) return toast(r.why === "fans" ? "Not enough fans yet" : "You can't hold any more");
    Tabs.save(data); applyWear(); close(); renderMerch();
    toast(it.id === "rain" ? "Rain check in your pocket. It's used on its own if you miss a night."
      : it.id === "double" ? "Double set: your next 3 scored gigs earn 2x XP"
      : it.id === "take" ? "Second take ready. Use it on Charts when a rival battle goes the wrong way."
      : it.kind === "louie" ? `Louie's in ${it.name} now` : `${it.name} is up behind your gigs`);
  });
}
