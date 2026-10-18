// AI help for songs you don't have yet: chord charts from the web (chords only) and
// "What can I play next?". Loaded the first time either is opened.
import { Tabs, TUNINGS, buildChart, chordCounts, changesOf, mergeWords, pickVersions, tempoPick, beatsOf, playerLevel, cleanGroove } from "./core.js";
import { oneHandMQ } from "./ui.js";
import { $, data, esc, icon, layer, toast, go, busy, AI, aiKey, askClaude, aiError, parseJSON, openLink, appleSearchURL, leaveSearch, bpmKey, aiLastStop, grooveFor } from "./app.js";
// Ask with web search turned on: Claude searches (up to `searches` times) and answers.
// Returns { text, sources: [{ url, title }] }. Long searches may pause; we carry on.
async function askClaudeSearch({ model = AI.vision, system, content, maxTokens = 6000, searches = 4, key = aiKey() }) {
  const messages = [{ role: "user", content }];
  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: searches }];
  let out = [];
  for (let turn = 0; turn < 4; turn++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, tools, messages })
      });
    } catch { throw Object.assign(new Error("network"), { status: 0, model }); }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw Object.assign(new Error(j?.error?.message || "HTTP " + r.status), { status: r.status, model });
    }
    const j = await r.json();
    out = out.concat(j.content || []);
    if (j.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: j.content });
  }
  const text = out.filter(c => c.type === "text").map(c => c.text).join("");
  const seen = new Map();
  for (const c of out) {
    if (c.type === "web_search_tool_result" && Array.isArray(c.content)) c.content.forEach(x => x.url && !seen.has(x.url) && seen.set(x.url, x.title || x.url));
    for (const ci of c.citations || []) if (ci.url) seen.set(ci.url, ci.title || ci.url);
  }
  return { text, sources: [...seen].map(([url, title]) => ({ url, title })).filter(x => /^https:\/\//.test(x.url)) };
}

const CHART_SYSTEM = `You find how to play one song on guitar, using web search (chord and tab sites, songbooks), and reply with JSON only, no other text:
{"found": boolean, "title": string, "artist": string, "album": string, "duration": number, "key": string, "capo": number, "tuning": "standard"|"dropd"|"halfdown"|"wholedown"|"dadgad"|"openg"|"opend", "bpm": number, "strum": string, "sections": [{"name": string, "chords": string, "repeat": number}], "confidence": "high"|"medium"|"low"}
- Never include lyrics or any words from the song, not even a short phrase. Only chord names and section names.
- "sections": in the order played, each occurrence listed (Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Outro). "chords": the chord names for one pass, space separated, like "G D Em C". "repeat": how many times that pass is played in a row.
- "key": the key the song sounds in. "capo": use one when the recording, or the common way to play it, does; 0 otherwise.
- "strum": one bar of the rhythm in eighth notes, with D (down), U (up), x (a muted strum) and - (a held beat), like "D-DU-UDU" or "DxUxDxUx". If the song is fingerpicked, "Fingerpicked: " and the pattern in a few words. "" if unsure. "bpm": the tempo, or 0 if unsure.
- "album": the studio album (or single) the song first came out on, or "". "duration": that recording's length in seconds, or 0 if unsure.
- If you can't find the song, set "found" to false.`;
// How hard a chart is, picked on Get the song: the easy version most sites
// show, the player's own level with a small stretch, or the record as played.
const CHART_LEVELS = [["easy", "Easy"], ["mine", "My level"], ["rec", "As recorded"]];
const CHART_LEVEL = {
  easy: `- Level: easy. The simplest common version: open chords, a capo where it keeps the shapes open, and easy stand-ins for hard chords (for example Fmaj7 or a small F for F). A plain strum.`,
  mine: `- Level: the player's own, with a small stretch. Keep the song in chords they play wherever the recording allows. Where the recording uses a barre chord (F, Bm, B, F#m, C#m, Gm), use it instead of an easy stand-in. At most two chords they don't play yet. The strum as the recording has it, with its muted strums and pushes.`,
  rec: `- Level: as recorded. The chords the recording actually uses, barre chords, sevenths, sus, add9 and slash chords included, in the key it sounds in. The rhythm as played.`
};
const chartLevel = () => CHART_LEVEL[data.settings.chartLevel] ? data.settings.chartLevel : "mine";
// One AI chord chart: chords and section names only, plus the facts that help
// find the right recording (album, length). Throws status -2 when not found.
async function findChart(title, artist, level = "easy") {
  const p = playerLevel(data.songs);
  const me = level === "mine" ? `\nChords I play: ${p.plays.join(" ") || "a few open chords"}${p.learning.length ? `\nChords I'm learning: ${p.learning.join(" ")}` : ""}${p.work.length ? `\nChanges I'm working on: ${p.work.join(", ")}` : ""}` : "";
  const { text, sources } = await askClaudeSearch({ system: `${CHART_SYSTEM}\n${CHART_LEVEL[level] || CHART_LEVEL.easy}`, content: `Song: ${title}${artist ? ` by ${artist}` : ""}${me}` });
  const j = parseJSON(text);
  if (!j.found) throw Object.assign(new Error("not found"), { status: -2 });
  const body = buildChart(j);
  if (!body.includes("[")) throw Object.assign(new Error("empty"), { status: -1 });
  return { title: String(j.title || title).slice(0, 80), artist: String(j.artist || artist).slice(0, 80), album: String(j.album || "").slice(0, 80), duration: Math.max(0, Math.min(1800, +j.duration || 0)),
    key: String(j.key || "").slice(0, 4), capo: parseInt(j.capo, 10) || 0, tuning: j.tuning, bpm: +j.bpm || 0, confidence: j.confidence, body, sources };
}
export function chartSheet(q, preset = {}) {
  const [t0, a0] = preset.title ? [preset.title, preset.artist || ""] : q.split(/\s+(?:by|-|–)\s+/i);
  let state = { busy: false, chart: preset.chart || null, err: "" };
  layer.innerHTML = `<div class="scrim" id="cs-scrim"></div><div class="panel full cs" role="dialog" aria-label="Chord chart with AI"><div class="grab"></div>
    <div class="ph"><button class="tb" id="cs-x">Cancel</button><h2>Chord chart</h2><span style="width:56px"></span></div><div class="pbody" id="cs-body"></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("cs-scrim").onclick = close; $("cs-x").onclick = close;
  const paint = () => {
    const c = state.chart, body = $("cs-body");
    if (!body) return;
    if (state.busy) { body.innerHTML = `<div class="easy-wait">${busy("Searching the web for the chords")}</div><p class="foot">This takes about 20 seconds. Only the title and artist are sent.</p>`; return; }
    if (!c) {
      body.innerHTML = `
        <label class="ns-f"><input id="cs-t" value="${esc(t0 || "")}" placeholder="Song title" aria-label="Song title"></label>
        <label class="ns-f"><input id="cs-a" value="${esc(a0 || "")}" placeholder="Artist (helps find the right one)" aria-label="Artist"></label>
        ${state.err ? `<p class="err" style="margin:6px 2px">${esc(state.err)}</p>` : ""}
        <button class="btn primary cta cs-act" id="cs-go" style="margin-top:8px">${icon("wand")}Find the chords</button>
        <p class="foot" style="margin-top:12px">AI searches chord sites and writes a chart: sections, chords, key, capo, tempo and strum. It never copies lyrics. Charts can be wrong, so check it by ear. Each chart uses a few web searches on your key, usually 5 to 15 cents.</p>`;
      $("cs-go").onclick = findChords;
      return;
    }
    const tn = TUNINGS[c.tuning] ? c.tuning : "standard";
    body.innerHTML = `
      <div class="cs-head"><b>${esc(c.title)}</b><span>${esc(c.artist || "")}</span></div>
      <div class="cs-meta">${[c.key && `Key ${esc(c.key)}`, c.capo > 0 && `Capo ${c.capo}`, tn !== "standard" && TUNINGS[tn].name, c.bpm > 0 && `${Math.round(c.bpm)} BPM`].filter(Boolean).map(x => `<span>${x}</span>`).join("")}${c.confidence ? `<span class="cs-conf ${esc(c.confidence)}">${c.confidence === "high" ? "Sources agree" : c.confidence === "medium" ? "Mostly agree" : "Rough guess"}</span>` : ""}</div>
      <pre class="cs-chart">${esc(c.body)}</pre>
      <p class="foot">AI-made from the sources below. Check it by ear, and fix anything in Edit.</p>
      ${c.sources.length ? `<div class="cs-src">${c.sources.slice(0, 4).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${icon("link")}${esc(x.title.slice(0, 60))}</a>`).join("")}</div>` : ""}
      <button class="btn cta cs-words" id="cs-words">${icon("edit")}Add the words</button>
      <div class="actions" style="margin-top:10px"><button class="btn" id="cs-again">Try again</button><button class="btn primary" id="cs-add">Add to library</button></div>`;
    $("cs-again").onclick = () => { state.chart = null; paint(); };
    const add = (body, note) => {
      const s = Tabs.addSong(data, { title: c.title, artist: c.artist || "", key: c.key || "", format: "chords", body,
        ...(c.bpm > 0 ? { bpm: Math.round(Math.min(260, Math.max(30, c.bpm))) } : {}), ...(tn !== "standard" ? { tuning: tn } : {}), ai: "chart" });
      close();
      leaveSearch();
      go("#/song/" + encodeURIComponent(s.id));
      toast(note);
      grooveFor(s); /* how it feels, in the background */
    };
    $("cs-add").onclick = () => add(c.body, "Added. Tap Listen to hear it while you check the chords");
    $("cs-words").onclick = () => wordsSheet(c.body, { title: c.title, ok: "Add to library" }, merged => add(merged, "Added with your words. Check the chord spots by ear"), () => chartSheet("", { title: c.title, artist: c.artist, chart: c }));
  };
  const findChords = async () => {
    const title = $("cs-t").value.trim(), artist = $("cs-a").value.trim();
    if (!title) return toast("Add the song title");
    state = { busy: true, chart: null, err: "" }; paint();
    try {
      state = { busy: false, err: "", chart: await findChart(title, artist) };
    } catch (e) {
      state = { busy: false, chart: null, err: e.status === -2 ? "Couldn't find reliable chords for that song. Check the spelling, or add the artist." : aiError(e) };
    }
    paint();
    if (!state.chart) { $("cs-t").value = title; $("cs-a").value = artist; }
  };
  paint();
  if (preset.title && !preset.chart) findChords();
}

