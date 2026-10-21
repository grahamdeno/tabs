// Song duels (4.12.0): challenge a friend to beat your score on a song, by link.
//   sendChallenge(song, mine)  after a scored gig: "I hit 88% on River Road. Beat it." (the song rides along)
//   answerDuel(song, link)     a challenge link opened: add the song if needed, then play it as a gig
//   sendReply(duel)            after answering it: send your score back
//   renderDuel(id)             the head-to-head: both scores, your record against that friend, a rematch
// No server: the link carries the song and the score, and each phone keeps its own duels (data.duels).
import { Tabs, duelRecord, duelWon, findSame, friendsOf, shareable, startDuel, takeDuel, weekOf, weekXP } from "./core.js";
import { app, ask, esc, icon, layer } from "./ui.js";
import { data, go, playGig } from "./app.js";
import { duetSheet, shareLink } from "./share.js";
import { louie } from "./louie.js";

/* your name on your challenges, asked once */
function withName(then) {
  if (data.duels?.name) return then(data.duels.name);
  ask({ title: "Your name for duels", text: "Your friends see it on your challenges.", value: "", placeholder: "Your name", ok: "Save" }, v => {
    const name = String(v || "").trim().slice(0, 30);
    if (!name) return;
    (data.duels || (data.duels = { list: [] })).name = name; Tabs.save(data);
    then(name);
  });
}
const linkSong = song => shareable(song);
/* your XP this week rides along, for the Friends view and the Friend quest (4.13.0) */
const myWeek = () => ({ xp: weekXP(data), wk: weekOf() });

