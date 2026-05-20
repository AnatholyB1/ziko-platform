export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ClientProgramsContent } from './ClientProgramsContent';

interface ActiveProgram {
  id: string;
  name: string;
  goal: string | null;
  week_count: number;
  current_week: number;
  start_date: string | null;
  compliance_pct: number | null;
  coach_display_name: string | null;
}

interface HistoryProgram {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  compliance_archive: number | null;
}

interface ClientProgramsData {
  active: ActiveProgram | null;
  history: HistoryProgram[];
}

interface ClientDetail {
  id: string;
  name: string | null;
  shared_note: string | null;
}

export default async function ClientProgramsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let programsData: ClientProgramsData = { active: null, history: [] };
  let clientDetail: ClientDetail = { id: clientId, name: null, shared_note: null };

  if (jwt) {
    try {
      const [programsRes, clientRes] = await Promise.all([
        fetch(`${apiUrl}/coach/clients/${clientId}/programs`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/clients/${clientId}`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
      ]);

      if (programsRes.ok) {
        const json = await programsRes.json();
        programsData = json ?? programsData;
      }
      if (clientRes.ok) {
        const json = await clientRes.json();
        clientDetail = json.client ?? json ?? clientDetail;
        // shared_note may be nested
        if (json.link?.shared_note !== undefined) {
          clientDetail = { ...clientDetail, shared_note: json.link.shared_note };
        }
      }
    } catch (err) {
      console.error('[clients/[id]/programs/page] fetch error:', err);
    }
  }

  return (
    <ClientProgramsContent
      clientId={clientId}
      programsData={programsData}
      clientDetail={clientDetail}
      accessToken={jwt}
      apiUrl={apiUrl}
      locale={locale}
    />
  );
}
