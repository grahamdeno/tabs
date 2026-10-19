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
  await page.click("#listen"); await page.waitForSelector("#toast .tact");
  assert.match(await page.innerText("#toast"), /Sign in to Apple Music/);
  await page.click("#toast .tact"); await page.waitForFunction(() => window.mkLog?.some(x => x.startsWith("queue")));
  assert.deepEqual(await page.evaluate(() => window.mkLog), ["configure:test.token.sig", "authorize", "queue:111:true"]);
  await page.click("#listen"); await page.waitForTimeout(200);
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
  await page.click("#listen");
  await page.waitForFunction(() => /Apple Music stopped at queue: The operation was aborted/.test(document.getElementById("toast")?.innerText || ""), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => typeof window.alert.caught), "boolean");
});
