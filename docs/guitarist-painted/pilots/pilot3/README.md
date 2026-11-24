# Painted layer pilot, round 3

Two bases, both painted on a flat mid-grey backdrop (#808080). The first is the boy from round 2. The second is a woman in the same pose, the same lighting and the same painted style, with her own face. Each base has a dark grey crew neck and a buzz cut that has been flattened to a soft dark shadow, so it is not a drawn hair texture.

The image tool still cannot take a mask. Each variant is an edit of its own base. Every pixel outside the hair or the shirt is put back from the base, so the face is the base face. On the locked picture the face difference is 0. The model still repaints the face before that lock (the raw difference on the face is large).

Edge pixels are un-premultiplied against the grey backdrop, the alpha is choked by 1 pixel, and the remaining soft edge takes its colour from the nearest solid pixel inside the shape. Each full hair also covers the shadow cap under it and runs about 6 pixels down onto the forehead in one falloff. The mohawk does not cover the sides. Those stay the shadow, which is the shaved scalp. The mohawk is turned to neutral grey so a colour tint can recolour it.

Files for the boy: `body.webp`, `hair-curly.webp`, `hair-long.webp`, `hair-pixie.webp`, `hair-mohawk.webp`, `top-flannel.webp`, `top-leather.webp`. The woman has the same set with an `f-` prefix: `f-body.webp`, `f-hair-waves.webp`, `f-hair-bob.webp`, `f-hair-mohawk.webp`, `f-top-flannel.webp`, `f-top-leather.webp`.

This is not clean enough to build the full parts list. The pink fringe from the old magenta backdrop is gone, and the centre of a hairline is one short falloff. The mask still cuts notches at the temples, the mohawk sits in a gap on the shadow with a stepped edge, and a grey mohawk on a grey backdrop still leaves a light fringe the despill cannot see. Every layer still needs this repair by hand.

This pilot is not wired into the app. `pilot/` and `pilot2/` are unchanged.
