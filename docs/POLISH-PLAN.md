# Song screen polish plan (after 4.61.0, 2026-10-24)

Graham tried 4.61.0 (three screenshots, 2026-10-24): the song page under a cover, the Tools sheet, the top of the page. Opus found the problems below. Graham asked for all of them fixed, plus a title that scrolls like a banner and a chord row that shows there are more chords. Drafted by Opus, run by Sonnet, one release per step.

Tick a task's box in this file in the same commit that does it.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Plain writing with no em dashes, thumb reach, no ring controls.
2. One step per release. Bump `VERSION` in `core.js` and `CACHE` in `sw.js` together (edit only the `const CACHE` line).
3. Add or update tests. `eslint .` and `node tests/quick.mjs` (with `CHROMIUM_PATH`). Re-run any failure alone before calling it a flake. Then fetch, rebase on `origin/main` and push to `main`.
4. README feature list and docs/ONBOARDING.md where behaviour changes.
5. If the code doesn't match this plan, stop and write it under "Surprises".
6. After each step, stop so Graham can try it, and say which model the next step wants.
7. Screenshot what you changed under a cover in Festival (light) and Neon (dark) with a throwaway `tests/e2e/zz_*.e2e.mjs`, look at it, delete the file.

## How to show there are more chords (Opus, thought through)

The row already scrolls sideways (`.strip`, `overflow-x: auto`). The half-shown fourth tile was meant to say "there's more", and it failed: Graham read it as a cut-off. That is the lesson. A cue you have to notice is weaker than not hiding anything.

Options weighed:

- Dots under the row: built for pages of photos; for 4 to 8 small tiles they're noise, and they don't say which chords.
- An edge fade plus a count: the usual iPhone cue. Better than today, but the chords are still hidden, and the guitarist still has to scroll to learn the song's shapes.
- A "+2" tile at the end: says how many, but it's one more tap to see shapes you need before playing.
- **Fit every chord on screen, and only scroll when they truly can't fit.** Most songs have 3 to 6 chords. Moving the "CHORDS" label above the row frees about one tile's width; sizing the tiles to the count fits up to 6 on a 390 wide phone with diagrams still readable. Nothing is hidden, so nothing needs an indicator.

**Decision: fit first, then scroll with clear cues.** Up to 6 chords (on a 390 wide phone; more on wider ones): all tiles shown, sized to share the width. 7 or more: tiles at their smallest readable size, the row scrolls with snap, the right edge fades while more are to the right (the left edge once scrolled), and the label says the count ("CHORDS · 8"). The fade is the cue; the count is the promise.

## Step 0 [Sonnet] Check CI's axe result first (no release)

