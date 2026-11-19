# Builder art preview (Road Ready 10, guitar builder). Box or laptop only, not used by the app.
# Puts a build together from the files in art/guitars/builder/ the same way the app should (docs/guitars/BUILDER-ART.md),
# so the art can be checked without the app. Run from the repo root:
#   python3 -I tools/guitars/builder_preview.py porch '{"paint":"seafoam","guard":"leopard","metal":"gold"}' out.png
# A build names one choice per step; anything left out takes the manifest's default (the painting as it is).
import json, sys
import numpy as np
from PIL import Image

MAN = json.load(open("art/guitars/builder/manifest.json"))

def img(path):
    return np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255

def hexc(c):
    c = c.lstrip("#"); return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32) / 255

def overlay(b, s):  # canvas / CSS "overlay": b is what is already drawn, s is the layer drawn on top
    return np.where(b <= .5, 2 * b * s, 1 - 2 * (1 - b) * (1 - s))

def lerp(a, b, t):
    return a + (b - a) * t

def tex_at(path, h, w, anchor):
    # a texture drawn at 1:1 with its centre on the anchor, repeated if it is smaller than the picture
    t = img(path)[..., :3]; th, tw = t.shape[:2]
    yy = (np.arange(h) - anchor[1] + th // 2) % th; xx = (np.arange(w) - anchor[0] + tw // 2) % tw
    return t[yy][:, xx]

def compose(slug, build=None):
    g = MAN["guitars"][slug]; b = dict(MAN["default"]); b.update(build or {})
    d = MAN["dir"].format(slug=slug); T = MAN["tex"]
    base = img(MAN["base"].format(slug=slug)); H, W = base.shape[:2]
    out = base[..., :3].copy(); alpha = base[..., 3].copy()
    L = lambda k: img(d + g["files"][k])
    opt = g["options"]
    paint = b["paint"] if opt["paint"] else "original"
    top = b["top"] if b["top"] in opt["top"] and g.get("top_is_original") != b["top"] else "none"
    wear = MAN["wear"][b["wear"]]
    if paint != "original" or top != "none":
        pl = L("paint"); P = pl[..., 3]; shade = pl[..., 0]
        bq = Image.open(d + g["files"]["burst"]).convert("RGBA").getchannel("A")  # quarter size: draw it scaled up, smoothing on
        burst = np.asarray(bq.resize((W, H), Image.BILINEAR)).astype(np.float32) / 255; grain = L("grain")[..., 0]; spec = L("light")[..., 3]
        F = out.copy(); gop = .5; lit = 1.0; flake = 0
        if paint != "original":
            p = MAN["paints"][paint]; gop, lit, flake = p.get("grain", .2), p.get("light", 1), p.get("flake", 0)
            if p["kind"] == "burst":
                F = lerp(hexc(p["centre"]), hexc(p.get("mid", p["edge"])), burst[..., None])
                if "mid" in p: F = lerp(F, hexc(p["edge"]), (burst * burst)[..., None])
            else:
                F = np.broadcast_to(hexc(p["colour"]), (H, W, 3)).copy()
                if "edge" in p: F = lerp(F, hexc(p["edge"]), burst[..., None])
            mask = P
        else:
            mask = np.zeros_like(P)
        if top != "none":
            t = MAN["tops"][top]; Tm = L("top")[..., 3]; anchor = g["texture_anchor"]["top"]
            tx = tex_at(T + t["texture"], H, W, anchor)
            if t["texture"] == "flame.webp":
                Ft = lerp(hexc(t["centre"]), hexc(t.get("mid", t["edge"])), burst[..., None])
                if "mid" in t: Ft = lerp(Ft, hexc(t["edge"]), (burst * burst)[..., None])
                Ft = Ft * tx
            else:
                Ft = lerp(tx, hexc(t["edge"]), (burst * t.get("edge_strength", .5))[..., None])
            # the face takes the top; the thin edge round an electric body and a painted head take the top's rim colour
            if paint == "original": F = lerp(F, hexc(t["rim"]), np.clip(P - Tm, 0, 1)[..., None] > 0)
            F = lerp(F, Ft, Tm[..., None])
            mask = P
            if paint == "original": gop, lit = .45, 1.0
        F = lerp(F, overlay(F, grain[..., None]), gop)
        F = overlay(F, shade[..., None])
        if flake:
            fl = img(T + "flake.webp")[..., 3][(np.arange(H) % 256)][:, (np.arange(W) % 256)][..., None]  # a repeating pattern from (0, 0)
            F = lerp(F, np.ones(3), fl * flake * np.clip(shade * 1.6, 0, 1)[..., None])
        F = lerp(F, np.ones(3), (spec * lit * wear["light"])[..., None])
        out = lerp(out, np.clip(F, 0, 1), mask[..., None])
    if wear["overlay"]:
        w = L("worn" if b["wear"] == "worn" else "played")
        out = lerp(out, w[..., :3], w[..., 3:4])
    if opt["guard"] and "guard" in g["files"]:
        gl = L("guard"); G = gl[..., 3]; gs = gl[..., 0]
        gname = b["guard"]
        if g["options"]["guard_kind"] == "added" and gname == "original": gname = "none"
        if gname not in ("original", "none"):
            q = MAN["guards"][gname]; anchor = g["texture_anchor"]["guard"]
            Fg = tex_at(T + q["texture"], H, W, anchor) if "texture" in q else np.broadcast_to(hexc(q["colour"]), (H, W, 3)).copy()
            Fg = overlay(Fg, gs[..., None])
            spec = L("light")[..., 3]
            Fg = lerp(Fg, np.ones(3), (spec * q.get("light", 1) * wear["light"])[..., None])
            if "guard_age" in wear: Fg = lerp(Fg, Fg * hexc(wear["guard_age"]["colour"]), wear["guard_age"]["alpha"])
            out = lerp(out, np.clip(Fg, 0, 1), G[..., None])
        elif gname == "original" and "guard_age" in wear:
            out = lerp(out, out * hexc(wear["guard_age"]["colour"]), (G * wear["guard_age"]["alpha"])[..., None])
    m = MAN["metal"][b["metal"]]
    if not m.get("original") or wear.get("metal") == "dull":
        Mk = L("metal")[..., 3]
        grey = (out @ np.array([.2126, .7152, .0722], np.float32))[..., None].repeat(3, 2)
        tint = out if m.get("original") else overlay(grey, hexc(m["colour"]))
        if m.get("dull"): tint = lerp(tint, tint * .82, 1.0) * (1 - m["dull"]) + tint * m["dull"]
        if wear.get("metal") == "dull": tint = lerp(tint, tint.mean(axis=(0, 1)) * 0 + tint * .9 + .03, .6)
        out = lerp(out, np.clip(tint, 0, 1), Mk[..., None])
    if b.get("strings"):
        s = L("strings"); sa = s[..., 3:4]
        out = (out * alpha[..., None] * (1 - sa) + s[..., :3] * sa)
        alpha = alpha * (1 - sa[..., 0]) + sa[..., 0]
        out = out / np.maximum(alpha[..., None], 1e-4)
    return np.dstack([np.clip(out, 0, 1), np.clip(alpha, 0, 1)])

def save(rgba, path):
    Image.fromarray((rgba * 255 + .5).astype(np.uint8), "RGBA").save(path)

if __name__ == "__main__":
    slug = sys.argv[1]; build = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    save(compose(slug, build), sys.argv[3] if len(sys.argv) > 3 else f"/tmp/{slug}-build.png")
