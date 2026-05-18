export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ClientsTable } from '@/components/coach/ClientsTable';

export default async function ClientsPage() {
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Get the session JWT to pass to the Hono API
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';

  let clients: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    last_active: string | null;
    signal_missed: boolean;
    signal_stale: boolean;
    signal_mood: boolean;
    sessions_this_week: number;
    habits_pct: number | null;
  }[] = [];

  if (jwt) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiUrl}/coach/clients`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        clients = json.clients ?? [];
      }
    } catch (err) {
      console.error('[clients/page] fetch error:', err);
    }
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Clients</h1>
          {clients.length > 0 && (
            <span className="text-sm font-normal text-muted bg-white border border-border rounded-full px-3 py-0.5">
              {clients.length}
            </span>
          )}
        </div>
      </div>
      <ClientsTable rows={clients} locale={locale} />
    </div>
  );
}
