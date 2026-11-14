# Phase 14 : Plan d'UAT émulateur (Outil IA de quêtes)

En file (après P1). Préalable : migrations `20261201120100`, `1301`, `1302`, **`1401`, `1402`** appliquées par l'orchestrateur après approbation, sur la branche jetable `uat-v1-20` uniquement. Backend UAT : `bash scripts/uat/backend-start.sh` (faux Upstash 8210, faux Anthropic 8211, backend 8200 ; émulateur : `EXPO_PUBLIC_API_URL=http://10.0.2.2:8200`). Détail : `.planning/workstreams/uat-mobile/UAT-BACKEND.md`.

Capture = captures d'écran émulateur + `uiautomator dump` + requêtes SQL lecture seule (ci-dessous). Compte de test : `uat-athlete` (+ un 2e compte B pour l'isolation).

## Pilotage du FAUX Anthropic (aucun coût réel)
- **Génération automatique** (`generateObject`) : l'outil structuré s'appelle `json`. Armer avant l'étape :
  `curl -X POST http://127.0.0.1:8211/__script -d '{"tool":"json","input":{"quests":[{"title":"Boire 2,5 litres","metric":"hydration_ml","target":2500,"scope":"daily","duration_hours":24,"reward_coins":15,"icon":"water"},{"title":"4 séances cette semaine","metric":"workout_sessions","target":4,"scope":"weekly","duration_hours":168,"reward_coins":60},{"title":"3 repas notés","metric":"nutrition_logs","target":3,"scope":"daily","duration_hours":24,"reward_coins":10}]},"count":1}'`
  Vérifier l'appel : `GET http://127.0.0.1:8211/__script` (journal : `decision: tool:json`).
- **Outil du chat** : message utilisateur `[[tool:quests_create {"title":"Boire 2 L","metric":"hydration_ml","target":2000,"scope":"daily","duration_hours":24,"reward_coins":15}]]` ; `[[tool:quests_get]]` pour lister.

