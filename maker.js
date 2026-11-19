// Making your guitarist (4.85.0; Gig poster maker, 2026-11-19). One sheet, three ways in:
//   "start"  Opening night's first step, "Who's playing tonight?": Face and Hair only, THAT'S ME (Skip keeps the default)
//   "once"   a player already past Opening night meets it once, on the Road (Louie asks); Skip keeps the default
//   "full"   Your profile > Edit: all four tabs (Face, Hair, Fit, Guitar); every change saves as you tap it
// The look, the patches and the guitar aren't picked here: the Road decides them (stageLook, patchesAll, guitarFor).
// The preview is your guitarist on the cream "TONIGHT" poster; each option is a small poster bust of you with it.
import { ME_BEARD, ME_DEFAULT, ME_HAIR, ME_HAIR_COL, ME_HATS, ME_PATCHES, ME_STARTERS, ME_TOP_COL, MERCH, OPENING, Tabs, cleanMe, guitarShown, merchState, meOf, openingStep, patchesAll, patchesOf, roadPath, stageLook } from "./core.js";
import { esc, haptic, layer } from "./ui.js";
import { data } from "./app.js";
import { HAIR_COL, OUTFIT_COL, SKIN, guitarist } from "./guitarist.js";
import { guitarPic } from "./fretboard.js";
import { selfieStart } from "./selfie.js";

const NAME = { shag: "Shag", curly: "Curly", buzz: "Buzz", mohawk: "Mohawk", braids: "Braids", bob: "Bob", bun: "Bun", swoop: "Swoop", long: "Long", locs: "Locs", pixie: "Pixie", ponytail: "Ponytail", longhawk: "Long mohawk" };
const BEARD = { none: "Clean", stubble: "Stubble", moustache: "Moustache", beard: "Beard" };
const SKIN_NAME = ["Lightest", "Light", "Medium light", "Medium", "Medium dark", "Darkest"];
const hide = svg => svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
const same = (a, b) => ["skin", "hair", "hairCol", "beard", "glasses", "top"].every(k => (a[k] ?? ME_DEFAULT[k]) === (b[k] ?? ME_DEFAULT[k]));
const DICE = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>`;
const FLIP = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2.4"/><path d="M9 6L3 18h6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15 6l6 12h-6Z" fill="currentColor"/></svg>`;
const pickOf = list => list[Math.floor(Math.random() * list.length)];

