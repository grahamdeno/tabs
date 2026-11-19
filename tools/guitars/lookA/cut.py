"""Cut-out from a flat chroma background (green or magenta). Matte traced at 4x, smoothed, pins opened away on the
body, largest piece kept, holes filled. Rim: the outer pixels take the colour of the solid paint a little inside,
so no green, olive or yellow cast is left at the edge."""
import sys, numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
S = 4
def cutout(path, open_r=9, open_from=0.40):
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    cs = np.concatenate([rgb[:24,:24].reshape(-1,3), rgb[:24,-24:].reshape(-1,3), rgb[-24:,:24].reshape(-1,3), rgb[-24:,-24:].reshape(-1,3)])
    bg = np.median(cs, 0)
    # the background varies a little across the frame: a smooth model from the border pixels
    dist = np.linalg.norm(rgb - bg, axis=2)
    green = bg[1] > max(bg[0], bg[2])
    if green:
        key = rgb[...,1] - np.maximum(rgb[...,0], rgb[...,2]); kb = bg[1] - max(bg[0], bg[2])
    else:
        key = np.minimum(rgb[...,0], rgb[...,2]) - rgb[...,1]; kb = min(bg[0], bg[2]) - bg[1]
    soft = np.clip((dist - 35) / 50, 0, 1)
    soft = np.where(key > kb*0.6, soft*np.clip((kb*0.9-key)/(kb*0.3),0,1), soft)
    big = cv2.resize(soft.astype(np.float32), (w*S, h*S), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0,0), 2.5)
    m = (big > 0.5).astype(np.uint8)
    if open_r:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_r*S|1, open_r*S|1))
        cut = int(m.shape[0]*open_from)
        m[cut:] = cv2.morphologyEx(m[cut:], cv2.MORPH_OPEN, k)
    lab, n = ndi.label(m)
    if n > 1:
        sizes = ndi.sum(m, lab, range(1, n+1)); m = np.isin(lab, [i+1 for i,z in enumerate(sizes) if z > 0.05*sizes.max()]).astype(np.uint8)
    m = ndi.binary_fill_holes(m).astype(np.float32)
    m = cv2.GaussianBlur(m, (0,0), 3.0)
    m = np.clip((m - 0.5) * 3 + 0.5, 0, 1)
    hard = cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA) > 0.5
    out = rgb.copy()
    def keyf(c):
        return (c[...,1] - (c[...,0] + c[...,2])/2) if green else ((c[...,0] + c[...,2])/2 - c[...,1])
    kbg = keyf(bg[None, None, :])[0, 0]
    # clean paint: well inside the cut, or with no background cast at all
    inner = ndi.binary_erosion(hard, iterations=2)
    clean = inner & (keyf(rgb) < kbg * 0.18)
    clean |= ndi.binary_erosion(hard, iterations=5)
    band = hard & ~clean
    # the rim takes a smooth blend of the clean paint next to it (normalised blur, so no speckle)
    cf = clean.astype(np.float32)
    num = cv2.GaussianBlur(rgb * cf[..., None], (0, 0), 1.6); den = cv2.GaussianBlur(cf, (0, 0), 1.6)[..., None]
    fill = num / np.maximum(den, 1e-4)
    _, (iy, ix) = ndi.distance_transform_edt(~clean, return_indices=True)
    fill = np.where(den > 0.02, fill, rgb[iy, ix])
    out = np.where(band[..., None], fill, out)
    if green: out[...,1] = np.minimum(out[...,1], np.maximum(out[...,0], out[...,2]) + 10)
    # pull the matte in by half a pixel so the outermost mixed pixels go
    m = np.clip(cv2.GaussianBlur(m, (0, 0), 1.0) * 1.0, 0, 1)
    m = np.clip((cv2.erode(m, np.ones((3, 3), np.uint8)) - 0.0), 0, 1)
    _, (iy, ix) = ndi.distance_transform_edt(~hard, return_indices=True)
    out = out[iy, ix]
    return out.astype(np.uint8), m, bg
def save4(src, dst, **kw):
    rgb, m, bg = cutout(src, **kw)
    h, w, _ = rgb.shape
    big = cv2.resize(rgb, (w*S, h*S), interpolation=cv2.INTER_CUBIC)
    Image.fromarray(np.dstack([big, (m*255).astype(np.uint8)])).save(dst)
if __name__ == '__main__':
    save4(sys.argv[1], sys.argv[2])
