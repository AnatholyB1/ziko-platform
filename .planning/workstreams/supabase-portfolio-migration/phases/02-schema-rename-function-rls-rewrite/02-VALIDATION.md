---
phase: 2
slug: schema-rename-function-rls-rewrite
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | No existing framework directly applicable — this phase is DB-DDL-only; verification is SQL-query-based, optionally wrapped in a Node/vitest runner for consistency with `backend/api`'s existing test conventions |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `psql "<scratch-project-connection-string>" -f scripts/portfolio-migration/03-verify-post-apply.sql` |
| **Full suite command** | same file, run once against the scratch project (dry run) and again against `portfolio` (real apply) — this phase has no "unit vs integration" split, only "dry-run vs real" |
| **Estimated runtime** | ~30-60 seconds per run (SQL queries against a small schema) |

---

## Sampling Rate

- **After every task commit:** Run the relevant individual query from `03-verify-post-apply.sql` after each object class is rewritten (tables → functions → policies → triggers)
- **After every plan wave:** Run full `03-verify-post-apply.sql` + `04-rls-smoke-test.js` against the scratch project
- **Before `/gsd:verify-work`:** Full verification suite must be green against the scratch project first, then re-run green against `portfolio`
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-* | 01 | 1 | SCHEMA-01 | — | New migration applies cleanly, table count matches | integration (SQL) | `psql ... -f 03-verify-post-apply.sql` (table-count section) | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | SCHEMA-02 | T-2-01 | `SECURITY DEFINER` functions execute successfully against renamed tables | integration (SQL/manual RPC call) | `SELECT ziko_is_coach_of('<test-uuid>','<test-uuid>');` (and equivalents per function) | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | SCHEMA-03 | T-2-01 | RLS enabled + correct policies on all `ziko_*` tables | integration (SQL) | `03-verify-post-apply.sql` query 3 (relrowsecurity check) | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | SCHEMA-04 | T-2-01, T-2-02 | Zero unprefixed references in `pg_policies`/`pg_proc` (extended to `pg_trigger`) | integration (SQL) | `03-verify-post-apply.sql` queries 1-2 | ❌ W0 | ⬜ pending |
| 02-01-* | 01 | 1 | SCHEMA-05 | — | Full dry run succeeds on scratch project before `portfolio` | manual-only (gate) | N/A — phase's own top-level sequencing gate, not a single automated check | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/portfolio-migration/01-generate-rename-map.sql` — live `information_schema`/`pg_proc`/`pg_type` query, no existing equivalent
- [ ] `scripts/portfolio-migration/02-dump-and-rewrite.js` — DDL rewrite tooling, no existing equivalent
- [ ] `scripts/portfolio-migration/03-verify-post-apply.sql` — stale-reference + RLS-enabled grep, no existing equivalent (modeled on PITFALLS.md's query shapes, extended to `pg_trigger`)
- [ ] `scripts/portfolio-migration/04-rls-smoke-test.js` — per-table authenticated-query smoke test; existing `backend/api/test/rls/*.spec.ts` demonstrates the assertion *pattern* but cannot be reused verbatim against renamed/scratch-project fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scratch Supabase project creation | SCHEMA-05 | `portfolio`'s org is Vercel Marketplace-managed — Supabase's own docs confirm projects can only be created via the Vercel dashboard, not `supabase projects create` (CLI) or the MCP `create_project` tool | Create the scratch project manually via the Vercel dashboard (Integrations > Supabase), then link it locally with `supabase link --project-ref <scratch-ref>` before running the dry-run scripts |
| Dry-run success confirmation | SCHEMA-05 | Sequencing/process gate ("did we run the dry run first"), not a single automated code assertion | Confirm `03-verify-post-apply.sql` and `04-rls-smoke-test.js` both pass green against the scratch project before the same scripts are ever run against `portfolio` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
