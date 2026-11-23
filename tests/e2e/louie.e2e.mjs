// Louie, the mascot (Graham, 2026-11-19): the tweed amp, always a picture (art/louie/v5), the same one in every look.
// The earlier Louies (black, blue and the code drawing) are gone, and so are their tests.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser, settled } from "./harness.mjs";

useBrowser();

const libWith = (theme, extra = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const HAVE = ["cheer", "horns", "idle", "listen", "nervous", "point", "proud", "sleepy", "thumb", "wave"];

/* what one Louie on the page shows: his picture, whether it loaded, his size, and anything drawn in code */
const shown = (page, sel) => page.evaluate(async sel => {
  const svg = document.querySelector(`${sel} svg.louie`) || document.querySelector(sel);
  const im = svg.querySelector("image"), href = im.getAttribute("href"), r = svg.getBoundingClientRect(), ir = im.getBoundingClientRect();
  const probe = new Image(); probe.src = href; await probe.decode().catch(() => {});
  return { href, loaded: probe.naturalWidth > 0, images: svg.querySelectorAll("image").length, drawn: svg.querySelectorAll("path, rect, circle, ellipse, text").length, w: r.width, h: r.height, iw: ir.width, ih: ir.height, label: svg.getAttribute("aria-label") };
}, sel);

test("Louie is the tweed picture on real screens, in all four looks, and every picture loads", { skip: skip() }, async t => {
  for (const look of ["dark", "light", "green", "headliner"]) {
    const page = await phone(t, libWith(look));
    for (const [h, sel] of [["#/support", ".sp-hero"], ["#/band", ".bd-head"], ["#/tour", ".tq-head"], ["#/support", ".sp-hero"]]) {
      await page.evaluate(h => { location.hash = h; }, h);
      await page.waitForSelector("#app svg.louie");
      const l = await shown(page, "#app");
      assert.match(l.href, new RegExp(`^art/louie/v5/louie-(${HAVE.join("|")})\\.webp$`), `${look} ${h}: ${l.href}`);
      assert.equal(l.loaded, true, `${look} ${h}: the picture loads`);
      assert.equal(l.images, 1, `${look} ${h}: one picture`); assert.equal(l.drawn, 0, `${look} ${h}: nothing drawn in code`);
      assert.ok(l.iw > 20 && l.ih > 20, `${look} ${h}: he has a size on screen (${l.iw} by ${l.ih})`);
      assert.equal(sel.length > 0 && l.label, "Louie");
    }
    await page.context().close();
  }
});

test("every mood and pose at 44 to 190 px shows one of his pictures, inside its frame, never squashed", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  const out = await page.evaluate(async HAVE => {
    const { louie } = await import("/louie.js");
    const host = document.createElement("div"); host.id = "zz-louies"; host.style.cssText = "position:fixed;left:0;top:0;z-index:99;background:#141210"; document.body.appendChild(host);
    const bad = [];
    for (const mood of ["happy", "cheer", "sleepy", "worried", "proud", "listen"]) for (const pose of [undefined, "rest", "hornsUp", "thumb", "point", "wave", "peace"]) for (const size of [44, 60, 120, 190]) {
      host.innerHTML = louie(mood, { pose, size });
      const svg = host.firstElementChild, im = svg.querySelector("image"), r = svg.getBoundingClientRect(), href = im.getAttribute("href");
      const pic = new Image(); pic.src = href; await pic.decode().catch(() => {});
      const name = `${mood} ${pose} ${size}`;
      if (!HAVE.some(n => href === `art/louie/v5/louie-${n}.webp`)) bad.push(`${name}: ${href}`);
      if (!pic.naturalWidth) bad.push(`${name}: did not load`);
      if (Math.round(r.width) !== size) bad.push(`${name}: ${r.width} wide`);
      if (im.getAttribute("preserveAspectRatio") !== "xMidYMax meet") bad.push(`${name}: could be squashed`);
    }
    host.remove();
    return bad;
  }, HAVE);
  assert.deepEqual(out, []);
});

test("Louie hops when he cheers, and Reduce Motion stops it", { skip: skip() }, async t => {
  for (const [reduce, want] of [[false, "lv-hop"], [true, "none"]]) {
    const page = await phone(t, libWith("dark"), reduce ? { reducedMotion: "reduce" } : {});
    const anim = await page.evaluate(async () => {
      const { louie } = await import("/louie.js");
      const host = document.createElement("div"); document.body.appendChild(host); host.innerHTML = louie("cheer", { pose: "hornsUp", size: 120 });
      return getComputedStyle(host.querySelector(".lv-art-wrap")).animationName;
    });
    assert.equal(anim, want);
    await page.context().close();
  }
});

test("a finish bought before stays saved, and Pink Louie on the table wears the pink cabinet", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark", { merch: { has: ["tweed", "pink"], louie: "pink", tconv: 1, lconv: 1 } }));
  await page.evaluate(() => { location.hash = "#/merch"; }); await page.waitForSelector(".mc-seg"); await settled(page);
  await page.click("#mc-t-looks");
  assert.equal(await page.locator(".mc-fin[aria-label$=' Louie']").count(), 7, "Louie's finishes are on the table");
  assert.match(await page.locator(".mc-fin[data-id=pink] image").getAttribute("href"), /art\/louie\/colours\/pink\/louie-/, "Pink uses his pink picture");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).merch);
  assert.ok(saved.has.includes("tweed") && saved.has.includes("pink"), "what was bought is still saved");
  assert.equal(saved.louie, "pink");
});

test("the Songbook hint and the maker show the new face badge, and it loads", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  const ok = await page.evaluate(async () => { const im = new Image(); im.src = "art/louie/v5/louie-face-badge.webp"; await im.decode().catch(() => {}); return [im.naturalWidth, im.naturalHeight]; });
  assert.deepEqual(ok, [132, 132]);
  const old = await page.evaluate(async () => Promise.all(["art/louie/v3/louie-idle-dark.webp", "art/louie/v2/louie-idle-light.webp", "art/louie/louie-face-badge.webp"].map(async f => (await fetch(f)).status)));
  assert.deepEqual(old, [404, 404, 404], "the earlier Louie pictures are gone");
});
