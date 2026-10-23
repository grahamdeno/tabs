// Achievement callouts (4.44.0, #77, #78 to #80): a big word bursts over the screen for a moment and
// clears itself. It takes no taps (they go to the screen underneath), animates only transform and
// opacity so a Gig's timing isn't touched, shows one at a time (the rest wait their turn), and is
// read out once, politely, by a screen reader. Reduce Motion shows it still and fades it.
// Each kind has a few looks (pickLook) and Louie brings one of your band who has joined (castFor).
import { castFor, pickLook } from "./core.js";
import { esc, haptic } from "./ui.js";
import { louie } from "./louie.js";
import { friend } from "./friends.js";

export const CALLOUT_MS = 1600;
const queue = [], lastLook = {};
let showing = false, lastCast = null, dataRef = null;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* The words a screen reader hears, in a region made once */
function say(text) {
  let r = document.getElementById("co-say");
  if (!r) { r = document.createElement("div"); r.id = "co-say"; r.className = "sr-only"; r.setAttribute("aria-live", "polite"); document.body.appendChild(r); }
  r.textContent = ""; requestAnimationFrame(() => { r.textContent = text; });
}

/**
 * callout(data, { kind, word, big, who })
 *   kind  combo | chord | level | badge | join | lesson (picks the look and who celebrates)
 *   word  the small line (COMBO, NEW CHORD, LEVEL UP)
 *   big   the big part (x20, F, 7)
 *   who   a friend's id who must be the one shown (a new band member)
 */
export function callout(data, c) {
  dataRef = data;
  if (queue.length >= 3) return; /* a burst of them: the first three, the rest are on Your profile */
  queue.push(c);
  if (!showing) next();
}

function next() {
  const c = queue.shift();
  if (!c) { showing = false; return; }
  showing = true;
  const look = pickLook(c.kind, lastLook[c.kind]); lastLook[c.kind] = look;
  const cast = dataRef ? castFor(dataRef, c.kind, lastCast, Math.random(), c.who) : null;
  if (cast) lastCast = cast;
  const still = calm();
  const el = document.createElement("div");
  el.className = `co co-${look}${still ? " still" : ""}`;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<div class="co-fx"></div>
    <div class="co-badge"><small>${esc(c.word)}</small>${c.big ? `<b>${esc(c.big)}</b>` : ""}</div>
    <div class="co-cast">${louie("cheer", { pose: "hornsUp", size: 58 })}${cast ? `<span class="co-friend">${friend(cast, { size: 56, mood: "cheer" })}</span>` : ""}</div>`;
  if (look === "bolt") el.querySelector(".co-fx").innerHTML = `<svg viewBox="0 0 120 220"><path d="M70 0 L30 100 L62 100 L38 220 L96 82 L62 82 L88 0 Z"/></svg>`;
  if (look === "burst" && !still) el.querySelector(".co-fx").innerHTML = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg;--d:${(i % 3) * 40}ms"></i>`).join("");
  document.body.appendChild(el);
  say(`${c.word} ${c.big || ""}`.trim());
  if (!still) haptic(1);
  setTimeout(() => {
    el.classList.add("out");
    setTimeout(() => { el.remove(); next(); }, still ? 300 : 260);
  }, CALLOUT_MS);
}
