# Guitar handoff: 23 guitars for the app

Art for Road Ready step 09 (Grok, on `rr-09-art`). This file lists the picture to use for every guitar. Claude wires them in; see `docs/guitars/claude-handoff-prompt.md`.

## Format of every picture

- **Whole guitar:** 768 x 1376 JPEG, the same frame as `docs/guitars/pics/cutaway-sunburst.jpg`. Upright and straight, headstock at the top. The top of the headstock sits at y about 65 and the neck is centred at x about 382 (measured a third of the way down the guitar). All pictures are at one scale, the image model's own size, so relative body sizes are approximate.
- **Headstock close-up:** 1024 x 1024 JPEG, laid out like `docs/guitars/pics/cutaway-sunburst-head.jpg`: rounded head in the top half, 3+3 tuners, the nut at y about 590 (Razorwing about 700, Toxic Checker about 620), the fretboard to the bottom edge.
- **Background key:** flat #FF00FF. Away from the guitar it is exact; JPEG leaves small ripples within a few pixels of the edge, as in the existing pictures. `tools/guitars/pics.py` (`cutout`, `defringe`) handles that.
- **Rules met:** rounded 3+3 headstock, no logos, brand names or text, original body outlines.
- **Strings:** every whole picture here has painted strings. The existing `cutaway-sunburst.jpg` has none, because the Road draws its own strings over the picture (`stringLayer` in `fretboard.js`). See the note on strings at the end.

## The 23 guitars

