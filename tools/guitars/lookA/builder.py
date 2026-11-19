"""Builder layers for the seven Road guitars, cut from the new look A road pictures. Same file names, sizes and meanings
as docs/guitars/BUILDER-ART.md; drawn at (0, 0) over -road.webp."""
import json, os, sys, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
ROOT = '/workspace/cartoon-test/full'
P = json.load(open(f'{ROOT}/pics.json'))
MAN = json.load(open(f'{ROOT}/cur-builder/manifest.json'))
CFG = json.load(open(f'{ROOT}/builder-cfg.json')) if os.path.exists(f'{ROOT}/builder-cfg.json') else {}
OUT = f'{ROOT}/builder'

def lab(rgb): return cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
def norm_blur(v, m, sig):
    num = cv2.GaussianBlur(v * m[..., None], (0, 0), sig); den = cv2.GaussianBlur(m.astype(np.float32), (0, 0), sig)[..., None]
    return num / np.maximum(den, 1e-4), den[..., 0]
def clean(mask, open_=1, min_area=60, fill_holes=40):
    m = mask.astype(np.uint8)
    if open_: m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((2*open_+1, 2*open_+1), np.uint8))
    lab_, n = ndi.label(m)
    if n:
        sz = ndi.sum(m, lab_, range(1, n+1)); m = np.isin(lab_, [i+1 for i, z in enumerate(sz) if z >= min_area]).astype(np.uint8)
    inv = 1 - m; l2, n2 = ndi.label(inv)
    if n2:
        sz = ndi.sum(inv, l2, range(1, n2+1)); small = np.isin(l2, [i+1 for i, z in enumerate(sz) if z < fill_holes]); m[small] = 1
    return m.astype(bool)

