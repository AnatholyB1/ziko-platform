# AUDIT SECURITE v1.20 (workstream uat-mobile)

Branche `audit/security` (depuis `milestone/v1.20`). Lecture seule sur le code applicatif. Prod lue en SELECT uniquement (ubxllsvanurkwkohzxau). Attaques rejouees uniquement sur la branche de test (oloobswzsziidjwycthm, project_id verifie avant chaque appel). Donnees de test modifiees sur la branche : 1 ligne cost_log inseree puis supprimee, `ziko_user_profiles` de l'athlete UAT modifie puis remis a `free`/`false`, +5 credits IA (idempotency `audit-sec-earn-1`).

Perimetre couvert : les 42 migrations `2026120*.sql` (RLS, policies, grants, SECURITY DEFINER, dynamique), `backend/api/src` (workshop, periodization, quests, measurements, league, routes, tools, coach/clients), mobile (secrets, deep links, stockage). Non couvert faute de contexte : relecture ligne a ligne de `ziko_league_sync` (corps apres l.110), `ziko_quest_metric_value`/`ziko_badge_counters` (service_role seul, signatures verifiees), `ziko_ai_revise_measurement_goal`, tools/hydration|journal|sleep|timer|stretching.

Resultat global des migrations 2026120* : RLS activee sur les 20 tables creees ; aucune ecriture client sur les tables sensibles (REVOKE + RPC) ; toutes les nouvelles fonctions SECURITY DEFINER ont `search_path` fixe ; les RPC a parametre utilisateur (`ziko_check_and_award_badges`, `ziko_get_badge_progress`, `ziko_sync_quests`, `ziko_league_sync`) verifient `p_user = auth.uid()` ou service_role ; les fonctions reservees (`*_ai_claim`, `ziko_create_quests`, `ziko_create_ai_quests`, `ziko_league_apply_transition`, `ziko_collective_contribution`, `ziko_badge_counters`, etc.) sont REVOKE public/anon/authenticated et GRANT service_role ; aucun SQL dynamique (`EXECUTE`/`format` n'ecrit que des messages) ; aucun `USING (true)` sur donnee personnelle (seulement catalogues : badge/level definitions, `ziko_factions`).

---

## A. CONFIRMES (reproduits sur la branche et/ou verifies dans le catalogue prod)

**1. CRITIQUE | migrations anciennes (hors 2026120*, presentes en PROD) : `ziko_award_coins`, `ziko_award_xp`, `ziko_purchase_shop_item` (connus) + NOUVEAUX : `ziko_earn_ai_credits`, `ziko_deduct_ai_credits`, `ziko_send_coin_gift`, `ziko_send_xp_gift`, `ziko_ensure_gamification_profile`, `ziko_increment_community_stat`, `ziko_create_form_instances_for_trigger`**
- Probleme : SECURITY DEFINER, parametre `p_user_id`/`p_sender_id` falsifiable, AUCUN controle `auth.uid()`/service_role (verifie par regex sur `pg_get_functiondef` en prod), EXECUTE accorde a `anon` ET `authenticated` (verifie prod via `has_function_privilege`).
- Exploitation (rejoue sur la branche avec la seule cle publishable, sans etre connecte) : `POST /rest/v1/rpc/ziko_earn_ai_credits {p_user_id:<moi>, p_amount:N, p_daily_cap:1000000, p_idempotency_key:<unique>}` -> `{"credited":true}` ; repete avec une cle differente = credits IA illimites (cout Anthropic reel pour la plateforme, contourne creditCheck). `ziko_deduct_ai_credits` sur l'UUID d'une victime vide son solde (reponse `{balance,success}`). `ziko_award_coins` appele en anon a atteint l'INSERT (rejet seulement par la CHECK sur `source` avec ma valeur de test ; avec une source valide il passe). `ziko_send_coin_gift(p_sender_id=victime, p_receiver_id=moi)` vole des pieces/XP (plausible : non rejoue). `ziko_create_form_instances_for_trigger(p_athlete_id, p_coach_id,...)` permet de spammer des formulaires a un athlete avec le coach de son choix (plausible : non rejoue).
- Correctif : nouvelle migration : `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;` pour award_coins, award_xp, deduct_ai_credits, earn_ai_credits, ensure_gamification_profile, increment_community_stat, create_form_instances_for_trigger ; pour `purchase_shop_item` et `send_*_gift` : reecrire avec `auth.uid()` (supprimer `p_user_id`/`p_sender_id`) puis GRANT authenticated seul. Verifier que le backend appelle bien ces fonctions avec la cle service (cas `earnCredits`, `creditService`). A APPLIQUER EN PROD EN PREMIER (aucun lien avec le milestone, mais exploitable sans compte).

**2. HAUTE | `ziko_search_users_fuzzy(search_query, calling_user_id, result_limit)` | executable par `anon`**
- Reproduit : appel anon avec la requete `"a"` renvoie id + name + avatar_url + goal des utilisateurs correspondants, sans authentification (enumeration de la base). La migration 2102 l'a laisse en place volontairement ("compatibilite").
- Correctif : `REVOKE EXECUTE ... FROM PUBLIC, anon` ; supprimer l'appel mobile au profit de `ziko_search_users_with_status`, puis DROP.

**3. MOYENNE | `ziko_user_profiles` (policy `users_own_profile` ALL + GRANT UPDATE colonnes) : `role`, `tier`, `subscription_tier`, `is_lifetime_premium`**
- Probleme : un utilisateur peut ecrire ces colonnes sur sa propre ligne (aucun trigger de garde hors `email_verified_at`). Reproduit sur la branche (PATCH `is_lifetime_premium:true, subscription_tier:premium` -> 200, restaure) ; memes grants et policy confirmes en PROD.
- Impact aujourd'hui : `tier='premium'` ne contourne plus le credit gate car `premium_credit_cap_enabled=true` en prod ; `role='coach'` est de toute facon auto-attribuable via `/coach/identity` (les droits coach reels viennent de `ziko_coach_client_links`, `ziko_is_coach_of`) ; mais `ziko_create_collective_challenge` se base sur `role` (borne par l'exigence de liens actifs), et tout futur usage du flag lifetime est compromis.
- Correctif : `REVOKE UPDATE (role, tier, subscription_tier, is_lifetime_premium) ON ziko_user_profiles FROM authenticated;` (et INSERT) ; changements de role via backend service uniquement, ou trigger BEFORE UPDATE qui les gele si `auth.uid()` non nul.

