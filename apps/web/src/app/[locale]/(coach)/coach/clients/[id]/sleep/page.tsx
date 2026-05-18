export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';

export default async function ClientSleepPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  const locale = await getLocale();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch sleep logs — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: rows } = await supabase
    .from('sleep_logs')
    .select('id, date, bedtime, wake_time, duration_hours, quality')
    .eq('user_id', clientId)
    .order('date', { ascending: false })
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
                  Heure coucher
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Heure réveil
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Durée (h)
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Qualité
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-text">
                    {row.date ? new Date(row.date).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">{row.bedtime ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">{row.wake_time ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">
                    {row.duration_hours != null ? `${row.duration_hours}h` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.quality != null ? `${row.quality}/5` : '—'}
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
