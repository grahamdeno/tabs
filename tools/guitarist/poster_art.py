# The Gig poster guitarist, drawn as vectors and split by ink. Writes art/guitarist-poster.js.
# Run: python3 tools/guitarist/poster_art.py   (needs numpy and shapely)
# Units are guitarist.js's: the full figure is viewBox "16 0 168 252", the bust "30 14 140 150"; the head is about
# 70 units tall (crown 21, chin 92), so the figure from crown to the bottom of the frame is about 3.3 heads: real
# proportions for a body seven heads tall. The face looks at you; lefty is the app mirroring round x = 100.
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from poster_geom import *

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
LW = 1.45          # the main ink line

def L(ink, tone, g):
    """one layer: (ink, tone, shape). tone 0 flat ink, 1 the ink's shade (halftone, flat in the small bust), 2 the ink's deep shade (solid),
    3 the ink itself as a fine stipple (stubble and shaved hair)"""
    return (ink, tone, g) if g is not None and not g.is_empty else None

def M(ls):
    """mirror a list of layers round x = 100"""
    return [(i, t, mirror(g)) for i, t, g in ls]

def layers(*ls):
    return [l for l in ls if l]

def inked(ink, g, shade=None, deep=None, w=LW, heavy=.8, line=True):
    """a filled shape with its shade and its outline"""
    out = [L(ink, 0, g)]
    if shade is not None: out.append(L(ink, 1, shade.intersection(g)))
    if deep is not None: out.append(L(ink, 2, deep.intersection(g)))
    if line: out.append(L("line", 0, outline(g, w, heavy)))
    return [x for x in out if x]

# ---------------------------------------------------------------- the head
HEAD_R = [(100, 21), (112, 22.6), (120.5, 27.5), (125.6, 36), (127.4, 46), (127, 55.5), (125.6, 65.5), (122.8, 75.5), (117.6, 84), (109.4, 90), (100, 92)]
HEAD_PTS = HEAD_R + [(200 - x, y) for x, y in HEAD_R[-2:0:-1]]
FACE = blob(HEAD_PTS)
EAR_R = blob([(125.5, 52), (129, 50.5), (131.6, 53), (131.2, 59), (129, 65.5), (125.8, 70), (124.5, 62)])
EARS = both(EAR_R)
NECK = blob([(88.8, 78), (111.2, 78), (112.2, 94), (117, 102.5), (100, 106.5), (83, 102.5), (87.8, 94)])
HEADZONE = U(FACE, EARS)

def head_base():
    ear_in = both(brush([(127.3, 55), (129.6, 54.6), (129.6, 59), (127.6, 64)], .8, (.3, .3)))
    ear_sh = both(blob([(126, 54), (129, 53.5), (129.3, 60), (127, 66), (125.7, 61)]))
    sh = crescent(FACE, -6.5, -3.2)
    neck_sh = NECK.intersection(move(FACE.buffer(1.5), 0, 7.5))
    neck_side = crescent(NECK, -3, 0)
    return {
        "neck": layers(L("skin", 0, NECK), L("skin", 1, U(neck_sh, neck_side)), L("line", 0, outline(NECK, LW, .7).difference(FACE.buffer(-.4)))),
        "head": layers(L("skin", 0, EARS), L("skin", 1, ear_sh.intersection(EARS)), L("line", 0, outline(EARS, 1.1, .6).difference(FACE)), L("line", 0, ear_in),
                       L("skin", 0, FACE), L("skin", 1, sh), L("line", 0, outline(FACE, LW, .9)))
    }

# ---------------------------------------------------------------- faces
EYE_C = 88.4   # left eye centre x (the right eye is mirrored)
EYE_Y = 57.4

