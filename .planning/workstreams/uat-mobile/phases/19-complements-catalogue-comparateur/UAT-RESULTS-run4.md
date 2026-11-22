# P19 Complements : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| P19 s'ouvre (module natif expo-notifications) | PASS | `(plugins)/supplements/list` : 4 onglets Aujourd'hui / Mon stack / Catalogue / Rappels, aucun ecran d'erreur |
| Catalogue | PASS | 6 produits, recherche, filtres Marque / Categorie, prix "des 21,00 EUR" ; `uat-evidence/run4/p19-catalogue.png` |
| Comparateur de prix (fiche produit) | PASS | "Comparer les prix - 3 offres" : Shop UAT 3 MEILLEUR PRIX 0,68 EUR/jour 21 EUR, Shop UAT 1 0,74 EUR/j 23 EUR, Shop UAT 2 0,84 EUR/j 26 EUR ; "Prix releves le 12 nov." ; "Comparer avec d'autres produits (0/10)" |
| Stack : ajout (dose + moment) | PASS | feuille "Ajouter a mon stack" (dose 30 g, Matin/Midi/Soir, bouton actif apres choix) ; Mon stack : "1 produit - Complement UAT 1 - 30 g - Matin" avec Modifier/Retirer |
| Rappels | PASS (partiel) | un rappel par moment ; activation du rappel Matin : le selecteur d'heure apparait ; l'envoi reel d'une notification NON-TESTE ; texte "Un seul rappel par moment..." |
| Compare produits (selection multiple) | NON-TESTE | |

Aucun GRANT de fixture ajoute pour cette phase.
