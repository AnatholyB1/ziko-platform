# P7 : resultats run 5

| Critere | Verdict | Detail |
|---|---|---|
| Nom du programme (colonne `name`) | PASS | Dashboard "Programme actif : Bloc de volume", bibliotheque "Pic de force 8 sem", "UAT Full Body Power" (plus de "Programme 13/11/2026"). |
| Statut "Pas encore demarre" | FAIL | "UAT Full Body Power" (jamais demarre, `completed_at` null) affiche "En pause · 0 % · 8 sem" au lieu de "Pas encore demarre". Le programme actif termine (`completed_at` non nul) affiche "En cours" dans la bibliotheque mais "Termine · 100 %" apres avoir ete mis en pause (incoherence selon l'etat actif). |
| Reactivation + confirmation | PASS | "Reactiver ce programme" : alerte "Un seul programme est actif a la fois..." ; un seul actif apres confirmation (REST). |
| Reactivation remet `completed_at` a NULL (2901) | PASS | Verifie en base. |
| Ecrasement du programme coach (flow B/C/D) | PASS | Programme IA actif + "Reprendre ce programme" (coach) : alerte "Ton programme actuel sera mis en pause..." Remplacer/Annuler ; Annuler = aucune ecriture ; Remplacer = `Force 5x5, bloc 2` actif, les 3 programmes IA a `is_active=false`. Sans autre programme actif : activation SANS confirmation. |
| Accueil apres bascule coach | FAIL (a confirmer) | Accueil affiche "Aucun programme actif" alors que le programme coach est `is_active=true` (carte "Charge 1/4 seances" presente). Verifier la source de la carte accueil (programme coach `user_id` null + `assigned_to_user_id`). |
