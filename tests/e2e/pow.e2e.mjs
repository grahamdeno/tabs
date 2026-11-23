// 4.71.0: what a show earned bursts in, comic-book style, one at a time.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser, settled } from "./harness.mjs";

useBrowser();
const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 10, body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand" };

/* A saved Green Room is read as Light or Dark, so Show complete uses the engraved plate, not the comic burst. */
test("Show complete (a saved Green Room): the plate, not the comic burst", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, SHORT], settings: { ...LIB.settings, v: 6, theme: "green", plainPlay: false, gigScore: false }, merch: { ...(LIB.merch || {}), has: ["green"] } });
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play");
  const seen = [];
  await page.waitForSelector(".gc", { timeout: 60000 });
  for (let i = 0; i < 40 && seen.length < 2; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll(".co")].map(c => ({ plate: c.classList.contains("co-plate"), burst: c.classList.contains("co-pow"), text: c.querySelector(".co-badge")?.innerText.replace(/\s+/g, " ").trim() })));
    assert.ok(now.length <= 1, "one at a time: " + JSON.stringify(now));
    if (now[0]) { assert.equal(now[0].burst, false, "no comic burst"); if (/^(FANS|TIPS) /.test(now[0].text || "") && !seen.includes(now[0].text)) seen.push(now[0].text); }
    await page.waitForTimeout(150); /* real timer: sampling the bursts as they play */
  }
  assert.match(seen[0], /FANS \+\d+/); assert.match(seen[1], /TIPS \+\$\d+/);
});

test("Show complete (Dark): one plate at a time, the fans plate first, then the tips plate, and no comic burst", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, SHORT], settings: { ...LIB.settings, v: 6, theme: "dark", plainPlay: false, gigScore: false } });
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play");
  const seen = [];
  await page.waitForSelector(".gc", { timeout: 60000 });
  for (let i = 0; i < 40 && seen.length < 2; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll(".co")].map(c => ({ plate: c.classList.contains("co-plate"), burst: !!c.querySelector(".co-fx svg, .co-fx i"), text: c.querySelector(".co-badge")?.innerText.replace(/\s+/g, " ").trim() })));
    assert.ok(now.length <= 1, "one plate at a time: " + JSON.stringify(now));
    if (now[0]) { assert.ok(now[0].plate && !now[0].burst, "an engraved plate, no burst"); if (/^(FANS|TIPS) /.test(now[0].text) && !seen.includes(now[0].text)) seen.push(now[0].text); } /* other news (a new chord) may come too */
    await page.waitForTimeout(150); /* real timer: sampling the plates as they play */
  }
  assert.match(seen[0], /FANS \+\d+/, "the fans plate first"); assert.match(seen[1], /TIPS \+\$\d+/, "then the tips plate");
});
