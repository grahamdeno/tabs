// Your playing: the profile page (#/you). Everything on it is worked out on the
// phone from the library and its journal (profileOf in core.js); nothing is
// sent anywhere unless you share the card yourself.
//
// Order follows what a player wants first: the headline numbers to feel proud
// of, the newest milestones, then one card per question ("which chords have I
// got?", "what do I practice most?", "when do I play?"). Each card opens with
// a plain sentence that answers it, then a small picture. Cards with nothing
// to say yet stay hidden. Sharing is a button in thumb reach at the bottom.
import { Tabs, profileOf, territory, lifetimePlays, venueOf } from "./core.js";
import { app, esc, icon, toast } from "./ui.js";
import { data, go } from "./app.js";
import { louie } from "./louie.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const shortDay = d => { const [y, m, dd] = String(d).split("-"); return y && m ? `${MONTHS[+m - 1]} ${+dd || ""}${y !== String(new Date().getFullYear()) ? `, ${y}` : ""}`.replace(" ,", ",") : ""; };
const monthName = ym => { const [y, m] = String(ym).split("-"); return y && m ? `${FULL_MONTHS[+m - 1]}${y !== String(new Date().getFullYear()) ? ` ${y}` : ""}` : ""; };
const hoursText = h => h >= 10 ? Math.round(h).toString() : h >= 1 ? h.toFixed(1) : String(Math.round(h * 60));
const hoursUnit = h => h >= 1 ? "hours" : "minutes";
const card = (title, line, body) => `<section class="pf-card"><h2>${title}</h2><p class="pf-line">${line}</p>${body}</section>`;

