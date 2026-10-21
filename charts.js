// Charts (4.6.0): the Charts tab.
//   the chart        this week's chart at your tier (the venues, Garage up): you and nine players, by XP.
//                    The top 5 move up a tier on Monday and keep that tier's record; the bottom 3 move
//                    down (not below the Garage). The players play like people (chartRivals in core.js):
//                    each row says what they've done today, or that they've gone quiet.
//   rival battle     once a day, the player just above you: the same song, best score wins. Played as a
//                    scored gig; win and you take 30 XP and 40 fans.
//   records          one for each week you finished in the top 5
// The numbers are worked out in core.js (chartState, chartsSettle, battleFor, XP).
import { CHART_PROMOTE, CHART_DEMOTE, VENUES, XP, Tabs, battleFor, chartState, chartsSettle, startBattle } from "./core.js";
import { app, esc, toast } from "./ui.js";
import { data, go, playGig } from "./app.js";
import { louie } from "./louie.js";
import { statBar, bindStatBar } from "./hud.js";

const AV = ["var(--accent)", "var(--strings)", "var(--fans)", "var(--streak)", "var(--good)"];
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
const RECORD = (tier, rank) => `<svg width="38" height="38" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21" r="18" class="ch-vd"/><circle cx="20" cy="19" r="18" class="ch-v"/><circle cx="20" cy="19" r="12" fill="none" stroke="#2A3A63" stroke-width="1.4"/><circle cx="20" cy="19" r="6.5" class="${rank === 1 ? "ch-gold" : "ch-lab"}"/><circle cx="20" cy="19" r="1.6" class="ch-v"/><path d="M8 13a14 14 0 0 1 6-6" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".4"/><title>${esc(VENUES[tier] || "")} record, ${ord(rank)}</title></svg>`;

let pane = "league"; /* League | Friends (4.13.0) */
export function renderCharts(view = "chart") {
  const moved = chartsSettle(data);
  if (moved) Tabs.save(data);
  const st = chartState(data);
  if (view === "battle") return renderBattle(st);
  const b = st.battle || battleFor(data), song = b && data.songs.find(s => s.id === b.songId);
  const row = x => `<li class="ch-row${x.you ? " you" : ""}${x.rank <= CHART_PROMOTE ? " up" : ""}">
      <span class="ch-rk">${x.rank}</span>
      <span class="ch-av" style="background:${x.you ? "var(--fg)" : AV[x.name.length % AV.length]}">${x.you ? louie("happy", { size: 34 }) : esc(x.name[0])}</span>
      <span class="ch-nm">${esc(x.name)}<small class="ch-note${x.today > 0 ? " hot" : ""}">${x.today > 0 ? `+${x.today} today${x.kind === "weekend" && new Date().getDay() % 6 === 0 ? ", on a weekend run" : x.kind === "shadow" && !x.you ? ", right ahead of you" : ""}` : x.you ? "nothing yet today" : x.quiet ? "quiet for a couple of days" : "not yet today"}</small></span>
      ${st.rival && x.id === st.rival.id && !b?.result ? `<span class="ch-btl">BATTLE</span>` : ""}
      <span class="ch-xp">${x.xp} XP</span></li>`;
  const rows = st.rows.map(row);
  if (st.tier > 0) rows.splice(rows.length - CHART_DEMOTE, 0, `<li class="ch-zone down" aria-hidden="true"><span>MOVE DOWN ZONE</span></li>`);
  rows.splice(CHART_PROMOTE, 0, `<li class="ch-zone" aria-hidden="true"><span>${st.next ? "PROMOTION ZONE" : "TOP 5"}</span></li>`);
  const battleCard = !b ? "" : b.result
    ? `<section class="ch-go done"><p>${b.result === "won" ? `You beat ${esc(b.rival)} on ${esc(song?.title || "the song")}: ${b.pct}% to ${b.target}%. +${XP.battle} XP, +${XP.battleFans} fans.` : `${esc(b.rival)} held on: ${b.target}% to your ${b.pct}%. A new battle tomorrow.`}</p></section>`
    : `<section class="ch-go"><p>${st.you.rank === 1 ? `<b>${esc(b.rival)}</b> wants your spot. Win on ${esc(song?.title || "a song")} and take ${XP.battle} XP` : `Win the battle with <b>${esc(b.rival)}</b> on ${esc(song?.title || "a song")} and take ${XP.battle} XP`}</p><button class="ch-gobtn" id="ch-go">GO</button></section>`;
  app.innerHTML = `<div class="ch">
    <div class="tq-top">${statBar()}</div>
    ${st.last ? `<section class="ch-last"><p>${st.last.xp ? `Last week: <b>${ord(st.last.rank)}</b> on the ${esc(VENUES[st.last.tier])} chart${st.last.up ? `. Up to the <b>${esc(VENUES[st.last.tier + 1])}</b>!` : st.last.down ? `. Back down to the <b>${esc(VENUES[st.last.tier - 1])}</b>. Win it back this week.` : st.last.rank <= CHART_PROMOTE ? ". A record for the shelf." : ". Top 5 moves you up."}` : st.last.down ? `Last week went by without a play, so you're back at the <b>${esc(VENUES[st.last.tier - 1])}</b>.` : `Last week went by without a play. This week is a fresh chart.`}</p><button class="sb" id="ch-lastx" aria-label="Got it">OK</button></section>` : ""}
    <div class="seg ch-pane" role="group" aria-label="Charts">${[["league", "League"], ["friends", "Friends"]].map(([k, n]) => `<button data-pane="${k}" class="${pane === k ? "on" : ""}" aria-pressed="${pane === k}">${n}</button>`).join("")}</div>
    ${pane === "friends" ? `<div id="ch-friends"></div>` : `
    <section class="ch-head" aria-label="${esc(st.name)} chart">
      <div><h1>${esc(st.name)} Chart</h1><small>${st.daysLeft} DAY${st.daysLeft === 1 ? "" : "S"} LEFT</small></div>
      <div class="ch-recs" aria-label="${st.records.length} record${st.records.length === 1 ? "" : "s"}">${st.records.slice(-4).map(r => RECORD(r.tier, r.rank)).join("") || RECORD(st.tier, 9)}</div>
    </section>
    <p class="ch-sub">${st.next ? `Top ${CHART_PROMOTE} move up to the ${esc(st.next)}` : "The top of the charts. Stay in the top 5 for records"}${st.tier > 0 ? ` · bottom ${CHART_DEMOTE} move down` : ""}</p>
    <ol class="ch-list">${rows.join("")}</ol>
    ${battleCard}
    <div id="ch-duels"></div>
    `}
    <p class="ch-how">XP: ${XP.play} for a song played through, ${XP.landed} for each chord change landed in a gig, ${XP.crowd} for a crowd of 10, ${XP.goal} for a setlist goal, ${XP.battle} for a battle won.</p>
  </div>`;
  bindStatBar();
  document.getElementById("ch-go")?.addEventListener("click", () => renderCharts("battle"));
  app.querySelectorAll("[data-pane]").forEach(b => b.onclick = () => { pane = b.dataset.pane; renderCharts(); });
  /* Song duels (4.12.0) and Friends (4.13.0) */
  import("./duel.js").then(m => {
    const box = document.getElementById("ch-duels");
    if (box) { box.innerHTML = m.duelsHTML(); box.querySelectorAll("[data-duel]").forEach(b => b.onclick = () => go("#/duel/" + b.dataset.duel)); }
    const fb = document.getElementById("ch-friends");
    if (fb) { fb.innerHTML = m.friendsHTML(); fb.querySelectorAll("[data-friend]").forEach(b => b.onclick = () => { const d = m.friendLatest(b.dataset.friend); if (d) go("#/duel/" + d.id); }); }
  });
  document.getElementById("ch-lastx")?.addEventListener("click", () => { data.charts.last.seen = true; Tabs.save(data); renderCharts(); });
  document.querySelector(".ch-row.you")?.scrollIntoView({ block: "nearest" });
}

