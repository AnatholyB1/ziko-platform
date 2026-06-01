export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
// BrandingClient will be created in Plan 03 — TypeScript error on this import is expected until then
import { BrandingClient } from './BrandingClient';

export default async function BrandingPage() {
  const { user } = await getCachedCoachUser();
  const supabase = await createServerSupabase();

  const [brandingData, tierData, profileData] = await Promise.all([
    supabase
      .from('coach_branding')
      .select('primary_color, logo_url, tone')
      .eq('coach_id', user.id)
      .single(),
    supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single(),
    supabase
      .from('coach_profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single(),
  ]);

  const isPro = tierData.data?.tier === 'premium';
  const initialBranding = brandingData.data ?? null;
  const displayName = profileData.data?.display_name ?? 'Votre nom';

  return (
    <div className="px-8 py-10 max-w-[1200px] mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-text">Direction artistique</h1>
        <p className="text-sm text-muted mt-1">
          Personnalisez votre identité visuelle. Vos athlètes verront ces couleurs et ce logo dans leur app.
        </p>
      </div>
      <BrandingClient
        userId={user.id}
        isPro={isPro}
        initialBranding={initialBranding}
        displayName={displayName}
      />
    </div>
  );
}
