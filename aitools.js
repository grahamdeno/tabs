// Make it easier (capo and simpler chords) and Spark tone: AI help for a song,
// loaded the first time either is opened.
import { Tabs, chordShape, prefersFlats, transposeKey } from "./core.js";
import { $, data, esc, icon, layer, toast, busy, aiKey, askClaude, aiError, parseJSON, chordNames, chordSVG, songKey, redraw } from "./app.js";

// Shapes you'd play at each capo, for the song as it sounds now.
function capoTable(song) {
  const steps = song.transpose || 0, k = songKey(song);
  return Array.from({ length: 8 }, (_, c) => chordNames(song.body, steps - c, prefersFlats(k, steps - c)));
}

// The player's usual chords, across the whole library.
function commonChords() {
  const count = {};
  for (const s of data.songs) if (s.format !== "tab")
    for (const n of chordNames(s.body, s.transpose || 0, prefersFlats(songKey(s), s.transpose || 0))) count[n] = (count[n] || 0) + 1;
  return Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([n]) => n);
}

const EASY_SYSTEM = `You help a guitarist play a song more easily without changing how it sounds.
Reply with JSON only, no other text: {"capo": number, "substitutions": {"ShapeName": "EasierChord"}, "note": string}
- "capo": 0 to 7. The user gives the chord shapes for each capo position. Pick the one that is easiest to play: open chords over barre chords, fewer different shapes, and shapes this player already uses often. Use 0 if no capo helps.
- "substitutions": at most 4, keyed by shape names from the chosen capo's list. Only swap a chord for a simpler one that keeps the song's sound, like F to Fmaj7, Bm to Bm7, or B7 for a hard B. Leave it empty if nothing clearly helps.
- "note": one plain sentence, under 20 words, saying what changed and why. No praise.`;

async function suggestEasier(song) {
  const table = capoTable(song);
  const content = `Chords as written, in order: ${table[0].join(" ")}
Shapes at each capo:
${table.map((t, c) => `Capo ${c}: ${t.join(" ")}`).join("\n")}
Chords this player uses most: ${commonChords().join(" ") || "unknown"}`;
  const out = parseJSON(await askClaude({ content, system: EASY_SYSTEM, maxTokens: 4000 }));
  const capo = Math.max(0, Math.min(7, parseInt(out.capo, 10) || 0));
  const shapes = table[capo];
  const subs = {};
  for (const [from, to] of Object.entries(out.substitutions || {})) {
    if (Object.keys(subs).length >= 4) break;
    if (shapes.includes(from) && typeof to === "string" && to !== from && chordShape(to)) subs[from] = to;
  }
  const note = String(out.note || "").trim().slice(0, 160);
  return { capo, subs, note, on: true, before: table[0], after: shapes.map(n => subs[n] || n) };
}

export function easierSheet(song) {
  let result = song.easier || null, working = false;
  const cards = names => [...new Set(names)].map(n => `<div class="ecard">${chordSVG(n, 0.82)}</div>`).join("");
  const paint = () => {
    const panel = $("easy-panel");
    if (!panel) return;
    if (working) {
      panel.innerHTML = `<div class="pc-head">${icon("wand")}<span>Make it easier</span></div>
        <div class="easy-wait">${busy("Finding easier shapes")}</div>`;
      return;
    }
    if (!result) return;
    const same = !result.capo && !Object.keys(result.subs || {}).length;
    panel.innerHTML = `
      <div class="pc-head">${icon("wand")}<span>Make it easier</span></div>
      ${same ? `<p class="easy-note">This song is already about as easy as it gets in this key.</p>` : `
      <div class="tags">${result.capo ? `<span class="tag">Capo ${result.capo}</span>` : ""}${Object.entries(result.subs || {}).map(([a, b]) => `<span class="tag">${esc(a)} → ${esc(b)}</span>`).join("")}</div>
      ${result.note ? `<p class="easy-note">${esc(result.note)}</p>` : ""}
      <div class="elabel">Before</div><div class="erow">${cards(result.before || [])}</div>
      <div class="elabel">After</div><div class="erow">${cards(result.after || [])}</div>`}
      <div class="actions">
        <button class="btn" id="e-again">${icon("wand")}Try again</button>
        ${same ? `<button class="btn primary" id="e-close">OK</button>`
          : song.easier === result && result.on ? `<button class="btn primary" id="e-off">Turn off</button>`
          : `<button class="btn primary" id="e-apply">${song.easier === result ? "Turn on" : "Apply"}</button>`}
      </div>`;
    $("e-again").onclick = ask;
    $("e-close")?.addEventListener("click", close);
    $("e-off")?.addEventListener("click", () => { result.on = false; Tabs.save(data); close(); redraw?.(); toast("Easier off", $("easy")); });
    $("e-apply")?.addEventListener("click", () => { result.on = true; song.easier = result; Tabs.save(data); close(); redraw?.(); toast(result.capo ? `Capo ${result.capo}` : "Easier on", $("easy")); });
  };
  const close = () => { if (!working) layer.innerHTML = ""; };
  const ask = async () => {
    working = true; paint();
    try { result = await suggestEasier(song); }
    catch (e) {
      working = false;
      $("easy-panel").innerHTML = `<div class="pc-head">${icon("wand")}<span>Make it easier</span></div>
        <p class="ai-note">${esc(aiError(e))}</p>
        <div class="actions"><button class="btn" id="e-close">Close</button><button class="btn primary" id="e-retry">Try again</button></div>`;
      $("e-close").onclick = close; $("e-retry").onclick = ask;
      return;
    }
    working = false; paint();
  };
  layer.innerHTML = `<div class="scrim" id="e-scrim"></div><div class="panel card" id="easy-panel" role="dialog" aria-label="Make it easier"></div>`;
  $("e-scrim").onclick = close;
  if (result) paint(); else ask();
}

