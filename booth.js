// The Listening booth (4.90.0): record labelled chords and switches, see what the engine heard, and send
// the takes to the repo (a `booth` branch) so the engine can be measured and tuned on real playing.
// Opened from What I hear. Takes stay on this phone (IndexedDB "tabs-booth") until sent; never in backups.
// The GitHub key is kept like the AI key: on this phone only.
import { BOOTH_MAX, BOOTH_PLACES, BOOTH_RATE, CHORD_FIT, VERSION, boothCall, boothChord, boothLabel, boothPath, boothSay, boothSummary, chromaOf, downsample, sheetChords, toBase64, wavBytes } from "./core.js";
import { $, app, esc, getMic, icon, onLeave, sound, toast } from "./ui.js";
import { data, go } from "./app.js";

export const BOOTH_KEY = "tabs.boothkey.v1"; /* the GitHub key (this repo only) */
const PREFS = "tabs.booth.v1"; /* the guitar's name and where the phone sits */
const REPO = "grahamdeno/tabs", API = `https://api.github.com/repos/${REPO}`, BRANCH = "booth";
const COMMON = ["G", "C", "D", "Em", "Am", "E", "A", "F", "Dm", "Cadd9", "Bm"];

const keyOf = () => { try { return localStorage.getItem(BOOTH_KEY) || ""; } catch { return ""; } };
const prefs = () => { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch { return {}; } };
const savePrefs = p => { try { localStorage.setItem(PREFS, JSON.stringify({ ...prefs(), ...p })); } catch { /* private mode */ } };

/* ---- takes on this phone ---- */
const db = () => new Promise((ok, bad) => {
  const r = indexedDB.open("tabs-booth", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("takes", { keyPath: "id" });
  r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error);
});
async function tx(mode, fn) {
  const d = await db();
  return new Promise((ok, bad) => { const t = d.transaction("takes", mode); const out = fn(t.objectStore("takes")); t.oncomplete = () => ok(out?.result); t.onerror = () => bad(t.error); });
}
const allTakes = () => tx("readonly", s => s.getAll()).then(r => (r || []).sort((a, b) => a.at - b.at)).catch(() => []);
const putTake = t => tx("readwrite", s => s.put(t));
const dropTake = id => tx("readwrite", s => s.delete(id));

/* the chords in your songs first, then the usual ones */
function chordList() {
  const mine = new Set();
  for (const s of data.songs || []) for (const c of sheetChords(s.body || "")) if (boothChord(c)) mine.add(c);
  return [...new Set([...mine, ...COMMON.filter(boothChord)])].slice(0, 24);
}

function guitarBand(ctx, src) {
  const a = ctx.createBiquadFilter(), b = ctx.createBiquadFilter();
  for (const f of [a, b]) { f.type = "lowpass"; f.frequency.value = 1500; f.Q.value = 0.7; }
  src.connect(a); a.connect(b);
  return b;
}

let rec = null; /* the take being recorded */
function stopRec(keep) {
  if (!rec) return;
  const r = rec; rec = null;
  clearInterval(r.timer);
  if (keep && r.recorder?.state === "recording") r.recorder.stop();
  else { r.stream.getTracks().forEach(t => t.stop()); r.src?.disconnect?.(); }
}
onLeave(() => stopRec(false));