**4. MOYENNE | PROD `ziko_friendships` : migration 2101 NON appliquee**
- Etat prod lu : `friendships_insert WITH CHECK (auth.uid()=requester_id)` (pas de `status='pending'`), `friendships_update` autorise le demandeur ET le destinataire, pas de trigger d'immutabilite des parties.
- Exploitation : INSERT direct avec `status='accepted'` (auto-acceptation), ou UPDATE `requester_id` pour se fabriquer une amitie avec un tiers ; doublons croises possibles. La branche contient bien les policies corrigees (verifie).
- Correctif : appliquer `202612012101` (verifier d'abord le comptage de doublons en lecture seule, prevu dans l'en-tete du fichier).

**5. MOYENNE | `ziko_ai_cost_log` (policy `ai_cost_log_own` ALL, GRANT INSERT/UPDATE/DELETE authenticated, aussi en PROD)**
- Probleme : les plafonds d'appels IA "absorbes" de v1.20 se comptent dans cette table : web search atelier (20/jour, `workshop/webSearch.ts` `countWebSearchesToday`), relance de programme (1/jour, `periodization/store.ts:233`). L'utilisateur peut supprimer ou falsifier ses lignes. Reproduit : INSERT puis DELETE de sa propre ligne (201 puis 204).
- Exploitation : boucle `DELETE ziko_ai_cost_log WHERE user_id=moi` entre deux appels `/ai/workshop/relaunch/:id/propose` ou recherches web -> appels Sonnet absorbes sans limite.
- Correctif : `REVOKE INSERT, UPDATE, DELETE ON ziko_ai_cost_log FROM authenticated, anon` (le backend ecrit avec service_role) ; SELECT own suffit.

**6. MOYENNE | `backend/api/src/routes/ai.ts:172` `POST /ai/tools/execute` | aucun creditCheck ni rate limit**
- Appel direct d'un outil par nom : `ai_programs_generate` et `ai_programs_adjust` (`tools/ai-programs.ts:67,168`) font un `generateText` Sonnet (jusqu'a 4000 tokens) sans credit ni quota ; aucun rateLimiter sur le routeur ai (grep). Le message d'erreur interne est renvoye au client (`err.message`).
- Correctif : `creditCheck('program')`/`creditDeduct` sur ces outils (ou interdire les outils LLM dans `/tools/execute`, comme `INTERNAL_ONLY_TOOLS`) + rate limiter Upstash par userId.

