# Road Ready build docs

The Road Ready redesign, as nine steps for Claude. Every step's pull request goes into the `road-ready` branch, never into `main`. Nothing is merged without Graham's go, and `main` gets the whole redesign as one release when he says ship.

## Branches

- `road-ready`: the integration branch, cut from `main`. Step 01 creates it if it doesn't exist.
- `rr-01-tokens`, `rr-02-road` and so on: one branch per step, cut from `road-ready`, with one PR into `road-ready`.
- Each step needs the step before it merged into `road-ready`.
- No step bumps the version. VERSION and CACHE are bumped once, when `road-ready` goes to `main` on Graham's ship go.
- In the Louie Lite repo (grahamdeno/louie-lite), pushes go only to `lite-3`.

## How to use: one line per step

For each step, in order:

1. **Build.** Tell the model the step names (Sonnet or Opus, at the top of each prompt):

   ```
   Do docs/road-ready/claude-prompt-0N-<name>.md
   ```

   The model asks you any "Confirm with Graham" questions first, then builds and opens a PR into `road-ready`.

2. **Review.** Tell Opus (a separate Opus conversation if Opus built the step):

   ```
   Review the PR for docs/road-ready/claude-prompt-0N-<name>.md against that prompt and the playbook
   ```

   Opus reads the diff and CI from GitHub, records findings by severity, and the builder fixes them.

3. **Merge go.** When the review passes, tell Claude to merge that PR into `road-ready`. Then start the next step.

The nine build lines:

```
Do docs/road-ready/claude-prompt-01-tokens.md
Do docs/road-ready/claude-prompt-02-road.md
Do docs/road-ready/claude-prompt-03-louie.md
Do docs/road-ready/claude-prompt-04-tab-bar.md
Do docs/road-ready/claude-prompt-05-playing.md
Do docs/road-ready/claude-prompt-06-show-complete.md
Do docs/road-ready/claude-prompt-07-songbook.md
Do docs/road-ready/claude-prompt-08-me.md
Do docs/road-ready/claude-prompt-09-merch-builder.md
```

Models: 01 Sonnet, 02 Opus, 03 Opus, 04 Sonnet, 05 Opus, 06 Sonnet, 07 Sonnet, 08 Sonnet, 09 Opus.

You don't edit the prompts. Where the spec conflicts with something you decided before, the prompt tells Claude to stop and ask you (step 04 tab bar, steps 06 and 09 Merch items, step 08 game tips next to the real tip jar, and a few smaller choices).

## What's here

- `claude-build-plan.md`: the order, branches, who builds and reviews, the questions Claude will ask, and what the repo audit found.
- `claude-prompt-01-tokens.md` to `claude-prompt-09-merch-builder.md`: one handoff per step in the playbook format, with the steps that can't be undone first, "Always review: yes", the files it touches, acceptance criteria, accessibility, light and dark, screenshots, and what not to change.
- `louie-design-spec.md`: the design spec (colours, type, components, motion, Merch, Louie's rules).
- `asset-list.md`: which art ships as images and which is drawn in code.
- `images/`: the reference screens and Louie images the prompts name.

Step 01 also creates `docs/ROAD-READY-PLAN.md`, the running plan file with Graham's answers and surprises.
