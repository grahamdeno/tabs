// Tabs Settings and Recently deleted screens.
import { DRUM_BEATS, SPEEDS, TRASH_DAYS, Tabs, VERSION, html, raw } from "./core.js";
import { $, app, ask, esc, icon, toast } from "./ui.js";
import { coverPut } from "./sets.js";
import { askMotion } from "./ring.js";
import { ago, backupNow, copyDiagnostics, problems, storageKept, where } from "./store.js";
import { AI, aiError, aiKey, applyTheme, askClaude, busy, data, go, metroPreview, mmss, setData, BPM_STORE, bpmKey } from "./app.js";

// ---------- Settings ----------
const kb = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
function renderSettings() {
  const s = data.settings;
  const t = s.transpose || 0;
  const semis = n => n === 0 ? "None" : `${n > 0 ? "+" : ""}${n} semitone${Math.abs(n) === 1 ? "" : "s"}`;
  const page = location.hash.split("/")[2] || "";
  const dot = k => `<i class="dot ${k ? "on" : ""}"></i>`;
  const head = (title, back) => `
    <div class="head">
      <button class="ib glass" id="back" aria-label="${back}">${icon("back")}</button>
    </div>
    <h1 class="title" style="margin:14px 2px 10px">${title}</h1>`;
  const metVol = Math.round((s.metroVol >= 0 && s.metroVol <= 1 ? s.metroVol : 0.8) * 100), metSound = s.metroSound === "click" ? "click" : "drums";
  const beatPick = DRUM_BEATS.find(([k]) => k === s.metroBeat) || DRUM_BEATS[0], swing = ["light", "full"].includes(s.metroSwing) ? s.metroSwing : "straight";
  const PAGES = {
    playing: ["Playing", `
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
        <span class="tile">${icon("metro")}</span><span class="name">Metronome</span>
        <input type="range" class="s-vol" id="s-metvol" min="0" max="100" step="5" value="${metVol}" style="--fill:${metVol}%" aria-label="Metronome volume">
        <button class="toggle ${s.metronome ? "on" : ""}" id="s-metro" role="switch" aria-checked="${!!s.metronome}" aria-label="Metronome"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("note")}</span><span class="name">Metronome sound</span>
        <div class="seg mini" id="s-metsound" role="group" aria-label="Metronome sound">${[["click", "Click"], ["drums", "Drums"]].map(([k, n]) => `<button data-m="${k}" class="${metSound === k ? "on" : ""}" aria-pressed="${metSound === k}">${n}</button>`).join("")}</div>
      </div>
      ${metSound === "drums" ? `<div class="set">
        <span class="tile">${icon("note")}</span><span class="name">Drum beat</span><span class="val">${beatPick[1]}</span>${icon("chev", "chev")}
        <select id="s-metbeat" aria-label="Drum beat">${DRUM_BEATS.map(([k, n]) => `<option value="${k}" ${beatPick[0] === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      </div>
      <div class="set">
        <span class="tile">${icon("note")}</span><span class="name">Swing</span>
        <div class="seg mini" id="s-metswing" role="group" aria-label="Swing">${[["straight", "Straight"], ["light", "Light"], ["full", "Full"]].map(([k, n]) => `<button data-m="${k}" class="${swing === k ? "on" : ""}" aria-pressed="${swing === k}">${n}</button>`).join("")}</div>
      </div>` : ""}
      <div class="set">
        <span class="tile">${icon("metro")}</span><span class="name">Drop-out practice</span>
        <button class="toggle ${s.metroDrop ? "on" : ""}" id="s-metdrop" role="switch" aria-checked="${!!s.metroDrop}" aria-label="Drop-out practice"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("flame")}</span><span class="name">Streak celebration</span>
        <button class="toggle ${s.streakMoment !== false ? "on" : ""}" id="s-streak" role="switch" aria-checked="${s.streakMoment !== false}" aria-label="Streak celebration"></button>
      </div>
      <div class="set">
        <span class="tile">${icon("stage")}</span><span class="name">Stage mode</span>
        <button class="toggle ${s.stage ? "on" : ""}" id="s-stage" role="switch" aria-checked="${!!s.stage}" aria-label="Stage mode"></button>
      </div>
    </div>
    <p class="foot">Song length fits the scroll to how long a song takes; 1x style is a fixed speed. Each song keeps its own. Count-in plays one bar at the song's tempo. The metronome plays along at the song's tempo, as a click or a drum beat, and slows with you when the speed dial is set longer than the recording; a song with no tempo gets one looked up. The slider sets its volume. Auto picks the drum beat from the song: ballad if it is fingerpicked and slow, half time when slow, four on the floor when fast, and a 6/8 feel for songs counted in 6 or 12. Swing lays the off-beat eighths later. Drop-out practice silences every other bar so you hold the time yourself. Streak celebration shows your streak once a day, after the first song you play to the end. Stage mode is for playing live: larger, higher-contrast text, no chord cards, and while a song plays, stray touches are ignored (tap twice to pause).</p>`],
    diagrams: ["Chord diagrams", `
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
    </div>
    <p class="foot">Tap a chord for its fingering, or a line to start from it. The song map is the rail of sections on the right edge; touch it and slide to jump to a section.</p>`],
    look: ["Look", `
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("moon")}</span><span class="name">Theme</span>
        <div class="seg mini" id="s-theme" role="group" aria-label="Theme">${[["auto", "Auto"], ["dark", "Dark"], ["light", "Light"]].map(([k, n]) => `<button data-t="${k}" class="${(s.theme === "dark" || s.theme === "light" ? s.theme : "auto") === k ? "on" : ""}" aria-pressed="${(s.theme === "dark" || s.theme === "light" ? s.theme : "auto") === k}">${n}</button>`).join("")}</div>
      </div>
      <div class="set">
        <span class="tile">${icon("amp")}</span><span class="name">Amp covering</span>
        <button class="toggle ${s.tolex ? "on" : ""}" id="s-tolex" role="switch" aria-checked="${!!s.tolex}" aria-label="Amp covering: a fine tolex grain behind the app"></button>
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
    <p class="foot">On a phone held upright, hold Play for Back, Favorite, Key, More and Set; Play rises to your thumb while the phone is in your hand and settles in the corner when it's still. Sweep the arc to move through the song: slowly for a line or two, quickly to cover ground; one full sweep goes end to end.</p>`],
    newsongs: ["New songs", `
    <div class="set-group glass">
      ${s.speedMode === "multiplier" ? `<div class="set">
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
      </div>
    </div>
    <p class="foot">Where a new song starts. Each song keeps its own once you change it.</p>`],
    today: ["Today", `
    <div class="set-group glass">
      <div class="set">
        <span class="tile">${icon("flame")}</span><span class="name">Streak and daily nudge</span>
        <button class="toggle ${s.nudge !== false ? "on" : ""}" id="s-nudge" role="switch" aria-checked="${s.nudge !== false}" aria-label="Streak and daily nudge in the library"></button>
      </div>
      ${s.nudge !== false ? `<label class="fld fld-k"><span class="tile ftile">${icon("sun")}</span>
        <input id="s-city" type="text" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="search" placeholder="City for weather (optional)" value="${esc(s.place?.name || "")}" aria-label="City for weather"></label>
      <div class="key-row">
        <span class="ai-status"><i class="dot ${s.place ? "on" : ""}"></i>${s.place ? "Weather on" : "No weather"}</span>
        ${s.place ? `<button class="btn sm" id="s-cityremove">Remove</button>` : ""}
        <button class="btn sm primary" id="s-cityfind">Find</button>
      </div>
      <div id="s-cities"></div>` : ""}
    </div>
    <p class="foot">Under the library's title: your practice streak (a day counts when a song plays to its end) and, until you play today, one song to try. With a city, the weather picks it: a slow song on a rainy day. Only the city's position is sent, once a day; Tabs never asks for your location. Weather data by <a href="https://open-meteo.com" target="_blank" rel="noopener">Open-Meteo.com</a>.</p>`],
    keys: ["Keys", `
    <p class="foot" style="margin:0 4px 14px">Each key stays on this phone and is sent only to its own service.</p>
    <div class="label">Anthropic · AI help</div>
    <div class="set-group glass">
      <label class="fld fld-k"><span class="tile ftile">${icon("wand")}</span>
        <input id="s-key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Anthropic API key (sk-ant-...)" value="${esc(aiKey())}" aria-label="Anthropic API key"></label>
      <div class="key-row">
        <span class="ai-status"><i class="dot ${aiKey() ? "on" : ""}"></i>${aiKey() ? "On" : "Off"}</span>
        <button class="btn sm" id="s-test">Test</button>
        ${aiKey() ? `<button class="btn sm" id="s-remove">Remove</button>` : ""}
        <button class="btn sm primary" id="s-savekey">Save key</button>
      </div>
    </div>
    <p class="foot" id="s-keymsg" aria-live="polite"></p>
    <details class="foot s-why"><summary>What it's used for</summary>Adds Clean up and Scan a page when adding songs, and Make it easier and Spark tone in a song's ••• menu. The key stays on this phone and is sent only to Anthropic. Cleanup and scans send the pasted text or photo; Make it easier and Spark tone send only the song's title, artist and chord names. Use a key made just for Tabs, with a low monthly spend limit.</details>
    <div class="label">GetSongBPM · Tempo data</div>
    <div class="set-group glass">
      <label class="fld fld-k"><span class="tile ftile">${icon("metro")}</span>
        <input id="s-bpmkey" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="GetSongBPM API key" value="${esc(bpmKey())}" aria-label="GetSongBPM API key"></label>
      <div class="key-row">
        <span class="ai-status"><i class="dot ${bpmKey() ? "on" : ""}"></i>${bpmKey() ? "On" : "Off"}</span>
        ${bpmKey() ? `<button class="btn sm" id="s-bpmremove">Remove</button>` : ""}
        <button class="btn sm primary" id="s-bpmsave">Save key</button>
      </div>
    </div>
    <details class="foot s-why"><summary>What it's used for</summary>Get the song checks the chart's tempo and time signature against GetSongBPM's measured data. The free key is at <a href="https://getsongbpm.com/api" target="_blank" rel="noopener">getsongbpm.com/api</a>; it stays on this phone and is sent only to GetSongBPM, with the song's title and artist. Words come from <a href="https://lrclib.net" target="_blank" rel="noopener">LRCLIB</a>, which needs no key.</details>
    <p class="foot credit">Tempo data by <a href="https://getsongbpm.com" target="_blank" rel="noopener">GetSongBPM.com</a></p>`],
    library: ["Library and backups", `
    <div class="set-group glass">
      <button class="set" id="s-export"><span class="tile">${icon("cloud")}</span><span class="name">Back up now</span><span class="val muted">${ago(s.lastBackup)}</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-import"><span class="tile">${icon("download")}</span><span class="name">Import backup</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-trash"><span class="tile">${icon("trash")}</span><span class="name">Recently deleted</span><span class="val muted">${data.trash.length || ""}</span>${icon("chev", "chev")}</button>
    </div>
    <input type="file" id="file" accept=".json,application/json" hidden>
    <p class="foot">${data.songs.length} song${data.songs.length === 1 ? "" : "s"}, stored only on this phone${where.db ? ` in its database (${kb(where.size || JSON.stringify(data).length)})${where.copy === false ? "" : ", with a copy in browser storage"}` : ""}${storageKept ? ", kept permanently" : storageKept === false ? ". The browser may clear it if Tabs isn't added to your Home Screen" : ""}. Back up weekly to iCloud Drive: tap Back up now, then Save to Files. Add Tabs to your Home Screen from the Share menu to use it offline.</p>`],
    help: ["Help", `
    <div class="set-group glass">
      <button class="set" id="s-tips"><span class="tile">${icon("info")}</span><span class="name">Tips &amp; gestures</span>${icon("chev", "chev")}</button>
      <button class="set" id="s-diag"><span class="tile">${icon("info")}</span><span class="name">Copy diagnostics</span><span class="val muted">${problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : ""}</span>${icon("chev", "chev")}</button>
    </div>`]
  };
  if (PAGES[page]) {
    app.innerHTML = head(PAGES[page][0], "Back to settings") + PAGES[page][1];
  } else {
    // The main menu: one row per page, each showing where it stands.
    const city = s.place?.name?.split(",")[0];
    const diagOn = [s.diagrams === true, s.pauseDiagrams !== false, s.songMap !== false, (s.focus || "always") !== "off"].filter(Boolean).length;
    const theme = { dark: "Dark", light: "Light" }[s.theme] || "Auto";
    const row = (id, ic, name, val, muted = false) => `<button class="set" data-page="${id}"><span class="tile">${icon(ic)}</span><span class="name">${name}</span><span class="val${muted ? " muted" : ""}">${val}</span>${icon("chev", "chev")}</button>`;
    const n = data.songs.length;
    app.innerHTML = head("Settings", "Back to library") + `
    <div class="set-group glass">
      ${row("playing", "play", "Playing", [s.speedMode === "multiplier" ? "1x style" : "Song length", s.countIn !== false && "Count-in", s.stage && "Stage"].filter(Boolean).join(" · "))}
      ${row("diagrams", "fretboard", "Chord diagrams", `${diagOn} of 4 on`)}
      ${row("look", "moon", "Look", `${theme} · ${s.controls === "bar" ? "Bar" : "Hold Play"}`)}
      ${row("newsongs", "sliders", "New songs", `${s.speedMode === "multiplier" ? ((s.startSpeed || SPEEDS.medium) / SPEEDS.medium).toFixed(1) + "x" : mmss(s.startLength || 210)} · ${t ? semis(t) : "No transpose"}`)}
    </div>
    <div class="set-group glass s-gap">
      ${row("today", "flame", "Today", s.nudge === false ? "Off" : city ? esc(city) : "On")}
      ${row("keys", "wand", "Keys", `<span class="s-keys">${dot(aiKey())}AI ${dot(bpmKey())}Tempo</span>`, true)}
    </div>
    <div class="set-group glass s-gap">
      ${row("library", "cloud", "Library and backups", `${n} song${n === 1 ? "" : "s"}`, true)}
      ${row("help", "info", "Help", problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : "Tips, diagnostics", true)}
    </div>
    <p class="foot s-ver" id="s-ver">Tabs ${VERSION}</p>
    <div class="s-dock"><button class="btn primary" id="s-backup">${icon("cloud")}Back up now</button><span>Last backup ${esc(ago(s.lastBackup) || "never")}</span></div>`;
  }
  document.getElementById("back").onclick = () => go(PAGES[page] ? "#/settings" : "#/");
  app.querySelectorAll("[data-page]").forEach(b => b.onclick = () => go("#/settings/" + b.dataset.page));
  document.getElementById("s-backup")?.addEventListener("click", async () => { if (await backupNow()) { renderSettings(); toast("Backed up"); } });
  // Each page has only its own controls; the rest are skipped.
  const $ = id => document.getElementById(id) || { addEventListener() {}, querySelectorAll: () => [] };
  $("s-speed")?.addEventListener("change", e => { s.startSpeed = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-length")?.addEventListener("change", e => { s.startLength = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-mode").onchange = e => { s.speedMode = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-count").onclick = () => { s.countIn = s.countIn === false; Tabs.save(data); renderSettings(); };
  $("s-streak").onclick = () => { s.streakMoment = s.streakMoment === false; Tabs.save(data); renderSettings(); };
  $("s-metro").onclick = () => { s.metronome = !s.metronome; Tabs.save(data); renderSettings(); };
  /* The volume saves as it moves; letting go plays a bar's opening beat at that level. */
  $("s-metvol")?.addEventListener("input", e => { s.metroVol = +e.target.value / 100; e.target.style.setProperty("--fill", e.target.value + "%"); Tabs.save(data); });
  $("s-metvol")?.addEventListener("change", () => metroPreview());
  $("s-metbeat")?.addEventListener("change", e => { s.metroBeat = e.target.value; Tabs.save(data); renderSettings(); metroPreview(); });
  app.querySelectorAll("#s-metswing [data-m]").forEach(b => b.onclick = () => { s.metroSwing = b.dataset.m; Tabs.save(data); renderSettings(); metroPreview(); });
  $("s-metdrop")?.addEventListener("click", () => { s.metroDrop = !s.metroDrop; Tabs.save(data); renderSettings(); });
  app.querySelectorAll("#s-metsound [data-m]").forEach(b => b.onclick = () => { s.metroSound = b.dataset.m; Tabs.save(data); renderSettings(); metroPreview(); });
  $("s-tolex").onclick = () => { s.tolex = !s.tolex; Tabs.save(data); applyTheme(); renderSettings(); };
  $("s-stage").onclick = () => { s.stage = !s.stage; Tabs.save(data); applyTheme(); renderSettings(); };
  $("s-transpose")?.addEventListener("change", e => { s.transpose = +e.target.value; Tabs.save(data); renderSettings(); });
  $("s-diagrams").onclick = () => { s.diagrams = s.diagrams !== true; Tabs.save(data); renderSettings(); };
  $("s-map").onclick = () => { s.songMap = s.songMap === false; Tabs.save(data); renderSettings(); };
  $("s-nudge").onclick = () => { s.nudge = s.nudge === false; Tabs.save(data); renderSettings(); };
  const findCity = async () => {
    const name = $("s-city").value.trim(), out = $("s-cities");
    if (!name) { toast("Type a city first"); return; }
    $("s-cityfind").innerHTML = busy("Finding");
    let list = [];
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=5&language=en&format=json`);
      list = r.ok ? ((await r.json()).results || []) : [];
    } catch { toast("Couldn't reach the weather service. Try again when online"); }
    if ($("s-cityfind")) $("s-cityfind").textContent = "Find";
    if (!list.length) { out.innerHTML = `<p class="foot" style="margin:0 14px 12px">No place by that name.</p>`; return; }
    const label = c => [c.name, c.admin1, c.country_code].filter(Boolean).join(", ");
    out.innerHTML = `<div class="city-list">${list.map((c, i) => `<button class="set" data-city="${i}"><span class="name">${esc(label(c))}</span>${icon("chev", "chev")}</button>`).join("")}</div>`;
    out.querySelectorAll("[data-city]").forEach(b => b.onclick = () => {
      const c = list[+b.dataset.city];
      s.place = { name: label(c), lat: Math.round(c.latitude * 100) / 100, lon: Math.round(c.longitude * 100) / 100 };
      Tabs.save(data); renderSettings(); toast("Weather on for " + c.name);
    });
  };
  $("s-cityfind")?.addEventListener("click", findCity);
  $("s-city")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); findCity(); } });
  $("s-cityremove")?.addEventListener("click", () => { delete s.place; Tabs.save(data); renderSettings(); toast("Weather off"); });
  $("s-pause").onclick = () => { s.pauseDiagrams = s.pauseDiagrams === false; Tabs.save(data); renderSettings(); };
  $("s-focus").onchange = e => { s.focus = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-arc")?.addEventListener("change", e => { s.arcSweep = e.target.value; Tabs.save(data); renderSettings(); });
  $("s-controls").onchange = e => { s.controls = e.target.value; Tabs.save(data); renderSettings(); };
  $("s-follow")?.addEventListener("change", async e => {
    s.follow = e.target.value;
    if (s.follow === "hand" && !(await askMotion())) { s.follow = "touch"; toast("Motion wasn't allowed, so Play follows your touch"); }
    Tabs.save(data); renderSettings();
  });
  app.querySelectorAll("#s-theme [data-t]").forEach(b => b.onclick = () => { s.theme = b.dataset.t; Tabs.save(data); applyTheme(); renderSettings(); });
  $("s-savekey").onclick = () => {
    const k = $("s-key").value.trim();
    if (!k) { toast("Paste a key first"); return; }
    try { localStorage.setItem(AI.store, k); } catch {}
    renderSettings(); toast("Key saved");
  };
  const BPM = BPM_STORE;
  $("s-bpmsave").onclick = () => {
    const k = $("s-bpmkey").value.trim();
    if (!k) { toast("Paste a key first"); return; }
    try { localStorage.setItem(BPM, k); } catch {}
    renderSettings(); toast("Key saved");
  };
  $("s-bpmremove")?.addEventListener("click", () => {
    try { localStorage.removeItem(BPM); } catch {}
    renderSettings(); toast("Key removed from this phone");
  });
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
  $("back").onclick = () => go("#/settings/library");
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
