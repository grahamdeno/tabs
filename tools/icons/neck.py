"""The app icon since 4.114.0 (Graham, 2026-11-23: no mascot on the icon; option D, made premium): the Road's idea, a
rosewood guitar neck drawn in code at 2048 px with nickel frets, pearl inlays and wound strings, three amber finger dots
lit like amp pilot lamps (a C shape), rising to a black headstock on a warm stage glow. Used by make.py."""
import math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

S = 2048  # work size, scaled down at the end
random.seed(7)

def radial(size, cx, cy, r, inner, outer, power=1.6):
    y, x = np.mgrid[0:size[1], 0:size[0]]
    d = np.clip(np.hypot(x - cx, y - cy) / r, 0, 1) ** power
    a = np.array(inner, float); b = np.array(outer, float)
    img = a[None, None, :] * (1 - d[..., None]) + b[None, None, :] * d[..., None]
    return Image.fromarray(img.astype(np.uint8), "RGBA" if len(inner) == 4 else "RGB")

def background():
    g = radial((S, S), S * .5, S * .46, S * .78, (74, 44, 22), (10, 8, 7), 1.3).convert("RGBA")
    # faint leather grain
    t = Image.open(str(Path(__file__).resolve().parents[2] / "art/surfaces/tolex-dark.webp")).convert("RGBA")
    tl = Image.new("RGBA", (S, S))
    for x in range(0, S, t.width):
        for y in range(0, S, t.height): tl.paste(t, (x, y))
    tl.putalpha(40); g.alpha_composite(tl)
    # vignette
    v = radial((S, S), S / 2, S / 2, S * .72, (0, 0, 0, 0), (0, 0, 0, 200), 2.4); g.alpha_composite(v)
    return g

def neck():
    W, H = 3600, 600          # neck drawn horizontally, nut at the right
    n = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(n)
    # rosewood board with a top-to-bottom shade
    board = radial((W, H), W * .55, H * .35, W * .9, (92, 50, 30), (40, 20, 12), 1.2).convert("RGBA")
    gd = ImageDraw.Draw(board)
    for _ in range(260):  # grain
        y = random.uniform(0, H); x = random.uniform(-200, W); ln = random.uniform(300, 1400)
        c = random.choice([(30, 14, 8, 70), (120, 70, 42, 45), (22, 10, 6, 80)])
        gd.line((x, y, x + ln, y + random.uniform(-6, 6)), fill=c, width=random.choice([2, 3, 4]))
    board = board.filter(ImageFilter.GaussianBlur(1.2))
    # a lacquer sheen along the board, brighter toward the top edge, darker at the bottom edge
    sheen = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sheen)
    for yy in range(H):
        f = yy / H
        a = int(max(0, 60 * (1 - abs(f - .3) / .2))) if abs(f - .3) < .2 else 0
        dk = int(110 * max(0, f - .7) / .3)
        if a: sd.line((0, yy, W, yy), fill=(255, 214, 170, a))
        if dk: sd.line((0, yy, W, yy), fill=(0, 0, 0, dk))
    board.alpha_composite(sheen)
    m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).rectangle((0, 26, W, H - 26), fill=255)
    n.paste(board, (0, 0), m)
    # cream binding top and bottom
    for y0 in (14, H - 38):
        d.rectangle((0, y0, W, y0 + 24), fill=(236, 222, 190, 255)); d.rectangle((0, y0 + 18, W, y0 + 24), fill=(196, 178, 140, 255))
    # frets: spacing shrinks away from the nut (right)
    L = 7600; nut = W - 330; frets = [nut - L * (1 - 2 ** (-k / 12)) for k in range(0, 15)]
    for k, x in enumerate(frets):
        if k == 0:
            d.rectangle((x, 20, x + 46, H - 20), fill=(238, 228, 204, 255)); d.rectangle((x, 20, x + 10, H - 20), fill=(255, 250, 236, 255)); continue
        d.rectangle((x - 9, 30, x + 9, H - 30), fill=(150, 152, 156, 255))
        d.rectangle((x - 9, 30, x - 3, H - 30), fill=(235, 238, 242, 255))
        d.rectangle((x + 5, 30, x + 9, H - 30), fill=(90, 92, 96, 255))
    # the headstock past the nut: glossy black face, chrome tuner posts
    hx = nut + 46
    hs = radial((W - hx, H), (W - hx) * .3, H * .2, W * .2, (58, 54, 52, 255), (12, 11, 10, 255), 1.0)
    n.paste(hs, (int(hx), 0))
    for i, y in enumerate([H * (0.13 + i * 0.148) for i in range(6)]):
        px = hx + 70 + (i % 2) * 120
        d.ellipse((px - 26, y - 26, px + 26, y + 26), fill=(206, 210, 216, 255)); d.ellipse((px - 12, y - 12, px + 12, y + 12), fill=(120, 124, 130, 255))
    # pearl inlays at 3, 5, 7, 9 and the double at 12
    def pearl(cx, cy, r=34):
        p = radial((2 * r, 2 * r), r * .8, r * .7, r * 1.1, (255, 252, 244, 255), (196, 206, 214, 255), 1.0)
        mk = Image.new("L", (2 * r, 2 * r), 0); ImageDraw.Draw(mk).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
        n.paste(p, (int(cx - r), int(cy - r)), mk)
    for k in (3, 5, 7, 9):
        pearl((frets[k] + frets[k - 1]) / 2, H / 2)
    pearl((frets[12] + frets[11]) / 2, H * .3); pearl((frets[12] + frets[11]) / 2, H * .7)
    # strings: wound bronze low, steel high, each with a highlight and a shadow
    ys = [H * (0.13 + i * 0.148) for i in range(6)]
    for i, y in enumerate(ys):
        w = [16, 13, 11, 9, 7, 6][i]
        col = (200, 160, 110) if i < 3 else (214, 218, 224)
        d.line((0, y + w * .9, nut, y + w * .9), fill=(0, 0, 0, 90), width=w)  # shadow
        end = hx + 70 + (i % 2) * 120
        d.line((0, y, end, y), fill=col + (255,), width=w)
        d.line((0, y - w * .25, end, y - w * .25), fill=(255, 255, 255, 170), width=max(2, w // 4))
    return n, frets, ys

def lamp(img, cx, cy, r):
    """an amber finger dot lit like a pilot lamp"""
    halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).ellipse((cx - r * 2.6, cy - r * 2.6, cx + r * 2.6, cy + r * 2.6), fill=(255, 150, 40, 120))
    img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(r * 1.1)))
    ImageDraw.Draw(img).ellipse((cx - r - 9, cy - r - 9, cx + r + 9, cy + r + 9), fill=(255, 236, 196, 255))
    core = radial((2 * r, 2 * r), r * .75, r * .62, r * 1.15, (255, 248, 214, 255), (234, 128, 22, 255), 0.9)
    mk = Image.new("L", (2 * r, 2 * r), 0); ImageDraw.Draw(mk).ellipse((0, 0, 2 * r - 1, 2 * r - 1), fill=255)
    img.paste(core, (int(cx - r), int(cy - r)), mk)
    ImageDraw.Draw(img).ellipse((cx - r * .45, cy - r * .62, cx - r * .05, cy - r * .3), fill=(255, 255, 255, 150))

