#!/usr/bin/env python3
# Fine Fender-style levant tolex: irregular pebbles, no lattice.
# Writes art/surfaces/tolex-dark-levant.webp. The earlier tiles stay.
# The Road draws the tile at 320 CSS px, so a 2 to 5 px pebble there is 4 to 10 px in this 640 px picture.

from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "art" / "surfaces" / "tolex-dark-levant.webp"


def pebbles(n=640, seed=23):
    rng = np.random.default_rng(seed)
    # 4 to 10 source px is 2 to 5 CSS px when the tile is drawn at 320 px
    rmin, rmax = 4.0, 10.0
    cell = 8
    grid = {}
    pts = []
    tries = n * n // 2
    for _ in range(tries):
        x = float(rng.random() * n)
        y = float(rng.random() * n)
        rad = float(rng.uniform(rmin, rmax))
        gx, gy = int(x // cell), int(y // cell)
        ok = True
        for j in range(gy - 4, gy + 5):
            for i in range(gx - 4, gx + 5):
                for px, py, pr in grid.get((i % (n // cell), j % (n // cell)), ()):
                    dx = abs(x - px)
                    dy = abs(y - py)
                    dx = min(dx, n - dx)
                    dy = min(dy, n - dy)
                    if dx * dx + dy * dy < (rad + pr) * 0.88 ** 2:
                        ok = False
                        break
                if not ok:
                    break
            if not ok:
                break
        if not ok:
            continue
        phase = float(rng.random() * np.pi * 2)
        squash = float(rng.uniform(0.65, 1.0))
        ang = float(rng.random() * np.pi)
        rec = (x, y, rad, phase, squash, ang)
        pts.append(rec)
        grid.setdefault((gx % (n // cell), gy % (n // cell)), []).append((x, y, rad))
    height = np.zeros((n, n), np.float32)
    glint = np.zeros((n, n), np.float32)
    for x, y, rad, phase, squash, ang in pts:
        R = int(rad * 1.8) + 2
        ca, sa = np.cos(ang), np.sin(ang)
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                rx = dx * ca + dy * sa
                ry = (-dx * sa + dy * ca) / squash
                theta = np.arctan2(ry, rx)
                wobble = 1 + 0.28 * np.sin(3 * theta + phase) + 0.16 * np.sin(5 * theta - phase)
                rr = rad * wobble
                dist = np.hypot(rx, ry)
                if dist >= rr:
                    continue
                h = (1 - (dist / rr) ** 2) ** 2
                xx = int(x + dx) % n
                yy = int(y + dy) % n
                if h > height[yy, xx]:
                    height[yy, xx] = h
                # a tiny catch of light on the upper-left of the pebble
                lx = rx + rad * 0.38
                ly = ry + rad * 0.38
                ld = np.hypot(lx, ly)
                if ld < 2.5:
                    glint[yy, xx] = max(glint[yy, xx], (1 - ld / 2.5) ** 2)
    shade = 10 + height * 16 + glint * 46
    # the Road samples the ground and expects it to stay near #141210
    shade = np.clip(shade * (20.0 / 29.5), 0, 255).astype(np.uint8)
    rgb = np.stack([
        np.clip(shade.astype(np.int16) + 2, 0, 255),
        np.clip(shade.astype(np.int16) + 1, 0, 255),
        shade.astype(np.int16),
    ], axis=-1).astype(np.uint8)
    return rgb, len(pts)


def main():
    rgb, npts = pebbles()
    im = Image.fromarray(rgb, "RGB")
    DST.parent.mkdir(parents=True, exist_ok=True)
    im.save(DST, "WEBP", quality=92, method=6)
    print(DST, im.size, npts, DST.stat().st_size)
    im.crop((0, 0, 180, 180)).save("/tmp/levant-1x.png")
    # the size the Road paints one tile, then a 3x look at that
    shown = im.resize((320, 320), Image.Resampling.LANCZOS)
    shown.crop((40, 40, 160, 160)).resize((360, 360), Image.Resampling.NEAREST).save("/tmp/levant-phone3.png")
    tile = Image.new("RGB", (640, 320))
    tile.paste(shown, (0, 0))
    tile.paste(shown, (320, 0))
    tile.save("/tmp/levant-seam.jpg", quality=90)


if __name__ == "__main__":
    main()
