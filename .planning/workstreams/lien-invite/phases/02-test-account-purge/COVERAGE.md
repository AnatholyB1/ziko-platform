# Phase 2 — API Coverage Matrix

**Detector:** `api-coverage.cjs --json` returned `detected: true` on a single signal —
`"backup step, and the deletion script itself — built and rehearsed through the same Admin API path"`.
That sentence describes **reuse** of an already-integrated API, not a new integration. Re-reading the
phase scope confirms two distinct external surfaces, handled separately below.

---

## 1. Supabase Auth Admin API — pre-integrated, not a new integration

No external API integration: the Auth Admin API (`auth.admin.listUsers`, `auth.admin.deleteUser`) is
already integrated and running in production at `apps/web/src/actions/account.ts:40-42` and
`:84-85`, reached through the existing `createAdminClient()` factory
(`apps/web/src/lib/supabase/admin.ts`). Phase 2 calls the same two methods through the same
service-role client construction and adds no new authentication, transport, or vendor surface.

Recorded for completeness, the two methods this phase reuses:

| capability | decision | reason |
|---|---|---|
| `auth.admin.listUsers` (paginated enumeration) | `INTEGRATE` | Dry-run enumeration of `auth.users` |
| `auth.admin.deleteUser` (single-user cascade delete) | `INTEGRATE` | The only deletion path permitted by PURGE-04 |

---

## 2. Supabase Management API — genuinely new, narrowly scoped

`grep -rn "api.supabase.com"` over the repo returns zero hits, so `GET
/v1/projects/{ref}/database/backups` (consumed by `scripts/purge-test-accounts/pitr.mjs` to satisfy
D-04's "PITR status is checked, not assumed") is a new external surface. It is scoped to the
**Database Backups** capability group; the rest of the Management API is out of this phase's reach.

| capability | decision | reason |
|---|---|---|
| `GET /v1/projects/{ref}/database/backups` (read `pitr_enabled`, `walg_enabled`, backup list) | `INTEGRATE` | The literal thing D-04 requires — PITR status read, never assumed |
| `POST /v1/projects/{ref}/database/backups/restore-pitr` (trigger a PITR restore) | `OPT-OUT` | D-04 makes PITR the *secondary* backstop behind the row export; triggering a project-wide restore is a disruptive incident-response action a human takes in the dashboard, never an unattended script |
| `GET/POST /v1/projects/{ref}/secrets` | `OPT-OUT` | Phase reads no project secrets through the Management API; credentials arrive via environment variables |
| `GET/PATCH /v1/projects/{ref}/config/auth` | `OPT-OUT` | Phase changes no auth configuration — it deletes accounts, it does not reconfigure the provider |
| `GET/POST /v1/projects/{ref}/branches` | `OPT-OUT` | No database branching in this phase; the purge targets one production project directly |
| `POST /v1/projects/{ref}/database/query` (arbitrary SQL) | `OPT-OUT` | PURGE-04 forbids raw bulk SQL against `auth`; routing SQL through the Management API would launder exactly the path the requirement bans |
| `GET/POST /v1/projects` (project create/list/delete) | `OPT-OUT` | Phase operates on one existing project; project lifecycle is out of scope |
| `GET/POST /v1/projects/{ref}/functions` | `OPT-OUT` | No edge functions in this codebase's purge path |
| `GET /v1/organizations`, `/v1/projects/{ref}/upgrade` | `OPT-OUT` | Billing and plan management are unrelated to account deletion |

**Degradation contract:** when `SUPABASE_ACCESS_TOKEN` is absent or the call fails, `pitr.mjs`
records `status: "unknown"` rather than guessing. The delete script then refuses to proceed without
an explicit `--accept-unknown-pitr` flag, so an unavailable Management API downgrades to a
deliberate human decision instead of a silent assumption.

---

*Written during phase 2 planning, 2026-08-13.*
