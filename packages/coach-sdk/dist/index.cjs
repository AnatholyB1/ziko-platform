'use strict';

var zod = require('zod');

// src/schemas/imported-program.ts
var ExerciseSchema = zod.z.object({
  // From existing exercise library OR free-text (PROG-03)
  exercise_id: zod.z.string().nullable().optional(),
  name: zod.z.string(),
  sets: zod.z.number().int().min(1),
  reps: zod.z.number().int().min(1),
  // Either RPE (1-10) or RIR (0-5) — at most one
  target_rpe: zod.z.number().nullable().optional(),
  target_rir: zod.z.number().int().nullable().optional(),
  rest_seconds: zod.z.number().int().nullable().optional(),
  notes: zod.z.string().nullable().optional(),
  // Confidence score per field (IMPORT-03 — set by AI parser, null when authored manually)
  confidence: zod.z.number().nullable().optional()
}).strict();
var SessionSchema = zod.z.object({
  name: zod.z.string(),
  day_of_week: zod.z.number().int().nullable().optional(),
  exercises: zod.z.array(ExerciseSchema),
  notes: zod.z.string().nullable().optional()
}).strict();
var WeekSchema = zod.z.object({
  week_number: zod.z.number().int(),
  sessions: zod.z.array(SessionSchema),
  notes: zod.z.string().nullable().optional()
}).strict();
var ImportedProgramSchema = zod.z.object({
  name: zod.z.string(),
  description: zod.z.string().nullable().optional(),
  goal: zod.z.enum([
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
  equipment: zod.z.array(zod.z.string()).nullable().optional(),
  weeks: zod.z.array(WeekSchema),
  source: zod.z.enum(["ai_import", "manual", "template_fork"]).nullable().optional(),
  // Confidence aggregate (IMPORT-03)
  overall_confidence: zod.z.number().nullable().optional()
}).strict();
var CoachClientLinkSchema = zod.z.object({
  id: zod.z.string().uuid(),
  coach_id: zod.z.string().uuid(),
  client_id: zod.z.string().uuid(),
  expires_at: zod.z.string().datetime({ offset: true }).nullable(),
  revoked_at: zod.z.string().datetime({ offset: true }).nullable(),
  created_at: zod.z.string().datetime({ offset: true })
}).strict().refine((d) => d.coach_id !== d.client_id, {
  message: "coach_id and client_id must differ (matches DB CHECK)",
  path: ["client_id"]
});
var CoachKycStatusSchema = zod.z.enum([
  "pending",
  "submitted",
  "verified",
  "rejected"
]);
var CoachKycDocSchema = zod.z.object({
  type: zod.z.enum(["certification", "id_document", "other"]),
  url: zod.z.string().url(),
  uploaded_at: zod.z.string().datetime({ offset: true }),
  filename: zod.z.string().max(255).optional()
}).strict();
var CoachProfileSchema = zod.z.object({
  user_id: zod.z.string().uuid(),
  display_name: zod.z.string().min(1).max(200),
  bio: zod.z.string().max(5e3).nullable(),
  specialties: zod.z.array(zod.z.string().min(1).max(100)).max(20),
  website: zod.z.string().url().nullable(),
  photo_url: zod.z.string().url().nullable(),
  kyc_status: CoachKycStatusSchema,
  kyc_docs: zod.z.array(CoachKycDocSchema),
  created_at: zod.z.string().datetime({ offset: true }),
  updated_at: zod.z.string().datetime({ offset: true })
}).strict();
var CoachInvitationSchema = zod.z.object({
  id: zod.z.string().uuid(),
  coach_id: zod.z.string().uuid(),
  code: zod.z.string().regex(/^[A-Z2-9]{6}$/),
  expires_at: zod.z.string().datetime().nullable(),
  revoked_at: zod.z.string().datetime().nullable(),
  use_count: zod.z.number().int().nonnegative(),
  max_uses: zod.z.number().int().positive(),
  created_at: zod.z.string().datetime()
});
var ComputedStatusSchema = zod.z.enum(["active", "used", "expired", "revoked"]);
function computeInvitationStatus(row, now = /* @__PURE__ */ new Date()) {
  if (row.revoked_at !== null) return "revoked";
  if (row.use_count >= row.max_uses) return "used";
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return "expired";
  return "active";
}
var CoachInvitationWithStatusSchema = CoachInvitationSchema.extend({
  status: ComputedStatusSchema
});
var CoachPreviewPayloadSchema = zod.z.object({
  coach_id: zod.z.string().uuid(),
  display_name: zod.z.string(),
  bio: zod.z.string().nullable(),
  specialties: zod.z.array(zod.z.string()).nullable(),
  photo_signed_url: zod.z.string().url().nullable(),
  // backend signs bucket path before responding
  kyc_status: zod.z.enum(["pending", "submitted", "verified", "rejected"]).nullable()
});
var CoachLinkPreviewSuccessSchema = zod.z.object({
  ok: zod.z.literal(true),
  error_code: zod.z.null(),
  preview: CoachPreviewPayloadSchema
});
var CoachLinkPreviewErrorSchema = zod.z.object({
  ok: zod.z.literal(false),
  error_code: zod.z.literal("INVALID_OR_EXPIRED"),
  preview: zod.z.null()
});
var CoachLinkPreviewSchema = zod.z.discriminatedUnion("ok", [
  CoachLinkPreviewSuccessSchema,
  CoachLinkPreviewErrorSchema
]);
var CoachLinkRedeemSuccessSchema = zod.z.object({
  ok: zod.z.literal(true),
  error_code: zod.z.null(),
  link: zod.z.object({
    id: zod.z.string().uuid(),
    coach_id: zod.z.string().uuid(),
    client_id: zod.z.string().uuid(),
    created_at: zod.z.string().datetime()
  }),
  preview: CoachPreviewPayloadSchema
});
var CoachLinkRedeemErrorSchema = zod.z.object({
  ok: zod.z.literal(false),
  error_code: zod.z.literal("INVALID_OR_EXPIRED"),
  link: zod.z.null(),
  preview: zod.z.null()
});
var CoachLinkRedeemSchema = zod.z.discriminatedUnion("ok", [
  CoachLinkRedeemSuccessSchema,
  CoachLinkRedeemErrorSchema
]);
var ClientSummarySchema = zod.z.object({
  sessions_this_week: zod.z.number().int().min(0),
  habits_pct: zod.z.number().min(0).max(100).nullable(),
  last_workout_at: zod.z.string().nullable(),
  latest_weight_kg: zod.z.number().positive().nullable(),
  mood_delta: zod.z.number().nullable(),
  // curr_avg - prev_avg; null if insufficient data
  mood_prev_avg: zod.z.number().nullable(),
  mood_curr_avg: zod.z.number().nullable()
});
var CoachClientTagSchema = zod.z.object({
  id: zod.z.string().uuid(),
  coach_id: zod.z.string().uuid(),
  client_id: zod.z.string().uuid(),
  tag: zod.z.string().min(1).max(50),
  created_at: zod.z.string()
});
var CoachClientNoteSchema = zod.z.object({
  id: zod.z.string().uuid(),
  coach_id: zod.z.string().uuid(),
  client_id: zod.z.string().uuid(),
  content: zod.z.string(),
  updated_at: zod.z.string()
});
var ProgramExerciseSchema = zod.z.object({
  exercise_id: zod.z.string().uuid().nullable(),
  exercise_name: zod.z.string().min(1).max(100),
  sets: zod.z.number().int().min(1).max(20),
  reps: zod.z.number().int().min(1).max(100).nullable(),
  duration_seconds: zod.z.number().int().min(1).nullable(),
  target_rpe: zod.z.number().min(1).max(10).nullable(),
  target_rir: zod.z.number().int().min(0).max(5).nullable(),
  rest_seconds: zod.z.number().int().min(0).max(600).nullable(),
  notes: zod.z.string().max(300).nullable()
}).strict();
var ProgramSessionSchema = zod.z.object({
  session_id: zod.z.string().uuid(),
  session_name: zod.z.string().min(1).max(100),
  day_of_week: zod.z.number().int().min(1).max(7),
  exercises: zod.z.array(ProgramExerciseSchema)
}).strict();
var ProgramWeekSchema = zod.z.object({
  week_number: zod.z.number().int().min(1),
  sessions: zod.z.array(ProgramSessionSchema)
}).strict();

exports.ClientSummarySchema = ClientSummarySchema;
exports.CoachClientLinkSchema = CoachClientLinkSchema;
exports.CoachClientNoteSchema = CoachClientNoteSchema;
exports.CoachClientTagSchema = CoachClientTagSchema;
exports.CoachInvitationSchema = CoachInvitationSchema;
exports.CoachInvitationWithStatusSchema = CoachInvitationWithStatusSchema;
exports.CoachLinkPreviewErrorSchema = CoachLinkPreviewErrorSchema;
exports.CoachLinkPreviewSchema = CoachLinkPreviewSchema;
exports.CoachLinkPreviewSuccessSchema = CoachLinkPreviewSuccessSchema;
exports.CoachLinkRedeemErrorSchema = CoachLinkRedeemErrorSchema;
exports.CoachLinkRedeemSchema = CoachLinkRedeemSchema;
exports.CoachLinkRedeemSuccessSchema = CoachLinkRedeemSuccessSchema;
exports.CoachPreviewPayloadSchema = CoachPreviewPayloadSchema;
exports.CoachProfileSchema = CoachProfileSchema;
exports.ComputedStatusSchema = ComputedStatusSchema;
exports.ImportedProgramSchema = ImportedProgramSchema;
exports.ProgramExerciseSchema = ProgramExerciseSchema;
exports.ProgramSessionSchema = ProgramSessionSchema;
exports.ProgramWeekSchema = ProgramWeekSchema;
exports.computeInvitationStatus = computeInvitationStatus;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map