# Phase 25 : Mon coach complet (SEED-002), SUMMARY

Branche `phase/25-mon-coach` (base `milestone/v1.20`, merge de `milestone/v1.20` fait sans conflit, gate verte). Docs : `25-CONTEXT.md` (audit MCOA-01 + decisions D-01..D-11, `[A CONFIRMER]` G-01..G-04), `25-UI-SPEC.md` (criteres mesurables, pas de HTML rendu), `UAT-PLAN.md` (MC-1..MC-13).

## Exigences
| Id | Statut | Preuve / limite |
|---|---|---|
| MCOA-01 | VERIFIED | Audit tabulaire dans `25-CONTEXT.md` (lecture du code reel) : 3 manques/failles trouves (desinstallation du store sans garde, aucune garde en base, policy UPDATE du lien sans restriction de colonnes) + historique et programme prescrit absents |
| MCOA-02 | PARTIAL | Etat : `resolveCoachState` (12 tests, un lien actif l'emporte sur un apercu). Non-desinstallable : garde UI dans les 2 chemins du store + liste partagee `mandatoryPlugins.ts` (9 tests dont ordre garde < `.delete()`) ; garde base = migration `20261201250300` (**SQL non execute**). Rendu natif/emulateur non vu |
| MCOA-03 | PARTIAL | Retrait sans punition : modale rassurante + saisie `COACH` (tests de copie : `conserves`, `nouveau code`, aucun mot punitif), `revoked_at` conserve la ligne, endpoint historique `GET /coach/clients/links/history` (7 tests backend, client mocke), bloc `Anciens coachs` (`buildHistoryRows`, 5 max, repli sur `Ancien coach`). Migration `20261201250100` : trigger de garde (identite immuable, athlete = `revoked_at` seulement, retire = fige, `revoked_by` non falsifiable) + policies scindees ; spec RLS distant `test/rls/coach-link-guard.spec.ts` ecrit mais **non execute** |
| MCOA-04 | PARTIAL | `selectPrescribed`/`prescribedProgramView` (13 tests : coach+athlete+non template, plus recent, active/replaced/available, sous-titre sans NaN), activation par la seule RPC P7, confirmation `Remplacer "X" ?` si un autre programme est actif ; `PrescribedProgramCard` (6 tests de rendu : vide/chargement/erreur/actif/remplace/disponible). Ecran complet non monte en test |

## Livre
- Migrations (fichiers, NON appliquees, ordre 2501 -> 2503, idempotentes, `check-migration-names` OK) : `20261201250100_coach_link_guard`, `…2502_coach_link_history_index`, `…2503_mandatory_plugin_guard`.
- Backend : `coach/clients/history.ts` + route `GET /links/history` (`service.ts`) ; tests `test/coach/links-history.spec.ts` (7) et `test/rls/coach-link-guard.spec.ts` (distant).
- Mobile : `plugins/coach/src/screens/{coachState,prescribedProgram}.ts` (+ tests), `PrescribedProgramCard.tsx`, `CoachScreen.tsx` (etat pur, boutons `getActionPrimary` y compris etat B, historique, carte programme, modale de retrait, alerte de fin), `apps/mobile/src/lib/mandatoryPlugins.ts` (+ test, `PluginLoader.tsx` l'utilise), `store/index.tsx` + `store/[id].tsx` (garde + bouton `Obligatoire`), `i18n.ts` (corps de modale non punitif), render test `prescribedProgram.test.tsx`.

## Gate (apres merge de `milestone/v1.20`)
Racine `npx vitest run` : 53 fichiers, 883 tests verts (dont 35 nouveaux P25 : coachState 12, prescribedProgram 14, mandatoryPlugins 9). Rendu `apps/mobile` : 8 fichiers, 62 verts (6 nouveaux). Backend `npx vitest run` : 466 verts, 3 skipped, 8 fichiers distants exclus (dont le nouveau spec RLS) ; `links-history` 7 verts. `tsc --noEmit` : `apps/mobile` 0 erreur, `backend/api` 0 erreur. `plugins/coach` `tsc` : 1 erreur TS6307 de configuration composite (import d'un fichier `apps/mobile`, preexistante via `authStore`, non liee a P25 ; la gate du repo type-check `apps/mobile`). `check-migration-names` : OK (33).

## Deviations
1. Pas de HTML/Playwright (cout RAM, ecrans = extensions de P22) ; UI-SPEC en criteres mesurables.
2. Saisie `COACH` conservee (SEED) plutot qu'un retrait en deux boutons : `[A CONFIRMER]` G-02.
3. `CoachScreen` n'importe pas `programsService` (limite de projet TS composite) : lecture des programmes actifs dediee (`loadActiveCandidates`), meme regle que P7 (0 ou 1 actif).
4. Chaines FR en dur (charte) ; une cle i18n existante (`coach.revoke_modal.body`) reformulee, non utilisee par le nouvel ecran.
5. Section "Mon coach" dans les reglages non faite (D-11).

## NON prouve
- **Tout le SQL** (3 migrations, RLS/trigger/policies) : jamais execute (aucune base de test disponible) ; le spec RLS distant est ecrit mais non joue. Risques a verifier : `ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*)` sous trigger, interaction avec `ziko_redeem_invitation_code` (INSERT : non touche), mise a jour par `revokeClientLinkByCoach` (coach, ligne active : autorisee), `auth.uid()` NULL pour les suppressions de compte en cascade.
- Rendu natif (Android), captures, contrastes ; l'ecran `CoachScreen` complet (imports natifs) n'est pas monte en test : seules `CoachCard`, `PrescribedProgramCard` et la logique pure le sont ; cablage verifie par type-check.
- Le contrat reel de `/coach/clients/links/history` n'a pas ete observe contre une vraie base (client mocke).
- Qu'un coach cree bien ses programmes avec `assigned_to_user_id` + `created_by_coach_id` (hypothese P7/schema ; sinon la carte affiche l'etat vide).
- Le comportement du `showAlert` a 2 boutons (annulation/remplacement) sur appareil.

## Besoins humains
Appliquer les 3 migrations sur la base jetable puis jouer le spec RLS (UAT-PLAN, preparation) ; trancher G-01/G-02 ; verifier en prod en LECTURE SEULE qu'aucun client n'a de ligne `ziko_user_plugins` `coach` manquante avant 2503 (sans effet de bord : le trigger ne cree rien).

## Fichiers a risque de conflit
`plugins/coach/src/screens/CoachScreen.tsx`, `apps/mobile/src/lib/PluginLoader.tsx`, `apps/mobile/app/(app)/store/index.tsx`, `packages/plugin-sdk/src/i18n.ts` (fin de fichier), `backend/api/src/coach/clients/service.ts`.
