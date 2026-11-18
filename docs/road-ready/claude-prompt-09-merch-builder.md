# HANDOFF FOR CLAUDE OPUS: Road Ready step 09 of 9, guitar art and the Merch builder, in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging into `road-ready` waits for Opus's review and Graham's merge go.
- Do not push to `main`, open a pull request into `main`, or run any workflow on CLAUDE.md's upload and deploy list (a push to `main` publishes the live app on GitHub Pages; don't dispatch the screens workflow).
- Push only this step's branch, `rr-09-merch`. Touch no other branch. In the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.
- Do not bump VERSION or CACHE.
- Do not remove a feature, a Merch item or stored data without Graham's yes. Old stored data stays in place.

**Read first:** grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`. Then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`.

**Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 5.8 and 8), `r10-11-guitar-lineup.jpg`, `r10-12-finishes-paint.jpg`, `r10-13-finishes-wear.jpg`, `r10-16-finishes-flame-tops.jpg`, `r10-17-finishes-pickguards.jpg`, `r10-18-finishes-hardware.jpg`, `r10-19-merch-builder.jpg`, and `r10-14-v-variants.jpg`, `r10-15-soundhole-variants.jpg` for reference.

**Branch:** `rr-09-merch`, from `road-ready`. The pull request goes into `road-ready`.
**Needs:** step 08 merged into `road-ready`.
**Model:** Opus builds. **Always review:** yes (it changes stored data, prices and purchases).
**Touch:** the files under "Files you will touch". **Don't touch:** everything under "Don't change", `main`, and every other branch.

## Confirm with Graham before building

Stop and ask Graham this before building. Don't assume the answer.

- **The spec turns the Merch table into a guitar builder.** Hats, gear (Rain check, Double set, Second take), Louie's finishes, looks and backdrops aren't in the spec. The standing rule is that nothing is removed without Graham's yes. Proposal: keep every existing Merch item and section exactly as it works today, and add the builder as a new section of the Merch table. Ask before removing, hiding or repricing anything.
- **The guitar-to-venue mapping and the data change** in your sub-plan (below) need his yes before any code.

## What this step is

This is the largest step, and it changes data, so start by writing a short sub-plan into `docs/ROAD-READY-PLAN.md` (9a, 9b, 9c...) and stop for Graham's go before building. Two parts:

1. **Guitar art.** Today's guitars (`GUITARS` in `core/game.js`, drawn by `fretboard.js` `headstock()` and the pictures in `art/guitars/`) use several headstock shapes (`plain`, `inline`, `book`, `slot`, `point`). Graham's rule: every guitar uses **our rounded 3+3 headstock with no logos**, never a six-in-line or sideways headstock, at near-real scale. The design's bodies by venue are: Porch parlor, Cornerstone dreadnought, Club Slab, Hollow Hill semi-hollow, Swing offset, Comet (spec section 8). The current guitar ids (open, switch, scales, strum, pick, finger, encore) and venues (`VENUES` in `core/turf.js`: Garage, Open mic, Coffeehouse, Club, Theater, Arena, Stadium, Festival headliner) don't line up one to one with the spec's list; propose the mapping in the sub-plan for Graham.
2. **The builder** (`r10-19`), added as a new section of the Merch table next to everything already there, (`renderMerch()` and `tryOn()` in `merch.js`, items in `MERCH` in `core.js`): pick a body, flame top, guard, wear and hardware for a guitar, with prices in tips.

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
2. Every Merch item that existed before is still listed, priced and buyable as before (a test lists them against `origin/road-ready`).
3. Every guitar shows the rounded 3+3 headstock, no logos, upright, near-real scale, in the Road neck, Show Complete, Me's case and the builder.
4. The builder matches `r10-19`, saves a build, charges the right tips, and the guitar on the Road and in the case shows the build.
5. Old saved data still loads (a migration in the `clean*` function, with a unit test).
6. Locked swatches can't be bought and say why.
7. Targets, contrast, screen reader labels, Reduce Motion and light mode as in the checklist below.

## Screenshot check

Builder in dark and light, each category open once, a locked swatch, "Leave strings long" on, and large text. The guitar lineup next to `r10-11`.

## Don't change

- How tips are earned, and every existing Merch item and section: hats, gear (Rain check, Double set, Second take), Louie's finishes, looks (Green Room, Headliner) and backdrops, with their prices. Nothing is removed or hidden without Graham's yes.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`, then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow their rules. Where they conflict, the stricter rule wins; raise the conflict with Graham.
- **Branch rule.** All Road Ready work collects on one integration branch, `road-ready`, cut from `main`. This step uses its own branch, `rr-09-merch`, made from a fresh `origin/road-ready` (`git fetch origin road-ready`), and opens one pull request **into `road-ready`**, never into `main`. Don't push to `main`, don't merge anything, and don't touch any other branch. `main` gets the whole redesign as one release only when Graham says ship. For this redesign, this replaces CLAUDE.md's "push to main". If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **No version bump.** Don't change VERSION in `core.js` or CACHE in `sw.js` in any step. The version is bumped once, when `road-ready` goes to `main` on Graham's ship go. (A test checks the two match; leaving both alone keeps it green.) A new `.js` file still goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Pull request.** Use the playbook's PR format (`templates/pr.md`): Status "Waiting for review", Triggers "Uploads and deploys nothing" (the PR targets `road-ready`, which deploys nothing), What changed, Tests actually run (counts, or "not run" and why; never claim a pass you didn't see), the acceptance criterion to test table, Limitations, a phone review checklist of three items at most, Built by, Reviewed by, and "Next step: Opus reviews". Title in plain words, starting "Road Ready 09:".
- **Screenshots.** Make them the CLAUDE.md way: a throwaway `tests/e2e/zz_*.e2e.mjs` using `phone()` that saves to `$SHOT`, run it, then delete it before you commit. Take these, as PNGs, and put them in the PR description: phone dark, phone light, and phone dark with large text (see "Large text" below). Compare each one side by side with the round 10 image named in this prompt and list any differences you chose to leave.
- **Writing.** Every word Graham or a player sees (UI text, comments he reads, commit messages, the PR) is plain and direct, with no em dashes. Any lyrics in tests or fixtures are made up, never real song lyrics.
- **Louie hard rules.** Louie is Road Ready: a blue 1x12 combo amp with a yellow control-panel face. Exactly one mouth, always on the yellow panel between the eyes and the four cream knobs. The grille is plain navy cloth and is never a face (no mouth, smile line or features on it). Hands with fingers, navy like his arms; never one finger standing straight up (it reads as the middle finger). No blush or cheek spots, no guitar pick, no amp brand logos. He is a character who cheers the player on; never call him an AI or an assistant.
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

