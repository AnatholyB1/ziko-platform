---
phase: 06-cutover
plan: 14
status: awaiting-human-review
requirements: [CUTOVER-03]
---

# 06-14 Summary: final delta on portfolio

CUTOVER DELTA: PASS

- `13-cutover-delta.mjs --mode apply` on ubxllsvanurkwkohzxau exited 0 on the first run (578 s), authorized by the typed line logged in 06-AUTHORIZATIONS.md (48c5056f). No re-runs, no token-fill flags, trigger mode auto (replica).
- Steps (10, all exit 0): collision (39 src / 46 tgt / 38 imported / 1 known); delta-report 0 new, 0 password_changed, 0 other_changed; import 0 updated; waitlist setval 87; auth-verify PASS; load-probe PASS (TRUNCATE privilege 99/99); load-apply 99 ziko_ tables reloaded, 3169 rows, 3 URL rewrites; copy-apply copied=0 failed=0 (2699 objects, 214,205,001 bytes); verify-data --check all PASS; verify-storage --check all PASS.
- verify-data: counts 99/99, RLS 99/99, 18 triggers none disabled, 144 FKs validated 0 orphans, tenants 0 deltas vs pre-cutover baseline.
- verify-storage: 10 buckets / 25 policies match, 2699 objects equal bytes and hashes, rekey 36/36, URL leftovers 0, tenants 0 regressions.
- Destination-only storage objects: 0 (nothing deleted).
- Reports committed in 415f23d7 (PII-free). Auth baseline with full UUIDs kept local and untracked.

## Human review (Task 2)
Awaiting user reply `delta reviewed`.
