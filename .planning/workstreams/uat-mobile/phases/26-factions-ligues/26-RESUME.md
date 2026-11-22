# Phase 26 : fichier de reprise

État : **terminée** (tranche verticale), gate verte après merge de `milestone/v1.20`. Branche `phase/26-factions` (aucun push, aucun merge dans `milestone/v1.20`).

Dernier travail : docs (`26-CONTEXT.md`, `26-UI-SPEC.md`, `UAT-PLAN.md`, `26-SUMMARY.md`), migrations 2601..2605 (fichiers), harnais SQL (`scripts/uat/p26-league-sql/run.mjs`, 114 PASS), backend `league/*` + `routes/league.ts`, mobile `plugins/community/src/league/*` + `screens/LeagueScreen.tsx`.

Suite possible (si l'utilisateur confirme les gray areas) : (1) écran web coach de création de défi collectif ; (2) trace de la transition dans `athlete_decisions` (migration qui étend le CHECK) ; (3) classement par cohorte anonymisée (hors tranche, voir 26-CONTEXT « Différé ») ; (4) rejouer `run.mjs` après tout changement de migration : `initdb` + `pg_ctl -o "-p 8206"` dans le scratchpad, `create database p26`, puis `P26_PG_URL=postgres://postgres@127.0.0.1:8206/p26 node scripts/uat/p26-league-sql/run.mjs`.
