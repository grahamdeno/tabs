# Painted stats-row icons for Louie: a lit stage candle for the streak (unlit with a wisp of smoke when the streak is out), the Tour Map, the Merch table.
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

def segment_sd(x, y, x1, y1, x2, y2, w):
    px, py = x - x1, y - y1
    dx, dy = x2 - x1, y2 - y1
    t = np.clip((px * dx + py * dy) / (dx * dx + dy * dy + 1e-9), 0, 1)
    return np.hypot(px - t * dx, py - t * dy) - w

def smin(a, b, k):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)

def hex_sd(x, y, cx, cy, r, pointy=True):
    # IQ's hexagon SDF; r is centre to vertex. pointy-top by swapping axes (a 90° turn).
    px, py = x - cx, y - cy
    if pointy: px, py = py, px
    kx, ky, kz = -0.866025404, 0.5, 0.577350269
    px, py = np.abs(px), np.abs(py)
    t = np.minimum(kx * px + ky * py, 0.0) * 2
    px, py = px - t * kx, py - t * ky
    px = px - np.clip(px, -kz * r, kz * r)
    py = py - r
    return np.hypot(px, py) * np.sign(py)

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

# ---------------- streak: a lit stage candle (nights in a row still burning) ----------------
def flame_sd(x, y, cx, cy, w, h):
    """Teardrop flame: narrower toward the tip (up). Not a perfect SDF, good enough for a soft brush."""
    py = (y - cy) / h
    px = (x - cx) / (w * np.clip(0.22 + 0.95 * (py + 0.55), 0.18, 1.15))
    # body
    return (px * px + (py * 1.05) ** 2) - 1

def paint_flame(cv, cx, cy, w, h, halo=True, scale=1.0):
    w, h = w * scale, h * scale
    d = flame_sd(xx, yy, cx, cy, w, h)
    mid = d * min(w, h)
    core = flame_sd(xx, yy, cx, cy + h * 0.16, w * 0.42, h * 0.52) * min(w, h)
    # A tight, mostly-opaque fringe only: a wash halo stains the cream tolex in Light.
    if halo:
        cv.put(C("ff9a20"), soft(mid - 5, 5) * 0.85)
    cv.put(OUT, soft(mid - 6, 2) * 0.9)
    cv.put(C("e24a10"), soft(mid, 2.0))
    cv.put(C("ff8a1a"), soft(mid + 8, 2))
    cv.put(C("ffd24a"), soft(mid + 18, 2))
    cv.put(C("fff4b8"), soft(core, 2.2))
    gl = np.exp(-(((xx - cx + w * 0.12) / (w * 0.32)) ** 2 + ((yy - cy + h * 0.12) / (h * 0.32)) ** 2))
    cv.put(C("ffffff"), gl * 0.6 * soft(mid + 12, 2))
    return mid

