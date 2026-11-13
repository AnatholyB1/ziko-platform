# UAT-RESULTS P17 (run2, 2026-11-13)

| Id | Verdict | Detail |
|---|---|---|
| Etat vide | PASS | "Aucune nuit enregistree - Note ta nuit a la main en 20 secondes, ou connecte une montre..." + "Logger ma nuit" / "Connecter une source". |
| Saisie manuelle | PASS | Coucher 23:00, Lever 07:00, "Duree de la nuit : 8 h", qualite 1-5 ; Enregistrer -> "NUIT DU 12 AU 13 NOV. - SAISIE MANUELLE - 8 h - 23:00 -> 07:00 - 4 / 5" ; base : `source=manual`, `duration_hours=8.00`, `quality=4`. Texte honnete "Les phases ne s'affichent qu'avec une montre ou une app connectee." |
| Accueil | PASS | Tuile Sommeil "8 h . qualite 4 / 5". |
| Historique/Reglages/rappel | NON-TESTE | (graphe "7 dernieres nuits / Moyenne 8 h" visible). |
