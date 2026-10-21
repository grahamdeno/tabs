// The Road: AI help with your own Anthropic key: the request, errors and limits. Split from app.js (4.15.1); app.js re-exports what other files use.
import { detectPaste } from "./core.js";

// ---------- AI help (optional, your own Anthropic key) ----------
// No server: the key stays in this browser's storage and is sent only to
// api.anthropic.com, using Anthropic's header for direct browser access.
// Without a key the app works as usual and the AI options don't appear.
export const AI = { store: "tabs.apikey.v1", fast: "claude-haiku-5-5", vision: "claude-sonnet-5-5" };
export function aiKey() { try { return localStorage.getItem(AI.store) || ""; } catch { return ""; } }
/* The GetSongBPM key, stored the same way (read by Get the song and Settings). */
export const BPM_STORE = "tabs.bpmkey.v1";
export function bpmKey() { try { return localStorage.getItem(BPM_STORE) || ""; } catch { return ""; } }

// stream: the reply arrives as it's written. A long reply (German practice)
// otherwise keeps the connection silent for a minute or more, and iPhone gives
// up on it, which looks like "Could not reach Anthropic".
// Why the last reply ended ("end_turn", "max_tokens", "refusal"...), for the
// "What came back" note when a reply has no text.
let lastStop = "";
export const aiLastStop = () => lastStop;
export async function askClaude({ model = AI.fast, system, content, maxTokens = 8000, key = aiKey(), stream = false }) {
  let r;
  lastStop = "";
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content }], ...(stream ? { stream: true } : {}) })
    });
  } catch { throw Object.assign(new Error("network"), { status: 0, model }); }
  if (!r.ok) {
    // Read Anthropic's error body so the real reason can be explained.
    const j = await r.json().catch(() => ({}));
    throw Object.assign(new Error(j?.error?.message || "HTTP " + r.status), { status: r.status, model });
  }
  if (stream && r.body && /event-stream/.test(r.headers.get("content-type") || "")) {
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = "", text = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (let k = buf.indexOf("\n\n"); k >= 0; k = buf.indexOf("\n\n")) {
          const data = buf.slice(0, k).split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).join("");
          buf = buf.slice(k + 2);
          if (!data) continue;
          let ev; try { ev = JSON.parse(data); } catch { continue; }
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
          else if (ev.type === "message_delta" && ev.delta?.stop_reason) lastStop = ev.delta.stop_reason;
          else if (ev.type === "error") throw Object.assign(new Error(ev.error?.message || "stream error"), { status: ev.error?.type === "overloaded_error" ? 529 : 500, model });
        }
      }
    } catch (e) { if (e.status) throw e; throw Object.assign(new Error("network"), { status: 0, model }); }
    return text;
  }
  const j = await r.json();
  lastStop = j.stop_reason || "";
  return (j.content || []).filter(c => c.type === "text").map(c => c.text).join("");
}

// Plain-English reasons, mapped from Anthropic's status codes.
export function aiError(e) {
  const m = e?.message || "", st = e?.status;
  if (st === 400 && /web search/i.test(m)) return "Web search is turned off for this key's organization. An admin can turn it on in the Anthropic Console under Settings > Capabilities.";
  if (st === -1) return "Couldn't make sense of that. Try again, or keep the original.";
  if (!st) return "Could not reach Anthropic. Check the connection, and turn off any content blocker or VPN filtering for this site.";
  if (st === 401) return "Key not recognized. Copy it again from the Anthropic Console (it starts with sk-ant-).";
  if (st === 403) return "Key is valid but not allowed to do this. Check the key's workspace permissions in the Console.";
  if (st === 400 && /credit|balance|billing/i.test(m)) return "The account has no credit. Add credit under Billing in the Console.";
  if (st === 404) return `Model not found (${e.model}). The model name may need updating.`;
  if (st === 413 || /too large|exceeds/i.test(m)) return "That photo is too large. Try a closer, simpler shot of the page.";
  if (st === 429) return "Rate or spend limit reached. Check Limits in the Console, or wait a minute.";
  if (st >= 500) return "Anthropic is busy or down. Try again in a few minutes.";
  return `Request failed (HTTP ${st}).`;
}

// The first whole JSON object in a reply. Skips code fences, words before or
// after, and stray braces in that text (a "{" in a note ahead of the
// JSON made Play next fail every time). A trailing comma is forgiven.
export function parseJSON(text) {
  const t = String(text);
  for (let i = t.indexOf("{"); i >= 0; i = t.indexOf("{", i + 1)) {
    let depth = 0, str = false, esc = false;
    for (let k = i; k < t.length; k++) {
      const c = t[k];
      if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
      if (c === '"') str = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        const s = t.slice(i, k + 1);
        for (const x of [s, s.replace(/,\s*([}\]])/g, "$1")]) { try { const j = JSON.parse(x); if (j && typeof j === "object") return j; } catch { /* next */ } }
        break;
      }
    }
  }
  throw Object.assign(new Error("bad json"), { status: -1, raw: t.slice(0, 600) });
}

const CLEAN_SYSTEM = `You format guitar chord sheets for a phone app. The input is one song, pasted from a website or photographed from a page.
Reply with JSON only, no other text: {"title": string, "artist": string, "key": string, "format": "chords" or "tab", "sheet": string}
Rules for "sheet":
- Chords go on their own line directly above the lyric line, each chord starting at the column of the syllable where it changes.
- Section labels go on their own line in square brackets, like [Intro], [Verse 1], [Chorus], [Bridge]. One blank line between sections.
- Lines of only chords (intros, instrumentals) stay as chord lines. ASCII tab lines are kept exactly as written.
- If the source states a capo, put [Capo N] as the first line.
- Keep the song's words and chords exactly as given. Do not add, complete, translate or correct lyrics, do not invent chords, and do not transpose.
- Use standard chord spellings: G, Am, F#m7, Bb, Dsus4, D/F#.
- Remove everything that is not the song: ads, ratings, comments, site menus, credits, strumming legends, chord diagram text.
"title", "artist": from the source if present, else "". "key": the key if stated or clear from the chords (like G or Em), else "". "format": "tab" only if the song is mainly ASCII tab.`;

// Clean up pasted text, or read a photographed page, into the app's chord sheet format.
export async function cleanSheet({ text, image }) {
  const content = image
    ? [{ type: "image", source: { type: "base64", media_type: image.type, data: image.data } },
       { type: "text", text: "Transcribe the chord sheet on this page." }]
    : [{ type: "text", text: "Clean up this pasted song:\n\n" + text }];
  const out = parseJSON(await askClaude({ model: image ? AI.vision : AI.fast, system: CLEAN_SYSTEM, content }));
  const sheet = String(out.sheet || "").replace(/\r\n?/g, "\n").replace(/\s+$/, "");
  if (!sheet.trim()) throw Object.assign(new Error("empty"), { status: -1 });
  const d = detectPaste(sheet);
  return {
    title: String(out.title || d.title || "").trim(),
    artist: String(out.artist || d.artist || "").trim(),
    key: String(out.key || "").trim().slice(0, 4),
    format: out.format === "tab" || d.format === "tab" ? "tab" : "chords",
    body: d.title ? d.body : sheet,
    sections: d.sections
  };
}

// Shrink a photo to a size the API accepts quickly, as JPEG base64.
export async function readPhoto(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { type: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1] };
  } finally { URL.revokeObjectURL(url); }
}

export const busy = label => `<span class="spin" aria-hidden="true"></span>${label}`;
