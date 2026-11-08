// Phase 47b (v1.18, OPS-02) - weekly-review-complete push notification.
//
// Sent from applyWeeklyDecision AFTER the decision RPC succeeded, only for the
// cron source (the on-open fallback already shows the in-app overlay).
// Fire-and-forget: a push failure must never fail the weekly decision.
// Copy is non-punitive French: a quiet week is met with encouragement, no
// loot/luck wording, and a reward is "choisie pour toi par Ziko".
import { notificationService } from '../services/notificationService.js';
import type { GrantRewardResult } from './rewards.js';
import type { WeeklyReviewSource } from './apply.js';

// Under the allowlisted '/(app)/(plugins)/' prefix (apps/mobile notificationRoutes.ts).
export const WEEKLY_REVIEW_DEEP_LINK = '/(app)/(plugins)/coach/dashboard';

export interface WeeklyReviewNotifyInput {
  userId: string;
  weekOf: string;
  source: WeeklyReviewSource;
  trajectory: 'escalate' | 'hold' | 'de-escalate';
  summaryChanged: boolean;
  tierUp: boolean;
  rewards?: GrantRewardResult[];
}

export interface WeeklyReviewCopy {
  title: string;
  body: string;
}

/** Returns the notification copy, or null when nothing worth a push happened. */
export function buildWeeklyReviewCopy(
  input: Pick<WeeklyReviewNotifyInput, 'trajectory' | 'summaryChanged' | 'tierUp' | 'rewards'>,
): WeeklyReviewCopy | null {
  const granted = (input.rewards ?? []).flatMap((r) => (r.granted ? [r.reward] : []));
  if (granted.length > 0) {
    return {
      title: 'Ta récompense de la semaine est prête',
      body: `Ton bilan est prêt. Récompense choisie pour toi par Ziko : ${granted[0].label_fr}.`,
    };
  }
  if (input.tierUp) {
    return {
      title: 'Nouveau palier atteint',
      body: 'Bravo pour ta régularité. Ton bilan de la semaine est prêt.',
    };
  }
  if (input.trajectory === 'escalate') {
    return {
      title: 'Ton bilan de la semaine est prêt',
      body: 'Ton plan évolue pour t’accompagner un cran plus loin.',
    };
  }
  if (input.trajectory === 'de-escalate') {
    return {
      title: 'Ton bilan de la semaine est prêt',
      body: 'On adapte ton plan pour repartir sereinement, à ton rythme. Tu as toute notre confiance.',
    };
  }
  if (input.summaryChanged) {
    return {
      title: 'Ton bilan de la semaine est prêt',
      body: 'Ton focus de la semaine est mis à jour.',
    };
  }
  return null;
}

/** Never throws. Callers do not await it. */
export async function notifyWeeklyReviewComplete(input: WeeklyReviewNotifyInput): Promise<void> {
  if (input.source !== 'weekly_review_cron') return;
  try {
    const copy = buildWeeklyReviewCopy(input);
    if (!copy) return;
    await notificationService.send({
      recipientUserId: input.userId,
      // 'coach' is the pref category; the type_prefs key is ai_weekly_analysis.
      category: 'coach',
      type: 'ai_weekly_analysis',
      title: copy.title,
      body: copy.body,
      data: { url: WEEKLY_REVIEW_DEEP_LINK },
      idempotencyKey: `weekly_review_${input.userId}_${input.weekOf}`,
    });
  } catch (err) {
    console.error('[WeeklyReview] push notification failed (ignored):', err);
  }
}
