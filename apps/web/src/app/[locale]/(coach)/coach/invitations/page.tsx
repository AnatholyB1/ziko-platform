import { getTranslations } from 'next-intl/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { fetchInvitationsAction } from './actions';
import { InvitationsClient } from './InvitationsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CoachInvitationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await getCachedCoachUser();
  const t = await getTranslations({ locale, namespace: 'CoachInvitations' });
  const initialRows = await fetchInvitationsAction('all');

  return (
    <div className="max-w-3xl mx-auto py-12 px-6">
      <InvitationsClient
        title={t('title')}
        generateCta={t('generateCta')}
        initialRows={initialRows}
      />
    </div>
  );
}
