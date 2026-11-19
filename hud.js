// The game's chrome (4.0.0): the stat bar at the top of the Road, the tab bar along the bottom of
// the main pages, the More sheet, and the pages still to come (Tour, Charts, Band).
//   statBar()        the venue, the gig streak, your fans and your tips (4.70.0), as buttons (bindStatBar wires them)
//   settleStats()    Rain checks and fading fans, settled before any stats show; statNotices() says what happened
//   paintTabs(name)  shows the tab bar with one tab current; hideTabs() takes it away
//   (Road Ready 04: five tabs, Road, Songbook, Rehearse, Tour and Me; the places that were on the More sheet are rows on Me)
//   openMore()       a sheet of the places that aren't tabs, the most used nearest the thumb (4.16.0): Settings at the top, Songbook at the bottom; the Merch table opens from the tips in the stat bar (4.16.2)
import { Tabs, fameSettle, fansNow, openingOn, playSongs, rainSettle, streakOf, tipsOf, venueNow } from "./core.js";
import { esc, icon, layer, toast } from "./ui.js";
import { data, go, openTuner, route, tunedRecently } from "./app.js";
import { guitarIcon, buzz } from "./rock.js";

const n = x => x.toLocaleString("en-US");

/* ---- the stat bar ---- */
const BADGE = `<svg width="28" height="30" viewBox="0 0 30 32" aria-hidden="true"><path class="h-vbd" d="M15 2l12 6v10c0 7-6 11-12 13C9 29 3 25 3 18V8z"/><path class="h-vb" d="M15 1l11 5v10c0 7-5 11-11 13C9 27 4 23 4 16V6z"/><circle cx="15" cy="15" r="5" fill="#fff"/><path d="M8 8l5-2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/></svg>`;
const TICKET = `<svg width="32" height="26" viewBox="0 0 34 28" aria-hidden="true"><path class="h-tkd" d="M3 6h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/><path class="h-tk" d="M3 4h28v6a4 4 0 0 0 0 8v6H3v-6a4 4 0 0 0 0-8z"/><path class="h-tkd" d="M20 6h2v2h-2zM20 11h2v2h-2zM20 16h2v2h-2z"/><path d="M8 8h6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/></svg>`;
let rained = [], fame = [];
/* 4.70.0: tips, a coin with a dollar sign */
const COIN = `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><circle class="h-cd" cx="14" cy="15.5" r="11.5"/><circle class="h-c" cx="14" cy="13.5" r="11.5"/><path d="M17.5 9.5c-.8-1-2-1.5-3.5-1.5-2 0-3.3 1-3.3 2.5 0 3.5 7 1.8 7 5.5 0 1.6-1.5 2.6-3.6 2.6-1.6 0-3-.6-3.8-1.7M14 6v2M14 18.6v2" fill="none" stroke="#14213D" stroke-width="2" stroke-linecap="round"/></svg>`;
/* Before the stats are shown: Rain checks and fading fans are settled (statBar and the Road Ready header both call
   this), and statNotices() says what happened once the screen is up. */
export function settleStats() {
  /* 4.14.0: a Rain check covers the nights missed since your last play, before the streak is counted */
  const used = rainSettle(data);
  if (used.length) { Tabs.save(data); rained = used; }
  /* 4.70.0: fans fade on idle days, and a venue can be lost and won back */
  const said = fameSettle(data);
  if (said.length || data.fame) Tabs.save(data);
  if (said.length) fame = said;
}
export function statBar() {
  settleStats();
  const v = venueNow(data), st = streakOf(playSongs(data)), fans = fansNow(data), tips = tipsOf(data);
  /* 4.40.0: each one says what it is, with a ›, until you've tapped it once (not during Opening night) */
  const lab = (k, t) => openingOn(data) || data.settings.used?.["hud-" + k] ? "" : `<small class="h-lab" aria-hidden="true">${t}</small>`;
  return `<div class="hud" role="group" aria-label="Your stats">
    <button id="h-venue" aria-label="${esc(v.name)}, venue ${v.ring + 1}. Open the Tour Map">${BADGE}<span>${v.ring + 1}</span>${lab("venue", "VENUE")}</button>
    <button id="h-streak" class="h-streak${st.days ? "" : " off"}" aria-label="Gig streak ${st.days} day${st.days === 1 ? "" : "s"}${st.today ? ", played today" : ""}. Open your profile">${guitarIcon(st.today)}<span>${st.days}</span>${lab("streak", "STREAK")}</button>
    <button id="h-fans" class="h-fans" aria-label="${n(fans)} fans. Open your profile">${TICKET}<span>${n(fans)}</span>${lab("fans", "FANS")}</button>
    <button id="h-tips" class="h-tips" aria-label="${n(tips)} dollars in tips. Open the Merch table">${COIN}<span>$${n(tips)}</span>${lab("tips", "TIPS")}</button>
  </div>`;
}
/* ---- the one-row Road header (Grok, 2026-11-19): four stats, each a line icon then a number, spread across one 44 pt row with
   no labels, cards, pills or outlines. Streak and fans stay on the Road (Graham's call); songs you can play opens the Songbook;
   the venue is the sign at the start of the leg, which opens the Tour Map. Same ids as the stat bar, so bindStatBar wires them. ---- */
