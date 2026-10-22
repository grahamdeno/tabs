// Tuner: listens through the microphone; loaded the first time the tuner opens.
// Three ways to tune: Acoustic and Electric show the guitar's headstock and light
// the key to turn (Guided walks the strings low to high), Chromatic reads any note.
// A meter shows how far off the string is; its middle is stretched, so the last
// few cents are easy to see.
import { Tabs, TUNINGS, TUNE, noteFreq, nearestNote, nearestString, octaveFix, centsOff, tuneAdvice, guidedTarget, heldInTune, meterPos, detectPitch, journalTune } from "./core.js";
import { HEADS } from "./heads.js";
import { haptic, sound } from "./ui.js";
import { louie } from "./louie.js";
import { $, data, icon, layer, esc, coach, markUsed, toast } from "./app.js";

const noteLabel = n => n.replace(/-?\d$/, "").replace("b", "♭").replace("#", "♯");
/* String names on the headstock: the top string is "e" when it doubles the low E. */
const stringName = (notes, i) => { const n = noteLabel(notes[i]); return i === 5 && n === noteLabel(notes[0]) ? n.toLowerCase() : n; };
const octave = n => (/(-?\d)$/.exec(n) || [])[1] || "";
/* where the nut sits on each drawing, for its cream bar */
const NUT = { acoustic: [449, 1036], electric: [444, 950] };
const MODES = [["acoustic", "Acoustic"], ["electric", "Electric"], ["chromatic", "Chromatic"]];
let tunerState = null;

export function closeTuner() {
  const t = tunerState;
  if (!t) return;
  tunerState = null;
  clearInterval(t.timer);
  t.stream?.getTracks().forEach(tr => tr.stop());
  t.src?.disconnect?.(); /* the shared audio engine stays */
  if (t.ok.filter(Boolean).length >= 3) data.settings.lastTuned = Date.now();
  /* For Your playing: how far each string had drifted when first heard. */
  if (t.first?.length) journalTune(data, t.first);
  Tabs.save(data);
  layer.innerHTML = "";
  document.body.classList.remove("tuning");
  t.onClose?.();
}

function tone(freq, { len = 2.1, gain = 0.35, harm = [0.5, 0.18, 0.08] } = {}) {
  try {
    const audio = sound();
    if (!audio) return;
    const t = audio.currentTime, g = audio.createGain();
    harm.forEach((a, i) => {
      const o = audio.createOscillator(), og = audio.createGain();
      o.type = i ? "sine" : "triangle"; o.frequency.value = freq * (i + 1);
      og.gain.value = a;
      o.connect(og).connect(g); o.start(t); o.stop(t + len + 0.1);
    });
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    g.connect(audio.destination);
  } catch {}
}
/* All six in tune: a rising E major arpeggio (E, G#, B, E). */
/* 4.24.0: louder, since iPhone plays quieter while the microphone is open */
const doneChime = () => [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => setTimeout(() => tone(f, { len: i === 3 ? 0.9 : 0.4, gain: 0.16, harm: [0.6] }), i * 120));
const chime = () => { tone(1318.5, { len: 0.5, gain: 0.16, harm: [0.6] }); setTimeout(() => tone(1760, { len: 0.7, gain: 0.14, harm: [0.6] }), 90); };
/* All six: a small party over the headstock, confetti in the palette and Louie with his horns up. */
const PARTY = ["var(--accent)", "var(--good)", "var(--tn-lit)", "#EE5C9F", "#7ADCF6", "#FFD23F"];
function party(stage) {
  if (!stage || stage.querySelector(".tn-party")) return;
  const bits = Array.from({ length: 18 }, (_, i) => `<i style="--x:${Math.round(Math.cos(i * 2.1) * 140)}px;--y:${-60 - Math.round(Math.abs(Math.sin(i * 1.7)) * 160)}px;--r:${(i * 47) % 360}deg;background:${PARTY[i % PARTY.length]};animation-delay:${(i % 6) * 30}ms"></i>`).join("");
  stage.insertAdjacentHTML("beforeend", `<div class="tn-party" aria-hidden="true">${bits}<span class="tn-louie">${louie("happy", { pose: "hornsUp", size: 86 })}</span></div>`);
}

