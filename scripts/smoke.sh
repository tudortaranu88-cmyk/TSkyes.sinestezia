#!/usr/bin/env bash
# Instalează APK-ul pe emulator, pornește aplicația, o folosește puțin și salvează capturi + loguri.
set +e
OUT=smoke
PKG=com.tskyes.sinestezia
mkdir -p $OUT
shot() { adb exec-out screencap -p > "$OUT/$1.png"; }
# atinge elementul cu textul dat (primul găsit în ierarhia UI)
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  adb shell cat /sdcard/ui.xml > $OUT/ui.xml
  local b
  b=$(grep -oE "text=\"$1\"[^>]*bounds=\"\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]\"" $OUT/ui.xml | head -1 | grep -oE '[0-9]+' | tail -4 | tr '\n' ' ')
  if [ -z "$b" ]; then echo "nu am găsit: $1" >> $OUT/pasi.txt; return 1; fi
  set -- $b
  adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
  echo "atins: $1 $2 $3 $4" >> $OUT/pasi.txt
}

adb wait-for-device
adb install -r app.apk > $OUT/install.txt 2>&1
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity > $OUT/start.txt 2>&1
sleep 25
shot 1-pornire

SIZE=$(adb shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1); W=${SIZE%x*}; H=${SIZE#*x}
for f in 15 25 35 45 55 65; do adb shell input tap $((W*f/100)) $((H*72/100)); sleep 0.5; done
for f in 20 40 60 80; do adb shell input tap $((W*f/100)) $((H*62/100)); sleep 0.5; done
sleep 2
shot 2-dupa-note

echo "== instrumente" >> $OUT/pasi.txt
tap_text "‹"; sleep 1.5; shot 3-instrumente
tap_text "Vioara"; sleep 1
for f in 30 50 70; do adb shell input tap $((W*f/100)) $((H*68/100)); sleep 0.5; done

echo "== salvare" >> $OUT/pasi.txt
tap_text "Salvează"; sleep 1.5; shot 4-panou-salvare
tap_text "Salvează în telefon"; sleep 6; shot 5-dupa-salvare
tap_text "Allow" || tap_text "Permite" || tap_text "ALLOW"; sleep 8; shot 6-dupa-permisiune
adb shell input keyevent KEYCODE_BACK; sleep 1

echo "== autotest export" >> $OUT/pasi.txt
adb shell am start -a android.intent.action.VIEW -d "musiccolor://selftest" $PKG >> $OUT/start.txt 2>&1
for i in $(seq 1 60); do adb logcat -d | grep -q "SELFTEST done" && break; sleep 2; done
shot 7-autotest
adb shell ls -l /sdcard/Pictures /sdcard/DCIM /sdcard/Music > $OUT/fisiere-telefon.txt 2>&1

PID=$(adb shell pidof $PKG | tr -d '\r')
echo "pid=$PID" > $OUT/pid.txt
adb logcat -d -v threadtime > $OUT/logcat.txt
adb logcat -d -b crash > $OUT/crash.txt
grep -oE "SELFTEST.*" $OUT/logcat.txt > $OUT/selftest.txt
grep -E "AndroidRuntime|ReactNativeJS|FATAL|libc|DEBUG" $OUT/logcat.txt > $OUT/filtrat.txt
rm -f $OUT/ui.xml
exit 0
