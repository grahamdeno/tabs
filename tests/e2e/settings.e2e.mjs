// Settings menu: a short menu that opens one page per area.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, SONG, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Settings: menu rows show their state, open their page, and Back returns to the menu", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, nudge: true, place: { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 } } });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-page]").count(), 9);
  assert.match(await page.innerText("[data-page='today']"), /Wilmington/);
  assert.match(await page.innerText("[data-page='diagrams']"), /of 4 on/);
  assert.equal(await page.locator(".s-dock #s-backup").count(), 1, "Back up now is docked at the bottom");

  await page.click("[data-page='playing']"); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => location.hash), /#\/settings\/playing/);
  assert.match(await page.innerText("h1"), /Playing/);
  await page.click("#s-count"); await page.waitForTimeout(150);
  assert.match(await page.evaluate(() => location.hash), /#\/settings\/playing/, "a change keeps you on the page");
  await page.click("#back"); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Settings/);

  await page.click("[data-page='keys']"); await page.waitForTimeout(300);
  assert.equal(await page.locator("#s-key").count(), 1); assert.equal(await page.locator("#s-bpmkey").count(), 1);
  await page.goto(page.url().replace(/#.*/, "#/trash")); await page.waitForTimeout(300);
  await page.click("#back"); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Library and backups/, "Recently deleted goes back to its page");
  await page.evaluate(() => { location.hash = "#/settings/nope"; }); await page.waitForTimeout(300);
  assert.match(await page.innerText("h1"), /Settings/, "an unknown page shows the menu");
  assert.deepEqual(errs, []);
});

test("Settings > Look: Light, Dark and Green Room, kept after a reload (4.0.0)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { location.hash = "#/settings/look"; }); await page.waitForTimeout(300);
  const look = () => page.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.look, getComputedStyle(document.body).backgroundColor]);
  await page.click("#s-theme [data-t='dark']"); await page.waitForTimeout(150);
  assert.deepEqual(await look(), ["dark", "neon", "rgb(29, 22, 64)"], "Dark is Neon Midnight");
  await page.click("#s-theme [data-t='light']"); await page.waitForTimeout(150);
  assert.deepEqual(await look(), ["light", "festival", "rgb(234, 243, 255)"], "Light is Festival Poster");
  await page.click("#s-theme [data-t='green']"); await page.waitForTimeout(150);
  assert.deepEqual(await look(), ["light", "green", "rgb(230, 239, 231)"], "Green Room is a light look");
  assert.equal(await page.locator("#s-tolex").count(), 0, "the amp covering is gone with the amp look");
  await page.reload(); await page.waitForTimeout(300);
  assert.equal((await look())[1], "green", "kept");
});