def segment(slug):
    c = CFG.get(slug, {}); r = P[slug]['road']; W, H = r['w'], r['h']
    road = np.array(Image.open(f'{ROOT}/out/{slug}-road.png').convert('RGBA'))
    rgb = road[..., :3].astype(np.float32); A = road[..., 3]
    M = np.load(f'{ROOT}/out/{slug}-masks.npz')
    body = (M['body'] > 200) & (A > 200); head = (M['head'] > 200) & (A > 200)
    board = M['board'] > 8; strings = M['strings'] > 8
    free = ~board & ~strings
    L = lab(rgb)
    hsv = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32); sat = hsv[..., 1] / 255; val = hsv[..., 2] / 255
    # the body's outline and a band just inside it (paint is what you meet coming in from the edge, past the rim)
    solid = ndi.binary_fill_holes(body)
    dist = ndi.distance_transform_edt(solid)
    R = body & free
    band = R & (dist > 4) & (dist < 22)
    # paint colour: the most common colour in the band (left and right half separately, for the split)
    cx = r['f'][0][1]; xx = np.arange(W)[None, :].repeat(H, 0)
    seed = np.zeros_like(R)
    for side in (xx < cx, xx >= cx):
        pts = L[band & side]
        if len(pts) < 50: continue
        # mode by a coarse 3D histogram
        q = np.floor(pts / 8).astype(int); keys, cnt = np.unique(q, axis=0, return_counts=True); k = keys[np.argmax(cnt)] * 8 + 4
        d = np.linalg.norm(L - k, axis=2)
        seed |= R & side & (d < c.get('seed_tol', 26))
    seed = clean(seed, 1, 200, 0)
    # a local paint colour field from the seed, then everything near it is paint (handles bursts and streaks)
    paint = seed.copy()
    for it in range(c.get('iters', 3)):
        field, den = norm_blur(L, paint.astype(np.float32), c.get('field_sigma', 14))
        d = np.linalg.norm(L - field, axis=2)
        paint = R & (den > 0.02) & (d < c.get('tol', 20))
    if c.get('close'): paint = ndi.binary_closing(paint, iterations=c['close']) & R
    paint = clean(paint, 1, 300, c.get('fill', 40))
    for x0, y0, x1, y1 in c.get('not_paint', []): paint[y0:y1, x0:x1] = False
    if 'hole' in c:
        hx, hy, hr = c['hole']; yy_, xx_ = np.mgrid[:H, :W]; paint &= (xx_ - hx)**2 + (yy_ - hy)**2 > hr**2
    # guard: flood from a seed, on a smoothed picture
    guard = np.zeros_like(R)
    if 'guard_seed' in c:
        sm = lab(cv2.bilateralFilter(rgb.astype(np.uint8), 7, 30, 7))
        for sx, sy in c['guard_seed']:
            k = np.median(sm[sy-3:sy+4, sx-3:sx+4].reshape(-1, 3), 0)
            cand = body & ~board & (np.linalg.norm(sm - k, axis=2) < c.get('guard_tol', 22))
            cand = ndi.binary_closing(cand | (strings & body), iterations=1) & body & ~board
            lb, _ = ndi.label(cand); win = lb[sy-6:sy+7, sx-6:sx+7]; win = win[win > 0]
            if len(win): guard |= lb == np.bincount(win).argmax()
            else: print('guard seed missed', slug, sx, sy, 'paint', bool(paint[sy, sx]))
        if 'guard_box' in c:
            x0, y0, x1, y1 = c['guard_box']; keep = np.zeros_like(guard); keep[y0:y1, x0:x1] = True; guard &= keep
        if 'guard_not_disk' in c:
            dx, dy, rr = c['guard_not_disk']; yy_, xx_ = np.mgrid[:H, :W]; guard &= (xx_ - dx)**2 + (yy_ - dy)**2 > rr**2
        guard &= dist > c.get('guard_edge', 0)
        guard = clean(guard, 1, 200, c.get('guard_fill', 120)) & body
        paint &= ~ndi.binary_dilation(guard, iterations=1)
    # electric heads take the paint: the head face colour, posts, buttons and strings left out
    hpaint = np.zeros_like(R)
    if MAN['guitars'][slug]['options'].get('head_paint'):
        hface = head & free & (dist == 0)
        ys_, xs_ = np.where(hface)
        if len(ys_):
            hcx = cx; inner = hface & (np.abs(xx - hcx) < 22) & (np.arange(H)[:, None] < r['nut'] - 25) & (np.arange(H)[:, None] > ys_.min() + 10)
            k = np.median(L[inner], 0)
            fld, den = norm_blur(L, (hface & (np.linalg.norm(L - k, axis=2) < 24)).astype(np.float32), 10)
            hpaint = hface & (np.linalg.norm(L - fld, axis=2) < 18) & (den > .05)
            hpaint = clean(hpaint, 1, 100, 30)
    # metal: grey, fairly bright, not paint or guard; acoustics: on the head only (tuners)
    acoustic = MAN['guitars'][slug]['type'] == 'acoustic'
    where = (head & ~board) if acoustic else ((body | head) & ~board)
    metal = where & ~paint & ~hpaint & ~ndi.binary_dilation(guard, iterations=3) & (sat < c.get('metal_sat', 0.16)) & (val > 0.42) & ~(M['strings'] > 100)
    if 'metal_box' in c:
        keep = np.zeros_like(metal)
        for x0, y0, x1, y1 in c['metal_box']: keep[y0:y1, x0:x1] = True
        metal &= keep
    metal = clean(metal, 0, 6, 10)
    if c.get('paint_hue') == 'red':
        redh = (rgb[..., 0] > rgb[..., 1] + 45) & (rgb[..., 0] > rgb[..., 2] + 45)
        guard = clean(guard & ~redh, 1, 200, 200)
        # a smooth guard outline: the mask blurred and cut at half, so the edge has no steps
        guard = cv2.GaussianBlur(guard.astype(np.float32), (0, 0), 1.6) > 0.5
    if c.get('paint_all'):
        S0 = paint.copy()
        # one colour over the whole face: everything inside the outline line that is not guard, metal or board
        fa = ndi.binary_fill_holes(A > 200) & ~ndi.binary_dilation(head, iterations=2); da = ndi.distance_transform_edt(fa)
        paint = (paint | (fa & (da >= c['paint_all']) & (np.arange(H)[:, None] > np.where(body.any(1))[0].min() - 2))) & ~guard & ~ndi.binary_dilation(metal, iterations=1) & ~board
        if c.get('paint_hue') == 'red': paint &= ((rgb[..., 0] > rgb[..., 1] + 45) & (rgb[..., 0] > rgb[..., 2] + 45)) | (dist < 4)
        if c.get('paint_hue') == 'blue': paint &= ((rgb[..., 2] > rgb[..., 0] + 12) & (rgb[..., 2] >= rgb[..., 1])) | (dist < 4) | S0
        paint = clean(paint, 1, 60, 300) & ~guard
        if c.get('paint_hue') == 'red':
            # darker red next to the paint (the body seen between the guard and the bridge) is paint too
            near = ((rgb[..., 0] > rgb[..., 1] + 25) & (rgb[..., 0] > rgb[..., 2] + 25)) & fa & ~guard & ~metal & ~board
            near = near | (redh & fa & ~guard & ~metal & (M['board'] < 200))
            if hpaint is not None and hpaint.any():
                hpaint = hpaint | (head & ((rgb[..., 0] > rgb[..., 1] + 25) & (rgb[..., 0] > rgb[..., 2] + 25) & (sat > 0.72)) & ~ndi.binary_dilation(metal, iterations=1) & ~board)
            lbn, nn = ndi.label(near | paint); grow = ndi.binary_dilation(paint, iterations=6)
            keep = np.unique(lbn[grow & near]); paint = paint | (np.isin(lbn, keep[keep > 0]) & near)
            # the soft outer edge pixels too, so no old red line is left round the outline
            paint = paint | ((A > 0) & ~ndi.binary_erosion(A > 0, iterations=3) & ~ndi.binary_dilation(head, iterations=3) & ~board & ~guard & ~metal & (np.arange(H)[:, None] > np.where(body.any(1))[0].min() - 2))
    if c.get('rim_fill'):
        # the painted edge line is paint too, so a new colour reaches the outline
        paint = paint | (body & (dist <= c['rim_fill']) & ~ndi.binary_dilation(guard, iterations=2) & ~metal & ~board)
    return dict(road=road, rgb=rgb, A=A, body=body, head=head, solid=solid, dist=dist, paint=paint, hpaint=hpaint, guard=guard, metal=metal,
                board=board, strings=strings, L=L, W=W, H=H, cx=cx, geo=M['geo'])

