# 4.87.0: Gemini's guitar pictures, used as pictures (not traced). Run from the repo root: python3 -I tools/guitars/pics.py
# For each guitar: cut out the magenta background, measure the neck, the nut, where the body starts and where the neck
# ends on it, then write the headstock and the body as WebP (art/guitars/<name>-head.webp, -body.webp), a small whole
# guitar for the guitarist's hands (-small.webp) and the numbers the Road lays them out by (art/guitars/pics.js).
# Sources: docs/guitars/pics/<name>.jpg (whole guitar, 9:16) and, where Gemini made one, <name>-head.jpg (a close-up).
import json, os, numpy as np
from scipy import ndimage
from PIL import Image

SRC, OUT = "docs/guitars/pics", "art/guitars"
NAMES = ["parlor", "cutaway", "solid", "hollow", "single", "classical", "headliner"]
CLOSEUP = {"hollow": 700, "classical": 920, "headliner": 920}  # with a row that crosses the neck  # the solid's close-up is shaded and strung, unlike the rest
# where the strings end, as a share of the body from the end of the neck to the bottom (acoustics: the bridge;
# electrics: the bridge pickup's saddles)
BRIDGE = {"parlor": .52, "cutaway": .55, "solid": .55, "hollow": .56, "single": .56, "classical": .50, "headliner": .40}

