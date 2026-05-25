'use server';

import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { rolePromotionRatelimit, kycUploadRatelimit } from '@/lib/ratelimit';

export type CoachIdentityState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

async function getIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}

async function upsertCoachProfile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  userId: string,
  updates: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { data: existing } = await supabase
    .from('coach_profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('coach_profiles')
      .update(updates)
      .eq('user_id', userId);
    return { error };
  }

  const { error } = await supabase
    .from('coach_profiles')
    .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' });
  return { error };
}

export async function promoteRole(
  prevState: CoachIdentityState,
  _formData: FormData,
): Promise<CoachIdentityState> {
  const ip = await getIp();
  const { success } = await rolePromotionRatelimit.limit(ip);
  if (!success) return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const currentRole = profile?.role ?? 'client';
  const newRole = currentRole === 'client' ? 'both' : 'coach';

  const { error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', user.id);

  if (error) return { status: 'error', message: 'Impossible de mettre à jour le rôle.' };
  return { status: 'success', message: 'Rôle coach activé.' };
}

export async function saveProfile(
  prevState: CoachIdentityState,
  formData: FormData,
): Promise<CoachIdentityState> {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  const display_name = (formData.get('display_name') as string | null)?.trim() ?? '';
  if (!display_name) return { status: 'error', message: 'Le nom affiché est requis.' };

  const bio = (formData.get('bio') as string | null)?.trim() || null;
  const website = (formData.get('website') as string | null)?.trim() || null;
  const photo_url = (formData.get('photo_url') as string | null)?.trim() || null;
  const specialtiesRaw = formData.get('specialties') as string | null;
  const specialties = specialtiesRaw ? JSON.parse(specialtiesRaw) : [];

  const { error } = await upsertCoachProfile(supabase, user.id, {
    display_name, bio, website, photo_url, specialties,
  });

  if (error) return { status: 'error', message: 'Impossible de sauvegarder. Réessayez.' };
  return { status: 'success', message: 'Profil mis à jour.' };
}

export async function saveKyc(
  prevState: CoachIdentityState,
  formData: FormData,
): Promise<CoachIdentityState> {
  const ip = await getIp();
  const { success } = await kycUploadRatelimit.limit(ip);
  if (!success) return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  const kycDocsRaw = formData.get('kyc_docs') as string | null;
  const kyc_docs = kycDocsRaw ? JSON.parse(kycDocsRaw) : [];

  const updates: Record<string, unknown> = { kyc_docs };
  if (kyc_docs.length > 0) updates.kyc_status = 'submitted';

  const { error } = await upsertCoachProfile(supabase, user.id, updates);

  if (error) return { status: 'error', message: 'Impossible de sauvegarder. Réessayez.' };
  return { status: 'success', message: 'Documents enregistrés.' };
}
