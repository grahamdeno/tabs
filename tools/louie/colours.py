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
DST = ROOT / "art" / "louie" / "colours"
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
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    h, w = luma.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    oys = np.where(al > 80)[0]
    if oys.size < 80:
        return np.zeros((h, w), np.bool_)
    cut = int(oys.min() + 0.66 * (oys.max() - oys.min()))
    # the dark grille cloth, above the control panel. The face sits inside this box.
    dark = (al > 160) & (luma < 58) & (r > b + 10)
    dark[cut:] = False
    ys, xs = np.where(dark)
    if ys.size < 80:
        return np.zeros((h, w), np.bool_)
    gx0, gx1 = int(np.percentile(xs, 5)), int(np.percentile(xs, 95))
    gy0, gy1 = int(np.percentile(ys, 3)), int(np.percentile(ys, 97))
    gh = max(1, gy1 - gy0)
    # the gold panel is the band under the grille, inset so the tweed sides stay
    py0, py1 = gy1, min(h - 1, gy1 + int(gh * 0.20))
    inset = int((gx1 - gx0) * 0.06)
    px0, px1 = gx0 + inset, gx1 - inset
    # gloves are cream, with a high blue channel. Tweed highlights stay browner.
    glove = (al > 60) & (luma > 175) & (g > 165) & (b > 125)
    glove = np.asarray(Image.fromarray((glove.astype(np.uint8) * 255), "L").filter(ImageFilter.MaxFilter(3))) > 0
    yellow = (al > 120) & (r > g - 8) & (r > b + 18) & (luma > 55) & (luma < 190) & ((r - g) < 95) & ~glove
    cover = yellow[gy0:gy1].mean(0)
    reach = int((gx1 - gx0) * 0.45)
    cx0 = gx0
    for x in range(gx0 - 1, max(0, gx0 - reach) - 1, -1):
        if cover[x] > 0.12:
            cx0 = x
        else:
            break
    cx1 = gx1
    for x in range(gx1 + 1, min(w, gx1 + reach)):
        if cover[x] > 0.12:
            cx1 = x
        else:
            break
    top = max(0, gy0 - int(gh * 0.12))
    bot = min(h - 1, py1 + int(gh * 0.09))
    tweed = yellow.copy()
    tweed[gy0:gy1, gx0:gx1] = False
    tweed[py0:py1, px0:px1] = False
    tweed[:, :cx0] = False
    tweed[:, cx1 + 1:] = False
    tweed[bot + 1:] = False
    tweed[:top] = False
    return tweed


def tint(rgb, mask, target):
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722])
    tl = float(target @ np.array([0.2126, 0.7152, 0.0722]))
    painted = target * (luma / max(tl, 1.0))[..., None]
    mixed = rgb * 0.22 + painted * 0.78
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
