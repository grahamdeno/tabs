// Browser tests, part 2 of app.e2e (split so files run side by side).
// Run: node --test tests/e2e/   (needs Playwright: npm i --no-save playwright && npx playwright install chromium)
// They catch what unit tests can't: the app failing to load, screens not
// rendering, taps doing the wrong thing.

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, base, phone, skip, LIB, FAKE_MIC, useBrowser, until, settled, openSpeed, speedText } from "./harness.mjs";

useBrowser();


test("menus and panels work from a keyboard: focus moves in, Escape closes", { skip: skip() }, async t => {
  const page = await phone(t);
  const inside = sel => page.evaluate(sel => !!document.activeElement.closest(sel), sel);
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.focus("#more"); await page.keyboard.press("Enter"); await page.waitForSelector('.menu');
  assert.equal(await inside(".menu"), true, "focus is in the menu");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.m), "speed", "4.2.0: Tools starts on its first tile");
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.evaluate(() => document.activeElement.dataset.m), "metro");
  await page.keyboard.press("Escape"); await page.waitForSelector('.menu', { state: 'detached' });
  assert.equal(await page.locator(".menu").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), "more");
  await page.keyboard.press("Enter"); await page.waitForSelector('.menu');
  await page.focus('.menu [data-m="set"]');
  await page.keyboard.press("Enter"); await page.waitForSelector('#layer [role=dialog]'); /* Add to set */
  assert.equal(await page.getAttribute("#layer [role=dialog]", "aria-modal"), "true");
  assert.equal(await inside("#layer"), true, "focus is in the panel");
  await page.keyboard.press("Escape"); await page.waitForFunction(() => document.getElementById('layer').children.length === 0);
  assert.equal(await page.evaluate(() => document.getElementById("layer").children.length), 0);
});

test("iPad: chords in a rail, songs in a list beside the song; rotating puts them back", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { viewport: { width: 1180, height: 820 } });
  await page.goto(base + "#/song/a"); await page.waitForSelector('.side-r');
  assert.equal(await page.evaluate(() => document.getElementById("strip").parentElement.id), "rail");
  assert.equal(await page.locator(".side-r").count(), 2);
  assert.equal(await page.getAttribute(".side-r.on", "data-id"), "a");
  await page.click(".side-r:not(.on)"); await page.waitForFunction(() => /Harbor Lights/.test(document.querySelector('h1.song-title')?.innerText || ''));
  assert.match(await page.innerText("h1.song-title"), /Harbor Lights/);
  await page.setViewportSize({ width: 820, height: 1180 }); await page.waitForFunction(() => document.getElementById('strip').parentElement.id === 'app');
  assert.equal(await page.evaluate(() => document.getElementById("strip").parentElement.id), "app");
  assert.equal(await page.locator(".side").isVisible(), false);
});

test("song, artist and set names are shown as text, never run as markup", { skip: skip() }, async t => {
  const bad = n => `<img src=x onerror="window.__x=(window.__x||0)+${n}">`;
  const lib = { ...LIB,
    songs: [{ id: "a", title: bad(1), artist: bad(2), key: "A", format: "chords", body: `[${bad(3)}]\nA   D\n${bad(4)} words` }, LIB.songs[1]],
    sets: [{ id: "s", name: bad(5), songIds: ["a", "b"], created: "2026-10-01T00:00:00Z" }],
    trash: [{ type: "song", item: { id: "z", title: bad(6), artist: bad(7), body: "G" }, deletedAt: new Date().toISOString() }] };
  const page = await phone(t, lib, { viewport: { width: 1180, height: 820 } });
  for (const h of ["#/", "#/song/a", "#/set/s", "#/trash", "#/settings"]) { await page.goto(base + h); await page.waitForFunction(h => location.hash === h || (h === '#/' && /^#?\/?$/.test(location.hash)), h); }
  await page.goto(base + "#/library"); await page.waitForSelector('#q');
  await page.click("#q"); await page.keyboard.type("img"); await page.waitForFunction(() => document.body.classList.contains('searching'));
  assert.equal(await page.evaluate(() => window.__x), undefined);
  assert.equal(await page.locator("img[src=x]").count(), 0);
});

test("All songs sorts by artist", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: [...LIB.songs, { id: "c", title: "Anchor", artist: "Zed", body: "G\nla" }] });
  assert.deepEqual(await page.$$eval("#sort option", o => o.map(x => x.textContent)), ["A–Z", "Artist", "Recently played", "Most played"]);
  await page.selectOption("#sort", "artist"); await page.waitForFunction(() => document.querySelector('#list .row .t')?.textContent === 'Harbor Lights');
  assert.deepEqual(await page.$$eval("#list .row .t", r => r.map(x => x.textContent)), ["Harbor Lights", "River Road", "Anchor"]);
});

