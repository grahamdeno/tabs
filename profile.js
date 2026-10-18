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
  </div>`;

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
    <div class="head"><button class="ib glass" id="back" aria-label="Back to the library">${icon("back")}</button></div>
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
  text("Played on Tabs", 96, 220, 64, "#f1e3c4", 600);
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
// Once a day, after the first song you finish: a flame races up the G string to
// the 12th fret, bursts into fireworks, and settles as the pick on fire, while
// the count rolls up and the week's lamps light. Drawn in SVG and moved with
// CSS, so there's nothing to download. With Reduce Motion it opens on the
// final picture. Tap anywhere (or Keep playing) to close.
const FLAME = "M100 250 C66 222 34 178 36 132 C38 96 56 70 70 46 C74 74 84 84 92 86 C90 60 104 30 128 12 C124 44 140 64 152 86 C162 104 166 120 164 136 C160 180 130 222 100 250 Z";
const INNER = "M100 232 C80 210 64 184 66 158 C68 134 82 122 92 108 C94 126 102 132 110 134 C110 120 118 110 126 104 C130 120 136 136 136 156 C136 186 120 212 100 232 Z";
const PICK = "M100 250 C72 214 40 168 40 128 C40 96 66 80 100 80 C134 80 160 96 160 128 C160 168 128 214 100 250 Z";
const SK_DEFS = `<defs>
  <linearGradient id="sk-fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d8401c"/><stop offset=".45" stop-color="#f27b22"/><stop offset=".8" stop-color="#ffc03c"/><stop offset="1" stop-color="#ffe17a"/></linearGradient>
  <linearGradient id="sk-fl2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f29a2e"/><stop offset="1" stop-color="#ffe9a0"/></linearGradient>
  <radialGradient id="sk-hot" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff6d8"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
  <radialGradient id="sk-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff9a3c" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
  <linearGradient id="sk-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4127"/><stop offset=".5" stop-color="#55331d"/><stop offset="1" stop-color="#432714"/></linearGradient>
  <linearGradient id="sk-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1d9a0"/><stop offset=".5" stop-color="#cfab6a"/><stop offset="1" stop-color="#8f6a32"/></linearGradient>
  <filter id="sk-soft"><feGaussianBlur stdDeviation="3"/></filter>
</defs>`;
/* Fret positions along a 12-fret neck, from the nut at x0 to the 12th fret at x1. */
const fretX = (i, x0 = 10, x1 = 350) => x0 + (x1 - x0) * (1 - 2 ** (-i / 12)) * 2;
function runSVG() {
  const y = 8 + 3 * 16, mid12 = (fretX(11) + fretX(12)) / 2;
  let s = `<svg class="sk-run" viewBox="0 0 360 330" aria-hidden="true">${SK_DEFS}<g transform="translate(0 117)"><g class="sk-neck">
    <rect x="2" y="-4" width="356" height="104" rx="8" fill="#000" opacity=".35" filter="url(#sk-soft)"/>
    <rect x="10" y="0" width="340" height="96" rx="3" fill="url(#sk-wood)"/><rect x="10" y="0" width="5" height="96" fill="#efe6d2"/>`;
  for (let i = 1; i <= 12; i++) s += `<rect x="${(fretX(i) - 1).toFixed(1)}" y="0" width="2" height="96" fill="#b9b9c2"/>`;
  for (const i of [3, 5, 7, 9]) s += `<circle cx="${((fretX(i - 1) + fretX(i)) / 2).toFixed(1)}" cy="48" r="5" fill="#e9e2d0" opacity=".85"/>`;
  s += `<g class="sk-twelve"><circle cx="${mid12.toFixed(1)}" cy="26" r="5" fill="#e9e2d0"/><circle cx="${mid12.toFixed(1)}" cy="70" r="5" fill="#e9e2d0"/></g>`;
  for (let k = 0; k < 6; k++) s += `<rect x="10" y="${8 + k * 16}" width="340" height="${(1 + (5 - k) * 0.35).toFixed(2)}" fill="#e8e2d4"/>`;
  s += `<path class="sk-trail" d="M14 ${y}H${mid12.toFixed(1)}" stroke="#ffd27a" stroke-width="2.5" stroke-linecap="round" pathLength="1"/>
    <g class="sk-spark" style="--to:${(mid12 - 14).toFixed(1)}px"><g transform="translate(14 ${y})"><circle r="30" fill="url(#sk-glow)"/>
      <g transform="translate(0 6) scale(.3) translate(-100 -250)"><path d="${FLAME}" fill="url(#sk-fl)"/><ellipse cx="100" cy="190" rx="22" ry="30" fill="url(#sk-hot)"/></g></g></g>
  </g></g>`;
  /* fireworks: rays from a centre, each burst with its own delay */
  [[190, 120, 66, "#ffc03c", 0], [90, 150, 44, "#ff7a3c", 0.15], [290, 110, 46, "#ffe17a", 0.25], [240, 210, 28, "#f2643a", 0.4], [130, 70, 30, "#ffd27a", 0.5]].forEach(([cx, cy, r, c, d]) => {
    s += `<g transform="translate(${cx} ${cy})"><g class="sk-burst" style="--d:${d}s">`;
    for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
      s += `<line x1="${(cs * r * .45).toFixed(1)}" y1="${(sn * r * .45).toFixed(1)}" x2="${(cs * r).toFixed(1)}" y2="${(sn * r).toFixed(1)}" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${(cs * r).toFixed(1)}" cy="${(sn * r).toFixed(1)}" r="2.6" fill="#fff3d0"/>`; }
    s += `</g></g>`;
  });
  return s + `</svg>`;
}
const pickSVG = tier => `<svg class="sk-pick t${tier}" viewBox="0 0 200 290" aria-hidden="true">${SK_DEFS}
  <ellipse cx="100" cy="272" rx="56" ry="9" fill="#000" opacity=".45"/><circle cx="100" cy="150" r="118" fill="url(#sk-glow)"/>
  <g class="sk-burn"><path d="${FLAME}" fill="url(#sk-fl)"/><path d="${PICK}" fill="none" stroke="url(#sk-gold)" stroke-width="7"/>
  <path d="${INNER}" fill="url(#sk-fl2)" opacity=".9"/><ellipse class="sk-core" cx="100" cy="182" rx="20" ry="26" fill="url(#sk-hot)"/></g></svg>`;

