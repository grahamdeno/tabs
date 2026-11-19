#!/usr/bin/env python3
# Build the app icons and iPhone launch screens from the black Louie v3 art.
# Run from the repo root: python3 -I tools/icons/make.py
#
# The icon is a close crop of Louie's face (handle, yellow panel, knobs) on the
# Dark ground (--rr-base, #141210), so he stays readable at 29 pt. The maskable
# icon is the same picture with a safe margin. Launch screens are the solid Dark
# ground and the full idle pose, with no text.

from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
LOUIE = ROOT / "art/louie/v3/louie-idle-dark.webp"
ICONS = ROOT / "icons"
SPLASH = ICONS / "splash"

# Road Ready dark ground, the same token as styles.css --rr-base on data-look neon.
BASE = (0x14, 0x12, 0x10)
# Square crop in louie-idle-dark.webp: handle through the knobs, face centred.
# Source is 517 x 624. Chosen so the face stays large at 29 pt and the handle
# clears the iOS rounded mask.
CROP = (85, 2, 431, 348)
# Maskable safe zone is a centred circle 80 percent of the side. 15 percent
# padding keeps the handle and the nickel corners inside that circle.
MASKABLE_PAD = 0.15
# Launch screen: solid --rr-base and Louie at 44 percent of the width,
# vertically centred. Plenty of ground around him, no wordmark. A tolex tile
# would match the running app but makes each PNG a few megabytes, so the
# splash uses the same flat ground as theme-color and background_color.
SPLASH_WIDTH = 0.44

# (filename, width, height, device-pixel-ratio), matching index.html.
LAUNCH = [
    ("launch-1320x2868.png", 1320, 2868, 3),
    ("launch-1290x2796.png", 1290, 2796, 3),
    ("launch-1284x2778.png", 1284, 2778, 3),
    ("launch-1206x2622.png", 1206, 2622, 3),
    ("launch-1179x2556.png", 1179, 2556, 3),
    ("launch-1170x2532.png", 1170, 2532, 3),
    ("launch-1125x2436.png", 1125, 2436, 3),
    ("launch-828x1792.png", 828, 1792, 2),
    ("launch-750x1334.png", 750, 1334, 2),
]


def crop_louie():
    src = Image.open(LOUIE).convert("RGBA")
    x0, y0, x1, y1 = CROP
    return src.crop((x0, y0, x1, y1))


def icon(piece, size, pad=0.0, sharpen=False):
    """piece is the cropped transparent Louie. pad is a fraction on each side."""
    master = 1024
    canvas = Image.new("RGBA", (master, master), BASE + (255,))
    inner = int(round(master * (1 - 2 * pad)))
    fitted = piece.resize((inner, inner), Image.Resampling.LANCZOS)
    xy = (master - inner) // 2
    canvas.alpha_composite(fitted, (xy, xy))
    out = canvas.resize((size, size), Image.Resampling.LANCZOS)
    if sharpen and size <= 32:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=90, threshold=2))
    return out.convert("RGB")


def launch(w, h, _ratio, louie):
    bg = Image.new("RGB", (w, h), BASE)
    # Size Louie by width, keep his aspect. The dark pose already carries the glow.
    tw = int(round(w * SPLASH_WIDTH))
    th = int(round(tw * louie.size[1] / louie.size[0]))
    sprite = louie.resize((tw, th), Image.Resampling.LANCZOS)
    x = (w - tw) // 2
    y = (h - th) // 2
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    layer.paste(sprite, (x, y), sprite)
    out = bg.convert("RGBA")
    out.alpha_composite(layer)
    return out.convert("RGB")


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True, compress_level=9)
    print(f"  {path.relative_to(ROOT)}  {im.size[0]}x{im.size[1]}  {path.stat().st_size} bytes")


def main():
    if not LOUIE.is_file():
        raise SystemExit(f"missing {LOUIE}")
    piece = crop_louie()
    idle = Image.open(LOUIE).convert("RGBA")

    print("icons")
    save(icon(piece, 512), ICONS / "icon-512.png")
    save(icon(piece, 192), ICONS / "icon-192.png")
    save(icon(piece, 180), ICONS / "apple-touch-icon.png")
    save(icon(piece, 32, sharpen=True), ICONS / "favicon-32.png")
    save(icon(piece, 512, pad=MASKABLE_PAD), ICONS / "icon-maskable-512.png")

    print("launch screens")
    for name, w, h, ratio in LAUNCH:
        save(launch(w, h, ratio, idle), SPLASH / name)


if __name__ == "__main__":
    main()
