"""Write the four files per guitar at today's exact pixel sizes: road, body (a row band of road), small (road resized),
head (the head rendered from the 4x canvas at today's nut width, nut on the bottom row, neck centre at today's cx)."""
import json, os, sys, numpy as np, cv2
from PIL import Image
ROOT = os.environ.get('LOOKA_ROOT', '/workspace/cartoon-test/full'); S = 4
P = json.load(open(f'{ROOT}/pics.json')); F = json.load(open(f'{ROOT}/frets.json'))
os.makedirs(f'{ROOT}/final', exist_ok=True)
def unpremul_resize(a, size):
    a = a.astype(np.float32); al = a[..., 3:4] / 255.
    pm = np.dstack([a[..., :3] * al, a[..., 3:4]])
    r = cv2.resize(pm, size, interpolation=cv2.INTER_AREA)
    rgb = np.where(r[..., 3:4] > 0, r[..., :3] / np.maximum(r[..., 3:4] / 255., 1e-3), 0)
    return np.dstack([np.clip(rgb, 0, 255), np.clip(r[..., 3:4], 0, 255)]).astype(np.uint8)
def save(arr, path, q):
    Image.fromarray(arr, 'RGBA').save(path, 'WEBP', quality=q, method=6, exact=False)
    return os.path.getsize(path)
def dy_of(slug):
    road = np.array(Image.open(f'{ROOT}/cur/{slug}-road.webp').convert('RGBA'))[..., 3].astype(np.float32)
    body = np.array(Image.open(f'{ROOT}/cur/{slug}-body.webp').convert('RGBA'))[..., 3].astype(np.float32)
    bh = body.shape[0]; best = min(range(0, road.shape[0] - bh + 1), key=lambda d: np.abs(road[d:d+bh] - body).mean())
    return best, float(np.abs(road[best:best+bh] - body).mean())
ROAD7 = {"porch", "cornerstone", "clubslab", "hollowhill", "swing", "koaarc", "comet"}
if __name__ == '__main__':
    out = {}
    for slug in (sys.argv[1:] or sorted(F)):
        p = P[slug]; r = p['road']
        road = np.array(Image.open(f'{ROOT}/out/{slug}-road.png').convert('RGBA'))
        assert road.shape[:2] == (r['h'], r['w'])
        lim = 60000 if slug in ROAD7 else 90000
        sizes = {}
        sizes['road'] = save(road, f'{ROOT}/final/{slug}-road.webp', 88)
        dy, err = dy_of(slug); bh, bw = p['body']['h'], p['body']['w']; assert bw == r['w'], (slug, bw, r['w'])
        body = road[dy:dy+bh]
        if body.shape[0] < bh: body = np.vstack([body, np.zeros((bh - body.shape[0], bw, 4), np.uint8)])
        q = 88
        while (s_ := save(body, f'{ROOT}/final/{slug}-body.webp', q)) > lim and q > 60: q -= 4
        sizes['body'] = s_
        cs = Image.open(f'{ROOT}/cur/{slug}-small.webp'); sw, shh = cs.size
        small = unpremul_resize(road[1:r['h']-1], (sw, shh))
        sizes['small'] = save(small, f'{ROOT}/final/{slug}-small.webp', 88)
        # head
        hd = p['head']; hw0 = F[slug]['frets'][0]['half_width']
        k = hd['nw'] / (2*hw0)                     # head file px per road px
        c4 = np.array(Image.open(f'{ROOT}/out/{slug}-4x.png').convert('RGBA'))
        nut = r['nut']; cx = r['f'][0][1]
        # fit the whole head (tuner buttons too) inside today's head picture: shrink below the nut width if needed
        hm = c4[:int(nut*S), :, 3] > 40; ys_, xs_ = np.where(hm)
        miny, minx, maxx = ys_.min()/S, xs_.min()/S, (xs_.max()+1)/S
        k = min(k, (hd['cx'] - 3)/(cx - minx), (hd['w'] - hd['cx'] - 3)/(maxx - cx), (hd['h'] - 4)/(nut - miny))
        top = nut - (hd['h'] - 1) / k              # road row at the head file's top
        x0 = cx - hd['cx'] / k
        # crop the 4x canvas to that window and resize to the head file's size
        ya, yb = int(round(max(0, top) * S)), int(round((nut + 1/k) * S))
        xa, xb = int(round(x0 * S)), int(round((x0 + hd['w'] / k) * S))
        pad = np.zeros((yb - int(round(top*S)), xb - xa, 4), np.uint8)
        src = c4[ya:yb, max(0, xa):min(c4.shape[1], xb)]
        oy = ya - int(round(top*S)); ox = max(0, xa) - xa
        pad[oy:oy+src.shape[0], ox:ox+src.shape[1]] = src
        head = unpremul_resize(pad, (hd['w'], hd['h']))
        q = 88
        while (s_ := save(head, f'{ROOT}/final/{slug}-head.webp', q)) > lim and q > 60: q -= 4
        sizes['head'] = s_
        out[slug] = dict(sizes, dy=dy, dyerr=round(err, 2), k=round(k, 3), nut_ratio=round(k*2*hw0/hd['nw'], 3), head_top_cut=bool(top < 0))
        print(slug, out[slug], flush=True)
    json.dump(out, open(f'{ROOT}/final/sizes.json', 'w'), indent=1)
