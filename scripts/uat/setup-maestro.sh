#!/usr/bin/env bash
# Installs Maestro OUTSIDE the repo into ~/.ziko-uat/maestro (needs network). Idempotent.
set -euo pipefail
. "$(dirname "$0")/env.sh"
if [ -x "$MAESTRO_HOME/bin/maestro.bat" ] || [ -x "$MAESTRO_HOME/bin/maestro" ]; then echo "maestro present"; maestro --version; exit 0; fi
mkdir -p "$UAT_TOOLS"
ZIP="$UAT_TOOLS/maestro.zip"
curl -fL -o "$ZIP" "https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip"
rm -rf "$UAT_TOOLS/_x" && mkdir -p "$UAT_TOOLS/_x"
unzip -q "$ZIP" -d "$UAT_TOOLS/_x"
rm -rf "$MAESTRO_HOME" && mv "$UAT_TOOLS/_x/maestro" "$MAESTRO_HOME"
rm -rf "$UAT_TOOLS/_x" "$ZIP"
maestro --version
