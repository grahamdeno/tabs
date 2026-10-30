"""Rebuild art/guitars/<leg>.js from the Nano images in docs/guitars/src.
   python3 tools/guitars/build.py [leg ...]      (needs opencv, scikit-learn, scipy, pillow)
Each guitar is split into `head` (above the nut), `body` (below where the board ends) and `over`, in the guitar's own
units (the traced picture at half scale). The neck is not in the art: the app draws it. Numbers in `nums`:
nut, end (where the board ends on the body), bridge (where the strings end), l0/r0 (board edges at the nut),
l1/r1 (at the end), cx (body centre), w/h (the view), bl/br (the widest the body gets, left and right)."""
import sys, os, json, numpy as np, cv2
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
S = os.path.join(ROOT, "docs", "guitars")
OUT = os.path.join(ROOT, "art", "guitars")
sys.path.insert(0, os.path.dirname(__file__))
from guitar_trace import *
Q = float(os.environ.get("Q", .5))          # units: the 2x trace times Q
EPS = float(os.environ.get("EPS", 2.4))     # outline tolerance in 2x pixels
FLOOR = int(os.environ.get("FLOOR", 160))   # smallest region kept, in 2x pixels squared
BUDGET = 25000
NECK = {
  "parlor":    dict(nut=257, l0=242, r0=313, end=849, l1=230, r1=325, bridge=1150, board="#4A3328", inlay="dot",   mat="#F4F1EA"),
  "cutaway":   dict(nut=285, l0=240, r0=318, end=902, l1=232, r1=326, bridge=1160, board="#4A3328", inlay="dot",   mat="#F4F1EA", big=True),
  "solid":     dict(nut=293, l0=222, r0=300, end=955, l1=215, r1=307, bridge=1252, board="#DCB87E", inlay="block", mat="#1C1D22"),
  "hollow":    dict(nut=245, l0=247, r0=305, end=845, l1=240, r1=315, bridge=1082, board="#241F1D", inlay="split", mat="#F4F1EA"),
  "single":    dict(nut=257, l0=228, r0=305, end=880, l1=222, r1=312, bridge=1210, board="#241F1D", inlay="trap",  mat="#F5C542"),
  "classical": dict(nut=292, l0=232, r0=342, end=902, l1=228, r1=350, bridge=1232, board="#4A3328", inlay="diamond", mat="#3FCF8E"),
  "headliner": dict(nut=290, l0=322, r0=403, end=878, l1=316, r1=412, bridge=1192, board="#1C1A1F", inlay="star",  mat="#F5C542"),
}
JOBS = {
  "parlor": dict(src="parlor.jpg", k=12), "cutaway": dict(src="cutaway.jpg", k=12), "solid": dict(src="solid.jpg", k=12),
  "hollow": dict(src="hollow.jpg", k=13, rot=90), "single": dict(src="single.jpg", k=13), "classical": dict(src="classical.jpg", k=12),
  "headliner": dict(src="sheet2.jpg", k=10, crop=(1700, 0, 2064, 512), scale=3.0, thin=2),
}
def nearest_label(cent, hexcol):
    c = np.array([int(hexcol[i:i + 2], 16) for i in (1, 3, 5)])
    return int(np.argmin(((cent.astype(int) - c) ** 2).sum(1)))

def fixes(name, lbl, cent):
    h, w = lbl.shape
    if name == "parlor":
        # the offset darker copy of the body sits on the right: a parlor is symmetric, so the body is the left half
        # mirrored; the right half then takes one flat darker tone of each colour (the app's shading rule)
        cx = 277
        for y in range(540, h):
            for x in range(cx + 1, w):
                lbl[y, x] = lbl[y, 2 * cx - x] if 2 * cx - x >= 0 else -1
        k = len(cent)
        dark = (cent.astype(float) * .84).astype(np.uint8)
        cent = np.vstack([cent, dark])
        r = lbl[540:, cx + 1:]
        r[r >= 0] += k
        return lbl, cent
    if name == "classical":
        # the dark outline: the biggest connected piece of the outline colour, the ring round the body, goes
        o = nearest_label(cent, "#8A5527")
        n, cc, st, _ = cv2.connectedComponentsWithStats((lbl == o).astype(np.uint8))
        if n > 1:
            k = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
            lbl[cc == k] = -1
    return lbl, cent

def headliner_body(a, lbl, nk):
    """The body from the traced silhouette (smoothed hard), violet with the right half a shade darker, a gold binding
    inset from the edge, two gold humbuckers in black surrounds and a gold bridge and tailpiece. The low-res source
    can't give a clean binding, so it's drawn."""
    h, w = lbl.shape
    m = (lbl >= 0).astype(np.uint8)
    m[:nk["end"] - 160, :] = 0  # the body only: from a little above where the board ends
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    m = cv2.GaussianBlur(m * 255, (41, 41), 0) > 127
    m = m.astype(np.uint8)
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    outer = smooth_path(cv2.approxPolyDP(c, 5, True))
    inner_m = cv2.GaussianBlur(cv2.erode(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (37, 37))) * 255, (31, 31), 0) > 127
    inner_m = inner_m.astype(np.uint8)
    ci = max(cv2.findContours(inner_m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0], key=cv2.contourArea)
    inner = smooth_path(cv2.approxPolyDP(ci, 5, True))
    cx = (nk["l1"] + nk["r1"]) / 2
    s = f'<clipPath id="hb"><path d="{outer}"/></clipPath><path d="{outer}" fill="#8A47F5"/>'
    s += f'<rect x="{cx:.0f}" y="0" width="{w}" height="{h}" fill="#6E33D1" clip-path="url(#hb)"/>'
    s += f'<path d="{inner}" fill="none" stroke="#F5C542" stroke-width="7" stroke-linejoin="round"/>'
    for y0 in (nk["end"] + 22, nk["end"] + 150):
        s += f'<rect x="{cx - 62:.0f}" y="{y0}" width="124" height="80" rx="10" fill="#1C1A1F"/><rect x="{cx - 50:.0f}" y="{y0 + 12}" width="100" height="56" rx="6" fill="#F5C542"/><rect x="{cx:.0f}" y="{y0 + 12}" width="50" height="56" rx="6" fill="#D9A92E"/>'
        s += "".join(f'<circle cx="{cx - 38 + i * 15.2:.1f}" cy="{y0 + 40}" r="3.6" fill="#B8871C"/>' for i in range(6))
    s += f'<rect x="{cx - 58:.0f}" y="{nk["bridge"] - 70}" width="116" height="20" rx="10" fill="#F5C542"/><rect x="{cx - 70:.0f}" y="{nk["bridge"] - 6}" width="140" height="22" rx="11" fill="#F5C542"/><rect x="{cx:.0f}" y="{nk["bridge"] - 6}" width="70" height="22" rx="11" fill="#D9A92E"/>'
    return s


