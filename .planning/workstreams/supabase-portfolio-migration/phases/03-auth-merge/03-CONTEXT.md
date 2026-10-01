# Phase 3: Auth Merge - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Ziko's 39 `auth.users` (+ `auth.identities`) are written into `portfolio`'s shared auth pool with UUIDs and password hashes preserved, the one known email collision is resolved, the Ziko-only `auth.users` triggers are attached in a way that cannot fire for `rh_*`/`gecko_*` signups, portfolio's auth config is merged additively, Ziko users are notified of the post-cutover re-login, and `ziko_waitlist_founder_seq` is set from ziko's live value. Out of scope: data copy (Phase 4), storage (Phase 5), backend/web/mobile cutover and the backend auth-middleware tenant check (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Email Collision (1 account)
- **D-01:** The colliding user (ziko `auth.users.id` `ea0f0b65-6681-4780-8ee0-dbf20b95d4d9`, masked `a***@***.com`) is confirmed by the user to be the **same person** as the existing portfolio account.
- **D-02:** **Portfolio's UUID wins.** The existing portfolio `auth.users` row is untouched (zero regression on `rh_*`/`gecko_*`). Phase 4's data copy must remap `user_id` `ea0f0b65…` → the portfolio UUID across every `ziko_*` table/column that references it (scripted, with a dedicated verification step). This is the single exception to "IDs preserved".
- **D-03:** For the merged user, **keep portfolio's password**; copy any ziko `auth.identities` (OAuth links) re-pointed to the portfolio UUID. Do not copy ziko's `encrypted_password` for this user. The user is told via the re-login notice (D-12).
- **D-04:** Re-run the collision check immediately before the real write and again at final delta sync (ziko is live; the collision set can grow). Any *new* collision is a blocking human checkpoint, never auto-resolved (Phase 1 D-01).

### Trigger Scoping
- **D-05:** `ziko_handle_new_user` / `ziko_handle_new_user_credits` are gated by a **signup metadata flag**: they early-return unless `NEW.raw_user_meta_data->>'app' = 'ziko'`. Mobile, web, and backend signup paths (including OAuth) must pass `options.data { app: 'ziko' }` — the call-site changes belong to Phase 6; Phase 3 delivers the gated functions and documents every signup path that must set the flag.
- **D-06:** **Sequencing:** import the 39 users with **no triggers attached** (avoids duplicate profile/credit rows, since Phase 4 copies those). Then attach the gated triggers on `portfolio`'s `auth.users` after import and before cutover (completes the deferral from Phase 2 D-02).
- **D-07:** Verification (success criterion 3): a test signup on an `rh_*`/`gecko_*` path produces zero Ziko-side rows, and a flagged Ziko test signup produces profile + credits. Test users are cleaned up afterwards.

### User Import Mechanism
- **D-08:** Write users via **direct SQL `INSERT` into `auth.users` and `auth.identities`** (service-role/Postgres connection, in a transaction), copying id, `encrypted_password`, metadata, timestamps, and confirmation fields exactly. This deviates from ROADMAP/REQUIREMENTS wording ("Admin API `createUser`") in favor of full fidelity for IDs, hashes and identities; validate with real login tests on a sample of users in the scratch rehearsal.
- **D-09:** The import script is **idempotent** (`ON CONFLICT (id) DO NOTHING`, collision pre-check). Flow: rehearse on the Phase 2 scratch project → real run on `portfolio` in Phase 3 → **delta re-run right before Phase 6 cutover** to catch signups made on ziko in between. `ziko_waitlist_founder_seq` `setval` is read live from ziko at that final run (87 on 2026-10-01 — never hardcode).

### Auth Config & Notification
- **D-10:** Email templates are global per project and cannot be additive, so **portfolio's existing templates are kept untouched**. Ziko-specific mail goes through the backend/Resend path already in place. Redirect URLs (and any providers/site URL entries) are merged **additively** — snapshot portfolio's config before and diff after to prove nothing was removed/overwritten.
- **D-11:** Document the JWT-secret consequence: ziko sessions cannot carry over, all 39 users must re-login after cutover.
- **D-12:** Notify users by **email via Resend (FR primary, EN) plus an in-app banner/alert on the current ziko app**. Phase 3 delivers the recipient list, template and send script; the actual send date is chosen during Phase 6 planning (a few days before cutover).

