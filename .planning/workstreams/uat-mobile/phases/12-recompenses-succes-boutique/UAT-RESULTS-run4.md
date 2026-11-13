# P12 Recompenses : UAT run 4

| Critere | Resultat | Preuve |
|---|---|---|
| Succes = "5 sur 12" SANS policy de fixture | PASS | policy `badge_definitions_read_uat` supprimee de la branche avant le test (reste `ziko_badge_definitions_select_authenticated`, migration 1203) ; onglet Succes : "5 sur 12 debloques", "42 %" ; tableau de bord : "5 / 12 Succes debloques" ; `uat-evidence/run4/p12-succes.png` |
| Boutique / Mes objets chargent apres 2701 | PASS | `(plugins)/gamification/shop` : onglets Titres/Badges, solde 500446 affiche |
| Cadeaux apres 2701 | NON-TESTE | |
| R-3, R-5, R-8, R-10 | NON-TESTE | |

Seed : le bloc `badge_definitions_read_uat` est retire de `scripts/uat/seed-v1-20.sql` (la prod/branche n'en a plus besoin).
