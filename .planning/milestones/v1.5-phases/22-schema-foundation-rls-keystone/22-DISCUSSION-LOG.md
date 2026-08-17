# Phase 22: Schema Foundation & RLS Keystone — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `22-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 22-schema-foundation-rls-keystone
**Areas discussed:** Link lifecycle + is_coach_of(), Profiles & invitations field inventory, ai_imports shape, Smoke test + migration safety

---

## Gray Area Selection

| Area | Selected |
|------|----------|
| Link lifecycle + is_coach_of() | ✓ |
| Profiles & invitations field inventory | ✓ |
| ai_imports shape (Phase 22 vs Phase 28) | ✓ |
| Smoke test + migration safety | ✓ |

User selected all four candidates — no areas deferred at selection time.

---

## Area 1: Link lifecycle + is_coach_of()

### Q1 — Lifecycle modeling on `coach_client_links`

| Option | Description | Selected |
|--------|-------------|----------|
| Pure timestamps (Recommended) | `revoked_at`, `expires_at` only. Active = both NULL or expires_at > now(). No cron. | ✓ |
| Status enum + timestamps | `status TEXT` + timestamps. Function reads status='active'. Requires cron. | |
| Hybrid: GENERATED column | `status` GENERATED ALWAYS AS (...) STORED. | |

**User's choice:** Pure timestamps
**Notes:** "Expired = revoked" enforced at predicate level. No cron dependency.

### Q2 — `is_coach_of()` predicate

| Option | Description | Selected |
|--------|-------------|----------|
| Inline predicate (Recommended) | SQL function, STABLE SECURITY DEFINER, EXISTS(... WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())). | ✓ |
| Status-driven | EXISTS(... WHERE status='active'). Requires pg_cron. | |
| PLPGSQL with logging | NOTICE/audit per call. Performance hit on every RLS row. | |

**User's choice:** Inline predicate
**Notes:** Single SQL function — fastest, simplest, no cron risk. Runs on every read across 11 tables.

### Q3 — SECURITY DEFINER hardening

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing pattern (Recommended) | STABLE SECURITY DEFINER SET search_path=public,pg_temp; schema-qualified refs; REVOKE/GRANT. | ✓ |
| Stricter (extra paranoid) | Above + STRICT modifier + plpgsql guard on caller mismatch. | |
| Defer hardening | Minimal SECURITY DEFINER now; retro pass later. | |

**User's choice:** Match existing pattern (migration 026 `earn_ai_credits`)

### Q4 — RLS hot-path index strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Partial unique on active (Recommended) | UNIQUE INDEX (coach_id, client_id) WHERE revoked_at IS NULL. Doubles as roadmap's required partial UNIQUE. | ✓ |
| Compound non-partial | INDEX (coach_id, client_id, revoked_at, expires_at). | |
| Two indexes split | Active lookup + cleanup separate. | |

**User's choice:** Partial unique on active links
**Notes:** Smallest, fastest. Roadmap's required partial UNIQUE comes for free.

---

## Area 2: Profiles & invitations field inventory

### Q5 — `coach_profiles` column inventory

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum-viable (Recommended) | user_id, display_name, bio, specialties[], website, photo_url, kyc_status, kyc_docs, timestamps. | ✓ |
| Lean: skip KYC for now | Drop kyc_status/kyc_docs; Phase 24 ALTERs. | |
| Full + admin verification | Above + verified_by, verified_at, rejection_reason. | |

**User's choice:** Minimum-viable (includes kyc_status + kyc_docs so Phase 24 onboarding ships zero ALTERs)

### Q6 — Invitation code storage

| Option | Description | Selected |
|--------|-------------|----------|
| Plaintext + unique (Recommended) | TEXT UNIQUE CHECK (code ~ '^[A-Z2-9]{6}$'). Coach can see active codes. | ✓ |
| Hashed (sha256) | code_hash UNIQUE. Coach can't see plaintext after creation. | |
| Plaintext + masked display | Plaintext for lookup; masked first2+last2 in list. | |

**User's choice:** Plaintext + unique index
**Notes:** 887M entropy + Phase 25 rate limiting defeats brute force. Phase 25 success criterion 1 requires coach to see active codes in a list.

### Q7 — `coach_invitations` column inventory

| Option | Description | Selected |
|--------|-------------|----------|
| Full Phase 25 set (Recommended) | id, coach_id, code, client_email, expires_at default 14d, used_at, used_by, revoked_at, max_uses default 1, use_count, created_at. Status derived. | ✓ |
| Single-use only | Drop max_uses/use_count. Simpler RPC. | |
| Add audit metadata | Above + redeemed_ip, redeemed_user_agent. | |

**User's choice:** Full Phase 25 set
**Notes:** Zero follow-up ALTERs for Phase 25. `max_uses` ships with DEFAULT 1 (future-proof for group invitations).

### Q8 — `redeem_invitation_code` constant-time timing

| Option | Description | Selected |
|--------|-------------|----------|
| Implement now (Recommended) | Constant-time + uniform return shape in Phase 22. Phase 25 only adds Upstash rate limiting. | ✓ |
| Minimal viable now | Timing-leaky RPC; Phase 25 hardens. | |
| Pure lookup only | SELECT helper in 22; Phase 25 does the INSERT logic. | |

