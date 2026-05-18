import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { RedeemStateMachine } from '@/components/coach/RedeemStateMachine';
import { fetchActiveLinkAction } from '@/lib/redeem/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CODE_RE = /^[A-Z2-9]{6}$/;

export default async function RedeemPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);

  // Sanitise ?code= — must match DB alphabet exactly
  const rawCode = typeof sp.code === 'string' ? sp.code.toUpperCase().trim() : null;
  const code = rawCode && CODE_RE.test(rawCode) ? rawCode : null;

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const next = code ? `/redeem?code=${code}` : '/redeem';
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }

  const { link, preview } = await fetchActiveLinkAction();
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <RedeemStateMachine
        initialKind={link && preview ? 'C' : 'A'}
        initialPreview={preview}
        initialLinkId={link?.id ?? null}
        initialCreatedAt={link?.created_at ?? null}
        initialCode={code}
      />
    </main>
  );
}
