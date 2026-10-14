// Tabs Settings and Recently deleted screens.
import { SPEEDS, TRASH_DAYS, Tabs, VERSION, html, raw } from "./core.js";
import { $, app, ask, esc, icon, toast } from "./ui.js";
import { coverPut } from "./sets.js";
import { askMotion } from "./ring.js";
import { ago, backupNow, copyDiagnostics, problems, storageKept, where } from "./store.js";
import { AI, aiError, aiKey, applyTheme, askClaude, busy, data, go, mmss, setData } from "./app.js";

// ---------- Settings ----------
let settingsDefaultsOpen = false;
const kb = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
function renderSettings() {
  const s = data.settings;
  const t = s.transpose || 0;
  const semis = n => n === 0 ? "None" : `${n > 0 ? "+" : ""}${n} semitone${Math.abs(n) === 1 ? "" : "s"}`;
  app.innerHTML = `
    <div class="head">
      <button class="ib glass" id="back" aria-label="Back to library">${icon("back")}</button>
    </div>
    <h1 class="title" style="margin:14px 2px 10px">Settings</h1>
    <div class="label">Playing</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Speed style</span><span class="val">${s.speedMode === "multiplier" ? "1x style" : "Song length"}</span>${icon("chev", "chev")}
        <select id="s-mode" aria-label="Speed style">
          <option value="length" ${s.speedMode !== "multiplier" ? "selected" : ""}>Song length</option>
          <option value="multiplier" ${s.speedMode === "multiplier" ? "selected" : ""}>1x style</option>
        </select>
      </div>
      <div class="set">
        <span class="tile">${icon("metro")}</span><span class="name">Count-in</span>
        <button class="toggle ${s.countIn !== false ? "on" : ""}" id="s-count" role="switch" aria-checked="${s.countIn !== false}" aria-label="Count-in"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("stage")}</span><span class="name">Stage mode</span>
        <button class="toggle ${s.stage ? "on" : ""}" id="s-stage" role="switch" aria-checked="${!!s.stage}" aria-label="Stage mode"></button>
      </div>
    </div>
    <p class="foot">Song length fits the scroll to how long a song takes; 1x style is a fixed speed. Each song keeps its own. Count-in plays one bar at the song's tempo. Stage mode is for playing live: larger, higher-contrast text, no chord cards, and while a song plays, stray touches are ignored (tap twice to pause).</p>
    <div class="label">Chord diagrams</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("fretboard")}</span><span class="name">Now and Next while playing</span>
        <button class="toggle ${s.diagrams === true ? "on" : ""}" id="s-diagrams" role="switch" aria-checked="${s.diagrams === true}" aria-label="Now and Next chords"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("pause")}</span><span class="name">Diagrams when paused</span>
        <button class="toggle ${s.pauseDiagrams !== false ? "on" : ""}" id="s-pause" role="switch" aria-checked="${s.pauseDiagrams !== false}" aria-label="Diagrams when paused"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("sections")}</span><span class="name">Song map</span>
        <button class="toggle ${s.songMap !== false ? "on" : ""}" id="s-map" role="switch" aria-checked="${s.songMap !== false}" aria-label="Song map: the section rail on the right edge"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("focus")}</span><span class="name">Focus current line</span><span class="val">${{ always: "Always", playing: "While playing", off: "Off" }[s.focus] || "Always"}</span>${icon("chev", "chev")}
        <select id="s-focus" aria-label="Focus current line">
          ${[["always", "Always"], ["playing", "While playing"], ["off", "Off"]].map(([v, t]) => `<option value="${v}" ${v === (s.focus || "always") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="set">
        <span class="tile">${icon("play")}</span><span class="name">Song controls</span><span class="val">${s.controls === "bar" ? "Bar" : "Hold Play"}</span>${icon("chev", "chev")}
        <select id="s-controls" aria-label="Song controls">
          ${[["ring", "Hold Play (ring)"], ["bar", "Bar"]].map(([v, t]) => `<option value="${v}" ${v === (s.controls || "ring") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      ${s.controls === "bar" ? "" : `<div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Play button</span><span class="val">${{ hand: "Follows your hand", touch: "Follows your touch", corner: "Stays in the corner" }[s.follow || "hand"]}</span>${icon("chev", "chev")}
        <select id="s-follow" aria-label="Play button">
          ${[["hand", "Follows your hand"], ["touch", "Follows your touch"], ["corner", "Stays in the corner"]].map(([v, t]) => `<option value="${v}" ${v === (s.follow || "hand") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="set">
        <span class="tile">${icon("loop")}</span><span class="name">Arc sweep</span><span class="val">${s.arcSweep === "screen" ? "One screen" : "Whole song"}</span>${icon("chev", "chev")}
        <select id="s-arc" aria-label="Arc sweep">
          ${[["song", "Whole song"], ["screen", "One screen"]].map(([v, t]) => `<option value="${v}" ${v === (s.arcSweep || "song") ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>`}
    </div>
    <p class="foot">Tap a chord for its fingering, or a line to start from it. The song map is the rail of sections on the right edge; touch it and slide to jump to a section. On a phone held upright, hold Play for Back, Favorite, Key, More and Set; Play rises to your thumb while the phone is in your hand and settles in the corner when it's still. Sweep the arc to move through the song: slowly for a line or two, quickly to cover ground; one full sweep goes end to end.</p>
    <div class="set-group glass" style="margin-top:22px">
      <button class="set" id="s-defaults" aria-expanded="${!!settingsDefaultsOpen}"><span class="tile">${icon("sliders")}</span><span class="name">Defaults for new songs</span>${icon(settingsDefaultsOpen ? "down" : "chev", "chev")}</button>
      ${settingsDefaultsOpen ? `${s.speedMode === "multiplier" ? `<div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Starting speed</span><span class="val">${((s.startSpeed || SPEEDS.medium) / SPEEDS.medium).toFixed(1)}x</span>${icon("chev", "chev")}
        <select id="s-speed" aria-label="Starting speed for new songs">
          ${Array.from({ length: 16 }, (_, i) => (i + 5) / 10).map(m => `<option value="${(m * SPEEDS.medium).toFixed(1)}" ${Math.abs(m * SPEEDS.medium - (s.startSpeed || SPEEDS.medium)) < 0.01 ? "selected" : ""}>${m.toFixed(1)}x</option>`).join("")}
        </select>
      </div>` : `<div class="set">
        <span class="tile">${icon("gauge")}</span><span class="name">Starting length</span><span class="val">${mmss(s.startLength || 210)}</span>${icon("chev", "chev")}
        <select id="s-length" aria-label="Starting length for new songs">
          ${Array.from({ length: 17 }, (_, i) => 120 + i * 15).map(v => `<option value="${v}" ${v === (s.startLength || 210) ? "selected" : ""}>${mmss(v)}</option>`).join("")}
        </select>
      </div>`}
      <div class="set">
        <span class="tile">${icon("note")}</span><span class="name">Transpose</span><span class="val">${semis(t)}</span>${icon("chev", "chev")}
        <select id="s-transpose" aria-label="Default transpose">
          ${Array.from({ length: 12 }, (_, i) => i - 5).map(n => `<option value="${n}" ${n === t ? "selected" : ""}>${semis(n)}</option>`).join("")}
        </select>
      </div>` : ""}
    </div>
    <div class="label">Appearance</div>
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("moon")}</span><span class="name">Theme</span>
        <div class="seg mini" id="s-theme" role="group" aria-label="Theme">${[["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]].map(([k, n]) => `<button data-t="${k}" class="${(s.theme === "dark" || s.theme === "light" ? s.theme : "auto") === k ? "on" : ""}" aria-pressed="${(s.theme === "dark" || s.theme === "light" ? s.theme : "auto") === k}">${n}</button>`).join("")}</div>
      </div>
    </div>
    <div class="label">AI help</div>
    <div class="set-group glass">
      <label class="fld" style="min-height:52px"><span class="tile" style="width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--card-2);border:1px solid var(--rim);color:var(--fg-2)">${icon("wand")}</span>
        <input id="s-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Anthropic API key (sk-ant-...)" value="${esc(aiKey())}" aria-label="Anthropic API key"></label>
      <div class="key-row">
        <span class="ai-status"><i class="dot ${aiKey() ? "on" : ""}"></i>${aiKey() ? "On" : "Off"}</span>
        <button class="btn sm" id="s-test">Test</button>
        ${aiKey() ? `<button class="btn sm" id="s-remove">Remove</button>` : ""}
        <button class="btn sm primary" id="s-savekey">Save key</button>
      </div>
    </div>
    <p class="foot" id="s-keymsg">Adds Clean up and Scan a page when adding songs, and Make it easier and Spark tone in a song's ••• menu. The key stays on this phone and is sent only to Anthropic. Cleanup and scans send the pasted text or photo; Make it easier and Spark tone send only the song's title, artist and chord names. Use a key made just for Tabs, with a low monthly spend limit.</p>
    <div class="label">Library</div>
    <div class="set-group glass">
      <button class="set" id="s-export"><span class="tile">${icon("cloud")}</span><span class="name">Back up now</span><span class="val muted">${ago(s.lastBackup)}</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-import"><span class="tile">${icon("download")}</span><span class="name">Import backup</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-tips"><span class="tile">${icon("info")}</span><span class="name">Tips &amp; gestures</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-trash"><span class="tile">${icon("trash")}</span><span class="name">Recently deleted</span><span class="val muted">${data.trash.length || ""}</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-diag"><span class="tile">${icon("info")}</span><span class="name">Copy diagnostics</span><span class="val muted">${problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : ""}</span>${icon("chev", "chev")}</button>
    </div>
    <input type="file" id="file" accept=".json,application/json" hidden>
    <p class="foot">${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, stored only on this phone${where.db ? ` in its database (${kb(where.size || JSON.stringify(data).length)})${where.copy === false ? "" : ", with a copy in browser storage"}` : ""}${storageKept ? ", kept permanently" : storageKept === false ? ". The browser may clear it if Tabs isn't added to your Home Screen" : ""}. Back up weekly to iCloud Drive: tap Back up now, then Save to Files. Add Tabs to your Home Screen from the Share menu to use it offline.</p>
    <p class="foot s-ver" id="s-ver">Tabs ${VERSION}</p>`;
  $("back").onclick = () => go("#/");
  $("s-speed")?.addEventListener("change", e => { s.startSpeed = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-length")?.addEventListener("change", e => { s.startLength = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-mode").onchange = e => { s.speedMode = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-count").onclick = () => { s.countIn = s.countIn === false; Tabs.save(data); renderSettings(); };
  $("s-stage").onclick = () => { s.stage = !s.stage; Tabs.save(data); applyTheme(); renderSettings(); };
  $("s-transpose")?.addEventListener("change", e => { s.transpose = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-defaults").onclick = () => { settingsDefaultsOpen = !settingsDefaultsOpen; renderSettings(); };
  $("s-diagrams").onclick = () => { s.diagrams = s.diagrams !== true; Tabs.save(data); renderSettings(); };
  $("s-map").onclick = () => { s.songMap = s.songMap === false; Tabs.save(data); renderSettings(); };
  $("s-pause").onclick = () => { s.pauseDiagrams = s.pauseDiagrams === false; Tabs.save(data); renderSettings(); };
  $("s-focus").onchange = e => { s.focus = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-arc")?.addEventListener("change", e => { s.arcSweep = e.target.value; Tabs.save(data); renderSettings(); });
  $("s-controls").onchange = e => { s.controls = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-follow")?.addEventListener("change", async e => {
    s.follow = e.target.value;
    if (s.follow === "hand" && !(await askMotion())) { s.follow = "touch"; toast("Motion wasn't allowed, so Play follows your touch"); }
    Tabs.save(data); renderSettings();
  });
  $("s-theme").querySelectorAll("[data-t]").forEach(b => b.onclick = () => { s.theme = b.dataset.t; Tabs.save(data); applyTheme(); renderSettings(); });
  $("s-savekey").onclick = () => {
    const k = $("s-key").value.trim();
    if (!k) { toast("Paste a key first"); return; }
    try { localStorage.setItem(AI.store, k); } catch {}
    renderSettings(); toast("Key saved");
  };
  $("s-remove")?.addEventListener("click", () => {
    try { localStorage.removeItem(AI.store); } catch {}
    renderSettings(); toast("Key removed from this phone");
  });
  $("s-test").onclick = async () => {
    const k = $("s-key").value.trim() || aiKey();
    const out = $("s-keymsg");
    if (!k) { out.textContent = "No key entered."; return; }
    $("s-test").innerHTML = busy("Testing");
    try {
      await askClaude({ key: k, content: "Reply with the word OK.", maxTokens: 1024 });
      out.textContent = "Key works.";
    } catch (e) { out.textContent = aiError(e); }
    $("s-test").textContent = "Test";
  };
  $("s-export").onclick = async () => { if (await backupNow()) { renderSettings(); toast("Backed up"); } };
  $("s-trash").onclick = () => go("#/trash");
  $("s-tips").onclick = () => go("#/gestures");
  $("s-diag").onclick = copyDiagnostics;
  $("s-import").onclick = () => $("file").click();
  $("file").onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = Tabs.import(reader.result);
      if (!imported) return toast("That file isn't a Tabs backup");
      setData(imported.data);
      Object.entries(imported.covers).forEach(([id, url]) => coverPut(id, url));
      applyTheme();
      const n = data.songs.length, bad = imported.skipped;
      toast(`Imported ${n} song${n === 1 ? "" : "s"}${bad ? `. Skipped ${bad} that couldn't be read.` : ""}`);
      go("#/");
    };
    reader.readAsText(f);
  };
}

// ---------- Recently deleted ----------
function renderTrash() {
  const left = t => Math.max(1, TRASH_DAYS - Math.floor((Date.now() - Date.parse(t.deletedAt)) / 86400000));
  app.innerHTML = html`
    <div class="head"><button class="ib glass" id="back" aria-label="Back to settings">${icon("back")}</button>
      ${data.trash.length > 0 && raw('<button class="tb" id="t-empty" style="color:var(--bad)">Delete all</button>')}</div>
    <h1 class="title" style="margin:14px 2px 18px">Recently deleted</h1>
    ${data.trash.length ? html`<div class="list glass">${data.trash.map((t, i) => html`
      <div class="row">
        <div class="txt"><div class="t">${t.type === "set" ? t.item.name : t.item.title}</div>
          <div class="a">${t.type === "set" ? "Set" : t.item.artist || "Song"} · ${left(t)} day${left(t) === 1 ? "" : "s"} left</div></div>
        <button class="btn sm" data-forget="${i}">Delete</button>
        <button class="btn sm primary" data-restore="${i}">Restore</button>
      </div>`)}</div>`
      : html`<div class="empty">Nothing here. Deleted songs and sets stay for ${TRASH_DAYS} days.</div>`}
    <p class="foot">Items are removed for good after ${TRASH_DAYS} days.</p>`;
  $("back").onclick = () => go("#/settings");
  app.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => {
    const t = data.trash[+b.dataset.restore];
    Tabs.restore(data, t); renderTrash();
    toast(`Restored "${t.type === "set" ? t.item.name : t.item.title}"`);
  });
  app.querySelectorAll("[data-forget]").forEach(b => b.onclick = () => {
    const t = data.trash[+b.dataset.forget];
    ask({ title: `Delete “${t.type === "set" ? t.item.name : t.item.title}” for good?`, text: "This can't be undone.", ok: "Delete for good", keep: "Keep it", danger: true },
      () => { Tabs.forget(data, t); renderTrash(); });
  });
  $("t-empty")?.addEventListener("click", () => {
    const n = data.trash.length;
    ask({ title: `Delete all ${n} for good?`, text: "Everything in Recently deleted goes. This can't be undone.", ok: `Delete ${n === 1 ? "it" : `all ${n}`}`, keep: "Keep them", danger: true },
      () => { data.trash = []; Tabs.save(data); renderTrash(); });
  });
}

export { renderSettings, renderTrash };
