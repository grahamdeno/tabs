# The fretboard Road (4.82.0)

Written by Opus, 2026-10-29, for Sonnet to run. One minor release, 4.82.0 (Graham prefers one big release).
Graham approved the mockups and said ship it.

The mockups are on the canvas "The Road: Fretboard Path":
https://claude.ai/artifact/CizK3qguY1kESpwVAkS6QR
Read the artboards with the Artifact tool (`action: "read"`, `path: "project/Main.dc.html"`, then
`Light`, `Headline`, `Changeover`, `Lineup`). They hold the exact SVG: geometry, colours, layer order. Copy from
them; don't redraw from this text.

## What changes

The path of picks on the Road becomes a guitar neck, one guitar per leg.

- **Nut at the top, progress goes down the neck**, the same direction as today's path and as a chord diagram.
- **Lessons are finger dots.** One fret space per lesson, the dot sitting on a string just behind the fret,
  alternating between the 2nd and 5th strings (the zigzag). Done: the look's accent with a check. Next: bigger,
  in the streak colour, with the halo and the stop's icon. Locked: the locked grey with a small dot.
- **Milestones are fret inlays.** A merch box is a single inlay in its own fret space, centred. Reached but
  shut: an empty routed pocket with a dashed gold ring and the "Tap to open" tag. Tapped open: the pearl sets
  in. Not reached: an empty pocket, no ring.
- **The headline show is the double inlay** in the last fret space of the leg, then the guitar's body.
  Next: both inlays lit (blaze ring, halo). Done: pearl.
- **Each leg is its own guitar** (the Lineup artboard). The headstock carries the guitar's name. Headlining a
  leg earns the next guitar; the next leg starts with a marker ("Leg 3 · Scales", "New guitar earned") and
  the new headstock.
- **What stays**: the stat bar, the leg banner, the songs chip, Louie's bubble at the top of the path, the
  Songbook bar, the tab bar, tap a stop for its card (`stopCard`), Start, Other songs, `revealPop`, the current
  stop a third of the way down, the merch box POW and fans, the Headliner sheet.

## Decisions (Graham left both to Opus, 2026-10-29)

1. **Leg length.** A leg's neck has exactly as many fret spaces as it has stops (lessons, boxes and the
   headline). No padding to 12. Fret numbers don't match a real neck; the double inlay always marks the
   headline, at the end, next to the body.
2. **The Encore guitar's tail.** The mockup's single point reads as a guitar pick, and the house rule is no
   pick anywhere. Draw the Encore body with a swallowtail instead: two short points with a notch between,
   same horns, violet with gold binding.
3. **Woods don't follow the look.** Each guitar keeps its own woods and finish in every look (the Light
   artboard's maple board was drawn before the guitars existed). Only the finger dots, halo, tags and rings
   take the look's colours (`--accent`, `--accent-deep`, `--streak`, `--streak-deep`, `--locked`,
   `--locked-deep`, `--locked-ic`, `--fans`). Check the neck reads on all four looks.
4. **Opening night keeps its picks** in this release. It is seen once, and its side labels need the width
   a neck takes. It's listed under Open at the end.
5. **Legs not built yet** (Strumming, Picking, Fingerstyle and barre) get their guitars as data only. The
   Encore guitar is data only until every leg exists.

## The guitars (data)

| Leg id | Guitar | Body | Headstock | Board | Inlays |
|---|---|---|---|---|---|
| `open` | The beater | parlor acoustic, worn | 3+3 plain, cream tuners | rosewood | small dots |
| `switch` | The cutaway | cutaway acoustic | 3+3 plain, gold tuners | rosewood | pearl dots |
| `scales` | The solid-body | double-horn electric, black | 3+3 black, "Louie", gold | ebony | blocks |
| `strum` | The hollow-body | wide electric, f-holes | open book, gold diamond | ebony | split blocks |
| `pick` | The single-cut | carved electric, cherry | open book, "Louie", nickel | ebony | trapezoids |
| `finger` | The classical | nylon acoustic, cedar | slotted | rosewood | abalone dots |
| `encore` | The headliner | our own shape, swallowtail | pointed, violet | ebony | gold stars |

