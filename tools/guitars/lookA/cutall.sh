cd /workspace/cartoon-test/full
ls gen/*.jpg | xargs -n1 basename | sed "s/.jpg//" | xargs -P 4 -n1 python3 tools/cutone.py
