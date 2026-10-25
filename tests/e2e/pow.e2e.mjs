// 4.71.0: what a show earned bursts in, comic-book style, one at a time.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser, settled } from "./harness.mjs";

useBrowser();
const SHORT = { id: "g", title: "Short Road", artist: "Me", key: "A", format: "chords", duration: 10, body: "[Verse]\nA        D\nWalking down the road\nE        A\nLantern in my hand" };

test("Show complete: POW for the fans, then KA-CHING for the tips, one at a time (4.71.0)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, SHORT], settings: { ...LIB.settings, plainPlay: false, gigScore: false } });
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play");
  const seen = [];
  await page.waitForSelector(".gc", { timeout: 60000 });
  for (let i = 0; i < 40 && seen.length < 2; i++) {
    const now = await page.evaluate(() => [...document.querySelectorAll(".co")].map(c => (c.classList.contains("co-pow") ? "pow " : "") + c.querySelector(".co-badge")?.innerText.replace(/\s+/g, " ").trim()));
    assert.ok(now.length <= 1, "one burst at a time: " + JSON.stringify(now));
    if (now[0] && now[0].startsWith("pow") && !seen.includes(now[0])) seen.push(now[0]);
    await page.waitForTimeout(150); /* real timer: sampling the bursts as they play */
  }
  assert.match(seen[0], /FANS \+\d+/); assert.match(seen[1], /TIPS \+\$5/);
});
