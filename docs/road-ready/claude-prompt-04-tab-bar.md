# Step 04 of 9: Grille-cloth tab bar and five custom icons

**Model:** Sonnet (Opus if option A below moves pages around). **Branch:** `rr-04-tabs`. **Needs:** step 01. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 3, 4 and 5.2), `r10-01-road-dark.jpg`, `r10-02-road-light.jpg`, `r10-06-me.jpg`, `r8-15-icon-sheet.jpg`.

## What this step is

The tab bar lives in `hud.js` (`TABS`, `paintTabs()`, `TABBED`, `tabFor()`, `openMore()`). Today it has six tabs: Road, Tour, Charts, Band, Rehearse, More. The design has five: **Road, Songbook, Rehearse, Tour, Me**, in a floating grille-cloth bar with chrome piping and our own line icons.

## Graham's decision for this step (edit before pasting)

- [x] **A. The five design tabs.** Road (`#/`), Songbook (`#/library`), Rehearse (`#/practice`), Tour (`#/tour`), Me (`#/you`). Charts and Your band become rows on Me (step 08 styles them; in this step add plain rows "Your band" and "Charts and duets" at the top of Me's list so nothing is lost). The More sheet goes away: Settings becomes a gear button on Me, the Tuner is the Tune button on the Road header (step 02), Support is the "Tip jar for Louie (optional)" row on Me, and the Songbook is a tab. Keep `#/charts`, `#/band`, `#/merch`, `#/support` and `#/settings` working as pages with a back button.
- [ ] **B. Keep today's six tabs** and only restyle them with the new bar and new icons for those six.

If neither is ticked, stop and ask Graham.

## Files you will touch

- `hud.js`: `TABS`, `paintTabs()`, `TABBED`, `tabFor()`, `openMore()` (option A removes its use from the tab bar; keep the function if anything else calls it).
- `profile.js`: option A only, add the rows and the gear button to `renderProfile()`, without restyling the page.
- `app.js`: the router, only if `#/library` needs to show the tab bar (add it to `TABBED`).
- `styles.css`: the `#tabs` rules (search `#tabs` and `.tabbed`) in the "Version 4 look" section.
- `docs/ONBOARDING.md` (every tip or Show me that points at a tab or the More sheet), `README.md`, and the e2e tests that tap tabs or More (grep `data-tab`, `openMore`, `more-`).

## What to build

- A floating rounded rectangle, radius 18, 8 px above the home indicator and 8 px from the sides, filled with `--mesh` (step 01), a 3 px `--chrome-pipe` edge and a soft drop shadow. Keep `--tabs` (the page's bottom inset) equal to the bar's height plus the safe area plus 16 px.
- Five icons, 28 px, drawn as line icons with a 1.9 px stroke, round caps and joins, `currentColor`, in inline SVG:
  - **Road:** a short fretboard segment (two frets, three strings) with a road bending through it.
  - **Songbook:** an open book with a music note on the right page.
  - **Rehearse:** a metronome (a trapezoid body with the arm leaning).
  - **Tour:** a tour van from the side, two wheels.
  - **Me:** a backstage pass on a U-shaped lanyard.
  No lamps, no gauges, no guitar picks, no brand marks.
- Labels under the icons in `--type-footnote`, Inter 500.
- **Inactive:** icon and label in `--rr-tab-off`. **Active:** icon and label in `--rr-amber` (dark) or `--rr-amber-text` (light), plus a 3 by 24 px amber underline under the label. Keep `aria-current="page"` on the active tab.
- Each tab is at least 44 by 44 px (the bar is about 64 px tall; the hit area is the whole fifth of the bar).
- **Large text:** labels grow with the text size up to `data-ax="1"`. At `data-ax="3"` the labels hide visually but stay as each tab's `aria-label`, and the icons grow to 32 px. (iOS's Large Content Viewer has no web version; the visible label up to AX2 and the accessible name cover it.)
- Keep the little dot that says the tuner hasn't been used lately, now on the Road header's Tune button (step 02) instead of a tab.

## Acceptance criteria

1. Option A: five tabs in this order, each going to its page with the right tab lit, and Charts, Band, Merch, Support and Settings all reachable from Me in one tap. Option B: the six tabs work as before.
2. Matches the tab bar in `r10-01` (dark) and `r10-02` (light).
3. Contrast: inactive labels 4.5:1 on the mesh in both looks (the step 01 test covers the tokens; check the rendered mesh with axe too).
4. Each tab is at least 44 by 44 px.
5. Screen reader: the bar is a `nav` named "Main", each tab reads its name, and the current one is announced as current.
6. No motion is added. Tab switch stays the system's default.
7. Onboarding tips that pointed at More or a removed tab are moved or rewritten, and `docs/ONBOARDING.md` says where.

## Screenshot check

The bar on Road, Songbook and Me, dark and light, plus `data-ax="3"`. Put the bar crop next to the bar in `r10-01` and `r10-02`, and the icons next to `r8-15-icon-sheet.jpg`.

## Don't change

- What any page does. Option A only moves where you reach Charts, Band, Settings, Tuner and Support from.
- The Road header (step 02), Me's styling (step 08).
- Routes and stored data.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-04-tabs`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

