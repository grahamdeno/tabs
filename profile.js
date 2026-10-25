// Your playing: the profile page (#/you). Everything on it is worked out on the
// phone from the library and its journal (profileOf in core.js); nothing is
// sent anywhere unless you share the card yourself.
//
// Order follows what a player wants first: the headline numbers to feel proud
// of, the newest milestones, then one card per question ("which chords have I
// got?", "what do I practice most?", "when do I play?"). Each card opens with
// a plain sentence that answers it, then a small picture. Cards with nothing
// to say yet stay hidden. Sharing is a button in thumb reach at the bottom.
import { PASSPORT, STREAK_GOALS, Tabs, badgesOf, bandState, chartState, fansToSpend, friendsOf, levelOf, playableSongs, profileOf, lifetimePlays, venueOf } from "./core.js";
import { app, esc, icon, layer, toast } from "./ui.js";
import { chordSVG, data, go } from "./app.js";
import { louie } from "./louie.js";
import { stageLight, hornsIcon, knobIcon, guitarIcon, buzz } from "./rock.js";
import { friend } from "./friends.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = d => { const [y, m, dd] = String(d).split("-"); return y && m ? `${MONTHS[+m - 1]} ${+dd || ""}${y !== String(new Date().getFullYear()) ? `, ${y}` : ""}`.replace(" ,", ",") : ""; };
const hoursText = h => h >= 10 ? Math.round(h).toString() : h >= 1 ? h.toFixed(1) : String(Math.round(h * 60));
const hoursUnit = h => h >= 1 ? "hours" : "minutes";