export function makerSheet({ mode = "full", done } = {}) {
  let me = { ...meOf(data) }, selfieMsg = "", busy = false, tab = "face";
  const full = mode === "full", look = stageLook(data), guitar = guitarShown(data, roadPath(data).leg?.id);
  const tabs = full ? ["face", "hair", "fit", "guitar"] : ["face", "hair"];
  const owned = new Set(merchState(data).has);
  const keep = () => { if (full) { data.me = cleanMe(me); Tabs.save(data); } };
  const set = (k, v) => { me = { ...me, [k]: v }; keep(); paint(); haptic(1); };
  const prev = () => guitarist(me, { look, guitar, patches: patchesOf({ ...data, me: full ? me : data.me }), size: 190, mood: "happy", card: true });
  const bust = o => hide(guitarist({ ...me, extra: "none", ...o }, { crop: "bust", size: 56, look, flat: true }));
  const chip = (key, v, label, on, inner, cls = "") => `<button class="gm-c${cls}${on ? " on" : ""}" data-k="${key}" data-v="${esc(String(v))}" aria-pressed="${on}" aria-label="${esc(label)}">${inner}</button>`;
  const blots = (key, list, col, name) => `<div class="gm-row gm-blots" role="group" aria-label="${esc(name)}">${list.map((v, i) => { const c = key === "skin" ? SKIN[i] : col[v]; const val = key === "skin" ? i : v; return chip(key, val, `${name}: ${key === "skin" ? SKIN_NAME[i] : v}`, me[key] === val, `<i class="gm-blot" style="--ink:${c}"></i>`); }).join("")}</div>`;
  const step = Math.min(openingStep(data) + 1, OPENING.length);
  function panel() {
    if (tab === "face") return `<h3>Skin</h3>${blots("skin", SKIN, null, "Skin")}
      <h3>Face</h3><div class="gm-row gm-thumbs">${ME_BEARD.map(b => chip("beard", b, BEARD[b], me.beard === b, bust({ beard: b }) + `<span>${BEARD[b]}</span>`)).join("")}${chip("glasses", !me.glasses, "Glasses", me.glasses, bust({ glasses: true }) + "<span>Glasses</span>")}</div>`;
    if (tab === "hair") return `<h3>Hair</h3><div class="gm-row gm-thumbs gm-hair">${ME_HAIR.map(h => chip("hair", h, NAME[h], me.hair === h, bust({ hair: h }) + `<span>${NAME[h]}</span>`)).join("")}</div>
      <h3>Hair colour</h3>${blots("hairCol", ME_HAIR_COL, HAIR_COL, "Hair colour")}`;
    if (tab === "fit") {
      const hats = ["none", ...ME_HATS], earned = patchesAll(data), worn = new Set(patchesOf({ ...data, me }).map(x => x.id));
      return `<h3>Top colour</h3>${blots("top", ME_TOP_COL, OUTFIT_COL, "Top colour")}
        <h3>Hat</h3><div class="gm-row gm-thumbs">${hats.map(h => { const it = MERCH.find(x => x.id === "wear-" + h), has = h === "none" || owned.has("wear-" + h); const nm = h === "none" ? "No hat" : it.name; const pic = hide(guitarist({ ...me, extra: h }, { crop: "bust", size: 56, look, flat: true })); return has ? chip("extra", h, nm, me.extra === h, `${pic}<span>${nm}</span>`) : `<button class="gm-c lock" disabled aria-label="${nm}, $${it.price} at the Merch table">${pic}<span>${nm}</span><small>$${it.price}</small></button>`; }).join("")}</div>
        ${me.extra !== "none" ? `<h3>Hat colour</h3>${blots("extraCol", ME_TOP_COL, OUTFIT_COL, "Hat colour")}` : ""}
        <h3>Patches</h3>${earned.length ? `<p class="gm-note">Up to ${ME_PATCHES} on your top. Earned on the Road; none picked shows the newest.</p><div class="gm-row">${earned.map(x => chip("patch", x.id, x.lab + (x.top && x.kind !== "leg" ? " " + x.top : ""), worn.has(x.id) && !!me.patches?.length, `<span style="--pc:${x.color}"><i></i>${esc(x.lab)}</span>`)).join("")}</div>` : `<p class="gm-note">None yet. Headline a leg or earn a badge and it's sewn on.</p>`}
        <p class="gm-note">Your look comes from the venue you've reached.</p>`;
    }
    const pic = guitarPic(guitar?.body);
    return `<div class="gm-guitar">${pic ? `<img src="${pic}" alt="" width="64" height="141">` : ""}<p><b>${esc(guitar?.name || "Your guitar")}</b><br>Your guitar comes from the leg you're on. Headline this leg to earn the next one.</p></div>`;
  }
  function paint() {
    const el = layer.querySelector(".gm .pbody"), top = el ? el.scrollTop : 0;
    const title = full ? "Your guitarist" : "Who's playing tonight?";
    layer.innerHTML = `<div class="scrim" id="gm-scrim"></div><div class="panel de-sheet gm" role="dialog" aria-label="${title}"><div class="grab"></div>
      <div class="pbody">
        ${mode === "start" ? `<div class="gm-top"><span class="gm-over">OPENING NIGHT · ${step} OF ${OPENING.length}</span><button class="mt-not" id="gm-skip">Skip</button></div>` : mode === "once" ? `<div class="gm-top"><span class="gm-over">TONIGHT</span><button class="mt-not" id="gm-skip">Skip</button></div>` : ""}
        <h2>${title}</h2>
        <div class="gm-stage">
          <div class="gm-prev" aria-live="polite">${prev()}</div>
          <button class="ib gm-rand" id="gm-rand" aria-label="Random guitarist">${DICE}</button>
          ${chip("lefty", !me.lefty, "Left-handed", me.lefty, FLIP, " ib gm-flip")}
          <div class="gm-lou"><img src="art/louie/v3/louie-face-badge.webp" alt="" width="40" height="40"><p>${mode === "once" ? "I drew you a guitarist for your card and the chart." : "Make it look like you."}</p></div>
        </div>
        <div class="gm-row gm-starts" role="group" aria-label="Start from">${ME_STARTERS.slice(0, 6).map((s, i) => chip("starter", i, `Starter ${i + 1}`, same(me, s), bust(s))).join("")}</div>
        <div class="gm-selfie"><button class="btn gm-selfie-b" id="gm-selfie"${busy ? ' disabled aria-busy="true"' : ""}>${busy ? "Reading your photo..." : "Start from a selfie"}</button>
          <p class="gm-note">Your photo stays on this phone and is never saved.</p>${selfieMsg ? `<p class="gm-note gm-selfie-msg" role="status">${esc(selfieMsg)}</p>` : ""}</div>
        <div class="gm-tabs" role="tablist" aria-label="Parts">${tabs.map(t => `<button role="tab" class="gm-tab${t === tab ? " on" : ""}" data-tab="${t}" aria-selected="${t === tab}" id="gm-t-${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
        <div class="gm-panel" role="tabpanel" aria-labelledby="gm-t-${tab}">${panel()}</div>
      </div>
      <div class="pfoot"><button class="btn primary gm-ok" id="gm-ok">${full ? "Done" : "THAT'S ME"}</button><p class="gm-note gm-later">${full ? "Changes save as you tap." : "Change anything later on Your profile."}</p></div></div>`;
    const nb = layer.querySelector(".gm .pbody"); if (nb) nb.scrollTop = top;
    layer.querySelectorAll(".gm [data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === "starter") { me = { ...ME_STARTERS[+v], extra: me.extra, extraCol: me.extraCol, lefty: me.lefty, patches: me.patches }; keep(); paint(); haptic(1); }
      else if (k === "skin") set("skin", +v);
      else if (k === "glasses") set("glasses", v === "true");
      else if (k === "lefty") set("lefty", v === "true");
      else if (k === "patch") { const cur = patchesOf({ ...data, me }).map(x => x.id), on = (me.patches?.length ? me.patches : []).includes(v); const base = me.patches?.length ? me.patches : cur; set("patches", on ? base.filter(x => x !== v) : [...base.filter(x => x !== v), v].slice(-ME_PATCHES)); }
      else set(k, v);
    }));
    layer.querySelectorAll(".gm [data-tab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; paint(); layer.querySelector(`#gm-t-${tab}`)?.focus(); }));
    document.getElementById("gm-rand").onclick = () => {
      me = { ...me, skin: Math.floor(Math.random() * SKIN.length), hair: pickOf(ME_HAIR), hairCol: pickOf(ME_HAIR_COL), top: pickOf(ME_TOP_COL), beard: Math.random() < .7 ? "none" : pickOf(ME_BEARD.slice(1)), glasses: Math.random() < .2 };
      keep(); paint(); haptic(1);
    };
    document.getElementById("gm-selfie")?.addEventListener("click", async () => {
      selfieMsg = "";
      const g = await selfieStart({ onBusy: b => { busy = b; paint(); } });
      if (g?.cancelled) return;
      if (!g) { selfieMsg = "Couldn't read that one. Pick a starter instead."; paint(); return; }
      /* the guesses only set the preview: nothing is saved until THAT'S ME (or Done) */
      me = { ...me, ...g }; selfieMsg = "Here's a start from your photo. Fix anything below."; tab = "face"; paint(); haptic(1);
      layer.querySelector(".gm-tabs")?.scrollIntoView({ block: "start" });
    });
    const close = () => { layer.innerHTML = ""; done?.(); };
    document.getElementById("gm-scrim").onclick = full ? close : () => { layer.innerHTML = ""; };
    document.getElementById("gm-ok").onclick = () => { data.me = cleanMe(me); Tabs.save(data); close(); };
    document.getElementById("gm-skip")?.addEventListener("click", () => { data.me = cleanMe(ME_DEFAULT); Tabs.save(data); close(); });
  }
  paint();
}
