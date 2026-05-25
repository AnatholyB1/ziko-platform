import type { z } from 'zod';
import type {
  ImportedProgramSchema,
  CoachClientLinkSchema,
  CoachProfileSchema,
} from '../schemas/index.js';

export type ImportedProgram = z.infer<typeof ImportedProgramSchema>;
export type CoachClientLink = z.infer<typeof CoachClientLinkSchema>;
export type CoachProfile = z.infer<typeof CoachProfileSchema>;