**7. MOYENNE | `202612012103_public_profile_rpc.sql:23` (`ziko_get_public_profile`) et `202612012102_friend_rpc.sql:67` (`ziko_search_users_with_status`)**
- Probleme : aucune relation requise ni lecture de `ziko_user_profiles.is_public` (le reglage "profil public" de `profile/security.tsx` est donc sans effet). Reproduit : un athlete non ami lit le profil d'un autre (`relation:"none"`) : nom, handle, objectif (`goal`, ex. weight_loss), niveau/XP, serie, 3 derniers entrainements (noms+dates), 3 records de charge, badges ; la recherche ignore aussi `is_public`. Pas de poids/mesures corporelles (OK), mais objectif et historique d'entrainement exposes a tout compte connecte via UUID (UUID enumerables par la recherche).
- Correctif : si `is_public = false` et relation hors `self/friend` : retourner seulement `{id,name,handle,relation}` ; exclure les profils prives de la recherche ; ne pas exposer `goal` aux non-amis.

**8. MOYENNE | `202612012605_collective_challenges.sql:164` (`ziko_collective_progress`) et `:87`**
- Probleme : la progression (donnees de seances/habitudes/hydratation des participants) continue d'etre agregee pour le coach apres que l'athlete a revoque son lien (`ziko_coach_client_links.revoked_at`) : aucune verification du lien dans `progress`, la ligne participant reste `joined`. Avec 1 seul participant joint, le total = donnee individuelle ; avec 2, l'athlete deduit la contribution de l'autre (`total - my_contribution`).
- Correctif : dans `ziko_collective_progress`, joindre `ziko_is_coach_of(c.coach_id, p.user_id)` pour ne compter que les liens actifs ; trigger/cascade qui passe les participants a `declined` a la revocation du lien ; masquer `total` sous un seuil (ex. < 3 participants joints).

**9. BASSE | `ziko_is_coach_of(coach, client)` executable par anon** : oracle d'existence de relation coach/athlete si on connait les UUID. Correctif : REVOKE FROM anon (la fonction est utilisee dans des policies RLS, garder authenticated).