export function sendChallenge(song, mine, near) {
  withName(async name => {
    const d = startDuel(data, song, mine); Tabs.save(data);
    await shareLink({ song: linkSong(song), duel: { id: d.id, from: name, ...mine, ...myWeek() } }, `I hit ${mine.pct}% on ${song.title}. Beat it. (The Road)`, near);
  });
}
export function sendReply(d, near) {
  const song = data.songs.find(s => s.id === d.songId);
  if (!song || !d.mine) return;
  withName(async name => {
    const won = duelWon(d);
    await shareLink({ song: linkSong(song), duel: { id: d.id, from: name, ...d.mine, ...myWeek(), reply: true } }, `${won ? "Beat you" : won === false ? "You win this one" : "Tied"}: ${d.mine.pct}% on ${song.title}. (The Road)`, near);
  });
}
/* a duel link opened (from renderImport) */
export function openDuelLink(got) {
  const link = got.duel;
  if (link.reply) {
    const d = takeDuel(data, link, null);
    if (!d) return false;
    Tabs.save(data);
    go("#/duel/" + d.id);
    return true;
  }
  const have = findSame(data, got.song);
  layer.innerHTML = `<div class="scrim" id="dl-scrim"></div>
    <div class="panel card dl-card" role="dialog" aria-label="Song duel">
      <div class="pc-head">${icon("pick")}<span>Song duel</span></div>
      <p class="dl-t"><b>${esc(link.from)}</b> hit <b>${link.pct}%</b> on ${esc(got.song.title)}. Beat it.</p>
      <p class="foot pn">${have ? "It's in your Songbook." : "The song comes with the challenge and goes in your Songbook."} Play it as a gig with the microphone on; then send your score back.</p>
      <div class="actions"><button class="btn" id="dl-no">Not now</button><button class="btn primary" id="dl-yes">Take the stage</button></div>
    </div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("dl-scrim").onclick = close; document.getElementById("dl-no").onclick = close;
  document.getElementById("dl-yes").onclick = () => {
    close();
    const song = have || Tabs.addSong(data, got.song);
    takeDuel(data, link, song); Tabs.save(data);
    playGig(song.id);
  };
  return true;
}

/* the head-to-head */
export function renderDuel(id) {
  const d = data.duels?.list?.find(x => x.id === id);
  if (!d) return go("#/charts");
  const rec = duelRecord(data, d.opp), won = duelWon(d), song = data.songs.find(s => s.id === d.songId);
  const side = (who, sc, me) => `<div class="du-p">${me ? `<span class="du-av me">${louie(won === false ? "worried" : "happy", { size: 76 })}</span>` : `<span class="du-av">${esc((who || "?")[0].toUpperCase())}</span>`}
    <b>${esc(who || "Your friend")}</b><big class="${sc && (me ? won === true : won === false) ? "win" : ""}">${sc ? sc.pct + "%" : "…"}</big><small>${sc ? `combo ${sc.combo} · crowd ${sc.crowd}` : "hasn't played it yet"}</small></div>`;
  const head = won === true ? `You beat ${esc(d.opp)} on ${esc(d.title)}` : won === false ? `${esc(d.opp)} beat your ${esc(d.title)}` : won === null ? `A tie on ${esc(d.title)}` : d.started === "me" ? `Waiting for ${esc(d.opp || "your friend")}` : `${esc(d.opp)} challenged you`;
  app.innerHTML = `<div class="du">
    <button class="sh-btn du-x" id="du-x" aria-label="Back">${icon("back")}</button>
    <small class="du-h">SONG DUEL${d.opp ? ` · ${esc(d.opp.toUpperCase())} VS YOU` : ""}</small>
    <h1>${head}</h1>
    <div class="du-vs">${side(d.opp, d.theirs, false)}<span class="du-v">VS</span>${side("You", d.mine, true)}</div>
    ${d.opp && rec.w + rec.l ? `<section class="du-rec"><small>YOU AND ${esc(d.opp.toUpperCase())}</small>
      <div class="du-bar"><b>${rec.w}</b><span><i style="width:${Math.round(100 * rec.w / Math.max(1, rec.w + rec.l))}%"></i></span><b>${rec.l}</b></div>
      <div class="du-lab"><span>Your wins</span><span>${esc(d.opp)}'s wins</span></div>
      <p>Last ${rec.last.length}: ${rec.last.map(x => `<b class="${x ? "w" : x === false ? "l" : ""}">${x ? "W" : x === false ? "L" : "T"}</b>`).join(" ")}</p></section>` : ""}
    <div class="du-acts">
      ${song && won === false ? `<button class="btn primary" id="du-again">TAKE IT BACK · PLAY ${esc(song.title.toUpperCase())}</button>` : ""}
      ${song && d.started === "them" && d.mine ? `<button class="btn ${won === false ? "" : "primary"}" id="du-reply">SEND YOUR SCORE BACK</button>` : ""}
      ${song && d.started === "them" && !d.mine ? `<button class="btn primary" id="du-play">TAKE THE STAGE · BEAT ${d.theirs?.pct}%</button>` : ""}
      ${song && d.opp ? `<button class="btn" id="du-together">${icon("pick")}PLAY ${esc(song.title.toUpperCase())} TOGETHER</button>` : ""}
      <button class="btn" id="du-charts">BACK TO CHARTS</button>
    </div>
  </div>`;
  document.getElementById("du-x").onclick = () => go("#/charts");
  document.getElementById("du-charts").onclick = () => go("#/charts");
  document.getElementById("du-again")?.addEventListener("click", () => playGig(song.id));
  document.getElementById("du-play")?.addEventListener("click", () => playGig(song.id));
  document.getElementById("du-reply")?.addEventListener("click", e => sendReply(d, e.currentTarget));
  document.getElementById("du-together")?.addEventListener("click", () => duetSheet(song)); /* Play together, with this friend, on this song */
}

/* Charts: the duels list */
export function duelsHTML() {
  const list = (data.duels?.list || []).slice(0, 5);
  if (!list.length) return `<h2 class="tq-h"><span>SONG DUELS</span></h2><p class="ch-how" style="margin-top:0">After a scored gig, challenge a friend to beat your score. They get the song in the link.</p>`;
  return `<h2 class="tq-h"><span>SONG DUELS</span></h2><div class="du-list">${list.map(d => {
    const won = duelWon(d);
    const st = won === true ? "You won" : won === false ? `${esc(d.opp)} won` : won === null ? "Tied" : d.started === "me" ? "Waiting for a reply" : d.mine ? "Send your score back" : "Your turn";
    return `<button class="du-row" data-duel="${esc(d.id)}"><span class="du-av sm">${esc((d.opp || "?")[0].toUpperCase())}</span><span class="du-rt"><b>${esc(d.opp || "Sent")} · ${esc(d.title)}</b><small class="${won === true ? "w" : won === false ? "l" : ""}">${st}${d.mine ? ` · you ${d.mine.pct}%` : ""}${d.theirs ? ` · ${esc(d.opp)} ${d.theirs.pct}%` : ""}</small></span>${icon("chev", "chev")}</button>`;
  }).join("")}</div>`;
}

/* Charts, Friends: everyone you've dueled, by XP this week (as of their last link), with you among them */
export function friendsHTML() {
  const fr = friendsOf(data), mine = weekXP(data);
  if (!fr.length) return `<section class="fr-empty">${louie("happy", { pose: "point", size: 84 })}<p><b>No friends here yet.</b> Challenge someone after a gig: everyone you duel shows up here, with your record against them and their XP this week.</p></section>`;
  const rows = [...fr.map(f => ({ ...f })), { name: "You", xp: mine, you: true }].sort((a, b) => b.xp - a.xp || (a.you ? -1 : 1));
  const ago = t => { const d = Math.floor((Date.now() - t) / 86400000); return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`; };
  return `<ol class="ch-list fr-list">${rows.map((f, i) => `<li><button class="ch-row fr-row${f.you ? " you" : ""}" ${f.you ? "disabled" : `data-friend="${esc(f.name)}"`}>
      <span class="ch-rk">${i + 1}</span><span class="ch-av" style="background:${f.you ? "var(--fg)" : "var(--streak)"}">${f.you ? louie("happy", { size: 34 }) : esc(f.name[0].toUpperCase())}</span>
      <span class="ch-nm">${esc(f.name)}<small class="ch-note">${f.you ? "this week" : `${f.w}–${f.l} in duels · heard from ${ago(f.seen)}`}</small></span>
      <span class="ch-xp">${f.xp} XP</span></button></li>`).join("")}</ol>
    <p class="ch-how">A friend's XP updates whenever they send you a duel or a score. Tap a friend for your duels and Play together.</p>`;
}
export function friendLatest(name) { return (data.duels?.list || []).find(d => d.opp === name); }
