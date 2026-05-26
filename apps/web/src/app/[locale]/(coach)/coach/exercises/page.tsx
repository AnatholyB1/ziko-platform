import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { ExercisesClient } from './ExercisesClient';
import type { CoachExercise } from '@/types/coach';

export function generateMetadata(): Metadata {
  return { title: 'Exercices | Ziko Coach' };
}

export default async function ExercisesPage() {
  const supabase = await createServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
  let exercises: CoachExercise[] = [];

  try {
    const res = await fetch(`${apiUrl}/coach/exercises`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as { exercises: CoachExercise[] };
      exercises = json.exercises ?? [];
    } else {
      console.error('[exercises/page] fetch failed:', res.status);
    }
  } catch (err) {
    console.error('[exercises/page] fetch error:', err);
  }

  // Detect locale from session — fallback to 'fr'
  const localeHeader =
    typeof process !== 'undefined'
      ? (process.env.NEXT_LOCALE ?? 'fr')
      : 'fr';

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <ExercisesClient
        initialExercises={exercises}
        accessToken={session.access_token}
        apiUrl={apiUrl}
        locale={localeHeader}
        userId={session.user.id}
      />
    </div>
  );
}