// ---- The headstock: the drawing, plus the lit key, post and string ----
function headSVG(kind, t, { mini = false } = {}) {
  const H = HEADS[kind], notes = TUNINGS[t.tuning].notes;
  const pad = mini ? 10 : 230;
  const cur = mini ? -1 : t.cur, good = !mini && t.good;
  const col = good ? "var(--good)" : "var(--tn-lit)"; /* 4.17.2: the string in hand in a colour that stands out on the headstock; green when in tune */
  let s = `<svg viewBox="${-pad} 0 ${H.w + pad * 2} ${mini ? 1760 : H.h}" ${mini ? 'aria-hidden="true"' : `role="img" aria-label="${esc(MODES.find(m => m[0] === kind)[1])} headstock"`}>`;
  if (mini) return s + `<path d="${H.d}" fill="var(--head)" fill-rule="evenodd"/></svg>`;
  /* 4.25.0: the headstock in colour, flat with no outlines. The face and a darker right half, clipped to the
     drawing; acoustic adds a dark veneer along the top, electric a highlight stripe. The colours are CSS
     variables on .tuner2[data-kind], and the electric one follows Louie's finish (body[data-wear]). */
  s += `<defs><clipPath id="tn-clip"><path d="${H.d}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#tn-clip)" class="tn-face"><rect x="${-pad}" y="0" width="${H.w + pad * 2}" height="${H.h}" fill="var(--tn-face)"/><rect x="${H.w / 2}" y="0" width="${H.w / 2 + pad}" height="${H.h}" fill="var(--tn-side)"/>`
    + (kind === "acoustic" ? `<rect x="${-pad}" y="0" width="${H.w + pad * 2}" height="150" fill="var(--tn-vein)"/>` : `<rect x="${H.w * 0.3}" y="0" width="70" height="${H.h}" rx="35" fill="var(--lv-hi)" opacity=".45"/>`) + `</g>`;
  const [n0, n1] = NUT[kind];
  s += `<rect x="${n0}" y="${H.nutY - 24}" width="${n1 - n0}" height="40" rx="12" fill="var(--tn-post)"/>`;
  H.strings.forEach((g, i) => {
    const [kx, ky, kw, kh] = g.key, on = i === cur, done = !!t.ok[i];
    s += `<circle cx="${g.px}" cy="${g.py}" r="${g.r}" fill="var(--tn-post)"/><rect x="${kx}" y="${ky + 14}" width="${kw}" height="${kh}" rx="44" fill="${done && !on ? "var(--good)" : "var(--tn-keylip)"}" opacity="${done && !on ? 0.55 : 1}"/><rect x="${kx}" y="${ky}" width="${kw}" height="${kh}" rx="44" fill="${done && !on ? "var(--good)" : "var(--tn-key)"}"/>`;
    if (on) {
      /* the string itself wavers while the mic hears it (.ringing on the stage, styles.css) */
      s += `<g class="tn-lit"><line x1="${g.px}" y1="${g.py}" x2="${g.nx}" y2="${H.nutY}" stroke="${col}" stroke-width="18" stroke-linecap="round"/>`;
      s += `<line x1="${g.nx}" y1="${H.nutY}" x2="${g.nx}" y2="${H.h - 40}" stroke="${col}" stroke-width="18"/></g>`;
      s += `<circle cx="${g.px}" cy="${g.py}" r="${g.r}" fill="${col}"/><rect x="${kx}" y="${ky}" width="${kw}" height="${kh}" rx="44" fill="${col}"/>`;
    } else if (done) s += `<circle cx="${g.px}" cy="${g.py}" r="${g.r * 0.55}" fill="var(--good)"/>`;
    /* The note is printed on its key, so changing the tuning relabels the
       keys; a tuned string gets a check beside its key. */
    const name = stringName(notes, i);
    s += `<text x="${kx + kw / 2}" y="${ky + kh / 2 + 34}" text-anchor="middle" font-size="${name.length > 1 ? 80 : 98}" font-weight="${on ? 800 : 700}" style="font-family: var(--display)"${on ? ' class="on"' : ""} fill="${on || done ? "#14110d" : "var(--tn-ink)"}">${name}</text>`;
    if (done && !on) s += `<text x="${g.side < 0 ? kx - 30 : kx + kw + 30}" y="${ky + kh / 2 + 32}" text-anchor="${g.side < 0 ? "end" : "start"}" font-size="92" font-weight="600" fill="var(--good)">✓</text>`;
    // a generous tap target over the key and its name
    const hx = g.side < 0 ? kx - 230 : kx;
    s += `<rect class="tn-key" data-s="${i}" x="${hx}" y="${ky - 30}" width="${kw + 230}" height="${kh + 60}" fill="transparent" role="button" aria-label="${esc(name)} string${done ? ", in tune" : ""}. Tap to hear it"/>`;
  });
  return s + "</svg>";
}