def eye(mood, s=-1):
    """one eye: paper white, iris, lids. s = -1 the viewer's left eye (its outer corner to the left), +1 the right."""
    x, y = EYE_C, EYE_Y
    if s == 1: x = 200 - EYE_C
    X = lambda dx: x + s * dx          # dx > 0 is toward the outer corner
    open_ = {"happy": 1.0, "cheer": .55, "proud": .72, "sleepy": .16, "worried": 1.15}[mood]
    top = y - 2.6 * open_ - .2
    bot = y + 1.7 * (.75 if mood == "cheer" else 1)
    white = blob([(X(5.4), y + .1), (X(2.6), top + .6), (X(-1), top), (X(-4.3), top + 1), (X(-5.3), y + .3), (X(-2.2), bot), (X(2), bot + .1)])
    ix = x - s * .2
    iris = Point(ix, y).buffer(2.45)
    pupil = Point(ix, y).buffer(1.05)
    glint = Point(ix + .9, y - 1.0).buffer(.55)
    lid_up = brush([(X(6.2), y + .4), (X(3), top + .1), (X(-1), top - .4), (X(-4.4), top + .7), (X(-6.0), y + .5)], [1.3, 1.8, 1.7, 1.3, .9], (.5, .25))
    lash = brush([(X(5.4), y - .2), (X(6.6), y - .9), (X(7.1), y - 1.6)], .8, (1, .1))
    lid_lo = brush([(X(4.2), bot - .1), (X(0), bot + .65), (X(-3.8), bot + .2)], .55, (.2, .2))
    cy = top - 2.0
    crease = brush([(X(4.6), cy + .9), (X(.5), cy), (X(-4.4), cy + 1.4)], .5, (.2, .15))
    out = [L("paper", 0, white), L("line", 0, iris.intersection(white)), L("line", 0, lid_up)]
    if open_ > .5: out.insert(2, L("paper", 0, glint.intersection(white)))
    if mood != "sleepy": out += [L("line", 0, lash), L("line", 0, lid_lo), L("line", 0, crease)]
    else: out += [L("line", 0, brush([(X(4.2), cy + 2.2), (X(0), cy + 1.5), (X(-3.6), cy + 2.3)], .45, (.2, .2)))]
    if mood == "cheer": out += [L("line", 0, brush([(X(4.6), bot + 2.3), (X(0), bot + 1.6), (X(-4.5), bot + 2.4)], .5, (.1, .1)))]
    return [l for l in out if l]

def brow(mood):
    x = EYE_C
    P = {"happy":   [(x - 6.5, 51.3), (x - 2, 49.4), (x + 3, 49.4), (x + 6.6, 50.6)],
         "cheer":   [(x - 6.5, 50.2), (x - 2, 47.8), (x + 3, 47.8), (x + 6.6, 49.4)],
         "proud":   [(x - 6.5, 50.4), (x - 2, 48.8), (x + 3, 49.4), (x + 6.6, 51.4)],
         "sleepy":  [(x - 6.5, 52.4), (x - 2, 51.2), (x + 3, 51.3), (x + 6.6, 52.3)],
         "worried": [(x - 6.5, 51.6), (x - 2, 50.6), (x + 3, 48.8), (x + 6.4, 47.6)]}[mood]
    return brush(P, [1.6, 2.5, 2.4, 2.0], (.3, .55))

def nose():
    bridge = brush([(103.2, 57), (104.4, 63), (105.4, 68.2)], .75, (.1, .4))
    tip = brush([(96.4, 70.6), (98.6, 72.0), (101.6, 72.0), (104.2, 70.4)], 1.0, (.3, .3))
    wing = both(brush([(96.6, 67.8), (95.0, 69.6), (95.7, 71.3)], .85, (.2, .5)))
    shade = blob([(99, 72.4), (103, 72.2), (105.5, 70.5), (104.5, 73.8), (100, 74.6)])
    side = blob([(103.6, 58), (106.5, 63), (107.5, 69), (105.4, 70), (104.2, 63.5)])
    return [L("skin", 1, U(shade, side)), L("line", 0, U(bridge, tip, wing))]

