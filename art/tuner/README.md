# Tuner headstocks

Painted headstocks for the Louie tuner. The app draws the six strings itself, using the coordinates in heads.json, and lights the string you are tuning.

## Files

- `head-acoustic.webp`: a 3+3 acoustic head with a rosewood veneer, cream binding, pearl buttons and brass posts. 1600 by 2200 pixels, transparent background.
- `head-electric.webp`: a slimmer 3+3 electric head in tobacco sunburst over maple, with chrome tuners and a polished bevel. Same size.
- `heads.json`: the size and the coordinates for each painting.

There is one painting of each. Both are made to read on the dark tolex background (#141312) and the cream Light background (#F6EFE3).

## Coordinates

All numbers in heads.json are in image pixels, measured from the top left of the painting.

For each headstock:

- `width`, `height`: the image size in pixels.
- `posts`: the centre of each tuner post, low E first, then A, D, G, B, and high e.
- `nut`: where each string crosses the nut, `x` and `y`, in the same order.
- `keys`: the box around each tuner button, in the same order. `side` is `left` or `right`. The box is `{x, y, w, h}`. Leave the space outside each box for the note labels.

The nut sits at the bottom edge of the painting. There is no neck below it. No strings are painted.
