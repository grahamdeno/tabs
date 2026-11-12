# Readability release (4.89.0, with the Louie: Learn Guitar rename)

Graham, 2026-11-11: a simulation over every page, sheet, toast, tip and callout in all four looks (Light,
Dark, Green Room, Headliner), plus song screens on a song with album art, found text that is too small,
faded, cut off, or sitting on a see-through card. This plan fixes it in one release, shipped with the rename
on the `rename-louie` branch. Nothing ships until Graham says ship.

## Rules (step 1 sets them; every later step follows them)

1. **Nothing that floats is see-through.** Sheets, pop-ups, toasts, tips, the Tune up card and the Gig's NOW
   card use a solid surface (`--solid`, or `--card` outside album art) in every look, including the album-art
   look (`body.covered`), where `--card` is 10% white on purpose for cards that sit on the page.
2. **One floating sheet at a time.** A sheet that opens on its own (Tune up) waits until nothing else is open
   and never shows in Edit; it goes in `layer` like every other sheet, with the page dimmed behind it.
3. **12 px is the smallest text.** Small caps labels are 12 px with `letter-spacing: .08em`; helper lines
   under a row are 13 px. Where an icon already says it, drop the label rather than shrink it.
4. **Locked or not yet is shown, not faded.** Text stays full strength; a lock icon or a dashed border says
   it is locked. Disabled buttons keep readable text on a muted fill (no `opacity` on text).
5. **Wrap, don't cut.** Descriptions wrap to two lines; badges sit under a name, not over it.
6. **Light looks: dark ink on bright colour.** In Light and Green Room, text on a bright chip or card uses
   the dark ink (`--fg` or the chip's own deep shade), never white; callouts use dark text with a coloured
   outline.
7. **Contrast:** 4.5:1 for text under 24 px (18.66 px bold), 3:1 above, measured against what is really
   behind it.

## Steps

1. [Opus] (done, f2b8c8c) Rules into code: solid floating surfaces in every look and on album art; the Tune up card becomes a
   one-at-a-time sheet in `layer` (dimmed page, not in Edit, not over another sheet), with plain changes
   ("18° colder", "89% → 84%, yesterday"); the POW callouts readable in Light and Green Room; the Gig's
   NOW card solid on album art. Tests for each.
2. [Sonnet] The 12 px floor and 13 px helper lines, by selector, from the scan: Your profile badges and stat
   labels, the Gig's NOW card and "Tap to score it", the Band tab's song counts, Charts' BATTLE and today
   lines, the Tour Map's avatars, What I hear's readouts and legend, About this song's labels, Songbook's
   Requested banner and key badges, the stat bar labels, Settings' Keys dots and "Last backup", Merch card
   lines, Tour progress lines, Rehearse's "Not tried yet" and skill lines, the Look page's theme picker.
3. [Sonnet] Locked and disabled without fading: All lessons' locked cells and Coming cards (lock icon,
   full-strength text), the merch "more in tips to go" button, the disabled Save and "Pick a chord".
4. [Sonnet] Wrap instead of cut: Tools row descriptions, Charts names (BATTLE under the name), the lesson
   strips (wrap to rows), Your profile's "Nights · next 7".
5. [Sonnet] Toasts: full width at the bottom, above the bar, in thumb reach, one or two lines.
6. [Sonnet] The rest of the list: the Gig in Light and Green Room (current line's chord letters in
   `--accent-ink`, the sung line at least `--fg-2`, the crowd darker); Show complete's title in Green Room;
   the streak celebration (dark ink and stronger day dots in Light, the number in Headliner); the chord
   pop-up's finger numbers (bigger) and place (top, off the lyrics); the paste card (no fade on the
   preview, dark chips in Light); the tuner with the mic off (one full-width message); the language
   chips DE, ES, RU (dark ink); gold prices on white in Light (dark ink); the CROWD tile label.
7. [Sonnet] A readability test: the scan from the simulation as `tests/e2e/readable.e2e.mjs` over the main
   screens and pop-ups in Light and Dark and on album art; fails on text under 12 px, contrast under the rule
   on a solid background, or a see-through floating surface.
8. [Opus] Run the full simulation again, look at every screen, fix what's left, then Graham says ship.

## Surprises

(none yet)
