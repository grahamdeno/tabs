# HANDOFF FOR CLAUDE SONNET: Road Ready step 01 of 9, tokens, fonts and tolex surfaces, in grahamdeno/tabs

**Steps that can't be undone. Read these first:**
- Do not merge anything. Merging into `road-ready` waits for Opus's review and Graham's merge go.
- Do not push to `main`, open a pull request into `main`, or run any workflow on CLAUDE.md's upload and deploy list (a push to `main` publishes the live app on GitHub Pages; don't dispatch the screens workflow).
- Push only this step's branch, `rr-01-tokens`, and create `road-ready` once (below). Touch no other branch. In the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.
- Do not bump VERSION or CACHE.
- Do not remove a feature, a Merch item or stored data without Graham's yes. Old stored data stays in place.

**First, the integration branch.** If `origin/road-ready` doesn't exist, create it from a fresh `origin/main` and push it with no changes (`git fetch origin main && git push origin origin/main:refs/heads/road-ready`). If it exists, leave it as it is.

**Read first:** grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`. Then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`.

**Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 1, 2, 3, 4, 5.1, 5.6, 7 and 9 matter most), `r10-01-road-dark.jpg`, `r10-02-road-light.jpg`, `r10-05-songbook.jpg`, `r10-06-me.jpg`.

**Branch:** `rr-01-tokens`, from `road-ready`. The pull request goes into `road-ready`.
**Needs:** nothing before it.
**Model:** Sonnet builds. **Always review:** yes (it changes the look of every screen, existing tests and the Merch look names).
**Touch:** the files under "Files you will touch". **Don't touch:** everything under "Don't change", `main`, and every other branch.

## What this step is

Graham picked a new look for the app called **Road Ready**: dark tolex, grille cloth, chrome piping, cream engraved plates and warm amber, with Space Grotesk, Inter and IBM Plex Mono. This step adds the foundation only: the colour tokens, type scale, spacing and radii, the fonts, the tolex and grille-cloth surfaces, and the plate button. Screens are restyled in later steps. After this step the app should look like a recoloured version of today's layout, nothing more.

You are also starting the plan file. Create `docs/ROAD-READY-PLAN.md` in the CLAUDE.md "plan with Opus, run with Sonnet" format, with these steps, each marked with its model: 01 Tokens, fonts and surfaces [Sonnet]; 02 The Road [Opus]; 03 Louie in code [Opus]; 04 Tab bar and icons [Sonnet]; 05 Playing [Opus]; 06 Show Complete [Sonnet]; 07 Songbook [Sonnet]; 08 Me and the guitar case [Sonnet]; 09 Merch builder and guitar art [Opus]. Put Graham's answers to the "Confirm with Graham" questions at the top with their dates, add a "Branches" note (each step's PR goes into `road-ready`; `main` gets one release with one version bump on Graham's ship go), and add an empty "Surprises" section.

## Confirm with Graham before building

Stop and ask Graham this before you change anything. Don't assume the answer.

- **Road Ready replaces the two free looks.** The proposal: Neon Midnight (Dark) becomes Road Ready dark and Festival Poster (Light) becomes Road Ready light; Green Room and Headliner stay on the Merch table as they are. The other way: Road Ready is a fifth look, free, and the default for new installs. This prompt is written for the first way; if Graham picks the second, write down what changes in `docs/ROAD-READY-PLAN.md` before building.

## Files you will touch

