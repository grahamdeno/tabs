# One page plan: the song page and the Gig become one (after 4.49.13, 2026-10-24)

Graham asked to put the best of the song page and the Gig into one page, assessed as a senior engineer, then as a
UX designer, then decided as a PM (2026-10-24). The decision: **one page, two states. Play changes how the page
looks, not which page you're on.** This plan builds it, one release per step, stopping after each for Graham to try.

Each task says who should do it:

- **[Sonnet]** mechanical, with the design and the places in the code already settled here.
- **[Opus]** needs judgment while doing it (moving the scoring loop, Opening night, timing).

Tick a task's box in this file in the same commit that does it.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Its standing rules apply: plain writing with no em dashes, words first in a gig (no Lines,
   no Full), no ring controls, mid-song actions in thumb reach, keys stay on the phone, the AI never writes lyrics.
2. One task per commit. The commit message says what changed for Graham, in plain words.
3. Before each commit: `eslint .` and `node tests/quick.mjs`. Both must pass. Don't run the full suite here.
4. Before deleting anything, grep the name across every `.js`, `.html` and `.css` file, including template strings
   and `lazy("x.js").then(m => m.name)`. A use this plan doesn't mention: don't delete, write it under "Surprises".
5. A task that doesn't match what you find: stop that task, write it under "Surprises", move on. Don't improvise.
6. App files changed: at the end of each step bump the version once (`VERSION` in `core.js`, `CACHE` in `sw.js`),
   update the README feature list, `git fetch origin main && git rebase origin/main`, push.
7. A new `.js` file goes in `SHELL` in `sw.js`. Update the "Where things are" table in CLAUDE.md when a file's job changes.
8. When a step is done, tell Graham what to try and which model the next step wants.

## Decisions for Graham (answer before the step that needs them)

- **D1. Practice and tabs while playing** (Step 3). Tabs, a practice loop, a slowed section and Play together play on the
  same page but aren't scored. Show them the crowd strip without a score, or no strip at all?
  Recommended: no strip. The band, the lit chord and the dots still show where chords exist.
- **D2. The name** (Step 5). Does "the Gig" stay as the name for playing with the mic on (Tour, Opening night, README)?
  Recommended: keep it. Only the separate screen goes.
- **D3. The full-width band now** (Step 0). Graham asked on 2026-10-24 for the band on the line you're on to run the full
  width of the sheet, so the time after the words reads as empty space in the line. Ship it now in today's Gig as a
  small patch (4.49.14), or wait for Step 3, where it is built into the page? Recommended: ship now. The CSS rule
  carries over to the page band.
- **D4. Mockups first** (Step 1). Mock the four states on the mockup canvas before building: paused, playing with
  words, playing an intro (no words), playing a practice loop. Recommended: yes. It's the biggest change to the main
  screen since 4.0.0.
- **D5. Now and Next** (Step 2). With chord shapes moving to the chord chips and the new-chord card, the Now and Next
  setting (inline shapes while paused, big cards in a gig) has no job left. Retire it?
  Recommended: retire, and keep the stored field harmless (ignored).
- **D6. Back a line and Sheet** (Step 4). Both exist only because the Gig is a separate screen. On one page you drag the
  sheet or tap a section chip. Retire both? Recommended: yes.

## What the assessment found

Engineering:

- The Gig (`gig.js`) is a fixed layer over the song page. It keeps no copy of the song: `paintLines` clones lines out of
  the real `#sheet` every time the line changes, while the real page keeps scrolling underneath, unseen. `where()` reads
  that page's scroll (`diag.blocks`, `chordYs`, `pxPerSecond`). So one song is drawn twice and kept in step every frame.
- That copy layer costs about 250 lines: `paintLines`, `cloneOf`, `g.lineMap`, `bindDrag` (a proxy that scrolls the
  hidden page), `paintHold`, `backALine`, `leave` and the Sheet button. Drags broke on it in 4.49.13 (a redraw removed the
  touched line).
- The Gig's lines use their own type size (21px, the line you're on at 24px), so lines rewrap differently from the song
  page ("tricks" dropped onto its own line in Graham's screenshot, with its D floating above).
- Two play paths: the Gig (`canGig` in `app.js`) and plain scrolling (tabs, practice loops, Play together, and every test
  that sets `plainPlay`). Each has its own pause, count-in display and controls.
- The song page already has a playing look to build on: `body.playing`, the focus line `.cur` / `.cur2` and the dimming
  in `styles.css` (around "body.playing .sheet.focus"), `READ_AT = 0.4`, `updateDiagrams`, the song map `.smap`.

Design:

- Song page works: real chord spacing, section chips to jump, chord chips, Tools and Play in thumb reach.
  Fails: the paused chord shapes sit inside the lyrics and cover the next line's chords (G and D over "harbor lights"
  were hidden); nothing shows where you are once it moves.
