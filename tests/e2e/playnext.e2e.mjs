// What can I play next?: My level or A step up. The songs are invented.
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
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(/real step up/.test(sys) ? STEP : SAME) }], stop_reason: "end_turn" }) });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
  assert.match(systems[0], /Their level/);
  assert.equal(await page.getAttribute("#nx-level [data-lv='same']", "aria-pressed"), "true");

  await page.click("#nx-level [data-lv='step']"); await page.waitForTimeout(500);
  assert.match(systems[1], /real step up/);
  const body = await page.innerText("#nx-body");
  assert.match(body, /Breakwater/); assert.match(body, /First barre chords/); assert.match(body, /A step up from your songs/);
  assert.equal(await page.locator(".nx-ch span.new").count(), 2, "both new chords are marked");

  await page.click("#nx-x"); await page.waitForTimeout(200);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.nextLevel, "step");
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.match(systems[2], /real step up/, "the choice is remembered");
});

// replies with a stray brace before the JSON, one bad reply, or two.
async function openWith(t, replies, extra = {}) {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, ...extra } });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  const calls = { n: 0 };
  await page.route(/api\.anthropic\.com/, r => {
    const text = replies[Math.min(calls.n++, replies.length - 1)];
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }) });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForTimeout(700);
  return { page, calls };
}

test("Play next: a note with braces ahead of the JSON still reads", { skip: skip() }, async t => {
  const { page, calls } = await openWith(t, [`Using your chords {G, C, D}:\n\`\`\`json\n${JSON.stringify(SAME)}\n\`\`\``]);
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
  assert.equal(calls.n, 1);
});

test("Play next: one unreadable reply is retried quietly", { skip: skip() }, async t => {
  const { page, calls } = await openWith(t, ["Sorry, here are some ideas", JSON.stringify(SAME)]);
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
  assert.equal(calls.n, 2);
});

test("Play next: two unreadable replies show a clear message, Try again in the footer, and what came back", { skip: skip() }, async t => {
  const { page, calls } = await openWith(t, ["Sorry, I can't help with that.", "Sorry, I can't help with that.", JSON.stringify(STEP)], { nextLevel: "step", theme: "dark" });
  assert.equal(calls.n, 2);
  assert.match(await page.innerText("#nx-body"), /No suggestions this time/);
  assert.doesNotMatch(await page.innerText("#nx-body"), /keep the original/);
  assert.equal(await page.locator("#nx-more").count(), 0, "no Show different songs without songs");
  assert.equal(await page.locator("#nx-foot #nx-again").count(), 1, "Try again sits in thumb reach");
  const h = await page.evaluate(() => [document.querySelector("#nx-again").offsetHeight, document.querySelector("#nx-level button").offsetHeight]);
  assert.ok(h[0] >= 44 && h[1] >= 34, `buttons keep their height: ${h}`);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/nx-err.png" });
  await page.click("#nx-again"); await page.waitForTimeout(700);
  assert.match(await page.innerText("#nx-body"), /Breakwater/);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/nx-ok.png" });
});

test("Play next: songs already shown are sent along so the list moves on (2.13.1)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => { localStorage.setItem("tabs.apikey.v1", "sk-ant-test"); localStorage.removeItem("tabs.nextseen.v1"); });
  const asks = [];
  await page.route(/api\.anthropic\.com/, r => {
    asks.push(JSON.parse(r.request().postData()).messages[0].content);
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(SAME) }], stop_reason: "end_turn" }) });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.doesNotMatch(asks[0], /Already suggested/);
  await page.click("#nx-x"); await page.waitForTimeout(200);
  await page.click("#nextidea"); await page.waitForTimeout(500);
  assert.match(asks[1], /Already suggested: Low Tide/);
  assert.match(asks[1], /Variety number: \d+/);
});

test("Play next: the reply is streamed, so a long wait keeps the connection alive (2.16.2)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  let streamed = false;
  await page.route(/api\.anthropic\.com/, r => {
    streamed = JSON.parse(r.request().postData()).stream === true;
    const text = JSON.stringify(SAME), half = text.length >> 1;
    const ev = d => `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: d } })}\n\n`;
    r.fulfill({ status: 200, contentType: "text/event-stream", headers: cors, body: ev(text.slice(0, half)) + ev(text.slice(half)) + "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n" });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForTimeout(600);
  assert.equal(streamed, true);
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
});

test("Play next: an empty reply says why it ended, and the AI gets room to think (2.16.6)", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  const max = [];
  await page.route(/api\.anthropic\.com/, r => {
    max.push(JSON.parse(r.request().postData()).max_tokens);
    const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
    r.fulfill({ status: 200, contentType: "text/event-stream", headers: cors, body:
      ev("content_block_delta", { type: "content_block_delta", delta: { type: "thinking_delta", thinking: "Let me think about harder songs..." } }) +
      ev("message_delta", { type: "message_delta", delta: { stop_reason: "max_tokens" } }) + ev("message_stop", { type: "message_stop" }) });
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.click("#q").catch(() => {}); await page.waitForTimeout(300);
  await page.click("#nextidea"); await page.waitForSelector(".nx-err");
  assert.ok(max.every(m => m >= 8000), `room to think: ${max}`);
  assert.match(await page.textContent(".nx-err details pre"), /stopped with: max_tokens/);
});
