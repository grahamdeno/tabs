# Step 01 of 9: Road Ready tokens, fonts and tolex surfaces

**Model:** Sonnet. **Branch:** `rr-01-tokens`. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 1, 2, 3, 4, 5.1, 5.6, 7 and 9 matter most), `r10-01-road-dark.jpg`, `r10-02-road-light.jpg`, `r10-05-songbook.jpg`, `r10-06-me.jpg`.

## What this step is

Graham picked a new look for the app called **Road Ready**: dark tolex, grille cloth, chrome piping, cream engraved plates and warm amber, with Space Grotesk, Inter and IBM Plex Mono. This step adds the foundation only: the colour tokens, type scale, spacing and radii, the fonts, the tolex and grille-cloth surfaces, and the plate button. Screens are restyled in later steps. After this step the app should look like a recoloured version of today's layout, nothing more.

You are also starting the plan file. Create `docs/ROAD-READY-PLAN.md` in the CLAUDE.md "plan with Opus, run with Sonnet" format, with these steps, each marked with its model: 01 Tokens, fonts and surfaces [Sonnet]; 02 The Road [Opus]; 03 Louie in code [Opus]; 04 Tab bar and icons [Sonnet]; 05 Playing [Opus]; 06 Show Complete [Sonnet]; 07 Songbook [Sonnet]; 08 Me and the guitar case [Sonnet]; 09 Merch builder and guitar art [Opus]. Put Graham's decisions (below) at the top and add an empty "Surprises" section.

## Graham's decision for this step (edit before pasting)

**Where Road Ready lives.** Choose one:

- [x] **A. Road Ready replaces the two free looks.** Neon Midnight (dark) becomes Road Ready dark and Festival Poster (light) becomes Road Ready light. Green Room and Headliner stay on the Merch table exactly as they are for now. Settings' Light, Dark and Auto keep working.
- [ ] **B. Road Ready is a new look** next to the other four, free, and becomes the default for new installs.

If neither box is ticked, stop and ask Graham.

## Files you will touch

