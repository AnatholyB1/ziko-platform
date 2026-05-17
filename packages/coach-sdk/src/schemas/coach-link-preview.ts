import { z } from 'zod';

// Phase 25 D-20 — Preview payload returned by /coach/clients/links/preview success
// and embedded inside /coach/clients/links/me when active link exists
export const CoachPreviewPayloadSchema = z.object({
  coach_id: z.string().uuid(),
  display_name: z.string(),
  bio: z.string().nullable(),
  specialties: z.array(z.string()).nullable(),
  photo_signed_url: z.string().url().nullable(),  // backend signs bucket path before responding
  kyc_status: z.enum(['pending', 'submitted', 'verified', 'rejected']).nullable(),
});
export type CoachPreviewPayload = z.infer<typeof CoachPreviewPayloadSchema>;

// Phase 25 Q4 / Pattern 4 — Constant-time envelope shape.
// Single error_code value 'INVALID_OR_EXPIRED' on the wire regardless of underlying cause.
export const CoachLinkPreviewSuccessSchema = z.object({
  ok: z.literal(true),
  error_code: z.null(),
  preview: CoachPreviewPayloadSchema,
});

export const CoachLinkPreviewErrorSchema = z.object({
  ok: z.literal(false),
  error_code: z.literal('INVALID_OR_EXPIRED'),
  preview: z.null(),
});

export const CoachLinkPreviewSchema = z.discriminatedUnion('ok', [
  CoachLinkPreviewSuccessSchema,
  CoachLinkPreviewErrorSchema,
]);
export type CoachLinkPreview = z.infer<typeof CoachLinkPreviewSchema>;

// Same envelope for /redeem, with link payload on success
export const CoachLinkRedeemSuccessSchema = z.object({
  ok: z.literal(true),
  error_code: z.null(),
  link: z.object({
    id: z.string().uuid(),
    coach_id: z.string().uuid(),
    client_id: z.string().uuid(),
    created_at: z.string().datetime(),
  }),
  preview: CoachPreviewPayloadSchema,
});

export const CoachLinkRedeemErrorSchema = z.object({
  ok: z.literal(false),
  error_code: z.literal('INVALID_OR_EXPIRED'),
  link: z.null(),
  preview: z.null(),
});

export const CoachLinkRedeemSchema = z.discriminatedUnion('ok', [
  CoachLinkRedeemSuccessSchema,
  CoachLinkRedeemErrorSchema,
]);
export type CoachLinkRedeem = z.infer<typeof CoachLinkRedeemSchema>;
