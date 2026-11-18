// Road Ready, step 03: Louie in code. One mouth, on the yellow panel. The grille is plain cloth. Mittens. The same
// Louie in every look, with a warm rim on the dark ones.
import test from "node:test";
import assert from "node:assert/strict";
import { phone, LIB, skip, useBrowser } from "./harness.mjs";

useBrowser();

const libWith = (theme, extra = {}) => ({ ...LIB, settings: { ...LIB.settings, v: 6, theme }, ...extra });
const MOODS = ["happy", "cheer", "sleepy", "worried", "proud"], POSES = [null, "rest", "hornsUp", "thumb", "point", "wave", "peace"], SIZES = [44, 60, 96, 112, 120];

/* Draw every mood with every pose at each size on a bare page, and measure each on screen. */
const measure = (page, sizes) => page.evaluate(async ({ MOODS, POSES, sizes }) => {
  const { louie } = await import("/louie.js");
  const host = document.createElement("div"); host.id = "zz-louies"; host.style.cssText = "position:fixed;inset:0;overflow:auto;background:var(--bg);z-index:99999";
  document.body.append(host);
  const out = [];
  const box = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  for (const size of sizes) for (const mood of MOODS) for (const pose of POSES) {
    host.innerHTML = louie(mood, pose ? { pose, size } : { size });
    const svg = host.firstElementChild, one = sel => svg.querySelector(sel);
    /* measure him standing straight and still: the cheer and proud tilt turns every part together, and the hop moves them together */
    one(".lv-body").removeAttribute("transform"); one(".lv-body").style.animation = "none";
    const cloth = box(one(".lv-cloth")), panel = box(one(".lv-panel")), mouths = [...svg.querySelectorAll(".lv-mouth")].map(box);
    const hit = (a, b) => a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
    /* everything drawn inside the grille's box, apart from the cloth, its weave, its inner shadow and its frame */
    const within = (a, b) => a.x >= b.x - .5 && a.r <= b.r + .5 && a.y >= b.y - .5 && a.b <= b.b + .5;
    const onGrille = [...svg.querySelectorAll(".lv-body *")].filter(el => !el.closest(".lv-rim") && !["g", "defs", "stop", "linearGradient", "radialGradient", "pattern"].includes(el.tagName) && !el.closest("pattern, linearGradient, radialGradient") && within(box(el), cloth)
      && !["lv-cloth", "lv-weave", "lv-cloth-sh"].some(c => el.classList.contains(c)) && !(el.classList.contains("lv-inks") && el.getAttribute("y") === "86"))
      .map(el => el.outerHTML.slice(0, 90));
    void hit;
    out.push({ at: `${mood}/${pose || "no arms"}/${size}`, size, pose, width: box(svg).w, cloth, panel, mouths, onGrille,
      eyes: [...svg.querySelectorAll(".lv-eyes")].map(box),
      knobs: [...svg.querySelectorAll(".lv-knob")].map(box),
      mouthLine: parseFloat(getComputedStyle(one(".lv-mouth")).strokeWidth) * box(svg).w / svg.viewBox.baseVal.width,
      fingers: svg.querySelectorAll(".lv-mit").length, cuffs: svg.querySelectorAll(".lv-cuff").length,
      cheeks: svg.querySelectorAll(".lv-c, .lv-lamp, .lv-t, [class*=cheek], [class*=blush]").length,
      label: svg.getAttribute("aria-label"), role: svg.getAttribute("role"),
      /* review: what the cloth's own classes draw, so a smile can't hide in the weave's class */
      cloth3: [...svg.querySelectorAll(".lv-cloth, .lv-weave, .lv-cloth-sh")].map(el => { const s = getComputedStyle(el); return `${el.getAttribute("class")}:${s.fill}/${s.stroke}/${s.strokeWidth}`; }) });
  }
  host.remove();
  return out;
}, { MOODS, POSES, sizes });