function renderBattle(st) {
  const b = battleFor(data), song = b && data.songs.find(s => s.id === b.songId);
  if (!b || !song) { toast("No battle today"); return renderCharts(); }
  const hrs = Math.max(1, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3600e3));
  const mine = data.gig?.best?.[song.id];
  app.innerHTML = `<div class="bt">
    <button class="sh-btn bt-x" id="bt-x" aria-label="Back to the chart"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
    <small class="bt-h">RIVAL BATTLE · ENDS IN ${hrs} H</small>
    <h1>${esc(b.rival)} wants your spot</h1>
    <p class="bt-s">Same song, best score wins. Pass ${esc(b.rival)} on the ${esc(st.name)} chart.</p>
    <div class="bt-vs">
      <div class="bt-p">${louie("cheer", { pose: "hornsUp", size: 110 })}<b>You</b><small>${mine != null ? `Best: ${mine}%` : "First time"}</small></div>
      <span class="bt-v">VS</span>
      <div class="bt-p"><span class="bt-av">${esc(b.rival[0])}</span><b>${esc(b.rival)}</b><small>Scored: ${b.target}%</small></div>
    </div>
    <div class="bt-song"><b>${esc(song.title)}</b><small>${esc(song.artist || "")}</small></div>
    <div class="bt-tiles"><div class="bt-t win"><small>WIN</small><b>+${XP.battle} XP, +${XP.battleFans} fans</b></div><div class="bt-t lose"><small>LOSE</small><b>${esc(b.rival)} stays ahead</b></div></div>
    <p class="bt-note">Land at least ${b.target}% of the chord changes. The microphone needs to hear you.</p>
    <div class="bt-acts"><button class="btn primary" id="bt-go">TAKE THE STAGE</button><button class="btn" id="bt-no">NOT TONIGHT</button></div>
  </div>`;
  document.getElementById("bt-x").onclick = document.getElementById("bt-no").onclick = () => renderCharts();
  document.getElementById("bt-go").onclick = () => { startBattle(data); Tabs.save(data); playGig(song.id, { from: "charts" }); };
}
