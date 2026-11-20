# Resume file — v1.21 (lire en premier à la reprise ; voir MILESTONE-RUN.md pour le détail)

Orchestration via `/orchestrate-milestone`. Branche d'intégration : `milestone/v1.21` (worktree `C:\ziko-platform\.claude\worktrees\integration-v1.21`), base `fix/testflight-4-bugs` (4 correctifs TestFlight) + docs du milestone.
Règles : jamais de push, jamais de déploiement, jamais d'écriture en base réelle ; migrations = fichiers, appliquées par l'orchestrateur après accord (d'abord sur la branche jetable `uat-v1-20`).

## Profil
- Install : `npm install --no-save` par worktree (jamais `npm ci`). Gate : `npm run type-check`, `npm run lint`, `npx turbo run test`, `npm run build` dans `backend/api`.
- Ressources machine : émulateur unique `ziko-uat-1`, Metro 8281, backend UAT 8200, faux 8210/8211 → UAT en file (`scripts/uat/queue.sh`), un seul à la fois.
- Interdits : base prod `ubxllsvanurkwkohzxau`, vrai Anthropic, Resend, Upstash.
- Ports réservés : designers P1 3103-3109, P2 3111-3119 ; builders à partir de 3120.

## Plan de vagues (approuvé)
A design + discuss (parallèle) → B build P1 et P2 en parallèle (propriétaire de `app/(app)/index.tsx` : P2 ; P1 insère son bloc en édition localisée) → C audits/correctifs en continu → D P3 UAT compte neuf.

## Journal
| Date | Étape | Branche | Commit | Notes |
|------|-------|---------|--------|-------|
| 2026-11-20 | Intégration créée | milestone/v1.21 | 312c4cb9 | base fix/testflight-4-bugs + docs |
| 2026-11-20 | Design contrat P1 livré | design/p1-contract | 0ccf9161 | 5 questions ouvertes, PNG commités (1,3 Mo) |
| 2026-11-20 | Design contrat P2 | design/p2-contract | en cours | |

## Décisions utilisateur (discuss P1)
- D-01 Quêtes de bienvenue AJOUTÉES (migration) en plus/à la place des starters : eau, repas, séance (à confirmer avec la critique du design).
- D-02 Synchro déclenchée à l'ouverture de l'accueil (RPC idempotente `ziko_sync_quests`), pas de trigger d'inscription.
- D-03 Mission du jour d'onboarding reste au-dessus du bloc Quêtes ; disparaît une fois faite.
- D-04 Pas de lien « Voir tout » tant que Récompenses est verrouillé (niveau 3).

## Ouvert / actions humaines
- Envoi TestFlight des 4 correctifs (push, Vercel prod, build iOS) : en attente d'accord utilisateur.
- Migration quêtes de bienvenue : à appliquer sur `uat-v1-20` après accord, puis prod seulement sur demande explicite.
