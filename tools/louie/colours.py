#!/usr/bin/env python3
# Louie's other colours. Only the tweed covering is tinted. The face, the grille
# cloth, the gold panel and the limbs stay as they are.
# Writes art/louie/colours/<finish>/ and does not touch art/louie/finishes/ or v4.
# The plain pictures are the clean cut-outs in art/louie/v5, including nervous.

from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "art" / "louie" / "v5"
DST = ROOT / "art" / "louie" / "tint"
POSES = ["cheer", "horns", "idle", "listen", "nervous", "point", "proud", "sleepy", "thumb", "wave"]
# id, and the tweed colour. "black" is the Blue finish (that is the id the Merch table already uses).
COLOURS = {
    "pink": np.array([214, 54, 118], np.float32),
    "teal": np.array([18, 148, 146], np.float32),
    "black": np.array([42, 104, 186], np.float32),
    "mint": np.array([118, 198, 168], np.float32),
    "gold": np.array([212, 168, 52], np.float32),
}


def tweed_mask(rgb, al):
    """The whole tweed cabinet, evenly. Not the face, the grille, the gold panel, the hands or the boots."""
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    h, w = luma.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    op = al > 50
    lefts, rights, ys = [], [], []
    for y in range(h):
        xs = np.flatnonzero(op[y])
        if xs.size < w * 0.28:
            continue
        splits = np.where(np.diff(xs) > 6)[0]
        starts = np.r_[0, splits + 1]
        ends = np.r_[splits, xs.size - 1]
        width = xs[ends] - xs[starts]
        k = int(np.argmax(width))
        if width[k] < w * 0.34:
            continue
        lefts.append(int(xs[starts[k]]))
        rights.append(int(xs[ends[k]]))
        ys.append(y)
    if len(ys) < 8:
        return np.zeros((h, w), np.bool_)
    cx0, cx1 = int(np.percentile(lefts, 75)) + 2, int(np.percentile(rights, 25)) - 2
    cy0, cy1 = min(ys), max(ys)
    cab = np.zeros((h, w), np.bool_)
    cab[cy0:cy1 + 1, cx0:cx1 + 1] = True
    cab &= op
    dark = (luma < 64) & (al > 140) & (r > b + 8) & cab
    dark[cy0 + int((cy1 - cy0) * 0.72):] = False
    dys, dxs = np.where(dark)
    if dys.size < 40:
        return np.zeros((h, w), np.bool_)
    gx0, gx1 = int(np.percentile(dxs, 4)), int(np.percentile(dxs, 96))
    gy0, gy1 = int(np.percentile(dys, 2)), int(np.percentile(dys, 98))
    gh = max(1, gy1 - gy0)
    py0, py1 = gy1, min(cy1, gy1 + int(gh * 0.30))
    rail = max(10, gx0 - cx0 - 2)
    px0, px1 = cx0 + rail, cx1 - rail
    # cream gloves, including the fingers that rest on the panel
    glove = (al > 30) & (luma > 145) & (r > 175) & (g > 148)
    glove = np.asarray(Image.fromarray((glove.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(5))) > 0
    tweed = cab & (al > 80) & ~glove
    tweed[gy0:gy1, gx0:gx1] = False
    tweed[py0:py1, px0:px1] = False
    top = max(cy0, gy0 - int(gh * 0.16))
    bot = min(cy1, py1 + int(gh * 0.20))
    tweed[:top] = False
    tweed[bot + 1:] = False
    return tweed


def tint(rgb, mask, target):
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    tl = float(target @ np.array([0.2126, 0.7152, 0.0722]))
    painted = target * (luma / max(tl, 1.0))[..., None]
    mixed = rgb * 0.30 + painted * 0.70
    out = np.where(mask[..., None], mixed, rgb)
    return np.clip(out, 0, 255)


def main():
    if not (SRC / "louie-nervous.webp").is_file():
        raise SystemExit("art/louie/v5 is missing. Copy the clean cut-outs first.")
    for name, target in COLOURS.items():
        folder = DST / name
        folder.mkdir(parents=True, exist_ok=True)
        for pose in POSES:
            im = Image.open(SRC / f"louie-{pose}.webp").convert("RGBA")
            arr = np.asarray(im).astype(np.float32)
            rgb, al = arr[..., :3], arr[..., 3]
            mask = tweed_mask(rgb, al)
            out = tint(rgb, mask, target)
            final = np.dstack([out, al]).astype(np.uint8)
            dest = folder / f"louie-{pose}.webp"
            Image.fromarray(final, "RGBA").save(dest, "WEBP", quality=90, method=6)
        print(name, "ok", flush=True)


if __name__ == "__main__":
    main()
