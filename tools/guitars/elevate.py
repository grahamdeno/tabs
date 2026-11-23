#!/usr/bin/env python3
# A second pass of elevation. The first set (art/guitars/elev/) stays as it is.
# This one writes art/guitars/lift/ and does not touch any older picture.
#
# The grain of the paint is kept at full sharpness: light is applied only to a
# soft copy of the colour, then the original fine detail is put back on top.
# Nothing is resampled. The canvas size stays the same, so the frets still line up.
# Run from the repo root: python3 tools/guitars/elevate.py

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "guitars"
DST = SRC / "lift"
LIT = np.array([255.0, 250.0, 236.0])


def kind_of(name):
    if name.endswith("-road"):
        return "road"
    if name.endswith("-body"):
        return "body"
    if name.endswith("-head"):
        return "head"
    return "small"


def body_rows(kind, h):
    if kind == "road":
        return int(h * 0.48), h
    if kind == "small":
        return int(h * 0.45), h
    return 0, h


def split_grain(rgb, radius=1.35):
    """Low colour for the light, and the original fine detail to put back."""
    lows = []
    for c in range(3):
        ch = Image.fromarray(np.clip(rgb[..., c], 0, 255).astype(np.uint8), "L")
        lows.append(np.asarray(ch.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32))
    low = np.stack(lows, axis=-1)
    return low, rgb - low


