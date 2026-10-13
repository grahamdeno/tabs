# Reference screenshots

- `ci/`: made on GitHub's machines by the **update screenshots** workflow. Every
  push is compared against these. Run the workflow again after an intended
  change to how screens look (Actions > update screenshots > Run workflow).
- The PNGs here: made locally, for `VISUAL=compare node --test tests/e2e/visual.e2e.mjs`
  on the same machine. Remake them with `VISUAL=update`.
