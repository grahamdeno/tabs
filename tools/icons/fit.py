#!/usr/bin/env python3
# The horns icon, fitted so the whole amp, the hands and the tops of the boots
# sit inside the iOS icon mask with an even margin. The white dome behind the
# handle is taken out. Writes icons/fit/ and does not touch icons/horns/.

from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "docs/louie-tweed/cutouts/louie-horns.png"
DST = ROOT / "icons" / "fit"
BASE = (0x14, 0x12, 0x10)


def drop_white(im):
    """The cut-out left an opaque white dome behind the handle. Clear the light
    pixels that touch the edge of the picture, and stop at the tweed and the gloves."""
    arr = np.asarray(im.convert("RGBA")).copy()
    h, w = arr.shape[:2]
    rgb = arr[..., :3].astype(np.int16)
    a = arr[..., 3]
    light = (a > 20) & (rgb.min(-1) > 214) & ((rgb.max(-1) - rgb.min(-1)) < 42)
    seen = np.zeros((h, w), np.bool_)
    stack = []
    for x in range(w):
        if light[0, x]:
            stack.append((0, x))
        if light[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if light[y, 0]:
            stack.append((y, 0))
        if light[y, w - 1]:
            stack.append((y, w - 1))
    while stack:
        y, x = stack.pop()
        if seen[y, x] or not light[y, x]:
            continue
        seen[y, x] = True
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx]:
                stack.append((ny, nx))
    arr[seen, 3] = 0
    return Image.fromarray(arr, "RGBA")


def squircle(n):
    """The iOS icon mask, a superellipse, so the figure can be checked against it."""
    y, x = np.mgrid[0:n, 0:n]
    cx = (x + 0.5) / n * 2 - 1
    cy = (y + 0.5) / n * 2 - 1
    # a little inside the real mask, so nothing sits on the cut
    return (np.abs(cx) ** 5 + np.abs(cy) ** 5) <= 0.86


def fit(piece, master=1024):
    arr = np.asarray(piece)
    a = arr[..., 3]
    ys, xs = np.where(a > 16)
    if not len(ys):
        raise SystemExit("nothing left after clearing the white")
    crop = piece.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    mask = squircle(master)
    # shrink until every solid pixel sits inside the mask, with the same spare room each side
    lo, hi = 0.4, 0.92
    best = None
    cw, ch = crop.size
    for _ in range(14):
        scale = (lo + hi) / 2
        tw = max(1, int(round(master * scale)))
        th = max(1, int(round(tw * ch / cw)))
        if th > master:
            hi = scale
            continue
        sprite = crop.resize((tw, th), Image.Resampling.LANCZOS)
        x = (master - tw) // 2
        y = (master - th) // 2
        canvas = Image.new("RGBA", (master, master), (0, 0, 0, 0))
        canvas.alpha_composite(sprite, (x, y))
        solid = np.asarray(canvas)[..., 3] > 20
        if solid[~mask].any():
            hi = scale
        else:
            best = canvas
            lo = scale
    if best is None:
        raise SystemExit("could not fit Louie inside the icon")
    # even leftover: the gap above the hands and below the boots should match
    solid = np.asarray(best)[..., 3] > 20
    ys, xs = np.where(solid)
    top, bot = int(ys.min()), master - 1 - int(ys.max())
    left, right = int(xs.min()), master - 1 - int(xs.max())
    # nudge so the four gaps differ by at most a few pixels
    shift_y = (bot - top) // 2
    shift_x = (right - left) // 2
    nudged = Image.new("RGBA", (master, master), (0, 0, 0, 0))
    nudged.alpha_composite(best, (int(shift_x), int(shift_y)))
    solid = np.asarray(nudged)[..., 3] > 20
    if solid[~mask].any():
        nudged = best
    glow = Image.new("RGBA", (master, master), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((160, 260, 864, 980), fill=(255, 150, 40, 90))
    ground = Image.new("RGBA", (master, master), BASE + (255,))
    ground.alpha_composite(glow.filter(ImageFilter.GaussianBlur(90)))
    ground.alpha_composite(nudged)
    return ground


def save(im, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, format="PNG", optimize=True)
    print(path.relative_to(ROOT), im.size)


def main():
    piece = drop_white(Image.open(SRC))
    piece.save("/tmp/horns-clear.png")
    master = fit(piece, 1024)
    save(master, DST / "icon-1024.png")
    save(master, ROOT / "shots" / "icon-fit-1024.png")
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")):
        save(master.resize((size, size), Image.Resampling.LANCZOS), DST / name)
    # maskable keeps a further margin
    m = fit(piece, 1024)
    # already inside the mask; the maskable circle is smaller, so scale the figure down on the same ground
    inner = m.resize((int(1024 * 0.72), int(1024 * 0.72)), Image.Resampling.LANCZOS)
    plate = Image.new("RGBA", (1024, 1024), BASE + (255,))
    plate.alpha_composite(inner, ((1024 - inner.width) // 2, (1024 - inner.height) // 2))
    save(plate.resize((512, 512), Image.Resampling.LANCZOS), DST / "icon-maskable-512.png")
    # a 60 px check, enlarged so it can be looked at
    small = master.resize((60, 60), Image.Resampling.LANCZOS)
    save(small, DST / "icon-60.png")
    small.resize((240, 240), Image.Resampling.NEAREST).save("/tmp/icon-60-big.png")


if __name__ == "__main__":
    main()
