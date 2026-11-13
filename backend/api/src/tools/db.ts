import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * Creates a Supabase client that bypasses RLS using the service role key.
 * Only used on the backend — never exposed to clients.
 * The caller is responsible for scoping all queries to the correct userId.
 */
// ATTENTION (audit securite v1.20, constat 10) : malgre son nom, ce client IGNORE le jeton et agit en service_role.
// La RLS n'est donc PAS un filet : toute requete passant par ce client DOIT filtrer explicitement `.eq('user_id', userId)`
// (userId issu de c.get('auth'), jamais du corps de la requete). Revue de l'audit : workshop/, periodization/, quests/,
// league/ respectent cette regle ; toute nouvelle requete doit la respecter aussi.
export function clientForUser(_userToken?: string) {
  return createClient(supabaseUrl, serviceKey ?? supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
