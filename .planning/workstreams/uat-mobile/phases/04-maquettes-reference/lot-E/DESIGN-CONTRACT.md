# Contrat de design, lot E : Hydratation (réglages et boutons) et Mesures (objectifs en base)

Phases consommatrices : **11** (HYDR-01 à 06), **15** (MEAS-01, 04, 05, 06). Maquettes : `gallery.html` > lot E ; PNG `lot-E/png/eNN-*.png` (hors git) ; sources `lot-E/src/`. Socle : `../shared/DESIGN-SYSTEM.md` (G1 à G9). Format identique à `lot-C/DESIGN-CONTRACT.md`. Noms, dates et chiffres : placeholders cohérents, aucune photo.

## 0. Écarts au socle
- **Primaire d'action `#CF4509`** (token `actionPrimary`, décision utilisateur) : blanc dessus 4,66:1, icône sur fond 4,31:1 (>= 3). `--primary-press #B53D05`. Texte orange sur clair = `#B53D05`. Rendu avec `--primary:#CF4509` dans `lot-E/src/extra.css`.
- **Couleur « eau »** `#2563C9` (= `info` du socle) sur teinte `#E8F0FD` : goutte, jauge, pastille %. Contrastes ajoutés à `shared/contrast.mjs` (5,67:1 sur blanc, 4,94:1 texte/teinte). L'action reste orange.
- Composants ajoutés : tuile de quantité `qa`, jauge `gauge` (14 dp), puce de mesure `mchip`, champ `fld` (label + champ + aide + erreur), barre de progression `pbar` (10 dp), clavier factice `kb` (maquette uniquement).

## 1. Décisions prises dans les maquettes
### Hydratation (P11)
- **Onglets inchangés** : Aujourd'hui / Historique / Réglages (marge latérale 16 dp, indicateur inset 12 dp comme lot C).
- **HYDR-01, tuiles** : 3 tuiles égales, carte standard (rayon 16, bord 1 dp, ombre), hauteur 132 dp, goutte Ionicons `water` pleine de taille croissante (24 / 30 / 36), valeur `+250` en Manrope 800 22 sp, unité `ml` 14 sp. Plus de bouton « laid » : la quantité est lisible en un coup d'oeil. La tuile égale à la taille de verre par défaut porte la pastille `PAR DÉFAUT` (12 sp) ; sans correspondance (ex. 300 ml), aucune pastille. Sous les tuiles : action texte `Ajouter un café ou un thé` (44 dp, orange `#B53D05`).
- **État pressé (E02)** : fond `#F0EFE9`, bord 2 dp `#CF4509`, échelle 0,98 en 100 ms, **vibration légère** (`Haptics.impactAsync(Light)`), sans ombre. Retour : jauge et chiffre mis à jour sur place, toast `+500 ml ajoutés` + `Annuler` (zone 44 dp, 5 s). Un appui = une ligne de log ; pas de double ajout tant que l'écriture n'est pas confirmée (tuiles désactivées 300 ms).
- **Réglages = liste de lignes cliquables** (reco du CONTEXT) : carte `Objectif quotidien` (valeur + bonus rappelé + `Modifier`) puis 4 lignes avec **la valeur actuelle en orange `#B53D05`** et chevron. Chaque ligne ouvre une **feuille basse** (rayon haut 24, poignée, scrim, fermeture par croix 44 dp ou scrim) avec un bouton `Enregistrer` unique : rien n'est enregistré avant ce bouton.
- **Rappels (E04)** : interrupteur, intervalle en segment (60 / 90 / 120 / 180 min), plage horaire en steppers de 30 min (début, fin), résumé calculé (`9 rappels par jour : 08:00, 09:30 ...`). Règle : `n = floor((fin - début) / intervalle) + 1`, premier rappel = début, dernier <= fin ; aucun rappel une fois l'objectif atteint. Interrupteur éteint : intervalle et plage masqués. Permission refusée (E09) : bandeau `alert`, bouton `Ouvrir les réglages Android`, interrupteur reste éteint (`En attente d'autorisation`), `Enregistrer` désactivé.
- **Taille de verre (E05)** : 6 contenances (150, 200, 250, 300, 330, 500 ml) en grille 3x2, choix = bord 2 dp + fond `#FFF0E8` + libellé `ml, choisi` (jamais la couleur seule). Rôle expliqué : quantité ajoutée par `J'ai bu` dans une notification de rappel et par l'assistant sans quantité précisée.
- **Café et thé (E06)** : interrupteur + part comptée en segment 25 / 50 / 75 / 100 % + exemple calculé (`250 ml ajoute 125 ml`). Éteint : segment masqué, café = 0 ml compté.
- **Bonus jour de séance (E07)** : stepper de 100 ml (0 à 1 500), résumé `2,0 L + 0,5 L = 2,5 L`. **Jour de séance = au moins une séance enregistrée à la date locale du jour** (détection à fixer au plan, D-05).
- **Objectif au clavier (E08, HYDR-06)** : feuille **remontée au-dessus du clavier** (`KeyboardAvoidingView` + défilement au focus) ; champ numérique (`keyboardType="number-pad"`), aide `Soit 2,4 L` calculée en direct, plage conseillée 1 500 à 4 000 ml ; hors plage = message sous le champ, `Enregistrer` désactivé.
### Mesures (P15)
- **Sans objectif (E10)** : état vide actionnable (`Définir un objectif`), plus de 76 kg / 78 cm / 40 cm : tout objectif vient de la base.
- **Carte objectif (E11)** : icône de la mesure, nom, sens (`Baisse` / `Hausse`) + point de départ + date, badge `EN COURS` avec cadenas, **% en 22 sp**, `valeur actuelle vers cible`, barre. Sans nouvelle mesure : `0 %` et `Aucune nouvelle mesure` (le départ est la première mesure ou la valeur saisie à la création). Phrase fixe sous la liste : `Un objectif en cours ne se modifie pas.`
- **Formule du %** : `atteint` si la valeur courante a franchi la cible dans le sens voulu ; sinon `pct = clamp(round(100 x (départ - courant) / (départ - cible)), 0, 99)` ; atteint = 100. Valable à la baisse comme à la hausse (le signe se simplifie). Mouvement dans le mauvais sens = 0 %.
- **Verrou (MEAS-06)** : aucune affordance d'édition sur un objectif en cours (pas de crayon, pas de `Modifier`) ; toucher la carte ouvre une feuille d'information (E16). Côté base : `UPDATE` client de départ/cible/mesure refusé (trigger ou politique), à prouver par test RLS (D-04).
- **Atteint (E12)** : bordure `#9FD3B4`, badge `ATTEINT`, % vert, date, bouton primaire `Définir le suivant`. Un objectif atteint ne bloque pas la création d'un autre pour la même mesure.
- **Création (E13, E14)** : 7 puces de mesure (poids, taille, bras, poitrine, cuisses, hanches, masse grasse), départ prérempli avec la dernière mesure (modifiable, sinon saisie obligatoire), cible, bandeau `Objectif de baisse : 3,4 kg à perdre` calculé, rappel du verrou. Validation : cible = départ -> `La cible doit être différente du point de départ.` sous le champ, bord rouge 2 dp, bouton `Créer l'objectif` désactivé ; unité imposée par la mesure.
- **Saisie de mesure (E15)** : 7 champs, **seul le poids est obligatoire** (`Facultatif` en placeholder, label toujours visible), unité à droite.

