// Tabs editor: editing a song in place (Sheet and Text views), adding a new
// song, tap tempo and the chord picker.
import { TUNINGS, Tabs, chordModel, chordsUsed, detectTuning, guessKey, insertLines, looksLikeTab, renameSection, setChordAt, setLineText, tapTempo } from "./core.js";
import { $, SECTION_NAMES, app, ask, esc, icon, layer, onLeave, toast } from "./ui.js";
import { coach, coachTip, demoTap, markUsed, takeDemo, tick } from "./coach.js";
import { READ_AT, aiError, aiKey, busy, calm, chordSVG, cleanSheet, data, go, readPhoto, render, setOpenEdit, stopScroll } from "./app.js";

// ---------- Edit (in place) ----------
// Edit turns the song page itself into the editor: title and artist are typed in
// place; key, tuning and tempo are chips; tap a word for its chord; the pencil
// retypes a line; section names rename; + adds a line or a section. Text flips to
// the plain-text editor for big jobs. Every change saves at once, with Undo.
let chordEdit = null;
let edView = "sheet";          /* "sheet" or "text" */
let textSnap = null, textTimer = 0;
let taps = [], tapTimer = 0;   /* tap tempo in progress */
onLeave(() => {
  if (!chordEdit) return;
  if (edView === "text") flushText(chordEdit);
  if (chordEdit.isNew) settleNew(chordEdit);
  chordEdit = null; edView = "sheet"; textSnap = null;
  document.body.classList.remove("cedit");
  document.querySelector(".cebar")?.remove();
  $("ed-details")?.remove();
});
const ROOTS = ["A", "B", "C", "D", "E", "F", "G"], QUALS = ["", "m", "7", "m7", "maj7", "sus2", "sus4", "add9", "dim"];
const KEY_LIST = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const EDIT_FIELDS = ["title", "artist", "key", "tuning", "bpm", "body"];
const snapshot = song => Object.fromEntries(EDIT_FIELDS.map(k => [k, song[k]]));
function restoreSnap(song, snap) { for (const k of EDIT_FIELDS) { if (snap[k] === undefined) delete song[k]; else song[k] = snap[k]; } }
// Apply one change with Undo. `label` is the toast; empty for quiet changes.
function editChange(song, label, fn) {
  const before = snapshot(song);
  fn();
  if (song.body !== before.body) delete song.loop;
  Tabs.save(data);
  paintEdit(song);
  if (label) toast(label, null, { label: "Undo", fn: () => { restoreSnap(song, before); Tabs.save(data); paintEdit(song); } });
}
// ---- Adding a song: a blank song opened in the editor, Text view first ----
// It lives in the library flagged isNew while you work on it (so every change
// saves, as in Edit). Save keeps it; Cancel removes it. If the app closes first,
// a song with words is kept and an empty one is dropped.
function newSong(fields = {}) {
  const s = Tabs.addSong(data, { title: "", artist: "", ...fields, isNew: true });
  if (!fields.format && s.body) s.format = looksLikeTab(s.body) ? "tab" : "chords";
  setOpenEdit({ id: s.id, view: "text" });
  go("#/song/" + encodeURIComponent(s.id));
}
function settleNew(song) {
  delete song.isNew;
  if (!String(song.body || "").trim() && !song.title.trim()) data.songs.splice(data.songs.indexOf(song), 1);
  else if (!song.title.trim()) song.title = "Untitled";
  Tabs.save(data);
}
function endEdit() {
  chordEdit = null; edView = "sheet"; textSnap = null;
  document.body.classList.remove("cedit");
  document.querySelector(".cebar")?.remove();
}
function songEditor(song, view = "sheet") {
  stopScroll();
  chordEdit = song;
  document.body.classList.add("cedit");
  document.querySelector(".smap")?.remove();
  document.querySelector(".cebar")?.remove();
  const bar = document.createElement("div");
  bar.className = "cebar glass";
  edView = song.format === "tab" ? "text" : view;
  const text = edView === "text";
  bar.innerHTML = `<div class="seg slide ${text ? "right" : ""}" id="ed-seg" role="tablist" aria-label="Edit view"><button class="${text ? "" : "on"}" role="tab" aria-selected="${!text}" data-v="sheet">Sheet</button><button class="${text ? "on" : ""}" role="tab" aria-selected="${text}" data-v="text">Text</button></div>
    <button class="btn sm primary" id="ce-done">${song.isNew ? "Save" : "Done"}</button>`;
  document.body.appendChild(bar);
  $("ce-done").onclick = () => {
    if (song.isNew) {
      const t = $("ed-title")?.value.trim() || song.title.trim();
      if (!t) { toast("Add a title first"); $("ed-title")?.focus(); return; }
      flushText(song);
      song.title = t; delete song.isNew; textSnap = null;
      Tabs.save(data);
    } else leaveText(song);
    endEdit(); render(); toast("Saved");
  };
  bar.querySelectorAll("[data-v]").forEach(b => b.onclick = () => switchView(song, b.dataset.v));
  if (song.isNew) {
    /* Cancel where Back usually is; nothing else up top while adding. */
    const head = app.querySelector(".head");
    if (head) {
      head.innerHTML = `<button class="btn sm glass" id="ce-cancel">Cancel</button>`;
      $("ce-cancel").onclick = () => {
        flushText(song);
        const typed = String(song.body || "").trim() || $("ed-title")?.value.trim() || song.artist;
        /* No question: it goes at once, and Undo brings it back as it was. */
        const at = data.songs.indexOf(song), view = edView;
        data.songs.splice(at, 1);
        Tabs.save(data);
        endEdit();
        history.length > 1 ? history.back() : go("#/");
        if (typed) setTimeout(() => toast("Song discarded", null, { label: "Undo", fn: () => {
          data.songs.splice(Math.min(at, data.songs.length), 0, song); Tabs.save(data);
          setOpenEdit({ id: song.id, view }); go("#/song/" + encodeURIComponent(song.id));
        } }), 50);
      };
    }
  }
  window.scrollTo(0, 0);
  paintEdit(song);
  if (song.isNew && !song.title) setTimeout(() => $("ed-title")?.focus({ preventScroll: true }), 300);
  setTimeout(() => {
    if (chordEdit !== song) return;
    if (takeDemo("tap")) return demoTap();
    if (song.isNew && $("ed-body") && coachTip("add")) return coach(document.querySelector(".ed-tx"), "", { ms: 4000, place: "above", html: `<b>Paste or type the song here</b><span>Chords turn copper as you go.</span>` });
    if (!song.isNew && $("ed-tap") && coachTip("tap")) demoTap();
  }, 500);
}
function paintEdit(song) {
  const sheet = $("sheet");
  if (!sheet || chordEdit !== song) return;
  /* Title and details, typed in place. */
  const h = app.querySelector(".song-title");
  if (h && !h.querySelector("input")) {
    h.innerHTML = `<input class="ed-title" id="ed-title" value="${esc(song.title)}" placeholder="Song title" aria-label="Title" autocomplete="off">`;
    $("ed-title").onchange = e => { const v = e.target.value.trim(); if (v && v !== song.title) editChange(song, "", () => { song.title = v; }); else if (!song.isNew) e.target.value = song.title; };
  } else if (h && document.activeElement !== $("ed-title") && song.title) $("ed-title").value = song.title;
  paintDetails(song);
  if (edView === "text") return paintText(song);
  paintSheet(song, sheet);
}
// Artist and the Key, Tuning, Tempo (and Format, for tab) chips. Redrawn as you
// type in the Text view, so the detected key and format stay current.
function paintDetails(song) {
  const h = app.querySelector(".song-title");
  $("ed-details")?.remove();
  const isTab = song.format === "tab";
  const showFormat = isTab || looksLikeTab(song.body || "");
  const guess = isTab ? "" : guessKey(song.body || "");
  const tun = song.tuning || detectTuning(song.body) || "standard";
  const d = document.createElement("div");
  d.className = "ed-details";
  d.id = "ed-details";
  d.innerHTML = `
    <input class="ed-artist" id="ed-artist" value="${esc(song.artist || "")}" placeholder="Artist" aria-label="Artist" autocomplete="off">
    <div class="ed-chips">
      ${showFormat ? `<label class="ed-chip"><span>Format</span><b>${isTab ? "Tab" : "Chords"}</b>
        <select id="ed-format" aria-label="Format"><option value="chords" ${isTab ? "" : "selected"}>Chords</option><option value="tab" ${isTab ? "selected" : ""}>Tab</option></select></label>` : ""}
      ${isTab ? "" : `<label class="ed-chip"><span>Key</span><b>${esc(song.key || (guess ? guess + " (auto)" : "Auto"))}</b>
        <select id="ed-key" aria-label="Key"><option value="">Auto${guess ? ` (${esc(guess)})` : ""}</option>${KEY_LIST.flatMap(k => [k, k + "m"]).map(k => `<option ${k === song.key ? "selected" : ""}>${k}</option>`).join("")}</select></label>`}
      <label class="ed-chip"><span>Tuning</span><b>${esc(TUNINGS[tun].name)}</b>
        <select id="ed-tuning" aria-label="Tuning">${Object.entries(TUNINGS).map(([k, v]) => `<option value="${k}" ${k === tun ? "selected" : ""}>${v.name}</option>`).join("")}</select></label>
      <label class="ed-chip"><span>Tempo</span><input id="ed-bpm" type="number" inputmode="numeric" min="30" max="260" value="${song.bpm || ""}" placeholder="90" aria-label="Tempo in beats per minute"><span>BPM</span></label>
      <button class="ed-chip ed-tap" id="ed-tap" aria-label="Tap tempo: tap along with the beat">${icon("pick")}<span>Tap</span></button>
    </div>`;
  h?.after(d);
  $("ed-artist").onchange = e => editChange(song, "", () => { song.artist = e.target.value.trim(); });
  $("ed-format")?.addEventListener("change", e => {
    const f = e.target.value;
    if (edView === "text") flushText(song);
    editChange(song, f === "tab" ? "Format: Tab" : "Format: Chords", () => { song.format = f; song.formatSet = true; });
    if (f === "tab" && edView === "sheet") switchView(song, "text");
  });
  $("ed-seg") && ($("ed-seg").hidden = isTab);
  if ($("ed-txhint")) $("ed-txhint").textContent = textHint(song);
  $("ed-key")?.addEventListener("change", e => editChange(song, `Key: ${e.target.value || "Auto"}`, () => { song.key = e.target.value; }));
  $("ed-tuning").onchange = e => editChange(song, `Tuning: ${TUNINGS[e.target.value].name}`, () => { if (e.target.value === "standard") delete song.tuning; else song.tuning = e.target.value; });
  $("ed-bpm").onchange = e => editChange(song, "", () => { const n = Math.min(260, Math.max(30, parseInt(e.target.value, 10))); if (n) song.bpm = n; else delete song.bpm; });
  /* Tap tempo: tap along four or more times; it settles a moment after the last tap. */
  const tap = $("ed-tap");
  tap.onpointerdown = e => {
    e.preventDefault();
    markUsed("tap");
    tick(); /* feel each tap land, without looking */
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = []; /* a pause starts again */
    taps.push(now);
    const bpm = tapTempo(taps);
    tap.classList.remove("beat"); void tap.offsetWidth; tap.classList.add("beat");
    tap.querySelector("span").textContent = taps.length < 4 ? `Tap ${4 - taps.length} more` : `${bpm} BPM`;
    if (bpm) $("ed-bpm").value = bpm;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => {
      const n = tapTempo(taps); const enough = taps.length >= 4;
      taps = [];
      if (enough && n) editChange(song, `Tempo ${n} BPM`, () => { song.bpm = n; });
      else { tap.querySelector("span").textContent = "Tap"; $("ed-bpm").value = song.bpm || ""; }
    }, 1600);
  };
  tap.onclick = e => e.preventDefault();
}
function paintSheet(song, sheet) {
  /* The sheet: words for chords, a pencil per line, renamable sections, + to add. */
  const model = chordModel(song.body);
  const pencil = icon("edit");
  const parts = [`<p class="ed-hint">Tap a word for its chord. ${pencil} retypes a line.</p>`];
  const addBtn = after => `<button class="ce-add" data-after="${after}">${icon("plus")}Line</button>`;
  let last = -1, inSection = false;
  model.forEach((l, k) => {
    if (l.kind === "section") {
      if (inSection) parts.push(addBtn(last));
      inSection = true;
      parts.push(`<button class="sec ce-sec" data-sec="${l.i}" aria-label="Rename section ${esc(l.text)}">${esc(l.text)}${pencil}</button>`);
      last = l.i;
      return;
    }
    if (l.kind === "blank") { parts.push(`<div class="gap"></div>`); return; }
    last = l.i;
    if (l.kind !== "lyric") { parts.push(`<div class="ce-other">${esc(l.text)}</div>`); return; }
    const words = [...l.text.matchAll(/\S+/g)];
    let prevEnd = 0;
    const html = words.map(w => {
      const start = w.index, end = start + w[0].length;
      /* Chords over this word, or over the gap just before it. */
      const on = l.chords.filter(c => c.pos >= prevEnd && c.pos < end);
      prevEnd = end;
      const pos = on.length ? on[on.length - 1].pos : start;
      return `<button class="ce-w ${on.length ? "has" : ""}" data-i="${l.i}" data-pos="${pos}" data-word="${esc(w[0])}"><span class="ce-c">${on.length ? esc(on.map(c => c.chord).join(" ")) : "+"}</span><span class="ce-t">${esc(w[0])}</span></button>`;
    }).join(" ");
    parts.push(`<div class="ce-line" data-line="${l.i}">${html}<button class="ce-pen" data-edit="${l.i}" aria-label="Retype this line">${pencil}</button></div>`);
  });
  parts.push(addBtn(last));
  parts.push(`<div class="ed-end"><button class="ce-add" id="ed-sec">${icon("plus")}Section</button></div>
    <button class="danger" id="ed-delete" style="display:block;margin:28px auto 0">Delete Song</button>`);
  sheet.classList.remove("focus");
  sheet.innerHTML = parts.join("");

  /* One handler for the whole sheet instead of one per word and button. */
  sheet.onclick = e => {
    if (chordEdit !== song || edView !== "sheet") return;
    const b = e.target.closest?.(".ce-w, [data-edit], [data-sec], [data-after]");
    if (!b || !sheet.contains(b)) return;
    if (b.classList.contains("ce-w")) {
      sheet.querySelectorAll(".ce-w.sel").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel");
      pickChord(song, +b.dataset.i, +b.dataset.pos, b.dataset.word, b.classList.contains("has") ? b.querySelector(".ce-c").textContent : "");
    } else if (b.dataset.edit !== undefined) {
      const i = +b.dataset.edit, ln = model.find(l => l.kind === "lyric" && l.i === i);
      lineInput(b.closest(".ce-line"), ln.text, text => {
        if (text === ln.text) return paintEdit(song);
        editChange(song, text.trim() ? "Line updated" : "Line removed", () => { song.body = setLineText(song.body, i, text); });
      });
    } else if (b.dataset.sec !== undefined) {
      const i = +b.dataset.sec, cur = model.find(l => l.i === i).text;
      ask({ title: "Rename section", value: cur, picks: SECTION_NAMES, ok: "Save", extra: { label: "Remove label", value: "" }, caps: "words" }, name => {
        if (name === cur) return;
        editChange(song, name ? `Renamed to ${name}` : "Label removed", () => { song.body = renameSection(song.body, i, name); });
      });
    } else {
      const after = +b.dataset.after;
      const row = document.createElement("div");
      row.className = "ce-line";
      b.before(row);
      lineInput(row, "", text => {
        if (!text.trim()) return paintEdit(song);
        editChange(song, "Line added", () => { song.body = insertLines(song.body, after, [text]).body; });
      });
    }
  };
  $("ed-sec").onclick = () => {
    ask({ title: "Add a section", placeholder: "Section name", picks: SECTION_NAMES, ok: "Add", caps: "words" }, name => addSection(name));
  };
  const addSection = name => {
    const lines = String(song.body || "").split("\n");
    editChange(song, `Added ${name}`, () => { song.body = insertLines(song.body, lines.length - 1, lines.length && lines[lines.length - 1].trim() ? ["", `[${name}]`] : [`[${name}]`]).body; });
    /* Start typing the new section's first line right away. */
    sheet.querySelectorAll("[data-after]")[sheet.querySelectorAll("[data-after]").length - 1]?.click();
  };
  $("ed-delete").onclick = () => deleteFromEdit(song);
}
// ---- Text view: the same page, the sheet as plain text ----
// Same title, details and bar; only the song area changes. Chord lines show in
// copper behind the text, and switching keeps the line you were on in place.
function switchView(song, v) {
  if (v === edView) return;
  /* Remember which line sits at the reading point, and where. */
  const line = innerHeight * READ_AT;
  const pick = sel => {
    let best = null;
    document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (!best || Math.abs(r.top - line) < Math.abs(best.top - line)) best = { el, top: r.top }; });
    return best;
  };
  let anchor = null;
  if (edView === "sheet") { const b = pick("#sheet [data-line], #sheet [data-sec]"); if (b) anchor = { i: +(b.el.dataset.line ?? b.el.dataset.sec), top: b.top }; }
  else { const b = pick(".ed-hl [data-l]"); if (b) anchor = { i: +b.el.dataset.l, top: b.top }; leaveText(song); }
  edView = v;
  document.querySelectorAll("#ed-seg [data-v]").forEach(b => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
  $("ed-seg")?.classList.toggle("right", v === "text");
  paintEdit(song);
  $("sheet")?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: calm() ? 0 : 160, easing: "ease-out" });
  if (!anchor) return;
  let el = null;
  if (v === "text") el = document.querySelector(`.ed-hl [data-l="${anchor.i}"]`);
  else {
    /* The first line at or after it (a chord line belongs to the lyric below). */
    let bestI = Infinity;
    document.querySelectorAll("#sheet [data-line], #sheet [data-sec]").forEach(x => { const i = +(x.dataset.line ?? x.dataset.sec); if (i >= anchor.i && i < bestI) { bestI = i; el = x; } });
  }
  if (el) window.scrollBy(0, el.getBoundingClientRect().top - anchor.top);
}
function hlText(text) {
  const model = chordModel(text), chordLines = new Set(), secs = new Set();
  for (const l of model) { if (l.kind === "section") secs.add(l.i); if (l.kind === "chords") chordLines.add(l.i); if (l.kind === "lyric" && l.chordLine >= 0) chordLines.add(l.chordLine); }
  return text.split("\n").map((ln, i) => {
    const body = secs.has(i) || chordLines.has(i) ? esc(ln) : esc(ln).replace(/\[([A-G][#b]?[^\]\s]{0,10})\]/g, '<span class="hc">[$1]</span>');
    return `<div data-l="${i}" class="${chordLines.has(i) ? "hc" : secs.has(i) ? "hs" : ""}">${body || " "}</div>`;
  }).join("");
}
const textHint = song => song.format === "tab" ? "Tab as plain text, one line per string. Section names in brackets, like [Intro]." : "Chords go on their own line above the words, or inline like [G]word. Sections in brackets, like [Chorus].";
const TEXT_HINT = "Paste or type chords and lyrics, or tab\n\n[Verse]\nG                C         G\nWalking down the river road tonight\n\nor inline:  [G]Walking [C]down";
function paintText(song) {
  const sheet = $("sheet");
  textSnap ||= snapshot(song);
  sheet.innerHTML = `
    ${aiKey() ? `<div class="ed-tools"><button class="chip ai" id="ed-clean">${icon("wand")}Clean up</button><button class="chip ai" id="ed-scan">${icon("camera")}Scan a page</button><input type="file" id="ed-photo" accept="image/*" hidden></div>` : ""}
    <div class="ed-tx"><div class="ed-tx-in"><pre class="ed-hl" id="ed-hl" aria-hidden="true">${hlText(song.body || "")}</pre>
      <textarea id="ed-body" spellcheck="false" autocapitalize="off" autocorrect="off" autocomplete="off" aria-label="Song text" placeholder="${esc(TEXT_HINT)}">${esc(song.body || "")}</textarea></div></div>
    <p class="ed-hint" id="ed-txhint">${textHint(song)}</p>
    ${song.isNew ? "" : `<button class="danger" id="ed-delete" style="display:block;margin:28px auto 0">Delete Song</button>`}`;
  const ta = $("ed-body");
  ta.oninput = () => {
    $("ed-hl").innerHTML = hlText(ta.value);
    clearTimeout(textTimer);
    textTimer = setTimeout(() => flushText(song), 300);
  };
  const run = async (btn, label, job) => {
    if (btn.disabled) return;
    const html = btn.innerHTML;
    sheet.querySelectorAll(".chip.ai").forEach(b => b.disabled = true);
    btn.innerHTML = busy(label);
    try {
      flushText(song);
      const r = await job();
      editChange(song, r.label, () => {
        song.body = r.body;
        if (!song.title.trim() && r.title) song.title = r.title;
        if (!song.artist && r.artist) song.artist = r.artist;
        if (!song.key && r.key) song.key = r.key;
        if (r.format && !song.formatSet) song.format = r.format;
      });
    } catch (e) { toast(aiError(e)); btn.innerHTML = html; sheet.querySelectorAll(".chip.ai").forEach(b => b.disabled = false); }
  };
  $("ed-clean")?.addEventListener("click", () => {
    if (!ta.value.trim()) return toast("Paste a song first");
    run($("ed-clean"), "Cleaning", async () => ({ ...(await cleanSheet({ text: ta.value })), label: "Cleaned up" }));
  });
  $("ed-scan")?.addEventListener("click", () => $("ed-photo").click());
  $("ed-photo")?.addEventListener("change", e => {
    const file = e.target.files[0]; e.target.value = "";
    if (file) run($("ed-scan"), "Reading page", async () => ({ ...(await cleanSheet({ image: await readPhoto(file) })), label: "Read from photo" }));
  });
  $("ed-delete")?.addEventListener("click", () => deleteFromEdit(song));
}
function flushText(song) {
  clearTimeout(textTimer);
  const ta = $("ed-body");
  if (!ta || ta.value === song.body) return;
  song.body = ta.value;
  delete song.loop;
  if (song.isNew && !song.formatSet) song.format = looksLikeTab(song.body) ? "tab" : "chords";
  Tabs.save(data);
  if (chordEdit === song) paintDetails(song);
}
// Leaving the text view: save, and offer one Undo for everything typed there.
function leaveText(song) {
  if (edView !== "text") return;
  flushText(song);
  const before = textSnap;
  textSnap = null;
  if (before && before.body !== song.body) toast("Text changes saved", null, { label: "Undo", fn: () => { restoreSnap(song, before); Tabs.save(data); paintEdit(song); } });
}
function deleteFromEdit(song) {
  chordEdit = null; edView = "sheet"; textSnap = null; document.body.classList.remove("cedit"); document.querySelector(".cebar")?.remove();
  const entry = Tabs.deleteSong(data, song.id);
  history.replaceState(null, "", "#/");
  render();
  toast(`Deleted "${song.title}"`, null, { label: "Undo", fn: () => { Tabs.restore(data, entry); render(); toast("Restored"); } });
}

// Swap a line for a text field; Return or leaving the field saves, Escape cancels.
function lineInput(row, text, done) {
  row.innerHTML = `<input class="ce-input" value="${esc(text)}" placeholder="Type the line" aria-label="Line text" autocomplete="off" autocapitalize="sentences">`;
  const inp = row.querySelector("input");
  let finished = false;
  const finish = v => { if (finished) return; finished = true; done(v); };
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); finish(inp.value); } if (e.key === "Escape") { finished = true; paintEdit(chordEdit); } };
  inp.onblur = () => finish(inp.value);
  inp.focus();
  inp.setSelectionRange(inp.value.length, inp.value.length);
}
function pickChord(song, i, pos, word, current) {
  const parsed = /^([A-G])([#b]?)(.*)$/.exec(current || "") || [];
  const st = { root: parsed[1] || "", acc: parsed[2] || "", qual: QUALS.includes(parsed[3]) ? parsed[3] : "" };
  const name = () => st.root ? st.root + st.acc + st.qual : "";
  const used = chordsUsed(song.body);
  const paint = () => {
    const p = $("ce-panel");
    p.innerHTML = `
      <div class="pc-head">${icon("pick")}<span>Chord over <b class="ce-word">${esc(word)}</b></span></div>
      ${used.length ? `<div class="label ce-lab">In this song</div><div class="ce-chips">${used.map(c => `<button class="ce-chip ${c === name() ? "on" : ""}" data-u="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
      <div class="label ce-lab">Any chord</div>
      <div class="ce-chips">${ROOTS.map(r => `<button class="ce-chip ${r === st.root ? "on" : ""}" data-r="${r}">${r}</button>`).join("")}
        <button class="ce-chip ${st.acc === "#" ? "on" : ""}" data-a="#" aria-label="Sharp">♯</button><button class="ce-chip ${st.acc === "b" ? "on" : ""}" data-a="b" aria-label="Flat">♭</button></div>
      <div class="ce-chips q">${QUALS.map(q => `<button class="ce-chip ${q === st.qual ? "on" : ""}" data-q="${q}">${q || "major"}</button>`).join("")}<button class="ce-chip" id="ce-other">Other…</button></div>
      <div class="actions" style="margin-top:14px">
        ${current ? `<button class="btn" id="ce-rm">Remove</button>` : `<button class="btn" id="ce-cancel">Cancel</button>`}
        <button class="btn primary" id="ce-place" ${name() ? "" : "disabled"}>${name() ? `Place ${esc(name())}` : "Pick a chord"}</button>
      </div>`;
    p.querySelectorAll("[data-u]").forEach(b => b.onclick = () => { const m = /^([A-G])([#b]?)(.*)$/.exec(b.dataset.u); st.root = m[1]; st.acc = m[2]; st.qual = m[3]; apply(b.dataset.u); });
    p.querySelectorAll("[data-r]").forEach(b => b.onclick = () => { st.root = b.dataset.r; paint(); });
    p.querySelectorAll("[data-a]").forEach(b => b.onclick = () => { st.acc = st.acc === b.dataset.a ? "" : b.dataset.a; paint(); });
    p.querySelectorAll("[data-q]").forEach(b => b.onclick = () => { st.qual = b.dataset.q; paint(); });
    $("ce-other").onclick = () => ask({
      title: `Chord over “${word}”`, value: name(), placeholder: "Cadd9, D/F#, Asus4…", caps: "none",
      text: "Type any chord. Names Tabs doesn't have a diagram for are placed as text.",
      preview: c => (c && chordSVG(c)) || "", okLabel: c => (c ? `Place ${c}` : "Type a chord")
    }, apply);
    $("ce-place").onclick = () => name() && apply(name());
    $("ce-rm")?.addEventListener("click", () => apply(null));
    $("ce-cancel")?.addEventListener("click", close);
  };
  const close = () => { layer.innerHTML = ""; document.querySelectorAll(".ce-w.sel").forEach(x => x.classList.remove("sel")); };
  const apply = chord => {
    close();
    editChange(song, chord ? `${chord} over “${word}”` : `Removed from “${word}”`, () => { song.body = setChordAt(song.body, i, pos, chord); });
  };
  layer.innerHTML = `<div class="scrim" id="ce-scrim"></div><div class="panel card" id="ce-panel" role="dialog" aria-label="Choose a chord"></div>`;
  $("ce-scrim").onclick = close;
  paint();
}

export { chordEdit, newSong, settleNew, songEditor };
