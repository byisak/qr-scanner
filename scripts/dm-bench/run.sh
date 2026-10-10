#!/bin/sh
# ZXing 보조 판독 벤치 실행. Android Studio의 JBR과 gradle 캐시의 zxing jar를 찾아 쓴다 (별도 설치 없음).
#   scripts/dm-bench/run.sh center ~/Desktop/qr-scanner-samples/ix7m-nameplate.pgm
#   scripts/dm-bench/run.sh grid   <img> <cx> <cy> [crop]
#   scripts/dm-bench/run.sh locate <img> [scale...]
# 프레임 덤프 꺼내기: adb shell run-as com.cubion.qrscanner ls cache/frame-dumps  →  adb pull /data/data/com.cubion.qrscanner/cache/frame-dumps/<file>
# (디버그 서명 빌드에서만 run-as 가 된다. 릴리스 키 빌드면 앱 설정 > 개발자 옵션 > 덤프 공유로)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin"
[ -x "$JBR/java" ] || JBR=$(dirname "$(command -v java)")
ZXING=$(find "$HOME/.gradle/caches/modules-2/files-2.1/com.google.zxing/core" -name 'core-3.*.jar' 2>/dev/null | sort | tail -1)
[ -n "$ZXING" ] || { echo "zxing core jar를 gradle 캐시에서 못 찾음. android 빌드를 한 번 돌리면 생긴다" >&2; exit 1; }
OUT="$HERE/.build"
mkdir -p "$OUT"
[ "$OUT/Bench.class" -nt "$HERE/Bench.java" ] || "$JBR/javac" -encoding UTF-8 -cp "$ZXING" -d "$OUT" "$HERE/Bench.java"
exec "$JBR/java" -cp "$ZXING:$OUT" Bench "$@"
