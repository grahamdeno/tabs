// Regression walk-through: the main path through the app at a small phone, a
// standard phone and an iPad, in dark and light. Each step is a check, so a
// failure names the screen, the size and the theme.
import test from "node:test";
import assert from "node:assert/strict";
import { base, phone, skip, SONG, useBrowser } from "./harness.mjs";

useBrowser();

const TAB = "e|---0---0---|---2---2---|---3---3---|\nB|---1---1---|---3---3---|---0---0---|\nG|---0---0---|---2---2---|---0---0---|\nD|---2---2---|---0---0---|---0---0---|";
const LONG = SONG.replace("[Chorus]", "[Bridge]\nC G D Em\nBm  F  Bb  C#m7  Ebmaj7  Ab\n\n[Chorus]") + "\n\n" + SONG.replace("[Verse]", "[Verse 2]").replace("[Chorus]", "[Chorus 2]");
const TIPS = Object.fromEntries("library song edit add map pause pauseStage chord play line tap paste menu strobe searchInvite search nn tuner".split(" ").map(k => [k, true]));
const lib = theme => ({
  songs: [{ id: "a", title: "River Road", artist: "The Wanderers", key: "A", format: "chords", body: LONG, duration: 40 },
          { id: "t", title: "Tab Study", artist: "P", format: "tab", body: TAB }],
  sets: [{ id: "s", name: "Friday", songIds: ["a", "t"] }], trash: [],
  settings: { v: 6, theme, controls: "bar", tipsSeen: TIPS, sampleAdded: true, lastBackup: "2099-01-01T00:00:00Z", micExplained: true }
});

for (const [width, height, theme] of [[390, 844, "dark"], [320, 640, "light"], [1180, 820, "dark"]]) {
  test(`main path at ${width}px, ${theme}`, { skip: skip() }, async t => {
    const page = await phone(t, lib(theme), { viewport: { width, height }, colorScheme: theme, reducedMotion: "reduce" });
    const fits = async where => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${where}: nothing wider than the screen`);
    const is = async (cond, what) => assert.ok(await page.evaluate(cond), what);

    assert.equal(await page.locator("#list .row").count(), 2, "library rows");
    await fits("library");

    await page.goto(base + "#/song/a"); await page.waitForTimeout(400);
    await is(() => document.querySelectorAll(".sheet .pr").length > 5, "song renders");
    await fits("song");
    await is(() => document.getElementById("sheet").classList.contains("focus"), "focus line at open");
    /* On a short phone the chord can sit behind the song bar: bring it up first. */
    await page.evaluate(() => { const el = document.querySelector(".sheet .c[data-ch='F#m']"); if (el.getBoundingClientRect().bottom > innerHeight - 160) scrollBy(0, el.getBoundingClientRect().top - innerHeight / 3); });
    await page.waitForTimeout(500);
    await page.click(".sheet .c[data-ch='F#m'] .ct", { force: true }); await page.waitForTimeout(150);
    await is(() => !!document.querySelector(".dpop"), "tapping a chord shows its diagram");
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);

    await page.click("#play"); await page.waitForTimeout(300);
    await is(() => !!document.querySelector(".countin"), "count-in from the top");
    await page.waitForTimeout(3200);
    const y1 = await page.evaluate(() => scrollY); await page.waitForTimeout(1200);
    assert.ok(await page.evaluate(() => scrollY) > y1, "scrolls after the count-in");
    await is(() => +getComputedStyle(document.querySelector(".song-title")).opacity < 0.5, "header dims while playing");
    await is(() => !document.querySelector(".prow"), "no diagrams over the words while playing");
    await page.click("#nnbtn"); await page.waitForTimeout(200);
    await is(() => document.body.classList.contains("nn-on") && document.querySelectorAll("#nn svg").length > 0, "Now and Next shows");
    await page.click("#nnbtn"); await page.click("#play"); await page.waitForTimeout(500);
    await is(() => !!document.querySelector(".prow"), "diagrams when paused");
    await is(() => [...document.querySelectorAll(".prow .pcard")].every(c => c.getBoundingClientRect().top >= document.getElementById("sheet").getBoundingClientRect().top - 1), "2.26.0: the cards never cover Chords in this song");
    await page.click("#up"); await page.waitForTimeout(200);
    assert.match(await page.innerText("#meta"), /Key Bb/, "transpose up");
    await page.click("#down");

    await page.goto(base + "#/song/t"); await page.waitForTimeout(300);
    await fits("tab");

    await page.goto(base + "#/edit/a"); await page.waitForTimeout(400);
    await page.fill("#ed-title", "River Road 2"); await page.dispatchEvent("#ed-title", "change");
    await page.click("#ce-done"); await page.waitForTimeout(300);
    assert.equal(await page.innerText("h1.song-title"), "River Road 2", "edit saves");

    await page.goto(base + "#/set/s"); await page.waitForTimeout(300);
    await fits("set");
    await page.goto(base + "#/settings"); await page.waitForTimeout(300);
    await is(() => document.querySelectorAll("[data-page]").length === 8, "settings menu renders");
    await fits("settings");
    for (const pg of ["playing", "diagrams", "look", "newsongs", "today", "keys", "library", "help"]) {
      await page.goto(base + "#/settings/" + pg); await page.waitForTimeout(200);
      await is(() => document.querySelectorAll(".set, .fld").length >= 1, pg + " renders");
      await fits("settings " + pg);
    }
    await page.goto(base + "#/trash"); await page.waitForTimeout(200);
    assert.match(await page.innerText("h1"), /Recently deleted/);
    await page.goto(base + "#/gestures"); await page.waitForTimeout(200);
    await fits("tips and gestures");
  });
}
