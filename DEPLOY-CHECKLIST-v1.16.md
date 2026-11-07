# DEPLOY-CHECKLIST v1.16 (actions humaines / prod, rien execute)
- [ ] Decision Q1: aucune etape TRUNCATE/reset sur ziko_waitlist_signups (94 inscrits reels en prod).
- [ ] Decision Q2: 21 premium existants -> activation du plafond (ziko_app_config.premium_credit_cap_enabled=true) seulement apres verification /cgv et /cgu live.
- [ ] Decision Q3: ziko_app_config.waitlist_reveal_threshold 200 -> 30 (UPDATE prod a valider).
- [ ] Decision Q4: 19 inscrits sans consent_given_at: exclure de tout envoi, traiter RGPD.
- [ ] CI: PORTFOLIO_MIGRATIONS_ENABLED / migrate-portfolio dormant; test-rls.yml exige un projet de test SUPABASE_TEST_PROJECT_ID (bootstrap 00-bootstrap-supabase-functions.sql), refuse la prod.
- [ ] Revoquer token ziko-ci-portfolio (reporte du v1.19).
- [ ] Dette: retention-config.test.ts (sha CRLF) et erreurs tsc des tests purge a trancher.

## Reponses utilisateur 2026-11-07
- Q1 TRUNCATE supprime; Q2 21 premium grand-peres + plafond actif apres verif /cgv /cgu; Q3 seuil 30 (UPDATE prod seulement sur autorisation explicite); Q4 19 inscrits sans consentement: gardes, exclus de tout envoi.
- RGPD: lister ici les 19 ids (pas d'emails) avant go-live.

## Phase 6 go-live (portfolio ubxllsvanurkwkohzxau) - re-baseline 2026-11-07
Source of truth: scripts/founder-offer-go-live/RUNBOOK.md. Rien ci-dessous n'est execute. Lectures = SELECT seulement; ecritures prod = humain, sur autorisation explicite.

### Ordre
1. [ ] Lectures pre-lancement (RUNBOOK 4-6): migrations portfolio presentes, ziko_app_config (cap=false, retention=3, seuil=200), 94 inscrits / 19 sans consentement, 21 premium tous is_lifetime_premium sur 40 profils.
2. [ ] Deploy code: merge PR milestone/v1.16-waitlist -> main (merge commit unique) = push main, Vercel API + web. Le job CI migrate-portfolio reste dormant (PORTFOLIO_MIGRATIONS_ENABLED non defini): aucune migration a appliquer, elles sont deja live. Verifier SHA deploye = SHA du merge.
3. [ ] Smoke test ziko_claim_waitlist_signup sur Postgres JETABLE uniquement (RUNBOOK 7). Jamais en prod: pas de TRUNCATE, pas de reset de sequence (seq=95).
4. [ ] SEUIL (humain, autorisation explicite requise):
   - Lecture: `SELECT value, jsonb_typeof(value) FROM public.ziko_app_config WHERE key='waitlist_reveal_threshold';` -> 200 / number
   - Tir: `UPDATE public.ziko_app_config SET value='30'::jsonb, updated_at=now() WHERE key='waitlist_reveal_threshold';`
   - Attendu: 1 ligne; relecture -> 30 / number (compteur visible des 170/200 reclames; 94 inscrits => cache)
   - Rollback: meme UPDATE avec '200'::jsonb
5. [ ] Gate legal: HTTP 200 sur /fr/cgv, /fr/cgu, /en/cgv, /en/cgu (domaine = NEXT_PUBLIC_SITE_URL) + un rendu navigateur.
6. [ ] Gate allocation finie: `SELECT count(*) FROM public.ziko_user_profiles p WHERE p.tier='premium' AND NOT EXISTS (SELECT 1 FROM public.ziko_ai_credit_transactions t WHERE t.user_id=p.id AND t.source='premium_grant' AND t.idempotency_key='premium_grant_'||to_char(now() AT TIME ZONE 'UTC','YYYY-MM'));` -> 0 (sinon declencher /credits/cron/premium-grant avant la bascule).
7. [ ] PLAFOND (humain, apres 5 ET 6):
   - Tir: `UPDATE public.ziko_app_config SET value='true'::jsonb, updated_at=now() WHERE key='premium_credit_cap_enabled';`
   - Relecture: `SELECT value, jsonb_typeof(value) ...` -> true / boolean (une chaine = flag inactif silencieusement)
   - Rollback: meme UPDATE avec 'false'::jsonb (effet immediat, creditGate relit a chaque requete, pas de deploy)
8. [ ] Parcours public (RUNBOOK 10) + evenement waitlist_signup dans Vercel Analytics.

### Grand-peres (Q2)
- 21 premium, tous is_lifetime_premium=true = fondateurs grand-peres; aucun downgrade. Allocation mensuelle finie PREMIUM_MONTHLY_GRANT=300 pour tous (cron 1er du mois), preremplie AVANT la bascule.

### RGPD (Q4): 19 inscrits sans consent_given_at - IDs uniquement (ziko_waitlist_signups.id)
Gardes, exclus de TOUT envoi (annonce, relance, export vers un outil d'emailing); traitement RGPD (effacement scripts/waitlist-erasure ou recueil du consentement) a decider hors Phase 6. Tout envoi doit filtrer `consent_given_at IS NOT NULL AND anonymized_at IS NULL`.
c97a5ef7-6eaf-4726-9e66-70e932b7e964
90dd9d81-a642-4762-800d-05a526ca662c
e15d8ac8-6c09-4e9f-aae6-b92f62320cfa
78cb00c1-998f-40c7-84a1-33201035c5ef
53dcaba0-4e5f-4f10-a825-17962d91945c
b2c262da-afa7-4453-a1d1-b82d27cdb1c5
1fc50a64-1ff9-4461-8e83-393c0bfaf6e5
781504bb-fe90-4cf3-b262-6e88f7fa87a9
7a47f449-838c-412e-b0d3-63f148c041b4
bed479a6-2239-487a-865a-032331a288e1
c6a7368e-6d11-4b9b-85e8-963a7f4c0a18
f4d45e4a-70ca-48ca-94f9-7e2d85115fc9
90526519-fd99-47db-bf0f-9459b64e3e26
51738dc7-1168-4f0d-97fc-5a1fe34830d5
af5a7df9-6322-4290-91f1-21bcf6112475
5201c69e-5c29-4394-8a82-3f97c7b342cf
2647f12d-4af6-4d2f-80a8-4dcaf1d22cbb
dd384f2e-c197-4172-a3b0-a6f763e032bf
f0bb38e7-4e5b-4d95-a1e0-34b719c0377a
(releves en lecture seule le 2026-11-07; re-verifier le compte avant usage: `SELECT count(*) FROM public.ziko_waitlist_signups WHERE consent_given_at IS NULL;` -> 19)

## Ajouts 2026-11-07 (soir)
- [ ] Migration REVOKE 20261107170000_ziko_revoke_client_dml.sql (99 tables ziko_*): a appliquer AVEC la sequence prod, apres verif mobile/web (risque: ecritures client JWT sur 22 tables a sous-ensemble). Rollback: GRANT inverse (matrices uat/privilege-matrix-before.txt).
- [x] Lecture prod: 21/21 premium ont premium_grant ce mois-ci: pas de cron manuel necessaire. api.ziko-app.com/health=200, ziko-app.com /fr/fondateurs /fr/cgv /fr/cgu = 200 (7 nov).
- [ ] Token ziko-ci-portfolio: NON revoque (decision utilisateur).
- Follow-ups: supplements anon-write (scraper), creditService fallback cle service, plugin pantry shopping_list non prefixe.

## STATUT hardening/ziko-client-dml
Migration 20261107170000_ziko_revoke_client_dml.sql (99 tables) NON APPROUVEE, NON APPLIQUEE: risque de casser mobile/web (ecritures directes JWT). A trancher par l'utilisateur. Le go-live a applique le REVOKE cible 20261107150000 (ziko_app_config, ziko_waitlist_signups).
