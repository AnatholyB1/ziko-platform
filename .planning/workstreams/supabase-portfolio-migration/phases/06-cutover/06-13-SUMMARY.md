---
phase: 06-cutover
plan: 13
status: complete
requirements: [CUTOVER-03]
---

# 06-13 Summary: final-delta pre-flight and authorization

- Preconditions: auto-chain false; `SCRATCH CUTOVER REHEARSAL: PASS` (06-10, AI check waived by user); `PREVIEW SMOKE: PASS` (06-12, AI check waived by user).
- Read-only delta plan: source users 39, target 46, already imported 38, new 0, collisions 1 (known, same as 06-02), password_changed 0, other_changed 0. No UUID list needed; no reviewed-password-count required.
- Loader plan: 99/99 tables column-identical; every ziko_ table count matches; 144 FKs (97 to auth.users); trigger mode replica.
- Storage plan: 10 buckets, 2,699 objects, policies 25/25; 31 objects need raw cache-control upload; 3 rows with ziko storage URLs rewritten in flight.
- Checks all exit 0: storage-policies, rls (99/99), triggers (18, 0 disabled), fk (144 validated), orphans 0, sequence, counts.
- Baselines committed (deeb9107): portfolio-tenants-precutover.json, portfolio-storage-tenants-precutover.json (no '@', no full UUIDs). Auth baseline `scripts/auth-merge/baseline/portfolio-baseline-precutover.json` holds 136 full UUIDs and is kept local/untracked.
- Freeze estimate: ~8-10 min (scratch apply ~470 s).
- User typed `approve ubxllsvanurkwkohzxau option-cutover-delta`; logged in 06-AUTHORIZATIONS.md (48c5056f).
