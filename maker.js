// Making your guitarist (4.85.0; Gig poster maker, 2026-11-19). One sheet, three ways in:
//   "start"  Opening night's first step, "Who's playing tonight?": Face and Hair only, THAT'S ME (Skip keeps the default)
//   "once"   a player already past Opening night meets it once, on the Road (Louie asks); Skip keeps the default
//   "full"   Your profile > Edit: all four tabs (Face, Hair, Fit, Guitar); every change saves as you tap it
// The look, the patches and the guitar aren't picked here: the Road decides them (stageLook, patchesAll, guitarFor).
// The preview is the whole painted guitarist you picked, head to mid-thigh. The face, hair and hat fields stay saved
// and the tabs below still read them. The old starter faces are not shown.
import { ME_BEARD, ME_BROWS, ME_DEFAULT, ME_EYES, ME_EYE_COL, ME_FACE, ME_GENRE, ME_HAIR, ME_HAIR_COL, ME_HATS, ME_NOSE, ME_PATCHES, ME_SPECS, ME_STARTERS, ME_TOP_COL, MERCH, OPENING, Tabs, cleanMe, guitarShown, merchState, meOf, openingStep, patchesAll, patchesOf, roadPath, stageLook } from "./core.js";
import { ask, esc, haptic, layer, toast } from "./ui.js";
import { data, go } from "./app.js";
import { EYE_COL, HAIR_COL, OUTFIT_COL, SKIN, SKIN_ORDER, genreFile, genreIdOf, guitarist } from "./guitarist.js";
import { guitarPic } from "./fretboard.js";
import { selfieStart } from "./selfie.js";
import { imgKey, makePortrait, portraitError, portraitNow, portraitSVG, removePortrait } from "./portrait.js";

const NAME = { shag: "Shag", curly: "Curly", buzz: "Buzz", mohawk: "Mohawk", braids: "Braids", bob: "Bob", bun: "Bun", swoop: "Swoop", long: "Long", locs: "Locs", pixie: "Pixie", ponytail: "Ponytail", longhawk: "Long mohawk" };
const GENRE_NAME = { rock: "Rock", punk: "Punk", metal: "Metal", blues: "Blues", country: "Country", folk: "Folk", jazz: "Jazz", classical: "Classical", indie: "Indie", funk: "Funk", reggae: "Reggae", pop: "Pop" };
const BEARD = { none: "Clean", stubble: "Stubble", moustache: "Moustache", beard: "Beard" };
const SKIN_NAME = ["Lightest", "Light", "Medium light", "Medium", "Medium dark", "Dark", "Deep", "Deepest", "Medium tan"];
const FACE = { oval: "Oval", square: "Square", round: "Round", heart: "Heart" };
const EYES = { round: "Round", wide: "Wide", narrow: "Narrow" };
const BROWS = { natural: "Natural", thick: "Thick", arched: "Arched", straight: "Thin" };
const NOSE = { wedge: "Wedge", button: "Button", bridge: "Long", broad: "Broad" };
const SPECS = { none: "None", round: "Round", square: "Square", shades: "Shades" };
/* the face parts: absent means the first of each list */
const PARTS = { face: ME_FACE, eyes: ME_EYES, eyeCol: ME_EYE_COL, brows: ME_BROWS, nose: ME_NOSE };
const partOf = (me, k) => me[k] ?? PARTS[k][0];
const hide = svg => svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"');
const DICE = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>`;
const FLIP = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2.4"/><path d="M9 6L3 18h6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15 6l6 12h-6Z" fill="currentColor"/></svg>`;
const pickOf = list => list[Math.floor(Math.random() * list.length)];

