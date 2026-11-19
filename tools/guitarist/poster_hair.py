# Hair, beards, glasses and hats for the Gig poster guitarist (see poster_art.py, which imports this to build).
from poster_art import *
import poster_art as PA

SKULL = FACE
def above(pts, top=-60):
    pts = list(pts)
    return poly(pts + [(pts[-1][0], top), (pts[0][0], top)])

def below(pts, bot=300):
    pts = list(pts)
    return poly(pts + [(pts[-1][0], bot), (pts[0][0], bot)])

HL = [(66, 66), (70.6, 60), (73, 50), (77, 42), (86, 37.4), (100, 36.4), (114, 37.4), (123, 42), (127, 50), (129.4, 60), (134, 66)]
HL_HIGH = [(x, y - 1.2) for x, y in HL]
WIN = blob([(78, 47), (88, 45), (100, 44.5), (112, 45), (122, 47), (124, 62), (118, 82), (100, 92), (82, 82), (76, 62)])   # eyes, nose, mouth: front hair stays off it (except a swoop)

def strands(*ps, w=.55):
    return U(*[brush(p, w, (.15, .15)) for p in ps])

def braid(P, w):
    """a braid: a thick rope with chevrons along it"""
    C = spline(P, False, 18)
    rope = brush(P, w, (1, .55))
    marks = []
    seg = np.cumsum(np.r_[0, np.linalg.norm(np.diff(C, axis=0), axis=1)])
    for t in np.arange(3, seg[-1] - 2, w * .78):
        i = np.searchsorted(seg, t); i = min(i, len(C) - 2)
        p = C[i]; d = C[i + 1] - C[i]; d /= np.linalg.norm(d) + 1e-9; n = np.array([-d[1], d[0]])
        ww = w * .5 * (1 - .4 * (t / seg[-1]))
        marks.append(brush([p + n * ww, p + d * w * .32, p - n * ww], .42, (.5, .5), n=4))
    return rope, U(*marks).intersection(rope)

def sheen(P, w, side=-.22):
    """a highlight down one side of a rope (shows on dark hair, where the line ink doesn't)"""
    C = spline(P, False, 18)
    d = np.gradient(C, axis=0); d /= np.linalg.norm(d, axis=1)[:, None] + 1e-9
    n = np.stack([-d[:, 1], d[:, 0]], 1)
    return brush(list(C[2:-3:4] + n[2:-3:4] * w * side), w * .22, (.2, .2))

def loc(P, w):
    C = spline(P, False, 18)
    rope = brush(P, w, (1, .7))
    marks = []
    seg = np.cumsum(np.r_[0, np.linalg.norm(np.diff(C, axis=0), axis=1)])
    for j, t in enumerate(np.arange(4, seg[-1] - 3, 3.6)):
        i = min(np.searchsorted(seg, t), len(C) - 2)
        p = C[i]; d = C[i + 1] - C[i]; d /= np.linalg.norm(d) + 1e-9; n = np.array([-d[1], d[0]])
        s = 1 if j % 2 else -1
        marks.append(brush([p + n * w * .32 * s, p + n * w * .05 * s + d * 1.2], .4, (.4, .4), n=4))
    return rope, U(*marks).intersection(rope)

def front_layers(hair, lines=None, shine=None, extra=None, shadow=True, stubble=None):
    """layers for hair over the head: the shadow it casts on the forehead, the hair, its shade, strands and outline"""
    out = []
    if shadow: out.append(L("skin", 1, move(hair, .6, 2.6).difference(hair).intersection(SKULL)))
    if stubble is not None: out += [L("hair", 3, stubble)]
    out += [L("hair", 0, hair), L("hair", 1, U(crescent(hair, -4.2, -3.2), extra).intersection(hair))]
    if shine is not None: out.append(L("hair", 2, shine.intersection(hair)))
    if lines is not None: out.append(L("line", 0, lines.intersection(hair.buffer(-.5))))
    out.append(L("line", 0, outline(hair, LW, .7)))
    return [l for l in out if l]

def back_layers(hair, lines=None):
    if hair is None or hair.is_empty: return []
    out = [L("hair", 0, hair), L("hair", 2, hair.difference(move(hair, 2.5, 4)).union(hair.intersection(move(NECK.buffer(9), 0, -4))))]
    if lines is not None: out.append(L("line", 0, lines.intersection(hair.buffer(-.5))))
    out.append(L("line", 0, outline(hair, LW, .6)))
    return [l for l in out if l]

