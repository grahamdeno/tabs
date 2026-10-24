# Song screen look plan (after 4.57.0, 2026-10-24)

Graham showed Apple Music's lyrics view (2026-10-24) and asked for more of it on the song screen: bolder words, better fading of the lines you're not on, a background taken from the album cover, and controls that hide when you're not touching. Lines still never wrap (4.51.0). Drafted by Opus, run by Sonnet, one release per step.

The guitarist rule: a singer reads only the line they're on, a guitarist has to see the next chord coming. So the next line fades less than in Apple Music, and chord letters always stay brighter than the words around them.

Tick a task's box in this file in the same commit that does it.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Plain writing with no em dashes, mid-song actions in thumb reach, no ring controls, the Gig is words first.
2. One step per release, a minor version each. Bump `VERSION` in `core.js` and `CACHE` in `sw.js` together (edit only the `const CACHE` line).
3. Add or update tests. Run `eslint .` and `node tests/quick.mjs` (with `CHROMIUM_PATH`), not the full suite. Then `git fetch origin main && git rebase origin/main` and push to `main`.
4. Update the README feature list, and docs/ONBOARDING.md when something hidden changes (step 3 does).
5. If the code doesn't match this plan, stop that task and write it under "Surprises". Don't improvise.
6. After each step, stop so Graham can try it on his phone, and tell him which model the next step wants.

## Decisions (Graham, 2026-10-24)

- Bold every line while playing, the current line boldest.
- Album cover background: in the show (the Gig) only.
- Controls that hide: the X, the mic button and Pause. The crowd, the combo and the section name stay.

Defaults taken by Opus (Graham can change these):

- D1. Bold applies whenever the stage is up (`body.staged`, so the Gig and plain Play). A paused, unplayed sheet keeps today's weight.
- D2. A worn Merch backdrop (`.gg-bd`, the top banner) still shows over the cover. It's a banner, not a full background, and he paid fans for it.
- D3. No cover (no `song.listen.art`): the show looks exactly as it does today.
- D4. No blur on far lines. Blurring many moving lines costs an iPhone frames; fading does most of the work.
- D5. Hidden controls wake on any touch. A tap that lands on a hidden control only wakes it; it doesn't press it.
- D6. Reduced motion: fades become instant, nothing else changes.

## Step 1 [Sonnet] 4.58.0: Bold words and a smoother fade

Where: `styles.css` (the `body.staged .sheet` rules near line 3709 and `.sheet.measure` near 3744), `fitText` in `app.js`.

- [x] 1.1 Weight: `body.staged .sheet > :is(.pr, .ly)` gets `font-weight: 700`; `.st-now` gets `800`. Chord letters (`.sheet .c`, today 650) go to 800 while staged. Nunito is a variable font loaded for 400 to 800 (`@font-face` in styles.css), so nothing new to load.
- [x] 1.2 Measure at the boldest weight: in `.sheet.measure > :is(.pr, .ly, .crow)` add `font-weight: 800` (and `.c` at 800), so the size `fitText` picks fits the current line at 800 and never overflows when a line turns current. The size drops about 5%; that's expected. Keep `FIT_MIN` 14.
- [x] 1.3 Fade by distance, using colour for the words instead of opacity on the whole line, so chords can stay brighter:
  - Replace the opacity rules for `body.staged .sheet > *` (`.7`, past `.35`, next `.85`, now `1`) with opacity 1 on every line and a word colour per mark: now `var(--fg)`; next `color-mix(in srgb, var(--fg) 65%, transparent)`; lines after next `45%`; past `30%`.
  - Chord letters: now and next at full gel colour; after next at 75%; past at 40%. The existing `.st-got`, `.st-miss`, `.st-wait` and `.st-rep` rules keep winning (check the specificity, they start with `:root`).
  - Section names (`.sec`) and wordless rows (`.crow`) follow the same scale by their position.
  - Keep the `transition` so the fade moves smoothly (0.25 s on `color`, as today on opacity).
- [x] 1.4 Light palette check: `--fg` at 30% on the festival background must still be visible. Run the contrast numbers for past words and next chords in all three palettes and write them in the commit message. Past lines don't need to pass 4.5:1 (they're decoration), the next line's chords do need 3:1.
- [x] 1.5 Tests (`tests/e2e/gig.e2e.mjs`): on a playing song, the current line's computed weight is 800 and the next line's 700; the next line's chord colour alpha is higher than its word colour alpha; no line's `scrollWidth` is wider than the sheet at 390 wide with the current line at 800. Update any test that read the old opacities (grep `opacity` in tests/e2e for `.st-`).

## Step 2 [Opus] 4.59.0: The album cover behind the show

Opus, because it changes colour tokens across three palettes and the stage light, and needs judgment on contrast.

