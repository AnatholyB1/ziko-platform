import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { RedeemStateMachine } from '@/components/coach/RedeemStateMachine';
import { fetchActiveLinkAction } from '@/lib/redeem/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CODE_RE = /^[A-Z2-9]{6}$/;

export default async function RedeemDeepLinkPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  const upperCode = code.toUpperCase();
  if (!CODE_RE.test(upperCode)) redirect(`/${locale}/redeem`);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/r/${upperCode}`)}`);

  // If user already linked, surface State C (their existing coach), not the deep-linked one
  const { link, preview } = await fetchActiveLinkAction();
  if (link && preview) {
    return (
      <main className="min-h-screen bg-background px-6 py-8">
        <RedeemStateMachine
          initialKind="C"
          initialPreview={preview}
          initialLinkId={link.id}
          initialCreatedAt={link.created_at}
          initialCode={null}
        />
      </main>
    );
  }

  // No existing link — pass the deep-link code; client will auto-preview on mount
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <RedeemStateMachine
        initialKind="A"
        initialPreview={null}
        initialLinkId={null}
        initialCreatedAt={null}
        initialCode={upperCode}
      />
    </main>
  );
}
