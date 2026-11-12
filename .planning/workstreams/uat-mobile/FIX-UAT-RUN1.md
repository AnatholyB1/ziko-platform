# FIX-UAT-RUN1 (branche `fix/uat-run1`, base `milestone/v1.20`)

Gate : `npx vitest run` racine 49 fichiers / 844 tests verts (+ `settings.test.ts` hydratation 22, `uatRun1Guards.test.ts` 16) ; `apps/mobile` `vitest.render.config.ts` 7 fichiers / 56 tests verts ; `tsc --noEmit` mobile et plugin hydratation propres.
Les tests ajoutes sont de niveau source / logique pure : ils ne prouvent PAS le comportement natif (clavier reel, rendu). Toute la colonne "A re-verifier" est a rejouer sur emulateur.

## Corrige
| # | Defaut | Correction | Fichiers |
|---|---|---|---|
| 1 | P8 U4 feuille poids masquee par le clavier | `KeyboardAvoidingView` (`padding` iOS / `height` Android) autour des feuilles Humeur + Poids de l'accueil ; meme correctif sur la feuille Nouvelle mesure (P15) et la feuille Nouvelle habitude (P3). Hydratation (P11) et Objectifs mesures avaient deja un KAV. Sommeil (P17) n'a aucune feuille avec champ texte. Aucun `softwareKeyboardLayoutMode` dans app.json (defaut Expo = resize) : le KAV `height` est le mecanisme retenu. | `apps/mobile/app/(app)/index.tsx`, `plugins/measurements/src/screens/MeasurementsPlugin.tsx`, `plugins/habits/src/screens/HabitsPlugin.tsx` |
| 2 | P12 Succes "0 sur 0" | Migration fichier (NON appliquee) : policy SELECT `authenticated` `using (true)` sur `ziko_badge_definitions`, idempotente (garde `to_regclass` + `pg_policies`). Colonnes du catalogue : slug, name, description, icon, condition_type, condition_value, tier : rien de sensible ; aucune ecriture ouverte. | `supabase/migrations/202612011203_badge_definitions_select_policy.sql` |
| 3 | XCUT-06 noms d'exercices accueil | Carte Mission du jour via `exerciseDisplayName(name, name_fr, exerciseNames)`. Atelier (liste d'exercices + prefill chat) idem. Detail de seance, resume, historique des exercices, picker : deja conformes (P5). `history.tsx` n'affiche que le nom de seance. | `apps/mobile/app/(app)/index.tsx`, `workout/atelier.tsx` |
| 4 | Objectif d'eau 2.5 L (accueil) vs 2.0 L (plugin) | Source unique : `fetchEffectiveGoalMl` (objectif profil `hydration_goal_ml` + bonus jour de seance de `ziko_hydration_settings`) + `DEFAULT_GOAL_ML = 2000` dans `plugins/hydration/src/settings.ts`. L'accueil (`useHydrationToday` retourne `{ totalMl, goalMl }`) et le plugin lisent la meme valeur ; sauvegarde objectif/reglages invalide `['hydration','goal',userId]`. Test : `settings.test.ts` (defaut 2000, profil+bonus, hors bornes). | `plugins/hydration/src/settings.ts`, `HydrationPlugin.tsx`, `package.json` (export `./settings`), `apps/mobile/src/hooks/useHomeData.ts`, `index.tsx` |
| 5 | Anglais residuel | `session.tsx` : "N exercice(s)", "Aperçu du programme", "N séries · N rép. · Ns de repos", "OBJECTIF", "rép.", "Répétitions effectuées", "Suivant : série N", "Temps de repos", "Reprendre / Lancer le minuteur", fallbacks "Séance"/"Exercice", instructions = `instructions_fr ?? instructions`. Noms de plugin/routes : Habits -> Habitudes, Add Habit -> Ajouter une habitude, Nutrition Tracker -> Suivi nutritionnel (+ Log Meal), Analytics -> Statistiques (+ Exercise Stats, Session Detail), My AI Coach -> Mon coach IA ; `gating.ts` (noms de modules verrouilles) aligne. | `workout/session.tsx`, `workout/index.tsx`, `index.tsx`, `plugins/{habits,nutrition,persona,stats}/src/manifest.ts`, `packages/plugin-sdk/src/gating.ts` |
| 6a | Emoji etat vide Habitudes | Ionicons `leaf-outline` | `HabitsPlugin.tsx` |
| 6b | FAB bug sur le titre QUICK LOG | Position initiale a droite, au-dessus de la barre d'onglets (restait deplacable/snap) | `packages/ui/src/components/BugFab.tsx` |
| 6c | Grille Quick Log qui descend apres un log | `minHeight: 88` + `justifyContent: flex-start` sur les 4 tuiles (la 3e ligne de statut ne change plus la hauteur) | `index.tsx` |

## Non corrige / hors perimetre
- Instructions d'exercice : si `instructions_fr` est vide en base, le texte anglais reste affiche (pas de traduction automatique).
- Texte residuel anglais ailleurs que `session.tsx` / manifests (ex. `workout/exercise/*`, i18n `en`) : non audite exhaustivement ; `grep` cible limite a `workout/session.tsx`, `workout/index.tsx`, manifests.
- Constat 6 de l'UAT (refresh au retour P2 U1), libelle niveau a 0 XP, coach IA Mesures "mesures stables", log `refresh_token_not_found` : hors liste de cette mission.
- Migration 1203 non appliquee (a faire par l'orchestrateur sur la branche de test ; la policy de fixture `badge_definitions_read_uat` du seed UAT devient redondante).

## A re-verifier sur emulateur (criteres)
1. Accueil > Poids : ouvrir "Log ton poids", focus sur le champ : champ ET bouton "Confirmer" visibles au-dessus du clavier (hauts < y clavier ~1695) ; saisir 72.4, Confirmer, la tuile affiche "logue". Idem feuille Humeur (ouverture OK), Mesures > Nouvelle mesure, Habitudes > Nouvelle habitude (nom visible clavier ouvert).
2. Apres application de la migration 1203 sur la branche de test (sans la policy de fixture) : Succes affiche "N sur 12" (pas "0 sur 0"), `pg_policies` liste `ziko_badge_definitions_select_authenticated`.
3. Accueil > Mission du jour : noms en francais, majuscule initiale (plus de "assisted lying calves stretch" en minuscule), identiques a l'ecran seance.
4. Accueil et Hydratation affichent le meme objectif (ex. "0.0L / 2.0L" sur les deux, puis valeur identique apres changement d'objectif et un jour de seance avec bonus) ; changer l'objectif puis revenir a l'accueil : mis a jour.
5. Ecran seance : aucun mot anglais visible ("8 exercices", "Aperçu du programme", "OBJECTIF ... rép.", "Répétitions effectuées", "Suivant : ...", "Temps de repos") ; header du plugin Habitudes = "Habitudes".
6. Habitudes sans donnee : icone feuille (pas d'emoji) ; Accueil : le bouton "Signaler un bug" est en bas a droite au-dessus des onglets et ne recouvre pas "QUICK LOG" ; taper une tuile Quick Log (eau) : la position verticale de la grille et du contenu en dessous ne bouge pas.
