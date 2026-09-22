# Ziko → Portfolio Schema Migration — RUNBOOK

**Audience:** the person about to run this phase's dry-run-then-real-apply sequence against a
shared production Supabase project. Read this file before running anything.

---

## 1. Scratch project provisioning (SCHEMA-05)

**Corrected finding (2026-09-22):** `02-RESEARCH.md`'s Pitfall 1 documented that `portfolio`'s org
(`vercel_icfg_y5brWcl0o23xn4A50p4NAUFG`, Vercel-Marketplace-managed) can only have new Supabase
projects created via the Vercel dashboard, and that `supabase projects create` (CLI) and the MCP
`create_project` tool would both fail or be rejected. **This was empirically re-verified and found
incorrect for this org** — `supabase projects create` succeeded directly:

```bash
supabase projects create ziko-migration-scratch \
  --org-id vercel_icfg_y5brWcl0o23xn4A50p4NAUFG \
  --region eu-west-3 \
  --db-password "<generated>"
```

returned `status: ACTIVE_HEALTHY` and the project was independently confirmed via
`supabase projects list`. This contradicts Supabase's own docs (cited in RESEARCH.md as the
source of the dashboard-only claim) — the org type may not enforce that restriction in practice,
or the restriction may have changed. **Do not assume this generalizes to other Vercel-Marketplace
orgs without re-testing** — if the CLI command is rejected in a future run, fall back to the
original dashboard-only procedure below.

**Original (fallback) procedure, if CLI creation is ever rejected:**
1. Open the Vercel dashboard, navigate to the Integrations tab for the project that hosts the
   `portfolio` Supabase integration (installation `icfg_y5brWcl0o23xn4A50p4NAUFG`).
2. Use the Supabase-for-Vercel integration's "Create Database"/new-resource flow to provision a
   new, throwaway Supabase project in the same org. Name it clearly as scratch/dry-run.
3. Copy the new project's ref from Project Settings → General.

---

## 2. This execution's scratch project

| Field | Value |
|---|---|
| Project ref | `rkirvurggtgjlkeuhded` |
| Name | `ziko-migration-scratch` |
| Org | `vercel_icfg_y5brWcl0o23xn4A50p4NAUFG` (same org as `portfolio`) |
| Region | `eu-west-3` |
| Postgres version (live-confirmed) | `17.6` — matches `ziko`/`portfolio`'s `17.6.1.x` build family per `01-INVENTORY.md` |
| Linked locally | Yes — `supabase link --project-ref rkirvurggtgjlkeuhded` |

An earlier provisioning attempt created project ref `agrkkwqhgdiunovcpeju` with an uncaptured DB
password; it was deleted (`supabase projects delete agrkkwqhgdiunovcpeju --yes`) before
`rkirvurggtgjlkeuhded` was created. Only `rkirvurggtgjlkeuhded` should exist going forward.

---

## 3. Sequencing gate (the whole point of this phase's structure)

This migration is **irreversible-in-practice** once applied to a live, multi-tenant project
(`portfolio` hosts `rh_*`/`gecko_*` tenants that must see zero regression). The phase is
deliberately sequenced so nothing touches `portfolio` until a dry run has passed:

1. **Plan 03** generates the two migration files (schema+RLS, then functions+triggers+grants).
2. **Plan 04** builds the verification tooling (stale-reference grep, RLS-enabled check,
   authenticated owner/non-owner smoke test).
3. **Plan 05** `[BLOCKING]` applies the migration files to **this scratch project** via
   `supabase db push` and runs the full verification suite against it — the actual SCHEMA-05 dry
   run.
4. **Plan 06** is an explicit **human confirmation checkpoint** — the dry run must be reviewed and
   approved by a person before Plan 07 is allowed to run. This is the deliberate, cheap insurance
   a one-shot infrastructure consolidation still needs.
5. **Plan 07** `[BLOCKING]` applies the same, already-scratch-verified migration series to
   `portfolio` for real and re-runs the full verification suite against it.

**Never skip step 4.** Never apply the migration files to `portfolio` before they have applied and
verified clean against the scratch project first.

---

## 4. Teardown (not part of this phase — noted for later reference)

`supabase projects delete rkirvurggtgjlkeuhded --yes` should work per Supabase's CLI docs (already
exercised once in this session against the discarded `agrkkwqhgdiunovcpeju` project — confirmed
working). Teardown of the scratch project used for the real dry run is out of scope for this
phase; do it once Plan 07 has completed and the migration is confirmed live on `portfolio`.
