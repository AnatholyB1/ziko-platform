# Critique et audit du lot A (sur ma propre sortie)

Méthode : critique heuristique (hiérarchie, charge cognitive, états) + audit technique (`shared/build.mjs` : cibles tactiles et tailles de police par écran ; `shared/contrast.mjs` : ratios). Écrans : 21.

## Corrigé après critique
- Titre de l'atelier à 2 lignes ("Atelier de programme") : raccourci en `Atelier IA`, titres en `nowrap`.
- Macros du récap repas coupées sur 2 lignes : passées en colonnes libellé/valeur.
- Bandeau de contexte de l'atelier à 42 dp : porté à 44 dp (cible tactile).
- Segments à icône empilée : alignement horizontal.
- Contrastes (audit) : succès `#1F8A4C` -> `#17703D` (3.9 -> 5.4), alerte `#A86A00` -> `#8A5700`, danger `#C73A2E` -> `#B5301F`, or texte `#7A5800`, lien orange `#B53D05` ; puces `chip.pr` en `#B53D05`.
- Arrière-plans des feuilles (A02, A06, A07, A08) : la vraie liste, plus de blocs vides.

## Points assumés (non bloquants)
- A10 : le brouillon est coupé après 2,5 séances : c'est un écran défilant, la coupe montre qu'il continue. L'app doit défiler, pas tronquer.
- A16/A17 : la rangée de repas défile horizontalement (`Dîner` rogné à droite = indice de défilement).
- Barre d'onglets : libellés 12 sp (exception G2 documentée).
- Aucun écran n'utilise de photo : l'aperçu caméra est un aplat sombre étiqueté "Aperçu caméra".
- Icônes primaires (`#FF5C1A` sur fond clair) = 2.86:1, sous le seuil graphique de 3 ; toujours doublées d'un libellé, donc non porteuses d'information seules.

## Questions ouvertes (4)
1. **Libellé des boutons primaires** : blanc sur `#FF5C1A` = 3.09:1 (échoue AA en texte normal). (A) garder le blanc de la charte, libellé 16 sp gras, exception acceptée ; (B) libellé `#1C1A17` sur orange (5.6:1) ; (C) assombrir le fond en `#C2410C` (5.2:1, écart à la marque). Recommandation : A pour la livraison (fidèle à `index.html`), B si l'accessibilité prime.
2. **Écraser le programme du coach** : A08 le permet avec confirmation écrite. Recommandation : oui, sinon l'atelier est inutilisable pour un athlète coaché ; le coach voit le changement côté CRM.
3. **Coût de l'atelier** : 1 crédit par message, avec recherche web incluse (maquette). Alternative : 2 crédits si un outil web est appelé. Recommandation : forfait unique 1 crédit tant que le budget 0,75 EUR/mois tient ; à vérifier avec `creditGate`.
4. **Créneaux du repas présélectionné** (05-10 / 11-14 / 15-17 / 18-22, sinon dernier repas utilisé) : valider ou ajuster.
