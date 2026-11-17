# HANDOFF FOR CLAUDE OPUS: Road Ready step 05 of 9, the playing screen, in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging into `road-ready` waits for Opus's review and Graham's merge go.
- Do not push to `main`, open a pull request into `main`, or run any workflow on CLAUDE.md's upload and deploy list (a push to `main` publishes the live app on GitHub Pages; don't dispatch the screens workflow).
- Push only this step's branch, `rr-05-playing`. Touch no other branch. In the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.
- Do not bump VERSION or CACHE.
- Do not remove a feature, a Merch item or stored data without Graham's yes. Old stored data stays in place.

**Read first:** grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`. Then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`.

**Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 6 and 7), `r10-07-playing-hidden.jpg`, `r10-08-playing-shown.jpg`, `r10-09-playing-first-run-hint.jpg`, `r10-10-playing-ax-text.jpg`, `louie-listen-dark.webp` and `louie-listen-light.webp`.

**Branch:** `rr-05-playing`, from `road-ready`. The pull request goes into `road-ready`.
**Needs:** step 04 merged into `road-ready`.
**Model:** Opus builds. **Always review:** yes (it is the core flow (the Gig), it adds a stored setting, and existing tests change).
**Touch:** the files under "Files you will touch". **Don't touch:** everything under "Don't change", `main`, and every other branch.

## What this step is

The Gig (`gig.js`) is already words first (CLAUDE.md: "The Gig is words first (4.46.0): no Lines in a gig and no Full; the words fill the screen"), and it already hides its controls after 3 s (`bindIdle()` adds an `idle` class). This step makes it look like `r10-07` and `r10-08`, adds the first-run hint, and makes the hiding safe for screen reader, switch and keyboard users.

## Files you will touch

- `gig.js`: `shell()` (the markup), `bindIdle()`, `openGig()`, `paused()`.
- `stage.js`: only the styling hooks it puts on the sheet (`stageGel`, the lit chord, the current line); don't change where it reads the song position.
- `app.js`: only if the sheet's current-line class needs a hook for "sung" lines (lines above the current one). Prefer CSS on the existing classes.
- `settings.js`: one new switch, "Keep playing controls on screen", stored in `data.settings` (document the field in `docs/DATA.md`).
- `styles.css`: the `body.playing` and `.sheet` rules for the Road Ready looks, and the Gig's own rules (search `.gig` and `body.playing`).
- New images: `art/louie/louie-listen-dark.webp` and `-light.webp`.
- `docs/ONBOARDING.md` (the first-run hint is a new tip), `tests/e2e/gig.e2e.mjs`.

## What to build

