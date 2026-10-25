// 4.74.0: Sing it: a take split at the breaths, its markers moved, lines joined and split, a line's options, Your song.
import test from "node:test";
import assert from "node:assert/strict";
import { base, LIB, skip, useBrowser, FAKE_MIC, chromium } from "./harness.mjs";

useBrowser();
test("Sing it: three phrases make three lines; a marker drags, a line joins the next, a tap on the melody splits it (4.74.0)", { skip: skip() }, async t => {
  const b2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => b2.close());
  const ctx = await b2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base + "#/library"); await page.waitForSelector("#add");
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.goto(base + "#/sketch"); await page.reload(); await page.waitForSelector("#sk-pad");
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const sing = async ms => { for (const m of ms) { await page.evaluate(f => { window.__hz = f; }, hz(m)); await page.waitForTimeout(400); /* real timer */ } };
  const rest = async ms => { await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(ms); /* real timer */ };
  await page.click("#sk-pad"); await page.waitForSelector("#sk-rib");
  await sing([55, 59, 62, 59, 60]); await rest(900);
  await sing([62, 66, 57, 62, 59]); await rest(900);
  await sing([64, 64, 60, 59, 55]); await rest(200);
  await page.click("#sk-pad"); await page.waitForSelector(".skl");
  assert.equal(await page.locator(".skl").count(), 3);
  await page.keyboard.type("One"); await page.keyboard.press("Enter"); await page.keyboard.type("Two"); await page.keyboard.press("Enter"); await page.keyboard.type("Three");
  await page.evaluate(() => document.activeElement.blur()); await page.waitForFunction(() => !document.getElementById("sk-words"));
  const words = () => page.$$eval(".skl .sknb-line", b => b.map(x => x.getAttribute("aria-label").replace(/^Line \d+: (.*)\. Tap.*$/, "$1")));
  assert.deepEqual(await words(), ["One", "Two", "Three"]);
  /* drag the first marker almost to the second: line 2 shrinks to nothing but the minimum, the words stay with their lines */
  const strip = await page.locator("#sk-strip").boundingBox(), cut = await page.locator(".sk-cut[data-cut='0']").boundingBox();
  await page.mouse.move(cut.x + cut.width / 2, cut.y + 20); await page.mouse.down();
  await page.mouse.move(strip.x + 30, cut.y + 20, { steps: 4 }); await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll(".skl").length === 3);
  assert.equal(await page.locator(".skl").count(), 3, "still three lines after a drag");
  /* join line 1 with line 2 from its options */
  await page.click("[data-opts='0']"); await page.waitForSelector("#ls-join");
  await page.click("#ls-join"); await page.waitForFunction(() => document.querySelectorAll(".skl").length === 2);
  assert.deepEqual(await words(), ["One Two", "Three"], "joined lines join their words");
  /* a tap on the melody near its end splits it there */
  const s2 = await page.locator("#sk-strip").boundingBox();
  await page.mouse.click(s2.x + s2.width * 0.3, s2.y + s2.height / 2);
  await page.waitForFunction(() => document.querySelectorAll(".skl").length === 3);
  /* a line's options: other ways to play it, and Remove with Undo */
  await page.click("[data-opts='2']"); await page.waitForSelector(".sk-sheet");
  assert.match(await page.innerText(".sk-sheet"), /LINE 3[\s\S]*Hear it[\s\S]*Sing again[\s\S]*Words[\s\S]*Remove line 3/);
  await page.click("#ls-rm"); await page.waitForFunction(() => document.querySelectorAll(".skl").length === 2);
  await page.click("#toast .tact"); await page.waitForFunction(() => document.querySelectorAll(".skl").length === 3);
  /* Your song: Play turns to Pause, the first line lights, the feel can change */
  await page.click("#sk-done"); await page.waitForSelector("#sk-play");
  await page.click("#sk-play"); await page.waitForSelector(".sks-l.on");
  assert.equal(await page.getAttribute("#sk-play", "aria-label"), "Pause");
  await page.click("[data-feel='ballad']"); await page.waitForFunction(() => document.querySelector("[data-feel='ballad']").getAttribute("aria-pressed") === "true");
  await page.click("#sk-edit"); await page.waitForSelector(".skl");
  assert.deepEqual(errors, []);
});
