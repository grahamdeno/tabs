# Road Ready plan

Road Ready is the new look for Louie: dark tolex, grille cloth, chrome piping, cream engraved plates and warm amber, set in Space Grotesk, Inter and IBM Plex Mono. The spec is `docs/road-ready/louie-design-spec.md`. Each step has a prompt in `docs/road-ready/claude-prompt-NN-*.md`.

## Graham's answers (top)

- 2026-11-17: **Road Ready replaces the two free looks.** Dark (data-look `neon`) becomes Road Ready dark. Light (data-look `festival`) becomes Road Ready light. Green Room and Headliner stay on the Merch table as they are. Look ids, prices and kinds are unchanged; only the names and the look change.
- 2026-11-17, step 02 (the Road): **fans and streak stay on the Road**, as an incentive: a Fans pill in the header that shows the streak while there is one (never a 0 or a lost streak). **No tuner on the Road**: you tune where you play (More and the song screen). **Louie's one line stays.** **The book button (Rehearse) goes**, since Rehearse is a tab.
- 2026-11-17, after the step 03 review: **Louie has hands with fingers, blue Tolex like his arms**, not mittens (replaces the mitten rule). No hand ever shows one finger standing straight up, since it reads as the middle finger (4.39.1). **Louie is Grok's painted art at every size**; the code drawing stays as a fallback. **Sleepy is redrawn by Grok** (it read as bored).
- 2026-11-17, step 04 (the tab bar): **Option A, five tabs** in this order: Road (`#/`), Songbook (`#/library`), Rehearse (`#/practice`), Tour (`#/tour`), Me (`#/you`). The More sheet goes away from the tab bar. Charts, Your band, the Merch table, the Tuner and Support Louie become plain rows at the top of Me's list, and Settings becomes a gear button at the top right of Me. `#/band`, `#/charts`, `#/merch`, `#/support` and `#/settings` stay as pages with a back button.
- 2026-11-17, step 04 (the tuner): **the tuner stays on the song screen, and there is a Tuner row on Me.** There is no Tune button on the Road. The Road header from step 02 stays as it is. The "not tuned lately" dot moves from the More tab to the Me tab and to the Tuner row.
- 2026-11-18, step 05 (playing): **Pause only** on the show, no Speed or Loop (79). **The three line sizes (80) and lyrics snapping by line under Reduce Motion (81) wait for a later step of their own**, since both touch how the show reads where the song is. **No crowd row and no section pill** in the Road Ready looks, so the words fill the screen; **the NOW chord card and the run counter stay** (83).
- 2026-11-18, step 06 (Show complete): **no backdrop on Show complete in Dark and Light.** Graham left the choice to Claude and noted that no one else has bought a backdrop yet. Green Room and Headliner keep the backdrop and Change; backdrop items and stored data are unchanged. Step 09 decides what backdrops become.
- 2026-11-18, step 07 (the Songbook): **three mastery levels now**, Learning, Solid and Nailed it, while there are no users and it costs least. Solid is stored as a new value, `solid`; `learning` and `got` stay as they are, so nothing is converted and old backups load. Got it is called Nailed it everywhere it shows.
- 2026-11-18, step 07 (Graham left these to Claude's judgement): **search stays at the bottom** of the Songbook, in thumb reach and where the Road's search sits (114). **No Tuner in the Road Ready Songbook**: you tune on the song screen and Me, as decided in step 04 (115). **Solid keeps the literal meanings**: Solid means you can play it through, so it plays at full speed and isn't in the Learning filter, set or Rehearse's Learning card (118). **"Nailed it" on Your profile stays** (119).
- 2026-11-18, step 08 (Me): game money and real money stay apart. Graham left the choice to Claude. The Merch row is the only place on Me with the coin and a $ amount ("Spend your game tips: $411 at the Merch table"); real money is a separate "Support the app" section with one row, "Support Louie on Ko-fi (real money, optional)", a heart, no coin and no amount; the word "tips" is never on the real-money row.

## Branches

- All Road Ready work collects on the integration branch `road-ready`, cut from `main`.
- Each step uses its own branch (`rr-NN-name`) from a fresh `origin/road-ready` and opens one pull request into `road-ready`. Nothing merges without Opus's review and Graham's merge go.
- `main` gets the whole redesign as one release, with one version bump (VERSION and CACHE together), only on Graham's ship go. Until then VERSION and CACHE stay as they are in every step.

## Steps

| Step | What | Model |
|---|---|---|
| 01 | Tokens, fonts and surfaces | [Sonnet] |
| 02 | The Road | [Opus] |
| 03 | Louie in code | [Opus] |
| 04 | Tab bar and icons | [Sonnet] |
| 05 | Playing | [Opus] |
| 06 | Show Complete | [Sonnet] |
| 07 | Songbook | [Sonnet] |
| 08 | Me and the guitar case | [Sonnet] |
| 09 | Merch builder and guitar art | [Opus] |

Rules for whoever runs a step: one task per commit, `eslint .` and `node tests/quick.mjs`, push only the step's branch. When something doesn't match the plan, stop that part and write it under Surprises.

### Step 01 status

Built on `rr-01-tokens`: 27 `--rr-*` colour tokens for dark and light, type, spacing and radii tokens, the tolex and grille-cloth surfaces, the plate and capsule buttons, the look renames, the status bar colours, `axOf` with `--sys-px` and `data-ax`, and fonts vendored in `vendor/fonts/` (Space Grotesk 500 to 700, Inter 400 to 700, IBM Plex Mono 600, with licences).

### Step 02 status

Built on `rr-02-road` (Opus): the header strip, pearl inlays in four states, the amber connector, the callout and Louie peeking, in Road Ready dark and light. Green Room and Headliner keep the old Road. Surprises 10 to 21 below.

### Step 03 status

Built on `rr-03-louie` (Opus): Louie redrawn as Road Ready in `louie.js`, with the same `louie(mood, { pose, size })`. One mouth on the yellow panel, a plain grille, mittens, no cheeks, a locked palette in every look and a warm rim on the dark looks. The guitarist keeps the old hands through `GUITARIST_HANDS`. Surprises 30 to 39 below.

### Step 04 status

Built on `rr-04-tabs` (Opus, with Sonnet's fixes): five tabs, Road, Songbook, Rehearse, Tour and Me, in a grille-cloth bar; the More sheet's places are rows on Me. Surprises 49 to 59 below.

### Step 05 status

Built on `rr-05-playing` (Opus): the playing screen in Road Ready dark and light. The words on the plain base in the lyric colours, amber chords, the amber bar beside the line you're on, a 2 px progress line, the song's title at the top, Pause as a big amber button, the hiding made safe for keyboards, screen readers and switches, "Keep playing controls on screen" in Settings, and the first-run hint. Surprises 79 to 90 below; 79, 80, 81 and 83 need Graham.

### Step 06 status

Built on `rr-06-show-complete` (Opus): Show complete in Road Ready dark and light (the guitar of the leg you are on with an amber glow and sparks, the cheering Louie, reward tiles, the next venue, Continue and Play it again, then the crowd, stars, the song you played and the list), and the new-guitar sheet as the guitar in an open case with chrome L corners. Green Room and Headliner keep both screens. Surprises 101 to 108.

### Step 07 status

Built on `rr-07-songbook` (Opus, from the Sonnet prompt on Graham's say-so): the third mastery level and the Songbook in Road Ready dark and light (title with a round Add and no Tuner, capsule filters with Sets last, the Today strip in a banner with Louie's face badge, a card per song with an art tile, chord chips, a needs tag and mastery dots). Green Room and Headliner draw the earlier Songbook (pixel-identical with motion off). Reviewed (Claude Fable 5.2, 2026-11-18): pass with three small fixes, Surprises 126 to 132. Waiting for Graham's merge go.

### Step 08 status

Built on `rr-08-me` (Sonnet): Me in Road Ready dark and light (player header with the level bar, three tiles, the guitar case with the Merch row, Milestones as plates, five rows, then Support the app on its own). Green Room and Headliner keep the earlier page. Surprises 133 to 144. Reviewed (Claude Opus 5.5, Louie Product, 2026-11-18): pass, no fixes; decisions on 136 to 144 and two small notes below (145, 146). Waiting for Graham's merge go.

Merged into `road-ready` on Graham's go, 2026-11-18: PR #97 at `a90fb77` (CI test and browser passed), merge commit `15cfd87`. Reviewed by Claude Fable 5.2 (pass with fixes).

## Surprises

Found while building step 01. Each needs a decision or a look from Opus or Graham.

1. **`index.html` carries `data-look="neon"` on `<html>`.** The prompt did not ask for it. It makes the first paint use Road Ready dark before the script applies the saved look. Remove it if you would rather the first paint stay unstyled.
2. **Manifest colours are unchanged.** `manifest.webmanifest` still has its old `theme_color` and `background_color`. The meta `theme-color` and the in-app status bar colours are updated (`#141210` dark, `#F6EFE2` light). **Fixed in review: set to #141210.**
3. **`merch.js` SWATCH.** The Merch table's swatches for the two renamed looks still show the old palette colours. Left alone because it is outside this step. Decide whether the swatches should show the new base colours. **Fixed in review: swatches now start with the Road Ready base colours.**
4. **Tap tempo chip moved while tapping.** With the new fonts the chip label "Tap 3 more" is wider than "Tap", so the chip wrapped to the next row and the thumb lost it (the test "an Apple Music link sets the song's length; tapping sets the tempo" caught it). Fixed in CSS: `.ed-tap` has a minimum width of 9.5em and centres its label. A new test in `roadready.e2e.mjs` checks the chip's position does not change.
5. **Existing tests changed.** `settings.e2e.mjs` (new look names and the two status bar colours), `app3.e2e.mjs` (two assertions now expect Space Grotesk instead of Fredoka). No assertion was weakened.
6. **Contrast is checked from `styles.css`, axe not run locally.** The a11y test (axe) could not run here because axe-core is not installed and package installs are off. CI runs it.
7. **Fonts built with a stand-in.** The woff2 files were made with fontTools and a Node brotli stand-in because the `brotli` Python module was missing. They are standard woff2 and the tests check the header, size and licences. **Fixed in review: replaced with IBM's official unmodified Latin-1 SemiBold woff2 from IBM/plex (the licence reserves the name "Plex"), no renaming needed. Space Grotesk and Inter are still the fontTools builds with the Node brotli stand-in; they are valid woff2.**
8. **`CLAUDE.md` named Festival Poster and Neon Midnight.** Step 01 left it alone and put suggested wording in the PR. **Fixed in review: Graham said yes, and `CLAUDE.md` now describes Light and Dark as Road Ready.**
9. **`--mono` was also used by tab blocks, the editor and chord charts.** Fixed in review: `--mono` stays the system font, and Plex Mono is `--readout`, for the tuner and tempo in later steps.

Found while building step 02.

10. **Green Room and Headliner keep the old Road.** The new markup can't leave those looks "exactly as before", so `renderRoad()` draws the Road Ready Road only when `data-look` is `neon` or `festival`, and the old one otherwise. The book button is removed from the Road Ready header only; the old Road keeps it. Decide whether the two other looks should get the new Road later.
11. **`statBar()` also settles Rain checks and fading fans.** The Road no longer calls it, so `hud.js` now has `settleStats()` (the settling, called by `statBar()` and the Road) and `statNotices()` (the toasts). `statBar()` itself behaves as before.
12. **The header differs from spec 5.5 on Graham's answers.** No Tune button; a Fans pill (fans, with the streak under it while there is one). Two rows: the plate and Tips, then Tonight and Fans. In the page, and to a screen reader, the order is plate, Fans, Tips, Tonight.
13. **Louie's line sits under the strip, not above Louie.** Beside the neck there is about 125 px, so his lines would need four or more lines there. Under the strip it is real text, in reading order after the header.
14. **The callout is always on the right of the neck.** The neck is narrow, so the right side fits every stop, and the left side is where Louie peeks in. The prompt said to flip it for stops on the right.
15. **Header colours in light.** The prompt said dark tolex in both looks, but `--tolex` is cream in light, which matches `r10-02`; used `--tolex`. Tonight uses `--rr-card` as the prompt says (cream in light), where `r10-02` shows a dark bar.
16. **Every inlay is pearl.** The old Road drew each guitar's own inlay shape and material (blocks, stars, abalone). Road Ready follows the spec: pearl dots, the trapezoid, the crate and the double. Step 09 (guitar art) may want them back.
17. **The headline show while it is current** has no state in the spec: both dots glow in the current pearl, the left with the number and the right with an engraved star.
18. **The songs chip** reads "2 songs" in words on stops ahead only; the current stop's callout says it instead.
19. **The Songbook bar** along the bottom of the Road is not in the mockups (step 04 puts Songbook in the tab bar). Left as it is.
20. **Opening night shows the word "undefined"** in its first pick on a fresh install: `OIC` in `road.js` has no icon for the "who" step. It is on `main` today, not from this step. Not fixed here; it needs Graham's go.
21. **Existing tests changed:** `app3` (the old Road's home test and the box-material test now run in Green Room; the box, headline, Rain check and Tonight checks read the new header and pearls), `opening` (the stat-bar labels test runs in Green Room), `practice` (the Rehearse button test runs in Green Room), `profile` (opens your profile from Fans), `guitarist` (Louie's picture and `#rd-bubble`). Ids gone from the Road Ready Road: `h-streak` (the streak is in `h-fans`), `rd-book`, and the `.hud`, `.rd-banner`, `.rd-chip` and `.rd-say` blocks. Kept: `h-venue`, `h-fans`, `h-tips`, `rd-tonight`, `rd-bubble`.

Found in the review of step 02 (2026-11-17, a separate conversation, Claude Fable 5.2).

22. **Nothing tested that Louie's pictures are saved for offline.** The file-list tests cover the app scripts and `art/guitars` only. **Fixed in review:** a unit test checks both `art/louie` pictures exist, are in `sw.js`, are the ones `styles.css` shows, and are under 60 KB.
23. **Tonight with no song had no test.** The code opens search, as asked. **Fixed in review:** a test for it, which also checks that Fans shows no streak (and no 0) when there is none.
24. **Page order and screen order differ in the header.** In the page, and to a screen reader, it is plate, Fans, Tips, Tonight (Graham's order). On screen Tips sits beside the plate and Fans beside Tonight, so a sighted keyboard or Switch Control user moves plate, Fans (row 2), Tips (row 1), Tonight (row 2). Not changed. Decide whether Fans and Tips should swap places on screen, or the page order should follow the screen.
25. **Large text leaves little room for the path.** At 33 px the stacked header and Louie's line take about 530 of 844 px, so about a quarter of the screen shows the neck. Nothing truncates, as the criterion asks. Not changed. An option for a later step: at large text, let the header and Louie's line scroll away with the path.
26. **At 320 px wide the callout can touch a neighbouring stop** (seen once, on the last lesson of Leg 2). Every current iPhone is 375 px or wider, where it is clear at all 23 progress points. Not changed.
27. **Most `.rr-*` rules are not prefixed with the look.** They only match the Road Ready markup, which `road.js` draws only in Dark and Light, so Green Room and Headliner are untouched (the test confirms, and no `--rr-*` token is set outside the two looks). Rules that restyle shared classes (`.rd-node`, `.rd-tag`, `.rd-legmark`, `.rd-earned`, `.rd-path`) are all prefixed. Not changed.
28. **The old stat bar's streak button lost its tap test** when the profile test moved to Fans. The button still exists in Green Room and Headliner and its code is unchanged. Not changed; a one-line test could go in with a later step.
29. **In Green Room and Headliner, Louie's line reads the streak before Rain checks settle** (the stat bar reads it after). This is how `main` works today and this step did not change it. Road Ready settles first, so both agree there.

Found while building step 03.

30. **Louie's finishes recolour him away from the locked palette.** The Merch table sells six finishes (`MERCH` in `core/game.js`: Stock free, Pink and Teal free, Tweed 600, Studio black 800, Mint 1000, Gold top 1500). Each is a CSS rule (`.fin-*` and `body[data-wear]` near the end of `styles.css`) that sets his `--lv-*` colours. Today Pink and Teal change only his Tolex. Tweed, Studio black, Mint and Gold top also change the panel (`--lv-face`), so his face is no longer yellow, and the grille. The code is left in place and Stock is now the Road Ready palette. **Decide:** keep the finishes as they are, keep only Tolex-colour finishes (the panel stays yellow), or retire them. The tuner's electric headstock also follows the finish (`body[data-wear] .tuner2`), so that would follow too.
31. **The code drawing is an illustration, not the painted art.** After Graham's look at the first pass (flat, no outlines), Louie now has ink outlines, shading, a tolex grain, bevelled caps and knobs, a taller cabinet, legs with boots and arms from the sides. It still reads as a clean drawing next to the r10 renders. **Decide:** for the big poses (the 120 px hero, Show complete, the share card), use the art itself as pictures, the way step 02 does for the peek, and keep the code drawing for small and inline sizes. Not built.
32. **The share card.** `profile.js` adds its own CSS (`LOUIE_CARD_CSS`) for the old part names when it turns Louie into a picture. The new drawing writes every colour on its shapes, so the card shows the Road Ready Louie without it, and the old CSS now matches nothing. `profile.js` is a caller, so it is not changed here. It can be deleted in a later step.
33. **The looks' own `--lv-*` values stay.** The electric tuner headstock reads `--lv-body`, `--lv-shade` and `--lv-hi` from the look blocks. So the locked palette is set on `.louie` itself, not in the four look blocks, and the tuner is unchanged. `--lv-cheek`, `--lv-lamp`, `--lv-tongue` and `--lv-hi` are still defined but nothing on Louie draws them.
34. **The warm rim also shows in Headliner.** The prompt says the rim goes on dark looks. Headliner is a dark look, so the rim shows there too (35 percent, the same as Road Ready dark). Green Room and Road Ready light have none. Apart from Louie, Green Room and Headliner screens are pixel-identical to before (checked on seven screens each with Louie hidden).
35. **The rim is not a CSS token.** `--rr-louie-rim` is only set on the two Road Ready looks, so Headliner can't read it. The rim is drawn in #FFE2B4 and faded to 35 percent as one layer (so overlapping parts don't add up), which is the same colour as the token. The token stays as it is.
36. **Moods match the prompt's five, not the spec's eight.** The spec lists idle, cheering, listening, proud, oops, sleepy, nervous and celebrating. Callers pass five (happy, cheer, sleepy, worried, proud), and the prompt keeps those names. Listening, oops and celebrating are not drawn. `worried` is drawn as nervous (brows up, a small wavy mouth).
37. **Cheer has a small warm tongue inside his mouth,** as in the r10 cheering picture. It sits inside the mouth on the panel, never on the grille.
38. **Sizes with arms.** With arms the picture is wider than he is, so at 44 px his face is smaller. The smallest size any screen draws him with arms is 58 px, which the size test checks. At 44 px with no arms (the spec's minimum full body) eyes, mouth and knobs are each 3 px or more.
39. **Existing test changed:** `core.test.mjs`, "4.39.1 Louie's hands". It read the thumb from the old fist shape. It now reads the thumb lobe of the mitten with the same rule (on the side, never up from the middle), keeps the pointing-hand check unchanged, and moves the two 4.86.0 fist checks, unchanged, onto the guitarist's hands, which still use that fist. No assertion was weakened. `tests/quick.mjs` now runs `louie.e2e.mjs` when `louie.js` changes.

Found in the review of step 03 (2026-11-17, a separate conversation, Claude Opus 5.5).

40. **The warm rim showed on bright cards in the dark looks.** In Dark and Headliner, Louie sits on the lime Band header and the pink (orange in Headliner) Tour header, and the rim drew a tan outline round him there. The spec puts the rim on dark surfaces only. **Fixed in review:** no rim inside `.bd-head` and `.tq-head`, with a browser test. Any later screen that puts Louie on a bright card in a dark look needs the same.
41. **His ground shadow still followed the look** (`--lv-shadow`: navy in Light, dark green in Green Room), and the colour test skipped it. **Fixed in review:** `--lv-shadow: #000` is set with the rest of the locked palette, and the test now includes the shadow.
42. **The grille tests had a gap.** A dark smile drawn on the grille with the weave's own class (`lv-weave`) passed both the unit and the browser test. A second mouth and an unclassed line on the grille were caught. **Fixed in review:** both tests now check that the cloth, the weave, the faint circle and the inner shadow are exactly those four shapes in their own colours and widths; the smile now fails both.
43. **CI's axe check failed on this PR** (Green Room, Show complete: colour contrast on the callout badge's small word). Show complete queues callouts that fade out and in over the page, and axe ran during a fade. The same fade runs on `road-ready` (measured: badge opacity drops to about 0.1 for a moment on both), so it is a race in the test, not Louie. **Fixed in review:** `a11y.e2e.mjs` waits for the callouts, which are aria-hidden decoration, to finish before checking Show complete. This file is outside step 03's list, and it means axe no longer checks a callout caught mid-fade on that screen.
44. **The code drawing is off-model against r10-00.** It meets every hard rule, but side by side at 3x it reads as a different character: the panel is about half the front (the spec says the top third, the grille the bottom two thirds); the legs are long straight shins, where r10 has short stubs and big rounded boots; the arms leave the cabinet near the top and are thin tubes, where r10's are thick, from the sides, with large mittens; the knobs crowd the bottom edge of the panel. Not fixed: this is design work. Graham asked for character art to go to Grok (prompt in chat).
45. **The small Louies are the ones that look most different.** With arms the drawing's viewBox is 268 wide instead of 164, so at the same size he is drawn at about 60 percent. On real screens the posed Louies are 58 to 104 px wide, so his face is about 15 to 25 px across (callouts 58, Rehearse 64 to 84, Merch 84, Band 92, Tour 104). Next to the painted peek on the Road they look like clip art. This sizing is how it was before step 03, but the new detail makes it more visible. Not fixed: part of 44.
46. **The share card is dark (#1B1A1D) and Louie has no rim there.** The rim is hidden by an attribute and shown by page CSS, which a picture doesn't get, so his navy legs and arms are hard to see on the card. Not fixed: `profile.js` is a caller. A later step can show the rim in the card picture, or use the dark art.
47. **The existing cheer art (`louie-cheer-*.webp`) has fists with knuckle lines.** Not fingers, but closer to them than a mitten. Worth redrawing with plain mittens in the same Grok pass.
48. **Checked, nothing to fix:** `mittenOf()` output is byte-identical to `road-ready` for all six hands in two skin sets (12 of 12); the profile avatar and a sheet of guitarists in every pose are pixel-identical at 3x; Green Room and Headliner match `road-ready` on eight screens each with Louie hidden (the only differences are the per-run rival numbers and a timing dot); the tuner's electric head reads the looks' own `--lv-*`, which this step leaves alone; the gradient and pattern ids from the counter can't collide, on a page or in one picture (each id is the unique counter plus a fixed last letter); two Louies decoded as pictures side by side draw correctly; `overflow: visible` put nothing over a neighbour on six screens in Dark and Light.

Found while building step 04.

49. **`openMore()` has no caller now.** The More sheet's function stays in `hud.js` as asked, unused. A later clean-up can remove it.
50. **The Songbook's search bar sat under the new tab bar.** As a tab, the Songbook shows the bar, and its fixed search and Add bar was covered (eight existing tests caught it). **Fixed:** on tab pages other than the Road, that bar rides above the tab bar and the list has room under both. A new test checks it.
51. **Charts and Band had no back button.** They were tabs. Each now has a back button that returns to Me (or to the page you came from). Settings, Merch and Support go back to Me when there is no history, where they went to the Road before.
52. **Me still has "Back to the Road" at the top left.** Me is a tab now, so that button is redundant. Left for step 08, which restyles Me.
53. **The Settings gear needed its own size rule.** The look's `.ib.glass` rule made it 40 px. It is 44 by 44 in every look.
54. **The light grille cloth is paler than the dark one.** The shared `--mesh` was tuned for dark and looked heavy on cream next to r10-02. The light look gets a finer, paler weave over the same `--rr-mesh` tone. Only the tab bar uses `--mesh`.
55. **Tests moved to the new path, same checks.** `app3.e2e.mjs` "The Road is home (4.0.0, Green Room)": Charts and Your band are reached from Me, and Settings from the gear on Me, in place of the tabs and More. `app3.e2e.mjs` "4.14.0 the Merch table": opens Me in place of More; the check that the Merch table was not in More (More is gone) became a check that it is a row on Me; Charts is reached from Me. `support.e2e.mjs` "4.39.0 Support The Road": opens from Me, and is lit under Me in place of More.
56. **Copy that said More.** Settings ("your Tour Map (in More)") now says "open it from your venue on Me". Comments in `road.js`, `merch.js` and `support.js`, the README and `docs/ONBOARDING.md` say where things are now.
57. **Against r10.** The r10 bar is a little taller and its labels look smaller than the spec's 13 px minimum; the labels here are 13 px (they grow to 16 px at large text). The Road icon's bending road reads less clearly than on r8-15. Worth a look on the phone.
58. **Louie.** Not moved in this step, so the warm-rim rule did not come up. Graham's answer that Louie has navy hands with fingers is for step 03b; `louie.js` is untouched here.
59. **Another session's commit is on this branch.** `fdf933f` ("Move the Louie small-size check sheet out of art", from the step 03b session) was pushed to `rr-04-tabs` before this step's first push. It only moves `art/louie/v2/louie-v2-small-check.png` to `docs/road-ready/images/`. Step 04 was rebased on top of it rather than force-pushed over it, so it comes into `road-ready` with this PR. Its message also mentions a CLAUDE.md change that isn't in the commit.

Found while building step 03b (2026-11-17, Claude Opus 5.5).

60. **Sleepy was redrawn during the build.** Grok's new sleepy (rr-03-louie-art commit `1bec4c2`: eyes closed in soft arcs, a small yawn) landed while this step was being built, and it is the one used.
61. **The cheer pictures were re-saved smaller.** Copied from `docs/road-ready/images`, they were about 71 KB each. Re-saved as WebP at quality 80 they are about 50 KB, under the 60 KB limit the other pictures meet. No visible change at phone size.
62. **A worn finish shows the code drawing everywhere.** Finishes recolour the code drawing, and the art can't be recoloured, so while a finish other than Stock is worn every Louie on the page is the code drawing, and the Merch table's finish previews are too (Stock's preview is the art). That is a visible change of style for anyone wearing a finish. **Decide with Surprise 30:** keep finishes on the code drawing, have Grok paint finish versions of the art, or retire finishes.
63. **Some mood and pose pairs borrow a face.** The art has one face per picture: happy with thumb or horns (the count-in, the tuner party) shows the cheering face, and cheer with wave or point shows the idle face. The listening picture is not used, since no screen asks for it.
64. **The share card is still the code drawing.** A picture made from the SVG can't load the art, so the card shows the code drawing, now with hands with fingers. The card is dark and he has no rim there (Surprise 46 stands). Checked by decoding the SVG as a picture.
65. **Louie is bigger in the same frame.** The art fills the frame that the code drawing used, so the size, viewBox and layout are unchanged, but the posed Louies (whose frame was wide to fit the old arms) are drawn much larger. Checked on Road, Band, Tour, Rehearse, Merch, Support and Show complete in Dark and Light at 3x: nothing clipped and no new overlaps.
66. **Each Louie carries both pictures.** The SVG holds the light and the dark picture and CSS shows one, so the first time a pose is drawn both are fetched (about 100 KB a pose), then they are cached. The offline copy grows by about 0.95 MB (18 pictures).
67. **Changed tests:** `core.test.mjs` "4.39.1 Louie's hands" is back to the checks it had before step 03 (the thumb on the side of the fist, the curled-finger creases) on Louie's own hand, plus the same on the guitarist; "every mood and pose has exactly one mouth" allows the new crease class `lv-mit-l` on the hands; "mittens with no fingers" is replaced by "hands with fingers in navy, the same shapes as the guitarist's" (same no-cheek and signature checks); the Reduce Motion rule check now includes the art. `louie.e2e.mjs` shows the code drawing before measuring it, and the per-hand count is now exact for each pose (it was "a mitten and a thumb lobe"). No check of the hard rules (one mouth, plain grille, no cheeks, locked palette, rim) was removed or loosened.

Found in the review of step 04 (2026-11-18, a separate conversation, Claude Opus 5.5).

68. **CI's a11y pass still opened More.** Fixed in review: it checks the tuner from Me.
69. **Tab labels overlapped at 320 px and at large text.** Fixed in review: the label size fits five tabs, with a test.
70. **The Road icon read as a barcode at 28 px.** Fixed in review: redrawn as r8-15's fretboard with stops.
71. **The Me rows did not grow with text size.** Fixed in review.
72. **fdf933f's CLAUDE.md sentence was missing.** Fixed in review: added.
73. **The Songbook's title and Sets button touch at 320 px.** This is not from step 04; left for step 07.

Found while making the design fixes from Grok's review (2026-11-18, branch `rr-05-design-fixes`, Claude Sonnet 5.5).

74. **There is no 512 px tolex bitmap tile in the repo** (design review item 7). Spec 5.1 names `tolex-dark`, but only the code-drawn tolex exists. Not built. Grok supplies the tile; then `--tolex` swaps to it. The soft amber glow behind the neck in the dark look is done. **Done (rr-05-wire):** Grok's tiles (PR #92) are in `art/surfaces/`, shown at 256 px under the same 45 percent wash in dark. Grok's originals are kept in `docs/road-ready/assets-grok/`; the dark tile is the same grain with each colour channel scaled so the page average stays the base colour (#141210). The cream tile is Grok's grain lifted by an offset with a soft shoulder near white, so under 1 percent of its values are pure white (channel scaling had made it 7 percent); it is a little darker than the base (average 242, 237, 225 against #F6EFE2), inside the colour test's 5.
75. **There is no rendered sunburst guitar body in the repo** (item 8). The Road bodies are the flat pictures in `art/guitars/`; r10-01's photographic cutaway is not among them. The body art and raising the neck are not done; they wait for the art. **Done (rr-05-wire):** Grok's sunburst cutaway (`cutaway-sunburst`, source in `docs/guitars/pics/`) is processed by `tools/guitars/pics.py` (close-up 800, bridge .49) and replaces the plain cutaway on the switch leg and in the guitarist's hands. The old `cutaway` files stay in the repo, unused. Raising the neck was not changed: the sunburst body sits at the same size as the other bodies and the neck already joins it. The picture's baked bridge and soundhole are kept; the app draws frets and strings over the bare neck.
76. **Louie's line is cut to two lines at large text**, which bends the "nothing truncates" rule for that one line (Graham's review asked for it to be shortened). The whole line stays in the page for a screen reader. At large text the header and line take about 51 percent of the screen (they took 62).
77. **Changed tests:** the 03b art test now covers the `listen` mood, the thumb-below-100 rule and the dark picture's 2 percent padding; the Road peek test expects a 156 px box in the dark look (150 px in light). The Opening night "Play each chord" card keeps the happy pose because the show doesn't listen.
78. **The dark Louie art is not the same canvas size as the light.** Each dark picture has a 12 px margin for the baked-in warm rim, so Louie drew about 4 percent smaller in dark. `louie()` and the peek now draw the dark pictures 2 percent bigger on each side.

Found while building step 05 (2026-11-18, Claude Opus 5.5).

79. **The Gig has only Pause, not r10-08's five controls.** The prompt calls the controls a restyle of what the Gig has, but `shell()` has only Pause: the X went in 4.66.0 (Graham: the show is the song page, left with its own Back), speed lives in Tools while paused, and Practice a section ends a show on purpose (`GIG_ENDS` in `app.js`). Built: the song's title and artist at the top and Pause as a big amber button at the bottom centre. Not built: Close, Speed and Loop, and so no capsule (a dark capsule round one round button reads like the ring that 3.19.0 retired). **Decide:** recommended, add Close (leaves the show, the same as Back while paused) and Speed (opens the speed dial; a slowed show already can't make a song Gig-ready) in an r10-08 capsule, and leave Loop out of a show. Both need a small `app.js` hook, so they are a step of their own.
80. **Line sizes 34, 26 and 22 are not built.** The show reads where the song is from the page as it was laid out (`diag.blocks` in `app.js` and `chordYs` in `stage.js`, measured once per draw), and 4.51.0 sizes the text so the song's longest line fits on one line (14 to 22 px, larger with the iPhone text size). Growing the current line and shrinking sung lines as the song moves would shift the words under the reading line and make those measurements wrong, which is how the song position is read (on the Don't change list). Built: the lyric colours, the bold current line, the amber bar, all at one size. **Decide:** keep it, or a separate Opus step that measures again on each line change and holds the reading line still (touches `app.js` and how the position is read; needs its own review).
81. **Lyrics don't snap line by line under Reduce Motion.** `startScroll` has no reduced-motion path to reuse: auto-scroll moves the page a few pixels each frame, and the show reads the position from that. Not built. **Decide** with 80: snapping changes how the song moves under the reading line, so it belongs in that step.
82. **The listening Louie art has mittens.** `louie-listen-dark.webp` and `-light.webp` were drawn before Graham's 2026-11-17 rule (hands with fingers, navy). Not added to `art/louie`. The hint uses the painted wave pose from `art/louie/v2` (fingers), at 44 px beside the frame and `aria-hidden`. PR #91 has since added a `listen` mood (hand to his ear) to `art/louie/v2`; switching the hint to it is open.
83. **What the Gig shows today stays, where r10-07 shows only words:** the section pill, the crowd row of 12, the run counter, the NOW chord shape card, the section-coloured band behind the current line and the stage light. All kept, as the prompt says. **Decide** which stay in the Road Ready looks. Recommended: keep the crowd and the run (the game), drop the band and the stage light (the amber bar marks the line now), and move the section name into the title row.
84. **The amber bar and the progress line use `--rr-amber-text`:** amber in dark, amber-brown in light, so they keep 3:1 on cream (plain amber on cream is about 1.5:1).
85. **In light the chords (amber-brown, 7.7:1) have less contrast than the words.** 4.58.0's test said a line's chords are brighter than its words. In the Road Ready looks they stand out by colour instead, as the tokens set them. The test now checks 4.5:1 or more there and keeps "brighter" for Green Room and Headliner.
86. **The hint shows the first time the controls hide, not when the show starts.** At the start the controls are on screen, so "Tap anywhere for controls" would be wrong. It is saved as `used.playHint` when it shows. It shows in every look (Louie is Road Ready everywhere); the title and progress line only in Road Ready. After review it sits at the bottom, in the space Pause leaves, so it never covers the words, and it fades on its own 5 s after it shows (0.25 s, or at once with Reduce Motion).
87. **A screen reader or a switch is guessed from focus with no touch in the 0.8 s before it.** A tap that focuses a button doesn't count. Keyboard focus on a control (`:focus-visible`) also keeps them. Both end when the song is paused or ends.
88. **Space was already play and pause** (the page's pedal keys, 4.x), so the Gig adds nothing for it: no double handling. Any key shows the controls through the existing wake.
89. **Large text hides lines with `visibility`,** so nothing moves under the reading line: lines sung step aside, and lines after the next two do too. The test browser can't report an iPhone text size, so the lyric size there stays the fitted one; on a phone 4.51.0's fit already grows with the text size.
90. **Changed test:** `gig.e2e.mjs` "The Gig (4.1.0 ...)": its 4.58.0 checks measured dimming by alpha. They now measure alpha times contrast with the page, which holds for the earlier looks (alpha) and Road Ready (solid colours); the chords check is per look (85). No other check changed.
91. **Changed tests:** the Road Ready tolex checks now look for the bitmap tile (`art/surfaces/tolex-*.webp`) instead of the SVG grain; the guitar-pictures test also covers the sunburst files. `pics.py` also takes the magenta trace off the sunburst's outer edge (`defringe`, that picture only).

Found in the reviews of step 05 (PR #90 and PR #93, 2026-11-18, a separate conversation, Claude Opus 5.5). To fix later; none blocked a merge.

92. **At large text the first-run hint covers the NOW chord card.** The hint wraps to three lines and sits over the NOW card for up to 5 s, once. Measured at 390 px: hint [16,730,374,832], card [280,614,376,748]; at 320 px: hint [16,692,304,832], card [210,614,306,748]. Fix: under `[data-ax]`, when the NOW card shows, align the hint left with its right edge clear of the card and let it grow upward (the lines above are hidden at large text). `gig.e2e.mjs` "the first-run hint sits below the words" should also check the card. `styles.css`, `.gig > .gg-hint`.
93. **Keep the wave pose for the hint** (answers the open part of 82). The `listen` mood shows Louie listening, and the show doesn't listen (4.91.0), so the wave stays.
94. **Open points 79, 80, 81 and 83:** answered by Graham on 2026-11-18 (see his answers at the top) and built on `rr-05-followup` (98, 99). What is left of the reviewer's suggestion for 83 (the section band behind the line, the stage light, and the run chip and NOW card colours) is done on `rr-05-polish`.
95. **Tests that fail now and then and pass when run alone:** `practice.e2e.mjs` "What I hear: the level, the pitch and the string it lights, and readings to copy"; `duet.e2e.mjs` "Play together: a link, even an old one with a start time, opens the song and Play together"; and "Sing it" (seen by Sonnet). Find the race in each (most likely a wait on a fixed time or on the wrong element) rather than retrying.
96. **The cream tolex grain is quieter than Grok's.** Levelled to stay under 1 percent of values at 255, it keeps about 78 percent of the original grain (luminance std 7.6 against 9.8). Accepted for now; revisit if the light Road looks flat on Graham's phone. Grok's originals are in `docs/road-ready/assets-grok/`.
97. **The sunburst's cleaned edge has a thin dark line.** `defringe` in `tools/guitars/pics.py` removed the magenta, but the edge now reads as a faint dark beaded outline when zoomed in. Not visible at phone size. If it shows on a device, soften the alpha ramp (`(al - .3) / .7`) or take the edge colour from the cream binding rather than the nearest solid pixel.

Carried over from `rr-05-followup` (PR #94; renumbered from 91 and 92 when road-ready was merged in).

98. **Fixed in review: the first-run hint showed in Green Room and Headliner too,** and used up the one-time hint there. It now shows only in the Road Ready looks, in the plate tokens. The 5 s test allows for the test seeing the hint a moment after it shows (it failed once at 4961 ms under load).
99. **After PR #90 merged** (before the review fix reached it), the fix and Graham's 2026-11-18 answers went on `rr-05-followup`. The crowd row and section pill are hidden with CSS only, so the crowd still counts and the tests that read it still work.
100. **The rest of 83, on `rr-05-polish`** (built by Claude Opus 5.5 in the step 05 review conversation, so it needs another reviewer). In the Road Ready looks, while playing: no section-coloured band behind the line you're on (the amber bar marks it) and no stage light; paused keeps its quiet band. The run chip is amber text on the Road Ready card, and the NOW card is the Road Ready card with a hairline edge and an amber NOW, replacing the old pink, green and yellow. Green Room and Headliner are unchanged. Changed test: "4.51.0 one page" now checks there is no stage light in Road Ready; the stage light and band moved to "Green Room keeps the show as it was".

Found while building step 06.

101. **Step 06 was built by Opus in this chat**, not Sonnet as the plan says: Graham said go here.
102. **A guitar is never earned on Show complete.** The headline show is a skill check in Rehearse, not a song, so `showComplete()` always shows the glow version, and the case is the new-guitar sheet on the Road (`guitarEarned()`), as the prompt splits them. The case sheet has no reward tiles: it doesn't know what the headline check paid. Its title is the leg ("Open chords, all 10 shows").
103. **The primary button says Continue, not "Head to the Club".** Continue keeps its action (it stays on the song page), so naming the next venue on it would say something it doesn't do. The next venue is the "Next stop" line above it. Play it again is the Encore, with "2x bonus fans" kept in its words.
104. **The guitar is the one of the leg you're on** (`guitarSVG()` of the leg with the current stop), named on the cream label.
105. **The case is Grok's painting of each guitar in its own open case** (`art/show/case-beater`, `case-cutaway`, `case-solid`, dark and light, 2026-11-18), shown whole on the new-guitar sheet, so the proportions and fit come from the painting. The empty case (`case-open`) with the whole-guitar picture over it stays as the fallback for a guitar without a painting. Grok's notes: the cutaway and the solid-body share one case outline; the beater's top is paler than its finish colour.
106. **The headline Louie is `louie("cheer")`**, which picks the painted cheer art for the look, as everywhere else.
107. **No tolex panel behind the tiles and buttons**, which r10-04 has. The screen scrolls instead, with the crowd, stars and the list below the buttons.
108. **`headlinerEarned()` is unchanged**: its buttons already take step 01's plate and capsule styles.

Found in the review of step 06 (2026-11-18, a separate conversation, Claude Opus 5.5).

109. **Two Surprises were numbered 100.** `rr-05-polish`'s note took 100 before step 06 was built. Fixed in review: step 06's are now 101 to 108.
110. **The light picture in `rr-06/show-complete.png` was out of date.** It showed the Stars tile in the old blue, which the code no longer draws (the Road Ready card wins). Fixed in review: the light panel is remade from the branch as it is.
111. **Not from step 06, found in review: a page error can end "Road Ready 02: every stop and header control ...".** Under load, once in two `quick.mjs` runs, the page threw `getComputedStyle ... parameter 1 is not of type 'Element'` after the test visited the Tour Map and went back. Most likely `fit()` in `playmap.js` (line 220) running after the map page is gone, so `.tm-page` is null. It passes alone. Not fixed here; add to the flaky list in 95. "Sing it" (95) also failed once in the same run and passed alone.
112. **The guitar on Show complete looked stubby.** `guitarSVG()` builds the neck from two fret spaces, which was fine for the small picture on the earlier new-guitar sheet but at full size gave a full body on half a neck. Fixed in review on Graham's go: `guitarSVG(id, { full: true })` gives a neck about 0.7 of the body, as on a real guitar (`neckStops` and `FULL_NECK` in `core/game.js`), used on Show complete and as the case's fallback when a guitar has no whole-guitar picture (the case itself now shows the whole-guitar picture, 105). The Road's necks and Green Room's sheet are unchanged. Tests: a unit test for the proportion on every guitar picture, and Show complete checks its guitar is at least 2.5 times as tall as wide. Show complete screenshots remade.
113. **Show complete now shows the guitar's whole picture too** (Graham, 2026-11-18), the same `guitarPic()` picture the case sheet draws for a guitar without its own painted case (the beater, the cutaway and the solid have Grok's guitar-in-case paintings, `a7fc54a`); the full-neck drawing (112) is only the fallback for a guitar with no picture. The whole pictures have no strings or frets drawn, and at 642 px tall they are upscaled about 1.6 times on a 3x iPhone, so they may look a little soft; a larger export from Grok would fix that.

Found while building step 07 (2026-11-18, Claude Opus 5.5).

114. **Search stays at the bottom, not under the title as in r10-05.** The prompt asked that the search bar keep riding above the tab bar (Surprise 50), so it stays there, restyled. Add moved to the header as a round "+ Add" (as in r10-05), and the + inside the search bar is gone in Dark and Light. **Decided (Claude, on Graham's say-so): it stays at the bottom.**
115. **The Tuner button stays in the Songbook header.** It is an existing control and the prompt says to keep every control, but Graham's step 04 answer puts the tuner on the song screen and Me. **Decided: it goes from the Road Ready Songbook** (Green Room and Headliner keep it in their earlier header). The tuner tests now open it from Me's Tuner row.
116. **r10-05 shows an "Almost" filter and a "New" tag that the app doesn't have.** Neither was added (filter logic is out of scope). A song with no level shows no dots.
117. **At 390 px the filters wrap to a second row** when Learning, Favorites and Sets all show (Sets alone on row two). Nothing is squeezed or hidden.
118. **Where Solid lands.** Every place that reads status keeps its meaning, so Solid is neither Learning nor Nailed it: it leaves the Learning filter, the Learning set (`sets.js`), Rehearse's song picks (`practice.js`), the nudges (`core.js`), the Learning flags on changes (`core/game.js`) and the "learning" chords on Your playing (`core.js`); it counts as not yet Nailed it for "worth another try" (`library.js`, `core/playing.js`). **Practice mode is on by default only for Learning** (`practicing` in `core/neck.js`, `setPracticing` in `app.js`), so a song moved to Solid plays at full speed unless Practice mode was turned on for it. **Decided: keep it.** Solid means you can play it through.
119. **"Got it" also showed on Your profile** ("Got it: song", the latest milestone). Changed to "Nailed it:" since Graham's answer said everywhere, though `profile.js` wasn't on the touch list. The listening booth's "Got it." means "heard you" and was left; a code comment in `core/playing.js` still says Got it. **Decided: keep "Nailed it:".**
120. **The row tags changed shape.** CAN PLAY became "Can play" in the artist line, LEARNING became the dots, "+ F" became a "needs F" chip, and the key is plain text under the dots. The back button stays (r10-05 has none), since Sets and tests use it.
121. **An empty Songbook stopped drawing** in Dark and Light (no songs meant no Sets capsule to bind). **Fixed** in this step, with a test.
122. **The Road Ready 01 tolex test sampled a band of the Songbook** that now holds song cards. It now hides the page while it measures, so it reads only the ground.
123. **At large text the search field's placeholder is cut off** ("Search or add a sor..."). Typed text scrolls as before. Not changed.
124. **`docs/sonnet-log.md` isn't created.** Opus built this step, and the log is for Sonnet-built work.
125. **"Add opens a blank song in the editor" timed out once in two `quick.mjs` runs** (it also timed out once in the step 02 review). It passes alone every time. Load in the sandbox, not this step.

Found in the independent review of step 07 (2026-11-18, Claude Fable 5.2). The four decisions (114, 115, 118, 119) were carried out and the review agrees with each.

126. **Only Sets said whether it was chosen.** The other Road Ready filters showed the chosen one by its fill alone, so a screen reader couldn't tell. **Fixed** (`d91e4fb`): each Dark and Light filter carries `aria-pressed`, with a test. Green Room and Headliner are unchanged (their filters never said it; not part of this step).
127. **A tile was blank when album art couldn't load** (offline, an expired link, or a link the page's image rule blocks: only Apple's art host is allowed). **Fixed** (`55e5d08`): the art sits over the initials, so the initials show when it fails, with a test.
128. **Nothing pressed the Songbook's Tuner button any more.** The tuner tests moved to Me, and the button's wiring changed in this step. **Fixed** (`093bbd6`): the Green Room and Headliner test presses it and the tuner opens.
129. **Step 07 status still said the title has a Tuner.** It was written before decision 115. **Fixed** in this commit.
130. **The tolex test is a little narrower.** With the page hidden it checks the ground itself, with the same tolerance, but it would no longer notice a page layer painted over the ground. Accepted: the test is about the ground, and the Songbook's cards now fill that band on purpose.
131. **The iPad check no longer looks at the Tuner.** It checks Add at the top in Dark; the tuner's place in the Green Room header is checked on a phone only. Accepted.
132. **Two tests failed once under load in the review's `quick.mjs` run** ("Sing it: one take split at a breath" and "Play together: a link"). Neither touches the Songbook, and both pass alone. The same kind of sandbox load as 125.

133. **Light Show complete: the lower section, "The song you played", still shows the old blue and pink section pills** (found in the step 06 review, shown to Graham in chat, not yet fixed).
134. **At large text the new-guitar case sheet puts Rock on below the fold, so it needs a scroll** (step 06 review; noted in PR #96 only).
135. **Phone check for the Road Ready release:** open the Songbook search with the keyboard up and confirm the last result scrolls clear of the tab bar (from the step 04 review; not yet checked).
136. **Me has no player name to show.** No name is stored, so the title is "Your profile" where r10-06 shows a name. Needs a decision before a name field is added.
137. **The guitar labels say "earned on Leg N, <leg name>", not "earned at the Club".** Legs are named by topic ("Open chords", "Chord switches", "Scales"), not by venue, so the prompt's example does not match the code.
138. **Three things left the tiles.** The streak, shows played and tips to spend are no longer tiles. Nights in a row and shows played are one line inside "Your stats"; tips to spend is the Merch row. Every number is still shown and unchanged.
139. **Milestones show "N of 26", not "2 new".** They use the existing badges and their order. r10-06's "new" count has nothing behind it in the data.
140. **The Help and feedback row opens Settings, Help (`#/settings/help`).** There is no other help page.
141. **The guitar case is drawn in CSS, with no case-rack art, and every guitar at one height.** The pictures have no stored relative scale. Upright, headstocks up, as required; the case-rack art is optional in the prompt and was not made.
142. **A Back to the Road button is shown, which r10-06 does not have.** Kept so the page still has its way back; it is now 44 px (Surprise 52).
143. **The 44 px Back button rule applies in every look**, so Green Room and Headliner grow it from 36 to 44 px. Tested in Green Room.
144. **The road-ready branch's CLAUDE.md lacks the step 0 block** and still says to push to main. It will come in when road-ready takes `next`; nothing in this step relies on it.

Found in the review of step 08 (2026-11-18, Claude Opus 5.5, Louie Product). Decided in review:

- **136:** keep "Your profile". A player name is a new stored field, so it is its own item if Graham wants one.
- **137, 139, 140:** accepted as built (leg names, "N of 26", Help opens Settings, Help).
- **138:** accepted. Every number is still on Me, and the streak no longer sits in a tile of its own, which suits the no-guilt rule.
- **141:** accepted for now. Painted case-rack art, if wanted, goes to Grok with step 09's guitar art.
- **142, 143:** keep the Back button, and keep 44 px in every look (the inclusive design rule).
- **144:** `road-ready` takes `next` (which has the step 0 block) in its own PR before step 09, on Graham's merge go. It deploys nothing.

145. **The Milestones card is a grid of eight plates with "All 26 milestones", where r10-06 has one compact row.** Kept: it shows more and nothing clips. Revisit with Graham at the preview if Me feels long.
146. **Two small notes, not fixed:** each guitar in the case is an `li` with `role="img"`, which replaces the list item for screen readers (the names still read); the coin on the Merch row stays 16 px at large text while the words grow. Neither blocks the merge.
