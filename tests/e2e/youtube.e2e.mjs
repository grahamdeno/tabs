// Play along on YouTube (4.96.0): a stand-in for YouTube's player API, so the flow is checked without YouTube itself.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

/* window.YT with a Player that reports time; the first play has a 1.5 s "ad" (state 3) before the song plays */
const STUB = `
window.__yt = { calls: [], adMs: 1500, iphone: false, tap() { this.iphone = false; this.player.playVideo(); } };
window.YT = { Player: class {
  constructor(id, o) {
    const el = document.getElementById(id), f = document.createElement("iframe");
    f.width = o.width; f.height = o.height; f.title = "YouTube stand-in"; el.replaceWith(f);
    this.o = o; this.t = 0; this.state = -1; this.base = 0; this.rate = 1; window.__yt.player = this;
    setTimeout(() => o.events.onReady({ target: this }), 50);
  }
  set(s) { this.state = s; this.o.events.onStateChange({ data: s }); }
  cueVideoById(id) { window.__yt.calls.push("cue " + id); this.set(5); }
  playVideo() { window.__yt.calls.push("play"); if (window.__yt.iphone) return; /* an iPhone: only a tap on the video starts it */ this.set(3); setTimeout(() => { this.base = performance.now(); this.set(1); }, window.__yt.adMs); window.__yt.adMs = 0; }
  pauseVideo() { window.__yt.calls.push("pause"); this.t = this.getCurrentTime(); this.set(2); }
  seekTo(s) { window.__yt.calls.push("seek " + Math.round(s)); this.t = s; this.base = performance.now(); }
  setPlaybackRate(r) { window.__yt.calls.push("rate " + r); this.rate = r; }
  getCurrentTime() { return this.state === 1 ? this.t + (performance.now() - this.base) / 1000 * this.rate : this.t; }
  destroy() {}
} };
window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;
const body = "[Verse]\n" + Array.from({ length: 16 }, (_, i) => `G        C\nWalking down the old road line ${i + 1}`).join("\n");
const SONG = { id: "y", title: "Old Road", artist: "The Pines", key: "G", format: "chords", duration: 90, bpm: 90, body, yt: { id: "abcdefghijk", title: "Old Road", channel: "The Pines - Topic", secs: 90 } };

test("4.96.0 Play along on YouTube: Play starts the video, the page waits out the ad, follows the video, and the card steps away on pause", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [SONG], settings: { ...LIB.settings, countIn: false } });
  await page.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB }));
  await page.evaluate(() => { location.hash = "#/song/y"; }); await page.waitForSelector("#play"); await settled(page);
  await page.waitForFunction(() => !!window.__yt?.player, null, { timeout: 10000 }); /* the player is made when the song opens, ready for the tap */
  assert.equal(await page.locator(".yt-card.on").count(), 0, "hidden until it plays");
  const y0 = await page.evaluate(() => scrollY);
  await page.click("#play");
  await page.waitForSelector(".yt-card.on");
  const box = await page.locator(".yt-card iframe").boundingBox();
  assert.ok(box.width >= 200 && box.height >= 200, `at least 200 px square: ${JSON.stringify(box)}`);
  assert.deepEqual((await page.evaluate(() => window.__yt.calls)).filter(c => c === "play"), ["play"]);
  await page.waitForTimeout(1000); /* real timer: the ad is still playing */
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y0) < 4, "the page holds while the ad plays");
  await page.waitForFunction(y => scrollY > y + 20, y0, { timeout: 10000 });
  const box2 = await page.locator(".yt-card").boundingBox(), line = await page.evaluate(() => document.querySelector("#sheet > .st-now").getBoundingClientRect().top);
  assert.ok(box2.y + box2.height <= line + 2, `the card stays above the line you are on: ${JSON.stringify(box2)} line ${line} h ${await page.evaluate(() => innerHeight)} top ${await page.evaluate(() => document.querySelector(".yt-card").style.top)}`);
  await page.click("#play"); /* pause */
  await page.waitForSelector(".yt-card.on", { state: "detached" }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector(".yt-card.on"));
  assert.ok((await page.evaluate(() => window.__yt.calls)).includes("pause"));
});

test("4.96.0 picking a song's video: the search server's results, a pasted link, lining it up, and Settings", { skip: skip() }, async t => {
  const song = { ...SONG, yt: undefined };
  const page = await phone(t, { ...LIB, songs: [song], settings: { ...LIB.settings, youtubeServer: "https://tabs-youtube.test.workers.dev" } });
  await page.route("https://tabs-youtube.test.workers.dev/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "topic123456", title: "Old Road", channel: "The Pines - Topic", secs: 90, topic: true }, { id: "live1234567", title: "Old Road (Live)", channel: "The Pines", secs: 260 }] }) }));
  await page.evaluate(() => { location.hash = "#/song/y"; }); await page.waitForSelector("#about"); await settled(page);
  await page.click("#about"); await page.waitForSelector("#ab-yt");
  assert.match(await page.innerText("#ab-yt"), /YouTube video[\s\S]*Play along without Apple Music/);
  await page.click("#ab-yt"); await page.waitForSelector(".yt-pick");
  assert.match(await page.innerText(".yt-pick >> nth=0"), /Old Road[\s\S]*The Pines - Topic · 1:30/);
  await page.click(".yt-pick >> nth=0");
  await page.waitForSelector(".yt-now");
  assert.match(await page.innerText(".yt-line"), /Same length as the recording/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].yt?.id === "topic123456");
  /* a pasted link, then lining it up */
  await page.fill("#yt-link", "https://youtu.be/live1234567?si=x"); await page.click("#yt-use");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].yt?.id === "live1234567");
  await page.click("#yt-plus"); await page.click("#yt-plus");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs[0].yt?.start === 1);
  await page.fill("#yt-link", "https://evil.example/x"); await page.click("#yt-use");
  await page.waitForFunction(() => /doesn't look like a YouTube link/.test(document.body.innerText));
  await page.click("#yt-done");
  /* Settings: the YouTube page */
  await page.evaluate(() => { location.hash = "#/settings/youtube"; }); await page.waitForSelector("#s-yt"); await settled(page);
  assert.equal(await page.getAttribute("#s-yt", "aria-checked"), "true", "on unless turned off");
  await page.fill("#s-ytserver", "https://evil.example"); await page.click("#s-ytsave");
  await page.waitForFunction(() => /should look like/.test(document.body.innerText));
  await page.click("#s-yt"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.youtube === false);
});

test("4.96.1 on an iPhone, Play alone can't start a video: the card shows at once and says to tap it, the page waits, and a tap on the video starts the song", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [SONG], settings: { ...LIB.settings, countIn: false } });
  await page.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB.replace("adMs: 1500", "adMs: 0").replace("iphone: false", "iphone: true") }));
  await page.evaluate(() => { location.hash = "#/song/y"; }); await page.waitForSelector("#play"); await settled(page);
  await page.waitForFunction(() => !!window.__yt?.player, null, { timeout: 10000 });
  const y0 = await page.evaluate(() => scrollY);
  await page.click("#play");
  await page.waitForSelector(".yt-card.on.tap");
  assert.equal(await page.innerText(".yt-cap"), "Tap the video to start");
  await page.waitForFunction(() => /Tap the video to start\. Your phone/.test(document.body.innerText), null, { timeout: 5000 });
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - y0) < 4, "the page waits for the video");
  await page.evaluate(() => window.__yt.tap());
  await page.waitForFunction(y => scrollY > y + 20, y0, { timeout: 10000 });
  assert.equal(await page.innerText(".yt-cap"), "Old Road", "the title comes back once it plays");
  assert.equal(await page.locator(".yt-card.tap").count(), 0);
});
