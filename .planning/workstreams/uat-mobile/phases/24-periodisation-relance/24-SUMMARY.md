# Phase 24 - SUMMARY (Periodisation & relance automatique)

Branche `phase/24-periodisation` (base `milestone/v1.20`, merge refait : deja a jour, aucun conflit). Gate : `tsc --noEmit` backend et mobile OK ; backend vitest 418 passes (dont 31 nouveaux : 27 `periodization`, 4 route) ; racine vitest 829 passes (dont 9 nouveaux mobile) ; `check-migration-names` OK (27 fichiers v1.20). Aucun push, aucune ecriture prod, aucun appel IA reel, migrations NON appliquees.

## Livre
- Migrations (fichiers seuls) `20261201240100_program_sequences.sql` (table `ziko_program_sequences`, colonnes `sequence_id/sequence_position/started_at/completed_at/results` sur `ziko_ai_generated_programs`, index unique partiel, trigger `started_at`) et `20261201240200_program_relaunches.sql` (table `ziko_program_relaunches`, `program_id` UNIQUE ; colonnes de suite sur `ziko_workshop_drafts`). Ordre : 2401 puis 2402 (apres P7 0701-0704 et P23 2301).
- Backend `backend/api/src/periodization/` : `progress.ts` (fin calendaire ou toutes seances), `results.ts` (adherence, volume, e1RM debut/fin, direction `progress|consolidate|reentry`), `sequence.ts` (statuts done/active/next/planned), `store.ts`, `relaunch.ts` (check sans IA + propose = UN appel IA, compare-and-set, plafond 1/jour), `prompt.ts` (bloc resultats + regles non punitives), `limits.ts`. Routes dans `routes/workshop.ts` : `GET /ai/workshop/sequence`, `POST /relaunch/check`, `POST /relaunch/:id/propose`, `POST /relaunch/:id/dismiss` ; `/stream` ajoute les resultats du programme precedent au prompt d'un brouillon de relance. `workshop/store.ts` : `publishDraft` rattache a la suite (position suivante, INACTIF). `lib/autonomousCost.ts` : +source `program_relaunch`.
- Mobile : `src/lib/periodization.ts` (logique pure, textes neutres), `periodizationService.ts`, `components/ProgramRelaunchBanner.tsx` (monte dans l'onglet Seance), `app/(app)/workout/sequence.tsx` (frise + bilan), `atelier.tsx` (`?relaunch=<id>` : bilan + proposition + brouillon). Bouton plein = `getActionPrimary(theme)`.
- `24-CONTEXT.md` (D-01..D-11, G-1..G-7 [A CONFIRMER]), `UAT-PLAN.md` (flows A-F + section Z, faux Anthropic, fin de programme simulee par seed).

## Exigences
| Id | Statut | Preuve / limite |
|----|--------|-----------------|
| ATEL-07 | PARTIAL | suite ordonnee : positions uniques, statuts calcules (un seul `active`), publication rattachee a la position suivante, INACTIVE, jamais d'activation automatique (tests db en memoire). "Un seul actif" reste porte par P7 (inchange). SQL non execute ; ecran `sequence.tsx` type-check seulement |
| ATEL-08 | PARTIAL | resultats (adherence, volume, e1RM 1ere/2eme moitie) calcules et injectes dans le prompt de la relance ET des tours manuels (tests) ; la direction est un conseil deterministe. La pertinence du programme suivant ecrit par le vrai modele n'est pas prouvee |
| ATEL-09 | PARTIAL | detection de fin + cloture + brouillon + relance idempotents (course, reprise apres cloture interrompue), 1 appel IA par relance, plafond 1/jour, panne => relance conservee (tests, runner et `generateText` mockes). Declenchement a l'ouverture de l'onglet Seance (pas de cron). Jamais joue sur emulateur ni contre un vrai Postgres |
| Regle non punitive | VERIFIED (mock) | test : seules 4 tables ecrites (programmes, suites, brouillons, relances), aucune de credits/gamification/serie ; 0 seance => programme quand meme termine, bilan doux ; routes : `creditService` jamais appele ; vocabulaire d'echec absent des textes (regex) |
| Appels auto absorbes | VERIFIED (mock) | pas de `creditCheck/Deduct`, cout journalise `program_relaunch` (apres appel), plafond du jour compte dans `ziko_ai_cost_log` (une ligne de la veille ne compte pas) |

## Ecarts et decisions [A CONFIRMER] (voir CONTEXT)
- G-1 declencheur a l'ouverture d'app (pas de cron, `vercel.json` intact) ; G-2 plafond 1/jour ; G-3 fin calendaire OU toutes les seances ; G-4 suivant jamais active automatiquement ; G-5 programmes coach/crees hors suite ; G-6 ecrans sans maquette (aucun lot-A pour la suite/le bilan) ; G-7 pas de web search dans le tour automatique.
- `started_at` pose par trigger (RPC P7 non redefinie) ; programmes actifs avant migration : repli `created_at`.
- `GET /sequence` est en lecture seule (ne declenche pas de cloture) ; seul `POST /relaunch/check` cloture.

## Non prouve
Migrations non parsees ni executees (pas de base de test ; trigger `ziko_ai_program_started_at_trg` apres `..single_active_trg` par ordre alphabetique, non verifie) ; lien seances-programme : les seances d'un programme IA n'ont pas de `program_id` exploitable, donc fenetre de dates `[started_at, fin]` (une seance libre hors programme faite dans la fenetre est comptee) ; programmes `weeks` numerique (assistant 4 etapes historique) jamais clos automatiquement ; rendu/accessibilite des 3 ecrans (bandeau, suite, bilan dans l'atelier), polling d'attente 24 s de l'atelier ; vrai modele (qualite, ton, cout par tour) ; timeout de fonction Vercel sur `propose` (un tour de 8 etapes ; non mesure) ; une relance dont la proposition echoue repart seulement a la prochaine ouverture (aucune relance en tache de fond).

## Besoins humains / orchestrateur
Appliquer 2401 puis 2402 sur la branche jetable avant l'UAT ; seed de fin de programme (UAT-PLAN) ; 1 appel reel (section Z) ; confirmer G-1..G-6 ; trancher si une maquette doit etre commandee pour la suite/le bilan.

## Fichiers susceptibles de conflit
`backend/api/src/routes/workshop.ts` et `workshop/store.ts` (P23, additif), `backend/api/src/lib/autonomousCost.ts` (1 ligne), `apps/mobile/app/(app)/workout/atelier.tsx` (P23, ajout de param + carte), `apps/mobile/app/(app)/workout/index.tsx` (+2 lignes, P6/P7/P18), `workshop/fakeDb.testutil.ts` non modifie.
