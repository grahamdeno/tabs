# Look A guitar redraw tools (Grok, box only, not used by the app)

These scripts made the look A guitar pictures in art/guitars/ and the builder layers in art/guitars/builder/.
They ran on Grok's box. Every script reads its working folder from the LOOKA_ROOT environment variable, with
/workspace/cartoon-test/full as the default, so they are kept here as a record of how the art was made, not as a build step.

- cut.py, cutone.py, cutall.sh: cut each painted guitar off its green or magenta background, traced at 4x and smoothed,
  with the rim colour cleaned so there is no green, olive or yellow fringe.
- geom.py, overrides.json: where the board ends and where the bridge sits on each painting.
- build.py, buildall.sh: puts each road picture together at today's size: the painted head and body scaled evenly,
  painted strings removed, the board, frets, inlays, nut and strings drawn at the rows in frets.json and pics.js.
- export.py: writes road, body, small and head webps at today's pixel sizes.
- builder.py, builder-cfg.json: the builder layers for the seven Road guitars, cut from the new road pictures.
- basheet.py, prevsheet.py: the before and after sheet and the builder preview sheet.