def mouth(mood):
    out = []
    if mood == "happy":
        out += [L("line", 0, brush([(91.6, 77.0), (95.5, 78.9), (100, 79.5), (104.5, 78.9), (108.4, 77.0)], [.6, 1.1, 1.2, 1.1, .6], (.2, .2)))]
        out += [L("line", 0, both(brush([(91.2, 76.2), (91.6, 77.1), (92.2, 77.8)], .5, (.3, .3))))]
        out += [L("skin", 1, blob([(96, 81.4), (100, 82.6), (104, 81.4), (102, 84.4), (98, 84.4)]))]
        out += [L("line", 0, brush([(97.6, 82.8), (100, 83.3), (102.4, 82.8)], .55, (.2, .2)))]
    elif mood == "cheer":
        hole = blob([(90.6, 76.4), (95, 77.6), (100, 78.0), (105, 77.6), (109.4, 76.4), (107.2, 81.6), (103.6, 85.4), (100, 86.4), (96.4, 85.4), (92.8, 81.6)])
        teeth = hole.intersection(blob([(90, 76), (110, 76), (108.6, 78.9), (100, 80.0), (91.4, 78.9)]))
        tongue = hole.intersection(blob([(94.6, 86), (97, 83.2), (100, 82.6), (103, 83.2), (105.4, 86), (100, 88)]))
        out += [L("line", 0, hole), L("paper", 0, teeth), L("skin", 2, tongue), L("line", 0, outline(hole, .9, .4))]
        out += [L("skin", 1, blob([(97, 87.2), (100, 88.3), (103, 87.2), (101, 89.6), (99, 89.6)]))]
        out += [L("line", 0, both(brush([(88.4, 73.8), (90.0, 76.4), (91.4, 78.2)], .55, (.3, .3))))]
    elif mood == "proud":
        out += [L("line", 0, brush([(92.6, 78.6), (96, 79.4), (100, 79.6), (104.5, 78.6), (108.6, 76.4)], [.6, 1.1, 1.2, 1.1, .6], (.2, .2)))]
        out += [L("line", 0, brush([(108.2, 75.6), (108.8, 76.7), (109.6, 77.4)], .5, (.3, .3)))]
        out += [L("skin", 1, blob([(96, 81.6), (100, 82.8), (104, 81.6), (102, 84.6), (98, 84.6)]))]
        out += [L("line", 0, brush([(97.6, 83.0), (100, 83.5), (102.4, 83.0)], .55, (.2, .2)))]
    elif mood == "sleepy":
        out += [L("line", 0, brush([(94.6, 79.6), (97.4, 79.1), (100, 79.3), (102.6, 79.1), (105.2, 79.8)], [.5, 1.0, 1.1, 1.0, .5], (.2, .2)))]
        out += [L("skin", 1, blob([(96.5, 81.8), (100, 82.8), (103.5, 81.8), (102, 84.4), (98, 84.4)]))]
        out += [L("line", 0, brush([(98, 82.9), (100, 83.3), (102, 82.9)], .5, (.2, .2)))]
    elif mood == "worried":
        out += [L("line", 0, brush([(93.6, 80.4), (96.6, 79.0), (100, 78.8), (103.4, 79.0), (106.4, 80.6)], [.6, 1.1, 1.2, 1.1, .6], (.2, .2)))]
        out += [L("skin", 1, blob([(96.5, 81.6), (100, 82.4), (103.5, 81.6), (102, 84.0), (98, 84.0)]))]
        out += [L("line", 0, brush([(97.8, 82.6), (100, 83.0), (102.2, 82.6)], .5, (.2, .2)))]
    return [l for l in out if l]

def face(mood):
    out = eye(mood, -1) + eye(mood, 1)
    b = brow(mood)
    out += [L("line", 0, U(b, mirror(b)) if mood != "proud" else U(b, mirror(move(brow("happy"), 0, -.6))))]
    out += nose() + mouth(mood)
    if mood == "worried":
        out += [L("line", 0, both(brush([(97.4, 46.6), (98.4, 44.6)], .45, (.3, .3))))]
    if mood == "sleepy":   # two small zeds in the amber ink, up and to the right
        z = lambda x, y, k: brush([(x, y), (x + k, y), (x, y + k), (x + k, y + k)], .34 * k, (1, 1), n=2)
        out += [L("amber", 0, U(z(134, 26, 5.4), z(143, 16, 4)))]
    return [l for l in out if l]


# ---------------------------------------------------------------- the body
TORSO_R = [(100, 98.5), (111, 98.5), (124, 102.6), (137, 106), (146.6, 110.4), (152.8, 117.6), (154.6, 128.4), (152.4, 141), (146.6, 160), (141, 190), (140.4, 222), (141.6, 252), (142, 262)]
TORSO = blob(TORSO_R + [(200 - x, y) for x, y in TORSO_R[::-1]])
TORSO = TORSO.intersection(poly([(0, 90), (200, 90), (200, 262), (0, 262)]))
NECKLINE = blob([(88.6, 99.2), (92, 105.6), (100, 109.6), (108, 105.6), (111.4, 99.2), (100, 90)])
SH_R, SH_L = (147, 123.4), (53, 123.4)     # shoulder joints (viewer's right and left)

