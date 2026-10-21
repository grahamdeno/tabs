// The game's chrome (4.0.0): the stat bar at the top of the Road, the tab bar along the bottom of
// the main pages, the More sheet, and the pages still to come (Tour, Charts, Band).
//   statBar()        the venue, the gig streak and your fans, as buttons (bindStatBar wires them)
//   paintTabs(name)  shows the tab bar with one tab current; hideTabs() takes it away
//   openMore()       a sheet of the places that aren't tabs: Songbook, Tour Map, Your playing, Tuner, Settings
//   renderSoon(name) a page still to come (none now: Tour 4.5.0, Charts 4.6.0, Your band 4.7.0)
import { fansOf, lifetimePlays, playSongs, streakOf, venueOf } from "./core.js";
import { app, esc, icon, layer, toast } from "./ui.js";
import { data, go, openTuner, route, tunedRecently } from "./app.js";
import { louie } from "./louie.js";

const n = x => x.toLocaleString("en-US");

/* ---- the stat bar ---- */
const BADGE = `<svg width="28" height="30" viewBox="0 0 30 32" aria-hidden="true"><path class="h-vbd" d="M15 2l12 6v10c0 7-6 11-12 13C9 29 3 25 3 18V8z"/><path class="h-vb" d="M15 1l11 5v10c0 7-5 11-11 13C9 27 4 23 4 16V6z"/><circle cx="15" cy="15" r="5" fill="#fff"/><path d="M8 8l5-2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
const FLAME = `<svg width="26" height="30" viewBox="0 0 30 34" aria-hidden="true"><path class="h-fl1" d="M15 1c2 6 13 10 13 20a13 13 0 0 1-26 0c0-6 3-9 6-12 0 4 2 6 3 6 0-6-1-10 4-14z"/><path class="h-fl2" d="M15 7c2 5 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 2 4 0-4 0-7 3-11z"/><path d="M15 18c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z" fill="#fff"/></svg>`;
const TICKET = `<svg width="32" height="26" viewBox="0 0 34 28" aria-hidden="true"><path class="h-tkd" d="M3 6h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/><path class="h-tk" d="M3 4h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/><path class="h-tkd" d="M20 6h2v2h-2zM20 11h2v2h-2zM20 16h2v2h-2z"/><path d="M8 8h6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;
export function statBar() {
  const plays = lifetimePlays(data), v = venueOf(plays), st = streakOf(playSongs(data)), fans = fansOf(data);
  return `<div class="hud" role="group" aria-label="Your stats">
    <button id="h-venue" aria-label="${esc(v.name)}, venue ${v.ring + 1}. Open the Tour Map">${BADGE}<span>${v.ring + 1}</span></button>
    <button id="h-streak" class="h-streak${st.days ? "" : " off"}" aria-label="Gig streak ${st.days} day${st.days === 1 ? "" : "s"}${st.today ? ", played today" : ""}">${FLAME}<span>${st.days}</span></button>
    <button id="h-fans" class="h-fans" aria-label="${n(fans)} fans">${TICKET}<span>${n(fans)}</span></button>
  </div>`;
}
export function bindStatBar() {
  const $ = id => document.getElementById(id);
  $("h-venue")?.addEventListener("click", () => go("#/playmap"));
  $("h-streak")?.addEventListener("click", () => go("#/you"));
  $("h-fans")?.addEventListener("click", () => toast("Fans: 10 for every play, 5 for every lesson, 25 for every merch box, more from gigs and Tour quests"));
}

