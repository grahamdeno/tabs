# Geometry helpers for the Gig poster guitarist (tools/guitarist/poster_art.py).
# Shapes are shapely geometries in the guitarist's own units (the same frame as guitarist.js: x 0-200, y 0-252).
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, Point, LineString, GeometryCollection
from shapely.ops import unary_union
from shapely import affinity

def _cr(P, closed, n):
    P = np.asarray(P, float)
    if closed: Q = np.vstack([P[-1:], P, P[:2]])
    else: Q = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = []
    for i in range(1, len(Q) - 2):
        p0, p1, p2, p3 = Q[i - 1], Q[i], Q[i + 1], Q[i + 2]
        # centripetal-ish: plain Catmull-Rom is fine at these scales
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed: out.append(P[-1])
    return np.array(out)

def spline(P, closed=False, n=14):
    return _cr(P, closed, n)

def blob(P, n=14):
    """a closed smooth shape through the points"""
    g = Polygon(_cr(P, True, n))
    return g if g.is_valid else g.buffer(0)

def poly(P):
    return Polygon(P).buffer(0)

def brush(P, w, taper=(.15, .15), n=14):
    """a tapered ink stroke along a smooth line through P. w: one width or one per point. taper: end widths as a share of w."""
    C = _cr(P, False, n)
    m = len(C)
    if np.isscalar(w): W = np.full(m, float(w))
    else:
        ws = np.asarray(w, float); W = np.interp(np.linspace(0, len(ws) - 1, m), np.arange(len(ws)), ws)
    s = np.linspace(0, 1, m)
    a, b = taper
    f = np.ones(m)
    if a < 1: f *= np.clip(a + (1 - a) * np.sin(np.clip(s / .35, 0, 1) * np.pi / 2), 0, 1)
    if b < 1: f *= np.clip(b + (1 - b) * np.sin(np.clip((1 - s) / .35, 0, 1) * np.pi / 2), 0, 1)
    W = W * f
    d = np.gradient(C, axis=0); d /= np.linalg.norm(d, axis=1)[:, None] + 1e-9
    nrm = np.stack([-d[:, 1], d[:, 0]], 1)
    L = C + nrm * W[:, None] / 2; R = C - nrm * W[:, None] / 2
    g = Polygon(np.vstack([L, R[::-1]])).buffer(0)
    return g.union(Point(C[0]).buffer(W[0] / 2)).union(Point(C[-1]).buffer(W[-1] / 2))

def capsule(a, b, wa, wb):
    """a limb from a to b, wa wide at a and wb at b, round ends"""
    a, b = np.asarray(a, float), np.asarray(b, float)
    d = b - a; d /= np.linalg.norm(d); n = np.array([-d[1], d[0]])
    body = Polygon([a + n * wa / 2, b + n * wb / 2, b - n * wb / 2, a - n * wa / 2])
    return unary_union([body, Point(a).buffer(wa / 2), Point(b).buffer(wb / 2)])

def mirror(g, cx=100):
    return affinity.scale(g, -1, 1, origin=(cx, 0))

def both(g, cx=100):
    return unary_union([g, mirror(g, cx)])

def move(g, dx, dy):
    return affinity.translate(g, dx, dy)

def U(*gs):
    gs = [g for g in gs if g is not None and not g.is_empty]
    return unary_union(gs) if gs else Polygon()

def outline(g, w=1.2, heavy=.8, ang=(.7, .7)):
    """the ink line round a shape, heavier on the lower right (the shade side)"""
    outer = g.buffer(w / 2, join_style=1)
    inner = g.buffer(-w / 2, join_style=1)
    inner = inner.intersection(affinity.translate(inner, -heavy * ang[0], -heavy * ang[1]))
    return outer.difference(inner)

def crescent(g, dx=-5, dy=-2):
    """the part of g that a copy shifted by (dx, dy) does not cover: a shade band on the far side"""
    return g.difference(affinity.translate(g, dx, dy))

def _rings(g):
    if g.is_empty: return []
    if isinstance(g, (MultiPolygon, GeometryCollection)):
        out = []
        for x in g.geoms: out += _rings(x)
        return out
    if isinstance(g, Polygon): return [g.exterior] + list(g.interiors)
    return []

def svgpath(g, tol=.11, min_area=.3):
    """shapely geometry -> compact SVG path data (absolute, 1 decimal); use fill-rule evenodd"""
    if g.is_empty: return ""
    g = g.buffer(0)
    polys = [x for x in (g.geoms if hasattr(g, "geoms") else [g]) if isinstance(x, Polygon) and x.area >= min_area]
    out = []
    for p in polys:
        p = p.simplify(tol, preserve_topology=True)
        for r in [p.exterior] + list(p.interiors):
            c = np.round(np.asarray(r.coords)[:-1], 1)
            if len(c) < 3: continue
            keep = [c[0]]
            for q in c[1:]:
                if abs(q[0] - keep[-1][0]) > .05 or abs(q[1] - keep[-1][1]) > .05: keep.append(q)
            c = keep
            s = "M%g %g" % (c[0][0], c[0][1])
            prev = c[0]
            rel = []
            for q in c[1:]:
                dx, dy = round(q[0] - prev[0], 1), round(q[1] - prev[1], 1)
                rel.append(("%g" % dx) + ("%g" % dy if dy < 0 else " %g" % dy))
                prev = (prev[0] + dx, prev[1] + dy)
            s += "l" + " ".join(rel).replace(" -", "-") + "z"
            out.append(s)
    return "".join(out)
