# Step 02 of 9: The Road

**Model:** Opus. **Branch:** `rr-02-road`. **Needs:** step 01 merged (tokens, fonts, tolex). **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (sections 2, 3, 4, 5.3, 5.4, 5.5, 5.6, 7 and 9), `r10-01-road-dark.jpg`, `r10-02-road-light.jpg`, `r8-03-road-ax-header.jpg` (the large-text header), `r9-03-road-dark-no-connector.jpg` (only for reference), `r10-00-louie-road-ready-sheet.jpg`, and the two peek images `louie-peek-dark.webp` and `louie-peek-light.webp`.

## What this step is

Restyle the Road (`#/`, `renderRoad()` in `road.js`) to match `r10-01` (dark) and `r10-02` (light). The Road already works the right way: each leg is a guitar neck (`fretboard.js`), lessons are stops on the strings, merch boxes and the headline show are inlays, the path scrolls inside the screen, and Louie stands beside it with one line. Keep all of that behaviour. Change how it looks:

1. A compact **header strip** at the top replaces the stat bar, the leg banner and the "Gig:" button.
2. Every stop becomes a **pearl inlay** in one of four states.
3. A **curved amber connector** runs from done stop to done stop and ends at the current one.
4. A **callout bubble** points at the current stop.
5. **Louie peeks** in from the left edge as an image.

The tab bar stays as it is (step 04 redoes it). Louie's SVG in `louie.js` stays as it is (step 03), and the Road stops using it.

## Graham's decisions for this step (edit before pasting)

- **Fans and streak in the header.** [x] Leave them out of the Road header (the spec header has venue, Tune and Tips only); fans stay on Show Complete and Me. [ ] Keep a small fans count in the plate.
- **Louie's line.** [x] Keep Louie's one line (`louieLine()`) in a small cream speech bubble above the peeking Louie. [ ] Drop it on the Road; the callout is enough.
- **The book button (`#rd-book`, opens Rehearse).** [x] Remove it from the Road; Rehearse is a tab. [ ] Keep it as a 44 px icon in the header's first row.

If a box you need isn't ticked, stop and ask Graham.

## Files you will touch

- `road.js`: `renderRoad()` (the `app.innerHTML` template and the bindings after it), `louieLine()` is read but not changed, `labelOf`, `tagOf` and `dotIcon` may change their output, and `fillScene()` (it writes to `#rd-bubble`; keep that id). Don't change `renderOpening()` (Opening night) except where it shares markup you restyle; check it still works.
- `fretboard.js`: `inlaySVG()`, `dotSVG()`, `stopHTML()` and `neckHTML()`. Add a `connectorSVG(lay, spaces, o)` layer. Don't change `picLayout()`, `fretLayout()`, `baseLayer()`, the bodies, `headstock()`, `guitarSVG()` or the guitar pictures.
- `hud.js`: no change to `statBar()` itself (other screens and Opening night may still call it). `renderRoad()` simply stops calling it.
- `styles.css`: "The fretboard Road" section (search for `The fretboard Road (4.82.0)`) and the `.rd-*` rules in the "Version 4 look" section. Scope new rules to the Road Ready looks.
- New images: `art/louie/louie-peek-dark.webp`, `art/louie/louie-peek-light.webp` (copy them from `docs/road-ready/images/`; they are about 55 KB each, 600 px tall). Cache them the way `art/guitars/*.webp` are cached.
- Tests: `tests/e2e/app*.e2e.mjs`, `opening.e2e.mjs`, `a11y*.e2e.mjs` and any test that selects `#h-venue`, `#h-streak`, `#h-fans`, `#h-tips`, `#rd-tonight`, `#rd-book`, `.rd-chip`, `.rd-tag`, `.rd-say` or `.rd-banner`. Grep for each first.
- `docs/ONBOARDING.md`: update any row that names the stat bar, the chip or the book button on the Road. `README.md`: update the Road description.

## What to build

### 1. Header strip (spec 5.5)