- `styles.css`: the "Version 4 look (4.0.0)" section near the end (the `:root, :root[data-look="neon"]` block, the `:root[data-theme="light"], :root[data-look="festival"]` block, and the shared "amp materials, redrawn from the palette" block that sets `--sans`, `--serif`, `--display`, `--r`, `--tolex` and friends). Add the new tokens there. Don't edit the older per-screen rules above it.
- `app.js`: `applyTheme()` (around line 44) only if option B needs a new `data-look` value. With option A, leave it.
- `vendor/fonts/`: add the three font families and their OFL licence files, and update `vendor/fonts/README.md`.
- `ui.js`: a small exported `watchTextSize()` that sets `data-ax` (below). Call it once at start-up wherever `applyTheme()` is first called in `app.js`.
- `tests/core.test.mjs` (or a new unit test file if that's the house pattern): a contrast test for the tokens.
- `docs/ROAD-READY-PLAN.md` (new), `README.md` (one line in the look description), `docs/ONBOARDING.md` only if a tip changes (it shouldn't).

## What to build

### 1. Colour tokens

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

- Vendor **Space Grotesk** (500 to 700), **Inter** (400 to 700) and **IBM Plex Mono** (600) as `woff2`, Latin subset is fine. Get them from the official OFL sources (the google/fonts GitHub repo, `ofl/spacegrotesk`, `ofl/inter`, `ofl/ibmplexmono`), include each `OFL.txt`, and list them in `vendor/fonts/README.md` the way Fredoka and Nunito are. The page's Content Security Policy only allows `'self'`, so never load fonts from a CDN. Keep Fredoka and Nunito; Green Room and Headliner still use them.
- `@font-face` rules next to the existing two, with `font-display: swap`.
- On the Road Ready looks: `--display: "Space Grotesk", ...`, `--sans: "Inter", ...`, `--serif` same as `--display`, and a new `--mono: "IBM Plex Mono", ui-monospace, monospace` (check `--mono` isn't already defined elsewhere; if it is, set it only on these looks).
- Root size for text scaling: `html { font: -apple-system-body; }` then put `font-family: var(--sans)` back on `body`. On iPhone this makes `1rem` follow the system text size (17 px at the default size). Off iPhone it falls back to the browser default; set `html { font-size: 17px }` first so the fallback is 17 px. The existing CSS uses px everywhere and no rem, so this doesn't move any existing text.
- Type tokens in rem (17 px base). Use these names:

| Token | Size | Font and weight | Spec role |
|---|---|---|---|
| `--type-display` | 2rem (34) | Space Grotesk 700 | Display |
| `--type-title` | 1.647rem (28) | Space Grotesk 700 | Title |
| `--type-title2` | 1.294rem (22) | Space Grotesk 700 | Title 2 |
| `--type-headline` | 1rem (17) | Inter 600 | Headline |
| `--type-body` | 1rem (17) | Inter 450 | Body |
| `--type-callout` | .941rem (16) | Inter 500 | Callout |
| `--type-subhead` | .882rem (15) | Inter 500 | Subhead |
| `--type-footnote` | .765rem (13) | Inter 500 | Footnote, tab labels |
| `--type-caption` | .706rem (12) | Inter 600, letter-spacing .06em | Caption, overlines |
| `--type-lyric-now` | 2rem (34) | Inter 700 | Lyric current |
| `--type-lyric-next` | 1.529rem (26) | Inter 600 | Lyric upcoming |
| `--type-lyric-sung` | 1.294rem (22) | Inter 600 | Lyric sung |
| `--type-chord` | 1rem (17) | Inter 700 | Chord |
| `--type-mono` | 1.176rem (20) | IBM Plex Mono 600 | Tuner and tempo |

Add matching utility classes only if the repo already uses that pattern; otherwise the tokens are enough for later steps.

- `watchTextSize()` in `ui.js`: read `getComputedStyle(document.documentElement).fontSize`, then set `document.documentElement.dataset.ax` to `"3"` at 40 px or more, `"1"` at 28 px or more, and remove it below 28. Run it at start-up, on `resize` and on `visibilitychange` (iOS applies a text size change when the app comes back).

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

1. With Settings set to Dark, the app shows Road Ready dark; with Light, Road Ready light; with Auto, it follows the phone. (Option B: the new look appears on the Merch table as free and is the default for a fresh install.)
2. Green Room and Headliner look exactly as before (compare a screenshot of each against `origin/main`).
3. All 14 `--type-*` tokens, the spacing and radius tokens and all `--rr-*` tokens exist in both Road Ready looks.
4. The three fonts load from `vendor/fonts` with no network request elsewhere (check the Network panel or a Playwright request log), and work offline after the service worker installs.
5. A unit test computes WCAG contrast for these pairs and fails below the number shown: dark `--rr-text` on base 15, on card 14; `--rr-text-2` on card 7; `--rr-lyric-sung` on base 4.5; `--rr-chord` on base 7; `--rr-on-amber` on amber 7; `--rr-plate-text` on `--rr-plate-bottom` 7; `--rr-tab-off` on mesh 4.5; `--rr-engrave` on `--rr-pearl-done` 4.5; light `--rr-text` on base 12; `--rr-text-2` on base 4.5; `--rr-amber-text` on base 4.5; `--rr-lyric-sung` on card 4.5; `--rr-tab-off` on mesh 4.5. Read the values from `styles.css` in the test so the test and the CSS can't drift.
6. `data-ax` is `"1"` when the root font size is 33 px and absent at 17 px (a browser test).
7. With `prefers-reduced-motion: reduce`, nothing new animates (this step adds no animation; the plate press is instant).
8. The axe a11y test passes in both Road Ready looks.
9. No existing text changes size (px sizes are untouched).

## Screenshot check

Road (#/), Songbook (#/library), Rehearse (#/practice) and Settings (#/settings), each in Road Ready dark and light, phone size. Put them next to `r10-01`, `r10-02` and `r10-05`: the colours, fonts and tolex should match; the layout won't yet, and that's expected.

## Don't change

- Any screen's layout, markup or JavaScript beyond `applyTheme()` (option B only) and the `watchTextSize()` call.
- Louie's drawing (`louie.js` and the `--lv-*` variables): step 03 does him.
- The tab bar (`hud.js`): step 04.
- Green Room and Headliner, the older per-screen styles above the "Version 4 look" section, game logic, storage, keys, `core.js` (apart from VERSION).

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-01-tokens`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

