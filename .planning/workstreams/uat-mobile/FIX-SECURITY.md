# FIX SECURITE v1.20 (workstream uat-mobile)

Branche `fix/security` (depuis `milestone/v1.20`, merge `milestone/v1.20` fait). Aucun push, aucune ecriture prod (une seule lecture SELECT du catalogue d'index prod). Migrations appliquees sur la BRANCHE de test `oloobswzsziidjwycthm` uniquement.

## Migrations (a appliquer en prod dans cet ordre, apres 2102/2103/2605)
- `20261201270100_security_hardening.sql` : constats 1, 2, 3, 5, 9 + inventaire (idempotente, rejouee 2 fois).
- `20261201270200_public_profile_privacy.sql` : constat 7 (corps de 2103 / 2102 a l'identique + ajouts marques).
- `20261201270300_collective_progress_privacy.sql` : constat 8.
- `scripts/uat/check-migration-names.mjs` accepte desormais PP = 27 (durcissement).

## Constats

| # | Statut | Correction | Preuve |
|---|--------|------------|--------|
| 1 CRITIQUE | CORRIGE | voir tableau des fonctions ci-dessous | harnais local 107 verifs + rejeu branche 51 verifs |
| 2 HAUTE fuzzy | CORRIGE | REVOKE anon, `calling_user_id = auth.uid()`, profils prives exclus. Reste appelee par `friendsApi.ts` (inchange) | idem |
| 3 MOYENNE profil | CORRIGE (sauf `role`) | trigger BEFORE INSERT/UPDATE (INVOKER, `current_user IN anon/authenticated`) fige `tier`, `subscription_tier`, `is_lifetime_premium`. `role` reste modifiable : l'onboarding coach (`apps/web` actions + `coach/identity/db.ts`) l'ecrit avec le JWT utilisateur (client -> both/coach) ; CHECK limite a client/coach/both ; droits coach reels = `ziko_coach_client_links` | harnais |
| 4 | NON TRAITE (hors mission) | migration 2101 amitie, a appliquer apres comptage de doublons | - |
| 5 MOYENNE cost_log | CORRIGE | REVOKE INSERT/UPDATE/DELETE/TRUNCATE authenticated+anon (SELECT own conserve). Tous les ecrivains backend utilisent `SUPABASE_SERVICE_KEY` | harnais + branche |
| 6 MOYENNE tools/execute | CORRIGE | `ai_programs_generate` / `ai_programs_adjust` : `creditCheck('program')`+`creditDeduct('program')`, 4/min ; tous outils 30/min/utilisateur ; erreur generique. 10 tests (`ai-tools-execute.test.ts`) + 5 (`userRateLimit.test.ts`) | vitest |
| 7 MOYENNE profil public | CORRIGE | `is_public=false` + non-ami : contrat vide (memes cles, `is_private:true`, nom/handle/avatar/relation). Public : complet (Q-P21a). Inexistant : NULL. Recherche : prive sans relation exclu. Aucun mecanisme de blocage n'existe dans le schema : rien a filtrer | harnais (12) + branche |
| 8 MOYENNE collectif | CORRIGE | liens revoques/expires exclus de l'agregat, total NULL (`total_hidden`, `min_participants=3`) sous 3 participants actifs. UI : `parseCollective` lit `total` null comme 0 (affichage "0 / objectif" sous le seuil, a affiner cote design) | harnais (8) |
| 9 BASSE is_coach_of | CORRIGE (autre voie que REVOKE) | reste EXECUTE pour anon : les policies RLS l'evaluent pour anon (REVOKE = "permission denied" au lieu de 0 ligne). La fonction ne repond plus que pour `auth.uid() IN (coach, client)` ou service ; sinon `false` | harnais + branche |
| 10 BASSE clientForUser | PARTIEL | documente dans `tools/db.ts` ; pas de refactor vers un client JWT ; pas de test IDOR automatise (non fait, contexte) | - |
| 11 BASSE AsyncStorage | NON TRAITE | | - |
| 12 BASSE err.message | CORRIGE pour `coach/clients/service.ts` (21 reponses 500) et `/ai/tools/execute` | | tests ai |
| B inventory item_id | CORRIGE | UPDATE limite a `is_equipped` | harnais + branche |
| B rate limit | CORRIGE | `/quests/refresh` 6/min, `/league/refresh` 6/min, `/ai/workshop/relaunch/check|propose` 10/min (`middleware/userRateLimit.ts`, FAIL-OPEN si Redis tombe, voulu : plafonds DB = vraie borne) | tests |
| B injections indirectes | NON TRAITE | | - |

## Fonctions du constat 1 : appelants et preservation

Helper `ziko_sec_is_trusted()` = `auth.uid() IS NULL` ET role JWT absent ou `service_role` (donc anon jamais de confiance). Fonctions internes `ziko_sec_*` (corps historiques, inaccessibles aux clients) pour les cas ou le destinataire n'est pas l'appelant.

| Fonction | Appelants reels | Traitement |
|----------|-----------------|------------|
| `ziko_earn_ai_credits`, `ziko_deduct_ai_credits` | backend `services/creditService.ts` (client `SERVICE_KEY ?? PUBLISHABLE`) | service_role seul |
| `ziko_create_form_instances_for_trigger` | backend `routes/forms.ts`, `routes/webhooks.ts`, `coach/clients/service.ts` (ils utilisaient la cle PUBLIABLE = anon) | service_role seul ; ces 3 fichiers passent par `lib/serviceClient.ts` (`SERVICE_KEY`) |
| `ziko_award_coins`, `ziko_award_xp` | mobile `plugins/gamification/src/store.ts` (soi), fonctions SQL badges/quetes/niveau (appel imbrique, `p_user_id = auth.uid()`) | authenticated + `auth.uid() = p_user_id` ; hors confiance : montant 1..1000 (coins) / 1..2000 (xp), 10000 coins / 20000 xp max sur 24 h (au-dela : sans effet) |
| `ziko_ensure_gamification_profile` | mobile (soi), award/purchase (imbriques) | `auth.uid() = p_user_id` ; les gifts utilisent `ziko_sec_ensure...` pour le destinataire |
| `ziko_purchase_shop_item` | mobile `purchaseItem` | `auth.uid() = p_user_id` |
| `ziko_send_coin_gift`, `ziko_send_xp_gift` | mobile `plugins/community/src/store.ts` | `auth.uid() = p_sender_id` ; destinataire via fonctions internes |
| `ziko_increment_community_stat` | mobile `incrementStat` (soi, +1 ; `encouragements_received` sur un tiers) | hors confiance : montant = 1 ; soi sauf compteurs `*_received` ; tiers uniquement `encouragements_received` |
| `ziko_is_coach_of` | policies RLS, scripts storage | voir constat 9 |
| `ziko_search_users_fuzzy` | `packages/plugin-sdk/src/friendsApi.ts` | voir constat 2 |

## Verification
- PG18 local (port 8209) : `SEC_PG_URL=postgres://postgres@127.0.0.1:8209/sec node scripts/uat/sec-sql/run.mjs` = 107 PASS / 0 FAIL (12 attaques qui REUSSISSENT sur les corps historiques, migrations appliquees 2x, ~40 attaques bloquees, ~30 flux legitimes dont imbrication award_coins/level_up, RLS coach, upsert profil).
- Branche de test : `node scripts/uat/sec-sql/branch-attacks.mjs before|after`. AVANT : 22 attaques reussies (cle publiable / JWT athlete uniquement). APRES : 51 PASS / 0 FAIL (attaques bloquees + flux : badges, quetes, cadeaux, achat, RLS coach, service_role).
- Gate : tsc backend + mobile OK ; `cd backend/api && vitest run` 535 PASS ; vitest racine 989 PASS.

## NON PROUVE / limites
- Les flux sont verifies par appels REST/SQL, PAS sur emulateur ni avec le vrai mobile.
- Auto-attribution de pieces/XP DANS les bornes reste possible (recompenses de seance/habitude declenchees par le client) ; vraie solution = attribution serveur a la fin de seance (hors perimetre).
- `ziko_award_*` : un plafond silencieux (10000 coins/24 h) pourrait ecreter un utilisateur tres actif (improbable).
- Statistiques communautaires : un utilisateur peut incrementer ses propres compteurs +1 (cosmetique).

## Decouverte hors perimetre (decision necessaire)
`ziko_deduct_ai_credits` (branche ET prod, meme index) fait `ON CONFLICT (user_id, source, idempotency_key) DO NOTHING` sans `WHERE idempotency_key IS NOT NULL` : erreur 42P10 des que le solde suffit (reproduit avec service_role). `creditService.deduct` traite l'erreur comme un echec : les credits ne sont probablement JAMAIS debites en prod. Non corrige (changement de facturation a valider) : ajouter `WHERE idempotency_key IS NOT NULL` au ON CONFLICT.

## Risque de regression a re-verifier sur emulateur / en deploiement
1. DEPLOIEMENT : `SUPABASE_SERVICE_KEY` doit etre defini sur Vercel AVANT d'appliquer 2701 (creditService, forms, webhooks, coach/clients retombent sinon sur la cle publiable = anon = refus). Appliquer 2701 APRES le deploiement backend.
2. Mobile : recompenses seance/habitude/serie (award_xp/coins), boutique (achat + equiper), cadeaux, statistiques communautaires, recherche d'amis, profil d'un ami PRIVE (contrat vide + `is_private`), defi collectif sous 3 participants (total a 0), parametres profil (`is_public`, upsert).
3. Coach : onboarding coach (role client -> both), lecture des profils athletes, envoi/publication de formulaires, webhook fin de seance.
4. Web/coach : `err.message` des routes `coach/clients` remplace par "Internal error" (verifier qu'aucun ecran n'affiche le message).
5. `ziko_is_coach_of` evalue `auth.uid()` : tout appel avec deux tiers renvoie false (aucun appel de ce type trouve dans le code ni les migrations).
