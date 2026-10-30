import sys, json, numpy as np, cv2
sys.path.insert(0, sys.argv[1]); from trace import *
S = sys.argv[1]
# Measured from the images (2x scale coords): nut y, board edges at the nut and where the board ends on the body, where strings end.
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

def neck_svg(nk):
    nut, end, br = nk["nut"], nk["end"], nk["bridge"]
    L = br - nut  # scale length, nut to saddle
    def edges(y):
        t = (y - nut) / (end - nut)
        return nk["l0"] + (nk["l1"] - nk["l0"]) * t - 6, nk["r0"] + (nk["r1"] - nk["r0"]) * t + 6
    l0, r0 = edges(nut); l1, r1 = edges(end)
    s = f'<path d="M{l0:.1f} {nut}L{r0:.1f} {nut}L{r1:.1f} {end}Q{(l1 + r1) / 2:.1f} {end + 4} {l1:.1f} {end}Z" fill="{nk["board"]}"/>'
    s += f'<path d="M{r0 - (r0 - l0) * .5:.1f} {nut}L{r0:.1f} {nut}L{r1:.1f} {end}L{(l1 + r1) / 2:.1f} {end}Z" fill="#000" opacity=".12"/>'  # the right half a shade darker
    fy = [nut + L * (1 - 2 ** (-n / 12)) for n in range(1, 30)]
    fy = [y for y in fy if y < end - 4]
    for y in fy:
        l, r = edges(y); s += f'<rect x="{l + 1:.1f}" y="{y - 2:.1f}" width="{r - l - 2:.1f}" height="4" rx="1.5" fill="#C9C4BA"/>'
    mids = {n: ((fy[n - 2] if n > 1 else nut) + fy[n - 1]) / 2 for n in (3, 5, 7, 9, 12, 15) if n <= len(fy)}
    kind, mat = nk["inlay"], nk["mat"]
    for n, y in mids.items():
        l, r = edges(y); cx = (l + r) / 2; bw = r - l; hh = (fy[n - 1] - (fy[n - 2] if n > 1 else nut))
        if kind == "dot":
            rr = 6.5 if nk.get("big") else 5
            xs = [cx - bw * .22, cx + bw * .22] if n == 12 else [cx]
            s += "".join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rr}" fill="{mat}"/>' for x in xs)
        elif kind == "block":
            s += f'<rect x="{cx - bw * .3:.1f}" y="{y - hh * .28:.1f}" width="{bw * .6:.1f}" height="{hh * .56:.1f}" rx="3" fill="{mat}"/>'
        elif kind == "split":
            ww, hh2 = bw * .62, hh * .5
            s += f'<path d="M{cx - ww / 2:.1f} {y - hh2 / 2:.1f}H{cx + ww / 2:.1f}V{y + hh2 / 2:.1f}H{cx - ww / 2:.1f}Z M{cx - ww / 2 - 1:.1f} {y + hh2 * .15:.1f}L{cx + ww / 2 + 1:.1f} {y - hh2 * .15:.1f}L{cx + ww / 2 + 1:.1f} {y + hh2 * .06:.1f}L{cx - ww / 2 - 1:.1f} {y + hh2 * .36:.1f}Z" fill="{mat}" fill-rule="evenodd"/>'
        elif kind == "trap":
            tw, bw2, th = bw * .66, bw * .5, hh * .5
            s += f'<path d="M{cx - tw / 2:.1f} {y - th / 2:.1f}H{cx + tw / 2:.1f}L{cx + bw2 / 2:.1f} {y + th / 2:.1f}H{cx - bw2 / 2:.1f}Z" fill="{mat}"/>'
        elif kind == "diamond":
            d = 7.5
            s += f'<path d="M{cx:.1f} {y - d * 1.3:.1f}Q{cx + d * .2:.1f} {y - d * .2:.1f} {cx + d:.1f} {y:.1f}Q{cx + d * .2:.1f} {y + d * .2:.1f} {cx:.1f} {y + d * 1.3:.1f}Q{cx - d * .2:.1f} {y + d * .2:.1f} {cx - d:.1f} {y:.1f}Q{cx - d * .2:.1f} {y - d * .2:.1f} {cx:.1f} {y - d * 1.3:.1f}Z" fill="{mat}"/><path d="M{cx:.1f} {y - d * 1.3:.1f}Q{cx + d * .2:.1f} {y - d * .2:.1f} {cx + d:.1f} {y:.1f}L{cx:.1f} {y:.1f}Z" fill="#9AF0C8" opacity=".7"/>'
        elif kind == "star":
            R = 9 if n != 12 else 13
            pts = " ".join(f"{cx + (R if i % 2 == 0 else R * .45) * np.sin(np.pi * i / 5):.1f},{y - (R if i % 2 == 0 else R * .45) * np.cos(np.pi * i / 5):.1f}" for i in range(10))
            s += f'<polygon points="{pts}" fill="{mat}"/>'
    s += f'<rect x="{l0:.1f}" y="{nut - 5}" width="{r0 - l0:.1f}" height="8" rx="2" fill="#EFE4C8"/>'
    # six strings, nut to saddle, fanning slightly wider at the bridge
    m = (r0 - l0) * .13; span0 = r0 - l0 - 2 * m
    cxb = (l1 + r1) / 2; span1 = span0 * 1.14
    for i in range(6):
        x0 = l0 + m + span0 * i / 5; x1 = cxb - span1 / 2 + span1 * i / 5
        s += f'<line x1="{x0:.1f}" y1="{nut}" x2="{x1:.1f}" y2="{br}" stroke="#ECE6DA" stroke-width="{2.6 - i * .25:.2f}" stroke-linecap="round"/>'
    return s

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