| # | Slug | Name | Category | Body | Finish | Whole picture | Size | Headstock close-up | Size | Road leg |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `porch` | Porch | road | acoustic, small parlor | natural spruce top, rosewood fretboard | `docs/guitars/pics/porch.jpg` | 768 x 1376 | `docs/guitars/pics/porch-head.jpg` | 1024 x 1024 | open: Leg 1, Open chords (today: The beater, parlor) |
| 2 | `cornerstone` | Cornerstone | road | acoustic, dreadnought | cherry sunburst, tortoise guard | `docs/guitars/pics/cornerstone.jpg` | 768 x 1376 | `docs/guitars/pics/cornerstone-head.jpg` | 1024 x 1024 | switch: Leg 2, Chord switches (today: The cutaway) |
| 3 | `clubslab` | Club Slab | road | electric, single-cut slab | charcoal grey, cream guard | `docs/guitars/pics/clubslab.jpg` | 768 x 1376 | `docs/guitars/pics/clubslab-head.jpg` | 1024 x 1024 | scales: Leg 3, Scales (today: The solid-body) |
| 4 | `hollowhill` | Hollow Hill | road | electric, single-cut semi-hollow, one f-hole | natural amber | `docs/guitars/pics/hollowhill.jpg` | 768 x 1376 | `docs/guitars/pics/hollowhill-head.jpg` | 1024 x 1024 | strum: Leg 4, Strumming (today: The hollow-body) |
| 5 | `swing` | Swing | road | electric, offset double-cut, short round horns | navy blue | `docs/guitars/pics/swing.jpg` | 768 x 1376 | `docs/guitars/pics/swing-head.jpg` | 1024 x 1024 | pick: Leg 5, Picking (today: The single-cut) |
| 6 | `koaarc` | Koa Arc | road | acoustic, cutaway, arc of seven small sound ports on the upper treble side | figured koa | `docs/guitars/pics/koaarc-v2.jpg` | 768 x 1376 | `docs/guitars/pics/koaarc-head.jpg` | 1024 x 1024 | finger: Leg 6, Fingerstyle and barre (today: The classical) |
| 7 | `comet` | Comet | road | electric, swept body, one long bass horn | red metal flake | `docs/guitars/pics/comet.jpg` | 768 x 1376 | `docs/guitars/pics/comet-head.jpg` | 1024 x 1024 | encore: the Encore guitar (today: The headliner, swallow) |
| 8 | `highline` | Highline | custom | electric, slab in the spirit of a classic single-cut, own outline: stubby rounded bass shoulder, teardrop treble cutaway, oval tail | stabilized buckeye burl (cream, smoky blue, amber), cream binding | `docs/guitars/concepts/highline.jpg` | 768 x 1376 | `docs/guitars/concepts/highline-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 9 | `velvetcrown` | Velvet Crown | custom | electric, carved-top double-cut, short rounded horns | quilted maple, ocean-blue to black burst, abalone blocks | `docs/guitars/concepts/velvetcrown.jpg` | 768 x 1376 | `docs/guitars/concepts/velvetcrown-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 10 | `ghostspalt` | Ghost Spalt | custom | electric, slim offset double-cut | spalted maple, natural satin | `docs/guitars/concepts/ghostspalt.jpg` | 768 x 1376 | `docs/guitars/concepts/ghostspalt-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 11 | `redwoodhollow` | Redwood Hollow | custom | electric, single-cut hollow archtop, one cat's-eye sound hole, trapeze tail | redwood burl, amber edge burst, gold hardware | `docs/guitars/concepts/redwoodhollow-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/redwoodhollow-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 12 | `razorwing` | Razorwing | custom | electric, angular shredder, faceted gem-cut body | chameleon colorshift (violet, emerald, gold) | `docs/guitars/concepts/razorwing.jpg` | 768 x 1376 | `docs/guitars/concepts/razorwing-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 13 | `nova` | Nova | custom | electric, four-point star body | candy red over gold burst, gold hardware | `docs/guitars/concepts/nova.jpg` | 768 x 1376 | `docs/guitars/concepts/nova-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 14 | `arrowhead` | Arrowhead | custom | electric, split-tail body with two curved wings | silver-to-charcoal metal-flake sparkle | `docs/guitars/concepts/arrowhead.jpg` | 768 x 1376 | `docs/guitars/concepts/arrowhead-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 15 | `ziricotegrand` | Ziricote Grand | custom | acoustic, jumbo with a soft Venetian cutaway | ziricote with pale sapwood flames, abalone purfling | `docs/guitars/concepts/ziricotegrand-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/ziricotegrand-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 16 | `walnuthall` | Walnut Hall | custom | acoustic, grand auditorium, Venetian cutaway | figured claro walnut, paua rosette, vine inlay | `docs/guitars/concepts/walnuthall.jpg` | 768 x 1376 | `docs/guitars/concepts/walnuthall-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 17 | `islander` | Islander | custom | electric, two inward-curling crescent horns and a scooped notch in the tail | curly koa, honey-to-chocolate burst, gold tuners | `docs/guitars/concepts/islander-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/islander-v2-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 18 | `stickerriot` | Sticker Riot | punk | electric, hornless hexagon slab | gloss black, sticker-bombed with plain shapes | `docs/guitars/concepts/stickerriot-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/stickerriot-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 19 | `spraycancrack` | Spraycan Crack | punk | electric, crescent-moon body, two outward horns | cracked black with hot-pink stencil stripes, duct tape | `docs/guitars/concepts/spraycancrack-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/spraycancrack-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 20 | `tartanpin` | Tartan Pin | punk | electric, hornless coffin body | red and black tartan wrap, safety pins | `docs/guitars/concepts/tartanpin.jpg` | 768 x 1376 | `docs/guitars/concepts/tartanpin-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 21 | `toxicchecker` | Toxic Checker | punk | electric, chunky zig-zag lightning-bolt body | neon green and black checkerboard | `docs/guitars/concepts/toxicchecker.jpg` | 768 x 1376 | `docs/guitars/concepts/toxicchecker-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 22 | `barebones` | Bare Bones | punk | electric, reverse body with one horn on the treble side | heavy relic, bare ash, duct-tape X | `docs/guitars/concepts/barebones.jpg` | 768 x 1376 | `docs/guitars/concepts/barebones-head.jpg` | 1024 x 1024 | (not a leg guitar) |
| 23 | `flyerwall` | Flyer Wall | punk | electric, boxy torn-paper body, short square bass horn, ripped zig-zag bottom | torn poster collage (shapes and halftone only) | `docs/guitars/concepts/flyerwall-v2.jpg` | 768 x 1376 | `docs/guitars/concepts/flyerwall-head.jpg` | 1024 x 1024 | (not a leg guitar) |

## Notes per guitar

