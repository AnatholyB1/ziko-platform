import { createClient } from '@supabase/supabase-js';
import {
  CREDIT_COSTS,
  DAILY_QUOTAS,
  MONTHLY_QUOTAS,
  EARN_AMOUNT,
  DAILY_EARN_CAP,
  type CreditAction,
} from '../config/credits.js';

// ─── Supabase Client ─────────────────────────────────────────
// Same pattern as middleware/auth.ts — service key for server-side mutations
const supabaseUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Types ───────────────────────────────────────────────────

/** Quota status for a given action — returned to credit middleware (CRED-02) */
export interface QuotaStatus {
  /** True when the user's usage count is within their free+earned quota for today/month */
  withinFreeQuota: boolean;
  /** Number of times the user has used this action today (or this month for program) */
  dailyUsed: number;
  /** Total quota available (base + earned bonus) */
  dailyQuota: number;
  /** Current credit balance */
  balance: number;
  /** Actionable earn hint shown to the user in the credit-exhausted UI */
  earnHint: string;
}

// ─── Helpers ────────────────────────────────────────────────

/** Returns current date in YYYY-MM-DD format (UTC) */
function getTodayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

/** Returns ISO string for the first day of the current UTC month */
function getFirstOfMonthUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Returns the current credit balance for a user.
 * Creates a default row with balance=0 if the user does not yet have one.
 * (CRED-03: every user has a credit row before any AI call)
 */
export async function getBalance(userId: string): Promise<{ balance: number }> {
  // Upsert creates the row on first call; ignoreDuplicates preserves the existing balance
  await supabase
    .from('user_ai_credits')
    .upsert({ user_id: userId, balance: 0 }, { onConflict: 'user_id', ignoreDuplicates: true });

  const { data, error } = await supabase
    .from('user_ai_credits')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { balance: 0 };
  }

  return { balance: data.balance as number };
}

/**
 * Awards EARN_AMOUNT credit(s) for a qualifying activity.
 *
 * Rules enforced:
 * - EARN-07: daily earn cap (DAILY_EARN_CAP total credits per day across all sources)
 * - EARN-10: idempotency — same (userId, source, idempotencyKey) tuple inserts exactly once
 *   via partial unique index (user_id, source, idempotency_key WHERE idempotency_key IS NOT NULL).
 *   On a 23505 unique-violation the function returns { credited: false } — safe for mobile retry.
 *
 * Balance increment uses read-then-write (acceptable: earn races only ever add; minor
 * underpayment favours the platform and is not a correctness issue).
 */
export async function earnCredits(
  userId: string,
  source: string,
  idempotencyKey: string,
): Promise<{ credited: boolean }> {
  const todayUTC = getTodayUTC();

  // Check daily earn cap (EARN-07)
  const { count } = await supabase
    .from('ai_credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'earn')
    .gte('created_at', `${todayUTC}T00:00:00Z`);

  if ((count ?? 0) >= DAILY_EARN_CAP) {
    return { credited: false };
  }

  // Insert earn transaction — partial unique index enforces ON CONFLICT DO NOTHING at DB level
  // If idempotency_key is already used for this (user_id, source), Supabase returns error code 23505
  const { error: insertError } = await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    type: 'earn',
    amount: EARN_AMOUNT,
    source,
    idempotency_key: idempotencyKey,
  });

  if (insertError) {
    // 23505 = unique_violation — duplicate idempotency key (EARN-10)
    if (insertError.code === '23505') {
      return { credited: false };
    }
    // Other DB error — do not increment balance
    return { credited: false };
  }

  // Read-then-write balance increment (earn races add only; minor underpayment ok)
  const { balance: currentBalance } = await getBalance(userId);
  await supabase
    .from('user_ai_credits')
    .update({ balance: currentBalance + EARN_AMOUNT })
    .eq('user_id', userId);

  return { credited: true };
}

/**
 * Atomically deducts credits for an AI action by calling the SECURITY DEFINER RPC.
 * The RPC uses SELECT FOR UPDATE to prevent negative balances under concurrent requests.
 * (CRED-02: deduction is atomic and race-safe)
 *
 * Returns the success flag, updated balance, and required amount on failure.
 */
export async function deductCredits(
  userId: string,
  action: CreditAction,
  idempotencyKey: string,
): Promise<{ success: boolean; balance: number; required?: number }> {
  const { data, error } = await supabase.rpc('deduct_ai_credits', {
    p_user_id: userId,
    p_cost: CREDIT_COSTS[action],
    p_action_type: action,
    p_idempotency_key: idempotencyKey,
  });

  if (error || !data) {
    return { success: false, balance: 0, required: CREDIT_COSTS[action] };
  }

  // RPC returns JSONB: { success: true, balance_after: N } | { success: false, balance: N, required: N }
  const result = data as { success: boolean; balance_after?: number; balance?: number; required?: number };
  return {
    success: result.success,
    balance: result.balance_after ?? result.balance ?? 0,
    required: result.required,
  };
}

/**
 * Computes whether the user is within their free daily (or monthly) quota for an action.
 *
 * Free quota = base (always granted) + bonus (earned via activity today up to the action's cap).
 * - Daily actions (chat, scan): quota resets every UTC day.
 * - Monthly actions (program): quota resets every UTC month.
 *
 * (CRED-02: quota gate; EARN-07: earn count drives quota expansion)
 */
export async function getQuotaStatus(userId: string, action: CreditAction): Promise<QuotaStatus> {
  const todayUTC = getTodayUTC();
  const todayStart = `${todayUTC}T00:00:00Z`;

  const EARN_HINTS = [
    'Log a workout to earn credits',
    'Complete your habits to earn credits',
    'Log a meal to earn credits',
    'Log a stretch to earn credits',
    'Log a cardio session to earn credits',
    'Log body measurements to earn credits',
  ];
  const earnHint = EARN_HINTS[0];

  // Count today's earn transactions (to compute earned bonus)
  const { count: earnCount } = await supabase
    .from('ai_credit_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'earn')
    .gte('created_at', todayStart);

  const todayEarnCount = earnCount ?? 0;

  let dailyUsed: number;
  let dailyQuota: number;

  if (action === 'program') {
    // Monthly quota
    const firstOfMonth = getFirstOfMonthUTC();
    const { count: monthlyUsed } = await supabase
      .from('ai_credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source', 'program')
      .gte('created_at', firstOfMonth);

    dailyUsed = monthlyUsed ?? 0;
    dailyQuota =
      MONTHLY_QUOTAS.program.base + Math.min(todayEarnCount, MONTHLY_QUOTAS.program.bonus);
  } else {
    // Daily quota for chat and scan
    const quotaConfig = DAILY_QUOTAS[action as keyof typeof DAILY_QUOTAS];
    const { count: usedToday } = await supabase
      .from('ai_credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source', action)
      .gte('created_at', todayStart);

    dailyUsed = usedToday ?? 0;
    dailyQuota = quotaConfig.base + Math.min(todayEarnCount, quotaConfig.bonus);
  }

  const { balance } = await getBalance(userId);

  return {
    withinFreeQuota: dailyUsed < dailyQuota,
    dailyUsed,
    dailyQuota,
    balance,
    earnHint,
  };
}
