"""Grok's painting of the guitar case lining on Me (2026-11-19): one padded compartment of brown-orange crushed velvet,
repeated once per guitar in the open case, plus a chrome latch for the case's edge. Run: python3 tools/case/paint.py
Writes art/case/velvet-slot.webp (232 x 600, shown at 116 x 300) and art/case/latch.webp (72 x 44, shown at 36 x 22)."""
import numpy as np
from PIL import Image, ImageFilter

rng = np.random.default_rng(1119)
W, H = 232, 600

def noise(w, h, scale, seed):
    r = np.random.default_rng(seed)
    small = r.random((max(2, h // scale + 2), max(2, w // scale + 2))).astype(np.float32)
    im = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(im, np.float32) / 255.0

def smooth(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
# crushed velvet: a fine pile over a soft crush, no direction to it
pile = rng.random((H, W)).astype(np.float32)
pile = np.asarray(Image.fromarray((pile * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.55)), np.float32) / 255
crush = 0.6 * noise(W, H, 7, 2) + 0.4 * noise(W, H, 16, 3)
tex = 0.55 * crush + 0.45 * pile  # 0..1

def rrect_dist(x0, y0, x1, y1, r):
    cx = np.clip(xx, x0 + r, x1 - r); cy = np.clip(yy, y0 + r, y1 - r)
    d = np.hypot(xx - cx, yy - cy) - r
    inside = (xx > x0) & (xx < x1) & (yy > y0) & (yy < y1)
    return np.where(inside, -np.minimum.reduce([xx - x0, x1 - xx, yy - y0, y1 - yy]), d), inside

# height of the padding: rolled cushions around each well, a crease where two compartments meet (the image's edges)
d_bed, in_bed = rrect_dist(16, 100, W - 16, H - 16, 30)
d_pk, in_pk = rrect_dist(20, 16, W - 20, 82, 20)
edge = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy])
cush = np.sqrt(np.clip(smooth(edge, 0, 15), 0, 1))           # rises from the crease
well = lambda d, depth, soft: -depth * smooth(-d, -2, soft)  # falls into a well
h = cush + well(d_bed, 1.25, 26) + well(d_pk, 0.8, 16)
h -= 0.25 * smooth(-d_bed, 20, 110)                          # the bed sinks a little more in the middle
ny = 0.42 * H
h += 0.9 * np.exp(-((yy - ny) / 12) ** 2) * smooth(-d_bed, 0, 10)  # the neck rest, a rolled pad across the bed
h = np.asarray(Image.fromarray(((h + 1.5) * 70).clip(0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 70 - 1.5
h += (tex - 0.5) * 0.05

# light from above, a little left
gy, gx = np.gradient(h)
k = 18
nx_, ny_ = -gx * k, -gy * k
nz = 1 / np.sqrt(1 + nx_ ** 2 + ny_ ** 2)
L = np.array([-0.35, -0.7, 0.62]); L /= np.linalg.norm(L)
diff = (nx_ * L[0] + ny_ * L[1] + L[2]) * nz
occ = 0.3 + 0.7 * smooth(h, -1.4, 0.8)

lo = np.array([70, 26, 8], np.float32); mid = np.array([178, 82, 24], np.float32); hi = np.array([246, 150, 62], np.float32)
glow = np.exp(-(((xx - W * 0.5) / (W * 0.6)) ** 2 + ((yy - H * 0.55) / (H * 0.55)) ** 2))
t = np.clip(0.18 + 0.62 * diff * occ + 0.22 * glow + 0.42 * (tex - 0.5), 0, 1)[..., None]
col = np.where(t < 0.55, lo + (mid - lo) * (t / 0.55), mid + (hi - mid) * ((t - 0.55) / 0.45))
# velvet sheen: the pile lights up where a cushion turns toward you
sheen = np.clip(diff - 0.9, 0, 1) * 90 * (0.6 + 0.8 * pile)
col += sheen[..., None] * np.array([1.0, 0.72, 0.4])
img = Image.fromarray(col.clip(0, 255).astype(np.uint8), "RGB")
img.save("art/case/velvet-slot.webp", quality=86, method=6)

# a chrome latch
LW, LH = 72, 44
ly_, lx_ = np.mgrid[0:LH, 0:LW].astype(np.float32)
a = np.zeros((LH, LW), np.float32)
body = ((lx_ > 6) & (lx_ < LW - 6) & (ly_ > 6) & (ly_ < LH - 6))
a[body] = 1
am = Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
g = 0.55 + 0.45 * np.cos((ly_ / LH) * np.pi * 1.6 - 0.6)
chrome = np.stack([g * 225 + 20, g * 225 + 22, g * 228 + 26], -1)
chrome[(np.abs(lx_ - LW / 2) < 9) & (ly_ > 12) & (ly_ < LH - 12)] *= 0.55
latch = np.dstack([chrome.clip(0, 255), np.asarray(am, np.float32)]).astype(np.uint8)
Image.fromarray(latch, "RGBA").save("art/case/latch.webp", quality=90, method=6)
print("painted")