def qp(c):
    """One closed outline as a smooth cubic path in whole units, relative commands."""
    pts = c.reshape(-1, 2).astype(float) * Q
    n = len(pts)
    if n < 3: return ""
    t = 0.5
    cp = []
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        cp.append((p1 + (p2 - p0) * t / 3, p2 - (p3 - p1) * t / 3, p2))
    cur = np.round(pts[0]).astype(int); d = f"M{cur[0]} {cur[1]}"
    for c1, c2, p in cp:
        e = np.round(p).astype(int)
        a1 = np.round(c1).astype(int) - cur; a2 = np.round(c2).astype(int) - cur; a3 = e - cur
        d += "c" + " ".join(map(str, (a1[0], a1[1], a2[0], a2[1], a3[0], a3[1])))
        cur = e
    return d + "z"

def layers_of(lbl2, cent, rows):
    """Traced colour layers for the rows kept, largest first. Returns [(hex, path)]."""
    keep = np.zeros(lbl2.shape, bool); keep[rows[0]:rows[1]] = True
    layers = []
    for i, col in enumerate(cent):
        m = ((lbl2 == i) & keep).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        if m.sum() / 255 < FLOOR: continue
        layers.append((int(m.sum()) // 255, col, m))
    layers.sort(key=lambda x: -x[0])
    out = []
    for _, col, m in layers:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = "".join(qp(cv2.approxPolyDP(c, EPS, True)) for c in cs if cv2.contourArea(c) >= FLOOR)
        if d: out.append(f"#{col[0]:02x}{col[1]:02x}{col[2]:02x}", ) if False else out.append((f"#{col[0]:02x}{col[1]:02x}{col[2]:02x}", d))
    return out

def shapes(layers):
    return "".join(f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>' for c, d in layers)

def scale_svg(svg):
    """The drawn headliner body is in 2x units: scale it to the art's units with a group transform."""
    return f'<g transform="scale({Q})">{svg}</g>'

built = {}
for name in (sys.argv[1:] or list(JOBS)):
    j = JOBS[name]; nk = NECK[name]
    a = load(f"{S}/src/{j['src']}", j.get("crop"), j.get("rot", 0), j.get("scale", 2.0))
    if name == "hollow": a = cv2.resize(a, (a.shape[1] // 2, a.shape[0] // 2), interpolation=cv2.INTER_AREA)
    lbl, cent = quantize(a, j["k"])
    lbl, cent = fixes(name, lbl, cent)
    lbl2, _ = clean(lbl, j.get("thin", 3))
    h, w = lbl2.shape
    nut, end = nk["nut"], nk["end"]
    head = shapes(layers_of(lbl2, cent, (0, nut + 4)))
    # the top of the body: the first row below the nut where the picture is wider than twice the board
    wid = (lbl2 >= 0).sum(axis=1)
    top = next(y for y in range(nut + 40, h) if wid[y] > 2.0 * (nk["r1"] - nk["l1"]))
    if name == "headliner":
        body = scale_svg(headliner_body(a, lbl, nk))
    else:
        body = shapes(layers_of(lbl2, cent, (top - 6, h)))
    # the widest the body gets, from the label image below the board end
    solid = (lbl2[end:] >= 0)
    cols = np.where(solid.any(axis=0))[0]
    cx = (nk["l1"] + nk["r1"]) / 2
    nums = dict(top=round(top * Q), nut=round(nut * Q), end=round(end * Q), bridge=round(nk["bridge"] * Q), l0=round(nk["l0"] * Q), r0=round(nk["r0"] * Q),
                l1=round(nk["l1"] * Q), r1=round(nk["r1"] * Q), cx=round(cx * Q), w=round(w * Q), h=round(h * Q),
                bl=round(cols.min() * Q), br=round(cols.max() * Q))
    art = dict(head=head, body=body, over="", nums=nums, view=[round(w * Q), round(h * Q)])
    js = "/* Traced from the Nano art by tools/guitars/build.py. Do not edit by hand. */\nexport default " + json.dumps(art, separators=(",", ":")) + ";\n"
    os.makedirs(OUT, exist_ok=True)
    open(f"{OUT}/{name}.js", "w").write(js)
    print(f"{name:10s} head {len(head)/1000:5.1f}K body {len(body)/1000:5.1f}K total {len(js)/1000:5.1f}K", "OK" if len(js) <= BUDGET else "OVER")
