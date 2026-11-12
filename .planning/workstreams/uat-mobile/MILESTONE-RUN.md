# MILESTONE-RUN v1.20 — journal d'execution (uat-mobile)

Integration : branche `milestone/v1.20`, worktree `.claude/worktrees/integration-v1.20`, base `origin/main` ba8f7925 + 3 commits docs. HEAD de depart : `39c30132`.

## Statut par phase
| Phase | Etat | Branche | Dernier commit | Gate | Notes |
|---|---|---|---|---|---|
| P1 Harness | non lance | - | - | - | attend decisions A1/A2 (checklist) |
| P2 Session | non lance | - | - | - | |
| P3 Habitudes | non lance | - | - | - | |
| P4 Maquettes | non lance | - | - | - | lots A-D |
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
