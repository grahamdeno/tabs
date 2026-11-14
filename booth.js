// The Listening booth (4.90.0): record labelled chords and switches, see what the engine heard, and send
// the takes to the repo (a `booth` branch) so the engine can be measured and tuned on real playing.
// 4.92.0: a guided session. It walks the list one take at a time (BOOTH_PLAN in core/booth.js): what to play
// and where the phone goes, Start, a count-in, recording that stops by itself, then Keep or Try again, and
// each kept take is sent in the background. It remembers where you stopped. "Record your own" is still there.
// Opened from What I hear. Takes stay on this phone (IndexedDB "tabs-booth") until sent; never in backups.
// The GitHub key is kept like the AI key: on this phone only.
import { BOOTH_AMPS, BOOTH_BODIES, BOOTH_LISTS, BOOTH_MAX, BOOTH_PLACES, BOOTH_STRUMS, boothAmpLine, boothGuitar, boothState, voicingShape, BOOTH_RATE, CHORD_FIT, VERSION, boothCall, boothChord, boothLabel, boothNext, boothPath, boothSay, boothSetup, boothSetupKey, boothChange, boothSteps, boothSummary, boothVerdict, chromaOf, downsample, sheetChords, toBase64, wavBytes } from "./core.js";
import { $, app, esc, getMic, haptic, icon, onLeave, sound, toast } from "./ui.js";
import { chordSVG, data, go } from "./app.js";

export const BOOTH_KEY = "tabs.boothkey.v1"; /* the GitHub key (this repo only) */
const PREFS = "tabs.booth.v1"; /* the guitar's name, where the phone sits, and the guided steps done */
const REPO = "grahamdeno/tabs", API = `https://api.github.com/repos/${REPO}`, BRANCH = "booth";
const COMMON = ["G", "C", "D", "Em", "Am", "E", "A", "F", "Dm", "Cadd9", "Bm"];
const COUNT = 3; /* the count-in, in seconds */

const keyOf = () => { try { return localStorage.getItem(BOOTH_KEY) || ""; } catch { return ""; } };
const prefs = () => { try { return boothState(JSON.parse(localStorage.getItem(PREFS))); } catch { return boothState({}); } };
const guitarNow = () => { const p = prefs(); return p.guitars.find(g => g.name === p.guitar) || null; };
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

/* ---- one take: the microphone, an optional count-in, the readings every 50 ms, the recording ----
   on.count(n) during the count-in; on.tick(calls, seconds) while recording; on.done(take) or on.fail(why). */
