// Changes: chord changes counted from plays, in the Today line and a sheet.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser } from "./harness.mjs";
useBrowser();

const DAY = 86400000;
const key = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const log = (...ago) => ({ total: ago.length, last: Math.max(...ago.map(n => Date.now() - n * DAY)), days: Object.fromEntries(ago.map(n => [key(Date.now() - n * DAY), 1])) });
const songs = [
  { id: "g", title: "Porch Song", artist: "Me", format: "chords", body: "[Verse]\nG       C\nevening on the porch\nG       D\nlight is going down", playLog: log(1, 2) },
  { id: "f", title: "Harbor Lights", artist: "Me", format: "chords", body: "[Verse]\nAm      F\ngrey boats on the wall\nAm      F\nwaiting on the tide\nAm  F  C  G\n" }
];

test("Changes: the Today line opens the week's changes, and the nudge points at the one to work on", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs, settings: { ...LIB.settings, nudge: true } }, { fixedTime: new Date(new Date().setHours(10, 0, 0, 0)).toISOString() });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/chg-today.png" });
  assert.match(await page.innerText("#nudge"), /Work on Am to F\. This one has it \d+ times\s+Harbor Lights/);
  await page.click("#t-stat"); await page.waitForTimeout(300);
  const sheet = await page.innerText(".panel");
  assert.match(sheet, /Most played/i); assert.match(sheet, /C\s*→\s*G/, "G and C, the way your songs mostly go");
  assert.match(sheet, /To work on/i); assert.match(sheet, /Am\s*→\s*F/);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/chg-sheet.png" });
  await page.click("#chg-go"); await page.waitForTimeout(400);
  assert.match(await page.evaluate(() => location.hash), /#\/song\/f/);
});
