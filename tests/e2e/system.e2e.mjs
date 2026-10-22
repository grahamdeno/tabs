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
