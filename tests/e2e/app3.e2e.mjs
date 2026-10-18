// Browser tests, part 3 of app.e2e (split so files run side by side).
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser } from "./harness.mjs";

useBrowser();


test("2.2 ring: motion lifts Play (hand), a set adds Set to the ring; iPad keeps the bar", { skip: skip() }, async t => {
  const songs = [...LIB.songs, { id: "x0", title: "One", artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0"] }], settings: { ...LIB.settings, controls: "ring", follow: "hand", motionAsked: true } });
  await page.goto(base + "#/set/s"); await page.waitForTimeout(400);
  await page.click("[data-open='0']"); await page.waitForTimeout(5800);
  assert.equal(await page.evaluate(() => document.body.classList.contains("ring-up")), false, "settled");
  await page.evaluate(() => { for (let i = 0; i < 6; i++) window.dispatchEvent(new DeviceMotionEvent("devicemotion", { accelerationIncludingGravity: { x: 0, y: -9.8, z: 0 }, rotationRate: { alpha: 20, beta: 10, gamma: 5 } })); });
  await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => document.body.classList.contains("ring-up")), true, "picking the phone up lifts Play");
  const c = await page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(600);
  assert.equal(await page.locator(".ringx .ri[data-r='set']").count(), 1, "Set in a set");
  await page.mouse.up(); await page.mouse.click(60, 120); await page.waitForTimeout(200);
  assert.match(await page.innerText("#setdial"), /1 of 2/, "4 of 9 sits in the island");

  const pad = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring" } }, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForTimeout(400);
  assert.equal(await pad.evaluate(() => document.body.classList.contains("ring")), false, "iPad: no ring");
  assert.equal(await pad.evaluate(() => document.getElementById("play").closest(".player") !== null), true, "iPad: Play in the bar");
});

test("2.3 sweep the track: up the arc moves forward in the song, down moves back", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 6 }, () => LIB.songs[0].body).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  await page.mouse.click(120, 300); await page.waitForTimeout(900);
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21);
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const lit = () => page.evaluate(() => document.querySelector(".rc-t1").getAttribute("d"));
  const before = await lit();
  const startY = await page.evaluate(() => +document.querySelector(".rc-hit").getAttribute("d").split(" ")[2]);
  assert.ok(startY < 844 - 29, `the arc stays clear of the home bar (${startY})`);
  let p = at(190);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 192; a <= 220; a += 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const y1 = await page.evaluate(() => scrollY);
  assert.ok(y1 > 200, `sweeping up the arc moves forward (${y1})`);
  for (let a = 216; a >= 204; a -= 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const y2 = await page.evaluate(() => scrollY);
  assert.ok(y2 < y1 - 60, `sweeping down moves back (${y2} < ${y1})`);
  await page.mouse.up(); await page.waitForTimeout(200);
  assert.notEqual(await lit(), before, "the lit part shows the new place");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll", "sweeping doesn't press Play");
  /* While playing: auto-scroll carries on from the new place. */
  await page.click("#play"); await page.waitForTimeout(400);
  /* (a tap on the words would pause, so lift Play with a touch elsewhere) */
  await page.evaluate(() => { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); document.body.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); });
  await page.waitForTimeout(800);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  p = at(190); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 192; a <= 214; a += 4) { p = at(a); await page.mouse.move(p.x, p.y); }
  const held = await page.evaluate(() => scrollY); await page.waitForTimeout(500);
  assert.ok(Math.abs(await page.evaluate(() => scrollY) - held) < 3, "holds still under the thumb");
  await page.mouse.up(); await page.waitForTimeout(1500);
  const after = await page.evaluate(() => [scrollY, document.documentElement.scrollHeight - innerHeight, document.getElementById("play").getAttribute("aria-label"), document.body.className]);
  assert.ok(after[0] > held || after[0] >= after[1] - 2, `then carries on (${held} -> ${after})`);
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll", "still playing");
});

