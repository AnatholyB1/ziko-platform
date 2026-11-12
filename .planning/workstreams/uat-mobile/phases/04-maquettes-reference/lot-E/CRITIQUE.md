# Critique et audit du lot E (Hydratation, Mesures), sur ma propre sortie

Méthode : skill `critique` (revue de direction artistique + détecteur déterministe `npx impeccable --json` sur les 2 pages) et mesures de type `audit` (Playwright : couleurs calculées, emoji, tailles ; `shared/build.mjs` ; `shared/contrast.mjs`). 16 écrans. `frames.json` : 0 cible < 44 dp, 0 police < 12 sp. Playwright : 0 emoji, 0 pixel `#FF5C1A`, 0 texte < 14 sp hors badges/surtitres/onglets. Les passes de skills `shape/impeccable/layout/typeset/adapt` ont été appliquées par méthode (socle, contrats, grille 4 pt) et non rechargées une à une.

## Scores
Nielsen : **34/40** (visibilité 4 : toast, jauge, badges d'état ; correspondance 4 ; contrôle 3 : annuler l'ajout, mais pas d'annulation de réglage hors croix ; cohérence 4 ; prévention d'erreur 4 : validations, verrou ; reconnaissance 3 ; efficacité 3 : 3 tuiles + stepper 100 ml ; minimalisme 3 ; récupération d'erreur 3 ; aide 3). Audit technique : **17/20** (a11y 3, perf 4, adaptation 3, thème 4, anti-patrons 3).

## Verdict anti-patrons
Pas de gabarit « IA » : charte imposée (clair, orange, Ionicons), pas de dégradé de texte, pas de verre dépoli, pas de bordure latérale colorée. Risque assumé : trois tuiles identiques (E01) et trois cartes d'objectif semblables (E11) ; atténué par la goutte de taille croissante et le `%` en 22 sp qui donne la hiérarchie. À ne pas ajouter à l'implémentation : animation de vague/remplissage décorative, confettis à l'atteinte d'un objectif.

## Détecteur : tri des 46 constats
- **Faux positifs (46)** : `low-contrast` blanc/`#ff5c1a` et `#ff5c1a`/blanc (x 9) : le détecteur lit la valeur par défaut de `tokens.css` sans la surcharge `--primary:#CF4509` de `extra.css` ; preuve : Playwright 0 pixel `rgb(255,92,26)`. `#6b6963` sur `#e9e7e1` : fond de la page d'aperçu, hors produit. `#8a877f` sur `#f0efe9` (3,1:1) : libellé du bouton **désactivé** (exempté WCAG). `cramped-padding` (25) : `seg`, `stp`, `tabs` par construction. `overused-font`, `cream-palette` : charte et lot A, assumés.
- **Réels** : 0.

## Constats traités pendant la passe
1. Pastille `PAR DÉFAUT` coupée sur 2 lignes et tuiles désalignées : pastille `nowrap` dans la tuile, zone icône de hauteur fixe. 2. Cartes d'objectif trop hautes (bouton `Ajouter un objectif` hors écran) : ligne redondante supprimée, sens porté par le sous-titre. 3. Étiquettes 12 sp du graphique et des humeurs portées à 14 sp. 4. Hypothèse corrigée : aucune action de saisie de café n'était prévue : ajout de `Ajouter un café ou un thé` (voir Q2).

## Questions ouvertes (max 5)
1. **Rôle de la taille de verre par défaut (HYDR-03)** : la maquette la fait servir à `J'ai bu` des rappels et à l'assistant, avec pastille `PAR DÉFAUT` sur la tuile correspondante. Alternative : un 4e bouton `Verre : 300 ml`. Recommandé : version maquette (HYDR-01 reste à 3 boutons).
2. **Saisie du café/thé** : `Ajouter un café ou un thé` est une hypothèse de design (le code actuel n'a pas de saisie dédiée ; sans elle le réglage HYDR-04 n'a aucun effet visible). Recommandé : garder, 1 feuille « quantité » à spécifier au plan P11, sinon retirer le réglage.
3. **Jour de séance (HYDR-05)** : séance enregistrée à la date locale du jour = bonus. Faut-il aussi compter une séance planifiée non terminée ? Recommandé : non (séance loguée uniquement).
4. **Départ d'un objectif sans mesure** : le départ est prérempli et modifiable. Un départ modifiable permet de tricher son %, mais l'objectif est verrouillé ensuite. Recommandé : modifiable à la création, seulement.
5. **Objectif atteint puis mesure qui repart dans le mauvais sens** : le badge `ATTEINT` est définitif (historique). Recommandé : oui, définitif ; le suivant reprend la dernière mesure.
