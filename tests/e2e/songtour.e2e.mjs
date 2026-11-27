// Song tours (5.9.0) and their play-along rounds (5.10.0): a tour built from one song, after each finished skill tour. The songs and words are invented.
// AI and LRCLIB are mocked with page.route; nothing here reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, until, useBrowser, settled, FAKE_MIC } from "./harness.mjs";
useBrowser();

const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "retry-after" };
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"];
const DONE = Object.fromEntries([...OPEN.map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }]), ["k:open", { n: 1, best: 0, at: 6 }]]);
const lib = (extra = {}, songs = []) => ({ ...LIB, songs: [...LIB.songs, ...songs], skills: { done: { ...DONE }, last: 6 }, ...extra });
const PIER = { title: "Pier Lights", artist: "The Cape Fear", chords: ["G", "D", "Bm", "F"] };
const TOOMANY = { title: "Too Many", artist: "X", chords: ["G", "Bm", "F", "Dm", "Gm", "Cm"] };
const ONE = { title: "Only One", artist: "X", chords: ["G", "D", "Bm"] };
const CHART = { found: true, title: PIER.title, artist: PIER.artist, album: "Harbor", duration: 120, key: "G", capo: 0, tuning: "standard", bpm: 100, strum: "D DU UDU",
  sections: [{ name: "Verse", chords: "G D Bm F", repeat: 1 }, { name: "Chorus", chords: "G D Bm F", repeat: 1 }], confidence: "high" };
const WORDS = { id: 7, trackName: PIER.title, artistName: PIER.artist, albumName: "Harbor", duration: 120, instrumental: false, plainLyrics: "grey boats lean on the wall\nwaiting on a tide\n\nbring the lights home\nbring them round", syncedLyrics: "[00:01.00] x" };