- `styles.css`: the "Version 4 look (4.0.0)" section near the end. Add new blocks there, after the existing look blocks and after the shared "amp materials, redrawn from the palette" block, so they win on order. Don't edit the older per-screen rules above it.
- `app.js`: `readSysText()` and `applyTheme()` (around lines 24 to 56). `readSysText()` already measures the iPhone text size with `-apple-system-body` and runs again on `visibilitychange`; reuse it (below). In `applyTheme()`, change only the `theme-color` values and the comment that names the old looks. Keep the `data-look` values `neon` and `festival` as they are, so no stored setting or owned look changes.
- `index.html`: the `<meta name="theme-color">` default.
- `core/game.js`: the two look entries in `MERCH` (ids `festival` and `neon`, around line 1083): change only `name` and `line`. Ids, prices and kinds stay.
- `settings.js`: the Look page's footnote that says "Light is Festival Poster and Dark is Neon Midnight" (around line 72).
- `core.js`: a small pure `axOf(px)` (below), exported and unit tested. Nothing else in `core.js`.
- `vendor/fonts/`: the three font families as `woff2`, their OFL licence files, and `vendor/fonts/README.md`.
- Tests: `tests/core.test.mjs` (contrast test and `axOf`), `tests/e2e/settings.e2e.mjs` (its checks expect "Neon Midnight", "Festival Poster" and the old background colours), and a new browser test for Green Room and Headliner.
- `docs/ROAD-READY-PLAN.md` (new), `README.md` (the look descriptions that name Festival Poster and Neon Midnight), the comment at the top of the "Version 4 look" section. `CLAUDE.md` also names the old looks: don't edit it; put the suggested new wording in the PR for Graham's yes.

## What to build

### 1. Colour tokens

**Where they go (this matters).** Green Room is a light look, so it also carries `data-theme="light"`; Headliner is a dark look and carries `data-theme="dark"`; and the existing first block starts with plain `:root`, which every look inherits. So put Road Ready's tokens only in new blocks with these selectors: `:root[data-look="neon"]` for dark and `:root[data-look="festival"]` for light, plus `:root:is([data-look="neon"], [data-look="festival"])` for what both share (fonts, radii, surfaces). Never put a Road Ready value on plain `:root`, on `:root[data-theme="light"]` or `:root[data-theme="dark"]`, or on `:root[data-look]`. The same goes for every Road Ready rule in later steps.

Add these as CSS custom properties on the Road Ready looks, with the names below (prefix `--rr-`), then point the existing semantic variables (`--bg`, `--fg`, `--fg-2`, `--muted`, `--card`, `--card-2`, `--rim`, `--hair`, `--bar`, `--accent`, `--accent-ink`, `--accent-deep`, `--on-accent`, `--accent-soft`, `--accent-line`, `--tabs-on`, `--tabs-ring`, `--banner`, `--on-banner`, `--locked`, `--locked-ic`) at them so every existing screen follows without its own colours. Keep `--bad`, `--good`, `--streak`, `--fans` and `--strings` readable (check them against the new `--bg` and `--card`; adjust only if they fail AA).

Dark (Road Ready dark):

| Token | Value |
|---|---|
| `--rr-base` | #141210 |
| `--rr-card` | #1A1918 |
| `--rr-mesh` | #2A2724 |
| `--rr-hairline` | #46423C |
| `--rr-text` | #F6EEE0 |
| `--rr-text-2` | #BEB4A4 |
| `--rr-lyric-now` | #F6EEE0 |
| `--rr-lyric-next` | #C9C0B2 |
| `--rr-lyric-sung` | #8F877C |
| `--rr-chord` | #FFC46B |
| `--rr-amber` | #FFB547 |
| `--rr-amber-text` | #FFB547 |
| `--rr-on-amber` | #1E160C |
| `--rr-plate-top`, `--rr-plate-bottom` | #F6EAD2, #D6C4A4 |
| `--rr-plate-edge` | #8C7858 |
| `--rr-plate-text` | #281E14 |
| `--rr-tab-off` | #D6CCBC |
| `--rr-outline` | #8C847A |
| `--rr-pearl-done` | #FCCE80 |
| `--rr-pearl-now` | #FFD68C |
| `--rr-pearl-locked` | #D6D0C4 |
| `--rr-engrave` | #5C3A16 |
| `--rr-engrave-locked` | #46423C |
| `--rr-glow` | #FFAA3C |
| `--rr-glow-core` | #FFDCA0 |
| `--rr-louie-rim` | rgba(255, 226, 180, .35) |

