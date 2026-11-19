# The tweed Louie

Graham's new Louie, 2026-11-19. He replaces every earlier Louie in the app.

- `source/`: Graham's pictures as he sent them (1024 px, white background), and `pose-sheet.jpg`, the sheet of ten poses.
- `cutouts/`: the same four poses with the background removed, at full size, and the round face badge. Claude made these
  on Graham's go so the app could show him. They are a stand-in: Grok redoes them.
- The app shows `art/louie/v4/louie-<pose>.webp` (640 px on the long side) and `louie-face-badge.webp` (132 px). The icons
  and loading screens are built from `cutouts/louie-idle.png` by `tools/icons/make.py`.

## For Grok

1. Redo the four cut-outs (cheer, horns, idle, listen) with clean edges. The method used: everything joined to the white
   border is removed, plus the flat off-white gap under the handle, with a soft 4 px edge. Look at the glove edges on Dark.
2. Six poses are missing: nervous, point, proud, sleepy, thumb, wave. Until they arrive each borrows another pose
   (`LOUIE_STAND_IN` in `louie.js`). To add one: `art/louie/v4/louie-<pose>.webp`, add it to `SHELL` in `sw.js`, take it
   out of `LOUIE_STAND_IN`, and add it to the list in the Louie test in `tests/core.test.mjs`.
3. His other colours, for the Merch table. Louie's finishes are hidden until then.
4. The app icon and the maskable icon show part of an arm and a glove at the edges. A face-only picture would be cleaner.
5. Louie is drawn at the same frame the earlier Louies had, so a wide pose (cheer, horns) looks smaller than a narrow one.
