# Working on Tabs

The Road (called Tabs before version 3; the repo and storage keys keep the name tabs) is Graham's personal guitar PWA: plain ES modules, no build step, live on
GitHub Pages from `main`. The README's Development section is the architecture
map; docs/DATA.md describes every stored field. Read those before guessing.

## Standing rules (from Graham)

- Versions: a feature is a minor release (2.15.0), a fix is a patch (2.16.1),
  numbered from the release where the defect was found. Bump `VERSION` in
  `core.js` and `CACHE` in `sw.js` together (a test checks they match).
- Don't change how the search bar works. Its look may follow the rest of the
  app (Graham, 2.19.0: bronze piping and frosted glass like the other bars).
- When Graham asks for mockups or an explanation first, give those and wait
  for a go before building.
- The AI never writes lyrics itself (Claude won't reproduce them, and lyrics
  from memory come out wrong). Lyrics come from LRCLIB (Get the song) or
  Graham's own sheet; fetching them from a lyrics source is fine. The one
  place the AI handles lyrics is language practice (German, Spanish or Russian), which translates songs
  already in his library.
- API keys stay on the phone only. Never put a key in the code or in a backup,
  and don't change how keys are stored.
- He uses the phone one-handed, mostly right hand: put actions people reach
  for mid-song in thumb reach (bottom of sheets, `pfoot`, the bar).
- Lines in a gig: 5 by default (Graham, 2026-10-21, confirmed after 4.2.3).
- No ring controls (Graham, 3.19.0): on a phone the rectangular bar is out
  while paused and folds into Play's corner while playing. Don't bring back
  the hold-Play ring, the arc, the island or Play following the hand.
- Writing he sees (UI text, README, commit messages, replies): plain and
  direct, no em dashes.

## Version 4: the gamified Road (agreed 2026-10-20)

The guitar is how you play the game. Design system: three palettes (Light =
Festival Poster, Dark = Neon Midnight, Green = Green Room), flat colour with no
outlines, chunky buttons on a darker lip, Fredoka and Nunito, Louie the amp as
the mascot (no guitar-pick mascot anywhere; 4.14.1 and 4.15.0 removed the last
picks). Text in the accent colour uses `--accent-ink` (contrast in the light
palettes). The mockup canvas artifact has the screens and the Friends board.
Louie's friends (Graham's art, 2026-10-21), redrawn in Louie's style: Lola
guitar, Jax pedal, Tilly tuner, Milo mic, Bex bass amp, Pip pick (rounder,
yellow, never rainbow), Beat bass drum, Slide brass slide, Strap guitar strap
(multicolor is fine), Key keyboard key, Metro metronome, Pickup single-coil,
Whammy whammy bar, Shaker maraca, Reverb tank, Triangle, Looper pedal, Humb
humbucker, Pick-Clip pick holder (the face is on the clip, not the pick), Vial vacuum tube, Bottle-Slide glass slide (4.37.0), Gig-Bag, Kazo kazoo, Tuk ukulele, Capo, Spool string spool, Peg tuning peg (4.38.0). Graham dropped Boomer, Cable and Reed. Drawings are in `friends.js`.

Built, one release each, stopping after each for Graham to try: the look, the
Gig (4.1.0), one song screen (4.2.0), Full (4.4.0), Tour quests (4.5.0), Charts
(4.6.0, 4.11.0), Your band (4.7.0), Rehearse (4.8.0), the Songbook (4.9.0),
cover requests (4.10.0), song duels (4.12.0), Friends and the Friend quest
(4.13.0), the Merch table (4.14.0: kept simple, fans are money, no 7th tab).
The README describes each as it works today.

## Open

- Real-player league (competition step 4, Graham 2026-10-21): real players at
  your tier from a server at App Store launch, computer players filling empty
  spots. Friends stay a separate layer.