export function showStreak(m, { share } = {}) {
  document.querySelector(".sk")?.remove();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "sk" + (still ? " still" : "");
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${m.n} day streak`);
  el.innerHTML = `<div class="sk-art">${runSVG()}${pickSVG(m.tier)}</div>
    <div class="sk-num" aria-live="polite">${still ? m.n : 0}</div><div class="sk-unit">day streak</div>
    <div class="sk-week">${m.slots.map(s => `<small class="${s.today ? "now" : ""}">${s.label}</small>`).join("")}${m.slots.map((s, i) => `<i class="${s.on ? "on" : ""}${s.goal ? " goal" : ""}${s.today ? " today" : ""}" style="--i:${i}">${s.goal && !s.on ? s.goal : ""}</i>`).join("")}</div>
    <p class="sk-say"><b>${esc(m.lead)}</b> ${esc(m.next)}</p>${m.best > m.n ? `<div class="sk-best">Your best: ${m.best} days</div>` : ""}
    <div class="sk-foot"><button class="sb2" id="sk-share" aria-label="Share your streak">${icon("share")}</button><button class="btn primary" id="sk-ok">Keep playing</button></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 250); removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key);
  el.addEventListener("click", e => { if (!e.target.closest("#sk-share")) close(); });
  el.querySelector("#sk-share").onclick = () => (share || shareStreak)(m);
  /* roll the number up once the pick appears */
  if (!still) setTimeout(() => {
    const num = el.querySelector(".sk-num"), t0 = performance.now(), dur = Math.min(900, 300 + m.n * 40);
    const step = t => { const k = Math.min(1, (t - t0) / dur); num.textContent = Math.round(m.n * (1 - (1 - k) ** 3)); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, 1900);
  return el;
}

// The streak as a picture: the burning pick, the count and the week.
async function shareStreak(m) {
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  const bg = g.createRadialGradient(W / 2, 420, 50, W / 2, 420, 900); bg.addColorStop(0, "#3a1e0a"); bg.addColorStop(1, "#0c0c0d");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#b8935a"; g.lineWidth = 6; g.strokeRect(36, 36, W - 72, H - 72);
  g.save(); g.translate(W / 2 - 300, 60); g.scale(3, 3);
  const fl = g.createLinearGradient(0, 250, 0, 12); fl.addColorStop(0, "#d8401c"); fl.addColorStop(.45, "#f27b22"); fl.addColorStop(.8, "#ffc03c"); fl.addColorStop(1, "#ffe17a");
  g.fillStyle = fl; g.fill(new Path2D(FLAME));
  const gold = g.createLinearGradient(0, 80, 0, 250); gold.addColorStop(0, "#f1d9a0"); gold.addColorStop(1, "#8f6a32");
  g.strokeStyle = gold; g.lineWidth = 7; g.stroke(new Path2D(PICK));
  const in2 = g.createLinearGradient(0, 232, 0, 104); in2.addColorStop(0, "#f29a2e"); in2.addColorStop(1, "#ffe9a0");
  g.fillStyle = in2; g.fill(new Path2D(INNER));
  const hot = g.createRadialGradient(100, 185, 2, 100, 185, 26); hot.addColorStop(0, "#fff"); hot.addColorStop(1, "rgba(255,246,216,0)");
  g.fillStyle = hot; g.beginPath(); g.ellipse(100, 182, 20, 26, 0, 0, Math.PI * 2); g.fill();
  g.restore();
  const text = (s, x, y, size, color, weight = 700) => { g.font = `${weight} ${size}px -apple-system, "SF Pro Display", "Segoe UI", sans-serif`; g.fillStyle = color; g.textAlign = "center"; g.fillText(s, x, y); };
  const num = g.createLinearGradient(0, 860, 0, 1040); num.addColorStop(0, "#ffd27a"); num.addColorStop(1, "#e0562a");
  text(String(m.n), W / 2, 1030, 220, num, 800);
  text("DAY STREAK ON TABS", W / 2, 1100, 40, "#ffb24a");
  m.slots.forEach((s, i) => {
    const x = W / 2 + (i - 3) * 120, y = 1190;
    g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.fillStyle = s.on ? "#f08a2a" : "#2a2a2e"; g.fill();
    if (s.goal && !s.on) { g.lineWidth = 4; g.strokeStyle = "#b8935a"; g.stroke(); text(String(s.goal), x, y + 10, 28, "#d9bd85"); }
    text(s.label, x, y - 50, 26, s.today ? "#ffb24a" : "#8a7f70", 600);
  });
  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  const file = new File([blob], "my-streak.png", { type: "image/png" });
  try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: `${m.n} day streak` }); } catch (e) { if (e?.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "my-streak.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