test("sketch: sing two lines, add their words, get chords in the melody's key", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (/Content Security Policy/i.test(m.text())) errors.push(m.text()); });
  await page.goto(base + "#/library"); await page.waitForSelector('#add'); /* 4.9.0: Add is in the Songbook */
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.reload(); await page.waitForSelector('#add');
  // From Add: an empty new song offers Sing it.
  await page.click("#add"); await page.waitForSelector('#ed-sing');
  await page.click("#ed-sing"); await page.waitForSelector('#sk-pad');
  assert.match(await page.innerText("h1"), /New sketch/);
  const hz = m => 440 * 2 ** ((m - 69) / 12);
  const pad = await page.locator("#sk-pad").boundingBox(), px = pad.x + pad.width / 2, py = pad.y + pad.height - 60;
  // Hold the pad to sing a line; let go to keep it.
  const singLine = async melody => {
    await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400); /* real timer */
    for (const m of melody) { await page.evaluate(f => { window.__hz = f; }, hz(m)); await page.waitForTimeout(420); /* real timer */ }
    await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(150); /* real timer */
    await page.mouse.up(); await page.waitForFunction(() => document.activeElement.id === 'sk-words');
  };
  await singLine([55, 59, 62, 59, 60, 64, 67, 64]);          // G B D B | C E G E
  assert.equal(await page.evaluate(() => document.activeElement.id), "sk-words", "the words field is ready for dictation");
  await page.keyboard.type("Porch light burning past the second shift");
  await page.evaluate(() => document.activeElement.blur()); await page.waitForFunction(() => document.activeElement === document.body);
  // Slide left while singing: that take goes, nothing is added.
  await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400); /* real timer */
  await page.evaluate(f => { window.__hz = f; }, hz(50)); await page.waitForTimeout(500); /* real timer */
  await page.mouse.move(px - 120, py, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(400); /* real timer */
  await page.evaluate(() => { window.__hz = 0; });
  assert.equal(await page.locator(".sknb-row").count(), 1, "the slid-away take wasn't kept");
  await singLine([62, 66, 57, 62, 59, 55, 55, 55]);          // D F# A D | B G G G
  await page.keyboard.type("Home to you a little more");
  await page.evaluate(() => document.activeElement.blur()); await page.waitForFunction(() => document.activeElement === document.body);
  assert.match(await page.innerText("#sk-meter"), /G major/);
  assert.equal(await page.locator(".sknb-row").count(), 2);
  assert.deepEqual(await page.$$eval(".skfam-c", b => b.map(x => x.textContent)), ["G", "C", "D", "Em", "Am", "Bm"], "the key's chords, ready to hear");
  await page.click("#sk-done"); await page.waitForFunction(() => JSON.parse(localStorage.getItem('tabs-v1')).songs.some(s => s.sketch));
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.sketch);
  assert.ok(song, "a new song was made");
  assert.equal(song.key, "G");
  assert.match(song.body, /^G\s+C\nPorch light burning past the second shift\nD\s+G\nHome to you a little more$/);
  assert.ok(await page.locator("#ce-done").isVisible(), "it opens in the editor to name it");
  assert.deepEqual(song.sketch.lines.map(l => l.n.length), [8, 6], "the melody stays with the song (the three Gs at the end are one held note)");

  // Name it and save; the song page offers the recording and Simple or Rich.
  await page.fill("#ed-title", "Porch Light"); await page.dispatchEvent("#ed-title", "change");
  await page.click("#ce-done"); await page.waitForSelector('h1.song-title');
  await page.waitForSelector("#sk-hear:not([hidden])", { timeout: 4000 }); await settled(page); /* the song page has just faded in: taps wait for it */
  /* keep hold of the Undo button the moment it appears: on a busy machine a later toast can replace it before the save lands */
  await page.click("[data-st='rich']"); await page.waitForFunction(() => (window.__undo = document.querySelector("#toast .tact")) && /Rich|7ths/.test(document.getElementById("toast").textContent));
  await page.waitForFunction(() => /\nD7\s+G\nHome to you/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.sketch).body));
  const body = async () => JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.sketch).body;
  assert.match(await body(), /\nD7\s+G\nHome to you/, "Rich: the V chord becomes D7");
  await page.evaluate(() => window.__undo.click()); await page.waitForFunction(() => !/D7/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.sketch).body));
  assert.match(await body(), /\nD\s+G\nHome to you/, "Undo");
  // Hear it back: the first line is lit while it plays, then Stop.
  await page.click("#sk-hear"); await page.waitForSelector('#sheet > .pr.skcur');
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("#sheet > .pr")].findIndex(e => e.classList.contains("skcur"))), 0);
  assert.match(await page.innerText("#sk-hear"), /Stop/);
  await page.click("#sk-hear"); await page.waitForFunction(() => !document.querySelector('#sheet.skplay'));
  assert.equal(await page.locator("#sheet.skplay").count(), 0);

  // In Edit, a word's chord picker shows chords that fit the melody and other ways for the line.
  await page.click("#more"); await page.click(".menu [data-m='edit']"); await page.waitForSelector(".ce-line[data-line='3']");
  await page.click(".ce-line[data-line='3'] .ce-w >> nth=0"); await page.waitForSelector('.ce-fitb');
  assert.equal(await page.locator(".ce-fitb").count(), 4);
  assert.match(await page.innerText(".ce-alt.on"), /D · G\s*now/);
  const other = page.locator(".ce-alt:not(.on)").first(), label = (await other.innerText()).trim();
  await other.click(); await page.waitForFunction(() => /\nD\s+G\nHome to you/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.sketch).body) === false);
  const chords = label.split(" · ");
  assert.match(await body(), new RegExp(`\\n${chords[0]}\\s+${chords[1] ? chords[1] + "\\n" : "\\n"}Home to you a little more$`));
  assert.deepEqual(errors, []);
});

