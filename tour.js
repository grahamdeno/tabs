// Tour quests (4.5.0): the Tour tab.
//   the month's tour   play 20 shows this month (any play counts); 100 fans when it's done
//   request line       a fan asks for one of your songs each day; played as a gig, its bonus fans double.
//                      With Apple Music on, it's the song you just played there (4.10.0)
//   cover quest        a song you listen to that isn't in your Songbook: get it, learn its chords, play it
//                      as a gig for 3x bonus fans (4.10.0)
//   duet quest         earn XP with a friend: waits until a friend's XP can reach your phone (Your band)
//   tonight's setlist  three small goals a day, 10 fans each and 25 more for all three
// The numbers are worked out in core.js (questState, questsSettle); fans are credited when you open the tab
// or finish a play.
import { QUEST, COVER_MULT, Tabs, questState, questsSettle, noteHeard, coverState, skillState } from "./core.js";
import { app, esc, icon, toast } from "./ui.js";
import { aiKey, data, go, openSearch, playGig } from "./app.js";
import { louie } from "./louie.js";
import { statBar, bindStatBar } from "./hud.js";

const CHECK = `<svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-label="Done"><circle class="tq-ckd" cx="16" cy="17" r="14"/><circle class="tq-ck" cx="16" cy="15" r="14"/><path d="M10 15l4 4 8-8" stroke="#14213D" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const BOX = label => `<svg width="34" height="30" viewBox="0 0 34 30" role="img" aria-label="${esc(label)}"><rect class="tq-bxd" x="3" y="12" width="28" height="17" rx="3"/><rect class="tq-bx" x="3" y="10" width="28" height="17" rx="3"/><rect class="tq-lid" x="2" y="5" width="30" height="8" rx="3"/><rect class="tq-rib" x="14" y="5" width="6" height="22"/></svg>`;
const PHONE = `<svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle class="tq-phd" cx="20" cy="21" r="17"/><circle cx="20" cy="19" r="17" fill="#fff"/><path class="tq-ph" d="M13 13c0-2 2-3 4-2l2 4-2 2c1 3 3 5 6 6l2-2 4 2c1 2 0 4-2 4-8 0-14-6-14-14z"/></svg>`;

const bar = (have, need, cls = "") => `<div class="tq-bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${need}" aria-valuenow="${have}"><i style="width:${Math.round(100 * have / need)}%"></i></div>`;

/* Apple Music on: the latest track you played becomes the request, or a cover quest (once a visit) */
let heardAsked = 0;
function listenFor() {
  if (!data.settings.appleMusic || Date.now() - heardAsked < 60000) return;
  heardAsked = Date.now();
  import("./listen.js").then(m => m.recentApple()).then(rows => {
    if (rows?.[0] && noteHeard(data, rows[0])) { Tabs.save(data); if (location.hash === "#/tour") renderTour(); }
  }).catch(() => {});
}
const ART = c => /^https:\/\//.test(c?.art || "") ? `<img src="${esc(c.art)}" alt="">` : icon("note");

export function renderTour() {
  listenFor();
  const earned = questsSettle(data);
  if (earned.length) { Tabs.save(data); setTimeout(() => toast(earned.map(x => `${x.label}: +${x.fans} fans`).join(" · ")), 300); }
  const st = questState(data), hrs = Math.max(1, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 3600e3));
  const t = st.tour, r = st.request, heard = r && data.quests?.heard?.day === st.today && data.quests.heard.id === r.song.id, cv = coverState(data);
  app.innerHTML = `
    <div class="tq">
      <div class="tq-top">${statBar()}</div>
      <section class="tq-head" aria-label="${esc(st.monthName)} Tour">
        <div class="tq-ht"><h1>${esc(st.monthName)} Tour</h1><small>${st.daysLeft ? `${st.daysLeft} DAY${st.daysLeft === 1 ? "" : "S"} LEFT` : "LAST DAY"}</small></div>
        <div class="tq-louie">${louie(t.done ? "cheer" : "happy", { pose: t.done ? "hornsUp" : "wave", size: 104 })}</div>
        <div class="tq-goal">
          <b>${t.done ? "Tour complete!" : `Play ${t.need} shows`}</b>
          <div class="tq-big">${bar(t.shows, t.need)}<span>${t.shows} / ${t.need}</span></div>
          <small>${t.done ? `+${QUEST.tourFans} fans earned` : `Every song you play through counts. ${QUEST.tourFans} fans when it's done`}</small>
        </div>
      </section>
      ${r ? `<section class="tq-req${r.done ? " done" : ""}" aria-label="Request line">
        ${PHONE}
        <div class="tq-rt"><small>REQUEST LINE${heard ? " · FROM YOUR LISTENING" : ""}</small><p>${r.done ? `You played ${esc(r.song.title)} for them. A new request comes tomorrow.` : heard ? `<b>${esc(r.song.title)}</b>: you just played it in Apple Music. A fan wants it too. 2x bonus fans tonight.` : `A fan asked for <b>${esc(r.song.title)}</b>. 2x bonus fans tonight.`}</p></div>
        ${r.done ? CHECK : `<button class="tq-play" id="tq-play" aria-label="Play ${esc(r.song.title)} as a gig">PLAY</button>`}
      </section>` : `<section class="tq-req empty"><div class="tq-rt"><small>REQUEST LINE</small><p>Add a chord song and your fans will start asking for it.</p></div></section>`}
      ${cv ? `<section class="tq-cover" aria-label="Cover quest">
        <small>COVER QUEST</small>
        <div class="tq-cvt"><span class="tq-art">${ART(cv)}</span><p><b>${esc(cv.title)}</b>${cv.artist ? ` · ${esc(cv.artist)}` : ""}<br>You've been listening to it. Learn it and your first gig of it pays ${COVER_MULT}x fans.</p></div>
        <div class="tq-steps">${[["Get the song", 1], [cv.missing.length ? `Learn ${cv.missing.slice(0, 2).join(" and ")}` : "Learn the chords", 2], ["Play the gig", 3]].map(([t, n]) => `<span class="${cv.step > n ? "done" : cv.step === n ? "now" : ""}">${n} · ${esc(t)}</span>`).join("")}</div>
        <button class="btn primary" id="tq-cover">${cv.step === 1 ? "GET THE SONG" : cv.step === 2 ? `LEARN ${esc(cv.missing[0])}` : `PLAY THE GIG · ${COVER_MULT}X FANS`}</button>
      </section>` : ""}
      <h2 class="tq-h"><span>TONIGHT'S SETLIST</span><span class="tq-hrs">${hrs} HR${hrs === 1 ? "" : "S"}</span></h2>
      <section class="tq-card" aria-label="Tonight's setlist">
        ${st.goals.map(g => `<div class="tq-row${g.done ? " done" : ""}"><div class="tq-rg"><b>${esc(g.label)}</b>${bar(g.have, g.need, g.done ? "full" : "")}<small>${g.have} / ${g.need}${g.done ? "" : ` · ${QUEST.goalFans} fans`}</small></div>${g.done ? CHECK : BOX(`${QUEST.goalFans} fans`)}</div>`).join("")}
        <p class="tq-foot">${st.setDone ? `All three done: +${QUEST.setFans} fans. New goals tomorrow.` : `All three: ${QUEST.setFans} more fans.`}</p>
      </section>
      <h2 class="tq-h"><span>DUET QUEST</span><span>LATER</span></h2>
      <section class="tq-card tq-lock" aria-label="Duet quest">
        <div class="tq-row"><div class="tq-rg"><b>Earn XP together</b><small>Play together with a friend toward one XP goal. It needs your friend's XP on your phone, which comes with Your band.</small></div>${BOX("A merch box")}</div>
      </section>
    </div>`;
  bindStatBar();
  document.getElementById("tq-play")?.addEventListener("click", () => playGig(r.song.id, { from: "tour" }));
  document.getElementById("tq-cover")?.addEventListener("click", () => {
    if (cv.step === 3) return playGig(cv.song.id, { from: "tour" });
    if (cv.step === 2) {
      const lesson = skillState(data).levels.flatMap(l => l.steps).find(x => x.kind === "chord" && x.chord === cv.missing[0] && x.state !== "locked");
      return go(lesson ? "#/practice/" + encodeURIComponent(lesson.id) : "#/song/" + encodeURIComponent(cv.song.id));
    }
    const q = `${cv.title} ${cv.artist}`.trim();
    if (aiKey()) return import("./findai.js").then(m => m.getSong(q, { title: cv.title, artist: cv.artist }));
    openSearch(); setTimeout(() => { const i = document.getElementById("q"); if (i) { i.value = q; i.dispatchEvent(new Event("input")); } }, 400);
  });
  if (!data.songs.length) document.querySelector(".tq-req.empty")?.addEventListener("click", () => go("#/library"));
}
