import { z } from 'zod';

// Phase 25 D-20 — Coach invitation schema matching Phase 22 D-07 column set (migration 035)
export const CoachInvitationSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  code: z.string().regex(/^[A-Z2-9]{6}$/),
  expires_at: z.string().datetime().nullable(),
  revoked_at: z.string().datetime().nullable(),
  use_count: z.number().int().nonnegative(),
  max_uses: z.number().int().positive(),
  created_at: z.string().datetime(),
});

export type CoachInvitation = z.infer<typeof CoachInvitationSchema>;

export const ComputedStatusSchema = z.enum(['active', 'used', 'expired', 'revoked']);
export type ComputedStatus = z.infer<typeof ComputedStatusSchema>;

// Pure function (no I/O) — UI + backend both call this to derive a single source of truth
export function computeInvitationStatus(
  row: Pick<CoachInvitation, 'expires_at' | 'revoked_at' | 'use_count' | 'max_uses'>,
  now: Date = new Date(),
): ComputedStatus {
  if (row.revoked_at !== null) return 'revoked';
  if (row.use_count >= row.max_uses) return 'used';
  if (row.expires_at !== null && new Date(row.expires_at) <= now) return 'expired';
  return 'active';
}

// Augmented type returned by GET /coach/invitations (server attaches computed status)
export const CoachInvitationWithStatusSchema = CoachInvitationSchema.extend({
  status: ComputedStatusSchema,
});
export type CoachInvitationWithStatus = z.infer<typeof CoachInvitationWithStatusSchema>;