## 2. États et microcopy (FR, sans emoji)
| Contexte | Texte |
|---|---|
| Ajout d'eau | `+500 ml ajoutés` · `Annuler` |
| Écriture échouée | bandeau `Impossible d'enregistrer. Vérifie ta connexion.` + `Réessayer` |
| Rappels, résumé | `9 rappels par jour : 08:00, 09:30, 11:00 ... 20:00. Aucun rappel une fois l'objectif atteint.` |
| Permission refusée | `Notifications désactivées` / `Android bloque les rappels de Ziko. Active-les pour être prévenu.` |
| Objectif trop bas/haut | `Choisis une valeur entre 1 500 et 4 000 ml.` |
| Objectifs vide | `Aucun objectif pour l'instant` / `Choisis une mesure, un point de départ et une cible. Ziko calcule ta progression en pourcentage.` |
| Verrou | `Tu ne peux pas modifier cet objectif tant qu'il n'est pas atteint. Il te reste 3,4 kg.` |
| Atteint | `Objectif atteint le 12 nov. Bravo.` |
| Chargement | squelettes gris `#ECEAE4` (jamais orange), pas de spinner plein écran |

## 3. Accessibilité
Boutons `button` ; tuiles `accessibilityLabel="Ajouter 500 millilitres"` ; jauge et barres `progressbar` + `accessibilityValue {now,max}` (« 1 250 sur 2 000 millilitres », « 43 pour cent ») ; interrupteurs `switch` + `checked`, zone 52x44 ; segments `radio` + `selected` ; feuilles `modal`, focus piégé, retour Android ferme ; toast `liveRegion polite` ; erreurs de champ `accessibilityLiveRegion` + liées au champ. L'état (en cours, atteint, choisi, par défaut) a toujours un mot ou une icône. Dynamic type 130 % : les lignes de réglage se replient, `Enregistrer` jamais coupé. Reduced motion : pas d'échelle 0,98 ni de translation de feuille (fondu 100 ms), jauge sans animation d'entrée.

