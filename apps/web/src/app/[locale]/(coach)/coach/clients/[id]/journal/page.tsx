export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';

export default async function ClientJournalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  // Fetch journal entries — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: rows } = await supabase
    .from('journal_entries')
    .select('id, mood, energy, stress, context, notes, created_at')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false })
    .limit(30);

  const hasMore = (rows?.length ?? 0) >= 30;

  return (
    <div>
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
                  Humeur
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Énergie
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Stress
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-text">
                    {new Date(row.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.mood != null ? `${row.mood}/5` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.energy != null ? `${row.energy}/5` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.stress != null ? `${row.stress}/5` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted max-w-xs truncate">
                    {row.notes ?? '—'}
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
