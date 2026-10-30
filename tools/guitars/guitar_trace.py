# Trace a flat-colour guitar image into a layered SVG: snap colours (k-means in Lab), drop thin lines (strings, frets),
# trace each colour's regions with OpenCV, smooth them into cubic Beziers, stack largest first so seams are covered.
import sys, json, numpy as np, cv2
from PIL import Image
from sklearn.cluster import KMeans

def load(path, crop=None, rot=0, scale=2.0):
    im = Image.open(path).convert("RGB")
    if crop: im = im.crop(crop)
    if rot: im = im.rotate(rot, expand=True, fillcolor=(255, 255, 255))
    a = np.asarray(im)
    ink = (a.min(axis=2) < 232)
    ys, xs = np.where(ink)
    y0, y1, x0, x1 = max(0, ys.min() - 6), min(a.shape[0], ys.max() + 7), max(0, xs.min() - 6), min(a.shape[1], xs.max() + 7)
    im = im.crop((x0, y0, x1, y1))
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    a = cv2.medianBlur(np.asarray(im), 5)
    return a

def quantize(a, k):
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    rgb = a.reshape(-1, 3)
    # background: near-white that touches the edge of the image (a white pickguard inside the guitar is not background)
    white = (a.min(axis=2) >= 236).astype(np.uint8)
    n, cc = cv2.connectedComponents(white)
    edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]]))) - {0}
    bg = np.isin(cc, list(edge)).reshape(-1) & (white.reshape(-1) > 0)
    km = KMeans(n_clusters=k, n_init=4, random_state=1).fit(lab[~bg][::7])
    lbl = km.predict(lab)
    lbl[bg] = -1
    cent = cv2.cvtColor(km.cluster_centers_.astype(np.uint8).reshape(1, -1, 3), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    return lbl.reshape(a.shape[:2]), cent

def smooth_path(c, tension=0.5):
    pts = c.reshape(-1, 2).astype(float)
    n = len(pts)
    if n < 3: return ""
    d = f"M{pts[0][0]:.1f} {pts[0][1]:.1f}"
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = p1 + (p2 - p0) * tension / 3
        c2 = p2 - (p3 - p1) * tension / 3
        d += f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return d + "Z"

def trace(a, k=12, thin=3, min_area=60, eps=1.2, keep=None):
    lbl, cent = quantize(a, k)
    layers = []
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * thin + 1, 2 * thin + 1))
    for i, col in enumerate(cent):
        m = (lbl == i).astype(np.uint8) * 255
        if keep is not None: m = cv2.bitwise_and(m, keep)
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, ker)  # drops strings, fret wires and JPEG fringes
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
        area = int(m.sum() / 255)
        if area < min_area: continue
        layers.append((area, col, m))
    layers.sort(key=lambda x: -x[0])
    out = []
    for area, col, m in layers:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))  # covers the seam with the layer below
        cs, hier = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = ""
        for c in cs:
            if cv2.contourArea(c) < min_area: continue
            c = cv2.approxPolyDP(c, eps, True)
            d += smooth_path(c)
        if d: out.append((f"#{col[0]:02x}{col[1]:02x}{col[2]:02x}", d))
    return out

def svg(a, layers, extra=""):
    h, w = a.shape[:2]
    body = "".join(f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>' for c, d in layers)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{body}{extra}</svg>'

from scipy import ndimage
def clean(lbl, thin=3):
    """Pixels on lines thinner than ~thin px (strings, fret wires) take the label of the nearest solid region under them."""
    ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * thin + 1, 2 * thin + 1))
    valid = np.zeros(lbl.shape, bool)
    for i in np.unique(lbl):
        m = (lbl == i).astype(np.uint8)
        valid |= cv2.morphologyEx(m, cv2.MORPH_OPEN, ker).astype(bool)
    idx = ndimage.distance_transform_edt(~valid, return_distances=False, return_indices=True)
    return lbl[idx[0], idx[1]], ~valid