/* The AI: a pick prompt gets the next reply from `picks`; the chart prompt gets CHART; placing gets nothing. */
async function mockAI(page, picks, { chart = CHART } = {}) {
  const calls = { pick: [], chart: 0 };
  await page.route(/api\.anthropic\.com/, r => {
    const body = JSON.parse(r.request().postData() || "{}"), sys = body.system || "";
    let text;
    if (/2 to 4 chords they don't play/.test(sys)) { calls.pick.push({ sys, content: JSON.stringify(body.messages?.[0]?.content || "") }); text = JSON.stringify({ songs: picks[Math.min(calls.pick.length - 1, picks.length - 1)] }); }
    else if (/You place a song's chords/.test(sys)) text = JSON.stringify({ found: false });
    else { calls.chart++; text = JSON.stringify(chart); }
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }) });
  });
  return calls;
}
async function mockWords(page, found = true) {
  const seen = [];
  await page.route(/lrclib\.net\/api\/search/, r => { seen.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(found ? [WORDS] : []) }); });
  await page.route(/itunes\.apple\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [] }) }));
  return seen;
}
async function home(t, library, { key = true, picks = [[PIER]], opts = {} } = {}) {
  const page = await phone(t, library, { home: true, ...opts });
  if (key) await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  const calls = await mockAI(page, picks);
  const seen = await mockWords(page);
  await page.reload(); await page.waitForSelector("#rd-path"); await settled(page);
  return { page, calls, seen };
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
const sub = page => page.evaluate(() => document.querySelector('.rn-lat[data-title="Song tour"]')?.dataset.sub || "");
const stopIds = page => page.evaluate(() => [...document.querySelectorAll(".rn-stop")].map(b => b.dataset.stop));

test("story 1: after a finished skill tour the next neck is the Song tour with the picked song and its round stops", { skip: skip() }, async t => {
  const { page, calls } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  assert.match(await sub(page), /Pier Lights/);
  assert.deepEqual((await stopIds(page)).filter(id => /^[rh]:open|^c:(Bm|F)$/.test(id)), ["r:open-1", "r:open-2", "c:Bm", "r:open-3", "c:F", "r:open-4", "h:open"]);
  assert.equal(calls.pick.length, 1, "one quiet pick");
  assert.equal(await page.getAttribute('.rn-stop[data-stop="r:open-1"]', "data-kind"), "round");
  assert.match(await page.getAttribute('.rn-stop[data-stop="r:open-1"]', "aria-label"), /Round 1/, "every stop has a spoken name and state");
  assert.equal(await page.locator('.rn-stop[data-stop^="p:"], .rn-stop[data-stop^="s:"][data-stop*="open"]').count(), 0, "no 5.9.0 play stops");
  await page.reload(); await page.waitForSelector('.rn-stop[data-stop="r:open-1"]'); await settled(page);
  assert.ok(await page.locator('.rn-stop.cur[data-stop="r:open-1"]').count(), "resumes at the same stop");
  assert.equal(calls.pick.length, 1, "no second pick after coming back");
});

test("story 1: an unfinished song tour never holds the next skill tour back", { skip: skip() }, async t => {
  const { page } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  const first = await page.evaluate(() => document.querySelector('.rn-stop[data-stop="s:G-C"]')?.className || "");
  assert.match(first, /\bopen\b/, "Chord switches' first stop is open to play");
  assert.doesNotMatch(first, /locked/);
});

test("story 2: the pick is asked for with the rules, the genre, favourites and Songbook artists; the AI never returns lyrics", { skip: skip() }, async t => {
  const { calls } = await home(t, lib({ me: { genre: "country", who: "w" } }, [{ id: "f", title: "Fav Song", artist: "Hank Test", key: "G", format: "chords", body: "G C", favorite: true }]));
  await until(() => calls.pick.length > 0);
  assert.match(calls.pick[0].sys, /2 to 4 chords/);
  assert.match(calls.pick[0].sys, /No lyrics/, "the Play next prompt it reuses says no lyrics");
  assert.match(calls.pick[0].content, /My genre: country/);
  assert.match(calls.pick[0].content, /My favourites: Fav Song/);
  assert.match(calls.pick[0].content, /Hank Test/);
});

test("story 2: a pick with more than four new chords, or only one, is rejected; the next that fits is taken", { skip: skip() }, async t => {
  const { page } = await home(t, lib(), { picks: [[TOOMANY, ONE, PIER]] });
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  assert.match(await sub(page), /Pier Lights/);
});

test("story 2: Swap loads a new pick under the same rules and earlier picks are not offered again", { skip: skip() }, async t => {
  const NEXT = { title: "Harbour Two", artist: "Pier Nine", chords: ["G", "C", "Dm", "F"] };
  const { page, calls } = await home(t, lib(), { picks: [[PIER], [PIER, NEXT]] });
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop [data-tourswap]");
  assert.ok((await page.locator(".rd-pop [data-tourswap]").boundingBox()).height >= 44, "44 px target");
  await page.click(".rd-pop [data-tourswap]");
  await page.waitForFunction(() => /Harbour Two/.test(document.querySelector('.rn-lat[data-title="Song tour"]')?.dataset.sub || ""));
  assert.equal(calls.pick.length, 2);
  assert.match(calls.pick[1].content, /Already tried: pier lights\|the cape fear/, "the earlier pick goes along");
  assert.match(calls.pick[1].sys, /2 to 4 chords/, "the same rules");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour?.legs?.open?.pick?.title === "Harbour Two"); /* saves land after the screen changes */
  assert.deepEqual((await stored(page)).songTour.legs.open.skipped, ["pier lights|the cape fear"]);
});

test("story 2: no key, a Songbook song that fits is the pick, with no AI call", { skip: skip() }, async t => {
  const fits = { id: "fit", title: "Songbook Fit", artist: "Me", key: "G", format: "chords", body: "G  D  Bm  F\nla la la la" };
  const { page, calls } = await home(t, lib({}, [fits]), { key: false });
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  assert.match(await sub(page), /Songbook Fit/);
  assert.equal(calls.pick.length + calls.chart, 0);
  assert.equal((await stored(page)).songTour.legs.open.song, "fit");
});

test("story 2: no key and nothing fits, the song tour is skipped and the tour carries on", { skip: skip() }, async t => {
  const { page } = await home(t, lib(), { key: false });
  await page.waitForSelector('.rn-stop[data-stop="s:G-C"]');
  assert.equal(await page.locator('.rn-lat[data-title="Song tour"]').count(), 0);
  assert.equal((await stored(page)).songTour, undefined);
});

test("story 2: offline, the card says it needs a connection and offers Try again; the rest of the tour stays", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { home: true });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  let offline = true; const calls = { pick: [] };
  await page.route(/api\.anthropic\.com/, r => {
    if (offline) return r.abort("failed");
    calls.pick.push(1);
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ songs: [PIER] }) }], stop_reason: "end_turn" }) });
  });
  await page.reload(); await page.waitForSelector(".rd-tourfind .rd-retry", { timeout: 15000 });
  assert.match(await page.innerText(".rd-tourfind"), /needs a connection/);
  assert.ok(await page.locator('.rn-stop[data-stop="s:G-C"]').count(), "nothing else on the tour is held up");
  assert.ok((await page.locator(".rd-retry").boundingBox()).height >= 44);
  offline = false; await page.click(".rd-retry");
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  assert.equal(calls.pick.length, 1);
});

