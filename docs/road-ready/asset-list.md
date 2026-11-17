# Louie Road Ready: asset list (images versus code)

**Rule of thumb:** anything flat, sharp or stateful is drawn in code (CSS or SVG) so it scales with text size and switches between light and dark. Only painted, textured or character art ships as images. Web images are `.webp` at 3x their display size, in `art/`, cached like `art/guitars/`.

## Ship as images

| Asset | Where it's used (step) | Made from (design files, not in the repo) | In `images/` |
|---|---|---|---|
| Louie peek, dark (rim) and light | Road (02) | `round10/assets/louie-road-ready-peek.png` (fixed in round 11: closed mitten) | `images/louie-peek-dark.webp`, `louie-peek-light.webp` (600 px tall) |
| Louie cheering, dark and light | Show Complete (06) | `round10/assets/louie-road-ready-cheer.png` | `louie-cheer-dark.webp`, `louie-cheer-light.webp` |
| Louie listening, dark and light | Playing first-run hint (05) | `round10/assets/louie-road-ready-listen.png` | `louie-listen-dark.webp`, `louie-listen-light.webp` |
| Louie idle, dark and light | Spare, tips and empty states | `round10/assets/louie-road-ready-idle.png` | `louie-idle-dark.webp`, `louie-idle-light.webp` |
| Louie face badge (44 px, circle) | Songbook hint (07), Me tip jar (08) | panel crop of the idle pose | `louie-face-badge.webp` (132 px) |
| Proud, oops, sleepy, nervous, celebrating poses | Later, as needed | `r10-00` sheet (expressions row) | Not exported yet; redraw from the sheet when a screen needs them |
| Open hard case with orange plush | Show Complete case (06), Me case (08), builder (09) | `r10-03`, `r10-06` (crop the case), or redraw | Not yet. Steps 06 and 08 fall back to CSS if missing |
| Guitar renders per body, as layers (body paint, guard, hardware, wear overlay, long-string overlay), rounded 3+3 headstock, no logos | Road neck, Show Complete, Me, builder (09) | `r10-11` lineup, `r10-12` to `r10-18` finishes | Not yet. Needs a clean render per body; step 09 plans it |
| Tolex and mesh bitmap tiles (512 px, dark and light) | Optional upgrade for surfaces (01) | Make fresh seamless tiles | Optional. Step 01 builds both in code first |
| App icon and launch screens in Road Ready | `icons/`, later | `r10-00` idle pose | Out of scope for now |

## Draw in code

| Piece | Built with | Step |
|---|---|---|
| Colour, type, spacing and radius tokens | CSS custom properties | 01 |
| Tolex grain and grille-cloth weave | CSS gradients and an `feTurbulence` SVG data URI | 01 |
| Cream engraved plate buttons, secondary capsules | CSS | 01 |
| Header strip, venue plate, pips, Tune, Tips, Tonight | HTML and CSS | 02 |
| Inlay stops (done, current, locked, double, crate) | SVG with radial gradients | 02 |
| Curved amber connector and its draw-on | SVG path, `stroke-dashoffset` | 02 |
| Callout and speech bubbles | HTML and CSS | 02 |
| Louie in every other place (sheets, tips, Rehearse) | SVG in `louie.js`, locked palette | 03 |
| Five tab icons (Road, Songbook, Rehearse, Tour, Me) | Inline SVG line icons, 1.9 px stroke | 04 |
| Lyrics, chords, progress hairline, controls | HTML and CSS | 05 |
| Reward tiles, chrome corner brackets, sparks, glow | CSS, SVG, `<canvas>` for sparks | 06 |
| Songbook rows, chips, mastery dots | HTML and CSS | 07 |
| Stat tiles, rows, milestones | HTML and CSS | 08 |
| Builder chips, swatches, segmented control, switch | HTML and CSS | 09 |

## Reference files each step reads (all in `images/`)

- 01: `louie-design-spec.md`, `r10-01`, `r10-02`, `r10-05`, `r10-06`
- 02: spec, `r10-01`, `r10-02`, `r8-03`, `r9-03`, `r10-00`, `louie-peek-dark.webp`, `louie-peek-light.webp`
- 03: spec, `r10-00`, `r10-contact-louie-assets.jpg`, idle, cheer and listen light webps
- 04: spec, `r10-01`, `r10-02`, `r10-06`, `r8-15`
- 05: spec, `r10-07` to `r10-10`, listen webps
- 06: spec, `r10-03`, `r10-04`, `r8-05`, cheer webps
- 07: spec, `r10-05`, face badge
- 08: spec, `r10-06`, face badge
- 09: spec, `r10-11` to `r10-19`
