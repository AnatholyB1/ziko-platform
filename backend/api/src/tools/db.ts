import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * Creates a Supabase client that bypasses RLS using the service role key.
 * Only used on the backend — never exposed to clients.
 * The caller is responsible for scoping all queries to the correct userId.
 */
export function clientForUser(_userToken?: string) {
  return createClient(supabaseUrl, serviceKey ?? supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
