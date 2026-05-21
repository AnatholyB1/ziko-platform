## Deferred from 28-01

### Pre-existing RLS test failure (out of scope)
- **File:** `backend/api/test/rls/coach-profiles.spec.ts`
- **Failure:** `expected 4 to be 1` on `SELECT` row isolation in `coach_profiles` RLS test
- **Introduced by:** Pre-existing before Phase 28 (not caused by Plan 28-01 changes)
- **Action:** Do not auto-fix — unrelated to imports subsystem. Flag for investigation in a separate session.
