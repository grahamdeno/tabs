// 5.17.1: the paste card holds together at 390 and 320 px: one-line heading, the sheet scrolls inside its box, the
// focused field lights its row (no box spilling over), Save is full width, and Review and Clean up sit on one line each.
import test from "node:test";
import assert from "node:assert/strict";
import * as H from "./harness.mjs";
H.useBrowser();
const body = "[Verse 1]\nC                        F            C\nKeeney and Kooney are dragons, it's true,\nC                            G\nOne says ROAR and one says ACHOO\n[Chorus]\nG F C\nla la\n[Bridge]\nAm F\nla";
for (const width of [390, 320]) test(`5.17.1 the paste card at ${width} px`, { skip: H.skip() }, async t => {
  const page = await H.phone(t, { ...H.LIB, settings: { ...H.LIB.settings, theme: "dark" } }, { viewport: { width, height: 844 } });
  await page.evaluate(() => import("/aihelp.js").then(m => localStorage.setItem(m.AI.store, "sk-test")));
  await page.evaluate(b => import("/library.js").then(m => m.showPasteCard({ title: "", artist: "", body: b, format: "chords", sections: 3 })), body);
  await page.waitForSelector("#p-clean"); await H.settled(page);
  const r = await page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect(), card = box(".pastecard"), lh = s => parseFloat(getComputedStyle(document.querySelector(s)).lineHeight) || 24;
    const prev = document.querySelector("#p-prev");
    return { card, what: box("#p-what").height <= lh("#p-what") * 1.5, save: box("#p-save"), edit: box("#p-edit"), clean: box("#p-clean"),
      prevInside: box("#p-prev").right <= card.right + 0.5, scrolls: prev.scrollWidth > prev.clientWidth, cardFits: document.querySelector(".pastecard").scrollWidth <= document.querySelector(".pastecard").clientWidth + 1 };
  });
  assert.ok(r.what, "the heading is one line");
  assert.ok(r.prevInside && r.cardFits, "the sheet stays inside the card");
  if (width === 320) assert.ok(r.scrolls, "a long line scrolls sideways inside its box");
  assert.ok(r.save.width >= r.card.width - 60, "Save to Songbook is full width");
  assert.ok(r.save.bottom <= r.edit.top + 1, "Review and Clean up sit under it");
  assert.ok(Math.abs(r.edit.top - r.clean.top) < 1 && r.edit.height < 70 && r.clean.height < 70, "side by side, one line each");
  await page.click("#p-title");
  const f = await page.evaluate(() => { const i = document.getElementById("p-title"), row = i.closest(".fld"), c = getComputedStyle(i); return { outline: c.outlineStyle, rowShadow: getComputedStyle(row).boxShadow }; });
  assert.ok(f.outline === "none" && f.rowShadow !== "none", "the focused field lights its row instead of a box that spills over");
});