def folds(*strokes):
    return U(*[brush(p, w, (.1, .1)) for p, w in strokes])

def torso_look(look):
    """the body from the neck down for one venue look, as layers"""
    chest = TORSO.intersection(NECKLINE)          # skin showing at the collar
    shirt = TORSO.difference(NECKLINE)
    side = crescent(TORSO, -7, 0)
    under = TORSO.intersection(move(NECKLINE.buffer(2.5), 0, 3)).difference(NECKLINE)
    out = [L("skin", 0, chest), L("skin", 1, chest.intersection(move(FACE, 0, 13)))]
    if look in ("tee", "vest"):
        collar = NECKLINE.buffer(2.3).difference(NECKLINE).intersection(TORSO)
        out += [L("top", 0, shirt), L("top", 1, U(side, under)), L("top", 2, collar.intersection(move(NECKLINE, 0, 2.2)).difference(NECKLINE)),
                L("line", 0, U(outline(collar, .7, .3), folds(([(121, 130), (126, 146)], .5), ([(72, 126), (75, 138)], .5))))]
        if look == "vest":
            vest_r = blob([(111, 99), (121, 103), (133, 108.4), (139.5, 112), (137, 124), (136.6, 140), (141, 160), (139.6, 195), (140.4, 225), (142, 252), (143, 262), (110, 262), (110, 200), (112, 150), (110, 118), (108.5, 104)])
            vest = both(vest_r).intersection(TORSO)
            lapel = both(blob([(110.6, 100), (117, 104), (114.5, 128), (111.5, 152), (110, 150), (110.8, 120)]))
            pocket = both(poly([(116, 156), (132, 156), (132.4, 172), (116.4, 172)]))
            stitch = both(U(brush([(117, 158.4), (131.4, 158.4)], .35, (1, 1)), brush([(117.4, 170), (131.6, 170)], .35, (1, 1))))
            out += [L("spot", 0, vest), L("spot", 1, U(side, crescent(vest, 3, 0), vest.intersection(move(TORSO, 0, 6)).symmetric_difference(vest).intersection(vest))),
                    L("spot", 2, lapel.intersection(vest)), L("line", 0, U(outline(vest, LW, .6), outline(lapel, .7, .3), outline(pocket, .6, .2))),
                    L("paper", 0, stitch.intersection(vest)), L("amber", 0, both(U(Point(124, 164).buffer(1.3), Point(113.4, 182).buffer(1.2), Point(113.4, 205).buffer(1.2))))]
    elif look == "flannel":
        tee = blob([(91, 99), (100, 102), (109, 99), (112, 110), (104, 150), (96, 150), (88, 110)]).intersection(TORSO)
        out += [L("top", 0, shirt), L("top", 1, U(side, under))]
        checks = U(*[poly([(x, 90), (x + 7, 90), (x + 7, 262), (x, 262)]) for x in range(46, 156, 19)],
                   *[poly([(0, y), (200, y), (200, y + 6.5), (0, y + 6.5)]) for y in range(112, 262, 19)]).intersection(shirt)
        thin = U(*[brush([(x, 92), (x, 262)], .45, (1, 1)) for x in range(56, 156, 19)], *[brush([(30, y), (170, y)], .45, (1, 1)) for y in range(122, 262, 19)]).intersection(shirt)
        collar = both(blob([(100.5, 103), (110, 98.2), (121, 103.5), (117, 115), (108, 128), (101, 113)]))
        open_ = both(blob([(100, 101), (108.6, 99), (104, 120), (100.5, 140), (100, 140)]))
        out += [L("top", 2, checks.difference(open_)), L("line", 0, thin.difference(open_))]
        out += [L("line", 0, open_.intersection(TORSO).difference(NECKLINE)), L("top", 0, collar), L("top", 2, crescent(collar, -2, -2).intersection(collar)),
                L("line", 0, U(outline(collar, .9, .4), brush([(101.4, 138), (101, 252)], .7, (1, 1)))),
                L("paper", 0, U(*[Point(104.2, y).buffer(1.15) for y in (148, 172, 196, 220, 244)]))]
    elif look in ("leather", "stage"):
        inner = blob([(91.5, 99), (100, 101), (108.5, 99), (113, 112), (110, 160), (108, 262), (92, 262), (90, 160), (87, 112)]).intersection(TORSO)
        jacket = TORSO.difference(inner).difference(NECKLINE)
        lapel = both(blob([(108.4, 99.6), (115, 103), (121, 110), (124.6, 120), (117, 150), (110.4, 190), (109.4, 150), (110.6, 118)]))
        out += [L("top", 0, inner.difference(NECKLINE)), L("top", 1, inner.intersection(move(NECKLINE.buffer(3), 0, 4)).difference(NECKLINE)),
                L("spot", 0, jacket), L("spot", 2, U(lapel.intersection(jacket), side.intersection(jacket)))]
        if look == "leather":
            shine = U(brush([(70, 122), (66, 150), (65, 180)], 6.0, (.2, .2)), brush([(129, 124), (132, 150)], 4.4, (.2, .2)),
                      brush([(115.6, 112), (113.6, 146)], 3.4, (.2, .2)), brush([(84.6, 112), (86.6, 146)], 3.4, (.2, .2)))
            zip_ = brush([(111.2, 120), (110.6, 190), (110.2, 262)], .9, (1, 1))
            pocket = both(brush([(122, 196), (136, 190)], 1.4, (1, 1)))
            out += [L("spot", 1, shine.intersection(jacket)), L("line", 0, U(outline(jacket, LW, .6), outline(lapel, .8, .3), pocket)),
                    L("paper", 0, U(zip_, both(Point(124, 182).buffer(1.3)))), L("paper", 0, both(U(Point(121.6, 108.6).buffer(1.1), Point(66, 116).buffer(1.1))))]
        else:
            trim = U(outline(lapel, 2.2, 0).intersection(jacket.buffer(1)), both(brush([(110.2, 160), (110, 262)], 1.6, (1, 1))))
            studs = both(U(*[Point(x, y).buffer(1.5) for x, y in [(130, 109.6), (136, 112.6), (141.4, 116.6), (123.6, 107.2)]]))
            out += [L("line", 0, U(outline(jacket, LW, .6), outline(lapel, .8, .3))), L("amber", 0, U(trim, studs)),
                    L("spot", 1, U(brush([(70, 122), (66, 150), (65, 180)], 5.0, (.2, .2)), brush([(130, 124), (133, 148)], 3.8, (.2, .2))).intersection(jacket))]
    if look in ("tee", "vest", "flannel"):
        out += [L("line", 0, outline(TORSO, LW, .6))]
    return [l for l in out if l]

