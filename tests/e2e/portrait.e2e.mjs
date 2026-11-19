// Make my portrait (4.99.0): optional, behind a key and a consent card; one photo goes to xAI (mocked here), only the picture is
// kept, in its own small database on this phone; it becomes the round portrait; removing it deletes it. xAI since 4.99.1.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";
useBrowser();

/* a tiny 2:3 picture the mocked xAI sends back (a PNG) */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGP4/+M/AxMDEwMDAA8WAgUyr9z1AAAAAElFTkSuQmCC";

test("4.99.0 Make my portrait: no key asks for one; with a key, consent, one photo to OpenAI, kept only on this phone; removable", { skip: skip() }, async t => {
  const lib = { ...LIB, settings: { ...LIB.settings, v: 6, theme: "dark" } };
  const page = await phone(t, lib, { home: true });
  const sent = [];
  await page.route("https://api.x.ai/**", async r => { sent.push({ url: r.request().url(), auth: r.request().headers().authorization, json: r.request().postDataJSON() }); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ data: [{ b64_json: PNG }] }) }); });
  /* the photo picker: hand over a small JPEG-ish file straight away */
  await page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 40; c.height = 60; c.getContext("2d").fillRect(0, 0, 40, 60);
    window.__pick = new Promise(ok => c.toBlob(b => ok(new File([b], "me.jpg", { type: "image/jpeg" })), "image/jpeg"));
    const orig = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () { if (this.type !== "file") return orig.call(this); window.__pick.then(f => { const dt = new DataTransfer(); dt.items.add(f); this.files = dt.files; this.dispatchEvent(new Event("change")); }); };
  });
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector("#pf-me"); await settled(page);
  await page.click("#pf-me"); await page.waitForSelector("#gm-port");
  await page.click("#gm-port");
  await page.waitForSelector(".toast"); assert.match(await page.innerText(".toast"), /xAI key in Settings/);
  assert.equal(sent.length, 0, "nothing sent without a key");
  await page.evaluate(() => localStorage.setItem("tabs.xaikey.v1", "xai-test"));
  await page.click("#gm-port"); await page.waitForSelector("#ask-ok");
  assert.match(await page.innerText(".ask"), /straight from this phone to xAI[\s\S]*keeps only the finished picture/);
  await page.click("#ask-ok");
  await page.waitForSelector("#gm-port-off");
  assert.equal(sent.length, 1, "one request");
  assert.match(sent[0].url, /\/v1\/images\/edits$/); assert.equal(sent[0].auth, "Bearer xai-test");
  assert.equal(sent[0].json.model, "grok-imagine-image-2.0"); assert.match(sent[0].json.image.url, /^data:image\/jpeg;base64,/, "the photo went with it, as a data URL"); assert.equal(sent[0].json.response_format, "b64_json");
  assert.equal(await page.locator(".gm-prev image[href^=\"data:image/\"]").count(), 1, "the preview is the portrait");
  const kept = await page.evaluate(async () => {
    const lib = localStorage.getItem("tabs-v1");
    const dbs = (await indexedDB.databases()).map(d => d.name);
    return { inLib: /data:image\//.test(lib), dbs };
  });
  assert.equal(kept.inLib, false, "the picture is not in the library or its backups");
  assert.ok(kept.dbs.includes("tabs-portrait"), "its own database on this phone");
  await page.click("#gm-ok").catch(() => {}); await page.locator(".gm").waitFor({ state: "detached" }).catch(() => {});
  await page.waitForSelector("#pf-me image[href^=\"data:image/\"]"); /* the round portrait on Your profile */
  await page.click("#pf-me"); await page.waitForSelector("#gm-port-off"); await page.click("#gm-port-off");
  await page.waitForFunction(() => !document.querySelector(".gm-prev image[href^=\"data:image/\"]"));
  assert.ok(!(await page.evaluate(async () => (await indexedDB.databases()).map(d => d.name))).includes("tabs-portrait"), "removed means deleted");
});
