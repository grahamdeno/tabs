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
  assert.equal(await page.getAttribute('#round [data-speed="0.6"]', "aria-pressed"), "true", "the first time starts at 60%");
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
  assert.equal(await page.getAttribute('#round [data-speed="0.6"]', "aria-pressed"), "true");
  await page.click('#round [data-speed="1"]');
  assert.equal(await page.getAttribute('#round [data-speed="1"]', "aria-pressed"), "true");
  await page.click('#round [data-rnd="close"]');
  await page.click('.rn-stop[data-stop="r:open-1"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.match(await page.innerText(".rd-pop .rd-start"), /PLAY IT AGAIN/i);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  assert.equal(await page.getAttribute('#round [data-speed="1"]', "aria-pressed"), "true", "played through once: 100%");
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

test("rounds: a lined-up recording at 100% plays that part of the recording; Louie's band plays at a slower speed", { skip: skip() }, async t => {
  const STUB = `window.__yt = { calls: [] };
window.YT = { Player: class { constructor(id, o) { const el = document.getElementById(id), f = document.createElement("iframe"); el.replaceWith(f); this.o = o; this.t = 0; this.state = -1; this.base = 0; window.__yt.player = this; setTimeout(() => o.events.onReady({ target: this }), 30); }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); }
  cueVideoById(id) { window.__yt.calls.push("cue"); this.set(5); } loadVideoById() { window.__yt.calls.push("load"); this.set(5); }
  playVideo() { window.__yt.calls.push("play"); this.base = performance.now(); this.set(1); } pauseVideo() { window.__yt.calls.push("pause"); this.t = this.getCurrentTime(); this.set(2); }
  seekTo(s) { window.__yt.calls.push("seek " + Math.round(s)); this.t = s; this.base = performance.now(); } setPlaybackRate() {}
  getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] }, bpm: 100 };
  const d = SEEDED({ done: ["r:open-1"] }, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 }; d.skills.done["c:F"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB })) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page); /* Round 2 at 60% */
  await page.waitForTimeout(3000); /* real timer: the count-in is over */
  assert.equal((await page.evaluate(() => window.__yt?.calls || [])).filter(c => /^play|^seek/.test(c)).length, 0, "at 60% the band plays, not the recording");
  await page.click('#round [data-speed="1"]'); /* restarts at 100% */
  await page.waitForFunction(() => (window.__yt?.calls || []).some(c => /^seek/.test(c)), null, { timeout: 15000 });
  const seek = +(await page.evaluate(() => window.__yt.calls.find(c => /^seek/.test(c)))).split(" ")[1];
  assert.ok(seek >= 6 && seek <= 10, "the recording starts at the part (10 s in, less a moment of lead): " + seek);
  assert.ok((await page.evaluate(() => window.__yt.calls)).includes("play"));
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

test("rounds: the mic cancels echo when the recording plays (100% with a recording), and keeps the plain settings for Louie's band", { skip: skip() }, async t => {
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] } };
  const d = SEEDED({ done: ["r:open-1"] }, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: async pg => { await pg.addInitScript(FAKE_MIC); await spyMic(pg); await pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: YT_STUB })); } } });
  await page.waitForSelector('.rn-stop.cur[data-stop="r:open-2"]');
  await open(page); /* the first time: 60%, Louie's band */
  assert.deepEqual(await page.evaluate(() => window.__mic.at(-1)), { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, "the band keeps the plain settings");
  await page.click('#round [data-speed="1"]'); /* 100% with the recording */
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
