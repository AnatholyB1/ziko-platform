// Phase 45 (REWARD-01..05): pure view-model for the weekly review reveal.
//
// Everything here is I/O-free so the design-contract checks (A-06, A-08, A-09,
// A-10, A-12, A-13, A-14, A-16) are unit-testable without a renderer. The
// overlay reads the weekly_focus decision outcome (points_outcome,
// points_earned, points_total, tier, tier_up) and the reward row granted
// after it, then this module decides which steps exist and what each shows.

/** Mirrors backend coaching-engine/rewards.ts TIER_THRESHOLDS (D-02). Tier 1 is the start. */
export const TIER_THRESHOLDS: Readonly<Record<number, number>> = { 2: 50, 3: 150, 4: 300 };
export const MIN_TIER = 1;
export const MAX_TIER = 4;

export type ReviewStep = 'result' | 'tierUp' | 'reward';
export type PointsKind = 'met' | 'exceeded' | 'missed';
export type RewardKind = 'badge' | 'title' | 'theme';

/** weekly_focus decision `outcome` JSON (backend apply.ts). Every field may be missing on pre-45 rows. */
export interface WeeklyDecisionOutcome {
  points_outcome?: unknown;
  points_earned?: unknown;
  points_total?: unknown;
  tier?: unknown;
  tier_up?: unknown;
}

export interface RewardGrantRow {
  tier: number;
  granted_at: string;
  key: string;
  kind: string;
  icon: string;
  label_fr: string;
  label_en: string;
}

export interface PointsView {
  kind: PointsKind;
  earned: number;
  total: number;
  previousTotal: number;
  tier: number;
  /** Next tier threshold, or null at the top tier. */
  barMax: number | null;
  /** Bar start/end as 0..1 ratios. from <= to always (D-07: never backward). */
  barFrom: number;
  barTo: number;
}

export interface TierUpView {
  tier: number;
  total: number;
  tierCount: number;
  hasReward: boolean;
}

export interface RewardView {
  tier: number;
  name: string;
  kind: RewardKind;
  icon: string;
}

export interface ReviewViewModel {
  steps: ReviewStep[];
  points: PointsView | null;
  tierUp: TierUpView | null;
  reward: RewardView | null;
}

function asCount(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Next threshold above `tier`, or null when `tier` is the top tier. */
export function nextThreshold(tier: number): number | null {
  const next = TIER_THRESHOLDS[tier + 1];
  return typeof next === 'number' ? next : null;
}

function pointsKindOf(raw: unknown): PointsKind | null {
  return raw === 'met' || raw === 'exceeded' || raw === 'missed' ? raw : null;
}

/**
 * A-12 grounding: a points card exists only when the decision outcome carries
 * known numbers AND they agree with the live athlete state (stale or partial
 * data renders the Phase 44 layout unchanged). `no_target` weeks have no card.
 */
export function buildPointsView(
  outcome: WeeklyDecisionOutcome | null | undefined,
  stateTotal: number | null | undefined,
): PointsView | null {
  if (!outcome) return null;
  const kind = pointsKindOf(outcome.points_outcome);
  const earned = asCount(outcome.points_earned);
  const total = asCount(outcome.points_total);
  const tier = asCount(outcome.tier);
  if (!kind || earned === null || total === null || tier === null) return null;
  if (typeof stateTotal === 'number' && stateTotal !== total) return null;
  const safeEarned = Math.min(earned, total);
  const previousTotal = total - safeEarned;
  const safeTier = Math.min(MAX_TIER, Math.max(MIN_TIER, tier));
  const barMax = nextThreshold(safeTier);
  const barTo = barMax === null ? 1 : clamp01(total / barMax);
  const barFrom = barMax === null ? 1 : Math.min(barTo, clamp01(previousTotal / barMax));
  return { kind, earned: safeEarned, total, previousTotal, tier: safeTier, barMax, barFrom, barTo };
}

function normalizeKind(raw: string): RewardKind | null {
  return raw === 'badge' || raw === 'title' || raw === 'theme' ? raw : null;
}

/**
 * A-13: the reward step exists only when this decision raised the tier AND a
 * reward row for that tier was granted at/after the weekly decision. Names
 * come from the catalog row (fr/en by locale), never from the client.
 */
export function pickReward(
  outcome: WeeklyDecisionOutcome | null | undefined,
  decisionCreatedAt: string | null | undefined,
  grants: readonly RewardGrantRow[] | null | undefined,
  locale: string,
): RewardView | null {
  if (!outcome || outcome.tier_up !== true || !grants || grants.length === 0) return null;
  const tier = asCount(outcome.tier);
  if (tier === null) return null;
  const since = decisionCreatedAt ? Date.parse(decisionCreatedAt) : NaN;
  const hit = grants
    .filter((g) => {
      if (g.tier !== tier) return false;
      if (Number.isNaN(since)) return true;
      const at = Date.parse(g.granted_at);
      return Number.isNaN(at) ? false : at >= since;
    })
    .sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at))[0];
  if (!hit) return null;
  const kind = normalizeKind(hit.kind);
  const name = (locale === 'en' ? hit.label_en : hit.label_fr)?.trim();
  if (!kind || !name) return null;
  return { tier: hit.tier, name, kind, icon: hit.icon };
}

