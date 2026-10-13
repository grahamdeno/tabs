// Tuner: listens through the microphone; loaded the first time the tuner opens.
import { Tabs, TUNINGS, noteFreq, nearestNote, nearestString, detectPitch } from "./core.js";
import { $, data, icon, layer } from "./app.js";

let audio = null; /* for the reference notes */
const noteLabel = n => n.replace(/-?\d$/, "").replace("b", "♭").replace("#", "♯");
let tunerState = null;
export function closeTuner() {
  const t = tunerState;
  if (!t) return;
  tunerState = null;
  clearInterval(t.timer);
  t.stream?.getTracks().forEach(tr => tr.stop());
  t.ctx?.close?.().catch(() => {});
  if (t.ok.filter(Boolean).length >= 3) { data.settings.lastTuned = Date.now(); Tabs.save(data); }
  layer.innerHTML = "";
  t.onClose?.();
}
function pluck(freq) {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime, g = audio.createGain();
    [1, 2, 3].forEach((h, i) => {
      const o = audio.createOscillator(), og = audio.createGain();
      o.type = i ? "sine" : "triangle"; o.frequency.value = freq * h;
      og.gain.value = [0.5, 0.18, 0.08][i];
      o.connect(og).connect(g); o.start(t); o.stop(t + 2.2);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    g.connect(audio.destination);
  } catch {}
}
export function openTuner(tuning = "standard", onClose) {
  closeTuner();
  const t = tunerState = { tuning: TUNINGS[tuning] ? tuning : "standard", lock: -1, ok: [], hits: [], inTuneSince: 0, quietSince: Date.now(), onClose };
  layer.innerHTML = `
    <div class="scrim" id="tu-scrim"></div>
    <div class="panel card tuner" role="dialog" aria-label="Tuner">
      <div class="pc-head">${icon("fork")}<span>Tuner</span>
        <label class="tu-sel"><span id="tu-name"></span>${icon("chev", "chev")}<select id="tu-tuning" aria-label="Tuning">${Object.entries(TUNINGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select></label></div>
      <div class="tu-note" aria-live="polite"><b id="tu-n">·</b><span id="tu-c"></span></div>
      <div class="tu-meter" aria-hidden="true"><i class="tu-zone"></i>${[-40, -30, -20, -10, 0, 10, 20, 30, 40].map(c => `<i class="tu-tick ${c ? "" : "mid"}" style="left:${50 + c}%"></i>`).join("")}<i class="tu-needle" id="tu-needle"></i></div>
      <div class="tu-msg" id="tu-msg">Starting the microphone…</div>
      <div class="tu-strings" id="tu-strings"></div>
      <p class="tu-hint">Tap a string to hear it and tune only that one.</p>
      <div class="actions"><button class="btn primary" id="tu-done">Done</button></div>
    </div>`;
  $("tu-scrim").onclick = closeTuner;
  $("tu-done").onclick = closeTuner;
  const sel = $("tu-tuning");
  sel.value = t.tuning;
  const paintStrings = () => {
    const notes = TUNINGS[t.tuning].notes;
    $("tu-name").textContent = TUNINGS[t.tuning].name;
    $("tu-strings").innerHTML = notes.map((n, i) => `<button class="tu-s ${t.ok[i] ? "ok" : ""} ${t.lock === i ? "lock" : ""}" data-s="${i}" aria-label="String ${6 - i}, ${noteLabel(n)}${t.ok[i] ? ", in tune" : ""}">
      <b>${noteLabel(n)}</b><small>${t.ok[i] ? icon("check") : 6 - i}</small></button>`).join("");
    $("tu-strings").querySelectorAll("[data-s]").forEach(b => b.onclick = () => {
      const i = +b.dataset.s;
      t.lock = t.lock === i ? -1 : i;
      if (t.lock === i) pluck(noteFreq(notes[i]));
      paintStrings();
    });
  };
  sel.onchange = () => { t.tuning = sel.value; t.ok = []; t.lock = -1; paintStrings(); };
  paintStrings();
  const msg = (text, cls = "") => { const m = $("tu-msg"); if (m) { m.textContent = text; m.className = "tu-msg " + cls; } };
  const fail = e => {
    const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    msg(denied ? "Tabs needs the microphone to hear your guitar. Allow it for this app in your phone's Settings, then open the tuner again."
      : "The microphone isn't available here. You can still tap a string to hear its note.", "warn");
  };
  if (!navigator.mediaDevices?.getUserMedia) return fail();
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(stream => {
    if (tunerState !== t) { stream.getTracks().forEach(tr => tr.stop()); return; }
    t.stream = stream;
    t.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = t.ctx.createAnalyser();
    an.fftSize = 4096;
    t.ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    msg("Play a string");
    t.timer = setInterval(() => listen(t, an, buf, msg, paintStrings), 70);
  }).catch(fail);
}
function listen(t, an, buf, msg, paintStrings) {
  an.getFloatTimeDomainData(buf);
  const f = detectPitch(buf, t.ctx.sampleRate);
  const needle = $("tu-needle");
  if (!needle) return;
  const now = Date.now();
  if (f < 0) {
    if (now - t.quietSince > 900) { needle.classList.add("idle"); $("tu-n").textContent = "·"; $("tu-c").textContent = ""; msg(t.ok.filter(Boolean).length === 6 ? "All in tune" : "Play a string", t.ok.filter(Boolean).length === 6 ? "good" : ""); t.hits = []; }
    t.inTuneSince = 0;
    return;
  }
  t.quietSince = now;
  /* Smooth over the last few readings so the needle doesn't jitter. */
  t.hits = [...t.hits.slice(-4), f];
  const fs = [...t.hits].sort((a, b) => a - b)[t.hits.length >> 1];
  const notes = TUNINGS[t.tuning].notes;
  let idx, cents;
  if (t.lock >= 0) { idx = t.lock; cents = Math.round(1200 * Math.log2(fs / noteFreq(notes[idx]))); }
  else ({ index: idx, cents } = nearestString(fs, t.tuning));
  const far = Math.abs(cents) > 50;
  const shown = far ? nearestNote(fs) : null;
  $("tu-n").textContent = far ? shown.name.replace("b", "♭").replace("#", "♯") : noteLabel(notes[idx]);
  $("tu-c").textContent = far ? "" : `${cents > 0 ? "+" : ""}${cents}`;
  needle.classList.remove("idle");
  const c = far ? Math.max(-50, Math.min(50, shown.cents)) : Math.max(-50, Math.min(50, cents));
  needle.style.left = (50 + c * 0.9) + "%";
  const good = !far && Math.abs(cents) <= 4;
  needle.classList.toggle("good", good);
  document.querySelectorAll(".tu-s").forEach((b, i) => b.classList.toggle("cur", i === idx));
  if (far) { msg(cents < 0 ? `Way below ${noteLabel(notes[idx])}: tune up` : `Way above ${noteLabel(notes[idx])}: tune down`, "warn"); t.inTuneSince = 0; return; }
  if (!good) { msg(cents < 0 ? "Tune up" : "Tune down"); t.inTuneSince = 0; return; }
  t.inTuneSince ||= now;
  msg("In tune", "good");
  if (now - t.inTuneSince > 600 && !t.ok[idx]) {
    t.ok[idx] = true;
    paintStrings();
    if (t.ok.filter(Boolean).length === 6) { data.settings.lastTuned = Date.now(); Tabs.save(data); }
  }
}
