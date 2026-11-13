# UAT-RESULTS P11 (run2, 2026-11-13)
| Id | Verdict | Detail |
|---|---|---|
| HY-1 | PASS partiel | +250 x2, +750 : 1 ligne par appui en base ; verrou <300 ms non rejoue. |
| HY-2/3/4/5/6/8 | NON-TESTE | (ecran Reglages present : objectif 2,0 L, +0,5 L jours de seance, Rappels desactives, verre 250 ml, cafe Oui a 50 %, bonus +500 ml). |
| HY-7 | PASS | Cafe 250 ml a 50 % -> ligne `amount_ml`=125. |
| HY-9 | PASS | Modal Objectif quotidien clavier ouvert : Enregistrer y=1565, haut clavier ~1695 (marge ~130 px). |
Incoherence objectif accueil 2.5 L vs ecran 2.0 L : connue (fix/uat-run1), toujours presente (pas encore mergee).

## Run 7 (2026-11-13)
| Id | Verdict | Preuve |
|---|---|---|
| HY-1 +250/+500/+750 + verrou | PASS | 1 ligne par appui; 3 appuis a 100 ms = 1 seule ligne (verrou ok) |
| HY-2 dimension des tuiles | **FAIL** | bounds uiautomator : 250 = [42,1287][229,1558] (187 px), 500 = 130 px, 750 = 130 px, hauteur 271 px (~103 dp, attendu 132 dp +-4) ; les tuiles ne s'etirent pas (flex:1 sans effet), pas de fond/bord de carte visibles, rangee collee a gauche, moitie droite vide (uat-evidence/run7/p11-tiles.png). Cause probable : `plugins/hydration/src/screens/HydrationPlugin.tsx:511-535` : `Pressable` avec `style` fonction/tableau (interop NativeWind v4) |
| HY-7 cafe 250 a 50 % | PASS | ligne 125 ml |
| HY-4 reglage taille de verre | PASS | 250 -> 300 ml; `ziko_hydration_settings.glass_ml=300` (1 ligne) |
| HY-8 bonus seance | PASS (indirect) | objectif `2,0 L + 0,5 L les jours de séance`, carte `/ 2.5L` |
| HY-3/5/6/9 | NON-TESTE | |
Ecart : jauge `12.1L / 2.5L` (point) vs reglages `2,0 L` (virgule).
