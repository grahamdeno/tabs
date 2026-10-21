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
  place the AI handles lyrics is German practice, which translates songs
  already in his library.
- API keys stay on the phone only. Never put a key in the code or in a backup,
  and don't change how keys are stored.
- He uses the phone one-handed, mostly right hand: put actions people reach
  for mid-song in thumb reach (bottom of sheets, `pfoot`, the bar).
- No ring controls (Graham, 3.19.0): on a phone the rectangular bar is out
  while paused and folds into Play's corner while playing. Don't bring back
  the hold-Play ring, the arc, the island or Play following the hand.
- Writing he sees (UI text, README, commit messages, replies): plain and
  direct, no em dashes.

## Version 4: the gamified Road (agreed 2026-10-20)

The guitar is how you play the game. Design system: three palettes (Light =
Festival Poster, Dark = Neon Midnight, Green = Green Room), flat colour with no
outlines, chunky buttons on a darker lip, Fredoka and Nunito, Louie the amp as
the mascot (no guitar-pick mascot). The mockup canvas has nine screens. 4.0.0
shipped the look, Louie, the stat bar, the tab bar and the Road path; 4.0.1 put
every screen on the design system; 4.1.0 shipped the Gig (`gig.js`, scoring in
`core.js`: gigChange and friends) with Show complete and Encore, and the Louie
icon (Take 3A up close on pink; Take 2's whole body for launch screens). Graham
wants the Gig to show more than 2 lines (4 to 6, Lines in a gig in Tools; settle
the default after he tries it). 4.2.0 replaced the song page with one song
screen built from Gig parts: Play opens the Gig (plain scroll while practicing
a section or slower, for tabs, or with Play as a gig off), Tools is one bottom
sheet, Pause holds the show in place (Back a line, Tools, Sheet, Resume), and
Hearing you turns scoring off per show (Score my plays sets the default).
Louie's friends (Lola guitar, Jax pedal, Tilly tuner, Milo mic, Bex bass amp,
Pip pick; Graham's art, 2026-10-21) get redrawn in Louie's style for Your band,
mockup first. Pip stays but must not be rainbow. Eleven more (2026-10-21): Beat
bass drum, Slide brass slide, Strap guitar strap, Key keyboard key, Reed
clarinet reed, Cable audio cable, Boomer boom mic, Metro metronome, Pickup
single-coil, Whammy whammy bar; 17 in all, collected as rewards. Still to build, one release each, stopping after
each for Graham to try: Tour quests, Charts (record tiers,
promotion, rival battles), Your band (players join by venue, heard in the
backing), Rehearse hub, Merch table (spend fans on gear, Louie finishes,
backdrops). XP arrives with Charts; until then the Road shows fans.

## Next up (Graham's order, agreed 2026-10-19)

Apple Music features only work with Apple Music turned on. Stop after each
release so Graham can try it.

0. Done in 3.21.0. The Neck shows Learning songs on top
   (cover, progress, the one thing to do next; a tap opens the song in
   Practice mode on that section) with Skills below, plus a new Scales section
   (lessons and listening, like the chord lessons). Practice mode on the song:
   a Practicing chip and one Practice row (section, speed, Build up, drums,
   Check me) that replaces the loop banner; Learning songs open in it.
   The cover header on Listen and Get the song followed in 3.23.0.
   German practice stays on its chip under the title (Graham), not in the
   Practice row.
0b. Done in 3.22.0. Chord timing without a paid service. Spread
   each LRCLIB line's words over its time by syllables and snap chord changes
   to the measured beat grid (3.18.0); use LRCLIB's word-level times when a
   song has them. "Learn from your playing" (mic hears your chord changes)
   goes with the mic chord check (#9). No Musixmatch.
1. Done in 3.17.0. Automatic line timing: LRCLIB's synced lyrics give each line's time
   in the recording; match them to the sheet's lines and save them as sync
   marks (only the times are kept). Also move Apple Music out of Settings >
   Keys into its own Settings row.
2. Done in 3.18.0 (needs the Worker redeployed once for /preview). Preview analysis: Apple's 30-second preview (not copy protected)
   gives the true tempo, swing and key; flag a sheet in the wrong key or capo.
3. Done in 3.23.0. Drums that fit the song: the AI returns a 16-step kick, snare and
   hat grid per section (fills, sparse verse, full chorus) from the measured
   tempo and feel, genre and year; Busier / Simpler kept per song.
4. Done in 3.24.0. Just heard it: Apple's recently played offers "Play along?" on
   Tonight.
5. 3.21.0 Playlists both ways: import an Apple Music playlist into the
   library; save a set as an Apple Music playlist.
6. 3.22.0 You listen to it, now play it: heavy rotation (and Replay, if the
   API allows) against the chords he knows.
7. 3.23.0 In the Recording sheet: other versions (acoustic, live) and Watch
   it live (music videos).
8. 3.24.0 Play together on the recording.
9. 3.25.0 Mic chord check during a play-along ("Chorus, 3rd chord sounds
   like Em").
10. Small touches, batched: About this song notes, more from this artist,
    similar artists, genre charts, new in library, Your playing by decade and
    genre, listened vs played.

## Where things are

| Area | File |
|---|---|
| Pure logic, parsing, chords, Changes, tuner math (unit tested) | `core.js` |
| Library, song page, playback, Find songs, router | `app.js` |
| Share links, opening a shared link, Play together | `share.js` |
| Listen: recordings, previews, length from the recording | `listen.js` |
| The bar folding into Play's corner while playing, pull down to go back | `fold.js` |
| Settings menu and pages, Recently deleted | `settings.js` |
| Tips, Show me demos, Tips & gestures | `coach.js` |
| Play next, chord charts, Get the song | `findai.js` |
| Tuner | `tuner.js` (+ `heads.js`) |
| Your playing (profile page, share card) | `profile.js` (numbers: `profileOf` in `core.js`) |
| German practice | `german.js` |
| The neck: lessons, chord string check, switch drill, What I hear | `practice.js` (ladder, grading and the listening numbers `HEAR` in `core.js`) |
| The Road (home, 4.0.0): path, Louie, Library drawer | `road.js` (path logic `roadPath`, `fansOf`, `playableSongs` in `core.js`) |
| Stat bar, tab bar, More sheet, Coming soon (Tour, Charts, Band) | `hud.js` |
| Version 4 look: palettes and materials | the "Version 4 look" section at the end of `styles.css` |
| Pull-up drawers: the Road's Library, the Tour Map's scene sheet | `drawer.js` (used by `road.js`, `playmap.js`) |
| Offline copy; lists every app file | `sw.js` |

A new app `.js` file must be added to `SHELL` in `sw.js` (a test checks).

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
  with `page.route`. Prefer `waitForSelector` / `waitForFunction` over fixed
  `waitForTimeout` sleeps in new tests.
- Edit with exact, unique matches and check what changed: a find-and-replace
  that hit the old ring instead of More shipped broken buttons in 3.13.0/3.14.0.
- Screenshots for Graham: write a throwaway `tests/e2e/zz_*.e2e.mjs` that
  saves to `$SHOT`, run it, then delete it.
- Visual references: CI compares against `tests/visual/ci`, so a release that
  changes how a screen looks shows as a visual difference in CI until they're
  remade (expected; not a real failure). Graham (2026-10-19): don't remake
  them and don't ask for 15 more releases counted from 3.19.0. Releases since
  3.19.0: 6 (3.20.0 to 3.24.0, 4.0.0). 4.0.0 changed every screen's look. To remake when he says yes:
  `gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`.
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
