#!/usr/bin/env python3
# Build the app icons and iPhone launch screens from the black Louie v3 art.
# Run from the repo root: python3 -I tools/icons/make.py
#
# The icon is a close crop of Louie's face (handle, yellow panel, knobs) on the
# Dark ground (--rr-base, #141210), so he stays readable at 29 pt. The maskable
# icon is the same picture with a safe margin. Launch screens are the solid Dark
# ground and the full idle pose, with no text.

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

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
    master = icon(piece, 1024)
    save(master, ICONS / "icon-1024.png")
    save(master, ROOT / "shots" / "icon-1024.png")
    save(icon(piece, 512), ICONS / "icon-512.png")
    save(icon(piece, 192), ICONS / "icon-192.png")
    save(icon(piece, 180), ICONS / "apple-touch-icon.png")
    save(icon(piece, 32, sharpen=True), ICONS / "favicon-32.png")
    save(icon(piece, 512, pad=MASKABLE_PAD), ICONS / "icon-maskable-512.png")

    print("launch screens")
    for name, w, h, ratio in LAUNCH:
        save(launch(w, h, ratio, idle), SPLASH / name)
    sheet()


def sheet():
    """A simple labelled before/after of the old blue-on-pink art and the new black Louie."""
    old_dir = Path("/tmp/lgg16-old")
    old_icon = old_dir / "icon-512.png"
    old_splash = old_dir / "launch-1170x2532.png"
    if not old_icon.is_file() or not old_splash.is_file():
        print("  (no old icons in /tmp/lgg16-old; skipped shots/icon-before-after.jpg)")
        return
    new_icon = Image.open(ICONS / "icon-512.png").convert("RGB")
    new_splash = Image.open(SPLASH / "launch-1170x2532.png").convert("RGB")
    before_icon = Image.open(old_icon).convert("RGB")
    before_splash = Image.open(old_splash).convert("RGB")

    bg = (18, 16, 14)
    cream = (0xF6, 0xEA, 0xD2)
    muted = (168, 158, 140)
    line = (90, 84, 74)
    W, H = 1840, 1600
    img = Image.new("RGB", (W, H), bg)
    draw = ImageDraw.Draw(img)
    font_path = "/usr/share/fonts/truetype/sand-box/google/Space Grotesk/SpaceGrotesk-VariableFont_wght.ttf"
    def fnt(size):
        try:
            f = ImageFont.truetype(font_path, size=size)
            if hasattr(f, "set_variation_by_axes"):
                try: f.set_variation_by_axes([600])
                except Exception: pass
            return f
        except OSError:
            return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size=size)

    def put(xy, s, size, fill=cream):
        draw.text(xy, s, font=fnt(size), fill=fill, spacing=6)

    def squircle(src, scale, radius_frac=0.223):
        src = src.resize((scale, scale), Image.Resampling.LANCZOS)
        r = int(scale * radius_frac)
        mask = Image.new("L", (scale, scale), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, scale - 1, scale - 1), r, fill=255)
        out = Image.new("RGBA", (scale, scale), (0, 0, 0, 0))
        out.paste(src.convert("RGBA"), (0, 0))
        out.putalpha(mask)
        return out, r

    def phone(src, width=360):
        h = int(width * src.height / src.width)
        src = src.resize((width, h), Image.Resampling.LANCZOS)
        r = 36
        mask = Image.new("L", (width, h), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, width - 1, h - 1), r, fill=255)
        out = Image.new("RGBA", (width, h), (0, 0, 0, 0))
        out.paste(src.convert("RGBA"), (0, 0))
        out.putalpha(mask)
        return out, r

    def framed(tile, xy, radius):
        x, y = xy
        img.paste(tile, (x, y), tile)
        draw.rounded_rectangle((x, y, x + tile.width - 1, y + tile.height - 1), radius=radius, outline=line, width=2)

    put((80, 50), "Louie: home screen icon and loading screen", 42)
    put((80, 108), "Before is the old blue Louie on pink. After is black Louie on the new Road dark.", 22, muted)
    col = [420, 1100]
    put((col[0] + 140, 180), "Before", 34)
    put((col[1] + 150, 180), "After", 34)
    icon_y, icon_s = 240, 400
    put((80, icon_y + 160), "Home screen\nicon", 22, muted)
    for i, src in enumerate((before_icon, new_icon)):
        tile, r = squircle(src, icon_s)
        framed(tile, (col[i], icon_y), r)
    phone_y = 720
    put((80, phone_y + 280), "Loading\nscreen", 22, muted)
    for i, src in enumerate((before_splash, new_splash)):
        tile, r = phone(src, 360)
        x = col[i] + (icon_s - tile.width) // 2
        framed(tile, (x, phone_y), r)

    dest = ROOT / "shots" / "icon-before-after.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "JPEG", quality=92, optimize=True, subsampling=1)
    print(f"  {dest.relative_to(ROOT)}  {img.size}  {dest.stat().st_size} bytes")



if __name__ == "__main__":
    main()