const LINE = body => `<svg class="rr-st-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const ST_ICON = {
  /* a guitar: the streak */
  streak: LINE(`<path d="M14.5 9.5l5-5M18 3l3 3"/><path d="M13.2 10.8c-1.6-1.6-4.3-1.1-5 .9-.3.8-1 1.3-1.9 1.4-2.4.3-3.5 3.3-1.8 5.1l1.2 1.2c1.8 1.8 4.8.6 5.1-1.8.1-.9.6-1.6 1.4-1.9 2-.7 2.5-3.4.9-5z"/><circle cx="10" cy="14" r="1.4"/>`),
  /* a music note: songs you can play */
  songs: LINE(`<path d="M9 18V5.5l10-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>`),
  /* a ticket: fans */
  fans: LINE(`<path d="M3 7.5h18v3a2 2 0 0 0 0 3v3H3v-3a2 2 0 0 0 0-3z"/><path d="M15 7.5v9" stroke-dasharray="1.6 2"/>`),
  /* a coin with a dollar sign: tips */
  tips: LINE(`<circle cx="12" cy="12" r="9"/><path d="M14.8 9.2c-.6-.8-1.6-1.2-2.8-1.2-1.6 0-2.7.8-2.7 2 0 2.8 5.6 1.4 5.6 4.4 0 1.3-1.2 2.1-2.9 2.1-1.3 0-2.4-.5-3-1.4M12 6.5v1.5M12 16.5V18"/>`)
};
export function rrStats() {
  settleStats();
  const st = streakOf(playSongs(data)), fans = fansNow(data), tips = tipsOf(data);
  return `<div class="hud rr-stats" role="group" aria-label="Your stats">
    <button id="h-streak" class="h-streak${st.days ? "" : " off"}" aria-label="Gig streak ${st.days} day${st.days === 1 ? "" : "s"}${st.today ? ", played today" : ""}. Show your streak">${ST_ICON.streak}<span>${st.days}</span></button>
    <button id="h-fans" class="h-fans" aria-label="${n(fans)} fans. Open the Tour Map">${ST_ICON.fans}<span>${n(fans)}</span></button>
    <button id="h-tips" class="h-tips" aria-label="${n(tips)} dollars in tips. Open the Merch table">${ST_ICON.tips}<span>$${n(tips)}</span></button>
  </div>`;
}
/* the stats at the top of Rehearse, Tour, Charts and Your band: the Road's one-row header in Dark and Light (design pass,
   2026-11-19), the labelled stat bar in Green Room and Headliner. bindStatBar binds either. */
