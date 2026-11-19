import sys, os; sys.path.insert(0, os.path.dirname(__file__)); import cut
for s in sys.argv[1:]:
    kw = dict(open_r=0) if s in ('tartanpin',) else {}
    cut.save4(f'gen/{s}.jpg', f'cut/{s}-4x.png', **kw)