Inlay shape follows the guitar for the single inlays; the headline is always two of that guitar's inlay.

## Steps

### Step 1. The guitars and the layout, pure and tested [Sonnet]

- [ ] 1.1 `core/game.js`: `export const GUITARS` keyed by leg id (table above): `name`, `kind`
      (`acoustic` | `electric` | `classical`), `body`, `head`, `board` (hex), `binding` (hex), `finish` (hex),
      `inlay` (`small` | `dot` | `block` | `split` | `trap` | `abalone` | `star`), `tuner` (hex). Hexes from the
      Lineup artboard. `guitarFor(legId)` falls back to `open`.
- [ ] 1.2 `core/game.js`: `fretLayout(stops)`: for a leg's stops, the fret spaces top to bottom. Spacing starts
      at 66 px and narrows 66, 62, 59, 56, 53, 50, then stays at 48 (never below: a 44 px tap target fits). For
      each stop: `y` (centre of its space), `kind` placed as `dot` (lesson), `inlay` (box) or `double`
      (headline), `string` for a dot (1 then 4, alternating, 0-based from the low E), and the leg's total
      height including the headstock (above) and the body (below). No DOM.
- [ ] 1.3 Re-export both from `core.js` (import and export lists).
- [ ] 1.4 Unit tests in `tests/core.test.mjs`: spacing narrows and floors at 48; dots alternate strings; a box
      is an inlay, the headline a double and always last; heights add up; an unknown leg gets the beater.

### Step 2. Draw the neck [Sonnet]

New file `fretboard.js` at the root; add it to `SHELL` in `sw.js`.

- [ ] 2.1 `neckSVG(leg, guitar, layout)`: one SVG per leg, 390 wide, the neck centred (board 212 px, binding
      4 px each side, strings at centre -90, -54, -18, 18, 54, 90). Layer order as the Main artboard: headstock
      with the guitar's name, board, binding with side dots at inlays, halo, inlays, nut, frets (three bands:
      body, light top, dark lip), string shadows (dark, 3 px right), strings (wound in bronze or nickel by
      `kind`, plain in steel; nylon for `classical`), then the body at the bottom (Headline and Changeover
      artboards for the acoustic; Lineup for the others, scaled to 390 wide).
- [ ] 2.2 The stops are not drawn in the SVG. Each stop is a real `<button class="rd-node <kind> <state>"
      data-stop>` positioned over it, keeping today's classes, `aria-label`s and `.rd-stop` wrapper, so
      `stopCard`, the click handler and the tests keep working. The button draws the dot or the inlay inside
      itself (small inline SVG), at least 48 px square.
