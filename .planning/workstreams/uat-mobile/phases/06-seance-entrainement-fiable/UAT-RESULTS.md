# UAT-RESULTS P6 (run2, 2026-11-13) - cumul run1 (A PASS, C PASS)

| Id | Verdict | Detail |
|---|---|---|
| B, D, E, F | NON-TESTE | contexte epuise avant les flows seance. |
| Obs. | | Apres activation du programme coach (voir P7) la carte "Mission du jour" de l'accueil disparait (jour non planifie ?) : a verifier. Noms d'exercices bruts anglais toujours visibles dans l'ecran programme ("3/4 sit-up", "Assisted lying calves stretch") : XCUT-06 connu, fix/uat-run1. |

## Run3 (2026-11-13, branche uat/run3) - a lire apres UAT-RESULTS.md
| Id | Verdict | Detail |
|---|---|---|
| B bouton page programme | PASS | Onglet Seance : bouton fixe "Demarrer la seance d'aujourd'hui · Lower" (vendredi) ; ecran ouvert = "Lower", "8 exercices", apercu des 8 exos (`uat-evidence/06/B-start.png`). |
| D semaine type | PASS | 7 lignes L..D : L Full Body Power, M(ardi) Repos, M(ercredi) Upper, J Repos, V Lower, S Repos, D Repos (4 repos / 3 seances) (`06/D-semaine.png`). Jours explicites non testes. |
| E detail depuis Recent | PASS (accueil) | Accueil > Recent > "UAT Seance S1" : DUREE 50 min / VOLUME 1.00 t / SERIES 4 / EXOS 1 + liste exos/series (`06/E-detail.png`). Ecart : VOLUME recalcule depuis les series (1 t) alors que la fixture portait 3000 kg. Retour et "Seances recentes" : NON verifies. |
| F seance rapide | PARTIEL (statique) | Mode libre impossible a ouvrir (seance guidee "Lower" persistee dans le store apres relance). Lecture de `apps/mobile/app/(app)/workout/session.tsx` : Ionicons `barbell-outline` (l.1526/1641), "Terminer", "Poids (kg)" ; aucun emoji U+1F3xx ; glyphes "✓" l.1109/1114 avec texte ANGLAIS "Min reached!/Target reached!". |
| Obs. | | Semaine type : noms bruts anglais ("3/4 sit-up") vs apercu seance en francais : XCUT-06 connu. |

## Run 6 (2026-11-13, uat/run6)
- A (Allez c'est parti) PASS
- C (Terminer sans serie + variante 1 serie) PASS
- Sauvegarder & fermer : FAIL critique, Unmatched Route (summary.tsx:63 route (tabs) inexistante ; summary.tsx:31 replace au rendu)
- Ecarts : seance nommee 'A', '1 series completees', 'HIGHLIGHT' EN, seance ouverte restante apres 2e demarrage
- B, D, E, F, mode libre : NON-TESTE
Detail : ../../UAT-RESULTS-run6.md
