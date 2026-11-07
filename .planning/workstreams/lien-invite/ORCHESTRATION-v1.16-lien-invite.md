# Orchestration v1.16 lien-invite (resume file)
Orchestrator: orch-waitlist. Integration: branch milestone/v1.16-waitlist, worktree .claude/worktrees/integration-v1.16, base origin/main 71d240e7 (local main is stale by 581 commits: always base on origin/main).
Ports 3140-3179, Postgres jetable 54440-54479, lock .planning/.machine-lock.

## Etat 2026-11-07
- Phases 1-5 deja sur main (PR #25 + codemod ziko_ v1.19). Phase 6 plans 06-01..04 ecrits sur l'ancien monde (projet ziko slkobhavpwsubnsmuhya SUPPRIME): a re-baser.
- Prod = projet portfolio ubxllsvanurkwkohzxau (lecture seule via MCP). Constat: ziko_waitlist_signups=94 (tous founders, 2026-08-19..2026-10-18, 0 sur 7j, 19 sans consent_given_at), seq=95, ziko_app_config: premium_credit_cap_enabled=false, waitlist_retention_years=3, waitlist_reveal_threshold=200 (CONTEXT D-05 disait 30), ziko_user_profiles tier=premium: 21 (tous is_lifetime_premium, tous dans la waitlist), profiles=40.
- CONSEQUENCE: CONTEXT D-03/D-04 (0 ligne, TRUNCATE + reset sequence) sont DANGEREUX (supprimeraient 94 inscrits reels). A-01/CRED-01 (aucun premium reel) ne tient plus: 21 premium.
- Coherence ziko_: src OK; restent des noms non prefixes dans scripts/purge-test-accounts/export.mjs, scripts/waitlist-erasure/erase.mjs, tests apps/web/test/{legal,purge,...}, backend/api/test/rls/*waitlist*|premium*, .github/workflows/test-rls.yml (a verifier).

## Plan
1. B1 (builder, worktree): coherence ziko_ (scripts, tests, specs RLS, CI, runbooks). 
2. Discuss phase 6 (questions envoyees a team-lead).
3. Re-planifier 06-01..04 apres reponses; RUNBOOK + DEPLOY-CHECKLIST-v1.16.md; UAT soumission reelle sur Postgres jetable (2 gaps Phase 5).
