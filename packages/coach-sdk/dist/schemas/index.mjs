import { z } from 'zod';

// src/schemas/imported-program.ts
var ExerciseSchema = z.object({
  // From existing exercise library OR free-text (PROG-03)
  exercise_id: z.string().nullable().optional(),
  name: z.string(),
  sets: z.number().int().min(1),
  reps: z.number().int().min(1),
  // Either RPE (1-10) or RIR (0-5) — at most one
  target_rpe: z.number().nullable().optional(),
  target_rir: z.number().int().nullable().optional(),
  rest_seconds: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Confidence score per field (IMPORT-03 — set by AI parser, null when authored manually)
  confidence: z.number().nullable().optional()
}).strict();
var SessionSchema = z.object({
  name: z.string(),
  day_of_week: z.number().int().nullable().optional(),
  exercises: z.array(ExerciseSchema),
  notes: z.string().nullable().optional()
}).strict();
var WeekSchema = z.object({
  week_number: z.number().int(),
  sessions: z.array(SessionSchema),
  notes: z.string().nullable().optional()
}).strict();
var ImportedProgramSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  goal: z.enum([
    "strength",
    "hypertrophy",
    "endurance",
    "weight_loss",
    "body_recomp",
    "hyrox",
    "powerlifting",
    "general",
    "other"
  ]).nullable().optional(),
  equipment: z.array(z.string()).nullable().optional(),
  weeks: z.array(WeekSchema),
  source: z.enum(["ai_import", "manual", "template_fork"]).nullable().optional(),
  // Confidence aggregate (IMPORT-03)
  overall_confidence: z.number().nullable().optional()
}).strict();
var CoachClientLinkSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true })
}).strict().refine((d) => d.coach_id !== d.client_id, {
  message: "coach_id and client_id must differ (matches DB CHECK)",
  path: ["client_id"]
});
var CoachKycStatusSchema = z.enum([
  "pending",
  "submitted",
  "verified",
  "rejected"
]);
var CoachKycDocSchema = z.object({
  type: z.enum(["certification", "id_document", "other"]),
  url: z.string().url(),
  uploaded_at: z.string().datetime({ offset: true }),
  filename: z.string().max(255).optional()
}).strict();
var CoachProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(200),
  bio: z.string().max(5e3).nullable(),
  specialties: z.array(z.string().min(1).max(100)).max(20),
  website: z.string().url().nullable(),
  photo_url: z.string().url().nullable(),
  kyc_status: CoachKycStatusSchema,
  kyc_docs: z.array(CoachKycDocSchema),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true })
}).strict();
var CoachInvitationSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  code: z.string().regex(/^[A-Z2-9]{6}$/),
  expires_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  use_count: z.number().int().nonnegative(),
  max_uses: z.number().int().positive(),
  created_at: z.string().datetime()
});
var ComputedStatusSchema = z.enum(["active", "used", "expired", "revoked"]);
function computeInvitationStatus(row, now = /* @__PURE__ */ new Date()) {
  if (row.revoked_at !== null) return "revoked";
  if (row.use_count >= row.max_uses) return "used";
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return "expired";
  return "active";
}
var CoachInvitationWithStatusSchema = CoachInvitationSchema.extend({
  status: ComputedStatusSchema
});
var CoachPreviewPayloadSchema = z.object({
  coach_id: z.string().uuid(),
  display_name: z.string(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()).nullable(),
  photo_signed_url: z.string().url().nullable(),
  // backend signs bucket path before responding
  kyc_status: z.enum(["pending", "submitted", "verified", "rejected"]).nullable()
});
var CoachLinkPreviewSuccessSchema = z.object({
  ok: z.literal(true),
  error_code: z.null(),
  preview: CoachPreviewPayloadSchema
});
var CoachLinkPreviewErrorSchema = z.object({
  ok: z.literal(false),
  error_code: z.literal("INVALID_OR_EXPIRED"),
  preview: z.null()
});
var CoachLinkPreviewSchema = z.discriminatedUnion("ok", [
  CoachLinkPreviewSuccessSchema,
  CoachLinkPreviewErrorSchema
]);
var CoachLinkRedeemSuccessSchema = z.object({
  ok: z.literal(true),
  error_code: z.null(),
  link: z.object({
    id: z.string().uuid(),
    coach_id: z.string().uuid(),
    client_id: z.string().uuid(),
    created_at: z.string().datetime()
  }),
  preview: CoachPreviewPayloadSchema
});
var CoachLinkRedeemErrorSchema = z.object({
  ok: z.literal(false),
  error_code: z.literal("INVALID_OR_EXPIRED"),
  link: z.null(),
  preview: z.null()
});
var CoachLinkRedeemSchema = z.discriminatedUnion("ok", [
  CoachLinkRedeemSuccessSchema,
  CoachLinkRedeemErrorSchema
]);
var ClientSummarySchema = z.object({
  sessions_this_week: z.number().int().min(0),
  habits_pct: z.number().min(0).max(100).nullable(),
  last_workout_at: z.string().nullable(),
  latest_weight_kg: z.number().positive().nullable(),
  mood_delta: z.number().nullable(),
  // curr_avg - prev_avg; null if insufficient data
  mood_prev_avg: z.number().nullable(),
  mood_curr_avg: z.number().nullable()
});
var CoachClientTagSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  tag: z.string().min(1).max(50),
  created_at: z.string()
});
var CoachClientNoteSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  content: z.string(),
  updated_at: z.string()
});
var ProgramExerciseSchema = z.object({
  exercise_id: z.string().uuid().nullable(),
  exercise_name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(20),
  reps: z.number().int().min(1).max(100).nullable(),
  duration_seconds: z.number().int().min(1).nullable(),
  target_rpe: z.number().min(1).max(10).nullable(),
  target_rir: z.number().int().min(0).max(5).nullable(),
  rest_seconds: z.number().int().min(0).max(600).nullable(),
  notes: z.string().max(300).nullable()
}).strict();
var ProgramSessionSchema = z.object({
  session_id: z.string().uuid(),
  session_name: z.string().min(1).max(100),
  day_of_week: z.number().int().min(1).max(7),
  exercises: z.array(ProgramExerciseSchema)
}).strict();
var ProgramWeekSchema = z.object({
  week_number: z.number().int().min(1),
  sessions: z.array(ProgramSessionSchema)
}).strict();

export { ClientSummarySchema, CoachClientLinkSchema, CoachClientNoteSchema, CoachClientTagSchema, CoachInvitationSchema, CoachInvitationWithStatusSchema, CoachLinkPreviewErrorSchema, CoachLinkPreviewSchema, CoachLinkPreviewSuccessSchema, CoachLinkRedeemErrorSchema, CoachLinkRedeemSchema, CoachLinkRedeemSuccessSchema, CoachPreviewPayloadSchema, CoachProfileSchema, ComputedStatusSchema, ImportedProgramSchema, ProgramExerciseSchema, ProgramSessionSchema, ProgramWeekSchema, computeInvitationStatus };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map