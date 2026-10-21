# Clean-up plan (audit of 4.14.0, 2026-10-21)

Written by Opus after a read-only audit. Each task says who should do it:

- **[Sonnet]** mechanical, with the evidence already gathered here. Any model can do it; Sonnet is the intended one.
- **[Opus]** needs judgment while doing it, or a mistake would be hard to spot.

Tick a task's box in this file in the same commit that does it.

## Rules for whoever runs a task

1. Read CLAUDE.md first. Its standing rules still apply: plain writing with no em dashes, no ring controls, don't change how the search bar works, keys stay on the phone.
2. One task per commit. The commit message says what changed in plain words.
3. Before each commit, run `eslint .` and `node tests/quick.mjs`. Both must pass.
4. Before deleting anything, grep for the name across every `.js`, `.html` and `.css` file, including template strings such as `` `gl-${x}` `` and `lazy("x.js").then(m => m.name)`. If you find a use that this plan doesn't mention, don't delete it. Write what you found under "Surprises" at the end of this file and move on.
5. If a task doesn't match what you find (the line has moved, a name is different), stop that task and note it under "Surprises". Don't improvise.
6. App files changed (`*.js`, `*.css`, `index.html`): at the end of each **step** (below), bump the patch version once (`VERSION` in `core.js` and `CACHE` in `sw.js`, the next free 4.14.x). Then `git fetch origin main && git rebase origin/main` and push. Docs and tests only: no bump.
7. Don't run the full browser suite locally; CI runs it. Don't remake the visual references unless decision D1 below says yes.

## Decisions for Graham (answer before the steps that need them)

- **D1. Visual references.** CI compares screens against pictures made before 4.0.0, so that check has failed on every push since. Your rule was to wait 15 releases after 3.19.0, and it has been about 20. Remake them now? (Step 1, task 1.4.)
- **D2. The guitar pick.** Version 4 has no guitar-pick mascot, but two places still use the old pick:
  - The streak celebration is a burning pick (`profile.js`, `pickSVG`).
  - The Your playing share card draws `icons/pick-512.png`.

  Switch both to Louie? (Step 2, task 2.6.)
- **D3. Settings from before the Gig.** Play now opens the Gig, so these only apply to plain playing (practicing a section or slower, tabs, Full):
  - Stage mode (in a set)
  - Now and Next diagrams
  - The song map rail
  - Diagrams when paused
  - Speed as song length or 1x

  Keep them all, or retire some? (Step 4, task 4.4.)
- **D4. Splitting the two big files.** `app.js` is 179 KB and `core.js` is 236 KB, so every change reads a lot. Do you want them split into smaller files? (Step 5, which is optional.)

## What the audit found

- **CI has been red for 36 pushes, since 3.17.0.** Every push now fails for real reasons, so a new failure would go unnoticed.
  - The accessibility test fails in both looks: colour contrast on a few v4 screens, and the Lines in a gig buttons use `aria-pressed` on `role="menuitem"`.
  - The visual test fails because its references are from before 4.0.0.
  - The failure summary only shows its first 60 lines, so other failures may be hidden behind these.
