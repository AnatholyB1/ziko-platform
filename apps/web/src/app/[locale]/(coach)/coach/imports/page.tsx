export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ImportsClient } from './ImportsClient';

export interface ImportRow {
  id: string;
  original_filename: string;
  mime_type: string;
  status: 'pending' | 'uploaded' | 'parsing' | 'ready' | 'failed' | 'committed';
  page_count: number | null;
  mode: 'athlete' | 'coach_template';
  parsed_data: Record<string, unknown> | null;
  confidence_scores: Record<string, unknown> | null;
  credit_transaction_id: string | null;
  committed_program_id: string | null;
  created_at: string;
  updated_at: string;
}

export default async function ImportsPage() {
  const [locale, supabase] = await Promise.all([getLocale(), createServerSupabase()]);
  await getCachedCoachUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';

  const apiUrl = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

  let imports: ImportRow[] = [];

  if (jwt) {
    try {
      const res = await fetch(`${apiUrl}/coach/imports`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });

      if (res.ok) {
        const json = await res.json();
        imports = json.imports ?? json ?? [];
      }
    } catch (err) {
      console.error('[imports/page] fetch error:', err);
    }
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <ImportsClient
        imports={imports}
        locale={locale}
        accessToken={jwt}
      />
    </div>
  );
}