test("story 3: Get it runs the Get the song flow with the title and artist and saves the song as Learning", { skip: skip() }, async t => {
  const { page, seen } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.equal((await page.innerText(".rd-pop .rd-start")).trim(), "GET IT");
  await page.click(".rd-pop .rd-start");
  await page.waitForSelector("#gs-add", { timeout: 15000 });
  assert.ok(seen.some(u => /Pier%20Lights|Pier\+Lights/i.test(u)), "the title and artist are filled in");
  await page.click("#gs-add");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour?.legs?.open?.song);
  const d = await stored(page), song = d.songs.find(s => s.id === d.songTour.legs.open.song);
  assert.equal(song.title, "Pier Lights");
  assert.equal(song.status, "learning");
  assert.deepEqual(d.songTour.legs.open.pick.new, ["Bm", "F"], "the new chords are the sheet's own");
});

test("story 3: when the words can't be found, Louie moves to the next pick and says so", { skip: skip() }, async t => {
  const NEXT = { title: "Harbour Two", artist: "Pier Nine", chords: ["G", "C", "Dm", "F"] };
  const page = await phone(t, lib(), { home: true });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  const calls = await mockAI(page, [[PIER], [PIER, NEXT]], { chart: { found: false } });
  await mockWords(page, false);
  await page.reload(); await page.waitForSelector('.rn-stop[data-stop="r:open-1"]'); await settled(page);
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.click(".rd-pop .rd-start");
  await page.waitForFunction(() => /Louie is picking another/.test(document.body.innerText), null, { timeout: 20000 });
  await page.waitForFunction(() => /Harbour Two/.test(document.querySelector('.rn-lat[data-title="Song tour"]')?.dataset.sub || ""), null, { timeout: 20000 });
  assert.equal(calls.pick.length, 2);
});

const SEEDED = (extra = {}, song = {}) => lib({ songTour: { v: 1, legs: { open: { pick: { title: "Pier Lights", artist: "The Cape Fear", chords: ["G", "Bm", "F"], new: ["Bm", "F"] }, song: "pier", skipped: [], done: [], ...extra } } } },
  [{ id: "pier", title: "Pier Lights", artist: "The Cape Fear", key: "G", format: "chords", status: "learning", duration: 14, bpm: 200, body: "[Verse]\nG        Bm\nGrey boats lean on the wall\nF        G\nWaiting on a tide\n\n[Chorus]\nBm       F\nBring the lights home\nG        G\nBring them round", ...song }]);
const withLessons = d => { for (const id of ["c:Bm", "c:F"]) d.skills.done[id] = { n: 1, best: 0, at: 9 }; return d; };
const mic = { prepare: page => page.addInitScript(FAKE_MIC) };
/* the pretend guitar plays the chord Louie is asking for */
const HZ = { G: [98, 123.47, 146.83, 196, 246.94, 392], Bm: [123.47, 185, 246.94, 293.66, 369.99, 493.88], F: [87.31, 130.81, 174.61, 220, 261.63, 349.23], Em: [82.41, 123.47, 164.81, 196, 246.94, 329.63] };
const follow = (page, fixed) => page.evaluate(([hz, fixed]) => { clearInterval(window.__follow); window.__follow = setInterval(() => { const n = fixed || (document.querySelector(".rnd-now")?.textContent || "").trim(); window.__chord = hz[n] || []; }, 15); }, [HZ, fixed || ""]);
const open = async page => { await page.click("#rn-now-start"); await page.waitForSelector("#round .rnd-hw"); await settled(page); };
const card = page => page.waitForFunction(() => { const c = document.querySelector("#round .rnd-card"); return c && !c.hidden && c.innerText.trim(); }, null, { timeout: 60000 }).then(() => page.innerText("#round .rnd-card"));
const done = async page => (await stored(page)).songTour.legs.open.done;

