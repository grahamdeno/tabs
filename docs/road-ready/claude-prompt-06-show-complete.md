# Step 06 of 9: Show Complete (case and glow)

**Model:** Sonnet. **Branch:** `rr-06-show-complete`. **Needs:** steps 01 and 03. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 5.6, 5.7, 5.8, 7 and 11), `r10-03-show-complete-case.jpg`, `r10-04-show-complete-glow.jpg`, `r8-05-headline-show.jpg`, `louie-cheer-dark.webp` and `louie-cheer-light.webp`.

## What this step is

When a song ends, `showComplete()` in `gig.js` shows the result: bonus fans, tips, the crowd, stars, Encore, under the backdrop you wear. When a leg's headline show earns a new guitar, `guitarEarned()` in `road.js` shows the new-guitar sheet. Restyle both:

- **Glow version** (`r10-04`) for an ordinary show: the guitar you played on stands alone with an amber outline glow and a few sparks.
- **Case version** (`r10-03`) when a new guitar is earned: the guitar in an open hard case with glowing orange plush, framed by chrome L-corner brackets.

## Files you will touch

- `gig.js`: `showComplete()`'s markup only.
- `road.js`: `guitarEarned()` and `headlinerEarned()` markup only.
- `fretboard.js`: `guitarSVG(id)` is the guitar to show; reuse it, don't change it.
- `styles.css`: the Show complete and `.rd-hl`, `.rd-gt` rules for the Road Ready looks.
- New image: `art/case/case-open.webp` (the open case with plush, behind the guitar). If Graham hasn't supplied it yet, build the case in CSS and SVG (a dark brown shell, orange plush with a radial glow) and say so in the PR.
- `louie.js` is not used here; the cheering Louie is the image `art/louie/louie-cheer-dark.webp` or `-light.webp`.

## What to build

- Overline "SHOW COMPLETE" (`--type-caption`, `--rr-amber-text`), title in `--type-display` (for example "Corner Pub, all 6 shows" on a leg finale, or the song title on an ordinary show; use what `showComplete()` already knows), and "New guitar earned" in amber only when that's true.
- The showcase: case or glow as above, with the cheering Louie (about 96 px, `aria-hidden`) beside the guitar, and a small cream label naming the guitar ("Club guitar" style, from `guitarFor()`'s name).
- **Reward tiles** (spec 5.7): two equal outlined tiles, "+120 fans" and "+$30 tips", in that format, from the numbers `gigDone()` already returns. Screen reader reads them as one: "Reward: 120 fans and 30 dollars in tips." On the headline-show sheet they are flat (no outline) so they don't look tappable.
- "Next stop: Club" line when there is one.
- **Buttons:** primary cream plate "Head to the Club" (or the existing primary action's words if there's no next venue), secondary capsule "Play it again" for today's Encore. Keep each button's existing action.
- Keep everything `showComplete()` shows today (stars, crowd, request, battle, the backdrop's Change), moved below the reward tiles if needed. If something can't fit the design, list it in Surprises instead of dropping it.
- **Motion:** sparks drift (a few small amber dots on a `<canvas>` or CSS), the guitar glow pulses once, Louie does one 0.4 s hop. Under Reduce Motion: static sparks, no pulse, no hop. A light haptic on show complete through `haptic()` in `ui.js`, which already respects settings.
- No sad or guilt copy anywhere on this screen, even after a paused or short show.

## Acceptance criteria

1. An ordinary show looks like `r10-04`; a guitar-earning show looks like `r10-03`, in dark; both work in light.
2. Every existing number and action still appears and works.
3. Reward tiles read as one sentence to a screen reader.
4. Buttons are at least 44 px; text meets AA on the case and glow backgrounds (put a scrim behind text if the glow lowers contrast).
5. Under Reduce Motion nothing moves.
6. `tests/e2e/gig.e2e.mjs` passes.

## Screenshot check

Ordinary show (glow) and new-guitar show (case), dark and light, plus large text. Next to `r10-03` and `r10-04`.

## Don't change

- `gigDone()`, fans, tips, stars, quests or any numbers. The backdrop system in `merch.js`. Guitar pictures.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-06-show-complete`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

