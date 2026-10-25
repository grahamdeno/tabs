// One button and control system (4.30.0): sizes and the lip, on two screens each.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, settled, useBrowser } from "./harness.mjs";
useBrowser();

const probe = page => page.evaluate(() => {
  const mk = (tag, cls, html = "x") => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; document.body.appendChild(e); return e; };
  const a = mk("button", "btn primary"), b = mk("button", "btn"), c = mk("button", "btn sm"), s = mk("div", "seg", "<button class='on'>A</button><button>B</button>");
  const out = {
    main: a.getBoundingClientRect().height, plain: b.getBoundingClientRect().height, row: c.getBoundingClientRect().height,
    seg: s.getBoundingClientRect().height, lip: getComputedStyle(b).boxShadow, mainLip: getComputedStyle(a).boxShadow,
    border: getComputedStyle(b).borderTopWidth, segOn: getComputedStyle(s.querySelector(".on")).boxShadow
  };
  [a, b, c, s].forEach(e => e.remove());
  return out;
});

for (const [name, hash] of [["Songbook", "#/library"], ["Settings", "#/settings"]]) {
  test(`System: buttons and segmented controls on ${name}`, { skip: skip() }, async t => {
    const page = await phone(t, LIB);
    await page.evaluate(h => { location.hash = h; }, hash); await settled(page);
    const r = await probe(page);
    assert.equal(Math.round(r.main), 56, "main action is 56 tall");
    assert.equal(Math.round(r.plain), 56, "a plain button beside it matches");
    assert.equal(Math.round(r.row), 42, "row action is 42 tall");
    assert.ok(r.seg >= 48, "segmented track is at least 48");
    assert.match(r.mainLip, /0px 5px 0px/, "main button sits on its lip");
    assert.match(r.lip, /0px 4px 0px/, "plain button sits on its lip");
    assert.match(r.segOn, /0px 2px 0px/, "the chosen segment has a lip");
  });
}

test("System: chips and cards are flat on a lip, with no thin outline (Get the song, Tuner)", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  for (const hash of ["#/tuner", "#/library"]) {
    await page.evaluate(h => { location.hash = h; }, hash); await settled(page);
    const r = await page.evaluate(() => {
      const mk = cls => { const e = document.createElement("span"); e.className = cls; e.textContent = "x"; document.body.appendChild(e); const cs = getComputedStyle(e); const o = { w: cs.borderTopWidth, sh: cs.boxShadow }; e.remove(); return o; };
      return ["tn-chip", "gs-ver", "ce-alt", "hist"].map(mk);
    });
    r.slice(0, 3).forEach((c, i) => assert.equal(c.w, "0px", `no outline on ${["tn-chip", "gs-ver", "ce-alt"][i]} (${hash})`));
  }
  assert.equal(await page.evaluate(() => document.querySelectorAll(".nx-lamp").length), 0);
});

test("4.31.0 Song screen: the title opens About this song, no key chip, the bar is Tools and Play", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#about"); await settled(page);
  assert.equal(await page.locator("#keybtn, .keyslot").count(), 0, "the key chip is gone");
  assert.equal(await page.locator(".player #listen").count(), 0, "one button beside Play");
  assert.match(await page.innerText("#more"), /Tools/);
  assert.match(await page.innerText("#meta"), /about this song/i);
  await page.click("#about"); await page.waitForSelector("#rs");
  assert.match(await page.innerText("#rs"), /Tempo[\s\S]*Length[\s\S]*Key/i);
  assert.match(await page.innerText("#rs"), /Find a recording/, "no recording linked: offered here");
  await page.click("#rs-done"); await page.waitForSelector("#rs", { state: "detached" });
  await page.click("#meta"); await page.waitForSelector("#rs");
});

test("4.32.0 Tools: three tabs at the bottom, switches toggle in place, the last tab is remembered", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForSelector("#more"); await settled(page);
  await page.click("#more"); await page.waitForSelector(".menu .t3-tabs");
  assert.deepEqual(await page.$$eval(".menu [data-tab]", b => b.map(x => x.textContent.trim())), ["Play", "Practice", "Song"]);
  assert.equal(await page.locator(".menu .tl-grid, .menu .mrow.tl").count(), 0, "rows, not tiles");
  /* 4.69.0: the beat is a three-way choice in the Play tab */
  assert.deepEqual(await page.$$eval(".menu [data-beat]", b => b.map(x => x.textContent.trim())), ["Off", "Bass drum", "Metronome"]);
  assert.equal(await page.getAttribute(".menu [data-beat='off']", "aria-checked"), "true", "off by default");
  await page.click(".menu [data-beat='click']"); await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("tabs-v1")).settings; return s.metronome === true && s.metroSound === "click"; });
  assert.equal(await page.locator(".menu").count(), 1, "the sheet stays open");
  assert.equal(await page.getAttribute(".menu [data-beat='click']", "aria-checked"), "true");
  await page.click(".menu [data-tab='song']"); await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.toolsTab === "song");
  assert.ok(await page.isVisible(".menu [data-m='edit']"));
  assert.equal(await page.locator(".menu [data-m='listen']").count(), 0, "the recording moved to the title");
  await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
  await page.click("#more"); await page.waitForSelector(".menu [data-tab='song'].on");
  assert.ok(await page.isVisible(".menu [data-m='edit']"), "reopens on Song");
});