test("a set's Album art cover finds art for its songs on Apple Music", { skip: skip() }, async t => {
  const lib = { ...LIB,
    songs: [{ ...LIB.songs[0], listen: { url: "https://music.apple.com/us/album/x/1?i=111", service: "Apple Music" } }, { ...LIB.songs[1], artist: "The Night Ferries" }],
    sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }] };
  const page = await phone(t, lib);
  const art = n => `https://is1-ssl.mzstatic.com/image/thumb/${n}/100x100bb.jpg`;
  await page.route("https://itunes.apple.com/lookup**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackId: 111, artworkUrl100: art("river"), trackTimeMillis: 200000 }] }) }));
  await page.route("https://itunes.apple.com/search**", r => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({ results: [{ trackName: "Harbor Lights", artistName: "The Night Ferries", trackViewUrl: "https://music.apple.com/x", artworkUrl100: art("harbor") }] }) }));
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex") }));
  await page.goto(base + "#/set/s"); await page.waitForSelector('#s-cover');
  await page.click("#s-cover"); await page.waitForSelector('[data-cv="art"]');
  await page.click('[data-cv="art"]'); await page.waitForFunction(() => /Album art for every song/.test(document.getElementById('toast')?.textContent || '') && JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'b').art && !!document.querySelector('.cover img[src*="river"]'));
  const songs = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs;
  assert.match(songs.find(s => s.id === "a").listen.art, /river\/600x600bb/);
  assert.match(songs.find(s => s.id === "b").art, /harbor\/600x600bb/);
  assert.match(await page.innerText("#toast"), /Album art for every song/);
  assert.ok(await page.locator('.cover img[src*="river"]').count() >= 1, "the cover shows the art");
});

test("Back from a song opened in a set returns to that set; from the library, to the library", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Friday", songIds: ["a", "b"] }] });
  const hash = () => page.evaluate(() => location.hash);
  await page.goto(base + "#/set/s"); await page.waitForSelector("[data-open='0']");
  await page.click("[data-open='0']"); await page.waitForSelector('.shead .sh-back');
  assert.equal(await page.getAttribute(".shead .sh-back", "aria-label"), "Back to Friday");
  await page.click("#snext"); await page.waitForFunction(() => /Harbor Lights/.test(document.querySelector('h1.song-title')?.innerText || ''));               // on to the next song in the set
  await page.click(".shead .sh-back"); await page.waitForFunction(() => location.hash === '#/set/s');
  assert.equal(await hash(), "#/set/s");
  await page.goto(base + "#/library"); await page.waitForSelector('#list .row[data-id="a"]');
  await page.click('#list .row[data-id="a"]'); await page.waitForSelector('.shead .sh-back');
  assert.equal(await page.getAttribute(".shead .sh-back", "aria-label"), "Back to the Songbook");
  await page.click(".shead .sh-back"); await page.waitForFunction(() => location.hash === '#/library');
  assert.equal(await hash(), "#/library");
});

