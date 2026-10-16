// German practice (2.10): a song's own words, a little more German at each
// level. The song is translated once with your Anthropic key (only songs in
// your library, only when you ask), kept with the song on this phone, and never
// shared or backed up. core.js applies a level to the display (germanBlocks).
// Loaded on first use.
import { Tabs, parseBlocks, sungText, deSource, cleanGerman, deSpans, DE_LEVELS } from "./core.js";
import { $, data, esc, icon, layer, toast, busy, AI, aiKey, askClaude, aiError, parseJSON } from "./app.js";

const SYSTEM = `You help an English speaker learn German through songs they play. You get numbered lines of a song from their own library, as JSON. Reply with JSON only:
{"lines":[{"i":number,"de":string,"s":[{"w":number,"n":number,"l":1|2|3,"de":string,"g":"der"|"die"|"das"|"","lemma":string,"en":string,"pl":string,"built":string,"note":string}]}]}
- "de": the whole line in natural, singable German, not word for word, about the same length.
- "s": swaps that replace English words in place. Words are numbered from 0, split by spaces exactly as given; "w" is the first word replaced, "n" how many. Never put punctuation in a swap's "de".
- l 1 (Basic): up to two very common nouns or fixed words per line (night, love, home, heart, day, yes, no, today).
- l 2 (Common): other everyday nouns, adjectives and adverbs, in the form they take here (adjective endings, plural nouns). No verbs at levels 1 and 2.
- l 3 (Intermediate): phrases of two or more words, verbs included, in correct German grammar, together covering most of the line. They may contain level 1 and 2 words.
- Swaps of one level never overlap each other.
- Nouns: "g" the singular article, "lemma" the singular with article ("das Boot"), "pl" the plural with article ("die Boote"). Other words: "g" "", "lemma" the dictionary form.
- "en": the meaning in English, a few words. "built": for a compound noun, its parts with meanings ("Hafen (harbor) + Mauer (wall)"), otherwise "". "note": one short sentence on why it takes this form in this line (case, ending, word order), or "".
- Translate only the lines given. Never add, complete or look up lyrics.`;

const linesOf = song => sungText(parseBlocks(song.body || ""));
const fresh = song => !!song.de && song.de.src === deSource(linesOf(song));

async function ask(lines, extra = "") {
  const content = JSON.stringify(lines.map((l, i) => ({ i, line: l.text }))) + extra;
  const j = parseJSON(await askClaude({ model: AI.vision, system: SYSTEM, content, maxTokens: 16000 }));
  return cleanGerman(j, lines);
}
// Translate the whole song, in batches (long songs stay within one reply each).
async function translate(song, step) {
  const lines = linesOf(song), out = [];
  for (let k = 0; k < lines.length; k += 14) {
    step?.(k, lines.length);
    out.push(...await ask(lines.slice(k, k + 14)));
  }
  song.de = { v: 1, src: deSource(lines), at: new Date().toISOString(), lines: out };
  if (!song.deLevel) song.deLevel = data.settings.deLevel || 1;
  Tabs.save(data);
}
// One line of the song at a level, as plain text (the level picker's example).
function sample(song, level) {
  const lines = linesOf(song);
  const i = Math.max(0, song.de.lines.findIndex(t => t.s.some(x => x.l <= Math.min(level, 3))));
  const t = song.de.lines[i], tok = lines[i]?.tokens || [];
  if (!t) return "";
  if (level >= 4) return esc(t.de);
  const spans = deSpans(t.s, level);
  const out = [];
  for (let w = 0; w < tok.length; w++) {
    const sp = spans.find(x => x.w === w);
    if (sp) { out.push(`<span class="de${sp.g ? " g-" + sp.g : ""}">${esc(sp.de)}</span>`); w += sp.n - 1; } else out.push(esc(tok[w]));
  }
  return out.join(" ");
}

