// Choosing your guitarist (painted only, 2026-11-23). One sheet, three ways in:
//   "start"  Opening night's first step, "Who's playing tonight?": THAT'S ME (Skip keeps the default)
//   "once"   a player already past Opening night meets it once, on the Road (Louie asks); Skip keeps the default
//   "full"   Your profile > Edit: every change saves as you tap it
// The whole choice is one of 24 paintings (12 genres, man or woman) and a left-handed mirror. The Road decides the rest.
import { ME_DEFAULT, ME_GENRE, OPENING, Tabs, cleanMe, meOf, openingStep } from "./core.js";
import { esc, haptic, layer } from "./ui.js";
import { data } from "./app.js";
import { genreFile, genreIdOf } from "./guitarist.js";

const GENRE_NAME = { rock: "Rock", punk: "Punk", metal: "Metal", blues: "Blues", country: "Country", folk: "Folk", jazz: "Jazz", classical: "Classical", indie: "Indie", funk: "Funk", reggae: "Reggae", pop: "Pop" };
const DICE = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="8.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.6" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.6" fill="currentColor"/></svg>`;
const FLIP = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v18" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2.4"/><path d="M9 6L3 18h6Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M15 6l6 12h-6Z" fill="currentColor"/></svg>`;
const pickOf = list => list[Math.floor(Math.random() * list.length)];

export function makerSheet({ mode = "full", done } = {}) {
  let me = { ...ME_DEFAULT, ...meOf(data) };
  const full = mode === "full";
  const keep = () => { if (full) { data.me = cleanMe(me); Tabs.save(data); } };
  const set = (k, v) => { me = { ...me, [k]: v }; keep(); paint(); haptic(1); };
  const chip = (key, v, label, on, inner, cls = "") => `<button class="gm-c${cls}${on ? " on" : ""}" data-k="${key}" data-v="${esc(String(v))}" aria-pressed="${on}" aria-label="${esc(label)}">${inner}</button>`;
  const step = Math.min(openingStep(data) + 1, OPENING.length);
  function paint() {
    const el = layer.querySelector(".gm .pbody"), top = el ? el.scrollTop : 0;
    const title = full ? "Your guitarist" : "Who's playing tonight?";
    layer.innerHTML = `<div class="scrim" id="gm-scrim"></div><div class="panel de-sheet gm" role="dialog" aria-label="${title}"><div class="grab"></div>
      <div class="pbody">
        ${mode === "start" ? `<div class="gm-top"><span class="gm-over">OPENING NIGHT · ${step} OF ${OPENING.length}</span><button class="mt-not" id="gm-skip">Skip</button></div>` : mode === "once" ? `<div class="gm-top"><span class="gm-over">TONIGHT</span><button class="mt-not" id="gm-skip">Skip</button></div>` : ""}
        <h2>${title}</h2>
        <div class="gm-stage">
          <div class="gm-card"><div class="gm-prev" aria-live="polite"><img class="gm-hero${me.lefty ? " lefty" : ""}" src="${genreFile(genreIdOf(me))}" alt="Your guitarist"></div>
          <button class="ib gm-rand" id="gm-rand" aria-label="Random guitarist">${DICE}</button>
          ${chip("lefty", !me.lefty, "Left-handed", me.lefty, FLIP, " ib gm-flip")}</div>
          <div class="gm-lou"><img src="art/louie/v5/louie-face-badge.webp" alt="" width="40" height="40"><p>${mode === "once" ? "I picked you a guitarist for your card and the chart." : "Pick your genre and who's playing."}</p></div>
        </div>
        <h3>Genre</h3><div class="gm-row gm-genre" role="group" aria-label="Genre">${ME_GENRE.map(g => chip("genre", g, GENRE_NAME[g], me.genre === g, `<span>${GENRE_NAME[g]}</span>`)).join("")}</div>
        <h3>Man or woman</h3><div class="gm-row gm-who" role="group" aria-label="Man or woman">${[["m", "Man"], ["w", "Woman"]].map(([v, n]) => chip("who", v, n, me.who === v, `<span>${n}</span>`)).join("")}</div>
      </div>
      <div class="pfoot"><button class="btn primary gm-ok" id="gm-ok">${full ? "Done" : "THAT'S ME"}</button><p class="gm-note gm-later">${full ? "Changes save as you tap." : "Change anything later on Your profile."}</p></div></div>`;
    const nb = layer.querySelector(".gm .pbody"); if (nb) nb.scrollTop = top;
    layer.querySelectorAll(".gm [data-k]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.k, v = b.dataset.v;
      if (k === "lefty") set("lefty", v === "true"); else set(k, v);
    }));
    /* the dice pick one of the 24 paintings; left-handed stays as it is */
    document.getElementById("gm-rand").onclick = () => { me = { ...me, genre: pickOf(ME_GENRE), who: pickOf(["m", "w"]) }; keep(); paint(); haptic(1); };
    const close = () => { layer.innerHTML = ""; done?.(); };
    document.getElementById("gm-scrim").onclick = full ? close : () => { layer.innerHTML = ""; };
    document.getElementById("gm-ok").onclick = () => { data.me = cleanMe(me); Tabs.save(data); close(); };
    document.getElementById("gm-skip")?.addEventListener("click", () => { data.me = cleanMe(ME_DEFAULT); Tabs.save(data); close(); });
  }
  paint();
}
