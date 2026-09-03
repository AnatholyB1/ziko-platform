// Phase 44 (v1.18, weekly-adaptive-decision-engine) — coaching-engine module.
//
// Single-shot generateObject weekly decision call (ENGINE-02/ENGINE-03).
// This is the only place in the phase a model produces a judgment — every
// input was computed deterministically by context.ts (plan 44-02); every
// output is re-grounded by apply.ts (plan 44-04) before it becomes an
// immutable decision.
//
// No try/catch anywhere in this module — generateObject errors propagate to
// the caller, matching onboarding-retroactive.ts's convention.
import { generateObject, jsonSchema } from 'ai';
import { zodSchema } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { AGENT_MODEL } from '../config/models.js';
import type { WeeklyDecisionResult, WeeklyReviewContext } from './types.js';

// ── Anthropic schema sanitizer ─────────────────────────────────────────
// Copied verbatim from tools/onboarding-retroactive.ts (also mirrored in
// coach/voice/service.ts and coach/imports/parse/claude.ts) — a second
// local copy is the established convention here, never a cross-module
// import, since onboarding-retroactive.ts keeps its copy private.
// @ai-sdk/provider-utils adds implicit minimum/maximum on every
// z.number().int() field, which Anthropic's structured-output endpoint
// rejects outright. stripUnsupportedKeywords removes every disallowed
// keyword before the schema is sent.
const ANTHROPIC_BANNED_KEYWORDS = new Set([
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'minItems', 'maxItems',
  'multipleOf', '$schema', 'format',
]);

function stripUnsupportedKeywords(node: unknown): unknown {
  if (typeof node !== 'object' || node === null) return node;
  if (Array.isArray(node)) return node.map(stripUnsupportedKeywords);
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([key]) => !ANTHROPIC_BANNED_KEYWORDS.has(key))
      .map(([key, value]) => [key, stripUnsupportedKeywords(value)]),
  );
}

function anthropicSchema<T>(zodType: z.ZodTypeAny) {
  const raw = zodSchema(zodType).jsonSchema;
  return jsonSchema<T>(stripUnsupportedKeywords(raw) as any);
}

// ── Weekly decision schema ──────────────────────────────────────────────
// Matches WeeklyDecisionResult (types.ts) field-for-field — defined once
// there, mirrored here as the Zod shape generateObject validates against.
const FOCUS_TYPE_VALUES = [
  'training_volume',
  'habit_consistency',
  'nutrition',
  'hydration',
  'recovery',
  'cardio',
  'unassigned',
] as const;

const WeeklyDecisionZod = z.object({
  trajectory: z.enum(['escalate', 'hold', 'de-escalate']),
  new_readiness: z.enum(['fragile', 'building', 'ready']),
  new_focus_summary: z.string(),
  rationale: z.string(),
  call_create_program: z.boolean(),
  new_focus_detail: z
    .object({
      focus_type: z.enum(FOCUS_TYPE_VALUES),
      target_metric: z.string(),
      target_value: z.number(),
    })
    .nullable(),
});

export const WEEKLY_DECISION_SCHEMA = anthropicSchema<z.infer<typeof WeeklyDecisionZod>>(
  WeeklyDecisionZod,
);