def outline(a, y0, y1):
    """The top edge of the body at each column, so a highlight can follow it."""
    h, w = a.shape
    edge = np.full(w, np.nan, np.float32)
    for x in range(w):
        ys = np.flatnonzero(a[y0:y1, x] > 0.55)
        if ys.size:
            edge[x] = y0 + ys[0]
    # fill gaps, then smooth along the edge so a fret or string does not kink the band
    known = np.flatnonzero(~np.isnan(edge))
    if known.size < 8:
        return None
    xs = np.arange(w)
    filled = np.interp(xs, known, edge[known]).astype(np.float32)
    k = 31
    pad = np.pad(filled, k // 2, mode="edge")
    kernel = np.ones(k) / k
    return np.convolve(pad, kernel, mode="valid")


def bridge_glint(low, a, top, bot, left, right):
    """A small crisp glint on the bridge bar and, when there is one, the saddle.
    A single dark pin at the tail is not a bridge, so it is left alone."""
    h, w = a.shape
    lum = low @ np.array([0.2126, 0.7152, 0.0722])
    span_y = max(1, bot - top)
    y_a = top + int(0.55 * span_y)
    y_b = min(h - 2, top + int(0.84 * span_y))
    span = max(12, int(0.20 * (right - left)))
    cx = (left + right) // 2
    x0, x1 = max(0, cx - span), min(w, cx + span)
    dark = []
    for y in range(y_a, y_b):
        m = a[y, x0:x1] > 0.85
        if m.mean() < 0.7:
            dark.append(False)
            continue
        vals = lum[y, x0:x1][m]
        dark.append(bool(vals.size and vals.mean() < 75 and (vals < 90).mean() > 0.55))
    # the longest run of dark rows is the bridge, if it is a bar and not a speck
    best, run = None, 0
    i = 0
    while i < len(dark):
        if not dark[i]:
            i += 1
            continue
        j = i
        while j < len(dark) and dark[j]:
            j += 1
        if 3 <= (j - i) <= 36 and (j - i) > run:
            run, best = j - i, y_a + i
        i = j
    glint = np.zeros((h, w), np.float32)
    if best is None:
        return glint
    gx = max(0, cx - span // 4)
    glint[best:best + 2, gx:gx + 4] = 0.85
    for y in range(max(0, best - 6), best):
        m = a[y, x0:x1] > 0.85
        if m.mean() < 0.5:
            continue
        if lum[y, x0:x1][m].mean() > 130:
            glint[y:y + 1, gx:gx + 3] = 1
            break
    return glint * (a > 0.9)


def elevate(im, kind):
    arr = np.asarray(im.convert("RGBA")).astype(np.float32)
    h, w = arr.shape[:2]
    rgb = arr[..., :3]
    a = arr[..., 3] / 255.0
    alpha = arr[..., 3].copy()
    # Only the solid paint is relit. The antialiased edge stays the original pixels.
    core = np.clip((a - 0.9) / 0.1, 0, 1)
    low, grain = split_grain(rgb)
    y0, y1 = body_rows(kind, h)
    face = np.zeros((h, w), np.float32)
    face[y0:y1] = 1
    face *= core

    lit = low.copy()
    if kind != "head":
        edge = outline(a, y0, y1)
        if edge is not None:
            bh = max(1, y1 - y0)
            yy = np.arange(h, dtype=np.float32)[:, None]
            dist = yy - edge[None, :]
            # a defined band just inside the top's curve, wider than a line, not a blob
            width = max(3.5, bh * 0.045)
            center = bh * 0.11
            band = np.exp(-((dist - center) / width) ** 2)
            band *= face
            # light from the upper left, so the band fades toward the right
            xs = np.linspace(0, 1, w)[None, :]
            band *= 0.45 + 0.55 * (1 - xs)
            # keep it off the soundhole and the dark hardware
            wood = np.clip((low.mean(-1) - 28) / 40, 0, 1)
            band *= wood
            # the band brightens the colour that is already there
            lit = lit + (LIT - lit) * (band * 0.55)[..., None]
            # a short crisp glint on the brightest part of that band
            glint = np.exp(-((dist - center * 0.75) / max(1.6, width * 0.28)) ** 2)
            glint *= np.exp(-((xs - 0.32) / 0.08) ** 2)
            glint *= face * wood
            lit = lit + (255 - lit) * (glint * 0.85)[..., None]

        # binding: a thin bright edge on the lit side, a darker edge on the shadow side
        mask = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8), "L")
        inner = np.asarray(mask.filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255.0
        deeper = np.asarray(mask.filter(ImageFilter.MinFilter(5))).astype(np.float32) / 255.0
        rim = np.clip(inner - deeper, 0, 1) * core
        gy, gx = np.gradient(a)
        mag = np.hypot(gx, gy) + 1e-6
        ox, oy = -gx / mag, -gy / mag
        ndot = ox * -0.50 + oy * -0.86
        lit_edge = rim * np.clip(ndot, 0, 1)
        shade_edge = rim * np.clip(-ndot, 0, 1)
        lit = lit + (LIT - lit) * (lit_edge * 0.92)[..., None]
        lit = lit * (1 - shade_edge * 0.55)[..., None]
        # one crisp glint where the binding faces the light most directly
        crisp = rim * np.clip((ndot - 0.55) / 0.45, 0, 1)
        lit = lit + (255 - lit) * (crisp * 0.75)[..., None]

        ys, xs = np.where(face > 0.5)
        if ys.size:
            gl = bridge_glint(low, a, int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max()))
            lit = lit + (255 - lit) * gl[..., None]
    else:
        # a small sheen on the headstock face, grain kept
        yy = np.linspace(0, 1, h)[:, None]
        xx = np.linspace(0, 1, w)[None, :]
        sheen = core * np.exp(-(((yy - 0.30) / 0.22) ** 2 + ((xx - 0.42) / 0.28) ** 2)) * 0.16
        lit = lit + (LIT - lit) * sheen[..., None]

    # the lower right of the body falls away, on the soft colour only
    if kind != "head":
        yy = np.linspace(0, 1, h)[:, None]
        xx = np.linspace(0, 1, w)[None, :]
        fall = np.clip((yy - 0.55) * 0.16 + (xx - 0.5) * 0.08, 0, 0.12) * face
        lit = lit * (1 - fall)[..., None]

    out = np.clip(lit + grain, 0, 255)
    out = out * core[..., None] + rgb * (1 - core)[..., None]
    final = np.dstack([np.clip(out, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(final, "RGBA")


def sources():
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
        # Lossless, so the grain is not smoothed by a second compression.
        out.save(dest, "WEBP", lossless=True, quality=100, method=6)
        print(f"  {dest.relative_to(ROOT)}  {out.size[0]}x{out.size[1]}  {dest.stat().st_size}")
        n += 1
    print(f"{n} pictures")


if __name__ == "__main__":
    main()
