# UAT-PLAN Phase 21 : Social et Amis (SOC-01..08)

Emulateur Android `ziko-uat-1`, file unique, apres P1. Deux comptes obligatoires.

## Pre-requis (orchestrateur)
1. **Athlete B** : le seed de P1 ne crée qu'un athlete + un coach (HARN-03). L'orchestrateur AJOUTE un second athlete de test "B" au seed (email + mot de passe hors repo, reinitialisable), avec un nom distinctif (ex. `Marco Delmas`, handle `marcod`) et un niveau/XP/serie/badges/séances/records connus (pour PR-4). Athlete A = le compte existant. Lier au minimum un défi en commun (A et B participants) pour PR-2.
2. **Migrations** (fichiers seulement, jamais appliquees par l'agent), dans l'ordre, sur la **branche de test** :
   `20261201210100_friendships_integrity.sql`, `20261201210200_friend_rpc.sql`, `20261201210300_public_profile_rpc.sql`.
   Production : seulement apres accord utilisateur ET comptage en lecture seule des doublons (requete en tête de `20261201210100`, résultat à montrer à l'utilisateur).
3. `npm run test:rls` (backend/api) avec `friendships.spec.ts` sur la base de test migrée.
4. Build dev-client avec les variables de la base de test (pas de prod).

## Scénarios (A = compte principal, B = athlete B)
| Id | Étapes | Attendu / mesure |
|---|---|---|
| AM-1 | Ouvrir Communauté > Amis | Champ `Rechercher un pseudo ou un nom` = 1er élément focalisable sous le titre (y < 140 dp, arbre uiautomator) ; aucun bouton `Rechercher` ; l'icône `person-add` de la barre ouvre le partage du lien (pas une recherche) |
| AM-2 | Taper `ma` puis effacer | Liste mise à jour < 500 ms sans appui ; compteur `N résultats` ; la croix restaure la liste d'amis ; 1 caractère = liste inchangée |
| AM-3 | A cherche B (global puis Amis), `Ajouter` | Ligne -> `Envoyée`, toast `Demande envoyée à <Nom B>` ; A > En attente > Envoyées contient B ; B > En attente > Reçues contient A, badge de l'onglet = 1 ; en base : 1 seule ligne `pending` |
| AM-4 | Mode avion, `Ajouter` | Bandeau `Demande non envoyée` + `Réessayer`, ligne revenue à `Ajouter`, 0 ligne en base ; réseau rétabli + `Réessayer` = envoi |
| AM-5 | B : Reçues `Accepter` ; A : Envoyées `Annuler` sur une autre demande | Listes et badge mis à jour sans relance ; états cohérents des deux côtés |
| AM-6 | Pour chacun des 4 états (none, sent, received, friend) comparer ligne de résultat et profil du même compte | Même état (`Ajouter`, `Envoyée`/`Demande envoyée`, `Accepter`, `Ami`) ; mot + icône |
| AM-7 | Recherche texte dans l'arbre d'accessibilité sur tous les écrans Amis/profil/recherche globale | Aucune séquence `\u` ; toast = `Demande envoyée à ...` |
| Course | A et B s'ajoutent presque simultanément | 1 seule ligne, acceptée (RPC) ; jamais 2 lignes croisées |
| PR-1 | Profil d'un ami, d'un inconnu, demande envoyée, reçue | Avatar (88 dp) entièrement visible, bords >= 0 dp, non recouvert ; bouton d'état visible, hors zone de recouvrement ; bannière 112 dp ne coupe aucun contrôle ; bounds uiautomator |
| PR-2 | Profil ami défilé | 9 blocs : objectif, amis/abonnés, niveau+XP (`N XP avant le niveau M`), série, badges (4 + `Voir les N`), derniers entraînements (3), records (3), défis en commun (2 max ou état vide), `Retirer des amis` |
| PR-3 | Libellé d'objectif | 0 `_` (`prise de muscle`, pas `muscle_gain`) |
| PR-4 | Comparer les valeurs à la base de B | niveau, XP, série, records (meilleure charge par exercice), badges obtenus = valeurs en base ; aucun poids/taille/âge nulle part |
| PR-5 | Profil en mode avion | Carte `Profil indisponible` + `Réessayer`, aucun contenu partiel |
| SEC | Compte A tente (via client) de s'auto-accepter | Refusé (RLS) ; `npm run test:rls` couvre aussi insertion `accepted` et UPDATE par un tiers |
| Retrait | Profil ami > `Retirer des amis` | Confirmation `showAlert` ; après confirmation : `Ajouter` et ligne supprimée |

## Points à valider visuellement (déviations connues, voir 21-SUMMARY)
Boutons `Message` / `Comparer` / `Cadeau` ajoutés sur le profil d'un ami (déplacés de la liste, absents des maquettes) ; badges en icônes Ionicons par palier (l'`icon` en base est un emoji) ; objectif = mapping XCUT-01 en minuscules (`santé générale`, `perte de gras`).
