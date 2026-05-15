// Internal types for coach/identity module — NOT re-exported beyond service.ts (ARCH-02)
export type UserRole = 'client' | 'coach' | 'both';

export interface RoleUpdatePayload {
  role: 'coach' | 'both';
}

export interface ProfileUpsertPayload {
  display_name?: string;
  bio?: string | null;
  specialties?: string[];
  website?: string | null;
  photo_url?: string | null;
  kyc_docs?: Array<{
    type: 'certification' | 'id_document' | 'other';
    url: string;
    uploaded_at: string;
    filename?: string;
  }>;
  kyc_status?: 'pending' | 'submitted';
}
