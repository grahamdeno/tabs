"""Look A full redraw: fit a cut-out painting into the exact -road picture of a guitar (same w x h, nut, join, fret rows,
strings from docs/guitars/frets.json). Head and body come from the painting, scaled evenly; the board, frets, inlays, nut
and strings are drawn by code from the fret data, so the stops line up exactly as today."""
import json, sys, os, numpy as np, cv2
from PIL import Image, ImageDraw
from scipy.ndimage import median_filter, minimum_filter
from scipy import ndimage as ndi
S = 4
ROOT = '/workspace/cartoon-test/full'
P = json.load(open(f'{ROOT}/pics.json')); F = json.load(open(f'{ROOT}/frets.json'))
ACOUSTIC = {"porch", "cornerstone", "koaarc", "ziricotegrand", "walnuthall"}
OV = json.load(open(f'{ROOT}/overrides.json'))

def road_frets(slug):
    fj = F[slug]; r = P[slug]['road']
    x0 = fj['frets'][0]['centre_x'] - r['cx']; y0 = fj['nut_y'] - r['nut']
    fr = [(q['y'] - y0, q['centre_x'] - x0, q['half_width'], [x - x0 for x in q['strings_x']]) for q in fj['frets']]
    sps = [(sp['space'], sp['inlay']['kind'], [(b[0]-x0, b[1]-y0, b[2]-x0, b[3]-y0) for b in sp['inlay']['boxes']]) for sp in fj['spaces']]
    return fr, sps, (x0, y0), (fj['badge']['y'] - y0, fj['badge']['below_bridge_y'] - y0)

def unstring(g, y0, y1, x0, x1, keep_circles=()):
    roi = g[y0:y1, x0:x1, :3].astype(np.uint8)
    lum = cv2.cvtColor(roi, cv2.COLOR_RGB2GRAY).astype(np.float32)
    base = median_filter(lum, size=(1, 9*S))
    m = np.abs(lum - base) > 9
    m = minimum_filter(m.astype(np.uint8), size=(14*S, 1)) > 0
    m = cv2.dilate(m.astype(np.uint8), np.ones((3, 2*S+1), np.uint8))
    inner = cv2.erode((g[y0:y1, x0:x1, 3] > 250).astype(np.uint8), np.ones((6*S+1, 6*S+1), np.uint8))
    m = m * inner
    out = g.copy()
    out[y0:y1, x0:x1, :3] = cv2.inpaint(roi, m, 5, cv2.INPAINT_TELEA).astype(np.float32)
    return out

