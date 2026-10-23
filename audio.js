// The Road: the band: metronome and drums. Split from app.js (4.15.1); app.js re-exports what other files use.
import { DRUM_SWING, Tabs, barHits, drumHits, drumLevelBar, drumStyle, grooveOf, grooveText, partOf } from "./core.js";
import { $, sound, toast } from "./ui.js";
import { aiKey } from "./aihelp.js";
import { READ_AT, byLength, data, findAI, gigHooks, loopFactor, paintLoop, pxPerSecond, scroll, songLength, usesMusic, viewing } from "./app.js";

// ---------- Metronome ----------
// While a song scrolls (on from the ring or the ••• menu), either a click or a
// drum beat (Settings > Playing): kick on 1 (and the middle of the bar), snare
// on the backbeats, a closed hi-hat on every eighth. It follows the song's
// tempo, slowed with Build up, and a tempo changed in Edit takes over on the
// next beat. A song with no tempo gets one looked up first. Hits are
// scheduled ahead on the audio clock, so they stay even.
export const metro = { timer: 0, next: 0, beat: 0, run: 0, bar: null };
/* 4.43.0 (#83): the band goes up to 150%, through one limiter so the loudest kick never clips */
export const BAND_MAX = 1.5;
export const metroVol = () => { const v = data.settings.metroVol; return v >= 0 && v <= BAND_MAX ? v : 0.8; };
const buses = new WeakMap();
function bandOut(audio) {
  let l = buses.get(audio);
  if (!l) {
    l = audio.createDynamicsCompressor();
    l.threshold.value = -4; l.knee.value = 2; l.ratio.value = 20; l.attack.value = 0.002; l.release.value = 0.1;
    l.connect(audio.destination); buses.set(audio, l);
  }
  return l;
}
/* Your band (4.7.0): in a gig, Beat plays the drums once he's joined (gigHooks.band). The bass went in 4.42.0. */
export const metroOn = () => data.settings.metronome || !!gigHooks.band?.drums;
export const metroDrums = () => data.settings.metroSound !== "click" || (!data.settings.metronome && !!gigHooks.band?.drums);
export async function startMetronome(song) {
  stopMetronome();
  if (!metroOn()) return;
  if (usesMusic(song)) return; /* the recording is playing: no drums on top */
  const run = ++metro.run;
  if (!song.bpm) {
    await tempoFor(song);
    if (run !== metro.run || !scroll.on) return;
    toast(song.bpm ? `Tempo found: ${song.bpm} BPM. Change it in Edit` : "No tempo for this song yet: playing at 90 BPM. Tap the tempo in Edit");
  }
  const audio = sound();
  if (!audio) return;
  metro.next = audio.currentTime + 0.05; metro.beat = 0; metro.bar = null;
  metro.timer = setInterval(() => {
    while (metro.next < audio.currentTime + 0.12) {
      const spb = 60 / ((song.bpm || 90) * loopFactor(song) * metroPace(song)), beats = song.beats || 4;
      /* Drop-out practice: every other bar is silent, so you hold the time. */
      const quiet = data.settings.metroDrop && Math.floor(metro.beat / beats) % 2 === 1, b = metro.beat % beats;
      const groove = grooveOf(song, data.settings);
      const style = drumStyle(groove.beat, { bpm: song.bpm || 90, beats, body: song.body });
      if (quiet) { /* a silent bar */ }
      else if (metroDrums() && songBar(song, b, beats, spb)) for (const h of barHits(metro.bar, b, DRUM_SWING[groove.swing] || 0.5)) drum(h.k, metro.next + h.at * spb, h.v);
      else if (metroDrums()) drumBeat(metro.next, b, beats, spb, style, groove.swing);
      else clickAt(metro.next, b === 0);
      metro.next += spb; metro.beat++;
    }
  }, 25);
}
/* With the speed dial set longer or shorter than the recording, the page
   moves slower or faster than the record, and the beat follows it: a 3:30
   song set to 4:12 scrolls and plays 20% slower. Needs the recording's
   length (from Get the song or a Listen link); 1x style plays the BPM. */