**10. BASSE | `backend/api/src/tools/db.ts` : `clientForUser(_userToken)` ignore le token et retourne un client SERVICE_ROLE**
- Toutes les routes workshop/quests/league/periodization s'appuient sur ce client : l'isolation inter-utilisateurs repose donc uniquement sur les `.eq('user_id', userId)` du code (aucune RLS en filet). Revue des requetes de `workshop/store.ts`, `periodization/store.ts`, `workshop/context.ts` : toutes scopees par `userId` (seul `publishDraft` lit `sequence_id` sans `user_id`, mais la valeur vient d'un brouillon deja filtre par `user_id`). Pas d'IDOR trouve. Ecart avec CLAUDE.md ("service role interdit dans backend/api/src") : `SUPABASE_SERVICE_KEY` est importee dans 17 fichiers (auth.ts, creditGate.ts, routes/*, coach/*...). Correctif : renommer/documenter, ou vraiment utiliser le JWT pour les lectures (`createUserClient`) afin de garder la RLS comme 2e ligne de defense.

**11. BASSE | Stockage de session mobile** : `apps/mobile/src/lib/supabase.ts` persiste la session dans AsyncStorage (non chiffre). Correctif : adaptateur SecureStore/MMKV chiffre. Deep links OK : `crash-test` n'est actif que `__DEV__` ou `EXPO_PUBLIC_UAT_CRASH_ROUTE==='1'` (variable absente de `eas.json`) ; navigation notification filtree par `isAllowedNotificationRoute`. Aucun secret en dur trouve (scan sk-ant / service_role / JWT).

**12. BASSE | `coach/clients/service.ts` `/links/history`** renvoie `err.message` brut au client (fuite de details Postgres). Correctif : message generique + log serveur.

## B. PLAUSIBLES (non reproduits)

- **BASSE** | `workshop/context.ts:133` : le nom d'un programme assigne par un coach (texte libre) est injecte tel quel dans le prompt IA de l'athlete (injection indirecte coach -> IA de l'athlete). Impact borne : les outils de l'atelier n'editent que le brouillon de l'athlete. Correctif : assainir/borner et marquer le bloc comme donnees non fiables dans `prompt.ts`.
- **BASSE** | `workshop/webSearch.ts` : le resume web (contenu tiers, jusqu'a 2500 car.) est reinjecte au modele (injection indirecte via pages web). Recherche executee cote Anthropic (`webSearch_20250305`), donc pas de SSRF cote serveur. Plafond 20/jour defait par le constat 5 ; `logAutonomousCost` est fire-and-forget (un echec d'ecriture ne compte pas la recherche).
- **BASSE** | `ziko_user_inventory` : GRANT UPDATE sur `item_id`/`user_id` (prod) avec policy ALL : changer `item_id` d'une ligne achetee vers un article plus cher (objets gratuits). A reproduire ; correctif : limiter l'UPDATE a `is_equipped`.
- **BASSE** | Rate limit absent sur `/quests/refresh`, `/league/refresh`, `/ai/workshop/relaunch/*` (bornes par plafonds DB, mais non anti-spam).

## C. TABLEAU DE SYNTHESE

| # | Sev | Sujet | Statut | Prod concernee |
|---|-----|-------|--------|----------------|
| 1 | CRITIQUE | RPC economie/credits executables par anon, parametre user falsifiable (9 fonctions) | confirme (branche + prod) | OUI |
| 2 | HAUTE | `ziko_search_users_fuzzy` anon : enumeration des utilisateurs | confirme | OUI |
| 3 | MOYENNE | auto-edition role/tier/premium sur `ziko_user_profiles` | confirme | OUI |
| 4 | MOYENNE | `ziko_friendships` prod sans 2101 : auto-acceptation / forge | confirme (catalogue prod) | OUI |
| 5 | MOYENNE | `ziko_ai_cost_log` modifiable : plafonds IA contournables | confirme | OUI |
| 6 | MOYENNE | `/ai/tools/execute` : outils LLM sans credit ni rate limit | confirme (code) | backend |
| 7 | MOYENNE | profil public/recherche ignorent `is_public` et la relation | confirme | apres 2103 |
| 8 | MOYENNE | defi collectif : agregat apres revocation du lien coach | confirme (code) | apres 2605 |
| 9 | BASSE | `ziko_is_coach_of` anon | confirme | OUI |
| 10 | BASSE | `clientForUser` = service role (pas de RLS en filet) | confirme | backend |
| 11 | BASSE | session AsyncStorage non chiffree | confirme | mobile |
| 12 | BASSE | fuite `err.message` | confirme | backend |
| B | BASSE | injections indirectes, inventory UPDATE, rate limit | plausible | - |

## D. MIGRATIONS A APPLIQUER EN PRIORITE EN PROD

1. **Nouvelle migration de durcissement (a creer, hors milestone)** : constats 1, 2, 3, 5, 9 (REVOKE EXECUTE anon/authenticated sur les fonctions listees, reecriture `purchase_shop_item`/`send_*_gift` avec `auth.uid()`, REVOKE UPDATE colonnes sensibles de `ziko_user_profiles`, REVOKE ecriture `ziko_ai_cost_log`). A passer avant toute autre chose ; rejouer sur la branche de test (verifier que mobile/backend n'appellent plus ces fonctions en anon).
2. `202612012101_friendships_integrity.sql` puis `202612012102_friend_rpc.sql` (corriger d'abord le constat 7 dans `2103` avant de l'appliquer).
3. `202612011201` (badges, verification `auth.uid()` OK), `202612011301/1302/1401/1402/1602` (quetes, sans ecriture client), `202612012601..2604` (factions/ligue), `202612012504_v1_20_grants_late.sql` : sans danger, a appliquer dans l'ordre.
4. `202612012605_collective_challenges.sql` APRES correction du constat 8.
5. `202612012503_mandatory_plugin_guard.sql` (garde cote DB, utile) ; `2501` deja en prod.
6. Reste (programmes actifs 0701-0704, hydratation, stretching, complements, mesures, atelier, sequences) : revue sans constat, ordre libre.

Aucune ecriture prod, aucun push/merge. Seul fichier ajoute : ce rapport.
