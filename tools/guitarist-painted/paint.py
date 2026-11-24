# Paint the guitarist as transparent layers on one 800 by 800 canvas.
# Run from the repo: python3 tools/guitarist-painted/paint.py
# Masters are flat light grey. Shade is lighting, 128 meaning no change.
# Nothing under art/ is overwritten except this folder, which this script owns.

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art" / "guitarist-painted"
W = H = 800
GREY = 208

Y, X = np.mgrid[0:H, 0:W].astype(np.float32)

# Shared landmarks. Every part is drawn against these, so the layers stack at 0,0.
EYE_L = (348.0, 228.0)
EYE_R = (452.0, 228.0)
MOUTH = (400.0, 328.0)
BROW_Y = 186.0

EYE_SHAPE = {
    "round": (26.0, 30.0, 15.5, 7.2),
    "wide": (34.0, 28.0, 16.5, 7.6),
    "narrow": (28.0, 16.0, 10.5, 5.2),
}

# shoulder, elbow, wrist. The guitar neck runs to the viewer's right.
POSES = {
    "play": {
        "left": ((318.0, 524.0), (210.0, 600.0), (372.0, 636.0)),
        "right": ((482.0, 524.0), (640.0, 548.0), (548.0, 508.0)),
    },
    "hornsUp": {
        "left": ((318.0, 526.0), (230.0, 640.0), (250.0, 724.0)),
        "right": ((482.0, 520.0), (700.0, 360.0), (640.0, 214.0)),
    },
    "rest": {
        "left": ((318.0, 526.0), (236.0, 640.0), (258.0, 722.0)),
        "right": ((482.0, 526.0), (564.0, 640.0), (542.0, 722.0)),
    },
}
HAND = {"play": ("strum", "fret"), "hornsUp": ("down", "horns"), "rest": ("down", "down")}
LONG = {"flannel", "leather", "stage"}
LOOKS = ("tee", "flannel", "vest", "leather", "stage")
POSES_N = ("play", "hornsUp", "rest")

HAIR = ("shag", "curly", "buzz", "mohawk", "braids", "bob", "bun", "swoop", "long", "locs", "pixie", "ponytail", "longhawk")
FACE = ("oval", "square", "round", "heart")
BROWS = ("natural", "thick", "arched", "straight")
NOSE = ("wedge", "button", "bridge", "broad")
MOODS = ("happy", "cheer", "proud", "sleepy", "worried")
BEARDS = ("stubble", "moustache", "beard")
HATS = ("beanie", "cap", "bandana")
SPECS = ("round", "square", "shades")

FILES = []


def noise_tiles():
    rng = np.random.default_rng(7)
    tiles = []
    for _ in range(6):
        small = rng.normal(0, 1, (48, 48)).astype(np.float32)
        im = Image.fromarray(small, "F").resize((W, H), Image.Resampling.BICUBIC)
        tiles.append(np.asarray(im).astype(np.float32))
    return tiles


NOISE = noise_tiles()


def ellipse(cx, cy, rx, ry, rot=0.0):
    dx = X - np.float32(cx)
    dy = Y - np.float32(cy)
    if rot:
        c = math.cos(rot)
        s = math.sin(rot)
        dx, dy = c * dx + s * dy, -s * dx + c * dy
    rx = max(float(rx), 0.6)
    ry = max(float(ry), 0.6)
    scale = min(rx, ry)
    return np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2) * scale - scale


def circle(cx, cy, r):
    return np.hypot(X - cx, Y - cy) - np.float32(r)


def smin(a, b, k):
    k = np.float32(k)
    h = np.maximum(k - np.abs(a - b), 0.0) / k
    return np.minimum(a, b) - h * h * k * 0.25


def union(parts, k=16.0):
    acc = parts[0]
    for p in parts[1:]:
        acc = smin(acc, p, k)
    return acc


def subtract(a, b):
    return np.maximum(a, -b)


def roundbox(cx, cy, half_w, half_h, rad):
    rad = min(float(rad), half_w - 0.5, half_h - 0.5)
    bx = half_w - rad
    by = half_h - rad
    dx = np.abs(X - cx) - bx
    dy = np.abs(Y - cy) - by
    return np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) + np.minimum(np.maximum(dx, dy), 0) - rad


def capsule(p1, p2, r, t0=0.0, t1=1.0):
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = (x2 - x1), (y2 - y1)
    ax, ay = x1 + dx * t0, y1 + dy * t0
    bx, by = x1 + dx * t1, y1 + dy * t1
    ex, ey = bx - ax, by - ay
    l2 = ex * ex + ey * ey
    if l2 < 1e-3:
        return circle(ax, ay, r)
    vx, vy = X - ax, Y - ay
    t = np.clip((vx * ex + vy * ey) / l2, 0.0, 1.0)
    return np.hypot(vx - ex * t, vy - ey * t) - np.float32(r)


def polygon_sdf(pts):
    d = np.full((H, W), 1e9, np.float32)
    inside = np.zeros((H, W), np.bool_)
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        ex, ey = x2 - x1, y2 - y1
        l2 = ex * ex + ey * ey + 1e-6
        vx, vy = X - x1, Y - y1
        t = np.clip((vx * ex + vy * ey) / l2, 0.0, 1.0)
        d = np.minimum(d, np.hypot(vx - ex * t, vy - ey * t))
        den = y2 - y1 if abs(y2 - y1) > 1e-6 else 1.0
        cond = ((y1 > Y) != (y2 > Y)) & (X < x1 + (x2 - x1) * (Y - y1) / den)
        inside ^= cond
    return np.where(inside, -d, d).astype(np.float32)


def alpha_of(sdf, edge=1.15):
    a = np.clip(0.5 - sdf / (2.0 * edge), 0.0, 1.0)
    a[a < 0.012] = 0.0
    return a


def volume_shade(sdf, puff=16.0):
    # Soft painted light from the upper left. A broad falloff, not the shape's
    # skeleton, so a big piece of hair or a shirt does not grow a crease down the middle.
    inside = np.clip(-sdf, 0.0, 36.0) / 36.0
    shade = 112.0 + inside * 24.0 + (430.0 - X) * 0.04 + (250.0 - Y) * 0.045
    rim = np.clip((2.4 - sdf) / 2.4, 0.0, 1.0) * (sdf < 2.4) * (sdf > -8.0)
    return shade * (1.0 - 0.18 * rim)


def clip_shade(shade, seed):
    shade = shade + NOISE[seed % 6] * 4.2
    return np.clip(shade, 68.0, 150.0)


def save_webp(path, rgba):
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray(rgba, "RGBA")
    im.save(path, "WEBP", lossless=True, quality=100, method=4, exact=True)


def rgba_color(rgb, alpha):
    a = np.clip(alpha, 0.0, 1.0)
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = rgb[0]
    out[..., 1][m] = rgb[1]
    out[..., 2][m] = rgb[2]
    out[..., 3] = (a * 255.0).astype(np.uint8)
    return out


def master_rgba(alpha):
    a = np.clip(alpha, 0.0, 1.0)
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = GREY
    out[..., 1][m] = GREY
    out[..., 2][m] = GREY
    out[..., 3] = (a * 255.0).astype(np.uint8)
    return out


def shade_rgba(shade, alpha):
    a = np.clip(alpha, 0.0, 1.0)
    s = np.clip(shade, 0, 255).astype(np.uint8)
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = s[m]
    out[..., 1][m] = s[m]
    out[..., 2][m] = s[m]
    out[..., 3] = (a * 255.0).astype(np.uint8)
    return out


def add_file(rel, order, part, ident, role, tint=None, shade=None):
    entry = {"file": rel, "order": order, "part": part, "role": role}
    if ident is not None:
        entry["id"] = ident
    if tint is not None:
        entry["tint"] = tint
    if shade is not None:
        entry["shade"] = shade
    FILES.append(entry)


