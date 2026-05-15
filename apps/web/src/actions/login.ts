'use server';

import { headers } from 'next/headers';
import { ratelimit } from '@/lib/ratelimit';
import { createServerSupabase } from '@/lib/supabase/server';

export type LoginState = {
  status: 'idle' | 'success' | 'error';
  message: string;
  redirectTo?: string;
};

const NEXT_PARAM_ALLOWLIST = [
  '/coach/onboarding',
  '/coach/dashboard',
  '/coach/settings',
] as const;

function safeNext(next: string | null): string {
  if (next && NEXT_PARAM_ALLOWLIST.includes(next as typeof NEXT_PARAM_ALLOWLIST[number])) {
    return next;
  }
  return '/coach/dashboard';
}

export async function loginAction(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Rate limit by IP (reuse existing ratelimit: 5 attempts / 60s)
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  const { success } = await ratelimit.limit(`login:${ip}`);
  if (!success) {
    return { status: 'error', message: 'Trop de tentatives. Réessayez dans une minute.' };
  }

  const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const next = (formData.get('next') as string | null);

  if (!email || !password) {
    return { status: 'error', message: 'Email ou mot de passe incorrect. Veuillez réessayer.' };
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { status: 'error', message: 'Email ou mot de passe incorrect. Veuillez réessayer.' };
  }

  // Determine redirect target based on role (D-02)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  const role = profile?.role ?? 'client';
  let redirectTo: string;
  if (role === 'coach' || role === 'both') {
    redirectTo = safeNext(next);
    if (redirectTo === '/coach/onboarding') redirectTo = '/coach/dashboard'; // already a coach
  } else {
    redirectTo = '/coach/onboarding';
  }

  // Return success with redirectTo — do NOT call redirect() inside a Server Action used with
  // useActionState. redirect() throws internally and useActionState catches it, swallowing the
  // navigation (RESEARCH Pitfall 6). Instead, return { status: 'success', redirectTo } and let
  // the client component handle the navigation via useEffect + router.push (per D-03 pattern).
  return { status: 'success', message: '', redirectTo };
}
