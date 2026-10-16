// Strum it (2.9): hears the guitar. Basic Pitch (Spotify, Apache-2.0) turns
// audio into notes on the phone; core.js names the chords (strumChords) or the
// riff (riffNotes). The library and its model (about 2 MB) load the first
// time Strum it is used, and nothing is sent anywhere.
let bp = null;
async function load() {
  if (bp) return bp;
  const m = await import("./vendor/basic-pitch/bp.js");
  const model = m.tf.loadGraphModel(new URL("./vendor/basic-pitch/model/model.json", import.meta.url).href);
  bp = { m, pitch: new m.BasicPitch(model) };
  return bp;
}
export const ready = () => load().then(() => true, () => false);
// Mono samples at any rate → notes [{ midi, start, dur, amp }].
export async function hear(samples, rate) {
  const { m, pitch } = await load();
  const x = rate === 22050 ? samples : resample(samples, rate, 22050);
  const frames = [], onsets = [], contours = [];
  await pitch.evaluateModel(x, (f, o, c) => { frames.push(...f); onsets.push(...o); contours.push(...c); }, () => {});
  const notes = m.noteFramesToTime(m.addPitchBendsToNoteEvents(contours, m.outputToNotesPoly(frames, onsets, 0.25, 0.25, 5)));
  return notes.map(n => ({ midi: n.pitchMidi, start: n.startTimeSeconds, dur: n.durationSeconds, amp: n.amplitude }));
}
function resample(x, from, to) {
  const n = Math.floor(x.length * to / from), y = new Float32Array(n), r = from / to;
  for (let i = 0; i < n; i++) { const p = i * r, j = Math.floor(p), f = p - j; y[i] = (x[j] || 0) * (1 - f) + (x[j + 1] || 0) * f; }
  return y;
}
