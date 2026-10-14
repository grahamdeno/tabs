// Tabs sets: the set page, playing a set through, covers (from the songs,
// album art or a photo) and the new-set sheet.
import { TUNINGS, Tabs, appleTrackId, firstLyric, logSetRun, playsThisWeek, rankTracks, untilLabel } from "./core.js";
import { $, app, esc, icon, layer, onLeave, toast } from "./ui.js";
import { noteError } from "./store.js";
import { applyTheme, calm, data, go, keyOf, lazy, mmss, openTuner, render, setFilter, shareSet, songLength, songTuning, viewing } from "./app.js";

// ---------- Sets ----------
onLeave(() => document.querySelectorAll(".nextup, .nextline").forEach(el => { clearInterval(+el.dataset.timer); el.remove(); }));
let setCtx = null; // { id, idx } while playing through a set
const setSetCtx = v => { setCtx = v; };
const setSongs = x => x.songIds.map(id => data.songs.find(s => s.id === id)).filter(Boolean);
const setLength = x => setSongs(x).reduce((a, s) => a + songLength(s), 0);
let setEditing = false;

// The photo framing screen loads on first use (crop.js).
function cropPhoto(file, done) { lazy("crop.js").then(m => m.cropPhoto(file, done)); }

// ---- Cover choices on the set page ----
function paintCoverOpts(set, redraw) {
  const o = $("cvopts"), cur = set.cover?.type || "songs", art = setArt(set);
  o.innerHTML = `
    <button class="cvo ${cur === "songs" ? "on" : ""}" data-cv="songs"><i>${coverSVG(setKeys(set), { name: set.name, small: true, notext: true })}</i>From songs</button>
    <button class="cvo ${cur === "art" ? "on" : ""}" data-cv="art"><i>${art.length ? `<img src="${esc(art[0])}" alt="">` : icon("note")}</i>Album art</button>
    <button class="cvo ${cur === "photo" ? "on" : ""}" data-cv="photo"><i>${coverCache[set.id] ? `<img src="${coverCache[set.id]}" alt="">` : icon("image")}</i>Photo</button>
    <button class="cvo" data-cv="camera"><i>${icon("camera")}</i>Camera</button>
    <input type="file" id="cv-file" accept="image/*" hidden><input type="file" id="cv-cam" accept="image/*" capture="environment" hidden>`;
  const pickFile = input => { input.value = ""; input.onchange = () => { const f = input.files[0]; if (f) cropPhoto(f, async (url, tint) => { await coverPut(set.id, url); set.cover = { type: "photo", tint }; Tabs.save(data); redraw(); toast("Cover updated"); }); }; input.click(); };
  o.querySelectorAll("[data-cv]").forEach(b => b.onclick = () => {
    const v = b.dataset.cv;
    if (v === "songs") { set.cover = { type: "songs" }; Tabs.save(data); redraw(); }
    else if (v === "art") {
      set.cover = { type: "art" }; Tabs.save(data);
      const missing = setSongs(set).filter(x => !songArt(x)).length;
      if (!missing) return redraw();
      b.classList.add("busy");
      fillArt(set).then(n => {
        redraw();
        const have = setArt(set).length, all = setSongs(set).length;
        toast(!have ? "No album art found. Use Listen on these songs to pick their recordings." : have < all ? `Album art for ${have} of ${all} songs. Listen on the others finds theirs.` : "Album art for every song");
      });
    }
    else if (v === "photo") { if (coverCache[set.id] && cur !== "photo") { set.cover = { ...set.cover, type: "photo" }; Tabs.save(data); return redraw(); } pickFile($("cv-file")); }
    else pickFile($("cv-cam"));
  });
}
function renderSet(id) {
  const set = data.sets.find(x => x.id === id);
  if (!set) return go("#/");
  const songs = setSongs(set);
  /* A set showing album art fills in art for songs added since. */
  if (set.cover?.type === "art" && songs.some(x => !songArt(x) && !artTried.has(x.id))) fillArt(set).then(n => { if (n && location.hash === "#/set/" + encodeURIComponent(id)) renderSet(id); });
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" id="back" aria-label="Back to sets">${icon("back")}</button>
      <div class="row-btns">
        ${songs.length && !setEditing ? `<button class="ib glass" id="s-tune" aria-label="Tuner">${icon("fork")}</button><button class="ib glass" id="s-share" aria-label="Share set">${icon("share")}</button>` : ""}
        ${songs.length ? `<button class="tb ${setEditing ? "go" : ""}" id="s-edit">${setEditing ? "Done" : "Edit"}</button>` : ""}
      </div>
    </div>
    <div class="set-hero" style="--tint:${setTint(set, 0.45)}">
      <div class="sh-big"><button class="sh-cover" id="s-cover" aria-label="Change cover">${setCover(set, { fs: 28, kicker: set.when ? fullWhen(set.when).split(" · ")[0] : "" })}${set.runs?.length ? `<span class="stamp">Played</span>` : ""}</button>
        </div><button class="sh-edc" id="s-edc">${icon("image")}Change cover</button>
      <div class="cvopts" id="cvopts" hidden></div>
      <button class="settitle" id="rename" aria-label="Set details: name, date and place"><h1 class="title">${esc(set.name)}</h1></button>
      <div class="meta">${songs.length} song${songs.length === 1 ? "" : "s"}${songs.length ? ` · about ${Math.round(setLength(set) / 60)} min` : ""}</div>
      ${set.runs?.length ? `<div class="set-played">Last played through ${esc(playedOn(set.runs[set.runs.length - 1].at))}${set.where ? ` · ${esc(set.where)}` : ""}</div>` : ""}
      ${(set.when && !(set.runs?.length && Date.parse(set.when) < Date.now())) || (set.where && !set.runs?.length) ? `<div class="set-when">${icon("calendar")}${esc([set.when && fullWhen(set.when), set.where].filter(Boolean).join(" · "))}${set.when && untilLabel(set.when) ? ` <span>· ${esc(untilLabel(set.when))}</span>` : ""}</div>` : ""}
    </div>
    ${set.runs?.length && !setEditing ? (() => { const last = set.runs[set.runs.length - 1]; return `<div class="hist">
      <div><b>${set.runs.length}</b><span>time${set.runs.length === 1 ? "" : "s"} played</span></div>
      <div><b>${mmss(last.secs)}</b><span>last run time</span></div>
      <div><b>${last.songs}/${songs.length}</b><span>songs played</span></div></div>`; })() : ""}
    ${!setEditing ? `<label class="set-note"><span class="sr">Note for this set</span><textarea id="s-note" rows="1" placeholder="${set.runs?.length ? "What did you learn this time?" : "A note for this set (optional)"}">${esc(set.note || "")}</textarea></label>` : ""}
    ${songs.length && !setEditing ? `<button class="btn primary cta" id="playset">${icon("play")}${set.runs?.length ? "Play again" : "Play set"}</button>
      <button class="stagechip ${data.settings.stage ? "on" : ""}" id="s-stagechip" role="switch" aria-checked="${!!data.settings.stage}">${icon("stage")}Stage mode <b>${data.settings.stage ? "On" : "Off"}</b></button>` : ""}
    <div class="list glass" style="margin-top:16px">
      ${songs.map((s, i) => `<div class="row setrow" data-i="${i}">
        <span class="num">${i + 1}</span>
        <button class="txt open" data-open="${i}"><div class="t">${esc(s.title)}</div><div class="a">${esc(s.artist || "Unknown artist")} · ${mmss(songLength(s))}${songTuning(s) !== "standard" ? ` · ${TUNINGS[songTuning(s)].name}` : ""}</div></button>
        ${setEditing ? `<button class="sb" data-up="${i}" aria-label="Move up" ${i === 0 ? "disabled" : ""}>${icon("up")}</button>
          <button class="sb" data-down="${i}" aria-label="Move down" ${i === songs.length - 1 ? "disabled" : ""}>${icon("down")}</button>
          <button class="sb" data-rm="${i}" aria-label="Remove from set">${icon("x")}</button>` : ""}
      </div>`).join("")}
      <button class="row newset" id="addsongs"><div class="txt"><div class="t">${icon("plus")} Add songs</div></div></button>
    </div>
    ${songs.length ? "" : `<p class="empty-hint" style="margin-top:14px">Add songs in the order you'll play them. You can reorder them anytime with Edit.</p>`}
    <button class="danger" id="delset" style="display:block;margin:22px auto 0">Delete set</button>`;
  const ids = () => setSongs(set).map(s => s.id);
  $("back").onclick = () => { setEditing = false; setFilter("sets"); go("#/"); };
  $("rename").onclick = () => setSheet(set, () => renderSet(id));
  const toggleCovers = () => { const o = $("cvopts"); if (o.hidden) { paintCoverOpts(set, () => renderSet(id)); o.hidden = false; } else o.hidden = true; };
  $("s-cover").onclick = toggleCovers; $("s-edc").onclick = toggleCovers;
  $("s-edit")?.addEventListener("click", () => { setEditing = !setEditing; renderSet(id); });
  $("s-share")?.addEventListener("click", () => shareSet(set));
  $("s-stagechip")?.addEventListener("click", () => { data.settings.stage = !data.settings.stage; Tabs.save(data); applyTheme(); renderSet(id); });
  $("s-tune")?.addEventListener("click", () => openTuner(songTuning(songs[0])));
  $("playset")?.addEventListener("click", () => playSet(set));
  const note = $("s-note");
  if (note) {
    const fit = () => { note.style.height = "auto"; note.style.height = note.scrollHeight + "px"; };
    fit();
    note.oninput = () => { fit(); clearTimeout(note.t); note.t = setTimeout(() => { const v = note.value.trim(); if (v) set.note = v; else delete set.note; Tabs.save(data); }, 400); };
    note.onblur = () => { clearTimeout(note.t); const v = note.value.trim(); if (v) set.note = v; else delete set.note; Tabs.save(data); };
  }
  app.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { if (setEditing) return; setCtx = { id, idx: +b.dataset.open }; go("#/song/" + encodeURIComponent(songs[+b.dataset.open].id)); });
  const move = (i, j) => { const a = ids(); [a[i], a[j]] = [a[j], a[i]]; set.songIds = a; Tabs.save(data); renderSet(id); };
  app.querySelectorAll("[data-up]").forEach(b => b.onclick = () => move(+b.dataset.up, +b.dataset.up - 1));
  app.querySelectorAll("[data-down]").forEach(b => b.onclick = () => move(+b.dataset.down, +b.dataset.down + 1));
  app.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const a = ids(); a.splice(+b.dataset.rm, 1); set.songIds = a; Tabs.save(data); renderSet(id); });
  $("addsongs").onclick = () => pickSongs(set, () => renderSet(id));
  $("delset").onclick = () => {
    const entry = Tabs.deleteSet(data, id);
    setEditing = false; setFilter("sets"); go("#/");
    toast(`Deleted "${set.name}"`, null, { label: "Undo", fn: () => { Tabs.restore(data, entry); render(); toast("Restored"); } });
  };
}

// Choose songs to add to a set.
// Add songs to a set. The cover at the top grows a ring for each song you pick
// (in that song's key color), and the length adds up as you go. Songs go in
// the order you tap them; tap again to take one out.
function pickSongs(set, done) {
  const pool = [...data.songs].sort((a, b) => a.title.localeCompare(b.title));
  const chosen = [];
  layer.innerHTML = `
    <div class="scrim" id="pk-scrim"></div>
    <div class="panel full pk" role="dialog" aria-label="Add songs">
      <div class="grab"></div>
      <div class="ph"><button class="tb" id="pk-cancel">Back</button><h2>Add songs</h2><button class="tb go" id="pk-add">Done</button></div>
      <div class="pbody">
        <div class="pk-top"><div class="pk-cv" id="pk-cv"></div><div class="pk-tt"><b>${esc(set.name)}</b><span id="pk-len"></span><small>Each song adds a ring in the color of its key.</small></div></div>
        <label class="cmd glass" style="height:44px;margin-bottom:12px">${icon("search")}<input id="pk-q" placeholder="Search your songs" autocomplete="off"></label>
        <div class="list glass" id="pk-list"></div>
      </div>
    </div>`;
  const all = () => [...setSongs(set), ...chosen.map(i => data.songs.find(s => s.id === i))];
  const top = () => {
    const songs = all();
    $("pk-cv").innerHTML = coverSVG(songs.map(s => s.format === "tab" ? "" : keyOf(s)), { name: set.name, small: true, notext: true });
    const secs = songs.reduce((t, s) => t + songLength(s), 0);
    $("pk-len").textContent = `${songs.length} song${songs.length === 1 ? "" : "s"}${songs.length ? ` · about ${Math.round(secs / 60)} min` : ""}`;
    $("pk-add").textContent = chosen.length ? `Add ${chosen.length}` : "Done";
  };
  const paint = () => {
    const q = $("pk-q").value.trim().toLowerCase();
    $("pk-list").innerHTML = pool.filter(s => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q)).map(s => {
      const inSet = set.songIds.includes(s.id), n = chosen.indexOf(s.id) + 1, k = s.format === "tab" ? "" : keyOf(s);
      return `<button class="row pick ${n ? "on" : ""}" data-pick="${esc(s.id)}" ${inSet ? "disabled" : ""}>
        <span class="pk-dot" style="background:${keyColor(k, s.title)}"></span>
        <div class="txt"><div class="t">${esc(s.title)}</div><div class="a">${inSet ? "Already in this set" : `${esc(s.artist || "Unknown artist")}${k ? ` · ${esc(k)}` : ""}`}</div></div>
        ${n ? `<span class="pk-n">${n}</span>` : ""}<span class="check">${n || inSet ? icon("check") : ""}</span></button>`;
    }).join("");
    $("pk-list").querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
      const i = b.dataset.pick, at = chosen.indexOf(i);
      at >= 0 ? chosen.splice(at, 1) : chosen.push(i);
      paint(); top();
    });
  };
  paint(); top();
  $("pk-q").oninput = paint;
  const close = () => { layer.innerHTML = ""; };
  $("pk-scrim").onclick = close; $("pk-cancel").onclick = close;
  $("pk-add").onclick = () => { set.songIds.push(...chosen); Tabs.save(data); close(); done(); if (chosen.length) toast(`Added ${chosen.length} song${chosen.length === 1 ? "" : "s"}`); };
}

// From a song: put it in one or more sets, or start a new one.
function addToSet(song) {
  layer.innerHTML = `
    <div class="scrim" id="as-scrim"></div>
    <div class="panel card" role="dialog" aria-label="Add to set">
      <div class="pc-head">${icon("listplus")}<span>Add "${esc(song.title)}" to a set</span></div>
      <div class="list glass" style="margin-bottom:12px">
        ${data.sets.map(x => `<button class="row pick ${x.songIds.includes(song.id) ? "on" : ""}" data-as="${esc(x.id)}">
          <div class="txt"><div class="t">${esc(x.name)}</div><div class="a">${setSongs(x).length} songs</div></div>
          <span class="check">${x.songIds.includes(song.id) ? icon("check") : ""}</span></button>`).join("")}
        <button class="row newset" id="as-new"><div class="txt"><div class="t">${icon("plus")} New set</div></div></button>
      </div>
      <div class="actions"><button class="btn primary" id="as-done">Done</button></div>
    </div>`;
  const close = () => { layer.innerHTML = ""; };
  $("as-scrim").onclick = close; $("as-done").onclick = close;
  layer.querySelectorAll("[data-as]").forEach(b => b.onclick = () => {
    const x = data.sets.find(z => z.id === b.dataset.as);
    x.songIds = x.songIds.includes(song.id) ? x.songIds.filter(i => i !== song.id) : [...x.songIds, song.id];
    Tabs.save(data); addToSet(song);
  });
  $("as-new").onclick = () => newSet(x => { if (!x.songIds.includes(song.id)) x.songIds.push(song.id); Tabs.save(data); addToSet(song); });
}

// End of a song in a set: offer the next one, playing it after 5 seconds.
function nextUp() {
  const set = setCtx && data.sets.find(x => x.id === setCtx.id);
  if (!set) return;
  const songs = setSongs(set);
  const next = songs[setCtx.idx + 1];
  document.querySelector(".nextup")?.remove();
  if (!next) {
    if (setRun?.id === set.id && setRun.played.size) {
      const run = logSetRun(set, setRun.startedAt, setRun.played.size);
      Tabs.save(data);
      setRun = null;
      toast(`Set played through · ${mmss(run.secs)}`, null, { label: "See set", fn: () => go("#/set/" + encodeURIComponent(set.id)) });
    } else toast(`End of "${set.name}"`);
    return;
  }
  const card = document.createElement("div");
  card.className = "nextup glass float";
  let left = 5;
  /* A different tuning next: don't start on its own; offer the tuner instead. */
  const retune = songTuning(next) !== songTuning(songs[setCtx.idx]) ? TUNINGS[songTuning(next)].name : "";
  card.innerHTML = `<div class="nu-t"><span class="lab">NEXT UP · ${setCtx.idx + 2} of ${songs.length}${retune ? ` · ${esc(retune.toUpperCase())}` : ""}</span><b>${esc(next.title)}</b><span>${retune ? `Retune to ${esc(retune)} first` : esc(next.artist || "")}</span></div>
    ${retune ? `<button class="btn sm" id="nu-tune">${icon("fork")}Tune</button><button class="btn sm primary" id="nu-go">Play</button>`
      : `<button class="btn sm" id="nu-stop">Stop</button><button class="btn sm primary" id="nu-go">Play <span id="nu-n">${left}</span></button>`}`;
  document.body.appendChild(card);
  const go2 = () => { clearInterval(timer); card.remove(); setCtx = { id: set.id, idx: setCtx.idx + 1, autoplay: true }; go("#/song/" + encodeURIComponent(next.id)); };
  const timer = retune ? 0 : setInterval(() => { left--; const n = $("nu-n"); if (n) n.textContent = left; if (left <= 0) go2(); }, 1000);
  $("nu-go").onclick = go2;
  $("nu-stop")?.addEventListener("click", () => { clearInterval(timer); card.remove(); });
  $("nu-tune")?.addEventListener("click", () => openTuner(songTuning(next)));
  card.dataset.timer = timer;
}

// Near the end of a song in a set, a quiet line shows how the next song starts.
function nextLine() {
  const set = setCtx && data.sets.find(x => x.id === setCtx.id);
  const next = set && setSongs(set)[setCtx.idx + 1];
  const left = document.documentElement.scrollHeight - innerHeight - scrollY;
  let el = document.querySelector(".nextline");
  if (!next || left > innerHeight * 0.5 || document.querySelector(".nextup")) { el?.remove(); return; }
  if (el) return;
  el = document.createElement("div");
  el.className = "nextline";
  const first = firstLyric(next.body);
  el.innerHTML = `<span class="lab">Next</span><b>${esc(next.title)}</b>${first ? `<span class="fl">${esc(first)}</span>` : ""}${songTuning(next) !== songTuning(viewing) ? `<span class="tn">${esc(TUNINGS[songTuning(next)].name)}</span>` : ""}`;
  document.body.appendChild(el);
}

// ---------- Set covers ----------
// Every set gets a cover drawn from what's in it: one ring per song, in a color
// for that song's key (a warm palette that sits with the copper theme), around a
// glow in the first song's color. The name sits in the title font at the bottom.
const PAL = [[20, 75, 68], [38, 70, 66], [8, 60, 62], [345, 45, 66], [280, 32, 70], [200, 38, 64], [160, 30, 62], [45, 35, 78], [28, 55, 58], [330, 35, 60], [215, 30, 70], [12, 45, 72]];
const FIFTHS = ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"];
const ENHARM = { "C#": "Db", "D#": "Eb", Gb: "F#", "G#": "Ab", "A#": "Bb", Cb: "B", "E#": "F", Fb: "E", "B#": "C" };
const hashOf = str => [...String(str)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function keyColor(k, fallback = "", a = 1) {
  const root = (/^[A-G][#b]?/.exec(k || "") || [])[0];
  const i = root ? FIFTHS.indexOf(ENHARM[root] || root) : -1;
  const [h, sat, l] = PAL[i >= 0 ? (i + 9) % 12 : hashOf(fallback) % 12];
  return `hsl(${h} ${sat}% ${l}% / ${a})`;
}
let coverSeq = 0;
// keys: the songs' keys in order. opts: { name, kicker, fs (title size in px), small }
function coverSVG(keys, opts = {}) {
  const id = "cg" + (++coverSeq), name = opts.name || "";
  const base = keyColor(keys[0], name);
  const cx = 148, cy = 58;
  const rings = keys.slice(0, 9).map((k, i) => {
    const r = 22 + i * 17, len = 2 * Math.PI * r, gap = len * (0.18 + ((hashOf(name + i) % 30) / 100));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${keyColor(k, name + i)}" stroke-opacity="${(0.88 - i * 0.06).toFixed(2)}" stroke-width="${opts.small ? 2.4 : 3.2}" stroke-linecap="round" stroke-dasharray="${(len - gap).toFixed(1)} ${gap.toFixed(1)}" transform="rotate(${(i * 47 + hashOf(name) % 90) - 90} ${cx} ${cy})"/>`;
  }).join("");
  return `<div class="cover" aria-hidden="true"><svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice"><defs><radialGradient id="${id}" cx="74%" cy="29%" r="70%"><stop offset="0" stop-color="${base}" stop-opacity=".5"/><stop offset=".6" stop-color="${base}" stop-opacity=".08"/><stop offset="1" stop-color="#0d0d0f" stop-opacity="0"/></radialGradient></defs>
    <rect width="200" height="200" fill="#121214"/><rect width="200" height="200" fill="url(#${id})"/>${rings}<circle cx="${cx}" cy="${cy}" r="4" fill="${base}"/></svg>
    ${opts.kicker ? `<div class="cv-k">${esc(opts.kicker)}</div>` : ""}${name && !opts.notext ? `<div class="cv-t" style="font-size:${opts.fs || 22}px">${esc(name)}</div>` : ""}</div>`;
}
const setKeys = set => setSongs(set).map(s => s.format === "tab" ? "" : keyOf(s));
// A set's cover: drawn from its songs (the default), its songs' album art, or a photo.
const songArt = s => s.listen?.art || s.art;
const setArt = set => setSongs(set).map(songArt).filter(a => /^https:\/\//.test(a || ""));

// ---- Album art for a set's songs ----
// A song gets its art when you pick its recording in Listen. For the others,
// once a set uses album art: songs linked to Apple Music get it from Apple by
// track number; the rest from an Apple Music search, only when the title and
// artist clearly match. Kept on the song as `art` (the cover only).
const artTried = new Set();
const big = u => String(u).replace(/\d+x\d+bb/, "600x600bb");
// Apple's public catalog (no account or key). A normal request first; Safari
// often blocks it because Apple's reply doesn't always carry the header that
// lets a web app read it. Then the same request runs the way Apple's own docs
// offer for web pages: as a script that hands back the results (JSONP).
// Failures are noted (quietly) for Settings > Copy diagnostics.
let calls = 0;
function jsonp(url, ms) {
  return new Promise((ok, fail) => {
    const cb = `tabsCatalog${++calls}`, s = document.createElement("script");
    const done = () => { clearTimeout(t); window[cb] = () => {}; s.remove(); };
    const t = setTimeout(() => { done(); fail(new Error("no answer")); }, ms);
    window[cb] = j => { done(); ok(j); };
    s.onerror = () => { done(); fail(new Error("script didn't load")); };
    s.src = `${url}&callback=${cb}`;
    document.head.append(s);
  });
}
async function itunes(path, params) {
  const url = `https://itunes.apple.com/${path}?${new URLSearchParams(params)}`;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 6000);
  let first;
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (r.ok) return await r.json();
    first = `status ${r.status}`;
  } catch (e) { first = e.name === "AbortError" ? "no answer" : e.message; } finally { clearTimeout(t); }
  try { return await jsonp(url, 9000); }
  catch (e) { noteError(new Error(`Apple catalog ${path}: ${first}; then ${e.message}`), { quiet: true, where: "apple-catalog" }); throw e; }
}
const getJSON = (path, params) => itunes(path, params).catch(() => null);
async function fillArt(set) {
  const need = setSongs(set).filter(s => !songArt(s) && !artTried.has(s.id));
  need.forEach(s => artTried.add(s.id));
  let found = 0;
  const linked = need.map(s => [s, appleTrackId(s.listen?.url || "")]).filter(([, id]) => id);
  if (linked.length) {
    const res = (await getJSON("lookup", { id: linked.map(([, id]) => id).join(","), entity: "song" }))?.results || [];
    linked.forEach(([s, id]) => { const r = res.find(x => String(x.trackId) === id && x.artworkUrl100); if (r) { s.listen = { ...s.listen, art: big(r.artworkUrl100) }; found++; } });
  }
  for (const s of need.filter(x => !songArt(x) && x.title && x.artist).slice(0, 12)) {
    const top = rankTracks((await getJSON("search", { term: `${s.title} ${s.artist}`, media: "music", entity: "song", limit: 8 }))?.results || [], s.title, s.artist)[0];
    if (top?.artworkUrl100 && top.score >= 4.5) { s.art = big(top.artworkUrl100); found++; }
  }
  if (found) Tabs.save(data);
  return found;
}
function setCover(set, opts = {}) {
  const type = set.cover?.type;
  if (type === "photo" && coverCache[set.id]) return `<div class="cover"><img src="${coverCache[set.id]}" alt=""></div>`;
  if (type === "art") {
    const art = setArt(set);
    if (art.length >= 4) return `<div class="cover mosaic">${art.slice(0, 4).map(a => `<img src="${esc(a)}" alt="" loading="lazy">`).join("")}</div>`;
    if (art.length) return `<div class="cover"><img src="${esc(art[0])}" alt="" loading="lazy"></div>`;
  }
  return coverSVG(setKeys(set), { name: set.name, ...opts });
}
// The page tint for a set: the photo's own color, or its first song's key color.
const setTint = (set, a = 0.5) => set.cover?.type === "photo" && set.cover.tint ? `hsl(${set.cover.tint} / ${a})` : keyColor(setKeys(set)[0], set.name, a);

