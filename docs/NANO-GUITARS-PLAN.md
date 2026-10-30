# The Nano guitars (4.86.0)

Written by Opus, 2026-10-30, for Sonnet to run. One minor release, 4.86.0. Graham saw the traced set
(`docs/guitars/guitars-dark.jpg`, `guitars-light.jpg`) and said plan the build.

**Graham's rule for this job: ask and show before changing the design.** Wherever putting the art into the app
needs an adjustment (a scale, a crop, a colour, a part moved or dropped, anything he'd notice), stop, show him a
screenshot of the choices, and wait for his pick. The steps marked **STOP AND SHOW** are the known ones; anything
else that comes up gets the same treatment and a line under Surprises.

## What's here

- `docs/guitars/src/`: the Nano images (JPEG; Graham has a free Gemini account, so no more generating).
- `docs/guitars/tools/`: `trace.py` (colour snap in Lab, drop strings and frets, trace flat regions with OpenCV,
  smooth to Beziers) and `compose.py` (per-guitar fixes, the measured necks in `NECK`, the drawn neck). Run
  `python3 compose.py <dir>` with the sources in `<dir>/src`.
- `docs/guitars/traced/`: the seven traced guitars, whole, with a drawn neck. 60 to 200 KB each.

Fixes already in the trace: the parlor's offset shadow (its clean half mirrored, the right half one flat shade
darker), the classical's outline removed and abalone diamonds drawn, the headliner's body built from the traced
silhouette with a drawn gold binding, pickups and bridge (the source was too small to trace them cleanly).

## The one big question: the neck is fat on purpose

The Road's fretboard is 212 of 390 units wide so the finger dots are thumb-sized tap targets. On Nano's guitars
the body is about six times the board's width. At true scale a Road body would be about 1,300 units wide on a
390-unit screen. So the body can't be both true to Nano and fully on screen. Three ways, to mock up in Step 2:

