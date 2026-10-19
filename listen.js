// Tabs Listen : find a recording, keep its link,
// play a preview, and take the song's length from the recording.
import { Tabs, VERSION, appleTrackId, fitLength, lengthChoice, linkService, rankTracks } from "./core.js";
import { $, ask, esc, icon, layer, onLeave, toast } from "./ui.js";
import { appleBlocksSearch, catalogBlocked, itunes } from "./sets.js";
import { noteError } from "./store.js";
import { busy, byLength, data, mmss, refreshSpeed, songLength, viewing } from "./app.js";

// ---------- Listen ----------
// A link to the recording, Apple Music first. Tabs looks the song up in Apple's
// public catalog search (no account or key), shows the best match to confirm,
// and saves it with the song. If the lookup can't run, it opens Apple Music's
// own search instead, or takes a pasted Apple Music, Spotify or YouTube link.
const appleSearchURL = song => `https://music.apple.com/search?term=${encodeURIComponent(`${song.title} ${song.artist || ""}`.trim())}`;
function openLink(url) { if (/^https:\/\//.test(url)) window.open(url, "_blank", "noopener"); }
async function findTracks(song, q) {
  const j = await itunes("search", { term: q || `${song.title} ${song.artist || ""}`.trim(), media: "music", entity: "song", limit: 12 });
  return rankTracks(j?.results || [], song.title, song.artist);
}
function saveListen(song, url, extra = {}) {
  song.listen = { url, service: linkService(url), ...extra };
  Tabs.save(data);
  const chip = $("listen");
  if (chip) chip.innerHTML = `${icon("note")}${esc(song.listen.service)}`;
}
// The recording's length becomes the song's length (for song length speed) when
// you haven't set one; if you have, it's offered instead of replacing yours.
function useRecordingLength(song, seconds, { quiet = false } = {}) {
  if (song.listen) song.listen.length = Math.round(seconds);
  const choice = lengthChoice(song, seconds, data.settings);
  const len = fitLength(seconds);
  if (choice === "set") {
    song.duration = len;
    Tabs.save(data); refreshSpeed();
    if (!quiet || viewing === song) { toast(`Length set from the recording: ${mmss(len)}`); return true; }
  } else {
    Tabs.save(data);
    if (choice === "offer" && !quiet && byLength()) { toast(`The recording is ${mmss(len)}. Yours is ${mmss(songLength(song))}.`, null, { label: `Use ${mmss(len)}`, fn: () => { song.duration = len; song.durationSet = true; Tabs.save(data); refreshSpeed(); toast(`Length ${mmss(len)}`); } }); return true; }
  }
  return false;
}
// A pasted Apple Music link: ask Apple's catalog for the track's length.
const lookedUp = new Set();
async function recordingLength(song, url, opts) {
  const id = appleTrackId(url);
  if (!id || lookedUp.has(song.id + id)) return;
  lookedUp.add(song.id + id);
  try {
    const hit = ((await itunes("lookup", { id, entity: "song" }))?.results || []).find(x => x.trackTimeMillis), ms = hit?.trackTimeMillis;
    /* A pasted link brings its album art too (for set covers). */
    if (hit?.artworkUrl100 && song.listen?.url === url && !song.listen.art) { song.listen = { ...song.listen, art: hit.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb") }; Tabs.save(data); }
    if (ms && song.listen?.url === url) useRecordingLength(song, ms / 1000, opts);
  } catch { /* noted for diagnostics */ }
}
// Listen: find the recording without leaving Tabs. Apple Music's catalog is
// searched here (title and artist to start; change the words to search again),
// each result can be previewed (30 seconds, from Apple), and a tap saves it,
// with its album art and length. Paste a link is for Spotify or YouTube.
let preview = null;
function stopPreview() { if (preview) { preview.audio.pause(); preview = null; document.querySelectorAll(".ls-pv.on").forEach(b => { b.classList.remove("on"); b.innerHTML = icon("play"); }); } }
onLeave(() => stopPreview());
// Apple Music (optional, off unless turned on in Settings > Keys): a subscriber
// hears the whole linked recording here. Nothing below runs while it's off.
// MusicKit loads on first use; its developer token comes from the token
// address (the Worker in worker/, which holds the MusicKit key).
const MUSICKIT = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
let musicKit = null, playingId = "", mkStep = "";
/* Apple's player may raise its own alert ("The operation was aborted."). Catch it, keep the stack that
   shows who raised it, and show it as a banner with the step it came from (3.10.1). */
function catchAlerts() {
  if (window.alert.caught) return;
  const real = window.alert.bind(window);
  window.alert = msg => {
    noteError(new Error(`alert at ${mkStep || "?"}: ${msg}`), { quiet: true, where: "apple music alert" });
    toast(`Apple Music (${mkStep || "?"}): ${String(msg).slice(0, 80)}`);
    void real;
  };
  window.alert.caught = true;
}
const step = (name, p) => { mkStep = name; return p; };
function loadMusicKit() {
  if (musicKit) return musicKit;
  catchAlerts();
  musicKit = (async () => {
    const url = data.settings.appleMusicToken || "";
    if (!/^https:\/\//.test(url)) throw new Error("No Apple Music token address");
    const r = await step("token", fetch(url));
    if (!r.ok) throw new Error(`Apple Music token: ${r.status}`);
    const { token } = await r.json();
    if (!window.MusicKit) await step("script", new Promise((ok, no) => {
      document.addEventListener("musickitloaded", ok, { once: true });
      const s = document.createElement("script");
      s.src = MUSICKIT; s.async = true;
      s.onload = () => { if (window.MusicKit) ok(); };
      s.onerror = () => no(new Error("MusicKit didn't load"));
      document.head.appendChild(s);
    }));
    await step("setup", window.MusicKit.configure({ developerToken: token, app: { name: "The Road", build: VERSION } }));
    return window.MusicKit.getInstance();
  })();
  musicKit.catch(() => { musicKit = null; });
  return musicKit;
}
async function playApple(song) {
  const id = appleTrackId(song.listen.url);
  try {
    const music = await loadMusicKit();
    if (!music.isAuthorized) return toast("Sign in to Apple Music to hear the whole song", null, { label: "Sign in", fn: () => step("sign-in", music.authorize()).then(() => playApple(song), e => { noteError(e, { quiet: true, where: "apple music sign-in" }); toast(`Apple Music sign-in stopped: ${String(e?.message || e).slice(0, 80)}`); }) });
    if (playingId === id && music.isPlaying) { music.pause(); return; }
    if (playingId === id) { await step("play", music.play()); return; }
    await step("queue", music.setQueue({ song: id, startPlaying: true }));
    playingId = id;
  } catch (e) {
    noteError(e, { quiet: true, where: `apple music ${mkStep}` });
    toast(`Apple Music stopped at ${mkStep || "start"}: ${String(e?.message || e).slice(0, 70)}`, null, { label: "Open", fn: () => openLink(song.listen.url) });
  }
}
onLeave(() => { if (playingId) { musicKit?.then(m => m.stop(), () => {}); playingId = ""; } });
/* Play starts the recording with the scroll (3.10.0). Opening a song gets MusicKit and the queue ready
   (paused), so Play only has to say play; if Apple Music isn't ready, signed in or linked, nothing
   happens and the song scrolls as before. Pausing the scroll pauses the recording. */
let readyId = "";
const wanted = song => !!(data.settings.appleMusic && song?.listen && appleTrackId(song.listen.url));
export function prepareMusic(song) {
  if (!wanted(song)) return;
  const id = appleTrackId(song.listen.url);
  loadMusicKit().then(async music => {
    if (!music.isAuthorized || playingId === id || readyId === id) return;
    await step("queue", music.setQueue({ song: id, startPlaying: false }));
    readyId = id;
  }).catch(e => noteError(e, { quiet: true, where: "apple music ready" }));
}
export async function startMusic(song) {
  if (!wanted(song)) return;
  const id = appleTrackId(song.listen.url);
  try {
    const music = await loadMusicKit();
    if (!music.isAuthorized) return;
    if (readyId !== id && playingId !== id) { await music.setQueue({ song: id, startPlaying: false }); readyId = id; }
    if (playingId !== id) { try { await music.seekToTime(0); } catch { /* a fresh queue is already at the start */ } }
    await step("play", music.play());
    playingId = id;
  } catch (e) { noteError(e, { quiet: true, where: `apple music start (${mkStep})` }); }
}
export function pauseMusic() { if (playingId) musicKit?.then(m => m.pause(), () => {}); }
function listenSheet(song, force) {
  if (song.listen && !force) return data.settings.appleMusic && appleTrackId(song.listen.url) ? playApple(song) : openLink(song.listen.url);
  if (appleBlocksSearch()) return listenApple(song);
  const first = `${song.title} ${song.artist || ""}`.trim();
  let state = { busy: true, tracks: [], error: false, q: first, all: false };
  const close = () => { stopPreview(); layer.innerHTML = ""; };
  const row = (x, i) => `<div class="ls-item"><button class="row pick ls-row" data-t="${i}">
      ${x.artworkUrl100 ? `<img src="${esc(x.artworkUrl100)}" alt="" width="44" height="44" loading="lazy">` : `<span class="ls-art">${icon("note")}</span>`}
      <div class="txt"><div class="t">${esc(x.trackName)}</div><div class="a">${esc(x.artistName)}${x.collectionName ? ` · ${esc(x.collectionName)}` : ""}</div></div></button>
      ${x.previewUrl ? `<button class="sb ls-pv" data-pv="${i}" aria-label="Hear a preview of ${esc(x.trackName)}">${icon("play")}</button>` : ""}</div>`;
  const results = () => {
    const best = state.tracks[0], sure = state.q === first && best && best.score >= 5 && !state.all;
    if (state.busy) return `<div class="easy-wait">${busy("Looking in Apple Music")}</div>`;
    if (state.error && catalogBlocked()) return `<p class="easy-note">The Road updated in the background. Restart it to finish, then search again.</p>
      <div class="ls-other"><button class="btn primary" id="ls-restart">Restart The Road</button></div>`;
    if (state.error) return `<p class="easy-note">Couldn't reach Apple Music's catalog just now.</p>
      <div class="ls-other"><button class="linkbtn" id="ls-retry">Try again</button><button class="linkbtn" id="ls-apple">Search in Apple Music</button></div>`;
    if (!state.tracks.length) return `<p class="easy-note">No match. Try fewer words, or the artist's name.</p>`;
    return `<p class="easy-note">${sure ? "Found it on Apple Music. Is this the one?" : "Tap the right recording:"}</p>
      <div class="list glass ls-list">${(sure ? state.tracks.slice(0, 1) : state.tracks.slice(0, 8)).map(row).join("")}</div>
      ${sure && state.tracks.length > 1 ? `<button class="linkbtn ls-more" id="ls-more">Not this one? Show others</button>` : ""}`;
  };
  const paintResults = () => {
    const box = $("ls-res");
    if (!box) return;
    stopPreview();
    box.innerHTML = results();
    box.querySelectorAll("[data-t]").forEach(b => b.onclick = () => {
      const x = state.tracks[+b.dataset.t];
      saveListen(song, x.trackViewUrl, { title: x.trackName, artist: x.artistName, ...(x.artworkUrl100 ? { art: x.artworkUrl100.replace(/\d+x\d+bb/, "600x600bb") } : {}) });
      close();
      if (x.trackTimeMillis && useRecordingLength(song, x.trackTimeMillis / 1000)) return;
      toast(`Saved: ${x.trackName}`, null, { label: "Listen", fn: () => openLink(x.trackViewUrl) });
    });
    box.querySelectorAll("[data-pv]").forEach(b => b.onclick = () => {
      const x = state.tracks[+b.dataset.pv], was = preview?.i;
      stopPreview();
      if (was === +b.dataset.pv) return;
      const audio = new Audio(x.previewUrl);
      preview = { audio, i: +b.dataset.pv };
      b.classList.add("on"); b.innerHTML = icon("pause");
      audio.onended = stopPreview;
      audio.play().catch(() => { stopPreview(); toast("The preview couldn't play"); });
    });
    $("ls-more")?.addEventListener("click", () => { state.all = true; paintResults(); });
    $("ls-restart")?.addEventListener("click", () => location.reload());
    $("ls-retry")?.addEventListener("click", () => search(state.q || first));
    $("ls-apple")?.addEventListener("click", () => openLink(`https://music.apple.com/search?term=${encodeURIComponent(state.q || first)}`));
  };
  let seq = 0;
  const search = q => {
    const n = ++seq;
    state = { ...state, busy: true, q };
    paintResults();
    findTracks(song, q).then(t => { if (n === seq) { state = { ...state, busy: false, tracks: t, error: false }; paintResults(); } })
      .catch(() => { if (n === seq) { state = { ...state, busy: false, tracks: [], error: true }; paintResults(); } });
  };
  layer.innerHTML = `<div class="scrim" id="ls-scrim"></div><div class="panel card" id="ls-panel" role="dialog" aria-label="Listen">
    <div class="pc-head">${icon("note")}<span>Listen · ${esc(song.title)}</span></div>
    <form class="ls-q" id="ls-form" role="search"><span class="ls-qi">${icon("search")}</span>
      <input id="ls-q" type="search" value="${esc(first)}" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search Apple Music"></form>
    <div id="ls-res"></div>
    ${song.listen ? `<p class="foot" style="margin:10px 2px 0">Saved: ${esc(song.listen.service)}${song.listen.title ? ` · ${esc(song.listen.title)}` : ""}</p>` : ""}
    <div class="ls-other"><button class="linkbtn" id="ls-paste">Paste a Spotify or YouTube link</button>
      ${song.listen ? `<button class="danger" id="ls-clear">Remove link</button>` : ""}</div></div>`;
  $("ls-scrim").onclick = close;
  const q = $("ls-q");
  q.value = first;
  let typing = 0;
  q.oninput = () => { clearTimeout(typing); typing = setTimeout(() => { if (q.value.trim()) search(q.value.trim()); }, 600); };
  $("ls-form").onsubmit = e => { e.preventDefault(); clearTimeout(typing); q.blur(); if (q.value.trim()) search(q.value.trim()); };
  $("ls-paste").onclick = () => pasteListen(song, close);
  $("ls-clear")?.addEventListener("click", () => clearListen(song, close));
  search(first);
}
// A copied link (Apple Music, Spotify or YouTube) becomes the song's recording.
// Apple Music links bring the length and album art with them.
// Apple Music's Copy Link puts a link (not plain text) on the clipboard, and
// Safari's readText() can come back empty for that. read() sees every kind,
// so the one system Paste tap is enough. Only one read, so one prompt.
async function readClipboard() {
  const clip = navigator.clipboard;
  if (!clip?.read) return clip?.readText ? clip.readText() : "";
  const items = await clip.read();
  const kinds = [];
  for (const item of items) {
    kinds.push(...item.types);
    for (const type of ["text/uri-list", "text/plain"]) {
      if (!item.types.includes(type)) continue;
      const text = (await (await item.getType(type)).text()).trim();
      if (text) return type === "text/uri-list" ? text.split(/\r?\n/).find(l => l && !l.startsWith("#")) || "" : text;
    }
  }
  if (kinds.length) noteError(new Error(`Clipboard had no text or link (${kinds.join(", ").slice(0, 120)})`), { quiet: true, where: "paste" });
  return "";
}
async function pasteListen(song, close, { apple = false } = {}) {
  let text = "";
  try { text = await readClipboard(); } catch { /* not allowed: ask below */ }
  const use = text => {
    const url = (text.match(/https:\/\/\S+/) || [])[0];
    if (!url) return toast("That doesn't look like a link");
    pendingListen = null;
    document.querySelector(".backpaste")?.remove();
    saveListen(song, url);
    close();
    toast(`Saved the ${linkService(url)} link`);
    if (appleTrackId(url)) recordingLength(song, url);
  };
  if (/https:\/\/\S+/.test(text)) return use(text);
  ask({ title: "Paste the song's link", text: apple ? "In Apple Music: tap ••• or Share, then Copy Link." : "From Apple Music, Spotify or YouTube: tap Share, then Copy Link.", placeholder: "https://…", caps: "none", ok: "Save link" }, use);
}
function clearListen(song, close) {
  delete song.listen; Tabs.save(data); close();
  const c = $("listen"); if (c) c.innerHTML = `${icon("note")}Listen`;
  toast("Link removed");
}
// iPhone: Apple's catalog can't be searched from a web page there (see sets.js),
// so Listen opens Apple Music's search. Copy the link, come back, tap Paste.
let pendingListen = null; /* { id, at } while you're in Apple Music */
onLeave(() => document.querySelector(".bp-listen")?.remove());
function listenApple(song) {
  const close = () => { layer.innerHTML = ""; };
  layer.innerHTML = `<div class="scrim" id="ls-scrim"></div><div class="panel card" id="ls-panel" role="dialog" aria-label="Listen">
    <div class="pc-head">${icon("note")}<span>Listen · ${esc(song.title)}</span></div>
    <p class="easy-note">Find the recording in Apple Music, tap ••• or Share, then Copy Link. Come back and tap Paste.</p>
    ${song.listen ? `<p class="foot" style="margin:0 2px 10px">Saved: ${esc(song.listen.service)}${song.listen.title ? ` · ${esc(song.listen.title)}` : ""}</p>` : ""}
    <div class="ls-other" style="margin:0 0 12px"><button class="linkbtn" id="ls-paste">Paste a link</button>
      ${song.listen ? `<button class="danger" id="ls-clear">Remove link</button>` : ""}</div>
    <button class="btn primary ls-open" id="ls-open">${icon("search")}Find on Apple Music</button></div>`;
  $("ls-scrim").onclick = close;
  $("ls-open").onclick = () => { pendingListen = { id: song.id, at: Date.now() }; close(); openLink(appleSearchURL(song)); };
  $("ls-paste").onclick = () => pasteListen(song, close, { apple: true });
  $("ls-clear")?.addEventListener("click", () => clearListen(song, close));
}
// Back from Apple Music: offer to paste the link (reading the clipboard needs a tap).
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !pendingListen || Date.now() - pendingListen.at > 30 * 60e3) return;
  const song = data.songs.find(s => s.id === pendingListen.id);
  if (!song || viewing !== song || document.querySelector(".backpaste")) return;
  const b = document.createElement("div");
  b.className = "backpaste glass float bp-listen";
  b.innerHTML = `<span>Copied the Apple Music link?</span><button class="btn sm primary" id="bp-go">Paste</button><button class="sb" id="bp-x" aria-label="Dismiss">${icon("x")}</button>`;
  document.body.appendChild(b);
  $("bp-x").onclick = () => { b.remove(); pendingListen = null; };
  $("bp-go").onclick = () => pasteListen(song, () => {}, { apple: true });
});

export { appleSearchURL, listenSheet, openLink, recordingLength };
