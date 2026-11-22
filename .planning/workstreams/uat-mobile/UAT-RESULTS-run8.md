# UAT run 8 (2026-11-13) - flows IA / ligue jamais joués + re-vérifications run 7
Branche `uat/run8` (depuis `milestone/v1.20`), émulateur ziko-uat-1, branche Supabase `uat-v1-20`, faux Anthropic. Aucun correctif applicatif. Détail dans `phases/NN-*/UAT-RESULTS.md` (section Run 8).

| Phase | PASS | PARTIEL / NON-TESTE | FAIL |
|---|---|---|---|
| P26 | LG-2..6, 8..11, 13..16, défi collectif 3+ | LG-12 (puce Fil), LG-1, 7 (UI), 23, 24, 25 | aucun |
| P16 | IM-1, 2, 3, 5..11, 14 | IM-12 (complétion + `max_active_quests`), IM-4, IM-13 | aucun |
| P24 | Flow A, coût absorbé, idempotence, suivant enregistré INACTIF | activation (B 1-2), C variantes, D, E, F | aucun |
| P23 | feuille d'épuisement FR | atelier A..F restants | aucun |
| P13/14 | fenêtre de dates quête 21 h (SQL) | création UI à 21 h | aucun |
| Re-vérif run 7 | tuiles Hydratation 132 dp avec fond ; Mon coach `Session expirée` | Entraînement après reconnexion (vu OK après redémarrage à froid : `Force 5x5, bloc 2 / ACTIF`, pas de `Aucun programme actif`) ; `Pates` stock bas | aucun |

## Constats utiles (non bloquants)
- Défi collectif : `ziko_collective_progress` (migration 2703) ne compte que les participants dont le lien coach est ACTIF ; sans lien, `1 participant` malgré 3 lignes `joined` (comportement voulu, mais à savoir pour le seed).
- Absence neutre : une semaine avec séance Performance sur l'autre piste n'est pas neutre (`hold`, `low_streak` +1) ; les semaines vraiment vides le sont (division conservée sur 6 semaines).
- Objectif de mesure : seuil `goal_too_recent` = 28 j (le plan dit 14 j ; 14 j = délai entre deux révisions). Le trigger `measurement_goal_locked` bloque les UPDATE du seed même en service_role : antidater avec `session_replication_role=replica` via `supabase db query --linked --project-ref oloobswzsziidjwycthm`.
- Relance P24 : si `relaunch/check` est appelé hors de l'app, relance `pending` sans auto-propose (écran `Préparer la suite`) : comportement correct mais à ne pas confondre avec le plafond.
- Après `Continuer` sur la modale de ligue, l'app a réaffiché l'écran de notifications (`Activer / Plus tard`) : à confirmer (redémarrage JS ou re-prompt).
- Outils ajoutés (gitignorés) : `uat-evidence/{lg.sh,tool.sh,onb.sh,p24arm.sh,mkusers.mjs}`. Comptes de seed ajoutés sur la branche : `uat-d1@`, `uat-d2@uat.ziko.invalid` (liens coach actifs + participants du défi).
