# Contrat de design, lot B : Récompenses (Succès / Boutique) et Garde-manger (Pantry)

Phases consommatrices : 12 (Récompenses), 13/14 (Quêtes), 10 (Pantry). Maquettes : `gallery.html` > lot B ; PNG `lot-B/png/bNN-*.png` ; sources `lot-B/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (G1 à G9). Les données (noms, soldes, dates) sont des placeholders cohérents avec le lot A (42 séances, 6 records, série de 5 jours).

## 1. Décisions prises dans les maquettes
- **Récompenses** : en-tête fixe commun aux 4 onglets (Niveau, Succès, Boutique, Quêtes) avec le **solde de pièces en permanence** (puce or, 44 dp) et l'historique (icône horloge). Onglets soulignés primaire.
- **Succès** : liste en deux groupes, "À débloquer" (triés par proximité, barre de progression + `n / N`) puis "Débloqués" (icône or + date). Les 11 succès réels = séries (7, 30, 100 jours), séances (1, 10, 50, 100), records (1, 10), profil complet, premier ami. Icônes Ionicons propres : barbell, fitness, flame, trophy, flash, star, ribbon, medal, diamond, checkmark-circle, people. Fiche (feuille basse) : nom, condition, progression, date de déblocage (absente si verrouillé), récompense en pièces.
- **Boutique** (question D-04c tranchée) : segment `Boutique | Mes objets`, 4 catégories en puces (Titres, Badges, Thèmes, Bannières) avec compteur, **sans limite de 8** (liste défilante, pagination côté app). Un objet a 4 états visibles par mot : prix, `Aperçu`, `Possédé`, `Niveau 10` (verrou), "Il manque 460 pièces". **Aperçu avant achat** en feuille : le thème est montré appliqué, le titre sur le profil ; achat en un tap, confirmation par toast (pas de modale).
- **Mes objets** : un seul objet équipé par catégorie (`ÉQUIPÉ` / bouton `Équiper`) ; note explicative.
- **Quêtes** : quêtes du jour et de la semaine avec progression mesurée ; états vides honnêtes ; aucune liste factice (REWD-10 vaut aussi pour les quêtes).
- **Garde-manger** (PANT-07) : le module s'appelle `Garde-manger` ; onglets `Inventaire`, `Recettes`, `Courses` (plus aucun mot anglais). Lieux : Frigo, Congélateur, Placard (puces avec compteur) ; toucher une puce filtre la liste, toucher un article ouvre sa fiche. Péremption par badge texte (`EXPIRE DEMAIN`, `DANS 2 J`, `dans 9 j`).
- **Scan** : le code-barres préremplit le formulaire (bandeau info + champs modifiables) ; la date de péremption reste à choisir.
- **Recettes IA** : le haut de l'écran rappelle les macros restantes du jour (source des recettes) ; le coût (1 crédit) est dans le bouton ; chaque proposition dit combien d'ingrédients sont disponibles et ce qui manque.
- **Courses** : deux groupes, "Il manque dans ton frigo" (auto, avec la raison) et "Ajoutés par moi" ; cocher = prêt à ranger ; barre d'action `Ranger N article(s) dans le garde-manger`.

## 2. Écrans et états
| Id | Écran / état |
|---|---|
| B01 | Niveau (niveau, XP, série, succès, derniers gains) |
| B02 / B02b | Succès, haut de liste / liste défilée (11 au total : 7 à débloquer, 4 débloqués) |
| B03 / B04 | Fiche succès débloqué / verrouillé |
| B05 | Succès en erreur, sans liste de secours |
| B06 | Boutique, thèmes (possédé, verrouillé niveau, solde insuffisant) |
| B07 / B08 | Aperçu avec solde insuffisant / suffisant |
| B09 | Mes objets, titres |
| B10 / B11 | Historique des gains / vide |
| B12 / B13 | Quêtes / vide |
| B14 | Inventaire, Frigo |
| B15 | Fiche article |
| B16 | Ajout prérempli après scan |
| B17 / B18 | Scan code-barres / caméra refusée |
| B19 | Recettes IA |
| B20 / B22 | Courses / vide |
| B21 | Garde-manger vide |
Motifs non redessinés : chargement = squelettes `#ECEAE4` (comme A04) ; erreur réseau = carte d'erreur de B05 ; génération de recettes en cours/échec/crédits épuisés = motifs A13 à A15 ; "Aucun résultat" de recherche = carte vide.

## 3. Microcopy FR
Succès : `4 sur 11 débloqués`, `À débloquer`, `Débloqué le 3 sept.`, `Encore 2 jours d'entraînement ou de check-in.`, `Succès indisponibles`. Boutique : `Aperçu`, `Possédé`, `Équiper`, `ÉQUIPÉ`, `Acheter pour 300 pièces`, `Pièces insuffisantes`, `Il te manque 160 pièces. Gagne-en en t'entraînant.`, `Un seul titre est affiché à la fois. Les autres restent à toi.` Toast : `Machine acheté. Équipe-le dans Mes objets.` Historique : `Aucun gain pour l'instant`, `Achat : Machine`, `Succès : Premier record`. Quêtes : `Se renouvelle dans 6 h`, `Pas de quête active`. Garde-manger : `Ton garde-manger est vide`, `Aux courses`, `Utiliser`, `Retirer du garde-manger`, `Prérempli depuis le code-barres. Vérifie et complète.`, `L'accès à la caméra est désactivé`, `Générer des recettes · 1 crédit`, `Il te reste aujourd'hui`, `Rien à acheter`.

