# Chord Catch: scored on the chord, not the timing (4.54.0)

Written by Opus, 2026-10-24, for Sonnet to run. Mockups: the "The Road: Chord Catch" canvas (A the show,
B Wait for me, C Show complete, D the paused song page). Built on a branch, merged to main as one release,
so it can be rolled back in one step.

## Why

Timing has fought us at every step (4.46.0 to 4.53.1): a phone mic can't judge timing against a song whose
pace is itself a guess, so every timing rule felt unfair. The game now asks one question the phone can answer
well: did you play the right chord? It listens only for the chord you're on and the next one, a yes or no
against one or two shapes, which is fast and forgiving, so quick changes can be caught.

## What Graham decided (2026-10-24)

- Remove the beat dots, the lit chord, EARLY and LATE, the on-beat star, Score the timing, and the section bar
  over the stage (the show's and unscored play's). Keep the band on the line you're on.
- A chord caught turns green and stays green. A missed one stays plain; no red, no snapped string.
- Bigger crowd; a slightly brighter stage; the light is one cone from the lamp, ending above the band.
- Wait for me, in this release. The song you played (on Show complete), in this release.
- The chords row on the paused song page becomes shape tiles. The section chips there stay.
- Accessibility: caught is shown by more than colour (see Step 8).

## Defaults set by Opus (Graham can change them; ask only if one turns out wrong in use)

- D1. Strings retire from the show (they only ever counted misses). The top row shows the run instead
  ("14 in a row"). `gigStart` may keep the field for old saves; nothing draws it.
- D2. Missed chords: in the show, plain in a muted ink that still reads (at least 4.5:1); on Show complete,
  outlined chips. Caught is green with a bar under the letters in the show, and a filled green chip on
  Show complete. One meaning everywhere: green and marked is caught.
- D3. Wait for me shows give fans for chords caught but are practice: no Charts XP, no rival battle, no duel
  answer, no `gig.best` (pct is null for those), and they count as practice time like Practice mode.
- D4. Wait for me needs the microphone and no recording (the band or auto-scroll only). With a recording
  linked it is off and says why in Tools.
- D5. Sheets whose chords are a guess (`spots: "guess"`, 4.41.0): a missed chord there is never counted
  (as today), only caught ones.

## Branch and rollback

- Step 0 tags the current main `v4.53.1` and makes the branch `chord-catch`. Every step commits there, one task
  per commit, `eslint .` and `node tests/quick.mjs` before each push of the branch (`git push origin chord-catch`).
- No version bumps on the branch until Step 9; the release is 4.54.0.
- Step 9 merges with `git merge --no-ff chord-catch` onto main and pushes. To roll back later:
  `git revert -m 1 <merge sha>`, then bump to 4.54.1 (VERSION and CACHE) so phones drop the 4.54.0 cache, and
  push. The branch stays on GitHub for another try (the sandbox can't delete branches; Graham does that).
- `tests/quick.mjs` compares with `origin/main`, so on the branch it runs the browser tests for every file the
  branch changed. That is the right set.
- In this sandbox the browser tests need `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
  (Playwright's own browser build is missing). Set it on each command.

## Steps

### Step 0. Branch [Sonnet]

- [ ] 0.1 `git fetch origin main && git checkout main && git rebase origin/main`; `git tag v4.53.1 && git push
      origin v4.53.1`; `git checkout -b chord-catch`. Move this plan into the branch's first commit if it is not
      already on main.

### Step 1. Take out timing, the dots, the lit chord and the section bar [Sonnet]

- [ ] 1.1 `stage.js`: remove the dots (`paintLit`'s run, `stageDots`, `stageRun`, `st.run`, `st.k`, `st.until`,
      the drag-repaint check), the `.st-lit` lit chord, and `beatOf` if nothing else uses it. Keep the band
      (`st-now`, `st-past`, `st-next`), the repeat mark (`st-rep`), the gel and the light.
- [ ] 1.2 `stage.js` and `gig.js`: remove the song map over the stage (`stageMapHTML`, `stageMapTap`,
      `stageMark`, `#st-map`, `.gg-map`, the `stage-jump` event). `jumpToSection` in `app.js` stays (the right-edge
      rail uses it).
- [ ] 1.3 `core/game.js`, `core.js`: remove `RUN_MAX`, `beatsBetween`, `runDot`, `splitBeats`, `onBeat`, `gigChange`,
      `gigTiming`, `GIG_WINDOW`, `GIG_LATE` and `gigChord` once Step 3 replaces them (do 1.3 with Step 3 if
      removing them first breaks the build). Keep `beatsLate` (the band uses it).
- [ ] 1.4 Score the timing: remove the switch (`settings.js` `#s-time`), the default in `core.js`, and drop
      `settings.gigTime` from saves when they load (as `gigLines` is dropped). DATA.md: retired.
- [ ] 1.5 `gig.js`: remove `flash`'s EARLY, LATE and star (`#gg-tw`), and the stars line on Show complete.
- [ ] 1.6 CSS: remove `.gc-run`, `.st-lit`, `.gg-map`/`.st-map`, `.gg-tw` rules.
- [ ] 1.7 Tests: delete the tests for what went (4.49.10 dots, 4.53.0 map tap, 4.53.1 carry, the Score the
      timing test, the unit tests for the removed functions). Keep the band test (4.49.14).

