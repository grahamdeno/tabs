# Redo plan (after 4.20.0, 2026-10-21)

Graham asked "is this your best idea?" about seven screens. The answers became mockups on the mockup canvas (the Design artifact), in the last two rows, and Graham approved them on 2026-10-21. This plan builds them, one release per step.

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

## Step 1 [Sonnet] 4.20.1: Songbook filters that fit (board "Songbook filters · one row that fits")

- [x] 1.1 `chipsHTML()` in `library.js`: one segmented row, full width, no scrolling: **All · Can play (count) · Learning · ♥** (the heart's `aria-label` is "Favorites"). Hide a part with no songs, as today. Keep `id="chips"`, the `.chip` class, `data-f` values and `.on` so the filter code and tests keep working.
- [x] 1.2 Sets leaves the row: a chunky "Sets" button in the Songbook header beside the tuner button, which sets `filter = "sets"` (the list branch at `if (filter === "sets" && !searching)` in `renderList` stays). Back from the Sets list returns to All.
- [x] 1.3 Tabs leaves the row: a "Tabs only" choice in the sort menu (`SORTS` / `sortBy` in `library.js`) that sets `filter = "tab"`. Choosing a sort clears it.
- [x] 1.4 `styles.css`: `.chips` stops scrolling (`overflow: visible`, no negative margins), the parts share the width, the chosen one is filled in `--accent` with its lip (`0 3px 0 var(--accent-deep)`) fully visible. Remove the 4.20.0 `#chips .chip` pill rules that the segmented look replaces.
- [x] 1.5 Tests: app2's "2.25.0 filter chips" test (filled, no lamp) still passes; add: the row's right edge is inside the screen at 390 wide; the Sets button opens the Sets list; "Tabs only" filters to tabs. Grep tests for `data-f='sets'` and `data-f='tab'` and move them to the new controls.

## Step 2 [Opus] 4.21.0: The neck, a lesson of the day (board "The neck · lesson of the day")

- [ ] 2.1 `core/neck.js`: `lessonOfDay(data, now)` (pure, unit tested). Three parts, about 4 minutes:
  1. Warm up: a change he already lands well (from the gig change records `soundcheck` uses in `core/game.js`, or the switch lessons he has passed).
  2. The new change: the change his songs need most that he hasn't learned, with the song it comes from and how many times it appears (use `changesOf` in `core.js` for counts across songs).
  3. Play it: a verse (or the section holding that change) from that song at 70% with the band, counted when he lands 4 of 6.

  The same lesson all day (seeded by the date), stored as `data.lesson = { day, parts, done: [] }` (document in docs/DATA.md). 40 XP when all three are done (`XP` in core). Say which song it opens next when the new chord unlocks one (`fitOf`-style check).
- [ ] 2.2 `practice.js` `renderNeck()`: the lesson card at the top, three steps with done/now/next states, "+40 XP" and "Opens X next" tags, and one "Start lesson" button at the bottom in thumb reach. Part 1 and 2 run the existing `switchLesson`; part 3 opens the song in Practice mode with the section looped at 0.7.
- [ ] 2.3 The skill tiles below become one "Your skills" card: three bars (Open chords, Switches, Scales, "n of m") and "All lessons" opening today's full grid on its own page (`#/practice/skills`).
- [ ] 2.4 Tests: unit tests for `lessonOfDay` (same all day, changes tomorrow, skips learned changes, empty library); a browser test for the card and Start.

## Step 3 [Sonnet] 4.22.0: Search, focused (board "Search · focused")

Don't change how the search bar works: only the screen under it while it's focused and empty.

- [ ] 3.1 While searching with an empty query: hide Up next, the nudge card and the filters (CSS on `body.searching`), and close the gap.
- [ ] 3.2 Two big buttons: **Paste a song** (accent) reads `navigator.clipboard.readText()` and passes the text into the same path a paste in the bar takes today (find it from `showPasteCard`); if reading is refused, toast "Long-press the bar and choose Paste". **What can I play next?** (card button with a small Louie, `louie("happy", { pose: "point" })`) opens Play next as today.
- [ ] 3.3 Recently played: three version 4 cards (cover when Apple Music has one, else the coloured letter tile; title; artist and plays; a Play button that opens the song and plays it, as `playSong` does).
- [ ] 3.4 The list ends above the keyboard: use `visualViewport` height for the bottom padding while focused, so nothing sits under iOS's form bar.
- [ ] 3.5 Tests: focused and empty shows the two buttons and three cards, no Up next; Paste with a mocked clipboard opens the paste card; typing still searches as before.

## Step 4 [Sonnet] 4.23.0: Your changes, in Soundcheck (board "Your changes · in Soundcheck")

- [ ] 4.1 `core`: `changesToWork(data, now)` (pure, unit tested): the three changes his songs contain most that he lands least (landing from gig records; "not tried yet" when there are none), each with where it comes from ("In Don't Look Back in Anger, 6 times" or "In 3 of your songs, 9 times"), and one change he has down (landed 90% or more, most landings this week).
- [ ] 4.2 Rehearse (`renderRehearse` in `practice.js`): a "Your changes" section with the three rows (pair, why, landed bar, Drill opening `#/practice/s:A-B`), the "solid" line, and "Drill all three" at the bottom.
- [ ] 4.3 Remove the old Changes sheet and its bar chart (the "To work on" stats in Your profile's More stats now link to this section). Grep for `showChanges`, `chg-`, `changesSheet` before deleting.
- [ ] 4.4 Tests: unit tests for `changesToWork`; browser test for the section and a Drill tap; update `changes.e2e.mjs`.

## Step 5 [Sonnet] 4.24.0: Tuner (boards "Tuner v3 · acoustic in colour" and "Tuner v3 · electric in colour")

- [ ] 5.1 `tuner.js`: Acoustic, Electric and Chromatic move into the tuning menu (one pill: "Standard · Acoustic ▾"); the three type cards go.
- [ ] 5.2 The note big at the top (96px, `--display`) with the status beside it ("A little sharp", "Loosen it slightly · +12"), and the meter bolder (thicker ticks, a filled in-tune zone, a 6px needle in `--accent`).
- [ ] 5.3 `headSVG` keeps the drawing and the lit, shimmering string, and adds colour, flat with no outlines: the headstock path filled in a face colour with a darker right half (clip the path, two rects), keys in their own colour with a darker lip, posts and the nut in cream. Acoustic: mahogany face `#9A5B34`, side `#7A4426`, a darker veneer, cream keys. Electric: Louie's finish (`--lv-body` for the face, `--lv-shade` for the side, `--lv-hi` for a highlight stripe), so it follows `body[data-wear]`. The key in hand is `--tn-lit`, tuned keys `--good` with a check.
- [ ] 5.4 Chromatic keeps its dial.
- [ ] 5.5 Tests: the type is chosen from the menu and saved; the electric face uses the Louie finish (set `data-wear="pink"` and check the fill); existing tuner tests still pass.

## Step 6 [Opus] 4.25.0: Play next (boards "Play next v3 · in between" and "Play next · loading (animated)")

- [ ] 6.1 The level switch moves to the top of the sheet (`#nx-level`, keep the ids); "One new chord each, closest first" under it; Show different songs is the only bottom button.
- [ ] 6.2 Cards: cover (Apple Music art when available; tap plays the 30-second preview, replacing the note button), title, artist, one **Learn** button (gets the song and then opens the new chord's lesson `#/practice/c:X`), and the inset strip: chord shape, "NEW Cm", "You know ...", and "+n songs" when that chord also completes other songs in his library.
- [ ] 6.3 Sort by fewest new chords first.
- [ ] 6.4 Check the AI's chord list against the fetched sheet: when a song is fetched (Get the song), read its chords from the sheet and correct the card; if the "new" chord isn't in the sheet, say so on the song instead of teaching a wrong chord. (Hotel California came back with a C# it doesn't have.)
- [ ] 6.5 Loading: Louie digging through a record crate. Records flip up one after another, each in a palette colour with one of his known chords; one line underneath that changes once ("Looking at your 12 chords", then "Finding songs one chord away"); ghost cards below. Results fly in as cards. Reduce Motion: Louie still, the line changes.
- [ ] 6.6 Tests: mocked AI response renders the cards sorted; Learn opens the chord lesson after getting the song; a wrong chord is caught; the loading state shows the crate and the line.

## Step 7 [Opus] 4.26.0: Play together, clap to start (board "Play together · clap to start")

- [ ] 7.1 `share.js` `duetSheet`: Louie waving, "Your part" (Chords, Bass line, Melody; Melody shows the words with the melody notes if the song has a sketch melody, otherwise is hidden), "Start" explaining the clap, and two buttons: **Send song** (today's share link, without the start time) and **Listen for clap**.
- [ ] 7.2 Listen for clap: the microphone listens for one sharp onset (reuse the strum onset detection the Gig uses); on it, the one-bar count-in starts from the moment of the clap, so two phones in the same room start together. Ignore onsets for 300 ms after opening; time out after 60 s with "Didn't hear a clap. Tap to listen again".
- [ ] 7.3 Bass line plays Bex's line through the band; Chords is today's play.
- [ ] 7.4 Remove the start-time picker (In 1, 2, 5 min) and the shared start time from the link; an old link with a time still opens the song.
- [ ] 7.5 Tests: a mocked onset starts the count-in; the old-link fallback; Send song shares without a time.

## Surprises

(none yet)
