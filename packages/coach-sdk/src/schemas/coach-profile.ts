import { z } from 'zod';

export const CoachKycStatusSchema = z.enum([
  'pending',
  'submitted',
  'verified',
  'rejected',
]);

// kyc_docs JSONB — array of doc references (Phase 24 will refine)
export const CoachKycDocSchema = z.object({
  type: z.enum(['certification', 'id_document', 'other']),
  url: z.string().url(),
  uploaded_at: z.string().datetime({ offset: true }),
  filename: z.string().max(255).optional(),
}).strict();

export const CoachProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1).max(200),
  bio: z.string().max(5000).nullable(),
  specialties: z.array(z.string().min(1).max(100)).max(20),
  website: z.string().url().nullable(),
  photo_url: z.string().url().nullable(),
  kyc_status: CoachKycStatusSchema,
  kyc_docs: z.array(CoachKycDocSchema),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).strict();
