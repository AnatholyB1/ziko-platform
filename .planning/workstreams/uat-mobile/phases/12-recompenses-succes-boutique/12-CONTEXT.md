# Phase 12: Récompenses : Succès & Boutique - Context

**Gathered:** 2026-11-12 (voie DISCUSS, agent w2a). Req : REWD-01..REWD-10. Vague 2. UI hint oui : le **contrat du lot B** (`lot-B/DESIGN-CONTRACT.md`, ecrans B01-B13, criteres R-1..R-10) tient lieu de UI-SPEC. P12 est proprietaire de `plugins/gamification` (P13 s'enchaine apres, onglet Quetes ; P21 lit seulement).
**Statut :** pret pour planification ; `[A CONFIRMER]` = reponse recommandee retenue.

<domain>
## Phase Boundary

Quatre onglets Niveau / Succes / Boutique / Quetes avec le **solde de pieces en permanence** ; les **11 succes reels** (`ziko_badge_definitions`) affiches avec icone, condition, progression, fiche, date de deblocage, et attribues automatiquement ; boutique complete (4 categories sans limite de 8, apercu avant achat, `Mes objets` avec equipement, historique des gains) ; plus aucune liste factice. L'onglet Quetes ne livre ici que l'**etat vide honnete** (B13) : le contenu = P13, l'IA = P14.
</domain>

<decisions>
## Implementation Decisions

### Decides (maquette lot B + recap, ne pas redemander)
- **D-01** REWD-01/07 : en-tete fixe commun aux 4 onglets (Niveau, Succes, Boutique, Quetes, dans cet ordre) avec puce de solde de pieces (or, 44 dp) + icone horloge vers l'historique. Critere R-1.
- **D-02** REWD-02/03 : onglet Succes = 2 groupes : `A debloquer` (tries par proximite, barre de progression + `n / N`) puis `Debloques` (icone or + date) ; compteur `4 sur 11 debloques` ; 11 icones **Ionicons distinctes** (barbell, fitness, flame, trophy, flash, star, ribbon, medal, diamond, checkmark-circle, people) ; fiche en feuille basse : nom, condition, progression, date de deblocage (absente si verrouille), recompense en pieces. Criteres R-2, R-4.
- **D-03** REWD-04 : attribution automatique ; un succes obtenu par action reelle passe de `A debloquer` a `Debloques` **sans relance** avec une date reelle (R-3) ; toast + icone gris->or en 250 ms (instantane si reduced-motion).
- **D-04** REWD-05/06/09 : boutique = segment `Boutique | Mes objets` ; 4 categories en puces avec compteur reel (Titres, Badges, Themes, Bannieres), liste defilante **sans limite de 8** (R-5) ; etats d'un objet par mot : prix, `Apercu`, `Possede`, `Niveau N` (verrou `level_required`), `Il manque N pieces` ; **apercu avant achat** en feuille (theme applique, titre sur le profil), achat en 1 tap, confirmation par toast, bouton desactive si solde < prix (R-6, R-7) ; `Mes objets` : un seul `EQUIPE` par categorie, equiper B retire A dans la meme capture (R-8).
- **D-05** REWD-08 : historique des gains (B10/B11, `Aucun gain pour l'instant`), 5 derniers = lignes de la table, antechronologique (R-9). REWD-10 : **aucune liste de secours** : suppression du tableau statique (`STATIC_QUESTS`, "Static badge fallback data" de `GamificationPlugin.tsx`) ; erreur reseau = carte B05, mode avion = 0 element fictif (R-10).
- **D-06** Charte : Ionicons uniquement (les emoji stockes en base ne sont **jamais** rendus), styles inline, `paddingBottom: 100`. Microcopy lot B §3 mot pour mot.

### Zones grises : reponse recommandee retenue `[A CONFIRMER]`
- **D-07 [A CONFIRMER] Icones des succes = table de correspondance cote app.** `ziko_badge_definitions.icon` contient des emoji (`🏋️`, `💪`...) : on ne modifie pas la donnee ; une table `slug -> nom Ionicons` (11 slugs : first_session, ten_sessions, fifty_sessions, hundred_sessions, streak_7/30/100, first_pr, ten_prs, profile_complete, first_friend) vit dans `plugins/gamification` ; slug inconnu = icone `ribbon` (jamais l'emoji).
- **D-08 [A CONFIRMER] Qui attribue, quand.** `user_badges` est en **lecture seule pour le client** (`20261107170000_ziko_revoke_client_dml.sql`) ; l'attribution passe par la fonction `ziko_check_and_award_badges(p_user_id)`, appelee aujourd'hui **uniquement** par l'ecran Profil au chargement (`profile/index.tsx` l.707, fire-and-forget) : d'ou "aucun succes attribue". Recommandation : helper unique `awardBadges()` appele (a) a l'ouverture de l'onglet Succes, (b) apres fin de seance, record, ajout d'ami accepte, sauvegarde du profil ; invalide `['badges', userId]` ; la fonction SQL est reecrite (migration 1201) pour **renvoyer les slugs nouvellement debloques** (jsonb) afin d'afficher le toast. Pas de trigger de base (couplage avec P6/P21, plus risque).
- **D-09 [A CONFIRMER] Progression `n / N`.** Nouvelle fonction `ziko_get_badge_progress(p_user_id)` (SECURITY DEFINER, lecture) renvoyant les compteurs courants par `condition_type` (sessions, streak, prs, profile_complete, friends) ; le client calcule `min(n, N)` par succes. Ne duplique pas la logique : `ziko_check_and_award_badges` et `ziko_get_badge_progress` partagent une fonction interne de comptage.
- **D-10 [A CONFIRMER] Definition de la serie des succes (question Q8).** `ziko_check_and_award_badges` calcule la serie comme des **jours consecutifs avec une ligne `ziko_habit_logs` en partant d'aujourd'hui**, alors que l'utilisateur voit `ziko_user_gamification.current_streak` / `longest_streak`. Recommandation : aligner les succes serie sur `current_streak`/`longest_streak` (la serie visible), ce qui rend `Encore 2 jours d'entrainement ou de check-in` vrai.
- **D-11 [A CONFIRMER] Pieces par succes (question Q7).** La fiche affiche une "recompense en pieces" mais rien ne credite des pieces a l'obtention d'un succes. Recommandation : crediter par `tier` (1 -> 25, 2 -> 50, 3 -> 100) via la fonction interne `ziko_award_coins` dans la meme transaction que l'insertion dans `user_badges` ; `ziko_coin_transactions.source` est limite par un CHECK a `workout|habit|streak_bonus|level_up|purchase|refund` : la migration ajoute `achievement` (drop/recreate du CHECK, jamais edition d'une migration existante). Les montants "+25/+50/+75, prix 300-800" du lot B sont des placeholders (critique B Q4) : les prix reels restent ceux de `ziko_shop_items`.
- **D-12 [A CONFIRMER] Equipement atomique.** `equipItem` (store.ts l.282+) fait N updates clients non atomiques sur `ziko_user_inventory` (+ copie sur `ziko_user_gamification.equipped_*`) : un echec au milieu = 0 ou 2 `EQUIPE`. Recommandation : fonction `ziko_equip_item(p_item_id)` SECURITY DEFINER (verifie la possession, deselectionne la categorie, equipe, met a jour `equipped_title|badge|banner|theme`) ; `purchaseItem` utilise deja la RPC `ziko_purchase_shop_item` (inchangee).
- **D-13 [A CONFIRMER] Theme achete et marque du coach (question Q6).** Recommandation : le **branding du coach prime** tant qu'il est actif (override `useThemeStore` existant) ; le theme achete reste equipe et s'applique si le coach est delie ; message d'information dans la fiche d'equipement. Lot B critique Q3.
- **D-14 Historique** : `ziko_coin_transactions` (lecture client autorisee) suffit, pagine (plus de `limit(20)` ferme) ; les gains XP restent dans `ziko_xp_transactions` (resume sur l'onglet Niveau B01). Aucune nouvelle table.
- **D-15 Navigation** : `ShopScreen.tsx` (314 l., route `gamification/shop`) est absorbe dans l'onglet Boutique ; la route `gamification/shop.tsx` reste (liens existants : `ai/index.tsx` `gamification_shop`, `profile`) et ouvre le plugin sur l'onglet Boutique. `loadGamification` ne limite plus a 20 les transactions affichees.
- **D-16 Onglet Quetes (frontiere P13)** : P12 livre le squelette + etats B12/B13 sans donnee factice ; P13 le reecrit dans le meme fichier (chaine P12 -> P13). Ne pas anticiper le schema de quetes.
</decisions>

<specifics>
## Specific Ideas
Seed UAT : compte neuf (0 succes), compte avec 12+ objets dans une categorie (R-5), solde manipule pour R-6, mode avion pour R-10. Scenario R-3 : terminer une 1re seance valide (une seance vide ne compte pas : P6 D-02) puis ouvrir Succes sans relance.
</specifics>

<canonical_refs>
## Canonical References
- `phases/04-maquettes-reference/lot-B/DESIGN-CONTRACT.md` §1-§6 ; `lot-B/01-recompenses.html`, `03-succes-suite.html` ; `lot-B/CRITIQUE.md` (Q3 theme/coach, Q4 economie) ; `../shared/DESIGN-SYSTEM.md`
- `REQUIREMENTS.md` REWD-01..10 ; `ROADMAP.md` Phase 12 + notes de recoupement v1.18 phases 45/46 ; `MILESTONE-RECAP-2026-11-12.md` §7 ; `ORCHESTRATION-v1.20-uat-mobile.md` (propriete de `plugins/gamification`)
- `supabase/portfolio-migrations/20261001101853_portfolio_ziko_functions.sql` (`ziko_check_and_award_badges` l.111+, `ziko_purchase_shop_item` l.699+) ; `20261001101852_portfolio_ziko_schema.sql` (`ziko_shop_items`, `ziko_coin_transactions` + CHECK source) ; `20261107170000_ziko_revoke_client_dml.sql` (user_badges / coin_transactions en lecture seule, user_inventory en ecriture) ; `supabase/migrations/20260522143410_profile_settings_gap.sql` (11 definitions de depart)
- `phases/06-seance-entrainement-fiable/06-CONTEXT.md` D-02 (seance sans serie non comptee) ; v1.18 phases 45/46 (recompenses non punitives, a relire par P13)
</canonical_refs>

<code_context>
## Existing Code Insights
- `plugins/gamification/src/screens/GamificationPlugin.tsx` (526 l.) : `TABS = ['Niveau','Badges','Quetes']` ; l'onglet Badges lit `ziko_shop_items WHERE category='badge'` + `ziko_user_inventory` et fait `slice(0, 8)` (d'ou Coeur et Dragon absents) ; `STATIC_QUESTS` code en dur ; badges de secours statiques (l.44).
- `ShopScreen.tsx` (314 l.), `store.ts` (374 l. : `loadGamification`, `purchaseItem`, `equipItem`, `ensureProfile`), `manifest.ts`.
- `apps/mobile/app/(app)/(plugins)/gamification/{dashboard,shop}.tsx` ; `apps/mobile/app/(app)/profile/index.tsx` (badges `PRBadgesTab`, appel RPC l.707).
- `ziko_level_definitions` (niveaux), `ziko_user_gamification` (xp, level, coins, current_streak, longest_streak, equipped_*).
### Integration Points
`i18n.ts` du plugin-sdk : namespace `rewards.*` ajoute a la fin. P21 (profil public) lit `ziko_user_badges` en lecture seule : ne pas renommer/changer de forme la table. `registry.ts` non touche.
### Migrations (bloc `20261201 1201-1209`, fichiers seulement)
- `202612011201_badge_award_and_progress.sql` : reecriture `ziko_check_and_award_badges` (retour jsonb des slugs, serie alignee D-10, coins par tier D-11) + `ziko_get_badge_progress` ; `ALTER` du CHECK `source` de `ziko_coin_transactions` (+ `achievement`).
- `202612011202_equip_item_rpc.sql` : `ziko_equip_item`.
- Toute fonction : `SECURITY DEFINER`, `SET search_path = public, pg_temp`, `REVOKE ALL ... FROM PUBLIC, anon`, `GRANT EXECUTE ... TO authenticated`, verification `auth.uid()` (la fonction existante prend `p_user_id` en parametre : la nouvelle version DOIT verifier `p_user_id = auth.uid()`).
</code_context>

<deferred>
## Deferred Ideas
Nouveaux succes (au-dela des 11) ; succes caches ; partage de succes ; boutique saisonniere ; cadeau de pieces (`ziko_coin_gifts`, hors historique de gains) ; XP dans l'historique (reste sur l'onglet Niveau) ; economie de pieces refondue (le tableau de gains par action reste celui de `award_coins`/`award_xp` existants).
</deferred>

---
*Phase: 12-recompenses-succes-boutique*
*Context gathered: 2026-11-12*
