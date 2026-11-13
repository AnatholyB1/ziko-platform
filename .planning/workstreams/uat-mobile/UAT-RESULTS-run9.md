# UAT-RESULTS run 9 (2026-11-13) - flows jamais joués, UI émulateur
Branche `uat/run9` (depuis `milestone/v1.20`), base `uat-v1-20`, backend local + faux Anthropic. Aucune écriture prod, aucun appel Anthropic réel, aucun code applicatif modifié. Preuves : `uat-evidence/run9/*.png` (non versionné). Détail par phase : sections « Run 9 » de `phases/13-*`, `phases/23-*`, `phases/24-*/UAT-RESULTS.md`.

## Synthèse
| Flow | Verdict | Résumé |
|---|---|---|
| 1. Quête d'eau par l'UI (réconciliation run 8) | PASS (+ FAIL récompense) | Progression et complétion comptent bien les saisies postérieures à la création (250 -> 1000 ml, `completed`). Le FAIL du run 8 n'est pas reproduit ; piège : aucune synchro tant que l'écran Récompenses n'est pas remonté. Mais pièces non créditées (plafond 24 h de `ziko_award_coins` dépassé par le seed d'audit, retour silencieux alors que `rewarded_at` est posé). |
| 2. P24 activation du suivant (B 1-2) | PASS | Modale de remplacement coach, 1 seul actif, frise `EN COURS`. C-F NON-TESTE. |
| 3. P23 atelier A, B, D, E | PASS | Conversation (faux), édition manuelle sans débit, Enregistrer = inactif, 2 clics concurrents = 1 programme. C (débit) A CONFIRMER, F clavier FAIL mesuré. |
| 4. P26 LG-1, 7, 12, 23-25 ; P16 IM-4, 12, 13 | NON-TESTE | Budget de contexte. |
| 5. P6 D/E ; P11 HY-5/6 ; P15 ME-1/8 ; P17 SL-3..5 ; P22 JR-6 | NON-TESTE | Idem. |
| 6. Notification `Activer / Plus tard` après la modale de ligue | NON-TESTE | A trancher au run 10. |

## Défauts / écarts mesurables nouveaux (cause probable fichier:ligne)
1. FAIL - Onglet Entraînement : titre `Force` + sous-titre `Coach Ziko · Intermédiaire` pour le programme actif `Bloc de force` (créé par l'utilisateur) : `apps/mobile/app/(app)/workout/index.tsx:499-500`.
2. FAIL - Récompense de quête non versée en silence : `ziko_award_coins` RETURN si cumul 24 h > 10 000 alors que `ziko_sync_quests` pose `rewarded_at` avant (`supabase/migrations/202612011302_quest_functions.sql:119-124`). Déclenché ici par le seed (+500 000), peu probable en production, mais la carte affiche `+15 pièces récupérées` sans ligne de ledger ; l'en-tête reste à 500 446.
3. FAIL - Libellé anglais `strength` dans `Ma suite de programmes` (frise).
4. FAIL (à valider sur appareil) - Atelier : clavier recouvre le champ de saisie (`workout/atelier.tsx`, pas de KeyboardAvoidingView).
5. CONSTAT - Accueil, carte `Forme du jour` : hydratation `14,8 L` vs tuile Quick Log `14,75 L` (arrondis différents) ; `Sommeil 7 h 45 · qualité 4 / 5` avec score `0`.
6. CONSTAT - Série : accueil `1 jour`, Récompenses `5 jours`, Profil `Jours d'affilée 0` (trois valeurs pour une même série).
7. CONSTAT - Progression programme coach : `Semaine 3 sur 8 · 38 %` (Programmes) vs `1 SEMAINE / 0 TOTAL` (Entraînement) ; atelier `5 programmes` vs liste `Tous 6`.
8. CONSTAT - `/credits/balance` renvoie `daily_earned:6` pour `daily_cap:4` ; solde atelier `20 -> 20` après un tour annoncé à 4 crédits.
9. CONSTAT (harnais) - Les liens profonds vers un écran déjà monté ne le rechargent pas (quêtes, `Ma suite`) ; pour tester un refetch, quitter puis rouvrir l'écran. Variables Metro : `EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY=$SUPABASE_PUBLISHABLE_KEY` (les noms `UAT_*` du README sont périmés ; sinon `supabaseUrl is required`). Premier bundle ~4 min après `--clear` (le dev-client expire : rouvrir une 2e fois).
10. Bonus : scan code-barres : la caméra virtuelle s'ouvre (écran `Ajouter un repas > Code`, scène virtuelle visible, cadre de visée) ; scan réel non testé.

## Reste à jouer
Voir `UAT-RUN9-RESUME.md`.