export function makerSheet({ mode = "full", done } = {}) {
  let me = { ...meOf(data) }, selfieMsg = "", busy = false, tab = "face", drawing = false, portMsg = "";
  const full = mode === "full", look = stageLook(data), guitar = guitarShown(data, roadPath(data).leg?.id);
  const tabs = full ? ["face", "hair", "fit", "guitar"] : ["face", "hair"];
  const owned = new Set(merchState(data).has);
  const keep = () => { if (full) { data.me = cleanMe(me); Tabs.save(data); } };
  const set = (k, v) => { me = { ...me, [k]: v }; keep(); paint(); haptic(1); };
  const prev = () => portraitNow()
    ? portraitSVG(portraitNow(), { size: 270, headline: "TONIGHT", label: "Your portrait" })
    : `<img class="gm-hero${me.lefty ? " lefty" : ""}" src="${genreFile(genreIdOf(me))}" alt="Your guitarist">`;
  const picked = () => `<h3>Genre</h3><div class="gm-row gm-genre" role="group" aria-label="Genre">${ME_GENRE.map(g => chip("genre", g, GENRE_NAME[g], (me.genre || "rock") === g, `<span>${GENRE_NAME[g]}</span>`)).join("")}</div>
        <h3>Man or woman</h3><div class="gm-row gm-who" role="group" aria-label="Man or woman">${[["m", "Man"], ["w", "Woman"]].map(([v, n]) => chip("who", v, n, (me.who || "m") === v, `<span>${n}</span>`)).join("")}</div>`;
  const bust = o => hide(guitarist({ ...me, extra: "none", ...o }, { crop: "bust", size: 56, look, flat: true }));
  const close = o => hide(guitarist({ ...me, extra: "none", ...o }, { crop: "face", size: 56, look }));
  const thumbs = (key, list, names) => `<div class="gm-row gm-thumbs">${list.map(v => chip(key, v, names[v], partOf(me, key) === v, close({ [key]: v }) + `<span>${names[v]}</span>`)).join("")}</div>`;
  const chip = (key, v, label, on, inner, cls = "") => `<button class="gm-c${cls}${on ? " on" : ""}" data-k="${key}" data-v="${esc(String(v))}" aria-pressed="${on}" aria-label="${esc(label)}">${inner}</button>`;
  const blots = (key, list, col, name) => `<div class="gm-row gm-blots" role="group" aria-label="${esc(name)}">${list.map(v => { const sk = key === "skin", c = sk ? SKIN[v] : col[v]; const on = sk ? me.skin === v : (PARTS[key] ? partOf(me, key) : me[key]) === v; return chip(key, v, `${name}: ${sk ? SKIN_NAME[v] : v}`, on, `<i class="gm-blot" style="--ink:${c}"></i>`); }).join("")}</div>`;
  const step = Math.min(openingStep(data) + 1, OPENING.length);
  function panel() {
    if (tab === "face") return `<h3>Skin</h3>${blots("skin", SKIN_ORDER, null, "Skin")}
      <h3>Face shape</h3>${thumbs("face", ME_FACE, FACE)}
      <h3>Eyes</h3>${thumbs("eyes", ME_EYES, EYES)}
      <h3>Eye colour</h3>${blots("eyeCol", ME_EYE_COL, EYE_COL, "Eye colour")}
      <h3>Brows</h3>${thumbs("brows", ME_BROWS, BROWS)}
      <h3>Nose</h3>${thumbs("nose", ME_NOSE, NOSE)}
      <h3>Beard</h3><div class="gm-row gm-thumbs">${ME_BEARD.map(b => chip("beard", b, BEARD[b], me.beard === b, close({ beard: b }) + `<span>${BEARD[b]}</span>`)).join("")}${chip("freckles", !me.freckles, "Freckles", !!me.freckles, close({ freckles: true }) + "<span>Freckles</span>")}</div>
      <h3>Glasses</h3><div class="gm-row gm-thumbs">${["none", ...ME_SPECS].map(g => { const on = g === "none" ? !me.glasses : me.glasses && (me.specs || "round") === g; return chip("specs", g, `Glasses: ${SPECS[g]}`, on, close(g === "none" ? { glasses: false } : { glasses: true, specs: g }) + `<span>${SPECS[g]}</span>`); }).join("")}</div>
      ${me.beard && me.beard !== "none" && me.beard !== "stubble" ? `<h3>Beard colour</h3><div class="gm-row gm-blots" role="group" aria-label="Beard colour">${ME_HAIR_COL.map(v => chip("beardCol", v, `Beard colour: ${v}`, (me.beardCol || me.hairCol) === v, `<i class="gm-blot" style="--ink:${HAIR_COL[v]}"></i>`)).join("")}</div>` : ""}`;
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
          <div class="gm-card"><div class="gm-prev" aria-live="polite">${prev()}</div>
          <button class="ib gm-rand" id="gm-rand" aria-label="Random guitarist">${DICE}</button>
          ${chip("lefty", !me.lefty, "Left-handed", me.lefty, FLIP, " ib gm-flip")}</div>
          <div class="gm-lou"><img src="art/louie/v4/louie-face-badge.webp" alt="" width="40" height="40"><p>${mode === "once" ? "I drew you a guitarist for your card and the chart." : "Pick your genre and look."}</p></div>
        </div>
        ${picked()}
        <div class="gm-selfie"><button class="btn gm-selfie-b" id="gm-selfie"${busy ? ' disabled aria-busy="true"' : ""}>${busy ? "Reading your photo..." : "Start from a selfie"}</button>
          <p class="gm-note">Your photo stays on this phone and is never saved.</p>${selfieMsg ? `<p class="gm-note gm-selfie-msg" role="status">${esc(selfieMsg)}</p>` : ""}</div>
        <div class="gm-selfie gm-port"><button class="btn gm-selfie-b" id="gm-port"${drawing ? ' disabled aria-busy="true"' : ""}>${drawing ? "Drawing your portrait..." : portraitNow() ? "Make a new portrait" : "Make my portrait"}</button>
          <p class="gm-note">Optional. A poster portrait that looks like you, drawn by xAI's Grok Imagine from one photo with your own xAI key.</p>
          ${portraitNow() ? `<button class="mt-not gm-port-off" id="gm-port-off">Use the drawn guitarist instead</button>` : ""}${portMsg ? `<p class="gm-note gm-selfie-msg" role="status">${esc(portMsg)}</p>` : ""}</div>
        <div class="gm-tabs" role="tablist" aria-label="Parts">${tabs.map(t => `<button role="tab" class="gm-tab${t === tab ? " on" : ""}" data-tab="${t}" aria-selected="${t === tab}" id="gm-t-${t}">${t[0].toUpperCase() + t.slice(1)}</button>`).join("")}</div>
        <div class="gm-panel" role="tabpanel" aria-labelledby="gm-t-${tab}">${panel()}</div>
      </div>
      <div class="pfoot"><button class="btn primary gm-ok" id="gm-ok">${full ? "Done" : "THAT'S ME"}</button><p class="gm-note gm-later">${full ? "Changes save as you tap." : "Change anything later on Your profile."}</p></div></div>`;
    const nb = layer.querySelector(".gm .pbody"); if (nb) nb.scrollTop = top;
    layer.querySelectorAll(".gm [data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === "starter") { me = { ...ME_STARTERS[+v], extra: me.extra, extraCol: me.extraCol, lefty: me.lefty, patches: me.patches, genre: me.genre, who: me.who }; keep(); paint(); haptic(1); }
      else if (k === "skin") set("skin", +v);
      else if (k === "beardCol") { me = { ...me, beardCol: v === me.hairCol ? undefined : v }; keep(); paint(); haptic(1); }
      else if (k === "glasses") set("glasses", v === "true");
      else if (k === "specs") { me = v === "none" ? { ...me, glasses: false } : { ...me, glasses: true, specs: v }; keep(); paint(); haptic(1); }
      else if (k === "freckles") set("freckles", v === "true");
      else if (k === "lefty") set("lefty", v === "true");
      else if (k === "patch") { const cur = patchesOf({ ...data, me }).map(x => x.id), on = (me.patches?.length ? me.patches : []).includes(v); const base = me.patches?.length ? me.patches : cur; set("patches", on ? base.filter(x => x !== v) : [...base.filter(x => x !== v), v].slice(-ME_PATCHES)); }
      else set(k, v);
    }));
    layer.querySelectorAll(".gm [data-tab]").forEach(b => b.addEventListener("click", () => { tab = b.dataset.tab; paint(); layer.querySelector(`#gm-t-${tab}`)?.focus(); }));
    document.getElementById("gm-rand").onclick = () => {
      me = { ...me, skin: Math.floor(Math.random() * SKIN.length), hair: pickOf(ME_HAIR), hairCol: pickOf(ME_HAIR_COL), top: pickOf(ME_TOP_COL), beard: Math.random() < .7 ? "none" : pickOf(ME_BEARD.slice(1)), glasses: Math.random() < .2, specs: pickOf(ME_SPECS),
        face: pickOf(ME_FACE), eyes: pickOf(ME_EYES), eyeCol: pickOf(ME_EYE_COL), brows: pickOf(ME_BROWS), nose: pickOf(ME_NOSE), freckles: Math.random() < .2 };
      keep(); paint(); haptic(1);
    };
    document.getElementById("gm-selfie")?.addEventListener("click", async () => {
      selfieMsg = "";
      const g = await selfieStart({ onBusy: b => { busy = b; paint(); } });
      if (g?.cancelled) return;
      if (!g) { selfieMsg = "Couldn't read that one. Pick a starter instead."; paint(); return; }
      /* the guesses only set the preview: nothing is saved until THAT'S ME (or Done) */
      me = { ...me, beardCol: undefined, ...g }; selfieMsg = "Here's a start from your photo. Fix anything below."; tab = "face"; paint(); haptic(1);
      layer.querySelector(".gm-tabs")?.scrollIntoView({ block: "start" });
    });
    /* Make my portrait (4.99.0): a key first, then plain consent, then one photo to xAI; only the picture is kept, on this phone */
    document.getElementById("gm-port")?.addEventListener("click", () => {
      portMsg = "";
      if (!imgKey()) { toast("Add your xAI key in Settings > Keys first", null, { label: "Keys", fn: () => { layer.innerHTML = ""; go("#/settings/keys"); } }); return; }
      ask({ title: "Make a poster portrait?", text: "You pick one photo. It goes straight from this phone to xAI, with your key, to draw the portrait, and Louie keeps only the finished picture, on this phone. What xAI does with the photo is covered by xAI's API terms. Each portrait costs a few cents on your xAI bill.", ok: "Pick a photo", keep: "Not now" }, async () => {
        drawing = true; paint();
        try { const p = await makePortrait({ onBusy: b => { drawing = b; paint(); } }); if (!p?.cancelled) { portMsg = "Here's your portrait. It's your card and your round picture; the game's poses stay drawn."; haptic(2); } }
        catch (e) { portMsg = portraitError(e); }
        drawing = false; paint();
      });
    });
    document.getElementById("gm-port-off")?.addEventListener("click", async () => { await removePortrait(); portMsg = "Portrait removed from this phone."; paint(); });
    const close = () => { layer.innerHTML = ""; done?.(); };
    document.getElementById("gm-scrim").onclick = full ? close : () => { layer.innerHTML = ""; };
    document.getElementById("gm-ok").onclick = () => { data.me = cleanMe(me); Tabs.save(data); close(); };
    document.getElementById("gm-skip")?.addEventListener("click", () => { data.me = cleanMe(ME_DEFAULT); Tabs.save(data); close(); });
  }
  paint();
}
