// Module-internal types for coach/imports bounded module.
// The route layer (service.ts) and db.ts import from here.
// Do NOT import service-key or admin-scoped types here.

// Status machine: 'pending' → 'uploaded' → 'parsing' → 'ready' | 'failed' → 'committed'
export type ImportStatus =
  | 'pending'
  | 'uploaded'
  | 'parsing'
  | 'ready'
  | 'failed'
  | 'committed';

// Mode values mirror the DB CHECK constraint on ai_imports.mode
export type ImportMode = 'athlete' | 'coach_template';

// Full row shape for public.ai_imports (all 19 columns from migration 036)
export interface ImportRow {
  id: string;
  user_id: string;
  file_url: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  mode: ImportMode;
  status: ImportStatus;
  parsed_data: Record<string, unknown> | null;
  confidence_scores: Record<string, unknown> | null;
  error_message: string | null;
  credit_transaction_id: string | null;
  committed_program_id: string | null;
  re_upload_source_id: string | null;
  created_at: string;
  updated_at: string;
  parsed_at: string | null;
  committed_at: string | null;
}

// What the client POSTs to create a new import record (POST /coach/imports)
export interface CreateImportBody {
  filename: string;
  mime_type: string;
  size_bytes: number;
  mode: ImportMode;
  re_upload_source_id?: string | null;
}

// What the client PUTs to commit a parsed import (PUT /coach/imports/:id/commit)
export interface CommitImportBody {
  // User-edited program data (full ImportedProgramSchema-shaped object)
  parsed_data: Record<string, unknown>;
  // Optional override for the program name field
  program_name?: string;
}

// What the client PUTs to update status to 'uploaded' after Storage upload completes
// (PUT /coach/imports/:id/status)
export interface UpdateStatusBody {
  status: 'uploaded';
}
