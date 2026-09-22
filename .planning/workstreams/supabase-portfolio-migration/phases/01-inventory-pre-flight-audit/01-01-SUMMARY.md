---
phase: 01-inventory-pre-flight-audit
plan: 01
subsystem: supabase-portfolio-migration / inventory-audit
tags: [supabase, postgres, inventory, rls, storage, capacity-planning]
dependency_graph:
  requires: []
  provides:
    - "01-INVENTORY.md: ziko Live Inventory (INV-01) section"
    - "01-INVENTORY.md: portfolio Live Inventory (INV-02) section"
    - "01-INVENTORY.md: Version & Extension Diff (INV-04) section"
    - "01-INVENTORY.md: Capacity & Quota Check (INV-05) section, with human-confirmed sufficient verdict"
  affects:
    - "Phase 2 (rename map) — table/function/bucket name lists feed the ziko_ prefix collision check"
    - "Phase 4 (data copy) — sequence-backed PK finding on portfolio's gecko_* tables"
    - "Phase 5 (storage migration) — 10-bucket ziko list (corrects prior '9 bucket' assumption)"
    - "01-02 (this phase's second plan) — collision report + executive summary build on this file"
tech_stack:
  added: []
  patterns:
    - "supabase db query --linked [--project-ref <ref>] \"<SQL>\" as the live inspection transport — one query per invocation"
    - "Two-phase query execution: structural/schema facts first (safe to commit), PII facts (auth.users) reduced to counts only"
key_files:
  created:
    - ".planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md"
  modified: []
decisions:
  - "Redacted the literal X-Webhook-Secret value found embedded in two ziko trigger definitions (push_user_xp_level_up, push_workout_session_end) before committing — trigger bodies are not normally PII-scoped in this phase's plan, but a live secret value is out of scope for a durable git-tracked audit file regardless"
  - "Kept function/parameter names containing the substring 'email' (anonymize_waitlist_signup, claim_waitlist_signup, normalize_waitlist_email) as accurate schema metadata rather than distorting them to satisfy a literal grep-based PII acceptance check — footnoted the distinction between schema identifiers and actual auth.users.email values"
  - "Plan-tier ceiling verdict recorded as human-confirmed 'sufficient' per D-03, with the one non-measurable sub-item (pooler client-connection limit) recorded as an explicit reasoned non-binding assessment rather than silently assumed"
metrics:
  duration: "~25 minutes active execution (Tasks 1-2 and Task 3's automated portion), plus a checkpoint pause awaiting human dashboard verification before Task 3 completion"
  completed: 2026-09-22
---

# Phase 1 Plan 1: Live Inventory & Capacity Pre-Flight Audit Summary

Live-queried structural inventory of both `ziko` and `portfolio` Supabase projects (schema, RLS, functions, triggers, storage, extensions, realtime), a strict version/extension diff, and a human-confirmed capacity/quota sufficiency verdict — all written into a new committed `01-INVENTORY.md`.

## What Was Built

