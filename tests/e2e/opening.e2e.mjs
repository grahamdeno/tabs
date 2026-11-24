// Opening night (4.40.0): the first leg of the Road teaches by doing, on the sample song.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, SONG, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const { opening: _done, me: _me, ...BASE } = LIB;
const FRESH = { ...BASE, songs: [{ id: "h", title: "Harbor Lights", artist: "Sample song", sample: true, key: "A", format: "chords", body: SONG, duration: 60 }], settings: { ...LIB.settings, plainPlay: false, gigScore: false } };
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).opening || {});
const stepIs = (page, n) => page.waitForFunction(n => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).step === n, n);

test("4.40.0 Opening night: a new player gets nine steps; Who's playing tonight? comes first, then hold, strings, the microphone, first notes, then a chord, then the verse waits for Count me in", { skip: skip() }, async t => {
  const page = await phone(t, FRESH, { home: true });
  await page.waitForSelector(".on-night");
  assert.match(await page.innerText(".on-night"), /Opening night/); assert.equal(await page.getAttribute(".on-night", "aria-label"), "Opening night");
  assert.equal(await page.locator('.on-path [data-stop^="o:"]').count(), 9, "nine steps on the guitar neck");
  assert.equal(await page.locator(".on-path .rn-neck").count(), 1, "Opening night is one rosewood neck"); assert.equal(await page.locator(".rn-lat.rn-next").count(), 1, "Leg 1 is marked where it starts, not written in the gutter");
  assert.equal(await page.locator(".rd-tonight, #rd-songbook").count(), 0, "one thing to tap: no Gig button and no Songbook bar");
  assert.equal(await page.locator(".hud .h-lab").count(), 0, "the stat bar stays quiet during the leg");
  await settled(page);
  /* 1: your guitarist (4.85.0): a starter, then THAT'S ME. No fans, and the Road keeps it as data.me */
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".gm");
  assert.match(await page.innerText(".gm"), /Who's playing tonight\?[\s\S]*Start from a selfie[\s\S]*Change anything later on Your profile/);
  assert.equal(await page.locator('.gm svg[aria-label="Your guitarist"]').count(), 1, "the preview");
  await page.click('.gm [data-k="starter"][data-v="3"]');
  await page.click("#gm-ok");
  await stepIs(page, 1);
  const me = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).me);
  assert.equal(me.hair, "mohawk", "the starter you picked is you");
  assert.equal((await saved(page)).fans || 0, 0, "no fans for choosing a guitarist");
  /* Hold the guitar */
  await page.waitForSelector(".on-path .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".on-mic");
  assert.match(await page.innerText(".on-mic"), /Hold the guitar[\s\S]*Rest the guitar on your leg/);
  await page.click("#on-ok");
  await stepIs(page, 2);
  /* The open strings */
  await page.waitForSelector(".on-path .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".on-strings");
  assert.match(await page.innerText(".on-mic"), /The open strings[\s\S]*E[\s\S]*A[\s\S]*D[\s\S]*G[\s\S]*B[\s\S]*E/);
  await page.click("#on-ok");
  await stepIs(page, 3);
  /* The reason, then Not now plays unscored */
  await page.waitForSelector(".on-path .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".on-mic");
  assert.match(await page.innerText(".on-mic"), /Nothing is recorded or sent anywhere/);
  await page.click("#on-not");
  await stepIs(page, 4);
  assert.equal((await saved(page)).micOff, true, "Not now is remembered");
  /* First notes */
  await page.waitForSelector(".on-path .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector(".on-mic");
  assert.match(await page.innerText(".on-mic"), /Your first notes[\s\S]*thickest string/);
  await page.click("#on-ok");
  await stepIs(page, 5);
  /* The song, a strip above Play, the chord pulses */
  await page.waitForSelector(".on-path .rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector("#on-strip"); await page.waitForSelector(".sheet .c.on-pulse .ct");
  assert.match(await page.innerText("#on-strip"), /STEP 6 OF 9[\s\S]*Tap the A/);
  await page.click(".sheet .c.on-pulse .ct");
  await stepIs(page, 6);
  assert.match(await page.innerText("#on-strip"), /STEP 7 OF 9[\s\S]*press Play/);
  /* 3: the Gig waits and says why it listens (here, that it won't) */
  await page.click("#play");
  await page.waitForSelector(".on-count");
  assert.match(await page.innerText(".on-count"), /Play each chord[\s\S]*crowd gets on its feet/, "4.91.0: shows don't listen");
  assert.equal(await page.evaluate(() => document.body.classList.contains("playing")), false, "nothing scrolls until Count me in");
  await page.click("#on-go");
  await page.waitForFunction(() => document.body.classList.contains("playing") && !document.querySelector(".on-count"));
});

for (const width of [390, 320]) for (const theme of ["dark", "light"]) {
  test(`Opening night at ${width} wide (${theme}): the leg line, Skip and the now plate sit on the screen`, { skip: skip() }, async t => {
    const page = await phone(t, { ...FRESH, settings: { ...FRESH.settings, theme } }, { home: true, viewport: { width, height: 844 }, reducedMotion: "reduce" });
    await page.waitForSelector(".rd-node.now .rn-pearl");
    await page.waitForSelector("#rn-now");
    await settled(page);
    const box = await page.evaluate(() => {
      const header = document.querySelector("header.rr-head").getBoundingClientRect();
      const leg = document.querySelector(".rn-legbar").getBoundingClientRect();
      const line = document.querySelector(".rn-legline");
      const stop = document.querySelector(".rd-node.now").getBoundingClientRect();
      const nut = document.querySelector(".rn-nut").getBoundingClientRect();
      const plate = document.getElementById("rn-now").getBoundingClientRect();
      const tabs = document.getElementById("tabs").getBoundingClientRect();
      const skip = document.getElementById("on-skip").getBoundingClientRect();
      const open = document.getElementById("rn-now-open").getBoundingClientRect();
      const start = document.getElementById("rn-now-start").getBoundingClientRect();
      const name = document.querySelector(".rn-now-tx");
      const neck = document.querySelector(".rn-neck").getBoundingClientRect();
      const walker = document.createTreeWalker(document.getElementById("rd-path"), NodeFilter.SHOW_TEXT);
      const gutter = [];
      while (walker.nextNode()) {
        const t = walker.currentNode.textContent.trim();
        if (!t) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        const rect = range.getBoundingClientRect();
        if (rect.width && rect.right <= neck.left + 2) gutter.push(t);
      }
      const lh = parseFloat(getComputedStyle(line).lineHeight) || parseFloat(getComputedStyle(line).fontSize) * 1.2;
      return {
        headerBottom: header.bottom, scroll: document.getElementById("rd-path").scrollTop, stop, leg, nut, plate, tabs, skip, open, start,
        vw: innerWidth, vh: innerHeight, line: line.innerText, name: name.textContent,
        oneLine: line.getBoundingClientRect().height <= lh + 2,
        lineFits: line.scrollWidth <= line.clientWidth + 1, nameFits: name.scrollWidth <= name.clientWidth + 1,
        skipName: document.getElementById("on-skip").getAttribute("aria-label"),
        openName: document.getElementById("rn-now-open").getAttribute("aria-label"),
        startName: document.getElementById("rn-now-start").getAttribute("aria-label"),
        side: document.querySelectorAll(".rn-bubble, .rn-leg").length, gutter
      };
    });
    assert.equal(box.scroll, 0, "first load has not scrolled the neck up under the header");
    assert.match(box.line, /Opening night · First steps/);
    assert.equal(box.oneLine, true, "the leg line is one line");
    assert.equal(box.lineFits, true, "the leg line is not clipped");
    assert.equal(box.name, "Who's playing tonight?");
    assert.equal(box.nameFits, true, "the stop name is not clipped");
    assert.equal(box.skipName, "Skip opening night");
    assert.equal(box.openName, "Who's playing tonight?, open this stop");
    assert.equal(box.startName, "Start Who's playing tonight?");
    assert.equal(box.side, 0, "no title or bubble in the gutter");
    assert.deepEqual(box.gutter.filter(t => !/^\d+$/.test(t)), [], `gutter text ${box.gutter.join(", ")}`);
    assert.ok(box.leg.top >= box.headerBottom - 1, "the leg row is under the stats");
    assert.ok(box.nut.top >= box.leg.bottom - 2 && box.nut.top - box.leg.bottom <= 8, "the nut sits under the leg row");
    assert.ok(box.plate.bottom <= box.tabs.top + 1, "the plate sits above the tab bar");
    assert.ok(box.stop.top >= box.leg.bottom - 1, "stop 1 is below the leg row");
    for (const [name, r] of [["the leg row", box.leg], ["stop 1", box.stop], ["the plate", box.plate], ["Skip", box.skip], ["the stop name", box.open], ["Start", box.start]]) {
      assert.ok(r.bottom <= box.vh + 0.5, `${name} ends at ${r.bottom}, inside the screen`);
      assert.ok(r.left >= -0.5 && r.right <= box.vw + 0.5, `${name} stays inside the width (${r.left}..${r.right} of ${box.vw})`);
      assert.ok(r.height >= 44 && r.width >= 44, `${name} is at least 44 by 44 (${r.width} by ${r.height})`);
    }
    if (width === 320 && theme === "dark") {
      await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "40px"); document.documentElement.dataset.ax = "3"; });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const big = await page.evaluate(() => {
        const line = document.querySelector(".rn-legline"), name = document.querySelector(".rn-now-tx");
        const lh = parseFloat(getComputedStyle(line).lineHeight) || parseFloat(getComputedStyle(line).fontSize) * 1.2;
        const skip = document.getElementById("on-skip").getBoundingClientRect();
        return { one: line.getBoundingClientRect().height <= lh + 2, lineFits: line.scrollWidth <= line.clientWidth + 1, nameFits: name.scrollWidth <= name.clientWidth + 1, skip };
      });
      assert.equal(big.one, true, "large text keeps one leg line");
      assert.equal(big.lineFits, true, "large text does not clip the leg line");
      assert.equal(big.nameFits, true, "large text does not clip the stop name");
      assert.ok(big.skip.width >= 44 && big.skip.height >= 44, `Skip stays a 44 px target (${big.skip.width} by ${big.skip.height})`);
    }
  });
}

