# Road Ready build docs

The Road Ready redesign, as nine steps for Claude. Each step is one branch and one pull request for Graham to review. Nothing is merged without him.

## How to use

Tell Claude one line per step, in order, and wait for the PR before the next:

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

Before each one, open the prompt and check its tick boxes ("Graham's decision"). Claude stops and asks if a needed box isn't ticked.

## What's here

- `claude-build-plan.md`: the order, what each step does, the decisions, and what the repo audit found.
- `claude-prompt-01-tokens.md` to `claude-prompt-09-merch-builder.md`: one prompt per step. Each names the files it touches, what to build, acceptance criteria, accessibility, light and dark, screenshots, and what not to change.
- `louie-design-spec.md`: the design spec (colours, type, components, motion, Merch, Louie's rules).
- `asset-list.md`: which art ships as images and which is drawn in code.
- `images/`: the reference screens and Louie images the prompts name.

Step 01 also creates `docs/ROAD-READY-PLAN.md`, the running plan file with decisions and surprises.
