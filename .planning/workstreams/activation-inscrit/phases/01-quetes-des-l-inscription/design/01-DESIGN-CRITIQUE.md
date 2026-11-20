# Phase 1 — Critique de ma propre sortie

Revue par heuristiques faite à la main (hiérarchie, non-punitif, états, a11y, cohérence avec B12). Les skills `critique` et `audit` n'ont pas été exécutés comme outils séparés ; les skills shape, impeccable, layout, typeset, adapt ont été chargés. `high-end-visual-design`, `design-taste-frontend` et `ui-ux-pro-max` n'ont pas été appliqués.

## Points forts
- Une carte, des filets : pas de carte dans une carte, même grammaire que l'onglet Quêtes B12 (l'utilisateur reconnaît le bloc en arrivant sur Récompenses).
- Le texte d'action est sous le titre et le bouton porte un verbe : « quoi faire » et « où aller » sont lisibles sans ouvrir la ligne.
- Aucun lien vers Récompenses (niveau 3) : le piège QNEW-05 est évité par construction.
- Tous les états demandés sont rendus, dont création en cours et erreur isolée du reste de l'accueil.

## Défauts connus
1. Le bouton pastille répété 3 fois crée un rythme monotone et aucun n'est le « principal ». Compromis assumé : un seul CTA primaire plein (blanc sur `#FF5C1A` = 3.09:1, déjà une exception ouverte en v1.20) est déjà porté par « C'est parti » de la Mission juste au-dessus.
2. Une barre vide à 0 pour les quêtes « faire une fois » (repas, séance) n'apporte rien et pèse. Alternative : la masquer quand cible = 1. Je l'ai gardée pour rester identique à QuestsTab.
3. Mission du jour (hydratation) et première quête (eau) disent presque la même chose : redondance voulue au niveau 1 (CLAR-03) mais à surveiller.
4. Pile longue : avec la carte Phase 2 (176 dp) + Mission + 3 quêtes, les quêtes sont sous la ligne de flottaison sur un 844 dp ; il faut scroller. À valider avec la phase 2.
5. L'overline de la carte Mission existante est à 11 sp (< 12) : hors périmètre, signalé.

## Questions ouvertes (produit, 5 max)
1. **Jeu de quêtes du compte neuf** : eau + repas + séance (recommandé, 100 % niveau 1, demande un nouveau template « repas » en base) ou garder les 3 starters actuels (séance du jour, eau, hebdo « S'entraîner 3 fois ») sans nutrition ?
2. **Séance au niveau 1 sans programme** : la quête « Termine une séance » envoie vers l'onglet Séance ; avant la carte « Crée ton premier entraînement » (phase 2) le compte n'a pas de programme. La quête séance doit-elle n'apparaître qu'une fois la phase 2 livrée, ou accepter la séance rapide vide ?
3. **Quête terminée** : doit-elle céder sa place à une nouvelle quête dans la même journée (3 actives en permanence) ou le bloc se vide jusqu'à demain (état « Bravo, tout est fait ») ?
4. **Récompense en pièces visible dès le niveau 1** alors que la boutique est au niveau 3 : garder les pièces affichées (effet motivant) ou les masquer jusqu'au déblocage de Récompenses ?
5. **Retour haptique à la complétion** : actif par défaut (recommandé, discret) ou absent ?
