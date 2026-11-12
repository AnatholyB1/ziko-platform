#!/usr/bin/env bash
# Sourced by other uat scripts. Paths for the Android toolchain (Windows / Git Bash).
export ANDROID_HOME="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Android/openjdk/jdk-21.0.8}"
export UAT_TOOLS="${UAT_TOOLS:-$HOME/.ziko-uat}"          # out-of-repo tools (maestro)
export MAESTRO_HOME="$UAT_TOOLS/maestro"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$MAESTRO_HOME/bin:$JAVA_HOME/bin:$PATH"
export UAT_AVD="${UAT_AVD:-ziko-uat-1}"
export UAT_CONSOLE_PORT=5554          # adb serial emulator-5554 (adb port 5555)
export UAT_SERIAL="emulator-5554"
export UAT_PKG="com.ziko.mobile"
UAT_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export UAT_REPO
export UAT_EVIDENCE="${UAT_EVIDENCE:-$UAT_REPO/uat-evidence}"
