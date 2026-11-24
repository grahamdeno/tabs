#!/usr/bin/env python3
# Painted stage backdrops for the Merch table. Same size as the first set.
# Writes art/merch/paint-*.webp and does not touch backdrop-*.webp.

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
DST = ROOT / "art" / "merch"
W, H = 400, 256


def fbm(rng, w, h, octaves=5, seed_scale=4):
    acc = np.zeros((h, w), np.float32)
    amp = 1.0
    total = 0.0
    for i in range(octaves):
        sw, sh = max(2, w // (seed_scale * 2 ** i)), max(2, h // (seed_scale * 2 ** i))
        n = rng.random((sh, sw)).astype(np.float32)
        im = Image.fromarray(np.clip(n * 255, 0, 255).astype(np.uint8), "L").resize((w, h), Image.Resampling.BICUBIC)
        acc += np.asarray(im, np.float32) / 255 * amp
        total += amp
        amp *= 0.5
    return acc / total


def save(rgb, name):
    im = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    path = DST / name
    im.save(path, "WEBP", quality=90, method=6)
    print(path.name, im.size, path.stat().st_size)
    return im


def basement():
    rng = np.random.default_rng(3)
    n = fbm(rng, W, H, 6, 3)
    # concrete: cool grey, stained
    wall = 58 + n * 28
    stain = fbm(rng, W, H, 4, 6)
    wall = wall + (stain - 0.5) * 16
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(0, 1, W)[None, :]
    # a bare bulb, up and a little left, with a warm pool and a hard little core
    bulb = np.exp(-(((xx - 0.38) / 0.045) ** 2 + ((yy - 0.22) / 0.06) ** 2))
    pool = np.exp(-(((xx - 0.40) / 0.42) ** 2 + ((yy - 0.34) / 0.48) ** 2))
    # the floor is a darker plane
    floor = np.clip((yy - 0.72) / 0.28, 0, 1)
    wall = wall * (1 - floor * 0.45) + floor * (32 + n * 10)
    # cracks
    crack = fbm(rng, W, H, 5, 2)
    crack = np.clip((crack - 0.62) * 8, 0, 1) * (1 - floor)
    wall = wall * (1 - crack * 0.35)
    warm = pool * 0.85 + bulb * 0.9
    r = wall + warm * 78
    g = wall + warm * 48
    b = wall + warm * 16 - pool * 8
    # the bulb itself
    r = r + bulb * 180
    g = g + bulb * 160
    b = b + bulb * 110
    return np.stack([r, g, b], -1)


def brick():
    rng = np.random.default_rng(5)
    yy, xx = np.indices((H, W))
    row_h = 22
    brick_w = 46
    row = yy // row_h
    offset = (row % 2) * (brick_w // 2)
    col = (xx + offset) // brick_w
    # mortar: a dark joint
    lx = (xx + offset) % brick_w
    ly = yy % row_h
    mortar = (lx < 3) | (ly < 3)
    # each brick its own colour
    key = (row * 17 + col * 13) & 255
    rng2 = np.random.default_rng(9)
    palette = 150 + rng2.random(256) * 50
    red = palette[key]
    # bevel: light on the top and left of the brick, shade on the bottom and right
    bevel = np.clip(ly / row_h, 0, 1)
    side = np.clip(lx / brick_w, 0, 1)
    light = 1.05 - bevel * 0.28 - side * 0.12
    noise = fbm(rng, W, H, 4, 4)
    red = red * light * (0.92 + noise * 0.16)
    # a chip or two
    chip = fbm(rng, W, H, 3, 8)
    red = red * (1 - np.clip((chip - 0.78) * 6, 0, 1) * 0.25)
    r = np.where(mortar, 78, red)
    g = np.where(mortar, 62, red * 0.46)
    b = np.where(mortar, 54, red * 0.34)
    # mortar depth: a shadow just under each joint
    shade = ((ly < 5) & (ly >= 3)) | ((lx < 5) & (lx >= 3))
    r = np.where(shade, r * 0.72, r)
    g = np.where(shade, g * 0.72, g)
    b = np.where(shade, b * 0.72, b)
    # warm stage light from above
    yyf = np.linspace(0, 1, H)[:, None]
    spot = np.exp(-((yyf - 0.15) / 0.7) ** 2) * 0.35
    r = r + spot * 40
    g = g + spot * 18
    b = b + spot * 4
    return np.stack([r, g, b], -1)


def stars():
    rng = np.random.default_rng(8)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(0, 1, W)[None, :]
    # night, lighter toward a low horizon
    horizon = np.exp(-((yy - 0.78) / 0.22) ** 2)
    sky_r = 8 + yy * 6 + horizon * 48
    sky_g = 12 + yy * 10 + horizon * 28
    sky_b = 28 + (1 - yy) * 18 + horizon * 20
    cloud = fbm(rng, W, H, 5, 5)
    veil = np.clip(cloud - 0.45, 0, 1) * (1 - horizon) * 18
    rgb = np.stack([sky_r + veil * 0.4, sky_g + veil * 0.5, sky_b + veil], -1)
    # stars at a few depths: small sharp ones far away, larger soft ones nearer
    for count, radius, gain, blur in ((70, 0.6, 180, 0), (28, 1.1, 220, 0.4), (8, 1.8, 255, 0.8)):
        layer = np.zeros((H, W), np.float32)
        for _ in range(count):
            x = int(rng.integers(2, W - 2))
            y = int(rng.integers(2, int(H * 0.72)))
            layer[y, x] = gain * float(rng.uniform(0.4, 1))
        im = Image.fromarray(np.clip(layer, 0, 255).astype(np.uint8), "L")
        if blur:
            im = im.filter(ImageFilter.GaussianBlur(blur))
        star = np.asarray(im, np.float32)
        rgb = rgb + star[..., None] * np.array([0.85, 0.9, 1.0])
    return rgb


def sunset():
    rng = np.random.default_rng(4)
    yy = np.linspace(0, 1, H)[:, None]
    xx = np.linspace(0, 1, W)[None, :]
    # sky
    r = 255 - yy * 80
    g = 150 + (1 - yy) * 40 - yy * 90
    b = 70 + yy * 40
    # sun
    sun = np.exp(-(((xx - 0.62) / 0.16) ** 2 + ((yy - 0.62) / 0.20) ** 2))
    r = r + sun * 40
    g = g + sun * 30
    b = b + sun * 10
    # painted clouds: soft blobs of noise, lit underneath
    cloud = fbm(rng, W, H, 6, 3)
    mask = np.clip((cloud - 0.42) * 3.2, 0, 1) * np.clip((0.55 - yy) * 2.2, 0, 1)
    under = np.clip(sun * 0.8 + (0.7 - yy), 0, 1)
    r = r * (1 - mask * 0.25) + mask * (230 * under + 180 * (1 - under))
    g = g * (1 - mask * 0.35) + mask * (140 * under + 90 * (1 - under))
    b = b * (1 - mask * 0.45) + mask * (90 * under + 70 * (1 - under))
    # a low hill, painted, not a sine wave: one soft ridge with a noisier edge
    ridge = 0.78 + (fbm(rng, W, 8, 3, 1)[0] - 0.5) * 0.08
    hill = np.clip((yy - ridge) / 0.05, 0, 1)
    ground = fbm(rng, W, H, 3, 4)
    r = r * (1 - hill) + hill * (28 + ground * 12)
    g = g * (1 - hill) + hill * (16 + ground * 8)
    b = b * (1 - hill) + hill * (18 + ground * 6)
    return np.stack([r, g, b], -1)


def main():
    DST.mkdir(parents=True, exist_ok=True)
    save(basement(), "paint-basement.webp")
    save(brick(), "paint-brick.webp")
    save(stars(), "paint-stars.webp")
    save(sunset(), "paint-sunset.webp")
    # a contact sheet
    names = ["paint-basement.webp", "paint-brick.webp", "paint-stars.webp", "paint-sunset.webp"]
    sheet = Image.new("RGB", (W * 4 + 24, H), (12, 10, 8))
    for i, name in enumerate(names):
        sheet.paste(Image.open(DST / name), (i * (W + 8), 0))
    sheet.save("/tmp/backdrops-sheet.jpg", quality=90)


if __name__ == "__main__":
    main()