def emit_volume(rel, sdf, order, part, ident, role, tint, seed, alpha=None, shade=None, edge=1.15):
    a = alpha if alpha is not None else alpha_of(sdf, edge)
    a = np.where(a < 0.012, np.float32(0), a)
    sh = shade if shade is not None else clip_shade(volume_shade(sdf), seed)
    save_webp(OUT / f"{rel}.webp", master_rgba(a))
    save_webp(OUT / f"{rel}-shade.webp", shade_rgba(sh, a))
    add_file(f"{rel}.webp", order, part, ident, role, tint=tint, shade=f"{rel}-shade.webp")
    add_file(f"{rel}-shade.webp", order, part, ident, "shade", shade=None)
    FILES[-1]["of"] = f"{rel}.webp"


def emit_fixed(rel, rgba, order, part, ident, role):
    save_webp(OUT / rel, rgba)
    add_file(rel, order, part, ident, role)


def arm_sdf(points):
    upper = capsule(points[0], points[1], 27)
    lower = capsule(points[1], points[2], 21)
    return smin(upper, lower, 16)


def sleeve_sdf(points, long):
    cap = circle(points[0][0], points[0][1], 32)
    if long:
        upper = capsule(points[0], points[1], 30)
        lower = capsule(points[1], points[2], 26, 0.0, 0.84)
        return union([cap, upper, lower], 14)
    return union([cap, capsule(points[0], points[1], 31, 0.0, 0.7)], 14)


def hand_axes(wrist, elbow):
    dx, dy = wrist[0] - elbow[0], wrist[1] - elbow[1]
    length = math.hypot(dx, dy) or 1.0
    ux, uy = dx / length, dy / length
    return ux, uy, -uy, ux


def hand_sdf(wrist, elbow, kind):
    ux, uy, px, py = hand_axes(wrist, elbow)
    cx, cy = wrist[0] + ux * 12, wrist[1] + uy * 12
    palm = circle(cx, cy, 18)
    parts = [palm]
    if kind == "strum":
        for off in (-16, -5, 6, 16):
            bx = cx + px * off * 0.55 + ux * 8
            by = cy + py * off * 0.55 + uy * 8
            tx = bx + px * off * 0.35 + ux * 20
            ty = by + py * off * 0.35 + uy * 20
            parts.append(capsule((bx, by), (tx, ty), 6.4))
        parts.append(capsule((cx - px * 14, cy - py * 14), (cx - px * 28 + ux * 4, cy - py * 28 + uy * 4), 7.2))
    elif kind == "fret":
        for off in (-15, -5, 6, 15):
            bx = cx + px * off * 0.4
            by = cy + py * off * 0.4
            tx = bx - px * 22 + ux * 4
            ty = by - py * 22 + uy * 4
            parts.append(capsule((bx, by), (tx, ty), 6.2))
        parts.append(capsule((cx + ux * 6, cy + uy * 6), (cx + ux * 18 + px * 12, cy + uy * 18 + py * 12), 6.8))
    elif kind == "horns":
        parts.append(capsule((cx + px * 8, cy + py * 8), (cx + px * 12 + ux * 46, cy + py * 12 + uy * 46), 6.6))
        parts.append(capsule((cx - px * 9, cy - py * 9), (cx - px * 13 + ux * 42, cy - py * 13 + uy * 42), 6.2))
        parts.append(capsule((cx + px * 1, cy + py * 1), (cx + ux * 12, cy + uy * 12), 6.4))
    else:
        for off in (-14, -4, 6, 15):
            bx = cx + px * off * 0.45 + ux * 10
            by = cy + py * off * 0.45 + uy * 10
            tx = bx + ux * 22
            ty = by + uy * 22
            parts.append(capsule((bx, by), (tx, ty), 6.2))
        parts.append(capsule((cx - px * 12, cy - py * 12), (cx - px * 24 + ux * 6, cy - py * 24 + uy * 6), 6.6))
    return union(parts, 4.0)


def torso_sdf():
    upper = ellipse(400, 548, 168, 78)
    mid = roundbox(400, 650, 136, 78, 40)
    low = roundbox(400, 748, 120, 52, 30)
    s = smin(union([upper, mid], 26), low, 22)
    # shoulder caps so the sleeves meet the shirt on every pose
    s = union([s, circle(318, 528, 38), circle(482, 528, 38)], 20)
    return np.maximum(s, 468 - Y)


def body_sdf():
    neck = capsule((400, 368), (400, 455), 36)
    flare = capsule((400, 430), (400, 545), 62)
    s = smin(neck, flare, 18)
    return np.maximum(s, Y - 590)


def face_sdf(shape):
    if shape == "oval":
        head = ellipse(400, 242, 112, 142)
        ears = ((266, 258), (534, 258))
        er = (18, 24)
    elif shape == "square":
        head = roundbox(400, 248, 120, 138, 52)
        ears = ((256, 274), (544, 274))
        er = (17, 24)
    elif shape == "round":
        head = ellipse(400, 236, 130, 132)
        ears = ((250, 248), (550, 248))
        er = (18, 24)
    else:
        head = smin(ellipse(400, 200, 124, 108), ellipse(400, 328, 54, 74), 32)
        ears = ((262, 228), (538, 228))
        er = (18, 24)
    parts = [head]
    for ex, ey in ears:
        parts.append(ellipse(ex, ey, er[0] if shape != "oval" else 18, er[1] if shape != "oval" else 24))
    return union(parts, 20), ears


def neck_hole():
    return ellipse(400, 486, 42, 36)


def brow_sdf(style, mood):
    length = {"natural": 34, "thick": 38, "arched": 36, "straight": 36}[style]
    thick = {"natural": 5.6, "thick": 9.2, "arched": 5.2, "straight": 4.4}[style]
    arch = {"natural": 5, "thick": 3, "arched": 12, "straight": 1}[style]
    lift = {"neutral": 0, "worried": -1, "raised": -14}[mood]
    inner = {"neutral": 0, "worried": -13, "raised": -2}[mood]
    parts = []
    for side, cx in ((-1, 348.0), (1, 452.0)):
        ox = cx - side * length
        ix = cx + side * (length * 0.72)
        oy = BROW_Y + 3 + lift
        iy = BROW_Y - arch + lift + inner
        my = (oy + iy) / 2 - arch * 0.35
        mx = (ox + ix) / 2
        parts.append(capsule((ox, oy), (mx, my), thick))
        parts.append(capsule((mx, my), (ix, iy), thick * 0.92))
    return union(parts, 5.5)


def nose_sdf(kind):
    if kind == "wedge":
        return union([capsule((400, 260), (400, 284), 4.0), circle(400, 286, 6.2)], 5)
    if kind == "button":
        return union([circle(400, 286, 9.5), ellipse(400, 292, 12, 6)], 6)
    if kind == "bridge":
        return union([capsule((400, 246), (400, 294), 5.2), ellipse(394, 296, 6, 4.5), ellipse(406, 296, 6, 4.5)], 5)
    return union([
        capsule((400, 252), (400, 288), 7.5),
        ellipse(388, 298, 8, 5),
        ellipse(412, 298, 8, 5),
        ellipse(400, 294, 14, 7),
    ], 6)


def below(sdf, y):
    return np.maximum(sdf, np.float32(y) - Y)


def above(sdf, y):
    return np.maximum(sdf, Y - np.float32(y))


def ribbon(x0, y0, x1, y1, w0, w1):
    # overlapping circles, so a lock is one smooth shape and not a string of beads
    length = math.hypot(x1 - x0, y1 - y0) or 1.0
    width = max(3.0, min(w0, w1))
    steps = max(3, int(length / (width * 0.45)) + 1)
    bits = []
    for i in range(steps):
        t = i / (steps - 1)
        bits.append(circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, max(3.0, w0 + (w1 - w0) * t)))
    return union(bits, max(w0, w1) * 1.35)


def helmet(top, side, bottom, bang, face_rx=106):
    outer = ellipse(400, (top + bottom) / 2, side, (bottom - top) / 2)
    inner = ellipse(400, bang + 148, face_rx, 152)
    return subtract(outer, inner)


def temples():
    return union([
        capsule((318, 176), (302, 262), 8),
        capsule((482, 176), (498, 262), 8),
    ], 8)


