# Phase 23 - SUMMARY (Atelier IA de creation de programme)

Branche `phase/23-atelier` (merge `milestone/v1.20` fait ; 1 conflit trivial dans `lib/autonomousCost.ts`, les deux sources conservees). Gate apres merge : `tsc --noEmit` backend et mobile OK ; backend vitest 387 passes (dont 44 nouveaux), racine vitest 819 passes (dont 21 nouveaux mobile) ; `check-migration-names` OK.

## Livre
- Backend `backend/api/src/workshop/` : `draft.ts` (modele + operations typees partagees IA/manuel), `skills.ts` (8 skills), `context.ts` (contexte athlete, e1RM Epley), `store.ts` (brouillons, revision optimiste, publication), `tools.ts` (6 outils), `webSearch.ts`, `prompt.ts`, `limits.ts`, `usage.ts`.
- Route `backend/api/src/routes/workshop.ts` montee `/ai/workshop` : `GET /info`, `POST /stream` (SSE, `creditCheck('chat')`/`creditDeduct('chat')`), `GET|PATCH /drafts/:id`, `POST /drafts/:id/publish`. Panne du modele avant le 1er signal utile : 502, donc rien n'est debite.
- Migration (fichier seulement, NON appliquee) `20261201230100_ziko_workshop_drafts.sql` (RLS lecture seule client, ecriture backend).
- Mobile : `src/lib/atelier.ts` (logique pure), `atelierService.ts` (client XHR/SSE), `app/(app)/workout/atelier.tsx` (A10-A15), entree depuis `programs.tsx` (ex `ai-generate`). Bouton plein = `getActionPrimary`.
- `UAT-PLAN.md` (flows A-G avec faux Anthropic + section Z pour le 1 appel reel), `23-CONTEXT.md`.

## Exigences
| Id | Statut | Preuve / limite |
|----|--------|-----------------|
| ATEL-01 | PARTIAL | route + ecran + entree liste ; tests route (flux SSE) ; ecran type-check, jamais rendu ni vu sur emulateur |
| ATEL-02 | PARTIAL | outil + plafonds (2/message, 20/jour) + journal `workshop_web_search` testes avec runner injecte ; l'outil natif `webSearch_20250305` n'est PAS exerce |
| ATEL-03 | VERIFIED (unitaire) | 8 skills, list/load testes ; qualite du contenu non evaluee par un vrai modele |
| ATEL-04 | PARTIAL | contexte (profil, e1RM, 12 seances, programmes IA+coach, mesures) calcule et borne, filtre user_id ; requetes non jouees contre un vrai Postgres (colonnes `ziko_workout_programs.assigned_to_user_id`, `ziko_body_measurements` supposees d'apres le code existant, erreur => liste vide) |
| ATEL-05 | PARTIAL | edition IA (outils) et manuelle (PATCH, revision, 409) testees, zero credit prouve par mocks ; ecran A12 non vu |
| ATEL-06 | PARTIAL | programme 8 semaines %1RM/RPE/repos normalise et converti en ligne P6-compatible (test) ; pas de generation reelle |
| ATEL-10 | PARTIAL | 402 sans appel modele, debit unique, 502 sans debit, quota gratuit, cout reel affiche (mocks) ; RPC SQL de debit non jouee |

## Ecarts et decisions [A CONFIRMER] (voir CONTEXT)
- Contrat "1 credit par message" vs gate reel : l'ecran affiche `CREDIT_COSTS.chat` lu cote serveur (4 aujourd'hui, 1 message gratuit/jour). Reutilise le `kind` `chat` (G-1) : pas de `kind` `workshop`.
- Route et outils dedies (pas `registry.ts` : schemas imbriques impossibles avec `AITool`). `registry.ts` non modifie. Fichiers partages touches : `app.ts` (+1 route), `lib/autonomousCost.ts` (+1 source), `programs.tsx` (1 ligne).
- Brouillon dans `ziko_workshop_drafts`, hors liste P7 ; "Enregistrer" = ligne INACTIVE puis activation par la RPC P7.
- A12 : ajout d'un choix "Semaine N / Toutes les semaines" (non present dans la maquette, necessaire avec 8 semaines).
- Aucune maquette PNG dans `lot-A/png` : implemente depuis `src/02-atelier.html` + contrat.

## Non prouve
Rendu, captures, accessibilite (44 dp, libelles) ; XHR `onprogress` sous Hermes ; vrai tool-calling Claude, taille des sorties, outil `web_search` natif ; cout reel en tokens d'un tour (G-1) ; migration non parsee par Postgres ; un echec 502 consomme quand meme un slot GRATUIT du jour (`creditDeduct` appelle `trackQuotaUsage` sans regarder le statut : comportement existant de `creditGate.ts`, non modifie) ; reprise multi-appareil.

## Besoins humains / orchestrateur
Appliquer la migration 2301 sur la branche jetable avant l'UAT ; fournir un compte a 0 credit ; 1 appel reel (UAT-PLAN section Z) ; confirmer G-1..G-3.

## Pour P24
Brouillon et conversation portent `conversation_id` ; P24 peut relancer `POST /ai/workshop/stream` avec un message de resultats (appels automatiques : utiliser `logAutonomousCost` + un plafond journalier comme `countWebSearchesToday`).
