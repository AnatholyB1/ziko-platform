# Critique et audit de la Phase 2 (sur mes propres sorties)

Passes faites avec les principes critique et audit : hiérarchie, charge cognitive, états, accessibilité, contraste, cibles, texte. Mesures mécaniques : rendu de 16 écrans, 0 cible < 44 dp, 0 texte < 12 sp ; contrastes calculés (voir contrat P2-15).

## Ce qui tient
- Une seule carte, filets internes : pas de carte dans la carte, pas de grille de cartes identiques ; le livrable (`Programme` / `Séance`) est dit sur chaque chemin, ce qui est la vraie réponse à « ça crée quoi ? ».
- Les états à risque sont traités avant l'ouverture (crédits épuisés, solde inconnu) et réutilisent les mécanismes existants (écran d'épuisement, repli `Consomme des crédits IA`).
- Rien de nouveau n'est promis à l'onboarding : tout ce que dit l'écran existe (profil enregistré, Ziko).

## Défauts constatés et corrigés pendant la passe
1. Première version de la carte trop haute (Mission du jour presque invisible) : phrases raccourcies, sous-titre ramené à une ligne, coût en ligne unique. La Mission reste partiellement visible sous la carte sur 390x844 (c'est voulu : signal de défilement).
2. Bouton secondaire de l'onglet qui débordait (libellé trop long) : `Générer une séance IA`.
3. Rangée mise en avant (Manuel épuisé) : l'icône perdait son fond (même teinte) : fond blanc.
4. Message d'épuisement trop long sur la rangée : réduit à `Crédits épuisés`.

## Risques et limites (non prouvés)
- Pas testé sur appareil ni émulateur : les rendus sont des mocks HTML. Les dimensions réelles React Native (retours à la ligne de Manrope/Geist, polices système de repli) peuvent varier de quelques dp.
- Contraste connu et non résolu : texte blanc sur `#FF5C1A` = 3,09:1 (boutons pleins). Décision v1.20 déjà soumise ; reprise ici sans la trancher.
- Hauteur de la carte (~480 dp) : elle pousse Mission et Quêtes sous le pli sur un petit écran (360x640). Voulu (priorité au premier entraînement), à confirmer à l'UAT.
- La barre d'onglets et la salutation des mocks sont des approximations de référence, pas la source de vérité.
- Les valeurs de coût (4 crédits) viennent de `credits.ts` ; la source côté client pour le chemin « programme » n'est pas vérifiée (contrat section 9).

## Questions ouvertes pour l'utilisateur (5 au plus, choix produit)
1. **Conseiller un chemin ?** La carte met 3 chemins à égalité, Manuel en premier avec `Gratuit` en vert. Faut-il ajouter une pastille `Conseillé` (sur Manuel, gratuit et sans attente de crédits, ou sur IA simple, le plus rapide) ou rester neutre ?
2. **Carte Mission du jour vide.** Sans programme ni mission, elle affiche aujourd'hui « Aucun programme actif / Créer un programme IA ». Je propose de la masquer tant que la carte du premier entraînement est visible (sinon deux cartes proposent la même chose avec des destinations différentes). D'accord, ou on la garde ?
3. **Fin d'onboarding en clair.** L'écran actuel est sombre (comme la carte Mission du jour) alors que la charte est « clair uniquement ». Les maquettes sont en clair ; faut-il garder ce moment sombre comme signature, ou le passer en clair ?
4. **Pouvoir ignorer la carte ?** Elle ne disparaît qu'avec un programme actif ou une séance terminée. Faut-il un `Plus tard` qui la replie (au risque de laisser le compte sans chemin visible), ou jamais ?
5. **Variante de fin d'onboarding.** A (récap des réponses), B (« La suite » en 3 étapes, recommandée) ou C (une phrase) ? Et le bouton `Créer un programme` de l'onglet Entraînement : feuille de choix (proposé) ou directement l'assistant en 4 étapes ?