# ---------- 1. lit stage candle in a brass holder ----------
def candle(lit=True):
    cv = Canvas()
    ang = np.deg2rad(-4)
    u, v = rot(xx, yy, 144, 168, ang)
    # a real brass cup: bowl, thick rim, short foot
    bowl = ellipse_sd(u, v, 0, 78, 62, 24)
    bowl = np.maximum(bowl, v - 92)          # cut the bottom of the ellipse into a cup
    bowl = np.maximum(bowl, -(v - 68))
    inner = ellipse_sd(u, v, 0, 78, 44, 16)
    inner = np.maximum(inner, v - 86)
    bowl = np.maximum(bowl, -inner)          # hollow
    rim = np.abs(ellipse_sd(u, v, 0, 68, 62, 16)) - 7
    rim = np.maximum(rim, np.abs(v - 68) - 9)
    foot = ellipse_sd(u, v, 0, 100, 30, 11)
    stem = box_sd(u, v, 0, 92, 12, 10, 4)
    holder = np.minimum.reduce([bowl, rim, foot, stem])
    # chunky pillar, slight taper, fills the icon
    taper = 1.0 + np.clip((v + 20) / 600, -0.08, 0.12)
    wax = box_sd(u / taper, v, 0, -4, 42, 72, 14)
    top = ellipse_sd(u, v, 0, -72, 42, 14)
    wax = smin(wax, top, 10)
    drip = ellipse_sd(u, v, 34, -28, 11, 26)
    wax = smin(wax, drip, 8)
    wick = box_sd(u, v, 0, -82, 3.4, 12, 1.4)
    solid = np.minimum(wax, holder)
    drop_shadow(cv, soft(solid, 2), off=(6, 6), blur=5, op=0.5)
    # outline the solid wax and holder only, then the wick, then the flame on top
    cv.put(OUT, soft(solid - 6.5, 2))
    pk = shade(-np.clip(holder, -10, 0), k=0.8)
    cv.put(mix(C("8a5f1c"), C("f3d27a"), 0.38 + 0.5 * pk), soft(holder, 1.5))
    cv.put(C("fff0b8"), soft(rim, 1.3) * np.clip(0.45 + pk, 0, 1) * 0.75)
    litc = shade(-np.clip(wax, -16, 0), k=0.45)
    waxc = mix(C("e2c48a"), C("fff6df"), 0.4 + 0.4 * litc)
    if lit:
        glow = np.exp(-((v + 50) / 48) ** 2) * np.exp(-(u / 55) ** 2)
        waxc = mix(waxc, C("ffd27a"), glow * 0.3)
    cv.put(waxc, soft(wax, 1.6))
    pool = ellipse_sd(u, v, 0, -72, 34, 11)
    cv.put(C("ffe7b0") if lit else C("e8d4a4"), soft(pool, 1.4) * 0.9)
    cv.put(OUT, soft(wick - 3, 1.3) * 0.8)
    cv.put(C("2a1a10"), soft(wick, 1.2))
    if lit:
        cx, cy = 146, 52
        paint_flame(cv, cx, cy, 36, 64, halo=True)
    else:
        cv.put(C("1a120c"), soft(ellipse_sd(u, v, 0, -92, 4.2, 4.2), 1.3))
        smx, smy = rot(xx, yy, 150, 48, np.deg2rad(8))
        wisp = np.abs(smx - 8 * np.sin((30 - smy) / 18)) - (3.0 + 0.028 * np.clip(-smy, 0, 80))
        wisp = np.maximum(wisp, smy - 6)
        wisp = np.maximum(wisp, -smy - 88)
        fade = np.clip((30 - smy) / 100, 0, 1)
        cv.put(C("9a8f84"), soft(wisp, 3.2) * 0.55 * fade)
    return cv


def streak():
    return candle(True)

def streak_off():
    return candle(False)

# ---------------- tour map: a cluster of hexes, the one you hold lit ----------------
def tourmap():
    cv = Canvas()
    ang = np.deg2rad(-8)
    cx, cy, R = 144, 148, 58
    u, v = rot(xx, yy, cx, cy, ang)
    # three pointy-top hexes, one above two
    spots = [(0, -0.75 * R), (-0.866025404 * R, 0.75 * R), (0.866025404 * R, 0.75 * R)]
    hexes = [hex_sd(u, v, x, y, R) for x, y in spots]
    whole = np.minimum.reduce(hexes)
    drop_shadow(cv, soft(whole, 2), off=(6, 6), blur=5, op=0.52)
    cv.put(OUT, soft(whole - 6.5, 2))
    # cream paper tiles for the two you don't hold, with a faint map grain
    fib = noise(2.5, 1, 41)
    cream = mix(C("f0e2c0"), C("d7b888"), 0.25 + 0.12 * fib)
    for h in hexes[1:]:
        lit = shade(-np.clip(h, -12, 0), k=0.35)
        cv.put(mix(cream, C("fff6e4"), 0.35 + lit * 0.3), soft(h, 1.6))
        # inner hairline, like a map border
        cv.put(C("8a6a3c"), soft(np.abs(h + 5) - 1.6, 1.2) * 0.45)
    # the hex you hold: a teal enamel, the Road's cool accent as a painted inlay
    hold = hexes[0]
    pk = shade(-np.clip(hold, -14, 0), k=0.7)
    teal = mix(C("0b6f68"), C("3ee0d0"), 0.35 + 0.45 * pk)
    cv.put(teal, soft(hold, 1.6))
    cv.put(C("b8fff4"), soft(np.abs(hold + 6) - 2.0, 1.3) * 0.55)  # inner rim catch
    gl = np.exp(-(((u - spots[0][0] + 12) / 16) ** 2 + ((v - spots[0][1] + 16) / 10) ** 2))
    cv.put(C("e8fffb"), gl * 0.55 * soft(hold + 4, 2))
    return cv

