# Louie v3: black Louie

Graham chose black as Louie's default colour (Nov 19, 2026). These files replace nothing yet: art/louie/v2 (blue) is untouched, and the app still points at v2 until the code is switched.

## What changed from v2

Only the colours and the lighting. Every pose is made from the matching v2 light picture, pixel for pixel, so his shape, eyes, mouth, hands, legs and pose outlines are exactly the v2 ones.

- **Tolex:** the blue is now a lifted charcoal black (about #292929 on average, grain highlights up to about #404040), not pure black. The v2 pebble grain, seams and shine are kept, so he reads as textured tolex rather than a flat black shape.
- **Grille:** silver-grey woven cloth (about #767572 on average) instead of navy, with the same diamond weave. Black tolex with a silver grille is the classic amp look, and it keeps the grille clearly cloth. It is plain cloth with no features.
- **Kept as they were:** the yellow control-panel face, the one mouth, the eyes, the four cream knobs, the nickel corners, the brown handle and the name plate.
- **Hands, arms and legs:** the same charcoal tolex as his body, with fingers, as in v2.

## How he stands out on the black Dark look

His charcoal body alone is only about 1.3 to 1 against the Dark ground (#141210), so the dark pictures carry the light:

1. **A warm outline.** The -dark files keep v2's 12 px margin (12 px bigger on each side than the light ones, so louie.js draws them at the same size). In it: a solid 2.5 px cream line (#FFE2B4) hugging his outline, which turns into a warm amber glow (#F5A840) and fades out by 12 px. The cream line is about 15 to 1 against #141210.
2. **An amber rim light** on his own edges, strongest on the upper right (towards the guitar's warm glow on the Road), so his arms, hands and legs look lit and round instead of cut out.
3. **The lifted charcoal and the silver grille** keep his inside readable, and the yellow face panel and the nickel corners already stand out.

On the cream Light look no outline is needed: the charcoal body is about 12.6 to 1 against #F6EFE2. The -light files have no rim, as in v2.

## Files

Same names and sizes as art/louie/v2: ten poses (cheer, horns, idle, listen, nervous, point, proud, sleepy, thumb, wave), each as -light (the v2 light size, 600 px tall) and -dark (24 px bigger, 624 px tall). Transparent WebP, all under 60 KB.

louie-face-badge.webp is 132 by 132: his control panel (eyes, mouth, knobs) cropped from the idle pose, in a cream circle with a thin nickel ring, transparent outside the circle. It reads on both looks at 44 and 32 px.

## Not done here

- The app code still loads art/louie/v2. Switching louie.js, styles.css, sw.js and the tests to v3, and updating the spec's locked palette (section 9) and the code-drawn fallback colours, is a separate change.
- The two Road peek pictures (art/louie/louie-peek-*.webp) are still blue.
