# Phase 9 : Ajout de repas en un ecran, SUMMARY

Branche `phase/09-repas` (base `milestone/v1.20`, merge de milestone refait avant fin, gate verte). Aucune migration (bloc 20261201 09NN inutilise), aucun backend touche, aucune ecriture prod, aucun appel IA reel.

## Livre
- `packages/plugin-sdk/src/mealLog.ts` (+ export index) : logique pure (creneaux horaires, panier, lignes d'insert groupe, groupement des repas du jour, recents 14 j, libelle cout photo, file hors-ligne, prefs, `saveMeal` = un seul `insert([...])`).
- `plugins/nutrition/src/screens/LogMealScreen.tsx` reecrit en ecran unique : recap du jour (kcal/macros vs objectifs), chips repas preselectionnes avec coche verte, message "X suggere d'apres l'heure (HH:MM)", segment Chercher/Photo/Code/Manuel, "Derniere methode utilisee", bloc "Deja ajoute aujourd'hui", recents, panier + barre collante "Ajouter N aliments" + total, boutons pleins `getActionPrimary(theme)` (#CF4509).
- Route `nutrition/log.tsx` : `onSaved` invalide `['nutrition']` (tuile accueil P8, D-13).
- i18n : namespace `meal.*` (fr + en) ajoute a la fin de `i18n.ts`.
- `UAT-PLAN.md` : 15 criteres mesurables U1..U15 avec testids.

## Exigences
| Req | Statut | Preuve |
|---|---|---|
| NUTR-01 un ecran, <= 4 taps | PARTIAL | code : ecran unique, ajout groupe, retour ; taps non comptes sur appareil (U1) |
| NUTR-02 repas par heure + methode memorisee | PARTIAL | tests unitaires `mealTypeForHour` (creneaux, bornes, hors creneau), `parsePrefs` ; persistance AsyncStorage non executee (U2-U4) |
| NUTR-03 repas du jour visibles | PARTIAL | tests `groupByMeal` (somme groupes == `sumMacros`), recents ; rendu non vu (U5, U6, U10) |
| NUTR-04 4 methodes, hors-ligne | PARTIAL | tests `saveMeal` (un insert, reseau -> file), `isNetworkError`, file ; flows camera/barcode/photo non executes (U8-U13) |

## Tests / gate
- `packages/plugin-sdk/src/mealLog.test.ts` : 33 tests verts (dont anti-derive : cout `scan` backend `credits.ts` == miroir mobile == `SCAN_CREDIT_COST`, et l'ecran n'embarque plus `scan: 3`).
- Gate apres merge milestone : `npx vitest run` racine 24 fichiers / 404 tests verts ; `tsc --noEmit` vert sur `apps/mobile`, `packages/plugin-sdk`, `plugins/nutrition` (env factices).

## Decisions appliquees
D-06 panier + insert groupe ; D-07 prefs `ziko:meal:prefs` (AsyncStorage, comme `rpe`/`userPrefsStore`) ; D-08 creneaux, 22h inclus dans diner (contrat 18-22), 23h-04h59 = dernier repas puis snack ; D-09 recents seulement (0 migration, Q4 = A) ; D-10 cout photo reel 3 credits + "premiere analyse offerte" (Q3 = A) ; D-11 un seul `earnCredit` par ajout groupe (cle = id du 1er log) ; D-13 invalidation `['nutrition']`.

## Deviations
- D-12 : l'ecran utilise toujours la date locale du jour ; `selectedDate` du store (init UTC) n'est plus lu. Pas de signalement de date passee (aucun appelant ne passe de date).
- Hors-ligne : ajout d'une file persistante (AsyncStorage `ziko:meal:pending`, vidage a l'ouverture suivante) pour honorer "sera synchronisee" (A21). Pas de vidage en arriere-plan.
- "Photo" : pas de cadre camera live dans l'onglet (A19 = apercu) ; actions camera/galerie via `expo-image-picker` comme avant.
- Quantite non editable dans le panier (portion catalogue par defaut ; le code-barres garde son stepper de grammes). Edition/suppression d'un repas deja logue : differe (deferred du CONTEXT).
- Rappel du contrat "1 credit IA par analyse" (A19) remplace par le cout reel (decision utilisateur Q3).

## NON prouve
Tout le rendu et les interactions RN (aucun test de composant : le vitest racine ne couvre pas les ecrans RN) ; fidelite pixel aux PNG A16-A21 ; permissions camera ; flux Photo/Code-barres reels ; persistance AsyncStorage et flush hors-ligne ; refresh de la tuile accueil ; `earnCredit` unique. Tout cela = UAT emulateur U1..U15.

## Besoins humains
Aucun. Si l'utilisateur veut des favoris persistes : table + migration bloc 0901 (differe).

## Fichiers a risque de conflit
`packages/plugin-sdk/src/i18n.ts` (fin des dicts fr/en, namespace `meal.*`), `packages/plugin-sdk/src/index.ts` (une ligne d'export), `apps/mobile/app/(app)/(plugins)/nutrition/log.tsx`. `LogMealScreen.tsx` : P10 (Pantry) ne doit pas le modifier sans rebase.