test("Settings > Apple Music: off by default; on, Listen plays the linked song with MusicKit", { skip: skip() }, async t => {
  const lib = { ...LIB, songs: [{ ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } }, LIB.songs[1]] };
  const page = await phone(t, lib);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  const calls = [];
  await page.route("https://*.workers.dev/**", r => { calls.push("token"); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "test.token.sig", expires: 0 }) }); });
  /* A stand-in for Apple's MusicKit JS, recording what The Road asks of it. */
  await page.route("https://js-cdn.music.apple.com/**", r => { calls.push("musickit"); r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.MusicKit = { configure: async o => { window.mkLog.push("configure:" + o.developerToken); }, getInstance: () => window.mkMusic };
    window.mkLog = []; window.mkMusic = { isAuthorized: false, isPlaying: false,
      authorize: async () => { window.mkMusic.isAuthorized = true; window.mkLog.push("authorize"); },
      setQueue: async o => { window.mkLog.push("queue:" + o.song + ":" + o.startPlaying); window.mkMusic.isPlaying = true; },
      play: async () => {}, pause: () => { window.mkMusic.isPlaying = false; window.mkLog.push("pause"); }, stop: () => { window.mkLog.push("stop"); } };
    document.dispatchEvent(new Event("musickitloaded"));` }); });
  let opened = "";
  await page.context().route("https://music.apple.com/**", r => { opened = r.request().url(); r.fulfill({ status: 200, body: "" }); });

  /* Off (the default): Listen opens the link, as before, and nothing is loaded or sent. */
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen");
  await page.click("#listen"); await page.waitForTimeout(600);
  assert.match(opened, /i=111/, "off: the link opens in Apple Music");
  assert.deepEqual(calls, [], "off: no MusicKit and no token request");

  await page.evaluate(() => { location.hash = "#/settings/apple"; }); await page.waitForSelector("#s-apple");
  assert.equal(await page.getAttribute("#s-apple", "aria-checked"), "false");
  assert.equal(await page.locator("#s-appletoken").count(), 0, "the token address shows only when it's on");
  await page.click("#s-apple"); await page.waitForSelector("#s-appletoken");
  await page.fill("#s-appletoken", "http://insecure.example/token"); await page.click("#s-applesave");
  assert.match(await page.innerText("#toast"), /https/);
  await page.fill("#s-appletoken", "https://tabs-musickit.example.workers.dev/token"); await page.click("#s-applesave"); await page.waitForTimeout(150);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.appleMusic, true);
  assert.equal(s.appleMusicToken, "https://tabs-musickit.example.workers.dev/token");

  /* On: the first tap loads MusicKit with the Worker's token and asks to sign in; then it plays. */
  opened = "";
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen");
  /* the chip is the Recording chip now: it opens the sheet, and Listen in the sheet plays */
  await page.click("#listen"); await page.waitForSelector("#rs-listen");
  await page.click("#rs-listen"); await page.waitForSelector("#toast .tact");
  assert.match(await page.innerText("#toast"), /Sign in to Apple Music/);
  await page.click("#toast .tact"); await page.waitForFunction(() => window.mkLog?.some(x => x.startsWith("queue")));
  assert.deepEqual(await page.evaluate(() => window.mkLog), ["configure:test.token.sig", "authorize", "queue:111:true"]);
  await page.waitForTimeout(300); await page.click("#rs-listen"); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.mkLog.at(-1)), "pause", "a second tap pauses");
  assert.deepEqual(calls, ["token", "musickit"], "one token request, one MusicKit load");
  assert.equal(opened, "", "on: Apple Music isn't opened");
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.mkLog.at(-1)), "stop", "leaving the song stops it");
  assert.deepEqual(errs, []);
});

test("Apple Music: opening a song readies the recording paused, Play starts it with the scroll, and pausing the scroll pauses it", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkLog = []; window.mkMusic = { isAuthorized: true, isPlaying: false,
      setQueue: async o => { window.mkLog.push("queue:" + o.song + ":" + o.startPlaying); }, seekToTime: async () => {},
      play: async () => { window.mkMusic.isPlaying = true; window.mkLog.push("play"); }, pause: () => { window.mkMusic.isPlaying = false; window.mkLog.push("pause"); }, stop: () => { window.mkLog.push("stop"); } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.waitForFunction(() => window.mkLog?.includes("queue:111:false"), null, { timeout: 5000 });
  assert.deepEqual(await page.evaluate(() => window.mkLog), ["queue:111:false"], "ready, not playing");
  await page.click("#play");
  await page.waitForFunction(() => window.mkLog.includes("play"), null, { timeout: 5000 });
  await page.click("#play");
  await page.waitForFunction(() => window.mkLog.at(-1) === "pause", null, { timeout: 5000 });
  assert.deepEqual(errs, []);
});

test("Cover requests (4.10.0): what you played in Apple Music becomes the request, or a cover quest when it isn't in the Songbook", { skip: skip() }, async t => {
  const other = { ...LIB.songs[1] }; delete other.listen;
  const lib = { ...LIB, songs: [{ ...LIB.songs[0], playLog: { total: 3, last: Date.now() - 86400000, days: { [new Date(Date.now() - 86400000).toISOString().slice(0, 10)]: 3 } } }, other], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib);
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkTrack = window.mkTrack || { name: ${JSON.stringify(other.title)} + " (Remastered)", artistName: ${JSON.stringify(other.artist || "")} };
    window.mkMusic = { isAuthorized: true, isPlaying: false, setQueue: async () => {}, seekToTime: async () => {}, play: async () => {}, pause: () => {}, stop: () => {},
      api: { music: async () => ({ data: { data: [{ attributes: { ...window.mkTrack, url: "https://music.apple.com/us/album/x/1?i=777", artwork: { url: "https://is1-ssl.mzstatic.com/a/{w}x{h}bb.jpg" } } }] } }) } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") }));
  await page.evaluate(() => { location.hash = "#/tour"; }); await page.reload();
  await page.waitForFunction(() => /FROM YOUR LISTENING/.test(document.querySelector(".tq-req")?.innerText || ""), null, { timeout: 8000 });
  assert.match(await page.innerText(".tq-req"), new RegExp(`${other.title}[\\s\\S]*just played it in Apple Music`));
  assert.equal(await page.locator(".rd-heard").count(), 0);
  /* a song you don't have: a cover quest */
  await page.addInitScript(() => { window.mkTrack = { name: "Wagon Wheel", artistName: "Old Crow" }; });
  await page.reload();
  await page.waitForSelector(".tq-cover", { timeout: 8000 });
  assert.match(await page.innerText(".tq-cover"), /COVER QUEST[\s\S]*Wagon Wheel[\s\S]*3x fans[\s\S]*1 · Get the song/);
  assert.match(await page.innerText("#tq-cover"), /GET THE SONG/);
  assert.deepEqual(errs, []);
});

test("Apple Music: not signed in inside the app, opening a linked song offers Sign in instead of doing nothing", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkLog = []; window.mkMusic = { isAuthorized: false, isPlaying: false, authorize: async () => { window.mkMusic.isAuthorized = true; window.mkLog.push("authorize"); },
      setQueue: async o => { window.mkLog.push("queue:" + o.song + ":" + o.startPlaying); }, seekToTime: async () => {}, play: async () => {}, pause: () => {}, stop: () => {} };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.waitForFunction(() => /Sign in to Apple Music/.test(document.getElementById("toast")?.innerText || ""), null, { timeout: 5000 });
  await page.click("#toast button");
  await page.waitForFunction(() => window.mkLog.includes("queue:111:false"), null, { timeout: 5000 });
  assert.deepEqual(await page.evaluate(() => window.mkLog), ["authorize", "queue:111:false"], "signed in, then the recording is readied");
});

test("Apple Music: a song set to Band starts no recording, and the More menu switches it to the recording", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], backing: "band", listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false, metronome: true } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkLog = []; window.mkMusic = { isAuthorized: true, isPlaying: false,
      setQueue: async o => { window.mkLog.push("queue"); }, seekToTime: async () => {},
      play: async () => { window.mkLog.push("play"); }, pause: () => { window.mkLog.push("pause"); }, stop: () => {} };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(600);
  assert.ok(!(await page.evaluate(() => window.mkLog || [])).includes("play"), "band: the recording stays silent");
  await page.click("#play");
});

test("Apple Music: the page follows the recording's clock, and moving the page by hand seeks the recording", { skip: skip() }, async t => {
  const body = Array.from({ length: 90 }, (_, n) => `[V${n}]\nG  D  Em  C`).join("\n");
  const song = { ...LIB.songs[0], body, duration: 200, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false, speedMode: "length" } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkLog = []; window.mkMusic = { isAuthorized: true, isPlaying: false, currentPlaybackTime: 0,
      setQueue: async () => {}, seekToTime: async n => { window.mkLog.push("seek:" + Math.round(n)); window.mkMusic.currentPlaybackTime = n; },
      play: async () => { window.mkMusic.isPlaying = true; }, pause: () => { window.mkMusic.isPlaying = false; }, stop: () => {} };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.waitForTimeout(400);
  await page.click("#play");
  await page.waitForFunction(() => window.mkMusic.isPlaying, null, { timeout: 5000 });
  await page.evaluate(() => { window.mkMusic.currentPlaybackTime = 150; });
  await page.waitForFunction(() => scrollY > 300, null, { timeout: 5000 });
  const high = await page.evaluate(() => scrollY);
  await page.evaluate(() => { window.mkMusic.currentPlaybackTime = 30; });
  await page.waitForFunction(h => scrollY < h / 2, high, { timeout: 5000 });
  /* a small move is a correction: it is saved as a mark for the song and the recording is left alone */
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => scrollY);
  await page.evaluate(n => { window.dispatchEvent(new Event("wheel")); window.scrollTo(0, n); }, y + 120);
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").syncs || []).length === 1, null, { timeout: 5000 });
  assert.ok(!(await page.evaluate(() => window.mkLog)).some(x => x.startsWith("seek:") && +x.slice(5) > 0 && +x.slice(5) !== 0), "a nudge doesn't seek");
  /* a big move is a jump: the recording goes there */
  await page.evaluate(() => { window.dispatchEvent(new Event("wheel")); window.scrollTo(0, document.documentElement.scrollHeight * 0.8); });
  await page.waitForFunction(() => window.mkLog.some(x => x.startsWith("seek:") && +x.slice(5) > 100), null, { timeout: 5000 });
});

test("Apple Music: Practice a section loops the recording too, slows it on Build up, and the song's speed is applied", { skip: skip() }, async t => {
  const body = Array.from({ length: 60 }, (_, n) => `[V${n}]\nG  D  Em  C`).join("\n");
  const song = { ...LIB.songs[0], body, duration: 200, practice: { on: true, rate: 0.8 }, loop: { a: 10, b: 14, build: true }, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false, speedMode: "length" } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkLog = []; window.mkMusic = { isAuthorized: true, isPlaying: false, currentPlaybackTime: 0, playbackRate: 1, volume: 1,
      setQueue: async () => {}, seekToTime: async n => { window.mkLog.push("seek:" + Math.round(n)); window.mkMusic.currentPlaybackTime = n; },
      play: async () => { window.mkMusic.isPlaying = true; }, pause: () => { window.mkMusic.isPlaying = false; }, stop: () => {} };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.waitForTimeout(400);
  await page.click("#play");
  await page.waitForFunction(() => window.mkMusic.isPlaying, null, { timeout: 5000 });
  assert.ok(Math.abs((await page.evaluate(() => window.mkMusic.playbackRate)) - 0.8 * 0.8) < 0.01, "song speed times the first Build up pass");
  assert.ok((await page.evaluate(() => window.mkLog)).some(x => x.startsWith("seek:") && +x.slice(5) > 0), "Play starts the recording at the section");
});

test("Apple Music: the Recording sheet shows genre, year and composer in the album's color, and search lists what you played lately", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, currentPlaybackTime: 0, storefrontId: "us",
      setQueue: async () => {}, seekToTime: async () => {}, play: async () => {}, pause: () => {}, stop: () => {},
      api: { music: async path => path.includes("recent")
        ? { data: { data: [{ attributes: { name: "Wonderwall", artistName: "Oasis" } }, { attributes: { name: "Wonderwall", artistName: "Oasis" } }, { attributes: { name: "Creep", artistName: "Radiohead" } }] } }
        : { data: { data: [{ attributes: { genreNames: ["Rock", "Music"], releaseDate: "1995-10-30", composerName: "Noel Gallagher", artwork: { bgColor: "c04a2b" } } }] } } } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; });
  await page.waitForSelector("#listen.rec");
  await page.click("#listen");
  await page.waitForFunction(() => document.querySelector(".rs-d")?.textContent === "Rock · 1995 · Written by Noel Gallagher", null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.querySelector(".rs-head").style.getPropertyValue("--album")), "#c04a2b", "the album's color tints the sheet's header");
  await page.click("#rs-done");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").listen.genre, null, { timeout: 5000 });
  const l = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").listen);
  assert.equal(l.genre, "Rock"); assert.equal(l.year, 1995); assert.equal(l.tint, "c04a2b");
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#q");
  await page.tap("#q");
  await page.waitForSelector("[data-amr]", { timeout: 5000 });
  assert.equal(await page.locator("[data-amr]").count(), 2, "the repeat is listed once");
  await page.click("[data-amr='1']");
  assert.equal(await page.inputValue("#q"), "Creep Radiohead");
});

test("Apple Music off: no recording speed or volume anywhere", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const page = await phone(t, { ...LIB, songs: [song, LIB.songs[1]] });
  await page.evaluate(() => { location.hash = "#/settings/apple"; }); await page.waitForSelector("#s-apple");
  assert.equal(await page.locator("#s-recvol").count(), 0);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  assert.equal(await page.locator('[data-m="recspeed"]').count(), 0);
  assert.equal(await page.locator("#listen.rec").count(), 0, "no Recording chip while Apple Music is off");
});

test("Apple Music: the Recording sheet switches recording and band, and resets what the page learned (speed moved to Practice)", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], syncs: [[0.3, 50], [0.6, 120]], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token" } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, playbackRate: 1, setQueue: async () => {}, seekToTime: async () => {}, play: async () => {}, pause: () => {}, stop: () => {}, api: { music: async () => ({ data: { data: [] } }) } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a"));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen.rec.on");
  assert.match(await page.innerText("#listen"), /Recording/);
  await page.click("#listen"); await page.waitForSelector("#rs");
  assert.match(await page.innerText("#rs"), /2 spots learned/);
  assert.equal(await page.locator("[data-rate]").count(), 0, "3.21.0: speed lives in Practice mode now");
  await page.click("#rs-reset");
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").syncs, null, { timeout: 5000 });
  assert.match(await page.innerText("#rs"), /Nothing learned yet/);
  await page.click("[data-mode='band']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").backing === "band", null, { timeout: 5000 });
  await page.click("#rs-done");
  assert.equal(await page.locator("#rs").count(), 0);
  assert.match(await page.innerText("#listen"), /Band/);
  assert.equal(await page.locator("#listen.on").count(), 0, "the chip is lit only for the recording");
  assert.equal((await saved()).backing, "band");
});

test("Apple Music: each line is timed from LRCLIB's synced lyrics, only the times are kept, and the page follows them", { skip: skip() }, async t => {
  const body = SONG + "\n" + Array.from({ length: 10 }, (_, n) => `[Verse ${n + 2}]\nG  D  Em  C\nline number ${n + 2} goes right here`).join("\n");
  const song = { ...LIB.songs[0], body, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200, title: "River Road", artist: "The Wanderers" } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false } };
  const page = await phone(t, lib);
  const synced = ["[00:10.00] Walking down the river road tonight", "[00:14.00] Lantern in my hand and nothing in mind", "[00:20.00] Carry me home, carry me home", "[00:24.00] Lay me down where the willows grow",
    ...Array.from({ length: 10 }, (_, n) => `[${String(Math.floor((40 + n * 15) / 60)).padStart(2, "0")}:${String((40 + n * 15) % 60).padStart(2, "0")}.00] Line number ${n + 2} goes right here`)].join("\n");
  const asked = [];
  await page.route("https://lrclib.net/**", r => { asked.push(r.request().url()); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ id: 77, duration: 201, syncedLyrics: synced, plainLyrics: "x" }) }); });
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, currentPlaybackTime: 0, playbackRate: 1, setQueue: async () => {}, seekToTime: async n => { window.mkMusic.currentPlaybackTime = n; }, play: async () => { window.mkMusic.isPlaying = true; }, pause: () => { window.mkMusic.isPlaying = false; }, stop: () => {}, api: { music: async () => ({ data: { data: [] } }) } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen.rec");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").timed?.at?.length >= 10, null, { timeout: 8000 });
  const timed = (await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").timed));
  assert.equal(timed.id, 77);
  assert.ok(!JSON.stringify(timed).includes("willows"), "no lyric text is kept, only times");
  assert.match(asked[0], /duration=200/, "asks for this recording's length");
  await page.click("#listen"); await page.waitForSelector("#rs");
  assert.match(await page.innerText("#rs"), /14 lines timed/);
  assert.match(await page.innerText("#rs"), /Timing from LRCLIB/);
  await page.click("#rs-done");
  /* Playing: at a line's time, that line sits on the reading line. */
  await page.click("#play");
  await page.waitForFunction(() => window.mkMusic.isPlaying, null, { timeout: 5000 });
  await page.evaluate(() => { window.mkMusic.currentPlaybackTime = 85; window.mkMusic.isPlaying = true; });
  await page.waitForTimeout(1200);
  const gap = await page.evaluate(() => {
    const words = e => { const c = e.cloneNode(true); c.querySelectorAll(".c").forEach(x => x.remove()); return c.textContent.replace(/\s+/g, " "); };
    const el = [...document.querySelectorAll("#sheet .pr, #sheet .ly")].find(e => /line number 5 goes/i.test(words(e)));
    return Math.abs(el.getBoundingClientRect().top - innerHeight * 0.4);
  });
  assert.ok(gap < 100, `line 5 (85 s) is at the reading line (${Math.round(gap)} px off)`);
  /* Opening it again doesn't ask again; an edit to the words does. */
  await page.click("#play");
  const n = asked.length;
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForTimeout(1200);
  assert.equal(asked.length, n, "kept, not looked up again");
});

test("Apple Music: the preview is measured (tempo, swing, key), a song with no tempo takes it, and a sheet in another key can match it", { skip: skip() }, async t => {
  /* a 100 BPM click track over an E major chord, as a WAV file */
  const rate = 22050, secs = 12, x = new Float32Array(rate * secs);
  for (let i = 0; i < x.length; i++) for (const [m, a] of [[64, 1], [68, 0.8], [71, 0.9], [66, 0.35], [69, 0.35], [73, 0.3], [75, 0.3], [52, 0.9]]) x[i] += a * 0.03 * Math.sin(2 * Math.PI * 440 * 2 ** ((m - 69) / 12) * i / rate);
  for (let tt = 0; tt < secs - 1; tt += 0.6) for (const [off, amp] of [[0, 0.6], [0.3, 0.35]]) { const i0 = Math.round((tt + off) * rate); for (let i = 0; i < 400; i++) x[i0 + i] += amp * Math.exp(-i / 60) * Math.sin(i * 0.9); }
  const wav = Buffer.alloc(44 + x.length * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + x.length * 2, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 20000))), 44 + i * 2));
  const song = { ...LIB.songs[0], bpm: undefined, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  delete song.bpm;
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token" } };
  const page = await phone(t, lib);
  await page.route("https://itunes.apple.com/lookup**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ results: [{ trackId: 111, trackTimeMillis: 200000, previewUrl: "https://audio-ssl.itunes.apple.com/p/111.m4a" }] }) }));
  /* the preview itself isn't readable from the page; the Worker's /preview route passes it along */
  await page.route("https://audio-ssl.itunes.apple.com/**", r => r.abort("accessdenied"));
  const viaWorker = [];
  await page.route("https://*.workers.dev/**", r => {
    const u = r.request().url();
    if (u.includes("/preview")) { viaWorker.push(u); return r.fulfill({ status: 200, contentType: "audio/wav", headers: { "access-control-allow-origin": "*" }, body: wav }); }
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) });
  });
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, playbackRate: 1, setQueue: async () => {}, seekToTime: async () => {}, play: async () => {}, pause: () => {}, stop: () => {}, api: { music: async () => ({ data: { data: [] } }) } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen.rec");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").listen.feel, null, { timeout: 10000 });
  const s1 = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a"));
  assert.ok(Math.abs(s1.listen.feel.bpm - 100) <= 2, `tempo heard as ${s1.listen.feel.bpm}`);
  assert.equal(s1.listen.feel.key, "E");
  assert.equal(s1.bpm, s1.listen.feel.bpm, "a song with no tempo takes the recording's");
  assert.equal(viaWorker.length, 1, "Apple's file couldn't be read directly, so the Worker passed it along");
  assert.match(viaWorker[0], /preview\?u=https%3A%2F%2Faudio-ssl\.itunes\.apple\.com/);
  /* the sheet is in A, the recording in E: the chip shows a dot, and the sheet offers to match */
  await page.waitForSelector("#listen .rc-look");
  await page.click("#listen"); await page.waitForSelector(".rs-feel");
  assert.match(await page.innerText(".rs-feel"), /100 BPM|99 BPM|101 BPM/);
  assert.match(await page.innerText(".rs-feel"), /5 half steps lower/);
  await page.click("#rs-key");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").transpose === -5, null, { timeout: 5000 });
  assert.equal(await page.locator(".rs-look").count(), 0, "matched: nothing more to say");
});

test("3.21.0 Practice mode: a learning song opens in it; the row picks a section, sets the speed and turns it off", { skip: skip() }, async t => {
  const body = LIB.songs[0].body + "\n" + Array.from({ length: 6 }, (_, n) => `[Verse ${n + 2}]\nG  D  Em  C\nwords words words`).join("\n");
  const page = await phone(t, { ...LIB, songs: [{ ...LIB.songs[0], body, status: "learning" }, LIB.songs[1]] });
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a"));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#pchip");
  assert.match(await page.innerText("#pchip"), /Practicing/, "a learning song opens in Practice mode");
  assert.ok(await page.locator("#looprow.on").isVisible(), "the Practice row is up");
  assert.match(await page.innerText("#looprow"), /Pick a section/);
  await page.click("#lp-speed"); await page.click("#lp-speed");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").practice?.rate === 0.8, null, { timeout: 5000 });
  assert.match(await page.innerText("#lp-speed"), /80%/);
  await page.click("#lp-sec"); await page.waitForSelector(".loopbanner");
  await page.click("#sheet .sec >> nth=1"); await page.waitForTimeout(300);
  assert.match(await page.innerText("#lp-sec"), /Chorus/, "the section by its name");
  assert.equal((await saved()).loop.name, "Chorus");
  assert.ok(await page.locator("#lp-build").isVisible(), "Build up once there's a section");
  await page.click("#lp-x"); await page.waitForTimeout(200);
  assert.match(await page.innerText("#pchip"), /^Practice$/, "off: the chip says Practice");
  assert.equal(await page.locator("#looprow.on").count(), 0);
  assert.equal((await saved()).practice.on, false, "remembered as off for this learning song");
  await page.click("#pchip"); await page.waitForTimeout(200);
  assert.match(await page.innerText("#lp-sec"), /Chorus/, "on again: the section was kept");
});

test("3.21.0 the neck: Learning songs on top, Scales as their own track, and a scale lesson to hear and mark", { skip: skip() }, async t => {
  const long = LIB.songs[0].body + "\n" + Array.from({ length: 8 }, (_, n) => `[Verse ${n + 2}]\nG  D  Em  C\nwords words words`).join("\n");
  const page = await phone(t, { ...LIB, songs: [{ ...LIB.songs[0], body: long, status: "learning", loop: { a: 5, b: 8, name: "Chorus" }, practice: { rate: 0.8 } }, LIB.songs[1]], settings: { ...LIB.settings, micExplained: true } });
  await page.evaluate(() => { location.hash = "#/practice/neck"; }); await page.waitForSelector(".pk-learn");
  assert.match(await page.innerText(".pk-learn"), /River Road/);
  assert.match(await page.innerText(".pk-learn"), /Next: Chorus at 80%/);
  assert.match(await page.innerText(".pk-learn"), /0 of 5 plays/);
  const scales = page.locator(".pk-level", { hasText: "Scales" });
  assert.match(await scales.innerText(), /Am pent/);
  await scales.locator("[data-id='x:Ampent']").click(); await page.waitForSelector(".pk-scale");
  assert.match(await page.innerText("h1"), /A minor pentatonic/);
  assert.equal(await page.locator(".pk-scale .sn").count(), 12, "every note of the box on the neck");
  assert.equal(await page.locator("#pk-notes i").count(), 23, "up and back down");
  await page.click("#pk-play"); await page.waitForTimeout(200);
  await page.click("#pk-self"); await page.waitForTimeout(300);
  assert.match(await page.innerText("#app"), /Marked as got/);
  const sk = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).skills.done);
  assert.equal(sk["x:Ampent"].n, 1);
  await page.evaluate(() => { location.hash = "#/practice/neck"; }); await page.waitForSelector(".pk-learn");
  await page.click(".pk-song"); await page.waitForSelector("#pchip");
  assert.match(await page.innerText("#pchip"), /Practicing/, "a tap opens the song in Practice mode");
  await page.waitForFunction(() => scrollY > 40, null, { timeout: 3000 });
});

test("3.22.0 chord timing: with the recording playing, Now changes on the chord's own beat inside a line", { skip: skip() }, async t => {
  const body = SONG + "\n" + Array.from({ length: 10 }, (_, n) => `[Verse ${n + 2}]\nG  D  Em  C\nline number ${n + 2} goes right here`).join("\n");
  const song = { ...LIB.songs[0], body, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200, title: "River Road", artist: "The Wanderers" } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", countIn: false, diagrams: true } };
  const page = await phone(t, lib);
  const synced = ["[00:10.00] Walking down the river road tonight", "[00:14.00] Lantern in my hand and nothing in mind", "[00:20.00] Carry me home, carry me home", "[00:24.00] Lay me down where the willows grow",
    ...Array.from({ length: 10 }, (_, n) => `[${String(Math.floor((40 + n * 15) / 60)).padStart(2, "0")}:${String((40 + n * 15) % 60).padStart(2, "0")}.00] Line number ${n + 2} goes right here`)].join("\n");
  await page.route("https://lrclib.net/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ id: 77, duration: 201, syncedLyrics: synced, plainLyrics: "x" }) }));
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, currentPlaybackTime: 0, playbackRate: 1, setQueue: async () => {}, seekToTime: async n => { window.mkMusic.currentPlaybackTime = n; }, play: async () => { window.mkMusic.isPlaying = true; }, pause: () => { window.mkMusic.isPlaying = false; }, stop: () => {}, api: { music: async () => ({ data: { data: [] } }) } };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen.rec");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").timed?.at?.length >= 10, null, { timeout: 8000 });
  await page.click("#play");
  await page.waitForFunction(() => window.mkMusic.isPlaying, null, { timeout: 5000 });
  const now = () => page.evaluate(() => document.querySelector("#nn .nowcol")?.textContent || "");
  /* "Walking down the river road tonight": A on Walking (10 s), D on river (about 11.5 s) */
  await page.evaluate(() => { window.mkMusic.currentPlaybackTime = 10.4; });
  await page.waitForFunction(() => /A/.test(document.querySelector("#nn .nowcol")?.textContent || ""), null, { timeout: 4000 });
  assert.match(await now(), /A/, "early in the line: still A");
  await page.evaluate(() => { window.mkMusic.currentPlaybackTime = 12.4; });
  await page.waitForFunction(() => /D/.test(document.querySelector("#nn .nowcol")?.textContent || ""), null, { timeout: 4000 });
  await page.click("#play");
});

test("the song length keeps a recording's exact length, to the second", { skip: skip() }, async t => {
  const lib = { ...LIB, songs: [{ ...LIB.songs[0], duration: 227, durationSet: true }, LIB.songs[1]], settings: { ...LIB.settings, speedMode: "length" } };
  const page = await phone(t, lib);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#speed", { state: "attached" });
  assert.equal(await page.evaluate(() => document.getElementById("speed").value), "313", "3:47 stays 3:47, not 3:45");
});

test("Apple Music: a failure names the step it stopped at, and Apple's own alert becomes a banner", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token" } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ token: "t.t.t", expires: 0 }) }));
  await page.route("https://js-cdn.music.apple.com/**", r => r.fulfill({ status: 200, contentType: "text/javascript", body: `
    window.mkMusic = { isAuthorized: true, isPlaying: false, setQueue: async () => { window.alert("The operation was aborted."); throw new Error("The operation was aborted."); }, play: async () => {}, pause() {}, stop() {} };
    window.MusicKit = { configure: async () => {}, getInstance: () => window.mkMusic };
    document.dispatchEvent(new Event("musickitloaded"));` }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#listen");
  await page.click("#listen"); await page.waitForSelector("#rs-listen");
  await page.click("#rs-listen");
  await page.waitForFunction(() => /Apple Music stopped at queue: The operation was aborted/.test(document.getElementById("toast")?.innerText || ""), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => typeof window.alert.caught), "boolean");
});
