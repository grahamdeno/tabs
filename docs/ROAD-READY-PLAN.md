# Road Ready plan

Road Ready is the new look for Louie: dark tolex, grille cloth, chrome piping, cream engraved plates and warm amber, set in Space Grotesk, Inter and IBM Plex Mono. The spec is `docs/road-ready/louie-design-spec.md`. Each step has a prompt in `docs/road-ready/claude-prompt-NN-*.md`.

## Graham's answers (top)

- 2026-11-17: **Road Ready replaces the two free looks.** Dark (data-look `neon`) becomes Road Ready dark. Light (data-look `festival`) becomes Road Ready light. Green Room and Headliner stay on the Merch table as they are. Look ids, prices and kinds are unchanged; only the names and the look change.

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

## Surprises

Found while building step 01. Each needs a decision or a look from Opus or Graham.

1. **`index.html` carries `data-look="neon"` on `<html>`.** The prompt did not ask for it. It makes the first paint use Road Ready dark before the script applies the saved look. Remove it if you would rather the first paint stay unstyled.
2. **Manifest colours are unchanged.** `manifest.webmanifest` still has its old `theme_color` and `background_color`. The meta `theme-color` and the in-app status bar colours are updated (`#141210` dark, `#F6EFE2` light).
3. **`merch.js` SWATCH.** The Merch table's swatches for the two renamed looks still show the old palette colours. Left alone because it is outside this step. Decide whether the swatches should show the new base colours.
4. **Tap tempo chip moved while tapping.** With the new fonts the chip label "Tap 3 more" is wider than "Tap", so the chip wrapped to the next row and the thumb lost it (the test "an Apple Music link sets the song's length; tapping sets the tempo" caught it). Fixed in CSS: `.ed-tap` has a minimum width of 9.5em and centres its label. A new test in `roadready.e2e.mjs` checks the chip's position does not change.
5. **Existing tests changed.** `settings.e2e.mjs` (new look names and the two status bar colours), `app3.e2e.mjs` (two assertions now expect Space Grotesk instead of Fredoka). No assertion was weakened.
6. **Contrast is checked from `styles.css`, axe not run locally.** The a11y test (axe) could not run here because axe-core is not installed and package installs are off. CI runs it.
7. **Fonts built with a stand-in.** The woff2 files were made with fontTools and a Node brotli stand-in because the `brotli` Python module was missing. They are standard woff2 and the tests check the header, size and licences.
8. **`CLAUDE.md` still names Festival Poster and Neon Midnight.** Not edited, per the prompt. Suggested wording is in the PR for Graham's yes.
