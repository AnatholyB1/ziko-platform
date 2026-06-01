# 04-01 Summary — notifications-cron.ts handlers

**Status:** complete
**Commit:** d2a0291

## What was built

- Created `backend/api/src/routes/notifications-cron.ts`
- Exports `notificationsCronRouter` (Hono router, no authMiddleware)
- `verifyCronSecret()` helper — suit exactement le pattern `supplements.ts`
- GET /cron/check-receipts (CRON-02)
- GET /cron/streak-at-risk (CRON-01)
- GET /cron/weekly-digest (CRON-03)

## Verification passed

1. `npm run type-check` — TypeScript compilation completed (0 erreurs)
2. `backend/api/src/routes/notifications-cron.ts` existe et exporte `notificationsCronRouter`
3. `grep -c "cron/streak-at-risk\|cron/check-receipts\|cron/weekly-digest"` → 6 (3 définitions de route + 3 occurrences dans les commentaires JSDoc)
4. `grep "notificationsCronRouter" ... | grep export` → `export { notificationsCronRouter };`
5. `grep -c "verifyCronSecret"` → 4 (1 définition + 3 appels, un par handler)
6. `grep "is_active.*false"` → `.update({ is_active: false })` confirmé dans CRON-02
7. `grep "weekly_xp_digest"` → `.filter('type_prefs->>weekly_xp_digest', 'eq', 'true')` confirmé dans CRON-03

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Export double déclaration TypeScript**
- **Found during:** Task 1, premier type-check
- **Issue:** Utiliser `export const notificationsCronRouter = new Hono()` puis `export { notificationsCronRouter }` en bas du fichier causait TS2323/TS2484 (Cannot redeclare exported variable)
- **Fix:** Changé en `const notificationsCronRouter = new Hono()` (sans `export`) pour ne garder qu'un seul point d'export à la fin du fichier
- **Files modified:** backend/api/src/routes/notifications-cron.ts
- **Commit:** d2a0291

## Threat mitigations applied

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-04-01 Spoofing | `verifyCronSecret()` retourne 401 si header != `Bearer ${CRON_SECRET}` | Appliqué sur les 3 routes |
| T-04-02 DoS (CRON-03) | `idempotencyKey` UNIQUE en DB — doublons silencieusement ignorés | Appliqué |
| T-04-03 Info Disclosure | Toutes les queries admin filtrées par `.eq('user_id', userId)` | Appliqué |
| T-04-04 DoS (CRON-02) | Filtre `sent_at > NOW() - 24h` sur notification_log | Appliqué |

## Next step

Plan 04-02 : monter `notificationsCronRouter` dans `backend/api/src/app.ts` et configurer `vercel.json` avec les trois entrées cron.
