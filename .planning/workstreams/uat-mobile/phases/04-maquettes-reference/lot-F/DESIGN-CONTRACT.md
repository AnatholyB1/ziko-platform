# Contrat de design, lot F : Journal (humeur en Ionicons, sarcelle) et écran Mon coach

Phase consommatrice : **22** (JRNL-01, 02, COACH-01, 02). Périmètre voulu : 5 maquettes légères (Q-P22c) ; tient lieu d'UI-SPEC. Maquettes : `gallery.html` > lot F ; PNG `lot-F/png/fNN-*.png` (hors git) ; sources `lot-F/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (G1 à G9). Hors périmètre (P25) : retrait du coach, programme prescrit, flux d'invitation.

## 0. Écarts au socle
- **Primaire d'action `#CF4509`** (décision utilisateur) pour les boutons pleins ; **sarcelle `#0F766E`** (décision utilisateur) = couleur d'identité du module Journal : sélection (bord 2 dp + teinte `#E1F1EF`), onglet actif, barres de tendance, icônes de section. Contrastes (`node shared/contrast.mjs`) : sarcelle/blanc 5,47:1 ; sarcelle/teinte 4,70:1 ; sarcelle/fond 5,06:1 (icône). **Le violet `#7B5BD0` disparaît du plugin.**
- Le bouton principal reste orange (cohérence produit) ; la sarcelle ne porte jamais seule un état (libellé + forme).