export const pageStats = () => ["neon", "festival"].includes(document.documentElement.dataset.look) ? rrStats() : statBar();
export function bindStatBar() {
  const $ = id => document.getElementById(id);
  const learned = k => { if (data.settings.used?.["hud-" + k]) return; data.settings.used = { ...(data.settings.used || {}), ["hud-" + k]: true }; Tabs.save(data); };
  for (const k of ["venue", "streak", "fans", "tips"]) $("h-" + k)?.addEventListener("click", () => learned(k));
  $("h-venue")?.addEventListener("click", () => go("#/playmap"));
  /* 4.16.0: the guitar rocks and the phone taps before your profile opens */
  /* 4.16.0: the guitar rocks and the phone taps. In Dark and Light (Graham, 2026-11-19) the streak then shows a small card and
     fans open the Tour Map; neither opens your profile. Green Room and Headliner keep the profile. */
  const rr = $("h-streak")?.closest(".rr-stats");
  $("h-streak")?.addEventListener("click", e => { const b = e.currentTarget; buzz("rock"); b.classList.add("go"); setTimeout(() => { b.classList.remove("go"); rr ? streakCard() : go("#/you"); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 420); });
  $("h-fans")?.addEventListener("click", () => go(rr ? "#/playmap" : "#/you"));
  $("h-tips")?.addEventListener("click", () => go("#/merch"));
  statNotices();
}
export function statNotices() {
  if (fame.length) {
    const said = fame; fame = [];
    const line = x => x.kind === "fade" ? `${n(x.lost)} fans drifted away while you were off the road`
      : x.kind === "warn" ? `Your crowd is thinning at the ${x.venue}. Play tonight to keep it`
      : x.kind === "down" ? `Back to the ${x.venue}. Play ${3} shows there to win the ${x.from} back`
      : `You won the ${x.venue} back!`;
    said.forEach((x, i) => setTimeout(() => toast(line(x)), 700 + i * 2600));
  }
  if (rained.length) { const k = rained.length; rained = []; setTimeout(() => toast(`${k === 1 ? "A Rain check covered last night" : `${k} Rain checks covered the nights you missed`}. Your streak is safe.`), 600); }
}

/* ---- the tab bar ---- */
/* Road Ready 04: five tabs, our own line icons. 24 px grid shown at 28 px, a 1.9 stroke with round caps and joins, currentColor. The shapes
   marked tb-fill are tinted in when the tab is current (the icon sheet's "active = fill + amber"). No lamps, gauges or picks. */
/* The streak card: how many days in a row, the last seven days, and what keeps it going. */
function streakCard() {
  const st = streakOf(playSongs(data)), d = st.days;
  const days = ["S", "M", "T", "W", "T", "F", "S"], today = new Date().getDay();
  layer.innerHTML = `<div class="scrim" id="sk-scrim"></div><div class="panel card sk-card" role="dialog" aria-label="Your gig streak">
    <h2>${d ? `${d} day${d === 1 ? "" : "s"} in a row` : "No streak yet"}</h2>
    <p class="tm-line">${d ? (st.today ? "You played today, so your streak is safe." : "Play a song through today to keep it going.") : "Play a song through today to start one."}</p>
    <div class="sk-week" role="img" aria-label="The last seven days: ${st.week.filter(Boolean).length} played">${st.week.map((on, i) => `<span class="sk-day${on ? " on" : ""}${i === 6 ? " now" : ""}"><i></i>${days[(today + i + 1) % 7]}</span>`).join("")}</div>
    <div class="actions"><button class="btn primary" id="sk-x">Done</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("sk-scrim").onclick = close; document.getElementById("sk-x").onclick = close;
  document.getElementById("sk-x").focus();
}
const ICON = body => `<svg class="tb-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const TABS = [
  /* Road: a short fretboard (two frets) with a zigzag road joining three stops, as in the icon sheet's "Fretboard + stops" */
  ["road", "#/", "Road", ICON(`<path class="tb-fill" d="M7.5 2.5h9l1.5 19H6z"/><path d="M6.9 8.5h10.2M6.4 15h11.2"/><path d="M14.2 5.6L9.8 11.8l4.4 6.6"/><circle cx="14.2" cy="5.6" r="1.3" fill="currentColor" stroke="none"/><circle cx="9.8" cy="11.8" r="1.3" fill="currentColor" stroke="none"/><circle cx="14.2" cy="18.4" r="1.3" fill="currentColor" stroke="none"/>`)],
  /* Songbook: an open book with a music note on the right page */
  ["songbook", "#/library", "Songbook", ICON(`<path class="tb-fill" d="M12 6.6C9.8 5 6.8 4.6 3.4 5v13.2c3.4-.4 6.4 0 8.6 1.6 2.2-1.6 5.2-2 8.6-1.6V5c-3.4-.4-6.4 0-8.6 1.6z"/><path d="M12 6.6v13.2"/><circle cx="15.2" cy="14.2" r="1.5" fill="currentColor" stroke="none"/><path d="M16.7 14.2V9.2l2.3.7"/>`)],
  /* Rehearse: a metronome, a trapezoid body with the arm leaning */
  ["rehearse", "#/practice", "Rehearse", ICON(`<path class="tb-fill" d="M9 3h6l4 18H5z"/><path d="M12 17.5L15.2 7"/><circle cx="14" cy="11" r="1.3" fill="currentColor" stroke="none"/><path d="M8.2 21h7.6"/>`)],
  /* Tour: a tour van from the side, two wheels, an amp on the roof */
  ["tour", "#/tour", "Tour", ICON(`<path class="tb-fill" d="M2.5 17v-5.5L5 8h9.5l4.5 3.5h2.5V17h-2.4M14.9 17H9.1M4.9 17H2.5"/><path d="M8.5 4.5h5V8h-5zM9 8v3.5h10"/><circle cx="7" cy="17.5" r="2.1"/><circle cx="17" cy="17.5" r="2.1"/>`)],
  /* Me: a backstage pass hanging from a U-shaped lanyard */
  ["me", "#/you", "Me", ICON(`<path d="M6.5 2.5c0 3.5 1.6 5.2 5.5 5.2s5.5-1.7 5.5-5.2"/><rect class="tb-fill" x="6.5" y="8" width="11" height="13.5" rx="2.8"/><circle cx="12" cy="13" r="1.9"/><path d="M8.9 19.2c.4-2 1.7-3 3.1-3s2.7 1 3.1 3"/>`)]
];
function tabsEl() {
  let el = document.getElementById("tabs");
  if (!el) { el = document.createElement("nav"); el.id = "tabs"; el.setAttribute("aria-label", "Main"); document.body.appendChild(el); }
  return el;
}
export function paintTabs(active) {
  const el = tabsEl();
  /* no dot on a tab (Grok's design list, 2026-11-19: a notification-style dot reads as Duolingo); the Tuner row on Me shows when
     the tuner hasn't been used lately */
  el.innerHTML = TABS.map(([k, href, label, svg]) => `<a href="${href}" data-tab="${k}" aria-label="${esc(label)}"${k === active ? ' aria-current="page"' : ""}>${svg}<span class="tb-l">${esc(label)}</span></a>`).join("");
  document.body.classList.add("tabbed");
}
export function hideTabs() { document.body.classList.remove("tabbed"); }

/* ---- More ---- */
export function openMore() {
  const item = (id, ic, name, sub) => `<button id="${id}"><span class="more-ic">${icon(ic)}</span><span>${name}<small>${sub}</small></span></button>`;
  layer.innerHTML = `<div class="scrim" id="more-scrim"></div><div class="panel card" role="dialog" aria-label="More">
    <div class="more-list">
      ${item("m-set", "gear", "Settings", "Look, playing and keys")}
      ${item("m-tune", "fork", "Tuner", tunedRecently() ? "Tuned in the last few hours" : "Not tuned in the last few hours")}
      ${item("m-lib", "list", "Songbook", `${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, sets and search`)}
      ${item("m-sup", "heart", "Support Louie", "If you like the app, chip in on Ko-fi")}
    </div>
    <div class="actions"><button class="btn" id="more-x">Close</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  const $ = id => document.getElementById(id);
  $("more-scrim").onclick = close; $("more-x").onclick = close;
  $("m-lib").onclick = () => { close(); go("#/library"); };
  $("m-set").onclick = () => { close(); go("#/settings"); };
  $("m-sup").onclick = () => { close(); go("#/support"); };
  $("m-tune").onclick = () => { close(); openTuner("standard", () => { const r = route().name; if (TABBED.has(r)) paintTabs(tabFor(r)); }); };
}

/* which pages show the tab bar, and which tab each one lights. Songbook is a tab; Your band, Charts, the Merch table and Support are reached from Me, so Me stays lit on them. */
export const TABBED = new Set(["road", "library", "tour", "practice", "you", "charts", "band", "merch", "support"]);
export const tabFor = name => ({ library: "songbook", practice: "rehearse", you: "me", charts: "me", band: "me", merch: "me", support: "me" })[name] || name;
