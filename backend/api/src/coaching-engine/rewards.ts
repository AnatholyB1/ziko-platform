// Phase 45 (v1.18, non-punitive-tiered-rewards) - coaching-engine module.
//
// Points, tier and reward selection for REWARD-01..05. Everything in the
// first half of this file is pure (no I/O, no clock, no model call) so the
// non-punitive guarantees - points never negative, tier never lowered,
// rewards never revoked - are unit-testable in isolation.
//
// Locked decisions: 45-CONTEXT.md D-01..D-09. All tunable numbers live in
// the config constants right below; nothing else in the codebase hard-codes
// them.
import { generateObject } from 'ai';
import { z } from 'zod';
import { AGENT_MODEL } from '../config/models.js';
import { logAutonomousCost, SOURCES } from '../lib/autonomousCost.js';
import type { clientForUser } from './db.js';

// ── Config (D-01, D-02) ─────────────────────────────────────────────────
/** exceeded = actual >= EXCEEDED_MARGIN x target (D-01). */
export const EXCEEDED_MARGIN = 1.25;
export const POINTS = { met: 10, exceeded: 15, missed: 0 } as const;
/** Points needed to reach tier N (D-02). Tier 1 is the starting tier. Tier 5 is reserved. */
export const TIER_THRESHOLDS = { 2: 50, 3: 150, 4: 300 } as const;
export const MIN_TIER = 1;
export const MAX_TIER = 4;
/** Tolerance so decimal targets (e.g. 2.4 x 1.25) do not miss the exact boundary on float error. */
const BOUNDARY_EPSILON = 1e-9;

export type PointsOutcomeKind = 'exceeded' | 'met' | 'missed' | 'no_target';

export interface WeeklyOutcomeInput {
  met: boolean | null;
  actual_value: number | null;
  target_value: number | null;
}

export interface PointsOutcome {
  outcome: PointsOutcomeKind;
  points: number;
}

/**
 * Points earned for one weekly review, read from the weekly_focus decision
 * outcome. `met` is the backend verdict from context.ts (44 D-07) and is
 * NEVER recomputed here; only the exceeded boundary is derived. Never
 * negative: a missed week or a week with no target earns 0 (not a penalty).
 */
export function computePointsOutcome(outcome: WeeklyOutcomeInput): PointsOutcome {
  if (outcome.met === true) {
    const { actual_value: actual, target_value: target } = outcome;
    const exceeded =
      typeof actual === 'number' &&
      typeof target === 'number' &&
      Number.isFinite(actual) &&
      Number.isFinite(target) &&
      target > 0 &&
      actual + BOUNDARY_EPSILON >= EXCEEDED_MARGIN * target;
    return exceeded
      ? { outcome: 'exceeded', points: POINTS.exceeded }
      : { outcome: 'met', points: POINTS.met };
  }
  if (outcome.met === false) return { outcome: 'missed', points: POINTS.missed };
  return { outcome: 'no_target', points: 0 };
}

/** Highest tier whose threshold `points` reaches (1 when below the first threshold). */
export function tierFromPoints(points: number): number {
  const p = Number.isFinite(points) ? points : 0;
  let tier = MIN_TIER;
  for (const [t, threshold] of Object.entries(TIER_THRESHOLDS)) {
    if (p >= threshold) tier = Math.max(tier, Number(t));
  }
  return tier;
}

export interface NextRewardState {
  points: number;
  tier: number;
  tierUp: boolean;
  earned: PointsOutcome;
}

/**
 * Next points/tier after one weekly outcome. Monotonic (D-07): points never
 * drop below the current value and tier is max(current, derived) - a missed
 * week can only leave both unchanged.
 */