test("Opening night: Leg 1 is drawn gray and locked under the gold fret, and a tap does not start it", { skip: skip() }, async t => {
  const page = await phone(t, FRESH, { home: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.waitForSelector(".rn-slot.rn-dim"); await settled(page);
  const m = await page.evaluate(() => ({
    steps: document.querySelectorAll('.on-path [data-stop^="o:"]').length,
    dim: document.querySelectorAll(".rn-slot.rn-dim").length,
    locked: document.querySelectorAll(".rn-slot.rn-dim .rn-stop.locked").length,
    live: document.querySelectorAll(".rn-slot:not(.rn-dim)").length,
    peek: document.querySelectorAll(".rn-wire.peek").length,
    next: document.querySelector(".rn-lat.rn-next")?.dataset.title || "",
    sub: document.querySelector(".rn-lat.rn-next")?.dataset.sub || "",
    veil: document.querySelectorAll(".rn-upcoming").length
  }));
  assert.equal(m.steps, 9, "Opening night keeps its nine steps");
  assert.equal(m.live, 9, "those steps stay full colour");
  assert.equal(m.dim, 10, "Leg 1's ten stops are on the neck");
  assert.equal(m.locked, 10, "each one is locked");
  assert.equal(m.peek, 0, "no empty frets under the gold");
  assert.equal(m.veil, 1);
  assert.equal(m.next, "Leg 1");
  assert.match(m.sub, /Open chords/);
  await page.evaluate(() => {
    const path = document.getElementById("rd-path");
    const mark = document.querySelector(".rn-lat.rn-next");
    path.scrollTop += mark.getBoundingClientRect().top - path.getBoundingClientRect().top;
  });
  await page.waitForFunction(() => /Leg 1/.test(document.getElementById("rn-legline").innerText));
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("on-skip")).display), "none", "Skip steps aside once Leg 1 is the leg in view");
  const step = await saved(page);
  await page.locator(".rn-slot.rn-dim .rd-node").first().click();
  await page.waitForSelector(".rn-slot.rn-dim .rd-pop");
  assert.match(await page.innerText(".rd-pop"), /This opens after Opening night/);
  assert.equal(await page.locator(".rd-pop .rd-start, .rd-pop [data-ostart]").count(), 0, "no way to start it");
  assert.equal((await saved(page)).step || 0, step.step || 0, "Opening night does not advance");
});

