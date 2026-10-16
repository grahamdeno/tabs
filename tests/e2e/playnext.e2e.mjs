// What can I play next? (2.12): My level or A step up. The songs are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const cors = { "access-control-allow-origin": "*" };
const SAME = { songs: [{ title: "Low Tide", artist: "The Dunes", chords: ["G", "C", "D"], new: "", why: "Three chords you play" }] };
const STEP = { songs: [{ title: "Breakwater", artist: "Pier Nine", chords: ["G", "F", "C", "Bm"], new: ["F", "Bm"], why: "First barre chords: F and Bm" }] };

test("Play next: switch to A step up, the AI is asked for harder songs, and the choice is kept", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  const systems = [];
  await page.route(/api\.anthropic\.com/, r => {
    const sys = JSON.stringify(JSON.parse(r.request().postData()).system);
    systems.push(sys);
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(/A step up/.test(sys) ? STEP : SAME) }], stop_reason: "end_turn" }) });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
  assert.match(systems[0], /Their level/);
  assert.equal(await page.getAttribute("#nx-level [data-lv='same']", "aria-pressed"), "true");

  await page.click("#nx-level [data-lv='step']"); await page.waitForTimeout(500);
  assert.match(systems[1], /A step up/);
  const body = await page.innerText("#nx-body");
  assert.match(body, /Breakwater/); assert.match(body, /First barre chords/); assert.match(body, /A step up from your songs/);
  assert.equal(await page.locator(".nx-ch span.new").count(), 2, "both new chords are marked");

  await page.click("#nx-x"); await page.waitForTimeout(200);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.nextLevel, "step");
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.match(systems[2], /A step up/, "the choice is remembered");
});
