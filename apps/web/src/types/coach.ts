// Shared TypeScript types for the Coach web app.
// These mirror the backend/api/src/coach/exercises/types.ts definitions.

export interface CoachExercise {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  category: string;
  muscle_groups: string[];
  video_path: string | null;
  photo_path: string | null;
  gif_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExerciseBody {
  name: string;               // required, max 100
  description?: string | null; // optional, max 500
  category: string;           // required, enum: Force|Cardio|Mobilité|HIIT|Hyrox|Autre
  muscle_groups?: string[];   // optional, defaults to []
  video_path?: string | null;
  photo_path?: string | null;
  gif_path?: string | null;
}

export interface UpdateExerciseBody {
  name?: string;
  description?: string | null;
  category?: string;
  muscle_groups?: string[];
  video_path?: string | null;
  photo_path?: string | null;
  gif_path?: string | null;
}

export const EXERCISE_CATEGORIES = ['Force', 'Cardio', 'Mobilité', 'HIIT', 'Hyrox', 'Autre'] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];
