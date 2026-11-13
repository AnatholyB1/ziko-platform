# UAT-RESULTS P17 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| Etat vide | PASS | "Aucune nuit enregistree - Note ta nuit a la main en 20 secondes, ou connecte une montre..." + "Logger ma nuit" / "Connecter une source". |
| Saisie manuelle | PASS | Coucher 23:00, Lever 07:00, "Duree de la nuit : 8 h", qualite 1-5 ; Enregistrer -> "NUIT DU 12 AU 13 NOV. - SAISIE MANUELLE - 8 h - 23:00 -> 07:00 - 4 / 5" ; base : `source=manual`, `duration_hours=8.00`, `quality=4`. Texte honnete "Les phases ne s'affichent qu'avec une montre ou une app connectee." |
| Accueil | PASS | Tuile Sommeil "8 h . qualite 4 / 5". |
| Historique/Reglages/rappel | NON-TESTE | (graphe "7 dernieres nuits / Moyenne 8 h" visible). |

## Run 7 (2026-11-13, branche uat/run7, compte athlete A)
| Id | Verdict | Preuve |
|---|---|---|
| SL-1 etat vide | PASS | `Aucune nuit enregistree`, `Logger ma nuit`, `Connecter une source` presents; 0 `8h00/score/profond/leger/REM` dans l'arbre (uat-evidence/run7/p17-empty.png) |
| SL-2 saisie 23:15->07:00, q4, 1 reveil | PASS | ecran `7 h 45`, `4 / 5`; accueil `7 h 45 · qualité 4 / 5`; base 1 ligne manual 7.75 |
| SL-2b re-saisie | PASS | message `Une nuit est déjà saisie pour cette date : elle sera modifiée.`, champs pre-remplis |
| SL-6 > 16 h | PASS | `Cette nuit dure 16 h 15. Vérifie le coucher et le lever (maximum 16 h).`, Enregistrer sans effet (base inchangee 7.75) (p17-16h.png); duree differente du plan (steppers 15 min) |
| SL-7 qualite obligatoire | PASS | Enregistrer sans qualite : 0 ligne creee |
| SL-3/4/5/8/9/11 | NON-TESTE | budget |
