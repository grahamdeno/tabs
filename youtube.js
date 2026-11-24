// Play along on YouTube (4.96.0, docs/YOUTUBE-PLAN.md): for anyone without Apple Music, Play starts the song's YouTube
// video and the page follows it, as it does with Apple Music. listen.js hands its calls here when the song has a video
// and Apple Music isn't playing it.
//
// YouTube's rules: the player is visible while it plays, at least 200 by 200 px, with nothing over it, and it never
// plays in the background (leaving the app pauses the song already). So it's a 200 px card in the top right, above the
// line you're on (in a Gig, under the crowd); it shows while the recording plays and steps away when paused.
// An ad can play first: until the video itself plays, the clock says "wait" (-1) and the page holds.
import { Tabs, cleanYt, ytAt, ytId, ytMatches, ytSong } from "./core.js";
import { $, esc, icon, layer, onLeave, toast } from "./ui.js";
import { data } from "./app.js";

const PLAYING = 1, PAUSED = 2;
let api = null, player = null, playerId = "", state = -1, want = false, wantAt = 0, hinted = 0, card = null, readyP = null, started = false, capTitle = "";
export const ytOn = song => data.settings.youtube !== false && !!song?.yt?.id;
export const ytActive = () => want && !!player;

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return api ||= new Promise((ok, no) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); ok(window.YT); };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => { api = null; no(new Error("YouTube didn't load")); };
    document.head.appendChild(s);
  });
}
/* the card: in the top right, above the line you're on; in a Gig, under the crowd */
function place() {
  if (!card) return;
  const fans = document.getElementById("gg-fans"), now = document.querySelector("#sheet > .st-now");
  /* clear of the line you're on: just above it; in a Gig that can cover the right end of the crowd, never the words */
  const line = now ? now.getBoundingClientRect().top : innerHeight * 0.4;
  const top = Math.max(fans ? 56 : 64, Math.min(fans ? fans.getBoundingClientRect().bottom + 8 : Infinity, line - (card.offsetHeight || 210) - 8));
  card.style.top = `${Math.round(top)}px`;
}
/* 4.96.1: an iPhone only lets a video start from a tap on the video itself (a tap on Play is in the app, not in
   YouTube's player), so until it has played once the card says so, under the video (nothing may cover it) */