// ---- Get the song ----
// One tap from a search miss: the AI chart (chords and section names only),
// the words from LRCLIB and, with a GetSongBPM key, the measured tempo and
// time signature, all at once. Tabs puts the chords over the words here on the
// phone (mergeWords) and shows one review before saving.
const LRC = "https://lrclib.net/api";
const wait = ms => new Promise(r => setTimeout(r, ms));
// GET JSON, waiting and trying again when the service is busy (429) or the
// network drops. 404 means "none" (null).
async function getJSON(url, tries = 3) {
  for (let i = 0; ; i++) {
    let r;
    try { r = await fetch(url, { cache: "no-store" }); }
    catch (e) { if (i + 1 < tries) { await wait(1200); continue; } throw Object.assign(e, { status: 0 }); }
    if (r.status === 404) return null;
    if (r.status === 429 && i + 1 < tries) { await wait(Math.min(4000, 1000 * (parseFloat(r.headers.get("retry-after")) || 1.5))); continue; }
    if (!r.ok) throw Object.assign(new Error("HTTP " + r.status), { status: r.status });
    return r.json();
  }
}
const mmssOf = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const same = (p, q) => { const n = v => String(v || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/&/g, "and").replace(/[^a-z0-9]+/g, ""); return n(p) && n(q) && (n(p).includes(n(q)) || n(q).includes(n(p))); };
// Words: the free-text search started at once, then (once the chart names the
// song) an exact lookup by title, artist, album and length if that found none.
async function lrcVersions(early, c) {
  let list = (await early.catch(() => null)) || [];
  let out = pickVersions(list, c);
  if (!out.length) {
    const q = `track_name=${encodeURIComponent(c.title)}&artist_name=${encodeURIComponent(c.artist)}`;
    const one = await getJSON(`${LRC}/get?${q}${c.album ? `&album_name=${encodeURIComponent(c.album)}` : ""}${c.duration ? `&duration=${Math.round(c.duration)}` : ""}`).catch(() => null);
    list = [...(one ? [one] : []), ...((await getJSON(`${LRC}/search?${q}`).catch(() => null)) || [])];
    out = pickVersions(list, c);
  }
  return out;
}
// Tempo and time signature from GetSongBPM (key in the URL: a header would
// need a preflight that the service refuses).
async function bpmLookup(c, key) {
  const url = lookup => `https://api.getsong.co/search/?api_key=${encodeURIComponent(key)}&type=${lookup.includes("artist:") ? "both" : "song"}&lookup=${encodeURIComponent(lookup)}`;
  const find = j => (Array.isArray(j?.search) ? j.search : []).find(x => same(x.title, c.title) && (!c.artist || same(x.artist?.name, c.artist)));
  let hit = find(await getJSON(url(`song:${c.title} artist:${c.artist}`), 2));
  if (!hit) hit = find(await getJSON(url(c.title), 2));
  return hit ? { tempo: +hit.tempo || 0, sig: String(hit.time_sig || ""), id: hit.id } : null;
}
export function getSong(q, preset = {}) {
  const title0 = (preset.title || q || "").trim(), artist0 = (preset.artist || "").trim();
  const key = bpmKey();
  /* Play next's Add brings its own level and doesn't change the saved pick. */
  const level = CHART_LEVEL[preset.level] ? preset.level : chartLevel();
  const st = { view: "work", rows: { words: "busy", tempo: key ? "wait" : "", chart: "busy", merge: "wait" }, chart: null, versions: [], vi: 0, tempo: null, beats: 4, err: "", note: { words: "Looking", tempo: "", chart: "Listening" } };
  let alive = true;
  const close = () => { alive = false; layer.innerHTML = ""; };
  const mount = () => {
    layer.innerHTML = `<div class="scrim" id="gs-scrim"></div><div class="panel full cs gs" role="dialog" aria-label="Get the song"><div class="grab"></div>
      <div class="ph"><button class="tb" id="gs-x">Cancel</button><h2>Get the song</h2><span style="width:56px"></span></div><div class="pbody" id="gs-body"></div></div>`;
    $("gs-scrim").onclick = close; $("gs-x").onclick = close;
    paint();
  };
  /* The level switch: a plate with a lamp on the pick. Picking another level
     saves it and works the chords out again. */
  const levelPlate = () => `<div class="seg" id="gs-level" role="group" aria-label="How hard">${CHART_LEVELS.map(([k, n]) => `<button data-lv="${k}" class="${level === k ? "on" : ""}" aria-pressed="${level === k}"><i class="nx-lamp" aria-hidden="true"></i>${n}</button>`).join("")}</div>`;
  const bindLevel = () => document.querySelectorAll("#gs-level [data-lv]").forEach(b => b.onclick = () => {
    if (b.dataset.lv === level) return;
    data.settings.chartLevel = b.dataset.lv; Tabs.save(data);
    close(); getSong(q, { ...preset, level: b.dataset.lv });
  });
  const version = () => st.versions[st.vi] || null;
  const merged = () => version() ? mergeWords(st.chart.body, version().plainLyrics) : null;
  /* a jewel lamp per step, like a channel strip: dark while waiting,
     warming while working, lit when done. Said in a musician's words, not the
     names of the services behind them. */
  const ROW = { ok: `<i class="gs-lamp on"></i>`, busy: `<i class="gs-lamp warm"></i>`, wait: `<i class="gs-lamp"></i>`, none: `<i class="gs-lamp"></i>` };
  const add = (body, lrc = true) => {
    const c = st.chart, v = version(), t = st.tempo, tn = TUNINGS[c.tuning] ? c.tuning : "standard";
    const len = Math.round(v?.duration || c.duration || 0);
    const s = Tabs.addSong(data, { title: c.title, artist: c.artist || "", key: c.key || "", format: "chords", body,
      ...(t?.bpm > 0 ? { bpm: Math.round(Math.min(260, Math.max(30, t.bpm))) } : {}), ...(st.beats !== 4 ? { beats: st.beats } : {}),
      ...(len >= 60 ? { duration: len, recLength: len } : {}), ...(tn !== "standard" ? { tuning: tn } : {}), ai: "chart",
      ...(lrc && v && body !== c.body ? { words: { src: "lrclib", id: v.id } } : {}) });
    close(); leaveSearch();
    go("#/song/" + encodeURIComponent(s.id));
    grooveFor(s); /* how it feels, in the background */
    toast(body === c.body ? "Added. Tap Listen to hear it while you check the chords" : "Added with the words. Check the chord spots by ear");
  };
  const paint = () => {
    const body = $("gs-body");
    if (!body || !alive) return;
    const c = st.chart;
    if (st.view === "error") {
      body.innerHTML = `<div class="cs-head"><b>${esc(title0)}</b><span>${esc(artist0)}</span></div><p class="err" style="margin:10px 2px">${esc(st.err)}</p>
        <div class="actions"><button class="btn" id="gs-own">Find it yourself</button><button class="btn primary" id="gs-again">Try again</button></div>`;
      $("gs-own").onclick = close; $("gs-again").onclick = () => { close(); getSong(q, preset); };
      return;
    }
    if (st.view === "work") {
      const r = st.rows;
      const row = (k, label) => r[k] ? `<div class="gs-row">${ROW[r[k]]}<span class="${r[k] === "wait" ? "muted" : ""}">${label}</span><span class="gs-src">${esc(st.note[k] || "")}</span></div>` : "";
      body.innerHTML = `<div class="cs-head"><b>${esc(c?.title || title0)}</b><span>${esc(c?.artist || artist0)}</span></div>
        ${levelPlate()}
        <div class="gs-rows glass">${row("words", "Finding the lyrics")}${row("tempo", "Finding the tempo")}${row("chart", "Working out the chords")}${row("merge", "Lining the chords up with the lyrics")}</div>
        <p class="foot" style="margin-top:12px">Only the song's name${level === "mine" ? " and the chords you play are" : " is"} sent. Working out the chords takes about 20 seconds and costs a few cents on your AI key.</p>`;
      bindLevel();
      return;
    }
    if (st.view === "versions") {
      body.innerHTML = `<div class="gs-vh"><b>Which recording?</b><span>Words and timing differ between versions.</span></div>
        ${st.versions.slice(0, 8).map((v, i) => `<button class="gs-ver${i === st.vi ? " on" : ""}" data-v="${i}"><i></i><span><b>${esc(v.albumName || v.trackName)}</b><small>${mmssOf(v.duration || 0)}${v.syncedLyrics ? " · timed" : ""}</small></span></button>`).join("")}
        <button class="gs-ver" id="gs-paste"><i></i><span><b>None of these: paste the words</b></span></button>`;
      body.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { st.vi = +b.dataset.v; st.view = "review"; paint(); });
      $("gs-paste").onclick = () => wordsSheet(c.body, { title: c.title, ok: "Add to library" }, b => add(b, false), mount);
      return;
    }
    const v = version(), m = merged(), t = st.tempo, tn = TUNINGS[c.tuning] ? c.tuning : "standard";
    const tempoChip = t?.bpm > 0 ? `<span class="${t.agree ? "agree" : ""}">${t.bpm} BPM${t.agree ? ` ${icon("check")}` : ""}${!t.agree && t.measured && t.chart ? ` <small>· chart said ${Math.round(t.chart)}</small>` : ""}</span>` : "";
    body.innerHTML = `
      <div class="cs-head"><b>${esc(c.title)}</b><span>${esc(c.artist || "")}</span></div>
      ${levelPlate()}
      ${v ? `<button class="gs-pick" id="gs-pick">${esc(v.albumName || "Single")} · ${mmssOf(v.duration || 0)}${st.versions.length > 1 ? ` ${icon("chev")}` : ""}</button>` : `<p class="gs-pick none">No lyrics found</p>`}
      <div class="cs-meta">${[c.key && `<span>Key ${esc(c.key)}</span>`, `<span>${c.capo > 0 ? `Capo ${c.capo}` : "No capo"}</span>`, tn !== "standard" && `<span>${TUNINGS[tn].name}</span>`, tempoChip, st.sig && `<span>${esc(st.sig)}</span>`].filter(Boolean).join("")}${c.confidence ? `<span class="cs-conf ${esc(c.confidence)}">${c.confidence === "high" ? "Sources agree" : c.confidence === "medium" ? "Mostly agree" : "Rough guess"}</span>` : ""}</div>
      <pre class="cs-chart gs-chart">${esc(m || c.body)}</pre>
      <p class="foot">${m ? "Check the chord spots by ear. Edit fixes any line." : "Paste the words, or add the chords alone."}</p>
      <div class="cs-src">${c.sources.slice(0, 3).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${icon("link")}${esc(x.title.slice(0, 60))}</a>`).join("")}
        ${v ? `<a href="https://lrclib.net" target="_blank" rel="noopener">${icon("link")}Lyrics from LRCLIB</a>` : ""}${t?.measured ? `<a href="https://getsongbpm.com" target="_blank" rel="noopener">${icon("link")}Tempo data by GetSongBPM.com</a>` : ""}</div>
      <div class="actions" style="margin-top:12px"><button class="btn" id="gs-edit">${m ? "Edit" : "Paste the words"}</button><button class="btn primary" id="gs-add">Add to library</button></div>`;
    $("gs-pick")?.addEventListener("click", () => { if (st.versions.length > 1) { st.view = "versions"; paint(); } });
    $("gs-edit").onclick = () => wordsSheet(c.body, { title: c.title, ok: "Add to library", text: m ? v.plainLyrics : "" }, b => add(b, !!m), mount);
    $("gs-add").onclick = () => add(m || c.body);
    bindLevel();
  };
  mount();
  const run = async () => {
    const early = getJSON(`${LRC}/search?q=${encodeURIComponent(`${title0} ${artist0}`.trim())}`);
    early.then(l => { if (st.rows.words === "busy" && !(l || []).length) st.note.words = "Still looking"; paint(); }, () => {});
    try { st.chart = await findChart(title0, artist0, level); }
    catch (e) {
      if (!alive) return;
      st.view = "error"; st.err = e.status === -2 ? "Couldn't find reliable chords for that song. Check the spelling, or add the artist." : aiError(e);
      return paint();
    }
    if (!alive) return;
    const c = st.chart;
    st.rows.chart = "ok"; st.note.chart = c.key ? `Key ${c.key}` : "Done"; paint();
    const words = lrcVersions(early, c).then(list => { st.versions = list; st.rows.words = list.length ? "ok" : "none"; st.note.words = list.length ? "Found" : "None found"; paint(); }, () => { st.rows.words = "none"; st.note.words = "Busy, try later"; paint(); });
    let measured = null;
    const tempo = key ? (st.rows.tempo = "busy", paint(), bpmLookup(c, key).then(r => { measured = st.mt = r; st.rows.tempo = r ? "ok" : "none"; st.note.tempo = r ? `${Math.round(r.tempo)} BPM${r.sig ? ` · ${r.sig}` : ""}` : "Not found"; }, e => { st.rows.tempo = "none"; st.note.tempo = e.status === 401 ? "Check the tempo key in Settings" : "Busy, try later"; })) : Promise.resolve();
    await Promise.all([words, tempo]);
    if (!alive) return;
    st.tempo = tempoPick(c.bpm, measured?.tempo || 0);
    if (measured?.sig) { st.sig = measured.sig; st.beats = beatsOf(measured.sig); }
    st.rows.merge = st.versions.length ? "ok" : "none"; st.note.merge = st.versions.length ? "Done" : "No lyrics to line up"; paint();
    await wait(450);
    if (!alive) return;
    st.view = "review"; paint();
  };
  run();
}

// ---- Add the words ----
// Paste the lyrics (copied from wherever you can copy them); the chart's chords
// are placed over them, section by section (mergeWords in core.js). Tabs never
// supplies lyrics itself.
export function wordsSheet(chart, { title = "", ok = "Done", text = "" } = {}, done, back) {
  layer.innerHTML = `<div class="scrim" id="ws-scrim"></div><div class="panel full cs" role="dialog" aria-label="Add the words"><div class="grab"></div>
    <div class="ph"><button class="tb" id="ws-x">${back ? "Back" : "Cancel"}</button><h2>Add the words</h2>${oneHandMQ.matches ? '<span style="width:56px"></span>' : `<button class="tb" id="ws-ok" disabled>${esc(ok)}</button>`}</div>
    <div class="pbody">
      <p class="foot" style="margin:0 2px 10px">Paste the lyrics${title ? ` for <b>${esc(title)}</b>` : ""}. Blank lines between verses help; names like [Chorus] help more. Tabs puts the chart's chords over them, two to a line; fix any spot in Edit.</p>
      <button class="btn" id="ws-paste" style="width:100%;margin-bottom:10px">${icon("clip")}Paste</button>
      <textarea id="ws-text" class="ws-text" rows="9" placeholder="Paste or type the lyrics here" aria-label="Lyrics" autocapitalize="sentences"></textarea>
      <div class="label" style="margin:14px 2px 6px">With the chords</div>
      <pre class="cs-chart" id="ws-prev">${esc(chart)}</pre></div>
    ${oneHandMQ.matches ? `<div class="pfoot"><button class="btn primary" id="ws-ok" disabled>${esc(ok)}</button></div>` : ""}</div>`;
  const ta = $("ws-text"), prev = $("ws-prev"), okb = $("ws-ok");
  let merged = null, timer = 0;
  const update = () => {
    merged = mergeWords(chart, ta.value);
    prev.textContent = merged || chart;
    okb.disabled = !merged;
  };
  ta.oninput = () => { clearTimeout(timer); timer = setTimeout(update, 250); };
  if (text) { ta.value = text; update(); }
  const leave = () => (back ? back() : (layer.innerHTML = ""));
  $("ws-scrim").onclick = leave; $("ws-x").onclick = leave;
  $("ws-paste").onclick = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { /* not allowed: paste into the box */ }
    if (!text.trim()) { ta.focus(); return toast("Press and hold in the box, then tap Paste"); }
    ta.value = text; update();
  };
  okb.onclick = () => { update(); if (!merged) return; layer.innerHTML = ""; done(merged); };
}

// ---- What can I play next? ----
// Sends only the chords you know and your song titles; suggests well-known songs
// that use mostly those chords. "My level" adds at most one new chord; "A step
// up" asks for songs a little harder than the ones you have: up to two
// new chords or a trickier change or rhythm. The choice is remembered.
const NEXT_SYSTEM = `You suggest songs a guitarist could learn next. You get the chords they already play and the songs they already have.
Reply with JSON only, no other text and no code fences: {"songs": [{"title": string, "artist": string, "chords": [string], "new": [string], "why": string}]}
- 6 well-known songs, varied in era and style, leaning toward the styles of the songs they have.
- "chords": the song's main chords in the common key. "new": the chords in it they don't play yet.
- Not songs they already have, and not songs listed as already suggested. Skip the picks that top every beginner list unless one fits unusually well; include some less expected songs.
- No lyrics.`;
const NEXT_LEVEL = {
  same: `- Their level: each song uses mostly chords they know; "new" has at most one chord.