test("sketch: a quiet voice is still heard; silence says so and is logged; the pad stays under the finger", { skip: skip() }, async t => {
  const browser2 = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  t.after(() => browser2.close());
  const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  await ctx.addInitScript(FAKE_MIC);
  const page = await ctx.newPage();
  await page.goto(base); await page.waitForFunction(() => !!localStorage.getItem('tabs-v1'));
  await page.evaluate(d => localStorage.setItem("tabs-v1", JSON.stringify(d)), LIB);
  await page.goto(base + "#/sketch"); await page.waitForSelector('#sk-pad'); await settled(page);
  const pad = await page.locator("#sk-pad").boundingBox(), px = pad.x + pad.width / 2, py = pad.y + pad.height - 60;
  const hold = async (hzs, gain) => {
    await page.evaluate(g => { window.__gain = g; window.__padAtStart = document.getElementById("sk-pad"); }, gain);
    await page.mouse.move(px, py); await page.mouse.down(); await page.waitForTimeout(400); /* real timer */
    const same = await page.evaluate(() => document.getElementById("sk-pad") === window.__padAtStart && document.getElementById("sk-pad").classList.contains("on"));
    for (const hz of hzs) { await page.evaluate(f => { window.__hz = f; }, hz); await page.waitForTimeout(400); /* real timer */ }
    await page.evaluate(() => { window.__hz = 0; }); await page.waitForTimeout(150); /* real timer */
    await page.mouse.up(); await page.waitForTimeout(500); /* real timer */
    return same;
  };
  // About a quarter of the old threshold: a voice at arm's length.
  assert.equal(await hold([196, 247, 294, 247, 262], 0.012), true, "the same pad, now recording, is under the finger");
  assert.equal(await page.locator(".sknb-row").count(), 1, "a quiet line is kept");
  await page.evaluate(() => document.activeElement?.blur());
  // Silence: a clear message, and the details go to the problems log.
  await hold([196, 247, 294], 0);
  assert.match(await page.innerText("#toast"), /only silence/);
  assert.match(await page.evaluate(() => localStorage.getItem("tabs.errors.v1")), /Sketch heard no notes: .* peak level 0\.0000/);
});

test("while playing, the focus line skips section names to the section's first line", { skip: skip() }, async t => {
  const long = { ...LIB.songs[0], body: LIB.songs[0].body + "\n\n" + LIB.songs[0].body.replace("[Chorus]", "[Chorus 2]").replace("[Verse]", "[Verse 2]") };
  const page = await phone(t, { ...LIB, songs: [long, LIB.songs[1]], settings: { ...LIB.settings, focus: "always" } });
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.click("#play"); await page.waitForSelector('#sheet > .cur');
  // Put the Chorus name exactly at the reading line.
  await page.evaluate(() => {
    const sec = [...document.querySelectorAll("#sheet > .sec")].find(e => /chorus/i.test(e.textContent));
    window.scrollTo(0, sec.getBoundingClientRect().top + scrollY - innerHeight * 0.4 + 2);
  });
  await page.waitForFunction(() => /chorus/i.test(document.querySelector('#sheet > .cur')?.previousElementSibling?.textContent || ''));
  const cur = await page.evaluate(() => { const c = document.querySelector("#sheet > .cur"); const sec = [...document.querySelectorAll("#sheet > .sec")].find(e => /chorus/i.test(e.textContent)); return { cls: c?.className, text: c?.textContent.slice(0, 30), prev: c?.previousElementSibling?.className, secTop: sec.getBoundingClientRect().top - innerHeight * 0.4, afterChorus: /chorus/i.test(c?.previousElementSibling?.textContent || "") }; });
  assert.ok(!/\bsec\b/.test(cur.cls || ""), `the focus is not on the section name (${cur.cls})`);
  assert.equal(cur.afterChorus, true, "it's the Chorus's first line");
  const two = await page.evaluate(() => { const c = [...document.querySelectorAll("#sheet > .cur")]; return { n: c.length, second: c[1]?.classList.contains("cur2"), next: c[0]?.nextElementSibling === c[1] || c[0]?.nextElementSibling?.matches(".sec, .gap") }; });
  assert.deepEqual(two, { n: 2, second: true, next: true }, "focus covers the current line and the next one");
});

