# Phase 13 : Quêtes en base, SUMMARY

Branche `phase/13-quetes` (base `milestone/v1.20`, merge de milestone/v1.20 fait sans conflit). Aucun push, aucune écriture prod. Mobile + SQL (fichiers seuls).

## Livré
- **Migrations (fichiers seuls, non appliquées)** : `202612011301_quest_tables.sql` (`ziko_quest_templates`, `ziko_user_quests`, RLS SELECT-only, grants restreints, 3 quêtes de départ, source de pièces `quest`) ; `202612011302_quest_functions.sql` (`ziko_quest_period`, `ziko_quest_metric_value` internes ; `ziko_sync_quests` pour `authenticated` ; `ziko_create_quests` réservée à `service_role`). Toutes SECURITY DEFINER, `search_path` figé, REVOKE PUBLIC/anon. Ordre : après `1201` (reprend la source `achievement` dans le CHECK).
- **App** : `plugins/gamification/src/quests.ts` (logique pure), `screens/rewards/QuestsTab.tsx` (B12/B13/B05), `store.ts` (`syncQuests`, `syncQuestsQuiet`, appelé en fin de séance par `awardWorkoutXP`), `GamificationPlugin.tsx` (requête `rewards-quests`, re-mesure au retour sur l'onglet, toast + invalidation du solde), export `./quests`, libellé d'historique `Quête`. Le tableau en dur n'existe plus (déjà retiré par P12).
- **Stockage prêt pour P14** : `source='ai'`, `template_id` nul, `ai_meta jsonb`, `ziko_create_quests(uid, jsonb)` validée (liste blanche de métriques, cible > 0, pièces 0..500, durée 1..840 h). Ne plafonne PAS à 3 : QUEST-05 reste à P14.
- Décisions D-01..D-11 et gray areas G-1..G-7 dans `13-CONTEXT.md` (réponses recommandées marquées [A CONFIRMER]).

## Exigences
| Req | Statut | Preuve |
|---|---|---|
| QUEST-01 quêtes en base, progression sur données réelles | VERIFIED SQL local + rendu DOM ; PARTIAL bout en bout | SQL local : eau 1300 -> 1300/2000 puis 2000 -> terminée +15 une seule fois ; séance vide ignorée, séances réelles -> +25 puis hebdo +60 ; eau d'hier / d'un autre utilisateur non comptées ; DOM : l'onglet lit `ziko_sync_quests`, la ligne passe de `1,3 / 2 L` à `Terminé` après un retour sur l'onglet + toast + solde. La chaîne réelle (écran Hydratation -> base -> écran Quêtes) = UAT |
| QUEST-02 quêtes de départ identiques | VERIFIED SQL local | 2 comptes : signatures (slug, titre, cible, pièces, métrique, scope, icône) identiques, 3 quêtes (2 jour + 1 semaine = maquette B12) ; resync idempotent (3 lignes) |
| Non punitif v1.18 (transverse) | VERIFIED SQL + DOM | quête échue : `expired`, xp / pièces / série inchangés ; libellé `Non terminée · aucune pénalité` ; quête atteinte dans sa période mais synchronisée après échéance : créditée (pas « échouée ») |
| Écritures client interdites | VERIFIED SQL local | INSERT/UPDATE/DELETE directs refusés (permission denied), catalogue non modifiable, `ziko_create_quests` / mesure interne non appelables par un client, anon sans lecture, RLS : propres lignes seulement |

## Tests (comptes)
- Harnais SQL `scripts/uat/p13-quests-sql/run.mjs` : **53 PASS / 0 FAIL** sur un Postgres local jetable (port 8206, arrêté ensuite ; `P13_PG_URL` absent = SKIP, URL non locale refusée). Rejoue 1201 (dépendance), 1301, 1302 sur le stub P12 + `stub-extra.sql`.
- vitest unitaires `apps/mobile` : 293 (dont 19 `quests.test.ts`) ; render : 56 (dont 6 `quests.test.tsx`) ; vitest racine : 41 fichiers / 756 tests verts.
- Gate : `tsc --noEmit` `apps/mobile` et `plugins/gamification` = 0 erreur ; `check-migration-names` OK (20 fichiers v1.20 après merge). Modification d'un test P12 existant : `rewardsStore.test.ts` (l'appel de fin de séance n'est plus le dernier : `ziko_sync_quests` le suit).

## Deviations
- Libellés français en dur dans le plugin (convention plugin, comme P12). Pas de cron : progression exacte à la demande (ouverture/retour d'onglet, fin de séance), pas en arrière-plan.
- Le crédit des pièces d'une quête déjà expirée mais atteinte dans sa période est fait à la prochaine sync (choix délibéré, non punitif).
- La synchronisation de l'onglet tourne aussi quand l'écran Récompenses s'ouvre sur un autre onglet (toast de crédit possible sur Niveau).

## NON prouvé
Rendu natif (le stub DOM ignore styles, ombres, accessibilité, `progressbar`) ; le comportement réel sur la base portfolio (grants/défauts Supabase `ALTER DEFAULT PRIVILEGES`, données existantes, version Postgres) ; le fuseau Europe/Paris sur l'appareil UAT (l'eau est comparée à une date calendaire écrite par le client, G-7) ; la chaîne écran Hydratation/Séance -> base -> Quêtes ; renouvellement à minuit réel (simulé en SQL par décalage des périodes) ; accessibilité TalkBack ; montants 25/15/60 et cible d'eau fixe 2 L (G-2/G-3 à confirmer) ; migrations jamais appliquées hors Postgres local. Stub de test = schéma minimal, pas le schéma portfolio complet. Nuance : une quête IA (P14) démarre à sa création pour les séances (`started_at >= period_start`) mais compte l'eau/repas/habitudes depuis le début du jour Paris.

## Besoins humains
Approbation + application de 1301 puis 1302 (après 1201) avant l'UAT ; confirmer les [A CONFIRMER] de `13-CONTEXT.md` (fuseau, pièces, 2 L fixe, renouvellement des quêtes de départ) ; seeds UAT de `UAT-PLAN.md` (heure émulateur pour Q-7).

## Fichiers à risque de conflit
`plugins/gamification/src/screens/GamificationPlugin.tsx` et `store.ts` (P12 mergé ; P21 lecture seule) ; `supabase/migrations/202612011*` (bloc 13 distinct). P14 : lit `ziko_user_quests`, appelle `ziko_create_quests` / `ziko_sync_quests`, étend la liste blanche des métriques par migration (CHECK x2 + fonction de mesure + validation).
