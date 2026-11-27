// The neck-only Road: one rosewood board you scroll, with a lamp-lit Road knob.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const AT = Date.now();
const doneOf = ids => ({ done: Object.fromEntries(ids.map((id, i) => [id, { n: 3, best: 90, at: AT - 1000 + i }])), last: AT });
const OPEN = ["G", "C", "D", "Em", "Am", "E", "A"].map(c => "c:" + c);
/* 5.17.0: the Tour is the curriculum map: Tours 1 to 3 done (and their merch boxes opened) make Am, the first stop of Tour 4, the current stop */
const T3 = ["c:Em", "c:A", "c:D", "c:E", "s:D-A", "s:A-E", "c:G", "c:C", "s:G-C", "s:C-D", "s:G-D"];
const MID = doneOf(T3);
const BOXES = { opened: Array.from({ length: 13 }, (_, i) => `b:t${i + 1}`) };
/* 5.18.0: Down-ups, the folk pattern and the headlines of Tours 2 to 4 are pieces of a song; these players have played the ones before where they stand */
const PIECES = { v: 1, done: { "k2.5": AT, "k2.6": AT, "k3.5": AT } };
const PIECES_ALL = { v: 1, done: { ...PIECES.done, "k4.4": AT, "k4.5": AT, "k4.6": AT } };
const lib = (theme, skills) => ({ ...LIB, skills, curriculum: skills === MID ? PIECES : PIECES_ALL, boxes: BOXES, merch: { tconv: 1, lconv: 1, hlseen: 1 }, guitars: { seen: ["open"] }, settings: { ...LIB.settings, v: 6, theme } });

test("Neck-only Road: the neck is 55 to 60 percent wide, a gutter drag does not open a stop, and a tap on a stop opens its card", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true });
  await page.waitForSelector(".rn-neck .rd-node.cur"); await settled(page);
  const width = await page.evaluate(() => document.querySelector(".rn-neck").getBoundingClientRect().width / innerWidth);
  assert.ok(width >= 0.55 && width <= 0.6, `neck width ${width}`);
  const lit = await page.evaluate(() => {
    const a = document.querySelector("#tabs [data-tab=road]");
    return { current: a.getAttribute("aria-current"), on: getComputedStyle(a.querySelector(".tb-on")).opacity, off: getComputedStyle(a.querySelector(".tb-off")).opacity };
  });
  assert.equal(lit.current, "page");
  assert.equal(lit.on, "1", "Road is lamp-lit");
  assert.equal(lit.off, "0");
  const gutter = await page.evaluate(() => { const n = document.querySelector(".rn-neck").getBoundingClientRect(); return { x: 12, y: n.top + 160 }; });
  await page.mouse.move(gutter.x, gutter.y);
  await page.mouse.down();
  await page.mouse.move(gutter.x, gutter.y + 120, { steps: 6 });
  await page.mouse.up();
  assert.equal(await page.locator(".rd-pop").count(), 0, "a gutter drag does not open a stop");
  await page.click(".rd-node.cur");
  await page.waitForSelector(".rd-pop");
  assert.match(await page.innerText(".rd-pop"), /Am/);
});

test("Neck-only Road: the current stop is centred in its fret space, clear of the wire above and the wire below", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true, viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rn-slot.cur"); await settled(page);
  const m = await page.evaluate(() => {
    const slot = document.querySelector(".rn-slot.cur");
    const neckEl = document.querySelector(".rn-neck");
    const neck = neckEl.getBoundingClientRect();
    const box = slot.getBoundingClientRect();
    const cy = (box.top + box.bottom) / 2;
    const space = neck.top + neckEl.clientTop + (parseFloat(slot.dataset.y0) + parseFloat(slot.dataset.y1)) / 2;
    const wires = [...document.querySelectorAll(".rn-wire, .rn-gold")].map(el => {
      const r = el.getBoundingClientRect();
      return (r.top + r.bottom) / 2;
    }).sort((a, b) => a - b);
    const above = wires.filter(y => y <= space).pop();
    const below = wires.find(y => y >= space);
    const half = box.height / 2;
    const moons = [...document.querySelectorAll(".rn-slot:has(.headline)")].map(el => {
      const b = el.getBoundingClientRect();
      const gold = [...document.querySelectorAll(".rn-gold")].map(g => {
        const r = g.getBoundingClientRect();
        return (r.top + r.bottom) / 2;
      }).filter(y => y > b.top).sort((a, c) => a - c)[0];
      return gold - b.bottom;
    });
    return { off: Math.abs(cy - space), above: cy - half - above, below: below - (cy + half), moons };
  });
  assert.ok(m.off <= 2, `current stop is ${m.off}px off its fret space`);
  assert.ok(m.above >= 10, `only ${m.above}px above the wire`);
  assert.ok(m.below >= 10, `only ${m.below}px below the wire`);
  assert.ok(m.moons.length >= 1 && m.moons.every(g => g >= 14), `moon to gold ${m.moons}`);
});

