# Phase 1 - Audit securite (lecture seule, aucune base touchee)

## Migration `20261215010100_welcome_quests_meal_template.sql`
- Donnees seulement : 1 INSERT (`ON CONFLICT (slug) DO NOTHING`), 4 UPDATE. Aucune fonction, aucune policy, aucun GRANT modifie. Surface d'attaque inchangee : `ziko_quest_templates` reste SELECT-only pour `authenticated` (policy `is_active`), ecriture `service_role`/proprietaire.
- `ziko_sync_quests` (20261201290400) : controle `p_user_id = auth.uid()` ou `service_role`, `SECURITY DEFINER`, `search_path = public, pg_temp`, verrou advisory par utilisateur, `REVOKE ... FROM PUBLIC, anon`, `ziko_award_coins_system` non executable par les roles clients. Rien de ceci n'est touche.
- Idempotence / double credit : contrainte unique `(user_id, slug, period_start)` + `WHERE id = q.id AND rewarded_at IS NULL` + attribution dans la meme transaction. Pas de double versement.
- Effet sur les comptes existants : nouvelle quete « Ajoute un repas » (+15 pieces/jour max). Risque d'abus : la metrique est auto-declaree (ligne `ziko_nutrition_logs` du jour, RLS « own »), meme niveau de confiance que l'eau. Plafond naturel 15 pieces/jour/compte. Severite basse, accepte (patron existant).
- Retour arriere : `UPDATE ziko_quest_templates SET is_starter = true WHERE slug='starter_weekly_train'` ; `UPDATE ... is_active=false WHERE slug='starter_daily_meal'` (les instances existantes ont `template_id ON DELETE SET NULL`, jamais de suppression requise). Les titres modifies n'affectent que les nouvelles instances. Rien d'irreversible. Pas de transaction explicite requise (migration unique).
- Nommage : 14 chiffres `20261215010100`, hors perimetre du controle (`check-migration-names.mjs` ne verifie que `20261201*`) ; aucune modification de migration existante (diff : 1 ajout).

## Backend onboarding (CLAR-03)
- Application cote serveur, non contournable par le prompt : `assess_profile` valide l'appartenance a `MICRO_ACTION_POOL` (T-43-02) puis `coerceFirstMission(ONBOARDING_LEVEL=1, ...)` ramene tout a `hydration_log` + titre fixe fr/en. La route lit la sortie de l'outil (post-coercition), donc l'accueil et la base voient la valeur corrigee. Injection de prompt : meme si le modele est detourne, la valeur ecrite est bornee. Titre : si le modele choisit `hydration_log`, `mission_title` libre du modele est conserve (texte, rendu en `<Text>`, pas d'execution) - basse.
- Pas de nouveau secret, pas de nouvelle route, pas de nouvelle surface d'entree. `locale` provient de `effectiveLocale` deja calcule par la route.

## Mobile
- Aucun secret / cle en dur ; aucune ecriture directe : le bloc n'appelle que la RPC existante via `syncQuests`.
- Isolation multi-compte : cles de cache scopees `userId`, `queryClient.clear()` a la deconnexion et au changement de session ; les refs du bloc ne portent que des ids de quetes (UUID par ligne). Pas de fuite inter-comptes constatee.
- Navigation : routes issues d'une table statique validee par `isPluginRouteLocked` ; metrique inconnue = ligne masquee (pas de route arbitraire issue du serveur).
- Haptique/accessibilite : sans donnees sensibles.

## Verdict
Aucun constat critique / haut / moyen en securite. Basses : metrique auto-declaree (accepte), titre libre du modele sur `hydration_log`. Reste a faire par un humain : appliquer la migration d'abord sur la branche de test, verifier `SELECT slug,is_starter,sort_order FROM ziko_quest_templates` puis une synchro sur un compte neuf (exactement 3 actives) et sur un compte existant.
