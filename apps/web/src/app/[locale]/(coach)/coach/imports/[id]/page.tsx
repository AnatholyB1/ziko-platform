export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { PreviewClient } from './PreviewClient';

export interface ImportRow {
  id: string;
  original_filename: string;
  mime_type: string;
  status: 'pending' | 'uploaded' | 'parsing' | 'ready' | 'failed' | 'committed';
  page_count: number | null;
  mode: 'athlete' | 'coach_template';
  parsed_data: Record<string, unknown> | null;
  confidence_scores: Record<string, unknown> | null;
  error_message: string | null;
  credit_transaction_id: string | null;
  committed_program_id: string | null;
  re_upload_source_id: string | null;
  created_at: string;
}

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export default async function ImportPreviewPage({ params }: PageProps) {
  const { locale, id } = await params;

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

  let importRow: ImportRow | null = null;

  if (jwt) {
    try {
      const res = await fetch(`${apiUrl}/coach/imports/${id}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });

      if (res.status === 404 || res.status === 403) {
        redirect(`/${locale}/coach/imports`);
      }

      if (res.ok) {
        const json = await res.json();
        importRow = json.import ?? json ?? null;
      } else {
        redirect(`/${locale}/coach/imports`);
      }
    } catch {
      redirect(`/${locale}/coach/imports`);
    }
  }

  if (!importRow) {
    redirect(`/${locale}/coach/imports`);
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <PreviewClient
        importRow={importRow}
        locale={locale}
        accessToken={jwt}
        apiUrl={apiUrl}
      />
    </div>
  );
}