## 4. Mouvement et accessibilité (spécifique)
Déblocage d'un succès : toast + l'icône passe de gris à or en 250 ms (fondu, pas de confetti ; reduced-motion = changement instantané). Achat : le solde se met à jour par fondu du chiffre (150 ms), `accessibilityLiveRegion` annonce "Solde : 40 pièces". Équiper : la pastille ÉQUIPÉ change de ligne sans animation de layout. Cocher une course : case 150 ms, libellé barré. Étiquettes d'icônes seules : historique ("Historique des gains"), recherche ("Rechercher dans le garde-manger"), plus/moins ("Augmenter la quantité"), fermer. Chaque barre : `progressbar` avec `now/max` (ex. 5 sur 7).

## 5. Critères d'acceptation mesurables (émulateur, captures)
| Id | Critère | Mesure |
|---|---|---|
| R-1 | 4 onglets exactement : Niveau, Succès, Boutique, Quêtes, dans cet ordre ; puce de solde présente sur chacun | arbre d'accessibilité |
| R-2 | Succès affiche 11 lignes (7 + 4) dont 11 icônes distinctes, chacune avec condition ou date, et `n / N` sur les non débloqués | compter les lignes en défilant |
| R-3 | Un succès débloqué par action réelle (ex. 1re séance terminée) passe de la section "À débloquer" à "Débloqués" sans relance de l'app, avec une date réelle | scénario UAT + base |
| R-4 | Fiche succès : date présente si débloqué, absente si verrouillé | 2 captures |
| R-5 | Boutique : une catégorie contenant > 8 objets en affiche plus de 8 (défilement) ; compteur de puce = nombre réel | seed de test avec 12 objets |
| R-6 | Aperçu avant achat disponible pour tout objet non possédé ; bouton d'achat désactivé et texte "Il te manque N pièces" si solde < prix | solde manipulé |
| R-7 | Après achat : solde = ancien solde - prix (lu dans la puce) ; l'objet apparaît dans Mes objets | avant/après |
| R-8 | Mes objets : exactement 1 `ÉQUIPÉ` par catégorie ; équiper B retire ÉQUIPÉ de A dans la même capture | arbre d'accessibilité |
| R-9 | Historique : les 5 derniers gains correspondent aux lignes de la table de gains (montant, libellé, ordre antéchronologique) | requête base |
| R-10 | Aucune liste de secours : réseau coupé sur Succès/Quêtes = carte d'erreur B05, 0 élément fictif | mode avion |
| P-1 | Toucher Frigo / Congélateur / Placard filtre la liste (aucune alerte système) ; compteurs = nombres réels | script UAT |
| P-2 | Les 3 onglets sont nommés Inventaire, Recettes, Courses ; 0 mot anglais visible dans le module | capture + recherche de "Pantry|Shopping" |
| P-3 | Scan d'un code-barres connu : au moins nom et quantité préremplis ; code inconnu : message + saisie manuelle en 1 tap | caméra virtuelle |
| P-4 | Recettes IA : la requête contient les macros restantes (kcal, g prot.) ; l'écran les affiche ; 1 crédit débité par génération | log serveur + solde |
| P-5 | Courses : tout article sous seuil ou expiré apparaît dans "Il manque" avec sa raison ; un ajout manuel va dans "Ajoutés par moi" ; ranger vide la coche vers l'inventaire | scénario UAT |
Plus G1 à G9.

## 6. Exigence -> écran -> vérification
| Exigence | Écran(s) | Check |
|---|---|---|
| REWD-01 4 onglets | B01, B02, B06, B12 | R-1 |
| REWD-02 11 succès (icône, condition, progression) | B02, B02b | R-2 |
| REWD-03 fiche d'un succès | B03, B04 | R-4 |
| REWD-04 attribution automatique | B02 vers B02b (changement de section) | R-3 |
| REWD-05 catégories complètes, sans limite de 8 | B06 | R-5 |
| REWD-06 Mes objets, équipement | B09 | R-8 |
| REWD-07 solde permanent | tous les écrans Récompenses | R-1 |
| REWD-08 historique | B10, B11 | R-9 |
| REWD-09 aperçu avant achat | B07, B08 | R-6, R-7 |
| REWD-10 plus de liste factice | B05, B13 | R-10 |
| PANT-01 toucher Frigo ouvre la liste | B14 | P-1 |
| PANT-02 ajout manuel | B16, B21 | P-3 |
| PANT-03 scan prérempli | B16, B17, B18 | P-3 |
| PANT-04 détail de chaque onglet | B14, B15, B19, B20 | P-1 |
| PANT-05 recettes avec macros restantes | B19 | P-4 |
| PANT-06 courses dynamiques + manuel | B20, B22 | P-5 |
| PANT-07 libellés français | B14, B19, B20 | P-2 |
