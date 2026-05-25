import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ClientsTable } from '@/components/coach/ClientsTable';

export default async function ClientsPage() {
  const [locale, { user }] = await Promise.all([
    getLocale(),
    getCachedCoachUser(),
  ]);
  const supabase = await createServerSupabase();
  const coachId = user.id;

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartIso = weekStart.toISOString();
  const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  let clients: {
    id: string;
    name: string | null;
    avatar_url: string | null;
    last_active: string | null;
    signal_missed: boolean;
    signal_stale: boolean;
    signal_mood: boolean;
    sessions_this_week: number;
    habits_pct: number | null;
  }[] = [];

  try {
    const { data: links } = await supabase
      .from('coach_client_links')
      .select('client_id')
      .eq('coach_id', coachId)
      .is('revoked_at', null);

    const clientIds = (links ?? []).map((l: any) => l.client_id as string);

    for (const clientId of clientIds) {
      const [
        { data: profile },
        { data: lastSession },
        { data: recentSessions },
        { data: recentMeasurements },
        { data: moodEntries },
        { data: thisWeekSessions },
        { data: habits },
        { data: habitLogs },
      ] = await Promise.all([
        supabase.from('user_profiles').select('id, name, avatar_url').eq('id', clientId).maybeSingle(),
        supabase.from('workout_sessions').select('created_at').eq('user_id', clientId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('workout_sessions').select('id').eq('user_id', clientId).gte('created_at', fourteenDaysAgo).limit(1),
        supabase.from('body_measurements').select('id').eq('user_id', clientId).gte('created_at', twentyEightDaysAgo).limit(1),
        supabase.from('journal_entries').select('mood').eq('user_id', clientId).order('created_at', { ascending: false }).limit(6),
        supabase.from('workout_sessions').select('id').eq('user_id', clientId).gte('created_at', weekStartIso),
        supabase.from('habits').select('id').eq('user_id', clientId),
        supabase.from('habit_logs').select('date, value').eq('user_id', clientId).gte('date', sevenDaysAgoDate),
      ]);

      let signalMood = false;
      if (moodEntries && moodEntries.length >= 6) {
        const last3Avg = moodEntries.slice(0, 3).reduce((a: number, e: any) => a + Number(e.mood), 0) / 3;
        const prev3Avg = moodEntries.slice(3, 6).reduce((a: number, e: any) => a + Number(e.mood), 0) / 3;
        signalMood = last3Avg < prev3Avg;
      }

      let habitsPct: number | null = null;
      if (habits && habits.length > 0 && habitLogs) {
        const completed = habitLogs.filter((l: any) => l.value > 0).length;
        habitsPct = Math.round((completed / (habits.length * 7)) * 100);
      }

      clients.push({
        id: clientId,
        name: profile?.name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        last_active: lastSession?.created_at ?? null,
        signal_missed: !recentSessions || recentSessions.length === 0,
        signal_stale: !recentMeasurements || recentMeasurements.length === 0,
        signal_mood: signalMood,
        sessions_this_week: thisWeekSessions?.length ?? 0,
        habits_pct: habitsPct,
      });
    }
  } catch (err) {
    console.error('[clients/page] supabase error:', err);
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-text">Clients</h1>
          {clients.length > 0 && (
            <span className="text-sm font-normal text-muted bg-white border border-border rounded-full px-3 py-0.5">
              {clients.length}
            </span>
          )}
        </div>
      </div>
      <ClientsTable rows={clients} locale={locale} />
    </div>
  );
}
