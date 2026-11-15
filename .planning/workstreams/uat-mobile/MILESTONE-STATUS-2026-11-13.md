# v1.20 UAT Mobile — état au 2026-11-13 (fin de session d'orchestration)

Branche d'intégration : `milestone/v1.20` (worktree `.claude/worktrees/integration-v1.20`). Rien n'est poussé ni mergé dans `main`.

## Ce qui est fait
- **26 phases sur 26 construites et fusionnées** (P1–P26, maquettes lots A–F). Aucun conflit non résolu.
- Audits : sécurité, revue A (P1–P12, P15), revue B (P13–P26) — rapports `AUDIT-*.md`, corrections `FIX-SECURITY.md`, `FIX-REVIEW-A/B.md`.
- UAT sur émulateur Android (harnais P1) : 8 runs, 8 cycles de correction (`FIX-UAT-RUN1..7.md`).
- Gate de référence (dernière exécution) : vitest racine 1168 tests OK ; backend ≥ 569 OK ; rendu mobile 89 OK ; `tsc` mobile/backend 0 erreur (hors fichier `.expo/types/router.d.ts` généré périmé : le supprimer avant `tsc`) ; test statique GRANT vert ; noms de migrations OK (52 fichiers).

## Ce qui N'EST PAS prouvé (honnêteté)
- Aucune phase n'est « vérifiée de bout en bout » au sens strict : l'UAT couvre une partie des critères de chaque phase.
- **Jamais testé sur émulateur** (détail dans `UAT-RESULTS-run*.md`) : P26 LG-1, 7 (UI), 12 (puce), 23–25 ; P16 IM-4, 12 (complétion), 13 ; P24 activation par l'UI et variantes C–F ; P23 atelier A–F ; création de quête à 21 h par l'UI ; P6 D/E ; P11 HY-5/6 ; P15 ME-1/8 ; P17 SL-3..5 ; P22 JR-6 ; caméra virtuelle (scan code-barres) ; comparaison aux maquettes (jamais faite systématiquement).
- Le **faux Anthropic** prouve le câblage, pas la qualité du vrai modèle. Aucun appel Anthropic réel n'a été fait (autorisé : 1 par UAT d'outil IA, jamais utilisé).
- Les migrations ont été rejouées sur la branche de test `uat-v1-20` (copie du schéma ziko_*), pas sur le schéma prod réel.
- Incohérence non résolue : le résumé de l'agent du run 8 évoque un FAIL « saisie d'eau après création d'une quête non comptée », mais ses tableaux et `phases/13-*/UAT-RESULTS.md` donnent PASS (SQL). À rejouer par l'UI.

## Actions PRODUCTION réalisées (accord explicite de l'utilisateur)
1. `20261201250100_coach_link_guard` appliquée en prod (faille RLS `ziko_coach_client_links`).
2. REVOKE EXECUTE de `ziko_earn_ai_credits` / `ziko_deduct_ai_credits` (PUBLIC/anon/authenticated) et de `ziko_search_users_fuzzy` (anon). Détail : `DEPLOY-CHECKLIST-v1.20.md` sections H et J.
Rien d'autre n'a été écrit en prod.

