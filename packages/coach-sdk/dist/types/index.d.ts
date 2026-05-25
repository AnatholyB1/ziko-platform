import { z } from 'zod';
import { C as CoachClientLinkSchema, a as CoachProfileSchema, I as ImportedProgramSchema } from '../coach-profile-B4QzuUZf.js';

type ImportedProgram = z.infer<typeof ImportedProgramSchema>;
type CoachClientLink = z.infer<typeof CoachClientLinkSchema>;
type CoachProfile = z.infer<typeof CoachProfileSchema>;

export type { CoachClientLink, CoachProfile, ImportedProgram };
