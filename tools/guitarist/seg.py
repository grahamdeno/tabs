# Segment a Gemini guitarist picture (docs/guitarist/src) into skin, hair, shirt, face features and background.
import numpy as np, cv2
from PIL import Image
S, X0, Y0 = 5.12, 508.1, 456.5            # picture pixels -> app units: x = 100 + (px - X0) / S, y = 88 + (py - Y0) / S
EYES = [(362, 398, 468, 526), (558, 398, 664, 526)]   # x0, y0, x1, y1: never hair
MOUTH = (440, 556, 585, 622)
SRC = "docs/guitarist/src/"

def load(name):
    return cv2.medianBlur(np.asarray(Image.open(SRC + name + ".jpg").convert("RGB")), 3)

def lab(a):
    return cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32) * np.array([100 / 255, 1, 1], np.float32) - np.array([0, 128, 128], np.float32)

def med(L, box):
    x0, y0, x1, y1 = box
    return np.median(L[y0:y1, x0:x1].reshape(-1, 3), axis=0)

SEEDS = {  # picture -> (lit skin box, shade skin box)
    "default": ((440, 628, 590, 668), (690, 480, 722, 560)),
    "locs": ((430, 330, 500, 400), (540, 330, 610, 400)),
    "swoop": ((440, 628, 590, 668), (690, 560, 720, 600)),
}

# how the shade band and the right ear differ from the lit skin in Gemini's bald base (the same in every picture)
_b = lab(load("bald"))
OFFS = (med(_b, (690, 480, 722, 560)) - med(_b, (440, 628, 590, 668)), med(_b, (788, 470, 806, 520)) - med(_b, (440, 628, 590, 668)))

def keepbox(shape):
    k = np.zeros(shape, bool)
    for x0, y0, x1, y1 in EYES + [MOUTH]: k[y0:y1, x0:x1] = True
    return k

def segment(name, seeds=None):
    a = load(name); L = lab(a)
    h, w = a.shape[:2]
    d = lambda c: np.sqrt(((L - c) ** 2).sum(2))
    white = (a.min(2) >= 235).astype(np.uint8)
    n, cc = cv2.connectedComponents(white)
    edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))) - {0}
    bg = np.isin(cc, list(edge))
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    shirt = ((r - g) > 100) & (r > 130)
    keep = keepbox(bg.shape)
    skin = ~bg & ~shirt & (L[..., 0] >= 39.5) & (L[..., 1] > 6) & (L[..., 2] > 12)   # hair is darker than any skin (its lit brown is L 33-37)
    hair = ~bg & ~skin & ~shirt & ~keep & (L[..., 0] < 39.5)
    hair = cv2.morphologyEx(hair.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))).astype(bool)
    hair |= cv2.dilate(hair.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~skin & ~shirt & ~keep & ~bg
    return a, L, dict(skin=skin, bg=bg, shirt=shirt, hair=hair)

if __name__ == "__main__":
    import sys, os
    out = sys.argv[1]
    names = [f[:-4] for f in sorted(os.listdir(SRC)) if f.endswith(".jpg")]
    tiles = []
    for nm in names:
        a, L, m = segment(nm)
        v = np.full(a.shape, 255, np.uint8)
        v[m["skin"]] = (230, 170, 90); v[m["shirt"]] = (230, 90, 160); v[m["hair"]] = (40, 60, 200)
        unk = ~m["bg"] & ~m["skin"] & ~m["shirt"] & ~m["hair"] & ~keepbox(m["bg"].shape)
        v[unk] = (255, 0, 0)
        v[keepbox(m["bg"].shape) & ~m["skin"]] = (255, 255, 255)
        t = cv2.resize(v, (256, 256), interpolation=cv2.INTER_AREA)
        cv2.putText(t, nm, (4, 16), cv2.FONT_HERSHEY_SIMPLEX, .5, (0, 0, 0), 1)
        tiles.append(t)
    while len(tiles) % 5: tiles.append(np.full((256, 256, 3), 255, np.uint8))
    rows = [np.hstack(tiles[i:i + 5]) for i in range(0, len(tiles), 5)]
    Image.fromarray(np.vstack(rows)).save(out)
