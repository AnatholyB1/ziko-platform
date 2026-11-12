# Phase 9: Ajout de repas en un écran - Context

**Gathered:** 2026-11-12 (voie DISCUSS, agent w2a). Req : NUTR-01..04. Vague 2 (apres P8, deja livre sur sa branche). UI hint oui : le **contrat du lot A** (`lot-A/DESIGN-CONTRACT.md`, ecrans A16-A21, criteres M-1..M-5) tient lieu de UI-SPEC.
**Statut :** pret pour planification ; `[A CONFIRMER]` = reponse recommandee retenue.

<domain>
## Phase Boundary

Depuis la tuile Repas, un seul tap ouvre un ecran unique : repas presélectionné selon l'heure, derniere methode memorisee, repas du jour visibles, 4 methodes (Chercher, Photo, Code, Manuel) sans changer d'ecran. Hors perimetre : Pantry (P10), tuile accueil (P8, deja faite : `router.push('/(app)/(plugins)/nutrition/log')` conserve), objectifs caloriques/TDEE, historique nutrition.
</domain>

<decisions>
## Implementation Decisions

### Decides (maquette lot A + recap, ne pas redemander)
- **D-01** NUTR-01 : un seul ecran `nutrition/log` ; recap kcal/macros du jour en haut (colonnes libelle/valeur), segment des 4 methodes, barre d'action collante avec total et `Ajouter N aliments`. Critere M-1 : aucun 2e ecran avant l'ajout ; ajouter un aliment cherche <= 4 taps (ouvrir, taper le nom, choisir, ajouter).
- **D-02** NUTR-02 : repas presélectionné par creneau horaire (05-10 petit-dej, 11-14 dejeuner, 15-17 collation, 18-22 diner ; hors creneau = dernier repas utilise) ; message `Dejeuner suggere d'apres l'heure (12:40). Tu peux changer.` ; coche verte sur un repas deja logue. **Derniere methode utilisee memorisee** et rappelee a la reouverture (`Derniere methode utilisee : Chercher`). Critere M-2 (horloge emulateur + relance).
- **D-03** NUTR-03 : bloc `Deja ajoute aujourd'hui` (A17) = liste des `ziko_nutrition_logs` du jour (date locale), recap kcal = somme des repas (M-3) ; etat A18 "Rien n'a encore ete ajoute aujourd'hui." au premier repas.
- **D-04** NUTR-04 : les 4 methodes dans le meme ecran (M-4). Photo (A19) = cadre camera + estimation IA ; Manuel (A20) 5 champs, focus bord 2 dp primaire ; code-barres introuvable -> issue vers Manuel (A21) ; hors-ligne : la saisie manuelle reste utilisable (M-5).
- **D-05** Etats transverses : "Aucun aliment pour 'xxx'. Saisis-le a la main." + bouton Manuel ; 3 lignes squelette pendant la recherche. Charte standard (Ionicons, inline, `showAlert`, `paddingBottom: 100`).