One strip pinned at the top of the Road, inside the safe area, 8 px from the screen edges, radius 18, `--tolex` dark tolex in both looks (it's a piece of the amp, like the r10-02 light mockup), a 3 px `--chrome-pipe` edge and a soft shadow.

**Row 1**

- **Venue plate** (a `<button>`, keep id `h-venue`, same action as today: open the Tour Map). Cream plate (`--rr-plate-top` to `--rr-plate-bottom`, 1.5 px `--rr-plate-edge`, two tiny screws). Inside: the venue name in Space Grotesk 700 caps, `--type-headline`, `--rr-plate-text` (from `venueNow(data).name`); under it "Show 4 of 6" in `--type-subhead` (the current stop's position in `road.leg` and the leg's stop count, from `roadPath(data)`); on the right a pip row with one pip per stop in the leg (filled `--rr-engrave` for done, a ring for the current, empty rings ahead; decorative, `aria-hidden`), and under it "Club next" in `--type-footnote` (the next venue's name; use `venueName()` from `core/turf.js` via `core.js`). Accessible name: "Corner Pub, show 4 of 6, Club next. Open the Tour Map".
- **Tune** (new `<button id="rd-tune">`): a round chrome button with a tuning-fork line icon and the label "Tune" under it. It opens the tuner exactly as the More sheet does today (`openTuner("standard", ...)` in `hud.js` `openMore()`); reuse that call. If the tuner wasn't used in the last few hours (`tunedRecently()`), show the same small dot the More tab shows today.
- **Tips pill** (keep id `h-tips`, same action: open the Merch table): a cream capsule with the coin and "$411" (`tipsOf(data)`), label "Tips" under it. Accessible name: "411 dollars in tips. Open the Merch table".

**Row 2**

- A dark inset bar (`--rr-card`, radius 12) with "TONIGHT" as a caption overline in `--rr-amber-text`, the song title from `upNext()` in Inter 600 `--type-headline` `--rr-text`, and a round amber play button on the right (44 px, `--rr-amber` fill, play glyph in `--rr-on-amber`). The whole row is one `<button>` with id `rd-tonight` and the same action as today (`playGig(song.id, { from: "road" })`). Accessible name: "Tonight: Kettle Hums. Play". With no song, show "Add a song to play tonight" and open search (`openSearch`) the way the Songbook bar does.

**Large text** (`data-ax="1"` and up, see `r8-03`): the strip becomes stacked rows: the venue plate full width; then Tonight and play; then Tune and Tips side by side. The pip row hides at `data-ax="3"`; the plate text says the same in words. Nothing truncates; the venue name and song title wrap.

**What goes away on the Road:** the `.rd-top` stat bar, the `.rd-banner` leg banner and its book button (if ticked above), and the `.rd-chip` line (its text moves into the callout). The leg name still shows: keep the `.rd-legmark` labels between necks ("Leg 2, Kettle Hums" style, `--type-caption` caps in `--rr-text-2`).

### 2. Inlay stops (spec 5.3)

Stops are drawn in code, flush pearl set into the rosewood: a thin dark cut edge (1 px, black at 45 percent) and a soft inner top shadow, never a drop shadow. Use layered radial gradients in SVG for the pearl and a tiny shimmer (two small light ellipses, as `inlaySVG()` already does with `rd-sheen`).

| Stop state (`s.state`) | Shape | Size | Fill | Mark | Light |
|---|---|---|---|---|---|
| `done` | Dot | 26 px | `--rr-pearl-done` with shimmer | Engraved check in `--rr-engrave` | Faint amber halo, `--rr-glow` at 20 percent |
| `now` (current) | Trapezoid block, wider at the bottom | 52 by 38 px | `--rr-pearl-now` | Engraved show number in Space Grotesk 700, `--rr-engrave` | Glows from within: radial `--rr-glow`, 88 px across, 60 percent |
| `open` or `locked` (ahead) | Dot | 26 px | `--rr-pearl-locked`, no shimmer | Engraved show number in `--rr-engrave-locked` | None |
| Headline show (`kind: "headline"`, the double inlay) | Two dots | 24 px each | Matte pearl | Left: number. Right: a small engraved lock | None until unlocked, then both become done |
| Merch box (`kind: "box"`) | Keep the crate inlay shape from `crateLines()` | 30 px | Pearl in the same state colours | The crate lines engraved | Same as its state |

- The engraved look is the mark in `--rr-engrave` with a 1 px lighter copy 1 px below it (white at 35 percent).
- Each stop keeps its real `<button>`, its `data-stop` id, its position from the layout, and its click behaviour (the stop card). Give every button a 44 by 44 px hit area centred on the art even when the art is 24 or 26 px.
- Accessible names: "Show 4 of 6, Kettle Hums, current. Double tap to open." Extend `labelOf` in `renderRoad()` to give the show number, the stop's name and its state; keep the existing wording for merch boxes and the headline show ("Headline show, locked").
- The finger-dot drawing (`dotSVG()` with its lip, body and icon) is replaced by the pearl inlay for lesson stops. Keep the `rd-songs` count for stops ahead (how many songs a lesson opens) as a tiny cream chip beside the stop, `--type-caption`, `aria-hidden` (the button's label already says it). If it collides with the connector or a neighbouring stop on a 375 px wide phone, list it in Surprises and leave it off.
- Under the Road Ready looks, put a 0 to 8 percent dark scrim over the wood under each inlay if needed so numbers keep 4.5:1 (spec section 2, Rules). The engraved numbers on pearl are #5C3A16 on #FCCE80, about 5.8:1.

### 3. Curved amber connector (spec 5.4)

- Add `connectorSVG(lay, spaces, o)` in `fretboard.js`. It returns one `<svg class="rd-conn" viewBox="0 0 390 {lay.height}" aria-hidden="true">` drawn over the base layer and under the stops (and under the strings is fine).
- For each pair of consecutive stops from the first done stop up to the current stop, draw a cubic Bezier with vertical tangents: from `(x1, y1)` to `(x2, y2)`, control points `(x1, ym)` and `(x2, ym)` where `ym` is halfway. It leaves along one string and bends smoothly onto the next stop's string. Use the same x and y that `stopHTML()` uses for each stop (factor that maths into a small helper so they can't disagree).
- Draw nothing ahead of the current stop. When a whole leg is done, the connector runs to the double inlay.
- Two strokes: a 12 px glow (`--rr-glow` at 60 percent, `filter: blur(7px)` or an SVG `feGaussianBlur` of 7), then a 2.2 px core line (`--rr-glow-core`), both with round caps.
- After a show moves the current stop on (the Road is re-rendered when you come back from a gig), the newest segment draws along its path in 0.6 s using `stroke-dasharray` and `stroke-dashoffset`. Under `prefers-reduced-motion: reduce` it appears at once.
- In Road Ready light, the same colours work over the wood (the neck is the same picture in both looks).

### 4. Callout bubble

- The current stop's tag (`.rd-tag`, made in `stopHTML()`) becomes a cream callout bubble (`--rr-plate-top`, `--rr-plate-text`, radius 10, `--type-callout`, a small pointer towards the stop), as in `r10-01` ("C to D, opens 3 songs").
- Text: for a chord stop, "{the chord you already know that leads in} to {this chord}, opens {N} songs" when `playableSongs(data, chord).more` is above 0, otherwise the existing `tagOf()` text. For a merch box, "Tap to open". For the headline show, "Headline show".
- The bubble is `aria-hidden`; the stop's button label carries the same words.
- It must not cover another stop or run off-screen; flip it to the other side of the neck when the stop is on the right (the `l` and `r` classes already do this).

### 5. Louie peeks in (spec section 9)

- An `<img class="rd-peek" alt="" aria-hidden="true">` (or a div with a background image) showing `art/louie/louie-peek-dark.webp` in Road Ready dark and `louie-peek-light.webp` in Road Ready light (the dark one has the warm rim baked in because navy on #141210 is only 1.3:1 without it). Switch with a CSS variable per look so it needs no JavaScript.
- About 150 px tall, about 40 percent of him past the left edge of the screen, his reaching mitten towards the guitar body, away from every inlay and the callout. Position him relative to the screen, not the scrolling path, at about 55 percent of the visible path height. `pointer-events: none`.
- Hidden at `data-ax="3"`, and when the screen is narrower than 360 px.
- No animation by default. If you add one, a 2 s, 4 px vertical bob at most, and none under Reduce Motion.
- If "Keep Louie's line" is ticked: a small cream speech bubble (`--type-callout`, max two lines, wraps) above his head with the text from `louieLine()`, keeping id `rd-bubble` so `fillScene()` still updates it. It is real text (not `aria-hidden`) and comes after the header strip in reading order. It must not cover a stop; if it would, drop it below the strip instead.
- The old `.rd-say` block with `louie(say.mood, ...)` is removed from the Road. Leave `louie.js` alone.

### 6. Light mode

- Road Ready light (`r10-02`): cream tolex background, the same wood neck, the same dark tolex header strip, the light tab bar (from step 04 later). Check every piece of text on the cream: the leg labels use `--rr-text-2`, and the callout is cream on wood in both looks.

### 7. Motion (spec section 7)

- Current inlay: a slow glow breathe, 2.4 s loop, glow opacity 85 to 100 percent. Static under Reduce Motion.
- Connector reveal: 0.6 s (above). Instant under Reduce Motion.
- The existing pulse on the current stop's halo (search `rd-halo` animations in `styles.css`) is replaced by the breathe on Road Ready looks.

## Acceptance criteria

1. On a 390 by 844 phone in Road Ready dark, the Road matches `r10-01` in layout: header strip with venue plate, Tune and Tips, then Tonight; the neck with done checks, a glowing trapezoid on the current stop with its number, numbered matte dots ahead, the double inlay at the end of the leg; the connector only between done stops and up to the current; the callout beside the current stop; Louie peeking from the left.
2. Road Ready light matches `r10-02` the same way.
3. Every stop, the venue plate, Tune, Tips and Tonight still do exactly what they did (stop card, Tour Map, tuner, Merch table, play the gig).
4. Every control is at least 44 by 44 px (a browser test that measures `getBoundingClientRect()` of every button on the Road).
5. The Road's screen reader order is: venue plate, Tune, Tips, Tonight, Louie's line (if kept), then the leg label and the stops in order. Louie's image is hidden from it.
6. At 33 px root size (`data-ax="1"`), the header stacks, nothing truncates and nothing overlaps; at 40 px (`data-ax="3"`), Louie and the pips are hidden.
7. Under Reduce Motion, nothing moves on the Road (no breathe, no draw-on).
8. Opening night (a fresh install) still works: `tests/e2e/opening.e2e.mjs` passes.
9. Contrast: callout text, plate text, Tonight text, leg labels and inlay numbers meet AA in both looks (add them to the axe run, and spot-check the engraved numbers with a computed ratio).
10. Tests that used removed ids are updated, and the PR says which ids went away and why.

## Screenshot check

Road in dark and light, with: a leg part done (current stop in the middle), a fresh leg (current is the first stop, so no connector), a finished leg (connector to the double inlay), and the large-text header. Put each next to `r10-01` or `r10-02` in the PR. Also one screenshot of Opening night to show it's unchanged.

## Don't change

- The path logic in `core.js` (`roadPath`, `fansOf`, `playableSongs`, `boxesSeed`, `openBox`), what a stop card says or does, the order of stops, how legs and guitars are earned, Opening night's steps, and `louieLine()`'s wording (even the venue warning lines; Graham will decide those separately).
- The guitar pictures, headstocks and bodies (`art/guitars/*`, `baseLayer()`, `headstock()`): step 09 does guitar art.
- `louie.js` (step 03), the tab bar in `hud.js` (step 04), `statBar()` for any screen other than the Road.
- Storage, keys, data fields.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-02-road`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
- **One step only.** Do only what this prompt asks. If the code doesn't match what this prompt says (a file, function or id isn't where it says), stop that part, write it under "Surprises" in `docs/ROAD-READY-PLAN.md`, and tell Graham instead of guessing.
- **Releases.** Bump the version the way CLAUDE.md and the README's Releases section say (VERSION in `core.js` and CACHE in `sw.js` move together; `index.html` says this may happen automatically on push to main, so check and don't bump twice). A new `.js` file goes into `SHELL` in `sw.js`. New images are cached the same way the existing `art/guitars/*.webp` files are; check `sw.js` and copy that pattern.
- **Checks.** Run `eslint .` and `node tests/quick.mjs`. Don't run the full suite (CI does), and don't remake the `tests/visual` references (Graham says when). Update or add tests for anything you change, and keep the axe a11y test passing.
- **Screenshots.** Make them the CLAUDE.md way: a throwaway `tests/e2e/zz_*.e2e.mjs` using `phone()` that saves to `$SHOT`, run it, then delete it before you commit. Take these, as PNGs, and put them in the PR description: phone dark, phone light, and phone dark with large text (see "Large text" below). Compare each one side by side with the round 10 image named in this prompt and list any differences you chose to leave.
- **Writing.** Every word Graham or a player sees (UI text, comments he reads, commit messages, the PR) is plain and direct, with no em dashes. Any lyrics in tests or fixtures are made up, never real song lyrics.
- **Louie hard rules.** Louie is Road Ready: a blue 1x12 combo amp with a yellow control-panel face. Exactly one mouth, always on the yellow panel between the eyes and the four cream knobs. The grille is plain navy cloth and is never a face (no mouth, smile line or features on it). Mitten hands with no fingers. No blush or cheek spots, no guitar pick, no amp brand logos. He is a character who cheers the player on; never call him an AI or an assistant.
- **Product rules.** Encouraging, never guilt: no streak-loss warnings, sad faces or "you missed a day" copy in anything you add. Not a coin-path game board. Tolex and amp parts, not cartoon chrome. Tab icons are our own drawings. No lamps and no VU gauge anywhere you touch.

### How the spec maps to this web app

The spec (`docs/road-ready/louie-design-spec.md`) was written in iOS terms. Build it with HTML, CSS and SVG in this repo, like this:

| Spec says | Build it here as |
|---|---|
| pt | CSS px (1 pt is 1 CSS px on iPhone) |
| Dynamic Type, `relativeTo:` | `rem` sizes from the `--type-*` tokens (step 01 sets the root size from `-apple-system-body`, so iOS text size settings scale it) |
| AX sizes (AX1+, AX3+) | `:root[data-ax="1"]`, `:root[data-ax="3"]` (step 01 sets these from the measured root size) |
| Asset catalog colours, light and dark | CSS custom properties on the Road Ready looks in the "Version 4 look" section of `styles.css` |
| Reduce Motion | `@media (prefers-reduced-motion: reduce)` |
| VoiceOver labels, hidden decorative images | `aria-label`, real `<button>`s, `role`, `aria-hidden="true"` on decorative art, visible text as the label where possible |
| VoiceOver or Switch Control running | Not detectable on the web. Use: never hide controls while focus is inside them, show them on any key press, and the "Keep playing controls on screen" setting (step 05) |
| `Shape`, `Canvas`, `Path` | Inline SVG (or `<canvas>` only for particles) |
| SwiftUI notes, section 10 | Reference only, for intent. Don't add Swift files |

### Accessibility checklist (every step)

- Text sizes come from the `--type-*` tokens in rem, so they grow with the iPhone text size. Nothing truncates that the spec says wraps.
- Every tap target is at least 44 by 44 px (use padding or a hit area, not a bigger drawing).
- Text contrast meets WCAG AA: 4.5:1 for body text, 3:1 for large text (24 px, or 19 px bold) and for icons. Use the spec's tokens; never dim text with opacity.
- Motion follows the spec's motion table, with the Reduce Motion column under `prefers-reduced-motion: reduce`.
- Screen reader: every control has a name, decorative art is `aria-hidden`, and order follows the screen top to bottom.
- Light and dark both work: check the Road Ready dark look and the Road Ready light look.

**Large text.** For the large-text screenshot, set the root font size the way step 01's `data-ax` code reads it (for example `document.documentElement.style.fontSize = "33px"` before the screen draws, which is about AX2), and confirm `data-ax="1"` is set.