test("rounds: Round 1 opens a highway with a count-in, your chord's strums, a rest for each other bar, the shape and what is next", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page);
  assert.equal(await page.locator("#round .rnd-blk").count(), 8, "four strums in each of the two G bars");
  assert.equal(await page.locator("#round .rnd-arr").count(), 8, "a down arrow on each");
  assert.equal(await page.locator("#round .rnd-rest").count(), 2, "Bm and F are rests");
  assert.match(await page.innerText("#round .rnd-rest"), /rest/i);
  assert.equal(await page.locator("#round .rnd-str").count(), 6, "six strings");
  assert.ok(await page.locator("#round .rnd-line").count(), "the teal line");
  assert.match(await page.innerText("#round .rnd-ti"), /Round 1.*Just G|Just G/s);
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.6x", "the first time starts at 0.6x");
  assert.equal(await page.locator("#round .rnd-nm").count(), await page.locator("#round .rnd-blk").count(), "5.15.0: every strum names its chord");
  assert.match(await page.innerText("#round .rnd-rest >> nth=0"), /Rest, listen\s*Bm/, "5.15.0: a rest says listen and names the chord");
  await page.waitForFunction(() => /Rest for Bm|Next/.test(document.querySelector("#round .rnd-next")?.textContent || ""), null, { timeout: 15000 });
  assert.match(await page.innerText("#round .rnd-next"), /Rest for Bm, back on G in \d|Next: G/);
  await page.waitForFunction(() => document.querySelector("#round .rnd-say")?.textContent.trim(), null, { timeout: 15000 });
  assert.equal(await page.getAttribute("#round .rnd-say", "aria-live"), "polite", "VoiceOver reads the chord and what is next, once per bar");
  const small = await page.evaluate(() => [...document.querySelectorAll("#round button")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).map(b => b.textContent + b.ariaLabel));
  assert.deepEqual(small, [], "every control is at least 44 px");
  assert.equal(await page.evaluate(() => document.getElementById("app").inert), true, "the page behind is out of reach");
  await page.click('#round [data-rnd="close"]');
  await page.waitForSelector("#round", { state: "detached" });
  assert.deepEqual(await done(page), [], "closing counts nothing");
});

test("rounds: a strum heard on the chord passes the round, the card says what Louie heard, and Next and Play it again are there", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false, opts: mic });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page); await follow(page);
  const text = await card(page);
  assert.match(text, /Louie heard (\d+) of 8/);
  assert.ok(+/heard (\d+)/.exec(text)[1] >= 6, "at least 3 in 4: " + text);
  assert.match(text, /Next/); assert.match(text, /Play it again/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour.legs.open.done.includes("r:open-1"));
  assert.deepEqual(await done(page), ["r:open-1"]);
  assert.equal((await stored(page)).songs.find(s => s.id === "pier").status, "learning", "no fans, no status change for a round");
  await page.click('#round [data-rnd="again"]');
  await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden);
  assert.deepEqual(await done(page), ["r:open-1"], "playing it again takes nothing away");
});

test("rounds: the wrong chord is not heard, the round does not count, and Play it again is the main button", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false, opts: mic });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page); await follow(page, "Em");
  const text = await card(page);
  assert.match(text, /Louie heard \d of 8/);
  assert.match(text, /Play it again/);
  assert.match(text, /Nothing is lost/);
  assert.deepEqual(await done(page), []);
  assert.match(await page.getAttribute("#round .rnd-card .rnd-main, #round .rnd-card button", "data-rnd"), /again/);
});

test("rounds: with the mic off a round counts when it is played through, and the card says Louie wasn't listening", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page);
  assert.match(await card(page), /Louie wasn't listening/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour.legs.open.done.includes("r:open-1"));
});

test("rounds: Round 2 adds the next chord; a finished round plays at 100% the next time; speed buttons change the pace", { skip: skip() }, async t => {
  const d = SEEDED({ done: ["r:open-1"] }); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page);
  assert.equal(await page.locator("#round .rnd-rest").count(), 1, "G and Bm are played, F rests");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.6x");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.8x", "5.15.0: one tap, one step");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 1.0x");
  await page.click('#round [data-rnd="close"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.match(await page.innerText(".rd-pop .rd-start"), /PLAY IT AGAIN/i);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 1.0x", "played through once: 100%");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.6x", "after 1.0x it goes back to 0.6x");
});

test("rounds: the chord lesson comes before the round that needs it, and opens", { skip: skip() }, async t => {
  const d = SEEDED({ done: ["r:open-1"] });
  const { page } = await home(t, d, { key: false });
  await page.waitForSelector('.rn-stop[data-stop="c:Bm"]', { state: "attached" });
  const ids = await stopIds(page);
  assert.ok(ids.indexOf("c:Bm") < ids.indexOf("r:open-2"), "Bm is taught before Round 2");
  await page.click("#rn-now-start");
  await page.waitForFunction(() => /Bm chord/.test(document.querySelector("h1.title")?.innerText || ""));
});

