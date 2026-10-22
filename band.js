// Your band (4.7.0): the Band tab. Louie's friends join one at a time as you play songs through.
// Beat plays the drums and Bex the bass behind you in gigs once they've joined (Band plays in gigs);
// the others join the stage and cheer you on. The join order and when is BAND in core.js; the
// drawings are friends.js.
import { Tabs, bandMeet, bandState } from "./core.js";
import { app, esc, toast } from "./ui.js";
import { data } from "./app.js";
import { friend, FRIENDS } from "./friends.js";
import { louie } from "./louie.js";
import { statBar, bindStatBar } from "./hud.js";

const LINES = {
  lola: "Lola keeps the rhythm warm. She was your first fan.",
  tilly: "Tilly checks every string before the show.",
  beat: "Beat plays the drums in your gigs.",
  metro: "Metro never loses the beat, and never lets you lose it either.",
  bex: "Bex plays the bass in your gigs.",
  jax: "Jax looks grumpy. He's just concentrating.",
  milo: "Milo gets the crowd singing along.",
  pip: "Pip is small, but nobody strums without him.",
  key: "Key fills in the chords you leave open.",
  strap: "Strap holds the whole band together.",
  slide: "Slide is too cool to take his shades off.",
  shaker: "Shaker can't sit still.",
  pickup: "Pickup hears every note you play.",
  humb: "Humb keeps the noise down and the tone fat.",
  reverb: "Reverb makes a small room sound like an arena.",
  triangle: "Triangle waits all song for one perfect ding.",
  whammy: "Whammy bends the rules, and the notes.",
  looper: "Looper plays it again. And again.",
  clip: "Pick-Clip keeps a spare pick where you can reach it.",
  vial: "Vial glows warm before every show.",
  bottle: "Bottle-Slide plays the blues, one long note at a time.",
  gigbag: "Gig-Bag carries the whole show to the next town.",
  kazo: "Kazo hums along to every chorus.",
  tuk: "Tuk is small, with four strings and a big smile.",
  capo: "Capo moves any song to where your voice sits.",
  spool: "Spool always has a fresh string when one snaps.",
  peg: "Peg turns a little until everything sounds right."
};
const nameOf = id => FRIENDS.find(f => f.id === id)?.name || id;

export function renderBand() {
  const met = bandMeet(data);
  if (met.length) Tabs.save(data);
  const st = bandState(data), n = st.joined.length, plays = data.settings.bandPlays !== false;
  const part = m => m.plays === "drums" ? "DRUMS" : m.plays === "bass" ? "BASS" : "";
  app.innerHTML = `<div class="bd">
    <div class="tq-top">${statBar()}</div>
    <section class="bd-head" aria-label="Your band">
      <div><h1>Your band</h1><small>${n} OF ${st.members.length} JOINED</small></div>
      ${louie(n ? "cheer" : "happy", { pose: n ? "hornsUp" : "wave", size: 92 })}
    </section>
    ${st.next ? `<section class="bd-next" aria-label="Next to join">
      <div class="bd-sil">${friend(st.next.id, { size: 76 })}</div>
      <div class="bd-nt"><small>NEXT TO JOIN</small><p><b>${esc(nameOf(st.next.id))}</b> joins after ${st.next.more} more song${st.next.more === 1 ? "" : "s"} played through${st.next.plays ? `, and plays ${st.next.plays} in your gigs` : ""}.</p>
        <div class="tq-bar"><i style="width:${Math.round(100 * (1 - st.next.more / Math.max(1, st.next.at - (st.joined.at(-1)?.at || 0))))}%"></i></div></div>
    </section>` : `<section class="bd-next"><div class="bd-nt"><small>THE WHOLE BAND</small><p>Everyone's here. Play on!</p></div></section>`}
    ${st.joined.some(m => m.plays) ? `<div class="set bd-set"><span class="name">Band plays in gigs<small class="sub">${["beat", "bex"].filter(id => st.joined.some(m => m.id === id)).map(id => id === "beat" ? "Beat on drums" : "Bex on bass").join(", ")}, when a song isn't playing its recording</small></span><button class="toggle ${plays ? "on" : ""}" id="bd-plays" role="switch" aria-checked="${plays}" aria-label="Band plays in gigs"></button></div>` : ""}
    <h2 class="tq-h"><span>ON STAGE</span><span>${n}</span></h2>
    <div class="bd-grid">${st.members.map(m => m.joined
      ? `<button class="bd-card${met.some(x => x.id === m.id) ? " fresh" : ""}" data-id="${m.id}" aria-label="${esc(nameOf(m.id))}: ${esc(LINES[m.id] || "")}">${friend(m.id, { size: 92, mood: met.some(x => x.id === m.id) ? "cheer" : "happy" })}<b>${esc(nameOf(m.id))}</b>${part(m) ? `<small class="bd-part">${part(m)}</small>` : ""}</button>`
      : `<div class="bd-card locked" aria-label="Joins after ${m.at} song${m.at === 1 ? "" : "s"}"><div class="bd-sil">${friend(m.id, { size: 92 })}</div><b>?</b><small>${m.at} SONG${m.at === 1 ? "" : "S"}</small></div>`).join("")}</div>
  </div>`;
  bindStatBar();
  app.querySelectorAll(".bd-card[data-id]").forEach(b => b.onclick = () => toast(LINES[b.dataset.id] || nameOf(b.dataset.id), b));
  document.getElementById("bd-plays")?.addEventListener("click", () => { data.settings.bandPlays = !plays; Tabs.save(data); renderBand(); });
  if (met.length) setTimeout(() => toast(`${met.map(m => nameOf(m.id)).join(" and ")} joined your band!`), 300);
}
