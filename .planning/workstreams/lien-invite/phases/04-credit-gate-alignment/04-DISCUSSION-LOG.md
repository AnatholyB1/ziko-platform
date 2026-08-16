# Phase 4: Credit-Gate Alignment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-15
**Phase:** 4-Credit-Gate Alignment
**Areas discussed:** CRED-01 production audit, Monthly credit allowance, Founder-to-premium scope boundary

---

## CRED-01 production audit

| Option | Description | Selected |
|--------|-------------|----------|
| The "ziko" project (slkobhavpwsubnsmuhya) IS production — run the count now | Resolve immediately via the connected Supabase MCP tool. | ✓ |
| Production is a different project — user gets the count themselves | Safer if this session's MCP access shouldn't touch real production. | |

**User's choice:** "ziko" project is production — ran `SELECT count(*) FROM public.user_profiles WHERE tier='premium'` directly.
**Result:** 0. A-01 confirmed true. See CONTEXT.md D-01.

---

## Monthly credit allowance

| Option | Description | Selected |
|--------|-------------|----------|
| 300 credits/month | ~10x a fully-engaged free user's chat volume; generous but capped. | ✓ |
| 1000 credits/month | Much more generous, ~3x higher cost ceiling. | |

**User's choice:** 300 credits/month.
**Notes:** See CONTEXT.md D-02.

---

## Founder → premium conversion scope boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope for this milestone | The redemption flow (waitlist win → tier='premium') is deferred, like ENG-01–05. Phase 4 builds the grant mechanism, not the flow. | ✓ |
| Phase 4 builds a minimal manual admin path | A one-off script/RPC for an admin to flip a specific user's tier. | |

**User's choice:** Out of scope for this milestone.
**Notes:** See CONTEXT.md D-04.

---

## Claude's Discretion

- Migration filename/numbering for `grant_premium_credits()` and `is_lifetime_premium`.
- `app_config` key name and default for the CRED-05 feature flag.
- Cron schedule/route naming for the monthly grant job.
- Idempotency key format for the grant ledger row.

## Deferred Ideas

- The founder-to-`tier='premium'` redemption flow — future milestone.
- Flipping the feature flag in production — Phase 6.