test("4.40.0 Opening night: pause and pick up in the Gig: the step says what to do at each point", { skip: skip() }, async t => {
  const page = await phone(t, { ...FRESH, opening: { step: 4, v: 2, fans: 15 } }, { home: true });
  await page.waitForSelector(".rd-node.now"); await settled(page);
  await page.click(".rd-node.now"); await page.click("[data-ostart]");
  await page.waitForSelector("#on-strip"); await page.waitForFunction(() => document.body.classList.contains("playing"));
  assert.match(await page.innerText("#on-strip"), /Tap anywhere to pause/);
  await page.click("#gg-pause");
  await page.waitForSelector("body.held");
  assert.match(await page.innerText("#gg-hsay"), /Tap Resume/);
  await page.click("#play");
  await stepIs(page, 8);
  assert.equal((await saved(page)).step, 8, "a v2 save on pause lands on pause, then moves to the first show");
  assert.match(await page.innerText("#on-strip"), /STEP 9 OF 9[\s\S]*through to the end/);
});

/* the stat bar's labels belong to the Road Green Room and Headliner keep; Road Ready's header always says what each door is */
test("4.40.0 Opening night: Skip asks first; afterwards the stat bar names its three doors until each is tapped (Green Room)", { skip: skip() }, async t => {
  const page = await phone(t, { ...FRESH, settings: { ...FRESH.settings, v: 6, theme: "green" } }, { home: true });
  await page.waitForSelector("#on-skip"); await settled(page);
  await page.click("#on-skip");
  await page.waitForSelector("#ask-ok");
  assert.match(await page.innerText(".ask .panel"), /Skip opening night\?[\s\S]*replay it/);
  await page.click("#ask-ok");
  await page.waitForSelector(".rn-neck");
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).skipped > 0); /* skipped is kept */
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("tabs-v1")).me); /* 4.99.0: Skip keeps the default guitarist and opens no sheet */
  assert.equal(await page.locator(".gm").count(), 0, "no maker after skipping");
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.look), "green", "Opening night does not show Green Room");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.theme), "green", "the saved look stays");
});