test("Listen searches Apple Music in the app: change the words, hear a preview, tap to save", { skip: skip() }, async t => {
  const page = await phone(t);
  const terms = [];
  const track = (name, artist, id) => ({ trackName: name, artistName: artist, collectionName: "Album", trackViewUrl: `https://music.apple.com/us/album/a/1?i=${id}`, artworkUrl100: `https://is1-ssl.mzstatic.com/${id}/100x100bb.jpg`, previewUrl: `https://audio-ssl.itunes.apple.com/${id}.m4a` });
  await page.route("https://itunes.apple.com/search**", r => {
    const q = new URL(r.request().url()).searchParams.get("term"); terms.push(q);
    const results = /live/i.test(q) ? [track("Harbor Lights (Live)", "Me", 222)] : [track("Harbor Lights", "Someone Else", 111), track("Harbor", "Me", 112)];
    r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ results }) });
  });
  await page.route("https://audio-ssl.itunes.apple.com/**", r => r.fulfill({ status: 200, contentType: "audio/mp4", body: "" }));
  await page.route("https://is1-ssl.mzstatic.com/**", r => r.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") }));
  let left = false; page.on("popup", () => { left = true; });
  await page.goto(base + "#/song/b"); await page.waitForSelector('#listen');
  await page.click("#listen"); await page.waitForSelector('.ls-row');
  assert.equal(await page.inputValue("#ls-q"), "Harbor Lights Me");
  assert.match(await page.innerText("#ls-panel .cover-head"), /Harbor Lights/, "the cover header tops the sheet");
  assert.equal(await page.locator(".ls-row").count(), 2);
  assert.equal(await page.locator(".ls-pv").count(), 2, "each result can be previewed");
  await page.fill("#ls-q", "Harbor Lights live"); await page.press("#ls-q", "Enter"); await page.waitForFunction(() => /Live/.test(document.querySelector('.ls-row')?.innerText || ''));
  assert.equal(terms.at(-1), "Harbor Lights live");
  assert.match(await page.innerText(".ls-row"), /Harbor Lights \(Live\)/);
  await page.click(".ls-row"); await page.waitForFunction(() => !document.getElementById('ls-panel') && /222\/600x600bb/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'b').listen?.art || ''));
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b");
  assert.match(song.listen.url, /i=222/);
  assert.match(song.listen.art, /222\/600x600bb/);
  assert.equal(await page.locator("#ls-panel").count(), 0, "the sheet closes");
  assert.match(await page.innerText("#toast"), /Saved: Harbor Lights \(Live\)/);
  assert.equal(left, false, "Tabs didn't send you to Apple Music");
});

