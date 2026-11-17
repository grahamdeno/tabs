# Louie Road Ready: build plan for Claude

Graham tells Claude one line per step, in the order below: "Do docs/road-ready/claude-prompt-0N-*.md". Each step is one small pull request into the `road-ready` branch. Opus reviews it, then Graham gives the merge go before the next step starts. Every prompt names the spec sections and the images in `docs/road-ready/images/` to read.

## What the repo really is (read before step 01)

- The app is **grahamdeno/tabs** ("Louie: Learn Guitar"), a **plain JavaScript PWA** with no build step, live on GitHub Pages from `main`. It is not SwiftUI. The round 10 spec's SwiftUI notes are translated in every prompt to HTML, CSS and SVG (a table at the end of each prompt).
- The files that matter: `road.js` (the Road), `fretboard.js` (each leg drawn as a guitar neck with stops), `louie.js` (Louie drawn in SVG), `hud.js` (stat bar, tab bar, More sheet), `gig.js` and `stage.js` (playing and Show complete), `library.js` (Songbook), `profile.js` (Me), `merch.js` and `MERCH` in `core/game.js` (Merch table), `styles.css` (its "Version 4 look" section holds the palettes), `art/guitars/` (guitar pictures), `vendor/fonts/` (fonts, served locally because of the Content Security Policy).
- `CLAUDE.md` in the repo has Graham's standing rules (plain writing, versions, tests, one-handed use, the plan-with-Opus format). Every prompt tells Claude to read it.
- Each prompt is a handoff in the playbook format (grahamdeno/playbook `templates/handoff.md`): the steps that can't be undone come first, then what to read, the branch, "Always review: yes", Touch and Don't touch, "Confirm with Graham" questions where the spec conflicts with an earlier decision, and a "Done when" list with the playbook's PR format.

## Branches and release

- All Road Ready work collects on one integration branch, **`road-ready`**, cut from `main`. Step 01 creates it if it doesn't exist.
- Each step uses its own branch (`rr-01-tokens`, `rr-02-road` and so on) cut from `road-ready`, and opens one PR **into `road-ready`**, never into `main`.
- Each step needs the step before it merged into `road-ready`.
- **No step bumps the version.** When Graham says ship, `road-ready` goes to `main` as one release, and VERSION and CACHE are bumped once then. This replaces CLAUDE.md's "push to main" for this redesign and matches the playbook's one-big-release rule.
- In the Louie Lite repo (grahamdeno/louie-lite), pushes go only to `lite-3`.

## Who builds and who reviews

- The model named in each prompt builds (Sonnet or Opus).
- Opus reviews every PR before Graham's merge go (a separate Opus conversation when Opus built it), recording findings by severity as `sonnet-trust.md` says.
- Graham gives the merge go into `road-ready`. Merge, test build and ship are separate go-aheads.

## Build order

