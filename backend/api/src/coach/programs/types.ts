// Module-internal types for coach/programs bounded module.
// Public schemas (ProgramWeekSchema, etc.) live in @ziko/coach-sdk.
import type { ProgramWeek } from '@ziko/coach-sdk';

export interface CreateProgramBody {
  name: string;
  description?: string;
  goal?: string;
  weeks_count: number;
  folder_id?: string | null;
  weeks_data?: ProgramWeek[];
}

export type UpdateProgramBody = Partial<CreateProgramBody>;

export interface AssignProgramBody {
  client_ids: string[];
}

export interface CreateFolderBody {
  name: string;
}

export interface CreateExerciseBody {
  name: string;
  category?: string;
}