def jag_line(x0, x1, y0, y1, n, depth, seed=0, flip=False):
    """a ragged edge from (x0, y0) to (x1, y1): n points alternately in and out"""
    rng = np.random.default_rng(seed)
    pts = []
    for i in range(n + 1):
        t = i / n
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        off = depth * (1 if i % 2 else 0) * (.75 + .5 * rng.random())
        pts.append((x, y + (-off if flip else off)))
    return pts

def locks(spec, w=4.6):
    """pointed locks: each (root, tip, bend) is a tapered stroke from the root down to a point"""
    out = []
    for (rx, ry), (tx, ty), bend in spec:
        mx, my = (rx + tx) / 2 + bend, (ry + ty) / 2
        out.append(brush([(rx, ry), (mx, my), (tx, ty)], [w, w * .8, w * .3], (1, .05)))
    return U(*out)

def H_shag():
    cap = SKULL.buffer(3.4).intersection(above([(60, 60), (70, 50), (80, 41), (100, 38), (120, 41), (130, 50), (140, 60)]))
    fringe = locks([((80, 34), (77.6, 47.4), -.8), ((86, 33), (85, 45.6), .6), ((92, 32), (92.6, 47.8), .8), ((98, 32), (99.6, 45.2), .4), ((104, 32), (106.4, 47.2), 1.0),
                    ((110, 33), (113.4, 45.4), 1.0), ((116, 34), (120, 47.6), 1.2), ((121, 36), (124.6, 44.6), 1.0)], 6.0)
    side = U(locks([((72, 44), (68.6, 86), -1.4), ((75.6, 46), (72.6, 92), -.4), ((78, 52), (77.6, 80), .6), ((70, 50), (66.4, 78), -1.2)], 6.4), poly([(71, 36), (79, 40), (79, 56), (70, 60)]))
    front = U(cap, fringe, both(side)).difference(WIN.buffer(-1.5).intersection(below([(0, 49), (200, 49)])))
    lines = strands([(100, 24), (92, 32), (88, 42)], [(108, 24), (112, 34), (115, 44)], [(96, 26), (97, 36), (97, 44)], [(84, 30), (79, 40), (76, 50)], [(116, 30), (122, 40), (126, 52)],
                    [(72, 56), (70.6, 70), (70.4, 84)], [(128, 56), (129.4, 70), (129.6, 84)], [(75.4, 60), (75, 82)], [(124.6, 60), (125, 82)])
    back = U(blob([(100, 16), (122, 20), (136, 40), (139, 68), (137, 90), (100, 96), (63, 90), (61, 68), (64, 40), (78, 20)]),
             locks([((66, 80), (63.4, 104), -1), ((72, 84), (70.4, 108), 0), ((134, 80), (136.6, 104), 1), ((128, 84), (129.6, 108), 0)], 7))
    blines = strands([(66, 70), (65, 96)], [(134, 70), (135, 96)])
    return back_layers(back, blines), front_layers(front, lines)