# ---------------------------------------------------------------- arms and hands
HK = 1.7      # hands are drawn small and scaled up by this round the wrist (the fretting hand round the neck)
NU = np.array([.7431, -.6691]); NN = np.array([.6691, .7431])     # along the guitar neck (toward the head) and across it
def gpt(ly):
    """a point on the guitar's centre line, from its picture's own y (guitarist.js: translate(6 -14) rotate(48 84 196))"""
    return np.array([84 - .7431 * (ly - 196) + 6, 196 + .6691 * (ly - 196) - 14])
FRET = gpt(104)          # where the fretting hand holds the neck
STRUM_W = np.array([77, 185])

def inset(sh, el, k=5.0):
    """the upper arm starts inside the shoulder, so its round end never pokes above the body's line"""
    sh, el = np.asarray(sh, float), np.asarray(el, float)
    d = (el - sh) / np.linalg.norm(el - sh)
    toward = np.array([100.0, sh[1] + 30]) - sh; toward /= np.linalg.norm(toward)
    return sh + toward * k + d * 1.0

def arm_shape(sh, el, wr, w=(16.4, 13.4, 12.8, 9.8)):
    up = capsule(inset(sh, el), el, w[0], w[1]); fo = capsule(el, wr, w[2], w[3])
    return up, fo

def sleeve_of(sh, el, wr, length, w=(16.4, 13.4, 12.8, 9.8), extra=2.6):
    sh, el, wr = map(np.asarray, (sh, el, wr))
    if length == "short":
        e = sh + (el - sh) * .52
        g = capsule(inset(sh, el, 6.5), e, w[0] + extra, w[0] + extra - 1.2)
        cut = np.asarray(e); d = (el - sh) / np.linalg.norm(el - sh); n = np.array([-d[1], d[0]])
        g = g.difference(poly([cut + n * 20, cut + n * 20 + d * 30, cut - n * 20 + d * 30, cut - n * 20]))   # a straight hem
        return g, e
    e = wr + (el - wr) * .14
    return U(capsule(inset(sh, el, 6.5), el, w[0] + extra, w[1] + extra), capsule(el, e, w[2] + extra, w[3] + extra + .6)), e