test("Listen still finds songs when Safari blocks Apple's reply, and offers a way on when Apple can't be reached", { skip: skip() }, async t => {
  const page = await phone(t);
  let down = false;
  const hit = { trackName: "Harbor Lights", artistName: "Me", trackViewUrl: "https://music.apple.com/us/album/a/1?i=5", artworkUrl100: "" };
  await page.route("https://itunes.apple.com/search**", r => {
    const cb = new URL(r.request().url()).searchParams.get("callback");
    if (down) return r.abort();
    /* The plain request is blocked (as Safari does when Apple's reply lacks the CORS header); the script way works. */
    if (!cb) return r.abort("accessdenied");
    r.fulfill({ status: 200, contentType: "text/javascript", body: `${cb}(${JSON.stringify({ results: [hit] })});` });
  });
  await page.goto(base + "#/song/b"); await page.waitForSelector('#listen');
  await page.click("#listen"); await page.waitForSelector('.ls-row');
  assert.equal(await page.locator(".ls-row").count(), 1, "found by the fallback");
  down = true;
  await page.fill("#ls-q", "Harbor"); await page.press("#ls-q", "Enter"); await page.waitForFunction(() => /Couldn't reach/.test(document.getElementById('ls-res')?.innerText || ''));
  assert.match(await page.innerText("#ls-res"), /Couldn't reach/);
  const log = await page.evaluate(() => localStorage.getItem("tabs.errors.v1"));
  assert.match(log, /Apple catalog search/, "the reason is kept for diagnostics");
  let opened = "";
  await page.context().route("https://music.apple.com/**", r => { opened = r.request().url(); r.fulfill({ status: 200, body: "" }); });
  await page.click("#ls-apple"); await until(() => opened !== '');
  assert.match(opened, /music\.apple\.com\/search\?term=Harbor/, "opens Apple Music's own search");
  down = false;
  await page.click("#ls-retry"); await page.waitForFunction(() => document.querySelectorAll('.ls-row').length === 1);
  assert.equal(await page.locator(".ls-row").count(), 1, "Try again works");
  /* A page opened before the update has older rules: offer a restart instead. */
  page.removeAllListeners("console");
  await page.evaluate(() => { const m = document.querySelector("meta[http-equiv='Content-Security-Policy']"); m.content = m.content.replace(/script-src[^;]*/, "script-src 'self'"); });
  down = true;
  await page.fill("#ls-q", "Harbor two"); await page.press("#ls-q", "Enter"); await page.waitForSelector('#ls-restart');
  assert.equal(await page.locator("#ls-restart").count(), 1, "offers a restart");
});

test("iPhone: Listen opens Apple Music's search, and Paste on return saves the link", { skip: skip() }, async t => {
  const page = await phone(t, LIB, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1", permissions: ["clipboard-read", "clipboard-write"] });
  let searched = false, opened = "";
  await page.route("https://itunes.apple.com/search**", r => { searched = true; r.abort(); });
  await page.context().route("https://music.apple.com/**", r => { opened = r.request().url(); r.fulfill({ status: 200, body: "" }); });
  await page.goto(base + "#/song/b"); await page.waitForSelector('#listen');
  await page.click("#listen"); await page.waitForSelector('#ls-open');
  assert.equal(await page.locator("#ls-q").count(), 0, "no in-app search on an iPhone");
  await page.click("#ls-open"); await until(() => opened !== '');
  assert.match(opened, /music\.apple\.com\/search\?term=Harbor%20Lights%20Me/);
  assert.equal(searched, false, "Apple's catalog search isn't tried");
  await page.evaluate(() => navigator.clipboard.writeText("https://music.apple.com/us/album/harbor/1?i=777"));
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForSelector('#bp-go');
  await page.click("#bp-go"); await page.waitForFunction(() => /i=777/.test(JSON.parse(localStorage.getItem('tabs-v1')).songs.find(s => s.id === 'b').listen?.url || ''));
  const song = JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "b");
  assert.match(song.listen.url, /i=777/);
  assert.equal(await page.locator(".bp-listen").count(), 0, "the offer goes away");
});

test("2.0 one hand: on a phone held upright the controls sit at the bottom; iPad keeps its layout", { skip: skip() }, async t => {
  const page = await phone(t);
  const box = async sel => page.evaluate(sel => { const r = document.querySelector(sel)?.getBoundingClientRect(); return r && r.width ? { top: r.top, bottom: r.bottom, right: r.right, left: r.left } : null; }, sel);
  const H = 844;
  assert.ok((await box("#chips")).top < H * 0.3, "filters at the top (2.6: moved back)");
  assert.ok((await box("#tunerbtn")).top < 100, "tuner in the header (2.6: moved back)");
  assert.ok(await page.evaluate(() => { const b = document.querySelector("#tunerbtn"), r = b.getBoundingClientRect(), i = b.querySelector("svg").getBoundingClientRect(); return Math.abs((i.top + i.bottom) / 2 - (r.top + r.bottom) / 2) < 2 && Math.abs((i.left + i.right) / 2 - (r.left + r.right) / 2) < 2; }), "the tuner icon is centered");
  const dot = await page.evaluate(() => { const d = document.querySelector("#tunerbtn .dotmark"); return d && getComputedStyle(d).position; });
  if (dot) assert.equal(dot, "absolute", "the not-tuned dot sits in the corner");
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  /* 4.2.0: one song screen. Back, the title and the heart at the top; Tools and a big Play at the bottom. */
  assert.ok((await box(".shead .sh-back")).top < 100 && (await box(".shead .fav")).top < 100, "back and the heart beside the title");
  for (const sel of ["#more", "#play"]) assert.ok((await box(sel)).top > H * 0.85, `${sel} in the bar`);
  assert.equal(await page.locator(".player .fav, .player #nnbtn, .player .oh-back").count(), 0, "just Tools and Play");
  assert.ok((await box("#play")).right > 330, "Play at the right, in thumb reach");
  assert.equal(await page.locator(".secbar .sbar").count(), 2, "the song map: one button per section");
  await page.click("#more"); await page.waitForSelector('.menu');
  const m = await box(".menu");
  assert.ok(m.bottom > H - 40 && m.top > H * 0.2, "Tools rises from the bottom");
  assert.match(await page.innerText(".menu .tl-head"), /Tools\s*Text size/, "Text size beside the title");
  assert.match(await page.innerText(".menu"), /Lines in a gig/);

  const pad = await phone(t, LIB, { viewport: { width: 1180, height: 820 } });
  await pad.goto(base + "#/song/a"); await pad.waitForSelector(".shead [data-go]");
  assert.ok(await pad.evaluate(() => document.querySelector(".shead [data-go]").getBoundingClientRect().top < 100), "iPad: back at the top");
  await pad.goto(base + "#/library"); await pad.waitForSelector("#tunerbtn");
  assert.ok(await pad.evaluate(() => document.querySelector("#tunerbtn").getBoundingClientRect().top < 100), "iPad: tuner at the top");
});

test("2.1, 2.6.5 speed dial (4.2.0: Tools, then Speed): a wobble changes nothing; a sweep sets the length, saves, and Undo puts it back", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForSelector(".metarow"); await settled(page);
  const before = await speedText(page);
  const x = 250, y = 700;
  // A small wobble changes nothing, and nothing on the dial gets selected.
  await openSpeed(page);
  await page.mouse.move(x, y); await page.mouse.down();
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".dial-big")).webkitUserSelect || getComputedStyle(document.querySelector(".dial-big")).userSelect), "none");
  await page.mouse.move(x + 6, y - 8, { steps: 3 }); await page.mouse.up(); await page.waitForTimeout(300); /* real timer: let a wobble settle */
  if (await page.locator(".dial").count()) { await page.mouse.click(60, 120); await page.waitForSelector(".dial", { state: "detached" }); }
  assert.equal(await speedText(page), before, "a small wobble changes nothing");
  // A real sweep: it closes on release and the page keeps what the dial showed.
  await openSpeed(page);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y - 140, { steps: 8 });
  const shown = await page.textContent(".dial-big");
  await page.mouse.up(); await page.waitForSelector(".dial", { state: "detached" });
  const after = await speedText(page);
  assert.notEqual(after, before, "the length changed");
  assert.equal(after, shown.trim(), "the page keeps what the dial showed");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "a").durationSet, null, { timeout: 5000 });
  assert.match(await page.innerText("#toast"), /Length .*Undo/s);
  await page.click("#more"); await page.waitForSelector(".menu");
  assert.match(await page.innerText('.menu [data-m="speed"]'), new RegExp(after), "the Speed tile shows it");
  await page.click('.menu [data-m="speed"]'); await page.waitForSelector(".dial");
  await page.mouse.click(60, 120); await page.waitForSelector(".dial", { state: "detached" });
  assert.equal(await page.locator(".dial").count(), 0, "a tap off it closes it");
  // Undo puts it back.
  await page.waitForSelector("#toast .tact", { state: "attached" }); await page.evaluate(() => document.querySelector("#toast .tact").click());
  await until(async () => (await speedText(page)) === before);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("tabs-v1")).songs.find(s => s.id === "a").duration === 200);
});