def H_curly():
    ring = []
    for i, a in enumerate(np.linspace(np.pi * 1.06, np.pi * 1.94, 11)):
        ring.append(Point(100 + 33 * np.cos(a), 52 + 30 * np.sin(a)).buffer(7.4 if i % 2 else 8.2))
    edge = U(*ring)
    cap = SKULL.buffer(3).intersection(above([(60, 56), (76, 42), (100, 38), (124, 42), (140, 56)]))
    curls_front = U(*[Point(78 + i * 5.5, 41.5 - (2 if i % 2 else 0) + abs(i - 4) * .6).buffer(4.2) for i in range(9)])
    front = U(cap, edge.intersection(above([(60, 60), (200, 60)])), curls_front).difference(WIN.buffer(-1).intersection(below([(0, 48), (200, 48)])))
    marks, hl = [], []
    rng = np.random.default_rng(3)
    for cx, cy in [(78, 34), (88, 28), (100, 25), (112, 28), (122, 34), (72, 46), (128, 46), (94, 36), (106, 36), (84, 40), (116, 40), (100, 32)]:
        a0 = rng.uniform(0, 6.28)
        marks.append(brush([(cx + 3 * np.cos(a0 + t), cy + 3 * np.sin(a0 + t)) for t in np.linspace(0, 3.6, 6)], .6, (.2, .2)))
        hl.append(brush([(cx + 2 * np.cos(a0 + t), cy + 2 * np.sin(a0 + t)) for t in np.linspace(.4, 3.0, 5)], 1.3, (.3, .3)))
    back = U(*[Point(100 + 37 * np.cos(a), 57 + 38 * np.sin(a)).buffer(9.4 if i % 2 else 10.6) for i, a in enumerate(np.linspace(-np.pi * .95, np.pi * .95, 24))], blob([(66, 30), (134, 30), (138, 88), (62, 88)]))
    back = back.intersection(below([(0, 6), (200, 6)]))
    bmarks = []
    for cx, cy in [(64, 60), (63, 80), (68, 94), (136, 60), (137, 80), (132, 94), (70, 32), (130, 32), (100, 18), (85, 20), (115, 20)]:
        a0 = rng.uniform(0, 6.28)
        bmarks.append(brush([(cx + 3.4 * np.cos(a0 + t), cy + 3.4 * np.sin(a0 + t)) for t in np.linspace(0, 3.6, 6)], .6, (.2, .2)))
    return back_layers(back, U(*bmarks)), front_layers(front, U(*marks), extra=U(*hl))

def H_buzz():
    cap = SKULL.buffer(1.1).intersection(above([(68, 62), (72, 60), (73.6, 50), (77.4, 41), (86, 35.6), (100, 34.6), (114, 35.6), (122.6, 41), (126.4, 50), (128, 60), (132, 62)]))
    out = [L("skin", 1, move(cap, .4, 1.6).difference(cap).intersection(SKULL)), L("hair", 0, cap), L("hair", 3, cap), L("hair", 1, crescent(cap, -4, -3).intersection(cap)), L("line", 0, outline(cap, 1.0, .5))]
    return [], [l for l in out if l]

def crest(h=1.0):
    pts = [(91.4, 42), (89.6, 30), (85, 15), (93.2, 21), (94.6, 3), (100, 15), (104.6, 2), (107.2, 20), (115, 12), (110.6, 30), (108.6, 42)]
    return poly([(x, 42 - (42 - y) * h) for x, y in pts]).buffer(.9).buffer(-.9).union(SKULL.buffer(.6).intersection(poly([(91, 20), (109, 20), (109, 44), (91, 44)])))

def H_mohawk():
    shaved = SKULL.intersection(above(HL))
    c = crest()
    lines = strands([(100, 40), (99, 24), (95, 8)], [(96, 38), (94, 26), (88, 17)], [(104, 38), (106, 26), (112, 14)], w=.6)
    return [], front_layers(c, lines, stubble=shaved)

def H_longhawk():
    shaved = SKULL.intersection(above(HL))
    fall = U(blob([(92, 40), (90, 26), (94, 12), (104, 6), (118, 9), (130, 18), (138, 34), (141, 60), (140.4, 84), (134, 86), (128.6, 66), (124, 46), (114, 36), (104, 38)]),
             locks([((136, 70), (138.6, 104), 1.2), ((131, 66), (132.4, 100), .4), ((139, 64), (143, 94), 1.4)], 7.4))
    hair = fall
    lines = strands([(102, 16), (120, 18), (132, 36), (136, 66), (136, 92)], [(104, 26), (118, 30), (127, 46), (131, 72), (132, 96)], [(98, 30), (110, 36), (122, 50), (126, 66)], w=.6)
    return [], front_layers(hair, lines, stubble=shaved.difference(fall))

