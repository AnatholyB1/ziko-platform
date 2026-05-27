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

// ── Phase 46 types ────────────────────────────────────────────────────────────

/** A row from the coach_client_videos table (Phase 46 alias with all required fields explicit) */
export interface VideoRow {
  id: string;
  athlete_id: string;
  coach_id: string;
  storage_path: string;
  title: string;
  duration_s: number | null;
  status: 'uploading' | 'ready' | 'annotated';
  created_at: string;
}

/** A row from the coach_video_annotations table */
export interface AnnotationRow {
  id: string;
  video_id: string;
  coach_id: string;
  timestamp_s: number;
  content: string;
  created_at: string;
}

/** Body for POST /coach/videos/:videoId/annotations */
export interface CreateAnnotationBody {
  timestamp_s: number;
  content: string;
}

/** Body for PATCH /coach/videos/:videoId/annotations/:annotId */
export interface UpdateAnnotationBody {
  content: string;
}
