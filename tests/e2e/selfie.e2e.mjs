// Start from a selfie (Gig poster, 2026-11-19): the photo only sets the maker's starting skin tone, hair colour and
// beard; it is never saved, and nothing is stored until THAT'S ME or Done.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const PLAYED = songs => songs.map(s => ({ ...s, playLog: { days: { "2026-10-28": 12, "2026-10-29": 12 } } }));
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")));
const START = { skin: 0, hair: "locs", hairCol: "purple", top: "teal" };

async function openMaker(t) {
  const page = await phone(t, { ...LIB, songs: PLAYED(LIB.songs), me: START }, { home: true });
  await page.waitForSelector("#rd-bubble");
  await page.evaluate(() => { location.hash = "#/you"; }); await page.waitForSelector(".rr-me");
  await page.click("#pf-me"); await page.waitForSelector(".gm #gm-selfie");
  return page;
}
/* a picture made in the page: [fill, x, y, w, h] boxes on a grey ground, returned as PNG bytes */
const picture = (page, boxes) => page.evaluate(async boxes => {
  const c = document.createElement("canvas"); c.width = 200; c.height = 200; const x = c.getContext("2d");
  x.fillStyle = "#808080"; x.fillRect(0, 0, 200, 200);
  for (const [f, a, b, w, h] of boxes) { x.fillStyle = f; x.fillRect(a, b, w, h); }
  const blob = await new Promise(r => c.toBlob(r, "image/png"));
  return [...new Uint8Array(await blob.arrayBuffer())];
}, boxes);
async function choose(page, bytes) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click("#gm-selfie")]);
  await chooser.setFiles({ name: "me.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
}

test("Selfie: the button says the photo stays on the phone; with no face, it says so and the maker stays (real face finder)", { skip: skip() }, async t => {
  const page = await openMaker(t);
  assert.match(await page.innerText(".gm .gm-selfie"), /Your photo stays on this phone and is never saved\./);
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await choose(page, await picture(page, []));
  await page.waitForSelector(".gm .gm-selfie-msg", { timeout: 60000 });
  assert.match(await page.innerText(".gm .gm-selfie-msg"), /Couldn't read that one\. Pick a starter instead\./);
  assert.equal(await page.locator(".gm").count(), 1, "still in the maker");
  assert.deepEqual(errors, [], "no page errors while the face finder loads");
  assert.equal((await stored(page)).me.skin, 0, "nothing changed");
});

test("Selfie: a face sets skin, hair colour and beard in the preview; nothing is saved until Done; the photo is not stored", { skip: skip() }, async t => {
  const page = await openMaker(t);
  /* a stand-in face finder: one face, its box at 60,60 80x100, eyes, nose, mouth and ears as MediaPipe gives them */
  await page.route("**/vendor/mediapipe/vision_bundle.mjs", r => r.fulfill({ contentType: "text/javascript", body: `
    export const FilesetResolver = { forVisionTasks: async () => ({}) };
    export const FaceDetector = { createFromOptions: async () => ({ detect: () => ({ detections: [{ boundingBox: { originX: 60, originY: 60, width: 80, height: 100 },
      keypoints: [{ x: .4, y: .45 }, { x: .6, y: .45 }, { x: .5, y: .55 }, { x: .5, y: .66 }, { x: .3, y: .5 }, { x: .7, y: .5 }] }] }) }) };` }));
  const before = await page.evaluate(async () => ({ idb: (await indexedDB.databases?.() || []).map(d => d.name).sort(), caches: (await caches.keys()).sort() }));
  /* hair above and beside the face, skin SKIN[4] (#93603E) on the face, a dark chin */
  await choose(page, await picture(page, [["#1d1a1b", 40, 30, 120, 70], ["#93603E", 60, 60, 80, 100], ["#3a2a20", 85, 140, 30, 20]]));
  await page.waitForSelector(".gm .gm-selfie-msg");
  assert.match(await page.innerText(".gm .gm-selfie-msg"), /Here's a start from your photo/);
  assert.equal(await page.getAttribute('.gm [data-k="skin"][data-v="4"]', "aria-pressed"), "true", "skin tone 5 of 6");
  await page.click("#gm-t-hair");
  assert.equal(await page.getAttribute('.gm [data-k="hairCol"][data-v="black"]', "aria-pressed"), "true", "black hair");
  assert.equal((await stored(page)).me.skin, 0, "not saved yet");
  await page.click("#gm-ok");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).me?.skin === 4);
  const me = (await stored(page)).me;
  assert.equal(me.hairCol, "black"); assert.equal(me.beard, "beard"); assert.equal(me.hair, "locs", "hair style is not guessed");
  const after = await page.evaluate(async () => ({ idb: (await indexedDB.databases?.() || []).map(d => d.name).sort(), caches: (await caches.keys()).sort() }));
  assert.deepEqual(after, before, "no new database or cache");
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes("data:image"), "no picture in saved data");
});
