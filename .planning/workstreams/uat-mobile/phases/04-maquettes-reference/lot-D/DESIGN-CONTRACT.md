# Contrat de design, lot D : Amis et profil public

Phase consommatrice : 21 (Social et Amis ; dépend de 2 pour la cause de l'échec d'ajout, de 12 pour badges/niveau en lecture seule). Maquettes : `gallery.html` > lot D ; PNG `lot-D/png/dNN-*.png` (hors git) ; sources `lot-D/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (G1 à G9) et l'écart de primaire d'action du lot C (§0 de `../lot-C/DESIGN-CONTRACT.md` : `--primary #CF4509`). Personnes, pseudos et chiffres : **placeholders**, avatars = initiales sur fond neutre, jamais de photo.

## 1. Décisions prises dans les maquettes
- **Recherche en haut, en direct (SOC-05)** : le champ est la première ligne sous la barre de titre, présent sur Amis et En attente ; il filtre à chaque frappe (debounce 250 ms, 2 caractères minimum), **aucun bouton `Rechercher`**, croix pour effacer, compteur `N résultats`. Le bouton `person-add` de la barre ouvre le partage du lien (D07), pas une autre recherche.
- **Un seul bouton d'état (D-04d et SOC-04 tranchée)** : `Suivre` et `ami` fusionnent. Le même emplacement (ligne de résultat et profil) affiche exactement un de quatre états : `Ajouter` (primaire) ; `Envoyée` en liste / `Demande envoyée` sur le profil (neutre, horloge) ; `Accepter` (+ `Refuser` sur le profil et dans En attente) ; `Ami` (vert, coche). Le mot et l'icône portent l'état, pas la couleur seule. Les abonnés ne sont plus un statut distinct : le compteur `abonnés` reste en lecture.
- **En attente (SOC-02, 03)** : deux sections toujours visibles, `Reçues` (Accepter primaire + Refuser, par ligne) et `Envoyées` (Annuler). Le badge de l'onglet compte les **reçues** (l'action attendue). Une demande envoyée apparaît dans Envoyées immédiatement (mise à jour optimiste) et un toast dit `Demande envoyée à Marco Delmas` : texte propre, sans échappement (SOC-08). En cas d'échec : la ligne revient à `Ajouter`, bandeau d'erreur précis + `Réessayer`, aucun état faux (D04).
- **Profil public (SOC-06, 07)** : bannière neutre `#F0EFE9` de 112 dp (pas de fausse photo), bouton retour **dans** la bannière, avatar 88 dp qui chevauche la bannière de 44 dp **sans être rogné** (la bannière ne coupe jamais l'avatar : `overflow` visible, avatar au-dessus), bouton d'état aligné à droite de l'avatar, sous la bannière, hors zone de recouvrement. Ordre : nom, pseudo + objectif **en français** (`prise de muscle`, `perte de poids`, `endurance`, `santé et bien-être`, jamais de slug `muscle_gain`), amis / abonnés, niveau + XP (barre + `580 XP avant le niveau 15`), série, badges (4 + `Voir les 6`), derniers entraînements (3), records (3), défis en commun (2 max + état vide), `Retirer des amis` en pied (danger, confirmation).
- **Profil inconnu / demande envoyée / demande reçue** : mêmes données publiques ; seul l'emplacement du bouton change ; `Annuler la demande` en lien sous le nom ; `Manon veut devenir ton amie` + Accepter / Refuser pour une demande reçue.

## 2. Écrans et états
| Id | Écran / état |
|---|---|
| D01 | Amis, liste (recherche en haut) |
| D02 | Recherche en direct : résultats aux 4 états + toast |
| D03 | Recherche sans résultat |
| D04 | Échec de l'envoi |
| D05 / D06 | En attente avec contenu / vide |
| D07 | Aucun ami |
| D08 / D09 / D10 | Profil d'un ami : haut / milieu / bas (une seule page défilante en 3 vues) |
| D11 / D12 / D13 | Profil : pas encore ami / demande envoyée / demande reçue |
| D14 | Profil impossible à charger |
Non redessinés : chargement des résultats = 3 lignes squelette (A04) ; hors-ligne = D14 ; recherche < 2 caractères = liste des amis inchangée.

## 3. Microcopy FR
`Rechercher un pseudo ou un nom`, `4 résultats`, `Ajouter`, `Envoyée`, `Demande envoyée`, `Accepter`, `Refuser`, `Annuler`, `Annuler la demande`, `Ami`, `Demande envoyée à Marco Delmas`, `Demande non envoyée` / `Vérifie ta connexion puis réessaie. Rien n'a été envoyé à Maëlys.`, `Personne ne s'appelle « zzq »`, `Aucune demande reçue.`, `Aucune demande en cours. Cherche un ami par son pseudo.`, `Pas encore d'amis`, `Partager mon lien`, `Aucun défi en commun. Lance-en un depuis l'onglet Communauté.`, `Profil indisponible`, `Retirer des amis`.

## 4. Mouvement et accessibilité (spécifique)
Résultats : la liste se met à jour par fondu 100 ms (aucun saut de mise en page) ; le champ garde le focus. Changement d'état du bouton (Ajouter vers Envoyée) : fondu 150 ms, annoncé par `accessibilityLiveRegion="polite"` ("Demande envoyée à Marco Delmas"). `accessibilityLabel` complet pour les états abrégés (`Envoyée` = "Demande envoyée à Marco Delmas, appuyer pour annuler"). Avatars = `accessibilityElementsHidden` (le nom suit). Section `Reçues`/`Envoyées` = en-têtes `header`. Retrait d'ami : confirmation `showAlert` (jamais `Alert`). Reduced motion : fondus remplacés par un changement immédiat.

## 5. Critères d'acceptation mesurables (émulateur, deux comptes de test)
| Id | Critère | Mesure |
|---|---|---|
| AM-1 | Le champ de recherche est le premier élément focalisable sous le titre (y < 140 dp) et il n'existe aucun bouton `Rechercher` | arbre d'accessibilité |
| AM-2 | Taper 2 caractères met la liste à jour en < 500 ms sans appui supplémentaire ; effacer restaure la liste d'amis | chronométrage |
| AM-3 | Depuis la recherche globale puis depuis Amis : `Ajouter` réussit ; la ligne passe à `Envoyée` ; la demande apparaît dans En attente > Envoyées côté A et dans Reçues côté B | 2 comptes + base |
| AM-4 | Réseau coupé pendant l'envoi : bandeau `Demande non envoyée`, ligne de retour `Ajouter`, aucune ligne créée en base | mode avion |
| AM-5 | En attente : 2 sections distinctes ; Reçues = Accepter + Refuser ; Envoyées = Annuler ; l'action met à jour la liste et le badge sans relance | scénario |
| AM-6 | Un même compte voit exactement un des 4 états (`Ajouter`, `Envoyée`/`Demande envoyée`, `Accepter`, `Ami`) sur la ligne de résultat et sur son profil, identique entre les deux écrans | comparaison des 2 captures |
| AM-7 | Aucune chaîne contenant `\u` ou une séquence d'échappement ; le toast lit `Demande envoyée` | recherche texte |
| PR-1 | Profil : avatar entièrement visible (bords de l'avatar à >= 0 dp de tout bord d'écran et non recouverts), bouton d'état entièrement visible, bannière ne coupe aucun contrôle | capture + bounds uiautomator |
| PR-2 | Le profil affiche niveau + XP, série, badges, derniers entraînements, records, défis communs, objectif en français, amis, abonnés : 9 blocs présents (ou état vide explicite) | liste de contrôle sur capture défilée |
| PR-3 | Objectif : 0 occurrence de `_` dans le libellé (`muscle_gain`, `fat_loss`) | recherche texte |
| PR-4 | Les données du profil (niveau, XP, série, PR) = valeurs en base du compte consulté ; badges = ceux de `ziko_badge_definitions` obtenus | requête base |
| PR-5 | Profil en échec réseau : carte D14, aucun contenu partiel faux | mode avion |
Plus G1 à G9.

## 6. Exigence -> écran -> vérification
| Exigence | Écran(s) | Check |
|---|---|---|
| SOC-01 ajout depuis la recherche globale | D02, D04 | AM-3, AM-4 |
| SOC-02 demande envoyée visible | D02 (toast), D05 | AM-3 |
| SOC-03 reçues / envoyées | D05, D06, D13 | AM-5 |
| SOC-04 notion unique, bouton selon l'état | D02, D11, D12, D13, D08 | AM-6 |
| SOC-05 champ en haut, direct | D01, D02, D03 | AM-1, AM-2 |
| SOC-06 profil complet | D08, D09, D10 | PR-2, PR-3, PR-4 |
| SOC-07 pas de coupure sous la bannière | D08, D11, D12, D13 | PR-1 |
| SOC-08 texte sans échappement | D02, D12 | AM-7 |
