"""Paint the empty Me case to match r10-06 (Grok).

A deep black hard case, open, seen from slightly above. Rounded corners, an edge
highlight, a wall and a lip all the way round, two chrome latches, a raised row of
padded orange velvet pockets across the back, and low padded ridges between the
stalls. The stall floors recede. One picture per stall count.

Writes new files only:
  art/case/case-r10-06-open-1.webp
  art/case/case-r10-06-open-2.webp
  art/case/case-r10-06-open-3.webp
  art/case/case-r10-06-open-lip-1.webp
  art/case/case-r10-06-open-lip-2.webp
  art/case/case-r10-06-open-lip-3.webp
  art/case/case-r10-06-open-layout.json

Run: python3 tools/case/paint-r10-06-open.py
"""
import json
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "art", "case")

# world: x right, y up, z toward the camera (the front of the case)
STALL = 1.0
RIDGE_W = 0.22
DEPTH = 2.02
WALL_T = 0.10
WALL_H = 0.32
CORNER = 0.12
POCKET_D = 0.46

SHELL, VELVET, RIDGE, POCKET, LIP, CHROME, PIPING = range(7)
# lip overlay keeps the parts that tuck over a guitar's edges
OVER = {RIDGE, LIP}

# camera, shared by every stall count so the cases match
EYE = np.array([0.0, 2.55, 2.85], np.float32)
TARGET = np.array([0.0, 0.08, -0.02], np.float32)
# pixels across the 3-stall case; 1 and 2 use the same scale
TARGET_W = 1680


def norm(v):
    n = np.linalg.norm(v)
    return v / n if n else v


def camera():
    forward = norm(TARGET - EYE)
    right = norm(np.cross(forward, np.array([0.0, 1.0, 0.0])))
    up = np.cross(right, forward)
    return EYE, right, up, forward


def project(p, cam, focal):
    eye, right, up, forward = cam
    d = p - eye
    z = np.dot(d, forward)
    x = np.dot(d, right)
    y = np.dot(d, up)
    return np.array([focal * x / z, focal * y / z, z], np.float32)


def rrect(hw, hd, r, segs=7):
    """Rounded rectangle in xz, clockwise from the front-left, as seen from above."""
    r = min(r, hw - 0.01, hd - 0.01)
    corners = [
        (hw - r, hd - r, 0.0),            # front-right
        (-hw + r, hd - r, np.pi / 2),     # front-left
        (-hw + r, -hd + r, np.pi),        # back-left
        (hw - r, -hd + r, 3 * np.pi / 2)  # back-right
    ]
    pts = []
    for cx, cz, a0 in corners:
        for i in range(segs + 1):
            a = a0 + np.pi / 2 * i / segs
            pts.append((cx + r * np.cos(a), cz + r * np.sin(a)))
    return pts


def add_quad(tris, a, b, c, d, mat, na=None, nb=None, nc=None, nd=None):
    """a-b-c-d. Normal faces the side the winding points at (a->b->c)."""
    a, b, c, d = (np.asarray(p, np.float32) for p in (a, b, c, d))
    if na is None:
        na = nb = nc = nd = face_normal(a, b, c)
    tris.append((a, b, c, np.asarray(na, np.float32), np.asarray(nb, np.float32), np.asarray(nc, np.float32), mat))
    tris.append((a, c, d, np.asarray(na, np.float32), np.asarray(nc, np.float32), np.asarray(nd, np.float32), mat))


def add_box(tris, x0, y0, z0, x1, y1, z1, mat):
    p = lambda x, y, z: np.array([x, y, z], np.float32)
    # outward faces
    add_quad(tris, p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), mat)  # +z
    add_quad(tris, p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), mat)  # -z
    add_quad(tris, p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), mat)  # -x
    add_quad(tris, p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), mat)  # +x
    add_quad(tris, p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), mat)  # +y
    add_quad(tris, p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), mat)  # -y


def add_grid(tris, xyz, mat):
    """xyz is (nz, nx, 3) with normals implied by the surface, facing roughly up."""
    add_grid_masked(tris, xyz, None, mat)