export function renderProfile() {
  const p = profileOf(data);
  Tabs.save(data); /* the journal may have just been worked out from your songs (here or by the stat bar): keep it */
  const nothing = !p.plays && !p.tune.sessions;
  const since = p.since ? `Since ${shortDay(p.since)}` : "";

  /* 4.19.0: the chord passport. A page per family with every chord to collect: earned stamps solid and
     a little rotated like ink, the rest dashed. The next one to earn has Learn it (a lesson in Rehearse). */
  const have = new Map(p.chords.map(c => [c.name, c]));
  const nextUp = PASSPORT.flatMap(f => f.chords).find(c => !have.has(c));
  const tilt = name => ((name.charCodeAt(0) * 7 + name.length * 13) % 11) - 5;
  const stamp = (c, fam) => have.has(c)
    ? `<button class="pf-pstamp on k-${fam}" data-stamp="${esc(c)}" style="--r:${tilt(c)}deg" aria-label="${esc(c)}: stamped. Show it">${esc(c)}</button>`
    : `<span class="pf-pstamp${c === nextUp ? " next" : ""}" aria-label="${esc(c)}: ${c === nextUp ? "next to earn" : "not yet"}">${esc(c)}</span>`;
  const extra = p.chords.filter(c => !PASSPORT.some(f => f.chords.includes(c.name)));
  const pages = [...PASSPORT, ...(extra.length ? [{ id: "other", name: "More chords", chords: extra.map(c => c.name), all: true }] : [])];
  const passport = `<div class="pf-label"><span>CHORD PASSPORT</span><span>${p.chords.length} stamped</span></div>
    <section class="pf-passport">${pages.map(f => { const got = f.chords.filter(c => have.has(c)).length;
      return `<div class="pf-ppage"><div class="pf-ppage-h"><b>${esc(f.name)}</b><span>${f.all ? got : `${got} of ${f.chords.length}`}</span></div><div class="pf-pgrid">${f.chords.map(c => stamp(c, f.id)).join("")}</div></div>`; }).join("")}
      ${nextUp ? `<div class="pf-pnext"><span><small>NEXT STAMP</small><b>${esc(nextUp)}</b></span><button class="btn primary" id="pf-learn" data-chord="${esc(nextUp)}">Learn it</button></div>` : ""}
    </section>`;

  /* 4.19.0: Your stats, four cards: a big number, one small picture, one short caption */
  const wk = p.week, wkMax = Math.max(60, ...wk.map(d => d.secs)), wkMins = Math.round(wk.reduce((a, d) => a + d.secs, 0) / 60);
  const statTime = `<section class="pf-stat"><div class="pf-stat-h"><b>${hoursText(p.hours)}</b><span>${hoursUnit(p.hours)} played</span></div>
      <div class="pf-wbars" role="img" aria-label="Minutes played on each of the last seven days">${wk.map(d => `<div><i style="--h:${Math.round(d.secs / wkMax * 100)}%"></i><small>${d.day}</small></div>`).join("")}</div>
      <p>${wkMins ? `${wkMins} min in the last seven days` : "Nothing in the last seven days yet"}</p></section>`;
  const most = Math.max(1, ...p.rhythm.grid.flat());
  const statWhen = p.rhythm.top ? `<section class="pf-stat"><div class="pf-stat-h"><b>${esc(p.rhythm.top.split(" ")[0].slice(0, 3))}</b><span>${esc(p.rhythm.top.split(" ").slice(1).join(" "))}</span></div>
      <div class="pf-grid" role="img" aria-label="Plays by day and time of day"><span></span>${["Morn", "Aft", "Eve", "Late"].map(x => `<small>${x}</small>`).join("")}
      ${p.rhythm.grid.map((row, d) => `<small>${"SMTWTFS"[d]}</small>${row.map(n => `<i style="--a:${n ? (0.25 + 0.75 * n / most).toFixed(2) : 0}"></i>`).join("")}`).join("")}</div>
      <p>Mostly ${esc(p.rhythm.top)}</p></section>` : "";
  const ch0 = p.changes.slice(0, 3), chTop = ch0[0]?.n || 1;
  const statChanges = ch0.length ? `<section class="pf-stat"><div class="pf-stat-h"><b>${esc(ch0[0].a)} → ${esc(ch0[0].b)}</b><span>your most played change</span></div>
      ${ch0.map(c => `<div class="pf-chg"><span>${esc(c.a)} ↔ ${esc(c.b)}</span><i style="--w:${Math.max(6, Math.round(c.n / chTop * 100))}%"></i><button class="pf-drill" data-drill="${esc(c.a)}-${esc(c.b)}" aria-label="Drill ${esc(c.a)} to ${esc(c.b)} in Rehearse">Drill it</button></div>`).join("")}</section>` : "";
  const t = p.tempo, trend = t.earlier && t.recent ? Math.round(t.recent - t.earlier) : 0, keyTotal = p.keys.reduce((a, k) => a + k.n, 0) || 1;
  const statKeys = p.keys.length ? `<section class="pf-stat"><div class="pf-stat-h"><b>${esc(p.keys[0].key)}</b><span>your key, ${Math.round(p.keys[0].n / keyTotal * 100)}% of plays</span></div>
      <div class="pf-keys">${p.keys.slice(0, 4).map(k => `<span><b>${esc(k.key)}</b>${Math.round(k.n / keyTotal * 100)}%</span>`).join("")}</div>
      ${t.avg ? `<p>Average tempo ${Math.round(t.avg)} BPM${trend >= 3 ? `, up ${trend} lately` : trend <= -3 ? `, down ${-trend} lately` : ""}</p>` : ""}</section>` : "";
  const stats = `<div class="pf-stats">${statTime}${statWhen}${statChanges}${statKeys}</div>`;

  const plays = lifetimePlays(data);
  const ven = venueOf(plays);
  /* 4.17.0: the player card. Louie in your finish, your venue (tap for the Tour Map), your chart, your level */
  const lv = levelOf(data), ch = chartState(data), can = playableSongs(data), band = bandState(data), badges = badgesOf(data, p);
  const goal = STREAK_GOALS.find(g => g > p.streak) || p.streak, num = x => x.toLocaleString("en-US");
  const playerCard = `<section class="pf-player" aria-label="Your card">
      <div class="pf-pc-top"><div class="pf-pc-lou">${louie("proud", { pose: "hornsUp", size: 104 })}</div>
        <div class="pf-pc-who"><small>${esc(since ? since.replace(/^Since/, "On the road since").toUpperCase() : "ON THE ROAD")}</small>
          <button class="pf-pc-venue" id="pf-map" aria-label="${esc(ven.name)}, venue ${ven.ring + 1}. Open the Tour Map"><b>${esc(ven.name)}</b><span>Venue ${ven.ring + 1} · Tour Map ${icon("chev", "chev")}</span></button>
          <span class="pf-pc-chart">${esc(ch.name.toUpperCase())} CHART · ${ch.you.rank}${["ST", "ND", "RD"][ch.you.rank - 1] || "TH"}</span></div></div>
      <div class="pf-pc-level"><div><b>LEVEL ${lv.level}</b><span>${num(lv.into)} / ${num(lv.need)} XP</span></div><i style="--w:${Math.round(lv.into / lv.need * 100)}%"></i></div>
    </section>
    <div class="pf-tiles">
      <div class="pf-tile pf-tile-streak">${knobIcon(p.streak, goal, 46)}<div><span class="pf-tn">${guitarIcon(p.streak > 0)}<b>${p.streak}</b></span><small>${p.streak >= goal ? "NIGHTS IN A ROW" : `NIGHTS · NEXT ${goal}`}</small></div></div>
      <div class="pf-tile"><b class="pf-fans">$${num(fansToSpend(data))}</b><small>TIPS TO SPEND</small></div>
      <div class="pf-tile"><b>${num(data.gig?.shows || 0)}</b><small>SHOWS PLAYED</small></div>
      <div class="pf-tile"><b>${can.now} <span>of ${can.of}</span></b><small>SONGS YOU CAN PLAY</small></div>
    </div>`;
  const badge = x => `<div class="pf-badge k-${x.kind}${x.got ? "" : " locked"}" role="img" aria-label="${esc(x.top)} ${esc(x.lab.toLowerCase())}${x.got ? "" : ", not yet"}"><b>${esc(x.got ? x.top : "?")}</b><small>${esc(x.lab)}</small></div>`;
  const order = [...badges.got, ...badges.all.filter(x => !x.got)];
  const badgeCard = `<div class="pf-label"><span>BADGES</span><span>${badges.got.length} of ${badges.all.length}</span></div>
    <div class="pf-badges">${order.slice(0, 8).map(badge).join("")}</div>
    ${order.length > 8 ? `<details class="pf-allbadges"><summary>All ${badges.all.length} badges</summary><div class="pf-badges">${order.slice(8).map(badge).join("")}</div></details>` : ""}`;
  const bandCard = `<div class="pf-label"><span>YOUR BAND</span><span>${band.joined.length} of ${band.members.length}</span></div>
    <button class="pf-band" id="pf-band" aria-label="Your band: ${band.joined.length} of ${band.members.length} joined. Open the Band tab">${band.joined.slice(-4).map(f => friend(f.id, { size: 52 })).join("")}${band.joined.length < band.members.length ? `<span class="pf-band-more">+${band.members.length - band.joined.length}</span>` : ""}</button>`;
  const fr = friendsOf(data).filter(f => f.w + f.l > 0).slice(0, 3);
  const duelCard = fr.length ? `<div class="pf-label"><span>SONG DUELS</span></div>${fr.map(f => `<div class="pf-duel"><div><b>You and ${esc(f.name)}</b>${f.last ? `<small>Last: ${esc(f.last.title)}</small>` : ""}</div><span><b class="${f.w >= f.l ? "up" : ""}">${f.w}</b> – <b class="${f.l > f.w ? "up" : ""}">${f.l}</b></span></div>`).join("")}` : "";
  app.innerHTML = `
    <div class="head"><button class="ib glass" id="back" aria-label="Back to the Road">${icon("back")}</button></div>
    <h1 class="title" style="margin:14px 2px 2px">Your profile</h1>
    ${playerCard}${badgeCard}${bandCard}${nothing ? `<p class="pf-empty">Play a song through to the end and this page starts filling in: hours played, the chords you've stamped, the changes you make most, and when you play.</p>` : `${passport}${duelCard}<details class="pf-more"><summary><b>Your stats</b><small>Hours, when you play, your changes, keys and tempo</small></summary>${stats}</details>
    <p class="foot">Worked out on this phone from your plays. Plays from before ${esc(shortDay(p.seeded))} are counted from each song's play total, so hours and changes before then are estimates.</p>`}
    ${nothing ? "" : `<div class="s-dock pf-dock"><button class="btn primary" id="pf-share">${icon("share")}Share your card</button></div>`}`;
  document.getElementById("back").onclick = () => go("#/");
  document.getElementById("pf-map")?.addEventListener("click", () => go("#/playmap"));
  document.getElementById("pf-band")?.addEventListener("click", () => go("#/band"));
  document.getElementById("pf-learn")?.addEventListener("click", e => go("#/practice/" + encodeURIComponent("c:" + e.currentTarget.dataset.chord)));
  app.querySelectorAll("[data-drill]").forEach(b => b.onclick = () => go("#/practice/" + encodeURIComponent("s:" + b.dataset.drill)));
  app.querySelectorAll("[data-stamp]").forEach(b => b.onclick = () => stampSheet(have.get(b.dataset.stamp)));
  app.querySelectorAll("[data-song]").forEach(b => b.onclick = () => go("#/song/" + encodeURIComponent(b.dataset.song)));
  document.getElementById("pf-share")?.addEventListener("click", () => shareCard(p));
}

/* 4.19.0: a stamp opened: the chord's diagram, how often you've played it and since when */
function stampSheet(c) {
  if (!c) return;
  layer.innerHTML = `<div class="scrim" id="st-scrim"></div><div class="panel card pf-stampsheet" role="dialog" aria-label="${esc(c.name)} chord">
    <div class="pf-ss-dg">${chordSVG(c.name, 1.6)}</div><h2>${esc(c.name)}</h2>
    <p class="pf-line">Played about ${c.n.toLocaleString("en-US")} time${c.n === 1 ? "" : "s"}, first on ${esc(shortDay(c.first))}.</p>
    <div class="actions"><button class="btn primary" id="st-x">Done</button></div></div>`;
  const close = () => { layer.innerHTML = ""; };
  document.getElementById("st-scrim").onclick = close; document.getElementById("st-x").onclick = close;
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
// under a stage light that flickers on (4.16.0; the horns pop up too on a milestone
// night, and the phone taps along), confetti falls, the count
// rolls up and the week's circles fill one by one. SVG and CSS only. With
// Reduce Motion it opens on the final picture. Tap anywhere (or Keep playing)
// to close.
/* confetti: fixed spots so every run looks the same; colours come from the palette */
const SK_BITS = Array.from({ length: 22 }, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--d:${((i * 7) % 10) / 10 + 0.5}s;--r:${(i * 53) % 360}deg;--s:${(i % 3) + 1}"></i>`).join("");