export function renderProfile() {
  const fresh = !data.journal;
  const p = profileOf(data);
  if (fresh) Tabs.save(data); /* the journal was just worked out from your songs: keep it */
  const nothing = !p.plays && !p.tune.sessions;
  const since = p.since ? `Since ${shortDay(p.since)}` : "";

  /* The headline: three readouts set into an amp plate. */
  const hero = `<div class="pf-plate" role="group" aria-label="Headline numbers">
    <div class="pf-read"><b>${hoursText(p.hours)}</b><span>${hoursUnit(p.hours)} played</span></div>
    <div class="pf-read"><b>${p.songsPlayed}</b><span>song${p.songsPlayed === 1 ? "" : "s"} played</span></div>
    <div class="pf-read"><b>${p.streak}</b><span>day streak${p.best > p.streak ? ` · best ${p.best}` : ""}</span></div>
  </div>${p.practiceSecs >= 60 ? `<p class="pf-line pf-prac" id="pf-prac">Practice is part of that: ${Math.round(p.practiceSecs / 60)} min, worth ${Math.floor(p.practiceSecs / 240)} play${Math.floor(p.practiceSecs / 240) === 1 ? "" : "s"} on the Tour Map.</p>` : ""}`;

  const firsts = p.firsts.length ? `<div class="pf-firsts" aria-label="Latest milestones">${p.firsts.map(f => `<span class="pf-first${f.kind === "chord" && /^(F|Bm|F#m|Bb|B|C#m|Gm|Cm)$/.test(f.name) ? " big" : ""}"><i class="nx-lamp"></i>${f.kind === "chord" ? `First <b>${esc(f.name)}</b>` : `Got it: <b>${esc(f.name)}</b>`}<small>${esc(shortDay(f.at))}</small></span>`).join("")}</div>` : "";

  /* Chord passport: a stamp per chord, in the order you first played them. */
  const passport = p.chords.length ? card("Chord passport",
    `${p.chords.length} chord${p.chords.length === 1 ? "" : "s"} stamped${p.barres ? `, ${p.barres} of them barre chord${p.barres === 1 ? "" : "s"}` : ""}.${p.nextStamp ? ` Next stamp to earn: <b>${esc(p.nextStamp)}</b>.` : ""}`,
    `<div class="pf-stamps">${p.chords.map(c => `<div class="pf-stamp${c.barre ? " barre" : ""}"><b>${esc(c.name)}</b><span>${c.n}×</span><small>${esc(shortDay(c.first))}</small></div>`).join("")}${p.nextStamp ? `<div class="pf-stamp next"><b>${esc(p.nextStamp)}</b><span>next</span></div>` : ""}</div>`) : "";

  /* The switches your hands make most. */
  const top = p.changes[0]?.n || 1;
  const changes = p.changes.length ? card("Your changes",
    `<b>${esc(p.changes[0].a)} to ${esc(p.changes[0].b)}</b> is the switch you make most: about ${p.changes[0].n.toLocaleString()} times.`,
    `<div class="pf-bars">${p.changes.map(c => `<div class="pf-bar"><span>${esc(c.a)} ↔ ${esc(c.b)}</span><i style="--w:${Math.max(4, Math.round(c.n / top * 100))}%"></i><small>${c.n.toLocaleString()}</small></div>`).join("")}</div>`) : "";

  /* When you play: a lamp per weekday and part of the day, brighter the more you play. */
  const most = Math.max(1, ...p.rhythm.grid.flat());
  const rhythmHas = p.rhythm.top || p.best > 1 || p.rhythm.bestMonth;
  const rhythm = rhythmHas ? card("When you play",
    [p.rhythm.top && `Mostly on <b>${esc(p.rhythm.top)}</b>.`, p.best > 1 && `Longest streak: ${p.best} days.`, p.rhythm.bestMonth && `Best month: ${esc(monthName(p.rhythm.bestMonth.m))}, ${p.rhythm.bestMonth.plays} plays.`].filter(Boolean).join(" "),
    p.rhythm.top ? `<div class="pf-grid" role="img" aria-label="Plays by day and time of day">
      <span></span>${["Morn", "Aft", "Eve", "Late"].map(x => `<small>${x}</small>`).join("")}
      ${p.rhythm.grid.map((row, d) => `<small>${"SMTWTFS"[d]}</small>${row.map(n => `<i style="--a:${n ? (0.25 + 0.75 * n / most).toFixed(2) : 0}"></i>`).join("")}`).join("")}
    </div>` : "") : "";

  /* Keys you live in, and whether your tempo is creeping up. */
  const keyTotal = p.keys.reduce((a, k) => a + k.n, 0) || 1;
  const t = p.tempo, trend = t.earlier && t.recent ? Math.round(t.recent - t.earlier) : 0;
  const keys = p.keys.length ? card("Keys and tempo",
    `You live in <b>${esc(p.keys[0].key)}</b> (${Math.round(p.keys[0].n / keyTotal * 100)}% of your plays).${t.avg ? ` Average tempo ${Math.round(t.avg)} BPM${trend >= 3 ? `, up ${trend} lately` : trend <= -3 ? `, down ${-trend} lately` : ""}.` : ""}`,
    `<div class="pf-keys">${p.keys.map(k => `<span><b>${esc(k.key)}</b>${Math.round(k.n / keyTotal * 100)}%</span>`).join("")}</div>
     ${t.months.length >= 2 ? spark(t.months.map(x => x.bpm), "Average tempo by month") : ""}`) : "";

  /* Repertoire: songs marked Got it, month by month over the last year. */
  const rep = p.got ? card("Repertoire",
    `<b>${p.got} song${p.got === 1 ? "" : "s"}</b> you've got${p.yearAgo < p.got ? `, up from ${p.yearAgo} a year ago` : ""}.`,
    bars(p.repertoire.map(x => x.n), p.repertoire.map(x => MONTHS[+x.m.slice(5) - 1][0]))) : "";

  /* Comfort zone and the ones worth another try: each opens the song. */
  const row = s => `<button class="pf-song" data-song="${esc(s.id)}"><span>${esc(s.title)}</span><small>${s.n} play${s.n === 1 ? "" : "s"}</small>${icon("chev", "chev")}</button>`;
  const zone = p.comfort.length ? card("Comfort zone and stretch",
    p.dropped.length ? `You keep coming back to <b>${esc(p.comfort[0].title)}</b>. ${p.dropped.length === 1 ? "One song" : `${p.dropped.length} songs`} you tried and left might be ready for another go.` : `You keep coming back to <b>${esc(p.comfort[0].title)}</b>.`,
    `<div class="pf-cols"><div><h3>Go-tos</h3>${p.comfort.map(row).join("")}</div>${p.dropped.length ? `<div><h3>Worth another try</h3>${p.dropped.map(row).join("")}</div>` : ""}</div>`) : "";

  const sets = p.sets || p.together.length ? card("Sets",
    [p.sets && `Most played set: <b>${esc(p.sets.name)}</b>, played through ${p.sets.runs} time${p.sets.runs === 1 ? "" : "s"}.`, p.together[0] && `<b>${esc(p.together[0].a)}</b> and <b>${esc(p.together[0].b)}</b> always end up together.`].filter(Boolean).join(" "), "") : "";

  const tw = p.tune.worst;
  const tune = p.tune.sessions ? card("Tuning",
    `Tuned ${p.tune.sessions} time${p.tune.sessions === 1 ? "" : "s"}.${tw && tw.rate > 0 ? ` The <b>${esc(tw.string)}</b> string drifts most: off in ${Math.round(tw.rate * 100)}% of checks.` : ""}`,
    p.tune.drift.some(x => x.checked) ? `<div class="pf-bars">${p.tune.drift.map(x => `<div class="pf-bar"><span>${esc(x.string)}</span><i style="--w:${Math.max(2, Math.round(x.rate * 100))}%"></i><small>${x.checked ? Math.round(x.rate * 100) + "%" : "–"}</small></div>`).join("")}</div>` : "") : "";

  const plays = lifetimePlays(data), terr = territory(plays);
  const ven = venueOf(plays);
  const mapCard = `<button class="pf-card pf-mapcard" id="pf-map"><h2>Tour Map</h2><p class="pf-line"><b>${esc(ven.name)}.</b> ${terr.cells} hexagon${terr.cells === 1 ? "" : "s"} lit, ${ven.toNext} play${ven.toNext === 1 ? "" : "s"} to the ${esc(ven.next)}.</p>${icon("chev", "chev")}</button>`;
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back to the Road">${icon("back")}</button></div>
    <h1 class="title" style="margin:14px 2px 2px">Your playing</h1>
    <p class="pf-since">${esc(since)}</p>
    ${nothing ? `<p class="pf-empty">Play a song through to the end and this page starts filling in: hours played, the chords you've stamped, the changes you make most, and when you play.</p>` : `${hero}${mapCard}${firsts}${passport}${changes}${rhythm}${keys}${rep}${zone}${sets}${tune}
    <p class="foot">Worked out on this phone from your plays. Plays from before ${esc(shortDay(p.seeded))} are counted from each song's play total, so hours and changes before then are estimates.</p>`}
    ${nothing ? "" : `<div class="s-dock pf-dock"><button class="btn primary" id="pf-share">${icon("share")}Share my playing</button></div>`}`;
  document.getElementById("back").onclick = () => go("#/");
  document.getElementById("pf-map")?.addEventListener("click", () => go("#/playmap"));
  app.querySelectorAll("[data-song]").forEach(b => b.onclick = () => go("#/song/" + encodeURIComponent(b.dataset.song)));
  document.getElementById("pf-share")?.addEventListener("click", () => shareCard(p));
}

// A small line of the last months' values.
function spark(vals, label) {
  const w = 280, h = 44, lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * w).toFixed(1)},${(h - 6 - (v - lo) / span * (h - 12)).toFixed(1)}`).join(" ");
  return `<svg class="pf-spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}"><polyline points="${pts}"/></svg>`;
}
// Monthly bars with a letter under each.
function bars(vals, labels) {
  const hi = Math.max(1, ...vals);
  return `<div class="pf-cols13" role="img" aria-label="Songs you've got, by month">${vals.map((v, i) => `<div><i style="--h:${Math.round(v / hi * 100)}%"></i><small>${esc(labels[i])}</small></div>`).join("")}</div>`;
}