def grid_normals(xyz):
    dz = np.zeros_like(xyz)
    dx = np.zeros_like(xyz)
    dz[1:-1] = xyz[2:] - xyz[:-2]
    dz[0] = xyz[1] - xyz[0]
    dz[-1] = xyz[-1] - xyz[-2]
    dx[:, 1:-1] = xyz[:, 2:] - xyz[:, :-2]
    dx[:, 0] = xyz[:, 1] - xyz[:, 0]
    dx[:, -1] = xyz[:, -1] - xyz[:, -2]
    n = np.cross(dz, dx)
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-8)
    n[n[..., 1] < 0] *= -1
    return n.astype(np.float32)


def add_grid_masked(tris, xyz, matmap, which):
    """Emit each quad once. matmap is per vertex; a quad belongs to the material at its first corner."""
    nrm = grid_normals(xyz)
    nz, nx, _ = xyz.shape
    for j in range(nz - 1):
        for i in range(nx - 1):
            if matmap is not None and matmap[j, i] != which:
                continue
            add_quad(tris, xyz[j, i], xyz[j, i + 1], xyz[j + 1, i + 1], xyz[j + 1, i], which,
                     nrm[j, i], nrm[j, i + 1], nrm[j + 1, i + 1], nrm[j + 1, i])


def smooth(edge, radius):
    t = np.clip(edge / radius, 0, 1)
    return t * t * (3 - 2 * t)


