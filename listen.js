// Tabs Listen : find a recording, keep its link,
// play a preview, and take the song's length from the recording.
import { Tabs, VERSION, appleTrackId, bodyKey, cleanFeel, cleanTimed, feelOf, fitLength, lengthChoice, linkService, matchLines, parseLrc, rankTracks } from "./core.js";
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
let musicKit = null, inst = null, playingId = "", mkStep = "";
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
  musicKit.then(m => { inst = m; }, () => { musicKit = null; });
  return musicKit;
}
export async function playApple(song) {
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
let readyId = "", askedSignIn = 0;
/* Not signed in to Apple Music inside the app: every recording feature would do nothing, so say so (3.24.1). */
function signInPrompt(music, song) {
  if (Date.now() - askedSignIn < 30000) return;
  askedSignIn = Date.now();
  toast("Sign in to Apple Music to play the recording with the page", null, { label: "Sign in", fn: () => step("sign-in", music.authorize()).then(() => { readyId = ""; prepareMusic(song); }, e => noteError(e, { quiet: true, where: "apple music sign-in" })) });
}
const wanted = song => !!(data.settings.appleMusic && song?.listen && appleTrackId(song.listen.url));
export const hasMusic = wanted;
export function prepareMusic(song) {
  if (!wanted(song)) return;
  fetchDetails(song);
  listenToPreview(song);
  const id = appleTrackId(song.listen.url);
  loadMusicKit().then(async music => {
    if (!music.isAuthorized) return signInPrompt(music, song);
    if (playingId === id || readyId === id) return;
    await step("queue", music.setQueue({ song: id, startPlaying: false }));
    readyId = id;
  }).catch(e => noteError(e, { quiet: true, where: "apple music ready" }));
}
/* `at` is where in the recording to start, in seconds: the scroll's place, so Play from the middle of
   the sheet starts the music there. A resume from a pause that is already about right is left alone. */
export async function startMusic(song, at = 0, rate = 1) {
  if (!wanted(song)) return;
  const id = appleTrackId(song.listen.url);
  try {
    const music = await loadMusicKit();
    if (!music.isAuthorized) return signInPrompt(music, song);
    if (readyId !== id && playingId !== id) { await music.setQueue({ song: id, startPlaying: false }); readyId = id; }
    const cur = playingId === id ? music.currentPlaybackTime || 0 : 0;
    if (Math.abs(cur - at) > 1.5) { try { await music.seekToTime(Math.max(0, at)); } catch { /* a fresh queue is already at the start */ } }
    await step("play", music.play());
    playingId = id;
    setMusicRate(rate);
  } catch (e) { noteError(e, { quiet: true, where: `apple music start (${mkStep})` }); }
}
/* Slowing the recording (3.14.0), for practice: Apple Music's own player setting. A build that doesn't
   offer the speed stays at full speed, and rateWorks() says so. */
export const rateWorks = () => !inst || "playbackRate" in inst;
export function setMusicRate(rate) {
  if (!inst || !("playbackRate" in inst)) return false;
  try { inst.playbackRate = Math.min(1, Math.max(0.5, rate || 1)); return true; } catch (e) { noteError(e, { quiet: true, where: "apple music speed" }); return false; }
}
/* Song details and recent plays from Apple Music's catalog (3.15.0): genre, year, composer and the album's
   own color, kept on the song's listen link; and what you played lately, for Find songs. Both go through
   the MusicKit session, so they need Apple Music turned on and you signed in. */
const cleanHex = v => /^[0-9a-f]{6}$/i.test(String(v || "")) ? String(v).toLowerCase() : "";
async function apiGet(path, params) {
  const music = await loadMusicKit();
  if (!music.isAuthorized) return null;
  const r = await music.api.music(path, params);
  return r?.data?.data || null;
}
const detailJobs = new Set();
let detailsArrived = null; /* the open Recording sheet repaints when the details come in */
export async function fetchDetails(song) {
  if (!wanted(song) || song.listen.det || detailJobs.has(song.id)) return;
  detailJobs.add(song.id);
  try {
    const music = await loadMusicKit();
    const rows = await apiGet(`/v1/catalog/${music.storefrontId || "us"}/songs/${appleTrackId(song.listen.url)}`);
    const a = rows?.[0]?.attributes;
    if (!a) return;
    const l = { ...song.listen, det: 1 };
    const genre = (a.genreNames || []).find(g => g && g !== "Music");
    if (genre) l.genre = String(genre).slice(0, 40);
    const year = +String(a.releaseDate || "").slice(0, 4);
    if (year >= 1900 && year <= 2100) l.year = year;
    if (a.composerName) l.composer = String(a.composerName).slice(0, 80);
    const tint = cleanHex(a.artwork?.bgColor);
    if (tint) l.tint = tint;
    song.listen = l; Tabs.save(data);
    if (viewing === song) detailsArrived?.(song);
  } catch (e) { noteError(e, { quiet: true, where: "apple music details" }); }
  finally { detailJobs.delete(song.id); }
}
/* Line timing (3.17.0). A song with a linked recording asks LRCLIB once for that recording's synced
   lyrics (same title and artist, length within 3 seconds), matches its lines to the sheet's, and keeps
   only the times: song.timed = { h, id, at: [[line, seconds]] }, or { h, none } when there are none.
   It asks again after the sheet's words change. readLines() gives the sheet's lines as [{ i, text }]. */
const timeJobs = new Set();
export async function timeLines(song, readLines) {
  if (!wanted(song) || !song.body) return;
  const h = bodyKey(song.body), len = song.listen.length || 0;
  if (song.timed?.h === h || timeJobs.has(song.id) || !(len > 0)) return;
  timeJobs.add(song.id);
  try {
    const title = song.listen.title || song.title, artist = song.listen.artist || song.artist || "";
    const q = `track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const fits = x => x?.syncedLyrics && Math.abs((x.duration || 0) - len) <= 3;
    const get = async url => { const r = await fetch(url, { cache: "no-store" }); return r.ok ? r.json() : null; };
    let hit = await get(`https://lrclib.net/api/get?${q}&duration=${Math.round(len)}`).catch(() => null);
    if (!fits(hit)) hit = ((await get(`https://lrclib.net/api/search?${q}`).catch(() => null)) || []).find(fits) || null;
    const rows = hit ? parseLrc(hit.syncedLyrics) : [], pairs = hit ? matchLines(readLines(), rows) : [];
    const at = pairs.map(([i, sec]) => [i, sec]), w = {};
    for (const [i, , j] of pairs) if (rows[j]?.[2]) w[i] = rows[j][2]; /* word times, when the lyrics have them */
    /* fewer than four lines matched: probably a different sheet or version, so don't trust it */
    song.timed = cleanTimed(at.length >= 4 ? { h, id: hit.id, at, w } : { h, none: 1 });
    Tabs.save(data);
    if (viewing === song) detailsArrived?.(song);
  } catch (e) { noteError(e, { quiet: true, where: "line timing" }); }
  finally { timeJobs.delete(song.id); }
}
/* Listening to the preview (3.18.0). Apple's 30-second preview of the linked track is read once and
   measured: tempo, swing and key, kept as song.listen.feel. Preview files may not allow a web page to
   read them, so it tries directly and then through the token Worker's /preview route (worker/README.md);
   if neither works it tries again next time the app opens. A song with no tempo takes the measured one. */
const feelJobs = new Set(), feelFailed = new Set();
async function previewBytes(url) {
  try { const r = await fetch(url, { mode: "cors" }); if (r.ok) return await r.arrayBuffer(); } catch { /* not readable directly */ }
  const base = String(data.settings.appleMusicToken || "").replace(/\/token\/?$/, "");
  if (!/^https:\/\//.test(base)) return null;
  const r = await fetch(`${base}/preview?u=${encodeURIComponent(url)}`);
  return r.ok ? r.arrayBuffer() : null;
}
export async function listenToPreview(song) {
  const id = appleTrackId(song?.listen?.url || "");
  if (!wanted(song) || song.listen.feel || feelJobs.has(id) || feelFailed.has(id)) return;
  feelJobs.add(id);
  try {
    const hit = ((await itunes("lookup", { id, entity: "song" }))?.results || []).find(x => x.previewUrl);
    if (!hit) throw new Error("no preview");
    const bytes = await previewBytes(hit.previewUrl);
    if (!bytes) throw new Error("preview not readable (the Worker needs the /preview route)");
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const buf = await new Off(1, 44100, 44100).decodeAudioData(bytes);
    const mono = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / buf.numberOfChannels; }
    const feel = cleanFeel(feelOf(mono, buf.sampleRate) || { none: 1 });
    if (!feel || !song.listen || appleTrackId(song.listen.url) !== id) return;
    song.listen = { ...song.listen, feel };
    if (!song.bpm && feel.bpm && (feel.sure || 0) >= 0.1) song.bpm = feel.bpm;
    Tabs.save(data);
    if (viewing === song) { detailsArrived?.(song); feelArrived?.(song); }
  } catch (e) { feelFailed.add(id); noteError(e, { quiet: true, where: "preview listening" }); }
  finally { feelJobs.delete(id); }
}
let feelArrived = null;
export const onFeel = f => { feelArrived = f; };
/* What you played lately in Apple Music: [{ title, artist }], newest first. */
let recentCache = null; /* { at, rows }: Tonight asks each time it opens; Apple is asked at most every 2 minutes */
export async function recentApple() {
  if (!data.settings.appleMusic || !data.settings.appleMusicToken) return [];
  if (recentCache && Date.now() - recentCache.at < 120000) return recentCache.rows;
  const rows = await recentFetch();
  recentCache = { at: Date.now(), rows };
  return rows;
}
async function recentFetch() {
  try {
    const rows = await apiGet("/v1/me/recent/played/tracks", { limit: 10, types: "songs" });
    const seen = new Set(), out = [];
    for (const r of rows || []) {
      const a = r.attributes, key = `${a?.name}|${a?.artistName}`.toLowerCase();
      if (!a?.name || seen.has(key)) continue;
      const art = String(a.artwork?.url || "").replace("{w}x{h}", "600x600").replace("{f}", "jpg");
      seen.add(key); out.push({ title: String(a.name).slice(0, 100), artist: String(a.artistName || "").slice(0, 100),
        ...(/^https:\/\/music\.apple\.com\//.test(a.url || "") ? { url: a.url } : {}), ...(/^https:\/\//.test(art) ? { art } : {}) });
    }
    return out.slice(0, 8);
  } catch (e) { noteError(e, { quiet: true, where: "apple music recent" }); return []; }
}
/* The recording's own clock, in seconds, while it is playing; null otherwise. Play scrolls by it (3.12.0). */
export const musicPlaying = song => !!(inst && playingId && song?.listen && playingId === appleTrackId(song.listen.url) && inst.isPlaying);
// ---- The Recording sheet (3.16.0; 4.20.0 redone) ----
// Tap the recording button beside Play: the cover and the song's details, the recording's facts as chips,
// what Play starts as two big choices (a tap saves and closes), Listen first (the recording without the
// page moving), what the page has learned of the song, and Change recording. The app passes in how to
// read and change those.
//  o.mode() "music" | "band", o.setMode(m), o.reset(), o.changed(),
//  o.spots() { auto, mine }: where the timed lines and your nudges sit down the sheet (0 to 1),
//  o.notes() { key, bpm }: how the sheet differs from the measured recording; o.matchKey(), o.matchBpm()
export function recordingSheet(song, o) {
  const close = () => { detailsArrived = null; layer.innerHTML = ""; o.changed?.(); };
  const paint = () => {
    const l = song.listen || {}, band = o.mode() === "band", marks = song.syncs || [], on = musicPlaying(song);
    const timed = song.timed?.at?.length || 0, spots = o.spots?.() || { auto: [], mine: marks.map(m => m[0]) };
    /* 4.20.0: the recording's facts as chips, and a word when the sheet doesn't match it */
    const f = l.feel && !l.feel.none ? l.feel : null, look = f ? o.notes?.() || {} : {};
    const facts = f ? [f.bpm && `${f.bpm} BPM`, f.swing && ({ straight: "Straight", light: "Light swing", full: "Swung" })[f.swing], f.key && `Key of ${f.key}`].filter(Boolean) : [];
    const keyNote = look.key ? `<div class="rs-look"><span>The recording sounds ${Math.abs(look.key)} half step${Math.abs(look.key) === 1 ? "" : "s"} ${look.key > 0 ? "higher" : "lower"} than your sheet.</span><button class="btn sm" id="rs-key">Match it</button></div>` : "";
    const bpmNote = look.bpm ? `<div class="rs-look"><span>Your tempo is ${song.bpm}. The recording is ${f.bpm}.</span><button class="btn sm" id="rs-bpm">Use ${f.bpm}</button></div>` : "";
    const details = [l.genre, l.year, l.composer && `Written by ${l.composer}`].filter(Boolean).join(" · ");
    const opt = (m, ic, t, sub) => `<button data-mode="${m}" class="rs-opt${(m === "band") === band ? " on" : ""}" aria-pressed="${(m === "band") === band}"><span class="rs-oi">${icon(ic)}</span><span class="rs-ot"><b>${t}</b><small>${sub}</small></span><span class="rs-ok" aria-hidden="true">${icon("check")}</span></button>`;
    const sync = band ? "" : `<div class="rs-row"><div class="rs-l">Sync<b>${timed ? `${timed} lines timed${marks.length ? ` · ${marks.length} fixed` : ""}` : marks.length ? `${marks.length} spot${marks.length === 1 ? "" : "s"} learned` : "Nothing learned yet"}${marks.length ? `<button class="rs-reset" id="rs-reset">Start over</button>` : ""}</b></div>
        <div class="rs-track" aria-hidden="true">${spots.auto.map(w => `<b style="left:${(w * 100).toFixed(1)}%"></b>`).join("")}${spots.mine.map(w => `<i style="left:${(w * 100).toFixed(1)}%"></i>`).join("")}</div>
        ${timed ? `<p class="rs-note">Each line is timed to the recording${f?.bpm ? ", and its chords land on the beat" : ""}. Nudge the page to fix a spot. <a href="https://lrclib.net" target="_blank" rel="noopener">Timing from LRCLIB</a></p>` : `<p class="rs-note">Nudge the page while it plays and it learns where the lines fall.</p>`}</div>`;
    layer.innerHTML = `<div class="scrim" id="rs-scrim"></div><div class="panel card rs" id="rs" role="dialog" aria-label="Recording">
      <div class="grab" aria-hidden="true"></div>
      ${coverHead({ art: l.art, title: l.title || song.title, artist: l.artist || song.artist, details, tint: l.tint,
        side: `<button class="rs-x" id="rs-done" aria-label="Close">${icon("x")}</button>` })}
      <div class="rs-body">
        ${facts.length ? `<div class="rs-facts">${facts.map(x => `<span>${esc(x)}</span>`).join("")}</div>` : ""}${keyNote}${bpmNote}
        <div class="rs-h">WHEN YOU PRESS PLAY</div>
        <div class="rs-choice" role="group" aria-label="When you press Play">
          ${opt("music", "note", "Play along with the recording", "It plays and the page follows it")}
          ${opt("band", "metro", "Play with your band", "Your metronome, drums and bass. No recording")}
        </div>
        <button class="btn rs-hear" id="rs-listen" aria-label="${on ? "Pause the recording" : "Listen without the page moving"}">${icon(on ? "pause" : "play")}${on ? "Pause" : "Listen first"}</button>
        ${sync}
        <button class="rs-change" id="rs-change">Change recording</button>
      </div></div>`;
    $("rs-scrim").onclick = close;
    $("rs-done").onclick = close;
    $("rs-listen").onclick = () => playApple(song).then(() => setTimeout(paint, 150));
    /* a choice saves and closes */
    layer.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { o.setMode(b.dataset.mode); close(); });
    $("rs-reset")?.addEventListener("click", () => { o.reset(); paint(); });
    $("rs-key")?.addEventListener("click", () => { o.matchKey?.(); paint(); });
    $("rs-bpm")?.addEventListener("click", () => { o.matchBpm?.(); paint(); });
    $("rs-change").onclick = () => { close(); listenSheet(song, true); };
  };
  detailsArrived = s2 => { if (s2 === song && $("rs")) paint(); };
  fetchDetails(song);
  listenToPreview(song);
  paint();
}
export function musicClock(song) {
  if (!inst || !playingId || !song?.listen || playingId !== appleTrackId(song.listen.url) || !inst.isPlaying) return null;
  const t = inst.currentPlaybackTime;
  return Number.isFinite(t) ? t : null;
}
/* Jump the recording to a place in it, after a hand moved the page. */
export function seekMusic(song, sec) {
  if (!inst || !playingId || !song?.listen || playingId !== appleTrackId(song.listen.url)) return;
  Promise.resolve(inst.seekToTime(Math.max(0, sec))).catch(e => noteError(e, { quiet: true, where: "apple music seek" }));
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
    ${listenHead(song)}
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
    ${listenHead(song)}
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

/* The cover header (3.16.0, shared in 3.23.0): album art, title, artist and a line of details over a wash
   of the album's colour. Used by the Recording, Listen and Get the song sheets. side is a button on the right. */
export function coverHead({ art, title, artist, details, tint, side = "" }) {
  const wash = /^[0-9a-f]{6}$/i.test(tint || "") ? ` style="--album:#${tint}"` : "";
  return `<div class="rs-head cover-head"${wash}><div class="rs-art">${/^https:\/\//.test(art || "") ? `<img src="${esc(art)}" alt="">` : icon("note")}</div>
    <div class="rs-txt"><div class="rs-t">${esc(title || "")}</div>${artist ? `<div class="rs-a">${esc(artist)}</div>` : ""}${details ? `<div class="rs-d">${esc(details)}</div>` : ""}</div>${side}</div>`;
}
const listenHead = song => coverHead({ art: song.listen?.art || song.art, title: song.title, artist: song.artist, tint: song.listen?.tint,
  details: song.listen ? `Listening on ${song.listen.service}` : "Pick the recording you play along with" });