let rec = null;
function stopRec(keep) {
  if (!rec) return;
  const r = rec; rec = null;
  clearInterval(r.timer); clearTimeout(r.countT);
  if (keep && r.recorder?.state === "recording") r.recorder.stop();
  else { r.stream?.getTracks().forEach(t => t.stop()); r.src?.disconnect?.(); r.on?.cancel?.(); }
}
onLeave(() => stopRec(false));
async function recordTake({ chords, seconds = BOOTH_MAX, count = 0, meta = {} }, on) {
  let stream;
  try { sound({ mic: true }); stream = await getMic(); }
  catch { on.fail("I can't use the microphone here. On iPhone: Settings, Apps, Safari, Microphone, Ask. Then try again."); return; }
  const ctx = sound();
  if (!ctx) { stream.getTracks().forEach(t => t.stop()); on.fail("The phone's audio isn't available right now. Try again."); return; }
  const src = ctx.createMediaStreamSource(stream), spec = ctx.createAnalyser();
  spec.fftSize = 16384; spec.smoothingTimeConstant = 0; guitarBand(ctx, src).connect(spec);
  const lvl = ctx.createAnalyser(); lvl.fftSize = 1024; src.connect(lvl);
  const dbs = new Float32Array(spec.frequencyBinCount), tb = new Float32Array(lvl.fftSize), calls = [], chunks = [];
  const r = rec = { stream, src, on, recorder: null, timer: 0, countT: 0 };
  let n = count;
  const begin = () => {
    if (rec !== r) return;
    let recorder;
    try {
      recorder = r.recorder = new MediaRecorder(new MediaStream(stream.getAudioTracks().map(t => t.clone())));
      recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    } catch { stopRec(false); on.fail("This phone can't record here, so the booth can't keep a take."); return; }
    const t0 = performance.now();
    recorder.onstop = () => { stream.getTracks().forEach(t => t.stop()); src.disconnect(); keepTake(chunks, recorder.mimeType, (performance.now() - t0) / 1000, chords, ctx, calls, meta).then(on.done, e => on.fail(e.message)); };
    recorder.start();
    let floor = null;
    r.timer = setInterval(() => {
      lvl.getFloatTimeDomainData(tb);
      let rms = 0; for (const v of tb) rms += v * v; rms = Math.sqrt(rms / tb.length);
      floor = floor === null ? rms : Math.min(rms, floor * 1.002 + 0.00001);
      if (rms > Math.max(0.004, floor * 3)) { spec.getFloatFrequencyData(dbs); calls.push(boothCall(chromaOf(dbs, ctx.sampleRate, spec.fftSize), chords)); }
      else calls.push({ call: null });
      const t = (performance.now() - t0) / 1000;
      on.tick?.(calls, t);
      if (t >= seconds) stopRec(true);
    }, 50);
  };
  const countDown = () => {
    if (rec !== r) return;
    if (n <= 0) { haptic(2); begin(); return; }
    on.count?.(n); haptic(1); n--;
    r.countT = setTimeout(countDown, 1000);
  };
  countDown();
}
/* the recording, decoded, as a 16-bit mono WAV at 22,050 Hz, with its label; saved on the phone */
async function keepTake(chunks, type, seconds, chords, ctx, calls, meta) {
  if (seconds < 2 || !chunks.length) throw new Error("That was too short to keep. Record at least a few seconds.");
  let buf;
  try { buf = await ctx.decodeAudioData(await new Blob(chunks, { type }).arrayBuffer()); }
  catch { throw new Error("I couldn't keep that take. Try again."); }
  const n = buf.length, x = new Float32Array(n);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) x[i] += d[i] / buf.numberOfChannels; }
  const rate = buf.sampleRate > BOOTH_RATE ? BOOTH_RATE : buf.sampleRate;
  const wav = new Blob([wavBytes(downsample(x, buf.sampleRate, rate), rate)], { type: "audio/wav" });
  const sum = boothSummary(calls, chords);
  const g = guitarNow();
  const take = { id: Math.random().toString(36).slice(2, 8), at: Date.now(), chords, player: prefs().player || "", guitar: g?.name || "", body: g?.body || "", amp: g?.body === "electric" ? g.amp : "", list: meta.list || "", ...(meta.voicing ? { voicing: meta.voicing } : {}), place: meta.place || prefs().place || "", strum: meta.strum || prefs().strum || "pick", note: meta.note || "", rate, seconds, version: VERSION, heard: { ...sum, fit: CHORD_FIT }, wav };
  await putTake(take);
  return take;
}

/* ---- sending in the background: one send at a time ---- */
let sending = null, sendSay = () => {}, afterSend = () => {};
function sendAll() {
  if (sending) return sending;
  const key = keyOf();
  if (!key) return Promise.resolve({ sent: 0, error: "nokey" });
  sending = (async () => {
    const list = await allTakes();
    if (!list.length) return { sent: 0 };
    try { await sendTakes(list, key, (i, n) => sendSay(`Sending ${i} of ${n}…`)); return { sent: list.length }; }
    catch (e) { return { sent: 0, error: e.message }; }
  })().finally(() => { sending = null; });
  return sending;
}

export function renderBooth(mode = prefs().mode || "guided") {
  stopRec(false);
  savePrefs({ mode });
  app.innerHTML = `<div class="head"><button class="ib glass" id="back" aria-label="Back to What I hear">${icon("back")}</button></div>
    <h1 class="title script" style="margin:14px 2px 2px">Listening booth</h1>
    <p class="pf-since">Record chords so the app learns to hear you. I'll tell you what to play, one take at a time.</p>
    <div class="seg mini bt-mode" role="group" aria-label="How to record"><button data-mode="guided" class="${mode === "guided" ? "on" : ""}" aria-pressed="${mode === "guided"}">Guided</button><button data-mode="free" class="${mode === "free" ? "on" : ""}" aria-pressed="${mode === "free"}">Record your own</button></div>
    <div id="bt-body"></div>
    <p class="bt-sendline" id="bt-sendline" aria-live="polite"></p>
    <details class="bt-setup" ${keyOf() ? "" : "open"}><summary>Sending setup</summary>
      <p class="pf-since">Takes go to the app's GitHub repo, on the booth branch, as you go. It needs a GitHub key that can only change this repo. The key stays on this phone.</p>
      <label class="bt-f"><span>GitHub key</span><input id="bt-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_..." value="${esc(keyOf())}" aria-label="GitHub key"></label>
    </details>
    <div class="bt-pad" aria-hidden="true"></div>
    <div class="s-dock" id="bt-dock"></div>`;
  $("back").onclick = () => go("#/practice/hear");
  app.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => { if (!rec) renderBooth(b.dataset.mode); });
  $("bt-key").onchange = e => { try { e.target.value.trim() ? localStorage.setItem(BOOTH_KEY, e.target.value.trim()) : localStorage.removeItem(BOOTH_KEY); } catch { /* private mode */ } paintSend(true); };
  sendSay = t => { const e = $("bt-sendline"); if (e) e.innerHTML = t; };
  afterSend = () => {};
  paintSend(false);
  (mode === "guided" ? guided : free)();
}

