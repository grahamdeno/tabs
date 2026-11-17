# Step 08 of 9: Me and the guitar case

**Model:** Sonnet. **Branch:** `rr-08-me`. **Needs:** steps 01, 03 and 04. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 5.7, 5.8, 8 and 9), `r10-06-me.jpg`, `louie-face-badge.webp`.

## What this step is

Me (`#/you`) is `renderProfile()` in `profile.js`. Restyle it to match `r10-06`: the player header, three stat tiles, the guitar case with the guitars you've earned, a Merch row, Milestones, and a list of rows.

## Files you will touch

- `profile.js`: `renderProfile()` markup only. Leave `stampSheet()`, `meCardImage()`, `louieCardImage()`, `shareCard()`, `showStreak()` and `shareStreak()` alone.
- `styles.css`: profile rules for the Road Ready looks.
- New image (optional): `art/case/case-rack.webp` for the open case interior. If not supplied, build it in CSS (dark brown shell, orange plush, a soft inner glow).
- Tests: `tests/e2e/profile.e2e.mjs`, `guitarist.e2e.mjs`.

## What to build

- **Header:** the player's avatar (the existing `you()` from `guitarist.js`, in a round chrome ring), name in `--type-title`, "Club, 1,469 fans" in `--type-subhead` (venue and fans from `venueNow` and `fansNow`), and the Settings gear (44 px, labelled "Settings") at top right if step 04 option A put it there.
- **Three stat tiles:** "songs you can play", "chords", "plays", big numbers in Space Grotesk 700, labels in `--type-footnote`. Use the numbers `profileOf` already gives; if one isn't there, use what is and say so in the PR.
- **Guitar case:** a card titled "Guitar case" with "3 guitars" on the right, showing the guitars you've earned (`guitarsEarned` in `core.js`, drawn with `guitarSVG()` or their `art/guitars/*-small.webp`) standing in an open case with orange plush. Guitars at near-real relative scale, upright, headstocks up, never sideways. Tapping a guitar opens what tapping it does today (or nothing, if nothing does).
- **Merch row:** "Merch: spend $411 tips on new looks" with a chevron, opening the Merch table.
- **Milestones:** the existing badges or achievements, as small engraved plates.
- **Rows:** Your band, Charts and duets, Share your player card, Tip jar for Louie (optional) with the face badge, Help and feedback. Each row 52 px or taller, icon, label, chevron. Keep each one's existing destination. The tip jar is always marked optional and never nags.
- Light mode and large text: the stat tiles stack to one column at `data-ax="1"`; the case scrolls sideways if guitars don't fit, with each guitar still a 44 px target.
- No streak warning or "you missed" copy on this page.

## Acceptance criteria

1. Matches `r10-06` in dark, works in light.
2. Every number and destination is the same as before.
3. Guitars in the case are upright with the headstock up, at consistent scale.
4. Targets at least 44 px, text AA, screen reader labels on every row and guitar ("The cutaway, earned at the Club").
5. `profile.e2e.mjs` passes; share cards render exactly as before.

## Screenshot check

Me dark, light, and large text, next to `r10-06`.

## Don't change

- Share card images, the guitarist drawing, profile numbers, Charts and Band pages themselves.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-08-me`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

