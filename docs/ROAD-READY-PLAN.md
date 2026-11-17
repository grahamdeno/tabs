# Road Ready plan

Road Ready is the new look for Louie: dark tolex, grille cloth, chrome piping, cream engraved plates and warm amber, set in Space Grotesk, Inter and IBM Plex Mono. The spec is `docs/road-ready/louie-design-spec.md`. Each step has a prompt in `docs/road-ready/claude-prompt-NN-*.md`.

## Graham's answers (top)

- 2026-11-17: **Road Ready replaces the two free looks.** Dark (data-look `neon`) becomes Road Ready dark. Light (data-look `festival`) becomes Road Ready light. Green Room and Headliner stay on the Merch table as they are. Look ids, prices and kinds are unchanged; only the names and the look change.
- 2026-11-17, step 02 (the Road): **fans and streak stay on the Road**, as an incentive: a Fans pill in the header that shows the streak while there is one (never a 0 or a lost streak). **No tuner on the Road**: you tune where you play (More and the song screen). **Louie's one line stays.** **The book button (Rehearse) goes**, since Rehearse is a tab.

## Branches

- All Road Ready work collects on the integration branch `road-ready`, cut from `main`.
- Each step uses its own branch (`rr-NN-name`) from a fresh `origin/road-ready` and opens one pull request into `road-ready`. Nothing merges without Opus's review and Graham's merge go.
- `main` gets the whole redesign as one release, with one version bump (VERSION and CACHE together), only on Graham's ship go. Until then VERSION and CACHE stay as they are in every step.

## Steps

| Step | What | Model |
|---|---|---|
| 01 | Tokens, fonts and surfaces | [Sonnet] |
| 02 | The Road | [Opus] |
| 03 | Louie in code | [Opus] |
| 04 | Tab bar and icons | [Sonnet] |
| 05 | Playing | [Opus] |
| 06 | Show Complete | [Sonnet] |
| 07 | Songbook | [Sonnet] |
| 08 | Me and the guitar case | [Sonnet] |
| 09 | Merch builder and guitar art | [Opus] |

Rules for whoever runs a step: one task per commit, `eslint .` and `node tests/quick.mjs`, push only the step's branch. When something doesn't match the plan, stop that part and write it under Surprises.

### Step 01 status

Built on `rr-01-tokens`: 27 `--rr-*` colour tokens for dark and light, type, spacing and radii tokens, the tolex and grille-cloth surfaces, the plate and capsule buttons, the look renames, the status bar colours, `axOf` with `--sys-px` and `data-ax`, and fonts vendored in `vendor/fonts/` (Space Grotesk 500 to 700, Inter 400 to 700, IBM Plex Mono 600, with licences).

### Step 02 status

Built on `rr-02-road` (Opus): the header strip, pearl inlays in four states, the amber connector, the callout and Louie peeking, in Road Ready dark and light. Green Room and Headliner keep the old Road. Surprises 10 to 21 below.

## Surprises

Found while building step 01. Each needs a decision or a look from Opus or Graham.

