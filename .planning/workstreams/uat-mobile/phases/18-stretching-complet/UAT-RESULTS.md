# UAT-RESULTS P18 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| Bibliotheque | FAIL/BLOQUE puis PASS | A l'ouverture : "permission denied for table ziko_stretching_exercises". Cause : `supabase/migrations/202612011801_stretching_exercises.sql` cree la table + policies RLS mais AUCUN GRANT (relacl = postgres seul), contrairement aux migrations 1301/1302. A confirmer en prod (default privileges Supabase pouvant masquer) ; branche : GRANT de fixture applique (voir seed). Ensuite : 24 exercices, filtres Tous 24 / Dos 6 / Jambes 6 / Epaules 6 / Hanches 6, noms francais, duree/repetitions. |
| Routines | PASS partiel | "Aucune routine" + "Creer une routine" ; "La routine par defaut s'ajoute au debut de chaque seance...". Creation/lancement NON-TESTE. |
| Suivi | PASS partiel | "Aucune seance pour l'instant" + "Lancer une routine", compteurs 0. |
