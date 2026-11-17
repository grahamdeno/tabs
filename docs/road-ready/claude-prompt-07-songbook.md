# Step 07 of 9: Songbook

**Model:** Sonnet. **Branch:** `rr-07-songbook`. **Needs:** steps 01 and 04. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 4, 9 and 10, "Mastery marks"), `r10-05-songbook.jpg`, `louie-face-badge.webp`.

## What this step is

The Songbook page (`#/library`) is `renderLibrary()` and `renderList()` in `library.js` (CLAUDE.md's table also mentions `app.js`; check where it is now). Restyle it to match `r10-05`: a title, a search field, filter chips, a hint banner with Louie's face badge, and song rows with an art tile, title, artist, chord chips and mastery dots.

## Graham's decision for this step (edit before pasting)

The spec's mastery marks have three levels ("Learning", "Solid", "Nailed it"); the app stores two (`STATUS` in `library.js`: `learning` "Learning", `got` "Got it").

- [x] Show two levels with the dots: Learning is one dot, Got it is three dots and reads "Got it". No new data.
- [ ] Add a third level (needs a data change in `core.js` and `docs/DATA.md`; make it its own step).

## Files you will touch

- `library.js`: `renderLibrary()`, `renderList()`, `songRow()`, `chipsHTML()`, `todayHTML()` (if it's the hint banner), `setsShelf()` markup only.
- `styles.css`: the Songbook and list rules for the Road Ready looks (search `.row`, `.sw`, `.chips`, `.lib`).
- New image: `art/louie/louie-face-badge.webp` (132 px, shown at 44 px).
- Tests: `tests/e2e/swipe.e2e.mjs`, `chips.e2e.mjs`, `app*.e2e.mjs` where they select Songbook markup.

## What to build

- Title "Songbook" in `--type-title`, with the add button (a 44 px round "+" labelled "Add") on the right. Keep its action.
- Search field: `--rr-card`, radius 10, placeholder "Search or add a song" in `--rr-text-2`, magnifier icon. Keep the existing search behaviour.
- Filter chips as capsules (the existing filters, for example "All 25", "Can play 7", "Almost 5", "Sets"), the active one filled `--rr-amber` with `--rr-on-amber` text, others outlined. Each at least 44 px tall (hit area).
- Hint banner: a slim card with Louie's face badge (44 px, `aria-hidden`) and one line such as "Learn F and 3 more songs open", with a chevron. Only where the app already has such a hint; Louie appears only as this fixed badge, never over rows.
- Song rows: a 44 px art tile (album art if present, otherwise two initials on a colour), title in `--type-headline`, artist in `--type-subhead` `--rr-text-2`, small round chord chips, mastery dots on the right (3 dots, filled amber for the level), "New" and "needs F" tags as today. Rows are at least 56 px tall and wrap at large text: at `data-ax="1"` the chord chips and dots move under the title.
- Mastery dots are `aria-hidden`; the row's label includes "Learning" or "Got it".
- Keep swipe actions, sets, the paste card and every existing control.
- Light mode: cream base, `--rr-card` rows, the same layout.

## Acceptance criteria

1. Matches `r10-05` in dark, works in light.
2. Search, filters, swipes, sets and add all behave as before; their tests pass.
3. Every row and chip is at least 44 px tall; text meets AA in both looks.
4. At `data-ax="1"` rows reflow without truncating titles (titles wrap to two lines at most, then ellipsis is fine for very long titles only if the full title is in the label).
5. Screen reader reads each row as "Kettle Hums, June and the Kettles, Got it" plus any tag.
6. No new motion beyond the existing swipe (which already respects Reduce Motion).

## Screenshot check

Songbook dark, light, and large text, next to `r10-05`. Use made-up song titles and artists in fixtures.

## Don't change

- Search, filters' logic, sorting, sets, swipe behaviour, the Apple catalog search, storage.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-07-songbook`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

