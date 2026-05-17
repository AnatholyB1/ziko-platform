import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { RedeemStateMachine } from '@/components/coach/RedeemStateMachine';
import { fetchActiveLinkAction } from '@/lib/redeem/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=/redeem`);

  const { link, preview } = await fetchActiveLinkAction();
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <RedeemStateMachine
        initialKind={link && preview ? 'C' : 'A'}
        initialPreview={preview}
        initialLinkId={link?.id ?? null}
        initialCreatedAt={link?.created_at ?? null}
        initialCode={null}
      />
    </main>
  );
}
