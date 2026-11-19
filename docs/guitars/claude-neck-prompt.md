# FOR CLAUDE (Louie, grahamdeno/tabs): stops on the painted guitar necks

**Stop before anything that can't be undone.** Do not merge anything. Do not push to `main`, `next`, `road-ready`, `rr-09-merch`, `rr-09-art`, `rr-09-wire` or `rr-09-neck`. Do not force-push. Do not delete, rename, archive or transfer any file, branch or repo. Do not dispatch any workflow (including `screens.yml`). Do not bump `VERSION` or `CACHE`. Do not deploy, upload to the App Store or TestFlight, or touch Vercel, Cloudflare or any account. If a step seems to need one of these, stop and ask Graham.

## What this is

A follow-up to Road Ready step 09a. Today each Road leg draws its own flat neck between the painted headstock (`-head.webp`) and the painted body (`-body.webp`), and the neck grows by one fret space per stop (`picLayout` and `picBase` in `fretboard.js`, `fretLayout` in `core/game.js`). It never matched the paintings. Graham approved a new design: show the whole painted guitar, drawn at 1.2 times its painted size, and put the stops in its own painted fret spaces, on its own painted strings.

Grok measured all 23 guitars on branch `rr-09-neck`. Read these first, then `CLAUDE.md`:

- `docs/guitars/NECK-DESIGN.md`: the design and the rules. It wins if this prompt and it disagree; say so in the PR.
- `docs/guitars/frets.json`: per guitar (keyed by slug), in painting pixels of the whole painting in `source`: `nut_y`, `join_y`, `frets` (y, seen, centre_x, half_width, six `strings_x`), `spaces` (per fret space: y, height, the `left`, `right` and `box` lanes with their inlay dodge `dx` and `clear`, `pair`, `style`, `inlay`), `badge`, `capacity`, and `example_9` / `example_12` (the stop positions on the check sheets).
- `docs/guitars/frets-check/<slug>.jpg`: the check sheets (9 and 12 stops per guitar).
- `docs/guitars/HANDOFF.md`: the 23 guitars and their final files.

Graham's rules for the art: every guitar keeps its own inlays, inlay materials, nut height, length and fret spacing. No plain-board versions, no repainting, no neck stretch.

## Branch and PR

1. Branch `rr-09-road` from `rr-09-neck` (not from `main`, `next` or `rr-09-wire`).
2. Open one PR from `rr-09-road` into `rr-09-neck`, in the playbook format (`grahamdeno/playbook` `templates/pr.md`). Leave it open.
3. One task per commit. Before every push run `eslint .` and `node tests/quick.mjs`, and report the real results. Don't run the full suite and don't wait on CI. `git pull --rebase` before you push.
4. Never edit Grok's files: the paintings, `frets.json`, `frets-check/`, `NECK-DESIGN.md`, `HANDOFF.md`. Generated files (`art/guitars/*.webp`, `art/guitars/pics.js`) come from the tool, never by hand.

## The work

### 1. pics.py: the road picture and the fret data

In `tools/guitars/pics.py`, for the 23 guitars in `SOURCES` (the ones with `str: 1` in `pics.js`):

- Write `art/guitars/<slug>-road.webp`: the whole guitar, cut out with the same `cutout` and `defringe` as today, painted strings kept, cropped to the guitar with a few pixels of margin. Keep the painting's own pixel size (do not scale it); quality about 88. Aim for about 75 KB each.
- Read `docs/guitars/frets.json` and write a `road` entry per guitar into `pics.js`, in the crop's own pixels (subtract the crop's x0 and y0): the picture's `w` and `h`, `nut`, `join`, and per fret space `y`, `h`, the `left`, `right` and `box` lane x, `clear` per lane, `pair` (ok), `style`, plus per fret row the six string x (for the connector) and the board's right edge (`centre_x + half_width`, for the callout), and the `badge` x and y. Round to one decimal. Keep it small: only what the app uses, spaces 1 to 11 and frets 0 to 12.
- Keep writing `-head`, `-body` and `-small` and every number in `pics.js` the app reads today. The 8 older pictures (parlor ... headliner) are unchanged and get no `road` entry.
- Run `python3 -I tools/guitars/pics.py`. Check every `-road.webp` on dark and light backgrounds at phone resolution (deviceScaleFactor 3): no pink edges.