test("2.4 arc: a full sweep goes end to end; a slow sweep moves finely; the section glows", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 12 }, (_, i) => LIB.songs[0].body.replace("[Chorus]", `[Chorus ${i + 1}]`)).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const lift = async () => { await page.mouse.click(120, 300); await page.waitForTimeout(800); };
  await lift();
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21), a0 = 180 + Math.asin(30 / r) * 180 / Math.PI;
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  assert.ok(max > 3000, "a long song");
  /* Slow: a fifth of the arc, gently, moves less than a screen. */
  let p = at(a0 + 3); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = a0 + 3; a <= a0 + 18; a += 1) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(40); }
  const slow = await page.evaluate(() => scrollY);
  assert.ok(slow > 20 && slow < 844, `slow sweep moves finely (${slow})`);
  assert.match(await page.textContent(".rc-where"), /VERSE|Verse|CHORUS|Chorus/i, "the section glows while sweeping");
  await page.mouse.up(); await page.waitForTimeout(300);
  /* End to end in one sweep: the end of the song. */
  await lift();
  p = at(a0 + 2); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = a0 + 2; a <= 263; a += 6) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(15); }
  p = at(263); await page.mouse.move(p.x, p.y); await page.waitForTimeout(50);
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.ok(await page.evaluate(() => scrollY) >= max - 2, "a full sweep up reaches the end");
  await lift();
  p = at(262); await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let a = 262; a >= a0 + 1; a -= 6) { p = at(a); await page.mouse.move(p.x, p.y); await page.waitForTimeout(15); }
  p = at(a0 + 1); await page.mouse.move(p.x, p.y);
  await page.mouse.up(); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => scrollY), 0, "a full sweep down reaches the start");
});

test("2.4.6 arc: real touch sweeps move steadily, never jump, never reverse", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: Array.from({ length: 14 }, (_, i) => LIB.songs[0].body.replace("[Chorus]", `[Chorus ${i + 1}]`)).join("\n\n") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, controls: "ring", follow: "touch" } }, { isMobile: true });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const W = 390, H = 844, r = Math.hypot(W * 0.34, H * 0.21), a0 = 180 + Math.asin(30 / r) * 180 / Math.PI;
  const at = a => ({ x: W + r * Math.cos(a * Math.PI / 180), y: H + r * Math.sin(a * Math.PI / 180) });
  const touch = (type, p) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const sweep = async (from, to, degPerSec) => {
    await touch("touchStart", { x: 100, y: 300 }); await touch("touchEnd"); await page.waitForTimeout(900); /* lift Play */
    await page.evaluate(() => { window.__ys = []; const f = () => { window.__ys.push(scrollY); window.__raf = requestAnimationFrame(f); }; f(); });
    const steps = Math.ceil(Math.abs(to - from) / degPerSec * 60); let p = at(from);
    await touch("touchStart", p);
    for (let i = 1; i <= steps; i++) { p = at(from + (to - from) * i / steps); await touch("touchMove", p); await page.waitForTimeout(16); }
    await touch("touchEnd"); await page.waitForTimeout(300);
    const ys = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ys; });
    const d = ys.slice(1).map((y, i) => y - ys[i]).filter(Boolean);
    return { moved: ys.at(-1) - ys[0], biggest: Math.max(0, ...d.map(Math.abs)), reversals: d.filter((x, i) => i && Math.sign(x) !== Math.sign(d[i - 1])).length, end: ys.at(-1) };
  };
  const slow = await sweep(a0 + 4, a0 + 20, 25);
  assert.ok(slow.moved > 60 && slow.moved < 400, `slow: fine (${slow.moved})`);
  assert.ok(slow.biggest <= 14 && slow.reversals === 0, `slow: steady (${JSON.stringify(slow)})`);
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
  const full = await sweep(a0 + 3, 262.5, 250);
  assert.ok(full.end >= max - 2, `a quick full sweep reaches the end (${full.end} of ${max})`);
  assert.ok(full.biggest < max * 0.12 && full.reversals === 0, `no jump: biggest frame ${full.biggest} of ${max}`);
  const back = await sweep(255, 230, 40);
  assert.ok(back.moved < 0 && back.reversals === 0, `back up the song, steadily (${JSON.stringify(back)})`);
});

test("2.5 Settings > Song map turns the section rail off and on", { skip: skip() }, async t => {
  const page = await phone(t);
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "on by default");
  await page.goto(base + "#/settings/diagrams"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.waitForTimeout(200);
  assert.equal(await page.getAttribute("#s-map", "aria-checked"), "false");
  await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 0, "off: no rail");
  await page.goto(base + "#/settings/diagrams"); await page.waitForTimeout(300);
  await page.click("#s-map"); await page.goto(base + "#/song/a"); await page.waitForTimeout(500);
  assert.equal(await page.locator(".smap").count(), 1, "back on");
});

