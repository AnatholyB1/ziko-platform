export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';

export default async function ClientHabitsPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id: clientId } = await params;
  await getCachedCoachUser();
  const supabase = await createServerSupabase();

  // Fetch habits — is_coach_of() RLS auto-applied via coach's JWT cookie.
  // CRITICAL: .eq('user_id', clientId) — clientId from URL params (NOT user.id = coach!)
  const { data: habits } = await supabase
    .from('habits')
    .select('id, name, type, emoji, color')
    .eq('user_id', clientId)
    .order('name', { ascending: true })
    .limit(30);

  // Fetch habit logs for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

  const { data: logs } = await supabase
    .from('habit_logs')
    .select('habit_id, date, value')
    .eq('user_id', clientId)
    .gte('date', dateStr)
    .limit(300);

  // Compute completion rate per habit
  const logsByHabit: Record<string, number> = {};
  const totalDays = 30;
  if (logs) {
    for (const log of logs) {
      logsByHabit[log.habit_id] = (logsByHabit[log.habit_id] ?? 0) + 1;
    }
  }

  return (
    <div>
      {!habits || habits.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">
          Aucune donnée disponible pour cette période.
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-border overflow-hidden mt-4">
          <table className="w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Habitude
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Type
                </th>
                <th className="py-3 px-4 text-left text-xs font-bold tracking-wide uppercase text-muted">
                  Taux de completion (30j)
                </th>
              </tr>
            </thead>
            <tbody>
              {habits.map((habit: Record<string, unknown>) => {
                const completedDays = logsByHabit[habit.id] ?? 0;
                const rate = Math.round((completedDays / totalDays) * 100);
                return (
                  <tr key={habit.id} className="border-t border-border hover:bg-background/60">
                    <td className="py-3 px-4 text-text">
                      {habit.emoji ? `${habit.emoji} ` : ''}{habit.name}
                    </td>
                    <td className="py-3 px-4 text-muted capitalize">{habit.type ?? '—'}</td>
                    <td className="py-3 px-4 text-muted">{rate}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
