// Play together (2.15): the link carries the song, a start time and the tempo;
// both phones count in at that moment and scroll together. No server.
import test from "node:test";
import assert from "node:assert/strict";
import { base, skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

test("Play together: share a start time, and the friend's phone joins and starts on time", { skip: skip() }, async t => {
  const me = await phone(t, LIB, { permissions: ["clipboard-read", "clipboard-write"] });
  await me.goto(base + "#/song/a"); await me.waitForTimeout(400);
  await me.click("#more"); await me.waitForTimeout(150);
  await me.click(".menu [data-m='duet']"); await me.waitForTimeout(250);
  await me.click("#du-mins [data-min='1']");
  if (process.env.SHOT) await me.screenshot({ path: process.env.SHOT + "/duet-share.png" });
  await me.click("#du-go"); await me.waitForTimeout(400);
  const url = await me.evaluate(() => navigator.clipboard.readText());
  assert.match(url, /#\/import\/z/);
  assert.match(await me.innerText(".duet-wait"), /until the count-in/);
  const got = await me.evaluate(async u => (await import("./core.js")).unpackShare(u.split("#/import/")[1]), url);
  assert.equal(got.song.title, "River Road"); assert.equal(got.song.duration, 30);
  assert.equal(got.duet.at % 15000, 0, "a quarter-minute start");
  const ahead = got.duet.at - Date.now();
  assert.ok(ahead > 45000 && ahead < 80000, `about a minute ahead: ${ahead}`);
  await me.click("#dw-x"); await me.waitForTimeout(150);
  assert.equal(await me.locator(".duet-wait").count(), 0, "Cancel stops waiting");

  // The friend: an empty library, a link that starts in nine seconds (room for a busy test machine).
  const friend = await phone(t, { ...LIB, songs: [] });
  const code = await friend.evaluate(async g => (await import("./core.js")).packShare({ song: g.song, duet: { at: Date.now() + 9000, bpm: 240 } }), got);
  await friend.goto(base + "#/import/" + code); await friend.reload(); await friend.waitForTimeout(500);
  const join = await friend.innerText("[aria-label='Play together']");
  assert.match(join, /River Road/); assert.match(join, /until the count-in/);
  if (process.env.SHOT) await friend.screenshot({ path: process.env.SHOT + "/duet-join.png" });
  await friend.click("#dj-yes"); await friend.waitForTimeout(600);
  assert.match(await friend.evaluate(() => location.hash), /#\/song\//);
  assert.equal(JSON.parse(await friend.evaluate(() => localStorage.getItem("tabs-v1"))).songs.length, 1, "the song was added");
  assert.equal(await friend.locator(".duet-wait").count(), 1);
  assert.equal(await friend.evaluate(() => document.body.classList.contains("playing")), false, "not before the start");
  /* Starts at the start time (waited for, not slept on, so a busy test machine doesn't flake). */
  await friend.waitForFunction(() => document.body.classList.contains("playing"), null, { timeout: 15000 });
  assert.equal(await friend.locator(".countin").count(), 1, "with a count-in");
});

test("Play together: a link opened after its start time just offers the song", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [] });
  const code = await page.evaluate(async s => (await import("./core.js")).packShare({ song: s, duet: { at: Date.now() - 60000, bpm: 90 } }), { title: "Late Song", body: "G C\nla" });
  await page.goto(base + "#/import/" + code); await page.reload(); await page.waitForTimeout(500);
  assert.match(await page.innerText("[aria-label='Shared with you']"), /Late Song/);
  assert.equal(await page.locator(".duet-wait, #dj-yes").count(), 0);
});
