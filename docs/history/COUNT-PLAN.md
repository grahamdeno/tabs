# Plan: even bands on wordless lines, and Louie's count-in (4.56.0)

Written by Opus, 2026-10-24, from Graham's two screenshots (an intro row's band shorter than a sung line's;
the 4.55.0 opening card showing FIRST and THEN shapes above a "Strum: D-DU-UDU" line that holds the band).
One release. No mockups (Graham: not needed). Run with Sonnet.

## Decisions for Graham (defaults set; change any before Sonnet starts, or after trying it)

- D1. A wordless line is as tall as a sung line everywhere, paused and playing, not only on the stage.
  Why: if it only grew on Play, the page would jump when Play starts and every timing worked out from the
  layout would shift under the band. Side effect: an intro or solo row takes a little more time when the page
  scrolls by its length, which is closer to a bar of music than today's short row.
- D2. Louie does not count on his fingers. One finger up can read as the middle finger (louie.js already
  forbids a lone straight finger). He bounces on each beat beside a big number instead, and throws horns up on
  the last beat.
- D3. The card keeps one small line under the count: "First: F" (the chord the show listens for first) and
  the strum pattern when the sheet has one ("Strum: D-DU-UDU"). The FIRST and THEN shape tiles go.
- D4. No count-in (Settings count-in off, or starting from mid-song): no card. The song starts moving at once,
  so the space fills itself.
- D5. The gig's COUNT IN pill at the top stays as it is.

## Why (design notes)

- Even bands: the band marks "the line you are on" by its edges. A short band on an intro row reads as a
  different kind of thing, and the next band jumps in height. A steady height keeps the eye's rhythm and leaves
  the empty lyric slot as space, which is honest: nothing is sung there.
- Notes are not lines you play. In the screenshot the band sits on "Strum: D-DU-UDU" at the start. The band,
  the reading line and Chord Catch should start on the first playable line. The strum pattern is still useful,
  and the count-in is the moment you need it, so it moves into the card (D3).
- The count-in is a timing moment, not a reading moment. Shapes were already shown on the paused page as
  tiles a second earlier, and the chord-shape card covers an unlearned chord during the song. A big number
  you can read from arm's length, with Louie on the beat, does one job well.
- Louie on the beat must be exactly on the beat: change his pose from the count-in's own tick, never from a
  CSS animation running on its own clock. Reduced motion: no bounce, the number only.
- Accessibility: the number is not announced beat by beat (the click is heard). The card is one image labelled
  "Count in, 4 beats". The number has 4.5:1 contrast on all three palettes.

## Steps

### Step 1. Even bands on wordless lines [Sonnet]

- [ ] 1.1 Find how a chord-only line is built (`.crow` in app.js render, and a `.pr` with no words if that
      exists). Give it an empty lyric slot the same height as a sung line's lyric (the same font and
      line-height, so it follows Text size). Do it in the sheet's normal styles, not under `body.staged` (D1).
- [ ] 1.2 Check the band: top and bottom edges the same distance apart on a wordless line as on a sung line,
      with the chord letters on top and the empty slot below.
- [ ] 1.3 Check nothing else leans on the old height: `chordYs` in stage.js, `chordTimes`, the intro row spread
      across the width (4.51.0), the iPad rail. Run the stage and gig tests.
- [ ] 1.4 Test: on a song with an intro row, the `.st-now` band's height on the intro row equals its height on
      a sung line (within 2 px).

### Step 2. Notes are not the line you're on [Sonnet]

- [ ] 2.1 Find how a header note like "Capo 2 · Strum: D-DU-UDU" is drawn (core.js around `head` at line
      ~1208 builds it). Mark that element so `isLine` in app.js treats it as not a line (like `.sec` and `.gap`).
- [ ] 2.2 Check the band, `where()`, the reading line at the start and Chord Catch's first target all begin on
      the first playable line. The note still shows on the page, plain.
- [ ] 2.3 Test: a song whose sheet starts with "Strum: D-DU-UDU" puts the first `.st-now` on the first chord
      line, never on the note.

### Step 3. Louie's count-in [Sonnet]

- [ ] 3.1 In stage.js, `stageOpen(song, beats)` draws: Louie (`louie("happy", { size })` from louie.js) beside
      a big number (the beat, 1 to `beats`), and under them one small line: "First: F" and, if the sheet has a
      strum pattern, "Strum: D-DU-UDU" (D3). Remove the FIRST and THEN tiles and the beat dots.
- [ ] 3.2 `stageBeat(n)` sets the number and moves Louie: a small bounce class added and removed per beat
      (restart the animation the way `countIn` does with `void el.offsetWidth`). On the last beat, Louie's
      `hornsUp` pose (D2). Never a finger count.
- [ ] 3.3 Draw the card only when there is a count-in (D4): `stageOpen` is called with `beats > 0` only.
- [ ] 3.4 Size: the number about 64 px, Louie about 96 px; in the tight layout (under 200 px of room) Louie 64 px
      and the number 48 px in one row, the small line kept. Under 96 px of room: no card, as now.
- [ ] 3.5 Accessibility: the card `role="img"`, `aria-label="Count in, 4 beats"`; Louie and the number
      `aria-hidden`. Reduced motion: no bounce (the number still changes). Check the number's contrast on the
      three palettes with the throwaway script from the Chord Catch work (4.5:1 or better).
- [ ] 3.6 The plain `.countin` number stays hidden while the card shows (4.55.0 already does this).
- [ ] 3.7 Tests: update the 4.55.0 opening card test (no `.so-ch`, a number that steps 1 to 4, Louie present,
      "First:" and the strum line); a test that with count-in off there is no `#st-open`. Keep the a11y test
      for the gig passing.

### Step 4. Release [Sonnet]

- [ ] 4.1 README: the opening card paragraph becomes Louie's count-in; a line on even bands for wordless
      lines; notes aren't the line you're on. ONBOARDING.md row 9 updated.
- [ ] 4.2 Bump to 4.56.0 (VERSION in core.js, CACHE in sw.js). `eslint .`, `node tests/quick.mjs`, fetch and
      rebase, push `main`. Commit message in plain words for Graham.
- [ ] 4.3 One screenshot for Graham of the count-in card on the gig at 390 px (throwaway `zz_` test, then
      delete it), since this is a visual change he'll judge by eye.
- [ ] 4.4 Move this file to `docs/history/`.

## Things to watch

- Step 1 changes the page's height on any song with wordless rows. If a test pins a page height or a line's
  position, update it and say why in the commit.
- If the header note is also how the capo is shown, keep it visible; only its status as a line changes.
- Louie's pose change per beat redraws an SVG; set `innerHTML` only on the beat, not per frame.

## Surprises

(none yet)
