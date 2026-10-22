// Language practice (German until 4.36.0; now German, Spanish or Russian, one for every song): a song's
// own words, a little more of the language at each level. The song is translated once with your
// Anthropic key (only songs in your library, only when you ask), kept with the song on this phone, and
// never shared or backed up. core.js applies a level to the display (germanBlocks). Loaded on first use.
import { Tabs, parseBlocks, sungText, deSource, cleanGerman, deSpans, DE_LEVELS, bestVoice, LANGS, langOf, langChosen } from "./core.js";
import { $, data, esc, icon, layer, toast, busy, AI, aiKey, askClaude, aiError, parseJSON, deJobs, go } from "./app.js";

/* What the AI is told, per language. The levels and the JSON are the same for all three. */
const NOUNS = {
  de: `- Nouns: "g" the singular article ("der", "die" or "das"), "lemma" the singular with article ("das Boot"), "pl" the plural with article ("die Boote"). Other words: "g" "", "lemma" the dictionary form.
- "built": for a compound noun, its parts with meanings ("Hafen (harbor) + Mauer (wall)"), otherwise "".`,
  es: `- Nouns: "g" the singular article ("el" or "la"), "lemma" the singular with article ("el río"), "pl" the plural with article ("los ríos"). Other words: "g" "", "lemma" the dictionary form (verbs in the infinitive).
- "built": "".`,
  ru: `- Write every Russian word with its stress marked: a combining acute accent (U+0301) on the stressed vowel of each word of two or more syllables (река́, доро́ге); ё needs no mark.
- "tr" on each line and on each swap: the same Russian in Latin letters for an English reader, the stressed vowel with an acute (reká, doróge), ' for the soft sign.
- Nouns: "g" the gender ("m", "f" or "n"), "lemma" the nominative singular with stress ("река́"), "pl" the nominative plural with stress ("ре́ки"). Other words: "g" "", "lemma" the dictionary form (verbs in the infinitive).
- "built": "".`
};
const BASIC = { de: "night, love, home, heart, day, yes, no, today", es: "night, love, home, heart, day, yes, no, today", ru: "night, love, home, heart, day, yes, no, today" };
const systemFor = lang => {
  const L = LANGS[lang] || LANGS.de;
  return `You help an English speaker learn ${L.name} through songs they play. You get numbered lines of a song from their own library, as JSON. Reply with JSON only:
{"lines":[{"i":number,"de":string,${lang === "ru" ? `"tr":string,` : ""}"s":[{"w":number,"n":number,"l":1|2|3,"de":string,${lang === "ru" ? `"tr":string,` : ""}"g":string,"lemma":string,"en":string,"pl":string,"built":string,"note":string}]}]}
- "de": the whole line in natural, singable ${L.name}, not word for word, about the same length.
- "s": swaps that replace English words in place. Words are numbered from 0, split by spaces exactly as given; "w" is the first word replaced, "n" how many. Never put punctuation in a swap's "de".
- l 1 (Basic): up to two very common nouns or fixed words per line (${BASIC[lang] || BASIC.de}).
- l 2 (Common): other everyday nouns, adjectives and adverbs, in the form they take here (agreement, plural). No verbs at levels 1 and 2. (The app shows at most two of these a line at Common, nouns first, and all of them at Intermediate, so mark every one you find.)
- l 3 (Intermediate): phrases of two or more words, verbs included, in correct ${L.name} grammar, together covering most of the line. They may contain level 1 and 2 words.
- Swaps of one level never overlap each other.
${NOUNS[lang] || NOUNS.de}
- "en": the meaning in English, a few words. "note": one short sentence on why it takes this form in this line (case, ending, agreement, word order), or "".
- Translate only the lines given. Never add, complete or look up lyrics.`;
};
const lang = () => langOf(data), Lname = () => (LANGS[lang()] || LANGS.de).name;

const linesOf = song => sungText(parseBlocks(song.body || ""));
const fresh = song => !!song.de && song.de.src === deSource(linesOf(song)) && (song.de.lang || "de") === lang();

