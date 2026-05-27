import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { QueryProvider } from '@/components/coach/QueryProvider';
import type { CoachForm } from '@/components/coach/FormStatusBadge';
import FormsListClient from './FormsListClient';

export default async function FormsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  const [locale, supabase] = await Promise.all([getLocale(), createServerSupabase()]);
  await getCachedCoachUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let forms: CoachForm[] = [];

  if (jwt) {
    try {
      const res = await fetch(`${apiUrl}/forms/coach/forms`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        forms = json.forms ?? [];
      }
    } catch (err) {
      console.error('[forms/page] fetch error:', err);
    }
  }

  return (
    <QueryProvider>
      <FormsListClient forms={forms} locale={locale} accessToken={jwt} apiUrl={apiUrl} />
    </QueryProvider>
  );
}
