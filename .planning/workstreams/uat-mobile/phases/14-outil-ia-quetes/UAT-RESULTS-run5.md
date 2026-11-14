# P13 / P14 : resultats run 5 (Quetes, faux Anthropic, aucun appel reel)

| Critere | Verdict | Detail |
|---|---|---|
| Onglet Quetes : sections "Aujourd'hui · se renouvelle dans 9 h" / "Cette semaine" | PASS | Les 3 quetes de depart etaient presentes en base ; l'ecran n'affiche que la quete eau "Terminé · +15 pieces recuperees" + les quetes IA (les quetes de depart non terminees "Terminer une seance"/"S'entrainer 3 fois" passent `expired` des qu'une quete IA existe : migration 1402). |
| Progression apres un log d'eau reel (+pieces une seule fois) | PASS | Quick Log eau : accueil 2.38 L -> 2.6 L sans relance ; quete eau `completed`, `rewarded_at` inchange (une seule recompense). Progression figee a 2125 ml apres completion (par conception). |
| `quests_create` via faux Anthropic | PASS | `[[tool:quests_create {...}]]` : `success:true`, `free_slots_left` 1 puis 0 ; ecran mis a jour. |
| Garde-fou : 3 quetes actives max | PASS | 3e creation : `max_active_quests` (`active_count:3`, `max_active:3`) avec hint francais. |
| Quete expiree = "Non terminee · aucune penalite" | PASS | Visible dans "Non terminees" (captures non gardees : dump uiautomator). Condition de visibilite : une quete IA expiree est MASQUEE des qu'une quete IA plus recente est active/terminee (`20261201140200...sql:96-101`), pas seulement la meme portee ; l'utilisateur ne voit donc pas toutes ses quetes expirees (ecart a confirmer avec la maquette). |
| Quete creee a 21 h | NON-TESTE | (seed `period_start` non rejoue ; creation a 14 h UTC : `expires_at` = +24 h exact) |
