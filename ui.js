// Tabs building blocks shared by every screen: icons, escaping, toasts,
// in-app questions (ask), and the hooks screens use to tidy up and follow
// scrolling. Depends only on core.js.
import { esc, html, raw } from "./core.js";

// ---------- Icons ----------
const I = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
  heart: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M6 12h12"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="m14.5 5-7 7 7 7"/>',
  chev: '<path d="m9 5 7 7-7 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  gauge: '<path d="M4.5 17a9 9 0 1 1 15 0"/><path d="m12 13 3.5-4"/><circle cx="12" cy="13" r="1.2"/>',
  rain: '<path d="M7 15h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 6.2 4.4 4.4 0 0 0 7 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 6l2.5-1.5M9.5 19.5 12 18l2.5 1.5"/>',
  flame: '<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.6-8.4 2.3 1.4 3.4 3.4 3.4 5.4 1-.6 1.6-1.7 1.7-2.9 1.9 1.6 3.3 3.6 3.3 6 0 3.2-2.4 5.5-6 5.5z"/>',
  chat: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
  note: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v5h16v-5"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4 14v5h16v-5"/>',
  focus: '<path d="M4 7h16"/><path d="M4 12h16" stroke-width="2.4"/><path d="M4 17h16"/>',
  wand: '<path d="M4 20 14.5 9.5"/><path d="m13 8 3 3"/><path d="M17 3.5v3M15.5 5h3M20 9v2M19 10h2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.2 4.4 4.4 0 0 0 7 18z"/><path d="M12 15V10M9.8 12 12 9.8l2.2 2.2"/>',
  trash: '<path d="M4 7h16M10 7V4.5h4V7M6 7l1 13h10l1-13"/>',
  metro: '<path d="M8 21h8l-2.5-17h-3z"/><path d="M12 16l5-9"/>',
  sections: '<path d="M18 4v16"/><circle cx="18" cy="8" r="1.8"/><circle cx="18" cy="15" r="1.8"/><path d="M5 8h8M5 15h8"/>',
  listplus: '<path d="M4 7h11M4 12h11M4 17h7M18 14v6M15 17h6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  fork: '<path d="M9 3v7a3 3 0 0 0 6 0V3"/><path d="M12 13v8"/>',
  stage: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
  pick: '<path d="M12 3c4 0 7 2 7 6 0 5-4 10-7 12-3-2-7-7-7-12 0-4 3-6 7-6z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  image: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="M20.5 15l-5-5L5 20.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  amp: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="13" r="3"/><path d="M15 10h3M15 13h3M15 16h3M6 8h12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  dots: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M6 11H5v9h14v-9h-1"/>',
  loop: '<path d="M17 4l3 3-3 3"/><path d="M4 12V9a2 2 0 0 1 2-2h14"/><path d="M7 20l-3-3 3-3"/><path d="M20 12v3a2 2 0 0 1-2 2H4"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  fretboard: '<path d="M6 4h12M6 4v16M10 4v16M14 4v16M18 4v16M6 9h12M6 14h12"/><circle cx="10" cy="11.5" r="1.4" fill="currentColor"/><circle cx="14" cy="16.5" r="1.4" fill="currentColor"/>',
  clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/>',
  check: '<path d="M5 12l4 4 10-10"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.3"/><rect x="14" y="5" width="4" height="14" rx="1.3"/>'
};
const icon = (n, cls = "") => raw(`<svg class="i ${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`);
const $ = id => document.getElementById(id);
// Leaving a screen: each feature registers its own tidy-up next to its code,
// and render() runs them all before drawing the next screen.
const leaveHooks = [];
const onLeave = fn => leaveHooks.push(fn);
// Scrolling: one listener for the whole app, at most once per frame. Features
// register what they do on scroll with onScroll.
const scrollHooks = [];
const onScroll = fn => scrollHooks.push(fn);
let scrollFrame = 0;
window.addEventListener("scroll", () => {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; scrollHooks.forEach(fn => fn()); });
}, { passive: true });
const app = $("app");
const layer = $("layer");
// Sheets in the layer close with a swipe down: from the handle or
// title row, or from the content once it's scrolled to the top. They follow
// the finger, and spring back from a short pull. Closing goes through the
// sheet's own scrim, so each sheet tidies up as it does on a tap outside.
(() => {
  let d = null;
  const back = p => { p.style.transition = "translate .2s cubic-bezier(.2,1,.3,1)"; p.style.translate = ""; };
  layer.addEventListener("touchstart", e => {
    const p = e.target.closest?.(".panel");
    if (!p || e.touches.length > 1 || e.target.closest("input, textarea, select, .dial")) return;
    const body = p.querySelector(".pbody"), inBody = !!body?.contains(e.target);
    if (inBody && body.scrollTop > 0) return;
    d = { p, body, inBody, y: e.touches[0].clientY, t: Date.now(), dy: 0 };
  }, { passive: true });
  layer.addEventListener("touchmove", e => {
    if (!d) return;
    if (d.inBody && d.body.scrollTop > 0) { back(d.p); d = null; return; }
    const dy = e.touches[0].clientY - d.y;
    if (dy <= 0) { if (d.dy) d.p.style.translate = ""; d.dy = 0; return; }
    d.dy = dy;
    d.p.style.transition = "none"; d.p.style.translate = `0 ${dy}px`;
    if (dy > 6 && e.cancelable) e.preventDefault();   /* the sheet moves, not the page */
  }, { passive: false });
  const end = () => {
    if (!d) return;
    const { p, dy, t } = d; d = null;
    if (dy > 110 || (dy > 40 && dy / (Date.now() - t) > 0.5)) {
      p.style.transition = "translate .18s ease-in"; p.style.translate = `0 ${innerHeight}px`;
      setTimeout(() => { const s = layer.querySelector(".scrim"); if (s) s.click(); else layer.innerHTML = ""; }, 170);
    } else if (dy) back(p);
  };
  layer.addEventListener("touchend", end);
  layer.addEventListener("touchcancel", () => { if (d) { back(d.p); d = null; } });
})();
// A short message. With `near`, it appears just above that control, where the eye already is.
function toast(msg, near, action) {
  const t = $("toast");
  clearTimeout(toast.timer);
  t.classList.remove("show", "near");
  t.style.left = t.style.top = "";
  t.textContent = msg;
  if (action) {
    const b = document.createElement("button");
    b.className = "tact";
    b.textContent = action.label;
    b.onclick = () => { clearTimeout(toast.timer); t.classList.remove("show"); action.fn(); };
    t.appendChild(b);
  }
  if (near) {
    const r = near.getBoundingClientRect();
    const above = (near.closest(".pw") || near).getBoundingClientRect().top;
    t.classList.add("near");
    const w = t.offsetWidth;
    const x = Math.min(window.innerWidth - w / 2 - 12, Math.max(w / 2 + 12, r.left + r.width / 2));
    t.style.left = x + "px";
    /* Near a header button there's no room above, so show it just below instead. */
    const top = above - t.offsetHeight - 10;
    t.style.top = (top < 12 ? r.bottom + 10 : top) + "px";
  }
  void t.offsetWidth; // restart the transition
  t.classList.add("show");
  toast.timer = setTimeout(() => t.classList.remove("show"), action ? 6000 : near ? 1400 : 2000);
}
// Keep bottom bars above the iOS keyboard.
function followKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  if (document.body.classList.contains("searching")) { document.querySelectorAll(".kb").forEach(el => { el.style.transform = ""; }); return; }
  const off = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.querySelectorAll(".kb").forEach(el => {
    el.style.transform = `translate(-50%, ${-off}px)`;
  });
}
window.visualViewport?.addEventListener("resize", followKeyboard);
window.visualViewport?.addEventListener("scroll", followKeyboard);
// ---------- Sheets: questions asked in the app, not in the phone's alerts ----------
// ask() shows a short card at the bottom, above any open panel, and calls done
// with the answer inside the tap, so what follows can still open the keyboard.
// With a field: { title, text, value, placeholder, picks, ok, okLabel(v), extra, preview(v), readonly }
//   done(text) on OK or a pick, done(extra.value) on the extra button.
// A yes/no: { title, text, ok, danger, keep }: done(true) on OK.
// Cancel, the scrim or Escape just close it.
function closeAsk() { document.querySelector(".ask")?.remove(); }
onLeave(() => closeAsk());
function ask(o, done) {
  closeAsk();
  const field = "value" in o || "placeholder" in o;
  const w = document.createElement("div");
  w.className = "ask";
  const okBtn = html`<button class="btn primary" id="ask-ok">${o.ok || "OK"}</button>`;
  w.innerHTML = html`<div class="scrim"></div><div class="panel card kb" role="dialog" aria-modal="true" aria-labelledby="ask-t">
    <b class="ask-t" id="ask-t">${o.title}</b>
    ${o.text && html`<p class="ask-p">${o.text}</p>`}
    ${field && html`<div class="ask-row"><div class="fields glass"><label class="fld"><input id="ask-in" value="${o.value || ""}" placeholder="${o.placeholder || ""}" autocomplete="off" autocapitalize="${o.caps || "sentences"}" spellcheck="false" enterkeyhint="done" aria-labelledby="ask-t" ${o.readonly ? raw("readonly") : ""}></label></div>${o.preview && raw('<div class="ask-pv" id="ask-pv" aria-hidden="true"></div>')}</div>`}
    ${o.picks && html`<div class="ask-picks">${o.picks.map(x => html`<button class="chip ${x === o.value ? "on" : ""}" data-pick="${x}">${x}</button>`)}</div>`}
    <div class="actions ${o.danger ? "stack" : ""}">
      ${o.danger
        ? html`<button class="btn bad" id="ask-ok">${o.ok}</button><button class="btn" id="ask-no">${o.keep || "Cancel"}</button>`
        : html`${o.extra ? html`<button class="btn" id="ask-x">${o.extra.label}</button>` : o.readonly ? "" : raw('<button class="btn" id="ask-no">Cancel</button>')}${okBtn}`}
    </div></div>`;
  document.body.appendChild(w);
  const inp = $("ask-in"), ok = $("ask-ok");
  const val = () => (inp ? inp.value.trim() : true);
  const finish = v => { closeAsk(); done?.(v); };
  const update = () => {
    if (!inp) return;
    if (o.preview) $("ask-pv").innerHTML = o.preview(val());
    if (o.okLabel) ok.textContent = o.okLabel(val());
    if (!o.readonly && !o.extra) ok.disabled = !val();
  };
  ok.onclick = () => (o.readonly ? closeAsk() : finish(val()));
  $("ask-no")?.addEventListener("click", closeAsk);
  $("ask-x")?.addEventListener("click", () => finish(o.extra.value));
  w.querySelector(".scrim").onclick = closeAsk;
  w.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => finish(b.dataset.pick));
  w.addEventListener("keydown", e => {
    if (e.key === "Escape") closeAsk();
    if (e.key === "Enter" && e.target === inp && !ok.disabled) { e.preventDefault(); ok.click(); }
  });
  update();
  inp?.addEventListener("input", update);
  if (inp && o.readonly) { inp.focus(); inp.select(); }
  else if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  else ok.focus();
  followKeyboard();
}
// Panels in the layer behave as dialogs: focus moves in when one opens (unless
// the panel focused a field itself) and back to what opened it when it closes;
// Escape closes it the way tapping outside does.
let layerOpener = null;
new MutationObserver(() => {
  const dlg = layer.querySelector("[role=dialog]");
  if (dlg) {
    dlg.setAttribute("aria-modal", "true");
    if (!layer.contains(document.activeElement)) {
      if (!layerOpener) layerOpener = document.activeElement;
      if (!dlg.hasAttribute("tabindex")) dlg.tabIndex = -1;
      dlg.focus({ preventScroll: true });
    }
  } else if (!layer.children.length && layerOpener) {
    if (layerOpener.isConnected && layerOpener !== document.body) layerOpener.focus({ preventScroll: true });
    layerOpener = null;
  }
}).observe(layer, { childList: true });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || document.querySelector(".ask") || !layer.children.length) return;
  const s = layer.querySelector(".scrim");
  if (s) { e.preventDefault(); s.click(); }
});
// When copying isn't allowed, show the text ready to select.
const showToCopy = (title, text) => ask({ title, value: text, readonly: true, ok: "Done" });
const SECTION_NAMES = ["Intro", "Verse", "Pre-chorus", "Chorus", "Bridge", "Solo", "Outro"];

// One hand: a phone held upright. Controls move to the bottom, in reach of the
// thumb. iPad and landscape keep their layouts.
const oneHandMQ = matchMedia("(max-width: 699px) and (orientation: portrait)");
export { oneHandMQ };

// One audio engine for the whole app: count-in, metronome, Play
// together, the tuner and Strum it share it. iPhone limits how many can run
// and only lets one start from a touch, so it's made the first time a feature
// needs sound (never just for opening the app, so music playing alongside
// isn't interrupted) and woken by any touch if iPhone has paused it.
let audioCtx = null;
export function sound() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== "running") audioCtx.resume?.()?.catch?.(() => {});
  } catch { return null; }
  return audioCtx;
}
addEventListener("pointerdown", () => { if (audioCtx && audioCtx.state !== "running") audioCtx.resume?.()?.catch?.(() => {}); }, true);
export { html, raw, $, I, SECTION_NAMES, app, ask, esc, followKeyboard, icon, layer, leaveHooks, onLeave, onScroll, showToCopy, toast };