for name in (sys.argv[2:] or list(JOBS)):
    j = JOBS[name]
    a = load(f"{S}/src/{j['src']}", j.get("crop"), j.get("rot", 0), j.get("scale", 2.0))
    if name == "hollow": a = cv2.resize(a, (a.shape[1] // 2, a.shape[0] // 2), interpolation=cv2.INTER_AREA)
    lbl, cent = quantize(a, j["k"])
    lbl, cent = fixes(name, lbl, cent)
    lbl2, _ = clean(lbl, j.get("thin", 3))
    layers = []
    for i, col in enumerate(cent):
        m = (lbl2 == i).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        if m.sum() / 255 < 60: continue
        layers.append((int(m.sum()) // 255, col, m))
    layers.sort(key=lambda x: -x[0])
    out = []
    for _, col, m in layers:
        m = cv2.dilate(m, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
        cs, _ = cv2.findContours(m, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
        d = "".join(smooth_path(cv2.approxPolyDP(c, 1.2, True)) for c in cs if cv2.contourArea(c) >= 60)
        if d: out.append((f"#{col[0]:02x}{col[1]:02x}{col[2]:02x}", d))
    if name == "headliner":
        # the traced headstock only (above the nut), then the drawn body, then the neck over it
        hs = [(c, d) for c, d in out]
        head = "".join(f'<path fill="{c}" fill-rule="evenodd" d="{d}"/>' for c, d in hs)
        nk = NECK[name]
        body = f'<clipPath id="hh"><rect x="0" y="0" width="{a.shape[1]}" height="{nk["nut"] + 4}"/></clipPath><g clip-path="url(#hh)">{head}</g>' + headliner_body(a, lbl, nk)
        h, w = a.shape[:2]
        open(f"{S}/{name}-n.svg", "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{body}{neck_svg(nk)}</svg>')
        print(name, "drawn"); continue
    open(f"{S}/{name}-n.svg", "w").write(svg(a, out, neck_svg(NECK[name])))
    print(name, "ok", len(out), "layers")