### 2. fretboard.js: roadLayout and roadBase

- Add `roadLayout(stops, p)` and `roadBase(g, lay, f)` next to `picLayout` and `picBase`. Use them whenever the picture has `p.road` (the 23). Keep `picLayout`, `picBase` and `fretLayout` exactly as they are for the 8 older pictures and the drawn guitars.
- Scale: `S = 1.2` units per painting pixel. Place the picture so the nut's centre is at `CX` (195): screen x = `CX + S * (x - nutCentreX)`, screen y = `top + S * (y - 0)` where `top` is a small margin above the headstock. `lay.height` is the whole guitar plus the margin, and the same for every leg on that guitar whatever its stop count. The body runs off the sides of the Road as it does today, as the body picture does today.
- `roadBase` draws only the `-road.webp` image. No drawn board, frets, side dots, head or hardware: the painting has them all. `stringLayer` draws nothing for road pictures (the strings are painted).
- `lay.spaces` keeps its current shape for road.js (`stop`, `kind`, `y`, `h`, `string`), plus `x` (the lane x in screen units), `lane` (`left`, `right` or `box`), `pair` (0, or 1 and 2 for the two stops of a pair), and `over` (true when the stop uses the over-inlay style). `stopXY(sp, lay)` returns `sp.x` and `sp.y` for road layouts, so the stops, the connector and the callout all agree.

### 3. Placing the stops

Follow `NECK-DESIGN.md` (Layout rules, and More than 9 stops: pairs). In short:

- Stops go one per fret space from the nut, in order. Lessons alternate left lane and right lane; a merch box takes the box lane of its own space. The headline show is not on the neck.
- Each lane's x already includes the inlay dodge (`dx`). If a lane is not `clear`, the stop uses the over-inlay style.
- 9 stops is the default, not a limit. For a leg with N stops on the neck and N > 9, N - 9 spaces take a pair: two lessons in a row (never a merch box), the earlier on the left lane, the later on the right. Pick the pair spaces among the spaces with `pair` ok in spaces 1 to 11, by this order: the leg ends by space 10 if it can; then the fewest stops not clear; then the fewest spaces used; then pairs as high as possible. There are few enough choices to try them all (the build used `itertools.combinations`; in JS a small recursive search is fine).
- If N is more than the guitar's capacity (spaces 1 to 11 plus its pairable spaces, 17 to 19 per guitar, `capacity` in `frets.json`), place the first ones and log a console warning; a test makes sure no leg gets there.
- Your placement must match `example_9` and `example_12` in `frets.json` for every guitar (same spaces and lanes, x and y within 1 unit after scaling). Use them as test fixtures.

### 4. The headline badge, the callout and the over-inlay style