test("Neck-only Road: the six strings step down from low E to high E, each one width, and the fret wires are substantial", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true, viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rn-string"); await settled(page);
  const m = await page.evaluate(() => {
    const neck = document.querySelector(".rn-neck").getBoundingClientRect();
    const strings = [...document.querySelectorAll(".rn-string")].map(el => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { left: r.left, w: r.width, sw: parseFloat(cs.getPropertyValue("--sw")), top: r.top, bottom: r.bottom, wound: el.classList.contains("wound"), plain: el.classList.contains("plain") };
    }).sort((a, b) => a.left - b.left);
    const wire = document.querySelector(".rn-wire").getBoundingClientRect().height;
    const gold = Math.max(...[...document.querySelectorAll(".rn-gold")].map(el => el.getBoundingClientRect().height));
    return { strings, wire, gold, neckTop: neck.top, neckBottom: neck.bottom };
  });
  assert.equal(m.strings.length, 6);
  const gauges = m.strings.map(s => s.sw);
  assert.deepEqual(gauges, [3.5, 2.7, 2.2, 1.7, 1.2, 0.95]);
  for (let i = 1; i < gauges.length; i++) assert.ok(gauges[i] < gauges[i - 1], "each string is thinner than the one on its left");
  for (const s of m.strings) {
    assert.ok(Math.abs(s.w - s.sw) < 0.35, `drawn width ${s.w} matches the constant gauge ${s.sw}`);
    assert.ok(s.top <= m.neckTop + 30 && s.bottom >= m.neckBottom - 8, "the string runs the length of the neck at one width");
  }
  assert.ok(m.strings.slice(0, 4).every(s => s.wound), "the four bass strings are wound");
  assert.ok(m.strings.slice(4).every(s => s.plain), "B and high E are plain steel");
  assert.ok(m.wire >= 4 && m.wire <= 5.5, `a nickel fret is ${m.wire}px`);
  assert.ok(m.gold > m.wire, "the gold leg fret stays proud of the nickel frets");
});

test("Neck-only Road: opening on the current stop keeps it on screen, and a stop near the nut stays at the top", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true, viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rd-node.cur"); await settled(page);
  const box = await page.evaluate(() => {
    const stop = document.querySelector(".rd-node.cur").getBoundingClientRect();
    const header = document.querySelector("header.rr-head").getBoundingClientRect();
    const tabs = document.getElementById("tabs").getBoundingClientRect();
    const plate = document.getElementById("rn-now").getBoundingClientRect();
    return { top: stop.top, bottom: stop.bottom, header: header.bottom, tabs: tabs.top, plate: plate.top, scroll: document.getElementById("rd-path").scrollTop };
  });
  assert.ok(box.scroll > 0, "a stop down the neck is scrolled into view");
  assert.ok(box.top >= box.header - 1, "clear of the header");
  assert.ok(box.bottom <= box.plate + 1, "clear of the now plate");
  assert.ok(box.bottom <= box.tabs + 1, "clear of the tab bar");
  const fresh = await phone(t, { ...LIB, opening: undefined, me: undefined, settings: { ...LIB.settings, v: 6, theme: "dark" } }, { home: true, viewport: { width: 390, height: 844 } });
  await fresh.waitForSelector(".on-night");
  await fresh.waitForSelector(".rn-neck .rd-node.now"); await settled(fresh);
  const top = await fresh.evaluate(() => ({ scroll: document.getElementById("rd-path").scrollTop, stop: document.querySelector(".rd-node.now").getBoundingClientRect().top, header: document.querySelector("header.rr-head").getBoundingClientRect().bottom }));
  assert.equal(top.scroll, 0, "a stop near the nut pins to the top");
  assert.ok(top.stop >= top.header - 1, "and stays clear of the header");
});

