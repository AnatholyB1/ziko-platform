# P21 : resultats run 5 (VRAI login B, `uat-athlete-b`)

Mot de passe de B reinitialise sur la branche via l'API admin (identifiants dans `.uat/env` : `UAT_ATHLETE_B_*`, jamais affiches). Demande A->B remise a `pending` par REST puis restauree.

| Critere | Verdict | Detail |
|---|---|---|
| AM-3 cote B : Recues contient A, badge = 1 | PASS | Onglet "En attente 1", ligne "UAT Athlete", boutons Accepter/Refuser. |
| AM-5 B accepte | PASS | Liste/badge mis a jour sans relance (Amis 1, Recues 0), `status=accepted`. |
| PR-1/PR-2 profil d'un ami | PASS | Avatar, bouton "Ami", "Objectif : force", 1 ami, Niveau 3 / 353 XP, "aucune serie", badges 4 + "Voir les 5", 3 derniers entrainements, records (Squat saute 135 kg, Crunch 50 kg), "Defis en commun" etat vide, boutons Message/Comparer/Cadeau + Retirer des amis. Aucun poids/taille/age. Ecart maquette : "Niveau 3" alors que `ziko_athlete_state.level=5` (autre source de niveau a confirmer). |
| Profil prive, non-ami (`is_public=false`) | PASS (pas de fuite), ecart UX | Nom + 0 amis/0 abonnes + "Pas encore de niveau", "Aucun badge", "Aucun entrainement termine", "Aucun record" ; pas de mention "Profil prive" (les etats vides laissent croire a un profil vide). Pas d'objectif affiche. |
| Etat "Ajouter" -> "Demande envoyee" (profil) | PASS | Libelle "Demande envoyee a ... appuyer pour annuler", 1 ligne `pending` B->A. |
| AM-1/2/4, PR-5, Course, Retrait, cadeaux | NON-TESTE | |
