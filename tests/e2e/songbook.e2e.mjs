// Road Ready, step 07: the Songbook in the Road Ready looks, and the three mastery levels.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const libWith = (theme, extra = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "a").status ?? null);

test("Road Ready 07: the song page steps through none, Learning, Solid, Nailed it and back to none, and Nailed it is a milestone", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  await page.evaluate(() => { location.hash = "#/song/a"; });
  await page.waitForSelector("#stat"); await settled(page);
  assert.match(await page.innerText("#stat"), /Mark as learning/);
  for (const [label, stored] of [["Learning", "learning"], ["Solid", "solid"], ["Nailed it", "got"]]) {
    await page.click("#stat");
    await page.waitForFunction(s => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a").status === s, stored);
    assert.equal((await page.innerText("#stat")).trim(), label, `the button says ${label}`);
    assert.match(await page.getAttribute("#stat", "class"), new RegExp(`\\b${stored}\\b`));
    await page.waitForFunction(l => [...document.querySelectorAll(".toast")].some(x => x.textContent.includes(l)), label);
  }
  const firsts = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).journal?.firsts || []);
  assert.ok(firsts.some(f => f.kind === "got" && f.name === "River Road"), "reaching Nailed it records the milestone");
  await page.click("#stat");
  await page.waitForFunction(() => !("status" in JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "a")));
  assert.equal(await saved(page), null, "a fourth tap clears it");
  assert.match(await page.innerText("#stat"), /Mark as learning/);
});