Every axe check since 4.59.0 ran names-only here (axe-core can't be installed in the sandbox).

- [ ] 0.1 Read the last run's annotations: `gh api repos/grahamdeno/tabs/commits/$(git rev-parse origin/main)/check-runs`, then that check run's `/annotations`. List every a11y failure under "Surprises". Fold any colour-contrast failure on the song page into step 1; anything else, stop and tell Graham.

## Step 1 [Sonnet] 4.61.1: The cover fixes

Where: the `body.covered` block at the end of `styles.css`, `.sheet.focus > .cur` (near line 318), `.chead` (near line 69), `chordSVG` and `renderStrip` in `app.js`, the `onLeave` at the `teardownFold` line in `app.js`.

- [ ] 1.1 **The dock lets words through.** Under `body.covered`, the dock's own surface (find what paints `.dock`, likely `--bar` or `--card`) is `rgba(20,18,24,.86)` with `backdrop-filter: blur(18px)` (plus `-webkit-`), the same glass as the mic button. `.dock-fade` under the cover goes to `rgba(0,0,0,.8)` at the bottom, so no line reads below the dock. Tools' label must sit on glass, never on words.
- [ ] 1.2 **Tools icons too dark.** Copy the Neon rule (`:root[data-look="neon"] .menu.tools3 .mrow.t3 .mi { color: var(--accent-ink); }`) for `body.covered`, and check the other Tools layouts (`.menu.tools .mrow.tl .mi`, which uses `--accent-deep`). Icon on its tile must reach 3:1; write the number in the commit.
- [ ] 1.3 **The current line grows and gets an outline on bold words.** On the page (not the stage), `.sheet.focus > .cur` scales 1.05 and adds `-webkit-text-stroke`. Now that every line is 700 (4.61.0), replace both with `font-weight: 800` and no scale or stroke, like the stage. Remove the 5% right margin rule only if nothing else needs it (it was there for the scale; check `fitText`'s `room` comment and keep the two in step). The current line must end at least 8 px clear of the song map rail (`.smap`).
- [ ] 1.4 **The pulled-down title looks soft.** In screenshot 1 the bar's title reads blurred. Find why (a `backdrop-filter` on an ancestor of the text, a `filter`, an opacity cross-fade, or a transform on a fractional pixel). Fix the cause; don't add a text shadow. If it can't be reproduced in Chromium, write that under Surprises and move on.
- [ ] 1.5 **A lyric line peeks under the title bar.** `.chead::before` ends at `-18px`. Under the cover, end it with a short fade to the glass colour so a line slides under rather than showing a cut edge.
- [ ] 1.6 **The chord name shows twice in each tile.** `chordSVG(name, scale)` draws the name above the diagram, and the tile adds a big `<b class="sc-n">`. Give `chordSVG` an option to leave its name out and use it in `renderStrip` only. The pop-up card (`chordSVG(name, 1.9)` near line 1438) keeps its name.
- [ ] 1.7 **The cover may flash between songs.** The song route's `onLeave` calls `coverOff()`, then the next song's page calls `coverOn()`. Only call `coverOff()` when the next route isn't a song (the pattern at `onLeave(r => { if (r.name !== "song") ... })`); `coverOn` already keeps the cover when the picture is the same and swaps it when it isn't. Test: going from one covered song to the next in a set never leaves `body.covered` off.
- [ ] 1.8 **Offline (no change expected).** `sw.js` already keeps Apple's artwork in its `ART` cache, so the cover should show offline after the first view. Add one line to the cover test that the cover image request is served from the service worker the second time, or note under Surprises why that can't be tested here.
- [ ] 1.9 Tests: dock surface alpha at least .85 under the cover; Tools icon colour is the accent under the cover; the current line on the page is weight 800 with no transform; a tile's SVG has no name text. Update any test that read the old `.cur` scale.

## Step 2 [Sonnet] 4.62.0: The title banner and the chord row

Where: the song header in `app.js` (`<h1 class="song-title">` near line 169), `.app.viewer .shead .song-title` (near line 2262 in `styles.css`), `renderStrip` in `app.js`, `.strip`, `.strip-h`, `.scard` in `styles.css`.

The title:

- [ ] 2.1 Fit first: when the title doesn't fit its box at 26 px, step it down to 20 px at most (measure once on draw, like `fitText`). Most titles then fit and never move.
- [ ] 2.2 If it still doesn't fit, it becomes a banner: the title's text in a track inside the `h1`, with a second copy marked `aria-hidden="true"` after a gap of 48 px, so it loops seamlessly. The `h1` keeps the full title as its text for screen readers.
- [ ] 2.3 The banner's cycle: wait 2 s after the page opens, scroll one full loop at about 30 px a second, rest 6 s, and stop for good after three loops. Tapping the title plays one loop again. Edges fade with a mask while it moves. It never runs while the song plays (the header is hidden then) or while the page is hidden. This keeps it within WCAG 2.2.2: moving text stops on its own within the limit after the first loops, and a tap brings it back.
- [ ] 2.4 Reduced motion: no banner. The title shows an ellipsis, and a long press (or the About this song sheet) shows it in full.
- [ ] 2.5 The pulled-down bar's title (`.chead .ct`) keeps a plain ellipsis: it's small and only there to say where you are.

The chord row (see the decision above):

- [ ] 2.6 Move the label above the row: `CHORDS · 6` in the small caps label style (`.strip-h` already holds the count in `.n`; make it read as one label). The row then uses the full width.
- [ ] 2.7 Fit: tile width is `clamp(52px, (row width - gaps) / count, 76px)`, height in proportion, diagram scaled to the tile. Up to the count that fits at 52 px, every tile shows and the row doesn't scroll.
- [ ] 2.8 More than fit: tiles at 52 px, the row scrolls with `scroll-snap-type: x proximity` and `scroll-snap-align: start` on each tile (`scroll-padding-left` matching the page margin, as `.shelf` does). A mask fades the right edge while there's more to the right, and the left edge once scrolled (a class set from the scroll position, updated on scroll). The count in the label is always shown.
- [ ] 2.9 Wide screens (`body.wide .rail .strip` wraps already) keep their layout.
- [ ] 2.10 Tests: a 4-chord song shows 4 tiles and the row doesn't scroll (`scrollWidth <= clientWidth`); a 9-chord song scrolls, has the right-edge fade class, and loses it at the end; the label reads "Chords · 9"; a long title at 390 wide gets the banner track with one `aria-hidden` copy and stops after three loops (fake timers or a short test hook); with `reducedMotion: "reduce"` there's no track and the title has an ellipsis; a short title has neither.
- [ ] 2.11 README and docs/ONBOARDING.md (the title replay tap is a hidden feature: taught by none, it's discovered).

## Surprises

(none yet)