/* ---- the tab bar ---- */
const TABS = [
  ["road", "#/", "The Road", `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect class="tb-ink" x="14" y="12" width="4" height="18" rx="2" opacity=".35"/><path class="tb-ad" d="M5 7h18l5 5-5 5H5z"/><path class="tb-a" d="M5 5h18l5 5-5 5H5z"/><path d="M8 8h9" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></svg>`],
  ["tour", "#/tour", "Tour", `<svg width="34" height="32" viewBox="0 0 34 32" aria-hidden="true"><rect class="tb-sd" x="2" y="8" width="30" height="18" rx="5"/><rect class="tb-s" x="2" y="6" width="30" height="18" rx="5"/><rect class="tb-w" x="6" y="10" width="7" height="6" rx="2"/><rect class="tb-w" x="15" y="10" width="7" height="6" rx="2"/><rect class="tb-f" x="24" y="10" width="5" height="10" rx="2"/><circle class="tb-ink" cx="10" cy="26" r="4"/><circle class="tb-ink" cx="25" cy="26" r="4"/></svg>`],
  ["charts", "#/charts", "Charts", `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle class="tb-kk" cx="16" cy="18" r="13"/><circle class="tb-k" cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9" fill="none" stroke="#2A3A63" stroke-width="1.5"/><circle class="tb-a" cx="16" cy="16" r="5"/><circle class="tb-k" cx="16" cy="16" r="1.2"/><path d="M7 11a10 10 0 0 1 5-5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".4"/></svg>`],
  ["band", "#/band", "Your band", `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><rect class="tb-bd" x="4" y="11" width="24" height="16" rx="4"/><rect class="tb-b" x="4" y="10" width="20" height="16" rx="4"/><ellipse class="tb-w" cx="16" cy="10" rx="12" ry="5"/><path d="M20 2l-6 8" stroke="#F2B705" stroke-width="3" stroke-linecap="round"/></svg>`],
  ["rehearse", "#/practice", "Rehearse", `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><path class="tb-fd" d="M13 4h8l6 26H7z"/><path class="tb-f" d="M12 3h8l6 26H6z"/><path d="M16 24l7-15" stroke="#14213D" stroke-width="2.6" stroke-linecap="round"/><circle class="tb-k" cx="21" cy="13" r="2.6"/><path d="M12 6h3" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`],
  ["more", "", "More: Songbook, Tour Map, Your playing, Tuner, Settings", `<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle class="tb-bd" cx="16" cy="17" r="13"/><circle class="tb-b" cx="16" cy="16" r="13"/><circle class="tb-w" cx="10" cy="16" r="2.4"/><circle class="tb-w" cx="16" cy="16" r="2.4"/><circle class="tb-w" cx="22" cy="16" r="2.4"/></svg>`]
];
function tabsEl() {
  let el = document.getElementById("tabs");
  if (!el) { el = document.createElement("nav"); el.id = "tabs"; el.setAttribute("aria-label", "Main"); document.body.appendChild(el); }
  return el;
}
export function paintTabs(active) {
  const el = tabsEl();
  el.innerHTML = TABS.map(([k, href, label, svg]) => `<a ${href ? `href="${href}"` : 'href="#" role="button"'} data-tab="${k}" aria-label="${esc(label)}"${k === active ? ' aria-current="page"' : ""}>${svg}${k === "more" && !tunedRecently() ? '<i class="dotmark" aria-hidden="true"></i>' : ""}</a>`).join("");
  el.querySelector('[data-tab="more"]').onclick = e => { e.preventDefault(); openMore(); };
  document.body.classList.add("tabbed");
}
export function hideTabs() { document.body.classList.remove("tabbed"); }

/* ---- More ---- */
export function openMore() {
  const item = (id, ic, name, sub) => `<button id="${id}"><span class="more-ic">${icon(ic)}</span><span>${name}<small>${sub}</small></span></button>`;
  layer.innerHTML = `<div class="scrim" id="more-scrim"></div><div class="panel card" role="dialog" aria-label="More">
    <div class="more-list">
      ${item("m-lib", "list", "Songbook", `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, sets and search`)}
      ${item("m-map", "pick", "Tour Map", "Your turf and your scene")}
      ${item("m-you", "flame", "Your playing", "Hours, chords and your streak")}
      ${item("m-tune", "fork", "Tuner", tunedRecently() ? "Tuned in the last few hours" : "Not tuned in the last few hours")}
      ${item("m-set", "gear", "Settings", "Look, playing and keys")}
    </div>
    <div class="actions"><button class="btn" id="more-x">Close</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  const $ = id => document.getElementById(id);
  $("more-scrim").onclick = close; $("more-x").onclick = close;
  $("m-lib").onclick = () => { close(); go("#/library"); };
  $("m-map").onclick = () => { close(); go("#/playmap"); };
  $("m-you").onclick = () => { close(); go("#/you"); };
  $("m-set").onclick = () => { close(); go("#/settings"); };
  $("m-tune").onclick = () => { close(); openTuner("standard", () => { const r = route().name; if (TABBED.has(r)) paintTabs(tabFor(r)); }); };
}

/* which pages show the tab bar, and which tab each one lights */
export const TABBED = new Set(["road", "tour", "charts", "band", "practice", "you"]);
export const tabFor = name => ({ practice: "rehearse", you: "more" })[name] || name;

/* ---- the pages still to come ---- */
const SOON = {
};
export function renderSoon(name) {
  const p = SOON[name];
  if (!p) return go("#/");
  app.innerHTML = `<div class="head"><h1 class="title script">${esc(p.title)}</h1></div>
    <div class="soon">${louie("happy", { pose: "point", size: 170 })}
      <h2>Coming soon</h2>
      <p>${esc(p.line)}</p>
      <ul>${p.items.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <span class="soon-tag">Coming in a 4.x release</span>
    </div>`;
}
