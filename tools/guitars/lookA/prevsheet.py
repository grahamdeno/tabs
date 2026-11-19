import sys, json
sys.argv=['x']; exec(open('tools/guitars/builder_preview.py').read().split('if __name__')[0])
from PIL import Image
builds=[{}, {"paint":"seafoam","guard":"leopard","metal":"gold"}, {"paint":"candy","wear":"played"}, {"paint":"black","top":"koa","wear":"worn","strings":True}, {"paint":"tobacco","guard":"tortoise","metal":"nickel"}]
tag=sys.stdin.read().strip() or 'a'
for s in ['porch','cornerstone','clubslab','hollowhill','swing','koaarc','comet']:
    ims=[]
    for b in builds:
        a=compose(s,b); im=Image.fromarray((np.clip(a,0,1)*255).astype('uint8'),'RGBA')
        bg=Image.new('RGBA',im.size,(34,30,40,255)); bg.alpha_composite(im); ims.append(bg.convert('RGB').resize((im.width//2,im.height//2)))
    w=sum(i.width for i in ims); h=max(i.height for i in ims); r=Image.new('RGB',(w,h)); x=0
    for i in ims: r.paste(i,(x,0)); x+=i.width
    r.save(f'/workspace/cartoon-test/full/v/prev/{s}-{tag}.jpg',quality=85)