def hand_rest(wr, s):
    """a relaxed hand hanging at the side; s = +1 the viewer's right (thumb toward the body, at -x)"""
    x, y = wr
    X = lambda dx: x + s * dx
    palm = blob([(X(-4.6), y - 1), (X(4.4), y - 1.2), (X(5.4), y + 6), (X(4.6), y + 12.6), (X(1.6), y + 15.4), (X(-2.6), y + 14.6), (X(-4.4), y + 9)])
    thumb = brush([(X(-3.6), y + 2), (X(-6.2), y + 6.4), (X(-5.8), y + 10.2)], [3.4, 3.0, 2.4], (1, .7))
    lines = U(brush([(X(-1.4), y + 9.6), (X(-.8), y + 14.4)], .5, (.2, .3)), brush([(X(1.6), y + 9.2), (X(2.2), y + 13.8)], .5, (.2, .3)),
              brush([(X(-3), y + 7.4), (X(-.6), y + 8.6), (X(2.6), y + 8.2), (X(4.6), y + 7)], .45, (.2, .2)))
    g = U(palm, thumb)
    return g, U(crescent(g, -s * 2.4, -.6)), lines

def hand_strum(wr):
    """the strumming hand over the strings: knuckles toward you, fingers curled under, the pick between thumb and first finger"""
    x, y = wr
    back = blob([(x - 1, y - 4.2), (x + 6.6, y - 4.4), (x + 11, y - 1.8), (x + 11.6, y + 3.2), (x + 8, y + 4.8), (x + 1.4, y + 4.4), (x - 1.2, y + .4)])
    fingers = []
    for k in range(4):
        kx, ky = x + 10.4 - k * 2.75, y + 3.4 + k * .35
        fingers.append(brush([(kx, ky), (kx + .9, ky + 3.0), (kx - .5, ky + 5.2)], [2.7, 2.5, 2.2], (1, .85)))
    thumb = brush([(x + 3.6, y - 3.4), (x + 8.6, y - 2.8), (x + 12.4, y + .4)], [3.4, 3.0, 2.5], (1, .8))
    g = U(back, *fingers, thumb)
    pick = poly([(x + 11.4, y + 1.2), (x + 15.4, y + 3.6), (x + 11.8, y + 5.2)]).buffer(.4)
    lines = U(*[outline(f, .55, .2) for f in fingers], outline(thumb, .6, .2).intersection(back),
              brush([(x + 2.6, y + 1.6), (x + 6, y + 2.6), (x + 9.6, y + 2.2)], .4, (.2, .2)))
    return g, crescent(g, -2.2, -2.2), lines, pick

def hand_fret():
    P = FRET
    wr = P + 12.8 * NN
    back = blob([wr + 4.6 * NU, wr - 4.2 * NU, P + 5.8 * NN - 8.2 * NU, P + 3.8 * NN - 8.6 * NU, P + 4.0 * NN + 6.8 * NU, P + 6 * NN + 7 * NU])
    fingers, gaps = [], []
    for k, ln in zip([-5.9, -2.0, 1.9, 5.6], [6.0, 6.6, 6.4, 5.4]):
        B = P + k * NU + 4.4 * NN
        Mk = P + (k + .3) * NU + .4 * NN
        T = P + (k + .9) * NU + (4.4 - ln) * NN
        fingers.append(brush([B, Mk, T], [3.3, 3.0, 2.7], (1, .82)))
        gaps.append(brush([P + (k - 1.7) * NU + 4.6 * NN, P + (k - 1.5) * NU + 1.4 * NN], .45, (.3, .5)))
    thumb = brush([P - 2.6 * NN + 2.6 * NU, P - 3.6 * NN + 1.4 * NU, P - 3.9 * NN - .2 * NU], [3.0, 2.8, 2.5], (1, .8))
    g = U(back, *fingers)
    return g, U(crescent(back, -1.6, -2.4)), U(*gaps), thumb

