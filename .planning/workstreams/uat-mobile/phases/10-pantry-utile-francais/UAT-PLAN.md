# UAT-PLAN Phase 10 : Garde-manger (Pantry utile et en francais)

Emulateur (file apres P1). Compte de test uniquement pour les scenarios qui ecrivent. Aucun appel Anthropic reel sans validation (S9 = 1 appel max, sinon backend local avec env de la branche de test, port 8205, jamais l'env prod).

**Prerequis BASE (orchestrateur, hors perimetre agent)** : `ziko_shopping_list_items` + type `ziko_shopping_item_source` doivent exister (fichier `supabase/portfolio-migrations/20261108000000_ziko_shopping_list.sql`, "NOT YET APPLIED"), puis `supabase/portfolio-migrations/20261201100100_shopping_manual_items.sql` (valeur `manual`, colonnes `reason`, `checked`). Sans eux : l'onglet Courses affiche seulement la liste calculee ("Il manque") et l'ajout manuel / "Aux courses" echoue avec une alerte `Impossible d'ajouter a la liste. Reessaie.`

**Seed** : 12 articles : Frigo 5 (dont du lait 0,2 L seuil 0,5 expirant demain, du poulet expirant dans 2 j, des oeufs dans 9 j), Congelateur 2, Placard 5 (dont un article perime). Un 2e compte sans credits ni quota du jour pour l'etat 402. Reperes d'accessibilite : libelles `Frigo 5`, `Congelateur 2`, `Placard 5`, onglets (role tab) `Inventaire` `Recettes` `Courses`, `Rechercher dans le garde-manger`, `Augmenter la quantite`, `Diminuer la quantite`, case a cocher (testid `shopping-checkbox`).

| Id | Critere | Scenario | Attendu | Reqs |
|---|---|---|---|---|
| S1 | P-1 | Ouvrir Garde-manger ; taper `Placard`, `Congelateur`, `Frigo` | la liste est filtree sur place (aucune alerte systeme, aucune navigation) ; compteurs des puces = nombres reels (5/2/5) | PANT-01, PANT-04 |
| S2 | P-2 | Parcourir les 3 onglets + fiche + ajout + scan (dump uiautomator) | titre `Garde-manger` ; onglets `Inventaire`, `Recettes`, `Courses` ; `grep -Ei "Pantry|Shopping|Low|Out of stock"` = 0 resultat | PANT-07 |
| S3 | B14 | Inventaire Frigo | badges texte `EXPIRE DEMAIN`, `DANS 2 J`, `dans 9 j` ; tri : peremption la plus proche d'abord | PANT-01 |
| S4 | B15 | Taper un article | feuille basse : lieu, nom, quantite avec -/+ (pas g/ml = 50, kg/L = 0,25, pieces = 1), `A consommer avant` + badge, `Aux courses`, `Utiliser`, `Retirer du garde-manger` ; `Utiliser` diminue la quantite en base (jamais < 0) ; `Retirer` confirme puis supprime | PANT-04 |
| S5 | B16 | `Ajouter un article` (saisie manuelle) : nom, quantite, unite, lieu, date | ligne creee, retour a l'inventaire, article visible dans le bon lieu avec la bonne date (date locale, pas decalee d'un jour) | PANT-02 |
| S6 | P-3 / B16-B17 | `Scanner un code-barres` ; camera virtuelle : code connu (ex. 3017620422003) | formulaire prerempli : nom + quantite + unite + categorie, bandeau `Prerempli depuis le code-barres ... Verifie et complete.`, date de peremption encore `A choisir` | PANT-03 |
| S7 | P-3 / B17 | Code inconnu (ou reseau coupe) | carte `Produit introuvable` + `Saisir a la main` : 1 tap ouvre le formulaire vide | PANT-03 |
| S8 | B18 | Refuser la permission camera (Parametres) puis `Scanner` | carte `L'acces a la camera est desactive`, `Ouvrir les reglages`, `Saisir a la main` | PANT-03 |
| S9 | P-4 / B19 | Onglet Recettes : lire le rappel `Il te reste aujourd'hui` ; objectifs nutrition du compte et 2 repas loges aujourd'hui ; `Generer des recettes · 1 credit` | le rappel = objectifs - repas du jour (kcal + g prot.) ; log serveur : corps `{ date: <date locale>, preferences? }`, prompt contient `Calories : N kcal` = valeur affichee ; chaque proposition affiche `n sur N ingredients` et `Manque : ...` ; solde -1 apres une generation payante (1re generation du jour = quota gratuit) | PANT-05 |
| S10 | P-4 / A15 | Compte sans credits, 2e generation du jour | HTTP 402, carte `Credits epuises`, aucune recette, aucun debit | PANT-05 |
| S11 | P-4 / nuit | Fuseau emulateur UTC-8, 23:30 locale | macros = repas de la date LOCALE (pas de decalage UTC) | PANT-05 |
| S12 | P-5 / B20 | Onglet Courses avec le lait (stock bas, expire demain) et l'article perime | groupe `Il manque dans ton frigo` : chaque ligne avec sa raison (`Stock bas, expire demain`, `Expire`) ; groupe vide absent | PANT-06 |
| S13 | P-5 | `Ajouter un article a la liste` (clavier) | ligne dans `Ajoutes par moi` (necessite la migration) | PANT-06 |
| S14 | P-5 | Cocher 2 lignes puis `Ranger 2 articles dans le garde-manger` | barre d'action avec le bon compte ; apres : lait = ancienne quantite + 1, article perime = quantite d'achat et date effacee, ligne manuelle supprimee de la liste et presente en stock ; message `2 articles ranges` | PANT-06 |
| S15 | B21 / B22 | Compte sans article ; compte sans besoin d'achat | `Ton garde-manger est vide` + deux chemins (scan en tete, a la main) ; `Rien a acheter` | PANT-01, PANT-06 |
| S16 | Charte | Captures vs `lot-B/png/b14..b22` | boutons pleins #CF4509 texte blanc, cartes rayon 16 + ombre, cibles >= 44 dp, `paddingBottom: 100`, aucun emoji | G1-G9 |
| S17 | Recette -> courses | Ouvrir une proposition, `Ajouter a la liste` | les ingredients manquants arrivent dans `Il manque dans ton frigo` avec `Pour : <recette>` ; une fois ranges, ils deviennent des articles (unite normalisee) | PANT-06 |
