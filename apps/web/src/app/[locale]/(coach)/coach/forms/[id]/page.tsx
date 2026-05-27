import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import type { CoachForm } from '@/components/coach/FormStatusBadge';
// FormBuilderClient is the same component used by /new — both routes share forms/new/FormBuilderClient.tsx
import FormBuilderClient from '../new/FormBuilderClient'; // created in Plan 03-03

export default async function FormEditorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const [locale, supabase] = await Promise.all([getLocale(), createServerSupabase()]);
  await getCachedCoachUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let form: CoachForm | null = null;

  if (jwt) {
    try {
      // No dedicated GET /:id route exists — fetch list and find by id
      const res = await fetch(`${apiUrl}/forms/coach/forms`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        form = (json.forms ?? []).find((f: CoachForm) => f.id === id) ?? null;
      }
    } catch (err) {
      console.error('[forms/[id]/page] fetch error:', err);
    }
  }

  // CRITICAL: unknown id → Next.js 404, not a blank builder
  if (form === null) {
    notFound();
  }

  return (
    <FormBuilderClient
      locale={locale}
      accessToken={jwt}
      apiUrl={apiUrl}
      form={form}
    />
  );
}
