// 4.64.0: the editor places chords the way a chart does (chips, + beside a chord, before the words, a chord row).
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser, tool, settled } from "./harness.mjs";

useBrowser();

const lib = body => ({ ...LIB, songs: [{ id: "c", title: "Chips", artist: "Me", key: "F", format: "chords", body, duration: 30 }] });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "c").body);
const waitBody = (page, re) => page.waitForFunction(r => new RegExp(r).test(JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "c").body), re.source);
const pick = async (page, root, quals) => { await page.click(`#ce-panel [data-r='${root}']`); if (quals) await page.click(`#ce-panel [data-q='${quals}']`); await page.click("#ce-place"); };

test("Edit builds a chart's lead-in chords with taps, then Undo, a chord row and removing the middle chord (4.64.0)", { skip: skip() }, async t => {
  const page = await phone(t, lib("[Verse]\nWalking down the river road"));
  await page.goto(base + "#/song/c"); await page.waitForSelector(".metarow");
  await tool(page, "edit"); await page.waitForSelector(".ce-line[data-line='1']");
  /* F, then Am beside it, then G beside that, all before the words */
  await page.click(".ce-line[data-line='1'] .ce-lead .ce-pl"); await page.waitForSelector("#ce-panel");
  assert.match(await page.innerText(".pc-head"), /before the words/i);
  await pick(page, "F"); await waitBody(page, /^\[Verse\]\nF\n {2,}Walking/);
  await settled(page);
  await page.click(".ce-line[data-line='2'] .ce-lead .ce-pl"); await page.waitForSelector("#ce-panel");
  assert.match(await page.innerText(".pc-head"), /after F/i);
  await pick(page, "A", "m"); await waitBody(page, /\nF Am\n/);
  await settled(page);
  await page.click(".ce-line[data-line='2'] .ce-lead .ce-pl"); await pick(page, "G");
  await waitBody(page, /^\[Verse\]\nF Am G\n {6}Walking down the river road$/);
  assert.equal(await saved(page), "[Verse]\nF Am G\n      Walking down the river road");
  /* Undo takes the last chord back */
  await page.click("#toast .tact");
  await waitBody(page, /\nF Am\n/);
  assert.doesNotMatch(await saved(page), /G/);
  await settled(page);
  await page.click(".ce-line[data-line='2'] .ce-lead .ce-pl"); await pick(page, "G");
  await waitBody(page, /F Am G\n/);
  /* a chord after the last word */
  await settled(page);
  await page.click(".ce-line[data-line='2'] .ce-after .ce-pl"); await page.waitForSelector("#ce-panel");
  assert.match(await page.innerText(".pc-head"), /after the line/i);
  await pick(page, "F");
  await waitBody(page, /^\[Verse\]\nF Am G +F\n/);
  const b = await saved(page);
  assert.match(b.split("\n")[1], /^F Am G +F$/, "trailing chord sits on the chord line");
  /* a chord-only row from the Chords button, then remove the middle chord of three */
  await settled(page);
  await page.click("[data-chords]"); await page.waitForSelector("#ce-panel");
  await pick(page, "C"); await waitBody(page, /river road\nC$/);
  await settled(page);
  await page.click(".ce-cl .ce-pl"); await pick(page, "D"); await waitBody(page, /\nC {3}D$/);
  await settled(page);
  await page.click(".ce-cl .ce-pl"); await pick(page, "E"); await waitBody(page, /\nC {3}D {3}E$/);
  await settled(page);
  await page.click(".ce-cl .ce-ch[data-chord='D']"); await page.click("#ce-rm");
  await waitBody(page, /\nC {3}E$/);
  /* nothing in the editor scrolls sideways at 390 wide */
  const over = await page.evaluate(() => ({ page: document.scrollingElement.scrollWidth - innerWidth, chips: [...document.querySelectorAll(".ce-ch")].filter(c => c.getBoundingClientRect().right > innerWidth).length }));
  assert.deepEqual(over, { page: 0, chips: 0 }, "nothing in the editor runs off the side at 390 wide");
  /* chips are thumb sized */
  const small = await page.evaluate(() => [...document.querySelectorAll(".ce-ch")].filter(c => c.getBoundingClientRect().height < 43 || c.getBoundingClientRect().width < 43).length);
  assert.equal(small, 0, "chips are at least 44 px");
});

test("Edit: several chords on one word each get a chip, and a chord can be added beside one (4.64.0)", { skip: skip() }, async t => {
  const page = await phone(t, lib("[Verse]\nF   Am\nHome again tonight"));
  await page.goto(base + "#/song/c"); await page.waitForSelector(".metarow");
  await tool(page, "edit"); await page.waitForSelector(".ce-line");
  assert.deepEqual(await page.$$eval(".ce-line .ce-ch:not(.ce-pl)", els => els.map(e => e.textContent)), ["F", "Am"]);
  await page.click(".ce-line .ce-wd .ce-pl"); await page.waitForSelector("#ce-panel");
  assert.match(await page.innerText(".pc-head"), /after/i);
  await pick(page, "G");
  await page.waitForFunction(() => document.querySelectorAll(".ce-line .ce-ch:not(.ce-pl)").length === 3);
  assert.deepEqual(await page.$$eval(".ce-line .ce-ch:not(.ce-pl)", els => els.map(e => e.textContent)), ["F", "G", "Am"], "a chord added after F lands beside it");
});