function cap() {
  const c = card?.querySelector(".yt-cap"); if (!c) return;
  const tap = want && !started && state !== PLAYING;
  c.textContent = tap ? "Tap the video to start" : capTitle;
  card.classList.toggle("tap", tap);
}
function makeCard() {
  if (card) return;
  card = document.createElement("div");
  card.className = "yt-card"; card.id = "yt-card";
  card.setAttribute("aria-label", "YouTube video");
  card.innerHTML = `<div id="yt-frame"></div><p class="yt-cap"></p>`;
  document.body.appendChild(card);
}
function show(on) {
  if (on) makeCard();
  if (!card) return;
  cap();
  if (on) { place(); document.fonts?.ready?.then(() => { if (card?.classList.contains("on")) place(); }); }
  card.classList.toggle("on", on);
  document.body.classList.toggle("yt-on", on);
}
function ensure(song) {
  const y = song.yt;
  if (player && playerId === y.id) return readyP;
  capTitle = y.title || "YouTube"; cap();
  /* the same player for the next song, so a phone that has let it play once keeps letting it */
  if (player && typeof player.cueVideoById === "function" && readyP) {
    playerId = y.id; state = -1;
    try { player.cueVideoById(y.id); } catch { /* not ready */ }
    return readyP;
  }
  readyP = loadApi().then(YT => new Promise((ok, no) => {
    makeCard();
    const late = setTimeout(() => no(new Error("YouTube didn't answer")), 15000);
    try { player?.destroy?.(); } catch { /* already gone */ }
    if (!document.getElementById("yt-frame")) card.insertAdjacentHTML("afterbegin", '<div id="yt-frame"></div>');
    playerId = y.id; state = -1;
    player = new YT.Player("yt-frame", {
      host: "https://www.youtube-nocookie.com", videoId: y.id, width: 200, height: 200,
      playerVars: { playsinline: 1, rel: 0, controls: 1, fs: 0, origin: location.origin },
      events: { onReady: () => { clearTimeout(late); ok(player); }, onStateChange: e => { state = e.data; if (state === PLAYING) { hinted = 0; started = true; } cap(); }, onError: e => { clearTimeout(late); toast(e.data === 101 || e.data === 150 ? "That video can't be played inside other apps. Pick another in About this song." : "YouTube couldn't play that video."); ok(player); } }
    });
  }));
  readyP.catch(() => { readyP = null; player = null; playerId = ""; });
  return readyP;
}
export function ytPrepare(song) { if (ytOn(song)) ensure(song).catch(() => {}); }
/* `at`: where in the song to start, in seconds. Called from the Play tap where it can be, so the phone lets it play. */
export function ytStart(song, at = 0, rate = 1) {
  if (!ytOn(song)) return;
  want = true; wantAt = performance.now();
  show(true); /* at once, so there's a video to tap while YouTube gets ready */
  const go = p => {
    if (!want || playerId !== song.yt.id) return;
    show(true);
    try { p.seekTo(ytAt(song.yt, at), true); p.setPlaybackRate(Math.min(2, Math.max(0.25, rate || 1))); p.playVideo(); } catch { /* not ready */ }
  };
  if (player && playerId === song.yt.id && typeof player.playVideo === "function" && state !== -1) go(player);
  else ensure(song).then(go, () => { show(false); want = false; toast("YouTube didn't load. Check your connection, then press Play again."); });
}
/* where the song is, from the video: null when we're not playing it, -1 while waiting (an ad, buffering, not started) */
export function ytClock(song) {
  if (!want || !player || !ytOn(song) || playerId !== song.yt.id) return null;
  place(); /* the page moves on this same tick, and the card has to be above the line after that move */
  if (state === PLAYING) { const t = player.getCurrentTime?.(); return Number.isFinite(t) ? ytSong(song.yt, t) : -1; }
  if (performance.now() - wantAt > (started ? 3500 : 1500) && !hinted) { hinted = 1; toast(!started ? "Tap the video to start. Your phone only lets a video start from a tap on it, and the page waits for it." : state === PAUSED ? "The video is paused. Tap it to carry on." : "Waiting for YouTube. If it doesn't start, tap the video (an ad may be playing)."); }
  return -1;
}
export function ytSeek(song, sec) { if (player && ytOn(song) && playerId === song.yt.id) try { player.seekTo(ytAt(song.yt, sec), true); } catch { /* not ready */ } }
export function ytPause() { want = false; try { player?.pauseVideo?.(); } catch { /* not ready */ } show(false); }
export function ytRate(rate) { try { player?.setPlaybackRate?.(Math.min(2, Math.max(0.25, rate || 1))); return true; } catch { return false; } }
export const ytPlaying = song => ytOn(song) && playerId === song.yt.id && state === PLAYING;
onLeave(() => { ytPause(); });
/* scrollBy reports the new position before it returns, so the card clears the line on the same move */
addEventListener("scroll", () => { if (card?.classList.contains("on")) place(); }, { passive: true });
addEventListener("resize", place);

