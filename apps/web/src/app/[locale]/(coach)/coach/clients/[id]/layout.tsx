export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { ClientDetailHeader } from '@/components/coach/ClientDetailHeader';
import { ClientTabStrip } from '@/components/coach/ClientTabStrip';
import { ClientNotesPanel } from '@/components/coach/ClientNotesPanel';

export default async function ClientDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch client profile for header display.
  // is_coach_of RLS: if coach is NOT linked to this client, this returns null.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, name, avatar_url')
    .eq('id', id) // ← client's UUID from URL param
    .maybeSingle();

  // If profile is null (unlinked client or non-existent), redirect to clients list.
  if (!profile) redirect(`/${locale}/coach/clients`);

  // Fetch coach's note and tags for this client (coach-private; RLS enforces coach_id = user.id)
  const [{ data: noteData }, { data: tagsData }] = await Promise.all([
    supabase
      .from('coach_client_notes')
      .select('content')
      .eq('coach_id', user.id)
      .eq('client_id', id)
      .maybeSingle(),
    supabase
      .from('coach_client_tags')
      .select('id, tag')
      .eq('coach_id', user.id)
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return (
    <div className="flex-1 bg-background min-h-screen">
      <div className="p-8 pb-0">
        <ClientDetailHeader
          id={id}
          name={profile.name}
          avatarUrl={profile.avatar_url}
          locale={locale}
        />
        <div className="mt-4">
          <ClientTabStrip id={id} locale={locale} />
        </div>
      </div>
      {/* Flex layout: tab content (flex-1) + notes panel (w-72 on lg+) */}
      <div className="flex gap-6 p-8 pt-6">
        <div className="flex-1 min-w-0" id="tab-panel">
          {children}
        </div>
        <div className="hidden lg:block w-72 shrink-0">
          <div className="sticky top-8">
            <ClientNotesPanel
              clientId={id}
              initialNote={noteData?.content ?? ''}
              initialTags={(tagsData ?? []).map((t: any) => ({ id: t.id, tag: t.tag }))}
              apiUrl={process.env.NEXT_PUBLIC_API_URL ?? ''}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
