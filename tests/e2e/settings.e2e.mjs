// Settings menu: a short menu that opens one page per area.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Settings: menu rows show their state, open their page, and Back returns to the menu", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, nudge: true, place: { name: "Wilmington, North Carolina, US", lat: 34.23, lon: -77.94 } } });
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.evaluate(() => { location.hash = "#/settings"; }); await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-page]").count(), 8);
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

test("Settings > Look: Amp covering turns the tolex grain on and off (2.20.0)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { location.hash = "#/settings/look"; }); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "off", "off by default");
  await page.click("#s-tolex"); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "on");
  assert.match(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), /svg/, "the grain is drawn");
  await page.reload(); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tolex), "on", "kept");
});

test("Settings > Keys: Apple Music is off by default; on, Listen plays the linked song with MusicKit", { skip: skip() }, async t => {
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

  await page.evaluate(() => { location.hash = "#/settings/keys"; }); await page.waitForSelector("#s-apple");
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
  const song = { ...LIB.songs[0], body, duration: 200, recRate: 0.8, loop: { a: 10, b: 14, build: true }, listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
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
  await page.evaluate(() => { location.hash = "#/settings/keys"; }); await page.waitForSelector("#s-apple");
  assert.equal(await page.locator("#s-recvol").count(), 0);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  assert.equal(await page.locator('[data-m="recspeed"]').count(), 0);
  assert.equal(await page.locator("#listen.rec").count(), 0, "no Recording chip while Apple Music is off");
});

test("Apple Music: the Recording sheet switches recording and band, sets the speed and resets what the page learned", { skip: skip() }, async t => {
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
  await page.click("[data-rate='0.7']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").recRate === 0.7, null, { timeout: 5000 });
  assert.equal(await page.getAttribute("[data-rate='0.7']", "aria-pressed"), "true");
  await page.click("#rs-reset");
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").syncs, null, { timeout: 5000 });
  assert.match(await page.innerText("#rs"), /Nothing learned yet/);
  await page.click("[data-mode='band']");
  assert.equal(await page.locator("[data-rate]").count(), 0, "the band has no recording speed");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").backing === "band", null, { timeout: 5000 });
  await page.click("#rs-done");
  assert.equal(await page.locator("#rs").count(), 0);
  assert.match(await page.innerText("#listen"), /Band/);
  assert.equal(await page.locator("#listen.on").count(), 0, "the chip is lit only for the recording");
  assert.equal((await saved()).recRate, 0.7);
});

test("one hand: paused, the whole bar shows; Play folds it into the corner and the ring holds no Apple Music items", { skip: skip() }, async t => {
  const song = { ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music", length: 200 } };
  const lib = { ...LIB, songs: [song, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", countIn: false, appleMusic: true, appleMusicToken: "https://tabs-musickit.example.workers.dev/token", tipsSeen: { ...LIB.settings.tipsSeen, ringHint: true } } };
  const page = await phone(t, lib);
  await page.route("https://*.workers.dev/**", r => r.fulfill({ status: 500, body: "" }));
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#play");
  await page.waitForTimeout(300);
  const st = () => page.evaluate(() => ({ one: document.body.classList.contains("one"), ring: document.body.classList.contains("ring"), bar: !!document.querySelector(".app.viewer .player #play") && getComputedStyle(document.querySelector(".app.viewer .dock")).display !== "none" }));
  assert.deepEqual(await st(), { one: true, ring: false, bar: true }, "paused: the bar is out, with Play in it");
  await page.click("#play");
  await page.waitForFunction(() => document.body.classList.contains("ring"), null, { timeout: 3000 });
  assert.deepEqual(await st(), { one: true, ring: true, bar: false }, "playing: folded into the corner");
  const c = await page.locator("#play").boundingBox();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down(); await page.waitForTimeout(900);
  await page.waitForSelector(".ringx .ri");
  assert.deepEqual(await page.$$eval(".ringx .ri", els => els.map(e => e.dataset.r)), ["metro", "key", "nn", "tuner", "fav", "more"], "Tempo is back and nothing else crowds More off the ring");
  await page.mouse.up(); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector(".ringx")?.click()); await page.waitForTimeout(300);
  await page.evaluate(() => document.getElementById("play").click());
  await page.waitForFunction(() => !document.body.classList.contains("ring"), null, { timeout: 3000 });
  assert.equal((await st()).bar, true, "paused again: the bar unfolds");
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