def build(angle=30, scale=1.45, shift=(-60, -10)):
    g = background()
    n, frets, ys = neck()
    # finger dots: a C shape (A string fret 3, D string fret 2, B string fret 1); ys[0] is the low E at the top
    dots = [((frets[3] + frets[2]) / 2, ys[1]), ((frets[2] + frets[1]) / 2, ys[2]), ((frets[1] + frets[0]) / 2, ys[4])]
    big = Image.new("RGBA", (n.width + 400, n.height + 400), (0, 0, 0, 0))
    sh = Image.new("RGBA", big.size, (0, 0, 0, 0)); sh.paste((0, 0, 0, 200), (200, 240, 200 + n.width, 240 + n.height), n.getchannel("A"))
    big.alpha_composite(sh.filter(ImageFilter.GaussianBlur(40)))
    big.alpha_composite(n, (200, 200))
    for x, y in dots: lamp(big, x + 200, y + 200, 44)
    big = big.resize((int(big.width * scale), int(big.height * scale)), Image.Resampling.LANCZOS)
    rot = big.rotate(angle, expand=True, resample=Image.BICUBIC)
    # centre the middle dot
    mx, my = dots[1][0] + 200, dots[1][1] + 200
    cx0, cy0 = big.width / 2, big.height / 2
    a = math.radians(-angle)
    rx = (mx * scale - cx0) * math.cos(a) - (my * scale - cy0) * math.sin(a) + rot.width / 2
    ry = (mx * scale - cx0) * math.sin(a) + (my * scale - cy0) * math.cos(a) + rot.height / 2
    g.alpha_composite(rot, (int(S * .5 - rx + shift[0]), int(S * .52 - ry + shift[1])))
    # a soft top light
    top = radial((S, S), S * .42, S * .1, S * .8, (255, 220, 170, 40), (0, 0, 0, 0), 1.5); g.alpha_composite(top)
    return g

def icon(size):
    return build().convert("RGB").resize((size, size), Image.Resampling.LANCZOS)


def tab_icon(size):
    """closer in, so the three lamps carry the 32 px browser tab"""
    return build(angle=30, scale=2.0, shift=(-80, 0)).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
