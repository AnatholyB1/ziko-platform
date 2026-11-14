# Phase 10: Pantry utile et en français (Garde-manger) - Context

**Gathered:** 2026-11-12 (voie DISCUSS, agent w2a). Req : PANT-01..PANT-07. Vague 2 (apres P9). UI hint oui : le **contrat du lot B** (`lot-B/DESIGN-CONTRACT.md`, ecrans B14-B22, criteres P-1..P-5) tient lieu de UI-SPEC.
**Statut :** pret pour planification ; `[A CONFIRMER]` = reponse recommandee retenue.

<domain>
## Phase Boundary

Le module sert a cuisiner selon ce qu'on a et ce qu'il reste a manger : lieux (Frigo, Congelateur, Placard) qui filtrent la liste, fiche article, ajout manuel, scan code-barres qui preremplit, recettes IA tenant compte du contenu et des macros restantes, courses dynamiques + ajouts manuels, 0 mot anglais. Hors perimetre : saisie des repas (P9), nouvel outil IA de pantry, historique d'achats.
</domain>

<decisions>
## Implementation Decisions

### Decides (maquette lot B + recap, ne pas redemander)
- **D-01** PANT-01/04 : onglets `Inventaire`, `Recettes`, `Courses` ; puces de lieu avec compteur reel (Frigo, Congelateur, Placard) qui **filtrent la liste** (jamais une alerte systeme, P-1) ; toucher un article ouvre sa fiche (B15) ; peremption en badge texte (`EXPIRE DEMAIN`, `DANS 2 J`, `dans 9 j`). Etats B14, B21 (vide : `Ton garde-manger est vide`).
- **D-02** PANT-02/03 : ajout manuel (B16) ; **le scan d'un code-barres preremplit** le formulaire avec le bandeau `Prerempli depuis le code-barres. Verifie et complete.` ; la date de peremption reste a choisir ; code inconnu = message + saisie manuelle en 1 tap (B17/B18, camera refusee = `L'acces a la camera est desactive`). Criteres : au moins nom + quantite preremplis (P-3).
- **D-03** PANT-05 : recettes IA (B19) = rappel `Il te reste aujourd'hui` (kcal + macros restantes) en haut, bouton `Generer des recettes · N credit(s)`, chaque proposition indique combien d'ingredients sont disponibles et ce qui manque ; la requete serveur contient les macros restantes (P-4).
- **D-04** PANT-06 : Courses (B20/B22) en 2 groupes : `Il manque dans ton frigo` (auto, avec la raison) et `Ajoutes par moi` ; cocher = pret a ranger ; barre `Ranger N article(s) dans le garde-manger` ; ranger deplace vers l'inventaire (P-5). Etat vide `Rien a acheter`.
- **D-05** PANT-07 : aucun mot anglais visible (`Pantry`, `Shopping`, `Low`, `Out of stock`...) : verification par recherche de texte (P-2). Le titre du `PluginHeader` ("Pantry" en dur dans `PantryPlugin.tsx`) devient `Garde-manger` ; la cle `pantry.*` de `plugins/pantry/src/i18n/{fr,en}.ts` reste (aucun renommage de cles).
- **D-06** Charte : Ionicons, styles inline, `showAlert`, `paddingBottom: 100`, carte standard ; scan = permission camera via le composant `BarcodeScanner.tsx` existant.

### Zones grises : reponse recommandee retenue `[A CONFIRMER]`
- **D-07 [A CONFIRMER] Nom du module** : `Garde-manger` (le manifest dit deja `Garde-Manger` ; c'est l'UI "Pantry" qui est en anglais). Lot B critique Q2.
- **D-08 [A CONFIRMER] Credits des recettes IA (question Q5).** `POST /pantry/recipes/suggest` (`backend/api/src/routes/pantry-recipes.ts`) appelle `generateObject` avec `AGENT_MODEL` (Sonnet) et n'est derriere **aucun** `creditCheck`/`creditDeduct` aujourd'hui (le contrat dit pourtant 1 credit). Recommandation : nouvelle action additive `recipes` dans `config/credits.ts` (`CREDIT_COSTS.recipes = 1`, `DAILY_QUOTAS.recipes = { base: 1, bonus: 0 }`), route enveloppee par `creditCheck('recipes')` + `creditDeduct('recipes')`, bouton `Generer des recettes · 1 credit` lisant le cout depuis la config ; reponse 402 -> carte credits epuises (motif A15). Ajout de `kind`/action = additif (regle de propriete : `creditGate.ts` non modifie). Journalisation `ai_cost_log` par le chemin existant.
- **D-09 [A CONFIRMER] Objectifs macros de la requete.** La route utilise des constantes `DAILY_TARGETS = {2000 kcal, 150 P, 250 G, 65 L}` pour tout le monde et une date **UTC** (`new Date().toISOString().split('T')[0]`), donc "macros restantes" faux la nuit et pour tout objectif different. Recommandation : lire les objectifs de l'utilisateur (reglages du plugin nutrition dans `ziko_user_plugins.settings` : `calorie_goal`, `protein_goal`, `carbs_goal`, `fat_goal`, sinon repli sur les constantes) et recevoir la **date locale** du client dans le corps (`{ date, preferences }`) ; consommes = somme de `ziko_nutrition_logs` de cette date. La reponse renvoie deja `remaining_macros` (affiche par `PantryRecipes.tsx`).
- **D-10 [A CONFIRMER] Courses : persistance.** Etat actuel : la section "stock bas" est calculee cote client (`quantity <= low_stock_threshold`) ; seules les lignes `source='recipe'` sont persistees (`ziko_shopping_list_items`) ; l'enum `ziko_shopping_item_source` ne contient que `low_stock|recipe`. Recommandation : (a) ajouter la valeur `manual` a l'enum + colonnes `reason text` et `checked boolean not null default false` ; (b) "Il manque" reste **calcule** (stock bas OU peremption depassee, avec la raison affichee : `Sous le seuil`, `Expire`) sans ecrire de lignes ; (c) `Ajoutes par moi` = lignes `source='manual'` ; (d) cocher = `checked` ; `Ranger` = upsert dans `ziko_pantry_items` (additionne la quantite si meme nom) puis suppression de la ligne.
- **D-11 [A CONFIRMER] Scan : champs preremplis.** `utils/barcode.ts` ne demande a Open Food Facts que `product_name,product_name_fr` et ne renvoie que le nom. Etendre a `quantity`, `categories_tags` : nom + quantite (parse `500 g` -> 500 g, `1 L` -> 1 L, sinon 1 piece) + categorie `food_category` par table de correspondance (repli `other`). Aucun appel reseau dans les tests : fetch mocke ; un test ne prouve pas la couverture OFF reelle.
- **D-12 Ligne "Utiliser"/"Retirer du garde-manger"** (microcopy B) : `Utiliser` decremente la quantite (borne 0) ; `Retirer` supprime ; `Aux courses` ajoute une ligne `manual`.
</decisions>