export function germanSheet(song, redraw) {
  layer.innerHTML = `<div class="scrim" id="de-scrim"></div><div class="panel de-sheet" role="dialog" aria-label="German practice"><div class="grab"></div>
    <div class="ph"><button class="tb" id="de-x">Close</button><h2>German practice</h2><span style="width:56px"></span></div><div class="pbody" id="de-body"></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("de-scrim").onclick = close; $("de-x").onclick = close;
  let state = { busy: false, err: "", step: "" };
  const paint = () => {
    const body = $("de-body");
    if (!body) return;
    if (state.busy) { body.innerHTML = `<div class="easy-wait">${busy(state.step || "Translating the song")}</div><p class="foot">A few seconds per verse. Only this song's words are sent, to Anthropic.</p>`; return; }
    if (!fresh(song)) {
      const stale = !!song.de;
      body.innerHTML = `<p class="easy-note">${stale ? "The song's words changed since it was translated. Translate it again to practice with the new words." : "Practice German with this song: common words first, then phrases, then the whole song. Tap any German word for its meaning, gender and a short grammar note."}</p>
        ${state.err ? `<p class="err">${esc(state.err)}</p>` : ""}
        ${aiKey() ? `<button class="btn primary cta" id="de-go" style="width:100%">${icon("chat")}${stale ? "Translate again" : "Translate this song"}</button>
        <p class="foot" style="margin-top:10px">Uses your Anthropic key once for this song, usually a few cents. The translation stays on this phone, isn't shared or backed up, and can be deleted here.</p>`
        : `<p class="foot">Add your Anthropic key in Settings > AI help to translate songs.</p>`}
        ${stale ? `<button class="btn" id="de-del" style="width:100%;margin-top:10px">Delete the old translation</button>` : ""}`;
      $("de-go")?.addEventListener("click", go);
      $("de-del")?.addEventListener("click", del);
      return;
    }
    const lvl = song.deLevel || 0;
    body.innerHTML = `<div class="de-levels" role="radiogroup" aria-label="Level">${DE_LEVELS.map((n, i) => `<button class="de-lv${lvl === i ? " on" : ""}" role="radio" aria-checked="${lvl === i}" data-lv="${i}"><i></i><span><b>${n}</b><small>${["German off for this song", "The most common words", "Everyday nouns and adjectives", "Whole phrases, real grammar", "The whole song in German"][i]}</small>${i ? `<em>${sample(song, i)}</em>` : ""}</span></button>`).join("")}</div>
      <div class="de-row"><span>English under each line</span><div class="seg mini" role="group" aria-label="English under each line">${[["off", "Off"], ["on", "On"]].map(([k, n]) => `<button data-en="${k}" class="${(data.settings.deEnglish === true) === (k === "on") ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <p class="foot">Nouns show their gender as a dotted line: <span class="de g-der">der</span> <span class="de g-die">die</span> <span class="de g-das">das</span>. Tap a German word in the song for its card.</p>
      <div class="actions" style="margin-top:12px"><button class="btn" id="de-del">Delete translation</button>${aiKey() ? `<button class="btn" id="de-go">Translate again</button>` : ""}</div>`;
    body.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { const i = +b.dataset.lv; song.deLevel = i; if (i) data.settings.deLevel = i; Tabs.save(data); redraw?.(); paint(); });
    body.querySelectorAll("[data-en]").forEach(b => b.onclick = () => { data.settings.deEnglish = b.dataset.en === "on"; Tabs.save(data); redraw?.(); paint(); });
    $("de-del").onclick = del;
    $("de-go")?.addEventListener("click", go);
  };
  const go = async () => {
    state = { busy: true, err: "", step: "" }; paint();
    try { await translate(song, (k, n) => { state.step = n > 14 ? `Translating lines ${k + 1} to ${Math.min(n, k + 14)} of ${n}` : "Translating the song"; paint(); }); state = { busy: false, err: "" }; redraw?.(); }
    catch (e) { state = { busy: false, err: e?.status === -1 ? "The translation didn't come back complete. Try again." : aiError(e) }; }
    paint();
  };
  const del = () => {
    const was = { de: song.de, lvl: song.deLevel };
    delete song.de; song.deLevel = 0; Tabs.save(data); redraw?.(); close();
    toast("Translation deleted", null, { label: "Undo", fn: () => { song.de = was.de; song.deLevel = was.lvl; Tabs.save(data); redraw?.(); } });
  };
  paint();
}

// ---- A German word's card ----
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE";
    const v = speechSynthesis.getVoices().find(x => /^de/i.test(x.lang));
    if (v) u.voice = v;
    u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { toast("This phone can't speak German aloud here."); }
}
let cardOff = null;
export function wordCard(song, el) {
  document.querySelector(".decard")?.remove(); cardOff?.();
  const [li, si] = el.dataset.de.split("."), t = song.de?.lines?.[+li];
  if (!t) return;
  const lines = linesOf(song), sw = si === "f" ? null : t.s[+si];
  const card = document.createElement("div");
  card.className = "decard glass";
  card.setAttribute("role", "dialog");
  const head = sw ? `${sw.g ? `<span class="art g-${sw.g}">${esc(sw.g)}</span> ` : ""}${esc(sw.g && sw.lemma ? sw.lemma.replace(/^(der|die|das)\s+/i, "") : sw.de)}` : esc(t.de);
  const say = sw ? (sw.lemma || sw.de) : t.de;
  card.innerHTML = `<div class="dc-w">${head}</div><div class="dc-t">${esc(sw ? sw.en : lines[+li]?.text || "")}</div>
    ${sw && sw.de !== (sw.lemma || "").replace(/^(der|die|das)\s+/i, "") && sw.lemma ? `<div class="dc-r"><b>Here</b><span>${esc(sw.de)}</span></div>` : ""}
    ${sw?.built ? `<div class="dc-r"><b>Built from</b><span>${esc(sw.built)}</span></div>` : ""}
    ${sw?.pl ? `<div class="dc-r"><b>Plural</b><span>${esc(sw.pl)}</span></div>` : ""}
    ${sw?.note ? `<div class="dc-r"><b>In this line</b><span>${esc(sw.note)}</span></div>` : ""}
    <div class="dc-b"><button class="btn sm" id="dc-say">${icon("note")}Hear it</button>${aiKey() ? `<button class="btn sm" id="dc-bad">Report</button>` : ""}<button class="btn sm primary" id="dc-ok">Got it</button></div>`;
  document.body.appendChild(card);
  const r = el.getBoundingClientRect(), h = card.offsetHeight;
  card.style.top = Math.max(12, r.bottom + 10 + h > innerHeight - 90 ? r.top - h - 10 : r.bottom + 10) + "px";
  const off = () => { card.remove(); document.removeEventListener("pointerdown", outside, true); cardOff = null; };
  const outside = e => { if (!card.contains(e.target)) off(); };
  setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
  cardOff = off;
  $("dc-ok").onclick = off;
  $("dc-say").onclick = () => speak(say);
  $("dc-bad")?.addEventListener("click", async () => {
    const b = $("dc-bad"); b.innerHTML = busy("Checking"); b.disabled = true;
    try {
      const [fixed] = await ask([lines[+li]], `\nThe learner reported this as wrong: "${sw ? sw.de : t.de}". Check the whole line carefully and correct anything wrong.`);
      song.de.lines[+li] = fixed; Tabs.save(data); off();
      document.dispatchEvent(new CustomEvent("tabs:redraw"));
      toast("Line checked and translated again");
    } catch (e) { b.textContent = "Report"; b.disabled = false; toast(aiError(e)); }
  });
}