def H_braids():
    cap = SKULL.buffer(1.6).intersection(above([(64, 64), (70, 58), (73, 48), (78, 40), (87, 36), (100, 35), (113, 36), (122, 40), (127, 48), (130, 58), (136, 64)]))
    rows = strands(*[[(100 + k * 7, 36.4), (100 + k * 8.4, 28), (100 + k * 8, 20)] for k in (-3, -2, -1, 0, 1, 2, 3)], w=.5)
    ropes_f, marks_f, sh_f = [], [], []
    for x0, x1 in [(73, 70), (78.4, 76.4)]:
        P = [(x0, 48), (x0 - 2.4, 80), (x1 - 3, 112), (x1, 142)]
        r, m = braid(P, 5.2); ropes_f.append(r); marks_f.append(m); sh_f.append(sheen(P, 5.2))
    ropes_f = U(*ropes_f); marks_f = U(*marks_f); sh_f = U(*sh_f)
    ropes_f = U(ropes_f, mirror(ropes_f)); marks_f = U(marks_f, mirror(marks_f)); sh_f = U(sh_f, mirror(sh_f))
    ropes_b, marks_b = [], []
    for x0, x1, y1 in [(70, 60, 150), (75, 64.6, 160), (125, 135.4, 160), (130, 140, 150), (82, 70, 150), (118, 130, 152)]:
        r, m = braid([(x0, 34), (x0 - (x0 - x1) * .5, 80), (x1, y1)], 5.0); ropes_b.append(r); marks_b.append(m)
    back = U(*ropes_b, SKULL.buffer(1.6).intersection(below([(0, 40), (200, 40)])).intersection(above([(0, 70), (200, 70)])))
    f = front_layers(cap, rows) + [L("hair", 0, ropes_f), L("hair", 1, U(crescent(ropes_f, -1.6, -1), sh_f).intersection(ropes_f)), L("line", 0, marks_f), L("line", 0, outline(ropes_f, 1.0, .4)),
                                    L("amber", 0, both(U(poly([(67.6, 138), (72.8, 138), (72.8, 141.2), (67.6, 141.2)]), poly([(74, 138.6), (79, 138.6), (79, 141.8), (74, 141.8)]))))]
    return back_layers(back, U(*marks_b)), [l for l in f if l]

def H_bob():
    cap = SKULL.buffer(4.4).intersection(above([(50, 46), (200, 46)]))
    side = poly([(64.4, 38), (63.6, 66), (64.6, 86), (68, 90.6), (79.6, 89.4), (78.4, 70), (77, 50), (76, 44)]).buffer(1.4).buffer(-1.4)
    fringe = poly([(75, 34), (125, 34), (125.6, 46.6), (100, 47.4), (74.4, 46.6)])
    front = U(cap, fringe, both(side))
    lines = strands([(100, 24), (96, 34), (94, 46)], [(108, 25), (110, 36), (110, 46)], [(88, 28), (84, 38), (84, 46)], [(116, 28), (118, 38), (118, 46)],
                    [(70, 46), (69, 66), (70, 86)], [(130, 46), (131, 66), (130, 86)], [(74, 50), (74.6, 70), (75.6, 87)], [(126, 50), (125.4, 70), (124.4, 87)])
    back = blob([(66, 40), (134, 40), (135.6, 76), (134.6, 92), (100, 96), (65.4, 92), (64.4, 76)])
    return back_layers(back), front_layers(front, lines)

def H_bun():
    cap = SKULL.buffer(1.8).intersection(above(HL_HIGH))
    bun = Point(100, 13.6).buffer(11.6)
    hair = U(cap, bun)
    lines = strands([(84, 38), (88, 28), (96, 22)], [(116, 38), (112, 28), (104, 22)], [(76, 48), (80, 34), (92, 24)], [(124, 48), (120, 34), (108, 24)], [(100, 36), (100, 25)],
                    [(91, 10), (96, 5.4), (104, 5)], [(90, 16), (98, 20), (108, 18)], [(94, 13), (101, 10), (108, 12)])
    out = front_layers(hair, lines)
    out.append(L("line", 0, brush([(89.8, 22.6), (100, 25), (110.2, 22.6)], 1.1, (.4, .4))))
    return [], out

def H_swoop():
    cap = SKULL.buffer(2.4).intersection(above(HL))
    sweep = U(blob([(118, 20), (127, 28), (124, 38), (112, 43), (99, 47), (88, 50.4), (80, 52), (77, 44), (82, 32), (92, 24), (103, 19.4)]),
              locks([((92, 44), (75.6, 61), -1.5), ((100, 42), (81, 55.6), -1.2), ((86, 40), (74.2, 54.6), -1)], 7.6))
    hair = U(cap, sweep)
    lines = strands([(120, 26), (104, 34), (88, 44), (77, 55)], [(116, 22), (100, 26), (86, 36), (76, 48)], [(122, 34), (108, 40), (94, 46)], [(110, 21), (94, 25), (82, 34)], w=.6)
    return [], front_layers(hair, lines)

