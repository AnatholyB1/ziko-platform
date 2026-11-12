# Phase 22 : Journal et ecran Mon coach, SUMMARY

Branche `phase/22-journal-coach` (base `milestone/v1.20`, merge de `milestone/v1.20` fait, gate verte). Mobile + 1 correctif d'outil IA backend. Pas de migration. Maquettes : `04-maquettes-reference/lot-F` (la maquette prime) ; decisions utilisateur : sarcelle `#0F766E`, Q-P22b (humeur Quick Log = entree `general` du jour), bouton plein = `getActionPrimary(theme)` (#CF4509).

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| JRNL-01 | VERIFIED (logique + rendu) ; UAT emulateur en attente | L'utilisateur est lu a l'enregistrement (`requireUser()` injecte par les routes, repli `auth.getUser()` patche) : plus d'id mis en cache `staleTime: Infinity`. Tests de rendu : utilisateur d'abord indisponible puis valide -> enregistrement OK, 0 `Utilisateur non connecte` ; session expiree -> bandeau + saisie conservee (brouillon module) + `Se reconnecter` ; hors ligne / serveur classes (`classifySaveError`, 3 classes testees) |
| JRNL-02 | VERIFIED (code/tests) ; capture a faire | 0 emoji (test sur les sources : `\p{Extended_Pictographic}`) et 0 violet dans `plugins/journal/src` ; 5 icones d'humeur identiques a l'accueil ; energie/stress en cases 1-5 + icones `battery-half`/`pulse` ; sarcelle selection/onglet/barres ; contextes mappes sur les 5 valeurs du CHECK (le bug `Post-seance -> post_seance` de l'ancien code est corrige, teste) |
| Q-P22b | VERIFIED (tests) | Quick Log (`apps/mobile/src/lib/quickLog.ts`) ecrit/lit desormais toujours `context='general'` ; Journal `General` met a jour la ligne du jour (bandeau + `Mettre a jour`), autres moments = entrees distinctes ; tests unitaires + rendu |
| COACH-01 | VERIFIED (logique + rendu composant) ; UAT en attente | `resolveLinkedView` : lien sans `preview` -> carte `Ton coach` + `COACH LIE` + `Profil indisponible` + `Reessayer` ; badge KYC seulement si `verified` ; squelette au chargement ; carte d'erreur reseau. Le garde `enabled: !!user?.id` de la requete de lien est retire (store non hydrate affichait l'etat A a un athlete lie) |
| COACH-02 | PARTIAL | `PluginHeader` de `@ziko/ui` sur tous les etats, titre 28 px supprime, safe-area intacte. Zone tactile 44 dp du chevron non traitee ici (composant partage, P5) |
| G-03 (outil IA) | VERIFIED (tests backend) | `journal_log_mood` : date Europe/Paris (plus UTC), contexte valide sinon `general`, 1 entree `general`/jour (mise a jour). `registry.ts` non touche |

## Fichiers
Journal : `plugins/journal/src/logic.ts` (+ `.test.ts`), `screens/JournalForm.tsx` (formulaire unique), `JournalPlugin.tsx` (2 onglets Aujourd'hui/Historique ; Tendances fusionne dans Historique, conforme au contrat), `JournalEntry.tsx` ; routes `apps/mobile/app/(app)/(plugins)/journal/{dashboard,entry}.tsx` (passent `requireUser`/`onReauth`). Coach : `plugins/coach/src/screens/{CoachCard.tsx,coachLinked.ts,coachLinked.test.ts}`, `CoachScreen.tsx`. Backend : `backend/api/src/tools/journal.ts`, `backend/api/test/tools/journal-mood.spec.ts`. Tests de rendu : `apps/mobile/src/__tests__/render/{journal,coachCard}.test.tsx`. `vitest.config.ts` (include journal + coach).

## Tests / gate (apres merge de milestone/v1.20)
- Racine `npx vitest run` : 40 fichiers, 740 tests verts (dont journal 19 et coach 8 nouveaux, quickLog +1).
- Rendu `apps/mobile` (`vitest.render.config.ts`) : 6 fichiers, 50 tests verts (journal 8, coachCard 3 nouveaux).
- Backend `journal-mood.spec.ts` : 5 verts. `apps/mobile` `tsc --noEmit` : 0 erreur.

## Deviations
1. **Quick Log (zone P8, mergee)** modifie : insertion/lecture `general` au lieu de `moodContext(hour)` (necessaire a Q-P22b ; `moodContext` conserve, non utilise a l'ecriture). Conflit possible avec tout agent touchant `quickLog.ts`.
2. Erreur reseau complete de Mon coach : carte d'erreur neutre `Impossible de charger` + `Reessayer` plutot que la carte `Ton coach` du contrat F02 (on ne peut pas affirmer le lien sans reponse).
3. Libelles et stats : `Ton coach Ziko` en sous-titre ; stats = celles existantes (Seances depuis le lien, Habitudes aujourd'hui) ; chaines nouvelles en dur FR (accepte par la charte), pas de cles i18n ajoutees.
4. Fond/ombres de `CoachScreen` etats A/B : inchanges (hors perimetre), seulement l'en-tete.
5. Onglets `SubTabs` restent a 12 sp (composant partage, P5).

## NON prouve
- Rendu natif reel (Android) : les tests de rendu utilisent react-dom + stubs RN (React-level seulement) ; aucune capture, contrastes mesures seulement par calcul du contrat. Scenarios JR-1..8 / CO-1..5 : voir `UAT-PLAN.md` (emulateur en file).
- `CoachScreen` complet non monte en test (imports natifs `expo-device`/`expo-notifications`) : seule la carte (`CoachCard`) et la logique (`resolveLinkedView`) sont testees ; le cablage ecran (header, etats loading/erreur) est verifie par type-check et relecture.
- Contrat reel de `/coach/clients/links/me` sans `preview` : simule, pas observe en base de test. Expiration reelle du jeton en arriere-plan : simulee par `SessionExpiredError`.
- `afternoon`/anciennes lignes `ziko_journal_entries` sans `date` (defaut UTC cote base) : l'historique se rabat sur `created_at` local seulement si `date` est absente.

## Besoins humains
Aucun secret. Validation visuelle des captures UAT (sarcelle, tuiles d'humeur) ; confirmer la deviation 2.

## Fichiers a risque de conflit
`vitest.config.ts` (liste include, deja resolu une fois), `apps/mobile/src/lib/quickLog.ts`, `plugins/coach/src/screens/CoachScreen.tsx` (P25), `apps/mobile/app/(app)/(plugins)/journal/*`.
