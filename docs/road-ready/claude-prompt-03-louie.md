# Step 03 of 9: Louie in code (one mouth, plain grille, mittens)

**Model:** Opus. **Branch:** `rr-03-louie`. **Needs:** step 01. **Files:** everything is already in the repo, so there is nothing to attach. The spec is `docs/road-ready/louie-design-spec.md` and every image named here is in `docs/road-ready/images/`. Open and look at these before you start: `docs/road-ready/louie-design-spec.md` (section 9), `r10-00-louie-road-ready-sheet.jpg`, `r10-contact-louie-assets.jpg`, and `louie-idle-light.webp`, `louie-cheer-light.webp`, `louie-listen-light.webp`.

## What this step is

Louie is drawn in code by `louie(mood, { pose, size })` in `louie.js` and shows up on many screens (sheets, Show complete, tips, Rehearse, the More sheet, share cards). Today's drawing breaks Graham's hard rule: the comment at the top says "the speaker for a mouth", so the grille is his mouth. He also has cheek spots (`lv-c`, `--lv-cheek`) and hands with fingers (horns, point, peace, wave). Redraw him as **Road Ready** to match `r10-00`, keeping the same function signature so no caller changes.

## Files you will touch

- `louie.js`: the whole drawing (`louie()`, `HANDS`, `POSES`, `mitt`, the header comment).
- `styles.css`: the `.louie .lv-*` rules (search `.louie .lv-b`) and the `--lv-*` variables in each look block of the "Version 4 look" section, plus the Reduce Motion rule for `.louie` (search `.louie .lv-body, .louie .lv-eye`).
- Tests that snapshot or select Louie's parts (grep for `lv-`, `louie(`).
- `README.md` (the Louie description) and `CLAUDE.md` only where it describes Louie's look (the "Version 4" paragraph). Ask Graham before changing CLAUDE.md; put the suggested wording in the PR if he hasn't said yes.

## What to build

- **Body:** a 1x12 combo amp, a little taller than wide, Tolex blue #23406A with a darker right side #1A3152, nickel corner caps #948573 on all four corners, a brown leather handle #55331B on top.
- **Face:** the yellow control panel (#F0B23A, shade #D9982A) across the top third. On it: two round eyes, **one mouth** between the eyes and the knobs, and a row of four cream knobs (#E8D5B3) with a dark pointer line each. Ink lines #0B0F14.
- **Grille:** the bottom two thirds, plain navy cloth (#182D47) with a fine weave (#2A4466) and at most a faint speaker circle. **No mouth, smile line, slot or feature on the grille, in any mood, pose or size.** Delete the old speaker-mouth and slat-mouth shapes.
- **Moods** (keep the names callers pass): `happy` (soft smile), `cheer` (open smile, eyes closed in happy arcs), `sleepy` (half-closed eyes, small closed mouth), `worried` (draw it as "nervous": eyebrows up, small wavy mouth, never sad or crying), `proud` (closed-eye smile, chin up). All mouths live on the panel.
- **No cheeks.** Remove `lv-c` and `--lv-cheek` from the drawing (leave the variable defined if other code reads it, but nothing draws it). No tongue colour on the grille.
- **Hands:** mittens only, no fingers. A mitten is one rounded shape with at most a thumb lobe. Map the existing pose names to mitten versions so callers keep working: `rest` (mittens down at his sides), `hornsUp` becomes both mittens raised in a cheer, `thumb` becomes a mitten with the thumb lobe up (no fingers), `point` becomes a closed mitten reaching out (like the round 10 peek), `wave` becomes an open raised mitten (one shape, no fingers), `peace` becomes the same as `wave`. Cuffs stay.
- **Legs:** two short navy legs with rounded feet, as in `r10-00`.
- **Colours are locked.** Louie uses the same palette in every look. Set the `--lv-*` variables to the locked palette in all four look blocks (or in one shared block). In dark looks, add the warm rim: a 3 px outline in `--rr-louie-rim` (rgba(255, 226, 180, .35)) around his silhouette, drawn as a stroke on a copy of the outer shape behind him, so navy reads on #141210.
- Keep `role="img"` and the `label` option; decorative uses still pass through `aria-hidden` where callers already do.

**Guitarist hands stay as they are.** `mittenOf()` is used by `guitarist.js` and shares `HANDS`. Before you change `HANDS`, copy today's shapes into a separate `GUITARIST_HANDS` used only by `mittenOf()`, so the guitarist's hands don't change.

**Louie's finishes on the Merch table.** The Merch table sells "Louie's finishes" (see `merch.js` and `MERCH` in `core.js`). The spec locks his palette. Leave the finishes code in place, make the Road Ready palette the default, and write in Surprises how the finishes currently recolour him so Graham can decide whether they stay.

## Acceptance criteria

1. Every mood and pose renders with exactly one mouth, on the panel, and a plain grille. Add a browser test that renders every mood with every pose and asserts no mouth shape is inside the grille's bounding box (give the mouth one class, `lv-mouth`, and check there is exactly one per SVG).
2. No hand has a finger: no `finger(` shapes remain in Louie's `HANDS`.
3. No cheek or blush shapes are drawn.
4. Louie looks the same in all looks (same fills), with the rim only on dark looks.
5. `guitarist.js` hands are pixel-identical to before (screenshot the profile avatar before and after).
6. At 44 px (the smallest full-body size) he still reads: eyes, mouth and knobs are visible. Check sizes 44, 60, 96, 112 and 120.
7. Under Reduce Motion, any blink or bob is off (keep the existing rule working).
8. The axe test passes.

## Screenshot check

A test page or a throwaway e2e that lays out every mood across every pose at 120 px on Road Ready dark and light, plus the 44 px row. Put it next to `r10-00` and the three pose images listed at the top. Also screenshot two real screens that show Louie (for example the headliner sheet from `headlinerEarned()` and the More sheet or a tip).

## Don't change

- The `louie()` signature, mood and pose names, or any caller.
- `friends.js` (Louie's friends), `guitarist.js`, the app icons and launch screens in `icons/` (those are a separate job later).
- Any screen layout.

## Ground rules for this step (the same in every prompt)

- **Repo and reading.** This is grahamdeno/tabs, the PWA called "Louie: Learn Guitar" (plain ES modules, no build step, CSS in `styles.css`). Before you change anything, read `CLAUDE.md`, the README's Development section and `docs/DATA.md`, and follow CLAUDE.md's standing rules. Start from a fresh `origin/main` (`git fetch origin main`).
- **Branch rule.** Do this step on its own branch named `rr-03-louie`, made from `origin/main`, and leave it as one pull request for Graham to review. Don't push to `main`, don't merge, and don't touch any other branch. For this redesign only, this replaces CLAUDE.md's "push to main" so each step can be reviewed on its own. If you are working in the Louie Lite repo (grahamdeno/louie-lite) instead of tabs, commit and push only to `lite-3`, never to `main` or any other branch.
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