/* the line under the session: what's sent and what's waiting, with Send now when something is stuck */
async function paintSend(tryNow) {
  const left = (await allTakes()).length;
  if (tryNow && left && keyOf()) { sendSay(`Sending ${left}…`); const r = await sendAll(); return paintAfter(r); }
  if (!left) return sendSay(keyOf() ? "Everything you've kept is sent." : "Add your GitHub key under Sending setup, and takes send as you go.");
  sendSay(keyOf() ? `${left} take${left === 1 ? "" : "s"} waiting to send. <button class="tb" id="bt-sendnow">Send now</button>` : `${left} take${left === 1 ? "" : "s"} kept on this phone. Add your GitHub key under Sending setup to send them.`);
  $("bt-sendnow")?.addEventListener("click", () => paintSend(true));
}
async function paintAfter(r) {
  afterSend();
  if (!r.error) { const left = (await allTakes()).length; return sendSay(left ? `${left} waiting to send.` : `Sent${r.sent ? ` ${r.sent}` : ""}. Everything you've kept is in the repo.`); }
  if (r.error === "nokey") return paintSend(false);
  sendSay(`${esc(r.error)} <button class="tb" id="bt-sendnow">Send now</button>`);
  $("bt-sendnow")?.addEventListener("click", () => paintSend(true));
}
async function sendQuietly() {
  if (!keyOf()) return paintSend(false);
  sendSay("Sending…");
  paintAfter(await sendAll());
}

