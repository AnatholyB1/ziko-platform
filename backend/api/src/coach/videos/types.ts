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
  /** Phase 47: annotation type — 'text' for keyboard annotations, 'voice' for recorded audio */
  type?: 'text' | 'voice';
  /** Phase 47: Supabase storage path for the raw audio blob (voice annotations only) */
  audio_path?: string | null;
}

/** Phase 47: Non-file fields sent alongside the audio blob in POST /annotations/transcribe */
export interface VoiceTranscribeBody {
  videoId: string;
  timestamp_s: number;
}

/** Body for POST /coach/videos/:videoId/annotations */
export interface CreateAnnotationBody {
  timestamp_s: number;
  content: string;
  /** Phase 47: annotation type — defaults to 'text' if omitted */
  type?: 'text' | 'voice';
  /** Phase 47: storage path for the audio blob (voice annotations only) */
  audio_path?: string | null;
}

/** Body for PATCH /coach/videos/:videoId/annotations/:annotId */
export interface UpdateAnnotationBody {
  content: string;
}