/* Louie for the share card: a canvas can't read the page's CSS variables, so his Festival colours are written into the picture itself. */
const LOUIE_CARD_CSS = ".lv-b{fill:#3A86FF}.lv-s{fill:#2C6FE0}.lv-ss{stroke:#2C6FE0}.lv-hi{fill:#6BA4FF;opacity:.9}.lv-f{fill:#FFD23F}.lv-fs{fill:#F2B705}.lv-l{stroke:#2C6FE0}.lv-c{fill:#FF3D7F;opacity:.6}.lv-p{fill:#14213D}.lv-ps{stroke:#14213D}.lv-g{fill:#14213D}.lv-gs{fill:#2A3A63}.lv-m{fill:#14213D}.lv-ms{stroke:#14213D}.lv-t{fill:#FF3D7F}.lv-lamp{fill:#FF3D7F}.lv-shadow{fill:#14213D;opacity:.18}";
async function louieCardImage() {
  const svg = louie("cheer", { pose: "hornsUp", size: 400 }).replace(/^<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ').replace(/^<svg[^>]*>/, m => `${m}<style>${LOUIE_CARD_CSS}</style>`);
  const im = new Image(); im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); await im.decode();
  return im;
}
// The share card: a picture of the headline numbers, the newest milestone and
// your most played change, drawn on the phone and handed to the share sheet.
async function shareCard(p) {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#1b1a1d"); bg.addColorStop(1, "#0c0c0d");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b8935a"; g.lineWidth = 6; g.strokeRect(36, 36, W - 72, H - 72);
  const text = (s, x, y, size, color, weight = 600, align = "left") => { g.font = `${weight} ${size}px -apple-system, "SF Pro Display", "Segoe UI", sans-serif`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
  text(`MY GUITAR · SINCE ${shortDay(p.since).toUpperCase()}`, 96, 150, 34, "#b8935a", 700);
  text("Played on The Road", 96, 220, 64, "#f1e3c4", 600);
  /* Louie throwing the horns, top right */
  try { const im = await louieCardImage(); g.drawImage(im, W - 96 - 200, 36, 200, Math.round(200 * im.naturalHeight / im.naturalWidth)); } catch {}
  /* the plate */
  const plate = g.createLinearGradient(0, 260, 0, 520); plate.addColorStop(0, "#e6cb92"); plate.addColorStop(0.42, "#cfab6a"); plate.addColorStop(1, "#b08b4f");
  g.fillStyle = plate; g.beginPath(); g.roundRect(96, 260, W - 192, 260, 36); g.fill();
  const reads = [[hoursText(p.hours), `${hoursUnit(p.hours)}`], [String(p.songsPlayed), "songs"], [String(p.chords.length), "chords"]];
  reads.forEach(([n, l], i) => {
    const x = 126 + i * 286;
    g.fillStyle = "#241d12"; g.beginPath(); g.roundRect(x, 290, 256, 200, 24); g.fill();
    text(n, x + 128, 405, 104, "#ffc27a", 700, "center");
    text(l.toUpperCase(), x + 128, 460, 30, "#a99b80", 700, "center");
  });
  let y = 610;
  const lines = [
    p.streak > 1 && [`${p.streak}-day streak`, p.best > p.streak ? `best ${p.best}` : ""],
    p.firsts[0] && [p.firsts[0].kind === "chord" ? `First ${p.firsts[0].name}` : `Got it: ${p.firsts[0].name}`, shortDay(p.firsts[0].at)],
    p.changes[0] && [`${p.changes[0].a} to ${p.changes[0].b}`, `my most played change`],
    p.keys[0] && [`Mostly in ${p.keys[0].key}`, p.tempo.avg ? `${Math.round(p.tempo.avg)} BPM on average` : ""]
  ].filter(Boolean).slice(0, 3);
  for (const [a, b] of lines) { text(a, 96, y, 58, "#f1e3c4", 600); if (b) text(b, 96, y + 50, 34, "#a99b80", 500); y += 125; }
  /* the passport: a stamp per chord, barre chords in copper */
  const stamps = p.chords.slice(-12);
  if (stamps.length) {
    text("CHORD PASSPORT", 96, y + 20, 30, "#b8935a", 700);
    stamps.forEach((c, i) => {
      const cx = 160 + (i % 6) * 152, cy = y + 120 + Math.floor(i / 6) * 135;
      g.beginPath(); g.arc(cx, cy, 54, 0, Math.PI * 2); g.lineWidth = c.barre ? 6 : 3; g.strokeStyle = c.barre ? "#c8804f" : "rgba(184,147,90,.6)"; g.stroke();
      text(c.name, cx, cy + 14, c.name.length > 4 ? 28 : c.name.length > 3 ? 34 : 44, c.barre ? "#eda27f" : "#f1e3c4", 700, "center");
    });
  }

  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  const file = new File([blob], "my-playing.png", { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: "My playing" });
  } catch (e) { if (e?.name === "AbortError") return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "my-playing.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast("Saved the picture");
}

// ---------- The streak moment ----------
// Once a day, after the first song you finish (4.15.0): the screen floods with
// the streak colour, Louie drops in and lands with a squash, throws the horns
// in front of a flame that grows with the streak, confetti falls, the count
// rolls up and the week's circles fill one by one. SVG and CSS only. With
// Reduce Motion it opens on the final picture. Tap anywhere (or Keep playing)
// to close.
const SK_FLAME = `<svg class="sk-flame" viewBox="0 0 30 34" aria-hidden="true"><path class="sk-f1" d="M15 1c2 6 13 10 13 20a13 13 0 0 1-26 0c0-6 3-9 6-12 0 4 2 6 3 6 0-6-1-10 4-14z"/><path class="sk-f2" d="M15 7c2 5 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 2 4 0-4 0-7 3-11z"/><path class="sk-f3" d="M15 18c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z"/></svg>`;
/* confetti: fixed spots so every run looks the same; colours come from the palette */
const SK_BITS = Array.from({ length: 22 }, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--d:${((i * 7) % 10) / 10 + 0.5}s;--r:${(i * 53) % 360}deg;--s:${(i % 3) + 1}"></i>`).join("");

export function showStreak(m, { share } = {}) {
  document.querySelector(".sk")?.remove();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "sk" + (still ? " still" : "");
  el.dataset.tier = m.tier;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${m.n} day streak`);
  el.innerHTML = `<div class="sk-art" aria-hidden="true"><div class="sk-rays"></div><div class="sk-bits">${SK_BITS}</div>${SK_FLAME}<div class="sk-lou">${louie("cheer", { pose: "hornsUp", size: 170 })}</div><span class="sk-ping"></span></div>
    <div class="sk-num" aria-live="polite">${still ? m.n : 0}</div><div class="sk-unit">day streak</div>
    <div class="sk-week">${m.slots.map(s => `<small class="${s.today ? "now" : ""}">${s.label}</small>`).join("")}${m.slots.map((s, i) => `<i class="${s.on ? "on" : ""}${s.goal ? " goal" : ""}${s.today ? " today" : ""}" style="--i:${i}">${s.goal && !s.on ? s.goal : ""}</i>`).join("")}</div>
    <p class="sk-say"><b>${esc(m.lead)}</b> ${esc(m.next)}</p>${m.best > m.n ? `<div class="sk-best">Your best: ${m.best} days</div>` : ""}
    <div class="sk-foot"><button class="sb2" id="sk-share" aria-label="Share your streak">${icon("share")}</button><button class="btn" id="sk-ok">Keep playing</button></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key);
  el.addEventListener("click", e => { if (!e.target.closest("#sk-share")) close(); });
  el.querySelector("#sk-share").onclick = () => (share || shareStreak)(m);
  /* roll the number up as Louie lands */
  if (!still) setTimeout(() => {
    const num = el.querySelector(".sk-num"), t0 = performance.now(), dur = Math.min(900, 300 + m.n * 40);
    const step = t => { const k = Math.min(1, (t - t0) / dur); num.textContent = Math.round(m.n * (1 - (1 - k) ** 3)); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 700);
  return el;
}

// The streak as a picture: Louie in front of the flame, the count and the week, in Festival colours.
async function shareStreak(m) {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d"), INK = "#14213D";
  g.fillStyle = "#FF8A00"; g.fillRect(0, 0, W, H);
  /* sunburst */
  g.save(); g.translate(W / 2, 470); g.fillStyle = "rgba(255,255,255,.14)";
  for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, -900); g.lineTo(90, -900); g.closePath(); g.fill(); }
  g.restore();
  /* the flame, then Louie */
  g.save(); g.translate(W / 2 - 300, 120); g.scale(20, 20);
  [["M15 1c2 6 13 10 13 20a13 13 0 0 1-26 0c0-6 3-9 6-12 0 4 2 6 3 6 0-6-1-10 4-14z", "#FFD23F"], ["M15 7c2 5 9 8 9 15a9 9 0 0 1-18 0c0-4 2-6 4-8 0 3 1 4 2 4 0-4 0-7 3-11z", "#FFFFFF"], ["M15 18c2 3 4 4 4 7a4 4 0 0 1-8 0c0-3 2-4 4-7z", "#FF3D7F"]].forEach(([d, f]) => { g.fillStyle = f; g.fill(new Path2D(d)); });
  g.restore();
  try { const im = await louieCardImage(); const w = 440, h = Math.round(w * im.naturalHeight / im.naturalWidth); g.drawImage(im, W / 2 - w / 2, 720 - h, w, h); } catch {}
  try { await document.fonts.load('700 200px "Fredoka"'); } catch {}
  const text = (s, x, y, size, color, weight = 700) => { g.font = `${weight} ${size}px "Fredoka", "Nunito", -apple-system, sans-serif`; g.fillStyle = color; g.textAlign = "center"; g.fillText(s, x, y); };
  text(String(m.n), W / 2, 960, 220, INK);
  text("DAY STREAK ON THE ROAD", W / 2, 1040, 44, INK, 600);
  m.slots.forEach((s, i) => {
    const x = W / 2 + (i - 3) * 120, y = 1190;
    g.beginPath(); g.arc(x, y, 38, 0, Math.PI * 2); g.fillStyle = s.on ? "#FFFFFF" : "rgba(20,33,61,.18)"; g.fill();
    if (s.on) { g.strokeStyle = "#C96A00"; g.lineWidth = 8; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(x - 14, y + 1); g.lineTo(x - 3, y + 12); g.lineTo(x + 16, y - 10); g.stroke(); }
    else if (s.goal) text(String(s.goal), x, y + 11, 30, INK);
    text(s.label, x, y - 56, 28, INK, s.today ? 700 : 500);
  });
  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  const file = new File([blob], "my-streak.png", { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: `${m.n} day streak` }); } catch (e) { if (e?.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "my-streak.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