- **Dead code.** These core.js functions are only used by tests:
  - `heardOffer` (Just heard it, replaced in 4.10.0)
  - `arcMap` (the ring's arc, removed in 3.19.0)
  - `sketchSong`, `judgeString`
  - `hexCentre`, `hexOutline`, `fitZoom`, `spotLabel` (old Tour Map maths)

  Also unused:
  - `dialOpen` (dial.js), `gigNow` (gig.js)
  - `SOON` and `renderSoon` in hud.js (an empty placeholder)
  - the `arcSweep` default setting
  - `data-tolex="off"`, set on every launch for a look that's gone, plus about 39 tolex rules in styles.css
- **styles.css is 277 KB.** The version 4 look sits on top of the version 2 and 3 styles and overrides them. Only about 9 KB of rules name classes that no longer exist, but much of the rest is overridden and never shows. Removing it safely needs a before-and-after picture check.
- **Old names in the app's own words:**
  - "Save to Library" in the paste card (`app.js` line ~738)
  - Settings text about "the library's title", and "your Tour Map (under Your playing)"
  - A test message about "the duet quest", which is now the Friend quest
- **Docs.**
  - CLAUDE.md's "Next up" list is 3.x history with wrong version numbers, the "Still to build" sentence lists only finished work, and the visual-reference count is stale.
  - The README is a changelog by version rather than a description of the app today.
  - DATA.md keeps every setting and field in one very long paragraph.
- **Tests.**
  - About 400 fixed `waitForTimeout` sleeps (about 190 seconds of waiting) in the browser tests. Some are real timers and must stay.
  - The harness sets `plainPlay: true`, so most tests never open the Gig, which is the main Play path in version 4.
  - `tests/quick.mjs` has no browser tests mapped for `road.js`, `duel.js`, `share.js`, `listen.js`, `playmap.js`, `scene.js`, `drawer.js`, `dial.js`, `crop.js` or `louie.js`, so changing them runs only the unit tests.
  - CI installs Chromium fresh on every run, and uses Node 20, which GitHub is retiring.

---

## Step 1 [Sonnet]: make CI tell the truth

- [x] **1.1 Show every failure.** In `.github/workflows/test.yml`, the "browser tests" step builds `msg` from the first 60 matching lines. Change it so that:
  - all `^not ok` lines come first, with no limit
  - then up to 40 lines of detail

  Test: push, and check that the run's annotation lists every failing test.
- [x] **1.2 Cache Chromium.** Add `actions/cache` for `~/.cache/ms-playwright`, keyed on `playwright-1.56.1-${{ runner.os }}`. Keep `npx playwright install --with-deps chromium`; with a cache hit it only installs the system packages. Do the same in `screens.yml`.
- [x] **1.3 Node.** Change `node-version: 20` to `22` in `test.yml` and `bump-version.yml`. Leave the action versions as they are.
- [x] **1.4 Visual check.** Do this only once Graham has answered D1.
  - If D1 is yes: dispatch `gh api -X POST repos/grahamdeno/tabs/actions/workflows/screens.yml/dispatches -f ref=main`, wait for its commit, then rebase.
  - If D1 is no: move `visual.e2e.mjs` into its own job with `continue-on-error: true`, so a stale picture doesn't turn the run red.
- [x] **1.5 quick.mjs coverage.** In `tests/quick.mjs`, add these to `COVERS`:
  - `"road.js": ["app"]`, `"duel.js": ["app"]`, `"share.js": ["app", "duet"]`
  - `"listen.js": ["app", "getsong"]`, `"playmap.js": ["app"]`, `"scene.js": ["app"]`
  - `"drawer.js": ["app"]`, `"dial.js": ["app"]`, `"crop.js": ["app"]`, `"louie.js": ["regress"]`

  No version bump for this step: no app files change.

## Step 2 [Sonnet]: remove dead code and fix old words

- [x] **2.1 core.js functions only tests use.** Delete each function, and the test lines or test that call it:
  - `heardOffer`
  - `arcMap` (and its comment block "The ring's arc")
  - `sketchSong`, `judgeString`
  - `hexCentre`, `hexOutline`, `fitZoom`, `spotLabel`

  Apply rule 4 to each one. If deleting one leaves a helper unused (eslint will say), delete that helper too.
- [x] **2.2 Small unused exports.**
  - Delete `export const dialOpen` (dial.js line ~146) and `export const gigNow` (gig.js line ~27).
  - In hud.js, delete `SOON`, `renderSoon` and the header comment line about it.
- [x] **2.3 Old settings.**
  - Delete `arcSweep` from `DEFAULT_SETTINGS` in core.js.
  - In `migrate()`, add `delete settings.arcSweep;` next to the other cleanups. Don't change `v`.
  - Delete the line `document.documentElement.dataset.tolex = "off";` in app.js `applyTheme`. Leave the tolex CSS for step 4.
  - In DATA.md, note that `arcSweep` is no longer used.
- [x] **2.4 Unused CSS classes.** Delete the rules in styles.css whose selectors use only these classes or ids:
  - `titlerow tfav vsep nnbtn gs-st ed-tools fsel coach-twice coach-line ph-swap oh oh-back sr-only`
  - `rd-next rd-meta rd-steps rd-go rd-map rd-turf rd-map-t rd-scrim rd-dbody rd-sizer rd-dh rd-dt rd-skip`
  - `rd-heard rd-h-art rd-h-t rd-sound tb-bg list-h lab-row gg-lc`

  Leave these alone (they're built in code or come from Leaflet): `t2`, `gl-*`, `pk-*`, `fin-*`, `leaflet-*`. In a rule that lists several selectors, delete only the dead selectors and keep the rest.
- [x] **2.5 Old names in the app's words.** Use these names: Library becomes **Songbook**, Tonight becomes **the Road**, the duet quest becomes the **Friend quest**.
  - `app.js` ~738: "Save to Library" → "Save to Songbook". Update any test that clicks it by text.
  - `settings.js`: the Playing page foot says each play "lights a hexagon on your Tour Map (under Your playing)". The Tour Map is in More now, so it should read "on your Tour Map (in More)".
  - `settings.js`: the Today page foot and the `s-nudge` aria-label say "the library's title" / "in the library". Change to "the Songbook's title" / "in the Songbook".
  - `tests/e2e/app3.e2e.mjs` ~511: the message "three setlist goals and the duet quest" → "three setlist goals and the Friend quest".
  - Don't change "Tonight's setlist" or "Tonight's set". Those are about the time of day.
- [x] **2.6 The pick.** Only do this if D2 is yes.
  - Share card (`profile.js` ~126): instead of `icons/pick-512.png`, draw Louie. Use `louie("cheer", { pose: "hornsUp", size: 172 })`, wrapped in an `<svg>` string with the Festival `--lv-*` colours written in as fill values (canvas can't read CSS variables). Load it as `new Image()` from a `data:image/svg+xml` URL, then `drawImage` in the same spot.
  - Then remove `icons/pick-512.png` from `SHELL` in sw.js and delete the file.
  - Leave the streak celebration for Opus (task 4.5).

Bump the patch version, push (rules 3 and 6).

## Step 3 [Opus]: real CI failures and review of steps 1 and 2

- [x] **3.1 Review the diffs of steps 1 and 2.** Check that nothing live was deleted.
- [x] **3.2 Accessibility.**
  - The Lines in a gig buttons (`app.js` ~1863): `role="menuitem"` with a pressed state isn't allowed. Use `role="menuitemradio"` with `aria-checked`, or drop the role.
  - Fix colour contrast in the v4 palettes for the places axe names:
    - `.rd-pop > p`
    - `.gl-verse > span` and `.secbar` gels
    - `#s-ver`, `#delset`, `#t-empty`, `#ed-delete`, `#tn-done`, `.skm-k`
    - the settings row `.val`
    - the Road's `div > small`

    Change colours as little as possible, and show Graham a before-and-after for any that visibly change.
- [x] **3.3 Check CI is green** apart from anything D1 leaves expected.

## Step 4 [Opus]: CSS, docs and settings

- [x] **4.1 Before-and-after picture check.** Write `tests/e2e/zz_css_guard.e2e.mjs`, kept until step 4.2 is done.
  - It screenshots about 25 screens in all three looks to `test-results/css-guard/<name>.png`: Road, Tour, Charts, Band, Rehearse, Merch, Try it on, Songbook, song paused, Tools, Gig, Gig paused, Show complete, Settings pages, editor, tuner, set, Your playing, Tour Map.
  - With `GUARD=compare`, it fails on any pixel difference.
- [x] **4.2 Remove the overridden styles from before version 4,** in small passes:
  - tolex
  - old palettes
  - glass and copper
  - duplicate `.btn.primary` and similar

  The guard must stay identical after each pass. Target: well under half of today's 277 KB.
- [x] **4.3 Docs.**
  - Rewrite CLAUDE.md: drop the 3.x "Next up" history, replace "Still to build" with what's actually open, fix the visual-reference note, and add the step and model routine from this plan.
  - Restructure the README: what the app does today first, then a short version history.
  - Then [Sonnet] reformat DATA.md into one short section per stored key. Facts unchanged, every key kept; check by listing the keys before and after.
- [x] **4.4 Settings inventory,** from D3. Retire what Graham says to, with a `migrate()` cleanup.
- [x] **4.5 The streak celebration,** if D2 is yes: redraw it around Louie on the design system.

## Step 5 [Opus, optional, only if D4 is yes]: split the big files

- [x] Split `app.js` into `library.js` (Library and paste card), `audio.js` (metronome, drums, bass) and `aihelp.js` (AI help). Keep the router and song screen in `app.js`.
- [x] Split `core.js` into topic files, re-exported from `core.js` so no import elsewhere changes.
- [x] Add each new file to `SHELL` in sw.js.

## Step 6 [Sonnet]: faster, steadier browser tests

- [ ] **6.1 Replace fixed sleeps with waits,** one test file per commit. Start with `settings`, then `playnext`, `german`, `strum`, `today`, `regress`, then `app`, `app2`, `app3`. Rules:
  - Replace `await page.waitForTimeout(n)` with a `waitForSelector` or `waitForFunction` for the thing the next line checks.
  - Keep any sleep that tests a timer: Play settling after 5 s, count-in, auto-scroll moving, a toast timing out, a long press. If unsure, keep it and add `/* real timer */`.
  - Run the changed file 3 times: `node --test tests/e2e/<file>.e2e.mjs`. If any run fails, revert that file's change.
- [ ] **6.2 Faster setup.** In `harness.mjs` `phone()`, replace `await page.waitForTimeout(300)` after the first `goto` with `await page.waitForLoadState("domcontentloaded")`. Run `app` 3 times.

## Step 7 [Opus]: test coverage and final review

- [ ] **7.1 Cover the Gig.** Most tests set `plainPlay: true`. Add a small set where it's false:
  - Play opens the Gig
  - Lines 4, 5, 6 and Full
  - pause and resume
  - Show complete with the merch tip and a Double set

  Fix the Gig test that flakes when the machine is busy.
- [ ] **7.2 Overlap.** Read app, app2 and app3 for tests that check the same path. Merge or delete duplicates, and list what went.
- [ ] **7.3 Final review** of everything, then delete this file's ticked steps or move it to `docs/history/`.

## Surprises

(Anyone running a task writes here what didn't match the plan.)

### Graham's answers (2026-10-21)

- D1: delay the visual remake until after Step 4 (tokens). Task 1.4 took the "no" path.
- D2: yes, replace the pick with Louie and an exciting animation (share card done in 2.6; streak celebration is task 4.5, Opus).
- D3: Opus decides as a senior UI/UX designer, lowest friction (task 4.4).
- D4: split if it makes sense (Opus judges in Step 5).

### Notes from Steps 1 and 2 (Sonnet 5.5, released as 4.14.1)

- 1.4: the visual test runs as its own step with `continue-on-error: true` inside the browser job, not as a separate job. Same effect: a stale picture no longer turns the run red.
- `sketchSong` in core.js was kept. Six live tests use it to build fixtures. Opus: decide whether to move it into a test helper.
- Orphans removed along the way: `HEARD_FOR`, `mercator` (and its test), the `.soon*` CSS, `SOON`/`renderSoon` and unused imports in hud.js, `dialOpen`, `gigNow`, 82 unreferenced CSS rules.
- More functions only tests use, left alone for Opus: `hexNeighbours`, `localBar`, `playsForCells`, `zOf`.
- styles.css has a stray `}` near line 1279 (already in 4.14.0). The next rule, `.tn-note.done.glow b`, is dropped by browsers. Fixing it would change how the tuner looks, so it is left for Opus (task 4.2).
- `.pk-level.soon` CSS is live and was kept.
- The streak celebration still draws the old pick (`pickSVG`, `sk-pick`). Task 4.5.

### Notes from Step 3 (Opus 5.5, released as 4.14.2)

- 3.1: no live use of anything removed in Steps 1 and 2 (names grepped across js, html, css and tests; removed CSS classes checked against template strings).
- 3.2: axe-core can't be installed in the cloud sandbox (npm registry unreachable), so contrast was checked with a probe that does the same maths, then confirmed in CI.
  - New `--accent-ink` token: the accent as text. Same as the accent in Neon; deeper pink (#C21B57) in Festival and deeper red (#B03228) in Green Room. All 121 `color: var(--accent)` rules use it, so chord names and setting values are a deeper pink in Light.
  - Festival `--bad` is a touch darker (#C42037); the Road banner's small line is white in Light; the Verse gel has dark letters (Green Room keeps white on a deeper teal).
  - Paused, the sheet no longer dims other lines (it was below 2:1). Dimming happens only while playing; the current line keeps its emphasis either way.
  - Lines in a gig buttons: `role="menuitemradio"` with `aria-checked`.
  - Found while checking: Settings said "Library and backups"; now "Songbook and backups".
- CI's other two failures: German practice's test expected German not to be in Tools, but 4.2.0 put it there on purpose; test updated. The Gig test passes locally every time, so the CI failure is likely timing; the CI summary now prints each failure's location and message to pin it down.
- Not checked by CI: Green Room contrast (the a11y test runs dark and light only). The Green Room banner (white on #0F8B8D, 4.1:1) is slightly low.

### Notes from Step 4 (Opus 5.5, released as 4.15.0)

- 3.3: CI after 4.14.2 had one failure left, the Gig test reading the save before it landed on GitHub's slower machines; it now waits for the save. Check the run after 4.15.0.
- 4.1: the guard took 84 screenshots (about 28 screens, three looks) and compared them with a mask built from two baseline runs, so moving things (toasts, the Tour Map, computer players' XP) don't count. The Tour Map was left out (it's drawn, not styled). Guard files are kept in the session scratchpad, not the repo.
- 4.2: styles.css went from 271 KB to about 245 KB, every guarded screen identical:
  - 681 declarations that can never win were removed: a later rule with the same selector, or a version 4 rule whose selector matches every element the old one does and outranks it (data-look is always set), sets the same property.
  - The tolex covering rules, Stage mode's styles, and comments for removed features went.
  - The stray `}` is gone, so the tuner's "All in tune" green glow now shows as it was meant to.
  - Surprise: the target of "well under half" isn't reachable safely. Most of the remaining older rules are live: version 4 redraws the amp materials (copper, plate, recess, lamps, glass) by redefining their variables, so those rules still paint today's screens. Shrinking further means restyling those components on the design system, screen by screen, with a mockup for Graham. Worth a release of its own if the file size starts to hurt.
- 4.3: CLAUDE.md drops the 3.x history, lists what's open, fixes the visual note and adds the plan-with-Opus routine. The README leads with what the app does today (42 KB to 18 KB) with a short version history. DATA.md reformat is left for Sonnet (it only gained a line about the retired settings).
- 4.4 (D3, decided as a low-friction designer): retired Stage mode (the Gig is the stage; the set's Stage chip went too), Song map and Diagrams when paused (both always on now). Now and Next stays, in Tools only. Focus current line moved to Playing, so the Chord diagrams page is gone (8 settings pages). Speed style stays: each song saves its speed in one style or the other, so removing it would change saved songs. `migrate()` drops `stage`, `songMap` and `pauseDiagrams`.
- 4.5: the streak celebration is around Louie: the streak colour floods the screen (Neon uses cyan so pink Louie shows), rays turn, Louie drops and squashes on landing, a flame that grows with the tier and confetti burst, the count rolls up and the week fills in. The share picture is Festival colours with Louie. The old pick, neck and fireworks drawing and their styles are gone.
- Visual references: remake them now (D1 said after Step 4).

### Notes from Step 5 (Opus 5.5, released as 4.15.1 and 4.15.2)

- core.js 232 KB to 75 KB; eight topic files in core/ (chords 19, recording 13, sketch 25, playing 13, groove 13, turf 15, neck 12, game 45 KB). core.js re-exports all 299 names it had; six small helpers (DAY, dayKey, isObj, norm, playDays, pruneDays) are newly exported for the topics.
- app.js 178 KB to 116 KB: library.js (38 KB, with the four search and filter state variables and leaveSearch, so only it writes them), audio.js (17 KB), aihelp.js (9 KB). app.js exports everything it did.
- The split was done by a parser (acorn) that lists each section's definitions, what it uses from elsewhere, what it writes and what runs at load. No section reads another's values at load, so the files import each other safely.
- The import test now reads core/ and resolves "../" paths; ESLint covers core/*.js; quick.mjs maps the new files.
- Flaky: "a bass riff: drawn in Edit" fails in the parallel quick run but passes alone, before and after the split. A Step 6 candidate.
- app.js could split further (the song menu, the tuner glue, Speed, Practice a section). Not needed now.
