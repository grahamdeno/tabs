// The YouTube search server (4.96.0, docs/YOUTUBE-PLAN.md): finds a song's video for Play along on YouTube, with a
// YouTube Data API key that lives only here, as a secret, so no key is in the app.
//
//   GET /find?artist=&title=&len=   -> { items: [{ id, title, channel, secs, topic }] }, best first, up to 5
//
// A search costs 100 of YouTube's 10,000 daily quota units, so each answer is kept for 30 days (Cloudflare's cache).
// It prefers the artist's own audio: "Artist - Topic" channels carry the album recording with no video intro, timed
// like the synced lyrics. Only the app's address may call it. Secret: YOUTUBE_KEY. See worker/README.md.

export const ALLOWED_ORIGINS = ["https://grahamdeno.github.io"];
export const allowed = origin => ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || "");
export const KEEP_DAYS = 30;
const cors = origin => ({ "access-control-allow-origin": allowed(origin) ? origin : ALLOWED_ORIGINS[0], "access-control-allow-methods": "GET, OPTIONS", "access-control-max-age": "86400", vary: "origin" });
const json = (body, status, headers, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extra, "content-type": "application/json" } });

/* ISO 8601 duration (PT3M32S) in seconds */
export const isoSecs = d => { const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(d || ""); return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; };
const plain = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
/* best first: the artist's Topic channel, then the artist's own channel, then official audio, then the length closest
   to the recording's; live versions, covers, karaoke and lyric videos last */
export function rank(items, { artist = "", title = "", len = 0 } = {}) {
  const a = plain(artist), t = plain(title);
  const score = v => {
    const ch = plain(v.channel), ti = plain(v.title);
    let s = 0;
    /* channel names run words together ("TomPettyVEVO"), so compare without spaces */
    const sq = x => x.replace(/ /g, ""), A = sq(a), C = sq(ch).replace(/(vevo|official|music|topic)+$/, "");
    if (v.topic && (!a || sq(ch).startsWith(A))) s += 100;
    else if (A && C === A) s += 60;
    if (/official (audio|music video|video)/.test(ti)) s += 20;
    if (t && sq(ti).includes(sq(t))) s += 15;
    if (/\b(live|cover|karaoke|lyrics?|instrumental|reaction|lesson|tutorial|remix|sped up|slowed)\b/.test(ti) && !(t && /\b(live|remix)\b/.test(t))) s -= 50;
    if (len && v.secs) s -= Math.min(40, Math.abs(v.secs - len));
    return s;
  };
  return items.map(v => ({ v, s: score(v) })).sort((x, y) => y.s - x.s).map(x => x.v);
}

async function yt(env, path, params) {
  const u = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries({ ...params, key: env.YOUTUBE_KEY })) u.searchParams.set(k, v);
  const r = await fetch(u);
  if (!r.ok) { let m = ""; try { m = (await r.json()).error?.message || ""; } catch { /* not JSON */ } throw new Error(`YouTube said ${r.status}${m ? `: ${m}` : ""}`); }
  return r.json();
}
export async function find(env, { artist, title, len }) {
  const q = `${artist || ""} ${title || ""}`.trim();
  const s = await yt(env, "search", { part: "snippet", type: "video", videoCategoryId: "10", maxResults: "8", q, safeSearch: "none" });
  const ids = (s.items || []).map(i => i.id?.videoId).filter(Boolean);
  if (!ids.length) return [];
  const d = await yt(env, "videos", { part: "contentDetails,snippet,status", id: ids.join(",") });
  const items = (d.items || []).filter(v => v.status?.embeddable !== false).map(v => ({
    id: v.id, title: v.snippet?.title || "", channel: v.snippet?.channelTitle || "", secs: isoSecs(v.contentDetails?.duration), topic: /\s-\sTopic$/.test(v.snippet?.channelTitle || "")
  }));
  return rank(items, { artist, title, len: +len || 0 }).slice(0, 5);
}

export async function handle(request, env, cache = globalThis.caches?.default) {
  const origin = request.headers.get("origin"), headers = cors(origin), url = new URL(request.url);
  if (!allowed(origin)) return json({ error: "This server only answers the app." }, 403, headers);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (url.pathname !== "/find" || request.method !== "GET") return json({ error: "Not here." }, 404, headers);
  if (!env.YOUTUBE_KEY) return json({ error: "The YouTube server isn't set up yet (no key)." }, 503, headers);
  const artist = (url.searchParams.get("artist") || "").slice(0, 100), title = (url.searchParams.get("title") || "").slice(0, 150);
  const len = Math.max(0, Math.min(7200, Math.round(+url.searchParams.get("len") || 0)));
  if (!title.trim()) return json({ error: "Which song?" }, 400, headers);
  /* one cache entry per song, whoever asks (the length only reorders, so it's left out of the key) */
  const key = new Request(`https://cache.tabs-youtube/find?a=${encodeURIComponent(plain(artist))}&t=${encodeURIComponent(plain(title))}`);
  const hit = cache && await cache.match(key);
  if (hit) { const { items } = await hit.json(); return json({ items: rank(items, { artist, title, len }), cached: true }, 200, headers); }
  try {
    const items = await find(env, { artist, title, len });
    if (cache) await cache.put(key, new Response(JSON.stringify({ items }), { headers: { "cache-control": `max-age=${KEEP_DAYS * 86400}` } }));
    return json({ items }, 200, headers);
  } catch (e) { return json({ error: e.message }, 502, headers); }
}

export default { fetch: (request, env) => handle(request, env) };
