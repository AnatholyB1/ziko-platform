# Contrat de design, lot A : programmes, atelier IA, ajout de repas

Phases consommatrices : 7 (liste), 23 (atelier), 9 (repas), 6/8 (entrees). Maquettes : `gallery.html` > lot A ; PNG `lot-A/png/aNN-*.png` ; sources `lot-A/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (tokens G1-G9 applicables a chaque ecran). Donnees d'exemple (noms, chiffres) = placeholders, jamais de photo.

## 1. Decisions prises dans les maquettes
- **L'actif d'abord** : une carte hero bordee primaire + badge `ACTIF` + progression, puis "Autres programmes" en liste groupee (pas de grille de cartes identiques).
- **Regle de conflit visible** en permanence (bandeau info A01) et rappelee avant confirmation quand le programme actif vient du coach (A08, A09). Activer = l'actuel passe en pause, progression conservee.
- **Menu** (A06/A07) : feuille basse. Inactif : `Definir comme programme actif` (primaire) puis Dupliquer puis Supprimer (danger, separe). Actif : pas d'Activer ; Dupliquer, Renommer, Supprimer. Titre sur 2 lignes max (ellipse).
- **Creation** (A02) : deux chemins, assistant 4 etapes (gratuit) et Atelier IA (credits annonces).
- **Atelier** : pas de bulles pour l'IA (texte libre, avatar sparkles), bulle sombre pour l'utilisateur ; les outils (recherche web, skill) sont des puces visibles ; le brouillon est une carte editable en direct (crayon par seance) ; chips de demandes rapides ; solde de credits dans la barre ; cout "1 credit par message" sous la saisie.
- **Repas** : un ecran. Recap kcal/macros en haut, repas préselectionné selon l'heure (coche verte = deja logue), 4 methodes en segment (Chercher, Photo, Code, Manuel) avec "derniere methode utilisee" memorisee, "Deja ajoute aujourd'hui" visible (A17), barre d'action collante avec total.

## 2. Ecrans et etats
| Id | Ecran / etat | Notes |
|---|---|---|
| A01 | Liste, avec contenu (4 programmes) | filtres Tous/IA/Coach/Crees (44 dp) ; menu par ligne |
| A02 | Feuille Creer | scrim `rgba(28,26,23,.45)` |
| A03 | Liste vide | 2 CTA, aucune donnee factice |
| A04 | Chargement | squelettes `#ECEAE4` |
| A05 | Erreur reseau | message + Reessayer, pas de programme de secours |
| A06 / A07 | Menu actif / inactif | |
| A08 | Conflit IA/coach | regle ecrite, deux boutons explicites |
| A09 | Fin d'assistant | seance accessible (liste), `Definir comme programme actif` / `Plus tard`, rappel du programme remplace |
| A10 | Atelier, conversation | brouillon editable, outils visibles |
| A11 | Atelier, etat initial | suggestions + "Ce que l'IA sait de toi" (contexte reel : nb seances/programmes/records) |
| A12 | Edition d'un exercice | steppers 44 dp : series, reps, % du max, repos ; `Demander a l'IA` |
| A13 | L'IA travaille | outil en cours, flux avec curseur, bouton Arreter |
| A14 | Echec reseau | message conserve, Reessayer, aucun credit debite |
| A15 | Credits epuises | saisie desactivee, edition manuelle possible, `Obtenir des credits` |
| A16 | Repas, avec contenu | recherche "poulet", 1 element selectionne, total 640 kcal |
| A17 | Repas deja logues | liste du jour + recents/favoris |
| A18 | Premier repas du jour | recap a zero, etat vide guide |
| A19 | Methode Photo | cadre camera, `1 credit IA par analyse` |
| A20 | Methode Manuel | 5 champs ; focus bord 2 dp primaire |
| A21 | Code-barres introuvable | issue vers saisie manuelle ; hors-ligne rassurant |
Etats transverses non redessines (meme motif) : chargement de resultats de recherche = 3 lignes squelette comme A04 ; "Aucun resultat" = carte vide de A18 avec texte "Aucun aliment pour 'xxx'. Saisis-le a la main." + bouton Manuel ; suppression d'un programme = confirmation `showAlert` ("Supprimer 'xxx' ? Cette action est definitive.") ; succes d'activation = toast `Programme actif : Hypertrophie PPL`.

## 3. Microcopy FR (a reprendre mot pour mot)
Titres : `Programmes`, `Atelier IA`, `Ajouter un repas`. Boutons : `Nouveau`, `Definir comme programme actif`, `Plus tard`, `Dupliquer`, `Renommer`, `Supprimer`, `Reessayer`, `Garder le programme du coach`, `Demander a l'IA`, `Enregistrer`, `Obtenir des credits`, `Saisir a la main`, `Ajouter N aliments`. Regle : "Un seul programme est actif a la fois. En activer un autre met l'actuel en pause." Atelier : "Decris ton objectif", "1 credit par message", "Ton message est conserve et aucun credit n'a ete retire.", "Plus de credits IA. Tu en gagnes en t'entrainant, ou tu peux en obtenir." Repas : "Dejeuner suggere d'apres l'heure (12:40). Tu peux changer.", "Derniere methode utilisee : Chercher", "Rien n'a encore ete ajoute aujourd'hui." (accents a restituer dans l'app ; les maquettes les portent.)