- **A. Squeezed:** the whole body fits the screen width. Every outline is Nano's, but the neck looks thick for the
  body (close to how today's guitars read). Calm, nothing cut off.
- **B. Half bleed:** the body at about 1.6 times the screen width, centred: the waist, the soundhole or pickups and
  the bridge are on screen, the bouts run off both edges. Reads like a close-up of a real guitar. **Opus's pick**,
  pending the mockup.
- **C. True scale:** the body at Nano's real proportion to the neck: a wall of wood with the soundhole and bridge,
  the outline mostly off screen. The most real, the least recognisable as a whole guitar.

Whole-guitar places (the new-guitar sheet, the guitarist's guitar, anywhere a guitar is shown as an object) use the
full Nano guitar at its real proportions in every option.

## Decisions (Opus proposes; Graham picks at the STOP AND SHOW steps)

1. **Road body:** A, B or C above (Step 2).
2. **The guitar's name on the headstock:** today it's printed there. Nano's headstocks have no decal and a name
   would fight the art. Proposed: the name moves off the headstock (the leg banner and the "headlined" tag already
   carry it). Show both in Step 2.
3. **The neck stays drawn by the app** (board, frets, binding, nut, strings, progress inlays and finger dots),
   recoloured to each Nano guitar's board and binding. The tap targets and the inlays that show progress don't
   change.
4. **Headliner shape:** Nano's four-point body as traced (not the swallow tail first asked for). Graham has seen it.
5. **Size budget:** the art is loaded per guitar (a file per guitar, fetched when that leg shows), each under
   25 KB after simplifying, so the Road doesn't get heavier for legs you haven't reached.

## Steps

### Step 1. The art pipeline and files [Sonnet]

- [ ] 1.1 Move the tools into `tools/guitars/` (not served; keep out of `SHELL`). One command rebuilds every guitar
      from `docs/guitars/src` into `art/guitars/<leg>.js`.
- [ ] 1.2 Split each guitar into parts in its own coordinates: `head` (above the nut), `body` (the body and what's
      on it, under the board), `over` (hardware that sits over the board's end: pickups, bridge, tailpiece),
      and the measured numbers (`nut`, `end`, `bridge`, board edges, body centre). Strings, frets and inlays are
      not in the art.
- [ ] 1.3 Simplify: round coordinates to integers, raise the trace tolerance until the outline visibly moves, drop
      regions under a size floor, merge same-colour paths. Target under 25 KB per guitar. **STOP AND SHOW** if the
      budget can't be met without visible change: a side-by-side of before and after, and Graham picks.
- [ ] 1.4 Each `art/guitars/<leg>.js` exports `{ head, body, over, nums, view }`; all of them go in `SHELL`.
      `GUITARS` in core/game.js gets each guitar's Nano colours (board, binding, nut) so the drawn neck matches.
- [ ] 1.5 Unit tests: every leg has art; parts parse as SVG path data; numbers are in range; size under budget.

### Step 2. Mockups [Sonnet] **STOP AND SHOW**

- [ ] 2.1 A throwaway page (a `zz_` test, then deleted) with a phone-sized Road leg (390 x 844) for options A, B
      and C, each on Dark and Light, with real stops (a done dot, the current dot with its tag, a merch box ring,
      the headline double inlay), using the cutaway (acoustic) and the single-cut (electric).
- [ ] 2.2 The headstock with and without the name, for decision 2.
- [ ] 2.3 The new-guitar sheet with the full Nano guitar.
- [ ] 2.4 Send Graham the screenshots with one line per option. Wait for his picks. Write them under Decisions.

### Step 3. The Road [Sonnet]

- [ ] 3.1 `fretboard.js`: the headstock from the art, scaled so its width at the nut meets the drawn board; the
      body from the art at the chosen scale, centred on the board, its bridge setting where the strings end
      (`stringLayer`); `over` parts drawn after the board so the pickups sit on top of the board's end like now.
- [ ] 3.2 The art loads with its leg (dynamic import, like `opening.js`); until it arrives, today's drawing shows,
      so a slow phone never sees an empty neck. No layout shift: the neck's height comes from `fretLayout`, not
      the art.
- [ ] 3.3 Keep: the stops' positions, the strings, the inlay materials, the songs badge, the new-guitar sheet's
      timing, scroll-to-current. The body is still decoration (`aria-hidden`); the neck keeps its group label.
- [ ] 3.4 **STOP AND SHOW**: screenshots of every leg that exists on a phone, Dark and Light, top (headstock and
      first stops) and bottom (last stops and body). List anything that needed adjusting and why. Wait.

### Step 4. Whole guitars [Sonnet]

- [ ] 4.1 `guitarSVG` (the new-guitar sheet) shows the full Nano guitar.
- [ ] 4.2 The guitarist's guitar (guitarist.js): the Nano body outline and its key parts at about 40 px tall,
      replacing the hand-drawn small guitars. **STOP AND SHOW** at chart and profile size: if the art turns to mush
      that small, offer keeping the current small drawings recoloured instead.

### Step 5. Tests and release [Sonnet]

- [ ] 5.1 e2e: each leg's neck draws the art (an element per part), the strings end at the art's bridge, stops
      are where they were (positions unchanged), the fallback draws before the art arrives, the new-guitar sheet
      shows the full guitar. axe must pass.
- [ ] 5.2 `VERSION` 4.86.0 and `CACHE`; README (the guitars), CLAUDE.md (the art files, the pipeline, "the neck is
      fat on purpose"), docs/FRET-PLAN.md pointer. No change to docs/ONBOARDING.md unless something hidden moves.
- [ ] 5.3 One commit per step, `eslint .` and `node tests/quick.mjs`, rebase. **Push only when Graham says ship.**
- [ ] 5.4 Visual references in CI will differ for the Road: say so; remake only when Graham says.

### Step 6. Feel check [Opus]

- [ ] 6.1 Play through a leg on a phone in each look; the pass at the end of a leg into the body; the new-guitar
      moment. List fixes for a patch.

## Open (not this release)

- More looks for the same guitar (a burst, a sunburst, a black finish) earned or on the Merch table, by re-running
  the pipeline on new Nano art.
- The Encore guitar and the strum, pick and finger legs use this art once those legs exist.

## Surprises

(Write here when something doesn't match the plan.)
