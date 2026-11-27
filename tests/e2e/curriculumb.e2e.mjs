// 5.18.0 (curriculum Release B): every stop with no lesson is a piece of the tour's one song. The song is chosen from the Songbook;
// a song that is a few chords off is simplified and keeps its real chart; a capo song plays with Louie's band when there is no capo.
import test from "node:test";
import assert from "node:assert/strict";
import { skip, LIB, phone, useBrowser, settled } from "./harness.mjs";
useBrowser();

const T = ["k1.1", "k1.2", "c:Em", "k1.4", "k1.5", "k1.6", "c:A", "c:D", "c:E", "k2.4"];
const sheet = (...lines) => "[Verse]\n" + lines.join("\n") + "\n\n[Chorus]\n" + lines.join("\n");
const SONGS = [
  /* fits Tour 2 with one chord simplified: Dmaj7 to D is one chord in sixteen */
  { id: "easy", title: "Easy Pier", artist: "The Cape Fear", key: "A", format: "chords", status: "learning", duration: 14, bpm: 100, body: sheet("A     D     E     A", "la la la la la la la la", "A     Dmaj7 E     A", "la la la la la la la la") },
  /* far from Tour 2: chords that open at later tours */
  { id: "far", title: "Far Off", artist: "The Cape Fear", key: "C", format: "chords", status: "learning", duration: 14, bpm: 100, body: sheet("C     Am    F     G", "la la la la la la la la", "C     Am    F     G", "la la la la la la la la") },
  /* a capo song: the shapes A D E, written two frets up as B E F# */
  { id: "capo", title: "Capo Song", artist: "The Cape Fear", key: "B", format: "chords", status: "learning", duration: 14, bpm: 100, body: sheet("B     E     F#    B", "la la la la la la la la", "B     E     F#    B", "la la la la la la la la"), yt: { id: "abcdefghijk", title: "Capo Song", channel: "The Cape Fear - Topic", secs: 14 }, timed: { h: "x", at: [[1, 2], [2, 6], [5, 10], [6, 14]] } }
];
const lib = (extra = {}) => {
  const d = JSON.parse(JSON.stringify(LIB));
  d.songs = SONGS.map(s => ({ ...s }));
  d.skills = { done: Object.fromEntries(["G", "C", "D", "Em", "Am", "E", "A"].map(c => [`c:${c}`, { n: 1, best: 0, at: 5 }])), last: 6 };
  d.boxes = { opened: Array.from({ length: 13 }, (_, i) => `b:t${i + 1}`) };
  d.curriculum = { v: 1, done: Object.fromEntries(T.map(id => [id, 5])), box1: 1 };
  d.guitars = { seen: ["open", "switch"] }; /* Cornerstone has been announced */
  return { ...d, ...extra };
};
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem("tabs-v1") || "{}"));
const tap = (page, id) => page.evaluate(i => document.querySelector(`[data-stop="${i}"]`).click(), id);
const toastText = page => page.waitForFunction(() => /Not yet|simplified|needs chords|is this tour/.test(document.body.innerText), null, { timeout: 5000 }).then(() => page.evaluate(() => document.body.innerText));
const withSong = (id, t) => lib({ songTour: { v: 1, legs: { t2: { pick: { title: "x", artist: "y", chords: [] }, song: id, skipped: [], done: [], ...t } } } });

test("B1: the capo question on Tour 1 is asked once, the answer is kept and the question does not come back", { skip: skip() }, async t => {
  const l1 = JSON.parse(JSON.stringify(LIB)); l1.guitars = { seen: ["open"] };
  const page = await phone(t, l1, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k1.4"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Do you have a capo\?/);
  await page.click('.rd-pop [data-capo="0"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).settings?.capo === false, null, { timeout: 5000 });
  await page.reload(); await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k1.4"); await page.waitForSelector(".rd-pop");
  assert.doesNotMatch(await page.textContent(".rd-pop"), /Do you have a capo\?/, "asked once");
});

test("B2: a song a chord or two off is simplified, and its real chart stays one tap away", { skip: skip() }, async t => {
  const d = lib(); d.songs = d.songs.filter(s => s.id === "easy");
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Easy Pier fits, simplified/, "the Songbook match is offered, and says it is simplified");
  await page.click('.rd-pop [data-tsong]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songTour?.legs?.t2?.simplified === true, null, { timeout: 5000 });
  await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  const card = await page.textContent(".rd-pop");
  assert.match(card, /This is the simplified version/); assert.match(card, /See the real chart/);
  const real = (await stored(page)).songs.find(s => s.id === "easy").body;
  assert.match(real, /Dmaj7/, "the song in the Songbook keeps its real chart");
  await page.click('.rd-pop [data-chart="easy"]');
  await page.waitForFunction(() => location.hash === "#/song/easy");
  await page.waitForFunction(() => /Dmaj7/.test(document.body.innerText), null, { timeout: 5000 }); /* the real chart shows Dmaj7 */
});

test("B2: a song that fits a later tour says Not yet, names the tour, and waits there", { skip: skip() }, async t => {
  const d = lib(); d.songs = d.songs.filter(s => s.id === "far");
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  await page.click('.rd-pop [data-tchoose]'); await page.waitForSelector('[data-pick="far"]');
  await page.click('[data-pick="far"]');
  assert.match(await toastText(page), /Not yet: this opens at Tour \d+/);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).curriculum?.waiting?.far >= 3, null, { timeout: 5000 });
  const after = await stored(page);
  assert.equal(after.songTour?.legs?.t2?.song, undefined, "it is not this tour's song");
});