test("2.5 Back: in the island; pull down at the top; the library opens at its top", { skip: skip() }, async t => {
  const songs = Array.from({ length: 30 }, (_, i) => ({ id: "s" + i, title: "Song " + String(i).padStart(2, "0"), artist: "A", format: "chords", body: "[Verse]\nG C\nla" }));
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, ...songs], settings: { ...LIB.settings, controls: "ring", follow: "touch" } }, { isMobile: true });
  await page.evaluate(() => scrollTo(0, 1500)); await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = "#/song/s25"; }); await page.waitForTimeout(500);
  const b = await page.evaluate(() => { const r = document.getElementById("rc-back").getBoundingClientRect(); return { x: r.left, y: r.top, v: getComputedStyle(document.getElementById("rc-back")).display }; });
  assert.ok(b.y > 760 && b.v !== "none", `Back sits in the island (${JSON.stringify(b)})`);
  await page.click("#rc-back"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/library");
  assert.equal(await page.evaluate(() => scrollY), 0, "the library opens at its top");
  /* Pull down at the top of a song. */
  await page.evaluate(() => { location.hash = "#/song/a"; }); await page.waitForTimeout(500);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: y == null ? [] : [{ x: 150, y }] });
  await touch("touchStart", 300);
  for (let y = 300; y <= 360; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); }
  await touch("touchEnd"); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => location.hash), "#/song/a", "a short pull springs back");
  await touch("touchStart", 300);
  for (let y = 300; y <= 420; y += 10) { await touch("touchMove", y); await page.waitForTimeout(16); }
  assert.match(await page.textContent(".rc-pull"), /Release for Library/);
  assert.equal(await page.evaluate(() => document.querySelector(".rc-pull").classList.contains("go")), true);
  await touch("touchEnd"); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => location.hash), "#/library", "a full pull goes back");
});

test("2.6.4 Tips & gestures: one-hand group first, no button-only rows, Show me points at the ring", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch" } });
  await page.goto(base + "#/gestures"); await page.waitForTimeout(300);
  const labels = await page.evaluate(() => [...document.querySelectorAll(".label")].map(x => x.textContent));
  assert.match(labels[0], /One hand/i, "one-hand group first");
  const text = await page.innerText("#app");
  for (const t of ["Hold Play", "Sweep the arc", "Pull down at the top", "Hold the time"]) assert.ok(text.includes(t), t);
  for (const t of ["Tap the cover", "Arrows in Edit", "Tap the status chip", "Sheet and Text"]) assert.ok(!text.includes(t), `no ${t}`);
  assert.ok(await page.locator(".gs-row").count() <= 24, "trimmed");
  await page.click(".gs-show[data-demo='ring']"); await page.waitForTimeout(1800);
  assert.match(await page.evaluate(() => location.hash), /#\/song\//);
  assert.ok(await page.locator(".coach").count() >= 1, "the tip points at Play");
});

test("2.6.5 speed dial: a wobble doesn't change it; Undo restores; nothing selectable", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
  const before = (await page.innerText("#dialbtn")).trim();
  const b = await page.locator("#dialbtn").boundingBox();
  const x = b.x + 20, y = b.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".dial-big")).webkitUserSelect || getComputedStyle(document.querySelector(".dial-big")).userSelect), "none");
  await page.mouse.move(x + 6, y - 8, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(300);
  if (await page.locator(".dial").count()) { await page.mouse.click(60, 120); await page.waitForTimeout(300); }
  assert.equal((await page.innerText("#dialbtn")).trim(), before, "a small wobble changes nothing");
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 60, y - 140, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  assert.notEqual((await page.innerText("#dialbtn")).trim(), before, "a real sweep changes it");
  assert.match(await page.innerText("#toast"), /Length .*Undo/s);
  await page.click("#toast .tact"); await page.waitForTimeout(300);
  assert.equal((await page.innerText("#dialbtn")).trim(), before, "Undo puts it back");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").duration, 200);
});

test("Add the words: paste lyrics on a chord chart and the chords go over them", { skip: skip() }, async t => {
  const chart = "[Verse]\nG   D   Em   C\n\n[Chorus]\nC   G   D";
  const page = await phone(t, { ...LIB, songs: [{ id: "c", title: "Chart Song", artist: "X", format: "chords", ai: "chart", body: chart }, ...LIB.songs] });
  await page.goto(base + "#/song/c"); await page.waitForTimeout(400);
  await page.click("#more"); await page.click(".menu [data-m='words']"); await page.waitForTimeout(400);
  assert.equal(await page.isDisabled("#ws-ok"), true, "nothing to save before words");
  await page.fill("#ws-text", "first line of the verse here\nsecond line goes on\n\n[Chorus]\nthis is the chorus line");
  await page.waitForTimeout(400);
  assert.match(await page.textContent("#ws-prev"), /\[Verse\]\nG\s+D\nfirst line of the verse here/);
  await page.click("#ws-ok"); await page.waitForTimeout(500);
  const body = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body;
  assert.match(body, /\[Chorus\]\nC\s+G\nthis is the chorus line/);
  assert.match(await page.textContent("#sheet"), /first line of.*chorus line/, "the song page shows the words");
  await page.click("#toast .tact"); await page.waitForTimeout(300);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "c").body, chart, "Undo");
});

