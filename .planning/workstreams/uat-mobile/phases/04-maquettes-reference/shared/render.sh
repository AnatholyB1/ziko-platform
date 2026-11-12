#!/bin/sh
# Usage: sh render.sh lot-A   (depuis shared/). PW_CORE = chemin de playwright-core, IONICONS_SVG = dossier dist/svg d'ionicons (seulement si une icone manque dans shared/icons).
export PW_CORE="${PW_CORE:-/c/Users/Anatholy/AppData/Local/npm-cache/_npx/411d535eabdf86de/node_modules/playwright-core}"
export IONICONS_SVG="${IONICONS_SVG:-/c/Users/Anatholy/AppData/Local/Temp/claude/1a922857a21dc75c/b7b7ffef-76a5-4171-9ee6-8143c43314ff/scratchpad/pk/ionicons-8.1.0/package/dist/svg}"
node "$(dirname "$0")/build.mjs" "$@"
