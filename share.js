// Tabs sharing : song and set links, opening a
// shared link, and Play together. The song or set rides inside the
// link, so it works without a server or an account.
import { Tabs, VERSION, findSame, packShare, shareable, strumDetector, unpackShare } from "./core.js";
import { louie } from "./louie.js";
import { $, esc, icon, layer, onLeave, showToCopy, sound, toast } from "./ui.js";
import { setSongs } from "./sets.js";
import { data, go, render, scroll, songLength, startScroll, stopScroll, viewing } from "./app.js";

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
const shareSong = song => shareLink({ song: shareable(song) }, `${song.title}${song.artist ? " · " + song.artist : ""} (The Road)`, moreBtn());
// ---------- Play together (4.29.0: clap to start) ----------
// No server. Send song shares the song (with its tempo and length). Each player picks a part (Chords,
// Bass line, or Melody when the song has a sung melody) and taps Listen for clap; both phones listen,
// and one clap in the room starts the one-bar count-in on both at once. On a call it works the same,
// as long as each phone can hear the clap. Pause or jump on one phone doesn't reach the other.
const PARTS = [["chords", "Chords"], ["bass", "Bass line"], ["melody", "Melody"]];
const CLAP_QUIET = 300, CLAP_WAIT = 60000; /* ignore the tap that started listening; give up after a minute */
let duetPart = "chords", duet = null; // duet: { stream, src, timer, until } while listening
const wakeAudio = () => sound();
const hasMelody = song => !!song.sketch?.lines?.some(l => l?.n?.length);
function duetSheet(song) {
  if (scroll.on) stopScroll();
  duetCancel();
  const parts = PARTS.filter(([k]) => k !== "melody" || hasMelody(song));
  if (!parts.some(([k]) => k === duetPart)) duetPart = "chords";
  layer.innerHTML = `<div class="scrim" id="pt-scrim"></div><div class="panel card pt" role="dialog" aria-label="Play together"><div class="grab" aria-hidden="true"></div>
    <div class="pt-head">${louie("happy", { pose: "wave", size: 60 })}<div><b>Play together</b><span>Two phones, one song, one start</span></div></div>
    <div class="pt-cap" id="pt-parth">Your part</div>
    <div class="seg pt-parts" id="pt-part" role="group" aria-labelledby="pt-parth">${parts.map(([k, n]) => `<button data-part="${k}" class="${k === duetPart ? "on" : ""}" aria-pressed="${k === duetPart}">${n}</button>`).join("")}</div>
    <p class="pt-note" id="pt-pnote"></p>
    <div class="pt-cap">Start</div>
    <div class="pt-start" id="pt-start"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" class="pt-halo"/><path d="M13 22c0-5 3-9 7-9s7 4 7 9M8 14l3 2M32 14l-3 2M20 6v4"/></svg><span id="pt-say" role="status">Both phones listen. One clap, and both count in together.</span></div>
    <div class="pt-btns"><button class="btn" id="pt-send">${icon("share")}Send song</button><button class="btn primary" id="pt-listen">Listen for clap</button></div></div>`;
  const note = () => { $("pt-pnote").textContent = duetPart === "bass" ? `Bex plays the bass line with you, ${song.bpm || 90} BPM. Your friend picks theirs on their phone.` : duetPart === "melody" ? "The words with the melody notes you sang. Your friend picks theirs on their phone." : "Your friend picks theirs on their phone."; };
  note();
  const close = () => { duetCancel(); layer.innerHTML = ""; };
  $("pt-scrim").onclick = close;
  $("pt-part").querySelectorAll("[data-part]").forEach(b => b.onclick = () => {
    duetPart = b.dataset.part;
    $("pt-part").querySelectorAll("[data-part]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    note();
  });
  /* the song, its tempo and length; no start time any more */
  $("pt-send").onclick = () => shareLink({ song: { ...shareable(song), duration: songLength(song), bpm: song.bpm || 90 }, duet: { bpm: song.bpm || 90 } }, `Play ${song.title} with me (The Road)`, $("pt-send"));
  $("pt-listen").onclick = () => duet ? (duetCancel(), idle("Stopped listening.")) : listen(song);
  const idle = say => { const b = $("pt-listen"); if (b) { b.textContent = "Listen for clap"; b.classList.remove("on"); } if (say && $("pt-say")) $("pt-say").textContent = say; $("pt-start")?.classList.remove("on"); };
  async function listen(song) {
    wakeAudio();
    const b = $("pt-listen"), say = t => { if ($("pt-say")) $("pt-say").textContent = t; };
    b.textContent = "Listening · tap to stop"; b.classList.add("on"); $("pt-start").classList.add("on");
    say("Listening. Clap once, loud and sharp.");
    let stream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("none");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    } catch { idle("The microphone isn't available here, so a clap can't start it."); return; }
    const ctx = sound();
    if (!ctx || !$("pt-listen")) { stream.getTracks().forEach(t => t.stop()); return idle(); }
    const an = ctx.createAnalyser(); an.fftSize = 512;
    const src = ctx.createMediaStreamSource(stream); src.connect(an);
    const buf = new Float32Array(an.fftSize), hear = strumDetector(), t0 = performance.now();
    navigator.wakeLock?.request("screen").then(l => { if (duet) duet.lock = l; else l.release(); }).catch(() => {});
    duet = { stream, src, timer: 0, lock: null };
    duet.timer = setInterval(() => {
      an.getFloatTimeDomainData(buf);
      let rms = 0; for (const x of buf) rms += x * x; rms = Math.sqrt(rms / buf.length);
      const now = performance.now(), hit = hear(rms, now / 1000);
      if (now - t0 > CLAP_WAIT) { duetCancel(); return idle("Didn't hear a clap. Tap to listen again"); }
      if (!hit || now - t0 < CLAP_QUIET) return;
      /* the clap: both phones heard the same moment, so both count in from it */
      duetCancel(); layer.innerHTML = "";
      if (viewing !== song) return;
      window.scrollTo(0, 0);
      startScroll(song, { duet: true, part: duetPart });
      if (duetPart === "melody") paintMelody(song);
    }, 10);
  }
}
/* Melody: each sung line gets the notes that were sung for it, under the words */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function paintMelody(song) {
  const lines = [...($("sheet")?.querySelectorAll(":scope > .ly, :scope > .pr, :scope > .crow") || [])];
  lines.forEach((el, k) => {
    const n = song.sketch?.lines?.[k]?.n;
    if (!n?.length || el.querySelector(".mel-notes")) return;
    el.insertAdjacentHTML("beforeend", `<span class="mel-notes" aria-label="Melody">${n.map(([m]) => NOTE_NAMES[((m % 12) + 12) % 12]).join(" ")}</span>`);
  });
}
// The friend's side: the link adds the song (or uses the same one already here) with a tap,
// opens it, and shows Play together to pick a part and listen. An older link with a start time
// opens the same way; the time is ignored.
function duetJoin(shared) {
  const same = data.songs.find(x => x.title === shared.title && (x.artist || "") === (shared.artist || "") && x.body === shared.body
    && (x.bpm || 0) === (shared.bpm || 0) && (x.duration || 0) === (shared.duration || 0));
  layer.innerHTML = `<div class="scrim" id="pj-scrim"></div><div class="panel card pt" role="dialog" aria-label="Play together">
    <div class="pt-head">${louie("happy", { pose: "wave", size: 60 })}<div><b>Play together</b><span>${esc(shared.title)} · ${esc(shared.artist || "Unknown artist")}</span></div></div>
    <p class="pt-note">${same ? "You have this song already." : "The song is added to your library."} Then pick your part, and both phones listen for one clap.</p>
    <div class="pt-btns"><button class="btn" id="pj-no">Not now</button><button class="btn primary" id="pj-yes">Join</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("pj-scrim").onclick = close; $("pj-no").onclick = close;
  $("pj-yes").onclick = () => {
    wakeAudio(); close();
    const song = same || Tabs.addSong(data, shared);
    go("#/song/" + encodeURIComponent(song.id));
    const ready = setInterval(() => { if (viewing?.id === song.id && $("sheet")) { clearInterval(ready); duetSheet(viewing); } }, 50);
    setTimeout(() => clearInterval(ready), 5000);
  };
}
function duetCancel() {
  if (!duet) return;
  clearInterval(duet.timer);
  try { duet.src?.disconnect(); } catch { /* gone */ }
  duet.stream?.getTracks().forEach(t => t.stop());
  duet.lock?.release?.().catch(() => {});
  duet = null;
}
onLeave(() => duetCancel());
const shareSet = set => shareLink({ set: { name: set.name, songs: setSongs(set).map(shareable) } }, `${set.name} (The Road set)`, $("s-share"));

async function renderImport(code) {
  const got = await unpackShare(code);
  const full = location.origin + location.pathname + "#/import/" + code;
  /* On iPhone, a link opens in Safari, which has a separate library from the Home Screen app. */
  const inBrowser = !(navigator.standalone || matchMedia("(display-mode: standalone)").matches);
  history.replaceState(null, "", location.pathname + "#/");
  render();
  if (!got) return toast("That link didn't come through whole. Ask for it again");
  if (got.duet && got.song) return duetJoin(got.song); /* 4.29.0: with or without an old start time */
  if (got.duel) { const m = await import(`./duel.js?v=${VERSION}`); if (m.openDuelLink(got)) return; } /* Song duels (4.12.0) */
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
      ${inBrowser ? `<p class="foot pn">Use The Road from your Home Screen? It keeps its own library: <button class="linkbtn" id="im-copy">copy this link</button> and paste it into the search bar there.</p>` : ""}
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