def hand_horns(wr, s):
    """rock horns, the back of the hand toward you: index and little finger up, the thumb over the other two. s = -1 the viewer's left"""
    x, y = wr
    X = lambda dx: x + s * dx
    fist = blob([(X(-5.6), y - 2), (X(5.6), y - 2), (X(6.4), y - 9), (X(4.6), y - 13.6), (X(-4.6), y - 13.8), (X(-6.2), y - 8)])
    index = brush([(X(-3.6), y - 12), (X(-4.4), y - 18), (X(-5.2), y - 24.6)], [3.2, 3.0, 2.7], (1, .85))
    pinky = brush([(X(3.8), y - 12), (X(4.6), y - 16.6), (X(5.2), y - 20.6)], [2.8, 2.6, 2.3], (1, .85))
    curled = U(Point((X(-1.2), y - 13.4)).buffer(1.9), Point((X(1.6), y - 13.2)).buffer(1.8))
    thumb = brush([(X(-5.8), y - 6.6), (X(-2), y - 10.2), (X(2.6), y - 10.6)], [3.0, 2.8, 2.4], (1, .8))
    g = U(fist, index, pinky, curled)
    lines = U(brush([(X(-1.0), y - 11.6), (X(-1.6), y - 7.4)], .45, (.3, .3)), brush([(X(1.8), y - 11.6), (X(2.2), y - 7.6)], .45, (.3, .3)))
    return g, crescent(g, s * -2.2, -1), lines, thumb

POSES = {
    "play":    {"R": (SH_L, (34, 178), STRUM_W), "L": (SH_R, (172.6, 181), FRET + 12.8 * HK * NN)},
    "rest":    {"R": (SH_L, (42.4, 188), (50, 232)), "L": (SH_R, (157.6, 188), (150, 232))},
    "hornsUp": {"R": (SH_L, (21, 90), (12.4, 46)), "L": (SH_R, (179, 90), (187.6, 46))},
}
SLEEVE = {"tee": "short", "vest": "short", "flannel": "long", "leather": "long", "stage": "long"}
SLEEVE_INK = {"tee": "top", "vest": "top", "flannel": "top", "leather": "spot", "stage": "spot"}

def shoulder_merge(g, sh):
    """drop the part of an outline that runs inside the shoulder, so the arm grows out of the body"""
    return g.difference(TORSO.buffer(-1.0).intersection(Point(sh).buffer(15)))

def pose_arms(pose):
    """skin arms and hands for a pose: [(side, layers)]"""
    out = []
    for side in ("R", "L"):
        sh, el, wr = POSES[pose][side]
        up, fo = arm_shape(sh, el, wr)
        arm = U(up, fo)
        s = -1 if side == "R" else 1
        ls = [L("skin", 0, arm), L("skin", 1, crescent(arm, -s * 3.4, -1.2).union(crescent(fo, -2, -2.4).intersection(fo))), L("line", 0, shoulder_merge(outline(arm, LW, .5), sh))]
        K = lambda *gs: [affinity.scale(g, HK, HK, origin=tuple(wr)) for g in gs]
        if pose == "rest":
            g, sd, ln = K(*hand_rest(wr, s))
            ls += [L("skin", 0, g), L("skin", 1, sd), L("line", 0, U(outline(g, 1.0, .4), ln))]
        elif pose == "hornsUp":
            g, sd, ln, th = K(*hand_horns(wr, s))
            ls += [L("skin", 0, g), L("skin", 1, sd), L("line", 0, U(outline(g, 1.0, .4), ln)), L("skin", 0, th), L("line", 0, outline(th, .9, .3))]
        elif side == "R":
            g, sd, ln, pick = K(*hand_strum(wr))
            ls += [L("skin", 0, g), L("skin", 1, sd), L("line", 0, U(outline(g, 1.0, .4), ln)), L("amber", 0, pick), L("line", 0, outline(pick, .6, .2))]
        else:
            g, sd, ln, th = [affinity.scale(x, HK, HK, origin=tuple(FRET)) for x in hand_fret()]
            ls += [L("skin", 0, th), L("line", 0, outline(th, .9, .3)), L("skin", 0, g), L("skin", 1, sd), L("line", 0, U(outline(g, 1.0, .4), ln))]
        out += ls
    return [l for l in out if l]

