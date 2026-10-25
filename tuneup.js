// Tune up first (4.72.0, Graham 2026-10-24): when the air has changed a lot since your last play (humidity or
// temperature, from Open-Meteo for the city in Settings > Playing), the song page says so once a day, above
// Tools and Play: Louie with a tuning fork, the two changes, Not now and Tune up (the tuner for the song's tuning).
// Nothing without a city, after a recent tune-up, or while a song plays. Only the city's position is sent.
import { Tabs, tuneUpDue } from "./core.js";
import { esc } from "./ui.js";
import { data, openTuner, scroll, songTuning, tunedRecently, viewing } from "./app.js";
import { louie } from "./louie.js";

const KEY = "tabs.wxnow.v1";
const unit = () => (/^en-US/i.test(navigator.language || "") ? "F" : "C");
const today = () => new Date().toDateString();
let asking = null;
/* the air now: humidity and temperature, cached for an hour */
export async function airNow() {
  const p = data.settings.place;
  if (!p) return null;
  let c = null;
  try { c = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (c && c.lat === p.lat && c.lon === p.lon && c.unit === unit() && Date.now() - c.at < 3600e3) return c;
  if (navigator.onLine === false) return null;
  asking ||= (async () => {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&current=relative_humidity_2m,temperature_2m${unit() === "F" ? "&temperature_unit=fahrenheit" : ""}&timezone=auto`);
      if (!r.ok) return null;
      const j = await r.json(), hum = j?.current?.relative_humidity_2m, temp = j?.current?.temperature_2m;
      if (!(hum >= 0) || !Number.isFinite(temp)) return null;
      const out = { at: Date.now(), lat: p.lat, lon: p.lon, unit: unit(), hum, temp };
      try { localStorage.setItem(KEY, JSON.stringify(out)); } catch {}
      return out;
    } catch { return null; } finally { asking = null; }
  })();
  return asking;
}
/* a song played through: remember the air it was played in */
export function notePlayAir() {
  airNow().then(a => { if (a) { data.settings.playAir = { hum: Math.round(a.hum), temp: Math.round(a.temp), unit: a.unit, day: new Date().toISOString().slice(0, 10) }; Tabs.save(data); } });
}
const dayName = iso => { const d = new Date(iso + "T12:00:00"), days = Math.round((Date.now() - d) / 864e5); return days <= 1 ? "yesterday" : days < 7 ? "since " + d.toLocaleDateString("en-US", { weekday: "long" }) : "since " + d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };
/* on the song page: show the card when it's due */
export async function tuneUpCheck(song) {
  const s = data.settings;
  if (!s.place || !s.playAir || s.tuneShown === today() || tunedRecently() || song.format === "tab") return;
  const now = await airNow();
  if (viewing !== song || scroll.on || document.getElementById("tuneup") || document.body.classList.contains("cedit")) return;
  const due = tuneUpDue(s.playAir, now && { hum: now.hum, temp: now.temp, unit: now.unit });
  if (!due) return;
  s.tuneShown = today(); Tabs.save(data);
  const wetter = due.hum[1] - due.hum[0], warmer = due.temp[1] - due.temp[0];
  const what = Math.abs(wetter) >= 25 ? `The air got a lot ${wetter > 0 ? "wetter" : "drier"} since you last played.` : `It's a lot ${warmer > 0 ? "warmer" : "colder"} than when you last played.`;
  const el = document.createElement("section");
  el.id = "tuneup"; el.className = "tuneup card"; el.setAttribute("aria-labelledby", "tu-h");
  el.innerHTML = `<div class="tu-top"><span class="tu-lou">${louie("happy", { size: 60 })}</span><div><h2 id="tu-h">Tune up first</h2><p>${esc(what)} Strings drift when it does.</p></div></div>
    <div class="tu-tiles"><div><small>HUMIDITY</small><b>${due.hum[0]}% to ${due.hum[1]}%</b><span>${esc(dayName(due.day))}</span></div><div><small>TEMPERATURE</small><b>${due.temp[0]}° to ${due.temp[1]}°</b><span>${esc(dayName(due.day))}</span></div></div>
    <div class="tu-acts"><button class="btn" id="tu-no">Not now</button><button class="btn primary" id="tu-go">TUNE UP</button></div>`;
  const dock = document.querySelector(".app.viewer .dock");
  (dock || document.body).before(el);
  const close = () => el.remove();
  el.querySelector("#tu-no").onclick = close;
  el.querySelector("#tu-go").onclick = () => { close(); openTuner(songTuning(song)); };
  addEventListener("hashchange", close, { once: true });
}
