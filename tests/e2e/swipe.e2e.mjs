// Swipe a song in the library (2.27.0): left for Delete (with Undo), right for Favorite.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const lib = () => JSON.parse(LIB_JSON);
const LIB_JSON = JSON.stringify({ ...LIB, songs: [...LIB.songs, { id: "c", title: "Clear Water", artist: "Me", key: "D", format: "chords", body: "[Verse]\nD G\nla" }] });
async function drag(page, sel, dx) {
  const b = await page.locator(sel).boundingBox(), y = b.y + b.height / 2, x = b.x + b.width / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + 2, { steps: 10 }); await page.mouse.up(); await page.waitForTimeout(450);
}
const ids = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.map(s => s.id));

test("Swipe left: a short swipe shows Delete; a long one deletes, with Undo", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  const row = ".list .row[data-id='c']";
  await drag(page, row, -90);
  assert.ok(await page.evaluate(() => document.querySelector(".sw-del").offsetWidth > 60), "Delete shows");
  assert.match(await page.evaluate(() => location.hash), /^#\/?$|^$/, "the song didn't open");
  await page.click(".list .sw:has(.row[data-id='c']) .sw-del"); await page.waitForTimeout(300);
  assert.ok(!(await ids(page)).includes("c"), "deleted");
  assert.match(await page.innerText("#toast"), /Deleted "Clear Water"/);
  await page.click("#toast button"); await page.waitForTimeout(300);
  assert.ok((await ids(page)).includes("c"), "Undo brings it back");
  await drag(page, row, -330);
  assert.ok(!(await ids(page)).includes("c"), "a long swipe deletes at once");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).trash[0].item.id, "c", "in Recently deleted");
});

test("Swipe right toggles Favorite; a scroll or a tap still works as before", { skip: skip() }, async t => {
  const page = await phone(t, lib());
  await drag(page, ".list .row[data-id='c']", 120);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").favorite, true);
  await page.click(".list .row[data-id='c']"); await page.waitForTimeout(300);
  assert.match(await page.evaluate(() => location.hash), /#\/song\/c/, "a tap opens the song");
});