def compose(slug, G):
    m = dict(G[slug]); m.update(OV.get(slug, {}))
    p = P[slug]; r = p['road']; W, H = r['w'], r['h']
    nut_t, join_t = r['nut'], r['join']
    fr, sps, off, (badge_y, below_y) = road_frets(slug)
    cur = np.array(Image.open(f'{ROOT}/cur/{slug}-road.webp'))[..., 3] > 128
    rows = np.where(cur.sum(1) > 3)[0]; top_t, bot_t = int(rows.min()), int(np.where(cur.sum(1) > 25)[0].max()) + 1
    g = np.array(Image.open(f'{ROOT}/cut/{slug}-4x.png')).astype(np.float32)
    A1 = g[::S, ::S, 3] > 128
    top_g, bot_g, nut_g, cx_g, bt_g, end_g, br_g = m['top'], m['bot'], m['nut'], m['cx'], m['bt'], m['end'], m['bridge']
    canvas = np.zeros((H*S, W*S, 4), np.float32)
    cx_t = fr[0][1]
    def paste(crop, s, ox, oy):
        h, w = crop.shape[:2]; nw, nh = max(1, int(round(w*s))), max(1, int(round(h*s)))
        pm = crop.copy(); pm[..., :3] *= pm[..., 3:4]/255.
        rs = cv2.resize(pm, (nw, nh), interpolation=cv2.INTER_AREA if s < 1 else cv2.INTER_CUBIC)
        x0, y0 = int(round(ox)), int(round(oy))
        xa, ya = max(0, x0), max(0, y0); xb, yb = min(W*S, x0+nw), min(H*S, y0+nh)
        sub = rs[ya-y0:yb-y0, xa-x0:xb-x0]; al = np.clip(sub[..., 3:4]/255., 0, 1)
        dst = canvas[ya:yb, xa:xb]
        dst[..., :3] = sub[..., :3] + dst[..., :3]*(1-al); dst[..., 3:4] = al*255 + dst[..., 3:4]*(1-al)
    # ---- strings: straight lines through the fret data, out to the bridge ----
    ys = np.array([q[0] for q in fr]); lines = [np.polyfit(ys, [q[3][k] for q in fr], 1) for k in range(6)]
    # ---- body, scaled evenly ----
    s_b = (bot_t - join_t) / (bot_g - bt_g)
    gw_cols = np.where(A1[bt_g:bot_g].any(0))[0]
    half = max(cx_g - gw_cols.min(), gw_cols.max() + 1 - cx_g)
    s_w = (W/2 - 1.5) / half
    # the headline badge sits on the body below the strings' end: keep the bridge above it, the body bottom inside the
    # picture, the badge on the body, and the body top near today's join (up to 40 px higher, 30 lower)
    Lb = m.get('L', badge_y - 17.5 - 7)
    best = None
    for s in np.arange(min(s_w, s_b * 1.02), 0.7, -0.002):
        hi = min(Lb - (br_g - bt_g)*s, H - 2 - (bot_g - bt_g)*s, join_t + 30)
        lo = max(join_t - m.get('up', 40), badge_y + 24 - (bot_g - bt_g)*s)
        if hi >= lo:
            # body bottom as near today's bottom as allowed, top as near the join
            oy = min(hi, max(lo, bot_t - (bot_g - bt_g)*s))
            best = (s, oy); break
    s_b, oy_b = best if best else (min(s_b, s_w), join_t)
    if 'sb' in m: s_b = m['sb']; oy_b = m.get('oy', oy_b)
    by_t = oy_b + (br_g - bt_g) * s_b         # bridge row in the road picture
    end_t = oy_b + (end_g - bt_g) * s_b
    sp_b = np.polyval(lines[5], by_t) - np.polyval(lines[0], by_t)
    # unstring the body (painted strings and their shadows), between the body top and the bridge
    gb = unstring(g, int((bt_g - 4)*S), int((br_g + m.get('unstr_pad', 8))*S), int((cx_g - sp_b/s_b/2 - 14)*S), int((cx_g + sp_b/s_b/2 + 14)*S))
    body = gb[int((bt_g - 2)*S):int(bot_g*S + 8)]
    paste(body, s_b, cx_t*S - cx_g*S*s_b, (oy_b - 2*s_b)*S)
    A_body = canvas[..., 3].copy()
    # ---- head, the size it is today ----
    sh = (nut_t - top_t) / (nut_g - top_g) * m.get('sh', 1.0)
    head = g[:int(nut_g*S)]
    paste(head, sh, cx_t*S - cx_g*S*sh, (nut_t - nut_g*sh)*S)
    A_head = np.clip(canvas[..., 3] - A_body, 0, 255)
    # ---- the board from the fret data ----
    hw = np.array([q[2] for q in fr]); cxs = np.array([q[1] for q in fr])
    kh = np.polyfit(ys, hw, 1); kc = np.polyfit(ys, cxs, 1)
    end_t = max(end_t, ys[-1] + 9) + m.get('end_pad', 0)
    if 'end_t' in m: end_t = m['end_t']
    # the painted board's half width on the body, in road pixels
    rowp = A1[bt_g - 4]; xl = int(cx_g); xr = int(cx_g)
    while rowp[xl-1]: xl -= 1
    while rowp[xr+1]: xr += 1
    pw = min((xr - xl + 1)/2*s_b + 1.5, np.polyval(kh, end_t) + 10)
    pw = max(pw, np.polyval(kh, ys[-1]))
    img = Image.new('RGBA', (W*S, H*S), (0, 0, 0, 0)); dr = ImageDraw.Draw(img)
    bl = g[int((nut_g+60)*S):int((nut_g+200)*S), int((cx_g-m['wn']*.36)*S):int((cx_g-m['wn']*.12)*S), :3].reshape(-1, 3)
    br = g[int((nut_g+60)*S):int((nut_g+200)*S), int((cx_g+m['wn']*.12)*S):int((cx_g+m['wn']*.36)*S), :3].reshape(-1, 3)
    lit = tuple(int(v) for v in np.median(bl, 0)); shade = tuple(int(v) for v in np.median(br, 0))
    if 'board' in m: lit, shade = tuple(m['board'][0]), tuple(m['board'][1])
    if sum(lit) - sum(shade) < 24:
        mid = [(a+b)/2 for a, b in zip(lit, shade)]
        lit = tuple(min(255, int(v*1.10 + 4)) for v in mid); shade = tuple(int(v*0.86) for v in mid)
    def hw_at(y):
        v = np.polyval(kh, y)
        if y > ys[-1]: v = v + (pw - np.polyval(kh, end_t)) * min(1, max(0, (y - ys[-1]) / max(1, end_t - ys[-1])))
        return v + 1.5
    yy = np.linspace(nut_t, end_t, 240)
    L = [((np.polyval(kc, y) - hw_at(y))*S, y*S) for y in yy]; R = [((np.polyval(kc, y) + hw_at(y))*S, y*S) for y in yy]
    Cn = [(np.polyval(kc, y)*S, y*S) for y in yy]
    dr.polygon(L + Cn[::-1], fill=lit); dr.polygon(Cn + R[::-1], fill=shade)
    edge = tuple(int(v*0.55) for v in shade)
    # binding: today's picture's board edges, where they are clearly lighter than its board
    curim = np.array(Image.open(f'{ROOT}/cur/{slug}-road.webp').convert('RGBA')).astype(np.float32)
    strip, mids = [], []
    for q in fr[1:12]:
        y_ = int(q[0] + 6)
        for xe in (q[1] - q[2] + 1.0, q[1] + q[2] - 1.0): strip.append(curim[y_, int(round(xe)), :3])
        mids.append(curim[y_, int(q[1] - q[2]*0.55), :3])
    bcol = np.median(np.array(strip), 0); board_today = np.median(np.array(mids), 0)
    if 'binding' in m: bcol = np.array(m['binding'], float)
    bind = (bcol.sum() > board_today.sum() + 110 or 'binding' in m) and m.get('nobind') is None
    if bind:
        bc_ = tuple(int(v) for v in bcol); bc2 = tuple(int(v*0.82) for v in bcol)
        dr.line(L, fill=bc_, width=int(1.9*S)); dr.line(R, fill=bc2, width=int(1.9*S))
    else:
        dr.line(L, fill=edge, width=int(1.3*S)); dr.line(R, fill=edge, width=int(1.3*S))
    dr.line([(L[-1][0], end_t*S), (R[-1][0], end_t*S)], fill=edge, width=int(1.2*S))
    # frets at the data's rows (1..16)
    fy = list(ys[1:]); step = ys[-1] - ys[-2]; y = ys[-1]
    while True:
        step *= 0.9439; y += step
        if y > end_t - 4: break
        fy.append(y)
    # fret wire colour: today's wires (lit half), so gold frets stay gold
    fw = []
    for q in fr[1:12]:
        for dy_ in (-0.5, 0, 0.5):
            row_ = curim[int(round(q[0] + dy_)), int(q[1] - q[2]*0.9):int(q[1] - q[2]*0.1), :3]
            fw.append(row_[np.argsort(row_.mean(1))[-4:]].mean(0))
    fwc = np.median(np.array(fw), 0)
    wl = tuple(int(min(255, v)) for v in (fwc*0.92 + 12)); wd = tuple(int(v*0.78) for v in fwc); wsh = tuple(int(v*0.5) for v in fwc)
    if 'fretcol' in m: wl = tuple(m['fretcol']); wd = tuple(int(v*0.8) for v in wl); wsh = tuple(int(v*0.5) for v in wl)
    for y in fy:
        if y > end_t - 3: break
        x0 = np.polyval(kc, y) - hw_at(y) + 1; x1 = np.polyval(kc, y) + hw_at(y) - 1; xm = np.polyval(kc, y)
        dr.rectangle([x0*S, (y-1.0)*S, xm*S, (y+1.0)*S], fill=wl)
        dr.rectangle([xm*S, (y-1.0)*S, x1*S, (y+1.0)*S], fill=wd)
        dr.rectangle([x0*S, (y+0.5)*S, x1*S, (y+1.0)*S], fill=wsh)
    # inlays where the data has them: dots drawn round, the rest kept from today's picture
    pearl = tuple(m.get('pearl', (242, 234, 214)))
    copies = []
    def draw_block(bx0, by0, bx1, by1):
        yc = (by0 + by1)/2; xc = np.polyval(kc, yc); bw = 2*hw_at(yc)*0.46; bh = (by1 - by0)*0.74
        bx0, bx1, by0, by1 = xc - bw/2, xc + bw/2, yc - bh/2, yc + bh/2
        base, hi, lo = (168, 186, 180), (216, 228, 222), (128, 146, 142)
        dr.rounded_rectangle([bx0*S, by0*S, bx1*S, by1*S], radius=1.4*S, fill=base)
        dr.polygon([(bx0*S + 2, by0*S + 2), (bx1*S - 2, by0*S + 2), (bx0*S + 2, by1*S - 2)], fill=hi)
        dr.rectangle([(xc + bw*0.1)*S, (yc + bh*0.12)*S, (bx1 - 1.0)*S, (by1 - 1.0)*S], fill=lo)
    rads = [max(b[2]-b[0], b[3]-b[1])/2 + 0.6 for sp, kind, boxes in sps if kind in ('dot', 'double-dot') for b in boxes]
    rdot = float(np.clip(np.median(rads), 3.6, 6.0)) if rads else 4.2
    for sp, kind, boxes in sps:
        if kind == 'none': continue
        if kind in ('dot', 'double-dot'):
            for b in boxes:
                cxb, cyb = (b[0]+b[2])/2, (b[1]+b[3])/2; rr = rdot
                col = pearl
                if 'dotcol' in m: col = tuple(m['dotcol'])
                dr.ellipse([(cxb-rr)*S, (cyb-rr)*S, (cxb+rr)*S, (cyb+rr)*S], fill=col)
        elif kind == 'block' and m.get('draw_blocks'):
            draw_block(min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        else:
            copies.extend(boxes)
    allf = [ys[0]] + fy
    for k in m.get('extra_blocks', []):
        if k < len(allf) and allf[k] < end_t - 3:
            draw_block(0, allf[k-1] + 1.5, 0, allf[k] - 1.5)
    nk = np.array(img).astype(np.float32)
    # fancy inlays: today's pixels inside their boxes, where they differ from the board around them
    for b in copies:
        x0, y0, x1, y1 = int(b[0]) - 1, int(b[1]) - 1, int(np.ceil(b[2])) + 2, int(np.ceil(b[3])) + 2
        x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(W, x1), min(H, y1)
        if x1 <= x0 or y1 <= y0: continue
        patch = curim[y0:y1, x0:x1, :3]
        ring = np.concatenate([curim[max(0,y0-3):y0, x0:x1, :3].reshape(-1, 3), curim[y1:y1+3, x0:x1, :3].reshape(-1, 3)])
        bc = np.median(ring, 0) if len(ring) else np.median(patch.reshape(-1, 3), 0)
        dm = (np.linalg.norm(patch - bc, axis=2) > 38).astype(np.float32)
        dm = cv2.morphologyEx(dm, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        # a clean, slightly smoothed version (no photo grain): bilateral on the inlay
        clean = cv2.bilateralFilter(patch.astype(np.uint8), 5, 40, 5).astype(np.float32)
        big = cv2.resize(clean, ((x1-x0)*S, (y1-y0)*S), interpolation=cv2.INTER_CUBIC)
        mb = cv2.GaussianBlur(cv2.resize(dm, ((x1-x0)*S, (y1-y0)*S), interpolation=cv2.INTER_LINEAR), (0, 0), 1.2)
        mb = np.clip((mb - .35) * 2.5, 0, 1)[..., None]
        dst = nk[y0*S:y1*S, x0*S:x1*S]
        dst[..., :3] = big * mb + dst[..., :3] * (1 - mb)
    if not m.get('no_tail'):
        ya, yb2 = int(ys[-1] + 3), int(end_t - 5)
        # only as far as today's board goes (its colour down the board's left half)
        y_ = ya
        while y_ < yb2:
            xl_, xr_ = int(np.polyval(kc, y_) - hw_at(y_)*0.8), int(np.polyval(kc, y_) - hw_at(y_)*0.25)
            if np.linalg.norm(np.median(curim[max(0, y_-2):y_+3, xl_:xr_, :3].reshape(-1, 3), 0) - board_today) > 40: break
            y_ += 1
        yb2 = y_ - 3
    if not m.get('no_tail') and yb2 - ya > 8:
        xa, xb2 = int(np.polyval(kc, yb2) - hw_at(yb2) + 3), int(np.polyval(kc, yb2) + hw_at(yb2) - 3)
        patch = curim[ya:yb2, xa:xb2, :3]
        bc = np.median(patch.reshape(-1, 3), 0)
        dm = (np.linalg.norm(patch - bc, axis=2) > 45).astype(np.uint8)
        dm = cv2.morphologyEx(dm, cv2.MORPH_OPEN, np.ones((4, 4), np.uint8)).astype(np.float32)
        clean = cv2.bilateralFilter(patch.astype(np.uint8), 5, 40, 5).astype(np.float32)
        big = cv2.resize(clean, ((xb2-xa)*S, (yb2-ya)*S), interpolation=cv2.INTER_CUBIC)
        mb = cv2.GaussianBlur(cv2.resize(dm, ((xb2-xa)*S, (yb2-ya)*S)), (0, 0), 1.2)
        mb = np.clip((mb - .35) * 2.5, 0, 1)[..., None]
        dst = nk[ya*S:yb2*S, xa*S:xb2*S]; dst[..., :3] = big * mb + dst[..., :3] * (1 - mb)
    img = Image.fromarray(np.clip(nk, 0, 255).astype(np.uint8)); dr = ImageDraw.Draw(img)
    # nut
    nh0 = hw_at(nut_t)
    dr.rounded_rectangle([(cx_t-nh0-.5)*S, (nut_t-4.5)*S, (cx_t+nh0+.5)*S, (nut_t+1)*S], radius=1.5*S, fill=(244, 236, 212))
    dr.rectangle([(cx_t)*S, (nut_t-4.5)*S, (cx_t+nh0)*S, (nut_t+1)*S], fill=(226, 216, 190))
    A_board = np.array(img)[..., 3].astype(np.float32)
    smask = Image.new('L', img.size, 0); sdr = ImageDraw.Draw(smask)
    # strings, nut to bridge, with a soft shadow
    for k in range(6):
        if slug in ACOUSTIC: col = (214, 186, 128) if k < 4 else (226, 228, 232)
        else: col = (204, 207, 214)
        wdt = max(1, int(round((1.6 - 0.12*k)*S)))
        a = (np.polyval(lines[k], nut_t)*S, nut_t*S); b = (np.polyval(lines[k], by_t)*S, by_t*S)
        sh_c = tuple(int(v*0.35) for v in col) + (95,)
        lay = Image.new('RGBA', img.size, (0, 0, 0, 0)); ImageDraw.Draw(lay).line([(a[0]+1.3*S, a[1]+1.3*S), (b[0]+1.3*S, b[1]+1.3*S)], fill=sh_c, width=wdt)
        img = Image.alpha_composite(img, lay); dr = ImageDraw.Draw(img)
        dr.line([a, b], fill=col + (255,), width=wdt)
        sdr.line([a, b], fill=255, width=wdt + 2*S)
        dr.line([(a[0]-.35*S, a[1]), (b[0]-.35*S, b[1])], fill=tuple(min(255, v+30) for v in col) + (255,), width=max(1, wdt//3))
    nk = np.array(img).astype(np.float32)
    al = nk[..., 3:4]/255.
    canvas[..., :3] = nk[..., :3]*al + canvas[..., :3]*(1-al)
    canvas[..., 3:4] = np.maximum(canvas[..., 3:4], nk[..., 3:4])
    small = cv2.resize(canvas, (W, H), interpolation=cv2.INTER_AREA)
    a = small[..., 3:4]; rgb = np.where(a > 0, small[..., :3]/np.maximum(a/255., 1e-3), 0)
    out = np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 255)]).astype(np.uint8)
    dn = lambda a: cv2.resize(a.astype(np.float32), (W, H), interpolation=cv2.INTER_AREA).astype(np.uint8)
    np.savez_compressed(f'{ROOT}/out/{slug}-masks.npz', body=dn(A_body), head=dn(A_head), board=dn(A_board), strings=dn(np.array(smask)),
                        geo=np.array([s_b, oy_b, sh, cx_t, cx_g, nut_t, nut_g, bt_g, by_t]))
    info = dict(s_b=round(s_b, 4), sh=round(sh, 4), body_top=round(oy_b, 1), join=join_t, end=round(end_t, 1), bridge=round(by_t, 1), below_bridge=below_y, badge=badge_y, H=H)
    return Image.fromarray(out), info, canvas

if __name__ == '__main__':
    G = json.load(open(f'{ROOT}/geom.json')); os.makedirs(f'{ROOT}/out', exist_ok=True)
    for slug in (sys.argv[1:] or sorted(G)):
        im, info, can = compose(slug, G)
        im.save(f'{ROOT}/out/{slug}-road.png')
        if os.environ.get("KEEP4X"):
            a4 = can[..., 3:4]; rgb4 = np.where(a4 > 0, can[..., :3] / np.maximum(a4/255., 1e-3), 0)
            Image.fromarray(np.dstack([np.clip(rgb4, 0, 255), np.clip(a4, 0, 255)]).astype(np.uint8)).save(f"{ROOT}/out/{slug}-4x.png", compress_level=1)
        print(slug, im.size, info, flush=True)
