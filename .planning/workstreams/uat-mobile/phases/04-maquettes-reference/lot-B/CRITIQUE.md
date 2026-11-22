# Critique et audit du lot B (sur ma propre sortie)

Même méthode que le lot A. Écrans : 23 (13 Récompenses, 10 Garde-manger).

## Corrigé après critique
- Pièces : l'icône billets (`cash`) lisait "argent réel" : remplacée par `disc` (jeton).
- Succès : 5 lignes sur 11 seulement visibles : ajout de B02b (liste défilée) pour prouver les 11.
- Boutique : "Il manque 460" coupé sur 2 lignes dans la carte : mis sur sa propre ligne.
- Aperçu d'achat : "Solde après achat : - 160 manquants" confus : remplacé par "Ton solde : 340 pièces".
- Lien "Tout voir" en orange pur (2.85:1) : `#B53D05` (5.3:1). Mêmes corrections de contraste que le lot A.

## Points assumés
- Les aplats de thèmes (Océan, Forêt, Aurore) sont des échantillons d'objets de boutique, pas des écrans du thème Ziko : la charte de l'app reste claire ; seuls les objets achetés changent le rendu. Ce n'est pas un mode sombre.
- B06 : 4 objets visibles ; l'écran défile pour la suite (aucune limite de 8).
- Pas de confetti ni d'animation de victoire : le déblocage est un toast sobre (charte : énergie décisive sans agressivité).
- Aperçu caméra du scan = aplat étiqueté, pas de fausse photo.

## Questions ouvertes (4)
1. **Libellé des boutons primaires** : voir lot A, question 1 (même décision pour tout le produit).
2. **Nom du module** : `Garde-manger` (maquette) ou `Stock` ou garder `Pantry` avec sous-titre français. Recommandation : Garde-manger, plus clair que le terme anglais signalé en UAT (PANT-07).
3. **Thèmes achetés et marque du coach** : un athlète coaché voit déjà le branding de son coach (override via `useThemeStore`). Un thème acheté doit-il être ignoré tant qu'un branding coach est actif (recommandé), ou l'emporter ?
4. **Économie de pièces** : les montants (+25 séance, +50 record, +75 série de 7 jours, prix 300 à 800) sont des placeholders pour la maquette. À confirmer par la Phase 12 avant seed.