- Gig works: the band on the line you're on, the lit chord with beat dots, the crowd, the stage colour per section.
  Fails: every line but the current one is dimmed to about a third, so you can't read ahead; the text jumps size; you
  must leave to see the song.
- They are one task in two states (reading, playing), not two places. Moving between screens breaks your place.

## The page Graham will get

Paused (the song page as it is, with three changes):

- Chord shapes leave the lyrics. Tap a chord chip and its shape shows in a card just above Play.
- The section chips stay and jump to a section.
- Pausing a song mid-way just shows this state again, with Play reading Resume. No pause card.

Playing (the stage, on the same page):

- The header and the chord chips slide away. The section chips shrink into the progress bar (one bar, two forms).
- The real sheet stays at the song's own text size and never rewraps.
- The line you're on sits on a band in the section's colour, edge to edge across the screen. Lines ahead stay at about
  70% so you can read ahead; lines behind fade.
- The chord you're on lights with its beat dots (the 4.49.10 to 4.49.11 rules: only the current chord is lit, the next
  one lights when the dots reach it).
- A thin strip at the top: X, the progress bar, the section, the crowd and the combo. At the bottom, in thumb reach:
  the mic and Pause.
- The stage colour washes in for each section.
- One Play for everything. Unscored play (mic off, tabs, practice, Play together) is the same page without the score
  strip (per D1).

Kept exactly: scoring and grading, the combo, the crowd, Show complete, Opening night's steps, the band and its timing,
the beat dots' timing, Tools.

## Steps

### Step 0. The full-width band in today's Gig (only if D3 says now) [Sonnet], patch 4.49.14

- [ ] 0.1 In `styles.css` (the "The lines (4.49.7)" block near the end): `.gg-lines` gets `margin: 0 -16px` and
      `align-items: stretch`; `.gg-lines > *` gets `padding: 4px 16px 7px 30px`, `border-radius: 0`, `align-self: stretch`,
      `box-sizing: border-box`, `text-align: left`, `justify-content: flex-start`; `.gl-now` keeps its tint and swaps the
      all-round inset border for a top and bottom line only. Text stays where it is (30px from the edge).
- [ ] 0.2 Test in `gig.e2e.mjs`: the `.gl-now` box is the screen's width, for a line of words and for a chord-only intro row.
      Graham saw a short centred box on his phone (iPhone, 2026-10-24) that a 390px test screen doesn't show: take a
      throwaway screenshot at 402px and at 430px wide to check.

### Step 1. Mockups (only if D4 says yes) [Opus], no release

- [ ] 1.1 On the mockup canvas (the Design artifact), a new row "One page": paused, playing with words, playing an intro
      (no words), playing a practice loop, in the Neon Midnight palette, plus paused in Festival Poster. Use Harbor Lights
      (the sample song) so it matches Graham's screenshots.
- [ ] 1.2 Stop for Graham's go. His changes go into "The page Graham will get" above before Step 2 starts.

### Step 2. Chord shapes out of the lyrics [Sonnet], 4.50.0

Independent of the rest, and it fixes the hidden chords Graham saw.

- [ ] 2.1 Paused, tapping a chord chip (the CHORDS row) shows that chord's shape in a card just above the Play bar,
      in thumb reach. Tap again or tap away to close.