test("typing in Text on a phone opens writing mode; the editor fills the top and the bar rides above", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add");
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.focus("#ed-body");
  await page.waitForTimeout(450);
  assert.ok(await page.evaluate(() => document.body.classList.contains("writing")), "writing mode on");
  const box = await page.locator(".ed-tx").boundingBox(), bar = await page.locator(".cebar").boundingBox();
  assert.ok(box.y >= 0 && box.y < 70, `editor at the top, under the title strip (y=${box.y})`);
  assert.ok(bar.y >= box.y + box.height, "bar sits below the editor, not over it");
  assert.ok(await page.locator("#ce-done").isVisible(), "Save stays one tap away while typing");
  await page.keyboard.type("[Verse]\nG\nHello" + "\nline".repeat(60));
  const st = await page.evaluate(() => document.querySelector(".ed-tx").scrollTop);
  assert.ok(st > 0, "the editor follows the caret down");
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(100);
  assert.ok(!(await page.evaluate(() => document.body.classList.contains("writing"))), "writing mode off when the keyboard closes");
});

test("2.13/2.16.4 Library: no Key or Tuning chip in a big library", { skip: skip() }, async t => {
  const keys = ["G", "C", "D", "A", "E", "F"];
  const songs = Array.from({ length: 14 }, (_, i) => ({ id: "k" + i, title: "Song " + i, artist: "A", format: "chords", key: keys[i % 6], tuning: i % 2 ? "dropd" : undefined, body: `[Verse]\n${keys[i % 6]}\nla` }));
  const page = await phone(t, { ...LIB, songs });
  assert.equal(await page.locator("#f-key").count(), 0, "no Key chip");
  assert.equal(await page.locator("#f-tune").count(), 0, "no Tuning chip (2.16.4)");
});

test("tuner 2.16.1: an octave slip on the low E still reads E, and the audio is running", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base); await page.waitForTimeout(400);
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), { ...LIB, settings: { ...LIB.settings, tipsSeen: { ...LIB.settings.tipsSeen, tuner: true }, micExplained: true } });
  await page.reload(); await page.waitForTimeout(300);
  await page.click("#tunerbtn"); await page.waitForTimeout(600);
  const read = () => page.evaluate(() => ({ note: document.getElementById("tn-n").textContent, say: document.getElementById("tn-say").textContent }));
  await page.evaluate(() => { window.__hz = 82.41 * 2 * 2 ** (-20 / 1200); }); await page.waitForTimeout(800);
  const r = await read();
  assert.equal(r.note, "E"); assert.equal(r.say, "Tighten the E string", "read as the low E, 20 cents flat, not a far-off note");
  await page.click("#tn-done");
  assert.deepEqual(errors, []);
});

test("2.19.1 Library: the Recent cards show (the ring's styles had been hiding them)", { skip: skip() }, async t => {
  const now = Date.now();
  const songs = ["One", "Two", "Three", "Four"].map((title, i) => ({ id: "r" + i, title, artist: "A", format: "chords", body: "[Verse]\nG C\nla", opened: now - i * 60000 }));
  const page = await phone(t, { ...LIB, songs, sets: [], settings: { ...LIB.settings, controls: "ring" } }, { isMobile: true });
  const shown = await page.evaluate(() => [...document.querySelectorAll(".recent .rc")].map(el => el.offsetParent !== null && el.getBoundingClientRect().height > 20));
  assert.deepEqual(shown, [true, true], "two Recent cards, visible");
});

test("2.30.1: editing or adding a song hides Play and the arc", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, controls: "ring", follow: "touch" } }, { isMobile: true });
  await page.click("#add"); await page.waitForTimeout(700);
  await page.mouse.click(200, 300); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("rc")).display), "none", "no Play or arc on the new song page");
  assert.equal(await page.locator("#play").isVisible(), false);
});

test("2.33.0: writing mode keeps the song in view: a strip with title, artist and key; Return comes back to the pad", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { isMobile: true });
  await page.click("#add"); await page.waitForTimeout(600);
  await page.focus("#ed-body"); await page.waitForTimeout(400);
  assert.ok(await page.locator("#ed-strip").isVisible(), "the strip shows while writing");
  assert.match(await page.innerText("#ed-strip"), /Add a title/);
  const s = await page.locator("#ed-strip").boundingBox(), p = await page.locator(".ed-tx").boundingBox();
  assert.ok(p.y >= s.y + s.height, "the pad sits below the strip");
  await page.keyboard.type("[Verse]\nG       C\nHello there");
  await page.click("#ed-strip"); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-title", "tap the strip: the title");
  await page.keyboard.type("Porch Light"); await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-artist", "Return: the artist");
  await page.keyboard.type("Me"); await page.keyboard.press("Enter"); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.activeElement.id), "ed-body", "Return again: back to the pad");
  assert.match(await page.innerText("#ed-strip"), /Porch Light\s*·\s*Me\s*·\s*Key G/);
});

