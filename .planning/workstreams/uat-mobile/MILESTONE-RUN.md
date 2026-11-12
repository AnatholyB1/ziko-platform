# MILESTONE-RUN v1.20 — journal d'execution (uat-mobile)

Integration : branche `milestone/v1.20`, worktree `.claude/worktrees/integration-v1.20`, base `origin/main` ba8f7925 + 3 commits docs. HEAD de depart : `39c30132`.

## Statut par phase
| Phase | Etat | Branche | Dernier commit | Gate | Notes |
|---|---|---|---|---|---|
| P3 Habitudes | MERGE (code+12 tests rendu; cause racine NON reproduite, a trancher en UAT) | phase/03-crash-habitudes-garde-modules | cabd383a | mobile 115, tsc 0 | besoin logcat si crash persiste |
| P1 Harness | MERGE (scripts+AVD boot prouves; APK/Maestro/comptes NON prouves) | phase/01-harness-uat-android | 8fb2d2dc | check-migration-names OK | attend schema branche + secrets EAS + .uat/env |
| P8 Quick Log | MERGE (code+17 tests; UAT emulateur en attente) | phase/08-accueil-quick-log | 682b9baa | mobile 103/103, tsc 0 | RLS a confirmer sur branche; dette: outils backend hydration/measurements/journal en UTC |
| P5 P6 | en cours (builders) | phase/05,06-* | - | - | doivent merger milestone/v1.20 (index.tsx touche par P8) |
| P2 Session | MERGE (code+tests unitaires; UAT emulateur en attente P1+APK) | phase/02-session-auth-robustes | 93ffc7d7 | mobile 86/86, tsc 0 | transmis a P21: demande inverse, insert ignore |
| P3 Habitudes | non lance | - | - | - | |
| P4 Maquettes | MERGE lots A-D (validation visuelle utilisateur en attente) | phase/04-design-ab, phase/04-design-cd | 0679989a | - | PNG non commites (regenerer render.sh) |
| P5-P26 | non lances | - | - | - | voir plan de pipeline dans `ORCHESTRATION-v1.20-uat-mobile.md` |

## Ce qui tourne
Rien. Aucun agent lance, aucun serveur, aucun emulateur.

## Gate de reference (a executer avant la 1re fusion pour fixer la ligne de base)
Non execute encore : npm install + type-check/lint/test/build de `milestone/v1.20` a faire en debut de vague 0 (pas de node_modules dans le worktree d'integration a ce stade).

## Journal
- 2026-11-12 : worktree d'integration cree depuis `origin/main` (fetch sans push), cherry-pick propre de 970a7e99/304e2f20/39c30132. Profil projet, carte de propriete, plan de pipeline, checklist humaine ecrits. Aucune migration appliquee, aucune ecriture en base.

## Suite
1. Utilisateur : trancher A1-A4 de `DEPLOY-CHECKLIST-v1.20.md` et confirmer le plan.
2. Orchestrateur : `npm install --no-save` dans l'integration, gate de base, puis lancer vague 0a (P1, P2, P3 builders ; P4 design lots A+B ; discuss P1-P3).
- 2026-11-12 INCIDENT: rm -rf node_modules sur junctions de worktrees perimes a vide des dossiers du repo principal (restaures via git checkout ; env gitignores et node_modules du principal perdus). Regle: jamais rm -rf node_modules de worktree.
- 2026-11-12 (reprise): decisions A1=branche Supabase jetable `uat-v1-20` (ref oloobswzsziidjwycthm, creee, sans donnees), A2=EAS cloud (attend `eas login` utilisateur), A3=21 dossiers orphelins agent-* supprimes (2 worktrees enregistres gardes), env backend/web regeneres via `vercel env pull` = valeurs PRODUCTION: INTERDITES aux agents de test (utiliser l'URL/cle de la branche uat-v1-20). Prochaine etape: gate de base, Maestro + AVD, lancer vague 0a.
- 2026-11-12: branche uat-v1-20 prete (schema ziko 104 tables, comptes uat, .uat/env). Build EAS uat-dev lance: https://expo.dev/accounts/anatholyb/projects/ziko-mobile/builds/eade2d72-9393-4196-ad25-59f571466ccc . L'APK pointe EXPO_PUBLIC_API_URL=http://10.0.2.2:8200 -> UAT des fonctions backend/IA exige un backend LOCAL (port 8200) avec env de la branche (jamais l'env prod). Cle publishable injectee dans eas.json localement, non commitee.
- 2026-11-12 (soir): P5 + P6 mergees (conflit index.tsx resolu: logique P6 + goalLabel P5; test gating exclut route crash-test). GATE integration e156b2b6+: tsc mobile 0; vitest racine 23 fichiers / 371 tests OK; mobile render 12/12 apres stub useWindowDimensions. Lint/build web+backend non rejoues (non touches).
- DECISIONS utilisateur: orange bouton plein #CF4509 (token actionPrimary), Journal sarcelle #0F766E, ecrasement du programme coach autorise avec confirmation, migration amities complete (prod seulement apres accord + comptage doublons en lecture seule). Autres questions w2a/w2b: reco appliquee (Q-X2 athlete B de test, Q-P18 carte routine lance la routine, Q-P19 favoris non convertis, Q-P20a rien supprime par migration, Q-P20b types->3 onglets sans perte, Q-P21a profil complet pour tout connecte, Q-P21c abonnes = def. profil perso, Q-P22b humeur Quick Log = entree 'general' du jour, Q-P22c UI-SPEC + 4-5 maquettes legeres, Q3 cout photo repas = cout reel affiche, Q4 favoris repas = recents sans migration, Q5 recettes IA 1 credit, Q6 branding coach prime, Q7 pieces par palier, Q8 serie visible, Q9 reveil intelligent = preference seule).