export function nextRewardState(
  current: { points?: number | null; tier?: number | null },
  outcome: WeeklyOutcomeInput,
): NextRewardState {
  const prevPoints = Math.max(0, Math.floor(current.points ?? 0));
  const prevTier = Math.max(MIN_TIER, Math.floor(current.tier ?? MIN_TIER));
  const earned = computePointsOutcome(outcome);
  const points = prevPoints + Math.max(0, earned.points);
  const tier = Math.min(MAX_TIER, Math.max(prevTier, tierFromPoints(points)));
  return { points, tier: Math.max(prevTier, tier), tierUp: tier > prevTier, earned };
}

// ── Catalog pool + deterministic selection (D-05) ───────────────────────
export interface RewardCatalogRow {
  id: string;
  tier: number;
  key: string;
  kind: string;
  icon: string;
  label_fr: string;
  label_en: string;
  sort_order: number;
  active: boolean;
}

/** Active catalog rows of `tier` the athlete does not own yet, in deterministic order. */
export function filterEligiblePool(
  catalog: readonly RewardCatalogRow[],
  ownedRewardIds: ReadonlySet<string> | readonly string[],
  tier: number,
): RewardCatalogRow[] {
  const owned = ownedRewardIds instanceof Set ? ownedRewardIds : new Set(ownedRewardIds);
  return catalog
    .filter((r) => r.active && r.tier === tier && !owned.has(r.id))
    .sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
}

export interface RewardSelection {
  reward: RewardCatalogRow;
  via: 'ai' | 'fallback';
}

/**
 * Validates a (possibly model-produced) candidate id against the eligible
 * pool. Anything not in the pool - invented id, wrong type, already owned
 * (so absent from the pool), repeated - falls back to the first pool entry
 * by sort_order. Returns null only when the pool is empty.
 */
export function resolveSelection(
  candidateId: unknown,
  pool: readonly RewardCatalogRow[],
): RewardSelection | null {
  if (pool.length === 0) return null;
  if (typeof candidateId === 'string') {
    const hit = pool.find((r) => r.id === candidateId);
    if (hit) return { reward: hit, via: 'ai' };
  }
  return { reward: pool[0]!, via: 'fallback' };
}

export const REWARD_SELECTION_SYSTEM_PROMPT =
  "You pick ONE reward for an athlete who just reached a new tier in Ziko's coaching programme. " +
  'Rewards are purely cosmetic and non-monetary. Choose the single reward_id from the provided list that ' +
  'best fits the tier. You may only answer with an id that appears in the list; never invent one. ' +
  'The pick is presented to the athlete as chosen for them by Ziko, never as luck or a draw.';

const RewardPickZod = z.object({ reward_id: z.string() });

/**
 * Asks the model (temperature 0) to choose from the pool, then validates the
 * answer in code. A model error or invalid answer never loses the grant: it
 * degrades to the deterministic fallback. Cost is logged through
 * logAutonomousCost (SOURCES.rewardSelection) - no credit gate involved.
 */
export async function selectReward(
  db: ReturnType<typeof clientForUser>,
  userId: string,
  tier: number,
  pool: readonly RewardCatalogRow[],
): Promise<RewardSelection | null> {
  if (pool.length === 0) return null;
  if (pool.length === 1) return { reward: pool[0]!, via: 'fallback' };

  let candidate: unknown = null;
  try {
    const prompt = [
      `tier: ${tier}`,
      'eligible_rewards:',
      ...pool.map((r) => `  - reward_id=${r.id} kind=${r.kind} key=${r.key}`),
    ].join('\n');
    const { object, usage } = await generateObject({
      model: AGENT_MODEL,
      temperature: 0,
      schema: RewardPickZod,
      system: REWARD_SELECTION_SYSTEM_PROMPT,
      prompt,
    });
    candidate = (object as { reward_id?: unknown } | null)?.reward_id;
    logAutonomousCost(db, {
      userId,
      model: AGENT_MODEL.modelId,
      usage: { inputTokens: usage?.inputTokens ?? 0, outputTokens: usage?.outputTokens ?? 0 },
      source: SOURCES.rewardSelection,
    });
  } catch (err) {
    console.error('[Rewards] selection model call failed, using deterministic fallback:', err);
  }
  return resolveSelection(candidate, pool);
}