Created `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` with four populated sections, each built from queries executed live this session (not carried over from `01-RESEARCH.md`'s earlier same-day snapshot):

**ziko Live Inventory (INV-01):** 99 tables (100% RLS-enabled), 37 functions (29 `SECURITY DEFINER`), 176 RLS policies, 20 triggers (2 on `auth.users`, 18 on `public`), 10 storage buckets (2,699 objects / ~205 MB), 25 storage RLS policies, 7 extensions, 0 realtime-publication members, 0 sequence-backed PKs, 42 MB DB size, `max_connections=60`, 39 `auth.users` (count only, no PII selected).

**portfolio Live Inventory (INV-02):** 34 tables (100% RLS-enabled) broken into the required 3-tenant classification — `gecko_*` (14 tables), `rh_*` (13 tables), and 7 unprefixed portfolio-own-app tables — 5 functions (2 `SECURITY DEFINER`, zero name collisions with ziko's 37), 50 RLS policies, 5 triggers (0 on `auth.users`, confirming no existing `handle_new_user`-equivalent), 7 storage buckets (2,125 objects / ~1,227 MB, zero name collisions with ziko), 17 storage RLS policies, 6 extensions, 20 MB DB size, `max_connections=60`, 5 `auth.users`.

**Version & Extension Diff (INV-04):** Both projects report byte-identical `SELECT version()` output (`PostgreSQL 17.6 on aarch64-unknown-linux-gnu, gcc 15.2.0`); the only distinguishing figure is the Supabase-internal build number (`17.6.1.084` vs `17.6.1.105`), not a SQL-visible version difference. Extension diff: `pg_net` + `unaccent` are ziko-only, `pg_cron` is portfolio-only, and the 5 shared extensions (`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`) have matching versions on both sides — no mismatches.

**Capacity & Quota Check (INV-05):** Combined post-migration DB size 62 MB, combined storage ~1.4 GB, both projects report `max_connections=60`. Org type confirmed live (`supabase orgs list`) as Vercel-marketplace-managed (`vercel_icfg_` slug prefix), meaning plan-tier/quota ceilings are not CLI/SQL-introspectable. Checkpoint raised, user replied with a live-confirmed **"sufficient"** verdict from the Vercel dashboard: Supabase Pro Plan + Micro Compute add-on (8 GB DB ceiling, 100 GB storage ceiling, 250 GB/month bandwidth) — both measured dimensions sit under 2% of ceiling. Verdict recorded verbatim in the file per D-03.

## New Findings Not in Prior Research

Two live findings surfaced this session that `01-RESEARCH.md` did not capture for `portfolio` (its own queries against portfolio were run, but these two specific query types were only reported for `ziko` in that document):

1. **Realtime publication membership on portfolio:** 3 tables (`orders`, `products`, `rh_notifications`) are members of `supabase_realtime` — none collide with any ziko table name.
2. **Sequence-backed (non-UUID) PKs on portfolio:** all 11 `gecko_*` tables' `id` columns use integer/bigint `nextval(...)` sequences, not UUIDs. Since none of ziko's 99 tables use sequence-backed PKs, there's no PK-type collision risk, but any Phase 4 migration tooling that assumes UUID-only PKs project-wide must not touch or reset these independent gecko counters.

Also corrected a labeling typo in `01-RESEARCH.md`'s own prose (it said "gecko_* (13)" and "rh_* (11)" but its own lists already enumerated 14 and 13 names respectively) — live query confirms the correct counts are 14 and 13 (total 34 unchanged).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — security/correctness] Redacted a literal webhook secret found embedded in trigger definitions**
- **Found during:** Task 1, capturing ziko's trigger list
- **Issue:** `pg_get_triggerdef()` output for `push_user_xp_level_up` and `push_workout_session_end` includes a literal `X-Webhook-Secret` header value as a hardcoded trigger argument (this is how `supabase_functions.http_request` is configured on these two triggers) — copying this verbatim into a permanent git-tracked audit file would leak a live secret.
- **Fix:** Replaced the secret value with `[REDACTED]` in the committed trigger-definition text; added an explicit security note in the file explaining the redaction and pointing to the Threat Flags section below.
- **Files modified:** `01-INVENTORY.md`
- **Commit:** `c7b3c3a9`

### Judgment Calls (not deviations, but worth flagging)

- **Function/parameter names containing "email" substring:** Task 1's acceptance criteria specifies `grep -ci "email"` should return 0 in the ziko section, reasoning "no query in this task selects an email column." Three legitimate function/parameter identifiers (`anonymize_waitlist_signup`'s `p_email` arg, `claim_waitlist_signup`'s `p_email` arg, and the function name `normalize_waitlist_email` itself) contain this substring as schema metadata, not as selected `auth.users.email` values. Distorting or omitting these would reduce the document's accuracy as Phase 2's rename-map input (D-04). Kept them accurate and added a footnote clarifying the distinction between schema identifiers (safe, already in migration files under version control) and actual PII row data (never selected in this task). No `auth.users.email` value appears anywhere in the file.

## Threat Flags

| Flag | File | Description |
|------|------|--------------|
| threat_flag: secret-exposure-in-schema-metadata | `01-INVENTORY.md` (ziko Triggers section) | Two ziko triggers (`push_user_xp_level_up`, `push_workout_session_end`) embed a literal webhook secret directly in their `pg_get_triggerdef()` output via a hardcoded `X-Webhook-Secret` HTTP header argument to `supabase_functions.http_request`. This is a pre-existing ziko architecture pattern (secret-as-trigger-argument rather than secret-as-env-var), not something introduced by this phase — flagging because it was directly observed while capturing this inventory and is out of this phase's scope to remediate. The secret value itself was redacted before commit; only the fact of its existence and mechanism is documented. |
| threat_flag: missing-ownership-check-on-storage-policies | `01-INVENTORY.md` (portfolio Storage RLS Policies section) | Four of portfolio's own storage RLS policies (`auth delete`/`auth upload` on `album-backgrounds`, `album-covers`, `album-photos`, `portfolio-photos`) qualify only on `bucket_id` with no `auth.uid()`/ownership check — any authenticated portfolio user can write/delete any object in those four buckets. This is pre-existing on portfolio's own app (unrelated to ziko), not a ziko migration action item — flagged for awareness only since it was directly observed. |

## Known Stubs

None — this phase produces a documentation artifact, not application code; no stubs applicable.

## Self-Check: PASSED

- FOUND: `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md`
- FOUND commit `c7b3c3a9` (Task 1 — ziko inventory)
- FOUND commit `349752e7` (Task 2 — portfolio inventory + version/extension diff)
- FOUND commit `2248b54b` (Task 3 partial — capacity measurements + org-type confirmation)
- FOUND commit `8affce26` (Task 3 complete — human-confirmed plan-tier verdict recorded)
- Confirmed `## Capacity & Quota Check (INV-05)` heading present with non-blank plan-tier verdict line (verbatim "sufficient" + confirmed ceiling numbers)
- Confirmed `supabase/config.toml` untouched throughout (T-01-01 mitigation) — file does not exist/is not tracked in this worktree, no drift detected