- **Koa Arc:** Use koaarc-v2.jpg (strings and frets added). koaarc.jpg (no strings) stays in the repo; its close-up koaarc-head.jpg is reused.
- **Redwood Hollow:** Use the v2 (cat's-eye hole). Headstock unchanged, so it reuses redwoodhollow-head.jpg.
- **Razorwing:** Its headstock has a deeper top notch than the others; still rounded 3+3.
- **Ziricote Grand:** Use the v2 (true jumbo). Reuses ziricotegrand-head.jpg.
- **Islander:** Use the v2 and its own close-up islander-v2-head.jpg (gold tuners, bound koa head).
- **Sticker Riot:** Use the v2. Reuses stickerriot-head.jpg (plain black head).
- **Spraycan Crack:** Use the v2. Reuses spraycancrack-head.jpg (all six tuner posts visible).
- **Flyer Wall:** Use the v2. Reuses flyerwall-head.jpg, which has a small paper scrap on the head that the full picture does not show.
- **Originals kept:** `islander.jpg`, `stickerriot.jpg`, `spraycancrack.jpg`, `flyerwall.jpg`, `redwoodhollow.jpg`, `ziricotegrand.jpg` and `koaarc.jpg` are still in the repo. Use the files in the table.
- **Tartan Pin and Sticker Riot** are both hornless slabs (coffin and hexagon). They read differently, but they are the closest pair in the set.

## Road legs

From the step 09 sub-plan in `docs/ROAD-READY-PLAN.md`: each leg still earns one guitar when its headline show is done (`guitarsEarned`, `data.guitars.seen`). Leg ids and saves don't change; only the guitar each leg gives changes. The leg ids are in `core/neck.js` (`open`, `switch`, `scales`, `strum`, `pick`, `finger`) plus `encore` in `GUITARS`.

| Leg id | Leg name | Today (`GUITARS` in `core/game.js`) | Becomes |
|---|---|---|---|
| `open` | Open chords | The beater (parlor) | Porch |
| `switch` | Chord switches | The cutaway | Cornerstone |
| `scales` | Scales | The solid-body | Club Slab |
| `strum` | Strumming | The hollow-body | Hollow Hill |
| `pick` | Picking | The single-cut | Swing |
| `finger` | Fingerstyle and barre | The classical | Koa Arc |
| `encore` | (the Encore guitar, data only) | The headliner (swallow) | Comet |

The sub-plan's unlocks by venue (`VENUES` in `core/turf.js`): Stock free with every guitar; Shop opens at Coffeehouse; Custom and Print guards at Club; Flame tops at Theater. The 16 concepts are not in the sub-plan yet; where they go on the Merch table, their prices and unlocks are a decision for Graham (see the Claude prompt).

## Where guitars live in the code today

- `core/game.js`: `GUITARS` (one entry per leg id: `name`, `kind`, `body`, `head`, colours, `inlay`, `mat`) and `guitarFor(legId)`.
- `fretboard.js`: `NANO_FILE` (leg id to picture name), `BODY_FILE` (body to picture name), `guitarPic(body)`, `picOf`, `picLayout` and `picBase`, `stringLayer`, `neckHTML`, `guitarSVG`.
- `tools/guitars/pics.py`: `NAMES`, `CLOSEUP` (a row that crosses the neck in the close-up), `BRIDGE` (where the strings end), `cutout`, `defringe`. It writes `art/guitars/<name>-head.webp`, `-body.webp`, `-small.webp` and `art/guitars/pics.js` (generated, never edited by hand). It reads only `docs/guitars/pics/` today.
- `sw.js`: every `art/guitars/*.webp` and `pics.js` is in `SHELL`.
- Users of `guitarPic`: `profile.js` (the guitar case on Me), `road.js` (the new-guitar sheet and Show complete), `gig.js`, `guitarist.js` (the guitar in the guitarist's hands).
- `tests/core.test.mjs` checks the picture numbers and files (around lines 1728 and 2843 to 2866).
- `docs/DATA.md` describes `data.guitars`; the sub-plan adds `data.builds` and `b-` ids in `data.merch.has`.

## Note on strings

Graham asked for every guitar to show its strings, so the pictures here have them. The Road neck draws its own strings over the head and body pictures (`stringLayer`), and `pics.py` already paints out a bridge the app draws itself (the `cutaway` case). On the Road neck, painted and drawn strings may double. Either skip the drawn strings for a picture that has its own, or cut the painted strings out of the `-body` and `-head` pieces. The whole pictures (`-small`, the case, Show complete) can keep them. `koaarc.jpg` (no strings) is still there if a stringless source is wanted for the neck.
