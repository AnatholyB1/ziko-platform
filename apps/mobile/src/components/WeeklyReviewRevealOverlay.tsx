import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '@ziko/plugin-sdk';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { appStorage } from '../lib/storage';
import { useOverlayGateStore } from '../stores/overlayGateStore';
import {
  buildReviewViewModel,
  nextStep,
  type ReviewStep,
  type RewardGrantRow,
  type WeeklyDecisionOutcome,
} from '../lib/weeklyRewardViewModel';
import { WeeklyReviewRevealView } from './WeeklyReviewRevealView';

const SEEN_MARKER_KEY = 'weekly_review_seen';

interface AthleteStateReviewShape {
  last_review_at: string | null;
  current_focus_summary: string | null;
  points: number | null;
  decision: { outcome: WeeklyDecisionOutcome | null; created_at: string | null } | null;
  grants: RewardGrantRow[];
}

// Phase 45: the points / tier / reward reads are additive and best-effort. Any
// failure or missing column degrades to the Phase 44 layout (never blocks the
// reveal). Only ziko_athlete_state errors throw, as in Phase 44.
async function fetchReviewData(userId: string): Promise<AthleteStateReviewShape> {
  const { data, error } = await supabase
    .from('ziko_athlete_state')
    .select('last_review_at, current_focus_summary, points')
    .eq('user_id', userId)
    .single();
  if (error) throw error;

  let decision: AthleteStateReviewShape['decision'] = null;
  let grants: RewardGrantRow[] = [];
  try {
    const { data: d } = await supabase
      .from('ziko_athlete_decisions')
      .select('outcome, created_at')
      .eq('user_id', userId)
      .eq('decision_type', 'weekly_focus')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    decision = (d as AthleteStateReviewShape['decision']) ?? null;
    if (decision?.outcome?.tier_up === true) {
      const { data: r } = await supabase
        .from('ziko_athlete_rewards')
        .select('tier, granted_at, ziko_reward_catalog(key, kind, icon, label_fr, label_en)')
        .eq('user_id', userId)
        .order('granted_at', { ascending: false })
        .limit(4);
      grants = ((r ?? []) as unknown as Array<Record<string, any>>).flatMap((row) => {
        const cat = Array.isArray(row.ziko_reward_catalog) ? row.ziko_reward_catalog[0] : row.ziko_reward_catalog;
        return cat ? [{ tier: row.tier, granted_at: row.granted_at, ...cat } as RewardGrantRow] : [];
      });
    }
  } catch {
    // keep the Phase 44 layout
  }

  return {
    last_review_at: (data as any).last_review_at ?? null,
    current_focus_summary: (data as any).current_focus_summary ?? null,
    points: typeof (data as any).points === 'number' ? (data as any).points : null,
    decision,
    grants,
  };
}

// Reveal moment shown once per completed weekly review (D-03). Mounted as a
// Tabs sibling in apps/mobile/app/(app)/_layout.tsx so it can fire from any
// tab. Phase 44 look (dark exception, 44-UI-SPEC) extended by Phase 45 into a
// 1 to 3 step sequence (result, tier-up, reward) inside the same Modal; see
// WeeklyReviewRevealView and 45-DESIGN-CONTRACT.md.
export function WeeklyReviewRevealOverlay() {
  const { t, locale } = useTranslation();
  const userId = useAuthStore((s) => s.user?.id);
  const reduceMotion = useReducedMotion();

  const [seenMarker, setSeenMarker] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<ReviewStep>('result');

  useEffect(() => {
    appStorage.getString(SEEN_MARKER_KEY).then((v) => setSeenMarker(v));
  }, []);

  const { data } = useQuery<AthleteStateReviewShape | null>({
    queryKey: ['weekly-review-reveal', userId],
    queryFn: () => fetchReviewData(userId as string),
    enabled: !!userId,
  });

  const vm = useMemo(
    () =>
      buildReviewViewModel({
        outcome: data?.decision?.outcome,
        stateTotal: data?.points,
        decisionCreatedAt: data?.decision?.created_at,
        grants: data?.grants,
        locale,
      }),
    [data, locale],
  );

  // Grounding rule (44-UI-SPEC.md): never render from incomplete, pending or
  // failed review data — only a non-null last_review_at AND a non-empty
  // current_focus_summary AND a marker mismatch make the overlay visible.
  const isNewReview =
    !!data?.last_review_at &&
    !!data?.current_focus_summary &&
    seenMarker !== undefined &&
    data.last_review_at !== seenMarker;

  const isVisible = isNewReview && !dismissed;

  // Publish visibility so the Phase 46 unlock toast queues behind this overlay.
  useEffect(() => {
    useOverlayGateStore.getState().setWeeklyReviewOpen(isVisible);
    return () => useOverlayGateStore.getState().setWeeklyReviewOpen(false);
  }, [isVisible]);

  // Android back / gesture and the final CTA dismiss every step and write the
  // seen marker (as Phase 44).
  const dismiss = () => {
    if (data?.last_review_at) {
      appStorage.set(SEEN_MARKER_KEY, data.last_review_at);
      setSeenMarker(data.last_review_at);
    }
    setDismissed(true);
    // Phase 46 (D-06): the review may have raised the tier; re-read the level so
    // newly unlocked plugins register without a restart.
    useAuthStore.getState().refreshLevel().catch(() => {});
  };

  const onCta = () => {
    const next = nextStep(vm, step);
    if (next) setStep(next);
    else dismiss();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <WeeklyReviewRevealView
        vm={vm}
        step={step}
        focus={data?.current_focus_summary ?? ''}
        t={t}
        reduceMotion={reduceMotion}
        onCta={onCta}
      />
    </Modal>
  );
}
