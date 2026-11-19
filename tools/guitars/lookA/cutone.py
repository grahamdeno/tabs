import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import cut
ROOT = os.environ.get('LOOKA_ROOT', '/workspace/cartoon-test/full')
os.chdir(ROOT)
for s in sys.argv[1:]:
    kw = dict(open_r=0) if s in ('tartanpin',) else {}
    cut.save4(f'gen/{s}.jpg', f'cut/{s}-4x.png', **kw)
