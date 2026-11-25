# Painted stats-row icons for Louie: guitar (streak), ticket stub (fans), brass coin (tips).
# Painted at 4x of the 72 px export (3x of 24 pt), then downsampled. Grok's art: run from the repo root as
#   python3 tools/stats/paint.py <out-dir>   (needs numpy, scipy and Pillow; writes stat-<name>.webp and a large PNG to look at)
import numpy as np
from PIL import Image
from scipy import ndimage as nd
S = 288
rng = np.random.default_rng(7)
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) + 0.5

def noise(sigma, amp=1.0, seed=None):
    r = np.random.default_rng(seed).standard_normal((S, S)).astype(np.float32)
    r = nd.gaussian_filter(r, sigma); r /= (r.std() + 1e-6); return r * amp

def soft(d, w=1.6):  # signed distance (negative inside) to alpha
    return np.clip(0.5 - d / w, 0, 1)

def rot(x, y, cx, cy, a):
    c, s = np.cos(a), np.sin(a); x, y = x - cx, y - cy
    return c * x + s * y, -s * x + c * y

def ellipse_sd(x, y, cx, cy, rx, ry):
    k = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
    return (k - 1) * min(rx, ry)

def box_sd(x, y, cx, cy, hw, hh, r=0):
    qx = np.abs(x - cx) - hw + r; qy = np.abs(y - cy) - hh + r
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)

class Canvas:
    def __init__(s): s.rgb = np.zeros((S, S, 3), np.float32); s.a = np.zeros((S, S), np.float32)
    def put(s, color, alpha):
        alpha = np.clip(alpha, 0, 1)[..., None]
        col = np.broadcast_to(np.asarray(color, np.float32), (S, S, 3)) if np.ndim(color) == 1 else color
        s.rgb = col * alpha + s.rgb * (1 - alpha); s.a = alpha[..., 0] + s.a * (1 - alpha[..., 0])

def shade(h, light=(-0.6, -0.8), k=1.0):
    gy, gx = np.gradient(nd.gaussian_filter(h, 1.2))
    return np.clip(-(gx * light[0] + gy * light[1]) * k, -1, 1)

def drop_shadow(cv, mask, off=(5, 7), blur=6, op=0.55):
    sh = nd.shift(nd.gaussian_filter(mask, blur), off, order=1)
    cv.put((0.10, 0.06, 0.03), sh * op)

def star_mask(cx, cy, ro, ri, rot_deg=0):
    from PIL import ImageDraw
    big = Image.new("L", (S * 4, S * 4), 0); d = ImageDraw.Draw(big)
    pts = []
    for i in range(10):
        a = np.deg2rad(-90 + rot_deg + i * 36); r = ro if i % 2 == 0 else ri
        pts.append(((cx + r * np.cos(a)) * 4, (cy + r * np.sin(a)) * 4))
    d.polygon(pts, fill=255)
    return np.asarray(big.resize((S, S), Image.LANCZOS), np.float32) / 255

def C(h): h = h.lstrip("#"); return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
def mix(a, b, t): t = np.clip(t, 0, 1)[..., None] if np.ndim(t) else t; return a * (1 - t) + b * t
OUT = C("3a2416")  # warm espresso outline, reads on cream and on black

