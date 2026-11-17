# Step 05 of 9: The playing screen (immersive, controls hide on their own)

**Model:** Opus. **Branch:** `rr-05-playing`. **Needs:** steps 01 and 03. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 6 and 7), `r10-07-playing-hidden.jpg`, `r10-08-playing-shown.jpg`, `r10-09-playing-first-run-hint.jpg`, `r10-10-playing-ax-text.jpg`, `louie-listen-dark.webp` and `louie-listen-light.webp`.

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

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-05-playing`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **Releases.** Bump the version the way CLAUDE.md and the README's Releases section say (VERSION in `core.js` and CACHE in `sw.js` move together; `index.html` says this may happen automatically on push to main, so check and don't bump twice). A new `.js` file goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Screenshots.** Make them the CLAUDE.md way: a throwaway `tests/e2e/zz_*.e2e.mjs` using `phone()` that saves to `$SHOT`, run it, then delete it before you commit. Take these, as PNGs, and put them in the PR description: phone dark, phone light, and phone dark with large text (see "Large text" below). Compare each one side by side with the round 10 image named in this prompt and list any differences you chose to leave.
- **Writing.** Every word Graham or a player sees (UI text, comments he reads, commit messages, the PR) is plain and direct, with no em dashes. Any lyrics in tests or fixtures are made up, never real song lyrics.
- **Louie hard rules.** Louie is Road Ready: a blue 1x12 combo amp with a yellow control-panel face. Exactly one mouth, always on the yellow panel between the eyes and the four cream knobs. The grille is plain navy cloth and is never a face (no mouth, smile line or features on it). Mitten hands with no fingers. No blush or cheek spots, no guitar pick, no amp brand logos. He is a character who cheers the player on; never call him an AI or an assistant.
- **Product rules.** Encouraging, never guilt: no streak-loss warnings, sad faces or "you missed a day" copy in anything you add. Not a coin-path game board. Tolex and amp parts, not cartoon chrome. Tab icons are our own drawings. No lamps and no VU gauge anywhere you touch.

### How the spec maps to this web app

The spec (`docs/road-ready/louie-design-spec.md`) was written in iOS terms. Build it with HTML, CSS and SVG in this repo, like this:

| Spec says | Build it here as |
|---|---|
| pt | CSS px (1 pt is 1 CSS px on iPhone) |
| Dynamic Type, `relativeTo:` | `rem` sizes from the `--type-*` tokens (step 01 sets the root size from `-apple-system-body`, so iOS text size settings scale it) |
| AX sizes (AX1+, AX3+) | `:root[data-ax="1"]`, `:root[data-ax="3"]` (step 01 sets these from the measured root size) |
| Asset catalog colours, light and dark | CSS custom properties on the Road Ready looks in the "Version 4 look" section of `styles.css` |
| Reduce Motion | `@media (prefers-reduced-motion: reduce)` |
| VoiceOver labels, hidden decorative images | `aria-label`, real `<button>`s, `role`, `aria-hidden="true"` on decorative art, visible text as the label where possible |
| VoiceOver or Switch Control running | Not detectable on the web. Use: never hide controls while focus is inside them, show them on any key press, and the "Keep playing controls on screen" setting (step 05) |
| `Shape`, `Canvas`, `Path` | Inline SVG (or `<canvas>` only for particles) |
| SwiftUI notes, section 10 | Reference only, for intent. Don't add Swift files |

### Accessibility checklist (every step)

- Text sizes come from the `--type-*` tokens in rem, so they grow with the iPhone text size. Nothing truncates that the spec says wraps.
- Every tap target is at least 44 by 44 px (use padding or a hit area, not a bigger drawing).
- Text contrast meets WCAG AA: 4.5:1 for body text, 3:1 for large text (24 px, or 19 px bold) and for icons. Use the spec's tokens; never dim text with opacity.
- Motion follows the spec's motion table, with the Reduce Motion column under `prefers-reduced-motion: reduce`.
- Screen reader: every control has a name, decorative art is `aria-hidden`, and order follows the screen top to bottom.
- Light and dark both work: check the Road Ready dark look and the Road Ready light look.

**Large text.** For the large-text screenshot, set the root font size the way step 01's `data-ax` code reads it (for example `document.documentElement.style.fontSize = "33px"` before the screen draws, which is about AX2), and confirm `data-ax="1"` is set.

