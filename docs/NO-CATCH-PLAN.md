# Chord Catch out of songs, kept where it works (audit and plan)

Written by Opus, 2026-11-13, on 4.89.1. Graham: catching chords during a song has never been reliable enough
to score on, and too much of the game is built on that score. This plan does three things:

1. **Takes chord catching out of songs**: the Gig, Wait for me, Follow my tempo.
2. **Keeps it where it measures well**: one chord held (Chord check) and two chords taking turns at your own
   pace (Switch check).
3. **Rebuilds the game on what the app can trust**, so it stays worth playing: song mastery, difficulty,
   streaks, and verified numbers from the two checks.

The first thing built is the **Listening booth**: a page in the app where Graham records labeled chords and
switches, sees what the engine heard, and sends the takes to the repo in one tap. Claude measures and tunes
the engine on them, Graham tries the new version in the booth, and the checks are built on what that loop
shows. No Voice Memos to move by hand.

The microphone also stays for single notes (the tuner, string checks, scale lessons), the clap in Play
together, and Sing it. Nothing below is built yet. Work happens on the `no-catch` branch. The booth ships
first on its own so Graham can record (decision 9); everything else ships as one release when Graham says ship.

## Why keep it for one chord and for switching: the measurement

Run on the 12 chord memos in `tests/audio/chords/` (Am, C, D, Em, F, G, two each), every 50 ms reading through
the real `chromaOf`, `strumFit` and `chordLead`:

| Chord | Readings | Called this chord | Called another chord |
|---|---|---|---|
| Am | 113 | 97% | 0% |
| C | 89 | 91% | 0% |
| D | 67 | 93% | 0% |
| Em | 126 | 90% | 0% |
| F | 96 | 96% | 0% |
| G | 140 | 94% | 1% |

As two-chord pairs (only "A or B?"), every one of the 15 pairs was called right on 90 to 97% of readings.

A held chord gives about 20 readings a second, so judging on most readings over a second is far safer than
one reading. The song case fails for reasons a check doesn't have: a clock to keep up with, the last chord
still ringing, a choice among every chord in the song, soft partial strums, a capo, and eight gates tuned one
report at a time (`docs/HEARING-PLAN.md`).

The limits, said plainly: 12 memos, one guitar, one room, strummed cleanly, and the same memos the engine was
tuned on. The booth (step 1) records more before anything is built on it.

**Fingerprints of your own guitar, tested 2026-11-14.** Each chord's average sound from one memo, matched
against the other memo of the same chord: right on 96 to 97% of two-way calls, but only 85% when choosing among
all six, and uneven by chord (D 35% one way, F 57%, others 89 to 100%). One take per chord isn't enough to beat
the textbook shapes. So fingerprints are an experiment the booth measures (several takes per chord, blended
with the textbook shape), adopted only if they help on Graham's takes (decision 8).

## Keeping the game worth playing

What gave the game its pull: a number to beat, a reason to stretch, progress you can see, and someone to race.
Each one gets a home on a signal the app can trust.

| What made it fun | Before (rested on catching in songs) | After |
|---|---|---|
| A number to beat | Show % | **Switch check speed**: clean changes a minute on a pair (verified by the mic). Personal best per pair |
| Proof you can play it | Chords caught | **Chord check** stamps in the passport (whole chord heard, plus the string check that exists) |
| Progress on a song | Best show % | **Song stars**, from play-throughs (below) |
| Reason to stretch | Higher % | **Stretch pay**: songs with chords you don't know yet, more changes, full speed pay more |
| The crowd in the Gig | Last 12 chords caught | Fills as the song goes; full crowd for the whole song without pausing |
| Combo callouts | Chords caught in a row | Changes since the last pause |
| Rival battles | Beat their % on a song | **Beat their switch speed** on a change from your songs |
| Song duels | Beat my % on a song | **Switch duels**: "C to G, 34 a minute. Beat it." |
| Your changes, soundcheck | Changes landed or dropped in gigs (often wrong) | **Switch check results** per pair: real numbers, better than before |
| Charts | XP | XP, unchanged in how it works |

### Song stars (replaces Best show %)

Each song climbs four stars, from what the app knows for sure: played to the end, the speed, and pauses.

1. **Learning**: in the Songbook.
2. **Rehearsed**: played through 3 times at any speed.
3. **Gig-ready**: played through at 100% without pausing.
4. **Headliner**: Gig-ready on 3 different days.

Stars show on the song page, in the Songbook, and on Show complete when one is earned (a callout). They feed
badges, quests and the Road's level checks.

### What a show pays (played through, weighted by difficulty)

