# HANDOFF FOR CLAUDE SONNET: Road Ready step 07 of 9, the Songbook, in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging into `road-ready` waits for Opus's review and Graham's merge go.
- Do not push to `main`, open a pull request into `main`, or run any workflow on CLAUDE.md's upload and deploy list (a push to `main` publishes the live app on GitHub Pages; don't dispatch the screens workflow).
- Push only this step's branch, `rr-07-songbook`. Touch no other branch. In the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.
- Do not bump VERSION or CACHE.
- Do not remove a feature, a Merch item or stored data without Graham's yes. Old stored data stays in place.

**Read first:** grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`. Then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`.

**Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 4, 9 and 10, "Mastery marks"), `r10-05-songbook.jpg`, `louie-face-badge.webp`.

**Branch:** `rr-07-songbook`, from `road-ready`. The pull request goes into `road-ready`.
**Needs:** step 06 merged into `road-ready`.
**Model:** Sonnet builds. **Always review:** yes (existing Songbook tests change).
**Touch:** the files under "Files you will touch". **Don't touch:** everything under "Don't change", `main`, and every other branch.

## What this step is

The Songbook page (`#/library`) is `renderLibrary()` and `renderList()` in `library.js` (CLAUDE.md's table also mentions `app.js`; check where it is now). Restyle it to match `r10-05`: a title, a search field, filter chips, a hint banner with Louie's face badge, and song rows with an art tile, title, artist, chord chips and mastery dots.

## Confirm with Graham before building

Stop and ask Graham this before building. Don't assume the answer.

- **Mastery levels.** The spec's mastery marks have three levels ("Learning", "Solid", "Nailed it"); the app stores two (`STATUS` in `library.js`: `learning` "Learning", `got` "Got it"). Proposal: show two levels with the dots (Learning is one dot, Got it is three dots and reads "Got it"), with no data change. Or: add a third level, which needs a data change in `core.js` and `docs/DATA.md` and would become its own step.

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

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`, then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow their rules. Where they conflict, the stricter rule wins; raise the conflict with Graham.
- **Branch rule.** All Road Ready work collects on one integration branch, `road-ready`, cut from `main`. This step uses its own branch, `rr-07-songbook`, made from a fresh `origin/road-ready` (`git fetch origin road-ready`), and opens one pull request **into `road-ready`**, never into `main`. Don't push to `main`, don't merge anything, and don't touch any other branch. `main` gets the whole redesign as one release only when Graham says ship. For this redesign, this replaces CLAUDE.md's "push to main". If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **No version bump.** Don't change VERSION in `core.js` or CACHE in `sw.js` in any step. The version is bumped once, when `road-ready` goes to `main` on Graham's ship go. (A test checks the two match; leaving both alone keeps it green.) A new `.js` file still goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Pull request.** Use the playbook's PR format (`templates/pr.md`): Status "Waiting for review", Triggers "Uploads and deploys nothing" (the PR targets `road-ready`, which deploys nothing), What changed, Tests actually run (counts, or "not run" and why; never claim a pass you didn't see), the acceptance criterion to test table, Limitations, a phone review checklist of three items at most, Built by, Reviewed by, and "Next step: Opus reviews". Title in plain words, starting "Road Ready 07:".
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

