#!/usr/bin/env bash
# Instalează APK-ul pe emulator, pornește aplicația și salvează logcat + captură de ecran.
set +e
OUT=smoke
mkdir -p $OUT
adb wait-for-device
adb install -r app.apk > $OUT/install.txt 2>&1
adb logcat -c
adb shell am start -W -n com.tskyes.sinestezia/.MainActivity > $OUT/start.txt 2>&1
sleep 30
adb exec-out screencap -p > $OUT/ecran.png
# câteva atingeri pe claviatură (rândul din mijloc) ca să apară note în vizualizator
SIZE=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${SIZE%x*}; H=${SIZE#*x}
for f in 15 25 35 45 55 65; do adb shell input tap $((W*f/100)) $((H*72/100)); sleep 0.4; done
for f in 20 40 60; do adb shell input tap $((W*f/100)) $((H*62/100)); sleep 0.4; done
sleep 2
adb exec-out screencap -p > $OUT/ecran-dupa-note.png
PID=$(adb shell pidof com.tskyes.sinestezia | tr -d '\r')
echo "pid=$PID" > $OUT/pid.txt
adb logcat -d -v threadtime > $OUT/logcat.txt
adb logcat -d -b crash > $OUT/crash.txt
grep -E "AndroidRuntime|ReactNative|ReactNativeJS|FATAL|libc|DEBUG|Skia|audio" $OUT/logcat.txt > $OUT/filtrat.txt
exit 0