def build(n):
    """Triangles, plus the stall hollows in world xz (back-left, back-right, front-right, front-left)."""
    tris = []
    inner_w = n * STALL
    hw = inner_w / 2
    hd = DEPTH / 2
    ohw = hw + WALL_T
    ohd = hd + WALL_T
    z_back, z_front = -hd, hd

    # outer shell: top lip between the two rounded rects, outer vertical face, inner velvet wall
    outer = rrect(ohw, ohd, CORNER + WALL_T * 0.3)
    inner = rrect(hw, hd, CORNER * 0.55)
    # match counts
    if len(outer) != len(inner):
        raise SystemExit(f"outline mismatch {len(outer)} {len(inner)}")
    m = len(outer)
    for i in range(m):
        j = (i + 1) % m
        o0 = np.array([outer[i][0], WALL_H, outer[i][1]], np.float32)
        o1 = np.array([outer[j][0], WALL_H, outer[j][1]], np.float32)
        i0 = np.array([inner[i][0], WALL_H, inner[i][1]], np.float32)
        i1 = np.array([inner[j][0], WALL_H, inner[j][1]], np.float32)
        # top of the lip, black
        add_quad(tris, o0, o1, i1, i0, SHELL)
        # a thin bright piping on the outer top edge
        lift = 0.012
        p0 = o0 + np.array([0, lift, 0], np.float32)
        p1 = o1 + np.array([0, lift, 0], np.float32)
        inset = 0.018
        # pull the inner edge of the piping toward the centre a touch
        mid = np.array([0, WALL_H + lift, 0], np.float32)
        def pull(p):
            v = p - mid
            v = v / (np.linalg.norm(v) + 1e-6) * inset
            return p - np.array([v[0], 0, v[2]], np.float32)
        add_quad(tris, p0, p1, pull(p1), pull(p0), PIPING)
        # outer vertical face
        ob0 = np.array([outer[i][0], 0.0, outer[i][1]], np.float32)
        ob1 = np.array([outer[j][0], 0.0, outer[j][1]], np.float32)
        add_quad(tris, ob0, ob1, o1, o0, SHELL)
        # inner velvet wall, from the floor up to the lip. Normal faces into the case.
        ib0 = np.array([inner[i][0], 0.0, inner[i][1]], np.float32)
        ib1 = np.array([inner[j][0], 0.0, inner[j][1]], np.float32)
        add_quad(tris, i0, i1, ib1, ib0, VELVET)
        # rounded inner lip: a small bevel that rolls over the guitar's edge
        bevel = 0.035
        b0 = np.array([inner[i][0], WALL_H - bevel, inner[i][1]], np.float32)
        b1 = np.array([inner[j][0], WALL_H - bevel, inner[j][1]], np.float32)
        # move the lower lip edge inward
        def inn(p, amt=0.02):
            v = np.array([p[0], 0, p[2]], np.float32)
            ln = np.linalg.norm(v) + 1e-6
            return p - np.array([p[0], 0, p[2]], np.float32) / ln * amt
        add_quad(tris, i0, i1, inn(b1), inn(b0), LIP)

    # one velvet surface for the whole interior, so the floor, the pockets and the
    # ridges meet. Nothing shows through as a gap.
    hollows = []
    nx, nz = 48 * n, 84
    xs = np.linspace(-hw + 0.012, hw - 0.012, nx)
    zs = np.linspace(z_back + 0.012, z_front - 0.012, nz)
    X, Z = np.meshgrid(xs, zs)
    dx = hw - np.abs(X)
    dzb = Z - z_back
    dzf = z_front - Z
    edge = np.minimum(np.minimum(dx, dzb), dzf)
    roll = 0.055 * (1 - smooth(edge, 0.10))
    # each stall sinks in the middle, so the floor recedes into a hollow
    sink = np.zeros_like(X)
    pocket = np.zeros_like(X)
    ridge = np.zeros_like(X)
    mat = np.full(X.shape, VELVET, np.int8)
    for s in range(n):
        x0 = -hw + s * STALL
        x1 = x0 + STALL
        # a stuffed pocket across the back of the stall: a dome with a mouth, proud of the floor
        px0 = x0 + (0.04 if s == 0 else RIDGE_W * 0.48)
        px1 = x1 - (0.04 if s == n - 1 else RIDGE_W * 0.48)
        pz0 = z_back + 0.05
        pz1 = z_back + POCKET_D
        u = (X - px0) / (px1 - px0 + 1e-6)
        v = (Z - pz0) / (pz1 - pz0 + 1e-6)
        dome = np.sqrt(np.clip(1 - ((u - 0.5) / 0.58) ** 2 - ((v - 0.46) / 0.58) ** 2, 0, 1))
        groove = np.exp(-((v - 0.70) / 0.09) ** 2)
        h = 0.17 * dome - 0.09 * groove * dome
        inside = (dome > 0.02)
        pocket = np.where(inside, np.maximum(pocket, h), pocket)
        mat = np.where(inside & (h > 0.04), POCKET, mat)
        # the body of the stall, in front of the pocket, sinks a little
        su = (X - x0) / STALL
        side = np.minimum(su, 1 - su)
        body = (su > 0) & (su < 1) & (Z > pz1 - 0.02)
        sink = np.where(body, np.maximum(sink, 0.016 * smooth(side * 2.4, 0.3) * smooth(dzf, 0.16)), sink)
        if s < n - 1:
            d = np.abs(X - x1) / (RIDGE_W * 0.58)
            arch = np.sqrt(np.clip(1 - d * d, 0, 1))
            # the ridge starts at the pocket's front lip and stops short of the front lip
            along = smooth(Z - (pz1 - 0.04), 0.05) * smooth((z_front - 0.20) - Z, 0.08)
            ridge = np.maximum(ridge, 0.10 * arch * along)
            mat = np.where((arch * along > 0.55) & (Z > pz1 - 0.08), RIDGE, mat)
        # the guitar lies in the hollow. Its headstock tucks under the pocket's front lip.
        gx0 = x0 + (0.07 if s == 0 else RIDGE_W * 0.48)
        gx1 = x1 - (0.11 if s == n - 1 else RIDGE_W * 0.48)
        gz0 = pz1 - 0.16
        gz1 = z_front - 0.12
        hollows.append(((gx0, gz0), (gx1, gz0), (gx1, gz1), (gx0, gz1)))
    Y = np.maximum(roll, np.maximum(pocket, ridge)) - sink
    Y = np.clip(Y, 0.004, None).astype(np.float32)
    # split the surface by material so the lip overlay can lift the ridges and the pocket mouths
    for which in (VELVET, POCKET, RIDGE):
        sel = mat == which
        if not sel.any():
            continue
        # keep the full grid so neighbours stay connected, but only emit tris whose
        # centre is this material. Shared edges still meet.
        add_grid_masked(tris, np.stack([X, Y, Z], -1), mat, which)

    # two chrome latches on the front edge, big enough to read on a phone
    for xc in (-ohw * 0.40, ohw * 0.40):
        w, h, d = 0.38, 0.09, 0.022
        y0 = WALL_H * 0.28
        z0 = ohd - 0.002
        add_box(tris, xc - w / 2, y0, z0, xc + w / 2, y0 + h, z0 + d, CHROME)
        add_box(tris, xc - w * 0.26, y0 + h * 0.22, z0 + d * 0.45, xc + w * 0.26, y0 + h * 0.78, z0 + d + 0.014, CHROME)
        for rx in (-w * 0.38, w * 0.38):
            add_box(tris, xc + rx - 0.016, y0 + h * 0.34, z0 + d * 0.35, xc + rx + 0.016, y0 + h * 0.66, z0 + d + 0.01, CHROME)

    return tris, hollows