test("rounds (5.16.0): a YouTube recording plays that part at every speed, slowed to 0.5x and 0.75x; Speed steps 0.5x, 0.75x, 1.0x", { skip: skip() }, async t => {
  const STUB = `window.__yt = { calls: [] };
window.YT = { Player: class { constructor(id, o) { const el = document.getElementById(id), f = document.createElement("iframe"); el.replaceWith(f); this.o = o; this.t = 0; this.state = -1; this.base = 0; this.rate = 1; window.__yt.player = this; setTimeout(() => o.events.onReady({ target: this }), 30); }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); }
  cueVideoById(id) { window.__yt.calls.push("cue"); this.set(5); } loadVideoById() { window.__yt.calls.push("load"); this.set(5); }
  playVideo() { window.__yt.calls.push("play"); this.base = performance.now(); this.set(1); } pauseVideo() { window.__yt.calls.push("pause"); this.t = this.getCurrentTime(); this.set(2); }
  seekTo(s) { window.__yt.calls.push("seek " + Math.round(s)); this.t = s; this.base = performance.now(); } setPlaybackRate(r) { window.__yt.calls.push("rate " + r); this.rate = r; }
  getCurrentTime() { return this.state === 1 ? this.t + this.rate * (performance.now() - this.base) / 1000 : this.t; } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] }, bpm: 100 };
  const d = SEEDED({ done: ["r:open-1"] }, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 }; d.skills.done["c:F"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB })) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page);
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.5x", "the first time: the slowest YouTube speed");
  await page.waitForFunction(() => (window.__yt?.calls || []).some(c => /^seek/.test(c)), null, { timeout: 15000 });
  const calls = await page.evaluate(() => window.__yt.calls);
  const seek = +calls.find(c => /^seek/.test(c)).split(" ")[1];
  assert.ok(seek >= 6 && seek <= 10, "the recording starts at the part: " + seek);
  assert.ok(calls.includes("rate 0.5") && calls.includes("play"), "it plays slowed to 0.5x: " + calls);
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.75x");
  await page.waitForFunction(() => window.__yt.calls.includes("rate 0.75"), null, { timeout: 15000 });
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 1.0x");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.5x", "then back to 0.5x");
});

test("rounds (5.16.0): with no recording, Louie's band strums each bar's chord, the rests too", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false, opts: { prepare: pg => pg.addInitScript(() => { window.__osc = []; const C = window.AudioContext || window.webkitAudioContext; const make = C.prototype.createOscillator; C.prototype.createOscillator = function () { const o = make.call(this); window.__osc.push(o); return o; }; }) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page);
  await page.waitForFunction(() => document.querySelector("#round .rnd-now")?.textContent.trim() === "Rest", null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const hz = await page.evaluate(() => [...new Set(window.__osc.map(o => Math.round(o.frequency.value)))]);
  assert.ok(hz.includes(185) || hz.includes(294) || hz.includes(370), "Bm, a rest bar, sounds too (its F# or D): " + hz.slice(0, 30));
});

test("rounds: the headline plays the whole song with every chord; when it passes the song is Solid and its chords are known", { skip: skip() }, async t => {
  const d = withLessons(SEEDED({ done: ["r:open-1", "r:open-2", "r:open-3"] })); d.settings = { ...d.settings };
  const { page } = await home(t, d, { key: false, opts: mic });
  await page.waitForSelector('.rn-stop.cur[data-stop="h:open"]');
  await open(page);
  assert.equal(await page.locator("#round .rnd-rest").count(), 0, "every chord is played");
  await follow(page); /* 60% at 200 bpm: a beat every half second, the same as the pretend guitar strums */
  /* the pretend guitar is a real-time loop: on a busy machine a pass can miss, so Play it again up to twice (the card never penalises) */
  for (let k = 0; k < 4; k++) {
    assert.match(await card(page), /Louie heard/);
    if (await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "pier").status === "solid")) break;
    if (k < 3) { await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden); }
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "pier").status === "solid", null, { timeout: 5000 });
  const after = await stored(page);
  assert.equal(after.songTour.legs.open.solid, true);
  assert.ok(after.skills.done["c:Bm"] && after.skills.done["c:F"], "its chords count as known");
});

const spyMic = pg => pg.addInitScript(() => { window.__mic = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = c => { window.__mic.push(c.audio); return g(c); }; });
const YT_STUB = `window.__yt = { calls: [] };
window.YT = { Player: class { constructor(id, o) { const el = document.getElementById(id), f = document.createElement("iframe"); el.replaceWith(f); this.o = o; this.t = 0; this.state = -1; window.__yt.player = this; setTimeout(() => o.events.onReady({ target: this }), 30); }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); } cueVideoById() { this.set(5); } loadVideoById() { this.set(5); }
  playVideo() { this.base = performance.now(); this.set(1); } pauseVideo() { this.set(2); } seekTo(s) { this.t = s; this.base = performance.now(); } setPlaybackRate() {}
  getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;

test("rounds (5.16.0): the mic cancels the speaker's echo for the recording and for Louie's band, since both play the chords", { skip: skip() }, async t => {
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] } };
  const d = SEEDED({ done: ["r:open-1"] }, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: async pg => { await pg.addInitScript(FAKE_MIC); await spyMic(pg); await pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: YT_STUB })); } } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page); /* the first time: 0.5x, the YouTube recording slowed */
  assert.deepEqual(await page.evaluate(() => window.__mic.at(-1)), { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, "the slowed recording cancels the echo");
  await page.click("#round .rnd-speed"); await page.click("#round .rnd-speed"); /* 1.0x with the recording */
  await page.waitForFunction(() => window.__mic.length >= 2);
  assert.deepEqual(await page.evaluate(() => window.__mic.at(-1)), { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, "the recording round cancels the echo");
  /* a replay at 100% opened straight from the tap asks the same way, before anything is awaited */
  await page.click('#round [data-rnd="close"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop .rd-start");
  const n = await page.evaluate(() => window.__mic.length);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  assert.equal(await page.evaluate(n => window.__mic.length > n && JSON.stringify(window.__mic.at(-1)), n), JSON.stringify({ echoCancellation: true, noiseSuppression: false, autoGainControl: false }));
});

test("rounds: a passed round adds practice time, fans and a show for the month, and the stop card shows the fans", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.match(await page.innerText(".rd-pop"), /\+5 fans/, "the +fans line is back");
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  const before = await stored(page);
  assert.match(await card(page), /\+5 fans/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour.legs.open.done.includes("r:open-1"));
  const after = await stored(page), ym = new Date().toISOString().slice(0, 7);
  const m = after.journal.months[ym];
  assert.ok((m.psecs || 0) > 0 && m.rounds === 1, JSON.stringify(m));
  assert.ok((after.journal.secs || 0) > (before.journal?.secs || 0), "time on guitar");
});

