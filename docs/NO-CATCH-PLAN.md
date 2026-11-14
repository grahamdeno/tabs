# Retiring Chord Catch (audit and plan)

Written by Opus, 2026-11-13, on 4.89.1. Graham: hearing which chord was played has never been reliable
enough to score on, so it goes from every part of the app. The microphone stays for single notes (the tuner,
the chord lesson's string check, scale lessons), for the strum and clap moment (switch lessons, Play together)
and for Sing it. Nothing below is built yet. Work happens on the `no-catch` branch and ships as one release
when Graham says ship (his standing preference), not a push to `main` per step.

## Decisions Graham needs to make

Each has a recommendation. Steps that wait on a decision say so.

1. **What a show pays for, now that nothing is heard.** Recommended: *played through*. A chord change counts
   when the song carries it past the reading line while playing (not dragged past, not paused). The phone
   can't tell whether you strummed, so this is an honour system, the same one a play already runs on today.
   - Bonus fans: 1 per change played through, +10 for the whole song without pausing (today: 1 per chord
     caught, +10 for a crowd of 10). Encore still doubles.
   - Tips: 10 + 3 x crowd + changes / 4, crowd being the share of the song played, 0 to 12 (today: 10 +
     3 x crowd + best run / 2 when scored, a flat 5 when not).
   - XP: 1 per change played through, +10 for the whole song without pausing (today the same numbers for
     chords landed and a crowd of 10), so the weekly chart rivals stay a fair race.
   - The crowd row in the Gig fills as the song goes; the run is changes since the last pause, and the
     10 / 25 / 50 / 100 combo callouts fire on that run.
   - Other option: a flat amount per show. Simpler, but a short song pays the same as a long one and the
     Merch prices and chart rivals would need retuning.
2. **Rival battles.** Recommended: today's battle becomes "Play *song* start to finish today, no pausing,
   to pass *rival*". Win is a full play-through; there is no "held on" any more. Second take has nothing to
   do, so it leaves the Merch table and any held are refunded as tips at their price. Other option: retire
   battles and Second take outright (the chart still runs on XP).
3. **Your changes and the soundcheck** (fed today by changes landed and dropped in gigs). Recommended: feed
   them from switch lessons (their clean grade) and how often the change is in your songs, which the
   soundcheck already falls back to. Optional extra: on Show complete, tap any change that tripped you and it
   goes to tomorrow's soundcheck. Say whether you want the extra.
4. **Song duels** (a challenge is your % on a song). Recommended: retire duels. Friends you already have stay
   on the Friends board and in the Friend quest (both run on weekly XP). "Add a friend" sends a plain link
   with your name and week, the part of the duel link that still means something. A duel link from someone on
   an older version opens the song and says challenges are retired. Other option: a duel becomes "play it
   through more times this week than I do"; more code, and ties are common.
5. **Switch lessons.** They hear *when* you strum (beat one of each bar), not *which* chord. Recommended: keep
   them, with "I can't hear it, I got it" as the way out it already is. Say if you want them gone too; then the
   switch steps on the Road are passed by playing the change in a song a few times, the way chord steps are.
6. **Release number.** Recommended 4.90.0 (the game stays, its scoring changes). 5.0.0 if you'd rather mark it.

## What listens today, and what happens to it

| Where | What it hears | Fate |
|---|---|---|
| The Gig (`gig.js` `listen`, `catchHear` in `core/game.js`) | Which chord, every 50 ms, plus strum count | **Goes** |
| Wait for me, Skip this chord (`gig.js` `holdFrame`, `catchUp`) | Holds the page until the chord is caught | **Goes** |
| Follow my tempo (`gig.js` `keepPace`, `FOLLOW`, `tempoStep`, `followAhead`, `follow.k` in `app.js`) | Tempo from chords caught in a row | **Goes** |
| The stage marks (`stage.js` `stageCatch`, `stageMiss`, `stageWait`) | Green for caught | **Goes**; the lit chord and beat dots stay |
| Score my plays (Settings, `settings.gigScore`) | Turns the above on or off | **Goes** |
| Opening night "Let me hear you" (`opening.js` `micSheet`, `OPENING[1]`) | Asks for the mic so shows can be scored | **Goes** |
| What I hear (`practice.js` `whatIHear`, chord section) | Chord fit, the show's own test | Chord section **goes**; strum and string readings stay |
| Hearing engine (`core/neck.js` `chromaOf`, `strumFit`, `chordLead`, `chordLeadOver`, `CHORD_FIT`, `CHORD_EXTRA`; `core/game.js` `catchHear`, `catchOpen`, `relativeOf`, `CATCH_*`) | | **Deleted** once nothing calls it |
| Tuner (`tuner.js`), chord lesson string check, scale lessons (`judgeTarget`, `detectPitch`) | One note at a time | Stays |
| Switch lessons (`strumDetector`, `gradeSwitches`, `bleedProfile`, `HEAR`) | When you strum | Stays (decision 5) |
| Play together (`share.js`) | One clap | Stays |
| Sing it (`sketch.js`), Strum it on a recording (`strum.js`) | Your voice; a recording, offline | Stays |

## What depends on the score, and what happens to it

| Feature | Uses | New behaviour |
|---|---|---|
| Show complete tiles and text (`gig.js` `showComplete`, `songPlayed`) | hits, misses, crowd, best run | FANS, TIPS, CROWD (n/12), CHANGES played; every chord in "the song you played" lit; no caught/missed |
| Bonus fans, tips (`gigFans`, `gigTips`) | hits, crowd, best | Decision 1 |
| Chart XP (`chartsShow`, `XP.landed`, `XP.crowd`) | hits, crowd | Decision 1 |
| Rival battle (`battleFor`, `chartsShow`, `charts.js`) | % vs target | Decision 2 |
| Second take, Double set (`MERCH`, `secondTake`) | battles; "scored gigs" | Second take per decision 2; Double set reads "your next 3 gigs" |
| Song duels, duel badge (`duel.js`, `startDuel`, `takeDuel`, `duelsShow`, `duelWon`) | % | Decision 4; a duel badge already earned stays, an unearned one is hidden |
| Tour quest "Get the crowd to 10 of 12" (`questState`, `questsShow`) | crowd | "Play a song start to finish without pausing" |
| Your changes, soundcheck (`rehearseMisses`, `changesToWork`, `missedChanges`) | lands and misses from gigs | Decision 3 |
| "Best show N%" on the song page (`app.js`, `data.gig.best`) | % | Removed; the play count already shown stays |
| "Practice show" rule (Wait for me shows earn no chart points) | Wait for me | Gone with Wait for me |
| Combo callout (`COMBO_STEPS`) | chords caught in a row | Run since last pause (decision 1) |

Not touched: plays, streaks, fans from plays, venues and fading, the Road (chord steps pass on plays of the
chord, level checks on playing a song, both from `journal` and `playLog`, never from catches), merch boxes,
Your band, Your guitarist, lessons of the day (passes count loop passes, not catches), Apple Music play-along.

## Not breaking the app: the risks and how each step guards them

1. **Order of work.** First make the app behave as if Score my plays were off for good (step 1). That path
   already exists and is tested, so the app works after step 1 and after every step that follows. Delete
   code only after nothing calls it (step 10).
2. **Opening night step numbers.** `data.opening.step` is an index into `OPENING`. Taking out "mic" (index 1)
   shifts later steps down one. Migrate once: v 2 to v 3, step 2 or more becomes step - 1. A unit test covers a
   save stopped on each old step.
3. **Old saves and backups.** Every `clean*` function keeps accepting the old fields (`gig.best`,
   `charts.battle.pct`, duels with `pct`, `rehearse.misses` and `lands`, `song.waitForMe`, `song.followTempo`,
   `settings.gigScore`, `opening` v 2) so a 4.89.1 backup restores. Fields nothing reads any more are dropped
   on the next save. A fixture backup from 4.89.1 is restored in a unit test.
4. **Duel links in the wild** from older versions open without an error (decision 4).
5. **The economy.** Unit tests pin fans, tips and XP for a short, a typical and a long song so a show pays
   within about 20% of a well-played scored show today, and a typical week's XP stays inside the chart
   rivals' range at each tier.
6. **Exports.** `core.js` re-exports on two long lines (10 to 11 and 1524 to 1525). Remove names with exact,
   unique edits and run `eslint .`; a missed name fails to import at load.
7. **Topic files** in `core/` must not read another file's values while loading.
8. **`sw.js`.** No app file is removed in this plan. If one is, take it out of `SHELL` (a test checks).
   `VERSION` and `CACHE` bump together, once, at ship.
9. **Accessibility.** The Gig's bottom bar loses the mic button; Pause stays in thumb reach with its name.
   axe runs in CI.
10. **Onboarding.** `docs/ONBOARDING.md` loses the microphone-and-Gig rows and the Wait for me row; the
    microphone is first asked by the tuner or a lesson, which already say why (`micExplained`).

## Steps

Each step: one task per commit on `no-catch`, `eslint .` and `node tests/quick.mjs`, push the branch. No
version bump until step 14 (one release). When something doesn't match the plan, stop that task and write it
under Surprises.

- [ ] 0 [Sonnet] **Branch and baseline.** Create `no-catch` from `main`, run quick tests, note any already
      failing. Remove the stray `undefined/ly.png` (a screenshot saved with `$SHOT` unset).
- [ ] 1 [Sonnet] **The Gig stops listening.** `openGig` never calls `listen`; remove the mic button, Hearing
      you, `deafen`, `relisten`, `paintMic` and the "not scored" lines; remove the Score my plays row in
      Settings. The show runs its existing unscored path. Update `gig.e2e.mjs`, `app3.e2e.mjs`.
- [ ] 2 [Opus, after decision 1] **The played-through score.** In `core/game.js`: replace `gigStart`,
      `catchScore`, `gigCrowd`, `gigPct`, `gigFans`, `gigTips` with a played-through tally (changes played,
      share of the song, run since pause, whole song unpaused). Keep `catchTargets`, `catchAt`, `catchClose`
      (renamed `songTargets`, `targetsAt`, `targetsPassed`) to count what passes the reading line while
      playing. `gigDone` returns the same fields minus `pct`. Economy unit tests (risk 5).
- [ ] 3 [Sonnet] **The Gig on the new score.** Crowd fills with the song, run and combo callouts from the
      run, Show complete per the table above. If decision 3's extra is wanted: tap a change on the end card to
      send it to tomorrow's soundcheck.
- [ ] 4 [Sonnet] **Stage marks.** Remove `stageCatch`, `stageMiss`, `stageWait` and their styles; keep the lit
      chord, beat dots and stage light.
- [ ] 5 [Sonnet] **Wait for me and Follow my tempo.** Remove the two Tools rows and their toasts, `holdFrame`,
      `keepPace`, `catchUp`, Skip this chord, the WAIT FOR ME pill, `waitOn`, `followOn`, `follow`, `FOLLOW`,
      `tempoStep`, `followAhead`, `beatsLate` if unused, and `follow.k` in `loopFactor`. Practice speed and
      loops stay.
- [ ] 6 [Opus, after decisions 2 and 4] **Charts, Merch and duels.** Battle per decision 2, Second take
      retired with refund, Double set wording, duels per decision 4 (with the old-link path and "Add a
      friend"), badges, `charts.js` "how XP works" line.
- [ ] 7 [Sonnet] **Tour quests.** The crowd goal becomes "Play a song start to finish without pausing";
      `questsShow` takes the played-through tally.
- [ ] 8 [Sonnet, after decisions 3 and 5] **Rehearse.** Your changes and the soundcheck per decision 3; What
      I hear loses its chord section; check lesson of the day still builds from his songs.
- [ ] 9 [Sonnet] **Opening night.** Remove the "mic" step and `micSheet`, the Road's mic icon and its lines
      in `OSAY` and `openingCard`, the `noMic` path in `gigOpen`, and Opening night's "catch it" wording.
      Migration and test (risk 2). Update `opening.e2e.mjs` and Tips & gestures' Opening night row.
- [ ] 10 [Sonnet] **Delete the hearing engine.** Remove what the table marks Deleted, the export names in
      `core.js`, their unit tests, the chord memos in `tests/audio/chords/` and the tests that read them.
      Keep the single-string memos (the tuner's tests). `grep` for each removed name before the commit.
- [ ] 11 [Sonnet] **Saves and backups.** Cleaners per risk 3; fixture backup test; `docs/DATA.md` updated
      for every field that stops being written.
- [ ] 12 [Sonnet] **Words.** Grep UI text, tips (`coach.js`), callouts, Merch notes, Charts, the Band tab,
      README, `docs/ONBOARDING.md` and `CLAUDE.md` for catch, caught, Hearing you, scored, score my, %, land,
      crowd, "the microphone needs to hear". Drop "mic chord check during a play-along" from CLAUDE.md's
      Open list. Move `docs/HEARING-PLAN.md` to `docs/history/` with a line saying it was retired in this
      release.
- [ ] 13 [Opus] **Review.** Read the whole diff for leftovers; run the Gig main path at 390 wide in Dark and
      Light; check the economy numbers against today's; screenshots of the Gig, Show complete, Charts and
      Rehearse for Graham (throwaway `zz_` test, then delete it).
- [ ] 14 [Graham, then Sonnet] **Try it, then ship.** Graham plays a few songs from the branch build. On
      "ship": bump `VERSION` and `CACHE` (decision 6), README feature list, rebase on `origin/main`, push to
      `main`. Remake the visual references when Graham says
      (`gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`).
      Graham deletes the `no-catch` branch on github.com.

## Size

About 14 commits. Steps 1, 4, 5, 7, 9 are small. Steps 2, 6 and 10 are the big ones (step 10 mostly
deletion: `core.test.mjs` has about 110 lines on catching, `gig.e2e.mjs` about 22). Two or three sessions.

## Surprises

(Write here when something doesn't match the plan.)