// Cover photos live in IndexedDB (they're too big for the main save), keyed by set id,
// and are loaded into memory at start so covers draw without waiting.
const coverCache = {};
const coverDB = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-covers", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("covers");
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function coverTx(mode, fn) {
  const db = await coverDB();
  return new Promise((ok, bad) => { const tx = db.transaction("covers", mode); const out = fn(tx.objectStore("covers")); tx.oncomplete = () => ok(out?.result ?? out); tx.onerror = () => bad(tx.error); });
}
const coverPut = (id, url) => { coverCache[id] = url; return coverTx("readwrite", st => st.put(url, id)).catch(() => {}); };
const coverDel = id => { delete coverCache[id]; return coverTx("readwrite", st => st.delete(id)).catch(() => {}); };
async function coverLoadAll() {
  try {
    const db = await coverDB();
    await new Promise(ok => { const st = db.transaction("covers").objectStore("covers"); const c = st.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return ok(); coverCache[cur.key] = cur.value; cur.continue(); }; c.onerror = ok; });
  } catch {}
}
// "Fri 8:00 PM" within the week, "Oct 17 · 8:00 PM" further out.
function whenText(when, withDay = true) {
  const d = new Date(when);
  if (isNaN(d)) return "";
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const soon = Math.abs(d - Date.now()) < 6 * 864e5;
  const day = soon ? d.toLocaleDateString([], { weekday: "short" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
  return withDay ? `${day} ${time}` : time;
}
const playedOn = t => new Date(t).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
const fullWhen = when => { const d = new Date(when); return isNaN(d) ? "" : `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; };
// Playing a whole set: a short title card first (the cover, the name, what's first),
// then the first song starts. Tap to skip it. The run is timed for the set's history.
let setRun = null; /* { id, startedAt, played: Set of song ids } */
function playSet(set) {
  const songs = setSongs(set);
  if (!songs.length) return go("#/set/" + encodeURIComponent(set.id));
  setRun = { id: set.id, startedAt: Date.now(), played: new Set() };
  const start = () => { setCtx = { id: set.id, idx: 0, autoplay: true }; go("#/song/" + encodeURIComponent(songs[0].id)); };
  const when = set.when && Date.parse(set.when);
  const today = when && new Date(when).toDateString() === new Date().toDateString();
  const kicker = today ? (new Date().getHours() >= 17 ? "Tonight's set" : "Today's set") : set.runs?.length ? "Playing again" : "Your set";
  const first = songs[0], fk = first.format === "tab" ? "" : keyOf(first);
  const card = document.createElement("div");
  card.className = "titlecard";
  card.style.setProperty("--tint", setTint(set, 0.55));
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", `${set.name}. First up: ${first.title}`);
  card.innerHTML = `<div class="tc-cv">${setCover(set, { fs: 30 })}</div>
    <div class="tc-k">${esc(kicker)}</div><h2>${esc(set.name)}</h2>
    <div class="tc-m">${songs.length} song${songs.length === 1 ? "" : "s"} · about ${Math.round(setLength(set) / 60)} min${set.where ? ` · ${esc(set.where)}` : ""}</div>
    <div class="tc-first">First up: <b>${esc(first.title)}</b>${fk ? ` · Key of ${esc(fk)}` : ""}</div>
    <div class="tc-bar"><i></i></div><div class="tc-skip">Tap to start now</div>`;
  document.body.appendChild(card);
  const ms = calm() ? 1200 : 2600;
  card.querySelector(".tc-bar i").style.animationDuration = ms + "ms";
  let gone = false;
  const go3 = () => { if (gone) return; gone = true; clearTimeout(t); card.classList.add("out"); setTimeout(() => card.remove(), 300); start(); };
  const t = setTimeout(go3, ms);
  card.onclick = go3;
}

// ---------- New set (and set details) ----------
// One calm sheet: the cover takes shape as you type the name. When and Where are
// optional; a date makes the set show up as "Up next" on the library. "Start from"
// fills the set from a group of songs you already have.
function setSheet(existing, done) {
  const starts = [
    ["empty", "Empty set", []],
    ["fav", "Favorites", data.songs.filter(s => s.favorite)],
    ["learn", "Learning", data.songs.filter(s => s.status === "learning")],
    ["week", "Played this week", data.songs.filter(s => playsThisWeek(s))]
  ].filter(x => x[0] === "empty" || x[2].length);
  let start = "empty";
  layer.innerHTML = `
    <div class="scrim" id="ns-scrim"></div>
    <div class="panel full ns" role="dialog" aria-label="${existing ? "Set details" : "New set"}">
      <div class="grab"></div>
      <div class="ns-head"><button class="tb" id="ns-cancel">Cancel</button><b>${existing ? "Set details" : "New set"}</b><button class="tb go" id="ns-ok">${existing ? "Save" : "Next"}</button></div>
      <div class="ns-body">
        <div class="ns-cover" id="ns-cover"></div>
        <p class="ns-cap">${existing ? "The cover is drawn from the name and the songs in the set." : "Your cover starts with the name. Songs add to it."}</p>
        <label class="ns-f"><input id="ns-name" value="${esc(existing?.name || "")}" placeholder="Name this set" autocomplete="off" aria-label="Set name"></label>
        <label class="ns-f"><span>When</span><input id="ns-when" type="datetime-local" value="${esc(existing?.when || "")}" aria-label="When"><button class="ns-x" id="ns-noday" ${existing?.when ? "" : "hidden"} aria-label="Clear date">${icon("x")}</button></label>
        <label class="ns-f"><span>Where</span><input id="ns-where" value="${esc(existing?.where || "")}" placeholder="Optional" autocomplete="off" aria-label="Where"></label>
        ${existing ? "" : `<div class="ns-lab">Start from</div><div class="ns-chips">${starts.map(([k, l, list]) => `<button class="chip ${k === start ? "on" : ""}" data-st="${k}">${l}${list.length ? ` <span class="n">${list.length}</span>` : ""}</button>`).join("")}</div>`}
      </div>
    </div>`;
  const keysNow = () => existing ? setKeys(existing) : (starts.find(x => x[0] === start)[2]).map(s => keyOf(s));
  const paint = () => {
    const name = $("ns-name").value.trim() || "New set";
    const w = $("ns-when").value;
    $("ns-cover").innerHTML = coverSVG(keysNow(), { name, fs: 26, kicker: w ? fullWhen(w).split(" · ")[0] : "" });
    $("ns-noday").hidden = !w;
  };
  const close = () => { layer.innerHTML = ""; };
  $("ns-scrim").onclick = close; $("ns-cancel").onclick = close;
  $("ns-name").oninput = paint; $("ns-when").oninput = paint; $("ns-when").onchange = paint;
  $("ns-noday").onclick = e => { e.preventDefault(); $("ns-when").value = ""; paint(); };
  layer.querySelectorAll("[data-st]").forEach(b => b.onclick = () => {
    start = b.dataset.st;
    layer.querySelectorAll("[data-st]").forEach(x => x.classList.toggle("on", x === b));
    paint();
  });
  $("ns-ok").onclick = () => {
    const name = $("ns-name").value.trim();
    if (!name) { toast("Give the set a name"); $("ns-name").focus(); return; }
    const when = $("ns-when").value, where = $("ns-where").value.trim();
    const set = existing || Tabs.addSet(data, name);
    set.name = name;
    if (when) set.when = when; else delete set.when;
    if (where) set.where = where; else delete set.where;
    if (!existing) set.songIds = (starts.find(x => x[0] === start)[2]).map(s => s.id);
    Tabs.save(data);
    close();
    done?.(set, !existing && !set.songIds.length);
  };
  paint();
  if (!existing) setTimeout(() => $("ns-name")?.focus(), 350);
}
// New set from anywhere: create it, open it, and go straight to adding songs if it's empty.
function newSet(after) {
  setSheet(null, (set, empty) => {
    if (after) return after(set);
    go("#/set/" + encodeURIComponent(set.id));
    if (empty) setTimeout(() => pickSongs(set, () => renderSet(set.id)), 450);
  });
}

export { itunes, addToSet, coverPut, setSetCtx, coverCache, coverDel, coverLoadAll, fullWhen, keyColor, newSet, nextLine, nextUp, playSet, renderSet, setCover, setCtx, setKeys, setLength, setRun, setSongs, whenText };