test("listening: songs and Gigs never open the mic; only a round does", { skip: skip() }, async t => {
  const d = SEEDED(); d.settings = { ...d.settings, plainPlay: false, countIn: false };
  const { page } = await home(t, d, { key: false, opts: { prepare: async pg => { await pg.addInitScript(() => { window.__mics = 0; const g = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices); if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = (...a) => { window.__mics++; return g ? g(...a) : Promise.reject(new Error("none")); }; }); } } });
  await page.evaluate(() => { location.hash = "#/song/pier"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play"); await page.waitForTimeout(1500); /* real timer: the song plays */
  assert.equal(await page.evaluate(() => window.__mics), 0, "playing a song never asks for the mic");
  await page.evaluate(() => { location.hash = ""; }); await page.waitForSelector("#rd-path"); await settled(page);
  await open(page);
  await page.waitForFunction(() => window.__mics > 0, null, { timeout: 5000 });
});

test("story 5: a chord lesson opens for any chord", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { home: true });
  await page.evaluate(h => { location.hash = h; }, "#/practice/" + encodeURIComponent("c:Bm"));
  await page.waitForFunction(() => /Bm chord/.test(document.querySelector("h1.title")?.innerText || ""));
});

test("data: a backup carries the song tour, a backup from before 5.9.0 restores, and a 5.9.0 tour in progress starts at Round 1", { skip: skip() }, async t => {
  const page = await phone(t, SEEDED({ done: ["p:open-0", "c:Bm"] }), { home: true });
  await page.waitForSelector('.rn-stop[data-stop="r:open-1"]'); await settled(page);
  assert.ok(await page.locator('.rn-stop.cur[data-stop="r:open-1"]').count(), "5.9.0 play stops are ignored; it starts at Round 1");
  const file = await stored(page);
  assert.equal(file.songTour.legs.open.song, "pier");
  assert.equal(file.songTour.legs.open.pick.title, "Pier Lights", "it keeps its pick and song");
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); delete d.songTour; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.reload(); await page.waitForSelector("#rd-path");
  assert.equal(await page.locator("#rd-path").count(), 1, "a library without the field loads");
});

