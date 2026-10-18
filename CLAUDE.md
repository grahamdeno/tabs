# Working on Tabs

Tabs is Graham's personal guitar PWA: plain ES modules, no build step, live on
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
- The AI never supplies lyrics. The one exception is German practice, which
  translates lyrics of songs already in his library.
- API keys stay on the phone only. Never put a key in the code or in a backup,
  and don't change how keys are stored.
- He uses the phone one-handed, mostly right hand: put actions people reach
  for mid-song in thumb reach (bottom of sheets, `pfoot` / the ring).
- Writing he sees (UI text, README, commit messages, replies): plain and
  direct, no em dashes.

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
- Screenshots for Graham: write a throwaway `tests/e2e/zz_*.e2e.mjs` that
  saves to `$SHOT`, run it, then delete it.
- Visual references: CI compares against `tests/visual/ci`, so a release that
  changes how a screen looks shows as a visual difference in CI until they're
  remade. Graham's rule: don't remake them after each UI change. Count
  releases and ask him after 10. Last remade after 2.16.0; releases since:
  2.16.1 to 2.16.6, 2.17.0, 2.17.1, 2.18.0, 2.19.0, 2.19.1, 2.20.0, 2.21.0, 2.22.0, 2.23.0, 2.24.0, 2.24.1, 2.25.0, 2.26.0, 2.26.1, 2.26.2, 2.27.0, 2.28.0, 2.28.1, 2.29.0, 2.29.1, 2.29.2, 2.30.0, 2.30.1, 2.31.0, 2.32.0, 2.32.1, 2.33.0, 2.33.1, 2.34.0, 2.34.1, 2.35.0, 2.35.1, 2.35.2, 2.36.0, 2.37.0, 2.38.0, 2.38.1, 2.38.2, 2.39.0, 2.40.0, 2.41.0, 2.42.0, 2.43.0, 2.44.0, 2.45.0, 2.46.0, 2.47.0 (53: asked at 2.19.0, waiting). To remake when he says yes:
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