# ---------------- merch: a hanging cream tee, the merch table's classic stall item ----------------
def merch():
    cv = Canvas()
    ang = np.deg2rad(6)
    u, v = rot(xx, yy, 144, 158, ang)
    # body and sleeves
    body = box_sd(u, v, 0, 28, 58, 86, 16)
    # shoulders wider than the hem
    torso = box_sd(u, v, 0, 20, 54, 80, 14)
    hem = box_sd(u, v, 0, 86, 58, 24, 10)
    body = smin(torso, hem, 12)
    sl = box_sd(u, v, -72, -38, 28, 22, 12)
    sr = box_sd(u, v, 72, -38, 28, 22, 12)
    shirt = np.minimum.reduce([body, sl, sr])
    # neck scoop
    neck = ellipse_sd(u, v, 0, -68, 22, 16)
    shirt = np.maximum(shirt, -neck)
    # a wire hanger: a small open hook and a triangle, drawn as thin segments
    hook = np.abs(np.hypot(u, v + 108) - 11) - 3.4
    hook = np.maximum(hook, -(u - 2))  # open on the right, a hook not a lock
    stem = segment_sd(u, v, 0, -108, 0, -86, 3.4)
    arm_l = segment_sd(u, v, 0, -78, -68, -42, 3.4)
    arm_r = segment_sd(u, v, 0, -78,  68, -42, 3.4)
    bar = segment_sd(u, v, -68, -42, 68, -42, 3.4)
    hang = np.minimum.reduce([hook, stem, arm_l, arm_r, bar])
    whole = np.minimum(shirt, hang)
    drop_shadow(cv, soft(whole, 2), off=(6, 6), blur=5, op=0.5)
    cv.put(OUT, soft(whole - 6.5, 2))
    # brass hanger
    pk = shade(-np.clip(hang, -6, 0), k=0.8)
    cv.put(mix(C("8a5f1c"), C("f3d27a"), 0.4 + pk), soft(hang, 1.4))
    # cotton tee, warm cream, with a couple of soft folds
    fib = noise((3, 3), 1, 51) * 0.5 + noise(5, 1, 52) * 0.5  # softer cotton, less wood-grain
    fold = 0.5 + 0.5 * np.sin((u + 10) / 18)
    fold = nd.gaussian_filter(fold, 2)
    cloth = mix(C("d7b070"), C("f3e0b4"), 0.4 + 0.25 * shade(-np.clip(shirt, -16, 0), k=0.4))
    cloth = cloth * (1 + 0.05 * fib[..., None])
    cloth = mix(cloth, C("c9a56e"), (1 - fold) * 0.18)
    cv.put(cloth, soft(shirt, 1.6))
    # printed mark: a dark teal star, merch-table simple
    # star in unrotated canvas is easier via mask, then we paint in u,v by sampling... use a disk+star in uv by converting
    # build star in uv space: approximate by placing at the body centre
    sx, sy = 144, 168
    # rotate the star with the shirt: map uv back... easier to evaluate star in uv
    # reuse star_mask in xy, so compute the shirt-local centre in xy
    # centre of print in uv is (0, 22); rotate back to xy
    ca, sa = np.cos(-ang), np.sin(-ang)
    px, py = 0 * ca + 22 * sa + 144, -0 * sa + 22 * ca + 158
    cv.put(C("0d5c56"), star_mask(px, py, 22, 9, np.rad2deg(ang)) * soft(shirt + 8, 2))
    # hem stitch
    st = np.abs(v - 96) - 1.4
    cv.put(C("c4a06a"), soft(np.maximum(st, shirt + 4), 1.2) * 0.55)
    # a soft shoulder highlight
    gl = np.exp(-(((u + 18) / 22) ** 2 + ((v + 20) / 12) ** 2))
    cv.put(C("fffaf0"), gl * 0.4 * soft(shirt + 4, 2))
    return cv

def export(cv, name, out_dir, out=72):
    rgba = np.dstack([np.clip(cv.rgb, 0, 1), np.clip(cv.a, 0, 1)])
    big = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
    big.save(f"{out_dir}/stat-{name}-big.png")
    big.resize((out, out), Image.LANCZOS).save(f"{out_dir}/stat-{name}.webp", "WEBP", quality=90, method=6, alpha_quality=100)

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2: sys.exit("usage: paint.py <out-dir> (never art/ itself: art/stats/ pictures are kept, not overwritten)")
    for nm, f in (("streak", streak), ("streak-off", streak_off), ("map", tourmap), ("merch", merch)): export(f(), nm, sys.argv[1])