| Id | Seed | Étapes | Mesure (réussite) |
|---|---|---|---|
| QA-1 | compte neuf, jamais de quête | Récompenses > Quêtes | 3 quêtes de départ (P13) ; AUCUN appel IA (journal du faux vide) ; `ziko_quest_ai_state` : pas de génération (`reason not_initialized` puis `full`) |
| QA-2 | compte QA-1 ; marquer les 3 départs `completed` (service_role, hors app) puis armer le faux (script `json` ci-dessus) | rouvrir Quêtes | 3 quêtes IA apparaissent (titres du script), chacune avec un « se renouvelle dans N h » / durée limite ; base : 3 lignes `source='ai'`, `status='active'`, `ai_meta.trigger='no_quest'` ; journal du faux : 1 appel `json` ; `ziko_ai_cost_log` : 1 ligne `source='quest_generation'` (tokens du faux) ; AUCUN débit de crédits (`/credits/balance` inchangé) |
| QA-3 | compte QA-2 (3 actives) ; armer le faux | rouvrir Quêtes plusieurs fois | toujours 3 ; journal du faux inchangé (pas d'appel) ; base : COUNT actives = 3 |
| QA-4 | compte QA-2 ; terminer 1 quête (logguer l'eau 2500 ml) → 2 actives ; monter le niveau (service_role : `UPDATE ziko_user_gamification SET level = level + 1`) ; armer le faux | rouvrir Quêtes | 1 quête IA créée (`ai_meta.trigger='level_up'`, places libres = 1) ; total actives = 3 ; le faux a produit 3 propositions mais 1 seule est insérée |
| QA-5 | compte QA-4 ; monter le niveau encore avec 3 actives | rouvrir Quêtes | aucune création, aucun appel IA ; le niveau est marqué vu (`ziko_quest_ai_state.last_level`) |
| QA-6 | quota : compte avec 0 active ; armer le faux 3 fois ; forcer 3 générations auto dans la journée (vider les quêtes créées entre chaque, service_role) | rouvrir Quêtes | 2 appels IA max par jour : le 3e = `daily_cap`, journal du faux = 2 `json`, `ziko_ai_cost_log` = 2 lignes |
| QA-7 | quête IA dont `expires_at` est passé (service_role : `UPDATE ... SET period_start=now()-interval '3 days', expires_at=now()-interval '1 day'`) et aucune autre active | ouvrir Quêtes | la quête s'affiche dans la section `Non terminées`, libellé `Non terminée · aucune pénalité`, aucun mot « échec / perdu » ; compteur d'actives = 0 ; `ziko_user_gamification` (xp, coins, série) inchangé avant/après |
| QA-8 | QA-7 puis nouvelle génération (faux armé) | rouvrir Quêtes | de nouvelles quêtes IA remplacent l'échue : elle disparaît de l'écran (reste en base `expired`) |
| QA-9 | chat | message `[[tool:quests_get]]` | réponse du faux après `tool_result` ; journal : `quests_get` exécuté ; `ziko_user_quests` inchangée |
| QA-10 | chat, 3 actives | message `[[tool:quests_create {...}]]` | outil exécuté mais refusé (`max_active_quests`), AUCUNE ligne créée ; chat débité 1 fois (creditDeduct chat) |
| QA-11 | chat, 1 active | message `[[tool:quests_create {...}]]` | 1 quête créée (`ai_meta.trigger='chat'`), durée et pièces bornées ; la quête ne peut pas être refusée côté app (aucun bouton refuser/supprimer) |
| QA-12 | tentative d'écriture client | `PATCH` / `DELETE ziko_user_quests` avec le jeton de A ; `POST /quests/refresh` sans jeton ; `rpc ziko_create_ai_quests` avec le jeton de A | 403 / permission denied / 401 ; B ne peut rien voir ni créer pour A |
| QA-13 | mode avion sur l'onglet Quêtes | ouvrir Quêtes | carte `Quêtes indisponibles` + `Réessayer` (P13) ; l'échec de `POST /quests/refresh` ne casse jamais l'écran |
| QA-14 | personnalisation (QUEST-08) | comparer 2 comptes de profil différent (objectif / plugins) ; intercepter le prompt (journal du faux, `GET /__script` ne l'affiche pas : lire `backend` log ou test `service.test.ts`) | prompt = objectif, âge, poids, niveau, focus, plugins actifs, quêtes récentes ; plugin Hydratation désactivé => aucune proposition `hydration_ml` n'est insérée |

## Appel réel ultérieur (orchestrateur, UN seul)
Sur la branche jetable, backend UAT avec `ANTHROPIC_API_KEY` réelle (jamais prod) : 1 génération `no_quest` sur un compte neuf après complétion des départs. Mesurer : JSON valide (`metric` dans la liste), cibles réalistes pour le profil, ton non punitif, 3 quêtes max, durées 12..336 h, 1 ligne `ziko_ai_cost_log`. Compte rendu dans `14-SUMMARY.md` (section « appel réel »).

## Vérification base (lecture seule en UAT)
```sql
SELECT slug, source, scope, status, progress, target, reward_coins, expires_at, ai_meta
FROM ziko_user_quests WHERE user_id = :uid ORDER BY created_at;
SELECT last_level, auto_day, auto_count, last_generated_at FROM ziko_quest_ai_state WHERE user_id = :uid;
SELECT model, input_tokens, output_tokens, source, created_at FROM ziko_ai_cost_log
WHERE user_id = :uid AND source = 'quest_generation' ORDER BY created_at DESC;
SELECT COUNT(*) FROM ziko_user_quests WHERE user_id = :uid AND status = 'active' AND expires_at > now(); -- <= 3
```

## Besoins humains
Approbation + application de `1401` puis `1402` (après P13) ; confirmer les [A CONFIRMER] de `14-CONTEXT.md` (relais starters → IA, pièces IA, quota 2/jour, niveau pris) ; manipuler le niveau / les échéances par service_role (hors app) pour QA-4..8 ; 1 appel réel Anthropic autorisé.