def pose_sleeves(pose, look):
    out = []
    ink = SLEEVE_INK[look]
    for side in ("R", "L"):
        sh, el, wr = POSES[pose][side]
        s = -1 if side == "R" else 1
        g, end = sleeve_of(sh, el, wr, SLEEVE[look])
        sd = crescent(g, -s * 3.6, -1.4)
        out += [L(ink, 0, g), L(ink, 1 if ink == "top" else 2, sd)]
        if look == "flannel":
            out += [L("top", 2, U(*[brush([sh + (el - np.array(sh)) * t + np.array([-12, 0]), sh + (el - np.array(sh)) * t + np.array([12, 0])], 2.6, (1, 1)) for t in (.3, .7)]).intersection(g))]
            cuff = Point(end).buffer(7.4).intersection(g)
            out += [L("top", 2, cuff.difference(Point(end).buffer(4.6)))]
        if look == "leather":
            out += [L("spot", 1, brush([np.asarray(sh) + (np.asarray(el) - sh) * .2 + [-s * 3, 0], np.asarray(sh) + (np.asarray(el) - sh) * .8 + [-s * 3, 0]], 4.6, (.2, .2)).intersection(g))]
        if look == "stage":
            out += [L("amber", 0, Point(end).buffer(6.2).intersection(g).difference(Point(end).buffer(4.6)))]
        hem = outline(g, LW, .5)
        out += [L("line", 0, shoulder_merge(hem, sh))]
    return [l for l in out if l]

# ---------------------------------------------------------------- write
def conv(ls):
    out = []
    for l in ls:
        if not l: continue
        ink, tone, g = l
        d = svgpath(g)
        if d: out.append([ink, tone, d])
    return out

def build():
    hb = head_base()
    A = {"neck": conv(hb["neck"]), "head": conv(hb["head"]),
         "faces": {m: conv(face(m)) for m in ["happy", "cheer", "proud", "sleepy", "worried"]},
         "looks": {l: conv(torso_look(l)) for l in ["tee", "flannel", "vest", "leather", "stage"]},
         "arms": {p: conv(pose_arms(p)) for p in POSES},
         "sleeves": {p: {l: conv(pose_sleeves(p, l)) for l in SLEEVE} for p in POSES}}
    for k, f in EXTRA_BUILDERS: A[k] = f()
    burst = []
    for i in range(24):
        a = np.pi * 2 * i / 24 - np.pi / 2; r = 25 if i % 2 == 0 else 9.5
        burst.append((150 + r * np.cos(a), 44 + r * np.sin(a)))
    A.update({
        "inks": {"paper": "#F6EEE0", "line": "#1B1714", "amber": "#FFB547"},
        "spot": {"tee": "#FFB547", "flannel": "#FFB547", "vest": "#46689E", "leather": "#2A2522", "stage": "#1E1A18"},
        "sleeveInk": SLEEVE_INK,
        "frame": {"full": "16 0 168 252", "hornsUp": "-4 0 208 252", "bust": "30 14 140 150"},
        "guitar": {"transform": "translate(6 -14) rotate(48 84 196)", "box": 'x="36" y="40" width="96" height="212"', "fret": [round(float(v), 1) for v in FRET], "strum": [round(float(v), 1) for v in STRUM_W]},
        "print": {"misregister": [.45, .3], "halftone": {"cell": 2.6, "dot": .82, "angle": 22}, "stipple": {"cell": 1.3, "dot": .36, "angle": 67, "opacity": .75}, "grain": {"file": "guitarist-poster/grain.webp", "tile": 64}},
        "bust": {"disc": [100, 89, 70], "transform": "translate(-38 5.34) scale(1.38)", "flatStroke": .8},
        "card": {"burst": svgpath(poly(burst))},
    })
    return A

EXTRA_BUILDERS = []

def write(A):
    out = os.path.join(ROOT, "art", "guitarist-poster.js")
    head = open(os.path.join(os.path.dirname(__file__), "poster_header.txt")).read() if os.path.exists(os.path.join(os.path.dirname(__file__), "poster_header.txt")) else "/* Gig poster guitarist: see art/guitarist-poster/README.md. Made by tools/guitarist/poster_art.py; do not edit by hand. */\n"
    js = head + "export default " + json.dumps(A, separators=(",", ":")) + ";\n"
    open(out, "w").write(js)
    print("art/guitarist-poster.js", len(js) // 1000, "KB")
    for k, v in A.items(): print(" ", k, len(json.dumps(v)) // 1000, "KB")

if __name__ == "__main__":
    import poster_hair   # hair, beards, glasses, hats: registers into poster_art.EXTRA_BUILDERS
    import poster_art
    poster_art.write(poster_art.build())
