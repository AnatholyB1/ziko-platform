# MILESTONE-RUN v1.16
| date | etape | branche | commit | gate | ouvert |
|---|---|---|---|---|---|
| 2026-11-07 | setup worktree integration-v1.16 | milestone/v1.16-waitlist | 71d240e7 | - | audit coherence ziko_ en cours; questions Phase 6 en attente |
| 2026-11-07 | merge phase/06-coherence | milestone/v1.16-waitlist | 82251211 | web 207 pass/4 skip (touched dirs), backend 179 pass; 1 fail retention-config (CRLF sha, preexisting?), web tsc errors in purge tests (preexisting?) | questions 1-4 sans reponse; RLS specs + CI apply non prouves (DB requise) |
| 2026-11-07 | merge phase/06-replan + phase/06-uat | milestone/v1.16-waitlist | c1574b8f | web vitest 332 pass/9 skip/1 fail (retention-config sha CRLF); tsc web 47 err only in test/purge (typage mjs), backend tsc 0; lint+build NON relances | UAT 36/36 jetable; RLS suite 123/129 (6 echecs listes); grants anon/auth larges sur ziko_* (RLS deny-all en prod, 0 policy): MED a decider |
| 2026-11-07 | merge phase/06-revoke-rls (migration 20261107170000_ziko_revoke_client_dml.sql, 6 specs triaged) | milestone/v1.16-waitlist | 47e4d633 | web 332 pass/1 preexisting fail, lint 0 err, build OK, backend tsc 0, backend 179 pass; RLS disposable 129/129 | go-live prod NON execute: autorisation relayee par agent seulement |
