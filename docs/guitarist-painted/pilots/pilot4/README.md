# Painted layer pilot, round 4

Same two people as round 3. The boy keeps the round 3 base. The woman is a new base in the same pose, lighting and painted style, with a softer brow, lashes and a fuller lip, so she reads as a woman with every hair. Both wear a dark grey crew neck. The hair is painted on a flat mid-grey backdrop.

The image tool still cannot take a mask. Each hair is painted freely over the forehead, the temples and the ears. There is no cut at the eyebrows. The eyes, the nose and the mouth are put back from the base through a soft mask about 8 pixels wide, so the face stays the same where it matters and the hair can overlap the forehead. The layer is the difference from the base. Edge pixels are un-premultiplied against the grey, the alpha is choked by 1 pixel, and the remaining soft edge takes its colour from the nearest solid pixel inside the shape. A shaved side is the buzz painted over with skin, feathered so it can blend. Grey pixels the paint left on the buzz are filled from the fade beside them. The mohawk spikes are turned to neutral grey so a colour tint can recolour them. Gold studs are kept on the woman's bob and her mohawk.

Files for the boy: `body.webp`, `hair-curly.webp`, `hair-long.webp`, `hair-pixie.webp`, `hair-mohawk.webp`, `top-flannel.webp`, `top-leather.webp`. The woman has the same set with an `f-` prefix: `f-body.webp`, `f-hair-waves.webp`, `f-hair-bob.webp`, `f-hair-mohawk.webp`, `f-top-flannel.webp`, `f-top-leather.webp`.

On the eye, nose and mouth hold, the raw edit still repaints the face (mean difference from about 5 to about 48). After the restore, the mean difference on that hold is under 1. The max on the hold is the feather, about 25 to 31, not a second face.

This is not clean enough to build the full parts list. The bob flows around the head with no square notch, and its edge is clean on both the dark backdrop (#181614) and the light one (#F0EADE). The woman keeps one face, and the studs sit on the bob and the mohawk. The mohawk sides still step. They read as a cut fade, not as soft stubble that blends into the skin. The spikes pick up a cool rim, and the long hair still has a small hole at the crown. Every layer still needs this repair by hand.

This pilot is not wired into the app. `pilot/`, `pilot2/` and `pilot3/` are unchanged.