A chord change counts when the song carries it past the reading line while playing. The phone can't tell
whether you strummed, so song play is on the honour system, as a play already is today. The verified numbers
come only from the two checks, and those are the ones that race other people.

- Bonus fans: 1 per change played through, times the stretch factor; +10 for the whole song without pausing.
  Encore doubles.
- Stretch factor: 1.0, +0.25 at 100% speed, +0.25 if the song has a chord you haven't learned yet, +0.25 for
  the first play-through ever (the debut). Capped at 1.75.
- Tips: 10 + 3 x crowd + changes / 4.
- XP: as fans, so the chart rivals stay a fair race.
- A new star pays a one-time bonus: 25 fans for Gig-ready, 50 for Headliner.

Numbers are starting points. Step 3's tests keep a typical show within about 20% of a well-played scored show
today, so Merch prices and the chart rivals stay balanced.

### The two checks (in Rehearse and on the Road)

- **Chord check.** Hold the chord and strum. Louie listens for about a second and a half and passes it when
  most readings fit that chord (`strumFit`, `CHORD_FIT`). Then the string check that exists, string by string.
  Passing both earns the chord's passport stamp and passes its Road step. No clock; take your time.
- **Switch check.** Two chords, back and forth, at your own pace. After a strum, Louie waits until the sound
  settles into one of the two (`chordLead` between them only), then lights the other one. 30 seconds, counted
  in clean changes. It shows your speed a minute and your best for that pair. A target speed passes the
  Road's switch step. The beat-timed switch lesson today becomes the "With the beat" round of the same check
  (decision 4).
- Both keep "I can't hear it, I got it". A pass that way earns the step but no stamp or speed, so verified
  numbers stay honest.
- Both use `What I hear` readings to explain a miss.

## Decisions Graham needs to make

Each has a recommendation.

1. **Keep catching for Chord check and Switch check**, out of songs. Recommended yes, after step 1's
   recordings confirm it. If the new recordings come in under about 85% on the pairs you play, fall back to
   the string check and beat timing only, and drop decision 3's competition to XP.
2. **Song stars and stretch pay** as above. Recommended yes. Other option: a flat amount per show (simpler;
   a short song pays like a long one, and Merch and chart numbers need retuning).
3. **Competition on switch speed**: rival battles and duels race clean changes a minute on a pair. Recommended
   yes. A duel link from an older version (a song %) opens the song and says song duels changed. Second take
   stays and gives a lost battle another go, as now.
4. **The beat-timed switch lesson** becomes the "With the beat" round of Switch check. Recommended yes.
5. **Self-rating at the end of a show** ("Rough, Solid, Nailed it"; one tap, optional) that feeds the
   soundcheck. Recommended no for now: Switch check gives better numbers, and fewer taps mid-practice.
6. **Release number.** Recommended 4.91.0, after the booth's 4.90.0 (decision 9). 5.0.0 if you'd rather
   mark it.
7. **How the booth sends takes.** Recommended: Send writes them to a `booth` branch of this repo, with a GitHub
   key that can only touch this repo, kept on the phone like the AI key (never in code or a backup). Claude
   sets nothing up on the phone; a Grok prompt walks Graham through making the key. Other option: Share makes
   one file of the takes to attach in a chat (no key, one more step each round).
8. **Fingerprints.** Recommended: measure them in the booth and adopt them only if they beat the textbook
   shapes on Graham's takes. If they do, every player records each chord once in Chord check to set theirs.
9. **Getting the booth onto the phone.** The app runs from `main`, so the booth has to ship before Graham can
   record. Recommended: ship the booth alone as 4.90.0 (one hidden page; nothing else in the app changes),
   then everything else as one release, 4.91.0. Other option: hold to a single release and record from a
   preview copy of the branch on another address (a separate copy of the app, with its own empty storage).

## What listens today, and what happens to it

