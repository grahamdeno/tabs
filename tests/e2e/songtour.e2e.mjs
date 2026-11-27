// Song tours (5.9.0) and their play-along rounds (5.10.0): a tour built from one song, after each finished skill tour. The songs and words are invented.
// AI and LRCLIB are mocked with page.route; nothing here reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, until, useBrowser, settled, FAKE_MIC } from "./harness.mjs";
useBrowser();

const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "retry-after" };
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"];
const DONE = Object.fromEntries([...OPEN.map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }]), ["k:open", { n: 1, best: 0, at: 6 }]]);
/* 5.17.0: the Tour has a merch box after each tour's third stop; these are opened so a waiting box is never the current stop */
const BOXES = { opened: Array.from({ length: 13 }, (_, i) => `b:t${i + 1}`) };
const lib = (extra = {}, songs = []) => ({ ...LIB, songs: [...LIB.songs, ...songs], skills: { done: { ...DONE }, last: 6 }, boxes: BOXES, ...extra });
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
const STUB_RATE = `window.__yt = { calls: [] };
window.YT = { Player: class { constructor(id, o) { const el = document.getElementById(id), f = document.createElement("iframe"); el.replaceWith(f); this.o = o; this.t = 0; this.state = -1; this.base = 0; this.rate = 1; window.__yt.player = this; setTimeout(() => o.events.onReady({ target: this }), 30); }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); }
  cueVideoById(id) { window.__yt.calls.push("cue"); this.set(5); } loadVideoById() { window.__yt.calls.push("load"); this.set(5); }
  playVideo() { window.__yt.calls.push("play"); this.base = performance.now(); this.set(1); } pauseVideo() { window.__yt.calls.push("pause"); this.t = this.getCurrentTime(); this.set(2); }
  seekTo(s) { window.__yt.calls.push("seek " + Math.round(s)); this.t = s; this.base = performance.now(); } setPlaybackRate(r) { window.__yt.calls.push("rate " + r); this.rate = r; }
  getCurrentTime() { return this.state === 1 ? this.t + this.rate * (performance.now() - this.base) / 1000 : this.t; } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;
const spyMic = pg => pg.addInitScript(() => { window.__mic = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); navigator.mediaDevices.getUserMedia = c => { window.__mic.push(c.audio); return g(c); }; });
const YT_STUB = `window.__yt = { calls: [] };
window.YT = { Player: class { constructor(id, o) { const el = document.getElementById(id), f = document.createElement("iframe"); el.replaceWith(f); this.o = o; this.t = 0; this.state = -1; window.__yt.player = this; setTimeout(() => o.events.onReady({ target: this }), 30); }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); } cueVideoById() { this.set(5); } loadVideoById() { this.set(5); }
  playVideo() { this.base = performance.now(); this.set(1); } pauseVideo() { this.set(2); } seekTo(s) { this.t = s; this.base = performance.now(); } setPlaybackRate() {}
  getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; } destroy() {} } };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;

/* Release B (5.18.0): every stop with no lesson is a piece of the tour's one song. Tour 2 is seeded here: its first four stops are
   done, so the piece k2.5 is the stop to play, and the headline k2.6 follows. The song (A, D and E) is invented. */
const T1 = ["k1.1", "k1.2", "c:Em", "k1.4", "k1.5", "k1.6"], T2 = ["c:A", "c:D", "c:E", "k2.4"];
const SONG = { id: "pier", title: "Pier Lights", artist: "The Cape Fear", key: "A", format: "chords", status: "learning", duration: 14, bpm: 200, body: "[Verse]\nA        D\nGrey boats lean on the wall\nE        A\nWaiting on a tide\n\n[Chorus]\nD        E\nBring the lights home\nA        A\nBring them round" };
const SEEDED = (extra = {}, song = {}, more = []) => {
  const d = lib({ songTour: { v: 1, legs: { t2: { pick: { title: "Pier Lights", artist: "The Cape Fear", chords: ["A", "D", "E"] }, song: "pier", skipped: [], done: [], ...extra } } } }, [{ ...SONG, ...song }]);
  d.curriculum = { v: 1, done: Object.fromEntries([...T1, ...T2, ...more].map(id => [id, 5])) };
  return d;
};
const mic = { prepare: page => page.addInitScript(FAKE_MIC) };
/* the pretend guitar plays the chord Louie is asking for */
const HZ = { A: [110, 164.81, 220, 277.18, 329.63], D: [146.83, 220, 293.66, 369.99], E: [82.41, 123.47, 164.81, 207.65, 246.94, 329.63], C: [130.81, 164.81, 196, 261.63, 329.63] };
const follow = (page, fixed) => page.evaluate(([hz, fixed]) => { clearInterval(window.__follow); window.__follow = setInterval(() => { const n = fixed || (document.querySelector(".rnd-now")?.textContent || "").trim(); window.__chord = hz[n] || []; }, 15); }, [HZ, fixed || ""]);
const open = async page => { await page.click("#rn-now-start"); await page.waitForSelector("#round .rnd-hw"); await settled(page); };
const card = page => page.waitForFunction(() => { const c = document.querySelector("#round .rnd-card"); return c && !c.hidden && c.innerText.trim(); }, null, { timeout: 60000 }).then(() => page.innerText("#round .rnd-card"));
const cur = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum || {});
const home2 = (t, d, opts = {}) => home(t, d, { key: false, ...opts });
const NOW = '.rn-stop.cur[data-stop="k2.5"]';

