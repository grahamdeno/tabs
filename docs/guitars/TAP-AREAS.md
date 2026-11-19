# Tap areas for the Road stops

Road Ready 9a, neck follow-up. Graham approved this on 2026-11-18. This note replaces the "Tap areas" section of `NECK-DESIGN.md` and section 5 of `claude-neck-prompt.md`. If they disagree, this file wins.

The painted pearl stays its current size. The tap areas themselves stay invisible.

## Hit testing

One invisible hit layer covers the neck. A pointer tap goes to the nearest stop, measured as the distance to that stop's x, y. The headline badge is a special case: use its badge rect plus 8 units all round, not the nearest-stop distance.

## Priority for the current stop

You only ever play one stop at a time: the current one (the one you can play next), or one you have already finished.

- The current stop gets a priority tap zone at least 64 units tall (its y, plus and minus 32) and the full width of the Road, centred on it. A tap inside that zone always hits the current stop, even if a neighbour is closer.
- Finished stops use the nearest-stop rule.
- Locked stops ahead are not playable. A tap on one does what it does today (shows the locked hint). A tap inside the current stop's priority zone never goes to a locked stop, or to any other stop.

This removes the old risk of 28 to 34 unit rows at frets 9 to 11. Those painted fret spaces stay short, but the current stop's invisible zone is at least 64 units tall, which is above Apple's 44 unit guideline.

## Pairs

When two lessons share a fret space, the nearest-stop rule splits the tap between them: a tap goes to whichever of the pair is closer. If one of the pair is the current stop, that one still gets its priority zone, so a tap inside that zone hits the current stop, not its partner.

## Accessibility

Every stop keeps a real button with its label, `data-stop`, `data-kind`, `data-n`, double-tap behaviour and focus order. The visible-size buttons can be small, because VoiceOver uses the labels. A pointer tap must go through the hit layer, not those small buttons.

## Tests

These tests replace the old tap-row tests (rows at least 26 units tall, rows that touch, and pair halves at least 44 units wide).

For every guitar, using the `example_9` and `example_12` layouts from `frets.json`:

- Take each stop in turn as the current stop. A tap anywhere within 32 units of that stop's y, across the full width of the Road, hits the current stop.
- A tap at each stop's centre hits that stop.
- No tap inside the current stop's priority zone hits another stop.