def face_normal(a, b, c):
    n = np.cross(b - a, c - a)
    ln = np.linalg.norm(n)
    return n / ln if ln > 1e-8 else np.array([0, 1, 0], np.float32)


def raster(tris, cam, focal, origin, size, mats):
    W, H = size
    ox, oy = origin
    zbuf = np.full((H, W), np.inf, np.float32)
    nbuf = np.zeros((H, W, 3), np.float32)
    pbuf = np.zeros((H, W, 3), np.float32)
    mbuf = np.full((H, W), -1, np.int8)
    eye = cam[0]
    for a, b, c, na, nb, nc, mat in tris:
        if mat not in mats:
            continue
        sa, sb, sc = project(a, cam, focal), project(b, cam, focal), project(c, cam, focal)
        if min(sa[2], sb[2], sc[2]) < 0.15:
            continue
        pts = np.stack([sa, sb, sc])
        pts[:, 0] = pts[:, 0] - ox
        pts[:, 1] = oy - pts[:, 1]  # screen y grows downward; project y grows up
        area = (pts[1, 0] - pts[0, 0]) * (pts[2, 1] - pts[0, 1]) - (pts[2, 0] - pts[0, 0]) * (pts[1, 1] - pts[0, 1])
        if abs(area) < 0.8:
            continue
        # keep the winding that matches the stored order for the normal; barycentric just needs a sign
        if area < 0:
            pts = pts[[0, 2, 1]]
            world = [a, c, b]
            norms = [na, nc, nb]
            area = -area
        else:
            world = [a, b, c]
            norms = [na, nb, nc]
        n = face_normal(*world)
        # two sided: face the camera
        mid = (world[0] + world[1] + world[2]) / 3
        if np.dot(n, eye - mid) < 0:
            norms = [-v for v in norms]
        minx = max(int(np.floor(pts[:, 0].min())), 0)
        maxx = min(int(np.ceil(pts[:, 0].max())) + 1, W)
        miny = max(int(np.floor(pts[:, 1].min())), 0)
        maxy = min(int(np.ceil(pts[:, 1].max())) + 1, H)
        if minx >= maxx or miny >= maxy:
            continue
        xs = np.arange(minx, maxx, dtype=np.float32) + 0.5
        ys = np.arange(miny, maxy, dtype=np.float32) + 0.5
        X, Y = np.meshgrid(xs, ys)
        def edge(p, q):
            return (q[0] - p[0]) * (Y - p[1]) - (q[1] - p[1]) * (X - p[0])
        w0 = edge(pts[1], pts[2]) / area
        w1 = edge(pts[2], pts[0]) / area
        w2 = edge(pts[0], pts[1]) / area
        mask = (w0 >= -0.001) & (w1 >= -0.001) & (w2 >= -0.001)
        if not mask.any():
            continue
        z = w0 * pts[0, 2] + w1 * pts[1, 2] + w2 * pts[2, 2]
        closer = mask & (z < zbuf[miny:maxy, minx:maxx])
        if not closer.any():
            continue
        # perspective-correct position
        inv = w0 / pts[0, 2] + w1 / pts[1, 2] + w2 / pts[2, 2]
        b0 = (w0 / pts[0, 2]) / inv
        b1 = (w1 / pts[1, 2]) / inv
        b2 = (w2 / pts[2, 2]) / inv
        pos = b0[..., None] * world[0] + b1[..., None] * world[1] + b2[..., None] * world[2]
        nrm = b0[..., None] * norms[0] + b1[..., None] * norms[1] + b2[..., None] * norms[2]
        sl = zbuf[miny:maxy, minx:maxx]
        sl[closer] = z[closer]
        nb = nbuf[miny:maxy, minx:maxx]
        nb[closer] = nrm[closer]
        pb = pbuf[miny:maxy, minx:maxx]
        pb[closer] = pos[closer]
        mb = mbuf[miny:maxy, minx:maxx]
        mb[closer] = mat
    return mbuf, nbuf, pbuf


