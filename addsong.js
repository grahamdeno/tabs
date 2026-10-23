// Add a song, asked first (4.45.0, #74): "What song?" with one field and three buttons above the
// keyboard: Paste, Scan (with an AI key) and Write my own. Typing a title shows your Songbook's
// matches first, then recordings from Apple's public catalog; picking one runs Get the song (with an
// AI key) or opens Write my own with the title and artist filled in. A whole sheet pasted into the
// field goes to the paste card. Key, tuning and tempo are worked out later, never asked here.
import { detectPaste } from "./core.js";
import { $, esc, followKeyboard, icon, layer, toast } from "./ui.js";
import { aiKey, aiError, busy, cleanSheet, readPhoto } from "./aihelp.js";
import { data, findAI, newSong, playSong } from "./app.js";
import { showPasteCard } from "./library.js";
import { itunes } from "./sets.js";
import { renderImport } from "./share.js";

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/* Songbook matches: every word typed is in the title or the artist */
export const songbookMatches = (songs, q, n = 3) => {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  return songs.filter(s => { const h = norm(`${s.title} ${s.artist}`); return words.every(w => h.includes(w)); }).slice(0, n);
};

export function askSong() {
  const ai = !!aiKey();
  let timer = 0, seq = 0, found = [];
  layer.innerHTML = `<div class="scrim" id="as-scrim"></div>
    <div class="panel card kb as" role="dialog" aria-label="Add a song"><div class="grab" aria-hidden="true"></div>
      <h2 class="as-h">What song?</h2>
      <label class="as-field">${icon("search")}<span class="sr-only">Song title, or paste a whole sheet</span>
        <input id="as-q" placeholder="Type a title, or paste a sheet" autocomplete="off" autocorrect="off" enterkeyhint="search"></label>
      <div class="as-list" id="as-list"><p class="as-note">${ai ? "Louie finds the chords, the words and the tempo. You check it and add it." : "Find it by name, or paste a sheet you've copied."}</p></div>
      <div class="as-foot">
        <button class="as-b" id="as-paste">${icon("clip")}Paste</button>
        ${ai ? `<button class="as-b" id="as-scan">${icon("camera")}Scan</button>` : ""}
        <button class="as-b" id="as-write">${icon("edit")}Write my own</button>
      </div>
      <input type="file" id="as-photo" accept="image/*" hidden>
    </div>`;
  const close = () => { clearTimeout(timer); seq++; layer.innerHTML = ""; };
  const q = $("as-q"), list = $("as-list");
  $("as-scrim").onclick = close;
  setTimeout(() => q.focus(), 50);
  followKeyboard?.();

  const write = (fields = {}) => { close(); newSong(fields, "text"); };
  const pick = r => {
    close();
    if (ai) return findAI().then(m => m.getSong(r.title, { title: r.title, artist: r.artist }));
    write({ title: r.title, artist: r.artist });
  };
  const pasted = text => {
    const link = text.match(/#\/import\/([zj][A-Za-z0-9_-]+)/);
    if (link) { close(); return renderImport(link[1]), true; }
    if (text.trim().split("\n").filter(l => l.trim()).length < 2) return false;
    close(); showPasteCard(detectPaste(text)); return true;
  };
  const row = (id, art, t, a, tail) => `<button class="as-row" ${id}><span class="as-art">${art}</span><span class="as-tx"><b>${esc(t)}</b><small>${esc(a)}</small></span>${tail}</button>`;
  const paint = (text, mine, rec, state) => {
    if (!text) { list.innerHTML = `<p class="as-note">${ai ? "Louie finds the chords, the words and the tempo. You check it and add it." : "Find it by name, or paste a sheet you've copied."}</p>`; return; }
    const letter = s => `<i style="background:var(--streak)">${esc((s.title || "?").slice(0, 1))}</i>`;
    list.innerHTML = `${mine.length ? `<div class="as-lab">IN YOUR SONGBOOK</div>${mine.map(s => row(`data-open="${esc(s.id)}"`, letter(s), s.title, `${s.artist ? s.artist + " · " : ""}Already yours`, "")).join("")}` : ""}
      ${rec.length ? `<div class="as-lab">${ai ? "GET IT" : "ADD IT"}</div>${rec.map((r, i) => row(`data-rec="${i}"`, r.art ? `<img src="${esc(r.art)}" alt="">` : "<i></i>", r.title, `${r.artist}${r.year ? " · " + r.year : ""}`, icon("chev", "chev"))).join("")}` : ""}
      ${state === "busy" ? `<p class="as-note">${busy("Looking")}</p>` : ""}
      ${row('data-own="1"', icon("edit"), `Write "${text}" myself`, "A blank sheet with this title", icon("chev", "chev"))}`;
    list.querySelectorAll("[data-open]").forEach(b => b.onclick = () => { close(); playSong(b.dataset.open); });
    list.querySelectorAll("[data-rec]").forEach(b => b.onclick = () => pick(found[+b.dataset.rec]));
    list.querySelector("[data-own]").onclick = () => write({ title: text });
  };
  const search = () => {
    const text = q.value.trim(), mine = songbookMatches(data.songs, text), me = ++seq;
    if (text.length < 2) { found = []; return paint(text, mine, [], ""); }
    paint(text, mine, found, navigator.onLine === false ? "" : "busy");
    if (navigator.onLine === false) return;
    itunes("search", { term: text, media: "music", entity: "song", limit: 5 }).then(j => {
      if (me !== seq) return;
      const seen = new Set();
      found = (j?.results || []).map(x => ({ title: String(x.trackName || "").slice(0, 100), artist: String(x.artistName || "").slice(0, 100), year: String(x.releaseDate || "").slice(0, 4),
        art: /^https:\/\//.test(x.artworkUrl100 || "") ? x.artworkUrl100 : "" })).filter(r => { const k = norm(r.title + "|" + r.artist); if (!r.title || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
      paint(text, mine, found, "");
    }).catch(() => { if (me === seq) paint(text, mine, [], ""); });
  };
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 250); });
  q.addEventListener("paste", e => { const text = e.clipboardData?.getData("text") || ""; if (pasted(text)) e.preventDefault(); });
  q.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const text = q.value.trim();
    if (!text) return;
    if (found[0]) return pick(found[0]);
    ai ? (close(), findAI().then(m => m.getSong(text, { title: text }))) : write({ title: text });
  });
  $("as-paste").onclick = async () => {
    let text = "";
    try { text = await navigator.clipboard.readText(); } catch { q.focus(); return toast("Touch and hold the field, then choose Paste"); }
    if (!text.trim()) return toast("Nothing to paste yet. Copy a chord sheet first.");
    if (!pasted(text)) { q.value = text.trim(); search(); }
  };
  $("as-write").onclick = () => write(q.value.trim() ? { title: q.value.trim() } : {});
  $("as-scan")?.addEventListener("click", () => $("as-photo").click());
  $("as-photo")?.addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    const b = $("as-scan"); b.disabled = true; b.innerHTML = busy("Reading");
    try {
      const r = await cleanSheet({ image: await readPhoto(file) });
      write({ title: r.title || "", artist: r.artist || "", ...(r.key ? { key: r.key } : {}), ...(r.format ? { format: r.format } : {}), body: r.body });
    } catch (err) { toast(aiError(err)); b.disabled = false; b.innerHTML = `${icon("camera")}Scan`; }
  });
}
