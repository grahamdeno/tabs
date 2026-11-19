import glob, os
ROOT = os.environ.get('LOOKA_ROOT', '/workspace/cartoon-test/full')
os.chdir(ROOT)
from PIL import Image, ImageDraw
cur='cur'; new='final'
slugs=sorted(os.path.basename(f)[:-10] for f in glob.glob(f'{new}/*-road.webp'))
BG={'dark':(28,24,34),'cream':(246,238,222)}
def fit(im,h):
    w=max(1,round(im.width*h/im.height)); return im.resize((w,h),Image.LANCZOS)
cells=[]
for s in slugs:
    col=[]
    for src in (cur,new):
        r=Image.open(f'{src}/{s}-road.webp').convert('RGBA'); sm=Image.open(f'{src}/{s}-small.webp').convert('RGBA')
        for bgn,bg in BG.items():
            parts=[fit(r,190),fit(sm,56),fit(sm,32),fit(r,56),fit(r,32)]
            W=sum(p.width for p in parts)+6*8; H=200
            t=Image.new('RGBA',(W,H),bg+(255,)); x=6
            for p in parts: t.alpha_composite(p,(x,H-p.height-5)); x+=p.width+8
            col.append(t)
    cells.append((s,col))
cw=max(t.width for s,c in cells for t in c); ch=200
cols=6
rows=(len(cells)+cols-1)//cols
sheet=Image.new('RGB',(cols*(cw*2+20), rows*(ch*2+22)),(80,80,80)); d=ImageDraw.Draw(sheet)
for i,(s,c) in enumerate(cells):
    gx=(i%cols)*(cw*2+20); gy=(i//cols)*(ch*2+22)
    d.text((gx+4,gy+4),f'{s}: left before, right after; top dark, bottom cream; road 190, small 56/32, road 56/32',fill=(255,255,255))
    # before dark, before cream, after dark, after cream
    sheet.paste(c[0].convert('RGB'),(gx,gy+20)); sheet.paste(c[1].convert('RGB'),(gx,gy+20+ch))
    sheet.paste(c[2].convert('RGB'),(gx+cw+10,gy+20)); sheet.paste(c[3].convert('RGB'),(gx+cw+10,gy+20+ch))
sheet.save('before-after.jpg',quality=88); print(sheet.size)