- Apple Music ideas not built yet (Apple Music features only work with Apple
  Music turned on): playlists both ways; heavy rotation against the chords he
  knows; other versions and music videos in the Recording sheet; Play together
  on the recording; mic chord check during a play-along ("Chorus, 3rd chord
  sounds like Em"), which also brings "learn from your playing"; small touches
  (about this song, more from this artist, listened vs played).

## Where things are

| Area | File |
|---|---|
| Pure logic (unit tested): storage, markup, backups, tuner maths, German, Strum it; re-exports every topic | `core.js` |
| Core topics: chords, recording, sketch, playing, groove, turf, neck, game (4.15.1) | `core/*.js` (import from `core.js`, not these) |
| Song page, playback, Find songs, router | `app.js` |
| Songbook: search, filters, list, swipes, paste card | `library.js` |
| The band: metronome, drums, bass | `audio.js` |
| AI help: the request to Anthropic, errors, limits | `aihelp.js` |
| Share links, opening a shared link, Play together | `share.js` |
| Listen: recordings, previews, length from the recording | `listen.js` |
| The bar folding into Play's corner while playing, pull down to go back | `fold.js` |
| Settings menu and pages, Recently deleted | `settings.js` |
| Tips, Show me demos, Tips & gestures | `coach.js` |
| Play next, chord charts, Get the song | `findai.js` |
| Tuner | `tuner.js` (+ `heads.js`) |
| Your profile (profile page, share card) | `profile.js` (numbers: `profileOf` in `core.js`) |
| Language practice (German, Spanish, Russian) | `german.js` |
| Rehearse (hub), the neck: lessons, chord string check, switch drill, What I hear | `practice.js` (ladder, grading and the listening numbers `HEAR` in `core.js`) |
| The Road (home, 4.0.0): path, Louie, the Songbook bar (4.9.0; the Songbook page is `renderLibrary` in `app.js`) | `road.js` (path logic `roadPath`, `fansOf`, `playableSongs` in `core.js`) |
| Stat bar, tab bar, More sheet | `hud.js` |
| Tour quests: the month's tour, request line, tonight's setlist | `tour.js` (numbers: `questState`, `questsSettle` in `core.js`) |
| Your band: the Band tab; Louie's friends drawn | `band.js`, `friends.js` (numbers: `bandState`, `bandParts` in `core.js`) |
| Song duels: challenge links, the head-to-head | `duel.js` (numbers: `startDuel`, `takeDuel`, `duelRecord` in `core.js`) |
| Support The Road: the Ko-fi page from More (an in-app tip jar at App Store launch) | `support.js` |
| Merch table: gear, Louie's finishes, gig backdrops, Try it on | `merch.js` (numbers: `MERCH`, `merchBuy`, `rainSettle`, `secondTake` in `core.js`) |
| Charts: weekly chart, records, rival battles | `charts.js` (numbers: `chartState`, `chartsSettle`, `battleFor`, `XP` in `core.js`) |
| Version 4 look: palettes and materials | the "Version 4 look" section at the end of `styles.css` |
| Pull-up drawers: the Tour Map's scene sheet | `drawer.js` (used by `playmap.js`) |
| The Gig: the scored show over a playing song | `gig.js` (scoring: `gigChange` and friends in `core.js`) |
| Offline copy; lists every app file | `sw.js` |

A new app `.js` file (root or `core/`) must be added to `SHELL` in `sw.js` (a test checks). Topic files in `core/` must not read another file's values while loading (only inside functions), since they import each other.

## Tests

- Quick check while working: `node tests/quick.mjs` runs the unit tests plus
  the browser tests that cover the files changed since `origin/main`.
- Graham (2.26.0): don't run the full suite here, it costs too many tokens.
  Before a push run only `node tests/quick.mjs`; the full suite runs in CI
  on every push (`.github/workflows/test.yml`). Graham (2026-10-19): don't
  check CI after every push or report it; look (`gh run list -L 1`) only
  when he asks or something points to a failure there. Most long sleeps in the tests are real
  timers being checked (Play settling after 5 s), so leave those.
- Browser tests use `phone()` from `tests/e2e/harness.mjs`; mock network calls
  with `page.route`. Wait for the thing the next line checks
  (`waitForSelector` / `waitForFunction`), not a fixed `waitForTimeout`; a
  sleep that tests a real timer stays, marked `/* real timer */` (4.15.3).
  - Saves land after the screen changes: to check `localStorage`, wait on the
    saved value itself.
  - After a screen change, `settled(page)` before a tap (the cross-fade holds
    taps off the new screen). `until(cond)` waits on the test's side.
  - The Gig (the main Play path) has its own file, `gig.e2e.mjs`; elsewhere
    `LIB` sets `plainPlay: true`.
- Edit with exact, unique matches and check what changed: a find-and-replace
  that hit the old ring instead of More shipped broken buttons in 3.13.0/3.14.0.
- Screenshots for Graham: write a throwaway `tests/e2e/zz_*.e2e.mjs` that
  saves to `$SHOT`, run it, then delete it.
- Visual references: CI compares screens against `tests/visual/ci` in a step
  that can't turn the run red (4.14.1), since a release that changes a screen
  differs until they're remade. Graham (2026-10-21): remake them once the
  clean-up plan's step 4 is in; after that, remake when he says. To remake:
  `gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`.
- CI's annotation lists every failing test with its location and message, and
  the a11y test (axe) must pass. Read it with
  `gh api repos/grahamdeno/tabs/commits/<sha>/check-runs` and the check run's
  `/annotations` (the sandbox can't download logs).
- Mockup screenshots cost tokens: make them only when Graham asks for a
  mockup or a change can't be judged without one.
- ESLint is installed here: run `eslint .` before a push (CI runs it too).

## Releasing

1. Change, add or update tests, bump the version, update the README feature
   list when behavior changes.
2. Commit with a message that says what changed for Graham, in plain words.
3. Quick test run, then `git fetch origin main && git rebase origin/main` and
   push to `main`. The screenshot workflow commits to `main` too, so always
   rebase first.
4. The cloud sandbox can't delete branches or call GitHub's write APIs other
   than workflow dispatch; ask Graham to do those on github.com.

## Larger jobs: plan with Opus, run with Sonnet

For a clean-up or a multi-release job, Opus writes a plan file (like
docs/history/AUDIT-PLAN.md) with numbered steps, each marked [Sonnet] or [Opus] and
any decisions Graham needs to make listed up top. Whoever runs a step: one
task per commit, `eslint .` and `node tests/quick.mjs`, bump the patch at the
end of a step that changes app files, rebase and push. When something doesn't
match the plan, stop that task and write it under "Surprises" in the plan
file. Tell Graham which model the next step wants. Don't use Haiku.