test("the metronome plays a drum beat: kick, snare and hi-hat", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__hits = { osc: 0, noise: 0 };
    const C = window.AudioContext || window.webkitAudioContext;
    const o = C.prototype.createOscillator, n = C.prototype.createBufferSource;
    C.prototype.createOscillator = function () { window.__hits.osc++; return o.call(this); };
    C.prototype.createBufferSource = function () { window.__hits.noise++; return n.call(this); };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500);
  const h = await page.evaluate(() => window.__hits);
  assert.ok(h.osc >= 2, `kick and snare drums (${h.osc})`);
  assert.ok(h.noise >= 4, `snare and hi-hat noise (${h.noise})`);
  assert.deepEqual(errors, []);
});

test("the bass plays the root of each chord, at the sounding pitch, with the metronome off", { skip: skip() }, async t => {
  const plain = { id: "bs1", title: "Bass Song", artist: "Me", key: "G", format: "chords", bpm: 240, body: "[Verse]\nG   D   Em   C" };
  const capo = { id: "bs2", title: "Capo Bass", artist: "Me", key: "A", format: "chords", bpm: 240, body: "Capo 2 · Strum: D-DU-UDU\n\n[Verse]\nG   D   Em   C" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, plain, capo], settings: { ...LIB.settings, metronome: false, bass: true, bassStyle: "root", countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const freqs = async id => {
    await page.evaluate(() => { window.__osc.length = 0; });
    await page.evaluate(i => { location.hash = "#/song/" + i; }, id); await page.waitForSelector("#play");
    await page.click("#play"); await page.waitForTimeout(2700); await page.click("#play");
    return page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  };
  const low = await freqs("bs1");
  assert.ok(low.includes(98), `a G root at 98 Hz with the metronome off (${low})`);
  assert.ok(low.includes(146.8) && low.includes(82.4), `then D (146.8 Hz) and Em (82.4 Hz), a chord a bar (${low})`);
  const capoed = await freqs("bs2");
  assert.ok(capoed.includes(110), `Capo 2: the G shape sounds an A at 110 Hz (${capoed})`);
  assert.ok(!capoed.includes(98), "the shape's own G is not played");
  await page.evaluate(i => { location.hash = "#/song/" + i; }, "bs1"); await page.waitForSelector("#more");
  await page.click("#more"); await page.click(".menu [data-m='bass']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.bass === false);
  assert.match(await page.innerText("#toast"), /Bass off/);
  assert.deepEqual(errors, []);
});

test("the bass also plays under a lyric sheet, with the walking line and the metronome on", { skip: skip() }, async t => {
  const song = { id: "bs3", title: "Words Song", artist: "Me", key: "G", format: "chords", bpm: 200, body: "[Verse]\nG       C\nHello there my friend\nD       Em\nSing along with me" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: true, bass: true, bassStyle: "walk", countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  await page.evaluate(() => { location.hash = "#/song/bs3"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1800); await page.click("#play");
  const f = await page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  assert.ok(f.includes(98), `the first chord's root is played (${f})`);
  assert.ok(f.some(x => x > 98 && x < 200), "and the walk moves to other notes");
  assert.deepEqual(errors, []);
});

test("a song's groove is found once, used for the song, and changed in Edit", { skip: skip() }, async t => {
  const song = { id: "gv", title: "Slow Blues", artist: "Me", key: "G", format: "chords", bpm: 100, body: "[Verse]\nG   C   G   D" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: true, countIn: false, controls: "bar" } });
  let asks = 0;
  await page.route("https://api.anthropic.com/**", r => {
    asks++;
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: '{"beat": "half", "swing": "light", "bass": "walk"}' }], stop_reason: "end_turn" }) });
  });
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  const groove = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove);
  await page.evaluate(() => { location.hash = "#/song/gv"; }); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove, null, { timeout: 5000 });
  assert.deepEqual(await groove(), { src: "ai", beat: "half", swing: "light", bass: "walk" });
  assert.match(await page.innerText("#toast"), /Groove: Half time, light swing, walking bass/);
  await page.click("#play"); await page.click("#play"); await page.click("#play");
  assert.equal(asks, 1, "asked once; a song with a groove is not looked up again");
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector("#ed-g-beat");
  assert.match(await page.innerText(".ed-chips"), /Drums\s*Half time\s*Found/);
  const saved = src => page.waitForFunction(w => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove?.src === w, src);
  await page.selectOption("#ed-g-beat", "rock"); await saved("you");
  assert.deepEqual(await groove(), { src: "you", beat: "rock", swing: "light", bass: "walk" });
  await page.selectOption("#ed-g-swing", ""); await page.waitForSelector("#ed-g-bass");
  await page.selectOption("#ed-g-bass", ""); await page.waitForSelector("#ed-g-beat");
  await page.selectOption("#ed-g-beat", "");
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "gv").groove).length === 1);
  assert.deepEqual(await groove(), { src: "you" }, "all defaults: kept, and not looked up again");
  assert.match(await page.innerText(".ed-chips"), /Drums\s*Default/);
  assert.ok(await page.$("#ed-g-find"), "Find again is there with a key");
});

