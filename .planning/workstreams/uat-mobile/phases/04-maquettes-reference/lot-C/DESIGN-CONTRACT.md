# Contrat de design, lot C : Stretching, Compléments alimentaires, Timer (presets), Sommeil

Phases consommatrices : 18 (Stretching), 19 (Compléments), 20 (Timer), 17 (Sommeil ; accueil via 8). Maquettes : `gallery.html` > lot C ; PNG `lot-C/png/cNN-*.png` (hors git) ; sources `lot-C/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (G1 à G9) + les deux ajouts ci-dessous. Les noms, marques, marchands, prix et chiffres sont des **placeholders cohérents** : aucune photo (un visuel produit manquant = tuile `Visuel` en pointillés), aucune marque réelle.

## 0. Écart au socle : primaire d'action conforme (valide pour les lots C et D)
Le blanc sur `#FF5C1A` = 3,09:1 (échec AA). Les lots C/D sont rendus avec `--primary: #CF4509` (blanc dessus **4,66:1**, sur fond `#F7F6F3` **4,31:1** pour l'icône/barre, au-dessus de 3:1). Écart de teinte avec la marque : faible (même famille, 12 % plus sombre). `--primary-press: #B53D05`. Texte orange sur clair reste `#B53D05` (5,3:1). Décision dans `CRITIQUE.md` Q1 ; le reste du produit (lots A/B) peut adopter la même valeur en une ligne de token. Vérification : `node shared/contrast.mjs`.
Ajouts de composants au socle : interrupteur `sw` 52x32 dans une zone tactile 52x44 (`swh`) ; case `cb` 28 dp dans une ligne >= 56 dp ; stepper `stp` (boutons 44x44).