| Where | What it hears | Fate |
|---|---|---|
| The Gig (`gig.js` `listen`; `catchHear`, `catchOpen`, `CATCH_*` in `core/game.js`) | Which chord, every 50 ms, in a song | **Goes** |
| Wait for me, Skip this chord (`holdFrame`, `catchUp`) | Holds the page until the chord is caught | **Goes** |
| Follow my tempo (`keepPace`, `FOLLOW`, `tempoStep`, `followAhead`, `follow.k` in `app.js`) | Tempo from chords caught | **Goes** |
| Stage marks (`stage.js` `stageCatch`, `stageMiss`, `stageWait`) | Green for caught | **Go**; lit chord, beat dots, stage light stay |
| Score my plays (Settings, `settings.gigScore`) | Turns the Gig's listening on or off | **Goes** |
| Opening night "Let me hear you" (`micSheet`, `OPENING[1]`) | Asks for the mic so shows are scored | **Moves**: becomes the first Chord check in Opening night ("Play an Em for me"), with the reason first |
| Hearing engine (`chromaOf`, `strumFit`, `chordLead`, `chordLeadOver`, `CHORD_FIT`, `CHORD_EXTRA` in `core/neck.js`) | | **Stays**, for the two checks; `relativeOf` goes if unused |
| Chord lesson (`practice.js` `chordLesson`, string check) | One string at a time | Stays, inside Chord check |
| Switch lesson (`switchLesson`, `strumDetector`, `gradeSwitches`) | When you strum | Becomes Switch check's "With the beat" round |
| What I hear (`whatIHear`) | Chord fit, strums, strings | Stays; its chord section tests the checks, not the show |
| Tuner, scale lessons, Play together's clap, Sing it, Strum it on a recording | | Stay |

## What depends on the song score, and what happens to it

| Feature | Uses | New behaviour |
|---|---|---|
| Show complete (`showComplete`, `songPlayed`) | hits, misses, crowd, best run | FANS, TIPS, CROWD, STARS; changes played; every chord of the song lit; a new star celebrated |
| Bonus fans, tips (`gigFans`, `gigTips`) | hits, crowd, best | Stretch pay |
| Chart XP (`chartsShow`, `XP.landed`, `XP.crowd`) | hits, crowd | Stretch pay |
| Rival battle (`battleFor`, `chartsShow`, `charts.js`) | % on a song | Switch speed on a change from your songs; the target scales with the chart tier |
| Song duels, duel badge (`duel.js`, `startDuel`, `takeDuel`, `duelsShow`, `duelWon`) | % | Switch duels; the badge keeps its rule (win a duel) |
| Double set | "scored gigs" | "your next 3 gigs" |
| Tour quest "crowd 10 of 12" (`questState`, `questsShow`) | crowd | "Play a song start to finish without pausing"; plus a rotating goal from a pool: earn a star, beat a switch best, pass a Chord check, play a stretch song |
| Your changes, soundcheck (`rehearseMisses`, `changesToWork`, `missedChanges`) | gig lands and misses | Switch check speeds per pair, plus how often the change is in your songs |
| "Best show N%" on the song page (`data.gig.best`) | % | Song stars |
| Combo callout (`COMBO_STEPS`) | caught in a row | Run since the last pause |
| Road level checks (`skillState`, kind `check`) | a song played after the level | A song of the level played to **Gig-ready** |
| Road chord and switch steps | lessons, or plays of the chord | Chord check and Switch check, or plays as now (chord steps) |

Not touched: plays, streaks, fans from plays, venues and fading, merch boxes, Your band, Your guitarist,
lessons of the day (passes count loop passes), Apple Music play-along, Friends and the Friend quest (weekly XP).

## Not breaking the app

1. **Order of work.** First the Gig stops listening (step 2). That runs the unscored path that already exists
   and is tested, so the app works after step 2 and after every step that follows. New things are added before
   old ones that lean on them are removed. Code is deleted only after nothing calls it.
2. **Opening night step numbers.** `data.opening.step` is an index into `OPENING`. The "mic" step changes to a
   Chord check in the same place, so the index doesn't move. A unit test covers a save stopped on each step.
3. **Old saves and backups.** Every `clean*` function keeps accepting old fields (`gig.best`,
   `charts.battle.pct`, duels with `pct`, `rehearse.misses` and `lands`, `song.waitForMe`, `song.followTempo`,
   `settings.gigScore`) so a 4.89.1 backup restores. `gig.best` seeds song stars once (80% or more counts as
   Gig-ready). New fields (stars, switch bests, stamps) are listed in `docs/DATA.md` and checked on restore.
   A fixture backup from 4.89.1 is restored in a unit test.
4. **Duel links in the wild** from older versions open without an error.
5. **The economy.** Unit tests pin fans, tips and XP for a short, a typical and a long song.
6. **Exports.** `core.js` re-exports on two long lines (10 to 11 and 1524 to 1525). Change names with exact,
   unique edits; `eslint .` catches a name that's missing.
7. **Topic files** in `core/` don't read another file's values while loading. New check logic goes in
   `core/neck.js` (hearing) and `core/game.js` (stars, pay).
8. **`sw.js`.** A new app file (for example `checks.js`) goes in `SHELL` (a test checks). `VERSION` and `CACHE`
   bump together, once, at ship.
