import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { getCachedCoachUser } from '@/lib/coach/auth';
import { ProgramsClient } from './ProgramsClient';

export interface ProgramRow {
  id: string;
  name: string;
  goal: string | null;
  weeks_count: number;
  folder_id: string | null;
  is_template: boolean;
  created_by_coach_id: string | null;
}

export interface FolderRow {
  id: string;
  name: string;
}

export default async function ProgramsPage() {
  const [locale, { user }, supabase] = await Promise.all([
    getLocale(),
    getCachedCoachUser(),
    createServerSupabase(),
  ]);
  const coachId = user.id;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let programs: ProgramRow[] = [];
  let folders: FolderRow[] = [];

  try {
    const [programsResult, foldersResult] = await Promise.all([
      supabase
        .from('workout_programs')
        .select('id, name, description, goal, weeks_count, folder_id, is_template, created_by_coach_id, created_at, updated_at')
        .or(`and(created_by_coach_id.eq.${coachId},is_template.eq.true),and(is_template.eq.true,created_by_coach_id.is.null)`)
        .order('created_at', { ascending: false }),
      supabase
        .from('coach_program_folders')
        .select('id, name')
        .eq('coach_id', coachId)
        .order('name', { ascending: true }),
    ]);

    programs = (programsResult.data ?? []) as ProgramRow[];
    folders = (foldersResult.data ?? []) as FolderRow[];
  } catch (err) {
    console.error('[programs/page] supabase error:', err);
  }

  // ProgramsClient still needs accessToken + apiUrl for mutations (create/update/delete/assign)
  const { data: { session } } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <ProgramsClient
        programs={programs}
        folders={folders}
        locale={locale}
        accessToken={jwt}
        apiUrl={apiUrl}
      />
    </div>
  );
}