export function renderBooth() {
  const p = prefs();
  let kind = "chord", picked = [], calls = [];
  const chords = chordList();
  app.innerHTML = `<div class="head"><button class="ib glass" id="back" aria-label="Back to What I hear">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">Listening booth</h1>
    <p class="pf-since">Record chords for tuning how the app hears you. Takes stay on this phone until you send them.</p>
    <section class="pf-card pk-lesson">
      <div class="seg mini bt-kind" role="group" aria-label="What you'll play"><button data-k="chord" class="on" aria-pressed="true">One chord</button><button data-k="switch" aria-pressed="false">Switch between two</button></div>
      <div class="ph-chords bt-chords" role="group" aria-label="Chord">${chords.map(c => `<button data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}</div>
      <p class="bt-what" id="bt-what" aria-live="polite">Pick a chord.</p>
      <canvas class="ph-lane bt-lane" id="bt-lane" aria-hidden="true"></canvas>
      <p class="rd-bubble ph-say" id="bt-say" aria-live="polite">Hold the chord and strum it every second or two, about 10 seconds. For a switch, go back and forth at your own pace.</p>
      <div class="bt-fields">
        <label class="bt-f"><span>Guitar</span><input id="bt-guitar" maxlength="30" autocomplete="off" placeholder="e.g. Martin" value="${esc(p.guitar || "")}"></label>
        <div class="bt-f"><span>Phone</span><div class="seg mini" id="bt-place" role="group" aria-label="Where the phone is">${BOOTH_PLACES.map(x => `<button data-p="${x}" class="${(p.place || "stand") === x ? "on" : ""}" aria-pressed="${(p.place || "stand") === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
        <label class="bt-f"><span>Note</span><input id="bt-note" maxlength="80" autocomplete="off" placeholder="anything odd, e.g. buzzed the B string"></label>
      </div>
    </section>
    <h2 class="ph-h">Takes on this phone</h2>
    <div class="list glass bt-takes" id="bt-takes"></div>
    <details class="bt-setup"><summary>Sending setup</summary>
      <p class="pf-since">Send puts the takes in the app's GitHub repo, on the booth branch. It needs a GitHub key that can only change this repo. The key stays on this phone.</p>
      <label class="bt-f"><span>GitHub key</span><input id="bt-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_..." value="${esc(keyOf())}" aria-label="GitHub key"></label>
    </details>
    <div class="bt-pad" aria-hidden="true"></div>
    <div class="s-dock"><button class="btn primary" id="bt-rec" disabled>${icon("mic")}Record</button><div class="ph-row"><button class="tb" id="bt-send" disabled>Send</button><button class="tb" id="bt-share" disabled>Share</button></div></div>`;
  $("back").onclick = () => go("#/practice/hear");
  const say = t => { const e = $("bt-say"); if (e) e.textContent = t; };
  const what = () => {
    const need = kind === "chord" ? 1 : 2;
    $("bt-what").textContent = picked.length < need ? (kind === "chord" ? "Pick a chord." : picked.length ? `${picked[0]} to… pick the second chord.` : "Pick two chords.") : kind === "chord" ? `Recording ${picked[0]}.` : `Recording ${picked[0]} to ${picked[1]}, back and forth.`;
    $("bt-rec").disabled = !rec && picked.length < need;
    app.querySelectorAll("[data-c]").forEach(b => { const on = picked.includes(b.dataset.c); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  };
  app.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
    if (rec) return;
    kind = b.dataset.k; picked = [];
    app.querySelectorAll("[data-k]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    what();
  });
  app.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    if (rec) return;
    const c = b.dataset.c;
    if (kind === "chord") picked = [c];
    else picked = picked.includes(c) ? picked.filter(x => x !== c) : [...picked, c].slice(-2);
    what();
  });
  app.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
    savePrefs({ place: b.dataset.p });
    app.querySelectorAll("[data-p]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  $("bt-guitar").onchange = e => savePrefs({ guitar: e.target.value.trim() });
  $("bt-key").onchange = e => { try { e.target.value.trim() ? localStorage.setItem(BOOTH_KEY, e.target.value.trim()) : localStorage.removeItem(BOOTH_KEY); } catch { /* private mode */ } };

  /* the strip: one tick per reading, newest on the right */
  const canvas = $("bt-lane"), g = canvas.getContext("2d");
  const draw = () => {
    if (!document.contains(canvas)) return;
    const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const n = Math.floor(w / 4), shown = calls.slice(-n);
    shown.forEach((c, i) => {
      const x = w - (shown.length - i) * 4;
      if (!c.call) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x, h - 6, 3, 4); return; }
      const good = c.call === "right" || c.call === picked[0];
      g.fillStyle = c.call === "wrong" ? "#ff6b5a" : good ? "#4fd68a" : "#7aa7ff";
      g.fillRect(x, 8, 3, h - 16);
    });
    if (rec) requestAnimationFrame(draw);
  };

  async function start() {
    const chordsNow = picked.slice();
    $("bt-rec").disabled = true; say("Starting the microphone…");
    let stream;
    try { sound({ mic: true }); stream = await getMic(); }
    catch { $("bt-rec").disabled = false; say("I can't use the microphone here. On iPhone: Settings, Apps, Safari, Microphone, Ask. Then try again."); return; }
    const ctx = sound();
    if (!ctx) { stream.getTracks().forEach(t => t.stop()); $("bt-rec").disabled = false; return; }
    const src = ctx.createMediaStreamSource(stream), spec = ctx.createAnalyser();
    spec.fftSize = 16384; spec.smoothingTimeConstant = 0; guitarBand(ctx, src).connect(spec);
    const lvl = ctx.createAnalyser(); lvl.fftSize = 1024; src.connect(lvl);
    const dbs = new Float32Array(spec.frequencyBinCount), tb = new Float32Array(lvl.fftSize);
    calls = [];
    const chunks = [], t0 = performance.now();
    let recorder = null;
    try {
      recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks().map(t => t.clone())));
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
      recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); src.disconnect(); finish(chunks, recorder.mimeType, (performance.now() - t0) / 1000, chordsNow, ctx); };
      recorder.start();
    } catch { stream.getTracks().forEach(t => t.stop()); $("bt-rec").disabled = false; say("This phone can't record here, so the booth can't keep a take."); return; }
    let floor = null;
    rec = { stream, src, recorder, timer: setInterval(() => {
      lvl.getFloatTimeDomainData(tb);
      let rms = 0; for (const v of tb) rms += v * v; rms = Math.sqrt(rms / tb.length);
      floor = floor === null ? rms : Math.min(rms, floor * 1.002 + 0.00001);
      if (rms > Math.max(0.004, floor * 3)) { spec.getFloatFrequencyData(dbs); calls.push(boothCall(chromaOf(dbs, ctx.sampleRate, spec.fftSize), chordsNow)); }
      else calls.push({ call: null });
      const s = boothSummary(calls, chordsNow);
      if (s.reads) say(boothSay(s, chordsNow));
      if ((performance.now() - t0) / 1000 >= BOOTH_MAX) stop();
    }, 50) };
    $("bt-rec").disabled = false; $("bt-rec").classList.add("on"); $("bt-rec").innerHTML = `<i class="pk-rec" aria-hidden="true"></i>Stop`;
    say(chordsNow.length === 1 ? `Listening for ${chordsNow[0]}. Strum it every second or two.` : `Listening. ${chordsNow[0]}, then ${chordsNow[1]}, back and forth.`);
    requestAnimationFrame(draw);
  }
  function stop() {
    const b = $("bt-rec");
    if (b) { b.classList.remove("on"); b.innerHTML = `${icon("mic")}Record`; b.disabled = true; }
    say("Saving the take…");
    stopRec(true);
  }
  async function finish(chunks, type, seconds, chordsNow, ctx) {
    const sum = boothSummary(calls, chordsNow);
    try {
      if (seconds < 2 || !chunks.length) throw new Error("short");
      const buf = await ctx.decodeAudioData(await new Blob(chunks, { type }).arrayBuffer());
      const n = buf.length, x = new Float32Array(n);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels; }
      const rate = buf.sampleRate > BOOTH_RATE ? BOOTH_RATE : buf.sampleRate;
      const wav = new Blob([wavBytes(downsample(x, buf.sampleRate, rate), rate)], { type: "audio/wav" });
      const take = { id: Math.random().toString(36).slice(2, 8), at: Date.now(), chords: chordsNow, guitar: $("bt-guitar")?.value.trim() || "", place: app.querySelector("[data-p].on")?.dataset.p || "", note: $("bt-note")?.value.trim() || "", rate, seconds, version: VERSION, heard: { ...sum, fit: CHORD_FIT }, wav };
      await putTake(take);
      if ($("bt-note")) $("bt-note").value = "";
      say(`Kept. ${boothSay(sum, chordsNow)}`);
    } catch (e) {
      say(e?.message === "short" ? "That was too short to keep. Record at least a few seconds." : "I couldn't keep that take. Try again.");
    }
    what(); paintTakes();
  }
  $("bt-rec").onclick = () => rec ? stop() : start();

  let player = null;
  async function paintTakes() {
    const list = await allTakes(), box = $("bt-takes");
    if (!box) return;
    box.innerHTML = list.length ? list.map(t => `<div class="bt-take" data-id="${esc(t.id)}">
        <button class="ib bt-play" data-play="${esc(t.id)}" aria-label="Play ${esc(t.chords.join(" to "))}">${icon("play")}</button>
        <span class="bt-tx"><b>${esc(t.chords.join(" to "))}</b><small>${Math.round(t.seconds)} s · ${esc(boothSay(t.heard || { reads: 0 }, t.chords))}</small></span>
        <button class="ib bt-del" data-del="${esc(t.id)}" aria-label="Delete ${esc(t.chords.join(" to "))} take">${icon("trash")}</button></div>`).join("")
      : `<p class="bt-none">No takes yet.</p>`;
    $("bt-send").disabled = !list.length; $("bt-send").textContent = list.length ? `Send ${list.length}` : "Send";
    $("bt-share").disabled = !list.length;
    box.querySelectorAll("[data-play]").forEach(b => b.onclick = () => {
      const t = list.find(x => x.id === b.dataset.play); if (!t) return;
      if (player) { player.pause(); URL.revokeObjectURL(player.src); }
      player = new Audio(URL.createObjectURL(t.wav)); player.play().catch(() => {});
    });
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => { await dropTake(b.dataset.del); paintTakes(); });
  }

  $("bt-send").onclick = async () => {
    const key = keyOf();
    if (!key) { app.querySelector(".bt-setup")?.setAttribute("open", ""); say("Add the GitHub key under Sending setup first."); return; }
    const list = await allTakes();
    $("bt-send").disabled = true; say(`Sending ${list.length} take${list.length === 1 ? "" : "s"}…`);
    try {
      await sendTakes(list, key, (i, n) => say(`Sending ${i} of ${n}…`));
      say(`Sent ${list.length}. Claude can measure them now.`);
    } catch (e) { say(e.message || "Sending stopped. The takes are still here; try again."); }
    paintTakes();
  };
  $("bt-share").onclick = async () => {
    const list = await allTakes();
    const files = list.flatMap(t => {
      const stem = boothPath(t).split("/").pop();
      return [new File([t.wav], `${stem}.wav`, { type: "audio/wav" }), new File([JSON.stringify(boothLabel(t), null, 1)], `${stem}.json`, { type: "application/json" })];
    });
    if (!navigator.canShare?.({ files })) { toast("Sharing files isn't available here. Use Send."); return; }
    try { await navigator.share({ files, title: "Listening booth takes" }); } catch { /* cancelled */ }
  };
  what(); paintTakes();
}

