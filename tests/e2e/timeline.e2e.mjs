// Chord timeline (5.11.0): Timeline over each line, the only way songs show since 5.17.2. The song is invented.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, useBrowser, settled, skip, base } from "./harness.mjs";
useBrowser();
const SONG = { id: "g", title: "Porch Light Radio", artist: "The Low Tide", key: "G", format: "chords", duration: 120,
  body: "[Verse]\nG              D\nMorning comes in slow across the yard\nEm          C\nCoffee on the step and the radio on\n\n[Chorus]\nC                 G         D\nPorch light radio, keep the station on" };
async function open(t, stored) {
  const settings = { ...LIB.settings, theme: "neon" }; delete settings.plainChords; if (stored) settings.playView = stored;
  const page = await phone(t, { ...LIB, songs: [SONG], settings });
  const errs = []; page.on("pageerror", e => errs.push(e.message)); t.after(() => assert.deepEqual(errs, [], "page errors"));
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  return page;
}
const stop = page => page.evaluate(() => document.querySelector("#fp #play, #play")?.click());

for (const old of ["words", "strip"]) test(`5.17.2 a stored "${old}" from before is dropped: the song shows Timeline over each line, and there is no switcher`, { skip: skip() }, async t => {
  const page = await open(t, old);
  assert.equal(await page.locator(".sheet .tlb").count(), 3, "the bars are there");
  await page.waitForFunction(() => !("playView" in JSON.parse(localStorage.getItem("tabs-v1")).settings));
  await page.click("#more"); await page.waitForSelector(".menu.tools");
  assert.equal(await page.locator('[data-m="tlview"]').count(), 0, "no Chords while playing in Tools");
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-unlock");
  assert.equal(await page.locator("#s-tlview").count(), 0, "and none in Settings");
  assert.doesNotMatch(await page.innerText("#app"), /Chords while playing/);
});

test("timeline over each line: a bar per line, split by the words each chord covers, letters kept for VoiceOver; the chord you're on is lit", { skip: skip() }, async t => {
  const page = await open(t); /* 5.12.0: the default, nothing stored */
  assert.equal(await page.locator(".sheet .tlb").count(), 3, "one bar for each line with chords");
  assert.deepEqual(await page.locator(".sheet .tlb").first().locator(".tls").allInnerTexts(), ["G", "D"]);
  const [g, d] = await page.locator(".sheet .tlb").first().locator(".tls").evaluateAll(els => els.map(e => e.getBoundingClientRect().width));
  assert.ok(d > g, `D covers more of the words than G, so its part is wider (${g} vs ${d})`);
  assert.equal(await page.getAttribute(".sheet .tlb", "aria-hidden"), "true");
  const gap = await page.evaluate(() => { const bars = [...document.querySelectorAll(".sheet .tlb")], words = bars[0].parentElement.getBoundingClientRect(); return bars[1].getBoundingClientRect().top - words.bottom; });
  assert.ok(gap >= 14, `5.12.1: room between a line's words and the next line's bar (${gap} px)`);
  assert.equal(await page.locator(".sheet .c[data-ch]").count(), 7, "the letters stay in the page");
  assert.ok(!(await page.locator(".sheet .c[data-ch]").first().isVisible()) || (await page.locator(".sheet .c[data-ch]").first().boundingBox()).height <= 1, "but take no room");
  await page.click("#play");
  await page.waitForFunction(() => document.querySelectorAll(".sheet .tls.on").length === 1, null, { timeout: 15000 });
  /* 5.11.1: while it plays only the line you're on and the next show their bar; every bar keeps its 30 px */
  const shown = await page.evaluate(() => [...document.querySelectorAll(".sheet .tlb")].map(b => ({ v: getComputedStyle(b).visibility, h: b.offsetHeight, line: b.parentElement.classList.contains("st-now") ? "now" : b.parentElement.classList.contains("st-next") ? "next" : "" })));
  assert.deepEqual(shown.filter(x => x.v === "visible").map(x => x.line).sort(), ["next", "now"], "the current and next lines only");
  assert.ok(shown.every(x => x.h === shown[0].h), `every bar the same layout height (the stage only scales lines), so nothing moves (${shown.map(x => x.h)})`);
  await stop(page);
  await page.waitForFunction(() => !document.body.classList.contains("staged"));
  assert.ok(await page.evaluate(() => [...document.querySelectorAll(".sheet .tlb")].every(b => getComputedStyle(b).visibility === "visible")), "paused, every line shows its quiet bar");
});

test("5.12.0 a tap on a part of a line's bar shows that chord's shape, as a tap on the letter did", { skip: skip() }, async t => {
  const page = await open(t);
  await page.locator(".sheet .tls", { hasText: /^D$/ }).first().click();
  await page.waitForSelector(".shapecard");
  assert.match(await page.innerText(".shapecard"), /\bD\b/);
});

test("5.12.0 while a song plays, lines fade out as they rise past the one you're on and fade in as they come up", { skip: skip() }, async t => {
  const long = { ...SONG, body: "[Verse]\n" + Array.from({ length: 14 }, (_, i) => `G        D\nLine number ${i + 1} of the song`).join("\n"), duration: 200 };
  const settings = { ...LIB.settings, theme: "neon" }; delete settings.plainChords;
  const page = await phone(t, { ...LIB, songs: [long], settings });
  await page.evaluate(() => { location.hash = "#/song/g"; }); await page.waitForSelector("#play"); await settled(page);
  await page.click("#play");
  await page.waitForFunction(() => { const now = document.querySelector("#sheet > .st-now"); return now && [...document.querySelectorAll("#sheet > .pr")].indexOf(now) >= 2; }, null, { timeout: 30000 });
  const o = await page.evaluate(() => { const rows = [...document.querySelectorAll("#sheet > .pr")], k = rows.findIndex(r => r.classList.contains("st-now")), op = el => +getComputedStyle(el).opacity;
    return { before: op(rows[k - 1]), now: op(rows[k]), next2: op(rows[k + 2]), far: op(rows[Math.min(rows.length - 1, k + 4)]) }; });
  assert.equal(o.now, 1, "the line you're on");
  assert.equal(o.next2, 1, "fully there two lines after it");
  assert.ok(o.before < 1, `a passed line is fading (${o.before})`);
  assert.ok(o.far < 1, `a line far below is still fading in (${o.far})`);
});

test("timeline: every chord colour reads, white or espresso text at 4.5 to 1 or better", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  const worst = await page.evaluate(async () => {
    const { chordColor } = await import("./timeline.js");
    const lum = c => { const [r, g, b] = c.match(/\d+/g).map(n => n / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const el = document.createElement("i"); document.body.appendChild(el);
    let low = 99, at = "";
    for (const r of "ABCDEFG") for (const acc of ["", "#", "b"]) for (const q of ["", "m", "7", "maj7"]) {
      const c = chordColor(r + acc + q); el.style.color = c.bg; const L = lum(getComputedStyle(el).color), F = c.fg === "#FFFFFF" ? 1 : lum("rgb(30,25,20)");
      const k = (Math.max(L, F) + 0.05) / (Math.min(L, F) + 0.05); if (k < low) { low = k; at = r + acc + q; }
    }
    return { low, at };
  });
  assert.ok(worst.low >= 4.5, `${worst.at} is ${worst.low.toFixed(2)} to 1`);
});
