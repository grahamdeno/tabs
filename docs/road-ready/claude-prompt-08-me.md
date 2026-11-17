# HANDOFF FOR CLAUDE SONNET: Road Ready step 08 of 9, Me and the guitar case, in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging into `road-ready` waits for Opus's review and Graham's merge go.
- Do not push to `main`, open a pull request into `main`, or run any workflow on CLAUDE.md's upload and deploy list (a push to `main` publishes the live app on GitHub Pages; don't dispatch the screens workflow).
- Push only this step's branch, `rr-08-me`. Touch no other branch. In the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.
- Do not bump VERSION or CACHE.
- Do not remove a feature, a Merch item or stored data without Graham's yes. Old stored data stays in place.

**Read first:** grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`. Then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`.

**Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 5.7, 5.8, 8 and 9), `r10-06-me.jpg`, `louie-face-badge.webp`.

**Branch:** `rr-08-me`, from `road-ready`. The pull request goes into `road-ready`.
**Needs:** step 07 merged into `road-ready`.
**Model:** Sonnet builds. **Always review:** yes (it places game money next to a real-money link).
**Touch:** the files under "Files you will touch". **Don't touch:** everything under "Don't change", `main`, and every other branch.

## Confirm with Graham before building

Stop and ask Graham this before building. Don't assume the answer.

- **Game tips next to real money.** The spec puts the "$411 tips" game money (earned by playing, spent at the Merch table) on the same screen as the real "Tip jar for Louie" (Ko-fi, real money). Players could mix them up. Proposal, for Graham to confirm or change:
  - Game money: the Merch row reads "Spend your game tips: $411 at the Merch table", with the coin icon. It is the only place on Me with the coin and a $ amount.
  - Real money: a separate section at the bottom titled "Support the app", with one row "Support Louie on Ko-fi (real money, optional)", a heart icon, no coin, no amount, and the face badge.
  - Never the word "tips" on the real-money row.
- If Graham chose to keep six tabs in step 04, Charts and Band stay tabs and their rows below are left out. Check `docs/ROAD-READY-PLAN.md` for his answer.

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
- **Merch row:** the game-money row with the wording Graham confirms (proposal: "Spend your game tips: $411 at the Merch table", coin icon), opening the Merch table.
- **Milestones:** the existing badges or achievements, as small engraved plates.
- **Rows:** Your band and Charts and duets (only if Graham chose five tabs in step 04), Share your player card, Help and feedback. Each row 52 px or taller, icon, label, chevron. Keep each one's existing destination.
- **Real-money support:** in its own section at the bottom, with the wording and placement Graham confirms (proposal: "Support the app", one row "Support Louie on Ko-fi (real money, optional)", heart icon, face badge, no coin and no amount). Always marked optional, never nags, and never called "tips".
- Light mode and large text: the stat tiles stack to one column at `data-ax="1"`; the case scrolls sideways if guitars don't fit, with each guitar still a 44 px target.
- No streak warning or "you missed" copy on this page.

## Acceptance criteria

1. Matches `r10-06` in dark, works in light.
2. Every number and destination is the same as before.
3. Game tips and real money can't be confused: they are in different sections with different icons, and a test checks that the real-money row's text and label never contain "tips" or a $ amount.
4. Guitars in the case are upright with the headstock up, at consistent scale.
5. Targets at least 44 px, text AA, screen reader labels on every row and guitar ("The cutaway, earned at the Club").
6. `profile.e2e.mjs` passes; share cards render exactly as before.

## Screenshot check

Me dark, light, and large text, next to `r10-06`.

## Don't change

- Share card images, the guitarist drawing, profile numbers, Charts and Band pages themselves.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`, then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow their rules. Where they conflict, the stricter rule wins; raise the conflict with Graham.
- **Branch rule.** All Road Ready work collects on one integration branch, `road-ready`, cut from `main`. This step uses its own branch, `rr-08-me`, made from a fresh `origin/road-ready` (`git fetch origin road-ready`), and opens one pull request **into `road-ready`**, never into `main`. Don't push to `main`, don't merge anything, and don't touch any other branch. `main` gets the whole redesign as one release only when Graham says ship. For this redesign, this replaces CLAUDE.md's "push to main". If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **No version bump.** Don't change VERSION in `core.js` or CACHE in `sw.js` in any step. The version is bumped once, when `road-ready` goes to `main` on Graham's ship go. (A test checks the two match; leaving both alone keeps it green.) A new `.js` file still goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Pull request.** Use the playbook's PR format (`templates/pr.md`): Status "Waiting for review", Triggers "Uploads and deploys nothing" (the PR targets `road-ready`, which deploys nothing), What changed, Tests actually run (counts, or "not run" and why; never claim a pass you didn't see), the acceptance criterion to test table, Limitations, a phone review checklist of three items at most, Built by, Reviewed by, and "Next step: Opus reviews". Title in plain words, starting "Road Ready 08:".
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

