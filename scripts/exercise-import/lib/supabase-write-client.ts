/**
 * Write-capable, service-role Supabase client for the exercise-import
 * pipeline. This is the ONE module in this pipeline permitted to hold a
 * service-role credential — `fetch.ts` and `match.ts` are dry-run and must
 * NEVER import it; only `merge.ts` (Phase 3) does.
 *
 * The service-role key bypasses RLS entirely, which is required because
 * `exercise_import_log` and `exercises_merge_backup` are RLS-enabled with
 * zero policies (deny-by-default for anon/authenticated; service-role is
 * the only writer — see 20260814_exercise_media_schema.sql).
 *
 * The key must never be logged, printed, or interpolated into an error
 * message.
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Builds a write-capable (service-role) Supabase client from SUPABASE_URL +
 * SUPABASE_SERVICE_KEY. Throws loudly, naming both required env vars and
 * the documented invocation, if either is missing.
 *
 * Deliberate divergence from `backend/api/src/middleware/auth.ts`'s admin
 * client: this function does NOT fall back to
 * `process.env.SUPABASE_PUBLISHABLE_KEY` when SUPABASE_SERVICE_KEY is
 * unset. A merge run silently downgrading to a non-privileged key would
 * fail every write with a confusing RLS-denied error instead of a clear
 * "set SUPABASE_SERVICE_KEY" message — so this omission is intentional,
 * not an oversight.
 */
export function createWriteClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing required env vars SUPABASE_URL and/or SUPABASE_SERVICE_KEY. ' +
        'Unlike fetch.ts/match.ts, merge.ts is the one script in this ' +
        'pipeline permitted and required to use the service-role key. Run ' +
        'this script from the repo root as documented in README.md, e.g. ' +
        'npx tsx --env-file=backend/api/.env.local scripts/exercise-import/merge.ts',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
