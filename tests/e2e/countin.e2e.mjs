// 4.68.0: the count-in: Louie jumps on every beat and bangs his head with the horns up on the last.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser, settled } from "./harness.mjs";

useBrowser();
const LONG = { id: "g", title: "Long Road", artist: "Me", key: "A", format: "chords", duration: 200, bpm: 60,
  body: "[Verse]\n" + Array.from({ length: 8 }, (_, i) => `A        D\nVerse line ${i + 1}`).join("\n") };

test("Count-in: Louie jumps on each beat, and on the last the horns go up and he bangs his head (4.68.0)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [LONG], settings: { ...LIB.settings, plainPlay: false, gigScore: false, countIn: true } });
  await page.goto(base + "#/song/g"); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play");
  await page.waitForFunction(() => document.querySelector("#st-open .so-n")?.textContent === "1");
  const one = await page.evaluate(() => { const l = document.querySelector("#st-open .so-lou"); return { beat: l.classList.contains("beat"), bang: l.classList.contains("bang"), moving: l.getAnimations().length > 0 }; });
  assert.deepEqual(one, { beat: true, bang: false, moving: true }, "beat 1: a jump, no headbang");
  await page.waitForFunction(() => document.querySelector("#st-open .so-n")?.textContent === "4", null, { timeout: 8000 });
  const four = await page.evaluate(() => { const l = document.querySelector("#st-open .so-lou"); return { bang: l.classList.contains("bang"), names: l.getAnimations().map(a => a.animationName).sort(), horns: !!l.querySelector("svg") }; });
  assert.equal(four.bang, true, "the last beat bangs his head");
  assert.deepEqual(four.names, ["so-bang", "so-jump"]);
});