## Défauts connus laissés ouverts
- **Facturation** : `ziko_deduct_ai_credits` lève 42P10 (ON CONFLICT sans prédicat) → probablement aucun débit réel. Décision : corriger AU DÉPLOIEMENT, date d'activation à fixer par l'utilisateur.
- **Déployé en prod aujourd'hui (origin/main)** et corrigé seulement dans le milestone : retrait du coach côté athlète sans effet (route masquée), « Sauvegarder & fermer » → Unmatched Route, `ziko_friendships` sans migration 2101, 9 fonctions SECURITY DEFINER encore appelables hors 2701 (voir `AUDIT-SECURITY.md`), policy de lecture manquante sur `ziko_badge_definitions` et `ziko_level_definitions`.
- Communauté : « niveau 1 » (règle `ziko_athlete_state.tier`, décision D-02) vs niveau gamification 3 : message à reformuler en « palier » (non fait).
- Notification : l'écran « Activer / Plus tard » réapparaît après la modale de ligue (à confirmer).
- `plugins/nutrition` : `expo-image-manipulator ~13.1.7` vs `^55.0.13` dans apps/mobile (Expo ~54 attend ~14.0.x) → `npx expo install --check` + rebuild EAS avant release.
- Constats d'audit BASSES non traités ; dette de dates UTC hors périmètre (cardio, coach, community, stats, wearables, calendar, profile, onboarding).
- LEAG-05 partiel (pas d'écran coach pour créer un défi) ; MEAS-10/11 inexistantes dans REQUIREMENTS.

## Suite recommandée
1. Run 9 d'UAT sur les flows listés « jamais testé » (procédure : `UAT-RUN8-RESUME.md`).
2. Déploiement coordonné : backend d'abord (service key Vercel déjà présente), puis migrations dans l'ordre des noms (`DEPLOY-CHECKLIST-v1.20.md`), 2101 après comptage de doublons en lecture seule, correction de la facturation à la date choisie.
3. EAS : `npx expo install --check`, rebuild dev-client, tests avatar/photo repas.
4. PR `milestone/v1.20` → `main` seulement sur demande explicite de l'utilisateur.

## Mise a jour 2026-11-14 (apres run 9 + fix run 9)
- Fusionne dans milestone/v1.20: run 9 (quete d'eau PASS par UI; activation P24 PASS; atelier P23 PASS) et fix/uat-run9 (recompense de quete perdue: migration 2904 appliquee sur la branche de test seulement; sync des quetes apres ecritures; titre Entrainement reel; serie/litres/progression a source unique; clavier atelier; 'palier'). Vitest racine 1246 OK.
- DECISIONS utilisateur pour le deploiement prod (2026-11-13): (1) SAUTER 2501 (deja en prod); (2) 0701 OK: garder le programme actif le plus recent par utilisateur, les autres passent inactifs sans suppression; (3) facturation: livrer la correction de `ziko_deduct_ai_credits` (avec test de cle d'idempotence AVANT le debit pour eviter le double debit au rejeu) mais la laisser INACTIVE; activation seulement sur date donnee par l'utilisateur; (4) migration-guard: DEPLACER les migrations v1.20 vers `supabase/portfolio-migrations/` (meme mecanisme d'application manuelle `supabase db query --linked -f`).
- A FAIRE (non fait, aucune ecriture prod): deplacer les migrations (git mv + ajuster scripts/tests: check-migration-names, test statique GRANT, README), preparer la migration de correction de facturation (inactive), puis demander l'accord explicite pour: deploiement backend, application des migrations en prod dans l'ordre du runbook, PR vers main.
- Reste jamais teste sur emulateur: voir run 9 RESUME (P26 LG-1/7/12/23-25, P16 IM-4/12/13, P6 D/E, P11 HY-5/6, P15 ME-1/8, P17 SL-3..5, P22 JR-6, P24 C..F) + re-verifs du fix run 9.

## Mise a jour 2026-11-14 (soir): run 10 + deplacement des migrations
- Fusionne: `chore/move-migrations-2` (54 fichiers v1.20 dans `supabase/portfolio-migrations/` suffixe `00`; facturation INACTIVE `20261201290500_ziko_deduct_ai_credits_fix.sql` interrupteur `billing_enabled`=false dans `ziko_app_config`; `DEPLOY-ORDER.md`, `MOVE-MIGRATIONS.md`) et `uat/run10`.
- Run 10 (flow 1 seulement): quete d'eau PASS par UI (completed + rewarded_at ~7 s apres 2 taps, +15 une seule fois), reparation 2904 PASS (15 pieces perdues du run 9 versees), Entrainement 'Bloc de force / Cree par moi' PASS, serie 5 jours identique sur 3 ecrans PASS. NON TESTES: clavier Atelier, P26 LG-1/7/12/23-25, P16 IM-4/12/13, P24 C..F, P6 D/E, P11 HY-5/6, P15 ME-1/8, P17 SL-3..5, P22 JR-6.
- RISQUE A VERIFIER avant toute PR: valeur de la variable GitHub Actions `PORTFOLIO_MIGRATIONS_ENABLED` (si 'true', un merge vers main envoie les 54 fichiers en prod avant le backend). Aucune ecriture prod supplementaire depuis la mise a jour precedente.
- Reprise recommandee en NOUVELLE SESSION: (1) run 11 UAT sur les flows non testes (`UAT-RUN10-RESUME.md`), (2) expo install --check + EAS, (3) deploiement coordonne avec accord explicite par etape (backend, migrations dans `DEPLOY-ORDER.md`, PR).

## Mise a jour 2026-11-15 : DEPLOIEMENT PROD v1.20 (go explicite de l'utilisateur)
- `PORTFOLIO_MIGRATIONS_ENABLED` passee a `false` avant le merge (la CI n'a applique aucune migration).
- PR #69 fusionnee dans `main` (`b54de825`) : CI verte (type-check/lint/test, RLS, waitlist, bundle web, garde SERVICE_ROLE/coach, migration-guard). Garde ARCH-03 du job RLS ajuste (commentaires JSDoc et *.test.ts ignores). Vercel : `Production - ziko-api` success ; `/health` ok ; routes v1.20 repondent 401 (auth requise) ; 0 erreur d'execution api/web sur 1 h apres les migrations.
- Sauvegarde prealable (SELECT, hors depot) : `ziko_workout_programs` 28, `ziko_ai_generated_programs` 17, `ziko_coin_transactions` 56, `ziko_friendships` 1 + definitions des 13 fonctions existantes redefinies par les migrations (scratchpad `prod-backup-2026-11-15`).
- 55 migrations appliquees a la main sur la prod `ubxllsvanurkwkohzxau` (`supabase db query --linked -f`, dans l'ordre alphabetique, 2501 sautee, arret au 1er echec : 55/55 OK). Verifs : tables `ziko_` 104 -> 124 (+20), `schema_migrations` inchange (57), 0 utilisateur avec 2 programmes actifs, 7/7 tables v1.20, `ziko_earn_ai_credits` anon=false authenticated=false service=true, 2 policies badge/level, `billing_enabled=false`, 43 profils intacts.
- Build EAS production Android (versionCode 19) + soumission Play (piste production) programmes : voir la page de la soumission EAS.
- RESTE : activation de la facturation (`billing_enabled`) a la date choisie ; filigrane de la CI (`portfolio-migrations.watermark`) a remonter a `20261201290700` AVANT de remettre `PORTFOLIO_MIGRATIONS_ENABLED=true` ; variante APP_ORIGIN (absente en prod) ; plafond de relance P24 ; flows UAT non joues (voir `UAT-RESULTS-run11.md`).