def overlay_png(slug, S):
    rgb = S['rgb'].copy()
    for m, col in ((S['paint'], (255, 40, 40)), (S['hpaint'], (255, 120, 0)), (S['guard'], (40, 120, 255)), (S['metal'], (255, 255, 0))):
        rgb[m] = rgb[m] * 0.45 + np.array(col) * 0.55
    bg = np.full_like(rgb, 30); a = S['A'][..., None] / 255.
    return Image.fromarray((rgb * a + bg * (1 - a)).astype(np.uint8))

if __name__ == '__main__':
    slugs = sys.argv[1:] or ['porch', 'cornerstone', 'clubslab', 'hollowhill', 'swing', 'koaarc', 'comet']
    tiles = []
    for s in slugs:
        S = segment(s); tiles.append(overlay_png(s, S))
        print(s, 'paint', int(S['paint'].sum()), 'head', int(S['hpaint'].sum()), 'guard', int(S['guard'].sum()), 'metal', int(S['metal'].sum()))
    Hh = 900; tiles = [t.resize((int(t.width*Hh/t.height), Hh)) for t in tiles]
    sh = Image.new('RGB', (sum(t.width for t in tiles), Hh)); x = 0
    for t in tiles: sh.paste(t, (x, 0)); x += t.width
    import time; fn = f'{ROOT}/v/seg-{int(time.time())%10000}.jpg'; sh.save(fn, quality=88); print(fn)