### Claude's Discretion
- Script language/location for import, collision check, and verification (must follow repo conventions; `.js` import suffix rule applies to backend TS).
- Exact set of `auth.users` columns copied (all non-generated columns, excluding anything instance-specific such as `instance_id` which must be set to portfolio's value).
- Format of the auth-config before/after snapshot and PII-safe handling (no raw emails in git-tracked files, per Phase 1 protocol).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phases
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-INVENTORY.md` — Collision Report (1 email collision, masked), the 2 unscoped `auth.users` triggers, portfolio has 0 triggers on `auth.users`, 5 portfolio users, Postgres 17.6 parity
- `.planning/workstreams/supabase-portfolio-migration/phases/01-inventory-pre-flight-audit/01-CONTEXT.md` — D-01 collision policy (manual resolution only; PII-safe handling)
- `.planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-CONTEXT.md` — D-01 (`ziko_` function prefix), D-02 (trigger functions created but not attached until Phase 3), D-03 (scratch project for dry runs)
- `.planning/workstreams/supabase-portfolio-migration/phases/02-schema-rename-function-rls-rewrite/02-VERIFICATION.md` — state of the `ziko_*` schema Phase 3 builds on

### Migration research (this workstream)
- `.planning/workstreams/supabase-portfolio-migration/research/PITFALLS.md` — Pitfall 1 (auth collisions), Pitfall 3 (unscoped `auth.users` triggers)
- `.planning/workstreams/supabase-portfolio-migration/research/STACK.md` — Admin API / hash pass-through notes, session-mode connection requirement
- `.planning/workstreams/supabase-portfolio-migration/research/ARCHITECTURE.md` — auth-merge build order, backend auth middleware gap (Phase 6)
- `.planning/workstreams/supabase-portfolio-migration/research/SUMMARY.md`

### Milestone-level docs
- `.planning/workstreams/supabase-portfolio-migration/REQUIREMENTS.md` — AUTHMIG-01..05
- `.planning/workstreams/supabase-portfolio-migration/ROADMAP.md` — Phase 3 goal and 6 success criteria
- `C:\Users\Anatholy\.claude\projects\C--ziko-platform\memory\project_supabase_portfolio_migration.md` — cross-session decision record

### Project docs
- `CLAUDE.md` — Supabase env var names, backend `.js` import rule, `SUPABASE_SERVICE_ROLE_KEY` restrictions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Supabase MCP tools (`mcp__claude_ai_Supabase__*`) — `execute_sql`, `get_project`, `list_tables` for live inspection and verification on ziko, portfolio, and the scratch project.
- Phase 2's scratch Supabase project and `ziko_*` migrations — rehearsal target for the import script.
- `RESEND_API_KEY` / `packages/email` templates — path for the re-login notice.

### Established Patterns
- PII handling from Phase 1: raw emails only in ephemeral scratchpad, deleted after use; only masked identifiers in tracked files.
- Idempotent, re-runnable verification scripts committed to the repo (Phase 2 pattern).

### Integration Points
- Signup call sites in `apps/mobile`, `apps/web`, `backend/api` (incl. OAuth) must set `options.data { app: 'ziko' }` — implemented in Phase 6, enumerated here.
- `backend/api/src/middleware/auth.ts` accepts any valid portfolio JWT — tenant check is Phase 6.

</code_context>

<specifics>
## Specific Ideas

- The collision account is the user's own/known account (same person) — handle with a dedicated, scripted UUID remap rather than manual SQL.

</specifics>

<deferred>
## Deferred Ideas

- Backend auth middleware tenant check and signup call-site metadata changes — Phase 6.
- Actual send date of the re-login notice — decided in Phase 6 planning.
- "Trigger + lazy provisioning fallback" (idempotent ensure-profile on first login) — considered as a hardening option; revisit in Phase 6 if flag coverage proves incomplete.

</deferred>

---

*Phase: 3-Auth Merge*
*Context gathered: 2026-10-01*
