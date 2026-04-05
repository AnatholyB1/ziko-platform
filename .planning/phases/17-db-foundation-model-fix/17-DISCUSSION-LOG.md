# Phase 17: DB Foundation + Model Fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 17-db-foundation-model-fix
**Areas discussed:** Credit schema design, Welcome credits & initialization, Haiku model scope, Deduct RPC edge cases

---

## Credit Schema Design

### Transaction type set

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal set | `deduct`, `earn`, `welcome` — 3 types, extend later | |
| Full set now | `deduct`, `earn`, `welcome`, `daily_base`, `monthly_base`, `admin_adjust`, `premium_grant` — anticipates Phases 18–21 | ✓ |
| You decide | Claude picks based on requirements | |

**User's choice:** Full set now
**Notes:** Avoids migration churn as later phases land.

### Balance column type

| Option | Description | Selected |
|--------|-------------|----------|
| INTEGER | Whole credit units, clean CHECK constraint | ✓ |
| NUMERIC(10,2) | Fractional credits, more flexible | |
| You decide | Claude picks | |

**User's choice:** INTEGER
**Notes:** User clarified: 1 credit = EUR 0.001. Staying with integer is fine.

### Transaction row columns

| Option | Description | Selected |
|--------|-------------|----------|
| Lean | id, user_id, type, amount, source, idempotency_key, created_at | |
| Running balance | Lean + balance_after column | |
| Full audit | Lean + balance_after + metadata JSONB | ✓ |

**User's choice:** Full audit
**Notes:** JSONB metadata will help with Phase 19 cost reconciliation.

### balance_after computation

| Option | Description | Selected |
|--------|-------------|----------|
| RPC computes it | RPC reads balance, does math, writes balance_after | |
| BEFORE INSERT trigger | Trigger auto-fills from user_ai_credits.balance | ✓ |
| You decide | Claude picks | |

**User's choice:** BEFORE INSERT trigger
**Notes:** Guarantees consistency even if someone inserts a transaction row manually.

---

## Welcome Credits & Initialization

### New user credit initialization

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing trigger | Add credit insert to existing handle_new_user trigger | |
| New dedicated trigger | Separate trigger function on auth.users for credits only | ✓ |
| Application-level | creditService.getBalance() creates default row lazily | |
| You decide | Claude picks | |

**User's choice:** New dedicated trigger
**Notes:** Clean separation of concerns.

### Welcome credit amount strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Same amount (5) | Everyone gets 5, consistent | |
| Different amounts | Existing users get more as loyalty bonus | |
| Single constant | Define once as SQL variable, tweakable before deploy | ✓ |

**User's choice:** Single constant
**Notes:** Exact number decided at deploy time without code changes.

### Bulk insert idempotency

| Option | Description | Selected |
|--------|-------------|----------|
| ON CONFLICT DO NOTHING | Safe on accidental re-run | ✓ |
| Plain INSERT | Trust migrations run once | |
| You decide | Claude picks | |

**User's choice:** INSERT ... ON CONFLICT DO NOTHING

---

## Haiku Model Scope

### What "model fix" means

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing to replace — just verify | Grep audit confirming zero results | |
| Add new Haiku constant now | Define VISION_MODEL for Phase 19 | |
| Both | Grep audit + add constant | ✓ |

**User's choice:** Both — belt and suspenders.

### Where VISION_MODEL lives

| Option | Description | Selected |
|--------|-------------|----------|
| Same file (ai.ts) | Add next to AGENT_MODEL | |
| Shared constants file | Extract to backend/api/src/config/models.ts | ✓ |
| You decide | Claude picks | |

**User's choice:** Shared constants file
**Notes:** Both AGENT_MODEL and VISION_MODEL centralized.

---

## Deduct RPC Edge Cases

### Cost parameter signature

| Option | Description | Selected |
|--------|-------------|----------|
| Single INTEGER cost | Caller passes credit cost only | |
| cost + action_type | RPC also inserts transaction row | |
| cost + action_type + idempotency_key | Full atomic operation in one call | ✓ |

**User's choice:** Full atomic signature

### Return type

| Option | Description | Selected |
|--------|-------------|----------|
| Boolean | true/false | |
| JSONB | Rich success/failure with balance info | ✓ |
| Raise exception | RAISE EXCEPTION on failure | |

**User's choice:** JSONB
**Notes:** Gives middleware everything for 402 response without second query.

### Premium tier bypass

| Option | Description | Selected |
|--------|-------------|----------|
| RPC handles it | RPC reads tier, skips deduction for premium | |
| Caller-side | Middleware checks tier before calling RPC | ✓ |
| You decide | Claude picks | |

**User's choice:** Caller-side
**Notes:** Keeps RPC focused on credit math only.

---

## Claude's Discretion

- RLS sub-select caching pattern choice
- Migration numbering (026)
- Transaction type column implementation (TEXT+CHECK vs ENUM)
- Exact welcome credit amount (constant defined, value at deploy time)

## Deferred Ideas

None — discussion stayed within phase scope.