1. **`index.html` carries `data-look="neon"` on `<html>`.** The prompt did not ask for it. It makes the first paint use Road Ready dark before the script applies the saved look. Remove it if you would rather the first paint stay unstyled.
2. **Manifest colours are unchanged.** `manifest.webmanifest` still has its old `theme_color` and `background_color`. The meta `theme-color` and the in-app status bar colours are updated (`#141210` dark, `#F6EFE2` light). **Fixed in review: set to #141210.**
3. **`merch.js` SWATCH.** The Merch table's swatches for the two renamed looks still show the old palette colours. Left alone because it is outside this step. Decide whether the swatches should show the new base colours. **Fixed in review: swatches now start with the Road Ready base colours.**
4. **Tap tempo chip moved while tapping.** With the new fonts the chip label "Tap 3 more" is wider than "Tap", so the chip wrapped to the next row and the thumb lost it (the test "an Apple Music link sets the song's length; tapping sets the tempo" caught it). Fixed in CSS: `.ed-tap` has a minimum width of 9.5em and centres its label. A new test in `roadready.e2e.mjs` checks the chip's position does not change.
5. **Existing tests changed.** `settings.e2e.mjs` (new look names and the two status bar colours), `app3.e2e.mjs` (two assertions now expect Space Grotesk instead of Fredoka). No assertion was weakened.
6. **Contrast is checked from `styles.css`, axe not run locally.** The a11y test (axe) could not run here because axe-core is not installed and package installs are off. CI runs it.
7. **Fonts built with a stand-in.** The woff2 files were made with fontTools and a Node brotli stand-in because the `brotli` Python module was missing. They are standard woff2 and the tests check the header, size and licences. **Fixed in review: replaced with IBM's official unmodified Latin-1 SemiBold woff2 from IBM/plex (the licence reserves the name "Plex"), no renaming needed. Space Grotesk and Inter are still the fontTools builds with the Node brotli stand-in; they are valid woff2.**
8. **`CLAUDE.md` named Festival Poster and Neon Midnight.** Step 01 left it alone and put suggested wording in the PR. **Fixed in review: Graham said yes, and `CLAUDE.md` now describes Light and Dark as Road Ready.**
9. **`--mono` was also used by tab blocks, the editor and chord charts.** Fixed in review: `--mono` stays the system font, and Plex Mono is `--readout`, for the tuner and tempo in later steps.

Found while building step 02.

10. **Green Room and Headliner keep the old Road.** The new markup can't leave those looks "exactly as before", so `renderRoad()` draws the Road Ready Road only when `data-look` is `neon` or `festival`, and the old one otherwise. The book button is removed from the Road Ready header only; the old Road keeps it. Decide whether the two other looks should get the new Road later.
11. **`statBar()` also settles Rain checks and fading fans.** The Road no longer calls it, so `hud.js` now has `settleStats()` (the settling, called by `statBar()` and the Road) and `statNotices()` (the toasts). `statBar()` itself behaves as before.
12. **The header differs from spec 5.5 on Graham's answers.** No Tune button; a Fans pill (fans, with the streak under it while there is one). Two rows: the plate and Tips, then Tonight and Fans. In the page, and to a screen reader, the order is plate, Fans, Tips, Tonight.
13. **Louie's line sits under the strip, not above Louie.** Beside the neck there is about 125 px, so his lines would need four or more lines there. Under the strip it is real text, in reading order after the header.
14. **The callout is always on the right of the neck.** The neck is narrow, so the right side fits every stop, and the left side is where Louie peeks in. The prompt said to flip it for stops on the right.
15. **Header colours in light.** The prompt said dark tolex in both looks, but `--tolex` is cream in light, which matches `r10-02`; used `--tolex`. Tonight uses `--rr-card` as the prompt says (cream in light), where `r10-02` shows a dark bar.
16. **Every inlay is pearl.** The old Road drew each guitar's own inlay shape and material (blocks, stars, abalone). Road Ready follows the spec: pearl dots, the trapezoid, the crate and the double. Step 09 (guitar art) may want them back.
17. **The headline show while it is current** has no state in the spec: both dots glow in the current pearl, the left with the number and the right with an engraved star.
18. **The songs chip** reads "2 songs" in words on stops ahead only; the current stop's callout says it instead.
19. **The Songbook bar** along the bottom of the Road is not in the mockups (step 04 puts Songbook in the tab bar). Left as it is.
20. **Opening night shows the word "undefined"** in its first pick on a fresh install: `OIC` in `road.js` has no icon for the "who" step. It is on `main` today, not from this step. Not fixed here; it needs Graham's go.
21. **Existing tests changed:** `app3` (the old Road's home test and the box-material test now run in Green Room; the box, headline, Rain check and Tonight checks read the new header and pearls), `opening` (the stat-bar labels test runs in Green Room), `practice` (the Rehearse button test runs in Green Room), `profile` (opens your profile from Fans), `guitarist` (Louie's picture and `#rd-bubble`). Ids gone from the Road Ready Road: `h-streak` (the streak is in `h-fans`), `rd-book`, and the `.hud`, `.rd-banner`, `.rd-chip` and `.rd-say` blocks. Kept: `h-venue`, `h-fans`, `h-tips`, `rd-tonight`, `rd-bubble`.
