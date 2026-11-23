# Painted guitarist

Transparent layers for the guitarist. Every file is 800 by 800. Stack them at 0,0. Nothing is shifted.

A master is flat light grey (`#D0D0D0`). The alpha is the shape. The matching shade file is the lighting. 128 leaves the colour as it is. Darker than 128 is shadow. Lighter is a highlight.

To tint a part, fill the master's alpha with the part colour, then multiply that colour by the shade divided by 128. Draw the shade with the master's alpha.

`manifest.json` lists every file and the order to stack them. A lefty flips the whole stack left to right about x = 400.

The figure is waist up. The top of the head is near y = 100. Hair and hats may rise above that. The app cuts the head and shoulders view, draws the stage card, and places the painted Road guitar. These layers leave the guitar out. Its neck runs to the viewer's right.

A beanie or a cap uses the tucked front of the hair. A bandana uses the full front. The back hair stays either way.

The file ids match the values the app already stores. The thin brow is `straight`. The long nose is `bridge`. The long mohawk is `longhawk`.

Happy and worried use the open eye (white, then the iris, then the pupil). Proud draws the lid and the lid line over that eye. Cheer and sleepy replace the open eye. Neutral brows rest. Worried lifts the inner ends. Raised lifts both, for cheer and proud.
