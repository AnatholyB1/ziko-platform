import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ClientFormsContent } from './ClientFormsContent';

interface FormAnswer {
  question_id: string;
  question_label: string;
  question_type: string;
  answer_value: string | number;
}

interface FormInstance {
  instance_id: string;
  form_id: string;
  form_title: string;
  status: 'pending' | 'submitted';
  submitted_at: string | null;
  question_count: number;
  answers: FormAnswer[] | null;
}

interface FormInstancesResponse {
  forms: FormInstance[];
}

export default async function ClientFormsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  const [locale] = await Promise.all([getLocale(), getCachedCoachUser()]);
  const supabase = await createServerSupabase();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let formsData: FormInstancesResponse = { forms: [] };

  if (jwt) {
    try {
      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/forms`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        formsData = json ?? formsData;
      }
    } catch (err) {
      console.error('[clients/[id]/forms/page] fetch error:', err);
    }
  }

  return <ClientFormsContent forms={formsData.forms} locale={locale} />;
}