Where: `gig.js` (`shell`, start and leave), `stage.js` (`stageStart`, `stageClear`), `styles.css` (the Gig and stage sections).

- [x] 2.1 When the show starts and `song.listen.art` is an https link, add a `<div class="gg-cover" aria-hidden="true">` as the first child of `body` (behind `.st-bg`), with the cover as a CSS background (`600x600bb`, the size `listen.js` already saves). Set `body.covered`. Remove both when the show ends, on leave and on `stageClear`.
- [x] 2.2 The look: the cover scaled to fill the screen (`inset: -10%`, `background-size: cover`), `filter: blur(60px) saturate(1.4)`, then a dark layer on top (`rgba(0,0,0,.45)`, tuned until white text passes 4.5:1 on a bright cover; test with a white and a yellow cover). The blur is one still layer, drawn once, so it doesn't cost frames while scrolling. Fade it in over 0.6 s once the image has loaded; until then today's background shows.
- [x] 2.3 Tokens under `body.covered`: the show reads as dark whatever the palette. Set `--fg` white, `--muted` white at 60%, `--rim` white at 18%, `--card` white at 10%, and make the `.gig::before` and `.gig::after` gradients go to transparent black instead of `var(--bg)`. Chunky buttons keep their lip.
- [x] 2.4 The stage on a cover: the band (`.st-now::before`) becomes soft white (`#fff` at 10% fill, 30% lines) instead of the section gel, and the stage light (`.st-bg`) is hidden. The section name in `.gg-sec` keeps the gel colour, so the section is still shown. Chord letters: white for now and next, with `.st-got`, `.st-miss` and `.st-wait` keeping their colours (check `--got` and `--miss-ink` still pass 3:1 on the dark layer).
- [x] 2.5 Plain Play and the paused sheet are untouched (decision 2).
- [x] 2.6 Tests: a song with `listen.art` (route the image to a small PNG with `page.route`) shows `.gg-cover` and `body.covered` in the show and both are gone after leaving; a song without art shows neither. Add the covered show to `tests/e2e/a11y.e2e.mjs` in all three palettes.
- [x] 2.7 docs/DATA.md: nothing new is stored. Say so in the commit.

## Step 3 [Sonnet] 4.60.0: Controls that hide in the show

Where: `gig.js`, `styles.css`. The plain player already does this (`wakeControls` and `.player.idle` in `app.js`); reuse the same idea, not the same element.

- [x] 3.1 In the show, while the song plays, add `idle` to `#gig` after 3 s without a touch; any `touchstart`, `pointerdown`, `wheel` or `keydown` removes it and restarts the 3 s. Paused, counting in, Wait for me holding, the end card, or a sheet open over the show: never idle.
- [x] 3.2 `.gig.idle :is(.gg-x, .gg-mic, .gg-pause)`: `opacity: 0` over 0.4 s, and `pointer-events: none` only after the fade (so D5 holds: the first touch wakes them before the tap reaches them). The crowd, combo, section name, Skip this chord and the wait pill never hide. `.gg-skip` is shown only when needed, so it stays visible.
- [x] 3.3 Accessibility: hidden controls stay in the page and keep their labels; a keyboard focus wakes them. With VoiceOver on (no reliable signal), it's fine that a tap wakes first.
- [x] 3.4 Reduced motion: no fade, they just hide and show.
- [x] 3.5 Tests (`gig.e2e.mjs`): after 3 s of play (`/* real timer */`) `#gig` has `idle` and Pause's opacity is 0; a tap brings it back and Pause is not pressed by that tap; paused never goes idle.
- [x] 3.6 docs/ONBOARDING.md: add "controls hide while playing, touch to show" under the Gig, taught by: none (it's what Apple Music does). README: one line in the Gig's description.

## Surprises

- Step 1 contrast (1.4), words on the palette background: next line 7.0 (Neon), 4.9 (Festival), 4.4 (Green); lines after next 4.0, 2.7, 2.6; played lines 2.5, 1.9, 1.8. Light palettes are weak after the next line; it is bold and large, and decoration beyond the next line. Say if you want the 45% raised to 55% there.
- Step 2: the `a11y` cover test needs axe-core, which can't be installed here (npm is blocked), so it ran names-only; CI runs axe. The dark look turns on only once the picture has loaded, so a failed load leaves today's look. The cover test is in gig.e2e.mjs and a11y.e2e.mjs.
- Step 3: a tap anywhere pauses while playing (app.js), so the wake swallows the next click page-wide, not just on the three controls. Hidden controls use `visibility: hidden` after the fade, so taps can't land on them, and they keep their labels in the page.
- Fade is in colour on the words and opacity on the chords, so a line's chords read brighter than its words (test added). Section names still use opacity.