def H_long():
    cap = SKULL.buffer(2.6).intersection(above([(60, 44), (80, 37), (99.4, 33), (100.6, 33), (120, 37), (140, 44)]))
    curtain = blob([(99.6, 23), (84, 26), (73, 36), (68.4, 56), (67.6, 84), (66.4, 116), (68, 146), (72.4, 152), (79.6, 148), (79.4, 118), (79.8, 88), (78.4, 64), (79.6, 48), (87, 37), (99.6, 30)])
    front = U(cap, curtain, mirror(curtain))
    lines = strands([(98, 26), (82, 34), (74, 54), (73, 90), (72, 130)], [(94, 30), (80, 44), (76, 70), (75.6, 104), (75, 142)], [(88, 28), (77, 42), (71, 70), (70.4, 112)], w=.55)
    lines = U(lines, mirror(lines))
    back = blob([(100, 18), (126, 24), (138, 50), (138, 100), (140, 140), (100, 132), (60, 140), (62, 100), (62, 50), (74, 24)])
    return back_layers(back), front_layers(front, lines)

def H_locs():
    cap = SKULL.buffer(2.0).intersection(above([(62, 60), (70, 54), (74, 44), (80, 38), (90, 34), (100, 33.4), (110, 34), (120, 38), (126, 44), (130, 54), (138, 60)]))
    roots = strands(*[[(100 + k * 8, 34), (100 + k * 9.2, 26), (100 + k * 9, 21)] for k in (-3, -2, -1, 0, 1, 2, 3)], w=.5)
    rf, mf, sf = [], [], []
    for x0, x1, y1 in [(72.6, 70, 130), (78, 76.6, 120)]:
        P = [(x0, 40), (x0 - 3, 70), (x1 - 2, 100), (x1, y1)]
        r, m = loc(P, 6.6); rf.append(r); mf.append(m); sf.append(sheen(P, 6.6))
    rf = U(*rf); mf = U(*mf); sf = U(*sf); rf = U(rf, mirror(rf)); mf = U(mf, mirror(mf)); sf = U(sf, mirror(sf))
    rb, mb = [], []
    for x0, x1, y1 in [(70, 59, 128), (77, 64, 138), (123, 136, 138), (130, 141, 128), (86, 72, 132), (114, 128, 132)]:
        r, m = loc([(x0, 30), (x0 + (x1 - x0) * .5, 78), (x1, y1)], 6.4); rb.append(r); mb.append(m)
    back = U(*rb, blob([(66, 34), (100, 18), (134, 34), (136, 70), (64, 70)]))
    f = front_layers(cap, roots) + [L("hair", 0, rf), L("hair", 1, U(crescent(rf, -2, -1), sf).intersection(rf)), L("line", 0, mf), L("line", 0, outline(rf, 1.1, .4))]
    return back_layers(back, U(*mb)), [l for l in f if l]

def H_pixie():
    cap = SKULL.buffer(2.8).intersection(above([(66, 64), (71, 60), (73, 50), (77, 42), (86, 37), (100, 36), (114, 37), (123, 42), (127, 50), (129, 60), (134, 64)]))
    tufts = poly([(120, 30), (124, 40), (114, 41), (110, 46.4), (104, 42.4), (98, 47.6), (93, 43), (85.6, 48), (84, 42.6), (76.4, 46.4), (77.6, 36), (96, 26)]).buffer(.7).buffer(-.7)
    burns = both(poly([(73.4, 50), (76.4, 50), (76.2, 62), (73.2, 64)]))
    hair = U(cap, tufts, burns)
    lines = strands([(118, 28), (106, 34), (98, 44)], [(112, 26), (98, 32), (88, 44)], [(104, 24), (90, 30), (80, 42)], [(124, 36), (114, 40)], [(76, 40), (74.4, 52)], [(124, 44), (126, 54)], w=.55)
    return [], front_layers(hair, lines)

def H_ponytail():
    cap = SKULL.buffer(1.9).intersection(above(HL_HIGH))
    lines = strands([(84, 38), (94, 28), (110, 24), (124, 30)], [(76, 48), (86, 32), (104, 24), (124, 28)], [(96, 36), (108, 28), (124, 32)], [(124, 46), (126, 36)], w=.55)
    tail = blob([(122, 30), (132, 30), (140, 44), (145.4, 66), (145, 92), (140.4, 118), (136.4, 100), (136.6, 76), (132, 54), (126, 42)])
    tie = Point(129.6, 33.4).buffer(3.2)
    tl = strands([(132, 36), (140, 56), (142, 86), (140, 110)], [(129, 40), (135, 60), (138, 90)], w=.55)
    b = back_layers(tail, tl) + [L("amber", 0, tie), L("line", 0, outline(tie, .8, .3))]
    return b, front_layers(cap, lines)