test("inclusive: the song tour card, stops and the highway hold at 320 px, in Light and Dark, with big text", { skip: skip() }, async t => {
  for (const scheme of ["light", "dark"]) {
    const { page } = await home(t, SEEDED(), { key: false, opts: { viewport: { width: 320, height: 640 }, colorScheme: scheme } });
    await page.waitForSelector('.rn-stop[data-stop="r:open-1"]');
    const small = await page.evaluate(() => [...document.querySelectorAll(".rn-stop")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).length);
    assert.equal(small, 0, `${scheme}: stops are 44 px`);
    await page.evaluate(() => { document.documentElement.style.fontSize = "160%"; });
    await open(page);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.querySelector("#round").scrollWidth > innerWidth + 1);
    assert.equal(over, false, `${scheme}: no sideways scroll`);
    const tiny = await page.evaluate(() => [...document.querySelectorAll("#round button")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).length);
    assert.equal(tiny, 0, `${scheme}: highway controls are 44 px`);
    assert.ok(await page.evaluate(() => { const b = document.querySelector("#round .rnd-pause").getBoundingClientRect(); return b.bottom <= innerHeight + 1; }), `${scheme}: Pause is on screen`);
  }
});

test("5.10.1 rounds: on its side Pause is on top and answers; the line sits near a third across; the gold fret is between bars", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false, opts: { viewport: { width: 844, height: 390 } } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
  await open(page);
  const hit = await page.evaluate(() => { const b = document.querySelector('#round [data-rnd="pause"]'), r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-rnd]")?.dataset.rnd || ""; });
  assert.equal(hit, "pause", "nothing covers Pause");
  await page.click('#round [data-rnd="pause"]');
  await page.waitForFunction(() => document.querySelector('#round [data-rnd="pause"]').ariaLabel === "Play");
  const at = await page.evaluate(() => { const hw = document.querySelector("#round .rnd-hw").getBoundingClientRect(), l = document.querySelector("#round .rnd-line").getBoundingClientRect(); return (l.left - hw.left) / hw.width; });
  assert.ok(at > 0.19 && at < 0.25, `5.14.0: the line is near 22% across, over the chord shape side (${at})`);
  const gap = await page.evaluate(() => { const b = [...document.querySelectorAll("#round .rnd-blk")].map(x => x.getBoundingClientRect().left); return b[1] - b[0]; });
  assert.ok(gap >= 50, `strums are spread out (${gap} px)`);
});

/* 5.15.0 the round screen (Graham, 2026-11-27): a chord name on every strum, Now and Next, and Speed, Pause and Restart
   on screen at every size, upright and on its side */