## 4. Mouvement et accessibilite (specifique)
Feuilles : socle §2. Brouillon de l'atelier : une carte qui apparait (fondu+Y 8 dp, 200 ms) puis se met a jour sans re-animation. Flux IA : texte ajoute par blocs, `accessibilityLiveRegion="polite"`. Bouton Arreter = `accessibilityLabel "Arreter la reponse"`. Icones seules : fermer, retour, crayon ("Modifier la seance Lundi"), plus/moins ("Augmenter les series"), envoyer ("Envoyer"), menu ("Options du programme X").

## 5. Criteres d'acceptation mesurables (emulateur, captures)
| Id | Critere | Mesure |
|---|---|---|
| A-1 | La liste affiche TOUS les programmes (IA, coach, crees) et exactement 0 ou 1 badge `ACTIF` | compter les badges dans l'arbre d'accessibilite |
| A-2 | Activer un programme B alors que A est actif : A perd `ACTIF` dans la meme capture que B le gagne ; le cas coach affiche le texte de regle (A08) avant activation | 2 captures + lecture texte |
| A-3 | Menu d'un actif : 0 entree `Activer`/`Definir comme programme actif` ; menu d'un inactif : cette entree est la 1ere, hauteur 48 dp | arbre d'accessibilite |
| A-4 | Titre du menu <= 2 lignes, jamais tronque a 1 mot | capture avec un titre de 60 caracteres |
| A-5 | Fin d'assistant : la premiere seance est ouvrable en 1 tap et `Definir comme programme actif` est visible sans scroll | capture 390x844 |
| A-6 | Atelier : un tour "recherche web" affiche la puce outil avant le texte ; un edit manuel (A12) ne consomme aucun credit (solde identique avant/apres) | solde lu dans la barre |
| A-7 | Atelier : echec reseau -> message conserve, solde inchange ; solde 0 -> champ desactive et bouton `Obtenir des credits` visible | simuler reseau coupe / solde 0 |
| M-1 | Un tap depuis la tuile Repas ouvre l'ecran unique (pas de 2e ecran avant l'ajout) ; nombre de taps pour ajouter un aliment recherche <= 4 (ouvrir, taper le nom, choisir, ajouter) | compter les taps du script |
| M-2 | Repas préselectionné = creneau horaire (05-10 petit-dej, 11-14 dejeuner, 15-17 collation, 18-22 diner) ; derniere methode rappelee a la reouverture | horloge emulateur change + relance |
| M-3 | Les repas du jour sont visibles sans quitter l'ecran (A17) ; recap kcal = somme des repas | comparer aux donnees |
| M-4 | Les 4 methodes sont atteignables depuis le segment sans navigation (meme ecran) | arbre d'accessibilite |
| M-5 | Hors-ligne : la saisie manuelle reste utilisable (A21) | mode avion |
Plus G1 a G9 (socle).

## 6. Exigence -> ecran -> verification
| Exigence | Ecran(s) | Check |
|---|---|---|
| TRAIN-06 liste de tous les programmes | A01, A03-A05 | A-1 |
| TRAIN-07 actif unique, conflit IA/coach | A01 (bandeau), A08 | A-2 |
| TRAIN-08 menu masque Activer, hierarchie, titre lisible | A06, A07 | A-3, A-4 |
| TRAIN-09 apres l'assistant : `Definir comme programme actif`, seance accessible | A09 | A-5 |
| ATEL-01 creation par conversation en plus de l'assistant | A02, A10, A11 | A-6 |
| ATEL-02 recherche web ; ATEL-03 skills | A10 (puces outils) | A-6 |
| ATEL-04 contexte complet | A11 (contexte), A10 (bandeau) | lecture bandeau = donnees reelles |
| ATEL-05 edition live / demander a l'IA | A10, A12 | A-6 |
| ATEL-06 programme tres precis (powerlifter) | A10 (S1-S8, % du max, repos) | scenario powerlifter du UAT |
| ATEL-10 credits | A10, A13-A15 | A-7 |
| NUTR-01 un seul tap vers l'ecran | A16 | M-1 |
| NUTR-02 repas préselectionné + methode memorisee | A16, A18 | M-2 |
| NUTR-03 repas du jour visibles | A16, A17 | M-3 |
| NUTR-04 recherche/scan/code-barres/manuel sans changer d'ecran | A16, A19-A21 | M-4, M-5 |