### Step 2. The catch, pure and tested [Sonnet]

In `core/game.js` (re-exported from `core.js`), next to `gigStart`:

- [ ] 2.1 `catchTargets(seq)`: the chords to catch, from `diag.seq` names: one target per run of the same chord
      (a chord repeated in a row is one target, as it shows once). Each target: `{ name, first, last }` (seq
      indices of the run).
- [ ] 2.2 `catchOpen(targets, idx)`: which targets can be caught when the chord you're on is seq index `idx`:
      the target you're on and the next one (a chord can be caught from the moment it is next until the chord
      after it starts). Returns target indices.
- [ ] 2.3 `catchHear(state, targets, idx, chroma)`: given one reading (a chroma, 12 numbers), score it against
      the open, uncaught targets with `strumFit` (`core/neck.js`). The best fit at or over `CHORD_FIT` is a
      candidate; it must be the best candidate on two readings in a row (`state.cand`, `state.n`) to be caught.
      Catching a target also closes any earlier open target (missed if not caught). Returns the target caught
      or -1. No chroma (silence) resets the pair. A chord with no shape (`strumFit` null) can't be caught by
      sound; it is caught when its window closes if anything was heard in it (a quiet room never costs a
      chord, as 4.46.0 did).
- [ ] 2.4 `catchClose(state, targets, idx)`: targets whose window has closed (the chord after them has started)
      and weren't caught are missed. Returns them, each once.
- [ ] 2.5 The score: replace `gigApply` with `catchScore(g, hit)`: hits, misses, combo, best, `last` (for the
      crowd, the last 12 targets). No strings change (D1), no offsets, no stars. `gigCrowd`, `gigPct`, `gigFans`
      (1 a chord caught, 5 for every 10 in the best run, 10 for a crowd of 10 or more; no stars) read it.
- [ ] 2.6 Unit tests in `tests/core.test.mjs`: runs merge; the window (next and current only); two readings in a
      row needed; C heard while on Am does not catch Am (fit below CHORD_FIT) and does catch C when C is next;
      catching the next one closes the one you're on as missed; silence resets; a chord with no shape; the score
      and fans. Make chroma vectors from the chord's notes the way existing `strumFit` tests do.

### Step 3. Listening for the catch [Sonnet]

`gig.js`:

- [ ] 3.1 Read continuously, not only after a strum: every 50 ms, when the level (`rms`) is over the strum
      detector's floor, read the spectrum (`sp`, the 16384 analyser already there) into `chromaOf` and call
      `catchHear`. Keep `strumDetector` only to know something was heard in a window (for chords with no
      shape). Reading every 50 ms is the cost to watch: if the frame rate drops on a phone, try 80 ms and say so
      under Surprises.
- [ ] 3.2 In `frame()`, when the chord you're on changes, call `catchClose` and score the misses (not while
      dragging, as today with `g.dragUntil`, and not on a guess sheet, D5). Remove `g.due`, `gradeDue`,
      `g.strums` as the scoring path.
- [ ] 3.3 A catch: `catchScore`, mark every chord element of that target's run `st-got` (stays) and the first one
      `st-pop` for 600 ms. The paint lives in `stage.js` (`stageCatch(targetIdx)`), which also re-applies
      `st-got` from the caught set when the sheet is redrawn (`st.seq` changes). `g.missed` and `g.landed`
      (Rehearse) are kept from target pairs: `prev>name`.
- [ ] 3.4 Milestones (combo callouts, Louie, the crowd) keep working off the new score.
- [ ] 3.5 Opening night (`opening.js` hooks) still advances: check its "play a verse" and "first show" steps
      don't depend on `g.due` or `gigChord`; if they do, move them to the catch and note it under Surprises.

### Step 4. The look [Sonnet]

Mockup A.

- [ ] 4.1 Caught: a `--got` colour per palette (Neon Midnight about #7EE6A0; Festival Poster a deep green that
      passes 4.5:1 on its ground; Green Room a mint or white-green that stands apart from its green ground) with
      a 3 px bar under the letters. Missed (passed, not caught): `--muted` ink at 4.5:1 or better. Ahead: the
      section colour, as today. `st-pop`: a short scale and ring; none under Reduce Motion.
- [ ] 4.2 Top row: X, the section pill, and the run on the right ("14 in a row" with a check), replacing the song
      map and the strings. The crowd moves to its own row under it, across the full width, fans about twice
      today's size, standing fans with hands up as now.
- [ ] 4.3 The next chord's shape card (`paintShape`): show the NEXT target's chord when it is one you haven't
      learned (today it shows the current one). Labelled NEXT. Low on the right, as now.
- [ ] 4.4 The stage light (`.st-bg`, `.st-lamp`, `.st-beam`): about 10% brighter, and one cone from the lamp
      (a `clip-path` trapezoid with a top-to-bottom fade) that ends above the band, so it never sits on the words
      you are reading. No separate round glow.
