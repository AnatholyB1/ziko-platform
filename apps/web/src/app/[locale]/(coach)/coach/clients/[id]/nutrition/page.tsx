export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';

export default async function ClientNutritionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  // Fetch nutrition logs — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: rows } = await supabase
    .from('nutrition_logs')
    .select('id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, date')
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
                  Repas
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Aliment
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Cal
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  P
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  G
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  L
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, unknown>) => (
                <tr key={row.id as string} className="border-t border-border hover:bg-background/60">
                  <td className="py-3 px-4 text-text">
                    {row.date ? new Date(row.date as string).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="py-3 px-4 text-muted capitalize">{(row.meal_type as string) ?? '—'}</td>
                  <td className="py-3 px-4 text-text">{(row.food_name as string) ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">{(row.calories as string | number) ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">{(row.protein_g as string | number) ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">{(row.carbs_g as string | number) ?? '—'}</td>
                  <td className="py-3 px-4 text-muted">{(row.fat_g as string | number) ?? '—'}</td>
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
