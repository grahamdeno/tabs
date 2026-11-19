# FOR CLAUDE (Louie, grahamdeno/tabs): wire the 23 new guitars into the app

**Stop before anything that can't be undone.** Do not merge anything. Do not push to `main`, `next`, `road-ready`, `rr-09-merch` or `rr-09-art`. Do not force-push. Do not delete, rename, archive or transfer any file, branch or repo. Do not dispatch any workflow (including `screens.yml`). Do not bump `VERSION` or `CACHE`. Do not deploy, upload to the App Store or TestFlight, or touch Vercel, Cloudflare or any account. If a step seems to need one of these, stop and ask Graham.

## What this is

Road Ready step 09a (see the step 09 sub-plan in `docs/ROAD-READY-PLAN.md`). Grok painted the art on branch `rr-09-art`:

- The seven Road guitars in `docs/guitars/pics/` (Porch, Cornerstone, Club Slab, Hollow Hill, Swing, Koa Arc, Comet), each with a headstock close-up.
- 16 concept guitars in `docs/guitars/concepts/`: 10 custom-shop and 6 punk, each with a headstock close-up.

`docs/guitars/HANDOFF.md` is the manifest. It lists all 23 guitars with the file to use (a `-v2` file where one exists, and `koaarc-v2.jpg` for Koa Arc), the headstock close-up, sizes, the leg each Road guitar belongs to, the framing, the #FF00FF background key and the code touchpoints. Read it first, then `CLAUDE.md`, then the step 09 sub-plan.

## Branch and PR

1. Branch `rr-09-wire` from `rr-09-art` (not from `main` or `next`). The art is only on `rr-09-art`; its PR #101 goes into `rr-09-merch`.
2. Open one PR from `rr-09-wire` into `rr-09-art`, in the playbook format (`grahamdeno/playbook` `templates/pr.md`). If Graham would rather it went into `road-ready` like the other steps, he will say so; don't change the base yourself.
3. One task per commit. Before every push run `eslint .` and `node tests/quick.mjs`, and report the real results. Don't run the full suite and don't wait on CI.
4. Never edit or delete Grok's art files or `docs/guitars/concepts/README.md`. Generated files (`art/guitars/*.webp`, `art/guitars/pics.js`) come from the tool, never by hand.

## The work

### 1. Pictures through the pipeline

- Extend `tools/guitars/pics.py` so it can read from both `docs/guitars/pics/` and `docs/guitars/concepts/` (for example a source folder per name), keeping the names it builds today.
- Add every guitar in `HANDOFF.md` to `NAMES`. Name the outputs by slug (`porch`, `koaarc`, `highline` and so on), even where the source is a `-v2` file. Pick its whole picture and close-up from the table.
- Set `CLOSEUP` (a row that crosses the neck in each close-up; the nut is near y 590 in most, about 700 for Razorwing and 620 for Toxic Checker) and `BRIDGE` (where the strings end) per guitar by measuring, the way the existing entries were set.
- Treat the background the same way as the existing guitars: `cutout` unmixing the #FF00FF, plus `defringe` wherever magenta fringe shows. Look at every result on dark and light backgrounds; no pink edges.
- Run `python3 -I tools/guitars/pics.py` to write `art/guitars/<slug>-head.webp`, `-body.webp`, `-small.webp` and `art/guitars/pics.js`.
- Add every new `.webp` to `SHELL` in `sw.js` (no version bump).

### 2. Strings

The new pictures have painted strings (Graham wants every guitar to show them). The Road neck draws its own strings with `stringLayer`, so on the neck they could double. Pick one clean approach, for example skip the drawn strings over a picture that has its own, or cut the painted strings out of the `-head` and `-body` pieces only. Whole pictures (`-small`, the guitar case, Show complete) keep their strings. Say in the PR which approach you chose and why.

### 3. Road guitars: legs and unlocks

- In `core/game.js` `GUITARS`, give each leg its new guitar: `open` Porch, `switch` Cornerstone, `scales` Club Slab, `strum` Hollow Hill, `pick` Swing, `finger` Koa Arc, `encore` Comet.
- Leg ids, `guitarFor`, `guitarsEarned` and saves (`data.guitars.seen`) do not change. Earning stays the same: headlining a leg earns the next leg's guitar. Only the names, bodies, colours and pictures change.
- All seven now have rounded 3+3 heads, so the drawn fallback `head` should be the rounded one (`plain`) rather than `slot`, `inline`, `book` or `point`.
- Point `NANO_FILE` and `BODY_FILE` in `fretboard.js` at the new pictures, so `guitarPic`, `picOf` and `picLayout` work for the Road neck, the new-guitar sheet (`road.js`), `gig.js`, the guitar case on Me (`profile.js`) and the guitarist (`guitarist.js`).
- Keep the old pictures building, so nothing that still names them breaks.

### 4. Concepts: shop, custom and punk options

- Add the 16 concepts as guitars you can get on the Merch table (`merch.js`, `MERCH`, `merchBuy` in `core.js`). Group them as Custom (10) and Punk (6) using the category in `HANDOFF.md`.
- Use the sub-plan's unlocks by venue (`VENUES` in `core/turf.js`): the Shop opens at Coffeehouse, Custom at Club.
- Store them like the sub-plan stores builds: bought ids in `data.merch.has`, with a prefix of their own (for example `g-<slug>`). Document it in `docs/DATA.md`. Old saves must load unchanged.
- An owned concept can be chosen as the guitar on the Road neck and in the case, instead of the leg's guitar. Keep the earned leg guitar as the default.
- Prices, the unlock for Punk, and whether choosing a guitar changes anything beyond looks are not decided. Propose them in the PR under a "Decisions for Graham" heading and use your proposal behind one constant, so changing it is one line. If something in the plan or the code doesn't match this prompt, stop that task and write it under "Surprises" in `docs/ROAD-READY-PLAN.md`.

### 5. Tests and docs

- In `tests/core.test.mjs`: every name in `pics.js` has its three `.webp` files and is in `SHELL`; every `GUITARS` leg and every concept resolves to a picture through `NANO_FILE` or `BODY_FILE`; buying and choosing a concept works and saves; old saves without the new data still load. Update the existing checks (around lines 1728 and 2843 to 2866) that name `cutaway-sunburst` and the swallow-to-headliner mapping, without weakening them.
- Update the README feature list and `docs/DATA.md`. Tick 9a in the sub-plan.

## How to write

Plain words for Graham. No em dashes anywhere Graham reads (PR, commits, docs, on-screen text). Never print or commit secrets.

## When you're done

Post the PR link, the `eslint .` and `node tests/quick.mjs` results, the decisions for Graham, and any surprises. Then name the model for the next step (9b, the builder, is marked [Opus] in the plan). Do not merge; Louie Review (Fable) reviews on Graham's go.
