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
