import { createUserClient } from '../clients/db.js';

export interface BrandingRow {
  primary_color: string;
  logo_url: string | null;
  tone: string | null;
}

export async function upsertBranding(
  jwt: string,
  coachId: string,
  payload: BrandingRow,
): Promise<BrandingRow> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_branding')
    .upsert(
      { coach_id: coachId, ...payload },
      { onConflict: 'coach_id' },
    )
    .select('primary_color, logo_url, tone')
    .single();

  if (error) throw new Error(error.message);
  return data as BrandingRow;
}

export async function getBranding(
  jwt: string,
  coachId: string,
): Promise<BrandingRow | null> {
  const db = createUserClient(jwt);
  const { data, error } = await db
    .from('coach_branding')
    .select('primary_color, logo_url, tone')
    .eq('coach_id', coachId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BrandingRow | null;
}