test("2.1 set dial: in a set, sweep to a song and let go to open it", { skip: skip() }, async t => {
  const songs = [...LIB.songs, ...["One", "Two", "Three"].map((title, i) => ({ id: "x" + i, title, artist: "Y", format: "chords", body: "[Verse]\nG C\nla" }))];
  const page = await phone(t, { ...LIB, songs, sets: [{ id: "s", name: "Gig", songIds: ["a", "x0", "x1", "x2"] }] });
  await page.goto(base + "#/set/s"); await page.waitForSelector("[data-open='0']");
  await page.click("[data-open='0']"); await page.waitForSelector('#setdial'); await settled(page);
  assert.match(await page.innerText("#setdial"), /1 of 4/);
  const b = await page.locator("#setdial").boundingBox();
  const x = b.x + 20, y = b.y + 16;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y - 160, { steps: 8 });
  const pick = await page.textContent(".dial-big");
  assert.notEqual(pick, "River Road", "sweeping moves through the set");
  await page.mouse.up(); await page.waitForFunction(p => new RegExp(p).test(document.querySelector('h1.song-title')?.innerText || ''), pick);
  assert.match(await page.innerText("h1.song-title"), new RegExp(pick));
  assert.match(await page.innerText("#setdial"), /of 4/);
});

test("2.1 glow: count-in and the chord you're on glow; gig day counts down on Up Next", { skip: skip() }, async t => {
  const soon = new Date(Date.now() + 50 * 60e3), when = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}T${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`;
  const sameDay = soon.toDateString() === new Date().toDateString();
  const page = await phone(t, { ...LIB, sets: [{ id: "s", name: "Gig", songIds: ["a"], when }], settings: { ...LIB.settings, diagrams: true, countIn: true } });
  if (sameDay) {
    const a = await page.textContent("#un-cd");
    assert.match(a, /^0:[45]\d:\d\d$/, "a countdown on gig day");
    await page.waitForTimeout(1300); /* real timer */
    assert.notEqual(await page.textContent("#un-cd"), a, "it ticks");
    assert.match(await page.evaluate(() => getComputedStyle(document.querySelector("#un-cd")).textShadow), /px/, "it glows");
  }
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await page.click("#play"); await page.waitForSelector(".countin", { timeout: 3000 });
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector(".countin")).textShadow), /px/, "the count-in glows");
  await page.waitForSelector("#nn .nowcol .dn", { timeout: 8000 });
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector("#nn .nowcol .dn")).filter), /glow-f/, "Now glows");
  assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.querySelector("#nn .cards .dn")).filter), /glow-f/, "Next stays plain");
});

test("3.19.0 one hand: paused the whole bar shows; Play folds it into its corner while playing, and there is no ring", { skip: skip() }, async t => {
  const lib = { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 900 } : s), settings: { ...LIB.settings, countIn: false } };
  const page = await phone(t, lib);
  const center = () => page.evaluate(() => { const r = document.getElementById("play").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const state = () => page.evaluate(() => ({ one: document.body.classList.contains("one"), fold: document.body.classList.contains("fold"), inBar: !!document.getElementById("play").closest(".player"), bar: getComputedStyle(document.querySelector(".app.viewer .dock")).display !== "none" }));
  await page.goto(base + "#/song/a"); await page.waitForSelector('#play');
  assert.deepEqual(await state(), { one: true, fold: false, inBar: true, bar: true }, "paused: the bar is out with Play in it");
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains('fold'));
  assert.equal(await page.getAttribute("#play", "aria-label"), "Pause auto-scroll");
  assert.deepEqual(await state(), { one: true, fold: true, inBar: false, bar: false }, "playing: the bar folds away");
  /* wait for the fold to finish moving (it springs past the corner and back) */
  await page.waitForFunction(() => { const p = document.getElementById('play'), r = p.getBoundingClientRect(); return !document.getAnimations().some(a => a.playState === 'running' && (a.effect?.target === p || a.effect?.target?.contains?.(p))) && r.left + r.width / 2 > 320 && r.top + r.height / 2 > 760; });
  const c = await center();
  assert.ok(c.x > 320 && c.y > 760, `Play waits in the corner (${c.x}, ${c.y})`);
  assert.match(await page.innerText("#fp-nav"), /Songbook/, "beside it, the way back to the Songbook");
  await page.click("#fp-nav"); await page.waitForFunction(() => location.hash === '#/library');
  assert.equal(await page.evaluate(() => location.hash), "#/library", "the Songbook page");
  await page.evaluate(() => { location.hash = "#/"; }); await page.waitForSelector("#rd-tonight");
  await page.evaluate(() => import("/app.js").then(m => m.playSong("a"))); await page.waitForSelector("#fp-nav", { state: "visible" }); /* a song opened from the Road and played */
  await page.click("#fp-nav");
  await page.waitForFunction(() => location.hash === "#/library", null, { timeout: 4000 }); /* 4.9.0: the Songbook is a page from the Road too */
  await page.goto(base + "#/song/a"); await page.waitForSelector('#play');
  await page.click("#play"); await page.waitForFunction(() => document.body.classList.contains('fold'));
  /* a long hold is still a tap: nothing opens, and it pauses */
  await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(900); /* real timer */ await page.mouse.up(); await page.waitForFunction(() => document.getElementById('play').getAttribute('aria-label') === 'Start auto-scroll');
  assert.equal(await page.locator(".ringx, .rc-track, .rc-isl").count(), 0, "no ring, arc or island");
  assert.equal(await page.getAttribute("#play", "aria-label"), "Start auto-scroll");
  assert.deepEqual(await state(), { one: true, fold: false, inBar: true, bar: true }, "paused again: the bar unfolds");
  /* More has Metronome now that the ring is gone */
  await page.click("#more"); await page.waitForSelector(".menu");
  assert.equal(await page.locator(".menu [data-m='metro']").count(), 1);
});

test("2.16.5 speed dial: a tap that slips a little near the corner closes it without changing the time", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 200 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  const before = await speedText(page);
  await openSpeed(page);
  /* Tap on the wheel close to the corner, drifting 8 px: about 9 degrees there. */
  const x = 390 - 20, y = 844 - 25;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x - 8, y, { steps: 3 });
  await page.mouse.up(); await page.waitForSelector('.dial', { state: 'detached' });
  assert.equal(await page.locator(".dial").count(), 0, "the tap closed it");
  assert.equal(await speedText(page), before, "the time didn't change");
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("tabs-v1"))).songs.find(s => s.id === "a").duration, 200, "nothing saved");
});

test("2.25.0 speed dial is a meter: the needle swings with the length, and whole minutes are marked", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map(s => s.id === "a" ? { ...s, duration: 235 } : s) });
  await page.goto(base + "#/song/a"); await page.waitForSelector('.metarow');
  await openSpeed(page); await page.waitForSelector(".dial-needle");
  const tip = () => page.evaluate(() => { const n = document.querySelector(".dial-needle"); return [+n.getAttribute("x2"), +n.getAttribute("y2")]; });
  const before = await tip();
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".dial-labels .sc")].map(e => e.textContent)), ["2:00", "3:00", "4:00", "5:00", "6:00", "8:00", "10:00", "15:00"], "3.19.0: up to 15 minutes");
  assert.match(await page.textContent(".dial-small"), /SONG LENGTH/);
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => { const s = document.getElementById("speed"); s.value = 480; s.oninput(); });
  await page.mouse.click(60, 120); await page.waitForSelector('.dial', { state: 'detached' });
  await openSpeed(page); await page.waitForSelector(".dial-needle");
  const after = await tip();
  assert.ok(after[1] < before[1], `faster points higher: ${before} then ${after}`);
});

test("2.25.0 filter chips: the selected one's lamp is lit (4.0.0: in the palette's go colour)", { skip: skip() }, async t => {
  const page = await phone(t, { ...LIB, songs: LIB.songs.map((s, i) => ({ ...s, favorite: i === 0 })) });
  const lamp = sel => page.evaluate(s => getComputedStyle(document.querySelector(s), "::before").backgroundColor, sel);
  const go = await page.evaluate(() => { const d = document.createElement("i"); d.style.color = "var(--accent)"; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; });
  assert.equal(await lamp("#chips [data-f='all']"), go);
  assert.notEqual(await lamp("#chips [data-f='fav']"), go);
  await page.click("#chips [data-f='fav']"); await until(async () => (await lamp("#chips [data-f='fav']")) === go);
  assert.equal(await lamp("#chips [data-f='fav']"), go);
});
