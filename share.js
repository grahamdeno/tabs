// Tabs sharing : song and set links, opening a
// shared link, and Play together. The song or set rides inside the
// link, so it works without a server or an account.
import { Tabs, findSame, packShare, shareable, unpackShare } from "./core.js";
import { $, esc, icon, layer, onLeave, showToCopy, sound, toast } from "./ui.js";
import { setSongs } from "./sets.js";
import { data, go, mmss, render, scroll, songLength, startScroll, stopScroll, viewing } from "./app.js";

// ---------- Share ----------
// The song or set rides inside the link, so it works without a server or an account.
// Opening the link in Tabs offers to add it; nothing is added without a tap.
async function shareLink(payload, title, near) {
  const url = location.origin + location.pathname + "#/import/" + await packShare(payload);
  if (navigator.share) {
    try { await navigator.share({ title, text: title, url }); return true; }
    catch (e) { if (e.name === "AbortError") return false; }
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied", near); }
  catch { showToCopy("Copy this link", url); }
  return true;
}
// The ••• button you can see: in the song bar on a phone held upright (one
// hand), at the top on larger screens.
const moreBtn = () => [...document.querySelectorAll("button.more")].find(b => b.offsetParent) || $("more");
const shareSong = song => shareLink({ song: shareable(song) }, `${song.title}${song.artist ? " · " + song.artist : ""} (Tabs)`, moreBtn());
// ---------- Play together ----------
// No server: the link carries the song, a start time and the tempo. Both
// phones count in at that moment by their own clocks and scroll to the
// song's length, so they stay together. Pause or jump on one phone doesn't
// reach the other.
const DUET_MINS = [1, 2, 5];
let duetMins = 2, duet = null; // duet: { song, at, timer } while waiting
const clockTime = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
const mmssLeft = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const startAt = mins => Math.ceil((Date.now() + mins * 60000) / 15000) * 15000; // on a quarter minute, easy to read out
const wakeAudio = () => sound();
function duetSheet(song) {
  if (scroll.on) stopScroll();
  const draw = () => {
    if (!$("du-when")) return clearInterval(tick);
    $("du-when").textContent = clockTime(startAt(duetMins));
  };
  layer.innerHTML = `<div class="scrim" id="du-scrim"></div><div class="panel card" role="dialog" aria-label="Play together">
    <div class="pc-head">${icon("pick")}<span>Play together</span></div>
    <p class="duet-t">Start both phones at the same moment</p>
    <div class="seg duet-seg" id="du-mins" role="group" aria-label="Start in">${DUET_MINS.map(m => `<button data-min="${m}" class="${m === duetMins ? "on" : ""}" aria-pressed="${m === duetMins}">In ${m} min</button>`).join("")}</div>
    <div class="duet-when"><big id="du-when">${clockTime(startAt(duetMins))}</big><span>${song.bpm || 90} BPM · one bar count-in · ${mmss(songLength(song))}</span></div>
    <p class="foot pn">Your friend gets the song in the link. At the start time both phones count in and scroll together. Keep Tabs open on this song.</p>
    <div class="actions"><button class="btn" id="du-no">Not now</button><button class="btn primary" id="du-go">${icon("share")} Share link</button></div></div>`;
  const tick = setInterval(draw, 1000);
  const close = () => { clearInterval(tick); layer.innerHTML = ""; };
  $("du-scrim").onclick = close; $("du-no").onclick = close;
  $("du-mins").querySelectorAll("[data-min]").forEach(b => b.onclick = () => {
    duetMins = +b.dataset.min;
    $("du-mins").querySelectorAll("[data-min]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    draw();
  });
  $("du-go").onclick = async () => {
    wakeAudio();
    const at = startAt(duetMins);
    clearInterval(tick);
    /* The length goes along even when the song uses your default, so both scroll alike. */
    const sent = await shareLink({ song: { ...shareable(song), duration: songLength(song), bpm: song.bpm || 90 }, duet: { at, bpm: song.bpm || 90 } }, `Play ${song.title} with me at ${clockTime(at)} (Tabs)`, moreBtn());
    if (!sent) { layer.innerHTML = ""; return; }
    duetWait(song, at);
  };
}
// The friend's side: the link opens a countdown; Join adds the song (or uses
// the same one already here) and waits on it.
function duetJoin(shared, d) {
  const same = data.songs.find(x => x.title === shared.title && (x.artist || "") === (shared.artist || "") && x.body === shared.body
    && (x.bpm || 0) === (shared.bpm || 0) && (x.duration || 0) === (shared.duration || 0));
  layer.innerHTML = `<div class="scrim" id="dj-scrim"></div><div class="panel card" role="dialog" aria-label="Play together">
    <div class="pc-head">${icon("pick")}<span>Play together</span></div>
    <p class="duet-t">${esc(shared.title)}</p><p class="duet-a">${esc(shared.artist || "Unknown artist")} · ${d.bpm} BPM</p>
    <div class="duet-when"><big id="dj-left">${mmssLeft(d.at - Date.now())}</big><span>until the count-in at ${clockTime(d.at)}</span></div>
    <p class="foot pn">${same ? "You have this song already." : "The song is added to your library."} Keep this screen open; it starts on its own.</p>
    <div class="actions"><button class="btn" id="dj-no">Not now</button><button class="btn primary" id="dj-yes">Join</button></div></div>`;
  const tick = setInterval(() => {
    if (!$("dj-left")) return clearInterval(tick);
    if (Date.now() > d.at + 1500) { clearInterval(tick); layer.innerHTML = ""; return toast("That start time has passed"); }
    $("dj-left").textContent = mmssLeft(d.at - Date.now());
  }, 250);
  const close = () => { clearInterval(tick); layer.innerHTML = ""; };
  $("dj-scrim").onclick = close; $("dj-no").onclick = close;
  $("dj-yes").onclick = () => {
    wakeAudio(); close();
    const song = same || Tabs.addSong(data, shared);
    go("#/song/" + encodeURIComponent(song.id));
    const ready = setInterval(() => { if (viewing?.id === song.id && $("sheet")) { clearInterval(ready); duetWait(viewing, d.at); } }, 50);
    setTimeout(() => clearInterval(ready), 5000);
  };
}
// Both sides: wait on the song at its top, then start exactly on time.
function duetWait(song, at) {
  duetCancel();
  window.scrollTo(0, 0);
  layer.innerHTML = `<div class="panel card duet-wait" role="dialog" aria-label="Waiting to play together">
    <div class="pc-head">${icon("pick")}<span>Play together</span></div>
    <div class="duet-when"><big id="dw-left">${mmssLeft(at - Date.now())}</big><span>until the count-in at ${clockTime(at)}</span></div>
    <div class="actions"><button class="btn" id="dw-x">Cancel</button></div></div>`;
  navigator.wakeLock?.request("screen").then(l => { if (duet) duet.lock = l; else l.release(); }).catch(() => {});
  duet = { song, at, timer: 0, lock: null };
  $("dw-x").onclick = () => { duetCancel(); toast("Play together cancelled"); };
  const step = () => {
    if (!duet) return;
    const left = at - Date.now();
    if ($("dw-left")) $("dw-left").textContent = mmssLeft(left);
    if (left <= 0) {
      const s = duet.song; duetCancel();
      if (viewing === s) { window.scrollTo(0, 0); startScroll(s, { duet: true }); }
      return;
    }
    duet.timer = left > 400 ? setTimeout(step, Math.min(250, left - 300)) : requestAnimationFrame(step);
  };
  step();
}
function duetCancel() {
  if (!duet) return;
  clearTimeout(duet.timer); cancelAnimationFrame(duet.timer);
  duet.lock?.release?.().catch(() => {});
  duet = null;
  if (document.querySelector(".duet-wait")) layer.innerHTML = "";
}
onLeave(() => duetCancel());
const shareSet = set => shareLink({ set: { name: set.name, songs: setSongs(set).map(shareable) } }, `${set.name} (Tabs set)`, $("s-share"));

async function renderImport(code) {
  const got = await unpackShare(code);
  const full = location.origin + location.pathname + "#/import/" + code;
  /* On iPhone, a link opens in Safari, which has a separate library from the Home Screen app. */
  const inBrowser = !(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
  history.replaceState(null, "", location.pathname + "#/");
  render();
  if (!got) return toast("That link didn't come through whole. Ask for it again");
  if (got.duet && got.duet.at > Date.now() - 1500) return duetJoin(got.song, got.duet);
  if (got.duet) toast("That start time has passed. You can still add the song");
  const songs = got.song ? [got.song] : got.set.songs;
  const have = songs.filter(x => findSame(data, x));
  const name = got.song ? `"${esc(got.song.title)}"${got.song.artist ? ` by ${esc(got.song.artist)}` : ""}` : `the set "${esc(got.set.name)}"`;
  layer.innerHTML = `
    <div class="scrim" id="im-scrim"></div>
    <div class="panel card" role="dialog" aria-label="Shared with you">
      <div class="pc-head">${icon("share")}<span>Shared with you</span></div>
      <p class="imp-t">Add ${name} to your library?</p>
      ${got.set ? `<div class="list glass imp-list">${songs.map(x => `<div class="row"><div class="txt"><div class="t">${esc(x.title)}</div><div class="a">${esc(x.artist || "Unknown artist")}${findSame(data, x) ? " · already in your library" : ""}</div></div></div>`).join("")}</div>` : ""}
      ${got.song && have.length ? `<p class="foot pn">You already have a song with this name. Adding keeps both.</p>` : ""}
      ${inBrowser ? `<p class="foot pn">Use Tabs from your Home Screen? It keeps its own library: <button class="linkbtn" id="im-copy">copy this link</button> and paste it into the search bar there.</p>` : ""}
      <div class="actions"><button class="btn" id="im-no">Not now</button><button class="btn primary" id="im-yes">${got.set ? "Add set" : "Add song"}</button></div>
    </div>`;
  const close = () => { layer.innerHTML = ""; };
  $("im-scrim").onclick = close; $("im-no").onclick = close;
  $("im-copy")?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(full); toast("Link copied"); } catch { showToCopy("Copy this link", full); } });
  $("im-yes").onclick = () => {
    close();
    if (got.song) { const s = Tabs.addSong(data, got.song); return go("#/song/" + encodeURIComponent(s.id)); }
    /* In a set, songs you already have are reused rather than copied. */
    const ids = [...songs].reverse().map(x => (findSame(data, x) || Tabs.addSong(data, x)).id).reverse();
    const set = Tabs.addSet(data, got.set.name);
    set.songIds = ids; Tabs.save(data);
    go("#/set/" + encodeURIComponent(set.id));
  };
}

export { duetSheet, moreBtn, renderImport, shareLink, shareSet, shareSong };