## 4. Critères mesurables (émulateur Android 1080x2400 / dpi 420, en plus de G1 à G9)
| Id | Critère | Méthode |
|---|---|---|
| HY-1 | Un appui sur +250 / +500 / +750 ajoute exactement 250 / 500 / 750 ml : écart de total = quantité, 1 ligne créée par appui, 0 ligne en double sur 10 appuis rapides espacés de 100 ms | base + capture |
| HY-2 | Les 3 tuiles : largeur égale (+-2 dp), hauteur 132 +-4 dp, chacune >= 44x44 dp ; goutte et valeur alignées d'une tuile à l'autre (+-2 dp) | uiautomator `bounds` |
| HY-3 | Pendant un appui long de 400 ms : fond `#F0EFE9`, bord `#CF4509` 2 dp ; une impulsion haptique légère est déclenchée | capture + test unitaire (mock `Haptics`) |
| HY-4 | Après arrêt forcé et relance, les 4 réglages affichent les valeurs saisies ; une ligne dans la table de réglages (`user_id` = compte test) | scénario + base |
| HY-5 | Rappels 08:00-21:00 / 90 min : exactement 9 notifications planifiées, premier 08:00, dernier 20:00 (+-1 min) ; interrupteur éteint = 0 ; objectif atteint = 0 pour le reste du jour | `getAllScheduledNotificationsAsync` |
| HY-6 | Permission refusée : bandeau visible, `Enregistrer` désactivé, bouton ouvre les réglages de l'application | scénario |
| HY-7 | Café à 50 % : un café de 250 ml ajoute 125 ml (+-0) ; interrupteur éteint : +0 ml | base |
| HY-8 | Bonus 500 ml : objectif affiché le jour avec séance = base + 500, sans séance = base ; changer le bonus à 700 met à jour la valeur sans relance | scénario |
| HY-9 | Clavier ouvert sur `Objectif quotidien` : bas du champ ET du bouton `Enregistrer` >= 8 dp au-dessus du haut du clavier (IME), 0 élément masqué | `uiautomator` + insets |
| HY-10 | Aucune valeur de réglage codée en dur (`Toutes les 90 min`, `250 ml`, `Oui (à 50%)`, `+500 ml`) dans `HydrationPlugin.tsx` | recherche texte |
| ME-1 | Compte neuf : 0 objectif, état E10 ; 0 occurrence de `76`, `78`, `40` comme cibles dans `MeasurementsPlugin.tsx` | capture + recherche |
| ME-2 | Créer un objectif Poids 79,4 -> 76 : ligne en base (`départ 79,4`, `cible 76`), carte à `0 %` | base + capture |
| ME-3 | % : (82 ; 79,4 ; 76) = 43 ; (36 ; 37,2 ; 40) = 30 ; courant = départ -> 0 ; mauvais sens -> 0 ; courant au-delà de la cible -> 100 + badge `ATTEINT` ; 99,6 arrondi reste 99 tant que non atteint ; départ = cible refusé | tests unitaires (>= 8 cas) |
| ME-4 | Les 7 mesures sont proposées à la saisie et à la création d'objectif, dans l'ordre E15 | arbre d'accessibilité |
| ME-5 | Objectif en cours : 0 bouton `Modifier`/crayon ; un `UPDATE` du départ/cible par le client est rejeté | capture + test RLS |
| ME-6 | Objectif atteint : `Définir le suivant` ouvre le formulaire E13 et crée un second objectif ; l'ancien reste en historique `ATTEINT` | scénario |
| ME-7 | Cible = départ : message exact de la microcopy sous le champ, bouton `enabled=false`, champs conservés | saisie |
Plus G1 à G9 (frames.json : 0 cible < 44 dp, 0 police < 12 sp sur 16 écrans ; Playwright : 0 emoji, 0 pixel `#FF5C1A`, 0 texte < 14 sp hors badges, surtitres et onglets).

## 5. Exigence -> écran -> vérification
| Exigence | Écran(s) | Check |
|---|---|---|
| HYDR-01 boutons redessinés | E01, E02 | HY-1, HY-2, HY-3 |
| HYDR-02 rappels | E03, E04, E09 | HY-4, HY-5, HY-6 |
| HYDR-03 taille de verre | E03, E05 | HY-4 |
| HYDR-04 café et thé | E03, E06 | HY-7 |
| HYDR-05 bonus jour de séance | E03, E07 | HY-8 |
| HYDR-06 champ au-dessus du clavier | E08 | HY-9 |
| (D-03) persistance | E03 à E07 | HY-4, HY-10 |
| MEAS-01 objectifs en base | E10, E11, E13 | ME-1, ME-2 |
| MEAS-04 7 mesures | E13, E15 | ME-4 |
| MEAS-05 % de complétion | E11, E12 | ME-3 |
| MEAS-06 non modifiable / suivant | E11, E12, E16 | ME-5, ME-6, ME-7 |