// ── Grant (D-06) ────────────────────────────────────────────────────────
export type GrantRewardResult =
  | {
      granted: true;
      tier: number;
      decision_id: string;
      via: 'ai' | 'fallback';
      reward: Pick<RewardCatalogRow, 'id' | 'key' | 'kind' | 'icon' | 'label_fr' | 'label_en'>;
    }
  | { granted: false; reason: string };

/**
 * Grants the reward for `tier` through ziko_grant_reward (service-role-only
 * RPC). Idempotent: a repeat call for an already-rewarded tier or an already
 * recorded (user, week, tier) returns granted:false without writing.
 */
export async function grantRewardForTier(
  db: ReturnType<typeof clientForUser>,
  userId: string,
  tier: number,
  weekOf: string,
  source: string,
): Promise<GrantRewardResult> {
  const { data: stateRow, error: stateErr } = await db
    .from('ziko_athlete_state')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();
  if (stateErr) throw new Error(`reward state read failed: ${stateErr.message}`);
  const stateTier = (stateRow as { tier?: number } | null)?.tier ?? MIN_TIER;
  if (tier > stateTier) return { granted: false, reason: 'tier_not_reached' };

  const [{ data: catalogRows, error: catErr }, { data: ownedRows, error: ownErr }] = await Promise.all([
    db.from('ziko_reward_catalog').select('id, tier, key, kind, icon, label_fr, label_en, sort_order, active').eq('tier', tier).eq('active', true),
    db.from('ziko_athlete_rewards').select('reward_id, tier').eq('user_id', userId),
  ]);
  if (catErr) throw new Error(`reward catalog read failed: ${catErr.message}`);
  if (ownErr) throw new Error(`athlete rewards read failed: ${ownErr.message}`);

  const owned = (ownedRows ?? []) as Array<{ reward_id: string; tier: number }>;
  if (owned.some((o) => o.tier === tier)) return { granted: false, reason: 'already_granted' };

  const pool = filterEligiblePool(
    (catalogRows ?? []) as RewardCatalogRow[],
    new Set(owned.map((o) => o.reward_id)),
    tier,
  );
  const selection = await selectReward(db, userId, tier, pool);
  if (!selection) return { granted: false, reason: 'pool_exhausted' };

  const { data, error } = await db.rpc('ziko_grant_reward', {
    p_user_id: userId,
    p_reward_id: selection.reward.id,
    p_week_of: weekOf,
    p_summary: `Tier ${tier} reward: ${selection.reward.key}`,
    p_rationale: 'Granted automatically on reaching a new tier; chosen from the unowned rewards of that tier.',
    // Grounded in values the backend read itself - never model output.
    p_evidence: {
      tier,
      points_source: 'ziko_athlete_state',
      pool_size: pool.length,
      selected_via: selection.via,
      evidence_source: 'backend_state',
    },
    p_source: source,
  });
  if (error) throw new Error(`ziko_grant_reward failed: ${error.message}`);

  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;
  if (result?.success !== true) return { granted: false, reason: result?.error ?? 'unknown_rpc_failure' };

  const { reward } = selection;
  return {
    granted: true,
    tier,
    decision_id: result.decision_id!,
    via: selection.via,
    reward: {
      id: reward.id,
      key: reward.key,
      kind: reward.kind,
      icon: reward.icon,
      label_fr: reward.label_fr,
      label_en: reward.label_en,
    },
  };
}

/** Tiers in 2..currentTier for which the athlete holds no reward yet (covers retry after a failed grant). */
export function owedTiers(currentTier: number, ownedTiers: readonly number[]): number[] {
  const have = new Set(ownedTiers);
  const out: number[] = [];
  for (let t = MIN_TIER + 1; t <= Math.min(MAX_TIER, currentTier); t++) {
    if (!have.has(t)) out.push(t);
  }
  return out;
}