**User's choice:** Implement constant-time now
**Notes:** Roadmap names `redeem_invitation_code` as a Phase 22 deliverable; ship-it-hardened so Phase 25 is purely additive.

---

## Area 3: ai_imports shape & workout_programs extensions

### Q9 — `ai_imports` schema granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Full Phase 28 schema (Recommended) | All fields including mime_type CHECK, size_bytes ≤25MB, status enum, parsed_data, confidence_scores, re_upload_source_id self-FK. | ✓ |
| Skeleton + JSONB blob | id, user_id, file_url, status, parsed_data JSONB-only. Promote later. | |
| Minimal placeholder | id, user_id, status only. Heavy ALTER in Phase 28. | |

**User's choice:** Full Phase 28 schema
**Notes:** Phase 28 ships zero schema changes. coach-sdk types can derive from this from Phase 23 onward.

### Q10 — `ai_imports` RLS

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-only RLS now (Recommended) | ENABLE RLS + single FOR ALL policy USING auth.uid() = user_id. No coach SELECT. | ✓ |
| Owner + coach SELECT | Above + FOR SELECT with is_coach_of. | |
| No RLS yet | Table without RLS, service-role only. Phase 28 adds RLS. | |

**User's choice:** Owner-only RLS
**Notes:** Coaches who import in `coach_template` mode own those rows themselves — no cross-user SELECT needed.

### Q11 — `weeks_data` JSONB validation

| Option | Description | Selected |
|--------|-------------|----------|
| Zod-only via coach-sdk (Recommended) | No DB CHECK. ImportedProgramSchema in packages/coach-sdk is single source of truth. | ✓ |
| DB CHECK for top-level shape | jsonb_typeof + key existence at DB. | |
| Strict CHECK + GIN index | Full shape CHECK + GIN for search. | |

**User's choice:** Zod-only via coach-sdk
**Notes:** Safety relies on ARCH-03 (no service-role under coach/). Trade-off explicitly captured for reviewers.

### Q12 — `workout_programs` extension FK strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Full FKs with ON DELETE SET NULL (Recommended) | created_by_coach_id, assigned_to_user_id, template_source_id all FK with SET NULL. Matches Open Architectural Decision #4. | ✓ |
| FKs with ON DELETE CASCADE | Strict GDPR purge. Conflicts with Open Decision #4. | |
| Defer FK decision | Columns without FK now; add later. | |

**User's choice:** Full FKs with ON DELETE SET NULL

---

## Area 4: Smoke test & migration safety

### Q13 — Smoke test placement

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest + Supabase clients (Recommended) | backend/api/test/rls/coach-rls.spec.ts using two anon-key JWTs + admin. Runs on every cross-user migration PR. | ✓ |
| pgTAP SQL fixture | Pure SQL via psql. Requires new tool. | |
| Manual checklist | Markdown checklist. Not CI-enforceable. | |

**User's choice:** Vitest + Supabase clients
**Notes:** STATE.md mandate of "run on every migration after Phase 22" is satisfied by CI gate on `supabase/migrations/**` paths.

### Q14 — `user_profiles.role` backfill strategy

| Option | Description | Selected |
|--------|-------------|----------|
| NOT NULL DEFAULT 'client' (Recommended) | Single ALTER. PG11+ metadata-only fast path. Zero downtime on large tables. | ✓ |
| Two-step: nullable add, UPDATE, SET NOT NULL | Safer pattern when table size unknown. Over-engineering on PG11+. | |
| Drop NOT NULL | Allow NULL legacy rows; COALESCE in app. | |

**User's choice:** NOT NULL DEFAULT 'client' (single-step ALTER)

### Q15 — Migration packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Three files, sequential apply (Recommended) | 034_coach_role_profiles.sql, 035_coach_invitations_links_rls.sql, 036_workout_programs_ai_imports.sql per roadmap. | ✓ |
| Single fat migration | All in one 034_v15_keystone.sql. | |
| Three files + CONCURRENTLY post-deploy | Extra script for index/RLS additions outside main tx. | |

**User's choice:** Three files, sequential apply
**Notes:** 035 starts with `SET LOCAL lock_timeout = '5s'` because it touches 11 existing tables.

### Q16 — `apply_migration` vs `execute_sql`

| Option | Description | Selected |
|--------|-------------|----------|
| apply_migration only (Recommended) | All DDL via Supabase MCP apply_migration. File-on-disk audit trail. | ✓ |
| Mixed: apply_migration for DDL + execute_sql for backfill | Data state diverges from migrations. | |
| Local supabase-cli only | Push from CI without MCP. | |

**User's choice:** apply_migration only

---

## Claude's Discretion

The planner has flexibility on:
- The exact constant-time pattern inside `redeem_invitation_code` (work-equalization shape, whether `pg_sleep` floor is needed, error code surface).
- The list of `error_code` values returned by `redeem_invitation_code`.
- `updated_at` trigger reuse vs. new shared one.
- Whether `coach_profiles` RLS lives in 034 and `coach_invitations` RLS in 035, or both in 035 — but both must exist before the smoke test runs.
- Exact test-user-creation pattern in the Vitest spec (canonical: Supabase admin `auth.admin.createUser`).

## Deferred Ideas

(None surfaced from inside the discussion; out-of-scope candidates captured in CONTEXT.md `<deferred>` section.)