test("pieces: a piece of the song opens a highway with a count-in, every strum on your chords, no rests, the names and what is next", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED());
  await page.waitForSelector(NOW);
  await open(page);
  assert.ok(await page.locator("#round .rnd-blk").count() >= 4, "strums to play");
  assert.equal(await page.locator("#round .rnd-rest").count(), 0, "every chord is one you play: no rests");
  assert.equal(await page.locator("#round .rnd-nm").count(), await page.locator("#round .rnd-blk").count(), "every strum names its chord");
  assert.equal(await page.locator("#round .rnd-str").count(), 6, "six strings");
  assert.match(await page.innerText("#round .rnd-ti"), /TOUR 2.*PIECE/s);
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.6x", "the first time starts at 0.6x");
  await page.waitForFunction(() => document.querySelector("#round .rnd-say")?.textContent.trim(), null, { timeout: 15000 });
  assert.equal(await page.getAttribute("#round .rnd-say", "aria-live"), "polite");
  const small = await page.evaluate(() => [...document.querySelectorAll("#round button")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).map(b => b.textContent + b.ariaLabel));
  assert.deepEqual(small, [], "every control is at least 44 px");
  assert.equal(await page.evaluate(() => document.getElementById("app").inert), true, "the page behind is out of reach");
  await page.click('#round [data-rnd="close"]');
  await page.waitForSelector("#round", { state: "detached" });
  assert.equal((await cur(page)).done["k2.5"], undefined, "closing counts nothing");
});

test("pieces: strums heard on the chords pass the piece; the card says what Louie heard; it counts once and playing again takes nothing away", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED(), { opts: mic });
  await page.waitForSelector(NOW);
  await open(page); await follow(page);
  const text = await card(page);
  assert.match(text, /Louie heard (\d+) of (\d+)/);
  const [, h, n] = /heard (\d+) of (\d+)/.exec(text);
  assert.ok(+h * 4 >= +n * 3, "at least 3 in 4: " + text);
  assert.match(text, /Play it again/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.done?.["k2.5"]);
  assert.equal((await stored(page)).songs.find(s => s.id === "pier").status, "learning", "a piece does not make the song Solid");
  await page.click('#round [data-rnd="again"]');
  await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden);
  assert.ok((await cur(page)).done["k2.5"], "playing it again takes nothing away");
});

test("pieces: the wrong chord is not heard, the piece does not count, and Play it again is the main button", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED(), { opts: mic });
  await page.waitForSelector(NOW);
  await open(page); await follow(page, "C");
  const text = await card(page);
  assert.match(text, /Louie heard \d+ of \d+/); assert.match(text, /Play it again/); assert.match(text, /Nothing is lost/);
  assert.equal((await cur(page)).done["k2.5"], undefined);
});

test("pieces: with the mic off a piece counts when it is played through, and the card says Louie wasn't listening", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED());
  await page.waitForSelector(NOW);
  await open(page);
  assert.match(await card(page), /Louie wasn't listening/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.done?.["k2.5"]);
});

test("pieces: speed buttons step 0.6x, 0.8x, 1.0x and a finished piece plays at 100% the next time", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED({}, {}, ["k2.5"]));
  await page.waitForSelector('.rn-stop.cur[data-stop="k2.6"]');
  await page.click('.rn-stop[data-stop="k2.5"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.match(await page.innerText(".rd-pop .rd-start"), /PLAY AGAIN/i);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 1.0x", "played through once: 100%");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.6x", "after 1.0x it goes back to 0.6x");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.8x");
});

