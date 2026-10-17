# Tabs: notes for Claude

Personal guitar PWA (chord sheets first), live on GitHub Pages from `main`.
No build step, no server, no dependencies at run time. The README's
Development section and docs/DATA.md have the full detail; this is the short
version for starting work quickly.

## Standing rules from the owner

- Releases: a feature (or set of features) is a minor release (2.15.0); a fix
  is a patch on the release where the defect was found (2.15.1). Bump
  `VERSION` in `core.js` and `CACHE` in `sw.js` together (a test checks).
- Don't change the search bar.
- When he asks for a mockup or an explanation, give it before building.
  Mockups: render the real app in Playwright and inject markup that uses the
  app's own classes, then send the screenshot.
- The AI never supplies lyrics. The one exception: German practice may
  translate the words of a song already in his library.
- API keys stay on the phone only (localStorage). Never in backups, share
  links, the repo, or a server. Don't change how keys are stored.
- Phone used one-handed, right thumb: put actions within thumb reach (the
  bottom of the screen, `.pfoot` in sheets).
- Plain, professional wording in the UI and in replies; no em dashes.
- Every change ends with: tests pass, README updated where a feature is
  described, commit with a release message, push to `main`.

## Where things are

| File | What |
|---|---|
| `core.js` | Logic with no screen code, all unit tested: parsing, transposing, chords, data and backups, share links, Today and Changes, tuner math, pitch detection |
| `app.js` | Library, song page (auto-scroll, count-in, Now and Next, map), router, AI helpers (`askClaude`, `parseJSON`, `aiError`), share links, Play together |
| `ui.js` | Icons (`I`, `icon()`), toasts, `ask()` sheets, `onLeave`, `onScroll` |
| `settings.js` | Settings menu and its pages (`#/settings/<page>`), Recently deleted |
| `coach.js` | One-time tips (`coachTip`, `tipDue`, `markUsed`), Show me demos, Tips & gestures |
| `ring.js` | One-hand controls: the island, hold Play for the ring, Play follows the hand |
| `findai.js` | Get the song, chord charts, What can I play next? |
| `tuner.js` | Tuner (headstock drawings in `heads.js`) |
| `german.js`, `aitools.js`, `sketch.js`, `strum.js`, `sets.js`, `editor.js`, `store.js`, `dial.js`, `crop.js` | One feature each; see the comment at the top of each file |
| `sw.js` | Offline copy; its `SHELL` list must name every app file (a test checks) |
| `styles.css` | All styles; newest features are appended at the end with a version comment |

Lazy modules are loaded on first use; a new module must be added to `SHELL`
in `sw.js`. Shared state is changed only through its owner's setters.

## Tests

- Unit: `node --test tests/core.test.mjs` (seconds).
- Quick check while working: `node tests/quick.mjs` runs the unit tests plus
  the browser tests that cover the files changed since `origin/main`.
- Full: `node --test --test-concurrency=3 tests/*.test.mjs tests/e2e/*.e2e.mjs`
  (run it in the background before every push). Without the concurrency flag
  this two-core machine runs one file at a time.
- Browser test helpers are in `tests/e2e/harness.mjs`: `phone(t, lib, opts)`
  opens a fresh phone with a library; `LIB` is the test library. Mock the AI
  with `page.route(/api\.anthropic\.com/, ...)`.
- Prefer waiting on a condition (`waitForSelector`, `waitForFunction`) over
  `waitForTimeout`.
- Screenshots: CI compares against `tests/visual/ci/`. After a change to how
  a screen looks, run the update screenshots workflow:
  `gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`
  (it commits to `main`, so fetch and rebase before the next push).

## This environment

- `gh` can push and dispatch workflows, but branch deletion is blocked.
- The npm registry and most websites are blocked from the shell, so ESLint
  runs only in CI. `api.anthropic.com` can't be called without a key; test
  AI features with mocks.
