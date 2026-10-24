# The cover room plan (after 4.60.0, 2026-10-24)

Graham tried 4.58.0 to 4.60.0 on his phone (2026-10-24, five screenshots) and liked the album cover look much better. While a show is paused, light-palette surfaces showed white on white: the pulled-down title bar, the Tools sheet, the Tools button beside Resume. The mic button was see-through over the words. He asked whether to keep the cover or go back, and whether to bold the song page too. Drafted by Opus, run by Sonnet, one release per step.

Tick a task's box in this file in the same commit that does it.

## Why it broke

`body.covered` (4.59.0, the end of `styles.css`) swaps only some colour tokens to dark: `--fg`, `--muted`, `--rim`, `--card`, `--bg`. The surfaces that broke paint with tokens it left alone: `--bar` (the title bar, `.chead::before`), `--solid` (sheets, the pull pill), `--card-2`, `--hair`, `--head`, `--scrim`, `--accent-soft`. In Festival and Green those stay white, and the text on them is now white. A pause keeps the show open, so the cover and the half-dark tokens stay up over the whole song page.

The fix is not one patch per surface: `body.covered` sets the complete dark token set, so everything on the page that uses tokens is dark and readable together.

## Decisions (Opus as designer, 2026-10-24; Graham can change any)

- D1. **Keep the cover, and make it the song's room.** Any song with a cover shows it on its whole song screen: paused, plain Play and the Gig. Today the look flips from dark (playing) to half light (paused) and back, which reads as a mistake. One look per song feels premium, the way Apple Music's Now Playing does. The rest of the app (the Road, the Songbook, Charts) keeps its palette. Opening a song is walking into its room.
- D2. **A song with no cover keeps today's palette look.** Get the song now finds the cover for most songs (4.57.0), so this gets rarer on its own.
- D3. **Bold on both.** Every lyric line is 700 on the song page too, and chords 800. The stage keeps the current line at 800. The size is already measured at 800 (4.58.0), so the page and the stage have the same size and the text doesn't jump when Play starts.
- D4. **Glass, not see-through.** Controls over moving words (the mic button, the bar, the pull pill) get a dark surface that's nearly solid with a backdrop blur, plus a stronger dark fade at the bottom of the screen, so words never show through a label.
- D5. **The button beside Resume is Tools.** It was there all along, white on white. The tokens bring it back. Nothing to restore.
- D6. **Accessibility is a test, not a hope.** An axe sweep of every song-page surface under the cover, in all three palettes.

## Rules for whoever runs a step

1. Read CLAUDE.md first. Plain writing with no em dashes, thumb reach, no ring controls.
2. One step per release. Bump `VERSION` in `core.js` and `CACHE` in `sw.js` together (edit only the `const CACHE` line).
3. Add or update tests. `eslint .` and `node tests/quick.mjs` (with `CHROMIUM_PATH`). Re-run any failure alone before calling it a flake. Then fetch, rebase on `origin/main` and push to `main`.
4. README feature list and docs/ONBOARDING.md where behaviour changes.
5. If the code doesn't match this plan, stop and write it under "Surprises".
6. After each step, stop so Graham can try it, and say which model the next step wants.

## Step 1 [Sonnet] 4.60.1: The complete dark set under the cover (the fix)

Where: the 4.59.0 block at the end of `styles.css` (`body.covered { ... }`).

