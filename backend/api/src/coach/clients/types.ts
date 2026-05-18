// Module-internal types. Public schemas live in @ziko/coach-sdk.

// The 6 internal DB error codes returned by peek_invitation + redeem_invitation_code RPCs.
// These are LOGGED but NEVER returned on the wire (constant-time guarantee).
export type DbErrorCode =
  | 'INVALID_CODE'
  | 'SELF_INVITATION'
  | 'REVOKED'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'LINK_EXISTS';

// The single wire error code returned to clients.
export type WireErrorCode = 'INVALID_OR_EXPIRED';

export type RedeemPayload = { code: string };

// Discriminated union shapes mirror @ziko/coach-sdk CoachLinkPreviewSchema + CoachLinkRedeemSchema.
export type CoachPreviewPayload = {
  coach_id: string;
  display_name: string;
  bio: string | null;
  specialties: string[] | null;
  photo_signed_url: string | null;
  kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected' | null;
};

export type LinkRow = {
  id: string;
  coach_id: string;
  client_id: string;
  created_at: string;
};

// peek_invitation RPC raw return shape
type PeekRpcReturn =
  | {
      ok: true;
      error_code: null;
      preview: {
        coach_id: string;
        display_name: string;
        bio: string | null;
        specialties: string[] | null;
        photo_url: string | null;
        kyc_status: string | null;
      };
    }
  | { ok: false; error_code: DbErrorCode; preview: null };

// redeem_invitation_code RPC raw return shape (from migration 035 line 158)
type RedeemRpcReturn =
  | { ok: true; error_code: null; link_id: string }
  | { ok: false; error_code: DbErrorCode; link_id: null };

export type { PeekRpcReturn, RedeemRpcReturn };

// Phase 26 — coach-facing CRM types
export type ClientRosterRow = {
  id: string;            // user_profiles.id (client's UUID)
  name: string | null;   // user_profiles.name
  avatar_url: string | null; // user_profiles.avatar_url
  last_active: string | null; // most recent workout_sessions.created_at
  signal_missed: boolean; // no workout_sessions in last 14 days (D-02)
  signal_stale: boolean;  // no body_measurements in last 28 days (D-02)
  signal_mood: boolean;   // last-3 journal mood avg < prev-3 avg (D-02)
  sessions_this_week: number; // count of workout_sessions since start of current week
  habits_pct: number | null;  // avg daily habit completion % over last 7 days; null if no habits
};

export type ClientTag = {
  id: string;
  coach_id: string;
  client_id: string;
  tag: string;
  created_at: string;
};

export type ClientNote = {
  id: string;
  coach_id: string;
  client_id: string;
  content: string;
  updated_at: string;
};
