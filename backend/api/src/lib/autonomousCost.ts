// Phase 47 (v1.18) OPS-03 — shared cost accounting for AUTONOMOUS (non
// credit-gated) AI calls.
//
// Writes one row to ziko_ai_cost_log with an explicit `source` so system-
// initiated spend (onboarding, retroactive recompute, weekly cron, reward
// selection) is queryable apart from athlete chat spend (source
// 'user_chat', the column default).
//
// Contract:
//   - fire-and-forget: returns void synchronously, never awaited by callers
//   - never throws, never rejects (sync throws and async rejections are
//     both swallowed and logged)
//   - never touches creditCheck / creditDeduct — autonomous spend is
//     platform opex and must not hit the athlete's credit balance
//
// Adoption note: coaching-engine/apply.ts (phase 45 owns it) still carries
// an inline insert for `weekly_review_cron` / `app_open_fallback`. It can
// switch to this helper later with no behaviour change:
//   logAutonomousCost(db, { userId, model: modelId, usage, source });

export const SOURCES = {
  onboardingAssess: 'onboarding_assess',
  onboardingRetroactive: 'onboarding_retroactive',
  weeklyReviewCron: 'weekly_review_cron',
  appOpenFallback: 'app_open_fallback',
  rewardSelection: 'reward_selection',
} as const;

export type AutonomousCostSource = (typeof SOURCES)[keyof typeof SOURCES];

export interface AutonomousCostUsage {
  inputTokens?: number | undefined;
  outputTokens?: number | undefined;
}

/** Minimal structural type: any Supabase client (or a test double). */
export interface CostLogDb {
  from(table: string): { insert(row: Record<string, unknown>): unknown };
}

export function logAutonomousCost(
  db: CostLogDb,
  params: {
    userId: string;
    model: string;
    usage: AutonomousCostUsage | undefined | null;
    source: AutonomousCostSource;
  },
): void {
  try {
    Promise.resolve(
      db.from('ziko_ai_cost_log').insert({
        user_id: params.userId,
        model: params.model,
        input_tokens: params.usage?.inputTokens ?? 0,
        output_tokens: params.usage?.outputTokens ?? 0,
        source: params.source,
      }),
    ).then(
      (res: unknown) => {
        const error = (res as { error?: unknown } | null | undefined)?.error;
        if (error) console.error(`[AutonomousCost:${params.source}] insert failed:`, error);
      },
      (err: unknown) => console.error(`[AutonomousCost:${params.source}] insert failed:`, err),
    );
  } catch (err) {
    console.error(`[AutonomousCost:${params.source}] insert failed:`, err);
  }
}