def velvet_textures():
    rng = np.random.default_rng(1106)
    S = 1024
    fine = rng.random((S, S)).astype(np.float32)
    fine = np.asarray(Image.fromarray((fine * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.35)), np.float32) / 255
    def blob(scale, seed):
        r = np.random.default_rng(seed)
        small = r.random((S // scale + 2, S // scale + 2)).astype(np.float32)
        im = Image.fromarray((small * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)
        return np.asarray(im, np.float32) / 255
    crush = 0.55 * blob(18, 4) + 0.45 * blob(7, 9)
    return fine, crush


FINE, CRUSH = velvet_textures()


def sample_tex(tex, x, y, z, scale):
    """Velvet pile. y is in the sample so a vertical wall is not a stripe."""
    S = tex.shape[0]
    u = np.mod(x * scale + y * scale * 1.35 + 20, S - 1).astype(np.float32)
    v = np.mod((z + 4) * scale + y * scale * 0.85, S - 1).astype(np.float32)
    u0 = np.floor(u).astype(np.int32)
    v0 = np.floor(v).astype(np.int32)
    uf = u - u0
    vf = v - v0
    return (tex[v0, u0] * (1 - uf) + tex[v0, (u0 + 1) % S] * uf) * (1 - vf) + (tex[(v0 + 1) % S, u0] * (1 - uf) + tex[(v0 + 1) % S, (u0 + 1) % S] * uf) * vf


def shade(mbuf, nbuf, pbuf, cam):
    H, W = mbuf.shape
    eye = cam[0]
    rgb = np.zeros((H, W, 3), np.float32)
    alpha = np.zeros((H, W), np.float32)
    present = mbuf >= 0
    if not present.any():
        return rgb, alpha
    P = pbuf
    N = nbuf.copy()
    # velvet nap: the pile and the crush move the normal
    vel = np.isin(mbuf, (VELVET, RIDGE, POCKET, LIP)) & present
    if vel.any():
        x = P[..., 0]
        y = P[..., 1]
        z = P[..., 2]
        pile = sample_tex(FINE, x, y, z, 180)
        crush = sample_tex(CRUSH, x, y, z, 70)
        px = sample_tex(FINE, x + 0.006, y, z, 180) - sample_tex(FINE, x - 0.006, y, z, 180)
        pz = sample_tex(FINE, x, y, z + 0.006, 180) - sample_tex(FINE, x, y, z - 0.006, 180)
        cx = sample_tex(CRUSH, x + 0.03, y, z, 70) - sample_tex(CRUSH, x - 0.03, y, z, 70)
        cz = sample_tex(CRUSH, x, y, z + 0.03, 70) - sample_tex(CRUSH, x, y, z - 0.03, 70)
        bump = np.stack([-px * 1.15 - cx * 0.55, np.zeros_like(px), -pz * 1.15 - cz * 0.55], -1)
        N = np.where(vel[..., None], N + bump, N)
    ln = np.linalg.norm(N, axis=-1, keepdims=True)
    N = N / np.maximum(ln, 1e-6)
    V = eye - P
    V = V / np.maximum(np.linalg.norm(V, axis=-1, keepdims=True), 1e-6)
    L = np.array([-0.18, 0.78, 0.55], np.float32)
    L = L / np.linalg.norm(L)
    L2 = np.array([0.35, 0.25, 0.75], np.float32)
    L2 = L2 / np.linalg.norm(L2)
    ndotl = np.clip((N * L).sum(-1), 0, 1)
    ndotl2 = np.clip((N * L2).sum(-1), 0, 1)
    wrap = np.clip((ndotl + 0.45) / 1.45, 0, 1)
    Hdir = L + V
    Hdir = Hdir / np.maximum(np.linalg.norm(Hdir, axis=-1, keepdims=True), 1e-6)
    ndoth = np.clip((N * Hdir).sum(-1), 0, 1)
    ndotv = np.clip((N * V).sum(-1), 0, 1)
    x = P[..., 0]
    z = P[..., 2]
    pile = sample_tex(FINE, x, P[..., 1], z, 180)
    crush = sample_tex(CRUSH, x, P[..., 1], z, 70)

    # orange velvet. The numbers come from the agreed picture: a deep orange, gold where it turns.
    lo = np.array([118, 40, 8], np.float32)
    mid = np.array([198, 90, 24], np.float32)
    hi = np.array([244, 164, 72], np.float32)
    t = np.clip(0.28 + 0.46 * wrap + 0.16 * ndotl2 + 0.42 * (crush - 0.5) + 0.55 * (pile - 0.5), 0, 1)
    vel_col = np.where(t[..., None] < 0.55, lo + (mid - lo) * (t / 0.55)[..., None], mid + (hi - mid) * ((t - 0.55) / 0.45)[..., None])
    sheen = np.clip(ndoth - 0.82, 0, 1) * (90 + 70 * pile)
    vel_col = vel_col + sheen[..., None] * np.array([1.0, 0.75, 0.42], np.float32)
    # pockets catch a little more light on top, and the mouth stays darker
    pocket = mbuf == POCKET
    vel_col = np.where(pocket[..., None], vel_col * (0.92 + 0.22 * ndotl[..., None]) + 8 * ndotl[..., None], vel_col)
    # ridges: the top of the arch is lighter, the foot is in shadow
    ridge = mbuf == RIDGE
    vel_col = np.where(ridge[..., None], vel_col * (0.78 + 0.40 * ndotl[..., None]), vel_col)

    # crevice darkening on the floor, next to a wall or a ridge, and the pocket's shadow
    floor = mbuf == VELVET
    crevice = np.clip((0.02 - P[..., 1]) / 0.02, 0, 1)
    z_front_pocket = -DEPTH / 2 + 0.05 + POCKET_D
    ahead = P[..., 2] - z_front_pocket
    drop = np.exp(-((ahead / 0.10) ** 2)) * (ahead > -0.01) * (ahead < 0.22)
    vel_col = np.where(floor[..., None], vel_col * (1 - 0.22 * crevice[..., None]) * (1 - 0.38 * drop[..., None]), vel_col)

    # black shell
    fres = (1 - ndotv) ** 2.2
    shell_col = np.array([12, 12, 14], np.float32) * (0.55 + 0.9 * ndotl)[..., None]
    shell_col = shell_col + fres[..., None] * np.array([46, 46, 50], np.float32)
    shell_col = shell_col + (ndoth ** 40)[..., None] * np.array([30, 30, 34], np.float32)

    # chrome
    chrome = np.array([150, 154, 160], np.float32) * (0.25 + 0.85 * ndotl)[..., None]
    chrome = chrome + (ndoth ** 28)[..., None] * np.array([210, 214, 220], np.float32)
    chrome = chrome + fres[..., None] * np.array([40, 42, 48], np.float32)
    # a soft horizontal brush
    brush = 0.86 + 0.14 * np.sin(P[..., 1] * 520)
    chrome = chrome * brush[..., None]

    piping = np.array([214, 216, 220], np.float32) * (0.55 + 0.6 * ndotl)[..., None] + (ndoth ** 16)[..., None] * 80

    rgb = np.where((mbuf == SHELL)[..., None], shell_col, rgb)
    rgb = np.where(vel[..., None], vel_col, rgb)
    rgb = np.where((mbuf == CHROME)[..., None], chrome, rgb)
    rgb = np.where((mbuf == PIPING)[..., None], piping, rgb)
    alpha = present.astype(np.float32)

    # a bright edge along the shell's outline, so the case reads as hard and finished
    shell = mbuf == SHELL
    neigh = shell.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neigh = neigh & np.roll(np.roll(shell, dy, 0), dx, 1)
    edge = shell & ~neigh
    rgb[edge] = np.array([228, 230, 234], np.float32)
    # a warm line where the velvet meets the lip
    lip = mbuf == LIP
    lip_edge = lip & ~np.roll(lip, 1, 0)
    rgb[lip_edge] = np.maximum(rgb[lip_edge], np.array([210, 140, 60], np.float32))

    rgb = np.clip(rgb, 0, 255)
    # keep the outside of the case transparent so the card shows at the rounded corners
    return rgb, alpha


def frame_of(tris, cam):
    """Focal length and origin so the 3-stall shell fills TARGET_W. Shared scale for 1 and 2."""
    eye, right, up, forward = cam
    pts = []
    for a, b, c, na, nb, nc, mat in tris:
        if mat == SHELL:
            pts.extend((a, b, c))
    pts = np.unique(np.stack(pts), axis=0)
    # focal is chosen after a unit projection
    rel = pts - eye
    z = rel @ forward
    x = rel @ right
    y = rel @ up
    # pick focal so the width is TARGET_W with a small margin
    # screen x = focal * x/z
    sx = x / z
    sy = y / z
    span = sx.max() - sx.min()
    focal = TARGET_W * 0.94 / span
    left = focal * sx.min()
    right_x = focal * sx.max()
    top = focal * sy.max()
    bot = focal * sy.min()
    pad_x = (right_x - left) * 0.035
    pad_y = (top - bot) * 0.045
    # origin is the top-left screen point (x right, y up) of the image
    ox = left - pad_x
    oy = top + pad_y
    W = int(np.ceil(right_x - left + 2 * pad_x))
    H = int(np.ceil(top - bot + 2 * pad_y))
    return focal, (ox, oy), (W, H)


def render_case(n, focal, origin, size, cam):
    tris, hollows = build(n)
    print(f"  {n} stalls, {len(tris)} triangles, {size[0]}x{size[1]}")
    mbuf, nbuf, pbuf = raster(tris, cam, focal, origin, size, set(range(7)))
    rgb, alpha = shade(mbuf, nbuf, pbuf, cam)
    # the case fills its picture. Corners outside the shell stay the shell's black,
    # and the element rounds them off.
    # corners outside the shell stay clear, so the case sits on a light or a dark card
    rgba = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, "RGBA")
    # lip overlay: ridges, the inner lip and the pocket fronts, over the guitars
    om, on, op = raster(tris, cam, focal, origin, size, OVER)
    orgb, oalpha = shade(om, on, op, cam)
    oalpha = (om >= 0).astype(np.float32)
    # soften the overlay edge by a hair so it tucks onto the guitar
    aimg = Image.fromarray((oalpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(0.6))
    oalpha = np.asarray(aimg, np.float32) / 255
    overlay = np.dstack([np.clip(orgb, 0, 255), oalpha * 255]).astype(np.uint8)
    oimg = Image.fromarray(overlay, "RGBA")
    # stall quads in image fractions (x right, y down). Order: back-left, back-right, front-right, front-left.
    ox, oy = origin
    W, H = size
    quads = []
    for hollow in hollows:
        q = []
        for x, z in hollow:
            # a point just above the floor
            p = project(np.array([x, 0.03, z], np.float32), cam, focal)
            sx = (p[0] - ox) / W
            sy = (oy - p[1]) / H
            q.append([round(float(sx), 4), round(float(sy), 4)])
        quads.append(q)
    return img, oimg, quads


def main():
    cam = camera()
    # frame from the 3-stall shell, then reuse the focal length and the top-left of that
    # frame's vertical placement. Each case is framed on its own so it fills its picture,
    # at the same focal length, so the perspective matches.
    tris3, _ = build(3)
    focal, origin3, size3 = frame_of(tris3, cam)
    print("focal", round(focal, 1), "3-stall", size3, "aspect", round(size3[0] / size3[1], 3))
    os.makedirs(OUT, exist_ok=True)
    layout = {"focal": focal, "cases": {}}
    for n in (1, 2, 3):
        tris, _ = build(n)
        # own frame at the shared focal length
        eye, right, up, forward = cam
        pts = []
        for a, b, c, na, nb, nc, mat in tris:
            if mat in (SHELL, PIPING):
                pts.extend((a, b, c))
        pts = np.unique(np.stack(pts), axis=0)
        rel = pts - eye
        z = rel @ forward
        sx = focal * (rel @ right) / z
        sy = focal * (rel @ up) / z
        pad_x = (sx.max() - sx.min()) * 0.04
        pad_y = (sy.max() - sy.min()) * 0.05
        ox = float(sx.min() - pad_x)
        oy = float(sy.max() + pad_y)
        W = int(np.ceil(sx.max() - sx.min() + 2 * pad_x))
        H = int(np.ceil(sy.max() - sy.min() + 2 * pad_y))
        # make the height match the 3-stall picture so a row of cases lines up
        img, oimg, quads = render_case(n, focal, (ox, oy), (W, H), cam)
        shell_name = f"case-r10-06-open-{n}.webp"
        lip_name = f"case-r10-06-open-lip-{n}.webp"
        img.save(os.path.join(OUT, shell_name), quality=80, method=6)
        oimg.save(os.path.join(OUT, lip_name), quality=80, method=6)
        layout["cases"][str(n)] = {
            "w": W, "h": H, "aspect": round(W / H, 4),
            "file": f"art/case/{shell_name}",
            "lip": f"art/case/{lip_name}",
            "stalls": quads
        }
        print(" ", shell_name, img.size, os.path.getsize(os.path.join(OUT, shell_name)))
    layout_path = os.path.join(os.path.dirname(__file__), "r10-06-open-layout.json")
    with open(layout_path, "w") as f:
        json.dump(layout, f, indent=2)
    print("wrote", layout_path)


if __name__ == "__main__":
    main()
