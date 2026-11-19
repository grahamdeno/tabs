# Design audit: the whole app against Road Ready (Grok, 2026-11-19)

Measured against the round 10 concepts and `docs/road-ready/louie-design-spec.md`, on a 390 by 844 phone in Dark and Light,
from `next` at 4.99.1. Each before picture is Dark on the left and Light on the right (`before/<screen>.jpg`). Graham's standing
decisions win over the spec: fans and streak stay on the Road, Louie is not on the Road, the playing screen has Pause only, XP,
Rain check, Double set and quests stay (restyled), Louie is black by default, plain words.

## What is off everywhere

| What's off | Rule that fixes it |
|---|---|
| Chunky buttons on a darker lip and a gloss stripe (`.btn.primary::before`, `.cmd`, `.float`, Pause, the Listen button) | Spec 5.6: a cream plate or a quiet capsule, pressed moves 1 pt, no lip, no gloss. New tokens `--rr-lift` (raised shadow) and `--rr-press`; the lip and stripe go in Light and Dark |
| The old stat bar (coloured badge, guitar, ticket, coin with VENUE, STREAK, FANS, TIPS labels) on Rehearse, Tour and Charts | The one-row header from the Road (`rrStats()`), so every page that shows stats shows them the same quiet way |
| Candy banners: cyan Garage Chart, lime Your band, orange Request line, pink gift boxes, pink chord stamps, pink NEW chord tiles, the bunting on the Merch table | Tolex cards (`--rr-card`, `--tolex-card`), one cream engraved plate per screen for the title, amber only for the one thing to do (`--rr-amber`, `--rr-amber-text` on cream) |
| Progress bars of mixed heights and colours | Spec 5.4 and 6: a 4 pt hairline track in `--rr-hairline` with an amber fill, radius `--r-chip` |
| One-off radii (6, 8, 14, 20 px) next to the 10, 12, 16, 18, 24 scale | `--r-control`, `--r-plate`, `--r-card`, `--r-strip`, `--r-sheet` |
| Motion timings scattered (0.2, 0.3, 0.42, 0.4 s) | `--rr-motion: .25s ease-out` for show and hide, Reduce Motion keeps a plain fade |

## Screen by screen

| Screen | Before | What's off | Fix |
|---|---|---|---|
| Opening night | [opening](before/opening.jpg) | Header strip 167 pt with a two-line title, Skip plate and Fans pill; Louie's bubble under it; the neck starts at 296 pt | One-row header, Opening night line with a text Skip, no bubble (done in this branch, item 1) |
| Opening night end | [opening-end](before/opening-end.jpg) | Locked peek is right, but it sits under the guitar body art with no gap | Keep the peek, 60 to 80 pt of air above it |
| Gig poster maker | [maker](before/maker.jpg) | Good. The TONIGHT poster and options are in place | Leave; only the plate button and capsule rules apply |
| Road, Leg 1 | [leg1](before/leg1.jpg) | Same crowding as Opening night; Tonight a bar in the header | One-row header, Tonight on the current stop, venue sign at the start of the leg (item 1) |
| Road, end of leg | [leg1-end](before/leg1-end.jpg) | Locked next leg reads well | Leave |
| Stop card | [stopcard](before/stopcard.jpg) | Cream card with an amber START slab and a pink "+5 fans" chip | The card keeps the plate; the chip becomes a quiet capsule |
| New guitar (headline) | [newguitar](before/newguitar.jpg) | Close to the concept; the header strip shows through at the top | Header goes with item 1 |
| Song page | [song](before/song.jpg) | Pink NEW chord tiles and a pink outline; "Mark as learning" chip with a heavy border | Chord tiles on the card colour with an amber NEW plate; chips are capsules |
| Playing | [playing](before/playing.jpg) | Words 16.7 px; Pause and Listen sit on a darker lip | Bigger lines without reflow (item 4); flat amber Pause, quiet Listen |
| Songbook | [songbook](before/songbook.jpg) | Close to r10-05 | Leave; capsule rules |
| Search | [search](before/search.jpg) | Fine | Leave |
| Rehearse | [rehearse](before/rehearse.jpg) | Old stat bar on top; Louie's card OK | One-row header |
| Rehearse, bottom | [rehearse-end](before/rehearse-end.jpg) | Content ran under the tab bar with no band on next | Band under the tab bar (item 2) |
| A drill | [drill](before/drill.jpg) | Fine; the "I can't hear it" link is small | Leave |
| Tour | [tour](before/tour.jpg) | Old stat bar; navy goal card; orange Request card; pink gift icons; mixed bars | One-row header, tolex cards, line gift icon in amber, hairline bars |
| Tour Map | [playmap](before/playmap.jpg) | The map is its own world; the bottom sheet is fine | Leave |
| Charts | [charts](before/charts.jpg) | Old stat bar; cyan banner; green "+10 today" text | One-row header, tolex card with a cream plate title, gains in `--rr-text-2` |
| Your band | [band](before/band.jpg) | Lime banner; dashed empty slots | Tolex card banner; empty slots as engraved outlines |
| Me | [me](before/me.jpg) | Case was flat CSS; milestone badges as cream bricks | Painted velvet case (item 3); milestones as engraved plates |
| Me, bottom | [me-end](before/me-end.jpg) | Hot pink chord stamps | Stamps in amber on the card |
| Tuner | [tuner](before/tuner.jpg) | Fine | Leave |
| Merch table | [merch](before/merch.jpg) | Bunting, a coloured shirt line and a speech bubble at the top; cards with mixed borders | A plain title row, the tips as a quiet capsule, cards on `--tolex-card` |
| Guitar builder | [builder](before/builder.jpg) | Close to r10-19 | Leave |
| Support Louie | [support](before/support.jpg) | Fine | Leave |
| Settings and its pages | [settings](before/settings.jpg), [apple](before/set-apple.jpg), [help](before/set-help.jpg), [keys](before/set-keys.jpg), [lang](before/set-lang.jpg), [library](before/set-library.jpg), [look](before/set-look.jpg), [newsongs](before/set-newsongs.jpg), [playing](before/set-playing.jpg), [today](before/set-today.jpg), [youtube](before/set-youtube.jpg) | Mostly right. Back up now and Save key sit on the gloss stripe | Gloss and lip rule |
| Toasts | n/a | A cream slab in Space Grotesk 600 | Keep, with `--rr-lift` |

## Order of work

1. Items 1 to 4 of the brief (header, tab bar band, case, review fixes).
2. The shared rules above, once, in `styles.css`.
3. Screen by screen, one commit each: Rehearse, Tour, Charts, Band, Me, Song page, Merch, playing controls.

## Before and after

Every screen, before on the left and after on the right: [Dark](before-after-dark.jpg), [Light](before-after-light.jpg).