- "why": under 12 words, plain, no praise.`,
  step: `- A real step up (2.13.1): every song must clearly stretch them past the hardest songs they have. Each brings at least two of these: two or three chords they don't play, including a full barre chord (F, Bm, B, C#m, F#m) or a seventh or extended chord; fast or frequent chord changes; a riff, lead line or single-note intro; fingerpicking or a syncopated or muted strum. Learnable in a week or two of practice. No beginner songs.
- "why": under 12 words, plain, no praise, naming what makes it harder (for example "Barre chords F and Bm, plus a picked intro").`
};
const SEEN = "tabs.nextseen.v1";
function nextSeen(add = []) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(SEEN) || "[]"); } catch {}
  if (!Array.isArray(list)) list = [];
  if (add.length) {
    list = [...add, ...list.filter(t => !add.includes(t))].slice(0, 60);
    try { localStorage.setItem(SEEN, JSON.stringify(list)); } catch {}
  }
  return list.filter(t => typeof t === "string").slice(0, 60);
}
export async function nextSongs() {
  const known = chordCounts(data.songs).slice(0, 24);
  const level = () => data.settings.nextLevel === "step" ? "step" : "same";
  let state = { busy: true, list: [], err: "" };
  const foot = oneHandMQ.matches;
  layer.innerHTML = `<div class="scrim" id="nx-scrim"></div><div class="panel full nx" role="dialog" aria-label="What can I play next?"><div class="grab"></div>
    <div class="ph"><button class="tb" id="nx-x">Close</button><h2>Play next</h2><span style="width:56px"></span></div><div class="pbody" id="nx-body"></div>${foot ? `<div class="pfoot" id="nx-foot"></div>` : ""}</div>`;
  const close = () => { layer.innerHTML = ""; };
  $("nx-scrim").onclick = close; $("nx-x").onclick = close;
  const controls = () => `<div class="nx-ctl">
      <div class="seg" id="nx-level" role="group" aria-label="Difficulty">${[["same", "My level"], ["step", "A step up"]].map(([k, n]) => `<button data-lv="${k}" class="${level() === k ? "on" : ""}" aria-pressed="${level() === k}"${state.busy ? " disabled" : ""}><i class="nx-lamp" aria-hidden="true"></i>${n}</button>`).join("")}</div>
      ${state.busy ? "" : state.err ? `<button class="btn primary" id="nx-again">Try again</button>` : `<button class="btn" id="nx-more">Show different songs</button>`}</div>`;
  const bindControls = () => {
    document.querySelectorAll("#nx-level [data-lv]").forEach(b => b.onclick = () => {
      if (b.dataset.lv === level()) return;
      data.settings.nextLevel = b.dataset.lv; Tabs.save(data); load();
    });
    const more = $("nx-more"), again = $("nx-again");
    if (more) more.onclick = () => load(state.list.map(x => x.title));
    if (again) again.onclick = () => load(state.skip);
  };
  const paint = () => {
    const body = $("nx-body");
    if (!body) return;
    if (foot) $("nx-foot").innerHTML = controls();
    const tail = foot ? "" : controls();
    if (state.busy) {
      /* the amp warms up: a jewel lamp glows while the AI works. */
      body.innerHTML = `<div class="easy-wait nx-warm" role="status"><i class="nx-jewel" aria-hidden="true"></i><span>${level() === "step" ? "Warming up: songs a step up from yours" : "Warming up: songs that fit your chords"}</span></div>${tail}`;
      const was = state;
      setTimeout(() => { const w = body.querySelector(".easy-wait"); if (state === was && w) w.lastChild.textContent = " Still looking, this can take a few more seconds"; }, 9000);
    }
    else if (state.err) body.innerHTML = `<div class="nx-err" role="alert">${icon("wand")}<b>No suggestions this time</b><p>${esc(state.err)}</p>
        ${state.raw ? `<details><summary>What came back</summary><pre>${esc(state.raw)}</pre></details>` : ""}</div>${tail}`;
    else {
      const anyNew = state.list.some(x => x.new.length);
      const note = level() === "step"
        ? `A step up from your songs: barre chords, faster changes, riffs or picking.`
        : `You play ${known.length} chords. These songs use mostly those${anyNew ? ", plus one new chord to learn" : ""}.`;
      body.innerHTML = `
      <p class="easy-note">${note}</p>
      <div class="list glass">${state.list.map((x, i) => `<div class="row nx-row">
        <div class="txt"><div class="t">${esc(x.title)}</div><div class="a">${esc(x.artist)}</div>${x.why ? `<div class="nx-why">${esc(x.why)}</div>` : ""}
          <div class="nx-ch">${x.chords.map(c => `<span class="${x.new.includes(c) ? "new" : ""}">${esc(c)}</span>`).join("")}${x.new.filter(c => !x.chords.includes(c)).map(c => `<span class="new">${esc(c)}</span>`).join("")}</div></div>
        <div class="nx-b"><button class="sb" data-nl="${i}" aria-label="Listen to ${esc(x.title)}">${icon("note")}</button><button class="btn sm primary nx-add" data-nc="${i}" aria-label="Add ${esc(x.title)}: get its chord chart">Add</button></div>
      </div>`).join("")}</div>${tail}`;
      body.querySelectorAll("[data-nl]").forEach(b => b.onclick = () => openLink(appleSearchURL(state.list[+b.dataset.nl])));
      body.querySelectorAll("[data-nc]").forEach(b => b.onclick = () => { const x = state.list[+b.dataset.nc]; aiKey() ? getSong("", { title: x.title, artist: x.artist, level: level() === "step" ? "rec" : "mine" }) : null; });
    }
    bindControls();
  };
  const load = async (skip = []) => {
    const lv = level();
    state = { busy: true, list: [], err: "", skip }; paint();
    try {
      const have = data.songs.map(s => `${s.title}${s.artist ? ` (${s.artist})` : ""}`).slice(0, 60).join("; ");
      // Songs already shown (last 60, kept on this phone) go along so the list
      // moves on instead of repeating, with a fresh number to vary the picks.
      const seen = nextSeen().filter(t => !skip.includes(t)).slice(0, 30);
      const work = changesOf(data.songs).work.map(c => `${c.a} to ${c.b}`);
      /* Streamed: the reply arrives as it's written, so iPhone keeps the
         connection open; and after 45 s with nothing, say so instead of waiting on. */
      const ask = () => Promise.race([askClaude({ stream: true, system: `${NEXT_SYSTEM}\n${NEXT_LEVEL[lv]}`, maxTokens: 8000, /* room to think first */
        content: `Chords I play: ${known.join(" ")}\nSongs I have: ${have}${skip.length ? `\nNot these either: ${skip.join("; ")}` : ""}${seen.length ? `\nAlready suggested: ${seen.join("; ")}` : ""}${work.length ? `\nChanges I'm working on: ${work.join(", ")}. Include them where they fit.` : ""}\nVariety number: ${Math.floor(Math.random() * 10000)}` }),
        new Promise((_, no) => setTimeout(() => no(Object.assign(new Error("slow"), { status: -2 })), 45000))]);
      // An unreadable reply is usually a one-off, so ask once more before saying so.
      let j;
      try { j = parseJSON(await ask()); } catch (e) { if (e.status !== -1 || lv !== level()) throw e; j = parseJSON(await ask()); }
      if (lv !== level()) return; // switched while this was loading
      const ok = c => typeof c === "string" && /^[A-G]/.test(c) && c.length <= 8;
      const max = lv === "step" ? 3 : 1;
      state = { busy: false, err: "", skip, list: (j.songs || []).filter(x => x && x.title).slice(0, 8).map(x => ({ title: String(x.title).slice(0, 80), artist: String(x.artist || "").slice(0, 60), chords: (x.chords || []).filter(ok).slice(0, 8), new: [].concat(x.new || []).filter(ok).slice(0, max), why: String(x.why || "").slice(0, 80) })) };
      nextSeen(state.list.map(x => x.title));
      if (!state.list.length) state = { busy: false, list: [], skip, err: "No songs came back that time. Try again, or switch levels." };
    } catch (e) {
      if (lv !== level()) return;
      state = { busy: false, list: [], skip, err: e.status === -2 ? "No answer after 45 seconds. Check the connection and try again." : e.status === -1 ? "The reply came back in a form Tabs couldn't read, twice in a row. Try again, or switch levels." : aiError(e), raw: e.raw || (e.status === -1 ? `(No text came back. The AI stopped with: ${aiLastStop() || "no reason given"}.)` : "") };
    }
    paint();
  };
  load();
}

// The tempo of a song in the library that has none, for the metronome: the
// measured tempo from GetSongBPM when there's a key for it, otherwise Claude's
// best knowledge of the recording. { bpm, beats } or null.
export async function findTempo(song) {
  if (!song?.title) return null;
  const key = bpmKey();
  if (key) {
    const r = await bpmLookup({ title: song.title, artist: song.artist || "" }, key).catch(() => null);
    if (r?.tempo > 0) return { bpm: r.tempo, beats: beatsOf(r.sig) };
  }
  if (!aiKey()) return null;
  const text = await askClaude({ maxTokens: 200,
    system: 'You know the tempos of recorded songs. Reply with JSON only: {"bpm": number or null, "beats": beats per bar}. Use the tempo of the best-known recording, counted the way a drummer would count it. Use null when you are not reasonably sure.',
    content: `${song.title}${song.artist ? ` by ${song.artist}` : ""}` }).catch(() => "");
  const j = parseJSON(text);
  return +j?.bpm > 0 ? { bpm: +j.bpm, beats: beatsOf(j.beats) } : null;
}

// How a song feels for the drums and the bass: { beat, swing, bass, src: "ai" }
// or null. Musical facts only, never lyrics. Claude searches when it isn't
// sure and leaves a part out when it still isn't.
const GROOVE_SYSTEM = `You describe how one recorded song feels, so a practice drummer and bass player can play along. Search the web if you are not sure. Reply with JSON only, no other text:
{"beat": "rock"|"half"|"ballad"|"four"|null, "swing": "straight"|"light"|"full"|null, "bass": "root"|"fifth"|"pulse"|"walk"|null}
- "beat": rock is kick on 1 and 3 with snare on 2 and 4; half is a half-time feel (snare only on 3, a slow heavy pulse even at a fast tempo); ballad is quiet, a side-stick on 2 and 4; four is a kick on every beat (disco, dance, four on the floor).
- "swing": straight, light (a loose, slightly swung feel) or full (a shuffle or triplet feel, as in blues and swing).
- "bass": root is one long note per chord; fifth is root and fifth (country, folk, waltz); pulse is steady eighth notes (rock, pop); walk is a walking line (blues, jazz, shuffle).
- Use null for any part you are not reasonably sure of. Never include lyrics or any words from the song.`;
export async function findGroove(song) {
  if (!song?.title || !aiKey()) return null;
  const { text } = await askClaudeSearch({ system: GROOVE_SYSTEM, maxTokens: 500, searches: 2,
    content: `${song.title}${song.artist ? ` by ${song.artist}` : ""}${song.bpm ? `. Tempo on file: ${song.bpm} BPM` : ""}` }).catch(() => ({ text: "" }));
  const g = cleanGroove(parseJSON(text), "ai");
  return g && (g.beat || g.swing || g.bass) ? g : null;
}
