# Louie Road Ready: build plan for Claude

Graham tells Claude one line per step, in the order below: "Do docs/road-ready/claude-prompt-0N-*.md". Each step is one small pull request he can review, test on his phone and merge before the next. Every prompt names the spec sections and the images in `docs/road-ready/images/` to read.

## What the repo really is (read before step 01)

- The app is **grahamdeno/tabs** ("Louie: Learn Guitar"), a **plain JavaScript PWA** with no build step, live on GitHub Pages from `main`. It is not SwiftUI. The round 10 spec's SwiftUI notes are translated in every prompt to HTML, CSS and SVG (a table at the end of each prompt).
- The files that matter: `road.js` (the Road), `fretboard.js` (each leg drawn as a guitar neck with stops), `louie.js` (Louie drawn in SVG), `hud.js` (stat bar, tab bar, More sheet), `gig.js` and `stage.js` (playing and Show complete), `library.js` (Songbook), `profile.js` (Me), `merch.js` and `MERCH` in `core/game.js` (Merch table), `styles.css` (its "Version 4 look" section holds the palettes), `art/guitars/` (guitar pictures), `vendor/fonts/` (fonts, served locally because of the Content Security Policy).
- `CLAUDE.md` in the repo has Graham's standing rules (plain writing, versions, tests, one-handed use, the plan-with-Opus format). Every prompt tells Claude to read it.
- Branches: CLAUDE.md says releases push to `main`. For this redesign the prompts ask for one branch and one PR per step and no push to `main`, so each step can be reviewed. Every prompt also carries the rule: in the Louie Lite repo (grahamdeno/louie-lite), push only to `lite-3`.

## Build order

| Step | Prompt file | Model | What it does | Main files | Needs |
|---|---|---|---|---|---|
| 01 | `claude-prompt-01-tokens.md` | Sonnet | Road Ready colour tokens (dark and light), type scale in rem with iPhone text-size scaling, spacing and radii, Space Grotesk, Inter and IBM Plex Mono, tolex and grille-cloth surfaces in code, the cream plate button, and the plan file | `styles.css`, `vendor/fonts/`, `ui.js`, `docs/ROAD-READY-PLAN.md` | nothing |
| 02 | `claude-prompt-02-road.md` | Opus | The Road: header strip (venue plate, Tune, Tips, Tonight), pearl inlay stops in four states, the curved amber connector, the callout, Louie peeking in | `road.js`, `fretboard.js`, `styles.css`, `art/louie/` | 01 |
| 03 | `claude-prompt-03-louie.md` | Opus | Louie redrawn in code as Road Ready: one mouth on the panel, plain grille, mittens without fingers, no cheeks, locked palette | `louie.js`, `styles.css` | 01 |
| 04 | `claude-prompt-04-tab-bar.md` | Sonnet | Floating grille-cloth tab bar with five custom icons: Road, Songbook, Rehearse, Tour, Me (or a reskin of today's six) | `hud.js`, `profile.js`, `styles.css` | 01 |
| 05 | `claude-prompt-05-playing.md` | Opus | Immersive playing screen: big lyrics, amber chords, hairline progress, controls that hide after 3 s but never on keyboard focus, a "keep controls on screen" setting, the first-run hint | `gig.js`, `stage.js`, `settings.js`, `styles.css` | 01, 03 |
| 06 | `claude-prompt-06-show-complete.md` | Sonnet | Show Complete: glow version for a show, case version for a new guitar, reward tiles, plate buttons | `gig.js`, `road.js`, `styles.css` | 01, 03 |
| 07 | `claude-prompt-07-songbook.md` | Sonnet | Songbook rows, chips, search and the Louie face-badge hint | `library.js`, `styles.css` | 01, 04 |
| 08 | `claude-prompt-08-me.md` | Sonnet | Me: header, stat tiles, the guitar case, rows for band, charts and the tip jar | `profile.js`, `styles.css` | 01, 03, 04 |
| 09 | `claude-prompt-09-merch-builder.md` | Opus | Guitar art to the rounded 3+3 headstock, then the Merch builder; writes a sub-plan and waits for Graham's go first | `core/game.js`, `merch.js`, `fretboard.js`, `art/guitars/` | 01 to 06 |

Steps 02 and 03 can run in either order. Steps 03 and 04 can run side by side on separate branches.

## Decisions Graham makes before pasting (they are tick boxes in the prompts)

1. **Step 01:** Road Ready replaces the free Dark and Light looks (default), or becomes a fifth look.
2. **Step 02:** fans and streak leave the Road header (default); Louie's line stays in a small bubble (default); the book button goes (default).
3. **Step 04:** the five design tabs, moving Charts, Band, Settings and Support onto Me (default), or keep today's six tabs.
4. **Step 07:** show two mastery levels with dots (default), or add a third level later.
5. **Step 09:** approve the guitar-to-venue mapping and the data change in Claude's sub-plan.

## Found in the repo that changes the plan

- **Web app, not SwiftUI.** All prompts target JS, CSS and SVG. "Dynamic Type" becomes rem sizes from `-apple-system-body`; "VoiceOver is running" can't be detected on the web, so step 05 adds a setting and never hides controls that have focus.
- **Louie's mouth is on the grille today.** `louie.js` says "the speaker for a mouth" and draws cheek spots and hands with fingers. Step 03 fixes all three. Until it merges, the Road uses the peek image so the Road is right from step 02.
- **Six tabs today, five in the design.** Step 04 asks Graham to choose.
- **Guitars use several headstocks today** (`inline` is a six-in-line). Step 09 moves them to our rounded 3+3.
- **Venue names differ.** The app has Garage, Open mic, Coffeehouse, Club, Theater, Arena, Stadium, Festival headliner. The spec lists Coffeehouse, Corner Pub, Club, Theater, Arena, Stadium. The prompts keep the app's names; renaming is Graham's call.
- **Two guilt mechanics exist in the game logic,** outside this visual work: fans fade on idle days and a venue can be lost (`fameSettle`), and Louie's line can say "Your crowd is thinning at the ... Play a song tonight to keep it." The spec says no guilt. The prompts tell Claude not to touch game logic, so Graham should decide these separately.
- **Louie's finishes are sold on the Merch table,** but the spec locks his palette. Step 03 keeps the code and flags it.
- **The Gig already hides its controls after 3 s** (`bindIdle()` in `gig.js`), so step 05 is a restyle plus accessibility fixes, not a rebuild.
- **The local checkout is behind.** `/workspace/tabs-am-ro` is 75 commits behind `origin/main` (the app is at 4.96.1). The audit read `origin/main`. Claude should always start from a fresh `origin/main`.
- **No `lite-3` branch in tabs.** `lite-3` is in a separate repo, grahamdeno/louie-lite. The prompts carry the rule in case Graham runs them there.
