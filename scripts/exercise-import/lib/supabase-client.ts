/**
 * Read-only, publishable-key-only Supabase access for the exercise-import
 * pipeline. Least-privilege hard constraint (ASVS V4): the elevated
 * admin/service credential used elsewhere in this monorepo for writes must
 * never appear anywhere in this file — the existing `read_exercises` RLS
 * policy on `public.exercises` already grants everything this dry-run's
 * read path needs for an unauthenticated publishable-key client.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ProductionExerciseSchema, type ProductionExercise } from './types';

/**
 * Builds a read-only Supabase client from SUPABASE_URL +
 * SUPABASE_PUBLISHABLE_KEY. Throws loudly, naming both required env vars
 * and the documented invocation, if either is missing.
 */
export function createReadOnlyClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing required env vars SUPABASE_URL and/or SUPABASE_PUBLISHABLE_KEY. ' +
        'Run this script from the repo root as documented in README.md, e.g. ' +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/match.ts',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PAGE_SIZE = 1000;

// Exactly the columns this pipeline's matcher needs — no `select('*')`.
const SELECT_COLUMNS =
  'id, name, name_fr, category, body_part, equipment, target_muscle, secondary_muscles, is_custom';

/**
 * Reads every non-custom row from `public.exercises`, paginated past
 * PostgREST's silent 1000-row default cap (Pitfall 2). Excludes
 * `is_custom = true` rows (roadmap SC #3). The separate custom-coach
 * exercise table is never queried anywhere in this pipeline — that
 * exclusion is satisfied structurally by absence.
 *
 * A Supabase read error on any page throws immediately — a dry-run script
 * fails loudly, it does not degrade gracefully like a request handler.
 * The accumulated array is parsed through ProductionExerciseSchema before
 * returning, so a schema drift on the production side also fails loudly.
 */
export async function fetchAllProductionExercises(
  client: SupabaseClient,
): Promise<ProductionExercise[]> {
  const all: unknown[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await client
      .from('exercises')
      .select(SELECT_COLUMNS)
      .eq('is_custom', false)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all.push(...data);

    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all.map((row) => ProductionExerciseSchema.parse(row));
}