STYLES = {"shag": H_shag, "curly": H_curly, "buzz": H_buzz, "mohawk": H_mohawk, "braids": H_braids, "bob": H_bob, "bun": H_bun, "swoop": H_swoop,
          "long": H_long, "locs": H_locs, "pixie": H_pixie, "ponytail": H_ponytail, "longhawk": H_longhawk}

def hair_all():
    out = {}
    for k, f in STYLES.items():
        b, fr = f()
        out[k] = {"back": conv(b), "front": conv(fr)}
    return out

# ---------------------------------------------------------------- beards and glasses
MOUTH_HOLE = blob([(91.4, 76.6), (100, 77.4), (108.6, 76.6), (107, 81.6), (100, 85.6), (93, 81.6)])
def beards():
    jaw = blob([(72.8, 58), (73.6, 70), (78, 82), (88, 92.4), (100, 95.6), (112, 92.4), (122, 82), (126.4, 70), (127.2, 58), (123.6, 64), (118.6, 71), (110, 73.6), (104, 73.2), (100, 73.6), (96, 73.2), (90, 73.6), (81.4, 71), (76.4, 64)]).intersection(SKULL)
    stubble = jaw.difference(MOUTH_HOLE.buffer(.4))
    moust = blob([(89.4, 77.6), (93, 74.4), (100, 74.0), (107, 74.4), (110.6, 77.6), (105, 76.4), (100, 77.2), (95, 76.4)])
    full = blob([(72.6, 56), (73.2, 72), (77.6, 86), (86, 96.6), (100, 101.4), (114, 96.6), (122.4, 86), (126.8, 72), (127.4, 56), (124, 62), (119, 70), (111, 73.2), (104, 72.6), (100, 73.2), (96, 72.6), (89, 73.2), (81, 70), (76, 62)])
    full = U(full.difference(MOUTH_HOLE), moust)
    flines = strands([(80, 74), (84, 86)], [(120, 74), (116, 86)], [(90, 86), (94, 95)], [(110, 86), (106, 95)], [(100, 88), (100, 98)], [(76, 64), (78, 74)], [(124, 64), (122, 74)], w=.5)
    return {
        "stubble": conv([L("hair", 3, stubble), L("hair", 3, moust.buffer(-.3))]),
        "moustache": conv([L("hair", 0, moust), L("hair", 1, crescent(moust, 0, -1.4).intersection(moust)), L("line", 0, U(outline(moust, .9, .4), strands([(96, 75.6), (94, 77)], [(104, 75.6), (106, 77)], w=.4)))]),
        "beard": conv([L("hair", 0, full), L("hair", 1, U(crescent(full, -4, -3), full.intersection(below([(0, 92), (200, 92)]))).intersection(full)), L("line", 0, flines.intersection(full.buffer(-.6))), L("line", 0, outline(full, LW, .7))]),
    }

def glasses():
    lens = lambda cx: blob([(cx - 7.6, 53), (cx, 51.8), (cx + 7.6, 53), (cx + 7.8, 59.6), (cx + 4.6, 63.4), (cx - 4.6, 63.4), (cx - 7.8, 59.6)])
    L1, L2 = lens(88.4), lens(111.6)
    frames = U(outline(L1, 1.5, .3), outline(L2, 1.5, .3), brush([(95.6, 55), (100, 53.4), (104.4, 55)], 1.3, (1, 1)),
               brush([(80.6, 54.4), (74.6, 54.2)], 1.3, (1, .6)), brush([(119.4, 54.4), (125.4, 54.2)], 1.3, (1, .6)))
    glint = U(*[brush([(cx + 2.4, 54.2), (cx - 3.4, 61.6)], 1.4, (.4, .4)) for cx in (88.4, 111.6)])
    return conv([L("paper", 1, U(L1, L2)), L("paper", 0, glint.intersection(U(L1, L2))), L("line", 0, frames)])

