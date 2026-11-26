// Song tours (5.9.0): a tour built from one song, after each finished skill tour. The songs and words are invented.
// AI and LRCLIB are mocked with page.route; nothing here reaches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, until, useBrowser, settled } from "./harness.mjs";
useBrowser();

const cors = { "access-control-allow-origin": "*", "access-control-expose-headers": "retry-after" };
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"];
const DONE = Object.fromEntries([...OPEN.map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }]), ["k:open", { n: 1, best: 0, at: 6 }]]);
const lib = (extra = {}, songs = []) => ({ ...LIB, songs: [...LIB.songs, ...songs], skills: { done: DONE, last: 6 }, ...extra });
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

test("story 1: after a finished skill tour the next neck is the Song tour with the picked song and its stops", { skip: skip() }, async t => {
  const { page, calls } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  assert.match(await sub(page), /Pier Lights/);
  assert.deepEqual((await stopIds(page)).filter(id => /^(p|c|s|h):/.test(id) && /Bm|F|open/.test(id)), ["p:open-0", "c:Bm", "s:D-Bm", "p:open-1", "c:F", "s:Bm-F", "p:open-2", "h:open"]);
  assert.equal(calls.pick.length, 1, "one quiet pick");
  assert.equal(await page.getAttribute('.rn-stop[data-stop="p:open-0"]', "data-kind"), "play");
  assert.match(await page.getAttribute('.rn-stop[data-stop="p:open-0"]', "aria-label"), /Play it now.*your next stop|current/i, "every stop has a spoken name and state");
  /* leave and come back: the same stop is current */
  await page.reload(); await page.waitForSelector('.rn-stop[data-stop="p:open-0"]'); await settled(page);
  assert.ok(await page.locator('.rn-stop.cur[data-stop="p:open-0"]').count(), "resumes at the same stop");
  assert.equal(calls.pick.length, 1, "no second pick after coming back");
});

test("story 1: an unfinished song tour never holds the next skill tour back", { skip: skip() }, async t => {
  const { page } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
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
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  assert.match(await sub(page), /Pier Lights/);
});

test("story 2: Swap loads a new pick under the same rules and earlier picks are not offered again", { skip: skip() }, async t => {
  const NEXT = { title: "Harbour Two", artist: "Pier Nine", chords: ["G", "C", "Dm", "F"] };
  const { page, calls } = await home(t, lib(), { picks: [[PIER], [PIER, NEXT]] });
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  await page.click('.rn-stop[data-stop="p:open-0"]'); await page.waitForSelector(".rd-pop [data-tourswap]");
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
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
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
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  assert.equal(calls.pick.length, 1);
});

test("story 3: Get it runs the Get the song flow with the title and artist and saves the song as Learning", { skip: skip() }, async t => {
  const { page, seen } = await home(t, lib());
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  await page.click('.rn-stop[data-stop="p:open-0"]'); await page.waitForSelector(".rd-pop .rd-start");
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
  await page.reload(); await page.waitForSelector('.rn-stop[data-stop="p:open-0"]'); await settled(page);
  await page.click('.rn-stop[data-stop="p:open-0"]'); await page.click(".rd-pop .rd-start");
  await page.waitForFunction(() => /Louie is picking another/.test(document.body.innerText), null, { timeout: 20000 });
  await page.waitForFunction(() => /Harbour Two/.test(document.querySelector('.rn-lat[data-title="Song tour"]')?.dataset.sub || ""), null, { timeout: 20000 });
  assert.equal(calls.pick.length, 2);
});

const SEEDED = (extra = {}) => lib({ songTour: { v: 1, legs: { open: { pick: { title: "Pier Lights", artist: "The Cape Fear", chords: ["G", "Bm", "F"], new: ["Bm", "F"] }, song: "pier", skipped: [], done: [], ...extra } } } },
  [{ id: "pier", title: "Pier Lights", artist: "The Cape Fear", key: "G", format: "chords", status: "learning", duration: 14, bpm: 120, body: "[Verse]\nG        Bm\nGrey boats lean on the wall\nF        G\nWaiting on a tide\n\n[Chorus]\nBm       F\nBring the lights home\nG        G\nBring them round" }]);

test("story 4: the first stop plays the song with each stand-in marked on the sheet, and the saved song is unchanged", { skip: skip() }, async t => {
  const { page } = await home(t, SEEDED(), { key: false });
  await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
  const before = (await stored(page)).songs.find(s => s.id === "pier").body;
  await page.click("#rn-now-start"); await page.waitForSelector("#sheet .c.standin", { state: "attached", timeout: 15000 }).catch(async e => { console.log("DBG", page.url(), (await page.innerText("body")).slice(0, 300)); throw e; });
  const marks = await page.evaluate(() => [...document.querySelectorAll("#sheet .c.standin")].map(e => ({ text: e.querySelector(".ct").textContent.trim(), sr: e.querySelector(".sr-only").textContent.trim(), mark: !!e.querySelector(".si") })));
  assert.ok(marks.length >= 3, "Bm and F are marked wherever they come");
  assert.ok(marks.some(m => m.text === "D" && m.sr === "Bm, played as D"), "a minor becomes its relative major, read aloud as played as D");
  assert.ok(marks.every(m => m.mark), "each has a shape, not colour alone");
  assert.equal((await stored(page)).songs.find(s => s.id === "pier").body, before, "the saved song is never changed");
});

