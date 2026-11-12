# Phase 8 - SUMMARY (Accueil & Quick Log)

Branche `phase/08-accueil-quick-log` (base `milestone/v1.20`). Mobile seulement ; aucune migration (D-05 : non necessaire).

## Causes racines trouvees
1. **Eau/poids/humeur** passaient par `fireAndForget` vers les outils IA backend : `invalidateQueries` partait avant la fin de l'insert (tuile "0.00L" apres +250), erreurs avalees, et `today()` backend = date **UTC** alors que la lecture est en date locale (decalage pres de minuit).
2. **Humeur** : `context: 'afternoon'` viole le CHECK de `ziko_journal_entries` (pre_workout|post_workout|morning|evening|general) -> echec silencieux de 12h a 18h.
3. **Statut "logue"** = etat local 2 s : jamais persiste, jamais 1/jour.
4. **Score** : moyenne fixe de 4 composantes avec "jour de repos" a 100 et le reste a 0 -> "0" trompeur sans donnees.

## Livre
- `apps/mobile/src/lib/quickLog.ts` : logWater, saveTodayWeight/getTodayWeight, saveTodayMood/getTodayMood (select puis update/insert = 1 par jour, date locale), parseWeightInput (20-400 kg, virgule), computeFormScore (formule documentee dans le fichier).
- `apps/mobile/src/hooks/useQuickLog.ts` : statut du jour lu en base (cle de requete incluant la date locale).
- `apps/mobile/app/(app)/index.tsx` (edits localises) : ecritures directes Supabase (RLS own), eau optimiste + rollback + `showAlert`, tuile eau = total du jour (maquette), poids/humeur `✓ logué` persistants, feuille poids prerempli, tuile repas + kcal du jour, carte score avec etat vide (texte + bouton), feuille humeur en Ionicons (emoji retires), "J'applique" hydratation reutilise le meme chemin.

## Formule du score (D-04)
Moyenne des composantes avec donnees : sommeil (h/8), eau (ml/2500), nutrition (kcal/2200), charge (100 si seance faite ou objectif hebdo atteint ; sinon absente). Aucune composante -> etat vide.

## Exigences
| Id | Statut | Preuve |
|---|---|---|
| QLOG-01 | PARTIAL | tests logWater/sumWaterMl/formatLitres (somme sans limite, date locale, erreur propagee) ; affichage non vu sur emulateur |
| QLOG-02 | PARTIAL | tests : 1er insert, 2e update, persistance par relecture, lendemain vide, bornes ; UI non vue |
| QLOG-03 | PARTIAL | tests idem + context conforme au CHECK pour 24 h ; UI non vue |
| QLOG-04 | PARTIAL | kcal via `useNutritionToday` existant ; route `nutrition/log` inchangee ; non vu emulateur |
| QLOG-05 | PARTIAL | tests computeFormScore (vide/null, moyenne, plafond, repos) ; rendu etat vide non vu |

## Tests / gate
- `apps/mobile` vitest : 17 tests nouveaux (quickLog) verts ; `tsc --noEmit` mobile propre (voir bas de fichier pour le gate final).
- UAT emulateur : `08-UAT-PLAN.md` (U1-U18, criteres mesurables), NON executes.

## NON prouve
- Rendu reel (tuiles, carte vide, feuilles), keyboard avoidance de la feuille poids, comportement au changement de jour/minuit app ouverte (la cle de requete change au re-render ; pas de timer minuit).
- RLS reelle de `ziko_body_measurements`/`ziko_journal_entries`/`ziko_hydration_logs` pour insert/update depuis le client mobile (policy "own" supposee d'apres migration 012 ; a confirmer sur base de test). Le mock ne prouve ni RLS ni contraintes SQL.
- Pas d'index unique : deux appareils loguant simultanement pourraient creer 2 lignes ; l'affichage prend la plus recente. Index unique partiel possible plus tard (necessite dedoublonnage des donnees prod, non verifie).

## Dette notee (hors perimetre mobile)
Outils backend `hydration_log`, `measurements_log`, `journal_log_mood` utilisent `today()` UTC (+ journal sans update 1/jour) : a corriger cote backend/IA si l'IA doit loguer ces valeurs (P11/P15/P22 proprietaires).

## Conflits probables
`apps/mobile/app/(app)/index.tsx` avec P5/P6 (edits localises ailleurs ; mes zones : imports, bloc score, handlers QuickLog, tuiles, feuilles). `fireAndForget` n'est plus utilise dans ce fichier (laisse en place pour limiter les conflits).

## Gate final (apres merge de milestone/v1.20, sans conflit)
`tsc --noEmit` mobile : 0 erreur. `vitest run` mobile : 6 fichiers, 103 tests verts (dont 17 quickLog). Lint mobile = no-op. Backend/web non touches.