/* ---- Guided ---- */
const listDone = (p, list) => { const ids = new Set(BOOTH_LISTS[list].plan.map(x => x.id)); return (p.done[p.guitar] || []).filter(x => ids.has(x)).length; };
function guided() {
  const body = $("bt-body"), dock = $("bt-dock");
  const done = () => { const p = prefs(); return p.done[p.guitar] || []; };
  const mark = id => { const p = prefs(); savePrefs({ done: { ...p.done, [p.guitar]: [...new Set([...(p.done[p.guitar] || []), id])] } }); };
  /* the guitar in hand and the list, above the take: Change guitar, and Main list or More chords with how far each is */
  const top = () => {
    const p = prefs(), g = guitarNow();
    return `<div class="bt-gbar"><span class="bt-gname">${icon("note")}<span><b>${esc(g.name)}</b><small>${p.player ? `${esc(p.player)} · ` : ""}${g.body === "electric" ? `Electric, ${g.amp}` : "Acoustic"}</small></span></span><button class="tb" id="bt-gchange">Change guitar</button></div>
      <div class="seg mini bt-lists" role="group" aria-label="Which list">${Object.entries(BOOTH_LISTS).map(([k, l]) => `<button data-list="${k}" class="${p.list === k ? "on" : ""}" aria-pressed="${p.list === k}">${l.name} · ${listDone(p, k)}/${l.plan.length}</button>`).join("")}</div>`;
  };
  const bindTop = () => {
    $("bt-gchange").onclick = () => { if (!rec) pickGuitar(); };
    body.querySelectorAll("[data-list]").forEach(b => b.onclick = () => { if (!rec) { savePrefs({ list: b.dataset.list }); show(); } });
  };
  /* which guitar: the ones you've used, or a new one (acoustic or electric; an electric unplugged or through a clean amp) */
  const pickGuitar = () => {
    const p = prefs();
    let bodyKind = "acoustic", amp = "unplugged";
    body.innerHTML = `<section class="pf-card bt-card bt-guitars">
      <p class="bt-big" role="heading" aria-level="2">${p.guitars.length ? "Which guitar?" : "Which guitar first?"}</p>
      <p class="bt-dir">Each guitar goes through the lists on its own. Different guitars and players help the app hear everyone.</p>
      <label class="bt-f bt-player"><span>Player</span><input id="bt-player" maxlength="30" autocomplete="off" autocapitalize="words" placeholder="First name or nickname" value="${esc(p.player || "")}"></label>
      ${p.guitars.length ? `<div class="bt-glist">${p.guitars.map(g => `<button class="bt-gpick${g.name === p.guitar ? " on" : ""}" data-g="${esc(g.name)}"><b>${esc(g.name)}</b><small>${g.body === "electric" ? `Electric, ${g.amp}` : "Acoustic"} · ${listDone({ ...p, guitar: g.name }, "main")}/${BOOTH_LISTS.main.plan.length} main, ${listDone({ ...p, guitar: g.name }, "more")}/${BOOTH_LISTS.more.plan.length} more</small></button>`).join("")}</div><p class="bt-step">Or add one</p>` : ""}
      <div class="bt-fields">
        <label class="bt-f"><span>Name</span><input id="bt-gnew" maxlength="40" autocomplete="off" placeholder="e.g. Martin D-28"></label>
        <div class="bt-f"><span>Kind</span><div class="seg mini" role="group" aria-label="Acoustic or electric">${BOOTH_BODIES.map(x => `<button data-body="${x}" class="${x === bodyKind ? "on" : ""}" aria-pressed="${x === bodyKind}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
        <div class="bt-f" id="bt-ampf" hidden><span>Heard</span><div class="seg mini" role="group" aria-label="Unplugged or through a clean amp">${BOOTH_AMPS.map(x => `<button data-amp="${x}" class="${x === amp ? "on" : ""}" aria-pressed="${x === amp}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
        <p class="bt-sub" id="bt-ampnote" hidden>Through an amp: clean only, no distortion or effects.</p>
      </div>
    </section>`;
    dock.innerHTML = `<button class="btn primary" id="bt-gadd">Add this guitar</button>${p.guitars.length ? `<div class="ph-row"><button class="tb" id="bt-gback">Back</button></div>` : ""}`;
    $("bt-player").onchange = e => savePrefs({ player: e.target.value.trim().slice(0, 30) });
    body.querySelectorAll("[data-g]").forEach(b => b.onclick = () => { savePrefs({ guitar: b.dataset.g, player: $("bt-player").value.trim().slice(0, 30) }); show(); });
    body.querySelectorAll("[data-body]").forEach(b => b.onclick = () => {
      bodyKind = b.dataset.body;
      body.querySelectorAll("[data-body]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      $("bt-ampf").hidden = $("bt-ampnote").hidden = bodyKind !== "electric";
    });
    body.querySelectorAll("[data-amp]").forEach(b => b.onclick = () => { amp = b.dataset.amp; body.querySelectorAll("[data-amp]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); });
    $("bt-gadd").onclick = () => {
      const name = $("bt-gnew").value.trim();
      if (!name) { $("bt-gnew").focus(); toast("Give the guitar a name first"); return; }
      const st = boothGuitar(prefs(), { name, body: bodyKind, amp });
      savePrefs({ guitars: st.guitars, guitar: st.guitar, player: $("bt-player").value.trim().slice(0, 30) }); /* the setup screen then says to pick it up */
      show();
    };
    $("bt-gback")?.addEventListener("click", show);
  };
  const show = () => {
    const p = prefs();
    if (!guitarNow()) return pickGuitar();
    const plan = BOOTH_LISTS[p.list].plan, n = boothNext(done(), plan), s = n.step, g = guitarNow();
    if (!s) {
      const other = p.list === "main" ? "more" : "main", otherLeft = BOOTH_LISTS[other].plan.length - listDone(p, other);
      body.innerHTML = `${top()}<section class="pf-card bt-card"><div class="bt-prog"><i style="width:100%"></i></div><p class="bt-big" role="heading" aria-level="2">All done</p><p class="bt-dir">That's the ${esc(BOOTH_LISTS[p.list].name.toLowerCase())} on ${esc(g.name)}, ${plan.length} takes.${otherLeft ? ` ${esc(BOOTH_LISTS[other].name)} has ${otherLeft} to go on this guitar.` : ""} When the line below says everything is sent, Claude can measure them.</p></section>`;
      dock.innerHTML = `${otherLeft ? `<button class="btn primary" id="bt-other">Go to ${esc(BOOTH_LISTS[other].name)}</button>` : `<button class="btn primary" id="bt-anothe">Another guitar</button>`}<div class="ph-row">${otherLeft ? `<button class="tb" id="bt-anothe">Another guitar</button>` : ""}<button class="tb" id="bt-again">Start this list again</button></div>`;
      $("bt-other")?.addEventListener("click", () => { savePrefs({ list: other }); show(); });
      $("bt-anothe").onclick = pickGuitar;
      $("bt-again").onclick = () => { const q = prefs(), ids = new Set(plan.map(x => x.id)); savePrefs({ done: { ...q.done, [q.guitar]: (q.done[q.guitar] || []).filter(x => !ids.has(x)) } }); show(); };
      bindTop();
      return;
    }
    const what = s.chords.length === 1 ? `${s.chords[0]} chord${s.voicing ? `, ${s.voicing.at}` : ""}` : `${s.chords[0]} to ${s.chords[1]}`;
    /* 4.93.1: a change of setup (the guitar, where the phone is, pick or thumb) gets its own screen, so it can't be missed */
    const key = `${g.name}|${boothSetupKey(s)}`, was = p.setup || "";
    if (was !== key) {
      const [wg, wk = ""] = was.split("|"), [place, strum] = wk.split(":");
      const steps = [...(was && wg !== g.name ? [`Pick up your ${g.name}.`] : []), ...(boothAmpLine(g) && wg !== g.name ? [boothAmpLine(g)] : []), ...boothChange(was && wk ? { place, strum } : null, s)];
      body.innerHTML = `${top()}<section class="pf-card bt-card bt-change">
        <div class="bt-prog"><i style="width:${Math.round(n.at / n.of * 100)}%"></i></div>
        <p class="bt-step">Before take ${n.at + 1} of ${n.of}</p>
        <p class="bt-big" role="heading" aria-level="2">${was ? "Change your setup" : "Set up"}</p>
        <ol class="bt-todo">${steps.map(x => `<li><b>${esc(x)}</b></li>`).join("")}</ol>
        <p class="bt-sub">Then: ${esc(what)}</p>
      </section>`;
      dock.innerHTML = `<button class="btn primary" id="bt-set">${was ? "Done, I've changed it" : "I'm set up"}</button>`;
      $("bt-set").onclick = () => { savePrefs({ setup: key }); show(); };
      bindTop();
      haptic(2);
      return;
    }
    body.innerHTML = `${top()}<section class="pf-card bt-card">
      <div class="bt-prog" role="progressbar" aria-label="Takes done" aria-valuemin="0" aria-valuemax="${n.of}" aria-valuenow="${n.at}"><i style="width:${Math.round(n.at / n.of * 100)}%"></i></div>
      <p class="bt-step">Take ${n.at + 1} of ${n.of}</p>
      <p class="bt-big" role="heading" aria-level="2">${esc(what)}</p>
      <p class="bt-setupline ${s.strum} ${s.place}"><b>${esc(boothSetup(s))}</b></p>
      <div class="bt-shapes">${s.chords.map(c => chordSVG(c, 1.6, s.voicing ? { shape: voicingShape(s.voicing.frets, s.voicing.fingers) } : {}) || "").join("")}</div>
      <div class="bt-stage" id="bt-stage"><p class="bt-dir" id="bt-dir">${esc(boothSteps(s))}</p></div>
      <canvas class="ph-lane bt-lane" id="bt-lane" aria-hidden="true" hidden></canvas>
    </section>`;
    dock.innerHTML = `<button class="btn primary" id="bt-start">${icon("mic")}Start</button><div class="ph-row"><button class="tb" id="bt-skip">Skip this one</button></div>`;
    $("bt-skip").onclick = () => { mark(s.id); show(); };
    bindTop();
    $("bt-start").onclick = () => start(s);
  };
  const start = s => {
    const stage = $("bt-stage"), lane = $("bt-lane");
    stage.innerHTML = `<p class="bt-count" aria-live="assertive">Getting the microphone…</p>`;
    dock.innerHTML = `<button class="btn primary on" id="bt-stop"><i class="pk-rec" aria-hidden="true"></i>Stop</button>`;
    $("bt-stop").onclick = () => { if (rec?.recorder?.state === "recording") stopRec(true); else { stopRec(false); show(); } };
    let calls = [];
    const draw = drawer(lane, () => calls, s.chords);
    recordTake({ chords: s.chords, seconds: s.seconds, count: COUNT, meta: { place: s.place, strum: s.strum, list: s.list, voicing: s.voicing } }, {
      count: k => { stage.innerHTML = `<p class="bt-count" aria-live="assertive"><b>${k}</b>Get ready: ${esc(s.chords[0])}</p>`; },
      tick: (c, t) => {
        calls = c;
        if (lane.hidden) { lane.hidden = false; draw(); }
        const left = Math.max(0, Math.ceil(s.seconds - t));
        stage.innerHTML = `<p class="bt-count rec" aria-live="off"><b>${left}</b>${s.chords.length === 1 ? `Strum ${esc(s.chords[0])}` : `${esc(s.chords[0])}, ${esc(s.chords[1])}, back and forth`}</p><div class="bt-bar"><i style="width:${Math.min(100, t / s.seconds * 100)}%"></i></div>`;
      },
      done: t => result(s, t),
      fail: why => { stage.innerHTML = `<p class="bt-dir">${esc(why)}</p>`; dock.innerHTML = `<button class="btn primary" id="bt-start">${icon("mic")}Try again</button>`; $("bt-start").onclick = () => start(s); },
      cancel: () => {}
    });
  };
  const result = (s, t) => {
    const v = boothVerdict(t.heard, s.chords), stage = $("bt-stage");
    $("bt-lane").hidden = true;
    haptic(v.keep ? 1 : 3);
    stage.innerHTML = `<p class="bt-verdict ${v.keep ? "ok" : "redo"}">${icon(v.keep ? "check" : "mic")}<span>${esc(v.say)}</span></p><button class="tb" id="bt-hear">${icon("play")}Hear it</button>`;
    $("bt-hear").onclick = () => { const a = new Audio(URL.createObjectURL(t.wav)); a.play().catch(() => {}); };
    const keep = () => { mark(s.id); show(); sendQuietly(); };
    const redo = async () => { await dropTake(t.id); start(s); };
    dock.innerHTML = v.keep
      ? `<button class="btn primary" id="bt-keep">Keep it · next</button><div class="ph-row"><button class="tb" id="bt-redo">Try again</button></div>`
      : `<button class="btn primary" id="bt-redo">Try again</button><div class="ph-row"><button class="tb" id="bt-keep">Keep it anyway · next</button></div>`;
    $("bt-keep").onclick = keep; $("bt-redo").onclick = redo;
  };
  show();
}

/* the strip: one tick per reading, newest on the right; green is the chord asked for (or the first of a pair) */
function drawer(canvas, get, chords) {
  const g = canvas.getContext("2d");
  const draw = () => {
    if (!document.contains(canvas) || !rec) return;
    const dpr = devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const calls = get(), n = Math.floor(w / 4), shown = calls.slice(-n);
    shown.forEach((c, i) => {
      const x = w - (shown.length - i) * 4;
      if (!c.call) { g.fillStyle = "rgba(127,127,127,.25)"; g.fillRect(x, h - 6, 3, 4); return; }
      g.fillStyle = c.call === "wrong" ? "#ff6b5a" : c.call === "right" || c.call === chords[0] ? "#2fbf6f" : "#5b8cff";
      g.fillRect(x, 8, 3, h - 16);
    });
    requestAnimationFrame(draw);
  };
  return draw;
}

/* ---- Record your own (4.90.0) ---- */
function free() {
  const body = $("bt-body"), dock = $("bt-dock"), p = prefs(), chords = chordList();
  let kind = "chord", picked = [], calls = [];
  body.innerHTML = `<section class="pf-card pk-lesson">
      <div class="seg mini bt-kind" role="group" aria-label="What you'll play"><button data-k="chord" class="on" aria-pressed="true">One chord</button><button data-k="switch" aria-pressed="false">Switch between two</button></div>
      <div class="ph-chords bt-chords" role="group" aria-label="Chord">${chords.map(c => `<button data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join("")}</div>
      <p class="bt-what" id="bt-what" aria-live="polite">Pick a chord.</p>
      <canvas class="ph-lane bt-lane" id="bt-lane" aria-hidden="true"></canvas>
      <p class="rd-bubble ph-say" id="bt-say" aria-live="polite">Hold the chord and strum it every second or two, about 10 seconds. For a switch, go back and forth at your own pace.</p>
      <div class="bt-fields">
        <div class="bt-f"><span>Phone</span><div class="seg mini" id="bt-place" role="group" aria-label="Where the phone is">${BOOTH_PLACES.map(x => `<button data-p="${x}" class="${(p.place || "stand") === x ? "on" : ""}" aria-pressed="${(p.place || "stand") === x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
        <div class="bt-f"><span>Strum</span><div class="seg mini" id="bt-strum" role="group" aria-label="What you strum with">${BOOTH_STRUMS.map(x => `<button data-st="${x}" class="${(p.strum || "pick") === x ? "on" : ""}" aria-pressed="${(p.strum || "pick") === x}">${x === "pick" ? "Pick" : "Thumb"}</button>`).join("")}</div></div>
        <label class="bt-f"><span>Note</span><input id="bt-note" maxlength="80" autocomplete="off" placeholder="anything odd, e.g. buzzed the B string"></label>
      </div>
    </section>
    <h2 class="ph-h">Takes on this phone</h2>
    <div class="list glass bt-takes" id="bt-takes"></div>`;
  dock.innerHTML = `<button class="btn primary" id="bt-rec" disabled>${icon("mic")}Record</button><div class="ph-row"><button class="tb" id="bt-send" disabled>Send</button><button class="tb" id="bt-share" disabled>Share</button></div>`;
  const say = t => { const e = $("bt-say"); if (e) e.textContent = t; };
  const what = () => {
    const need = kind === "chord" ? 1 : 2;
    $("bt-what").textContent = picked.length < need ? (kind === "chord" ? "Pick a chord." : picked.length ? `${picked[0]} to… pick the second chord.` : "Pick two chords.") : kind === "chord" ? `Recording ${picked[0]}.` : `Recording ${picked[0]} to ${picked[1]}, back and forth.`;
    $("bt-rec").disabled = !rec && picked.length < need;
    body.querySelectorAll("[data-c]").forEach(b => { const on = picked.includes(b.dataset.c); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
  };
  body.querySelectorAll("[data-k]").forEach(b => b.onclick = () => {
    if (rec) return;
    kind = b.dataset.k; picked = [];
    body.querySelectorAll("[data-k]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
    what();
  });
  body.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
    if (rec) return;
    const c = b.dataset.c;
    picked = kind === "chord" ? [c] : picked.includes(c) ? picked.filter(x => x !== c) : [...picked, c].slice(-2);
    what();
  });
  body.querySelectorAll("[data-st]").forEach(b => b.onclick = () => {
    savePrefs({ strum: b.dataset.st });
    body.querySelectorAll("[data-st]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  body.querySelectorAll("[data-p]").forEach(b => b.onclick = () => {
    savePrefs({ place: b.dataset.p });
    body.querySelectorAll("[data-p]").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
  });
  const lane = $("bt-lane");
  const idle = () => { const b = $("bt-rec"); if (b) { b.classList.remove("on"); b.innerHTML = `${icon("mic")}Record`; } what(); };
  $("bt-rec").onclick = () => {
    if (rec) { say("Saving the take…"); $("bt-rec").disabled = true; stopRec(true); return; }
    const chordsNow = picked.slice();
    $("bt-rec").disabled = true; say("Starting the microphone…");
    const draw = drawer(lane, () => calls, chordsNow);
    let first = true;
    recordTake({ chords: chordsNow, seconds: BOOTH_MAX, meta: { place: body.querySelector("[data-p].on")?.dataset.p || "", strum: body.querySelector("[data-st].on")?.dataset.st || "pick", note: $("bt-note")?.value.trim() || "" } }, {
      tick: c => {
        calls = c;
        if (first) { first = false; $("bt-rec").disabled = false; $("bt-rec").classList.add("on"); $("bt-rec").innerHTML = `<i class="pk-rec" aria-hidden="true"></i>Stop`; draw(); say(chordsNow.length === 1 ? `Listening for ${chordsNow[0]}. Strum it every second or two.` : `Listening. ${chordsNow[0]}, then ${chordsNow[1]}, back and forth.`); }
        const s = boothSummary(c, chordsNow); if (s.reads) say(boothSay(s, chordsNow));
      },
      done: t => { if ($("bt-note")) $("bt-note").value = ""; say(`Kept. ${boothSay(t.heard, chordsNow)}`); idle(); paintTakes(); },
      fail: why => { say(why); idle(); },
      cancel: () => idle()
    });
  };
  let player = null;
  async function paintTakes(quiet) {
    const list = await allTakes(), box = $("bt-takes");
    if (!box) return;
    box.innerHTML = list.length ? list.map(t => `<div class="bt-take" data-id="${esc(t.id)}">
        <button class="ib bt-play" data-play="${esc(t.id)}" aria-label="Play ${esc(t.chords.join(" to "))}">${icon("play")}</button>
        <span class="bt-tx"><b>${esc(t.chords.join(" to "))}</b><small>${t.strum === "thumb" ? "Thumb · " : t.strum === "pick" ? "Pick · " : ""}${Math.round(t.seconds)} s · ${esc(boothSay(t.heard || { reads: 0 }, t.chords))}</small></span>
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
    if (!quiet) paintSend(false);
  }
  $("bt-send").onclick = async () => {
    if (!keyOf()) { app.querySelector(".bt-setup")?.setAttribute("open", ""); say("Add the GitHub key under Sending setup first."); return; }
    const list = await allTakes();
    $("bt-send").disabled = true; say(`Sending ${list.length} take${list.length === 1 ? "" : "s"}…`);
    const r = await sendAll();
    say(r.error ? r.error : `Sent ${list.length}. Claude can measure them now.`);
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
  afterSend = () => paintTakes(true);
  what(); paintTakes();
}

/* ---- sending: each take is a .wav and a .json on the booth branch; a sent take leaves the phone ---- */
/* 4.93.1: when GitHub says no, say what it said and what we were doing, so the cause can be seen. A rate limit
   (GitHub caps how fast files can be added) waits and tries again. */
const wait = ms => new Promise(ok => setTimeout(ok, ms));
async function gh(path, key, opt = {}, step = "talking to GitHub", tries = 2) {
  let r;
  try { r = await fetch(`${API}${path}`, { ...opt, headers: { Authorization: `Bearer ${key.trim()}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opt.body ? { "Content-Type": "application/json" } : {}) } }); }
  catch { throw new Error("No connection. The takes are still here; they'll send when you're back online."); }
  if (r.status !== 401 && r.status !== 403 && r.status !== 429) return r;
  let msg = "";
  try { msg = (await r.clone().json()).message || ""; } catch { /* not JSON */ }
  const limited = r.status === 429 || /rate limit/i.test(msg) || r.headers.get("x-ratelimit-remaining") === "0";
  if (limited && tries > 0) { await wait(Math.min(90, +(r.headers.get("retry-after") || 60)) * 1000); return gh(path, key, opt, step, tries - 1); }
  const said = msg ? ` GitHub said: "${msg}"` : "";
  if (r.status === 401) throw new Error(`GitHub refused the key (${step}).${said} Check the key under Sending setup.`);
  if (limited) throw new Error(`GitHub asked to slow down (${step}).${said} The takes are still here; tap Send now in a few minutes.`);
  throw new Error(`GitHub said no (${step}, ${r.status}).${said} The takes are still here.`);
}
export async function sendTakes(list, key, progress = () => {}) {
  let r = await gh(`/git/ref/heads/${BRANCH}`, key, {}, "looking for the booth branch");
  if (r.status === 404) {
    const main = await gh("/git/ref/heads/main", key, {}, "reading main");
    if (!main.ok) throw new Error("The key can't see the repo. It needs access to grahamdeno/tabs.");
    const sha = (await main.json()).object.sha;
    r = await gh("/git/refs", key, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha }) }, "making the booth branch");
    if (!r.ok) { let m = ""; try { m = (await r.json()).message || ""; } catch { /* not JSON */ } throw new Error(`Couldn't make the booth branch (${r.status}${m ? `: ${m}` : ""}). Try again.`); }
  } else if (!r.ok) throw new Error("The key can't see the repo. It needs access to grahamdeno/tabs.");
  let i = 0;
  for (const t of list) {
    progress(++i, list.length);
    const stem = boothPath(t), label = `${t.chords.join(" to ")}, ${Math.round(t.seconds)} s`;
    const wav = new Uint8Array(await t.wav.arrayBuffer());
    const put = (path, content, what) => gh(`/contents/${path}`, key, { method: "PUT", body: JSON.stringify({ message: `Booth: ${label} (${what})`, content, branch: BRANCH }) }, `sending ${label}`);
    const stopped = async x => { let m = ""; try { m = (await x.json()).message || ""; } catch { /* not JSON */ } return new Error(`Sending stopped at ${label} (${x.status}${m ? `: ${m}` : ""}). The rest are still here; try again.`); };
    const a = await put(`${stem}.wav`, toBase64(wav), "recording");
    if (!a.ok && a.status !== 422) throw await stopped(a);
    const b = await put(`${stem}.json`, toBase64(new TextEncoder().encode(JSON.stringify(boothLabel(t), null, 1))), "label");
    if (!b.ok && b.status !== 422) throw await stopped(b);
    await dropTake(t.id);
    if (i < list.length) await wait(1500); /* GitHub caps how fast files can be added; a steady pace stays under it */
  }
}