/* ---- sending: each take is a .wav and a .json on the booth branch; a sent take leaves the phone ---- */
async function gh(path, key, opt = {}) {
  let r;
  try { r = await fetch(`${API}${path}`, { ...opt, headers: { Authorization: `Bearer ${key}`, Accept: "application/vnd.github+json", ...(opt.body ? { "Content-Type": "application/json" } : {}) } }); }
  catch { throw new Error("No connection. The takes are still here; try again."); }
  if (r.status === 401) throw new Error("GitHub refused the key. Check it under Sending setup.");
  if (r.status === 403) throw new Error("The key can't write to the repo. It needs Contents: Read and write on grahamdeno/tabs.");
  return r;
}
export async function sendTakes(list, key, progress = () => {}) {
  let r = await gh(`/git/ref/heads/${BRANCH}`, key);
  if (r.status === 404) {
    const main = await gh("/git/ref/heads/main", key);
    if (!main.ok) throw new Error("The key can't see the repo. It needs access to grahamdeno/tabs.");
    const sha = (await main.json()).object.sha;
    r = await gh("/git/refs", key, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) });
    if (!r.ok) throw new Error("Couldn't make the booth branch. Try again.");
  } else if (!r.ok) throw new Error("The key can't see the repo. It needs access to grahamdeno/tabs.");
  let i = 0;
  for (const t of list) {
    progress(++i, list.length);
    const stem = boothPath(t), label = `${t.chords.join(" to ")}, ${Math.round(t.seconds)} s`;
    const wav = new Uint8Array(await t.wav.arrayBuffer());
    const put = (path, content, what) => gh(`/contents/${path}`, key, { method: "PUT", body: JSON.stringify({ message: `Booth: ${label} (${what})`, content, branch: BRANCH }) });
    const a = await put(`${stem}.wav`, toBase64(wav), "recording");
    if (!a.ok && a.status !== 422) throw new Error(`Sending stopped at ${label}. The rest are still here; try again.`);
    const b = await put(`${stem}.json`, toBase64(new TextEncoder().encode(JSON.stringify(boothLabel(t), null, 1))), "label");
    if (!b.ok && b.status !== 422) throw new Error(`Sending stopped at ${label}. The rest are still here; try again.`);
    await dropTake(t.id);
  }
}
