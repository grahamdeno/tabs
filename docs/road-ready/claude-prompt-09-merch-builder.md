# Step 09 of 9: Merch builder and guitar art

**Model:** Opus. **Branch:** `rr-09-merch`. **Needs:** steps 01 to 06. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 5.8 and 8), `r10-11-guitar-lineup.jpg`, `r10-12-finishes-paint.jpg`, `r10-13-finishes-wear.jpg`, `r10-16-finishes-flame-tops.jpg`, `r10-17-finishes-pickguards.jpg`, `r10-18-finishes-hardware.jpg`, `r10-19-merch-builder.jpg`, and `r10-14-v-variants.jpg`, `r10-15-soundhole-variants.jpg` for reference.

## What this step is

This is the largest step, and it changes data, so start by writing a short sub-plan into `docs/ROAD-READY-PLAN.md` (9a, 9b, 9c...) and stop for Graham's go before building. Two parts:

1. **Guitar art.** Today's guitars (`GUITARS` in `core/game.js`, drawn by `fretboard.js` `headstock()` and the pictures in `art/guitars/`) use several headstock shapes (`plain`, `inline`, `book`, `slot`, `point`). Graham's rule: every guitar uses **our rounded 3+3 headstock with no logos**, never a six-in-line or sideways headstock, at near-real scale. The design's bodies by venue are: Porch parlor, Cornerstone dreadnought, Club Slab, Hollow Hill semi-hollow, Swing offset, Comet (spec section 8). The current guitar ids (open, switch, scales, strum, pick, finger, encore) and venues (`VENUES` in `core/turf.js`: Garage, Open mic, Coffeehouse, Club, Theater, Arena, Stadium, Festival headliner) don't line up one to one with the spec's list; propose the mapping in the sub-plan for Graham.
2. **The builder** (`r10-19`) on the Merch table (`renderMerch()` and `tryOn()` in `merch.js`, items in `MERCH` in `core.js`): pick a body, flame top, guard, wear and hardware for a guitar, with prices in tips.

## Files you will touch (confirm in the sub-plan)

- `core/game.js` (`MERCH`, `merchBuy`, `merchState`, `GUITARS`, a new per-guitar finish field), `core.js` re-exports, `docs/DATA.md` (every new stored field), the `clean*` function that validates merch data, unit tests in `tests/core.test.mjs`.
- `merch.js`: `renderMerch()`, `tryOn()`, a new builder view.
- `fretboard.js`: `headstock()` and the picture layering; `art/guitars/`: new layered images (body paint, guard, hardware, wear overlay, long-string overlay) per body, so the builder composites layers instead of shipping every combination.
- `styles.css`: Merch and builder rules.

## What to build (the builder)

- The guitar sits in the case showcase (step 06's case) at the top.
- Category chips: Body, Flame top, Guard, Wear, Hardware.
- Swatch rows of 44 px circles. A locked swatch shows a small lock and reads "Locked, opens at Club" to a screen reader. A selection tick haptic on each swatch (`haptic()`).
- Wear is a segmented control: New, Played, Road worn. Hardware is three dots: chrome, aged nickel, gold.
- "Leave strings long" is a switch (a real checkbox with `role="switch"`). When on, the headstock shows neat coiled string ends.
- The Save button shows the running total: "Save to case, $35 tips". Prices and tiers from spec section 8. Tips are earned only by playing; nothing costs real money.
- Light mode, large text (swatch rows wrap; chips scroll), 44 px targets, AA text, Reduce Motion (no swatch animations).

## Acceptance criteria

1. Graham approved the sub-plan before any code.
2. Every guitar shows the rounded 3+3 headstock, no logos, upright, near-real scale, in the Road neck, Show Complete, Me's case and the builder.
3. The builder matches `r10-19`, saves a build, charges the right tips, and the guitar on the Road and in the case shows the build.
4. Old saved data still loads (a migration in the `clean*` function, with a unit test).
5. Locked swatches can't be bought and say why.
6. Targets, contrast, screen reader labels, Reduce Motion and light mode as in the checklist below.

## Screenshot check

Builder in dark and light, each category open once, a locked swatch, "Leave strings long" on, and large text. The guitar lineup next to `r10-11`.

## Don't change

- How tips are earned, prices of existing items, backdrops, looks (Green Room, Headliner), Louie's finishes (Graham decides those separately).

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-09-merch`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