test("headline: it opens at 0.8x, plays the whole song, and a pass at 0.8x wins the tour without making the song Solid", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED({}, {}, ["k2.5"]), { opts: mic });
  await page.waitForSelector('.rn-stop.cur[data-stop="k2.6"]');
  await open(page);
  assert.match(await page.innerText("#round .rnd-ti"), /HEADLINE/);
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.8x", "a headline starts at 0.8x");
  assert.equal(await page.locator("#round .rnd-rest").count(), 0, "every chord is played");
  await follow(page); const seen = [];
  for (let k = 0; k < 4; k++) { /* the pretend guitar is a real-time loop: on a busy machine a pass can miss, so Play it again (it never penalises) */
    seen.push(await card(page));
    if (await page.evaluate(() => !!JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.won?.t2)) break;
    if (k < 3) { await page.click('#round [data-rnd="again"]'); await page.waitForFunction(() => document.querySelector("#round .rnd-card")?.hidden); }
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.won?.t2, null, { timeout: 5000 }).catch(e => { throw new Error(e.message + " | " + seen.join(" || ")); });
  const after = await stored(page);
  assert.ok(after.curriculum.done["k2.6"], "the headline is done");
  assert.notEqual(after.songs.find(s => s.id === "pier").status, "solid", "0.8x does not make the song Solid");
});

test("pieces: with no recording Louie's band strums each bar's chord", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED(), { opts: { prepare: pg => pg.addInitScript(() => { window.__osc = []; const C = window.AudioContext || window.webkitAudioContext; const make = C.prototype.createOscillator; C.prototype.createOscillator = function () { const o = make.call(this); window.__osc.push(o); return o; }; }) } });
  await page.waitForSelector(NOW);
  await open(page);
  await page.waitForTimeout(2500); /* real timer: the band plays a few bars */
  const hz = await page.evaluate(() => [...new Set(window.__osc.map(o => Math.round(o.frequency.value)))]);
  assert.ok([110, 220, 147, 294, 165, 330].some(f => hz.includes(f)), "the band sounds A, D or E: " + hz.slice(0, 30));
});

test("rounds (5.16.0): a YouTube recording plays the piece slowed to 0.5x and 0.75x; Speed steps 0.5x, 0.75x, 1.0x", { skip: skip() }, async t => {
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] }, bpm: 100 };
  const { page } = await home2(t, SEEDED({}, song), { opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB_RATE })) } });
  await page.waitForSelector(NOW);
  await open(page);
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.5x", "the first time: the slowest YouTube speed");
  await page.waitForFunction(() => (window.__yt?.calls || []).some(c => /^seek/.test(c)), null, { timeout: 15000 });
  const calls = await page.evaluate(() => window.__yt.calls);
  assert.ok(calls.includes("rate 0.5") && calls.includes("play"), "it plays slowed to 0.5x: " + calls);
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.75x");
  await page.waitForFunction(() => window.__yt.calls.includes("rate 0.75"), null, { timeout: 15000 });
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 1.0x");
  await page.click("#round .rnd-speed");
  assert.equal(await page.getAttribute("#round .rnd-speed", "aria-label"), "Speed, 0.5x", "then back to 0.5x");
});

test("rounds (5.16.0): the mic cancels the speaker's echo for the recording and for Louie's band, since both play the chords", { skip: skip() }, async t => {
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] } };
  const { page } = await home2(t, SEEDED({}, song), { opts: { prepare: async pg => { await pg.addInitScript(FAKE_MIC); await spyMic(pg); await pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: YT_STUB })); } } });
  await page.waitForSelector(NOW);
  const EC = { echoCancellation: true, noiseSuppression: false, autoGainControl: false };
  await open(page);
  assert.deepEqual(await page.evaluate(() => window.__mic.at(-1)), EC, "the slowed recording cancels the echo");
  await page.click("#round .rnd-speed"); await page.click("#round .rnd-speed");
  await page.waitForFunction(() => window.__mic.length >= 2);
  assert.deepEqual(await page.evaluate(() => window.__mic.at(-1)), EC, "the recording round cancels the echo");
});

test("pieces: a passed piece adds practice time and a show for the month, and the stop card shows the fans", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED());
  await page.waitForSelector(NOW);
  await page.click('.rn-stop[data-stop="k2.5"]'); await page.waitForSelector(".rd-pop .rd-start");
  assert.match(await page.innerText(".rd-pop"), /\+5 fans/, "the card shows the fans");
  assert.match(await page.innerText(".rd-pop"), /Play a piece of Pier Lights/);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  const before = await stored(page);
  assert.match(await card(page), /That counts|Louie wasn't listening/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.done?.["k2.5"]);
  const after = await stored(page), ym = new Date().toISOString().slice(0, 7), m = after.journal.months[ym];
  assert.ok((m.psecs || 0) > 0 && m.rounds === 1, JSON.stringify(m));
  assert.ok((after.journal.secs || 0) > (before.journal?.secs || 0), "time on guitar");
});

