# Phase 14 : Outil IA de quêtes, SUMMARY

Branche `phase/14-quetes-ia` (base `milestone/v1.20`, merge de `milestone/v1.20` refait sans conflit). Aucun push, aucune écriture prod, aucun appel IA réel. Backend + SQL (fichiers seuls) + déclencheur mobile minimal.

## Livré
- **Migrations (fichiers seuls, non appliquées)** : `202612011401_quest_ai_state.sql` (table `ziko_quest_ai_state` sans policy, `ziko_quest_ai_claim` = décide si l'IA doit être appelée + quota quotidien, `ziko_create_ai_quests` = création plafonnée à 3 actives sous verrou ; service_role seul) ; `202612011402_quest_sync_ai_handover.sql` (remplace `ziko_sync_quests` : relais starters → IA, visibilité des quêtes échues jusqu'au remplacement ; signature inchangée).
- **Backend** : `backend/api/src/quests/{rules,service}.ts` (+ tests), `tools/quests.ts` (`quests_get`, `quests_create`, enregistrés dans `tools/registry.ts` : import + 2 exécuteurs + 1 bloc de schémas), `routes/quests.ts` (`POST /quests/refresh`, monté dans `app.ts`), `lib/autonomousCost.ts` (+ source `quest_generation`).
- **Mobile (minimal)** : `plugins/gamification` : `requestAiQuests` (store), `hasFreeQuestSlot` (quests.ts), appel dans la requête de l'onglet Quêtes quand une place est libre puis re-sync.
- Décisions D-01..D-11, gray areas G-1..G-7 dans `14-CONTEXT.md` ; `UAT-PLAN.md` (QA-1..14, faux Anthropic outil `json` pour la génération auto, marqueur `[[tool:...]]` pour le chat).

## Exigences
| Req | Statut | Preuve |
|---|---|---|
| QUEST-03 outil de gestion | VERIFIED (mock) | `quests_get` / `quests_create` dans `allToolSchemas` + exécuteurs (`routes/quests.test.ts`), logique `service.test.ts`. Choix d'outil spontané par le vrai modèle : non prouvé |
| QUEST-04 création au niveau / sans quête | VERIFIED SQL local + mock | SQL : `level_up` (niveau N -> N+1, une seule fois), `no_quest`, `not_initialized`, quota ; backend : appel IA seulement si `proceed`, 0 appel sinon |
| QUEST-05 max 3 actives, créé = reste | VERIFIED SQL local | 4 proposées / 3 places -> 3 ; 4e refusée ; niveau gagné avec 1 active -> 2 créées ; course de 2 connexions parallèles -> 3 actives au total |
| QUEST-06 pas de refus, durée limite | VERIFIED (SQL + registre) | DELETE/UPDATE client refusés ; aucun outil suppression/refus ; durée bornée 12..48 h (jour) / 72..336 h (semaine), défaut présent, base 1..840 h |
| QUEST-07 échue visible neutre, hors des 3 | VERIFIED SQL local + mock | statut `expired`, hors du compte, renvoyée à l'app jusqu'à une quête IA plus récente ; xp/pièces/série inchangés ; libellé `Non terminée` (aucun « échec »). Rendu écran = P13 (onglet `Non terminées`), UAT à faire |
| QUEST-08 personnalisation | PARTIAL | le prompt reçoit l'identité complète et les métriques sont filtrées par plugins actifs (`service.test.ts`) ; la PERTINENCE réelle des quêtes proposées n'est pas prouvée (faux/mock) |
| Crédits (décision) | VERIFIED mock | auto : aucun `creditCheck/Deduct`, coût journalisé `quest_generation` (même en échec), quota 2/jour (SQL) ; chat : via la route de chat existante, pas de double débit |

## Tests (comptes)
- Backend vitest : **28 fichiers / 343 tests passés** (3 skipped, 14 todo préexistants) dont nouveaux : `rules.test.ts` 14, `service.test.ts` 17, `routes/quests.test.ts` 7 (38). `tsc --noEmit` backend et mobile : 0 erreur.
- Harnais SQL `scripts/uat/p14-quests-sql/run.mjs` : **41 PASS / 0 FAIL** sur Postgres 18 local jetable (port 8206, arrêté ensuite ; `P14_PG_URL` absent = SKIP, URL non locale refusée). Rejoue 1201, 1301, 1302, 1401, 1402 sur le stub P12/P13.
- Mobile : vitest unitaires 296 (dont 3 nouveaux P14), render 56 ; `check-migration-names` OK (24 fichiers v1.20).

## Déviations / choix à noter
- Le CONTEXT a été finalisé après le premier build (les décisions de fond étaient arrêtées avant) ; aucun écart avec le code.
- Déclencheur côté app ajouté (petit) dans `plugins/gamification` (store + requête de l'onglet), seule façon d'avoir un déclenchement sans cron ; pas d'UI nouvelle. Fichier partagé avec P12/P13 : conflit possible mais localisé.
- Le chat ne fait pas de second appel de modèle : `quests_create` crée UNE quête par appel, personnalisée par le contexte utilisateur déjà injecté.
- Aucun test existant modifié.

## NON prouvé
Qualité/pertinence/ton des quêtes du vrai Claude et choix spontané de l'outil (mocks et faux uniquement) ; le comportement des migrations 1401/1402 sur la base portfolio (grants par défaut Supabase, données existantes, version Postgres ; testé sur PG 18 local + stub) ; `auth.role()` service_role réel via PostgREST (simulé par `set_config`) ; fuseau Europe/Paris sur l'appareil ; rendu natif des quêtes IA (durée, section `Non terminées`) ; le déclencheur mobile en conditions réelles (réseau, jeton, `EXPO_PUBLIC_API_URL` de l'émulateur : testé avec `fetch` simulé) ; timing exact « au gain de niveau » (vu à la prochaine ouverture de l'onglet, G-5) ; coût réel (tokens du faux) ; accessibilité.

## Appel réel (orchestrateur, à faire)
1 génération sur la branche jetable (voir `UAT-PLAN.md`, section dédiée). Non fait ici.

## Besoins humains
Approbation + application de 1401 puis 1402 (après 1201/1301/1302) ; confirmer G-1..G-5 de `14-CONTEXT.md` ; UAT QA-1..14 ; 1 appel Anthropic réel autorisé.

## Fichiers à risque de conflit
`backend/api/src/tools/registry.ts` (3 insertions additives, P16/P23 ajoutent après) ; `backend/api/src/app.ts` (import + 1 route) ; `backend/api/src/lib/autonomousCost.ts` (1 ligne dans `SOURCES`) ; `plugins/gamification/src/{store.ts,quests.ts,screens/GamificationPlugin.tsx}` (P12/P13 chaîne ; P21 lecture seule) ; `supabase/migrations/202612011401-1402` (bloc 14, 1402 remplace `ziko_sync_quests` de 1302 : toute phase ultérieure qui la redéfinit doit partir de 1402).