export function buildReviewViewModel(input: {
  outcome: WeeklyDecisionOutcome | null | undefined;
  stateTotal: number | null | undefined;
  decisionCreatedAt?: string | null;
  grants?: readonly RewardGrantRow[] | null;
  locale: string;
}): ReviewViewModel {
  const points = buildPointsView(input.outcome, input.stateTotal);
  const tierUpFlag = !!points && input.outcome?.tier_up === true && points.tier > MIN_TIER;
  if (!points || !tierUpFlag) return { steps: ['result'], points, tierUp: null, reward: null };

  const reward = pickReward(input.outcome, input.decisionCreatedAt, input.grants, input.locale);
  const tierUp: TierUpView = {
    tier: points.tier,
    total: points.total,
    tierCount: MAX_TIER,
    hasReward: reward !== null,
  };
  return {
    steps: reward ? ['result', 'tierUp', 'reward'] : ['result', 'tierUp'],
    points,
    tierUp,
    reward,
  };
}

/** Step pills (contract section 3) only exist when a reward step follows, on steps 2 and 3. */
export function stepPills(vm: ReviewViewModel, step: ReviewStep): { index: number; total: number } | null {
  if (!vm.reward || step === 'result') return null;
  return { index: vm.steps.indexOf(step) + 1, total: vm.steps.length };
}

export function ctaKey(vm: ReviewViewModel, step: ReviewStep): 'cta' | 'cta.continue' | 'tierUp.cta' {
  const last = vm.steps[vm.steps.length - 1];
  if (step === last) return 'cta';
  return step === 'result' ? 'cta.continue' : 'tierUp.cta';
}

export function nextStep(vm: ReviewViewModel, step: ReviewStep): ReviewStep | null {
  const i = vm.steps.indexOf(step);
  return i >= 0 && i < vm.steps.length - 1 ? vm.steps[i + 1]! : null;
}

export const CHIP_ICON: Record<PointsKind, 'checkmark-circle' | 'trending-up' | 'leaf'> = {
  met: 'checkmark-circle',
  exceeded: 'trending-up',
  missed: 'leaf',
};

/** Contract section 6: reduced motion removes springs/translate; opacity-only, <= 150ms; bar jumps. */
export interface MotionSpec {
  badge: { spring: boolean; fadeMs: number };
  card: { fadeMs: number; delayMs: number };
  bar: { durationMs: number; delayMs: number };
  stepFadeMs: number;
}

export function getMotionSpec(reduceMotion: boolean): MotionSpec {
  if (reduceMotion) {
    return {
      badge: { spring: false, fadeMs: 150 },
      card: { fadeMs: 150, delayMs: 0 },
      bar: { durationMs: 0, delayMs: 0 },
      stepFadeMs: 150,
    };
  }
  return {
    badge: { spring: true, fadeMs: 0 },
    card: { fadeMs: 240, delayMs: 120 },
    bar: { durationMs: 400, delayMs: 300 },
    stepFadeMs: 150,
  };
}

export function pluralPoints(n: number): 'one' | 'other' {
  return n === 1 ? 'one' : 'other';
}