- [ ] 4.5 Unscored play (no mic): the band and the light only; no green, no crowd.

### Step 5. Wait for me [Sonnet]

Mockup B.

- [ ] 5.1 A switch in Tools > Play, "Wait for me", saved per song (`song.waitForMe`), on by default for a song
      marked learning. Off and greyed with a recording linked, with the line "Plays with the band or the scroll,
      not a recording" (D4). Needs the microphone: if the mic is off, the show starts listening when it is on.
- [ ] 5.2 The hold: when the next target's chord reaches the reading line (`where()`'s next chord position) and
      it isn't caught, stop the scroll (and the band) on that line. The waiting chord gets a soft ring
      (`st-wait`). A card above the controls says "Waiting for G" and "The song moves on when you play it",
      with the shape. Catching it releases the hold at once and the song goes on from there.
- [ ] 5.3 "Skip this chord" in the bottom row (in thumb reach, beside Pause) releases the hold; the chord counts
      as missed.
- [ ] 5.4 The top row shows "6 of 9" (caught of passed) instead of the run, and the section pill reads
      WAIT FOR ME beside it.
- [ ] 5.5 Scoring per D3. `gigDone` takes a `practice` flag that skips Charts, battles, duels and `best`.
- [ ] 5.6 "Waiting for G" is in a polite live region, said once per hold.

### Step 6. Show complete: the song you played [Sonnet]

Mockup C.

- [ ] 6.1 The title line: "34 of 40 chords", the song and the best run; fans as now.
- [ ] 6.2 "The song you played": each section (name in its colour) with its targets in order as chips, filled
      green for caught, outlined for missed (D2). Scrolls if long. Each chip has an `aria-label` ("G, caught").
- [ ] 6.3 "Missed most": the pair missed most this show (from `g.missed`), "G to C, 3 times", with Practice it,
      which opens Rehearse's switch drill for that pair (`#/practice/<id>`; find how a pair maps to the drill's id
      from `changesToWork` / the Rehearse rows). If no drill exists for the pair, leave the button out.
- [ ] 6.4 Keep everything else on the page (battle, duel, quests, joined band) below, and Encore and Challenge
      a friend at the bottom.

### Step 7. Shapes on the paused page [Sonnet]

Mockup D.

- [ ] 7.1 The chords row (`CHORDS` chips on the song page) becomes shape tiles: the name over a small diagram
      (`chordSVG` from `app.js`), scrolling sideways, 44 px tall or more. Tapping one does what a chip does today
      (the shape card above Play and marks everywhere it's played). The section chips stay as they are.
- [ ] 7.2 Each tile's `aria-label`: "F chord shape".

### Step 8. Accessibility check [Sonnet]

- [ ] 8.1 A small script (throwaway, not committed) that computes contrast for `--got` and the missed ink against
      each palette's ground and the band's colour, all three palettes. Every one at 4.5:1 or better; fix the
      tokens until they pass.
- [ ] 8.2 Caught is never colour alone: the bar under the letters (show) and filled vs outlined (Show complete).
- [ ] 8.3 Reduce Motion: no pop, no pulsing ring on the waiting chord, no crowd jump.
- [ ] 8.4 The a11y test (axe) passes on the show, Show complete and the paused song page.

### Step 9. Tests, docs, release [Sonnet]

- [ ] 9.1 `tests/e2e/gig.e2e.mjs`: a show with a fake mic (the `FAKE_MIC` harness) that plays the right chord's
      notes: the chord turns `st-got` and stays; a wrong chord does not; a target passed silent is missed and
      plain. Wait for me: the scroll stops on an uncaught chord and moves on when it is caught; Skip moves on
      and counts a miss. Show complete lists the song you played. The paused page shows shape tiles. Check how
      `FAKE_MIC` makes notes (`window.__hz`); if it can only make one pitch, extend it to play a chord's notes
      and say so in the commit.
- [ ] 9.2 README "Playing a song" rewritten for the catch; ONBOARDING.md (the dots row goes, the section bar
      rows go, Wait for me added with its coverage, the shape tiles); DATA.md (`gigTime` retired,
      `song.waitForMe`, what `gig.best` means now).
- [ ] 9.3 Bump to 4.54.0 (VERSION and CACHE), commit on the branch, then merge (Branch and rollback, above),
      quick run, push main.
- [ ] 9.4 Screenshots for Graham of A, B and C from the real app (throwaway `zz_` test to `$SHOT`, then delete).
- [ ] 9.5 Move this file to `docs/history/`.

## Things to watch

- C and Am, G and Em share notes. Listening only to the open targets (the one you're on and the next) is what
  keeps this fair; don't widen it to every chord.
- A chord still ringing from the last change must not catch anything: it can only fit the target it already
  caught, which is closed. If a test shows otherwise, stop and write it up.
- The two-readings rule is about 100 ms. If quick changes are missed on Graham's phone, the next lever is one
  reading with a higher fit bar, not a longer window.
- Wait for me stops the scroll; the music clock does not run when there's no recording, so the band must stop
  with it and start on the next beat when released.

## Surprises

(none yet)
