# Resume file — v1.21 (lire en premier à la reprise)

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
| 2026-11-20 | Design contrat P2 livré | design/p2-contract | fc26481b | questions tranchées |
| 2026-11-20 | Designs mergés + CONTEXT P1/P2, maquettes validées | milestone/v1.21 | 13c389cc | — |
| 2026-11-20 | Builders P1 et P2 lancés en parallèle | phase/01-quetes, phase/02-premier-entrainement | — | agents build-p1-quetes, build-p2-entrainement ; en cours |

| 2026-11-20 | Builder P2 livré, mergé | phase/02-premier-entrainement | 51a455cd | gate vert (24/24, 5/5, 7/7) |
| 2026-11-20 | Builder P1 livré, mergé (conflit index.tsx = imports, résolu) | phase/01-quetes | a790db70 | gate : 1re passe 2 tests de rendu rouges (toast timer `window is not defined`, instable), 2e passe verte 45+15 fichiers ; à traiter par le correctif P1 |
| 2026-11-20 | Audit P2 : 0 critique/haut, 3 moyens, 9 faibles | audit/phase-2 | mergé | moyens : carte masquée sur toute erreur de lecture, Forme du jour sous la carte, reduced motion step-7 |
| 2026-11-20 | Audit P1 lancé | audit/phase-1 | — | agent audit-p1-quetes ; focus migration (quête hebdo supprimée = contredit D-01 ? décision produit à remonter) |
| 2026-11-20 | Correctif P2 lancé | fix/phase-2-audit | — | agent fix-p2-entrainement ; Forme du jour déplacée SOUS le bloc Quêtes seulement quand la carte est visible |

| 2026-11-20 | Audit P1 : 1 haut (décision produit), 3 moyens, 11 faibles | audit/phase-1 | 4cfa49a5 | décision utilisateur D-11 : garder la quête hebdo, l'accueil plafonne à 3 |
| 2026-11-20 | Correctif P1 lancé | fix/phase-1-audit | — | agent fix-p1-quetes (migration sans désactivation de l'hebdo, classement, refetch AppState, test instable) |

## À faire ensuite (mis à jour : P1 audité, décision D-11 prise ; attendre fix-p2-entrainement et fix-p1-quetes, puis merger un par un + gate, puis vague D UAT)
1. Récupérer l'audit P1 -> remonter à l'utilisateur la décision produit sur la quête hebdomadaire -> lancer le correctif P1 (inclure le test instable `rewards.test.tsx`).
2. Merger correctifs P2 et P1 (un à la fois) + gate ; re-vérifier l'ordre de l'accueil (carte > Mission > Quêtes > Forme du jour quand carte visible).
3. Vague D : P3 UAT compte neuf sur émulateur (verrou machine, `scripts/uat`), migration `20261215010100` à appliquer d'abord sur `uat-v1-20` avec accord utilisateur.
4. Reste en attente utilisateur : envoi TestFlight des 4 correctifs.

## Décisions utilisateur (discuss P1)
- D-01 Quêtes de bienvenue AJOUTÉES (migration) en plus/à la place des starters : eau, repas, séance (à confirmer avec la critique du design).
- D-02 Synchro déclenchée à l'ouverture de l'accueil (RPC idempotente `ziko_sync_quests`), pas de trigger d'inscription.
- D-03 Mission du jour d'onboarding reste au-dessus du bloc Quêtes ; disparaît une fois faite.
- D-04 Pas de lien « Voir tout » tant que Récompenses est verrouillé (niveau 3).

## Ouvert / actions humaines
- Envoi TestFlight des 4 correctifs (push, Vercel prod, build iOS) : en attente d'accord utilisateur.
- Migration quêtes de bienvenue : à appliquer sur `uat-v1-20` après accord, puis prod seulement sur demande explicite.
