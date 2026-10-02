# Phase 6: Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-03
**Phase:** 6-Cutover
**Areas discussed:** Mobile tail strategy, Write-freeze & final delta, Flip sequence & rollback, Smoke test & tenant regression

---

## Mobile tail strategy

| Question | Options | Selected |
|----------|---------|----------|
| How installed apps move to portfolio | OTA + store build / Store build only / Forced OTA + min-version gate | OTA + store build |
| Old binaries after flip | Ziko read-only + banner / Keep ziko writable / Hard cut | Hard cut |
| Re-login notice date | Set date at plan time / Decide after smoke | **Other: no need to send email, nobody is using prod right now** |
| Build scope | Prepare + publish OTA / Prepare only | Prepare + publish OTA |

**Notes:** User noted prod has no active users, which simplified later areas.

## Write-freeze & final delta

| Question | Options | Selected |
|----------|---------|----------|
| Freeze formality | Lightweight / Backend 503 / Full maintenance | Lightweight |
| Delta sequence | Scripted runbook, confirm once / Confirm each step / Skip delta | Scripted runbook, confirm once |
| Delta vs flip order | Delta → verify → flip / Flip then delta | Delta → verify → flip |

## Flip sequence & rollback

| Question | Options | Selected |
|----------|---------|----------|
| Codemod vs env flip | Vercel preview first / Local only / Merge first | Vercel preview first |
| Flip order | Backend → web → mobile OTA / Backend+web together | Backend → web → mobile OTA |
| Rollback | Revert env + redeploy / Fix forward | Revert env + redeploy |

## Smoke test & tenant regression

| Question | Options | Selected |
|----------|---------|----------|
| Smoke method | Scripted + manual mobile / All manual / Fully scripted | Scripted backend/web + manual mobile |
| Tenant regression | Baseline diff + test signups / Baseline diff only | Baseline diff + test signups |
| Signup flag/OAuth | Flag at all call-sites, OAuth off / + lazy provisioning | Flag at all call-sites, OAuth off |
| CI repoint timing | After backend+web, before mobile / At the end | After backend+web, before mobile |

## Claude's Discretion

Runbook script naming, env file switching/secret hygiene, smoke checklist structure, Vercel preview mechanics, OTA channel naming, Vercel env scopes.

## Deferred Ideas

Min-version gate for old binaries; OAuth lazy-provisioning; `profile-photos` quirk fix.
