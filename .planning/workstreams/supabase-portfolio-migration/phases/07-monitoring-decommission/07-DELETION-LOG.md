# ziko deletion log

- Deleted at (UTC): 2026-10-06T13:59:22.157Z (one Management API DELETE, accepted)
- Confirmed gone at (UTC): 2026-10-06T13:59:33.891Z
- Project name: ziko
- Project ref: slkobhavpwsubnsmuhya
- Method: api (no dashboard fallback used)
- Pre-delete identity: name ziko, status ACTIVE_HEALTHY, region eu-west-1
- Post-delete: portfolio ACTIVE_HEALTHY, production health api 200 and web 200 (07-18)
- Authorization: 07-17 D-15 confirmation (plain "yes", 2026-10-06T13:56:46Z)

## Evidence pointers

- freeze_proven: scripts/portfolio-migration/reports/decom-freeze-proof.json (sha256 3ec52574b8a3692ad756bf4e75feb8b911a50c7662a5cc428a6cebe3244d1756)
- backup_encrypted: scripts/portfolio-migration/reports/decom-backup-manifest.json (sha256 fa9ffe92f3e9d86f86a8d151789b38389ed0701b72185c4337d41488c83982cd); archive sha256 prefix 1732e313ee71
- restore_proven: scripts/portfolio-migration/reports/decom-restore-proof.json (sha256 e0941c8caf99ebb28eee07f6d6dc9ffc73629f59eed3c1462222d3d4d0dd912c)
- verify_pass: scripts/portfolio-migration/reports/decom-verify.json (sha256 2657d34ac9d8148e79183b8465bd0ecea386b2a7bb2fd39065ea4356df8c7bc9)
- env_scopes_clean: scripts/portfolio-migration/reports/decom-env-audit.json (sha256 a603cc68519feb2343c280530aca40dd77072ee3ec7315a681b579138ef90161)
- ci_off_scratch: scripts/portfolio-migration/reports/decom-ci-offscratch.json (sha256 05d0a2b71e22f1f6a7ec6a361c626abfdaae687ed785845aa571730ee303077a)
- scratch_deleted: scripts/portfolio-migration/reports/decom-scratch-deleted.json (sha256 6b64c5ee3920289bb5161686d14a134bb34fea23992cd149e0ecfaac48889cbb)
- delete report: scripts/portfolio-migration/reports/decom-delete.json
- machine-readable log: scripts/portfolio-migration/reports/decom-deletion-log.json
- credential retirement report: scripts/portfolio-migration/reports/decom-credentials-retired.json

## Authorization blocks (07-AUTHORIZATIONS.md)

- 07-11 second copy (2026-10-04T20:27:24Z)
- 07-15 ci token waiver (2026-10-05T12:25:16Z)
- 07-16 scratch deletion (2026-10-05T21:46:45Z)
- 07-17 D-15 confirmation (2026-10-06T13:56:46Z)
- 07-19 credential retirement (2026-10-06T14:09:52Z, reply "not now")
- 07-01 DECOM-01 waiver (2026-10-04)

## Gates (decom-gates.json)

| Gate | Result | Basis |
|------|--------|-------|
| freeze_proven | passed | decom-freeze-proof.json |
| backup_encrypted | passed | decom-backup-manifest.json |
| backup_second_copy | passed | block 07-11 |
| restore_proven | passed | decom-restore-proof.json |
| verify_pass | passed | decom-verify.json |
| env_scopes_clean | passed | decom-env-audit.json |
| ci_off_scratch | passed | decom-ci-offscratch.json |
| ci_token_revoked | WAIVED by user | block 07-15 ci token waiver; token ziko-ci-portfolio NOT revoked |
| scratch_deleted | passed | decom-scratch-deleted.json |
| confirmation_yes | passed | block 07-17 |

## Waivers

- DECOM-01 (rollback window) was WAIVED by the user (D-01, 2026-10-04): no real mobile users, 39 ziko profiles, 0 new accounts since the flip. A write-freeze replaced the window. DECOM-01 is not recorded as complete.
- ci_token_revoked was WAIVED by the user.
- The dashboard leftover check was verified by Claude via the read-only Vercel CLI, not by the user.
- decom-verify.json: 2 tables without a timestamp column were not content-compared.

## Outstanding items (not closed by the deletion)

- Supabase PATs `ziko-cutover-phase6` and `ziko-decom-phase7` NOT revoked (user chose "not now"; the second value was pasted into the chat during Phase 7); Vercel Protection Bypass for Automation secret on web and API NOT rotated; stale token `ziko-ci-portfolio` live (waived). `ziko-ci-portfolio-2` stays.
- Backup passphrase file kept until the user confirms the archive decrypts; portfolio login-role sweep not run.
- Phase 6 credential retirement (06-20 Task 3) remains open.
- Deferred to milestone close-out: API crons 401; iOS release (Sign in with Apple in provisioning profile); Play Console state of Android 1.5.0 (versionCode 16); Anthropic balance / AI chat never verified on portfolio; orphan test PNG in ziko-coach-exercises (bucket gone with ziko, confirm nothing needed); backup retention review at 6 months (GDPR, by 2027-04-06); CI remote verify specs disabled; leftover Vercel resources `redis-crimson-brush`, `redis-ziko`, Neon `potsgres-ziko`; PR #46 (phase 7) and PR #44 (docs) open.

This deletion is the final action of milestone v1.19.