export function showStreak(m, { share } = {}) {
  document.querySelector(".sk")?.remove();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "sk" + (still ? " still" : "");
  el.dataset.tier = m.tier;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-label", `${m.n} day streak`);
  el.innerHTML = `<div class="sk-art" aria-hidden="true"><div class="sk-rays"></div><div class="sk-bits">${SK_BITS}</div>${stageLight(230)}${m.hit ? hornsIcon(92) : ""}<div class="sk-lou">${louie("cheer", { pose: "hornsUp", size: 170 })}</div><span class="sk-ping"></span></div>
    <div class="sk-num" aria-live="polite">${still ? m.n : 0}</div><div class="sk-unit">day streak</div>
    <div class="sk-week">${m.slots.map(s => `<small class="${s.today ? "now" : ""}">${s.label}</small>`).join("")}${m.slots.map((s, i) => `<i class="${s.on ? "on" : ""}${s.goal ? " goal" : ""}${s.today ? " today" : ""}" style="--i:${i}">${s.goal && !s.on ? s.goal : ""}</i>`).join("")}</div>
    <p class="sk-say"><b>${esc(m.lead)}</b> ${esc(m.next)}</p>${m.best > m.n ? `<div class="sk-best">Your best: ${m.best} days</div>` : ""}
    <div class="sk-foot"><button class="sb2" id="sk-share" aria-label="Share your streak">${icon("share")}</button><button class="btn" id="sk-ok">Keep playing</button></div>`;
  document.body.appendChild(el);
  /* 4.16.0: the light comes on (a drum fill on a milestone night) with taps to match */
  if (!still) setTimeout(() => buzz(m.hit ? "horns" : "light"), 450);
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
  /* the stage light, then Louie (4.16.0) */
  g.save(); g.translate(W / 2 - 320, 40); g.scale(20, 20);
  g.fillStyle = "rgba(255,216,77,.55)"; g.beginPath(); g.moveTo(14, 14); g.lineTo(2, 32); g.lineTo(30, 32); g.lineTo(20, 14); g.closePath(); g.fill();
  const rr = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  rr(11.5, 3.5, 10, 12, 3, "#5A4FB0"); rr(11, 3, 10, 11, 3, "#8A7CFF"); rr(12.5, 12, 7, 3.5, 1.5, "#FFD84D"); rr(15, 0, 2, 4, 1, "#8A7CFF");
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