export const recLength = song => song.listen?.length || song.recLength || (song.durationSet ? 0 : song.duration) || 0;
export const metroPace = song => {
  const rec = recLength(song);
  return byLength() && rec > 0 ? Math.min(1.5, Math.max(0.5, rec / songLength(song))) : 1;
};
/* Looks up a missing tempo once per song per visit, and keeps what it finds. */
const tempoJobs = new Map();
export function tempoFor(song) {
  if (song.bpm) return Promise.resolve();
  if (!tempoJobs.has(song.id)) tempoJobs.set(song.id, findAI().then(m => m.findTempo(song)).catch(() => null).then(t => {
    if (!(t?.bpm > 0) || song.bpm) return;
    song.bpm = Math.round(Math.min(260, Math.max(30, t.bpm)));
    if (!song.beats && t.beats !== 4) song.beats = t.beats;
    Tabs.save(data);
  }));
  return tempoJobs.get(song.id);
}
/* A song's groove (drums, swing, bass) is looked up once, in the background,
   the first time it plays with the metronome or bass on, and when it is added.
   A lookup that finds nothing is not repeated this visit. force asks again
   from Edit and replaces what is there. */
const grooveJobs = new Map();
export function grooveFor(song, force = false) {
  if (!aiKey() || (song.groove && !force)) return Promise.resolve(null);
  if (force || !grooveJobs.has(song.id)) grooveJobs.set(song.id, findAI().then(m => m.findGroove(song)).catch(() => null).then(g => {
    if (!g || (song.groove && !force)) return null;
    song.groove = g; Tabs.save(data);
    if (!force) toast(`Groove: ${grooveText(g)}. Change it in Edit`);
    return g;
  }));
  return grooveJobs.get(song.id);
}
/* Drums that fit the song (3.23.0): the AI writes a bar for each kind of section and a fill, once, in
   the background, the first time the band plays the song with drums. Until then the general beat plays. */
export const drumJobs = new Map();
export function drumsFor(song, manual = false) {
  if (!aiKey() || song.drums || (song.beats || 4) !== 4) return null;
  if (drumJobs.has(song.id)) return drumJobs.get(song.id);
  const parts = [...new Set([...($("sheet")?.querySelectorAll(":scope > .sec") || [])].map(el => partOf(el.textContent)))];
  const job = findAI().then(m => m.findDrums(song, parts)).catch(() => null).then(d => {
    drumJobs.delete(song.id); /* a miss can be tried again on the next Play or from the Practice row */
    if (!d) { if (manual && viewing === song) { toast("Couldn't write drums just now. Try again"); paintLoop(song); } return null; }
    if (song.drums) return null;
    song.drums = d; Tabs.save(data);
    if (viewing === song) { toast("Drums written for this song. Busier or simpler in Practice"); paintLoop(song); }
    return d;
  });
  drumJobs.set(song.id, job);
  return job;
}
/* The song's own bar for this pulse: picked on beat 1 from the section at the reading line, or the fill
   when the next section starts within the bar. Returns false to fall back to the general beat. */
function songBar(song, b, beats, spb) {
  const d = song.drums;
  if (!d || beats !== 4) return false;
  if (b === 0 || !metro.bar) {
    const line = innerHeight * READ_AT, secs = [...($("sheet")?.querySelectorAll(":scope > .sec") || [])];
    let cur = null, next = null;
    for (const el of secs) { const top = el.getBoundingClientRect().top; if (top <= line + 4) cur = el; else { next = next || el; } }
    const ahead = pxPerSecond(song) * loopFactor(song) * spb * beats;
    const part = partOf(cur?.textContent || "verse");
    const fill = d.fill && scroll.on && next && next.getBoundingClientRect().top - line <= ahead && next.getBoundingClientRect().top - line > 0;
    metro.bar = drumLevelBar(fill ? d.fill : d[part] || d[part === "prechorus" ? "verse" : part === "solo" ? "chorus" : "verse"] || d.verse || d.chorus, fill ? 0 : d.level || 0);
  }
  return !!metro.bar;
}
export function stopMetronome() { clearInterval(metro.timer); metro.timer = 0; metro.run++; }
/* Settings plays one bar in the chosen sound, beat and volume. */
export function metroPreview() {
  const audio = sound();
  if (!audio) return;
  const t = audio.currentTime + 0.05, spb = 0.55, style = drumStyle(data.settings.metroBeat === "auto" || !data.settings.metroBeat ? "rock" : data.settings.metroBeat, { beats: 4 });
  for (let b = 0; b < 4; b++) metroDrums() ? drumBeat(t + b * spb, b, 4, spb, style) : clickAt(t + b * spb, b === 0);
}
/* A steady beat for the practice drill (practice.js): the drums, or the click if that is what Settings
   uses, or with hats only the hi-hat. onBeat(i, t) is called a little before beat i sounds at audio time t. */