### Zones grises : reponse recommandee retenue `[A CONFIRMER]`
- **D-06 [A CONFIRMER] Panier multi-aliments.** Le contrat impose `Ajouter N aliments` + total (A16 : 1 element selectionne, 640 kcal). Aujourd'hui `LogMealScreen.tsx` insere **un seul aliment puis `router.back()`**. Recommandation : etat local `basket[]` (aliment + grammes), ecriture **groupee** `insert([...])` d'un seul appel sur `ziko_nutrition_logs` (meme `meal_type`, `date` locale), puis retour. Pas de migration.
- **D-07 [A CONFIRMER] Memorisation de la derniere methode / du dernier repas** : cote client, sans table. Persister `lastMethod` + `lastMealType` avec le mecanisme de persistance deja utilise par l'app (`zustand` `persist` ; `userPrefsStore.ts` utilise `AsyncStorage` alors que CLAUDE.md annonce MMKV : suivre le mecanisme deja present dans le plugin nutrition, ne pas en introduire un 3e). Bloc de migration `20261201 0901-0909` **inutilise**.
- **D-08 [A CONFIRMER] Creneaux horaires** du contrat (critique lot A Q4) valides tels quels ; heure = heure locale du telephone ; hors creneau (22h-05h) = dernier repas utilise, sinon `snack`.
- **D-09 [A CONFIRMER] Recents sans favoris (question Q4).** A17 montre "recents/favoris". Recommandation : **Recents seulement**, derives des 14 derniers jours de `ziko_nutrition_logs` (`food_name` distincts, plus frequents/recents en tete), sans table. Les favoris persistes (table `ziko_food_favorites`, bloc 0901) sont reportes.
- **D-10 [A CONFIRMER] Cout affiche de la methode Photo (question Q3).** Le contrat ecrit `1 credit IA par analyse` (A19) mais `backend/api/src/config/credits.ts` donne `CREDIT_COSTS.scan = 3` (1 scan gratuit/jour + 2 bonus d'activite, `DAILY_QUOTAS.scan`). Recommandation : afficher le cout **reel** lu depuis la config (3 credits ; premier scan du jour gratuit selon `creditStore`), pas un chiffre en dur. Le gate (`creditCheck('scan')` / `creditDeduct('scan')` sur `POST /ai/vision/nutrition`) ne change pas.
- **D-11 [A CONFIRMER] Gain de credit "repas"** : `earnCredit(supabase, 'meal', id)` est appele aujourd'hui apres CHAQUE insertion. Avec un panier : un seul appel par ajout groupe (cle = id du premier log), pour ne pas multiplier les gains ; plafonds journaliers existants inchanges.
- **D-12 Date** : ecriture et lecture sur la **date locale du jour** (meme helper que `localDateKey` de `useHomeData.ts` / `quickLog.ts` de P8), pas `selectedDate` du store (qui peut etre une autre date) ; si l'ecran est ouvert depuis une date passee du dashboard, la date passee est conservee et signalee dans l'en-tete. A trancher au plan, par defaut = aujourd'hui.
- **D-13 Invalidation** : apres insertion, invalider `['nutrition','today',userId]` (tuile accueil P8) et la liste du jour ; kcal de l'accueil et de l'ecran identiques (M-3).
</decisions>

<specifics>
## Specific Ideas
Scripts UAT : horloge emulateur a 08:15 / 12:40 / 16:00 / 20:30 puis relance ; mode avion pour M-5 ; compter les taps (M-1). Sources de recherche : `ziko_food_database` (limit 30) et `utils/offApi.ts` pour le code-barres.
</specifics>

<canonical_refs>
## Canonical References
- `phases/04-maquettes-reference/lot-A/DESIGN-CONTRACT.md` §1 (Repas), §2 (A16-A21), §3 (microcopy), §5 (M-1..M-5) ; `lot-A/03-repas.html` ; `lot-A/CRITIQUE.md` Q1 (orange d'action), Q4 (creneaux) ; `../shared/DESIGN-SYSTEM.md`
- `REQUIREMENTS.md` NUTR-01..04 ; `ROADMAP.md` Phase 9 ; `MILESTONE-RECAP-2026-11-12.md` §5
- `phases/08-accueil-quick-log/08-SUMMARY.md` (tuile repas, kcal du jour, `useNutritionToday`, date locale) ; `08-CONTEXT.md`
- `backend/api/src/config/credits.ts` (CREDIT_COSTS, DAILY_QUOTAS) ; `backend/api/src/middleware/creditGate.ts`
- `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (`ziko_nutrition_logs` : `meal_type` CHECK breakfast|lunch|dinner|snack)
</canonical_refs>

<code_context>
## Existing Code Insights
- `plugins/nutrition/src/screens/LogMealScreen.tsx` (763 l.) : **a deja** un segment 4 onglets `search | scan | barcode | custom` et un `mealType`, mais `mealType` demarre en dur sur `'breakfast'`, aucune liste du jour, un aliment = un insert + `router.back()`, gain de credit par insertion.
- `plugins/nutrition/src/screens/NutritionPlugin.tsx` (765 l.) : dashboard ; `plugins/nutrition/src/store.ts` : `addLog`, `selectedDate`, `calorie_goal` etc. (reglages dans `ziko_user_plugins.settings`).
- `apps/mobile/src/hooks/useHomeData.ts` : `useNutritionToday` (kcal du jour, cle `['nutrition','today',userId]`).
- `apps/mobile/app/(app)/(plugins)/nutrition/log.tsx` : route mince.
- `plugins/nutrition/src/utils/offApi.ts` : Open Food Facts.
- Vision : `POST /ai/vision/nutrition` (credit `scan`, modele `VISION_MODEL`).
### Integration Points
`packages/plugin-sdk/src/i18n.ts` : namespace `meal.*` ajoute a la fin. `apps/mobile/app/(app)/index.tsx` : aucun changement (tuile P8). Aucun `registry.ts`.
### Migrations
Aucune par defaut (bloc `20261201 0901-0909` reserve, inutilise). Seule exception : favoris persistes si la reponse a Q4 change.
</code_context>

<deferred>
## Deferred Ideas
Favoris persistes ; repas types / recettes enregistrees ; edition ou suppression d'un repas deja logue depuis cet ecran (a evaluer, non exige par NUTR-01..04) ; objectifs macros par repas ; integration Pantry (decrement des stocks au log) = P10 si demande.
</deferred>

---
*Phase: 09-ajout-repas-un-ecran*
*Context gathered: 2026-11-12*