def neck_lines(lbl, thinmask, rgb):
    """Find the board (the label down the middle of the neck), its edges, the nut, the frets and where the strings end."""
    h, w = lbl.shape
    cx = w // 2
    # the board: the most common non-background label in a band at 25-35% of the height around the centre
    band = lbl[int(h * .22):int(h * .32), cx - 6:cx + 6].ravel()
    band = band[band >= 0]
    board = np.bincount(band).argmax()
    col = (lbl == board)
    rows = np.where(col[:, cx])[0]
    # nut: the top of the board's longest vertical run through the centre column
    runs = np.split(rows, np.where(np.diff(rows) > 3)[0] + 1)
    run = max(runs, key=len)
    nut, heel = run[0], run[-1]
    y = int(nut + (heel - nut) * .1)
    xs = np.where(col[y])[0]; xs = xs[np.abs(xs - cx) < w * .2]
    left, right = xs.min(), xs.max()
    yb = int(nut + (heel - nut) * .9)
    xs2 = np.where(col[yb])[0]; xs2 = xs2[np.abs(xs2 - cx) < w * .2]
    # frets: rows across the board where most of the width was a thin line
    frets = []
    for yy in range(nut + 4, heel):
        xl = int(left + (xs2.min() - left) * (yy - nut) / max(1, yb - nut)); xr = int(right + (xs2.max() - right) * (yy - nut) / max(1, yb - nut))
        seg = thinmask[yy, xl + 2:xr - 1]
        if seg.size and seg.mean() > .55: frets.append(yy)
    fr = [int(np.mean(g)) for g in np.split(np.array(frets), np.where(np.diff(frets) > 2)[0] + 1)] if frets else []
    # strings end at the bridge: the lowest row with thin pixels near the centre column
    tc = thinmask[:, cx - int((right - left) * .4): cx + int((right - left) * .4)]
    ends = np.where(tc.mean(axis=1) > .08)[0]
    end = int(ends.max()) if len(ends) else int(h * .85)
    return dict(nut=int(nut), heel=int(heel), left=int(left), right=int(right), left2=int(xs2.min()), right2=int(xs2.max()), yb=yb, frets=fr, end=end)

def trace2(a, k=12, min_area=60, eps=1.2, thin=3):
    lbl, cent = quantize(a, k)
    lbl2, thinmask = clean(lbl, thin)
    nk = neck_lines(lbl, thinmask & (lbl >= 0), a)
    layers = []
    for i, col in enumerate(cent):
        m = (lbl2 == i).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        area = int(m.sum() / 255)
        if area < min_area: continue
        layers.append((area, col, m))
    layers.sort(key=lambda x: -x[0])
    out = []
    for area, col, m in layers:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = "".join(smooth_path(cv2.approxPolyDP(c, eps, True)) for c in cs if cv2.contourArea(c) >= min_area)
        if d: out.append((f"#{col[0]:02x}{col[1]:02x}{col[2]:02x}", d))
    return out, nk

def lines_svg(nk, string="#E9E3D6", fret="#B9B4AA", sw=2.2):
    # frets across the board, then six strings from the nut to the bridge, spaced inside the board's edges
    def at(y):
        t = (y - nk["nut"]) / max(1, nk["yb"] - nk["nut"])
        return nk["left"] + (nk["left2"] - nk["left"]) * t, nk["right"] + (nk["right2"] - nk["right"]) * t
    s = ""
    for y in nk["frets"]:
        l, r = at(y); s += f'<rect x="{l:.1f}" y="{y - 1.6:.1f}" width="{r - l:.1f}" height="3.2" rx="1" fill="{fret}"/>'
    l0, r0 = at(nk["nut"]); m0 = (r0 - l0) * .12
    lw, rw = at(nk["end"]); w0 = (r0 - l0 - 2 * m0)
    mid = (lw + rw) / 2; span = w0 * 1.08
    for i in range(6):
        x1 = l0 + m0 + w0 * i / 5; x2 = mid - span / 2 + span * i / 5
        s += f'<line x1="{x1:.1f}" y1="{nk["nut"]}" x2="{x2:.1f}" y2="{nk["end"]}" stroke="{string}" stroke-width="{sw - i * .2:.1f}" stroke-linecap="round"/>'
    return s
