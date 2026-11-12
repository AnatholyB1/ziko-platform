# Critique et audit du lot D (Amis, profil public)

Critique et audit conjoints avec le lot C : voir `../lot-C/CRITIQUE.md` (scores, tri des 63 constats du détecteur, corrections). Spécifique au lot D (14 écrans) :

## Corrigé après critique
- Avatar rogné par la bannière : chevauchement maîtrisé, bouton d'état sous la bannière (SOC-07).
- `Demande envoyée` cassait la ligne de résultat : `Envoyée` en liste, texte complet sur le profil et le toast.
- Badge de l'onglet En attente = demandes reçues uniquement.
- Profil d'une demande reçue : Accepter / Refuser directement sur le profil, pas seulement dans la liste.

## Points assumés
- Initiales sur fond neutre à la place d'avatars ; bannière neutre (aucune fausse photo).
- D08 à D10 = un profil défilant en 3 vues (D09 et D10 sans la bannière).
- `Retirer des amis` est en pied de profil (action rare, danger, confirmation) et non dans le haut.

## Questions ouvertes (2)
1. **Visibilité du profil pour un non-ami (D11)** : le maquettage montre niveau, XP, série et compteurs mais **pas** les derniers entraînements ni les records (confidentialité). Recommandation : public = identité, niveau, série, badges ; ami = entraînements, records, défis communs. À confirmer avant la phase 21 (impacte les politiques RLS).
2. **Abonnés** : puisque `Suivre` et `ami` fusionnent (SOC-04), faut-il garder le compteur `abonnés` ? Recommandation : le garder en lecture seule (les abonnés historiques sont conservés), sans bouton `Suivre`.