test("4.40.0 Opening night: someone who already plays never sees it; Tips & gestures replays it", { skip: skip() }, async t => {
  const page = await phone(t, { ...BASE, songs: LIB.songs.map(s => ({ ...s, playLog: { total: 2, last: Date.now(), days: { "2026-10-01": 2 } } })) }, { home: true });
  await page.waitForSelector(".rd-path:not(.on-path)");
  assert.equal(await page.locator(".on-night").count(), 0);
  await page.evaluate(() => { location.hash = "#/gestures"; }); await page.waitForSelector("#gs-opening"); await settled(page);
  await page.click("#gs-opening");
  await page.waitForSelector(".on-night");
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("tabs-v1")).opening || {}).replay === true);
});

test("4.45.2 Opening night: tapping the last pick scrolls its card and button above the tab bar", { skip: skip() }, async t => {
  const page = await phone(t, { ...FRESH, opening: { step: 5, v: 2, fans: 20 } }, { home: true });
  await page.waitForSelector('[data-stop="o:8"]');
  await page.click('[data-stop="o:8"]'); await page.waitForSelector(".rd-pop");
  await page.waitForFunction(() => { const r = document.querySelector(".rd-pop").getBoundingClientRect(), b = document.getElementById("rn-now").getBoundingClientRect(); return r.bottom <= b.top + 1; }, null, { timeout: 4000 });
});