test("a bass riff: drawn in Edit, kept on the song, and played on each chord", { skip: skip() }, async t => {
  const song = { id: "rf1", title: "Riff Song", artist: "Me", key: "G", format: "chords", bpm: 240, body: "[Verse]\nG   G   G   G" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, metronome: false, bass: true, countIn: false, controls: "bar" } });
  await page.evaluate(() => {
    window.__osc = [];
    const C = window.AudioContext || window.webkitAudioContext, o = C.prototype.createOscillator;
    C.prototype.createOscillator = function () { const n = o.call(this); window.__osc.push(n); return n; };
  });
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  const groove = () => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "rf1").groove);
  await page.evaluate(() => { location.hash = "#/song/rf1"; }); await page.waitForSelector("#play");
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector("#ed-g-bass");
  await page.selectOption("#ed-g-bass", "riff"); await page.waitForSelector(".rf-c");
  assert.equal((await page.$$(".rf-c")).length, 16, "sixteen steps");
  assert.equal(await page.innerText(".rf-c[data-k='0']"), "1", "a root on the beat to start from");
  for (let i = 0; i < 3; i++) await page.click(".rf-c[data-k='8']"); /* rest, root, third, fifth */
  assert.equal(await page.innerText(".rf-c[data-k='8']"), "5");
  await page.click("#rf-play"); await page.click("#rf-ok");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === "rf1").groove?.riff);
  assert.deepEqual(await groove(), { src: "you", bass: "riff", riff: "1.......5......." });
  assert.ok(await page.$("#ed-g-riff"), "Edit riff is there");
  await page.click("#ed-g-riff"); await page.waitForSelector(".rf-c");
  assert.equal(await page.innerText(".rf-c[data-k='8']"), "5", "the riff opens as it was saved");
  await page.click("#rf-scrim");
  await page.evaluate(() => { window.__osc.length = 0; });
  await page.evaluate(() => { location.hash = "#/library"; }); await page.waitForSelector(".list .row");
  await page.evaluate(() => { location.hash = "#/song/rf1"; }); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1300); await page.click("#play");
  const f = await page.evaluate(() => [...new Set(window.__osc.map(n => Math.round(n.frequency.value * 10) / 10))]);
  assert.ok(f.includes(98) && f.includes(146.8), `the riff plays the root (98 Hz) and the fifth (146.8 Hz) of G (${f})`);
  assert.deepEqual(errors, []);
});

test("Settings: the metronome's switch, volume and sound; a song with no tempo gets one", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false, controls: "bar" } });
  await page.route("https://api.anthropic.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: '{"bpm": 120, "beats": 4}' }], stop_reason: "end_turn" }) }));
  await page.evaluate(() => localStorage.setItem("tabs.apikey.v1", "sk-test"));
  await page.evaluate(() => { location.hash = "#/settings/playing"; }); await page.waitForSelector("#s-metro");
  await page.click("#s-metro");
  await page.$eval("#s-metvol", el => { el.value = 40; el.dispatchEvent(new Event("input")); el.dispatchEvent(new Event("change")); });
  await page.click("#s-metsound [data-m='click']");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings.metroSound === "click");
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s.metronome, true); assert.equal(s.metroVol, 0.4); assert.equal(s.metroSound, "click");
  assert.equal(await page.getAttribute("#s-metsound [data-m='click']", "aria-pressed"), "true");
  assert.equal(await page.$("#s-metbeat"), null, "the drum beat and swing only show with Drums");
  await page.click("#s-metsound [data-m='drums']"); await page.waitForSelector("#s-metbeat");
  await page.selectOption("#s-metbeat", "half"); await page.click("#s-metswing [data-m='light']"); await page.click("#s-metdrop");
  await page.click("#s-bass");
  assert.equal(await page.getAttribute("#s-bass", "aria-checked"), "true");
  await page.selectOption("#s-bassstyle", "walk"); await page.click("#s-bassonly");
  await page.click("#s-metsound [data-m='click']");
  await page.waitForFunction(() => { const x = JSON.parse(localStorage.getItem("tabs-v1")).settings; return x.metroDrop === true && x.bassOnly === true && x.metroSound === "click"; });
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).settings);
  assert.equal(s2.bass, true); assert.equal(s2.bassStyle, "walk"); assert.equal(s2.bassOnly, true);
  assert.equal(s2.metroBeat, "half"); assert.equal(s2.metroSwing, "light"); assert.equal(s2.metroSound, "click");
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => !x.bpm)?.id);
  assert.ok(id, "a test song without a tempo");
  await page.evaluate(i => { location.hash = "#/song/" + encodeURIComponent(i); }, id); await page.waitForSelector("#play");
  await page.click("#play");
  await page.waitForFunction(i => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(x => x.id === i).bpm === 120, id, { timeout: 5000 });
  assert.match(await page.innerText("#toast"), /Tempo found: 120 BPM/);
});

