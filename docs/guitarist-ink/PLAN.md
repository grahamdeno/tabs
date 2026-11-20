# Your guitarist: inked cartoon now, painted next

Opus, Louie Review, 2026-11-20. Graham dropped the Gig poster look, looked at four avatar kits he found (a modular
asset pack, a web builder, a SwiftUI kit and a full-body studio builder) and two painted Gemini sheets, and chose:
ship the inked cartoon now, give Grok the painted sheets as the target for a painted guitarist built from layers, and
add the studio builder's extra parts later in small releases.

## Step 1. The inked cartoon (4.112.0) [Opus, done]

- `guitarist.js` draws flat cartoon parts in code on one 400 x 400 grid, back to front: back hair, body, top, strap,
  the Road guitar's painted picture, arms and hands, head, face, beard, front hair, hat, glasses, patches. One SVG
  filter draws the dark outline round the parts (like the line round Louie); the face details sit inside it.
- Kept from before: the same calls (`guitarist`, `you`, `rival`) and options (mood, pose, crop, look, patches,
  guitar, card, headline), so every screen that shows a guitarist is unchanged. The look follows the venue, the
  guitar is the Road guitar, patches are earned and hats are bought, as before.
- Crops: full (waist up with the guitar), three (the maker's card, room for TONIGHT), bust (head and shoulders in a
  disc, for chart rows and small cards) and face (the bust, closer in, for the maker's face-part buttons).
- New parts in the maker's Face tab: face shape (oval, square, round, heart), eyes (round, wide, narrow), eye colour
  (six), brows (natural, thick, arched, thin), nose (wedge, button, long, broad), freckles, glasses shape (round,
  square, shades) and nine skin tones. The mood sets the mouth and can close or lid the eyes.
- Data: the new parts are optional fields in `data.me`, kept only when not the default; skin indexes 0-5 keep their
  tones. No migration; a guitarist saved before 4.112.0 keeps exactly its fields (`cleanMe`, `docs/DATA.md`).
- Not drawn any more: `art/guitarist-poster.js` and its grain. The files stay until Graham says to remove them.

## Step 2. The painted guitarist [Grok, from Monday 2026-11-23]

Target: `docs/guitarist-painted/target-dark.jpg` and `target-light.jpg` (Graham's Gemini sheets): soft painted
cartoon, like the tweed Louie. The text in those sheets is garbled; they show the look, not a parts list.

What Grok makes, as transparent WebP layers on one shared canvas so they stack with no moving:

- Canvas: 800 x 800, the figure waist up, head top at about y 100, the guitar slung across the body with its neck to
  the viewer's right (a lefty is the same layers mirrored by the app). A second, head-and-shoulders crop is cut by
  the app; nothing extra is needed for it.
- Recolouring: each recolourable part as a light grey master plus a shading layer, so the app tints it (skin, hair,
  eye colour, top colour, hat colour). Parts that are never recoloured (glasses, shades) come in their own colours.
- Layers (the ids the app already stores):
  - Body: neck and shoulders; arms for the three poses (play: one hand strumming, one on the neck; hornsUp: one
    arm up making the horns; rest: arms down); hands as their own layer over the guitar.
  - Head: four face shapes (oval, square, round, heart), each with ears.
  - Eyes: round, wide, narrow, plus the mood versions (cheer: happy closed arcs; sleepy: closed; proud: half lids).
  - Brows: natural, thick, arched, thin, each in neutral, worried (inner ends up) and raised.
  - Nose: wedge, button, long, broad. Mouth: one per mood (happy, cheer, proud, sleepy, worried). Freckles.
  - Hair, front and back layers for all 13: shag, curly, buzz, mohawk, braids, bob, bun, swoop, long, locs, pixie,
    ponytail, long mohawk; plus a tucked front for each to sit under a beanie or a cap.
  - Beards: stubble, moustache, beard.
  - Tops, one per venue look: tee, flannel, vest, leather, stage, with matching sleeves for each pose.
  - Hats: beanie, cap, bandana. Glasses: round, square, shades.
- Not wanted: legs and shoes (the figure stops at the waist), backgrounds (the app draws the stage card), a drawn
  guitar (the app places the painted Road guitar).

## Step 3. The studio builder's extras [Opus or Sonnet, small releases, later]

From Graham's studio builder: more hats (fedora, cowboy hat, top hat, headphones, sweatband), more beards (goatee,
soul patch, chops), a pick necklace and piercings. Each goes in only where the game's rules allow: hats are bought at
the Merch table; nothing that the Road decides (guitar, outfit, stage) becomes a free pick.

## Surprises

- None yet.