def curtain(top_y, bot_y, top_half, bot_half):
    # two rounded falls and a soft nape, rather than one hard board
    return union([
        ribbon(400 - top_half * 0.45, top_y + 10, 400 - bot_half * 0.62, bot_y, top_half * 0.34, bot_half * 0.18),
        ribbon(400 + top_half * 0.45, top_y + 10, 400 + bot_half * 0.62, bot_y, top_half * 0.34, bot_half * 0.18),
        ellipse(400, top_y + 36, top_half * 0.85, 34),
    ], 18)


def braid(x, y0, y1):
    bits = []
    steps = max(8, int((y1 - y0) / 16))
    for i in range(steps):
        t = i / (steps - 1)
        cy = y0 + (y1 - y0) * t
        cx = x + math.sin(i * 0.9) * 3.5
        bits.append(ellipse(cx, cy, 12, 15))
    return union(bits, 14)


def hair_front_back(style):
    if style == "shag":
        front = union([
            helmet(72, 150, 360, 168),
            ellipse(346, 160, 28, 16),
            ellipse(456, 156, 30, 16),
            ellipse(400, 148, 24, 12),
        ], 14)
        back = union([curtain(200, 460, 72, 128), ellipse(400, 310, 86, 26)], 16)
    elif style == "curly":
        spots = [
            (400, 102, 32), (348, 118, 30), (452, 118, 30),
            (308, 156, 28), (492, 156, 28),
            (278, 204, 26), (522, 204, 26),
            (268, 252, 24), (532, 252, 24),
            (300, 292, 20), (500, 292, 20),
            (368, 96, 22), (432, 96, 22),
            (336, 186, 20), (464, 186, 20),
        ]
        front = union([circle(x, y, r) for x, y, r in spots], 12)
        back = union([circle(260, 318, 24), circle(540, 318, 24), circle(278, 368, 20), circle(522, 368, 20)], 12)
    elif style == "buzz":
        front = helmet(112, 122, 236, 186, 110)
        back = ellipse(400, 248, 76, 16)
    elif style == "mohawk":
        front = union([circle(400, cy, r) for cy, r in ((50, 11), (66, 14), (84, 16), (104, 18), (126, 18), (148, 16), (170, 14), (190, 12))], 20)
        back = ellipse(400, 186, 14, 22)
    elif style == "braids":
        front = helmet(80, 138, 300, 172)
        back = union([
            braid(284, 300, 730), braid(516, 300, 730),
            ribbon(304, 190, 286, 320, 12, 11),
            ribbon(496, 190, 514, 320, 12, 11),
        ], 8)
    elif style == "bob":
        front = helmet(68, 156, 405, 164)
        back = ellipse(400, 255, 164, 190)
    elif style == "bun":
        front = helmet(96, 132, 280, 186)
        back = union([circle(400, 66, 42), ellipse(400, 106, 28, 16)], 10)
    elif style == "swoop":
        front = union([
            helmet(78, 142, 320, 176),
            ellipse(444, 158, 120, 40, rot=-0.55),
        ], 14)
        back = ellipse(400, 270, 68, 16)
    elif style == "long":
        front = union([
            helmet(74, 146, 340, 166),
            capsule((308, 230), (286, 540), 9),
            capsule((492, 230), (514, 540), 9),
        ], 12)
        back = curtain(188, 788, 76, 190)
    elif style == "locs":
        front_locs = [ribbon(x, 156, x + (x - 400) * 0.05, 248, 7, 6) for x in (332, 366, 400, 434, 468)]
        front = union([helmet(88, 134, 250, 176)] + front_locs, 8)
        back_locs = [ribbon(x, 206, x + (x - 400) * 0.2, 760, 9, 7) for x in (284, 318, 482, 516)]
        back = union(back_locs, 6)
    elif style == "pixie":
        front = union([
            helmet(96, 132, 292, 166),
            ellipse(348, 154, 50, 20, rot=0.45),
        ], 12)
        back = ellipse(400, 264, 62, 16)
    elif style == "ponytail":
        front = helmet(90, 130, 268, 186)
        back = union([
            ribbon(458, 140, 660, 650, 18, 12),
            circle(472, 158, 14),
            ellipse(450, 176, 16, 10),
        ], 8)
    else:
        front = union([circle(400, cy, r) for cy, r in ((46, 12), (64, 15), (84, 17), (106, 18), (128, 17), (150, 15), (172, 13), (192, 11))], 20)
        back = union([ribbon(436, 168, 580, 770, 16, 11), ellipse(400, 170, 14, 34)], 8)
    tuck = union([below(front, 182), temples()], 8)
    return front, back, tuck


def beard_sdf(kind):
    hole = ellipse(MOUTH[0], MOUTH[1] + 2, 32, 22)
    if kind == "stubble":
        jaw = ellipse(400, 332, 96, 62)
        lip = ellipse(400, 312, 28, 10)
        field = subtract(union([jaw, lip], 8), ellipse(400, 250, 70, 40))
        return field, hole
    if kind == "moustache":
        return union([
            ellipse(374, 314, 22, 10, rot=0.3),
            ellipse(426, 314, 22, 10, rot=-0.3),
            capsule((378, 316), (422, 316), 6.5),
        ], 7), None
    jaw = union([
        ellipse(400, 356, 96, 50),
        capsule((318, 296), (344, 360), 11),
        capsule((482, 296), (456, 360), 11),
    ], 12)
    return subtract(jaw, hole), None


def hat_sdf(kind):
    if kind == "beanie":
        crown = ellipse(400, 128, 118, 78)
        crown = np.maximum(crown, Y - 176)
        band = roundbox(400, 166, 112, 16, 10)
        pom = circle(400, 58, 14)
        return union([crown, band, pom], 8)
    if kind == "cap":
        crown = above(ellipse(400, 108, 116, 56), 156)
        band = roundbox(400, 150, 114, 14, 8)
        brim = ellipse(424, 172, 116, 24)
        button = circle(400, 58, 6)
        return union([crown, band, brim, button], 12)
    band = roundbox(400, 162, 116, 18, 8)
    knot = polygon_sdf([(286, 156), (248, 188), (262, 214), (300, 176)])
    return union([band, knot], 6)


def disc(cx, cy, r, color, aa=1.05):
    return alpha_of(circle(cx, cy, r), aa), color