test("5.15.0 rounds: Speed, Pause and Restart sit on the screen at every size, chord names read at 4.5:1, and the result card shows", { skip: skip() }, async t => {
  const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  for (const [width, height] of [[667, 375], [932, 430], [320, 568], [430, 932]]) {
    const { page } = await home(t, SEEDED(), { key: false, opts: { viewport: { width, height } } });
    await page.waitForSelector('.rn-stop.cur[data-stop="r:open-1"]');
    await open(page);
    const r = await page.evaluate(() => ["rnd-speed", "rnd-pause", "rnd-again"].map(c => { const b = document.querySelector("#round ." + c).getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("button"); return { c, in: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, w: b.width, h: b.height, hit: hit?.classList.contains(c) }; }));
    for (const x of r) { assert.ok(x.in, `${width}×${height}: ${x.c} is on the screen`); assert.ok(x.hit, `${width}×${height}: nothing covers ${x.c}`); assert.ok(x.w >= 44 && x.h >= 44, `${x.c} is a 44 px target`); }
    const nm = await page.evaluate(() => { const e = document.querySelector("#round .rnd-nm"), c = getComputedStyle(e); return [c.color, c.backgroundColor]; });
    const [a, b] = nm.map(lum).sort((p, q) => q - p);
    assert.ok((a + .05) / (b + .05) >= 4.5, `chord names read at ${((a + .05) / (b + .05)).toFixed(1)}:1`);
    assert.match(await page.innerText("#round .rnd-pause + span"), /Pause/, "Pause says its name under it");
    await page.click("#round .rnd-pause");
    assert.match(await page.innerText("#round .rnd-pause + span"), /Play/);
    if (width === 667) { /* the round played through: the result card is on the screen with its buttons */
      await page.click("#round .rnd-pause");
      await page.waitForSelector("#round .rnd-card:not([hidden])", { timeout: 60000 });
      const c = await page.evaluate(() => { const b = document.querySelector("#round .rnd-card .btn").getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
      assert.ok(c, "the result card's button is on the screen");
    }
  }
});

/* 5.16.0 drills on the neck (Graham, 2026-11-27) */
test("5.16.0 a change drill runs on the neck: two bars each, a bar each, every two beats; Speed is the tempo; at the target it's done", { skip: skip() }, async t => {
  const d = SEEDED(); d.skills.done["s:C-F"] = { n: 1, best: 70, at: 9 };
  const { page } = await home(t, d, { key: false }); /* no microphone: played through counts (the chord check is the rounds' own, tested above) */
  await page.evaluate(() => { location.hash = "#/practice/s:C-F"; }); await page.waitForSelector("#pk-start");
  assert.match(await page.innerText("#pk-start"), /Start on the neck/);
  await page.click("#pk-start"); await page.waitForSelector("#round .rnd-hw");
  assert.match(await page.innerText("#round .rnd-ti"), /DRILL · 70 BPM[\s\S]*C to F/);
  assert.equal(await page.locator("#round .rnd-blk").count(), 8 * 4 + 4 * 2, "40 strums: 8 bars of four, then 4 of two");
  assert.equal(await page.locator("#round .rnd-rest").count(), 0, "no rests in a drill");
  assert.deepEqual(await page.$$eval("#round .rnd-nm", e => [...new Set(e.map(x => x.textContent))]), ["C", "F"], "every strum names C or F");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 70 BPM", "the best so far");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 80 BPM", "one step up: the target");
  await page.waitForSelector("#pk-next", { timeout: 120000 }); /* real timer: 40 beats at 80 BPM, slower on a busy machine */
  assert.match(await page.innerText(".rd-first-t"), /Played through at 80 BPM/);
  /* saves land after the screen changes: wait on the saved value */
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).skills?.done?.["s:C-F"]?.best === 80, null, { timeout: 5000 });
});

test("5.16.0 below the target, a passed drill offers the next tempo; I got it still marks it", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false });
  await page.evaluate(() => { location.hash = "#/practice/s:C-F"; }); await page.waitForSelector("#pk-start");
  await page.click("#pk-start"); await page.waitForSelector("#round .rnd-hw");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 50 BPM");
  await page.click("#round .rnd-self"); await page.waitForSelector("#pk-next");
  assert.match(await page.innerText(".rd-first-t"), /Marked as got/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).skills?.done?.["s:C-F"], null, { timeout: 5000 });
});

test("5.16.3 at 1.0x with the recording the highway moves smoothly, though the recording's clock only moves in quarter seconds", { skip: skip() }, async t => {
  const STEPPY = YT_STUB.replace("getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; }", "getCurrentTime() { const raw = this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; return Math.floor(raw * 4) / 4; }");
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] }, bpm: 100 };
  const d = SEEDED({ done: ["r:open-1"] }, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STEPPY })) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page);
  await page.click("#round .rnd-speed"); await page.click("#round .rnd-speed"); /* 1.0x */
  await page.waitForFunction(() => { const m = /translateX\((-?[\d.]+)px\)/.exec(document.querySelector("#round .rnd-track")?.style.transform || ""); return m && +m[1] < -60; }, null, { timeout: 20000 });
  const xs = await page.evaluate(() => new Promise(ok => { const out = []; const step = () => { const m = /translateX\((-?[\d.]+)px\)/.exec(document.querySelector("#round .rnd-track").style.transform); out.push(+m[1]); if (out.length < 60) requestAnimationFrame(step); else ok(out); }; requestAnimationFrame(step); }));
  const steps = xs.slice(1).map((x, i) => xs[i] - x);
  assert.ok(steps.every(s => s >= -0.5), "it never jumps back: " + steps.map(s => s.toFixed(1)).join(" "));
  const still = steps.filter(s => Math.abs(s) < 0.05).length;
  assert.ok(still < steps.length / 3, `it moves on nearly every frame (${still} of ${steps.length} frames stood still)`);
  const sorted = [...steps].sort((a, b) => a - b), mid = sorted[Math.floor(sorted.length / 2)];
  assert.ok(Math.max(...steps) < Math.max(mid * 4, 4), `no big jumps: largest ${Math.max(...steps).toFixed(1)} px against a typical ${mid.toFixed(1)} px`);
});
