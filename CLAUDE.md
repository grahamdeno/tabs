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
  for mid-song in thumb reach (bottom of sheets, `pfoot` / the ring).
- Writing he sees (UI text, README, commit messages, replies): plain and
  direct, no em dashes.

## Next up (Graham's order, agreed 2026-10-19)

Apple Music features only work with Apple Music turned on. Stop after each
release so Graham can try it.

1. 3.17.0 Automatic line timing: LRCLIB's synced lyrics give each line's time
   in the recording; match them to the sheet's lines and save them as sync
   marks (only the times are kept). Also move Apple Music out of Settings >
   Keys into its own Settings row.
2. 3.18.0 Preview analysis: Apple's 30-second preview (not copy protected)
   gives the true tempo, swing and key; flag a sheet in the wrong key or capo.
3. 3.19.0 Drums that fit the song: the AI returns a 16-step kick, snare and
   hat grid per section (fills, sparse verse, full chorus) from the measured
   tempo and feel, genre and year; Busier / Simpler kept per song.
4. 3.20.0 Just heard it: Apple's recently played offers "Play along?" on
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
| Ring controls, Play following the hand | `ring.js` |
| Settings menu and pages, Recently deleted | `settings.js` |
| Tips, Show me demos, Tips & gestures | `coach.js` |
| Play next, chord charts, Get the song | `findai.js` |
| Tuner | `tuner.js` (+ `heads.js`) |
| Your playing (profile page, share card) | `profile.js` (numbers: `profileOf` in `core.js`) |
| German practice | `german.js` |
| The neck: lessons, chord string check, switch drill, What I hear | `practice.js` (ladder, grading and the listening numbers `HEAR` in `core.js`) |
| Pull-up drawers: Tonight's Library, the Tour Map's scene sheet | `drawer.js` (used by `road.js`, `playmap.js`) |
| Offline copy; lists every app file | `sw.js` |

A new app `.js` file must be added to `SHELL` in `sw.js` (a test checks).

## Tests

- Quick check while working: `node tests/quick.mjs` runs the unit tests plus
  the browser tests that cover the files changed since `origin/main`.
- Graham (2.26.0): don't run the full suite here, it costs too many tokens.
  Before a push run only `node tests/quick.mjs`; the full suite runs in CI
  on every push (`.github/workflows/test.yml`). Check the CI result instead
  with `gh run list -L 1` if needed. Most long sleeps in the tests are real
  timers being checked (Play settling after 5 s), so leave those.
- Browser tests use `phone()` from `tests/e2e/harness.mjs`; mock network calls
  with `page.route`. Prefer `waitForSelector` / `waitForFunction` over fixed
  `waitForTimeout` sleeps in new tests.
- On a phone the ring layout (island, arc, hold Play) is out only while a
  song plays; paused, the whole bar shows (3.16.0). A test of the ring's own
  gestures while paused calls `forceRing(page)` from the harness, again after
  every `page.goto` (a reload clears it).
- Edit with exact, unique matches and check what changed: a find-and-replace
  that hit the ring instead of More shipped broken buttons in 3.13.0/3.14.0.
- Screenshots for Graham: write a throwaway `tests/e2e/zz_*.e2e.mjs` that
  saves to `$SHOT`, run it, then delete it.
- Visual references: CI compares against `tests/visual/ci`, so a release that
  changes how a screen looks shows as a visual difference in CI until they're
  remade. Graham's rule: don't remake them after each UI change. Count
  releases and ask him after 10. Last remade at 3.11.0 (dispatched 2026-10-19); releases since: 6 (3.12.0, 3.13.0, 3.13.1, 3.14.0, 3.15.0, 3.16.0). To remake when he says yes:
  `gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`.
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
