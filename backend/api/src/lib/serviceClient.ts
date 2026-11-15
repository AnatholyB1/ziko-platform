import { createClient } from '@supabase/supabase-js';

/**
 * Client service_role pour les RPC reservees au backend (migration 20261201270100 : ziko_create_form_instances_for_trigger,
 * ziko_earn_ai_credits, ziko_deduct_ai_credits ne sont plus executables par anon ni authenticated).
 * Ne JAMAIS l'utiliser pour lire/ecrire des donnees d'un utilisateur sans filtrer explicitement par userId.
 * Repli sur la cle publiable (dev local sans cle service) : ces RPC echoueront alors, ce qui est voulu (fail closed).
 */
export function createServiceRpcClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
