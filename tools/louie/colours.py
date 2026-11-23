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
DST = ROOT / "art" / "louie" / "front"
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
    """The whole tweed cabinet, front border included. Not the face, the grille, the panel, the hands or the boots."""
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    h, w = luma.shape
    red, grn, blu = rgb[..., 0], rgb[..., 1], rgb[..., 2]
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
    # the grille is the dark cloth. The face sits in the hole, so a row can have two dark runs.
    inset = max(10, int((cx1 - cx0) * 0.035))
    dark = (luma < 92) & (al > 100)
    ls, rs, rows = [], [], []
    for y in range(cy0 + inset, cy0 + int((cy1 - cy0) * 0.70), 2):
        xs = np.flatnonzero(dark[y, cx0 + inset:cx1 - inset])
        if xs.size < 16:
            continue
        xs = xs + cx0 + inset
        splits = np.where(np.diff(xs) > 18)[0]
        starts = np.r_[0, splits + 1]
        ends = np.r_[splits, xs.size - 1]
        runs = []
        for s, e in zip(starts, ends):
            a0, a1 = int(xs[s]), int(xs[e])
            if a1 - a0 > 22 and a0 < cx0 + (cx1 - cx0) * 0.72:
                runs.append((a0, a1))
        if not runs:
            continue
        ls.append(min(p[0] for p in runs))
        rs.append(max(p[1] for p in runs))
        rows.append(y)
    if len(rows) < 8:
        return np.zeros((h, w), np.bool_)
    gx0, gx1 = int(np.percentile(ls, 65)) - 8, int(np.percentile(rs, 35)) + 8
    gy0, gy1 = int(np.percentile(rows, 6)) - 4, int(np.percentile(rows, 97))
    gx0, gx1 = max(cx0 + 6, gx0), min(cx1 - 6, gx1)
    gy0 = max(cy0 + 6, gy0)
    # the face can hide the right-hand cloth. Walk a dark cloth row out to the bright border.
    for y in rows:
        if luma[y, min(w - 1, gx0 + 16)] > 85:
            continue
        edge = None
        for x in range(gx0 + 24, cx1 - 4):
            if luma[y, x] > 145 and luma[y, min(w - 1, x + 4)] > 135:
                edge = x
                break
        if edge and edge > gx0 + (cx1 - cx0) * 0.45:
            gx1 = max(gx1, min(cx1 - 6, edge))
            break
    colx = min(w - 2, gx0 + 12)
    for y in range(gy1, cy1 - 6):
        if luma[y, colx] > 85:
            break
        gy1 = y
    # the metal panel is the bright band under the cloth. The tweed rail below it stays.
    xmid = min(w - 1, max(0, (gx0 + gx1) // 2))
    py1 = gy1
    seen = False
    for y in range(gy1, cy1):
        if luma[y, xmid] > 125:
            seen = True
        if seen and luma[y, xmid] < 100:
            break
        py1 = y
    glove = (al > 30) & (luma > 165) & (red > 190) & (grn > 165) & (blu > 140)
    glove = np.asarray(Image.fromarray((glove.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(3))) > 0
    limb = (al > 40) & (grn < red * 0.58) & (blu < 48) & (luma < 130)
    # the soft grey shadow under the boots is not tweed
    grey = (np.abs(red - grn) < 14) & (np.abs(grn - blu) < 14)
    tweed = cab & (al > 60) & ~glove & ~limb & ~grey
    for y in range(cy0 - 1, max(0, cy0 - 22), -1):
        band = (al[y] > 80) & (luma[y] > 90) & (luma[y] < 240) & (red[y] > blu[y] + 20) & ~limb[y]
        band[:max(0, cx0 - 6)] = False
        band[min(w, cx1 + 7):] = False
        if int(band.sum()) < 12:
            break
        tweed[y] |= band
    if gx1 > gx0 and gy1 > gy0:
        tweed[gy0:gy1, gx0:gx1] = False
        tweed[gy1:max(gy1, py1), gx0:gx1] = False
    # the bottom tweed rail is a short band under the panel. Legs and boots are below that.
    rail = max(10, int((gy1 - gy0) * 0.06))
    tweed[min(h, py1 + rail):] = False
    return tweed


def tint(rgb, mask, target):
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    tl = float(target @ np.array([0.2126, 0.7152, 0.0722]))
    painted = target * (luma / max(tl, 1.0))[..., None]
    peak = painted.max(axis=-1, keepdims=True)
    painted = np.where(peak > 255, painted * (255.0 / np.maximum(peak, 1)), painted)
    mixed = rgb * 0.06 + painted * 0.94
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
