# UAT-RESULTS P19 (run2, 2026-11-13) - cumul run1 (catalogue, "des 21,00 EUR", stack vide PASS)

| Id | Verdict | Detail |
|---|---|---|
| Ouverture `supplements/list` | FAIL | Redbox "Uncaught Error - Cannot find native module 'ExpoTopicSubscriptionModule'". Cause probable : `plugins/supplements/src/lib/notifications.ts` importe `expo-notifications` non declare dans le package du plugin ; Metro le resout au `node_modules/expo-notifications` HOISTE (v56.0.14, exige ExpoTopicSubscriptionModule) alors que `apps/mobile` pin `~0.32.16` (natif du dev-client). Meme risque en build prod. Habits/hydration/sleep/coach importent aussi `expo-notifications` depuis `plugins/*`. Run1 avait ouvert l'ecran sans erreur : la resolution a change (npm install --no-save recent). |
| Comparateur, favoris, stack | BLOQUE | Grants de fixture appliques sur ziko_user_supplement_stack / intakes / reminder_prefs (aucun GRANT authenticated sur la branche, meme symptome que P18). |