const GIG = { plainPlay: false, countIn: false };
const withLessons = d => { for (const id of ["c:Bm", "s:G-Bm", "c:F", "s:Bm-F"]) d.skills.done[id] = { n: 1, best: 0, at: 9 }; return d; };
async function playOut(page) {
  await page.click("#rn-now-start"); /* Start on a stop opens the song as a Gig, and it plays */
  await page.waitForSelector(".gc", { timeout: 60000 });
}

test("story 4: the easy stop is done when the song is played to the end, and it counts as a play", { skip: skip() }, async t => {
  const d = SEEDED(); d.settings = { ...d.settings, ...GIG };
  const { page } = await home(t, d, { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="p:open-0"]');
  await playOut(page);
  assert.match(await page.innerText(".gc-list"), /Song tour: Play it now done/);
  const after = await stored(page);
  assert.deepEqual(after.songTour.legs.open.done, ["p:open-0"]);
  assert.equal(after.songs.find(s => s.id === "pier").status, "learning", "the song stays Learning until the headline");
  assert.equal(after.journal?.chords?.Bm, undefined, "stand-in chords are not credited as played");
});

test("story 6: the headline plays every chord real, then the song is Solid and its chords are known", { skip: skip() }, async t => {
  const d = withLessons(SEEDED({ done: ["p:open-0", "p:open-1", "p:open-2"] })); d.settings = { ...d.settings, ...GIG };
  const { page } = await home(t, d, { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="h:open"]');
  await page.click("#rn-now-start"); await page.waitForSelector("#sheet", { state: "attached", timeout: 15000 });
  assert.equal(await page.locator("#sheet .c.standin").count(), 0, "every chord is real");
  await page.waitForSelector(".gc", { timeout: 60000 });
  assert.match(await page.innerText(".gc-list"), /Song tour: Headline show done\. Pier Lights is Solid now/);
  const after = await stored(page);
  assert.equal(after.songs.find(s => s.id === "pier").status, "solid");
  assert.equal(after.songTour.legs.open.solid, true);
  assert.ok(after.skills.done["c:Bm"] && after.skills.done["c:F"], "its chords count as known");
});

test("story 5: the replay uses the chord as real and later new chords still use stand-ins; a lesson done on the Tour counts", { skip: skip() }, async t => {
  const d = SEEDED({ done: ["p:open-0"] });
  d.skills.done["c:Bm"] = { n: 1, best: 0, at: 9 }; d.skills.done["s:G-Bm"] = { n: 1, best: 0, at: 9 };
  const { page } = await home(t, d, { key: false });
  await page.waitForSelector('.rn-stop.cur[data-stop="p:open-1"]');
  assert.ok(await page.locator('.rn-stop.done[data-stop="c:Bm"]').count(), "the Bm lesson done on the Tour counts as done here");
  await page.click("#rn-now-start"); await page.waitForSelector("#sheet .c.standin", { state: "attached", timeout: 15000 });
  const was = await page.evaluate(() => [...document.querySelectorAll("#sheet .c.standin .sr-only")].map(e => e.textContent));
  assert.ok(was.length && was.every(x => /^F, played as/.test(x)), "only F is a stand-in now; Bm is real: " + was.join("|"));
});

test("story 5: a chord lesson and switch drill open for any chord", { skip: skip() }, async t => {
  const page = await phone(t, lib(), { home: true });
  for (const id of ["c:Bm", "s:D-Bm"]) {
    await page.evaluate(h => { location.hash = h; }, "#/practice/" + encodeURIComponent(id));
    await page.waitForFunction(re => new RegExp(re).test(document.querySelector("h1.title")?.innerText || ""), id === "c:Bm" ? "Bm chord" : "D to Bm");
  }
});

test("data: a backup carries the song tour and a backup from before 5.9.0 restores", { skip: skip() }, async t => {
  const page = await phone(t, SEEDED(), { home: true });
  const file = await page.evaluate(() => JSON.parse(JSON.stringify(JSON.parse(localStorage.getItem("tabs-v1")))));
  assert.equal(file.songTour.legs.open.song, "pier");
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("tabs-v1")); delete d.songTour; localStorage.setItem("tabs-v1", JSON.stringify(d)); });
  await page.reload(); await page.waitForSelector("#rd-path");
  assert.equal(await page.locator("#rd-path").count(), 1, "a library without the field loads");
});

test("inclusive: the song tour card and stops hold at 320 px, in Light and Dark, with big text", { skip: skip() }, async t => {
  for (const scheme of ["light", "dark"]) {
    const { page } = await home(t, SEEDED(), { key: false, opts: { viewport: { width: 320, height: 640 }, colorScheme: scheme } });
    await page.waitForSelector('.rn-stop[data-stop="p:open-0"]');
    await page.evaluate(() => { document.documentElement.style.fontSize = "160%"; });
    await page.click('.rn-stop[data-stop="p:open-0"]').catch(() => {});
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(over, false, `${scheme}: no sideways scroll`);
    const small = await page.evaluate(() => [...document.querySelectorAll(".rn-stop")].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44); }).length);
    assert.equal(small, 0, `${scheme}: stops are 44 px`);
  }
});
