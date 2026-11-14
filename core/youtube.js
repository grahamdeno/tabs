// Play along on YouTube (4.96.0, docs/YOUTUBE-PLAN.md): the pure parts, unit tested.
/* a video id from anything Graham might paste: youtu.be, watch?v=, shorts, embed, music.youtube.com, or the id */
export function ytId(s) {
  const t = String(s || "").trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  let u;
  try { u = new URL(t); } catch { return ""; }
  if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(u.hostname)) return "";
  const id = u.hostname.toLowerCase().endsWith("youtu.be") ? u.pathname.slice(1).split("/")[0]
    : u.searchParams.get("v") || (/^\/(shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname) || [])[2] || "";
  return /^[\w-]{11}$/.test(id) ? id : "";
}
/* a song's YouTube video, tidied for saving: { id, title?, channel?, secs?, start? } */
export function cleanYt(y) {
  if (!y || typeof y !== "object" || !/^[\w-]{11}$/.test(y.id || "")) return null;
  const out = { id: y.id };
  if (typeof y.title === "string" && y.title.trim()) out.title = y.title.trim().slice(0, 200);
  if (typeof y.channel === "string" && y.channel.trim()) out.channel = y.channel.trim().slice(0, 100);
  if (+y.secs > 0 && +y.secs < 7200) out.secs = Math.round(+y.secs);
  if (+y.start > 0 && +y.start <= 600) out.start = Math.round(+y.start * 10) / 10;
  return out;
}
/* where the song is in the video, from where it is in the song (and back): the video can start later (an intro) */
export const ytAt = (y, songSec) => Math.max(0, songSec + (y?.start || 0));
export const ytSong = (y, videoSec) => videoSec - (y?.start || 0);
/* a video's length against the recording's: within 2 seconds, it's the same recording and needs no lining up */
export const ytMatches = (y, recSecs) => !!(y?.secs && recSecs && Math.abs(y.secs - recSecs) <= 2);