<specifics>
## Specific Ideas
Seed UAT : 12 articles repartis sur les 3 lieux dont un expire demain et un sous le seuil ; compte sans credits pour l'etat 402 ; caméra virtuelle de l'emulateur pour P-3 (code connu + inconnu) ; critere P-2 = recherche de `Pantry|Shopping|Low` sur l'arbre d'accessibilite.
</specifics>

<canonical_refs>
## Canonical References
- `phases/04-maquettes-reference/lot-B/DESIGN-CONTRACT.md` §1 (Garde-manger), §2 (B14-B22), §3 (microcopy), §5 (P-1..P-5), §6 ; `lot-B/02-pantry.html` ; `lot-B/CRITIQUE.md` Q1/Q2 ; `../shared/DESIGN-SYSTEM.md`
- `REQUIREMENTS.md` PANT-01..07 ; `ROADMAP.md` Phase 10 ; `MILESTONE-RECAP-2026-11-12.md` §5 ; `phases/09-ajout-repas-un-ecran/09-CONTEXT.md` (macros restantes viennent de `ziko_nutrition_logs`)
- `backend/api/src/routes/pantry-recipes.ts` ; `backend/api/src/config/credits.ts` ; `backend/api/src/middleware/creditGate.ts` ; `backend/api/src/tools/pantry.ts` (outil IA, `low_stock_threshold: 1`)
- `supabase/portfolio-migrations/20261001101852_portfolio_ziko_schema.sql` (`ziko_pantry_items`) ; `20261108000000_ziko_shopping_list.sql` (**en-tete : "NOT YET APPLIED"**) ; `20261107170000_ziko_revoke_client_dml.sql`
</canonical_refs>

<code_context>
## Existing Code Insights
- `plugins/pantry/src/screens/PantryPlugin.tsx` (483 l.) : `TABS = ['Inventaire','Recettes','Shopping']`, `CATEGORIES` fridge/freezer/pantry deja definies, **tap sur un lieu = `showAlert`** (PANT-01), titre "Pantry" en dur.
- `PantryItemForm.tsx` (513 l., ajout/edition, `BarcodeScanner` -> `setName(scannedName)` seulement), `BarcodeScanner.tsx`, `ShoppingList.tsx` (424 l. : stock bas calcule + lignes `recipe`), `PantryRecipes.tsx` (appel `/pantry/recipes/suggest`, affiche `remainingMacros`), `RecipeDetail.tsx`, `RecipeConfirm.tsx` (appelle `/ai/tools/execute`).
- `plugins/pantry/src/i18n/fr.ts` (cles `pantry.*`), `store.ts`, `components/PantryTabBar.tsx`, `utils/expiry.ts`, `utils/barcode.ts`.
- Routes minces : `apps/mobile/app/(app)/(plugins)/pantry/{dashboard,add,edit,confirm,recipes,recipe-detail,shopping}.tsx`.
### Integration Points
`registry.ts` NON touche (outils pantry existants etendus seulement si besoin). `i18n.ts` du plugin-sdk non requis (le plugin a ses propres cles). Nouvelle action de credit = fichier `config/credits.ts` (additif).
### Migrations (bloc `20261201 1001-1009`, fichiers seulement)
- **Prerequis a verifier par l'orchestrateur (lecture seule)** : `ziko_shopping_list_items` et le type `ziko_shopping_item_source` existent-ils en prod ? (le fichier `20261108000000` se declare non applique). Si non : l'appliquer d'abord ; sinon `1001` echoue.
- `20261201100100_shopping_manual_items.sql` : `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'manual'` (fichier isole, la valeur n'est pas utilisee dans la meme transaction), `ADD COLUMN reason`, `ADD COLUMN checked`.
- Aucune table de credits : l'action `recipes` est dans la config TypeScript.
</code_context>

<deferred>
## Deferred Ideas
Decrement automatique des stocks quand un repas est logue ; liste de courses partagee ; scan de ticket de caisse ; photos produits ; suggestions de recettes hors ligne ; alertes de peremption push (cron).
</deferred>

---
*Phase: 10-pantry-utile-francais*
*Context gathered: 2026-11-12*