export function beatTrack(bpm, onBeat, { hats = false } = {}) {
  const audio = sound();
  if (!audio) return null;
  const spb = 60 / bpm, style = drumStyle("rock", { bpm, beats: 4 });
  let i = 0, t = audio.currentTime + 0.2;
  const t0 = t;
  /* hats: only a short high click (brighter on 1), far above the guitar, so the microphone can filter it out (3.8.2 to 3.8.4) */
  const hit = (t, b) => hats ? drum("tick", t, b === 0 ? 1 : 0.6) : metroDrums() ? drumBeat(t, b, 4, spb, style) : clickAt(t, b === 0);
  const tick = () => { while (t < audio.currentTime + 0.35) { hit(t, i % 4); onBeat?.(i, t); i++; t += spb; } };
  tick();
  const id = setInterval(tick, 40);
  return { audio, t0, spb, lag: (audio.baseLatency || 0) + (audio.outputLatency || 0), stop: () => clearInterval(id) };
}
/* The classic click: a short high beep, higher on 1. */
export function clickAt(t, accent) {
  const audio = sound();
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), v = metroVol();
  o.frequency.value = accent ? 1320 : 880;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, (accent ? 0.3 : 0.18) * v), t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  o.connect(g).connect(bandOut(audio));
  o.start(t); o.stop(t + 0.09);
}
/* One pulse of the pattern (the patterns live in core.js). Swing moves the
   off-beat eighth later; the chosen amount is in Settings > Playing. */
function drumBeat(t, b, beats, spb, style, swingKey = data.settings.metroSwing) {
  const swing = DRUM_SWING[swingKey] || 0.5;
  for (const h of drumHits(style, b, beats, swing)) drum(h.k, t + h.at * spb, h.v);
}
/* White noise, made once per audio engine, for the snare and the hi-hat. */
let noiseBuf = null;
const noise = audio => {
  if (noiseBuf?.sampleRate === audio.sampleRate) return noiseBuf;
  noiseBuf = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
};
/* Synthesized drums: nothing to download.
   kick   a sine that drops from 150 to 50 Hz, with a short knock so a phone
          speaker that can't play the low end still sounds it
   snare  a short tone for the drum body under a burst of filtered noise
   hat    a very short burst of high noise: a closed hi-hat
   open   the same noise, longer: an open hi-hat
   stick  a short high knock with a click of noise: a side-stick on the rim */
export function drum(kind, t, vel = 1) {
  const audio = sound();
  if (!audio) return;
  try {
    const out = audio.createGain();
    out.gain.value = metroVol();
    out.connect(bandOut(audio));
    const env = (node, peak, len) => {
      const g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak * vel, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      node.connect(g).connect(out);
    };
    const burst = (type, freq, q, peak, len) => {
      const src = audio.createBufferSource(), f = audio.createBiquadFilter();
      src.buffer = noise(audio); f.type = type; f.frequency.value = freq; f.Q.value = q;
      src.connect(f); env(f, peak, len);
      src.start(t, Math.random() * 0.5); src.stop(t + len + 0.02);
    };
    if (kind === "kick") {
      const o = audio.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
      env(o, 0.75, 0.32);
      o.start(t); o.stop(t + 0.34);
      burst("bandpass", 1800, 1.2, 0.12, 0.02);
    } else if (kind === "snare") {
      const o = audio.createOscillator();
      o.type = "triangle"; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.05);
      env(o, 0.25, 0.09);
      o.start(t); o.stop(t + 0.1);
      burst("highpass", 1400, 0.7, 0.35, 0.17);
    } else if (kind === "tick") {
      /* the practice beat: a short, bright click (4.2 kHz on the 1, 3.5 kHz after), loud enough to hear
         over a guitar, and far above the range the microphone listens to for strums (3.8.4) */
      const o = audio.createOscillator();
      o.frequency.value = vel >= 1 ? 4200 : 3500;
      env(o, 0.5, 0.035);
      o.start(t); o.stop(t + 0.05);
    } else if (kind === "open") {
      burst("highpass", 7000, 0.8, 0.12, 0.22);
    } else if (kind === "stick") {
      const o = audio.createOscillator();
      o.type = "triangle"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.03);
      env(o, 0.3, 0.05);
      o.start(t); o.stop(t + 0.06);
      burst("bandpass", 2600, 3, 0.28, 0.035);
    } else {
      burst("highpass", 7500, 0.8, 0.14, 0.045);
    }
  } catch {}
}
