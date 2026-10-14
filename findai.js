// AI help for songs you don't have yet: chord charts from the web (chords only) and
// "What can I play next?". Loaded the first time either is opened.
import { Tabs, TUNINGS, buildChart, chordCounts, mergeWords } from "./core.js";
import { $, data, esc, icon, layer, toast, go, busy, AI, aiKey, askClaude, aiError, parseJSON, openLink, appleSearchURL, leaveSearch } from "./app.js";
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
{"found": boolean, "title": string, "artist": string, "key": string, "capo": number, "tuning": "standard"|"dropd"|"halfdown"|"wholedown"|"dadgad"|"openg"|"opend", "bpm": number, "strum": string, "sections": [{"name": string, "chords": string, "repeat": number}], "confidence": "high"|"medium"|"low"}
- Never include lyrics or any words from the song, not even a short phrase. Only chord names and section names.
- "sections": in the order played, each occurrence listed (Intro, Verse, Pre-Chorus, Chorus, Bridge, Solo, Outro). "chords": the chord names for one pass, space separated, like "G D Em C". "repeat": how many times that pass is played in a row.
- Use the chords most sources agree on, in the key most players use (note a capo if the common version uses one).
- "strum": a simple pattern with D and U, like "D DU UDU", or "" if unsure. "bpm": the tempo, or 0 if unsure.
- If you can't find the song, set "found" to false.`;
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
        <button class="btn primary cta" id="cs-go" style="margin-top:8px">${icon("wand")}Find the chords</button>
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
    };
    $("cs-add").onclick = () => add(c.body, "Added. Tap Listen to hear it while you check the chords");
    $("cs-words").onclick = () => wordsSheet(c.body, { title: c.title, ok: "Add to library" }, merged => add(merged, "Added with your words. Check the chord spots by ear"), () => chartSheet("", { title: c.title, artist: c.artist, chart: c }));
  };
  const findChords = async () => {
    const title = $("cs-t").value.trim(), artist = $("cs-a").value.trim();
    if (!title) return toast("Add the song title");
    state = { busy: true, chart: null, err: "" }; paint();
    try {
      const { text, sources } = await askClaudeSearch({ system: CHART_SYSTEM, content: `Song: ${title}${artist ? ` by ${artist}` : ""}` });
      const j = parseJSON(text);
      if (!j.found) throw Object.assign(new Error("not found"), { status: -2 });
      const body = buildChart(j);
      if (!body.includes("[")) throw Object.assign(new Error("empty"), { status: -1 });
      state = { busy: false, err: "", chart: { title: String(j.title || title).slice(0, 80), artist: String(j.artist || artist).slice(0, 80), key: String(j.key || "").slice(0, 4), capo: parseInt(j.capo, 10) || 0, tuning: j.tuning, bpm: +j.bpm || 0, confidence: j.confidence, body, sources } };
    } catch (e) {
      state = { busy: false, chart: null, err: e.status === -2 ? "Couldn't find reliable chords for that song. Check the spelling, or add the artist." : aiError(e) };
    }
    paint();
    if (!state.chart) { $("cs-t").value = title; $("cs-a").value = artist; }
  };
  paint();
  if (preset.title && !preset.chart) findChords();
}

