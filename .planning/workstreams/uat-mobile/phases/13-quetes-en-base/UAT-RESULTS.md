## Run 9 (2026-11-13, UI émulateur) - quête d'eau rejouée par l'interface (réconciliation run 8)
Méthode : quête `Boire 1 litre (run9)` (hydration_ml, 1000, daily, 8 h) créée via le faux `quests_create` (`/ai/chat`), puis 4 x Quick Log eau de l'accueil (+250 ml chacun, tuile 14,50 -> 15,50 L) APRÈS la création, puis ouverture de Récompenses > Quêtes. Captures : `uat-evidence/run9/q2.png` (0,3 / 1 L), `q6.png` (Terminé).
| Id | Verdict | Détail |
|---|---|---|
| Q-quête eau par l'UI | PASS | 1 saisie (250 ml) -> après ouverture de l'onglet : `progress=250`, UI `0,3 / 1 L` (barre 190/760 px = 25 %). 4 saisies (1000 ml) -> remontage de l'écran : `progress=1000`, `status=completed`, carte `Terminé · +15 pièces récupérées`. La progression compte bien les saisies postérieures à la création : le FAIL annoncé au run 8 n'est PAS reproduit (cause probable de la confusion : voir « Piège »). |
| Piège (comportement, pas un bug de calcul) | CONSTAT | La progression n'est recalculée que par `ziko_sync_quests`, appelé à l'ouverture/remontage de l'écran Récompenses (`GamificationPlugin.tsx:101-116`), jamais par le Quick Log. Un lien profond vers un écran déjà monté ne recharge rien : l'UI et la base restent figées à 250 (constaté 3 fois). Un testeur qui logue de l'eau puis revient sur un écran déjà monté voit « non compté » : probable origine du FAIL du run 8. Aucune mise à jour en direct sur l'accueil. |
| Complétion : pièces créditées | FAIL (artefact de seed + défaut de code) | `rewarded_at` posé, carte « +15 pièces récupérées », mais AUCUNE ligne `ziko_coin_transactions` et solde inchangé (500 446). Cause : `ziko_award_coins` (branche) retourne silencieusement si le cumul des gains positifs sur 24 h + montant > 10 000 (seed d'audit +500 000 du jour) alors que `ziko_sync_quests` a déjà marqué la quête récompensée (`20261201130200_quest_functions.sql:119-124`) : récompense perdue sans erreur ni retry. Hors seed le plafond est rare, mais la quête affiche un gain non versé. |
| Maquette (B12/B13) | ECARTS | (1) Solde de l'en-tête (`500446`) non rafraîchi après complétion (toast non capturé). (2) `Prochain niveau indisponible` sur l'onglet Niveau (niveau 3, 453 XP) : pas de palier suivant lisible (cohérent avec la policy de lecture manquante sur `ziko_level_definitions`, déjà connue). |

# UAT-RESULTS P13 (run2, 2026-11-13) - migrations 1301/1302 sur la branche
| Id | Verdict | Detail |
|---|---|---|
| Q-1 | PASS | "AUJOURD'HUI . SE RENOUVELLE DANS 23 H" : "Terminer une seance" 25, "Boire 2 litres d'eau" 15 ; "CETTE SEMAINE" : "S'entrainer 3 fois" 60 ; starters en base (`source=starter`). |
| Q-3 | PASS | 1,375 L en base -> "1,4 / 2 L" (progression calculee depuis `ziko_hydration_logs`). |
| Q-4 | PASS | +750 ml -> "Boire 2 litres d'eau : Termine . +15 pieces recuperees", solde 430 -> 445. Toast non capture. |
| Q-2, Q-5..Q-11 | NON-TESTE | (Q-7: expires_at = minuit Paris = 23:00 UTC, coherent.) |

## Run 8 (2026-11-13) - fenêtre de dates des quêtes (quête créée à 21 h)
PASS (SQL `ziko_quest_metric_value`, hydration_ml, user A, 14 000 ml déjà bus aujourd'hui) : fenêtre démarrant en cours de journée (18:14:22Z) -> 500 (seule la saisie postérieure à la création compte) ; fenêtre démarrant après la dernière saisie -> 0 ; fenêtre alignée minuit Paris -> 14 500 (comportement P13 conservé). Migration 2801 effective. Création d'une quête à 21 h via l'UI NON-TESTE.

## Run 10
Quete eau en UI : PASS (progression + +15 une fois, sans ouvrir Recompenses). Voir UAT-RESULTS-run10.md.
