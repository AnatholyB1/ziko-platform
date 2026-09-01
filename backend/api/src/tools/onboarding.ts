import { clientForUser } from './db.js';
import type { AITool } from './registry.js';

// ============================================================
// Phase 43 plan 01 — assess_profile tool (ONBOARD-02, ONBOARD-03, ONBOARD-05)
//
// This is the single contract every other plan in Phase 43 depends on: the
// onboarding stream route (43-03) wraps this schema in a narrowed one-tool
// surface, the mobile mission card (43-06) renders the chosen micro_action,
// and the retroactive path (43-04) reuses the same state-patch shape.
//
// Write path: this executor ONLY calls public.record_athlete_decision() —
// never a direct write to athlete_state or athlete_decisions. Phase 42's
// table-level REVOKE INSERT/UPDATE/DELETE makes any other path fail
// outright, including with the service-role key (see
// supabase/migrations/20260831120200_athlete_decisions_rpc.sql).
// ============================================================

// ── D-13: curated micro-action pool — exactly these three, no others ──────
export const MICRO_ACTION_POOL = ['hydration_log', 'journal_mood', 'measurements_weight'] as const;
export type MicroAction = (typeof MICRO_ACTION_POOL)[number];

// ── Locked decision: onboarding always writes level 1 / tier 1 for every
// readiness value. `readiness` alone carries the "start gentler vs. start
// further along" signal; level-based gating belongs to Phase 46
// (43-RESEARCH.md Open Question 3 recommendation, adopted here as the
// phase-wide answer). ──────────────────────────────────────────────────────
export const ONBOARDING_LEVEL = 1;
export const ONBOARDING_TIER = 1;

const READINESS_VALUES = ['fragile', 'building', 'ready'] as const;

// ── Tool schema ─────────────────────────────────────────────────────────
export const assessProfileSchema: AITool = {
  name: 'assess_profile',
  description:
    'Call this tool EXACTLY ONCE, and only after you have gathered signal across all three ' +
    "categories: the athlete's experience level, their adherence risk, and their overall " +
    'readiness. Never call it before that — this is the terminal action of the onboarding ' +
    "conversation and it writes the athlete's starting state.",
  parameters: {
    type: 'object',
    properties: {
      experience_level: {
        type: 'string',
        enum: ['beginner', 'intermediate', 'advanced'],
        description: "The athlete's self-reported training experience level.",
      },
      experience_confidence: {
        type: 'integer',
        description: 'Self-reported confidence in the experience_level signal, 1-5.',
      },
      adherence_risk: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: "The athlete's risk of dropping off / not sticking with a program.",
      },
      adherence_confidence: {
        type: 'integer',
        description: 'Self-reported confidence in the adherence_risk signal, 1-5.',
      },
      readiness: {
        type: 'string',
        enum: [...READINESS_VALUES],
        description:
          "The athlete's overall coaching readiness. Maps verbatim to the athlete_state.readiness " +
          'CHECK constraint (fragile/building/ready).',
      },
      readiness_confidence: {
        type: 'integer',
        description: 'Self-reported confidence in the readiness signal, 1-5.',
      },
      profile_summary: {
        type: 'string',
        description: "One or two athlete-facing sentences summarizing the athlete's profile, in Ziko's voice.",
      },
      micro_action: {
        type: 'string',
        enum: [...MICRO_ACTION_POOL],
        description: 'The single curated micro-action to assign as the first mission for this athlete.',
      },
      mission_title: {
        type: 'string',
        description:
          'One short athlete-facing line naming the mission, in Ziko\'s voice and in the ' +
          "conversation's locale. This is the mission-card title (plan 43-06) — the CTA button " +
          'label itself is static i18n copy, not this field.',
      },
    },
    required: [
      'experience_level',
      'experience_confidence',
      'adherence_risk',
      'adherence_confidence',
      'readiness',
      'readiness_confidence',
      'profile_summary',
      'micro_action',
      'mission_title',
    ],
  },
};