- [ ] 1.1 Replace the `body.covered` token line with the full set. Model it on the Neon block (`:root, :root[data-look="neon"]` near line 1783), but neutral rather than purple, so the cover leads:
  - `--bg: #141218; --fg: #FFFFFF; --fg-2: rgba(255,255,255,.86); --muted: rgba(255,255,255,.64); --head: #FFFFFF;`
  - `--card: rgba(255,255,255,.10); --card-2: rgba(255,255,255,.16); --rim: rgba(255,255,255,.20); --hair: rgba(255,255,255,.12); --rim-hi: rgba(255,255,255,.06);`
  - `--bar: rgba(20,18,24,.72); --solid: #1C1A22; --scrim: rgba(0,0,0,.6); --shadow: 0 8px 24px rgba(0,0,0,.45);`
  - `--accent-ink: var(--accent); --accent-soft: color-mix(in srgb, var(--accent) 18%, transparent); --good-soft: color-mix(in srgb, var(--good) 18%, transparent);`
  - Keep `--got`, `--miss-ink` and `color-scheme: dark` from 4.59.0. Leave `--accent`, `--accent-deep` and `--on-accent` alone: the palette's accent stays (the coral Resume in his screenshots).
  - Grep `styles.css` for tokens defined in the palette blocks (lines ~1783 to ~1830) and add any other surface token a song-page element uses. List any you add in the commit message.
- [ ] 1.2 Glass for controls over words (D4): under `body.covered`, `.gg-mic` gets `background: rgba(20,18,24,.82)` with `backdrop-filter: blur(18px)` (plus `-webkit-`), white text, and a 2px `--good` border while listening (off: `--rim`). The `.gig::after` bottom fade goes to `rgba(0,0,0,.7)` over the last 150 px, so the words fade out before the controls.
- [ ] 1.3 Check by looking, in all three palettes, paused in a covered show: the pulled-down title bar, the Tools sheet (every row, the switches off and on, the Play/Practice switch at its foot), the Tools button beside Resume, the pull pill, the mic button over a line of words. Screenshot each with a throwaway `tests/e2e/zz_*.e2e.mjs` and delete it after.
- [ ] 1.4 Tests (`tests/e2e/a11y.e2e.mjs`, the 4.59.0 cover test): extend it to pause the show, run axe on the paused page, open Tools and run axe again, in all three palettes. In `gig.e2e.mjs`'s cover test, assert the Tools button's text colour is not the same as its background colour, in Festival.

## Step 2 [Sonnet] 4.61.0: The cover is the song's room, and bold on the page too

Where: `gig.js` (`coverOn`, `coverOff` from 4.59.0), `stage.js`, `app.js` (the song page draw and its `onLeave`), `styles.css`.

- [ ] 2.1 Move `coverOn(song)` and `coverOff()` from `gig.js` to `stage.js` and export them. `gig.js` imports them from there. No new file, so `sw.js` doesn't change.
- [ ] 2.2 `app.js`: when the song page draws a song, call `coverOn(song)` (it already does nothing without an https cover, D2). On leaving the song route, call `coverOff()` in the existing `onLeave` at the `teardownFold` line. A song that gets its cover while open (Get the song, Listen) calls `coverOn` again (look for `feelArrived` in `listen.js` as the hook).
- [ ] 2.3 `gig.js`: the Gig no longer turns the cover on or off; the page owns it. Remove `coverOn` and `coverOff` from `openGig` and `closeGig`.
- [ ] 2.4 On the paused page under the cover, the top part of the page (`.shead`, the chord tiles, the header note) reads on the dark set from step 1. Check the chord tiles (`.crow` tiles, `aria-label="X chord shape"`) and the "Mark as learning" pill.
- [ ] 2.5 Bold on the page (D3): `.sheet > :is(.pr, .ly)` gets `font-weight: 700` and `.sheet .c` 800 everywhere, not just under `body.staged`. Keep `.sheet.measure` at 800. The editor (writing mode) keeps its own weight: check `.ed-tx` isn't affected.
- [ ] 2.6 The stage light stays off under the cover (4.59.0), and the band stays soft white, now in plain Play too.
- [ ] 2.7 Tests: a song with a cover opens with `body.covered` on its page before Play; leaving to the Songbook removes it; a song without a cover never has it. Paused lyric weight is 700. Extend the step 1 axe sweep to the paused song page before any Play.
- [ ] 2.8 README: rewrite the 4.59.0 line so it says the cover is behind the whole song screen. docs/DATA.md: nothing new stored.

## Surprises

(none yet)
