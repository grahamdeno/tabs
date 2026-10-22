// What can I play next?: My level or A step up. The songs are invented.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, until, useBrowser } from "./harness.mjs";
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
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await page.waitForFunction(() => /Low Tide/.test(document.querySelector("#nx-body")?.innerText));
  assert.match(await page.innerText("#nx-body"), /Low Tide/);
  assert.match(systems[0], /Their level/);
  assert.equal(await page.getAttribute("#nx-level [data-lv='same']", "aria-pressed"), "true");

  await page.click("#nx-level [data-lv='step']"); await until(() => systems.length > 1);
  await page.waitForFunction(() => /Breakwater/.test(document.querySelector("#nx-body")?.innerText));
  assert.match(systems[1], /real step up/);
  const body = await page.innerText("#nx-body");
  assert.match(body, /Breakwater/); assert.match(body, /First barre chords/); assert.match(await page.innerText("#nx-top"), /A step up from your songs/, "4.28.0: said under the level switch");
  assert.equal(await page.locator(".nx-ch span.new").count(), 2, "both new chords are marked");

  await page.click("#nx-x"); await page.waitForFunction(() => !document.querySelector("#nx-body") && JSON.parse(localStorage.getItem("tabs-v1")).settings.nextLevel === "step");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).settings.nextLevel, "step");
  await page.click("#nextidea"); await page.waitForFunction(() => /Breakwater/.test(document.querySelector("#nx-body")?.innerText));
  assert.equal(systems.length, 2, "4.30.1: reopened within the hour, the same list without asking again");
  assert.equal(await page.getAttribute("#nx-level [data-lv='step']", "aria-pressed"), "true", "the choice is remembered");
  await page.click("#nx-scrim", { position: { x: 20, y: 10 } }).catch(() => {});
  assert.equal(await page.locator("#nx-body").count(), 1, "4.30.1: a tap outside doesn't close it");
  await page.click("#nx-more"); await until(() => systems.length > 2);
  assert.match(systems[2], /real step up/, "Show different songs still asks");
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
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await page.waitForFunction(() => document.querySelector("#nx-body")?.innerText.trim() && !document.querySelector("#nx-body .easy-wait"));
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
  await page.click("#nx-again"); await page.waitForFunction(() => /Breakwater/.test(document.querySelector("#nx-body")?.innerText));
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
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await until(() => asks.length > 0);
  assert.doesNotMatch(asks[0], /Already suggested/);
  await page.waitForSelector("#nx-more");
  await page.click("#nx-more"); await until(() => asks.length > 1);
  assert.match(asks[1], /Already suggested: Low Tide|Not these either: Low Tide/);
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
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await until(() => streamed);
  await page.waitForFunction(() => /Low Tide/.test(document.querySelector("#nx-body")?.innerText));
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
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await page.waitForSelector(".nx-err");
  assert.ok(max.every(m => m >= 8000), `room to think: ${max}`);
  assert.match(await page.textContent(".nx-err details pre"), /stopped with: max_tokens/);
});

/* 4.28.0: cards sorted by fewest new chords, the crate while it looks, Learn gets the song and then the
   lesson, and a chord the sheet doesn't have is caught instead of taught */
const CHART = { found: true, title: "Harbor Lights", artist: "The Cape Fear", album: "Northern Coast", duration: 222, key: "G", capo: 0, tuning: "standard", bpm: 90,
  sections: [{ name: "Verse", chords: "G D Em C", repeat: 1 }], confidence: "high" };
const NEXT = { songs: [
  { title: "Harbor Lights", artist: "The Cape Fear", chords: ["G", "D", "Em", "C"], new: ["C"], why: "One new chord" },
  { title: "Wrong One", artist: "The Cape Fear", chords: ["G", "C#"], new: ["C#"], why: "A sharp one" },
  { title: "Low Tide", artist: "The Dunes", chords: ["G", "D"], new: [], why: "All yours" }] };
test("4.28.0 Play next: the crate while it looks, cards fewest new chords first, Learn goes on to the lesson, a wrong chord is caught", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-ant-test"));
  let nexts = 0;
  await page.route(/api\.anthropic\.com/, async r => {
    const next = /suggest songs a guitarist/.test(JSON.stringify(JSON.parse(r.request().postData()).system));
    if (next && nexts++ === 0) await new Promise(ok => setTimeout(ok, 3600)); /* real timer: long enough to see the line change */
    r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify(next ? NEXT : CHART) }], stop_reason: "end_turn" }) });
  });
  await page.route(/lrclib\.net\/api/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: "[]" }));
  await page.route(/itunes\.apple\.com/, r => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [] }) }));
  await page.reload(); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await page.waitForSelector(".nx-dig");
  assert.ok(await page.locator(".nx-rec").count() >= 1, "records in the crate");
  assert.match(await page.innerText("#nx-line"), /Looking at your \d+ chords?/);
  await page.waitForFunction(() => /Finding songs one chord away/.test(document.getElementById("nx-line")?.textContent || ""));
  assert.equal(await page.isDisabled("#nx-level [data-lv='step']"), true, "the switch waits while it looks");
  await page.waitForSelector(".nx-card");
  const titles = await page.locator(".nx-tt b").allInnerTexts();
  assert.deepEqual(titles, ["Low Tide", "Harbor Lights", "Wrong One"], "fewest new chords first");
  assert.match(await page.innerText(".nx-card >> nth=1"), /New\s*C\s*You know G, D, Em/i);
  assert.equal(await page.locator(".nx-card >> nth=1 >> .nx-shape svg").count(), 1, "the new chord's shape");
  assert.equal(await page.innerText("#nx-foot"), "Show different songs", "the only button at the bottom");
  /* Learn: Get the song, then the chord's lesson */
  await page.click(".nx-card >> nth=1 >> .nx-learn");
  await page.waitForSelector("#gs-add", { timeout: 8000 });
  assert.equal(await page.innerText("#gs-add"), "Add and learn C");
  await page.click("#gs-add");
  await page.waitForFunction(() => decodeURIComponent(location.hash) === "#/practice/c:C");
  /* a chord the sheet doesn't have: said, not taught */
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector("#q");
  await page.click("#q").catch(() => {}); await page.waitForSelector("#nextidea");
  await page.click("#nextidea"); await page.waitForSelector(".nx-card");
  await page.click(".nx-card:has-text('Wrong One') >> .nx-learn");
  await page.waitForSelector(".gs-teach", { timeout: 8000 });
  assert.match(await page.innerText(".gs-teach"), /Play next said C#, but this sheet doesn't use it/);
  assert.equal(await page.innerText("#gs-add"), "Add to my songs");
  await page.click("#gs-add");
  await page.waitForFunction(() => /#\/song\//.test(location.hash));
  assert.match(await page.innerText("#toast"), /doesn't use C#, so there's no C# lesson/);
});