// ── Executor ────────────────────────────────────────────────────────────
export async function assess_profile(
  params: Record<string, unknown>,
  userId: string,
  userToken?: string,
): Promise<unknown> {
  const {
    experience_level,
    experience_confidence,
    adherence_risk,
    adherence_confidence,
    readiness,
    readiness_confidence,
    profile_summary,
    micro_action,
    mission_title,
  } = params as {
    experience_level: string;
    experience_confidence: number;
    adherence_risk: string;
    adherence_confidence: number;
    readiness: string;
    readiness_confidence: number;
    profile_summary: string;
    micro_action: string;
    mission_title: string;
  };

  // (a) Runtime membership check against MICRO_ACTION_POOL before the RPC
  // call — the schema enum alone is not an enforcement boundary (T-43-02).
  if (!(MICRO_ACTION_POOL as readonly string[]).includes(micro_action)) {
    return { success: false, error: 'invalid_micro_action' };
  }

  // (b) Runtime membership check against the readiness enum before the RPC
  // call, mirroring the micro_action guard above.
  if (!(READINESS_VALUES as readonly string[]).includes(readiness)) {
    return { success: false, error: 'invalid_readiness' };
  }

  // (c) Service-role client required — EXECUTE on record_athlete_decision
  // is granted to service_role only.
  const db = clientForUser(userToken);

  // NOTE: this p_evidence payload is the one documented, intentional
  // exception to the "ground decisions in real logged data" rule
  // (43-RESEARCH.md Pitfall 4): a brand-new athlete has no activity history
  // to re-query, and Phase 44's weekly engine is the designed correction
  // mechanism. Do not fabricate synthetic activity numbers to satisfy the
  // guard — this is self-reported onboarding-conversation signal, labeled
  // as such via evidence_source.
  const p_evidence = {
    experience_level,
    experience_confidence,
    adherence_risk,
    adherence_confidence,
    readiness,
    readiness_confidence,
    evidence_source: 'onboarding_conversation',
  };

  const { data, error } = await db.rpc('record_athlete_decision', {
    p_user_id: userId,
    p_decision_type: 'onboarding_profile',
    p_week_of: null,
    p_summary: profile_summary,
    p_rationale: `Assessed as ${experience_level} experience with ${adherence_risk} adherence risk.`,
    p_evidence,
    p_outcome: {
      level: ONBOARDING_LEVEL,
      tier: ONBOARDING_TIER,
      micro_action,
      mission_title,
    },
    p_source: 'onboarding_tool',
    p_state_patch: {
      level: ONBOARDING_LEVEL,
      tier: ONBOARDING_TIER,
      readiness,
      // Setting status to active here is load-bearing — the column
      // defaults to 'onboarding' and nothing else in the system flips it;
      // the mobile mandatory-flow gate (plan 43-02) reads exactly this
      // value.
      status: 'active',
      current_focus_summary: profile_summary,
      onboarding_profile: {
        experience_level,
        adherence_risk,
        confidences: {
          experience: experience_confidence,
          adherence: adherence_confidence,
          readiness: readiness_confidence,
        },
      },
    },
  });

  // (e) The supabase client error is a transport/permission failure, not a
  // guard rejection — throw rather than silently reporting success.
  if (error) {
    throw new Error(`record_athlete_decision failed: ${error.message}`);
  }

  const result = data as { success?: boolean; error?: string; decision_id?: string } | null;

  // (f) The RPC returns error-shaped JSONB rather than raising on a guard
  // failure (e.g. evidence_required, duplicate) — never treat a
  // non-thrown call as success.
  if (result?.success !== true) {
    return { success: false, error: result?.error ?? 'unknown_rpc_failure' };
  }

  // (g) Success — the route in plan 43-03 emits the mission SSE event
  // straight from this result.
  return {
    success: true,
    decision_id: result.decision_id,
    micro_action,
    mission_title,
  };
}