test("Road Ready 03: every mood with every pose at every size has one mouth on the panel, a plain grille, mittens and no cheeks", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  const all = await measure(page, SIZES);
  assert.equal(all.length, MOODS.length * POSES.length * SIZES.length);
  for (const l of all) {
    assert.equal(l.mouths.length, 1, `${l.at}: exactly one mouth`);
    const m = l.mouths[0], inside = (a, b) => a.x >= b.x - .5 && a.r <= b.r + .5 && a.y >= b.y - .5 && a.b <= b.b + .5;
    assert.ok(inside(m, l.panel), `${l.at}: the mouth is on the yellow panel`);
    assert.ok(m.b <= l.cloth.y || m.r <= l.cloth.x || m.x >= l.cloth.r, `${l.at}: no mouth shape is inside the grille's box`);
    assert.equal(l.knobs.length, 4, `${l.at}: four knobs`);
    assert.ok(l.eyes.length === 2 && l.eyes.every(e => e.b <= m.y + 1 && inside(e, l.panel)), `${l.at}: two eyes, on the panel, above the mouth`);
    assert.ok(l.knobs.every(k => k.y >= m.y - 1), `${l.at}: the mouth is above the knobs' feet`);
    assert.deepEqual(l.onGrille, [], `${l.at}: nothing on the grille but cloth, weave and its frame`);
    assert.deepEqual(l.cloth3, ["lv-cloth:rgb(24, 45, 71)/none/1px", "lv-weave:none/rgb(42, 68, 102)/0.9px", "lv-weave:none/rgb(42, 68, 102)/1.3px", "lv-cloth-sh:none/rgb(0, 0, 0)/3px"], `${l.at}: the cloth, the weave, the faint circle and the inner shadow, and nothing else in their classes`);
    assert.equal(l.cheeks, 0, `${l.at}: no cheeks, lamp or tongue`);
    assert.equal(l.fingers, l.pose ? 4 : 0, `${l.at}: each hand is one mitten and one thumb lobe`);
    assert.equal(l.cuffs, l.pose ? 2 : 0, `${l.at}: cuffs stay`);
    assert.equal(Math.round(l.width), l.size, `${l.at}: drawn at the size asked for`);
    assert.deepEqual([l.role, l.label], ["img", "Louie"]);
  }
});

test("Road Ready 03: at 44 px, and at 60, 96, 112 and 120, his eyes, mouth and knobs are big enough to see", { skip: skip() }, async t => {
  const page = await phone(t, libWith("light"));
  for (const l of await measure(page, SIZES)) {
    if (l.pose) continue; /* 44 px is the smallest full-body size; with arms the same 44 px also holds his raised mittens */
    assert.equal(l.eyes.length, 2, `${l.at}: two eyes`);
    assert.ok(l.eyes.every(e => e.w >= 2.4 && e.h >= .9), `${l.at}: eyes at least 2.4 px wide (${l.eyes.map(e => e.w.toFixed(1))})`);
    assert.ok(l.mouths[0].w >= 3.5 && l.mouths[0].h + l.mouthLine >= 1, `${l.at}: mouth at least 3.5 px wide and 1 px tall with its line (${l.mouths[0].w.toFixed(1)} by ${(l.mouths[0].h + l.mouthLine).toFixed(1)})`);
    assert.ok(l.knobs.every(k => k.w >= 3), `${l.at}: knobs at least 3 px wide (${l.knobs[0].w.toFixed(1)})`);
  }
  /* with arms the picture is wider than he is, so the same width makes him smaller. The smallest size any screen draws
     him with arms is 58 px (Merch, the gig card); there he still shows all three at 2 px or more */
  for (const l of (await measure(page, [58])).filter(l => l.pose)) {
    assert.ok(l.eyes.length === 2 && l.eyes.every(e => e.w >= 2) && l.mouths[0].w >= 2.5 && l.knobs.every(k => k.w >= 2), `${l.at}: eyes, mouth and knobs still drawn at 2 px or more`);
  }
});

test("Road Ready 03: Louie has the same colours in all four looks, the locked palette, with the warm rim only on the dark looks", { skip: skip() }, async t => {
  const paints = {};
  for (const look of ["dark", "light", "green", "headliner"]) {
    const page = await phone(t, libWith(look));
    paints[look] = await page.evaluate(async () => {
      const { louie } = await import("/louie.js");
      const host = document.createElement("div"); document.body.append(host);
      host.innerHTML = louie("cheer", { pose: "wave", size: 120 }) + louie("sleepy", { size: 60 });
      const hex = c => { if (c.startsWith("url(")) return "url"; const m = c.match(/\d+(\.\d+)?/g); return !m ? c : m.length > 3 && +m[3] === 0 ? "none" : "#" + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, "0")).join("").toUpperCase(); };
      const parts = [...host.querySelectorAll("svg.louie *")].filter(el => !["g", "text", "defs", "stop", "linearGradient", "radialGradient", "pattern"].includes(el.tagName) && !el.closest(".lv-rim, defs"))
        .map(el => { const s = getComputedStyle(el); return `${el.getAttribute("class") || el.parentElement.getAttribute("class") || el.tagName}:${hex(s.fill)}/${hex(s.stroke)}`; });
      const by = cls => hex(getComputedStyle(host.querySelector("." + cls)).fill), line = cls => hex(getComputedStyle(host.querySelector("." + cls)).stroke);
      return { look: document.documentElement.dataset.look, parts, rim: getComputedStyle(host.querySelector(".lv-rim")).opacity, rimStroke: hex(getComputedStyle(host.querySelector(".lv-rim")).stroke),
        locked: { tolex: by("lv-tolex"), side: by("lv-side"), panel: by("lv-panel"), panelShade: by("lv-panel-sh"), cloth: by("lv-cloth"), weave: line("lv-weave"), nickel: by("lv-nickel"), leather: line("lv-leather"), knob: by("lv-knob"), ink: by("lv-ink"), mitten: by("lv-mit"), arm: line("lv-arm") } };
    });
    await page.context().close();
  }
  assert.deepEqual(Object.values(paints).map(p => p.look), ["neon", "festival", "green", "headliner"]);
  assert.deepEqual(paints.dark.locked, { tolex: "#23406A", side: "#1A3152", panel: "#F0B23A", panelShade: "#D9982A", cloth: "#182D47", weave: "#2A4466", nickel: "#948573", leather: "#55331B", knob: "#E8D5B3", ink: "#0B0F14", mitten: "#23406A", arm: "#23406A" });
  assert.ok(paints.dark.parts.length > 60);
  for (const look of ["light", "green", "headliner"]) assert.deepEqual(paints[look].parts, paints.dark.parts, `${look}: every part has the same fill and line as in Dark`);
  assert.deepEqual(Object.fromEntries(Object.entries(paints).map(([k, p]) => [k, p.rim])), { dark: "0.35", light: "0", green: "0", headliner: "0.35" }, "the rim shows on the dark looks only");
  assert.equal(paints.dark.rimStroke, "#FFE2B4");
});

