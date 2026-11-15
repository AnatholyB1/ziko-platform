# P7 Programmes IA : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Dashboard avec `program_data.weeks` en TABLEAU | PASS | programme "Pic de force 8 sem" (8 semaines x 3 seances) active depuis la Bibliotheque : "Programme actif - Semaine 1/8 - 0/24 seances", plus de plantage ; "Bloc de volume" (2 semaines) : "Semaine 1/2 - 0/4 seances" |
| Activation unique | PASS | SQL apres 2 reactivations successives : un seul `is_active=true` (Bloc de volume), les 2 autres `false` ; confirmation "Un seul programme est actif a la fois. En activer un autre met l'actuel en pause." |
| Ecrasement du programme coach avec confirmation | NON-TESTE | athlete sans lien coach actif (retire par MC-8) ; a rejouer avec un programme coach actif |
| Nom du programme dans le dashboard/bibliotheque | FAIL (mineur) | affiche "Programme 13/11/2026" au lieu de "Bloc de volume" / "Pic de force 8 sem" : `plugins/ai-programs/src/screens/AIProgramsPlugin.tsx:37` lit `program_data.name`, jamais la colonne `ziko_ai_generated_programs.name` (les programmes d'atelier la renseignent seulement en colonne) |
| Statut "Termine - 100 %" sur programmes jamais demarres | FAIL (mineur) | Bibliotheque : "Pic de force" (started_at null) et "UAT Full Body Power" affiches "Termine - 100 % - 8 sem" |
| Reactivation d'un programme clos | FAIL (mineur) | `completed_at` reste renseigne apres reactivation de "Bloc de volume" (`is_active=true` + `completed_at` non nul) : le bandeau "Programme termine" (P24) continue de s'afficher sur un programme actif |

Captures : `uat-evidence/run4/p7-biblio.png`.