- [ ] 2.3 Inlay states: pocket (not reached), pocket plus dashed ring (reached, shut: the box's `now`), set
      (opened or done), lit (the headline's `now`).
- [ ] 2.4 Body drawings: one function per `body`, flat shapes only, our own proportions (the Lineup
      artboard). No famous outline traced.

### Step 3. The Road uses it [Sonnet]

In `road.js`:

- [ ] 3.1 Replace `legsHTML` with one block per leg: the leg marker, then `neckSVG` with its stop buttons
      over it. The marker is today's `.rd-legmark` text ("Leg 2 · Chord switches"); after a done leg add the
      chip "New guitar earned" and, on the done leg's body, "<guitar name> · headlined".
- [ ] 3.2 The tag (`.rd-tag`) on the next stop sits in the margin beside it: right margin when the dot is on
      the 5th string, left margin otherwise; inlays take the left margin. Same text as today (`tagOf`).
- [ ] 3.3 Box opening (`openCase`): the pearl drops into the pocket (scale from 1.3 to 1 with a short settle),
      then the same POW callout and re-render. Reduced motion: no scale.
- [ ] 3.4 The halo pulse moves to the finger dot (the `rd-halo` keyframes); drop the wiggle on the neck.
- [ ] 3.5 Remove `ticketSVG`, `TICKET`, `CASE_SHUT`, `CASE_OPEN` and `ZIG` uses from the Road path.
      `pickSVG` stays for Opening night only.
- [ ] 3.6 A new guitar, said once: the first Road shown after a leg's headline is done shows a sheet like
      `headlinerEarned` (Louie cheering, the new guitar's headstock and body, "New guitar: The solid-body",
      Rock on). Stored as `data.guitars = { seen: [legId] }`. If the Headliner sheet is up, wait for the next
      Road. Add the field to docs/DATA.md and to the backup if backups list fields.

### Step 4. Looks [Sonnet]

- [ ] 4.1 The `rd-` neck styles in the "Version 4 look" section of `styles.css`, using the tokens in
      decision 3. Remove the pick, ticket and case styles that nothing uses now (Opening night still uses the
      pick ones).
- [ ] 4.2 Check all four looks on a phone screenshot each (throwaway `tests/e2e/zz_*.e2e.mjs`, delete after).
      Text on tags at 4.5:1.

### Step 5. Tests [Sonnet]

- [ ] 5.1 Update `tests/e2e/app3.e2e.mjs` (the box at 336-346, the path at 358-378, 533-536) and
      `tests/e2e/app.e2e.mjs` line 18: picks become finger dots, `.rd-case` becomes the inlay, the ticket becomes
      the double inlay. Keep what each test proves.
- [ ] 5.2 New: one neck per leg with its guitar's name; one tag; a box opens and its inlay is set; the
      headline is a double inlay; the new-guitar sheet shows once.
- [ ] 5.3 `eslint .` and `node tests/quick.mjs`. The a11y test must pass in CI (every stop a labelled button).

### Step 6. Release [Sonnet]

- [x] 6.1 `VERSION` 4.82.0 in `core.js` and `CACHE` in `sw.js`.
- [x] 6.2 README: the Road's feature text. docs/ONBOARDING.md: the rows that say "glowing pick" and "road
      case" (first launch, reach a merch box). CLAUDE.md: add `fretboard.js` to Where things are; in Version 4,
      say the stops are finger dots and inlays on a guitar per leg, picks only in Opening night.
- [x] 6.3 One commit per step, plain messages. Rebase on `origin/main`, push to `main`.
- [x] 6.4 Tell Graham it's live, and that the next step is Opus.

### Step 7. Feel check [Opus]

- [x] 7.1 Screenshots of the Road in Dark and Light, mid-leg and at a headline, next to the canvas. Judge
      spacing, the tag placement and the inlay states; list fixes for a 4.82.x patch if any.

Done by Opus, 2026-10-29. The neck reads as the canvas did: tags sit in the margins, the shut box's dashed ring
and "Tap to open" work, the double inlay and the body close each leg, "New guitar earned", the headstock name and
"The beater · headlined" land where planned, and the New guitar sheet shows once. Fixes for 4.82.2 (4.82.1 went out first with the hearing fix, 2026-10-29):

- [x] 7.2 [Sonnet] Locked dots disappear in the dark looks: violet on rosewood. On the neck, give locked dots a
      lighter fill (a pale grey with the darker lip) in Dark and Headliner, as Light already has.
- [x] 7.3 [Sonnet] The beater's small inlays are too small next to the canvas (the pocket and the pearl read as
      specks). Bring `small` up to about 80% of the `dot` inlay.
- [x] 7.4 [Sonnet] On a leg's first stops the headstock scrolls off and only the tuner tips peek under the songs
      chip. When the current stop is in the first three spaces, scroll so the headstock and its name show.
- [x] 7.5 [Sonnet] Strings run past the bridge to the edge of the acoustic body. End them at the bridge.
- [x] 7.6 [Sonnet] An "open" stop (reachable while a shut box is the next stop) looks nearly like a done dot:
      same fill, icon instead of check. Give it the accent as a ring on the board colour instead.
- [x] 7.7 [Sonnet] Tuner buttons float beside the headstock. Add a short post to each (small, cosmetic).
- [ ] 7.8 Patch 4.82.2 built and committed; goes out with 4.83.0 when Graham says ship.

## Open (not this release)

- Opening night on a short neck of its own (the beater), with its labels moved into the cards.
- Earned guitars on the Merch table as a choice of neck.
- The Encore guitar once every leg exists.

## After the fret plan: Graham's gig screenshots (2026-10-29)

From a night of play-alongs in Neon. Do these after Step 7's patch, as one release when Graham says.

- [ ] 8.1 [Sonnet] The Gig: the crowd row draws on top of the words. The line under it can't be read and its
      chords are hidden. The crowd needs its own band (or to sit behind the words, faded), never over a line.
- [ ] 8.2 [Sonnet] The Gig: a ghost copy of the section name ("CHORUS") shows behind the section chip at the top.
- [ ] 8.3 [Opus] The Gig: a chord-only line with a note ("Dm C-G F (hold)") shows as the lit line in plain text,
      like a lyric. Decide how instruction lines show in the Gig (chords on their beat, the note small).
- [ ] 8.4 [Sonnet] The Gig: the bottom half of the screen was empty under the last lines. Check whether that was
      the song's end; if not, the words should fill the screen (the Gig is words first).
- [ ] 8.5 [Sonnet] After the show: the Missed most card is cut off at the bottom of the screen (all three shots).
- [ ] 8.6 [Sonnet] After the show: the Chords tile is white on yellow, which fails contrast. Use the dark ink the
      Fans tile uses.
- [ ] 8.7 [Sonnet] After the show: "INTERLUDE" touches the edges of its chip and "INTERLUDE 2" wraps. Let the
      chip size to its text, or shrink the text for long names.
- [ ] 8.8 [Opus] The Road didn't move after 4+ songs. Working as built: a chord stop is done by its lesson or by
      playing 5 songs with that chord through to the end (counted from the sheet, not from the mic), and the
      headline by playing a song that uses only the leg's chords. Nothing says so. Proposal for Graham: the
      stop's card shows "Play it in 3 more songs" and the songs that have it, and the Gig's results say when a
      song moved you along the Road.

## Hearing (a separate conversation)

Graham is already talking about how well the Gig hears chords in another conversation. The results screens
from tonight are in `docs/hearing/` (no lyrics). What they show: two plays of Lillian scored 28/65 with the
same chords marked heard both times (FM7, Dm, C) and the same ones never heard (Am, F, G, G/B), though the fans
and crowd differed; the Em C G D song missed G most ("C to G, 6 times"). Either the listening misses the
same chords every time or the marks don't come from that play. That conversation owns it.

Found (2026-10-29): the marks were from each play. The rule since 4.80.3 counted a chord only when no other chord of
the song sounded as much like it. Am and F sit inside FM7 (it has all their notes), and G and G/B are the same notes,
so those four tied every time and could never be caught; FM7, Dm and C could. Shipped in 4.82.1: chords are judged on the notes that tell them apart (`chordLead` in `core/neck.js`); a chord
inside another wins unless the bigger chord's extra notes carry `CHORD_EXTRA` (0.12) of the sound; same-note chords
are one sound. Clean chords: 634 pairs uncatchable and 163 wrong catches before, none after (164 chords). Graham's
recordings with FM7, Cmaj7 and G/B in the song: 34 of 360 changes right before, 356 after. Still open: Em C G D
missed G mostly after C, a separate cause; it needs a What I hear reading with G picked.

## Surprises

(Write here when something doesn't match the plan.)
