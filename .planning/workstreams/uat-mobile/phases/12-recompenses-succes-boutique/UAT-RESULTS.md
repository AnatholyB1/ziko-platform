# UAT-RESULTS P12 (run2, 2026-11-13). Policy badge connue manquante : fixture `badge_definitions_read_uat` en place -> "5 sur 12".
| Id | Verdict | Detail |
|---|---|---|
| R-1 | PASS | 4 onglets Niveau/Succes/Boutique/Quetes, puce "Solde : 480 pieces" = `coins`. |
| R-2 | PASS partiel | "5 sur 12 debloques", lignes "Badge UAT n : 0 sur N" (seed generique, pas les 11 succes reels). |
| R-3/R-4/R-5/R-8/R-10/Q6-Q8/A11Y/MOT | NON-TESTE | (boutique seed : Titres 0, Badges 0, Themes 4, Bannieres 0). |
| R-6 | PASS partiel | Apercu theme : "Prix 50 / Solde apres achat 430 pieces". Cas pieces insuffisantes non rejoue. |
| R-7 | PASS | "Acheter pour 50 pieces" -> 480 -> 430, base -50 source `purchase`. Toast non capture. |
| R-9 | PASS | Historique : "Achat : Article UAT 1 / aujourd'hui / -50", ordre antechronologique, UI sans emoji. FAIL mineur donnee : `ziko_coin_transactions.description` contient un emoji (panier) ecrit par la fonction SQL d'achat, masque par l'UI. |
FAIL persistant : onglet Niveau "NIVEAU . DEBUTANT / 3 / 350 XP / Niveau maximum atteint" pour le niveau 3 (libelle incoherent, deja note run1 #7).

## Run 10
Quete eau en UI : PASS (progression + +15 une fois, sans ouvrir Recompenses). Voir UAT-RESULTS-run10.md.
