// ─── AI Credit Constants ─────────────────────────────────────
// Single authoritative source for all credit cost and quota values.
// Consumers: creditService.ts, creditMiddleware.ts, Phase 20 earn hooks.
// When costs change, update ONE file. (D-08, D-09, D-10)

// Per-action credit costs deducted on each AI call (D-08, D-09)
export const CREDIT_COSTS = {
  chat: 4,
  scan: 3,
  program: 4,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Daily free quota per action:
//   base  = granted each day without any activity (daily_base grant)
//   bonus = max additional credits earnable via activity today (D-10)
export const DAILY_QUOTAS = {
  chat: { base: 1, bonus: 2 },
  scan: { base: 1, bonus: 2 },
} as const;

// Monthly free quota per action (D-10)
export const MONTHLY_QUOTAS = {
  program: { base: 1, bonus: 1 },
} as const;

// Number of credits awarded per earn event (EARN-07)
export const EARN_AMOUNT = 1;

// Maximum earn credits per day:
// chat bonus (2) + scan bonus (2) = 4
// Once a user has earned this many credits today, further earn calls are no-ops.
export const DAILY_EARN_CAP = DAILY_QUOTAS.chat.bonus + DAILY_QUOTAS.scan.bonus;