- The headline show is a pill badge, 150 by 42 units, at the guitar's `badge` spot on the body. Draw it with the existing headline states (locked matte, next lit with the glow, done amber with a check) and the `--rr-*` colours. Its button is the badge plus 8 units all round. It keeps today's `data-stop`, `data-kind="double"` and label, so road.js handles it unchanged.
- The current stop's callout (`rr-callout` in `rrStopHTML`) sits just off the right edge of the board at that stop's row (the board's right edge plus 10 units), never over the strings, with the rest of the screen as its max width. The songs chip on stops ahead sits off the left edge of the board the same way.
- Over-inlay style: the same pearl, sizes and colours (`RR_SIZE`), with a dark rim behind it (about 2 units, `#14100d` at 70 percent) and a soft shadow, so it reads over pearl, abalone, blocks and vines. Add it as a class (for example `rr-over`) in `styles.css`. The current stop's lit trapezoid is unchanged.
- Light and Dark: the painting is the same in both. Only the stops, connector, callout, chip and badge take the look's colours.

### 5. Tap areas

- Each stop's button covers its whole fret row: the full width of the Road and the full height of its fret space, so the rows touch. The pearl art stays its current size in the middle of the lane. For a pair, split the row at the midpoint between the two stops' x; each half is its stop's button (at least 44 units wide).
- Keep every label, `data-stop`, `data-kind`, `data-n` and the double-tap behaviour as they are. Keyboard focus order is the stop order.

### 6. connectorSVG along the painted strings

- For road layouts, the amber line follows the painted strings: within a space along the stop's string, then the existing cubic bend onto the next stop's string between spaces, using the per-fret string x from `pics.js` so it lies on the paint. Between the two stops of a pair, a short straight line across the space. Keep the `o.fresh` draw-on and the glow.

### 7. guitarSVG, the new-guitar sheet

- For a road picture, `guitarSVG(id, { full })` shows the whole `-road.webp` (with its painted neck, nothing drawn), scaled to fit the sheet. `full` makes no difference for road pictures, since the painting is already in proportion. The 8 older pictures and the drawn guitars keep today's code.

### 8. Legs (optional)

Leg regrouping is optional now. Every leg today fits with pairing: Open chords has 9 stops on the neck, Chord switches 10 (one pair), Scales 6. Keep the lesson counts in `core/neck.js` and `roadPath` in `core/game.js` as they are, unless a leg would exceed its guitar's capacity. If you think a regroup is still worth it, propose it under "Decisions for Graham" in the PR and don't do it. The earlier proposal, for reference: Chord switches' last lesson moves to the start of Strumming, and Scales gains 2 (propose which).

### 9. sw.js

- Add every `art/guitars/<slug>-road.webp` to `SHELL` in `sw.js` (about 1.7 MB for all 23; no version bump). Keep the old files in `SHELL` for now. Say the added size in the PR.

### 10. Tests and docs

In `tests/core.test.mjs`:

- Every name with `str: 1` in `pics.js` has a `road` entry and a `-road.webp`, and the file is in `SHELL`.
- For every guitar, your stop placement for the `example_9` and `example_12` stop kinds matches `frets.json` (spaces, lanes, and x, y within 1 unit).
- A leg's `lay.height` is the same for 5, 9 and 12 stops on the same guitar.
- A pair's two stops are consecutive lessons, earlier one on the left, never a merch box.
- Every tap row is at least 26 units tall, rows touch with no gap, and each half of a pair is at least 44 units wide.
- Every leg in `core/neck.js`, through `roadPath`, fits its guitar's capacity.
- The 8 older pictures still lay out with `picLayout` exactly as before (keep the existing tests, around lines 1727 and 1738, unchanged and passing).

Docs: update the guitar pictures row in `CLAUDE.md` (roadLayout and roadBase, frets data in `pics.js`), the README feature list if it describes the neck, and add a short note under the step 09 sub-plan in `docs/ROAD-READY-PLAN.md`. Take Road screenshots at deviceScaleFactor 3 of a 9 stop leg (Open chords on Porch), the 10 stop leg (Chord switches on Cornerstone), and a busy inlay guitar (Velvet Crown or Walnut Hall) chosen from the shop, in Light and Dark, and attach them to the PR.

If something in the code or the plan doesn't match this prompt, stop that task and write it under "Surprises" in `docs/ROAD-READY-PLAN.md`.

## How to write

Plain words for Graham. No em dashes anywhere Graham reads (PR, commits, docs, on-screen text). Never print or commit secrets.

## When you're done

Post the PR link, the `eslint .` and `node tests/quick.mjs` results, the screenshots, the decisions for Graham, and any surprises. Do not merge; Louie Review reviews on Graham's go.