async function ask(lines, extra = "") {
  const content = JSON.stringify(lines.map((l, i) => ({ i, line: l.text }))) + extra;
  /* Streamed, so the connection never sits silent while the reply is written. */
  const j = parseJSON(await askClaude({ model: AI.vision, system: systemFor(lang()), content, maxTokens: 8000, stream: true }));
  return cleanGerman(j, lines, lang());
}
// ---- Translating in the background ----
// Six lines a request, two requests at a time. Each batch lands in the song as
// it arrives, so the first verse turns German while the rest is on its way, and
// you can keep reading, playing or leave the song. Lines already done are kept
// if the connection drops; the next start picks up the rest.
const BATCH = 6, AT_ONCE = 2;
const progress = (song, lines) => document.dispatchEvent(new CustomEvent("tabs:de-progress", { detail: { id: song.id, lines } }));
export function startTranslation(song) {
  if (deJobs.has(song.id)) return deJobs.get(song.id).promise;
  const lines = linesOf(song), src = deSource(lines);
  if (!song.de || song.de.src !== src || song.de.lines?.length !== lines.length || (song.de.lang || "de") !== lang()) song.de = { v: 1, lang: lang(), src, at: new Date().toISOString(), lines: lines.map(() => null), partial: true };
  if (!song.deLevel) song.deLevel = data.settings.deLevel || 1;
  Tabs.save(data);
  const todo = lines.map((_, i) => i).filter(i => !song.de.lines[i]);
  const batches = [];
  for (let k = 0; k < todo.length; k += BATCH) batches.push(todo.slice(k, k + BATCH));
  const job = { total: lines.length, done: lines.length - todo.length, err: null };
  deJobs.set(song.id, job);
  progress(song, false);
  const runBatch = async idx => {
    let out;
    try { out = await ask(idx.map(i => lines[i])); }
    catch (e) { if (e.status === 0 || e.status >= 500) out = await ask(idx.map(i => lines[i])); else throw e; }   /* one retry for a dropped connection or a busy service */
    if (song.de?.src !== src) return;   /* deleted or changed meanwhile */
    idx.forEach((i, k) => { song.de.lines[i] = out[k]; });
    job.done += idx.length; Tabs.save(data); progress(song, true);
  };
  job.promise = (async () => {
    const queue = [...batches];
    const worker = async () => { while (queue.length) await runBatch(queue.shift()); };
    try {
      await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
      if (song.de?.src === src) { delete song.de.partial; song.de.at = new Date().toISOString(); Tabs.save(data); }
      deJobs.delete(song.id); progress(song, true);
      const here = location.hash === "#/song/" + encodeURIComponent(song.id);
      toast(here ? `${Lname()} ready for every line` : `${Lname()} ready: ${song.title}`, null, here ? undefined : { label: "Open", fn: () => go("#/song/" + encodeURIComponent(song.id)) });
    } catch (e) {
      job.err = aiError(e);
      if (deJobs.get(song.id) === job) deJobs.delete(song.id);
      progress(song, false);
      toast(`${Lname()} stopped at ${job.done} of ${job.total} lines. ${job.err}`, null, { label: "Retry", fn: () => startTranslation(song) });
    }
  })();
  return job.promise;
}
const partial = song => !!song.de?.partial || !!song.de?.lines?.some(l => !l);
// One line of the song at a level, as plain text (the level picker's example).
function sample(song, level) {
  const lines = linesOf(song);
  const i = Math.max(0, song.de.lines.findIndex(t => t && t.s.some(x => x.l <= Math.min(level, 3))));
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
  if (!langChosen(data)) return langPicker(() => germanSheet(song, redraw)); /* 4.36.0: pick a language the first time */
  const N = Lname();
  layer.innerHTML = `<div class="scrim" id="de-scrim"></div><div class="panel de-sheet" role="dialog" aria-label="${N} practice"><div class="grab"></div>
    <div class="ph"><button class="tb" id="de-x">Close</button><h2>${N} practice</h2><span style="width:56px"></span></div><div class="pbody" id="de-body"></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("de-scrim").onclick = close; $("de-x").onclick = close;
  let state = { busy: false, err: "", step: "" };
  const paint = () => {
    const body = $("de-body");
    if (!body) return;
    const job = deJobs.get(song.id);
    if (job) {
      body.innerHTML = `<div class="easy-wait">${busy(`Translating: ${job.done} of ${job.total} lines`)}</div>
        <p class="easy-note">Keep reading or playing. The song turns ${N} verse by verse, and Tools shows how far along it is. You can close this, or leave the song: you'll hear when it's ready.</p>
        <button class="btn primary cta" id="de-ok" style="width:100%">OK</button>`;
      $("de-ok").onclick = close;
      return;
    }
    if (fresh(song) && partial(song)) {
      const left = song.de.lines.filter(l => !l).length;
      body.innerHTML = `<p class="easy-note">${left} of ${song.de.lines.length} lines still need translating. The rest are ready to practice.</p>
        ${aiKey() ? `<button class="btn primary cta" id="de-go" style="width:100%">${icon("chat")}Finish translating</button>` : ""}
        <button class="btn" id="de-levels" style="width:100%;margin-top:10px">Choose a level</button>`;
      $("de-go")?.addEventListener("click", go);
      $("de-levels").onclick = () => { state.levels = true; paint(); };
      if (!state.levels) return;
    }
    if (!fresh(song)) {
      const stale = !!song.de;
      body.innerHTML = `<p class="easy-note">${stale ? "The song's words changed since it was translated. Translate it again to practice with the new words." : `Practice ${N} with this song: common words first, then phrases, then the whole song. Tap any ${N} word for its meaning${lang() === "ru" ? ", how it sounds" : ""}, gender and a short grammar note.`}</p>
        ${state.err ? `<p class="err">${esc(state.err)}</p>` : ""}
        ${aiKey() ? `<button class="btn primary cta" id="de-go" style="width:100%">${icon("chat")}${stale ? "Translate again" : "Translate this song"}</button>
        <p class="foot" style="margin-top:10px">Uses your Anthropic key once for this song, usually a few cents. The translation stays on this phone, isn't shared or backed up, and can be deleted here.</p>`
        : `<p class="foot">Add your Anthropic key in Settings > Keys to translate songs.</p>`}
        ${stale ? `<button class="btn" id="de-del" style="width:100%;margin-top:10px">Delete the old translation</button>` : ""}`;
      $("de-go")?.addEventListener("click", go);
      $("de-del")?.addEventListener("click", del);
      return;
    }
    const lvl = song.deLevel || 0;
    body.innerHTML = `<div class="de-levels" role="radiogroup" aria-label="Level">${DE_LEVELS.map((n, i) => `<button class="de-lv${lvl === i ? " on" : ""}" role="radio" aria-checked="${lvl === i}" data-lv="${i}"><i></i><span><b>${n}</b><small>${[`${N} off for this song`, "The most common words", "Everyday nouns and adjectives", "Whole phrases, real grammar", `The whole song in ${N}`][i]}</small>${i ? `<em>${sample(song, i)}</em>` : ""}</span></button>`).join("")}</div>
      <div class="de-row"><span>English under each line</span><div class="seg mini" role="group" aria-label="English under each line">${[["off", "Off"], ["on", "On"]].map(([k, n]) => `<button data-en="${k}" class="${(data.settings.deEnglish === true) === (k === "on") ? "on" : ""}">${n}</button>`).join("")}</div></div>
      <p class="foot">${GENDER_NOTE[lang()]} Tap a ${N} word in the song for its card.</p>
      <div class="actions" style="margin-top:12px"><button class="btn" id="de-del">Delete translation</button>${aiKey() ? `<button class="btn" id="de-go">Translate again</button>` : ""}</div>`;
    body.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { const i = +b.dataset.lv; song.deLevel = i; if (i) data.settings.deLevel = i; Tabs.save(data); redraw?.(); paint(); });
    body.querySelectorAll("[data-en]").forEach(b => b.onclick = () => { data.settings.deEnglish = b.dataset.en === "on"; Tabs.save(data); redraw?.(); paint(); });
    $("de-del").onclick = del;
    $("de-go")?.addEventListener("click", go);
  };
  /* Start in the background and get out of the way: the song turns into the language as lines arrive. */
  const go = () => {
    startTranslation(song);
    close(); redraw?.();
    toast(`Translating ${song.title}. Keep playing; it turns ${N} verse by verse.`);
  };
  const del = () => {
    if (deJobs.has(song.id)) deJobs.delete(song.id);
    const was = { de: song.de, lvl: song.deLevel };
    delete song.de; song.deLevel = 0; Tabs.save(data); redraw?.(); close();
    toast("Translation deleted", null, { label: "Undo", fn: () => { song.de = was.de; song.deLevel = was.lvl; Tabs.save(data); redraw?.(); } });
  };
  paint();
}

const GENDER_NOTE = {
  de: `Nouns show their gender as a dotted line: <span class="de g-der">der</span> <span class="de g-die">die</span> <span class="de g-das">das</span>.`,
  es: `Nouns show el or la as a dotted line: <span class="de g-el">el</span> <span class="de g-la">la</span>.`,
  ru: `Nouns show their gender as a dotted line: <span class="de g-m">masculine</span> <span class="de g-f">feminine</span> <span class="de g-n">neuter</span>. The mark over a vowel shows the stress.`
};
const GENDER_WORD = { m: "masculine", f: "feminine", n: "neuter" };
// ---- The first time: pick one language for every song (4.36.0) ----
export function langPicker(then, { title = "Learn a language" } = {}) {
  let pick = LANGS[data.settings.lang] ? data.settings.lang : "es";
  const row = k => { const L = LANGS[k]; return `<button class="lp-row${pick === k ? " on" : ""}" role="radio" aria-checked="${pick === k}" data-lang="${k}"><span class="lp-em lp-${k}">${L.short}</span><span class="lp-t"><b>${L.name}</b><small>${esc(L.own)} · ${esc(L.sample)}</small></span><i></i></button>`; };
  const paint = () => {
    layer.innerHTML = `<div class="scrim" id="lp-scrim"></div><div class="panel de-sheet lp" role="dialog" aria-label="${title}"><div class="grab"></div>
      <div class="pbody"><h2 class="lp-h">${title}</h2><p class="easy-note">Pick one. Every song you translate uses it, a little more of it at each level.</p>
      <div class="lp-list" role="radiogroup" aria-label="Language">${Object.keys(LANGS).map(row).join("")}</div>
      <p class="foot">Change it any time in Settings. Each song is translated once, with your Anthropic key.</p>
      <button class="btn primary cta" id="lp-go" style="width:100%">Use ${LANGS[pick].name}</button></div></div>`;
    $("lp-scrim").onclick = () => { layer.innerHTML = ""; };
    layer.querySelectorAll("[data-lang]").forEach(b => b.onclick = () => { pick = b.dataset.lang; paint(); });
    $("lp-go").onclick = () => { data.settings.lang = pick; Tabs.save(data); layer.innerHTML = ""; document.dispatchEvent(new CustomEvent("tabs:redraw")); then?.(); };
  };
  paint();
}
/* Settings: switching deletes the old language's translations, after saying how many */
export function switchLang(to, done) {
  const from = langOf(data), had = data.songs.filter(s => s.de);
  if (to === from && LANGS[data.settings.lang]) return done?.();
  const apply = () => {
    for (const s of had) { delete s.de; s.deLevel = 0; }
    data.settings.lang = to; Tabs.save(data); document.dispatchEvent(new CustomEvent("tabs:redraw")); done?.();
    toast(`Every song now uses ${LANGS[to].name}`);
  };
  if (!had.length) return apply();
  const n = had.length, F = LANGS[from].name, T = LANGS[to].name;
  layer.innerHTML = `<div class="scrim" id="ls-scrim"></div><div class="panel card ls-ask" role="alertdialog" aria-label="Switch to ${T}?">
    <h2 class="lp-h">Switch to ${T}?</h2><p class="easy-note">The ${F} in your ${n} translated song${n === 1 ? " is" : "s is"} deleted. Each song can be translated into ${T} when you open it.</p>
    <div class="actions"><button class="btn" id="ls-keep">Keep ${F}</button><button class="btn primary" id="ls-go">Switch</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  $("ls-scrim").onclick = close; $("ls-keep").onclick = close;
  $("ls-go").onclick = () => { close(); apply(); };
}
// ---- A word's card ----
function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(String(text).replace(/\u0301/g, "")); /* stress marks are for reading */
    const L = LANGS[lang()] || LANGS.de;
    u.lang = L.speech;
    const v = bestVoice(speechSynthesis.getVoices(), lang()); /* the most natural one installed */
    if (v) u.voice = v;
    u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    /* Only a basic voice here: say once where a natural one comes from. */
    const tipKey = "deVoiceTip" + (lang() === "de" ? "" : "_" + lang());
    if (!/premium|enhanced|erweitert|verbessert|neural|natural/i.test(v?.name || "") && !data.settings[tipKey]) {
      data.settings[tipKey] = true; Tabs.save(data);
      setTimeout(() => toast(`For a more natural voice, download a ${L.name} one: iPhone Settings > Accessibility > Spoken Content > Voices > ${L.name}${lang() === "de" ? ", then Anna (Premium)" : ""}.`), 1200);
    }
  } catch { toast(`This phone can't speak ${Lname()} aloud here.`); }
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
  const ru = lang() === "ru", bare = w => (w || "").replace(/^(der|die|das|el|la|los|las)\s+/i, "");
  /* German and Spanish show the article in its colour; Russian shows the word in its gender's colour, the sound and the gender */
  const head = !sw ? esc(t.de) : ru ? `<span class="${sw.g ? "g-" + sw.g : ""}">${esc(sw.lemma || sw.de)}</span>${sw.g ? ` <span class="dc-g g-${sw.g}">${GENDER_WORD[sw.g]}</span>` : ""}`
    : `${sw.g ? `<span class="art g-${sw.g}">${esc(sw.g)}</span> ` : ""}${esc(sw.g && sw.lemma ? bare(sw.lemma) : sw.de)}`;
  const say = sw ? (sw.lemma || sw.de) : t.de;
  const sound = ru ? (sw ? sw.tr : t.tr) : "";
  card.innerHTML = `<div class="dc-w">${head}</div>${sound ? `<div class="dc-tr">${esc(sound)}</div>` : ""}<div class="dc-t">${esc(sw ? sw.en : lines[+li]?.text || "")}</div>
    ${sw && sw.lemma && sw.de !== bare(sw.lemma) ? `<div class="dc-r"><b>Here</b><span>${esc(sw.de)}${ru && sw.tr ? ` (${esc(sw.tr)})` : ""}</span></div>` : ""}
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
