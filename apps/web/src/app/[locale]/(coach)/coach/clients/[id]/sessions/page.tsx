export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ExecutiveSummaryCard } from '@/components/coach/ExecutiveSummaryCard';

export default async function ClientSessionsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  // Fetch executive summary via Hono API (aggregates computed in backend)
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';
  let summary = {
    sessions_this_week: 0,
    habits_pct: null as number | null,
    last_workout_at: null as string | null,
    latest_weight_kg: null as number | null,
    mood_delta: null as number | null,
    mood_prev_avg: null as number | null,
    mood_curr_avg: null as number | null,
  };
  if (jwt) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      const res = await fetch(`${apiUrl}/coach/clients/${clientId}/summary`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const json = await res.json();
        summary = json.summary ?? summary;
      }
    } catch (err) {
      console.error('[sessions/page] summary fetch error:', err);
    }
  }

  // Fetch sessions data — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: rows } = await supabase
    .from('workout_sessions')
    .select('id, name, created_at, duration_minutes')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(30);

  const hasMore = (rows?.length ?? 0) >= 30;

  return (
    <div>
      <ExecutiveSummaryCard summary={summary} />
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">
          Aucune donnée disponible pour cette période.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Date
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Séance
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Durée
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, unknown>) => (
                <tr key={row.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-text">
                    {new Date(row.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-text">{row.name ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">
                    {row.duration_minutes != null ? `${row.duration_minutes} min` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="py-4 text-center border-t border-border">
              <button className="text-sm text-primary font-normal hover:underline">
                Voir plus
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
