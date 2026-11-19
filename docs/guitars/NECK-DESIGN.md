# The Road necks: stops on the painted guitar

Road Ready 9a, neck follow-up. Graham approved this design on 2026-11-18. The code work is in `claude-neck-prompt.md` (same folder).

## What changes and why

Today the Road draws a flat neck of its own between the painted headstock and the painted body. It never matched the art, and it grew longer with every stop. Now each leg shows the whole painted guitar, and the stops sit in the guitar's own painted fret spaces, on its own painted strings. Nothing is repainted.

- The whole guitar is drawn at 1.2 times its painted size. There is no neck stretch.
- Every guitar keeps its own look: custom inlays and inlay materials, nut height, neck length and fret spacing. There is no house standard for the paintings, and there are no plain-board versions.
- The neck no longer grows with the number of stops. A leg with more stops pairs some of them (see below).

## The files

- `frets.json`: the measurements for all 23 guitars, keyed by slug (`porch`, `koaarc`, ...). Made by measuring each painting, then checked by eye on the sheets below.
- `frets-check/<slug>.jpg`: one check sheet per guitar. The left panel is a 9 stop leg, the right panel is a 12 stop leg. Green lines are frets found in the painting, orange lines are frets placed by spacing where the painting has no clean line, blue lines are the six strings, pink boxes are inlays, gold circles are lessons, white boxes are merch boxes, and the gold pill is the headline badge.

### frets.json, field by field

All numbers are pixels in the whole painting named in `source` (768 by 1376, the final file listed in `HANDOFF.md`, `-v2` where there is one). On the Road, 1 painting pixel is 1.2 units, and the screen is 390 units wide.

- `source`, `image`: the painting and its size.
- `nut_y`: the row of the nut. `join_y`: the row where the neck meets the body.
- `frets`: entry 0 is the nut, then fret 1, 2 and on. Each has `y`, `seen` (true if the fret line was found in the painting, false if placed by the spacing of its neighbours), `over_body` (past the neck join), `centre_x` and `half_width` (the neck at that row), and `strings_x` (the six strings, low E first).
- `spaces`: one per fret space, from the nut down (space 1 is between the nut and fret 1).
  - `y` is the middle of the space, `height_px` and `height_units` its height, `r_px` the radius of a lesson stop in painting pixels.
  - `left`: the lesson lane on the A string (`strings_x` index 1). `right`: the lesson lane on the B string (index 4). `box`: the merch box lane in the middle. Each lane has its `x`, the `dx` it was moved by to stay clear of an inlay, and `clear` (true if the stop does not cover an inlay).
  - `pair`: `ok` if two lessons fit side by side in this space with tap areas at least 44 units wide and the space at least 36 units tall, and the two x positions.
  - `style`: `plain`, or `over-inlay` where some lane can't avoid an inlay (see Inlays below).
  - `inlay`: `kind` (`none`, `dot`, `double-dot`, `block`, `pattern`, `shape`), `cover` (share of the space it covers), and `boxes` (each inlay piece as x0, y0, x1, y1).
- `badge`: where the headline badge goes on the body: centre `x`, `y`, its size in units (150 by 42), and `below_bridge_y` (the badge is always below this row).
- `capacity`: the most stops this neck can hold (spaces 1 to 11, plus the spaces that can take a pair).
- `example_9`, `example_12`: the stop positions drawn on the check sheets, made with the rules below. The app computes its own from the same rules; these are for testing that it matches.

## Layout rules

1. Stops go down the neck from the nut, one fret space each, in lesson order. Lesson 1 is in space 1.
2. Lessons alternate between the left lane and the right lane, so the line between them zigzags along the strings like a picking pattern. A merch box sits in the middle lane of its own space.
3. The headline show is not on the neck. It is a badge on the body (see Badge).
4. If a lane would cover an inlay, the stop moves sideways along the fret space (the `dx` in the lanes) to the nearest clear spot that keeps it on the board. If there is no clear spot, it stays on its lane and uses the over-inlay style.
5. Nine stops is the default: 9 stops fill spaces 1 to 9, which on every guitar stays at least 30 units tall.

### More than 9 stops: pairs

Nine is the default, not a limit. When a leg has more than 9 stops on the neck, some spaces hold two lessons side by side, one on the left lane and one on the right, like a two finger chord shape.