- [ ] 2.2 Remove the paused shapes drawn inside the sheet (`applyPaused` and its rows under "Paused: the line at the
      reading point gets its diagrams" in `app.js`), and their CSS.
- [ ] 2.3 If D5 says retire: the Now and Next row leaves Tools; `data.settings.diagrams` is ignored (leave the field
      alone in `cleanSong`/settings so old backups load); `bigc` in `gig.js` goes. Update `docs/DATA.md`.
- [ ] 2.4 Tests: a chord chip opens and closes its shape; nothing overlaps the sheet while paused. README, ONBOARDING.md.

### Step 3. The stage on the song page [Opus], 4.51.0

The lines, the band, the lit chord and the dots move onto the real sheet. The Gig's top strip and bottom buttons stay
for now, over a see-through middle.

- [ ] 3.1 New file `stage.js` (add to `SHELL`): `where(song)`, `chordYs`, `paintLit` and the beat-dot logic move here
      from `gig.js`, unchanged in behaviour, working on `#sheet` instead of clones. `gig.js` imports them.
- [ ] 3.2 Playing look on `body.playing`: the head, `.meta`, the chips row and the chord chips slide away (not just dim:
      today's rules at "body.playing .app.viewer > .head" set them to .35). The sheet keeps `song.size`.
- [ ] 3.3 The band: the line at `READ_AT` gets the band in the section's gel, full screen width (the Step 0 rule, moved
      to the sheet). Ahead about .7, behind about .35. This replaces the `.cur` / `.cur2` focus dimming (.38 today).
- [ ] 3.4 The lit chord and the beat dots draw on the real sheet's chord (`.c`), using `runDot`, `beatsBetween`,
      `onBeat` from `core.js` as now. Only the current chord is lit (4.49.11).
- [ ] 3.5 `gig.js`: `#gg-lines` is no longer drawn; `paintLines`, `cloneOf`, `g.lineMap` and the clone-only CSS go.
      The middle of `.gig` becomes see-through and lets touches through to the page, so dragging scrolls the real sheet
      and `bindDrag` goes.
- [ ] 3.6 Stage colour: `data-gel` moves from `#gig` to `body` while playing, so the page washes into the section.
- [ ] 3.7 Tests: `gig.e2e.mjs` checks for `.gl-now` and `#gg-lines` move to the sheet's band and lit chord; the 4.49.10
      dots test keeps its timing checks. Check the count-in still shows.

### Step 4. One page: the Gig layer goes [Opus], 4.52.0

- [ ] 4.1 The top strip (X, progress, section pill, crowd, combo) and the bottom pair (mic, Pause) become part of the song
      page while playing, built by `stage.js`. The mic and Pause sit where Tools and Play sit when paused, so the thumb
      doesn't move.
- [ ] 4.2 The scoring loop (`listen`, `deafen`, `frame`, `gradeDue`, `flash`, `paintScore`) moves into `stage.js` or
      stays in a much smaller `gig.js` that only scores and draws Show complete. Opus decides which, by what reads simpler.
- [ ] 4.3 Pause shows the paused page: Tools and Play (reading Resume), in place, at the line you stopped on. `gg-hold`,
      `paintHold`, `backALine`, `leave` and the Sheet button go (per D6). `gigHooks.resume`, `.stopped`, `.leave` follow.
- [ ] 4.4 `fold.js`: while playing, the bar folds into Play's corner today. On one page the bottom pair replaces it.
      Decide with the no-ring rule in CLAUDE.md in mind; don't bring back the ring, the arc or the island.
- [ ] 4.5 Opening night (`opening.js`: `gigOpen`, `gigFrame`, `gigPaused`, `gigResumed`, `gigDoneHere`, `hideStrip`) points at
      the page instead of `#gig`. Louie's hint on pause shows above Play when `gigPaused` returns text.
- [ ] 4.6 One Play: `canGig` / `gigsOn` / `playGig` / `openGigNow` in `app.js` decide only whether the play is scored.
      Tabs, practice loops, a slowed section and Play together use the same page, with the strip or not per D1.
- [ ] 4.7 Delete `#gig`'s shell markup and the CSS under "the Gig" and "The Gig, words first" that nothing uses now.
- [ ] 4.8 Tests: rewrite `gig.e2e.mjs` and `opening.e2e.mjs` for the page; the tests that set `plainPlay` keep working or
      move to the mic-off path. Update CLAUDE.md's table (`gig.js`, `stage.js`, `fold.js`) and the "Tests" notes.

### Step 5. Section chips as the progress bar [Sonnet], 4.53.0

- [ ] 5.1 While playing, the section chips (`.smap`) shrink into the progress bar at the top: the same sections, same
      gels, thin, with a mark at where you are. Paused, they grow back into chips.
- [ ] 5.2 Tapping a section in the bar mid-song jumps there (`openAtSection`), and grading skips the jump like a drag does.
- [ ] 5.3 Tests for both. README.

### Step 6. Clean-up [Sonnet], patch

- [ ] 6.1 README: one "Playing a song" section in place of the song page and Gig sections; the name per D2.
- [ ] 6.2 `docs/ONBOARDING.md`: rows for the Gig's pause, Back a line, Sheet and Now and Next updated or removed; new rows
      for chord-chip shapes and tapping a section in the bar.
- [ ] 6.3 `docs/DATA.md`: any settings retired in Steps 2 and 4.
- [ ] 6.4 Ask Graham whether to remake the visual references (`screens.yml`), since every play screen changed.
- [ ] 6.5 Move this file to `docs/history/`.

## Surprises

(none yet)
