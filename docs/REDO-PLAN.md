# Redo plan (after 4.20.0, 2026-10-21)

Graham asked "is this your best idea?" about seven screens, and later about the Songbook page and Get the song (2026-10-21, both approved the same night). The answers became mockups on the mockup canvas (the Design artifact), in the last two rows, and Graham approved them on 2026-10-21. This plan builds them, one release per step.

Each task says who should do it:

- **[Sonnet]** mechanical, with the design and the places in the code already settled here.
- **[Opus]** needs judgment while doing it (new logic, audio timing, AI prompts).

Tick a task's box in this file in the same commit that does it.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Its standing rules apply: plain writing with no em dashes, don't change how the search bar works, keys stay on the phone, the AI never writes lyrics, mid-song actions in thumb reach.
2. Open the mockup board named in the step (the canvas boards are listed by title) and match it. Where the board and this plan disagree, the board wins for looks and this plan wins for behaviour.
3. One step per release: a feature is a minor version (4.21.0), a fix is a patch. Bump `VERSION` in `core.js` and `CACHE` in `sw.js` together (edit only the `const CACHE` line; a broad replace broke `sw.js` once).
4. Add or update tests for what changed. Run `eslint .` and `node tests/quick.mjs` before each push. Don't run the full suite. Then `git fetch origin main && git rebase origin/main` and push to `main`.
5. Update the README feature list when behaviour changes.
6. If the code doesn't match this plan (a name moved, a function is different), stop that step and write it under "Surprises" at the end. Don't improvise.
7. After each step, stop so Graham can try it on his phone, and tell him which model the next step wants.

## Decisions (all made)

- Server for Play together: **no**. Clap start covers how it's used (same room, or on a call). A server comes with the real-player league at App Store launch.
- Electric headstock: **matches Louie's finish** (the Merch table's Stock blue, Pink, Teal and the rest). Acoustic stays wood.
- Tuner keeps the original headstock drawings (`heads.js`), in colour.
- Play next: the "in between" card (board "Play next v3 · in between").
- Songbook and Get the song: all four boards in the row "Slimmer Songbook, and Get the song that keeps what it found" (approved 2026-10-21).
- Order (2026-10-21): Tuner, then the slimmer Songbook, then Get the song, then Play next (its Learn button runs Get the song, so that comes first), then Play together.
- Already shipped outside the plan in 4.24.0: Start listening in the neck's lessons turns into "Listening · tap to stop" and comes back when the mic stops; a tuner button in the neck and every lesson opens the tuner over the page; the tuner ticks (haptics) on reaching the in-tune zone, two ticks per string tuned, three and a small party (confetti, Louie with his horns up) for the whole guitar, with louder chimes. Step 5 keeps all of this.

## Step 1 [Sonnet] 4.20.1: Songbook filters that fit (board "Songbook filters · one row that fits")

