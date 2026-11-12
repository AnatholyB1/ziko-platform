# UAT-PLAN Phase 9 : Ajout de repas en un ecran

Emulateur (file apres P1). Compte de test, DB de test ou prod en lecture : les scenarios qui ecrivent (S2, S3, S6) utilisent le compte de test uniquement ; aucun appel Photo reel sans validation (S5 = 1 appel max).
Testids disponibles : `meal-recap`, `meal-recap-kcal`, `meal-chip-{breakfast|lunch|snack|dinner}`, `meal-suggestion`, `meal-method-{search|scan|barcode|custom}`, `meal-last-method`, `meal-search-input`, `meal-result`, `meal-skeleton`, `meal-no-result`, `meal-recent`, `meal-basket-item`, `meal-already-added`, `meal-group`, `meal-action-bar`, `meal-bar-total`, `meal-add-button`, `meal-scan-cost`, `meal-barcode-notfound`, `meal-barcode-manual`, `meal-custom-{name|calories|protein_g|carbs_g|fat_g}`.

| Id | Critere mesurable | Scenario | Attendu | Reqs |
|---|---|---|---|---|
| U1 | M-1 : 1 tap depuis la tuile Repas ouvre l'ecran unique ; <= 4 taps pour ajouter un aliment | Accueil, tap tuile Repas ; taper "poulet" ; tap un resultat ; tap `meal-add-button` | Compte de taps <= 4 (ouvrir, choisir, ajouter + saisie clavier), aucun 2e ecran avant l'ajout, retour a l'accueil | NUTR-01 |
| U2 | M-2 : creneau horaire | Horloge emulateur 08:15, 12:40, 16:00, 20:30, relancer l'ecran | chip selectionne = breakfast, lunch, snack, dinner ; texte `meal-suggestion` contient l'heure `HH:MM` | NUTR-02 |
| U3 | Hors creneau 02:00 | Horloge 02:00 apres un ajout "dinner" | chip = dernier repas utilise (dinner) ; sans historique = snack | NUTR-02 |
| U4 | M-2 : derniere methode memorisee | Choisir Manuel, ajouter, quitter, relancer l'appli | segment `meal-method-custom` actif a l'ouverture ; `meal-last-method` = "Derniere methode utilisee : Manuel" | NUTR-02 |
| U5 | M-3 : repas du jour visibles et somme exacte | Ajouter 2 repas (breakfast puis lunch), rouvrir l'ecran | `meal-group` par repas ; `meal-recap-kcal` = somme des kcal des groupes ; meme valeur que la tuile Repas de l'accueil (D-13) ; coche verte sur les chips des repas loges | NUTR-03 |
| U6 | A18 etat vide | Compte sans log du jour | texte "Rien n'a encore ete ajoute aujourd'hui." ; pas de `meal-group` | NUTR-03 |
| U7 | D-06 panier groupe | Ajouter 2 aliments dans le panier puis `meal-add-button` | libelle "Ajouter 2 aliments" ; total `meal-bar-total` = somme ; 2 lignes en base (verif lecture seule) avec meme `meal_type` et `date` locale ; un seul gain de credit | NUTR-01 |
| U8 | M-4 : 4 methodes sans navigation | Tap successif des 4 segments (arbre d'accessibilite / uiautomator) | les 4 boutons `meal-method-*` presents ; l'ecran (activite/route) ne change pas | NUTR-04 |
| U9 | Etats recherche | Taper un nom inconnu ; mode lent | 3 `meal-skeleton` pendant la requete ; puis `meal-no-result` + bouton "Saisir a la main" qui ouvre Manuel avec le nom preremplis | NUTR-04 |
| U10 | Q4 recents | Apres plusieurs ajouts, requete vide | `meal-recent` = aliments distincts des 14 derniers jours, tap = ajout au panier (aucun favori) | NUTR-03 |
| U11 | D-10 / Q3 cout photo reel | Segment Photo | `meal-scan-cost` = "3 credits IA par analyse" (cout de `backend/api/src/config/credits.ts`), "premiere analyse du jour offerte" | NUTR-04 |
| U12 | A21 code-barres introuvable | Segment Code, scanner un code inconnu (ex. 3017620422003 avec reseau coupe ou code invalide) | `meal-barcode-notfound` ; `meal-barcode-manual` ouvre Manuel sans quitter l'ecran | NUTR-04 |
| U13 | M-5 hors-ligne | Mode avion, Manuel : remplir 5 champs, `meal-add-button` | alerte "Enregistre hors connexion", retour ; reouverture sans reseau : groupe "En attente de synchronisation" ; reseau remis + reouverture : ligne en base, groupe normal | NUTR-04 |
| U14 | Charte | Captures vs `lot-A/png/a16..a21` | boutons pleins #CF4509 (texte blanc), focus champ Manuel = bord 2 dp primaire, cartes rayon 16 + ombre, cibles >= 44 dp | G1-G9 |
| U15 | Photo (1 appel reel max, apres validation) | Photo galerie d'un repas | resultats ajoutables au panier ; `meal_context` = repas choisi | NUTR-04 |

Scripts : `adb shell date` impossible sans root : utiliser Parametres > Date et heure (fuseau manuel) ou `adb shell su 0 date`; sinon verifier U2 par le test unitaire `mealTypeForHour` (deja vert) et une seule heure reelle.
