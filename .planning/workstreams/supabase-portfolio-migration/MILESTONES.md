# Milestones: supabase-portfolio-migration

[Entries in reverse chronological order - newest first]

## v1.19 Migration Supabase ziko vers portfolio (Shipped: 2026-10-06)

**Delivered:** Ziko's Supabase footprint (schema, auth, data, storage) now lives in the shared `portfolio` project under a `ziko_` / `ziko-` prefix, backend and web run on it in production, and the old `ziko` project was deleted on 2026-10-06 after a verified backup, a restore proof, a full verification and a separate explicit confirmation. The mobile flip was not achieved (waived).

**Phases completed:** 1-7 (7 phases, 82 plans; 268 `<task>` blocks across the PLAN files; the SDK's SUMMARY-based count of 25 tasks is unreliable for this workstream)

**Key accomplishments:**
- Live inventory of both projects (tables, functions, RLS, triggers, buckets, extensions), PII-safe collision report, version/extension diff and quota check before any migration code (Phase 1)
- Schema renamed and prefixed: 99 ziko tables and 33 functions recreated in portfolio as `ziko_*` through a new migration series, dry-run on a scratch project first, RLS on every table, automated stale-reference grep clean (Phase 2)
- Auth merged into portfolio's shared pool: 39 users, 38 with their ziko UUID preserved, 1 email collision merged under the existing portfolio UUID with a recorded UUID remap; auth triggers gated to `app=ziko` signups; redirect allow-list merged additively (Phase 3)
- Data copied and verified: every `ziko_*` table loaded via COPY with triggers disabled, sequences reconciled, row-count parity and FK validation with 0 orphans, re-runnable verification suite committed (Phase 4)
- Storage migrated: 10 `ziko-` buckets, 2,699 objects copied with SHA-256 verification, 25 `ziko_` storage policies rebuilt, signed-URL flows tested with real authenticated sessions (Phase 5)
- Cutover: backend flipped 2026-10-03 14:29Z, then web 15:08Z, each smoke-tested before the next; CI repointed; final tenant checks show 0 `rh_`/`gecko_` regression. Mobile flip NOT achieved and waived (Phase 6)
- Decommission: ziko write-frozen, encrypted cold backup taken, restore proven on a wiped scratch project, full per-table/per-bucket verification passed (99/99 tables, 2,699 objects), separate plain "yes" confirmation, ziko project `slkobhavpwsubnsmuhya` deleted 2026-10-06T13:59:22Z and confirmed gone (Phase 7)

**Stats:**
- 396 commits in range `652553df` → `5c9f4ea2` (2026-09-21 → 2026-10-06; range is on a shared branch history and may include a few unrelated commits)
- 647 files changed (+87,810 / -1,548 lines), of which 171 under `scripts/` and `supabase/` (+58,946 lines); about 24,400 lines of migration tooling (`.mjs`/`.sql`) in `scripts/portfolio-migration/` and `scripts/auth-merge/`
- 7 phases, 82 plans
- 15 days from milestone start (2026-09-21) to ship (2026-10-06)

**Git range:** `652553df` (docs: start milestone v1.19) → `5c9f4ea2` (docs(07): phase verification)

### Known Gaps

- **DECOM-01** (ziko kept live read-only for a rollback window tied to mobile binary renewal): WAIVED by the user on 2026-10-04 (D-01: no real mobile users, 39 ziko profiles, 0 new accounts since the flip). A write-freeze before the backup replaced the window. Not complete.
- **CUTOVER-03** (ordered backend → web → mobile flip): ticked with a waiver. Backend and web were flipped and smoked in order. Mobile was NOT achieved: iOS unreleased (provisioning profile lacks Sign in with Apple), Android 1.5.0 (versionCode 16) submitted to the Play production track with Play Console state unconfirmed, device checklist waived by the user; the app was never device-tested against portfolio.
- Gate `ci_token_revoked` in Phase 7 waived by the user (token `ziko-ci-portfolio` not revoked).

Known deferred items at close: 2 (see STATE.md Deferred Items)

**What's next:** No v2 for this workstream (one-shot migration). Carry-over items (credential revocations, cron 401s, iOS release, Play Console check, AI chat on portfolio, CI verify specs, leftover Vercel resources, backup retention review) are listed in the workstream STATE.md. Start the next milestone with `/gsd:new-milestone`.

---