Light (Road Ready light): `--rr-base` #F6EFE2, `--rr-card` #FBF7EF, `--rr-mesh` #E7E0D4, `--rr-hairline` #D3C8B6, `--rr-text` #1E1914, `--rr-text-2` #5C5248, `--rr-lyric-now` #1E1914, `--rr-lyric-next` #3A332C, `--rr-lyric-sung` #6E655B, `--rr-chord` #763A00, `--rr-amber` #FFB547 (fills only, never small text on cream), `--rr-amber-text` #763A00, `--rr-on-amber` #1E160C, `--rr-tab-off` #4A4239, `--rr-outline` #8C847A, `--rr-louie-rim` transparent. Plate, pearl, engrave and glow values are the same as dark.

`--accent-ink` must be `--rr-amber-text` in both, so amber text in light mode is always #763A00.

### 2. Type

- Vendor **Space Grotesk** (500 to 700), **Inter** (400 to 700) and **IBM Plex Mono** (600) as `woff2`, Latin subset. The official OFL source (the google/fonts GitHub repo: `ofl/spacegrotesk`, `ofl/inter`, `ofl/ibmplexmono`) only has TTF files, so convert them: `pip install fonttools brotli`, then for each file `pyftsubset <file>.ttf --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212,U+FEFF,U+FFFD" --layout-features='*' --flavor=woff2 --output-file=vendor/fonts/<name>.woff2`. Space Grotesk and Inter are variable fonts (keep the `wght` axis; `pyftsubset` keeps it); for Plex Mono use `IBMPlexMono-SemiBold.ttf`. Aim for under 120 KB each. Include each `OFL.txt` and list the fonts, source URL and commit in `vendor/fonts/README.md` the way Fredoka and Nunito are. Commit only the `woff2` files, not the TTFs or the tools. The page's Content Security Policy only allows `'self'`, so never load fonts from a CDN. Keep Fredoka and Nunito; Green Room and Headliner still use them.
- Offline: `sw.js` already saves anything under `vendor/` in its `tabs-vendor` cache the first time it loads, so the fonts work offline after the first load with no `sw.js` change. Don't add them to `SHELL`.
- `@font-face` rules next to the existing two, with `font-display: swap`.
- On the Road Ready looks: `--display: "Space Grotesk", ...`, `--sans: "Inter", ...`, `--serif` same as `--display`, and a new `--mono: "IBM Plex Mono", ui-monospace, monospace` (check `--mono` isn't already defined elsewhere; if it is, set it only on these looks).
- Text scaling: reuse the measurement the app already has. `readSysText()` in `app.js` reads the iPhone text size from `-apple-system-body` (17 px at the default size) and runs at start-up (from `applyTheme()`) and again when the app comes back (`visibilitychange`). Don't add a second measuring element or listener. Change it so that, from the same reading, it also sets `--sys-px` on `document.documentElement` (the raw px, not the clamped scale it returns) and sets `data-ax` from `axOf(px)`. Keep its return value and the clamp exactly as they are, because the lyrics use them.
- `axOf(px)` in `core.js`, pure: returns `"3"` at 40 px or more, `"1"` at 28 px or more, and `""` below 28 (then remove `data-ax`).
- Type tokens scale with `--sys-px` (17 px when unset). Each is `calc(var(--sys-px, 17px) * ratio)`; the sizes below are at the default 17 px. Use these names:

| Token | Ratio (px at 17) | Font and weight | Spec role |
|---|---|---|---|
| `--type-display` | 2 (34) | Space Grotesk 700 | Display |
| `--type-title` | 1.647 (28) | Space Grotesk 700 | Title |
| `--type-title2` | 1.294 (22) | Space Grotesk 700 | Title 2 |
| `--type-headline` | 1 (17) | Inter 600 | Headline |
| `--type-body` | 1 (17) | Inter 450 | Body |
| `--type-callout` | .941 (16) | Inter 500 | Callout |
| `--type-subhead` | .882 (15) | Inter 500 | Subhead |
| `--type-footnote` | .765 (13) | Inter 500 | Footnote, tab labels |
| `--type-caption` | .706 (12) | Inter 600, letter-spacing .06em | Caption, overlines |
| `--type-lyric-now` | 2 (34) | Inter 700 | Lyric current |
| `--type-lyric-next` | 1.529 (26) | Inter 600 | Lyric upcoming |
| `--type-lyric-sung` | 1.294 (22) | Inter 600 | Lyric sung |
| `--type-chord` | 1 (17) | Inter 700 | Chord |
| `--type-mono` | 1.176 (20) | IBM Plex Mono 600 | Tuner and tempo |

Add matching utility classes only if the repo already uses that pattern; otherwise the tokens are enough for later steps.


### 3. Spacing and radii

`--sp-1` to `--sp-8` = 4, 8, 12, 16, 20, 24, 32, 40 px. Radii: `--r-chip: 999px`, `--r-control: 10px`, `--r-card: 16px`, `--r-strip: 18px`, `--r-sheet: 24px`, `--r-plate: 12px`. Set the existing `--r` to 16px and `--r-bar` to 18px on the Road Ready looks. Screen margin token `--margin: 16px` (20px at 600px wide and up).

### 4. Tolex and grille-cloth surfaces (code, no image files yet)

- `--tolex`: dark tolex as a CSS background built from an inline SVG data URI using `feTurbulence` (a fine leather grain, about 1 px scale) over `--rr-base`, then a 45 percent black wash. Tile it, never stretch it. Light tolex is the same grain, much fainter, over #F6EFE2. The CSP allows `data:` images.
- `--mesh`: grille cloth for the tab bar (used in step 04), a woven pattern from two `repeating-linear-gradient`s at 45 and -45 degrees over `--rr-mesh`.
- `--tolex-card`: `--rr-card` with a 1 px top highlight (white at 8 percent) and a 1 px bottom shadow (black at 30 percent), as spec 5.1 says for raised panels.
- `--chrome-pipe`: a 3 px chrome edge as a `linear-gradient` border (light grey to dark grey to light grey), for the header strip and tab bar later.
- Apply `--tolex` to `body` on the Road Ready looks. Check that every screen's text still meets AA on it (the grain must stay subtle enough that the average tone is still #141210 dark and #F6EFE2 light, give or take a few percent).
- Leave a comment that these can be swapped for 512 px bitmap tiles (`art/surfaces/tolex-dark.webp` and friends) later without changing any screen.

### 5. Buttons (spec 5.6)

On the Road Ready looks only, restyle `.btn.primary` as the cream engraved plate: gradient `--rr-plate-top` to `--rr-plate-bottom`, 2 px `--rr-plate-edge` border, radius 12, four tiny screws (four small radial-gradient dots in the corners, decorative), label in Space Grotesk 700 in `--rr-plate-text`. Pressed: 6 percent darker and 1 px down, no bounce. `.btn` (secondary) becomes a capsule with a 1.5 px `--rr-outline` border and `--rr-text` label. The existing `:root[data-look] .btn` rules are where to do this; scope your override to the Road Ready looks so Green Room and Headliner keep their chunky buttons. Every button stays at least 44 px tall.

## Acceptance criteria

1. With Settings set to Dark, the app shows Road Ready dark; with Light, Road Ready light; with Auto, it follows the phone.
2. Green Room and Headliner look exactly as before. A browser test wears each one and checks that `getComputedStyle(document.documentElement).getPropertyValue("--rr-base")` is empty and that `--bg`, `--accent` and `--sans` still have their old values. Also compare a screenshot of each against `origin/main`.
3. No screen says "Festival Poster" or "Neon Midnight" any more: the Merch table and Settings say "Road Ready light" and "Road Ready dark" (grep the app files to prove it; CLAUDE.md is left for Graham). `tests/e2e/settings.e2e.mjs` is updated to the new names and colours.
4. The phone's status bar uses Road Ready colours: `theme-color` is #141210 in Road Ready dark and #F6EFE2 in Road Ready light (in `applyTheme()` and the `index.html` default), and Green Room and Headliner keep #e6efe7 and #16171b.
5. All 14 `--type-*` tokens, the spacing and radius tokens and all `--rr-*` tokens exist in both Road Ready looks.
6. The three fonts load from `vendor/fonts` as `woff2` with no network request elsewhere (a Playwright request log), and are in the `tabs-vendor` cache after the first load.
7. A unit test computes WCAG contrast for these pairs and fails below the number shown: dark `--rr-text` on base 15, on card 14; `--rr-text-2` on card 7; `--rr-lyric-sung` on base 4.5; `--rr-chord` on base 7; `--rr-on-amber` on amber 7; `--rr-plate-text` on `--rr-plate-bottom` 7; `--rr-tab-off` on mesh 4.5; `--rr-engrave` on `--rr-pearl-done` 4.5; light `--rr-text` on base 12; `--rr-text-2` on base 4.5; `--rr-amber-text` on base 4.5; `--rr-lyric-sung` on card 4.5; `--rr-tab-off` on mesh 4.5. Read the values from `styles.css` in the test so the test and the CSS can't drift.
8. `axOf` unit test: 17 gives `""`, 28 and 33 give `"1"`, 40 and 53 give `"3"`. `readSysText()` still returns the same clamped scale as before (the lyrics don't change size).
9. With `prefers-reduced-motion: reduce`, nothing new animates (this step adds no animation; the plate press is instant).
10. The axe a11y test passes in both Road Ready looks.
11. No existing text changes size (px sizes are untouched).
12. VERSION and CACHE are unchanged.

## Screenshot check

Road (#/), Songbook (#/library), Rehearse (#/practice), Settings (#/settings) and the Merch table, each in Road Ready dark and light, phone size, plus the Road in Green Room and in Headliner to show they didn't change. Put them next to `r10-01`, `r10-02` and `r10-05`: the colours, fonts and tolex should match; the layout won't yet, and that's expected.

## Don't change

- Any screen's layout or markup. JavaScript changes are limited to `readSysText()`, the `theme-color` values in `applyTheme()`, the two Merch look names and lines, the Settings footnote and `axOf()`.
- The `data-look` values `neon` and `festival`, look ids, prices, and the stored theme setting.
- Louie's drawing (`louie.js` and the `--lv-*` variables): step 03 does him.
- The tab bar (`hud.js`): step 04.
- Green Room and Headliner, the older per-screen styles above the "Version 4 look" section, game logic, storage, keys, `core.js` (apart from adding `axOf`), VERSION and CACHE, and `CLAUDE.md`.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read grahamdeno/playbook `rules.md`, `sonnet-trust.md` and `templates/pr.md`, then this repo's `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow their rules. Where they conflict, the stricter rule wins; raise the conflict with Graham.
- **Branch rule.** All Road Ready work collects on one integration branch, `road-ready`, cut from `main`. This step uses its own branch, `rr-01-tokens`, made from a fresh `origin/road-ready` (`git fetch origin road-ready`), and opens one pull request **into `road-ready`**, never into `main`. Don't push to `main`, don't merge anything, and don't touch any other branch. `main` gets the whole redesign as one release only when Graham says ship. For this redesign, this replaces CLAUDE.md's "push to main". If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **No version bump.** Don't change VERSION in `core.js` or CACHE in `sw.js` in any step. The version is bumped once, when `road-ready` goes to `main` on Graham's ship go. (A test checks the two match; leaving both alone keeps it green.) A new `.js` file still goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Pull request.** Use the playbook's PR format (`templates/pr.md`): Status "Waiting for review", Triggers "Uploads and deploys nothing" (the PR targets `road-ready`, which deploys nothing), What changed, Tests actually run (counts, or "not run" and why; never claim a pass you didn't see), the acceptance criterion to test table, Limitations, a phone review checklist of three items at most, Built by, Reviewed by, and "Next step: Opus reviews". Title in plain words, starting "Road Ready 01:".
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

