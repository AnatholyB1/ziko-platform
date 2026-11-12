# Phase 19 : plan UAT émulateur (SU-1 à SU-6)

Prérequis (humain/orchestrateur) : les 3 migrations `202612011901` à `202612011903` appliquées sur la base de test/portfolio (jamais par l'agent) ; athlète de test du harnais P1 (compte neuf = stack vide) ; build dev-client ; plugin Compléments installé (niveau >= 4). Réseau actif (catalogue = Supabase direct). Verrou machine `.planning/.machine-lock` pris pour la session émulateur.

Les `testID` ci-dessous existent dans le code : `supp-search`, `supp-result-count`, `supp-product-<id>`, `supp-price-<id>`, `supp-filter-pill-marque|catégorie`, `supp-filter-brand-<id>`, `supp-filter-cat-<id>`, `supp-filter-apply`, `supp-filter-clear`, `supp-load-more`, `supp-offer-<i>`, `supp-offer-link-<i>`, `supp-scrape-date`, `supp-add-to-stack`, `supp-dose-stepper`, `supp-moment-morning|noon|evening`, `supp-stack-save`, `supp-stack-row-<id>`, `supp-stack-edit-<id>`, `supp-stack-count`, `supp-progress`, `supp-intake-<id>-<moment>`, `supp-reminder-switch-<moment>`, `supp-reminder-time-<moment>`.

| Id | Flow | Attendu | Preuve à capturer |
|---|---|---|---|
| SU-1 | Ouvrir Compléments | Exactement 4 onglets : Aujourd'hui, Mon stack, Catalogue, Rappels, dans cet ordre | dump d'accessibilité (`adb shell uiautomator dump`) |
| SU-2 | Catalogue : défiler 100 produits (`Afficher plus` x4, 30 par page) ; chercher un produit sans prix | 0 occurrence de `NaN`, `undefined`, `null`, `0,00 €` dans le dump texte ; produit sans prix = `Prix indisponible` ; prix valides = `dès NN,NN €` | dump texte complet + grep ; capture |
| SU-3 | Ouvrir Marque puis Catégorie, cocher 2 marques + 1 catégorie ; lire `Afficher N produits` ; appliquer | le compteur `supp-result-count` après application = N du bouton | 2 captures + comparaison |
| SU-4 | Depuis 3 produits différents (dont un sans offre) : ouvrir la fiche | section `Comparer les prix` présente ; offres triées prix croissant ; `MEILLEUR PRIX` sur la moins chère en stock ; `Prix non communiqué` non cliquable ; `Voir l'offre` ouvre le navigateur (intent VIEW) ; date `Prix relevés le ...` | captures + `adb shell dumpsys activity activities` (intent navigateur) |
| SU-5 | Compte neuf : Mon stack = état vide `Ton stack est vide`. Fiche produit > `Ajouter à mon stack` : dose 2, moments Matin + Soir, enregistrer | produit dans Mon stack (`2 gélules · Matin, Soir`) et dans Aujourd'hui aux 2 créneaux ; cocher une prise = `1 sur 2 pris` ; retirer = retour à l'état vide | requête base lecture seule (`ziko_user_supplement_stack`, `ziko_supplement_intakes`) + captures |
| SU-6 | Rappels : activer Matin (accepter la permission), régler 08:15 ; Midi activé sans produit ; Soir désactivé | `adb shell dumpsys notification` : 1 notification planifiée à 08:15 (identifiant `ziko-supplements-morning`), 0 pour Midi (créneau vide), 0 pour Soir ; changer l'heure reprogramme à +-1 min ; permission refusée = bandeau + interrupteurs désactivés | `dumpsys notification` avant/après |

Cas négatifs à tester : couper le réseau sur le Catalogue (message `Catalogue indisponible` + `Réessayer`, pas d'écran blanc) ; recherche `magnesiumm` (état C18 `Aucun produit pour « magnesiumm »`, bouton `Effacer la recherche`) ; ouvrir la fiche d'un produit supprimé (`Produit introuvable`).

Données de test : le catalogue réel (1 624 produits) suffit ; pour le produit sans prix, choisir un produit dont `ziko_supplement_prices` est vide (requête lecture seule).
