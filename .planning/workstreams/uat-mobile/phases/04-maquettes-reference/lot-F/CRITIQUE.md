# Critique et audit du lot F (Journal, Mon coach), sur ma propre sortie

Méthode : skill `critique` (revue de direction artistique + détecteur `npx impeccable --json`, lot E et F scannés ensemble) et mesures de type `audit` (Playwright : emoji, pixels `#FF5C1A`, textes < 14 sp ; `shared/build.mjs` ; `shared/contrast.mjs`). 5 écrans (périmètre Q-P22c). `frames.json` : 0 cible < 44 dp, 0 police < 12 sp ; 0 emoji. Passes `shape/impeccable/layout/typeset/adapt` appliquées par méthode, non rechargées une à une.

## Scores
Nielsen : **33/40** (visibilité 4 : bandeau de doublon d'humeur, erreurs nommées ; correspondance 4 ; contrôle 3 ; cohérence 4 : PluginHeader, Ionicons de l'accueil ; prévention 3 ; reconnaissance 4 ; efficacité 3 ; minimalisme 3 ; récupération 4 : saisie conservée ; aide 2 : peu d'aide contextuelle sur énergie/stress). Audit technique : **17/20**.

## Verdict anti-patrons
Pas de gabarit « IA » : sarcelle sobre en identité, orange réservé à l'action, pas de dégradé ni de métrique héroïque. Les 5 tuiles d'humeur sont un contrôle standard ; la hiérarchie vient de la sélection (bord 2 dp + libellé gras), pas de la couleur seule. À ne pas implémenter : visages animés, couleurs rouge-vert sur l'humeur (l'accueil les garde, le Journal non : voir Q2).

## Détecteur
Mêmes classes de constats que le lot E, tous faux positifs : `low-contrast` sur la valeur par défaut `#ff5c1a` (surchargée par `--primary:#CF4509`, preuve Playwright 0 pixel), page d'aperçu, `cramped-padding` des segments, polices/palette de la charte. Réels : 0. Sarcelle : tous les couples >= seuil (5,47 / 5,06 / 4,70 / 6,92).

## Constats traités pendant la passe
1. Libellés d'humeur à 12 sp passés à 14 sp (`Excellent` ne tenait pas : remplacé par `Super`, `Ok` par `Moyen`). 2. Étiquettes de jours du graphique 14 sp. 3. Écran Journal trop long pour une capture : scindé en F03 (haut) et F04 (bas + erreur), le défilement réel est conservé. 4. Chevron de retour de `PluginHeader` à 34 dp : zone 44 dp exigée (CO-2).

## Questions ouvertes (max 5)
1. **Bouton Enregistrer** : orange (action, recommandé, cohérent produit) ou sarcelle (identité du module) ?
2. **Humeur : couleurs de l'accueil** : l'accueil colore les 5 niveaux (rouge à vert) ; le Journal est neutre + sarcelle. Faut-il aligner l'accueil sur le neutre, ou laisser la différence ? Recommandé : laisser (hors périmètre P22).
3. **Libellés d'humeur** : `Mauvais, Bof, Moyen, Bien, Super` (changement par rapport à `Ok`/`Excellent` du code actuel, imposé par la taille 14 sp). Valider.
4. **Retour de Mon coach** : le chevron revient à l'écran précédent (Modules) ; faut-il un second bouton `Retirer mon coach` ? Recommandé : non, P25.
5. **Stats de la carte coach** : `séances en 30 jours` et `habitudes tenues` (données de l'athlète). Les stats du coach (clients, ancienneté) viendront-elles avec P25 ? Recommandé : oui, ne rien inventer ici.