/* ---- About this song > YouTube video: find, pick or paste a song's video, and line it up ---- */
const mmss2 = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export function youtubeSheet(song, { length = 0, done = () => {} } = {}) {
  let found = null, err = "";
  const server = data.settings.youtubeServer || "";
  const close = () => { layer.innerHTML = ""; done(); };
  const save = y => { const c = cleanYt(y); if (c) song.yt = c; else delete song.yt; Tabs.save(data); };
  const paint = () => {
    const y = song.yt, same = y && ytMatches(y, length);
    layer.innerHTML = `<div class="scrim" id="yt-scrim"></div><div class="panel card ytsheet" role="dialog" aria-label="YouTube video">
      <div class="grab" aria-hidden="true"></div>
      <h2 class="yt-h">YouTube video</h2>
      <p class="yt-p">Without Apple Music, Play starts this video and the page follows it. The video shows while it plays.</p>
      ${y ? `<div class="yt-now"><span class="yt-ic">${icon("play")}</span><span class="yt-nt"><b>${esc(y.title || "Your video")}</b><small>${esc([y.channel, y.secs ? mmss2(y.secs) : ""].filter(Boolean).join(" · "))}</small></span><button class="tb" id="yt-remove">Remove</button></div>
        <div class="yt-line"><span>${same ? "Same length as the recording, so it lines up." : "Starts late by"}</span>${same && !y.start ? "" : `<div class="yt-step"><button class="ib" id="yt-minus" aria-label="Earlier">−</button><b id="yt-start">${(y.start || 0).toFixed(1)} s</b><button class="ib" id="yt-plus" aria-label="Later">+</button></div>`}</div>
        ${same && !y.start ? "" : `<p class="yt-p sm">If the singing comes in after the page, add a little; before it, take some off.</p>`}` : ""}
      <h3 class="yt-h3">${y ? "Pick another" : "Pick a video"}</h3>
      <div id="yt-found">${server ? (found ? (found.length ? found.map((v, i) => `<button class="yt-pick" data-i="${i}"><b>${esc(v.title)}</b><small>${esc(v.channel)}${v.secs ? ` · ${mmss2(v.secs)}` : ""}${ytMatches(v, length) ? " · same length as the recording" : ""}</small></button>`).join("") : `<p class="yt-p">Nothing found. Paste a link below.</p>`) : err ? `<p class="yt-p">${esc(err)}</p>` : `<p class="yt-p">Searching YouTube…</p>`) : `<button class="btn" id="yt-search">${icon("search")}Search on YouTube</button><p class="yt-p sm">Copy the video's link there (Share, Copy link), then paste it here.</p>`}</div>
      <label class="bt-f yt-paste"><span>Link</span><input id="yt-link" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Paste a YouTube link"></label>
      <div class="pfoot"><button class="btn primary" id="yt-use">Use this link</button><button class="btn" id="yt-done">Done</button></div></div>`;
    $("yt-scrim").onclick = close; $("yt-done").onclick = close;
    $("yt-remove")?.addEventListener("click", () => { save(null); paint(); });
    const nudge = d => { song.yt.start = Math.max(0, Math.min(600, Math.round(((song.yt.start || 0) + d) * 10) / 10)); save(song.yt); paint(); };
    $("yt-minus")?.addEventListener("click", () => nudge(-0.5)); $("yt-plus")?.addEventListener("click", () => nudge(0.5));
    $("yt-search")?.addEventListener("click", () => window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(`${song.artist || ""} ${song.title} audio`.trim())}`, "_blank", "noopener"));
    layer.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const v = found[+b.dataset.i]; save({ id: v.id, title: v.title, channel: v.channel, secs: v.secs }); paint(); toast("Video picked. Press Play to play along."); });
    $("yt-use").onclick = () => {
      const id = ytId($("yt-link").value);
      if (!id) { toast("That doesn't look like a YouTube link"); return; }
      save({ id, title: "Pasted video" }); paint(); toast("Video picked. Press Play to play along.");
    };
  };
  paint();
  if (server) fetch(`${server}/find?artist=${encodeURIComponent(song.artist || "")}&title=${encodeURIComponent(song.title || "")}&len=${Math.round(length || 0)}`)
    .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || `The search server answered ${r.status}`); found = j.items || []; }))
    .catch(e => { err = e.message || "Couldn't reach the search server. Paste a link below."; })
    .finally(() => { if (layer.querySelector(".ytsheet")) paint(); });
}
