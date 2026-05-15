'use server';

import { headers } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase/server';
import { rolePromotionRatelimit, kycUploadRatelimit } from '@/lib/ratelimit';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export type CoachIdentityState = {
  status: 'idle' | 'success' | 'error';
  message: string;
};

async function getAuthContext() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}

// ARCH-05 layer 3: every Server Action re-checks auth independently
export async function promoteRole(
  prevState: CoachIdentityState,
  _formData: FormData,
): Promise<CoachIdentityState> {
  const ip = await getIp();
  const { success } = await rolePromotionRatelimit.limit(ip);
  if (!success) return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };

  const { user } = await getAuthContext();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  // Get user JWT from session via supabase
  const supabase = await createServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) return { status: 'error', message: 'Session expirée. Reconnectez-vous.' };

  const res = await fetch(`${API_URL}/coach/identity/role`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) return { status: 'error', message: 'Impossible de mettre à jour le rôle.' };

  return { status: 'success', message: 'Rôle coach activé.' };
}

export async function saveProfile(
  prevState: CoachIdentityState,
  formData: FormData,
): Promise<CoachIdentityState> {
  const { user } = await getAuthContext();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  const supabase = await createServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) return { status: 'error', message: 'Session expirée.' };

  const display_name = (formData.get('display_name') as string | null)?.trim() ?? '';
  if (!display_name) return { status: 'error', message: 'Le nom affiché est requis.' };

  const bio = (formData.get('bio') as string | null)?.trim() || null;
  const website = (formData.get('website') as string | null)?.trim() || null;
  const photo_url = (formData.get('photo_url') as string | null)?.trim() || null;
  const specialtiesRaw = formData.get('specialties') as string | null;
  const specialties = specialtiesRaw ? JSON.parse(specialtiesRaw) : [];

  const body = { display_name, bio, website, photo_url, specialties };
  const res = await fetch(`${API_URL}/coach/identity/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { status: 'error', message: 'Impossible de sauvegarder. Réessayez.' };

  return { status: 'success', message: 'Profil mis à jour.' };
}

export async function saveKyc(
  prevState: CoachIdentityState,
  formData: FormData,
): Promise<CoachIdentityState> {
  const ip = await getIp();
  const { success } = await kycUploadRatelimit.limit(ip);
  if (!success) return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };

  const { user } = await getAuthContext();
  if (!user) return { status: 'error', message: 'Non authentifié.' };

  const supabase = await createServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const jwt = sessionData.session?.access_token;
  if (!jwt) return { status: 'error', message: 'Session expirée.' };

  const kycDocsRaw = formData.get('kyc_docs') as string | null;
  const kyc_docs = kycDocsRaw ? JSON.parse(kycDocsRaw) : [];

  const res = await fetch(`${API_URL}/coach/identity/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ kyc_docs }),
  });
  if (!res.ok) return { status: 'error', message: 'Impossible de sauvegarder. Réessayez.' };

  return { status: 'success', message: 'Documents enregistrés.' };
}
