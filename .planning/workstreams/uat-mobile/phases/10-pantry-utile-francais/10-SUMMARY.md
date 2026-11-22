# Phase 10 : Pantry utile et en francais (Garde-manger), SUMMARY

Branche `phase/10-pantry` (base `milestone/v1.20`, merge de milestone refait, gate verte). Aucune ecriture prod, aucun appel IA reel, migration en fichier seulement (non appliquee).

## Livre
- **Ecran unique** `plugins/pantry/src/screens/PantryPlugin.tsx` : titre `Garde-manger`, onglets `Inventaire` / `Recettes` / `Courses` ; puces de lieu (Frigo, Congelateur, Placard) avec compteurs reels qui **filtrent** la liste (plus d'alerte) ; recherche ; badge de peremption en texte ; bouton `Ajouter un article` ; etats vide / erreur / squelettes. `PantryRecipes.tsx` et `ShoppingList.tsx` deviennent de fines enveloppes (routes `recipes` / `shopping` ouvrent le bon onglet). `PantryTabBar` supprime.
- **Fiche article** (`components/ItemSheet.tsx`, feuille basse B15) : quantite -/+ par pas d'unite, `Utiliser`, `Aux courses`, `Retirer` (confirmation), `Modifier`.
- **Ajout / scan** : `PantryItemForm.tsx` reecrit (francais, boutons `getActionPrimary`, date de peremption en heure locale, plus de decalage UTC) ; `BarcodeScanner.tsx` : permission camera refusee (B18), code inconnu -> saisie manuelle en 1 tap (B17), `utils/barcode.ts` etendu (nom + quantite parsee `500 g` / `75 cl` / repli 1 piece + categorie + kcal/100 g) ; bandeau `Prerempli depuis le code-barres ...`. Etat vide : `Scanner un code-barres` ouvre directement la camera.
- **Recettes IA** : rappel `Il te reste aujourd'hui` (objectifs du plugin nutrition - repas du jour, date locale) ; bouton `Generer des recettes · N credit(s)` (cout lu de `CREDIT_COSTS.recipes` via la route, defaut 1) ; chaque proposition : `n sur N ingredients`, `Manque : ...`, `rentre dans tes macros` ; carte `Credits epuises` sur 402.
- **Courses** : `Il manque dans ton frigo` (calcule : stock bas / epuise / perime, raison affichee + lignes de recettes) et `Ajoutes par moi` ; cases a cocher ; barre `Ranger N article(s) dans le garde-manger` (additionne en stock, remplace un article perime, cree les inconnus, supprime la ligne).
- **Backend** (`backend/api`) : `POST /pantry/recipes/suggest` derriere `creditCheck('recipes')` + `creditDeduct('recipes')` ; `CREDIT_COSTS.recipes = 1`, `DAILY_QUOTAS.recipes = {1, 0}` (config additive, `creditGate.ts` non modifie) ; objectifs utilisateur (`ziko_user_plugins.settings` nutrition, repli constantes) ; date locale du client dans le corps. Helpers purs `routes/pantry-recipes-macros.ts`.
- **Migration** (fichier) `supabase/portfolio-migrations/20261201100100_shopping_manual_items.sql` : valeur d'enum `manual`, colonnes `reason`, `checked`. Verifiee par `scripts/uat/check-migration-names.mjs` (OK).
- Mobile : `apps/mobile/src/lib/creditCosts.ts` (+ `recipes: 1`), routes `dashboard|recipes|shopping|add` (cout credit, param `scan`), stub de test `expo-router` (+ `useFocusEffect`, `useLocalSearchParams`).
- `UAT-PLAN.md` : 17 scenarios S1..S17 ; aucun mot de plus dans `i18n.ts` central (les nouveaux libelles vivent dans `plugins/pantry/src/utils/copy.ts`).

## Exigences
| Req | Statut | Preuve |
|---|---|---|
| PANT-01 lieux filtrent la liste | VERIFIED (rendu DOM) / PARTIAL (appareil) | `render/pantry.test.tsx` : compteurs 3/1/2, filtre sans navigation ni alerte ; S1 sur emulateur a faire |
| PANT-02 ajout manuel | PARTIAL | formulaire reecrit, type-check ; flow non execute (S5) |
| PANT-03 scan prerempli, code inconnu, camera refusee | PARTIAL | `pantry.test.ts` : `parseOffQuantity`, `parseOffProduct`, `mapOffCategory`, `lookupBarcode` (fetch mocke) ; camera non testee (S6-S8) |
| PANT-04 fiche + onglets | VERIFIED (rendu) | tests feuille : `Utiliser` -> quantite 350 en base fake ; badges texte |
| PANT-05 recettes avec macros restantes, 1 credit | VERIFIED (serveur, mocks) / PARTIAL (reel) | `pantry-recipes.test.ts` : 402 sans appel IA, debit 1 credit, quota gratuit sans debit, pas de debit sur 5xx, macros = objectifs - repas de la date locale, prompt contient `Calories : 1160 kcal` ; rendu : rappel, cout depuis les props, 402 |
| PANT-06 courses dynamiques + manuel + ranger | VERIFIED (logique + rendu sur faux DB) / PARTIAL (prod : migration) | `planRanger`, `computeMissing` ; rendu : ranger -> quantite 1,2 / ligne manuelle supprimee et inseree |
| PANT-07 0 mot anglais | VERIFIED (copy + DOM rendu) | test sur toutes les chaines de `copy.ts` + DOM des 3 onglets ; `RecipeDetail`/`RecipeConfirm` inchanges (cles `pantry.*` francaises) |

## Tests / gate (apres merge milestone, env factices)
- `apps/mobile` : `vitest run` 9 fichiers / 173 tests ; render config 3 fichiers / 26 tests (dont `pantry.test.tsx` 14) ; `tsc --noEmit` vert (mobile, `plugins/pantry`).
- `backend/api` : `tsc --noEmit` vert ; `vitest run` 24 fichiers / 300 tests verts (dont `pantry-recipes.test.ts` 7 + `pantry-recipes-macros.test.ts` 6 ; 8 fichiers RLS/DB distants ignores comme en CI sans secrets).

## Decisions appliquees
D-01..D-12 (maquette lot B), Q5 = nouvelle action `recipes` (1 credit, 1 generation gratuite/jour, pas de bonus), bouton plein `getActionPrimary` (#CF4509), autres reponses recommandees. Choix : la liste "Il manque" est calculee cote client (aucune ecriture) ; ranger d'une ligne calculee ajoute `max(seuil, 1)` ; un article perime rachete remplace la quantite et efface la date.

## Deviations
- Export/partage de la liste (icone) retire : absent de la maquette B20.
- `Congelateur` en toutes lettres (la maquette B16 dit `Congelo`).
- `checked` persiste en best-effort (si la colonne est absente, l'etat reste local).
- `i18n.ts` central non modifie : les anciennes cles `pantry.*` (dont l'anglais `en`) subsistent pour `RecipeDetail`/`RecipeConfirm`.

## NON prouve
Rendu natif (tailles, cibles 44 dp, ombres), camera et permission, couverture reelle Open Food Facts, appel Sonnet reel, RPC SQL de debit (`ziko_deduct_ai_credits` avec `p_action_type = 'recipes'` non execute), comportement sous un autre fuseau, persistence de `checked` en base.

## Besoins humains / orchestrateur
1. Verifier (lecture seule) puis appliquer `20261108000000_ziko_shopping_list.sql` si la table n'existe pas en prod, ensuite `20261201100100_shopping_manual_items.sql`.
2. Valider la politique de credit `recipes` (1 gratuite/jour puis 1 credit).
3. UAT emulateur S1..S17 apres P1.

## Fichiers susceptibles de conflit
`backend/api/src/config/credits.ts`, `apps/mobile/src/lib/creditCosts.ts`, `apps/mobile/src/__tests__/render/stubs/expo-router.ts` (2 exports ajoutes en fin de fichier), `plugins/pantry/package.json` (exports `./utils/*`), routes `apps/mobile/app/(app)/(plugins)/pantry/{dashboard,recipes,shopping,add}.tsx`.