test("Road labels do not break inside a word, at 320 and 390, in both looks, including large text", { skip: skip() }, async t => {
  for (const theme of ["dark", "light"]) {
    const page = await phone(t, lib(theme, MID), { home: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    await page.waitForSelector("#rn-legline"); await settled(page);
    const read = () => page.evaluate(() => {
      const linesOf = el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) {
          const node = walker.currentNode, text = node.textContent;
          for (let i = 0; i < text.length; i++) {
            const range = document.createRange();
            range.setStart(node, i); range.setEnd(node, i + 1);
            const rect = range.getClientRects()[0];
            if (!rect || !rect.width) continue;
            parts.push({ ch: text[i], top: Math.round(rect.top) });
          }
        }
        const lines = [];
        let y = null, line = "";
        for (const p of parts) {
          if (y === null || Math.abs(p.top - y) > 2) { if (line) lines.push(line); line = ""; y = p.top; }
          line += p.ch;
        }
        if (line) lines.push(line);
        return lines;
      };
      const cssBad = [];
      for (const el of document.querySelectorAll(".rn-legbar, .rn-legbar *, .rn-now, .rn-now *, .rn-num, .rd-pop, .rd-pop *")) {
        const c = getComputedStyle(el);
        if (c.wordBreak === "break-all" || c.overflowWrap === "anywhere") cssBad.push((el.className || el.tagName) + " " + c.wordBreak + " " + c.overflowWrap);
      }
      const intact = el => {
        const text = el.innerText.replace(/\s+/g, " ").trim();
        const words = text.split(" ").filter(Boolean);
        const lines = linesOf(el).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
        const rebuilt = lines.join(" ").replace(/\s+/g, " ").trim();
        if (rebuilt !== text) return rebuilt + " vs " + text;
        for (const line of lines) for (const part of line.split(" ").filter(Boolean)) if (!words.includes(part)) return part + " in " + line;
        return "";
      };
      const overflow = [...document.querySelectorAll(".rn-legline, .rn-now-tx, .rn-legbar, .rn-now")].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.id || el.className);
      const line = document.querySelector(".rn-legline");
      const lh = parseFloat(getComputedStyle(line).lineHeight) || parseFloat(getComputedStyle(line).fontSize) * 1.2;
      const src = getComputedStyle(document.querySelector(".rn-now-tx"));
      const probe = document.createElement("div");
      probe.style.cssText = "position:absolute;left:0;top:0;width:70px;font:" + src.font + ";word-break:" + src.wordBreak + ";overflow-wrap:" + src.overflowWrap + ";white-space:normal;";
      probe.textContent = "AlphaBeta ChordName";
      document.body.appendChild(probe);
      const probeLines = linesOf(probe).map(s => s.trim()).filter(Boolean);
      probe.remove();
      const plate = document.getElementById("rn-now").getBoundingClientRect();
      return {
        cssBad, overflow, one: line.getBoundingClientRect().height <= lh + 2,
        label: intact(line), name: intact(document.querySelector(".rn-now-name")),
        probeLines, wordBreak: src.wordBreak, overflowWrap: src.overflowWrap,
        glow: getComputedStyle(document.querySelector(".rr-glow")).animationName,
        plateAbove: plate.bottom <= document.getElementById("tabs").getBoundingClientRect().top + 1
      };
    });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const got = await read();
      assert.deepEqual(got.cssBad, [], `${theme} ${width}`);
      assert.deepEqual(got.overflow, [], `${theme} ${width} clips ${got.overflow}`);
      assert.equal(got.one, true, `${theme} ${width}: one leg line`);
      assert.equal(got.label, "", got.label);
      assert.equal(got.name, "", got.name);
      assert.notEqual(got.wordBreak, "break-all");
      assert.notEqual(got.overflowWrap, "anywhere");
      assert.equal(got.probeLines.join(" "), "AlphaBeta ChordName");
      assert.ok(got.probeLines.every(line => line.split(" ").every(w => ["AlphaBeta", "ChordName"].includes(w))), got.probeLines.join("|"));
      assert.equal(got.glow, "none", "Reduce Motion keeps the glow still");
      assert.equal(got.plateAbove, true, "the plate stays above the tab bar");
    }
    await page.evaluate(() => { document.documentElement.style.setProperty("--sys-px", "40px"); document.documentElement.dataset.ax = "3"; });
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const big = await read();
    assert.equal(big.one, true, "large text keeps one leg line");
    assert.deepEqual(big.overflow, [], `large text clips ${big.overflow}`);
    assert.equal(big.label, "", big.label);
    assert.equal(big.name, "", big.name);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { const p = document.getElementById("rd-path"); p.scrollTop = p.scrollHeight; });
    const clear = await page.evaluate(() => {
      const stops = [...document.querySelectorAll(".rn-slot")];
      const last = stops[stops.length - 1].getBoundingClientRect();
      const plate = document.getElementById("rn-now").getBoundingClientRect();
      return { stop: last.bottom, plate: plate.top };
    });
    assert.ok(clear.stop <= clear.plate + 1, `the last stop (${clear.stop}) scrolls clear of the plate (${clear.plate})`);
    await page.click(".rd-node.cur");
    await page.waitForSelector(".rd-pop p");
    const card = await page.evaluate(() => {
      const linesOf = el => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) {
          const node = walker.currentNode, text = node.textContent;
          for (let i = 0; i < text.length; i++) {
            const range = document.createRange();
            range.setStart(node, i); range.setEnd(node, i + 1);
            const rect = range.getClientRects()[0];
            if (!rect || !rect.width) continue;
            parts.push({ ch: text[i], top: Math.round(rect.top) });
          }
        }
        const lines = [];
        let y = null, line = "";
        for (const p of parts) {
          if (y === null || Math.abs(p.top - y) > 2) { if (line) lines.push(line); line = ""; y = p.top; }
          line += p.ch;
        }
        if (line) lines.push(line);
        return lines;
      };
      const p = document.querySelector(".rd-pop p");
      p.style.width = "120px";
      const c = getComputedStyle(p);
      const text = p.innerText.replace(/\s+/g, " ").trim();
      const words = text.split(" ").filter(Boolean);
      const lines = linesOf(p).map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
      const broken = [];
      for (const line of lines) for (const part of line.split(" ").filter(Boolean)) if (!words.includes(part)) broken.push(part);
      return { wordBreak: c.wordBreak, overflowWrap: c.overflowWrap, broken, rebuilt: lines.join(" ").replace(/\s+/g, " ").trim(), text };
    });
    assert.notEqual(card.wordBreak, "break-all");
    assert.notEqual(card.overflowWrap, "anywhere");
    assert.deepEqual(card.broken, []);
    assert.equal(card.rebuilt, card.text);
  }
});