## 1. Décisions prises dans les maquettes
### Journal
- **Humeur (JRNL-02)** : 5 tuiles de 76 dp mini, icône Ionicons 28 + libellé 14 sp : `sad` contour `Mauvais`, `sad` plein `Bof`, `remove-circle` `Moyen`, `happy` plein `Bien`, `happy` contour `Super`. Mêmes noms d'icônes que le sélecteur de l'accueil (P8), niveaux 1 à 5 ; l'accueil garde ses couleurs, le Journal reste neutre (gris `#8A877F` -> sarcelle à la sélection) : la couleur n'est jamais le seul signal. Sélection = bord 2 dp sarcelle + teinte + libellé gras. `accessibilityRole="radio"` + `selected`.
- **Énergie et stress** : rangées de 5 cases numérotées 1 à 5 (48 dp), icône de section `battery-half` / `pulse`, légendes d'extrémités (`Épuisé` / `En forme`, `Détendu` / `Très stressé`). Plus aucune rangée d'emojis.
- **Moment** : 5 puces 44 dp avec Ionicons : `Matin` (`sunny`) = `morning`, `Avant séance` (`barbell`) = `pre_workout`, `Après séance` (`fitness`) = `post_workout`, `Soir` (`moon`) = `evening`, `Général` (`ellipse`) = `general` (défaut). **`afternoon` n'existe pas** (viole le CHECK).
- **Doublon avec le Quick Log (Q-P22b)** : l'humeur de l'accueil est l'entrée `general` du jour. Si elle existe, le Journal affiche un bandeau (`Humeur déjà notée aujourd'hui depuis l'accueil : Bien. Ton enregistrement la met à jour.`), pré-sélectionne les valeurs, le bouton dit `Mettre à jour`. Une autre valeur de moment crée une entrée distincte.
- **Enregistrement (JRNL-01)** : l'utilisateur est lu **au moment de l'enregistrement** via le gestionnaire de session. Succès : toast `Entrée enregistrée`. Session expirée (F04) : bandeau rouge `Session expirée / Ton entrée n'a pas été enregistrée. Reconnecte-toi, ta saisie est conservée.` + bouton `Se reconnecter` + `Réessayer l'enregistrement`. Hors ligne : `Pas de connexion. Ton entrée n'est pas enregistrée.` + `Réessayer`. Erreur serveur : `Enregistrement impossible. Réessaie dans un instant.` Jamais la chaîne `Utilisateur non connecté`.
- **Historique (F05)** : carte tendance 7 jours (barres sarcelle, **jour sans entrée = barre absente**, pas de zéro), moyenne `3,8 / 5` + écart à la semaine passée, puis liste (icône d'humeur + libellé + moment + note tronquée ; énergie/stress en texte). Vide : `Aucune entrée pour l'instant` + bouton `Noter ma journée`.
### Mon coach
- **En-tête (COACH-02)** : composant `PluginHeader` de `@ziko/ui` (retour chevron, titre 20 sp/800), **plus de titre 28 px maison**. Le chevron fait 34 dp visuels : la zone tactile doit atteindre 44x44 (marge `hitSlop` 5 dp), à traiter avec P5 sans modifier le composant ici ; la maquette montre la zone 44.
- **Coach lié (F01, COACH-01)** : carte standard : avatar 72 dp (logo ou photo ; repli initiales sur teinte sarcelle), nom 22 sp, sous-titre, badge `IDENTITÉ VÉRIFIÉE` (icône `shield-checkmark`, vert) **seulement si KYC vérifié**, spécialités en puces, `Ton coach depuis le 3 oct. 2026`. Dessous : 2 stats `séances en 30 jours` et `habitudes tenues` (données de l'athlète, sources actuelles de l'écran).
- **Dégradé (F02, G-05)** : lien actif mais profil absent : carte `Ton coach` (nom connu sinon libellé générique), badge `COACH LIÉ`, date, bandeau d'avertissement `Profil indisponible`, bouton `Réessayer` (relance la requête). Les stats restent affichées. Jamais d'écran sans contenu. Chargement : squelettes de la carte ; erreur réseau complète : même carte + `Impossible de charger. Vérifie ta connexion.`

## 2. Accessibilité
Humeur et moment en `radiogroup`/`radio` ; cases 1 à 5 `radio` avec `accessibilityLabel="Énergie 3 sur 5"` ; barres de tendance `image` avec description textuelle (« Humeur des 7 derniers jours : lundi 3, mardi 4 ... ») ; bandeaux d'erreur `alert` ; avatar décoratif `importantForAccessibility="no"` si le nom est présent ; mouvement : fondu 150 ms uniquement, reduced-motion respecté. Dynamic type 130 % : les libellés d'humeur ne se coupent pas (taille de tuile s'adapte, hauteur libre).

## 3. Critères mesurables (émulateur Android 1080x2400 / dpi 420, en plus de G1 à G9)
| Id | Critère | Méthode |
|---|---|---|
| JR-1 | 0 emoji dans `plugins/journal/src/**` et à l'écran (`\p{Extended_Pictographic}` = 0) ; icônes d'humeur = les 5 noms Ionicons ci-dessus | recherche + capture |
| JR-2 | Enregistrer une entrée juste après un cycle arrière-plan / retour (jeton rafraîchi) réussit ; **0** alerte `Utilisateur non connecté` ; ligne créée | scénario + base |
| JR-3 | Les 5 moments s'écrivent `morning`, `pre_workout`, `post_workout`, `evening`, `general` ; aucune autre valeur n'atteint la base (0 violation du CHECK) | test unitaire + base |
| JR-4 | Humeur notée sur l'accueil puis Journal `Général` le même jour : **1** ligne `general` (mise à jour), bouton `Mettre à jour` | base + capture |
| JR-5 | 0 occurrence de `#7B5BD0` dans le plugin ; élément sélectionné : bord `#0F766E` 2 dp, fond `#E1F1EF` ; texte de sélection contraste >= 4,5:1 | recherche + pixel |
| JR-6 | Session expirée simulée : message F04 visible, champs conservés (humeur, énergie, stress, notes), `Se reconnecter` mène à l'écran de connexion puis retour avec saisie intacte | scénario |
| JR-7 | Tendance : un jour sans entrée = 0 barre (pas de barre de hauteur 0), valeurs = moyenne du jour | jeu de données |
| CO-1 | Coach lié, avec ou sans `preview` : le nom du coach (ou `Ton coach`) est visible ; **0** écran sans texte de contenu | harnais de rendu + capture |
| CO-2 | En-tête = `PluginHeader` (titre 20 sp, retour chevron) ; 0 titre de 28 px ; zone de retour >= 44x44 dp ; premier contenu >= 44 dp sous le haut (G5) | `uiautomator` + recherche |
| CO-3 | Badge `IDENTITÉ VÉRIFIÉE` seulement si KYC vérifié ; spécialités = celles du profil (écart 0) | jeu de données |
| CO-4 | Dégradé : `Réessayer` relance la requête, le profil complet remplace la carte dégradée sans quitter l'écran | scénario réseau coupé puis rétabli |
Plus G1 à G9 (frames.json : 0 cible < 44 dp, 0 police < 12 sp sur 5 écrans ; Playwright : 0 emoji, 0 pixel `#FF5C1A`).

## 4. Exigence -> écran -> vérification
| Exigence | Écran(s) | Check |
|---|---|---|
| JRNL-01 enregistrement avec session valide | F03, F04 | JR-2, JR-6 |
| JRNL-02 Ionicons + couleur cohérente | F03, F04, F05 | JR-1, JR-3, JR-5, JR-7 |
| (Q-P22b) humeur Quick Log | F03 | JR-4 |
| COACH-01 profil du coach | F01, F02 | CO-1, CO-3, CO-4 |
| COACH-02 header, retour, UI | F01, F02 | CO-2 |
