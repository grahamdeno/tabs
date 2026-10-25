// 4.67.0: Get the chords: Louie picks the best-rated chart for your level; you copy it, come back, and it's pasted in.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, LIB, useBrowser, settled } from "./harness.mjs";

useBrowser();

test("Get the chords: the best-rated chart for your level, then Paste on the way back adds the song with Undo (4.67.0)", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { permissions: ["clipboard-read", "clipboard-write"] });
  const asked = [];
  const pick = { found: true, url: "https://tabs.ultimate-guitar.com/tab/the-wanderers/lantern-chords-123", site: "Ultimate Guitar", kind: "chords", rating: 4.8, votes: 2103, difficulty: "beginner", why: "The top-rated version marked beginner." };
  await page.route("https://api.anthropic.com/**", r => {
    asked.push(JSON.parse(r.request().postData() || "{}"));
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [
      { type: "web_search_tool_result", content: [{ url: pick.url, title: "Lantern chords" }] },
      { type: "text", text: JSON.stringify(pick) }], stop_reason: "end_turn" }) });
  });
  await page.evaluate(() => { localStorage.setItem("tabs.apikey.v1", "sk-test"); window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.evaluate(() => import("/findai.js").then(m => m.chartLinkSheet({ title: "Lantern", artist: "The Wanderers", rec: { url: "https://music.apple.com/us/album/x/1?i=55", title: "Lantern", artist: "The Wanderers", length: 200 } })));
  await page.waitForSelector("#cl-open");
  assert.match(await page.innerText(".cl-sheet"), /Lantern[\s\S]*Ultimate Guitar · Chords · beginner[\s\S]*4\.8[\s\S]*2,103 ratings[\s\S]*Open the chart/i);
  assert.match(JSON.stringify(asked[0].messages), /Level: Intermediate/, "the level you're at goes with the question");
  /* a different level asks again */
  await page.click("[data-lv='easy']"); await page.waitForFunction(() => document.querySelector("[data-lv='easy']").getAttribute("aria-pressed") === "true");
  await page.waitForSelector("#cl-open");
  assert.match(JSON.stringify(asked[1].messages), /Level: Beginner/);
  await page.click("#cl-open");
  assert.deepEqual(await page.evaluate(() => window.__opened), [pick.url], "Open the chart opens that page");
  /* back from the site: the paste sheet, then the song is added at once */
  await page.evaluate(() => navigator.clipboard.writeText("[Verse]\nG        C\nLantern in the window\nD        G\nCarry me home\n\n[Chorus]\nC   G\nHome again"));
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForSelector("#bk-go");
  assert.match(await page.innerText(".panel.backpaste"), /Paste the chords for “Lantern”\?/);
  await page.click("#bk-go");
  await page.waitForFunction(() => /#\/song\//.test(location.hash) && JSON.parse(localStorage.getItem("tabs-v1")).songs.some(s => s.title === "Lantern"));
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.title === "Lantern"));
  assert.equal(s.artist, "The Wanderers", "named for the song you went to get");
  await page.waitForFunction(() => /i=55/.test(JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.title === "Lantern").listen?.url || ""));
  await page.waitForSelector("#toast .tact");
  assert.match(await page.innerText("#toast"), /Lantern added: 2 sections, 3 chords/);
  await page.click("#toast .tact");
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem("tabs-v1")).songs.some(x => x.title === "Lantern"));
});

test("Get the chords: a made-up link (not a chord site) isn't opened; you search the site instead (4.67.0)", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: JSON.stringify({ found: true, url: "https://example.com/lantern" }) }], stop_reason: "end_turn" }) }));
  await page.evaluate(() => { localStorage.setItem("tabs.apikey.v1", "sk-test"); window.__opened = []; window.open = u => { window.__opened.push(u); return null; }; });
  await page.goto(base + "#/library"); await page.waitForSelector("#add"); await settled(page);
  await page.evaluate(() => import("/findai.js").then(m => m.chartLinkSheet({ title: "Lantern", artist: "" })));
  await page.waitForSelector(".cl-none");
  await page.click("#cl-open");
  const opened = await page.evaluate(() => window.__opened[0]);
  assert.match(opened, /^https:\/\/www\.ultimate-guitar\.com\/search\.php\?search_type=title&value=Lantern$/);
});
