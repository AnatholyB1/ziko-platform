# 04-02 Summary — app.ts + vercel.json wiring

**Status:** complete
**Commit:** cd8a5f1

## What was built

- app.ts: import notificationsCronRouter from `./routes/notifications-cron.js` (ligne 15)
- app.ts: `app.route('/notifications', notificationsCronRouter)` monté après `notificationsRouter` (ligne 72)
- vercel.json: 3 nouvelles entrées cron (7 au total)
  - `/notifications/cron/streak-at-risk` → `0 21 * * *` (CRON-01, daily 21:00 UTC)
  - `/notifications/cron/check-receipts` → `*/15 * * * *` (CRON-02, toutes les 15 min — requiert Vercel Pro)
  - `/notifications/cron/weekly-digest` → `0 9 * * 0` (CRON-03, dimanche 09:00 UTC)

## Verification passed

1. `npm run type-check` — TypeScript compilation sans erreur (0 errors)
2. `grep "notificationsCronRouter" backend/api/src/app.ts` — 2 lignes (import + app.route)
3. `node -e "... v.crons.length ..."` — retourne 7
4. `streak-at-risk: true`, `check-receipts: true`, `weekly-digest: true` — tous les 3 paths présents

## Deviations from Plan

Aucune déviation. Les modifications étaient déjà présentes dans le dépôt (commitées dans cd8a5f1 lors d'un précédent agent docs(040-02)), ce qui a permis une exécution sans changement supplémentaire. Les vérifications confirment que le résultat attendu est en place.

## Threat mitigations applied

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-04-05 Spoofing | `verifyCronSecret()` implémenté dans 04-01 — retourne 401 avant toute query DB | Routes accessibles via app.ts |
| T-04-06 DoS Hobby plan | Schedule `*/15 * * * *` nécessite Vercel Pro — rejet visible au deploy si Hobby | Documenté dans vercel.json |

## Self-Check: PASSED

- `backend/api/src/app.ts` contient 2 occurrences de `notificationsCronRouter` (import + mount)
- `backend/api/vercel.json` contient 7 entrées cron dont les 3 paths `/notifications/cron/*`
- TypeScript compile sans erreur
- Commit cd8a5f1 vérifié via `git show cd8a5f1 --name-only`
