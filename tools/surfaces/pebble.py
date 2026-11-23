#!/usr/bin/env python3
# A fine, even pebbled leather tile for the Dark Road.
# Writes art/surfaces/tolex-dark-pebble.webp and does not touch the older tiles.
# The cells are small and rounded, with a soft highlight and a dark crease, near black,
# and the contrast stays low so type on the Road can still be read. The tile repeats.

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "art" / "surfaces" / "tolex-dark-pebble.webp"


def pebble(n=512, cells=42, seed=11):
    rng = np.random.default_rng(seed)
    step = n / cells
    px = np.zeros((cells, cells), np.float32)
    py = np.zeros((cells, cells), np.float32)
    for j in range(cells):
        for i in range(cells):
            px[j, i] = ((i + 0.5 + rng.uniform(-0.46, 0.46)) * step) % n
            py[j, i] = ((j + 0.5 + rng.uniform(-0.46, 0.46)) * step) % n
    yy, xx = np.indices((n, n))
    ci = np.minimum((xx / step).astype(np.int32), cells - 1)
    cj = np.minimum((yy / step).astype(np.int32), cells - 1)
    d1 = np.full((n, n), np.float32(1e9))
    d2 = np.full((n, n), np.float32(1e9))
    xf = xx.astype(np.float32)
    yf = yy.astype(np.float32)
    for dj in (-1, 0, 1):
        for di in (-1, 0, 1):
            ni = (ci + di) % cells
            nj = (cj + dj) % cells
            dx = xf - px[nj, ni]
            dy = yf - py[nj, ni]
            dx -= np.round(dx / n) * n
            dy -= np.round(dy / n) * n
            dist = np.hypot(dx, dy)
            closer = dist < d1
            between = (dist < d2) & ~closer
            d2 = np.where(closer, d1, np.where(between, dist, d2))
            d1 = np.where(closer, dist, d1)
    # the crease is the gap between two cells; the centre of a cell stays rounded
    edge = np.clip((d2 - d1) / (step * 0.16), 0, 1)
    t = np.clip(d1 / (step * 0.55), 0, 1)
    dome = 1 - t ** 2
    height = (edge ** 0.65) * (0.55 + 0.45 * dome)
    # wrap so the blur does not leave a seam
    pad = np.pad(height, 8, mode="wrap")
    soft = np.asarray(Image.fromarray(np.clip(pad * 255, 0, 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.7)), np.float32) / 255
    height = soft[8:-8, 8:-8]
    gy, gx = np.gradient(height)
    light = np.clip(0.62 + (-gx * 0.55 - gy * 0.72) * 3.4, 0.35, 1)
    # near black, a small range, so a title still reads
    shade = 14 + height * light * 22
    # a whisper of larger wobble, not enough to turn the tile into marble
    slow = rng.random((cells, cells)).astype(np.float32)
    slow = np.asarray(Image.fromarray(np.clip(slow * 255, 0, 255).astype(np.uint8), "L").resize((n, n), Image.Resampling.BICUBIC), np.float32) / 255
    shade = shade + (slow - 0.5) * 3.5
    grain = rng.normal(0, 0.7, (n, n)).astype(np.float32)
    shade = shade + grain
    img = np.clip(shade, 0, 255).astype(np.uint8)
    rgb = np.stack([np.clip(img.astype(np.int16) + 3, 0, 255),
                    np.clip(img.astype(np.int16) + 1, 0, 255),
                    img.astype(np.int16)], axis=-1).astype(np.uint8)
    return rgb


def main():
    rgb = pebble()
    # the left edge must meet the right, and the top the bottom
    if abs(int(rgb[:, 0].mean()) - int(rgb[:, -1].mean())) > 8:
        raise SystemExit("the tile does not meet at the sides")
    im = Image.fromarray(rgb, "RGB")
    DST.parent.mkdir(parents=True, exist_ok=True)
    im.save(DST, "WEBP", quality=92, method=6)
    print(DST, im.size, DST.stat().st_size)
    # a 3x crop for the eye, and a tiled patch
    crop = im.crop((180, 180, 340, 340)).resize((480, 480), Image.Resampling.NEAREST)
    crop.save("/tmp/pebble-3x.png")
    tile = Image.new("RGB", (512, 512))
    s = im.resize((256, 256), Image.Resampling.LANCZOS)
    tile.paste(s, (0, 0)); tile.paste(s, (256, 0)); tile.paste(s, (0, 256)); tile.paste(s, (256, 256))
    tile.save("/tmp/pebble-tile.jpg", quality=90)


if __name__ == "__main__":
    main()
