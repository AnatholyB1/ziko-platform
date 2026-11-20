#!/usr/bin/env bash
# Queue / inspect scripted replies of the fake Anthropic (8211). Never calls the real API.
#   fake-script.sh clear
#   fake-script.sh assess [hydration_log|journal_mood|measurements_weight]   queue ONE onboarding assess_profile tool call
#   fake-script.sh log
# Note: /ai/session/generate parses a JSON object out of the model TEXT; the fake's default text has none,
# so the fake was extended with a text-script mode (see fake-anthropic.mjs: POST /__script {"text":"..."}).
F=http://127.0.0.1:8211/__script
case "${1:?cmd}" in
  clear) curl -s -X DELETE $F; echo;;
  log) curl -s $F; echo;;
  assess)
    MA="${2:-hydration_log}"
    curl -s -X POST $F -H 'content-type: application/json' -d "{\"tool\":\"assess_profile\",\"count\":1,\"skip\":${SKIP:-0},\"input\":{\"experience_level\":\"beginner\",\"experience_confidence\":4,\"adherence_risk\":\"medium\",\"adherence_confidence\":3,\"readiness\":\"fragile\",\"readiness_confidence\":4,\"profile_summary\":\"Tu debutes, on y va doucement et regulierement.\",\"micro_action\":\"$MA\",\"mission_title\":\"Bois un premier verre d'eau\"}}"; echo;;
  session)
    curl -s -X POST $F -H 'content-type: application/json' -d '{"text":"{\"adaptation_note\":\"Energie moyenne : charges moderees et volume reduit.\",\"exercises\":[{\"name\":\"Squat goblet\",\"sets\":\"3 x 10\",\"note\":\"Dos droit\"},{\"name\":\"Developpe couche halteres\",\"sets\":\"3 x 8-10\"},{\"name\":\"Rowing unilateral\",\"sets\":\"3 x 10\"},{\"name\":\"Gainage planche\",\"sets\":\"3 x 40 s\"}]}","count":1}'; echo;;
esac
