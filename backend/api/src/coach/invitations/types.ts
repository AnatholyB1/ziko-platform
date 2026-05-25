// Module-internal types — only consumed by service.ts + db.ts in this folder
// Public types live in @ziko/coach-sdk (see CoachInvitation, ComputedStatus)

export type GenerateCodePayload = {
  expires_at: string | null; // ISOString or null for no-expiry
};

export type ListStatusFilter = 'active' | 'used' | 'expired' | 'revoked' | 'all';

export type CoachInvitationRow = {
  id: string;
  coach_id: string;
  code: string;
  expires_at: string | null;
  revoked_at: string | null;
  use_count: number;
  max_uses: number;
  created_at: string;
};

export type ComputedInvitationStatus = 'active' | 'used' | 'expired' | 'revoked';
