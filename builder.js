// The guitar builder (Road Ready 9b): restyle the Road guitars you've earned. Opened from "Build your guitar" on the Merch table.
// The numbers (parts, prices, what a guitar takes, saving) are BUILD_PARTS and friends in core/game.js; the picture is put
// together once per build in buildart.js. Names and colours come from art/guitars/builder/manifest.json (Grok's art).
//   openBuilder(legId)   the sheet over the Merch table
import { BUILD_STOCK, BUILD_TAKES, GUITARS, Tabs, VERSION, buildCost, buildOf, buildSave, buildState, guitarsEarned } from "./core.js";
import { buildPic, manifest } from "./buildart.js";
import { esc, haptic, icon, layer, toast } from "./ui.js";
import { data } from "./app.js";

const n = x => x.toLocaleString("en-US");
const CATS = [["paint", "Body"], ["top", "Flame top"], ["guard", "Guard"], ["wear", "Wear"], ["metal", "Hardware"]];
const WEAR = [["new", "New"], ["played", "Played"], ["worn", "Road worn"]];
const METAL = [["chrome", "Chrome"], ["nickel", "Aged nickel"], ["gold", "Gold"]];
const TEX = "art/guitars/builder/tex/";
const ELECTRIC_ONLY = "Flame tops are for electric bodies";

/* what a swatch looks like, from the manifest */
function fill(man, cat, id) {
  if (cat === "paint") {
    const p = man.paints[id];
    if (!p) return "background:linear-gradient(135deg,#d9d2c3,#8f8878)";
    if (p.kind === "burst") return `background:radial-gradient(circle at 50% 45%,${p.centre},${p.mid || p.edge} 60%,${p.edge})`;
    if (p.kind === "metallic") return `background:radial-gradient(circle at 35% 30%,${p.colour},${p.edge || p.colour})`;
    if (p.kind === "flake") return `background:${p.colour} url(${TEX}flake.webp?v=${VERSION}) center/cover`;
    return `background:${p.colour}`;
  }
  if (cat === "top") {
    const t = man.tops[id];
    if (!t) return "background:#555";
    return t.texture === "koa.webp" ? `background:#7a4a22 url(${TEX}koa.webp?v=${VERSION}) center/cover` : `background:linear-gradient(135deg,${t.centre || t.mid},${t.mid || t.edge} 50%,${t.edge})`;
  }
  if (cat === "guard") {
    const g = man.guards[id];
    if (!g) return "background:linear-gradient(135deg,#f3efe6,#cfc8b8)";
    return g.texture ? `background:#999 url(${TEX}${g.texture}?v=${VERSION}) center/cover` : `background:${g.colour}`;
  }
  return "";
}

