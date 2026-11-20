# Art backlog for Grok

Opened 2026-11-19 by Claude (Louie Review). Claude never changes a picture under `art/` (CLAUDE.md), so every item
here is a picture that needs Grok. Each item gives the file, what is seen at phone size, and what is wanted. The agreed
pictures are in `docs/road-ready/images/` (`AGREED.md` lists them). Claude builds the code that uses each picture.

Standing decisions (Graham, 2026-11-19): Louie is not on the Road. The Road header stays the minimal one row. Louie is
black. The agreed pictures set the look and materials; these later decisions set the Road's layout.

| # | Where | File today | What is seen | What is wanted | Agreed picture |
|---|---|---|---|---|---|
| 1 | Me, the guitar case | `art/case/velvet-slot.webp`, `art/case/latch.webp` | Flat brown padded squares that read as chocolate bars. Empty until a guitar is earned. | The open case lined in deep orange crushed velvet, lit from above, with the guitars lying in it and real depth. | `agreed-me.jpg` |
| 2 | Every guitar (Road, Merch, case, Show complete) | `art/guitars/*.webp` (Look A, PR #133) | Flat, evenly lit guitars with little shadow or sheen. | Guitars with elevation: soft shadow under the body, gloss on the top, binding that catches light, as in every agreed picture. | `agreed-guitar-lineup.jpg`, `agreed-merch-dark.jpg`, `agreed-road-dark.jpg` |
| 3 | Merch, Louie's finishes | hidden since 4.102.0 | The old finishes went with the old Louie. | The tweed Louie in his other colours (item 10). | none |
| 4 | Merch, stage backdrops | drawn in code | Flat colour thumbnails (Basement, Brick wall, Starlight). | Painted thumbnails that sit with the tolex and chrome. | `agreed-merch-dark.jpg` for the materials |
| 5 | Show complete, the case | `art/show/case-*.webp` | Painted for the three guitars the Road had before 9a; newer guitars sit on a generic open case. | A case painting, or one case that fits every guitar, for the 23 guitars. | `agreed-show-complete-case.jpg` |
| 6 | Loading screen | `index.html` boot picture, `icons/splash/*` | On a Light phone the loading screen is dark, then the app turns cream. | A Light loading screen, or one ground that suits both. | none |
| 7 | Road, first leg (PR #137, parked) | `grok-road-leg1` | The guitar is greyed out (flat dark grey in Light); the locked HEADLINE plate is almost unreadable in Dark; a cut-off piece of body shows at the right edge; the next leg's headstock is a black shape in Light; one test fails (`paintedroad.e2e.mjs` line 123, contrast 1.49). | A rich guitar as in the agreed Road, and the test passing. | `agreed-road-dark.jpg`, `agreed-road-light.jpg` |
| 8 | Tab bar, if Graham chooses knobs | none yet | The app has line icons. | Five amp knob faces, off and lit, if the knob bar from the Merch screen becomes the app's tab bar. Waits for Graham's choice. | `agreed-merch-dark.jpg` |
| 9 | Green Room and Headliner | whole look | Both still draw the screens from before the redesign. | Bring both into the new design, or retire them. Until then nothing may switch a player into them without their asking. | none |
| 10 | Louie, everywhere | `art/louie/v4/*.webp`, `docs/louie-tweed/` | The tweed Louie, cut out by Claude from Graham's white-background pictures (nine poses). Nervous is missing and borrows listen. | Clean cut-outs, the six missing poses, his other colours, and a face-only picture for the icon. See `docs/louie-tweed/README.md`. | `docs/louie-tweed/source/pose-sheet.jpg` |
| 11 | The Road, Dark leather | `art/surfaces/tolex-dark.webp` | A fine brown pebble. The app shows it neutral black at a finer grain since 4.107.0, but the pattern is still different. | The agreed leather: near black, larger cells with fine light crease lines, a soft sheen. A seamless tile like the current one. | `agreed-road-dark.jpg` (the leather around the guitar) |
| 12 | App icon and tab icon | `icons/*.png`, `tools/icons/make.py` | Since 4.110.0 the icon is Louie throwing the horns (Graham's pick B), built by the tool from Claude's cut-out. The 32 px tab icon is a crop of the same picture's cabinet and face, softened by scaling. | The horns icon from a clean cut-out, and a hand-tuned 32 px and 16 px tab icon: Louie's face and cabinet drawn for that size, crisp eyes and smile, no specks. | `icons/icon-1024.png`, `icons/favicon-32.png` |

## Ideas, not yet items

- A glowing bar on a fretboard to show progress on the Road or elsewhere (Graham, 2026-11-19). Needs a read-back before it is an item.