def eye_white(shape):
    rx, ry, _, _ = EYE_SHAPE[shape]
    a = np.zeros((H, W), np.float32)
    rgb = np.zeros((H, W, 3), np.float32)
    for cx, cy in (EYE_L, EYE_R):
        sdf = ellipse(cx, cy, rx, ry)
        cov = alpha_of(sdf, 1.05)
        # warm white, darker under the lid
        top = np.clip((cy - Y) / ry, 0, 1)
        col = np.array([246, 240, 234], np.float32) * (1 - 0.10 * top)[..., None]
        shadow = np.clip(1 - np.hypot((X - cx) / rx, (Y - (cy - ry * 0.55)) / (ry * 0.55)), 0, 1)
        col = col * (1 - 0.18 * shadow * (Y < cy))[..., None]
        a = np.maximum(a, cov)
        rgb = np.where(cov[..., None] > 0.05, col, rgb)
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = np.clip(rgb[..., 0], 0, 255)[m]
    out[..., 1][m] = np.clip(rgb[..., 1], 0, 255)[m]
    out[..., 2][m] = np.clip(rgb[..., 2], 0, 255)[m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def eye_iris(shape):
    _, _, ir, _ = EYE_SHAPE[shape]
    sdf = union([circle(EYE_L[0], EYE_L[1] + 1.5, ir), circle(EYE_R[0], EYE_R[1] + 1.5, ir)], 4)
    a = alpha_of(sdf, 1.05)
    sh = np.full((H, W), 128.0, np.float32)
    for cx, cy in (EYE_L, EYE_R):
        d = np.hypot(X - cx, Y - (cy + 1.5)) / ir
        rim = np.clip(d, 0, 1)
        light = np.clip(1 - np.hypot(X - (cx - ir * 0.28), Y - (cy + ir * 0.22)) / (ir * 0.55), 0, 1)
        local = 138 - rim * 36 + light * 22
        cover = alpha_of(circle(cx, cy + 1.5, ir), 1.05)
        sh = np.where(cover > 0.2, local, sh)
    return sdf, a, clip_shade(sh, 2)


def eye_pupil(shape):
    rx, ry, ir, pr = EYE_SHAPE[shape]
    a = np.zeros((H, W), np.float32)
    rgb = np.zeros((H, W, 3), np.float32)

    def paint(sdf, color):
        nonlocal a, rgb
        cov = alpha_of(sdf, 1.0)
        take = cov > a
        rgb = np.where(take[..., None], np.array(color, np.float32), rgb)
        a = np.maximum(a, cov)

    for cx, cy in (EYE_L, EYE_R):
        paint(circle(cx, cy + 2.2, pr), (22, 16, 14))
        paint(circle(cx - pr * 0.38, cy - pr * 0.15, pr * 0.42), (255, 252, 248))
        paint(circle(cx + pr * 0.35, cy + pr * 0.45, pr * 0.18), (255, 255, 255))
        ring = subtract(ellipse(cx, cy, rx, ry), ellipse(cx, cy, max(rx - 2.4, 1), max(ry - 2.2, 1)))
        upper = np.maximum(ring, Y - (cy - ry * 0.05))
        paint(upper, (58, 40, 32))
        lower = np.maximum(ring, (cy + ry * 0.45) - Y)
        paint(lower, (120, 86, 74))
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = rgb[..., 0][m]
    out[..., 1][m] = rgb[..., 1][m]
    out[..., 2][m] = rgb[..., 2][m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def eye_lid(shape):
    rx, ry, _, _ = EYE_SHAPE[shape]
    parts = []
    for cx, cy in (EYE_L, EYE_R):
        eye = ellipse(cx, cy, rx + 1.5, ry + 2)
        opening = ellipse(cx, cy + ry * 0.28, rx * 0.96, ry * 0.70)
        parts.append(subtract(eye, opening))
    return union(parts, 4)


def eye_lid_line(shape):
    rx, ry, _, _ = EYE_SHAPE[shape]
    a = np.zeros((H, W), np.float32)
    for cx, cy in (EYE_L, EYE_R):
        oy = cy + ry * 0.28
        ring = subtract(ellipse(cx, oy, rx * 0.96, ry * 0.70), ellipse(cx, oy, rx * 0.96 - 2.6, max(ry * 0.70 - 2.3, 1)))
        arc = np.maximum(ring, Y - oy)
        a = np.maximum(a, alpha_of(arc, 1.0))
    return rgba_color((48, 32, 26), a)


def closed_eyes(mood):
    a = np.zeros((H, W), np.float32)
    for cx, cy in (EYE_L, EYE_R):
        if mood == "cheer":
            outer = ellipse(cx, cy + 2, 22, 13)
            inner = ellipse(cx, cy + 9, 18, 10)
            cres = subtract(outer, inner)
            cres = np.maximum(cres, Y - (cy + 6))
        else:
            outer = ellipse(cx, cy + 1, 22, 9)
            inner = ellipse(cx, cy - 5, 18, 7)
            cres = subtract(outer, inner)
            cres = np.maximum(cres, (cy + 1) - Y)
        a = np.maximum(a, alpha_of(cres, 1.05))
    return rgba_color((58, 40, 32), a)


def mouth_rgba(mood):
    cx, cy = MOUTH
    a = np.zeros((H, W), np.float32)
    rgb = np.zeros((H, W, 3), np.float32)

    def paint(sdf, color, edge=1.05):
        nonlocal a, rgb
        cov = alpha_of(sdf, edge)
        take = cov >= a
        rgb = np.where(take[..., None], np.array(color, np.float32), rgb)
        a = np.maximum(a, cov)

    if mood == "happy":
        paint(subtract(ellipse(cx, cy + 6, 26, 16), ellipse(cx, cy - 1, 22, 12)), (176, 72, 82))
        paint(subtract(ellipse(cx, cy + 2, 20, 8), ellipse(cx, cy - 2, 16, 6)), (110, 42, 52))
    elif mood == "cheer":
        paint(ellipse(cx, cy + 2, 30, 20), (74, 24, 32))
        paint(roundbox(cx, cy - 6, 20, 7, 3), (248, 244, 238))
        paint(ellipse(cx, cy + 8, 14, 8), (214, 96, 110))
        lip = subtract(ellipse(cx, cy + 2, 30, 20), ellipse(cx, cy + 2, 25, 15))
        paint(lip, (168, 64, 76))
    elif mood == "proud":
        paint(subtract(ellipse(cx + 4, cy + 2, 24, 11), ellipse(cx + 2, cy - 2, 20, 8)), (150, 64, 74))
        paint(capsule((cx - 16, cy + 2), (cx + 20, cy - 2), 2.2), (96, 40, 48))
    elif mood == "sleepy":
        paint(ellipse(cx, cy + 2, 14, 3.6), (96, 48, 56))
    else:
        paint(subtract(ellipse(cx, cy - 2, 22, 12), ellipse(cx, cy + 6, 18, 9)), (158, 70, 80))
        paint(capsule((cx - 16, cy + 4), (cx + 16, cy + 4), 2.0), (110, 48, 58))
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = np.clip(rgb[..., 0], 0, 255)[m]
    out[..., 1][m] = np.clip(rgb[..., 1], 0, 255)[m]
    out[..., 2][m] = np.clip(rgb[..., 2], 0, 255)[m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def freckles_rgba():
    a = np.zeros((H, W), np.float32)
    spots = [
        (366, 286), (378, 296), (360, 304), (386, 308),
        (434, 286), (422, 296), (440, 304), (414, 308),
        (392, 300), (408, 302), (400, 292),
    ]
    for sx, sy in spots:
        a = np.maximum(a, alpha_of(ellipse(sx, sy, 3.3, 2.5), 1.6) * 0.62)
    return rgba_color((176, 96, 64), a)


def blush_rgba():
    a = alpha_of(ellipse(332, 292, 32, 16), 7) * 0.30
    a = np.maximum(a, alpha_of(ellipse(468, 292, 32, 16), 7) * 0.30)
    return rgba_color((226, 132, 124), a)


def glasses_rgba(kind):
    a = np.zeros((H, W), np.float32)
    rgb = np.zeros((H, W, 3), np.float32)

    def paint(sdf, color, edge=1.0):
        nonlocal a, rgb
        cov = alpha_of(sdf, edge)
        take = cov >= a
        rgb = np.where(take[..., None], np.array(color, np.float32), rgb)
        a = np.maximum(a, cov)

    if kind == "round":
        for cx, cy in (EYE_L, EYE_R):
            ring = subtract(circle(cx, cy, 42), circle(cx, cy, 37.2))
            paint(ring, (198, 158, 78))
            hi = subtract(circle(cx - 8, cy - 10, 42), circle(cx - 8, cy - 10, 39))
            hi = np.maximum(hi, Y - (cy - 4))
            paint(hi, (236, 214, 150))
        paint(capsule((EYE_L[0] + 40, EYE_L[1] - 2), (EYE_R[0] - 40, EYE_R[1] - 2), 2.6), (198, 158, 78))
        paint(capsule((EYE_L[0] - 40, EYE_L[1] - 4), (292, 250), 2.4), (176, 138, 68))
        paint(capsule((EYE_R[0] + 40, EYE_R[1] - 4), (508, 250), 2.4), (176, 138, 68))
    elif kind == "square":
        for cx, cy in (EYE_L, EYE_R):
            outer = roundbox(cx, cy, 40, 30, 8)
            inner = roundbox(cx, cy, 35, 25, 6)
            paint(subtract(outer, inner), (32, 26, 24))
        paint(capsule((EYE_L[0] + 38, EYE_L[1]), (EYE_R[0] - 38, EYE_R[1]), 2.8), (32, 26, 24))
        paint(capsule((EYE_L[0] - 38, EYE_L[1] - 6), (296, 252), 2.6), (32, 26, 24))
        paint(capsule((EYE_R[0] + 38, EYE_R[1] - 6), (504, 252), 2.6), (32, 26, 24))
    else:
        for cx, cy in (EYE_L, EYE_R):
            paint(ellipse(cx, cy + 2, 40, 24), (14, 16, 20))
            paint(ellipse(cx - 10, cy - 6, 14, 5), (78, 84, 96))
        paint(capsule((EYE_L[0] + 36, EYE_L[1]), (EYE_R[0] - 36, EYE_R[1]), 3.2), (14, 16, 20))
        paint(capsule((EYE_L[0] - 36, EYE_L[1] - 2), (304, 248), 2.6), (14, 16, 20))
        paint(capsule((EYE_R[0] + 36, EYE_R[1] - 2), (496, 248), 2.6), (14, 16, 20))
        a = np.minimum(a, np.float32(0.92))
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = np.clip(rgb[..., 0], 0, 255)[m]
    out[..., 1][m] = np.clip(rgb[..., 1], 0, 255)[m]
    out[..., 2][m] = np.clip(rgb[..., 2], 0, 255)[m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def stubble_alpha(field):
    rng = np.random.default_rng(11)
    dots = np.zeros((H, W), np.float32)
    ys = rng.integers(250, 390, 700)
    xs = rng.integers(300, 500, 700)
    for x, y in zip(xs, ys):
        if field[y, x] < 2:
            dots[y - 1:y + 2, x - 1:x + 2] = 0.45
    # soft dots, then cut the mouth so the lips stay clean
    a = alpha_of(field, 1.4) * 0.0
    cover = alpha_of(field, 1.2)
    blur = dots
    # a cheap spread so the dots are not single pixels
    spread = (
        dots
        + np.roll(dots, 1, 0) + np.roll(dots, -1, 0)
        + np.roll(dots, 1, 1) + np.roll(dots, -1, 1)
    ) / 5.0
    a = np.clip(spread, 0, 0.55) * (cover > 0.4)
    hole = alpha_of(ellipse(MOUTH[0], MOUTH[1], 36, 24), 1.2)
    a = a * (1 - hole)
    return a


def strap_rgba():
    sdf = capsule((524, 498), (318, 694), 7.2)
    a = alpha_of(sdf, 1.1)
    sh = volume_shade(sdf)
    col = np.array([122, 74, 46], np.float32) * (sh / 128.0)[..., None]
    # a lighter strip down the middle
    core = capsule((524, 498), (318, 694), 2.4)
    a_core = alpha_of(core, 1.0)
    col = col * (1 - 0.35 * a_core[..., None]) + np.array([168, 116, 74], np.float32) * a_core[..., None]
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = np.clip(col[..., 0], 0, 255)[m]
    out[..., 1][m] = np.clip(col[..., 1], 0, 255)[m]
    out[..., 2][m] = np.clip(col[..., 2], 0, 255)[m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def pick_rgba():
    wrist, elbow = POSES["play"]["left"][2], POSES["play"]["left"][1]
    ux, uy, px, py = hand_axes(wrist, elbow)
    cx = wrist[0] + ux * 12 - px * 20
    cy = wrist[1] + uy * 12 - py * 20
    # a small pointed pick in the strumming hand
    tip = (cx + ux * 16, cy + uy * 16)
    left = (cx - px * 7 - ux * 2, cy - py * 7 - uy * 2)
    right = (cx + px * 7 - ux * 2, cy + py * 7 - uy * 2)
    sdf = polygon_sdf([tip, left, right])
    a = alpha_of(sdf, 1.0)
    return rgba_color((242, 193, 70), a)


def flannel_detail(shirt_sides, sleeve):
    # pinstripes on the coloured flannel, the sides and the sleeves, not the cream panel
    mask = (shirt_sides < 0) | (sleeve < 0)
    line = ((np.mod(X + Y * 0.05, 30) < 2.4) | (np.mod(Y, 30) < 2.4)) & mask
    a = np.where(line, np.float32(0.22), np.float32(0))
    return rgba_color((244, 236, 224), a)


def vest_detail():
    a = np.zeros((H, W), np.float32)
    rgb = np.zeros((H, W, 3), np.float32)

    def paint(sdf, color):
        nonlocal a, rgb
        cov = alpha_of(sdf, 1.0)
        take = cov >= a
        rgb = np.where(take[..., None], np.array(color, np.float32), rgb)
        a = np.maximum(a, cov)

    paint(circle(400, 590, 8), (226, 176, 78))
    paint(circle(400, 590, 3.2), (120, 86, 36))
    paint(circle(400, 650, 8), (226, 176, 78))
    paint(circle(400, 650, 3.2), (120, 86, 36))
    paint(roundbox(456, 615, 16, 12, 3), (196, 54, 48))
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = rgb[..., 0][m]
    out[..., 1][m] = rgb[..., 1][m]
    out[..., 2][m] = rgb[..., 2][m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    return out


def leather_detail():
    a = np.zeros((H, W), np.float32)
    for x in (372, 428):
        teeth = (np.mod(Y, 9) < 3.2) & (np.abs(X - x) < 2.4) & (Y > 540) & (Y < 760)
        a = np.maximum(a, np.where(teeth, np.float32(0.9), np.float32(0)))
        a = np.maximum(a, alpha_of(circle(x, 530, 3.6), 1.0))
    return rgba_color((198, 202, 208), a)


def stage_detail(jacket):
    left = polygon_sdf([(390, 478), (408, 500), (348, 760), (324, 748)])
    right = polygon_sdf([(410, 478), (392, 500), (452, 760), (476, 748)])
    lapel = union([left, right], 4)
    lapel = np.maximum(lapel, jacket)  # keep them on the jacket
    a = alpha_of(lapel, 1.1)
    sh = volume_shade(lapel)
    col = np.array([226, 176, 84], np.float32) * (sh / 128.0)[..., None]
    out = np.zeros((H, W, 4), np.uint8)
    m = a > 0
    out[..., 0][m] = np.clip(col[..., 0], 0, 255)[m]
    out[..., 1][m] = np.clip(col[..., 1], 0, 255)[m]
    out[..., 2][m] = np.clip(col[..., 2], 0, 255)[m]
    out[..., 3] = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    # studs
    studs = np.zeros((H, W), np.float32)
    for y in range(520, 750, 28):
        studs = np.maximum(studs, alpha_of(circle(338, y, 2.6), 1.0))
        studs = np.maximum(studs, alpha_of(circle(462, y, 2.6), 1.0))
    sm = studs > 0.2
    out[..., 0][sm] = 245
    out[..., 1][sm] = 230
    out[..., 2][sm] = 190
    out[..., 3][sm] = (np.clip(studs, 0, 1) * 255).astype(np.uint8)[sm]
    return out


def paint():
    print("body")
    emit_volume("body/neck", body_sdf(), 20, "body", "neck", "neck", "skin", 1)
    for pose in POSES_N:
        pts = [POSES[pose]["left"], POSES[pose]["right"]]
        arms = union([arm_sdf(p) for p in pts], 8)
        emit_volume(f"body/arms-{pose}", arms, 90, "body", pose, "arms", "skin", 2)
        hands = union([hand_sdf(p[2], p[1], HAND[pose][i]) for i, p in enumerate(pts)], 8)
        emit_volume(f"body/hands-{pose}", hands, 100, "body", pose, "hands", "skin", 3)
    emit_fixed("body/strap.webp", strap_rgba(), 70, "body", "strap", "strap")
    emit_fixed("body/pick.webp", pick_rgba(), 110, "body", "pick", "pick")

    print("faces")
    emit_fixed("face/blush.webp", blush_rgba(), 130, "face", "blush", "blush")
    for shape in FACE:
        sdf, ears = face_sdf(shape)
        sh = volume_shade(sdf)
        # soft shadow under the hairline and under the chin
        band = np.clip((200 - Y) / 50.0, 0, 1) * (Y > 140) * (Y < 210)
        sh = sh * (1 - 0.16 * band)
        for ex, ey in ears:
            bowl = np.clip(1 - np.hypot((X - ex) / 7.0, (Y - ey) / 12.0), 0, 1)
            sh = sh * (1 - 0.30 * bowl)
        emit_volume(f"face/{shape}", sdf, 120, "face", shape, "shape", "skin", 4, shade=clip_shade(sh, 4))

    print("features")
    emit_fixed("freckles/freckles.webp", freckles_rgba(), 140, "freckles", "freckles", "spots")
    for kind in NOSE:
        emit_volume(f"nose/{kind}", nose_sdf(kind), 150, "nose", kind, "shape", "skin", 5, edge=1.35)
    for mood in MOODS:
        emit_fixed(f"mouth/{mood}.webp", mouth_rgba(mood), 155, "mouth", mood, "mood")
    for shape, (rx, ry, ir, pr) in EYE_SHAPE.items():
        emit_fixed(f"eyes/{shape}.webp", eye_white(shape), 170, "eyes", shape, "white")
        sdf, a, sh = eye_iris(shape)
        emit_volume(f"eyes/{shape}-iris", sdf, 180, "eyes", shape, "iris", "eye", 6, alpha=a, shade=sh)
        emit_fixed(f"eyes/{shape}-pupil.webp", eye_pupil(shape), 190, "eyes", shape, "pupil")
        emit_volume(f"eyes/{shape}-lid", eye_lid(shape), 200, "eyes", shape, "lid", "skin", 6)
        emit_fixed(f"eyes/{shape}-lid-line.webp", eye_lid_line(shape), 210, "eyes", shape, "lid-line")
    emit_fixed("eyes/cheer.webp", closed_eyes("cheer"), 170, "eyes", "cheer", "cheer")
    emit_fixed("eyes/sleepy.webp", closed_eyes("sleepy"), 170, "eyes", "sleepy", "sleepy")
    for style in BROWS:
        for mood in ("neutral", "worried", "raised"):
            name = style if mood == "neutral" else f"{style}-{mood}"
            sdf = brow_sdf(style, mood)
            sh = clip_shade(volume_shade(sdf, 8) * 0.86, 3)
            emit_volume(f"brows/{name}", sdf, 220, "brows", name, mood, "hair", 3, shade=sh, edge=1.05)

    print("hair")
    for i, style in enumerate(HAIR):
        front, back, tuck = hair_front_back(style)
        for role, sdf in (("back", back), ("front", front), ("tuck", tuck)):
            sh = clip_shade(volume_shade(sdf, 12), i + 1)
            streak = np.clip(1 - np.abs((X - 380) + (Y - 140) * 0.15) / 14.0, 0, 1)
            streak = streak * (Y < 210) * (sdf < 0)
            sh = np.clip(sh + streak * 12, 68, 156)
            emit_volume(f"hair/{style}-{role}", sdf, 10 if role == "back" else 240, "hair", style, role, "hair", i, shade=sh)

    print("beards, hats, glasses")
    for kind in BEARDS:
        sdf, _hole = beard_sdf(kind)
        if kind == "stubble":
            a = stubble_alpha(sdf)
            sh = np.full((H, W), 120.0, np.float32)
            emit_volume(f"beard/{kind}", sdf, 230, "beard", kind, "style", "beard", 2, alpha=a, shade=sh)
        else:
            emit_volume(f"beard/{kind}", sdf, 230, "beard", kind, "style", "beard", 2)
    for kind in HATS:
        emit_volume(f"hat/{kind}", hat_sdf(kind), 250, "hat", kind, "hat", "hat", 4)
    for kind in SPECS:
        emit_fixed(f"glasses/{kind}.webp", glasses_rgba(kind), 260, "glasses", kind, "specs")

    print("tops")
    torso = torso_sdf()
    hole = neck_hole()
    panel = roundbox(400, 640, 36, 175, 6)
    v_open = polygon_sdf([(400, 512), (358, 792), (442, 792)])
    shirt = subtract(torso, hole)
    for look in LOOKS:
        sh = volume_shade(shirt)
        side = np.clip((np.abs(X - 400) - 60) / 90.0, 0, 1)
        sh = sh * (1 - 0.10 * side)
        collar = np.clip(1 - np.abs(hole) / 7.0, 0, 1) * (shirt < 0)
        sh = sh * (1 - 0.18 * collar)
        if look == "flannel":
            sides = subtract(shirt, panel)
            emit_volume("tops/flannel", sides, 30, "tops", "flannel", "shirt", "top", 1, shade=clip_shade(flannel_shade(sh, sides), 1))
            emit_volume("tops/flannel-panel", np.maximum(panel, shirt), 35, "tops", "flannel", "panel", "#E7E1D6", 1)
        elif look in ("leather", "stage"):
            jacket = subtract(shirt, v_open)
            inner = np.maximum(v_open, shirt)
            fixed = "#26221F" if look == "leather" else "#1E1A18"
            emit_volume(f"tops/{look}", inner, 30, "tops", look, "shirt", "top", 1, shade=clip_shade(sh, 1))
            emit_volume(f"tops/{look}-jacket", jacket, 40, "tops", look, "jacket", fixed, 2)
            if look == "leather":
                emit_fixed("tops/leather-detail.webp", leather_detail(), 50, "tops", "leather", "detail")
            else:
                emit_fixed("tops/stage-detail.webp", stage_detail(jacket), 50, "tops", "stage", "detail")
        elif look == "vest":
            emit_volume("tops/vest", shirt, 30, "tops", "vest", "shirt", "top", 1, shade=clip_shade(sh, 1))
            panels = union([roundbox(292, 650, 48, 145, 18), roundbox(508, 650, 48, 145, 18)], 4)
            panels = np.maximum(panels, shirt)
            emit_volume("tops/vest-panel", panels, 40, "tops", "vest", "panel", "#46689E", 2)
            emit_fixed("tops/vest-detail.webp", vest_detail(), 50, "tops", "vest", "detail")
        else:
            emit_volume("tops/tee", shirt, 30, "tops", "tee", "shirt", "top", 1, shade=clip_shade(sh, 1))
        for pose in POSES_N:
            pts = [POSES[pose]["left"], POSES[pose]["right"]]
            sleeve = union([sleeve_sdf(p, look in LONG) for p in pts], 8)
            tint = {"leather": "#26221F", "stage": "#1E1A18"}.get(look, "top")
            ssh = volume_shade(sleeve)
            if look == "flannel":
                ssh = flannel_shade(ssh, sleeve)
            emit_volume(f"tops/{look}-{pose}", sleeve, 94, "tops", look, "sleeves", tint, 3, shade=clip_shade(ssh, 3))
            if look == "flannel":
                emit_fixed(f"tops/flannel-{pose}-detail.webp", flannel_detail(sides, sleeve), 96, "tops", "flannel", "detail")


def flannel_shade(shade, sdf):
    lines = (np.mod(X + Y * 0.05, 30) < 5.0) | (np.mod(Y, 30) < 5.0)
    return np.where(lines & (sdf < 0), shade * 0.88, shade)


def write_manifest():
    files = sorted(FILES, key=lambda f: (f["order"], f["file"]))
    # shade entries were given role shade and no tint; drop a duplicated "shade": null
    clean = []
    for f in files:
        item = {k: v for k, v in f.items() if v is not None}
        clean.append(item)
    data = {
        "canvas": [800, 800],
        "masterGrey": [GREY, GREY, GREY],
        "shadeNeutral": 128,
        "composite": "Fill the master alpha with the part colour, then multiply the colour by shade divided by 128. 128 leaves the colour as it is. Darker is shadow, lighter is a highlight. Draw shade with the same alpha as the master.",
        "lefty": "Flip the whole stack left to right about x = 400. A lefty uses the same files.",
        "guitar": "The app places the painted Road guitar after the strap and before the arms. The neck runs to the viewer's right. These layers leave that space empty.",
        "crop": "The figure is waist up. The top of the head sits near y = 100. Hair and hats may rise above that. The app cuts the head-and-shoulders crop itself.",
        "hats": "A beanie or a cap uses the tucked front hair. A bandana uses the full front. The back hair stays either way.",
        "eyes": "Happy and worried use the open eye of the chosen shape (white, then iris, then pupil). Proud draws the lid and the lid line over that eye. Cheer and sleepy replace the open eye.",
        "brows": "Neutral is the resting brow. Worried lifts the inner ends. Raised lifts both brows (cheer and proud). The thin brow is stored as straight.",
        "ids": "File ids match the values the app stores. The long nose is bridge. The long mohawk is longhawk.",
        "anchors": {
            "center": 400,
            "headTop": 100,
            "eyes": [list(EYE_L), list(EYE_R)],
            "brows": 186,
            "mouth": list(MOUTH)
        },
        "stack": [
            {"order": 10, "what": "Hair, back layer"},
            {"order": 20, "what": "Neck and shoulders"},
            {"order": 30, "what": "Top, the part that takes the top colour"},
            {"order": 35, "what": "Flannel centre panel, when the top is flannel"},
            {"order": 40, "what": "Jacket or vest sides, when that look has them"},
            {"order": 50, "what": "Fixed details: buttons, zipper, gold lapels"},
            {"order": 70, "what": "Strap, play pose"},
            {"order": 80, "what": "Painted Road guitar, placed by the app, play pose"},
            {"order": 90, "what": "Arms for the pose"},
            {"order": 94, "what": "Sleeves for the pose, over the arms"},
            {"order": 96, "what": "Flannel pinstripe, when the top is flannel"},
            {"order": 100, "what": "Hands for the pose"},
            {"order": 110, "what": "Pick, play pose"},
            {"order": 120, "what": "Face shape, with ears"},
            {"order": 130, "what": "Blush"},
            {"order": 140, "what": "Freckles, when worn"},
            {"order": 150, "what": "Nose"},
            {"order": 155, "what": "Mouth for the mood"},
            {"order": 170, "what": "Eye white, or the cheer or sleepy eye"},
            {"order": 180, "what": "Iris"},
            {"order": 190, "what": "Pupil, catchlights and lash"},
            {"order": 200, "what": "Proud lid"},
            {"order": 210, "what": "Proud lid line"},
            {"order": 220, "what": "Brows"},
            {"order": 230, "what": "Beard, when worn. The mouth shows through the opening."},
            {"order": 240, "what": "Hair front, or the tucked front under a beanie or a cap"},
            {"order": 250, "what": "Hat, when worn"},
            {"order": 260, "what": "Glasses, when worn"}
        ],
        "files": clean
    }
    path = OUT / "manifest.json"
    path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"{len(clean)} files in the manifest")


def hex_rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


TINTS = {
    "skin": (221, 165, 122),
    "hair": (90, 54, 34),
    "beard": (70, 44, 30),
    "eye": (43, 108, 176),
    "top": (232, 51, 110),
    "hat": (32, 40, 48),
}


def load_rgba(path):
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.float32)


def tinted(rel, color):
    master = load_rgba(OUT / rel)
    shade_name = rel.replace(".webp", "-shade.webp")
    shade = load_rgba(OUT / shade_name)
    a = master[..., 3:4]
    factor = shade[..., 0:1] / 128.0
    rgb = np.array(color, np.float32).reshape(1, 1, 3) * factor
    return np.concatenate([np.clip(rgb, 0, 255), a], axis=-1)


def over(base, src):
    sa = src[..., 3:4] / 255.0
    ba = base[..., 3:4] / 255.0
    out_a = sa + ba * (1.0 - sa)
    prem = src[..., :3] * sa + base[..., :3] * ba * (1.0 - sa)
    rgb = prem / np.maximum(out_a, 1e-5)
    out = np.concatenate([np.clip(rgb, 0, 255), out_a * 255.0], axis=-1)
    return out


def layer_tinted(base, rel, tint):
    if isinstance(tint, str) and tint.startswith("#"):
        color = hex_rgb(tint)
    elif isinstance(tint, str):
        color = TINTS[tint]
    else:
        color = tint
    return over(base, tinted(rel if rel.endswith(".webp") else rel + ".webp", color))


def layer_fixed(base, rel):
    return over(base, load_rgba(OUT / rel))


def guitar_layer():
    """Neck to the viewer's right, body under the strumming hand, neck under the fretting hand."""
    src = Image.open(ROOT / "art/guitars/porch-small.webp").convert("RGBA")
    scale = 500 / src.height
    src = src.resize((max(1, int(src.width * scale)), 500), Image.Resampling.LANCZOS)
    arr = np.asarray(src)
    ys, xs = np.where(arr[..., 3] > 40)
    y0, y1 = ys.min(), ys.max()
    span = max(1, y1 - y0)
    head = ys < y0 + span * 0.08
    body = ys > y0 + span * 0.70
    vx, vy = float(xs[head].mean() - xs[body].mean()), float(ys[head].mean() - ys[body].mean())
    tx, ty = 300.0, -250.0

    def rot(dx, dy, deg):
        th = math.radians(deg)
        c, s = math.cos(th), math.sin(th)
        return dx * c + dy * s, -dx * s + dy * c

    def score(deg):
        rx, ry = rot(vx, vy, deg)
        return -(rx * tx + ry * ty) / (math.hypot(rx, ry) * math.hypot(tx, ty) + 1e-6)

    deg = min(range(-180, 181, 2), key=score)
    turned = src.rotate(deg, expand=True, resample=Image.Resampling.BICUBIC)
    alpha = np.asarray(turned)[..., 3]
    ys, xs = np.where(alpha > 40)
    direction = np.array([tx, ty], np.float32)
    direction /= np.linalg.norm(direction)
    proj = np.stack([xs, ys], 1).astype(np.float32) @ direction
    body_pts = np.stack([xs, ys], 1)[proj < np.percentile(proj, 28)]
    bxy = body_pts.mean(0)
    ox, oy = int(round(392 - bxy[0])), int(round(688 - bxy[1]))
    src_a = np.asarray(turned).astype(np.float32)
    canvas = np.zeros((H, W, 4), np.float32)
    sh, sw = src_a.shape[:2]
    x0, y0 = max(ox, 0), max(oy, 0)
    x1, y1 = min(ox + sw, W), min(oy + sh, H)
    part = src_a[y0 - oy:y0 - oy + (y1 - y0), x0 - ox:x0 - ox + (x1 - x0)]
    canvas[y0:y1, x0:x1] = part
    print(f"guitar rotate {deg} deg, paste {ox},{oy}")
    return canvas


def render_stack(spec, guitar=None):
    base = np.zeros((H, W, 4), np.float32)
    hair = spec["hair"]
    look = spec["look"]
    pose = spec["pose"]
    mood = spec["mood"]
    base = layer_tinted(base, f"hair/{hair}-back.webp", spec["hairCol"])
    base = layer_tinted(base, "body/neck.webp", spec["skin"])
    base = layer_tinted(base, f"tops/{look}.webp", spec["top"])
    if look == "flannel":
        base = layer_tinted(base, "tops/flannel-panel.webp", "#E7E1D6")
    if look in ("leather", "stage"):
        fixed = "#26221F" if look == "leather" else "#1E1A18"
        base = layer_tinted(base, f"tops/{look}-jacket.webp", fixed)
    if look == "vest":
        base = layer_tinted(base, "tops/vest-panel.webp", "#46689E")
    detail = {
        "leather": "tops/leather-detail.webp",
        "stage": "tops/stage-detail.webp",
        "vest": "tops/vest-detail.webp",
    }.get(look)
    if detail:
        base = layer_fixed(base, detail)
    if pose == "play":
        base = layer_fixed(base, "body/strap.webp")
        if guitar is not None:
            base = over(base, guitar)
    base = layer_tinted(base, f"body/arms-{pose}.webp", spec["skin"])
    sleeve_tint = {"leather": "#26221F", "stage": "#1E1A18"}.get(look, spec["top"])
    base = layer_tinted(base, f"tops/{look}-{pose}.webp", sleeve_tint)
    if look == "flannel":
        base = layer_fixed(base, f"tops/flannel-{pose}-detail.webp")
    base = layer_tinted(base, f"body/hands-{pose}.webp", spec["skin"])
    if pose == "play":
        base = layer_fixed(base, "body/pick.webp")
    base = layer_tinted(base, f"face/{spec['face']}.webp", spec["skin"])
    base = layer_fixed(base, "face/blush.webp")
    if spec.get("freckles"):
        base = layer_fixed(base, "freckles/freckles.webp")
    base = layer_tinted(base, f"nose/{spec['nose']}.webp", spec["skin"])
    base = layer_fixed(base, f"mouth/{mood}.webp")
    eye = spec["eyes"]
    if mood == "cheer":
        base = layer_fixed(base, "eyes/cheer.webp")
    elif mood == "sleepy":
        base = layer_fixed(base, "eyes/sleepy.webp")
    else:
        base = layer_fixed(base, f"eyes/{eye}.webp")
        base = layer_tinted(base, f"eyes/{eye}-iris.webp", spec["eyeCol"])
        base = layer_fixed(base, f"eyes/{eye}-pupil.webp")
        if mood == "proud":
            base = layer_tinted(base, f"eyes/{eye}-lid.webp", spec["skin"])
            base = layer_fixed(base, f"eyes/{eye}-lid-line.webp")
    brow = spec["brows"]
    brow_mood = {"worried": "worried", "cheer": "raised", "proud": "raised"}.get(mood, "neutral")
    brow_file = f"brows/{brow}.webp" if brow_mood == "neutral" else f"brows/{brow}-{brow_mood}.webp"
    base = layer_tinted(base, brow_file, spec["hairCol"])
    if spec.get("beard"):
        base = layer_tinted(base, f"beard/{spec['beard']}.webp", spec.get("beardCol", spec["hairCol"]))
    role = "tuck" if spec.get("hat") in ("beanie", "cap") else "front"
    base = layer_tinted(base, f"hair/{hair}-{role}.webp", spec["hairCol"])
    if spec.get("hat"):
        base = layer_tinted(base, f"hat/{spec['hat']}.webp", spec.get("hatCol", spec["top"]))
    if spec.get("glasses"):
        base = layer_fixed(base, f"glasses/{spec['glasses']}.webp")
    return base


def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def stage_behind(light, box):
    """A stage card the size of the figure canvas."""
    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(card)
    if light:
        back, spot, floor = (244, 232, 214, 255), (232, 186, 120, 70), (210, 170, 120, 80)
    else:
        back, spot, floor = (24, 16, 12, 255), (255, 150, 60, 55), (255, 140, 50, 40)
    dr.rounded_rectangle(box, 36, fill=back)
    dr.ellipse([160, 80, 640, 620], fill=spot)
    dr.ellipse([180, 700, 620, 790], fill=floor)
    return np.asarray(card).astype(np.float32)


def fit(im, width):
    w, h = im.size
    height = int(h * width / w)
    return im.resize((width, height), Image.Resampling.LANCZOS)


def proofs():
    guitar = guitar_layer()
    stacks = [
        {
            "title": "Dark, play",
            "light": False,
            "guitar": True,
            "spec": dict(skin=(221, 165, 122), hair="shag", hairCol=(90, 54, 34), face="oval", eyes="round",
                         eyeCol=(74, 46, 27), brows="natural", nose="wedge", mood="happy", look="tee",
                         top=(232, 51, 110), pose="play"),
            "cap": "Oval, shag, round eyes, red tee",
        },
        {
            "title": "Dark, horns",
            "light": False,
            "guitar": False,
            "spec": dict(skin=(147, 96, 62), hair="mohawk", hairCol=(58, 134, 255), face="square", eyes="wide",
                         eyeCol=(43, 108, 176), brows="thick", nose="broad", mood="cheer", look="leather",
                         top=(255, 122, 26), pose="hornsUp", beard="beard", beardCol=(31, 26, 28), glasses="shades"),
            "cap": "Square, mohawk, beard, shades, leather",
        },
        {
            "title": "Light, rest",
            "light": True,
            "guitar": False,
            "spec": dict(skin=(243, 198, 160), hair="long", hairCol=(232, 192, 106), face="heart", eyes="narrow",
                         eyeCol=(39, 122, 88), brows="arched", nose="button", mood="proud", look="flannel",
                         top=(32, 184, 164), pose="rest", freckles=True, glasses="round", hat="cap", hatCol=(38, 40, 46)),
            "cap": "Heart, long hair under a cap, flannel, freckles",
        },
    ]
    frames = []
    fulls = []
    for item in stacks:
        fig = render_stack(item["spec"], guitar if item["guitar"] else None)
        card = stage_behind(item["light"], (70, 40, 730, 790))
        # card under the figure, then flatten onto the card colour so the phone frame is opaque
        stacked = over(card, fig)
        bg = np.array([[[244, 232, 214, 255]]] if item["light"] else [[[24, 16, 12, 255]]], np.float32)
        bg = np.broadcast_to(bg, stacked.shape).copy()
        flat = over(bg, stacked)
        im = Image.fromarray(flat.astype(np.uint8), "RGBA").convert("RGB")
        fulls.append(im)
        phone = fit(im, 340)
        frames.append((item["title"], item["cap"], phone))

    # full size lineup for checking alignment, not the phone artifact
    lineup = Image.new("RGB", (W * 3 + 40, H + 20), (40, 36, 34))
    for i, im in enumerate(fulls):
        lineup.paste(im, (10 + i * (W + 10), 10))
    lineup.save("/tmp/guitarist-full.png", quality=90)
    print("wrote /tmp/guitarist-full.png")

    dark = fit(Image.open(ROOT / "docs/guitarist-painted/target-dark.jpg").convert("RGB"), 520)
    light = fit(Image.open(ROOT / "docs/guitarist-painted/target-light.jpg").convert("RGB"), 520)
    fnt = font(22)
    small = font(16)
    gap = 18
    left_w = 520
    right_w = sum(p.width for _, _, p in frames) + gap * 4
    width = left_w + right_w + gap * 3
    height = max(dark.height + light.height + 90, frames[0][2].height + 120)
    board = Image.new("RGB", (width, height), (28, 26, 24))
    dr = ImageDraw.Draw(board)
    dr.text((gap, 12), "Target, dark", fill=(236, 228, 216), font=small)
    board.paste(dark, (gap, 36))
    y2 = 36 + dark.height + 16
    dr.text((gap, y2), "Target, light", fill=(236, 228, 216), font=small)
    board.paste(light, (gap, y2 + 24))
    x = left_w + gap * 2
    dr.text((x, 12), "Painted stacks at phone size", fill=(236, 228, 216), font=fnt)
    for title, cap, phone in frames:
        dr.text((x, 44), title, fill=(236, 228, 216), font=small)
        board.paste(phone, (x, 70))
        dr.text((x, 76 + phone.height), cap, fill=(210, 200, 188), font=small)
        x += phone.width + gap
    art = Path("/opt/cursor/artifacts")
    art.mkdir(parents=True, exist_ok=True)
    board.save(art / "guitarist-painted-stacks.jpg", quality=90)
    print("wrote stacks artifact")

    # contact sheet of every painted part (master plus shade, or the fixed painting)
    masters = [f for f in FILES if f["role"] != "shade"]
    cols = 8
    thumb = 132
    label_h = 28
    cell = thumb + label_h + 8
    rows = math.ceil(len(masters) / cols)
    sheet = Image.new("RGB", (cols * cell + 16, rows * cell + 16), (32, 30, 28))
    sdr = ImageDraw.Draw(sheet)
    tiny = font(11)
    for i, entry in enumerate(masters):
        col, row = i % cols, i // cols
        tint = entry.get("tint")
        rel = entry["file"]
        if tint and not rel.endswith(".webp"):
            rel = rel + ".webp"
        if tint:
            color = hex_rgb(tint) if tint.startswith("#") else TINTS.get(tint, (180, 180, 180))
            img = Image.fromarray(tinted(rel, color).astype(np.uint8), "RGBA")
        else:
            img = Image.open(OUT / rel).convert("RGBA")
        img.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (thumb, thumb), (0, 0, 0, 0))
        # checker
        chk = Image.new("RGB", (thumb, thumb), (186, 186, 186))
        cd = ImageDraw.Draw(chk)
        for yy in range(0, thumb, 8):
            for xx in range(0, thumb, 8):
                if (xx // 8 + yy // 8) % 2 == 0:
                    cd.rectangle([xx, yy, xx + 8, yy + 8], fill=(230, 230, 230))
        chk.paste(img, ((thumb - img.width) // 2, (thumb - img.height) // 2), img)
        ox = 8 + col * cell
        oy = 8 + row * cell
        sheet.paste(chk, (ox, oy))
        sdr.text((ox, oy + thumb + 2), Path(rel).stem[:22], fill=(230, 224, 214), font=tiny)
    sheet.save(art / "guitarist-painted-parts.jpg", quality=88)
    print(f"contact sheet, {len(masters)} parts")


if __name__ == "__main__":
    paint()
    write_manifest()
    proofs()
