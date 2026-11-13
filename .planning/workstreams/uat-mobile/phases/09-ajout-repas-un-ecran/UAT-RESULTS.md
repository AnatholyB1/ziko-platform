# UAT-RESULTS P9 (run2, emulateur ziko-uat-1, branche uat-v1-20, 2026-11-13)
Preuves locales (gitignore): uat-evidence/09/. Methode: lien profond ziko://nutrition/log + uiautomator + SQL lecture.
| Id | Verdict | Detail |
|---|---|---|
| U1 | PARTIEL | Ecran unique OK (liste, panier, ajout sans 2e ecran). Tap sur la tuile Nutrition de l'accueil (texte) n'a PAS ouvert l'ecran (tap au centre du libelle, tuile non cliquable pour uiautomator) : a re-verifier a la main. |
| U2 | PASS partiel | 23:58 -> Collation, `meal-suggestion` "... (23:58)"; 00:06 -> Petit-dej (voir U3). Autres horaires NON-TESTE (horloge). |
| U3 | PASS | Hors creneau 00:06 : chip = dernier repas utilise (Petit-dej). |
| U4 | PASS partiel | `meal-last-method` suit la methode (Chercher/Photo/Code/Manuel). Persistance apres relance non rejouee. |
| U5 | PASS | A froid : `meal-group` "Petit-dej . 190 kcal", recap 190 = tuile Repas accueil "190 kcal". NOTE: re-entree par lien profond sur un ecran deja monte affiche l'etat perime (recap 0) -> artefact du lien, non reproduit a froid. |
| U6 | PASS | "Rien n'a encore ete ajoute aujourd'hui." sans meal-group. |
| U7 | PASS | Panier 2 aliments : "Ajouter 2 aliments", total 310 = 190+120, 2 lignes snack meme date. FAIL mineur: clavier ouvert masque la barre d'action (meme classe que P8 U4, cause probable absence de KeyboardAvoidingView sur `meal-action-bar`, plugins/nutrition/src/screens/LogMealScreen.tsx); visible apres fermeture du clavier. |
| U8 | PASS | 4 segments presents, route inchangee. |
| U9 | PASS | `meal-no-result` + "Saisir a la main" -> Manuel avec nom prerempli ("zzqxw"). 3 skeletons non observes (reponse trop rapide). |
| U10 | PASS | `meal-recent` = Poulet roti / Tajine de poulet. |
| U11 | PASS | `meal-scan-cost` "3 credits IA par analyse" + "La premiere analyse du jour est offerte." |
| U12 | NON-TESTE | scanner camera virtuelle. |
| U13 | PASS | Reseau coupe: alerte "Enregistre hors connexion. Synchronisation des que le reseau revient." ; recap inclut le pending (490) ; apres reseau + relance : ligne `zzqxw` 300 kcal en base. Groupe "En attente de synchronisation" non confirme visuellement (hors ecran). |
| U14 | PASS partiel | Bouton plein orange fonce (#CF4509 visuel), cartes arrondies + ombre, focus champ bord primaire. Mesures dp non prises. |
| U15 | NON-TESTE | Photo reelle (1 appel reel max, non declenche). |
Observation: ecran monte avant minuit garde la date de montage (`today` memoise, LogMealScreen.tsx:87) -> lignes datees de la veille a 00:01.

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| U1 1 tap + <= 4 taps | PASS | tuile Repas -> ecran unique (1 tap); champ recherche, `poulet`, resultat, `Ajouter 1 aliment` = 4 taps au total; retour accueil; base : `Poulet rôti` snack 190 kcal; recap `490 -> 680 / 2000 kcal` |
| U12 code-barres introuvable | BLOQUE | camera virtuelle de l'emulateur : le segment Code n'offre que `Alignez le code-barres pour scanner` (pas de saisie manuelle), aucun code injectable ; permission camera ok (p9-barcode.png) |
| U15 photo | NON-TESTE | route vision = faux Anthropic (sortie structuree a scripter) ; budget |