- [x] 1.1 `chipsHTML()` in `library.js`: one segmented row, full width, no scrolling: **All · Can play (count) · Learning · ♥** (the heart's `aria-label` is "Favorites"). Hide a part with no songs, as today. Keep `id="chips"`, the `.chip` class, `data-f` values and `.on` so the filter code and tests keep working.
- [x] 1.2 Sets leaves the row: a chunky "Sets" button in the Songbook header beside the tuner button, which sets `filter = "sets"` (the list branch at `if (filter === "sets" && !searching)` in `renderList` stays). Back from the Sets list returns to All.
- [x] 1.3 Tabs leaves the row: a "Tabs only" choice in the sort menu (`SORTS` / `sortBy` in `library.js`) that sets `filter = "tab"`. Choosing a sort clears it.
- [x] 1.4 `styles.css`: `.chips` stops scrolling (`overflow: visible`, no negative margins), the parts share the width, the chosen one is filled in `--accent` with its lip (`0 3px 0 var(--accent-deep)`) fully visible. Remove the 4.20.0 `#chips .chip` pill rules that the segmented look replaces.
- [x] 1.5 Tests: app2's "2.25.0 filter chips" test (filled, no lamp) still passes; add: the row's right edge is inside the screen at 390 wide; the Sets button opens the Sets list; "Tabs only" filters to tabs. Grep tests for `data-f='sets'` and `data-f='tab'` and move them to the new controls.

## Step 2 [Opus] 4.21.0: The neck, a lesson of the day (board "The neck · lesson of the day")

- [x] 2.1 `core/neck.js`: `lessonOfDay(data, now)` (pure, unit tested). Three parts, about 4 minutes:
  1. Warm up: a change he already lands well (from the gig change records `soundcheck` uses in `core/game.js`, or the switch lessons he has passed).
  2. The new change: the change his songs need most that he hasn't learned, with the song it comes from and how many times it appears (use `changesOf` in `core.js` for counts across songs).
  3. Play it: a verse (or the section holding that change) from that song at 70% with the band, counted when he lands 4 of 6.

  The same lesson all day (seeded by the date), stored as `data.lesson = { day, parts, done: [] }` (document in docs/DATA.md). 40 XP when all three are done (`XP` in core). Say which song it opens next when the new chord unlocks one (`fitOf`-style check).
- [x] 2.2 `practice.js` `renderNeck()`: the lesson card at the top, three steps with done/now/next states, "+40 XP" and "Opens X next" tags, and one "Start lesson" button at the bottom in thumb reach. Part 1 and 2 run the existing `switchLesson`; part 3 opens the song in Practice mode with the section looped at 0.7.
- [x] 2.3 The skill tiles below become one "Your skills" card: three bars (Open chords, Switches, Scales, "n of m") and "All lessons" opening today's full grid on its own page (`#/practice/skills`).
- [x] 2.4 Tests: unit tests for `lessonOfDay` (same all day, changes tomorrow, skips learned changes, empty library); a browser test for the card and Start.

## Step 3 [Sonnet] 4.22.0: Search, focused (board "Search · focused")

Don't change how the search bar works: only the screen under it while it's focused and empty.

- [x] 3.1 While searching with an empty query: hide Up next, the nudge card and the filters (CSS on `body.searching`), and close the gap.
- [x] 3.2 Two big buttons: **Paste a song** (accent) reads `navigator.clipboard.readText()` and passes the text into the same path a paste in the bar takes today (find it from `showPasteCard`); if reading is refused, toast "Long-press the bar and choose Paste". **What can I play next?** (card button with a small Louie, `louie("happy", { pose: "point" })`) opens Play next as today.
- [x] 3.3 Recently played: three version 4 cards (cover when Apple Music has one, else the coloured letter tile; title; artist and plays; a Play button that opens the song and plays it, as `playSong` does).
- [x] 3.4 The list ends above the keyboard: use `visualViewport` height for the bottom padding while focused, so nothing sits under iOS's form bar.
- [x] 3.5 Tests: focused and empty shows the two buttons and three cards, no Up next; Paste with a mocked clipboard opens the paste card; typing still searches as before.

## Step 4 [Sonnet] 4.23.0: Your changes, in Soundcheck (board "Your changes · in Soundcheck")

- [x] 4.1 `core`: `changesToWork(data, now)` (pure, unit tested): the three changes his songs contain most that he lands least (landing from gig records; "not tried yet" when there are none), each with where it comes from ("In Don't Look Back in Anger, 6 times" or "In 3 of your songs, 9 times"), and one change he has down (landed 90% or more, most landings this week).
- [x] 4.2 Rehearse (`renderRehearse` in `practice.js`): a "Your changes" section with the three rows (pair, why, landed bar, Drill opening `#/practice/s:A-B`), the "solid" line, and "Drill all three" at the bottom.
- [x] 4.3 Remove the old Changes sheet and its bar chart (the "To work on" stats in Your profile's More stats now link to this section). Grep for `showChanges`, `chg-`, `changesSheet` before deleting.
- [x] 4.4 Tests: unit tests for `changesToWork`; browser test for the section and a Drill tap; update `changes.e2e.mjs`.

## Step 5 [Sonnet] 4.25.0: Tuner (boards "Tuner v3 · acoustic in colour" and "Tuner v3 · electric in colour")

- [x] 5.1 `tuner.js`: Acoustic, Electric and Chromatic move into the tuning menu (one pill: "Standard · Acoustic ▾"); the three type cards go.
- [x] 5.2 The note big at the top (96px, `--display`) with the status beside it ("A little sharp", "Loosen it slightly · +12"), and the meter bolder (thicker ticks, a filled in-tune zone, a 6px needle in `--accent`).
- [x] 5.3 `headSVG` keeps the drawing and the lit, shimmering string, and adds colour, flat with no outlines: the headstock path filled in a face colour with a darker right half (clip the path, two rects), keys in their own colour with a darker lip, posts and the nut in cream. Acoustic: mahogany face `#9A5B34`, side `#7A4426`, a darker veneer, cream keys. Electric: Louie's finish (`--lv-body` for the face, `--lv-shade` for the side, `--lv-hi` for a highlight stripe), so it follows `body[data-wear]`. The key in hand is `--tn-lit`, tuned keys `--good` with a check.
- [x] 5.4 Chromatic keeps its dial.
- [x] 5.5 Tests: the type is chosen from the menu and saved; the electric face uses the Louie finish (set `data-wear="pink"` and check the fill); existing tuner tests still pass, including 4.24.0's haptics and party (`.tn-party` is appended to `#tn-stage`, so the new stage must keep `#tn-stage` and `position: relative`).

## Step 6 [Sonnet] 4.26.0: The Songbook, slimmer (board "Songbook · slimmer")

The list is the page. Everything above it shrinks to one strip.

- [x] 6.1 One "Today" strip (58px, chunky, in the nudge's colour) in place of the nudge card (`todayHTML` and `#nudge` in `library.js`) and "Up next for you" (`upNextHTML`). It pages through what both show today, the streak song first when the streak is at risk, with dots for how many there are ("Today · 1 of 3"). Swipe sideways or tap the dots to page; tapping the strip opens what that card opens today. One item: no dots. Nothing: no strip.
- [x] 6.2 Your sets leave the page: drop `setsShelf()` from `.lib-top` in `renderList`. The Sets button in the header (4.20.1) opens them. The empty "New set" tile goes; making a set stays in the Sets list. Keep `setsShelf` if anything else still calls it (grep first).
- [x] 6.3 Under the filters, one line: "23 songs" on the left and the sort menu on the right (today's "All songs" label goes).
- [x] 6.4 Tests: the strip pages and opens the right song; no sets shelf on All; the first song row sits within 280px of the top at 390x844; update tests that look for `#nudge`, `.upn` or `#sh-all` on the Songbook (grep).

## Step 7 [Opus] 4.27.0: Get the song that keeps what it found (boards "Get the song · ready", "· which recording", "· swiped away, kept")

The fetch costs time and AI calls, so nothing throws it away by accident. Code: `getSong` in `findai.js` (`gs-*`).

- [x] 7.1 Closing: once there is a result, the scrim tap, the swipe down and Cancel no longer discard it. Cancel goes; a down-arrow button at the top left ("Keep it for later") puts it aside. Only **Not this one** discards, with no question asked. While it's still fetching, closing also puts it aside and the fetch carries on.
- [x] 7.2 Kept for later: a "Hurt is ready · Not added yet" bar with an **Add** button above the search bar (Songbook and Road), tapping it reopens the sheet exactly as it was (level, recording, edits). One kept song at a time, in memory and in `sessionStorage` (a reload keeps it; it is not a saved field, so no DATA.md change). A new Get the song replaces it after a toast "Hurt put aside" with Undo.
- [x] 7.3 The sheet: cover (Apple Music art when available) with a play button for the 30-second preview; a "You know all 4 chords" line (or "1 new chord: Dsus2") listing the chords, using the same can-play check as the Songbook; the level switch; key, capo, BPM and time as small chips; one Recording row ("American IV · 3:38 · timed  Change ›"); the first lines of the sheet with "Show the whole sheet"; the source line under it. Words are LRCLIB's as today (the AI never writes lyrics).
- [x] 7.4 The dock, fixed at the bottom in thumb reach: **Add to my songs** (accent, full width), with "Not this one" and "Edit first" under it.
- [x] 7.5 Which recording: its own view with Back, one card per recording (art or tile, name, year and length, a Timed tag), the one whose length is closest to the chord sheet's (or the Apple Music track's) first and tagged "Best match"; "Use this one" in the dock; "None of these: paste the words" under the list.
- [x] 7.6 Tests: a scrim tap and a swipe with a result keep it (the bar shows, tapping it restores the same level and recording); Not this one discards; Add from the dock adds; Best match orders by length; the can-play line.

## Step 8 [Opus] 4.28.0: Play next (boards "Play next v3 · in between" and "Play next · loading (animated)")

- [x] 8.1 The level switch moves to the top of the sheet (`#nx-level`, keep the ids); "One new chord each, closest first" under it; Show different songs is the only bottom button.
- [x] 8.2 Cards: cover (Apple Music art when available; tap plays the 30-second preview, replacing the note button), title, artist, one **Learn** button (runs Get the song as rebuilt in Step 7 and then opens the new chord's lesson `#/practice/c:X`), and the inset strip: chord shape, "NEW Cm", "You know ...", and "+n songs" when that chord also completes other songs in his library.
- [x] 8.3 Sort by fewest new chords first.
- [x] 8.4 Check the AI's chord list against the fetched sheet: when a song is fetched (Get the song), read its chords from the sheet and correct the card; if the "new" chord isn't in the sheet, say so on the song instead of teaching a wrong chord. (Hotel California came back with a C# it doesn't have.)
- [x] 8.5 Loading: Louie digging through a record crate. Records flip up one after another, each in a palette colour with one of his known chords; one line underneath that changes once ("Looking at your 12 chords", then "Finding songs one chord away"); ghost cards below. Results fly in as cards. Reduce Motion: Louie still, the line changes.
- [x] 8.6 Tests: mocked AI response renders the cards sorted; Learn opens the chord lesson after getting the song; a wrong chord is caught; the loading state shows the crate and the line.

## Step 9 [Opus] 4.29.0: Play together, clap to start (board "Play together · clap to start")

- [x] 9.1 `share.js` `duetSheet`: Louie waving, "Your part" (Chords, Bass line, Melody; Melody shows the words with the melody notes if the song has a sketch melody, otherwise is hidden), "Start" explaining the clap, and two buttons: **Send song** (today's share link, without the start time) and **Listen for clap**.
- [x] 9.2 Listen for clap: the microphone listens for one sharp onset (reuse the strum onset detection the Gig uses); on it, the one-bar count-in starts from the moment of the clap, so two phones in the same room start together. Ignore onsets for 300 ms after opening; time out after 60 s with "Didn't hear a clap. Tap to listen again".
- [x] 9.3 Bass line plays Bex's line through the band; Chords is today's play.
- [x] 9.4 Remove the start-time picker (In 1, 2, 5 min) and the shared start time from the link; an old link with a time still opens the song.
- [x] 9.5 Tests: a mocked onset starts the count-in; the old-link fallback; Send song shares without a time.

## Surprises

- Step 2 (4.21.0): Practice mode has no landing check, so "counted when he lands 4 of 6" became "twice through the looped section counts" (once through when the song has no section labels). A real landing check would need the Gig's scoring in Practice mode.
- Step 2: "Opens X next" was dropped. A switch lesson doesn't add a chord he knows, so no song opens because of it; the card says how often the change is in his other songs instead.
- Step 2: the day's plan is kept as soon as a part starts, since passing the new change's switch lesson would otherwise swap the lesson for a different change.
- Step 2: the lesson lives in `data.rehearse.lesson` (not `data.lesson`), so it saves through the existing `cleanRehearse`.
- Step 4 (4.23.0): the old Changes sheet was already gone in 4.20.0, so 4.3 removed nothing. Your profile's "most played" changes card (`pf-chg`, `.pf-drill`) stays.
- Step 4: a lesson opened from Rehearse used to bounce to the neck when its switch was still locked on the ladder (Em to Am before G to C), and ended on "Next: <the ladder's next lesson>". Rehearse drills now open locked switches and end on "Back to Rehearse".
- 4.24.0 (outside the plan, from the phone): the neck's Start listening sat there disabled after it started, because `.btn`'s `display: flex` beat the `hidden` attribute, so it looked broken. Fixed with a listening state, plus a tuner in the neck and tuner haptics. Steps 5 to 7 moved up one minor version and Play next and Play together moved to Steps 8 and 9.
- Step 5 (4.25.0): the instrument tiles and the tuning chip became one pill and one menu (`#tn-menubtn`, `#tn-menu`, with `[data-mode]` buttons and the native `#tn-tuning` select inside), so tests open the menu before choosing Chromatic. The idle big note shows a muted dash. Electric keys are silver and acoustic keys cream (plan said "their own colour").
- Step 6 (4.26.0): the next dated set still shows, as a card in the Today strip (it carries the gig-day countdown and Play), because dropping the shelf would have lost it; an undated set does not. `setsShelf` and `bindShelf` stay, since the Road's drawer uses them. The dots sit under the strip, not inside it, so they read on every card colour. The plan's "All songs" label became the count line for every filter.
- Step 7 (4.27.0): putting a song aside also leaves search, so its bar is in view (the bar hides while searching). Starting a new Get the song lets the kept one go with the toast "Let go of Hurt" and Undo, rather than "put aside". The recording cards have no year (LRCLIB doesn't give one) and use a coloured tile for art. A song still being fetched isn't written to sessionStorage, so a reload mid-fetch drops it; only a finished one survives a reload. The swipe down is tested through the scrim tap it fires (ui.js), not with real touches.
- Step 8 (4.28.0): the chord check happens in Get the song (it says so in the sheet and in a toast after Add) rather than correcting the Play next card, which is closed by then. A cover with no preview falls back to Apple Music search, as the old note button did. "+n songs" counts your songs short of just that chord, using the chords you know from lessons and plays (the Songbook's Can play check), so it is hidden until you know some.
- Step 9 (4.29.0): the clap is heard on the raw microphone level (the Gig's `strumDetector`, without its guitar-band filter, since a clap is mostly high frequencies). Melody shows the sung notes' names under each line, matched to the sheet's lines in order. Bass line plays with the band even when the song has a linked recording. A link still carries a `duet` marker (tempo only), so the friend lands on Play together; `unpackShare` drops any old start time. The 60-second timeout is not covered by a test. The board's note about the server (seeing when your friend is ready) was left out of the sheet.

# Part 2 (2026-10-21, evening): waiting for Graham's go on the boards

Graham's phone check after Step 9 raised these. Fixes went out as 4.29.1 and 4.29.2 (guitar icon A, the tuner menu, no page zoom, Profile out of More, the lit string's lip, a clean All in tune, Your changes button sizes, the play bar cover). The rest needs his go on the boards in the row "Song screen, Tools in three tabs, Rehearse as one page, one button system". Don't start these until he says so.

## Decisions for Graham

- The song screen: details open from the title (cover, "about this song"), the bar keeps two buttons (Tools, Play), the key chip goes.
- Tools: three tabs (Play, Practice, Song) with rows instead of fifteen tiles, the tabs at the bottom in thumb reach.
- Rehearse and the neck become one page: today's lesson, your changes, your skills, more ways to practice.
- Buttons: three sizes used the same everywhere (main 56, row action 42, chip 32).
- The key tile at the end of each Songbook row: keep it, or drop it too (it says the same thing as the key chip)?

## Step 10 [Sonnet] 4.30.0: One button and control system (board "Buttons · one system")

The audit found (2026-10-21):
- [x] 10.1 Buttons: the main action is 56 tall with 18px text and the shine above the words (`.btn.primary::before` stays clear of the label); row actions (Drill, Learn, Add) are 42 tall and white with a lip; chips are 32. The Your changes Drill buttons become row actions.
- [x] 10.2 Segmented controls: seven variants (`.seg`, `.seg mini`, the Songbook filter row, Lines in a gig, the tuner menu, Play next and Get the song levels, Play together parts). One look: the Songbook filter row's (filled accent with its lip). The jewel lamps in the Play next and Get the song level switches (`nx-lamp`, a version 3 leftover) go.
- [x] 10.3 Thin outlines: 37 rules still draw `1px solid var(--rim)` borders (the Get the song chips `.cs-meta span`, `.gs-ver`, `.nx-ch span`, `.tn-chip` and more). Version 4 is flat colour on a darker lip: swap them for `box-shadow: 0 3px 0 var(--rim)` on a card colour.
- [x] 10.4 Lists of places to go (Rehearse's Skill work, Settings, More): one row (icon tile, name, one line under it, chevron), 56 tall.
- [x] 10.5 Tests: a computed-style test per component (height, lip) on two screens each.

## Step 11 [Opus] 4.31.0: The song screen, details from the title (boards "Song · details from the title, two buttons" and "About this song")

- [x] 11.1 The title row: a small cover (Apple Music art, else the coloured letter tile) and "about this song ›" under the artist; tapping opens About this song. The key chip goes (the key moves into About); "Mark as learning" stays.
- [x] 11.2 The play bar: Tools (with its word) and Play. Play's second line says what it plays with. The second button (`#listen`, the recording) goes.
- [x] 11.3 About this song replaces the Recording sheet: cover, title, artist, genre and year, a preview button; Tempo, Length and Key tiles; the mismatch note with Match it; "When you press Play" as one segmented control (With the recording, With the band); Timing and Change recording as rows; Done at the bottom. With no recording linked: the same sheet with "Find a recording" in place of the recording rows.
- [x] 11.4 Tests: the title opens About; the backing choice is saved per song; no `#listen` in the bar.

## Step 12 [Opus] 4.32.0: Tools in three tabs (boards "Tools · Play", "Tools · Practice", "Tools · Song")

- [x] 12.1 `songMenu` becomes a sheet with Play, Practice and Song tabs at the bottom (thumb reach); the last tab is remembered.
- [x] 12.2 Play: Song length or Speed (stepper), Metronome, Bass line, Now and Next (switches with their value under the name), Lines in a gig, Text size. Practice: Practice mode, Practice a section, Make it easier, Capo, Tuner, Play together. Song: Edit, Add to a set, Share, German, Spark tone, Add the words.
- [x] 12.3 Rows, not tiles: switches toggle in place; a row with a chevron opens its sheet. The new dots stay on rows.
- [x] 12.4 Tests: update every test that opens a tool through `.menu [data-m=…]` (grep), keep the `data-m` values.

## Step 13 [Opus] 4.33.0: Rehearse as one page (board "Rehearse · one page with the neck in it")

- [ ] 13.1 Rehearse shows, in order: today's lesson card (from the neck, with Start or Go on), Your changes (which also takes over Missed changes and Soundcheck), Your skills (three bars, All lessons), and More ways to practice (Sit in with the band, Tuner, What I hear) as three tiles.
- [ ] 13.2 `#/practice/neck` opens Rehearse at the lesson; the skills page (`#/practice/skills`) stays as All lessons. Lessons go back to Rehearse.
- [ ] 13.3 Tests: update the neck and Rehearse tests; the lesson card starts the lesson from Rehearse.