// ---- Add the words ----
// Paste the lyrics (copied from wherever you can copy them); the chart's chords
// are placed over them, section by section (mergeWords in core.js). Tabs never
// supplies lyrics itself.
export function wordsSheet(chart, { title = "", ok = "Done" } = {}, done, back) {
  layer.innerHTML = `<div class="scrim" id="ws-scrim"></div><div class="panel full cs" role="dialog" aria-label="Add the words"><div class="grab"></div>
    <div class="ph"><button class="tb" id="ws-x">${back ? "Back" : "Cancel"}</button><h2>Add the words</h2><button class="tb" id="ws-ok" disabled>${esc(ok)}</button></div>
    <div class="pbody">
      <p class="foot" style="margin:0 2px 10px">Paste the lyrics${title ? ` for <b>${esc(title)}</b>` : ""}. Blank lines between verses help; names like [Chorus] help more. Tabs puts the chart's chords over them, two to a line; fix any spot in Edit.</p>
      <button class="btn" id="ws-paste" style="width:100%;margin-bottom:10px">${icon("clip")}Paste</button>
      <textarea id="ws-text" class="ws-text" rows="9" placeholder="Paste or type the lyrics here" aria-label="Lyrics" autocapitalize="sentences"></textarea>
      <div class="label" style="margin:14px 2px 6px">With the chords</div>
      <pre class="cs-chart" id="ws-prev">${esc(chart)}</pre></div></div>`;
  const ta = $("ws-text"), prev = $("ws-prev"), okb = $("ws-ok");
  let merged = null, timer = 0;
  const update = () => {
    merged = mergeWords(chart, ta.value);
    prev.textContent = merged || chart;
    okb.disabled = !merged;
  };
  ta.oninput = () => { clearTimeout(timer); timer = setTimeout(update, 250); };
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
// that use mostly those chords, with at most one new chord to learn.
const NEXT_SYSTEM = `You suggest songs a guitarist could learn next. You get the chords they already play and the songs they already have.
Reply with JSON only: {"songs": [{"title": string, "artist": string, "chords": [string], "new": string, "why": string}]}
- 6 well-known songs, varied in era and style, leaning toward the styles of the songs they have.
- Each uses mostly chords they know; "new" is at most one chord they don't know yet, or "".
- "chords": the song's main chords in the common key. "why": under 12 words, plain, no praise.
- Not songs they already have. No lyrics.`;
export async function nextSongs() {
  const known = chordCounts(data.songs).slice(0, 24);
  let state = { busy: true, list: [], err: "" };
  layer.innerHTML = `<div class="scrim" id="nx-scrim"></div><div class="panel full nx" role="dialog" aria-label="What can I play next?"><div class="grab"></div>
    <div class="ph"><button class="tb" id="nx-x">Close</button><h2>Play next</h2><span style="width:56px"></span></div><div class="pbody" id="nx-body"></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("nx-scrim").onclick = close; $("nx-x").onclick = close;
  const paint = () => {
    const body = $("nx-body");
    if (!body) return;
    if (state.busy) { body.innerHTML = `<div class="easy-wait">${busy("Looking for songs that fit your chords")}</div>`; return; }
    if (state.err) { body.innerHTML = `<p class="err">${esc(state.err)}</p><button class="btn" id="nx-again">Try again</button>`; $("nx-again").onclick = load; return; }
    body.innerHTML = `
      <p class="easy-note">You play ${known.length} chords. These songs use mostly those${state.list.some(x => x.new) ? ", plus one new chord to learn" : ""}.</p>
      <div class="list glass">${state.list.map((x, i) => `<div class="row nx-row">
        <div class="txt"><div class="t">${esc(x.title)}</div><div class="a">${esc(x.artist)}${x.why ? ` · ${esc(x.why)}` : ""}</div>
          <div class="nx-ch">${x.chords.map(c => `<span class="${c === x.new ? "new" : ""}">${esc(c)}</span>`).join("")}${x.new && !x.chords.includes(x.new) ? `<span class="new">${esc(x.new)}</span>` : ""}</div></div>
        <div class="nx-b"><button class="sb" data-nl="${i}" aria-label="Listen to ${esc(x.title)}">${icon("note")}</button><button class="btn sm primary" data-nc="${i}">Chart</button></div>
      </div>`).join("")}</div>
      <button class="btn" id="nx-more" style="margin-top:12px;width:100%">Show different songs</button>`;
    body.querySelectorAll("[data-nl]").forEach(b => b.onclick = () => openLink(appleSearchURL(state.list[+b.dataset.nl])));
    body.querySelectorAll("[data-nc]").forEach(b => b.onclick = () => { const x = state.list[+b.dataset.nc]; aiKey() ? chartSheet("", { title: x.title, artist: x.artist }) : null; });
    $("nx-more").onclick = () => load(state.list.map(x => x.title));
  };
  const load = async (skip = []) => {
    state = { busy: true, list: [], err: "" }; paint();
    try {
      const have = data.songs.map(s => `${s.title}${s.artist ? ` (${s.artist})` : ""}`).slice(0, 80).join("; ");
      const j = parseJSON(await askClaude({ system: NEXT_SYSTEM, maxTokens: 2500,
        content: `Chords I play: ${known.join(" ")}\nSongs I have: ${have}${skip.length ? `\nNot these either: ${skip.join("; ")}` : ""}` }));
      const ok = c => typeof c === "string" && /^[A-G]/.test(c) && c.length <= 8;
      state = { busy: false, err: "", list: (j.songs || []).filter(x => x && x.title).slice(0, 8).map(x => ({ title: String(x.title).slice(0, 80), artist: String(x.artist || "").slice(0, 60), chords: (x.chords || []).filter(ok).slice(0, 8), new: ok(x.new) ? x.new : "", why: String(x.why || "").slice(0, 80) })) };
    } catch (e) { state = { busy: false, list: [], err: aiError(e) }; }
    paint();
  };
  load();
}