9. **Accessibility.** The Gig's bottom bar loses the mic button; Pause stays in thumb reach. The checks name
   every lamp and count for VoiceOver. axe runs in CI.
10. **Onboarding.** `docs/ONBOARDING.md` updated: the mic is asked before the first Chord check, with the
    reason; stars, Switch check and switch duels added; Wait for me removed.
11. **The booth's key and audio.** The GitHub key is stored like the AI key: on the phone only, never in code,
    a backup, a share link or the takes. Takes live in their own IndexedDB store (`tabs-booth`), not in `data`,
    so backups stay small; a take is deleted from the phone once sent. A failed Send keeps the takes and says
    why (no key, no signal, key refused).
12. **The booth is out of the way.** It opens from What I hear and stays out of onboarding and tips: it's a
    tool for tuning the engine, not a feature to teach.

## Steps

Each step: one task per commit on `no-catch`, `eslint .` and `node tests/quick.mjs`, push the branch. No
version bump except the booth's release (step 1a) and the last step. When something doesn't match the plan, stop and write it under Surprises.

- [x] 0 [Sonnet] **Branch and baseline.** Quick tests on `no-catch`; note anything already failing. Remove the
      stray `undefined/ly.png` (a screenshot saved with `$SHOT` unset).
- [x] 1a [Sonnet] **Build the Listening booth** (`booth.js`, in `SHELL`; opens from What I hear).
      - Pick what you'll play: **Chord** (one chord: the chords in your songs first, then any) or **Switch**
        (two chords). Remembered between visits: the guitar (a short name) and where the phone is (stand,
        table, hand).
      - **Record** and **Stop** in thumb reach, 30 s at most. The mic is opened with `getMic()` as the checks
        will open it (no echo cancelling, noise suppression or auto gain). Recorded with `MediaRecorder`, as
        Sing it does, then decoded and saved as 16-bit mono WAV at 22,050 Hz (the engine reads nothing above
        1.3 kHz; 30 s is about 1.3 MB).
      - While recording, a strip shows what the engine hears every 50 ms: for a chord, its fit against
        `CHORD_FIT`; for a switch, which of the two it calls. After Stop: the share of readings called right
        and called wrong. A note field for anything odd ("buzzed the B string").
      - The takes list: play back, delete, the count not yet sent. Takes live in IndexedDB `tabs-booth`.
      - **Send** (decision 7): creates the `booth` branch from `main` if it's missing, writes each take to
        `booth/<date>/<chord-or-pair>-<id>.wav` with a `.json` label beside it (kind, chords, guitar, phone
        place, note, sample rate, app version, the engine's call at the time). Sent takes are
        deleted from the phone. The key field sits on the booth page, stored like the AI key; a unit test
        checks it never reaches a backup or share link. **Share** instead hands the WAVs and labels to the
        share sheet.
      - Tests: the WAV writer and the labels (unit); the booth page with a fake mic and the GitHub
        calls mocked with `page.route` (browser).
      - Release (decision 9): built on `no-catch` before any other step changes the app, so shipping it is
        bumping to 4.90.0, rebasing on `origin/main` and pushing the branch to `main` as it stands. Only on
        Graham's "ship".
- [ ] 1b [Graham] **Record in the booth.** Chord: Am, C, D, Em, F, G, A, E, Dm, Cadd9 and one barre chord,
      three takes each, phone on its stand and on the table. Switch: 30 seconds each of G to C, C to Am, Em to
      G, D to A, Am to C (the closest-sounding pair). Then Send.
- [ ] 1c [Opus] **Measure and decide.** Pull the `booth` branch; copy the takes into `tests/audio/booth/`.
      Turn `tools/hearing/measure.mjs` into `tests/audio/checks.test.mjs`: every take through the real checks,
      called right, called wrong and switches counted, failing if any gets worse than the recorded baseline.
      Run the fingerprint experiment (prints from two takes, tested on the third, blended with the textbook
      shape). Make decisions 1 and 8 with the numbers, tune the engine where a take shows a fixable fault, and
      write the results here. Ask Graham for more takes if a chord or pair is thin.
- [ ] 2 [Sonnet] **The Gig stops listening.** `openGig` never calls `listen`; remove the mic button, Hearing
      you, `deafen`, `relisten`, `paintMic`, the "not scored" lines, and the Score my plays row. Update
      `gig.e2e.mjs`, `app3.e2e.mjs`.
- [ ] 3 [Opus] **Stars and stretch pay** in `core/game.js`: the played-through tally (changes played, share of
      the song, run since pause, whole song unpaused, speed), song stars (`starsOf`, `starsSettle`, seeded once
      from `gig.best`), stretch factor, new `gigFans`, `gigTips`, XP. Keep `catchTargets`, `catchAt`,
      `catchClose` renamed `songTargets`, `targetsAt`, `targetsPassed`. Economy tests (risk 5).
- [ ] 4 [Sonnet] **The Gig on the new score.** Crowd fills with the song, run and combo callouts, Show
      complete with stars and the star callout, stars on the song page and in the Songbook. Remove the stage's
      catch marks.
- [ ] 5 [Sonnet] **Wait for me and Follow my tempo go.** The two Tools rows and toasts, `holdFrame`,
      `keepPace`, `catchUp`, Skip this chord, the pill, `waitOn`, `followOn`, `follow`, `FOLLOW`, `tempoStep`,
      `followAhead`, `follow.k` in `loopFactor`. Practice speed and loops stay.
- [ ] 6 [Opus, after step 1c] **Chord check and Switch check.** The judging in `core/neck.js` (`chordCheck`:
      most readings over 1.5 s; `switchCheck`: a two-way call that waits for the sound to settle after a
      strum), unit tested on the booth takes. If decision 8 adopts fingerprints: Chord check's first pass on a
      chord also saves its print (12 numbers per chord in `data.skills.prints`, kept in backups), blended with
      the textbook shape, with "Record it again" on the chord's page. The screens in `practice.js` or a new `checks.js`: lamps in thumb
      reach, the count, speed, personal best, "I can't hear it, I got it". The beat round from today's switch
      lesson. Passport stamps and switch bests saved (`data.skills`).
- [ ] 7 [Sonnet] **The Road and Rehearse on the checks.** Chord and switch steps open the checks; level checks
      need a level song at Gig-ready. Your changes and the soundcheck rank by switch speed and how often the
      change is in your songs. What I hear's chord section tests the checks.
- [ ] 8 [Opus, after decision 3] **Battles and duels on switch speed.** `battleFor` picks a change from your
      songs and a target speed by tier; `chartsShow` becomes `battleSettle` from a Switch check. Duel links
      carry a pair and a speed; the old-link path. Charts and duel screens, Second take, Double set wording.
- [ ] 9 [Sonnet] **Tour quests.** The crowd goal becomes the whole song without pausing; the rotating goal pool.
- [ ] 10 [Sonnet] **Opening night.** The "mic" step becomes "Play an Em for me": Louie gives the reason, the
      phone asks, then a Chord check on Em. "Not now" skips it and the check waits on the Road. Opening night's
      catch wording goes. Update `opening.e2e.mjs`, Tips & gestures.
- [ ] 11 [Sonnet] **Delete what nothing calls.** `catchHear`, `catchOpen`, `CATCH_*`, `relativeOf` if unused,
      `gigPct`, the old crowd and combo code, `data.gig.best` writes, their export names and unit tests.
      `grep` each name before the commit.
- [ ] 12 [Sonnet] **Saves and backups.** Cleaners per risk 3, fixture backup test, `docs/DATA.md`.
- [ ] 13 [Sonnet] **Words.** Grep UI text, tips (`coach.js`), callouts, Merch, Charts, the Band tab, README,
      `docs/ONBOARDING.md` and `CLAUDE.md` for catch, caught, Hearing you, scored, %, land, crowd, "the
      microphone needs to hear". In `CLAUDE.md`: the Gig's description, the Rehearse row, the Open list (drop
      "mic chord check during a play-along"). Move `docs/HEARING-PLAN.md` to `docs/history/` with a line
      saying songs stopped listening in this release and the checks took over.
- [ ] 14 [Opus] **Review.** Read the whole diff for leftovers; the Gig, Show complete, both checks, Charts and
      Rehearse at 390 wide in Dark and Light; economy numbers against today's; screenshots for Graham
      (throwaway `zz_` test, then delete it).
- [ ] 15 [Graham, then Sonnet] **Try it, then ship.** Graham plays a few songs and runs both checks on his
      phone from the branch. On "ship": bump `VERSION` and `CACHE` (decision 6), README feature list, rebase on
      `origin/main`, push to `main`. Remake the visual references when Graham says. Graham deletes the
      `no-catch` branch on github.com.

## Size

About 18 commits over four or five sessions. The big ones are 1a (the booth), 3 (stars and pay), 6 (the checks)
and 8 (battles and duels). Step 6 waits on Graham's booth takes (1b) and the measuring (1c); steps 2 to 5
don't wait on them and can run while he records.

## Surprises

(Write here when something doesn't match the plan.)
