# DEPLOY-CHECKLIST v1.16 (actions humaines / prod, rien execute)
- [ ] Decision Q1: aucune etape TRUNCATE/reset sur ziko_waitlist_signups (94 inscrits reels en prod).
- [ ] Decision Q2: 21 premium existants -> activation du plafond (ziko_app_config.premium_credit_cap_enabled=true) seulement apres verification /cgv et /cgu live.
- [ ] Decision Q3: ziko_app_config.waitlist_reveal_threshold 200 -> 30 (UPDATE prod a valider).
- [ ] Decision Q4: 19 inscrits sans consent_given_at: exclure de tout envoi, traiter RGPD.
- [ ] CI: PORTFOLIO_MIGRATIONS_ENABLED / migrate-portfolio dormant; test-rls.yml exige un projet de test SUPABASE_TEST_PROJECT_ID (bootstrap 00-bootstrap-supabase-functions.sql), refuse la prod.
- [ ] Revoquer token ziko-ci-portfolio (reporte du v1.19).
- [ ] Dette: retention-config.test.ts (sha CRLF) et erreurs tsc des tests purge a trancher.
