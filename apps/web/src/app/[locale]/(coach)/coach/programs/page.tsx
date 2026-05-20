export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { createServerSupabase } from '@/lib/supabase/server';
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
  const locale = await getLocale();
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? '';

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  let programs: ProgramRow[] = [];
  let folders: FolderRow[] = [];

  if (jwt) {
    try {
      const [programsRes, foldersRes] = await Promise.all([
        fetch(`${apiUrl}/coach/programs`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
        fetch(`${apiUrl}/coach/programs/folders`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: 'no-store',
        }),
      ]);

      if (programsRes.ok) {
        const json = await programsRes.json();
        programs = json.programs ?? json ?? [];
      }
      if (foldersRes.ok) {
        const json = await foldersRes.json();
        folders = json.folders ?? json ?? [];
      }
    } catch (err) {
      console.error('[programs/page] fetch error:', err);
    }
  }

  return (
    <div className="flex-1 p-8 bg-background min-h-screen">
      <ProgramsClient programs={programs} folders={folders} locale={locale} />
    </div>
  );
}