- **Lyrics fill the screen** over `--rr-base` (no tolex grain behind lyrics; plain base for reading). 20 px side margins, almost no top or bottom margin.
- **Line sizes and colours:** the current line in `--type-lyric-now` and `--rr-lyric-now`; the next two or three lines in `--type-lyric-next` and `--rr-lyric-next`; lines already sung in `--type-lyric-sung` and `--rr-lyric-sung`. Lines wrap at word boundaries and never truncate. **Don't dim with opacity**: replace the existing `body.playing .sheet.focus > *:not(.cur) { opacity: .5 }` style on the Road Ready looks with the colour tokens. A 3 px amber bar at the left of the current line, as in `r10-07`.
- **Chords** sit above their syllables in `--type-chord`, `--rr-chord` (amber in dark, #763A00 in light). Keep the existing chord placement; only restyle.
- **Progress:** a 2 px amber hairline along the bottom edge, always visible, `aria-hidden` (the time is announced by the controls).
- **Controls** (close, song title and artist, speed, play or pause, loop) as in `r10-08`: close at top left, title centred at the top, and a dark capsule at the bottom in thumb reach with speed, a big amber play or pause, and loop. Keep every existing control and its action; this is a restyle of what `shell()` and the paused state already have. Each is at least 44 px.
- **Auto-hide** (keep `bindIdle()`'s logic and its 3 s): the controls fade out after 3 s without interaction while playing, and any tap, key or scroll brings them back and restarts the timer. Add:
  - Never hide while keyboard focus is inside the controls (`document.activeElement` within them).
  - Any key press shows the controls; Space toggles play and pause (check what `keydown` already does and don't double-handle it).
  - The new setting "Keep playing controls on screen" (off by default) turns auto-hide off. In Settings, its explanation says: "For VoiceOver, Switch Control or if you like seeing them."
  - The web can't tell whether VoiceOver or Switch Control is on, so also keep the controls visible whenever a control receives focus from a screen reader (a `focusin` without a preceding pointer event), until the song is paused or ends.
- **Motion:** show and hide with a 0.25 s ease-out fade plus an 8 px slide. Under Reduce Motion, a plain 0.2 s opacity fade with no slide. Lyrics follow the song smoothly; under Reduce Motion they snap line by line instead of scrolling smoothly (check `startScroll` in `app.js` for an existing reduced-motion path and reuse it).
- **First-run hint** (`r10-09`): the first time a gig starts, a small cream frame near the bottom says "Tap anywhere for controls", with the listening Louie image (about 60 px, `aria-hidden`) beside it. It goes away on the first tap and never comes back. Store it the way other one-time tips are stored (`data.settings.used`, see `coach.js`), and add the row to `docs/ONBOARDING.md`.
- **Large text** (`r10-10`): fewer lines at a bigger size, wrapping at word boundaries. With `data-ax="1"` and up, show only the current line and the next one or two.
- **Light mode:** cream base, dark text, amber-brown chords; same layout.
- No fretboard and no gauge on this screen. Keep whatever else the Gig shows today (the crowd row, the band on the sheet, the section colour). If any of those clash with `r10-07`, list them in Surprises for Graham instead of removing them.

## Acceptance criteria

1. Matches `r10-07` (hidden), `r10-08` (shown) and `r10-09` (first run) in dark, and works in light.
2. Controls hide after 3 s of no interaction while playing and come back on tap, key or scroll. Uses the existing real timer; keep the `/* real timer */` marker in tests.
3. With "Keep playing controls on screen" on, they never hide. With focus inside the controls, they never hide.
4. Space toggles play and pause; any key shows the controls.
5. The first-run hint shows once and never again (browser test reloads and checks).
6. Contrast: sung lines at least 4.5:1 (dark #8F877C on #141210 is 5.3:1; light #6E655B on #FBF7EF is 5.4:1), chords at least 4.5:1.
7. Under Reduce Motion, the fade is 0.2 s with no slide, and lyrics snap by line.
8. At `data-ax="1"`, no lyric line truncates and nothing overlaps the controls.
9. `tests/e2e/gig.e2e.mjs` passes, plus new tests for 3 to 5.

## Screenshot check

Playing with controls hidden, shown, the first-run hint, and large text, in dark; hidden and shown in light. Each next to its `r10` image. Use made-up lyrics in the test song.

## Don't change

- Scoring, the show logic, `gigStart` and friends in `core.js`, the band, the metronome, how the song position is read.
- Lyrics sources (LRCLIB or Graham's sheet) and the rule that the AI never writes lyrics.
- The no-ring rule (CLAUDE.md, 3.19.0): don't bring back the hold-Play ring, arc or island.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`, then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow their rules. Where they conflict, the stricter rule wins; raise the conflict with Graham.
- **Branch rule.** All Road Ready work collects on one integration branch, `road-ready`, cut from `main`. This step uses its own branch, `rr-05-playing`, made from a fresh `origin/road-ready` (`git fetch origin road-ready`), and opens one pull request **into `road-ready`**, never into `main`. Don't push to `main`, don't merge anything, and don't touch any other branch. `main` gets the whole redesign as one release only when Graham says ship. For this redesign, this replaces CLAUDE.md's "push to main". If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **No version bump.** Don't change VERSION in `core.js` or CACHE in `sw.js` in any step. The version is bumped once, when `road-ready` goes to `main` on Graham's ship go. (A test checks the two match; leaving both alone keeps it green.) A new `.js` file still goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Pull request.** Use the playbook's PR format (`templates/pr.md`): Status "Waiting for review", Triggers "Uploads and deploys nothing" (the PR targets `road-ready`, which deploys nothing), What changed, Tests actually run (counts, or "not run" and why; never claim a pass you didn't see), the acceptance criterion to test table, Limitations, a phone review checklist of three items at most, Built by, Reviewed by, and "Next step: Opus reviews". Title in plain words, starting "Road Ready 05:".
- **Screenshots.** Make them the CLAUDE.md way: a throwaway `tests/e2e/zz_*.e2e.mjs` using `phone()` that saves to `$SHOT`, run it, then delete it before you commit. Take these, as PNGs, and put them in the PR description: phone dark, phone light, and phone dark with large text (see "Large text" below). Compare each one side by side with the round 10 image named in this prompt and list any differences you chose to leave.
- **Writing.** Every word Graham or a player sees (UI text, comments he reads, commit messages, the PR) is plain and direct, with no em dashes. Any lyrics in tests or fixtures are made up, never real song lyrics.
- **Louie hard rules.** Louie is Road Ready: a blue 1x12 combo amp with a yellow control-panel face. Exactly one mouth, always on the yellow panel between the eyes and the four cream knobs. The grille is plain navy cloth and is never a face (no mouth, smile line or features on it). Mitten hands with no fingers. No blush or cheek spots, no guitar pick, no amp brand logos. He is a character who cheers the player on; never call him an AI or an assistant.
- **Product rules.** Encouraging, never guilt: no streak-loss warnings, sad faces or "you missed a day" copy in anything you add. Not a coin-path game board. Tolex and amp parts, not cartoon chrome. Tab icons are our own drawings. No lamps and no VU gauge anywhere you touch.

### How the spec maps to this web app

The spec (`louie-design-spec.md`) was written in iOS terms. Build it with HTML, CSS and SVG in this repo, like this:

| Spec says | Build it here as |
|---|---|
| pt | CSS px (1 pt is 1 CSS px on iPhone) |
| Dynamic Type, `relativeTo:` | The `--type-*` tokens. They scale with `--sys-px`, which step 01 sets from the iPhone text size that `readSysText()` in `app.js` already measures |
| AX sizes (AX1+, AX3+) | `:root[data-ax="1"]`, `:root[data-ax="3"]` (step 01 sets these from the same measurement) |
| Asset catalog colours, light and dark | CSS custom properties on the Road Ready looks only (`:root[data-look="neon"]` and `:root[data-look="festival"]`) in the "Version 4 look" section of `styles.css`. Never on `:root[data-theme="light"]` or `:root[data-theme="dark"]` alone: Green Room is also `data-theme="light"` and Headliner is also `data-theme="dark"` |
| Reduce Motion | `@media (prefers-reduced-motion: reduce)` |
| VoiceOver labels, hidden decorative images | `aria-label`, real `<button>`s, `role`, `aria-hidden="true"` on decorative art, visible text as the label where possible |
| VoiceOver or Switch Control running | Not detectable on the web. Use: never hide controls while focus is inside them, show them on any key press, and the "Keep playing controls on screen" setting (step 05) |
| `Shape`, `Canvas`, `Path` | Inline SVG (or `<canvas>` only for particles) |
| SwiftUI notes, section 10 | Reference only, for intent. Don't add Swift files |

### Accessibility checklist (every step)

- Text sizes come from the `--type-*` tokens, so they grow with the iPhone text size. Nothing truncates that the spec says wraps.
- Every tap target is at least 44 by 44 px (use padding or a hit area, not a bigger drawing).
- Text contrast meets WCAG AA: 4.5:1 for body text, 3:1 for large text (24 px, or 19 px bold) and for icons. Use the spec's tokens; never dim text with opacity.
- Motion follows the spec's motion table, with the Reduce Motion column under `prefers-reduced-motion: reduce`.
- Screen reader: every control has a name, decorative art is `aria-hidden`, and order follows the screen top to bottom.
- Light and dark both work: check the Road Ready dark look and the Road Ready light look, and check that Green Room and Headliner look exactly as before.
- No guilt: nothing you add shames a missed day or a lost streak (playbook rule 36).

**Large text.** For the large-text screenshot, after the screen draws, set `--sys-px: 33px` and `data-ax="1"` on `document.documentElement` (about AX2; the test browser can't report an iPhone text size), wait a frame, then shoot.

### Done when

- [ ] Each acceptance criterion has a test, or says how it is checked (device or screenshot, "not run yet"), in the PR's criterion to test table.
- [ ] `eslint .` and `node tests/quick.mjs` run, with the counts in the PR. CI started; don't sit and wait for it.
- [ ] PR open into `road-ready` in the playbook's format, marked "Waiting for review".
- [ ] Once Opus's review passes: a row in `docs/sonnet-log.md` in the same PR, with your model version (Sonnet-built steps only).

**If this step isn't Ready** (a criterion can't be tested, a question is open, or Graham hasn't answered a "Confirm with Graham" item), stop and say what's missing. Don't decide product questions.

**Report back in chat:** the PR link, the tests table, the screenshots, and anything you couldn't do.
**Next step after this: Opus** reviews the PR (a separate Opus conversation if Opus built it), then Graham gives the merge go into `road-ready`.

