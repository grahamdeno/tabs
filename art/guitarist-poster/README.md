# The Gig poster guitarist

Ink layers for the guitarist, drawn like a screenprinted show poster: cream paper, black ink line, amber ink, one spot
ink, halftone shade, a little misregistration and paper grain. Graham picked this style (Gig poster) on 2026-11-19.
Plan: `docs/gig-poster/PLAN.md` on `rr-12-gig-poster`.

Grok makes and changes these files. Claude writes the renderer that uses them and never edits them (CLAUDE.md).

## Files

| File | What it is |
|---|---|
| `art/guitarist-poster.js` | Every part as ink layers, plus the frames, the print settings and the bust settings. `export default` one object. |
| `art/guitarist-poster/grain.webp` | The paper-grain tile, 256 px, grey. Used as a luminance mask over the inks (dark specks are where the ink didn't take) and, multiplied, over the cream card. |
| `tools/guitarist/poster_art.py`, `poster_hair.py`, `poster_geom.py` | The first-pass source. The parts are drawn as vectors in code (shapely), split by ink, then written to `art/guitarist-poster.js`. |
| `poster_pass2.py` (on Grok's box, not in the repo yet) | The second pass: it reuses the parts above, scales the head and body to full-length proportions, adds the legs, redraws the arms for the smaller guitar and the beards, and writes `art/guitarist-poster.js`. The second pass could only change `art/` files, so this script and its small edits to `poster_art.py` (z's, collars, flannel threads, lapels) are not committed. Ask Grok to add them. |
| `tools/guitarist/poster_preview.mjs` | The reference compositor, `posterSVG(me, opts)`, and the preview pages: `node tools/guitarist/poster_preview.mjs sheet|all|combos out.html`, then screenshot the page. |
| `docs/gig-poster/sheet.jpg` | Six guitarists, full size and as the bust at 96, 44 and 32 px, on the Dark and Light looks. |

The halftone and stipple patterns are tiny SVG patterns, made from the numbers in `print` (see below), so they need no file.

## The frame

The same frames as today's guitarist (`guitarist.js`), so the screens keep their layout:

- `frame.full` `16 0 168 252` for `play` and `rest`, `frame.hornsUp` `-4 0 208 252`, `frame.bust` `30 14 140 150`.
- The whole figure stands in the frame: crown at y 12, chin about 46, feet at about 251. The head is about 34 units of a
  239-unit figure, so a seventh of the body. Centred on x = 100.
- The legs (black jeans, cream sneakers) are part of `neck`, so they are drawn before the clothes and the shirt hem
  overlaps them.
- Lefty is the app mirroring the whole figure: `translate(200 0) scale(-1 1)`.
- The guitar is still the painted picture with the same `guitar.box`, but `guitar.transform` is new so it fits the
  smaller body: `translate(94 118) rotate(52) scale(0.66) translate(-84 -196)`. The fretting hand is drawn round the neck
  at `guitar.fret` and the strumming hand over the strings at `guitar.strum`. The renderer already reads both from here.

## Layers

Every part is a list of layers `[ink, tone, d]`. Draw them in order, each as `<path d="..." fill-rule="evenodd">`.

**Inks**

| ink | colour |
|---|---|
| `paper` | `inks.paper` #F6EEE0 (eye whites, teeth, glints, the bandana's dots) |
| `line` | `inks.line` #1B1714, the black ink |
| `amber` | `inks.amber` #FFB547 (the pick, trim, studs, beads, the cap's star, the sleepy z's, the flannel's threads and collar edge) |
| `skin` | `SKIN[me.skin]` (six tones, `guitarist.js`) |
| `hair` | `HAIR_COL[me.hairCol]` (nine colours). Beards and moustaches use it at tone 2 (the deep shade) under black-ink strands, so a beard reads as its own darker, textured colour, never the same flat colour as the hair. Stubble is the skin's deep shade (`skin` tone 2 and 1). Brows are `line`. |
| `top` | `OUTFIT_COL[me.top]` (eight colours) |
| `hat` | `OUTFIT_COL[me.extraCol]` (as today) |
| `spot` | the look's second garment: `spot[look]` (denim vest, leather, stage jacket). The app may pass its own spot colour. |

**Tones**

| tone | how to draw it | in the small bust |
|---|---|---|
| 0 | the ink | same |
| 1 | the shade colour, masked by the halftone pattern | the ink mixed halfway to its shade, solid |
| 2 | the deep shade, solid | same |
| 3 | the ink at `print.stipple.opacity`, masked by the stipple pattern | the ink at 40 percent |

Shade colours (as `shadeOf` and `deepOf` in the compositor):

- shade: the ink mixed 42 percent toward `line`; a dark ink (luma under 70) goes 30 percent toward `paper` instead, so
  black hair and leather get a sheen; a very light ink (luma over 200) goes 34 percent toward #7A6A58.
- deep: 26 percent toward `line`; a dark ink 35 percent toward black; a very light ink 22 percent toward #7A6A58.
- `paper` with tone 1 is paper-coloured dots (a glint on the glasses).

**Print settings** (`print`)

- `halftone`: dots of radius `dot` on a `cell` grid, rotated `angle` degrees, in user units. Make it a white-on-black
  `<pattern>` and use it as a `<mask>`, so one pattern serves every colour.
- `stipple`: the same, finer, for tone 3.
- `misregister`: every layer that isn't `line` is moved by this much (`translate(1 .7)`), so the colour sits a little
  off the black, like a real print. Not in the small bust.
- `grain`: `file` tiled every `tile` units, as a luminance mask over the figure (not over the painted guitar), and at 55
  percent with `mix-blend-mode: multiply` over the cream card. Not in the small bust.

## Parts and the draw order

Draw the full figure in this order (`posterSVG` does exactly this):

1. `hair[style].back` (behind the head and shoulders)
2. `neck`
3. `looks[look]` (the body from the neck down: tee, flannel, vest, leather, stage)
4. the painted guitar (pose `play` only)
5. `arms[pose]` (skin arms and hands with fingers)
6. `sleeves[pose][look]` (each look's sleeves; short for tee and vest, long for the rest)
7. `head` (ears, face, its shade and line)
8. `faces[mood]` (eyes with lids, brows, nose, mouth): happy, cheer, proud, sleepy, worried
9. `beards[beard]` (stubble, moustache, beard), if any
10. `glasses`, if `me.glasses`
11. `hair[style].front`
12. `hats[extra].layers` (beanie, cap, bandana), if any

Steps 1 to 3 and 5 to 12 go inside the grain mask; the guitar doesn't.

With a hat on, hide the hair under it: mask both hair parts with `hats[extra].hides` (white everywhere, that path black).
The beanie and the cap hide everything above their brim, so a mohawk doesn't poke through; the bandana hides only the band.

Poses: `play`, `rest` (standing, arms down), `hornsUp` (both arms up, rock horns). No pose has a single finger up on
its own.

The 13 hair styles are the saved values (`ME_HAIR`): shag, curly, buzz, mohawk, braids, bob, bun, swoop, long, locs,
pixie, ponytail, longhawk. Buzz, mohawk, bun, swoop, pixie and longhawk have no back part (an empty list).

Patches: the chest is smaller and higher now, so today's `SPOTS` (y 178 to 228) land on the legs. The same spots moved
onto the new chest are `[[113,97],[122,110],[111,112],[127,125],[113,128]]`, and the patches would want drawing at about
0.6 of their size (`translate(x y) scale(.6) translate(-x -y)`) so five fit. The bust pin at (122, 142) still sits on
the chest and can stay. Both are renderer changes (Claude).

## The small bust

`crop: "bust"` draws head and shoulders in a cream disc, in `frame.bust`:

1. A `paper` circle at `bust.disc` (cx, cy, r).
2. The figure in pose `rest`, with `transform` `bust.transform`, clipped to the disc plus the frame above the disc's
   centre (so big hair, a bun or a mohawk can break out of the top of the disc).
3. A hairline: the same circle, r minus 0.5, stroke `line` at 30 percent, 1 unit. It keeps the disc off a cream ground in
   the Light look.

At 48 px and smaller (card 44 px, chart row 32 px), draw it flat: no halftone, no stipple, no misregistration, no
grain, and give every `line` layer a stroke of `bust.flatStroke` units in `line` for a heavier line. The disc keeps dark
skin and dark hair readable on the Dark look.

## The full figure on its card

The poster card (`card: true` in `posterSVG`) is a `paper` rectangle, inset 1 unit, corner radius 7, with
`card.burst` (a starburst behind the head) in the spot ink, or amber when the spot ink is dark, the grain multiplied
over it, and a hairline edge. In the maker this is the "TONIGHT" poster; elsewhere the app can draw the figure without
the card (`card: false`).

## Why there is no beard ink

The renderer only tints the inks listed above, and the saved guitarist has no beard colour, so a new `beard` ink would
draw nothing. A beard with its own colour needs two app changes: a beard colour in the maker and `ink.beard` in
`guitarist.js`. Until then the beards use `hair` tone 2 plus black strands, which works with the renderer as it is.

## Sizes

`art/guitarist-poster.js` is about 98 KB (about 29 KB gzipped); the first pass was 217 KB. Hair is about half of it.