## 1. Décisions prises dans les maquettes
- **Onglets inscrits** : la barre d'onglets du module a une marge latérale de 16 dp et un indicateur inset de 12 dp (retour UAT "barres d'onglets sans marge", Stretching et Sommeil).
- **Stretching** : onglets Bibliothèque / Routines / Suivi. Filtre par zone en puces, `Mes exercices` est une puce comme les autres (pas un 4e onglet). Les exercices créés portent le badge `PERSO`. Aucune image ni vidéo (hors périmètre) : tuile icône. Création : nom, zone, mesure (durée ou répétitions), côtés, consigne facultative. Une routine = nom + exercices ordonnés (poignée de tri, corbeille) + interrupteur `Routine par défaut` ; **une seule** routine par défaut (badge `PAR DÉFAUT`, bordure primaire). La routine par défaut apparaît en carte **en tête de séance** (`Ajoutée en début de séance`, boutons `Passer` / `Modifier`) ; **sans routine par défaut, aucune carte** (C09). Suivi : séances de la semaine, minutes cumulées, série (jours), dernière séance, calendrier du mois (jour avec séance = fond teinté + chiffre en gras ; aujourd'hui = contour noir). Zéros honnêtes à vide (C07).
- **Compléments** (4 onglets, ordre imposé) : Aujourd'hui / Mon stack / Catalogue / Rappels. Aujourd'hui = prises du jour groupées Matin / Midi / Soir, cochables, progression `3 sur 5 pris`. Mon stack ne contient que les produits choisis : dose + moment en texte orange `#B53D05`, crayon pour modifier. Catalogue : recherche live + deux filtres (Marque, Catégorie) en feuille multi-choix, compteur de résultats, bouton `Afficher N produits`. **Prix** : `dès 14,90 €` ou `Prix indisponible` (jamais `NaN€`, jamais `0 €` pour "inconnu"). Comparateur : offres triées par prix, badge `MEILLEUR PRIX`, prix par jour, lien `Voir l'offre` (ouvre le navigateur), offre sans prix = `Prix non communiqué` non cliquable, mention de date de relevé. Ajout au stack : dose (stepper) + **un ou plusieurs moments**.
- **Rappels (D-04a tranchée)** : 3 créneaux Matin / Midi / Soir, un interrupteur et **une heure par créneau** (défauts 08:00, 13:00, 21:30). Un seul rappel par créneau, qui liste les produits ; un créneau sans produit n'envoie rien ; désactivé = texte `Rappel désactivé`.
- **Timer** : 3 onglets Séance / Tabata / Intervalle, chacun une liste `Mes presets` (aucun preset d'exemple : **état vide** C21). Ligne = nom + résumé chiffré ; menu `...` (feuille) = Modifier, Dupliquer, Supprimer avec confirmation écrite. Éditeur : nom, échauffement, effort, repos, séries par round, rounds, repos entre rounds (steppers 44 dp) et **durée totale calculée** en direct (échauffement + rounds x séries x (effort + repos) + repos entre rounds). Séance : l'éditeur n'expose que repos + séries (les champs non pertinents sont absents, pas désactivés).
- **Sommeil** : jamais de valeur par défaut. État vide = `Aucune nuit enregistrée` + `Logger ma nuit` + `Connecter une source`. Saisie : nuit (date), coucher, lever (steppers de 15 min), **durée calculée**, qualité 1 à 5 (5 puces 48 dp, 1 = très mauvaise), réveils. Validation : durée > 16 h = message sous le champ, bouton désactivé, rien d'effacé. Affichage : badge de source (`SAISIE MANUELLE` / `SANTÉ CONNECTÉE`) ; **phases uniquement si une source les fournit** ; source connectée prime, la saisie manuelle de la même nuit est conservée mais masquée (bandeau explicatif). Graphe 7 nuits : un jour sans nuit = **barre absente**, pas de zéro. Réglages : cible (stepper), rappel du coucher (interrupteur + heure), réveil intelligent (interrupteur, fenêtre 30 min), source (segment Saisie manuelle / Santé), routine pré-sommeil (cases). Accueil : même chiffre (`7 h 45 · qualité 4 / 5`) ou `Aucune nuit enregistrée` + `Logger`.

## 2. Écrans et états
| Id | Écran / état |
|---|---|
| C01 / C02 | Bibliothèque avec contenu / filtre `Mes exercices` vide |
| C03 | Créer un exercice |
| C04 / C05 | Routines (liste, défaut marqué) / édition de routine |
| C06 / C07 | Suivi avec données / à vide |
| C08 / C09 | Démarrage de séance avec / sans routine par défaut |
| C10 / C11 / C12 | Compléments : Aujourd'hui / Mon stack / stack vide |
| C13 / C14 / C18 | Catalogue / feuille filtres / aucun résultat |
| C15 / C16 | Détail + comparateur / ajout au stack |
| C17 | Rappels par créneau |
| C19 / C20 / C21 | Timer : Séance / Tabata / Intervalle vide |
| C22 / C23 | Éditeur de preset / menu + confirmation de suppression |
| C24 / C25 / C26 | Sommeil : vide / saisie / saisie incohérente |
| C27 / C28 | Sommeil : saisie manuelle (sans phases) / source connectée (phases) |
| C29 / C30 | Réglages du sommeil / carte d'accueil cohérente (ou vide) |
Motifs non redessinés : chargement = squelettes `#ECEAE4` (A04) ; erreur réseau = carte d'erreur de B05 (message + `Réessayer`, jamais de donnée de secours) ; création en cours = bouton désactivé + libellé `Enregistrement…`.

## 3. Microcopy FR
Stretching : `Créer un exercice`, `Aucun exercice à toi`, `PERSO`, `Routine par défaut`, `Ajoutée en début de séance`, `Passer`, `Aucune séance pour l'instant`, `Lancer une routine`. Compléments : `3 sur 5 pris`, `Ton stack est vide`, `Parcourir le catalogue`, `dès 14,90 €`, `Prix indisponible`, `Prix non communiqué`, `Meilleur prix`, `Voir l'offre`, `Afficher 38 produits`, `Ajouter à mon stack`, `Rappel désactivé`. Timer : `Mes presets`, `Nouveau preset`, `Aucun preset d'intervalle`, `Repos entre rounds`, `Durée totale : 54 min`, `Supprimer ce preset ? Cette action est définitive.` Sommeil : `Logger ma nuit`, `Aucune nuit enregistrée`, `Connecter une source`, `Cette nuit dure 17 h 30. Vérifie le coucher et le lever (maximum 16 h).`, `La source prime : ta saisie manuelle de cette nuit (7 h 45) est conservée mais n'est plus affichée.`

## 4. Mouvement et accessibilité (spécifique)
Cocher une prise : case 150 ms (fond vert, coche), barre de progression +1 sans animation d'entrée si reduced-motion. Interrupteur : bascule 150 ms (`transform`), `accessibilityRole="switch"` + `accessibilityState.checked`. Stepper : appui long = répétition accélérée ; chaque valeur est un `adjustable` (`accessibilityValue`). Réordonner (C05) : poignée `reorder-two`, alternative accessible = actions `Monter` / `Descendre` annoncées. Calendrier : chaque jour a `accessibilityLabel="12 novembre, séance réalisée"` ; l'état n'est pas porté par la couleur seule (gras + fond). Phases du sommeil : barre décorative + **liste chiffrée** équivalente (profond/léger/REM/éveillé avec durées). Graphe 7 nuits : `accessibilityLabel` récapitulatif ("Moyenne 7 h 20, cible 8 h"). Filtres : `accessibilityLabel="Filtrer par marque, 2 sélectionnées"`. Lien externe (C15) annoncé `ouvre le navigateur`. Icônes seules étiquetées : `Rechercher`, `Réglages du sommeil`, `Modifier`, `Supprimer`, `Plus`, `Moins`.
**Exceptions G2 (12 sp)** : surtitres, badges, libellés de barre d'onglets, initiales de jours du calendrier et du graphe 7 nuits (axes).

## 5. Critères d'acceptation mesurables (émulateur, captures)
| Id | Critère | Mesure |
|---|---|---|
| ST-1 | Bibliothèque : le nombre de lignes = compteur de la puce `Tous` ; filtrer une zone réduit la liste sans relancer | comptage |
| ST-2 | Création d'un exercice : il apparaît avec `PERSO` en < 1 s et reste après relance de l'app | scénario UAT + base |
| ST-3 | Routine : 2e routine marquée par défaut retire le badge de la 1re (exactement 1 `PAR DÉFAUT`) | arbre d'accessibilité |
| ST-4 | Démarrer une séance avec routine par défaut : carte en 1re position avant le 1er exercice ; `Passer` la retire en 1 tap ; sans routine par défaut : 0 carte | 3 captures |
| ST-5 | Suivi : séances de la semaine, minutes, série, dernière séance = valeurs recalculées depuis la table (écart 0) ; jours marqués = jours des séances | requête base |
| ST-6 | Barre d'onglets : marge latérale >= 16 dp, aucun libellé coupé à 130 % | capture + dynamic type |
| SU-1 | Exactement 4 onglets dans l'ordre Aujourd'hui, Mon stack, Catalogue, Rappels | arbre d'accessibilité |
| SU-2 | Catalogue : 0 occurrence de `NaN` ou `undefined` sur 100 produits défilés ; produit sans prix = `Prix indisponible` | script de défilement + recherche texte |
| SU-3 | Filtres Marque/Catégorie : le compteur du bouton = nombre de lignes obtenues | comparaison |
| SU-4 | Comparateur accessible depuis tout produit ; chaque offre à prix a un lien qui ouvre le navigateur ; prix triés croissants | scénario |
| SU-5 | Ajouter au stack avec dose + 2 moments : le produit apparaît dans Mon stack et dans Aujourd'hui aux 2 créneaux ; Mon stack = uniquement les produits ajoutés (0 préchargé sur compte neuf) | base |
| SU-6 | Rappels : changer une heure reprogramme la notification locale à cette heure (+-1 min) ; créneau vide = 0 notification | liste des notifications planifiées |
| TI-1 | 3 onglets Séance, Tabata, Intervalle ; chacun permet créer, modifier, supprimer (confirmation avant suppression) | scénario x3 |
| TI-2 | Compte neuf : 0 preset (le preset `Exemple` n'existe plus) et état vide visible | capture |
| TI-3 | Intervalle : les 6 champs nom/échauffement/effort/repos/séries/rounds + repos entre rounds sont modifiables ; la durée totale affichée = formule du contrat (écart 0 s) | calcul |
| SL-1 | Compte sans nuit : état vide, **aucune** chaîne `8h00`, `8 h 00` ni score | recherche texte |
| SL-2 | Saisir une nuit : elle s'affiche dans Sommeil et sur l'accueil avec la même durée et la même qualité | 2 captures + base |
| SL-3 | Sans source connectée : 0 mention de profond/léger/REM hors du bandeau d'information | recherche texte |
| SL-4 | Avec source connectée : phases visibles ; la durée affichée est celle de la source, pas de la saisie | jeu de données de test |
| SL-5 | Chaque réglage (cible, rappel, source, réveil intelligent, routine) persiste après relance | scénario |
| SL-6 | Durée > 16 h : bouton `Enregistrer` désactivé + message ; champs conservés | saisie 19:00 / 12:30 |
Plus G1 à G9.

## 6. Exigence -> écran -> vérification
| Exigence | Écran(s) | Check |
|---|---|---|
| STRE-01 bibliothèque | C01, C02 | ST-1 |
| STRE-02 exercices perso | C03, C01 (`PERSO`) | ST-2 |
| STRE-03 routines voir/créer/modifier | C04, C05 | ST-3 |
| STRE-04 suivi | C06, C07 | ST-5 |
| STRE-05 routine par défaut | C04, C05 | ST-3 |
| STRE-06 ajout auto en séance | C08, C09 | ST-4 |
| SUPP-01 4 onglets | C10, C11, C13, C17 | SU-1 |
| SUPP-02 recherche + filtres | C13, C14, C18 | SU-3 |
| SUPP-03 comparateur accessible | C15 | SU-4 |
| SUPP-04 ajout dose + moment | C16 | SU-5 |
| SUPP-05 stack = choix, éditable | C11, C12 | SU-5 |
| SUPP-06 plus de NaN€ | C13, C15 | SU-2 |
| SUPP-07 rappels par moment | C17 | SU-6 |
| TIMR-01 CRUD presets x3 | C19, C20, C21, C23 | TI-1 |
| TIMR-02 champs du preset | C22 | TI-3 |
| TIMR-03 preset Exemple retiré | C21 | TI-2 |
| SLP-01 saisie manuelle | C25, C26 | SL-2, SL-6 |
| SLP-02 état vide | C24 | SL-1 |
| SLP-03 phases conditionnelles | C27, C28 | SL-3, SL-4 |
| SLP-04 source prime | C28 | SL-4 |
| SLP-05 réglages éditables | C29 | SL-5 |
| SLP-06 accueil cohérent | C30, C27 | SL-2 |
