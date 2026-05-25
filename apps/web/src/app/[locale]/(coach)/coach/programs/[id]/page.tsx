import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ProgramEditorClient } from './ProgramEditorClient';
import type { ProgramWeek } from '@ziko/coach-sdk';

interface ProgramData {
  id: string;
  name: string;
  goal: string | null;
  weeks_data: ProgramWeek[];
  updated_at: string | null;
  created_at: string | null;
}

interface ClientData {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

export default async function ProgramEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: programId } = await params;
  const [locale, supabase] = await Promise.all([getLocale(), createServerSupabase()]);
  await getCachedCoachUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let program: ProgramData | null = null;
  let clients: ClientData[] = [];

  if (jwt) {
    try {
      // Fetch program
      const [programRes, clientsRes] = await Promise.all([
        fetch(`${apiUrl}/coach/programs/${programId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/clients`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
      ]);

      if (programRes.ok) {
        const json = await programRes.json();
        program = json.program ?? json ?? null;
      }
      if (clientsRes.ok) {
        const json = await clientsRes.json();
        clients = json.clients ?? json ?? [];
      }
    } catch (err) {
      console.error('[programs/[id]/page] fetch error:', err);
    }
  }

  if (!program) {
    redirect(`/${locale}/coach/programs`);
  }

  return (
    <ProgramEditorClient
      program={program}
      clients={clients}
      accessToken={jwt}
      apiUrl={apiUrl}
      locale={locale}
    />
  );
}
