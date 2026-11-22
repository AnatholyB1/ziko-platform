#!/usr/bin/env bash
# Creates AVD ziko-uat-1 WITHOUT avdmanager (cmdline-tools absent): writes the .ini/config.ini directly.
# Idempotent. RAM 2048 MB max, Google APIs + Play Store image already installed in the SDK.
set -euo pipefail
. "$(dirname "$0")/env.sh"
NAME="${1:-$UAT_AVD}"
IMG="system-images/android-36/google_apis_playstore/x86_64/"
[ -d "$ANDROID_HOME/$IMG" ] || { echo "system image missing: $IMG" >&2; exit 1; }
AVD_HOME="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
DIR="$AVD_HOME/$NAME.avd"
mkdir -p "$DIR"
WINDIR="$(cygpath -w "$DIR")"
cat > "$AVD_HOME/$NAME.ini" <<EOF
avd.ini.encoding=UTF-8
path=$WINDIR
path.rel=avd/$NAME.avd
target=android-36
EOF
cat > "$DIR/config.ini" <<EOF
AvdId=$NAME
PlayStore.enabled=true
abi.type=x86_64
avd.ini.displayname=$NAME
avd.ini.encoding=UTF-8
disk.dataPartition.size=6G
fastboot.forceColdBoot=yes
hw.accelerometer=yes
hw.audioInput=no
hw.audioOutput=no
hw.battery=yes
hw.camera.back=virtualscene
hw.camera.front=emulated
hw.cpu.arch=x86_64
hw.cpu.ncore=4
hw.device.manufacturer=Google
hw.device.name=pixel_6
hw.gps=yes
hw.gpu.enabled=yes
hw.gpu.mode=auto
hw.initialOrientation=portrait
hw.keyboard=yes
hw.lcd.density=420
hw.lcd.height=2400
hw.lcd.width=1080
hw.ramSize=2048
hw.sdCard=no
hw.sensors.orientation=yes
hw.sensors.proximity=yes
image.sysdir.1=system-images/android-36/google_apis_playstore/x86_64/
runtime.network.latency=none
runtime.network.speed=full
showDeviceFrame=no
skin.dynamic=yes
tag.display=Google Play
tag.id=google_apis_playstore
vm.heapSize=256
EOF
echo "AVD '$NAME' written to $DIR"
"$ANDROID_HOME/emulator/emulator.exe" -list-avds
