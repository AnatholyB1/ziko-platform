// Module-internal types for coach/videos bounded context.

/** Body for POST /coach/videos/upload-url — no body required; athleteId comes from auth context */
export type UploadUrlBody = Record<string, never>;

/** Response from POST /coach/videos/upload-url */
export interface UploadUrlResponse {
  signedUrl: string;
  videoId: string;
  path: string;
}

/** Body for POST /coach/videos/:videoId/complete */
export interface CompleteVideoBody {
  title: string;
  duration_s?: number;
}

/** A row from the coach_client_videos table */
export interface VideoRecord {
  id: string;
  athlete_id: string;
  coach_id: string;
  storage_path: string;
  title: string;
  duration_s: number | null;
  status: 'uploading' | 'ready' | 'annotated';
  created_at: string;
}