# ---------------------------------------------------------------- hats
def hats():
    out = {}
    brim_y = 40.5
    dome = SKULL.buffer(4.6).intersection(above([(60, brim_y + 3), (100, brim_y), (140, brim_y + 3)]))
    # beanie: a folded cuff with ribs, a soft top
    top = U(dome, blob([(78, 26), (100, 8), (122, 26), (100, 20)]))
    cuff = poly([(68.6, 33.6), (100, 30.4), (131.4, 33.6), (132.2, 45.4), (100, 42.6), (67.8, 45.4)])
    ribs = U(*[brush([(x, 31.6 + abs(x - 100) * .05), (x, 43.8 + abs(x - 100) * .05)], .9, (1, 1)) for x in np.arange(71, 131, 4)])
    beanie = U(top, cuff)
    folds = strands([(86, 30), (90, 16)], [(114, 30), (110, 16)], [(100, 29), (100, 12)], w=.6)
    out["beanie"] = {"layers": conv([L("hat", 0, beanie), L("hat", 1, crescent(beanie, -4, -2).intersection(beanie)), L("hat", 2, ribs.intersection(cuff)), L("line", 0, U(outline(beanie, LW, .7), outline(cuff, .9, .4), folds.intersection(top)))]),
                     "hides": svgpath(U(beanie, above([(60, 44), (140, 44)]).intersection(poly([(60, -60), (140, -60), (140, 44), (60, 44)]))))}
    # cap: six panels, a button, the peak curving down toward you
    crown = SKULL.buffer(3.0).intersection(above([(60, 45), (100, 42.6), (140, 45)]))
    crown = U(crown, blob([(76, 30), (100, 19.6), (124, 30), (100, 26)]))
    peak = blob([(75.4, 44.4), (100, 41.4), (124.6, 44.4), (125.6, 47.6), (113, 51.6), (100, 52.8), (87, 51.6), (74.4, 47.6)])
    seams = strands([(100, 20.6), (100, 42)], [(98, 21), (86, 31), (80, 43)], [(102, 21), (114, 31), (120, 43)], w=.6)
    star = []
    for i in range(10):
        an = np.pi * 2 * i / 10 - np.pi / 2; r = 4.4 if i % 2 == 0 else 1.9
        star.append((100 + r * np.cos(an), 33 + r * np.sin(an)))
    logo = poly(star)
    shadow = move(peak, 0, 3.2).difference(peak).intersection(SKULL)
    out["cap"] = {"layers": conv([L("skin", 1, shadow), L("hat", 0, crown), L("hat", 1, crescent(crown, -4, -2).intersection(crown)), L("line", 0, U(outline(crown, LW, .7), seams.intersection(crown.buffer(-.5)).difference(logo.buffer(1)))),
                                  L("amber", 0, logo), L("line", 0, outline(logo, .6, .2)), L("hat", 2, peak), L("hat", 1, peak.intersection(move(peak, 0, -2.6))), L("line", 0, outline(peak, LW, .8)), L("line", 0, Point(100, 20.6).buffer(2.0))]),
                  "hides": svgpath(U(crown, peak, above([(60, 44), (140, 44)]).intersection(poly([(60, -60), (140, -60), (140, 44), (60, 44)]))))}
    # bandana: a band round the forehead, tied at the side, dotted
    band = poly([(70, 31.6), (100, 27.8), (130, 31.6), (130.6, 40.6), (100, 36.6), (69.4, 40.6)]).intersection(SKULL.buffer(2.2))
    knot = Point(129.6, 36).buffer(3.4)
    tails = U(poly([(130, 35), (144, 32.6), (141.6, 39.2)]).buffer(.6), poly([(130, 37), (142.4, 45.6), (136, 47.2)]).buffer(.6))
    band = U(band, knot, tails)
    dots = U(*[Point(x, 33.6 - abs(x - 100) * .02 + (1 if (int(x) // 6) % 2 else -1) * .6).buffer(.9) for x in np.arange(74, 128, 6)])
    out["bandana"] = {"layers": conv([L("hat", 0, band), L("hat", 1, crescent(band, 0, -2.4).intersection(band)), L("paper", 0, dots.intersection(band.buffer(-.5))), L("line", 0, U(outline(band, LW, .7), outline(knot, .8, .3)))]),
                      "hides": svgpath(band)}
    return out

PA.EXTRA_BUILDERS += [("hair", hair_all), ("beards", beards), ("glasses", glasses), ("hats", hats)]
