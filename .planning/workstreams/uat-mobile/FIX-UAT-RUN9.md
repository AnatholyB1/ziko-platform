# FIX-UAT-RUN9 (branche `fix/uat-run9`, base `milestone/v1.20`, slot 6)

Un commit par defaut, avec test. Aucune migration appliquee, aucun push, aucune ecriture prod.

## Corrige
1. **Quetes : recompense perdue en silence** (`202612012904_quest_reward_system_award.sql`, NON appliquee).
   Cause : `ziko_sync_quests` (derniere definition = 202612011402 ; 1602 et 2801 ne redefinissent que `ziko_quest_metric_value`, 2802
   que le relais IA) posait `rewarded_at` puis appelait `ziko_award_coins`, qui borne tout appelant non fiable a 10 000 pieces / 24 h
   et RETOURNE SANS ERREUR (2701). Choix : chemin interne `ziko_award_coins_system` (sans plafond, montant issu de la quete serveur,
   executable par personne : REVOKE PUBLIC/anon/authenticated/service_role, seules les fonctions definer l'appellent) ; l'attribution
   et `rewarded_at` sont dans la meme transaction (echec = rollback = quete rejouable). `ziko_award_coins` (client) reste plafonne.
   La migration repare aussi les pertes passees (quetes `completed` + `rewarded_at` sans ligne `source='quest'` du ledger), idempotent.
   Preuve : `scripts/uat/quest-reward-sql/run.mjs` sur Postgres local jetable (port 8215), 18 PASS : defaut reproduit AVANT (rewarded_at pose,
   0 ligne de ledger, solde inchange), reparation une fois, re-application sans doublon, cas normal = 1 attribution (resyncs inclus),
   plafond depasse APRES = versee, echec d'attribution simule (trigger) = erreur franche, rewarded_at NULL, rejouable, droits.
   Lancer : `QR_PG_URL=postgres://postgres@127.0.0.1:8215/qr node scripts/uat/quest-reward-sql/run.mjs`.
2. **Progression des quetes figee** : `requestQuestRefresh()` (SDK `questRefresh.ts`, debounce 1,5 s, resynchro si une ecriture arrive
   pendant la synchro) appele apres Quick Log eau / poids / humeur, `saveMeal`, habitudes, hydratation (plugin), mesures. Le gestionnaire
   (`apps/mobile/src/lib/questRefreshHandler.ts`, installe dans le layout `(app)`) lance `ziko_sync_quests` puis invalide
   `rewards-quests/profile/recent/history`. Les quetes terminees par cette synchro sont gardees et annoncees (toast) a l'ecran Recompenses.
   Tests : debounce, echec, rejeu, registre, cablage des 7 sites.
3. **Onglet Entrainement** : `programHeader` (nom reel, provenance coach / Atelier IA / moi), plus de `Force` ni `Coach Ziko · Intermediaire`
   en dur ; accueil idem pour le titre. Frise `Ma suite` : objectif via `goalLabel` (`strength` -> `Force`). Tests.
4. **Coherences** : serie = `displayStreak` sur `ziko_user_gamification` (accueil `useGamificationStreak`, Recompenses, Profil) ; litres =
   1 decimale FR partout (`14,75 L` -> `14,8 L`, test d'egalite des 3 formateurs) ; progression de programme = `programProgress` unique
   (Programmes et Entrainement ; plus de `1 SEMAINE / 0 TOTAL` invente, compteur masque sans donnee de cycle).
5. **Atelier : clavier** : `keyboardAvoidBehavior` ('padding' sur Android aussi, edge-to-edge) sur les 2 KeyboardAvoidingView.
6. **Facturation (investigation, rien change)** : `creditFreeTurn.test.ts` (faux client strict) : `cost: 4` du `meta` SSE est le PRIX, pas un
   debit ; dans le quota gratuit du jour (1 + min(gains, 2)) le tour ecrit une ligne `quota` et ne debite pas (20 -> 20 attendu) ; quota epuise,
   la RPC de debit est appelee avec 4 ; un tour en erreur ne consomme rien. Le cas RPC cassee (42P10) reste couvert par
   `creditQuotaStrict.integration.test.ts`. `ziko_deduct_ai_credits` non touchee. Piste hors scope : `daily_earned 6 > daily_cap 4`
   est couvert par la migration 2903 (verrou du plafond de gains), a verifier une fois appliquee.
7. **Harnais** : `scripts/uat/README.md` : variables Metro `EXPO_PUBLIC_*`, premier bundle ~4 min, double ouverture du dev-client.
8. **Communaute / modules verrouilles** : "palier" (fr) / "tier" (en) dans `plugins.locked.*`, `plugins.unlocked.toastTitle` et la ligue ;
   la regle `ziko_athlete_state.tier` (D-02) est conservee. Test : aucune cle de deverrouillage ne dit plus "niveau" / "level".

## Non corrige / limites
- Le test du clavier ne prouve pas le natif (rendu DOM) ; 7 autres `KeyboardAvoidingView` du depot gardent `undefined` sur Android.
- `habitLogsRes` de l'ecran Profil est encore lu (requete inutile maintenant) ; `Niveau` reste dit pour la gamification (boutique, profil).
- Le toast de completion est affiche a l'ouverture de Recompenses, pas en direct sur l'ecran du log.
- Les pieces d'une quete terminee hors ligne de la migration restent a verser tant que 2904 n'est pas appliquee en prod.

## A re-verifier sur emulateur
Quete d'eau : log -> progression et solde mis a jour sans ouvrir Recompenses, 1 seule ligne de ledger ; serie identique sur 3 ecrans ;
Entrainement avec `Bloc de force` (nom, `Créé par moi`) et programme coach (`Semaine 3 sur 8 · 38 %`) ; frise `Force` ; clavier Atelier (ecran
et feuille) ; message `palier` d'un module verrouille et de la ligue.

## Gate
type-check mobile (pas de `.expo/types/router.d.ts`), sdk et backend OK ; `npx vitest run` racine 1246 PASS ; backend 572 PASS (8 fichiers
skipped) ; rendu mobile 89 PASS ; test statique GRANT (v120MigrationGrants) et `check-migration-names` verts (PP 29 autorise) ;
SQL local 18 PASS.
