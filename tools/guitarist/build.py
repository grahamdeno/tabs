# Trace the Gemini guitarist pictures (docs/guitarist/src) into art/guitarist.js: the head (with its ears) and each hair style
# as parts the app recolours. Coordinates are in the guitarist's own units (x 0-200, the head's centre at 100,88). Run: python3 tools/guitarist/build.py
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, cv2
from sklearn.cluster import KMeans
import seg

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
CHIN = 697   # rows below this are neck and shirt, not head
HAIRS = {"bob": "bob", "braids": "braids", "bun": "bun", "buzz": "buzz", "curly": "curly", "locs": "locs", "long": "long", "longhawk": "longhawk",
         "mohawk": "mohawk", "pixie": "pixie", "ponytail": "ponytail", "shag": "shag", "swoop": "swoop"}
DETAIL = {"curly": 2500, "shag": 700, "locs": 700}   # tone islands smaller than this (px) are dropped: the curls' little marks turn to noise when small

def to_app(p):
    return (100 + (p[0] - seg.X0) / seg.S, 88 + (p[1] - seg.Y0) / seg.S)

def path_of(mask, eps=3.6, min_area=80):
    cs, _ = cv2.findContours(mask.astype(np.uint8) * 255, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    d = ""
    for c in cs:
        if cv2.contourArea(c) < min_area: continue
        c = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(float)
        n = len(c)
        if n < 3: continue
        pts = np.array([to_app(p) for p in c])
        cur = np.round(pts[0], 1); d += f"M{cur[0]:g} {cur[1]:g}"
        for i in range(n):
            p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
            c1, c2, e = p1 + (p2 - p0) * .5 / 3, p2 - (p3 - p1) * .5 / 3, p2
            c1, c2, e = np.round(c1, 1), np.round(c2, 1), np.round(e, 1)
            r = [c1 - cur, c2 - cur, e - cur]
            d += "c" + " ".join(f"{v:g}" for q in r for v in q)
            cur = e
        d += "z"
    return d

def smooth(m, r=3):
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))
    m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, k)
    return cv2.morphologyEx(m, cv2.MORPH_OPEN, k).astype(bool)

def holes_filled(m):
    inv = ~m
    n, cc = cv2.connectedComponents(inv.astype(np.uint8))
    edge = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]])))
    return m | ~np.isin(cc, list(edge))

# ---- the head, from the bald base
a, L, m = seg.segment("bald")
keep = seg.keepbox(m["bg"].shape)
head = holes_filled((m["skin"] | keep) & (np.arange(a.shape[0])[:, None] <= CHIN))
n, cc = cv2.connectedComponents(head.astype(np.uint8)); head = cc == cc[300, 512]
Lh = L[..., 0]
lit = head & (Lh >= 65)
ears = np.zeros(head.shape, bool); ears[430:545, 205:295] = True; ears[430:545, 735:825] = True
line = head & (Lh < 59.5) & ears & ~keep
print("head: lit L", np.median(Lh[head & (Lh > 64)]), "shade L", np.median(Lh[head & (Lh >= 56) & (Lh < 65)]), "line px", int(line.sum()))
HEAD = {"sil": path_of(smooth(head, 2)), "lit": path_of(smooth(holes_filled(lit | keep & head), 2)), "line": path_of(line, eps=1.2, min_area=25)}
headzone = cv2.dilate(head.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
bald_shirt = m["shirt"] | ((np.arange(a.shape[0])[:, None] > CHIN) & m["skin"])
shirtzone = cv2.dilate(bald_shirt.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))).astype(bool)

def tones(Lv, k=3, min_gap=4.5):
    km = KMeans(n_clusters=k, n_init=4, random_state=1).fit(Lv.reshape(-1, 1)[::5])
    c = sorted(km.cluster_centers_.ravel(), reverse=True)
    keepc = [c[0]]
    for v in c[1:]:
        if keepc[-1] - v >= min_gap: keepc.append(v)
    return keepc

THICK = {"curly": 7}   # tone details thinner than this (radius, px) are dropped: the curls' marks

def part(mask, Lh, cents, detail=40, thick=0):
    """[[tone, path]]: tone 0 is the hair colour itself, 1 a shade darker, 2 darkest; the whole part first, then the darker regions on it."""
    if mask.sum() < 3000: return []
    mask = smooth(mask, 3)
    out = [[0, path_of(mask)]]
    if len(cents) > 1:
        idx = np.abs(Lh[..., None] - np.array(cents)[None, None, :]).argmin(2)
        for t in range(1, len(cents)):
            tm = mask & (idx == t)
            if len(cents) == 3 and t == 1 and False: pass
            tm = smooth(tm, 3)
            if thick: tm = cv2.morphologyEx(tm.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * thick + 1, 2 * thick + 1))).astype(bool)
            nlab, lab_, st, _ = cv2.connectedComponentsWithStats(tm.astype(np.uint8))
            for i in range(1, nlab):
                if st[i][4] < detail: tm[lab_ == i] = False
            tm = cv2.dilate(tm.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & mask
            if tm.sum() >= 150: out.append([t if len(cents) == 3 else 2, path_of(tm)])
    return out

ART = {"head": HEAD, "hair": {}}
for src, name in HAIRS.items():
    a, L, m = seg.segment(src)
    H = m["hair"]
    # the little ear line the base has is not hair
    zone = cv2.dilate(line.astype(np.uint8), np.ones((11, 11), np.uint8)).astype(bool)
    nlab, lab_, st, _ = cv2.connectedComponentsWithStats(H.astype(np.uint8))
    for i in range(1, nlab):   # a small bit of "hair" on the ear line is the line, not hair (a covered ear is inside a big piece)
        if st[i][4] < 900 and zone[lab_ == i].any(): H[lab_ == i] = False
    Lh = L[..., 0]
    cents = tones(Lh[H & (Lh < 42)])
    back = H & ~headzone & ~shirtzone
    fall = H & ~headzone & shirtzone
    front = H & headzone
    grow = lambda x, r: cv2.dilate(x.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))).astype(bool)
    back = H & grow(back, 4)        # the parts overlap a little, so no seam shows where they meet
    front = H & grow(front, 4) & (headzone | grow(headzone, 4))
    fall = H & grow(fall, 2)
    det = DETAIL.get(name, 40)
    ART["hair"][name] = [part(back, Lh, cents, det, THICK.get(name, 0)), part(fall, Lh, cents, det, THICK.get(name, 0)), part(front, Lh, cents, det, THICK.get(name, 0))]
    print(f"{name:9s} tones {[round(float(c)) for c in cents]} back {int(back.sum()):6d} fall {int(fall.sum()):6d} front {int(front.sum()):6d} bytes {len(json.dumps(ART['hair'][name], separators=(',', ':')))}")

out = os.path.join(ROOT, "art", "guitarist.js")
js = "/* Traced from Gemini's pictures (docs/guitarist/src) by tools/guitarist/build.py. Do not edit by hand.\n   head: sil (the shade), lit (the skin), line (the ear's mark). hair[name]: [behind the head, falling over the body, over the head]; each is [[tone, path]]:\n   tone 0 the hair colour, 1 a little darker, 2 the shade. */\nexport default " + json.dumps(ART, separators=(",", ":")) + ";\n"
open(out, "w").write(js)
print("art/guitarist.js", len(js) // 1000, "KB")
