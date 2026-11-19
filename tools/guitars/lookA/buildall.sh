cd "${LOOKA_ROOT:-/workspace/cartoon-test/full}"
printf "%s\n" "$@" | xargs -P 4 -I{} sh -c "python3 tools/build.py {} > logs/{}.txt 2>&1"; cat logs/*.txt | grep -v Warn