test("B2: a song that needs a capo says so; with no capo Louie's band plays it and the recording stays out", { skip: skip() }, async t => {
  const d = withSong("capo", { capo: 2 }); d.settings = { ...(d.settings || {}), capo: false };
  const STUB = `window.__yt = { made: false }; window.YT = { Player: class { constructor() { window.__yt.made = true; } destroy() {} } }; window.onYouTubeIframeAPIReady && window.onYouTubeIframeAPIReady();`;
  const page = await phone(t, d, { home: true, prepare: p => p.route("https://www.youtube.com/iframe_api", r => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB })) });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  const card = await page.textContent(".rd-pop");
  assert.match(card, /needs a capo at fret 2/); assert.match(card, /Louie's band plays it/); assert.match(card, /See the real chart/);
  await page.click(".rd-pop .rd-start"); await page.waitForSelector("#round .rnd-hw");
  await page.waitForTimeout(1500); /* real timer: the round runs a moment */
  assert.equal(await page.evaluate(() => !!window.__yt?.made), false, "the recording is in the real key, so it is not used");
});

test("B2: with a capo the card says where it goes", { skip: skip() }, async t => {
  const d = withSong("capo", { capo: 2 }); d.settings = { ...(d.settings || {}), capo: true };
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  const card = await page.textContent(".rd-pop");
  assert.match(card, /Capo at fret 2/); assert.doesNotMatch(card, /band plays/);
});

test("fix 5: with Unlock all tours on, choosing a song and Not yet last for the visit and are not saved", { skip: skip() }, async t => {
  const d = lib(); d.songs = d.songs.filter(s => s.id === "easy" || s.id === "far"); d.settings = { ...(d.settings || {}), unlockAll: true };
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  await page.click(".rd-pop [data-tsong]");
  await page.waitForFunction(() => /simplified/.test(document.body.innerText) || document.querySelector(".rd-pop [data-chart]") || true);
  await page.waitForTimeout(1200); /* real timer: the save settles a moment after the tap */
  let saved = await stored(page);
  assert.equal(saved.songTour?.legs?.t2?.song, undefined, "the choice is not saved");
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Play a piece of Easy Pier/, "it stays for the visit");
  await page.click(".rd-pop [data-tswap]"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  await page.click(".rd-pop [data-tchoose]"); await page.waitForSelector('[data-pick="far"]');
  await page.click('[data-pick="far"]');
  await page.waitForTimeout(1200); /* real timer */
  saved = await stored(page);
  assert.equal(saved.curriculum?.waiting, undefined, "Not yet is not saved");
  assert.equal(saved.songTour?.legs?.t2?.song, undefined);
  await page.reload(); await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.5"); await page.waitForSelector(".rd-pop");
  assert.doesNotMatch(await page.textContent(".rd-pop"), /Play a piece of/, "gone after a reload");
});

test("fix 9 and 8: the locked Lead row says Opens after Tour 4, and a headline card names the song's speed", { skip: skip() }, async t => {
  const d = withSong("easy", {}); d.curriculum.done["k2.5"] = 6; d.songs = d.songs.filter(s => s.id === "easy");
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "route:lead"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Opens after Tour 4\./);
  await page.reload(); await page.waitForSelector(".rn-neck"); await settled(page);
  await tap(page, "k2.6"); await page.waitForSelector(".rd-pop");
  assert.match(await page.textContent(".rd-pop"), /Pass at 0\.8x\. 1\.0x makes it Solid\./, "with Louie's band");
});

test("fix 11: the guitar stand names the tours that earned each guitar, Tour 4's included, with no old leg names", { skip: skip() }, async t => {
  const d = lib(); d.curriculum.won = { t1: 5, t2: 6, t3: 7, t4: 8 }; d.guitars = { seen: ["open", "switch", "scales", "strum", "pick"] };
  const page = await phone(t, d, { home: true });
  await page.waitForSelector(".rn-neck"); await settled(page);
  const items = await page.evaluate(async () => { const m = await import("/gstand.js"); return m.collectionOf(JSON.parse(localStorage.getItem("tabs-v1"))).map(i => [i.id, i.label, i.status]); });
  const by = Object.fromEntries(items.map(i => [i[0], i]));
  assert.equal(by.switch[2], "Earned on Tour 1"); assert.equal(by.scales[2], "Earned on Tour 2"); assert.equal(by.strum[2], "Earned on Tour 3"); assert.equal(by.pick[2], "Earned on Tour 4");
  assert.equal(by.switch[1], "Cornerstone, earned on Tour 1, Opening Night");
  assert.match(by.pick[1], /earned on Tour 4, /);
  for (const i of items) if (/earned on/.test(i[1])) assert.match(i[1], new RegExp("earned on Tour (\\d+), "), i[1]);
});
