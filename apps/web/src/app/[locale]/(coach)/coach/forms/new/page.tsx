import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import FormBuilderClient from './FormBuilderClient'; // created in Plan 03-03

export default async function FormsNewPage({
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

  return (
    <FormBuilderClient
      locale={locale}
      accessToken={jwt}
      apiUrl={apiUrl}
      form={null}
    />
  );
}
