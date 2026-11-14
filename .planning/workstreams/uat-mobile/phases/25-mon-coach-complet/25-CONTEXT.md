# Phase 25 : Mon coach complet (SEED-002) - Context

**Gathered:** 2026-11-13 (agent p25, audit du code reel). Req : MCOA-01..04. Wave 5. UI hint oui. **Aucune maquette** : `25-UI-SPEC.md` fait foi (criteres mesurables, pas de HTML rendu : cout/RAM non justifies, ecrans = extensions de `CoachScreen`/`CoachCard` P22).
`[A CONFIRMER]` = recommandation a valider par l'utilisateur ; sans marque = decide par les contraintes du repo.

## MCOA-01 : audit de l'existant vs SEED-002

| Besoin SEED-002 | Etat reel | Verdict |
|---|---|---|
| Plugin `coach`, manifest, `PLUGIN_LOADERS` | `plugins/coach/src/manifest.ts` (`mandatory: true`), `PluginLoader.tsx` l.28/33 | OK |
| Pre-installe | `autoInstallCoachPlugin` (roles `client`/`both`) + `MANDATORY_PLUGIN_IDS` charge sans lire `user_plugins` ; ligne `coach` dans `ziko_plugins_registry` (migration 047) | OK |
| Non desinstallable | UI : `store/[id].tsx` masque la corbeille si `manifest.mandatory`. **`store/index.tsx` (liste du store) : `uninstallPlugin()` appelee SANS garde** (bouton de `PluginCard` + bouton hero) => un athlete desinstalle Mon coach. **Aucune garde en base** (`ziko_user_plugins` : DELETE/UPDATE autorises par la policy `_own`) | **MANQUE** (UI liste + base) |
| Etat A (code, 6 car. `[A-Z2-9]`, collage) | `CoachScreen` : OK (filtre, `maxLength 6`, erreur a temps constant) | OK |
| Etat B (apercu : photo, nom, specialites, bio, KYC) | OK ; bouton plein = `theme.primary` (pas `getActionPrimary`), pas de a11y role | PARTIEL (charte bouton) |
| Etat C (lie : carte, "depuis", stats) | `CoachCard` + `resolveLinkedView` (P22), etat degrade sans `preview` | OK |
| Retrait depuis Mon coach, confirmation saisie | `Retirer ce coach` + modale "Tapez COACH" -> `DELETE /coach/clients/links/:id` -> `revokeLink` (UPDATE `revoked_at`) | OK ; copie anxiogene ("supprime le lien"), pas de reassurance, pas d'invalidation des programmes |
| Retrait sans punition, **historique conserve** | `revoked_at` conserve la ligne (soft). Aucun ecran/endpoint d'historique ; `revoked_by` absent | **MANQUE** (lecture historique) |
| **RLS stricte du lien** | Policy `coach_client_links_participant_revoke` : `FOR UPDATE USING/WITH CHECK (uid = coach_id OR uid = client_id)` **sans restriction de colonnes**. Un athlete peut **remettre `revoked_at = NULL`** (annuler son retrait), changer `coach_id` (se lier a n'importe quel compte sans code) ; un coach peut changer `client_id` (se rattacher a un athlete arbitraire : `is_coach_of` devient vrai => acces lecture a ses donnees) | **FAILLE** (a corriger : trigger) |
| Section "Mon coach" dans les reglages | `apps/mobile/app/(app)/profile/settings.tsx` : aucun lien. Le plugin est accessible via Modules/accueil | MANQUE (mineur) |
| Programme prescrit visible | Aucun lien Mon coach <-> programme. Le programme coach (`ziko_workout_programs.assigned_to_user_id = athlete`, `created_by_coach_id = coach`, policy lecture athlete `workout_programs_assigned_athlete_read`) n'apparait que dans Programmes (P7) | **MANQUE** (MCOA-04) |
| i18n `coach.*` | cles fr dans `plugin-sdk/src/i18n.ts` ; les chaines P22 sont en dur FR (accepte) | OK |
| Outils IA `coach_get_link` / `coach_revoke_link` | Existants (`backend/api/src/tools/coach.ts`, `confirmed:true` exige) | OK, non modifies |

## Decisions

- **D-01** Id de plugin `coach`, nom `Mon coach` conserves (SEED laissait l'id TBD ; deja livre/charge partout). Pas de renommage.
- **D-02** Les 3 etats restent portes par `CoachScreen` ; la decision d'etat devient une fonction pure `resolveCoachState` (`plugins/coach/src/screens/coachState.ts`) testee (code / apercu / lie / erreur), pour que l'etat B ne puisse pas masquer un lien actif.
- **D-03** Non-desinstallable en 3 couches : manifest (existe) ; garde UI dans la liste du store (`isMandatoryPlugin` partage, bouton remplace par un cadenas inactif + `showAlert` explicatif) ; **garde en base** (migration `20261201250300`, trigger BEFORE DELETE / UPDATE `is_enabled=false` sur `ziko_user_plugins` pour `plugin_id='coach'`, uniquement quand l'appelant EST le proprietaire : `auth.uid() = OLD.user_id`, donc les suppressions de compte/service_role/cascade restent possibles).
- **D-04** RLS stricte du lien (migration `20261201250100`) : (a) trigger `ziko_coach_link_guard` BEFORE UPDATE : `coach_id`, `client_id`, `created_at` immuables pour tout appelant authentifie ; `revoked_at` ne peut etre mis qu'une fois (NULL -> now), jamais remis a NULL ; l'athlete ne peut modifier **que** `revoked_at` ; le coach garde `expires_at`/`shared_note` (utilises cote plateforme coach) ; (b) colonne `revoked_by` (`'client'|'coach'`, remplie par le trigger) pour l'historique ; (c) policy UPDATE scindee (client / coach) a la place de l'OR. `service_role` (auth.uid() NULL) non concerne.
- **D-05** Retrait **sans punition** : (i) le lien est conserve en soft (`revoked_at`, `revoked_by='client'`), jamais supprime ; (ii) aucun effet sur les donnees de l'athlete (seances, habitudes, journal...), aucun credit/XP retire, pas de delai avant un nouveau lien ; (iii) le programme prescrit **reste lisible et reste actif** (l'athlete ne perd pas sa seance du jour) ; il est desormais libelle "Ancien programme de ton coach" ; (iv) theme coach efface (`clearCoachTheme`) ; (v) message de fin neutre ("Tu n'es plus lie a X. Ton historique est conserve."). `[A CONFIRMER]` : garder le programme actif apres le retrait (reco) plutot que le desactiver.
- **D-06** Confirmation du retrait : on **garde la saisie `COACH`** du SEED (action destructrice du lien, deja livree), mais la modale liste ce qui est CONSERVE (historique, programmes, donnees) et le bouton d'annulation est le plus visible. `[A CONFIRMER]` : alternative sans saisie (deux boutons) si la saisie est jugee punitive en UAT.
- **D-07** Historique : endpoint `GET /coach/clients/links/history` (liens revoques de l'athlete, RLS participant-read, nom du coach via profil public) et bloc "Anciens coachs" (max 5, repliable) dans l'etat A de Mon coach. Pas d'ecran dedie. Le coach ne voit jamais l'historique de l'athlete avec d'autres coachs (filtre `client_id = auth.uid()`).
- **D-08** Programme prescrit (MCOA-04) : carte "Programme de ton coach" dans l'etat C, sous la carte coach. Source = `ziko_workout_programs` (non template) `assigned_to_user_id = athlete` ET `created_by_coach_id = link.coach_id`, le plus recent. Statut derive (`prescribedProgramView`, pur) : `active` (is_active), `replaced` (un autre programme athlete est actif : l'ecrasement est AUTORISE, P7), `available` (aucun actif). Actions : `Voir le programme` (detail P7) ; si non actif `Reprendre ce programme` -> `ziko_set_active_program('workout', id)`, **avec confirmation** si cela remplace un autre programme actif (`showAlert` 2 boutons, texte "Remplacer X ?"). Aucune activation automatique. Pas de programme prescrit => ligne "Ton coach n'a pas encore prescrit de programme" (jamais de carte vide).
- **D-09** Pas de migration sur les programmes (RPC P7 suffit). Les tables `coach_*` gardent leur prefixe reel `ziko_`.
- **D-10** Bouton plein = `getActionPrimary(theme)` (corrige l'etat B : `theme.primary`), Ionicons, `showAlert`, `paddingBottom: 100`, FR en dur (charte).
- **D-11** Hors perimetre : section "Mon coach" dans les reglages (Gap mineur, point d'entree deja via Modules/accueil) ; messagerie/contact coach ; demarrage d'une seance depuis un programme `ziko_workout_programs` (note P7 : traite avec P18/P23) ; changement des outils IA.

## Gray areas (reco `[A CONFIRMER]`)
- **G-01** Garder le programme actif apres le retrait (D-05 iii) : reco OUI.
- **G-02** Saisie `COACH` conservee (D-06) : reco OUI pour le SEED, a revalider en UAT.
- **G-03** Un athlete retire puis rejoint le meme coach : nouveau lien (index unique partiel `WHERE revoked_at IS NULL`), ancien conserve. Le programme prescrit precedent reste celui du coach (meme `created_by_coach_id`) : pas de doublon cree par nous.
- **G-04** Comptes `role='coach'` : pas d'installation auto du plugin (inchange) ; la garde base ne les concerne pas (pas de ligne).

## Migrations (fichiers seulement, jamais appliquees ; bloc 2501-2509)
- `20261201250100_coach_link_guard.sql` : `revoked_by`, trigger `ziko_coach_link_guard`, policies UPDATE scindees.
- `20261201250200_coach_link_history_index.sql` : index `(client_id, revoked_at)` pour l'historique athlete.
- `20261201250300_mandatory_plugin_guard.sql` : trigger de non-desinstallation de `coach`.
Ordre : 2501 -> 2502 -> 2503 ; idempotentes (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, `ADD COLUMN IF NOT EXISTS`).

## Code context
`plugins/coach/src/screens/{CoachScreen,CoachCard,coachLinked}.tsx|ts` ; `backend/api/src/coach/clients/{db,service,types}.ts` ; `apps/mobile/src/lib/{programs,programsService}.ts` (P7) ; `apps/mobile/app/(app)/store/{index,[id]}.tsx` ; `apps/mobile/src/lib/PluginLoader.tsx` (zone P25) ; `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (schema reel `ziko_*`).

## Verification (rappel)
Tests purs (etat, programme prescrit, garde mandatory, mapping historique), test de rendu du bloc programme/historique, test backend `getLinkHistory` (client mocke) + route, test RLS distant `test/rls/coach-link-guard.spec.ts` (exclu sans base de test) ; SQL non execute (non prouve). UAT emulateur : voir `UAT-PLAN.md`.