// The meter's scale, in cents each side of the note; longer ticks at 10 and 50.
// The in-tune zone spans the 3 cents each side.
const ticks = () => [5, 10, 15, 20, 30, 40, 50].flatMap(c => [-c, c]).map(c => `<i class="tn-tick${Math.abs(c) % 40 === 10 ? " big" : ""}" style="left:${meterPos(c).toFixed(2)}%"></i>`).join("")
  + `<i class="tn-zone" style="left:${meterPos(-TUNE.good).toFixed(2)}%;width:${(meterPos(TUNE.good) - meterPos(-TUNE.good)).toFixed(2)}%"></i>`;

// ---- Chromatic dial: cents from -50 to +50 across a 140 degree arc ----
function dialSVG() {
  const cx = 150, cy = 176, R = 124;
  const pol = (a, r) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const arc = (a0, a1, r) => { const [x0, y0] = pol(a0, r), [x1, y1] = pol(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  let s = `<svg viewBox="0 0 300 200" class="tn-dial" aria-hidden="true"><path d="${arc(-70, 70, R)}" stroke="var(--rim)" stroke-width="2" fill="none"/>`;
  s += `<path d="${arc(-TUNE.good * 1.4, TUNE.good * 1.4, R - 4)}" stroke="var(--good)" stroke-opacity=".35" stroke-width="16" fill="none"/>`;
  for (let c = -50; c <= 50; c += 5) {
    const a = c * 1.4, big = c % 25 === 0, [x0, y0] = pol(a, R - (big ? 18 : 10)), [x1, y1] = pol(a, R);
    s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${c ? "var(--muted)" : "var(--good)"}" stroke-width="${c ? (big ? 1.6 : 1) : 3}" stroke-opacity="${c ? 0.6 : 0.9}"/>`;
    if (big && c) { const [tx, ty] = pol(a, R + 14); s += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)">${c > 0 ? "+" : ""}${c}</text>`; }
  }
  return s + `<g id="tn-needle" class="idle"><line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R + 2}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="7"/></g></svg>`;
}

const meterTip = () => coach($("tn-win"), "", { ms: 3800, place: "below", fixed: true, html: `<b>Green and centered: in tune</b><span>The marker moves left when flat, right when sharp, and slows down near the note.</span>` });
// Show me: the marker glides in from flat and settles in green.
function demoMeter(t) {
  t.demoUntil = Date.now() + 4200;
  [[-30, 0], [-12, 900], [-5, 1800], [-1, 2700], [0, 3300]].forEach(([c, at]) => setTimeout(() => {
    if (tunerState !== t || t.hits.length) return;
    showGauge(t, c, Math.abs(c) <= TUNE.good);
  }, at));
  setTimeout(meterTip, 200);
}
export function openTuner(tuning = "standard", onClose, opts = {}) {
  closeTuner();
  const st = data.settings;
  const t = tunerState = {
    tuning: TUNINGS[tuning] ? tuning : "standard",
    mode: MODES.some(m => m[0] === st.tunerMode) ? st.tunerMode : "acoustic",
    guided: st.tunerGuided !== false,
    a4: Math.min(450, Math.max(430, Number(st.a4) || 440)),
    ok: [], cur: 0, good: false, lock: -1, finished: false,
    inTuneSince: 0, quietSince: Date.now(), hits: [], onClose
  };
  document.body.classList.add("tuning");
  /* iPhone: start the audio inside the tap that opened the tuner, so
     it isn't left paused after the microphone prompt; any later touch wakes it too. */
  t.ctx = sound();
  const back = /^#\/song\//.test(location.hash) ? "Back to the song" : /^#\/set\//.test(location.hash) ? "Back to the set" : "Done";
  layer.innerHTML = `
    <div class="tuner2" role="dialog" aria-label="Tuner">
      <div class="tn-top">
        <button class="tn-menubtn" id="tn-menubtn" aria-haspopup="true" aria-expanded="false" aria-controls="tn-menu"><b id="tn-tname"></b>${icon("chev", "chev")}</button>
        <button class="tb go" id="tn-done">Done</button>
      </div>
      <div class="tn-menu" id="tn-menu" hidden>
        <div class="cap" id="tn-ihd">Instrument</div>
        <div class="tn-seg" role="tablist" aria-labelledby="tn-ihd">${MODES.map(([k, n]) => `<button class="tn-opt" role="tab" data-mode="${k}">${n}</button>`).join("")}</div>
        <label class="tn-menurow" id="tn-tuning-row"><span class="cap">Tuning</span><b id="tn-tname2"></b>${icon("chev", "chev")}<select id="tn-tuning" aria-label="Tuning">${Object.entries(TUNINGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join("")}</select></label>
      </div>
      <div class="tn-read">
        <div class="tn-note"><b id="tn-n">–</b><sub id="tn-o"></sub></div>
        <div class="tn-sayrow"><i class="tn-lamp" id="tn-lamp" aria-hidden="true"></i><span class="tn-say" id="tn-say" role="status">Starting the microphone…</span></div>
        <div class="tn-c" id="tn-c"></div>
      </div>
      <div class="tn-gauge" id="tn-gauge">
        <div class="tn-win" id="tn-win">
          <div class="tn-meter" id="tn-meter">${ticks()}<i class="tn-mid"></i><i class="tn-dot idle" id="tn-dot"><span id="tn-tag"></span></i></div>
        </div>
        <div class="tn-pill" id="tn-pill"></div>
      </div>
      <div class="tn-stage" id="tn-stage"></div>
      <div class="tn-foot" id="tn-foot"></div>
    </div>`;
  $("tn-done").onclick = closeTuner;
  const sel = $("tn-tuning");
  sel.value = t.tuning;
  /* 4.25.0: one pill, "Standard · Acoustic", opens the menu with the instrument and the tuning */
  const menu = $("tn-menu"), menuBtn = $("tn-menubtn");
  const openMenu = on => { menu.hidden = !on; menuBtn.setAttribute("aria-expanded", on); };
  menuBtn.onclick = () => openMenu(menu.hidden);
  sel.onchange = () => { t.tuning = sel.value; t.ok = []; t.lock = -1; t.finished = false; t.cur = t.guided ? 0 : -1; openMenu(false); paint(); };
  layer.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => {
    t.mode = b.dataset.mode; st.tunerMode = t.mode; Tabs.save(data);
    t.finished = t.finished && t.mode !== "chromatic"; openMenu(false); paint();
  });
  layer.querySelector(".tuner2").addEventListener("click", e => { if (!menu.hidden && !e.target.closest("#tn-menu, #tn-menubtn")) openMenu(false); });

  const paintHead = () => {
    const stage = $("tn-stage");
    if (t.mode === "chromatic") return;
    stage.innerHTML = headSVG(t.mode, t);
    stage.querySelectorAll(".tn-key").forEach(k => k.onclick = () => {
      const i = +k.dataset.s;
      tone(noteFreq(TUNINGS[t.tuning].notes[i], t.a4));
      markUsed("tunerKey");
      if (t.guided) { t.cur = i; t.ok[i] = false; t.finished = false; }
      else t.lock = t.lock === i ? -1 : i;
      t.inTuneSince = 0; paint();
    });
  };
  t.paintHead = paintHead;
  // Everything that changes with the mode, the tuning or the string in hand.
  const paint = () => {
    const chrom = t.mode === "chromatic";
    const kindName = MODES.find(m => m[0] === t.mode)[1];
    $("tn-tname").textContent = chrom ? kindName : `${TUNINGS[t.tuning].name} · ${kindName}`;
    $("tn-tname2").textContent = TUNINGS[t.tuning].name;
    $("tn-tuning-row").hidden = chrom;
    layer.querySelector(".tuner2").dataset.kind = t.mode;
    layer.querySelectorAll("[data-mode]").forEach(b => { const on = b.dataset.mode === t.mode; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    layer.querySelector(".tuner2").classList.toggle("chrom", chrom);
    if (t.guided && !chrom && !t.finished && t.cur < 0) t.cur = guidedTarget(t.ok);
    if (!t.guided && !chrom) t.cur = t.lock;
    const stage = $("tn-stage"), foot = $("tn-foot");
    $("tn-gauge").hidden = t.finished && !chrom;
    if (chrom) {
      stage.innerHTML = dialSVG();
      foot.innerHTML = `<label class="tn-chip">A4 = <b>${t.a4} Hz</b>${icon("chev", "chev")}<select id="tn-a4" aria-label="Pitch reference">${Array.from({ length: 21 }, (_, k) => 430 + k).map(v => `<option ${v === t.a4 ? "selected" : ""}>${v}</option>`).join("")}</select></label><span class="tn-any">Any instrument or voice</span>`;
      $("tn-a4").onchange = e => { t.a4 = +e.target.value; st.a4 = t.a4; Tabs.save(data); paint(); };
      $("tn-meter").hidden = true;
    } else if (t.finished) {
      $("tn-n").textContent = "All in tune"; $("tn-o").textContent = "";
      $("tn-say").textContent = ""; $("tn-c").textContent = `${TUNINGS[t.tuning].name} · 6 of 6`;
      layer.querySelector(".tn-note").classList.add("done", "glow");  /* success glows */
      t.cur = -1; paintHead();
      if (t.party) { t.party = false; party(stage); }
      foot.innerHTML = `<button class="btn" id="tn-again">Tune again</button><button class="btn primary" id="tn-back">${back}</button>`;
      $("tn-again").onclick = () => { t.ok = []; t.finished = false; t.cur = t.guided ? 0 : -1; layer.querySelector(".tn-note").classList.remove("done"); paint(); };
      $("tn-back").onclick = closeTuner;
    } else {
      layer.querySelector(".tn-note").classList.remove("done");
      $("tn-meter").hidden = false;
      paintHead();
      const left = t.ok.filter(Boolean).length;
      /* 4.19.0 (from Your profile's old Tuning card): the string that drifts most, before you start */
      const jt = data.journal?.tune, names = ["low E", "A", "D", "G", "B", "high e"];
      const worst = !left && jt?.checked ? jt.checked.map((c, i) => ({ i, rate: c >= 3 ? (jt.drift?.[i] || 0) / c : 0 })).sort((a, b) => b.rate - a.rate)[0] : null;
      const tip = worst?.rate > 0 && t.tuning === "standard" ? `Your ${names[worst.i]} drifts most · ` : "";
      foot.innerHTML = `<label class="tn-switch"><input type="checkbox" id="tn-guided" ${t.guided ? "checked" : ""}><i></i>Guided</label><span class="tn-status" id="tn-status">${tip}${t.guided || left ? `${left} of 6 in tune` : "Follows the string you play"}</span>`;
      $("tn-guided").onchange = e => { t.guided = e.target.checked; st.tunerGuided = t.guided; Tabs.save(data); t.lock = -1; t.cur = t.guided ? guidedTarget(t.ok) : -1; t.inTuneSince = 0; paint(); };
    }
  };
  t.paint = paint;
  paint();
  if (opts.demo === "meter") setTimeout(() => demoMeter(t), 300);

  const say = (text, cls = "") => { const m = $("tn-say"); if (m) { m.textContent = text; m.className = "tn-say " + cls; } };
  t.say = say;
  const fail = e => {
    const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
    say(denied ? "The Road can't hear your guitar: the microphone is off for it. To turn it on, open your iPhone's Settings, then Apps > Safari > Microphone, and choose Ask. Then open the tuner again. Meanwhile, tap a key to hear its note."
      : "The microphone isn't available here. Tap a key to hear its note.", "warn");
  };
  if (!navigator.mediaDevices?.getUserMedia) return fail();
  const listenNow = () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(stream => {
    if (tunerState !== t) { stream.getTracks().forEach(tr => tr.stop()); return; }
    t.stream = stream;
    t.ctx = sound();
    if (!t.ctx) return fail();
    const wakeUp = () => { if (t.ctx && t.ctx.state !== "running") t.ctx.resume?.().catch(() => {}); };
    layer.querySelector(".tuner2")?.addEventListener("pointerdown", wakeUp);
    const an = t.ctx.createAnalyser();
    an.fftSize = 4096;
    t.src = t.ctx.createMediaStreamSource(stream);
    t.src.connect(an);
    const buf = new Float32Array(an.fftSize);
    idle(t);
    t.timer = setInterval(() => listen(t, an, buf), 45);
  }).catch(fail);
  /* The first time, say why before the phone asks; after that, just listen. */
  const permission = navigator.permissions?.query ? navigator.permissions.query({ name: "microphone" }).then(p => p.state, () => "prompt") : Promise.resolve("prompt");
  permission.then(state => {
    if (tunerState !== t) return;
    if (state === "denied") return fail({ name: "NotAllowedError" });
    if (state === "granted" || st.micExplained) return listenNow();
    const box = layer.querySelector(".tuner2");
    box.classList.add("asking");
    const card = document.createElement("div");
    card.className = "tn-mic";
    card.innerHTML = `<span class="tn-mic-ic">${icon("fork")}</span><b>The Road listens to tune your guitar</b>
      <p>The microphone is on only while the tuner is open. Nothing is recorded or sent anywhere.</p>
      <button class="btn primary" id="tn-allow">Allow microphone</button><button class="tb" id="tn-skip">Not now</button>`;
    box.querySelector(".tn-read").after(card);
    say("");
    const done = () => { card.remove(); box.classList.remove("asking"); };
    $("tn-allow").onclick = () => { st.micExplained = true; Tabs.save(data); done(); say("Starting the microphone…"); sound(); listenNow(); };
    $("tn-skip").onclick = () => { done(); say("Tap a key to hear its note. The tuner listens once you allow the microphone.", "warn"); };
  });
}

function idle(t) {
  if (t.demoUntil > Date.now()) return; /* let a Show me demo finish */
  const dot = $("tn-dot"), needle = document.getElementById("tn-needle");
  dot?.classList.add("idle"); needle?.classList.add("idle");
  if (t.mode !== "chromatic" && $("tn-meter")) $("tn-meter").hidden = t.finished;
  t.disp = null; t.hits = []; t.inTuneSince = 0; t.shown = null; t.pend = null;
  $("tn-lamp")?.classList.remove("on");
  if ($("tn-pill")) $("tn-pill").textContent = "";
  if (t.finished && t.mode !== "chromatic") return;
  $("tn-n").textContent = "–"; $("tn-o").textContent = ""; $("tn-c").textContent = "";
  layer.querySelector(".tn-note")?.classList.remove("glow", "live");
  if (t.mode === "chromatic") return t.say("Play a note");
  const notes = TUNINGS[t.tuning].notes;
  t.say(t.guided && t.cur >= 0 ? `Play the ${stringName(notes, t.cur)} string` : t.lock >= 0 ? `Play the ${stringName(notes, t.lock)} string` : "Play a string");
}

function listen(t, an, buf) {
  if (tunerState !== t) return;
  an.getFloatTimeDomainData(buf);
  const now = Date.now();
  let e = 0; for (let i = 0; i < buf.length; i += 4) e += buf[i] * buf[i];
  const lvl = Math.sqrt(e / (buf.length / 4));
  /* How loud the room is when nothing is playing. It drifts down quickly and
     up slowly, so a ringing string never counts as background. Anything a
     little above it is worth listening to, which catches a guitar held at
     playing distance; a fixed level only heard one right next to the phone. */
  t.floor = t.floor == null ? Math.min(lvl, 0.004) : lvl < t.floor ? t.floor * 0.7 + lvl * 0.3 : t.floor * 0.995 + Math.min(lvl, t.floor * 3) * 0.005;
  const sounding = now - (t.quietSince || 0) < 400 && t.hits.length > 0;
  const minRms = Math.min(0.01, Math.max(0.0007, t.floor * (sounding ? 1.3 : 2)));
  /* A pluck's first instant is noisy and sharp: skip readings for a moment
     after the level jumps, so the marker doesn't jolt. */
  if (lvl > Math.max(minRms * 4, 0.006) && lvl > (t.lvl || 0) * 2) { t.attackUntil = now + 35; t.hits = []; }
  t.lvl = lvl;
  if (now < (t.attackUntil || 0)) return;
  /* While a note is ringing, accept a less crisp reading so it holds as it fades. */
  let f = detectPitch(buf, t.ctx.sampleRate, minRms, sounding ? 0.5 : 0.4);
  /* When we know which string is being tuned, also look only near it. That
     reading is preferred: a quiet high e or a low E whose overtone is louder
     than its note is still read right. The open search wins only when it
     clearly heard a different string, so "That's the A string" still works. */
  const notes0 = TUNINGS[t.tuning].notes;
  const target = t.mode === "chromatic" ? -1 : t.guided ? t.cur : t.lock >= 0 ? t.lock : sounding ? t.cur : -1;
  if (target >= 0) {
    const hz = noteFreq(notes0[target], t.a4);
    const near = detectPitch(buf, t.ctx.sampleRate, minRms, 0.6, [hz * 0.7, hz * 1.42]);
    const other = f > 0 && notes0.some((n, i) => i !== target && Math.abs(centsOff(f, n, t.a4)) < 50) && Math.abs(centsOff(f, notes0[target], t.a4)) > 600;
    if (near > 0 && !other) f = near;
  }
  /* A dropped reading or two while the string rings doesn't reset anything. */
  if (f < 0) {
    if (now - t.quietSince > 300) document.getElementById("tn-stage")?.classList.remove("ringing");
    if (now - t.quietSince > 2000 && t.hits.length) idle(t);
    return;
  }
  t.quietSince = now;
  document.getElementById("tn-stage")?.classList.add("ringing");
  /* Octave slips: fold toward the string being tuned, or any string. */
  if (t.mode !== "chromatic") f = octaveFix(f, t.tuning, t.a4, t.guided ? t.cur : t.lock);
  /* Smooth over the last three readings: steady, but quick to follow the peg. */
  t.hits = [...t.hits.slice(-2), f];
  /* A new note shows once two readings in a row agree, so a blip of room
     noise never moves the marker. It costs one reading, about 45 ms. */
  if (t.hits.length === 1) return;
  if (t.hits.length === 2 && Math.abs(1200 * Math.log2(t.hits[0] / t.hits[1])) > 50) { t.hits = [f]; return; }
  const fs = [...t.hits].sort((a, b) => a - b)[t.hits.length >> 1];
  if (t.mode === "chromatic") return readChromatic(t, fs);
  if (t.finished) return;
  const notes = TUNINGS[t.tuning].notes;
  let idx = t.guided ? t.cur : t.lock >= 0 ? t.lock : nearestString(fs, t.tuning, t.a4).index;
  if (idx < 0) return;
  /* Steadier: another string takes over only after three readings in a row. */
  if (!t.guided && t.lock < 0 && t.cur >= 0 && idx !== t.cur && t.hits.length > 1) {
    t.pend = t.pend?.k === idx ? { k: idx, n: t.pend.n + 1 } : { k: idx, n: 1 };
    if (t.pend.n < 3) idx = t.cur;
  } else t.pend = null;
  /* The marker eases toward each reading, so it glides instead of twitching;
     a big jump (a new pluck, a turn of the peg) moves it at once. */
  const raw = centsOff(fs, notes[idx], t.a4);
  if (idx !== t.dispIdx) t.disp = null;
  t.dispIdx = idx;
  t.disp = t.disp == null || Math.abs(raw - t.disp) > 20 ? raw : t.disp * 0.55 + raw * 0.45;
  const cents = Math.round(t.disp);
  /* The string's first steady reading this session: how far it had drifted. */
  if (t.hits.length >= 3 && (t.first ||= [])[idx] == null) t.first[idx] = cents;
  const adv = tuneAdvice(cents);
  const good = adv.tone === "good";
  if (!t.guided && t.lock < 0 && idx !== t.cur) { t.cur = idx; t.good = good; t.paintHead(); }
  if (good !== t.good) { t.good = good; t.paintHead(); if (good && !t.ok[idx]) haptic(1); /* in the zone: hold it */ }
  $("tn-n").textContent = stringName(notes, idx); $("tn-o").textContent = octave(notes[idx]); layer.querySelector(".tn-note")?.classList.add("live");
  layer.querySelector(".tn-note")?.classList.toggle("glow", good); /* in tune: the letter glows */
  $("tn-c").textContent = `${cents > 0 ? "+" : ""}${cents} cents · ${fs.toFixed(1)} Hz`;
  const name = stringName(notes, idx);
  let text = good ? `${name} is in tune · hold it` : adv.tone === "off" ? `${adv.say} the ${name} string` : adv.say;
  if (adv.tone === "far") {
    const near = nearestString(fs, t.tuning, t.a4);
    text = near.index !== idx && Math.abs(near.cents) <= 50
      ? `That's the ${stringName(notes, near.index)} string · play ${stringName(notes, idx)}`
      : `${adv.say} (${stringName(notes, idx)} string)`;
  }
  t.say(text, adv.tone);
  showGauge(t, cents, good);
  if (Math.abs(cents) > TUNE.slack) t.inTuneSince = 0;
  if (!good) return;
  t.inTuneSince ||= now;
  if (!heldInTune(t.inTuneSince, now) || t.ok[idx]) return;
  t.ok[idx] = true; t.inTuneSince = 0; t.good = false;
  if (t.ok.filter(Boolean).length === 6) {
    /* Guided goes E, A, D, G, B, e; after the last: success. */
    t.finished = true; data.settings.lastTuned = Date.now(); Tabs.save(data);
    doneChime(); haptic(3);
    toast("All six strings in tune");
    t.party = true;
  } else {
    chime(); haptic(2);
    if (t.guided) t.cur = guidedTarget(t.ok);
  }
  t.hits = [];
  t.paint();
}

function readChromatic(t, fs) {
  let n = nearestNote(fs, t.a4);
  /* Steadier: near the edge between two notes, a new note shows only
     after three readings in a row; meanwhile the old one reads its cents. */
  const key = n.name + n.octave;
  if (t.shown && key !== t.shown.key) {
    t.pend = t.pend?.k === key ? { k: key, n: t.pend.n + 1 } : { k: key, n: 1 };
    if (t.pend.n < 3 && Math.abs(n.cents) > 35) {
      const c = Math.round(1200 * Math.log2(fs / t.shown.f));
      if (Math.abs(c) < 80) n = { ...t.shown.n, cents: c };
    }
  } else t.pend = null;
  if (!t.shown || n.name + n.octave !== t.shown.key) t.shown = { key: n.name + n.octave, n, f: fs * Math.pow(2, -n.cents / 1200) };
  const good = Math.abs(n.cents) <= TUNE.good;
  $("tn-lamp")?.classList.add("on");
  $("tn-n").textContent = n.name.replace("b", "♭").replace("#", "♯"); $("tn-o").textContent = n.octave; layer.querySelector(".tn-note")?.classList.add("live");
  layer.querySelector(".tn-note")?.classList.toggle("glow", good);
  $("tn-c").textContent = `${n.cents > 0 ? "+" : ""}${n.cents} cents · ${fs.toFixed(1)} Hz`;
  const a = Math.abs(n.cents);
  t.say(good ? "In tune" : a <= 12 ? (n.cents < 0 ? "A little flat" : "A little sharp") : n.cents < 0 ? "Flat" : "Sharp", good ? "good" : a <= 12 ? "close" : "off");
  const needle = document.getElementById("tn-needle");
  if (needle) { needle.classList.remove("idle"); needle.classList.toggle("good", good); needle.style.transform = `rotate(${(Math.max(-50, Math.min(50, n.cents)) * 1.4).toFixed(1)}deg)`; }
}

/* The marker is green in tune, amber when close, red when well off, and
   says which way it's off. */
function showGauge(t, cents, good) {
  $("tn-lamp").classList.add("on");
  $("tn-pill").textContent = Math.abs(cents) > TUNE.far ? "" : `${cents > 0 ? "+" : ""}${cents} cents`; /* past 50 it's another note: the words say which */
  const dot = $("tn-dot");
  dot.classList.remove("idle"); dot.classList.toggle("good", good); dot.classList.toggle("far", !good && Math.abs(cents) > 25);
  dot.classList.toggle("flat", cents < 0);
  $("tn-tag").textContent = good ? "" : cents < 0 ? "Too low" : "Too high";
  dot.style.left = meterPos(cents).toFixed(2) + "%";
}