def cutout(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    h, w, _ = a.shape
    corners = np.concatenate([a[:12, :12].reshape(-1, 3), a[:12, -12:].reshape(-1, 3), a[-12:, :12].reshape(-1, 3), a[-12:, -12:].reshape(-1, 3)])
    bg = np.median(corners, 0)
    d = np.sqrt(((a - bg) ** 2).sum(2))
    # each edge pixel is a blend of the background and the nearest solid colour of the guitar: unmix it, so a cream
    # tuner gets a soft cream edge rather than a pink one
    core = ndimage.binary_erosion(d > 90, iterations=2)
    _, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    fg = a[iy, ix]
    v = fg - bg
    al = np.clip(((a - bg) * v).sum(2) / np.maximum((v * v).sum(2), 1), 0, 1)
    al[d < 22] = 0
    near = ndimage.distance_transform_edt(~core) < 4
    al[~near] = 0  # flecks away from the guitar
    rgb = np.where((al < .999)[..., None], fg, a)
    return rgb, al

def spans(al):
    on = al > .5
    rows = []
    for y in range(on.shape[0]):
        xs = np.flatnonzero(on[y])
        rows.append((xs[0], xs[-1]) if len(xs) else None)
    return rows

def measure(al, rgb, sample=None):
    rows = spans(al)
    ys = [y for y, r in enumerate(rows) if r]
    top, bot = ys[0], ys[-1]
    wid = np.array([(r[1] - r[0] + 1) if r else 0 for r in rows])
    # the neck: the longest unbroken run of narrow rows (a fifth of the picture's width, a third in a close-up)
    lim = (.35 if al.shape[0] == al.shape[1] else .2) * al.shape[1]
    best, cur = (0, 0), None
    for y in ys:
        if 0 < wid[y] < lim:
            cur = (cur[0], y) if cur and cur[1] == y - 1 else (y, y)
            if cur[1] - cur[0] > best[1] - best[0]: best = cur
    a, b = best
    if sample:  # a close-up: the neck is the run of rows at the width of this row
        w0, a, b = wid[sample], sample, sample
        while .85 * w0 <= wid[a - 1] <= 1.15 * w0: a -= 1
        while b + 1 < len(wid) and .85 * w0 <= wid[b + 1] <= 1.15 * w0: b += 1
    nw = float(np.median(wid[a + (b - a) // 3: b - (b - a) // 3 + 1]))
    mid = (a + b) // 2
    cx = (rows[mid][0] + rows[mid][1]) / 2
    lit = rgb[mid, int(cx - nw / 4)].copy(); sh = rgb[mid, int(cx + nw / 4)].copy()
    def neckish(y):
        return np.abs(rgb[y, int(cx - nw / 4)] - lit).sum() < 45 and np.abs(rgb[y, int(cx + nw / 4)] - sh).sum() < 45
    # the nut: the board starts where both halves look like the neck for good (the throat and any nut band are the head's)
    nut = mid
    while nut > a and sum(neckish(y) for y in range(nut - 6, nut)) >= 3: nut -= 1
    body_top = b + 1
    # the neck carries on over the body: down while both halves still look like the neck
    end = body_top
    while end < bot - 6 and sum(neckish(y) for y in range(end + 1, end + 7)) >= 3: end += 1
    return dict(top=top, bot=bot, nw=nw, cx=cx, nut=nut, body=body_top, end=end, lit=lit, sh=sh)

def save(rgb, al, box, path, scale=1):
    x0, y0, x1, y1 = box
    im = Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8)[y0:y1, x0:x1], "RGBA")
    if scale != 1: im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    im.save(path, "WEBP", quality=88, method=6)
    return im.size

hexc = lambda c: "#%02x%02x%02x" % tuple(int(v) for v in c)
nums = {}
for name in NAMES:
    rgb, al = cutout(f"{SRC}/{name}.jpg")
    if name == "cutaway":  # the picture kept a bridge; paint it in the top's colours (the app draws its own)
        m = measure(al, rgb)
        cx = int(m["cx"])
        lit_top, sh_top = rgb[1135, cx - 100].copy(), rgb[1135, cx + 100].copy()
        y0, y1 = 1044, 1114
        want = np.zeros(rgb.shape, np.float32); want[:, :cx] = lit_top; want[:, cx:] = sh_top
        off = np.zeros(al.shape, bool)
        off[y0:y1, cx - 125:cx + 125] = (np.abs(rgb - want).sum(2) > 30)[y0:y1, cx - 125:cx + 125]
        off = ndimage.binary_dilation(off, iterations=4) & (al > .5)
        off[:y0 - 4] = False
        rgb[off] = want[off]
    m = measure(al, rgb)
    W = al.shape[1]
    ys = np.flatnonzero((al > .5).any(1)); xs = np.flatnonzero((al > .5).any(0))
    # the body: from where it starts to widen to the bottom, full width of the guitar
    bx0, bx1 = max(0, xs[0] - 4), min(W, xs[-1] + 5)
    by0, by1 = m["body"] - 2, m["bot"] + 3
    bsize = save(rgb, al, (bx0, by0, bx1, by1), f"{OUT}/{name}-body.webp")
    # a small whole guitar for the guitarist's hands
    save(rgb, al, (bx0, max(0, m["top"] - 3), bx1, by1), f"{OUT}/{name}-small.webp", 640 / (by1 - m["top"]))
    body = dict(w=bsize[0], h=bsize[1], cx=m["cx"] - bx0, nw=m["nw"], end=m["end"] - by0 + 1, bridge=round(m["end"] - by0 + BRIDGE[name] * (m["bot"] - m["end"]), 1))
    # the head: the close-up if there is one, else the whole picture's, from its top to the nut
    if name in CLOSEUP:
        hr, ha = cutout(f"{SRC}/{name}-head.jpg")
        hm = measure(ha, hr, CLOSEUP[name])
    else:
        hr, ha, hm = rgb, al, m
    hys = np.flatnonzero((ha[:hm["nut"]] > .5).any(1)); hxs = np.flatnonzero((ha[:hm["nut"]] > .5).any(0))
    hx0, hx1 = max(0, hxs[0] - 4), min(ha.shape[1], hxs[-1] + 5)
    hsize = save(hr, ha, (hx0, max(0, hys[0] - 3), hx1, hm["nut"] + 1), f"{OUT}/{name}-head.webp")
    head = dict(w=hsize[0], h=hsize[1], cx=hm["cx"] - hx0, nw=hm["nw"])
    nums[name] = dict(head=head, body=body, lit=hexc(m["lit"]), shade=hexc(m["sh"]))
    print(name, "neck", round(m["nw"]), "nut", m["nut"], "body", m["body"], "end", m["end"], "bot", m["bot"], "| head", hsize, "body", bsize,
          "| KB", *(os.path.getsize(f"{OUT}/{name}-{p}.webp") // 1024 for p in ("head", "body", "small")))
with open(f"{OUT}/pics.js", "w") as f:
    f.write("/* The numbers of each guitar picture, from tools/guitars/pics.py (4.87.0). Do not edit by hand.\n"
            "   head and body: picture size, the neck's centre (cx) and width (nw) in its pixels; body.end: where the neck ends on\n"
            "   the body; body.bridge: where the strings end; lit and shade: the neck's two halves. */\n")
    f.write("export default " + json.dumps(nums) + ";\n")