const LEG1 = doneOf([...OPEN, "k:open"]);
const SWITCH = ["s:G-C", "s:C-D", "s:G-D", "s:Em-Am", "s:Am-C", "s:D-A", "s:A-E", "s:Em-C", "k:switch", "c:Dm"];
const LAST = doneOf([...OPEN, "k:open", ...SWITCH]);

test("Neck-only Road: the lead and fingerstyle rows are grayed out and locked, and the neck ends just above the plate", { skip: skip() }, async t => {
  const page = await phone(t, lib("dark", MID), { home: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.waitForSelector(".rn-slot.rn-dim"); await settled(page);
  const before = await page.evaluate(() => {
    const cur = document.querySelector(".rd-node.cur");
    return {
      peek: document.querySelectorAll(".rn-wire.peek").length,
      dim: document.querySelectorAll(".rn-slot.rn-dim").length,
      locked: document.querySelectorAll(".rn-slot.rn-dim .rn-stop.locked").length,
      locks: document.querySelectorAll(".rn-slot.rn-dim .rn-lock, .rn-mark.rn-lock.rn-dim").length,
      checks: document.querySelectorAll(".rn-mark.rn-check.rn-dim").length,
      glow: document.querySelectorAll(".rn-slot.rn-dim .rr-glow").length,
      veil: document.querySelectorAll(".rn-upcoming").length,
      curDim: !!cur.closest(".rn-dim"),
      curGlow: !!cur.querySelector(".rr-glow"),
      next: document.querySelector(".rn-lat.rn-next")?.dataset.title || "",
      sub: document.querySelector(".rn-lat.rn-next")?.dataset.sub || ""
    };
  });
  assert.equal(before.peek, 0, "no empty fret stub");
  assert.equal(before.dim, 2, `the two routes are one locked row each (${before.dim})`);
  assert.equal(before.locked, before.dim, "every upcoming stop is locked");
  assert.ok(before.locks >= before.dim, "each upcoming stop has a lock");
  assert.equal(before.checks, 0, "a grayed stop does not wear a check");
  assert.equal(before.glow, 0, "a grayed stop does not glow");
  assert.equal(before.veil, 1, "one gray band");
  assert.equal(before.curDim, false, "the current stop stays in the live leg");
  assert.equal(before.curGlow, true, "the current stop still glows");
  assert.equal(before.next, "Lead route");
  assert.match(before.sub, /Tours 14 to 16/);
  await page.evaluate(() => {
    const path = document.getElementById("rd-path");
    const mark = document.querySelector(".rn-lat.rn-next");
    path.scrollTop += mark.getBoundingClientRect().top - path.getBoundingClientRect().top;
  });
  await page.waitForFunction(() => /(Lead|Fingerstyle) route/.test(document.getElementById("rn-legline").innerText));
  assert.match(await page.innerText("#rn-legline"), /(Lead route · Tours 14 to 16|Fingerstyle route · Tours 17 to 18)/, "at the end of the neck the legline names the row in view");
  const hash = await page.evaluate(() => location.hash);
  await page.locator(".rn-slot.rn-dim .rd-node").last().click();
  await page.waitForSelector(".rn-slot.rn-dim .rd-pop");
  assert.equal(await page.locator(".rd-pop .rd-start").count(), 0, "a grayed stop has no Start");
  assert.match(await page.innerText(".rd-pop"), /Finish the stops before this one|opens when you get here|Opens after Tour/);
  assert.equal(await page.evaluate(() => location.hash), hash, "the lesson does not open");
  await page.waitForFunction(() => {
    const pop = document.querySelector(".rd-pop"), plate = document.getElementById("rn-now");
    return pop && plate && pop.getBoundingClientRect().bottom <= plate.getBoundingClientRect().top + 1;
  });
  const gap = await page.evaluate(() => {
    const path = document.getElementById("rd-path");
    path.scrollTop = path.scrollHeight;
    const neck = document.querySelector(".rn-neck").getBoundingClientRect();
    const plate = document.getElementById("rn-now").getBoundingClientRect();
    return { gap: plate.top - neck.bottom, neck: neck.bottom, plate: plate.top };
  });
  assert.ok(gap.gap >= 16 && gap.gap <= 120, `the neck ends ${gap.gap}px above the plate`);
});

test("Neck-only Road: with every stop that can be played done, no stop is current and the neck ends clean", { skip: skip() }, async t => {
  const page = await phone(t, { ...lib("dark", LAST), guitars: { seen: ["open", "switch"] } }, { home: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const m = await page.evaluate(() => ({
    next: document.querySelectorAll(".rn-lat.rn-next").length,
    dim: document.querySelectorAll(".rn-slot.rn-dim").length,
    veil: document.querySelectorAll(".rn-upcoming").length,
    peek: document.querySelectorAll(".rn-wire.peek").length,
    cur: document.querySelectorAll(".rd-node.cur").length
  }));
  assert.equal(m.next, 1, "the lead and fingerstyle rows are the only upcoming part");
  assert.equal(m.dim, 2);
  assert.equal(m.veil, 1);
  assert.equal(m.peek, 0, "no empty frets past the last gold");
  assert.equal(m.cur, 0, "what is left is Coming soon, so nothing is current");
});

test("5.17.2 Neck-only Road: a stop's card hangs just under its own inlay, its point on that inlay, and stays on screen", { skip: skip() }, async t => {
  const page = await phone(t, { ...lib("dark", MID), settings: { ...lib("dark", MID).settings, unlockAll: true } }, { home: true });
  await page.waitForSelector(".rn-neck .rd-node"); await settled(page);
  for (const sel of ["[data-kind=box]", ".rd-node.rn-stop:not([data-kind=box])"]) {
    const id = await page.evaluate(s => document.querySelector(s).dataset.stop, sel);
    await page.evaluate(id => document.querySelector(`[data-stop="${id}"]`).scrollIntoView({ block: "center" }), id);
    await page.waitForTimeout(250);
    await page.click(`[data-stop="${id}"]`, { force: true });
    await page.waitForSelector(".rd-pop"); await page.waitForTimeout(350);
    const g = await page.evaluate(() => {
      const p = document.querySelector(".rd-pop"), n = p.parentElement.querySelector("[data-stop]"), pr = p.getBoundingClientRect(), nr = n.getBoundingClientRect();
      const b = getComputedStyle(p, "::before"), point = pr.left + parseFloat(b.left) + parseFloat(b.width) / 2;
      return { gap: pr.top - nr.bottom, off: point - (nr.left + nr.width / 2), l: pr.left, r: pr.right, w: document.documentElement.clientWidth };
    });
    assert.ok(g.gap >= 0 && g.gap <= 24, `${id}: card ${g.gap}px under its inlay`);
    assert.ok(Math.abs(g.off) <= 4, `${id}: point ${g.off}px from the inlay's centre`);
    assert.ok(g.l >= 11 && g.r <= g.w - 11, `${id}: card on screen (${g.l} to ${g.r} of ${g.w})`);
    await page.mouse.click(5, 300); await page.waitForSelector(".rd-pop", { state: "detached" });
  }
});
