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
PID=$(adb shell pidof com.tskyes.sinestezia | tr -d '\r')
echo "pid=$PID" > $OUT/pid.txt
adb logcat -d -v threadtime > $OUT/logcat.txt
adb logcat -d -b crash > $OUT/crash.txt
grep -E "AndroidRuntime|ReactNative|ReactNativeJS|FATAL|libc|DEBUG|Skia|audio" $OUT/logcat.txt > $OUT/filtrat.txt
exit 0
