// Regression walk-through: the main path through the app at a small phone, a
// standard phone and an iPad, in dark and light. Each step is a check, so a
// failure names the screen, the size and the theme.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, SONG, useBrowser, tool } from "./harness.mjs";

useBrowser();

const TAB = "e|---0---0---|---2---2---|---3---3---|\nB|---1---1---|---3---3---|---0---0---|\nG|---0---0---|---2---2---|---0---0---|\nD|---2---2---|---0---0---|---0---0---|";
const LONG = SONG.replace("[Chorus]", "[Bridge]\nC G D Em\nBm  F  Bb  C#m7  Ebmaj7  Ab\n\n[Chorus]") + "\n\n" + SONG.replace("[Verse]", "[Verse 2]").replace("[Chorus]", "[Chorus 2]");
const TIPS = Object.fromEntries("library song edit add map pause pauseStage chord play line tap paste menu strobe searchInvite search nn tuner".split(" ").map(k => [k, true]));
const lib = theme => ({
  songs: [{ id: "a", title: "River Road", artist: "The Wanderers", key: "A", format: "chords", body: LONG, duration: 40 },
          { id: "t", title: "Tab Study", artist: "P", format: "tab", body: TAB }],
  sets: [{ id: "s", name: "Friday", songIds: ["a", "t"] }], trash: [],
  settings: { v: 6, theme, controls: "bar", streakMoment: false, tipsSeen: TIPS, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", micExplained: true, plainPlay: true }
});

for (const [width, height, theme] of [[390, 844, "dark"], [320, 640, "light"], [1180, 820, "dark"]]) {
  test(`main path at ${width}px, ${theme}`, { skip: skip() }, async t => {
    const page = await phone(t, lib(theme), { viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
    const fits = async where => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${where}: nothing wider than the screen`);
    const is = async (cond, what) => assert.ok(await page.evaluate(cond), what);

    assert.equal(await page.locator("#list .row").count(), 2, "library rows");
    await fits("library");

    await page.goto(base + "#/song/a"); await page.waitForSelector(".sheet .pr");
    await is(() => document.querySelectorAll(".sheet .pr").length > 5, "song renders");
    await fits("song");
    await is(() => document.getElementById("sheet").classList.contains("focus"), "focus line at open");
    /* On a short phone the chord can sit behind the song bar: bring it up first. */
    await page.evaluate(() => { const el = document.querySelector(".sheet .c[data-ch='F#m']"); if (el.getBoundingClientRect().bottom > innerHeight - 160) scrollBy(0, el.getBoundingClientRect().top - innerHeight / 3); });
    await page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
    await page.click(".sheet .c[data-ch='F#m'] .ct", { force: true }); await page.waitForSelector(".dpop");
    await is(() => !!document.querySelector(".dpop"), "tapping a chord shows its diagram");
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForFunction(() => scrollY === 0);

    await page.click("#play"); await page.waitForSelector(".countin");
    await is(() => !!document.querySelector(".countin"), "count-in from the top");
    await page.waitForTimeout(3200) /* real timer: the count-in */;
    const y1 = await page.evaluate(() => scrollY); await page.waitForTimeout(1200) /* real timer: auto-scroll moving */;
    assert.ok(await page.evaluate(() => scrollY) > y1, "scrolls after the count-in");
    await is(() => +getComputedStyle(document.querySelector(".shead")).opacity < 0.5, "header dims while playing");
    await is(() => !document.querySelector(".prow"), "no diagrams over the words while playing");
    /* 3.19.0: on a phone the bar is folded away while playing, so Now and Next is turned on while paused */
    await page.click("#play"); await page.waitForFunction(() => !document.body.classList.contains("playing"));
    await tool(page, "nn"); await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" }); /* 4.32.0: switches toggle in place */ await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains("nn-on"));
    await is(() => document.body.classList.contains("nn-on") && document.querySelectorAll("#nn svg").length > 0, "Now and Next shows");
    await page.click("#play"); await page.waitForFunction(() => !document.body.classList.contains("playing"));
    await tool(page, "nn"); await page.waitForFunction(() => !document.body.classList.contains("nn-on") && !!document.querySelector(".prow")); await page.keyboard.press("Escape"); await page.waitForSelector(".menu", { state: "detached" });
    await is(() => !!document.querySelector(".prow"), "diagrams when paused");
    await is(() => [...document.querySelectorAll(".prow .pcard")].every(c => c.getBoundingClientRect().top >= Math.max(document.getElementById("sheet").getBoundingClientRect().top, (r => r && r.right > document.getElementById("sheet").getBoundingClientRect().left && r.left < document.getElementById("sheet").getBoundingClientRect().right ? r.bottom : -1e9)(document.querySelector("#strip .strip")?.getBoundingClientRect())) - 1), "2.26.2: the cards never cover Chords in this song");
    await page.click("#meta"); await page.click("#ab-key"); await page.waitForSelector(".dial.key");
    await page.mouse.click(60, 120); await page.waitForSelector(".dial.key", { state: "detached" });

    await page.goto(base + "#/song/t"); await page.waitForFunction(() => /#\/song\/t/.test(location.hash) && !!document.querySelector("h1.song-title"));
    await fits("tab");

    await page.goto(base + "#/edit/a"); await page.waitForSelector("#ed-title");
    await page.fill("#ed-title", "River Road 2"); await page.dispatchEvent("#ed-title", "change");
    await page.click("#ce-done"); await page.waitForSelector("h1.song-title");
    assert.equal(await page.innerText("h1.song-title"), "River Road 2", "edit saves");

    await page.goto(base + "#/set/s"); await page.waitForFunction(() => /#\/set\/s/.test(location.hash) && !document.querySelector("#ed-title"));
    await fits("set");
    await page.goto(base + "#/settings"); await page.waitForSelector("[data-page]");
    await is(() => document.querySelectorAll("[data-page]").length === 9, "settings menu renders"); /* 4.36.0: Language practice */
    await fits("settings");
    for (const pg of ["playing", "look", "newsongs", "today", "keys", "library", "help"]) {
      await page.goto(base + "#/settings/" + pg); await page.waitForSelector(".set, .fld");
      await is(() => document.querySelectorAll(".set, .fld").length >= 1, pg + " renders");
      await fits("settings " + pg);
    }
    await page.goto(base + "#/trash"); await page.waitForFunction(() => /deleted/i.test(document.querySelector("h1")?.innerText || ""));
    assert.match(await page.innerText("h1"), /Recently deleted/);
    await page.goto(base + "#/gestures"); await page.waitForFunction(() => /#\/gestures/.test(location.hash) && !/deleted/i.test(document.querySelector("h1")?.innerText || ""));
    await fits("tips and gestures");
  });
}
