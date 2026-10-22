// Support The Road (4.39.0): from More, a thank-you page with the Ko-fi link; nothing in the app changes.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

test("4.39.0 Support The Road: More opens it, the Ko-fi link opens outside the app, Tell a friend shares the app", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { home: true });
  await page.click("#tabs [data-tab=more]"); await page.waitForSelector("#m-sup");
  assert.match(await page.innerText("#m-sup"), /Support The Road/);
  await page.click("#m-sup"); await page.waitForSelector("#sp-kofi"); await settled(page);
  assert.equal(await page.evaluate(() => location.hash), "#/support");
  assert.equal(await page.getAttribute("#sp-kofi", "href"), "https://ko-fi.com/theroadapp");
  assert.equal(await page.getAttribute("#sp-kofi", "target"), "_blank", "opens outside the app");
  assert.match(await page.innerText(".sp"), /Everything stays free/);
  assert.equal(await page.getAttribute("#tabs [data-tab=more]", "aria-current"), "page", "lit under More");
  await page.evaluate(() => { navigator.share = undefined; });
  await page.click("#sp-share"); await page.waitForFunction(() => /grahamdeno\.github\.io\/tabs/.test(document.querySelector(".ask input, .ask textarea")?.value || ""));
});