test("Remove the capo: a chart's capo comes off and the chords move to the key it sounds in", { skip: skip() }, async t => {
  const song = { id: "cp", title: "Capo Song", artist: "Me", key: "A", format: "chords", body: "Capo 2 · Strum: D-DU-UDU\n\n[Verse]\nG   D   Em   C" };
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, song], settings: { ...LIB.settings, controls: "bar" } });
  await page.evaluate(() => { location.hash = "#/song/cp"; }); await page.waitForSelector("#sheet");
  const chords = () => page.$$eval("#sheet .c", els => els.map(e => e.textContent.trim()).filter(Boolean));
  const before = await chords();
  await page.click("#more"); await page.click(".menu [data-m='capo']"); await page.waitForTimeout(300);
  const after = await chords();
  assert.match(await page.innerText("#sheet"), /No capo \(Capo 2 taken off\)/);
  assert.ok(before.includes("G") && after.includes("A") && after.includes("F#m"), `G D Em C becomes A E F#m D (${before} → ${after})`);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "cp").capoOff, true);
  await page.click("#more"); await page.click(".menu [data-m='capo']"); await page.waitForTimeout(300);
  assert.deepEqual(await chords(), before, "and back");
});

test("Tour Map: on by default on plain ground, no location or map pictures until you plant your flag; pinch and drag go to the map", { skip: skip() }, async t => {
  const day = new Date().toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 5, last: Date.now(), days: { [day]: 5 } } }));
  const page = await phone(t, { ...LIB, songs }, { geolocation: { latitude: 40.71278, longitude: -74.00594 }, permissions: [] });
  const tiles = []; const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==", "base64");
  await page.route(/tile\.openstreetmap\.org/, r => { tiles.push(r.request().url()); r.fulfill({ contentType: "image/png", body: png }); });
  await page.evaluate(() => { window.__asked = 0; const g = navigator.geolocation, f = g.getCurrentPosition.bind(g); g.getCurrentPosition = (...a) => { window.__asked++; return f(...a); }; });
  await page.evaluate(() => { location.hash = "#/playmap"; });
  await page.waitForSelector(".tm-map svg path", { state: "attached" });
  assert.equal(await page.evaluate(() => document.body.classList.contains("tm-open")), true, "the page is locked while the map is open");
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".tm-page")).touchAction), "none");
  await page.waitForSelector("#tm-venue:not([hidden])");
  assert.equal(await page.locator(".tm-bd.you").count(), 1, "the scene board ranks you with the rivals");
  assert.match(await page.textContent("#tm-sbody"), /You hold \d+ hexagon/);
  assert.ok(await page.locator(".tm-rival").count() >= 4, "rival players have turf around you");
  assert.match(await page.innerText(".tm-venue"), /Open mic · \d+ plays? to the Coffeehouse/);
  assert.ok(await page.locator(".tm-map path").count() >= 3, "fog, glow and outline are drawn");
  assert.equal(tiles.length, 0, "no map pictures before a spot");
  assert.equal(await page.evaluate(() => window.__asked), 0, "no location asked");
  const z0 = await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform);
  await page.click("#tm-in"); await page.waitForTimeout(400);
  assert.notEqual(await page.evaluate(() => document.querySelector(".tm-map .leaflet-proxy")?.style.transform), z0, "zoom buttons move the map");
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/tm-plain.png" });
  await page.click("#tm-flag"); await page.waitForSelector("#pf-go");
  assert.equal(await page.evaluate(() => window.__asked), 0, "the explanation comes first");
  await page.context().grantPermissions(["geolocation"], { origin: new URL(page.url()).origin });
  await page.click("#pf-go");
  await page.waitForSelector("#tm-forget");
  await page.waitForFunction(n => window.__asked > 0, 0);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs.spot.v1"))), { lat: 40.71, lon: -74.01 });
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs-v1").includes("40.71")), false, "not in the library");
  await page.waitForFunction(() => document.querySelectorAll(".tm-map img.leaflet-tile").length > 0);
  assert.ok(tiles.every(u => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)));
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/tm-spot.png" }); }
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "open");
  await page.click("#tm-forget"); await page.waitForSelector("#tm-flag");
  assert.equal(await page.evaluate(() => localStorage.getItem("tabs.spot.v1")), null);
  await page.click("#back"); await page.waitForFunction(() => !document.body.classList.contains("tm-open"));
});