// ---------- Spark tone ----------
// A starting tone for the Spark amp, from the song's title, artist, key and chord
// names (no lyrics). Saved with the song; dial it in on the Spark app.
const TONE_SYSTEM = `You suggest a starting guitar tone on a Positive Grid Spark amp for one song.
Reply with JSON only, no other text:
{"sound": string, "amp": string, "gain": number, "bass": number, "mid": number, "treble": number, "master": number,
 "gate": string, "comp": string, "drive": string, "mod": string, "delay": string, "reverb": string, "guitar": string}
- "sound": one plain sentence, under 20 words, describing the tone you're aiming for.
- "amp": the amp style in plain words with the classic amp it is modeled on, like "American clean (Fender Twin style)" or "British crunch (Marshall Plexi style)". Spark's amp models are based on such amps; do not invent exact Spark preset names.
- Knobs are 0 to 10 in steps of 0.5.
- Each pedal slot: "Off", or the pedal style and its key settings in a few words, like "Tube Screamer style: drive 3, level 6" or "Hall: level 3, decay 4".
- "guitar": one short tip on pickup and tone knob.
If you don't know the song, base it on the artist and the genre the chords suggest, and say so in "sound". No praise.`;

async function suggestTone(song) {
  const steps = song.transpose || 0, k = songKey(song);
  const content = `Song: ${song.title}${song.artist ? ` by ${song.artist}` : ""}
Key: ${transposeKey(k, steps) || "unknown"}
Chords: ${chordNames(song.body, steps, prefersFlats(k, steps)).join(" ") || "none (tab)"}`;
  const t = parseJSON(await askClaude({ content, system: TONE_SYSTEM, maxTokens: 3000 }));
  const knob = v => Math.min(10, Math.max(0, Math.round((+v || 0) * 2) / 2));
  const str = v => String(v || "Off").slice(0, 90);
  return { sound: str(t.sound), amp: str(t.amp), gain: knob(t.gain), bass: knob(t.bass), mid: knob(t.mid), treble: knob(t.treble), master: knob(t.master),
    gate: str(t.gate), comp: str(t.comp), drive: str(t.drive), mod: str(t.mod), delay: str(t.delay), reverb: str(t.reverb), guitar: str(t.guitar), at: new Date().toISOString() };
}

export function toneSheet(song) {
  let working = false;
  const knobs = t => ["gain", "bass", "mid", "treble", "master"].map(k =>
    `<div class="knob"><div class="kv">${t[k]}</div><div class="kbar"><i style="width:${t[k] * 10}%"></i></div><div class="kl">${k[0].toUpperCase() + k.slice(1)}</div></div>`).join("");
  const chain = t => [["Gate", t.gate], ["Comp", t.comp], ["Drive", t.drive], ["Mod", t.mod], ["Delay", t.delay], ["Reverb", t.reverb]].map(([n, v]) =>
    `<div class="fx ${/^off$/i.test(v) ? "off" : ""}"><span class="fxn">${n}</span><span class="fxv">${esc(v)}</span></div>`).join("");
  const paint = () => {
    const p = $("tone-panel");
    if (working) { p.innerHTML = `<div class="pc-head">${icon("amp")}<span>Spark tone</span></div><div class="easy-wait">${busy("Dialing in a tone")}</div>`; return; }
    const t = song.tone;
    p.innerHTML = `
      <div class="pc-head">${icon("amp")}<span>Spark tone · ${esc(song.title)}</span></div>
      <p class="easy-note">${esc(t.sound)}</p>
      <div class="elabel">Amp</div><div class="ampname">${esc(t.amp)}</div>
      <div class="knobs">${knobs(t)}</div>
      <div class="elabel">Pedals, in order</div><div class="chain">${chain(t)}</div>
      <div class="elabel">Guitar</div><p class="easy-note" style="margin-bottom:10px">${esc(t.guitar)}</p>
      <p class="tone-foot">A starting point to dial in on the Spark app, then adjust by ear.</p>
      <div class="actions">${aiKey() ? `<button class="btn" id="t-again">${icon("wand")}Try again</button>` : ""}<button class="btn primary" id="t-done">Done</button></div>`;
    $("t-done").onclick = close;
    $("t-again")?.addEventListener("click", ask);
  };
  const close = () => { if (!working) layer.innerHTML = ""; };
  const ask = async () => {
    working = true; paint();
    try { song.tone = await suggestTone(song); Tabs.save(data); working = false; paint(); }
    catch (e) {
      working = false;
      $("tone-panel").innerHTML = `<div class="pc-head">${icon("amp")}<span>Spark tone</span></div><p class="ai-note">${esc(aiError(e))}</p>
        <div class="actions"><button class="btn" id="t-close">Close</button>${aiKey() ? `<button class="btn primary" id="t-retry">Try again</button>` : ""}</div>`;
      $("t-close").onclick = close; $("t-retry")?.addEventListener("click", ask);
    }
  };
  layer.innerHTML = `<div class="scrim" id="t-scrim"></div><div class="panel card tone" id="tone-panel" role="dialog" aria-label="Spark tone"></div>`;
  $("t-scrim").onclick = close;
  if (song.tone) paint(); else if (aiKey()) ask();
}
