# Phase 3: Auth Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 3-Auth Merge
**Areas discussed:** Email collision resolution, Trigger scoping to Ziko, User import mechanism + delta, Auth config merge + notice

---

## Email collision resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Same person | Pick merge strategy | ✓ |
| Different people | New email for one side | |
| Not sure yet | Blocking human checkpoint | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep portfolio UUID, remap ziko FKs | Other tenants untouched; Phase 4 remaps one user | ✓ |
| Keep ziko UUID, change portfolio user's id | Mutates live shared-tenant user | |
| Drop ziko account | Lose ziko data | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep portfolio password; add ziko OAuth identities | | ✓ |
| Keep portfolio row entirely, no identity copy | | |

**User's choice:** Same person; portfolio UUID wins; keep portfolio password, copy ziko identities re-pointed.

---

## Trigger scoping to Ziko

| Option | Description | Selected |
|--------|-------------|----------|
| Signup metadata flag | `raw_user_meta_data->>'app' = 'ziko'` gate | ✓ |
| No trigger; lazy provisioning | Backend creates profile on first call | |
| Trigger + lazy fallback | Most robust, most work | |

| Option | Description | Selected |
|--------|-------------|----------|
| After import, before cutover | Import without triggers, then attach | ✓ |
| Attach first, import with flag-guard | | |

**User's choice:** Metadata flag; attach after import and before cutover.

---

## User import mechanism + delta

| Option | Description | Selected |
|--------|-------------|----------|
| Direct SQL INSERT into auth.users + auth.identities | Highest fidelity | ✓ |
| Admin API createUser with password_hash | Per roadmap wording | |
| Hybrid | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rehearse on scratch, idempotent final run at cutover | Delta re-run before Phase 6 | ✓ |
| Single run now, freeze signups | | |
| Single run at cutover only | | |

**User's choice:** Direct SQL; idempotent script, scratch rehearsal, real run in Phase 3, delta before cutover.

---

## Auth config merge + notice

| Option | Description | Selected |
|--------|-------------|----------|
| Keep portfolio's templates; Ziko mail via backend/Resend | | ✓ |
| Merge into tenant-neutral templates | | |
| Use Ziko's templates | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Email via Resend + in-app banner | | ✓ |
| Email only | | |
| Defer wording to Phase 6 | | |

**User's choice:** Keep portfolio templates; email + in-app banner (send date chosen in Phase 6).

---

## Claude's Discretion

- Script language/location, exact copied columns, snapshot format and PII-safe handling.

## Deferred Ideas

- Backend middleware tenant check and signup call-site changes (Phase 6); notice send date (Phase 6); lazy-provisioning fallback.
