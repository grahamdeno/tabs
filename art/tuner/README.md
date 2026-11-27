# Tuner headstocks

Painted versions of the tuner headstocks already drawn in heads.js. The outline, the post places, the key boxes and the nut are the same. The paintings add wood grain, a lit edge, shading and highlights, so the heads are no longer flat colour.

The app still draws the six strings itself, using the coordinates in heads.json, and lights the string you are tuning.

## Scale

Every coordinate in heads.json is in image pixels, measured from the top left of the painting.

The scale is 1: one image pixel is one unit in heads.js. The acoustic canvas is 1485 by 2080, the electric canvas is 1338 by 2080, matching the `w` and `h` in heads.js. Post centres, nut crossings, key boxes and `nutY` are the heads.js numbers with no further conversion.

## Files

- `head-acoustic.webp`: the acoustic head, 1485 by 2080, transparent background. Warm wood in the same colour family as the current flat face (`#9A5B34`), cream keys and posts.
- `head-electric.webp`: the electric head, 1338 by 2080, transparent background. Dark tobacco in the same colour family as the fixed Dark finish (`#3B2417`), cream keys and posts, with a lit edge so it also reads on the cream Light page. One painting, no separate light version.
- `heads.json`: the scale, the size, and the coordinates for each painting, taken from heads.js.

The nut sits at `nutY` (1856), at the bottom of the painted object. There is no neck below it. The extra canvas below the nut is transparent, plus a short drop shadow. String slots in the face are left open, so the app can draw the strings on top. No strings are painted.
