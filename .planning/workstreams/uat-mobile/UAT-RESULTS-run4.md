# UAT run 4 : re-verification des correctifs (branche uat/run4, base milestone/v1.20)

Env : emulateur ziko-uat-1, Metro 8281, backend local 8200 + faux Anthropic (aucun appel reel), branche Supabase `uat-v1-20`. Toutes les migrations v1.20 (dont 2805) deja appliquees. Preuves : `uat-evidence/run4/*.png` (gitignore). Detail par phase : `phases/NN-*/UAT-RESULTS-run4.md`.

## Synthese

| # | Sujet | Verdict |
|---|---|---|
| 1 | MC-8 retrait athlete : `revoked_at` + `revoked_by='client'`, 404 si deja retire / inconnu, revocation coach | PASS (par API ; bouton mobile non rejoue) |
| 2 | P12 Succes "5 sur 12" sans policy de fixture | PASS |
| 3 | Clavier : feuille Poids (P8), barre "Ajouter N aliments" (P9) | PASS |
| 4 | P19 s'ouvre, catalogue, comparateur, stack, rappels | PASS |
| 5 | P7 `weeks` tableau, activation unique | PASS ; ecrasement coach NON-TESTE ; 3 defauts mineurs |
| 6 | P18 plus de "permission denied", routine, lancement, carte en seance, reglage auto | PASS (effet du lancement auto NON-TESTE) |
| 7 | Accueil : invalidation eau/poids sans relance, objectif eau identique | PASS ; invalidation apres seance, kcal, FR exercices, FAB : NON-TESTE |
| 8 | P13 ecran Quetes | PASS partiel ; fenetre 21 h / expirees / relais IA NON-TESTE |
| 9 | P26 factions, piste, defi vide | PASS partiel ; transition/absence LG-* NON-TESTE |
| 10 | P24 bandeau | PASS ; bilan/lancement "Squat" FAIL ; P23 quota gratuit FAIL ; `/forms/athlete/forms/pending` PASS ; reste NON-TESTE |
| 11 | Securite client : recherche d'amis PASS, boutique/recompenses PASS ; profil ami prive, cadeaux NON-TESTE |

## FAIL (a corriger)

1. **P23 quota gratuit non decompte (majeur, cout IA)** : 4 `POST /ai/chat` -> 200, ledger et solde inchanges, aucune ligne `quota`. Repro : `node uat-evidence/chat.mjs "x"` puis lecture REST de `ziko_ai_credit_transactions`. Cause probable : `creditGate.ts:165-181` -> `creditService.ts:255-271` (insert `trackQuotaUsage` qui ne produit ni ligne ni erreur journalisee ; verifier le client Supabase du backend, la cle, le GRANT/RLS INSERT). Le correctif de FIX-UAT-RUN3 point 2 n'est donc PAS confirme sur donnees reelles.
2. **P24 demarrage de la seance prevue** : "Seance indisponible (exercices introuvables)" pour l'exercice "Squat" (resolution `ilike` exact, `startPlannedSession`). Capture `p18-carte-seance.png`.
3. **Seance fantome / Reprendre** : "Seance en cours Lower 705->708 min" ; Reprendre ouvre une "Seance rapide" vide (00:24). Pas de nettoyage des seances orphelines.
4. **P7 nom du programme** : `AIProgramsPlugin.tsx:37` ignore la colonne `name` ("Programme 13/11/2026"). Statut "Termine 100 %" sur programmes jamais demarres ; `completed_at` non remis a null a la reactivation (bandeau P24 sur programme actif).

## Notes harness
- GRANT de fixture ajoutes : aucun. Fixture supprimee : `badge_definitions_read_uat` (seed mis a jour).
- Ajout de fixture donnees : `ziko_user_plugins` (11 plugins actives pour l'athlete : la branche n'avait que `coach`, ce qui masque la carte stretching/hydratation), lien coach de fixture insere puis revoque (MC-8), faction Powerlifting rejointe, routine "Reveil", stack "Complement UAT 1", poids 70.5, eau +250 ml, programme "Pic de force 8 sem" puis "Bloc de volume" actifs.
- `ui.mjs link` : citer l'URL (parentheses de `(plugins)`) ; chemins MSYS : `MSYS_NO_PATHCONV=1` ; `uiautomator dump` echoue ("could not get idle state") pendant les chronos/animations.
- Le SQL MCP a ete instable en fin de run (overloaded) ; contournement : `uat-evidence/rest.mjs` (REST service role, branche uniquement).

## NON-TESTE (voir `UAT-RUN4-RESUME.md`)
P6 A..F, P9 U1/U12/U15, P10, P11, P15, P16 IM-*, P17, P20, P21 login B, P22, P23 C-F/feuille d'epuisement, P24 B-F, P25 MC-4/6/11/13, P26 LG-* restants, P14, comparaison aux maquettes (non faite, aucun ecart mesure releve ce run).
