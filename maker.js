// Making your guitarist (4.85.0). One sheet, three ways in:
//   "start"  Opening night's first step, "Who's playing tonight?": a starter, a skin tone, a hair colour, THAT'S ME
//   "once"   a player already past Opening night meets it once, on the Road (Louie asks); Skip keeps the default
//   "full"   Your profile > Edit: everything (hair, beard, glasses, hats you own, the top's colour, patches, lefty);
//            every change saves as you tap it
// The look, the patches and the guitar aren't picked here: the Road decides them (stageLook, patchesAll, guitarFor).
import { ME_BEARD, ME_DEFAULT, ME_HAIR, ME_HAIR_COL, ME_HATS, ME_PATCHES, ME_STARTERS, ME_TOP_COL, MERCH, Tabs, cleanMe, guitarFor, merchState, meOf, patchesAll, patchesOf, roadPath, stageLook } from "./core.js";
import { esc, haptic, layer } from "./ui.js";
import { data } from "./app.js";
import { HAIR_COL, OUTFIT_COL, SKIN, guitarist } from "./guitarist.js";
import { louie } from "./louie.js";

const NAME = { shag: "Shag", curly: "Curly", buzz: "Buzz", mohawk: "Mohawk", braids: "Braids", bob: "Bob", bun: "Bun", swoop: "Swoop", long: "Long", locs: "Locs", pixie: "Pixie", ponytail: "Ponytail", longhawk: "Long mohawk" };
const BEARD = { none: "Clean", stubble: "Stubble", moustache: "Moustache", beard: "Beard" };
const hide = svg => svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
const same = (a, b) => ["skin", "hair", "hairCol", "beard", "glasses", "top"].every(k => (a[k] ?? ME_DEFAULT[k]) === (b[k] ?? ME_DEFAULT[k]));

export function makerSheet({ mode = "full", done } = {}) {
  let me = { ...meOf(data) };
  const full = mode === "full", look = stageLook(data), guitar = guitarFor(roadPath(data).leg?.id);
  const owned = new Set(merchState(data).has);
  const keep = () => { if (full) { data.me = cleanMe(me); Tabs.save(data); } };
  const set = (k, v) => { me = { ...me, [k]: v }; keep(); paint(); haptic(1); };
  const prev = () => guitarist(me, { look, guitar, patches: patchesOf({ ...data, me: full ? me : data.me }), size: 150, mood: "happy" });
  const bust = o => hide(guitarist({ ...me, extra: "none", ...o }, { crop: "bust", size: 52, look }));
  const chip = (key, v, label, on, inner, extra = "") => `<button class="gm-c${on ? " on" : ""}" data-k="${key}" data-v="${esc(String(v))}" aria-pressed="${on}" aria-label="${esc(label)}"${extra}>${inner}</button>`;
  const swatches = (key, list, col, name) => `<div class="gm-row">${list.map((v, i) => { const c = key === "skin" ? SKIN[i] : col[v]; const val = key === "skin" ? i : v; return chip(key, val, `${name} ${key === "skin" ? i + 1 : v}`, me[key] === val, `<i style="background:${c}"></i>`, ""); }).join("")}</div>`;
  function paint() {
    const el = layer.querySelector(".gm .pbody"), top = el ? el.scrollTop : 0;
    const hats = ["none", ...ME_HATS], earned = patchesAll(data), worn = new Set(patchesOf({ ...data, me }).map(x => x.id));
    layer.innerHTML = `<div class="scrim" id="gm-scrim"></div><div class="panel de-sheet gm" role="dialog" aria-label="${mode === "full" ? "Your guitarist" : "Who's playing tonight?"}"><div class="grab"></div>
      <div class="pbody">
        ${mode === "once" ? `<div class="gm-ask">${louie("happy", { pose: "wave", size: 64 })}<p>I drew you a guitarist to stand in for you on your card and the chart.</p></div>` : ""}
        <h2>${mode === "full" ? "Your guitarist" : "Who's playing tonight?"}</h2>
        <div class="gm-prev" aria-live="polite">${prev()}</div>
        <h3>Start from</h3><div class="gm-row gm-starts">${ME_STARTERS.map((s, i) => chip("starter", i, `Starter ${i + 1}`, same(me, s), bust(s))).join("")}</div>
        <h3>Skin</h3>${swatches("skin", SKIN, null, "Skin")}
        <h3>Hair colour</h3>${swatches("hairCol", ME_HAIR_COL, HAIR_COL, "Hair colour")}
        ${full ? `<h3>Hair</h3><div class="gm-row gm-hair">${ME_HAIR.map(h => chip("hair", h, NAME[h], me.hair === h, bust({ hair: h }) + `<span>${NAME[h]}</span>`)).join("")}</div>
        <h3>Face</h3><div class="gm-row">${ME_BEARD.map(b => chip("beard", b, BEARD[b], me.beard === b, `<span>${BEARD[b]}</span>`)).join("")}${chip("glasses", !me.glasses, "Glasses", me.glasses, "<span>Glasses</span>")}</div>
        <h3>Hat</h3><div class="gm-row">${hats.map(h => { const it = MERCH.find(x => x.id === "wear-" + h), has = h === "none" || owned.has("wear-" + h); const nm = h === "none" ? "No hat" : it.name; return has ? chip("extra", h, nm, me.extra === h, `<span>${nm}</span>`) : `<button class="gm-c lock" disabled aria-label="${nm}, $${it.price} at the Merch table"><span>${nm}</span><small>$${it.price}</small></button>`; }).join("")}</div>
        ${me.extra !== "none" ? `<h3>Hat colour</h3>${swatches("extraCol", ME_TOP_COL, OUTFIT_COL, "Hat colour")}` : ""}
        <h3>Top</h3>${swatches("top", ME_TOP_COL, OUTFIT_COL, "Top colour")}
        <h3>Patches</h3>${earned.length ? `<p class="gm-note">Up to ${ME_PATCHES} on your top. Earned on the Road; none picked shows the newest.</p><div class="gm-row">${earned.map(x => chip("patch", x.id, x.lab + (x.top && x.kind !== "leg" ? " " + x.top : ""), worn.has(x.id) && !!me.patches?.length, `<span style="--pc:${x.color}"><i></i>${esc(x.lab)}</span>`)).join("")}</div>` : `<p class="gm-note">None yet. Headline a leg or earn a badge and it's sewn on.</p>`}
        <h3>Hands</h3><div class="gm-row">${chip("lefty", false, "Right-handed", !me.lefty, "<span>Right-handed</span>")}${chip("lefty", true, "Left-handed", me.lefty, "<span>Left-handed</span>")}</div>
        <p class="gm-note">Your look comes from the venue you've reached, and your guitar from the leg you're on.</p>` : `<p class="gm-note">Hair, glasses and the rest are on Your profile, any time.</p>`}
      </div>
      <div class="pfoot"><button class="btn primary" id="gm-ok">${mode === "full" ? "Done" : "THAT'S ME"}</button>${mode === "once" ? `<button class="mt-not" id="gm-skip">Skip</button>` : ""}</div></div>`;
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
    const close = () => { layer.innerHTML = ""; done?.(); };
    document.getElementById("gm-scrim").onclick = full ? close : () => { layer.innerHTML = ""; };
    document.getElementById("gm-ok").onclick = () => { data.me = cleanMe(me); Tabs.save(data); close(); };
    document.getElementById("gm-skip")?.addEventListener("click", () => { data.me = cleanMe(ME_DEFAULT); Tabs.save(data); close(); });
  }
  paint();
}