- Only two lessons in a row can pair, never a merch box. In a pair the earlier lesson is on the left and the later one on the right, so it reads left to right, then down, like text.
- Pairs go on the tall upper spaces, where `pair.ok` is true (spaces 1 to 4 on every guitar, and on most guitars 1 to 7 or 8).
- Which spaces pair is chosen in this order: first keep the leg within 10 spaces, then keep as many stops as possible clear of inlays and use as few spaces as possible, then put pairs as high on the neck as possible.
- A 12 stop leg needs 3 pairs and uses 9 spaces on most guitars, 10 on the rest.
- Each guitar's `capacity.max_stops` is 17 to 19. No leg today comes close: Open chords has 9 stops on the neck, Chord switches 10, Scales 6.
- If a leg ever has more than its guitar's `capacity.max_stops`, regroup the leg. Until then, keep the lesson counts as they are.

### The line between stops

The amber connector follows the painted strings. Within a space it runs along the stop's string, and between spaces it bends onto the next stop's string with the same curve as today. Between the two stops of a pair it is a short straight line across the space.

## Inlays

The fancy inlays stay. Where a stop can't avoid one, it uses the over-inlay style:

- The pearl keeps its size and colours, with a dark rim behind it (about 2 units, the board's own dark at 70 percent) and a soft dark shadow, so it reads over pearl, abalone, blocks and vines.
- The current stop's lit trapezoid and glow are unchanged. They already read over anything.

Guitars where some stops need the over-inlay style (from the check sheets):

- Velvet Crown: full width blocks at spaces 1, 3, 5, 7 and 9.
- Redwood Hollow: blocks at 3, 5, 7 and 9.
- Razorwing: shark fins at 1, 3, 5 and 7.
- Walnut Hall: a vine through spaces 3 to 9.
- Islander: shapes at 3, 4, 6 and 8.
- Ziricote Grand: one stop at space 2.
- On 12 stop legs, a pair can land on a dot at space 3 or 4 on Koa Arc, Comet, Sticker Riot, Tartan Pin and Barebones.

The other guitars keep every stop clear.

## Badge

The headline show is a pill badge, 150 by 42 units, on the guitar's body below the bridge, centred on the line of the neck. It shows the leg's headline show in the usual states: locked (matte), next (lit, with the glow), and done (amber with a check). `frets.json` has its spot for every guitar, found as the least busy place on the lower body that is fully on the guitar.

## Callout

The callout for the current stop sits just off the right edge of the board at that fret (the neck's `centre_x + half_width`, plus 10 units), never over the strings. The songs chip on the stops ahead goes off the left edge the same way.

## Tap areas

- Each stop's button covers its whole fret row: the full width of the Road, from the fret above to the fret below. The rows touch, so there is no dead space between stops.
- In a pair, the row is split at the midpoint between the two stops, so each gets its own half (at least 44 units wide).
- Spaces 9 to 11 are 28 to 34 units tall, under the usual 44. That is the trade for not growing the neck. The rows are full width and touch each other, which keeps them easy to hit; tests check no row is under 26 units.
- The headline badge's button is the badge plus 8 units all round.

## Light and Dark

The paintings stay the same in both looks, as the wood and finish always have. Only the stops, the connector, the callout, the chip and the badge take the look's `--rr-*` colours. The over-inlay rim is the board's dark in both looks.

## Size

- Scale: 1.2 units per painting pixel. The body is wider than the 390 unit screen, so the bouts run off the sides of the Road as they do today. A leg is up to about 1650 units tall, the same for every leg on a guitar, whatever its stop count.
- Pictures: a new `art/guitars/<slug>-road.webp` per guitar: the whole cut-out guitar with its painted strings, about 75 KB each, about 1.7 MB for all 23.
- Keep the old `-head`, `-body` and `-small` files for now. `-small` still serves the guitarist, the guitar case and Show complete. `-head` and `-body` can go in a later step, once nothing uses them.

## Things measured with care

- Koa Arc: the nut sits at row 250. Its first fret space is a little short, as painted.
- Ziricote Grand: the painted frets are unevenly spaced (fret 5 is close to fret 4). The measured rows follow the painting.
- Every fret from 1 to 16 in `frets.json` was found in the painting. The few orange frets on the sheets (placed by spacing) are past fret 16, out on the body, where no stop goes.
- Some paintings have their own inlay quirks: Ghost Spalt, Nova, Spray Can Crack and Flyer Wall put the double dot one space early (space 11), Ghost Spalt has its dots on the even spaces, Highline has a single dot at 11, and Ziricote Grand has dots at 2, 3, 7 and 9. They are kept as painted; the lanes avoid them all the same.
- Badges on Sticker Riot and Arrowhead sit close to the hardware (the coffin body narrows, and the tailpiece is low). Check them on the phone.