test("Road Ready 03: a finish from the Merch table still recolours him (kept until Graham decides)", { skip: skip() }, async t => {
  const page = await phone(t, libWith("dark"));
  const fills = await page.evaluate(async () => {
    const { louie } = await import("/louie.js");
    const host = document.createElement("div"); document.body.append(host);
    host.innerHTML = `<span class="fin fin-stock">${louie("happy", { size: 60 })}</span><span class="fin fin-tweed">${louie("happy", { size: 60 })}</span>`;
    return [...host.querySelectorAll("rect.lv-tolex")].map(el => getComputedStyle(el).fill);
  });
  assert.deepEqual(fills, ["rgb(35, 64, 106)", "rgb(216, 181, 113)"], "Stock is the locked blue; Tweed is still tweed");
});

test("Road Ready 03: Louie hops and blinks, and Reduce Motion stops both", { skip: skip() }, async t => {
  const anims = async reducedMotion => {
    const page = await phone(t, libWith("dark"), { reducedMotion });
    return page.evaluate(async () => {
      const { louie } = await import("/louie.js");
      const host = document.createElement("div"); document.body.append(host);
      host.innerHTML = louie("happy", { size: 120 }) + louie("cheer", { pose: "hornsUp", size: 120 }) + louie("happy", { pose: "hornsUp", size: 120 });
      const [a, b, c] = host.querySelectorAll("svg.louie");
      return [getComputedStyle(a.querySelector(".lv-eye")).animationName, getComputedStyle(b.querySelector(".lv-body")).animationName, getComputedStyle(c.querySelector(".lv-body")).animationName, a.querySelectorAll(".lv-eye").length];
    });
  };
  assert.deepEqual(await anims("no-preference"), ["lv-blink", "lv-hop", "lv-hop", 2], "he blinks when happy and hops when he cheers");
  assert.deepEqual(await anims("reduce"), ["none", "none", "none", 2], "Reduce Motion: no blink, no hop");
});

test("Road Ready 03: on real screens Louie is the new drawing, with one mouth each", { skip: skip() }, async t => {
  for (const look of ["dark", "green"]) {
    const page = await phone(t, libWith(look));
    for (const h of ["#/band", "#/merch", "#/support"]) {
      await page.evaluate(h => { location.hash = h; }, h);
      await page.waitForFunction(() => document.querySelectorAll("#app svg.louie").length > 0);
      const seen = await page.evaluate(() => [...document.querySelectorAll("svg.louie")].map(s => [s.querySelectorAll(".lv-mouth").length, s.querySelectorAll(".lv-cloth").length, s.querySelectorAll(".lv-c, .lv-g, .lv-m, .lv-ms, .lv-lamp").length]));
      assert.ok(seen.length >= 1, `${look} ${h}: Louie is on the screen`);
      for (const s of seen) assert.deepEqual(s, [1, 1, 0], `${look} ${h}: one mouth, one grille, none of the old parts`);
    }
    await page.context().close();
  }
});

test("Road Ready 03 review: the warm rim shows on dark surfaces only, not on the bright Band and Tour headers of a dark look", { skip: skip() }, async t => {
  for (const look of ["dark", "headliner"]) {
    const page = await phone(t, libWith(look));
    for (const [h, sel, rim] of [["#/band", ".bd-head", "0"], ["#/tour", ".tq-head", "0"], ["#/support", ".sp-hero", "0.35"]]) {
      await page.evaluate(h => { location.hash = h; }, h);
      await page.waitForSelector(`${sel} svg.louie`);
      assert.equal(await page.evaluate(sel => getComputedStyle(document.querySelector(`${sel} svg.louie .lv-rim`)).opacity, sel), rim, `${look} ${h}: rim ${rim}`);
    }
    await page.context().close();
  }
});
