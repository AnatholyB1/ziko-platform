# FIX-UAT-RUN6 : corrections des defauts confirmes par le run 6 d'UAT

Branche `fix/uat-run6` (base `milestone/v1.20`, deja a jour). Aucun push, aucune migration appliquee, aucune ecriture prod.

## Corrige (un commit par defaut, tests inclus)

1. **Critique : "Sauvegarder & fermer" -> Unmatched Route** (existe aussi sur main/prod).
   - `apps/mobile/app/(app)/workout/summary.tsx` : cible `/(app)/workout` (onglet Entrainement ; le groupe `(tabs)` n'existe pas) ;
     le `router.replace` du cas "pas de seance" est passe dans un `useEffect` (plus de navigation pendant le rendu).
   - Audit des routes : test statique `apps/mobile/src/__tests__/routeTargets.test.ts` (liste les fichiers expo-router reels, verifie tout litteral
     passe a `router.push/replace/navigate`, `href`, `pathname:` et toute chaine `/(app)|(plugins)|(auth)/...` ; groupes ecrits explicitement
     doivent exister dans l'ordre, groupe omis tolere, `${...}` = segment dynamique, query ignoree). Exceptions documentees : liens `http(s)`/`mailto`,
     routes construites par variable (non analysables), prefixes de `notificationRoutes.ts` (verifies a part).
   - Ecarts trouves et corriges : `summary.tsx:63` (`/(app)/(tabs)/workout`) et `profile/index.tsx:~1105` (`/(app)/(workout)/session`, groupe inexistant,
     remplace par `/(app)/workout`). Aucun autre ecart.
2. **Demarrage a froid hors ligne -> onboarding** : `apps/mobile/src/lib/profileGate.ts` (`classifyProfileRead`, `decideAppGate`, cache profil) ;
   `authStore.refreshProfile` distingue lecture reussie / profil absent (PGRST116) / echec reseau (`profileStatus`), met le profil en cache
   (AsyncStorage, cle par utilisateur ; l'app n'utilise pas MMKV pour l'auth) et le relit en echec. `(app)/_layout.tsx` et `app/index.tsx` utilisent
   `decideAppGate` : onboarding seulement si le profil est lu et absent/incomplet ; echec reseau => app degradee ; lecture en cours => attente.
   Tests : `src/lib/__tests__/profileGate.test.ts` (logique pure).
3. **Defi collectif LG-18** : `rules.ts` (`total_hidden`, `hidden`), `cards.tsx` (pas de barre), texte "Total masque (moins de 3 participants)" + contribution
   propre conservee. `parseCollective` lit `total_hidden` et traite `total: null` comme masque. Tests rules + rendu (`league.test.tsx`).
4. **Mineurs** :
   - pluriels FR : `src/lib/frLabels.ts` ("1 serie completee", "1 jour"), "HIGHLIGHT" -> "Temps fort", kcal accueil `490 / 2000 kcal` (anneau + tuile Repas) ;
   - nom de seance : defaut `Séance libre` (plus `Quick Workout`), nom de jour trop court ("A") prefixe du programme (`Force 5x5 · A`) ;
   - une seule seance ouverte : `startSession` / `startPlannedSession` ferment les precedentes (sans serie : supprimee ; avec series : terminee a l'heure de la derniere serie) ;
   - statut programme sur chaque ligne de la liste P7 : `Actif` / `En pause` / `Terminé` / `Pas encore démarré` (`deriveProgramStatus` ; select IA etendu a `started_at, completed_at`).
   - Au passage : 3 tests `workoutStore` deja rouges sur la base (champ `replaced` ajoute au retour) mis a jour.
5. **Plafond de gain de credits (daily_earned 6 > cap 4)** : cause probable = course dans `ziko_earn_ai_credits` (comptage puis insertion sans verrou,
   appels `earnCredits` des outils du chat en fire-and-forget). Le plafond est correct en sequentiel (fonction et service passent tous par la RPC, aucun autre insert `earn`).
   Migration `supabase/migrations/202612012903_earn_credits_daily_cap_lock.sql` (verrou consultatif par utilisateur, signature inchangee, service_role seul), NON appliquee.
   `ziko_deduct_ai_credits` / facturation : non touches.

## Non corrige / reserves
- Point 5 : la cause est une hypothese (le corps de la RPC en prod n'a pas ete relu : lecture seule non demandee). Le test est statique (lit le SQL) et ne prouve pas la concurrence reelle.
  Les gains deja depasses restent en base (pas de correction de donnees).
- Cache profil : AsyncStorage, pas MMKV (la session persistee y vit deja).
- `CompareScreen` (`unit="jours"`) non pluralise (valeur affichee a part) ; LG-5 ("sur 28 habitudes" vs 21) non investigue.

## A re-verifier sur emulateur
- "Sauvegarder & fermer" arrive sur l'onglet Entrainement sans erreur Navigator ; bouton du profil vide ("Commence ta premiere seance").
- Cold start avion (session persistee + profil en cache et sans cache) : pas d'onboarding ni Bienvenue ; compte neuf en ligne : onboarding.
- Defi eau a 1 participant : "Total masque", pas de barre ; a 3 participants : total reel.
- Second demarrage de seance : plus de seance ouverte residuelle ; nom "Séance libre" / "Programme · A".
- Liste P7 : etiquettes de statut ; accueil : `490 / 2000 kcal`, "1 jour".
- Migration 2903 apres application sur la branche uat : appels earn concurrents, `daily_earned <= daily_cap`.

## Gate (tout vert)
type-check mobile (hors `.expo/types/router.d.ts`, absent) + backend ; `npx vitest run` racine 76 fichiers / 1148 tests ; backend/api 569 tests ;
rendu mobile `vitest.render.config.ts` 89 tests ; test statique GRANT migrations (`v120MigrationGrants`) vert dans le run racine.
