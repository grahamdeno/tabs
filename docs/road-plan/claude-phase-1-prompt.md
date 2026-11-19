# HANDOFF FOR CLAUDE OPUS: Louie Product chat, the Road plan phase 1 (tours data, the Song ladder, readiness), in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging waits for Louie Review's review and Graham's merge go.
- Do not push to `main`, `next`, `road-ready`, `rr-11-plan` or any other existing branch (including `rr-09-merch`, `rr-09-art`, `rr-09-wire`, `rr-09-neck`, `rr-09-road`, `rr-09b-art`, `rr-10-louie-art`). Push only to your new branch `rr-11-road-plan`.
- Do not open a pull request into `main` or `next`. A push or merge to `main` publishes the live app on GitHub Pages.
- Do not run or dispatch any workflow on CLAUDE.md's upload and deploy list (`screens.yml`, `vendor-bp.yml`, `bump-version.yml`). Opening the PR starts the repo's test check on its own; that is fine.
- Do not force-push. Do not delete, rename, archive or transfer any file, branch or repo.
- Do not bump `VERSION` or `CACHE`. Do not deploy a Worker, upload to the App Store or TestFlight, or touch Vercel, Cloudflare, GitHub settings, secrets or any account.
- Do not edit `docs/road-plan/ROAD-PLAN.md`. Put anything you would change under "Surprises".
- If a step seems to need any of these, stop and ask Graham.

**Read first:** grahamdeno/playbook (version 1.4.0): rules.md, roles.md, sonnet-trust.md, standards/testing.md and standards/design.md. Then CLAUDE.md in grahamdeno/tabs (it still says playbook 1.3.0; follow 1.4.0 and note it in the PR), and the plan, `docs/road-plan/ROAD-PLAN.md`, on branch `rr-11-plan`. Read the whole plan before you start.

**Why this goes to you (Opus, Louie Product):** this work adds stored data (`data.ladder`, `data.mastery`, `skills.passed`) and changes `cleanSkills`, which the playbook and CLAUDE.md treat as data safety and always-review work. The plan was written by Grok, not shaped by Opus, so it is not yet a Ready handoff for Louie Build.

**Before you build:** check the plan and this prompt against the Ready check in `sonnet-trust.md` (every criterion testable, open questions answered, Touch area named). Graham approved the plan and the decisions below on 2026-11-19. If something is still not Ready, stop and list what is missing in this chat. Don't fill gaps with your own product decisions; put choices you had to make under "Decisions for Graham".

## What this is

Graham wants a longer Road, from someone's first guitar to advanced, and a way to learn the song they chose one chord at a time, the way Simply Guitar teaches inside a song: loop one chord on the beat, then add a second chord and its changes, then the whole song. The Songbook stays unchanged. When song practice and touring show someone is ahead of the Road, the app offers (never forces) a jump ahead.

Grok wrote the plan and Graham approved it on 2026-11-19. The plan has 13 tours (Opening night plus 12) and 56 legs. A Song ladder makes graded versions of any Songbook song when the player starts it, and readiness signals lead to a Prove it show for skipping ahead. The plan is already in the repo as `docs/road-plan/ROAD-PLAN.md` on branch `rr-11-plan`. If this prompt and `ROAD-PLAN.md` disagree, this prompt wins for phase 1; say so in the PR.

This prompt is **phase 1 only**: the foundations. Nothing new shows on the Road yet, and the Song ladder screen and the Prove it offer sit behind a flag that is off by default.

Code to read before you start:

- `core/neck.js`: `SKILL_LEVELS` (the legs and their stop ids `c:`, `s:`, `x:`, `k:`), `cleanSkills` (200 ids today), `skillState`, `KNOW_PLAYS`, `roadNote`, `gradeSwitches`, `strumDetector`, `strumFit`, `chordLead`, `chordTargets`.
- `core/game.js`: `roadPath`, `BOX_EVERY`, `GUITARS`, `guitarFor`, `guitarsEarned`, `cleanGuitars` (keeps 20 seen ids), `ROAD` and `roadPlace`, `starsOf` and `starsSettle` (Gig-ready days in `data.gig.ready`), `planLesson` and `lessonOfDay`, `sheetChords`.
- `core.js`: `chordModel`, `songChanges`, `bodyCapo`, `shapeSteps`, and the save and load lists of `clean*` functions (around lines 85 and 374).
- `core/chords.js`: `chordShape`, `transposeChord`, `prefersFlats`. `core/playing.js`: `shapesOf`, `PASSPORT`, `NEXT_STAMPS`, `isBarre`, `journalOf` (`journal.chords`, `journal.changes`).
- `aitools.js`: `capoTable` (the capo table Make it easier sends to the AI). `practice.js`: the switch drill (`bpm` up 10 a round to `st.to`, graded by `gradeSwitches`). `audio.js`: `beatTrack`. `app.js`: the Tools rows (around line 1168), Practice mode and Build up (around line 659). `stage.js`: the strum line from the chart header.
- `profile.js`: the chord passport. `gig.js`: Show complete and `roadNote`.
- `docs/NO-CATCH-PLAN.md`: why shows don't listen since 4.91.0, and the planned Switch check (changes a minute), which isn't built yet.
- `docs/DATA.md`, `docs/ROAD-READY-PLAN.md`, `art/guitars/builder/manifest.json` (PR #108).

## Graham's decisions (already made, build to them)

1. One guitar per tour. Legs earn builder parts (paint, guard, hardware, wear, long strings from `art/guitars/builder`, PR #108). Later phase; phase 1 only makes room for it in the data.
2. The five shop concepts Walnut Hall, Ghost Spalt, Redwood Hollow, Velvet Crown and Ziricote Grand are earned on the Road as the guitars of Tours 4, 5, 6, 10 and 11. Data only in phase 1.
3. Rung 1 of the Song ladder: you play only your chord's bars, and the band carries the rest.
4. Easy shapes count for the chord passport with an "easy" mark; the full shape upgrades the stamp. Phase 1 stores the mark; the passport drawing changes later.
5. Thresholds: 30 clean changes a minute (the switch drill's best tempo as the stand-in until change speed exists), 80% of a tour covered, two Gig-ready songs on two different days. All in one tunable config object.
6. Ladder progress is stored beside the songs, keyed by song id. Songbook data (`data.songs` and every field on a song) is never written by this work. Make it easier keeps storing `song.easier` exactly as it does today; don't move or change it.
7. The finished lessons cap goes from 200 to 800.
8. Elite finishes (Graham, later phase): named, fixed premium builds of an existing painting made from the builder layers (for example gold hardware with a flame top, a sparkle burst, a mirror guard). Each counts as its own collectible guitar in the case, earned from later tours, Prove it shows, and replaying tours at higher stars, so the guitar count grows past 23 without new paintings. Only the 7 Road guitars have builder layers today; the 16 concepts would need layers. **Not phase 1**, but the phase 1 guitar entry must allow a base painting plus a fixed build (task 1).
9. Passed legs earn their tour guitar: yes. Their merch box fans: no, until the player plays the leg. **Phase 1** (task 6, behind the `proveIt` flag): `guitarsEarned` counts a passed leg like a headlined one only with the flag on, and boxes in a passed leg pay no fans until the leg's lessons are played.
10. Early rungs use the band only, never the recording. **Phase 1** (task 5). Later rungs (the full song) may use the recording; that's phase 2.
11. Opening night gets an "I've played before" option that runs the Prove it check for Tour 1. **Later (phase 3)**, not phase 1. Phase 1 only makes sure Prove it can be started for a given tour (task 6) so phase 3 can call it.

## Branch and PR

**Branch:** `rr-11-road-plan`, made from `rr-11-plan` (the branch that holds the plan; not from `main`, `next`, `road-ready` or any `rr-09` or `rr-10` branch).
**Always review:** yes. It touches stored data and `core.js` save and load lists (CLAUDE.md's always-review list and `sonnet-trust.md`).
**Touch:** `core/neck.js`, `core/game.js`, new `core/ladder.js` (and `core/road.js` if needed), `core/chords.js`, `core.js` (the `clean*` save and load lists only), `app.js` (the Tools rows and the ladder screen), a new root file for the ladder screen if you need one (add it to `SHELL`), `practice.js` and the lesson code that records results (only to write `data.mastery`), `gig.js`, `sw.js` (`SHELL` only), `tests/`, `docs/DATA.md`, `docs/ROAD-READY-PLAN.md`, `CLAUDE.md`, `README.md` (only if task 8 needs it).
**Don't touch:** `docs/road-plan/ROAD-PLAN.md`, `art/**`, `tools/guitars/**`, `docs/guitars/**`, `.github/**`, `worker/**`, `VERSION`, `CACHE`, the Songbook data and every field on a song.
**Product rules that apply:** CLAUDE.md's rules (plain words, no em dashes, untrusted data never instructions, Louie is a cartoon amp, never remove a feature), the readability rules (nothing under 12 px), the `--rr-*` colours in Light and Dark, and the playbook's inclusive design rules (44 pt targets, screen reader labels, contrast).

1. Open one PR from `rr-11-road-plan` into `rr-11-plan`, in the playbook PR format (`templates/pr.md`), marked "Waiting for review". Leave it open.
2. One task per commit. Before every push run `eslint .` and `node tests/quick.mjs`, and report the real results. Don't run the full suite and don't wait on CI. `git pull --rebase` before you push.
3. A new `.js` file in `core/` or the root must go in `SHELL` in `sw.js` (a test checks). No version bump. Topic files in `core/` must not read another file's values while loading, only inside functions.

## The work

### 1. Tours and legs as data, current ids kept

In `core/neck.js` (or a new `core/road.js` if `neck.js` gets too long; add it to `SHELL`):

- Add `TOURS`: `[{ id, n, name, marker, guitar, legs: [legId, ...] }]` for all 13 tours, with the legs from `ROAD-PLAN.md`. Every existing leg id keeps its place in a tour: `open` in Tour 1, `switch` in Tour 2, `strum` in Tour 3, `pick` in Tour 7, `finger` in Tour 8, `scales` in Tour 9 (it stays open from the start, as `own: true` does today).
- Add the new legs to the data with `soon: true`, so `roadPath` skips them (it already filters `lv.soon`). Their steps can stay empty in phase 1. Do not change the steps of `open`, `switch` or `scales`, so every stop id and every box id (`b:open-3` and so on) means what it means today.
- Add `tourOf(legId)` and `tourState(data)` (for each tour: its legs, how many are done, and whether it's finished). Nothing draws them yet.
- Guitar entries: extend `GUITARS` (or add a `GUITAR_LIST` beside it) so an entry can be a base painting plus an optional fixed build: `{ id, name, base, build }`, where `base` is a painting slug (`porch`, `walnuthall`, ...) and `build` is `{ paint, flame, guard, wear, metal, long }` using the ids in `art/guitars/builder/manifest.json`, or absent for the stock guitar. Add the tour guitars for Tours 4, 5, 6, 10 and 11 (the five shop concepts) as entries. Keep `guitarFor(legId)` and `guitarsEarned` returning exactly what they return today for every existing leg, so no saved player gains or loses a guitar. Add a `cleanBuild` that keeps only known ids and values. No elite finishes are added in phase 1; one test fixture shows the shape works.

### 2. The finished lessons cap

- `cleanSkills` keeps up to 800 ids (was 200). Keep the id pattern. Also keep a new `passed` map (`{ [legId]: time }`, known leg ids only), which `cleanSkills` would drop today because it only keeps `done` and `last`.

### 3. The Song ladder generator (pure)

New `core/ladder.js` (add to `SHELL`), unit tested, no DOM:

- `HARD`: a difficulty per chord name (Em 1, E 2, Am 2, D 2, C 3, G 3, A 3, ... F 7, Bm 7, B 8; barres from `isBarre` default to 7, unknown chords to 5). `EASY`: easy shapes (easy G and easy C as named voicings, Fmaj7 for F, Bm7 for Bm, B7 for B, F#m7 for F#m). Add the easy G and easy C voicings to `core/chords.js` so `chordShape` draws them; their names should show as the chord plus "easy" on screen.
- `songPlan(song, { withRecording })`: reads `song.body` through `chordModel` as the song sounds now (respect `transpose`, `capoOff` through `shapeSteps`, and `song.easier` when it's on). Bars: one bar per chord on a line, or two beats each when a line has more than four chords. Capo: try 0 to 7 the way `capoTable` does and keep the lowest total of difficulty times bars; only a capo when `withRecording`, so the song sounds the same. Returns `{ capo, bpm, strum, bars: [{ sec, chord, beats }], share, changes }` with `changes` from `songChanges`. It never writes to the song.
- `ladder(plan, known)`: the rungs in order. First chord: the one with the most bars (its easy shape when its difficulty is 6 or more; if it has none, the next most common). Second chord: the one the first changes with most often. Then one chord at a time by new bars per point of difficulty, chords in `known` first. Phase 1 returns every rung's data but only rungs `one` and `two` are playable: `{ id: "one", chords: [a], strum: "D D D D", rate: 0.7 }`, `{ id: "two", chords: [a, b], change: "bar", rate: 0.7 }`.
- `rungBars(plan, rung)`: each bar with `play` set to its chord when that chord is in the rung, else null (a rest the band plays).
- Tab songs and songs with no chords return null. A one-chord song has no rung `two`.
- Use the sample song Harbor Lights (`SAMPLE` in `app.js`) as a fixture: the order must come out G, then D, then Em, then C, then Am and Bm (Bm as Bm7), with shares 31%, 60%, 74%, 91% and 100% (35 bars).

### 4. Ladder progress, stored beside the songs

- `data.ladder = { [songId]: { rung, capo, best: { one: { rate, at }, two: { rate, at } } } }`, with `cleanLadder` (known rung ids, song id strings up to 40 characters, at most 500 songs) added to both the save list and the load list in `core.js`, next to `cleanSkills`. A song deleted for good drops its entry; a song in Recently deleted keeps it.
- `data.mastery = { chords: { [name]: { clean, n, easy } }, changes: { [pair]: { cpm, bpm, at } }, strum: { [pattern]: { bpm, at } } }` with `cleanMastery`, for mic-checked results only. Write to it when a chord lesson rings clean, when a switch drill finishes (its best tempo), and when a ladder loop is clean. `easy: true` on a chord means it was played with its easy shape; a later full shape clears it (the passport upgrade in decision 4).
- Document both, and `skills.passed`, in `docs/DATA.md`. An old save or backup with none of them loads unchanged.

### 5. Rungs 1 and 2, playable behind the flag

- Add `ROAD_PLAN = { flags: { ladder: false, proveIt: false }, thresholds: { cpm: 30, drillBpm: 80, tourCover: 0.8, gigReadySongs: 2, gigReadyDays: 2, recentDays: 30, offerWait: 7 }, ladder: { startRate: 0.7, step: 0.05, maxEarly: 0.8, minRate: 0.5, cleanLoops: 2 } }` in one place (`core/ladder.js`). This is the one tunable config from decision 5. A Settings row is not needed; tests and screenshots turn the flag on.
- With `flags.ladder` on, a chord song's Tools > Practice gets a "Learn it step by step" row (next to Practice mode and Make it easier). It opens a ladder screen built from `songPlan` and `ladder`: the rung, the chords you play (with the shape cards), how much of the song that is, and Start.
- Playing a rung: the band's beat (`beatTrack`) at the song tempo times the rung's rate, a count-in, and the song's bars in order with your bars lit and the others shown as rests ("the band plays this one"). Rung 1 is one downstrum on every beat of your bars. Rung 2 changes only on the 1. Listen with `strumDetector` and grade each loop with `gradeSwitches` against the beats of your bars. Two clean loops finish the rung and store it in `data.ladder`; then the rate goes up by `step`, up to `maxEarly`. Three rough loops in a row offer the easy shape or a slower rate, never anything that moves the player back on the Road.
- The ladder screen uses the band only (no recording) in phase 1.
- Screen reader labels on every control, the `--rr-*` colours in Light and Dark, plain words, and nothing smaller than 12 px (the readability rules).

### 6. Readiness signals and the Prove it offer, behind the flag

- `readiness(data, tourId, now)` in `core/ladder.js` (pure): for each leg in the tour, the share of its chords with chord evidence (a clean check in `data.mastery`, `data.skills.done`, or `KNOW_PLAYS` songs), its changes with change evidence (switch drill best at `drillBpm` or more, or `cpm` at the threshold once it exists), and Gig-ready songs (from `data.gig.ready`) in the last `recentDays` that use the tour's chords. Returns `{ score, chords: { have, need }, changes: { have, need }, songs, offer }`, where `offer` is true at `tourCover` or more with `gigReadySongs` songs on `gigReadyDays` different days, and not within `offerWait` days of a Not now for that tour.
- With `flags.proveIt` on, Show complete (`gig.js`) shows one card when `offer` is true for the next unfinished tour: what you played, what it covers, and Prove it and Not now. Not now stores the time per tour (in `data.rehearse` or a small new field; document it). Prove it opens a sheet that lists its three parts (a chord check of the tour's hardest chord, a switch drill of its hardest change at the threshold, your song at full speed) and runs the first two with the existing lessons. Passing all three writes `skills.passed` for the tour's legs. `skillState` and `roadPath` treat a stop in a passed leg as passed: it unlocks what comes after, like done, and stays playable; finishing it turns it into done and pays its fans as normal. With the flag off, nothing changes for anyone.
- Never during a show. Never automatic.

### 7. Tests

In `tests/core.test.mjs`:

- Every existing leg and stop id in `SKILL_LEVELS` is unchanged, and `roadPath` returns exactly today's legs, stops, box ids and states for a set of saved fixtures (a new player, one mid Open chords, one mid Chord switches, one with Scales done).
- `guitarFor` and `guitarsEarned` are unchanged for every existing leg. A guitar entry with a `base` and a fixed `build` passes `cleanBuild`; an unknown part is dropped.
- Every tour lists only known leg ids; every leg is in exactly one tour; leg and tour counts match `ROAD-PLAN.md` (13 tours, 56 legs).
- `cleanSkills` keeps 800 ids and drops the 801st; keeps `passed` for known legs only. The existing tests around lines 1498 and 1653 still pass.
- `songPlan` and `ladder` on Harbor Lights give the order and shares above; a capo is chosen only with `withRecording`; tab songs give null; a one-chord song has no rung `two`; the song object is deep-equal before and after (nothing written).
- `rungBars` lights only the rung's chords.
- A loop with 75% of strums within a quarter beat is clean, using `gradeSwitches`.
- `cleanLadder` and `cleanMastery` keep good entries and drop bad ones; an old save with none of them loads; a save and load round trip keeps them.
- `readiness` offers at 80% with two Gig-ready songs on two days, not at 79%, not with two songs on one day, and not within 7 days of Not now.
- With both flags off, `skillState` and `roadPath` give today's results even when `skills.passed` is set (passed only counts with `proveIt` on). With `proveIt` on, a passed leg unlocks the next and its stops stay playable. It earns its tour guitar in `guitarsEarned`, and its merch boxes pay no fans until the leg's lessons are played (decision 9).

Add one e2e check (next to `tests/e2e/practice.e2e.mjs`) with the flag on: Harbor Lights shows Learn it step by step, the ladder screen opens on rung 1 with G, and Back returns to the song.

### 8. Docs and screenshots

- `CLAUDE.md`: add rows to "Where things are" for `core/ladder.js` (the Song ladder, readiness, `ROAD_PLAN`) and the tours data, and note `docs/road-plan/ROAD-PLAN.md`.
- `docs/ROAD-READY-PLAN.md`: add a short note, "Road plan phase 1 (rr-11-road-plan)", with what shipped behind the flags and a link to `ROAD-PLAN.md`.
- `docs/DATA.md`: `data.ladder`, `data.mastery`, `skills.passed`, the Not now times, and the guitar entry shape.
- README: only if something shows with the flags off (it shouldn't).
- Screenshots at deviceScaleFactor 3, Light and Dark, with the flags on: the Tools > Practice row, the ladder screen on rung 1 and on rung 2 for Harbor Lights, a rung playing, and the Prove it card on Show complete. Attach them to the PR.

If something in the code doesn't match this prompt, stop that task and write it under "Surprises" in `docs/ROAD-READY-PLAN.md` and in the PR.

## Not in scope (later phases, don't build)

- Phase 2: the rest of the ladder (add a chord, the strum rung, the full song, real shapes) and tours on the Road (tour banner, level markers, Tour 1's two new legs before Open chords, the passed rule for older players, Your song stops `y:`).
- Phase 3: readiness and Prove it switched on for everyone, Tours 1 to 3; "I've played before" in Opening night; the Switch check from `NO-CATCH-PLAN.md` step 6.
- Phase 4: Tour 3, Strumming, filling the `strum` placeholder, and Tour 2's new legs.
- Phase 5 to 7: Tours 4 to 12, filling `pick` and `finger`; builder layers for Walnut Hall, Ghost Spalt, Redwood Hollow, Velvet Crown and Ziricote Grand; legs paying builder parts.
- Later: elite finishes as collectible guitars; builder layers for the 16 shop concepts; raising `cleanGuitars`' 20-guitar limit when the case grows past it; the passport's "easy" drawing.

## PR sections

Besides the playbook format, the PR has:

- **Decisions for Graham**: anything you had to choose, for example where the Not now times live, the exact easy G and easy C fingerings, and how a passed stop is drawn when the flag is on. (Decisions 9 to 11 are made; don't ask about them again.)
- **Surprises**: anything in the code that didn't match this prompt.

## How to write

Plain words for Graham. No em dashes anywhere Graham reads (PR, commits, docs, on-screen text). Never print or commit secrets.

## Done when

- [ ] Each task above has its tests, and the PR has a criterion to test table.
- [ ] `eslint .` and `node tests/quick.mjs` results recorded in the PR from real runs. CI started; results recorded when they arrive.
- [ ] PR open from `rr-11-road-plan` into `rr-11-plan` in the playbook format, marked "Waiting for review", with "Decisions for Graham" and "Surprises".
- [ ] Screenshots attached in Light and Dark.

## Report back (in this chat)

The PR link, the `eslint .` and `node tests/quick.mjs` results, the screenshots, the decisions for Graham, and any surprises. Do not merge.

**Next step after this: Fable,** in the Louie Review chat, reviews the diff (Opus-built work is reviewed by Fable or a separate Opus conversation). Merging waits for that review and Graham's merge go.
