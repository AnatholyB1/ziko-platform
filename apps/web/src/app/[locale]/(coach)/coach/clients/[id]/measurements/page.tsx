import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';

export default async function ClientMeasurementsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  // Fetch measurements data — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: rows } = await supabase
    .from('body_measurements')
    .select('id, weight_kg, body_fat_pct, waist_cm, chest_cm, arm_cm, hip_cm, created_at')
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
                  Poids (kg)
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  % Graisse
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Tour de taille
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Tour de poitrine
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, unknown>) => (
                <tr key={row.id as string} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-text">
                    {new Date(row.created_at as string).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 text-text">
                    {row.weight_kg != null ? `${row.weight_kg} kg` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.body_fat_pct != null ? `${row.body_fat_pct}%` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.waist_cm != null ? `${row.waist_cm} cm` : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted">
                    {row.chest_cm != null ? `${row.chest_cm} cm` : '—'}
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