test("A run that stops early is not a play", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, settings: { ...LIB.settings, countIn: false } });
  await page.click(".list .row"); await page.waitForSelector("#play");
  await page.click("#play"); await page.waitForTimeout(1500); await page.click("#play");
  await page.waitForFunction(() => document.getElementById("play")?.getAttribute("aria-label") === "Start auto-scroll");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.every(s => !s.playLog?.total)), true);
});

test("Tonight is home: Louie, one song up next, Play starts it, the Tour Map card, and the header reaches the Library and Settings", { skip: skip() }, async t => {
  const y = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  const songs = LIB.songs.map(s => ({ ...s, playLog: { total: 3, last: Date.now() - 86400e3, days: { [y]: 1 } } }));
  const page = await phone(t, { ...LIB, songs }, { home: true });
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + "/tonight.png" });
  await page.waitForSelector(".rd-next");
  assert.equal(await page.innerText("h1.title"), "Tonight");
  assert.ok(await page.locator(".rd-say svg.louie").count() === 1, "Louie says something");
  assert.match(await page.innerText(".rd-next h2"), /Up next/i);
  assert.match(await page.innerText(".rd-map"), /Tour Map/i);
  await page.click("#rd-go");
  await page.waitForFunction(() => /#\/song\//.test(location.hash) && document.body.classList.contains("playing"), null, { timeout: 8000 });
  await page.click("#play");
  await page.evaluate(() => document.querySelector(".head .ib[data-go]").click());
  await page.waitForSelector(".rd-next");
  assert.equal(await page.evaluate(() => location.hash), "#/", "a song opened from Tonight goes back to Tonight");
  /* the Library drawer: Tonight never scrolls, the drawer opens by tap or drag, closes by drag, scrim or handle */
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true, "Tonight does not scroll");
  assert.match(await page.innerText("#rd-dh"), /Library/);
  const state = () => page.getAttribute("#rd-drawer", "data-state");
  assert.equal(await state(), "closed");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("rd-dbody")).opacity), "0", "shut, none of the Library shows");
  const drag = (sel, from, to) => page.evaluate(([sel, from, to]) => {
    const el = document.querySelector(sel), t = y => new Touch({ identifier: 1, target: el, clientX: 200, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [t(from)] }));
    for (let i = 1; i <= 6; i++) el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, cancelable: true, touches: [t(from + (to - from) * i / 6)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [] }));
  }, [sel, from, to]);
  await drag("#rd-dh", 700, 300); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "open");
  await page.waitForFunction(() => document.querySelector("#rd-drawer").getBoundingClientRect().top < 80, null, { timeout: 3000 });
  assert.ok(await page.locator("#list .row").first().isVisible(), "the real Library list is inside");
  await drag("#rd-dh", 100, 500); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "closed");
  await page.click("#rd-dh"); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "open");
  await page.mouse.click(195, 20); await page.waitForFunction(() => document.querySelector("#rd-drawer").dataset.state === "closed");
  assert.equal(await page.evaluate(() => location.hash), "#/", "the drawer never leaves Tonight");
  await page.click("#settings"); await page.waitForFunction(() => location.hash === "#/settings");
});

test("Tonight on a new library: Louie waves and the first song is ready", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => ({ ...s, playLog: undefined })) }, { home: true });
  await page.waitForSelector(".rd-first");
  assert.match(await page.innerText(".rd-first"), /first song/i);
  assert.match(await page.innerText(".rd-next h2"), /Your first song/i);
});

test("Tour Map: the scene sheet says how many songs and minutes take a rival corner, pulls up for the details and the scene, and Play starts the song", { skip: skip() }, async t => {
  const page = await phone(t, LIB);
  await page.evaluate(() => { location.hash = "#/playmap"; });
  await page.waitForSelector("#tm-take-go");
  assert.match(await page.innerText("#tm-take"), /Take \S+'s corner\s*(One song|\d+ songs) · about \d+ min/);
  assert.equal(await page.getAttribute("#tm-sheet", "data-state"), "closed");
  assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("tm-sbody")).opacity), "0", "the details stay hidden until the sheet is pulled up");
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "open");
  assert.match(await page.innerText("#tm-sbody"), /Start with[\s\S]*minutes a day[\s\S]*You hold/i);
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/scene-open.png" }); }
  await page.click(".tm-sh-t"); await page.waitForFunction(() => document.getElementById("tm-sheet").dataset.state === "closed");
  if (process.env.SHOT) { await page.waitForTimeout(500); await page.screenshot({ path: process.env.SHOT + "/scene-closed.png" }); }
  await page.click("#tm-take-go");
  await page.waitForFunction(() => /#\/song\//.test(location.hash));
});