| Step | Prompt file | Model | What it does | Main files | Needs |
|---|---|---|---|---|---|
| 01 | `claude-prompt-01-tokens.md` | Sonnet | Road Ready colour tokens (dark and light), type scale that follows the iPhone text size (reusing the app's existing measurement), spacing and radii, Space Grotesk, Inter and IBM Plex Mono converted to woff2, Festival Poster and Neon Midnight renamed and the status bar colour updated, tolex and grille-cloth surfaces in code, the cream plate button, and the plan file | `styles.css`, `vendor/fonts/`, `app.js`, `core/game.js` (look names), `settings.js`, `index.html`, `docs/ROAD-READY-PLAN.md` | nothing (creates `road-ready`) |
| 02 | `claude-prompt-02-road.md` | Opus | The Road: header strip (venue plate, Tune, Tips, Tonight), pearl inlay stops in four states, the curved amber connector, the callout, Louie peeking in | `road.js`, `fretboard.js`, `styles.css`, `art/louie/` | 01 |
| 03 | `claude-prompt-03-louie.md` | Opus | Louie redrawn in code as Road Ready: one mouth on the panel, plain grille, mittens without fingers, no cheeks, locked palette | `louie.js`, `styles.css` | 02 |
| 04 | `claude-prompt-04-tab-bar.md` | Sonnet | Floating grille-cloth tab bar with custom icons. Asks Graham first: the spec's five tabs (Road, Songbook, Rehearse, Tour, Me) or today's six, which he said in October would stay | `hud.js`, `profile.js`, `styles.css` | 03 |
| 05 | `claude-prompt-05-playing.md` | Opus | Immersive playing screen: big lyrics, amber chords, hairline progress, controls that hide after 3 s but never on keyboard focus, a "keep controls on screen" setting, the first-run hint | `gig.js`, `stage.js`, `settings.js`, `styles.css` | 04 |
| 06 | `claude-prompt-06-show-complete.md` | Sonnet | Show Complete: glow version for a show, case version for a new guitar, reward tiles, plate buttons. Asks Graham before dropping the worn backdrop | `gig.js`, `road.js`, `styles.css` | 05 |
| 07 | `claude-prompt-07-songbook.md` | Sonnet | Songbook rows, chips, search and the Louie face-badge hint | `library.js`, `styles.css` | 06 |
| 08 | `claude-prompt-08-me.md` | Sonnet | Me: header, stat tiles, the guitar case, rows. Asks Graham to confirm labels that keep game tips and the real-money tip jar apart | `profile.js`, `styles.css` | 07 |
| 09 | `claude-prompt-09-merch-builder.md` | Opus | Guitar art to the rounded 3+3 headstock, then the Merch builder added next to the existing items (hats, gear, Louie's finishes, looks and backdrops stay unless Graham says otherwise); writes a sub-plan and waits for Graham's go first | `core/game.js`, `merch.js`, `fretboard.js`, `art/guitars/` | 08 |

The steps run one after another, each on top of the last one merged into `road-ready`.

## Questions Claude asks Graham before building ("Confirm with Graham" in the prompts)

Graham doesn't edit the prompts. Where the spec conflicts with an earlier decision or a choice is open, the prompt tells Claude to stop and ask, with a proposal.

1. **Step 01:** Road Ready replaces the free Dark and Light looks (proposal), or becomes a fifth look.
2. **Step 02:** fans and streak in the Road header, Louie's line, and removing the book button.
3. **Step 04:** the spec's five tabs or today's six. In October Graham said the tab bar stays.
4. **Step 06:** keep the worn backdrop and Change on Show Complete (proposal), since backdrops aren't in the spec.
5. **Step 07:** two mastery levels with dots (proposal), or a third level later.
6. **Step 08:** labels and placement that keep "$411 tips" game money clearly apart from the real-money "Tip jar for Louie".
7. **Step 09:** keep every existing Merch item (hats, gear, Louie's finishes, looks, backdrops) and add the builder next to them (proposal); approve the guitar-to-venue mapping and the data change.

## Found in the repo that changes the plan

- **Web app, not SwiftUI.** All prompts target JS, CSS and SVG. "Dynamic Type" becomes type tokens that scale with the iPhone text size the app already measures; "VoiceOver is running" can't be detected on the web, so step 05 adds a setting and never hides controls that have focus.
- **Louie's mouth is on the grille today.** `louie.js` says "the speaker for a mouth" and draws cheek spots and hands with fingers. Step 03 fixes all three. Until it merges, the Road uses the peek image so the Road is right from step 02.
- **Six tabs today, five in the design,** and in October Graham said the tab bar stays. Step 04 asks him.
- **Green Room is a light look and Headliner a dark one,** so styles keyed on `data-theme` reach them too. Every Road Ready style is keyed on `data-look` (`neon`, `festival`) only, and a step 01 test checks Green Room and Headliner don't get Road Ready tokens.
- **Old look names and status bar colours.** The Merch table and Settings say "Festival Poster" and "Neon Midnight", and `theme-color` uses the old indigo and sky blue. Step 01 renames them and switches to Road Ready colours.
- **The app already measures the iPhone text size** (`readSysText()` in `app.js`), and `sw.js` already caches `vendor/` files for offline use after the first load. Step 01 reuses both. The font source has only TTFs, so step 01 converts them to woff2.
- **The Merch table has more than the spec shows** (hats, gear, Louie's finishes, looks, backdrops). Nothing is removed without Graham's yes (steps 06 and 09).
- **Game tips and the real tip jar** would sit on the same Me screen. Step 08 asks Graham to confirm clearly different labels.
- **Guitars use several headstocks today** (`inline` is a six-in-line). Step 09 moves them to our rounded 3+3.
- **Venue names differ.** The app has Garage, Open mic, Coffeehouse, Club, Theater, Arena, Stadium, Festival headliner. The spec lists Coffeehouse, Corner Pub, Club, Theater, Arena, Stadium. The prompts keep the app's names; renaming is Graham's call.
- **Two guilt mechanics exist in the game logic,** outside this visual work: fans fade on idle days and a venue can be lost (`fameSettle`), and Louie's line can say "Your crowd is thinning at the ... Play a song tonight to keep it." The spec says no guilt. The prompts tell Claude not to touch game logic, so Graham should decide these separately.
- **Louie's finishes are sold on the Merch table,** but the spec locks his palette. Step 03 keeps the code and flags it.
- **The Gig already hides its controls after 3 s** (`bindIdle()` in `gig.js`), so step 05 is a restyle plus accessibility fixes, not a rebuild.
- **The local checkout is behind.** `/workspace/tabs-am-ro` is 75 commits behind `origin/main` (the app is at 4.96.1). The audit read `origin/main`. Claude should always start from a fresh `origin/main`.
- **No `lite-3` branch in tabs.** `lite-3` is in a separate repo, grahamdeno/louie-lite. The prompts carry the rule in case Graham runs them there.
