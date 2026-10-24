# Beat dots that carry onto the next line (4.53.1)

Written by Opus, 2026-10-24, for Sonnet to run. One release, a patch (the defect was found in 4.53.0).

## The problem (Graham's screenshot, Harbor Lights)

The line "That you never call home" has G, then F. The next chord, Am, is on the next line, a few beats in.
Today `paintLit` in `stage.js` spreads F's dots from F to the right edge of its own line, so F looks as if it
ends at the edge, and the beats on the next line before Am are never drawn. The last dot lights, then the
change comes beats later.

## The fix, agreed with Graham

Split the chord's beats by time, at the moment the band moves down a line.

- The beats from the chord to the band's move are drawn on the chord's own line (as today, out to the edge).
- The beats from the band's arrival on the next line to the next chord are drawn on that line, from where its
  words start to just before the next chord.
- If the next chord is more than one line down, each line in between gets the beats it holds, full width.
- The count across all the rows is the beats the chord lasts (`beatsBetween`, capped at `RUN_MAX` in total).
- The lit dot travels across the rows in order: the last dot of the chord's line, then the first dot of the
  next line, on the beat.
- Dots on a line the band has not reached yet are faint; they go full when the band arrives.

Why by time and not by spacing: the band's move is already timed (it moves when a line's top crosses the
reading line, `READ_AT`). Splitting at that time makes the dots say two true things: when the line turns and
when the chord changes. Even spacing would guess.

## Decisions for Graham

None open. He chose the time split over the even-spacing wrap and over a ghost of the next chord at the end
of the band. The faint-until-reached look is part of the agreed fix; change it only if he says so.

## Steps

### Step 1. The maths, pure and tested [Sonnet]

- [ ] 1.1 In `core/game.js`, next to `beatsBetween` and `runDot`, add
      `splitBeats(beats, moves, untilNext, spb)`:
      `beats` is the chord's beats, `moves` the seconds from now until the band reaches each later line up to
      the next chord's line (ascending, may be empty), `untilNext` the seconds until the next chord.
      Return an array of counts, one per row (the chord's line first), summing to `beats`. Each row after the
      first gets `round((end - start) / spb)` beats, where start is that line's move and end is the next
      line's move or `untilNext`; rows are clamped at 0 and the first row takes what is left (at least 0).
      If `spb` is not above 0 or `moves` is empty, return `[beats]`.
- [ ] 1.2 Re-export it from `core.js` (the `game.js` import and export lists, both).
- [ ] 1.3 Unit tests in `tests/core.test.mjs`: one move (F lasts 8 beats, the band moves at beat 5, so `[5, 3]`);
      no moves (`[8]`); two moves (a line in between gets its beats); the band moving after the change
      (`[beats]`); rounding never giving more or fewer than `beats` in total.

### Step 2. Draw the rows [Sonnet]

In `stage.js`, `paintLit`:

- [ ] 2.1 Find the rows: the chord's row (`cur.closest("#sheet > *")`) and the next chord's row
      (`nx.closest("#sheet > *")`). If they are the same, draw as today and stop. Otherwise list the line
      blocks from the chord's row down to the next chord's row, using `diag.blocks` and `isLine` (skip section
      labels and blank rows).
- [ ] 2.2 The times: for each later line, seconds until the band reaches it,
      `(sheetTop + block.y - innerHeight * READ_AT) / pxPerSecond(song)`; `paintLit` needs `song` passed in
      from `stagePaint` (it gets `w` and `spb` today; add `song` to `stagePaint(w, spb, song)` and its call in
      `stageTick`). `untilNext` is `w.until`. Call `splitBeats`.
- [ ] 2.3 Draw: the first row from the chord's right edge to the row's right edge (as today). Each later row
      from the left of its words (the left of its first `.ct` or its text, whichever is further left) to
      `nt.left - 10` on the next chord's row, or the row's right edge on a row in between. Same spacing rule
      as today (at least 16 px a dot); with too little room, the row shows its last dots (as today).
      Each row gets its own `<span class="gc-run">`; the later ones also get `carry`.
- [ ] 2.4 `st.run` keeps the total `beats` and a flat list of every dot in order across the rows (not one
      `el`). `stageDots` lights by index into that list, so the lit dot steps from the end of one row to the
      start of the next. Keep the "fewer dots shown than beats" rule working per row: a row that shows fewer
      dots than its beats skips its first ones, so the list needs a placeholder (or an index map) for the
      beats that have no dot.
- [ ] 2.5 Repaint: today the dots are drawn once when the lit chord changes. The band's move times only change
      if the page is dragged or the layout changes; a drag already resets `st.lit` through the redraw path
      (check), and a new layout resets through `st.seq`. If a drag does not repaint, mark `st.lit = -2` on
      the drag (gig.js `g.dragUntil` and the unscored path) so the split is worked out again.
- [ ] 2.6 Fallback: when `pxPerSecond(song)` is 0 or not a number (nothing scrolling), draw as today on the
      chord's row only.

### Step 3. The look [Sonnet]

- [ ] 3.1 `styles.css`, by the `.gc-run` rules: `.gc-run.carry i` at about half the dot's normal strength;
      on the band's line (`.st-now .gc-run.carry i`) full strength. The lit dot (`.on`) is always full.
- [ ] 3.2 Keep `body.held .sheet .gc-run { display: none }` covering the carried rows (it should, by class).
- [ ] 3.3 Reduce Motion: no new animation; the change from faint to full is instant there.

### Step 4. Tests, docs, release [Sonnet]

- [ ] 4.1 `tests/e2e/gig.e2e.mjs`: a sheet where a chord sits late in one line and the next line's first chord
      is mid-line (Harbor Lights' "That you never call home" pattern). Check: dots on both rows; the total is
      the chord's beats (within the cap); the later row's dots end left of the next chord; the later row is
      `carry`; the lit dot reaches the later row before the change. Wait on the thing checked, not a sleep.
- [ ] 4.2 A same-line case still draws one row (the 4.49.10 test should still pass unchanged).
- [ ] 4.3 README "Playing a song", the chord-you-are-on bullet: the dots carry onto the next line when the
      next chord is there, faint until the band reaches it (4.53.1).
- [ ] 4.4 ONBOARDING.md: no change (the dots are not a new hidden feature); confirm and tick.
- [ ] 4.5 Bump to 4.53.1 (`VERSION` in `core.js`, `CACHE` in `sw.js`). `eslint .`, `node tests/quick.mjs`,
      commit in plain words, rebase, push. Move this file to `docs/history/`.
- [ ] 4.6 One screenshot of the Harbor Lights line for Graham (throwaway `tests/e2e/zz_*.e2e.mjs` to `$SHOT`,
      then delete it), since the change can't be judged without seeing it.

## Things to watch

- `where()` already works out `until` from the music clock when a recording plays, but the band's moves are
  from the page position. Both follow the same scroll, so they agree; if a test shows the lit dot reaching
  the next row early or late with a recording, write it under Surprises and stop.
- With the band playing, `stageTick` snaps `until` to the band's grid (`onBeat`). The split uses the unsnapped
  times; the lit dot uses the snapped one. That is fine as long as the counts sum to `beats`.
- The new-chord card sits low on the right; check the carried dots on the next row don't run under it.

## Surprises

(none yet)