export async function openBuilder(startLeg) {
  const earned = guitarsEarned(data).filter(id => BUILD_TAKES[id]);
  if (!earned.length) return;
  let man;
  try { man = await manifest(); } catch { toast("The builder isn't ready. Try again in a moment."); return; }
  let leg = earned.includes(startLeg) ? startLeg : earned[0], cat = "paint", draft = buildOf(data, leg);
  const nameOf = (c, id) => id === BUILD_STOCK[c] ? (c === "top" ? "No top" : "Original") : (c === "paint" ? man.paints : c === "top" ? man.tops : c === "guard" ? man.guards : c === "wear" ? man.wear : man.metal)[id]?.name || id;
  const painted = () => `art/guitars/${BUILD_TAKES[leg].slug}-road.webp?v=${VERSION}`;

  /* one swatch: it knows if it is yours, open at your venue, or locked, and says so in words */
  function swatch(st, c, id) {
    const row = st.rows.find(r => r.cat === c && r.id === id), cur = (draft[c] || BUILD_STOCK[c]) === id, take = BUILD_TAKES[leg];
    let lock = "", say, price = "";
    if (c === "top" && id !== BUILD_STOCK.top && !take.tops.includes(id)) { lock = ELECTRIC_ONLY; say = `${nameOf(c, id)} top, locked. ${ELECTRIC_ONLY}`; }
    else if (row && !row.owned && !row.open) { lock = `Opens at ${row.venue}`; say = `Locked, opens at ${row.venue}`; }
    else if (row && !row.owned) { price = `$${n(row.price)}`; say = `${nameOf(c, id)}${c === "guard" ? " guard" : c === "top" ? " top" : ""}, $${n(row.price)} tips`; }
    else say = `${nameOf(c, id)}${c === "guard" ? " guard" : c === "top" ? " top" : ""}${row ? ", yours" : ""}`;
    return `<button type="button" class="bd-sw${cur ? " on" : ""}${lock ? " locked" : ""}" data-c="${c}" data-id="${id}" aria-pressed="${cur}" aria-label="${esc(say)}${cur ? ", chosen" : ""}" ${lock ? `aria-disabled="true"` : ""}>
      <i class="bd-chip" style="${fill(man, c, id)}"></i>${lock ? `<span class="bd-lk" aria-hidden="true">${icon("lock")}</span>` : ""}<small>${esc(nameOf(c, id))}${price ? ` <b>${price}</b>` : ""}</small></button>`;
  }
  const ids = (st, c) => {
    const shown = st.rows.filter(r => r.cat === c && r.show).map(r => r.id);
    if (c === "top") return [BUILD_STOCK.top, ...["teal", "violet", "purple", "koa"].filter(i => shown.includes(i))];
    if (c === "paint" || c === "guard") return [BUILD_STOCK[c], ...shown];
    return shown;
  };

  function draw() {
    const st = buildState(data), take = BUILD_TAKES[leg], cost = buildCost(data, leg, draft);
    const saved = JSON.stringify(buildOf(data, leg)) === JSON.stringify(draft), short = cost > st.tips;
    const cats = CATS.filter(([c]) => c !== "guard" || take.guard);
    if (!cats.some(([c]) => c === cat)) cat = "paint";
    const gtr = GUITARS[leg], bp = buildPic(leg, draft, painted());
    /* while the new picture is being put together (a moment), the one before stays instead of flashing the painting */
    const before = document.getElementById("bd-pic")?.src;
    if (before && bp.attr && bp.src === painted()) bp.src = before;
    let body = "";
    if (cat === "wear") body = `<div class="bd-seg" role="group" aria-label="Wear">${WEAR.map(([id, nm]) => { const row = st.rows.find(r => r.cat === "wear" && r.id === id), lock = row && !row.owned && !row.open, on = (draft.wear || "new") === id;
      return `<button type="button" class="bd-sw wide${on ? " on" : ""}${lock ? " locked" : ""}" data-c="wear" data-id="${id}" aria-pressed="${on}" aria-label="${esc(lock ? `Locked, opens at ${row.venue}` : `${nm}${row && !row.owned ? `, $${n(row.price)} tips` : ""}`)}${on ? ", chosen" : ""}" ${lock ? `aria-disabled="true"` : ""}>${lock ? `<span class="bd-lk" aria-hidden="true">${icon("lock")}</span>` : ""}${nm}${row && !row.owned && !lock ? ` <b>$${n(row.price)}</b>` : ""}</button>`; }).join("")}</div>`;
    else if (cat === "metal") body = `<div class="bd-dots" role="group" aria-label="Hardware">${METAL.map(([id, nm]) => { const row = st.rows.find(r => r.cat === "metal" && r.id === id), lock = row && !row.owned && !row.open, on = (draft.metal || "chrome") === id;
      const col = id === "gold" ? "#d8a640" : id === "nickel" ? "#9a958a" : "#d9dde3";
      return `<button type="button" class="bd-sw dot${on ? " on" : ""}${lock ? " locked" : ""}" data-c="metal" data-id="${id}" aria-pressed="${on}" aria-label="${esc(lock ? `Locked, opens at ${row.venue}` : `${nm}${row && !row.owned ? `, $${n(row.price)} tips` : ""}`)}${on ? ", chosen" : ""}" ${lock ? `aria-disabled="true"` : ""}><i class="bd-chip" style="background:radial-gradient(circle at 35% 30%,#fff,${col} 55%,#4a4a4a)"></i>${lock ? `<span class="bd-lk" aria-hidden="true">${icon("lock")}</span>` : ""}<small>${nm}${row && !row.owned && !lock ? ` <b>$${n(row.price)}</b>` : ""}</small></button>`; }).join("")}</div>
      ${take.slug && gtr && man.guitars[take.slug]?.type === "acoustic" ? `<p class="bd-note">On an acoustic this changes the tuners only.</p>` : ""}`;
    else body = `<div class="bd-sws" role="group" aria-label="${CATS.find(([c]) => c === cat)[1]}">${ids(st, cat).map(id => swatch(st, cat, id)).join("")}</div>
      ${cat === "top" && !take.tops.includes("teal") ? `<p class="bd-note">${ELECTRIC_ONLY}.</p>` : ""}`;
    const foot = `<div class="bd-acts"><button class="btn primary" id="bd-save" ${saved || short ? "disabled" : ""}>${saved ? "Saved to case" : cost ? `Save to case, $${n(cost)} tips` : "Save to case"}</button>${short && !saved ? `<small class="bd-short" role="status">$${n(cost - st.tips)} more in tips to go</small>` : ""}</div>`;
    const inner = `
        <div class="bd-top"><h2>Build your guitar</h2><button class="bd-x" id="bd-x" aria-label="Close">&times;</button></div>
        <div class="bd-case" aria-hidden="false"><img id="bd-pic" src="${bp.src}"${bp.attr} alt="${esc(gtr.name)}, as you have built it"></div>
        ${earned.length > 1 ? `<div class="bd-legs" role="group" aria-label="Your guitars">${earned.map(id => `<button type="button" class="bd-leg${id === leg ? " on" : ""}" data-leg="${id}" aria-pressed="${id === leg}">${esc(GUITARS[id].name)}</button>`).join("")}</div>` : `<p class="bd-one">${esc(gtr.name)}</p>`}
        <div class="bd-chips" role="tablist" aria-label="What to change">${cats.map(([c, nm]) => `<button type="button" role="tab" class="bd-tab${c === cat ? " on" : ""}" data-cat="${c}" aria-selected="${c === cat}">${nm}</button>`).join("")}</div>
        <div class="bd-rows">${body}</div>
        <label class="bd-long"><span>Leave strings long</span><input type="checkbox" role="switch" id="bd-long" ${draft.long ? "checked" : ""}><i class="bd-knob" aria-hidden="true"></i></label>
        <p class="bd-tips">You have $${n(st.tips)} in tips. A part you buy is free on every guitar.</p>`;
    /* the sheet is drawn once; a choice only redraws what is inside it, so it doesn't slide in again and focus stays put */
    const keep = document.activeElement?.closest?.(".bd") ? ["data-c", "data-id", "data-cat", "data-leg", "id"].map(k => [k, document.activeElement.getAttribute(k)]).find(([, v]) => v) : null;
    const old = layer.querySelector(".bd .pbody"), scroll = old?.scrollTop || 0;
    if (old) { old.innerHTML = inner; layer.querySelector(".bd .pfoot").innerHTML = foot; }
    else layer.innerHTML = `<div class="scrim" id="bd-scrim"></div><div class="panel de-sheet bd" role="dialog" aria-label="Build your guitar"><div class="grab"></div><div class="pbody">${inner}</div><div class="pfoot">${foot}</div></div>`;
    const pb = layer.querySelector(".bd .pbody"); pb.scrollTop = scroll;
    if (keep) layer.querySelector(`[${keep[0]}="${keep[1]}"]`)?.focus({ preventScroll: true });
    const $ = x => document.getElementById(x);
    const close = () => { layer.innerHTML = ""; };
    $("bd-x").onclick = close; $("bd-scrim").onclick = close;
    layer.querySelectorAll("[data-cat]").forEach(b => b.onclick = () => { cat = b.dataset.cat; draw(); });
    layer.querySelectorAll("[data-leg]").forEach(b => b.onclick = () => { leg = b.dataset.leg; draft = buildOf(data, leg); draw(); });
    layer.querySelectorAll(".bd-sw").forEach(b => b.onclick = () => {
      if (b.classList.contains("locked")) return haptic();
      const c = b.dataset.c, id = b.dataset.id;
      if (id === BUILD_STOCK[c]) delete draft[c]; else draft[c] = id;
      draw();
    });
    $("bd-long").onchange = e => { if (e.target.checked) draft.long = 1; else delete draft.long; draw(); };
    $("bd-save").onclick = () => {
      const r = buildSave(data, leg, draft);
      if (!r.ok) return toast(r.why === "tips" ? "Not enough tips yet" : r.why === "locked" ? "That part isn't open yet" : "Can't save that");
      Tabs.save(data); draft = buildOf(data, leg); toast(r.cost ? `Saved. $${n(r.cost)} in tips spent.` : "Saved to your case");
      draw(); document.dispatchEvent(new CustomEvent("builds-saved"));
    };
  }
  draw();
}