// ── System prompt — locked product rules (ENGINE-02/ENGINE-03, D-04/D-05/D-06/D-11) ──
export const WEEKLY_REVIEW_SYSTEM_PROMPT = `You are Ziko's weekly coaching-decision engine. You decide one athlete's next-week trajectory from real, backend-computed evidence — you never talk to the athlete directly and this is a one-shot structured extraction, not a conversation.

- The comparison verdict is already computed by the backend from real logged rows. Treat "met" as fact. Never re-derive it, never contradict it, never infer activity the evidence does not show. Zero or sparse activity is real evidence, not a gap to guess around.
- Escalation is fast: a single week where met is true is sufficient grounds to consider escalating next week's focus. Do not require a consecutive-week streak before rewarding progress.
- De-escalation is slow: a single missed week is never sufficient to de-escalate. Only consider de-escalate when pattern_of_misses is true (at least 2 of the last 3 weekly reviews missed) — one off week (travel, illness, etc.) must never by itself trigger de-escalation.
- met === null means no target was assigned for the review cycle. That is never a miss and must never produce de-escalate — choose hold or escalate instead, and assign a first concrete focus.
- The two rules above are a floor and a ceiling, not a hard-coded state machine. You may choose hold even when escalation or de-escalation would otherwise be permitted, if the decision history shows volatility or other signals warrant caution. Whichever you choose, the rationale must name the specific evidence values you relied on.
- The onboarding-inferred profile is a starting hypothesis, not a constraint. Move new_readiness up or down from the current value whenever the real activity warrants it, independent of how the athlete was originally profiled.
- Non-punitive tone: new_focus_summary and rationale are read by the athlete directly. No outcome may read as a penalty, blame or warning — including on a de-escalation.
- call_create_program is true only when trajectory is escalate or de-escalate. On hold, it must be false and new_focus_detail must be null — the existing program continues unchanged, no churn and no extra write.`;

// ── Prompt builder ────────────────────────────────────────────────────
// Compact labelled lines, never raw rows and never a message array — this
// is a single prompt string handed to a single-shot structured extraction.
export function buildWeeklyReviewPrompt(context: WeeklyReviewContext): string {
  const lines: string[] = [
    `week_of: ${context.weekOf}`,
    `assigned_focus_type: ${context.focus.focus_type}`,
    `assigned_target_metric: ${context.focus.target_metric ?? 'none'}`,
    `assigned_target_value: ${context.focus.target_value ?? 'none'}`,
    `actual_value: ${context.comparison.actual_value ?? 'none'}`,
    `target_value: ${context.comparison.target_value ?? 'none'}`,
    `met: ${context.comparison.met}`,
    `tables_read: ${context.activity.tables_read.join(', ')}`,
  ];

  for (const [metric, value] of Object.entries(context.activity.metrics)) {
    lines.push(`metric.${metric}: ${value}`);
  }

  lines.push(
    `miss_pattern_window: ${context.missPattern.window}`,
    `miss_pattern_missed: ${context.missPattern.missed}`,
    `pattern_of_misses: ${context.missPattern.pattern_of_misses}`,
    `current_readiness: ${context.state.readiness}`,
    `current_focus_summary: ${context.state.current_focus_summary ?? 'none'}`,
    `rolling_summary: ${context.state.rolling_summary ?? 'none'}`,
  );

  if (context.recentDecisions.length > 0) {
    lines.push('recent_decisions:');
    for (const d of context.recentDecisions) {
      lines.push(
        `  - week_of=${d.week_of ?? 'n/a'} summary="${d.summary}" outcome=${JSON.stringify(d.outcome)}`,
      );
    }
  } else {
    lines.push('recent_decisions: none');
  }

  return lines.join('\n');
}

// ── Decision call ────────────────────────────────────────────────────
export async function decideWeeklyFocus(context: WeeklyReviewContext): Promise<{
  decision: WeeklyDecisionResult;
  usage: { inputTokens: number; outputTokens: number };
  modelId: string;
}> {
  const { object, usage } = await generateObject({
    model: AGENT_MODEL,
    schema: WEEKLY_DECISION_SCHEMA,
    system: WEEKLY_REVIEW_SYSTEM_PROMPT,
    prompt: buildWeeklyReviewPrompt(context),
  });

  const decision = object as WeeklyDecisionResult;

  // D-11 defensive enforcement: a model that ignores the system-prompt
  // instruction must not be able to cause a program rewrite on a hold week.
  if (decision.trajectory === 'hold') {
    decision.call_create_program = false;
    decision.new_focus_detail = null;
  }

  return {
    decision,
    usage: {
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    },
    modelId: AGENT_MODEL.modelId,
  };
}
