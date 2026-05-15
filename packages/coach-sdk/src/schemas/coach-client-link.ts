import { z } from 'zod';

export const CoachClientLinkSchema = z.object({
  id: z.string().uuid(),
  coach_id: z.string().uuid(),
  client_id: z.string().uuid(),
  expires_at: z.string().datetime({ offset: true }).nullable(),
  revoked_at: z.string().datetime({ offset: true }).nullable(),
  created_at: z.string().datetime({ offset: true }),
}).strict()
  .refine((d) => d.coach_id !== d.client_id, {
    message: 'coach_id and client_id must differ (matches DB CHECK)',
    path: ['client_id'],
  });

// Derived predicate (D-01: active = revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))
export function isLinkActive(link: z.infer<typeof CoachClientLinkSchema>, now: Date = new Date()): boolean {
  if (link.revoked_at !== null) return false;
  if (link.expires_at === null) return true;
  return new Date(link.expires_at) > now;
}
