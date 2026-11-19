"""Measure each painting: top, bottom, nut, neck centre, body top, where the painted board ends, and where the painted
strings end (the bridge) with their x span there. Writes geom.json and an overlay per guitar for checking by eye."""
import json, sys, numpy as np, cv2
import os
ROOT = os.environ.get('LOOKA_ROOT', '/workspace/cartoon-test/full')
os.chdir(ROOT)
from PIL import Image, ImageDraw
from scipy.ndimage import median_filter, minimum_filter
S = 4
OV = json.load(open('overrides.json')) if __import__('os').path.exists('overrides.json') else {}
def measure(slug):
    g = np.array(Image.open(f'cut/{slug}-4x.png'))
    A = g[::S, ::S, 3] > 128; rgb = np.array(Image.open(f'gen/{slug}.jpg').convert('RGB')).astype(np.float32)
    H, Wd = A.shape; wid = A.sum(1)
    rows = np.where(wid > 3)[0]; top = int(rows.min()); bot = int(np.where(wid > 25)[0].max()) + 1
    wn = float(np.median(wid[int(H*.25):int(H*.38)]))
    y = top + 40
    while y < H - 60 and not (wid[y] < 1.25*wn and (wid[y:y+40] < 1.35*wn).all()): y += 1
    lum = rgb.mean(2)
    cols = np.where(A[y + 100])[0]; cx = (cols.min() + cols.max() + 1) / 2
    band = lum[:, int(cx - wn*.3):int(cx + wn*.3)].mean(1)
    seg = band[y - 30:y + 12]; k = int(np.argmax(seg)); nut = y
    if seg[k] > np.median(seg) + 25: nut = y - 30 + k + 3   # bottom of the bright nut bar
    cols = np.where(A[nut + 100])[0]; cx = (cols.min() + cols.max() + 1) / 2
    bt = next(yy for yy in range(nut + 50, H) if wid[yy] > 1.4*wn)
    # painted board end: rows down the centre whose colour is still the board's
    b = median_filter(rgb[:, int(cx - wn*.35):int(cx - wn*.1)].mean(1), size=(9, 1))
    bc = np.median(b[nut + 40:nut + 200], 0); near = np.linalg.norm(b - bc, axis=1) < 24
    end = bt
    while end < bot - 25 and near[end:end + 22].any(): end += 1
    end = min(end, int(bt + 0.5*(bot - bt)))
    # painted strings: thin lines that run on vertically, near the centre, below the board end
    x0, x1 = int(cx - 70), int(cx + 70)
    L = lum[:, x0:x1]; hp = np.abs(L - median_filter(L, size=(1, 9))) > 10
    hp = minimum_filter(hp.astype(np.uint8), size=(10, 1)) > 0
    cnt = hp[:, 20:120].sum(1)
    yb = end; gap = 0
    while yb < bot - 5:
        if cnt[yb] >= 4: gap = 0
        else:
            gap += 1
            if gap > 40: break
        yb += 1
    yb = yb - gap
    rr = hp[max(end, yb - 30):yb - 4].any(0); xs = np.where(rr)[0]
    bx = (float(x0 + xs.min()), float(x0 + xs.max())) if len(xs) > 4 else (cx - 25, cx + 25)
    m = dict(top=top, bot=bot, wn=wn, nut=int(nut), cx=float(cx), bt=int(bt), end=int(end), bridge=int(yb), bridge_x=bx)
    m.update(OV.get(slug, {}))
    return m
def overlay(slug, m):
    im = Image.open(f'gen/{slug}.jpg').convert('RGB'); d = ImageDraw.Draw(im)
    for k, c in (('top','white'),('nut','yellow'),('bt','cyan'),('end','orange'),('bridge','red'),('bot','white')):
        d.line([(0, m[k]), (720, m[k])], fill=c, width=1); d.text((5, m[k] - 11), f"{k} {m[k]}", fill=c)
    d.line([(m['cx'], 0), (m['cx'], 1280)], fill='magenta')
    for x in m['bridge_x']: d.line([(x, m['bridge'] - 40), (x, m['bridge'] + 10)], fill='red', width=2)
    return im
if __name__ == '__main__':
    import glob, os
    slugs = sys.argv[1:] or sorted(os.path.basename(f)[:-7] for f in glob.glob('cut/*-4x.png'))
    G = json.load(open('geom.json')) if os.path.exists('geom.json') else {}
    tiles = []
    for s in slugs:
        m = measure(s); G[s] = m; print(s, m)
        tiles.append(overlay(s, m).resize((360, 640)))
    json.dump(G, open('geom.json', 'w'), indent=0)
    W = 6; sh = Image.new('RGB', (360*W, 640*((len(tiles)+W-1)//W)))
    for i, t in enumerate(tiles): sh.paste(t, ((i % W)*360, (i//W)*640))
    sh.save('geomsheet.jpg', quality=88)
