#!/usr/bin/env python3
# Paint elevation onto the existing guitar pictures without moving a pixel of the
# instrument: gloss on the top and binding that catches light from the upper left.
# The soft shadow is drawn by the app (it needs room the picture does not have).
# The canvas size stays the same, so the fret numbers in art/guitars/pics.js still
# line up. Originals are left where they are.
# Run from the repo root: python3 tools/guitars/elevate.py

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "guitars"
DST = SRC / "elev"
LIT = np.array([255.0, 248.0, 230.0])


def kind_of(name):
    if name.endswith("-road"):
        return "road"
    if name.endswith("-body"):
        return "body"
    if name.endswith("-head"):
        return "head"
    return "small"


def body_rows(kind, h):
    # The neck and headstock stay as painted. Gloss and shade land on the body.
    if kind == "road":
        return int(h * 0.50), h
    if kind == "small":
        return int(h * 0.46), h
    if kind == "head":
        return 0, h
    return 0, h


def elevate(im, kind):
    arr = np.asarray(im.convert("RGBA")).astype(np.float32)
    h, w = arr.shape[:2]
    rgb = arr[..., :3]
    a = arr[..., 3] / 255.0
    # The antialiased fringe keeps its colour, so the cut-out does not grow a halo.
    core = np.clip((a - 0.88) / 0.12, 0, 1)
    y0, y1 = body_rows(kind, h)
    region = np.zeros((h, w), np.float32)
    fade = 36 if kind in ("road", "small") else 0
    if fade and y0 + fade < y1:
        ramp = np.linspace(0, 1, fade, dtype=np.float32)[:, None]
        region[y0:y0 + fade, :] = ramp
        region[y0 + fade:y1, :] = 1
    else:
        region[y0:y1, :] = 1
    face = core * region

    yy, xx = np.mgrid[0:h, 0:w]
    sel = face > 0.5
    if sel.any():
        ys, xs = np.where(sel)
        top, bot = ys.min(), ys.max()
        left, right = xs.min(), xs.max()
    else:
        top, bot, left, right = 0, h - 1, 0, w - 1
    bh = max(1, bot - top)
    bw = max(1, right - left)
    ny = (yy - top) / bh
    nx = (xx - left) / bw

    # A broad warm lift on the upper left of the top, and a tighter lacquer streak.
    broad = np.exp(-(((ny - 0.22) / 0.34) ** 2 + ((nx - 0.38) / 0.46) ** 2))
    streak = np.exp(-(((ny - 0.16) / 0.10) ** 2 + ((nx - 0.32) / 0.28) ** 2))
    # Brighten the paint that is already there. A wash toward white reads as a sticker.
    gloss = face * (0.10 * broad + 0.18 * streak)
    if kind == "head":
        gloss = face * 0.12 * np.exp(-(((ny - 0.28) / 0.30) ** 2 + ((nx - 0.40) / 0.36) ** 2))
    out = rgb * (1 + gloss[..., None])
    cap = (255.0 - rgb) * 0.22
    out = rgb + np.minimum(out - rgb, cap)

    # The lower right of the body falls off, so the top reads as a curve.
    fall = np.clip((ny - 0.35) * 0.28 + (nx - 0.45) * 0.10, 0, 0.22)
    out *= (1 - fall * face)[..., None]

    # Binding: the inward rim, bright where it faces the light, darker opposite.
    mask = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
    inner = np.asarray(mask.filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255.0
    deeper = np.asarray(mask.filter(ImageFilter.MinFilter(7))).astype(np.float32) / 255.0
    rim = np.clip(inner - deeper, 0, 1) * core
    gy, gx = np.gradient(a)
    mag = np.hypot(gx, gy) + 1e-6
    # Outward normal. Light is up and to the left (y grows downward).
    ox, oy = -gx / mag, -gy / mag
    ndot = ox * -0.55 + oy * -0.84
    lit = rim * np.clip(ndot, 0, 1)
    shade_rim = rim * np.clip(-ndot, 0, 1)
    out += (LIT - out) * (lit * 0.72)[..., None]
    out *= (1 - shade_rim * 0.28)[..., None]

    out = np.clip(out * core[..., None] + rgb * (1 - core)[..., None], 0, 255)
    final = np.dstack([out, np.clip(a * 255, 0, 255)]).astype(np.uint8)
    return Image.fromarray(final, "RGBA")


def sources():
    # A guitar with a whole-instrument picture (the 23) is shown from -road and -small.
    # Head and body pictures are shown only for the eight older guitars, which have no -road.
    roads = {p.name[: -len("-road.webp")] for p in SRC.glob("*-road.webp")}
    for p in sorted(SRC.glob("*.webp")):
        stem = p.stem
        if stem.endswith(("-road", "-small")):
            yield p
        elif stem.endswith(("-head", "-body")) and stem.rsplit("-", 1)[0] not in roads:
            yield p


def main():
    DST.mkdir(parents=True, exist_ok=True)
    n = 0
    for src in sources():
        im = Image.open(src)
        out = elevate(im, kind_of(src.stem))
        if out.size != im.size:
            raise SystemExit(f"{src.name} changed size")
        dest = DST / src.name
        out.save(dest, "WEBP", quality=84, method=6)
        print(f"  {dest.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}  {dest.stat().st_size}")
        n += 1
    print(f"{n} pictures")


if __name__ == "__main__":
    main()