# ---------------- guitar: a sunburst acoustic, tilted, headstock up-right ----------------
def guitar():
    cv = Canvas()
    ang = np.deg2rad(-45)  # neck points to the upper right
    cx, cy = 124, 164
    u, v = rot(xx, yy, cx, cy, ang); u, v = u / 0.9, v / 0.9  # u along the guitar (negative = body end), v across
    # body: two lobes
    lower = ellipse_sd(u, v, -52, 0, 58, 62)
    upper = ellipse_sd(u, v, 18, 0, 40, 46)
    body = smin(lower, upper, 22)
    waist = ellipse_sd(u, v, -14, 0, 18, 80)  # keep a waist
    neck = box_sd(u, v, 92, 0, 62, 11.5, 3)
    head = box_sd(u, v, 168, 0, 24, 17, 7)
    headw = smin(head, box_sd(u, v, 150, 0, 8, 12), 6)
    pegs = np.minimum.reduce([ellipse_sd(u, v, 156 + 14 * i, s * 24, 6.5, 5.5) for i in range(3) for s in (-1, 1)])
    whole = np.minimum.reduce([body, neck, headw])
    m_whole = soft(whole, 2)
    drop_shadow(cv, np.maximum(m_whole, soft(pegs)), off=(6, 4), blur=5, op=0.5)
    # outline
    cv.put(OUT, soft(np.minimum(whole, pegs) - 6, 2))
    # pegs: mismatched brass/chrome is too fine at 24 px, so warm brass
    pk = shade(-np.clip(pegs, -6, 0), k=0.9)
    cv.put(mix(C("b8893c"), C("f2d58c"), 0.5 + pk), soft(pegs))
    # body sunburst
    rr = np.sqrt(((u + 40) / 92) ** 2 + (v / 70) ** 2)
    grain = noise((0.8, 9), 1, 3)
    gu, gv = rot(xx, yy, cx, cy, ang)
    grainr = nd.rotate(noise((10, 0.9), 1, 4), np.rad2deg(ang) * 0 + 42, reshape=False, mode="reflect")
    amber, burnt, dark = C("e9a64a"), C("a5521f"), C("3d1b0c")
    bc = mix(amber, burnt, np.clip((rr - 0.35) * 2.2, 0, 1))
    bc = mix(bc, dark, np.clip((rr - 0.78) * 3.5, 0, 1))
    bc = bc * (1 + 0.06 * grainr[..., None])
    bc = bc * (1 + 0.045 * noise(5, 1, 5)[..., None])  # painterly mottling
    cv.put(bc, soft(body, 2))
    # cream binding
    bind = np.abs(body + 3.5) - 2.2
    cv.put(C("efe0bd"), soft(bind, 1.6) * 0.95)
    # sound hole with rosette
    hole = ellipse_sd(u, v, 4, 0, 17, 17)
    cv.put(C("e9d6ad"), soft(np.abs(hole + 1) - 4.5, 1.5))
    cv.put(C("1a0d06"), soft(hole + 4.5, 1.5))
    # pickguard
    pg = ellipse_sd(u, v, -6, 24, 22, 15)
    pg = np.maximum(pg, -hole - 6)
    # bridge
    br = box_sd(u, v, -70, 0, 7, 27, 4)
    cv.put(C("2a140a"), soft(br, 1.5))
    cv.put(C("efe2c4"), soft(box_sd(u, v, -66, 0, 1.6, 21), 1.2))
    # neck: rosewood board
    cv.put(C("3a1d10") * (1 + 0.12 * grain[..., None]), soft(neck, 1.6))
    # frets
    for i in range(1, 9):
        f = np.abs(u - (40 + i * 12.5)) - 1.1
        cv.put(C("d9cfb8"), soft(np.maximum(f, neck + 1.5), 1.1) * 0.9)
    # headstock: dark walnut with face sheen
    hk = shade(-np.clip(headw, -10, 0), k=0.45)
    cv.put(mix(C("2e170b"), C("7a4422"), 0.35 + hk), soft(headw, 1.6))
    # nut
    cv.put(C("f3ead3"), soft(np.maximum(np.abs(u - 31) - 2.2, neck), 1.2))
    # strings
    for sv in (-6.5, -2.2, 2.2, 6.5):
        st = np.maximum(np.abs(v - sv * (1 if True else 1)) - 0.9, np.maximum(-66 - u, u - 150))
        cv.put(C("f4ecd8"), soft(st, 1.0) * 0.75)
    # gloss: a soft highlight on the upper-left of the body
    gl = np.exp(-(((u + 60) / 26) ** 2 + ((v + 30) / 14) ** 2))
    cv.put(C("fff3d6"), gl * 0.45 * soft(body + 6, 3))
    return cv

# ---------------- ticket: a cream stub, torn on the right, with a printed border ----------------
def ticket():
    cv = Canvas()
    ang = np.deg2rad(-14)
    u, v = rot(xx, yy, 144, 146, ang)
    hw, hh = 122, 76
    base = box_sd(u, v, 0, 0, hw, hh, 9)
    # notches on the left edge (a stub punched by the door)
    notch = ellipse_sd(u, v, -hw, 0, 16, 16)
    # torn right edge: a jagged line
    t = np.linspace(-hh - 10, hh + 10, 60)
    jag = np.random.default_rng(11).uniform(-7, 7, t.size); jag[::2] *= 0.4
    edge = hw - 6 + np.interp(v, t, jag)
    tear = u - edge
    shape = np.maximum(np.maximum(base, -notch), tear)
    m = soft(shape, 1.8)
    drop_shadow(cv, m, off=(6, 5), blur=5, op=0.5)
    cv.put(OUT, soft(shape - 6, 2))
    # paper: cream with fibres and a warm age vignette
    fib = noise((0.6, 5), 1, 21) * 0.5 + noise(2, 1, 22) * 0.5
    rr = np.sqrt((u / hw) ** 2 + (v / hh) ** 2)
    paper = mix(C("f7ecd2"), C("e2c99a"), np.clip((rr - 0.55) * 1.6, 0, 1))
    paper = paper * (1 + 0.022 * fib[..., None])
    cv.put(paper, m)
    # torn fibres: a lighter, rough rim on the torn edge
    cv.put(C("fffaf0"), soft(np.abs(tear + 3) - 2.2, 1.6) * soft(base, 1) * 0.9)
    # printed edge: a red double rule inset from the sides (stops before the tear)
    inner = box_sd(u, v, -6, 0, hw - 22, hh - 16, 5)
    rule = np.abs(inner) - 4.0
    rule = np.maximum(rule, -notch - 10)
    ink = C("b2362a")
    cv.put(ink, soft(np.maximum(rule, tear + 14), 1.4) * 0.92)
    # a printed star in the middle panel, and a band of stub text as two ink bars
    sx, sy = 144 + np.cos(ang) * -26, 146 - np.sin(ang) * -26
    cv.put(C("23403d"), star_mask(sx, sy, 38, 16, -np.rad2deg(ang)) * 0.94)
    # perforation line before the stub end
    pu = 52
    for k in range(-5, 6):
        d = ellipse_sd(u, v, pu, k * 11, 3.2, 3.2)
        cv.put(C("8a6a44"), soft(d, 1.2) * 0.85)
    # stub end print: two short bars
    for k, w in ((-18, 16), (0, 22), (18, 12)):
        cv.put(ink, soft(box_sd(u, v, 74, k, 3.2, w / 2, 2), 1.3) * 0.85)
    # a soft crease shadow across
    cr = np.exp(-((u - v * 0.3 + 10) / 3.5) ** 2)
    cv.put(C("b89565"), cr * 0.18 * m)
    return cv