# ------------------------------------------------------------------------------------------------------------------
def feather(m, s=0.7): return np.clip(cv2.GaussianBlur(m.astype(np.float32), (0, 0), s) * 1.15, 0, 1) * (ndi.binary_dilation(m, iterations=1))
def rgba(rgb, a):
    out = np.dstack([np.broadcast_to(rgb, a.shape + (3,)) if np.ndim(rgb) == 1 else rgb, a * 255]).astype(np.float32)
    return np.clip(out, 0, 255).astype(np.uint8)
def save(arr, path, q=88, lossless=False):
    im = Image.fromarray(arr, 'RGBA')
    im.save(path, 'WEBP', quality=q, method=6, lossless=lossless)
    return os.path.getsize(path)
def rng_for(slug): return np.random.default_rng(abs(hash(slug)) % (2**32) if False else sum(map(ord, slug)) * 7919)

def chip_poly(rng, cx, cy, r, n=9):
    ang = np.sort(rng.uniform(0, 2*np.pi, n)); rad = r * rng.uniform(0.55, 1.0, n)
    return [(cx + rr*np.cos(a), cy + rr*0.8*np.sin(a)) for a, rr in zip(ang, rad)]

def layers(slug):
    from PIL import ImageDraw
    S = segment(slug); c = CFG.get(slug, {}); g = MAN['guitars'][slug]
    W, H, cx = S['W'], S['H'], S['cx']; rgb = S['rgb']; Y = rgb @ np.array([.299, .587, .114])
    acoustic = g['type'] == 'acoustic'
    paint, hpaint, guard, metal, body, dist = S['paint'], S['hpaint'], S['guard'], S['metal'], S['body'], S['dist']
    P_all = paint | hpaint
    os.makedirs(f'{OUT}/{slug}', exist_ok=True); sizes = {}
    xx = np.arange(W)[None, :].repeat(H, 0).astype(np.float32); yy = np.arange(H)[:, None].repeat(W, 1).astype(np.float32)
    # ---- paint: light and shade (50% grey = none), with the light and dark split down the centre line baked in ----
    split = np.where(xx < cx, 0.065, -0.065)
    edge = -0.12 * np.exp(-dist / 5.0)
    if c.get('shade_from_paint', not (slug in ('cornerstone', 'koaarc', 'comet'))):
        mf = P_all.astype(np.float32); Yl = cv2.GaussianBlur((Y * mf).astype(np.float32), (0, 0), 10) / np.maximum(cv2.GaussianBlur(mf, (0, 0), 10), 1e-4)
        ref = np.median(Y[paint]); form = np.clip((Yl - ref) / 255 * 0.9, -0.12, 0.12)
        split = np.zeros_like(split)  # the painting's own split is already in its light
        # keep the painted split (left lighter, right darker) but at least the agreed step
        sl = np.median(Yl[paint & (xx < cx)]) - np.median(Yl[paint & (xx >= cx)])
        if sl / 255 * 0.9 < 0.09: split = np.where(xx < cx, 0.04, -0.04)
    else:
        form = np.zeros_like(split)
    # electric head face: plain, a touch of the split
    v = 0.5 + split + edge + form
    v = cv2.GaussianBlur(v.astype(np.float32), (0, 0), 1.0)
    v = np.where(hpaint, 0.5 + np.where(xx < cx, 0.04, -0.04) - 0.08 * np.exp(-ndi.distance_transform_edt(S['head']) / 3.0), v)
    pa = feather(P_all, 0.6)
    if c.get('head_mix'):
        # head pixels that are part paint, part painted string or outline: paint them by how much paint they hold,
        # so a new colour reaches the strings' and outline's soft edges and the string centres stay as they are
        Pc = np.median(rgb[hpaint], axis=0); Sg = 222.0
        m = np.clip((Sg - rgb[..., 1]) / max(Sg - Pc[1], 1), 0, 1) * ((rgb[..., 0] > rgb[..., 1] + 25) & (rgb[..., 0] > rgb[..., 2] + 20))
        zone = ndi.binary_dilation(S['head'], iterations=3) & (S['A'] > 0) & ~ndi.binary_dilation(metal, iterations=1) & ~S['board']
        pa = np.maximum(pa, np.where(zone, m, 0))
    grey = np.clip(v * 255, 0, 255)[..., None].repeat(3, 2)
    sizes['paint'] = save(rgba(grey, pa), f'{OUT}/{slug}/paint.webp')
    # ---- grain: faint fine detail only ----
    hp = Y - cv2.GaussianBlur(Y.astype(np.float32), (0, 0), 2.5)
    gv = np.clip(0.5 + hp / 255 * c.get('grain', 0.8), 0.38, 0.62)
    gv = np.where(P_all, gv, 0.5)
    sizes['grain'] = save(rgba(np.clip(gv * 255, 0, 255)[..., None].repeat(3, 2), pa), f'{OUT}/{slug}/grain.webp')
    # ---- top: the body face (electrics stop 3 px short of the edge) ----
    top = paint & body
    if not acoustic: top = top & (dist > 3)
    sizes['top'] = save(rgba(np.array([255, 255, 255.]), feather(top, 0.6)), f'{OUT}/{slug}/top.webp')
    # ---- burst: quarter size; 1 at the outer edge, 0 about a third of the way in; 0.35 on the head face ----
    D = dist[body].max(); t = np.clip(1 - dist / (0.33 * D), 0, 1); t = t * t * (3 - 2 * t)
    ba = np.where(S['solid'], t, 0); ba = np.where(hpaint | (S['head'] & ~acoustic), 0.35, ba) * (S['solid'] | S['head'])
    qw, qh = -(-W // 4), -(-H // 4)
    bq = cv2.resize(np.pad(ba.astype(np.float32), ((0, qh*4 - H), (0, qw*4 - W))), (qw, qh), interpolation=cv2.INTER_AREA)
    sizes['burst'] = save(rgba(np.array([255, 255, 255.]), bq), f'{OUT}/{slug}/burst.webp')
    # ---- light: one soft highlight on the upper bass bout ----
    ys_, xs_ = np.where(body); bx0, bx1, by0, by1 = xs_.min(), xs_.max(), ys_.min(), ys_.max(); bw, bh = bx1 - bx0, by1 - by0
    hx, hy = c.get('hl', (bx0 + 0.27 * bw, by0 + (0.30 if acoustic else 0.33) * bh))
    rx, ry = 0.10 * bw, 0.17 * bh; ang = np.deg2rad(-18)
    dx, dy = xx - hx, yy - hy; u = (dx*np.cos(ang) + dy*np.sin(ang)) / rx; w_ = (-dx*np.sin(ang) + dy*np.cos(ang)) / ry
    la = np.exp(-(u*u + w_*w_) * 1.6) * c.get('hl_a', 0.30 if acoustic else 0.42)
    la = la * (paint | guard) * (dist > 4)
    la = cv2.GaussianBlur(la.astype(np.float32), (0, 0), 1.0)
    sizes['light'] = save(rgba(np.array([255, 255, 255.]), la), f'{OUT}/{slug}/light.webp')
    # ---- guard ----
    if g['files'].get('guard'):
        if g['options'].get('guard_kind') == 'added':
            # Cornerstone's teardrop, moved to this soundhole (same size: the two rosettes are the same size)
            cs = segment('cornerstone'); hs = CFG['cornerstone']['hole']; hp_ = c['hole']
            ddx, ddy = hp_[0] - hs[0], hp_[1] - hs[1]
            gm = np.zeros((H, W), bool); src = cs['guard']; ys2, xs2 = np.where(src)
            ny, nx = ys2 + ddy, xs2 + ddx; ok = (ny >= 0) & (ny < H) & (nx >= 0) & (nx < W); gm[ny[ok], nx[ok]] = True
            gm &= body
            gd = ndi.distance_transform_edt(gm); gvv = 0.5 - 0.12 * np.exp(-gd / 2.0) + 0.05 * np.exp(-(gd - 3)**2 / 2)
            guard_m = gm
        else:
            guard_m = guard
            Yg = cv2.GaussianBlur(Y.astype(np.float32), (0, 0), 0.8); ref = np.median(Yg[guard]) if guard.any() else 128
            gvv = np.clip(0.5 + (Yg - ref) / 255 * 0.9, 0.2, 0.8)
            # on a painted guard the outer 1 px line is left out, so the painted bevel shows round every guard
            guard_m = guard & ndi.binary_erosion(guard, iterations=1)
        ga = feather(guard_m, 0.6)
        sizes['guard'] = save(rgba(np.clip(gvv * 255, 0, 255)[..., None].repeat(3, 2), ga), f'{OUT}/{slug}/guard.webp')
    # ---- metal ----
    sizes['metal'] = save(rgba(np.array([255, 255, 255.]), feather(metal, 0.5)), f'{OUT}/{slug}/metal.webp')
    # ---- wear, as clean chips ----
    wood = np.array(c.get('wood', (222, 192, 146)), float); grime = np.array((78, 58, 40), float)
    shade_mul = np.clip(v * 2, 0.6, 1.3)[..., None]
    for level in ('played', 'worn'):
        rng = rng_for(slug + level)
        img = Image.new('RGBA', (W * 4, H * 4), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
        ring = Image.new('L', (W * 4, H * 4), 0); dr2 = ImageDraw.Draw(ring)
        chips = []
        # edge chips: points on the body edge band
        pdist = ndi.distance_transform_edt(paint); eb = np.argwhere(paint & body & (pdist > 1.5) & (pdist < 6) & (dist < 16))
        n_edge = 14 if level == 'played' else 40
        for k in rng.choice(len(eb), n_edge, replace=False):
            y, x = eb[k]; r = rng.uniform(1.5, 3.0) if level == 'played' else rng.uniform(2.5, 7.5)
            chips.append(chip_poly(rng, x, y, r))
        # pick wear: treble side below the strings, near the soundhole or between the pickups and the bridge
        px_, py_ = c.get('pick', (cx + 0.16 * bw, by0 + 0.55 * bh))
        if level == 'worn':
            # bare wood at the forearm (bass side, top of the lower bout)
            fx, fy = c.get('arm', (bx0 + 0.20 * bw, by0 + 0.60 * bh))
            for k in range(7): chips.append(chip_poly(rng, fx + rng.normal(0, 10), fy + rng.normal(0, 16), rng.uniform(9, 17), 11))
            for k in range(4): chips.append(chip_poly(rng, px_ + rng.normal(0, 7), py_ + rng.normal(0, 6), rng.uniform(5, 10), 10))
        for poly in chips:
            p4 = [(x * 4, y * 4) for x, y in poly]
            dr2.polygon(p4, fill=255)
        rm = np.array(ring.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
        rm = rm * paint
        chipm = rm > 0.5
        grime_band = cv2.GaussianBlur((ndi.binary_dilation(chipm, iterations=2) & ~chipm & paint).astype(np.float32), (0, 0), 0.8)
        col = np.where(chipm[..., None], wood * shade_mul, grime)
        a = np.maximum(np.clip(rm * 1.0, 0, 1) * 0.95, grime_band * (0.35 if level == 'worn' else 0.22))
        # a dulled pick patch and a few fine scratches
        dpx, dpy = xx - px_, yy - py_
        patch = np.exp(-((dpx / (0.07 * bw))**2 + (dpy / (0.05 * bh))**2)) * (0.16 if level == 'played' else 0.24) * paint
        col = np.where((patch > a)[..., None], np.array((236, 230, 220.)), col); a = np.maximum(a, patch)
        sc = Image.new('L', (W * 4, H * 4), 0); ds = ImageDraw.Draw(sc)
        for k in range(10 if level == 'played' else 18):
            x0 = px_ + rng.normal(0, 0.08 * bw); y0 = py_ + rng.normal(0, 0.06 * bh); L_ = rng.uniform(6, 16); an = rng.uniform(-0.6, 0.6) + 0.3
            ds.line([(x0 * 4, y0 * 4), ((x0 + L_ * np.cos(an)) * 4, (y0 + L_ * np.sin(an)) * 4)], fill=255, width=2)
        scm = np.array(sc.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255 * paint * 0.28
        col = np.where((scm > a)[..., None], np.array((240, 236, 228.)), col); a = np.maximum(a, scm)
        sizes['wear-' + level] = save(rgba(np.clip(col, 0, 255), a), f'{OUT}/{slug}/wear-{level}.webp')
    # ---- strings left long: from each post out past its button, one coil ----
    hface = S['head'] & ndi.binary_erosion(S['head'], iterations=2)
    hm = metal & S['head']
    lb, n = ndi.label(hm); buttons = []
    for i in range(1, n + 1):
        ys2, xs2 = np.where(lb == i)
        if len(ys2) >= 250 and (xs2.mean() < cx - 50 or xs2.mean() > cx + 50): buttons.append((xs2.mean(), ys2.mean()))
    Ys = cv2.blur(Y.astype(np.float32), (7, 7)); posts = []
    for bx, by in buttons:
        side = -1 if bx < cx else 1; row = int(round(by))
        # the face edge on this row, then the brightest round spot 8 to 45 px in from it
        face = np.where(hface[row] & ~metal[row])[0]
        if not len(face): continue
        e = face.min() if side < 0 else face.max()
        xs3 = np.arange(e + 8, e + 46) if side < 0 else np.arange(e - 45, e - 7)
        best = None
        for dyy in range(-6, 7):
            rr = row + dyy; k = xs3[np.argmax(Ys[rr, xs3])]
            if best is None or Ys[rr, k] > best[0]: best = (Ys[rr, k], k, rr)
        posts.append((float(best[1]), float(best[2])))
    posts = c.get('posts') or posts
    hys, hxs = np.where(S['head']); hl, hr_ = hxs.min(), hxs.max()
    img = Image.new('RGBA', (W * 4, H * 4), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    scol = (204, 168, 108) if acoustic else (206, 209, 215)
    for (px, py) in posts:
        side = -1 if px < cx else 1
        xe = (hl - 12) if side < 0 else (hr_ + 12); xe = float(np.clip(xe, 8, W - 9))
        pts = [(px + (xe - px) * t, py + 6 * t * t) for t in np.linspace(0, 1, 16)]
        coil_c = (xe + side * 4.5, py + 6 + 1.5)
        for wv, colr in ((2.4, (20, 16, 12, 110)), (1.3, scol + (255,))):
            dr.line([(x * 4, y * 4) for x, y in pts], fill=colr, width=int(wv * 4), joint='curve')
            r_ = 4.5; dr.ellipse([(coil_c[0] - r_) * 4, (coil_c[1] - r_) * 4, (coil_c[0] + r_) * 4, (coil_c[1] + r_) * 4], outline=colr, width=int(wv * 4))
    sl = np.array(img.resize((W, H), Image.LANCZOS))
    sizes['strings-long'] = save(sl, f'{OUT}/{slug}/strings-long.webp')
    return sizes, len(posts)

def run_layers(slugs):
    tot = 0
    for s in slugs:
        sz, npost = layers(s); tot += sum(sz.values()); print(s, 'posts', npost, sz, sum(sz.values()), flush=True)
    print('total', tot)