test("listening: songs and Gigs never open the mic; only a round does", { skip: skip() }, async t => {
  const d = SEEDED(); d.settings = { ...d.settings, plainPlay: false, countIn: false };
  const { page } = await home2(t, d, { opts: { prepare: async pg => { await pg.addInitScript(() => { window.__mics = 0; const g = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices); if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = (...a) => { window.__mics++; return g ? g(...a) : Promise.reject(new Error("no")); }; }); } } });
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

test("data: the tour's song and capo ride in a backup, and a library without the field loads", { skip: skip() }, async t => {
  const page = await phone(t, SEEDED({ capo: 2, simplified: true }), { home: true });
  await page.waitForSelector(NOW); await settled(page);
  const file = await stored(page);
  assert.equal(file.songTour.legs.t2.song, "pier");
  assert.equal(file.songTour.legs.t2.capo, 2); assert.equal(file.songTour.legs.t2.simplified, true);
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); delete d.songTour; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.reload(); await page.waitForSelector("#rd-path");
  assert.equal(await page.locator("#rd-path").count(), 1, "a library without the field loads");
});

test("inclusive: the piece stops and the highway hold at 320 px, in Light and Dark, with big text", { skip: skip() }, async t => {
  for (const scheme of ["light", "dark"]) {
    const { page } = await home2(t, SEEDED(), { opts: { viewport: { width: 320, height: 640 }, colorScheme: scheme } });
    await page.waitForSelector(NOW);
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

test("5.10.1 rounds: on its side Pause is on top and answers; the line sits near a third across", { skip: skip() }, async t => {
  const { page } = await home2(t, SEEDED(), { opts: { viewport: { width: 844, height: 390 } } });
  await page.waitForSelector(NOW);
  await open(page);
  const hit = await page.evaluate(() => { const b = document.querySelector('#round [data-rnd="pause"]'), r = b.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-rnd]")?.dataset.rnd || ""; });
  assert.equal(hit, "pause", "nothing covers Pause");
  await page.click('#round [data-rnd="pause"]');
  await page.waitForFunction(() => document.querySelector('#round [data-rnd="pause"]').ariaLabel === "Play");
  const at = await page.evaluate(() => { const hw = document.querySelector("#round .rnd-hw").getBoundingClientRect(), l = document.querySelector("#round .rnd-line").getBoundingClientRect(); return (l.left - hw.left) / hw.width; });
  assert.ok(at > 0.19 && at < 0.25, `the line is near 22% across (${at})`);
});

test("5.15.0 rounds: Speed, Pause and Restart sit on the screen at every size, chord names read at 4.5:1, and the result card shows", { skip: skip() }, async t => {
  const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  for (const [width, height] of [[667, 375], [932, 430], [320, 568], [430, 932]]) {
    const { page } = await home2(t, SEEDED(), { opts: { viewport: { width, height } } });
    await page.waitForSelector(NOW);
    await open(page);
    const r = await page.evaluate(() => ["rnd-speed", "rnd-pause", "rnd-again"].map(c => { const b = document.querySelector("#round ." + c).getBoundingClientRect(); const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest("button"); return { c, in: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, hit: !!hit, w: b.width, h: b.height }; }));
    for (const x of r) { assert.ok(x.in, `${width}×${height}: ${x.c} is on the screen`); assert.ok(x.hit, `${width}×${height}: nothing covers ${x.c}`); assert.ok(x.w >= 44 && x.h >= 44, `${x.c} is a 44 px target`); }
    const nm = await page.evaluate(() => { const e = document.querySelector("#round .rnd-nm"), c = getComputedStyle(e); return [c.color, c.backgroundColor]; });
    const [a, b] = nm.map(lum).sort((p, q) => q - p);
    assert.ok((a + .05) / (b + .05) >= 4.5, `chord names read at ${((a + .05) / (b + .05)).toFixed(1)}:1`);
  }
});

/* 5.16.0 drills on the neck (Graham, 2026-11-27) */
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
  const d = SEEDED({}, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STEPPY })) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="k2.5"]');
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
test("5.17.0 the highway stays smooth when the recording's clock lags and now and then reads nothing", { skip: skip() }, async t => {
  const FLAKY = YT_STUB.replace("getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; }", "getCurrentTime() { const raw = this.state === 1 ? this.t + (performance.now() - this.base) / 1000 : this.t; this.n = (this.n || 0) + 1; return this.n % 9 === 0 ? NaN : Math.floor((raw - (this.n % 5) * 0.04) * 4) / 4; }");
  const song = { yt: { id: "abcdefghijk", title: "Pier Lights", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] }, bpm: 100 };
  const d = SEEDED({}, song); d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false, opts: { prepare: pg => pg.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: FLAKY })) } });
  await page.waitForSelector('.rn-stop.cur[data-stop="k2.5"]');
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