# ---------------- coin: a brass coin, tilted a little, stamped with a guitar pick ----------------
def coin():
    cv = Canvas()
    cx, cy, R = 140, 134, 116
    ry = R * 0.93
    thick = 14
    face = ellipse_sd(xx, yy, cx, cy, R, ry)
    edge = ellipse_sd(xx, yy, cx, cy + thick, R, ry)
    side = np.minimum(face, np.maximum(edge, -(yy - cy) * 1 - 0) )
    side = np.minimum(face, np.maximum(edge, np.abs(xx - cx) - R))
    whole = np.minimum(face, edge)
    drop_shadow(cv, soft(whole, 2), off=(6, 5), blur=6, op=0.5)
    cv.put(OUT, soft(whole - 6, 2))
    # the milled edge, darker brass with reeds
    reeds = 0.5 + 0.5 * np.sin((xx - cx) / R * 60)
    cv.put(mix(C("6b4a17"), C("a77a2c"), reeds * 0.6), soft(edge, 1.6))
    # face: brushed brass, light from the upper left
    rr = np.hypot((xx - cx) / R, (yy - cy) / ry)
    lit = np.clip(0.55 - 0.45 * ((xx - cx) / R * 0.6 + (yy - cy) / ry * 0.8), 0, 1)
    brush = nd.gaussian_filter(rng.standard_normal((S, S)).astype(np.float32), (0.5, 7)); brush /= brush.std()
    brass = mix(C("9c6e22"), C("f3d27a"), lit)
    brass = brass * (1 + 0.04 * brush[..., None])
    cv.put(brass, soft(face, 1.6))
    # raised rim: a bright ring and a dark inner groove
    rim = (rr - 0.86) * R
    cv.put(C("fbe7a6"), soft(np.abs(rim - 3) - 3.5, 1.5) * np.clip(lit + 0.2, 0, 1))
    cv.put(C("5e3e10"), soft(np.abs(rim + 3.5) - 2, 1.4) * 0.8)
    # a stamped pick: dark recess with a bright lower-right lip (embossed look)
    def pick_sd(ox=0, oy=0, sc=1.0):
        x, y = (xx - cx - ox) / sc, (yy - cy + 4 - oy) / sc
        a = ellipse_sd(x, y, 0, -6, 36, 34)
        b = (np.abs(x) * 0.8 + y * 0.6) - 20
        return (np.maximum(a, b) - 10) * sc
    p = pick_sd()
    cv.put(C("fff0b8"), soft(np.maximum(pick_sd(2.5, 3), -p), 1.5) * 0.9)   # lip catching the light
    cv.put(C("6a4614"), soft(np.maximum(pick_sd(-2.5, -3), -pick_sd(2.5, 3) - 0), 1.5) * 0.9)  # shadowed upper edge
    cv.put(mix(C("8a5f1c"), C("c99a43"), lit * 0.9), soft(p + 3, 1.4))
    # a small star in the pick
    cv.put(C("5a3a0d"), star_mask(cx, cy - 12, 20, 8.5) * 0.85)
    cv.put(C("f6dc8c"), np.clip(star_mask(cx + 1.5, cy - 10.5, 20, 8.5) - star_mask(cx, cy - 12, 20, 8.5), 0, 1) * 0.6)
    # specular glint
    gl = np.exp(-(((xx - cx + 52) / 22) ** 2 + ((yy - cy + 58) / 10) ** 2))
    cv.put(C("fffbe8"), gl * 0.7 * soft(face + 4, 2))
    return cv

def export(cv, name, out_dir, out=72):
    rgba = np.dstack([np.clip(cv.rgb, 0, 1), np.clip(cv.a, 0, 1)])
    big = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    big.save(f"{out_dir}/stat-{name}-big.png")
    big.resize((out, out), Image.LANCZOS).save(f"{out_dir}/stat-{name}.webp", "WEBP", quality=90, method=6, alpha_quality=100)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2: sys.exit("usage: paint.py <out-dir> (never art/ itself: art/stats/ pictures are kept, not overwritten)")
    for nm, f in (("guitar", guitar), ("ticket", ticket), ("coin", coin)): export(f(), nm, sys.argv[1])
