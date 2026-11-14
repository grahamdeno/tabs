// The Listening booth (4.90.0): record a labelled take, see what was heard, send it to the booth branch.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, FAKE_MIC, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

test("4.90.0 the booth records a C, says what it heard, and sends the take and its label to the booth branch", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.addInitScript(FAKE_MIC);
  await page.reload(); await page.waitForFunction(() => document.getElementById("app")?.childElementCount > 0);
  await page.evaluate(() => { location.hash = "#/practice/hear"; });
  await page.waitForSelector("#ph-booth"); await settled(page);
  await page.click("#ph-booth"); await page.waitForSelector(".bt-chords"); await settled(page);
  assert.ok(await page.locator("#bt-rec").isDisabled(), "nothing to record until a chord is picked");
  await page.click('.bt-chords [data-c="C"]');
  assert.match(await page.innerText("#bt-what"), /Recording C/);
  await page.evaluate(async () => { const C = await import("/core.js"); window.__chord = C.chordTargets("C").filter(x => x.hz > 0).map(x => x.hz); });
  await page.click("#bt-rec");
  await page.waitForFunction(() => /C on \d+% of what I heard/.test(document.getElementById("bt-say")?.textContent));
  await page.waitForTimeout(2500); /* real timer: a take must be a few seconds long */
  await page.click("#bt-rec");
  await page.waitForSelector(".bt-take");
  assert.match(await page.innerText(".bt-take"), /^C\n\d+ s · C on \d+%/);
  assert.match(await page.innerText("#bt-send"), /Send 1/);
  /* Send without a key opens the setup */
  await page.click("#bt-send");
  await page.waitForFunction(() => document.querySelector(".bt-setup")?.open);
  /* GitHub, pretend: no booth branch yet, so it's made from main, then the take and its label */
  const puts = [];
  let made = null;
  await page.route("https://api.github.com/**", async r => {
    const u = r.request().url(), m = r.request().method();
    if (m === "GET" && u.endsWith("/git/ref/heads/booth")) return r.fulfill({ status: 404, body: "{}" });
    if (m === "GET" && u.endsWith("/git/ref/heads/main")) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ object: { sha: "abc123" } }) });
    if (m === "POST" && u.endsWith("/git/refs")) { made = JSON.parse(r.request().postData()); return r.fulfill({ status: 201, body: "{}" }); }
    if (m === "PUT") { puts.push({ u, auth: r.request().headers().authorization, body: JSON.parse(r.request().postData()) }); return r.fulfill({ status: 201, body: "{}" }); }
    return r.fulfill({ status: 500, body: "{}" });
  });
  await page.fill("#bt-key", "github_pat_test"); await page.dispatchEvent("#bt-key", "change");
  await page.click("#bt-send");
  await page.waitForFunction(() => /^Sent 1/.test(document.getElementById("bt-say")?.textContent));
  assert.deepEqual(made, { ref: "refs/heads/booth", sha: "abc123" });
  assert.equal(puts.length, 2);
  assert.match(puts[0].u, /\/contents\/booth\/\d{4}-\d\d-\d\d\/C-\w+\.wav$/);
  assert.match(puts[1].u, /\.json$/);
  assert.ok(puts.every(p => p.body.branch === "booth" && p.auth === "Bearer github_pat_test"));
  const wavHead = Buffer.from(puts[0].body.content, "base64");
  assert.equal(wavHead.toString("ascii", 0, 4), "RIFF");
  assert.equal(wavHead.readUInt32LE(24), 22050, "saved at 22,050 a second");
  const label = JSON.parse(Buffer.from(puts[1].body.content, "base64").toString());
  assert.deepEqual(label.chords, ["C"]); assert.equal(label.kind, "chord");
  assert.ok(label.heard.reads > 0, "what the engine heard goes with it");
  assert.ok(!JSON.stringify(label).includes("github_pat"), "the key is not in the label");
  await page.waitForSelector(".bt-none");
  /* the key stays on the phone, outside the app's saved library */
  assert.ok(!(await page.evaluate(() => localStorage.getItem("tabs-v1"))).includes("github_pat"));
});
